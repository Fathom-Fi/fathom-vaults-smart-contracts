/**
 * Deploy VaultLogic + VaultPackage (linked) and upgrade vault proxies.
 *
 * Wind-down note: `adminForceRedeem` and `adminSweepResidualAsset` cannot both
 * fit in one VaultPackage bytecode (24 KB EIP-170 limit). Comment out the
 * function you are not deploying before `hardhat compile` / deploy.
 *
 * Usage (from fathom-vaults-smart-contracts):
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-and-upgrade-vaults.js --network xdc
 */
const { ethers } = require("hardhat");

const ADMIN = "0x594d425a6c9249f66a00c841a7a2a921b63a0a4c";

const VAULTS = [
  { label: "Educational", address: "0x3C8e9896933B374E638f9a5C309535409129aaA2" },
  { label: "DeFi", address: "0x4dd9C4Cd9A8f24a8e4D51E07ae36d6Af4c4CB71B" },
  { label: "TradeFi1", address: "0x8802645792ee0b7495f285b6ab897e5acc78b112" },
  { label: "TradeFi2", address: "0x5a51e6d4c58f1585d74ce71cf709c4f939c3dac2" },
];

const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

const PROXY_ABI = [
  "function setImplementation(address implementation, bytes _data)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

async function readImpl(provider, proxy) {
  const raw = await provider.getStorage(proxy, IMPL_SLOT);
  return ethers.getAddress("0x" + raw.slice(-40));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== ADMIN.toLowerCase()) {
    throw new Error(`Signer ${deployer.address} is not admin ${ADMIN}`);
  }

  console.log("Deployer:", deployer.address);

  const existingImpl = process.env.EXISTING_IMPL;
  let newImpl;

  if (existingImpl) {
    newImpl = ethers.getAddress(existingImpl);
    console.log("Using EXISTING_IMPL:", newImpl);
  } else {
    const VaultLogic = await ethers.getContractFactory("VaultLogic");
    const vaultLogic = await VaultLogic.deploy();
    await vaultLogic.waitForDeployment();
    const vaultLogicAddress = await vaultLogic.getAddress();
    console.log("VaultLogic:", vaultLogicAddress);

    const VaultPackage = await ethers.getContractFactory("VaultPackage", {
      libraries: { VaultLogic: vaultLogicAddress },
    });
    const vaultPackage = await VaultPackage.deploy();
    await vaultPackage.waitForDeployment();
    newImpl = await vaultPackage.getAddress();
    console.log("VaultPackage:", newImpl);
  }

  const provider = ethers.provider;

  for (const v of VAULTS) {
    const proxy = ethers.getAddress(v.address);
    const vault = new ethers.Contract(proxy, PROXY_ABI, deployer);
    const isAdmin = await vault.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    if (!isAdmin) throw new Error(`${v.label}: not DEFAULT_ADMIN`);

    const current = await readImpl(provider, proxy);
    console.log(`\n${v.label} ${proxy}`);
    console.log("  current impl:", current);

    if (current.toLowerCase() === newImpl.toLowerCase()) {
      console.log("  already upgraded");
      continue;
    }

    const tx = await vault.setImplementation(newImpl, "0x", { gasLimit: 500000n });
    console.log("  upgrade tx", tx.hash);
    await tx.wait(1);
    console.log("  new impl:", await readImpl(provider, proxy));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
