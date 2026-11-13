"""ধাপ ৪: ফাইল লেখা — news/day/YYYY-MM-DD.json, news/month/YYYY-MM.json, news/index.json।

দিনের ফাইল ছোট (২-৫ KB): শুধু আমাদের নিজের লেখা, তথ্য-ছক আর মূল লিংক; উৎসের লেখা বা উদ্ধৃতি নয়।
"""
from __future__ import annotations

from common import CATEGORIES, HOME_QUOTA, NEWS_DIR, SECTIONS, now_dhaka, read_json, write_json

QC_VERSION = 2          # ২০২৬-১১-১০: পরীক্ষার জন্য গুরুত্বপূর্ণ + ছক ৩-৬ + বানান-ধাপ (quality.py)

TOP_N = 7
MONTH_MIN_SCORE = 8


def public_item(item: dict, n: int, date: str) -> dict:
    return {
        "id": f"{date}-{n:02d}",
        "title": item["title"].strip(),
        "short": item["short"].strip(),
        "detail": item["detail"].strip(),
        "exam_point": (item.get("exam_point") or "").strip(),       # "পরীক্ষার জন্য গুরুত্বপূর্ণ" (আগে why_exam)
        "category": item["category"],
        "category_bn": CATEGORIES[item["category"]],
        "section": item.get("section", "intl"),
        "section_bn": SECTIONS[item.get("section", "intl")],
        "score": item["score"],
        "facts": [{"label": f["label"], "value": f["value"]} for f in item.get("facts", [])],
        "sources": item["sources"],
    }


def order(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: (-x["score"], -len(x["sources"])))


def pick_home(items: list[dict]) -> list[dict]:
    """হোমের ৭টা: HOME_QUOTA অনুযায়ী প্রতি ভাগ থেকে, ঘাটতি চমক-মান ধরে পূরণ; ফল চমক-মান ধরে সাজানো।"""
    chosen = []
    for sec, k in HOME_QUOTA.items():
        chosen += [x for x in items if x.get("section", "intl") == sec][:k]
    for x in items:
        if len(chosen) >= TOP_N:
            break
        if x not in chosen:
            chosen.append(x)
    return order(chosen[:TOP_N])


def write_day(date: str, items: list[dict], method: str, note: str = "", qc: dict | None = None) -> dict:
    items = order(items)
    home = pick_home(items)
    rest = [x for x in items if x not in home]
    pub = [public_item(it, n + 1, date) for n, it in enumerate(home + rest)]
    day = {
        "date": date,
        "generated_at": now_dhaka().isoformat(timespec="minutes"),
        "method": method,
        "note": note,
        "qc": {"v": QC_VERSION, **(qc or {})},
        "sections": SECTIONS,
        "top": pub[:len(home)],
        "more": pub[len(home):],
    }
    write_json(NEWS_DIR / "day" / f"{date}.json", day)
    return day


def update_month(day: dict) -> dict:
    date = day["date"]
    path = NEWS_DIR / "month" / f"{date[:7]}.json"
    month = read_json(path, {"month": date[:7], "items": []})
    month["items"] = [x for x in month["items"] if x.get("date") != date]
    for it in day["top"] + day["more"]:
        if it["score"] >= MONTH_MIN_SCORE:
            month["items"].append({"date": date, "id": it["id"], "title": it["title"], "short": it["short"],
                                   "section": it["section"], "category": it["category"], "score": it["score"]})
    month["items"].sort(key=lambda x: (-x["score"], x["date"]))
    month["updated"] = day["generated_at"]
    write_json(path, month)
    return month


def update_index(day: dict) -> None:
    path = NEWS_DIR / "index.json"
    idx = read_json(path, {"days": []})
    idx["days"] = [d for d in idx["days"] if d["date"] != day["date"]]
    idx["days"].append({"date": day["date"], "n": len(day["top"]) + len(day["more"])})
    idx["days"].sort(key=lambda d: d["date"], reverse=True)
    idx["latest"] = idx["days"][0]["date"]
    write_json(path, idx)


def rebuild_all(news_dir=None) -> None:
    """সব দিনের ফাইল থেকে news/index.json আর মাসের ফাইল নতুন করে (পুরোনো দিন বদলালে সূচি আর মাস যেন না পিছিয়ে থাকে)।"""
    from pathlib import Path
    nd = Path(news_dir or NEWS_DIR)
    days = sorted((read_json(p) for p in (nd / "day").glob("*.json")), key=lambda d: d["date"])
    months: dict[str, dict] = {}
    for day in days:
        ym = day["date"][:7]
        m = months.setdefault(ym, {"month": ym, "items": []})
        for it in [*day.get("top", []), *day.get("more", [])]:
            if it["score"] >= MONTH_MIN_SCORE:
                m["items"].append({"date": day["date"], "id": it["id"], "title": it["title"], "short": it["short"],
                                   "section": it["section"], "category": it["category"], "score": it["score"]})
        m["updated"] = day.get("generated_at", "")
    for ym, m in months.items():
        m["items"].sort(key=lambda x: (-x["score"], x["date"]))
        write_json(nd / "month" / f"{ym}.json", m)
    idx = {"days": sorted(({"date": d["date"], "n": len(d.get("top", [])) + len(d.get("more", []))} for d in days),
                          key=lambda d: d["date"], reverse=True)}
    if idx["days"]:
        idx["latest"] = idx["days"][0]["date"]
        write_json(nd / "index.json", idx)
