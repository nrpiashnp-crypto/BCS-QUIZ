/* ঐচ্ছিক লগইন আর ড্যাশবোর্ডের সার্ভার: Cloudflare Pages Functions + D1, Google দিয়ে লগইন।
   শুধু /api/* এখানে আসে (_routes.json), বাকি সাইট আগের মতো স্ট্যাটিক।
   লাগবে: Pages প্রজেক্টে D1 বাইন্ডিং "DB" আর এনভায়রনমেন্ট ভেরিয়েবল GOOGLE_CLIENT_ID। টেবিল প্রথম লগইনে নিজে তৈরি হয়।
   GET  /api/me        → {cid, user|null}
   POST /api/login     {credential: Google ID token} → সেশন কুকি
   POST /api/logout
   GET  /api/att       → নিজের সব পরীক্ষার ফল
   GET  /api/att/one?k= → একটা ফল আর তার প্রতিটি উত্তর (উত্তরপত্র)
   POST /api/att       {a:[ফল…]} → জমা (একই k দুবার এলে একবারই থাকে)
   POST /api/delete    → নিজের সব তথ্য মুছে যায়
   GET/POST /api/goal  → নিজের লক্ষ্যের পরীক্ষা আর মাস (নিচে goal())
   প্রতিটি উত্তর (ব্যবহারকারী ধরে, কাস্টম প্ল্যানের জন্য): /api/att-এর প্রতিটি ফলে qd = [[প্রশ্ন-id, দাগানো বিকল্প (ফাঁকা −1)], …]
   → attq টেবিল (uid, k, ts, qd "id:বিকল্প,id:বিকল্প"), প্রতি পরীক্ষায় এক সারি (দিনে ১ লাখ সারি-লেখার সীমা মাথায় রেখে)
   একই সারিতে tm (প্রতিটি দাগের সময়, শুরুর পর দশমাংশ-সেকেন্ড) আর m (পাতা আড়ালে থাকা, পর্দা): শিক্ষার্থীর পর্যালোচনা /admin/review/
   অ্যাডমিন (ADMIN_EMAILS): GET /api/admin/learners → সব ব্যবহারকারী, কয়টা পরীক্ষা, কয়টায় উত্তরের তালিকা আছে
                           GET /api/admin/att?uid=… বা ?email=… → ওই ব্যবহারকারীর সব ফল আর উত্তর (পাতা /admin/learners/)
   প্রশ্ন ধরে উত্তরের হিসাব: POST /api/att-এর সঙ্গে {q:[[প্রশ্ন-id, ঠিক 1 / ভুল 0], …]} (শুধু লগইন করা ব্যবহারকারী) → qstat টেবিল
   (qid, দেখানো n, ঠিক ok, শেষ দেখা last), কার উত্তর সেটা রাখা হয় না। GET /api/qstat → {ts, rows:[[qid,n,ok,last]]}, সবার জন্য,
   ৬ ঘণ্টা ক্যাশে থাকে; Lyanna_data-র tools/pull_signals.py সপ্তাহে একবার এটা archive/signals/difficulty.json-এ আনে
   টপিক লাইব্রেরি (শুধু অ্যাডমিন: এনভায়রনমেন্ট ভেরিয়েবল ADMIN_EMAILS-এ থাকা ইমেইল, কমা দিয়ে আলাদা; লেখা থাকে শুধু D1-এ, রিপোতে নয়):
   GET  /api/lib/stats              → বিষয়/উৎস ধরে গণনা, বেশি ব্যবহৃত ট্যাগ
   GET  /api/lib/search?q=&subject=&kind=&chapter=&tag=&offset=  → মিলে যাওয়া অংশ (পুরো লেখা নয়, এক টুকরো)
   POST /api/lib/get    {ids:[…]}   → পুরো লেখাসহ অংশগুলো
   POST /api/lib/import {topics:[…]} → একই id আবার এলে হালনাগাদ, ডুপ্লিকেট নয় (এক বারে ১৫টি)
   POST /api/lib/remove {ids:[…]}
   search-এ &topic=<id>: ওই টপিক আর তার নিচের সব টপিক (sci-light → sci-light-refraction …)
   এমসিকিউ ব্যাংক আর টপিক তালিকা D1-এ থাকে না: অ্যাডমিন পাতা Lyanna_data-র library-mcq.json.gz ফাইলটা ব্রাউজারেই খোলে আর খোঁজে।
   ফ্রি প্ল্যানে দিনে ১ লাখ সারি লেখা যায়; ৫৪ হাজার প্রশ্ন D1-এ তুলতে গিয়ে ২০২৬-১০-৩০-এ সীমা পার হয়েছিল। পুরোনো lib_mcq/lib_taxonomy
   টেবিল D1-এ পড়ে আছে, কোড আর পড়ে না
   বন্ধুকে চ্যালেঞ্জ (লগইন ছাড়া; পাতা /c/<id> → challenge/index.html):
   POST /api/ch {name,title,src,qs:[{q,o,a,e}],picks,sec} বা {from:<id>,name} (আগে ওই চ্যালেঞ্জ দেওয়া লাগে) → {id}
   GET  /api/ch/<id>      → প্রশ্ন (উত্তর ছাড়া), চ্যালেঞ্জদাতার নম্বর, সেরা তিনজন, আগে দিয়ে থাকলে নিজের র‍্যাংক (mine)
   POST /api/ch/<id>/start → পরীক্ষা শুরুর সময় (সময় সার্ভারে গোনা হয়)
   POST /api/ch/<id>/try {name,picks,sec} → নম্বর, উত্তর-ব্যাখ্যা, র‍্যাংক
   প্রশ্নে ভুল জানানো (লগইন লাগে না; বোতাম js/report.js):
   POST /api/report {qid?, page, q, kind: ans|exp|q|other, note?} → {ok}
   অ্যাডমিন: GET /api/admin/reports?st=new|done|all → তালিকা (পাতা /admin/reports/); POST /api/admin/reports {ids:[…], st}
            GET /api/admin/qver?days= → চাবি/ব্যাখ্যা বদলের খাতা (qver_log; সংস্করণ-চিহ্ন, নিচে qVer)
            GET /api/admin/repq → ভুল জানানো প্রশ্নের id (পর্যালোচনায় কঠিন/সহজ থেকে বাদ)
   ব্যাখ্যা বুঝেছি/বুঝিনি: POST /api/fb (নিচে "বুঝেছি / বুঝিনি" অংশ), অ্যাডমিন GET /api/admin/fb
   যাচাইয়ের কাজ LY Quiz & Sheets-এর; Lyanna_data-তে টেনে নেওয়ার জন্য একই GET-এর JSON।
   পাইলট ব্যাচ (/pilot/<id>/, /admin/pilot/): নিচে "পাইলট ব্যাচ" অংশের মাথায় সব পথ।
   নিজের পরিকল্পনা, অবস্থা-যাচাই (/plan/<সেট>/, /admin/diag/): নিচে "নিজের পরিকল্পনা" অংশের মাথায় সব পথ।
   শিক্ষকের সাপ্তাহিক রপ্তানি (GET /api/export/teacher, রপ্তানির চাবি দিয়ে): নিচে "শিক্ষকের সাপ্তাহিক রপ্তানি" অংশে। */
const COOKIE = 'lb_s', AGE = 180 * 86400;
const MAX_BATCH = 300, MAX_ROWS = 3000;

const QSTAT = 'CREATE TABLE IF NOT EXISTS qstat(qid TEXT PRIMARY KEY, n INTEGER NOT NULL, ok INTEGER NOT NULL, last INTEGER)';
const MAX_QA = 600, QID = /^q[0-9a-f]{10}$/;
// একজন ব্যবহারকারী দিনে (ঢাকার সময় নয়, UTC দিন) এর বেশি ফল আর প্রশ্নের হিসাব জমা দিতে পারে না;
// এক অনুরোধে একই প্রশ্ন সর্বোচ্চ QA_SAME বার গোনা হয়, যাতে একজন একা কোনো প্রশ্নের কঠিনতা উল্টে দিতে না পারে
const ATT_PER_DAY = 3000, QA_PER_DAY = 3000, QA_SAME = 2;
let qstatReady = false, quotaReady = false;

// দৈনিক গণনা users টেবিলেই থাকে (একটা সারি হালনাগাদ, আলাদা টেবিল নয়)। আগে পড়ে দেখা, তারপর শুধু নেওয়া অংশ যোগ:
// সীমা পার হওয়া অনুরোধে কিছুই লেখা হয় না, তাই বারবার চেষ্টা করেও কোটা খরচ করা যায় না
async function quota(db, uid, a, q) {
  if (!quotaReady) {
    for (const col of ['qday', 'an', 'qn']) try { await db.prepare('ALTER TABLE users ADD COLUMN ' + col + ' INTEGER').run(); } catch (e) { /* আগেই আছে */ }
    quotaReady = true;
  }
  const day = Math.floor(Date.now() / 86400e3);
  const r = await db.prepare('SELECT qday, an, qn FROM users WHERE id = ?').bind(uid).first();
  const an = r && r.qday === day ? r.an || 0 : 0, qn = r && r.qday === day ? r.qn || 0 : 0;
  const att = !a || an + a <= ATT_PER_DAY;
  // ফল আটকালে প্রশ্নের হিসাবও এখন নয় (ফোনে দুটোই থাকে, পরে একসঙ্গে যায়)
  const qa = att && q > 0 && qn + q <= QA_PER_DAY;
  const addA = att ? a : 0, addQ = qa ? q : 0;
  if (addA || addQ) await db.prepare('UPDATE users SET an = ?, qn = ?, qday = ? WHERE id = ?').bind(an + addA, qn + addQ, day, uid).run();
  return {att, qa};
}

/* সংস্করণ-চিহ্ন (LY Teacher-এর চাহিদা, Lyanna_data teacher/export-spec.md): প্রতিটি দাগের সঙ্গে কোন উত্তর-চাবি আর কোন ব্যাখ্যা
   দেখানো হয়েছিল। kv = FNV-1a(সঠিক ক্রম + \u0001 + বিকল্পগুলো \u0001 দিয়ে জোড়া), ev = FNV-1a(ব্যাখ্যার লেখা e, যেমন আছে);
   দুটোই ৮ অক্ষরের hex, একসঙ্গে "kv.ev"। একই হিসাব js/account.js (সাধারণ পাতা) আর tools/build_qver.py (বদলের খাতা)-তে;
   একটায় বদলালে তিনটাতেই। পাইলট আর নির্ণয়-পরীক্ষার প্রশ্ন আবার তোলা হলে কী বদলাল তা qver_log-এ। */
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const qVer = q => fnv(String(q.a) + '\u0001' + (q.o || []).join('\u0001')) + '.' + fnv(q.e || '');
const QVER_RX = /^[0-9a-f]{8}\.[0-9a-f]{8}$/;
const QVLOG = 'CREATE TABLE IF NOT EXISTS qver_log(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, src TEXT NOT NULL, qid TEXT NOT NULL, what TEXT NOT NULL, old TEXT, new TEXT)';
// আগের আর নতুন প্রশ্ন মিলিয়ে বদলের সারি: key (সঠিক উত্তর), opt (বিকল্প), exp (ব্যাখ্যা), q (প্রশ্নের লেখা); প্রথমবার তোলায় কিছু নয়
function qverDiff(src, qid, a, b, ts) {
  if (!a) return [];
  const out = [], kv = q => qVer(q).slice(0, 8), add = (what, o, n) => { if (o !== n) out.push([ts, src, qid, what, o, n]); };
  if (a.a !== b.a) add('key', kv(a), kv(b)); else if ((a.o || []).join('\u0001') !== (b.o || []).join('\u0001')) add('opt', kv(a), kv(b));
  add('exp', fnv(a.e || ''), fnv(b.e || ''));
  add('q', fnv(a.q || ''), fnv(b.q || ''));
  return out;
}
async function qverLog(db, src, table, key, list) {
  if (!list.length) return 0;
  await db.prepare(QVLOG).run();
  const ids = list.map(x => x[0]), old = new Map();
  const {results} = await db.prepare(`SELECT qid, d FROM ${table} WHERE ${key} = ? AND qid IN (${ids.map(() => '?').join(',')})`).bind(src.slice(src.indexOf(':') + 1), ...ids).all();
  for (const r of results) try { old.set(r.qid, JSON.parse(r.d)); } catch (e) { /* ভাঙা সারি */ }
  const now = Date.now(), rows = list.flatMap(([id, d]) => qverDiff(src, id, old.get(id), d, now));
  if (rows.length) { const st = db.prepare('INSERT INTO qver_log(ts, src, qid, what, old, new) VALUES(?,?,?,?,?,?)'); await db.batch(rows.map(r => st.bind(...r))); }
  return rows.length;
}
// সাধারণ পাতার চিহ্ন: qd-র সমান লম্বা, প্রতিটি "kv.ev" বা খালি (পুরোনো পাতা); না মিললে null
function cleanQv(qv, qd) {
  if (typeof qv !== 'string' || !qd || qv.length > 6000) return null;
  const a = qv.split(',');
  if (a.length !== qd.split(',').length || !a.every(x => x === '' || QVER_RX.test(x))) return null;
  return a.some(x => x) ? qv : null;
}

const ATTQ = 'CREATE TABLE IF NOT EXISTS attq(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, qd TEXT NOT NULL, PRIMARY KEY(uid, k))';
const MAX_QD = 300;
let attqReady = false;
// tm = প্রতিটি দাগের সময় (শুরুর পর দশমাংশ-সেকেন্ড, qd-র ক্রমে, ফাঁকায় খালি), m = {v, hid, hn, w, app, tmx, dev} (js/account.js); পুরোনো সারিতে NULL
async function attqTable(db) {
  if (attqReady) return;
  await db.prepare(ATTQ).run();
  for (const col of ['tm', 'm', 'qv']) try { await db.prepare('ALTER TABLE attq ADD COLUMN ' + col + ' TEXT').run(); } catch (e) { /* আগেই আছে */ }
  attqReady = true;
}
// সময়ের তালিকা: qd-র সমান লম্বা, প্রতিটি ০-১০৮০০০ দশমাংশ-সেকেন্ড (৩ ঘণ্টা) বা খালি; না মিললে null (সময় ছাড়া উত্তর তবু জমা হয়)
function cleanTm(tm, qd) {
  if (typeof tm !== 'string' || !qd || tm.length > 4000) return null;
  const a = tm.split(','), n = qd.split(',').length;
  if (a.length !== n) return null;
  for (const x of a) if (x !== '' && !(/^\d{1,6}$/.test(x) && +x <= 108000)) return null;
  return a.some(x => x !== '') ? tm : null;
}
function cleanMeta(m, req) {
  if (!m || typeof m !== 'object') return null;
  const n = (x, hi) => Number.isFinite(x) && x >= 0 ? Math.min(Math.round(x), hi) : 0;
  const o = {v: n(m.v, 99), hid: n(m.hid, 36000), hn: n(m.hn, 999), w: n(m.w, 9999), app: m.app === 1 ? 1 : 0, dev: diagMeta(req, {}).dev};
  if (['old', 'none', 'n', 'order'].includes(m.tmx)) o.tmx = m.tmx;
  return JSON.stringify(o);
}
const splitQd = qd => qd.split(',').map(x => { const i = x.lastIndexOf(':'); return [x.slice(0, i), +x.slice(i + 1)]; });

// একটা পরীক্ষার প্রতিটি প্রশ্ন: "id:বিকল্প" (ফাঁকা −1); id না মিললে বা তালিকা খালি হলে null
function cleanQd(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const x of list.slice(0, MAX_QD)) {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || !QID.test(x[0])) continue;
    const p = Number.isInteger(x[1]) && x[1] >= -1 && x[1] <= 9 ? x[1] : -1;
    out.push(x[0] + ':' + p);
  }
  return out.length ? out.join(',') : null;
}

function qaCount(list) {
  const by = new Map();
  for (const x of (Array.isArray(list) ? list : []).slice(0, MAX_QA)) {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || !QID.test(x[0])) continue;
    const c = by.get(x[0]) || [0, 0];
    if (c[0] >= QA_SAME) continue;
    c[0]++; if (x[1] === 1 || x[1] === true) c[1]++;
    by.set(x[0], c);
  }
  return by;
}

// একই প্রশ্ন এক অনুরোধে কয়েকবার এলে একসঙ্গে যোগ হয়, তাই প্রতিটা প্রশ্নে একটাই সারি লেখা
async function saveQa(db, by) {
  if (!by.size) return 0;
  if (!qstatReady) { await db.prepare(QSTAT).run(); qstatReady = true; }
  const now = Date.now(), st = db.prepare('INSERT INTO qstat(qid, n, ok, last) VALUES(?,?,?,?) ON CONFLICT(qid) DO UPDATE SET n = n + excluded.n, ok = ok + excluded.ok, last = excluded.last');
  await db.batch([...by].map(([q, c]) => st.bind(q, c[0], c[1], now)));
  return by.size;
}

async function qstat(req, db) {
  const key = new Request(new URL('/api/qstat', req.url).toString()), cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;
  await db.prepare(QSTAT).run();
  const {results} = await db.prepare('SELECT qid, n, ok, last FROM qstat ORDER BY qid').all();
  const res = json({ts: Date.now(), rows: results.map(r => [r.qid, r.n, r.ok, r.last])}, 200, {'Cache-Control': 'public, max-age=21600'});
  await cache.put(key, res.clone());
  return res;
}

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT, pic TEXT, created INTEGER, seen INTEGER)',
  'CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS att(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, c TEXT, t TEXT, p TEXT, s REAL, n INTEGER, ok INTEGER, no INTEGER, sec INTEGER, sb TEXT, PRIMARY KEY(uid, k))',
  'CREATE INDEX IF NOT EXISTS att_ts ON att(uid, ts)'
];
const LIB_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS lib_sources(id TEXT PRIMARY KEY, title TEXT, subject TEXT, exam TEXT, updated INTEGER)',
  'CREATE TABLE IF NOT EXISTS lib_topics(id TEXT PRIMARY KEY, source_id TEXT, subject TEXT, exam TEXT, chapter INTEGER, chapter_title TEXT, section_no TEXT, section_title TEXT, parent_section TEXT, kind TEXT, pages TEXT, source TEXT, tags TEXT, text TEXT, updated INTEGER, topic_ids TEXT, mcq_ids TEXT)',
  'CREATE TABLE IF NOT EXISTS lib_tags(topic_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(topic_id, tag))',
  'CREATE INDEX IF NOT EXISTS lib_tags_tag ON lib_tags(tag)',
  'CREATE INDEX IF NOT EXISTS lib_topics_sub ON lib_topics(subject, chapter)'
];
// D1-এর সীমা: ফ্রি প্ল্যানে এক অনুরোধে ৫০টি কোয়েরি, এক কোয়েরিতে ১০০টি প্যারামিটার
const LIB_PAGE = 30, LIB_IMPORT = 15, LIB_IDS = 90;

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers}
});
const cookie = (v, age) => `${COOKIE}=${v}; Path=/api; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;

const enc = new TextEncoder();
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// Google-এর পাবলিক চাবি এক ঘণ্টা মনে রাখা হয়
let KEYS = null, KEYS_AT = 0;
async function googleKeys() {
  if (KEYS && Date.now() - KEYS_AT < 3600e3) return KEYS;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('certs');
  KEYS = (await r.json()).keys; KEYS_AT = Date.now();
  return KEYS;
}

// Google ID token (RS256 JWT) যাচাই: স্বাক্ষর, কার জন্য (aud), কে দিয়েছে (iss), মেয়াদ
async function verifyGoogle(token, cid) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const dec = s => JSON.parse(new TextDecoder().decode(b64u(s)));
  let head, body;
  try { head = dec(parts[0]); body = dec(parts[1]); } catch (e) { return null; }
  if (head.alg !== 'RS256') return null;
  const jwk = (await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) return null;
  const now = Date.now() / 1000;
  if (body.aud !== cid) return null;
  if (body.iss !== 'accounts.google.com' && body.iss !== 'https://accounts.google.com') return null;
  if (!(body.exp > now) || !body.sub) return null;
  return body;
}

async function sessionUser(req, db) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]+)'));
  if (!m) return null;
  return db.prepare('SELECT u.id, u.name, u.email, u.pic FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ? AND s.exp > ?')
    .bind(await sha(m[1]), Date.now()).first();
}

const pub = u => ({name: u.name || '', email: u.email || '', pic: u.pic || ''});

// শিক্ষার্থীর লক্ষ্যের পরীক্ষা আর আনুমানিক মাস (/account/-এ নিজে বলেন; পর্যালোচনা /admin/review/ এটা দিয়ে শুরু করে)
// GET /api/goal → {goal, gdate} · POST /api/goal {goal, gdate: "YYYY-MM" | ""}
const GOALS = ['bcs', 'pb', 'subreg', 'bank', 'primary', 'ntrca', 'other'];
let goalReady = false;
async function goalCols(db) {
  if (goalReady) return;
  for (const col of ['goal', 'gdate']) try { await db.prepare('ALTER TABLE users ADD COLUMN ' + col + ' TEXT').run(); } catch (e) { /* আগেই আছে */ }
  goalReady = true;
}
async function goal(req, db, u) {
  await goalCols(db);
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const g = GOALS.includes(b.goal) ? b.goal : null;
    const d = typeof b.gdate === 'string' && /^20[2-4]\d-(0[1-9]|1[0-2])$/.test(b.gdate) ? b.gdate : null;
    await db.prepare('UPDATE users SET goal = ?, gdate = ? WHERE id = ?').bind(g, g ? d : null, u.id).run();
    return json({ok: true, goal: g, gdate: g ? d : null});
  }
  const r = await db.prepare('SELECT goal, gdate FROM users WHERE id = ?').bind(u.id).first();
  return json({goal: r && r.goal || null, gdate: r && r.gdate || null}, 200, {'Cache-Control': 'no-store'});
}
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : null;
const num = v => typeof v === 'number' && isFinite(v) ? v : null;

// ব্রাউজার থেকে আসা একটা ফল: যা দরকার শুধু সেটুকু, মাপমতো কেটে
function clean(a) {
  if (!a || typeof a !== 'object') return null;
  const k = str(a.k, 120), ts = num(a.ts), n = num(a.n);
  if (!k || !ts || !n || n < 1 || n > 1000) return null;
  let sb = null;
  if (a.sb && typeof a.sb === 'object') {
    const o = {};
    for (const [key, v] of Object.entries(a.sb).slice(0, 30)) if (key && Array.isArray(v) && v.length === 2) o[key.slice(0, 60)] = [num(v[0]) || 0, num(v[1]) || 0];
    sb = JSON.stringify(o);
  }
  return [k, Math.round(ts), str(a.c, 10), str(a.t, 160), str(a.p, 200), num(a.s), Math.round(n),
    num(a.ok), num(a.no), num(a.sec), sb];
}

async function login(req, env, db) {
  const cid = env.GOOGLE_CLIENT_ID;
  if (!cid) return json({error: 'setup'}, 503);
  const {credential} = await req.json().catch(() => ({}));
  const g = await verifyGoogle(credential, cid);
  if (!g) return json({error: 'token'}, 401);
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  // যাচাই না করা ইমেইল রাখা হয় না, কারণ অ্যাডমিন চেনা হয় ইমেইল দিয়ে (ADMIN_EMAILS)
  const now = Date.now(), name = str(g.name, 80) || '', email = g.email_verified === true || g.email_verified === 'true' ? str(g.email, 120) || '' : '', pic = str(g.picture, 300) || '';
  await db.prepare('INSERT INTO users(sub, email, name, pic, created, seen) VALUES(?,?,?,?,?,?) ON CONFLICT(sub) DO UPDATE SET email=excluded.email, name=excluded.name, pic=excluded.pic, seen=excluded.seen')
    .bind(g.sub, email, name, pic, now, now).run();
  const u = await db.prepare('SELECT id, name, email, pic FROM users WHERE sub = ?').bind(g.sub).first();
  const raw = new Uint8Array(32); crypto.getRandomValues(raw);
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE exp < ?').bind(now),
    db.prepare('INSERT INTO sessions(token, uid, exp) VALUES(?,?,?)').bind(await sha(token), u.id, now + AGE * 1000)
  ]);
  return json({user: pub(u)}, 200, {'Set-Cookie': cookie(token, AGE)});
}

// ---------- টপিক লাইব্রেরি ----------
const isAdmin = (u, env) => !!u && !!u.email &&
  String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean).includes(u.email.toLowerCase());
const nfc = v => typeof v === 'string' ? v.normalize('NFC').trim() : '';

// Lyanna_data/taxonomy-র টপিক আইডি (যেমন sci-light-refraction); এখনো খোঁজায় লাগে না, পরে দুই ব্যাংক এটা দিয়েই মিলবে
const topicIds = v => {
  const a = [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\s;,]+/)).map(String).filter(x => /^[a-z]+(-[a-z0-9]+)*$/.test(x)))].slice(0, 20);
  return a.length ? '; ' + a.join('; ') + '; ' : null;
};

// '; sci-light; ' মেলে sci-light আর sci-light-…-এ, কিন্তু sci-lightning-এ নয়
const topicWhere = "(instr(topic_ids, '; ' || ? || '; ') > 0 OR instr(topic_ids, '; ' || ? || '-') > 0)";

function libClean(t) {
  if (!t || typeof t !== 'object') return null;
  const id = nfc(t.id).slice(0, 80), text = nfc(t.text);
  if (!/^[A-Za-z0-9._-]+$/.test(id) || !text) return null;
  let tags = Array.isArray(t.tags) ? t.tags : String(t.tags || '').split(/\s*;\s*/);
  tags = [...new Set(tags.map(x => nfc(String(x)).slice(0, 160)).filter(Boolean))].slice(0, 40);
  const source = nfc(t.source).slice(0, 200);
  return {
    id, text: text.slice(0, 200000), tags, source,
    source_id: (nfc(t.source_id) || id.split('-')[0]).slice(0, 80),
    subject: nfc(t.subject).slice(0, 80), exam: nfc(t.exam).slice(0, 80),
    chapter: t.chapter !== '' && t.chapter != null && Number.isFinite(+t.chapter) ? Math.round(+t.chapter) : null,
    chapter_title: nfc(t.chapter_title).slice(0, 200), section_no: nfc(t.section_no).slice(0, 30),
    section_title: nfc(t.section_title).slice(0, 300), parent_section: nfc(t.parent_section).slice(0, 300),
    kind: nfc(t.kind).slice(0, 30) || 'section', pages: nfc(t.pages).slice(0, 30), topic_ids: topicIds(t.topic_ids),
    // Lyanna_data ইউনিটের সাথে জোড়া এমসিকিউ (archive q-id), এক্সপোর্টে লেখার পরেই আসে
    mcq_ids: (Array.isArray(t.mcq_ids) ? t.mcq_ids : String(t.mcq_ids || '').split(/[\s;,]+/)).map(String).filter(x => /^[a-z0-9]{6,40}$/.test(x)).slice(0, 60).join(';') || null
  };
}

async function libImport(req, db) {
  const body = await req.json().catch(() => ({}));
  const rows = (Array.isArray(body.topics) ? body.topics : []).slice(0, LIB_IMPORT).map(libClean).filter(Boolean);
  if (!rows.length) return json({ok: true, saved: 0});
  const now = Date.now(), st = [];
  const up = db.prepare(`INSERT INTO lib_topics(id, source_id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags, text, updated, topic_ids, mcq_ids)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, subject=excluded.subject, exam=excluded.exam,
    chapter=excluded.chapter, chapter_title=excluded.chapter_title, section_no=excluded.section_no, section_title=excluded.section_title,
    parent_section=excluded.parent_section, kind=excluded.kind, pages=excluded.pages, source=excluded.source, tags=excluded.tags, text=excluded.text, updated=excluded.updated, topic_ids=excluded.topic_ids, mcq_ids=excluded.mcq_ids`);
  const src = db.prepare('INSERT INTO lib_sources(id, title, subject, exam, updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, exam=excluded.exam, updated=excluded.updated');
  const seen = new Set();
  st.push(db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(r => r.id)));
  for (const r of rows) {
    // tags কলামে দুই পাশে '; ' রাখা হয়, তাই '; সুন্দরবন; ' খুঁজে পুরো ট্যাগ মেলানো যায়
    st.push(up.bind(r.id, r.source_id, r.subject, r.exam, r.chapter, r.chapter_title, r.section_no, r.section_title, r.parent_section,
      r.kind, r.pages, r.source, '; ' + r.tags.join('; ') + '; ', r.text, now, r.topic_ids, r.mcq_ids));
    if (r.tags.length) st.push(db.prepare('INSERT OR IGNORE INTO lib_tags(topic_id, tag) VALUES' + r.tags.map(() => '(?,?)').join(','))
      .bind(...r.tags.flatMap(t => [r.id, t])));
    if (!seen.has(r.source_id)) { seen.add(r.source_id); st.push(src.bind(r.source_id, r.source.replace(/,?\s*অধ্যায়.*$/, ''), r.subject, r.exam, now)); }
  }
  await db.batch(st);
  return json({ok: true, saved: rows.length});
}

// প্রতিটি শব্দ শিরোনাম/ট্যাগ/লেখার কোথাও থাকতে হবে; শিরোনাম আর ট্যাগে মিললে আগে আসে
async function libSearch(url, db) {
  const p = k => nfc(url.searchParams.get(k) || '');
  const words = p('q').split(/\s+/).filter(Boolean).slice(0, 6);
  const off = Math.max(0, Math.min(5000, parseInt(p('offset')) || 0));
  const where = [], args = [], score = [], sargs = [];
  for (const w of words) {
    const l = w.toLowerCase();
    where.push("(instr(lower(section_title), ?) > 0 OR instr(lower(parent_section), ?) > 0 OR instr(lower(tags), ?) > 0 OR instr(lower(text), ?) > 0)");
    args.push(l, l, l, l);
    score.push("(CASE WHEN instr(lower(section_title), ?) > 0 THEN 10 ELSE 0 END + CASE WHEN instr(lower(tags), ?) > 0 THEN 6 ELSE 0 END + CASE WHEN instr(lower(parent_section), ?) > 0 THEN 3 ELSE 0 END + CASE WHEN instr(lower(text), ?) > 0 THEN 1 ELSE 0 END)");
    sargs.push(l, l, l, l);
  }
  if (p('q') && words.length > 1) {
    score.push("(CASE WHEN instr(lower(section_title), ?) > 0 THEN 15 ELSE 0 END)");
    sargs.push(words.join(' ').toLowerCase());
  }
  for (const [k, col] of [['subject', 'subject'], ['kind', 'kind'], ['source', 'source_id']]) if (p(k)) { where.push(col + ' = ?'); args.push(p(k)); }
  if (p('chapter')) { where.push('chapter = ?'); args.push(parseInt(p('chapter')) || 0); }
  if (p('tag')) { where.push('id IN (SELECT topic_id FROM lib_tags WHERE tag = ?)'); args.push(p('tag')); }
  if (p('topic')) { where.push(topicWhere); args.push(p('topic'), p('topic')); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sc = score.length ? score.join(' + ') : '0';
  const total = (await db.prepare(`SELECT COUNT(*) n FROM lib_topics ${w}`).bind(...args).first()).n;
  const {results} = await db.prepare(`SELECT id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags, mcq_ids,
      length(text) len, substr(text, 1, 6000) head, ${sc} score FROM lib_topics ${w} ORDER BY score DESC, subject, chapter, id LIMIT ? OFFSET ?`)
    .bind(...sargs, ...args, LIB_PAGE, off).all();
  const lw = words.map(x => x.toLowerCase());
  return json({total, offset: off, items: results.map(r => {
    const {head, tags, ...o} = r;
    // প্রথম যে শব্দটা লেখায় মেলে তার আশেপাশের টুকরো
    let at = -1; for (const x of lw) { at = head.toLowerCase().indexOf(x); if (at >= 0) break; }
    const a = Math.max(0, at - 120);
    return {...o, mcq_ids: (o.mcq_ids || '').split(';').filter(Boolean), tags: tags.split('; ').filter(Boolean), snippet: (a ? '…' : '') + head.slice(a, a + 360).replace(/\s+/g, ' ') + '…'};
  })});
}

async function libStats(db) {
  await db.batch(LIB_SCHEMA.map(s => db.prepare(s)));
  const q = s => db.prepare(s).all().then(r => r.results);
  const [subjects, sources, tags, kinds] = await Promise.all([
    q('SELECT subject, COUNT(*) n, COUNT(DISTINCT chapter) ch FROM lib_topics GROUP BY subject ORDER BY n DESC'),
    q('SELECT s.id, s.title, s.subject, s.exam, COUNT(t.id) n FROM lib_sources s LEFT JOIN lib_topics t ON t.source_id = s.id GROUP BY s.id ORDER BY s.subject, s.id'),
    q('SELECT tag, COUNT(*) n FROM lib_tags GROUP BY tag HAVING n > 1 ORDER BY n DESC LIMIT 60'),
    q('SELECT kind, COUNT(*) n FROM lib_topics GROUP BY kind ORDER BY n DESC')
  ]);
  return json({subjects, sources, tags, kinds});
}

// topic_ids কলাম "; a; b; " রূপে
const splitIds = v => String(v || '').split('; ').filter(Boolean);

async function lib(path, req, url, env, db, u) {
  if (!u) return json({error: 'login'}, 401);
  if (!isAdmin(u, env)) return json({error: 'admin'}, 403);
  const m = req.method;
  if (path === 'lib/stats' && m === 'GET') return libStats(db);
  try { return await libRoute(path, m, req, url, db); }
  catch (e) {
    // টেবিল এখনো তৈরি হয়নি: একবার তৈরি করে আবার চেষ্টা (stats পাতা খুললেই তৈরি হয়, তাই সাধারণত লাগে না)
    const msg = String(e && e.message);
    // পরে যোগ হওয়া কলাম (আগের টেবিলে নেই): একবার যোগ করে আবার চেষ্টা
    const col = msg.match(/no such column: (mcq_ids)|has no column named (mcq_ids)/i);
    if (col) { await db.prepare('ALTER TABLE lib_topics ADD COLUMN mcq_ids TEXT').run().catch(() => {}); return await libRoute(path, m, req, url, db); }
    if (!/no such table/i.test(msg)) throw e;
    await db.batch(LIB_SCHEMA.map(s => db.prepare(s)));
    return await libRoute(path, m, req, url, db);
  }
}

async function libRoute(path, m, req, url, db) {
  if (path === 'lib/search' && m === 'GET') return libSearch(url, db);
  if (path === 'lib/import' && m === 'POST') return libImport(req.clone(), db);
  const ids = m === 'POST' ? await req.clone().json().then(b => (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, LIB_IDS)).catch(() => []) : [];
  if (path === 'lib/get' && m === 'POST') {
    if (!ids.length) return json({items: []});
    const {results} = await db.prepare(`SELECT * FROM lib_topics WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const by = Object.fromEntries(results.map(r => [r.id, {...r, tags: r.tags.split('; ').filter(Boolean), topic_ids: splitIds(r.topic_ids), mcq_ids: (r.mcq_ids || '').split(';').filter(Boolean)}]));
    return json({items: ids.map(i => by[i]).filter(Boolean)});
  }
  if (path === 'lib/remove' && m === 'POST') {
    if (ids.length) {
      const qs = ids.map(() => '?').join(',');
      await db.batch([db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${qs})`).bind(...ids), db.prepare(`DELETE FROM lib_topics WHERE id IN (${qs})`).bind(...ids),
        db.prepare('DELETE FROM lib_sources WHERE id NOT IN (SELECT DISTINCT source_id FROM lib_topics)')]);
    }
    return json({ok: true, removed: ids.length});
  }
  return json({error: 'not found'}, 404);
}

// ---------- বন্ধুকে চ্যালেঞ্জ (লগইন লাগে না) ----------
// নম্বর সার্ভারেই গোনা হয়; নেগেটিভ নেই: নম্বর = সঠিক উত্তরের সংখ্যা। সময়ও সার্ভার গোনে (প্রশ্ন খোলা থেকে জমা পর্যন্ত)।
// প্রশ্নগুলো পাতার "উত্তর ও ব্যাখ্যা" থেকে আসে (js/challenge.js), তাই যেকোনো পরীক্ষা থেকেই চ্যালেঞ্জ বানানো যায়।
const CH_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS ch(id TEXT PRIMARY KEY, ts INTEGER, name TEXT, title TEXT, src TEXT, n INTEGER, mins INTEGER, ok INTEGER, sec INTEGER, picks TEXT, qs TEXT, iph TEXT, parent TEXT)',
  'CREATE INDEX IF NOT EXISTS ch_iph ON ch(iph, ts)',
  'CREATE TABLE IF NOT EXISTS ch_try(cid TEXT NOT NULL, ts INTEGER, name TEXT, ok INTEGER, sec INTEGER, picks TEXT, iph TEXT, PRIMARY KEY(cid, iph))',
  'CREATE INDEX IF NOT EXISTS ch_try_rank ON ch_try(cid, ok, sec)',
  'CREATE TABLE IF NOT EXISTS ch_start(cid TEXT NOT NULL, iph TEXT NOT NULL, ts INTEGER, PRIMARY KEY(cid, iph))'
];
// ch_try.ip (শুধু আইপির হ্যাশ) পরে যোগ হয়েছে; পুরোনো টেবিলে একবার কলাম বসে
let CH_READY = false;
async function chSetup(db) {
  if (CH_READY) return;
  await db.batch(CH_SCHEMA.map(s => db.prepare(s)));
  try { await db.prepare('ALTER TABLE ch_try ADD COLUMN ip TEXT').run(); } catch (e) { /* আগেই আছে */ }
  try { await db.prepare('ALTER TABLE ch_start ADD COLUMN ip TEXT').run(); } catch (e) { /* আগেই আছে */ }
  for (const col of ['ref', 'idx']) try { await db.prepare('ALTER TABLE ch ADD COLUMN ' + col + ' TEXT').run(); } catch (e) { /* আগেই আছে */ }
  // সীমা গোনার সূচি: নইলে প্রতিটা গণনা পুরো টেবিল পড়ে
  await db.batch(CH_INDEX.map(s => db.prepare(s)));
  CH_READY = true;
}
// আইপি ধরে গোনার সূচি (নইলে প্রতিটা গণনা পুরো টেবিল পড়ে)। সবার মিলিয়ে দৈনিক গণনা আলাদা ছোট টেবিলে (দিনে এক সারি),
// কারণ D1 সূচির প্রতিটা ঘরকেও এক সারি লেখা ধরে, আর বড় সারির গণনা প্রতিবার অনেক সারি পড়ে
const CH_INDEX = [
  'CREATE INDEX IF NOT EXISTS ch_start_ip ON ch_start(ip, ts)',
  'CREATE INDEX IF NOT EXISTS ch_try_ip ON ch_try(ip, ts)',
  'CREATE TABLE IF NOT EXISTS ch_day(k TEXT PRIMARY KEY, n INTEGER NOT NULL)'
];
// সবার মিলিয়ে আজকের গণনা এক বাড়ায়; সীমা পার হলে কিছু লেখে না আর false দেয়
async function chDay(db, kind, cap) {
  const k = kind + ':' + Math.floor(Date.now() / 86400e3);
  const r = await db.prepare('INSERT INTO ch_day(k, n) VALUES(?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n').bind(k, cap).first();
  return !!r;
}
// এক আইপি থেকে ঘণ্টায় ৩০টা আর দিনে ৬০টা চ্যালেঞ্জ; একটা চ্যালেঞ্জে এক আইপির ৩টা আর মোট ১০০০টা চেষ্টা বোর্ডে ওঠে
const CH_MAX_Q = 200, CH_MAX_BYTES = 600000, CH_PER_HOUR = 30, CH_PER_DAY_IP = 60, CH_IP_TRIES = 3, CH_MAX_TRIES = 1000;
// সব আইপি মিলিয়ে দিনে এতগুলোর বেশি চ্যালেঞ্জ জমা হয় না, যাতে আইপি বদলে বদলে কেউ D1-এর দৈনিক লেখার কোটা শেষ করতে না পারে।
// এক আইপির দৈনিক সীমা আলাদা থাকায় একজন একা এই মোট সীমা শেষ করে অন্যদের আটকাতে পারে না
const CH_PER_DAY_ALL = 3000;
// লগইন ছাড়া "শুরু" আর "জমা": এক আইপি থেকে ঘণ্টায় এতগুলো, আর সবার মিলিয়ে দিনে এতগুলোর বেশি সারি লেখা হয় না
// আইপির সীমা ঢিলা, কারণ মোবাইল নেটে হাজারো মানুষ একই আইপি ভাগ করেন; আসল বাঁধ সবার মিলিয়ে দৈনিক সীমা
// (সীমায় পৌঁছালে দিনে মোটামুটি: শুরু ৫০০০×৩ + জমা ৫০০০×৪ + চ্যালেঞ্জ ৩০০০×৩ ≈ ৪৪ হাজার সারি লেখা, কোটার অর্ধেকের কম)
const CH_START_PER_HOUR = 400, CH_START_PER_DAY_ALL = 5000, CH_TRY_PER_HOUR = 300, CH_TRY_PER_DAY_ALL = 5000;
// প্রশ্নে শুধু এই ট্যাগগুলো থাকে, কোনো অ্যাট্রিবিউট ছাড়া; ছবি শুধু এই সাইটের (/…) src দিয়ে। পাতাও আবার ছেঁকে নেয়
const CH_TAGS = new Set(['b', 'i', 'u', 'sub', 'sup', 'br', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span', 'p', 'div', 'small', 'strong', 'em']);
const chImg = t => { const m = t.match(/\ssrc\s*=\s*["']?(\/(?!\/)[\w\-./%]+)/i); return m ? '<img src="' + m[1] + '" alt="">' : ''; };
const chHtml = (v, n) => typeof v !== 'string' ? '' : v.normalize('NFC')
  .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g, (t, g) => { g = g.toLowerCase(); return g === 'img' ? chImg(t) : CH_TAGS.has(g) ? (t[1] === '/' ? '</' : '<') + g + '>' : ''; })
  .trim().slice(0, n);
const CH_BAD = /(খানকি|মাগি|চুদ|শুয়োর|fuck|shit|bitch|asshole|porn)/gi;
const chName = v => (typeof v === 'string' ? v.normalize('NFC') : '').replace(/[<>&"'`\\]/g, '').replace(CH_BAD, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'বন্ধু';
const chMins = n => Math.max(3, Math.ceil(n * 36 / 60));
const chId = () => { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint8Array(8); crypto.getRandomValues(r); return [...r].map(x => a[x % a.length]).join(''); };
// iph = আইপি + ব্রাউজার (একই বাসার দুই ফোন আলাদা গোনা হয়), ip = শুধু আইপি (সীমা টানার জন্য; ব্রাউজারের নাম বদলালেও এটা বদলায় না)
// IPv6-এ একজনের হাতে সাধারণত পুরো /64 থাকে, তাই সীমার জন্য প্রথম চার ভাগই ঠিকানা ধরা হয় (ঠিকানা বদলে বদলে সীমা পার হওয়া যায় না)
const ipKey = s => {
  if (!s.includes(':') || s.includes('.')) return s;
  const [a, b = ''] = s.toLowerCase().split('::'), h = a ? a.split(':') : [], t = b ? b.split(':') : [];
  return [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t].slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
};
const chIp = async req => (await sha(ipKey(req.headers.get('CF-Connecting-IP') || '') + '|lb-ch-ip')).slice(0, 20);
const chIph = async req => (await sha((req.headers.get('CF-Connecting-IP') || '') + '|' + (req.headers.get('User-Agent') || '').slice(0, 80) + '|lb-ch')).slice(0, 20);
const chPicks = (p, qs) => qs.map((q, i) => { const v = Array.isArray(p) ? p[i] : -1; return Number.isInteger(v) && v >= 0 && v < q.o.length ? v : -1; });
const chScore = (p, qs) => qs.reduce((s, q, i) => s + (p[i] === q.a ? 1 : 0), 0);
const chSrc = s => /^\/(?!\/)[\w\-./#?=&%]*$/.test(s) ? s : '';
// সাইটের নিজের প্রশ্নফাইল (বিসিএস/চাকরি): চ্যালেঞ্জে পুরো প্রশ্ন না রেখে ফাইলের নাম আর প্রশ্নের ক্রম রাখা হয়, প্রশ্ন-ব্যাখ্যা ফাইল থেকেই আসে
const chRef = s => typeof s === 'string' && /^\/(bcs|jobs)\/data\/[a-z]\/[\w-]+\.json$/.test(s) ? s : '';
async function chFile(env, req, ref) {
  if (!env.ASSETS) return null;
  const r = await env.ASSETS.fetch(new Request(new URL(ref, req.url).href));
  if (!r.ok) return null;
  const list = await r.json().catch(() => null);
  return Array.isArray(list) ? list : null;
}
// চ্যালেঞ্জের প্রশ্ন: ফাইল-রেফারেন্স থাকলে ফাইল থেকে, নইলে জমা রাখা qs থেকে
async function chQs(c, env, req) {
  if (c.ref && c.idx) {
    const list = await chFile(env, req, c.ref);
    if (!list) throw new Error('ref');
    const cl = chClean(JSON.parse(c.idx).map(i => list[i]), null);
    if (!cl) throw new Error('ref');
    return cl.qs;
  }
  return JSON.parse(c.qs);
}

// বাদ পড়া প্রশ্নের দাগও বাদ যায়, তাই দাগ আর প্রশ্ন এক ক্রমে থাকে
function chClean(list, picks) {
  if (!Array.isArray(list)) return null;
  const qs = [], keep = [];
  list.slice(0, CH_MAX_Q).forEach((q, i) => {
    if (!q || typeof q !== 'object' || !Array.isArray(q.o)) return;
    const t = chHtml(q.q, 4000), o = q.o.slice(0, 6).map(x => chHtml(x, 600));
    if (!t || o.length < 2 || o.some(x => !x) || !Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) return;
    qs.push({q: t, o, a: q.a, e: chHtml(q.e, 4000)}); keep.push(Array.isArray(picks) ? picks[i] : -1);
  });
  return qs.length >= 3 ? {qs, picks: keep} : null;
}

// সেরা তিনজন (চ্যালেঞ্জদাতাসহ): বেশি সঠিক আগে, সমান হলে কম সময়
async function chBoard(db, c) {
  const {results} = await db.prepare('SELECT name, ok, sec FROM ch_try WHERE cid = ? ORDER BY ok DESC, sec ASC LIMIT 3').bind(c.id).all();
  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM ch_try WHERE cid = ?').bind(c.id).first();
  const all = [{name: c.name, ok: c.ok, sec: c.sec, host: 1}, ...results].sort((x, y) => y.ok - x.ok || x.sec - y.sec || (y.host || 0) - (x.host || 0)).slice(0, 3);
  return {top: all, count: (cnt && cnt.n || 0) + 1};
}
async function chRank(db, c, me) {
  const ahead = await db.prepare('SELECT COUNT(*) AS n FROM ch_try WHERE cid = ? AND (ok > ? OR (ok = ? AND sec < ?))').bind(c.id, me.ok, me.ok, me.sec).first();
  return (ahead && ahead.n || 0) + 1 + (c.ok > me.ok || (c.ok === me.ok && c.sec < me.sec) ? 1 : 0);
}

async function challenge(path, req, db, env) {
  const m = req.method, parts = path.split('/');
  if (parts.length === 1 && m === 'POST') {
    const raw = await req.text();
    if (enc.encode(raw).length > CH_MAX_BYTES) return json({error: 'big'}, 413);
    let body; try { body = JSON.parse(raw); } catch (e) { return json({error: 'bad'}, 400); }
    if (!body || typeof body !== 'object') return json({error: 'bad'}, 400);
    await chSetup(db);
    const ip = await chIp(req), now = Date.now();
    const recent = await db.prepare('SELECT SUM(ts > ?) AS h, COUNT(*) AS d FROM ch WHERE iph = ? AND ts > ?').bind(now - 3600e3, ip, now - 86400e3).first();
    if (recent && ((recent.h || 0) >= CH_PER_HOUR || (recent.d || 0) >= CH_PER_DAY_IP)) return json({error: 'slow'}, 429);
    let qs, picks, ok, sec, title = str(body.title, 120) || '', src = str(body.src, 200) || '', parent = null, ref = '', idx = null;
    if (typeof body.from === 'string') {
      // পাল্টা চ্যালেঞ্জ: একই প্রশ্ন, আর নম্বর সেটাই যা এই ফোন ওই চ্যালেঞ্জে আসলে পেয়েছে
      const p = await db.prepare('SELECT id, title, src, qs, ref, idx FROM ch WHERE id = ?').bind(body.from.slice(0, 12)).first();
      if (!p) return json({error: 'not found'}, 404);
      const t = await db.prepare('SELECT ok, sec, picks FROM ch_try WHERE cid = ? AND iph = ?').bind(p.id, await chIph(req)).first();
      if (!t) return json({error: 'first'}, 403);
      qs = await chQs(p, env, req); picks = JSON.parse(t.picks); ok = t.ok; sec = t.sec; title = p.title; src = p.src; parent = p.id; ref = p.ref || ''; idx = p.idx || null;
    } else if (body.ref) {
      ref = chRef(body.ref);
      const list = ref && await chFile(env, req, ref);
      if (!list) return json({error: 'bad'}, 400);
      const seen = new Set(), ids = (Array.isArray(body.idx) ? body.idx : []).filter(i => Number.isInteger(i) && i >= 0 && i < list.length && !seen.has(i) && seen.add(i)).slice(0, CH_MAX_Q);
      const cl = chClean(ids.map(i => list[i]), body.picks);
      if (!cl || cl.qs.length !== ids.length) return json({error: 'bad'}, 400);
      qs = cl.qs; picks = chPicks(cl.picks, qs); ok = chScore(picks, qs); idx = JSON.stringify(ids);
      sec = Math.max(0, Math.min(chMins(qs.length) * 60, Math.round(num(body.sec) || 0)));
    } else {
      const cl = chClean(body.qs, body.picks);
      if (!cl) return json({error: 'bad'}, 400);
      qs = cl.qs; picks = chPicks(cl.picks, qs); ok = chScore(picks, qs);
      sec = Math.max(0, Math.min(chMins(qs.length) * 60, Math.round(num(body.sec) || 0)));
    }
    title = title.replace(/[<>]/g, '').trim(); src = chSrc(src);
    if (!await chDay(db, 'ch', CH_PER_DAY_ALL)) return json({error: 'slow'}, 429);
    for (let i = 0; i < 3; i++) {
      const id = chId();
      const r = await db.prepare('INSERT OR IGNORE INTO ch(id, ts, name, title, src, n, mins, ok, sec, picks, qs, iph, parent, ref, idx) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, now, chName(body.name), title, src, qs.length, chMins(qs.length), ok, sec, JSON.stringify(picks), ref ? '' : JSON.stringify(qs), ip, parent, ref || null, ref ? idx : null).run();
      if (r.meta && r.meta.changes) return json({id, ok, n: qs.length});
    }
    return json({error: 'server'}, 500);
  }
  const id = parts[1] || '';
  if (parts.length > 3 || !/^[A-Za-z0-9]{6,12}$/.test(id)) return json({error: 'not found'}, 404);
  let c;
  try { c = await db.prepare('SELECT * FROM ch WHERE id = ?').bind(id).first(); } catch (e) { c = null; }
  if (!c) return json({error: 'not found'}, 404);
  await chSetup(db);
  const qs = await chQs(c, env, req), head = {id, name: c.name, title: c.title, src: chSrc(c.src || ''), n: c.n, mins: c.mins, ok: c.ok, sec: c.sec, ts: c.ts};
  const iph = await chIph(req), now = Date.now();
  if (parts.length === 2 && m === 'GET') {
    const t = await db.prepare('SELECT ok, sec FROM ch_try WHERE cid = ? AND iph = ?').bind(id, iph).first();
    return json({...head, qs: qs.map(q => ({q: q.q, o: q.o})), ...await chBoard(db, c), ...(t ? {mine: {ok: t.ok, sec: t.sec, rank: await chRank(db, c, t)}} : {})});
  }
  if (parts[2] === 'start' && m === 'POST') {
    // পরীক্ষা শুরুর মুহূর্ত (প্রথমবারেরটাই থাকে), জমার সময় সেখান থেকেই সময় গোনা হয়।
    // লগইন লাগে না, তাই সীমা: আগে থাকলে কিছু লেখা হয় না; আইপি বা সবার মিলিয়ে সীমা পার হলেও লেখা হয় না
    // (পাতা উত্তর দেখে না; শুরুর সময় না থাকলে জমার সময় পাতার গোনা সময় নেওয়া হয়, সর্বোচ্চ নির্ধারিত সময়)
    if (await db.prepare('SELECT 1 FROM ch_start WHERE cid = ? AND iph = ?').bind(id, iph).first()) return json({ok: true});
    const ip = await chIp(req);
    const mine = await db.prepare('SELECT COUNT(*) AS n FROM ch_start WHERE ip = ? AND ts > ?').bind(ip, now - 3600e3).first();
    if (mine && mine.n >= CH_START_PER_HOUR) return json({ok: false, error: 'slow'}, 429);
    if (!await chDay(db, 'start', CH_START_PER_DAY_ALL)) return json({ok: false, error: 'slow'}, 429);
    await db.prepare('INSERT OR IGNORE INTO ch_start(cid, iph, ts, ip) VALUES(?,?,?,?)').bind(id, iph, now, ip).run();
    return json({ok: true});
  }
  if (parts[2] === 'try' && m === 'POST') {
    const body = await req.json().catch(() => null) || {};
    // একই ফোন থেকে প্রথমবারেরটাই গোনা হয়; আবার জমা দিলে আগের ফলই ফেরত আসে
    const old = await db.prepare('SELECT name, ok, sec, picks FROM ch_try WHERE cid = ? AND iph = ?').bind(id, iph).first();
    let me;
    if (old) me = {name: old.name, ok: old.ok, sec: old.sec, picks: JSON.parse(old.picks), again: 1};
    else {
      const picks = chPicks(body.picks, qs), lim = c.mins * 60;
      const st = await db.prepare('SELECT ts FROM ch_start WHERE cid = ? AND iph = ?').bind(id, iph).first();
      const sec = st ? Math.round((now - st.ts) / 1000) : Math.round(num(body.sec) || lim);
      me = {name: chName(body.name), ok: chScore(picks, qs), sec: Math.max(0, Math.min(lim, sec)), picks};
      const ip = await chIp(req);
      const n = await db.prepare('SELECT COUNT(*) AS n, SUM(ip = ?) AS mine FROM ch_try WHERE cid = ?').bind(ip, id).first();
      // সব চ্যালেঞ্জ মিলিয়ে এক আইপির ঘণ্টার সীমা আর সবার দৈনিক সীমা; পার হলে নম্বর দেখায়, বোর্ডে ওঠে না
      const h = await db.prepare('SELECT COUNT(*) AS n FROM ch_try WHERE ip = ? AND ts > ?').bind(ip, now - 3600e3).first();
      if ((n && n.n || 0) < CH_MAX_TRIES && (n && n.mine || 0) < CH_IP_TRIES && (h && h.n || 0) < CH_TRY_PER_HOUR && await chDay(db, 'try', CH_TRY_PER_DAY_ALL))
        await db.prepare('INSERT OR IGNORE INTO ch_try(cid, ts, name, ok, sec, picks, iph, ip) VALUES(?,?,?,?,?,?,?,?)')
          .bind(id, now, me.name, me.ok, me.sec, JSON.stringify(me.picks), iph, ip).run();
      else me.off = 1;
    }
    return json({...head, qs, host: JSON.parse(c.picks), me, rank: await chRank(db, c, me), ...await chBoard(db, c)});
  }
  return json({error: 'not found'}, 404);
}

// ---------- প্রশ্নে ভুল জানানো (লগইন লাগে না) ----------
// এক সারি = এক অভিযোগ। আইপি রাখা হয় না, শুধু হ্যাশ (সীমা টানার জন্য)। লগইন থাকলে uid।
const REP_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS rep(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, qid TEXT, page TEXT, q TEXT, kind TEXT, note TEXT, uid INTEGER, ip TEXT, st TEXT NOT NULL DEFAULT \'new\')',
  'CREATE INDEX IF NOT EXISTS rep_ip ON rep(ip, ts)',
  'CREATE INDEX IF NOT EXISTS rep_st ON rep(st, ts)',
  'CREATE TABLE IF NOT EXISTS ch_day(k TEXT PRIMARY KEY, n INTEGER NOT NULL)'
];
let REP_READY = false;
async function repSetup(db) {
  if (REP_READY) return;
  await db.batch(REP_SCHEMA.map(x => db.prepare(x)));
  // src কলাম: আগের 🎤 ভয়েস মতামতের সারিতে 'voice' (ফিচারটা ২০২৬-১১-০৪-এ তোলা হয়েছে); নতুন সারিতে খালি
  try { await db.prepare('ALTER TABLE rep ADD COLUMN src TEXT').run(); } catch (e) { /* আগেই আছে */ }
  // h: "বুঝিনি"-র লেখা কোন ব্যাখ্যার জন্য (ব্যাখ্যার লেখার ছোট ছাপ; ব্যাখ্যা বদলালে ছাপ বদলায়)
  try { await db.prepare('ALTER TABLE rep ADD COLUMN h TEXT').run(); } catch (e) { /* আগেই আছে */ }
  REP_READY = true;
}
// এক আইপি থেকে ঘণ্টায় ২০টা, দিনে ৬০টা; সবার মিলিয়ে দিনে ৩০০০টা (D1-এর দৈনিক লেখার সীমা বাঁচাতে)
const REP_KINDS = new Set(['hard', 'ans', 'exp', 'q', 'other']), REP_PER_HOUR = 20, REP_PER_DAY_IP = 60, REP_PER_DAY_ALL = 3000;
const repText = (v, n) => (typeof v === 'string' ? v.normalize('NFC') : '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
async function report(req, db, u) {
  const b = await req.json().catch(() => ({}));
  const kind = REP_KINDS.has(b.kind) ? b.kind : 'other';
  const qid = /^[\w-]{1,40}$/.test(b.qid || '') ? b.qid : null;
  const page = repText(b.page, 200).replace(/^https?:\/\/[^/]+/, '');
  // শুধু এই সাইটের পথ (/...), নইলে অ্যাডমিন পাতার লিংকে javascript: ইত্যাদি ঢুকতে পারে
  const safePage = /^\/(?!\/)[^\s"'<>]*$/.test(page) ? page : '';
  const q = repText(b.q, 400), note = repText(b.note, 600), h = /^[0-9a-f]{1,12}$/.test(b.h || '') ? b.h : null;
  if (!qid && !q) return json({error: 'empty'}, 400);
  await repSetup(db);
  const ip = await chIp(req), now = Date.now();
  // একই মানুষ একই প্রশ্নে একই ধরনের অভিযোগ দিনে একবারই
  const same = await db.prepare('SELECT 1 FROM rep WHERE ip = ? AND ts > ? AND kind = ? AND (qid = ? OR q = ?) LIMIT 1')
    .bind(ip, now - 86400e3, kind, qid || '', q).first();
  if (same) return json({ok: true, dup: 1});
  const c = await db.prepare('SELECT SUM(ts > ?) h, COUNT(*) d FROM rep WHERE ip = ? AND ts > ?').bind(now - 3600e3, ip, now - 86400e3).first();
  if ((c && (c.h >= REP_PER_HOUR || c.d >= REP_PER_DAY_IP)) || !await chDay(db, 'rep', REP_PER_DAY_ALL)) return json({error: 'slow'}, 429);
  await db.prepare('INSERT INTO rep(ts, qid, page, q, kind, note, uid, ip, h) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(now, qid, safePage, q, kind, note, u ? u.id : null, ip, h).run();
  return json({ok: true});
}

// ---------- ব্যাখ্যা "বুঝেছি / বুঝিনি" (এক ট্যাপ, লগইন লাগে না; বোতাম js/report.js) ----------
/* পাতা ছাড়ার সময় একবার (sendBeacon): POST /api/fb {page, taps:[[চাবি, ব্যাখ্যার ছাপ, 1 বুঝেছি / 0 বুঝিনি, প্রশ্নের লেখা?], …]}
   → fb_tap-এ এক সারি (এক পাতা-দেখা = এক সারি, D1-এর লেখার সীমা বাঁচাতে)। চাবি = প্রশ্নের id, না থাকলে "t:" + প্রশ্নের শুরু।
   অ্যাডমিন: GET /api/admin/fb?days=30 → চাবি+ছাপ ধরে কতজন বুঝেছেন/বোঝেননি (পাতা /admin/reports/, "বুঝিনি" ট্যাব)।
   ব্যাখ্যা নতুন করে লিখলে ছাপ বদলায়, তাই নতুন ব্যাখ্যার হিসাব আলাদা গোনা হয়। Fable-যাচাই 2026-11-02। */
const FB_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS fb_tap(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, page TEXT, uid INTEGER, ip TEXT, taps TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS fb_ts ON fb_tap(ts)',
  'CREATE INDEX IF NOT EXISTS fb_ip ON fb_tap(ip, ts)',
  'CREATE TABLE IF NOT EXISTS ch_day(k TEXT PRIMARY KEY, n INTEGER NOT NULL)'
];
let FB_READY = false;
async function fbSetup(db) { if (!FB_READY) { await db.batch(FB_SCHEMA.map(x => db.prepare(x))); FB_READY = true; } }
const FB_PER_DAY_IP = 150, FB_PER_DAY_ALL = 20000;
async function fbTap(req, db, u) {
  let b = {};
  try { b = JSON.parse(await req.text()); } catch (e) { /* sendBeacon text/plain-এ পাঠায় */ }
  const page = repText(b.page, 200).replace(/^https?:\/\/[^/]+/, '');
  const taps = (Array.isArray(b.taps) ? b.taps : []).slice(0, 200).map(t => Array.isArray(t) ? [
    repText(t[0], 80), /^[0-9a-f]{1,12}$/.test(t[1] || '') ? t[1] : '', t[2] === 1 ? 1 : 0, t[2] === 1 ? '' : repText(t[3], 160)
  ] : null).filter(t => t && t[0]);
  if (!taps.length) return json({error: 'empty'}, 400);
  await fbSetup(db);
  const ip = await chIp(req), now = Date.now();
  const c = await db.prepare('SELECT COUNT(*) d FROM fb_tap WHERE ip = ? AND ts > ?').bind(ip, now - 86400e3).first();
  if ((c && c.d >= FB_PER_DAY_IP) || !await chDay(db, 'fb', FB_PER_DAY_ALL)) return json({error: 'slow'}, 429);
  await db.prepare('INSERT INTO fb_tap(ts, page, uid, ip, taps) VALUES(?,?,?,?,?)')
    .bind(now, /^\/(?!\/)[^\s"'<>]*$/.test(page) ? page : '', u ? u.id : null, ip, JSON.stringify(taps)).run();
  return json({ok: true});
}

// অ্যাডমিন: কার কী ফল, প্রতিটি উত্তরসহ (কাস্টম প্ল্যান আর দিন-শেষের ডেটা-যাচাইয়ের জন্য)
async function admin(path, url, env, db, u, req) {
  if (!isAdmin(u, env)) return json({error: 'admin'}, 403);
  if (path === 'admin/pilot' || path.startsWith('admin/pilot/')) return pilotAdmin(path, url, req, db);
  if (path === 'admin/upkey') return upkeyAdmin(req, db);
  if (path === 'admin/exkey') return exkeyAdmin(req, db);
  if (path === 'admin/diag' || path.startsWith('admin/diag/')) return diagAdmin(path, url, req, db);
  await attqTable(db);
  if (path === 'admin/learners') {
    const {results} = await db.prepare(`SELECT u.id, u.name, u.email, u.created, u.seen,
        (SELECT COUNT(*) FROM att a WHERE a.uid = u.id) tests,
        (SELECT COUNT(*) FROM attq q WHERE q.uid = u.id) withq,
        (SELECT MAX(ts) FROM att a WHERE a.uid = u.id) last
      FROM users u ORDER BY last DESC NULLS LAST, u.id DESC LIMIT 1000`).all();
    return json({ts: Date.now(), users: results});
  }
  if (path === 'admin/att') {
    const em = (url.searchParams.get('email') || '').trim().toLowerCase(), id = parseInt(url.searchParams.get('uid') || '', 10);
    await goalCols(db);
    const who = em ? await db.prepare('SELECT id, name, email, created, seen, goal, gdate FROM users WHERE lower(email) = ?').bind(em).first()
      : id ? await db.prepare('SELECT id, name, email, created, seen, goal, gdate FROM users WHERE id = ?').bind(id).first() : null;
    if (!who) return json({error: 'no user'}, 404);
    await diagSetup(db);
    const [a, q, d] = await db.batch([
      db.prepare('SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? ORDER BY ts').bind(who.id),
      db.prepare('SELECT k, ts, qd, tm, m, qv FROM attq WHERE uid = ? ORDER BY ts').bind(who.id),
      // নিজের পরিকল্পনার (অবস্থা-যাচাই) ভাগগুলো: প্রতিটি উত্তর [দাগ, ঠিক 1/ভুল 0, ms], পর্যালোচনায় একসঙ্গে গোনা হয়
      db.prepare('SELECT sid, part, ts, done, ans, res, hid, hn FROM diag_att WHERE uid = ? ORDER BY ts').bind(who.id)
    ]);
    const Q = new Map(q.results.map(r => [r.k, r]));
    // ফেরত যায় সেকেন্ডে (দশমিকসহ)
    const tmOf = r => r && r.tm ? r.tm.split(',').map(x => x === '' ? null : +x / 10) : null;
    const jp = x => { try { return x ? JSON.parse(x) : null; } catch (e) { return null; } };
    return json({ts: Date.now(), user: who,
      att: a.results.map(r => { const x = Q.get(r.k); return {...r, sb: jp(r.sb), qd: x ? splitQd(x.qd) : null, tm: tmOf(x), m: x ? jp(x.m) : null}; }),
      diag: d.results.map(r => ({...r, ans: jp(r.ans) || {}, res: jp(r.res)}))},
      200, {'Cache-Control': 'no-store'});
  }
  if (path === 'admin/fb') {
    await fbSetup(db);
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30));
    const {results} = await db.prepare(`SELECT json_extract(j.value, '$[0]') k, json_extract(j.value, '$[1]') h,
        SUM(json_extract(j.value, '$[2]') = 1) yes, SUM(json_extract(j.value, '$[2]') = 0) no,
        MAX(json_extract(j.value, '$[3]')) q, MAX(f.page) page, MAX(f.ts) last
      FROM fb_tap f, json_each(f.taps) j WHERE f.ts > ? GROUP BY k, h ORDER BY no DESC, yes ASC LIMIT 1000`).bind(Date.now() - days * 86400e3).all();
    const tot = await db.prepare('SELECT COUNT(*) n FROM fb_tap WHERE ts > ?').bind(Date.now() - days * 86400e3).first();
    return json({ts: Date.now(), days, visits: tot ? tot.n : 0, rows: results}, 200, {'Cache-Control': 'no-store'});
  }
  // ভুল জানানো প্রশ্ন (উত্তর বা প্রশ্নে ভুল), অ্যাডমিন "ভুল নয়" (st='no') করেনি এমন: পর্যালোচনায় কঠিন/সহজ থেকে বাদ
  // বদলের খাতা (পাইলট/নির্ণয়ের প্রশ্ন আবার তোলায় কী বদলাল); সাধারণ পাতার বদল admin/data/qver-log.jsonl-এ
  if (path === 'admin/qver') {
    await db.prepare(QVLOG).run();
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 400);
    const {results} = await db.prepare('SELECT ts, src, qid, what, old, new FROM qver_log WHERE ts > ? ORDER BY ts LIMIT 20000').bind(Date.now() - days * 86400e3).all();
    return json({rows: results});
  }
  if (path === 'admin/repq') {
    await repSetup(db);
    const {results} = await db.prepare(`SELECT DISTINCT qid FROM rep WHERE qid IS NOT NULL AND kind IN ('ans','q') AND st != 'no'`).all();
    return json({qids: results.map(r => r.qid)}, 200, {'Cache-Control': 'no-store'});
  }
  if (path === 'admin/reports') {
    await repSetup(db);
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(Number.isInteger).slice(0, 200);
      const st = b.st === 'done' || b.st === 'new' || b.st === 'no' ? b.st : null;
      if (!ids.length || !st) return json({error: 'bad'}, 400);
      await db.batch(ids.map(id => db.prepare('UPDATE rep SET st = ? WHERE id = ?').bind(st, id)));
      return json({ok: true, n: ids.length});
    }
    const st = url.searchParams.get('st') || 'new';
    const {results} = await db.prepare(`SELECT r.id, r.ts, r.qid, r.page, r.q, r.kind, r.note, r.st, r.src, u.name uname, u.email uemail
      FROM rep r LEFT JOIN users u ON u.id = r.uid ${st === 'all' ? '' : 'WHERE r.st = ?'} ORDER BY r.ts DESC LIMIT 2000`)
      .bind(...(st === 'all' ? [] : [st])).all();
    return json({ts: Date.now(), rows: results}, 200, {'Cache-Control': 'no-store'});
  }
  return json({error: 'not found'}, 404);
}

// ---------- পাইলট ব্যাচ (যেমন পেট্রোবাংলা প্রথম ব্যাচ): দিনভিত্তিক টপিক-পরীক্ষা, প্রতিটি উত্তর আলাদা সারি ----------
/* পাতা /pilot/<id>/ (পরীক্ষার্থী) আর /admin/pilot/ (অ্যাডমিন)। প্রশ্নের সেট (উত্তরসহ) রিপোতে নয়, অ্যাডমিন পাতা থেকে D1-এ ওঠে;
   আসল কপি Lyanna_data/pilot/<id>/set.json। সময় সব সার্ভারে গোনা, বাংলাদেশ সময় (UTC+6): দিন d খোলে start+(d-1) তারিখের সকাল ৬টায়
   (= সেই তারিখের UTC মধ্যরাত), বন্ধ হয় ২৪ ঘণ্টা পরে। উত্তর আর ব্যাখ্যা শুধু বন্ধ হওয়ার পরে।
   GET  /api/pilot/me?p=          → সূচি, নিজের অবস্থা, আজকের শিট, রাতের ফর্ম, রিপোর্ট আছে কি না
   POST /api/pilot/join {p}       → যোগ দেওয়ার অনুরোধ (অ্যাডমিন অনুমোদন দিলে কোড P01, P02…)
   POST /api/pilot/start {p,no}   → পরীক্ষা শুরু বা চলতিটা আবার খোলা: প্রশ্ন (উত্তর ছাড়া), শেষ সময়, আগে দেওয়া উত্তর
   POST /api/pilot/ans {p,no,qid,pick,conf,sec} → একটি উত্তর = একটি সারি (pilot_ans); ঠিক/ভুল সার্ভারে, ফেরত যায় না
   POST /api/pilot/done {p,no}
   GET  /api/pilot/review?p=&no=  → বন্ধ হওয়ার পরে উত্তর, ব্যাখ্যা, নিজের দাগ
   GET  /api/pilot/report?p=      → ৫ম দিন বন্ধ হওয়ার পরে নিজের রিপোর্ট (অ্যাডমিন &code=P03 দিয়ে যেকোনো সময়)
   অ্যাডমিন: GET admin/pilot?p= · POST admin/pilot/set {p,cfg} · POST admin/pilot/q {p,qs:[…]} (এক বারে ৪০) ·
            POST admin/pilot/cfg {p,start?,form?} · POST admin/pilot/mem {p,uid,act:ok|wait|out} ·
            POST admin/pilot/reset {p,uid,no} (পরীক্ষা করে দেখার জন্য একটা পরীক্ষা মোছা) · GET admin/pilot/csv?p= (শুধু কোড, নাম নয়) */
const PILOT_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS pilot(id TEXT PRIMARY KEY, cfg TEXT NOT NULL, updated INTEGER)',
  'CREATE TABLE IF NOT EXISTS pilot_q(pilot TEXT NOT NULL, qid TEXT NOT NULL, topic TEXT, d TEXT NOT NULL, PRIMARY KEY(pilot, qid))',
  'CREATE TABLE IF NOT EXISTS pilot_mem(pilot TEXT NOT NULL, uid INTEGER NOT NULL, code TEXT, st TEXT NOT NULL, ts INTEGER, PRIMARY KEY(pilot, uid))',
  'CREATE TABLE IF NOT EXISTS pilot_sit(pilot TEXT NOT NULL, uid INTEGER NOT NULL, no INTEGER NOT NULL, ts INTEGER NOT NULL, dl INTEGER NOT NULL, qs TEXT NOT NULL, rep TEXT NOT NULL, done INTEGER, PRIMARY KEY(pilot, uid, no))',
  'CREATE TABLE IF NOT EXISTS pilot_ans(pilot TEXT NOT NULL, uid INTEGER NOT NULL, no INTEGER NOT NULL, qid TEXT NOT NULL, topic TEXT, pick INTEGER NOT NULL, ok INTEGER NOT NULL, conf TEXT NOT NULL, sec INTEGER, ts INTEGER NOT NULL, rep INTEGER NOT NULL, late INTEGER, cts INTEGER, PRIMARY KEY(pilot, uid, no, qid))',
  'CREATE TABLE IF NOT EXISTS pilot_sheet(pilot TEXT NOT NULL, uid INTEGER NOT NULL, topic TEXT NOT NULL, ts INTEGER NOT NULL, last INTEGER, n INTEGER NOT NULL, PRIMARY KEY(pilot, uid, topic))'
];
let pilotReady = false;
async function pilotSetup(db) {
  if (pilotReady) return;
  await db.batch(PILOT_SCHEMA.map(s => db.prepare(s)));
  // যে নামে PIASH ডাকবেন (Google-এর নাম প্রায়ই ইংরেজি বা অচেনা); শুধু D1-এ, রপ্তানিতে নয়
  try { await db.prepare('ALTER TABLE pilot_mem ADD COLUMN nick TEXT').run(); } catch (e) { /* আগেই আছে */ }
  // qv: দাগের সময় কোন চাবি আর ব্যাখ্যা ছিল ("kv.ev", qVer); পুরোনো সারিতে NULL
  try { await db.prepare('ALTER TABLE pilot_ans ADD COLUMN qv TEXT').run(); } catch (e) { /* আগেই আছে */ }
  pilotReady = true;
}
// নাম: ২-৪০ অক্ষর, অক্ষর থাকতে হবে (শুধু সংখ্যা/চিহ্ন নয়)
const cleanNick = v => { const n = nfc(String(v || '')).replace(/\s+/g, ' ').slice(0, 40); return n.length >= 2 && /[\p{L}]/u.test(n) && !/[<>@]/.test(n) ? n : null; };

const PID = /^[a-z0-9]+(-[a-z0-9]+)*$/, TID = /^[a-z0-9]+(-[a-z0-9]+)*$/, DAY = 86400e3, H = 3600e3;
const GRACE = 60e3; // ধীর নেটে শেষ উত্তরটা পৌঁছানোর সময়
const LATE = 10 * 60e3; // ফোনে জমে থাকা উত্তর এর মধ্যে এলে নেওয়া হয়, late=1 চিহ্নসহ (বাদ দেওয়া নয়)
// "2026-11-10" → দিন ১ খোলার মুহূর্ত (সকাল ৬টা ঢাকা = ০০:০০ UTC)
const pOpen = start => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const pDay = (c, now) => { const o = pOpen(c.start); return o == null ? null : Math.floor((now - o) / DAY) + 1; };
const dOpen = (c, d) => pOpen(c.start) + (d - 1) * DAY;
const dClose = (c, d) => dOpen(c, d) + DAY;
// উত্তর খোলে দিন বন্ধের পরে আরও এক পরীক্ষার সময় + জমার সময়, যাতে ৫:৫৯-এ শুরু করা কেউ চলতি অবস্থায় উত্তর না দেখে
const dReveal = (c, d) => dClose(c, d) + c.mins * 60e3 + GRACE + LATE;
const codeNo = code => parseInt(String(code || '').replace(/\D/g, ''), 10) || 0;
// জোড় কোড → ক-দলের শিট আগে, বিজোড় → খ-দলের
const earlyGroup = code => codeNo(code) % 2 === 0 ? 'ka' : 'kha';

// চেনা ব্যাচ: সেট তোলার আগেই পাতা খোলে, মানুষ নাম দিয়ে যোগ দিতে পারেন, অ্যাডমিন অনুমোদন দিতে পারেন
const PILOT_KNOWN = {'petrobangla-1': 'পেট্রোবাংলা প্রস্তুতি · প্রথম ব্যাচ'};
async function pilotCfg(db, p) {
  const r = await db.prepare('SELECT cfg, updated FROM pilot WHERE id = ?').bind(p).first();
  if (!r && !PILOT_KNOWN[p]) return null;
  const c = r ? JSON.parse(r.cfg) : pilotSlim({id: p, title: PILOT_KNOWN[p], topics: [], exams: []});
  c.updated = r ? r.updated : 0;
  c.T = new Map(c.topics.map(t => [t.id, t]));
  c.E = new Map(c.exams.map(e => [e.no, e]));
  // প্রতিটি টপিকের প্রথম আর দ্বিতীয় পরীক্ষা (দিন ধরে)
  const by = {};
  for (const e of [...c.exams].sort((a, b) => a.day - b.day || a.no - b.no)) (by[e.topic] = by[e.topic] || []).push(e);
  for (const e of c.exams) e.round = by[e.topic].indexOf(e) + 1;
  c.byTopic = by;
  return c;
}

// সেট যাচাই: অ্যাডমিন পাতাও একই নিয়ম দেখায়, তবু সার্ভারে আবার
function pilotCheck(c) {
  const err = [];
  if (!c || typeof c !== 'object') return ['cfg নেই'];
  if (!PID.test(c.id || '')) err.push('id ঠিক নয়');
  if (c.start && !pOpen(c.start)) err.push('start তারিখ YYYY-MM-DD হবে');
  const days = c.days || 5, n = c.n || 15, per = c.personal == null ? 3 : c.personal;
  if (!Array.isArray(c.topics) || !c.topics.length) err.push('topics নেই');
  else for (const t of c.topics) {
    if (!TID.test(t.id || '')) err.push('টপিক-আইডি ঠিক নয়: ' + t.id);
    if (t.group !== 'ka' && t.group !== 'kha') err.push('টপিক ' + t.id + ': group হবে ka বা kha');
    if (t.sheet && !/^https:\/\//.test(t.sheet)) err.push('টপিক ' + t.id + ': sheet লিংক https:// দিয়ে');
  }
  const tids = new Set((c.topics || []).map(t => t.id)), seen = {}, nos = new Set();
  if (!Array.isArray(c.exams) || !c.exams.length) err.push('exams নেই');
  else for (const e of c.exams) {
    if (!Number.isInteger(e.no) || nos.has(e.no)) err.push('পরীক্ষা-নম্বর ঠিক নয় বা দুবার: ' + e.no);
    nos.add(e.no);
    if (!Number.isInteger(e.day) || e.day < 1 || e.day > days) err.push('পরীক্ষা ' + e.no + ': day ১-' + days);
    if (!tids.has(e.topic)) err.push('পরীক্ষা ' + e.no + ': অচেনা টপিক ' + e.topic);
    if (!Array.isArray(e.qs) || e.qs.length !== n - per) err.push('পরীক্ষা ' + e.no + ': qs-এ ' + (n - per) + 'টি প্রশ্ন লাগবে (আছে ' + (e.qs || []).length + ')');
    if (!Array.isArray(e.fill) || e.fill.length < per) err.push('পরীক্ষা ' + e.no + ': fill-এ অন্তত ' + per + 'টি বাড়তি প্রশ্ন লাগবে');
    for (const q of [...(e.qs || []), ...(e.fill || [])]) if (!QID.test(q)) err.push('পরীক্ষা ' + e.no + ': প্রশ্ন-আইডি ঠিক নয় ' + q);
    (seen[e.topic] = seen[e.topic] || []).push(e);
  }
  for (const [t, list] of Object.entries(seen)) {
    if (list.length !== 2) { err.push('টপিক ' + t + ' আসছে ' + list.length + ' বার (২ বার লাগবে)'); continue; }
    const [a, b] = list.sort((x, y) => x.day - y.day);
    if (b.day - a.day < 2) err.push('টপিক ' + t + ': দুই পরীক্ষার মাঝে অন্তত ২ দিন (দিন ' + a.day + ' আর ' + b.day + ')');
    const s1 = new Set([...a.qs, ...a.fill]);
    if ([...b.qs, ...b.fill].some(q => s1.has(q))) err.push('টপিক ' + t + ': দ্বিতীয়বার নতুন প্রশ্ন হবে, কিছু প্রশ্ন দুবার');
  }
  if (c.form && !/^https:\/\/docs\.google\.com\/forms\/|^https:\/\/forms\.gle\//.test(c.form)) err.push('form লিংক Google Form-এর হবে');
  return err.slice(0, 40);
}

// সার্ভারে রাখা cfg: শুধু দরকারি ঘর
function pilotSlim(c) {
  return {id: c.id, title: str(c.title, 120) || c.id, start: c.start || '', days: c.days || 5, n: c.n || 15,
    personal: c.personal == null ? 3 : c.personal, mins: c.mins || 15, pass: c.pass || 18, form: c.form || '',
    attend_min: Number.isInteger(c.attend_min) ? c.attend_min : 10,
    sheet_early: c.sheet_early === 'day_start' ? 'day_start' : 'after_exam', late_hour: Number.isInteger(c.late_hour) ? c.late_hour : 18,
    form_hour: Number.isInteger(c.form_hour) ? c.form_hour : 21,
    topics: c.topics.map(t => ({id: t.id, name: str(t.name, 120) || t.id, group: t.group, sheet: t.sheet || ''})),
    exams: c.exams.map(e => ({no: e.no, day: e.day, topic: e.topic, qs: e.qs, fill: e.fill}))};
}

async function pilotMem(db, p, uid) {
  return db.prepare('SELECT uid, code, st, ts, nick FROM pilot_mem WHERE pilot = ? AND uid = ?').bind(p, uid).first();
}

// এই মানুষের আগের দিনের ভুল (ফাঁকাও ভুল) থেকে ফেরত-প্রশ্ন; একই টপিক আগে, তারপর পুরোনো আগে; একটা প্রশ্ন একবারই ফেরে
async function pickPersonal(db, c, uid, e) {
  const k = c.personal == null ? 3 : c.personal;
  if (!k) return [];
  const [s, a] = await db.batch([
    db.prepare('SELECT no, ts, qs, rep FROM pilot_sit WHERE pilot = ? AND uid = ? ORDER BY ts').bind(c.id, uid),
    db.prepare('SELECT no, qid, ok FROM pilot_ans WHERE pilot = ? AND uid = ?').bind(c.id, uid)
  ]);
  const okBy = new Map(a.results.map(r => [r.no + ':' + r.qid, r.ok]));
  const used = new Set(), cand = [], base = new Set(e.qs);
  for (const r of s.results) {
    const qs = r.qs.split(','), rep = r.rep.split(',');
    qs.forEach((q, i) => { if (rep[i] === '1') used.add(q); });
  }
  for (const r of s.results) {
    const x = c.E.get(r.no);
    if (!x || x.day >= e.day) continue; // শুধু আগের দিনগুলো (যেগুলোর উত্তর এখন খোলা)
    r.qs.split(',').forEach((q, i) => {
      if (okBy.get(r.no + ':' + q) === 1 || used.has(q) || base.has(q)) return;
      cand.push({q, i: cand.length});
    });
  }
  const uniq = [...new Map(cand.map(x => [x.q, x])).values()];
  if (!uniq.length) return [];
  const topic = new Map();
  for (let i = 0; i < uniq.length; i += 40) {
    const part = uniq.slice(i, i + 40).map(x => x.q);
    const {results} = await db.prepare(`SELECT qid, topic FROM pilot_q WHERE pilot = ? AND qid IN (${part.map(() => '?').join(',')})`).bind(c.id, ...part).all();
    for (const r of results) topic.set(r.qid, r.topic);
  }
  return uniq.filter(x => topic.has(x.q))
    .sort((x, y) => (topic.get(y.q) === e.topic) - (topic.get(x.q) === e.topic) || x.i - y.i)
    .slice(0, k).map(x => x.q);
}

async function pilotQs(db, p, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const part = ids.slice(i, i + 40);
    const {results} = await db.prepare(`SELECT qid, topic, d FROM pilot_q WHERE pilot = ? AND qid IN (${part.map(() => '?').join(',')})`).bind(p, ...part).all();
    for (const r of results) out.set(r.qid, {topic: r.topic, ...JSON.parse(r.d)});
  }
  return out;
}

// একজনের সব পরীক্ষার অবস্থা
function examState(c, e, sit, now) {
  const o = dOpen(c, e.day), cl = dClose(c, e.day);
  if (sit) {
    if (!sit.done && now < sit.dl + GRACE) return 'going';
    return now >= dReveal(c, e.day) ? 'closed' : 'done';
  }
  if (now < o) return 'soon';
  if (now < cl) return 'open';
  return now >= dReveal(c, e.day) ? 'missed' : 'shut';
}

// কোন শিট এখন খোলা
function sheetsFor(c, code, sits, now) {
  const early = earlyGroup(code), out = [], d5 = c.days || 5;
  const lateAt = dOpen(c, d5) + ((c.late_hour == null ? 18 : c.late_hour) - 6) * H;
  for (const t of c.topics) {
    if (!t.sheet) continue;
    const first = (c.byTopic[t.id] || [])[0];
    if (!first) continue;
    let at;
    if (t.group === early) {
      if (c.sheet_early === 'day_start') at = dOpen(c, first.day);
      else {
        const s = sits.get(first.no);
        // প্রথম পরীক্ষা শেষ হলে (বা দিন বন্ধ হলে, পরীক্ষা না দিলেও)
        at = s ? (s.done || s.dl + GRACE) : dClose(c, first.day);
        if (s && !s.done && now < s.dl + GRACE) at = Infinity;
      }
    } else {
      // ৫ম দিনের সন্ধ্যা, তবে সেদিনের সব পরীক্ষা শেষ হলে তবেই (নইলে দ্বিতীয় রাউন্ডের আগে শিট পড়া হয়ে যায়); না দিলে দিন বন্ধ হলে
      const last = c.exams.filter(x => x.day === d5);
      const fin = last.every(x => { const s = sits.get(x.no); return s && (s.done || now >= s.dl + GRACE); });
      at = fin ? Math.max(lateAt, ...last.map(x => { const s = sits.get(x.no); return s.done || s.dl + GRACE; })) : dClose(c, d5);
    }
    if (now >= at) out.push({topic: t.id, name: t.name, url: t.sheet, at: Math.min(at, now), late: t.group !== early});
  }
  return out.sort((a, b) => b.at - a.at);
}

// হিসাব স্ক্রিপ্টে: দুই রাউন্ড মিলিয়ে, আন্দাজে ঠিক = ঠিক নয়, দেখানো-কিন্তু-ফাঁকা = ভুল; প্রশ্ন তার নিজের টপিকে গোনা
async function pilotReportFor(db, c, uid, code) {
  const [s, a] = await db.batch([
    db.prepare('SELECT no, qs, rep FROM pilot_sit WHERE pilot = ? AND uid = ?').bind(c.id, uid),
    db.prepare('SELECT no, qid, ok, conf FROM pilot_ans WHERE pilot = ? AND uid = ?').bind(c.id, uid)
  ]);
  const ans = new Map(a.results.map(r => [r.no + ':' + r.qid, r]));
  const ids = [...new Set(s.results.flatMap(r => r.qs.split(',')))];
  const qt = await pilotQs(db, c.id, ids);
  const T = new Map(c.topics.map(t => [t.id, {id: t.id, name: t.name, sheet: t.sheet, n: 0, sure: 0, guessOk: 0, wrong: 0, blank: 0, r: [[0, 0], [0, 0]]}]));
  // একই প্রশ্ন ফেরত এলে টপিকে একবারই গোনা, শেষ উত্তরটা ধরে (নইলে দুর্বলের ভুল দুবার গোনা হয়)
  const last = new Map(), sitsSorted = [...s.results].sort((x, y) => ((c.E.get(x.no) || {}).day - (c.E.get(y.no) || {}).day) || x.no - y.no);
  let guessOk = 0, guessed = 0, sure = 0, sureWrong = 0, back = 0, backFixed = 0;
  for (const r of sitsSorted) {
    const e = c.E.get(r.no), rep = r.rep.split(',');
    r.qs.split(',').forEach((q, i) => {
      const v = ans.get(r.no + ':' + q), x = T.get((qt.get(q) || {}).topic);
      if (!x) return;
      if (v) { if (v.conf === 'g') guessed++; else sure++; if (v.ok && v.conf === 'g') guessOk++; if (!v.ok && v.conf === 's') sureWrong++; }
      if (rep[i] === '1') { back++; if (v && v.ok && v.conf === 's') backFixed++; }
      else { const rd = e && e.round === 2 ? 1 : 0; x.r[rd][1]++; if (v && v.ok && v.conf === 's') x.r[rd][0]++; }
      last.set(q, {x, v});
    });
  }
  for (const {x, v} of last.values()) {
    x.n++;
    if (!v) x.blank++;
    else if (v.ok && v.conf === 's') x.sure++;
    else if (v.ok) x.guessOk++;
    else x.wrong++;
  }
  const level = p => p < 60 ? 'weak' : p <= 80 ? 'mid' : 'strong';
  const topics = [...T.values()].map(x => {
    const pct = x.n ? Math.round(x.sure / x.n * 1000) / 10 : null;
    return {...x, pct, level: pct == null ? null : level(pct)};
  });
  const order = topics.filter(x => x.pct != null).sort((a, b) => a.pct - b.pct || b.guessOk - a.guessOk || a.name.localeCompare(b.name))
    .map(x => ({topic: x.id, name: x.name, sheet: x.sheet, pct: x.pct, level: x.level}));
  const per = {};
  for (const r of a.results) per[r.no] = (per[r.no] || 0) + 1;
  const took = Object.values(per).filter(k => k >= c.attend_min).length;
  return {code, topics, order, guessOk, guessed, sure, sureWrong, back, backFixed, took, total: c.exams.length, pass: took >= c.pass, attend_min: c.attend_min};
}

async function pilot(path, req, url, env, db, u) {
  await pilotSetup(db);
  const m = req.method, body = m === 'POST' ? await req.json().catch(() => ({})) : {};
  const p = String(url.searchParams.get('p') || body.p || '');
  if (!PID.test(p)) return json({error: 'bad'}, 400);
  const c = await pilotCfg(db, p);
  if (!c) return json({error: 'no pilot'}, 404);
  const now = Date.now();
  if (path === 'pilot/me' && m === 'GET') {
    const out = {p, title: c.title, start: c.start, now, day: c.start ? pDay(c, now) : null, days: c.days, n: c.n, mins: c.mins, pass: c.pass,
      user: u ? pub(u) : null, member: null};
    const sched = e => ({no: e.no, day: e.day, topic: e.topic, name: (c.T.get(e.topic) || {}).name || e.topic, round: e.round});
    out.exams = c.start ? c.exams.map(sched) : [];
    out.ready = !!c.exams.length;
    if (!u) return json(out);
    const mem = await pilotMem(db, p, u.id);
    if (!mem || mem.st === 'out') return json(out);
    out.member = {st: mem.st, code: mem.code || '', nick: mem.nick || ''};
    if (mem.st !== 'ok' || !c.start || !c.exams.length || !mem.nick) return json(out);
    const [s, a] = await db.batch([
      db.prepare('SELECT no, ts, dl, done FROM pilot_sit WHERE pilot = ? AND uid = ?').bind(p, u.id),
      db.prepare('SELECT no, COUNT(*) k, SUM(ok) ok FROM pilot_ans WHERE pilot = ? AND uid = ? GROUP BY no').bind(p, u.id)
    ]);
    const sits = new Map(s.results.map(r => [r.no, r])), cnt = new Map(a.results.map(r => [r.no, r]));
    out.exams = c.exams.map(e => {
      const st = examState(c, e, sits.get(e.no), now), x = {...sched(e), st, open: dOpen(c, e.day), close: dClose(c, e.day)};
      const k = cnt.get(e.no);
      x.answered = k ? k.k : 0;
      if (st === 'closed' && k) x.ok = k.ok || 0;
      if (st === 'going') x.left = sits.get(e.no).dl - now;
      x.reveal = dReveal(c, e.day);
      return x;
    });
    out.took = a.results.filter(r => r.k >= c.attend_min).length;
    out.attend_min = c.attend_min;
    out.sheets = sheetsFor(c, mem.code, sits, now);
    // রাতের ফর্ম: দিন d-র রাত ৯টা থেকে পরদিন সকাল ৬টা
    const d = pDay(c, now), fAt = d >= 1 && d <= c.days ? dOpen(c, d) + (c.form_hour - 6) * H : null;
    if (c.form && fAt && now >= fAt) out.form = {day: d, url: c.form.replace(/\{code\}/g, encodeURIComponent(mem.code)).replace(/\{day\}/g, String(d))};
    else if (c.form && fAt) out.formAt = fAt;
    out.report = now >= dReveal(c, c.days);
    out.reportAt = dReveal(c, c.days);
    return json(out);
  }
  if (!u) return json({error: 'login'}, 401);
  // যোগ দেওয়া আর নাম বদলানো একই পথে; নাম ছাড়া যোগ দেওয়া যায় না
  if ((path === 'pilot/join' || path === 'pilot/name') && m === 'POST') {
    const nick = cleanNick(body.nick);
    if (!nick) return json({error: 'nick'}, 400);
    if (path === 'pilot/join') await db.prepare("INSERT OR IGNORE INTO pilot_mem(pilot, uid, code, st, ts, nick) VALUES(?,?,NULL,'wait',?,?)").bind(p, u.id, now, nick).run();
    await db.prepare('UPDATE pilot_mem SET nick = ? WHERE pilot = ? AND uid = ?').bind(nick, p, u.id).run();
    const mem = await pilotMem(db, p, u.id);
    if (!mem) return json({error: 'member'}, 403);
    return json({member: {st: mem.st, code: mem.code || '', nick: mem.nick || ''}});
  }
  const mem = await pilotMem(db, p, u.id), admin = isAdmin(u, env);
  if (path === 'pilot/report' && m === 'GET') {
    const code = url.searchParams.get('code');
    if (code && admin) {
      const w = await db.prepare("SELECT uid, code FROM pilot_mem WHERE pilot = ? AND code = ?").bind(p, code).first();
      if (!w) return json({error: 'no member'}, 404);
      return json(await pilotReportFor(db, c, w.uid, w.code));
    }
    if (!mem || mem.st !== 'ok') return json({error: 'member'}, 403);
    if (!c.start || !c.exams.length) return json({error: 'soon'}, 403);
    if (now < dReveal(c, c.days)) return json({error: 'soon', at: dReveal(c, c.days)}, 403);
    return json(await pilotReportFor(db, c, u.id, mem.code));
  }
  if (!mem || mem.st !== 'ok') return json({error: 'member'}, 403);
  if (!mem.nick) return json({error: 'nick'}, 403);
  // শিটের লিংকে চাপ (শিট দেখানো আর খোলা আলাদা মাপা যায়)
  if (path === 'pilot/sheet' && m === 'POST') {
    const t = String(body.topic || '');
    if (!c.T.has(t)) return json({error: 'bad'}, 400);
    await db.prepare('INSERT INTO pilot_sheet(pilot, uid, topic, ts, last, n) VALUES(?,?,?,?,?,1) ON CONFLICT(pilot, uid, topic) DO UPDATE SET last = excluded.last, n = n + 1')
      .bind(p, u.id, t, now, now).run();
    return json({ok: true});
  }
  if (!c.start || !c.exams.length) return json({error: 'nostart'}, 403);
  const no = parseInt(url.searchParams.get('no') || body.no, 10), e = c.E.get(no);
  if (!e) return json({error: 'bad'}, 400);
  const sit = await db.prepare('SELECT no, ts, dl, qs, rep, done FROM pilot_sit WHERE pilot = ? AND uid = ? AND no = ?').bind(p, u.id, no).first();

  if (path === 'pilot/start' && m === 'POST') {
    let s = sit;
    if (!s) {
      if (now < dOpen(c, e.day)) return json({error: 'soon', at: dOpen(c, e.day)}, 403);
      if (now >= dClose(c, e.day)) return json({error: 'closed'}, 403);
      const per = await pickPersonal(db, c, u.id, e), need = (c.personal == null ? 3 : c.personal) - per.length;
      const fill = e.fill.filter(q => !e.qs.includes(q) && !per.includes(q)).slice(0, Math.max(0, need));
      const qs = [...e.qs, ...fill, ...per], rep = [...e.qs.map(() => 0), ...fill.map(() => 0), ...per.map(() => 1)];
      s = {no, ts: now, dl: now + c.mins * 60e3, qs: qs.join(','), rep: rep.join(','), done: null};
      const r = await db.prepare('INSERT OR IGNORE INTO pilot_sit(pilot, uid, no, ts, dl, qs, rep, done) VALUES(?,?,?,?,?,?,?,NULL)')
        .bind(p, u.id, no, s.ts, s.dl, s.qs, s.rep).run();
      // একই সময়ে দুই ফোন থেকে শুরু হলে যেটা আগে লেখা হয়েছে সেটাই
      if (!r.meta || !r.meta.changes) s = await db.prepare('SELECT no, ts, dl, qs, rep, done FROM pilot_sit WHERE pilot = ? AND uid = ? AND no = ?').bind(p, u.id, no).first();
    }
    if (s.done || now >= s.dl + GRACE) return json({error: 'done'}, 403);
    const ids = s.qs.split(','), rep = s.rep.split(','), Q = await pilotQs(db, p, ids);
    const {results} = await db.prepare('SELECT qid, pick, conf FROM pilot_ans WHERE pilot = ? AND uid = ? AND no = ?').bind(p, u.id, no).all();
    return json({no, name: (c.T.get(e.topic) || {}).name || e.topic, left: s.dl - now, mins: c.mins,
      qs: ids.filter(id => Q.has(id)).map((id, i) => ({id, q: Q.get(id).q, o: Q.get(id).o, r: rep[ids.indexOf(id)] === '1' ? 1 : 0})),
      done: results.map(r => [r.qid, r.pick, r.conf])});
  }
  if (path === 'pilot/ans' && m === 'POST') {
    if (!sit) return json({error: 'nosit'}, 403);
    if (now > Math.min(sit.dl + GRACE + LATE, dReveal(c, e.day))) return json({error: 'late'}, 403);
    const late = now > sit.dl + GRACE ? 1 : 0, cts = num(body.cts) ? Math.round(body.cts) : null;
    const ids = sit.qs.split(','), i = ids.indexOf(String(body.qid || ''));
    if (i < 0) return json({error: 'bad'}, 400);
    const conf = body.conf === 's' || body.conf === 'g' ? body.conf : null, pick = body.pick;
    const Q = (await pilotQs(db, p, [ids[i]])).get(ids[i]);
    if (!Q || !conf || !Number.isInteger(pick) || pick < 0 || pick >= Q.o.length) return json({error: 'bad'}, 400);
    const sec = Math.max(0, Math.min(Math.round(num(body.sec) || 0), c.mins * 60 + 60));
    await db.prepare('INSERT OR IGNORE INTO pilot_ans(pilot, uid, no, qid, topic, pick, ok, conf, sec, ts, rep, late, cts, qv) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(p, u.id, no, ids[i], Q.topic, pick, pick === Q.a ? 1 : 0, conf, sec, now, sit.rep.split(',')[i] === '1' ? 1 : 0, late, cts, qVer(Q)).run();
    return json({ok: true});
  }
  if (path === 'pilot/done' && m === 'POST') {
    if (sit && !sit.done) await db.prepare('UPDATE pilot_sit SET done = ? WHERE pilot = ? AND uid = ? AND no = ?').bind(Math.min(now, sit.dl + GRACE), p, u.id, no).run();
    return json({ok: true});
  }
  if (path === 'pilot/review' && m === 'GET') {
    if (now < dReveal(c, e.day)) return json({error: 'soon', at: dReveal(c, e.day)}, 403);
    const ids = sit ? sit.qs.split(',') : e.qs, rep = sit ? sit.rep.split(',') : [];
    const Q = await pilotQs(db, p, ids);
    const {results} = await db.prepare('SELECT qid, pick, ok, conf FROM pilot_ans WHERE pilot = ? AND uid = ? AND no = ?').bind(p, u.id, no).all();
    const A = new Map(results.map(r => [r.qid, r]));
    return json({no, name: (c.T.get(e.topic) || {}).name || e.topic, took: !!sit,
      qs: ids.filter(id => Q.has(id)).map((id, i) => { const q = Q.get(id), a = A.get(id);
        return {id, q: q.q, o: q.o, a: q.a, e: q.e || '', r: rep[ids.indexOf(id)] === '1' ? 1 : 0, pick: a ? a.pick : -1, conf: a ? a.conf : ''}; })},
      200, {'Cache-Control': 'no-store'});
  }
  return json({error: 'not found'}, 404);
}

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dhakaIso = ts => ts ? new Date(ts + 6 * H).toISOString().replace('Z', '+06:00') : '';

async function pilotAdmin(path, url, req, db) {
  await pilotSetup(db);
  const m = req.method, body = m === 'POST' ? await req.json().catch(() => ({})) : {};
  const p = String(url.searchParams.get('p') || body.p || (body.cfg && body.cfg.id) || '');
  if (!PID.test(p)) return json({error: 'bad'}, 400);
  if (path === 'admin/pilot/set' && m === 'POST') {
    const err = pilotCheck(body.cfg);
    if (err.length) return json({error: 'check', list: err}, 400);
    const old = await pilotCfg(db, p), s = pilotSlim(body.cfg);
    // তারিখ আর ফর্ম অ্যাডমিন পাতায় আলাদা বদলানো যায়; নতুন সেটে না থাকলে আগেরটা থাকে
    if (old) { if (!s.start) s.start = old.start; if (!s.form) s.form = old.form; }
    await db.prepare('INSERT INTO pilot(id, cfg, updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET cfg = excluded.cfg, updated = excluded.updated')
      .bind(p, JSON.stringify(s), Date.now()).run();
    return json({ok: true});
  }
  const c = await pilotCfg(db, p);
  if (!c) return json({error: 'no pilot'}, 404);
  if (path === 'admin/pilot/q' && m === 'POST') {
    const list = (Array.isArray(body.qs) ? body.qs : []).slice(0, 40), bad = [], vl = [];
    const st = db.prepare('INSERT INTO pilot_q(pilot, qid, topic, d) VALUES(?,?,?,?) ON CONFLICT(pilot, qid) DO UPDATE SET topic = excluded.topic, d = excluded.d');
    const rows = [];
    for (const q of list) {
      const o = Array.isArray(q && q.o) ? q.o.map(x => nfc(String(x)).slice(0, 600)) : [];
      if (!q || !QID.test(q.id || '') || !c.T.has(q.t) || !nfc(q.q) || o.length < 2 || o.length > 6 || !Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) { bad.push(q && q.id); continue; }
      const d = {q: nfc(q.q).slice(0, 2000), o, a: q.a, e: nfc(q.e || '').slice(0, 6000)};
      rows.push(st.bind(p, q.id, q.t, JSON.stringify(d))); vl.push([q.id, d]);
    }
    const changed = await qverLog(db, 'pilot:' + p, 'pilot_q', 'pilot', vl);
    if (rows.length) await db.batch(rows);
    return json({ok: true, n: rows.length, bad, changed});
  }
  if (path === 'admin/pilot/cfg' && m === 'POST') {
    const s = pilotSlim(c);
    if (typeof body.start === 'string') { if (body.start && !pOpen(body.start)) return json({error: 'date'}, 400); s.start = body.start; }
    if (typeof body.form === 'string') { s.form = body.form.trim(); if (s.form && pilotCheck({...s, form: s.form}).some(x => x.startsWith('form'))) return json({error: 'form'}, 400); }
    await db.prepare('INSERT INTO pilot(id, cfg, updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET cfg = excluded.cfg, updated = excluded.updated').bind(p, JSON.stringify(s), Date.now()).run();
    return json({ok: true, start: s.start, form: s.form});
  }
  if (path === 'admin/pilot/mem' && m === 'POST') {
    const uid = parseInt(body.uid, 10), act = body.act;
    if (!uid || !['ok', 'wait', 'out'].includes(act)) return json({error: 'bad'}, 400);
    const w = await pilotMem(db, p, uid);
    if (!w) return json({error: 'no member'}, 404);
    let code = w.code;
    if (act === 'ok' && !code) {
      // পরের খালি নম্বর; একবার দেওয়া কোড আর বদলায় না (বাদ দিলেও), তাই রপ্তানিতে এক কোড সবসময় একই মানুষ
      const {results} = await db.prepare('SELECT code FROM pilot_mem WHERE pilot = ? AND code IS NOT NULL').bind(p).all();
      const max = results.reduce((x, r) => Math.max(x, codeNo(r.code)), 0);
      code = 'P' + String(max + 1).padStart(2, '0');
    }
    await db.prepare('UPDATE pilot_mem SET st = ?, code = ? WHERE pilot = ? AND uid = ?').bind(act, code, p, uid).run();
    return json({ok: true, code});
  }
  if (path === 'admin/pilot/reset' && m === 'POST') {
    const uid = parseInt(body.uid, 10), no = parseInt(body.no, 10);
    if (!uid || !no) return json({error: 'bad'}, 400);
    await db.batch([
      db.prepare('DELETE FROM pilot_ans WHERE pilot = ? AND uid = ? AND no = ?').bind(p, uid, no),
      db.prepare('DELETE FROM pilot_sit WHERE pilot = ? AND uid = ? AND no = ?').bind(p, uid, no)
    ]);
    return json({ok: true});
  }
  if (path === 'admin/pilot/csv' && m === 'GET') {
    const [mm, s, a] = await db.batch([
      db.prepare("SELECT uid, code FROM pilot_mem WHERE pilot = ? AND code IS NOT NULL").bind(p),
      db.prepare('SELECT uid, no, ts, dl, qs, rep FROM pilot_sit WHERE pilot = ? ORDER BY uid, no').bind(p),
      db.prepare('SELECT uid, no, qid, topic, pick, ok, conf, sec, ts, rep, late FROM pilot_ans WHERE pilot = ?').bind(p)
    ]);
    if (url.searchParams.get('kind') === 'sheets') {
      const cm = new Map(mm.results.map(r => [r.uid, r.code]));
      const {results} = await db.prepare('SELECT uid, topic, ts, last, n FROM pilot_sheet WHERE pilot = ? ORDER BY uid, ts').bind(p).all();
      const L = ['code,sheet_early_group,topic_id,topic_group,first_open,last_open,opens'];
      for (const r of results) { const cd = cm.get(r.uid); if (!cd) continue;
        L.push([cd, earlyGroup(cd), r.topic, (c.T.get(r.topic) || {}).group, dhakaIso(r.ts), dhakaIso(r.last), r.n].map(csvCell).join(',')); }
      return new Response('\ufeff' + L.join('\n') + '\n', {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${p}-sheets.csv"`}});
    }
    const code = new Map(mm.results.map(r => [r.uid, r.code])), A = new Map(a.results.map(r => [r.uid + ':' + r.no + ':' + r.qid, r]));
    const allIds = [...new Set(s.results.flatMap(r => r.qs.split(',')))], Q = await pilotQs(db, p, allIds);
    const head = ['code', 'sheet_early_group', 'exam_no', 'day', 'exam_topic', 'round', 'position', 'qid', 'topic_id', 'pick', 'correct', 'confidence', 'seconds', 'answered_at', 'returned', 'answered', 'late', 'started_at'];
    const lines = [head.join(',')];
    for (const r of s.results) {
      const cd = code.get(r.uid);
      if (!cd) continue;
      const e = c.E.get(r.no) || {}, rep = r.rep.split(',');
      r.qs.split(',').forEach((q, i) => {
        const v = A.get(r.uid + ':' + r.no + ':' + q);
        lines.push([cd, earlyGroup(cd), r.no, e.day, e.topic, e.round, i + 1, q, (Q.get(q) || {}).topic || '',
          v ? v.pick : -1, v ? v.ok : 0, v ? (v.conf === 's' ? 'sure' : 'guess') : '', v ? v.sec : '', v ? dhakaIso(v.ts) : '',
          rep[i] === '1' ? 1 : 0, v ? 1 : 0, v ? v.late || 0 : '', dhakaIso(r.ts)].map(csvCell).join(','));
      });
    }
    return new Response('﻿' + lines.join('\n') + '\n', {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${p}-answers.csv"`}});
  }
  if (path === 'admin/pilot' && m === 'GET') {
    const [mm, s, a, q] = await db.batch([
      db.prepare('SELECT m.uid, m.code, m.st, m.ts, m.nick, u.name, u.email FROM pilot_mem m LEFT JOIN users u ON u.id = m.uid WHERE m.pilot = ? ORDER BY m.code IS NULL, m.code, m.ts').bind(p),
      db.prepare('SELECT uid, no, ts, done FROM pilot_sit WHERE pilot = ?').bind(p),
      db.prepare('SELECT uid, no, COUNT(*) k, SUM(ok) ok, SUM(conf = \'g\') g FROM pilot_ans WHERE pilot = ? GROUP BY uid, no').bind(p),
      db.prepare('SELECT COUNT(*) n FROM pilot_q WHERE pilot = ?').bind(p)
    ]);
    const slim = pilotSlim(c);
    const need = new Set(c.exams.flatMap(e => [...e.qs, ...e.fill]));
    const {results: have} = await db.prepare('SELECT qid FROM pilot_q WHERE pilot = ?').bind(p).all();
    const hs = new Set(have.map(r => r.qid)), missing = [...need].filter(x => !hs.has(x));
    return json({ts: Date.now(), cfg: {...slim, exams: slim.exams.map(e => ({no: e.no, day: e.day, topic: e.topic}))}, day: c.start ? pDay(c, Date.now()) : null,
      qn: q.results[0].n, missing: missing.slice(0, 50), missingN: missing.length, members: mm.results,
      sits: s.results, ans: a.results}, 200, {'Cache-Control': 'no-store'});
  }
  return json({error: 'not found'}, 404);
}

// ---------- নিজের পরিকল্পনা: অবস্থা-যাচাই (যেমন বিসিএস, ২৫০ প্রশ্ন ৬ ভাগে) ----------
/* পাতা /plan/<সেট>/ (যেমন /plan/bcs/ → সেট bcs-start)। লগইন বাধ্যতামূলক। প্রশ্নের সেট (উত্তরসহ) রিপোতে নয়, অ্যাডমিন পাতা
   /admin/diag/ থেকে D1-এ ওঠে; আসল কপি Lyanna_data/pilot/custom-plan/<সেট>.json (নকশা: সেখানকার PLAN.md §৯)।
   প্রতিটা ভাগ আলাদা আসে, উত্তর আর ব্যাখ্যা ছাড়া; অপশনের ক্রম সার্ভারে এলোমেলো (মানুষ আর প্রশ্ন ধরে স্থির), ফোন আসল ক্রম জানে না।
   সময় সার্ভারে গোনা: ভাগ শুরুর মুহূর্ত D1-এ, রিলোড বা ট্যাব বদলেও ঘড়ি চলে। উত্তর প্রথম চাপেই লক (সার্ভার প্রথম দাগটাই রাখে)।
   GET  /api/diag/me?s=            → সেট, বিষয়, ভাগের তালিকা আর নিজের অবস্থা; সব ভাগ শেষ হলে বিষয়ভিত্তিক চিত্র (status)
   POST /api/diag/start {s,part}   → ভাগ শুরু বা চলতিটা আবার খোলা: প্রশ্ন (উত্তর ছাড়া), বাকি সময়, আগে দেওয়া দাগ
   POST /api/diag/save {s,part,ans:[[qid,দাগ,ms]],hid,hn,fin} → উত্তর জমা (কয়েকটা একসঙ্গে); fin বা সময় শেষ হলে ভাগ বন্ধ, ফল ফেরত
   GET  /api/diag/review?s=&part=  → বন্ধ ভাগের উত্তর আর ব্যাখ্যা
   অ্যাডমিন: GET admin/diag?s= · POST admin/diag/set {cfg} · POST admin/diag/q {s,qs:[…]} (এক বারে ৪০) · POST admin/diag/reset {s,uid,part}
   D1 লেখা কম: একজনের এক ভাগ = এক সারি, উত্তর জমে সেই সারিতেই (৫টা করে), তাই ২৫০ প্রশ্নে ৬০-৭০টা লেখা। */
const DIAG_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS diag_set(id TEXT PRIMARY KEY, cfg TEXT NOT NULL, updated INTEGER)',
  'CREATE TABLE IF NOT EXISTS diag_q(sid TEXT NOT NULL, qid TEXT NOT NULL, part INTEGER NOT NULL, s TEXT NOT NULL, d TEXT NOT NULL, PRIMARY KEY(sid, qid))',
  'CREATE TABLE IF NOT EXISTS msg(id INTEGER PRIMARY KEY, uid INTEGER NOT NULL, ts INTEGER NOT NULL, src TEXT, text TEXT NOT NULL, seen INTEGER)',
  'CREATE INDEX IF NOT EXISTS msg_uid ON msg(uid, ts)',
  'CREATE TABLE IF NOT EXISTS diag_att(sid TEXT NOT NULL, uid INTEGER NOT NULL, part INTEGER NOT NULL, ts INTEGER NOT NULL, dl INTEGER NOT NULL, ans TEXT NOT NULL, done INTEGER, res TEXT, hid INTEGER, hn INTEGER, PRIMARY KEY(sid, uid, part))'
];
let diagReady = false;
async function diagSetup(db) {
  if (diagReady) return;
  await db.batch(DIAG_SCHEMA.map(s => db.prepare(s)));
  // meta: ফোন/কম্পিউটার, পর্দার মাপ, কতবার পাতা আবার খোলা (একই সারিতে, বাড়তি লেখা নয়)
  try { await db.prepare('ALTER TABLE diag_att ADD COLUMN meta TEXT').run(); } catch (e) { /* আগেই আছে */ }
  diagReady = true;
}
const diagMeta = (req, b) => {
  const ua = req.headers.get('User-Agent') || '';
  const dev = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Mobile/i.test(ua) ? 'mobile' : 'desktop';
  const w = Number.isInteger(b.w) && b.w > 0 && b.w < 10000 ? b.w : null;
  return {dev, w, app: b.app === 1 ? 1 : 0};
};
// পাতার ঠিকানা → সেট (চেনা সেট সেট তোলার আগেই পাতা খোলে, "শিগগির" দেখায়)
const DIAG_KNOWN = {'bcs-start': 'বিসিএস · অবস্থা-যাচাই', 'pb-start': 'পেট্রোবাংলা · অবস্থা-যাচাই'};
// বিষয় → সাইটের বিদ্যমান বিষয়ের পাতা (পরিকল্পনার প্রথম সংস্করণে এগুলোই পথ)
const DIAG_LINK = {bn: '/subject/bangla/', en: '/subject/english/', bd: '/subject/bangladesh/', bda: '/subject/bangladesh/', eng: '/subject/english/', intl: '/subject/international/', geo: '/subject/geography/',
  sci: '/subject/science/', ict: '/subject/ict/', math: '/subject/math/', mental: '/subject/mental/', ethics: '/subject/ethics/'};

function diagCheck(c) {
  const err = [];
  if (!c || typeof c !== 'object') return ['cfg নেই'];
  if (!PID.test(c.id || '')) err.push('id ঠিক নয়');
  if (!Array.isArray(c.subjects) || !c.subjects.length) err.push('subjects নেই');
  const sids = new Set();
  for (const s of c.subjects || []) {
    if (!TID.test(s.id || '') || sids.has(s.id)) err.push('বিষয়-আইডি ঠিক নয় বা দুবার: ' + s.id);
    sids.add(s.id);
    if (!Number.isInteger(s.marks) || s.marks < 1) err.push('বিষয় ' + s.id + ': marks লাগবে');
  }
  if (!Array.isArray(c.parts) || !c.parts.length || c.parts.length > 12) err.push('parts নেই (১-১২টি)');
  const seen = new Set(), nos = new Set();
  for (const p of c.parts || []) {
    if (!Number.isInteger(p.no) || p.no < 1 || nos.has(p.no)) err.push('ভাগ-নম্বর ঠিক নয় বা দুবার: ' + p.no);
    nos.add(p.no);
    if (!Number.isInteger(p.mins) || p.mins < 1 || p.mins > 120) err.push('ভাগ ' + p.no + ': mins ১-১২০');
    if (!Array.isArray(p.subjects) || !p.subjects.length || p.subjects.some(x => !sids.has(x))) err.push('ভাগ ' + p.no + ': subjects সেটের বিষয় থেকে');
    if (!Array.isArray(p.qs) || p.qs.length < 1 || p.qs.length > 80) err.push('ভাগ ' + p.no + ': qs-এ ১-৮০টি প্রশ্ন');
    for (const q of p.qs || []) { if (!QID.test(q)) err.push('ভাগ ' + p.no + ': প্রশ্ন-আইডি ঠিক নয় ' + q); else if (seen.has(q)) err.push('প্রশ্ন দুবার: ' + q); seen.add(q); }
  }
  return err.slice(0, 40);
}
const diagSlim = c => ({id: c.id, title: str(c.title, 120) || c.id,
  subjects: c.subjects.map(s => ({id: s.id, name: str(s.name, 60) || s.id, marks: s.marks})),
  parts: c.parts.map(p => ({no: p.no, title: str(p.title, 80) || '', subjects: p.subjects, mins: p.mins, qs: p.qs}))});

async function diagCfg(db, sid) {
  const r = await db.prepare('SELECT cfg, updated FROM diag_set WHERE id = ?').bind(sid).first();
  if (!r) return DIAG_KNOWN[sid] ? {id: sid, title: DIAG_KNOWN[sid], subjects: [], parts: [], updated: 0, P: new Map(), S: new Map()} : null;
  const c = JSON.parse(r.cfg);
  c.updated = r.updated;
  c.P = new Map(c.parts.map(p => [p.no, p]));
  c.S = new Map(c.subjects.map(s => [s.id, s]));
  return c;
}
async function diagQs(db, sid, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const part = ids.slice(i, i + 40);
    const {results} = await db.prepare(`SELECT qid, s, d FROM diag_q WHERE sid = ? AND qid IN (${part.map(() => '?').join(',')})`).bind(sid, ...part).all();
    for (const r of results) out.set(r.qid, {s: r.s, ...JSON.parse(r.d)});
  }
  return out;
}
// অপশনের ক্রম: মানুষ আর প্রশ্ন ধরে স্থির এলোমেলো; ord[দেখানো ক্রম] = আসল ক্রম
function dOrder(n, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const dSeed = (sid, uid, qid) => sid + ':' + uid + ':' + qid;
const DIAG_LATE = 60 * 60e3; // নেট কেটে গেলে ফোনে জমা উত্তর সময় শেষের পরে এক ঘণ্টা পর্যন্ত নেওয়া হয় (ঘড়ি থামে না, শুধু পৌঁছাতে দেরি)
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// একটা ভাগের ফল: বিষয় ধরে ঠিক/ভুল/বাদ, আর তাড়াহুড়ার চিহ্ন (PLAN.md §৯)
function diagScore(c, p, Q, ans, hid, hn) {
  const by = {}, picks = [], ms = [];
  let ok = 0, no = 0, skip = 0;
  for (const s of p.subjects) by[s] = {n: 0, ok: 0, no: 0, skip: 0};
  for (const qid of p.qs) {
    const q = Q.get(qid);
    if (!q) continue;
    const x = by[q.s] || (by[q.s] = {n: 0, ok: 0, no: 0, skip: 0}), a = ans[qid];
    x.n++;
    if (!a || a[0] < 0) { x.skip++; skip++; continue; }
    picks.push(a[0]); if (a[2] > 0) ms.push(a[2]);
    if (a[1]) { x.ok++; ok++; } else { x.no++; no++; }
  }
  const n = ok + no + skip, k = picks.length, f = [];
  const med = median(ms);
  if (k >= 10 && med != null && med < 5000) f.push('fast');
  else if (k >= 10 && med != null && med < 8000) f.push('quick');
  let run = 1, best = k ? 1 : 0;
  for (let i = 1; i < k; i++) { run = picks[i] === picks[i - 1] ? run + 1 : 1; best = Math.max(best, run); }
  const cnt = {}; for (const x of picks) cnt[x] = (cnt[x] || 0) + 1;
  const top = Math.max(0, ...Object.values(cnt));
  if (best >= 8 || (k >= 20 && top / k > 0.6)) f.push('same');
  if (k >= 30 && ok / k < 0.2) f.push('low');
  if (n && skip / n > 0.5) f.push('few');
  if ((hid || 0) > 60 || (hn || 0) > 3) f.push('away');
  const unsure = f.some(x => x === 'fast' || x === 'same' || x === 'low');
  return {part: p.no, n, ok, no, skip, by, flags: f, unsure, med: med == null ? null : Math.round(med / 100) / 10};
}

// সব ভাগ মিলিয়ে বিষয়ের চিত্র। শতাংশ শুধু ব্যান্ড ঠিক করতে; পাতায় দেখানো হয় "৪০-এ ২২"
function diagStatus(c, done) {
  const S = c.subjects.map(s => ({id: s.id, name: s.name, marks: s.marks, link: DIAG_LINK[s.id] || '', n: 0, ok: 0, no: 0, skip: 0, unsure: false, taken: false}));
  const M = new Map(S.map(x => [x.id, x]));
  for (const r of done) for (const [sid, v] of Object.entries(r.by || {})) {
    const x = M.get(sid); if (!x) continue;
    x.n += v.n; x.ok += v.ok; x.no += v.no; x.skip += v.skip; x.taken = true;
    if (r.unsure) x.unsure = true;
  }
  for (const x of S) {
    if (!x.taken || !x.n) { x.band = null; continue; }
    const pct = x.ok / x.n * 100;
    x.small = x.n < 20;
    // শিক্ষার্থী শুধু নম্বরের ব্যান্ড দেখেন; তাড়াহুড়া/কম উত্তরের চিহ্ন দেখান না (PIASH, ২০২৬-১১-০৩), শুধু অ্যাডমিন পাতায়
    x.band = pct < 40 ? 'focus' : pct < 70 ? 'mid' : 'strong';
    x.few = (x.ok + x.no) / x.n < 0.6;
    x.edge = Math.abs(pct - 40) < 5 || Math.abs(pct - 70) < 5;
    // নম্বর বাড়ানোর সুযোগ G = সিলেবাসের নম্বর × (০.৮০ − মান), ০.৮০-র ওপরে শূন্য (SUBJECT-PLAN.md §৩.২);
    // অনিশ্চিত বা কম উত্তরের বিষয়ে চুপচাপ মান অর্ধেক ধরা
    const known = x.unsure || x.few ? 0.5 : pct / 100;
    x.gain = Math.round(x.marks * Math.max(0, 0.8 - known) * 10) / 10;
  }
  const order = S.filter(x => x.band).sort((a, b) => b.gain - a.gain || a.name.localeCompare(b.name)).map(x => x.id);
  return {subjects: S, order, parts: c.parts.length, doneParts: done.length};
}

// শিক্ষার্থীর কাছে যায় শুধু নম্বর; চিহ্ন (তাড়াহুড়া ইত্যাদি) অ্যাডমিনের
const resPub = r => r && {part: r.part, n: r.n, ok: r.ok, no: r.no, skip: r.skip, by: r.by};
const statusPub = st => st && {...st, subjects: st.subjects.map(({unsure, few, gain, ...x}) => x)};
async function diag(path, req, url, env, db, u) {
  await diagSetup(db);
  const m = req.method, body = m === 'POST' ? await req.json().catch(() => ({})) : {};
  const sid = String(url.searchParams.get('s') || body.s || '');
  if (!PID.test(sid)) return json({error: 'bad'}, 400);
  const c = await diagCfg(db, sid);
  if (!c) return json({error: 'no set'}, 404);
  const now = Date.now();
  const partsPub = c.parts.map(p => ({no: p.no, title: p.title, subjects: p.subjects, n: p.qs.length, mins: p.mins}));
  if (path === 'diag/me' && m === 'GET') {
    const out = {s: sid, title: c.title, now, subjects: c.subjects.map(s => ({id: s.id, name: s.name, marks: s.marks})), parts: partsPub,
      ready: !!c.parts.length, user: u ? pub(u) : null};
    if (!u) return json(out);
    const {results} = await db.prepare('SELECT part, ts, dl, done, res, ans FROM diag_att WHERE sid = ? AND uid = ?').bind(sid, u.id).all();
    const A = new Map(results.map(r => [r.part, r]));
    const finished = [];
    out.parts = partsPub.map(p => {
      const r = A.get(p.no);
      if (!r) return {...p, st: 'todo'};
      if (!r.done && now < r.dl + GRACE) return {...p, st: 'going', left: r.dl - now, answered: Object.keys(JSON.parse(r.ans)).length};
      if (!r.res) return {...p, st: 'closing'}; // সময় শেষ, কিন্তু ফল এখনো গোনা হয়নি: পাতা খুললেই save দিয়ে বন্ধ হয়
      const res = JSON.parse(r.res); finished.push(res);
      return {...p, st: 'done', res: resPub(res)};
    });
    out.status = finished.length ? statusPub(diagStatus(c, finished)) : null;
    out.all = !!c.parts.length && finished.length === c.parts.length;
    // অ্যাডমিনের বার্তা: না-দেখাগুলো আর শেষ কয়েকটা
    out.msgs = (await db.prepare('SELECT id, ts, text, seen FROM msg WHERE uid = ? ORDER BY ts DESC LIMIT 5').bind(u.id).all()).results;
    return json(out);
  }
  if (!u) return json({error: 'login'}, 401);
  if (path === 'diag/seen' && m === 'POST') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter(Number.isInteger).slice(0, 20);
    if (ids.length) await db.prepare(`UPDATE msg SET seen = ? WHERE uid = ? AND seen IS NULL AND id IN (${ids.map(() => '?').join(',')})`).bind(now, u.id, ...ids).run();
    return json({ok: true});
  }
  if (!c.parts.length) return json({error: 'soon'}, 403);
  const no = parseInt(url.searchParams.get('part') || body.part, 10), p = c.P.get(no);
  if (!p) return json({error: 'bad'}, 400);
  let att = await db.prepare('SELECT ts, dl, ans, done, res, hid, hn, meta FROM diag_att WHERE sid = ? AND uid = ? AND part = ?').bind(sid, u.id, no).first();

  if (path === 'diag/start' && m === 'POST') {
    if (!att) {
      await db.prepare("INSERT OR IGNORE INTO diag_att(sid, uid, part, ts, dl, ans, done, res, hid, hn, meta) VALUES(?,?,?,?,?,'{}',NULL,NULL,0,0,?)")
        .bind(sid, u.id, no, now, now + p.mins * 60e3, JSON.stringify({...diagMeta(req, body), opens: 1})).run();
      // দুই ফোন একসঙ্গে শুরু করলে যেটা আগে লেখা হয়েছে সেটাই
      att = await db.prepare('SELECT ts, dl, ans, done, res, hid, hn, meta FROM diag_att WHERE sid = ? AND uid = ? AND part = ?').bind(sid, u.id, no).first();
    }
    if (att.done || now >= att.dl + GRACE) return json({error: 'done'}, 403);
    if (now - att.ts > 3000) { // চলতি ভাগ আবার খোলা: গোনা থাকে (রিলোড, নেট কাটা, অন্য ফোন)
      const mt = (() => { try { return JSON.parse(att.meta || '{}') || {}; } catch (e) { return {}; } })();
      mt.opens = (mt.opens || 1) + 1;
      await db.prepare('UPDATE diag_att SET meta = ? WHERE sid = ? AND uid = ? AND part = ?').bind(JSON.stringify(mt), sid, u.id, no).run();
    }
    const Q = await diagQs(db, sid, p.qs), ans = JSON.parse(att.ans);
    const qs = p.qs.filter(id => Q.has(id)).map(id => {
      const q = Q.get(id), ord = dOrder(q.o.length, dSeed(sid, u.id, id));
      return {id, s: q.s, q: q.q, o: ord.map(i => q.o[i])};
    });
    return json({part: no, title: p.title, mins: p.mins, left: att.dl - now, qs, done: Object.entries(ans).map(([id, a]) => [id, a[0]])});
  }
  if (path === 'diag/save' && m === 'POST') {
    if (!att) return json({error: 'nosit'}, 403);
    if (att.done) return json({ok: true, res: att.res ? resPub(JSON.parse(att.res)) : null});
    const late = now > att.dl + GRACE + DIAG_LATE;
    let lateN = 0;
    const ans = JSON.parse(att.ans), inPart = new Set(p.qs), list = (Array.isArray(body.ans) ? body.ans : []).slice(0, 80);
    let Q = null;
    if (!late && list.length) {
      Q = await diagQs(db, sid, p.qs);
      for (const x of list) {
        if (!Array.isArray(x) || !inPart.has(x[0]) || ans[x[0]]) continue; // প্রথম দাগটাই থাকে
        const q = Q.get(x[0]); if (!q) continue;
        const pick = Number.isInteger(x[1]) && x[1] >= -1 && x[1] < q.o.length ? x[1] : null;
        if (pick == null) continue;
        const ms = Math.max(0, Math.min(Math.round(num(x[2]) || 0), 3600e3));
        const ok = pick >= 0 && dOrder(q.o.length, dSeed(sid, u.id, x[0]))[pick] === q.a ? 1 : 0;
        ans[x[0]] = [pick, ok, ms, qVer(q)]; // ৪র্থ ঘর: দাগের সময়ের চাবি ও ব্যাখ্যা (পুরোনো দাগে নেই)
        if (now > att.dl + GRACE) lateN++;
      }
    }
    const hid = Math.max(att.hid || 0, Math.min(Math.round(num(body.hid) || 0), 7200)), hn = Math.max(att.hn || 0, Math.min(Math.round(num(body.hn) || 0), 500));
    // সময় শেষ হলেও নেট-কাটা ফোনের উত্তর আসার সুযোগ: fin না এলে সময়-শেষের পরে এক ঘণ্টা খোলা, তারপর যা আছে তাতেই বন্ধ
    const close = body.fin === true || now >= att.dl + GRACE + DIAG_LATE;
    let metaS = att.meta;
    if (lateN) { const mt = (() => { try { return JSON.parse(att.meta || '{}') || {}; } catch (e) { return {}; } })(); mt.late = (mt.late || 0) + lateN; metaS = JSON.stringify(mt); }
    let res = null;
    if (close) {
      Q = Q || await diagQs(db, sid, p.qs);
      res = diagScore(c, p, Q, ans, hid, hn);
      await db.prepare('UPDATE diag_att SET ans = ?, done = ?, res = ?, hid = ?, hn = ?, meta = ? WHERE sid = ? AND uid = ? AND part = ? AND done IS NULL')
        .bind(JSON.stringify(ans), Math.min(now, att.dl + GRACE), JSON.stringify(res), hid, hn, metaS, sid, u.id, no).run();
    } else {
      await db.prepare('UPDATE diag_att SET ans = ?, hid = ?, hn = ?, meta = ? WHERE sid = ? AND uid = ? AND part = ? AND done IS NULL')
        .bind(JSON.stringify(ans), hid, hn, metaS, sid, u.id, no).run();
    }
    return json({ok: true, n: Object.keys(ans).length, res: resPub(res), left: att.dl - now});
  }
  if (path === 'diag/review' && m === 'GET') {
    if (!att || !att.res) return json({error: 'soon'}, 403);
    const Q = await diagQs(db, sid, p.qs), ans = JSON.parse(att.ans);
    return json({part: no, title: p.title, res: resPub(JSON.parse(att.res)), qs: p.qs.filter(id => Q.has(id)).map(id => {
      const q = Q.get(id), ord = dOrder(q.o.length, dSeed(sid, u.id, id)), a = ans[id];
      return {id, s: q.s, q: q.q, o: ord.map(i => q.o[i]), a: ord.indexOf(q.a), pick: a ? a[0] : -1, e: q.e || ''};
    })}, 200, {'Cache-Control': 'no-store'});
  }
  return json({error: 'not found'}, 404);
}

// ---- বেখেয়ালি দাগানোর মাপ (শুধু অ্যাডমিন) ----
// না পড়ে দাগ: প্রশ্ন আর অপশনের মোট অক্ষর পড়তে যত সময় লাগার কথা (অক্ষরপ্রতি ৩০ ms, অন্তত ২.৫ সেকেন্ড), তার চেয়ে কম
// সহজে ভুল: যে প্রশ্ন বেশির ভাগ মানুষ পারেন (অন্তত ৮ জন দেখেছেন, ৭৫%+ ঠিক), বা সেট-ফাইলে lvl "easy", সেখানে ভুল
// দ্রুত ভুল: ৬ সেকেন্ডের কম সময়ে ভুল; ক্লান্তি: ভাগের প্রথম অর্ধেক আর শেষ অর্ধেকের ঠিকের হারের পার্থক্য
const readMs = q => Math.max(2500, ((q.q || '').length + (q.o || []).reduce((a, o) => a + String(o).length, 0)) * 30);
function diagItemP(c, all) {
  const P = new Map();
  for (const r of all) if (r.res) for (const id of (c.P.get(r.part) || {qs: []}).qs) {
    const x = P.get(id) || [0, 0], a = r.ans[id]; x[1]++; if (a && a[1]) x[0]++; P.set(id, x);
  }
  return P;
}
const isEasy = (q, p) => q.lvl === 'easy' || (p && p[1] >= 8 && p[0] / p[1] >= 0.75);
function diagCare(c, r, Q, P) {
  const qs = (c.P.get(r.part) || {qs: []}).qs, m = {answered: 0, noread: 0, easy: 0, easyWrong: 0, fastWrong: 0, wrong: 0, h1: [0, 0], h2: [0, 0]}, tags = {};
  const seen = qs.filter(id => r.ans[id] && r.ans[id][0] >= 0);
  seen.forEach((id, i) => {
    const q = Q.get(id), a = r.ans[id]; if (!q) return;
    const t = [];
    m.answered++;
    if (a[2] > 0 && a[2] < readMs(q)) { m.noread++; t.push('noread'); }
    if (isEasy(q, P.get(id))) { m.easy++; if (!a[1]) { m.easyWrong++; t.push('easywrong'); } }
    if (!a[1]) { m.wrong++; if (a[2] > 0 && a[2] < 6000) { m.fastWrong++; t.push('fastwrong'); } }
    const h = i < seen.length / 2 ? m.h1 : m.h2; h[1]++; if (a[1]) h[0]++;
    if (t.length) tags[id] = t;
  });
  const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
  m.noreadPct = rate(m.noread, m.answered);
  m.easyWrongPct = rate(m.easyWrong, m.easy);
  m.fastWrongPct = rate(m.fastWrong, m.wrong);
  m.tired = m.h1[1] >= 8 && m.h2[1] >= 8 ? rate(m.h1[0], m.h1[1]) - rate(m.h2[0], m.h2[1]) : null;
  // বেখেয়ালি সূচক ০-১০০: না পড়ে দাগ ৪০%, সহজে ভুল ৪০%, দ্রুত ভুল ২০%
  m.care = Math.min(100, Math.round(0.4 * m.noreadPct + 0.4 * m.easyWrongPct + 0.2 * m.fastWrongPct));
  return {m, tags};
}

/* তোলার চাবি: একটাই চাবি, D1-এ শুধু তার SHA-256 ছাপ। চাবি দেখা যায় একবারই, বানানোর সময়।
   নতুন বানালে পুরোনোটা বাতিল। GET admin/upkey → আছে কি না, কবে বানানো; POST admin/upkey → নতুন চাবি। */
const UPKEY_SQL = 'CREATE TABLE IF NOT EXISTS upkey(id INTEGER PRIMARY KEY CHECK(id = 1), hash TEXT NOT NULL, created INTEGER)';
async function upkeyOk(req, db) {
  const k = (req.headers.get('Authorization') || '').slice(7).trim();
  if (k.length < 30 || k.length > 100) return false;
  await db.prepare(UPKEY_SQL).run();
  const r = await db.prepare('SELECT hash FROM upkey WHERE id = 1').first();
  return !!r && r.hash === await sha(k);
}
async function upkeyAdmin(req, db) {
  await db.prepare(UPKEY_SQL).run();
  if (req.method === 'POST') {
    const raw = new Uint8Array(32); crypto.getRandomValues(raw);
    const key = 'ly_' + btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const now = Date.now();
    await db.prepare('INSERT INTO upkey(id, hash, created) VALUES(1, ?, ?) ON CONFLICT(id) DO UPDATE SET hash = excluded.hash, created = excluded.created')
      .bind(await sha(key), now).run();
    return json({ok: true, key, created: now}, 200, {'Cache-Control': 'no-store'});
  }
  const r = await db.prepare('SELECT created FROM upkey WHERE id = 1').first();
  return json({has: !!r, created: r ? r.created : null}, 200, {'Cache-Control': 'no-store'});
}
async function diagAdmin(path, url, req, db) {
  await diagSetup(db);
  const m = req.method, body = m === 'POST' ? await req.json().catch(() => ({})) : {};
  const sid = String(url.searchParams.get('s') || body.s || (body.cfg && body.cfg.id) || '');
  if (!PID.test(sid)) return json({error: 'bad'}, 400);
  if (path === 'admin/diag/set' && m === 'POST') {
    const err = diagCheck(body.cfg);
    if (err.length) return json({error: 'check', list: err}, 400);
    await db.prepare('INSERT INTO diag_set(id, cfg, updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET cfg = excluded.cfg, updated = excluded.updated')
      .bind(sid, JSON.stringify(diagSlim(body.cfg)), Date.now()).run();
    return json({ok: true});
  }
  const c = await diagCfg(db, sid);
  if (!c) return json({error: 'no set'}, 404);
  if (path === 'admin/diag/q' && m === 'POST') {
    const where = new Map(); for (const p of c.parts) for (const q of p.qs) where.set(q, p.no);
    const list = (Array.isArray(body.qs) ? body.qs : []).slice(0, 40), bad = [], rows = [], vl = [];
    const st = db.prepare('INSERT INTO diag_q(sid, qid, part, s, d) VALUES(?,?,?,?,?) ON CONFLICT(sid, qid) DO UPDATE SET part = excluded.part, s = excluded.s, d = excluded.d');
    for (const q of list) {
      const o = Array.isArray(q && q.o) ? q.o.map(x => nfc(String(x)).slice(0, 600)) : [];
      if (!q || !where.has(q.id) || !c.S.has(q.s) || !nfc(q.q) || o.length < 2 || o.length > 6 || !Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) { bad.push(q && q.id); continue; }
      const lvl = ['easy', 'mid', 'hard'].includes(q.lvl) ? q.lvl : '';
      const d = {q: nfc(q.q).slice(0, 2000), o, a: q.a, e: nfc(q.e || '').slice(0, 6000), t: str(q.t, 80) || '', lvl};
      rows.push(st.bind(sid, q.id, where.get(q.id), q.s, JSON.stringify(d))); vl.push([q.id, d]);
    }
    const changed = await qverLog(db, 'diag:' + sid, 'diag_q', 'sid', vl);
    if (rows.length) await db.batch(rows);
    return json({ok: true, n: rows.length, bad, changed});
  }
  if (path === 'admin/diag/msg' && m === 'POST') {
    const uids = [...new Set((Array.isArray(body.uids) ? body.uids : []).filter(Number.isInteger))].slice(0, 300);
    const text = nfc(String(body.text || '')).slice(0, 1000);
    if (!uids.length || text.length < 2) return json({error: 'bad'}, 400);
    const now = Date.now(), st = db.prepare('INSERT INTO msg(uid, ts, src, text, seen) VALUES(?,?,?,?,NULL)');
    for (let i = 0; i < uids.length; i += 50) await db.batch(uids.slice(i, i + 50).map(u => st.bind(u, now, sid, text)));
    return json({ok: true, n: uids.length});
  }
  if (path === 'admin/diag/msgdel' && m === 'POST') {
    const id = parseInt(body.id, 10);
    if (!id) return json({error: 'bad'}, 400);
    await db.prepare('DELETE FROM msg WHERE id = ?').bind(id).run();
    return json({ok: true});
  }
  if (path === 'admin/diag/reset' && m === 'POST') {
    const uid = parseInt(body.uid, 10), no = parseInt(body.part, 10);
    if (!uid || !no) return json({error: 'bad'}, 400);
    await db.prepare('DELETE FROM diag_att WHERE sid = ? AND uid = ? AND part = ?').bind(sid, uid, no).run();
    return json({ok: true});
  }
  // ---- বিশ্লেষণ (শুধু অ্যাডমিন): সব উত্তর diag_att-এর ans-এ জমা, এখানে গুনে দেখানো; বাড়তি টেবিল বা লেখা নেই ----
  const rows = async () => (await db.prepare(`SELECT a.uid, a.part, a.ts, a.dl, a.done, a.res, a.ans, a.hid, a.hn, a.meta, u.name, u.email
    FROM diag_att a LEFT JOIN users u ON u.id = a.uid WHERE a.sid = ? ORDER BY a.ts LIMIT 20000`).bind(sid).all()).results.map(r => ({...r,
      res: r.res ? JSON.parse(r.res) : null, ans: JSON.parse(r.ans || '{}'), meta: (() => { try { return JSON.parse(r.meta || '{}') || {}; } catch (e) { return {}; } })()}));
  const used = r => r.done ? Math.round((r.done - r.ts) / 1000) : null;
  if (path === 'admin/diag/people' && m === 'GET') {
    const by = new Map(), all = await rows(), Q = await diagQs(db, sid, c.parts.flatMap(p => p.qs)), P = diagItemP(c, all);
    const unread = new Map((await db.prepare('SELECT uid, COUNT(*) n, MAX(ts) last FROM msg WHERE seen IS NULL GROUP BY uid').all()).results.map(r => [r.uid, r]));
    for (const r of all) {
      let x = by.get(r.uid);
      if (!x) by.set(r.uid, x = {uid: r.uid, name: r.name || '', email: r.email || '', first: r.ts, last: r.ts, done: 0, going: 0, ok: 0, no: 0, skip: 0,
        sec: 0, hid: 0, hn: 0, opens: 0, late: 0, unsure: 0, flags: {}, dev: r.meta.dev || '', ms: [], parts: [], cm: {answered: 0, noread: 0, easy: 0, easyWrong: 0, fastWrong: 0, wrong: 0}});
      x.last = Math.max(x.last, r.done || r.ts);
      x.hid += r.hid || 0; x.hn += r.hn || 0; x.opens += Math.max(0, (r.meta.opens || 1) - 1); x.late += r.meta.late || 0;
      const cr = diagCare(c, r, Q, P).m;
      for (const k of Object.keys(x.cm)) x.cm[k] += cr[k];
      for (const a of Object.values(r.ans)) if (a[0] >= 0 && a[2] > 0) x.ms.push(a[2]);
      if (r.res) {
        x.done++; x.ok += r.res.ok; x.no += r.res.no; x.skip += r.res.skip; x.sec += used(r) || 0;
        if (r.res.unsure) x.unsure++;
        for (const f of r.res.flags) x.flags[f] = (x.flags[f] || 0) + 1;
      } else x.going++;
      x.parts.push({part: r.part, done: !!r.res, ok: r.res ? r.res.ok : null, n: r.res ? r.res.n : null, sec: used(r), unsure: r.res ? r.res.unsure : false,
        flags: r.res ? r.res.flags : [], med: r.res ? r.res.med : null, care: cr.care, tired: cr.tired});
    }
    const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
    const people = [...by.values()].map(x => { const med = median(x.ms); delete x.ms; const k = x.cm;
      const care = {noreadPct: rate(k.noread, k.answered), easyWrongPct: rate(k.easyWrong, k.easy), fastWrongPct: rate(k.fastWrong, k.wrong), easy: k.easy, easyWrong: k.easyWrong};
      care.care = Math.min(100, Math.round(0.4 * care.noreadPct + 0.4 * care.easyWrongPct + 0.2 * care.fastWrongPct));
      const un = unread.get(x.uid);
      return {...x, cm: undefined, care, unread: un ? un.n : 0, med: med == null ? null : Math.round(med / 100) / 10}; })
      .sort((a, b) => b.last - a.last);
    return json({set: {id: c.id, title: c.title, parts: c.parts.map(p => ({no: p.no, title: p.title, n: p.qs.length, mins: p.mins}))}, people}, 200, {'Cache-Control': 'no-store'});
  }
  if (path === 'admin/diag/person' && m === 'GET') {
    const uid = parseInt(url.searchParams.get('uid') || '', 10);
    if (!uid) return json({error: 'bad'}, 400);
    const all = await rows(), mine = all.filter(r => r.uid === uid), P = diagItemP(c, all);
    const Q = await diagQs(db, sid, [...new Set(mine.flatMap(r => (c.P.get(r.part) || {qs: []}).qs))]);
    const msgs = (await db.prepare('SELECT id, ts, src, text, seen FROM msg WHERE uid = ? ORDER BY ts DESC LIMIT 50').bind(uid).all()).results;
    const who = await db.prepare('SELECT id, name, email, created, seen FROM users WHERE id = ?').bind(uid).first();
    const done = mine.filter(r => r.res).map(r => r.res);
    return json({user: who, msgs, status: done.length ? diagStatus(c, done) : null, parts: mine.map(r => {
      const p = c.P.get(r.part) || {qs: []}, cr = diagCare(c, r, Q, P);
      return {part: r.part, title: p.title, mins: p.mins, ts: r.ts, dl: r.dl, done: r.done, sec: used(r), hid: r.hid, hn: r.hn, meta: r.meta, res: r.res, care: cr.m,
        qs: p.qs.filter(id => Q.has(id)).map(id => {
          const q = Q.get(id), a = r.ans[id], ord = dOrder(q.o.length, dSeed(sid, uid, id));
          const pp = P.get(id);
          return {id, s: q.s, q: q.q.slice(0, 160), pick: a && a[0] >= 0 ? q.o[ord[a[0]]] : null, right: q.o[q.a], ok: a ? a[1] : 0, ms: a ? a[2] : null, seen: !!a,
            read: readMs(q), pop: pp && pp[1] ? Math.round(pp[0] / pp[1] * 100) : null, tags: cr.tags[id] || []};
        })};
    })}, 200, {'Cache-Control': 'no-store'});
  }
  if (path === 'admin/diag/items' && m === 'GET') {
    const all = (await rows()).filter(r => r.res), ids = c.parts.flatMap(p => p.qs), Q = await diagQs(db, sid, ids);
    const I = new Map(ids.filter(id => Q.has(id)).map(id => [id, {id, part: 0, s: Q.get(id).s, q: Q.get(id).q.slice(0, 140), o: Q.get(id).o, a: Q.get(id).a,
      n: 0, ok: 0, skip: 0, picks: Q.get(id).o.map(() => 0), ms: [], hi: [0, 0], lo: [0, 0]}]));
    for (const p of c.parts) for (const id of p.qs) if (I.has(id)) I.get(id).part = p.no;
    // ভালো-খারাপের পার্থক্য: ভাগের মোট ঠিক ধরে ওপরের অর্ধেক আর নিচের অর্ধেকে এই প্রশ্নে ঠিকের হার
    for (const p of c.parts) {
      const list = all.filter(r => r.part === p.no).sort((a, b) => b.res.ok - a.res.ok), half = Math.floor(list.length / 2);
      list.forEach((r, i) => {
        for (const id of p.qs) {
          const x = I.get(id); if (!x) continue;
          const a = r.ans[id]; x.n++;
          const g = i < half ? x.hi : i >= list.length - half ? x.lo : null;
          if (g) { g[1]++; if (a && a[1]) g[0]++; }
          if (!a || a[0] < 0) { x.skip++; continue; }
          if (a[1]) x.ok++;
          x.picks[dOrder(x.o.length, dSeed(sid, r.uid, id))[a[0]]]++;
          if (a[2] > 0) x.ms.push(a[2]);
        }
      });
    }
    return json({items: [...I.values()].map(({ms, o, ...x}) => ({...x, o: o.map(t => String(t).slice(0, 60)), med: ms.length ? Math.round(median(ms) / 100) / 10 : null,
      disc: x.hi[1] && x.lo[1] ? Math.round((x.hi[0] / x.hi[1] - x.lo[0] / x.lo[1]) * 100) / 100 : null}))}, 200, {'Cache-Control': 'no-store'});
  }
  // প্রতিটি উত্তর এক সারি; নাম/ইমেইল নয়, শুধু uid (Lyanna_data-তে নেওয়ার জন্য)
  if (path === 'admin/diag/csv' && m === 'GET') {
    const all = await rows(), Q = await diagQs(db, sid, c.parts.flatMap(p => p.qs));
    const out = [['uid', 'part', 'qid', 'subject', 'pick', 'answer', 'ok', 'ms', 'started', 'done', 'unsure', 'dev'].join(',')];
    for (const r of all) for (const id of (c.P.get(r.part) || {qs: []}).qs) {
      const q = Q.get(id); if (!q) continue;
      const a = r.ans[id], pick = a && a[0] >= 0 ? dOrder(q.o.length, dSeed(sid, r.uid, id))[a[0]] : -1;
      out.push([r.uid, r.part, id, q.s, pick, q.a, a ? a[1] : 0, a ? a[2] : '', dhakaIso(r.ts), dhakaIso(r.done), r.res && r.res.unsure ? 1 : 0, r.meta.dev || ''].map(csvCell).join(','));
    }
    return new Response(out.join('\n') + '\n', {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${sid}-answers.csv"`}});
  }
  if (path === 'admin/diag' && m === 'GET') {
    const [q, a] = await db.batch([
      db.prepare('SELECT part, COUNT(*) n FROM diag_q WHERE sid = ? GROUP BY part').bind(sid),
      db.prepare(`SELECT a.uid, a.part, a.ts, a.done, a.res, u.name, u.email FROM diag_att a LEFT JOIN users u ON u.id = a.uid WHERE a.sid = ? ORDER BY a.ts DESC LIMIT 2000`).bind(sid)
    ]);
    return json({set: diagSlim(c), updated: c.updated, loaded: q.results, att: a.results.map(r => ({...r, res: r.res ? JSON.parse(r.res) : null}))}, 200, {'Cache-Control': 'no-store'});
  }
  return json({error: 'not found'}, 404);
}

// ---------- শিক্ষকের সাপ্তাহিক রপ্তানি (LY Teacher-এর চাহিদা: Lyanna_data teacher/export-spec.md; "ছাত্রের মত তোলা" ধাপ ২) ----------
/* Lyanna_data-র GitHub Action (weekly-export.yml → tools/weekly_export.py) সপ্তাহে একবার টানে, লেখে Lyanna_data feedback/<সপ্তাহ>/-এ।
   চাবি: Authorization: Bearer <রপ্তানির চাবি> (D1 export_key-এ শুধু ছাপ, /admin/diag/ থেকে বানানো)। শুধু পড়া, D1-এ কিছু লেখে না
   (শুধু প্রথমবার লবণ)। Free প্ল্যানে CPU কম, তাই স্ক্রিপ্ট দিনে দিনে আর পাতায় পাতায় টানে (off, more)।
   GET /api/export/teacher?part=attempts&src=attq|pilot|diag&from=<ms>&to=<ms>&off=  → {rows: দাগ, sessions: বসা, more}
   GET /api/export/teacher?part=feedback|changes&from=&to=
   GET /api/export/teacher?part=students&from=&to=     → সব ব্যবহারকারী; active = from-to-র মধ্যে কোনো দাগ
   GET /api/export/teacher?part=questions&src=pilot|diag&off=  → পাইলট/নির্ণয়ের প্রশ্নের এখনকার চিহ্ন (লেখা নয়);
       সাধারণ পাতার প্রশ্ন স্ক্রিপ্ট নেয় admin/data/qmap.json আর qver.tsv থেকে
   নাম, ইমেইল, ছবি, আইপি কোনো ঘরে নয়; মতামতের লেখায় ইমেইল আর ফোন-নম্বর মুছে। student_id = SHA-256(লবণ:uid)-এর প্রথম ১৬ অক্ষর;
   লবণ D1-এ একবার বানানো, বদলায় না (বদলালে আগের সপ্তাহের সঙ্গে মেলে না)। সময় ঢাকার: তারিখ আর ঘণ্টা, মিনিট নয়। */
const EXKEY_SQL = 'CREATE TABLE IF NOT EXISTS export_key(name TEXT PRIMARY KEY, hash TEXT NOT NULL, ts INTEGER)';
async function exSalt(db) {
  const get = () => db.prepare("SELECT hash FROM export_key WHERE name = 'salt'").first();
  let r = await get();
  if (!r) {
    const raw = new Uint8Array(24); crypto.getRandomValues(raw);
    await db.prepare("INSERT OR IGNORE INTO export_key(name, hash, ts) VALUES('salt', ?, ?)").bind(hex(raw.buffer), Date.now()).run();
    r = await get();
  }
  return r.hash;
}
async function exkeyAdmin(req, db) {
  await db.prepare(EXKEY_SQL).run();
  if (req.method === 'POST') {
    const raw = new Uint8Array(32); crypto.getRandomValues(raw);
    const key = 'lx_' + btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), now = Date.now();
    await exSalt(db);
    await db.prepare("INSERT INTO export_key(name, hash, ts) VALUES('teacher', ?, ?) ON CONFLICT(name) DO UPDATE SET hash = excluded.hash, ts = excluded.ts")
      .bind(await sha(key), now).run();
    return json({ok: true, key, created: now}, 200, {'Cache-Control': 'no-store'});
  }
  const r = await db.prepare("SELECT ts FROM export_key WHERE name = 'teacher'").first();
  return json({has: !!r, created: r ? r.ts : null}, 200, {'Cache-Control': 'no-store'});
}
async function exkeyOk(req, db) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer\s+(lx_[A-Za-z0-9_-]{30,100})$/);
  if (!m) return false;
  await db.prepare(EXKEY_SQL).run();
  const r = await db.prepare("SELECT hash FROM export_key WHERE name = 'teacher'").first();
  return !!r && r.hash === await sha(m[1]);
}
// ঢাকার তারিখ আর ঘণ্টা; ISO সপ্তাহ (সোমবার শুরু, ঢাকার দিন ধরে)
const exAt = ts => { const d = new Date(ts + 6 * H); return [d.toISOString().slice(0, 10), d.getUTCHours()]; };
function isoWeek(ts) {
  const d = new Date(ts + 6 * H); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + 3); // সেই সপ্তাহের বৃহস্পতিবার
  const y = d.getUTCFullYear(), j = new Date(Date.UTC(y, 0, 4));
  j.setUTCDate(j.getUTCDate() - (j.getUTCDay() + 6) % 7);
  return y + '-W' + String(1 + Math.round((d - j) / (7 * DAY))).padStart(2, '0');
}
const exDev = d => !d ? null : d === 'desktop' ? 'desktop' : 'mobile';
const exVer = v => typeof v === 'string' && QVER_RX.test(v) ? v.split('.') : [null, null];
const exJp = x => { try { return x ? JSON.parse(x) : null; } catch (e) { return null; } };
// মতামতের লেখা থেকে ইমেইল আর ফোন-নম্বর (১০+ অঙ্ক) বাদ
const exScrub = t => String(t || '').replace(/\S+@\S+\.\S+/g, '[ইমেইল]')
  .replace(/[+\d০-৯][\d০-৯\s()-]{8,}[\d০-৯]/g, s => (s.match(/[\d০-৯]/g) || []).length >= 10 ? '[নম্বর]' : s);
const exWords = e => { const t = String(e || '').replace(/<[^>]*>/g, ' ').trim(); return t ? t.split(/\s+/).length : 0; };
function exIds(salt) {
  const m = new Map();
  const h = async x => { if (!m.has(x)) m.set(x, await sha(salt + ':' + x)); return m.get(x); };
  return {stu: async uid => uid == null ? null : (await h('u' + uid)).slice(0, 16), ses: async raw => (await h('s' + raw)).slice(0, 12)};
}
const EX_PAGE = 300;

async function teacherExport(path, url, req, db) {
  if (path !== 'export/teacher') return json({error: 'not found'}, 404);
  if (!(await exkeyOk(req, db))) return json({error: 'key'}, 401);
  const q = k => url.searchParams.get(k) || '';
  const part = q('part'), src = q('src'), from = parseInt(q('from'), 10) || 0, to = parseInt(q('to'), 10) || Date.now();
  const off = Math.max(0, parseInt(q('off'), 10) || 0);
  if (to <= from) return json({error: 'bad range'}, 400);
  const id = exIds(await exSalt(db)), now = Date.now(), H0 = {'Cache-Control': 'no-store'};

  if (part === 'attempts') {
    const rows = [], sessions = [];
    let more = false;
    if (src === 'attq') {
      await attqTable(db);
      const {results} = await db.prepare(`SELECT q.uid, q.k, q.ts, q.qd, q.tm, q.m, q.qv, a.c, a.p, a.sec FROM attq q LEFT JOIN att a ON a.uid = q.uid AND a.k = q.k
        WHERE q.ts >= ? AND q.ts < ? ORDER BY q.ts, q.uid LIMIT ? OFFSET ?`).bind(from, to, EX_PAGE + 1, off).all();
      more = results.length > EX_PAGE;
      for (const r of results.slice(0, EX_PAGE)) {
        const qd = splitQd(r.qd), tm = r.tm ? r.tm.split(',') : [], qv = r.qv ? r.qv.split(',') : [], m = exJp(r.m) || {};
        // tm = শুরুর পর দাগের মুহূর্ত; এক প্রশ্নের সময় = আগের দাগ (চাপের ক্রমে) থেকে এই দাগ
        const dur = new Map(), seq = tm.map((x, i) => [x === '' ? null : +x, i]).filter(x => x[0] != null).sort((a, b) => a[0] - b[0]);
        seq.forEach(([t, i], j) => dur.set(i, t - (j ? seq[j - 1][0] : 0)));
        const [day, hour] = exAt(r.ts), ref = (r.p || '').replace(/[?#].*$/, '') || null;
        const base = {student_id: await id.stu(r.uid), session_id: 'a' + await id.ses(r.uid + ':' + r.k),
          quiz_kind: r.c === 'ch' ? 'chapter' : 'general', quiz_ref: ref, at_day: day, at_hour: hour, device: exDev(m.dev)};
        qd.forEach(([qid, pick], i) => { const [kv, ev] = exVer(qv[i]);
          rows.push({attempt_id: base.session_id + ':' + (i + 1), ...base, question_id: qid, chosen_option: pick < 0 ? null : pick, is_blank: pick < 0 ? 1 : 0,
            correct: null, time_ds: dur.has(i) ? dur.get(i) : null, left_app: null, uncertain: null, position_in_quiz: i + 1, key_version: kv, explanation_version: ev}); });
        sessions.push({session_id: base.session_id, student_id: base.student_id, quiz_kind: base.quiz_kind, quiz_ref: ref, quiz_c: r.c || null,
          n: qd.length, answered: qd.filter(x => x[1] >= 0).length, at_day: day, at_hour: hour, sec: r.sec == null ? null : r.sec,
          hidden_s: m.hid == null ? null : m.hid, hidden_n: m.hn == null ? null : m.hn, device: base.device, screen_w: m.w || null, time_note: m.tmx || null});
      }
    } else if (src === 'pilot') {
      await pilotSetup(db);
      const {results: sits} = await db.prepare('SELECT pilot, uid, no, ts, dl, qs, done FROM pilot_sit WHERE ts >= ? AND ts < ? ORDER BY ts, uid LIMIT ? OFFSET ?')
        .bind(from, to, EX_PAGE + 1, off).all();
      more = sits.length > EX_PAGE;
      const S = sits.slice(0, EX_PAGE);
      const {results: ans} = S.length ? await db.prepare(`SELECT a.pilot, a.uid, a.no, a.qid, a.pick, a.ok, a.conf, a.sec, a.ts, a.qv FROM pilot_ans a
        JOIN pilot_sit s ON s.pilot = a.pilot AND s.uid = a.uid AND s.no = a.no WHERE s.ts >= ? AND s.ts < ?`).bind(from, to).all() : {results: []};
      const A = new Map(ans.map(a => [a.pilot + '|' + a.uid + '|' + a.no + '|' + a.qid, a]));
      for (const s of S) {
        const ids = s.qs.split(','), closed = !!s.done || s.dl + GRACE < now, [day, hour] = exAt(s.ts);
        const base = {student_id: await id.stu(s.uid), session_id: 'p' + await id.ses(s.pilot + ':' + s.uid + ':' + s.no), quiz_kind: 'batch', quiz_ref: s.pilot + '#' + s.no};
        let answered = 0;
        ids.forEach((qid, i) => {
          const a = A.get(s.pilot + '|' + s.uid + '|' + s.no + '|' + qid);
          if (!a && !closed) return;
          if (a) answered++;
          const [kv, ev] = exVer(a && a.qv), [d2, h2] = a ? exAt(a.ts) : [day, hour];
          rows.push({attempt_id: base.session_id + ':' + (i + 1), ...base, question_id: qid, chosen_option: a ? a.pick : null, is_blank: a ? 0 : 1,
            correct: a ? a.ok : 0, time_ds: a && a.sec != null ? a.sec * 10 : null, left_app: null, uncertain: a ? (a.conf === 'g' ? 1 : 0) : null,
            position_in_quiz: i + 1, at_day: d2, at_hour: h2, device: null, key_version: kv, explanation_version: ev});
        });
        sessions.push({...base, quiz_c: null, n: ids.length, answered, at_day: day, at_hour: hour, sec: s.done ? Math.round((s.done - s.ts) / 1000) : null,
          hidden_s: null, hidden_n: null, device: null, screen_w: null, time_note: closed ? null : 'open'});
      }
    } else if (src === 'diag') {
      await diagSetup(db);
      const {results} = await db.prepare('SELECT sid, uid, part, ts, dl, ans, done, hid, hn, meta FROM diag_att WHERE ts >= ? AND ts < ? ORDER BY ts, uid LIMIT ? OFFSET ?')
        .bind(from, to, EX_PAGE + 1, off).all();
      more = results.length > EX_PAGE;
      const C = new Map(), Q = new Map();
      for (const r of results.slice(0, EX_PAGE)) {
        if (!C.has(r.sid)) C.set(r.sid, await diagCfg(db, r.sid));
        const c = C.get(r.sid), p = c && c.P.get(r.part);
        if (!p) continue;
        const qk = r.sid + '|' + r.part;
        if (!Q.has(qk)) Q.set(qk, await diagQs(db, r.sid, p.qs));
        const QQ = Q.get(qk), ans = exJp(r.ans) || {}, mt = exJp(r.meta) || {}, closed = !!r.done || r.dl + GRACE + DIAG_LATE < now, [day, hour] = exAt(r.ts);
        const base = {student_id: await id.stu(r.uid), session_id: 'd' + await id.ses(r.sid + ':' + r.uid + ':' + r.part), quiz_kind: 'diag', quiz_ref: r.sid + '#' + r.part};
        let answered = 0;
        p.qs.forEach((qid, i) => {
          const a = ans[qid], qq = QQ.get(qid);
          if (!a && !closed) return;
          const blank = !a || a[0] < 0;
          if (!blank) answered++;
          const [kv, ev] = exVer(a && a[3]);
          rows.push({attempt_id: base.session_id + ':' + (i + 1), ...base, question_id: qid,
            chosen_option: blank || !qq ? null : dOrder(qq.o.length, dSeed(r.sid, r.uid, qid))[a[0]], is_blank: blank ? 1 : 0, correct: a ? a[1] : 0,
            time_ds: a && a[2] > 0 ? Math.round(a[2] / 100) : null, left_app: null, uncertain: null, position_in_quiz: i + 1,
            at_day: day, at_hour: hour, device: exDev(mt.dev), key_version: kv, explanation_version: ev});
        });
        sessions.push({...base, quiz_c: null, n: p.qs.length, answered, at_day: day, at_hour: hour, sec: r.done ? Math.round((r.done - r.ts) / 1000) : null,
          hidden_s: r.hid == null ? null : r.hid, hidden_n: r.hn == null ? null : r.hn, device: exDev(mt.dev), screen_w: mt.w || null, time_note: closed ? null : 'open'});
      }
    } else return json({error: 'src'}, 400);
    return json({rows, sessions, more, next: more ? off + EX_PAGE : null}, 200, H0);
  }

  if (part === 'students') {
    await goalCols(db); await attqTable(db); await pilotSetup(db); await diagSetup(db);
    const [u, pm, dg, act] = await db.batch([
      db.prepare('SELECT id, created, goal, gdate FROM users ORDER BY id LIMIT 50000'),
      db.prepare("SELECT uid, pilot FROM pilot_mem WHERE st = 'ok'"),
      db.prepare('SELECT DISTINCT uid, sid FROM diag_att'),
      db.prepare(`SELECT uid FROM attq WHERE ts >= ?1 AND ts < ?2 UNION SELECT uid FROM pilot_ans WHERE ts >= ?1 AND ts < ?2
        UNION SELECT uid FROM diag_att WHERE ts >= ?1 AND ts < ?2`).bind(from, to)
    ]);
    const co = new Map(), add = (uid, v) => { if (!co.has(uid)) co.set(uid, []); co.get(uid).push(v); };
    pm.results.forEach(r => add(r.uid, r.pilot)); dg.results.forEach(r => add(r.uid, 'diag:' + r.sid));
    const on = new Set(act.results.map(r => r.uid)), rows = [];
    for (const r of u.results) rows.push({student_id: await id.stu(r.id), cohort: (co.get(r.id) || ['general']).join(';'), target_exam: r.goal || null,
      target_month: r.gdate || null, joined_week: r.created ? isoWeek(r.created) : null, active_last_week: on.has(r.id) ? 1 : 0});
    return json({rows}, 200, H0);
  }

  if (part === 'feedback') {
    await repSetup(db); await fbSetup(db);
    const KIND = {hard: 'not_understood', ans: 'answer_wrong', q: 'question_wrong', exp: 'explanation_wrong', other: 'other'};
    const [r, f] = await db.batch([
      db.prepare('SELECT ts, qid, q, kind, note, uid, h, page, st FROM rep WHERE ts >= ? AND ts < ? ORDER BY ts LIMIT 20000').bind(from, to),
      db.prepare('SELECT ts, uid, page, taps FROM fb_tap WHERE ts >= ? AND ts < ? ORDER BY ts LIMIT 20000').bind(from, to)
    ]);
    const rows = [];
    // exp_shown_hash = পাতায় দেখা ব্যাখ্যার লেখার ছাপ (js/report.js), দাগের explanation_version-এর হিসাব নয়
    for (const x of r.results) rows.push({question_id: x.qid || null, q_hint: x.qid ? null : (x.q || '').slice(0, 80), student_id: await id.stu(x.uid),
      kind: KIND[x.kind] || 'other', text: exScrub(x.note), exp_shown_hash: x.h || null, page: x.page || null, status: x.st, at_day: exAt(x.ts)[0], via: 'report'});
    for (const x of f.results) for (const t of exJp(x.taps) || []) {
      const k = String(t[0] || ''), anon = k.startsWith('t:');
      rows.push({question_id: anon ? null : k, q_hint: anon ? k.slice(2, 82) : null, student_id: await id.stu(x.uid), kind: t[2] === 1 ? 'understood' : 'not_understood',
        text: '', exp_shown_hash: t[1] || null, page: x.page || null, status: null, at_day: exAt(x.ts)[0], via: 'tap'});
    }
    return json({rows}, 200, H0);
  }

  if (part === 'changes') {
    await db.prepare(QVLOG).run();
    const {results} = await db.prepare('SELECT ts, src, qid, what, old, new FROM qver_log WHERE ts >= ? AND ts < ? ORDER BY ts LIMIT 20000').bind(from, to).all();
    return json({rows: results.map(x => ({question_id: x.qid, what: x.what, old_version: x.old, new_version: x.new, at_day: exAt(x.ts)[0], why: null, src: x.src}))}, 200, H0);
  }

  if (part === 'questions') {
    const rows = [];
    let res;
    if (src === 'pilot') {
      await pilotSetup(db);
      res = (await db.prepare('SELECT pilot g, qid, topic, NULL s, d FROM pilot_q ORDER BY pilot, qid LIMIT ? OFFSET ?').bind(EX_PAGE + 1, off).all()).results;
    } else if (src === 'diag') {
      await diagSetup(db);
      res = (await db.prepare('SELECT sid g, qid, NULL topic, s, d FROM diag_q ORDER BY sid, qid LIMIT ? OFFSET ?').bind(EX_PAGE + 1, off).all()).results;
    } else return json({error: 'src'}, 400);
    for (const x of res.slice(0, EX_PAGE)) {
      const d = exJp(x.d) || {}, [kv, ev] = qVer(d).split('.');
      rows.push({question_id: x.qid, src: src + ':' + x.g, para_id: null, topic_tag: x.topic || d.t || null, subject: x.s || null,
        difficulty_tag: d.lvl || null, correct_option: Number.isInteger(d.a) ? d.a : null, key_version: kv, explanation_version: ev,
        explanation_words: exWords(d.e), source_kind: null, last_verified: null});
    }
    const more = res.length > EX_PAGE;
    return json({rows, more, next: more ? off + EX_PAGE : null}, 200, H0);
  }
  return json({error: 'part'}, 400);
}

export async function onRequest({request: req, env}) {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, ''), m = req.method;
  if (m === 'POST') {
    // অন্য সাইট থেকে আসা POST নেওয়া হয় না (CSRF); Origin না থাকলে আটকানো হয় না, কিছু ব্রাউজার একই সাইটের অনুরোধে পাঠায় না
    const o = req.headers.get('Origin');
    if (o && o !== url.origin) return json({error: 'origin'}, 403);
  }
  const db = env.DB;
  try {
    if (path === 'me' && m === 'GET') {
      let u = null;
      if (db) try { u = await sessionUser(req, db); } catch (e) { /* টেবিল এখনো তৈরি হয়নি */ }
      return json({cid: db && env.GOOGLE_CLIENT_ID || '', user: u ? pub(u) : null});
    }
    if (!db) return json({error: 'setup'}, 503);
    if (path === 'login' && m === 'POST') return await login(req, env, db);
    if (path === 'ch' || path.startsWith('ch/')) return await challenge(path, req, db, env);

    const u = await sessionUser(req, db).catch(() => null);
    if (path === 'logout' && m === 'POST') {
      const c = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]+)'));
      if (c) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha(c[1])).run().catch(() => {});
      return json({ok: true}, 200, {'Set-Cookie': cookie('', 0)});
    }
    if (path.startsWith('lib/')) return await lib(path, req, url, env, db, u);
    if (path === 'qstat' && m === 'GET') return await qstat(req, db);
    if (path === 'report' && m === 'POST') return await report(req, db, u);
    if (path === 'fb' && m === 'POST') return await fbTap(req, db, u);
    if (path.startsWith('pilot/')) return await pilot(path, req, url, env, db, u);
    if (path.startsWith('diag/')) return await diag(path, req, url, env, db, u);
    // তোলার চাবি (Lyanna_data-র GitHub Actions): শুধু সেট আর প্রশ্ন তোলা, আর কিছু নয়
    if ((path === 'admin/diag/set' || path === 'admin/diag/q') && m === 'POST' && /^Bearer /.test(req.headers.get('Authorization') || '')) {
      if (!(await upkeyOk(req, db))) return json({error: 'key'}, 403);
      return await diagAdmin(path, url, req, db);
    }
    // শিক্ষকের সাপ্তাহিক রপ্তানি (Lyanna_data-র GitHub Action): রপ্তানির চাবি দিয়ে শুধু পড়া
    if (path.startsWith('export/') && m === 'GET') return await teacherExport(path, url, req, db);
    if (!u) return json({error: 'login'}, 401);

    if (path.startsWith('admin/')) return await admin(path, url, env, db, u, req);
    if (path === 'goal') return await goal(req, db, u);
    // একটা পরীক্ষার ফল আর প্রতিটি উত্তর (নিজের উত্তরপত্র দেখার পাতা /account/script/)
    if (path === 'att/one' && m === 'GET') {
      const k = str(url.searchParams.get('k') || '', 120);
      if (!k) return json({error: 'bad'}, 400);
      await attqTable(db);
      const [a, q] = await db.batch([
        db.prepare('SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? AND k = ?').bind(u.id, k),
        db.prepare('SELECT qd FROM attq WHERE uid = ? AND k = ?').bind(u.id, k)
      ]);
      const r = a.results[0];
      if (!r) return json({error: 'not found'}, 404);
      const qd = q.results[0] ? splitQd(q.results[0].qd) : null;
      return json({a: {...r, sb: r.sb ? JSON.parse(r.sb) : null, qd}}, 200, {'Cache-Control': 'no-store'});
    }
    if (path === 'att' && m === 'GET') {
      const {results} = await db.prepare('SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? ORDER BY ts DESC LIMIT ?')
        .bind(u.id, MAX_ROWS).all();
      return json({user: pub(u), a: results.map(r => ({...r, sb: r.sb ? JSON.parse(r.sb) : null}))});
    }
    if (path === 'att' && m === 'POST') {
      const body = await req.json().catch(() => ({}));
      const rows = (Array.isArray(body.a) ? body.a : []).slice(0, MAX_BATCH).map(clean).filter(Boolean);
      const by = qaCount(body.q), qn = [...by.values()].reduce((s, c) => s + c[0], 0);
      if (!rows.length && !qn) return json({ok: true, saved: 0, qs: 0});
      const can = await quota(db, u.id, rows.length, qn);
      // ফলের সীমা পার হলে 429: ফোনে জমা থাকে, পরের দিন যায়
      if (rows.length && !can.att) return json({error: 'slow'}, 429);
      if (rows.length) {
        const st = db.prepare('INSERT OR IGNORE INTO att(uid, k, ts, c, t, p, s, n, ok, no, sec, sb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
        await db.batch(rows.map(r => st.bind(u.id, ...r)));
      }
      // প্রতিটি উত্তর: ফলের k আর ts ধরে, একই k দুবার নয়। শুধু যে ফল এই জমায় গ্রহণ হলো তার উত্তর, তাই দৈনিক সীমার ভেতরেই থাকে
      const keep = new Set(rows.map(r => r[0]));
      const qds = (Array.isArray(body.a) ? body.a : []).slice(0, MAX_BATCH)
        .map(a => { if (!(a && typeof a === 'object' && str(a.k, 120) && num(a.ts))) return null; const qd = cleanQd(a.qd);
          return [str(a.k, 120), Math.round(a.ts), qd, cleanTm(a.tm, qd), qd ? cleanMeta(a.m, req) : null, cleanQv(a.qv, qd)]; })
        .filter(x => x && x[2] && keep.has(x[0]));
      if (qds.length) {
        await attqTable(db);
        const sq = db.prepare('INSERT OR IGNORE INTO attq(uid, k, ts, qd, tm, m, qv) VALUES(?,?,?,?,?,?,?)');
        await db.batch(qds.map(x => sq.bind(u.id, ...x)));
      }
      // প্রশ্নের হিসাবের সীমা পার হলে চুপচাপ বাদ (এগুলো শুধু পরিসংখ্যান, ফোনে জমিয়ে রাখার দরকার নেই)
      const qs = can.qa ? await saveQa(db, by) : 0;
      return json({ok: true, saved: rows.length, qs, qd: qds.length});
    }
    if (path === 'delete' && m === 'POST') {
      await attqTable(db); await diagSetup(db);
      await db.batch([
        db.prepare('DELETE FROM attq WHERE uid = ?').bind(u.id),
        db.prepare('DELETE FROM diag_att WHERE uid = ?').bind(u.id),
        db.prepare('DELETE FROM msg WHERE uid = ?').bind(u.id),
        db.prepare('DELETE FROM att WHERE uid = ?').bind(u.id),
        db.prepare('DELETE FROM sessions WHERE uid = ?').bind(u.id),
        db.prepare('DELETE FROM users WHERE id = ?').bind(u.id)
      ]);
      return json({ok: true}, 200, {'Set-Cookie': cookie('', 0)});
    }
    return json({error: 'not found'}, 404);
  } catch (e) {
    return json({error: 'server'}, 500);
  }
}
