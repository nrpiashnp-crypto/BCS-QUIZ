"""ধাপ ২-৩: Gemini দিয়ে বাছাই আর সারাংশ, তারপর স্ক্রিপ্টে যাচাই।

ক) সব শিরোনাম একসঙ্গে → Gemini (সস্তা মডেল): একই ঘটনার শিরোনাম জোড়া, ছাঁকনি, চমক-মান।
খ) ভালো ঘটনাগুলোর মূল পাতা খুলে লেখা আনা (একই প্রতিষ্ঠানের দুটো নয়)।
গ) প্রতিটা ঘটনা → Gemini: নিজের ভাষায় শিরোনাম, ১-২ লাইন, ৪-৬ লাইন, "পরীক্ষার জন্য গুরুত্বপূর্ণ"
   (ঠিক যে তথ্য প্রশ্ন হয়: নাম, পদ, সংখ্যা, তারিখ, স্থান), "যা পরীক্ষায় লাগে" ছক (৩-৬ সারি) + উদ্ধৃতি।
ঘ) verify.py: দুই-উৎস আর হুবহু-না পরীক্ষা; quality.py: নিষিদ্ধ কথা, ছক, বানান, বাদের বিষয়।
ঙ) না মিললে একবার আবার লেখানো (rewrite_batch) — শুধু যাচাই-হওয়া তথ্য দিয়ে; তবুও না মিললে অ্যাডমিনের তালিকায়।
চ) proofread(): বানানের আলাদা ধাপ (Gemma, দিনে ১৪,৪০০) — শুধু বানান, তথ্য নয়।
"""
from __future__ import annotations

import json
import os

from common import CATEGORIES, SECTIONS, domain, gemini_json, log, page_text
from quality import trusted

# বাছাই: অনেক শিরোনাম, সহজ কাজ → ৫০০/দিনের মডেল আগে, তারপর Gemma (১৪,৪০০/দিন)।
PICK_MODELS = [m for m in [os.environ.get("NEWS_PICK_MODEL"), "gemini-3.1-flash-lite", "gemma-4-31b*", "gemma-4-26b*",
                           "gemini-2.5-flash-lite"] if m]
# লেখা: বাংলা ভাষার মান দরকার → ফ্ল্যাশ আগে (দিনে ২০টা করে), না পেলে 3.1-flash-lite, শেষে Gemma।
WRITE_MODELS = [m for m in [os.environ.get("NEWS_WRITE_MODEL"), "gemini-3.6-flash", "gemini-3.8-flash",
                            "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemma-4-31b*", "gemma-4-26b*"] if m]
# বানান-ধাপ: বড় আর বিনা খরচে বেশি অনুরোধের মডেল আগে
PROOF_MODELS = [m for m in [os.environ.get("NEWS_PROOF_MODEL"), "gemma-4-31b*", "gemma-4-26b*", "gemini-3.1-flash-lite"] if m]
# ৫-৯ নভেম্বর দিনে ১-২টা আসত: ১৬টা দলের ৭০-৮০% আটকাত সারাংশের বাড়তি সংখ্যায়। এখন বেশি দল + মেরামত (run_daily.py)।
MAX_WRITE = int(os.environ.get("NEWS_MAX_WRITE", "28"))     # দিনে সর্বোচ্চ কতটা ঘটনা লেখানো হবে
BATCH = int(os.environ.get("NEWS_BATCH", "4"))              # এক অনুরোধে কতটা ঘটনা (দিনে ২০টা অনুরোধের সীমা)

CAT_LIST = ", ".join(f"{k} ({v})" for k, v in CATEGORIES.items())

PICK_PROMPT = """তুমি বাংলাদেশের বিসিএস ও সরকারি চাকরির পরীক্ষার "সাম্প্রতিক বিষয়" সম্পাদক।
নিচে আজকের খবরের শিরোনাম (JSON তালিকা; i = ক্রমিক, s = উৎস)।

কাজ:
1. একই ঘটনার শিরোনামগুলো এক দলে জোড়ো (ভিন্ন ভাষা/উৎস হলেও)। "একই ঘটনা" মানে একই দেশ/সংস্থা, একই কাজ বা
   সিদ্ধান্ত, একই দিন — শুধু একই বিষয়-এলাকা (যেমন "রাজনীতি", "মহাকাশ", "অর্থনীতি") হলে নয়। দুটো আলাদা দেশের বা
   আলাদা ঘটনার খবর কখনো এক দলে নয়; সন্দেহ হলে আলাদা দল।
2. শুধু রাখো যা থেকে পরীক্ষায় তথ্যভিত্তিক প্রশ্ন হয় — বিভাগ: {cats}।
   বিশেষ করে খোঁজো (এগুলো সবচেয়ে আগে): পরিসংখ্যান ও জরিপের ফল (বিবিএস, বাংলাদেশ ব্যাংক, জনশুমারি, দারিদ্র্য,
   মূল্যস্ফীতি, প্রবৃদ্ধি, শিক্ষা-স্বাস্থ্যের হার), বাংলাদেশের উন্নয়ন — বড় প্রকল্প, সেতু-রেল-বিদ্যুৎ, উন্নয়ন সংস্থা
   ও সহযোগী (বিশ্বব্যাংক, এডিবি, জাইকা, ইউএনডিপি, ব্র্যাক ইত্যাদি) আর তাদের ঋণ-অনুদান-প্রতিবেদন; সংবিধান ও
   সংস্কার (সংশোধনী, সংস্কার কমিশনের সুপারিশ, গণভোট, নির্বাচন কমিশনের নিয়ম, আদালতের সাংবিধানিক রায়, এসব নিয়ে
   সরকার বা কমিশনের আনুষ্ঠানিক মতামত); চুক্তি ও সমঝোতা, নিয়োগ ও নির্বাচনের ফল (কে কোন পদে), পুরস্কার, সূচক ও
   র‍্যাংকিং, নতুন আইন-নীতি-রায়, সম্মেলন ও আন্তর্জাতিক সংস্থা, বিজ্ঞান-মহাকাশ-আবিষ্কার, অর্থনীতির বড় সংখ্যা (রপ্তানি,
   রেমিট্যান্স, রিজার্ভ, বাজেট), বড় খেলার ফল ও রেকর্ড, দিবস ও প্রতিপাদ্য।
   রাজনীতি কম: দলের কর্মসূচি, সমাবেশ, নেতার বক্তৃতা-পাল্টা বক্তৃতা, অভিযোগ-পাল্টা অভিযোগ, জোট-ভাঙা-গড়ার জল্পনা,
   ভোটের আগের প্রচার — বাদ। রাজনীতির খবর রাখো শুধু যখন তাতে পরীক্ষার মতো স্থায়ী তথ্য আছে (নতুন আইন বা সংশোধনী,
   নির্বাচনের ফল বা তারিখ, কে কোন পদে, সংবিধান-সংস্কারের আনুষ্ঠানিক প্রস্তাব)।
   বাদ (কড়াভাবে): অপরাধ, তদন্ত, গ্রেপ্তার, মামলা-অভিযোগ (কোনো ব্যক্তি বা কোম্পানির বিরুদ্ধে), দুর্ঘটনা, গুজব,
   তারকা-বিনোদন, কারও ব্যক্তিগত জীবন বা সম্পর্ক, কেলেঙ্কারি, ফাঁস হওয়া অডিও-ভিডিও, চাঞ্চল্য বা সমালোচনা জাগানো খবর,
   ব্যক্তির মতামত-কলাম ও সাক্ষাৎকার, চলমান ম্যাচের স্কোর, আবহাওয়ার রোজকার খবর। কোম্পানির প্রধানকে নিয়ে তদন্ত বা
   কেলেঙ্কারিও বাদ।
   তবে আদালতের যে রায় বা আদেশ কোনো আইন বা নিয়ম বদলায় (কোন আদালতে কোন মামলা, নতুন সীমা), সেটা রাখো।
3. প্রতি দলে "চমক-মান" (score) ১-১০: পরীক্ষায় প্রশ্ন হওয়ার সম্ভাবনা আর গুরুত্ব। নতুন রেকর্ড, প্রথমবার,
   বড় চুক্তি, সংস্থার প্রধান নিয়োগ, সূচকে বাংলাদেশের অবস্থান, সরকারি পরিসংখ্যান, বড় উন্নয়ন প্রকল্প,
   বাজেট/রপ্তানি/রেমিট্যান্সের বড় সংখ্যা = বেশি। দলীয় রাজনীতির খবর = কম (৫-এর নিচে)।
4. topic = ঘটনার ছোট বাংলা নাম (১০ শব্দের মধ্যে)।
5. section: bd = বাংলাদেশের ঘটনা; intl = অন্য দেশ বা আন্তর্জাতিক রাজনীতি-কূটনীতি-সংস্থা;
   gk = সাধারণ জ্ঞানের তথ্য, দেশ যা-ই হোক — নতুন রেকর্ড, প্রথমবার, সূচক-র‍্যাংকিং, পুরস্কার, আবিষ্কার,
   মহাকাশ-বিজ্ঞান, দিবস ও প্রতিপাদ্য, বড় খেলার ফল।

শুধু JSON: {{"groups":[{{"items":[i,...],"topic":"...","category":"<id>","score":n,"section":"bd|intl|gk"}}]}}
যে দলে মাত্র একটা শিরোনাম, সেটাও দাও (পরে যাচাই হবে; প্রথম আলো, ইত্তেফাক, ডেইলি স্টারের একার খবরও চলে)। পরীক্ষা-উপযোগী সব দল দাও — দিনে অন্তত ৭টা প্রকাশের লক্ষ্য,
তাই একই ঘটনার বিভিন্ন উৎসের শিরোনাম (বাংলা-ইংরেজি মিলিয়ে) যত্ন করে এক দলে জোড়ো।

শিরোনাম:
{items}
"""

WRITE_PROMPT = """তুমি বাংলাদেশের বিসিএস ও সরকারি চাকরিপ্রার্থীদের জন্য "আজকের গুরুত্বপূর্ণ সংবাদ" লিখছ।
নিচে কয়েকটা ঘটনা ([ঘটনা k]); প্রতিটার নিচে সেই ঘটনার কয়েকটা মূল খবরের লেখা (src = ঘটনার ভেতরের ক্রমিক)।
প্রতিটা ঘটনা আলাদা করে লেখো; এক ঘটনার তথ্য অন্য ঘটনায় নয়, আর src শুধু সেই ঘটনার ভেতরের।

নিয়ম (খুব জরুরি):
- শুধু এই লেখাগুলোতে যা আছে, তা-ই। নিজের জানা কোনো তথ্য, সংখ্যা বা নাম যোগ করবে না।
- লেখায় শুধু সেই নাম, সংখ্যা, তারিখ রাখো যা অন্তত দুটো আলাদা src-এ আছে, অথবা "(বিশ্বস্ত)" চিহ্নের কোনো
  src-এ আছে (প্রথম আলো, ইত্তেফাক, ডেইলি স্টার — এদের একটাই যথেষ্ট)। বাকি এক src-এ থাকা তথ্য লেখায় নয়।
- একটা ঘটনার src-গুলোতে আলাদা আলাদা খবর থাকলে শুধু সেই খবরটা লেখো যা অন্তত দুটো src-এ (বা একটা বিশ্বস্ত src-এ)
  আছে; না থাকলে skip।
- সম্পূর্ণ নিজের ভাষায়, সহজ প্রমিত বাংলায়। মূল লেখার কোনো বাক্য বা টানা ৬ শব্দ হুবহু নয়।
- ফাঁপানো শব্দ নয় ("ঐতিহাসিক", "উল্লেখযোগ্য যে", "বহুল আলোচিত")। মতামত নয়, পক্ষ নেওয়া নয়।
- সংখ্যা বাংলা অঙ্কে। পদবিসহ নাম।
- title: ১২ শব্দের মধ্যে। short: ১-২ বাক্য (হোম পাতা)। detail: ৪-৬ বাক্য।
- exam_point ("পরীক্ষার জন্য গুরুত্বপূর্ণ"): ১-২ বাক্যে ঠিক সেই তথ্য, যা পরীক্ষায় প্রশ্ন হয়ে আসে — নাম, পদ, সংখ্যা,
  তারিখ, স্থান, আইন বা সংস্থার নাম। খবরটা কেন দরকারি, সে কথা একদম নয়। "আসতে পারে", "সুযোগ রয়েছে", "প্রশ্ন হতে পারে",
  "গুরুত্বপূর্ণ", "জেনে রাখা", "পরীক্ষায়" — এসব শব্দ নিষেধ।
  ভালো উদাহরণ: "৫ লাখ টাকা পর্যন্ত চেক ডিজঅনারের মামলা ম্যাজিস্ট্রেট আদালতে, তার বেশি হলে যুগ্ম জেলা জজ আদালতে।
  আইন: নেগোশিয়েবল ইনস্ট্রুমেন্টস অ্যাক্ট।"
  খারাপ উদাহরণ: "আইন ও বিচার ব্যবস্থা বিষয়ক প্রশ্নে আসার সুযোগ রয়েছে।"
- facts ("যা পরীক্ষায় লাগে" ছক): ঠিক ৩ থেকে ৬ সারি — কে, কী, কোথায়, কত, কবে। label ছোট (২-৪ শব্দ, যেমন "নতুন সীমা",
  "স্থান", "সভাপতি"), value বাংলায় ছোট করে। evidence = যে যে src-এ তথ্যটা আছে, সেখান থেকে হুবহু ছোট উদ্ধৃতি
  (৩-১৫ শব্দ, মূল ভাষায়, এক অক্ষরও না বদলে)। সংখ্যা থাকলে উদ্ধৃতিতে সেই সংখ্যাটা থাকতে হবে। প্রতিটা সারিতে অন্তত
  দুটো আলাদা src থেকে উদ্ধৃতি দাও, অথবা একটা "(বিশ্বস্ত)" src থেকে; না পেলে সেই সারি দিও না।
- title/short/detail/exam_point-এ যে সংখ্যা বা নাম লিখবে, তা অবশ্যই কোনো fact-এর value-তে থাকবে। পটভূমির সাল,
  পুরোনো রেকর্ড বা ছোট খুঁটিনাটি সংখ্যা লেখায় দিও না — শুধু মূল তথ্যের সংখ্যা।
- বানান বাংলা একাডেমির প্রমিত রীতিতে (যেমন অভ্যন্তরীণ, সরকারি, শ্রেণি, পুরস্কার, কর্মসূচি, ঋণ)।
- বিদেশি নাম: প্রথমবার বাংলায় লিখে বন্ধনীতে ইংরেজি, যেমন "জেনসেন হুয়াং (Jensen Huang)"; পরে শুধু বাংলায়।
- অপরাধ, তদন্ত, গ্রেপ্তার, গুজব, তারকার খবর, কারও ব্যক্তিগত জীবন বা কেলেঙ্কারি হলে: skip। দলীয় বক্তৃতা বা
  রাজনৈতিক টানাপোড়েন হলেও skip; রাজনীতির খবর লিখলে শুধু স্থায়ী তথ্য (আইন, ফল, পদ, তারিখ), কোনো দলের পক্ষ-বিপক্ষ নয়।
- category: {cats} থেকে একটা id। score: ১-১০।
- section: bd (বাংলাদেশ) | intl (আন্তর্জাতিক) | gk (সাধারণ জ্ঞান: রেকর্ড, প্রথমবার, সূচক, পুরস্কার, আবিষ্কার, মহাকাশ-বিজ্ঞান, দিবস, বড় খেলার ফল)।
- কোনো ঘটনার লেখাগুলো আসলে একই ঘটনা না হলে, বা পরীক্ষার কাজের না হলে: {{"event":k,"skip":true}}।

শুধু JSON: {{"items":[{{"event":1,"title":"","short":"","detail":"","exam_point":"","category":"","score":0,
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
        srcs = "\n\n".join(f"[src {n}] {t['name']}{' (বিশ্বস্ত)' if trusted(t.get('domain', '')) else ''} — {t['title']}\n{t['text'][:3500]}" for n, t in enumerate(texts))
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


REWRITE_PROMPT = """তুমি বাংলাদেশের বিসিএস ও সরকারি চাকরিপ্রার্থীদের জন্য "আজকের গুরুত্বপূর্ণ সংবাদ" লিখছ।
নিচের প্রতিটা সংবাদের আগের লেখা যাচাইয়ে আটকেছে; কারণ দেওয়া আছে। আবার লেখো, শুধু "যাচাই-হওয়া তথ্য" দিয়ে।

নিয়ম:
- নাম, সংখ্যা, তারিখ শুধু যাচাই-হওয়া তথ্যের তালিকা থেকে; তালিকার বাইরের কোনো সংখ্যা বা নাম লেখায় নয়।
- সম্পূর্ণ নিজের ভাষায়, সহজ প্রমিত বাংলায় (বাংলা একাডেমির বানান)। সংখ্যা বাংলা অঙ্কে।
- title ১২ শব্দের মধ্যে; short ১-২ বাক্য; detail ৩-৫ বাক্য।
- exam_point: ১-২ বাক্যে ঠিক সেই তথ্য যা প্রশ্ন হয় (নাম, পদ, সংখ্যা, তারিখ, স্থান, আইন/সংস্থার নাম)।
  "আসতে পারে", "সুযোগ রয়েছে", "প্রশ্ন", "গুরুত্বপূর্ণ", "পরীক্ষায়" — নিষেধ।
- যাচাই-হওয়া তথ্য দিয়ে ঠিকমতো লেখা না গেলে: {{"event":k,"skip":true}}।

শুধু JSON: {{"items":[{{"event":1,"title":"","short":"","detail":"","exam_point":""}}]}}

সংবাদগুলো:
{blocks}
"""


def rewrite_batch(jobs: list[tuple[dict, list[str]]]) -> list[dict | None]:
    """আটকে যাওয়া লেখা আবার লেখানো। jobs: [(আগের লেখা — facts যাচাই-হওয়া, কারণের তালিকা)]।
    ফেরত: নতুন title/short/detail/exam_point বসানো কপি (বা None)। তথ্য-ছক আর সূত্র বদলায় না।"""
    blocks = []
    for k, (it, why) in enumerate(jobs, 1):
        facts = "\n".join(f"  - {f['label']}: {f['value']}" for f in it.get("facts", []))
        blocks.append(f"===== [সংবাদ {k}] =====\nআগের শিরোনাম: {it.get('title', '')}\nআগের লেখা: {it.get('detail', '')}\n"
                      f"আটকানোর কারণ: {'; '.join(why[:4])}\nযাচাই-হওয়া তথ্য:\n{facts}")
    res = gemini_json(REWRITE_PROMPT.format(blocks="\n\n".join(blocks)), WRITE_MODELS)
    out: list[dict | None] = [None] * len(jobs)
    for r in (res.get("items") if isinstance(res, dict) else None) or []:
        try:
            k = int(r.get("event")) - 1
        except (TypeError, ValueError):
            continue
        if 0 <= k < len(jobs) and not r.get("skip") and r.get("title"):
            new = dict(jobs[k][0])
            for f in ("title", "short", "detail", "exam_point"):
                new[f] = str(r.get(f) or "").strip()
            out[k] = new
    return out


PROOF_PROMPT = """তুমি বাংলা একাডেমির প্রমিত বানানের প্রুফ-রিডার। নিচের লেখাগুলোতে শুধু ভুল বানানের শব্দ খোঁজো
(ণ/ন, ী/ি, ূ/ু, শ/ষ/স, য/জ, ঞ্জ/ঙ্গ, যুক্তাক্ষর, হাইফেন)। তথ্য, নাম, সংখ্যা, বাক্য বা শব্দ-বাছাই বদলাবে না;
নামের বানানে (মানুষ, প্রতিষ্ঠান, স্থান) হাত দেবে না। নিশ্চিত না হলে বাদ দাও।

শুধু JSON: {{"fixes":[{{"wrong":"ভুল শব্দ হুবহু","right":"ঠিক শব্দ"}}]}}  (ভুল না থাকলে ফাঁকা তালিকা)

লেখা:
{text}
"""


def _lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def proofread(items: list[dict]) -> tuple[bool, list[str]]:
    """বানানের আলাদা ধাপ: সব লেখা একসঙ্গে Gemma-কে; শুধু ছোট বানান-বদল মানা হয় (এক শব্দ, ১-২ অক্ষর, অঙ্ক নয়,
    ছকের নাম নয়)। ফেরত: (ধাপটা চলল কি না, কী কী বদলাল)।"""
    import re
    fields = ("title", "short", "detail", "exam_point")
    text = "\n".join(str(it.get(f, "")) for it in items for f in fields)
    text += "\n" + "\n".join(f"{x.get('label', '')}: {x.get('value', '')}" for it in items for x in it.get("facts", []))
    try:
        res = gemini_json(PROOF_PROMPT.format(text=text[:12000]), PROOF_MODELS, temperature=0)
    except RuntimeError as e:
        log(f"  বানান-ধাপ (AI) চলল না: {e}")
        return False, []
    names = {str(x.get("value", "")) for it in items for x in it.get("facts", [])}
    done = []
    for fx in (res.get("fixes") if isinstance(res, dict) else None) or []:
        w, r = str(fx.get("wrong", "")).strip(), str(fx.get("right", "")).strip()
        if not w or not r or w == r or " " in w or " " in r or re.search(r"[0-9০-৯A-Za-z]", w + r):
            continue
        if _lev(w, r) > 2 or any(w in n for n in names) or w not in text:
            continue
        pat = re.compile(r"(?<![\wঀ-৿])" + re.escape(w) + r"(?![\wঀ-৿])")
        for it in items:
            for f in fields:
                if f in it:
                    it[f] = pat.sub(r, it[f])
        done.append(f"{w}→{r}")
    return True, done
