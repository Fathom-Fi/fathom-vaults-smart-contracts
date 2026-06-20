require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("hardhat-deploy");
require('./tasks/updateProfitUnlockTime.js');
require('./tasks/update-liquidation-strategy.js');
const fs = require("fs");
// Load private key if present so compilation can run without a file
const DEFAULT_PK = fs.existsSync("./privateKey") ? fs.readFileSync("./privateKey").toString().trim() : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
                details: { yul: true },
            },
            viaIR: true,
        },
    },
    networks: {
        apothem: {
            url: `https://earpc.apothem.network`,
            // url: 'https://erpc.apothem.network',
            accounts: process.env.PRIVATE_KEY
                ? [process.env.PRIVATE_KEY]
                : DEFAULT_PK
                  ? [DEFAULT_PK]
                  : [],
        },
        xdc: {
            url: `https://erpc.xdcrpc.com`,
            accounts: process.env.PRIVATE_KEY
                ? [process.env.PRIVATE_KEY]
                : DEFAULT_PK
                  ? [DEFAULT_PK]
                  : [],
        },
        ganache: {
            url: `http://127.0.0.1:8545`,
            accounts: process.env.PRIVATE_KEY
                ? [process.env.PRIVATE_KEY]
                : DEFAULT_PK
                  ? [DEFAULT_PK]
                  : [],
        },
        localhost: {
            url: `http://127.0.0.1:8545`,
            accounts: process.env.PRIVATE_KEY
                ? [process.env.PRIVATE_KEY]
                : DEFAULT_PK
                  ? [DEFAULT_PK]
                  : [],
        },
        // hardhat: {
        //     accounts: {
        //         // 1 million ETH in wei
        //         count: 3,
        //         initialBalance: '1000000000000000000000000',
        //     },
        //     forking: {
        //         url: "https://earpc.xinfin.network"
        //     }
        // },
    },
    namedAccounts: {
        deployer: 0,
    },
    paths: {
        deploy: "./deploy/",
    },
};
