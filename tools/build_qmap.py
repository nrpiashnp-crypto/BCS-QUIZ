#!/usr/bin/env python3
"""শিক্ষার্থীর পর্যালোচনার (/admin/review/) জন্য প্রশ্ন-মানচিত্র: প্রতিটি প্রশ্ন-id → টপিক, বিষয়, সঠিক উত্তর।

শুধু সাইটে আগে থেকেই পাবলিক থাকা প্রশ্ন-ফাইল থেকে বানায় (কোনো গোপন তথ্য নয়):
  subject/data/<বিষয়>.json আর subject/data/t/<টপিক>/*.json  → টপিক (সবচেয়ে নির্ভরযোগ্য)
  jobs/data/e, bcs/data/e, running/*/data/x                  → বিষয় (s) আর উত্তর (a)
  অধ্যায়-কুইজ পাতা (sound/index.html ইত্যাদি, প্রশ্ন পাতার ভেতরেই) → বিজ্ঞান, টপিক sci-<অধ্যায়>
ফল: admin/data/qmap.json (জেনারেটেড, হাতে বদলাবেন না)। প্রশ্ন তোলার পরে আবার চালান:
  python3 tools/build_qmap.py
"""
import glob, json, os, re, datetime

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'admin/data/qmap.json')
load = lambda p: json.load(open(p, encoding='utf-8'))

# টপিক-আইডির শুরু → বিষয়-কোড (subject/data-র বিষয়গুলো)
PREFIX = {'bn': 'bn', 'eng': 'eng', 'bda': 'bd', 'intl': 'intl', 'geo': 'geo', 'sci': 'sci', 'ict': 'ict',
          'math': 'math', 'mental': 'mental', 'ethics': 'ethics', 'econ': 'econ', 'law': 'law', 'ca': 'ca'}
SUBJ = [('bn', 'বাংলা'), ('eng', 'ইংরেজি'), ('bd', 'বাংলাদেশ বিষয়াবলি'), ('intl', 'আন্তর্জাতিক বিষয়াবলি'),
        ('geo', 'ভূগোল ও পরিবেশ'), ('sci', 'সাধারণ বিজ্ঞান'), ('ict', 'কম্পিউটার ও আইসিটি'), ('math', 'গাণিতিক যুক্তি'),
        ('mental', 'মানসিক দক্ষতা'), ('ethics', 'নৈতিকতা ও সুশাসন'), ('econ', 'অর্থনীতি'), ('law', 'আইন'),
        ('ca', 'সাম্প্রতিক'), ('gk', 'সাধারণ জ্ঞান ও অন্যান্য')]
SI = {c: i for i, (c, _) in enumerate(SUBJ)}
# প্রশ্ন-ফাইলের s (বিষয়ের নাম) → কোড; আগে যেটা মেলে
WORDS = [('ইংরেজি', 'eng'), ('english', 'eng'), ('বাংলাদেশ', 'bd'), ('বাংলা', 'bn'), ('আন্তর্জাতিক', 'intl'),
         ('ভূগোল', 'geo'), ('পরিবেশ', 'geo'), ('বিজ্ঞান', 'sci'), ('কম্পিউটার', 'ict'), ('আইসিটি', 'ict'), ('তথ্যপ্রযুক্তি', 'ict'),
         ('গণিত', 'math'), ('গাণিতিক', 'math'), ('মানসিক', 'mental'), ('নৈতিকতা', 'ethics'), ('সুশাসন', 'ethics'),
         ('অর্থনীতি', 'econ'), ('ব্যাংক', 'econ'), ('হিসাব', 'econ'), ('আইন', 'law'), ('সাম্প্রতিক', 'ca')]


def subj_code(s):
    s = (s or '').strip().lower()
    for w, c in WORDS:
        if w in s:
            return c
    return 'gk'


def main():
    T, TI = [], {}                         # টপিক: [id, নাম, বিষয়-ক্রম]
    for f in sorted(glob.glob(os.path.join(R, 'subject/data/*.json'))):
        d = load(f)
        for t in d.get('topics', []):
            c = PREFIX.get(t['id'].split('-')[0], 'gk')
            TI[t['id']] = len(T)
            T.append([t['id'], t.get('name', t['id']), SI[c]])
    Q = {}                                 # qid → [টপিক-ক্রম বা -1, বিষয়-ক্রম, সঠিক, বিকল্পের সংখ্যা]

    def put(q, t=-1, s=None):
        i = q.get('id')
        if not i or not isinstance(q.get('a'), int):
            return
        old = Q.get(i)
        if old:
            if t >= 0 and old[0] < 0:
                old[0], old[1] = t, T[t][2]
            return
        Q[i] = [t, T[t][2] if t >= 0 else SI[s or subj_code(q.get('s'))], q['a'], len(q.get('o') or []) or 4]

    def lists(d):
        return [d] if isinstance(d, list) else [v for v in d.values() if isinstance(v, list)] if isinstance(d, dict) else []

    for d in sorted(glob.glob(os.path.join(R, 'subject/data/t/*'))):
        t = TI.get(os.path.basename(d))
        if t is None:
            continue
        for f in sorted(glob.glob(d + '/*.json')):
            try:
                for L in lists(load(f)):
                    for q in L:
                        if isinstance(q, dict):
                            put(q, t)
            except ValueError:
                pass
    for pat in ['bcs/data/e/*.json', 'jobs/data/e/*.json', 'running/*/data/x/*.json']:
        for f in sorted(glob.glob(os.path.join(R, pat))):
            try:
                for L in lists(load(f)):
                    for q in L:
                        if isinstance(q, dict):
                            put(q)
            except ValueError:
                pass
    # অধ্যায়-কুইজ: প্রশ্ন পাতার ভেতরে {"id": "q…", "q": …, "a": n}
    rx, dec = re.compile(r'\{"id": *"q[0-9a-f]{10}", *"q":'), json.JSONDecoder()
    for f in sorted(glob.glob(os.path.join(R, '*/index.html'))):
        slug = os.path.basename(os.path.dirname(f))
        if slug in ('jobs', 'bcs', 'subject', 'running', 'admin', 'account', 'plan', 'pilot', 'challenge'):
            continue
        t, text = TI.get('sci-' + slug, -1), open(f, encoding='utf-8').read()
        for m in rx.finditer(text):
            try:
                q = dec.raw_decode(text, m.start())[0]
            except ValueError:
                continue
            put(q, t, 'sci')
    out = {'v': 1, 'built': datetime.date.today().isoformat(), 'S': SUBJ, 'T': T, 'Q': Q}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    tp = sum(1 for v in Q.values() if v[0] >= 0)
    print(f'{len(Q)} প্রশ্ন, টপিকসহ {tp}, টপিক {len(T)} → {os.path.relpath(OUT, R)} ({os.path.getsize(OUT) // 1024} KB)')


if __name__ == '__main__':
    main()
