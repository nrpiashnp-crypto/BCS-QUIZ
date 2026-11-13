# lyannabooks.com: Claude Code সেশনের নিয়ম

এই রিপো লিয়ানা বুকসের পাবলিক সাইট। `main`-এ মার্জ হলেই Cloudflare Pages লাইভ করে।

- সব কথা মালিক PIASH-এর সাথে বাংলায়।
- আসল নিয়ম আর ভূমিকা প্রাইভেট রিপো **Lyanna_data**-তে: ওর `CLAUDE.md`, `PROJECTS.md` আর `handover/projects/<ভূমিকা>.md`। সেশনে Lyanna_data-ও বাছা থাকলে আগে ওগুলো পড়ুন। না থাকলে PIASH-কে বলুন সেশনে Lyanna_data যোগ করতে।
- নকশা আর ইঞ্জিনের নিয়ম `lyanna-site` স্কিলে, প্রশ্ন আর ব্যাখ্যার নিয়ম `lyanna-quiz` স্কিলে।
- রিপো পাবলিক: কোনো ইমেইল, ফোন, bKash নম্বর, টোকেন বা চাবিওয়ালা লিংক নয়।
- Cloudflare ফ্রি প্ল্যানে মাসে ৫০০ বিল্ড: ছোট ছোট পুশ নয়, কাজ জমিয়ে এক PR।
- জেনারেটেড ফাইল হাতে বদলাবেন না: `sitemap.xml` (tools/seo_build.py), `jobs/data/catalog.json` (jobs/tools/build_catalog.py), `admin/data/qmap.json`, `admin/data/qver.tsv` আর `data/ux.json` (ছাত্রের কথায় বদলানো ব্যাখ্যা, প্রশ্নের `"ux": "YYYY-MM"` থেকে) (tools/build_qmap.py; সংস্করণ-চিহ্নের বদলের খাতা `admin/data/qver-log.jsonl` শুধু বাড়ে, মোছা নয়), ১৯টা জেনারেটেড অধ্যায় পাতা (Lyanna_data/tools/site-builders/chapter-quiz/)।
- প্রশ্ন তোলার পরে `python3 tools/stats.py`, `python3 tools/seo_build.py` আর `python3 tools/build_qmap.py` (শিক্ষার্থীর পর্যালোচনার প্রশ্ন-মানচিত্র)।
- D1 বা Cloudflare সেটিংসে কিছু করার আগে PIASH-এর অনুমতি।
- **দুই দিক মিলিয়ে তবেই সাইটে** (PIASH, ২০২৬-১১-১৩; ১৩/১১-এ PR #150 মার্জে Mac থেকে তোলা সব কাজ সাইট থেকে সরে গিয়েছিল):
  - সাইটে যাওয়ার একটাই রাস্তা GitHub-এর `main`। Mac থেকে সাইটে তোলা শুধু `scripts/deploy_guard.py` দিয়ে (খবর আর নিয়োগের বট এটাই ডাকে); `wrangler pages deploy` হাতে চালানো নয়।
  - যেকোনো PR মার্জের আগে PR-এর "live-guard" যাচাই সবুজ কি না দেখা; লাল হলে মার্জ নয়, PIASH-কে জানানো। পুরোনো PR হলে যাচাই আবার চালানো (Actions → live-guard → Run workflow)।
  - নিজে মিলিয়ে দেখতে: https://lyannabooks.com/live.json খুললে "পাওয়া যায়নি" এলে সাইট GitHub থেকেই তোলা (নিরাপদ); কমিট লেখা থাকলে সেই কমিট GitHub-এর main-এ আছে কি না দেখা।
