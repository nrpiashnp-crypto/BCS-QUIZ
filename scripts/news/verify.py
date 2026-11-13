"""দুই-উৎস নিয়ম আর হুবহু-না নিয়ম — AI ছাড়া, শুধু হিসাব করে।

একটা ঘটনা প্রকাশ হবে কেবল যদি:
1. অন্তত দুটো আলাদা প্রতিষ্ঠানের (ডোমেইন) খবর থাকে;
2. প্রতিটা "তথ্য" (নাম, সংখ্যা, তারিখ) দুটো আলাদা উৎসের লেখায় হুবহু উদ্ধৃতি দিয়ে পাওয়া যায়
   — উদ্ধৃতিটা সত্যিই সেই পাতার লেখায় আছে কি না স্ক্রিপ্ট নিজে মেলায়, AI-কে বিশ্বাস করে নয়;
3. সারাংশে যত সংখ্যা আছে, সবই কোনো যাচাই-হওয়া তথ্যে আছে;
4. সারাংশের কোনো টানা ৮ শব্দ মূল লেখার সঙ্গে হুবহু মেলে না।
না মিললে ঘটনাটা "অ্যাডমিনের কাছে" তালিকায় যায়, প্রকাশ হয় না।

ব্যতিক্রম (PIASH, ২০২৬-১১-১০): বিশ্বস্ত পত্রিকা (quality.TRUSTED_DOMAINS — প্রথম আলো, ইত্তেফাক, ডেইলি স্টার)-র
একটা উৎসেই চলে — ঘটনায় একটা উৎস হলেও, আর তথ্যের উদ্ধৃতি শুধু সেই পত্রিকায় হলেও। উদ্ধৃতি মেলানো, সংখ্যা মেলানো
আর হুবহু-না নিয়ম তখনও একই।
"""
from __future__ import annotations

import re

from quality import trusted

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
SCALES = (1, 10, 100, 1000, 0.1, 0.01, 0.001)       # কোটি↔বিলিয়ন (×০.০১), লাখ↔মিলিয়ন (×০.১) ইত্যাদি
SHINGLE = 8


def norm(s: str) -> str:
    s = (s or "").translate(BN_DIGITS).lower()
    s = re.sub(r"(?<=\d)[,٬](?=\d{2,3}\b)", "", s)   # 3,99,000 → 399000
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("‌", "").replace("‍", "")
    return " ".join(s.split())


def numbers(s: str) -> set[float]:
    out = set()
    for m in re.findall(r"\d+(?:\.\d+)?", norm(s)):
        try:
            out.add(round(float(m), 4))
        except ValueError:
            pass
    return out


def _num_in(n: float, pool: set[float]) -> bool:
    return any(abs(n * k - p) < 1e-6 * max(1, abs(p)) for k in SCALES for p in pool)


def words(s: str) -> list[str]:
    return re.findall(r"[\wঀ-৿]+", norm(s))


def shared_run(a: str, b: str, n: int = SHINGLE) -> str | None:
    """a আর b-তে টানা n শব্দ হুবহু থাকলে সেই অংশ ফেরত।"""
    wa, wb = words(a), words(b)
    if len(wa) < n or len(wb) < n:
        return None
    grams = {tuple(wb[i:i + n]) for i in range(len(wb) - n + 1)}
    for i in range(len(wa) - n + 1):
        g = tuple(wa[i:i + n])
        if g in grams:
            return " ".join(g)
    return None


def check_item(item: dict, texts: list[dict], allow_numbers: set[float] = frozenset()) -> tuple[bool, list[str]]:
    """texts: [{"domain": ..., "text": ...}] — item["facts"][*]["evidence"][*]["src"] এই তালিকার সূচক।"""
    why = []
    doms = {t["domain"] for t in texts if t.get("text")}
    if len(doms) < 2 and not any(trusted(d) for d in doms):
        why.append("দুটো আলাদা উৎস নেই (একটা হলে বিশ্বস্ত পত্রিকার হতে হবে)")

    verified_nums: set[float] = set()
    facts = item.get("facts") or []
    kept, dropped = [], []
    for f in facts:
        good_doms = set()
        for ev in f.get("evidence") or []:
            i, q = ev.get("src"), norm(ev.get("quote", ""))
            if not isinstance(i, int) or not (0 <= i < len(texts)) or len(q) < 3:
                continue
            if q in norm(texts[i]["text"]):
                vnums = numbers(f.get("value", ""))
                if all(_num_in(n, numbers(q)) for n in vnums):
                    good_doms.add(texts[i]["domain"])
        if len(good_doms) >= 2 or any(trusted(d) for d in good_doms):
            verified_nums |= numbers(f.get("value", ""))
            kept.append(f)
        else:
            dropped.append(f)
    # এক উৎসের তথ্য বাদ যায়, পুরো ঘটনা নয় — তবে লেখায় সেই নাম/সংখ্যা থাকলে ঘটনা আটকায় (নিচে)
    item["facts"] = kept
    item["_dropped"] = [f"{f.get('label', '')} = {f.get('value', '')}" for f in dropped]
    if not kept:
        why.append("দুই উৎসে (বা একটা বিশ্বস্ত পত্রিকায়) মেলে এমন কোনো তথ্য নেই")

    shown = " ".join(str(item.get(k, "")) for k in ("title", "short", "detail", "exam_point"))
    for n in numbers(shown):
        if n in allow_numbers or n in verified_nums:
            continue
        why.append(f"সারাংশের সংখ্যা দুই উৎসে মেলেনি: {n:g}")
    shown_n = norm(shown)
    for f in dropped:
        v = norm(str(f.get("value", "")))
        if len(v) >= 4 and not numbers(v) and v in shown_n:
            why.append(f"লেখার নাম/তথ্য দুই উৎসে মেলেনি: {f.get('label', '')} = {f.get('value', '')}")

    for k in ("short", "detail", "exam_point"):
        for t in texts:
            run = shared_run(item.get(k, ""), t.get("text", ""))
            if run:
                why.append(f"মূল লেখার সঙ্গে হুবহু মিল ({t['domain']}): “{run}”")
                break
    return (not why), why


SENT = re.compile(r"(?<=[।!?])\s+")


def _bad_sentence(sent: str, texts: list[dict], ok_nums: set[float], dropped_vals: list[str]) -> bool:
    if any(n not in ok_nums for n in numbers(sent)):
        return True
    ns = norm(sent)
    if any(v in ns for v in dropped_vals):
        return True
    return any(shared_run(sent, t.get("text", "")) for t in texts)


def prune(item: dict, texts: list[dict], allow_numbers: set[float] = frozenset()) -> bool:
    """মেরামত (AI ছাড়া): check_item-এর পরে detail/short/exam_point থেকে সেই বাক্যগুলো ফেলে দেওয়া, যাতে দুই উৎসে না
    মেলা সংখ্যা/নাম বা মূল লেখার হুবহু অংশ আছে। শিরোনামে সমস্যা থাকলে বা বেশি কেটে গেলে False (মেরামত হলো না)।
    ৫-৯ নভেম্বর আটকানোর ৭০-৮০% ছিল এই কারণে: মূল খবর ঠিক, কিন্তু লেখায় এক-আধটা পটভূমির সাল বা ছোট সংখ্যা।"""
    ok_nums = set(allow_numbers) | {n for f in item.get("facts", []) for n in numbers(f.get("value", ""))}
    dropped_vals = [norm(d.split(" = ", 1)[1]) for d in item.get("_dropped", []) if " = " in d]
    dropped_vals = [v for v in dropped_vals if len(v) >= 4 and not numbers(v)]
    if _bad_sentence(item.get("title", ""), [], ok_nums, dropped_vals):
        return False
    keep = [x for x in SENT.split(str(item.get("detail", "")).strip()) if x and not _bad_sentence(x, texts, ok_nums, dropped_vals)]
    if len(keep) < 2:
        return False
    item["detail"] = " ".join(keep)
    short = [x for x in SENT.split(str(item.get("short", "")).strip()) if x and not _bad_sentence(x, texts, ok_nums, dropped_vals)]
    item["short"] = " ".join(short) if short else keep[0]
    ep = [x for x in SENT.split(str(item.get("exam_point", "")).strip()) if x and not _bad_sentence(x, texts, ok_nums, dropped_vals)]
    item["exam_point"] = " ".join(ep)
    return True
