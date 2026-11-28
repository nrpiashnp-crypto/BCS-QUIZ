#!/usr/bin/env python3
"""/it/ (আইটি প্রস্তুতি) পাতার তথ্য বানায়: it/data.json।
চালান: python3 tools/it_page.py --tax ../lyanna_data/taxonomy/topics
- ittech-এর ১ম স্তরের ১৮ টপিক; subject/data/t/<id>/-এ সেট থাকলে চালু, না থাকলে "শিগগির"।
- ict-এর সব টপিক (subject/data/ict.json থেকে, সেটসহ), taxonomy-র ১ম স্তর ধরে ভাগ।
- আগের প্রশ্নপত্র: jobs/data/catalog.json-এ আইটি পদের পরীক্ষা, সাল ধরে।
ট্যাগ মার্জ হয়ে subject_sets.py আবার চললে এটা আবার চালালেই ittech-এর কুইজ বসে যায়।"""
import json, os, re, argparse
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('--tax', required=True); a = ap.parse_args()
L = lambda p: json.load(open(p, encoding='utf-8'))

def sets_of(tid):
    d = os.path.join(R, 'subject/data/t', tid)
    if not os.path.isdir(d): return []
    order = {'b': 0, 'x': 1, 'l': 2}
    s = [f[:-5] for f in os.listdir(d) if re.fullmatch(r'[bxl]\d+\.json', f)]
    return sorted(s, key=lambda x: (order[x[0]], int(x[1:])))

# ক. বিভাগীয় (ittech)
it = L(os.path.join(a.tax, 'ittech.json'))['topics']
tech = []
for t in sorted([t for t in it if t['parent'] == 'ittech' and t['status'] == 'active'], key=lambda t: t['no']):
    kids = [k['id'] for k in it if k['parent'] == t['id'] and k['status'] == 'active']
    s = {k: sets_of(k) for k in [t['id']] + kids if sets_of(k)}
    tech.append({'id': t['id'], 'name': t['bn'], 'sets': s})

# খ. সাধারণ কম্পিউটার (ict)
ictax = {t['id']: t for t in L(os.path.join(a.tax, 'ict.json'))['topics']}
groups = [t for t in ictax.values() if t['parent'] == 'ict' and t['status'] == 'active']
groups.sort(key=lambda t: t['no'])
site = L(os.path.join(R, 'subject/data/ict.json'))['topics']
gen = []
for g in groups:
    rows = []
    for t in site:
        if t['id'] == g['id'] or ictax.get(t['id'], {}).get('parent') == g['id']:
            rows.append({'id': t['id'], 'name': t['name'], 'n': t['n'],
                         'sets': [[s['id'], s['kind']] for s in t['sets']]})
    if rows: gen.append({'name': g['bn'], 'topics': rows})

# গ. আগের প্রশ্নপত্র
POST = r'প্রোগ্রামার|আইটি|আইসিটি|নেটওয়ার্ক ইঞ্জিনিয়ার|মেইনটেন্যান্স ইঞ্জিনিয়ার|ডাটাবেজ|ডেটাবেজ|সিস্টেম অ্যানালিস্ট|প্রোগ্রামার'
pp = [x for x in L(os.path.join(R, 'jobs/data/catalog.json'))['exams']
      if re.search(POST, x.get('postbn', '')) and os.path.isdir(os.path.join(R, 'jobs', x['id']))]
pp.sort(key=lambda x: (-int(x.get('year') or 0), x.get('orgbn', '')))
papers = [{'id': x['id'], 'org': x.get('orgbn', ''), 'post': x.get('postbn', ''), 'y': x.get('year', ''), 'n': x.get('n', 0)} for x in pp]

out = {'tech': tech, 'gen': gen, 'papers': papers}
json.dump(out, open(os.path.join(R, 'it/data.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('ittech', len(tech), 'চালু', sum(1 for t in tech if t['sets']), '| ict টপিক', sum(len(g['topics']) for g in gen), '| প্রশ্নপত্র', len(papers))
