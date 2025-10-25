import glob
import io
import json

paths = glob.glob('bench_results/all_prepost_outputs_run*.json')
out_lines = []
for p in paths:
    with io.open(p, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # crude detection of timing JSON lines
            if line.startswith('{') and '"stage"' in line and '"durationMillis"' in line:
                try:
                    obj = json.loads(line.replace("'", '"'))
                    out_lines.append(json.dumps(obj))
                except Exception:
                    # try eval-ish replacement for mongosh printjson style
                    try:
                        # replace single quotes with double and fix trailing commas
                        s = line.replace("'", '"')
                        obj = json.loads(s)
                        out_lines.append(json.dumps(obj))
                    except Exception:
                        continue

with io.open('bench_results/prepost_runs_with_time.jsonl', 'w', encoding='utf-8') as out:
    for l in out_lines:
        out.write(l + '\n')

print(f'Extracted {len(out_lines)} timing lines from {len(paths)} files')
