#!/usr/bin/env python3
import re, json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PRE = BASE / 'bench_results' / 'pre_run_1.json'
POST = BASE / 'bench_results' / 'post_run_1.json'

def read_text(p):
    b = p.read_bytes()
    for enc in ('utf-8-sig','utf-8','utf-16','latin-1'):
        try:
            return b.decode(enc)
        except Exception:
            continue
    return b.decode('latin-1', errors='ignore')

def extract_label_block(text, label):
    # find label occurrence
    m = re.search(re.escape(label), text)
    if not m:
        return None
    idx = m.start()
    # candidate starts: positions of '{' before idx
    starts = [mo.start() for mo in re.finditer(r'\{', text[:idx])]
    # iterate from nearest to farthest (try to find a block that encloses label)
    for start in reversed(starts):
        i = start
        depth = 0
        while i < len(text):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i+1
                    if end > idx:
                        return text[start:end]
                    else:
                        break
            i += 1
    # fallback: simple rfind as before
    start = text.rfind('{', 0, idx)
    if start == -1:
        start = text.find('{', idx)
        if start == -1:
            return None
    i = start
    depth = 0
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]
        i += 1
    return None

def to_json(js_text):
    s = js_text
    # remove ObjectId(...) -> null
    s = re.sub(r'ObjectId\([^\)]*\)', 'null', s)
    # quote unquoted keys
    s = re.sub(r'([\{,\n\s])(\w+)\s*:', r'\1"\2":', s)
    # replace single quotes with double
    s = s.replace("'", '"')
    # collapse trailing commas before }
    s = re.sub(r',\s*}', '}', s)
    s = re.sub(r',\s*\]', ']', s)
    try:
        return json.loads(s)
    except Exception as e:
        # fallback: try to eval minimal replacements
        # remove weird tokens
        s2 = re.sub(r'\bundefined\b', 'null', s)
        try:
            return json.loads(s2)
        except Exception:
            print('Failed to parse JSON block:', e)
            return None

def fallback_extract(js_text):
    """When full JSON parsing fails, heuristically extract a few important
    pieces (yearStatsCount, top3Years ids, yearDetails count) using regexes.
    This is lossy but robust for quick diffs.
    """
    if not js_text:
        return None
    out = {}
    # yearStatsCount
    m = re.search(r"yearStatsCount:\s*(\d+)", js_text)
    out['yearStatsCount'] = int(m.group(1)) if m else None
    # top3Years: find first three occurrences of "_id: <number>" inside the top3Years block
    tops = []
    m2 = re.search(r"top3Years\s*:\s*\[", js_text)
    if m2:
        start = m2.end()
        # take a window after start
        window = js_text[start:start+5000]
        ids = re.findall(r"_id\s*:\s*([\-\d]+)", window)
        for i in ids[:3]:
            try:
                tops.append(int(i))
            except Exception:
                pass
    out['top3Years'] = [{'_id': x} for x in tops]
    # yearDetails count: count top-level '{' entries under yearDetails by looking for patterns like '\n  {\n    _id:'
    m3 = re.search(r"yearDetails\s*:\s*\[", js_text)
    ycount = None
    if m3:
        start = m3.end()
        window = js_text[start:start+200000]
        # count occurrences of a new object starting with _id at top-level
        entries = re.findall(r"\n\s*\{\n\s*_id\s*:", window)
        ycount = len(entries)
    out['yearDetailsCount'] = ycount
    # yearMap empty in fallback
    out['yearMap'] = {}
    return out

def summarize(obj):
    if not obj:
        return None
    out = {}
    out['yearStatsCount'] = obj.get('yearStatsCount') or obj.get('yearStatsCount')
    out['top3Years'] = obj.get('top3Years')
    out['bottom3Years'] = obj.get('bottom3Years')
    # yearDetails length
    ydet = obj.get('yearDetails') or []
    out['yearDetailsCount'] = len(ydet)
    # build map year->detail for quick diff (only include avgRating, bestGame.BGGId, mostOwned.BGGId)
    dmap = {}
    for y in ydet:
        year = y.get('year') if 'year' in y else y.get('_id')
        if year is None:
            continue
        best = None
        most = None
        bg = y.get('bestGame') or y.get('bestGame')
        mo = y.get('mostOwned') or y.get('mostOwned')
        if isinstance(bg, dict):
            best = bg.get('BGGId')
        if isinstance(mo, dict):
            most = mo.get('BGGId')
        dmap[str(year)] = { 'avgRating': y.get('avgRating'), 'bestBGG': best, 'mostBGG': most }
    out['yearMap'] = dmap
    return out

def main():
    tpre = read_text(PRE)
    tpost = read_text(POST)
    bpre = extract_label_block(tpre, "label: 'avg_ratings_by_year_games_pre'")
    bpost = extract_label_block(tpost, "label: 'avg_ratings_by_year_games_post'")
    jpre = to_json(bpre) if bpre else None
    if bpost:
        print('\nRaw POST block (first 3000 chars):')
        print(bpost[:3000])
    jpost = to_json(bpost) if bpost else None
    # If json parsing failed, try a heuristic fallback
    if jpre is None and bpre:
        print('\nFalling back to heuristic extraction for PRE')
        s_pre = fallback_extract(bpre)
    else:
        s_pre = summarize(jpre)
    if jpost is None and bpost:
        print('\nFalling back to heuristic extraction for POST')
        s_post = fallback_extract(bpost)
    else:
        s_post = summarize(jpost)
    print('PRE summary:')
    print(json.dumps(s_pre, indent=2, ensure_ascii=False))
    print('\nPOST summary:')
    print(json.dumps(s_post, indent=2, ensure_ascii=False))

    # Compare top3Years
    print('\nTop3Years diff:')
    tpre3 = s_pre.get('top3Years', []) if s_pre else []
    tpost3 = s_post.get('top3Years', []) if s_post else []
    print('PRE top3 ids:', [x.get('_id') for x in (tpre3 or [])])
    print('POST top3 ids:', [x.get('_id') for x in (tpost3 or [])])

    # Compare counts
    print('\nCounts:')
    print('PRE yearDetails count:', s_pre.get('yearDetailsCount') if s_pre else None)
    print('POST yearDetails count:', s_post.get('yearDetailsCount') if s_post else None)

    # Find years with differing avgRating or different best/most BGGId
    diffs = []
    years = set((s_pre.get('yearMap') or {}).keys()) | set((s_post.get('yearMap') or {}).keys())
    for y in sorted(years, key=lambda x: int(x)):
        a = (s_pre.get('yearMap') or {}).get(y)
        b = (s_post.get('yearMap') or {}).get(y)
        if a != b:
            diffs.append((y,a,b))
    print(f'\nYears with differences: {len(diffs)} (showing up to 10)')
    for y,a,b in diffs[:10]:
        print('Year', y)
        print(' PRE:', a)
        print(' POST:', b)
        print('---')

if __name__=='__main__':
    main()
