"""Build the archive from the questions currently on the site.

    python3 archive/tools/import_site.py

Writes archive/q/<xx>.json (one record per unique question, keyed by a stable id)
and archive/papers/<collection>/<name>.json (each paper = ordered list of ids plus
the fields that belong to that paper). Re-running is safe: ids are stable (hash of the
normalised question and options) and records already in the archive are kept, so
run it after any upload that wrote straight to the site files.
"""
import collections, json, os, shutil
from common import *

import glob
# Existing records win: an explanation fixed in the archive stays fixed, and the
# site copies that differ from it are kept as that paper's own fields.
records = {}            # id -> {q,o,a,e}
for f in glob.glob(os.path.join(ARCH, 'q', '*.json')):
    records.update(load(f))
known = set(records)
seen_in = collections.defaultdict(list)
conflicts = []
papers = {}

for coll, kind, path in source_files():
    items = []
    for it in read_items(kind, path):
        i = qid(key(it))
        if i not in records:
            records[i] = {k: it[k] for k in CORE if k in it}
        rec = records[i]
        if norm(rec['o'][rec['a']]) != norm(it['o'][it['a']]):
            conflicts.append({'id': i, 'paper': rel(path), 'q': it['q'],
                              'archive': rec['o'][rec['a']], 'here': it['o'][it['a']]})
        row = {'id': i}
        for k, v in it.items():
            if k in CORE and rec.get(k) == v:
                continue
            row[k] = v
        items.append(row)
        seen_in[i].append(rel(path))
    papers[paper_path(coll, path)] = {'src': rel(path), 'kind': kind, 'items': items}

for d in ('q', 'papers'):
    shutil.rmtree(os.path.join(ARCH, d), ignore_errors=True)
shards = collections.defaultdict(dict)
for i, rec in records.items():
    shards[shard(i)][i] = rec
for s, recs in shards.items():
    dump_lines(dict(sorted(recs.items())), os.path.join(ARCH, 'q', s + '.json'))
for p, paper in papers.items():
    dump_lines(paper, p)

total = sum(len(v) for v in seen_in.values())
multi = sum(1 for v in seen_in.values() if len(v) > 1)
diff_e = sum(1 for p in papers.values() for r in p['items'] if 'e' in r)
used = set(seen_in)
report = {'new_questions_this_run': len(used - known) if known else len(used),
          'unused_records': len(set(records) - used),
          'items_on_site': total, 'unique_questions': len(records),
          'questions_in_2plus_places': multi, 'copies_with_own_explanation': diff_e,
          'answer_conflicts': len(conflicts), 'papers': len(papers)}
dump(report, os.path.join(ARCH, 'report.json'), pretty=True)
dump(conflicts, os.path.join(ARCH, 'conflicts.json'), pretty=True)
print(json.dumps(report, ensure_ascii=False, indent=1))
