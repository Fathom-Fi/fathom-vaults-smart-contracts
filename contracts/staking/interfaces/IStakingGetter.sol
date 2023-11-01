// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity 0.8.16;

import "../StakingStructs.sol";

interface IStakingGetter {
    function getLock(address account) external view returns (LockedBalance memory);

    function getUsersPendingRewards(address account, uint256 streamId) external view returns (uint256);

    function getStreamClaimableAmountPerLock(uint256 streamId, address account) external view returns (uint256);

    function getStreamSchedule(uint256 streamId) external view returns (uint256[] memory scheduleTimes, uint256[] memory scheduleRewards);

    function getStream(
        uint256 streamId
    ) external view returns (uint256 rewardDepositAmount, uint256 rewardClaimedAmount, uint256 rps, StreamStatus status);

    function isProhibitedLockPosition(address account) external view returns (bool);
}
