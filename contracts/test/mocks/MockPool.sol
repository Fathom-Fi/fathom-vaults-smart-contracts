// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;


contract MockPool {
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }

    mapping(address => ReserveData) public reserves;

    function setReserveData(address asset, address aToken) external {
        reserves[asset].aTokenAddress = aToken;
    }

    function getReserveData(address asset) external view returns (ReserveData memory) {
        return reserves[asset];
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        // Mock implementation
    }

    function withdraw(address /*asset*/, uint256 amount, address /*to*/) external returns (uint256) {
        // Mock implementation
        return amount;
    }
} 