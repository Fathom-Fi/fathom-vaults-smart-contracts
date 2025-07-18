// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;

import "../BaseStrategy.sol";
import "../aave/UniversalSwapper.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

// Inline interface definitions for Uniswap V3
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
    function burn(uint256 tokenId) external payable;
    function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1);
}

interface IUniswapV3Pool {
    function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

contract UniswapV3Provider is BaseStrategy, UniversalSwapper {
    using SafeERC20 for ERC20;

    // Uniswap V3 position manager
    INonfungiblePositionManager public immutable positionManager;
    // The pool we're providing liquidity to
    IUniswapV3Pool public immutable pool;
    // The paired token (e.g., USDC if asset is WETH)
    ERC20 public immutable pairedToken;
    // Pool fee tier
    uint24 public immutable poolFee;
    
    // Position parameters
    uint256 public tokenId; // Current position NFT ID (0 if no position)
    int24 public tickLower; // Lower tick of the range
    int24 public tickUpper; // Upper tick of the range
    int24 public tickSpacing; // Tick spacing for the pool
    
    // Strategy parameters
    uint256 public rangeWidth = 4000; // Default range width in ticks
    bool public autoRebalance = true; // Auto rebalance when out of range
    mapping(address => uint256) public minAmountToSellMapping;

    constructor(
        address _asset,
        string memory _name,
        address _tokenizedStrategyAddress,
        address _positionManager,
        address _pool,
        address _pairedToken,
        uint24 _poolFee,
        address _base,
        address _router,
        address _permit2
    ) BaseStrategy(_asset, _name, _tokenizedStrategyAddress) {
        positionManager = INonfungiblePositionManager(_positionManager);
        pool = IUniswapV3Pool(_pool);
        pairedToken = ERC20(_pairedToken);
        poolFee = _poolFee;
        
        // Validate pool tokens match our asset and paired token
        require(
            (pool.token0() == _asset && pool.token1() == _pairedToken) ||
            (pool.token0() == _pairedToken && pool.token1() == _asset),
            "!poolTokens"
        );
        require(pool.fee() == _poolFee, "!poolFee");
        
        // Set tick spacing based on fee tier
        if (_poolFee == 500) tickSpacing = 10;
        else if (_poolFee == 3000) tickSpacing = 60;
        else if (_poolFee == 10000) tickSpacing = 200;
        else revert("!tickSpacing");
        
        // Approve tokens for position manager
        asset.safeApprove(address(positionManager), type(uint256).max);
        pairedToken.safeApprove(address(positionManager), type(uint256).max);
        
        // Set swapper configuration
        base = _base;
        router = _router;
        permit2 = _permit2;
    }

    /// @notice Set range width for liquidity positions
    function setRangeWidth(uint256 _rangeWidth) external onlyManagement {
        require(_rangeWidth > 0 && _rangeWidth <= 10000, "!rangeWidth");
        rangeWidth = _rangeWidth;
    }

    /// @notice Set auto rebalance flag
    function setAutoRebalance(bool _autoRebalance) external onlyManagement {
        autoRebalance = _autoRebalance;
    }

    /// @notice Set uni fees for swaps
    function setUniFees(address _token0, address _token1, uint24 _fee) external onlyManagement {
        _setUniFees(_token0, _token1, _fee);
    }

    /// @notice Set minimum amount to sell for a token
    function setMinAmountToSellMapping(address _token, uint256 _amount) external onlyManagement {
        minAmountToSellMapping[_token] = _amount;
    }

    /// @notice Manually adjust position range
    function adjustRange(int24 _tickLower, int24 _tickUpper) external onlyManagement {
        require(_tickLower < _tickUpper, "!ticks");
        require(_tickLower % tickSpacing == 0 && _tickUpper % tickSpacing == 0, "!tickSpacing");
        
        if (tokenId != 0) {
            _closeLiquidityPosition();
        }
        
        tickLower = _tickLower;
        tickUpper = _tickUpper;
        
        uint256 assetBalance = asset.balanceOf(address(this));
        if (assetBalance > 0) {
            _deployFunds(assetBalance);
        }
    }

    /// @dev Deploy funds into Uniswap V3 liquidity position
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        
        // If we have an existing position and auto rebalance is off, just add liquidity
        if (tokenId != 0 && !autoRebalance) {
            _addLiquidity(_amount);
            return;
        }
        
        // Check if we need to rebalance (create new position)
        if (_shouldRebalance()) {
            if (tokenId != 0) {
                _closeLiquidityPosition();
            }
            _createLiquidityPosition(_amount);
        } else if (tokenId != 0) {
            _addLiquidity(_amount);
        } else {
            _createLiquidityPosition(_amount);
        }
    }

    /// @dev Free funds from Uniswap V3 position
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0 || tokenId == 0) return;
        
        // Get current position value
        uint256 positionValue = _getPositionValue();
        
        if (_amount >= positionValue) {
            // Close entire position
            _closeLiquidityPosition();
        } else {
            // Partial withdrawal - decrease liquidity proportionally
            (, , , , , , , uint128 liquidity, , , , ) = positionManager.positions(tokenId);
            uint128 liquidityToRemove = uint128((_amount * liquidity) / positionValue);
            
            if (liquidityToRemove > 0) {
                _decreaseLiquidity(liquidityToRemove);
            }
        }
    }

    /// @dev Harvest fees and report total assets
    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        // Collect fees from position
        if (tokenId != 0) {
            _collectFees();
        }
        
        // Swap paired tokens back to asset if we have enough
        uint256 pairedBalance = pairedToken.balanceOf(address(this));
        if (pairedBalance > minAmountToSellMapping[address(pairedToken)] && pairedBalance > 0) {
            _swapFrom(address(pairedToken), address(asset), pairedBalance, 0);
        }
        
        // Redeploy idle funds if not shutdown
        if (!TokenizedStrategy.isShutdown()) {
            uint256 idleAssets = asset.balanceOf(address(this));
            if (idleAssets > 0) {
                _deployFunds(idleAssets);
            }
        }
        
        _totalAssets = _getPositionValue() + asset.balanceOf(address(this));
    }

    /// @dev Emergency withdraw
    function _emergencyWithdraw(uint256 _amount) internal override {
        _freeFunds(_amount);
    }

    /// @notice Check if position should be rebalanced
    function _shouldRebalance() internal view returns (bool) {
        if (tokenId == 0 || !autoRebalance) return false;
        
        (, int24 currentTick, , , , , ) = pool.slot0();
        return currentTick <= tickLower || currentTick >= tickUpper;
    }

    /// @notice Create new liquidity position
    function _createLiquidityPosition(uint256 _amount) internal {
        // Calculate optimal range around current price
        (, int24 currentTick, , , , , ) = pool.slot0();
        
        int24 halfRange = int24(int256(rangeWidth / 2));
        tickLower = ((currentTick - halfRange) / tickSpacing) * tickSpacing;
        tickUpper = ((currentTick + halfRange) / tickSpacing) * tickSpacing;
        
        // Prepare mint parameters
        bool isToken0Asset = pool.token0() == address(asset);
        
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: isToken0Asset ? address(asset) : address(pairedToken),
            token1: isToken0Asset ? address(pairedToken) : address(asset),
            fee: poolFee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: isToken0Asset ? _amount : 0,
            amount1Desired: isToken0Asset ? 0 : _amount,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp + 300
        });
        
        // Mint the position
        (tokenId, , , ) = positionManager.mint(params);
    }

    /// @notice Add liquidity to existing position
    function _addLiquidity(uint256 _amount) internal {
        // This is simplified - in practice you'd need to calculate proper amounts
        // and handle the increase liquidity function
        // For now, create a new position
        _createLiquidityPosition(_amount);
    }

    /// @notice Decrease liquidity from position
    function _decreaseLiquidity(uint128 _liquidity) internal {
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = 
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: _liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 300
            });
        
        positionManager.decreaseLiquidity(params);
        _collectFees();
    }

    /// @notice Close entire liquidity position
    function _closeLiquidityPosition() internal {
        if (tokenId == 0) return;
        
        // Get position info
        (, , , , , , , uint128 liquidity, , , , ) = positionManager.positions(tokenId);
        
        // Decrease all liquidity
        if (liquidity > 0) {
            _decreaseLiquidity(liquidity);
        }
        
        // Collect any remaining fees and tokens
        _collectFees();
        
        // Burn the NFT
        positionManager.burn(tokenId);
        tokenId = 0;
    }

    /// @notice Collect fees from position
    function _collectFees() internal {
        if (tokenId == 0) return;
        
        INonfungiblePositionManager.CollectParams memory params = 
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
        
        positionManager.collect(params);
    }

    /// @notice Get current position value in terms of asset
    function _getPositionValue() internal view returns (uint256) {
        if (tokenId == 0) return 0;
        
        // This is simplified - in practice you'd calculate the exact value
        // based on current liquidity, tick range, and current price
        // For now, return a basic estimate
        (, , , , , , , uint128 liquidity, , , uint128 tokensOwed0, uint128 tokensOwed1) = 
            positionManager.positions(tokenId);
        
        // Basic approximation - would need more complex calculation in production
        return uint256(liquidity) / 1e12 + uint256(tokensOwed0) + uint256(tokensOwed1);
    }

    /// @notice Get available deposit limit
    function availableDepositLimit(address /*_owner*/) public pure override returns (uint256) {
        return type(uint256).max; // No limit for liquidity provision
    }

    /// @notice Get available withdraw limit
    function availableWithdrawLimit(address /*_owner*/) public view override returns (uint256) {
        return TokenizedStrategy.totalIdle() + _getPositionValue();
    }
} 