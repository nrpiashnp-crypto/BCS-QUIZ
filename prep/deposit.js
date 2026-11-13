/* জামানত-ফেরতের নিয়ম (প্রিমিয়াম কাস্টম প্রস্তুতি), সিদ্ধান্ত ৯ নভেম্বর ২০২৬, LY Course।
   এক জায়গায় নিয়ম, যাতে কেনার পাতা, শর্তের পাতা আর ড্যাশবোর্ড একই সংখ্যা দেখায়।
   মোট পরীক্ষা আসে প্ল্যান থেকে: routine.json-এর "exams_total"; না থাকলে নম্বরসহ দিন (n আছে) গোনা।
   আসল হিসাব (কে কোন পরীক্ষা দিল, নম্বর, দ্রুত-শেষ বাদ, সমস্যার দিন বাদ) D1-এ, LY Sites করে;
   এখানে শুধু নিয়মের সংখ্যা আর লেখা। */
(function(){
  'use strict';
  var R = {
    deposit: 200,       // জামানত, টাকা
    refund: 190,        // ফেরত, টাকা
    fee: 10,            // বিকাশ/নগদে পাঠানোর খরচ
    attendPct: 80,      // মোট পরীক্ষার অন্তত এত % দিতে হবে
    passFrac: 1/3,      // মোট পরীক্ষার অন্তত এত ভাগে পাশ
    passPct: 20,        // পাশ = পূর্ণ নম্বরের ২০% বা বেশি, ভুলে −০.৫ কাটার পরে
    negative: 0.5
  };
  var D = '০১২৩৪৫৬৭৮৯';
  function bn(x){ return String(x).replace(/[0-9]/g, function(c){ return D[c]; }); }

  // মোট পরীক্ষা থেকে দুই শর্তের সংখ্যা। ৩০ → ২৪ আর ১০; ভগ্নাংশ হলে ওপরে।
  function need(total){
    total = Math.max(0, Math.floor(+total || 0));
    return {
      total: total,
      attend: Math.ceil(total * R.attendPct / 100 - 1e-9),
      pass: Math.ceil(total * R.passFrac - 1e-9)
    };
  }

  // প্ল্যান (routine.json) থেকে মোট পরীক্ষা
  function totalOf(plan){
    if (!plan) return 0;
    if (plan.exams_total) return +plan.exams_total;
    return (plan.days || []).filter(function(d){ return d && d.n; }).length;
  }

  // এক পরীক্ষায় পাশের ন্যূনতম নম্বর (পূর্ণ নম্বর ধরে); ৫০ → ১০
  function passMark(full){ return Math.ceil((+full || 0) * R.passPct / 100 - 1e-9); }

  /* ড্যাশবোর্ডের এক লাইন।
     done = গোনা হয় এমন দেওয়া পরীক্ষা, passed = তার মধ্যে ২০% বা বেশি,
     left = এখনো যে পরীক্ষাগুলো সামনে (না দিলে জানা নেই ধরে "পথ বন্ধ" দেখানো হয় না)। */
  function line(done, passed, total, left){
    var n = need(total), ok = done >= n.attend && passed >= n.pass;
    if (ok) return 'জামানত ফেরতের শর্ত পূরণ ✓ (' + bn(R.refund) + ' টাকা ফেরত পাবেন)';
    if (left != null && (done + left < n.attend || passed + left < n.pass))
      return 'এবার জামানত ফেরতের শর্ত আর পূরণ হবে না; পরীক্ষা চালিয়ে যান, প্রস্তুতি তো আপনারই।';
    return 'ফেরতের পথে: ' + bn(Math.min(done, n.attend)) + '/' + bn(n.attend) + ' পরীক্ষা, ' +
           bn(Math.min(passed, n.pass)) + '/' + bn(n.pass) + ' পাশ';
  }

  // কেনার পাতার ঘর (HTML); total = এই প্ল্যানের মোট পরীক্ষা
  function block(total, termsHref){
    var n = need(total);
    return '<div class="dep">' +
      '<b class="dep-h">' + bn(R.deposit) + ' টাকা জামানত, নিয়মিত পরীক্ষা দিলে ' + bn(R.refund) + ' টাকা ফেরত</b>' +
      '<p>এই কোর্সে মোট ' + bn(n.total) + 'টি পরীক্ষা।</p>' +
      '<ol>' +
        '<li>' + bn(n.total) + 'টি পরীক্ষার মধ্যে অন্তত ' + bn(n.attend) + 'টি পরীক্ষা দিতে হবে।</li>' +
        '<li>সেগুলোর মধ্যে অন্তত ' + bn(n.pass) + 'টিতে ' + bn(R.passPct) + '% (৫০-এ ১০) বা তার বেশি নম্বর পেতে হবে। প্রতিটি ভুলে −০.৫।</li>' +
      '</ol>' +
      '<p>প্রশ্ন বিসিএসের মানেরই থাকবে। শর্ত ইচ্ছা করে সহজ রাখা হয়েছে, কারণ আমরা চাই আপনি প্রতিদিন বসুন।</p>' +
      '<p class="dep-s">২০০ থেকে ১০ টাকা কাটা যাবে বিকাশ বা নগদে টাকা পাঠানোর খরচ হিসেবে। প্রতিটি পরীক্ষা শুধু নিজের দিনেই খোলা থাকে।' +
      (termsHref ? ' <a href="' + termsHref + '">পুরো শর্ত পড়ুন</a>' : '') + '</p>' +
    '</div>';
  }

  window.LYDeposit = { rule: R, need: need, totalOf: totalOf, passMark: passMark, line: line, block: block, bn: bn };

  // পাতায় <div data-deposit="30" data-terms="/prep/jamanat/"></div> থাকলে নিজে ভরে
  function fill(){
    var els = document.querySelectorAll('[data-deposit]');
    for (var i = 0; i < els.length; i++) els[i].innerHTML = block(els[i].getAttribute('data-deposit'), els[i].getAttribute('data-terms'));
    var t = document.querySelectorAll('[data-dep-n]');
    for (var j = 0; j < t.length; j++){
      var p = t[j].getAttribute('data-dep-n').split(':'), n = need(p[0]);
      t[j].textContent = bn(p[1] === 'attend' ? n.attend : p[1] === 'pass' ? n.pass : n.total);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
