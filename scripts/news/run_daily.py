"""আজকের গুরুত্বপূর্ণ সংবাদ — পুরো ধারা এক জায়গায়। Mac-এর বট (mac/mac_daily.py) রোজ এটা চালায়।

    python3 scripts/news/run_daily.py                 # আজকের দিন
    python3 scripts/news/run_daily.py --date 2026-11-04 --dry-run   # ফাইল না লিখে শুধু দেখা

--summary: ফলাফলের ছোট বিবরণ (Actions-এর পাতায় দেখায়)। "অ্যাডমিনের কাছে" তালিকা সেখানেই থাকে,
রিপোতে নয় (যাচাই না-হওয়া লেখা পাবলিক রিপোতে রাখা হয় না)।
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from build import TOP_N, update_index, update_month, write_day  # noqa: E402
from build_pages import build_all as build_pages  # noqa: E402
from collect import collect  # noqa: E402
from common import CALLS, DHAKA, NEWS_DIR, domain, log, now_dhaka, read_json, write_json  # noqa: E402
from pick import BATCH, MAX_WRITE, gather_texts, group, proofread, rewrite_batch, write_batch  # noqa: E402
from quality import check_day, excluded, item_problems, polish, trusted  # noqa: E402
from verify import check_item, prune  # noqa: E402

MAX_HEADLINES = 350
PER_SOURCE = 45          # এক উৎস থেকে সর্বোচ্চ কতটা শিরোনাম
SOLO_MIN_SCORE = 6       # বিশ্বস্ত পত্রিকার এক-উৎসের দল লেখানো হবে চমক-মান এর বেশি হলে
SOLO_MAX = 12            # এক চালানোয় সর্বোচ্চ কতটা এক-উৎসের দল (Gemini-র সীমা মাথায় রেখে)


def ok_sources(doms) -> bool:
    """দুটো আলাদা প্রতিষ্ঠান, অথবা একটা বিশ্বস্ত পত্রিকা (PIASH, ২০২৬-১১-১০)।"""
    doms = set(doms)
    return len(doms) >= 2 or any(trusted(d) for d in doms)


def headlines_by_source(items: list[dict], cap: int = PER_SOURCE) -> list[dict]:
    """এক উৎসের ভিড় ঠেকানো: প্রতি উৎস থেকে সর্বোচ্চ cap-টা (নতুনগুলো আগে), মোট MAX_HEADLINES।
    ৫ নভেম্বর ৩৫০টার ১৮৮টা ছিল ইত্তেফাকের — অন্য উৎস কম আসায় একই ঘটনার দ্বিতীয় উৎস মিলত না।"""
    items = sorted(items, key=lambda x: x["time"] or "", reverse=True)
    seen: dict[str, int] = {}
    out = []
    for it in items:
        k = it.get("src", "")
        if seen.get(k, 0) >= cap:
            continue
        seen[k] = seen.get(k, 0) + 1
        out.append(it)
    return out[:MAX_HEADLINES]


def finish(res: dict, texts: list[dict], allow: set[float]) -> tuple[bool, list[str]]:
    """লেখা → দুই-উৎস যাচাই → (দরকারে) বাক্য ছাঁটাই → বানান/অঙ্ক → মান-যাচাই। ফেরত (ঠিক আছে কি না, কারণ)।"""
    ok, why = check_item(res, texts, allow)
    if not ok and texts and prune(res, texts, allow):
        ok, why = check_item(res, texts, allow)
    res["facts"] = (res.get("facts") or [])[:6]
    polish(res)
    probs = item_problems(res)
    return (ok and not probs), (why + probs)


def sources_of(res: dict, texts: list[dict]) -> list[dict]:
    used = {texts[ev["src"]]["domain"] for f in res.get("facts", []) for ev in f.get("evidence", [])
            if isinstance(ev.get("src"), int) and 0 <= ev["src"] < len(texts)}
    return [{"name": t["name"], "url": t["url"]} for t in texts if t["domain"] in used] or \
           [{"name": t["name"], "url": t["url"]} for t in texts]


def from_summary(path: Path, existing: list[dict]) -> list[dict]:
    """পুরোনো দিন আবার (৫-৯ নভেম্বর): সেদিনের summary.md-তে আটকে থাকা খবরের লিংক থেকে দল বানানো।
    যে খবর আগেই প্রকাশিত (একই লিংক), সেটা বাদ।"""
    have = {s["url"] for it in existing for s in it.get("sources", [])}
    groups, cur = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"- \*\*(.+?)\*\* \(মান (\d+)\)", line)
        if m:
            cur = {"topic": m.group(1), "score": int(m.group(2)), "members": [], "category": "economy", "section": "bd"}
            groups.append(cur)
            continue
        m = re.match(r"\s+- (https?://\S+)", line)
        if m and cur is not None:
            cur["members"].append({"src": domain(m.group(1)), "title": cur["topic"], "desc": "", "url": m.group(1)})
        elif not line.startswith(" "):
            cur = None if line.startswith("#") else cur
    out = []
    for g in groups:
        urls = {x["url"] for x in g["members"]}
        if urls & have or not ok_sources(domain(u) for u in urls) or excluded(g["topic"]):
            continue
        out.append(g)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD (ঢাকার সময়); না দিলে আজ")
    ap.add_argument("--dry-run", action="store_true", help="news/-এ কিছু লেখা হবে না")
    ap.add_argument("--summary", help="ফলাফলের Markdown কোথায় লিখবে")
    ap.add_argument("--force", action="store_true", help="হাতে বানানো (manual) দিনের ফাইলও বদলাবে")
    ap.add_argument("--from-summary", help="পুরোনো দিন: সেদিনের summary.md-এর আটকে থাকা লিংক থেকে আবার চেষ্টা; "
                                           "আগের প্রকাশিত সংবাদ থাকে, নতুন যাচাই-পেরোনোগুলো যোগ হয়")
    args = ap.parse_args()

    today = now_dhaka().date()
    date = dt.date.fromisoformat(args.date) if args.date else today
    until = now_dhaka() if date >= today else dt.datetime.combine(date, dt.time(23, 59), DHAKA)
    ds = date.isoformat()
    old = read_json(NEWS_DIR / "day" / f"{ds}.json") or {}
    if str(old.get("method", "")).startswith("manual") and not args.force:
        log("এই দিনের ফাইল হাতে বানানো — বদলানো হবে না, শুধু ফলাফল দেখানো হবে (--force দিলে বদলাবে)")
        args.dry_run = True
    existing = [*(old.get("top") or []), *(old.get("more") or [])] if args.from_summary else []

    health = []
    if args.from_summary:
        multi = from_summary(Path(args.from_summary), existing)
        single = []
        log(f"পুরোনো দিনের আটকে থাকা দল: {len(multi)}")
    else:
        items, health = collect(until)
        items = headlines_by_source(items)
        log(f"মোট শিরোনাম: {len(items)}")
        if len(items) < 10:
            report(args.summary, ds, [], [], health, "খুব কম শিরোনাম এল — ফিডগুলো দেখতে হবে। আজ কিছু প্রকাশ হয়নি।")
            return 1
        groups = group(items)
        kept = []
        for g in groups:                                   # বাদের ছাঁকনি (AI-এর বাছাইয়ের পরেও, শব্দ মিলিয়ে)
            w = excluded(g["topic"], *(m["title"] for m in g["members"][:3]))
            if w:
                log(f"  বাদ ({w}): {g['topic']}")
            else:
                kept.append(g)
        groups = kept
        multi = [g for g in groups if len({domain(m["url"]) for m in g["members"]}) >= 2]
        # বিশ্বস্ত পত্রিকার একার খবর: একাধিক-উৎসের পরে লেখানো হয়
        solo = [g for g in groups if g not in multi and g["score"] >= SOLO_MIN_SCORE
                and any(trusted(domain(m["url"])) for m in g["members"])][:SOLO_MAX]
        single = [g for g in groups if g not in multi and g not in solo and g["score"] >= 7]
        log(f"দল: {len(groups)}, একাধিক উৎস: {len(multi)}, বিশ্বস্ত পত্রিকার একার: {len(solo)}")
        multi = multi + solo

    allow = {float(date.year), float(date.month), float(date.day)}
    published, review = [], []
    for g in single[:10]:
        review.append({"title": g["topic"], "score": g["score"], "why": ["মাত্র একটা উৎসে পাওয়া গেছে"],
                       "links": [m["url"] for m in g["members"]][:3]})
    ready = []
    for g in multi[:MAX_WRITE]:
        texts = gather_texts(g["members"])
        links = [t["url"] for t in texts] or [m["url"] for m in g["members"]][:3]
        if not ok_sources(t["domain"] for t in texts):
            review.append({"title": g["topic"], "score": g["score"], "why": ["দুটো উৎসের (বা বিশ্বস্ত পত্রিকার) পাতা খোলা গেল না"],
                           "links": links})
            continue
        ready.append((g, texts, links))

    retry = []                                         # (লেখা, texts, links, কারণ) — একবার আবার লেখানো হবে
    for i in range(0, len(ready), BATCH):
        chunk = ready[i:i + BATCH]
        try:
            results = write_batch([(g, t) for g, t, _ in chunk])
        except RuntimeError as e:
            log(f"  লেখা গেল না: {e}")
            for g, _, links in chunk:
                review.append({"title": g["topic"], "score": g["score"], "why": [str(e)[:200]], "links": links})
            continue
        for (g, texts, links), res in zip(chunk, results):
            if not res:
                continue
            res["sources"] = sources_of(res, texts)
            w = excluded(res.get("title", ""), res.get("short", ""))
            if w:
                log(f"  বাদ ({w}): {res.get('title')}")
                continue
            ok, why = finish(res, texts, allow)
            if ok:
                published.append(res)
                log(f"  ✓ {res['title']}")
            elif len(res.get("facts") or []) >= 3 and ok_sources(domain(s["url"]) for s in res["sources"]):
                retry.append((res, texts, links, why))      # তথ্য যাচাই হয়েছে, লেখায় সমস্যা → আবার লেখানো
            else:
                review.append({"title": res.get("title") or g["topic"], "score": res["score"], "why": why,
                               "links": links})
                log(f"  → অ্যাডমিন: {res.get('title')} ({why[0]})")

    for i in range(0, len(retry), BATCH):              # মেরামত: শুধু যাচাই-হওয়া তথ্য দিয়ে আবার লেখা
        chunk = retry[i:i + BATCH]
        try:
            again = rewrite_batch([(r, why) for r, _, _, why in chunk])
        except RuntimeError as e:
            log(f"  আবার লেখা গেল না: {e}")
            again = [None] * len(chunk)
        for (res, texts, links, why), new in zip(chunk, again):
            if new:
                ok, why2 = finish(new, texts, allow)
                if ok:
                    published.append(new)
                    log(f"  ✓ (আবার লিখে) {new['title']}")
                    continue
                why = why2
            review.append({"title": res.get("title", ""), "score": res.get("score", 0), "why": why, "links": links})
            log(f"  → অ্যাডমিন: {res.get('title')} ({why[0] if why else ''})")

    # বানানের আলাদা ধাপ: সব প্রকাশযোগ্য লেখা একসঙ্গে (AI) → তারপর তালিকা দিয়ে আবার মিলিয়ে দেখা (স্ক্রিপ্ট)
    proof_ok, proof_fixes = (proofread(published) if published else (True, []))
    final = []
    for it in published:
        polish(it)
        probs = item_problems(it)
        if probs:
            review.append({"title": it["title"], "score": it["score"], "why": probs, "links": [s["url"] for s in it["sources"]]})
        else:
            final.append(it)
    published = final
    for it in existing:                                 # পুরোনো দিন: আগের সংবাদগুলোও থাকে
        it.setdefault("category", "economy")

    note = "" if len(published) + len(existing) >= TOP_N else f"আজ যাচাই পেরিয়েছে মাত্র {len(published) + len(existing)}টা সংবাদ।"
    qc = {"spell": "dict+ai" if proof_ok else "dict", "spell_fixes": len(proof_fixes)}
    if not args.dry_run and (published or existing):
        day = write_day(ds, existing + published, old.get("method", "auto-gemini") if existing else "auto-gemini", note, qc)
        errs = check_day(day)
        if errs:                                       # শেষ পাহারা: কিছু ভুল থাকলে দিনের ফাইল লেখা হবে না
            (NEWS_DIR / "day" / f"{ds}.json").unlink(missing_ok=True)
            if old:
                write_json(NEWS_DIR / "day" / f"{ds}.json", old)
            log("✗ মান-যাচাই পেরোয়নি, দিনের ফাইল লেখা হলো না: " + "; ".join(errs[:5]))
            report(args.summary, ds, [], review, health, "মান-যাচাই পেরোয়নি: " + "; ".join(errs[:5]))
            return 1
        update_month(day)
        update_index(day)
        try:
            build_pages(NEWS_DIR)
        except Exception as e:  # noqa: BLE001
            log(f"✗ /news/ পাতা বানানো যায়নি: {e.__class__.__name__}: {e}")
    if proof_fixes:
        log("বানান-ধাপে বদল: " + ", ".join(proof_fixes[:20]))
    report(args.summary, ds, published, review, health, note)
    log(f"Gemini ডাকা হয়েছে {CALLS['n']} বার")
    return 0


def report(path, ds, published, review, health, note=""):
    from build import order
    lines = [f"## আজকের গুরুত্বপূর্ণ সংবাদ — {ds}", ""]
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
        extra = (f" (ফিডে {h.get('total', '?')}, সময়ের বাইরে {h.get('old', 0)})" if h["ok"] else f" ({h['error']})")
        lines.append(f"- {'✓' if h['ok'] else '✗'} {h['name']}: {h['n']}টা" + extra)
    text = "\n".join(lines) + "\n"
    if path:
        Path(path).write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    sys.exit(main())
