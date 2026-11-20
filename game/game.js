/* বুদ্ধির গেম: খেলার ইঞ্জিন (/game/play/?s=s01)।
   পর্যায়ের লেখা /game/data/sNN.json-এ (ছাঁচ: /game/README.md), তালিকা /game/data/stages.json-এ (tools/game_index.py বানায়)।
   খেলতে লগইন লাগে (PIASH, ২০২৬-১১-২০)। অগ্রগতি এই ফোনে 'ly:game'-এ।
   প্রতিটা ঘটনা (শুরু, প্রতিটা রাউন্ড, ব্যাখ্যা পড়ে এগোনো, মাঝপথে ছাড়া, শেষ) সঙ্গে সঙ্গে 'ly:game:q'-এ জমে আর কয়েকটা একসঙ্গে
   POST /api/game-এ যায় (D1 game_rounds; পাতা ছাড়ার সময়ও)। ইন্টারনেট না থাকলে জমে থাকে, পরে যায়।
   পর্যায় শেষে একবার LBA.save() (ড্যাশবোর্ডে, c:'game')।
   সব কোড একটা ফাংশনের ভেতরে; top, name, open, close জাতীয় বৈশ্বিক নাম নয়। */
(function () {
  'use strict';
  var bn = function (n) { return String(n).replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'[d]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'ly:game', GQ = 'ly:game:q';
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var prog = LS.get(KEY, null) || { v: 1, done: {}, wr: [], days: [] };
  prog.done = prog.done || {}; prog.wr = prog.wr || []; prog.days = prog.days || [];
  var saveProg = function () { LS.set(KEY, prog); };

  var GUIDE = { name: 'নীলা', role: 'আপনার ভ্রমণসঙ্গী' };
  var GV = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#fbe4ec" stroke="#c8326a"/><path d="M8 35Q20 24 32 35Z" fill="#13294b"/><circle cx="20" cy="18" r="7" fill="#c68b62"/><path d="M12.5 18Q12 8.5 20 8.5Q28 8.5 27.5 18Q26 12 20 12Q14 12 12.5 18Z" fill="#2c2c2a"/><path d="M26.5 14Q30 20 27 27" stroke="#2c2c2a" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="17.5" y="27" width="5" height="5" rx="1" fill="#e0b45c"/></svg>';
  var TYPE_NAME = { mcq: 'প্রশ্ন', base: 'গোড়ার প্রশ্ন', star: 'লুব্ধক প্রশ্ন ★', bet: 'আত্মবিশ্বাসের বাজি', clue: 'সূত্র দেখে চিনুন', big: 'কোনটা বড়?', map: 'মানচিত্রে চাপুন', tl: 'আগে না পরে', match: 'জোড়া মেলান', note: 'বন্ধুর খাতা দেখে দিন' };

  var params = new URLSearchParams(location.search);
  var sid = (params.get('s') || 's01').replace(/[^a-z0-9]/g, '').slice(0, 4);
  var S = null, LIST = [], R = [];
  var i = 0, t0 = 0, log = [], words = [], cum = [0], pos = 0, busy = 0, streak = 0, rows = [], startedAt = 0, warm = [];
  var solemn = false;

  /* ---------- তথ্য: প্রতিটা ঘটনা এক সারি ---------- */
  var gid = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '').slice(0, 16);
  var seq = 0, sending = 0, sendT = 0, begun = 0, ended = 0, fin0 = 0, exo = 0;
  var DEV = window.innerWidth >= 900 ? 'pc' : 'ph';
  var fnv = function (t) { var h = 0x811c9dc5; for (var k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); };
  var ver = function (r) { try { return fnv(JSON.stringify(r)); } catch (e) { return ''; } };
  var MAIN = { s: 1, q: 1, r: 1, ty: 1, d: 1, ok: 1, sec: 1, ans: 1, code: 1, v: 1 };
  function ev(o) {
    var row = { g: gid, n: seq++, ts: Date.now(), dv: DEV }, x = null;
    Object.keys(o).forEach(function (k) { if (MAIN[k]) row[k] = o[k]; else if (o[k] != null) { x = x || {}; x[k] = o[k]; } });
    if (x) row.x = x;
    var q = LS.get(GQ, []); q.push(row); LS.set(GQ, q.slice(-600));
    clearTimeout(sendT); sendT = setTimeout(send, 1500);
  }
  function send(keep) {
    if (sending || !(window.LBA && LBA.user && LBA.user())) return;
    var q = LS.get(GQ, []); if (!q.length) return;
    var part = q.slice(0, 40), sent = {}; part.forEach(function (r) { sent[r.g + ':' + r.n] = 1; });
    sending = 1;
    fetch('/api/game', { method: 'POST', credentials: 'same-origin', keepalive: !!keep, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: part }) })
      .then(function (r) {
        sending = 0;
        if (r.status === 401) { try { localStorage.removeItem('lb:u'); } catch (e) { } return; }
        if (!r.ok) return;
        LS.set(GQ, LS.get(GQ, []).filter(function (x) { return !sent[x.g + ':' + x.n]; }));
        if (q.length > part.length && !keep) setTimeout(send, 300);
      }).catch(function () { sending = 0; });
  }
  // মাঝপথে ছেড়ে গেলে: কোন রাউন্ডে ছাড়লেন (প্রতিবার পাতা লুকালে নয়, শুধু পাতা বন্ধ/অন্য পাতায় গেলে)
  window.addEventListener('pagehide', function () {
    if (begun && !ended) ev({ s: S.id, r: i + 1, ty: 'leave', sec: Math.round((Date.now() - startedAt) / 1000) });
    clearTimeout(sendT); send(1);
  });

  function gsay(line, first) {
    return line ? '<div class="guide' + (first ? ' first' : '') + ' in"><div class="gav">' + GV + '</div><div class="bub"><b>' + GUIDE.name + ' · ' + GUIDE.role + '</b>' + esc(line) + '</div></div>' : '';
  }
  function anim(C) { C.classList.remove('in'); void C.offsetWidth; C.classList.add('in'); }
  function sec() { return Math.round((Date.now() - t0) / 100) / 10; }
  function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var x = a[k]; a[k] = a[j]; a[j] = x; } return a; }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }

  /* ---------- দৃশ্য ---------- */
  function rideSvg(k) {
    var R = {
      boat: '<path d="M-16 0H16L10 7H-10Z" fill="#7a4a1f"/><rect x="-8" y="-8" width="14" height="8" rx="1" fill="#f5e9d6" stroke="#7a4a1f"/><path d="M-10 -8H8L5 -12H-7Z" fill="#7a4a1f"/>',
      ferry: '<path d="M-18 0H18L12 8H-12Z" fill="#13294b"/><rect x="-12" y="-9" width="22" height="9" fill="#fff" stroke="#13294b"/><rect x="-9" y="-6" width="4" height="3" fill="#7fb3d9"/><rect x="-3" y="-6" width="4" height="3" fill="#7fb3d9"/><rect x="3" y="-6" width="4" height="3" fill="#7fb3d9"/><rect x="2" y="-14" width="4" height="5" fill="#c8326a"/>',
      bus: '<rect x="-15" y="-12" width="30" height="13" rx="3" fill="#1e7a46"/><rect x="-12" y="-9" width="6" height="5" fill="#dff0ff"/><rect x="-4" y="-9" width="6" height="5" fill="#dff0ff"/><rect x="4" y="-9" width="7" height="5" fill="#dff0ff"/><circle cx="-8" cy="2" r="3" fill="#222"/><circle cx="8" cy="2" r="3" fill="#222"/>',
      car: '<path d="M-13 -2L-9 -9H7L12 -2Z" fill="#c8326a"/><rect x="-14" y="-3" width="28" height="6" rx="2" fill="#c8326a"/><circle cx="-8" cy="3" r="3" fill="#222"/><circle cx="8" cy="3" r="3" fill="#222"/>',
      train: '<rect x="-16" y="-12" width="32" height="12" rx="3" fill="#b3261e"/><rect x="-13" y="-9" width="6" height="4" fill="#fff4cc"/><rect x="-4" y="-9" width="6" height="4" fill="#fff4cc"/><rect x="5" y="-9" width="6" height="4" fill="#fff4cc"/><rect x="-16" y="-3" width="32" height="2" fill="#e0b45c"/><circle cx="-9" cy="2" r="2.6" fill="#222"/><circle cx="9" cy="2" r="2.6" fill="#222"/>',
      walk: '<circle cx="-5" cy="-15" r="3.4" fill="#c68b62"/><path d="M-5 -11V-2M-5 -9L-9 -4M-5 -9L-1 -5M-5 -2L-8 4M-5 -2L-2 4" stroke="#13294b" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" cy="-14" r="3.2" fill="#c68b62"/><path d="M6 -10V-2M6 -8L3 -4M6 -8L9 -4M6 -2L4 4M6 -2L8 4" stroke="#c8326a" stroke-width="2.2" stroke-linecap="round"/>'
    };
    return R[k] || R.walk;
  }
  function drawScene() {
    var sc = S.scene, P = sc.P;
    var d = 'M' + P.map(function (p) { return p.join(' '); }).join(' L');
    var lab = (sc.labels || []).map(function (l) { return '<text x="' + l.x + '" y="' + l.y + '">' + esc(l.t) + '</text>'; }).join('');
    $('sv').innerHTML =
      '<rect width="340" height="210" fill="' + sc.sky + '"/>' +
      '<rect y="96" width="340" height="114" fill="' + sc.ground + '"/>' +
      sc.art +
      '<path d="' + d + '" fill="none" stroke="' + sc.route + '" stroke-width="' + sc.routeW + '" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>' +
      '<path id="trail" d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>' +
      '<path id="donep" d="' + d + '" fill="none" stroke="#13294b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      lab + '<g id="dots"></g>' +
      '<g id="chest" transform="translate(' + P[10][0] + ' ' + (P[10][1] + 2) + ')"><g id="spk"></g>' +
      (solemn
        ? '<rect x="-15" y="-12" width="30" height="22" rx="2" fill="#f4ede3" stroke="#13294b"/><rect id="lid" x="-15" y="-19" width="30" height="7" rx="2" fill="#13294b"/><circle cx="0" cy="-1" r="5" fill="none" stroke="#c8326a" stroke-width="1.6"/>'
        : '<rect x="-17" y="-10" width="34" height="21" rx="3" fill="#ef9f27" stroke="#854f0b"/><rect id="lid" x="-17" y="-21" width="34" height="11" rx="3" fill="#fac775" stroke="#854f0b"/><rect x="-3" y="-6" width="6" height="7" rx="1" fill="#854f0b"/>') +
      '</g><g id="me"><g id="ride">' + rideSvg(sc.ride) + '</g></g>';
    $('sv').setAttribute('aria-label', S.name + ': যাত্রাপথ');
    cum = [0];
    for (var k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    var TOT = cum[cum.length - 1];
    $('donep').style.strokeDasharray = TOT;
    drawDone(0); place(0);
  }
  function dots() {
    var P = S.scene.P;
    $('dots').innerHTML = P.slice(0, 10).map(function (p, k) {
      var f = k < i ? ['#e5f3ea', '#1e7a46'] : k === i ? ['#fac775', '#854f0b'] : ['#ffffff', '#8a8780'];
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (k === i ? 11 : 8) + '" fill="' + f[0] + '" stroke="' + f[1] + '" stroke-width="1.6"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle" style="font-size:10px">' + bn(k + 1) + '</text>';
    }).join('');
  }
  function drawDone(l) { var T = cum[cum.length - 1]; $('donep').style.strokeDashoffset = T - l; }
  function place(l) {
    var tr = $('trail'), pt = tr && tr.getPointAtLength ? tr.getPointAtLength(l) : { x: S.scene.P[0][0], y: S.scene.P[0][1] };
    $('me').setAttribute('transform', 'translate(' + pt.x + ' ' + (pt.y - 9) + ')');
  }
  function walk(to, cb) {
    var from = pos, s0 = performance.now(), D = RM ? 1 : 1000; busy = 1;
    (function f(n) {
      var u = Math.min(1, (n - s0) / D), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, l = from + (to - from) * e;
      place(l); drawDone(l);
      if (u < 1) requestAnimationFrame(f); else { pos = to; busy = 0; cb && cb(); }
    })(s0);
  }
  function topBar() {
    dots();
    $('prog').textContent = (i < 10 ? bn(i + 1) : '১০') + ' / ১০';
    $('clueBar').textContent = words.length ? 'সূত্র: ' + words.join(' ') : '';
  }

  /* ---------- রাউন্ড ---------- */
  function head(r) {
    return '<p class="story">' + esc(r.s) + '</p><p class="rt">' + esc(r.t || TYPE_NAME[r.type] || '') + '</p><p class="qq">' + esc(r.q) + '</p>';
  }
  function show() {
    topBar();
    var r = R[i], C = $('card'); anim(C);
    C.innerHTML = (i === 0 ? gsay(S.guide.hello, 1) : '') + head(r) + (r.type === 'tl' ? TL_HOW : '') + '<div id="play"></div>';
    t0 = Date.now();
    K[r.type](r, $('play'));
  }
  var TL_HOW = '<div class="howto"><p>নিচে সময়ের সারি: ওপরে পুরোনো, নিচে নতুন। হলুদ বাক্সে একটা করে নতুন ঘটনা আসবে।</p><p>ঘটনাটা যেখানে বসবে, সেখানের "＋ এখানে বসান" চাপুন। ভুল হলে লাল হয়ে ঠিক জায়গায় সরে যাবে।</p></div>';

  /* বিকল্পগুলো এলোমেলো করে দেখায়; cb পায় আসল সূচক */
  function opts(list, a, el, cb, guard) {
    var order = shuffle(list.map(function (_, k) { return k; }));
    el.innerHTML = order.map(function (k, j) { return '<button class="opt" data-k="' + k + '"><span class="k">' + 'কখগঘ'[j] + '</span>' + esc(list[k]) + '</button>'; }).join('');
    var lk = 0;
    el.querySelectorAll('.opt').forEach(function (b) {
      b.onclick = function () {
        if (lk) return; if (guard && !guard()) return; lk = 1;
        var k = +b.dataset.k;
        b.classList.add('sel');
        el.querySelectorAll('.opt').forEach(function (x) { var j = +x.dataset.k; if (j === a) x.classList.add('ok'); else if (j === k) x.classList.add('bad'); x.disabled = true; });
        cb(k);
      };
    });
  }
  function exBox(r, ok, title) {
    var ex = r.ex || [], more = ex.slice(1);
    return '<div class="exbox in"><p class="exh" style="color:var(' + (ok ? '--good' : '--bad') + ')">' + (title || (ok ? 'ঠিক হয়েছে।' : 'এবার হয়নি।')) + '</p><p>' + esc(ex[0]) + '</p>' +
      (more.length ? '<details><summary>আরও পড়ুন</summary>' + more.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</details>' : '') + '</div>';
  }
  function finish(r, ok, row) {
    var line = r.say ? r.say[ok ? 0 : 1] : '';
    if (r.type === 'bet' && row) {
      if (!ok && row.coins === 3) line = 'এতটা নিশ্চিত ছিলেন, তাই এই ভুলটা মনে রাখার মতো। আজকের সবচেয়ে দামি শিক্ষা এটাই।';
      else if (ok && row.coins === 1) line = 'জানতেন, শুধু ভরসা ছিল না। নিজের ওপর আরেকটু বিশ্বাস রাখুন।';
    }
    streak = ok ? streak + 1 : 0;
    var C = $('card'), g = document.createElement('div');
    g.innerHTML = gsay(line); if (g.firstChild) C.appendChild(g.firstChild);
    if (streak === 5 && !solemn) { toast('পরপর ৫টা ঠিক!'); sparkle(12); }
    var box = document.createElement('div'); box.innerHTML = exBox(r, ok); var bx = box.firstChild; C.appendChild(bx);
    fin0 = Date.now(); exo = 0;
    var dt = bx.querySelector('details'); if (dt) dt.addEventListener('toggle', function () { if (dt.open && !exo) exo = Math.round((Date.now() - fin0) / 100) / 10 || 0.1; });
    var full = Object.assign({ s: S.id, q: r.id, r: i + 1, ty: r.type, d: r.d || 0, ok: ok ? 1 : 0, sec: sec(), v: ver(r) }, row || {});
    rows.push(full); ev(full);
    log.push({ ok: ok, g: r.g, id: r.id });
    if (!ok && (r.type === 'mcq' || r.type === 'base' || r.type === 'star' || r.type === 'bet' || r.type === 'clue')) remember(r);
    go(r);
  }
  function remember(r) {
    prog.wr = prog.wr.filter(function (w) { return w.id !== r.id; });
    prog.wr.push({ s: S.id, sn: S.name, id: r.id, q: r.q, o: r.o, a: r.a, e: (r.ex || [])[0] || '' });
    if (prog.wr.length > 8) prog.wr = prog.wr.slice(-8);
    saveProg();
  }
  function go(r) {
    words.push(r.c); topBar();
    var b = document.createElement('button'); b.className = 'go in';
    b.textContent = i < 9 ? 'সামনে এগোই →' : (solemn ? 'স্মারকের কাছে যাই →' : 'সিন্দুকের কাছে যাই →');
    b.onclick = function () {
      if (busy) return; b.disabled = true;
      ev({ s: S.id, q: r.id, r: i + 1, ty: 'nx', sec: Math.round((Date.now() - fin0) / 100) / 10, exo: exo || 0 });
      window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      i++; walk(cum[i], function () { i < 10 ? show() : sentence(); });
    };
    $('card').appendChild(b);
  }

  var K = {
    mcq: function (r, el) {
      var coins = 0, bet = r.type === 'bet';
      el.innerHTML = (bet ? '<p class="small" style="margin:0 0 8px">' + (solemn ? 'আগে বলুন, উত্তরে কতটা নিশ্চিত?' : 'আগে বাজি ধরুন: কতটা নিশ্চিত?') + '</p><div style="display:flex;gap:8px;margin-bottom:12px">' +
        [1, 2, 3].map(function (c) { return '<button class="coin" data-c="' + c + '">' + (solemn ? ['', 'একটু', 'মোটামুটি', 'পুরো'][c] : bn(c) + ' কয়েন') + '</button>'; }).join('') + '</div>' : '') +
        '<div id="o"></div><p id="err" style="font-size:14px;color:var(--bad);margin:4px 0 0"></p><div id="sub"></div>';
      el.querySelectorAll('.coin').forEach(function (b) {
        b.onclick = function () { coins = +b.dataset.c; el.querySelectorAll('.coin').forEach(function (x) { x.classList.toggle('on', x === b); }); $('err').textContent = ''; };
      });
      opts(r.o, r.a, $('o'), function (k) {
        var ok = k === r.a, row = { ans: k };
        if (bet) row.coins = coins;
        if (r.codes && !ok) row.code = r.codes[k];
        if (r.type === 'base' && r.st && !ok) {
          $('sub').innerHTML = '<div class="in" style="margin-top:14px">' + gsay('চলুন এক ধাপ পেছনে যাই। এই ছোট প্রশ্নটা পারলে ওপরেরটাও সহজ হয়ে যাবে।') +
            '<p class="qq" style="margin-top:10px">' + esc(r.st.q) + '</p><div id="o2"></div></div>';
          opts(r.st.o, r.st.a, $('o2'), function (k2) { row.base = k2 === r.st.a ? 1 : 0; row.bk = k2; finish(r, ok, row); });
          return;
        }
        finish(r, ok, row);
      }, function () { if (bet && !coins) { $('err').textContent = solemn ? 'আগে নিশ্চয়তা বাছুন' : 'আগে কয়েন বাছুন'; return false; } return true; });
    },
    clue: function (r, el) {
      var n = 1;
      el.innerHTML = '<div id="cl"></div><p id="star" class="small" style="margin:4px 0 8px"></p><button id="more" style="width:100%;min-height:44px;margin-bottom:12px">আরেকটা সূত্র খুলুন</button><div id="o"></div>';
      var draw = function () {
        $('cl').innerHTML = r.clues.slice(0, n).map(function (c, k) { return '<p class="clue in">সূত্র ' + bn(k + 1) + ': ' + esc(c) + '</p>'; }).join('');
        $('star').textContent = 'এখন ঠিক উত্তর দিলে পাবেন ' + '★'.repeat(4 - n);
        if (n >= r.clues.length) $('more').style.display = 'none';
      };
      $('more').onclick = function () { n++; draw(); }; draw();
      opts(r.o, r.a, $('o'), function (k) {
        $('more').style.display = 'none';
        var ok = k === r.a, row = { ans: k, clues: n };
        if (!ok) row.code = r.codes[k];
        if (ok) $('star').textContent = 'পেলেন ' + '★'.repeat(4 - n);
        finish(r, ok, row);
      });
    },
    big: function (r, el) {
      var j = 0, res = [], pk = [], mc = [];
      var draw = function () {
        var p = r.pairs[j];
        el.innerHTML = '<p class="small" style="margin:0 0 6px">' + bn(j + 1) + ' / ' + bn(r.pairs.length) + ' · ' + esc(p.q) + '</p><div class="pair in">' + p.o.map(function (o, k) { return '<button data-k="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div>';
        var lk = 0;
        el.querySelectorAll('.pair button').forEach(function (b) {
          b.onclick = function () {
            if (lk) return; lk = 1; var k = +b.dataset.k, ok = k === p.a;
            el.querySelectorAll('.pair button').forEach(function (x, m) { if (m === p.a) x.classList.add('ok'); else if (m === k) x.classList.add('bad'); });
            res.push(ok ? 1 : 0); pk.push(k); if (!ok && p.m) mc.push(p.m);
            setTimeout(function () {
              j++;
              if (j < r.pairs.length) draw();
              else { var n = res.filter(Boolean).length; el.innerHTML = '<p style="margin:0">' + bn(r.pairs.length) + 'টার মধ্যে ' + bn(n) + 'টা ঠিক।</p>'; finish(r, n === r.pairs.length, { parts: res, pk: pk, code: mc[0] || null, mc: mc.length > 1 ? mc : null }); }
            }, 850);
          };
        });
      };
      draw();
    },
    map: function (r, el) {
      el.innerHTML = '<div class="mapbox ' + r.map + '"><p class="loading">মানচিত্র আসছে…</p></div>';
      fetch('/game/data/map-' + r.map + '.json').then(function (x) { return x.json(); }).then(function (M) {
        var hl = M.hl, saarc = ['Bangladesh', 'India', 'Pakistan', 'Nepal', 'Bhutan', 'Sri Lanka', 'Maldives', 'Afghanistan'];
        var paths = M.c.map(function (c) {
          var on = hl === 'SAARC' ? saarc.indexOf(c.n) >= 0 : c.n === hl;
          return '<path d="' + c.d + '" fill="' + (on ? '#cfe6b8' : '#ece7dc') + '" stroke="' + (on ? '#5f8f3a' : '#b9b2a4') + '" stroke-width="' + (on ? 1.1 : .7) + '"/>';
        }).join('');
        var proj = function (lon, lat) { return [(lon - M.lon0) * M.sx, (M.lat1 - lat) * M.sy]; };
        var extra = '';
        if (r.map === 'bd') { var dk = proj(90.41, 23.81); extra = '<circle cx="' + dk[0] + '" cy="' + dk[1] + '" r="3.2" fill="#13294b"/><text x="' + (dk[0] + 5) + '" y="' + (dk[1] + 4) + '" style="font-size:11px;fill:#13294b">ঢাকা</text><text x="' + (M.w * .52) + '" y="' + (M.h - 16) + '" style="font-size:12px;fill:#3d6f99">বঙ্গোপসাগর</text>'; }
        el.querySelector('.mapbox').innerHTML = '<svg viewBox="0 0 ' + M.w + ' ' + M.h + '" role="img" aria-label="মানচিত্র">' + paths + extra + '<g id="mk"></g></svg><p class="small" style="margin:6px 0 0;text-align:center">যেখানে মনে হয়, সেখানে একবার চাপুন</p>';
        var svg = el.querySelector('svg'), lk = 0;
        svg.addEventListener('click', function (e) {
          if (lk) return; lk = 1;
          var b = svg.getBoundingClientRect(), x = (e.clientX - b.left) * M.w / (b.width || M.w), y = (e.clientY - b.top) * M.h / (b.height || M.h);
          var lon = M.lon0 + x / M.sx, lat = M.lat1 - y / M.sy, T = r.target, tp = proj(T.lon, T.lat);
          var rad = Math.PI / 180, dLa = (lat - T.lat) * rad, dLo = (lon - T.lon) * rad;
          var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(lat * rad) * Math.cos(T.lat * rad) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
          var km = Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))), ok = km <= r.tol;
          var big = r.tol * .5, dir = ok ? '' : ((Math.abs(lat - T.lat) * 111 > big ? (lat > T.lat ? 'উত্তরে' : 'দক্ষিণে') : '') + (Math.abs(lon - T.lon) * 102 > big ? (lat !== T.lat && Math.abs(lat - T.lat) * 111 > big ? '-' : '') + (lon > T.lon ? 'পূর্বে' : 'পশ্চিমে') : ''));
          var sw = M.w / 300;
          $('mk').innerHTML = '<line x1="' + x + '" y1="' + y + '" x2="' + tp[0] + '" y2="' + tp[1] + '" stroke="#b3261e" stroke-width="' + sw + '" stroke-dasharray="3 3"/><circle cx="' + x + '" cy="' + y + '" r="' + 5 * sw + '" fill="#b3261e" stroke="#fff" stroke-width="2"/><circle cx="' + tp[0] + '" cy="' + tp[1] + '" r="' + 6 * sw + '" fill="#1e7a46" stroke="#fff" stroke-width="2"/><text x="' + (tp[0] + 8 * sw) + '" y="' + (tp[1] + 4) + '" style="font-size:' + 12 * sw + 'px;fill:#1e7a46;font-weight:600">' + esc(T.name) + '</text>';
          var msg = document.createElement('p'); msg.style.cssText = 'margin:8px 0 0;font-size:16px';
          msg.innerHTML = ok ? '<b style="color:var(--good)">একদম কাছে!</b> আসল জায়গা থেকে মাত্র ' + bn(km) + ' কিমি দূরে চেপেছেন।'
            : 'আপনি চেপেছেন আসল জায়গা থেকে প্রায় <b>' + bn(km) + ' কিমি</b> দূরে' + (dir ? ', একটু বেশি ' + dir : '') + '। সবুজ বিন্দুটা আসল ' + esc(T.name) + '।';
          el.appendChild(msg);
          finish(r, ok, { km: km, at: [+lat.toFixed(2), +lon.toFixed(2)] });
        });
      }).catch(function () { el.innerHTML = '<p class="small">মানচিত্র আসেনি; ইন্টারনেট দেখে আবার চেষ্টা করুন।</p><button class="go2" id="skipm">এই রাউন্ড বাদ দিন</button>'; $('skipm').onclick = function () { finish(r, false, { skip: 1 }); }; });
    },
    tl: function (r, el) {
      var line = [Object.assign({ st: '' }, r.base)], hand = shuffle(r.cards), res = [], pl = [], N = r.cards.length;
      var lab = function (x) { return x.yl ? esc(x.yl) : x.y < 0 ? 'খ্রি.পূ. ' + bn(-x.y) : bn(x.y); };
      var gl = function (g) { return g === 0 ? ' (সবার আগে)' : g === line.length ? ' (সবার পরে)' : ' (এই দুইয়ের মাঝে)'; };
      var draw = function () {
        var c = hand[0], h = c ? '<div class="hand in">নতুন ঘটনা ' + bn(N - hand.length + 1) + ' / ' + bn(N) + ': <b>' + esc(c.l) + '</b></div>' : '';
        h += '<div class="tlhead"><span>↑ পুরোনো</span><span>নতুন ↓</span></div>';
        line.forEach(function (x, g) { if (c) h += '<button class="gap" data-g="' + g + '">＋ এখানে বসান' + gl(g) + '</button>'; h += '<div class="tli ' + x.st + '"><b>' + lab(x) + '</b>' + esc(x.l) + '</div>'; });
        if (c) h += '<button class="gap" data-g="' + line.length + '">＋ এখানে বসান' + gl(line.length) + '</button>';
        el.innerHTML = h;
        el.querySelectorAll('.gap').forEach(function (b) {
          b.onclick = function () {
            var g = +b.dataset.g, cor = line.filter(function (x) { return x.y < c.y; }).length, ok = g === cor;
            pl.push([r.cards.indexOf(c), g, cor]);
            line.splice(cor, 0, Object.assign({}, c, { st: ok ? 'ok' : 'bad' })); res.push(ok ? 1 : 0); hand.shift(); draw();
            if (!hand.length) finish(r, res.every(Boolean), { parts: res, pl: pl });
          };
        });
      };
      draw();
    },
    match: function (r, el) {
      var j = 0, res = [], pk = [];
      var draw = function () {
        el.innerHTML = '<p class="small" style="margin:0 0 6px">' + bn(j + 1) + ' / ' + bn(r.L.length) + '</p><p class="mq in">' + esc(r.L[j]) + ' — ' + esc(r.ask) + '</p><div id="o"></div>';
        opts(r.Rr, r.ans[j], $('o'), function (k) {
          res.push(k === r.ans[j] ? 1 : 0); pk.push(k);
          setTimeout(function () {
            j++;
            if (j < r.L.length) draw();
            else { var n = res.filter(Boolean).length; el.innerHTML = '<p style="margin:0">' + bn(r.L.length) + 'টার মধ্যে ' + bn(n) + 'টা ঠিক মিলেছে।</p>'; finish(r, n === res.length, { parts: res, pk: pk }); }
          }, 900);
        });
      };
      draw();
    },
    note: function (r, el) {
      el.innerHTML = '<div class="paper">' + r.lines.map(function (x, k) { return '<button class="nl" data-k="' + k + '">' + bn(k + 1) + '. ' + esc(x) + '</button>'; }).join('') + '</div>';
      var lk = 0;
      el.querySelectorAll('.nl').forEach(function (b) {
        b.onclick = function () {
          if (lk) return; lk = 1; var k = +b.dataset.k, ok = k === r.a;
          el.querySelectorAll('.nl').forEach(function (x, j) { if (j === r.a) x.classList.add('bad'); if (j === k && !ok) x.style.outline = '2px solid var(--warn)'; });
          var m = document.createElement('p'); m.style.cssText = 'margin:8px 0 0;font-size:15px';
          m.innerHTML = ok ? '<b style="color:var(--good)">ধরে ফেলেছেন!</b> লাল লাইনটাতেই ভুল তথ্য।' : 'আপনি যেটা বেছেছেন (হলুদ দাগ), সেটা আসলে ঠিক। ভুল তথ্য লাল লাইনে।';
          el.appendChild(m);
          var row = { ans: k }; if (!ok) row.code = r.codes[k];
          finish(r, ok, row);
        };
      });
    }
  };
  K.base = K.star = K.bet = K.mcq;

  /* ---------- আগের ভুল ফিরে আসে ("মনে আছে?") ---------- */
  function warmup(cb) {
    warm = prog.wr.filter(function (w) { return w.s !== S.id; }).slice(-2);
    if (!warm.length) return cb();
    var j = 0;
    var step = function () {
      if (j >= warm.length) return cb();
      var w = warm[j], C = $('card'); anim(C);
      C.innerHTML = (j === 0 ? gsay('শুরুর আগে আগের একটা পর্যায়ের ভুল প্রশ্ন আবার দেখি। এবার নিশ্চয়ই পারবেন!', 1) : '') +
        '<p class="rt">মনে আছে? · ' + esc(w.sn) + '</p><p class="qq">' + esc(w.q) + '</p><div id="o"></div><div id="wres"></div>';
      t0 = Date.now();
      opts(w.o, w.a, $('o'), function (k) {
        var ok = k === w.a;
        var ag = { s: S.id, q: w.id, r: 0, ty: 'again', ok: ok ? 1 : 0, sec: sec(), ans: k, from: w.s }; rows.push(ag); ev(ag);
        if (ok) prog.wr = prog.wr.filter(function (x) { return x.id !== w.id; }), saveProg();
        $('wres').innerHTML = (ok ? '<p><span class="seal">আগে ভুল, আজ ঠিক</span></p>' : '') +
          '<div class="exbox in"><p>' + esc(w.e) + '</p></div><button class="go in" id="wn">' + (j + 1 < warm.length ? 'পরেরটা →' : 'এবার আজকের যাত্রা শুরু →') + '</button>';
        $('wn').onclick = function () { j++; window.scrollTo({ top: 0 }); step(); };
      });
    };
    step();
  }

  /* ---------- শেষ: বাক্য সাজানো → সিন্দুক/স্মারক ---------- */
  function sentence() {
    dots(); $('prog').textContent = '১০ / ১০';
    var W = R.map(function (r) { return r.c; }), C = $('card'); anim(C);
    var k = 0, bad = 0, help = 0, ch = W.map(function (w, j) { return { w: w, j: j }; });
    ch = shuffle(ch); if (ch.every(function (x, j) { return x.j === j; })) ch.reverse();
    C.innerHTML = gsay(solemn ? 'শেষ ধাপ। পথে পাওয়া ১০টা শব্দ দিয়ে আজকের কথাটা সাজিয়ে নিন।' : 'সিন্দুকের তালা খুলবে পুরো বাক্যে। পথে পাওয়া ১০টা শব্দ ক্রমমতো সাজান!', 1) +
      '<p class="rt">শেষ ধাপ</p><p class="qq">প্রথম শব্দ থেকে শুরু করে একে একে শব্দগুলো চাপুন।</p><div id="sent" class="sent"></div><div id="chips" class="chips">' +
      ch.map(function (x, m) { return '<button class="chip" data-m="' + m + '">' + esc(x.w) + '</button>'; }).join('') +
      '</div><p id="hint" class="small" style="margin:8px 0 0;min-height:22px"></p><button id="auto" class="nl" style="text-align:center;margin-top:6px">পারছি না, সাজিয়ে দিন</button>';
    var S2 = function () { $('sent').innerHTML = W.map(function (w, j) { return j < k ? '<span>' + esc(w) + '</span>' : '<span style="color:#cfc6b8">＿</span>'; }).join(' '); }; S2();
    var done = function () { $('auto').style.display = 'none'; setTimeout(function () { chest(bad, help); }, 600); };
    var nextHint = function () {
      C.querySelectorAll('.chip.hint').forEach(function (h) { h.classList.remove('hint'); });
      var b = [].slice.call(C.querySelectorAll('.chip')).find(function (b) { return !b.disabled && ch[+b.dataset.m].w === W[k]; });
      if (b) { b.classList.add('hint'); $('hint').textContent = 'সবুজ দাগের শব্দটা এবার।'; }
    };
    C.querySelectorAll('.chip').forEach(function (b) {
      b.onclick = function () {
        if (k >= W.length) return; var x = ch[+b.dataset.m];
        if (x.w === W[k]) { b.classList.add('gone'); b.disabled = true; k++; S2(); $('hint').textContent = ''; C.querySelectorAll('.chip.hint').forEach(function (h) { h.classList.remove('hint'); }); if (k === W.length) done(); else if (bad >= 3) nextHint(); }
        else { bad++; b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 600); $('hint').textContent = '"' + x.w + '" আরও পরে আসবে।'; if (bad >= 3) nextHint(); }
      };
    });
    $('auto').onclick = function () { if (k >= W.length) return; help = 1; k = W.length; S2(); C.querySelectorAll('.chip').forEach(function (b) { b.classList.add('gone'); b.disabled = true; }); done(); };
  }
  var CC = [['#fac775', '#ef9f27', '#854f0b'], ['#f1efe8', '#d3d1c7', '#5f5e5a'], ['#f0b48e', '#c46a42', '#712b13']];
  function medal(t, emblem, size, cls) {
    var c = CC[t];
    return '<svg class="' + (cls || '') + '" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="' + c[1] + '" stroke="' + c[2] + '" stroke-width="3"/><circle cx="60" cy="60" r="45" fill="' + c[0] + '" stroke="' + c[2] + '" stroke-width="1.5" stroke-dasharray="3 3"/><g transform="translate(30 30) scale(1.5)">' + (emblem || '') + '</g></svg>';
  }
  function sparkle(n) {
    if (RM) return;
    var box = document.createElement('div'); box.className = 'cele'; var cols = ['#c8326a', '#e0b45c', '#1e7a46', '#13294b', '#7fb3d9'];
    for (var k = 0; k < n; k++) {
      var s = document.createElement('i'), sz = 6 + Math.random() * 6;
      s.style.cssText = 'position:absolute;top:-12px;left:' + (Math.random() * 100) + 'vw;width:' + sz + 'px;height:' + (sz * .6) + 'px;background:' + cols[k % 5] + ';border-radius:1px;animation:fall ' + (1.4 + Math.random() * 1.2) + 's ' + (Math.random() * .4) + 's ease-in forwards';
      box.appendChild(s);
    }
    document.body.appendChild(box); setTimeout(function () { box.remove(); }, 3200);
  }
  function chest(bad, help) {
    var n = log.filter(function (x) { return x.ok; }).length, tier = n >= 9 ? 0 : n >= 6 ? 1 : 2, TN = ['সোনালি', 'রুপালি', 'তামার'][tier], starsN = 3 - tier;
    var prev = prog.done[S.id] || { plays: 0 }, plays = (prev.plays || 0) + 1, firstClear = !prog.done[S.id];
    prog.done[S.id] = { t: Math.min(tier, prev.t == null ? 9 : prev.t), best: Math.max(n, prev.best || 0), plays: plays, at: Date.now() };
    var td = today(); if (prog.days.indexOf(td) < 0) prog.days.push(td); prog.days = prog.days.slice(-30);
    saveProg();
    $('lid').classList.add('open');
    if (!solemn) { sparkle(tier === 0 ? 40 : 18); try { navigator.vibrate && navigator.vibrate(30); } catch (e) { } }
    var idx = LIST.findIndex(function (x) { return x.id === S.id; }), nxt = LIST[idx + 1];
    var shelf = LIST.filter(function (x) { return prog.done[x.id]; }).slice(-5);
    var C = $('card'); anim(C);
    C.innerHTML =
      '<p class="hd" style="font-size:22px;margin:0 0 2px;text-align:center;color:var(--navy)">' + (solemn ? 'স্মারক আপনার হাতে' : 'সিন্দুক খুলে গেল!') + '</p>' +
      '<p class="hd" style="font-size:18px;margin:0 0 4px;text-align:center;color:var(--pink)">"' + esc(R.map(function (r) { return r.c; }).join(' ')) + '"</p>' +
      medal(tier, S.emblem, 124, RM ? '' : 'coinbig') +
      '<p class="starrow">' + [0, 1, 2].map(function (k) { return '<span class="' + (k < starsN ? 'on' : '') + '" style="animation-delay:' + (0.9 + k * 0.25) + 's">★</span>'; }).join('') + '</p>' +
      '<p style="margin:0 0 4px;text-align:center"><b>' + (solemn ? '' : TN + ' ') + esc(S.memento) + '</b></p>' +
      gsay(S.guide.chest[tier]) +
      '<p class="small" style="margin:8px 0 12px;text-align:center">১০টার মধ্যে ' + bn(n) + 'টায় পুরো ঠিক। ' + (tier ? '৯টা বা তার বেশি ঠিক হলে তিন তারা।' : 'তিন তারা, সবচেয়ে ভালো ফল!') + '</p>' +
      (plays >= 2 && S.bonus ? '<div class="exbox in" style="margin:0 0 12px;background:#fffef8;border:1.3px solid var(--rule)"><p class="exh">' + (solemn ? 'আরেকটা পাতা: ' : 'সিন্দুকের তলায় আরেকটা জিনিস: ') + esc(S.bonus.t) + '</p>' + S.bonus.p.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>'
        : '<p class="small" style="margin:0 0 12px;padding:8px 10px;border:1.3px dashed var(--warn);border-radius:3px">' + (solemn ? 'আবার খেললে এই পর্যায়ের আরেকটা পাতা খুলবে।' : 'সিন্দুকের তলায় আরও কিছু আছে মনে হচ্ছে… আবার খেললে দেখতে পাবেন।') + '</p>') +
      '<p style="margin:0 0 2px;font-weight:600">আপনার সংগ্রহশালা</p><div class="shelf">' +
      shelf.map(function (x) { var d = prog.done[x.id]; return '<div class="slot' + (x.id === S.id ? ' new' : '') + '">' + medal(d.t || 0, x.emblem, 40) + '<div>' + esc(x.name) + '</div></div>'; }).join('') +
      (nxt ? '<div class="slot lock">' + medal(1, nxt.emblem, 40) + '<div>পরের</div></div>' : '') + '</div>' +
      (nxt ? '<a class="go" href="/game/play/?s=' + nxt.id + '" style="text-align:center;text-decoration:none;padding-top:13px">পরের পর্যায়: ' + esc(nxt.name) + ' →</a>'
        : '<p class="cert"><b>২০টা পর্যায়ই শেষ!</b><br>সব পর্যায়ের পাতায় আপনার সনদ অপেক্ষা করছে।</p>') +
      '<button class="go2" id="again">আবার খেলুন</button><a class="go2" href="/game/" style="display:block;text-align:center;padding-top:10px;color:var(--navy)">সব পর্যায়</a>';
    if (firstClear && LIST.filter(function (x) { return prog.done[x.id]; }).length % 5 === 0) setTimeout(function () { toast('নতুন পদক পেলেন! সব পর্যায়ের পাতায় দেখুন।'); }, 1800);
    var er = { s: S.id, r: 11, ty: 'end', ok: n, bad: bad, help: help, tier: tier, plays: plays, sec: Math.round((Date.now() - startedAt) / 1000) };
    rows.push(er); ended = 1; ev(er); clearTimeout(sendT); send();
    flush(n);
    $('again').onclick = function () { location.reload(); };
  }
  function flush(n) {
    rows = [];
    try {
      if (window.LBA && LBA.save) {
        var p = prog.done[S.id].plays, sb = {}; sb[S.name] = [n, 10];
        LBA.save({ k: 'game-' + S.id + '#' + p, c: 'game', t: 'বুদ্ধির গেম: ' + S.name, p: '/game/play/?s=' + S.id, s: n, n: 10, ok: n, no: 10 - n, sec: Math.round((Date.now() - startedAt) / 1000), sb: sb });
      }
    } catch (e) { }
  }

  /* ---------- শুরু ---------- */
  function fail(msg) { $('card').innerHTML = '<p>' + msg + '</p><a class="go" href="/game/" style="text-align:center;text-decoration:none;padding-top:13px">সব পর্যায়</a>'; }
  Promise.all([
    fetch('/game/data/stages.json').then(function (x) { return x.json(); }),
    fetch('/game/data/' + sid + '.json').then(function (x) { if (!x.ok) throw 0; return x.json(); })
  ]).then(function (res) {
    LIST = res[0].stages || []; S = res[1]; R = S.rounds;
    solemn = S.tone === 'solemn'; if (solemn) document.body.classList.add('solemn');
    var idx = LIST.findIndex(function (x) { return x.id === S.id; });
    document.title = S.name + ' · বুদ্ধির গেম · লিয়ানা বুকস';
    $('stn').textContent = 'পর্যায় ' + bn(idx + 1) + ' / ' + bn(LIST.length) + ' · ' + S.sub;
    $('stt').textContent = S.name;
    if (idx > 0 && !prog.done[LIST[idx - 1].id]) {
      drawScene(); dots();
      $('card').innerHTML = gsay('এই পর্যায়টা খুলবে আগেরটা শেষ হলে। যাত্রাটা সহজ থেকে কঠিনের দিকে সাজানো।', 1) +
        '<a class="go" href="/game/play/?s=' + LIST[idx - 1].id + '" style="text-align:center;text-decoration:none;padding-top:13px">আগের পর্যায়: ' + esc(LIST[idx - 1].name) + ' →</a><a class="go2" href="/game/" style="display:block;text-align:center;padding-top:10px;color:var(--navy)">সব পর্যায়</a>';
      return;
    }
    drawScene(); topBar();
    var go = function () {
      startedAt = Date.now(); begun = 1;
      ev({ s: S.id, r: 0, ty: 'start', plays: (prog.done[S.id] || {}).plays || 0, warm: prog.wr.filter(function (w) { return w.s !== S.id; }).slice(-2).length, sw: window.innerWidth });
      warmup(show);
    };
    if (window.LBA && LBA.signin && !LBA.user()) {
      $('card').innerHTML = gsay('যাত্রা শুরুর আগে একবার লগইন করে নিন। তাহলে আপনার পদক, সংগ্রহ আর কোথায় ভুল হচ্ছে, সব জমা থাকবে; ফোন বদলালেও হারাবে না।', 1) +
        '<div id="gate" style="margin-top:14px;display:flex;justify-content:center;min-height:48px"></div><p class="small" style="text-align:center;margin:8px 0 0">Google দিয়ে, পাসওয়ার্ড লাগে না।</p>';
      LBA.signin($('gate'), function () { anim($('card')); go(); });
      return;
    }
    send();
    go();
  }).catch(function () { fail('এই পর্যায়টা খুঁজে পাওয়া গেল না, বা ইন্টারনেট নেই।'); });
})();
