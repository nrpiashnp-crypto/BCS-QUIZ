# Count every question on the site and write the total into the home-page counter.
# Run after any upload (jobs catalog build, chapter quiz build, subject build): python3 tools/stats.py
# The total counts each question once, by its archive id, wherever it sits: a job paper, a BCS paper,
# a chapter page or a subject page (/subject/). A new question in any section raises it.
import glob, json, os, re, datetime
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bn = lambda n: f'{n:,}'.translate(str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯'))
load = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
seen = {}                                    # question id -> sections it is in
def add(sec, items):
    n = 0
    for it in items:
        if isinstance(it, dict) and 'q' in it:
            seen.setdefault(it.get('id') or it['q'] + '|' + '|'.join(map(str, it.get('o', []))), set()).add(sec)
            n += 1
    return n
cat = load('jobs/data/catalog.json')
jobs = sum(e.get('n', 0) for e in cat['exams'])
# BCS prelim papers: bcs/data/catalog.json, same shape (exams[].n)
bcat = load('bcs/data/catalog.json')
bcs = sum(e.get('n', 0) for e in bcat['exams'])
for f in glob.glob(os.path.join(R, 'jobs/data/e/*.json')): add('jobs', json.load(open(f, encoding='utf-8')))
for f in glob.glob(os.path.join(R, 'bcs/data/e/*.json')): add('bcs', json.load(open(f, encoding='utf-8')))
# chapter quizzes and job-science keep their questions inline in index.html: {"id": "q…", "q": …}
SKIP = {'jobs', 'bcs', 'running', 'exams', 'science', 'book', 'sample', 'fonts', 'img', 'js', 'qr', 'tools', '_mock', 'subject'}
for d in sorted(os.listdir(R)):
    f = os.path.join(R, d, 'index.html')
    if d in SKIP or not os.path.isfile(f): continue
    for i in re.findall(r'\{"id": *"([^"]+)", *"q":', open(f, encoding='utf-8').read()):
        seen.setdefault(i, set()).add('chapters')
# subject roadmaps: subject/data/t/<topic>/<set>.json (test.json repeats questions of the sets)
for f in glob.glob(os.path.join(R, 'subject/data/t/*/*.json')): add('subjects', json.load(open(f, encoding='utf-8')))
total = len(seen)
per = {s: sum(1 for v in seen.values() if s in v) for s in ('jobs', 'bcs', 'chapters', 'subjects')}
stats = {'questions': total, 'jobs': jobs, 'bcs': bcs, 'chapters': per['chapters'], 'subjects': per['subjects'],
         'exams': len(cat['exams']), 'bcs_exams': len(bcat['exams']), 'updated': datetime.date.today().isoformat()}
json.dump(stats, open(os.path.join(R, 'js/stats.json'), 'w'), separators=(',', ':'))
# numbers shown on pages: <b class="qc-n"> (home total), <span class="n-bcs">/<span class="n-jobs"> (exams cards)
SHOW = {'qc-n': total, 'n-bcs': bcs, 'n-jobs': jobs}
for page in ('index.html', 'exams/index.html'):
    p = os.path.join(R, page); s = open(p, encoding='utf-8').read()
    t = re.sub(r'(<(b|span) class="(qc-n|n-bcs|n-jobs)">)[^<]*(</\2>)', lambda m: m.group(1) + bn(SHOW[m.group(3)]) + m.group(4), s)
    if t != s: open(p, 'w', encoding='utf-8').write(t)
print(stats)
