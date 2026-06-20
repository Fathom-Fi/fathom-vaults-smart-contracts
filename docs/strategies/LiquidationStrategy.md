# LiquidationStrategy Documentation

## Overview

The **LiquidationStrategy** is a sophisticated strategy designed to participate in the Fathom Protocol's liquidation mechanism, generating profits by liquidating underwater positions and selling collateral through various DEXs. This strategy enables vault participants to earn yield by contributing to the stability of the Fathom stablecoin (FXD) ecosystem through liquidation activities.

## Architecture

### Liquidation Ecosystem

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Vault Users    │────│ LiquidationStrategy │────│ Fathom Protocol │
│                 │    │                    │    │                 │
│ - Provide       │    │ - Flash liquidation│    │ - Underwater    │
│   liquidity     │    │ - Collateral sale  │    │   positions     │
│ - Earn yield    │    │ - Profit capture   │    │ - BookKeeper    │
│ - Share profits │    │ - Risk management  │    │ - Liquidations  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────── Profit Distribution ──────────────────┘
```

### Core Components

1. **Flash Liquidation**: Execute liquidations using borrowed FXD
2. **Multi-DEX Integration**: Sell collateral via UniswapV2 and UniswapV3
3. **Profit Optimization**: Choose optimal selling paths for maximum returns
4. **Risk Management**: Sophisticated risk controls and loss mitigation
5. **BookKeeper Integration**: Interface with Fathom's core protocol

## Technical Implementation

### Contract Structure

```solidity
contract LiquidationStrategy is BaseStrategy, ReentrancyGuard, 
                               IFlashLendingCallee, ILiquidationStrategy {
    
    // Core protocol interfaces
    IStablecoinAdapter public stablecoinAdapter;
    IBookKeeper public bookKeeper;
    ERC20 public fathomStablecoin;  // FXD token
    
    // Strategy management
    address public strategyManager;
    address public fixedSpreadLiquidationStrategy;
    
    // Collateral tracking
    mapping(address => CollateralInfo) public idleCollateral;
    mapping(address => UniswapV3Info) public uniswapV3Info;
}
```

### Key Data Structures

```solidity
struct CollateralInfo {
    uint256 collateralAmount;           // Amount of collateral held
    uint256 amountNeededToPayDebt;      // FXD needed to cover debt
    uint256 averagePriceOfCollateral;   // Average acquisition price
}

struct UniswapV3Info {
    address permit2;    // Permit2 contract for V3
    uint24 poolFee;     // Pool fee tier
}
```

## Liquidation Process

### 1. Flash Liquidation Flow

```
1. Fixed Spread Strategy calls flashLendingCall()
2. Strategy receives flash-borrowed FXD
3. Liquidate underwater position in BookKeeper
4. Receive collateral from liquidation
5. Sell collateral on DEX for FXD
6. Repay flash loan + spread
7. Keep profit (if any)
```

### 2. Flash Lending Callback

**`flashLendingCall(bytes calldata data)`**
- Called by FixedSpreadLiquidationStrategy
- Executes liquidation with borrowed FXD
- Handles collateral receipt and debt repayment
- Implements comprehensive error handling

### 3. Collateral Management

**`sellCollateralV2()`**
- Sells collateral via UniswapV2-compatible DEXs
- Computes optimal trading paths
- Implements slippage protection
- Tracks profit/loss vs average cost

**`sellCollateralV3()`**
- Sells collateral via UniswapV3 UniversalRouter
- Uses Permit2 for advanced permissions
- Supports configurable pool fees
- Optimized for gas efficiency

## Key Functions

### Configuration Management

**`setStrategyManager(address _strategyManager)`**
- Updates strategy manager address
- Only current manager can call
- Controls access to operational functions

**`setFixedSpreadLiquidationStrategy(address _strategy)`**
- Sets the liquidation strategy caller
- Critical for flash lending security
- Only manager can update

**`setBookKeeper(address _bookKeeper)`**
- Updates BookKeeper contract reference
- Required for liquidation execution
- Manager-only function

**`setV3Info(address _permit2, address _router, uint24 _poolFee)`**
- Configures UniswapV3 integration
- Sets Permit2 and router addresses
- Configures pool fee tiers

### Collateral Operations

**`sellCollateralV2(address _collateral, IUniswapV2Router02 _router, uint256 _amount, uint256 _minAmountOut)`**
- Sells specified collateral amount
- Uses V2 router with slippage protection
- Calculates profit/loss vs average price
- Updates collateral tracking

**`sellCollateralV3(address _collateral, address _universalRouter, uint256 _amount)`**
- Sells collateral via V3 UniversalRouter
- More gas-efficient than V2
- Supports advanced routing
- Automatic slippage calculation

**`shutdownWithdrawCollateral(address _collateral, uint256 _amount)`**
- Emergency collateral withdrawal
- Manager-only function
- Used during strategy shutdown
- Updates tracking accordingly

## Profit Optimization

### Path Selection Algorithm

The strategy implements sophisticated path selection for optimal collateral sales:

```solidity
function _computeMostProfitablePath(
    IUniswapV2Router02 _router,
    address _collateral,
    uint256 _amount
) internal view returns (address[] memory path, uint256 amountOut) {
    // Try direct path: Collateral -> FXD
    // Try indirect path: Collateral -> USDT -> FXD
    // Return path with highest output
}
```

### Loss Prevention

**High Chance of Loss Detection**
- Compares expected DEX output with cost basis
- Reverts transactions likely to cause losses
- Configurable loss tolerance thresholds

**Profit/Loss Tracking**
```solidity
function _handleLogicForProfitOrLoss(
    uint256 fxdReceived,
    uint256 costOfCollateralInFXD
) internal {
    if (fxdReceived > costOfCollateralInFXD) {
        // Profit: Emit gain event
        emit LogProfitOrLoss(fxdReceived - costOfCollateralInFXD, true);
    } else {
        // Loss: Emit loss event
        emit LogProfitOrLoss(costOfCollateralInFXD - fxdReceived, false);
    }
}
```

## Risk Management

### Access Controls

1. **Strategy Manager**: Controls operational parameters
2. **Fixed Spread Strategy**: Only authorized caller for liquidations
3. **Emergency Admin**: Can trigger shutdowns
4. **Management**: Overall strategy governance

### Financial Controls

1. **Slippage Protection**: Minimum output requirements
2. **Loss Prevention**: Automatic loss detection
3. **Collateral Tracking**: Accurate cost basis calculation
4. **Emergency Withdrawals**: Shutdown mechanisms

### Operational Safeguards

1. **Flash Loan Validation**: Verify caller authenticity
2. **Parameter Validation**: Comprehensive input checking
3. **Reentrancy Protection**: Inherited from ReentrancyGuard
4. **Event Logging**: Complete audit trail

## Deployment Configuration

### Constructor Parameters

```solidity
constructor(
    address _asset,                        // FXD token address
    string memory _name,                   // Strategy name
    address _tokenizedStrategyAddress,     // Core strategy logic
    address _strategyManager,              // Strategy manager
    address _fixedSpreadLiquidationStrategy, // Liquidation caller
    address _bookKeeper,                   // Fathom BookKeeper
    address _stablecoinAdapter            // Stablecoin adapter
)
```

### Example Deployment

```javascript
const liquidationStrategy = await LiquidationStrategy.deploy(
    fxdTokenAddress,                    // FXD as strategy asset
    "Fathom Liquidation Strategy",      // Strategy name
    tokenizedStrategyAddress,
    strategyManagerAddress,             // Operations manager
    fixedSpreadLiquidationAddress,      // Liquidation strategy
    bookKeeperAddress,                  // Fathom BookKeeper
    stablecoinAdapterAddress           // FXD adapter
);

// Configure UniswapV3 integration
await liquidationStrategy.setV3Info(
    permit2Address,
    universalRouterAddress,
    3000  // 0.3% pool fee
);
```

## Integration with Fathom Protocol

### BookKeeper Integration

The strategy integrates with Fathom's core BookKeeper contract for:
- Position liquidation execution
- Collateral token handling
- Debt management
- System stability maintenance

### Liquidation Mechanics

1. **Position Identification**: Fixed spread strategy identifies underwater positions
2. **Flash Loan Initiation**: Borrow FXD for liquidation
3. **Liquidation Execution**: Use borrowed FXD to liquidate position
4. **Collateral Receipt**: Receive collateral from liquidated position
5. **Collateral Sale**: Sell collateral on DEX for FXD
6. **Loan Repayment**: Repay flash loan with spread
7. **Profit Distribution**: Distribute remaining profit to strategy

## Use Cases

### 1. Protocol Stability Provider

**Role**: Maintain FXD peg stability through liquidations
**Yield Source**: Liquidation spreads and collateral appreciation
**Risk Profile**: Medium (depends on collateral volatility)

### 2. Arbitrage Opportunities

**Role**: Capture price differences between liquidation and market prices
**Yield Source**: Price arbitrage profits
**Risk Profile**: Low to medium (timing dependent)

### 3. Market Making

**Role**: Provide liquidity for collateral tokens
**Yield Source**: Bid-ask spreads
**Risk Profile**: Medium (inventory risk)

## Events and Monitoring

### Key Events

```solidity
event LogFlashLiquidationSuccess(
    address indexed liquidatorAddress,
    uint256 indexed debtValueToRepay,
    uint256 indexed collateralAmountToLiquidate,
    uint256 fathomStablecoinReceivedV2,
    uint256 fathomStablecoinReceivedV3,
    uint256 V2RatioBPS
);

event LogSellCollateralV2(
    address[] _path,
    IUniswapV2Router02 _router,
    uint256 _collateralAmount,
    uint256 _minAmountOut,
    uint256 _dexAmountOut,
    uint256 _receivedAmount
);

event LogProfitOrLoss(uint256 _amount, bool _isProfit);
```

### Monitoring Metrics

1. **Liquidation Success Rate**: Percentage of successful liquidations
2. **Average Profit Per Liquidation**: Profit efficiency
3. **Collateral Inventory**: Amount and types of held collateral
4. **DEX Performance**: V2 vs V3 selling efficiency

## Error Handling

### Common Errors

- `NotStrategyManager()`: Unauthorized access attempt
- `NotFixedSpreadLiquidationStrategy()`: Invalid liquidation caller
- `DEXCannotGiveEnoughAmount()`: Insufficient DEX liquidity
- `NotEnoughToRepayDebt()`: Flash loan repayment shortfall
- `HighChanceOfLoss()`: Loss prevention triggered
- `V3InfoNotSet()`: UniswapV3 configuration missing

### Troubleshooting

1. **Liquidation Failures**: Check BookKeeper integration
2. **DEX Issues**: Verify router configurations and liquidity
3. **Access Problems**: Confirm role assignments
4. **Profit Issues**: Review collateral pricing and DEX efficiency

## Security Considerations

### Smart Contract Security

- **Flash Loan Protection**: Verify caller authenticity
- **Reentrancy Guards**: Prevent recursive calls
- **Input Validation**: Comprehensive parameter checking
- **Access Controls**: Role-based function restrictions

### Operational Security

- **Manager Security**: Use multi-signature for manager functions
- **Oracle Dependencies**: Monitor collateral price feeds
- **DEX Integration**: Monitor DEX contract upgrades
- **Emergency Procedures**: Prepare for various failure modes

## Best Practices

### For Strategy Operators

1. **Regular Monitoring**: Track liquidation opportunities
2. **DEX Optimization**: Maintain optimal router configurations
3. **Risk Assessment**: Monitor collateral volatility
4. **Performance Review**: Regular profit/loss analysis

### For Protocol Integrators

1. **Careful Integration**: Understand flash lending mechanics
2. **Risk Management**: Set appropriate exposure limits
3. **Monitoring Systems**: Implement comprehensive monitoring
4. **Emergency Planning**: Prepare for market stress scenarios

## Conclusion

The LiquidationStrategy provides a sophisticated mechanism for participating in the Fathom Protocol's liquidation ecosystem while generating yield for vault participants. Its multi-DEX integration, profit optimization algorithms, and comprehensive risk management make it a valuable component of the Fathom Vault ecosystem.

The strategy's design prioritizes both profitability and protocol stability, making it an excellent choice for vault operators seeking to provide liquidity for liquidations while earning competitive returns through arbitrage and liquidation spreads. 