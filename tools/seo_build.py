#!/usr/bin/env python3
"""Search-engine pages for lyannabooks.com. Run from the repo root after any upload:

    python3 tools/seo_build.py

The quiz pages (/bcs/, /jobs/, chapter quizzes) draw questions with JavaScript behind
#/ hash routes, which Google does not index as separate pages. This script writes plain
HTML pages that Google can read, one per exam, with every question, answer and
explanation visible, and a button into the timed exam:

  /bcs/<no>/        each BCS prelim paper            (from bcs/data/)
  /jobs/<id>/       each job exam with >= MIN_Q Qs   (from jobs/data/)
  /<chapter>/mcq/   each chapter quiz's questions    (from the inline `const Q=[...]`)
  /jobs/<series>/   one post's papers across years   (e.g. /jobs/bb-ad/, when >= 2 years)
  /bcs/question-solution/  every BCS prelim paper with the subject-wise mark split
  /questions/       one list linking all of the above

It also
  - adds canonical/OG tags to pages that lack them and brands chapter page titles,
  - appends a small link block (between <!--seo-links--> markers) to hub pages so
    the new pages are reachable by links, not only by the sitemap,
  - rewrites sitemap.xml (lastmod = last git commit of each page's source).

Generated folders carry a .seo marker file; never edit their index.html by hand.
"""
import glob, html, json, os, re, subprocess

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://lyannabooks.com'
FB = 'https://www.facebook.com/profile.php?id=61595898604238'  # Lyanna Books Facebook page; shown in footers and the hub-page link block
MIN_Q = 10
BN = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')
bn = lambda n: str(n).translate(BN)
K = ['ক', 'খ', 'গ', 'ঘ', 'ঙ']
MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
esc = lambda s: html.escape(str(s), quote=True)


def bdate(iso):
    y, m, d = iso.split('-')
    return f'{bn(int(d))} {MONTHS[int(m) - 1]} {bn(y)}'


def rd(p):
    return open(os.path.join(R, p), encoding='utf-8').read()


def wr(p, s):
    full = os.path.join(R, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s)


_gitdates = {}
def gitdate(path):
    if path not in _gitdates:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path], cwd=R, capture_output=True, text=True).stdout.strip()
        _gitdates[path] = out or None
    return _gitdates[path]


# ---------- shared page shell ----------
CSS = """:root{--paper:#fbfaf7;--ink:#1d1f21;--muted:#5f6366;--rule:#d9d6cf;--card:#fff;--navy:#13294b;--gold:#a8792a;--good:#1e7a46;--good-bg:#e5f3ea;--soft:#e9edf4}
@media (prefers-color-scheme:dark){:root{--paper:#15181a;--ink:#e9e7e2;--muted:#a3a7aa;--rule:#33383b;--card:#1d2124;--navy:#9db4dc;--gold:#e0b45c;--good:#6fcf97;--good-bg:#17301f;--soft:#1c2536;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 'Noto Sans Bengali',system-ui,sans-serif}
.sitebar{background:#13294b;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;gap:8px}.sitebar img{width:110px;height:auto;display:block}
.sitebar nav{display:flex;gap:2px}.sitebar nav a{color:#e6c97a;text-decoration:none;font-size:13px;font-weight:500;padding:5px 7px;border-radius:7px;white-space:nowrap}.sitebar nav a[aria-current]{background:rgba(230,201,122,.2);color:#fff}
@media(max-width:360px){.sitebar img{width:88px}.sitebar nav a{font-size:12px;padding:4px 5px}}
main{max-width:760px;margin:0 auto;padding:12px 16px 40px}a{color:var(--navy)}
.crumb{font-size:13px;color:var(--muted);margin:4px 0 10px}.crumb a{color:var(--muted)}.crumb span:before{content:' › '}
h1{font-family:'Tiro Bangla',Georgia,serif;font-weight:400;font-size:26px;line-height:1.35;margin:6px 0 8px}
h2{font-family:'Tiro Bangla',Georgia,serif;font-weight:400;font-size:20px;margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--rule)}
.lead{color:var(--muted);margin:0 0 14px}.cta{display:inline-block;background:#13294b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;margin:2px 0 8px}
.cta:hover{background:#1d3a66}.toc{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;padding:0;list-style:none;font-size:14px}.toc a{display:block;padding:3px 10px;border:1px solid var(--rule);border-radius:99px;text-decoration:none}
ol.qs{list-style:none;margin:0;padding:0}.q{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;margin:10px 0}
.qt{font-weight:600}.qt .n{color:var(--muted);margin-right:4px}.src{display:block;font-size:12.5px;font-weight:400;color:var(--muted)}
.q ul{list-style:none;margin:8px 0 0;padding:0}.q li{padding:2px 8px;border-radius:7px}.q li.ok{background:var(--good-bg);color:var(--good);font-weight:600}.q li.ok:after{content:' ✓'}
.exp{margin-top:8px;font-size:14.5px;border-top:1px dashed var(--rule);padding-top:8px}.exp b.h{color:var(--muted);font-weight:600}
.q img{max-width:100%;height:auto}.q table{border-collapse:collapse;font-size:14px}.q td,.q th{border:1px solid var(--rule);padding:2px 6px}
table.sub{border-collapse:collapse;font-size:14.5px;margin:8px 0;width:100%;max-width:480px}table.sub th,table.sub td{border-bottom:1px solid var(--rule);padding:5px 8px;text-align:left}table.sub td:last-child,table.sub th:last-child{text-align:right;white-space:nowrap}
ul.list{padding-left:18px}ul.list li{margin:3px 0}.cols{columns:2 240px;column-gap:24px}
.book{margin:28px 0 0;padding:12px 14px;border:1px solid var(--rule);border-radius:12px;background:var(--soft);font-size:14.5px}
footer{text-align:center;font-size:13px;color:var(--muted);padding:20px 16px 30px}footer a{color:var(--muted)}"""

SEC = [('/bcs/', 'বিসিএস'), ('/jobs/', 'চাকরি'), ('/science/', 'বিজ্ঞান'), ('/running/', 'চলমান')]


def page(path, title, desc, crumbs, body, current=None, img='/img/og.png', ld_extra=()):
    """path like '/bcs/50/'; crumbs = [(url|None, text)] after হোম."""
    url = SITE + path
    nav = ''.join(f'<a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>' for h, t in SEC)
    trail = [('/', 'হোম')] + crumbs
    crumb_html = '<nav class="crumb" aria-label="অবস্থান">' + ''.join(
        (f'<span><a href="{h}">{esc(t)}</a></span>' if h else f'<span>{esc(t)}</span>') if i else f'<a href="{h}">{esc(t)}</a>'
        for i, (h, t) in enumerate(trail)) + '</nav>'
    ld = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': t, 'item': SITE + (h or path)} for i, (h, t) in enumerate(trail)]}
    return f"""<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#13294b">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="লিয়ানা বুকস">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}{img}">
<meta property="og:locale" content="bn_BD">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/logo/final-icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/logo/apple-touch-icon.png">
<link rel="preload" href="/fonts/NotoSansBengali-bengali.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts/fonts.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' + chr(10) for x in ld_extra)}<style>{CSS}</style>
</head>
<body>
<!-- Generated by tools/seo_build.py from the quiz data. Do not edit by hand. -->
<div class="sitebar"><a href="/"><img src="/img/logo/final-onnavy-transparent.svg" alt="লিয়ানা বুকস" width="110" height="33"></a><nav aria-label="সাইটের অংশ">{nav}</nav></div>
<main>
{crumb_html}
{body}
<p class="book">বিসিএস আর চাকরির পরীক্ষার বিজ্ঞান এক বইয়ে, বিগত প্রশ্ন বিশ্লেষণ করে লেখা: <a href="/book/">লিয়ানা বিসিএস বিজ্ঞান বই সম্পর্কে জানুন</a></p>
</main>
<footer><a href="/">লিয়ানা বুকস</a> · <a href="/questions/">সব প্রশ্ন ও সমাধান</a> · <a href="/exams/">পরীক্ষা দিন</a> · <a href="/book/">বই</a> · <a href="{FB}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path fill="currentColor" d="M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.9.3-1.6 1.6-1.6h1.7V3.9a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.3h2.8V22h3.4Z"/></svg>ফেসবুক পেজ</a></footer>
</body>
</html>
"""


def qblock(q, i, show_src=True):
    opts = ''.join(f'<li{" class=\"ok\"" if j == q["a"] else ""}>{K[j] if j < len(K) else j + 1}. {o}</li>' for j, o in enumerate(q['o']))
    src = q.get('s', '') if show_src else ''
    extra = []
    if src: extra.append(esc(src))
    if q.get('x'): extra.append(esc(q['x']))
    srch = f'<span class="src">{" · ".join(extra)}</span>' if extra else ''
    ans = q['o'][q['a']] if 0 <= q['a'] < len(q['o']) else ''
    exp = f'<div class="exp"><b class="h">উত্তর: {K[q["a"]] if q["a"] < len(K) else ""}. {ans}</b><br>{q["e"]}</div>' if q.get('e') else ''
    return f'<li class="q" id="q{i}"><div class="qt"><span class="n">{bn(i)}.</span> {q["q"]}{srch}</div><ul>{opts}</ul>{exp}</li>'


def by_subject(Q, show_src=False):
    """Questions grouped under h2 per subject, in original order; returns (body, toc)."""
    groups, order = {}, []
    for i, q in enumerate(Q, 1):
        s = q.get('s') or 'অন্যান্য'
        if s not in groups: groups[s] = []; order.append(s)
        groups[s].append(qblock(q, i, show_src))
    if len(order) == 1:
        return '<ol class="qs">' + ''.join(groups[order[0]]) + '</ol>', ''
    toc = '<ul class="toc">' + ''.join(f'<li><a href="#s{k}">{esc(s)} ({bn(len(groups[s]))})</a></li>' for k, s in enumerate(order, 1)) + '</ul>'
    body = ''.join(f'<h2 id="s{k}">{esc(s)}</h2><ol class="qs">{"".join(groups[s])}</ol>' for k, s in enumerate(order, 1))
    return body, toc


def plain(t):
    t = re.sub(r'<br\s*/?>', ' ', str(t))
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t))).strip()


def quiz_ld(name, Q, path, about):
    """schema.org Quiz (Google's Education Q&A markup): each question with its correct answer."""
    parts = []
    for q in Q:
        if not (0 <= q['a'] < len(q['o'])): continue
        qt, at = plain(q['q']), plain(q['o'][q['a']])
        if qt and at:
            parts.append({'@type': 'Question', 'eduQuestionType': 'Flashcard', 'text': qt,
                          'acceptedAnswer': {'@type': 'Answer', 'text': at}})
    return {'@context': 'https://schema.org', '@type': 'Quiz', 'name': name, 'url': SITE + path, 'inLanguage': 'bn',
            'about': {'@type': 'Thing', 'name': about}, 'educationalLevel': 'চাকরির প্রস্তুতি',
            'hasPart': parts}


def subject_table(exams, load):
    """Average number of questions per subject over the given (full) papers -> table html."""
    tot, order = {}, []
    for e in exams:
        for q in load(e):
            s = q.get('s') or 'অন্যান্য'
            if s not in tot: tot[s] = 0; order.append(s)
            tot[s] += 1
    if not tot: return ''
    n = len(exams)
    rows = sorted(order, key=lambda s: -tot[s])
    avg = lambda s: bn(f'{tot[s] / n:.1f}'.rstrip('0').rstrip('.'))
    return ('<table class="sub"><thead><tr><th>বিষয়</th><th>প্রতি পরীক্ষায় গড় প্রশ্ন</th></tr></thead><tbody>' +
            ''.join(f'<tr><td>{esc(s)}</td><td>{avg(s)}</td></tr>' for s in rows) + '</tbody></table>')


generated = []   # (path, source file for lastmod)

# ---------- BCS prelim papers ----------
bcat = json.loads(rd('bcs/data/catalog.json'))['exams']
bcs_links = []
for e in bcat:
    no = e['no']
    path = f'/bcs/{no}/'
    name = e['title']                                   # ৫০তম বিসিএস প্রিলিমিনারি
    bcs_links.append((path, f'{name} ({bn(e["year"])})', e))
for path, label, e in bcs_links:
    Q = json.loads(rd(f'bcs/data/e/{e["id"]}.json'))
    no, name = e['no'], e['title']
    when = bdate(e['date']) if e.get('date') else bn(e['year'])
    title = f'{name} প্রশ্ন ও সমাধান ({no}th BCS Question Solution) · লিয়ানা বুকস'
    desc = (f'{name} পরীক্ষার ({when}) {bn(len(Q))}টি প্রশ্নের সঠিক উত্তর আর বিস্তারিত ব্যাখ্যা। '
            f'আসল পরীক্ষার মতো {bn(e["time"])} মিনিট সময় আর −০.৫ নেগেটিভ মার্কিংসহ ফ্রি অনলাইন মডেল টেস্ট।')
    body, toc = by_subject(Q)
    others = '<ul class="list cols">' + ''.join(
        f'<li>{"<b>" + esc(l) + "</b>" if p == path else f"<a href=\"{p}\">{esc(l)}</a>"}</li>' for p, l, _ in bcs_links) + '</ul>'
    html_body = f"""<h1>{esc(name)}: প্রশ্ন ও সমাধান</h1>
<p class="lead">পরীক্ষা হয়েছে {when}। এখানে {bn(len(Q))}টি প্রশ্ন, সঠিক উত্তর আর প্রতিটির ব্যাখ্যা আছে। চাইলে আগে নিজে পরীক্ষা দিয়ে দেখুন: সময় {bn(e['time'])} মিনিট, প্রতিটি ভুলে −০.৫।</p>
<a class="cta" href="/bcs/#/x/{e['id']}">সময় ধরে পরীক্ষা দিন →</a>
{toc}
{body}
<h2>অন্যান্য বিসিএস প্রিলির প্রশ্ন ও সমাধান</h2>
<p><a href="/bcs/question-solution/">১০ম থেকে {bn(bcat[0]['no'])}তম: সব বিসিএস প্রিলির প্রশ্ন আর বিষয়ভিত্তিক মানবণ্টন</a></p>
{others}"""
    wr(path.strip('/') + '/index.html', page(path, title, desc, [('/bcs/', 'বিসিএস প্রিলি'), (None, name)], html_body, '/bcs/',
                                             ld_extra=[quiz_ld(f'{name} প্রশ্ন ও সমাধান', Q, path, 'বিসিএস প্রিলিমিনারি পরীক্ষা')]))
    generated.append((path, f'bcs/data/e/{e["id"]}.json'))

# ---------- job exams ----------
jcat = json.loads(rd('jobs/data/catalog.json'))['exams']
CATN = {'gb': 'সরকারি ব্যাংক', 'pb': 'বেসরকারি ব্যাংক', 'gov': 'সরকারি চাকরি', 'psc': 'পিএসসি নন-ক্যাডার', 'teacher': 'শিক্ষক নিয়োগ ও নিবন্ধন', 'bar': 'বার কাউন্সিল'}
HASH = {'gb': 'bank/gb', 'pb': 'bank/pb', 'gov': 'gov', 'psc': 'psc', 'teacher': 'teacher', 'bar': 'bar'}
CAT_ORDER = ['gb', 'pb', 'gov', 'psc', 'teacher', 'bar']


def sname(e):
    return f'{e["orgbn"]} {e["postbn"]} {"পরীক্ষা" if "নিবন্ধন" in e["postbn"] or e["cat"] == "bar" else "নিয়োগ পরীক্ষা"}'


def jname(e):
    if e['year'] == 'misc':
        return f'{e["orgbn"]}: বিভিন্ন নিয়োগ পরীক্ষার প্রশ্ন'
    post = e.get('title') or e['postbn']
    return f'{e["orgbn"]} {post} {"পরীক্ষা" if "নিবন্ধন" in post or e["cat"] == "bar" else "নিয়োগ পরীক্ষা"} {bn(e["year"])}'


jobs_ok = [e for e in jcat if e['n'] >= MIN_Q and e['cat'] in CATN and os.path.exists(os.path.join(R, f'jobs/data/e/{e["id"]}.json'))]
_jq = {}
def jq(e):
    if e['id'] not in _jq: _jq[e['id']] = json.loads(rd(f'jobs/data/e/{e["id"]}.json'))
    return _jq[e['id']]

# the same post's papers across years -> one hub page, slug = latest paper's id without the year
series, sgroups = {}, {}
for e in jobs_ok:
    if e['year'] != 'misc': sgroups.setdefault((e['org'], e['postbn'], e['cat']), []).append(e)
for k, L in sgroups.items():
    if len(L) < 2: continue
    L.sort(key=lambda x: (x['year'], x.get('date', ''), x['id']), reverse=True)
    slug = re.sub(r'-\d{4}', '', L[0]['id'])
    assert slug not in series and not any(x['id'] == slug for x in jcat) and slug not in ('data', 'tools'), slug
    series[slug] = L
    for x in L: x['series'] = slug
for e in jobs_ok:
    path = f'/jobs/{e["id"]}/'
    Q = jq(e)
    name = jname(e)
    kind = 'ব্যাংক জব' if e['cat'] in ('gb', 'pb') else CATN[e['cat']]
    when = bdate(e['date']) if e.get('date') else (bn(e['year']) if e['year'] != 'misc' else '')
    part = '' if e.get('full') else ' (প্রাপ্ত প্রশ্ন)'
    title = f'{name}: প্রশ্ন ও সমাধান · লিয়ানা বুকস'
    desc = (f'{name}{part}: {bn(len(Q))}টি এমসিকিউ প্রশ্নের সঠিক উত্তর আর বিস্তারিত ব্যাখ্যা। '
            f'{kind} প্রস্তুতির জন্য ফ্রি অনলাইন মডেল টেস্ট, সময় আর নেগেটিভ মার্কিংসহ।')
    note = f' {esc(e["note"])}।' if e.get('note') else ''
    body, toc = by_subject(Q)
    same = [x for x in jobs_ok if x['org'] == e['org'] and x['id'] != e['id']]
    near = [x for x in jobs_ok if x['cat'] == e['cat'] and x['org'] != e['org']][:30]
    rel = ''
    if e.get('series'):
        rel += f'<h2>{esc(sname(e))}: সব বছর</h2><p><a href="/jobs/{e["series"]}/">{esc(sname(e))}: {bn(len(series[e["series"]]))} বছরের প্রশ্ন আর বিষয়ভিত্তিক মানবণ্টন একসঙ্গে</a></p>'
        same = [x for x in same if x.get('series') != e['series']]
    if same:
        rel += f'<h2>{esc(e["orgbn"])}: অন্যান্য পরীক্ষা</h2><ul class="list">' + ''.join(f'<li><a href="/jobs/{x["id"]}/">{esc(jname(x))}</a></li>' for x in same) + '</ul>'
    rel += f'<h2>আরও {esc(CATN[e["cat"]])} পরীক্ষার প্রশ্ন ও সমাধান</h2><ul class="list">' + ''.join(f'<li><a href="/jobs/{x["id"]}/">{esc(jname(x))}</a></li>' for x in near) + '</ul>'
    html_body = f"""<h1>{esc(name)}: প্রশ্ন ও সমাধান</h1>
<p class="lead">{(f'পরীক্ষা হয়েছে {when}। ' if when else '')}{bn(len(Q))}টি প্রশ্ন, সঠিক উত্তর আর প্রতিটির ব্যাখ্যা।{note} চাইলে আগে নিজে পরীক্ষা দিয়ে দেখুন।</p>
<a class="cta" href="/jobs/#/x/{e['id']}">সময় ধরে পরীক্ষা দিন →</a>
{toc}
{body}
{rel}"""
    crumbs = [('/jobs/', 'চাকরির প্রশ্নব্যাংক'), (f'/jobs/#/{HASH[e["cat"]]}', CATN[e['cat']]), (None, name)]
    # hash URLs are not separate pages for search engines; keep the visible crumb, point the schema at /jobs/
    out = page(path, title, desc, crumbs, html_body, '/jobs/', ld_extra=[quiz_ld(f'{name}: প্রশ্ন ও সমাধান', Q, path, f'{kind} প্রস্তুতি')])
    out = out.replace(f'"item": "{SITE}/jobs/#/{HASH[e["cat"]]}"', f'"item": "{SITE}/jobs/"')
    wr(path.strip('/') + '/index.html', out)
    generated.append((path, f'jobs/data/e/{e["id"]}.json'))

# ---------- one post across years ----------
for slug, L in series.items():
    path = f'/jobs/{slug}/'
    e0 = L[0]
    nm = sname(e0)
    ys = sorted({x['year'] for x in L})
    span = f'{bn(ys[0])}-{bn(ys[-1])}'
    nq = sum(len(jq(x)) for x in L)
    full = [x for x in L if x.get('full')] or L
    title = f'{nm}: প্রশ্ন ও সমাধান, সব বছর ({span}) · লিয়ানা বুকস'
    desc = (f'{nm}: {bn(len(L))} বছরের ({span}) {bn(nq)}টি প্রশ্ন, সঠিক উত্তর আর ব্যাখ্যা। '
            f'কোন বিষয় থেকে কতটি প্রশ্ন আসে তার হিসাব আর ফ্রি অনলাইন মডেল টেস্ট।')
    dup = len({x['year'] for x in L}) < len(L)
    rows = ''.join(
        f'<li><a href="/jobs/{x["id"]}/">{esc(jname(x)) if dup else bn(x["year"]) + " সালের প্রশ্ন ও সমাধান"}</a> <span class="src" style="display:inline">'
        f'{(bdate(x["date"]) + " · ") if x.get("date") else ""}{bn(len(jq(x)))}টি প্রশ্ন{"" if x.get("full") else " (প্রাপ্ত)"}</span></li>' for x in L)
    tbl = subject_table(full, jq)
    basis = (f'নিচের হিসাব {bn(len(full))}টি পূর্ণ প্রশ্নপত্র থেকে।' if any(x.get('full') for x in L)
             else '')
    near = [x for x in series if x != slug and series[x][0]['cat'] == e0['cat']]
    rel = (f'<h2>আরও {esc(CATN[e0["cat"]])} পরীক্ষা: সব বছর একসঙ্গে</h2><ul class="list">' +
           ''.join(f'<li><a href="/jobs/{x}/">{esc(sname(series[x][0]))}</a></li>' for x in near) + '</ul>') if near else ''
    body = f"""<h1>{esc(nm)}: প্রশ্ন ও সমাধান, সব বছর</h1>
<p class="lead">{esc(e0['orgbn'])}-এর {esc(e0['postbn'])} পদের {bn(len(L))}টি পরীক্ষার ({span}) প্রশ্ন এক জায়গায়। প্রতিটি পাতায় সঠিক উত্তর, ব্যাখ্যা আর সময় ধরে পরীক্ষা দেওয়ার সুযোগ আছে। মোট {bn(nq)}টি প্রশ্ন।</p>
<h2>সাল অনুযায়ী প্রশ্ন ও সমাধান</h2>
<ul class="list">{rows}</ul>
<h2>কোন বিষয় থেকে কত প্রশ্ন আসে</h2>
<p>{basis + ' ' if basis else ''}প্রস্তুতির সময় কোন বিষয়ে কতটা জোর দেবেন, তা ঠিক করতে কাজে লাগবে।</p>
{tbl}
<a class="cta" href="/jobs/{e0['id']}/">সাম্প্রতিক পরীক্ষার প্রশ্ন দেখুন →</a>
{rel}"""
    crumbs = [('/jobs/', 'চাকরির প্রশ্নব্যাংক'), (f'/jobs/#/{HASH[e0["cat"]]}', CATN[e0['cat']]), (None, nm)]
    out = page(path, title, desc, crumbs, body, '/jobs/', ld_extra=[{
        '@context': 'https://schema.org', '@type': 'ItemList', 'name': f'{nm}: প্রশ্ন ও সমাধান',
        'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/jobs/{x["id"]}/', 'name': jname(x)} for i, x in enumerate(L)]}])
    out = out.replace(f'"item": "{SITE}/jobs/#/{HASH[e0["cat"]]}"', f'"item": "{SITE}/jobs/"')
    wr(path.strip('/') + '/index.html', out)
    generated.append((path, f'jobs/data/e/{e0["id"]}.json'))

# ---------- all BCS prelim papers ----------
_bq = {}
def bq(e):
    if e['id'] not in _bq: _bq[e['id']] = json.loads(rd(f'bcs/data/e/{e["id"]}.json'))
    return _bq[e['id']]
new = [e for e in bcat if e['no'] >= 35 and 'বিশেষ' not in e['title']]   # 200-mark pattern since the 35th BCS; special BCS papers differ
lo, hi = min(e['no'] for e in bcat), max(e['no'] for e in bcat)
path = '/bcs/question-solution/'
nq = sum(len(bq(e)) for e in bcat)
rows = ''.join(f'<li><a href="/bcs/{e["no"]}/">{esc(e["title"])}</a> <span class="src" style="display:inline">'
               f'{bdate(e["date"]) if e.get("date") else bn(e["year"])} · {bn(len(bq(e)))}টি প্রশ্ন</span></li>' for e in bcat)
body = f"""<h1>বিসিএস প্রিলিমিনারি প্রশ্ন ও সমাধান: {bn(lo)}তম থেকে {bn(hi)}তম</h1>
<p class="lead">{bn(len(bcat))}টি বিসিএস প্রিলিমিনারি পরীক্ষার {bn(nq)}টি প্রশ্ন, সঠিক উত্তর আর প্রতিটির ব্যাখ্যা। প্রতিটি পরীক্ষা আসল সময় আর −০.৫ নেগেটিভ মার্কিংসহ ফ্রি দেওয়া যায়।</p>
<a class="cta" href="/bcs/">সময় ধরে পরীক্ষা দিন →</a>
<h2>কোন বিষয় থেকে কত প্রশ্ন আসে</h2>
<p>৩৫তম বিসিএস থেকে প্রিলি ২০০ নম্বরের, ১০টি বিষয়ে। নিচের গড় {bn(len(new))}টি সাধারণ বিসিএস প্রশ্নপত্র ({bn(min(e['no'] for e in new))}তম-{bn(max(e['no'] for e in new))}তম, বিশেষ বিসিএস বাদে) থেকে গোনা।</p>
{subject_table(new, bq)}
<h2>সব বিসিএস প্রিলির প্রশ্ন ও সমাধান</h2>
<ul class="list">{rows}</ul>"""
wr('bcs/question-solution/index.html', page(path, f'বিসিএস প্রিলি প্রশ্ন ও সমাধান: {bn(lo)}তম-{bn(hi)}তম (BCS Question Solution) · লিয়ানা বুকস',
   f'{bn(lo)}তম থেকে {bn(hi)}তম বিসিএস প্রিলিমিনারির {bn(nq)}টি প্রশ্ন, সঠিক উত্তর আর ব্যাখ্যা। কোন বিষয় থেকে কত প্রশ্ন আসে তার হিসাব আর ফ্রি অনলাইন মডেল টেস্ট।',
   [('/bcs/', 'বিসিএস প্রিলি'), (None, 'সব প্রশ্ন ও সমাধান')], body, '/bcs/', ld_extra=[{
       '@context': 'https://schema.org', '@type': 'ItemList', 'name': 'বিসিএস প্রিলিমিনারি প্রশ্ন ও সমাধান',
       'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/bcs/{e["no"]}/', 'name': e['title']} for i, e in enumerate(bcat)]}]))
generated.append((path, f'bcs/data/catalog.json'))

# ---------- chapter quizzes ----------
sci = rd('science/index.html')
chapters = re.findall(r'<a class="tile" href="/([a-z-]+)/"><span class="ic">([^<]+)</span><span class="tx"><b>([^<]+)</b>', sci)
TYPE = {'b': 'বিসিএস', 'x': 'অন্যান্য চাকরির পরীক্ষা', 'l': 'সম্ভাব্য প্রশ্ন'}
ch_links = []
for slug, no, name in chapters:
    src = rd(f'{slug}/index.html')
    m = re.search(r'^const Q=(\[.*\]);\s*$', src, re.M)
    if not m: continue
    ch_links.append((slug, no, name, json.loads(m.group(1))))
for slug, no, name, Q in ch_links:
    path = f'/{slug}/mcq/'
    nb = sum(q.get('t') == 'b' for q in Q)
    title = f'{name}: বিসিএস ও চাকরির পরীক্ষার বিজ্ঞান MCQ, উত্তর ও ব্যাখ্যা · লিয়ানা বুকস'
    desc = (f'সাধারণ বিজ্ঞান, অধ্যায় {no} {name}: বিগত বিসিএস{f" ({bn(nb)}টি)" if nb else ""} আর ব্যাংক ও অন্যান্য চাকরির পরীক্ষার '
            f'{bn(len(Q))}টি প্রশ্ন, সঠিক উত্তর আর বইয়ের মতো ব্যাখ্যা। ফ্রি অনলাইন পরীক্ষাও আছে।')
    groups = [(t, [q for q in Q if q.get('t') == t]) for t in ('b', 'x', 'l')]
    groups = [(t, g) for t, g in groups if g]
    i, parts = 0, []
    for t, g in groups:
        items = []
        for q in g:
            i += 1
            q2 = dict(q)
            if q.get('p'): q2['x'] = f'বইয়ের অনুচ্ছেদ {q["p"]}'
            items.append(qblock(q2, i, show_src=(t != 'l')))
        parts.append(f'<h2 id="{t}">{TYPE[t]} ({bn(len(g))})</h2><ol class="qs">{"".join(items)}</ol>')
    toc = '<ul class="toc">' + ''.join(f'<li><a href="#{t}">{TYPE[t]} ({bn(len(g))})</a></li>' for t, g in groups) + '</ul>' if len(groups) > 1 else ''
    others = '<ul class="list cols">' + ''.join(
        f'<li>{"<b>" if s == slug else f"<a href=\"/{s}/mcq/\">"}{n}. {esc(nm)}{"</b>" if s == slug else "</a>"}</li>' for s, n, nm, _ in ch_links) + '</ul>'
    html_body = f"""<h1>{esc(name)}: বিসিএস ও চাকরির পরীক্ষার প্রশ্ন</h1>
<p class="lead">সাধারণ বিজ্ঞান, অধ্যায় {no}। বিগত বিসিএস আর অন্যান্য চাকরির পরীক্ষায় এই অধ্যায় থেকে আসা {bn(len(Q))}টি প্রশ্ন, সঠিক উত্তর আর ব্যাখ্যা একসঙ্গে। আগে নিজে যাচাই করতে চাইলে সময় আর নেগেটিভ মার্কিংসহ পরীক্ষা দিন।</p>
<a class="cta" href="/{slug}/">এই অধ্যায়ের পরীক্ষা দিন →</a>
{toc}
{''.join(parts)}
<h2>অন্যান্য অধ্যায়</h2>
{others}"""
    wr(f'{slug}/mcq/index.html', page(path, title, desc, [('/science/', 'বিজ্ঞান'), (f'/{slug}/', name), (None, 'প্রশ্ন ও ব্যাখ্যা')], html_body, '/science/',
                                      ld_extra=[quiz_ld(f'{name}: বিজ্ঞান MCQ', Q, path, f'সাধারণ বিজ্ঞান: {name}')]))
    generated.append((path, f'{slug}/index.html'))

# ---------- /questions/ : everything in one list ----------
grp = {}
for e in jobs_ok: grp.setdefault(e['cat'], []).append(e)
sec = [f'<h2 id="bcs">বিসিএস প্রিলিমিনারি ({bn(len(bcs_links))})</h2><p><a href="/bcs/question-solution/">সব বিসিএস প্রিলি একসঙ্গে, বিষয়ভিত্তিক মানবণ্টনসহ</a></p><ul class="list cols">' +
       ''.join(f'<li><a href="{p}">{esc(l)}</a></li>' for p, l, _ in bcs_links) + '</ul>',
       f'<h2 id="science">সাধারণ বিজ্ঞান: অধ্যায় অনুযায়ী ({bn(len(ch_links))})</h2><ul class="list cols">' +
       ''.join(f'<li><a href="/{s}/mcq/">{n}. {esc(nm)}</a></li>' for s, n, nm, _ in ch_links) + '</ul>']
sec.append(f'<h2 id="series">একই পদের সব বছরের প্রশ্ন একসঙ্গে ({bn(len(series))})</h2><ul class="list">' +
           ''.join(f'<li><a href="/jobs/{k}/">{esc(sname(L[0]))}</a> ({bn(len(L))} বছর)</li>' for k, L in sorted(series.items(), key=lambda kv: -len(kv[1]))) + '</ul>')
for c in CAT_ORDER:
    L = sorted(grp.get(c, []), key=lambda x: (x['orgbn'], x['year']), reverse=False)
    if L:
        sec.append(f'<h2 id="{c}">{CATN[c]} ({bn(len(L))})</h2><ul class="list">' + ''.join(f'<li><a href="/jobs/{x["id"]}/">{esc(jname(x))}</a></li>' for x in L) + '</ul>')
nall = len(bcs_links) + len(ch_links) + len(jobs_ok)
qbody = f"""<h1>সব প্রশ্ন ও সমাধান</h1>
<p class="lead">বিসিএস প্রিলিমিনারি, ব্যাংক জব, সরকারি চাকরি আর পিএসসি নন-ক্যাডারের বিগত প্রশ্ন: সঠিক উত্তর আর ব্যাখ্যাসহ {bn(nall)}টি পাতা। প্রতিটি পাতা থেকে সময় ধরে ফ্রি মডেল টেস্টও দেওয়া যায়।</p>
<ul class="toc"><li><a href="#bcs">বিসিএস</a></li><li><a href="#science">বিজ্ঞান</a></li><li><a href="#series">সব বছর একসঙ্গে</a></li><li><a href="#gb">সরকারি ব্যাংক</a></li><li><a href="#pb">বেসরকারি ব্যাংক</a></li><li><a href="#gov">সরকারি চাকরি</a></li><li><a href="#psc">পিএসসি</a></li><li><a href="#teacher">শিক্ষক নিবন্ধন</a></li></ul>
{''.join(sec)}"""
wr('questions/index.html', page('/questions/', 'বিসিএস, ব্যাংক জব ও সরকারি চাকরির প্রশ্ন ও সমাধান · লিয়ানা বুকস',
   'বিসিএস প্রিলি (১০ম-৫০তম), ব্যাংক জব, সরকারি চাকরি আর পিএসসি নন-ক্যাডারের বিগত প্রশ্ন, সঠিক উত্তর আর ব্যাখ্যা। ফ্রি এমসিকিউ মডেল টেস্ট।',
   [(None, 'সব প্রশ্ন ও সমাধান')], qbody))
generated.append(('/questions/', 'questions/index.html'))
for d in [p.strip('/') for p, _ in generated]:
    wr(d + '/.seo', '')

# remove generated folders that no longer have a source (exam renamed or dropped)
keep = {p.strip('/') for p, _ in generated}
for mk in glob.glob(os.path.join(R, '*', '.seo')) + glob.glob(os.path.join(R, '*', '*', '.seo')):
    d = os.path.relpath(os.path.dirname(mk), R)
    if d not in keep:
        for f in ('index.html', '.seo'):
            if os.path.exists(os.path.join(R, d, f)): os.remove(os.path.join(R, d, f))
        try: os.rmdir(os.path.join(R, d))
        except OSError: pass

# ---------- tags on the hand-made pages ----------
gen_dirs = keep
hand = []
for f in sorted(glob.glob(os.path.join(R, '**', 'index.html'), recursive=True)):
    d = os.path.relpath(os.path.dirname(f), R)
    d = '' if d == '.' else d
    if d in gen_dirs or d.split('/')[0] in ('fonts', 'img', 'js', 'qr', 'tools', '_mock') or '/data' in f: continue
    hand.append(d)

chap_names = {s: nm for s, _, nm, _ in ch_links}
LINKS = ('<!--seo-links--><nav style="max-width:760px;margin:24px auto 0;padding:0 16px 24px;text-align:center;font:13px/1.8 \'Noto Sans Bengali\',system-ui,sans-serif">'
         '{extra}<a href="/questions/" style="color:inherit;opacity:.75">সব প্রশ্ন ও সমাধান</a>{fb}</nav><!--/seo-links-->')
FB_LINK = (' · <a href="' + FB + '" target="_blank" rel="noopener" style="color:inherit;opacity:.75">'
           '<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" aria-hidden=\"true\" style=\"vertical-align:-2px;margin-right:4px\"><path fill=\"currentColor\" d=\"M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.9.3-1.6 1.6-1.6h1.7V3.9a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.3h2.8V22h3.4Z\"/></svg>ফেসবুক পেজ</a>')
for d in hand:
    p = (d + '/index.html') if d else 'index.html'
    s = rd(p)
    if 'name="robots" content="noindex"' in s: continue
    url = f'{SITE}/{d + "/" if d else ""}'
    o = s
    slug = d.split('/')[0]
    if d in chap_names and 'লিয়ানা' not in s.split('</title>')[0]:
        s = re.sub(r'<title>[^<]*</title>', f'<title>{esc(chap_names[d])}: বিসিএস বিজ্ঞান MCQ ও ফ্রি অনলাইন পরীক্ষা · লিয়ানা বুকস</title>', s, count=1)
    if 'rel="canonical"' not in s:
        s = re.sub(r'(<meta name="description"[^>]*>)', r'\1\n<link rel="canonical" href="' + url + '">', s, count=1)
    if 'og:image' not in s:
        tm = re.search(r'<title>([^<]*)</title>', s); dm = re.search(r'<meta name="description" content="([^"]*)"', s)
        og = (f'\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="লিয়ানা বুকস">' if 'og:type' not in s else '')
        og += (f'\n<meta property="og:title" content="{tm.group(1)}">' if 'og:title' not in s and tm else '')
        og += (f'\n<meta property="og:description" content="{dm.group(1)}">' if 'og:description' not in s and dm else '')
        og += (f'\n<meta property="og:url" content="{url}">' if 'og:url' not in s else '')
        og += f'\n<meta property="og:image" content="{SITE}/img/og.png">'
        s = s.replace(f'<link rel="canonical" href="{url}">', f'<link rel="canonical" href="{url}">' + og, 1)
    extra = ''
    if d in chap_names:
        extra = f'<a href="/{d}/mcq/" style="color:inherit;opacity:.75">{esc(chap_names[d])}: সব প্রশ্ন, উত্তর ও ব্যাখ্যা একসঙ্গে পড়ুন</a> · '
    elif d == 'bcs':
        extra = '<a href="/questions/#bcs" style="color:inherit;opacity:.75">বিসিএস প্রিলির প্রশ্ন ও সমাধান পড়ুন</a> · '
    elif d == 'jobs':
        extra = '<a href="/questions/#gb" style="color:inherit;opacity:.75">ব্যাংক ও সরকারি চাকরির প্রশ্ন ও সমাধান পড়ুন</a> · '
    s = re.sub(r'<!--seo-links-->.*?<!--/seo-links-->\n?', '', s, flags=re.S)
    # a plain "লিয়ানা বুকস · lyannabooks.com" footer would sit right above this block as a second footer line;
    # drop it and put the name at the start of the block instead (pages with a fuller footer, like home, keep theirs)
    s = re.sub(r'\n?<footer>\s*(?:<p>)?[^<]*(?:<a href="/">)?lyannabooks\.com(?:</a>)?[^<]*(?:</p>)?\s*</footer>', '', s)
    if not re.search(r'<footer\b[^>]*>(?:(?!</footer>).)*lyannabooks\.com', s, flags=re.S):
        extra = '<a href="/" style="color:inherit;opacity:.75">লিয়ানা বুকস</a> · ' + extra
    block = LINKS.format(extra=extra, fb='' if FB in s else FB_LINK)
    s = s.replace('</body>', block + '\n</body>', 1)
    if s != o: wr(p, s)

# ---------- sitemap ----------
urls = []
for d in hand:
    p = (d + '/index.html') if d else 'index.html'
    if 'content="noindex"' in rd(p): continue
    urls.append((f'{SITE}/{d + "/" if d else ""}', gitdate(p)))
for path, srcf in generated:
    urls.append((SITE + path, gitdate(srcf)))
pri = lambda u: (u != SITE + '/', u.count('/'), u)
xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, lm in sorted(urls, key=lambda x: pri(x[0])):
    xml.append(f'  <url><loc>{u}</loc>' + (f'<lastmod>{lm}</lastmod>' if lm else '') + '</url>')
xml.append('</urlset>')
wr('sitemap.xml', '\n'.join(xml) + '\n')
print(f'bcs {len(bcs_links)} · jobs {len(jobs_ok)}/{len(jcat)} · series {len(series)} · chapters {len(ch_links)} · hand-made pages {len(hand)} · sitemap {len(urls)} urls')
