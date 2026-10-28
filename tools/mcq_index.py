# Build the MCQ index the admin topic library (/admin/library/) searches next to the written parts.
# Run after adding questions (like tools/stats.py): python3 tools/mcq_index.py  → admin/library/mcq.json
# One row per distinct question: [q, options, answer index, subject, topic, explanation(cut), [source ids]];
# sources: [label, url]. Identical questions from several exams are kept once with every source listed.
import glob, json, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
bn = lambda s: str(s).translate(str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯'))
SRC, SI, ROWS, KEY = [], {}, [], {}

def src(label, url):
    k = (label, url)
    if k not in SI: SI[k] = len(SRC); SRC.append([label, url])
    return SI[k]

def add(qs, label, url, subj='', topic=''):
    s = src(label, url)
    for q in qs:
        if not isinstance(q, dict) or not q.get('q') or not isinstance(q.get('o'), list): continue
        o = [str(x) for x in q['o']]
        a = q.get('a') if isinstance(q.get('a'), int) else -1
        k = re.sub(r'\W+', '', q['q']).lower() + '|' + (o[a] if 0 <= a < len(o) else '')
        if k in KEY:
            r = ROWS[KEY[k]]
            if s not in r[6]: r[6].append(s)
            if not r[4] and isinstance(q.get('t'), str) and len(q['t']) > 1: r[4] = q['t']
            continue
        t = q.get('t') if isinstance(q.get('t'), str) and len(q.get('t')) > 1 else topic
        KEY[k] = len(ROWS)
        ROWS.append([q['q'], o, a, q.get('s') if isinstance(q.get('s'), str) and not re.search(r'তম বিসিএস$', q.get('s', '')) else subj,
                     t, (q.get('e') or '')[:400], [s]])

for e in rd('bcs/data/catalog.json')['exams']:
    p = f"bcs/data/e/{e['id']}.json"
    if os.path.exists(os.path.join(R, p)): add(rd(p), e['title'], f"/bcs/{e['no']}/")
for f in sorted(glob.glob(os.path.join(R, 'bcs/data/s/*.json'))):
    n = os.path.basename(f)[:-5]
    add(rd(f), 'বিসিএস প্রশ্নব্যাংক: ' + n, '/bcs/#/subjects')
for e in rd('jobs/data/catalog.json')['exams']:
    p = f"jobs/data/e/{e['id']}.json"
    if os.path.exists(os.path.join(R, p)):
        add(rd(p), f"{e.get('orgbn', '')} {e.get('postbn', '')} {bn(e.get('year', ''))}".strip(), f"/jobs/{e['id']}/")
for f in sorted(glob.glob(os.path.join(R, 'running/*/data/x/*.json'))):
    d = f.split(os.sep)[-4]
    add(rd(os.path.relpath(f, R)), 'চলমান: ' + d + ' ' + os.path.basename(f)[:-5], f'/running/{d}/')
for f in sorted(glob.glob(os.path.join(R, 'subject/data/t/*/*.json'))):
    t = f.split(os.sep)[-2]
    add(rd(os.path.relpath(f, R)), 'বিষয়ভিত্তিক: ' + t, '/subject/', 'বিজ্ঞান')
# chapter quizzes keep their questions inline as const Q=[...] (see tools/stats.py)
for f in sorted(glob.glob(os.path.join(R, '*', 'index.html'))):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'const Q=(\[.*?\]);\s*\n', s, re.S)
    if not m: continue
    try: qs = json.loads(m.group(1))
    except ValueError: continue
    d = os.path.basename(os.path.dirname(f))
    title = re.search(r'<title>([^<·:]*)', s)
    add([dict(q, s='বিজ্ঞান') for q in qs], 'অধ্যায়: ' + (title.group(1).strip() if title else d), f'/{d}/', 'বিজ্ঞান', title.group(1).strip() if title else '')

out = os.path.join(R, 'admin/library/mcq.json')
json.dump({'src': SRC, 'q': ROWS}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(ROWS)} questions from {len(SRC)} sources → {os.path.relpath(out, R)} ({os.path.getsize(out) // 1024} KB)')
