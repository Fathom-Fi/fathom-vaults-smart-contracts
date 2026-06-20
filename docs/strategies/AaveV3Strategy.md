# AaveV3Strategy

## Overview

The `AaveV3Strategy` is a standalone DeFi strategy that lends assets to the Aave V3 protocol to earn interest and rewards. This strategy inherits from both `BaseStrategy` and `UniversalSwapper`, providing core strategy functionality and flexible token swapping capabilities.

## Features

- **Aave V3 Integration**: Deposits assets into Aave V3 lending pools to earn interest
- **Automatic Reward Claiming**: Claims and sells Aave rewards (including AAVE tokens) back to the base asset
- **Supply Cap Management**: Respects Aave's supply caps to prevent overdepositing
- **Flexible Swapping**: Uses UniversalRouter with Permit2 for efficient reward token swaps
- **Management Controls**: Configurable reward claiming, swap fees, and minimum sell amounts

## Architecture

### Inheritance
```
AaveV3Strategy
├── BaseStrategy (core strategy functionality)
└── UniversalSwapper (token swapping capabilities)
```

### Key Components

1. **Aave V3 Integration**
   - `LENDING_POOL`: The Aave V3 Pool contract for deposits/withdrawals
   - `A_TOKEN`: The interest-bearing aToken received for deposits
   - `DECIMALS`: Token decimals for supply cap calculations

2. **Rewards Management**
   - `rewardsController`: Aave's rewards controller for claiming incentives
   - `claimRewards`: Boolean to enable/disable reward claiming
   - `minAmountToSellMapping`: Minimum amounts required to sell specific reward tokens

3. **Swapping Infrastructure**
   - `base`: Base token for multi-hop swaps (typically WETH)
   - `router`: UniversalRouter address for executing swaps
   - `permit2`: Permit2 contract for gas-efficient approvals

## Constructor Parameters

```solidity
constructor(
    address _asset,              // The underlying asset to lend (e.g., DAI, USDC)
    string memory _name,         // Strategy name
    address _tokenizedStrategyAddress,  // TokenizedStrategy implementation
    address _lendingPool,        // Aave V3 Pool address
    address _base,               // Base token for swapping (WETH)
    address _router,             // UniversalRouter address
    address _permit2             // Permit2 contract address
)
```

## Core Functions

### Asset Management

#### `_deployFunds(uint256 _amount)`
Supplies assets to the Aave V3 lending pool via `LENDING_POOL.supply()`.

#### `_freeFunds(uint256 _amount)`
Withdraws assets from Aave V3 using `LENDING_POOL.withdraw()`. Amount is capped by available aToken balance.

#### `_harvestAndReport() → uint256`
1. Claims and sells rewards if enabled
2. Redeploys any idle assets (if not shutdown)
3. Returns total assets under management (aTokens + idle assets)

### Reward Management

#### `_claimAndSellRewards()`
1. Claims all available rewards from the rewards controller
2. Iterates through reward tokens
3. Swaps reward tokens to base asset if balance exceeds minimum threshold
4. Skips swapping if reward token equals base asset

### Supply Cap Management

#### `getSupplyCap() → uint256`
Extracts the supply cap from Aave's reserve configuration using bitwise operations.

#### `availableDepositLimit(address) → uint256`
Returns remaining deposit capacity based on Aave's supply cap:
- Returns `type(uint256).max` if no supply cap is set
- Returns `0` if supply cap is reached
- Returns remaining capacity otherwise

## Management Functions

### Swap Configuration
- `setUniFees(address _token0, address _token1, uint24 _fee)`: Sets swap fees for token pairs
- `setMinAmountToSellMapping(address _token, uint256 _amount)`: Sets minimum sell amounts for reward tokens

### Reward Management
- `setClaimRewards(bool _bool)`: Enables/disables automatic reward claiming
- `setRewardsController(address _rewardsController)`: Updates the rewards controller address
- `sellRewardManually(address _token, uint256 _amount, uint256 _minAmountOut)`: Manually sells reward tokens

## Deployment Configuration

### Network Addresses

#### Mainnet
- **Aave V3 Pool**: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- **Base Token (WETH)**: `0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7`
- **Universal Router**: `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

#### Polygon
- **Aave V3 Pool**: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- **Base Token (WMATIC)**: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`
- **Universal Router**: `0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

#### Arbitrum
- **Aave V3 Pool**: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- **Base Token (WETH)**: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- **Universal Router**: `0x5E325eDA8064b456f4781070C0738d849c824258`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

#### Base
- **Aave V3 Pool**: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- **Base Token (WETH)**: `0x4200000000000000000000000000000000000006`
- **Universal Router**: `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Usage Example

```javascript
// Deploy the strategy
const strategy = await AaveV3Strategy.deploy(
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "Aave V3 DAI Lending Strategy",
    tokenizedStrategyAddress,
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave Pool
    "0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7", // WETH
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
    "0x000000000022D473030F116dDEE9F6B43aC78BA3"  // Permit2
);

// Configure swap fees for AAVE → WETH → DAI
await strategy.setUniFees(aaveToken, wethToken, 3000); // 0.3%
await strategy.setUniFees(wethToken, daiToken, 500);   // 0.05%

// Set minimum sell amount for AAVE rewards
await strategy.setMinAmountToSellMapping(aaveToken, ethers.parseEther("0.1"));
```

## Risk Considerations

1. **Smart Contract Risk**: Aave V3 protocol smart contract vulnerabilities
2. **Liquidity Risk**: Potential withdrawal limitations during high utilization
3. **Reward Token Risk**: Reward token price volatility and swap slippage
4. **Supply Cap Risk**: Deposits may be limited by Aave's supply caps
5. **Interest Rate Risk**: Variable lending rates may decrease yield

## Testing

The strategy includes comprehensive test coverage:

### Unit Tests (`test/unit/strategies/AaveV3Strategy.test.js`)
- Constructor validation
- Management function access control
- Deposit/withdrawal limit calculations
- Reward management configuration
- Error handling for invalid parameters

### Integration Tests (`test/integration/AaveV3StrategyIntegration.test.js`)
- End-to-end strategy lifecycle
- TokenizedStrategy integration
- Mock Aave protocol interactions
- Access control validation

## Security Features

1. **Access Control**: All management functions restricted to strategy management
2. **Parameter Validation**: Input validation for fees and amounts
3. **Safe Math**: Uses OpenZeppelin's SafeERC20 for token operations
4. **Emergency Functions**: Includes emergency withdrawal capabilities
5. **Slippage Protection**: Minimum amount out protection for swaps

## Gas Optimization

1. **Permit2 Integration**: Reduces gas costs for token approvals
2. **Batch Operations**: Claims all rewards in single transaction
3. **Efficient Storage**: Uses immutable variables where possible
4. **Minimal External Calls**: Optimized interaction patterns with Aave

## Monitoring and Maintenance

### Key Metrics to Monitor
- **Total Assets**: `strategy.totalAssets()`
- **Aave Supply Rate**: Current lending APY
- **Reward Accumulation**: Claimable rewards from Aave
- **Supply Cap Utilization**: Current supply vs. cap

### Maintenance Tasks
- Monitor Aave protocol updates and migrations
- Update reward token configurations as Aave adds new incentives
- Adjust swap fees based on market conditions
- Monitor and adjust minimum sell amounts for optimal gas efficiency 