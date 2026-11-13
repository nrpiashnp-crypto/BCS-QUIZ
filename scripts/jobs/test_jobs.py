"""নিয়োগ বিজ্ঞপ্তির বটের পরীক্ষা (ইন্টারনেট ছাড়া)।   python3 scripts/jobs/test_jobs.py"""
from __future__ import annotations

import datetime as dt
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import jbuild as build  # noqa: E402
import jobs_common as J  # noqa: E402
from jcollect import parse_links, parse_portal  # noqa: E402
from jverify import check, normalize  # noqa: E402

PORTAL = """<table><tr class="table-tr"><td class="table-td" data-column="id">১</td>
<td class="table-td" data-column="title"> ইউনিয়ন পরিষদে হিসাব সহকারী পদে জনবল নিয়োগ বিজ্ঞপ্তি </td>
<td class="table-td" data-column="files"><a href="https://x.oraclecloud15.com/a/b.pdf">pdf</a></td>
<td class="table-td" data-column="image"></td><td class="table-td" data-column="publish_date"><span>০৫-১১-২০২৬</span></td>
<td><a href="/pages/notices/abc-123">দেখুন</a></td></tr>
<tr class="table-tr"><td class="table-td" data-column="title"> কম্পিউটার অপারেটর পদে নিয়োগপত্র </td>
<td class="table-td" data-column="files"><a href="/f/c.pdf">pdf</a></td><td class="table-td" data-column="publish_date"><span>০৪-১১-২০২৬</span></td></tr></table>"""

GOOD = {"is_recruitment": True, "org": "জেলা প্রশাসকের কার্যালয়, জামালপুর", "published": "2026-11-04",
        "posts": [{"name": "মালী", "count": "01", "grade": 20}, {"name": "পরিচ্ছন্নতাকর্মী", "count": 16}],
        "apply_start": "2026-11-04T10:00", "apply_end": "2026-11-25T16:00", "age_ref_date": "2026-11-04",
        "age_min": 18, "age_max": "32", "age_relax": [{"who": "বীর মুক্তিযোদ্ধার সন্তান", "max": 32},
                                                      {"who": "প্রতিবন্ধী", "max": 34}],
        "edu_level": "jsc", "edu_line": "অষ্টম শ্রেণি পাস", "districts": "all", "fee": "৫৬ টাকা"}
TODAY = dt.date(2026, 11, 7)
fails = 0


def ok(cond, name):
    global fails
    print(("✓ " if cond else "✗ ") + name)
    fails += 0 if cond else 1


rows = parse_portal(PORTAL, "https://dpe.gov.bd/pages/notices")
ok(len(rows) == 2 and rows[0]["published"] == "2026-11-05" and rows[0]["doc"].endswith("b.pdf"), "নোটিশ-তালিকা পড়া")
ok(rows[0]["page"] == "https://dpe.gov.bd/pages/notices/abc-123", "নোটিশের পাতার পূর্ণ ঠিকানা")
ok(J.is_new_circular(rows[0]["title"]) and not J.is_new_circular(rows[1]["title"]), "নিয়োগপত্র বাদ, বিজ্ঞপ্তি রাখা")
ok(not J.is_new_circular("লিখিত পরীক্ষার ফলাফল — নিয়োগ বিজ্ঞপ্তি ২০২৬"), "ফলাফল বাদ")
ok(parse_links('<a href="/x/niyog.pdf">জনবল নিয়োগ বিজ্ঞপ্তি</a>', "https://a.gov.bd/p")[0]["doc"] == "https://a.gov.bd/x/niyog.pdf", "সাধারণ পাতার লিংক")
# পিএসসি (২০২৬-১১-১০): psc-exams তালিকায় ফাইলের ঘর "pdf"; শিরোনামের নিয়ম উৎসের নিজের ("want")
PSC = ('<tr><td data-column="title">৫১তম বিসিএস (বিশেষ) পরীক্ষা-২০২৬ এর বিজ্ঞপ্তি</td>'
       '<td data-column="pdf"><a href="https://o.example/bpsc/2026/9/c.pdf">ফাইল</a></td>'
       '<td data-column="publish_date">২৪-০৯-২০২৬</td></tr>')
pr = parse_portal(PSC, "https://bpsc.gov.bd/pages/psc-exams")
ok(len(pr) == 1 and pr[0]["doc"].endswith("c.pdf") and pr[0]["published"] == "2026-09-24", "পিএসসির পরীক্ষা-তালিকা (pdf ঘর)")
_src = {x["id"]: x for x in J.read_json(J.HERE / "sources.json")["sources"]}
import re as _re
_w = _re.compile(_src["bpsc-bcs"]["want"])
ok(_w.search(pr[0]["title"]) and not _w.search("৫১তম বিসিএস (বিশেষ) পরীক্ষা-২০২৬ এর লিখিত পরীক্ষার সিলেবাস।"), "বিসিএস বিজ্ঞপ্তি ধরা, সিলেবাস নয়")
ok(_re.search(_src["bpsc-ncad"]["want"], "বিজ্ঞপ্তির ক্রমিক নম্বর ৭৮- ৮২ (উচ্চতর)"), "নন-ক্যাডার চলমান বিজ্ঞপ্তি ধরা")
ok(not J.is_new_circular(pr[0]["title"]), "সাধারণ নিয়মে পিএসসির শিরোনাম ধরা পড়ত না (তাই আগে ০টা)")
ok(J.parse_bd_date("১৭-১০-২০২৬") == "2026-10-17" and J.parse_bd_date("31/02/2026") is None, "বাংলা তারিখ")

r = normalize(GOOD)
ok(r["age_max"] == 32 and r["posts"][0]["count"] == 1 and r["total_posts"] == 17, "সংখ্যা গোছানো, মোট পদ যোগ")
ok(check(r, {"apply_end": "2026-11-25", "age_max": 32, "total_posts": 17}, TODAY) == [], "দুই পাঠ মিললে পাস")
bad = check(r, {"apply_end": "2026-11-23", "age_max": 30, "total_posts": 17}, TODAY)
ok(any("শেষ তারিখ" in b for b in bad) and any("বয়সসীমা" in b for b in bad), "দুই পাঠ না মিললে আটকায়")
ok(any("দ্বিতীয় পাঠ" in b for b in check(r, None, TODAY)), "দ্বিতীয় পাঠ ছাড়া আটকায়")
ok(any("সময় শেষ" in b for b in check(r, {"apply_end": "2026-11-25"}, dt.date(2026, 12, 1))), "মেয়াদ শেষ ধরা")
tt = {"deadline": "2026-11-25T10:00:00.000Z", "posts": [{"count": 1}, {"count": 16}]}
ok(check(r, {"apply_end": "2026-11-25", "age_max": 32, "total_posts": 17}, TODAY, tt) == [], "টেলিটকের সঙ্গে মেলে")
tt2 = {"deadline": "2026-11-30T10:00:00.000Z", "posts": [{"count": 5}]}
ok(len(check(r, {"apply_end": "2026-11-25", "age_max": 32, "total_posts": 17}, TODAY, tt2)) == 2, "টেলিটকের সঙ্গে না মিললে আটকায়")
ok(any("অস্বাভাবিক" in b for b in check(normalize(dict(GOOD, age_max=320)), None, TODAY)), "অস্বাভাবিক বয়স")

c = dict(r, id="2026-11-04-abcdef")
ok(J.eligibility("1994-11-05", c)[0] == "yes", "৩১ বছর → আবেদন করা যায়")
ok(J.eligibility("1993-11-05", c)[0] == "yes", "৩২ বছর ১১ মাস → আবেদন করা যায় (রীতি)")
ok(J.eligibility("1992-01-01", c)[0] == "relax", "৩৪ → শুধু প্রতিবন্ধী")
ok(J.eligibility("1980-01-01", c)[0] == "no", "বয়স পেরিয়েছে")
ok(J.eligibility("2010-01-01", c)[0] == "no", "বয়স কম")
ok(J.age_on("2000-03-31", "2026-03-30") == (25, 11, 27), "বয়সের হিসাব")

tmp = Path(tempfile.mkdtemp())
try:
    build.CIRC_DIR, build.DATA_DIR = tmp / "circular", tmp / "circular" / "data"
    rec = dict(c, notice="https://x/b.pdf", page="https://x/", added="2026-11-07", quotes={"apply_end": "গোপন"}, sha="zz")
    old = dict(rec, id="2026-09-01-old000", apply_end="2026-10-01T16:00")
    ch = build.build_all([rec, old], today="2026-11-07")
    idx = (tmp / "circular/index.html").read_text(encoding="utf-8")
    det = (tmp / "circular/2026-11-04-abcdef/index.html").read_text(encoding="utf-8")
    pub = (tmp / "circular/data/2026-11-04-abcdef.json").read_text(encoding="utf-8")
    ok("মালী" in idx and "2026-09-01-old000" not in idx, "তালিকায় খোলা আছে, শেষ হওয়া নেই")
    ok("আবেদনের সময় শেষ" in (tmp / "circular/2026-09-01-old000/index.html").read_text(encoding="utf-8"), "শেষ হওয়ার পাতা থাকে")
    ok("গোপন" not in pub and "sha" not in pub and "গোপন" not in det, "পাবলিক ফাইলে হুবহু অংশ নেই")
    ok((tmp / "circular/data/archive/2026-10.json").exists(), "আর্কাইভ")
    ok("</script>" in idx and idx.count("<script>") >= 1 and 'data-c="' in idx, "জন্মতারিখের স্ক্রিপ্ট আর তথ্য")
    ok(build.build_all([rec, old], today="2026-11-07") == [], "দ্বিতীয়বার চালালে বদল নেই")
    ok(len(ch) >= 6, "ফাইল তৈরি")
finally:
    shutil.rmtree(tmp)

print(f"\n{'সব পাস' if not fails else f'{fails}টা ব্যর্থ'}")
sys.exit(1 if fails else 0)
