#!/usr/bin/env python3
"""Normalize/massage Cold War brief entries into a 365-item ingest archive.

Default build plan:
- 46 baseline placeholders (or normalized baseline entries if provided)
- 180 CIB stubs (1961-01-02 through 1961-06-30)
- 139 PICL stubs (starting 1961-06-17, excluding Sundays)

Output schema fields:
- unique_id, title, date, originating_agency, classification_status, summary,
  full_text_or_link, key_actors, geographic_tags, document_type,
  related_document_ids, provenance, language, confidence_score
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

CIB_COLLECTION_URL = "https://www.cia.gov/readingroom/collection/currentcentral-intelligence-bulletin"
PICL_COLLECTION_URL = "https://www.cia.gov/readingroom/collection/presidents-daily-brief-kennedy-and-johnson-administrations"


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def as_list_of_strings(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out = [normalize_space(str(x)) for x in value if normalize_space(str(x))]
        return out
    text = normalize_space(str(value))
    return [text] if text else []


def parse_date_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = normalize_space(str(value))
    if not text:
        return None
    try:
        # Accept either YYYY-MM-DD or full ISO timestamp.
        if len(text) == 10:
            return dt.date.fromisoformat(text).isoformat()
        return dt.datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def load_items(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        items = raw.get("items")
        if isinstance(items, list):
            return [x for x in items if isinstance(x, dict)]
    raise ValueError(f"Unsupported JSON shape in {path}")


def normalize_baseline_entry(raw: dict[str, Any], idx: int) -> dict[str, Any]:
    title = normalize_space(str(raw.get("title") or raw.get("lesson") or f"Baseline Brief {idx + 1}"))
    summary = normalize_space(str(raw.get("summary") or raw.get("lesson") or "Baseline brief item pending full archival normalization."))
    date = parse_date_or_none(raw.get("date"))

    source = normalize_space(
        str(
            raw.get("source")
            or raw.get("originating_agency")
            or raw.get("agency")
            or "Unknown"
        )
    )

    if source.lower() == "unknown":
        originating_agency = "Unknown"
    else:
        originating_agency = source

    link = raw.get("full_text_or_link") or raw.get("url") or raw.get("link")
    if link is None:
        link = {
            "url": "",
            "retrieval_hint": "No source URL provided in baseline input.",
        }

    provenance = raw.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {
            "source_url": "",
            "justification": "Baseline item supplied by user input; pending source hardening.",
            "resolution_status": "pending_review",
        }

    classification = normalize_space(str(raw.get("classification_status") or "unknown")).lower()
    if classification not in {"declassified", "unknown"}:
        classification = "unknown"

    confidence = raw.get("confidence_score")
    if not isinstance(confidence, (int, float)):
        confidence = 0.5

    return {
        "unique_id": "",  # assigned in final pass
        "title": title,
        "date": date,
        "originating_agency": originating_agency,
        "classification_status": classification,
        "summary": summary,
        "full_text_or_link": link,
        "key_actors": as_list_of_strings(raw.get("key_actors") or raw.get("actors") or raw.get("tags")),
        "geographic_tags": as_list_of_strings(raw.get("geographic_tags") or raw.get("geo") or raw.get("regions")),
        "document_type": normalize_space(str(raw.get("document_type") or "baseline_brief")) or "baseline_brief",
        "related_document_ids": as_list_of_strings(raw.get("related_document_ids")),
        "provenance": provenance,
        "language": normalize_space(str(raw.get("language") or "en-US")) or "en-US",
        "confidence_score": round(float(confidence), 2),
    }


def build_baseline_placeholder(slot_number: int) -> dict[str, Any]:
    return {
        "unique_id": "",  # assigned in final pass
        "title": f"Baseline Brief Placeholder {slot_number:02d}",
        "date": None,
        "originating_agency": "Unknown",
        "classification_status": "unknown",
        "summary": "Baseline Cold War brief pending source delivery. Replace in-place with supplied archival record.",
        "full_text_or_link": {
            "url": "",
            "retrieval_hint": "Awaiting baseline source document from user-provided set.",
        },
        "key_actors": [],
        "geographic_tags": [],
        "document_type": "baseline_brief_pending",
        "related_document_ids": [],
        "provenance": {
            "source_url": "",
            "justification": "Placeholder preserved to avoid fabrication while keeping stable ingest index.",
            "resolution_status": "placeholder_pending_source",
        },
        "language": "en-US",
        "confidence_score": 0.15,
    }


def daterange(start: dt.date, end: dt.date):
    day = start
    while day <= end:
        yield day
        day += dt.timedelta(days=1)


def build_cib_stub(day: dt.date) -> dict[str, Any]:
    iso = day.isoformat()
    return {
        "unique_id": "",  # assigned in final pass
        "title": f"Central Intelligence Bulletin - {iso}",
        "date": iso,
        "originating_agency": "Central Intelligence Agency (CIA)",
        "classification_status": "declassified",
        "summary": "Daily current-intelligence digest issue in the Central Intelligence Bulletin series; resolve to document permalink for FOIA/ESDN metadata.",
        "full_text_or_link": {
            "url": CIB_COLLECTION_URL,
            "retrieval_hint": f"Query exact title: CENTRAL INTELLIGENCE BULLETIN - {iso}",
        },
        "key_actors": [],
        "geographic_tags": [],
        "document_type": "central_intelligence_bulletin_stub",
        "related_document_ids": [],
        "provenance": {
            "source_url": CIB_COLLECTION_URL,
            "justification": "Date falls within CIA-documented historical release window (1961-01-02 to 1961-06-30).",
            "resolution_status": "collection_stub",
        },
        "language": "en-US",
        "confidence_score": 0.75,
    }


def build_picl_stub(day: dt.date) -> dict[str, Any]:
    iso = day.isoformat()
    return {
        "unique_id": "",  # assigned in final pass
        "title": f"President's Intelligence Checklist - {iso}",
        "date": iso,
        "originating_agency": "Central Intelligence Agency (CIA)",
        "classification_status": "declassified",
        "summary": "Presidential daily briefing predecessor issue aligned to PICL cadence (daily except Sunday); resolve to document permalink for FOIA/ESDN metadata.",
        "full_text_or_link": {
            "url": PICL_COLLECTION_URL,
            "retrieval_hint": f"Use CIA collection search string: President's Daily Brief 1961-1969; target issue date {iso}",
        },
        "key_actors": [],
        "geographic_tags": [],
        "document_type": "presidents_intelligence_checklist_stub",
        "related_document_ids": [],
        "provenance": {
            "source_url": PICL_COLLECTION_URL,
            "justification": "Date is generated from PICL start date (1961-06-17) using daily cadence excluding Sundays.",
            "resolution_status": "collection_stub",
        },
        "language": "en-US",
        "confidence_score": 0.70,
    }


def assign_ids(items: list[dict[str, Any]]) -> None:
    for idx, item in enumerate(items, start=1):
        item["unique_id"] = f"cwdb-{idx:04d}"


def validate_items(items: list[dict[str, Any]]) -> None:
    required = {
        "unique_id",
        "title",
        "date",
        "originating_agency",
        "classification_status",
        "summary",
        "full_text_or_link",
        "key_actors",
        "geographic_tags",
        "document_type",
        "related_document_ids",
        "provenance",
        "language",
        "confidence_score",
    }
    ids: set[str] = set()
    for item in items:
        missing = required - set(item.keys())
        if missing:
            raise ValueError(f"Missing fields in {item.get('unique_id', '<unassigned>')}: {sorted(missing)}")
        uid = item["unique_id"]
        if uid in ids:
            raise ValueError(f"Duplicate unique_id detected: {uid}")
        ids.add(uid)


def build_dataset(
    baseline_input: list[dict[str, Any]] | None,
    baseline_count: int,
    cib_start: dt.date,
    cib_end: dt.date,
    picl_start: dt.date,
    picl_count: int,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    normalized_baseline: list[dict[str, Any]] = []
    if baseline_input:
        for idx, raw in enumerate(baseline_input):
            normalized_baseline.append(normalize_baseline_entry(raw, idx))

    # Keep first baseline_count entries; fill shortfall with placeholders.
    for idx in range(baseline_count):
        if idx < len(normalized_baseline):
            items.append(normalized_baseline[idx])
        else:
            items.append(build_baseline_placeholder(idx + 1))

    cib_days = list(daterange(cib_start, cib_end))
    for day in cib_days:
        items.append(build_cib_stub(day))

    picl_added = 0
    day = picl_start
    while picl_added < picl_count:
        if day.weekday() != 6:  # Sunday=6
            items.append(build_picl_stub(day))
            picl_added += 1
        day += dt.timedelta(days=1)

    assign_ids(items)
    validate_items(items)
    return items


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize and build CWDB ingest dataset.")
    parser.add_argument(
        "--baseline-json",
        type=Path,
        default=None,
        help="Optional JSON file (array or {items:[...]}) used for baseline entries.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/Users/proteu5/Documents/Github/DeadDrop/Resources/cwdb.365.ingest.json"),
        help="Output JSON path",
    )
    parser.add_argument("--baseline-count", type=int, default=46)
    parser.add_argument("--cib-start", type=str, default="1961-01-02")
    parser.add_argument("--cib-end", type=str, default="1961-06-30")
    parser.add_argument("--picl-start", type=str, default="1961-06-17")
    parser.add_argument("--picl-count", type=int, default=139)
    parser.add_argument("--indent", type=int, default=2)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    baseline_input: list[dict[str, Any]] | None = None
    if args.baseline_json:
        baseline_input = load_items(args.baseline_json.expanduser().resolve())

    cib_start = dt.date.fromisoformat(args.cib_start)
    cib_end = dt.date.fromisoformat(args.cib_end)
    picl_start = dt.date.fromisoformat(args.picl_start)

    items = build_dataset(
        baseline_input=baseline_input,
        baseline_count=args.baseline_count,
        cib_start=cib_start,
        cib_end=cib_end,
        picl_start=picl_start,
        picl_count=args.picl_count,
    )

    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(items, indent=args.indent, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = {
        "total": len(items),
        "baseline": args.baseline_count,
        "cib": (cib_end - cib_start).days + 1,
        "picl": args.picl_count,
        "output": str(out),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
