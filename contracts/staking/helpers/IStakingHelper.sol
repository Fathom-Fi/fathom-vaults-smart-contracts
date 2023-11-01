// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022
pragma solidity 0.8.16;

import "../StakingStructs.sol";
import "../interfaces/IStakingGetter.sol";
import "../interfaces/IStakingHandler.sol";
import "../interfaces/IStakingStorage.sol";
import "../../common/security/IAdminPausable.sol";

interface IStakingHelper is IStakingGetter, IStakingHandler, IStakingStorage, IAdminPausable {
    function maxLockPeriod() external view returns (uint64);
}
