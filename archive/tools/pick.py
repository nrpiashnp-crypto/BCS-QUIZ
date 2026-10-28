"""Make any question set from the archive, with no new code.

    python3 archive/tools/pick.py --from bcs --subject বিজ্ঞান --n 50 --out set.json
    python3 archive/tools/pick.py --from jobs --paper 'sonali-*' --text 'সমাস'

Filters (all optional, combined with AND): --from collection, --paper glob on the
paper name, --subject (matches the paper's s field), --text (in the question).
Each question appears once, however many papers carry it; `x` lists them all.
"""
import argparse, fnmatch, glob, json, os, random
from common import *
from build_site import records

ap = argparse.ArgumentParser()
ap.add_argument('--from', dest='coll', default='*')
ap.add_argument('--paper', default='*')
ap.add_argument('--subject')
ap.add_argument('--text')
ap.add_argument('--n', type=int)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--out')
a = ap.parse_args()

recs = records()
picked, where = {}, {}
for p in sorted(glob.glob(os.path.join(ARCH, 'papers', a.coll, '*.json'))):
    name = os.path.splitext(os.path.basename(p))[0]
    for row in load(p)['items']:
        i = row['id']
        where.setdefault(i, []).append(name)
        if not fnmatch.fnmatch(name, a.paper):
            continue
        if a.subject and a.subject not in str(row.get('s', '')):
            continue
        if a.text and a.text not in recs[i]['q']:
            continue
        picked.setdefault(i, dict(recs[i], **{k: v for k, v in row.items() if k not in ('id', 'x')}))
ids = list(picked)
if a.n and a.n < len(ids):
    ids = random.Random(a.seed).sample(ids, a.n)
out = [dict(picked[i], id=i, x=where[i]) for i in ids]
print('%d questions' % len(out))
if a.out:
    dump(out, a.out)
