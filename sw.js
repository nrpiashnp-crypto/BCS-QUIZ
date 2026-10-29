/* লিয়ানা বুকস অফলাইন: একবার খোলা পাতা আর প্রশ্ন ইন্টারনেট ছাড়াও খোলে।
   পাতা (HTML) আর প্রশ্নের JSON: আগে নেটওয়ার্ক, না পেলে ক্যাশ, তাই অনলাইনে সবসময় নতুন প্রশ্ন আসে।
   ফন্ট, ছবি, js: ক্যাশ থেকে সাথে সাথে, পেছনে নতুন কপি এনে রাখে (পরের বার নতুনটা)। অন্য ডোমেইনের কিছু (যেমন analytics) ছোঁয়া হয় না।
   কিছু বদলালে VERSION বাড়ান, পুরোনো ক্যাশ মুছে যাবে। */
const VERSION='v6';
const CORE = 'core-' + VERSION, PAGES = 'pages-' + VERSION, DATA = 'data-' + VERSION;
const PRECACHE = ['/', '/exams/', '/science/', '/fonts/fonts.css',
  '/fonts/NotoSansBengali-bengali.woff2', '/fonts/NotoSansBengali-latin.woff2',
  '/fonts/TiroBangla-400-bengali.woff2', '/fonts/TiroBangla-400-latin.woff2',
  '/img/logo/li-mark.svg', '/img/logo/final-icon.svg', '/css/omr.css', '/js/omr.js', '/js/wrong.js'];
const LIMIT = {[PAGES]: 40, [DATA]: 80};

const OFFLINE = `<!doctype html><html lang="bn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ইন্টারনেট নেই · লিয়ানা বুকস</title><link rel="stylesheet" href="/fonts/fonts.css">
<body style="margin:0;font-family:'Noto Sans Bengali',system-ui,sans-serif;background:#fbfaf7;color:#1d1f21;text-align:center;padding:48px 20px">
<p style="font-family:'Tiro Bangla',serif;font-size:26px;margin:0 0 8px">ইন্টারনেট সংযোগ নেই</p>
<p style="color:#5f6366;max-width:26em;margin:0 auto 20px">এই পাতাটা আগে খোলা হয়নি, তাই অফলাইনে দেখানো যাচ্ছে না। আগে খোলা অধ্যায়গুলো ইন্টারনেট ছাড়াও চলবে।</p>
<a href="/science/" style="display:inline-block;background:#13294b;color:#fff;text-decoration:none;border-radius:10px;padding:11px 22px;font-weight:600">বিজ্ঞানের অধ্যায়গুলো</a>
</body></html>`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  const keep = [CORE, PAGES, DATA];
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(name) {
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - LIMIT[name]; i++) await c.delete(ks[i]);
}
async function networkFirst(req, name) {
  try {
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(name); await c.put(req, res.clone()); trim(name); }
    return res;
  } catch (err) {
    const hit = await caches.match(req, {ignoreSearch: req.mode === 'navigate'});
    if (hit) return hit;
    if (req.mode === 'navigate') return new Response(OFFLINE, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
    throw err;
  }
}
async function staleWhileRevalidate(req, e) {
  const hit = await caches.match(req);
  const fresh = fetch(req).then(async res => {
    if (res.ok) await (await caches.open(CORE)).put(req, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate' || req.destination === 'document') return e.respondWith(networkFirst(req, PAGES));
  if (url.pathname.endsWith('.json')) return e.respondWith(networkFirst(req, DATA));
  if (/^\/(fonts|img|js|css)\//.test(url.pathname) || req.destination === 'image') return e.respondWith(staleWhileRevalidate(req, e));
});
