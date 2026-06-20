module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying UniswapV3Provider strategy...");

  // Network-specific addresses for Uniswap V3
  const networkAddresses = {
    mainnet: {
      positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth9: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      asset: "0xA0b86a33E6441b6Da0D87Bb4c6Ac863B9cc6E1b5", // USDC
      feeTier: 500 // 0.05% for USDC/WETH
    },
    polygon: {
      positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth9: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC on Polygon
      asset: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
      feeTier: 500 // 0.05% for USDC/WMATIC
    },
    arbitrum: {
      positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth9: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
      asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
      feeTier: 500 // 0.05% for USDC/WETH
    },
    base: {
      positionManager: "0x03a520b32C04BF3bEEf7BF5d52Fd0b9b7Ca60EF6",
      swapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481",
      weth9: "0x4200000000000000000000000000000000000006", // WETH on Base
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      feeTier: 500 // 0.05% for USDC/WETH
    },
    optimism: {
      positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth9: "0x4200000000000000000000000000000000000006", // WETH on Optimism
      asset: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC on Optimism
      feeTier: 500 // 0.05% for USDC/WETH
    },
    hardhat: {
      // For local testing with mocks
      positionManager: "0x0000000000000000000000000000000000000001",
      swapRouter: "0x0000000000000000000000000000000000000002",
      weth9: "0x0000000000000000000000000000000000000003",
      asset: "0x0000000000000000000000000000000000000004",
      feeTier: 500
    },
    localhost: {
      // For local testing with mocks
      positionManager: "0x0000000000000000000000000000000000000001",
      swapRouter: "0x0000000000000000000000000000000000000002",
      weth9: "0x0000000000000000000000000000000000000003",
      asset: "0x0000000000000000000000000000000000000004",
      feeTier: 500
    }
  };

  const addresses = networkAddresses[network.name];
  
  if (!addresses) {
    throw new Error(`No addresses configured for network: ${network.name}`);
  }

  // Deploy UniswapV3Provider strategy
  const uniswapV3Provider = await deploy("UniswapV3Provider", {
    from: deployer,
    args: [
      addresses.asset,              // Asset token
      "UniswapV3Provider USDC",     // Strategy name
      addresses.positionManager,    // Uniswap V3 Position Manager
      addresses.swapRouter,         // Uniswap V3 Swap Router
      addresses.weth9,              // WETH9 address
      addresses.feeTier             // Fee tier (500 = 0.05%)
    ],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`UniswapV3Provider deployed at: ${uniswapV3Provider.address}`);

  // Verify on Etherscan if not local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: uniswapV3Provider.address,
        constructorArguments: [
          addresses.asset,
          "UniswapV3Provider USDC",
          addresses.positionManager,
          addresses.swapRouter,
          addresses.weth9,
          addresses.feeTier
        ],
      });
      console.log("UniswapV3Provider verified on Etherscan");
    } catch (error) {
      console.error("Error verifying UniswapV3Provider:", error);
    }
  }

  return uniswapV3Provider;
};

module.exports.tags = ["UniswapV3Provider", "strategies"];
module.exports.dependencies = []; 