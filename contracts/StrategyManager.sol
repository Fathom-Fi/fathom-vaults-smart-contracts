// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.19;

import "./VaultStorage.sol";
import "./Interfaces/IVaultEvents.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
@title STRATEGY MANAGEMENT
*/

interface IStrategyManagerUpgradeable {
    function setImplementation(address implementation, bytes memory _data) external;
}

/**
 * @dev This contract implements an upgradeable proxy. It is upgradeable because calls are delegated to an
 * implementation address that can be changed. This address is stored in storage in the location specified by
 * https://eips.ethereum.org/EIPS/eip-1967[EIP1967], so that it doesn't conflict with the storage layout of the
 * implementation behind the proxy.
 */

contract StrategyManager is Proxy, ERC1967Upgrade, AccessControl, VaultStorage, IVaultEvents, IStrategyManagerUpgradeable {
    /**
     * @dev Initializes the upgradeable proxy with an initial implementation specified by `implementation`.
     *
     * If `_data` is nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
     * encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.
     *
     * Requirements:
     *
     * - If `data` is empty, `msg.value` must be zero.
     */
    constructor(address implementation, bytes memory _data) payable {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _upgradeToAndCall(implementation, _data, false);
    }

    function setImplementation(address implementation, bytes memory _data) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _upgradeToAndCall(implementation, _data, false);
    }

    /**
     * @dev Returns the current implementation address.
     *
     * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using
     * the https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
     * `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
     */
    function _implementation() internal view virtual override returns (address impl) {
        return ERC1967Upgrade._getImplementation();
    }
}
