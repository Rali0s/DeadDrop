// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {INftWeightOracle} from "./INftWeightOracle.sol";

interface IFeeModel {
    function quoteDmFeeByStake(uint256 stakedRel) external view returns (uint256);
}

contract StakingVault is Initializable, UUPSUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");
    bytes32 public constant PARAM_ADMIN_ROLE = keccak256("PARAM_ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public REL_TOKEN;
    IERC20 public USDC_TOKEN;
    IFeeModel public feeModel;
    INftWeightOracle public nftWeightOracle;
    uint256 public maxOracleBoostBps;

    uint256 public totalStaked;
    uint256 public collectedUsdcFees;

    mapping(address => uint256) public stakeBalance;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event DmFeeCharged(address indexed user, uint256 amount);
    event FeeModelUpdated(address indexed feeModel);
    event NftWeightOracleUpdated(address indexed oracle);
    event MaxOracleBoostBpsUpdated(uint256 value);
    event FeesWithdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, IERC20 _relToken, IERC20 _usdcToken, IFeeModel _feeModel) public initializer {
        require(admin != address(0), "admin 0");
        require(address(_relToken) != address(0), "rel 0");
        require(address(_usdcToken) != address(0), "usdc 0");
        require(address(_feeModel) != address(0), "fee 0");
        require(IERC20Metadata(address(_usdcToken)).decimals() == 6, "usdc decimals");

        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        REL_TOKEN = _relToken;
        USDC_TOKEN = _usdcToken;
        feeModel = _feeModel;
        maxOracleBoostBps = 3_000;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(FEE_COLLECTOR_ROLE, admin);
        _grantRole(PARAM_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    function setFeeModel(IFeeModel _feeModel) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(_feeModel) != address(0), "fee 0");
        feeModel = _feeModel;
        emit FeeModelUpdated(address(_feeModel));
    }

    function setNftWeightOracle(INftWeightOracle _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nftWeightOracle = _oracle;
        emit NftWeightOracleUpdated(address(_oracle));
    }

    function setMaxOracleBoostBps(uint256 value) external onlyRole(PARAM_ADMIN_ROLE) {
        require(value <= BPS_DENOMINATOR, "max bps");
        maxOracleBoostBps = value;
        emit MaxOracleBoostBpsUpdated(value);
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "amount 0");

        REL_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        stakeBalance[msg.sender] += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "amount 0");
        require(stakeBalance[msg.sender] >= amount, "insufficient stake");

        stakeBalance[msg.sender] -= amount;
        totalStaked -= amount;

        REL_TOKEN.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function quoteDmFee(address user) external view returns (uint256) {
        return feeModel.quoteDmFeeByStake(effectiveStake(user));
    }

    function chargeDmFee(address user) external nonReentrant whenNotPaused returns (uint256 fee) {
        fee = feeModel.quoteDmFeeByStake(effectiveStake(user));
        USDC_TOKEN.safeTransferFrom(user, address(this), fee);
        collectedUsdcFees += fee;
        emit DmFeeCharged(user, fee);
    }

    function effectiveStake(address user) public view returns (uint256) {
        uint256 rawStake = stakeBalance[user];
        if (rawStake == 0 || address(nftWeightOracle) == address(0)) {
            return rawStake;
        }

        uint256 boost = nftWeightOracle.boostBps(user);
        if (boost == 0) {
            return rawStake;
        }

        if (boost > maxOracleBoostBps) {
            boost = maxOracleBoostBps;
        }

        return (rawStake * (BPS_DENOMINATOR + boost)) / BPS_DENOMINATOR;
    }

    function withdrawFees(address to, uint256 amount) external onlyRole(FEE_COLLECTOR_ROLE) nonReentrant {
        require(to != address(0), "to 0");
        require(amount > 0, "amount 0");
        require(collectedUsdcFees >= amount, "insufficient fees");

        collectedUsdcFees -= amount;
        USDC_TOKEN.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
