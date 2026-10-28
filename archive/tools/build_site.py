"""Rebuild the site's question files from the archive.

    python3 archive/tools/build_site.py --check   # compare with what is live, write nothing
    python3 archive/tools/build_site.py           # write every paper back to its place

Each paper becomes exactly the list the page reads today: the archive record
(q, o, a, e) with the paper's own fields laid over it.
"""
import glob, json, os, sys
from common import *

def records():
    recs = {}
    for f in glob.glob(os.path.join(ARCH, 'q', '*.json')):
        recs.update(load(f))
    return recs

def expand(paper, recs):
    out = []
    for row in paper['items']:
        it = dict(recs[row['id']])
        it.update({k: v for k, v in row.items() if k != 'id'})
        out.append(it)
    return out

def main(check):
    recs = records()
    bad = 0
    papers = sorted(glob.glob(os.path.join(ARCH, 'papers', '*', '*.json')))
    for p in papers:
        paper = load(p)
        items = expand(paper, recs)
        target = abspath(paper['src'])
        if not os.path.exists(target):
            print('SKIPPED (not on this machine)', paper['src'])
            continue
        if check:
            if read_items(paper['kind'], target) != items:
                bad += 1
                print('DIFFERS', paper['src'])
            continue
        if paper['kind'] == 'file':
            dump(items, target)
        else:
            html = open(target, encoding='utf-8').read()
            s, e = find_inline(html)
            html = html[:s] + json.dumps(items, ensure_ascii=False) + html[e:]
            open(target, 'w', encoding='utf-8').write(html)
    print('%d papers, %d records, %d differ' % (len(papers), len(recs), bad))
    return bad

if __name__ == '__main__':
    sys.exit(1 if main('--check' in sys.argv) else 0)
