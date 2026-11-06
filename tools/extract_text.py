#!/usr/bin/env python3
"""BCS-QUIZ থেকে LY Site-এর নিজের পাতার দেখা যায় এমন বাংলা লেখা তুলে CSV বানায়।
বাদ: প্রশ্ন/অধ্যায়/বই/নমুনা/SEO পাতা (অন্য প্রজেক্টের), জেনারেটেড ফাইল, অ্যাডমিন।"""
import csv, re, sys, pathlib, html
from html.parser import HTMLParser

R = pathlib.Path(sys.argv[1]); OUT = sys.argv[2]
BN = re.compile(r'[ঀ-৿]')
SKIP_DIRS = {'jobs', 'bcs', 'questions', 'book', 'sample', 'admin', 'job-science', 'subject', 'bn',
             'sheets', 'fonts', 'img', 'node_modules', '.git', 'data', 'tools', 'site-audit', 'promo'}
# অধ্যায়-কুইজ পাতা: science/-এর তালিকার ফোল্ডারগুলো (LY Quiz & Sheets-এর)
CHAPTERS = set()
for d in R.iterdir():
    if d.is_dir() and (d / 'mcq').is_dir():
        CHAPTERS.add(d.name)
KEEP_TOP_FILES = {'index.html', '404.html'}
KEEP_JOBS = {'jobs/index.html'}  # চাকরির হাব পাতার কাঠামো-লেখা LY Site-এর

def wanted(p):
    rel = p.relative_to(R).as_posix()
    if rel in KEEP_JOBS: return True
    top = rel.split('/')[0]
    if '/' not in rel: return rel in KEEP_TOP_FILES or rel.endswith('.js')
    if top in SKIP_DIRS or top in CHAPTERS: return False
    return p.suffix in ('.html', '.js')

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.out = []; s.stack = []; s.scripts = []
    def handle_starttag(s, t, a):
        s.stack.append(t); a = dict(a)
        for k in ('title', 'aria-label', 'placeholder', 'alt'):
            if a.get(k) and BN.search(a[k]): s.out.append(('বৈশিষ্ট্য:' + k, a[k]))
        if t == 'meta' and a.get('name') == 'description' and a.get('content'):
            s.out.append(('বিবরণ (গুগলে দেখায়)', a['content']))
    def handle_endtag(s, t):
        while s.stack and s.stack.pop() != t: pass
    def handle_data(s, d):
        cur = s.stack[-1] if s.stack else ''
        if cur == 'script': s.scripts.append(d); return
        if cur == 'style': return
        d = ' '.join(d.split())
        if BN.search(d): s.out.append(('পাতার লেখা' if cur != 'title' else 'শিরোনাম (ট্যাব)', d))

STR = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", re.S)
TAG = re.compile(r'<[^>]*>|\$\{[^}]*\}')
def js_strings(code):
    res = []
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.S)
    code = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', code)
    for m in STR.finditer(code):
        s = next(g for g in m.groups() if g is not None)
        if not BN.search(s): continue
        for piece in TAG.split(s):
            piece = ' '.join(html.unescape(piece).split()).strip(' ,;:+')
            if BN.search(piece): res.append(('স্ক্রিপ্টের লেখা', piece))
    return res

rows = {}
for p in sorted(R.rglob('*')):
    if not p.is_file() or not wanted(p): continue
    rel = '/' + p.relative_to(R).as_posix()
    txt = p.read_text(encoding='utf-8', errors='ignore')
    items = []
    if p.suffix == '.html':
        h = P(); h.feed(txt); items = h.out
        for sc in h.scripts: items += js_strings(sc)
    else:
        items = js_strings(txt)
    for kind, t in items:
        if len(t) < 2: continue
        key = t
        r = rows.setdefault(key, {'kind': kind, 'pages': [], 'n': 0})
        r['n'] += 1
        if rel not in r['pages']: r['pages'].append(rel)

with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['ক্রম', 'কোন পাতায়', 'ধরন', 'এখন যা লেখা', 'নতুন লেখা', 'মন্তব্য'])
    order = sorted(rows.items(), key=lambda kv: (kv[1]['pages'][0], kv[1]['kind']))
    for i, (t, r) in enumerate(order, 1):
        pg = ', '.join(r['pages'][:3]) + (f' (+{len(r["pages"])-3})' if len(r['pages']) > 3 else '')
        w.writerow([i, pg, r['kind'], t, '', ''])
print(len(rows), 'টি আলাদা লেখা')
