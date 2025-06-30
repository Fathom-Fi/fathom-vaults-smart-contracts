// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.19;

import "../BaseStrategy.sol";
import "../aave/UniversalSwapper.sol";
import "../aave/interfaces/ILender.sol"; // optional marker interface
import { IPool } from "../aave/interfaces/IPool.sol";
import { IRewardsController } from "../aave/interfaces/IRewardsController.sol";
import { IAToken } from "../aave/interfaces/IAToken.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Minimal interface for Uniswap V3 non-fungible position manager – only what we need.
interface INonfungiblePositionManager {
    // Minimal placeholder; full interface can be added in a future upgrade.
}

/// @title Multi-Protocol Strategy (Aave V3 + Uni V3/V2 + Curve ready)
/// @author Fathom.fi
/// @dev The initial implementation deploys capital to Aave V3 while exposing
///      management hooks for further diversification. Future upgrades can enable
///      the additional legs without storage changes.
contract MultiProtocolStrategy is BaseStrategy, UniversalSwapper {
    using SafeERC20 for ERC20;

    // -----------------------------------
    // Protocol enums & storage           
    // -----------------------------------
    enum Leg {
        Aave,
        UniV3,
        UniV2,
        Curve
    }

    // Allocation in basis points (10000 = 100%).
    mapping(Leg => uint16) public targetBps;

    // Toggle for active legs.
    mapping(Leg => bool) public legActive;

    // ------------------------------
    // Aave-specific immutables
    // ------------------------------
    IPool public immutable LENDING_POOL;
    IAToken public immutable A_TOKEN;
    IRewardsController public rewardsController;
    uint256 internal immutable DECIMALS;

    // Supply cap helpers (copied from AaveV3Lender).
    uint256 internal constant SUPPLY_CAP_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFF000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 internal constant SUPPLY_CAP_START_BIT_POSITION = 116;

    // --------------------------------
    // Other protocol addresses (settable but unused in v1)
    // --------------------------------
    INonfungiblePositionManager public immutable positionManager; // UniV3

    // --------------------------------
    // Config
    // --------------------------------
    bool public claimRewards = true;
    mapping(address => uint256) public minAmountToSellMapping; // token => min sell amount

    // --------------------------------
    // Constructor
    // --------------------------------
    constructor(
        address _asset,
        string memory _name,
        address _tokenizedStrategyAddress,
        address _aavePool,
        address _base,
        address _router,
        address _permit2,
        address _positionManager
    ) BaseStrategy(_asset, _name, _tokenizedStrategyAddress) {
        // ----- Aave init -----
        LENDING_POOL = IPool(_aavePool);
        A_TOKEN = IAToken(LENDING_POOL.getReserveData(_asset).aTokenAddress);
        require(address(A_TOKEN) != address(0), "invalid aToken");
        DECIMALS = ERC20(address(A_TOKEN)).decimals();
        rewardsController = A_TOKEN.getIncentivesController();

        // Approvals
        asset.safeApprove(address(LENDING_POOL), type(uint256).max);

        // Uniswap V3
        positionManager = INonfungiblePositionManager(_positionManager);

        // Swapper config (UniversalSwapper)
        base = _base;
        router = _router;
        permit2 = _permit2;

        // default allocations – 100% Aave
        targetBps[Leg.Aave] = 10_000;
        legActive[Leg.Aave] = true;
    }

    // --------------------------------
    // Management functions
    // --------------------------------
    function setTargetAllocations(uint16 _aave, uint16 _uniV3, uint16 _uniV2, uint16 _curve) external onlyManagement {
        require(_aave + _uniV3 + _uniV2 + _curve == 10_000, "!bps");
        targetBps[Leg.Aave] = _aave;
        targetBps[Leg.UniV3] = _uniV3;
        targetBps[Leg.UniV2] = _uniV2;
        targetBps[Leg.Curve] = _curve;
    }

    function toggleLeg(Leg _leg, bool _active) external onlyManagement {
        legActive[_leg] = _active;
    }

    function setUniFees(address _token0, address _token1, uint24 _fee) external onlyManagement {
        _setUniFees(_token0, _token1, _fee);
    }

    function setMinAmountToSellMapping(address _token, uint256 _amount) external onlyManagement {
        require(_amount < type(uint256).max, "too high");
        minAmountToSellMapping[_token] = _amount;
    }

    function setClaimRewards(bool _bool) external onlyManagement {
        claimRewards = _bool;
    }

    function setRewardsController(address _controller) external onlyManagement {
        rewardsController = IRewardsController(_controller);
    }

    /// @notice Arbitrary call helper (e.g., join Curve, manage UniV3 NFT, etc.)
    function execute(address _target, bytes calldata _data) external onlyManagement returns (bytes memory) {
        require(_target != address(0), "0x0 target");
        (bool ok, bytes memory result) = _target.call(_data);
        require(ok, "exec failed");
        return result;
    }

    // --------------------------------
    // BaseStrategy overrides
    // --------------------------------

    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Currently route everything to Aave. Allocation logic can be
        // expanded in future versions.
        if (legActive[Leg.Aave]) {
            LENDING_POOL.supply(address(asset), _amount, address(this), 0);
        } else {
            // Keep idle if no leg active.
        }
    }

    function _freeFunds(uint256 _amount) internal override {
        // withdraw from Aave first. For now assume all funds there.
        uint256 loose = asset.balanceOf(address(this));
        if (loose >= _amount) return; // already enough
        uint256 toWithdraw = _amount - loose;
        LENDING_POOL.withdraw(address(asset), Math.min(A_TOKEN.balanceOf(address(this)), toWithdraw), address(this));
    }

    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        if (claimRewards) {
            _claimAndSellRewards();
        }

        uint256 loose = asset.balanceOf(address(this));
        if (!TokenizedStrategy.isShutdown() && loose > 0) {
            LENDING_POOL.supply(address(asset), loose, address(this), 0);
            loose = 0;
        }

        _totalAssets = A_TOKEN.balanceOf(address(this)) + loose;
    }

    function _emergencyWithdraw(uint256 _amount) internal override {
        LENDING_POOL.withdraw(address(asset), Math.min(_amount, A_TOKEN.balanceOf(address(this))), address(this));
    }

    // --------------------------------
    // View helpers
    // --------------------------------
    function getMetadata() external view override returns (bytes4 interfaceId, bytes memory data) {
        return (type(ILender).interfaceId, abi.encode(address(LENDING_POOL), address(A_TOKEN)));
    }

    function availableDepositLimit(address /*_owner*/) public view override returns (uint256) {
        uint256 cap = getSupplyCap();
        if (cap == 0) return type(uint256).max;
        uint256 supply = A_TOKEN.totalSupply();
        return cap > supply ? cap - supply : 0;
    }

    function availableWithdrawLimit(address /*_owner*/) public view override returns (uint256) {
        return TokenizedStrategy.totalIdle() + asset.balanceOf(address(A_TOKEN));
    }

    function getSupplyCap() public view returns (uint256) {
        uint256 data = LENDING_POOL.getReserveData(address(asset)).configuration.data;
        uint256 cap = (data & ~SUPPLY_CAP_MASK) >> SUPPLY_CAP_START_BIT_POSITION;
        return cap * (10 ** DECIMALS);
    }

    // --------------------------------
    // Internal reward harvesting
    // --------------------------------
    function _claimAndSellRewards() internal {
        address[] memory assets = new address[](1);
        assets[0] = address(A_TOKEN);
        (address[] memory rewardsList, ) = rewardsController.claimAllRewardsToSelf(assets);

        for (uint256 i = 0; i < rewardsList.length; ++i) {
            address token = rewardsList[i];
            if (token == address(asset)) continue;
            uint256 bal = ERC20(token).balanceOf(address(this));
            if (bal > minAmountToSellMapping[token]) {
                _swapFrom(token, address(asset), bal, 0);
            }
        }
    }
} 