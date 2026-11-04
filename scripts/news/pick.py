"""ধাপ ২-৩: Gemini দিয়ে বাছাই আর সারাংশ, তারপর স্ক্রিপ্টে যাচাই।

ক) সব শিরোনাম একসঙ্গে → Gemini (সস্তা মডেল): একই ঘটনার শিরোনাম জোড়া, ছাঁকনি, চমক-মান।
খ) ভালো ঘটনাগুলোর মূল পাতা খুলে লেখা আনা (একই প্রতিষ্ঠানের দুটো নয়)।
গ) প্রতিটা ঘটনা → Gemini: নিজের ভাষায় শিরোনাম, ১-২ লাইন, ৪-৬ লাইন, পরীক্ষায় কেন, তথ্য + উদ্ধৃতি।
ঘ) verify.py: দুই-উৎস আর হুবহু-না পরীক্ষা। না মিললে অ্যাডমিনের তালিকায়।
"""
from __future__ import annotations

import json
import os

from common import CATEGORIES, SECTIONS, domain, gemini_json, log, page_text

PICK_MODELS = [m for m in [os.environ.get("NEWS_PICK_MODEL"), "gemini-3.1-flash-lite", "gemini-flash-lite-latest",
                           "gemini-2.5-flash-lite", "gemini-2.5-flash"] if m]
WRITE_MODELS = [m for m in [os.environ.get("NEWS_WRITE_MODEL"), "gemini-3.6-flash", "gemini-flash-latest",
                            "gemini-2.5-flash", "gemini-2.5-flash-lite"] if m]
MAX_WRITE = int(os.environ.get("NEWS_MAX_WRITE", "16"))     # দিনে সর্বোচ্চ কতটা ঘটনা লেখানো হবে
BATCH = int(os.environ.get("NEWS_BATCH", "4"))              # এক অনুরোধে কতটা ঘটনা (দিনে ২০টা অনুরোধের সীমা)

CAT_LIST = ", ".join(f"{k} ({v})" for k, v in CATEGORIES.items())

PICK_PROMPT = """তুমি বাংলাদেশের বিসিএস ও সরকারি চাকরির পরীক্ষার "সাম্প্রতিক বিষয়" সম্পাদক।
নিচে আজকের খবরের শিরোনাম (JSON তালিকা; i = ক্রমিক, s = উৎস)।

কাজ:
1. একই ঘটনার শিরোনামগুলো এক দলে জোড়ো (ভিন্ন ভাষা/উৎস হলেও)।
2. শুধু রাখো যা পরীক্ষায় আসতে পারে — বিভাগ: {cats}।
   বাদ: অপরাধ, দুর্ঘটনা, গুজব, তারকা/বিনোদন, দলীয় বক্তৃতা-পাল্টা বক্তৃতা, মতামত-কলাম, আবহাওয়ার রোজকার খবর।
3. প্রতি দলে "চমক-মান" (score) ১-১০: পরীক্ষায় প্রশ্ন হওয়ার সম্ভাবনা আর গুরুত্ব। নতুন রেকর্ড, প্রথমবার,
   বড় চুক্তি, সংস্থার প্রধান নিয়োগ, সূচকে বাংলাদেশের অবস্থান, বাজেট/রপ্তানি/রেমিট্যান্সের বড় সংখ্যা = বেশি।
4. topic = ঘটনার ছোট বাংলা নাম (১০ শব্দের মধ্যে)।
5. section: bd = বাংলাদেশের ঘটনা; intl = অন্য দেশ বা আন্তর্জাতিক রাজনীতি-কূটনীতি-সংস্থা;
   gk = সাধারণ জ্ঞানের তথ্য, দেশ যা-ই হোক — নতুন রেকর্ড, প্রথমবার, সূচক-র‍্যাংকিং, পুরস্কার, আবিষ্কার,
   মহাকাশ-বিজ্ঞান, দিবস ও প্রতিপাদ্য, বড় খেলার ফল।

শুধু JSON: {{"groups":[{{"items":[i,...],"topic":"...","category":"<id>","score":n,"section":"bd|intl|gk"}}]}}
যে দলে মাত্র একটা শিরোনাম, সেটাও দাও (পরে যাচাই হবে)।

শিরোনাম:
{items}
"""

WRITE_PROMPT = """তুমি বাংলাদেশের বিসিএস ও সরকারি চাকরিপ্রার্থীদের জন্য "আজকের ঘটনা" লিখছ।
নিচে কয়েকটা ঘটনা ([ঘটনা k]); প্রতিটার নিচে সেই ঘটনার কয়েকটা মূল খবরের লেখা (src = ঘটনার ভেতরের ক্রমিক)।
প্রতিটা ঘটনা আলাদা করে লেখো; এক ঘটনার তথ্য অন্য ঘটনায় নয়, আর src শুধু সেই ঘটনার ভেতরের।

নিয়ম (খুব জরুরি):
- শুধু এই লেখাগুলোতে যা আছে, তা-ই। নিজের জানা কোনো তথ্য, সংখ্যা বা নাম যোগ করবে না।
- সম্পূর্ণ নিজের ভাষায়, সহজ প্রমিত বাংলায়। মূল লেখার কোনো বাক্য বা টানা ৬ শব্দ হুবহু নয়।
- ফাঁপানো শব্দ নয় ("ঐতিহাসিক", "উল্লেখযোগ্য যে", "বহুল আলোচিত")। মতামত নয়, পক্ষ নেওয়া নয়।
- সংখ্যা বাংলা অঙ্কে। পদবিসহ নাম। বিদেশি নাম বাংলায়, প্রথমবার বন্ধনীতে ইংরেজি।
- title: ১২ শব্দের মধ্যে। short: ১-২ বাক্য (হোম পাতা)। detail: ৪-৬ বাক্য। why_exam: ১ বাক্য — পরীক্ষায় কোন ধাঁচে আসতে পারে।
- facts: পরীক্ষার কাজের প্রতিটা নাম, সংখ্যা, তারিখ, স্থান আলাদা সারিতে: label (কী), value (বাংলায় ছোট করে),
  evidence = যে যে src-এ তথ্যটা আছে, সেখান থেকে হুবহু ছোট উদ্ধৃতি (৩-১৫ শব্দ, মূল ভাষায়, এক অক্ষরও না বদলে)।
  সংখ্যা থাকলে উদ্ধৃতিতে সেই সংখ্যাটা থাকতে হবে। অন্তত দুটো আলাদা src থেকে উদ্ধৃতি দেওয়ার চেষ্টা করো।
- title/short/detail/why_exam-এ যে সংখ্যা লিখবে, তা অবশ্যই কোনো fact-এর value-তে থাকবে।
- category: {cats} থেকে একটা id। score: ১-১০।
- section: bd (বাংলাদেশ) | intl (আন্তর্জাতিক) | gk (সাধারণ জ্ঞান: রেকর্ড, প্রথমবার, সূচক, পুরস্কার, আবিষ্কার, মহাকাশ-বিজ্ঞান, দিবস, বড় খেলার ফল)।
- কোনো ঘটনার লেখাগুলো আসলে একই ঘটনা না হলে, বা পরীক্ষার কাজের না হলে: {{"event":k,"skip":true}}।

শুধু JSON: {{"items":[{{"event":1,"title":"","short":"","detail":"","why_exam":"","category":"","score":0,
 "section":"bd|intl|gk","facts":[{{"label":"","value":"","evidence":[{{"src":0,"quote":""}}]}}]}}]}}

ঘটনাগুলো:
{texts}
"""


def group(items: list[dict]) -> list[dict]:
    rows = [{"i": n, "s": it["src"], "t": it["title"], "d": it["desc"][:160]} for n, it in enumerate(items)]
    res = gemini_json(PICK_PROMPT.format(cats=CAT_LIST, items=json.dumps(rows, ensure_ascii=False)), PICK_MODELS)
    groups = []
    for g in res.get("groups", []):
        idx = [i for i in g.get("items", []) if isinstance(i, int) and 0 <= i < len(items)]
        if not idx or g.get("category") not in CATEGORIES:
            continue
        groups.append({"members": [items[i] for i in idx], "topic": g.get("topic", ""),
                       "category": g["category"], "score": int(g.get("score") or 0),
                       "section": g.get("section") if g.get("section") in SECTIONS else "intl"})
    groups.sort(key=lambda g: (-g["score"], -len({domain(m["url"]) for m in g["members"]})))
    return groups


def gather_texts(members: list[dict], max_src: int = 4) -> list[dict]:
    """প্রতিটা প্রতিষ্ঠানের একটা করে পাতা; পাতা না খুললে RSS-এর বিবরণ।"""
    out, used = [], set()
    for m in members:
        d = domain(m["url"])
        if d in used:
            continue
        body = page_text(m["url"]) or ""
        text = (m["title"] + "\n" + (m["desc"] or "") + "\n" + body).strip()
        if len(text) < 60:
            continue
        used.add(d)
        out.append({"domain": d, "name": m["src"], "url": m["url"], "title": m["title"], "text": text})
        if len(out) >= max_src:
            break
    return out


def _fix(res: dict, group_: dict) -> dict:
    if res.get("category") not in CATEGORIES:
        res["category"] = group_["category"]
    try:
        res["score"] = max(1, min(10, int(res.get("score") or group_["score"])))
    except (TypeError, ValueError):
        res["score"] = group_["score"]
    if res.get("section") not in SECTIONS:
        res["section"] = group_.get("section", "intl")
    return res


def write_batch(jobs: list[tuple[dict, list[dict]]]) -> list[dict | None]:
    """কয়েকটা ঘটনা এক অনুরোধে। ফেরত: jobs-এর ক্রমে লেখা (বা None = বাদ/পাওয়া যায়নি)।"""
    blocks = []
    for k, (g, texts) in enumerate(jobs, 1):
        srcs = "\n\n".join(f"[src {n}] {t['name']} — {t['title']}\n{t['text'][:3500]}" for n, t in enumerate(texts))
        blocks.append(f"===== [ঘটনা {k}] {g['topic']} =====\n{srcs}")
    res = gemini_json(WRITE_PROMPT.format(cats=CAT_LIST, texts="\n\n".join(blocks)), WRITE_MODELS)
    out: list[dict | None] = [None] * len(jobs)
    for r in (res.get("items") if isinstance(res, dict) else None) or []:
        try:
            k = int(r.get("event")) - 1
        except (TypeError, ValueError):
            continue
        if 0 <= k < len(jobs) and not r.get("skip") and r.get("title"):
            out[k] = _fix(r, jobs[k][0])
    return out


def write(group_: dict, texts: list[dict]) -> dict | None:
    return write_batch([(group_, texts)])[0]
