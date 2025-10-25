#!/usr/bin/env python3
"""Compute timing stats from bench_results/prepost_runs_with_time.jsonl

Writes bench_results/timing_summary.json and prints a Markdown table.
"""
import json
from pathlib import Path
from statistics import median, mean

BASE = Path(__file__).resolve().parents[1]
INFILE = BASE / 'bench_results' / 'prepost_runs_with_time.jsonl'
OUTJSON = BASE / 'bench_results' / 'timing_summary.json'

if not INFILE.exists():
    print(f"Input not found: {INFILE}")
    raise SystemExit(1)

entries = []
# Open with utf-8-sig to tolerate BOMs produced by PowerShell redirection
with INFILE.open('r', encoding='utf-8-sig') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            entries.append(obj)
        except Exception:
            # skip parse errors
            continue

if not entries:
    print('No entries parsed from jsonl')
    raise SystemExit(1)

from collections import defaultdict
groups = defaultdict(list)
for e in entries:
    # skip aggregate-run entries that may not have script
    if 'script' not in e or 'stage' not in e:
        continue
    script = Path(e['script']).name
    key = (script, e['stage'])
    try:
        groups[key].append(int(e.get('durationMillis') or 0))
    except Exception:
        # ignore entries that don't have numeric duration
        continue

summary = {}
md = []
md.append('| Script | Stage | Runs | Min (ms) | Median (ms) | Mean (ms) |')
md.append('|---|---:|---:|---:|---:|---:|')
for (script, stage), values in sorted(groups.items()):
    vals_sorted = sorted(values)
    mn = vals_sorted[0]
    med = int(median(vals_sorted))
    avg = int(mean(vals_sorted))
    cnt = len(vals_sorted)
    summary_key = f"{script}:{stage}"
    summary[summary_key] = { 'script': script, 'stage': stage, 'runs': cnt, 'min': mn, 'median': med, 'mean': avg, 'all': vals_sorted }
    md.append(f'| {script} | {stage} | {cnt} | {mn} | {med} | {avg} |')

OUTJSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

print('\n'.join(md))
print()  # newline
print(f'Wrote {OUTJSON}')
