"""পুরোনো দিনের শিরোনাম: পত্রিকার আর্কাইভ পাতা বা দিনভিত্তিক sitemap থেকে (PIASH, ২০২৬-১১-১৯: ১ জানুয়ারি ২০২৬ থেকে সব দিন)।

ফিডে শুধু শেষ ১-২ দিনের খবর থাকে, তাই পুরোনো দিনের জন্য এটা। collect.collect()-এর মতোই ফল দেয়:
(শিরোনামের তালিকা, উৎসের অবস্থা) — run_daily.py --archive এটা ব্যবহার করে, বাকি ধাপ (বাছাই, দুই-উৎস/বিশ্বস্ত যাচাই,
নিজের ভাষায় লেখা, বানান) একই।

প্রতিটা পত্রিকার আর্কাইভের ধাঁচ আলাদা। স্ক্রিপ্ট নিজে খুঁজে নেয়, আর যেটা কাজ করে সেটা মনে রাখে
(~/Lyanna-Backup/news-bot/archive-formats.json):
1. জানা ছাঁচ: {base}/sitemap/sitemap-daily-YYYY-MM-DD.xml (প্রথম আলো ধাঁচ), {base}/archive/YYYY-MM-DD (ইত্তেফাক ধাঁচ) ইত্যাদি।
2. না মিললে robots.txt-এর Sitemap → sitemap-সূচি → যার নামে সেই তারিখ (বা মাস) আছে।
3. sitemap-এ শিরোনাম না থাকলে খবরের পাতার <title> পড়ে (উৎসপ্রতি সীমা রেখে)।

হাতে পরখ (Mac-এ, বটের কপির ভেতরে):  python3 scripts/news/archive.py 2026-01-15
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

from common import ROOT, domain, http_get, log, read_json, strip_html

# পুরোনো দিনের জন্য কোন পত্রিকা (ফিডের নাম sources.json-এর সঙ্গে মেলে)। বিশ্বস্ত পত্রিকাগুলো আগে।
SITES = [
    {"name": "প্রথম আলো", "base": "https://www.prothomalo.com", "lang": "bn"},
    {"name": "প্রথম আলো ইংরেজি", "base": "https://en.prothomalo.com", "lang": "en"},
    {"name": "ইত্তেফাক", "base": "https://www.ittefaq.com.bd", "lang": "bn"},
    {"name": "সমকাল", "base": "https://samakal.com", "lang": "bn"},
    {"name": "ঢাকা ট্রিবিউন", "base": "https://www.dhakatribune.com", "lang": "en"},
    {"name": "দ্য ডেইলি স্টার", "base": "https://www.thedailystar.net", "lang": "en"},
    {"name": "দ্য ডেইলি স্টার বাংলা", "base": "https://bangla.thedailystar.net", "lang": "bn"},
    {"name": "বাসস", "base": "https://www.bssnews.net", "lang": "en"},
    {"name": "বাংলা ট্রিবিউন", "base": "https://www.banglatribune.com", "lang": "bn"},
    {"name": "যুগান্তর", "base": "https://www.jugantor.com", "lang": "bn"},
    {"name": "জাগো নিউজ", "base": "https://www.jagonews24.com", "lang": "bn"},
    {"name": "দ্য বিজনেস স্ট্যান্ডার্ড", "base": "https://www.tbsnews.net", "lang": "en"},
    {"name": "বিডিনিউজ২৪", "base": "https://bdnews24.com", "lang": "en"},
]

TEMPLATES = [
    "{base}/sitemap/sitemap-daily-{d}.xml",
    "{base}/archive/{d}",
    "{base}/sitemap/{y}/{m}/{dd}.xml",
    "{base}/sitemap/{d}.xml",
    "{base}/sitemap-{d}.xml",
    "{base}/news-sitemap-{d}.xml",
    "{base}/archive?date={d}",
    "{base}/archives/{d}",
]

PER_SITE = 90            # উৎসপ্রতি সর্বোচ্চ শিরোনাম (দিনে)
TITLE_FETCH = 90         # sitemap-এ শিরোনাম না থাকলে সর্বোচ্চ কতটা পাতা খুলে শিরোনাম পড়া
MIN_LINKS = 5            # এর কম খবরের লিংক মিললে ছাঁচটা "কাজ করেনি" ধরা
SKIP_PATH = re.compile(r"/(entertainment|lifestyle|life-style|photo|photos|gallery|video|videos|opinion|op-ed|religion|"
                       r"horoscope|bioscope|tags?|topic|author|astrology|fun|showbiz|binodon|rashifol|jibonjapon|"
                       r"onnoalo|feature|podcast|live|amp)(/|$)", re.I)
CACHE = Path(os.environ.get("LYANNA_NEWS_BOT", Path.home() / "Lyanna-Backup" / "news-bot")) / "archive-formats.json"
NS_NEWS = "{http://www.google.com/schemas/sitemap-news/0.9}"
NS_SM = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def _variants(d: dt.date) -> dict:
    return {"d": d.isoformat(), "y": f"{d.year}", "m": f"{d.month:02d}", "dd": f"{d.day:02d}"}


def _get(url: str, max_bytes: int = 4_000_000) -> bytes:
    return http_get(url, timeout=25, max_bytes=max_bytes)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_sitemap(raw: bytes) -> tuple[list[dict], list[str]]:
    """urlset → [{url, title, time}]; sitemapindex → [], [চাইল্ড sitemap]।"""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return [], []
    if _local(root.tag) == "sitemapindex":
        return [], [(s.findtext(f"{NS_SM}loc") or s.findtext("loc") or "").strip() for s in root
                    if _local(s.tag) == "sitemap"]
    out = []
    for u in root:
        if _local(u.tag) != "url":
            continue
        loc = (u.findtext(f"{NS_SM}loc") or u.findtext("loc") or "").strip()
        title, when = "", (u.findtext(f"{NS_SM}lastmod") or u.findtext("lastmod") or "")
        for el in u.iter():
            if _local(el.tag) == "title" and el.text and el.tag.startswith(NS_NEWS):
                title = el.text.strip()
            if _local(el.tag) == "publication_date" and el.text:
                when = el.text.strip()
        if loc:
            out.append({"url": loc, "title": html.unescape(title), "time": when})
    return out, []


_A = re.compile(r'<a\b[^>]*href="([^"#]+)"[^>]*>(.*?)</a>', re.I | re.S)


def parse_archive_html(raw: bytes, base: str) -> list[dict]:
    """আর্কাইভের HTML পাতা থেকে খবরের লিংক আর শিরোনাম (ইত্তেফাক ধাঁচ)।"""
    text = raw.decode("utf-8", "ignore")
    host = domain(base)
    out, seen = [], set()
    for href, inner in _A.findall(text):
        url = urllib.parse.urljoin(base + "/", html.unescape(href))
        if domain(url) != host or url in seen:
            continue
        path = urllib.parse.urlparse(url).path
        t = strip_html(inner)
        if len(t) < 18 or path.count("/") < 2 or not re.search(r"\d{3,}|[a-z0-9]{8,}$", path):
            continue
        seen.add(url)
        out.append({"url": url, "title": t, "time": ""})
    return out


def _is_news(url: str) -> bool:
    p = urllib.parse.urlparse(url).path
    return p.count("/") >= 2 and not SKIP_PATH.search(p) and not p.endswith((".jpg", ".png", ".xml"))


def _same_day(when: str, d: dt.date) -> bool:
    return not when or when[:10] == d.isoformat()


def _try(url: str, base: str, d: dt.date) -> list[dict]:
    raw = _get(url)
    if raw.lstrip()[:200].lower().find(b"<urlset") >= 0 or b"<sitemapindex" in raw[:400]:
        rows, kids = parse_sitemap(raw)
        if kids:                                  # দিনের সূচি → ভেতরের sitemap-গুলো
            for k in kids[:6]:
                rows += parse_sitemap(_get(k))[0]
        rows = [r for r in rows if _same_day(r["time"], d)]
    else:
        rows = parse_archive_html(raw, base)
    return [r for r in rows if _is_news(r["url"]) and domain(r["url"]) == domain(base)]


def _discover(base: str, d: dt.date) -> tuple[list[dict], dict | None]:
    """robots.txt → sitemap-সূচি → যার নামে এই তারিখ বা মাস আছে।"""
    v = _variants(d)
    keys = [v["d"], f"{v['y']}/{v['m']}/{v['dd']}", f"{v['y']}{v['m']}{v['dd']}", f"{v['y']}-{v['m']}", f"{v['y']}/{v['m']}"]
    try:
        robots = _get(base + "/robots.txt", 200_000).decode("utf-8", "ignore")
    except Exception:  # noqa: BLE001
        robots = ""
    maps = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", robots) or [base + "/sitemap.xml", base + "/sitemap_index.xml"]
    for sm in maps[:6]:
        try:
            rows, kids = parse_sitemap(_get(sm))
        except Exception:  # noqa: BLE001
            continue
        for key in keys:
            hit = [k for k in kids if key in k]
            if not hit:
                continue
            got = []
            for k in hit[:4]:
                try:
                    got += [r for r in parse_sitemap(_get(k))[0] if _same_day(r["time"], d)]
                except Exception:  # noqa: BLE001
                    continue
            got = [r for r in got if _is_news(r["url"]) and domain(r["url"]) == domain(base)]
            if len(got) >= MIN_LINKS:
                return got, {"index": sm, "key": keys.index(key)}
    return [], None


def _from_index(base: str, how: dict, d: dt.date) -> list[dict]:
    v = _variants(d)
    keys = [v["d"], f"{v['y']}/{v['m']}/{v['dd']}", f"{v['y']}{v['m']}{v['dd']}", f"{v['y']}-{v['m']}", f"{v['y']}/{v['m']}"]
    key = keys[how.get("key", 0)]
    _, kids = parse_sitemap(_get(how["index"]))
    got = []
    for k in [k for k in kids if key in k][:4]:
        got += [r for r in parse_sitemap(_get(k))[0] if _same_day(r["time"], d)]
    return [r for r in got if _is_news(r["url"]) and domain(r["url"]) == domain(base)]


_TITLE = re.compile(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"|<title[^>]*>(.*?)</title>', re.I | re.S)
_DESC = re.compile(r'<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]+)"', re.I)


def _page_title(url: str) -> tuple[str, str]:
    try:
        raw = _get(url, 160_000).decode("utf-8", "ignore")
    except Exception:  # noqa: BLE001
        return "", ""
    m = _TITLE.search(raw)
    t = html.unescape((m.group(1) or m.group(2) or "") if m else "").strip()
    t = re.split(r"\s+[|–—-]\s+(?=[^|–—-]{2,40}$)", t)[0].strip()          # " | প্রথম আলো" অংশ বাদ
    dm = _DESC.search(raw)
    return t, html.unescape(dm.group(1)).strip() if dm else ""


def load_cache() -> dict:
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_cache(c: dict) -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError:
        pass


def site_rows(site: dict, d: dt.date, cache: dict) -> tuple[list[dict], str]:
    """একটা পত্রিকার সেই দিনের লিংক। ফল: (rows, কীভাবে পাওয়া গেল / কেন গেল না)।"""
    base, v = site["base"], _variants(d)
    how = cache.get(base)
    errs = []
    if how and how.get("template"):
        try:
            rows = _try(how["template"].format(base=base, **v), base, d)
            if rows:
                return rows, "ছাঁচ (মনে রাখা)"
        except Exception as e:  # noqa: BLE001
            errs.append(f"{e.__class__.__name__}")
    if how and how.get("index"):
        try:
            rows = _from_index(base, how, d)
            if rows:
                return rows, "sitemap-সূচি (মনে রাখা)"
        except Exception as e:  # noqa: BLE001
            errs.append(f"{e.__class__.__name__}")
    for t in TEMPLATES:
        try:
            rows = _try(t.format(base=base, **v), base, d)
        except Exception as e:  # noqa: BLE001
            errs.append(f"{e.__class__.__name__} {getattr(e, 'code', '')}".strip())
            continue
        if len(rows) >= MIN_LINKS:
            cache[base] = {"template": t, "found": d.isoformat()}
            return rows, "নতুন খুঁজে পাওয়া ছাঁচ"
    rows, how2 = _discover(base, d)
    if how2:
        cache[base] = {**how2, "found": d.isoformat()}
        return rows, "robots/sitemap থেকে খুঁজে পাওয়া"
    return [], "আর্কাইভ পাওয়া যায়নি" + (f" ({'; '.join(sorted(set(errs))[:3])})" if errs else "")


def collect_day(d: dt.date):
    """collect.collect()-এর মতো: (items, health)।"""
    cfg = read_json(ROOT / "scripts/news/sources.json")
    kinds = {f["name"]: f.get("kind", "news") for f in cfg["feeds"]}
    cache = load_cache()
    items, health, seen = [], [], set()
    for site in SITES:
        try:
            rows, how = site_rows(site, d, cache)
        except Exception as e:  # noqa: BLE001
            rows, how = [], f"{e.__class__.__name__}"
        uniq = []
        for r in rows:
            u = r["url"].split("?")[0]
            if u not in seen:
                seen.add(u)
                uniq.append({**r, "url": u})
        uniq = uniq[:PER_SITE]
        need = [r for r in uniq if not r["title"]][:TITLE_FETCH]
        if need:                                   # sitemap-এ শিরোনাম নেই → পাতা খুলে (একসঙ্গে ৮টা)
            with cf.ThreadPoolExecutor(8) as ex:
                for r, (t, desc) in zip(need, ex.map(lambda x: _page_title(x["url"]), need)):
                    r["title"], r["desc"] = t, desc
        n = 0
        for r in uniq:
            if not r["title"]:
                continue
            key = hashlib.sha1((r["url"] + "|" + r["title"]).encode()).hexdigest()[:12]
            items.append({"id": key, "src": site["name"], "kind": kinds.get(site["name"], "news"), "lang": site["lang"],
                          "title": strip_html(r["title"]), "desc": strip_html(r.get("desc", ""))[:400], "url": r["url"],
                          "time": f"{d.isoformat()}T12:00:00+06:00"})
            n += 1
        ok = n > 0
        health.append({"name": site["name"], "ok": ok, "n": n, "total": len(rows), "old": 0,
                       **({} if ok else {"error": how})})
        log(f"{'✓' if ok else '✗'} {site['name']} (আর্কাইভ): {n}টা — {how}")
    save_cache(cache)
    return items, health


if __name__ == "__main__":
    day = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today() - dt.timedelta(days=30)
    its, h = collect_day(day)
    print(f"\n{day}: মোট {len(its)}টা শিরোনাম, {sum(1 for x in h if x['ok'])}/{len(h)}টা পত্রিকা")
    for it in its[:15]:
        print(" -", it["src"], "|", it["title"][:80])
