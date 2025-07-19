const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UniswapV3Provider Integration Tests", function () {
  let deployer, user;
  let strategy, asset, pairedToken;

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy mock asset
    const MockERC20 = await ethers.getContractFactory("Token");
    asset = await MockERC20.deploy("USDC", 6);
    
    // Mint tokens for testing
    await asset.mint(deployer.address, ethers.parseUnits("1000000", 6));

    // Deploy mock paired token (WETH)
    const mockPairedToken = await ethers.getContractFactory("Token");
    pairedToken = await mockPairedToken.deploy("WETH", 18);

    // Deploy Factory (needed for TokenizedStrategy)
    const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
    const factoryPackage = await FactoryPackage.deploy();

    const Factory = await ethers.getContractFactory("Factory");
    const factoryProxy = await Factory.deploy(factoryPackage.target, deployer.address, "0x");

    // Deploy TokenizedStrategy
    const TokenizedStrategy = await ethers.getContractFactory("TokenizedStrategy");
    const tokenizedStrategy = await TokenizedStrategy.deploy(factoryProxy.target);

    // Deploy UniswapV3Provider strategy with mock addresses
    const UniswapV3Provider = await ethers.getContractFactory("UniswapV3Provider");
    strategy = await UniswapV3Provider.deploy(
      asset.target,                                     // _asset
      "UniswapV3Provider Strategy",                     // _name
      tokenizedStrategy.target,                         // _tokenizedStrategyAddress
      "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",     // _positionManager
      "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",     // _pool (mock pool address)
      pairedToken.target,                               // _pairedToken
      500,                                              // _poolFee
      deployer.address,                                 // _base (mock)
      deployer.address,                                 // _router (mock)  
      deployer.address                                  // _permit2 (mock)
    );
  });

  it("Should deploy successfully and have correct parameters", async function () {
    expect(strategy.target).to.not.equal(ethers.ZeroAddress);
    expect(await strategy.asset()).to.equal(asset.target);
    expect(await strategy.name()).to.equal("UniswapV3Provider Strategy");
  });

  it("Should handle basic strategy operations", async function () {
    const amount = ethers.parseUnits("1000", 6); // 1k USDC
    
    // Transfer some tokens to strategy for testing
    await asset.transfer(strategy.target, amount);
    
    // Check strategy balance
    expect(await asset.balanceOf(strategy.target)).to.equal(amount);
    
    // Check that strategy has unlimited deposit limit
    expect(await strategy.availableDepositLimit(deployer.address)).to.equal(ethers.MaxUint256);
  });

  it("Should allow management functions", async function () {
    // Test setting fee tier (only management should be able to do this)
    await strategy.setFeeTier(3000); // 0.3% fee tier
    
    // Test setting price range (only management should be able to do this)  
    await strategy.setPriceRange(2000, 4000); // -20% to +40% range
  });

  it("Should reject unauthorized access", async function () {
    // Non-management user should not be able to change settings
    await expect(
      strategy.connect(user).setFeeTier(3000)
    ).to.be.reverted;
    
    await expect(
      strategy.connect(user).setPriceRange(2000, 4000)
    ).to.be.reverted;
  });

  it("Should handle position management configuration", async function () {
    // Test setting rebalance threshold
    await strategy.setRebalanceThreshold(500); // 5% threshold
    
    // Test setting auto-rebalance
    await strategy.setAutoRebalance(true);
    expect(await strategy.autoRebalance()).to.equal(true);
  });
}); 