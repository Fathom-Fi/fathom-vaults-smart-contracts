// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023

pragma solidity 0.8.19;

interface ILimitModule {
    function availableDepositLimit(address receiver) external view returns (uint256);
    function availableWithdrawLimit(address owner, uint256 maxLoss, address[] calldata strategies) external view returns (uint256);
}