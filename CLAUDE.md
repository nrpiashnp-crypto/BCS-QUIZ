# lyannabooks.com: Claude Code সেশনের নিয়ম

এই রিপো লিয়ানা বুকসের পাবলিক সাইট। `main`-এ মার্জ হলেই Cloudflare Pages লাইভ করে।

- সব কথা মালিক PIASH-এর সাথে বাংলায়।
- আসল নিয়ম আর ভূমিকা প্রাইভেট রিপো **Lyanna_data**-তে: ওর `CLAUDE.md`, `PROJECTS.md` আর `handover/projects/<ভূমিকা>.md`। সেশনে Lyanna_data-ও বাছা থাকলে আগে ওগুলো পড়ুন। না থাকলে PIASH-কে বলুন সেশনে Lyanna_data যোগ করতে।
- নকশা আর ইঞ্জিনের নিয়ম `lyanna-site` স্কিলে, প্রশ্ন আর ব্যাখ্যার নিয়ম `lyanna-quiz` স্কিলে।
- রিপো পাবলিক: কোনো ইমেইল, ফোন, bKash নম্বর, টোকেন বা চাবিওয়ালা লিংক নয়।
- Cloudflare ফ্রি প্ল্যানে মাসে ৫০০ বিল্ড: ছোট ছোট পুশ নয়, কাজ জমিয়ে এক PR।
- জেনারেটেড ফাইল হাতে বদলাবেন না: `sitemap.xml` (tools/seo_build.py), `jobs/data/catalog.json` (jobs/tools/build_catalog.py), ১৯টা জেনারেটেড অধ্যায় পাতা (Lyanna_data/tools/site-builders/chapter-quiz/)।
- প্রশ্ন তোলার পরে `python3 tools/stats.py` আর `python3 tools/seo_build.py`।
- D1 বা Cloudflare সেটিংসে কিছু করার আগে PIASH-এর অনুমতি।
