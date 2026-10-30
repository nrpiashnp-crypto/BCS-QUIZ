#!/usr/bin/env python3
"""Build the topic library's upload files from Lyanna_data (the one store), so the library uses
the same question ids (q + 10 hex) and topic ids (sci-light-refraction …) as every other export.

    python3 tools/library/from_lyanna.py --data ../lyanna_data --out /tmp/lib
    python3 tools/library/from_lyanna.py --data ../lyanna_data --out /tmp/lib --written bd_affairs_topics_clean.json
    python3 tools/library/from_lyanna.py --data ../lyanna_data --out /tmp/lib --units ../lyanna_data/dist/units.jsonl

  library-mcq.json.gz  {taxonomy:[…], mcq:[…]} → /admin/library/ "এমসিকিউ ব্যাংক তোলা"
  <written>.tagged.json  the written parts with topic_ids added → "নতুন অংশ তোলা"
  library-units.json   Lyanna_data written units as library parts → "নতুন অংশ তোলা". Read from dist/units.jsonl
                       of `tools/build_export.py` (default/all view: admin only, so source title/author stay;
                       anything public must come from `--publish own-words` instead).

Each MCQ: id, q, o, a, e, s (subject name), t (first topic name), topic_ids, exams, src [[label, url]].
Written parts get topic_ids by subject name and by exact alias match of their section/chapter titles
and tags against the taxonomy (same alias_key as tools/tag_mcq_auto.py). Run from the BCS-QUIZ repo.
"""
import argparse, gzip, json, os, sys

SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
bn = lambda s: str(s).translate(str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯'))


def site_labels():
    """site file path → (label, page url), from the same catalogs the site reads."""
    rd = lambda p: json.load(open(os.path.join(SITE, p), encoding='utf-8'))
    out = {}
    bc = rd('bcs/data/catalog.json')
    for e in bc['exams']:
        out[f"bcs/data/e/{e['id']}.json"] = (e['title'], f"/bcs/{e['no']}/")
    for x in bc.get('sets', []):
        out[f"bcs/data/s/{x['id']}.json"] = (f"বিসিএস প্রশ্নব্যাংক: {x['s']} সেট {bn(x['part'])}", f"/bcs/#/s/{x['k']}")
    for e in rd('jobs/data/catalog.json')['exams']:
        out[f"jobs/data/e/{e['id']}.json"] = (' '.join(x for x in [e.get('orgbn'), e.get('postbn'), bn(e.get('year', ''))] if x), f"/jobs/{e['id']}/")
    for k in ('petrobangla', 'sub-registrar'):
        p = f'running/{k}/data/plan.json'
        if os.path.exists(os.path.join(SITE, p)):
            pl = rd(p)
            for i in range(1, 100):
                x = ('pb' if k == 'petrobangla' else 'sr') + f'{i:02d}'
                out[f'running/{k}/data/x/{x}.json'] = (f"{pl.get('short', k)} টাস্ক {bn(i)}", f'/running/{k}/')
    sc = rd('subject/data/science.json')
    for t in sc['topics']:
        for x in t.get('sets', []):
            out[f"subject/data/t/{t['id']}/{x['id']}.json"] = (f"বিজ্ঞান: {t['name']}", t.get('page') or '/subject/')
        if t.get('page'):
            out[t['page'].strip('/') + '/index.html'] = out['chapter/' + t['id'][4:]] = (f"অধ্যায়: {t['name']}", t['page'])
    out['job-science/job-science'] = ('চাকরির পরীক্ষার বিজ্ঞান', '/job-science/')
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', default=os.path.join(SITE, '..', 'lyanna_data'))
    ap.add_argument('--out', required=True)
    ap.add_argument('--written', nargs='*', default=[])
    ap.add_argument('--units', help='dist/units.jsonl from Lyanna_data tools/build_export.py')
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(os.path.abspath(a.data), 'tools'))
    import lib  # Lyanna_data/tools/lib.py
    tax = lib.Taxonomy()
    os.makedirs(a.out, exist_ok=True)

    taxonomy = [{'id': s['id'], 'bn': s['bn'], 'parent': None, 'subject': s['id']} for s in tax.subjects.values() if tax.active(s)]
    taxonomy += [{'id': n['id'], 'bn': n['bn'], 'parent': n.get('parent') or tax.subject_of_topic(n['id']), 'subject': tax.subject_of_topic(n['id'])}
                 for n in tax.topics.values() if tax.active(n) and n['id'] not in tax.subjects]

    labels, src, seen_s, seen_t = site_labels(), {}, {}, {}
    for coll, name, paper in lib.papers():
        lab = labels.get(paper.get('src')) or labels.get(f'{coll}/{name}') or (f'{coll}/{name}', '')
        for row in paper.get('items', []):
            src.setdefault(row['id'], [])
            if list(lab) not in src[row['id']]:
                src[row['id']].append(list(lab))
            if row.get('s') and row['id'] not in seen_s: seen_s[row['id']] = row['s']
            if (row.get('t') or row.get('p')) and row['id'] not in seen_t: seen_t[row['id']] = row.get('t') or row.get('p')
    recs, tags = lib.records(), lib.tags()
    mcq = []
    for qid, r in sorted(recs.items()):
        tg = tags.get(qid, {})
        tops = [t for t in tg.get('topics') or [] if t in tax.topics]
        subj = tg.get('subject')
        ids = tops or ([subj] if subj else [])
        mcq.append({'id': qid, 'q': r.get('q', ''), 'o': r.get('o', []), 'a': r.get('a', -1), 'e': r.get('e') or '',
                    's': tax.subjects[subj]['bn'] if subj in tax.subjects else seen_s.get(qid, ''),
                    't': tax.topics[tops[0]]['bn'] if tops else seen_t.get(qid, ''),
                    'topic_ids': ids, 'exams': tg.get('exams') or [], 'src': src.get(qid, [])[:12]})
    # gzip: the admin page opens .json.gz itself, and the file is ~5x smaller to move around
    p = os.path.join(a.out, 'library-mcq.json.gz')
    with gzip.open(p, 'wt', encoding='utf-8') as f:
        json.dump({'taxonomy': taxonomy, 'mcq': mcq}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{p}: {len(taxonomy)} topics, {len(mcq)} MCQs, {sum(1 for m in mcq if m["topic_ids"])} with topic ids')

    subj_idx = tax.subject_by_alias()
    for w in a.written:
        parts = json.load(open(w, encoding='utf-8'))
        hit = 0
        for t in parts:
            subj = subj_idx.get(lib.alias_key(t.get('subject', '')))
            idx = tax.alias_index([i for i in tax.topics if subj and tax.subject_of_topic(i) == subj])
            found = []
            for text in [t.get('section_title', ''), t.get('parent_section', ''), t.get('chapter_title', '')] + list(t.get('tags', [])):
                for i in sorted(idx.get(lib.alias_key(text.split(' (')[0]), ())):
                    if i not in found: found.append(i)
            if found and found != [subj]: hit += 1
            t['topic_ids'] = [i for i in found if i != subj] or ([subj] if subj else [])
        q = os.path.join(a.out, os.path.basename(w).replace('.json', '.tagged.json'))
        json.dump(parts, open(q, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'{q}: {len(parts)} parts, {hit} with a topic below the subject')


    if a.units:
        reg = lib.registry().get('sources', {})
        name = lambda i: (tax.topics.get(i) or tax.subjects.get(i) or {}).get('bn', i)
        exam_bn = lambda i: (tax.exam_types.get(i) or tax.sittings.get(i) or {}).get('bn', i)
        parts = []
        for line in open(a.units, encoding='utf-8'):
            if not line.strip(): continue
            u = json.loads(line)
            if u.get('status', 'active') != 'active': continue
            tops = u.get('topics') or []
            chap = tax.chapter_of(tops[0]) if tops else u.get('subject')
            srcs = u.get('sources') or []
            s0 = srcs[0] if srcs else {}
            r0 = reg.get(s0.get('src'), {})
            label = ', '.join(x for x in [r0.get('title') or s0.get('src', ''), r0.get('author') or r0.get('publisher')] if x)
            parts.append({'id': u['id'], 'subject': name(u.get('subject')), 'exam': ', '.join(exam_bn(e) for e in u.get('exams') or []),
                          'chapter': None, 'chapter_title': name(chap) if chap else '', 'section_no': str(s0.get('sec') or ''),
                          'section_title': u.get('title', ''), 'parent_section': name(tops[0]) if tops and tops[0] != chap else '',
                          'kind': u.get('kind') or 'section', 'pages': str(s0.get('page') or ''), 'source': label,
                          'source_id': s0.get('src') or 'lyanna', 'topic_ids': tops or [u.get('subject')],
                          'tags': list(dict.fromkeys([name(t) for t in tops] + list(u.get('tags') or []) + [exam_bn(e) for e in u.get('exams') or []])),
                          'mcq_ids': u.get('mcq') or [], 'text': u.get('body', '')})
        q = os.path.join(a.out, 'library-units.json')
        json.dump(parts, open(q, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'{q}: {len(parts)} units')


main()
