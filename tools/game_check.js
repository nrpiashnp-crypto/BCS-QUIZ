// node check.js s03  → পর্যায়ের ফাইল যাচাই
const fs = require('fs');
const id = process.argv[2];
const f = require('path').join(__dirname,'..','game','data')+'/' + id + '.json';
const E = [];
let S;
try { S = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log('JSON পড়া যায়নি: ' + e.message); process.exit(1); }
const need = (c, m) => { if (!c) E.push(m); };
const str = (v, m, max) => { need(typeof v === 'string' && v.trim(), m + ' ফাঁকা'); if (max && typeof v === 'string' && v.length > max) E.push(m + ' খুব লম্বা (' + v.length + ' > ' + max + ')'); };
const arr = (v, n, m) => need(Array.isArray(v) && (n == null || v.length === n), m + (n != null ? ` ঠিক ${n}টা চাই` : ' তালিকা চাই'));
const svgOk = (s, m, max) => {
  str(s, m, max);
  if (typeof s !== 'string') return;
  if (/<\s*(script|text|image|foreignObject|style|a|use)\b/i.test(s)) E.push(m + ': নিষিদ্ধ ট্যাগ');
  if (/\son\w+\s*=|javascript:|href|url\(|style\s*=/i.test(s)) E.push(m + ': ইভেন্ট/লিংক/style নয়');
  const tags = s.match(/<\s*([a-zA-Z]+)/g) || [];
  for (const t of tags) { const n = t.replace(/[<\s]/g, ''); if (!['g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'line', 'polyline'].includes(n)) E.push(m + ': ট্যাগ ' + n + ' চলবে না'); }
};
need(S.id === id, 'id মেলে না');
need(Number.isInteger(S.n), 'n চাই');
str(S.name, 'name'); str(S.sub, 'sub'); str(S.memento, 'memento');
need([1, 2, 3, 4, 5].includes(S.band), 'band ১-৫');
need(['fun', 'solemn'].includes(S.tone), 'tone fun/solemn');
svgOk(S.emblem, 'emblem', 1200);
const sc = S.scene || {};
['sky', 'ground', 'route'].forEach(k => need(/^#[0-9a-fA-F]{6}$/.test(sc[k] || ''), 'scene.' + k + ' রং #rrggbb'));
need(['boat', 'ferry', 'bus', 'train', 'walk', 'car'].includes(sc.ride), 'scene.ride');
need(sc.routeW >= 6 && sc.routeW <= 32, 'scene.routeW ৬-৩২');
arr(sc.P, 11, 'scene.P');
(sc.P || []).forEach((p, k) => need(Array.isArray(p) && p[0] >= 10 && p[0] <= 330 && p[1] >= 25 && p[1] <= 200, 'scene.P[' + k + '] সীমার বাইরে'));
svgOk(sc.art, 'scene.art', 6500);
(sc.labels || []).forEach((l, k) => need(typeof l.t === 'string' && l.x >= 0 && l.x <= 340 && l.y >= 0 && l.y <= 210, 'labels[' + k + ']'));
const G = S.guide || {};
str(G.hello, 'guide.hello', 220); arr(G.chest, 3, 'guide.chest');
(G.chest || []).forEach((x, k) => str(x, 'guide.chest[' + k + ']', 200));
const B = S.bonus || {}; str(B.t, 'bonus.t'); arr(B.p, null, 'bonus.p');
arr(S.rounds, 10, 'rounds');
const R = S.rounds || [];
const cnt = {}, words = [];
const mcqLike = r => { arr(r.o, 4, r.id + ' o'); need(Number.isInteger(r.a) && r.a >= 0 && r.a < 4, r.id + ' a'); arr(r.codes, 4, r.id + ' codes'); if (r.o) need(new Set(r.o).size === r.o.length, r.id + ' একই বিকল্প দুবার'); };
R.forEach((r, k) => {
  const p = r.id || ('#' + (k + 1));
  need(r.id === id + '-' + String(k + 1).padStart(2, '0'), p + ': id হবে ' + id + '-' + String(k + 1).padStart(2, '0'));
  cnt[r.type] = (cnt[r.type] || 0) + 1;
  str(r.s, p + ' s', 300); str(r.q, p + ' q', 320); str(r.g, p + ' g', 60); str(r.c, p + ' c', 20);
  if (typeof r.c === 'string' && /\s/.test(r.c.trim())) E.push(p + ' c এক শব্দ');
  words.push(r.c);
  need([1, 2, 3].includes(r.d), p + ' d ১-৩');
  arr(r.ex, null, p + ' ex'); need(r.ex && r.ex.length >= 2 && r.ex.length <= 5, p + ' ex ২-৫ অনুচ্ছেদ');
  (r.ex || []).forEach((x, j) => str(x, p + ' ex[' + j + ']', 900));
  arr(r.say, 2, p + ' say'); (r.say || []).forEach((x, j) => str(x, p + ' say[' + j + ']', 170));
  switch (r.type) {
    case 'mcq': case 'star': case 'bet': mcqLike(r); break;
    case 'base': mcqLike(r); need(r.st && Array.isArray(r.st.o) && r.st.o.length === 3 && Number.isInteger(r.st.a) && r.st.q, p + ' st {q,o[3],a}'); break;
    case 'clue': mcqLike(r); arr(r.clues, 3, p + ' clues'); break;
    case 'big': arr(r.pairs, 3, p + ' pairs'); (r.pairs || []).forEach((x, j) => need(x.q && Array.isArray(x.o) && x.o.length === 2 && [0, 1].includes(x.a) && x.m, p + ' pairs[' + j + ']')); break;
    case 'map': need(['bd', 'sa', 'world'].includes(r.map), p + ' map'); need(r.target && typeof r.target.lat === 'number' && typeof r.target.lon === 'number' && r.target.name, p + ' target'); need(r.tol > 0, p + ' tol');
      if (r.map === 'bd' && r.target) need(r.target.lat > 20.5 && r.target.lat < 26.7 && r.target.lon > 88 && r.target.lon < 92.7, p + ' বাংলাদেশের বাইরে');
      if (r.map === 'sa' && r.target) need(r.target.lat > 4 && r.target.lat < 39 && r.target.lon > 59 && r.target.lon < 99, p + ' দক্ষিণ এশিয়ার বাইরে');
      break;
    case 'tl': need(r.base && r.base.l && typeof r.base.y === 'number', p + ' base'); arr(r.cards, 5, p + ' cards');
      { const ys = [r.base && r.base.y].concat((r.cards || []).map(c => c.y)); need(new Set(ys).size === ys.length, p + ' একই সাল দুবার'); (r.cards || []).forEach((c, j) => need(c.l && typeof c.y === 'number', p + ' cards[' + j + ']')); } break;
    case 'match': str(r.ask, p + ' ask'); arr(r.L, 4, p + ' L'); arr(r.Rr, 4, p + ' Rr'); arr(r.ans, 4, p + ' ans'); if (r.ans) need(new Set(r.ans).size === 4 && r.ans.every(x => x >= 0 && x < 4), p + ' ans ০-৩ সব আলাদা'); break;
    case 'note': arr(r.lines, 3, p + ' lines'); need([0, 1, 2].includes(r.a), p + ' a'); arr(r.codes, 3, p + ' codes'); str(r.miss, p + ' miss'); break;
    default: E.push(p + ': অজানা type ' + r.type);
  }
});
need((cnt.mcq || 0) <= 4, 'mcq ৪টার বেশি');
for (const t of ['base', 'star', 'clue', 'big', 'map', 'tl', 'match', 'note', 'bet']) need((cnt[t] || 0) <= 1, t + ' একবারের বেশি');
need(cnt.map >= 1, 'map অন্তত একবার'); need(cnt.star === 1, 'star একবার');
need(R[9] && R[9].type === 'bet', 'শেষ রাউন্ড bet');
for (let k = 1; k < R.length; k++) if (R[k].type === R[k - 1].type) E.push('একই ধরন পরপর: ' + R[k].id);
need(new Set(words).size === words.length, 'সূত্র-শব্দ (c) দুবার এসেছে');
const size = fs.statSync(f).size;
if (size > 60000) E.push('ফাইল বড় (' + size + ' বাইট), ৬০KB-র মধ্যে রাখুন');
if (E.length) { console.log('ঠিক করুন:\n- ' + E.join('\n- ')); process.exit(1); }
console.log('ঠিক আছে · ' + size + ' বাইট · বাক্য: ' + words.join(' '));
