/* ঐচ্ছিক লগইন আর ড্যাশবোর্ডের সার্ভার: Cloudflare Pages Functions + D1, Google দিয়ে লগইন।
   শুধু /api/* এখানে আসে (_routes.json), বাকি সাইট আগের মতো স্ট্যাটিক।
   লাগবে: Pages প্রজেক্টে D1 বাইন্ডিং "DB" আর এনভায়রনমেন্ট ভেরিয়েবল GOOGLE_CLIENT_ID। টেবিল প্রথম লগইনে নিজে তৈরি হয়।
   GET  /api/me        → {cid, user|null}
   POST /api/login     {credential: Google ID token} → সেশন কুকি
   POST /api/logout
   GET  /api/att       → নিজের সব পরীক্ষার ফল
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
   যাচাইয়ের কাজ LY Quiz & Sheets-এর; Lyanna_data-তে টেনে নেওয়ার জন্য একই GET-এর JSON। */
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
    if (!u) return json({error: 'login'}, 401);

    if (path.startsWith('admin/')) return await admin(path, url, env, db, u, req);
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
