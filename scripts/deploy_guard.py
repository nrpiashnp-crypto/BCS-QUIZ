"""সাইটে তোলার পাহারা: Mac আর GitHub, দুই দিক মিলিয়ে তবেই সাইটে (PIASH, ২০২৬-১১-১৩)।

কেন: ৭/১১ থেকে Mac সরাসরি Cloudflare-এ তুলছিল কিন্তু GitHub-এ পাঠানো আটকে ছিল। ১৩/১১-এ PR #150 মার্জ হতেই
Cloudflare GitHub-এর পুরোনো কপি লাইভ করে, পাইলট-বই-খবর সব সাইট থেকে সরে যায় (#151-এ ফেরানো)।

নিয়ম (সব Mac-স্ক্রিপ্ট আর সব সেশনের জন্য):
1. সাইটে যাওয়ার একটাই রাস্তা GitHub-এর main। Mac কাজ GitHub-এ push করে, Cloudflare সেখান থেকে নিজে তোলে।
   push না হলে সাইটেও নয়: কাজ Mac-এ জমা থাকে, পরের বার যায়।
2. push-এর আগে মেলানো: GitHub-এর main Mac-এর কপির ভেতরে আছে কি না (Mac পিছিয়ে থাকলে থামা)।
3. জরুরি পথ (GitHub অনেকক্ষণ বন্ধ): PIASH নিজে ~/Lyanna-Backup/allow-direct-deploy ফাইল রাখলে তবেই Mac থেকে
   সরাসরি Cloudflare (wrangler)। তখন সাইটের মূলে live.json-এ কোন কমিট তোলা হলো লেখা থাকে; GitHub-এর
   "live-guard" যাচাই সেটা দেখে মার্জ আটকায়, যতক্ষণ না সেই কাজ GitHub-এ ওঠে।

চালানো (Mac-এর Terminal থেকে, রিপোর কপির ভেতরে):
  python3 scripts/deploy_guard.py check      # শুধু মেলানো, কিছু বদলায় না
  python3 scripts/deploy_guard.py ship       # মিলিয়ে push (Cloudflare GitHub থেকে নিজে তুলবে)
  python3 scripts/deploy_guard.py direct     # জরুরি পথ: শুধু অনুমতি-ফাইল থাকলে সরাসরি Cloudflare
Mac-এর deploy.sh (আর তাকে ডাকা ইনবক্স-মেলাও) এটাই চালায়: scripts/mac/deploy.sh।
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

ALLOW_DIRECT = Path.home() / "Lyanna-Backup" / "allow-direct-deploy"
PAGES_PROJECT = os.environ.get("LYANNA_PAGES_PROJECT", "bcs-quiz")
LIVE_FILE = "live.json"


class GuardError(RuntimeError):
    """মেলেনি: সাইটে তোলা যাবে না। বার্তা বাংলায়, PIASH-কে দেখানোর মতো।"""


def _git(repo: Path, *args: str, timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=repo, text=True, capture_output=True, timeout=timeout)


def _out(repo: Path, *args: str) -> str:
    return _git(repo, *args).stdout.strip()


def fetch_main(repo: Path) -> bool:
    r = _git(repo, "fetch", "-q", "--depth", "200", "origin", "+refs/heads/main:refs/remotes/origin/main")
    return r.returncode == 0


def state(repo: Path) -> dict:
    """দুই দিকের অবস্থা: Mac কত কমিট এগিয়ে, কত পিছিয়ে, কাজ অসমাপ্ত কি না।"""
    head = _out(repo, "rev-parse", "HEAD")
    gh = _out(repo, "rev-parse", "origin/main")
    ahead = int(_out(repo, "rev-list", "--count", "origin/main..HEAD") or 0)
    behind = int(_out(repo, "rev-list", "--count", "HEAD..origin/main") or 0)
    dirty = [ln for ln in _out(repo, "status", "--porcelain", "--untracked-files=no").splitlines() if ln.strip()]
    return {"head": head, "github": gh, "ahead": ahead, "behind": behind, "dirty": dirty}


def catch_up(repo: Path) -> None:
    """Mac পিছিয়ে থাকলে নিরাপদে GitHub-এর কাজ আনা: শুধু এগিয়ে-চলা (ff) বা rebase; না বসলে থামা, কিছু হারায় না।"""
    s = state(repo)
    if not s["behind"] or s["dirty"]:
        return
    if not s["ahead"]:
        _git(repo, "merge", "-q", "--ff-only", "origin/main")
        return
    if _git(repo, "rebase", "-q", "origin/main").returncode:
        _git(repo, "rebase", "--abort")


def check(repo: Path, sync: bool = False) -> dict:
    """push-এর আগে মেলানো। ঠিক থাকলে অবস্থা ফেরত, নইলে GuardError।"""
    if not fetch_main(repo):
        raise GuardError("GitHub পাওয়া যাচ্ছে না, তাই দুই দিক মেলানো গেল না। সাইটে তোলা হবে না; কাজ Mac-এ জমা থাকল।")
    if sync:
        catch_up(repo)
    s = state(repo)
    if s["dirty"]:
        raise GuardError(f"Mac-এর কপিতে কমিট না হওয়া বদল আছে ({len(s['dirty'])}টা ফাইল)। আগে কমিট বা বাতিল, তারপর সাইটে।")
    if s["behind"] and s["ahead"]:
        raise GuardError(f"GitHub-এ {s['behind']}টা আর Mac-এ {s['ahead']}টা আলাদা কমিট, নিজে থেকে মেলানো গেল না (সম্ভবত একই ফাইলে দুই দিকে বদল)। "
                         "সাইটে তোলা হলো না, কিছু হারায়নি; Claude-কে দিয়ে হাতে মেলাতে হবে।")
    if s["behind"]:
        raise GuardError(f"GitHub-এ এমন {s['behind']}টা কমিট আছে যা Mac-এর কপিতে নেই। এখন তুললে সেগুলো সাইট থেকে মুছে যেত। "
                         "আগে GitHub থেকে মিলিয়ে নিন (sync), তারপর আবার।")
    return s


def ship(repo: Path) -> str:
    """মিলিয়ে GitHub-এ push। Cloudflare GitHub থেকে নিজে তোলে, Mac থেকে সরাসরি নয়।"""
    s = check(repo, sync=True)
    if s["ahead"]:
        r = _git(repo, "push", "-q", "origin", "HEAD:main")
        if r.returncode:
            raise GuardError("GitHub-এ পাঠানো গেল না, তাই সাইটেও তোলা হলো না; কাজ Mac-এ জমা থাকল। "
                             f"({(r.stderr or '').strip()[:160]})")
        if not fetch_main(repo) or state(repo)["head"] != state(repo)["github"]:
            raise GuardError("push-এর পরে GitHub আর Mac মিলছে না; সাইটে তোলা থামানো হলো।")
        return f"GitHub ({s['ahead']}টা কমিট) → Cloudflare নিজে তুলবে"
    return "নতুন কিছু নেই; GitHub আর Mac মিলে আছে"


def direct_deploy(repo: Path, run_wrangler) -> str:
    """জরুরি পথ: GitHub বন্ধ, PIASH-এর অনুমতি-ফাইল আছে। run_wrangler(repo) → (ok, লগ)।"""
    if not ALLOW_DIRECT.exists():
        raise GuardError("GitHub-এ পাঠানো যাচ্ছে না, আর সরাসরি Cloudflare-এ তোলার অনুমতি-ফাইল নেই "
                         f"({ALLOW_DIRECT})। সাইটে তোলা হলো না; কাজ Mac-এ জমা থাকল।")
    s = state(repo)   # GitHub পাওয়া না গেলে origin/main শেষবার যা জানা ছিল
    if s["behind"]:
        raise GuardError("Mac-এর কপি শেষবার-জানা GitHub-এর চেয়ে পিছিয়ে; সরাসরি তোলা হলো না।")
    if s["dirty"]:
        raise GuardError("Mac-এর কপিতে কমিট না হওয়া বদল আছে; সরাসরি তোলা হলো না।")
    stamp = {"commit": s["head"], "from": "mac-direct", "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
             "note": "এই কমিট GitHub-এ না ওঠা পর্যন্ত BCS-QUIZ-এ কোনো PR মার্জ নয়"}
    (repo / LIVE_FILE).write_text(json.dumps(stamp, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        ok, tail = run_wrangler(repo)
    finally:
        (repo / LIVE_FILE).unlink(missing_ok=True)
    if not ok:
        raise GuardError(f"Cloudflare-এ সরাসরি তোলা গেল না: {tail[-200:]}")
    return "Cloudflare সরাসরি (জরুরি পথ; GitHub-এ ওঠার আগে কোনো PR মার্জ নয়)"


def wrangler(repo: Path) -> tuple[bool, str]:
    """সরাসরি Cloudflare-এ তোলা; শুধু direct_deploy() ডাকে।"""
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", "/usr/bin:/bin"))
    head = _out(repo, "rev-parse", "HEAD") or "local"
    r = subprocess.run(["npx", "--yes", "wrangler", "pages", "deploy", ".", "--project-name", PAGES_PROJECT,
                        "--branch", "main", "--commit-hash", head], cwd=repo, env=env, text=True,
                       capture_output=True, timeout=900)
    return r.returncode == 0, ((r.stdout or "") + (r.stderr or "")).strip()[-600:]


def main() -> int:
    repo = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.cwd()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    try:
        if cmd == "check":
            s = check(repo)
            print(f"ঠিক আছে ✓ GitHub আর Mac মিলছে। Mac এগিয়ে {s['ahead']}টা কমিট (push বাকি), পিছিয়ে ০।")
        elif cmd == "ship":
            print("✓", ship(repo))
        elif cmd == "direct":
            print("✓", direct_deploy(repo, wrangler))
        else:
            print(__doc__)
            return 2
    except GuardError as e:
        print("✗ থামানো হলো:", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
