"""নিয়োগ বিজ্ঞপ্তির বট — PIASH-এর Mac-এ, খবরের বটের পরে একই launchd-চালানোয় (run.sh)।

দিনে তিন খেপ সংগ্রহ (সকাল ৮টা, দুপুর ২টা, রাত ৯টার পরের প্রথম চালানোয়):
  collect → মূল বিজ্ঞপ্তি নামানো → দুইবার পড়া (দুই মডেল) → যাচাই →
  মিললে circular/data-তে + /circular/ পাতা (Mac-এর কপিতে কমিট); না মিললে আটকে রাখা (অ্যাডমিনের তালিকা)।
সাইটে তোলা (GitHub push + Cloudflare): নতুন বিজ্ঞপ্তি এলে সেই খেপেই (দিনে সর্বোচ্চ তিনবার), নইলে রাতের খেপে একবার।
নিজে থেকে প্রকাশ, সন্দেহজনক শুধু PIASH-এর কাছে (২০২৬-১১-০৭)।

ফাইল (~/Lyanna-Backup/news-bot/): jobs-state.json (কোনটা দেখা হয়েছে), jobs-held/ (আটকে থাকা, হুবহু অংশসহ),
jobs-review.html (অ্যাডমিনের তালিকা: আটকে থাকা + মূল উৎসে না পাওয়া ইঙ্গিত), jobs.log।
হাতে চালানো: python3 scripts/jobs/mac_jobs.py --now   (খেপের সময় না দেখে এখনই)
"""
from __future__ import annotations

import datetime as dt
import fcntl
import html
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("NEWS_MAX_CALLS", "120")       # এক চালানোয় Gemini-র সর্বোচ্চ অনুরোধ (flash-lite দিনে ৫০০)
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "news" / "mac"))
sys.path.insert(0, str(HERE.parent / "news"))
sys.path.insert(0, str(HERE))

import mac_daily as M  # noqa: E402  (খবরের বটের যন্ত্র: sh, notify, deploy_cloudflare, ফোল্ডার)
from jbuild import build_all  # noqa: E402
from jcollect import collect, doc_from_page, teletalk_doc  # noqa: E402
from jextract import first_read, second_read  # noqa: E402
from jobs_common import DATA_DIR, http_bytes, mime_of, read_json, sha, short_id  # noqa: E402
from jverify import check, normalize  # noqa: E402

BOT, REPO = M.BOT, M.REPO
STATE = BOT / "jobs-state.json"
HELD = BOT / "jobs-held"
REVIEW = BOT / "jobs-review.html"
SLOTS = (8, 14, 21)
MAX_DOCS = int(os.environ.get("JOBS_MAX_DOCS", "30"))     # এক খেপে কতগুলো নতুন বিজ্ঞপ্তি পড়া
MAX_TRIES = 3


def log(*a):
    M.log("[চাকরি]", *a)


def load() -> dict:
    return read_json(STATE, {}) or {}


def save(s: dict) -> None:
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def slot_key(now: dt.datetime) -> str | None:
    """এখন কোন খেপ (যেমন 2026-11-07@14); রাত ৯টার খেপ ভোর পর্যন্ত চলে।"""
    h = now.hour
    if h < SLOTS[0]:
        return f"{(now.date() - dt.timedelta(days=1)).isoformat()}@{SLOTS[-1]}"
    return f"{now.date().isoformat()}@{max(s for s in SLOTS if s <= h)}"


def published_records() -> list[dict]:
    return [r for p in sorted(DATA_DIR.glob("*.json")) if p.name != "open.json"
            for r in [read_json(p)] if r and r.get("id")]


def process(c: dict, st: dict, today: dt.date) -> tuple[str, dict | None, list[str]]:
    """একটা প্রার্থী → ('ok'|'held'|'skip'|'error', রেকর্ড, কারণ)।"""
    doc = c.get("doc") or doc_from_page(c["page"]) or (teletalk_doc(c["teletalk"]) if c.get("teletalk") else None)
    if not doc:
        return "error", None, ["মূল বিজ্ঞপ্তির ফাইল পাওয়া যায়নি"]
    data, ctype = http_bytes(doc, timeout=60)
    mime = mime_of(doc, ctype, data)
    if not mime:
        return "error", None, [f"ফাইলের ধরন পড়া যায় না ({ctype[:40]})"]
    digest = sha(data)
    if digest in st.setdefault("sha", {}):
        return "skip", None, [f"একই ফাইল আগে দেখা ({st['sha'][digest]})"]
    r = normalize(first_read(mime, data))
    try:
        second = second_read(mime, data)
    except RuntimeError as e:
        log(f"  দ্বিতীয় পাঠ হলো না: {e}")
        second = None
    bad = check(r, second, today, c.get("teletalk"))
    r.update(id=short_id(r.get("published"), digest), notice=doc, page=c["page"], type=c.get("type") or "govt",
             added=today.isoformat(), source=c["source"], sha=digest)
    if not r.get("org"):
        r["org"] = c.get("org", "")
    if not r.get("apply_url") and c.get("teletalk"):
        r["apply_url"] = c["teletalk"]["site"]
    st["sha"][digest] = r["id"]
    if r.get("is_recruitment") is False:
        return "skip", r, ["নতুন নিয়োগ বিজ্ঞপ্তি নয়"]
    r["_second"] = second
    return ("held" if bad else "ok"), r, bad


def review_page(st: dict, hints: list[dict]) -> None:
    e = html.escape
    held = [read_json(p) for p in sorted(HELD.glob("*.json"))]
    rows = "".join(
        f"<div class='c'><b>{e(h.get('org', ''))}</b> — {e(', '.join(p['name'] for p in h.get('posts', [])[:4]))}"
        f"<br><small>শেষ: {e(str(h.get('apply_end')))} · বয়স: {e(str(h.get('age_max')))} · পদ: {e(str(h.get('total_posts')))}</small>"
        f"<ul>{''.join(f'<li>{e(w)}</li>' for w in h.get('_why', []))}</ul>"
        f"<small>হুবহু: {e(json.dumps(h.get('quotes') or {}, ensure_ascii=False))}<br>দ্বিতীয় পাঠ: {e(json.dumps(h.get('_second'), ensure_ascii=False))}</small>"
        f"<br><a href='{e(h.get('notice', ''))}'>মূল বিজ্ঞপ্তি</a></div>" for h in held if h)
    hl = "".join(f"<li><a href='{e(h.get('link') or '')}'>{e(h['title'])}</a> <small>{e(h.get('site', ''))} · {e(str(h.get('published')))}</small></li>"
                 for h in hints[:60])
    REVIEW.write_text(f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>নিয়োগ বিজ্ঞপ্তি — অ্যাডমিন</title><style>body{{font:16px/1.6 system-ui,sans-serif;max-width:800px;margin:20px auto;padding:0 14px;background:#f8f5ee}}
.c{{background:#fff;border-left:4px solid #c8326a;padding:8px 12px;margin:12px 0}} small{{color:#555}}</style>
<h1>আটকে থাকা বিজ্ঞপ্তি ({len(held)})</h1><p>দুই পাঠ বা টেলিটকের সঙ্গে মেলেনি। ঠিক থাকলে Claude-কে বলুন।</p>{rows or '<p>কিছু নেই।</p>'}
<h2>পত্রিকা/Google News-এর ইঙ্গিত ({len(hints)})</h2><p>এগুলো প্রকাশের ভিত্তি নয়; আমাদের উৎসে না থাকলে নতুন উৎস যোগ করতে হবে।</p><ul>{hl}</ul>""",
                      encoding="utf-8")


def run_slot(st: dict, today: dt.date) -> tuple[int, int]:
    cands, hints, health = collect(today)
    st["health"] = health
    log(f"প্রার্থী {len(cands)}, ইঙ্গিত {len(hints)}, উৎস চলে {sum(h['ok'] for h in health)}/{len(health)}")
    seen = st.setdefault("seen", {})
    todo = [c for c in cands if seen.get(c.get("doc") or c["page"], {}).get("status") in (None, "error")
            and seen.get(c.get("doc") or c["page"], {}).get("tries", 0) < MAX_TRIES]
    new_ok, new_held = [], 0
    HELD.mkdir(parents=True, exist_ok=True)
    for c in todo[:MAX_DOCS]:
        key = c.get("doc") or c["page"]
        try:
            status, r, why = process(c, st, today)
        except RuntimeError as e:
            if "সীমা" in str(e):
                log(f"Gemini-র সীমা শেষ, বাকিগুলো পরের খেপে: {e}")
                break
            status, r, why = "error", None, [str(e)[:200]]
        except Exception as e:  # noqa: BLE001
            status, r, why = "error", None, [f"{e.__class__.__name__}: {str(e)[:160]}"]
        prev = seen.get(key, {})
        seen[key] = {"status": status, "at": dt.datetime.now(M.DHAKA).isoformat(), "why": why[:4],
                     "id": (r or {}).get("id"), "tries": prev.get("tries", 0) + (status == "error")}
        log(f"  {status}: {c['title'][:70]}" + (f" — {why[0]}" if why else ""))
        if status == "ok":
            new_ok.append(r)
        elif status == "held":
            new_held += 1
            (HELD / f"{r['id']}.json").write_text(json.dumps(dict(r, _why=why), ensure_ascii=False, indent=1), encoding="utf-8")
        save(st)
    for r in new_ok:
        r.pop("_second", None)
    recs = {r["id"]: r for r in published_records()}
    recs.update({r["id"]: r for r in new_ok})
    recs = list(recs.values())
    changed = build_all(recs)
    if changed:
        M.sh("git", "add", "circular", cwd=REPO)
        M.sh("git", "commit", "-q", "-m", f"circular: নিয়োগ বিজ্ঞপ্তি {today} (নতুন {len(new_ok)}টা, নিজে থেকে, Mac থেকে)",
             cwd=REPO, check=False)
    review_page(st, hints)
    return len(new_ok), new_held


def ship(st: dict, today: dt.date) -> str:
    """GitHub (পারলে) + Cloudflare।"""
    where = []
    r = M.sh("git", "push", "-q", "origin", "HEAD:main", cwd=REPO, check=False, timeout=120)
    if r.returncode == 0:
        where.append("GitHub")
    ok, tail = M.deploy_cloudflare()
    if ok:
        where.append("Cloudflare")
    else:
        log(f"Cloudflare-এ তোলা গেল না: {tail}")
    if where:
        st["last_ship"] = today.isoformat()
    return "+".join(where) or "কোথাও না"


def main() -> int:
    force = "--now" in sys.argv
    BOT.mkdir(parents=True, exist_ok=True)
    lock = open(BOT / ".lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("আরেকটা চালানো চলছে, এবার বাদ")
        return 0
    if not M.KEYFILE.exists():
        return 1
    os.environ["GEMINI_API_KEY"] = M.KEYFILE.read_text().strip()
    now = dt.datetime.now(M.DHAKA)
    st = load()
    slot = slot_key(now)
    if slot == st.get("last_slot") and not force:
        return 0
    log(f"খেপ শুরু: {slot}")
    try:
        ok, held = run_slot(st, now.date())
    except Exception as e:  # noqa: BLE001
        log(f"খেপ ব্যর্থ: {e.__class__.__name__}: {e}")
        M.notify("চাকরির বট", "আজকের সংগ্রহে সমস্যা হলো; পরের খেপে আবার চেষ্টা করবে।")
        save(st)
        return 1
    st["last_slot"] = slot
    save(st)
    night = slot.endswith(f"@{SLOTS[-1]}")
    # নতুন বিজ্ঞপ্তি এলে সেই খেপেই সাইটে (দিনে সর্বোচ্চ তিন খেপ); নইলে রাতের খেপে দিনে একবার
    if force or not st.get("last_ship") or ok or (night and st.get("last_ship") != now.date().isoformat()):
        where = ship(st, now.date())
        save(st)
        log(f"সাইটে তোলা → {where}")
    msg = f"নতুন {ok}টা বিজ্ঞপ্তি" + (f", আটকে {held}টা (দেখুন jobs-review.html)" if held else "")
    M.notify("চাকরির বট", msg)
    log(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
