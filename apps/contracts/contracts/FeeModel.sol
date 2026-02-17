// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract FeeModel is AccessControl {
    bytes32 public constant PARAM_ADMIN_ROLE = keccak256("PARAM_ADMIN_ROLE");

    uint256 public constant BPS = 10_000;

    uint256 public baseFeeUsdc6;
    uint256 public floorFeeUsdc6;
    uint256 public discountStepUsdc6;
    uint256 public relPerTier;

    event FeeParamsUpdated(uint256 baseFeeUsdc6, uint256 floorFeeUsdc6, uint256 discountStepUsdc6, uint256 relPerTier);

    constructor(address admin, uint256 _baseFeeUsdc6, uint256 _floorFeeUsdc6, uint256 _discountStepUsdc6, uint256 _relPerTier) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PARAM_ADMIN_ROLE, admin);
        _setParams(_baseFeeUsdc6, _floorFeeUsdc6, _discountStepUsdc6, _relPerTier);
    }

    function setParams(uint256 _baseFeeUsdc6, uint256 _floorFeeUsdc6, uint256 _discountStepUsdc6, uint256 _relPerTier)
        external
        onlyRole(PARAM_ADMIN_ROLE)
    {
        _setParams(_baseFeeUsdc6, _floorFeeUsdc6, _discountStepUsdc6, _relPerTier);
    }

    function quoteDmFeeByStake(uint256 stakedRel) external view returns (uint256) {
        uint256 tier = stakedRel / relPerTier;
        uint256 totalDiscount = tier * discountStepUsdc6;

        if (totalDiscount >= baseFeeUsdc6) {
            return floorFeeUsdc6;
        }

        uint256 fee = baseFeeUsdc6 - totalDiscount;
        if (fee < floorFeeUsdc6) {
            return floorFeeUsdc6;
        }

        return fee;
    }

    function _setParams(uint256 _baseFeeUsdc6, uint256 _floorFeeUsdc6, uint256 _discountStepUsdc6, uint256 _relPerTier) internal {
        require(_baseFeeUsdc6 > 0, "base fee 0");
        require(_floorFeeUsdc6 > 0, "floor fee 0");
        require(_floorFeeUsdc6 <= _baseFeeUsdc6, "floor > base");
        require(_discountStepUsdc6 > 0, "step fee 0");
        require(_relPerTier > 0, "tier rel 0");

        baseFeeUsdc6 = _baseFeeUsdc6;
        floorFeeUsdc6 = _floorFeeUsdc6;
        discountStepUsdc6 = _discountStepUsdc6;
        relPerTier = _relPerTier;

        emit FeeParamsUpdated(_baseFeeUsdc6, _floorFeeUsdc6, _discountStepUsdc6, _relPerTier);
    }
}
