# Accountant System Documentation

## Overview

The **Accountant** is the fee management component of the Fathom Vault ecosystem, responsible for calculating performance fees, managing fee recipients, and coordinating with the Factory's protocol fee system. It provides a standardized interface for fee assessment while maintaining flexibility for different fee structures and strategies.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Accountant System                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ GenericAccountant│  │   Fee Calculation│  │Fee Collection│  │
│  │                  │  │                  │  │              │  │
│  │ • Performance    │  │ • Gain/Loss      │  │ • Share Mgmt │  │
│  │   Fee Rate       │  │   Assessment     │  │ • Distribution│  │
│  │ • Fee Recipient  │  │ • Fee Validation │  │ • Claiming    │  │
│  │ • Admin Controls │  │ • Rate Application│ │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Vault Reports    │
                    │                     │
                    │ • Strategy Gains    │
                    │ • Strategy Losses   │
                    │ • Fee Calculations  │
                    │ • Protocol Fees     │
                    └─────────────────────┘
```

### Contract Structure

```solidity
contract GenericAccountant is AccessControl, IAccountant, IGenericAccountant {
    using SafeERC20 for ERC20;
    
    uint256 internal constant FEE_BPS = 10000;  // 100% in basis points
    
    uint256 internal _performanceFee;           // Performance fee percentage
    address internal _feeRecipient;             // Where fees are sent
    
    // Access control for admin operations
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
}
```

## Key Features

### 1. Performance Fee Management

The Accountant calculates and collects performance fees based on strategy gains, providing sustainable revenue for the ecosystem.

**Fee Calculation:**
```solidity
function report(address strategy, uint256 gain, uint256 loss) 
    external view override returns (uint256 totalFees, uint256 totalRefunds) {
    
    // Calculate performance fee on gains only
    totalFees = (gain * _performanceFee) / FEE_BPS;
    
    // GenericAccountant doesn't provide refunds for losses
    totalRefunds = 0;
    
    return (totalFees, totalRefunds);
}
```

**Key Characteristics:**
- Fees only charged on gains (no fees on losses)
- Configurable fee percentage (0-100%)
- No refunds for losses in basic implementation
- Extensible for more sophisticated fee structures

### 2. Fee Collection and Distribution

Fees are collected through share issuance and can be distributed to designated recipients.

**Fee Collection Process:**
```
Strategy Reports Gain → Accountant Calculates Fee → Vault Issues Fee Shares → 
Accountant Receives Shares → Shares Converted to Assets → Distribution
```

**Distribution Function:**
```solidity
function distribute(address token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    uint256 balance = ERC20(token).balanceOf(address(this));
    if (balance == 0) {
        revert ZeroAmount();
    }
    
    // Transfer all accumulated tokens to fee recipient
    _erc20SafeTransfer(token, _feeRecipient, balance);
}
```

### 3. Configuration Management

Administrators can update fee parameters to adapt to changing market conditions and governance decisions.

**Fee Configuration:**
```solidity
function setPerformanceFee(uint256 fee) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    if (fee > FEE_BPS) {
        revert FeeGreaterThan100();
    }
    _performanceFee = fee;
    emit PerformanceFeeSet(fee);
}

function setFeeRecipient(address recipient) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    if (recipient == address(0)) {
        revert ZeroAddress();
    }
    _feeRecipient = recipient;
    emit FeeRecipientSet(recipient);
}
```

## Fee Flow Architecture

### 1. Strategy-Level Fee Assessment

```
Strategy Performance → Vault Calls Accountant.report() → Fee Calculation → 
Return (fees, refunds) → Vault Issues Fee Shares
```

### 2. Protocol Fee Integration

The Accountant's fees are further subject to protocol fees managed by the Factory:

```
Accountant Fees → Factory Protocol Fee % → Protocol Fee Recipient + 
Remaining Accountant Fees → Accountant Fee Recipient
```

**Example Fee Flow:**
```
Strategy Gain: 1000 USDC
Accountant Fee (10%): 100 USDC  
Protocol Fee (20% of accountant fee): 20 USDC
Net to Accountant Recipient: 80 USDC
Net to Users: 900 USDC
```

### 3. Multi-Asset Fee Collection

The Accountant can collect fees in multiple assets and distribute them appropriately:

```javascript
// Distribute all accumulated assets
const assets = ['USDC', 'DAI', 'USDT'];
for (const asset of assets) {
    if (await accountant.balanceOf(assetAddress) > 0) {
        await accountant.distribute(assetAddress);
    }
}
```

## Implementation Examples

### 1. Basic Deployment

```javascript
// Deploy GenericAccountant
const accountant = await GenericAccountant.deploy(
    1000,                    // 10% performance fee
    feeRecipientAddress,     // Where fees go
    adminAddress            // Administrative control
);

// Configure vault to use accountant
await vault.setAccountant(accountant.address);
```

### 2. Custom Accountant Implementation

```solidity
contract CustomAccountant is AccessControl, IAccountant {
    uint256 public managementFee;      // Annual management fee
    uint256 public performanceFee;     // Performance fee on gains
    uint256 public hurdle;             // Minimum return before performance fees
    
    function report(address strategy, uint256 gain, uint256 loss) 
        external view override returns (uint256, uint256) {
        
        uint256 totalFees = 0;
        uint256 totalRefunds = 0;
        
        // Calculate management fee (time-based)
        uint256 timeFee = calculateManagementFee(strategy);
        totalFees += timeFee;
        
        // Calculate performance fee (only above hurdle)
        if (gain > hurdle) {
            uint256 excessGain = gain - hurdle;
            uint256 perfFee = (excessGain * performanceFee) / 10000;
            totalFees += perfFee;
        }
        
        // Provide loss refunds if configured
        if (loss > 0 && shouldProvideRefunds(strategy)) {
            totalRefunds = calculateLossRefund(strategy, loss);
        }
        
        return (totalFees, totalRefunds);
    }
}
```

### 3. Strategy-Specific Fee Structures

```solidity
contract StrategySpecificAccountant is AccessControl, IAccountant {
    // Different fee rates for different strategies
    mapping(address => uint256) public strategyFees;
    mapping(address => bool) public feeExemptions;
    
    function setStrategyFee(address strategy, uint256 fee) 
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        strategyFees[strategy] = fee;
    }
    
    function report(address strategy, uint256 gain, uint256 loss) 
        external view override returns (uint256, uint256) {
        
        if (feeExemptions[strategy]) {
            return (0, 0);  // No fees for exempted strategies
        }
        
        uint256 strategyFee = strategyFees[strategy];
        if (strategyFee == 0) {
            strategyFee = defaultPerformanceFee;  // Use default if not set
        }
        
        uint256 totalFees = (gain * strategyFee) / 10000;
        return (totalFees, 0);
    }
}
```

## Integration Patterns

### 1. Vault Integration

```javascript
class VaultAccountantManager {
    async setupAccountant(vaultAddress, accountantConfig) {
        // Deploy accountant
        const accountant = await this.deployAccountant(accountantConfig);
        
        // Set accountant in vault
        const vault = new ethers.Contract(vaultAddress, vaultABI, this.signer);
        await vault.setAccountant(accountant.address);
        
        // Verify integration
        const setAccountant = await vault.accountant();
        console.log(`Accountant set: ${setAccountant}`);
        
        return accountant;
    }
    
    async updateFees(accountantAddress, newPerformanceFee) {
        const accountant = new ethers.Contract(
            accountantAddress, 
            accountantABI, 
            this.signer
        );
        
        await accountant.setPerformanceFee(newPerformanceFee);
        
        console.log(`Performance fee updated to ${newPerformanceFee / 100}%`);
    }
}
```

### 2. Fee Monitoring

```javascript
class FeeMonitor {
    constructor(accountantAddress, provider) {
        this.accountant = new ethers.Contract(
            accountantAddress,
            accountantABI,
            provider
        );
    }
    
    async trackFeeCollection() {
        // Listen for fee-related events
        this.accountant.on('PerformanceFeeSet', (fee, event) => {
            console.log(`Performance fee updated: ${fee / 100}%`);
        });
        
        // Monitor accumulated fees
        setInterval(async () => {
            const usdcBalance = await this.getTokenBalance(USDC_ADDRESS);
            const daiBalance = await this.getTokenBalance(DAI_ADDRESS);
            
            console.log(`Accumulated fees: ${usdcBalance} USDC, ${daiBalance} DAI`);
        }, 60000); // Check every minute
    }
    
    async distributeFees() {
        const tokens = [USDC_ADDRESS, DAI_ADDRESS, USDT_ADDRESS];
        
        for (const token of tokens) {
            const balance = await this.getTokenBalance(token);
            if (balance > 0) {
                await this.accountant.distribute(token);
                console.log(`Distributed ${balance} of token ${token}`);
            }
        }
    }
}
```

### 3. Multi-Vault Fee Management

```javascript
class MultiVaultFeeManager {
    constructor(vaults, accountant) {
        this.vaults = vaults;
        this.accountant = accountant;
    }
    
    async collectAllFees() {
        const totalFees = {};
        
        for (const vault of this.vaults) {
            // Get vault's asset
            const asset = await vault.asset();
            const balance = await this.getVaultFeeBalance(vault.address, asset);
            
            if (!totalFees[asset]) totalFees[asset] = ethers.BigNumber.from(0);
            totalFees[asset] = totalFees[asset].add(balance);
        }
        
        // Distribute all accumulated fees
        for (const [asset, amount] of Object.entries(totalFees)) {
            if (amount.gt(0)) {
                await this.accountant.distribute(asset);
            }
        }
        
        return totalFees;
    }
}
```

## Advanced Fee Structures

### 1. High Water Mark Accountant

```solidity
contract HighWaterMarkAccountant is AccessControl, IAccountant {
    mapping(address => uint256) public highWaterMarks;
    uint256 public performanceFee;
    
    function report(address strategy, uint256 gain, uint256 loss) 
        external override returns (uint256, uint256) {
        
        uint256 currentValue = getCurrentStrategyValue(strategy);
        uint256 hwm = highWaterMarks[strategy];
        
        uint256 totalFees = 0;
        
        if (currentValue > hwm) {
            // Only charge fees on new highs
            uint256 excessReturn = currentValue - hwm;
            totalFees = (excessReturn * performanceFee) / 10000;
            
            // Update high water mark
            highWaterMarks[strategy] = currentValue;
        }
        
        return (totalFees, 0);
    }
}
```

### 2. Time-Weighted Fee Accountant

```solidity
contract TimeWeightedAccountant is AccessControl, IAccountant {
    struct FeeSchedule {
        uint256 baseFee;        // Base performance fee
        uint256 reducedFee;     // Reduced fee for long-term holders
        uint256 timeThreshold;  // Time before reduced fee applies
    }
    
    mapping(address => FeeSchedule) public strategyFeeSchedules;
    mapping(address => mapping(address => uint256)) public userDepositTimes;
    
    function report(address strategy, uint256 gain, uint256 loss) 
        external view override returns (uint256, uint256) {
        
        FeeSchedule memory schedule = strategyFeeSchedules[strategy];
        
        // Calculate weighted average fee based on deposit timing
        uint256 weightedFee = calculateWeightedFee(strategy, schedule);
        uint256 totalFees = (gain * weightedFee) / 10000;
        
        return (totalFees, 0);
    }
}
```

### 3. Performance Threshold Accountant

```solidity
contract PerformanceThresholdAccountant is AccessControl, IAccountant {
    uint256 public basePerformanceFee = 1000;    // 10%
    uint256 public bonusPerformanceFee = 2000;   // 20%
    uint256 public performanceThreshold = 1500;  // 15% annual return
    
    function report(address strategy, uint256 gain, uint256 loss) 
        external view override returns (uint256, uint256) {
        
        uint256 annualizedReturn = calculateAnnualizedReturn(strategy, gain);
        uint256 applicableFee;
        
        if (annualizedReturn > performanceThreshold) {
            // Higher fee for exceptional performance
            applicableFee = bonusPerformanceFee;
        } else {
            // Standard fee for normal performance
            applicableFee = basePerformanceFee;
        }
        
        uint256 totalFees = (gain * applicableFee) / 10000;
        return (totalFees, 0);
    }
}
```

## Error Handling and Validation

### Common Errors

```solidity
error ZeroAddress();                    // Invalid zero address
error FeeGreaterThan100();             // Fee exceeds 100%
error ZeroAmount();                    // Zero amount provided
error ERC20TransferFailed();           // Token transfer failed
```

### Input Validation

```solidity
function setPerformanceFee(uint256 fee) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    // Validate fee is not greater than 100%
    if (fee > FEE_BPS) {
        revert FeeGreaterThan100();
    }
    
    // Additional business logic validation
    if (fee > MAX_REASONABLE_FEE) {
        require(msg.sender == SUPER_ADMIN, "Fee too high for normal admin");
    }
    
    _performanceFee = fee;
    emit PerformanceFeeSet(fee);
}
```

### Safe Transfer Implementation

```solidity
function _erc20SafeTransfer(address token, address receiver, uint256 amount) internal {
    if (token == address(0) || receiver == address(0)) {
        revert ZeroAddress();
    }
    
    if (amount == 0) {
        revert ZeroAmount();
    }
    
    // Use SafeERC20 for secure transfers
    ERC20(token).safeTransfer(receiver, amount);
}
```

## Events and Monitoring

### Key Events

```solidity
event PerformanceFeeSet(uint256 fee);
event FeeRecipientSet(address feeRecipient);
event FeeDistributed(address indexed token, uint256 amount, address indexed recipient);
```

### Monitoring Dashboard

```javascript
class AccountantMonitor {
    async getAccountantMetrics(accountantAddress) {
        const accountant = new ethers.Contract(accountantAddress, accountantABI, this.provider);
        
        return {
            performanceFee: await accountant.performanceFee(),
            feeRecipient: await accountant.feeRecipient(),
            accumulatedFees: await this.getAccumulatedFees(accountantAddress),
            totalFeesCollected: await this.getTotalFeesCollected(accountantAddress),
            averageFeeRate: await this.calculateAverageFeeRate(accountantAddress)
        };
    }
    
    async trackFeeEfficiency(vaultAddress, accountantAddress) {
        const vault = new ethers.Contract(vaultAddress, vaultABI, this.provider);
        const events = await vault.queryFilter(vault.filters.StrategyReported());
        
        let totalGains = ethers.BigNumber.from(0);
        let totalFees = ethers.BigNumber.from(0);
        
        for (const event of events) {
            totalGains = totalGains.add(event.args.gain);
            totalFees = totalFees.add(event.args.totalFees);
        }
        
        const effectiveFeeRate = totalFees.mul(10000).div(totalGains);
        return {
            totalGains: totalGains.toString(),
            totalFees: totalFees.toString(),
            effectiveFeeRate: effectiveFeeRate.toNumber() // basis points
        };
    }
}
```

## Best Practices

### For Accountant Administrators

1. **Fee Setting**: Set competitive but sustainable fee rates
2. **Regular Distribution**: Distribute accumulated fees regularly
3. **Monitoring**: Track fee collection and strategy performance
4. **Transparency**: Clearly communicate fee structures to users

### For Vault Operators

1. **Accountant Selection**: Choose accountants with appropriate fee structures
2. **Performance Tracking**: Monitor net returns after fees
3. **User Communication**: Explain fee structures clearly to users
4. **Regular Review**: Periodically review fee arrangements

### For Strategy Developers

1. **Fee Awareness**: Understand how fees impact strategy returns
2. **Performance Optimization**: Focus on consistent, sustainable returns
3. **Fee Integration**: Ensure strategies work well with fee structures
4. **Reporting Accuracy**: Provide accurate gain/loss reporting

## Security Considerations

### Access Control Security

- **Role Management**: Use multi-signature wallets for admin roles
- **Permission Isolation**: Limit admin permissions to specific functions
- **Regular Audits**: Review and audit role assignments periodically

### Economic Security

- **Fee Validation**: Implement comprehensive fee validation
- **Rate Limits**: Consider maximum fee changes per time period
- **Emergency Controls**: Implement emergency fee reduction mechanisms

### Integration Security

- **Interface Compliance**: Ensure full IAccountant interface compliance
- **Vault Compatibility**: Test thoroughly with different vault implementations
- **Upgrade Safety**: Design for safe upgrades without breaking existing vaults

## Conclusion

The Accountant system provides a flexible and secure foundation for fee management in the Fathom Vault ecosystem. Its modular design enables various fee structures while maintaining consistency and security across the platform.

The combination of simple base implementation with extensibility for advanced fee structures makes it suitable for a wide range of use cases, from basic performance fees to sophisticated institutional-grade fee arrangements. This flexibility, combined with robust security and monitoring capabilities, enables sustainable revenue generation while maintaining user trust and transparency. 