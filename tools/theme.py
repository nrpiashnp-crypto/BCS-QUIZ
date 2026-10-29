"""Put every page (except the home page, which carries its own copy) on the site theme:
the new লি logo in the header, /css/omr.css after the page's own styles, and /js/omr.js for the OMR background.
Safe to run again; tools/seo_build.py writes generated pages with the same markup."""
import os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_OLD = re.compile(r'<a href="/"><img src="/img/logo/final-onnavy-transparent\.svg" alt="[^"]*"[^>]*></a>')
LOGO = '<a href="/" aria-label="লিয়ানা বুকস"><img src="/img/logo/li-mark.svg" alt="" width="34" height="44"><span class="lgn-n">লিয়ানা বুকস</span></a>'
HEAD = '<link rel="stylesheet" href="/css/omr.css"><script src="/js/omr.js" defer></script>'

def apply(s):
    s = LOGO_OLD.sub(LOGO, s)
    if '/css/omr.css' not in s and '</head>' in s:
        s = s.replace('</head>', HEAD + '\n</head>', 1)
    return s

if __name__ == '__main__':
    n = 0
    for d, _, fs in os.walk(R):
        if '/.git' in d or 'index.html' not in fs: continue
        p = os.path.join(d, 'index.html')
        if p == os.path.join(R, 'index.html'): continue
        s = open(p, encoding='utf-8').read(); t = apply(s)
        if t != s: open(p, 'w', encoding='utf-8').write(t); n += 1
    print(n, 'pages updated')
