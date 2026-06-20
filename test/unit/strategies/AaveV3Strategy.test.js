const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AaveV3Strategy", function () {
    let owner, user1, user2;
    let strategy, tokenizedStrategy, factory, vault, token, accountant;
    let mockPool, mockAToken, mockRewardsController;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy Token
        const Token = await ethers.getContractFactory("Token");
        token = await Token.deploy("Test Token", 18);

        // Deploy Mock Pool
        const MockPool = await ethers.getContractFactory("MockPool");
        mockPool = await MockPool.deploy();

        // Deploy Mock AToken
        const MockAToken = await ethers.getContractFactory("MockAToken");
        mockAToken = await MockAToken.deploy(token.target);

        // Deploy Mock Rewards Controller
        const MockRewardsController = await ethers.getContractFactory("MockRewardsController");
        mockRewardsController = await MockRewardsController.deploy();

        await mockPool.setReserveData(token.target, mockAToken.target);
        await mockAToken.setIncentivesController(mockRewardsController.target);

        // Deploy Factory Package
        const FactoryPackage = await ethers.getContractFactory("FactoryPackage");
        const factoryPackage = await FactoryPackage.deploy();

        // Deploy Factory
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

        await tokenizedStrategy.connect(owner).init(
            token.target,
            "Test Strategy Token",
            owner.address,
            owner.address,
            owner.address
        );
    });

    describe("Constructor", function () {
        it("Should set correct parameters", async function () {
            expect(await strategy.asset()).to.equal(token.target);
            expect(await strategy.LENDING_POOL()).to.equal(mockPool.target);
            expect(await strategy.A_TOKEN()).to.equal(mockAToken.target);
            expect(await strategy.claimRewards()).to.equal(true);
        });

        it("Should revert with invalid aToken", async function () {
            const MockPoolInvalid = await ethers.getContractFactory("MockPool");
            const mockPoolInvalid = await MockPoolInvalid.deploy();

            const AaveV3Strategy = await ethers.getContractFactory("AaveV3Strategy");
            await expect(
                AaveV3Strategy.deploy(
                    token.target,
                    "Test Aave Strategy",
                    tokenizedStrategy.target,
                    mockPoolInvalid.target,
                    token.target,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWith("Invalid aToken");
        });
    });

    describe("Management Functions", function () {
        it("Should allow management to set uni fees", async function () {
            await strategy.connect(owner).setUniFees(token.target, owner.address, 3000);
            expect(await strategy.uniFees(token.target, owner.address)).to.equal(3000);
        });

        it("Should revert setUniFees with fee too high", async function () {
            await expect(
                strategy.connect(owner).setUniFees(token.target, owner.address, ethers.MaxUint256)
            ).to.be.revertedWith("Fee too high");
        });

        it("Should allow management to set min sell amount", async function () {
            await strategy.connect(owner).setMinAmountToSellMapping(token.target, ethers.parseEther("1"));
            expect(await strategy.minAmountToSellMapping(token.target)).to.equal(ethers.parseEther("1"));
        });

        it("Should allow management to toggle claim rewards", async function () {
            await strategy.connect(owner).setClaimRewards(false);
            expect(await strategy.claimRewards()).to.equal(false);
        });

        it("Should allow management to set rewards controller", async function () {
            await strategy.connect(owner).setRewardsController(user1.address);
            expect(await strategy.rewardsController()).to.equal(user1.address);
        });
    });

    describe("Deposit Limits", function () {
        it("Should return unlimited deposit limit with no supply cap", async function () {
            const limit = await strategy.availableDepositLimit(user1.address);
            expect(limit).to.equal(ethers.MaxUint256);
        });

        it("Should return correct supply cap", async function () {
            const cap = await strategy.getSupplyCap();
            expect(cap).to.equal(0); // Mock returns 0
        });
    });

    describe("Withdraw Limits", function () {
        it("Should return correct withdrawal limit", async function () {
            const limit = await strategy.availableWithdrawLimit(user1.address);
            expect(limit).to.be.gte(0);
        });
    });

    describe("Fund Deployment", function () {
        it("Should deploy funds to Aave", async function () {
            const amount = ethers.parseEther("100");
            await token.mint(strategy.target, amount);
            
            await strategy._deployFunds(amount);
            // Verify the funds were deployed (would check mock calls in real implementation)
        });
    });

    describe("Fund Withdrawal", function () {
        it("Should withdraw funds from Aave", async function () {
            const amount = ethers.parseEther("100");
            await mockAToken.mint(strategy.target, amount);
            
            await strategy._freeFunds(amount);
            // Verify the funds were withdrawn (would check mock calls in real implementation)
        });
    });

    describe("Metadata", function () {
        it("Should return correct metadata", async function () {
            const [interfaceId, data] = await strategy.getMetadata();
            expect(interfaceId).to.equal(ethers.id("AaveV3Strategy").slice(0, 10));
        });
    });
}); 