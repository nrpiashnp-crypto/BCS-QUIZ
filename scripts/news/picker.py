"""সাপ্তাহিক "News Picker" ধাঁচের PDF থেকে গুরুত্বপূর্ণ ঘটনার তালিকা (PIASH, ২০২৬-১১-২০)।

PDF-গুলো অন্য প্রতিষ্ঠানের — এখান থেকে নেওয়া হয় শুধু **কোন ঘটনা, কবে, কোন ভাগে** আর খোঁজার শব্দ।
কোনো লেখা সাইটে যায় না: তথ্য আর লেখা আসে মূল পত্রিকা থেকে (archive.py → run_daily-এর যাচাই)।

কাজ দুই ধাপে:
1. extract: ~/Lyanna-Backup/news-bot/pdf/*.pdf → Gemini PDF পড়ে ঘটনার তালিকা →
   ~/Lyanna-Backup/news-bot/picker/<pdf-নাম>.json (একবারই; প্রতি খেপে কয়েকটা PDF)।
2. run_daily --archive সেই দিনের (±১ দিন) ঘটনা নেয়: শিরোনামে মিললে দলটার চমক-মান বাড়ে (৮+, তাই লেখা হয়),
   না মিললে summary.md-তে "PDF-এর ঘটনা, মূল খবর মেলেনি" তালিকা।

হাতে: python3 scripts/news/picker.py extract --max 3   |   python3 scripts/news/picker.py show 2026-03-15
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

from common import gemini_json, log

BOT = Path(os.environ.get("LYANNA_NEWS_BOT", Path.home() / "Lyanna-Backup" / "news-bot"))
PDF_DIR = BOT / "pdf"
OUT = BOT / "picker"
FROM = dt.date(2026, 1, 1)
MAX_PDF_MB = 14                    # এর বড় PDF Gemini-তে একবারে যায় না (inline সীমা ~২০ MB base64-এ)
MODELS = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.6-flash"]   # আজকের লেখা মূলত 3.6-flash-এ, তাই সেটা শেষে; flash-lite বাংলা অঙ্ক ভুল পড়ে

PROMPT = """এটা বাংলাদেশের চাকরির পরীক্ষার জন্য এক সপ্তাহের সাম্প্রতিক ঘটনার সংকলন (PDF)।
এর লেখা হুবহু নেবে না। শুধু ঘটনার তালিকা বানাও — প্রতিটা আলাদা ঘটনা একবার:
- date: ঘটনা যেদিন ঘটেছে/ঘোষণা হয়েছে, YYYY-MM-DD (পাতায় তারিখ না থাকলে null; সাল নিশ্চিত না হলে PDF-এর সপ্তাহ ধরে)
- topic: নিজের ভাষায় ৮-১৫ শব্দে কী ঘটেছে (বাংলায়)
- section: "bd" (বাংলাদেশ) | "intl" (আন্তর্জাতিক) | "gk" (রেকর্ড, পুরস্কার, সূচক, দিবস, খেলা, বিজ্ঞান)
- kind: "event" | "day" (দিবস/প্রতিপাদ্য) | "report" (সূচক/র‍্যাংকিং/প্রতিবেদন) | "summit" | "award" | "sports" | "appointment" | "law" | "other"
- keys: পত্রিকার শিরোনামে খুঁজে পাওয়ার মতো ৩-৬টা মূল শব্দ — নাম, সংস্থা, স্থান, সংখ্যা; বাংলা আর ইংরেজি দুই রূপই
বিজ্ঞাপন, অনুশীলনী প্রশ্ন, সূচিপত্র বাদ।
JSON: {"week": "YYYY-MM-DD থেকে YYYY-MM-DD", "events": [{"date": ..., "topic": ..., "section": ..., "kind": ..., "keys": [...]}]}"""


def _out(pdf: Path) -> Path:
    return OUT / (pdf.stem + ".json")


def todo() -> list[Path]:
    return sorted(p for p in PDF_DIR.glob("*.pdf") if not _out(p).exists())


def extract_one(pdf: Path) -> dict:
    size = pdf.stat().st_size
    if size > MAX_PDF_MB * 1024 * 1024:
        res = {"skipped": f"বড় ফাইল ({size // 1048576} MB)", "events": []}
    else:
        raw = gemini_json(PROMPT, MODELS, files=[("application/pdf", pdf.read_bytes())], temperature=0.0)
        if isinstance(raw, list):
            raw = {"events": raw}
        evs = []
        for e in (raw or {}).get("events", []) or []:
            if not isinstance(e, dict) or not e.get("topic"):
                continue
            d = str(e.get("date") or "")[:10]
            evs.append({"date": d if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) else None, "topic": str(e["topic"])[:200],
                        "section": e.get("section") if e.get("section") in ("bd", "intl", "gk") else "bd",
                        "kind": str(e.get("kind") or "other"),
                        "keys": [str(k)[:40] for k in (e.get("keys") or []) if str(k).strip()][:8]})
        res = {"week": (raw or {}).get("week"), "events": evs}
    res["pdf"] = pdf.name
    res["at"] = dt.datetime.now().isoformat(timespec="seconds")
    OUT.mkdir(parents=True, exist_ok=True)
    _out(pdf).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


def extract(max_n: int = 3) -> int:
    n = 0
    for pdf in todo()[:max_n]:
        try:
            res = extract_one(pdf)
            log(f"PDF পড়া: {pdf.name} → {len(res['events'])}টা ঘটনা" + (f" ({res['skipped']})" if res.get("skipped") else ""))
            n += 1
        except Exception as e:  # noqa: BLE001  (দিনের সীমা শেষ ইত্যাদি — পরের খেপে)
            log(f"PDF পড়া গেল না: {pdf.name} — {e}")
            break
    return n


def all_events() -> list[dict]:
    out = []
    for f in sorted(OUT.glob("*.json")):
        try:
            out += json.loads(f.read_text(encoding="utf-8")).get("events", [])
        except (OSError, json.JSONDecodeError):
            continue
    return out


def events_for(day: dt.date, window: int = 1) -> list[dict]:
    """সেই দিনের (±window) ঘটনা; একই বিষয় দুই PDF-এ থাকলে একবার।"""
    lo, hi = (day - dt.timedelta(days=window)).isoformat(), (day + dt.timedelta(days=window)).isoformat()
    seen, out = set(), []
    for e in all_events():
        if e.get("date") and lo <= e["date"] <= hi:
            k = e["topic"][:40]
            if k not in seen:
                seen.add(k)
                out.append(e)
    return out


def _norm(s: str) -> str:
    return re.sub(r"[\s\-‘’'\"“”,.:;()।]+", " ", (s or "").lower()).strip()


def hit(event: dict, text: str) -> int:
    """শিরোনাম/বিষয়ে ঘটনার কয়টা মূল শব্দ মেলে।"""
    t = _norm(text)
    return sum(1 for k in event.get("keys", []) if len(_norm(k)) >= 3 and _norm(k) in t)


def mark_groups(groups: list[dict], events: list[dict], boost: int = 8) -> tuple[int, list[dict]]:
    """PDF-এর ঘটনার সঙ্গে মেলা দলের চমক-মান বাড়ানো। ফল: (কয়টা দল বাড়ল, না-মেলা ঘটনা)।"""
    used, n = set(), 0
    for g in groups:
        text = " ".join([g.get("topic", "")] + [m.get("title", "") for m in g.get("members", [])])
        best = max(range(len(events)), key=lambda i: hit(events[i], text), default=None)
        if best is not None and hit(events[best], text) >= 2:
            used.add(best)
            if g.get("score", 0) < boost:
                g["score"] = boost
            g["picker"] = events[best]["topic"]
            n += 1
    return n, [e for i, e in enumerate(events) if i not in used]


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("extract")
    a.add_argument("--max", type=int, default=3)
    s = sub.add_parser("show")
    s.add_argument("date")
    args = ap.parse_args()
    if args.cmd == "extract":
        extract(args.max)
        print(f"বাকি PDF: {len(todo())}টা")
    else:
        for e in events_for(dt.date.fromisoformat(args.date)):
            print(e["date"], e["section"], e["kind"], "|", e["topic"], "|", ", ".join(e["keys"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
