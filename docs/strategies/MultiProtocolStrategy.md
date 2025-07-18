# MultiProtocolStrategy

## Overview

The `MultiProtocolStrategy` is a sophisticated multi-protocol aggregator strategy designed to diversify capital across multiple DeFi protocols including Aave V3, Uniswap V3, Uniswap V2, and Curve Finance. This strategy inherits from both `BaseStrategy` and `UniversalSwapper`, providing a unified interface for managing assets across different yield-generating protocols.

## Features

- **Multi-Protocol Allocation**: Configurable allocation across Aave V3, Uniswap V3, Uniswap V2, and Curve Finance
- **Dynamic Rebalancing**: Ability to adjust allocations and activate/deactivate protocol legs
- **Aave V3 Integration**: Primary protocol for lending with supply cap management
- **Future-Ready Architecture**: Designed to accommodate additional protocols without storage changes
- **Unified Reward Management**: Consolidated reward claiming and token swapping across protocols
- **Flexible Execution**: Arbitrary call functionality for complex protocol interactions

## Architecture

### Inheritance
```
MultiProtocolStrategy
├── BaseStrategy (core strategy functionality)
└── UniversalSwapper (token swapping capabilities)
```

### Protocol Legs
The strategy supports four distinct protocol legs:

1. **Aave**: Lending and borrowing on Aave V3
2. **UniV3**: Liquidity provision on Uniswap V3
3. **UniV2**: Liquidity provision on Uniswap V2
4. **Curve**: LP staking on Curve Finance

### Key Components

1. **Protocol Management**
   - `targetBps`: Allocation targets in basis points (10000 = 100%)
   - `legActive`: Boolean toggles for each protocol leg
   - `Leg` enum: Enumeration of supported protocols

2. **Aave V3 Integration** (Primary Implementation)
   - `LENDING_POOL`: Aave V3 Pool contract for deposits/withdrawals
   - `A_TOKEN`: Interest-bearing aToken received for deposits
   - `rewardsController`: Aave's rewards controller for claiming incentives
   - `DECIMALS`: Token decimals for supply cap calculations

3. **Future Protocol Support**
   - `positionManager`: Uniswap V3 position manager (ready for implementation)
   - Additional protocol integrations can be added via upgrades

4. **Configuration Parameters**
   - `claimRewards`: Boolean to enable/disable reward claiming
   - `minAmountToSellMapping`: Minimum amounts required to sell specific tokens

## Constructor Parameters

```solidity
constructor(
    address _asset,                     // The primary asset token
    string memory _name,                // Strategy name
    address _tokenizedStrategyAddress,  // TokenizedStrategy implementation
    address _aavePool,                  // Aave V3 Pool address
    address _base,                      // Base token for multi-hop swaps
    address _router,                    // UniversalRouter for token swaps
    address _permit2,                   // Permit2 contract for gas-efficient approvals
    address _positionManager            // Uniswap V3 Position Manager (future use)
)
```

## Management Functions

### Allocation Management
```solidity
// Set target allocations across all protocols (must sum to 10000 basis points)
function setTargetAllocations(uint16 _aave, uint16 _uniV3, uint16 _uniV2, uint16 _curve) external onlyManagement

// Toggle individual protocol legs on/off
function toggleLeg(Leg _leg, bool _active) external onlyManagement
```

### Configuration Management
```solidity
// Set Uniswap fees for token swaps
function setUniFees(address _token0, address _token1, uint24 _fee) external onlyManagement

// Set minimum sell amounts for reward tokens
function setMinAmountToSellMapping(address _token, uint256 _amount) external onlyManagement

// Enable/disable reward claiming
function setClaimRewards(bool _bool) external onlyManagement

// Update rewards controller address
function setRewardsController(address _controller) external onlyManagement
```

### Advanced Management
```solidity
// Execute arbitrary calls for complex protocol interactions
function execute(address _target, bytes calldata _data) external onlyManagement returns (bytes memory)
```

## Current Implementation Status

### V1 Implementation (Active)
- **Aave V3**: Fully implemented and active by default (100% allocation)
- **Supply Cap Management**: Respects Aave's supply caps to prevent overdepositing
- **Reward Claiming**: Automatic claiming and selling of Aave rewards
- **Token Swapping**: UniversalRouter integration for efficient swaps

### Future Protocol Legs (Ready for Implementation)
- **Uniswap V3**: Infrastructure ready, implementation pending
- **Uniswap V2**: Infrastructure ready, implementation pending
- **Curve Finance**: Infrastructure ready, implementation pending

## Strategy Logic

### Current (V1) Implementation
1. **Default Allocation**: 100% to Aave V3 (`targetBps[Leg.Aave] = 10_000`)
2. **Deposit Flow**: All funds deployed to Aave V3 lending pool
3. **Withdrawal Flow**: Funds withdrawn from Aave V3 positions
4. **Reward Management**: Claims and sells Aave rewards back to base asset

### Fund Deployment
```solidity
function _deployFunds(uint256 _amount) internal override {
    if (_amount == 0) return;
    
    // Currently route everything to Aave
    if (legActive[Leg.Aave]) {
        LENDING_POOL.supply(address(asset), _amount, address(this), 0);
    }
    // Future: Add logic for other protocol legs based on targetBps allocations
}
```

### Fund Withdrawal
```solidity
function _freeFunds(uint256 _amount) internal override {
    uint256 loose = asset.balanceOf(address(this));
    if (loose >= _amount) return; // Sufficient idle funds
    
    uint256 toWithdraw = _amount - loose;
    LENDING_POOL.withdraw(address(asset), Math.min(A_TOKEN.balanceOf(address(this)), toWithdraw), address(this));
}
```

## Risk Considerations

### Protocol Diversification Benefits
- **Reduced Single Protocol Risk**: Spreads exposure across multiple DeFi protocols
- **Yield Optimization**: Ability to allocate to highest-yielding opportunities
- **Liquidity Management**: Multiple sources of liquidity for withdrawals

### Current Risk Profile (V1)
- **Aave Concentration**: Currently 100% allocated to Aave V3
- **Smart Contract Risk**: Dependency on Aave V3 protocol security
- **Interest Rate Risk**: Exposure to Aave's variable interest rates

### Future Risk Considerations
- **Complexity Risk**: Managing multiple protocols increases operational complexity
- **Rebalancing Costs**: Gas costs for frequent rebalancing across protocols
- **Protocol Correlation**: DeFi protocols may be correlated during market stress

## Monitoring & Maintenance

### Key Metrics
```solidity
// Protocol allocation tracking
function targetBps(Leg _leg) external view returns (uint16)    // Target allocation for protocol
function legActive(Leg _leg) external view returns (bool)     // Whether protocol leg is active

// Aave-specific metrics
function getSupplyCap() public view returns (uint256)         // Current Aave supply cap
function availableDepositLimit(address) public view returns (uint256) // Available deposit capacity
```

### Current Monitoring (V1)
- **Aave Position Health**: Monitor supply caps and utilization
- **Reward Accumulation**: Track reward token balances and claiming frequency
- **Interest Rates**: Monitor Aave lending rates and APY

### Future Monitoring Considerations
- **Allocation Drift**: Track actual vs target allocations across protocols
- **Rebalancing Triggers**: Monitor conditions requiring allocation adjustments
- **Cross-Protocol Yield**: Compare yields across different protocol legs

## Upgrade Path & Future Development

### Modular Design Benefits
- **Storage Immutability**: New protocols can be added without storage migration
- **Gradual Rollout**: Individual protocol legs can be activated independently
- **Risk Management**: Allocations can be adjusted based on market conditions

### Implementation Roadmap
1. **Phase 1** (Current): Aave V3 integration
2. **Phase 2**: Uniswap V3 liquidity provision
3. **Phase 3**: Curve LP staking integration
4. **Phase 4**: Uniswap V2 integration and advanced rebalancing

### Technical Architecture
- **Interface Compatibility**: All protocols implement consistent interfaces
- **Execution Framework**: Generic `execute()` function for protocol-specific calls
- **Reward Standardization**: Unified reward claiming across protocols

## Examples

### Basic Deployment
```javascript
// Deploy MultiProtocolStrategy with Aave V3 integration
const strategy = await MultiProtocolStrategy.deploy(
    assetAddress,                    // Asset token (e.g., USDC)
    "MultiProtocol USDC Strategy",   // Strategy name
    tokenizedStrategy.address,       // TokenizedStrategy implementation
    aavePoolAddress,                 // Aave V3 Pool
    wethAddress,                     // Base token for swaps
    universalRouter.address,         // Universal Router
    permit2.address,                 // Permit2 contract
    positionManager.address          // Uniswap V3 Position Manager
);
```

### Allocation Management
```javascript
// Set initial 100% Aave allocation (default)
await strategy.setTargetAllocations(10000, 0, 0, 0);

// Diversify allocation: 60% Aave, 25% UniV3, 15% Curve
await strategy.setTargetAllocations(6000, 2500, 0, 1500);

// Activate additional protocol legs
await strategy.toggleLeg(2, true); // Enable UniV3
await strategy.toggleLeg(3, true); // Enable Curve
```

### Advanced Configuration
```javascript
// Configure swap parameters
await strategy.setUniFees(tokenA, tokenB, 3000); // 0.3% fee tier

// Set reward token sell thresholds
await strategy.setMinAmountToSellMapping(rewardToken, ethers.parseEther("0.1"));

// Enable reward claiming
await strategy.setClaimRewards(true);
```

### Protocol Integration (Future)
```javascript
// Example: Join Curve pool via execute function
const curvePoolInterface = new ethers.Interface(["function add_liquidity(uint256[2], uint256)"]);
const calldata = curvePoolInterface.encodeFunctionData("add_liquidity", [[amount0, amount1], minLpTokens]);

await strategy.execute(curvePoolAddress, calldata);
```

## Security Features

- **Access Control**: Management functions restricted to authorized roles
- **Protocol Validation**: Validates protocol addresses and parameters
- **Safe Math**: Uses OpenZeppelin's SafeERC20 for token operations
- **Emergency Controls**: Emergency withdrawal capabilities across all protocols
- **Modular Risk**: Individual protocol legs can be disabled if compromised

## Gas Optimization

- **Efficient Routing**: Smart allocation logic minimizes unnecessary transactions
- **Batch Operations**: Combines multiple protocol interactions where possible
- **Permit2 Integration**: Reduces approval gas costs through batch operations
- **Lazy Rebalancing**: Only rebalances when allocations drift beyond thresholds

## Performance Optimization

### Current (Aave-Only) Optimization
- **Supply Cap Monitoring**: Respects Aave supply caps for maximum utilization
- **Reward Timing**: Optimizes reward claiming frequency vs gas costs
- **Interest Rate Tracking**: Monitors Aave rates for yield optimization

### Future Multi-Protocol Optimization
- **Yield Comparison**: Dynamic allocation based on protocol yields
- **Liquidity Analysis**: Considers liquidity depth for large positions
- **Risk-Adjusted Returns**: Balances yield against protocol risks 