// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright Fathom 2023

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./VaultStructs.sol";

contract VaultStorage is AccessControl, ReentrancyGuard {
    /// @notice The max length the withdrawal queue can be.
    uint256 public constant MAX_QUEUE = 10;
    /// @notice 100% in Basis Points.
    uint256 public constant MAX_BPS = 10000;
    /// @notice 50% in BPS for fees.
    uint16 public constant MAX_FEE_BPS = 5000;
    /// @notice Extended for profit locking calculations.
    uint256 public constant MAX_BPS_EXTENDED = 1_000_000_000_000;
    /// @notice One year constant for calculating the profit unlocking rate.
    uint256 public constant ONE_YEAR = 31_556_952;
    /// @notice The version of this vault.
    string public constant API_VERSION = "1.0.0";

    /// @notice Roles
    bytes32 public constant STRATEGY_MANAGER = keccak256("STRATEGY_MANAGER");
    bytes32 public constant REPORTING_MANAGER = keccak256("REPORTING_MANAGER");
    bytes32 public constant DEBT_PURCHASER = keccak256("DEBT_PURCHASER");

    /// @notice EIP-2612 permit() typehashes
    bytes32 public constant DOMAIN_TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant PERMIT_TYPE_HASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /// @notice EIP-2612 permit() domain separator.
    // solhint-disable-next-line var-name-mixedcase
    bytes32 public DOMAIN_SEPARATOR;

    /// @notice Total amount of shares that are currently minted including those locked.
    /// NOTE: To get the ERC20 compliant version use totalSupply().
    uint256 public totalSupplyAmount;

    /// @notice Total amount of assets that has been deposited in strategies.
    uint256 public totalDebtAmount;
    /// @notice Current assets held in the vault contract. Replacing balanceOf(this) to avoid pricePerShare manipulation.
    uint256 public totalIdleAmount;
    /// @notice Minimum amount of assets that should be kept in the vault contract to allow for fast, cheap redeems.
    uint256 public minimumTotalIdle;
    /// @notice Maximum amount of tokens that the vault can accept. If totalAssets > deposit_limit, deposits will revert.
    uint256 public depositLimit;

    /// @notice The amount of time profits will unlock over.
    uint256 public profitMaxUnlockTime;
    /// @notice The timestamp of when the current unlocking period ends.
    uint256 public fullProfitUnlockDate;
    /// @notice The per second rate at which profit will unlock.
    uint256 public profitUnlockingRate;
    /// @notice Last timestamp of the most recent profitable report.
    uint256 public lastProfitUpdate;

    /// @notice The strategy manager is the only address that can add and remove strategies.
    address payable public strategyManager;
    /// @notice The shares manager is the only address that can mint and burn shares.
    address public sharesManager;
    /// @notice The governance address is the only address that can set the setters.
    address public governance;

    /// @notice Contract that charges fees and can give refunds.
    address public accountant;
    /// @notice Contract to control the deposit limit.
    address public depositLimitModule;
    /// @notice Contract to control the withdraw limit.
    address public withdrawLimitModule;

    /// @notice Address that can add and remove roles to addresses.
    address public roleManager;
    /// @notice Temporary variable to store the address of the next role_manager until the role is accepted.
    address public futureRoleManager;

    /// @notice Factory address
    address public factoryAddress;

    /// @notice Address of the custom fee recipient.
    address public customFeeRecipient;

    /// @notice Address of the underlying token used by the vault
    IERC20 public assetContract;

    /// @notice The custom fee BPS charged for withdrawals.
    uint16 public customFeeBPS;

    /// @notice Should the vault use the default_queue regardless whats passed in.
    bool public useDefaultQueue;

    /// @notice State of the vault - if set to true, only withdrawals will be available. It can't be reverted.
    bool public shutdown;

    /// @notice Initialized state of the vault.
    bool internal initialized;

    /// @notice The current decimals value of the vault.
    uint8 public decimalsValue;

    /// @notice ERC20 - name of the vault's token
    string public sharesName;
    /// @notice ERC20 - symbol of the vault's token
    string public sharesSymbol;

    /// @notice The current default withdrawal queue.
    address[] public defaultQueue;

    // The custom fees
    FeeAssessment public customFees;

    /// @notice HashMap that records all the strategies that are allowed to receive assets from the vault.
    mapping(address => StrategyParams) public strategies;

    /// @notice ERC20 - amount of shares per account
    mapping(address => uint256) internal _balanceOf;
    /// @notice ERC20 - owner -> (spender -> amount)
    mapping(address => mapping(address => uint256)) internal _allowance;

    /// @notice EIP-2612 permit() nonces
    mapping(address => uint256) public nonces;

    /// @notice HashMap mapping addresses to their roles
    mapping(address => bytes32) public roles;
    /// @notice HashMap mapping roles to their permissioned state. If false, the role is not open to the public.
    mapping(bytes32 => bool) public openRoles;
}
