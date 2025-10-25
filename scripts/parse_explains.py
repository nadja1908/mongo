import json, glob, os

out = []
files = glob.glob('bench_results/explains_post/*.json')
for p in sorted(files):
    name = os.path.basename(p)
    with open(p, 'r', encoding='utf-8') as f:
        try:
            doc = json.load(f)
        except Exception as e:
            print('skip', p, e)
            continue
    stats = doc.get('stages') and doc or doc.get('executionStats') and doc
    # navigate common shapes
    execStats = doc.get('executionStats') or doc.get('stages', [{}])[0].get('executionStats') or doc
    # try to get top-level numbers
    totalDocs = execStats.get('totalDocsExamined') if isinstance(execStats, dict) else None
    totalKeys = execStats.get('totalKeysExamined') if isinstance(execStats, dict) else None
    timeMs = execStats.get('executionTimeMillis') if isinstance(execStats, dict) else None
    nReturned = execStats.get('nReturned') if isinstance(execStats, dict) else None
    # fallback: search nested for executionStats
    if timeMs is None:
        def find_time(o):
            if isinstance(o, dict):
                if 'executionTimeMillis' in o:
                    return o['executionTimeMillis']
                for v in o.values():
                    r = find_time(v)
                    if r is not None:
                        return r
            if isinstance(o, list):
                for it in o:
                    r = find_time(it)
                    if r is not None:
                        return r
            return None
        timeMs = find_time(doc)
    out.append({ 'file': name, 'totalDocsExamined': totalDocs, 'totalKeysExamined': totalKeys, 'executionTimeMillis': timeMs, 'nReturned': nReturned })

with open('bench_results/explains_summary.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)

print('Wrote bench_results/explains_summary.json with', len(out), 'entries')
