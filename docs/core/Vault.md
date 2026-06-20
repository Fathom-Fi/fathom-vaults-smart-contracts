# Vault System Documentation

## Overview

The **Vault** is the core component of the Fathom Vault ecosystem, implementing a sophisticated ERC-4626 compliant vault that manages user deposits, allocates funds across multiple strategies, and distributes yields with robust accounting and risk management. It uses an upgradeable proxy pattern to enable feature updates while preserving user funds and maintaining backward compatibility.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          Vault System                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │   FathomVault │  │VaultPackage  │  │    VaultLogic       │  │
│  │   (Proxy)     │  │(Implementation)│   │    (Library)       │  │
│  │               │  │              │  │                     │  │
│  │ • Upgrades    │  │ • ERC-4626   │  │ • Math Operations   │  │
│  │ • Storage     │  │ • Strategies │  │ • Fee Calculations  │  │
│  │ • Access      │  │ • Accounting │  │ • Share Conversion  │  │
│  └───────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
┌───▼────┐              ┌─────▼──────┐            ┌─────▼─────┐
│Strategy│              │ Accountant │            │  Modules  │
│   A    │              │            │            │           │
└────────┘              │• Fee Mgmt  │            │• Deposit  │
┌────────┐              │• Reporting │            │  Limits   │
│Strategy│              └────────────┘            │• Withdraw │
│   B    │                                        │  Limits   │
└────────┘                                        │• KYC      │
┌────────┐                                        └───────────┘
│Strategy│
│   ...  │
└────────┘
```

### Contract Structure

```solidity
// Main Vault Contract (Proxy)
contract FathomVault is Proxy, ERC1967Upgrade, IUpgradeable, VaultStorage

// Implementation Contract  
contract VaultPackage is VaultStorage, IVault, IVaultInit, IVaultEvents

// Storage Contract
contract VaultStorage is AccessControl, ReentrancyGuard {
    // Core vault state
    uint256 public totalSupplyAmount;     // Total shares including locked
    uint256 public totalDebt;             // Assets deployed to strategies
    uint256 public totalIdle;             // Assets in vault
    uint256 public depositLimit;          // Maximum deposits allowed
    
    // Strategy management
    mapping(address => StrategyParams) public strategies;
    address[] public defaultQueue;        // Default withdrawal queue
    
    // Fee and profit management
    uint256 public profitMaxUnlockTime;   // Profit unlock period
    uint256 public profitUnlockingRate;   // Rate of profit unlocking
    uint256 public fullProfitUnlockDate;  // When profits fully unlock
    
    // External contracts
    address public accountant;            // Fee management
    address public factory;               // Vault factory
    ERC20 internal assetContract;         // Underlying asset
}
```

## Key Features

### 1. ERC-4626 Compliance

The vault implements the full ERC-4626 standard for tokenized vaults, ensuring compatibility with DeFi ecosystem tools and interfaces.

**Core Functions:**
```solidity
// Deposit assets, receive shares
function deposit(uint256 assets, address receiver) external returns (uint256 shares)

// Mint specific shares amount
function mint(uint256 shares, address receiver) external returns (uint256 assets)

// Withdraw assets, burn shares
function withdraw(uint256 assets, address receiver, address owner, 
                 uint256 maxLoss, address[] calldata strategies) external returns (uint256 shares)

// Redeem shares for assets
function redeem(uint256 shares, address receiver, address owner,
                uint256 maxLoss, address[] calldata strategies) external returns (uint256 assets)
```

**Preview Functions:**
```solidity
function previewDeposit(uint256 assets) external view returns (uint256 shares)
function previewMint(uint256 shares) external view returns (uint256 assets)
function previewWithdraw(uint256 assets) external view returns (uint256 shares)
function previewRedeem(uint256 shares) external view returns (uint256 assets)
```

### 2. Multi-Strategy Management

The vault can allocate funds across multiple strategies to maximize yield while managing risk through diversification.

**Strategy Operations:**
```solidity
// Add new strategy to vault
function addStrategy(address newStrategy) external onlyRole(STRATEGY_MANAGER)

// Remove strategy (force if necessary)
function revokeStrategy(address strategy, bool force) external onlyRole(STRATEGY_MANAGER)

// Update strategy's maximum debt allocation
function updateMaxDebtForStrategy(address strategy, uint256 newMaxDebt) 
    external onlyRole(STRATEGY_MANAGER)

// Update strategy's current debt
function updateDebt(address strategy, uint256 targetDebt) 
    external onlyRole(DEBT_MANAGER) returns (uint256)
```

**Strategy Accounting:**
```solidity
struct StrategyParams {
    uint256 activation;      // When strategy was added
    uint256 lastReport;      // Last report timestamp  
    uint256 currentDebt;     // Current assets allocated
    uint256 maxDebt;         // Maximum assets allowed
}
```

### 3. Profit Management and Distribution

The vault implements a sophisticated profit unlocking mechanism that prevents manipulation while ensuring fair distribution.

**Profit Unlocking:**
- Profits are locked initially and unlock linearly over `profitMaxUnlockTime`
- Prevents share price manipulation through large profit dumps
- Ensures steady, predictable yield for users
- Configurable unlock period (up to 1 year)

**Process Flow:**
```
Strategy Reports Profit → Fees Calculated → Remaining Profit Locked → 
Linear Unlock Over Time → Share Price Appreciation
```

### 4. Comprehensive Access Control

Role-based access control ensures secure operations while enabling flexible management.

**Core Roles:**
```solidity
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;        // Overall admin
bytes32 public constant STRATEGY_MANAGER = keccak256("STRATEGY_MANAGER");     // Strategy management
bytes32 public constant REPORTING_MANAGER = keccak256("REPORTING_MANAGER");   // Report processing
bytes32 public constant DEBT_PURCHASER = keccak256("DEBT_PURCHASER");        // Debt purchasing
```

**Permission Matrix:**
| Function | Admin | Strategy Manager | Reporting Manager | Debt Purchaser |
|----------|-------|------------------|-------------------|----------------|
| Add/Revoke Strategy | ✓ | ✓ | ✗ | ✗ |
| Update Debt | ✓ | ✓ | ✗ | ✗ |
| Process Report | ✓ | ✗ | ✓ | ✗ |
| Buy Debt | ✓ | ✗ | ✗ | ✓ |
| Emergency Shutdown | ✓ | ✗ | ✗ | ✗ |

## Deposit and Withdrawal System

### Deposit Process

```
User Deposits Assets → Deposit Limit Check → Module Validation → 
Mint Shares → Update Idle Balance → Deploy to Strategies (if configured)
```

**Deposit Validation:**
1. **Deposit Limits**: Global and user-specific limits
2. **Module Checks**: KYC or other compliance modules  
3. **Minimum Amounts**: Configurable minimum deposit amounts
4. **Vault Status**: Vault must not be shutdown

**Example Deposit:**
```javascript
// User deposits 1000 USDC
const depositAmount = ethers.utils.parseEther("1000");
const sharesReceived = await vault.deposit(depositAmount, userAddress);

// Shares received based on current price per share
const pricePerShare = await vault.pricePerShare();
console.log(`Deposited: ${depositAmount} USDC`);
console.log(`Received: ${sharesReceived} shares`);
console.log(`Price per share: ${pricePerShare}`);
```

### Withdrawal Process

```
User Requests Withdrawal → Share Validation → Strategy Queue Processing → 
Collect Assets from Strategies → Transfer to User → Burn Shares
```

**Withdrawal Features:**
- **Custom Strategy Queue**: Users can specify withdrawal order
- **Default Queue**: Vault maintains optimal withdrawal order
- **Max Loss Protection**: Users can limit acceptable losses
- **Partial Fulfillment**: Withdrawals succeed even if some strategies lack liquidity

**Example Withdrawal:**
```javascript
// Withdraw 500 USDC with 1% max loss
const withdrawAmount = ethers.utils.parseEther("500");
const maxLoss = 100; // 1% in basis points
const strategies = []; // Use default queue

const sharesBurned = await vault.withdraw(
    withdrawAmount,
    userAddress,     // receiver
    userAddress,     // owner
    maxLoss,
    strategies
);
```

## Strategy Integration

### Strategy Lifecycle

**1. Strategy Addition:**
```solidity
function addStrategy(address newStrategy) external onlyRole(STRATEGY_MANAGER) {
    // Validate strategy interface
    require(IStrategy(newStrategy).asset() == asset(), "Wrong asset");
    
    // Initialize strategy parameters
    strategies[newStrategy] = StrategyParams({
        activation: block.timestamp,
        lastReport: block.timestamp,
        currentDebt: 0,
        maxDebt: 0
    });
    
    emit StrategyAdded(newStrategy);
}
```

**2. Debt Management:**
```solidity
function updateDebt(address strategy, uint256 targetDebt) 
    external onlyRole(DEBT_MANAGER) returns (uint256) {
    
    StrategyParams storage params = strategies[strategy];
    uint256 currentDebt = params.currentDebt;
    
    if (targetDebt > currentDebt) {
        // Increase debt - send assets to strategy
        uint256 increase = targetDebt - currentDebt;
        assetContract.safeTransfer(strategy, increase);
        totalDebt += increase;
        totalIdle -= increase;
    } else if (targetDebt < currentDebt) {
        // Decrease debt - withdraw assets from strategy
        uint256 decrease = currentDebt - targetDebt;
        IStrategy(strategy).withdraw(decrease);
        totalDebt -= decrease;
        totalIdle += decrease;
    }
    
    params.currentDebt = targetDebt;
    emit DebtUpdated(strategy, currentDebt, targetDebt);
    
    return targetDebt;
}
```

**3. Report Processing:**
```solidity
function processReport(address strategy) 
    external onlyRole(REPORTING_MANAGER) returns (uint256, uint256) {
    
    // Get current strategy debt
    uint256 currentDebt = strategies[strategy].currentDebt;
    
    // Process report through VaultLogic library
    ReportInfo memory reportInfo = VaultLogic.processReport(
        strategy,
        currentDebt,
        totalSupplyAmount,
        totalAssets(),
        accountant,
        factory
    );
    
    // Update profit unlocking
    _updateProfitUnlocking(reportInfo);
    
    // Emit events
    emit StrategyReported(
        strategy,
        reportInfo.gain,
        reportInfo.loss,
        currentDebt,
        reportInfo.protocolFees,
        reportInfo.totalFees,
        reportInfo.assessmentFees.totalRefunds
    );
    
    return (reportInfo.gain, reportInfo.loss);
}
```

### Default Queue Management

The vault maintains a default withdrawal queue that optimizes for liquidity and gas efficiency.

**Queue Configuration:**
```solidity
function setDefaultQueue(address[] calldata newDefaultQueue) 
    external onlyRole(STRATEGY_MANAGER) {
    
    // Validate queue length
    require(newDefaultQueue.length <= MAX_QUEUE, "Queue too long");
    
    // Validate strategies are active and unique
    for (uint256 i = 0; i < newDefaultQueue.length; i++) {
        address strategy = newDefaultQueue[i];
        require(strategies[strategy].activation != 0, "Inactive strategy");
        
        // Check for duplicates
        for (uint256 j = i + 1; j < newDefaultQueue.length; j++) {
            require(strategy != newDefaultQueue[j], "Duplicate strategy");
        }
    }
    
    defaultQueue = newDefaultQueue;
    emit UpdatedDefaultQueue(newDefaultQueue);
}
```

## Fee Management Integration

### Accountant Integration

The vault integrates with the Accountant system for comprehensive fee management.

**Fee Assessment Process:**
```solidity
function assessFees(address strategy, uint256 gain, uint256 loss) 
    internal view returns (FeeAssessment memory) {
    
    FeeAssessment memory fees;
    
    if (accountant != address(0)) {
        // Get accountant fees
        (fees.totalFees, fees.totalRefunds) = IAccountant(accountant).report(
            strategy, gain, loss
        );
        
        // Calculate protocol fees (percentage of accountant fees)
        if (fees.totalFees > 0) {
            (uint16 protocolFeeBps, address protocolFeeRecipient) = 
                IFactory(factory).protocolFeeConfig();
                
            if (protocolFeeBps > 0) {
                fees.protocolFees = (fees.totalFees * protocolFeeBps) / MAX_BPS;
                fees.protocolFeeRecipient = protocolFeeRecipient;
            }
        }
    }
    
    return fees;
}
```

### Share-Based Fee Collection

Fees are collected through share issuance rather than asset transfer, improving gas efficiency.

**Fee Share Calculation:**
```solidity
function calculateShareManagement(
    uint256 loss,
    uint256 totalFees,
    uint256 protocolFees,
    uint256 totalSupply,
    uint256 totalAssets
) internal pure returns (ShareManagement memory) {
    
    ShareManagement memory shares;
    
    // Calculate shares to burn for losses
    if (loss > 0 && totalSupply > 0) {
        shares.sharesToBurn = (loss * totalSupply) / totalAssets;
    }
    
    // Calculate shares to issue for fees
    if (totalFees > 0 && totalSupply > 0) {
        uint256 feeShares = (totalFees * totalSupply) / 
                           (totalAssets - totalFees);
        
        shares.accountantFeesShares = feeShares;
        
        if (protocolFees > 0) {
            shares.protocolFeesShares = (protocolFees * feeShares) / totalFees;
            shares.accountantFeesShares -= shares.protocolFeesShares;
        }
    }
    
    return shares;
}
```

## Security Features

### Emergency Controls

**Vault Shutdown:**
```solidity
function shutdownVault() external onlyRole(DEFAULT_ADMIN_ROLE) {
    shutdown = true;
    emit Shutdown();
}
```

**Effects of Shutdown:**
- No new deposits accepted
- Withdrawals remain available
- Strategy operations continue for liquidity provision
- Emergency withdrawal procedures activated

### Loss Protection

**Max Loss Parameter:**
Users can specify maximum acceptable loss during withdrawals:

```solidity
function withdraw(
    uint256 assets,
    address receiver,
    address owner,
    uint256 maxLoss,        // Basis points (10000 = 100%)
    address[] calldata strategies
) external returns (uint256) {
    // Withdrawal logic with loss validation
    uint256 actualLoss = calculateWithdrawalLoss(assets, strategies);
    require(actualLoss <= maxLoss, "Exceeds max loss");
    
    // Continue with withdrawal
}
```

### Reentrancy Protection

All external functions are protected against reentrancy attacks:

```solidity
contract VaultStorage is AccessControl, ReentrancyGuard {
    // All state-changing functions use nonReentrant modifier
    function deposit(uint256 assets, address receiver) 
        external nonReentrant returns (uint256) {
        // Deposit logic
    }
}
```

## Limit Modules

### Deposit Limit Module

Configurable module for advanced deposit controls:

```solidity
interface IDepositLimitModule {
    function availableDepositLimit(address receiver) external view returns (uint256);
}

// In vault logic:
function _checkDepositLimit(address receiver, uint256 assets) internal view {
    if (depositLimitModule != address(0)) {
        uint256 available = IDepositLimitModule(depositLimitModule)
            .availableDepositLimit(receiver);
        require(assets <= available, "Exceeds deposit limit");
    }
}
```

**KYC Module Example:**
```solidity
contract KYCDepositLimitModule is IDepositLimitModule {
    mapping(address => bool) public kycPassed;
    
    function availableDepositLimit(address receiver) 
        external view override returns (uint256) {
        return kycPassed[receiver] ? type(uint256).max : 0;
    }
}
```

### Withdraw Limit Module

Similar pattern for withdrawal restrictions:

```solidity
interface IWithdrawLimitModule {
    function availableWithdrawLimit(address owner) external view returns (uint256);
}
```

## Events and Monitoring

### Key Events

```solidity
// Strategy events
event StrategyAdded(address indexed strategy, bytes4 indexed interfaceId, bytes data);
event StrategyChanged(address indexed strategy, StrategyChangeType changeType);
event StrategyReported(address indexed strategy, uint256 gain, uint256 loss, 
                      uint256 currentDebt, uint256 protocolFees, uint256 totalFees, 
                      uint256 totalRefunds);
event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);

// Configuration events  
event UpdatedAccountant(address accountant);
event UpdatedDefaultQueue(address[] newDefaultQueue);
event UpdatedDepositLimit(uint256 depositLimit);
event UpdatedProfitMaxUnlockTime(uint256 profitMaxUnlockTime);

// Emergency events
event Shutdown();
```

### Monitoring Metrics

1. **Asset Management**: Total assets, debt allocation, idle balance
2. **User Activity**: Deposits, withdrawals, share transfers
3. **Strategy Performance**: Individual strategy gains/losses
4. **Fee Collection**: Performance fees, protocol fees collected
5. **System Health**: Profit unlock progress, queue efficiency

## Integration Examples

### Basic Vault Operations

```javascript
class VaultManager {
    constructor(vaultAddress, signer) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, signer);
    }
    
    async deposit(amount) {
        // Check deposit limit
        const maxDeposit = await this.vault.maxDeposit(this.signer.address);
        if (amount > maxDeposit) {
            throw new Error(`Deposit exceeds limit: ${maxDeposit}`);
        }
        
        // Approve asset transfer
        const asset = await this.vault.asset();
        await this.approveAsset(asset, amount);
        
        // Execute deposit
        const tx = await this.vault.deposit(amount, this.signer.address);
        const receipt = await tx.wait();
        
        return this.extractSharesFromReceipt(receipt);
    }
    
    async withdraw(amount, maxLoss = 0, strategies = []) {
        const sharesRequired = await this.vault.previewWithdraw(amount);
        const userShares = await this.vault.balanceOf(this.signer.address);
        
        if (sharesRequired > userShares) {
            throw new Error(`Insufficient shares: need ${sharesRequired}, have ${userShares}`);
        }
        
        return await this.vault.withdraw(
            amount,
            this.signer.address,
            this.signer.address,
            maxLoss,
            strategies
        );
    }
}
```

### Strategy Management

```javascript
class StrategyManager {
    async addStrategy(strategyAddress, maxDebt) {
        // Validate strategy
        await this.validateStrategy(strategyAddress);
        
        // Add to vault
        await this.vault.addStrategy(strategyAddress);
        
        // Set maximum debt allocation
        await this.vault.updateMaxDebtForStrategy(strategyAddress, maxDebt);
        
        // Add to default queue if desired
        await this.updateDefaultQueue([...this.currentQueue, strategyAddress]);
    }
    
    async rebalanceStrategies() {
        const strategies = await this.getActiveStrategies();
        const totalAssets = await this.vault.totalAssets();
        
        for (const strategy of strategies) {
            const targetAllocation = this.calculateTargetAllocation(strategy, totalAssets);
            await this.vault.updateDebt(strategy.address, targetAllocation);
        }
    }
}
```

## Performance Considerations

### Gas Optimization

**Efficient Operations:**
- Share-based fee collection (no asset transfers)
- Optimized withdrawal queue processing
- Batched strategy operations where possible
- Minimal storage reads/writes

**Gas Costs (Approximate):**
- Deposit: ~150k gas
- Withdrawal (single strategy): ~200k gas  
- Withdrawal (multiple strategies): ~200k + (50k per strategy)
- Strategy report: ~300k gas
- Add strategy: ~100k gas

### Scalability

**Strategy Limits:**
- Maximum 10 strategies in default queue
- Unlimited total strategies (gas limits apply)
- Efficient O(1) strategy lookups
- Linear withdrawal processing (optimized order)

## Best Practices

### For Vault Administrators

1. **Strategy Diversification**: Use multiple uncorrelated strategies
2. **Regular Monitoring**: Track strategy performance and risks
3. **Queue Optimization**: Order strategies by liquidity and efficiency
4. **Emergency Planning**: Prepare procedures for strategy failures

### For Users

1. **Understand Strategies**: Research vault's strategy allocation
2. **Monitor Performance**: Track price per share over time
3. **Plan Withdrawals**: Consider queue order and potential losses
4. **Stay Informed**: Follow vault updates and strategy changes

### For Integrators

1. **Use Preview Functions**: Always preview before executing operations
2. **Handle Errors**: Implement robust error handling for edge cases
3. **Monitor Events**: Subscribe to relevant vault events
4. **Respect Limits**: Check deposit/withdrawal limits before operations

## Conclusion

The Vault system provides a sophisticated, secure, and flexible foundation for yield generation in DeFi. Its ERC-4626 compliance ensures broad compatibility, while advanced features like multi-strategy management, profit unlocking, and modular limits enable sophisticated yield products.

The combination of security features, performance optimizations, and extensive configurability makes it suitable for a wide range of use cases, from simple yield farming to complex structured products, all while maintaining the highest standards of security and user experience. 