"""আজকের ঘটনা — PIASH-এর Mac-এ চলা (GitHub Actions-এ ভারী নিয়মিত কাজ নিষেধ, ২০২৬-১১-০৫)।

launchd প্রতি ঘণ্টায় এটা চালায় (Mac চালু থাকলে)। প্রতিবার:
1. কোন দিনটা বাকি দেখে: সন্ধ্যা ৬টার পরে আজ, তার আগে গতকাল (সাইটে না থাকলে)।
2. দিনটা আগে তৈরি না হলে run_daily.py চালিয়ে খসড়া বানায় (Gemini চাবি ~/.lyanna/gemini.key থেকে, রিপোর বাইরে)।
3. ব্রাউজারে পুরো সারাংশ খোলে আর জিজ্ঞেস করে: "প্রকাশ করুন" / "বাদ দিন" / "পরে"।
4. "প্রকাশ করুন" চাপলে তবেই রিপোর main-এ এক কমিট (মার্জ = লাইভ)। "পরে" বা উত্তর না দিলে পরের ঘণ্টায় আবার জিজ্ঞেস করে
   (Gemini আবার চলে না, খসড়া জমা থাকে)।

ফোল্ডার: ~/Lyanna-Backup/news-bot/ — আলাদা কপি BCS-QUIZ/ (PIASH-এর নিজের কপিতে হাত দেয় না), drafts/, state.json, news-bot.log।
"""
from __future__ import annotations

import datetime as dt
import fcntl
import html
import json
import os
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
REMOTE = os.environ.get("LYANNA_NEWS_REMOTE", "https://github.com/nrpiashnp-crypto/BCS-QUIZ.git")
DHAKA = dt.timezone(dt.timedelta(hours=6))
EVENING = 18                 # এর পরে আজকের দিন, আগে গতকাল
FIRST_DAY = dt.date(2026, 11, 5)
ASK_WAIT = 3000              # প্রশ্নের জানালা কতক্ষণ খোলা থাকবে (সেকেন্ড); পরের চালানো ১ ঘণ্টা পরে
RETRY_EMPTY_H = 3            # কিছু না পেলে কত ঘণ্টা পরে আবার চেষ্টা


def log(*a):
    print(dt.datetime.now(DHAKA).strftime("%F %T"), *a, flush=True)


def sh(*cmd, cwd=None, check=True, env=None):
    try:
        r = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)
    except FileNotFoundError:
        if check:
            raise RuntimeError(f"{cmd[0]} নেই") from None
        return subprocess.CompletedProcess(cmd, 127, "", f"{cmd[0]} নেই")
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
        ans = input("প্রকাশ করবেন? হ্যাঁ হলে  হ  , পরে হলে  প  , বাদ দিতে  ব  লিখে Enter: ").strip()
        return {"হ": "publish", "h": "publish", "y": "publish", "ব": "reject", "b": "reject"}.get(ans[:1], "later")
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
    """আলাদা কপিটা ঠিক main-এর মতো করা (এই কপিতে কেউ হাতে কাজ করে না)।"""
    if not (REPO / ".git").exists():
        log("রিপোর কপি নামানো হচ্ছে…")
        sh("git", "clone", "-q", "--depth", "20", REMOTE, str(REPO))
        sh("git", "config", "user.name", "lyanna-news-bot", cwd=REPO)
        sh("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com", cwd=REPO)
    sh("git", "fetch", "-q", "--depth", "20", "origin", "+refs/heads/main:refs/remotes/origin/main", cwd=REPO)
    sh("git", "checkout", "-q", "-B", "main", "origin/main", cwd=REPO)
    sh("git", "reset", "-q", "--hard", "origin/main", cwd=REPO)
    sh("git", "clean", "-qfd", "news", cwd=REPO)


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


def make_draft(ds: str, state: dict) -> bool:
    """run_daily.py চালিয়ে খসড়া drafts/<দিন>/-এ। True = প্রকাশযোগ্য কিছু আছে।"""
    d = DRAFTS / ds
    d.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, GEMINI_API_KEY=KEYFILE.read_text().strip())
    log(f"{ds}: খসড়া তৈরি শুরু")
    r = sh(sys.executable, str(REPO / "scripts/news/run_daily.py"), "--date", ds, "--summary", str(d / "summary.md"),
           cwd=REPO, env=env, check=False)
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
    state[ds] = {"status": "draft", "at": dt.datetime.now(DHAKA).isoformat()}
    return True


def preview(ds: str) -> Path:
    """পুরো সারাংশের একটা পাতা (Mac-এর ভেতরেই, কোথাও পাঠানো হয় না)।"""
    d = DRAFTS / ds
    day = json.loads((d / "day.json").read_text(encoding="utf-8"))
    summary = (d / "summary.md").read_text(encoding="utf-8") if (d / "summary.md").exists() else ""
    e = html.escape

    def card(it, star):
        facts = "".join(f"<li><b>{e(f['label'])}:</b> {e(f['value'])}</li>" for f in it.get("facts", []))
        src = " · ".join(f'<a href="{e(s["url"])}">{e(s["name"])}</a>' for s in it.get("sources", []))
        return (f'<div class="c"><div class="t">{"⭐ " if star else ""}{e(it["title"])}'
                f'<span>{e(it.get("section_bn", ""))} · মান {it["score"]}</span></div>'
                f'<p class="s">{e(it["short"])}</p><p>{e(it["detail"])}</p>'
                f'<p class="w">পরীক্ষায় কেন: {e(it.get("why_exam", ""))}</p><ul>{facts}</ul><p class="src">{src}</p></div>')

    body = "".join(card(it, True) for it in day["top"]) + "".join(card(it, False) for it in day["more"])
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>খসড়া {ds}</title><style>
body{{font:16px/1.6 'Noto Sans Bengali',system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;background:#f8f5ee;color:#1d1d1f}}
h1{{font-size:22px}} .c{{background:#fff;border-left:4px solid #1E5B4A;padding:10px 14px;margin:14px 0}}
.t{{font-weight:700;font-size:18px}} .t span{{font-weight:400;font-size:13px;color:#666;margin-left:8px}}
.s{{font-weight:600}} .w,.src{{font-size:14px;color:#444}} pre{{white-space:pre-wrap;background:#fff;padding:12px;font-size:14px}}
</style><h1>আজকের ঘটনা — খসড়া {ds}</h1>
<p>হোমে যাবে ⭐ দেওয়া {len(day["top"])}টা, দিনের পাতায় আরও {len(day["more"])}টা। প্রকাশ করতে Mac-এর প্রশ্নের জানালায় "প্রকাশ করুন" চাপুন।</p>
{body}<h2>বটের বিবরণ (অ্যাডমিনের কাছে থাকা খবর, উৎসের অবস্থা)</h2><pre>{e(summary)}</pre>"""
    out = d / "preview.html"
    out.write_text(page, encoding="utf-8")
    return out


def publish(ds: str) -> str:
    sync_repo()
    day_path = REPO / "news" / "day" / f"{ds}.json"
    shutil.copy2(DRAFTS / ds / "day.json", day_path)
    sys.path.insert(0, str(REPO / "scripts/news"))
    import build  # noqa: E402  (রিপোর নিজের কোড)
    day = json.loads(day_path.read_text(encoding="utf-8"))
    build.update_month(day)
    build.update_index(day)
    sh("git", "add", "news", cwd=REPO)
    sh("git", "commit", "-q", "-m", f"news: আজকের ঘটনা {ds} (PIASH-এর অনুমোদনে, Mac থেকে)", cwd=REPO)
    r = sh("git", "push", "-q", "origin", "HEAD:main", cwd=REPO, check=False)
    if r.returncode == 0:
        return "main"
    # main-এ সরাসরি না গেলে আলাদা শাখায়, PIASH বা পরের সেশন PR করে মার্জ করবে
    br = f"news/day-{ds}"
    sh("git", "push", "-q", "-f", "origin", f"HEAD:refs/heads/{br}", cwd=REPO)
    return br


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
        choice = ask("আজকের ঘটনা — প্রকাশ করবেন?",
                     f"{ds}: হোমে {len(day['top'])}টা, দিনের পাতায় আরও {len(day['more'])}টা।\n\n{titles}\n\n"
                     "পুরো সারাংশ ব্রাউজারে খোলা হয়েছে।")
        if choice == "publish":
            try:
                where = publish(ds)
            except RuntimeError as e:
                log(f"{ds}: প্রকাশ হলো না: {e}")
                print(f"{ds}: প্রকাশ হলো না। পরের ঘণ্টায় আবার জিজ্ঞেস করবে।")
                continue
            state[ds] = {"status": "published", "at": dt.datetime.now(DHAKA).isoformat(), "where": where}
            msg = f"{ds}: প্রকাশ হয়েছে ✓" if where == "main" else f"{ds}: শাখা {where}-এ রাখা হলো (মার্জ বাকি)"
            notify("খবরের বট", msg)
            print(msg)
            log(f"{ds}: প্রকাশ → {where}")
        elif choice == "reject":
            state[ds] = {"status": "rejected", "at": dt.datetime.now(DHAKA).isoformat()}
            print(f"{ds}: বাদ দেওয়া হলো।")
            log(f"{ds}: বাদ")
        else:
            print(f"{ds}: পরে — এক ঘণ্টা পরে আবার জিজ্ঞেস করবে।")
            log(f"{ds}: পরে")
        save_state(state)


def main() -> int:
    approving = "--approve" in sys.argv
    BOT.mkdir(parents=True, exist_ok=True)
    lock = open(BOT / ".lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX if approving else fcntl.LOCK_EX | fcntl.LOCK_NB)  # অনুমোদন অপেক্ষা করে
    except BlockingIOError:
        log("আগের চালানো এখনো চলছে, এবার বাদ")
        return 0
    if not KEYFILE.exists():
        notify("খবরের বট", "Gemini চাবি নেই। ~/Lyanna-Backup/খবরের-বট-চালু.command আবার চালান।")
        return 1
    state = load_state()
    if approving:
        approve(state)
        return 0
    now = dt.datetime.now(DHAKA)
    try:
        sync_repo()
    except RuntimeError as e:
        log(f"রিপো হালনাগাদ হলো না: {e}")
        return 1
    src = REPO / "scripts/news/mac/approve.command"            # অনুমোদনের ফাইল সবসময় নতুন রাখা
    if src.exists():
        shutil.copy2(src, BOT / "approve.command")
        os.chmod(BOT / "approve.command", 0o755)
    for ds in targets(now, state):
        if state.get(ds, {}).get("status") == "draft" and (DRAFTS / ds / "day.json").exists():
            continue
        make_draft(ds, state)
        save_state(state)
    if any(st.get("status") == "draft" for st in state.values()):
        # পেছনে চলা কাজ জানালা খুলতে পারে না, তাই Terminal-এ অনুমোদনের জানালা খোলা
        notify("খবরের বট", "খসড়া তৈরি। অনুমোদনের জানালা খুলছে।")
        sh("open", "-a", "Terminal", str(BOT / "approve.command"), check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
