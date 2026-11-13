"""নিয়োগ বিজ্ঞপ্তির বট — সাধারণ যন্ত্র। খবরের বটের common.py (আনা, Gemini) ভাগ করে নেয়।

পরিকল্পনা: job-playground-plan.md (LY News প্রজেক্ট)। নিয়ম: প্রকাশ শুধু মূল প্রতিষ্ঠানের নিজের বিজ্ঞপ্তি থেকে;
AI শুধু পড়ে গুছিয়ে লেখে; জরুরি ঘর (শেষ তারিখ, বয়সসীমা, পদসংখ্যা) দুইবার আলাদা মডেলে পড়ে মিললে তবেই।
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.append(str(HERE.parent / "news"))

from common import (DHAKA, ROOT, SSL_CTX, UA, log, now_dhaka, read_json, write_json)  # noqa: E402,F401

CIRC_DIR = ROOT / "circular"
DATA_DIR = CIRC_DIR / "data"

TYPES = {"govt": "সরকারি", "govt_bank": "সরকারি ব্যাংক", "pvt_bank": "বেসরকারি ব্যাংক",
         "teacher": "শিক্ষক", "force": "বাহিনী", "other": "অন্যান্য"}
EDU = {"none": "শিক্ষাগত যোগ্যতা লাগে না", "jsc": "অষ্টম শ্রেণি", "ssc": "এসএসসি", "hsc": "এইচএসসি",
       "diploma": "ডিপ্লোমা", "bachelor": "স্নাতক", "master": "স্নাতকোত্তর"}
EDU_RANK = {k: i for i, k in enumerate(EDU)}

_BN_DIG = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

# শিরোনামে এগুলো থাকলে নতুন নিয়োগ বিজ্ঞপ্তি হতে পারে
WANT = re.compile(r"নিয়োগ\s*বিজ্ঞপ্তি|নিয়োগের\s*বিজ্ঞপ্তি|জনবল\s*নিয়োগ|পদে\s*নিয়োগ|নিয়োগ\s*সংক্রান্ত\s*বিজ্ঞপ্তি|"
                  r"শূন্য\s*পদ|recruitment|vacanc|job\s*circular|circular\s*for|career\s*opportunit", re.I)
# এগুলো থাকলে নতুন বিজ্ঞপ্তি নয় (ফল, প্রবেশপত্র, নিয়োগপত্র…) — পরে "বদল ধরা" অংশে কাজে লাগবে
SKIP = re.compile(r"নিয়োগপত্র|নিয়োগাদেশ|ফলাফল|প্রবেশপত্র|মৌখিক|লিখিত\s*পরীক্ষা|ব্যবহারিক|ভাইভা|সুপারিশ|অপেক্ষমান|"
                  r"সতর্ক|গ্রেডেশন|দরপত্র|টেন্ডার|পদোন্নতি|বদলি|পদায়ন|চূড়ান্ত\s*ফল|সময়সূচি|আসন\s*বিন্যাস|"
                  r"result|admit|viva|tender|corrigendum|promotion|transfer|seat\s*plan", re.I)


def to_ascii_digits(s: str) -> str:
    return (s or "").translate(_BN_DIG)


def parse_bd_date(s: str) -> str | None:
    """'১৭-১০-২০২৬', '17/10/2026', '2026-10-17' → '2026-10-17'।"""
    t = to_ascii_digits(s).strip()
    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", t)
    if m:
        y, mo, d = m.groups()
    else:
        m = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", t)
        if not m:
            return None
        d, mo, y = m.groups()
    try:
        return dt.date(int(y), int(mo), int(d)).isoformat()
    except ValueError:
        return None


def is_new_circular(title: str) -> bool:
    return bool(WANT.search(title or "")) and not SKIP.search(title or "")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def short_id(published: str | None, digest: str) -> str:
    return f"{(published or now_dhaka().date().isoformat())}-{digest[:6]}"


def http_bytes(url: str, timeout: int = 40, max_bytes: int = 20_000_000) -> tuple[bytes, str]:
    """ফাইল আনা (PDF/ছবি/পাতা)। সরকারি কিছু সাইটের সনদ ভাঙা থাকে, তাই দ্বিতীয়বার যাচাই ছাড়া।"""
    import ssl
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "bn,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.read(max_bytes), r.headers.get("Content-Type", "")
    except ssl.SSLError:
        loose = ssl.create_default_context()
        loose.check_hostname = False
        loose.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=timeout, context=loose) as r:
            return r.read(max_bytes), r.headers.get("Content-Type", "")


def mime_of(url: str, ctype: str, data: bytes) -> str | None:
    """Gemini-কে পাঠানোর ধরন; পড়া যায় না এমন হলে None।"""
    if data[:4] == b"%PDF" or "pdf" in ctype.lower():
        return "application/pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


# ---------- বয়স ----------

def age_on(dob: str, ref: str) -> tuple[int, int, int]:
    """ref তারিখে বয়স (বছর, মাস, দিন)।"""
    b, r = dt.date.fromisoformat(dob), dt.date.fromisoformat(ref)
    y = r.year - b.year
    m = r.month - b.month
    d = r.day - b.day
    if d < 0:
        m -= 1
        prev = (r.replace(day=1) - dt.timedelta(days=1))
        d += prev.day
    if m < 0:
        y -= 1
        m += 12
    return y, m, d


def eligibility(dob: str, c: dict) -> tuple[str, str]:
    """('yes'|'relax'|'no'|'unknown', কারণ)। বিজ্ঞপ্তির নিজের বয়স-গণনার তারিখে; না থাকলে আবেদনের শেষ দিনে।

    বাংলাদেশের বিজ্ঞপ্তির রীতি: "সর্বোচ্চ ৩২ বছর" = পূর্ণ বছর ৩২ পর্যন্ত চলে (৩২ বছর ১১ মাসও)।
    """
    ref = c.get("age_ref_date") or (c.get("apply_end") or "")[:10]
    if not ref or not c.get("age_max"):
        return "unknown", "বয়সের নিয়ম বিজ্ঞপ্তিতে দেখে নিন"
    y, _, _ = age_on(dob, ref)
    lo = c.get("age_min") or 0
    if y < lo:
        return "no", f"বয়স কম ({lo} লাগবে)"
    if y <= c["age_max"]:
        return "yes", "আবেদন করা যায়"
    ok = [r["who"] for r in c.get("age_relax") or [] if r.get("max") and y <= r["max"]]
    if ok:
        return "relax", "শুধু " + ", ".join(ok)
    return "no", "বয়সসীমা পেরিয়েছে"
