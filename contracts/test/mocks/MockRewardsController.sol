// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;


contract MockRewardsController {
    function claimAllRewardsToSelf(address[] calldata) external returns (address[] memory, uint256[] memory) {
        address[] memory rewardsList = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        return (rewardsList, amounts);
    }
} 