"""ধাপ ১: উৎসের RSS/Atom থেকে গত ~৩০ ঘণ্টার শিরোনাম তোলা।

ফল: শিরোনামের তালিকা (উৎস, শিরোনাম, ছোট বিবরণ, লিংক, সময়) আর প্রতিটা ফিডের অবস্থা।
একটা ফিড না খুললে বাকিগুলো চলে।
"""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

from common import ROOT, http_get, log, read_json, strip_html

ATOM = "{http://www.w3.org/2005/Atom}"


def _when(s: str | None):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)        # RSS: "Tue, 03 Nov 2026 10:00:00 +0600"
    except (TypeError, ValueError):
        try:
            d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))   # Atom: ISO
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d


def _txt(el, tag):
    """ট্যাগের পুরো লেখা (ভেতরে HTML ট্যাগ থাকলেও)।"""
    x = el.find(tag)
    return "".join(x.itertext()) if x is not None else None


def parse_feed(raw: bytes):
    root = ET.fromstring(raw)
    out = []
    rss1 = "{http://purl.org/rss/1.0/}"
    for it in [*root.iter("item"), *root.iter(f"{rss1}item")]:     # RSS 2.0 আর RSS 1.0 (RDF)
        if it.tag.startswith(rss1):
            out.append({"title": strip_html(_txt(it, f"{rss1}title")),
                        "desc": strip_html(_txt(it, f"{rss1}description"))[:400],
                        "url": (it.findtext(f"{rss1}link") or "").strip(),
                        "time": _when(it.findtext("{http://purl.org/dc/elements/1.1/}date"))})
            continue
        out.append({
            "title": strip_html(_txt(it, "title")),
            "desc": strip_html(_txt(it, "description"))[:400],
            "url": (it.findtext("link") or "").strip(),
            "time": _when(it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date")),
        })
    for it in root.iter(f"{ATOM}entry"):                 # Atom
        link = it.find(f"{ATOM}link[@rel='alternate']")
        if link is None:                                 # Element-এর সত্য-মিথ্যা সন্তান ধরে, তাই `or` নয়
            link = it.find(f"{ATOM}link")
        out.append({
            "title": strip_html(it.findtext(f"{ATOM}title")),
            "desc": strip_html(_txt(it, f"{ATOM}summary") or _txt(it, f"{ATOM}content"))[:400],
            "url": (link.get("href") if link is not None else "").strip(),
            "time": _when(it.findtext(f"{ATOM}published") or it.findtext(f"{ATOM}updated")),
        })
    # পত্রিকার Google-সংবাদ-তালিকা (news sitemap): <url><loc/><news:news><news:title/><news:publication_date/>
    sm = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    gn = "{http://www.google.com/schemas/sitemap-news/0.9}"
    for u in root.iter(f"{sm}url"):
        nn = u.find(f"{gn}news")
        if nn is None:
            continue
        out.append({"title": strip_html(_txt(nn, f"{gn}title")), "desc": "",
                    "url": (u.findtext(f"{sm}loc") or "").strip(),
                    "time": _when(nn.findtext(f"{gn}publication_date"))})
    return [x for x in out if x["title"] and x["url"].startswith("http")]


class _LinkGrab(HTMLParser):
    """হোমপাতার <link rel="alternate" type="application/rss+xml" href="…">।"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag != "link":
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        if "alternate" in a.get("rel", "").lower() and ("rss" in a.get("type", "").lower() or "atom" in a.get("type", "").lower()):
            if a.get("href"):
                self.hrefs.append(a["href"])


def origin(url: str) -> str:
    u = urllib.parse.urlparse(url)
    return f"{u.scheme}://{u.netloc}"


def discover(home: str):
    """ঠিকানা না চললে সাইট নিজে যা জানায় তা থেকে খোঁজা: হোমপাতার RSS-লিংক, robots.txt-এর Sitemap।

    ফল: (ঠিকানার তালিকা, ব্যর্থতার বিবরণ)। সাইট নিজেই আটকালে (403) কিছু মেলে না; সেটা বিবরণে থাকে।
    """
    rss, maps, errs = [], [], []
    try:
        g = _LinkGrab()
        g.feed(http_get(home).decode("utf-8", "replace"))
        rss = [urllib.parse.urljoin(home, h) for h in g.hrefs]
    except Exception as e:  # noqa: BLE001
        errs.append(f"হোমপাতা {e.__class__.__name__}{(' ' + str(getattr(e, 'code', ''))).rstrip()}")
    try:
        for line in http_get(origin(home) + "/robots.txt").decode("utf-8", "replace").splitlines():
            if line.lower().startswith("sitemap:"):
                maps.append(line.split(":", 1)[1].strip())
    except Exception as e:  # noqa: BLE001
        errs.append(f"robots.txt {e.__class__.__name__}{(' ' + str(getattr(e, 'code', ''))).rstrip()}")
    maps.sort(key=lambda u: "news" not in u.lower())       # সংবাদের তালিকা আগে
    out = []
    for u in [*rss, *maps]:
        if u.startswith("http") and u not in out:
            out.append(u)
    return out[:8], errs


def child_sitemaps(raw: bytes):
    """sitemap-index (অনেক sitemap-এর তালিকা) হলে ভেতরের ঠিকানা; 'news' থাকাগুলো আগে, সর্বোচ্চ ৩টা।"""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    sm = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    locs = [(x.text or "").strip() for x in root.iter(f"{sm}loc") if root.tag == f"{sm}sitemapindex"]
    locs.sort(key=lambda u: "news" not in u.lower())
    return [u for u in locs if u.startswith("http")][:3]


def fetch_entries(url: str, depth: int = 0):
    raw = http_get(url)
    got = parse_feed(raw)
    if got or depth:
        return got
    for child in child_sitemaps(raw):
        try:
            got = fetch_entries(child, depth + 1)
        except Exception:  # noqa: BLE001
            continue
        if got:
            return got
    return got


def _try_urls(urls, tried):
    """ঠিকানাগুলো পরপর; প্রথম যেটায় খবর মেলে। ফল: (entries|None, ব্যবহৃত ঠিকানা, শেষ ব্যর্থতা)।"""
    entries, used, err = None, None, None
    for url in urls:
        if url in tried:
            continue
        tried.add(url)
        try:
            got = fetch_entries(url)
            if entries is None or (not entries and got):
                entries, used = got, url
            if got:                                           # খবর মিলেছে → আর খোঁজা নয়
                break
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", "")
            err = f"{e.__class__.__name__}{(' ' + str(code)) if code else ''}"
    return entries, used, err


def collect(until: dt.datetime, hours: int = 30):
    cfg = read_json(ROOT / "scripts/news/sources.json")
    since = until - dt.timedelta(hours=hours)
    items, health, seen = [], [], set()
    for f in cfg["feeds"]:
        tried = set()
        entries, used, err = _try_urls([u for u in [f.get("url"), *f.get("alt", [])] if u], tried)
        discovered = False
        if not entries:                                       # কিছুই মেলেনি → সাইটকেই জিজ্ঞেস
            first = f.get("home") or f.get("url") or next(iter(f.get("alt", [])), None)
            found, derrs = discover(f.get("home") or origin(first)) if first else ([], [])
            e2, u2, err2 = _try_urls(found, tried)
            if e2:
                entries, used, discovered = e2, u2, True
            elif entries is None and e2 is not None:
                entries, used = e2, u2
            err = "; ".join(x for x in [err or err2, *derrs] if x) or err
        if entries is None:
            health.append({"name": f["name"], "ok": False, "n": 0, "error": err})
            log(f"✗ {f['name']}: {err}")
            continue
        n = old = 0
        for e in entries:
            if e["time"] and not (since <= e["time"] <= until + dt.timedelta(hours=1)):
                old += 1
                continue
            key = hashlib.sha1((e["url"].split("?")[0] + "|" + e["title"]).encode()).hexdigest()[:12]
            if key in seen:
                continue
            seen.add(key)
            items.append({"id": key, "src": f["name"], "kind": f["kind"], "lang": f["lang"], "title": e["title"],
                          "desc": e["desc"], "url": e["url"],
                          "time": e["time"].isoformat() if e["time"] else None})
            n += 1
        health.append({"name": f["name"], "ok": True, "n": n, "total": len(entries), "old": old,
                       "url": used if used != f.get("url") else None, "discovered": discovered})
        log(f"✓ {f['name']}: {n}টা (ফিডে মোট {len(entries)}, সময়ের বাইরে {old})" + (" [নিজে খুঁজে পাওয়া ঠিকানা]" if discovered else ""))
    return items, health
