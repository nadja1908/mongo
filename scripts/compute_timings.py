#!/usr/bin/env python3
"""Compute timing stats from bench_results/all_prepost_outputs.json

Produces bench_results/timing_summary.json and prints a Markdown table to stdout.
"""
import re
import json
from pathlib import Path
from statistics import median, mean

BASE = Path(__file__).resolve().parents[1]
INFILE = BASE / 'bench_results' / 'all_prepost_outputs.json'
OUTJSON = BASE / 'bench_results' / 'timing_summary.json'

if not INFILE.exists():
    print(f"Input file not found: {INFILE}")
    raise SystemExit(1)

text = INFILE.read_text(encoding='utf-8', errors='replace')

# Safer: parse line-by-line; timing objects are emitted as single-line JSON lines.
entries = []
for line in text.splitlines():
    if '"stage"' in line:
        # try to find the JSON object inside the line
        try:
            start = line.index('{')
            end = line.rindex('}')
            chunk = line[start:end+1]
            obj = json.loads(chunk)
            if 'stage' in obj and 'script' in obj and 'durationMillis' in obj:
                entries.append(obj)
        except Exception:
            continue

if not entries:
    print('No timing entries found in file.')
    raise SystemExit(1)

# Group by script basename and stage
from collections import defaultdict
groups = defaultdict(list)
for e in entries:
    script = Path(e['script']).name
    key = (script, e['stage'])
    groups[key].append(int(e.get('durationMillis') or 0))

summary = {}
md_lines = []
md_lines.append('| Script | Stage | Runs | Min (ms) | Median (ms) | Mean (ms) |')
md_lines.append('|---|---:|---:|---:|---:|---:|')

for (script, stage), values in sorted(groups.items()):
    values_sorted = sorted(values)
    mn = values_sorted[0]
    med = int(median(values_sorted))
    avg = int(mean(values_sorted))
    cnt = len(values_sorted)
    summary_key = f"{script}:{stage}"
    summary[summary_key] = { 'script': script, 'stage': stage, 'runs': cnt, 'min': mn, 'median': med, 'mean': avg, 'all': values_sorted }
    md_lines.append(f'| {script} | {stage} | {cnt} | {mn} | {med} | {avg} |')

OUTJSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

print('\n'.join(md_lines))
print()  # trailing newline

print(f'Wrote {OUTJSON}')
