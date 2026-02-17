// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFeeModel {
    function quoteDmFeeByStake(uint256 stakedRel) external view returns (uint256);
}

contract StakingVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");

    IERC20 public immutable REL_TOKEN;
    IERC20 public immutable USDC_TOKEN;
    IFeeModel public feeModel;

    uint256 public totalStaked;
    uint256 public collectedUsdcFees;

    mapping(address => uint256) public stakeBalance;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event DmFeeCharged(address indexed user, uint256 amount);
    event FeeModelUpdated(address indexed feeModel);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address admin, IERC20 _relToken, IERC20 _usdcToken, IFeeModel _feeModel) {
        require(admin != address(0), "admin 0");
        require(address(_relToken) != address(0), "rel 0");
        require(address(_usdcToken) != address(0), "usdc 0");
        require(address(_feeModel) != address(0), "fee 0");

        REL_TOKEN = _relToken;
        USDC_TOKEN = _usdcToken;
        feeModel = _feeModel;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(FEE_COLLECTOR_ROLE, admin);
    }

    function setFeeModel(IFeeModel _feeModel) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(_feeModel) != address(0), "fee 0");
        feeModel = _feeModel;
        emit FeeModelUpdated(address(_feeModel));
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
        return feeModel.quoteDmFeeByStake(stakeBalance[user]);
    }

    function chargeDmFee(address user) external nonReentrant whenNotPaused returns (uint256 fee) {
        fee = feeModel.quoteDmFeeByStake(stakeBalance[user]);
        USDC_TOKEN.safeTransferFrom(user, address(this), fee);
        collectedUsdcFees += fee;
        emit DmFeeCharged(user, fee);
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
}
