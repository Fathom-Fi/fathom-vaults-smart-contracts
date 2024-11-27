task("update-liquidation-strategy", "Replace current liquidation strategy with a new one").setAction(async () => {
    const liquidationStrategy = await ethers.getContractAt("LiquidationStrategy", "0xc0AC2E5181F90fDa9E9264b5b1634B2c8bD88CDd");
    const vault = await ethers.getContractAt("VaultPackage", "0x4dd9C4Cd9A8f24a8e4D51E07ae36d6Af4c4CB71B");
    const wxdc = await ethers.getContractAt("Token", "0x951857744785e80e2de051c32ee7b25f9c458c42");
    const fxd = await ethers.getContractAt("Token", "0x49d3f7543335cf38fa10889ccff10207e22110b5");
    const fthm = await ethers.getContractAt("Token", "0x3279dbefabf3c6ac29d7ff24a6c46645f3f4403c");
    const cgo = await ethers.getContractAt("Token", "0x8f9920283470f52128bf11b0c14e798be704fd15");

    console.log("Liquidation Strategy Address:", liquidationStrategy.target);

    // Native XDC balance is 0
    // check balance of wrappedXDC in LiquidationStrategy
    console.log("WXDC Balance:", await wxdc.balanceOf(liquidationStrategy.target));
    // check balance of FXD in LiquidationStrategy
    console.log("FXD Balance:", await fxd.balanceOf(liquidationStrategy.target));
    // check balance of FTHM in LiquidationStrategy
    console.log("FTHM Balance:", await fthm.balanceOf(liquidationStrategy.target));
    // check balance of CGO in LiquidationStrategy
    console.log("CGO Balance:", await cgo.balanceOf(liquidationStrategy.target));
    
    const stablecoinAdapterAddress = await liquidationStrategy.stablecoinAdapter();
    const bookKeeperAddress = await liquidationStrategy.bookKeeper();
    const strategyManagerAddress = await liquidationStrategy.strategyManager();
    const fixedSpreadLiquidationStrategyAddress = await liquidationStrategy.fixedSpreadLiquidationStrategy();
    const fathomStablecoinAddress = await liquidationStrategy.fathomStablecoin();
    const usdTokenAddress = await liquidationStrategy.usdToken();
    const tokenizedStrategyAddress = await liquidationStrategy.tokenizedStrategyAddress();
    console.log("Stablecoin Adapter Address:", stablecoinAdapterAddress);
    console.log("Book Keeper Address:", bookKeeperAddress);
    console.log("Strategy Manager Address:", strategyManagerAddress);
    console.log("Fixed Spread Liquidation Strategy Address:", fixedSpreadLiquidationStrategyAddress);
    console.log("Fathom Stablecoin Address:", fathomStablecoinAddress);
    console.log("Tokenized Strategy Address:", tokenizedStrategyAddress);
    console.log("USD Token:", usdTokenAddress)
    
    // idleCollateral
    console.log("Idle Collateral WXDC:", await liquidationStrategy.idleCollateral(wxdc.target))
    console.log("Idle Collateral FXD:", await liquidationStrategy.idleCollateral(fxd.target))
    console.log("Idle Collateral FTHM:", await liquidationStrategy.idleCollateral(fthm.target))
    console.log("Idle Collateral CGO:", await liquidationStrategy.idleCollateral(cgo.target))
    
    // LogSetV3Info
    const eventSignatureLogSetV3Info = "LogSetV3Info(address,address)";    
    const eventTopicLogSetV3Info = ethers.id(eventSignatureLogSetV3Info); // Get the data hex string

    const latestBlock = await hre.ethers.provider.getBlock("latest");

    const rawLogsLogSetV3Info = await ethers.provider.getLogs({
        address: liquidationStrategy.target,
        topics: [eventTopicLogSetV3Info],
        fromBlock: 40000000, 
        toBlock: latestBlock.number
    });

    const abiLogSetV3Info = '[{"anonymous":false,"inputs":[{"indexed":false,"name":"_permit2","type":"address"},{"indexed":false,"name":"_routerV3","type":"address"}],"name":"LogSetV3Info","type":"event"}]';
    const intrfcLogSetV3Info = new ethers.Interface(abiLogSetV3Info);
    
    let permit2 = "";
    let universalRouter = "";
    rawLogsLogSetV3Info.forEach((log) => {
        const parsedLog = intrfcLogSetV3Info.parseLog(log);
        permit2 = parsedLog.args[0];
        universalRouter = parsedLog.args[1];
    })
    console.log("Permit2:", permit2);
    console.log("Universal Router:", universalRouter);

    console.log("UniswapV3Info:", await liquidationStrategy.uniswapV3Info(universalRouter));
    /**
     * struct StrategyParams {
     *     uint256 activation;
     *     uint256 lastReport;
     *     uint256 currentDebt;
     *     uint256 maxDebt;
     * }
     */
    console.log("Vault's Strategy:", await vault.strategies(liquidationStrategy.target));
    // currentDebt = 0n
    // maxDebt = 10000000000000000000000n
    
    // Deploy and setup new liquidation strategy
    const LiquidationStrategyFactory = await ethers.getContractFactory("LiquidationStrategy");
    const liquidationStrategyNew = await LiquidationStrategyFactory.deploy(
        fathomStablecoinAddress, // _asset
        "FXDLiquidationStrategyV1150", // Liquidation Strategy Name
        tokenizedStrategyAddress, // _tokenizedStrategyAddress
        strategyManagerAddress, // _strategyManager
        fixedSpreadLiquidationStrategyAddress, // _fixedSpreadLiquidationStrategy
        bookKeeperAddress, // _bookKeeper
        stablecoinAdapterAddress // _stablecoinAdapter
    );
    await liquidationStrategyNew.deployed();

    console.log("New Liquidation Strategy Address: ", liquidationStrategyNew.address);
    
    console.log("Adding Strategy to the Vault...");
    const addStrategyTx = await vault.addStrategy(liquidationStrategyNew.target);
    await addStrategyTx.wait();

    console.log("Setting Vault's Strategy maxDebt...");
    const maxDebt = ethers.parseUnits("10000", 18);
    const updateMaxDebtForStrategyTx = await vault.updateMaxDebtForStrategy(liquidationStrategyNew.target, maxDebt);
    await updateMaxDebtForStrategyTx.wait();

    console.log("Setting Liquidation Strategy UniswapV3 Info...");
    const poolFee = 3000n;
    const setV3InfoTx = await liquidationStrategyNew.setV3Info(
        permit2,
        universalRouter,
        poolFee
    );
    await setV3InfoTx.wait();

    console.log("Revoke Vault's Current Liquidation Strategy...");
    const revokeStrategyTx = await vault.revokeStrategy(liquidationStrategy.target, false);
    await revokeStrategyTx.wait();
});
  
module.exports = {};
  