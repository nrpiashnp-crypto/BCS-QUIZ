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
   প্রতিটি উত্তর (ব্যবহারকারী ধরে, কাস্টম প্ল্যানের জন্য): /api/att-এর প্রতিটি ফলে qd = [[প্রশ্ন-id, দাগানো বিকল্প (ফাঁকা −1)], …]
   → attq টেবিল (uid, k, ts, qd "id:বিকল্প,id:বিকল্প"), প্রতি পরীক্ষায় এক সারি (দিনে ১ লাখ সারি-লেখার সীমা মাথায় রেখে)
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
   যাচাইয়ের কাজ LY Quiz & Sheets-এর; Lyanna_data-তে টেনে নেওয়ার জন্য একই GET-এর JSON।
   পাইলট ব্যাচ (/pilot/<id>/, /admin/pilot/): নিচে "পাইলট ব্যাচ" অংশের মাথায় সব পথ। */
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

const ATTQ = 'CREATE TABLE IF NOT EXISTS attq(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, qd TEXT NOT NULL, PRIMARY KEY(uid, k))';
const MAX_QD = 300;
let attqReady = false;
async function attqTable(db) { if (!attqReady) { await db.prepare(ATTQ).run(); attqReady = true; } }

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
  REP_READY = true;
}
// এক আইপি থেকে ঘণ্টায় ২০টা, দিনে ৬০টা; সবার মিলিয়ে দিনে ৩০০০টা (D1-এর দৈনিক লেখার সীমা বাঁচাতে)
const REP_KINDS = new Set(['ans', 'exp', 'q', 'other']), REP_PER_HOUR = 20, REP_PER_DAY_IP = 60, REP_PER_DAY_ALL = 3000;
const repText = (v, n) => (typeof v === 'string' ? v.normalize('NFC') : '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
async function report(req, db, u) {
  const b = await req.json().catch(() => ({}));
  const kind = REP_KINDS.has(b.kind) ? b.kind : 'other';
  const qid = /^[\w-]{1,40}$/.test(b.qid || '') ? b.qid : null;
  const page = repText(b.page, 200).replace(/^https?:\/\/[^/]+/, '');
  // শুধু এই সাইটের পথ (/...), নইলে অ্যাডমিন পাতার লিংকে javascript: ইত্যাদি ঢুকতে পারে
  const safePage = /^\/(?!\/)[^\s"'<>]*$/.test(page) ? page : '';
  const q = repText(b.q, 400), note = repText(b.note, 600);
  if (!qid && !q) return json({error: 'empty'}, 400);
  await repSetup(db);
  const ip = await chIp(req), now = Date.now();
  // একই মানুষ একই প্রশ্নে একই ধরনের অভিযোগ দিনে একবারই
  const same = await db.prepare('SELECT 1 FROM rep WHERE ip = ? AND ts > ? AND kind = ? AND (qid = ? OR q = ?) LIMIT 1')
    .bind(ip, now - 86400e3, kind, qid || '', q).first();
  if (same) return json({ok: true, dup: 1});
  const c = await db.prepare('SELECT SUM(ts > ?) h, COUNT(*) d FROM rep WHERE ip = ? AND ts > ?').bind(now - 3600e3, ip, now - 86400e3).first();
  if ((c && (c.h >= REP_PER_HOUR || c.d >= REP_PER_DAY_IP)) || !await chDay(db, 'rep', REP_PER_DAY_ALL)) return json({error: 'slow'}, 429);
  await db.prepare('INSERT INTO rep(ts, qid, page, q, kind, note, uid, ip) VALUES(?,?,?,?,?,?,?,?)')
    .bind(now, qid, safePage, q, kind, note, u ? u.id : null, ip).run();
  return json({ok: true});
}

// অ্যাডমিন: কার কী ফল, প্রতিটি উত্তরসহ (কাস্টম প্ল্যান আর দিন-শেষের ডেটা-যাচাইয়ের জন্য)
async function admin(path, url, env, db, u, req) {
  if (!isAdmin(u, env)) return json({error: 'admin'}, 403);
  if (path === 'admin/pilot' || path.startsWith('admin/pilot/')) return pilotAdmin(path, url, req, db);
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
    const who = em ? await db.prepare('SELECT id, name, email, created, seen FROM users WHERE lower(email) = ?').bind(em).first()
      : id ? await db.prepare('SELECT id, name, email, created, seen FROM users WHERE id = ?').bind(id).first() : null;
    if (!who) return json({error: 'no user'}, 404);
    const [a, q] = await db.batch([
      db.prepare('SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? ORDER BY ts').bind(who.id),
      db.prepare('SELECT k, ts, qd FROM attq WHERE uid = ? ORDER BY ts').bind(who.id)
    ]);
    const qd = new Map(q.results.map(r => [r.k, r.qd.split(',').map(x => { const i = x.lastIndexOf(':'); return [x.slice(0, i), +x.slice(i + 1)]; })]));
    return json({ts: Date.now(), user: who,
      att: a.results.map(r => ({...r, sb: r.sb ? JSON.parse(r.sb) : null, qd: qd.get(r.k) || null}))},
      200, {'Cache-Control': 'no-store'});
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
    const {results} = await db.prepare(`SELECT r.id, r.ts, r.qid, r.page, r.q, r.kind, r.note, r.st, u.name uname, u.email uemail
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
    await db.prepare('INSERT OR IGNORE INTO pilot_ans(pilot, uid, no, qid, topic, pick, ok, conf, sec, ts, rep, late, cts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(p, u.id, no, ids[i], Q.topic, pick, pick === Q.a ? 1 : 0, conf, sec, now, sit.rep.split(',')[i] === '1' ? 1 : 0, late, cts).run();
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
    const list = (Array.isArray(body.qs) ? body.qs : []).slice(0, 40), bad = [];
    const st = db.prepare('INSERT INTO pilot_q(pilot, qid, topic, d) VALUES(?,?,?,?) ON CONFLICT(pilot, qid) DO UPDATE SET topic = excluded.topic, d = excluded.d');
    const rows = [];
    for (const q of list) {
      const o = Array.isArray(q && q.o) ? q.o.map(x => nfc(String(x)).slice(0, 600)) : [];
      if (!q || !QID.test(q.id || '') || !c.T.has(q.t) || !nfc(q.q) || o.length < 2 || o.length > 6 || !Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) { bad.push(q && q.id); continue; }
      rows.push(st.bind(p, q.id, q.t, JSON.stringify({q: nfc(q.q).slice(0, 2000), o, a: q.a, e: nfc(q.e || '').slice(0, 6000)})));
    }
    if (rows.length) await db.batch(rows);
    return json({ok: true, n: rows.length, bad});
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
    if (path.startsWith('pilot/')) return await pilot(path, req, url, env, db, u);
    if (!u) return json({error: 'login'}, 401);

    if (path.startsWith('admin/')) return await admin(path, url, env, db, u, req);
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
      const qd = q.results[0] ? q.results[0].qd.split(',').map(x => { const i = x.lastIndexOf(':'); return [x.slice(0, i), +x.slice(i + 1)]; }) : null;
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
        .map(a => a && typeof a === 'object' && str(a.k, 120) && num(a.ts) ? [str(a.k, 120), Math.round(a.ts), cleanQd(a.qd)] : null)
        .filter(x => x && x[2] && keep.has(x[0]));
      if (qds.length) {
        await attqTable(db);
        const sq = db.prepare('INSERT OR IGNORE INTO attq(uid, k, ts, qd) VALUES(?,?,?,?)');
        await db.batch(qds.map(x => sq.bind(u.id, x[0], x[1], x[2])));
      }
      // প্রশ্নের হিসাবের সীমা পার হলে চুপচাপ বাদ (এগুলো শুধু পরিসংখ্যান, ফোনে জমিয়ে রাখার দরকার নেই)
      const qs = can.qa ? await saveQa(db, by) : 0;
      return json({ok: true, saved: rows.length, qs, qd: qds.length});
    }
    if (path === 'delete' && m === 'POST') {
      await attqTable(db);
      await db.batch([
        db.prepare('DELETE FROM attq WHERE uid = ?').bind(u.id),
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
