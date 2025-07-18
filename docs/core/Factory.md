# Factory System Documentation

## Overview

The **Factory** is the central deployment hub of the Fathom Vault ecosystem, responsible for creating new vault instances, managing vault packages (implementations), and configuring protocol-wide fee parameters. It implements an upgradeable proxy pattern that enables permissionless vault deployment while maintaining security and standardization.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Factory System                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │     Factory     │  │ FactoryPackage  │  │   Storage   │  │
│  │   (Proxy)       │  │ (Implementation)│  │             │  │
│  │                 │  │                 │  │ • Packages  │  │
│  │ • Upgrades      │  │ • Deployment    │  │ • Vaults    │  │
│  │ • Access        │  │ • Management    │  │ • Fee Config│  │
│  │ • Storage       │  │ • Fee Config    │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Vault Package    │
                    │   (Implementation)  │
                    │                     │
                    │ • Core Logic        │
                    │ • ERC-4626          │
                    │ • Strategy Mgmt     │
                    └─────────────────────┘
```

### Contract Structure

```solidity
// Main Factory Contract (Proxy)
contract Factory is Proxy, ERC1967Upgrade, IUpgradeable, FactoryStorage

// Implementation Contract
contract FactoryPackage is FactoryStorage, IFactory, IFactoryInit, IFactoryEvents

// Storage Contract
contract FactoryStorage is AccessControl {
    uint16 public feeBPS;              // Protocol fee in basis points
    address public feeRecipient;       // Protocol fee recipient
    address[] public vaults;           // Deployed vault addresses
    mapping(address => bool) public isPackage; // Approved vault packages
    bool public initialized;           // Initialization state
}
```

## Key Features

### 1. Permissionless Vault Deployment

The Factory enables anyone to deploy standardized vaults with custom configurations while ensuring security and compatibility.

**Deployment Process:**
```solidity
function deployVault(
    address _vaultPackageAddress,    // Implementation to use
    uint32 _profitMaxUnlockTime,     // Profit unlock period
    uint256 _assetType,              // Asset category identifier
    address _asset,                  // Underlying asset address
    string calldata _name,           // Vault token name
    string calldata _symbol,         // Vault token symbol
    address _accountant,             // Fee management contract
    address _admin                   // Vault administrator
) external returns (address vault)
```

**Security Features:**
- Only approved vault packages can be deployed
- Comprehensive parameter validation
- Access control for deployment permissions
- Event emission for transparency

### 2. Vault Package Management

The Factory maintains a registry of approved vault implementations, enabling version management and security updates.

**Package Operations:**
```solidity
// Add new vault implementation
function addVaultPackage(address _vaultPackage) external onlyRole(DEFAULT_ADMIN_ROLE)

// Remove outdated/vulnerable implementations  
function removeVaultPackage(address _vaultPackage) external onlyRole(DEFAULT_ADMIN_ROLE)

// Check if implementation is approved
function isVaultPackage(address _vaultPackage) external view returns (bool)
```

**Benefits:**
- **Version Control**: Multiple vault implementations can coexist
- **Security Updates**: Quick removal of vulnerable implementations
- **Innovation**: Easy addition of new vault features
- **Backward Compatibility**: Existing vaults remain functional

### 3. Protocol Fee Configuration

Centralized management of protocol-wide fee parameters ensures consistent revenue distribution and governance control.

**Fee Management:**
```solidity
function updateFeeConfig(
    address _feeRecipient,    // Where protocol fees are sent
    uint16 _feeBPS           // Fee percentage in basis points (max 10000 = 100%)
) external onlyRole(DEFAULT_ADMIN_ROLE)

function protocolFeeConfig() external view returns (uint16 feeBps, address feeRecipient)
```

**Fee Flow:**
```
Strategy Profits → Accountant → Performance Fees → Protocol Fees (% of performance fees) → Fee Recipient
```

## Deployment Lifecycle

### 1. Factory Initialization

```solidity
function initialize(
    address _vaultPackage,     // Initial vault implementation
    address _feeRecipient,     // Protocol fee recipient
    uint16 _feeBPS            // Protocol fee percentage
) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Initialization Steps:**
1. Set initial vault package as approved
2. Configure protocol fee parameters
3. Set factory as initialized
4. Emit configuration events

### 2. Vault Package Addition

**Prerequisites:**
- Package must implement IVault interface
- Package must pass security review
- Admin role required for addition

**Process:**
```javascript
// Add new vault package
await factory.addVaultPackage(newVaultPackageAddress);

// Verify addition
const isApproved = await factory.isVaultPackage(newVaultPackageAddress);
```

### 3. Vault Deployment

**Example Deployment:**
```javascript
const vaultAddress = await factory.deployVault(
    vaultPackageAddress,        // Approved implementation
    604800,                     // 1 week profit unlock time
    1,                          // Asset type identifier
    usdcAddress,               // USDC as underlying asset
    "USDC Yield Vault",        // Vault name
    "fvUSDC",                  // Vault symbol
    accountantAddress,         // Fee management contract
    adminAddress               // Vault administrator
);
```

### 4. Post-Deployment

After deployment, the vault:
1. Is added to the factory's vault registry
2. Emits `VaultDeployed` event with all parameters
3. Initializes with specified configuration
4. Becomes immediately available for user interaction

## Access Control and Security

### Role-Based Access Control

```solidity
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;  // Factory administration
```

**Admin Permissions:**
- Add/remove vault packages
- Update protocol fee configuration
- Upgrade factory implementation
- Emergency controls

### Security Measures

**Input Validation:**
- Zero address checks for all critical parameters
- Fee percentage bounds validation (≤ 100%)
- Package existence verification before deployment
- Duplicate package prevention

**Upgrade Safety:**
- ERC1967 proxy pattern for secure upgrades
- Admin-only upgrade permissions
- Implementation verification before upgrade
- Storage layout preservation

**Emergency Controls:**
- Package removal for security issues
- Fee configuration updates for governance changes
- Implementation upgrades for critical fixes

## Events and Monitoring

### Key Events

```solidity
event VaultDeployed(
    address indexed vault,
    uint32 profitMaxUnlockTime,
    address indexed asset,
    string name,
    string symbol,
    address indexed accountant,
    address admin
);

event VaultPackageAdded(address indexed vaultPackage, address indexed creator);
event VaultPackageRemoved(address indexed vaultPackage);
event FeeConfigUpdated(address indexed feeRecipient, uint16 feeBPS);
```

### Monitoring Metrics

1. **Deployment Rate**: Number of vaults deployed over time
2. **Package Utilization**: Which implementations are most popular
3. **Fee Revenue**: Protocol fees generated from vault performance
4. **Asset Distribution**: Types and amounts of assets under management

## Integration Patterns

### 1. Basic Vault Deployment

```javascript
class VaultDeployer {
    constructor(factoryAddress, signer) {
        this.factory = new ethers.Contract(factoryAddress, factoryABI, signer);
    }
    
    async deployVault(config) {
        // Validate configuration
        await this.validateConfig(config);
        
        // Deploy vault
        const tx = await this.factory.deployVault(
            config.packageAddress,
            config.profitMaxUnlockTime,
            config.assetType,
            config.asset,
            config.name,
            config.symbol,
            config.accountant,
            config.admin
        );
        
        const receipt = await tx.wait();
        const vaultAddress = this.extractVaultAddress(receipt);
        
        return vaultAddress;
    }
}
```

### 2. Package Management

```javascript
class PackageManager {
    async addPackage(packageAddress) {
        // Verify package implements required interfaces
        await this.verifyPackageCompatibility(packageAddress);
        
        // Add to factory
        await this.factory.addVaultPackage(packageAddress);
        
        // Update local registry
        this.packages.add(packageAddress);
    }
    
    async removePackage(packageAddress) {
        // Check for existing vaults using this package
        const usageCount = await this.checkPackageUsage(packageAddress);
        
        if (usageCount > 0) {
            console.warn(`Package ${packageAddress} is used by ${usageCount} vaults`);
        }
        
        await this.factory.removeVaultPackage(packageAddress);
    }
}
```

### 3. Fee Management

```javascript
class FeeManager {
    async updateProtocolFees(newRecipient, newFeeBps) {
        // Validate fee parameters
        if (newFeeBps > 10000) throw new Error("Fee exceeds 100%");
        if (newRecipient === ethers.constants.AddressZero) {
            throw new Error("Invalid recipient");
        }
        
        // Update configuration
        await this.factory.updateFeeConfig(newRecipient, newFeeBps);
        
        // Emit update notification
        this.emit('FeeConfigUpdated', { newRecipient, newFeeBps });
    }
}
```

## Error Handling

### Common Errors

```solidity
error AlreadyInitialized();           // Factory already initialized
error ZeroAddress();                  // Invalid zero address provided
error FeeGreaterThan100();           // Fee exceeds maximum (100%)
error SameVaultPackage();            // Package already exists
error InvalidVaultPackageId();       // Package not approved for deployment
```

### Troubleshooting

**Deployment Failures:**
1. Check vault package is approved: `isVaultPackage(packageAddress)`
2. Verify all parameters are valid (non-zero addresses, reasonable fees)
3. Ensure caller has deployment permissions
4. Confirm sufficient gas for deployment

**Package Management Issues:**
1. Verify package implements required interfaces
2. Check admin permissions for package operations
3. Confirm package address is correct and deployed

**Fee Configuration Problems:**
1. Ensure fee percentage is ≤ 10000 (100%)
2. Verify fee recipient is not zero address
3. Confirm admin role for fee updates

## Best Practices

### For Factory Administrators

1. **Package Verification**: Thoroughly audit vault packages before approval
2. **Fee Management**: Set reasonable protocol fees that don't discourage usage
3. **Monitoring**: Track deployment patterns and package utilization
4. **Security**: Regularly review and update approved packages

### For Vault Deployers

1. **Package Selection**: Choose appropriate and up-to-date vault packages
2. **Configuration**: Set reasonable profit unlock times and deposit limits
3. **Admin Setup**: Use multi-signature wallets for vault administration
4. **Testing**: Deploy to testnets before mainnet deployment

### for Integration Partners

1. **Event Monitoring**: Subscribe to factory events for real-time updates
2. **Package Tracking**: Maintain registry of approved vault packages
3. **Error Handling**: Implement robust error handling for deployment failures
4. **Version Management**: Track vault package versions and updates

## Security Considerations

### Smart Contract Security

- **Proxy Pattern**: Uses OpenZeppelin's ERC1967 for secure upgrades
- **Access Controls**: Role-based permissions for all admin functions
- **Input Validation**: Comprehensive parameter validation
- **Emergency Stops**: Package removal capability for security issues

### Operational Security

- **Admin Key Management**: Use hardware wallets or multi-signature contracts
- **Upgrade Procedures**: Follow secure upgrade procedures with timelock
- **Monitoring**: Implement monitoring for unusual deployment patterns
- **Audit Requirements**: Regular security audits for new packages

## Performance Considerations

### Gas Optimization

- **Efficient Storage**: Optimized storage layout for minimal gas usage
- **Batch Operations**: Consider batching multiple operations when possible
- **Proxy Overhead**: Minimal proxy overhead due to efficient implementation
- **Event Optimization**: Efficient event emission for monitoring

### Scalability

- **Package Registry**: Efficient mapping-based package management
- **Vault Tracking**: Array-based vault registry with efficient access patterns
- **Fee Calculation**: Optimized fee calculation to minimize gas costs
- **Upgrade Path**: Smooth upgrade path for scaling improvements

## Conclusion

The Factory system provides a robust, secure, and flexible foundation for the Fathom Vault ecosystem. Its combination of permissionless deployment, version management, and protocol fee coordination enables sustainable growth while maintaining security and user experience standards.

The upgradeable design ensures the Factory can evolve with the ecosystem's needs while preserving existing functionality and user funds. This makes it an ideal foundation for building sophisticated DeFi yield products that can adapt to changing market conditions and user requirements. 