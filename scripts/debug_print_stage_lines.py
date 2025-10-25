from pathlib import Path
p = Path('bench_results') / 'all_prepost_outputs.json'
txt = p.read_text(encoding='utf-8', errors='replace')
lines = [l for l in txt.splitlines() if '"stage"' in l]
print('FOUND', len(lines), 'lines with "stage"')
for i,l in enumerate(lines[:30], start=1):
    print(i, l)
