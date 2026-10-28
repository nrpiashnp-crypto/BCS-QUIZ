# টপিক লাইব্রেরি: নতুন PDF তোলার ধাপ

লাইব্রেরির লেখা **এই রিপোতে রাখা হয় না** (রিপো পাবলিক, আর পাইলটের লেখা অন্যের কপিরাইট)। লেখা থাকে শুধু Cloudflare D1-এ (`lyanna-db`, টেবিল `lib_topics`, `lib_tags`, `lib_sources`), আর দেখা যায় শুধু `/admin/library/` পাতায়, `ADMIN_EMAILS`-এ থাকা Google অ্যাকাউন্ট দিয়ে লগইন করলে। এখানে শুধু স্ক্রিপ্ট।

```
PDF → (run.sh: prep.py + tesseract + merge.py) প্রতি পৃষ্ঠা .md → assemble.py অধ্যায়ের .md
    → chunk.py টপিক ধরে ভাগ + ট্যাগ (JSON) → clean.py ভুল শিরোনাম/নম্বর ঠিক, বড় অংশ ভাঙা, বিগত প্রশ্ন চিহ্নিত
    → /admin/library/ পাতায় "নতুন অংশ তোলা" থেকে JSON/CSV ফাইল তোলা
```

- লাগবে: `poppler-utils` (pdftoppm), `tesseract-ocr` + `tesseract-ocr-script-beng`, Python-এ `opencv-python`, `numpy`।
- `run.sh chNN`: 300 DPI গ্রেস্কেল, উপরের ৯.৩% আর নিচের ৭% কাটা, থ্রেশহোল্ড `min(150, আশেপাশের গড় − 40)`; `Bengali+eng` আর শুধু `Bengali` দুবার OCR করে `merge.py` শব্দ ধরে মেলায়। স্ক্রিপ্টে `/tmp/claude-0/...` পথ আর অধ্যায়ের নাম (assemble.py-এর `T`) বাংলাদেশ বিষয়াবলির জন্য লেখা; নতুন বইয়ে বদলে নিন।
- `chunk.py`: অধ্যায়ের সূচিপত্র আর `৪.৩ শিরোনাম` ধরনের লাইন দেখে ভাগ করে। আইডি `<বিষয়>-<অধ্যায়>-<ক্রম>`; নতুন বিষয়ের শুরু আলাদা রাখুন (`intl`, `bn`, `eng`, `math`, `sci` …), আর `subject`, `source` বদলান।
- `clean.py in.csv out.json`: যা বদলায় তা স্ক্রিনে দেখায়; `source_id` বসায় (পাইলটে `lw-bda`), প্রতিটি উৎসের জন্য আলাদা নাম দিন।
- একই id আবার তুললে আগেরটা হালনাগাদ হয়, ডুপ্লিকেট হয় না।

প্রতিটি অংশের ঘর: `id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind (section/question/past_questions), tags (তালিকা বা "; " দিয়ে আলাদা), pages, source, source_id, text`।
