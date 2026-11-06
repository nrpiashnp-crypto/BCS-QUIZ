"""LY News-এর সাধারণ যন্ত্র: সময়, ইন্টারনেট থেকে আনা, Gemini ডাকা, লেখা থেকে লেখা বের করা।

শুধু Python-এর নিজস্ব লাইব্রেরি; GitHub Actions-এ কিছু install লাগে না।
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # BCS-QUIZ রিপোর মূল
NEWS_DIR = ROOT / "news"
DHAKA = dt.timezone(dt.timedelta(hours=6))
UA = "LyannaNewsBot/1.0 (+https://lyannabooks.com)"

# Mac-এর কিছু Python-এ সনদের তালিকা থাকে না; certifi থাকলে সেটা দিয়ে HTTPS যাচাই।
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    SSL_CTX = ssl.create_default_context()

# বিভাগ: id → বাংলা নাম। ছাঁকনির তালিকা current-affairs-plan.md থেকে।
CATEGORIES = {
    "agreement": "চুক্তি ও সমঝোতা",
    "organization": "আন্তর্জাতিক সংস্থা ও সম্মেলন",
    "election": "নিয়োগ ও নির্বাচন",
    "award": "পুরস্কার",
    "index": "সূচক ও র‍্যাংকিং",
    "law": "নতুন আইন ও নীতি",
    "sports": "খেলা",
    "scitech": "বিজ্ঞান ও প্রযুক্তি",
    "economy": "অর্থনীতি",
}


# খবরের তিন ভাগ (PIASH, ২০২৬-১১-০৪)
SECTIONS = {"bd": "বাংলাদেশ", "intl": "আন্তর্জাতিক", "gk": "সাধারণ জ্ঞান"}
# হোমের ৭টা: প্রতি ভাগ থেকে এতগুলো; কোনো ভাগে কম পড়লে বাকিগুলো চমক-মান ধরে পূরণ
HOME_QUOTA = {"bd": 3, "intl": 2, "gk": 2}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def now_dhaka() -> dt.datetime:
    return dt.datetime.now(DHAKA)


def read_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json(path: Path, data) -> None:
    """ছোট রাখতে ফাঁকা জায়গা ছাড়া (ফোনে হালকা); প্রতিটা ঘটনা আলাদা লাইনে, যাতে git-এর বদল পড়া যায়।"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    text = text.replace('},{"id":', '},\n{"id":').replace('},{"date":', '},\n{"date":')
    path.write_text(text + "\n", encoding="utf-8")


# ---------- ইন্টারনেট ----------

def http_get(url: str, timeout: int = 25, max_bytes: int = 3_000_000) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
        return r.read(max_bytes)


def domain(url: str) -> str:
    """উৎসের মূল ডোমেইন (bangla.thedailystar.net → thedailystar.net), দুই-উৎস গোনার জন্য।"""
    host = urllib.parse.urlparse(url).hostname or ""
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"com", "co", "org", "gov", "net", "ac", "edu"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])          # prothomalo.com.bd ধাঁচ
    return ".".join(parts[-2:])


class _TextGrab(HTMLParser):
    """খবরের পাতা থেকে শুধু <p>, <h1>, <h2> আর <li>-এর লেখা।"""
    KEEP = {"p", "h1", "h2", "li"}
    SKIP = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self._buf, self._keep, self._skip = [], [], 0, 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag in self.KEEP:
            self._keep += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        elif tag in self.KEEP and self._keep:
            self._keep -= 1
            t = " ".join("".join(self._buf).split())
            if len(t) > 40:
                self.out.append(t)
            self._buf = []

    def handle_data(self, data):
        if self._keep and not self._skip:
            self._buf.append(data)


def page_text(url: str, limit: int = 7000) -> str:
    try:
        raw = http_get(url, timeout=20)
    except Exception as e:  # noqa: BLE001 — কোনো পাতা না খুললে শুধু বাদ
        log(f"  পাতা খুলল না: {url} ({e.__class__.__name__})")
        return ""
    text = raw.decode("utf-8", "replace")
    g = _TextGrab()
    try:
        g.feed(text)
    except Exception:  # noqa: BLE001
        pass
    body = "\n".join(dict.fromkeys(g.out))           # একই অনুচ্ছেদ দুবার নয়
    return body[:limit]


def strip_html(s: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split())


# ---------- Gemini ----------

API = "https://generativelanguage.googleapis.com/v1beta"
# বিনা খরচের সীমা (PIASH-এর AI Studio, ২০২৬-১১-০৪), দিনে কতটা অনুরোধ:
#   gemini-3.1-flash-lite ৫০০ · gemini-2.5-flash-lite ২০ (মিনিটে ১০) · gemini-2.5-flash ২০ · gemini-3.6-flash ২০
#   gemini-3.8-flash ২০ · Gemma 4 26B ১৪,৪০০ · Gemma 4 31B ১৪,৪০০।  ফ্ল্যাশগুলো মিনিটে ৫টা।
GAP_SECONDS = float(os.environ.get("NEWS_GEMINI_GAP", "13"))   # মিনিটে ৫টার কম
MAX_CALLS = int(os.environ.get("NEWS_MAX_CALLS", "12"))        # এক চালানোয় সর্বোচ্চ; আবার চালানোর জায়গা রেখে
_last_call = [0.0]
CALLS = {"n": 0}
EXHAUSTED: set[str] = set()
_MODEL_NAMES: list[str] | None = None


def _available(key: str) -> list[str]:
    """চাবিতে কোন কোন মডেল চলে (একবার জেনে রাখা)। না জানা গেলে খালি তালিকা।"""
    global _MODEL_NAMES
    if _MODEL_NAMES is None:
        _MODEL_NAMES = []
        try:
            req = urllib.request.Request(f"{API}/models?pageSize=1000", headers={"x-goog-api-key": key})
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                for m in json.loads(r.read()).get("models", []):
                    if "generateContent" in m.get("supportedGenerationMethods", []):
                        _MODEL_NAMES.append(m["name"].removeprefix("models/"))
        except Exception as e:  # noqa: BLE001
            log(f"  মডেলের তালিকা পাওয়া গেল না ({e.__class__.__name__})")
    return _MODEL_NAMES


def resolve(models: list[str], key: str) -> list[str]:
    """'gemma-4-31b*' ধাঁচের নাম (শেষে *) চাবির আসল মডেল-নামে বদলানো; বাকিগুলো যেমন আছে।"""
    out = []
    for m in models:
        if m.endswith("*"):
            pre = m[:-1]
            out += sorted(n for n in _available(key) if n.startswith(pre))
        else:
            out.append(m)
    return list(dict.fromkeys(out))


def _parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        t = t.rsplit("```", 1)[0]
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        a, b = t.find("{"), t.rfind("}")
        if a >= 0 and b > a:
            return json.loads(t[a:b + 1])
        raise


def _configs(model: str, gen: dict):
    """এই মডেলে কোন কোন সাজে চেষ্টা হবে। Gemma-তে JSON-ছাঁচ আর thinking চলে না।"""
    if model.startswith("gemma"):
        yield {"temperature": gen["temperature"]}
        return
    for th in ({"thinkingLevel": "low"}, {"thinkingBudget": 0}, None):
        g = dict(gen)
        if th:
            g["thinkingConfig"] = th
        yield g
    yield {"temperature": gen["temperature"]}                    # শেষ চেষ্টা: কোনো বাড়তি সাজ ছাড়া


def gemini_json(prompt: str, models: list[str], schema: dict | None = None, temperature: float = 0.2):
    """Gemini/Gemma-কে ডেকে JSON ফেরত। মডেল না পেলে বা দিনের সীমা শেষ হলে তালিকার পরেরটা।"""
    if CALLS["n"] >= MAX_CALLS:
        raise RuntimeError(f"আজকের অনুরোধের সীমা ({MAX_CALLS}) শেষ")
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY নেই")
    gen = {"temperature": temperature, "responseMimeType": "application/json"}
    if schema:
        gen["responseSchema"] = schema
    last_err = None
    for model in resolve(models, key):
        if model in EXHAUSTED:
            continue
        gone = False
        for cfg in _configs(model, gen):
            if gone:
                break
            body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": cfg}
            for attempt in range(3):
                wait = GAP_SECONDS - (time.time() - _last_call[0])
                if wait > 0:
                    time.sleep(wait)
                _last_call[0] = time.time()
                req = urllib.request.Request(
                    f"{API}/models/{model}:generateContent",
                    data=json.dumps(body).encode(),
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                )
                try:
                    with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as r:
                        res = json.loads(r.read())
                    CALLS["n"] += 1
                    parts = res["candidates"][0]["content"]["parts"]
                    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                    out = _parse_json(text)
                    log(f"  Gemini: {model}")
                    return out
                except urllib.error.HTTPError as e:
                    msg = e.read().decode("utf-8", "replace")[:300]
                    low = msg.lower().replace(" ", "")
                    last_err = f"{model}: HTTP {e.code} {msg}"
                    if e.code in (401, 403, 404):
                        # 404: মডেল নেই; 401/403: নতুন ধরনের চাবি (AQ.) কিছু পুরোনো মডেলে চলে না → পরের মডেল
                        log(f"  {model}: HTTP {e.code}, পরের মডেল")
                        gone = True
                        break
                    if e.code == 400:
                        break                      # এই সাজ চলে না → পরের সাজ
                    if e.code == 429 and ("perday" in low or "per_day" in low or "daily" in low):
                        EXHAUSTED.add(model)       # আজকের সীমা শেষ → পরের মডেল (প্রতিটার সীমা আলাদা)
                        log(f"  {model}: আজকের সীমা শেষ, পরের মডেল")
                        gone = True
                        break
                    if e.code in (429, 500, 502, 503, 504):
                        time.sleep(20 * (attempt + 1))
                        continue
                    raise RuntimeError(last_err) from None
                except (KeyError, IndexError, json.JSONDecodeError) as e:
                    last_err = f"{model}: উত্তর বোঝা গেল না ({e.__class__.__name__})"
                    time.sleep(3)
                    continue
                except (urllib.error.URLError, TimeoutError) as e:
                    last_err = f"{model}: {e}"
                    time.sleep(10)
                    continue
    raise RuntimeError(f"Gemini কাজ করল না: {last_err}")
