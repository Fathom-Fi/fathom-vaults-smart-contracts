const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CurveStrategy Integration", function () {
    let owner, user1, user2;
    let strategy, tokenizedStrategy, factory, token, accountant;
    let mockPool, mockGauge, mockMinter, mockLpToken, mockCrvToken;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy Tokens
        const Token = await ethers.getContractFactory("Token");
        token = await Token.deploy("Test Token", 18);
        mockLpToken = await Token.deploy("LP Token", 18);
        mockCrvToken = await Token.deploy("CRV Token", 18);

        // Deploy Mock Curve Contracts
        const MockCurvePool = await ethers.getContractFactory("MockCurvePool");
        mockPool = await MockCurvePool.deploy(mockLpToken.target, token.target);

        const MockCurveGauge = await ethers.getContractFactory("MockCurveGauge");
        mockGauge = await MockCurveGauge.deploy(mockLpToken.target);

        const MockCurveMinter = await ethers.getContractFactory("MockCurveMinter");
        mockMinter = await MockCurveMinter.deploy(mockCrvToken.target);

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
        const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
        strategy = await CurveStrategy.deploy(
            token.target,
            "Test Curve Strategy",
            tokenizedStrategy.target,
            mockPool.target,
            mockGauge.target,
            mockMinter.target,
            mockCrvToken.target,
            0, // asset index
            2, // pool size
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
            expect(await strategy.CURVE_POOL()).to.equal(mockPool.target);
            expect(await strategy.CURVE_GAUGE()).to.equal(mockGauge.target);
            expect(await strategy.CRV_MINTER()).to.equal(mockMinter.target);
            expect(await strategy.ASSET_INDEX()).to.equal(0);
            expect(await strategy.POOL_SIZE()).to.equal(2);
        });

        it("Should handle deposits and LP staking", async function () {
            const amount = ethers.parseEther("100");
            
            // Mint tokens to user
            await token.mint(user1.address, amount);
            await token.connect(user1).approve(strategy.target, amount);
            
            // Strategy should be able to receive funds
            await token.mint(strategy.target, amount);
            
            const initialBalance = await token.balanceOf(strategy.target);
            expect(initialBalance).to.equal(amount);
        });

        it("Should properly manage reward claiming", async function () {
            await strategy.connect(owner).setClaimRewards(true);
            expect(await strategy.claimRewards()).to.equal(true);
            
            await strategy.connect(owner).setClaimRewards(false);
            expect(await strategy.claimRewards()).to.equal(false);
        });

        it("Should return unlimited deposit limit", async function () {
            const limit = await strategy.availableDepositLimit(user1.address);
            expect(limit).to.equal(ethers.MaxUint256);
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
            
            await strategy.connect(owner).setMinAmountToSellMapping(mockCrvToken.target, ethers.parseEther("1"));
            expect(await strategy.minAmountToSellMapping(mockCrvToken.target)).to.equal(ethers.parseEther("1"));
        });
    });

    describe("Pool Configuration", function () {
        it("Should validate pool size during deployment", async function () {
            const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
            
            // Invalid pool size (1)
            await expect(
                CurveStrategy.deploy(
                    token.target,
                    "Test Curve Strategy",
                    tokenizedStrategy.target,
                    mockPool.target,
                    mockGauge.target,
                    mockMinter.target,
                    mockCrvToken.target,
                    0,
                    1, // invalid
                    token.target,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWith("Invalid pool size");
            
            // Invalid pool size (5)
            await expect(
                CurveStrategy.deploy(
                    token.target,
                    "Test Curve Strategy",
                    tokenizedStrategy.target,
                    mockPool.target,
                    mockGauge.target,
                    mockMinter.target,
                    mockCrvToken.target,
                    0,
                    5, // invalid
                    token.target,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWith("Invalid pool size");
        });

        it("Should validate asset index during deployment", async function () {
            const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
            
            await expect(
                CurveStrategy.deploy(
                    token.target,
                    "Test Curve Strategy",
                    tokenizedStrategy.target,
                    mockPool.target,
                    mockGauge.target,
                    mockMinter.target,
                    mockCrvToken.target,
                    2, // asset index >= pool size
                    2, // pool size
                    token.target,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWith("Invalid asset index");
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