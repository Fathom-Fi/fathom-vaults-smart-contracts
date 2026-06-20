// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockAToken is ERC20 {
    address public immutable UNDERLYING_ASSET;
    address public incentivesController;

    constructor(address underlyingAsset) ERC20("Mock aToken", "aToken") {
        UNDERLYING_ASSET = underlyingAsset;
    }

    function setIncentivesController(address controller) external {
        incentivesController = controller;
    }

    function getIncentivesController() external view returns (address) {
        return incentivesController;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
} 