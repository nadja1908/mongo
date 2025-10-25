import sys, json, re

def extract(path):
    out=[]
    # tolerate various encodings produced by PowerShell or other redirections
    data = None
    with open(path, 'rb') as f:
        b = f.read()
    for enc in ('utf-8-sig', 'utf-16', 'latin-1'):
        try:
            data = b.decode(enc)
            break
        except Exception:
            data = None
    if data is None:
        return out

    lines = data.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # if a JS object starts on this line, gather until closing brace
        if line.startswith('{'):
            collect = [lines[i]]
            j = i + 1
            while j < len(lines) and '}' not in lines[j]:
                collect.append(lines[j])
                j += 1
            if j < len(lines):
                collect.append(lines[j])
                i = j + 1
            else:
                i = j
            s = '\n'.join(collect)
        else:
            s = line
            i += 1

        if not s:
            continue
        # find JS/JSON-like substring that contains stage (tolerate single quotes and unquoted keys)
        if 'stage' in s:
            # try to find the JS object boundaries inside s
            m = re.search(r'\{.*stage.*\}', s, flags=re.S)
            if m:
                s = m.group(0)
                # attempt to convert JS-like object to valid JSON:
                # 1) quote unquoted keys: { key: -> { "key":
                s2 = re.sub(r'([\{,\s])([A-Za-z0-9_]+)\s*:', r'\1"\2":', s)
                # 2) convert single-quoted strings to double-quoted
                s2 = s2.replace("'", '"')
                # 3) attempt to load
                try:
                    obj = json.loads(s2)
                    out.append(obj)
                except Exception:
                    # last resort: try to eval-ish by replacing ObjectId(...) with nulls or strings
                    s3 = re.sub(r'ObjectId\([^\)]*\)', 'null', s2)
                    try:
                        obj = json.loads(s3)
                        out.append(obj)
                    except Exception:
                        pass
    return out

if __name__=='__main__':
    args = sys.argv[1:]
    out_path = None
    if '--out' in args:
        i = args.index('--out')
        if i+1 < len(args):
            out_path = args[i+1]
            # remove the out args from inputs
            args = args[:i] + args[i+2:]

    inputs = args
    all=[]
    for p in inputs:
        all.extend(extract(p))

    if out_path:
        with open(out_path, 'w', encoding='utf-8') as f:
            for o in all:
                f.write(json.dumps(o) + '\n')
        print(f'Wrote {out_path}')
    else:
        # write jsonl to stdout
        for o in all:
            print(json.dumps(o))
