// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract RelToken is
    Initializable,
    UUPSUpgradeable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant EMISSIONS_MINTER_ROLE = keccak256("EMISSIONS_MINTER_ROLE");
    bytes32 public constant SPECIAL_MINTER_ROLE = keccak256("SPECIAL_MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MAX_SUPPLY = 75_000_000 ether;
    uint256 public constant GENESIS_SUPPLY = 18_750_000 ether;
    uint256 public constant DEV_WALLET_RESERVE = 3_750_000 ether;
    uint256 public constant TREASURY_GENESIS_SUPPLY = 15_000_000 ether;
    uint256 public constant EMISSIONS_POOL_SUPPLY = 39_375_000 ether;
    uint256 public constant SPECIAL_RESERVE_SUPPLY = 16_875_000 ether;

    uint256 public emissionsMinted;
    uint256 public specialMinted;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address treasury, address devWallet) public initializer {
        require(admin != address(0), "admin 0");
        require(treasury != address(0), "treasury 0");
        require(devWallet != address(0), "dev 0");

        __ERC20_init("Relay", "REL");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EMISSIONS_MINTER_ROLE, admin);
        _grantRole(SPECIAL_MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        _mint(treasury, TREASURY_GENESIS_SUPPLY);
        _mint(devWallet, DEV_WALLET_RESERVE);
    }

    function mintEmission(address to, uint256 amount) external onlyRole(EMISSIONS_MINTER_ROLE) {
        require(to != address(0), "to 0");
        require(amount > 0, "amount 0");
        require(emissionsMinted + amount <= EMISSIONS_POOL_SUPPLY, "emission cap");
        emissionsMinted += amount;
        _mint(to, amount);
    }

    function mintSpecialReserve(address to, uint256 amount) external onlyRole(SPECIAL_MINTER_ROLE) {
        require(to != address(0), "to 0");
        require(amount > 0, "amount 0");
        require(specialMinted + amount <= SPECIAL_RESERVE_SUPPLY, "special cap");
        specialMinted += amount;
        _mint(to, amount);
    }

    function remainingEmissionSupply() external view returns (uint256) {
        return EMISSIONS_POOL_SUPPLY - emissionsMinted;
    }

    function remainingSpecialReserveSupply() external view returns (uint256) {
        return SPECIAL_RESERVE_SUPPLY - specialMinted;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        require(totalSupply() + value <= MAX_SUPPLY || from != address(0), "max supply");
        super._update(from, to, value);
    }
}
