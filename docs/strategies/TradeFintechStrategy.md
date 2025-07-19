# TradeFintechStrategy Documentation

## Overview

The **TradeFintechStrategy** is a specialized time-bounded investment strategy designed for trade finance and short-term investment opportunities. This strategy implements a structured investment cycle with distinct deposit, lock, and withdrawal periods, making it ideal for trade finance deals, working capital financing, and other time-sensitive investment opportunities.

## Architecture

### Time-Based Investment Cycle

```
Timeline: ─────────────────────────────────────────────────────────────►

Phase 1:     Phase 2:              Phase 3:
┌─────────┐  ┌──────────────────┐  ┌─────────────┐
│ DEPOSIT │  │      LOCKED      │  │ WITHDRAWAL  │
│ PERIOD  │  │     PERIOD       │  │   PERIOD    │
│         │  │                  │  │             │
│ Users   │  │ Funds deployed   │  │ Users can   │
│ can     │  │ to manager for   │  │ withdraw    │
│ deposit │  │ trade finance    │  │ returns     │
└─────────┘  └──────────────────┘  └─────────────┘
    │               │                    │
depositPeriodEnds   │               lockPeriodEnds
                    │
             Investment Active
```

### Core Components

1. **Time-Bound Deposits**: Accept deposits only during specified period
2. **Fund Locking**: Deploy capital to manager during lock period
3. **Performance Tracking**: Monitor gains/losses from trade finance deals
4. **Controlled Withdrawals**: Allow withdrawals only after lock period ends
5. **Emergency Mechanisms**: Handle exceptional situations

## Technical Implementation

### Contract Structure

```solidity
contract TradeFintechStrategy is BaseStrategy, ITradeFintechStrategy {
    uint256 public totalInvested;           // Total funds deployed to manager
    uint256 public depositLimit;            // Maximum total deposits allowed
    uint256 public immutable depositPeriodEnds;  // Timestamp when deposits close
    uint256 public immutable lockPeriodEnds;     // Timestamp when withdrawals open
    address public immutable vault;         // Associated vault address
}
```

### Key Functions

#### Time-Controlled Operations

**`lockFunds(uint256 amount)`**
- Deploys funds to strategy manager for investment
- Only callable during lock period
- Transfers funds to strategy management address
- Emits `FundsLocked` event

**`repay(uint256 amount)`**
- Processes return of invested funds with gains/losses
- Automatically calculates and reports performance
- Resets `totalInvested` to zero (one-time repayment)
- Emits `FundsReturned`, `GainReported`, or `LossReported` events

#### Deposit and Withdrawal Controls

**`availableDepositLimit(address owner)`**
- Returns 0 if deposit period has ended (except for vault)
- Returns remaining capacity based on `depositLimit`
- Allows vault to deposit even after deposit period ends

**`availableWithdrawLimit(address)`**
- During deposit period: Full amount (including deployed funds)
- During lock period: Zero (no withdrawals allowed)
- After lock period: Only from repaid funds

#### Configuration Management

**`setDepositLimit(uint256 limit)`**
- Updates maximum deposit limit
- Must be greater than current total invested
- Only callable by strategy management

## Deployment Configuration

### Constructor Parameters

```solidity
constructor(
    address asset,                    // Underlying asset (e.g., USDC)
    string memory name,               // Strategy name
    address tokenizedStrategyAddress, // Core strategy logic
    uint256 depositEndTS,            // Deposit period end timestamp
    uint256 lockedEndTS,             // Lock period end timestamp
    uint256 maxDeposit,              // Maximum deposit limit
    address vaultAddr                // Associated vault address
)
```

### Example Deployment

```javascript
// Deploy 6-month trade finance strategy
const currentTime = Math.floor(Date.now() / 1000);
const depositPeriod = 30 * 24 * 60 * 60;  // 30 days
const lockPeriod = 180 * 24 * 60 * 60;    // 180 days

const tradeFintechStrategy = await TradeFintechStrategy.deploy(
    usdcAddress,                           // USDC as underlying asset
    "Trade Finance Strategy Q1 2024",     // Strategy name
    tokenizedStrategyAddress,
    currentTime + depositPeriod,          // Deposits close in 30 days
    currentTime + lockPeriod,             // Unlock in 180 days
    ethers.utils.parseEther("5000000"),   // 5M USDC limit
    vaultAddress                          // Associated vault
);
```

## Investment Lifecycle

### Phase 1: Deposit Period (30 days typical)

**User Actions:**
- Deposit funds into vault
- Strategy accumulates capital

**Manager Actions:**
- Monitor deposit progress
- Prepare for fund deployment

**Strategy Behavior:**
- Accept deposits up to `depositLimit`
- Keep funds idle until lock period
- Allow withdrawals (early exit option)

### Phase 2: Lock Period (3-12 months typical)

**Manager Actions:**
- Call `lockFunds()` to deploy capital
- Execute trade finance deals
- Monitor investment performance

**Strategy Behavior:**
- Deploy funds to manager on request
- Prohibit all user withdrawals
- Track `totalInvested` amount

**User Actions:**
- No deposits or withdrawals allowed
- Monitor investment progress

### Phase 3: Withdrawal Period (Open-ended)

**Manager Actions:**
- Complete trade finance deals
- Call `repay()` with final amount
- Report gains or losses

**Strategy Behavior:**
- Process final settlement
- Allow user withdrawals from repaid funds
- Calculate and distribute returns

**User Actions:**
- Withdraw principal + returns
- Strategy shares reflect performance

## Use Cases

### 1. Trade Finance Deals

**Investment Type**: Import/export financing
**Typical Duration**: 3-6 months
**Yield Source**: Trade finance spreads (6-12% annually)
**Risk Profile**: Moderate (secured by goods/letters of credit)

```javascript
// Example: Coffee import financing
const coffeeTradeStrategy = {
    depositPeriod: 30,     // 30 days to raise capital
    lockPeriod: 120,       // 4 months trade cycle
    targetReturn: 8,       // 8% annualized return
    collateral: "Coffee shipment + LC"
};
```

### 2. Working Capital Financing

**Investment Type**: Short-term business loans
**Typical Duration**: 1-3 months
**Yield Source**: Interest payments (8-15% annually)
**Risk Profile**: Moderate to high (business credit risk)

### 3. Invoice Factoring

**Investment Type**: Purchase of receivables at discount
**Typical Duration**: 30-90 days
**Yield Source**: Discount to face value (10-20% annually)
**Risk Profile**: Low to moderate (diversified receivables)

### 4. Supply Chain Financing

**Investment Type**: Supplier payment financing
**Typical Duration**: 30-180 days
**Yield Source**: Early payment discounts
**Risk Profile**: Low (large corporate buyers)

## Performance Reporting

### Gain Calculation

```solidity
if (amount > totalInvested) {
    uint256 gain = amount - totalInvested;
    emit GainReported(msg.sender, gain);
}
```

### Loss Calculation

```solidity
if (amount < totalInvested) {
    uint256 loss = totalInvested - amount;
    emit LossReported(msg.sender, loss);
}
```

### Example Scenarios

**Scenario 1: Successful Trade**
- Deployed: 1,000,000 USDC
- Returned: 1,080,000 USDC
- Result: 80,000 USDC gain (8% return)

**Scenario 2: Partial Loss**
- Deployed: 1,000,000 USDC
- Returned: 950,000 USDC
- Result: 50,000 USDC loss (5% loss)

## Risk Management

### Time-Based Controls

1. **Deposit Window**: Limited time to prevent late entries
2. **Lock Period**: Prevents panic withdrawals during investment
3. **One-Time Settlement**: Single repayment prevents manipulation

### Financial Controls

1. **Deposit Limits**: Cap maximum exposure per strategy
2. **Manager Verification**: Only authorized manager can deploy/repay
3. **Emergency Withdrawals**: Available during shutdown

### Operational Controls

1. **Vault Integration**: Special permissions for associated vault
2. **Management Oversight**: Strategy management controls key functions
3. **Event Logging**: Comprehensive audit trail

## Events and Monitoring

### Key Events

```solidity
event FundsLocked(address indexed sender, uint256 amount);
event FundsReturned(address indexed sender, uint256 amount);
event GainReported(address indexed sender, uint256 gain);
event LossReported(address indexed sender, uint256 loss);
event DepositLimitSet(address indexed sender, uint256 depositLimit);
```

### Monitoring Metrics

1. **Fundraising Progress**: Deposits vs target
2. **Capital Deployment**: Percentage of funds locked
3. **Performance Tracking**: Returns vs projections
4. **Withdrawal Readiness**: Funds available for withdrawal

## Integration Examples

### With Vault Factory

```javascript
// Deploy integrated trade finance vault
const deployResult = await factory.deployVault(
    "Trade Finance Vault Q2",
    "TFV-Q2",
    strategyAddress,
    accountantAddress,
    {
        depositLimit: parseEther("5000000"),
        performanceFee: 1500,  // 15%
        managementFee: 200     // 2%
    }
);
```

### Manager Integration

```javascript
// Manager deploys funds for trade deal
await strategy.connect(manager).lockFunds(parseEther("1000000"));

// After deal completion, manager returns funds
await strategy.connect(manager).repay(parseEther("1080000")); // 8% return
```

## Error Handling

### Common Errors

- `InvalidPeriods()`: Constructor timestamp validation failed
- `FundsAlreadyReturned()`: Attempting to repay multiple times
- `LockPeriodEnded()`: Trying to lock funds after deadline
- `DepositPeriodEnded()`: Attempting to withdraw during lock period
- `InsufficientFundsIdle()`: Not enough idle funds to deploy
- `InsufficientFundsLocked()`: Withdrawal exceeds locked amount

### Troubleshooting

1. **Deployment Issues**: Verify timestamps are in correct order
2. **Lock Period Problems**: Ensure current time is within lock period
3. **Withdrawal Issues**: Check if lock period has ended
4. **Repayment Errors**: Verify only one repayment per cycle

## Best Practices

### For Strategy Managers

1. **Timeline Management**: Set realistic deposit and lock periods
2. **Due Diligence**: Thoroughly evaluate trade finance opportunities
3. **Risk Diversification**: Spread investments across multiple deals
4. **Communication**: Keep investors informed of progress

### For Vault Operators

1. **Period Planning**: Align deposit periods with fundraising goals
2. **Risk Assessment**: Evaluate manager track record
3. **Fee Structure**: Set appropriate performance fees
4. **Documentation**: Provide clear investment terms

### For Investors

1. **Timeline Awareness**: Understand lock-up periods
2. **Risk Understanding**: Assess trade finance risks
3. **Diversification**: Don't over-allocate to single strategy
4. **Exit Planning**: Consider liquidity needs

## Security Considerations

### Smart Contract Security

- **Time Validation**: Prevents invalid period configurations
- **Single Settlement**: Prevents multiple repayment exploitation
- **Access Control**: Role-based function restrictions
- **Emergency Controls**: Shutdown mechanisms available

### Operational Security

- **Manager Verification**: Thorough vetting of trade finance managers
- **Deal Documentation**: Proper legal documentation for trades
- **Collateral Verification**: Confirm trade collateral exists
- **Performance Monitoring**: Regular performance reviews

## Conclusion

The TradeFintechStrategy provides a robust framework for time-bounded trade finance investments within the Fathom Vault ecosystem. Its structured investment cycle, comprehensive risk controls, and flexible configuration make it ideal for various trade finance opportunities while protecting investor interests through well-defined periods and controls.

The strategy's design prioritizes transparency, risk management, and operational efficiency, making it an excellent choice for vault operators seeking to offer structured trade finance investment products with predictable timelines and clear risk/return profiles. 