"""আজকের ঘটনা — পুরো ধারা এক জায়গায়। GitHub Actions রোজ রাতে এটা চালায়।

    python3 scripts/news/run_daily.py                 # আজকের দিন
    python3 scripts/news/run_daily.py --date 2026-11-04 --dry-run   # ফাইল না লিখে শুধু দেখা

--summary: ফলাফলের ছোট বিবরণ (Actions-এর পাতায় দেখায়)। "অ্যাডমিনের কাছে" তালিকা সেখানেই থাকে,
রিপোতে নয় (যাচাই না-হওয়া লেখা পাবলিক রিপোতে রাখা হয় না)।
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from build import TOP_N, update_index, update_month, write_day  # noqa: E402
from collect import collect  # noqa: E402
from common import CALLS, DHAKA, NEWS_DIR, domain, log, now_dhaka, read_json  # noqa: E402
from pick import MAX_WRITE, gather_texts, group, write  # noqa: E402
from verify import check_item  # noqa: E402

MAX_HEADLINES = 350


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD (ঢাকার সময়); না দিলে আজ")
    ap.add_argument("--dry-run", action="store_true", help="news/-এ কিছু লেখা হবে না")
    ap.add_argument("--summary", help="ফলাফলের Markdown কোথায় লিখবে")
    ap.add_argument("--force", action="store_true", help="হাতে বানানো (manual) দিনের ফাইলও বদলাবে")
    args = ap.parse_args()

    today = now_dhaka().date()
    date = dt.date.fromisoformat(args.date) if args.date else today
    until = now_dhaka() if date >= today else dt.datetime.combine(date, dt.time(23, 59), DHAKA)
    ds = date.isoformat()
    old = read_json(NEWS_DIR / "day" / f"{ds}.json") or {}
    if str(old.get("method", "")).startswith("manual") and not args.force:
        log("এই দিনের ফাইল হাতে বানানো — বদলানো হবে না, শুধু ফলাফল দেখানো হবে (--force দিলে বদলাবে)")
        args.dry_run = True

    items, health = collect(until)
    items.sort(key=lambda x: x["time"] or "", reverse=True)
    items = items[:MAX_HEADLINES]
    log(f"মোট শিরোনাম: {len(items)}")
    if len(items) < 10:
        report(args.summary, ds, [], [], health, "খুব কম শিরোনাম এল — ফিডগুলো দেখতে হবে। আজ কিছু প্রকাশ হয়নি।")
        return 1

    groups = group(items)
    multi = [g for g in groups if len({domain(m["url"]) for m in g["members"]}) >= 2]
    single = [g for g in groups if g not in multi and g["score"] >= 7]
    log(f"দল: {len(groups)}, একাধিক উৎস: {len(multi)}")

    allow = {float(date.year), float(date.month), float(date.day)}
    published, review = [], []
    for g in single[:10]:
        review.append({"title": g["topic"], "score": g["score"], "why": ["মাত্র একটা উৎসে পাওয়া গেছে"],
                       "links": [m["url"] for m in g["members"]][:3]})
    for g in multi[:MAX_WRITE]:
        texts = gather_texts(g["members"])
        links = [t["url"] for t in texts] or [m["url"] for m in g["members"]][:3]
        if len({t["domain"] for t in texts}) < 2:
            review.append({"title": g["topic"], "score": g["score"], "why": ["দুটো উৎসের পাতা খোলা গেল না"],
                           "links": links})
            continue
        try:
            res = write(g, texts)
        except RuntimeError as e:
            log(f"  লেখা গেল না: {e}")
            review.append({"title": g["topic"], "score": g["score"], "why": [str(e)[:200]], "links": links})
            continue
        if not res:
            continue
        ok, why = check_item(res, texts, allow)
        used = {texts[ev["src"]]["domain"] for f in res.get("facts", []) for ev in f.get("evidence", [])
                if isinstance(ev.get("src"), int) and 0 <= ev["src"] < len(texts)}
        res["sources"] = [{"name": t["name"], "url": t["url"]} for t in texts if t["domain"] in used] or \
                         [{"name": t["name"], "url": t["url"]} for t in texts]
        if ok:
            published.append(res)
            log(f"  ✓ {res['title']}")
        else:
            review.append({"title": res.get("title") or g["topic"], "score": res["score"], "why": why, "links": links})
            log(f"  → অ্যাডমিন: {res.get('title')} ({why[0]})")

    note = "" if len(published) >= TOP_N else f"আজ যাচাই পেরিয়েছে মাত্র {len(published)}টা ঘটনা।"
    if not args.dry_run and published:
        day = write_day(ds, published, "auto-gemini", note)
        update_month(day)
        update_index(day)
    report(args.summary, ds, published, review, health, note)
    log(f"Gemini ডাকা হয়েছে {CALLS['n']} বার")
    return 0


def report(path, ds, published, review, health, note=""):
    from build import order
    lines = [f"## আজকের ঘটনা — {ds}", ""]
    if note:
        lines += [f"> {note}", ""]
    lines += [f"প্রকাশ: **{len(published)}টা** · অ্যাডমিনের কাছে: **{len(review)}টা** · Gemini: {CALLS['n']} বার", ""]
    if published:
        lines.append("### প্রকাশ হলো")
        for n, it in enumerate(order(published), 1):
            mark = "⭐ " if n <= TOP_N else ""
            lines.append(f"{n}. {mark}{it['title']} — চমক-মান {it['score']}")
        lines.append("")
    if review:
        lines.append("### অ্যাডমিনের কাছে (প্রকাশ হয়নি)")
        for r in sorted(review, key=lambda r: -r["score"]):
            lines.append(f"- **{r['title']}** (মান {r['score']}): {'; '.join(r['why'][:3])}")
            lines += [f"  - {u}" for u in r["links"][:3]]
        lines.append("")
    lines.append("### ফিডের অবস্থা")
    for h in health:
        lines.append(f"- {'✓' if h['ok'] else '✗'} {h['name']}: {h['n']}টা" + ("" if h["ok"] else f" ({h['error']})"))
    text = "\n".join(lines) + "\n"
    if path:
        Path(path).write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    sys.exit(main())
