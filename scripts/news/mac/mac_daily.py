"""আজকের গুরুত্বপূর্ণ সংবাদ — PIASH-এর Mac-এ চলা (GitHub Actions-এ ভারী নিয়মিত কাজ নিষেধ, ২০২৬-১১-০৫)।

launchd প্রতি ঘণ্টায় এটা চালায় (Mac চালু থাকলে)। প্রতিবার:
1. কোন দিনটা বাকি দেখে: সন্ধ্যা ৬টার পরে আজ, তার আগে গতকাল (সাইটে না থাকলে)।
2. দিনটা আগে তৈরি না হলে run_daily.py চালিয়ে খসড়া বানায় (Gemini চাবি ~/.lyanna/gemini.key থেকে, রিপোর বাইরে)।
3. **নিজে থেকে প্রকাশ** (PIASH, ২০২৬-১১-০৭): যাচাই পেরোনো খবর সাইটে যায়; দুই উৎসে না মেলা খবর
   আটকে থাকে, সেগুলোর কথা Mac-এর বিজ্ঞপ্তিতে আর drafts/<দিন>/preview.html-এ।
4. প্রকাশ মানে: রিপোর কপিতে এক কমিট → scripts/deploy_guard.py দুই দিক মিলিয়ে GitHub-এ push, Cloudflare সেখান
   থেকে নিজে তোলে (PIASH, ২০২৬-১১-১৩; আগের "push না হলেও সরাসরি Cloudflare" বাতিল, কারণ তাতে GitHub পিছিয়ে
   পড়ে আর পরের PR মার্জে সাইট পুরোনো হয়ে যায়)। GitHub না গেলে সরাসরি Cloudflare শুধু PIASH-এর
   ~/Lyanna-Backup/allow-direct-deploy ফাইল থাকলে।
5. GitHub থেকে নতুন কোড আনা না গেলে Mac-এর কপি দিয়েই চলে (আটকে যায় না)।

নিরাপত্তা (LY Sites-এর নির্দেশনা, ২০২৬-১১-১০):
- প্রকাশের আগে quality.check_day(): JSON, প্রতিটা সংবাদে শিরোনাম, সারাংশ, "পরীক্ষার জন্য গুরুত্বপূর্ণ", ৩-৬ সারির ছক,
  দুটো তথ্যসূত্র, বানান-ধাপ। কিছু না মিললে বা পাতা বানানো মাঝপথে ভাঙলে কিছুই প্রকাশ হয় না: news/ আগের অবস্থায়
  ফেরে, সাইটে আগের দিনের পাতা থাকে, আর লগ + Mac-এর বার্তায় জানায়।
- সকাল ১১টার পরেও গতকালের সংবাদ সাইটে না থাকলে দিনে একবার বার্তা।
- নতুন নিয়মের প্রথম ৩টা দিন "পরীক্ষামূলক": বট খসড়া বানিয়ে পুরো সারাংশ খোলে, PIASH দেখে "প্রকাশ করুন" চাপলে তবেই
  সাইটে (state.json-এর "_trial")। ৩ দিন পার হলে আবার নিজে থেকে।
- ৫-৯ নভেম্বর আবার চেষ্টা ("_backfill"): সেদিনের আটকে থাকা খবরের লিংক থেকে, দিনে একটা করে।

হাতে অনুমোদন চাইলে: approve.command (পুরোনো পথ, এখনো চলে)। নিজে থেকে প্রকাশ বন্ধ করতে:
~/Lyanna-Backup/news-bot/manual নামে একটা ফাঁকা ফাইল রাখলেই আগের মতো প্রতিদিন জিজ্ঞেস করবে।

ফোল্ডার: ~/Lyanna-Backup/news-bot/ — আলাদা কপি BCS-QUIZ/ (PIASH-এর নিজের কপিতে হাত দেয় না), drafts/, state.json, news-bot.log।
"""
from __future__ import annotations

import datetime as dt
import fcntl
import html
import json
import os
import re
import select
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
BOT = Path(os.environ.get("LYANNA_NEWS_BOT", HOME / "Lyanna-Backup" / "news-bot"))
REPO = BOT / "BCS-QUIZ"
DRAFTS = BOT / "drafts"
STATE = BOT / "state.json"
KEYFILE = HOME / ".lyanna" / "gemini.key"
MANUAL = BOT / "manual"          # এই ফাইল থাকলে নিজে থেকে প্রকাশ নয়, আগের মতো জিজ্ঞেস
REMOTE = os.environ.get("LYANNA_NEWS_REMOTE", "https://github.com/nrpiashnp-crypto/BCS-QUIZ.git")
PAGES_PROJECT = os.environ.get("LYANNA_PAGES_PROJECT", "bcs-quiz")   # lyannabooks.com
DHAKA = dt.timezone(dt.timedelta(hours=6))
EVENING = 18                 # এর পরে আজকের দিন, আগে গতকাল
FIRST_DAY = dt.date(2026, 11, 5)
ASK_WAIT = 3000              # প্রশ্নের জানালা কতক্ষণ খোলা থাকবে (সেকেন্ড); পরের চালানো ১ ঘণ্টা পরে
TRIAL_DAYS = 3               # নতুন নিয়মের প্রথম কত দিন হাতে দেখে প্রকাশ
ALERT_HOUR = 11              # এর পরেও গতকালের সংবাদ না থাকলে বার্তা
BACKFILL = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]
RETRY_EMPTY_H = 3            # কিছু না পেলে কত ঘণ্টা পরে আবার চেষ্টা
DEPLOY_TIMEOUT = 900         # Cloudflare-এ তোলার সর্বোচ্চ সময় (সেকেন্ড)


def log(*a):
    print(dt.datetime.now(DHAKA).strftime("%F %T"), *a, flush=True)


def sh(*cmd, cwd=None, check=True, env=None, timeout=None):
    try:
        r = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True, timeout=timeout)
    except FileNotFoundError:
        if check:
            raise RuntimeError(f"{cmd[0]} নেই") from None
        return subprocess.CompletedProcess(cmd, 127, "", f"{cmd[0]} নেই")
    except subprocess.TimeoutExpired:
        if check:
            raise RuntimeError(f"{cmd[0]}: সময় শেষ") from None
        return subprocess.CompletedProcess(cmd, 124, "", "সময় শেষ")
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(cmd[:3])}: {r.stderr.strip()[:400]}")
    return r


def notify(title: str, text: str) -> None:
    script = f'display notification {json.dumps(text)} with title {json.dumps(title)}'
    sh("osascript", "-e", script, check=False)


def ask(title: str, text: str) -> str:
    """macOS-এর প্রশ্নের জানালা। ফেরত: 'publish' | 'reject' | 'later'।"""
    script = (f'display dialog {json.dumps(text)} with title {json.dumps(title)} '
              f'buttons {{"বাদ দিন", "পরে", "প্রকাশ করুন"}} default button "প্রকাশ করুন" '
              f'giving up after {ASK_WAIT}')
    r = sh("osascript", "-e", script, check=False)
    out = r.stdout or ""
    if r.returncode and sys.stdin.isatty():
        # জানালা খুলল না → Terminal-এ লিখে উত্তর
        print("\n" + text + "\n")
        # কিবোর্ড বদলাতে না হয়: ইংরেজি y/n/l আগে দেখানো; বাংলা হ/ব/প-ও চলে, বড় হাতের অক্ষরও
        print("প্রকাশ করবেন? হ্যাঁ = y , পরে = l , বাদ = n  (বাংলায় হ/প/ব-ও চলবে) — লিখে Enter: ", end="", flush=True)
        # উত্তর না এলে চিরকাল অপেক্ষা নয় (১০/১১: খোলা জানালা সারাদিন নিয়োগ-বট আটকে রেখেছিল)
        ready, _, _ = select.select([sys.stdin], [], [], ASK_WAIT)
        if not ready:
            print("\nউত্তর আসেনি — পরে আবার জিজ্ঞেস করবে।")
            return "later"
        ans = sys.stdin.readline().strip().lower()
        return {"y": "publish", "হ": "publish", "h": "publish",
                "n": "reject", "ন": "reject", "ব": "reject", "b": "reject"}.get(ans[:1], "later")
    if "gave up:true" in out or r.returncode:
        return "later"
    if "প্রকাশ করুন" in out:
        return "publish"
    if "বাদ দিন" in out:
        return "reject"
    return "later"


def load_state() -> dict:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(s: dict) -> None:
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def sync_repo() -> None:
    """আলাদা কপিটা GitHub-এর main-এর সঙ্গে মেলানো।

    - GitHub না পেলে (অ্যাকাউন্ট আটকে, ইন্টারনেট নেই): Mac-এর কপি যেমন আছে তেমন দিয়েই চলে।
    - Mac-এ এমন কমিট থাকলে যা GitHub-এ নেই (GitHub আটকে থাকার সময়ের খবর বা কোড): সেগুলো রেখে
      GitHub-এর নতুন কাজের ওপর বসানো (rebase); না বসলে আগের মতো রেখে দেওয়া, হারায় না।
    - news/-এর কমিট না হওয়া আধা-কাজ সবসময় মুছে পরিষ্কার।
    """
    if not (REPO / ".git").exists():
        log("রিপোর কপি নামানো হচ্ছে…")
        sh("git", "clone", "-q", "--depth", "20", REMOTE, str(REPO))
    sh("git", "config", "user.name", "lyanna-news-bot", cwd=REPO)
    sh("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com", cwd=REPO)
    sh("git", "checkout", "-q", "--", "news", cwd=REPO, check=False)
    sh("git", "clean", "-qfd", "news", cwd=REPO, check=False)
    sh("git", "rebase", "--abort", cwd=REPO, check=False)
    r = sh("git", "fetch", "-q", "--depth", "50", "origin", "+refs/heads/main:refs/remotes/origin/main",
           cwd=REPO, check=False, timeout=120)
    if r.returncode:
        log(f"GitHub থেকে আনা গেল না, Mac-এর কপি দিয়েই চলছে ({(r.stderr or '').strip()[:120]})")
        if sh("git", "symbolic-ref", "-q", "HEAD", cwd=REPO, check=False).returncode:
            sh("git", "checkout", "-q", "-B", "main", cwd=REPO, check=False)
        return
    ahead = sh("git", "rev-list", "--count", "origin/main..main", cwd=REPO, check=False).stdout.strip()
    if ahead in ("", "0"):
        sh("git", "checkout", "-q", "-B", "main", "origin/main", cwd=REPO)
        sh("git", "reset", "-q", "--hard", "origin/main", cwd=REPO)
        return
    sh("git", "checkout", "-q", "main", cwd=REPO, check=False)
    rb = sh("git", "rebase", "-q", "origin/main", cwd=REPO, check=False)
    if rb.returncode:
        sh("git", "rebase", "--abort", cwd=REPO, check=False)
        log(f"Mac-এর {ahead}টা কমিট GitHub-এর ওপর বসানো গেল না; আগের মতো রাখা হলো (Claude-কে জানান)")
    else:
        log(f"Mac-এর {ahead}টা কমিট GitHub-এর নতুন কাজের ওপর বসানো হলো")


def targets(now: dt.datetime, state: dict) -> list[str]:
    today = now.date()
    days = [today - dt.timedelta(days=1)]
    if now.hour >= EVENING:
        days.append(today)
    out = []
    for d in days:
        ds = d.isoformat()
        if d < FIRST_DAY or (REPO / "news" / "day" / f"{ds}.json").exists():
            continue
        st = state.get(ds, {})
        if st.get("status") in ("published", "rejected"):
            continue
        if st.get("status") == "empty":
            last = dt.datetime.fromisoformat(st["at"])
            if st.get("tries", 1) >= 3 or now - last < dt.timedelta(hours=RETRY_EMPTY_H):
                continue
        # গতকালের খসড়া সন্ধ্যার আগে বানানো হলে (অসম্পূর্ণ দিন) সন্ধ্যার পরে নতুন করে নয়; একবারই
        out.append(ds)
    return out


def make_draft(ds: str, state: dict, backfill: bool = False) -> bool:
    """run_daily.py চালিয়ে খসড়া drafts/<দিন>/-এ। True = প্রকাশযোগ্য কিছু আছে।
    backfill: পুরোনো দিন — প্রথম চালানোর আটকে থাকা লিংক (summary-first.md) থেকে আবার চেষ্টা, আগের সংবাদ রেখে।"""
    d = DRAFTS / ds
    d.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, GEMINI_API_KEY=KEYFILE.read_text().strip())
    log(f"{ds}: খসড়া তৈরি শুরু" + (" (পুরোনো দিন, আটকে থাকা খবর আবার)" if backfill else ""))
    extra = []
    if backfill:
        first = d / "summary-first.md"
        if not first.exists() and (d / "summary.md").exists():
            shutil.copy2(d / "summary.md", first)
        if (d / "day.json").exists():
            shutil.copy2(d / "day.json", d / "day-first.json")
        extra = ["--from-summary", str(first)]
    r = sh(sys.executable, str(REPO / "scripts/news/run_daily.py"), "--date", ds, "--summary", str(d / "summary.md"),
           *extra, cwd=REPO, env=env, check=False)
    (d / "run.log").write_text((r.stdout or "") + "\n" + (r.stderr or ""), encoding="utf-8")
    day = REPO / "news" / "day" / f"{ds}.json"
    ok = day.exists()
    if ok:
        shutil.copy2(day, d / "day.json")
    sh("git", "checkout", "-q", "--", "news", cwd=REPO, check=False)
    sh("git", "clean", "-qfd", "news", cwd=REPO, check=False)
    if not ok:
        prev = state.get(ds, {})
        state[ds] = {"status": "empty", "at": dt.datetime.now(DHAKA).isoformat(), "tries": prev.get("tries", 0) + 1}
        log(f"{ds}: প্রকাশযোগ্য কিছু পাওয়া যায়নি (দেখুন {d / 'run.log'})")
        notify("খবরের বট", f"{ds}: যাচাই পেরোনো ঘটনা পাওয়া যায়নি। কয়েক ঘণ্টা পরে আবার চেষ্টা করবে।")
        return False
    state[ds] = {"status": "draft", "at": dt.datetime.now(DHAKA).isoformat(), **({"backfill": True} if backfill else {})}
    return True


def held_count(ds: str) -> int:
    """দুই উৎসে না মেলায় আটকে থাকা খবরের সংখ্যা (run_daily-এর সারাংশ থেকে)।"""
    p = DRAFTS / ds / "summary.md"
    m = re.search(r"অ্যাডমিনের কাছে: \*\*(\d+)টা", p.read_text(encoding="utf-8")) if p.exists() else None
    return int(m.group(1)) if m else 0


def preview(ds: str) -> Path:
    """পুরো সারাংশের একটা পাতা (Mac-এর ভেতরেই, কোথাও পাঠানো হয় না)।"""
    d = DRAFTS / ds
    day = json.loads((d / "day.json").read_text(encoding="utf-8"))
    summary = (d / "summary.md").read_text(encoding="utf-8") if (d / "summary.md").exists() else ""
    e = html.escape
    errs = day_errors(day)
    checks = "সব ঠিক আছে ✓" if not errs else "সমস্যা: " + "; ".join(errs[:6])

    def card(it, star):
        facts = "".join(f"<li><b>{e(f['label'])}:</b> {e(f['value'])}</li>" for f in it.get("facts", []))
        src = " · ".join(f'<a href="{e(s["url"])}">{e(s["name"])}</a>' for s in it.get("sources", []))
        return (f'<div class="c"><div class="t">{"⭐ " if star else ""}{e(it["title"])}'
                f'<span>{e(it.get("section_bn", ""))} · মান {it["score"]}</span></div>'
                f'<p class="s">{e(it["short"])}</p><p>{e(it["detail"])}</p>'
                f'<p class="w"><b>পরীক্ষার জন্য গুরুত্বপূর্ণ:</b> {e(it.get("exam_point", ""))}</p>'
                f'<p class="w"><b>যা পরীক্ষায় লাগে:</b></p><ul>{facts}</ul><p class="src">তথ্যসূত্র: {src}</p></div>')

    body = "".join(card(it, True) for it in day["top"]) + "".join(card(it, False) for it in day["more"])
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>খসড়া {ds}</title><style>
body{{font:16px/1.6 'Noto Sans Bengali',system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;background:#f8f5ee;color:#1d1d1f}}
h1{{font-size:22px}} .c{{background:#fff;border-left:4px solid #1E5B4A;padding:10px 14px;margin:14px 0}}
.t{{font-weight:700;font-size:18px}} .t span{{font-weight:400;font-size:13px;color:#666;margin-left:8px}}
.s{{font-weight:600}} .w,.src{{font-size:14px;color:#444}} pre{{white-space:pre-wrap;background:#fff;padding:12px;font-size:14px}}
</style><h1>আজকের গুরুত্বপূর্ণ সংবাদ — {ds}</h1>
<p><b>প্রকাশের আগের যাচাই:</b> {e(checks)}</p>
<p>হোমে ⭐ দেওয়া {len(day["top"])}টা, দিনের পাতায় আরও {len(day["more"])}টা। নিচে আটকে থাকা খবর (দুই উৎসে মেলেনি)।</p>
{body}<h2>বটের বিবরণ (অ্যাডমিনের কাছে থাকা খবর, উৎসের অবস্থা)</h2><pre>{e(summary)}</pre>"""
    out = d / "preview.html"
    out.write_text(page, encoding="utf-8")
    return out


def _wrangler(repo: Path) -> tuple[bool, str]:
    """Mac থেকে সরাসরি Cloudflare Pages-এ তোলা। শুধু deploy_guard.direct_deploy() ডাকে (জরুরি পথ)।"""
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", "/usr/bin:/bin"))
    head = sh("git", "rev-parse", "HEAD", cwd=repo, check=False).stdout.strip() or "local"
    msg = (sh("git", "log", "-1", "--format=%s", cwd=repo, check=False).stdout.strip() or "Mac deploy")[:200]
    r = sh("npx", "--yes", "wrangler", "pages", "deploy", ".", "--project-name", PAGES_PROJECT,
           "--branch", "main", "--commit-hash", head, "--commit-message", msg,
           cwd=repo, env=env, check=False, timeout=DEPLOY_TIMEOUT)
    tail = ((r.stdout or "") + (r.stderr or "")).strip()[-600:]
    return r.returncode == 0, tail


def _guard():
    if str(REPO / "scripts") not in sys.path:
        sys.path.insert(0, str(REPO / "scripts"))
    import deploy_guard  # noqa: E402  (রিপোর নিজের কোড)
    return deploy_guard


def deploy_cloudflare() -> tuple[bool, str]:
    """সাইটে তোলা, দুই দিক মিলিয়ে (scripts/deploy_guard.py; PIASH, ২০২৬-১১-১৩)।
    সাধারণ পথ: GitHub আর Mac মিলিয়ে push, Cloudflare GitHub থেকে নিজে তোলে।
    GitHub না গেলে: শুধু PIASH-এর অনুমতি-ফাইল থাকলে সরাসরি Cloudflare, নইলে কোথাও না (কাজ Mac-এ জমা)।
    ফেরত: (হলো কি না, কোথায় গেল বা কেন থামল)।"""
    g = _guard()
    try:
        return True, g.ship(REPO)
    except g.GuardError as e:
        first = str(e)
    try:
        return True, g.direct_deploy(REPO, _wrangler)
    except g.GuardError as e:
        return False, f"{first} | {e}"


def day_errors(day) -> list[str]:
    """রিপোর quality.check_day() দিয়ে দিনের ফাইল যাচাই।"""
    if str(REPO / "scripts/news") not in sys.path:
        sys.path.insert(0, str(REPO / "scripts/news"))
    import quality  # noqa: E402  (রিপোর নিজের কোড)
    return quality.check_day(day)


def reset_news() -> None:
    """news/-এর কমিট না হওয়া সব বদল ফেলে দেওয়া — আধা-তৈরি পাতা যেন কোথাও না যায়।"""
    sh("git", "checkout", "-q", "--", "news", cwd=REPO, check=False)
    sh("git", "clean", "-qfd", "news", cwd=REPO, check=False)


def publish(ds: str) -> str:
    """খসড়া রিপোর কপিতে কমিট → GitHub (পারলে) + Cloudflare (সরাসরি)। ফেরত: কোথায় গেল।
    যেকোনো ধাপ ভাঙলে RuntimeError, আর news/ আগের অবস্থায় (সাইটে কিছু যায় না)।"""
    sync_repo()
    try:
        day = json.loads((DRAFTS / ds / "day.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise RuntimeError(f"খসড়ার JSON ভাঙা: {e}") from None
    errs = day_errors(day)
    if errs:
        raise RuntimeError("প্রকাশের আগের যাচাই পেরোয়নি: " + "; ".join(errs[:5]))
    day_path = REPO / "news" / "day" / f"{ds}.json"
    try:
        shutil.copy2(DRAFTS / ds / "day.json", day_path)
        import build  # noqa: E402  (রিপোর নিজের কোড; day_errors পথ জুড়েছে)
        build.update_month(day)
        build.update_index(day)
        build.rebuild_all()                           # পুরোনো দিন বদলালেও সূচি আর মাস ঠিক থাকে
        import build_pages  # noqa: E402
        build_pages.build_all()
        y, m, dd = ds.split("-")
        page = REPO / "news" / y / m / dd / "index.html"
        listed = {x["date"] for x in json.loads((REPO / "news" / "index.json").read_text(encoding="utf-8")).get("days", [])}
        if not page.exists() or ds not in listed:
            raise RuntimeError("দিনের পাতা বা সূচি তৈরি হয়নি")
    except Exception as e:  # noqa: BLE001
        reset_news()
        raise RuntimeError(f"পাতা বানানো মাঝপথে ভাঙল ({e.__class__.__name__}: {str(e)[:160]}); কিছু প্রকাশ হয়নি") from None
    sh("git", "add", "news", cwd=REPO)
    sh("git", "commit", "-q", "-m", f"news: আজকের গুরুত্বপূর্ণ সংবাদ {ds} (Mac থেকে)", cwd=REPO, check=False)
    ok, where = deploy_cloudflare()
    if not ok:
        log(f"{ds}: সাইটে তোলা থামানো হলো: {where}")
        raise RuntimeError(f"সাইটে তোলা হলো না (দুই দিক মেলেনি): {where[:200]}")
    return where


def do_publish(ds: str, state: dict, auto: bool) -> bool:
    try:
        where = publish(ds)
    except RuntimeError as e:
        log(f"{ds}: প্রকাশ হলো না: {e}")
        notify("খবরের বট", f"{ds}: প্রকাশ হলো না; সাইটে আগের পাতা আছে। কারণ: {str(e)[:120]}")
        state.setdefault(ds, {})["last_error"] = str(e)[:300]
        return False
    was = state.get(ds, {})
    state[ds] = {"status": "published", "at": dt.datetime.now(DHAKA).isoformat(), "where": where,
                 "auto": auto, **({"backfill": True} if was.get("backfill") else {})}
    tr = state.get("_trial", {})
    if not auto and not was.get("backfill") and tr.get("left", 0) > 0:
        tr["left"] -= 1
        tr.setdefault("days", []).append(ds)
        state["_trial"] = tr
        log(f"পরীক্ষামূলক চালানো: {ds} হাতে দেখে প্রকাশ; বাকি {tr['left']} দিন")
    held = held_count(ds)
    msg = f"{ds}: প্রকাশ হয়েছে ✓ ({where})"
    if held:
        msg += f" · {held}টা খবর দুই উৎসে মেলেনি, আটকে আছে"
    notify("খবরের বট", msg)
    log(f"{ds}: প্রকাশ → {where}" + (f"; আটকে {held}টা" if held else ""))
    return True


def approve(state: dict) -> None:
    """খসড়া হয়ে থাকা দিনগুলোর জন্য সারাংশ খুলে PIASH-কে জিজ্ঞেস করা (Terminal থেকে চলে, তাই জানালা খোলে)।"""
    pending = sorted(ds for ds, st in state.items()
                     if st.get("status") == "draft" and (DRAFTS / ds / "day.json").exists())
    if not pending:
        print("অনুমোদনের অপেক্ষায় কোনো খসড়া নেই।")
    for ds in pending:
        page = preview(ds)
        sh("open", str(page), check=False)
        day = json.loads((DRAFTS / ds / "day.json").read_text(encoding="utf-8"))
        titles = "\n".join(f"• {it['title']}" for it in day["top"])
        trial = state.get("_trial", {}).get("left", 0)
        tag = " (পুরোনো দিন, আবার বানানো)" if state[ds].get("backfill") else (
            f" (পরীক্ষামূলক: আর {trial} দিন হাতে দেখবেন)" if trial else "")
        errs = day_errors(day)
        choice = ask("আজকের গুরুত্বপূর্ণ সংবাদ — প্রকাশ করবেন?",
                     f"{ds}{tag}: হোমে {len(day['top'])}টা, দিনের পাতায় আরও {len(day['more'])}টা।\n\n{titles}\n\n"
                     + ("যাচাই: সব ঠিক আছে ✓\n" if not errs else f"যাচাইয়ে সমস্যা ({len(errs)}টা) — প্রকাশ হবে না\n")
                     + "পুরো সারাংশ ব্রাউজারে খোলা হয়েছে।")
        lk = open(BOT / ".lock", "w")
        fcntl.flock(lk, fcntl.LOCK_EX)          # তালা শুধু প্রকাশ/বাদের সময়, মানুষের উত্তরের অপেক্ষায় নয়
        state.clear(); state.update(load_state())
        if state.get(ds, {}).get("status") != "draft":
            print(f"{ds}: এর মধ্যে আগেই মীমাংসা হয়ে গেছে।")
            lk.close()
            continue
        if choice == "publish":
            if do_publish(ds, state, auto=False):
                print(f"{ds}: প্রকাশ হয়েছে ✓")
            else:
                print(f"{ds}: প্রকাশ হলো না। পরের ঘণ্টায় আবার চেষ্টা করবে।")
        elif choice == "reject":
            state[ds] = {"status": "rejected", "at": dt.datetime.now(DHAKA).isoformat()}
            print(f"{ds}: বাদ দেওয়া হলো।")
            log(f"{ds}: বাদ")
        else:
            print(f"{ds}: পরে — এক ঘণ্টা পরে আবার জিজ্ঞেস করবে।")
            log(f"{ds}: পরে")
        save_state(state)
        lk.close()


def missing_alert(now: dt.datetime, state: dict) -> None:
    """সকাল ১১টার পরেও গতকালের সংবাদ সাইটে না থাকলে দিনে একবার জানানো (লগ + Mac-এর বার্তা)।"""
    y = (now.date() - dt.timedelta(days=1)).isoformat()
    if now.hour < ALERT_HOUR or y < FIRST_DAY.isoformat() or (REPO / "news" / "day" / f"{y}.json").exists():
        return
    al = state.get("_alert", {})
    if al.get("for") == y:
        return
    st = state.get(y, {})
    why = st.get("last_error") or {"empty": "যাচাই-পেরোনো সংবাদ পাওয়া যায়নি", "draft": "খসড়া অনুমোদনের অপেক্ষায়"}.get(
        st.get("status", ""), "বট চলেনি (Mac বন্ধ বা ঘুমিয়ে ছিল?)")
    log(f"সতর্কতা: {y}-এর সংবাদ এখনো প্রকাশ হয়নি — {why}")
    notify("খবরের বট", f"{y}-এর সংবাদ এখনো প্রকাশ হয়নি: {why[:120]}। সাইটে আগের দিনের পাতা আছে।")
    state["_alert"] = {"for": y, "at": now.isoformat()}
    save_state(state)


def main() -> int:
    approving = "--approve" in sys.argv
    BOT.mkdir(parents=True, exist_ok=True)
    if approving:                    # অনুমোদন তালা ধরে বসে থাকে না; প্রকাশের মুহূর্তে নেয় (approve দেখুন)
        approve(load_state())
        return 0
    lock = open(BOT / ".lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("আগের চালানো এখনো চলছে, এবার বাদ")
        return 0
    if not KEYFILE.exists():
        notify("খবরের বট", "Gemini চাবি নেই। ~/Lyanna-Backup/খবরের-বট-চালু.command আবার চালান।")
        return 1
    state = load_state()
    now = dt.datetime.now(DHAKA)
    try:
        sync_repo()
    except RuntimeError as e:
        log(f"রিপোর কপি তৈরি হলো না: {e}")
        return 1
    src = REPO / "scripts/news/mac/approve.command"            # অনুমোদনের ফাইল সবসময় নতুন রাখা
    if src.exists():
        shutil.copy2(src, BOT / "approve.command")
        os.chmod(BOT / "approve.command", 0o755)
    if "_trial" not in state:                                # নতুন নিয়ম চালুর পরে প্রথম ৩ দিন হাতে দেখে
        state["_trial"] = {"left": TRIAL_DAYS, "since": now.date().isoformat()}
        save_state(state)
    did = False
    for ds in targets(now, state):
        if state.get(ds, {}).get("status") == "draft" and (DRAFTS / ds / "day.json").exists():
            continue
        make_draft(ds, state)
        save_state(state)
        did = True
    bf = state.setdefault("_backfill", {"days": [d for d in BACKFILL if (DRAFTS / d / "summary.md").exists()], "done": []})
    todo = [d for d in bf["days"] if d not in bf["done"] and state.get(d, {}).get("status") != "draft"]
    if todo and not did:                                     # পুরোনো দিন: খেপে একটা, নতুন দিনের কাজ না থাকলে
        make_draft(todo[0], state, backfill=True)
        bf["done"].append(todo[0])
        save_state(state)
    missing_alert(now, state)
    pending = sorted(ds for ds, st in state.items()
                     if st.get("status") == "draft" and (DRAFTS / ds / "day.json").exists())
    if not pending:
        return 0
    if MANUAL.exists() or state.get("_trial", {}).get("left", 0) > 0:
        # PIASH হাতে অনুমোদন চেয়েছেন, বা নতুন নিয়মের পরীক্ষামূলক দিন: পেছনে চলা কাজ জানালা খুলতে পারে না, তাই Terminal-এ
        notify("খবরের বট", "খসড়া তৈরি। অনুমোদনের জানালা খুলছে।")
        sh("open", "-a", "Terminal", str(BOT / "approve.command"), check=False)
        return 0
    for ds in pending:                                     # নিজে থেকে প্রকাশ (PIASH, ২০২৬-১১-০৭)
        preview(ds)
        do_publish(ds, state, auto=True)
        save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
