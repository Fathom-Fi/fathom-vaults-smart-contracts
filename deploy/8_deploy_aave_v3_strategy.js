module.exports = async ({ getNamedAccounts, deployments, network }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("Deploying AaveV3Strategy...");

    // Network-specific configurations
    const networkConfigs = {
        mainnet: {
            lendingPool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool
            baseToken: "0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7", // WETH
            router: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        polygon: {
            lendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool
            baseToken: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
            router: "0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        arbitrum: {
            lendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool
            baseToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
            router: "0x5E325eDA8064b456f4781070C0738d849c824258", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        base: {
            lendingPool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave V3 Pool
            baseToken: "0x4200000000000000000000000000000000000006", // WETH
            router: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        hardhat: {
            lendingPool: "0x1234567890123456789012345678901234567890", // Mock address
            baseToken: "0x1234567890123456789012345678901234567891", // Mock address
            router: "0x1234567890123456789012345678901234567892", // Mock address
            permit2: "0x1234567890123456789012345678901234567893" // Mock address
        },
        localhost: {
            lendingPool: "0x1234567890123456789012345678901234567890", // Mock address
            baseToken: "0x1234567890123456789012345678901234567891", // Mock address
            router: "0x1234567890123456789012345678901234567892", // Mock address
            permit2: "0x1234567890123456789012345678901234567893" // Mock address
        }
    };

    const config = networkConfigs[network.name];
    if (!config) {
        throw new Error(`No configuration found for network: ${network.name}`);
    }

    // Get asset address (should be deployed beforehand)
    const assetAddress = process.env.ASSET_ADDRESS || "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // DAI on mainnet

    // Get TokenizedStrategy address (should be deployed beforehand)
    const tokenizedStrategyAddress = process.env.TOKENIZED_STRATEGY_ADDRESS || 
        "0x1234567890123456789012345678901234567894";

    const deployResult = await deploy("AaveV3Strategy", {
        from: deployer,
        args: [
            assetAddress,
            "Aave V3 Lending Strategy",
            tokenizedStrategyAddress,
            config.lendingPool,
            config.baseToken,
            config.router,
            config.permit2
        ],
        log: true,
        waitConfirmations: network.live ? 5 : 1,
    });

    if (deployResult.newlyDeployed) {
        console.log(`AaveV3Strategy deployed at: ${deployResult.address}`);
        console.log(`Network: ${network.name}`);
        console.log(`Asset: ${assetAddress}`);
        console.log(`Lending Pool: ${config.lendingPool}`);
        console.log(`Base Token: ${config.baseToken}`);
        console.log(`Router: ${config.router}`);
        console.log(`Permit2: ${config.permit2}`);
    }
};

module.exports.tags = ["AaveV3Strategy"];
module.exports.dependencies = []; 