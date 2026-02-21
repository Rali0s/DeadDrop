#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HEADER_RE = re.compile(r"^(#|##)\s+")
PAGE_HEADER_RE = re.compile(r"^##\s+(.+?)\s+-\s+Page\s+(\d+)\s*$")

DROP_PATTERNS = [
    re.compile(r"^\s*Ap+ro?ved\s+for\s+Release[:\"\s].*$", re.IGNORECASE),
    re.compile(r"^\s*for\s+Release[:\"\s].*$", re.IGNORECASE),
    re.compile(r"^\s*Page\s+\d+\s+of\s+\d+\s*$", re.IGNORECASE),
    re.compile(r"^\s*\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*UNCLASSIFIED\s*$", re.IGNORECASE),
    re.compile(r"^\s*SECRET\s*$", re.IGNORECASE),
    re.compile(r"^\s*TOP\s+SECRET\s*$", re.IGNORECASE),
]


def normalize_line(line: str) -> str:
    line = line.replace("\u2018", "'").replace("\u2019", "'")
    line = line.replace("\u201c", '"').replace("\u201d", '"')
    line = line.replace("\ufb01", "fi").replace("\ufb02", "fl")
    line = re.sub(r"\s+", " ", line).strip()
    line = re.sub(r"([A-Za-z])\s*-\s+([a-z])", r"\1\2", line)
    return line


def should_drop(line: str, strict: bool = False) -> bool:
    if not line:
        return False
    for pat in DROP_PATTERNS:
        if pat.match(line):
            return True

    # Drop symbol-heavy garbage lines while keeping plausible text.
    alpha = len(re.findall(r"[A-Za-z]", line))
    digits = len(re.findall(r"\d", line))
    symbols = len(re.findall(r"[^A-Za-z0-9\s]", line))
    n = max(1, len(line))
    symbol_ratio = symbols / n
    alpha_ratio = alpha / n

    if re.match(r"^[^A-Za-z0-9]{3,}$", line):
        return True
    if n >= 14 and symbol_ratio > 0.35 and alpha_ratio < 0.45:
        return True
    if n <= 24 and alpha < 3 and digits < 3:
        return True

    if strict:
        if n <= 40 and alpha < 8 and symbol_ratio > 0.2:
            return True
        if re.search(r"[_|~`]{2,}", line):
            return True
        if re.search(r"[A-Za-z]\d[A-Za-z]\d[A-Za-z]", line):
            return True
        if re.match(r"^[A-Z]{1,3}\.?$", line):
            return True
    return False


def normalize_markdown(content: str, strict: bool = False) -> str:
    out: list[str] = []
    prev_blank = False

    for raw in content.splitlines():
        line = raw.rstrip("\n")

        if HEADER_RE.match(line):
            out.append(line.strip())
            prev_blank = False
            continue

        cleaned = normalize_line(line)

        if not cleaned:
            if not prev_blank:
                out.append("")
            prev_blank = True
            continue

        if should_drop(cleaned, strict=strict):
            continue

        out.append(cleaned)
        prev_blank = False

    # Trim leading/trailing blank lines.
    while out and out[0] == "":
        out.pop(0)
    while out and out[-1] == "":
        out.pop()

    return "\n".join(out) + "\n"


def markdown_to_json(content: str) -> dict:
    lines = content.splitlines()
    title = "FOIA Corpus"
    total_extracted_pages = None
    pages: list[dict] = []
    current: dict | None = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        if line.startswith("# "):
            title = line[2:].strip()
            continue

        if line.startswith("- Total extracted pages:"):
            try:
                total_extracted_pages = int(line.split(":", 1)[1].strip())
            except ValueError:
                total_extracted_pages = None
            continue

        m = PAGE_HEADER_RE.match(line)
        if m:
            if current is not None:
                current["content"] = "\n".join(current["content_lines"]).strip()
                del current["content_lines"]
                pages.append(current)
            current = {
                "source": m.group(1).strip(),
                "page": int(m.group(2)),
                "content_lines": [],
            }
            continue

        if current is not None:
            current["content_lines"].append(line)

    if current is not None:
        current["content"] = "\n".join(current["content_lines"]).strip()
        del current["content_lines"]
        pages.append(current)

    return {
        "title": title,
        "total_extracted_pages": total_extracted_pages,
        "page_count_in_json": len(pages),
        "pages": pages,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize OCR-heavy FOIA merged markdown.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--in-place", action="store_true")
    parser.add_argument("--backup-ext", default=".bak")
    parser.add_argument("--strict", action="store_true", help="Use more aggressive line dropping.")
    parser.add_argument("--json-out", type=Path, default=None, help="Write parsed page JSON output.")
    args = parser.parse_args()

    src = args.input.expanduser().resolve()
    text = src.read_text(encoding="utf-8", errors="ignore")
    normalized = normalize_markdown(text, strict=args.strict)

    if args.in_place:
        backup = src.with_suffix(src.suffix + args.backup_ext)
        backup.write_text(text, encoding="utf-8")
        src.write_text(normalized, encoding="utf-8")
        print(f"Normalized in place: {src}")
        print(f"Backup written: {backup}")
    else:
        out = src.with_suffix(src.suffix + ".normalized")
        out.write_text(normalized, encoding="utf-8")
        print(f"Normalized output: {out}")

    if args.json_out:
        json_out = args.json_out.expanduser().resolve()
        payload = markdown_to_json(normalized)
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"JSON written: {json_out}")
        print(f"JSON pages: {payload['page_count_in_json']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
