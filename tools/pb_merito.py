#!/usr/bin/env python3
"""মেরিটোর নতুনদের সূচি → plan/pb/merito.json (সাইট এটা দিয়েই নতুনদের তালা, তারিখ আর রুটিন দেখায়)।

উৎস (Lyanna_data): pilot/petrobangla-1/sheet-plan.md §২-এর ছক, অথবা LY Course-এর routines/merito-<তারিখ>.json
(যেটা দেওয়া হয়)। পাইলটের দিনের সঙ্গে মেলাতে plan/pb/routine.json (পাইলটের রুটিন) লাগে।

চালানো:
  python3 tools/pb_merito.py ../Lyanna_data/pilot/petrobangla-1/sheet-plan.md
  python3 tools/pb_merito.py ../Lyanna_data/pilot/petrobangla-1/routines/merito-2026-11-18.json

ফাইলের প্রতিটি পরীক্ষা: no, date (নতুনদের তারিখ), title, kind, sheet, n, min, আর সাইটের ঠিকানা:
  s  = সপ্তাহের সেট (pb-w1 …), pd = পাইলটের সেই পরীক্ষার তারিখ (সার্ভার সেটের ভাগ খোঁজে এই তারিখে),
  only = ১ হলে শুধু নতুনদের ভাগ (যেমন m1a; পাইলট দেখেন না), p = ভাগ-নম্বর জানা থাকলে সরাসরি।
s না থাকলে (বাড়তি মডেল টেস্ট, সেট এখনো ঠিক হয়নি) পাতায় "শিগগির"।"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BN = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')
MON = {'নভে': 11, 'ডিসে': 12, 'জানু': 1}
WD = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি', 'রবি']
KIND = {'পড়া': 'study', 'রিভিশন': 'revision', 'মডেল': 'model', 'বাড়তি': 'model', 'নিজের': 'weak', 'শেষ': 'model'}


def from_md(path):
    rows = []
    for l in Path(path).read_text(encoding='utf-8').splitlines():
        c = [x.strip() for x in l.strip().strip('|').split('|')]
        if len(c) != 4:
            continue
        m = re.match(r'^(\S+) (নভে|ডিসে|জানু) \S+$', c[0])
        e = re.match(r'^(\S+)\. (.+)$', c[1])
        if not m or not e:
            continue
        mo = MON[m[2]]
        date = f'{2027 if mo == 1 else 2026}-{mo:02d}-{int(m[1].translate(BN)):02d}'
        lesson = c[2] if c[2] != '—' else ''
        part = re.search(r'`([a-z0-9]+)`', lesson)
        rows.append({'no': int(e[1].translate(BN)), 'date': date, 'head': e[2], 'lesson': re.sub(r'\s*\(`[^`]*`\)', '', lesson),
                     'part': part[1] if part else '', 'sheet': c[3].strip('`') if c[3] != '—' else ''})
    return rows


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else ''
    if not src:
        sys.exit(__doc__)
    rt = json.loads((ROOT / 'plan/pb/routine.json').read_text(encoding='utf-8'))
    pilot = [d for d in rt['days'] if d.get('n') and d['kind'] != 'diag']  # পাইলটের পরীক্ষার দিন, ক্রমে
    if src.endswith('.json'):
        x = json.loads(Path(src).read_text(encoding='utf-8'))
        rows = x.get('exams') or x.get('days') or x
        exams = []
        for r in rows:
            exams.append({k: r[k] for k in ('no', 'date', 'title', 'kind', 'sheet', 'n', 'min', 's', 'p', 'pd', 'only') if r.get(k) not in (None, '')})
    else:
        rows = from_md(src)
        if len(rows) != 61 or rows[0]['part'] != 'm1a':
            sys.exit(f'ছকে ৬১টি পরীক্ষা আর প্রথমটা m1a আশা করেছিলাম; পেলাম {len(rows)}')
        exams = []
        for i, r in enumerate(rows):
            e = {'no': r['no'], 'date': r['date']}
            if i == 0:  # m1a: শুধু নতুনদের, সপ্তাহ ১-এর সেটে আলাদা ভাগ (LY Course, sheet-plan §৫.২)
                e.update(title=r['lesson'], kind='study', sheet=r['sheet'], n=30, min=25, s='pb-w1', p=7, only=1)  # ভাগ ৭ = pb-w1-এর শেষে নতুন ভাগ
            elif i <= len(pilot):  # বাকিগুলো পাইলটের পরীক্ষা, একই ক্রমে
                d = pilot[i - 1]
                if r['part'] and r['lesson'] and r['lesson'][:12] != d['title'][:12]:
                    sys.exit(f"পরীক্ষা {r['no']}: ছকের '{r['lesson']}' আর পাইলটের '{d['title']}' মেলেনি")
                e.update(title=d['title'], kind=d['kind'], **({'sheet': d['sheet']} if d.get('sheet') else {}),
                         n=d['n'], min=d['min'], s=f"pb-w{d['week']}", pd=d['date'])
            else:  # বাড়তি মডেল টেস্ট (৯-১৩ জানুয়ারি): সেট পরে
                e.update(title=re.sub(r'^বাড়তি ', '', r['head']), kind='model', n=70, min=60)
            exams.append(e)
    for e in exams:
        y, m, d = map(int, e['date'].split('-'))
        import datetime
        e['wd'] = WD[datetime.date(y, m, d).weekday()]
    out = {'src': 'Lyanna_data/pilot/petrobangla-1 (sheet-plan.md §২ বা LY Course-এর routines/merito-*.json); হাতে নয়, tools/pb_merito.py দিয়ে',
           'group': 'pb-merito', 'start': exams[0]['date'], 'end': exams[-1]['date'], 'exams_total': len(exams),
           'sheets': rt['sheets'], 'exams': exams}
    (ROOT / 'plan/pb/merito.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"plan/pb/merito.json: {len(exams)} পরীক্ষা, {out['start']} → {out['end']}, দিনে-দুটো: "
          + ', '.join(sorted({e['date'] for e in exams if sum(x['date'] == e['date'] for x in exams) > 1})))


if __name__ == '__main__':
    main()
