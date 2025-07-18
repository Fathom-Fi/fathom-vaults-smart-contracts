# InvestorStrategy Documentation

## Overview

The **InvestorStrategy** is a reward distribution strategy that acts as a bridge between vaults and an external reward distribution system. This strategy enables vault participants to receive time-based reward distributions from external sources, making it ideal for incentive programs, liquidity mining, and structured reward campaigns.

## Architecture

### Reward Distribution System

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Reward Provider │────│ Investor Contract│────│ InvestorStrategy│
│                 │    │                  │    │                 │
│ - Setup rewards │    │ - Time-based     │    │ - Vault         │
│ - Fund periods  │    │   distribution   │    │   integration   │
│ - Monitor usage │    │ - Rate control   │    │ - User shares   │
└─────────────────┘    │ - Emergency stop │    │ - Reward claims │
         │              └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────── Reward Flow ─────────────────────────┘
```

### Core Components

1. **Investor Contract**: Manages reward distribution schedules and rates
2. **InvestorStrategy**: Connects vaults to reward distribution system
3. **Time-Based Distribution**: Linear reward distribution over time periods
4. **Emergency Controls**: Safeguards for exceptional situations
5. **Multi-Asset Support**: Flexible reward token configuration

## Technical Implementation

### Contract Structure

```solidity
contract InvestorStrategy is IInvestorStrategy, BaseStrategy {
    IInvestor public immutable investor;  // Reward distribution contract
    
    // Inherited from BaseStrategy:
    // - asset: Strategy's underlying asset
    // - TokenizedStrategy: Core vault logic
}

contract Investor is AccessControl, ReentrancyGuard, IInvestor {
    ERC20 public strategyAsset;          // Reward token
    IStrategy public strategy;           // Connected strategy
    
    uint256 public distributionStart;    // Distribution start timestamp
    uint256 public distributionEnd;      // Distribution end timestamp  
    uint256 public lastReport;           // Last reward claim timestamp
    uint256 internal rewardInSecond;     // Rewards per second rate
}
```

### Key Relationships

- **Strategy ↔ Investor**: 1:1 relationship for reward distribution
- **Investor ↔ Asset**: Configurable reward token (can differ from strategy asset)
- **Vault ↔ Strategy**: Standard vault-strategy relationship with added rewards

## Reward Distribution Mechanism

### 1. Distribution Setup

**`setupDistribution(uint256 approxAmount, uint256 periodStart, uint256 periodEnd)`**

```solidity
// Calculate reward rate
uint256 accrualInSecond = approxAmount / (periodEnd - periodStart);
rewardInSecond = accrualInSecond;

// Transfer exact reward amount
uint256 realDistributionAmount = accrualInSecond * (periodEnd - periodStart);
```

**Key Features:**
- Calculates precise per-second reward rate
- Transfers exact required amount (prevents rounding issues)
- Validates time periods and amounts
- Handles partial funding scenarios

### 2. Reward Processing

**`processReport()`** - Called by InvestorStrategy during harvests:

```solidity
function processReport() external returns (uint256) {
    // Calculate time elapsed since last report
    uint256 timeElapsed = block.timestamp - lastReport;
    
    // Calculate accrued rewards
    uint256 accruedRewards = timeElapsed * rewardInSecond;
    
    // Transfer rewards to strategy
    strategyAsset.safeTransfer(msg.sender, accruedRewards);
    
    // Update last report timestamp
    lastReport = block.timestamp;
    
    return accruedRewards;
}
```

### 3. Strategy Integration

**InvestorStrategy Functions:**

```solidity
function _harvestAndReport() internal override returns (uint256 _totalAssets) {
    // Claim rewards from Investor contract
    investor.processReport();
    
    // Return total strategy assets (including new rewards)
    _totalAssets = asset.balanceOf(address(this));
}

// No active fund deployment - rewards are external
function _deployFunds(uint256 _amount) internal pure override {}
function _freeFunds(uint256 _amount) internal pure override {}
```

## Deployment Configuration

### Constructor Parameters

**InvestorStrategy:**
```solidity
constructor(
    address _investor,                    // Investor contract address
    address _asset,                       // Strategy asset (reward token)
    string memory _name,                  // Strategy name
    address _tokenizedStrategyAddress     // Core strategy logic
)
```

**Investor:**
```solidity
constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);  // Admin controls
}
```

### Example Deployment

```javascript
// Deploy Investor contract
const investor = await Investor.deploy();

// Deploy InvestorStrategy
const investorStrategy = await InvestorStrategy.deploy(
    investor.address,                     // Investor contract
    rewardTokenAddress,                   // Reward token (e.g., governance token)
    "Governance Reward Strategy",         // Strategy name
    tokenizedStrategyAddress
);

// Connect strategy to investor
await investor.setStrategy(investorStrategy.address);

// Setup 3-month reward distribution
const currentTime = Math.floor(Date.now() / 1000);
await investor.setupDistribution(
    ethers.utils.parseEther("100000"),    // 100k reward tokens
    currentTime + 86400,                  // Start in 1 day
    currentTime + (90 * 86400)           // End in 90 days
);
```

## Reward Distribution Lifecycle

### Phase 1: Setup and Funding

**Admin Actions:**
1. Deploy Investor and InvestorStrategy contracts
2. Connect strategy to investor via `setStrategy()`
3. Configure distribution parameters via `setupDistribution()`
4. Fund the distribution period

**Validation Checks:**
- Period start must be in the future
- Period end must be after start
- Distribution amount must be > 0
- Period cannot exceed maximum duration (365 days)

### Phase 2: Active Distribution

**Automated Process:**
1. Users deposit into vault (standard process)
2. Strategy harvests rewards through `processReport()`
3. Rewards are distributed proportionally to vault shares
4. Users earn rewards based on their share of vault

**Reward Calculation:**
```
User Rewards = (User Shares / Total Shares) × Distributed Rewards
```

### Phase 3: Distribution End

**Options at End:**
1. **Setup New Period**: Start new distribution with different parameters
2. **Emergency Withdrawal**: Recover undistributed rewards
3. **Strategy Migration**: Move to different reward system

## Use Cases

### 1. Liquidity Mining Programs

**Purpose**: Incentivize deposits in specific vaults
**Reward Source**: Protocol governance tokens
**Duration**: 1-6 months
**Target**: Bootstrap vault liquidity

```javascript
// Example: USDC vault liquidity mining
const liquidityMining = {
    asset: usdcAddress,
    rewardToken: govTokenAddress,
    duration: 90 * 24 * 60 * 60,      // 90 days
    totalRewards: parseEther("50000"), // 50k governance tokens
    purpose: "Bootstrap USDC vault liquidity"
};
```

### 2. Partnership Incentives

**Purpose**: Cross-protocol incentive programs
**Reward Source**: Partner protocol tokens
**Duration**: Variable
**Target**: Strategic partnerships

### 3. Performance Bonuses

**Purpose**: Reward high-performing vault strategies
**Reward Source**: Protocol fees
**Duration**: Monthly/Quarterly
**Target**: Strategy performance incentives

### 4. Migration Incentives

**Purpose**: Encourage migration to new vault versions
**Reward Source**: Reserved tokens
**Duration**: Short-term (2-4 weeks)
**Target**: Smooth protocol upgrades

## Configuration Management

### Admin Functions

**`setStrategy(address _strategy)`**
- Links Investor to specific strategy
- Validates asset compatibility
- Only admin can call
- Emits `StrategyUpdate` event

**`setupDistribution(uint256 approxAmount, uint256 periodStart, uint256 periodEnd)`**
- Configures new reward distribution period
- Calculates precise reward rates
- Handles fund transfers
- Validates all parameters

### Emergency Functions

**`emergencyWithdraw()`**
- Recovers undistributed rewards
- Only callable by admin
- Used for emergency situations
- Returns remaining reward balance

## Risk Management

### Financial Controls

1. **Distribution Limits**: Maximum 365-day distribution periods
2. **Rate Calculation**: Precise per-second rates prevent gaming
3. **Fund Verification**: Exact funding amounts prevent shortfalls
4. **Access Controls**: Role-based administrative functions

### Operational Controls

1. **Strategy Validation**: Ensures compatible asset types
2. **Time Validation**: Prevents invalid distribution periods
3. **Emergency Stops**: Admin can halt distributions
4. **Audit Trail**: Comprehensive event logging

### Integration Safeguards

1. **Asset Compatibility**: Validates reward token matches strategy
2. **Single Strategy**: Prevents multiple strategy connections
3. **Reentrancy Protection**: Inherited from ReentrancyGuard
4. **Access Isolation**: Strategy-only reward claims

## Events and Monitoring

### Key Events

```solidity
// Investor Contract Events
event DistributionSetup(uint256 amount, uint256 periodStart, uint256 periodEnd);
event Report(uint256 timestamp, uint256 accruedRewards);
event EmergencyWithdraw(uint256 timestamp, uint256 leftRewards);
event StrategyUpdate(address oldStrategy, address newStrategy, address newStrategyAsset);
```

### Monitoring Metrics

1. **Distribution Progress**: Percentage of rewards distributed
2. **Claim Frequency**: How often rewards are harvested
3. **Participation Rate**: Vault user engagement
4. **Reward Efficiency**: Cost per unit of liquidity attracted

## Integration Examples

### With Vault Factory

```javascript
// Deploy vault with investor strategy
const vault = await factory.deployVault(
    "Incentivized USDC Vault",
    "iUSDC",
    investorStrategyAddress,
    accountantAddress
);

// Setup liquidity mining program
await investor.setupDistribution(
    parseEther("100000"),         // 100k governance tokens
    startTimestamp,
    endTimestamp
);
```

### Multi-Vault Incentives

```javascript
// Deploy multiple strategies with same investor
const strategies = [];
for (let i = 0; i < vaultCount; i++) {
    const strategy = await InvestorStrategy.deploy(
        investorAddress,
        rewardTokenAddress,
        `Incentive Strategy ${i}`,
        tokenizedStrategyAddress
    );
    strategies.push(strategy);
}

// Distribute rewards across multiple strategies
const totalRewards = parseEther("1000000");
const rewardPerStrategy = totalRewards.div(strategies.length);

for (const strategy of strategies) {
    await setupDistributionForStrategy(strategy, rewardPerStrategy);
}
```

## Error Handling

### Common Errors

- `ZeroAddress()`: Invalid address provided
- `DistributionEnded()`: Attempting operations after distribution ends
- `DistributionNotEnded()`: Trying to setup new distribution while active
- `PeriodStartInPast()`: Start time must be in future
- `DistributionPeriodTooLong()`: Exceeds maximum period length
- `WrongAsset()`: Reward token doesn't match strategy asset

### Troubleshooting

1. **Setup Issues**: Verify timestamps and funding amounts
2. **Claim Problems**: Check if distribution period is active
3. **Fund Issues**: Ensure sufficient reward token balance
4. **Strategy Issues**: Verify strategy is properly connected

## Best Practices

### For Administrators

1. **Period Planning**: Align distribution periods with strategic goals
2. **Rate Setting**: Calculate sustainable reward rates
3. **Fund Management**: Ensure adequate reward token reserves
4. **Monitoring**: Track distribution progress and user engagement

### For Strategy Integrators

1. **Harvest Frequency**: Regular harvests ensure timely reward distribution
2. **Asset Alignment**: Match reward tokens with vault strategies
3. **User Communication**: Clearly explain reward mechanics
4. **Performance Tracking**: Monitor incentive effectiveness

### For Users

1. **Timing**: Understand distribution periods and rates
2. **Compound Effects**: Regular harvesting maximizes rewards
3. **Strategy Selection**: Choose strategies with attractive reward programs
4. **Risk Assessment**: Consider both base yield and reward risks

## Security Considerations

### Smart Contract Security

- **Access Controls**: Role-based administrative functions
- **Reentrancy Protection**: Inherited safety mechanisms
- **Input Validation**: Comprehensive parameter checking
- **Time Lock**: Distribution periods provide predictability

### Operational Security

- **Admin Key Security**: Protect administrative private keys
- **Fund Security**: Secure reward token reserves
- **Emergency Procedures**: Clear escalation procedures
- **Monitoring Systems**: Real-time distribution tracking

## Conclusion

The InvestorStrategy provides a flexible and secure framework for implementing reward distribution programs within the Fathom Vault ecosystem. Its time-based distribution mechanism, comprehensive controls, and seamless vault integration make it ideal for various incentive programs while maintaining security and operational efficiency.

The strategy's design prioritizes precision, transparency, and user experience, making it an excellent choice for vault operators seeking to implement sophisticated reward programs that drive user engagement and protocol growth. 