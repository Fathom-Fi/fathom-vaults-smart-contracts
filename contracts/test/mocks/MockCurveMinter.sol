// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCurveMinter {
    IERC20 public crvToken;

    constructor(address _crvToken) {
        crvToken = IERC20(_crvToken);
    }

    function mint(address _gauge) external {
        // Mock implementation - doesn't actually mint
    }
} 