/* ঐচ্ছিক লগইন আর ড্যাশবোর্ডের সার্ভার: Cloudflare Pages Functions + D1, Google দিয়ে লগইন।
   শুধু /api/* এখানে আসে (_routes.json), বাকি সাইট আগের মতো স্ট্যাটিক।
   লাগবে: Pages প্রজেক্টে D1 বাইন্ডিং "DB" আর এনভায়রনমেন্ট ভেরিয়েবল GOOGLE_CLIENT_ID। টেবিল প্রথম লগইনে নিজে তৈরি হয়।
   GET  /api/me        → {cid, user|null}
   POST /api/login     {credential: Google ID token} → সেশন কুকি
   POST /api/logout
   GET  /api/att       → নিজের সব পরীক্ষার ফল
   POST /api/att       {a:[ফল…]} → জমা (একই k দুবার এলে একবারই থাকে)
   POST /api/delete    → নিজের সব তথ্য মুছে যায় */
const COOKIE = 'lb_s', AGE = 180 * 86400;
const MAX_BATCH = 300, MAX_ROWS = 3000;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT, pic TEXT, created INTEGER, seen INTEGER)',
  'CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS att(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, c TEXT, t TEXT, p TEXT, s REAL, n INTEGER, ok INTEGER, no INTEGER, sec INTEGER, sb TEXT, PRIMARY KEY(uid, k))',
  'CREATE INDEX IF NOT EXISTS att_ts ON att(uid, ts)'
];

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
