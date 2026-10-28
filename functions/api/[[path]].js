/* ঐচ্ছিক লগইন আর ড্যাশবোর্ডের সার্ভার: Cloudflare Pages Functions + D1, Google দিয়ে লগইন।
   শুধু /api/* এখানে আসে (_routes.json), বাকি সাইট আগের মতো স্ট্যাটিক।
   লাগবে: Pages প্রজেক্টে D1 বাইন্ডিং "DB" আর এনভায়রনমেন্ট ভেরিয়েবল GOOGLE_CLIENT_ID। টেবিল প্রথম লগইনে নিজে তৈরি হয়।
   GET  /api/me        → {cid, user|null}
   POST /api/login     {credential: Google ID token} → সেশন কুকি
   POST /api/logout
   GET  /api/att       → নিজের সব পরীক্ষার ফল
   POST /api/att       {a:[ফল…]} → জমা (একই k দুবার এলে একবারই থাকে)
   POST /api/delete    → নিজের সব তথ্য মুছে যায়
   টপিক লাইব্রেরি (শুধু অ্যাডমিন: এনভায়রনমেন্ট ভেরিয়েবল ADMIN_EMAILS-এ থাকা ইমেইল, কমা দিয়ে আলাদা; লেখা থাকে শুধু D1-এ, রিপোতে নয়):
   GET  /api/lib/stats              → বিষয়/উৎস ধরে গণনা, বেশি ব্যবহৃত ট্যাগ
   GET  /api/lib/search?q=&subject=&kind=&chapter=&tag=&offset=  → মিলে যাওয়া অংশ (পুরো লেখা নয়, এক টুকরো)
   POST /api/lib/get    {ids:[…]}   → পুরো লেখাসহ অংশগুলো
   POST /api/lib/import {topics:[…]} → একই id আবার এলে হালনাগাদ, ডুপ্লিকেট নয় (এক বারে ১৫টি)
   POST /api/lib/remove {ids:[…]}
   সাইটের এমসিকিউ ব্যাংকও একই জায়গা থেকে খোঁজা যায়: অ্যাডমিন পাতা সাইটের JSON থেকে প্রশ্ন পড়ে lib_mcq-তে তোলে
   POST /api/lib/mcq-import {ver, rows:[{id,q,o,a,e,s,t,src}]} (এক বারে ২২০টি) · POST /api/lib/mcq-prune {ver} → এই ver-এ না আসা পুরোনো প্রশ্ন মুছে যায়
   GET  /api/lib/mcq?q=&offset=  · POST /api/lib/mcq-get {ids:[…]} */
const COOKIE = 'lb_s', AGE = 180 * 86400;
const MAX_BATCH = 300, MAX_ROWS = 3000;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT, pic TEXT, created INTEGER, seen INTEGER)',
  'CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS att(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, c TEXT, t TEXT, p TEXT, s REAL, n INTEGER, ok INTEGER, no INTEGER, sec INTEGER, sb TEXT, PRIMARY KEY(uid, k))',
  'CREATE INDEX IF NOT EXISTS att_ts ON att(uid, ts)'
];
const LIB_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS lib_sources(id TEXT PRIMARY KEY, title TEXT, subject TEXT, exam TEXT, updated INTEGER)',
  'CREATE TABLE IF NOT EXISTS lib_topics(id TEXT PRIMARY KEY, source_id TEXT, subject TEXT, exam TEXT, chapter INTEGER, chapter_title TEXT, section_no TEXT, section_title TEXT, parent_section TEXT, kind TEXT, pages TEXT, source TEXT, tags TEXT, text TEXT, updated INTEGER)',
  'CREATE TABLE IF NOT EXISTS lib_tags(topic_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(topic_id, tag))',
  'CREATE INDEX IF NOT EXISTS lib_tags_tag ON lib_tags(tag)',
  'CREATE INDEX IF NOT EXISTS lib_topics_sub ON lib_topics(subject, chapter)',
  'CREATE TABLE IF NOT EXISTS lib_mcq(id TEXT PRIMARY KEY, q TEXT, o TEXT, a INTEGER, e TEXT, s TEXT, t TEXT, src TEXT, ver INTEGER)',
  'CREATE TABLE IF NOT EXISTS lib_meta(k TEXT PRIMARY KEY, v TEXT)'
];
// D1-এর সীমা: ফ্রি প্ল্যানে এক অনুরোধে ৫০টি কোয়েরি, এক কোয়েরিতে ১০০টি প্যারামিটার
const LIB_PAGE = 30, LIB_IMPORT = 15, LIB_IDS = 90, MCQ_IMPORT = 220, MCQ_PER_STMT = 11;

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
  const now = Date.now(), name = str(g.name, 80) || '', email = str(g.email, 120) || '', pic = str(g.picture, 300) || '';
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
const likeEsc = s => s.replace(/[\\%_]/g, c => '\\' + c);

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
    chapter: Number.isFinite(+t.chapter) ? Math.round(+t.chapter) : null,
    chapter_title: nfc(t.chapter_title).slice(0, 200), section_no: nfc(t.section_no).slice(0, 30),
    section_title: nfc(t.section_title).slice(0, 300), parent_section: nfc(t.parent_section).slice(0, 300),
    kind: nfc(t.kind).slice(0, 30) || 'section', pages: nfc(t.pages).slice(0, 30)
  };
}

async function libImport(req, db) {
  const body = await req.json().catch(() => ({}));
  const rows = (Array.isArray(body.topics) ? body.topics : []).slice(0, LIB_IMPORT).map(libClean).filter(Boolean);
  if (!rows.length) return json({ok: true, saved: 0});
  const now = Date.now(), st = [];
  const up = db.prepare(`INSERT INTO lib_topics(id, source_id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags, text, updated)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, subject=excluded.subject, exam=excluded.exam,
    chapter=excluded.chapter, chapter_title=excluded.chapter_title, section_no=excluded.section_no, section_title=excluded.section_title,
    parent_section=excluded.parent_section, kind=excluded.kind, pages=excluded.pages, source=excluded.source, tags=excluded.tags, text=excluded.text, updated=excluded.updated`);
  const src = db.prepare('INSERT INTO lib_sources(id, title, subject, exam, updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, exam=excluded.exam, updated=excluded.updated');
  const seen = new Set();
  st.push(db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(r => r.id)));
  for (const r of rows) {
    // tags কলামে দুই পাশে '; ' রাখা হয়, তাই LIKE '%; সুন্দরবন; %' দিয়ে পুরো ট্যাগ মেলানো যায়
    st.push(up.bind(r.id, r.source_id, r.subject, r.exam, r.chapter, r.chapter_title, r.section_no, r.section_title, r.parent_section,
      r.kind, r.pages, r.source, '; ' + r.tags.join('; ') + '; ', r.text, now));
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
    const l = '%' + likeEsc(w) + '%';
    where.push("(section_title LIKE ? ESCAPE '\\' OR parent_section LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\')");
    args.push(l, l, l, l);
    score.push("(CASE WHEN section_title LIKE ? ESCAPE '\\' THEN 10 ELSE 0 END + CASE WHEN tags LIKE ? ESCAPE '\\' THEN 6 ELSE 0 END + CASE WHEN parent_section LIKE ? ESCAPE '\\' THEN 3 ELSE 0 END + CASE WHEN text LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END)");
    sargs.push(l, l, l, l);
  }
  if (p('q') && words.length > 1) {
    score.push("(CASE WHEN section_title LIKE ? ESCAPE '\\' THEN 15 ELSE 0 END)");
    sargs.push('%' + likeEsc(words.join(' ')) + '%');
  }
  for (const [k, col] of [['subject', 'subject'], ['kind', 'kind'], ['source', 'source_id']]) if (p(k)) { where.push(col + ' = ?'); args.push(p(k)); }
  if (p('chapter')) { where.push('chapter = ?'); args.push(parseInt(p('chapter')) || 0); }
  if (p('tag')) { where.push('id IN (SELECT topic_id FROM lib_tags WHERE tag = ?)'); args.push(p('tag')); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sc = score.length ? score.join(' + ') : '0';
  const total = (await db.prepare(`SELECT COUNT(*) n FROM lib_topics ${w}`).bind(...args).first()).n;
  const {results} = await db.prepare(`SELECT id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags,
      length(text) len, substr(text, 1, 6000) head, ${sc} score FROM lib_topics ${w} ORDER BY score DESC, subject, chapter, id LIMIT ? OFFSET ?`)
    .bind(...sargs, ...args, LIB_PAGE, off).all();
  const lw = words.map(x => x.toLowerCase());
  return json({total, offset: off, items: results.map(r => {
    const {head, tags, ...o} = r;
    // প্রথম যে শব্দটা লেখায় মেলে তার আশেপাশের টুকরো
    let at = -1; for (const x of lw) { at = head.toLowerCase().indexOf(x); if (at >= 0) break; }
    const a = Math.max(0, at - 120);
    return {...o, tags: tags.split('; ').filter(Boolean), snippet: (a ? '…' : '') + head.slice(a, a + 360).replace(/\s+/g, ' ') + '…'};
  })});
}

async function libStats(db) {
  await db.batch(LIB_SCHEMA.map(s => db.prepare(s)));
  const q = s => db.prepare(s).all().then(r => r.results);
  const [subjects, sources, tags, kinds, mcq] = await Promise.all([
    q('SELECT subject, COUNT(*) n, COUNT(DISTINCT chapter) ch FROM lib_topics GROUP BY subject ORDER BY n DESC'),
    q('SELECT s.id, s.title, s.subject, s.exam, COUNT(t.id) n FROM lib_sources s LEFT JOIN lib_topics t ON t.source_id = s.id GROUP BY s.id ORDER BY s.subject, s.id'),
    q('SELECT tag, COUNT(*) n FROM lib_tags GROUP BY tag HAVING n > 1 ORDER BY n DESC LIMIT 60'),
    q('SELECT kind, COUNT(*) n FROM lib_topics GROUP BY kind ORDER BY n DESC'),
    q("SELECT (SELECT COUNT(*) FROM lib_mcq) n, (SELECT v FROM lib_meta WHERE k = 'mcq_synced') synced")
  ]);
  return json({subjects, sources, tags, kinds, mcq: mcq[0]});
}

// ---------- এমসিকিউ ----------
const mcqOut = r => ({...r, o: JSON.parse(r.o || '[]'), src: JSON.parse(r.src || '[]')});

async function mcqImport(req, db) {
  const body = await req.json().catch(() => ({}));
  const ver = Math.round(+body.ver) || 0;
  const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, MCQ_IMPORT).map(r => {
    if (!r || typeof r !== 'object' || !/^[a-f0-9]{8,40}$/.test(r.id) || !nfc(r.q) || !Array.isArray(r.o)) return null;
    return [r.id, nfc(r.q).slice(0, 4000), JSON.stringify(r.o.slice(0, 8).map(x => nfc(String(x)).slice(0, 1000))),
      Number.isInteger(r.a) ? r.a : -1, nfc(r.e).slice(0, 1500), nfc(r.s).slice(0, 80), nfc(r.t).slice(0, 160),
      JSON.stringify((Array.isArray(r.src) ? r.src : []).slice(0, 40).map(x => [nfc(String(x[0])).slice(0, 200), nfc(String(x[1])).slice(0, 200)])), ver];
  }).filter(Boolean);
  const st = [];
  for (let i = 0; i < rows.length; i += MCQ_PER_STMT) {
    const part = rows.slice(i, i + MCQ_PER_STMT);
    st.push(db.prepare('INSERT INTO lib_mcq(id, q, o, a, e, s, t, src, ver) VALUES' + part.map(() => '(?,?,?,?,?,?,?,?,?)').join(',') +
      ' ON CONFLICT(id) DO UPDATE SET q=excluded.q, o=excluded.o, a=excluded.a, e=excluded.e, s=excluded.s, t=excluded.t, src=excluded.src, ver=excluded.ver')
      .bind(...part.flat()));
  }
  if (st.length) await db.batch(st);
  return json({ok: true, saved: rows.length});
}

async function mcqSearch(url, db) {
  const words = nfc(url.searchParams.get('q') || '').split(/\s+/).filter(Boolean).slice(0, 6);
  const off = Math.max(0, Math.min(5000, parseInt(url.searchParams.get('offset')) || 0));
  if (!words.length) return json({total: 0, offset: 0, items: []});
  const where = [], args = [], score = [], sargs = [];
  for (const w of words) {
    const l = '%' + likeEsc(w) + '%';
    where.push("(q LIKE ? ESCAPE '\\' OR o LIKE ? ESCAPE '\\' OR t LIKE ? ESCAPE '\\')"); args.push(l, l, l);
    score.push("(CASE WHEN t LIKE ? ESCAPE '\\' THEN 5 ELSE 0 END + CASE WHEN q LIKE ? ESCAPE '\\' THEN 3 ELSE 0 END + 1)"); sargs.push(l, l);
  }
  const w = 'WHERE ' + where.join(' AND ');
  const total = (await db.prepare(`SELECT COUNT(*) n FROM lib_mcq ${w}`).bind(...args).first()).n;
  const {results} = await db.prepare(`SELECT id, q, o, a, e, s, t, src, ${score.join(' + ')} score FROM lib_mcq ${w}
      ORDER BY score DESC, length(src) DESC, id LIMIT ? OFFSET ?`).bind(...sargs, ...args, LIB_PAGE, off).all();
  return json({total, offset: off, items: results.map(mcqOut)});
}

async function lib(path, req, url, env, db, u) {
  if (!u) return json({error: 'login'}, 401);
  if (!isAdmin(u, env)) return json({error: 'admin'}, 403);
  const m = req.method;
  if (path === 'lib/stats' && m === 'GET') return libStats(db);
  try { return await libRoute(path, m, req, url, db); }
  catch (e) {
    // টেবিল এখনো তৈরি হয়নি: একবার তৈরি করে আবার চেষ্টা (stats পাতা খুললেই তৈরি হয়, তাই সাধারণত লাগে না)
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await db.batch(LIB_SCHEMA.map(s => db.prepare(s)));
    return await libRoute(path, m, req, url, db);
  }
}

async function libRoute(path, m, req, url, db) {
  if (path === 'lib/search' && m === 'GET') return libSearch(url, db);
  if (path === 'lib/import' && m === 'POST') return libImport(req.clone(), db);
  if (path === 'lib/mcq' && m === 'GET') return mcqSearch(url, db);
  if (path === 'lib/mcq-import' && m === 'POST') return mcqImport(req.clone(), db);
  if (path === 'lib/mcq-prune' && m === 'POST') {
    const {ver} = await req.clone().json().catch(() => ({}));
    if (!(+ver > 0)) return json({error: 'ver'}, 400);
    const r = await db.prepare('DELETE FROM lib_mcq WHERE ver IS NOT ?').bind(Math.round(+ver)).run();
    await db.prepare("INSERT INTO lib_meta(k, v) VALUES('mcq_synced', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(String(Date.now())).run();
    return json({ok: true, removed: r.meta && r.meta.changes || 0});
  }
  const ids = m === 'POST' ? await req.clone().json().then(b => (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, LIB_IDS)).catch(() => []) : [];
  if (path === 'lib/get' && m === 'POST') {
    if (!ids.length) return json({items: []});
    const {results} = await db.prepare(`SELECT * FROM lib_topics WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const by = Object.fromEntries(results.map(r => [r.id, {...r, tags: r.tags.split('; ').filter(Boolean)}]));
    return json({items: ids.map(i => by[i]).filter(Boolean)});
  }
  if (path === 'lib/mcq-get' && m === 'POST') {
    if (!ids.length) return json({items: []});
    const {results} = await db.prepare(`SELECT * FROM lib_mcq WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const by = Object.fromEntries(results.map(r => [r.id, mcqOut(r)]));
    return json({items: ids.map(i => by[i]).filter(Boolean)});
  }
  if (path === 'lib/remove' && m === 'POST') {
    if (ids.length) {
      const qs = ids.map(() => '?').join(',');
      await db.batch([db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${qs})`).bind(...ids), db.prepare(`DELETE FROM lib_topics WHERE id IN (${qs})`).bind(...ids)]);
    }
    return json({ok: true, removed: ids.length});
  }
  return json({error: 'not found'}, 404);
}

export async function onRequest({request: req, env}) {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, ''), m = req.method;
  if (m === 'POST') {
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

    const u = await sessionUser(req, db).catch(() => null);
    if (path === 'logout' && m === 'POST') {
      const c = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]+)'));
      if (c) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha(c[1])).run().catch(() => {});
      return json({ok: true}, 200, {'Set-Cookie': cookie('', 0)});
    }
    if (path.startsWith('lib/')) return await lib(path, req, url, env, db, u);
    if (!u) return json({error: 'login'}, 401);

    if (path === 'att' && m === 'GET') {
      const {results} = await db.prepare('SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? ORDER BY ts DESC LIMIT ?')
        .bind(u.id, MAX_ROWS).all();
      return json({user: pub(u), a: results.map(r => ({...r, sb: r.sb ? JSON.parse(r.sb) : null}))});
    }
    if (path === 'att' && m === 'POST') {
      const body = await req.json().catch(() => ({}));
      const rows = (Array.isArray(body.a) ? body.a : []).slice(0, MAX_BATCH).map(clean).filter(Boolean);
      if (rows.length) {
        const st = db.prepare('INSERT OR IGNORE INTO att(uid, k, ts, c, t, p, s, n, ok, no, sec, sb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
        await db.batch(rows.map(r => st.bind(u.id, ...r)));
      }
      return json({ok: true, saved: rows.length});
    }
    if (path === 'delete' && m === 'POST') {
      await db.batch([
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
