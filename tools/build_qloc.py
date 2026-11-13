#!/usr/bin/env python3
"""অ্যাডমিনের রিপোর্ট পাতার (/admin/reports/) জন্য: প্রতিটি প্রশ্ন-id কোন পাতায় আছে।

পড়ে সাইটের তৈরি পাতাগুলো (প্রশ্নপত্র /bcs/<n>/, /jobs/<id>/, অধ্যায়ের /<অধ্যায়>/mcq/ ইত্যাদি), যেখানে প্রতিটি প্রশ্ন
<li class="q" data-id="q…"> হয়ে প্রশ্ন, উত্তর আর ব্যাখ্যাসহ খোলা থাকে।
ফল: admin/data/qloc/<qid-এর ২-৩ অক্ষর>.json = {qid: ["/bcs/50/", …]} (জেনারেটেড, হাতে বদলাবেন না)।
২৫৬ ভাগে রাখা, যাতে অ্যাডমিন পাতা শুধু দরকারি ভাগ নামায়। লিংক হয় <পাতা>#id=<qid>; js/report.js প্রশ্নে নিয়ে যায়।
tools/seo_build.py শেষে নিজেই এটা চালায়; আলাদা চালাতে:
  python3 tools/build_qloc.py
"""
import glob, json, os, re, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RX = re.compile(r'data-id="(q[0-9a-f]{10})"')
SKIP = ('admin', 'account', 'node_modules', '.wrangler', '.git')
# একই প্রশ্ন কয়েক পাতায় থাকলে আগে প্রশ্নপত্র, তারপর অধ্যায়, তারপর বাকি
ORDER = lambda p: (0 if p.startswith(('/bcs/', '/jobs/', '/running/')) else 1 if p.endswith('/mcq/') else 2, p)


def main(root=R, out=None):
    out = out or os.path.join(root, 'admin/data/qloc')
    L = {}
    for f in glob.glob(os.path.join(root, '**/index.html'), recursive=True):
        rel = os.path.relpath(f, root)
        if rel.split(os.sep)[0] in SKIP:
            continue
        try:
            ids = set(RX.findall(open(f, encoding='utf-8').read()))
        except (OSError, UnicodeDecodeError):
            continue
        page = '/' + os.path.dirname(rel).replace(os.sep, '/') + '/' if os.path.dirname(rel) else '/'
        for q in ids:
            L.setdefault(q, []).append(page)
    parts = {}
    for q, ps in L.items():
        parts.setdefault(q[1:3], {})[q] = sorted(set(ps), key=ORDER)[:5]
    os.makedirs(out, exist_ok=True)
    for k in ['%02x' % i for i in range(256)]:
        with open(os.path.join(out, k + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(dict(sorted(parts.get(k, {}).items())), fh, ensure_ascii=False, separators=(',', ':'))
    print(f'qloc: {len(L)} প্রশ্ন → {os.path.relpath(out, root)}/ (২৫৬ ভাগ)')


if __name__ == '__main__':
    main(*(sys.argv[1:3]))
