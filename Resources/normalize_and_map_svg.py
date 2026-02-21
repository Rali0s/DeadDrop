#!/usr/bin/env python3
import json
import re
import subprocess
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path('/Users/proteu5/Documents/Github/DeadDrop/Resources')
DIGEST_OUT = ROOT / 'briefs.digest.json'
SVG_OUT = ROOT / 'nft-preview-mapped.svg'
TEMPLATE_PATH = ROOT / 'NFT_STANDARD_TEMPLATE.svg'
PDF_PATHS = [
    ROOT / 'Cold War Daily Briefs.pdf',
    ROOT / 'Cold War Daily Briefs Expanded.pdf',
]

EXCLUDE_JSON = {'briefs.digest.json'}
REDACTED_FLAG = "[ REDACTED ]"


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\x0c", " ")).strip()


def redacted_if_empty(value: str) -> str:
    clean = normalize_spaces(value)
    return clean if clean else REDACTED_FLAG


def parse_json_maybe_multiple(raw: str):
    decoder = json.JSONDecoder()
    idx = 0
    objs = []
    while idx < len(raw):
        while idx < len(raw) and raw[idx].isspace():
            idx += 1
        if idx >= len(raw):
            break
        obj, end = decoder.raw_decode(raw, idx)
        objs.append(obj)
        idx = end
    return objs


def normalize_item(item: dict, source: str):
    if not isinstance(item, dict):
        return None
    out = {
        'id': normalize_spaces(str(item.get('id', ''))),
        'date': normalize_spaces(str(item.get('date', ''))),
        'title': normalize_spaces(str(item.get('title', ''))),
        'lesson': normalize_spaces(str(item.get('lesson', ''))),
        'quote': normalize_spaces(str(item.get('quote', ''))),
        'source': normalize_spaces(str(item.get('source', ''))),
        'tags': [],
        '_source': source,
    }

    tags = item.get('tags', [])
    if isinstance(tags, list):
        out['tags'] = [normalize_spaces(str(t)) for t in tags if normalize_spaces(str(t))]

    if not out['id'] or not out['date'] or not out['title'] or not out['lesson']:
        return None
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', out['date']):
        return None

    out['tags'] = out['tags'][:4]
    while len(out['tags']) < 4:
        out['tags'].append('')

    return out


def parse_json_files():
    items = []
    sources = []
    for path in sorted(ROOT.glob('*.json')):
        if path.name in EXCLUDE_JSON:
            continue
        raw = path.read_text(encoding='utf-8', errors='ignore')
        try:
            objs = parse_json_maybe_multiple(raw)
        except Exception:
            continue
        for obj in objs:
            if isinstance(obj, dict) and isinstance(obj.get('items'), list):
                for item in obj['items']:
                    n = normalize_item(item, path.name)
                    if n:
                        items.append(n)
                sources.append(path.name)
    return items, sources


def parse_pdf_entries():
    out = []
    for pdf_path in PDF_PATHS:
        if not pdf_path.exists():
            continue

        try:
            raw = subprocess.check_output(['pdftotext', '-layout', str(pdf_path), '-'], text=True, errors='ignore')
        except Exception:
            continue

        text = raw.replace('\x0c', '\n')
        blocks = re.findall(r'\{[\s\S]*?"id"\s*:\s*"[^"]+"[\s\S]*?\}', text)

        for block in blocks:
            def pick(field):
                m = re.search(rf'"{field}"\s*:\s*"([\s\S]*?)"\s*(?:,|\n\s*\}})', block)
                return normalize_spaces(m.group(1)) if m else ''

            item = {
                'id': pick('id'),
                'date': pick('date'),
                'title': pick('title'),
                'lesson': pick('lesson'),
                'quote': pick('quote'),
                'source': pick('source'),
                'tags': []
            }
            n = normalize_item(item, pdf_path.name)
            if n:
                out.append(n)

    return out


def merge_items(items):
    by_id = {}

    def score(it):
        source = it.get('_source', '')
        is_pdf = 1 if source.lower().endswith('.pdf') else 0
        is_expanded_pdf = 1 if source == 'Cold War Daily Briefs Expanded.pdf' else 0
        return (len(it.get('lesson', '')) + len(it.get('quote', '')) + len(it.get('title', '')), is_pdf, is_expanded_pdf)

    duplicates = 0
    for it in items:
        existing = by_id.get(it['id'])
        if not existing:
            by_id[it['id']] = it
            continue
        duplicates += 1
        if score(it) > score(existing):
            by_id[it['id']] = it

    merged = list(by_id.values())
    merged.sort(key=lambda x: (x['date'], x['id']))

    return merged, duplicates


def wrap_lines(text, width, max_lines):
    words = normalize_spaces(text).split(' ')
    if not words:
        return ['']
    lines = []
    cur = ''
    for w in words:
        nxt = w if not cur else f'{cur} {w}'
        if len(nxt) <= width:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
            if len(lines) >= max_lines:
                break
    if len(lines) < max_lines and cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    if len(lines) == max_lines and ' '.join(words) != ' '.join(lines):
        lines[-1] = (lines[-1][: max(0, width - 3)] + '...') if len(lines[-1]) >= 3 else lines[-1]
    return lines


def build_quote_tspans(quote):
    lines = wrap_lines(quote, 75, 3)
    y0 = 764
    dy = 30
    chunks = []
    for i, line in enumerate(lines):
        chunks.append(f'<tspan x="112" dy="{0 if i == 0 else dy}">{escape(line)}</tspan>')
    return '\n      '.join(chunks)


def pick_preview_entry(items):
    preferred = [x for x in items if x['date'] == '2026-02-20']
    if preferred:
        for c in preferred:
            if c['id'] == 'cw-1962-10-22-cuban-missile':
                return c
        return preferred[0]
    return items[-1] if items else None


def map_template_svg(template: str, item: dict) -> str:
    title_upper = redacted_if_empty(item.get('title', '')).upper()[:44]
    safe_date = redacted_if_empty(item.get('date', ''))
    header_sub = f"{safe_date} // {title_upper}"

    safe_id = redacted_if_empty(item.get('id', ''))
    ref_left = f"REF: {safe_id.upper()[:18]} / DOSSIER-A"
    ref_right = f"REF: {safe_id.upper()[:18]} / DOSSIER-B"

    lesson_short = redacted_if_empty(item.get('lesson', '')).upper()[:42]
    source = redacted_if_empty(item.get('source', ''))[:52]

    tag_line = ' / '.join([t.upper() for t in item.get('tags', []) if t])
    if not tag_line:
        tag_line = 'TRADECRAFT / ARCHIVE'

    svg = template
    svg = re.sub(r'aria-label="[^"]*"', f'aria-label="Daily War Brief dossier: {escape(item["title"])}"', svg, count=1)
    svg = svg.replace('2026-02-20 // THE CUBAN MISSILE INTELLIGENCE', escape(header_sub))
    svg = svg.replace('REF: CW-1962-10-22-CUBA / DOSSIER-A', escape(ref_left))
    svg = svg.replace('REF: CW-1962-10-22-CUBA / DOSSIER-B', escape(ref_right))
    svg = svg.replace(
        'LESSON: TIMELY INTELLIGENCE CAN AVERT CATASTRO',
        escape(f'LESSON: {lesson_short}')[:120]
    )
    svg = svg.replace('FIELD NOTE: TRADECRAFT / ARCHIVE', escape(f'FIELD NOTE: {tag_line[:32]}'))

    # Quote body + source line
    quote_tspans = build_quote_tspans(redacted_if_empty(item.get('quote') or item.get('lesson')))
    svg = re.sub(
        r'<text class="mono" x="112" y="764" fill="#141414" font-size="16" font-weight="700">[\s\S]*?</text>',
        f'<text class="mono" x="112" y="764" fill="#141414" font-size="16" font-weight="700">\n      {quote_tspans}\n    </text>',
        svg,
        count=1,
    )
    svg = re.sub(r'—\s*CIA Cuban Missile Files', f'— {escape(source)}', svg, count=1)

    return svg


def main():
    json_items, json_sources = parse_json_files()
    pdf_items = parse_pdf_entries()

    all_items = json_items + pdf_items
    merged, duplicate_ids = merge_items(all_items)

    quote_dupes = sum(1 for _, c in Counter([i.get('quote', '') for i in merged if i.get('quote')]).items() if c > 1)

    digest = {
        'generatedAt': datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'sources': {
            'jsonFiles': sorted(set(json_sources)),
            'pdfFiles': [p.name for p in PDF_PATHS if p.exists()],
            'templateSvg': TEMPLATE_PATH.name,
        },
        'stats': {
            'jsonEntryCount': len(json_items),
            'pdfEntryCount': len(pdf_items),
            'mergedCount': len(merged),
            'duplicateIdsResolved': duplicate_ids,
            'duplicateQuoteCount': quote_dupes,
        },
        'items': [
            {
                'id': i['id'],
                'date': i['date'],
                'title': i['title'],
                'lesson': i['lesson'],
                'quote': i['quote'],
                'source': i['source'],
                'tags': i['tags'],
                'ingestedFrom': i.get('_source', ''),
            }
            for i in merged
        ],
    }

    DIGEST_OUT.write_text(json.dumps(digest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    template = TEMPLATE_PATH.read_text(encoding='utf-8')
    preview = pick_preview_entry(digest['items'])
    if not preview:
        raise RuntimeError('No entries available to render SVG preview')

    mapped_svg = map_template_svg(template, preview)
    SVG_OUT.write_text(mapped_svg, encoding='utf-8')

    print(json.dumps({
        'digest': str(DIGEST_OUT),
        'svgPreview': str(SVG_OUT),
        'stats': digest['stats'],
        'previewId': preview['id'],
        'previewDate': preview['date'],
        'previewTitle': preview['title']
    }, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
