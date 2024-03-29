// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.19;

interface IFlashLendingCallee {
    function flashLendingCall(
        address _caller,
        uint256 _debtValueToRepay, // [rad]
        uint256 _collateralAmountToLiquidate, // [wad]
        bytes calldata
    ) external;
}
