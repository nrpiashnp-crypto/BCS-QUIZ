# কেন্দ্রীয় প্রশ্ন-আর্কাইভ

সাইটের সব প্রশ্ন এক জায়গায়: প্রতিটি প্রশ্ন একবার, একটি স্থায়ী নম্বরসহ। সাইটের পাতাগুলো
(চাকরি, বিসিএস, অধ্যায় কুইজ, চলমান নিয়োগ) এখান থেকে তৈরি হয়, আর যেকোনো নতুন সেট
একটা ফিল্টার দিয়েই বানানো যায়।

## Layout

- `q/<xx>.json` — one line per question: `"<id>": {q, o, a, e}`. The id is
  `q` + 10 hex of sha1(normalised question | sorted normalised options), so the
  same question always gets the same id, whichever paper it came from.
  Normalising keeps letters, digits, Bengali vowel signs/hasanta and the formula
  operators `+ × ÷ = < > ^ √` (and a minus that starts a number); it drops case,
  spaces, HTML tags and all other punctuation. So "হয়-" and "হয় —" are one
  question, while "কি"/"কী", "মালা"/"মালী" and "a + 1/a"/"a - 1/a" stay apart.
  Changing `norm()` changes every id: never do it once anything outside the
  archive refers to ids.
- `papers/<collection>/<name>.json` — one file per paper/page that the site
  shows. `src` = the file it builds, `kind` = `file` (JSON array) or `inline`
  (`const Q=[...]` inside an HTML page), `items` = ordered rows `{id, ...}`.
  A row carries the paper's own fields (`s`, `qn`, `x`, `t`, `p`, `v`) and,
  only where this copy differs from the archive record, its own `q/o/a/e`.
- `report.json` — counts from the last import. `conflicts.json` — copies of one
  question whose marked answers disagree; these need an answer check.

Collections: `bcs`, `bcs-subject`, `chapter` (project files
`website/অধ্যায়-কুইজ/data/`), `page` (sound, light), `jobs`, `job-science`,
`running`.

## Tools

```
python3 archive/tools/import_site.py        # site files -> archive (safe to re-run)
python3 archive/tools/build_site.py --check # archive -> compare with site, writes nothing
python3 archive/tools/build_site.py         # archive -> write every site file
python3 archive/tools/pick.py --subject বাংলা --text সমাস --n 50 --out set.json
```

## Rules

1. Uploaded new questions straight into site files? Run `import_site.py` in the
   same commit, then `build_site.py --check` must say `0 differ`.
2. Fixing a question or explanation? Edit the record in `q/`, run
   `build_site.py` (every page that shows it changes), then `--check`.
3. Never hand-edit ids. Never delete a record that a paper still uses.
4. A record is frozen at first import: if a site file is edited afterwards,
   `import_site.py` stores the edit as that paper's own `q/o/a/e` override, the
   archive record stays as it was, and a later fix to the record will NOT show
   on that paper (its override wins at build time). `report.json` counts these
   as `copies_with_own_explanation`; to make a fix global, edit the record in
   `q/` and remove the overriding field from the paper rows.
