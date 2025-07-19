# CurveStrategy

## Overview

The `CurveStrategy` is a DeFi strategy that provides liquidity to Curve Finance pools and stakes the resulting LP tokens in Curve gauges to earn CRV rewards and additional incentives. This strategy inherits from both `BaseStrategy` and `UniversalSwapper`, enabling core strategy functionality and flexible token swapping for reward optimization.

## Features

- **Curve LP Provision**: Provides single-sided liquidity to Curve pools (2-4 assets supported)
- **Gauge Staking**: Stakes LP tokens in Curve gauges to earn CRV and additional rewards
- **Automatic Reward Harvesting**: Claims and sells CRV and gauge rewards back to base asset
- **Flexible Pool Support**: Supports 2, 3, and 4-asset Curve pools
- **Asset Index Configuration**: Configurable position within Curve pools
- **Management Controls**: Configurable reward claiming, swap fees, and minimum sell amounts

## Architecture

### Inheritance
```
CurveStrategy
├── BaseStrategy (core strategy functionality)
└── UniversalSwapper (token swapping capabilities)
```

### Key Components

1. **Curve Integration**
   - `CURVE_POOL`: The Curve pool contract for liquidity provision
   - `CURVE_GAUGE`: The Curve gauge for LP token staking
   - `CRV_MINTER`: Curve's minter contract for CRV token distribution
   - `LP_TOKEN`: The Curve LP token received from liquidity provision

2. **Pool Configuration**
   - `ASSET_INDEX`: Position of strategy asset within the Curve pool (0-based)
   - `POOL_SIZE`: Number of assets in the Curve pool (2, 3, or 4)
   - `CRV_TOKEN`: CRV token address for reward claiming

3. **Rewards Management**
   - `claimRewards`: Boolean to enable/disable reward claiming
   - `minAmountToSellMapping`: Minimum amounts required to sell specific reward tokens

4. **Swapping Infrastructure**
   - `base`: Base token for multi-hop swaps (typically WETH)
   - `router`: UniversalRouter address for executing swaps
   - `permit2`: Permit2 contract for gas-efficient approvals

## Constructor Parameters

```solidity
constructor(
    address _asset,              // The underlying asset to provide as liquidity
    string memory _name,         // Strategy name
    address _tokenizedStrategyAddress,  // TokenizedStrategy implementation
    address _curvePool,          // Curve pool address
    address _curveGauge,         // Curve gauge address
    address _crvMinter,          // CRV minter address
    address _crvToken,           // CRV token address
    uint256 _assetIndex,         // Asset position in pool (0-based)
    uint256 _poolSize,           // Number of assets in pool (2-4)
    address _base,               // Base token for swapping
    address _router,             // UniversalRouter address
    address _permit2             // Permit2 contract address
)
```

## Core Functions

### Liquidity Management

#### `_deployFunds(uint256 _amount)`
Provides single-sided liquidity to the Curve pool:
1. Creates appropriate array for pool size (2, 3, or 4 assets)
2. Sets asset amount at the correct index
3. Calls `add_liquidity()` with zero minimum LP tokens
4. Stakes received LP tokens in the gauge

#### `_freeFunds(uint256 _amount)`
Withdraws liquidity from Curve:
1. Calculates LP tokens needed for desired asset amount
2. Withdraws LP tokens from gauge
3. Uses `remove_liquidity_one_coin()` to get back the strategy asset

#### `_harvestAndReport() → uint256`
1. Claims and sells rewards if enabled
2. Redeploys any idle assets (if not shutdown)
3. Returns total assets under management (staked LP value + idle assets)

### Reward Management

#### `_claimAndSellRewards()`
1. Mints CRV tokens using the minter
2. Claims additional gauge rewards
3. Swaps CRV tokens if balance exceeds minimum
4. Iterates through additional reward tokens (up to 8)
5. Swaps each reward token if balance exceeds minimum threshold

### Balance Calculations

#### `_stakedBalance() → uint256`
Calculates the strategy asset value of staked LP tokens:
1. Gets gauge balance (staked LP tokens)
2. Uses `calc_withdraw_one_coin()` to estimate asset value
3. Returns equivalent asset amount

## Pool Size Support

The strategy supports Curve pools with 2, 3, or 4 assets:

### 2-Asset Pools
```solidity
uint256[2] memory amounts;
amounts[ASSET_INDEX] = _amount;
CURVE_POOL.add_liquidity(amounts, 0);
```

### 3-Asset Pools (e.g., 3Pool: DAI/USDC/USDT)
```solidity
uint256[3] memory amounts;
amounts[ASSET_INDEX] = _amount;
CURVE_POOL.add_liquidity(amounts, 0);
```

### 4-Asset Pools
```solidity
uint256[4] memory amounts;
amounts[ASSET_INDEX] = _amount;
CURVE_POOL.add_liquidity(amounts, 0);
```

## Management Functions

### Swap Configuration
- `setUniFees(address _token0, address _token1, uint24 _fee)`: Sets swap fees for token pairs
- `setMinAmountToSellMapping(address _token, uint256 _amount)`: Sets minimum sell amounts for reward tokens

### Reward Management
- `setClaimRewards(bool _bool)`: Enables/disables automatic reward claiming
- `sellRewardManually(address _token, uint256 _amount, uint256 _minAmountOut)`: Manually sells reward tokens

## Deployment Configuration

### Network Addresses

#### Mainnet
- **Example: 3Pool (DAI/USDC/USDT)**
- **Curve Pool**: `0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7`
- **Curve Gauge**: `0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A`
- **CRV Minter**: `0xd061D61a4d941c39E5453435B6345Dc261C2fcE0`
- **CRV Token**: `0xD533a949740bb3306d119CC777fa900bA034cd52`
- **Base Token (WETH)**: `0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7`
- **Universal Router**: `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

#### Polygon
- **Example: aUSD Pool**
- **Curve Pool**: `0x445FE580eF8d70FF569aB36e80c647af338db351`
- **Curve Gauge**: `0xAA374Fbb99AC18534BFBAA96aD6EDB1AE31FAAEC`
- **CRV Minter**: `0xabC000d88f23Bb679b53bE8E5cf8007E9c1b2f6`
- **CRV Token**: `0x172370d5Cd63279eFa6d502DAB29171933a610AF`
- **Base Token (WMATIC)**: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`
- **Universal Router**: `0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

#### Arbitrum
- **Example: 2Pool (USDC/USDT)**
- **Curve Pool**: `0x7f90122BF0700F9E7e1F688fe926940E8839F353`
- **Curve Gauge**: `0xCE5F24B7A95e9cBa7df4B54E911B4A3Dc8CDAf6f`
- **CRV Minter**: `0xabC000d88f23Bb679b53bE8E5cf8007E9c1b2f6`
- **CRV Token**: `0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978`
- **Base Token (WETH)**: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- **Universal Router**: `0x5E325eDA8064b456f4781070C0738d849c824258`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Usage Example

```javascript
// Deploy strategy for DAI in 3Pool (index 0)
const strategy = await CurveStrategy.deploy(
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "Curve 3Pool DAI Strategy",
    tokenizedStrategyAddress,
    "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7", // 3Pool
    "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A", // 3Pool Gauge
    "0xd061D61a4d941c39E5453435B6345Dc261C2fcE0", // CRV Minter
    "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV Token
    0, // DAI is at index 0 in 3Pool
    3, // 3Pool has 3 assets
    "0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7", // WETH
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
    "0x000000000022D473030F116dDEE9F6B43aC78BA3"  // Permit2
);

// Configure swap fees for CRV → WETH → DAI
await strategy.setUniFees(crvToken, wethToken, 3000); // 0.3%
await strategy.setUniFees(wethToken, daiToken, 500);   // 0.05%

// Set minimum sell amount for CRV rewards
await strategy.setMinAmountToSellMapping(crvToken, ethers.parseEther("1"));
```

## Pool Configuration Examples

### DAI in 3Pool
- **Asset**: DAI (`0x6B175474E89094C44Da98b954EedeAC495271d0F`)
- **Asset Index**: 0
- **Pool Size**: 3
- **Pool Assets**: [DAI, USDC, USDT]

### USDC in 3Pool
- **Asset**: USDC (`0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7`)
- **Asset Index**: 1
- **Pool Size**: 3
- **Pool Assets**: [DAI, USDC, USDT]

### WETH in tricrypto2
- **Asset**: WETH (`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`)
- **Asset Index**: 2
- **Pool Size**: 3
- **Pool Assets**: [USDT, WBTC, WETH]

## Risk Considerations

1. **Impermanent Loss**: LP position subject to impermanent loss from pool imbalance
2. **Smart Contract Risk**: Curve protocol and gauge smart contract vulnerabilities
3. **Reward Token Risk**: CRV and additional reward token price volatility
4. **Liquidity Risk**: Potential withdrawal limitations during high demand
5. **Pool Risk**: Individual Curve pool risks (asset concentration, peg stability)
6. **Gauge Risk**: Gauge contract risks and potential reward changes

## Testing

### Unit Tests (`test/unit/strategies/CurveStrategy.test.js`)
- Constructor validation (pool size, asset index)
- Management function access control
- Deposit limit calculations (unlimited)
- Reward management configuration
- Error handling for invalid parameters

### Integration Tests (`test/integration/CurveStrategyIntegration.test.js`)
- End-to-end strategy lifecycle
- Pool size validation
- Mock Curve protocol interactions
- LP token staking and unstaking
- Reward claiming and selling

## Security Features

1. **Input Validation**: Validates pool size (2-4) and asset index during deployment
2. **Access Control**: All management functions restricted to strategy management
3. **Parameter Validation**: Input validation for fees and amounts
4. **Safe Math**: Uses OpenZeppelin's SafeERC20 for token operations
5. **Emergency Functions**: Includes emergency withdrawal capabilities
6. **Asset Verification**: Validates asset matches pool configuration

## Gas Optimization

1. **Permit2 Integration**: Reduces gas costs for token approvals
2. **Batch Reward Claiming**: Claims all rewards in single transaction
3. **Efficient Pool Interactions**: Optimized array creation for different pool sizes
4. **Single-Sided Liquidity**: No need to manage multiple assets
5. **Immutable Storage**: Uses immutable variables for gas efficiency

## Monitoring and Maintenance

### Key Metrics to Monitor
- **Total Assets**: `strategy.totalAssets()`
- **LP Token Balance**: Staked LP tokens in gauge
- **CRV Rewards**: Claimable CRV from gauge
- **Additional Rewards**: Other gauge incentives
- **Pool Imbalance**: Curve pool balance ratios

### Maintenance Tasks
- Monitor Curve governance changes affecting gauges
- Update reward token configurations as new incentives are added
- Adjust swap fees based on market conditions
- Monitor pool health and potential migrations
- Track gauge voting and CRV emissions changes

## Advanced Configuration

### Multi-Reward Token Support
The strategy automatically handles up to 8 additional reward tokens beyond CRV:

```solidity
for (uint256 i = 0; i < 8; i++) {
    try CURVE_GAUGE.reward_tokens(i) returns (address rewardToken) {
        if (rewardToken == address(0) || rewardToken == address(asset)) break;
        // Sell reward token if balance exceeds minimum
    } catch {
        break;
    }
}
```

### Emergency Procedures
In case of issues with the Curve pool or gauge:
1. Use `setClaimRewards(false)` to disable reward claiming
2. Use emergency withdrawal functions to recover LP tokens
3. Manually unstake and withdraw liquidity if needed

## Integration Notes

- Compatible with all Curve pools supporting 2-4 assets
- Requires proper configuration of asset index and pool size
- Needs gauge address for the specific pool
- Must configure swap routes for all expected reward tokens
- Should monitor pool composition changes that might affect asset index 