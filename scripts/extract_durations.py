#!/usr/bin/env python3
"""Extract durations and basic metadata from the mongosh JSON-like output file.

This script is tolerant of the JS-style printjson output (single quotes, unquoted keys,
Long('...') wrappers). It uses regex to find top-level label/coll/durationMillis/startedAt/finishedAt/error
and writes a compact CSV and JSONL summary to `bench_results/`.
"""
import re
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
IN = BASE / 'bench_results' / 'pre_indexes_IN29.jsonl'
OUT_CSV = BASE / 'bench_results' / 'pre_indexes_IN29_summary.csv'
OUT_JSONL = BASE / 'bench_results' / 'pre_indexes_IN29_summary.jsonl'

if not IN.exists():
    print(f"Input not found: {IN}")
    raise SystemExit(1)

text = IN.read_text(encoding='utf-8', errors='replace')

# Find all occurrences of top-level label and coll; then find durationMillis etc after each label
entries = []
for m in re.finditer(r"label:\s*'([^']+)'", text):
    start = m.start()
    label = m.group(1)
    # search coll near label (before or after)
    coll = None
    # try shortly before
    before = text[max(0, start-200): start+2000]
    mc = re.search(r"coll:\s*'([^']+)'", before)
    if mc:
        coll = mc.group(1)
    else:
        # fallback: search after label
        ma = re.search(r"coll:\s*'([^']+)'", text[m.end(): m.end()+5000])
        if ma:
            coll = ma.group(1)

    # durationMillis after label
    dm = re.search(r"durationMillis:\s*([0-9]+)", text[m.end(): m.end()+20000])
    duration = int(dm.group(1)) if dm else None

    sa = re.search(r"startedAt:\s*'([^']+)'", text[m.end(): m.end()+2000])
    startedAt = sa.group(1) if sa else None
    fa = re.search(r"finishedAt:\s*'([^']+)'", text[m.end(): m.end()+2000])
    finishedAt = fa.group(1) if fa else None
    er = re.search(r"error:\s*([^,\n]+)", text[m.end(): m.end()+2000])
    if er:
        error = er.group(1).strip()
        # strip surrounding quotes if present
        if (error.startswith("'") and error.endswith("'")) or (error.startswith('"') and error.endswith('"')):
            error = error[1:-1]
    else:
        error = None

    entries.append({
        'label': label,
        'coll': coll,
        'durationMillis': duration,
        'startedAt': startedAt,
        'finishedAt': finishedAt,
        'error': error,
    })

# Write CSV
with OUT_CSV.open('w', encoding='utf-8') as f:
    f.write('label,coll,durationMillis,startedAt,finishedAt,error\n')
    for e in entries:
        line = (
            f"{e['label']},{e['coll'] or ''},{e['durationMillis'] or ''},{e['startedAt'] or ''},{e['finishedAt'] or ''},{(e['error'] or '').replace(',', ' ')}\n"
        )
        f.write(line)

# Write JSONL
with OUT_JSONL.open('w', encoding='utf-8') as f:
    for e in entries:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')

print(f"Wrote {len(entries)} entries -> {OUT_CSV} and {OUT_JSONL}")
