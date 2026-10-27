# Count every question on the site and write the total into the home-page counter.
# Run after any upload (jobs catalog build, chapter quiz build): python3 tools/stats.py
import json, os, re, sys, datetime
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bn = lambda n: f'{n:,}'.translate(str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯'))
cat = json.load(open(os.path.join(R, 'jobs/data/catalog.json'), encoding='utf-8'))
jobs = sum(e.get('n', 0) for e in cat['exams'])
# chapter quizzes and job-science keep their questions inline in index.html
SKIP = {'jobs', 'running', 'exams', 'science', 'book', 'sample', 'fonts', 'img', 'js', 'qr', 'tools', '_mock'}
ch = 0
for d in sorted(os.listdir(R)):
    f = os.path.join(R, d, 'index.html')
    if d in SKIP or not os.path.isfile(f): continue
    ch += len(re.findall(r'"q":', open(f, encoding='utf-8').read()))
total = jobs + ch
stats = {'questions': total, 'jobs': jobs, 'chapters': ch, 'exams': len(cat['exams']),
         'updated': datetime.date.today().isoformat()}
json.dump(stats, open(os.path.join(R, 'js/stats.json'), 'w'), separators=(',', ':'))
for page in ('index.html',):
    p = os.path.join(R, page); s = open(p, encoding='utf-8').read()
    t = re.sub(r'(<b class="qc-n">)[^<]*(</b>)', lambda m: m.group(1) + bn(total) + m.group(2), s)
    if t != s: open(p, 'w', encoding='utf-8').write(t)
print(stats)
