/* শিক্ষার্থীর পর্যালোচনা: সব হিসাব এখানে, পাতা (index.html) শুধু দেখায়। ব্রাউজারে আর node-এ একই কোড চলে (পরীক্ষার জন্য)।
   ইনপুট:
     J  = GET /api/admin/att?uid= → {user, att:[{k,ts,c,t,s,n,ok,no,sec,qd:[[id,দাগ]],tm:[সেকেন্ড|null],m:{hid,hn,w,app}}], diag:[{sid,part,ts,ans:{qid:[দাগ,ঠিক,ms]},res}]}
     M  = /admin/data/qmap.json (tools/build_qmap.py) → {S:[[কোড,নাম]], T:[[id,নাম,বিষয়]], Q:{qid:[টপিক|-1, বিষয়, সঠিক]}}
     QS = GET /api/qstat → {rows:[[qid,n,ok,last]]} (সবার মিলিয়ে প্রশ্নের কঠিনতা)
     goal = TARGETS-এর একটা চাবি
   নিয়ম (Fable-যাচাই 2026-11-04): ছোট নমুনায় সিদ্ধান্ত নয়, "অনিশ্চিত" লেখা; একই প্রশ্ন বারবার এলে বিষয়ের মানে প্রথম দেখাটাই গোনা। */
(function (root) {
  'use strict';
  // লক্ষ্যের পরীক্ষা: বিষয়ের নম্বর আর ভুলে কাটা (বিসিএস: SUBJECT-PLAN.md §১; পেট্রোবাংলা: pilot/custom-plan pb-start-এর weight)
  var TARGETS = {
    bcs: {name: 'বিসিএস প্রিলি', neg: 0.5, marks: {bn: 30, eng: 30, bd: 25, intl: 25, math: 20, sci: 15, ict: 15, mental: 15, ethics: 15, geo: 10}},
    pb: {name: 'পেট্রোবাংলা (সহকারী ব্যবস্থাপক)', neg: 0.25, marks: {math: 27, eng: 26, bn: 16, bd: 11, intl: 9, ict: 5}}
  };
  var MIN_N = 15;        // একটা বিষয়/টপিকে এর কম উত্তরে মান "অনিশ্চিত"
  // কঠিন/সহজ: অন্তত QMIN জন দেখেছেন, আর সবার ঠিকের হারের ৯০% সীমাও (উইলসন) কঠিনে ৪০%-এর নিচে / সহজে ৭০%-এর ওপরে (Fable: ৮ জনে শুধু গোলমাল)
  var QMIN = 25, HARD_HI = 0.4, EASY_LO = 0.7, EXP_MIN = 10;   // প্রত্যাশিত মানের জন্য অন্তত EXP_MIN জন

  function pct(a, b) { return b ? Math.round(a / b * 100) : null; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function dayKey(ts) { return new Date(ts + 6 * 3600e3).toISOString().slice(0, 10); }   // ঢাকার দিন
  function hourOf(ts) { return new Date(ts + 6 * 3600e3).getUTCHours(); }
  // উইলসনের নিচের সীমা: অল্প প্রশ্নে খুব উঁচু/নিচু হার যাতে বড় না দেখায় (দুর্বল টপিক সাজাতে)
  function wilsonLow(k, n) { if (!n) return 0; var z = 1.64, p = k / n, d = 1 + z * z / n; return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; }
  function wilsonHigh(k, n) { return 1 - wilsonLow(n - k, n); }

  function build(J, M, QS, goal) {
    var G = TARGETS[goal] || TARGETS.bcs, Q = M.Q || {}, S = M.S || [], T = M.T || [];
    // প্রশ্নের কঠিনতা (সবার মিলিয়ে): p = প্রত্যাশিত ঠিকের সম্ভাবনা ((ok+1)/(n+2), অল্প দেখায় মাঝামাঝি টানে); cls = কঠিন/সহজ
    var diff = {};
    ((QS && QS.rows) || []).forEach(function (r) {
      if (r[1] < EXP_MIN) return;
      var d = {p: (r[2] + 1) / (r[1] + 2), cls: ''};
      if (r[1] >= QMIN) { if (wilsonHigh(r[2], r[1]) < HARD_HI) d.cls = 'hard'; else if (wilsonLow(r[2], r[1]) > EASY_LO) d.cls = 'easy'; }
      diff[r[0]] = d;
    });

    // ---- ১. সব উত্তর একটা তালিকায় ----
    var exams = [], A = [], keyBad = 0, noTime = 0;
    (J.att || []).forEach(function (a) {
      if (!a.qd || !a.qd.length) return;
      var rows = [], mine = 0, known = 0;
      a.qd.forEach(function (x, i) {
        var q = Q[x[0]], pick = x[1], r = {qid: x[0], pos: i, pick: pick, skip: pick < 0, t: a.tm ? a.tm[i] : null,
          topic: q ? q[0] : -1, subj: q ? q[1] : -1, k: q ? q[3] || 4 : 4, ok: null};
        if (q && pick >= 0) { known++; r.ok = pick === q[2] ? 1 : 0; mine += r.ok; }
        rows.push(r);
      });
      // উত্তর-চাবি মেলে কি না: আমাদের গোনা সঠিক = পাতার গোনা সঠিক (অপশন এলোমেলো করা পাতায় মেলে না, তখন ঠিক/ভুল বাদ)
      var answered = rows.filter(function (r) { return !r.skip; }).length;
      var trust = a.ok == null || (known === answered && mine === a.ok);
      if (!trust) { keyBad++; rows.forEach(function (r) { r.ok = null; }); }
      if (!a.tm) noTime++;
      var e = {src: 'att', k: a.k, c: a.c || '', ts: a.ts, title: a.t || '', n: a.n || rows.length, sec: a.sec, m: a.m || null, rows: rows, trust: trust, timed: !!a.tm};
      // ফাঁকা কেন: শেষ দাগের আগের ফাঁকা = ইচ্ছা করে ছাড়া; শেষ দাগের পরের ফাঁকা আর শেষ দাগের ৩০ সেকেন্ডের মধ্যে জমা = সময় ফুরিয়েছে
      var lastPos = -1, lastT = 0;
      rows.forEach(function (r) { if (!r.skip) { lastPos = Math.max(lastPos, r.pos); if (r.t != null) lastT = Math.max(lastT, r.t); } });
      var tail = rows.filter(function (r) { return r.skip && r.pos > lastPos; }).length;
      e.skipChose = rows.filter(function (r) { return r.skip && r.pos < lastPos; }).length;
      e.skipTail = tail;
      e.timeOut = !!(tail && a.tm && a.sec && a.sec - lastT < 30);
      exams.push(e);
    });
    (J.diag || []).forEach(function (d) {
      if (!d.res) return;                   // শেষ না হওয়া ভাগ নয়
      var rows = Object.keys(d.ans || {}).map(function (id, i) {
        var x = d.ans[id], q = Q[id];
        return {qid: id, pos: i, pick: x[0], skip: x[0] < 0, ms: x[2] || null, topic: q ? q[0] : -1, subj: q ? q[1] : -1, k: q ? q[3] || 4 : 4, ok: x[0] < 0 ? null : x[1] ? 1 : 0, shuffled: true};
      });
      // ভাগের না-ছোঁয়া প্রশ্নও ফাঁকা হিসেবে আছে res-এ; এখানে শুধু দাগানো/ফাঁকা পাঠানোগুলো
      exams.push({src: 'diag', k: d.sid + '#' + d.part, c: 'diag', ts: d.ts, title: 'অবস্থা-যাচাই ' + d.sid + ' · ভাগ ' + d.part, n: d.res.n, rows: rows,
        trust: true, timed: true, m: {hid: d.hid || 0, hn: d.hn || 0}, skipChose: 0, skipTail: 0, timeOut: false});
    });
    exams.sort(function (x, y) { return x.ts - y.ts; });
    exams.forEach(function (e, i) { e.no = i; e.rows.forEach(function (r) { r.e = i; r.ts = e.ts; A.push(r); }); });

    // প্রথম দেখা (মান গোনার জন্য): একই প্রশ্ন দ্বিতীয়বার এলে উত্তর মনে থাকতে পারে
    var seen = {}, first = [];
    A.forEach(function (r) { if (!seen[r.qid]) { seen[r.qid] = []; first.push(r); } seen[r.qid].push(r); });

    function tally(list) {
      var o = {n: list.length, ans: 0, ok: 0, no: 0, skip: 0, unk: 0};
      var ex = 0, exN = 0, exOk = 0;
      list.forEach(function (r) {
        if (r.skip) o.skip++; else { o.ans++; if (r.ok === 1) o.ok++; else if (r.ok === 0) o.no++; else o.unk++; }
        var d = diff[r.qid]; if (d && r.ok !== null) { ex += d.p; exN++; exOk += r.ok; }
      });
      o.graded = o.ok + o.no;
      // প্রত্যাশার চেয়ে: একই প্রশ্নগুলোতে সবাই গড়ে যত পারেন তার চেয়ে কত শতাংশ-বিন্দু বেশি/কম (কঠিনতার প্রভাব বাদ)
      o.exN = exN; o.vsExp = exN >= MIN_N ? Math.round((exOk - ex) / exN * 100) : null;
      o.acc = pct(o.ok, o.graded);           // দাগানো প্রশ্নে ঠিকের হার
      o.attempt = pct(o.ans, o.n);
      o.small = o.graded < MIN_N;
      return o;
    }
    var all = tally(first);

    // ---- ২. সার আর ধারা ----
    var days = {}, hours = [0, 0, 0, 0, 0, 0];  // ভোর(৪-৮) সকাল(৮-১২) দুপুর(১২-১৫) বিকেল(১৫-১৮) সন্ধ্যা(১৮-২১) রাত(২১-৪)
    exams.forEach(function (e) {
      days[dayKey(e.ts)] = (days[dayKey(e.ts)] || 0) + 1;
      var h = hourOf(e.ts); hours[h >= 4 && h < 8 ? 0 : h < 12 && h >= 8 ? 1 : h >= 12 && h < 15 ? 2 : h >= 15 && h < 18 ? 3 : h >= 18 && h < 21 ? 4 : 5]++;
    });
    var dk = Object.keys(days).sort(), streak = 0, best = 0, prev = null;
    dk.forEach(function (d) { var t = Date.parse(d); streak = prev != null && t - prev === 864e5 ? streak + 1 : 1; best = Math.max(best, streak); prev = t; });
    var span = dk.length ? Math.round((Date.parse(dk[dk.length - 1]) - Date.parse(dk[0])) / 864e5) + 1 : 0;
    var third = Math.max(1, Math.floor(exams.length / 3));
    function slice(list) { var r = []; list.forEach(function (e) { r = r.concat(e.rows); }); return tally(r); }
    var trend = exams.length >= 6 ? {early: slice(exams.slice(0, third)), late: slice(exams.slice(-third)), k: third, sure: exams.length >= 20} : null;
    // প্রতি ৫ পরীক্ষার গড় (চিত্রের জন্য)
    var steps = [];
    for (var i = 0; i < exams.length; i += 5) { var s5 = slice(exams.slice(i, i + 5)); steps.push({from: i + 1, to: Math.min(i + 5, exams.length), acc: s5.acc, attempt: s5.attempt, graded: s5.graded, vsExp: s5.vsExp}); }

    // ---- ৩. বিষয় আর টপিক (প্রথম দেখা) ----
    var bySubj = {}, byTopic = {};
    first.forEach(function (r) {
      var sk = r.subj >= 0 ? r.subj : 'x';
      (bySubj[sk] = bySubj[sk] || []).push(r);
      if (r.topic >= 0) (byTopic[r.topic] = byTopic[r.topic] || []).push(r);
    });
    var subjects = Object.keys(bySubj).map(function (k) {
      var o = tally(bySubj[k]); o.code = k === 'x' ? '' : S[k][0]; o.name = k === 'x' ? 'অজানা বিষয়' : S[k][1]; return o;
    }).sort(function (a, b) { return b.n - a.n; });
    // টপিকের বড় ভাগ (sci-light-refraction → sci-light): পাতার টপিকে প্রশ্ন কম থাকলে বড় ভাগে মিলিয়ে দেখা (Fable)
    var tid = {}; T.forEach(function (t, i) { tid[t[0]] = i; });
    function parentOf(id) { var p = id; while (p.lastIndexOf('-') > 0) { p = p.slice(0, p.lastIndexOf('-')); if (tid[p] != null) return tid[p]; } return -1; }
    var group = {};
    Object.keys(byTopic).forEach(function (k) {
      (group[k] = group[k] || []).push.apply(group[k], byTopic[k]);
      var pk = parentOf(T[k][0]); if (pk >= 0) (group[pk] = group[pk] || []).push.apply(group[pk], byTopic[k]);
    });
    var topics = Object.keys(group).map(function (k) {
      var o = tally(group[k]); o.id = T[k][0]; o.name = T[k][1]; o.subj = S[T[k][2]][1]; o.parent = parentOf(T[k][0]);
      o.low = wilsonLow(o.ok, o.graded); o.high = wilsonHigh(o.ok, o.graded); return o;
    });
    // দুর্বল: অন্তত ৮টা দাগানো, আর ভালো দিকের সীমাও ৬০%-এর নিচে (মানে সত্যিই দুর্বল, ভাগ্যের ব্যাপার নয়); বড় ভাগ দুর্বল হলে তার ছোট টপিক আলাদা নয়
    function pick(list, n) {
      var out = [], ids = {};
      list.forEach(function (o) { var pi = o.parent >= 0 ? T[o.parent][0] : null; if (out.length < n && !(pi && ids[pi])) { out.push(o); ids[o.id] = 1; } });
      return out;
    }
    var weak = pick(topics.filter(function (o) { return o.graded >= 8 && o.high < 0.6; }).sort(function (a, b) { return a.high - b.high; }), 10);
    var strong = pick(topics.filter(function (o) { return o.graded >= 8 && o.low >= 0.75; }).sort(function (a, b) { return b.low - a.low; }), 6);

    // ---- ৪. ঝুঁকি নেওয়া, কঠিন প্রশ্ন এড়ানো, সহজে ভুল ----
    var w = all.no;
    var risk = {neg: G.neg, lost: Math.round(w * G.neg * 10) / 10, net: all.n ? Math.round((all.ok - w * G.neg) / all.n * 1000) / 10 : null,
      // এলোমেলো দাগে লাভ শুরু: ঠিকের সম্ভাবনা > neg/(1+neg) (০.৫ কাটায় ৩৩%, ০.২৫-এ ২০%)
      breakEven: Math.round(G.neg / (1 + G.neg) * 100)};
    var hard = {n: 0, ok: 0, no: 0, skip: 0}, easy = {n: 0, ok: 0, no: 0, skip: 0}, easyWrong = [];
    first.forEach(function (r) {
      var d = diff[r.qid]; if (!d || !d.cls || (r.ok === null && !r.skip)) return;
      var b = d.cls === 'hard' ? hard : easy;
      b.n++; if (r.skip) b.skip++; else if (r.ok) b.ok++; else b.no++;
      if (b === easy && r.ok === 0) easyWrong.push(r.qid);
    });
    var hardTried = hard.ok + hard.no;
    var avoid = hard.n >= 10 || easy.n >= 10 ? {hardSkip: pct(hard.skip, hard.n), easySkip: pct(easy.skip, easy.n),
      hardWrong: pct(hard.no, hard.n), easyWrong: pct(easy.no, easy.n), hardN: hard.n, easyN: easy.n,
      // কঠিন প্রশ্নে ঝুঁকি নিয়ে মোট লাভ/ক্ষতি (লক্ষ্যের পরীক্ষার কাটা দিয়ে): ঋণাত্মক হলে না দাগানোই ভালো ছিল
      hardTried: hardTried, hardNet: Math.round((hard.ok - hard.no * G.neg) * 10) / 10, hardAcc: pct(hard.ok, hardTried)} : null;
    // প্রমাণ থাকলে তবেই ধরন (Fable: শুধু লেবেল নয়, সংখ্যাসহ)
    risk.signs = [];
    if (avoid && hardTried >= 20 && avoid.hardNet < 0) risk.signs.push('bold');
    if (avoid && easy.n >= 20 && avoid.easySkip >= 15) risk.signs.push('shy');
    if (avoid && easy.n >= 20 && avoid.easyWrong >= 15) risk.signs.push('careless');
    var skipChose = 0, skipTail = 0, timeOut = 0;
    exams.forEach(function (e) { skipChose += e.skipChose || 0; skipTail += e.skipTail || 0; if (e.timeOut) timeOut++; });
    risk.skipChose = skipChose; risk.skipTail = skipTail; risk.timeOut = timeOut;

    // ---- ৫. গতি, মনোযোগ, ক্লান্তি (সময় আছে এমন পরীক্ষা) ----
    // এক পাতায় সব প্রশ্ন থাকে, তাই দুই দাগের ফাঁক = এই প্রশ্নের সময়ের ওপরের সীমা (মাঝে বাদ দেওয়া প্রশ্ন পড়ার সময়ও আছে)।
    // তাই: "দ্রুত" মাপ (ফাঁক ছোট মানে সত্যিই দ্রুত) সব দাগে; মাঝারি গতি শুধু পরপর দুই প্রশ্নে (Fable)।
    var seqGaps = [], fastN = 0, fastWrong = 0, slowN = 0, slowWrong = 0, noread = 0, back = 0, moves = 0, rush = 0, rushWrong = 0;
    var tired = {exams: 0, h1: [0, 0], h2: [0, 0]}, away = {sec: 0, times: 0, exams: 0, timed: 0};
    exams.forEach(function (e) {
      if (e.timed && e.m) { away.timed++; away.sec += e.m.hid || 0; away.times += e.m.hn || 0; if ((e.m.hid || 0) > 30) away.exams++; }
      var done = e.rows.filter(function (r) { return !r.skip && (r.t != null || r.ms != null); });
      if (e.src === 'att') done.sort(function (x, y) { return x.t - y.t; });
      var used = e.sec || (done.length ? done[done.length - 1].t : 0);
      done.forEach(function (r, i) {
        var sec = r.ms != null ? r.ms / 1000 : i ? r.t - done[i - 1].t : null;
        if (sec == null) return;
        var seq = r.ms != null || r.pos === done[i - 1].pos + 1;
        if (seq) seqGaps.push(sec);
        if (e.src === 'att') { moves++; if (r.pos < done[i - 1].pos) back++; }
        if (r.ok !== null) {
          if (sec < 6) { fastN++; if (!r.ok) fastWrong++; } else { slowN++; if (!r.ok) slowWrong++; }
          if (sec < 2.5) noread++;
        }
        if (r.t != null && used > 120 && r.t >= used - 60) { rush++; if (r.ok === 0) rushWrong++; }
      });
      // ক্লান্তি: কঠিনতা বাদ দিয়ে (প্রত্যাশার চেয়ে কত) প্রথম আর শেষ অর্ধেক, শুধু ৪০+ দাগানো পরীক্ষায়
      var g = done.filter(function (r) { return r.ok !== null && diff[r.qid]; });
      if (g.length >= 40) {
        tired.exams++;
        g.forEach(function (r, i) { var h = i < g.length / 2 ? tired.h1 : tired.h2; h[0] += r.ok - diff[r.qid].p; h[1]++; });
      }
    });
    var pace = {timedExams: exams.filter(function (e) { return e.timed; }).length, median: median(seqGaps), seqN: seqGaps.length,
      fastPct: pct(fastN, fastN + slowN), fastWrong: pct(fastWrong, fastN), slowWrong: pct(slowWrong, slowN), fastN: fastN, noread: noread,
      backPct: pct(back, moves), rush: rush, rushWrong: pct(rushWrong, rush)};
    tired.drop = tired.exams >= 3 ? Math.round((tired.h1[0] / tired.h1[1] - tired.h2[0] / tired.h2[1]) * 100) : null;

    // ---- ৬. মনে রাখা: একই প্রশ্ন আবার ----
    var mem = {again: 0, learned: 0, forgot: 0, stuck: 0, kept: 0, same: []};
    Object.keys(seen).forEach(function (id) {
      var L = seen[id].filter(function (r) { return r.ok !== null; });
      if (L.length < 2) return;
      mem.again++;
      var a = L[0], b = L[L.length - 1];
      if (!a.ok && b.ok) mem.learned++; else if (a.ok && !b.ok) mem.forgot++; else if (!a.ok && !b.ok) mem.stuck++; else mem.kept++;
      // একই ভুল বিকল্প বারবার = ভুল ধারণা (ভুলে যাওয়া নয়)
      var wrongPicks = {};
      // অবস্থা-যাচাইয়ে বিকল্পের ক্রম এলোমেলো, তাই সেখানকার দাগ এখানে মেলানো যায় না
      L.forEach(function (r) { if (r.ok === 0 && !r.shuffled) wrongPicks[r.pick] = (wrongPicks[r.pick] || 0) + 1; });
      for (var p in wrongPicks) if (wrongPicks[p] >= 2) { var q = Q[id]; mem.same.push({qid: id, times: wrongPicks[p], topic: q && q[0] >= 0 ? T[q[0]][1] : ''}); break; }
    });

    // ---- ৭. লক্ষ্যের সঙ্গে মিল ----
    var totalMarks = 0, practiced = 0; for (var c in G.marks) totalMarks += G.marks[c];
    var codeRows = {}; subjects.forEach(function (o) { if (o.code) codeRows[o.code] = o; });
    for (var c2 in G.marks) practiced += codeRows[c2] ? codeRows[c2].n : 0;
    var outside = all.n - practiced;
    var fit = Object.keys(G.marks).map(function (c) {
      var o = codeRows[c] || {n: 0, graded: 0, ok: 0, acc: null, small: true}, name = (S.filter(function (x) { return x[0] === c; })[0] || [c, c])[1];
      var share = pct(o.n, practiced), want = Math.round(G.marks[c] / totalMarks * 100);
      // নম্বর বাড়ানোর সুযোগ = নম্বর × (০.৮০ − মান); অনিশ্চিত হলে মান ০.৫ ধরা (SUBJECT-PLAN §৩.২)
      var known = o.small || o.acc == null ? 0.5 : o.acc / 100;
      return {code: c, name: name, marks: G.marks[c], n: o.n, graded: o.graded, acc: o.acc, small: o.small, share: share || 0, want: want,
        gain: Math.round(G.marks[c] * Math.max(0, 0.8 - known) * 10) / 10};
    }).sort(function (a, b) { return b.gain - a.gain; });
    // মিলের সূচক: অনুশীলনের ভাগ আর নম্বরের ভাগ কতটা কাছাকাছি (১০০ = পুরো মিল)
    var dist = fit.reduce(function (s, x) { return s + Math.abs(x.share - x.want); }, 0);
    var match = practiced >= 50 ? Math.max(0, Math.round(100 - dist / 2)) : null;

    return {user: J.user, goal: goal in TARGETS ? goal : 'bcs', target: G, built: M.built,
      counts: {exams: exams.length, att: exams.filter(function (e) { return e.src === 'att'; }).length, diag: exams.filter(function (e) { return e.src === 'diag'; }).length,
        answers: A.length, unique: first.length, keyBad: keyBad, noTime: noTime, noMap: first.filter(function (r) { return r.subj < 0; }).length,
        withDiff: first.filter(function (r) { return diff[r.qid]; }).length,
        byType: exams.reduce(function (o, e) { o[e.c || '?'] = (o[e.c || '?'] || 0) + 1; return o; }, {})},
      all: all, trend: trend, steps: steps,
      habit: {days: dk.length, span: span, best: best, first: dk[0] || null, last: dk[dk.length - 1] || null, perDay: dk.length ? Math.round(exams.length / dk.length * 10) / 10 : null, hours: hours},
      subjects: subjects, weak: weak, strong: strong, risk: risk, avoid: avoid, easyWrong: easyWrong.length,
      pace: pace, tired: tired, away: away, mem: mem, fit: fit, match: match, outside: outside, exams: exams};
  }

  // Claude-কে দিয়ে লেখা পর্যালোচনার জন্য ছোট সারাংশ (নাম/ইমেইল নয়, শুধু সংখ্যা)
  function summary(R) {
    return {target: R.target.name, negPerWrong: R.target.neg, counts: R.counts, overall: R.all, trend: R.trend,
      habit: R.habit, subjects: R.subjects.map(function (s) { return {name: s.name, n: s.n, acc: s.acc, attempt: s.attempt, uncertain: s.small}; }),
      weakTopics: R.weak.map(function (t) { return {topic: t.name, subject: t.subj, ok: t.ok, graded: t.graded}; }),
      strongTopics: R.strong.map(function (t) { return {topic: t.name, ok: t.ok, graded: t.graded}; }),
      risk: R.risk, hardVsEasy: R.avoid, note: 'vsExp = percentage points above/below what all users score on the same questions (difficulty-adjusted); gaps are upper bounds on per-question time', easyWrong: R.easyWrong, pace: R.pace, fatigueDrop: R.tired.drop, away: R.away,
      memory: {again: R.mem.again, learned: R.mem.learned, forgot: R.mem.forgot, stuck: R.mem.stuck, sameWrongOption: R.mem.same.length},
      targetFit: {matchIndex: R.match, outsideSyllabusQuestions: R.outside, subjects: R.fit}};
  }

  var api = {build: build, summary: summary, TARGETS: TARGETS, MIN_N: MIN_N};
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LYReview = api;
})(this);
