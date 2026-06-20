// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;

import "../BaseStrategy.sol";
import "../aave/UniversalSwapper.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

interface ICurvePool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 _min_amount) external returns (uint256);
    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);
    function token() external view returns (address);
    function coins(uint256 i) external view returns (address);
    function balances(uint256 i) external view returns (uint256);
}

interface ICurveGauge {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function claim_rewards() external;
    function claimable_tokens(address addr) external view returns (uint256);
    function claimable_reward(address _addr, address _token) external view returns (uint256);
    function rewarded_token() external view returns (address);
    function reward_tokens(uint256 i) external view returns (address);
}

interface ICurveMinter {
    function mint(address gauge) external;
    function minted(address user, address gauge) external view returns (uint256);
}

/**
 * @title CurveStrategy
 * @dev Strategy for providing liquidity to Curve pools and staking LP tokens in gauges
 */
contract CurveStrategy is BaseStrategy, UniversalSwapper {
    using SafeERC20 for ERC20;

    ICurvePool public immutable CURVE_POOL;
    ICurveGauge public immutable CURVE_GAUGE;
    ICurveMinter public immutable CRV_MINTER;
    ERC20 public immutable LP_TOKEN;
    ERC20 public immutable CRV_TOKEN;
    
    uint256 public immutable ASSET_INDEX;
    uint256 public immutable POOL_SIZE;
    
    bool public claimRewards = true;
    mapping(address => uint256) public minAmountToSellMapping;

    constructor(
    address _asset,
    string memory _name,
    address _tokenizedStrategyAddress,
    address _curvePool,
    address _curveGauge,
    address _crvMinter,
    address _crvToken,
    uint256 _assetIndex,
    uint256 _poolSize,
    address _base,
    address _router,
    address _permit2
    ) BaseStrategy(_asset, _name, _tokenizedStrategyAddress) {
        require(_poolSize >= 2 && _poolSize <= 4, "Invalid pool size");
        require(_assetIndex < _poolSize, "Invalid asset index");
        
        CURVE_POOL = ICurvePool(_curvePool);
        CURVE_GAUGE = ICurveGauge(_curveGauge);
        CRV_MINTER = ICurveMinter(_crvMinter);
        CRV_TOKEN = ERC20(_crvToken);
        
        LP_TOKEN = ERC20(CURVE_POOL.token());
        require(CURVE_POOL.coins(_assetIndex) == _asset, "Asset mismatch");
        
        ASSET_INDEX = _assetIndex;
        POOL_SIZE = _poolSize;
        
        asset.safeApprove(_curvePool, type(uint256).max);
        LP_TOKEN.safeApprove(_curveGauge, type(uint256).max);
        
        base = _base;
        router = _router;
        permit2 = _permit2;
    }

    function setUniFees(address _token0, address _token1, uint24 _fee) external onlyManagement {
        require(_fee < type(uint256).max, "Fee too high");
        _setUniFees(_token0, _token1, _fee);
    }

    function sellRewardManually(address _token, uint256 _amount, uint256 _minAmountOut) external onlyManagement {
        _swapFrom(_token, address(asset), Math.min(_amount, ERC20(_token).balanceOf(address(this))), _minAmountOut);
    }

    function setMinAmountToSellMapping(address _token, uint256 _amount) external onlyManagement {
        require(_amount < type(uint256).max, "Amount too high");
        minAmountToSellMapping[_token] = _amount;
    }

    function setClaimRewards(bool _bool) external onlyManagement {
        claimRewards = _bool;
    }

    function availableDepositLimit(address /*_owner*/) public view override returns (uint256) {
        return type(uint256).max;
    }

    function availableWithdrawLimit(address /*_owner*/) public view override returns (uint256) {
        return TokenizedStrategy.totalIdle() + _stakedBalance();
    }

    function getMetadata() external override view returns (bytes4 interfaceId, bytes memory data) {
        return (bytes4(keccak256("CurveStrategy")), abi.encode(address(CURVE_POOL), address(CURVE_GAUGE)));
    }

    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        
        if (POOL_SIZE == 2) {
            uint256[2] memory amounts;
            amounts[ASSET_INDEX] = _amount;
            uint256 lpReceived = CURVE_POOL.add_liquidity(amounts, 0);
            CURVE_GAUGE.deposit(lpReceived);
        } else if (POOL_SIZE == 3) {
            uint256[3] memory amounts;
            amounts[ASSET_INDEX] = _amount;
            uint256 lpReceived = CURVE_POOL.add_liquidity(amounts, 0);
            CURVE_GAUGE.deposit(lpReceived);
        } else if (POOL_SIZE == 4) {
            uint256[4] memory amounts;
            amounts[ASSET_INDEX] = _amount;
            uint256 lpReceived = CURVE_POOL.add_liquidity(amounts, 0);
            CURVE_GAUGE.deposit(lpReceived);
        }
    }

    function _freeFunds(uint256 _amount) internal override {
        uint256 stakedBalance = _stakedBalance();
        if (stakedBalance == 0) return;
        
        uint256 lpToWithdraw = Math.min(_amount, CURVE_POOL.calc_withdraw_one_coin(stakedBalance, int128(uint128(ASSET_INDEX))));
        lpToWithdraw = Math.min(lpToWithdraw, stakedBalance);
        
        if (lpToWithdraw > 0) {
            CURVE_GAUGE.withdraw(lpToWithdraw);
            CURVE_POOL.remove_liquidity_one_coin(lpToWithdraw, int128(uint128(ASSET_INDEX)), 0);
        }
    }

    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        if (claimRewards) {
            _claimAndSellRewards();
        }
        
        if (!TokenizedStrategy.isShutdown()) {
            uint256 looseAsset = asset.balanceOf(address(this));
            if (looseAsset > 0) {
                _deployFunds(looseAsset);
            }
        }
        
        _totalAssets = asset.balanceOf(address(this)) + _stakedBalance();
    }

    function _claimAndSellRewards() internal {
        CRV_MINTER.mint(address(CURVE_GAUGE));
        CURVE_GAUGE.claim_rewards();
        
        uint256 crvBalance = CRV_TOKEN.balanceOf(address(this));
        if (crvBalance > minAmountToSellMapping[address(CRV_TOKEN)]) {
            _swapFrom(address(CRV_TOKEN), address(asset), crvBalance, 0);
        }
        
        for (uint256 i = 0; i < 8; i++) {
            try CURVE_GAUGE.reward_tokens(i) returns (address rewardToken) {
                if (rewardToken == address(0) || rewardToken == address(asset)) break;
                
                uint256 balance = ERC20(rewardToken).balanceOf(address(this));
                if (balance > minAmountToSellMapping[rewardToken]) {
                    _swapFrom(rewardToken, address(asset), balance, 0);
                }
            } catch {
                break;
            }
        }
    }

    function _emergencyWithdraw(uint256 _amount) internal override {
        uint256 stakedBalance = _stakedBalance();
        uint256 lpToWithdraw = Math.min(_amount, stakedBalance);
        
        if (lpToWithdraw > 0) {
            CURVE_GAUGE.withdraw(lpToWithdraw);
            CURVE_POOL.remove_liquidity_one_coin(lpToWithdraw, int128(uint128(ASSET_INDEX)), 0);
        }
    }

    function _stakedBalance() internal view returns (uint256) {
        uint256 gaugeBalance = CURVE_GAUGE.balanceOf(address(this));
        if (gaugeBalance == 0) return 0;
        
        return CURVE_POOL.calc_withdraw_one_coin(gaugeBalance, int128(uint128(ASSET_INDEX)));
    }
} 