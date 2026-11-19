#!/usr/bin/env python3
"""বুদ্ধির গেমের পর্যায়-তালিকা বানায়: game/data/s*.json → game/data/stages.json (হাতে বদলাবেন না)।
নতুন পর্যায় যোগ বা নাম বদলের পরে চালান: python3 tools/game_index.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'game' / 'data'
out = []
for f in sorted(root.glob('s[0-9][0-9].json')):
    s = json.loads(f.read_text(encoding='utf-8'))
    out.append({k: s[k] for k in ('id', 'n', 'name', 'sub', 'band', 'tone', 'emblem')})
out.sort(key=lambda x: x['n'])
(root / 'stages.json').write_text(json.dumps({'stages': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(out), 'টা পর্যায় →', root / 'stages.json')
