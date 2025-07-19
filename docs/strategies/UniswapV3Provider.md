# UniswapV3Provider Strategy

## Overview

The `UniswapV3Provider` strategy is a sophisticated DeFi strategy that provides concentrated liquidity to Uniswap V3 pools. This strategy inherits from both `BaseStrategy` and `UniversalSwapper`, enabling automated liquidity management, position optimization, and efficient token swapping capabilities.

## Features

- **Concentrated Liquidity Management**: Creates and manages Uniswap V3 NFT positions with custom price ranges
- **Auto-Rebalancing**: Automatically rebalances positions when price moves outside the configured range
- **Fee Optimization**: Collects trading fees from liquidity provision and optimizes for maximum yield
- **Range Management**: Configurable range width and manual range adjustment capabilities
- **Position NFT Handling**: Full lifecycle management of Uniswap V3 position NFTs (mint, increase, decrease, burn)
- **Multi-Network Support**: Deployed across Ethereum, Polygon, Arbitrum, Base, and Optimism

## Architecture

### Inheritance
```
UniswapV3Provider
├── BaseStrategy (core strategy functionality)
└── UniversalSwapper (token swapping capabilities)
```

### Key Components

1. **Uniswap V3 Integration**
   - `positionManager`: The Uniswap V3 NonfungiblePositionManager for position lifecycle management
   - `pool`: The specific Uniswap V3 pool where liquidity is provided
   - `pairedToken`: The token paired with the strategy's asset (e.g., USDC if asset is WETH)
   - `poolFee`: The fee tier of the pool (500 = 0.05%, 3000 = 0.3%, 10000 = 1.0%)

2. **Position Management**
   - `tokenId`: Current position NFT ID (0 if no active position)
   - `tickLower` / `tickUpper`: Price range boundaries for the liquidity position
   - `tickSpacing`: Minimum tick spacing based on pool fee tier
   - `rangeWidth`: Configurable width of the price range (default: 4000 ticks)

3. **Strategy Configuration**
   - `autoRebalance`: Enable/disable automatic position rebalancing when out of range
   - `minAmountToSellMapping`: Minimum amounts required to sell specific tokens

## Constructor Parameters

```solidity
constructor(
    address _asset,                     // The primary asset token (e.g., WETH)
    string memory _name,                // Strategy name
    address _tokenizedStrategyAddress,  // TokenizedStrategy implementation
    address _positionManager,           // Uniswap V3 NonfungiblePositionManager
    address _pool,                      // Target Uniswap V3 pool
    address _pairedToken,               // Paired token (e.g., USDC)
    uint24 _poolFee,                    // Pool fee tier (500/3000/10000)
    address _base,                      // Base token for multi-hop swaps
    address _router,                    // UniversalRouter for token swaps
    address _permit2                    // Permit2 contract for gas-efficient approvals
)
```

## Network Deployments

| Network  | Position Manager | Swap Router | Fee Tier | Asset Pair |
|----------|------------------|-------------|----------|------------|
| Ethereum | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | 500 (0.05%) | USDC/WETH |
| Polygon  | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | 500 (0.05%) | USDC/WMATIC |
| Arbitrum | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | 500 (0.05%) | USDC/WETH |
| Base     | `0x03a520b32C04BF3bEEf7BF5d52Fd0b9b7Ca60EF6` | `0x2626664c2603336E57B271c5C0b26F421741e481` | 500 (0.05%) | USDC/WETH |
| Optimism | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | 500 (0.05%) | USDC/WETH |

## Management Functions

### Range Management
```solidity
// Set the range width for new positions (in ticks)
function setRangeWidth(uint256 _rangeWidth) external onlyManagement

// Enable/disable automatic rebalancing
function setAutoRebalance(bool _autoRebalance) external onlyManagement

// Manually adjust position range
function adjustRange(int24 _tickLower, int24 _tickUpper) external onlyManagement
```

### Swap Configuration
```solidity
// Set Uniswap fees for token swaps
function setUniFees(address _token0, address _token1, uint24 _fee) external onlyManagement

// Set minimum sell amounts for tokens
function setMinAmountToSellMapping(address _token, uint256 _amount) external onlyManagement
```

## Strategy Logic

### Position Creation
1. **Range Calculation**: Calculates optimal price range around current tick
2. **Tick Alignment**: Aligns ticks to the pool's tick spacing requirements
3. **Position Minting**: Creates new NFT position with appropriate token amounts
4. **Token Approval**: Manages token approvals for the position manager

### Auto-Rebalancing
- **Trigger**: Position goes out of range (current price outside tick bounds)
- **Process**: 
  1. Close existing position (collect fees + liquidity)
  2. Calculate new range around current price
  3. Create new position with collected assets
- **Control**: Can be disabled via `setAutoRebalance(false)`

### Fee Collection
- **Harvest**: Automatically collects trading fees during `_harvestAndReport()`
- **Conversion**: Swaps paired tokens back to primary asset when above minimum thresholds
- **Redeployment**: Redeploys idle assets to maintain optimal capital efficiency

## Risk Considerations

### Impermanent Loss
- **High Risk**: Concentrated liquidity positions are more susceptible to impermanent loss
- **Mitigation**: Tight range management and regular rebalancing help minimize exposure
- **Monitoring**: Track price movements relative to position range

### Range Management
- **Out-of-Range Risk**: Positions earn no fees when price moves outside the range
- **Gas Costs**: Frequent rebalancing incurs transaction costs
- **Optimal Range**: Balance between capital efficiency and range coverage

### Technical Risks
- **Smart Contract Risk**: Dependency on Uniswap V3 protocol security
- **NFT Management**: Risk of position NFT loss or mismanagement
- **Slippage**: Large position adjustments may incur significant slippage

## Monitoring & Maintenance

### Key Metrics
```solidity
// Check current position status
function tokenId() external view returns (uint256)           // Active position NFT ID
function tickLower() external view returns (int24)          // Lower price bound
function tickUpper() external view returns (int24)          // Upper price bound

// Position health indicators
function _shouldRebalance() internal view returns (bool)    // Rebalance trigger
function _getPositionValue() internal view returns (uint256) // Total position value
```

### Maintenance Tasks
1. **Range Monitoring**: Ensure positions remain in optimal ranges
2. **Fee Collection**: Monitor fee accumulation and collection frequency
3. **Gas Optimization**: Balance rebalancing frequency with gas costs
4. **Token Inventory**: Monitor token balances and swap thresholds

### Operational Commands
```bash
# Check position status
cast call $STRATEGY_ADDRESS "tokenId()(uint256)"

# View current range
cast call $STRATEGY_ADDRESS "tickLower()(int24)"
cast call $STRATEGY_ADDRESS "tickUpper()(int24)"

# Check rebalance status
cast call $STRATEGY_ADDRESS "autoRebalance()(bool)"
```

## Performance Optimization

### Range Width Optimization
- **Narrow Ranges**: Higher capital efficiency but more frequent rebalancing
- **Wide Ranges**: Lower maintenance but reduced fee capture
- **Market Conditions**: Adjust based on volatility and trading volume

### Rebalancing Strategy
- **Frequency**: Balance between fee capture and gas costs
- **Timing**: Consider market conditions and volatility
- **Threshold**: Set appropriate triggers for rebalancing decisions

### Fee Management
- **Collection Timing**: Optimize fee collection based on accumulation
- **Token Swaps**: Set appropriate minimum thresholds to avoid dust trades
- **Slippage Tolerance**: Configure swap parameters for optimal execution

## Examples

### Basic Deployment
```javascript
// Deploy UniswapV3Provider for USDC/WETH on Ethereum
const strategy = await UniswapV3Provider.deploy(
    "0xA0b86a33E6441b6Da0D87Bb4c6Ac863B9cc6E1b5", // USDC
    "UniswapV3Provider USDC/WETH",
    tokenizedStrategy.address,
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88", // Position Manager
    poolAddress,                                     // USDC/WETH pool
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    500,                                             // 0.05% fee tier
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH as base
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
    "0x000000000022D473030F116dDEE9F6B43aC78BA3"  // Permit2
);
```

### Range Configuration
```javascript
// Set conservative range width (8000 ticks)
await strategy.setRangeWidth(8000);

// Enable auto-rebalancing
await strategy.setAutoRebalance(true);

// Set manual range around current price
await strategy.adjustRange(tickLower, tickUpper);
```

### Fee Configuration
```javascript
// Set swap fees for WETH/USDC
await strategy.setUniFees(wethAddress, usdcAddress, 500);

// Set minimum sell amount for fee tokens
await strategy.setMinAmountToSellMapping(feeTokenAddress, ethers.parseEther("0.1"));
```

## Security Features

- **Access Control**: Management functions restricted to authorized roles
- **Input Validation**: Comprehensive parameter validation and bounds checking
- **Safe Math**: Uses OpenZeppelin's SafeERC20 for token operations
- **Position Safety**: Validates tick spacing and range requirements
- **Emergency Controls**: Emergency withdrawal capabilities for risk mitigation

## Gas Optimization

- **Batch Operations**: Combines position adjustments with fee collection
- **Permit2 Integration**: Reduces approval gas costs through batch operations
- **Efficient Rebalancing**: Minimizes unnecessary position adjustments
- **Smart Thresholds**: Prevents dust transactions and excessive micro-management 