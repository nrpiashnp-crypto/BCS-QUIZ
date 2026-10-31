#!/usr/bin/env python3
"""একজন শিক্ষার্থীর ফল থেকে দিন-শেষের ডেটা-যাচাই আর দুর্বলতার রিপোর্ট।

ইনপুট: /admin/learners/ পাতার "JSON নামান" বোতামে নামানো ফাইল (learner-<id>-<তারিখ>.json)।
প্রশ্নের id থেকে বিষয়, টপিক আর সঠিক উত্তর নেওয়া হয় সাইটের প্রশ্ন-ফাইল থেকে
(running/*/data/x, jobs/data/e, bcs/data, subject/data)। কোনো গোপন তথ্য এই রিপোতে লাগে না।

ব্যবহার:
  python3 tools/learner_report.py learner-12-2026-11-01.json            # সব দিন
  python3 tools/learner_report.py learner-12-2026-11-01.json --day 2026-11-01
  python3 tools/learner_report.py learner.json --out report.md

রিপোর্টে:
  ১. ডেটা-যাচাই: প্রতিটি পরীক্ষায় উত্তর-তালিকা আছে কি না, প্রশ্ন-সংখ্যা = n কি না,
     দাগানো = সঠিক + ভুল কি না, প্রশ্ন-ফাইলের উত্তর দিয়ে আবার গুনলে সঠিক মেলে কি না।
  ২. বিষয় আর টপিক ধরে: মোট প্রশ্ন, সঠিক, ভুল, ফাঁকা, সঠিকের হার, দাগানো প্রশ্নে ভুলের হার।
     একই প্রশ্ন একাধিকবার এলে শুধু প্রথমবারেরটা গোনা হয় (আবার দেওয়া পরীক্ষা মাপ বাড়ায় না)।
  ৩. বারবার ভুল হওয়া প্রশ্নের id (নোট লেখার জন্য)।
"""
import argparse, glob, json, os, sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DHAKA = timezone(timedelta(hours=6))


def load_questions():
    """id → {s, t, a}; সাইটের সব JSON প্রশ্ন-ফাইল থেকে।"""
    bank = {}
    pats = ['running/*/data/x/*.json', 'jobs/data/e/*.json', 'bcs/data/**/*.json', 'subject/data/**/*.json']
    for pat in pats:
        for f in glob.glob(os.path.join(ROOT, pat), recursive=True):
            try:
                d = json.load(open(f, encoding='utf-8'))
            except Exception:
                continue
            lists = [d] if isinstance(d, list) else [v for v in d.values() if isinstance(v, list)] if isinstance(d, dict) else []
            for L in lists:
                for q in L:
                    if isinstance(q, dict) and q.get('id') and 'a' in q and q['id'] not in bank:
                        # চলমান কোর্সে টপিক-কোড কোর্সভেদে আলাদা অর্থের (দুই কোর্সেই M1), তাই কোর্সের নামসহ
                        rel = os.path.relpath(f, ROOT).split(os.sep)
                        t = q.get('t') or ''
                        if rel[0] == 'running' and t:
                            t = rel[1] + ':' + t
                        bank[q['id']] = {'s': q.get('s') or '', 't': t, 'a': q.get('a')}
    return bank


def topic_names():
    names = {}
    for f in glob.glob(os.path.join(ROOT, 'running/*/data/plan.json')):
        key = os.path.relpath(f, ROOT).split(os.sep)[1]
        try:
            for c, nm in (json.load(open(f, encoding='utf-8')).get('topics') or {}).items():
                names[key + ':' + c] = nm
        except Exception:
            pass
    return names


def day(ts):
    return datetime.fromtimestamp(ts / 1000, DHAKA).strftime('%Y-%m-%d')


def pct(a, b):
    return f'{round(100 * a / b)}%' if b else '—'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--day', help='শুধু এই দিন (YYYY-MM-DD, ঢাকার সময়)')
    ap.add_argument('--out')
    o = ap.parse_args()
    data = json.load(open(o.file, encoding='utf-8'))
    bank, names = load_questions(), topic_names()
    att = sorted(data.get('att') or [], key=lambda a: a['ts'])
    if o.day:
        att = [a for a in att if day(a['ts']) == o.day]
    u = data.get('user') or {}
    out = [f"# {u.get('name', '')} · ফলের রিপোর্ট", '',
           f"ফাইল: {os.path.basename(o.file)} · পরীক্ষা: {len(att)}" + (f" · দিন: {o.day}" if o.day else ''), '']

    # ১. ডেটা-যাচাই
    out += ['## ১. ডেটা-যাচাই', '', '| দিন | সময় | পরীক্ষা | n | সঠিক | ভুল | উত্তর-তালিকা | ফল |', '|---|---|---|---|---|---|---|---|']
    problems = 0
    for a in att:
        qd, issues = a.get('qd'), []
        if not qd:
            issues.append('উত্তর-তালিকা নেই')
        else:
            if len(qd) != a.get('n'):
                issues.append(f"প্রশ্ন {len(qd)} ≠ n {a.get('n')}")
            ans = [x for x in qd if x[1] >= 0]
            if a.get('ok') is not None and a.get('no') is not None and len(ans) != a['ok'] + a['no']:
                issues.append(f"দাগানো {len(ans)} ≠ সঠিক+ভুল {a['ok'] + a['no']}")
            known = [x for x in ans if x[0] in bank]
            if len(known) == len(ans) and a.get('ok') is not None:
                ok2 = sum(1 for x in known if x[1] == bank[x[0]]['a'])
                if ok2 != a['ok']:
                    issues.append(f"আবার গুনে সঠিক {ok2} ≠ {a['ok']}")
            miss = sum(1 for x in qd if x[0] not in bank)
            if miss:
                issues.append(f"{miss}টি প্রশ্ন প্রশ্ন-ফাইলে মেলেনি")
        problems += bool(issues)
        t = datetime.fromtimestamp(a['ts'] / 1000, DHAKA).strftime('%H:%M')
        out.append(f"| {day(a['ts'])} | {t} | {a.get('t', '')} | {a.get('n')} | {a.get('ok')} | {a.get('no')} | {len(qd) if qd else '—'} | {'ঠিক আছে' if not issues else '; '.join(issues)} |")
    out += ['', f"**{'সব ঠিক আছে' if not problems else f'{problems}টি পরীক্ষায় সমস্যা'}**", '']

    # ২. বিষয় আর টপিক ধরে (প্রতিটি প্রশ্নের প্রথম দেখা)
    seen, wrong_ids = set(), defaultdict(int)
    bys, byt = defaultdict(lambda: [0, 0, 0, 0]), defaultdict(lambda: [0, 0, 0, 0])  # মোট, সঠিক, ভুল, ফাঁকা
    for a in att:
        for qid, p in a.get('qd') or []:
            q = bank.get(qid)
            if not q:
                continue
            if p >= 0 and p != q['a']:
                wrong_ids[qid] += 1
            if qid in seen:
                continue
            seen.add(qid)
            k = 0 if p < 0 else (1 if p == q['a'] else 2)
            for d, key in ((bys, q['s']), (byt, q['t'])):
                d[key][0] += 1
                d[key][3 if k == 0 else k] += 1
    def table(title, d, label):
        rows = [f'## {title}', '', f'| {label} | প্রশ্ন | সঠিক | ভুল | ফাঁকা | সঠিকের হার | দাগানোয় ভুলের হার |', '|---|---|---|---|---|---|---|']
        for key, (n, ok, no, bl) in sorted(d.items(), key=lambda kv: kv[1][1] / kv[1][0] if kv[1][0] else 0):
            nm = f'{key} {names[key]}' if key in names else key
            rows.append(f'| {nm} | {n} | {ok} | {no} | {bl} | {pct(ok, n)} | {pct(no, ok + no)} |')
        return rows + ['']
    tot = [sum(v[i] for v in bys.values()) for i in range(4)]
    out += [f"মোট আলাদা প্রশ্ন {tot[0]}: সঠিক {tot[1]} ({pct(tot[1], tot[0])}), ভুল {tot[2]}, ফাঁকা {tot[3]}; দাগানো প্রশ্নে ভুলের হার {pct(tot[2], tot[1] + tot[2])}.", '']
    out += table('২. বিষয় ধরে (দুর্বল থেকে শক্ত)', bys, 'বিষয়')
    out += table('৩. টপিক ধরে (দুর্বল থেকে শক্ত)', byt, 'টপিক')

    rep = sorted((k for k, v in wrong_ids.items() if v >= 2), key=lambda k: -wrong_ids[k])
    out += ['## ৪. একাধিকবার ভুল হওয়া প্রশ্ন', '', ', '.join(rep) if rep else 'নেই', '']
    text = '\n'.join(out)
    if o.out:
        open(o.out, 'w', encoding='utf-8').write(text)
        print(o.out)
    else:
        sys.stdout.write(text)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
