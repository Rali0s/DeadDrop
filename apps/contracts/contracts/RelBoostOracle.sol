// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {INftWeightOracle} from "./INftWeightOracle.sol";

interface IERC721BalanceReader {
    function balanceOf(address owner) external view returns (uint256);
}

contract RelBoostOracle is Initializable, UUPSUpgradeable, AccessControlUpgradeable, INftWeightOracle {
    bytes32 public constant PARAM_ADMIN_ROLE = keccak256("PARAM_ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10_000;

    IERC721BalanceReader public BRIEF_NFT;
    uint256 public START_TIMESTAMP_UTC;

    uint256 public baseBps;
    uint256 public perDayTimeBps;
    uint256 public maxTimeBps;
    uint256 public perNftBps;
    uint256 public maxNftBps;
    uint256 public maxTotalBps;

    event ParamsUpdated(
        uint256 baseBps, uint256 perDayTimeBps, uint256 maxTimeBps, uint256 perNftBps, uint256 maxNftBps, uint256 maxTotalBps
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address briefNft, uint256 startTimestampUtc) public initializer {
        require(admin != address(0), "admin 0");
        require(briefNft != address(0), "nft 0");

        __AccessControl_init();
        __UUPSUpgradeable_init();

        BRIEF_NFT = IERC721BalanceReader(briefNft);
        START_TIMESTAMP_UTC = startTimestampUtc;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PARAM_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        // Baseline from REL tokenomics model.
        baseBps = 0;
        perDayTimeBps = 3;
        maxTimeBps = 750;
        perNftBps = 25;
        maxNftBps = 2_000;
        maxTotalBps = 3_000;
    }

    function boostBps(address user) external view override returns (uint256) {
        uint256 timeBps = _timeBps();
        uint256 nftBps = BRIEF_NFT.balanceOf(user) * perNftBps;
        if (nftBps > maxNftBps) {
            nftBps = maxNftBps;
        }

        uint256 total = baseBps + timeBps + nftBps;
        if (total > maxTotalBps) {
            return maxTotalBps;
        }
        return total;
    }

    function setParams(
        uint256 _baseBps,
        uint256 _perDayTimeBps,
        uint256 _maxTimeBps,
        uint256 _perNftBps,
        uint256 _maxNftBps,
        uint256 _maxTotalBps
    ) external onlyRole(PARAM_ADMIN_ROLE) {
        require(_baseBps <= BPS_DENOMINATOR, "base bps");
        require(_perDayTimeBps > 0, "day bps");
        require(_maxTimeBps <= BPS_DENOMINATOR, "time bps");
        require(_perNftBps > 0, "nft bps");
        require(_maxNftBps <= BPS_DENOMINATOR, "nft max");
        require(_maxTotalBps <= BPS_DENOMINATOR, "total bps");

        baseBps = _baseBps;
        perDayTimeBps = _perDayTimeBps;
        maxTimeBps = _maxTimeBps;
        perNftBps = _perNftBps;
        maxNftBps = _maxNftBps;
        maxTotalBps = _maxTotalBps;

        emit ParamsUpdated(_baseBps, _perDayTimeBps, _maxTimeBps, _perNftBps, _maxNftBps, _maxTotalBps);
    }

    function currentDayIndex() public view returns (uint256) {
        if (block.timestamp <= START_TIMESTAMP_UTC) {
            return 0;
        }
        return (block.timestamp - START_TIMESTAMP_UTC) / 1 days;
    }

    function _timeBps() private view returns (uint256) {
        uint256 t = currentDayIndex() * perDayTimeBps;
        if (t > maxTimeBps) {
            return maxTimeBps;
        }
        return t;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
