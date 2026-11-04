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


class Feeds(unittest.TestCase):
    def test_rss_and_atom(self):
        r = collect.parse_feed(RSS.format(t="T", u="https://x.com/1", d="<b>d</b>",
                                          p="Wed, 04 Nov 2026 10:00:00 +0600").encode())
        self.assertEqual(r[0]["desc"], "d")
        a = collect.parse_feed(ATOM.encode())
        self.assertEqual(a[0]["url"], "https://ex.org/a")

    def test_domain(self):
        self.assertEqual(common.domain("https://bangla.thedailystar.net/x"), "thedailystar.net")
        self.assertEqual(common.domain("https://www.prothomalo.com/a"), "prothomalo.com")
        self.assertEqual(common.domain("https://cabinet.gov.bd/a"), "cabinet.gov.bd")


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
                                    "score": 8, "region": "bd"}]}
            return {"title": "অক্টোবরে রেমিট্যান্স ২৮৭ কোটি ডলার", "short": "গত মাসে প্রবাসী আয় ২৮৭ কোটি ডলার।",
                    "detail": "বাংলাদেশ ব্যাংকের হিসাবে অক্টোবরে প্রবাসী আয় দাঁড়িয়েছে ২৮৭ কোটি ডলারে।",
                    "why_exam": "অর্থনীতির সংখ্যা।", "category": "economy", "score": 8, "region": "bd",
                    "facts": [{"label": "রেমিট্যান্স", "value": "২৮৭ কোটি ডলার",
                               "evidence": [{"src": 0, "quote": "$2.87 billion in October"},
                                            {"src": 1, "quote": "প্রবাসীরা ২৮৭ কোটি ডলার পাঠিয়েছেন"}]}]}

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            with mock.patch.object(collect, "read_json", return_value=cfg), \
                 mock.patch.object(collect, "http_get", side_effect=fake_get), \
                 mock.patch.object(common, "http_get", side_effect=fake_get), \
                 mock.patch.object(pick, "gemini_json", side_effect=fake_gemini), \
                 mock.patch.object(build, "NEWS_DIR", tmp), \
                 mock.patch.object(run_daily, "NEWS_DIR", tmp), \
                 mock.patch.object(run_daily, "now_dhaka",
                                   return_value=dt.datetime(2026, 11, 4, 22, 30, tzinfo=common.DHAKA)), \
                 mock.patch.object(sys, "argv", ["x", "--summary", str(tmp / "s.md")]):
                self.assertEqual(run_daily.main(), 0)
            day = json.loads((tmp / "day/2026-11-04.json").read_text())
            self.assertEqual(len(day["top"]), 1)
            self.assertEqual(len(day["top"][0]["sources"]), 2)
            self.assertNotIn("evidence", json.dumps(day))          # উদ্ধৃতি পাবলিক ফাইলে নয়
            self.assertEqual(json.loads((tmp / "month/2026-11.json").read_text())["items"][0]["score"], 8)
            self.assertEqual(json.loads((tmp / "index.json").read_text())["latest"], "2026-11-04")
            self.assertIn("প্রকাশ: **1টা**", (tmp / "s.md").read_text())


if __name__ == "__main__":
    unittest.main(verbosity=1)
