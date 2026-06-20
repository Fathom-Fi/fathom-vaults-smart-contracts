const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

async function deployCurveStrategyFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy Token
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Test Token", 18, { gasLimit: "0x1000000" });
    const mockLpToken = await Token.deploy("LP Token", 18, { gasLimit: "0x1000000" });
    const mockCrvToken = await Token.deploy("CRV Token", 18, { gasLimit: "0x1000000" });

    // Deploy Mock Contracts
    const MockCurvePool = await ethers.getContractFactory("MockCurvePool");
    const mockPool = await MockCurvePool.deploy(mockLpToken.target, token.target, { gasLimit: "0x1000000" });

    const MockCurveGauge = await ethers.getContractFactory("MockCurveGauge");
    const mockGauge = await MockCurveGauge.deploy(mockLpToken.target, { gasLimit: "0x1000000" });

    const MockCurveMinter = await ethers.getContractFactory("MockCurveMinter");
    const mockMinter = await MockCurveMinter.deploy(mockCrvToken.target, { gasLimit: "0x1000000" });

    // Deploy Factory Package
    const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
    const factoryPackage = await FactoryPackage.deploy({ gasLimit: "0x1000000" });

    // Deploy Factory
    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy(factoryPackage.target, owner.address, "0x", { gasLimit: "0x1000000" });

    // Deploy TokenizedStrategy
    const TokenizedStrategy = await ethers.getContractFactory("TokenizedStrategy");
    const tokenizedStrategy = await TokenizedStrategy.deploy(factory.target, { gasLimit: "0x1000000" });

    // Deploy GenericAccountant
    const GenericAccountant = await ethers.getContractFactory("GenericAccountant");
    const accountant = await GenericAccountant.deploy(0, 0, 0, { gasLimit: "0x1000000" });

    // Deploy Strategy
    const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
    const strategy = await CurveStrategy.deploy(
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
        owner.address,  // permit2
        { gasLimit: "0x1000000" }
    );

    return {
        strategy, token, mockLpToken, mockCrvToken, mockPool, mockGauge, mockMinter,
        factory, tokenizedStrategy, accountant, owner, user1, user2
    };
}

describe("CurveStrategy", function () {
    describe("Constructor", function () {
        it("Should set correct parameters", async function () {
            const { strategy, token, mockPool, mockGauge, mockMinter, mockCrvToken } = await loadFixture(deployCurveStrategyFixture);

            expect(await strategy.asset()).to.equal(token.target);
            expect(await strategy.CURVE_POOL()).to.equal(mockPool.target);
            expect(await strategy.CURVE_GAUGE()).to.equal(mockGauge.target);
            expect(await strategy.CRV_MINTER()).to.equal(mockMinter.target);
            expect(await strategy.CRV_TOKEN()).to.equal(mockCrvToken.target);
            expect(await strategy.ASSET_INDEX()).to.equal(0);
            expect(await strategy.POOL_SIZE()).to.equal(2);
        });

        it("Should revert with invalid pool size", async function () {
            const [owner] = await ethers.getSigners();
            
            const Token = await ethers.getContractFactory("Token");
            const token = await Token.deploy("Test Token", 18);
            const mockLpToken = await Token.deploy("LP Token", 18);
            const mockCrvToken = await Token.deploy("CRV Token", 18);

            const MockCurvePool = await ethers.getContractFactory("MockCurvePool");
            const mockPool = await MockCurvePool.deploy(mockLpToken.target, token.target);

            const MockCurveGauge = await ethers.getContractFactory("MockCurveGauge");
            const mockGauge = await MockCurveGauge.deploy(mockLpToken.target);

            const MockCurveMinter = await ethers.getContractFactory("MockCurveMinter");
            const mockMinter = await MockCurveMinter.deploy(mockCrvToken.target);

            const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
            const factoryPackage = await FactoryPackage.deploy();

            const Factory = await ethers.getContractFactory("Factory");
            const factory = await Factory.deploy(factoryPackage.target, owner.address, "0x");

            const TokenizedStrategy = await ethers.getContractFactory("TokenizedStrategy");
            const tokenizedStrategy = await TokenizedStrategy.deploy(factory.target);

            const CurveStrategy = await ethers.getContractFactory("CurveStrategy");

            await expect(CurveStrategy.deploy(
                token.target,
                "Test Curve Strategy",
                tokenizedStrategy.target,
                mockPool.target,
                mockGauge.target,
                mockMinter.target,
                mockCrvToken.target,
                0,
                1, // Invalid pool size
                token.target,
                owner.address,
                owner.address
            )).to.be.revertedWith("Invalid pool size");
        });

        it("Should revert with invalid asset index", async function () {
            const [owner] = await ethers.getSigners();
            
            const Token = await ethers.getContractFactory("Token");
            const token = await Token.deploy("Test Token", 18);
            const mockLpToken = await Token.deploy("LP Token", 18);
            const mockCrvToken = await Token.deploy("CRV Token", 18);

            const MockCurvePool = await ethers.getContractFactory("MockCurvePool");
            const mockPool = await MockCurvePool.deploy(mockLpToken.target, token.target);

            const MockCurveGauge = await ethers.getContractFactory("MockCurveGauge");
            const mockGauge = await MockCurveGauge.deploy(mockLpToken.target);

            const MockCurveMinter = await ethers.getContractFactory("MockCurveMinter");
            const mockMinter = await MockCurveMinter.deploy(mockCrvToken.target);

            const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
            const factoryPackage = await FactoryPackage.deploy();

            const Factory = await ethers.getContractFactory("Factory");
            const factory = await Factory.deploy(factoryPackage.target, owner.address, "0x");

            const TokenizedStrategy = await ethers.getContractFactory("TokenizedStrategy");
            const tokenizedStrategy = await TokenizedStrategy.deploy(factory.target);

            const CurveStrategy = await ethers.getContractFactory("CurveStrategy");

            await expect(CurveStrategy.deploy(
                token.target,
                "Test Curve Strategy",
                tokenizedStrategy.target,
                mockPool.target,
                mockGauge.target,
                mockMinter.target,
                mockCrvToken.target,
                2, // Invalid asset index (>= pool size)
                2, // pool size
                token.target,
                owner.address,
                owner.address
            )).to.be.revertedWith("Invalid asset index");
        });
    });

    describe("Management Functions", function () {
        it("Should allow manager to toggle claim rewards", async function () {
            const { strategy, owner } = await loadFixture(deployCurveStrategyFixture);

            // Initially should be true
            expect(await strategy.claimRewards()).to.be.true;

            // Toggle to false
            await strategy.connect(owner).setClaimRewards(false);
            expect(await strategy.claimRewards()).to.be.false;

            // Toggle back to true
            await strategy.connect(owner).setClaimRewards(true);
            expect(await strategy.claimRewards()).to.be.true;
        });

        it("Should allow manager to set minimum sell amounts", async function () {
            const { strategy, mockCrvToken, owner } = await loadFixture(deployCurveStrategyFixture);

            const minAmount = ethers.parseEther("100");

            await strategy.connect(owner).setMinAmountToSell(mockCrvToken.target, minAmount);
            expect(await strategy.minAmountToSellMapping(mockCrvToken.target)).to.equal(minAmount);
        });

        it("Should revert when non-manager tries to change settings", async function () {
            const { strategy, mockCrvToken, user1 } = await loadFixture(deployCurveStrategyFixture);

            await expect(
                strategy.connect(user1).setClaimRewards(false)
            ).to.be.reverted;

            await expect(
                strategy.connect(user1).setMinAmountToSell(mockCrvToken.target, ethers.parseEther("100"))
            ).to.be.reverted;
        });
    });

    describe("Access Control", function () {
        it("Should only allow authorized users to call restricted functions", async function () {
            const { strategy, user1 } = await loadFixture(deployCurveStrategyFixture);

            // These should revert when called by unauthorized user
            await expect(strategy.connect(user1).setClaimRewards(false)).to.be.reverted;
            await expect(strategy.connect(user1).emergencyWithdraw(100)).to.be.reverted;
        });
    });
}); 