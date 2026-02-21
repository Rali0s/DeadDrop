// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {DailyBriefSVG} from "./DailyBriefSVG.sol";
import {INftWeightOracle} from "./INftWeightOracle.sol";

contract DailyBriefNFT is
    Initializable,
    UUPSUpgradeable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    INftWeightOracle
{
    bytes32 public constant CONTENT_ROLE = keccak256("CONTENT_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant PARAM_ADMIN_ROLE = keccak256("PARAM_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MINT_PRICE_WEI = 10_000_000_000_000; // 0.00001 ETH
    uint16 public constant MAX_DAYS = 365;
    uint256 public constant MAX_BPS = 10_000;

    struct Brief {
        string id;
        string date;
        string title;
        string lesson;
        string quote;
        string source;
        string[4] tags;
    }

    error InvalidDay();
    error MintClosed();
    error WindowExpired();
    error NotConfigured();
    error ExceedsWalletDailyLimit();
    error WrongPayment();
    error QuantityOutOfRange();
    error InvalidAddress();
    error InvalidBrief();
    error DirectEthNotAccepted();

    uint256 public START_TIMESTAMP_UTC;

    uint256 public dailyWalletMintLimit;
    uint256 public perNftBoostBps;
    uint256 public maxBoostBps;
    address public treasury;
    address public devWallet;

    uint256 public nextTokenId;
    uint256 public totalEthReceived;
    uint256 public totalEthWithdrawn;

    mapping(uint16 => Brief) public briefs;
    mapping(uint16 => bool) public briefConfigured;
    mapping(uint16 => uint256) public dailyMintCount;
    mapping(address => mapping(uint16 => uint8)) public walletMintsByDay;
    mapping(uint256 => uint16) public tokenDay;
    mapping(uint256 => uint16) public tokenSerialInDay;

    event BriefConfigured(uint16 indexed dayIndex, string id, string date);
    event Minted(address indexed minter, uint256 indexed tokenId, uint16 indexed dayIndex, uint16 serialInDay, uint256 pricePaid);
    event TreasuryUpdated(address indexed treasury);
    event DevWalletUpdated(address indexed devWallet);
    event DailyWalletMintLimitUpdated(uint256 value);
    event BoostParamsUpdated(uint256 perNftBoostBps, uint256 maxBoostBps);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwnerOrDevWallet() {
        if (msg.sender != owner() && msg.sender != devWallet) {
            revert InvalidAddress();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address _treasury, uint256 _startTimestampUtc) public initializer {
        if (admin == address(0) || _treasury == address(0)) {
            revert InvalidAddress();
        }

        __ERC721_init("Daily War Brief", "DWB");
        __AccessControl_init();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        START_TIMESTAMP_UTC = _startTimestampUtc;
        treasury = _treasury;
        devWallet = _treasury;

        dailyWalletMintLimit = 3;
        perNftBoostBps = 25;
        maxBoostBps = 2_000;
        nextTokenId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONTENT_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        _grantRole(PARAM_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    receive() external payable {
        revert DirectEthNotAccepted();
    }

    fallback() external payable {
        revert DirectEthNotAccepted();
    }

    function configureBrief(uint16 dayIndex, Brief calldata brief) external onlyRole(CONTENT_ROLE) {
        _configureBrief(dayIndex, brief);
    }

    function configureBriefBatch(uint16[] calldata dayIndices, Brief[] calldata _briefs) external onlyRole(CONTENT_ROLE) {
        if (dayIndices.length != _briefs.length) {
            revert InvalidBrief();
        }

        for (uint256 i = 0; i < dayIndices.length; i++) {
            _configureBrief(dayIndices[i], _briefs[i]);
        }
    }

    function mintToday(uint8 quantity) external payable nonReentrant whenNotPaused {
        if (block.timestamp < START_TIMESTAMP_UTC) {
            revert MintClosed();
        }
        _mintForDay(currentDayIndex(), quantity);
    }

    function mintForDay(uint16 dayIndex, uint8 quantity) external payable nonReentrant whenNotPaused {
        _mintForDay(dayIndex, quantity);
    }

    function currentDayIndex() public view returns (uint16) {
        if (block.timestamp < START_TIMESTAMP_UTC) {
            return 0;
        }

        uint256 day = (block.timestamp - START_TIMESTAMP_UTC) / 1 days;
        if (day >= MAX_DAYS) {
            return MAX_DAYS;
        }
        return uint16(day);
    }

    function isMintOpenForDay(uint16 dayIndex) public view returns (bool) {
        if (dayIndex >= MAX_DAYS) {
            return false;
        }
        if (block.timestamp < START_TIMESTAMP_UTC) {
            return false;
        }

        uint16 current = currentDayIndex();
        if (current >= MAX_DAYS) {
            return false;
        }

        return current == dayIndex;
    }

    function boostBps(address user) external view override returns (uint256) {
        uint256 raw = balanceOf(user) * perNftBoostBps;
        if (raw > maxBoostBps) {
            return maxBoostBps;
        }
        return raw;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        uint16 dayIndex = tokenDay[tokenId];
        Brief memory brief = briefs[dayIndex];

        DailyBriefSVG.BriefRenderInput memory input = DailyBriefSVG.BriefRenderInput({
            id: brief.id,
            date: brief.date,
            title: brief.title,
            lesson: brief.lesson,
            quote: brief.quote,
            source: brief.source,
            tags: brief.tags
        });

        string memory svg = DailyBriefSVG.render(input, dayIndex, tokenSerialInDay[tokenId]);
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));

        string memory json = string.concat(
            '{"name":"Daily War Brief #',
            _toString(tokenId),
            '","description":"Daily War Brief on-chain collection.","image":"',
            image,
            '","attributes":[{"trait_type":"Day","value":"',
            _toString(dayIndex),
            '"},{"trait_type":"RefId","value":"',
            _escapeJson(brief.id),
            '"},{"trait_type":"Date","value":"',
            _escapeJson(brief.date),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function withdraw(address to, uint256 amount) external onlyOwnerOrDevWallet nonReentrant {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0 || amount > address(this).balance) {
            revert WrongPayment();
        }

        totalEthWithdrawn += amount;

        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");

        emit Withdrawn(to, amount);
    }

    function setDailyWalletMintLimit(uint256 newLimit) external onlyRole(PARAM_ADMIN_ROLE) {
        if (newLimit == 0 || newLimit > type(uint8).max) {
            revert QuantityOutOfRange();
        }
        dailyWalletMintLimit = newLimit;
        emit DailyWalletMintLimitUpdated(newLimit);
    }

    function setBoostParams(uint256 _perNftBoostBps, uint256 _maxBoostBps) external onlyRole(PARAM_ADMIN_ROLE) {
        if (_perNftBoostBps == 0 || _maxBoostBps == 0 || _maxBoostBps > MAX_BPS) {
            revert QuantityOutOfRange();
        }
        perNftBoostBps = _perNftBoostBps;
        maxBoostBps = _maxBoostBps;
        emit BoostParamsUpdated(_perNftBoostBps, _maxBoostBps);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) {
            revert InvalidAddress();
        }
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setDevWallet(address newDevWallet) external onlyOwner {
        if (newDevWallet == address(0)) {
            revert InvalidAddress();
        }
        devWallet = newDevWallet;
        emit DevWalletUpdated(newDevWallet);
    }

    function setPause(bool paused) external onlyRole(PAUSER_ROLE) {
        if (paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function _mintForDay(uint16 dayIndex, uint8 quantity) private {
        if (block.timestamp >= START_TIMESTAMP_UTC + (uint256(MAX_DAYS) * 1 days)) {
            revert WindowExpired();
        }
        if (dayIndex >= MAX_DAYS) {
            revert InvalidDay();
        }
        if (!isMintOpenForDay(dayIndex)) {
            revert MintClosed();
        }
        if (!briefConfigured[dayIndex]) {
            revert NotConfigured();
        }
        if (quantity == 0 || quantity > dailyWalletMintLimit) {
            revert QuantityOutOfRange();
        }

        uint8 mintedByUser = walletMintsByDay[msg.sender][dayIndex];
        if (mintedByUser + quantity > dailyWalletMintLimit) {
            revert ExceedsWalletDailyLimit();
        }

        uint256 expected = uint256(quantity) * MINT_PRICE_WEI;
        if (msg.value != expected) {
            revert WrongPayment();
        }

        walletMintsByDay[msg.sender][dayIndex] = mintedByUser + quantity;
        totalEthReceived += expected;

        for (uint8 i = 0; i < quantity; i++) {
            uint256 tokenId = nextTokenId++;
            uint16 serial = uint16(dailyMintCount[dayIndex] + 1);

            dailyMintCount[dayIndex] += 1;
            tokenDay[tokenId] = dayIndex;
            tokenSerialInDay[tokenId] = serial;

            _safeMint(msg.sender, tokenId);

            emit Minted(msg.sender, tokenId, dayIndex, serial, MINT_PRICE_WEI);
        }
    }

    function _configureBrief(uint16 dayIndex, Brief calldata brief) private {
        if (dayIndex >= MAX_DAYS) {
            revert InvalidDay();
        }
        if (bytes(brief.id).length == 0 || bytes(brief.date).length == 0 || bytes(brief.title).length == 0 || bytes(brief.lesson).length == 0)
        {
            revert InvalidBrief();
        }
        if (bytes(brief.date).length != 10) {
            revert InvalidBrief();
        }

        briefs[dayIndex] = brief;
        briefConfigured[dayIndex] = true;

        emit BriefConfigured(dayIndex, brief.id, brief.date);
    }

    function _escapeJson(string memory input) private pure returns (string memory) {
        bytes memory src = bytes(input);
        bytes memory out = new bytes(src.length * 2);
        uint256 j;

        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == 0x22 || c == 0x5C) {
                out[j++] = 0x5C;
                out[j++] = c;
            } else if (c == 0x0A) {
                out[j++] = 0x5C;
                out[j++] = 0x6E;
            } else {
                out[j++] = c;
            }
        }

        bytes memory trimmed = new bytes(j);
        for (uint256 k = 0; k < j; k++) {
            trimmed[k] = out[k];
        }
        return string(trimmed);
    }

    function _toString(uint256 value) private pure returns (string memory str) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        str = string(buffer);
    }
}
