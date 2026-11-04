"""Gemini Flash বনাম Pro: যাচাই-করা ২০০ প্রশ্নে কোন মডেল কতটা ভুল করে (LY Quiz & Sheets, ২০২৬-১১-০৪)।

প্রশ্ন: tools/model-eval/questions.json (সাইটে আগেই পাবলিক, উত্তর আমাদের Opus-যাচাইয়ে নিশ্চিত;
বাছাইয়ের যন্ত্র Lyanna_data-র archive/tools/pick_eval.py)। প্রতিটি প্রশ্ন দুই মডেলকে আলাদা অনুরোধে দেওয়া হয়,
উত্তর-কী মডেলকে দেখানো হয় না। খরচের ছাদ পেরোনোর আগেই থামে; থামলে দুই মডেলই একই প্রশ্ন পর্যন্ত।
লগে শুধু সংখ্যা (প্রশ্নের লেখা নয়)। প্রশ্ন-ধরে ফল (আইডি + অক্ষর) artifact results.json-এ।

    VERTEX_API_KEY=... python3 tools/model-eval/run.py --cap 1.9
"""
import argparse, json, os, sys, threading, time, urllib.error, urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
LET = "ABCD"
# দাম: ডলার প্রতি ১০ লাখ টোকেন (ঢোকানো, বেরোনো+ভাবনা)। বিলে যা লেখে (gross) সেটাই ধরা, যাতে খরচের ছাদ নিরাপদ থাকে।
# 3.6/3.7 Flash-এ ৩১-১২-২০২৬ পর্যন্ত অর্ধেক ফেরত (নিট আলাদা দেখানো হয়)। অচেনা মডেলে উঁচু দাম ধরা।
PRICES = {"gemini-3.7-flash": (1.50, 7.50), "gemini-3.6-flash": (1.50, 7.50), "gemini-3-flash-preview": (0.50, 3.00),
          "gemini-2.5-flash": (0.30, 2.50), "gemini-3.1-pro-preview": (2.00, 12.00), "gemini-3.1-pro": (2.00, 12.00),
          "gemini-3-pro-preview": (2.00, 12.00), "gemini-2.5-pro": (1.25, 10.00)}
NET_HALF = {"gemini-3.7-flash", "gemini-3.6-flash"}
UNKNOWN = (4.00, 18.00)
CANDIDATES = {"flash": ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.5-flash"],
              "pro": ["gemini-3.1-pro-preview", "gemini-3.1-pro", "gemini-3-pro-preview", "gemini-2.5-pro"]}
SUBJ = {"bn": "বাংলা", "eng": "ইংরেজি", "bda": "বাংলাদেশ", "intl": "আন্তর্জাতিক", "math": "গণিত", "sci": "বিজ্ঞান",
        "ict": "কম্পিউটার", "geo": "ভূগোল", "law": "আইন", "econ": "অর্থনীতি", "ethics": "নৈতিকতা",
        "mental": "মানসিক দক্ষতা", "other": "অন্যান্য"}

PROMPT = """You are answering one multiple-choice question from a Bangladeshi competitive recruitment exam
(BCS / government job exam). The question may be in Bengali or English. Choose the single best option,
as the standard answer key for such exams would. Answer with the option letter only.

Question: {q}
A) {o0}
B) {o1}
C) {o2}
D) {o3}"""
SCHEMA = {"type": "OBJECT", "properties": {"answer": {"type": "STRING", "enum": list(LET)}}, "required": ["answer"]}


class Budget:
    def __init__(self, cap):
        self.cap, self.gross, self.net, self.lock = cap, 0.0, 0.0, threading.Lock()
        self.tok = defaultdict(Counter)

    def add(self, model, usage):
        pi, po = PRICES.get(model, UNKNOWN)
        tin = usage.get("promptTokenCount", 0)
        tout = usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0)
        g = (tin * pi + tout * po) / 1e6
        with self.lock:
            self.gross += g
            self.net += g / 2 if model in NET_HALF else g
            t = self.tok[model]
            t["in"] += tin; t["out"] += usage.get("candidatesTokenCount", 0)
            t["think"] += usage.get("thoughtsTokenCount", 0); t["calls"] += 1; t["usd"] += g


def call(key, project, model, body, timeout=180):
    """Vertex-এ এক অনুরোধ। আগে প্রজেক্টের পথ, না হলে express পথ। ফেরত (json, http-কোড)।"""
    paths = ["https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:generateContent"
             % (project, model)] if project else []
    paths.append("https://aiplatform.googleapis.com/v1/publishers/google/models/%s:generateContent" % model)
    data = json.dumps(body).encode("utf-8")
    last = (None, 0)
    for url in paths:
        for attempt in range(4):
            req = urllib.request.Request(url, data=data, method="POST",
                                         headers={"x-goog-api-key": key, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    return json.loads(r.read().decode("utf-8")), 200
            except urllib.error.HTTPError as e:
                last = (None, e.code)
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(2 ** attempt * 3); continue
                break
            except (urllib.error.URLError, TimeoutError, OSError):
                last = (None, -1); time.sleep(2 ** attempt * 3)
        if last[1] not in (403, 404):      # পথ ঠিক, অন্য সমস্যা: দ্বিতীয় পথে গিয়ে লাভ নেই
            break
    return last


def body_for(model, item, thinking):
    gc = {"responseMimeType": "application/json", "responseSchema": SCHEMA, "maxOutputTokens": 8192}
    if model.startswith("gemini-2.5"):
        gc["thinkingConfig"] = {"thinkingBudget": {"low": 512, "high": 4096}.get(thinking, 512)}
    else:
        gc["thinkingConfig"] = {"thinkingLevel": thinking.upper()}
    o = item["o"]
    text = PROMPT.format(q=item["q"], o0=o[0], o1=o[1], o2=o[2], o3=o[3])
    return {"contents": [{"role": "user", "parts": [{"text": text}]}], "generationConfig": gc}


def parse(resp):
    try:
        parts = resp["candidates"][0]["content"]["parts"]
        txt = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        a = json.loads(txt)["answer"].strip().upper()[:1]
        return a if a in LET else None
    except (KeyError, IndexError, ValueError, TypeError, AttributeError):
        return None


def resolve(key, project, tier, forced, item, thinking, budget):
    """কোন মডেল-নাম চালু আছে খুঁজে বের করা (প্রথম প্রশ্ন দিয়েই, তাই বাড়তি খরচ নেই)।"""
    for m in ([forced] if forced else CANDIDATES[tier]):
        resp, code = call(key, project, m, body_for(m, item, thinking))
        print("  %s: মডেল %s → HTTP %s" % (tier, m, code))
        if resp is not None:
            budget.add(m, resp.get("usageMetadata", {}))
            return m, parse(resp)
    return None, None


def pct(a, b):
    return "%.1f%%" % (100.0 * a / b) if b else "—"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", default=os.path.join(HERE, "questions.json"))
    ap.add_argument("--cap", type=float, default=1.9, help="মোট খরচের ছাদ, ডলার (বিলের অঙ্ক)")
    ap.add_argument("--limit", type=int, default=0, help="প্রথম কটা প্রশ্ন (০ = সব)")
    ap.add_argument("--thinking", default="low", choices=["low", "high"])
    ap.add_argument("--flash", default=""); ap.add_argument("--pro", default="")
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--bank", type=int, default=54334, help="পুরো প্রশ্নব্যাংকের প্রশ্নসংখ্যা (খরচের অনুমানে)")
    ap.add_argument("--out", default="results.json"); ap.add_argument("--summary", default="")
    a = ap.parse_args()
    key, project = os.environ.get("VERTEX_API_KEY", "").strip(), os.environ.get("VERTEX_PROJECT", "").strip()
    if not key:
        sys.exit("VERTEX_API_KEY নেই (Secret বসানো হয়নি?)")
    qs = json.load(open(a.questions, encoding="utf-8"))
    if a.limit:
        qs = qs[:a.limit]
    print("প্রশ্ন: %d · খরচের ছাদ: $%.2f · ভাবনা: %s" % (len(qs), a.cap, a.thinking))

    budget = Budget(a.cap)
    ans = {"flash": {}, "pro": {}}
    models = {}
    for tier in ("flash", "pro"):
        m, x = resolve(key, project, tier, getattr(a, tier), qs[0], a.thinking, budget)
        if not m:
            sys.exit("%s: কোনো মডেল সাড়া দেয়নি (চাবি/অনুমতি/মডেল-নাম দেখুন)" % tier)
        models[tier] = m; ans[tier][qs[0]["id"]] = x
    print("মডেল: Flash = %s · Pro = %s" % (models["flash"], models["pro"]))
    per_q = budget.gross * 1.5            # প্রথম প্রশ্নের খরচ থেকে নিরাপত্তা-ব্যবধান
    stop = threading.Event(); lock = threading.Lock()

    def one(item):
        if stop.is_set():
            return
        with lock:                         # ছাদের আগে থামা: চলমান অনুরোধগুলোর খরচও ধরা
            if budget.gross + per_q * (a.jobs + 1) > a.cap:
                stop.set(); return
        got = {}
        for tier in ("flash", "pro"):
            resp, code = call(key, project, models[tier], body_for(models[tier], item, a.thinking))
            if resp is not None:
                budget.add(models[tier], resp.get("usageMetadata", {}))
            got[tier] = parse(resp) if resp is not None else None
        with lock:
            for tier in got:
                ans[tier][item["id"]] = got[tier]

    with ThreadPoolExecutor(a.jobs) as ex:
        for i, _ in enumerate(ex.map(one, qs[1:]), 2):
            if i % 25 == 0 and not stop.is_set():
                print("  %d প্রশ্ন · খরচ এ পর্যন্ত $%.3f" % (len(ans["pro"]), budget.gross))

    done = [x for x in qs if x["id"] in ans["flash"] and x["id"] in ans["pro"]]
    n = len(done)
    key_of = {x["id"]: LET[x["a"]] for x in done}
    res = []
    for x in done:
        f, p = ans["flash"][x["id"]], ans["pro"][x["id"]]
        res.append({"id": x["id"], "s": x["s"], "key": key_of[x["id"]], "flash": f, "pro": p})
    json.dump({"models": models, "thinking": a.thinking, "rows": res}, open(a.out, "w"), ensure_ascii=False, indent=0)

    L = []
    w = lambda s="": L.append(s)
    fw = [r for r in res if r["flash"] != r["key"]]
    pw = [r for r in res if r["pro"] != r["key"]]
    w("## Gemini Flash বনাম Pro · যাচাই-করা %d প্রশ্ন" % n)
    w(); w("মডেল: Flash = `%s`, Pro = `%s`, ভাবনা: %s%s" % (models["flash"], models["pro"], a.thinking,
                                                       "" if n == len(qs) else " · খরচের ছাদে থেমেছে (%d/%d)" % (n, len(qs))))
    w(); w("| | ভুল | হার | উত্তর আসেনি |"); w("|---|---|---|---|")
    for t, wr in (("Flash", fw), ("Pro", pw)):
        w("| %s | %d | %s | %d |" % (t, len(wr), pct(len(wr), n), sum(1 for r in wr if r[t.lower()] is None)))
    agree = [r for r in res if r["flash"] is not None and r["flash"] == r["pro"]]
    agree_wrong = [r for r in agree if r["flash"] != r["key"]]
    either = [r for r in res if r["flash"] != r["key"] or r["pro"] != r["key"]]
    w(); w("### দুই মডেল একসঙ্গে")
    w("- দুই মডেল একই উত্তর দিয়েছে: %d (%s)" % (len(agree), pct(len(agree), n)))
    w("- মিলে যাওয়া উত্তরেও ভুল: %d (মিললে ভুলের হার %s; একা Flash %s, একা Pro %s)"
      % (len(agree_wrong), pct(len(agree_wrong), len(agree)), pct(len(fw), n), pct(len(pw), n)))
    w("- যাচাইয়ে ব্যবহার করলে, উত্তর-কী ঠিক থাকা সত্ত্বেও মিথ্যে সন্দেহ:")
    w("  - যেকোনো এক মডেল কী-র সঙ্গে না মিললে সন্দেহ: %d (%s)" % (len(either), pct(len(either), n)))
    w("  - দুই মডেলই একই ভিন্ন উত্তর দিলে তবেই সন্দেহ: %d (%s)" % (len(agree_wrong), pct(len(agree_wrong), n)))
    w("  - শুধু Flash: %d (%s) · শুধু Pro: %d (%s)" % (len(fw), pct(len(fw), n), len(pw), pct(len(pw), n)))
    w(); w("### বিষয় ধরে ভুল"); w("| বিষয় | প্রশ্ন | Flash ভুল | Pro ভুল | দুটোই একই ভুল |"); w("|---|---|---|---|---|")
    by = defaultdict(list)
    for r in res:
        by[r["s"]].append(r)
    for s in sorted(by, key=lambda s: -sum(r["flash"] != r["key"] or r["pro"] != r["key"] for r in by[s])):
        rs = by[s]
        w("| %s | %d | %d | %d | %d |" % (SUBJ.get(s, s), len(rs), sum(r["flash"] != r["key"] for r in rs),
                                         sum(r["pro"] != r["key"] for r in rs),
                                         sum(r["flash"] == r["pro"] != r["key"] for r in rs)))
    w(); w("### খরচ (বিলের অঙ্ক, ডলার)"); w("| মডেল | অনুরোধ | ঢোকানো টোকেন | উত্তর টোকেন | ভাবনা টোকেন | খরচ | প্রতি প্রশ্নে |")
    w("|---|---|---|---|---|---|---|")
    for t in ("flash", "pro"):
        k = budget.tok[models[t]]
        w("| %s | %d | %d | %d | %d | $%.3f | $%.5f |" % (models[t], k["calls"], k["in"], k["out"], k["think"], k["usd"],
                                                        k["usd"] / max(k["calls"], 1)))
    both = sum(budget.tok[models[t]]["usd"] / max(budget.tok[models[t]]["calls"], 1) for t in ("flash", "pro"))
    w(); w("- মোট: $%.3f (নিট, ফেরতের পরে: $%.3f) · ছাদ $%.2f" % (budget.gross, budget.net, a.cap))
    w("- পুরো ব্যাংক (%d প্রশ্ন) একই ধাঁচে: দুই মডেল ≈ $%.0f · শুধু Flash ≈ $%.0f · শুধু Pro ≈ $%.0f" % (
        a.bank, both * a.bank,
        a.bank * budget.tok[models["flash"]]["usd"] / max(budget.tok[models["flash"]]["calls"], 1),
        a.bank * budget.tok[models["pro"]]["usd"] / max(budget.tok[models["pro"]]["calls"], 1)))
    out = "\n".join(L)
    print(out)
    if a.summary:
        open(a.summary, "a", encoding="utf-8").write(out + "\n")


if __name__ == "__main__":
    main()
