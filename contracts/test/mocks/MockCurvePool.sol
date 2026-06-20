// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;


contract MockCurvePool {
    address public lpToken;
    address public asset0;

    constructor(address _lpToken, address _asset0) {
        lpToken = _lpToken;
        asset0 = _asset0;
    }

    function token() external view returns (address) {
        return lpToken;
    }

    function coins(uint256 i) external view returns (address) {
        if (i == 0) return asset0;
        return address(0);
    }

    function add_liquidity(uint256[2] memory amounts, uint256) external returns (uint256) {
        return amounts[0];
    }

    function add_liquidity(uint256[3] memory amounts, uint256) external returns (uint256) {
        return amounts[0];
    }

    function add_liquidity(uint256[4] memory amounts, uint256) external returns (uint256) {
        return amounts[0];
    }

    function remove_liquidity_one_coin(uint256 amount, int128, uint256) external returns (uint256) {
        return amount;
    }

    function calc_withdraw_one_coin(uint256 amount, int128) external pure returns (uint256) {
        return amount;
    }
} 