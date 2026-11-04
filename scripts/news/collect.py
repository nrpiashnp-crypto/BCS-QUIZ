"""ধাপ ১: উৎসের RSS/Atom থেকে গত ~৩০ ঘণ্টার শিরোনাম তোলা।

ফল: শিরোনামের তালিকা (উৎস, শিরোনাম, ছোট বিবরণ, লিংক, সময়) আর প্রতিটা ফিডের অবস্থা।
একটা ফিড না খুললে বাকিগুলো চলে।
"""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import xml.etree.ElementTree as ET

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
    for it in root.iter("item"):                         # RSS 2.0
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
    return [x for x in out if x["title"] and x["url"].startswith("http")]


def collect(until: dt.datetime, hours: int = 30):
    cfg = read_json(ROOT / "scripts/news/sources.json")
    since = until - dt.timedelta(hours=hours)
    items, health, seen = [], [], set()
    for f in cfg["feeds"]:
        try:
            entries = parse_feed(http_get(f["url"]))
        except Exception as e:  # noqa: BLE001
            health.append({"name": f["name"], "ok": False, "n": 0, "error": e.__class__.__name__})
            log(f"✗ {f['name']}: {e.__class__.__name__}")
            continue
        n = 0
        for e in entries:
            if e["time"] and not (since <= e["time"] <= until + dt.timedelta(hours=1)):
                continue
            key = hashlib.sha1((e["url"].split("?")[0] + "|" + e["title"]).encode()).hexdigest()[:12]
            if key in seen:
                continue
            seen.add(key)
            items.append({"id": key, "src": f["name"], "kind": f["kind"], "lang": f["lang"], "title": e["title"],
                          "desc": e["desc"], "url": e["url"],
                          "time": e["time"].isoformat() if e["time"] else None})
            n += 1
        health.append({"name": f["name"], "ok": True, "n": n})
        log(f"✓ {f['name']}: {n}টা")
    return items, health
