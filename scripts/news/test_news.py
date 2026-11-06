"""ইন্টারনেট বা Gemini ছাড়া পুরো ধারার পরীক্ষা:  python3 scripts/news/test_news.py"""
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))

import build  # noqa: E402
import build_pages  # noqa: E402
import collect  # noqa: E402
import common  # noqa: E402
import pick  # noqa: E402
import run_daily  # noqa: E402
from verify import check_item, norm, numbers, shared_run  # noqa: E402

RSS = """<?xml version="1.0"?><rss><channel>
<item><title>{t}</title><link>{u}</link><description>{d}</description><pubDate>{p}</pubDate></item>
</channel></rss>"""
ATOM = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom title</title>
<link href="https://ex.org/a"/><updated>2026-11-04T05:00:00Z</updated><summary>s</summary></entry></feed>"""


class Verify(unittest.TestCase):
    def test_digits_and_scale(self):
        self.assertEqual(norm("২৮৭ কোটি"), "287 কোটি")
        self.assertIn(287.0, numbers("২৮৭ কোটি ডলার"))
        self.assertIn(399000.0, numbers("3,99,000"))

    def texts(self):
        return [{"domain": "a.com", "text": "Remittance stood at $2.87 billion in October, Bangladesh Bank said."},
                {"domain": "b.com", "text": "অক্টোবরে প্রবাসীরা ২৮৭ কোটি ডলার পাঠিয়েছেন বলে বাংলাদেশ ব্যাংক জানায়।"}]

    def item(self, **kw):
        it = {"title": "অক্টোবরে রেমিট্যান্স ২৮৭ কোটি ডলার", "short": "প্রবাসী আয় এল ২৮৭ কোটি ডলার।",
              "detail": "বাংলাদেশ ব্যাংকের হিসাবে গত মাসে দেশে প্রবাসী আয় এসেছে ২৮৭ কোটি ডলার।", "why_exam": "",
              "facts": [{"label": "অক্টোবরের রেমিট্যান্স", "value": "২৮৭ কোটি ডলার",
                         "evidence": [{"src": 0, "quote": "$2.87 billion in October"},
                                      {"src": 1, "quote": "২৮৭ কোটি ডলার পাঠিয়েছেন"}]}]}
        it.update(kw)
        return it

    def test_two_sources_pass(self):
        ok, why = check_item(self.item(), self.texts())
        self.assertTrue(ok, why)

    def test_invented_quote_fails(self):
        it = self.item()
        it["facts"][0]["evidence"][1]["quote"] = "২৯০ কোটি ডলার এসেছে"
        ok, why = check_item(it, self.texts())
        self.assertFalse(ok)

    def test_single_source_fact_dropped_not_fatal(self):
        it = self.item()
        it["facts"].append({"label": "গভর্নর", "value": "অজানা ব্যক্তি", "evidence": [{"src": 0, "quote": "Bangladesh Bank said"}]})
        ok, why = check_item(it, self.texts())
        self.assertTrue(ok, why)
        self.assertEqual(len(it["facts"]), 1)
        self.assertEqual(len(it["_dropped"]), 1)

    def test_dropped_name_in_text_fails(self):
        it = self.item(short="অজানা ব্যক্তি জানান, প্রবাসী আয় ২৮৭ কোটি ডলার।")
        it["facts"].append({"label": "কে", "value": "অজানা ব্যক্তি", "evidence": [{"src": 0, "quote": "Bangladesh Bank said"}]})
        self.assertFalse(check_item(it, self.texts())[0])

    def test_unverified_number_in_summary_fails(self):
        ok, why = check_item(self.item(short="প্রবাসী আয় বেড়েছে ১২ শতাংশ।"), self.texts())
        self.assertFalse(ok)
        self.assertTrue(any("১২" in w or "12" in w for w in why))

    def test_one_domain_fails(self):
        t = self.texts()
        t[1]["domain"] = "a.com"
        self.assertFalse(check_item(self.item(), t)[0])

    def test_copy_detected(self):
        src = "এক দুই তিন চার পাঁচ ছয় সাত আট নয়"
        self.assertTrue(shared_run("শুরু এক দুই তিন চার পাঁচ ছয় সাত আট", src))
        self.assertIsNone(shared_run("এক দুই তিন চার পাঁচ ছয় সাত ভিন্ন", src))


class Pages(unittest.TestCase):
    """/news/ স্থির পাতা: ডেটা-ফাইল থেকে HTML, ইন্টারনেট ছাড়া।"""

    @staticmethod
    def item(n, date, sec, title, score=9, src="https://x.com/a"):
        return {"id": f"{date}-{n:02d}", "title": title, "short": f"ছোট {n}", "detail": f"বিস্তারিত {n}", "why_exam": "কারণ",
                "category": "economy", "category_bn": "অর্থনীতি", "section": sec, "section_bn": common.SECTIONS[sec],
                "score": score, "facts": [{"label": "ঘর", "value": "মান"}], "sources": [{"name": "উৎস", "url": src}]}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        nd = self.root / "news"
        (nd / "day").mkdir(parents=True)
        (nd / "month").mkdir()
        secs = common.SECTIONS
        d1 = {"date": "2026-11-04", "sections": secs, "top": [self.item(1, "2026-11-04", "bd", "প্রথম <script>alert(1)</script>")],
              "more": [self.item(2, "2026-11-04", "intl", "দ্বিতীয়", 7)]}
        d2 = {"date": "2026-11-05", "sections": secs, "top": [self.item(1, "2026-11-05", "gk", "তৃতীয়")], "more": []}
        for d in (d1, d2):
            (nd / "day" / f"{d['date']}.json").write_text(json.dumps(d), encoding="utf-8")
        (nd / "month" / "2026-11.json").write_text(json.dumps({"month": "2026-11", "items": [
            {"date": "2026-11-04", "id": "2026-11-04-01", "title": "প্রথম", "short": "ছোট", "section": "bd", "category": "economy", "score": 9}]}), encoding="utf-8")
        (nd / "index.json").write_text(json.dumps({"days": [{"date": "2026-11-05", "n": 1}, {"date": "2026-11-04", "n": 2}],
                                                   "latest": "2026-11-05"}), encoding="utf-8")
        self.nd = nd

    def tearDown(self):
        self.tmp.cleanup()

    def test_builds_all_pages_and_is_idempotent(self):
        ch = build_pages.build_all(self.nd)
        self.assertEqual(sorted(ch), ["news/2026/11/04/index.html", "news/2026/11/05/index.html",
                                      "news/2026/11/index.html", "news/index.html"])
        self.assertEqual(build_pages.build_all(self.nd), [])            # একই ডেটা → কোনো বদল নয়

    def test_day_page_content(self):
        build_pages.build_all(self.nd)
        h = (self.root / "news/2026/11/04/index.html").read_text(encoding="utf-8")
        self.assertIn("৪ নভেম্বর ২০২৬, বুধবার", h)
        self.assertIn('href="https://x.com/a"', h)                      # মূল লিংক
        self.assertIn("বাংলাদেশ (১)", h)
        self.assertIn("আন্তর্জাতিক (১)", h)
        self.assertNotIn("<script>alert", h)                             # শিরোনাম escape হয়
        self.assertIn("&lt;script&gt;", h)
        self.assertIn('href="/news/2026/11/05/"', h)                    # নতুন পাশের দিন
        self.assertIn('href="/news/2026/11/"', h)                       # মাসের লিংক
        self.assertNotIn("evidence", h)
        self.assertEqual(h.count("<script"), 3 + h.count("<script>alert"))   # শুধু সাইটের app, account, omr

    def test_landing_and_month(self):
        build_pages.build_all(self.nd)
        h = (self.root / "news/index.html").read_text(encoding="utf-8")
        self.assertIn("৫ নভেম্বর ২০২৬, বৃহস্পতিবার", h)                 # সর্বশেষ দিন
        self.assertIn('href="/news/2026/11/05/#2026-11-05-01"', h)
        self.assertIn('href="/news/2026/11/04/"', h)                    # আগের দিন
        self.assertIn("শীঘ্রই", h)                                       # /circular/ নেই → লিংকহীন ঘর
        m = (self.root / "news/2026/11/index.html").read_text(encoding="utf-8")
        self.assertIn('href="/news/2026/11/04/#2026-11-04-01"', m)

    def test_no_dead_internal_links(self):
        build_pages.build_all(self.nd)
        for f in (self.root / "news").rglob("index.html"):
            for href in __import__("re").findall(r'href="(/news/[^"#]*)', f.read_text(encoding="utf-8")):
                self.assertTrue((self.root / href.strip("/") / "index.html").exists(), f"{f}: {href}")


class Feeds(unittest.TestCase):
    def test_rss_and_atom(self):
        r = collect.parse_feed(RSS.format(t="T", u="https://x.com/1", d="<b>d</b>",
                                          p="Wed, 04 Nov 2026 10:00:00 +0600").encode())
        self.assertEqual(r[0]["desc"], "d")
        a = collect.parse_feed(ATOM.encode())
        self.assertEqual(a[0]["url"], "https://ex.org/a")

    def test_rdf(self):
        x = ('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" '
             'xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>DW</title><link>https://dw.com/a</link>'
             '<dc:date>2026-11-04T05:00:00Z</dc:date></item></rdf:RDF>')
        r = collect.parse_feed(x.encode())
        self.assertEqual((r[0]["title"], r[0]["url"]), ("DW", "https://dw.com/a"))

    def test_news_sitemap(self):
        x = (b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             b'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://a.com/x</loc><news:news>'
             b'<news:publication_date>2026-11-06T10:00:00+06:00</news:publication_date><news:title>T</news:title>'
             b'</news:news></url></urlset>')
        r = collect.parse_feed(x)
        self.assertEqual((r[0]["title"], r[0]["url"]), ("T", "https://a.com/x"))

    def test_domain(self):
        self.assertEqual(common.domain("https://bangla.thedailystar.net/x"), "thedailystar.net")
        self.assertEqual(common.domain("https://www.prothomalo.com/a"), "prothomalo.com")
        self.assertEqual(common.domain("https://cabinet.gov.bd/a"), "cabinet.gov.bd")


class Batch(unittest.TestCase):
    def test_two_events_one_call(self):
        calls = []

        def fake(prompt, models, **kw):
            calls.append(prompt)
            return {"items": [{"event": 2, "title": "খ", "category": "economy", "score": 7, "section": "bd"},
                              {"event": 1, "skip": True}]}
        g = lambda t: {"topic": t, "category": "law", "score": 5, "section": "intl"}
        txt = [{"name": "ক", "title": "t", "text": "x"}]
        with mock.patch.object(pick, "gemini_json", side_effect=fake):
            out = pick.write_batch([(g("এক"), txt), (g("দুই"), txt)])
        self.assertEqual(len(calls), 1)
        self.assertIsNone(out[0])
        self.assertEqual((out[1]["title"], out[1]["section"]), ("খ", "bd"))


class Models(unittest.TestCase):
    def test_resolve_and_parse(self):
        common._MODEL_NAMES = ["gemma-4-31b-it", "gemma-4-26b-a4b-it", "gemini-3.6-flash"]
        self.assertEqual(common.resolve(["gemini-3.6-flash", "gemma-4-31b*", "gemma-9*"], "k"),
                         ["gemini-3.6-flash", "gemma-4-31b-it"])
        common._MODEL_NAMES = None
        self.assertEqual(common._parse_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(common._parse_json('এই নিন: {"a": 2} শেষ'), {"a": 2})
        self.assertNotIn("responseMimeType", list(common._configs("gemma-4-31b-it", {"temperature": 0.2,
                                                                                     "responseMimeType": "x"}))[0])


class Home(unittest.TestCase):
    def test_quota(self):
        mk = lambda sec, sc: {"section": sec, "score": sc, "sources": [1]}
        items = [mk("intl", 10), mk("intl", 9), mk("intl", 9), mk("intl", 8), mk("bd", 7), mk("bd", 6),
                 mk("gk", 5), mk("bd", 4), mk("bd", 3)]
        home = build.pick_home(build.order(items))
        secs = [x["section"] for x in home]
        self.assertEqual(len(home), 7)
        self.assertEqual((secs.count("bd"), secs.count("intl"), secs.count("gk")), (3, 3, 1))   # gk কম → intl দিয়ে পূরণ


class Discovery(unittest.TestCase):
    """ঠিকানা না চললে সাইটকেই জিজ্ঞেস: হোমপাতার RSS-লিংক, robots.txt, sitemap-index।"""
    P = "Wed, 04 Nov 2026 10:00:00 +0600"
    UNTIL = dt.datetime(2026, 11, 4, 22, 30, tzinfo=common.DHAKA)

    def _run(self, site, feed):
        def fake_get(url, **kw):
            if url in site:
                return site[url].encode()
            err = OSError("no")
            err.code = 404
            raise err
        with mock.patch.object(collect, "read_json", return_value={"feeds": [feed]}), \
             mock.patch.object(collect, "http_get", side_effect=fake_get):
            return collect.collect(self.UNTIL)

    def test_homepage_rss_link(self):
        site = {"https://paper.bd": '<html><head><link rel="alternate" type="application/rss+xml" href="/feeds/all.xml"></head></html>',
                "https://paper.bd/feeds/all.xml": RSS.format(t="খবর", u="https://paper.bd/n/1", d="d", p=self.P)}
        items, health = self._run(site, {"name": "পত্রিকা", "url": "https://paper.bd/rss", "lang": "bn", "kind": "news"})
        self.assertEqual([i["title"] for i in items], ["খবর"])
        self.assertTrue(health[0]["discovered"])
        self.assertEqual(health[0]["url"], "https://paper.bd/feeds/all.xml")

    def test_home_only_entry_and_robots_sitemap_index(self):
        idx = ('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://paper.bd/sm-other.xml</loc></sitemap>'
               '<sitemap><loc>https://paper.bd/sitemap-news.xml</loc></sitemap></sitemapindex>')
        news = ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'
                '<url><loc>https://paper.bd/n/2</loc><news:news><news:publication_date>2026-11-04T10:00:00+06:00</news:publication_date>'
                '<news:title>সূচির খবর</news:title></news:news></url></urlset>')
        site = {"https://paper.bd/": "<html></html>", "https://paper.bd/robots.txt": "User-agent: *\nSitemap: https://paper.bd/sitemap.xml\n",
                "https://paper.bd/sitemap.xml": idx, "https://paper.bd/sitemap-news.xml": news}
        items, health = self._run(site, {"name": "পত্রিকা", "home": "https://paper.bd/", "lang": "bn", "kind": "news"})
        self.assertEqual([i["title"] for i in items], ["সূচির খবর"])
        self.assertTrue(health[0]["ok"])

    def test_blocked_site_reports_why_and_others_continue(self):
        blocked = {"name": "আটকানো", "url": "https://blocked.bd/rss", "lang": "bn", "kind": "news"}
        good = {"name": "ভালো", "url": "https://ok.bd/rss", "lang": "bn", "kind": "news"}

        def fake_get(url, **kw):
            if url.startswith("https://ok.bd/rss"):
                return RSS.format(t="ঠিক", u="https://ok.bd/1", d="d", p=self.P).encode()
            err = OSError("forbidden")
            err.code = 403
            raise err
        with mock.patch.object(collect, "read_json", return_value={"feeds": [blocked, good]}), \
             mock.patch.object(collect, "http_get", side_effect=fake_get):
            items, health = collect.collect(self.UNTIL)
        self.assertEqual([i["src"] for i in items], ["ভালো"])
        self.assertFalse(health[0]["ok"])
        self.assertIn("403", health[0]["error"])


class EndToEnd(unittest.TestCase):
    """নকল ফিড + নকল Gemini দিয়ে পুরো run_daily: যাচাই-পেরোনো খবর প্রকাশ, বানানো সংখ্যা আটকানো।"""

    def test_run(self):
        p = "Wed, 04 Nov 2026 10:00:00 +0600"
        pages = {
            "https://a.com/r": "<p>Remittance stood at $2.87 billion in October, Bangladesh Bank data showed on Sunday.</p>",
            "https://b.com/r": "<p>অক্টোবরে প্রবাসীরা ২৮৭ কোটি ডলার পাঠিয়েছেন বলে বাংলাদেশ ব্যাংকের হালনাগাদ তথ্যে দেখা যায়।</p>",
        }
        feeds = {"https://feed/a": RSS.format(t="Remittance $2.87b", u="https://a.com/r", d="d", p=p),
                 "https://feed/b": RSS.format(t="রেমিট্যান্স ২৮৭ কোটি", u="https://b.com/r", d="d", p=p)}
        for n in range(12):
            feeds[f"https://feed/x{n}"] = RSS.format(t=f"অপরাধের খবর {n}", u=f"https://x{n}.com/c", d="d", p=p)
        cfg = {"feeds": [{"name": u[-2:], "url": u, "lang": "bn", "kind": "news"} for u in feeds]}

        def fake_get(url, **kw):
            if url in feeds:
                return feeds[url].encode()
            if url in pages:
                return pages[url].encode()
            raise OSError("no")

        def fake_gemini(prompt, models, **kw):
            if "শিরোনাম (JSON" in prompt:
                return {"groups": [{"items": [0, 1], "topic": "অক্টোবরের রেমিট্যান্স", "category": "economy",
                                    "score": 8, "section": "bd"}]}
            assert "[ঘটনা 1]" in prompt
            return {"items": [{"event": 1, "title": "অক্টোবরে রেমিট্যান্স ২৮৭ কোটি ডলার", "short": "গত মাসে প্রবাসী আয় ২৮৭ কোটি ডলার।",
                    "detail": "বাংলাদেশ ব্যাংকের হিসাবে অক্টোবরে প্রবাসী আয় দাঁড়িয়েছে ২৮৭ কোটি ডলারে।",
                    "why_exam": "অর্থনীতির সংখ্যা।", "category": "economy", "score": 8, "section": "bd",
                    "facts": [{"label": "রেমিট্যান্স", "value": "২৮৭ কোটি ডলার",
                               "evidence": [{"src": 0, "quote": "$2.87 billion in October"},
                                            {"src": 1, "quote": "প্রবাসীরা ২৮৭ কোটি ডলার পাঠিয়েছেন"}]}]}]}

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            with mock.patch.object(collect, "read_json", return_value=cfg), \
                 mock.patch.object(collect, "http_get", side_effect=fake_get), \
                 mock.patch.object(common, "http_get", side_effect=fake_get), \
                 mock.patch.object(pick, "gemini_json", side_effect=fake_gemini), \
                 mock.patch.object(build, "NEWS_DIR", tmp), \
                 mock.patch.object(run_daily, "NEWS_DIR", tmp), \
                 mock.patch.object(run_daily, "build_pages") as bp, \
                 mock.patch.object(run_daily, "now_dhaka",
                                   return_value=dt.datetime(2026, 11, 4, 22, 30, tzinfo=common.DHAKA)), \
                 mock.patch.object(sys, "argv", ["x", "--summary", str(tmp / "s.md")]):
                self.assertEqual(run_daily.main(), 0)
            bp.assert_called_once_with(tmp)                         # প্রকাশের পরে /news/ পাতা বানানো হয়
            day = json.loads((tmp / "day/2026-11-04.json").read_text())
            self.assertEqual(len(day["top"]), 1)
            self.assertEqual(len(day["top"][0]["sources"]), 2)
            self.assertNotIn("evidence", json.dumps(day))          # উদ্ধৃতি পাবলিক ফাইলে নয়
            self.assertEqual(json.loads((tmp / "month/2026-11.json").read_text())["items"][0]["score"], 8)
            self.assertEqual(json.loads((tmp / "index.json").read_text())["latest"], "2026-11-04")
            self.assertIn("প্রকাশ: **1টা**", (tmp / "s.md").read_text())
            self.assertEqual(day["top"][0]["section_bn"], "বাংলাদেশ")


if __name__ == "__main__":
    unittest.main(verbosity=1)
