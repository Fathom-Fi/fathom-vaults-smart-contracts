const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");
const { expect } = require("chai");

// Fixture for deploying a Vault with management fee support
async function deployVaultWithManagementFees() {
    const profitMaxUnlockTime = 30;
    const amount = "1000";

    const vaultName = 'Vault Shares FXD';
    const vaultSymbol = 'vFXD';
    const [deployer, manager, feeRecipient, otherAccount] = await ethers.getSigners();

    // Deploy MockERC20 as the asset
    const Asset = await ethers.getContractFactory("Token");
    const assetSymbol = 'FXD';
    const vaultDecimals = 18;
    const asset = await Asset.deploy(assetSymbol, vaultDecimals, { gasLimit: "0x1000000" });
    const assetType = 1;

    await asset.mint(deployer.address, ethers.parseEther(amount));

    const performanceFee = 100; // 1% of gain
    const protocolFee = 2000; // 20% of total fee

    const Accountant = await ethers.getContractFactory("GenericAccountant");
    const accountant = await Accountant.deploy(performanceFee, deployer.address, deployer.address, { gasLimit: "0x1000000" });

    // Deploy libraries
    const VaultLogic = await ethers.getContractFactory("VaultLogic");
    const vaultLogic = await VaultLogic.deploy({ gasLimit: "0x1000000" });

    // Deploy VaultPackage with VaultLogic library linked
    const VaultPackage = await ethers.getContractFactory("VaultPackage", {
        libraries: {
            "VaultLogic": vaultLogic.target,
        }
    });
    const vaultPackage = await VaultPackage.deploy({ gasLimit: "0x1000000" });

    const FathomVault = await ethers.getContractFactory("FathomVault");
    const fathomVault = await FathomVault.deploy(vaultPackage.target, "0x");

    const vault = await ethers.getContractAt("VaultPackage", fathomVault.target);

    // Initialize vault with manager as admin to avoid role conflict
    await vault.initialize(
        profitMaxUnlockTime,
        assetType,
        asset.target,
        vaultName,
        vaultSymbol,
        accountant.target,
        manager.address
    );

    const ONE_YEAR = 31_556_952;
    const MAX_BPS = 10000;

    return { 
        vault, 
        asset, 
        deployer, 
        manager, 
        feeRecipient, 
        otherAccount, 
        accountant,
        ONE_YEAR,
        MAX_BPS
    };
}

describe("Management Fees Tests", function () {

    describe("Management Fee Configuration", function () {
        it("Should initialize with default management fee configuration", async function () {
            const { vault } = await loadFixture(deployVaultWithManagementFees);

            const config = await vault.getManagementFeeConfig();
            expect(config.managementFeeRate).to.equal(0);
            expect(config.managementFeeRecipient).to.equal(ethers.ZeroAddress);
            expect(config.lastCollection).to.equal(0);
            expect(config.enabled).to.equal(false);
        });

        it("Should allow admin to set management fee configuration", async function () {
            const { vault, feeRecipient, manager } = await loadFixture(deployVaultWithManagementFees);

            const managementFeeRate = 200; // 2%
            await expect(vault.connect(manager).setManagementFeeConfig(managementFeeRate, feeRecipient.address, true))
                .to.emit(vault, "ManagementFeeConfigUpdated")
                .withArgs(managementFeeRate, feeRecipient.address, true);

            const config = await vault.getManagementFeeConfig();
            expect(config.managementFeeRate).to.equal(managementFeeRate);
            expect(config.managementFeeRecipient).to.equal(feeRecipient.address);
            expect(config.enabled).to.equal(true);
            expect(config.lastCollection).to.be.gt(0);
        });

        it("Should revert when management fee rate exceeds maximum", async function () {
            const { vault, feeRecipient, manager, MAX_BPS } = await loadFixture(deployVaultWithManagementFees);

            const excessiveFeeRate = MAX_BPS + 1;
            await expect(vault.connect(manager).setManagementFeeConfig(excessiveFeeRate, feeRecipient.address, true))
                .to.be.reverted;
        });

        it("Should revert when enabling fees with zero recipient address", async function () {
            const { vault, manager } = await loadFixture(deployVaultWithManagementFees);

            await expect(vault.connect(manager).setManagementFeeConfig(200, ethers.ZeroAddress, true))
                .to.be.reverted;
        });
    });

    describe("Management Fee Collection", function () {
        it("Should revert when trying to collect fees while disabled", async function () {
            const { vault } = await loadFixture(deployVaultWithManagementFees);

            await expect(vault.collectManagementFees())
                .to.be.reverted;
        });

        it("Should collect management fees when enabled", async function () {
            const { vault, feeRecipient, asset, manager } = await loadFixture(deployVaultWithManagementFees);

            // Enable management fees
            await vault.connect(manager).setManagementFeeConfig(200, feeRecipient.address, true);

            // Make a deposit to create assets under management
            await asset.approve(vault.target, ethers.parseEther("100"));
            await vault.deposit(ethers.parseEther("100"), feeRecipient.address);

            // Fast forward time to accrue fees
            await time.increase(31556952); // 1 year

            const initialRecipientBalance = await vault.balanceOf(feeRecipient.address);
            const initialTotalSupply = await vault.totalSupply();

            await expect(vault.collectManagementFees())
                .to.emit(vault, "ManagementFeesCollected");

            const finalRecipientBalance = await vault.balanceOf(feeRecipient.address);
            const finalTotalSupply = await vault.totalSupply();

            expect(finalRecipientBalance).to.be.gt(initialRecipientBalance);
            expect(finalTotalSupply).to.be.gt(initialTotalSupply);
        });
    });

    describe("Management Fee View Functions", function () {
        it("Should return correct management fee configuration", async function () {
            const { vault, feeRecipient, manager } = await loadFixture(deployVaultWithManagementFees);

            const managementFeeRate = 250; // 2.5%
            
            await vault.connect(manager).setManagementFeeConfig(managementFeeRate, feeRecipient.address, true);

            const config = await vault.getManagementFeeConfig();
            expect(config.managementFeeRate).to.equal(managementFeeRate);
            expect(config.managementFeeRecipient).to.equal(feeRecipient.address);
            expect(config.enabled).to.equal(true);
            expect(config.lastCollection).to.be.gt(0);
        });
    });
}); 