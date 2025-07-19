// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;

import "../BaseStrategy.sol";
import "./UniversalSwapper.sol";
import "./interfaces/IRewardsController.sol";
import { IPool } from "./interfaces/IPool.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAToken } from "./interfaces/IAToken.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";


/**
 * @title AaveV3Strategy
 * @dev Standalone strategy for lending assets to Aave V3 protocol
 */
contract AaveV3Strategy is BaseStrategy, UniversalSwapper {
    using SafeERC20 for ERC20;

    IPool public immutable LENDING_POOL;
    IAToken public immutable A_TOKEN;
    uint256 internal immutable DECIMALS;
    IRewardsController public rewardsController;
    bool public claimRewards = true;
    mapping(address => uint256) public minAmountToSellMapping;

    uint256 internal constant SUPPLY_CAP_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFF000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 internal constant SUPPLY_CAP_START_BIT_POSITION = 116;

    constructor(
    address _asset,
    string memory _name,
    address _tokenizedStrategyAddress,
    address _lendingPool,
    address _base,
    address _router,
    address _permit2
    ) BaseStrategy(_asset, _name, _tokenizedStrategyAddress) {
        LENDING_POOL = IPool(_lendingPool);
        A_TOKEN = IAToken(LENDING_POOL.getReserveData(_asset).aTokenAddress);
        require(address(A_TOKEN) != address(0), "Invalid aToken");
        DECIMALS = ERC20(address(A_TOKEN)).decimals();
        rewardsController = A_TOKEN.getIncentivesController();
        asset.safeApprove(address(LENDING_POOL), type(uint256).max);
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

    function setRewardsController(address _rewardsController) external onlyManagement {
        rewardsController = IRewardsController(_rewardsController);
    }

    function availableDepositLimit(address /*_owner*/) public view override returns (uint256) {
        uint256 supplyCap = getSupplyCap();
        if (supplyCap == 0) return type(uint256).max;
        uint256 supply = A_TOKEN.totalSupply();
        if (supplyCap <= supply) return 0;
        return supplyCap - supply;
    }

    function getSupplyCap() public view returns (uint256) {
        uint256 data = LENDING_POOL.getReserveData(address(asset)).configuration.data;
        uint256 cap = (data & ~SUPPLY_CAP_MASK) >> SUPPLY_CAP_START_BIT_POSITION;
        return cap * (10 ** DECIMALS);
    }

    function availableWithdrawLimit(address /*_owner*/) public view override returns (uint256) {
        return TokenizedStrategy.totalIdle() + asset.balanceOf(address(A_TOKEN));
    }

    function getMetadata() external override view returns (bytes4 interfaceId, bytes memory data) {
        return (bytes4(keccak256("AaveV3Strategy")), abi.encode(address(LENDING_POOL), address(A_TOKEN)));
    }

    function _deployFunds(uint256 _amount) internal override {
        LENDING_POOL.supply(address(asset), _amount, address(this), 0);
    }

    function _freeFunds(uint256 _amount) internal override {
        LENDING_POOL.withdraw(address(asset), Math.min(A_TOKEN.balanceOf(address(this)), _amount), address(this));
    }

    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        if (claimRewards) {
            _claimAndSellRewards();
        }
        if (!TokenizedStrategy.isShutdown()) {
            uint256 looseAsset = asset.balanceOf(address(this));
            if (looseAsset > 0) {
                LENDING_POOL.supply(address(asset), Math.min(looseAsset, availableDepositLimit(address(this))), address(this), 0);
            }
        }
        _totalAssets = A_TOKEN.balanceOf(address(this)) + asset.balanceOf(address(this));
    }

    function _claimAndSellRewards() internal {
        address[] memory assets = new address[](1);
        assets[0] = address(A_TOKEN);
        (address[] memory rewardsList, ) = rewardsController.claimAllRewardsToSelf(assets);
        for (uint256 i = 0; i < rewardsList.length; ++i) {
            address token = rewardsList[i];
            if (token == address(asset)) {
                continue;
            }
            uint256 balance = ERC20(token).balanceOf(address(this));
            if (balance > minAmountToSellMapping[token]) {
                _swapFrom(token, address(asset), balance, 0);
            }
        }
    }

    function _emergencyWithdraw(uint256 _amount) internal override {
        LENDING_POOL.withdraw(address(asset), Math.min(_amount, A_TOKEN.balanceOf(address(this))), address(this));
    }
} 