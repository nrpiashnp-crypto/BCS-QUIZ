#!/usr/bin/env python3
"""হালকা রূপ (PIASH, ২০২৬-১১-১৮): কম দামি ফোনে নিজস্ব ফন্ট (Anek Bangla, ~২০০KB) না নামিয়ে ফোনের নিজের বাংলা ফন্ট।
হালকা হয় যদি: ফোনের মেমোরি ≤২GB, বা নেট ২জি/দুর্বল (<১ Mbps), বা ডেটা-সেভার চালু। বাকিরা আগের মতো পুরো রূপ।
(শুধু Android Chrome-জাতীয় ব্রাউজার এসব জানায়; iPhone ইত্যাদি সবসময় পুরো রূপ।)
পরখ: ঠিকানার শেষে ?font=lite (হালকা), ?font=full (পুরো), ?font=auto (নিজে ঠিক করা) — এই ফোনে মনে থাকে।
চালানো: python3 tools/font_mode.py  → সব HTML-এ পুরোনো দুই লাইন (ফন্ট preload + fonts.css) বদলে নিচের SNIPPET।
seo_build.py আর scripts/news/build_pages.py-র ছাঁচেও একই SNIPPET (FONT_HEAD); বদলালে তিন জায়গায় একসাথে।"""
import pathlib, sys

OLD_PRE = '<link rel="preload" href="/fonts/AnekBangla-bengali.woff2" as="font" type="font/woff2" crossorigin>'
OLD_CSS = '<link rel="stylesheet" href="/fonts/fonts.css">'
SNIPPET = ("<script>/* ফন্ট: কম দামি ফোন/ধীর নেটে হালকা রূপ (tools/font_mode.py) */!function(){var n=navigator,c=n.connection||{},"
  "l=c.saveData||/2g/.test(c.effectiveType)||c.downlink<1||n.deviceMemory<=2;try{var q=location.search.match(/[?&]font=(lite|full|auto)/);"
  "if(q)localStorage.lyFont=q[1]=='auto'?'':q[1];if(localStorage.lyFont)l=localStorage.lyFont=='lite'}catch(e){}"
  "if(l)document.documentElement.classList.add('ly-lite');document.write(l?'<link rel=\"stylesheet\" href=\"/fonts/lite.css\">':"
  "'" + OLD_PRE + OLD_CSS + "')}()</script><noscript>" + OLD_CSS + "</noscript>")

def fix(text):
    if SNIPPET in text: return text
    text = text.replace(OLD_PRE + '\n', '').replace(OLD_PRE, '')
    return text.replace(OLD_CSS, SNIPPET, 1) if OLD_CSS in text else text

if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
    n = 0
    for p in root.rglob('*.html'):
        if '.git' in p.parts: continue
        t = p.read_text(encoding='utf-8'); u = fix(t)
        if u != t: p.write_text(u, encoding='utf-8'); n += 1
    print('font_mode: বদলানো পাতা', n)
