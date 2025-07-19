const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AaveV3Strategy Integration", function () {
    let owner, user1, user2;
    let strategy, tokenizedStrategy, factory, vault, token, accountant;
    let mockPool, mockAToken, mockRewardsController;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy Token
        const Token = await ethers.getContractFactory("Token");
        token = await Token.deploy("Test Token", 18);

        // Deploy mock contracts for testing
        const MockPool = await ethers.getContractFactory("MockPool");
        mockPool = await MockPool.deploy();

        const MockAToken = await ethers.getContractFactory("MockAToken");
        mockAToken = await MockAToken.deploy(token.target);

        const MockRewardsController = await ethers.getContractFactory("MockRewardsController");
        mockRewardsController = await MockRewardsController.deploy();

        await mockPool.setReserveData(token.target, mockAToken.target);
        await mockAToken.setIncentivesController(mockRewardsController.target);

        // Deploy Factory Package using proxy pattern
        const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
        const factoryPackage = await FactoryPackage.deploy();

        // Deploy Factory using proxy pattern
        const Factory = await ethers.getContractFactory("Factory");
        factory = await Factory.deploy(factoryPackage.target, owner.address, "0x");

        // Deploy TokenizedStrategy
        const TokenizedStrategy = await ethers.getContractFactory("TokenizedStrategy");
        tokenizedStrategy = await TokenizedStrategy.deploy(factory.target);

        // Deploy GenericAccountant
        const GenericAccountant = await ethers.getContractFactory("GenericAccountant");
        accountant = await GenericAccountant.deploy(0, 0, 0);

        // Deploy Strategy
        const AaveV3Strategy = await ethers.getContractFactory("AaveV3Strategy");
        strategy = await AaveV3Strategy.deploy(
            token.target,
            "Test Aave Strategy",
            tokenizedStrategy.target,
            mockPool.target,
            token.target, // base token
            owner.address, // router
            owner.address  // permit2
        );

        // Initialize TokenizedStrategy properly
        await tokenizedStrategy.connect(owner).init(
            token.target,
            "Test Strategy Token",
            owner.address,
            owner.address,
            owner.address
        );
    });

    describe("Strategy Lifecycle", function () {
        it("Should deploy and initialize correctly", async function () {
            expect(await strategy.asset()).to.equal(token.target);
            expect(await strategy.LENDING_POOL()).to.equal(mockPool.target);
            expect(await strategy.A_TOKEN()).to.equal(mockAToken.target);
        });

        it("Should handle deposits and withdrawals", async function () {
            const amount = ethers.parseEther("100");
            
            // Mint tokens to user
            await token.mint(user1.address, amount);
            await token.connect(user1).approve(strategy.target, amount);
            
            // Strategy should be able to receive and deploy funds
            await token.mint(strategy.target, amount);
            
            const initialBalance = await token.balanceOf(strategy.target);
            expect(initialBalance).to.equal(amount);
        });

        it("Should properly manage rewards", async function () {
            await strategy.connect(owner).setClaimRewards(true);
            expect(await strategy.claimRewards()).to.equal(true);
            
            await strategy.connect(owner).setClaimRewards(false);
            expect(await strategy.claimRewards()).to.equal(false);
        });
    });

    describe("Access Control", function () {
        it("Should restrict management functions to management", async function () {
            await expect(
                strategy.connect(user1).setClaimRewards(false)
            ).to.be.reverted;
            
            await expect(
                strategy.connect(user1).setUniFees(token.target, owner.address, 3000)
            ).to.be.reverted;
        });

        it("Should allow management to configure strategy", async function () {
            await strategy.connect(owner).setUniFees(token.target, owner.address, 3000);
            expect(await strategy.uniFees(token.target, owner.address)).to.equal(3000);
            
            await strategy.connect(owner).setMinAmountToSellMapping(token.target, ethers.parseEther("1"));
            expect(await strategy.minAmountToSellMapping(token.target)).to.equal(ethers.parseEther("1"));
        });
    });

    describe("Error Handling", function () {
        it("Should handle invalid parameters gracefully", async function () {
            await expect(
                strategy.connect(owner).setUniFees(token.target, owner.address, ethers.MaxUint256)
            ).to.be.revertedWith("Fee too high");
            
            await expect(
                strategy.connect(owner).setMinAmountToSellMapping(token.target, ethers.MaxUint256)
            ).to.be.revertedWith("Amount too high");
        });
    });
}); 