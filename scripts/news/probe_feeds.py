"""পত্রিকার ফিড পরীক্ষা: কোন ঠিকানা চলে, কোনটা আটকায়, আর কেন।

Mac-এর Terminal থেকে (রিপোর মূল ফোল্ডারে):
    python3 scripts/news/probe_feeds.py                 # সব উৎস
    python3 scripts/news/probe_feeds.py কালের যুগান্তর    # নামের অংশ মিলিয়ে বাছাই
    python3 scripts/news/probe_feeds.py | tee probe.txt  # ফল ফাইলেও রাখতে

প্রতিটা ঠিকানার জন্য: HTTP কোড, আকার, কয়টা খবর পড়া গেল, সবচেয়ে নতুনটা কখন।
তারপর সাইটকে জিজ্ঞেস করে পাওয়া ঠিকানাগুলোও (collect.py যেমন করে)।
কিছু বদলায় না, শুধু দেখায়। Gemini লাগে না।
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request

import collect
from common import SSL_CTX, UA, read_json, ROOT


def status(url: str):
    """(কোড, বাইট) — ব্যর্থ হলেও কোড ফেরত।"""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
                                               "Accept-Language": "bn,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=SSL_CTX) as r:
            return r.status, r.read(3_000_000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"{e.__class__.__name__}", b""


def report(url: str) -> bool:
    code, raw = status(url)
    if not isinstance(code, int) or code != 200:
        why = {403: "সাইট আটকাচ্ছে", 404: "ঠিকানা নেই", 429: "বেশি অনুরোধ"}.get(code, "")
        print(f"   ✗ {code} {why}  {url}")
        return False
    try:
        got = collect.parse_feed(raw)
    except Exception as e:  # noqa: BLE001
        print(f"   ✗ 200 কিন্তু ফিড নয় ({e.__class__.__name__}), {len(raw)} বাইট  {url}")
        return False
    if not got and collect.child_sitemaps(raw):
        print(f"   ~ 200 sitemap-index, ভেতরে: {', '.join(collect.child_sitemaps(raw))}  {url}")
        return False
    times = [g["time"] for g in got if g["time"]]
    newest = max(times).astimezone().strftime("%d %b %H:%M") if times else "সময় নেই"
    print(f"   {'✓' if got else '✗'} 200  খবর {len(got)}টা, সবচেয়ে নতুন {newest}  {url}")
    return bool(got)


def main(argv):
    cfg = read_json(ROOT / "scripts/news/sources.json")
    want = argv[1:]
    feeds = [f for f in cfg["feeds"] if not want or any(w in f["name"] for w in want)]
    if not feeds:
        print("এই নামে কোনো উৎস নেই:", " ".join(want))
        return 1
    summary = []
    for f in feeds:
        print(f"\n● {f['name']}")
        ok = False
        for u in [x for x in [f.get("url"), *f.get("alt", [])] if x]:
            ok = report(u) or ok
        if not ok:
            first = f.get("home") or f.get("url") or f["alt"][0]
            home = f.get("home") or collect.origin(first)
            found, errs = collect.discover(home)
            print(f"   সাইটকে জিজ্ঞেস ({home}): {len(found)}টা ঠিকানা" + (f"; ব্যর্থ: {', '.join(errs)}" if errs else ""))
            for u in found:
                ok = report(u) or ok
        summary.append((f["name"], ok))
    print("\n=== সারাংশ ===")
    for name, ok in summary:
        print(f"{'✓ চলে     ' if ok else '✗ বন্ধ     '}{name}")
    print(f"\nচলছে {sum(1 for _, o in summary if o)}/{len(summary)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
