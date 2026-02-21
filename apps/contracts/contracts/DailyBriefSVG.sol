// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library DailyBriefSVG {
    string internal constant REDACTED_FLAG = "[ REDACTED ]";
    struct BriefRenderInput {
        string id;
        string date;
        string title;
        string lesson;
        string quote;
        string source;
        string[4] tags;
    }

    uint256 internal constant TITLE_MAX_CHARS = 48;
    uint256 internal constant TITLE_LINE_CHARS = 24;
    uint256 internal constant TITLE_MAX_LINES = 2;

    uint256 internal constant LESSON_MAX_CHARS = 220;
    uint256 internal constant LESSON_LINE_CHARS = 44;
    uint256 internal constant LESSON_MAX_LINES = 5;

    uint256 internal constant QUOTE_MAX_CHARS = 180;
    uint256 internal constant QUOTE_LINE_CHARS = 45;
    uint256 internal constant QUOTE_MAX_LINES = 4;

    uint256 internal constant SOURCE_MAX_CHARS = 52;

    function render(BriefRenderInput memory brief, uint16 dayIndex, uint16 serial) internal pure returns (string memory) {
        string memory title = _redactedIfEmpty(_sanitizeAndClamp(brief.title, TITLE_MAX_CHARS));
        string memory lesson = _redactedIfEmpty(_sanitizeAndClamp(brief.lesson, LESSON_MAX_CHARS));
        string memory quote = _redactedIfEmpty(_sanitizeAndClamp(brief.quote, QUOTE_MAX_CHARS));
        string memory source = _redactedIfEmpty(_sanitizeAndClamp(brief.source, SOURCE_MAX_CHARS));
        string memory date = _redactedIfEmpty(_sanitizeAndClamp(brief.date, 16));
        string memory refId = _redactedIfEmpty(_sanitizeAndClamp(brief.id, 36));

        string memory titleLines = _chunkTspans(title, 96, TITLE_LINE_CHARS, TITLE_MAX_LINES, 42);
        string memory lessonLines = _chunkTspans(lesson, 342, LESSON_LINE_CHARS, LESSON_MAX_LINES, 26);
        string memory quoteLines = _chunkTspans(quote, 752, QUOTE_LINE_CHARS, QUOTE_MAX_LINES, 24);
        string memory tags = _renderTags(brief.tags);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">',
            '<defs><linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f2ede2"/><stop offset="100%" stop-color="#e6dfd1"/></linearGradient></defs>',
            '<rect width="1024" height="1024" fill="#0f1115"/>',
            '<rect x="32" y="32" width="960" height="960" rx="22" fill="url(#paper)" stroke="#141414" stroke-width="4"/>',
            '<rect x="64" y="64" width="896" height="896" rx="14" fill="none" stroke="#141414" stroke-width="2"/>',
            '<line x1="512" y1="64" x2="512" y2="960" stroke="#1e1e1e" stroke-opacity="0.15" stroke-width="2"/>',
            '<text x="512" y="120" text-anchor="middle" font-family="monospace" font-size="20" font-weight="700" letter-spacing="2">DAILY WAR BRIEF</text>',
            '<text x="512" y="152" text-anchor="middle" font-family="monospace" font-size="14" fill="#333">',
            date,
            ' // DAY ',
            _toString(dayIndex),
            ' // #',
            _toString(serial),
            '</text>',
            '<text x="96" y="214" font-family="monospace" font-size="12" fill="#444">REF ',
            refId,
            '</text>',
            '<text x="96" y="96" font-family="monospace" font-size="18" font-weight="700">',
            titleLines,
            '</text>',
            '<text x="96" y="320" font-family="monospace" font-size="14" fill="#181818">',
            lessonLines,
            '</text>',
            '<rect x="72" y="704" width="880" height="220" rx="10" fill="#ffffff" fill-opacity="0.35" stroke="#1f1f1f" stroke-opacity="0.45" stroke-width="2"/>',
            '<text x="96" y="734" font-family="monospace" font-size="12" fill="#444">QUOTE</text>',
            '<text x="96" y="748" font-family="monospace" font-size="14" fill="#101010">',
            quoteLines,
            '</text>',
            '<text x="96" y="872" font-family="monospace" font-size="13" fill="#303030">',
            source,
            '</text>',
            tags,
            '</svg>'
        );
    }

    function _renderTags(string[4] memory tags) private pure returns (string memory out) {
        uint256 x = 540;
        uint256 y = 220;
        uint256 shown;

        for (uint256 i = 0; i < 4; i++) {
            bytes memory raw = bytes(tags[i]);
            if (raw.length == 0) {
                continue;
            }

            string memory tag = _sanitizeAndClamp(tags[i], 16);
            if (bytes(tag).length == 0) {
                continue;
            }

            uint256 width = 24 + (bytes(tag).length * 8);
            if (x + width > 940) {
                x = 540;
                y += 34;
            }

            out = string.concat(
                out,
                '<rect x="',
                _toString(x),
                '" y="',
                _toString(y - 16),
                '" width="',
                _toString(width),
                '" height="24" rx="4" fill="#f7f1e4" stroke="#262626" stroke-width="1"/>',
                '<text x="',
                _toString(x + 10),
                '" y="',
                _toString(y),
                '" font-family="monospace" font-size="11" fill="#222" font-weight="700">',
                tag,
                '</text>'
            );

            x += width + 10;
            shown += 1;
        if (shown == 4) {
            break;
        }
    }

        if (shown == 0) {
            out = string.concat(
                out,
                '<rect x="540" y="204" width="112" height="24" rx="4" fill="#f7f1e4" stroke="#262626" stroke-width="1"/>',
                '<text x="550" y="220" font-family="monospace" font-size="11" fill="#222" font-weight="700">[ REDACTED ]</text>'
            );
        }
    }

    function _chunkTspans(string memory input, uint256 startY, uint256 lineChars, uint256 maxLines, uint256 lineHeight)
        private
        pure
        returns (string memory out)
    {
        bytes memory textBytes = bytes(input);
        if (textBytes.length == 0) {
            return '';
        }

        uint256 offset;
        for (uint256 line = 0; line < maxLines && offset < textBytes.length; line++) {
            uint256 remaining = textBytes.length - offset;
            uint256 len = remaining < lineChars ? remaining : lineChars;

            if (line + 1 == maxLines && remaining > lineChars && len > 3) {
                len = lineChars - 3;
            }

            string memory seg = _slice(textBytes, offset, len);
            if (line + 1 == maxLines && remaining > lineChars) {
                seg = string.concat(seg, '...');
            }

            out = string.concat(
                out,
                '<tspan x="96" y="',
                _toString(startY + (line * lineHeight)),
                '">',
                seg,
                '</tspan>'
            );

            offset += len;
            while (offset < textBytes.length && textBytes[offset] == 0x20) {
                offset++;
            }
        }
    }

    function _sanitizeAndClamp(string memory input, uint256 maxLen) private pure returns (string memory) {
        bytes memory src = bytes(input);
        if (src.length == 0 || maxLen == 0) {
            return '';
        }

        bytes memory out = new bytes(maxLen);
        uint256 j;

        for (uint256 i = 0; i < src.length && j < maxLen; i++) {
            bytes1 c = src[i];
            if (_isSafeAscii(c)) {
                out[j] = c;
            } else {
                out[j] = 0x20;
            }
            j++;
        }

        return string(_trimRight(out, j));
    }

    function _redactedIfEmpty(string memory value) private pure returns (string memory) {
        if (bytes(value).length == 0) {
            return REDACTED_FLAG;
        }
        return value;
    }

    function _isSafeAscii(bytes1 c) private pure returns (bool) {
        if (c >= 0x30 && c <= 0x39) return true;
        if (c >= 0x41 && c <= 0x5A) return true;
        if (c >= 0x61 && c <= 0x7A) return true;
        if (c == 0x20 || c == 0x2D || c == 0x2E || c == 0x2C || c == 0x3A || c == 0x3B || c == 0x23 || c == 0x2F) {
            return true;
        }
        if (c == 0x27 || c == 0x22 || c == 0x28 || c == 0x29 || c == 0x21 || c == 0x3F) {
            return true;
        }
        return false;
    }

    function _trimRight(bytes memory buffer, uint256 len) private pure returns (bytes memory out) {
        while (len > 0 && buffer[len - 1] == 0x20) {
            len--;
        }

        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = buffer[i];
        }
    }

    function _slice(bytes memory data, uint256 start, uint256 len) private pure returns (string memory) {
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = data[start + i];
        }
        return string(out);
    }

    function _toString(uint256 value) private pure returns (string memory str) {
        if (value == 0) return '0';

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
