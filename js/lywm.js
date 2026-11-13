/* লিয়ানা গোপন চিহ্ন: পাতার পটভূমির বিন্দু-নকশা থেকে নম্বর পড়া।
   নকশার নিয়ম (বসানোর দিকও এটাই মানবে):
   - প্রতি ৩ মিমি একটা ঘর; ১০x১০ ঘরের টাইল পুরো পাতায় বারবার।
   - সারি ০ আর কলাম ০ = মিলানোর ছাঁচ; বাকি ৮১ ঘরে ৩২-বিট নম্বর + ৮-বিট CRC, দুবার (PERM ক্রমে, MASK দিয়ে ঢাকা)।
   - বিন্দু: ব্যাসার্ধ ০.৫pt, ধূসর ০.৭৬।
   ব্যবহার: LYWM.decode(gray, w, h, {pageWidthPt, onProgress}) → Promise<{id, agree, pitch} | {id:null}>
   gray = Uint8 বা Float ধূসর (০ কালো, ২৫৫ সাদা)। পুরো পাতার ছবি হলে pageWidthPt দিলে এক চাপে হয়। */
(function (root) {
  var N = 10, PITCH = 3.0 / 25.4 * 72, DOT_R = 0.5, DOT_GRAY = 0.76;
  var SYNC_ROW = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0], SYNC_COL = [1, 0, 1, 1, 1, 0, 0, 1, 0, 0];
  var PERM = [71,75,66,57,76,60,15,47,11,48,73,33,9,13,45,69,0,7,32,8,74,63,36,55,80,41,2,79,70,30,6,51,1,61,28,72,68,42,14,43,23,46,62,59,77,31,29,24,64,35,20,18,52,34,5,3,21,16,58,12,39,17,54,4,44,27,56,65,78,19,38,26,25,37,10,22,49,50,53,40,67];
  var MASK = [1,1,0,0,0,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,0,0,1,0,1,1,0,0,1,1,0,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,0,0,1,1,1,0,1,0,0,0,1,1,1,1,0,1];
  var DATA_CELLS = [];
  for (var r = 1; r < N; r++) for (var c = 1; c < N; c++) DATA_CELLS.push([r, c]);

  var CRC_T = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc8(bits32) {           // zlib.crc32(৪ বাইট) & 0xFF — পাইথনের সঙ্গে মেলে
    var v = 0; for (var i = 0; i < 32; i++) v = v * 2 + bits32[i];
    var bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], c = 0xFFFFFFFF;
    for (var j = 0; j < 4; j++) c = CRC_T[(c ^ bytes[j]) & 255] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0) & 0xFF;
  }

  /* বসানোর দিকের টাইল (সার্ভার PDF-এ বিন্দু বসাতে এটা ব্যবহার করবে) */
  function tile(id) {
    var p = [], i; for (i = 31; i >= 0; i--) p.push(Math.floor(id / Math.pow(2, i)) % 2);
    var cr = crc8(p); for (i = 7; i >= 0; i--) p.push((cr >> i) & 1);
    var data = []; for (i = 0; i < 80; i++) data.push(p[i % 40] ^ MASK[i]); data.push(1);
    var t = []; for (var a = 0; a < N; a++) { t.push([]); for (var b = 0; b < N; b++) t[a].push(0); }
    for (i = 0; i < N; i++) { t[0][i] = SYNC_ROW[i]; t[i][0] = SYNC_COL[i]; }
    for (i = 0; i < PERM.length; i++) { var rc = DATA_CELLS[PERM[i]]; t[rc[0]][rc[1]] = data[i]; }
    return t;
  }

  function blur(src, w, h, s) {
    var rad = Math.ceil(s * 3), k = [], sum = 0, i, x, y;
    for (i = -rad; i <= rad; i++) { var v = Math.exp(-i * i / (2 * s * s)); k.push(v); sum += v; }
    for (i = 0; i < k.length; i++) k[i] /= sum;
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (y = 0; y < h; y++) { var o = y * w; for (x = 0; x < w; x++) { var a = 0; for (i = -rad; i <= rad; i++) { var xx = x + i; xx = xx < 0 ? -xx - 1 : xx >= w ? 2 * w - xx - 1 : xx; a += src[o + xx] * k[i + rad]; } tmp[o + x] = a; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var b = 0; for (i = -rad; i <= rad; i++) { var yy = y + i; yy = yy < 0 ? -yy - 1 : yy >= h ? 2 * h - yy - 1 : yy; b += tmp[yy * w + x] * k[i + rad]; } out[y * w + x] = b; }
    return out;
  }
  function median(arr, n) { var a = arr.subarray(0, n).slice().sort(); return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; }

  var respCache = {};
  function response(dark, w, h, P) {
    var dr = DOT_R / PITCH * P, s1 = Math.max(dr, 0.6), s2 = Math.max(3 * dr, 2);
    var key = s1.toFixed(1) + '/' + s2.toFixed(1);
    if (!respCache[key]) {
      var b1 = blur(dark, w, h, +s1.toFixed(1)), b2 = blur(dark, w, h, +s2.toFixed(1));
      for (var i = 0; i < b1.length; i++) b1[i] -= b2[i];
      respCache[key] = b1;
    }
    return respCache[key];
  }

  function analyze(resp, w, h, P, steps) {
    var best = null, buf = new Float32Array(Math.ceil(w / P / N + 1) * Math.ceil(h / P / N + 1) + 4);
    for (var sy = 0; sy < steps; sy++) for (var sx = 0; sx < steps; sx++) {
      var oy = sy * P / steps, ox = sx * P / steps;
      var ny = Math.floor((h - 1 - oy) / P) + 1, nx = Math.floor((w - 1 - ox) / P) + 1;
      if (ny < N || nx < N) return null;
      var S = new Float32Array(ny * nx), mean = 0, sq = 0, i, j;
      for (j = 0; j < ny; j++) { var yy = Math.round(oy + j * P); for (i = 0; i < nx; i++) { var v = resp[yy * w + Math.round(ox + i * P)]; S[j * nx + i] = v; mean += v; sq += v * v; } }
      var cnt = ny * nx; mean /= cnt; var sd = Math.sqrt(Math.max(sq / cnt - mean * mean, 0)) + 1e-9;
      var fold = new Float32Array(N * N);
      for (var a = 0; a < N; a++) for (var b = 0; b < N; b++) {
        var n = 0; for (j = a; j < ny; j += N) for (i = b; i < nx; i += N) buf[n++] = S[j * nx + i];
        fold[a * N + b] = median(buf, n);
      }
      var med = median(fold, N * N), score = 0;
      for (i = 0; i < N * N; i++) { fold[i] -= med; score += Math.abs(fold[i]); }
      score = score / (N * N) / sd;
      if (!best || score > best.score) best = { score: score, soft: fold };
    }
    return best;
  }

  function read(soft) {
    var best = -1e9, A = 0, B = 0, a, b, i;
    function at(s, r, c, a, b) { return s[((r + a) % N) * N + ((c + b) % N)]; }
    for (a = 0; a < N; a++) for (b = 0; b < N; b++) {
      var sc = 0; for (i = 0; i < N; i++) { sc += at(soft, 0, i, a, b) * (2 * SYNC_ROW[i] - 1) + at(soft, i, 0, a, b) * (2 * SYNC_COL[i] - 1); }
      if (sc > best) { best = sc; A = a; B = b; }
    }
    var v = [];
    for (i = 0; i < 80; i++) { var rc = DATA_CELLS[PERM[i]]; v.push(at(soft, rc[0], rc[1], A, B) * (1 - 2 * MASK[i])); }
    var bits = [], agree = 0;
    for (i = 0; i < 40; i++) { bits.push(v[i] + v[i + 40] > 0 ? 1 : 0); if ((v[i] > 0) === (v[i + 40] > 0)) agree++; }
    var id = 0; for (i = 0; i < 32; i++) id = id * 2 + bits[i];
    var cr = 0; for (i = 32; i < 40; i++) cr = cr * 2 + bits[i];
    return { id: id, ok: crc8(bits) === cr, agree: agree };
  }

  function decode(gray, w, h, opt) {
    opt = opt || {}; respCache = {};
    var dark = new Float32Array(w * h); for (var i = 0; i < w * h; i++) dark[i] = 255 - gray[i];
    var prog = opt.onProgress || function () {};
    return new Promise(function (resolve) {
      if (opt.pageWidthPt) {
        var P = w / opt.pageWidthPt * PITCH, r = analyze(response(dark, w, h, P), w, h, P, Math.max(4, Math.floor(P / 0.7)));
        if (r) { var x = read(r.soft); if (x.ok && x.agree >= 30) return resolve({ id: x.id, agree: x.agree, pitch: P }); }
        if (opt.only) return resolve({ id: null });
      }
      var cands = [], k; for (k = 0; k < 300; k++) cands.push(9 * Math.pow(30 / 9, k / 299));
      k = 0;
      (function step() {
        var t0 = Date.now();
        while (k < cands.length && Date.now() - t0 < 60) {
          var P = cands[k++], r = analyze(response(dark, w, h, P), w, h, P, 10);
          if (!r) continue;
          var x = read(r.soft);
          if (x.ok && x.agree >= 30) {           // সূক্ষ্ম করে নিশ্চিত
            var best = null;
            for (var j = 0; j < 7; j++) {
              var P2 = P * (0.985 + 0.005 * j), r2 = analyze(response(dark, w, h, P2), w, h, P2, Math.max(4, Math.floor(P2 / 0.7)));
              if (!r2) continue; var y = read(r2.soft);
              if (y.ok && (!best || y.agree > best.agree)) best = { id: y.id, agree: y.agree, pitch: P2 };
            }
            if (best && best.agree >= 30) return resolve(best);
          }
        }
        prog(k / cands.length);
        if (k < cands.length) setTimeout(step, 0); else resolve({ id: null });
      })();
    });
  }

  var api = { decode: decode, tile: tile, crc8: crc8, N: N, PITCH: PITCH, DOT_R: DOT_R, DOT_GRAY: DOT_GRAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LYWM = api;
})(this);
