// /admin/library/ পাতার "তুলুন" আর "এমসিকিউ ব্যাংক তোলা" বোতামের কাজটাই কমান্ড লাইন থেকে করে।
// node tools/library/upload.mjs --base https://lyannabooks.com --cookie <lb_s token> \
//   [--mcq library-mcq.json.gz] [--written library-units.json ...]
// cookie = অ্যাডমিন ইমেইলের একটা লগইন সেশনের lb_s মান। একই ফাইল আবার দিলে ডুপ্লিকেট হয় না।
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { webcrypto as crypto } from 'node:crypto';

const argv = process.argv.slice(2), opt = { written: [] };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k === 'written') while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.written.push(argv[++i]);
  else opt[k] = argv[++i];
}
if (!opt.base || !opt.cookie || (!opt.mcq && !opt.written.length)) {
  console.error('usage: upload.mjs --base URL --cookie TOKEN [--mcq file.json.gz] [--written file.json ...]');
  process.exit(2);
}
const base = opt.base.replace(/\/$/, '');

async function api(path, body) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { cookie: 'lb_s=' + opt.cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ': HTTP ' + r.status + ' ' + (j.error || ''));
  return j;
}
const retry = async (path, body) => {
  for (let t = 0; ; t++) {
    try { return await api(path, body) } catch (e) { if (t >= 2) throw e; await new Promise(r => setTimeout(r, 1500)) }
  }
};

await api('lib/stats'); // 401/403 হলে এখানেই থামে

if (opt.mcq) {
  const raw = readFileSync(opt.mcq);
  const d = JSON.parse((/\.gz$/i.test(opt.mcq) ? gunzipSync(raw) : raw).toString('utf8'));
  if (!d || !Array.isArray(d.mcq) || !Array.isArray(d.taxonomy)) throw new Error('not a library-mcq file');
  const rows = d.mcq.filter(r => r && r.id && r.q && Array.isArray(r.o));
  if (rows.length < d.mcq.length * 0.9) throw new Error('too many broken questions');
  await retry('lib/tax-import', { rows: d.taxonomy });
  // পাতার মতোই হ্যাশ, যাতে পাতা আর এই স্ক্রিপ্ট একে অপরের কাজ চিনতে পারে
  for (const r of rows) {
    const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify([r.q, r.o, r.a, r.e, r.s, r.t, r.src, r.topic_ids, r.exams])));
    r.h = [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const have = new Map();
  for (let after = ''; ;) {
    const j = await retry('lib/mcq-ids?' + new URLSearchParams({ after }));
    j.items.forEach(([id, h]) => have.set(id, h));
    if (!j.next) break;
    after = j.next;
  }
  const send = rows.filter(r => have.get(r.id) !== r.h), now = new Set(rows.map(r => r.id)), gone = [...have.keys()].filter(id => !now.has(id));
  for (let i = 0; i < send.length; i += 220) {
    await retry('lib/mcq-import', { rows: send.slice(i, i + 220) });
    process.stdout.write('\rmcq ' + Math.min(send.length, i + 220) + ' / ' + send.length);
  }
  for (let i = 0; i < gone.length; i += 90) await retry('lib/mcq-remove', { ids: gone.slice(i, i + 90) });
  await retry('lib/mcq-done', { n: rows.length });
  console.log('\nmcq: ' + d.taxonomy.length + ' topics, ' + rows.length + ' questions, ' + send.length + ' new/changed, ' + gone.length + ' removed');
}

for (const f of opt.written) {
  let t = JSON.parse(readFileSync(f, 'utf8'));
  if (!Array.isArray(t)) t = t.topics || [];
  t = t.filter(x => x && x.id && x.text);
  let saved = 0;
  for (let i = 0; i < t.length; i += 15) {
    saved += (await retry('lib/import', { topics: t.slice(i, i + 15) })).saved;
    process.stdout.write('\r' + f + ' ' + Math.min(t.length, i + 15) + ' / ' + t.length);
  }
  console.log('\n' + f + ': ' + saved + ' parts saved');
}
const s = await api('lib/stats');
console.log('library now:', JSON.stringify({ mcq: s.mcq, subjects: s.subjects }).slice(0, 400));
