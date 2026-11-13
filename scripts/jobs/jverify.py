"""ধাপ ৩: যাচাই (AI ছাড়া)। ফল: সমস্যার তালিকা — খালি হলে প্রকাশযোগ্য।"""
from __future__ import annotations

import datetime as dt
import re

from jobs_common import EDU, to_ascii_digits


def _num(x):
    if x is None:
        return None
    m = re.search(r"\d+", to_ascii_digits(str(x)))
    return int(m.group()) if m else None


def _date(x):
    if not x:
        return None
    try:
        return dt.date.fromisoformat(str(x)[:10])
    except ValueError:
        return "bad"


def normalize(r: dict) -> dict:
    """মডেলের উত্তর গুছিয়ে রাখা (সংখ্যা সংখ্যায়, অজানা মান বাদ)।"""
    r = dict(r)
    for k in ("age_min", "age_max", "total_posts"):
        r[k] = _num(r.get(k))
    posts = []
    for p in r.get("posts") or []:
        if isinstance(p, dict) and (p.get("name") or "").strip():
            posts.append({"name": p["name"].strip(), "count": _num(p.get("count")), "grade": _num(p.get("grade"))})
    r["posts"] = posts
    if not r.get("total_posts") and posts and all(p["count"] for p in posts):
        r["total_posts"] = sum(p["count"] for p in posts)
    r["age_relax"] = [{"who": str(a.get("who", "")).strip(), "max": _num(a.get("max"))}
                      for a in r.get("age_relax") or [] if isinstance(a, dict) and _num(a.get("max"))]
    if r.get("edu_level") not in EDU:
        r["edu_level"] = None
    if not isinstance(r.get("districts"), list) and r.get("districts") != "all":
        r["districts"] = "all"
    return r


def check(r: dict, second: dict | None, today: dt.date, teletalk: dict | None = None) -> list[str]:
    bad = []
    if not r.get("is_recruitment", True):
        bad.append("নতুন নিয়োগ বিজ্ঞপ্তি নয়")
    pub, start, end, ref = (_date(r.get(k)) for k in ("published", "apply_start", "apply_end", "age_ref_date"))
    for name, d in (("বিজ্ঞপ্তির তারিখ", pub), ("আবেদন শুরু", start), ("শেষ তারিখ", end), ("বয়স গণনার তারিখ", ref)):
        if d == "bad":
            bad.append(f"{name} ঠিক তারিখ নয়")
    if not end or end == "bad":
        bad.append("শেষ তারিখ পাওয়া যায়নি")
    else:
        if end < today:
            bad.append("আবেদনের সময় শেষ")
        if start and start != "bad" and start > end:
            bad.append("আবেদন শুরু শেষ তারিখের পরে")
        if pub and pub != "bad" and end < pub:
            bad.append("শেষ তারিখ বিজ্ঞপ্তির আগে")
        if end > today + dt.timedelta(days=180):
            bad.append("শেষ তারিখ ছয় মাসের বেশি দূরে (ভুল পড়া?)")
    for k in ("age_min", "age_max"):
        if r.get(k) is not None and not 14 <= r[k] <= 60:
            bad.append(f"বয়স {r[k]} অস্বাভাবিক")
    if r.get("age_min") and r.get("age_max") and r["age_min"] > r["age_max"]:
        bad.append("সর্বনিম্ন বয়স সর্বোচ্চের বেশি")
    if not r.get("posts"):
        bad.append("পদের নাম পাওয়া যায়নি")
    # দুই পাঠ মেলানো (জরুরি ঘর)
    if second is None:
        bad.append("দ্বিতীয় পাঠ হয়নি")
    else:
        s_end = _date(second.get("apply_end"))
        if end and end != "bad" and s_end and s_end != end:
            bad.append(f"শেষ তারিখ দুই পাঠে আলাদা ({end} / {s_end})")
        for k, label in (("age_max", "বয়সসীমা"), ("total_posts", "পদসংখ্যা")):
            a, b = r.get(k), _num(second.get(k))
            if a is not None and b is not None and a != b:
                bad.append(f"{label} দুই পাঠে আলাদা ({a} / {b})")
            if a is not None and b is None and k == "age_max":
                bad.append("বয়সসীমা দ্বিতীয় পাঠে পাওয়া যায়নি")
    # টেলিটকের তালিকা = দ্বিতীয় জায়গা
    if teletalk:
        t_end = _date((teletalk.get("deadline") or "")[:10])
        if end and end != "bad" and t_end and abs((t_end - end).days) > 1:
            bad.append(f"শেষ তারিখ টেলিটকের সঙ্গে মেলেনি ({end} / {t_end})")
        t_total = sum(p["count"] or 0 for p in teletalk.get("posts", []))
        if r.get("total_posts") and t_total and t_total != r["total_posts"]:
            bad.append(f"মোট পদ টেলিটকের সঙ্গে মেলেনি ({r['total_posts']} / {t_total})")
    return bad
