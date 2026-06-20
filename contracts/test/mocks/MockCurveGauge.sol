// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCurveGauge {
    IERC20 public lpToken;
    mapping(address => uint256) public balances;
    address[] public rewardTokensList;

    constructor(address _lpToken) {
        lpToken = IERC20(_lpToken);
    }

    function deposit(uint256 _amount) external {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
    }

    function withdraw(uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
        lpToken.transfer(msg.sender, _amount);
    }

    function balanceOf(address _account) external view returns (uint256) {
        return balances[_account];
    }

    function claim_rewards() external {
        // Mock implementation
    }

    function reward_tokens(uint256 _index) external view returns (address) {
        if (_index >= rewardTokensList.length) {
            return address(0);
        }
        return rewardTokensList[_index];
    }

    function setRewardTokens(address[] memory _rewardTokens) external {
        rewardTokensList = _rewardTokens;
    }
} 