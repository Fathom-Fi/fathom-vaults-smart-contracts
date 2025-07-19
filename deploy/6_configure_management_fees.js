const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const getTheAbi = (contract) => {
    try {
        const dir = path.join(__dirname, "..", "deployments", "apothem", `${contract}.json`);
        const json = JSON.parse(fs.readFileSync(dir, "utf8"));
        return json;
    } catch (e) {
        console.log(`e`, e);
    }
};

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    // Management fee configuration
    const managementFeeRate = 200; // 2% annual management fee (in basis points)
    const managementFeeRecipient = deployer; // Address to receive management fees
    const enabled = true; // Enable management fees

    console.log("6_configure_management_fees - Configuring management fees...");
    console.log(`Management Fee Rate: ${managementFeeRate / 100}%`);
    console.log(`Fee Recipient: ${managementFeeRecipient}`);
    console.log(`Enabled: ${enabled}`);

    try {
        // Get the deployed vault address from the previous deployment
        const factoryFile = getTheAbi("Factory");
        const factoryAddress = factoryFile.address;
        const factory = await ethers.getContractAt("FactoryPackage", factoryAddress);

        // Get the latest vault deployed by the factory
        const vaults = await factory.getVaults();
        if (vaults.length === 0) {
            console.log("6_configure_management_fees - Error: No vaults found");
            return;
        }

        const latestVaultAddress = vaults[vaults.length - 1];
        console.log(`Configuring management fees for vault: ${latestVaultAddress}`);

        const vault = await ethers.getContractAt("VaultPackage", latestVaultAddress);

        // Configure management fees
        const configTx = await vault.setManagementFeeConfig(
            managementFeeRate,
            managementFeeRecipient,
            enabled
        );
        await configTx.wait();

        console.log("6_configure_management_fees - Management fees configured successfully");

        // Verify the configuration
        const config = await vault.getManagementFeeConfig();
        console.log("Management Fee Configuration:");
        console.log(`- Rate: ${config.managementFeeRate} basis points (${config.managementFeeRate / 100}%)`);
        console.log(`- Recipient: ${config.managementFeeRecipient}`);
        console.log(`- Enabled: ${config.enabled}`);
        console.log(`- Last Collection: ${config.lastCollection}`);

    } catch (error) {
        console.log("6_configure_management_fees - Error:", error.message);
    }
};

module.exports.tags = ["ManagementFees"];
module.exports.dependencies = ["Factory"]; 