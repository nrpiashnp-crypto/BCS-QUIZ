"""ধাপ ২: মূল বিজ্ঞপ্তি (PDF/ছবি) পড়ে ঘর তোলা — দুইবার, দুই আলাদা মডেলে।

প্রথম পাঠ (gemini-3.1-flash-lite, দিনে ৫০০): সব ঘর + জরুরি ঘরের হুবহু অংশ।
দ্বিতীয় পাঠ (Gemma → না চললে 2.5-flash-lite): শুধু জরুরি ঘর (শেষ তারিখ, বয়সসীমা, মোট পদ)।
দুটো না মিললে প্রকাশ নয়, অ্যাডমিনের কাছে।
"""
from __future__ import annotations

from common import gemini_json  # খবরের বটের Gemini-যন্ত্র (files= দিয়ে PDF/ছবি পাঠানো যায়)

# ৭ নভেম্বরের প্রথম চালানোর শিক্ষা: 3.1-flash-lite বাংলা অঙ্ক ভুল পড়ে (২০২৬ → ২০২৩, ৩২ → ৩০), হুবহু অংশেও।
# Gemma 4 31B ঠিক পড়েছে (টেলিটকের শেষ তারিখের সঙ্গে মিলেছে), আর দিনে ১৪,৪০০টা চলে — তাই প্রথম পাঠ Gemma 31B,
# দ্বিতীয় পাঠ আলাদা মডেল Gemma 26B; না চললে flash-lite।
FIRST = ["gemma-4-31b*", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
SECOND = ["gemma-4-26b*", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]

PROMPT = """তুমি বাংলাদেশের চাকরির নিয়োগ বিজ্ঞপ্তি পড়ছ। সংযুক্ত দলিলটা পড়ে নিচের JSON দাও। যা দলিলে নেই তা null।
অনুমান করবে না; শুধু দলিলে লেখা তথ্য। তারিখ YYYY-MM-DD, সময়সহ হলে YYYY-MM-DDTHH:MM (ঢাকার সময়, ২৪ ঘণ্টা)।
বাংলা অঙ্ক ইংরেজি অঙ্কে লিখবে। লেখা (org, edu_line, post name) বাংলায়।

{
 "is_recruitment": true/false,        // নতুন পদে লোক নেওয়ার বিজ্ঞপ্তি কি না (ফল/প্রবেশপত্র/নিয়োগপত্র হলে false)
 "org": "প্রতিষ্ঠানের পুরো নাম",
 "memo": "স্মারক নম্বর",
 "published": "বিজ্ঞপ্তির তারিখ",
 "posts": [{"name": "পদের নাম", "count": সংখ্যা বা null, "grade": গ্রেড সংখ্যা বা null}],
 "total_posts": সব পদ মিলিয়ে মোট সংখ্যা বা null,
 "apply_start": "আবেদন শুরু", "apply_end": "আবেদনের শেষ সময়",
 "age_ref_date": "বয়স গণনার তারিখ (যে তারিখে বয়স ধরা হবে)",
 "age_min": সর্বনিম্ন বয়স বা null, "age_max": সাধারণ প্রার্থীর সর্বোচ্চ বয়স বা null,
 "age_relax": [{"who": "কোন শ্রেণি (যেমন বীর মুক্তিযোদ্ধার সন্তান, প্রতিবন্ধী)", "max": সর্বোচ্চ বয়স}],
 "edu_level": "none|jsc|ssc|hsc|diploma|bachelor|master — সবচেয়ে কম যে যোগ্যতায় কোনো একটা পদে আবেদন করা যায়",
 "edu_line": "যোগ্যতা এক লাইনে, সহজ ভাষায় (যেমন: স্নাতক, যেকোনো বিষয়)",
 "districts": "all" অথবা ["যে জেলার প্রার্থীরা পারবেন", ...],
 "fee": "আবেদন ফি (সংক্ষেপে)",
 "apply_url": "আবেদনের ঠিকানা",
 "exam_date": "পরীক্ষার তারিখ যদি লেখা থাকে",
 "quotes": {"apply_end": "দলিলে শেষ তারিখ যেভাবে লেখা, হুবহু", "age_max": "বয়সসীমা যেভাবে লেখা, হুবহু",
            "total_posts": "পদসংখ্যা যেভাবে লেখা, হুবহু"}
}"""

PROMPT2 = """সংযুক্ত নিয়োগ বিজ্ঞপ্তি থেকে শুধু এই তিনটা তথ্য JSON-এ দাও (না থাকলে null), অনুমান নয়:
{"apply_end": "আবেদনের শেষ তারিখ YYYY-MM-DD", "age_max": সাধারণ প্রার্থীর সর্বোচ্চ বয়স (সংখ্যা),
 "total_posts": সব পদ মিলিয়ে মোট পদসংখ্যা (সংখ্যা)}"""


def _one(x):
    """মডেল কখনো তালিকা ফেরত দেয় ([{...}]) — প্রথম বস্তুটা নেওয়া।"""
    if isinstance(x, list):
        x = next((i for i in x if isinstance(i, dict)), {})
    return x if isinstance(x, dict) else {}


def first_read(mime: str, data: bytes) -> dict:
    return _one(gemini_json(PROMPT, FIRST, files=[(mime, data)], temperature=0.0))


def second_read(mime: str, data: bytes) -> dict:
    return _one(gemini_json(PROMPT2, SECOND, files=[(mime, data)], temperature=0.0))
