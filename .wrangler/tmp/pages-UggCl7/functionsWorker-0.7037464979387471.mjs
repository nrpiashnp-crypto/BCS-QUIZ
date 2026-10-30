var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/[[path]].js
var COOKIE = "lb_s";
var AGE = 180 * 86400;
var MAX_BATCH = 300;
var MAX_ROWS = 3e3;
var SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT, pic TEXT, created INTEGER, seen INTEGER)",
  "CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS att(uid INTEGER NOT NULL, k TEXT NOT NULL, ts INTEGER NOT NULL, c TEXT, t TEXT, p TEXT, s REAL, n INTEGER, ok INTEGER, no INTEGER, sec INTEGER, sb TEXT, PRIMARY KEY(uid, k))",
  "CREATE INDEX IF NOT EXISTS att_ts ON att(uid, ts)"
];
var LIB_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS lib_sources(id TEXT PRIMARY KEY, title TEXT, subject TEXT, exam TEXT, updated INTEGER)",
  "CREATE TABLE IF NOT EXISTS lib_topics(id TEXT PRIMARY KEY, source_id TEXT, subject TEXT, exam TEXT, chapter INTEGER, chapter_title TEXT, section_no TEXT, section_title TEXT, parent_section TEXT, kind TEXT, pages TEXT, source TEXT, tags TEXT, text TEXT, updated INTEGER, topic_ids TEXT, mcq_ids TEXT)",
  "CREATE TABLE IF NOT EXISTS lib_tags(topic_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(topic_id, tag))",
  "CREATE INDEX IF NOT EXISTS lib_tags_tag ON lib_tags(tag)",
  "CREATE INDEX IF NOT EXISTS lib_topics_sub ON lib_topics(subject, chapter)",
  "CREATE TABLE IF NOT EXISTS lib_mcq(id TEXT PRIMARY KEY, q TEXT, o TEXT, a INTEGER, e TEXT, s TEXT, t TEXT, src TEXT, h TEXT, topic_ids TEXT, exams TEXT)",
  "CREATE TABLE IF NOT EXISTS lib_meta(k TEXT PRIMARY KEY, v TEXT)",
  "CREATE TABLE IF NOT EXISTS lib_taxonomy(id TEXT PRIMARY KEY, bn TEXT, parent TEXT, subject TEXT, pos INTEGER)"
];
var LIB_PAGE = 30;
var LIB_IMPORT = 15;
var LIB_IDS = 90;
var MCQ_IMPORT = 220;
var MCQ_PER_STMT = 9;
var MCQ_IDS_PAGE = 5e3;
var json = /* @__PURE__ */ __name((o, status = 200, headers = {}) => new Response(JSON.stringify(o), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
}), "json");
var cookie = /* @__PURE__ */ __name((v, age) => `${COOKIE}=${v}; Path=/api; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`, "cookie");
var enc = new TextEncoder();
var b64u = /* @__PURE__ */ __name((s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}, "b64u");
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
var sha = /* @__PURE__ */ __name(async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s))), "sha");
var KEYS = null;
var KEYS_AT = 0;
async function googleKeys() {
  if (KEYS && Date.now() - KEYS_AT < 36e5) return KEYS;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw new Error("certs");
  KEYS = (await r.json()).keys;
  KEYS_AT = Date.now();
  return KEYS;
}
__name(googleKeys, "googleKeys");
async function verifyGoogle(token, cid) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const dec = /* @__PURE__ */ __name((s) => JSON.parse(new TextDecoder().decode(b64u(s))), "dec");
  let head, body;
  try {
    head = dec(parts[0]);
    body = dec(parts[1]);
  } catch (e) {
    return null;
  }
  if (head.alg !== "RS256") return null;
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!ok) return null;
  const now = Date.now() / 1e3;
  if (body.aud !== cid) return null;
  if (body.iss !== "accounts.google.com" && body.iss !== "https://accounts.google.com") return null;
  if (!(body.exp > now) || !body.sub) return null;
  return body;
}
__name(verifyGoogle, "verifyGoogle");
async function sessionUser(req, db) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]+)"));
  if (!m) return null;
  return db.prepare("SELECT u.id, u.name, u.email, u.pic FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ? AND s.exp > ?").bind(await sha(m[1]), Date.now()).first();
}
__name(sessionUser, "sessionUser");
var pub = /* @__PURE__ */ __name((u) => ({ name: u.name || "", email: u.email || "", pic: u.pic || "" }), "pub");
var str = /* @__PURE__ */ __name((v, n) => typeof v === "string" ? v.slice(0, n) : null, "str");
var num = /* @__PURE__ */ __name((v) => typeof v === "number" && isFinite(v) ? v : null, "num");
function clean(a) {
  if (!a || typeof a !== "object") return null;
  const k = str(a.k, 120), ts = num(a.ts), n = num(a.n);
  if (!k || !ts || !n || n < 1 || n > 1e3) return null;
  let sb = null;
  if (a.sb && typeof a.sb === "object") {
    const o = {};
    for (const [key, v] of Object.entries(a.sb).slice(0, 30)) if (key && Array.isArray(v) && v.length === 2) o[key.slice(0, 60)] = [num(v[0]) || 0, num(v[1]) || 0];
    sb = JSON.stringify(o);
  }
  return [
    k,
    Math.round(ts),
    str(a.c, 10),
    str(a.t, 160),
    str(a.p, 200),
    num(a.s),
    Math.round(n),
    num(a.ok),
    num(a.no),
    num(a.sec),
    sb
  ];
}
__name(clean, "clean");
async function login(req, env, db) {
  const cid = env.GOOGLE_CLIENT_ID;
  if (!cid) return json({ error: "setup" }, 503);
  const { credential } = await req.json().catch(() => ({}));
  const g = await verifyGoogle(credential, cid);
  if (!g) return json({ error: "token" }, 401);
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  const now = Date.now(), name = str(g.name, 80) || "", email = g.email_verified === true || g.email_verified === "true" ? str(g.email, 120) || "" : "", pic = str(g.picture, 300) || "";
  await db.prepare("INSERT INTO users(sub, email, name, pic, created, seen) VALUES(?,?,?,?,?,?) ON CONFLICT(sub) DO UPDATE SET email=excluded.email, name=excluded.name, pic=excluded.pic, seen=excluded.seen").bind(g.sub, email, name, pic, now, now).run();
  const u = await db.prepare("SELECT id, name, email, pic FROM users WHERE sub = ?").bind(g.sub).first();
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE exp < ?").bind(now),
    db.prepare("INSERT INTO sessions(token, uid, exp) VALUES(?,?,?)").bind(await sha(token), u.id, now + AGE * 1e3)
  ]);
  return json({ user: pub(u) }, 200, { "Set-Cookie": cookie(token, AGE) });
}
__name(login, "login");
var isAdmin = /* @__PURE__ */ __name((u, env) => !!u && !!u.email && String(env.ADMIN_EMAILS || "").toLowerCase().split(/[\s,]+/).filter(Boolean).includes(u.email.toLowerCase()), "isAdmin");
var nfc = /* @__PURE__ */ __name((v) => typeof v === "string" ? v.normalize("NFC").trim() : "", "nfc");
var topicIds = /* @__PURE__ */ __name((v) => {
  const a = [...new Set((Array.isArray(v) ? v : String(v || "").split(/[\s;,]+/)).map(String).filter((x) => /^[a-z]+(-[a-z0-9]+)*$/.test(x)))].slice(0, 20);
  return a.length ? "; " + a.join("; ") + "; " : null;
}, "topicIds");
var topicWhere = "(instr(topic_ids, '; ' || ? || '; ') > 0 OR instr(topic_ids, '; ' || ? || '-') > 0)";
function libClean(t) {
  if (!t || typeof t !== "object") return null;
  const id = nfc(t.id).slice(0, 80), text = nfc(t.text);
  if (!/^[A-Za-z0-9._-]+$/.test(id) || !text) return null;
  let tags = Array.isArray(t.tags) ? t.tags : String(t.tags || "").split(/\s*;\s*/);
  tags = [...new Set(tags.map((x) => nfc(String(x)).slice(0, 160)).filter(Boolean))].slice(0, 40);
  const source = nfc(t.source).slice(0, 200);
  return {
    id,
    text: text.slice(0, 2e5),
    tags,
    source,
    source_id: (nfc(t.source_id) || id.split("-")[0]).slice(0, 80),
    subject: nfc(t.subject).slice(0, 80),
    exam: nfc(t.exam).slice(0, 80),
    chapter: t.chapter !== "" && t.chapter != null && Number.isFinite(+t.chapter) ? Math.round(+t.chapter) : null,
    chapter_title: nfc(t.chapter_title).slice(0, 200),
    section_no: nfc(t.section_no).slice(0, 30),
    section_title: nfc(t.section_title).slice(0, 300),
    parent_section: nfc(t.parent_section).slice(0, 300),
    kind: nfc(t.kind).slice(0, 30) || "section",
    pages: nfc(t.pages).slice(0, 30),
    topic_ids: topicIds(t.topic_ids),
    // Lyanna_data ইউনিটের সাথে জোড়া এমসিকিউ (archive q-id), এক্সপোর্টে লেখার পরেই আসে
    mcq_ids: (Array.isArray(t.mcq_ids) ? t.mcq_ids : String(t.mcq_ids || "").split(/[\s;,]+/)).map(String).filter((x) => /^[a-z0-9]{6,40}$/.test(x)).slice(0, 60).join(";") || null
  };
}
__name(libClean, "libClean");
async function libImport(req, db) {
  const body = await req.json().catch(() => ({}));
  const rows = (Array.isArray(body.topics) ? body.topics : []).slice(0, LIB_IMPORT).map(libClean).filter(Boolean);
  if (!rows.length) return json({ ok: true, saved: 0 });
  const now = Date.now(), st = [];
  const up = db.prepare(`INSERT INTO lib_topics(id, source_id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags, text, updated, topic_ids, mcq_ids)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, subject=excluded.subject, exam=excluded.exam,
    chapter=excluded.chapter, chapter_title=excluded.chapter_title, section_no=excluded.section_no, section_title=excluded.section_title,
    parent_section=excluded.parent_section, kind=excluded.kind, pages=excluded.pages, source=excluded.source, tags=excluded.tags, text=excluded.text, updated=excluded.updated, topic_ids=excluded.topic_ids, mcq_ids=excluded.mcq_ids`);
  const src = db.prepare("INSERT INTO lib_sources(id, title, subject, exam, updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, exam=excluded.exam, updated=excluded.updated");
  const seen = /* @__PURE__ */ new Set();
  st.push(db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${rows.map(() => "?").join(",")})`).bind(...rows.map((r) => r.id)));
  for (const r of rows) {
    st.push(up.bind(
      r.id,
      r.source_id,
      r.subject,
      r.exam,
      r.chapter,
      r.chapter_title,
      r.section_no,
      r.section_title,
      r.parent_section,
      r.kind,
      r.pages,
      r.source,
      "; " + r.tags.join("; ") + "; ",
      r.text,
      now,
      r.topic_ids,
      r.mcq_ids
    ));
    if (r.tags.length) st.push(db.prepare("INSERT OR IGNORE INTO lib_tags(topic_id, tag) VALUES" + r.tags.map(() => "(?,?)").join(",")).bind(...r.tags.flatMap((t) => [r.id, t])));
    if (!seen.has(r.source_id)) {
      seen.add(r.source_id);
      st.push(src.bind(r.source_id, r.source.replace(/,?\s*অধ্যায়.*$/, ""), r.subject, r.exam, now));
    }
  }
  await db.batch(st);
  return json({ ok: true, saved: rows.length });
}
__name(libImport, "libImport");
async function libSearch(url, db) {
  const p = /* @__PURE__ */ __name((k) => nfc(url.searchParams.get(k) || ""), "p");
  const words = p("q").split(/\s+/).filter(Boolean).slice(0, 6);
  const off = Math.max(0, Math.min(5e3, parseInt(p("offset")) || 0));
  const where = [], args = [], score = [], sargs = [];
  for (const w2 of words) {
    const l = w2.toLowerCase();
    where.push("(instr(lower(section_title), ?) > 0 OR instr(lower(parent_section), ?) > 0 OR instr(lower(tags), ?) > 0 OR instr(lower(text), ?) > 0)");
    args.push(l, l, l, l);
    score.push("(CASE WHEN instr(lower(section_title), ?) > 0 THEN 10 ELSE 0 END + CASE WHEN instr(lower(tags), ?) > 0 THEN 6 ELSE 0 END + CASE WHEN instr(lower(parent_section), ?) > 0 THEN 3 ELSE 0 END + CASE WHEN instr(lower(text), ?) > 0 THEN 1 ELSE 0 END)");
    sargs.push(l, l, l, l);
  }
  if (p("q") && words.length > 1) {
    score.push("(CASE WHEN instr(lower(section_title), ?) > 0 THEN 15 ELSE 0 END)");
    sargs.push(words.join(" ").toLowerCase());
  }
  for (const [k, col] of [["subject", "subject"], ["kind", "kind"], ["source", "source_id"]]) if (p(k)) {
    where.push(col + " = ?");
    args.push(p(k));
  }
  if (p("chapter")) {
    where.push("chapter = ?");
    args.push(parseInt(p("chapter")) || 0);
  }
  if (p("tag")) {
    where.push("id IN (SELECT topic_id FROM lib_tags WHERE tag = ?)");
    args.push(p("tag"));
  }
  if (p("topic")) {
    where.push(topicWhere);
    args.push(p("topic"), p("topic"));
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const sc = score.length ? score.join(" + ") : "0";
  const total = (await db.prepare(`SELECT COUNT(*) n FROM lib_topics ${w}`).bind(...args).first()).n;
  const { results } = await db.prepare(`SELECT id, subject, exam, chapter, chapter_title, section_no, section_title, parent_section, kind, pages, source, tags, mcq_ids,
      length(text) len, substr(text, 1, 6000) head, ${sc} score FROM lib_topics ${w} ORDER BY score DESC, subject, chapter, id LIMIT ? OFFSET ?`).bind(...sargs, ...args, LIB_PAGE, off).all();
  const lw = words.map((x) => x.toLowerCase());
  return json({ total, offset: off, items: results.map((r) => {
    const { head, tags, ...o } = r;
    let at = -1;
    for (const x of lw) {
      at = head.toLowerCase().indexOf(x);
      if (at >= 0) break;
    }
    const a = Math.max(0, at - 120);
    return { ...o, mcq_ids: (o.mcq_ids || "").split(";").filter(Boolean), tags: tags.split("; ").filter(Boolean), snippet: (a ? "\u2026" : "") + head.slice(a, a + 360).replace(/\s+/g, " ") + "\u2026" };
  }) });
}
__name(libSearch, "libSearch");
async function libStats(db) {
  await db.batch(LIB_SCHEMA.map((s) => db.prepare(s)));
  const q = /* @__PURE__ */ __name((s) => db.prepare(s).all().then((r) => r.results), "q");
  const [subjects, sources, tags, kinds, mcq, taxonomy] = await Promise.all([
    q("SELECT subject, COUNT(*) n, COUNT(DISTINCT chapter) ch FROM lib_topics GROUP BY subject ORDER BY n DESC"),
    q("SELECT s.id, s.title, s.subject, s.exam, COUNT(t.id) n FROM lib_sources s LEFT JOIN lib_topics t ON t.source_id = s.id GROUP BY s.id ORDER BY s.subject, s.id"),
    q("SELECT tag, COUNT(*) n FROM lib_tags GROUP BY tag HAVING n > 1 ORDER BY n DESC LIMIT 60"),
    q("SELECT kind, COUNT(*) n FROM lib_topics GROUP BY kind ORDER BY n DESC"),
    q("SELECT (SELECT v FROM lib_meta WHERE k = 'mcq_count') n, (SELECT v FROM lib_meta WHERE k = 'mcq_synced') synced"),
    q("SELECT id, bn, parent, subject FROM lib_taxonomy ORDER BY pos")
  ]);
  return json({ subjects, sources, tags, kinds, mcq: mcq[0], taxonomy });
}
__name(libStats, "libStats");
var splitIds = /* @__PURE__ */ __name((v) => String(v || "").split("; ").filter(Boolean), "splitIds");
var mcqOut = /* @__PURE__ */ __name((r) => ({ ...r, o: JSON.parse(r.o || "[]"), src: JSON.parse(r.src || "[]"), topic_ids: splitIds(r.topic_ids), exams: splitIds(r.exams) }), "mcqOut");
async function mcqImport(req, db) {
  const body = await req.json().catch(() => ({}));
  const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, MCQ_IMPORT).map((r) => {
    if (!r || typeof r !== "object" || !/^[a-z0-9]{6,40}$/.test(r.id) || !nfc(r.q) || !Array.isArray(r.o)) return null;
    return [
      r.id,
      nfc(r.q).slice(0, 4e3),
      JSON.stringify(r.o.slice(0, 8).map((x) => nfc(String(x)).slice(0, 1e3))),
      Number.isInteger(r.a) ? r.a : -1,
      nfc(r.e).slice(0, 1500),
      nfc(r.s).slice(0, 80),
      nfc(r.t).slice(0, 160),
      JSON.stringify((Array.isArray(r.src) ? r.src : []).filter(Array.isArray).slice(0, 40).map((x) => [nfc(String(x[0])).slice(0, 200), nfc(String(x[1])).slice(0, 200)])),
      String(r.h || "").slice(0, 40),
      topicIds(r.topic_ids),
      topicIds(r.exams)
    ];
  }).filter(Boolean);
  const st = [];
  for (let i = 0; i < rows.length; i += MCQ_PER_STMT) {
    const part = rows.slice(i, i + MCQ_PER_STMT);
    st.push(db.prepare("INSERT INTO lib_mcq(id, q, o, a, e, s, t, src, h, topic_ids, exams) VALUES" + part.map(() => "(?,?,?,?,?,?,?,?,?,?,?)").join(",") + " ON CONFLICT(id) DO UPDATE SET q=excluded.q, o=excluded.o, a=excluded.a, e=excluded.e, s=excluded.s, t=excluded.t, src=excluded.src, h=excluded.h, topic_ids=excluded.topic_ids, exams=excluded.exams").bind(...part.flat()));
  }
  if (st.length) await db.batch(st);
  return json({ ok: true, saved: rows.length });
}
__name(mcqImport, "mcqImport");
async function mcqSearch(url, db) {
  const words = nfc(url.searchParams.get("q") || "").split(/\s+/).filter(Boolean).slice(0, 6);
  const off = Math.max(0, Math.min(5e3, parseInt(url.searchParams.get("offset")) || 0));
  const topic = nfc(url.searchParams.get("topic") || "");
  if (!words.length && !topic) return json({ more: false, offset: 0, items: [] });
  const where = [], args = [], score = ["0"], sargs = [];
  for (const w of words) {
    const l = w.toLowerCase();
    where.push("(instr(lower(q), ?) > 0 OR instr(lower(o), ?) > 0 OR instr(lower(t), ?) > 0)");
    args.push(l, l, l);
    score.push(`(CASE WHEN instr(lower(t), ?) > 0 THEN 5 ELSE 0 END + CASE WHEN instr(lower(q), ?) > 0 THEN 3 ELSE 0 END + CASE WHEN instr(lower(o), ?) > 0 THEN 1 ELSE 0 END) * ${[...l].length}`);
    sargs.push(l, l, l);
  }
  const run = /* @__PURE__ */ __name(async (join) => {
    const w = [where.length ? "(" + where.join(join) + ")" : "1", ...topic ? [topicWhere] : []].join(" AND ");
    const { results } = await db.prepare(`SELECT id, q, o, a, e, s, t, src, topic_ids, exams, ${score.join(" + ")} score FROM lib_mcq WHERE ${w}
        ORDER BY score DESC, length(src) DESC, id LIMIT ? OFFSET ?`).bind(...sargs, ...args, ...topic ? [topic, topic] : [], LIB_PAGE + 1, off).all();
    return results;
  }, "run");
  let rows = await run(" AND "), any = false;
  if (!rows.length && !off && words.length > 1) {
    rows = await run(" OR ");
    any = true;
  }
  return json({ more: rows.length > LIB_PAGE, any, offset: off, items: rows.slice(0, LIB_PAGE).map(mcqOut) });
}
__name(mcqSearch, "mcqSearch");
async function lib(path, req, url, env, db, u) {
  if (!u) return json({ error: "login" }, 401);
  if (!isAdmin(u, env)) return json({ error: "admin" }, 403);
  const m = req.method;
  if (path === "lib/stats" && m === "GET") return libStats(db);
  try {
    return await libRoute(path, m, req, url, db);
  } catch (e) {
    const msg = String(e && e.message);
    const col = msg.match(/no such column: (mcq_ids)|has no column named (mcq_ids)/i);
    if (col) {
      await db.prepare("ALTER TABLE lib_topics ADD COLUMN mcq_ids TEXT").run().catch(() => {
      });
      return await libRoute(path, m, req, url, db);
    }
    if (!/no such table/i.test(msg)) throw e;
    await db.batch(LIB_SCHEMA.map((s) => db.prepare(s)));
    return await libRoute(path, m, req, url, db);
  }
}
__name(lib, "lib");
async function libRoute(path, m, req, url, db) {
  if (path === "lib/search" && m === "GET") return libSearch(url, db);
  if (path === "lib/import" && m === "POST") return libImport(req.clone(), db);
  if (path === "lib/mcq" && m === "GET") return mcqSearch(url, db);
  if (path === "lib/mcq-import" && m === "POST") return mcqImport(req.clone(), db);
  if (path === "lib/mcq-ids" && m === "GET") {
    const { results } = await db.prepare("SELECT id, h FROM lib_mcq WHERE id > ? ORDER BY id LIMIT ?").bind(url.searchParams.get("after") || "", MCQ_IDS_PAGE).all();
    return json({ items: results.map((r) => [r.id, r.h]), next: results.length === MCQ_IDS_PAGE ? results[results.length - 1].id : null });
  }
  if (path === "lib/tax-import" && m === "POST") {
    const body = await req.clone().json().catch(() => ({}));
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 2e3).filter((r) => r && /^[a-z]+(-[a-z0-9]+)*$/.test(r.id)).map((r, i) => [r.id, nfc(r.bn).slice(0, 200), /^[a-z]+(-[a-z0-9]+)*$/.test(r.parent || "") ? r.parent : null, nfc(r.subject).slice(0, 20), i]);
    if (!rows.length) return json({ error: "rows" }, 400);
    const st = [db.prepare("DELETE FROM lib_taxonomy")];
    for (let i = 0; i < rows.length; i += 20) {
      const part = rows.slice(i, i + 20);
      st.push(db.prepare("INSERT INTO lib_taxonomy(id, bn, parent, subject, pos) VALUES" + part.map(() => "(?,?,?,?,?)").join(",")).bind(...part.flat()));
    }
    if (st.length > 45) return json({ error: "too many" }, 400);
    await db.batch(st);
    return json({ ok: true, saved: rows.length });
  }
  if (path === "lib/mcq-done" && m === "POST") {
    const { n } = await req.clone().json().catch(() => ({}));
    const up = "INSERT INTO lib_meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v";
    await db.batch([db.prepare(up).bind("mcq_synced", String(Date.now())), db.prepare(up).bind("mcq_count", String(Math.max(0, Math.round(+n) || 0)))]);
    return json({ ok: true });
  }
  const ids = m === "POST" ? await req.clone().json().then((b) => (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, LIB_IDS)).catch(() => []) : [];
  if (path === "lib/get" && m === "POST") {
    if (!ids.length) return json({ items: [] });
    const { results } = await db.prepare(`SELECT * FROM lib_topics WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    const by = Object.fromEntries(results.map((r) => [r.id, { ...r, tags: r.tags.split("; ").filter(Boolean), topic_ids: splitIds(r.topic_ids), mcq_ids: (r.mcq_ids || "").split(";").filter(Boolean) }]));
    return json({ items: ids.map((i) => by[i]).filter(Boolean) });
  }
  if (path === "lib/mcq-get" && m === "POST") {
    if (!ids.length) return json({ items: [] });
    const { results } = await db.prepare(`SELECT * FROM lib_mcq WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    const by = Object.fromEntries(results.map((r) => [r.id, mcqOut(r)]));
    return json({ items: ids.map((i) => by[i]).filter(Boolean) });
  }
  if (path === "lib/mcq-remove" && m === "POST") {
    if (ids.length) await db.prepare(`DELETE FROM lib_mcq WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).run();
    return json({ ok: true, removed: ids.length });
  }
  if (path === "lib/remove" && m === "POST") {
    if (ids.length) {
      const qs = ids.map(() => "?").join(",");
      await db.batch([
        db.prepare(`DELETE FROM lib_tags WHERE topic_id IN (${qs})`).bind(...ids),
        db.prepare(`DELETE FROM lib_topics WHERE id IN (${qs})`).bind(...ids),
        db.prepare("DELETE FROM lib_sources WHERE id NOT IN (SELECT DISTINCT source_id FROM lib_topics)")
      ]);
    }
    return json({ ok: true, removed: ids.length });
  }
  return json({ error: "not found" }, 404);
}
__name(libRoute, "libRoute");
var CH_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS ch(id TEXT PRIMARY KEY, ts INTEGER, name TEXT, title TEXT, src TEXT, n INTEGER, mins INTEGER, ok INTEGER, sec INTEGER, picks TEXT, qs TEXT, iph TEXT, parent TEXT)",
  "CREATE INDEX IF NOT EXISTS ch_iph ON ch(iph, ts)",
  "CREATE TABLE IF NOT EXISTS ch_try(cid TEXT NOT NULL, ts INTEGER, name TEXT, ok INTEGER, sec INTEGER, picks TEXT, iph TEXT, PRIMARY KEY(cid, iph))",
  "CREATE INDEX IF NOT EXISTS ch_try_rank ON ch_try(cid, ok, sec)",
  "CREATE TABLE IF NOT EXISTS ch_start(cid TEXT NOT NULL, iph TEXT NOT NULL, ts INTEGER, PRIMARY KEY(cid, iph))"
];
var CH_READY = false;
async function chSetup(db) {
  if (CH_READY) return;
  await db.batch(CH_SCHEMA.map((s) => db.prepare(s)));
  try {
    await db.prepare("ALTER TABLE ch_try ADD COLUMN ip TEXT").run();
  } catch (e) {
  }
  CH_READY = true;
}
__name(chSetup, "chSetup");
var CH_MAX_Q = 200;
var CH_MAX_BYTES = 3e5;
var CH_PER_HOUR = 30;
var CH_IP_TRIES = 3;
var CH_MAX_TRIES = 1e3;
var CH_PER_DAY_ALL = 3e3;
var CH_TAGS = /* @__PURE__ */ new Set(["b", "i", "u", "sub", "sup", "br", "table", "thead", "tbody", "tr", "td", "th", "span", "p", "div", "small", "strong", "em"]);
var chImg = /* @__PURE__ */ __name((t) => {
  const m = t.match(/\ssrc\s*=\s*["']?(\/(?!\/)[\w\-./%]+)/i);
  return m ? '<img src="' + m[1] + '" alt="">' : "";
}, "chImg");
var chHtml = /* @__PURE__ */ __name((v, n) => typeof v !== "string" ? "" : v.normalize("NFC").replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g, (t, g) => {
  g = g.toLowerCase();
  return g === "img" ? chImg(t) : CH_TAGS.has(g) ? (t[1] === "/" ? "</" : "<") + g + ">" : "";
}).trim().slice(0, n), "chHtml");
var CH_BAD = /(খানকি|মাগি|চুদ|শুয়োর|fuck|shit|bitch|asshole|porn)/gi;
var chName = /* @__PURE__ */ __name((v) => (typeof v === "string" ? v.normalize("NFC") : "").replace(/[<>&"'`\\]/g, "").replace(CH_BAD, "").replace(/\s+/g, " ").trim().slice(0, 24) || "\u09AC\u09A8\u09CD\u09A7\u09C1", "chName");
var chMins = /* @__PURE__ */ __name((n) => Math.max(3, Math.ceil(n * 36 / 60)), "chMins");
var chId = /* @__PURE__ */ __name(() => {
  const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = new Uint8Array(8);
  crypto.getRandomValues(r);
  return [...r].map((x) => a[x % a.length]).join("");
}, "chId");
var chIp = /* @__PURE__ */ __name(async (req) => (await sha((req.headers.get("CF-Connecting-IP") || "") + "|lb-ch-ip")).slice(0, 20), "chIp");
var chIph = /* @__PURE__ */ __name(async (req) => (await sha((req.headers.get("CF-Connecting-IP") || "") + "|" + (req.headers.get("User-Agent") || "").slice(0, 80) + "|lb-ch")).slice(0, 20), "chIph");
var chPicks = /* @__PURE__ */ __name((p, qs) => qs.map((q, i) => {
  const v = Array.isArray(p) ? p[i] : -1;
  return Number.isInteger(v) && v >= 0 && v < q.o.length ? v : -1;
}), "chPicks");
var chScore = /* @__PURE__ */ __name((p, qs) => qs.reduce((s, q, i) => s + (p[i] === q.a ? 1 : 0), 0), "chScore");
var chSrc = /* @__PURE__ */ __name((s) => /^\/(?!\/)[\w\-./#?=&%]*$/.test(s) ? s : "", "chSrc");
function chClean(list, picks) {
  if (!Array.isArray(list)) return null;
  const qs = [], keep = [];
  list.slice(0, CH_MAX_Q).forEach((q, i) => {
    if (!q || typeof q !== "object" || !Array.isArray(q.o)) return;
    const t = chHtml(q.q, 4e3), o = q.o.slice(0, 6).map((x) => chHtml(x, 600));
    if (!t || o.length < 2 || o.some((x) => !x) || !Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) return;
    qs.push({ q: t, o, a: q.a, e: chHtml(q.e, 4e3) });
    keep.push(Array.isArray(picks) ? picks[i] : -1);
  });
  return qs.length >= 3 ? { qs, picks: keep } : null;
}
__name(chClean, "chClean");
async function chBoard(db, c) {
  const { results } = await db.prepare("SELECT name, ok, sec FROM ch_try WHERE cid = ? ORDER BY ok DESC, sec ASC LIMIT 3").bind(c.id).all();
  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM ch_try WHERE cid = ?").bind(c.id).first();
  const all = [{ name: c.name, ok: c.ok, sec: c.sec, host: 1 }, ...results].sort((x, y) => y.ok - x.ok || x.sec - y.sec || (y.host || 0) - (x.host || 0)).slice(0, 3);
  return { top: all, count: (cnt && cnt.n || 0) + 1 };
}
__name(chBoard, "chBoard");
async function chRank(db, c, me) {
  const ahead = await db.prepare("SELECT COUNT(*) AS n FROM ch_try WHERE cid = ? AND (ok > ? OR (ok = ? AND sec < ?))").bind(c.id, me.ok, me.ok, me.sec).first();
  return (ahead && ahead.n || 0) + 1 + (c.ok > me.ok || c.ok === me.ok && c.sec < me.sec ? 1 : 0);
}
__name(chRank, "chRank");
async function challenge(path, req, db) {
  const m = req.method, parts = path.split("/");
  if (parts.length === 1 && m === "POST") {
    const raw = await req.text();
    if (enc.encode(raw).length > CH_MAX_BYTES) return json({ error: "big" }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return json({ error: "bad" }, 400);
    }
    if (!body || typeof body !== "object") return json({ error: "bad" }, 400);
    await chSetup(db);
    const ip = await chIp(req), now2 = Date.now();
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM ch WHERE iph = ? AND ts > ?").bind(ip, now2 - 36e5).first();
    if (recent && recent.n >= CH_PER_HOUR) return json({ error: "slow" }, 429);
    const today = await db.prepare("SELECT COUNT(*) AS n FROM ch WHERE ts > ?").bind(now2 - 864e5).first();
    if (today && today.n >= CH_PER_DAY_ALL) return json({ error: "slow" }, 429);
    let qs2, picks, ok, sec, title = str(body.title, 120) || "", src = str(body.src, 200) || "", parent = null;
    if (typeof body.from === "string") {
      const p = await db.prepare("SELECT id, title, src, qs FROM ch WHERE id = ?").bind(body.from.slice(0, 12)).first();
      if (!p) return json({ error: "not found" }, 404);
      const t = await db.prepare("SELECT ok, sec, picks FROM ch_try WHERE cid = ? AND iph = ?").bind(p.id, await chIph(req)).first();
      if (!t) return json({ error: "first" }, 403);
      qs2 = JSON.parse(p.qs);
      picks = JSON.parse(t.picks);
      ok = t.ok;
      sec = t.sec;
      title = p.title;
      src = p.src;
      parent = p.id;
    } else {
      const cl = chClean(body.qs, body.picks);
      if (!cl) return json({ error: "bad" }, 400);
      qs2 = cl.qs;
      picks = chPicks(cl.picks, qs2);
      ok = chScore(picks, qs2);
      sec = Math.max(0, Math.min(chMins(qs2.length) * 60, Math.round(num(body.sec) || 0)));
    }
    title = title.replace(/[<>]/g, "").trim();
    src = chSrc(src);
    for (let i = 0; i < 3; i++) {
      const id2 = chId();
      const r = await db.prepare("INSERT OR IGNORE INTO ch(id, ts, name, title, src, n, mins, ok, sec, picks, qs, iph, parent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id2, now2, chName(body.name), title, src, qs2.length, chMins(qs2.length), ok, sec, JSON.stringify(picks), JSON.stringify(qs2), ip, parent).run();
      if (r.meta && r.meta.changes) return json({ id: id2, ok, n: qs2.length });
    }
    return json({ error: "server" }, 500);
  }
  const id = parts[1] || "";
  if (parts.length > 3 || !/^[A-Za-z0-9]{6,12}$/.test(id)) return json({ error: "not found" }, 404);
  let c;
  try {
    c = await db.prepare("SELECT * FROM ch WHERE id = ?").bind(id).first();
  } catch (e) {
    c = null;
  }
  if (!c) return json({ error: "not found" }, 404);
  await chSetup(db);
  const qs = JSON.parse(c.qs), head = { id, name: c.name, title: c.title, src: chSrc(c.src || ""), n: c.n, mins: c.mins, ok: c.ok, sec: c.sec, ts: c.ts };
  const iph = await chIph(req), now = Date.now();
  if (parts.length === 2 && m === "GET") {
    const t = await db.prepare("SELECT ok, sec FROM ch_try WHERE cid = ? AND iph = ?").bind(id, iph).first();
    return json({ ...head, qs: qs.map((q) => ({ q: q.q, o: q.o })), ...await chBoard(db, c), ...t ? { mine: { ok: t.ok, sec: t.sec, rank: await chRank(db, c, t) } } : {} });
  }
  if (parts[2] === "start" && m === "POST") {
    await db.prepare("INSERT OR IGNORE INTO ch_start(cid, iph, ts) VALUES(?,?,?)").bind(id, iph, now).run();
    return json({ ok: true });
  }
  if (parts[2] === "try" && m === "POST") {
    const body = await req.json().catch(() => null) || {};
    const old = await db.prepare("SELECT name, ok, sec, picks FROM ch_try WHERE cid = ? AND iph = ?").bind(id, iph).first();
    let me;
    if (old) me = { name: old.name, ok: old.ok, sec: old.sec, picks: JSON.parse(old.picks), again: 1 };
    else {
      const picks = chPicks(body.picks, qs), lim = c.mins * 60;
      const st = await db.prepare("SELECT ts FROM ch_start WHERE cid = ? AND iph = ?").bind(id, iph).first();
      const sec = st ? Math.round((now - st.ts) / 1e3) : Math.round(num(body.sec) || lim);
      me = { name: chName(body.name), ok: chScore(picks, qs), sec: Math.max(0, Math.min(lim, sec)), picks };
      const ip = await chIp(req);
      const n = await db.prepare("SELECT COUNT(*) AS n, SUM(ip = ?) AS mine FROM ch_try WHERE cid = ?").bind(ip, id).first();
      if ((n && n.n || 0) < CH_MAX_TRIES && (n && n.mine || 0) < CH_IP_TRIES)
        await db.prepare("INSERT OR IGNORE INTO ch_try(cid, ts, name, ok, sec, picks, iph, ip) VALUES(?,?,?,?,?,?,?,?)").bind(id, now, me.name, me.ok, me.sec, JSON.stringify(me.picks), iph, ip).run();
      else me.off = 1;
    }
    return json({ ...head, qs, host: JSON.parse(c.picks), me, rank: await chRank(db, c, me), ...await chBoard(db, c) });
  }
  return json({ error: "not found" }, 404);
}
__name(challenge, "challenge");
async function onRequest({ request: req, env }) {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, ""), m = req.method;
  if (m === "POST") {
    const o = req.headers.get("Origin");
    if (o && o !== url.origin) return json({ error: "origin" }, 403);
  }
  const db = env.DB;
  try {
    if (path === "me" && m === "GET") {
      let u2 = null;
      if (db) try {
        u2 = await sessionUser(req, db);
      } catch (e) {
      }
      return json({ cid: db && env.GOOGLE_CLIENT_ID || "", user: u2 ? pub(u2) : null });
    }
    if (!db) return json({ error: "setup" }, 503);
    if (path === "login" && m === "POST") return await login(req, env, db);
    if (path === "ch" || path.startsWith("ch/")) return await challenge(path, req, db);
    const u = await sessionUser(req, db).catch(() => null);
    if (path === "logout" && m === "POST") {
      const c = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]+)"));
      if (c) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha(c[1])).run().catch(() => {
      });
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (path.startsWith("lib/")) return await lib(path, req, url, env, db, u);
    if (!u) return json({ error: "login" }, 401);
    if (path === "att" && m === "GET") {
      const { results } = await db.prepare("SELECT k, ts, c, t, p, s, n, ok, no, sec, sb FROM att WHERE uid = ? ORDER BY ts DESC LIMIT ?").bind(u.id, MAX_ROWS).all();
      return json({ user: pub(u), a: results.map((r) => ({ ...r, sb: r.sb ? JSON.parse(r.sb) : null })) });
    }
    if (path === "att" && m === "POST") {
      const body = await req.json().catch(() => ({}));
      const rows = (Array.isArray(body.a) ? body.a : []).slice(0, MAX_BATCH).map(clean).filter(Boolean);
      if (rows.length) {
        const st = db.prepare("INSERT OR IGNORE INTO att(uid, k, ts, c, t, p, s, n, ok, no, sec, sb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
        await db.batch(rows.map((r) => st.bind(u.id, ...r)));
      }
      return json({ ok: true, saved: rows.length });
    }
    if (path === "delete" && m === "POST") {
      await db.batch([
        db.prepare("DELETE FROM att WHERE uid = ?").bind(u.id),
        db.prepare("DELETE FROM sessions WHERE uid = ?").bind(u.id),
        db.prepare("DELETE FROM users WHERE id = ?").bind(u.id)
      ]);
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: "server" }, 500);
  }
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-UggCl7/functionsRoutes-0.7163898510740094.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../tmp/claude-0/wr/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../tmp/claude-0/wr/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../tmp/claude-0/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-OJJt3K/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../tmp/claude-0/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-OJJt3K/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.7037464979387471.mjs.map
