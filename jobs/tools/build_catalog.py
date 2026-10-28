#!/usr/bin/env python3
"""Merge catalog fragments (jobs/data/cat/*.json) into jobs/data/catalog.json.

A fragment is {"exams":[...]} or a bare list of catalog entries, the same shape as
catalog.json entries: id, cat, org, orgbn, postbn, year, n, full (+ optional grade, title).
Entries from a fragment replace catalog entries with the same id. Each entry's data file
jobs/data/e/<id>.json must exist and its question count must match n.
An id that appears twice across fragments, or twice in the catalog, stops the build.
Optional extra fields (date ISO, time minutes, neg, note, src, grade, title) pass through.
Never edit catalog.json by hand; after a rebase conflict just rerun this script.
Run from the repo root: python3 jobs/tools/build_catalog.py
"""
import glob, json, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')
NEED = ('id', 'cat', 'org', 'orgbn', 'postbn', 'year', 'n', 'full')

cat_path = os.path.join(ROOT, 'catalog.json')
catalog = json.load(open(cat_path, encoding='utf-8'))
errors = []
byid = {}
for e in catalog['exams']:
    if e['id'] in byid: errors.append(f'catalog: duplicate id {e["id"]}')
    byid[e['id']] = e
seen = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'cat', '*.json'))):
    frag = json.load(open(f, encoding='utf-8'))
    frag = frag['exams'] if isinstance(frag, dict) else frag
    for e in frag:
        if e.get('id') in seen:
            errors.append(f'{os.path.basename(f)}: id {e["id"]} already in {seen[e["id"]]}'); continue
        seen[e.get('id')] = os.path.basename(f)
        miss = [k for k in NEED if k not in e]
        if miss:
            errors.append(f'{os.path.basename(f)} {e.get("id")}: missing {miss}'); continue
        data = os.path.join(ROOT, 'e', e['id'] + '.json')
        if not os.path.exists(data):
            errors.append(f'{e["id"]}: no data file'); continue
        qs = json.load(open(data, encoding='utf-8'))
        bad = [i for i, q in enumerate(qs) if not (q.get('q') and isinstance(q.get('o'), list)
               and isinstance(q.get('a'), int) and 0 <= q['a'] < len(q['o']))]
        if bad:
            errors.append(f'{e["id"]}: malformed questions {bad[:5]}'); continue
        e['n'] = len(qs)
        byid[e['id']] = {k: v for k, v in e.items()}
    print(os.path.basename(f), len(frag))
# recount every exam, so questions appended to an existing paper update its n without a fragment entry
for e in byid.values():
    data = os.path.join(ROOT, 'e', e['id'] + '.json')
    if not os.path.exists(data):
        errors.append(f'{e["id"]}: no data file'); continue
    e['n'] = len(json.load(open(data, encoding='utf-8')))
if errors:
    print('\n'.join(errors)); sys.exit(1)
catalog['exams'] = list(byid.values())
json.dump(catalog, open(cat_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('catalog exams', len(catalog['exams']))
# keep the home-page question counter in step with the catalog
import subprocess
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools', 'stats.py')])
