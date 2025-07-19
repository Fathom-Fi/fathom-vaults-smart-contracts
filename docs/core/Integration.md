# Integration Guide

## Overview

This guide provides comprehensive integration patterns, examples, and best practices for building applications and services on top of the Fathom Vault ecosystem. Whether you're developing user interfaces, automated strategies, or integrated DeFi protocols, this guide will help you leverage the full power of the vault system.

## Quick Start

### 1. Basic Vault Interaction

```javascript
import { ethers } from 'ethers';

// Connect to a deployed vault
const vaultAddress = "0x..."; // Your vault address
const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_URL");
const signer = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const vault = new ethers.Contract(vaultAddress, vaultABI, signer);

// Basic operations
async function basicOperations() {
    // Get vault information
    const asset = await vault.asset();
    const totalAssets = await vault.totalAssets();
    const pricePerShare = await vault.pricePerShare();
    
    console.log(`Vault asset: ${asset}`);
    console.log(`Total assets: ${ethers.utils.formatEther(totalAssets)}`);
    console.log(`Price per share: ${ethers.utils.formatEther(pricePerShare)}`);
    
    // Deposit 1000 tokens
    const depositAmount = ethers.utils.parseEther("1000");
    const tx = await vault.deposit(depositAmount, signer.address);
    await tx.wait();
    
    // Check your balance
    const shares = await vault.balanceOf(signer.address);
    console.log(`Your shares: ${ethers.utils.formatEther(shares)}`);
}
```

### 2. Factory Integration

```javascript
// Deploy a new vault through the factory
async function deployVault() {
    const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
    
    const vaultConfig = {
        vaultPackageAddress: "0x...", // Approved vault package
        profitMaxUnlockTime: 604800,  // 1 week
        assetType: 1,                 // Asset type identifier  
        asset: "0x...",               // USDC address
        name: "My USDC Vault",
        symbol: "mvUSDC",
        accountant: "0x...",          // Accountant address
        admin: signer.address
    };
    
    const tx = await factory.deployVault(
        vaultConfig.vaultPackageAddress,
        vaultConfig.profitMaxUnlockTime,
        vaultConfig.assetType,
        vaultConfig.asset,
        vaultConfig.name,
        vaultConfig.symbol,
        vaultConfig.accountant,
        vaultConfig.admin
    );
    
    const receipt = await tx.wait();
    const vaultAddress = extractVaultAddressFromReceipt(receipt);
    
    console.log(`Deployed vault at: ${vaultAddress}`);
    return vaultAddress;
}
```

## Integration Patterns

### 1. DeFi Frontend Integration

```javascript
class VaultInterface {
    constructor(vaultAddress, provider, signer) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, signer);
        this.asset = null;
        this.initialized = false;
    }
    
    async initialize() {
        this.asset = new ethers.Contract(
            await this.vault.asset(),
            erc20ABI,
            this.vault.signer
        );
        this.initialized = true;
    }
    
    async getVaultMetrics() {
        if (!this.initialized) await this.initialize();
        
        const [
            totalAssets,
            totalSupply,
            pricePerShare,
            depositLimit,
            userShares,
            userAssets
        ] = await Promise.all([
            this.vault.totalAssets(),
            this.vault.totalSupply(),
            this.vault.pricePerShare(),
            this.vault.maxDeposit(this.vault.signer.address),
            this.vault.balanceOf(this.vault.signer.address),
            this.vault.maxWithdraw(this.vault.signer.address, 0, [])
        ]);
        
        return {
            totalAssets: ethers.utils.formatUnits(totalAssets, await this.asset.decimals()),
            totalSupply: ethers.utils.formatEther(totalSupply),
            pricePerShare: ethers.utils.formatEther(pricePerShare),
            depositLimit: ethers.utils.formatUnits(depositLimit, await this.asset.decimals()),
            userShares: ethers.utils.formatEther(userShares),
            userAssets: ethers.utils.formatUnits(userAssets, await this.asset.decimals())
        };
    }
    
    async deposit(amount, slippage = 0.5) {
        if (!this.initialized) await this.initialize();
        
        const decimals = await this.asset.decimals();
        const depositAmount = ethers.utils.parseUnits(amount.toString(), decimals);
        
        // Check allowance
        const allowance = await this.asset.allowance(
            this.vault.signer.address,
            this.vault.address
        );
        
        if (allowance.lt(depositAmount)) {
            // Approve tokens
            const approveTx = await this.asset.approve(
                this.vault.address,
                ethers.constants.MaxUint256
            );
            await approveTx.wait();
        }
        
        // Calculate minimum shares with slippage protection
        const expectedShares = await this.vault.previewDeposit(depositAmount);
        const minShares = expectedShares.mul(10000 - slippage * 100).div(10000);
        
        // Execute deposit
        const tx = await this.vault.deposit(depositAmount, this.vault.signer.address);
        const receipt = await tx.wait();
        
        return {
            transactionHash: receipt.transactionHash,
            shares: extractSharesFromReceipt(receipt),
            gasUsed: receipt.gasUsed.toString()
        };
    }
    
    async withdraw(amount, maxLoss = 0, strategies = []) {
        const decimals = await this.asset.decimals();
        const withdrawAmount = ethers.utils.parseUnits(amount.toString(), decimals);
        
        const tx = await this.vault.withdraw(
            withdrawAmount,
            this.vault.signer.address,
            this.vault.signer.address,
            maxLoss * 100, // Convert to basis points
            strategies
        );
        
        const receipt = await tx.wait();
        return {
            transactionHash: receipt.transactionHash,
            assetsReceived: amount,
            gasUsed: receipt.gasUsed.toString()
        };
    }
}
```

### 2. Yield Aggregator Integration

```javascript
class YieldAggregator {
    constructor(factoryAddress, provider) {
        this.factory = new ethers.Contract(factoryAddress, factoryABI, provider);
        this.vaults = new Map();
    }
    
    async discoverVaults() {
        const vaultAddresses = await this.factory.getVaults();
        
        for (const address of vaultAddresses) {
            const vault = new ethers.Contract(address, vaultABI, this.factory.provider);
            const [asset, name, symbol] = await Promise.all([
                vault.asset(),
                vault.name(),
                vault.symbol()
            ]);
            
            this.vaults.set(address, {
                address,
                asset,
                name,
                symbol,
                contract: vault
            });
        }
        
        return Array.from(this.vaults.values());
    }
    
    async getYieldOpportunities(assetAddress) {
        const opportunities = [];
        
        for (const [address, vault] of this.vaults) {
            if (vault.asset.toLowerCase() === assetAddress.toLowerCase()) {
                const [totalAssets, apy] = await Promise.all([
                    vault.contract.totalAssets(),
                    this.calculateAPY(vault.contract)
                ]);
                
                opportunities.push({
                    vaultAddress: address,
                    vaultName: vault.name,
                    totalAssets: ethers.utils.formatEther(totalAssets),
                    estimatedAPY: apy,
                    riskLevel: await this.assessRiskLevel(vault.contract)
                });
            }
        }
        
        return opportunities.sort((a, b) => b.estimatedAPY - a.estimatedAPY);
    }
    
    async calculateAPY(vault) {
        // Get price per share history and calculate APY
        const currentPPS = await vault.pricePerShare();
        const historicalPPS = await this.getHistoricalPPS(vault.address, 30); // 30 days
        
        if (historicalPPS) {
            const growth = currentPPS.sub(historicalPPS).mul(100).div(historicalPPS);
            const annualized = growth.mul(365).div(30); // Annualize 30-day growth
            return parseFloat(ethers.utils.formatEther(annualized));
        }
        
        return 0;
    }
    
    async optimizeAllocation(totalAmount, riskProfile) {
        const opportunities = await this.getYieldOpportunities(assetAddress);
        const allocation = this.calculateOptimalAllocation(
            opportunities,
            totalAmount,
            riskProfile
        );
        
        return allocation;
    }
}
```

### 3. Strategy Management Integration

```javascript
class StrategyManager {
    constructor(vaultAddress, signer) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, signer);
        this.strategies = new Map();
    }
    
    async loadStrategies() {
        // Get active strategies from vault events
        const filter = this.vault.filters.StrategyAdded();
        const events = await this.vault.queryFilter(filter);
        
        for (const event of events) {
            const strategyAddress = event.args.strategy;
            const strategy = new ethers.Contract(strategyAddress, strategyABI, this.vault.signer);
            
            const [name, currentDebt, maxDebt] = await Promise.all([
                strategy.name ? strategy.name() : `Strategy ${strategyAddress.slice(0, 8)}`,
                this.vault.getDebt(strategyAddress),
                this.vault.strategies(strategyAddress).then(s => s.maxDebt)
            ]);
            
            this.strategies.set(strategyAddress, {
                address: strategyAddress,
                name,
                currentDebt,
                maxDebt,
                contract: strategy
            });
        }
    }
    
    async rebalanceStrategy(strategyAddress, targetAllocation) {
        const totalAssets = await this.vault.totalAssets();
        const targetDebt = totalAssets.mul(targetAllocation).div(10000); // targetAllocation in bps
        
        const tx = await this.vault.updateDebt(strategyAddress, targetDebt);
        await tx.wait();
        
        console.log(`Updated ${strategyAddress} debt to ${ethers.utils.formatEther(targetDebt)}`);
    }
    
    async harvestStrategy(strategyAddress) {
        const strategy = this.strategies.get(strategyAddress);
        if (!strategy) throw new Error("Strategy not found");
        
        // Call harvest on strategy (if it has one)
        if (strategy.contract.harvest) {
            const tx = await strategy.contract.harvest();
            await tx.wait();
        }
        
        // Process report in vault
        const reportTx = await this.vault.processReport(strategyAddress);
        const receipt = await reportTx.wait();
        
        return {
            transactionHash: receipt.transactionHash,
            gasUsed: receipt.gasUsed.toString()
        };
    }
    
    async getStrategyPerformance(strategyAddress, days = 30) {
        const filter = this.vault.filters.StrategyReported(strategyAddress);
        const events = await this.vault.queryFilter(filter);
        
        const recentEvents = events.filter(event => {
            const daysSinceEvent = (Date.now() / 1000 - event.blockNumber * 15) / 86400;
            return daysSinceEvent <= days;
        });
        
        let totalGains = ethers.BigNumber.from(0);
        let totalLosses = ethers.BigNumber.from(0);
        
        for (const event of recentEvents) {
            totalGains = totalGains.add(event.args.gain);
            totalLosses = totalLosses.add(event.args.loss);
        }
        
        return {
            totalGains: ethers.utils.formatEther(totalGains),
            totalLosses: ethers.utils.formatEther(totalLosses),
            netPerformance: ethers.utils.formatEther(totalGains.sub(totalLosses)),
            reportCount: recentEvents.length
        };
    }
}
```

### 4. Portfolio Management Integration

```javascript
class PortfolioManager {
    constructor(userAddress, provider) {
        this.userAddress = userAddress;
        this.provider = provider;
        this.positions = new Map();
    }
    
    async loadPortfolio() {
        // Discover all vaults user has positions in
        const factoryAddresses = ["0x..."]; // Known factory addresses
        
        for (const factoryAddress of factoryAddresses) {
            const factory = new ethers.Contract(factoryAddress, factoryABI, this.provider);
            const vaultAddresses = await factory.getVaults();
            
            for (const vaultAddress of vaultAddresses) {
                const vault = new ethers.Contract(vaultAddress, vaultABI, this.provider);
                const balance = await vault.balanceOf(this.userAddress);
                
                if (balance.gt(0)) {
                    const position = await this.getPositionDetails(vault);
                    this.positions.set(vaultAddress, position);
                }
            }
        }
        
        return Array.from(this.positions.values());
    }
    
    async getPositionDetails(vault) {
        const [
            shares,
            assetValue,
            asset,
            name,
            pricePerShare
        ] = await Promise.all([
            vault.balanceOf(this.userAddress),
            vault.maxWithdraw(this.userAddress, 0, []),
            vault.asset(),
            vault.name(),
            vault.pricePerShare()
        ]);
        
        const assetContract = new ethers.Contract(asset, erc20ABI, this.provider);
        const [symbol, decimals] = await Promise.all([
            assetContract.symbol(),
            assetContract.decimals()
        ]);
        
        return {
            vaultAddress: vault.address,
            vaultName: name,
            assetAddress: asset,
            assetSymbol: symbol,
            shares: ethers.utils.formatEther(shares),
            assetValue: ethers.utils.formatUnits(assetValue, decimals),
            pricePerShare: ethers.utils.formatEther(pricePerShare)
        };
    }
    
    async getPortfolioMetrics() {
        const positions = await this.loadPortfolio();
        
        let totalValue = 0;
        const assetBreakdown = {};
        
        for (const position of positions) {
            const value = parseFloat(position.assetValue);
            totalValue += value;
            
            if (!assetBreakdown[position.assetSymbol]) {
                assetBreakdown[position.assetSymbol] = 0;
            }
            assetBreakdown[position.assetSymbol] += value;
        }
        
        return {
            totalValue,
            positionCount: positions.length,
            assetBreakdown,
            positions
        };
    }
    
    async trackPerformance(days = 30) {
        const positions = await this.loadPortfolio();
        const performance = {};
        
        for (const position of positions) {
            const vault = new ethers.Contract(position.vaultAddress, vaultABI, this.provider);
            const currentPPS = await vault.pricePerShare();
            const historicalPPS = await this.getHistoricalPPS(position.vaultAddress, days);
            
            if (historicalPPS) {
                const growth = currentPPS.sub(historicalPPS).mul(10000).div(historicalPPS);
                performance[position.vaultAddress] = {
                    vaultName: position.vaultName,
                    growthBps: growth.toNumber(),
                    growthPercent: growth.toNumber() / 100
                };
            }
        }
        
        return performance;
    }
}
```

## Advanced Integration Patterns

### 1. Automated Rebalancing Bot

```javascript
class RebalancingBot {
    constructor(vaultAddress, signer, config) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, signer);
        this.config = config;
        this.running = false;
    }
    
    async start() {
        this.running = true;
        
        while (this.running) {
            try {
                await this.performRebalancing();
                await this.sleep(this.config.checkInterval);
            } catch (error) {
                console.error("Rebalancing error:", error);
                await this.sleep(this.config.errorRetryInterval);
            }
        }
    }
    
    async performRebalancing() {
        const strategies = await this.getActiveStrategies();
        const currentAllocations = await this.getCurrentAllocations(strategies);
        const targetAllocations = await this.calculateTargetAllocations(strategies);
        
        for (const [strategyAddress, target] of Object.entries(targetAllocations)) {
            const current = currentAllocations[strategyAddress];
            const deviation = Math.abs(target - current);
            
            if (deviation > this.config.rebalanceThreshold) {
                await this.rebalanceStrategy(strategyAddress, target);
                console.log(`Rebalanced ${strategyAddress}: ${current}% -> ${target}%`);
            }
        }
    }
    
    async calculateTargetAllocations(strategies) {
        const allocations = {};
        const totalWeight = strategies.reduce((sum, s) => sum + s.weight, 0);
        
        for (const strategy of strategies) {
            allocations[strategy.address] = (strategy.weight / totalWeight) * 100;
        }
        
        return allocations;
    }
    
    async rebalanceStrategy(strategyAddress, targetPercent) {
        const totalAssets = await this.vault.totalAssets();
        const targetDebt = totalAssets.mul(targetPercent).div(100);
        
        const tx = await this.vault.updateDebt(strategyAddress, targetDebt);
        await tx.wait();
    }
}
```

### 2. Risk Monitoring System

```javascript
class RiskMonitor {
    constructor(vaultAddress, alertConfig) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, provider);
        this.alerts = alertConfig;
        this.metrics = new Map();
    }
    
    async startMonitoring() {
        setInterval(() => this.checkRiskMetrics(), 60000); // Check every minute
        
        // Listen for events
        this.vault.on('StrategyReported', this.handleStrategyReport.bind(this));
        this.vault.on('DebtUpdated', this.handleDebtUpdate.bind(this));
    }
    
    async checkRiskMetrics() {
        const [
            totalAssets,
            totalDebt,
            totalIdle,
            strategies
        ] = await Promise.all([
            this.vault.totalAssets(),
            this.vault.totalDebt(),
            this.vault.totalIdle(),
            this.getActiveStrategies()
        ]);
        
        // Calculate utilization ratio
        const utilizationRatio = totalDebt.mul(100).div(totalAssets);
        
        if (utilizationRatio.gt(this.alerts.maxUtilization)) {
            await this.sendAlert('HIGH_UTILIZATION', {
                current: utilizationRatio.toNumber(),
                threshold: this.alerts.maxUtilization
            });
        }
        
        // Check individual strategy concentrations
        for (const strategy of strategies) {
            const concentration = strategy.currentDebt.mul(100).div(totalAssets);
            
            if (concentration.gt(this.alerts.maxConcentration)) {
                await this.sendAlert('HIGH_CONCENTRATION', {
                    strategy: strategy.address,
                    concentration: concentration.toNumber(),
                    threshold: this.alerts.maxConcentration
                });
            }
        }
        
        // Check for unrealized losses
        await this.checkUnrealizedLosses(strategies);
    }
    
    async checkUnrealizedLosses(strategies) {
        for (const strategy of strategies) {
            const unrealizedLoss = await this.vault.assessShareOfUnrealisedLosses(
                strategy.address,
                strategy.currentDebt
            );
            
            if (unrealizedLoss.gt(0)) {
                const lossPercent = unrealizedLoss.mul(100).div(strategy.currentDebt);
                
                if (lossPercent.gt(this.alerts.maxUnrealizedLoss)) {
                    await this.sendAlert('UNREALIZED_LOSS', {
                        strategy: strategy.address,
                        lossPercent: lossPercent.toNumber(),
                        threshold: this.alerts.maxUnrealizedLoss
                    });
                }
            }
        }
    }
    
    async sendAlert(type, data) {
        console.log(`ALERT [${type}]:`, data);
        
        // Send to external monitoring service
        if (this.alerts.webhook) {
            await this.sendWebhookAlert(type, data);
        }
        
        // Send email notification
        if (this.alerts.email) {
            await this.sendEmailAlert(type, data);
        }
    }
}
```

### 3. Analytics and Reporting

```javascript
class VaultAnalytics {
    constructor(vaultAddress, provider) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, provider);
        this.provider = provider;
    }
    
    async generatePerformanceReport(startBlock, endBlock) {
        const events = await this.vault.queryFilter(
            this.vault.filters.StrategyReported(),
            startBlock,
            endBlock
        );
        
        let totalGains = ethers.BigNumber.from(0);
        let totalLosses = ethers.BigNumber.from(0);
        let totalFees = ethers.BigNumber.from(0);
        
        const strategyPerformance = {};
        
        for (const event of events) {
            const { strategy, gain, loss, totalFees: fees } = event.args;
            
            totalGains = totalGains.add(gain);
            totalLosses = totalLosses.add(loss);
            totalFees = totalFees.add(fees);
            
            if (!strategyPerformance[strategy]) {
                strategyPerformance[strategy] = {
                    gains: ethers.BigNumber.from(0),
                    losses: ethers.BigNumber.from(0),
                    fees: ethers.BigNumber.from(0),
                    reports: 0
                };
            }
            
            strategyPerformance[strategy].gains = strategyPerformance[strategy].gains.add(gain);
            strategyPerformance[strategy].losses = strategyPerformance[strategy].losses.add(loss);
            strategyPerformance[strategy].fees = strategyPerformance[strategy].fees.add(fees);
            strategyPerformance[strategy].reports += 1;
        }
        
        return {
            overview: {
                totalGains: ethers.utils.formatEther(totalGains),
                totalLosses: ethers.utils.formatEther(totalLosses),
                netPerformance: ethers.utils.formatEther(totalGains.sub(totalLosses)),
                totalFees: ethers.utils.formatEther(totalFees)
            },
            strategies: strategyPerformance,
            reportCount: events.length
        };
    }
    
    async calculateMetrics(days = 30) {
        const endBlock = await this.provider.getBlockNumber();
        const startBlock = endBlock - Math.floor(days * 24 * 60 * 60 / 15); // Approximate blocks
        
        const [
            performanceReport,
            currentState,
            priceHistory
        ] = await Promise.all([
            this.generatePerformanceReport(startBlock, endBlock),
            this.getCurrentState(),
            this.getPriceHistory(days)
        ]);
        
        return {
            performance: performanceReport,
            currentState,
            priceHistory,
            metrics: this.calculateDerivedMetrics(performanceReport, currentState, priceHistory)
        };
    }
    
    calculateDerivedMetrics(performance, state, priceHistory) {
        // Sharpe ratio approximation
        const dailyReturns = this.calculateDailyReturns(priceHistory);
        const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const volatility = this.calculateVolatility(dailyReturns);
        const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
        
        // Maximum drawdown
        const maxDrawdown = this.calculateMaxDrawdown(priceHistory);
        
        // Win rate
        const positiveReturns = dailyReturns.filter(r => r > 0).length;
        const winRate = positiveReturns / dailyReturns.length;
        
        return {
            sharpeRatio,
            maxDrawdown,
            winRate,
            avgDailyReturn: avgReturn,
            volatility
        };
    }
}
```

## Best Practices

### 1. Error Handling

```javascript
class RobustVaultInteraction {
    constructor(vaultAddress, signer) {
        this.vault = new ethers.Contract(vaultAddress, vaultABI, signer);
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
        };
    }
    
    async safeCall(method, ...args) {
        let lastError;
        
        for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
            try {
                return await this.vault[method](...args);
            } catch (error) {
                lastError = error;
                
                if (this.isRetryableError(error)) {
                    const delay = Math.min(
                        this.retryConfig.baseDelay * Math.pow(2, attempt),
                        this.retryConfig.maxDelay
                    );
                    await this.sleep(delay);
                    continue;
                }
                
                throw error; // Non-retryable error
            }
        }
        
        throw lastError;
    }
    
    isRetryableError(error) {
        const retryableCodes = [
            'NETWORK_ERROR',
            'SERVER_ERROR', 
            'TIMEOUT',
            'UNPREDICTABLE_GAS_LIMIT'
        ];
        
        return retryableCodes.some(code => error.code === code);
    }
    
    async safeDeposit(amount) {
        try {
            // Pre-flight checks
            await this.validateDeposit(amount);
            
            // Execute with retry logic
            return await this.safeCall('deposit', amount, this.vault.signer.address);
        } catch (error) {
            console.error('Deposit failed:', error);
            throw new Error(`Deposit failed: ${error.message}`);
        }
    }
    
    async validateDeposit(amount) {
        const [maxDeposit, allowance] = await Promise.all([
            this.vault.maxDeposit(this.vault.signer.address),
            this.getAssetAllowance()
        ]);
        
        if (amount.gt(maxDeposit)) {
            throw new Error(`Amount exceeds deposit limit: ${ethers.utils.formatEther(maxDeposit)}`);
        }
        
        if (allowance.lt(amount)) {
            throw new Error('Insufficient allowance');
        }
    }
}
```

### 2. Gas Optimization

```javascript
class GasOptimizedOperations {
    constructor(vault, gasConfig) {
        this.vault = vault;
        this.gasConfig = gasConfig;
    }
    
    async estimateOperationCost(operation, ...args) {
        try {
            const gasEstimate = await this.vault.estimateGas[operation](...args);
            const gasPrice = await this.vault.provider.getGasPrice();
            
            return {
                gasLimit: gasEstimate.mul(110).div(100), // 10% buffer
                gasPrice: gasPrice,
                estimatedCost: gasEstimate.mul(gasPrice)
            };
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return this.getFallbackGasConfig(operation);
        }
    }
    
    async executeWithOptimalGas(operation, args, options = {}) {
        const gasConfig = await this.estimateOperationCost(operation, ...args);
        
        // Use EIP-1559 if supported
        if (options.useEIP1559) {
            const feeData = await this.vault.provider.getFeeData();
            return await this.vault[operation](...args, {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                gasLimit: gasConfig.gasLimit
            });
        }
        
        return await this.vault[operation](...args, {
            gasPrice: gasConfig.gasPrice,
            gasLimit: gasConfig.gasLimit
        });
    }
    
    async batchOperations(operations) {
        // Group operations to minimize gas costs
        const batches = this.groupOperations(operations);
        const results = [];
        
        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map(op => this.executeWithOptimalGas(op.method, op.args))
            );
            results.push(...batchResults);
        }
        
        return results;
    }
}
```

### 3. Testing Integration

```javascript
describe('Vault Integration Tests', () => {
    let vault, factory, accountant, strategy;
    let user, admin, strategist;
    
    beforeEach(async () => {
        // Deploy test infrastructure
        [user, admin, strategist] = await ethers.getSigners();
        
        factory = await deployFactory();
        accountant = await deployAccountant();
        strategy = await deployTestStrategy();
        
        vault = await deployVaultThroughFactory(factory, {
            admin: admin.address,
            accountant: accountant.address
        });
        
        await setupTestEnvironment(vault, strategy, user);
    });
    
    it('should handle complete user journey', async () => {
        // User deposits
        const depositAmount = ethers.utils.parseEther('1000');
        await vault.connect(user).deposit(depositAmount, user.address);
        
        // Strategy generates yield
        await simulateStrategyGains(strategy, ethers.utils.parseEther('100'));
        await vault.processReport(strategy.address);
        
        // User withdraws with profit
        const initialShares = await vault.balanceOf(user.address);
        const withdrawAmount = ethers.utils.parseEther('500');
        
        await vault.connect(user).withdraw(
            withdrawAmount,
            user.address,
            user.address,
            100, // 1% max loss
            []
        );
        
        const finalShares = await vault.balanceOf(user.address);
        const pricePerShare = await vault.pricePerShare();
        
        // Verify profit was distributed
        expect(pricePerShare).to.be.gt(ethers.utils.parseEther('1'));
        expect(finalShares).to.be.lt(initialShares);
    });
    
    it('should handle edge cases and error conditions', async () => {
        // Test deposit limits
        const excessiveAmount = ethers.utils.parseEther('1000000');
        await expect(
            vault.connect(user).deposit(excessiveAmount, user.address)
        ).to.be.revertedWith('ExceedDepositLimit');
        
        // Test withdrawal limits
        await expect(
            vault.connect(user).withdraw(
                ethers.utils.parseEther('1'),
                user.address,
                user.address,
                0,
                []
            )
        ).to.be.revertedWith('InsufficientShares');
    });
});
```

## Security Considerations

### 1. Input Validation

```javascript
function validateAddress(address) {
    if (!ethers.utils.isAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
    }
}

function validateAmount(amount, decimals = 18) {
    if (amount.lt(0)) {
        throw new Error('Amount cannot be negative');
    }
    
    if (amount.eq(0)) {
        throw new Error('Amount cannot be zero');
    }
    
    const maxValue = ethers.BigNumber.from(10).pow(decimals + 10); // Reasonable max
    if (amount.gt(maxValue)) {
        throw new Error('Amount exceeds maximum value');
    }
}
```

### 2. Access Control

```javascript
class SecureVaultManager {
    constructor(vault, authorizedUsers) {
        this.vault = vault;
        this.authorizedUsers = new Set(authorizedUsers.map(addr => addr.toLowerCase()));
    }
    
    async executeAdminOperation(operation, args, signer) {
        const signerAddress = await signer.getAddress();
        
        if (!this.authorizedUsers.has(signerAddress.toLowerCase())) {
            throw new Error('Unauthorized user');
        }
        
        // Add additional security checks
        await this.validateOperation(operation, args);
        
        return await this.vault.connect(signer)[operation](...args);
    }
    
    async validateOperation(operation, args) {
        // Implement operation-specific validation
        switch (operation) {
            case 'addStrategy':
                await this.validateStrategy(args[0]);
                break;
            case 'updateMaxDebtForStrategy':
                await this.validateDebtUpdate(args[0], args[1]);
                break;
            default:
                // Generic validation
                break;
        }
    }
}
```

## Conclusion

This integration guide provides a comprehensive foundation for building applications on the Fathom Vault ecosystem. The patterns and examples shown here can be adapted and extended for various use cases while maintaining security and efficiency standards.

Key takeaways:
- Always implement proper error handling and retry logic
- Use gas optimization techniques for cost-effective operations
- Implement comprehensive testing for all integration points
- Follow security best practices for access control and input validation
- Monitor system health and performance continuously

For additional support and advanced integration patterns, refer to the individual component documentation and community resources. 