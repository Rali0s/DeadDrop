#!/usr/bin/env python3
"""Split one or more FOIA PDFs into consumable text documents.

Usage:
  python3 scripts/foia_pdf_to_text_docs.py \
    --outdir ./docs/foia-exports \
    --target-docs 5 \
    "/path/to/file-a.pdf" "/path/to/file-b.pdf"
"""

from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


@dataclass
class PageChunk:
    source: str
    page: int
    text: str


def clean_page_text(raw: str) -> str:
    text = (raw or "").replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for line in text.split("\n"):
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)

    merged = "\n".join(lines)
    merged = re.sub(r"\n{3,}", "\n\n", merged)
    return merged.strip()


def regex_clean_ocr_text(text: str) -> str:
    cleaned = text
    cleaned = cleaned.replace("`", "'")
    cleaned = re.sub(r"([A-Za-z])-\s*\n\s*([A-Za-z])", r"\1\2", cleaned)
    cleaned = re.sub(r"[|]{2,}", "|", cleaned)
    cleaned = re.sub(r"[~_]{2,}", " ", cleaned)
    cleaned = re.sub(r"[‘’]", "'", cleaned)
    cleaned = re.sub(r"[“”]", '"', cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)

    patterns = [
        r"^Appr[o0]ved\s+for\s+Release[:\s].*$",
        r"^\s*Declassified.*$",
        r"^\s*UNCLASSIFIED\s*$",
        r"^\s*SECRET\s*$",
        r"^\s*TOP\s+SECRET\s*$",
        r"^\s*Page\s+\d+\s+of\s+\d+\s*$",
        r"^\s*\d+\s*$",
    ]

    lines: list[str] = []
    for line in cleaned.split("\n"):
        line = line.strip()
        if not line:
            continue

        skip = False
        line_norm = re.sub(r"^[^A-Za-z0-9]+", "", line)
        for pattern in patterns:
            if re.match(pattern, line_norm, flags=re.IGNORECASE):
                skip = True
                break
        if re.match(r"^[^A-Za-z0-9]{3,}$", line):
            skip = True

        alpha_count = len(re.findall(r"[A-Za-z]", line))
        digit_count = len(re.findall(r"\d", line))
        symbol_count = len(re.findall(r"[^A-Za-z0-9\s]", line))
        line_len = max(1, len(line))
        symbol_ratio = symbol_count / line_len
        alpha_ratio = alpha_count / line_len

        if line_len >= 10 and alpha_count < 2 and digit_count < 2:
            skip = True
        if line_len >= 14 and symbol_ratio > 0.35 and alpha_ratio < 0.45:
            skip = True
        if line_len <= 24 and alpha_count < 3 and digit_count < 3:
            skip = True

        if not skip:
            lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_chunks(pdf_path: Path) -> list[PageChunk]:
    reader = PdfReader(str(pdf_path))
    chunks: list[PageChunk] = []

    for idx, page in enumerate(reader.pages, start=1):
        text = clean_page_text(page.extract_text() or "")
        if not text:
            continue
        chunks.append(PageChunk(source=pdf_path.name, page=idx, text=text))

    return chunks


def split_balanced(chunks: list[PageChunk], parts: int) -> list[list[PageChunk]]:
    if not chunks:
        return [[] for _ in range(parts)]

    total_chars = sum(len(c.text) for c in chunks)
    target = max(1, math.ceil(total_chars / parts))

    groups: list[list[PageChunk]] = [[]]
    running = 0

    for chunk in chunks:
        chunk_len = len(chunk.text)
        current_part = len(groups)
        remaining_parts = parts - current_part

        should_split = (
            running >= target and remaining_parts > 0
        )

        if should_split:
            groups.append([])
            running = 0

        groups[-1].append(chunk)
        running += chunk_len

    while len(groups) < parts:
        groups.append([])

    return groups[:parts]


def render_doc(part_idx: int, total_parts: int, part_chunks: list[PageChunk], all_chunks: list[PageChunk]) -> str:
    source_counts: dict[str, int] = {}
    for chunk in part_chunks:
        source_counts[chunk.source] = source_counts.get(chunk.source, 0) + 1

    lines: list[str] = []
    lines.append(f"FOIA Text Pack Part {part_idx}/{total_parts}")
    lines.append("=" * 72)
    lines.append(f"Total extracted pages in full corpus: {len(all_chunks)}")
    lines.append(f"Pages in this part: {len(part_chunks)}")

    if source_counts:
        lines.append("Source distribution in this part:")
        for source, count in sorted(source_counts.items()):
            lines.append(f"- {source}: {count} page(s)")

    lines.append("")

    if not part_chunks:
        lines.append("[No content assigned to this part]")
        return "\n".join(lines).strip() + "\n"

    for chunk in part_chunks:
        lines.append(f"--- {chunk.source} | Page {chunk.page} ---")
        lines.append(chunk.text)
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def render_doc_markdown(part_idx: int, total_parts: int, part_chunks: list[PageChunk], all_chunks: list[PageChunk]) -> str:
    source_counts: dict[str, int] = {}
    for chunk in part_chunks:
        source_counts[chunk.source] = source_counts.get(chunk.source, 0) + 1

    lines: list[str] = []
    lines.append(f"# FOIA Text Pack Part {part_idx}/{total_parts}")
    lines.append("")
    lines.append(f"- Total extracted pages in full corpus: {len(all_chunks)}")
    lines.append(f"- Pages in this part: {len(part_chunks)}")

    if source_counts:
        lines.append("- Source distribution in this part:")
        for source, count in sorted(source_counts.items()):
            lines.append(f"  - {source}: {count} page(s)")

    lines.append("")

    if not part_chunks:
        lines.append("[No content assigned to this part]")
        lines.append("")
        return "\n".join(lines).strip() + "\n"

    for chunk in part_chunks:
        lines.append(f"## {chunk.source} - Page {chunk.page}")
        lines.append("")
        lines.append(chunk.text)
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def render_merged_markdown(chunks: list[PageChunk]) -> str:
    lines: list[str] = []
    lines.append("# FOIA Corpus (Merged)")
    lines.append("")
    lines.append(f"- Total extracted pages: {len(chunks)}")
    lines.append("")

    for chunk in chunks:
        lines.append(f"## {chunk.source} - Page {chunk.page}")
        lines.append("")
        lines.append(chunk.text)
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract and split PDF text into consumable docs.")
    parser.add_argument("pdfs", nargs="+", help="Input PDF paths")
    parser.add_argument("--outdir", default="./docs/foia-text-pack", help="Output directory")
    parser.add_argument(
        "--target-docs",
        type=int,
        default=5,
        help="How many text docs to create (recommended 4-5)",
    )
    parser.add_argument(
        "--skip-ocr-regex-clean",
        action="store_true",
        help="Disable regex cleanup pass intended for OCR artifacts.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.target_docs < 1:
        raise SystemExit("--target-docs must be >= 1")

    outdir = Path(args.outdir).expanduser().resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    all_chunks: list[PageChunk] = []
    missing: list[str] = []
    per_input_stats: list[tuple[str, int]] = []

    for raw_path in args.pdfs:
        pdf_path = Path(raw_path).expanduser().resolve()
        if not pdf_path.exists():
            missing.append(str(pdf_path))
            continue
        if pdf_path.suffix.lower() != ".pdf":
            continue
        extracted = extract_chunks(pdf_path)
        if not args.skip_ocr_regex_clean:
            cleaned_chunks: list[PageChunk] = []
            for chunk in extracted:
                cleaned_text = regex_clean_ocr_text(chunk.text)
                if cleaned_text:
                    cleaned_chunks.append(PageChunk(source=chunk.source, page=chunk.page, text=cleaned_text))
            extracted = cleaned_chunks
        per_input_stats.append((pdf_path.name, len(extracted)))
        all_chunks.extend(extracted)

    if missing:
        print("Missing PDFs:")
        for item in missing:
            print(f"- {item}")

    if not all_chunks:
        raise SystemExit("No extractable text found. If PDFs are scanned images, run OCR first.")

    parts = split_balanced(all_chunks, args.target_docs)

    manifest_lines = [
        "FOIA Text Pack Manifest",
        "=" * 72,
        f"Output directory: {outdir}",
        f"Requested parts: {args.target_docs}",
        f"Extracted pages: {len(all_chunks)}",
        "",
    ]

    if per_input_stats:
        manifest_lines.append("Input extraction status:")
        for source_name, count in per_input_stats:
            if count == 0:
                manifest_lines.append(f"- {source_name}: 0 page(s) with embedded text (OCR likely needed)")
            else:
                manifest_lines.append(f"- {source_name}: {count} page(s) with embedded text")
        manifest_lines.append("")

    per_source: dict[str, int] = {}
    for chunk in all_chunks:
        per_source[chunk.source] = per_source.get(chunk.source, 0) + 1

    manifest_lines.append("Extracted pages by source:")
    for source, count in sorted(per_source.items()):
        manifest_lines.append(f"- {source}: {count} page(s)")

    manifest_path = outdir / "00_manifest.txt"
    manifest_path.write_text("\n".join(manifest_lines).strip() + "\n", encoding="utf-8")

    for idx, part in enumerate(parts, start=1):
        content = render_doc(idx, args.target_docs, part, all_chunks)
        doc_path = outdir / f"{idx:02d}_foia_text_part_{idx:02d}.txt"
        doc_path.write_text(content, encoding="utf-8")
        md_content = render_doc_markdown(idx, args.target_docs, part, all_chunks)
        md_path = outdir / f"{idx:02d}_foia_text_part_{idx:02d}.md"
        md_path.write_text(md_content, encoding="utf-8")

    merged_md_path = outdir / "all_foia_text_merged.md"
    merged_md_path.write_text(render_merged_markdown(all_chunks), encoding="utf-8")

    print(f"Wrote text + markdown files to: {outdir}")
    for source_name, count in per_input_stats:
        if count == 0:
            print(f"WARNING: {source_name} produced 0 pages. If scanned, run OCR first.")
    print(f"- {manifest_path.name}")
    for idx in range(1, args.target_docs + 1):
        print(f"- {idx:02d}_foia_text_part_{idx:02d}.txt")
        print(f"- {idx:02d}_foia_text_part_{idx:02d}.md")
    print(f"- {merged_md_path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
