"""বটের আলাদা রাস্তা (PIASH, ২০২৬-১১-১৫): খবর আর নিয়োগ বিজ্ঞপ্তি সাইটে তোলা, PR-এর সঙ্গে কোনো সংঘাত ছাড়া।

সমস্যা ছিল: বট Mac-এর পুরো কপি নিয়ে GitHub-এ push করত। মাঝে কোনো PR একই পাতায় হাত দিলে (যেমন মেনু বদলাতে
news/ বা circular/-এর পাতা) Mac-এর কমিট GitHub-এর ওপর বসত না, দুই দিক মিলত না, আর কিছুই প্রকাশ হতো না।

এখনকার নিয়ম:
1. বটের নিজের জায়গা শুধু OWNED (news/ আর circular/)। সাইটের বাকি সব PR-এর; বট সেখানে কখনো কিছু বদলায় না।
   PR-এর দিকে live-guard-এর "বটের জায়গা" যাচাই news/ বা circular/-এ হাত দেওয়া PR আটকায়।
2. প্রকাশের মুহূর্তে বট GitHub-এর সর্বশেষ main নেয়, তার ওপর শুধু নিজের দুই ফোল্ডার বসিয়ে একটা নতুন কমিট বানায়
   (git-এর নিজস্ব গাছ জোড়া, rebase বা merge নয়), তারপর push। তাই conflict হওয়া সম্ভবই নয়, আর বট কখনো
   পুরোনো সাইট তুলে দিতে পারে না: বাকি সব ফাইল GitHub-এর main যেমন আছে তেমনই থাকে।
3. push-এর ঠিক আগে কেউ মার্জ করলে GitHub নাকচ করে; তখন আবার সর্বশেষ main নিয়ে একই কাজ (৩ বার পর্যন্ত)।
4. প্রতিটা চালানোর শুরুতে বটের কপি GitHub-এর সর্বশেষ main-এ ফেরে (fresh); না-পাঠানো নিজের কাজ থাকলে সেটুকু
   ওপরে বসানো থাকে, হারায় না। তাই বট সবসময় সর্বশেষ কোড আর পাতার ছাঁচ দিয়েই চলে।
5. GitHub-এ লেখার চাবি: ~/.lyanna/github.token থাকলে সেটা (শুধু BCS-QUIZ, Contents: Read and write), নইলে Mac-এর
   নিজের git-চাবি। চাবি লগে বা কমিটে কোথাও লেখা হয় না।
PR-এর দিনের ৪-৫টা মার্জের সীমায় এটা গোনা হয় না: এটা PR নয়, শুধু বটের দুই ফোল্ডারের কমিট।

চালানো (Mac-এর বটের কপির ভেতরে):
  python3 scripts/bot_lane.py status     # কী অবস্থা, কিছু বদলায় না
  python3 scripts/bot_lane.py ship       # বটের জমা কাজ সাইটে (GitHub main → Cloudflare নিজে তোলে)
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

OWNED = ("news", "circular")
REMOTE_PATH = "nrpiashnp-crypto/BCS-QUIZ"
TOKEN_FILE = Path.home() / ".lyanna" / "github.token"
BOT_NAME = "lyanna-news-bot"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
TRIES = 3


class LaneError(RuntimeError):
    """সাইটে তোলা গেল না; বার্তা বাংলায়। বটের কাজ Mac-এ জমা থাকে, পরের চালানোয় আবার চেষ্টা।"""


def _git(repo: Path, *args: str, env: dict | None = None, timeout: int = 180) -> subprocess.CompletedProcess:
    e = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    if env:
        e.update(env)
    try:
        return subprocess.run(["git", *args], cwd=repo, text=True, capture_output=True, timeout=timeout, env=e)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", "সময় শেষ")


def _out(repo: Path, *args: str) -> str:
    r = _git(repo, *args)
    return r.stdout.strip() if r.returncode == 0 else ""


def _push_url() -> str:
    tok = TOKEN_FILE.read_text(encoding="utf-8").strip() if TOKEN_FILE.exists() else ""
    if tok:
        return f"https://x-access-token:{tok}@github.com/{REMOTE_PATH}.git"
    return "origin"


def _hide(text: str) -> str:
    tok = TOKEN_FILE.read_text(encoding="utf-8").strip() if TOKEN_FILE.exists() else ""
    return text.replace(tok, "***") if tok else text


def fetch(repo: Path) -> bool:
    r = _git(repo, "fetch", "-q", "--depth", "30", "origin", "+refs/heads/main:refs/remotes/origin/main")
    return r.returncode == 0


def _tree(repo: Path, rev: str, path: str) -> str:
    return _out(repo, "rev-parse", "-q", "--verify", f"{rev}:{path}")


def owned_differs(repo: Path, a: str, b: str) -> bool:
    return any(_tree(repo, a, d) != _tree(repo, b, d) for d in OWNED)


def is_ancestor(repo: Path, a: str, b: str) -> bool:
    return _git(repo, "merge-base", "--is-ancestor", a, b).returncode == 0


def overlay(repo: Path, base: str, src: str, message: str) -> str:
    """base-এর পুরো গাছ, শুধু OWNED ফোল্ডারগুলো src থেকে → নতুন কমিট (parent = base)। working tree ছোঁয় না।"""
    with tempfile.TemporaryDirectory() as td:
        env = {"GIT_INDEX_FILE": str(Path(td) / "index"),
               "GIT_AUTHOR_NAME": BOT_NAME, "GIT_AUTHOR_EMAIL": BOT_EMAIL,
               "GIT_COMMITTER_NAME": BOT_NAME, "GIT_COMMITTER_EMAIL": BOT_EMAIL}
        steps = [("read-tree", base)]
        for d in OWNED:
            steps.append(("rm", "-r", "-q", "-f", "--cached", "--ignore-unmatch", "--", d))
            if _tree(repo, src, d):
                steps.append(("read-tree", f"--prefix={d}/", f"{src}:{d}"))
        for st in steps:
            r = _git(repo, *st, env=env)
            if r.returncode:
                raise LaneError(f"কমিট জোড়া গেল না ({st[0]}): {r.stderr.strip()[:160]}")
        tree = _git(repo, "write-tree", env=env).stdout.strip()
        r = _git(repo, "commit-tree", tree, "-p", base, "-m", message, env=env)
        if r.returncode or not r.stdout.strip():
            raise LaneError(f"কমিট বানানো গেল না: {r.stderr.strip()[:160]}")
        return r.stdout.strip()


def _clean_owned(repo: Path) -> None:
    _git(repo, "checkout", "-q", "--", *OWNED)
    _git(repo, "clean", "-qfd", "--", *OWNED)


def _message(repo: Path) -> str:
    subj = _out(repo, "log", "--format=%s", "-n", "6", "origin/main..HEAD").splitlines()
    subj = [s for s in subj if s and not s.startswith("bot: ")] or subj
    first = subj[0] if subj else "খবর ও নিয়োগ বিজ্ঞপ্তি"
    head = first if first.startswith("bot: ") else "bot: " + first
    body = "\n".join(f"- {s}" for s in subj[1:])
    return head + ("\n\n" + body if body else "") + "\n\nশুধু news/ আর circular/ (scripts/bot_lane.py; PR নয়)"


def fresh(repo: Path, log=print) -> str:
    """চালানোর শুরুতে: বটের কপি = GitHub-এর সর্বশেষ main (+ না-পাঠানো নিজের কাজ ওপরে)। GitHub না পেলে যেমন আছে।"""
    _git(repo, "rebase", "--abort")
    _git(repo, "am", "--abort")
    _clean_owned(repo)
    if not fetch(repo):
        log("GitHub থেকে আনা গেল না; বটের কপি যেমন আছে তেমন দিয়েই চলছে (প্রকাশ পরের বার)")
        return "local"
    base = _out(repo, "rev-parse", "origin/main")
    head = _out(repo, "rev-parse", "HEAD")
    target = base
    if head and not is_ancestor(repo, head, base) and owned_differs(repo, head, base):
        target = overlay(repo, base, head, _message(repo))
        log("না-পাঠানো খবর/বিজ্ঞপ্তি GitHub-এর সর্বশেষ main-এর ওপর বসানো হলো (প্রকাশের অপেক্ষায়)")
    _git(repo, "checkout", "-q", "-B", "main", target)
    r = _git(repo, "reset", "-q", "--hard", target)
    if r.returncode:
        raise LaneError(f"বটের কপি সর্বশেষ main-এ আনা গেল না: {r.stderr.strip()[:160]}")
    return "github"


def pending(repo: Path) -> bool:
    """GitHub-এ যায়নি এমন খবর/বিজ্ঞপ্তি আছে কি না (origin/main শেষবার যা জানা)।"""
    return owned_differs(repo, "HEAD", "origin/main")


def ship(repo: Path, log=print) -> str:
    """বটের দুই ফোল্ডার GitHub-এর সর্বশেষ main-এর ওপর বসিয়ে push। Cloudflare GitHub থেকে নিজে তোলে।"""
    if _out(repo, "status", "--porcelain", "--untracked-files=no", "--", *OWNED):
        raise LaneError("news/ বা circular/-এ কমিট না হওয়া বদল আছে; আগে কমিট, তারপর প্রকাশ।")
    last = ""
    for i in range(1, TRIES + 1):
        if not fetch(repo):
            raise LaneError("GitHub পাওয়া যাচ্ছে না; কাজ Mac-এ জমা থাকল, পরের চালানোয় আবার চেষ্টা।")
        base = _out(repo, "rev-parse", "origin/main")
        if not owned_differs(repo, "HEAD", base):
            _git(repo, "checkout", "-q", "-B", "main", base)
            _git(repo, "reset", "-q", "--hard", base)
            return "নতুন কিছু নেই; সাইটে আগেই আছে"
        c = overlay(repo, base, "HEAD", _message(repo))
        r = _git(repo, "push", "-q", _push_url(), f"{c}:refs/heads/main", timeout=300)
        if r.returncode == 0:
            _git(repo, "update-ref", "refs/remotes/origin/main", c)
            _git(repo, "checkout", "-q", "-B", "main", c)
            _git(repo, "reset", "-q", "--hard", c)
            return f"GitHub main ({c[:8]}) → Cloudflare নিজে তুলবে"
        last = _hide((r.stderr or "").strip())[:200]
        low = last.lower()
        if any(k in low for k in ("403", "401", "authentication", "permission", "denied", "could not read username")):
            raise LaneError("GitHub-এ লেখার অনুমতি নেই (চাবি নেই বা মেয়াদ শেষ)। খবরের-বট-চালু.command আবার চালিয়ে "
                            f"নতুন GitHub চাবি দিন। ({last})")
        log(f"push নাকচ ({i}/{TRIES}), সম্ভবত এইমাত্র কেউ মার্জ করেছেন; সর্বশেষ main নিয়ে আবার")
    raise LaneError(f"{TRIES} বার চেষ্টাতেও GitHub-এ পাঠানো গেল না; কাজ Mac-এ জমা থাকল। ({last})")


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    repo = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.cwd()
    try:
        if cmd == "status":
            ok = fetch(repo)
            print(("GitHub পাওয়া যাচ্ছে ✓" if ok else "GitHub পাওয়া যাচ্ছে না ✗"),
                  "· চাবি:", ("আছে" if TOKEN_FILE.exists() else "Mac-এর নিজের git-চাবি"),
                  "· প্রকাশের অপেক্ষায়:", ("হ্যাঁ" if pending(repo) else "না"))
        elif cmd == "fresh":
            print("✓", fresh(repo))
        elif cmd == "ship":
            print("✓", ship(repo))
        else:
            print(__doc__)
            return 2
    except LaneError as e:
        print("✗", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
