// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.19;

interface IGovernance {
    function buyDebt(address strategy, uint256 amount) external;
    function shutdownVault() external;
}
