"""ধাপ ১: উৎস থেকে নিয়োগ বিজ্ঞপ্তির খোঁজ (AI ছাড়া)।

ফল: প্রার্থী-তালিকা [{source, org, type, title, page, doc, published}] — doc = মূল ফাইল (PDF/ছবি)।
gnews থেকে শুধু ইঙ্গিত (hints): প্রকাশের ভিত্তি নয়, অ্যাডমিনের তালিকায় যায়।
"""
from __future__ import annotations

import datetime as dt
import html
import re
import urllib.parse
import xml.etree.ElementTree as ET

from jobs_common import (HERE, SKIP, http_bytes, is_new_circular, log, now_dhaka, parse_bd_date, read_json,
                         to_ascii_digits)

MAX_AGE_DAYS = 45          # এর চেয়ে পুরোনো নোটিশ বাদ (আবেদনের সময় পেরিয়ে যাওয়ার কথা)
FILE_RX = re.compile(r"\.(pdf|jpe?g|png|webp)(\?|$)", re.I)


def _clean(s: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split())


def parse_portal(text: str, base: str) -> list[dict]:
    """জাতীয় তথ্য বাতায়নের নোটিশ-তালিকা: প্রতিটা <tr>-এ data-column="title|files|image|publish_date"।"""
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.S):
        cells = dict(re.findall(r'<td[^>]*data-column="(\w+)"[^>]*>(.*?)</td>', tr, re.S))
        title = _clean(cells.get("title", ""))
        if not title:
            continue
        # "files"/"image" = নোটিশ-তালিকা; "pdf" = পিএসসির পরীক্ষা-তালিকা (psc-exams)
        files = re.findall(r'href="([^"]+)"', cells.get("files", "") + cells.get("pdf", "") + cells.get("image", ""))
        files = [urllib.parse.urljoin(base, f) for f in files if FILE_RX.search(f)]
        page = re.search(r'href="(/pages/[^"]+)"', tr)
        rows.append({"title": title, "doc": files[0] if files else None,
                     "page": urllib.parse.urljoin(base, page.group(1)) if page else base,
                     "published": parse_bd_date(_clean(cells.get("publish_date", "")))})
    return rows


def parse_links(text: str, base: str) -> list[dict]:
    """সাধারণ পাতা: লেখায় নিয়োগ-শব্দ আছে এমন লিংক; ফাইল হলে সরাসরি doc।"""
    out = []
    for href, inner in re.findall(r'<a[^>]+href="([^"#][^"]*)"[^>]*>(.*?)</a>', text, re.S):
        title = _clean(inner) or _clean(re.sub(r"[-_/]+", " ", urllib.parse.unquote(href.rsplit("/", 1)[-1])))
        url = urllib.parse.urljoin(base, href)
        out.append({"title": title, "doc": url if FILE_RX.search(url) else None, "page": url, "published": None})
    return out


def doc_from_page(url: str, year: str | None = None) -> str | None:
    """নোটিশের নিজের পাতা থেকে মূল PDF/ছবি। টেলিটকের সাইটে পুরোনো বিজ্ঞপ্তিও থাকে, তাই এই বছরের নাম/তারিখওয়ালা
    ফাইল আগে, তার মধ্যে নামের সবচেয়ে বড় তারিখ-সংখ্যা (নতুনতম)।"""
    try:
        raw, _ = http_bytes(url, timeout=30, max_bytes=3_000_000)
    except Exception as e:  # noqa: BLE001
        log(f"  পাতা খুলল না: {url} ({e.__class__.__name__})")
        return None
    t = raw.decode("utf-8", "replace")
    files = []
    for h in re.findall(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", t, re.I):
        if FILE_RX.search(h) and not re.search(r"logo|icon|banner|favicon|sign", h, re.I):
            u = urllib.parse.urljoin(url, h.strip())
            if u not in files:
                files.append(u)
    if not files:
        return None
    year = year or str(now_dhaka().year)
    pdfs = [f for f in files if f.lower().split("?")[0].endswith(".pdf")] or files
    cur = [f for f in pdfs if year in f.rsplit("/", 1)[-1] or f"/{year}" in f]
    pool = cur or pdfs
    def stamp(f):
        nums = re.findall(r"\d{6,8}", f.rsplit("/", 1)[-1])
        return max(nums) if nums else ""
    return max(pool, key=stamp) if any(stamp(f) for f in pool) else pool[0]


def teletalk_doc(group: dict) -> str | None:
    """আবেদন-সাইটে ফাইল না পেলে টেলিটকের public-details থেকে বিজ্ঞপ্তির ফাইল খোঁজা।"""
    import json
    for p in group.get("posts", [])[:3]:
        if not p.get("tt_num"):
            continue
        try:
            raw, _ = http_bytes(f"https://alljobs.teletalk.com.bd/api/v1/govt-jobs/public-details?id={p['tt_num']}",
                                timeout=40, max_bytes=3_000_000)
        except Exception:  # noqa: BLE001
            continue
        text = json.dumps(json.loads(raw), ensure_ascii=False) if raw[:1] in b"{[" else raw.decode("utf-8", "replace")
        for f in re.findall(r'"([^"\s]+\.(?:pdf|jpe?g|png|webp))"', text, re.I):
            if re.search(r"logo|icon|banner|sign", f, re.I):
                continue
            return f if f.startswith("http") else "https://alljobs.teletalk.com.bd/media/" + f.lstrip("/")
    return None


def gnews(q: str) -> list[dict]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "bn", "gl": "BD", "ceid": "BD:bn"})
    raw, _ = http_bytes(url, timeout=30, max_bytes=3_000_000)
    out = []
    for it in ET.fromstring(raw).iter("item"):
        title = (it.findtext("title") or "").strip()
        pub = it.findtext("pubDate") or ""
        try:
            when = dt.datetime.strptime(pub[:25], "%a, %d %b %Y %H:%M:%S").date().isoformat()
        except ValueError:
            when = None
        src = it.find("source")
        out.append({"title": title, "link": it.findtext("link"), "published": when,
                    "site": (src.text if src is not None else "")})
    return out


TT = "https://alljobs.teletalk.com.bd/api/v1/govt-jobs/list?page={page}&limit=20"


def teletalk() -> list[dict]:
    """টেলিটকের খোলা সরকারি চাকরি (প্রতিটা পদ আলাদা সারি) → আবেদন-সাইট ধরে এক বিজ্ঞপ্তি।

    টেলিটকের তালিকা নিজেই দ্বিতীয় জায়গা: পদসংখ্যা আর শেষ তারিখ PDF-এর সঙ্গে মেলানো হয় (verify)।
    """
    import json
    jobs, page = [], 1
    while page <= 60:                                   # টেলিটক এক পাতায় ২০টার বেশি দেয় না; সব পাতা ঘুরে
        raw, _ = http_bytes(TT.format(page=page), timeout=60, max_bytes=20_000_000)
        d = json.loads(raw)
        got = d.get("govtJobs", [])
        jobs += got
        if not got or len(jobs) >= int(d.get("count") or 0):
            break
        page += 1
    by_site: dict[str, dict] = {}
    for j in jobs:
        site = (j.get("application_site") or "").strip()
        if not site:
            continue
        org = j.get("job_utilities_govtorganization") or {}
        g = by_site.setdefault(site, {"site": site, "org": org.get("name_bn") or org.get("name") or "",
                                      "org_site": org.get("website") or "", "posts": [],
                                      "published": (j.get("published_date") or "")[:10] or None,
                                      "deadline": j.get("deadline_date")})
        try:
            n = int(to_ascii_digits(str(j.get("vacancy") or "")).strip() or 0)
        except ValueError:
            n = 0
        g["posts"].append({"name": j.get("job_title_bn") or j.get("job_title") or "", "count": n or None,
                           "tt_id": j.get("job_id"), "tt_num": j.get("id")})
        if (j.get("deadline_date") or "") > (g["deadline"] or ""):
            g["deadline"] = j.get("deadline_date")
    return list(by_site.values())


def collect(today: dt.date | None = None, only: set[str] | None = None) -> tuple[list[dict], list[dict], list[dict]]:
    """ফল: (প্রার্থী, ইঙ্গিত, উৎসের অবস্থা)।"""
    today = today or now_dhaka().date()
    cutoff = (today - dt.timedelta(days=MAX_AGE_DAYS)).isoformat()
    cfg = read_json(HERE / "sources.json")
    cands, hints, health = [], [], []
    for s in cfg["sources"]:
        if s.get("ok") is False or (only and s["id"] not in only):
            continue
        try:
            if s["kind"] == "gnews":
                got = [h for h in gnews(s["q"]) if (h["published"] or "9") >= cutoff and is_new_circular(h["title"])]
                hints += [dict(h, source=s["id"]) for h in got]
                health.append({"id": s["id"], "ok": True, "n": len(got)})
                continue
            if s["kind"] == "teletalk":
                groups = teletalk()
                for g in groups:
                    title = f'{g["org"]}: ' + ", ".join(p["name"] for p in g["posts"][:6])
                    cands.append({"title": title, "doc": None, "page": g["site"], "published": g["published"],
                                  "source": s["id"], "org": g["org"], "type": s["type"], "teletalk": g})
                health.append({"id": s["id"], "ok": True, "n": len(groups)})
                continue
            raw, _ = http_bytes(s["url"], timeout=40, max_bytes=5_000_000)
            text = raw.decode("utf-8", "replace")
            rows = parse_portal(text, s["url"]) if s["kind"] == "portal" else parse_links(text, s["url"])
            # উৎসের নিজের শিরোনাম-নিয়ম ("want") আর বয়সসীমা ("max_age") থাকলে সেটা — পিএসসির বিজ্ঞপ্তির শিরোনামে
            # "নিয়োগ বিজ্ঞপ্তি" থাকে না ("৫১তম বিসিএস ... পরীক্ষা-২০২৬ এর বিজ্ঞপ্তি", "বিজ্ঞপ্তির ক্রমিক নম্বর ৭৮-৮২")
            want = re.compile(s["want"]) if s.get("want") else None
            good = (lambda t: bool(want.search(t or "")) and not SKIP.search(t or "")) if want else is_new_circular
            cut = (today - dt.timedelta(days=int(s["max_age"]))).isoformat() if s.get("max_age") else cutoff
            rows = [r for r in rows if good(r["title"]) and (r["published"] or "9") >= cut]
            for r in rows:
                if not r["doc"] and r["page"] != s["url"]:
                    r["doc"] = doc_from_page(r["page"])
                if r["doc"]:
                    cands.append(dict(r, source=s["id"], org=s["org"], type=s["type"]))
            health.append({"id": s["id"], "ok": True, "n": len(rows)})
        except Exception as e:  # noqa: BLE001 — একটা উৎস না খুললে বাকিগুলো চলে
            health.append({"id": s["id"], "ok": False, "err": f"{e.__class__.__name__}: {str(e)[:120]}"})
            log(f"  উৎস বন্ধ: {s['id']} ({e.__class__.__name__})")
    seen, uniq = set(), []
    for c in cands:
        k = c["doc"] or c["page"]
        if k not in seen:
            seen.add(k)
            uniq.append(c)
    return uniq, hints, health
