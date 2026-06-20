module.exports = async ({ getNamedAccounts, deployments, network }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("Deploying CurveStrategy...");

    // Network-specific configurations
    const networkConfigs = {
        mainnet: {
            // Example: 3Pool (DAI/USDC/USDT)
            curvePool: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
            curveGauge: "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A",
            crvMinter: "0xd061D61a4d941c39E5453435B6345Dc261C2fcE0",
            crvToken: "0xD533a949740bb3306d119CC777fa900bA034cd52",
            baseToken: "0xA0b86a33E6441e2c473Ad56f5A8E5C61b8aFE6d7", // WETH
            router: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        polygon: {
            // Example: aUSD Pool
            curvePool: "0x445FE580eF8d70FF569aB36e80c647af338db351",
            curveGauge: "0xAA374Fbb99AC18534BFBAA96aD6EDB1AE31FAAEC",
            crvMinter: "0xabC000d88f23Bb679b53bE8E5cf8007E9c1b2f6",
            crvToken: "0x172370d5Cd63279eFa6d502DAB29171933a610AF",
            baseToken: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
            router: "0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        arbitrum: {
            // Example: 2Pool (USDC/USDT)
            curvePool: "0x7f90122BF0700F9E7e1F688fe926940E8839F353",
            curveGauge: "0xCE5F24B7A95e9cBa7df4B54E911B4A3Dc8CDAf6f",
            crvMinter: "0xabC000d88f23Bb679b53bE8E5cf8007E9c1b2f6",
            crvToken: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
            baseToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
            router: "0x5E325eDA8064b456f4781070C0738d849c824258", // Universal Router
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        hardhat: {
            curvePool: "0x1234567890123456789012345678901234567890", // Mock address
            curveGauge: "0x1234567890123456789012345678901234567891", // Mock address
            crvMinter: "0x1234567890123456789012345678901234567892", // Mock address
            crvToken: "0x1234567890123456789012345678901234567893", // Mock address
            baseToken: "0x1234567890123456789012345678901234567894", // Mock address
            router: "0x1234567890123456789012345678901234567895", // Mock address
            permit2: "0x1234567890123456789012345678901234567896" // Mock address
        },
        localhost: {
            curvePool: "0x1234567890123456789012345678901234567890", // Mock address
            curveGauge: "0x1234567890123456789012345678901234567891", // Mock address
            crvMinter: "0x1234567890123456789012345678901234567892", // Mock address
            crvToken: "0x1234567890123456789012345678901234567893", // Mock address
            baseToken: "0x1234567890123456789012345678901234567894", // Mock address
            router: "0x1234567890123456789012345678901234567895", // Mock address
            permit2: "0x1234567890123456789012345678901234567896" // Mock address
        }
    };

    const config = networkConfigs[network.name];
    if (!config) {
        throw new Error(`No configuration found for network: ${network.name}`);
    }

    // Get asset address (should be deployed beforehand)
    const assetAddress = process.env.ASSET_ADDRESS || "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // DAI on mainnet
    
    // Asset index in the Curve pool (0 for DAI in 3Pool)
    const assetIndex = process.env.ASSET_INDEX || "0";
    
    // Pool size (3 for 3Pool: DAI/USDC/USDT)
    const poolSize = process.env.POOL_SIZE || "3";

    // Get TokenizedStrategy address (should be deployed beforehand)
    const tokenizedStrategyAddress = process.env.TOKENIZED_STRATEGY_ADDRESS || 
        "0x1234567890123456789012345678901234567897";

    const deployResult = await deploy("CurveStrategy", {
        from: deployer,
        args: [
            assetAddress,
            "Curve LP Staking Strategy",
            tokenizedStrategyAddress,
            config.curvePool,
            config.curveGauge,
            config.crvMinter,
            config.crvToken,
            assetIndex,
            poolSize,
            config.baseToken,
            config.router,
            config.permit2
        ],
        log: true,
        waitConfirmations: network.live ? 5 : 1,
    });

    if (deployResult.newlyDeployed) {
        console.log(`CurveStrategy deployed at: ${deployResult.address}`);
        console.log(`Network: ${network.name}`);
        console.log(`Asset: ${assetAddress}`);
        console.log(`Asset Index: ${assetIndex}`);
        console.log(`Pool Size: ${poolSize}`);
        console.log(`Curve Pool: ${config.curvePool}`);
        console.log(`Curve Gauge: ${config.curveGauge}`);
        console.log(`CRV Minter: ${config.crvMinter}`);
        console.log(`CRV Token: ${config.crvToken}`);
        console.log(`Base Token: ${config.baseToken}`);
        console.log(`Router: ${config.router}`);
        console.log(`Permit2: ${config.permit2}`);
    }
};

module.exports.tags = ["CurveStrategy"];
module.exports.dependencies = []; 