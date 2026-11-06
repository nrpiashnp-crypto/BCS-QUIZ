#!/usr/bin/env python3
"""সংস্করণ-চিহ্ন আর বদলের খাতা (সাধারণ পাতার প্রশ্ন): LY Teacher-এর চাহিদা, Lyanna_data teacher/export-spec.md।

প্রতিটি দাগের সঙ্গে ফোন পাঠায় "kv.ev" (js/account.js-এর qVer): kv = সঠিক উত্তর + বিকল্প, ev = ব্যাখ্যার লেখা।
এখানে একই হিসাবে প্রতিটি প্রশ্নের এখনকার চিহ্ন রাখা হয়, আর আগের বারের সঙ্গে না মিললে খাতায় এক লাইন:
  admin/data/qver.tsv        qid, তারপর প্রতিটি রূপ "সঠিক ক্রম,kv,ev,প্রশ্নের ছাপ" (জেনারেটেড, হাতে বদলাবেন না)
                             একই id কয়েকটা ফাইলে ভিন্ন ব্যাখ্যাসহ থাকতে পারে (যেমন টপিক-ফাইল আর পরীক্ষার ফাইল), তাই সব রূপ
  admin/data/qver-log.jsonl  {"day","qid","what": key|opt|exp|q,"old","new"}; শুধু যোগ হয়, মোছা হয় না
  data/ux.json               ছাত্রের কথায় বদলানো ব্যাখ্যা (ধাপ ৩): প্রশ্নে "ux": "YYYY-MM" থাকলে {qid: [[ev, বদলের দিন, মাস], …]};
                             js/report.js ব্যাখ্যার নিচে "✎ ছাত্রের কথায় বদলানো" দেখায়, /account/ দেখায় "আপনার জানানো nটি ব্যাখ্যা বদলেছে"।
                             "ux" বসায় LY Quiz & Sheets, ছাত্রের মতামত দেখে ব্যাখ্যা নতুন করে লিখলে (lyanna-quiz স্কিল §৭)।
আলাদা চালাতে হয় না: tools/build_qmap.py শেষে নিজেই এটা চালায় (প্রশ্ন তোলার পরে যা চালানো হয়)।
পাইলট আর নির্ণয়-পরীক্ষার প্রশ্নের বদল D1-এর qver_log-এ (functions/api, GET /api/admin/qver)।
হিসাব তিন জায়গায় এক (এখানে, js/account.js, functions/api-র qVer); একটায় বদলালে তিনটাতেই।
"""
import datetime, json, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = os.path.join(R, 'admin/data/qver.tsv')
LOG = os.path.join(R, 'admin/data/qver-log.jsonl')
SEP = '\u0001'
UX = os.path.join(R, 'data/ux.json')


def fnv(s):
    """JS-এর charCodeAt-এর মতো UTF-16 একক ধরে FNV-1a, ৮ অক্ষরের hex।"""
    b, h = s.encode('utf-16-le'), 0x811c9dc5
    for i in range(0, len(b), 2):
        h = ((h ^ (b[i] | b[i + 1] << 8)) * 0x01000193) & 0xffffffff
    return format(h, '08x')


def ver(q):
    return [str(q['a']), fnv(str(q['a']) + SEP + SEP.join(str(x) for x in q.get('o') or [])),
            fnv(q.get('e') or ''), fnv(q.get('q') or '')]


def _pair(a, b):
    """আগের এক রূপ আর নতুন এক রূপ: কোন ঘর বদলাল।"""
    out = []
    if a[0] != b[0]:
        out.append(('key', a[1], b[1]))
    elif a[1] != b[1]:
        out.append(('opt', a[1], b[1]))
    if a[2] != b[2]:
        out.append(('exp', a[2], b[2]))
    if a[3] != b[3]:
        out.append(('q', a[3], b[3]))
    return out


def update(QQ):
    """QQ: qid → সেই id-র সব প্রশ্ন (যত ফাইলে আছে)।"""
    old = {}
    if os.path.exists(SNAP):
        for line in open(SNAP, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if len(p) >= 2:
                old[p[0]] = [tuple(x.split(',')) for x in p[1:]]
    new = {}
    for i, qs in QQ.items():
        vs = []
        for q in qs:
            v = tuple(ver(q))
            if v not in vs:
                vs.append(v)
        new[i] = vs
    day, rows = datetime.date.today().isoformat(), []
    for i in sorted(new):
        if i not in old:
            continue                       # নতুন প্রশ্ন বা প্রথম চালানো: বদল নয়
        gone = [v for v in old[i] if v not in new[i]]
        came = [v for v in new[i] if v not in old[i]]
        for a in gone:                     # প্রতিটি হারানো রূপের সবচেয়ে কাছের নতুন রূপ (না থাকলে সেটা শুধু সরানো)
            if came:
                b = min(came, key=lambda b: len(_pair(a, b)))
                rows += [(i,) + x for x in _pair(a, b)]
    if rows:
        with open(LOG, 'a', encoding='utf-8') as fh:
            for i, w, o, n in rows:
                fh.write(json.dumps({'day': day, 'qid': i, 'what': w, 'old': o, 'new': n}, ensure_ascii=False) + '\n')
    with open(SNAP, 'w', encoding='utf-8') as fh:
        for i in sorted(new):
            fh.write(i + '\t' + '\t'.join(','.join(v) for v in new[i]) + '\n')
    ux(QQ, day)
    many = sum(1 for v in new.values() if len(v) > 1)
    first = ' (প্রথম ছবি, খাতায় কিছু নয়)' if not old else ''
    print(f'সংস্করণ: {len(new)} প্রশ্ন, বদল {len(rows)}, একাধিক রূপ {many}{first}')



def ux(QQ, today):
    """ছাত্রের কথায় বদলানো ব্যাখ্যার তালিকা → data/ux.json (পাবলিক, ছোট; শুধু চিহ্ন, লেখা নয়)।"""
    import re
    when = {}                              # (qid, নতুন ev) → খাতায় সেই ব্যাখ্যা প্রথম যেদিন এল
    if os.path.exists(LOG):
        for line in open(LOG, encoding='utf-8'):
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if r.get('what') == 'exp':
                when.setdefault((r['qid'], r['new']), r['day'])
    out, bad = {}, 0
    for i, qs in QQ.items():
        for q in qs:
            m = q.get('ux')
            if not m:
                continue
            if not (isinstance(m, str) and re.fullmatch(r'20\d\d-(0[1-9]|1[0-2])', m)):
                bad += 1
                continue
            ev = fnv(q.get('e') or '')
            row = [ev, when.get((i, ev), ''), m]
            if row not in out.setdefault(i, []):
                out[i].append(row)
    os.makedirs(os.path.dirname(UX), exist_ok=True)
    with open(UX, 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'built': today, 'q': out}, fh, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f'ছাত্রের কথায় বদলানো: {len(out)} প্রশ্ন' + (f', ভুল ux {bad}টা (হতে হবে "YYYY-MM")' if bad else ''))

if __name__ == '__main__':
    import build_qmap
    build_qmap.main()
