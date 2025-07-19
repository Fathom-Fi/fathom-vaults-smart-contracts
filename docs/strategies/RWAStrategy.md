# RWAStrategy Documentation

## Overview

The **RWAStrategy** (Real World Assets Strategy) is a specialized investment strategy designed to facilitate investment in real-world assets through a managed approach. This strategy acts as a bridge between the Fathom Vault ecosystem and external asset managers who deploy capital into real-world investments such as real estate, commodities, private equity, or other tangible assets.

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vault Users   │────│   RWAStrategy    │────│  Asset Manager  │
│                 │    │                  │    │                 │
│ - Deposit funds │    │ - Fund management│    │ - RWA investment│
│ - Earn yield    │    │ - Risk control   │    │ - Performance   │
│ - Withdraw      │    │ - Reporting      │    │ - Reporting     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Features

1. **Managed Investment Model**: Funds are deployed to a trusted external manager who invests in real-world assets
2. **Deposit Limits**: Configurable maximum deposit amounts to control exposure
3. **Minimum Deploy Amount**: Threshold for efficient capital deployment
4. **Gain/Loss Reporting**: Real-time performance tracking and reporting
5. **Emergency Controls**: Withdrawal mechanisms for risk management

## Technical Implementation

### Contract Structure

```solidity
contract RWAStrategy is BaseStrategy, IRWAStrategy {
    // Core state variables
    uint256 public minDeployAmount;      // Minimum amount to deploy to manager
    uint256 public depositLimit;         // Maximum total deposits allowed
    uint256 public totalInvested;        // Total amount deployed to manager
    address public immutable managerAddress; // External asset manager
}
```

### Key Functions

#### Investment Management

**`_deployFunds(uint256 amount)`**
- Deploys idle capital to the asset manager when thresholds are met
- Only deploys if `amount >= minDeployAmount`
- Respects `depositLimit` constraints
- Updates `totalInvested` tracking

**`_freeFunds(uint256 amount)`**
- Withdraws capital from the asset manager
- Requires manager to have sufficient balance
- Updates `totalInvested` tracking
- Used for user withdrawals

#### Performance Reporting

**`reportGain(uint256 amount)`**
- Called by asset manager to report positive returns
- Transfers additional funds to strategy
- Emits `GainReported` event

**`reportLoss(uint256 amount)`**
- Called by asset manager to report losses
- Reduces `totalInvested` by loss amount
- Emits `LossReported` event

#### Configuration Management

**`setDepositLimit(uint256 newValue)`**
- Updates maximum deposit limit
- Must be greater than current total assets
- Only callable by strategy management

**`setMinDeployAmount(uint256 newValue)`**
- Updates minimum deployment threshold
- Cannot exceed asset total supply
- Only callable by strategy management

## Deployment Configuration

### Constructor Parameters

```solidity
constructor(
    address asset,              // Underlying asset (e.g., USDC, DAI)
    string memory name,         // Strategy name
    address tokenizedStrategyAddress, // Core strategy logic
    address manager,            // Asset manager address
    uint256 minDeploy,         // Minimum deploy amount
    uint256 maxDeposit         // Maximum deposit limit
)
```

### Example Deployment

```javascript
// Deploy RWAStrategy for real estate investment
const rwaStrategy = await RWAStrategy.deploy(
    "0xA0b86a33E6441e83C29B14C9b6E8D3C4C8C8A0e3", // USDC address
    "Real Estate RWA Strategy",
    tokenizedStrategyAddress,
    "0x1234567890123456789012345678901234567890", // Asset manager
    ethers.utils.parseEther("10000"),  // Min deploy: 10k USDC
    ethers.utils.parseEther("1000000") // Max deposit: 1M USDC
);
```

## Risk Management

### Access Controls

- **Manager Role**: Only designated manager can report gains/losses
- **Management Role**: Only strategy management can update parameters
- **Emergency Admin**: Can trigger emergency withdrawals

### Financial Controls

1. **Deposit Limits**: Prevent over-concentration of capital
2. **Minimum Deploy**: Ensure efficient capital deployment
3. **Balance Validation**: Verify manager has sufficient funds for withdrawals
4. **Loss Tracking**: Accurate accounting of investment performance

### Emergency Mechanisms

**Emergency Withdrawal**
- Triggered during strategy shutdown
- Attempts to recover maximum available funds
- Handles partial recoveries gracefully

## Use Cases

### 1. Real Estate Investment
- **Asset Type**: Commercial/residential real estate
- **Manager**: Property management company
- **Yield Source**: Rental income + appreciation
- **Deployment**: Large minimum amounts for property purchases

### 2. Private Credit
- **Asset Type**: Private loans and credit facilities
- **Manager**: Credit fund manager
- **Yield Source**: Interest payments
- **Deployment**: Diversified across multiple borrowers

### 3. Commodity Trading
- **Asset Type**: Physical commodities
- **Manager**: Commodity trading house
- **Yield Source**: Trading profits + storage yields
- **Deployment**: Flexible amounts based on opportunities

### 4. Infrastructure Projects
- **Asset Type**: Infrastructure investments
- **Manager**: Infrastructure fund
- **Yield Source**: Long-term contracted cash flows
- **Deployment**: Large minimum amounts for project financing

## Events and Monitoring

### Key Events

```solidity
event GainReported(address indexed sender, uint256 gain);
event LossReported(address indexed sender, uint256 loss);
event DepositLimitSet(address indexed sender, uint256 depositLimit);
event MinDeployAmountSet(address indexed sender, uint256 minDeployAmount);
```

### Monitoring Metrics

1. **Total Assets Under Management**: `totalInvested + idle_balance`
2. **Deployment Efficiency**: Ratio of invested to idle funds
3. **Performance Tracking**: Cumulative gains vs losses
4. **Utilization Rate**: Percentage of deposit limit utilized

## Integration Examples

### With Vault Factory

```javascript
const strategyParams = {
    asset: usdcAddress,
    name: "Infrastructure RWA Strategy",
    manager: infrastructureManagerAddress,
    minDeploy: parseEther("50000"),  // 50k minimum
    maxDeposit: parseEther("5000000") // 5M maximum
};

const vault = await factory.deployVault(
    "Infrastructure Vault",
    "INFRA-V",
    strategyAddress,
    accountantAddress
);
```

### With Accountant

```javascript
// Configure performance fees for RWA strategy
await accountant.setPerformanceFee(strategyAddress, 1000); // 10%
await accountant.setManagementFee(strategyAddress, 200);   // 2%
```

## Best Practices

### For Asset Managers

1. **Regular Reporting**: Report gains/losses promptly and accurately
2. **Liquidity Management**: Maintain sufficient liquidity for withdrawals
3. **Documentation**: Provide detailed investment reports
4. **Risk Disclosure**: Clearly communicate investment risks

### For Strategy Operators

1. **Due Diligence**: Thoroughly vet asset managers
2. **Limit Setting**: Set appropriate deposit and deployment limits
3. **Monitoring**: Regularly review performance and compliance
4. **Emergency Planning**: Prepare for various liquidation scenarios

### For Vault Integrators

1. **Risk Assessment**: Understand RWA-specific risks
2. **Diversification**: Don't over-allocate to single RWA strategies
3. **Liquidity Planning**: Account for potential illiquidity
4. **Regulatory Compliance**: Ensure compliance with applicable regulations

## Error Handling

### Common Errors

- `NotRWAManager()`: Only asset manager can call reporting functions
- `ZeroManager()`: Manager address cannot be zero
- `InvalidDepositLimit()`: Deposit limit validation failed
- `InvalidMinDeployAmount()`: Minimum deploy amount too high
- `InsufficientFundsLocked()`: Attempting to withdraw more than invested
- `ManagerBalanceTooLow()`: Manager lacks funds for withdrawal

### Troubleshooting

1. **Failed Deployments**: Check minimum deploy amount and limits
2. **Withdrawal Issues**: Verify manager has sufficient balance
3. **Reporting Errors**: Ensure only manager is calling report functions
4. **Configuration Problems**: Validate all parameters are within bounds

## Security Considerations

### Smart Contract Security

- **Reentrancy Protection**: Inherited from BaseStrategy
- **Access Control**: Role-based permissions
- **Input Validation**: Comprehensive parameter checking
- **Emergency Shutdowns**: Graceful degradation mechanisms

### Operational Security

- **Manager Selection**: Choose reputable, audited managers
- **Multi-signature**: Use multi-sig for management functions
- **Monitoring**: Implement real-time monitoring systems
- **Insurance**: Consider insurance for large deployments

## Conclusion

The RWAStrategy provides a robust framework for integrating real-world assets into the Fathom Vault ecosystem. Its managed investment model, comprehensive risk controls, and flexible configuration options make it suitable for various types of real-world asset investments while maintaining the security and transparency expected in DeFi protocols.

The strategy's design prioritizes capital efficiency, risk management, and operational flexibility, making it an excellent choice for vault operators seeking to diversify into real-world assets while maintaining strong governance and risk controls. 