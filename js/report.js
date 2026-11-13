/* প্রতিটি ব্যাখ্যার (.exp, হোমের আজকের প্রশ্নে .tqe) নিচে দুটো জিনিস, লগইন লাগে না:
   ১. "ব্যাখ্যাটা বুঝলেন? বুঝেছি / বুঝিনি" এক ট্যাপ। ট্যাপগুলো জমে, পাতা ছাড়ার সময় একবারে POST /api/fb (sendBeacon)।
      "বুঝিনি"-র পরে চাইলে এক লাইন লেখা → POST /api/report (kind hard, ব্যাখ্যার ছাপ h সহ; h = দাগের ev, নিচে expSig)। Fable-যাচাই 2026-11-02।
   ২. "প্রশ্নে বা উত্তরে ভুল? জানান": ছোট ফর্ম (কী ভুল + চাইলে দু-লাইন), পাঠায় POST /api/report।
   ৩. ছাত্রের কথায় বদলানো ব্যাখ্যা (data/ux.json, tools/build_qver.py বানায়): দেখানো ব্যাখ্যার ছাপ নতুন লেখার সঙ্গে মিললে
      ব্যাখ্যার নিচে "✎ ছাত্রের কথায় বদলানো, <মাস>"; এই ফোনে আগের লেখায় "বুঝিনি" দেওয়া থাকলে প্রশ্নটা "এবার বুঝলেন?"।
   (🎤 কথা বলে মতামত ২০২৬-১১-০৪-এ তুলে দেওয়া হয়েছে; ভালো সমাধান পেলে আবার ভাবা হবে।)
   প্রশ্ন চেনা: কাছের [data-id] থেকে প্রশ্নের id; না পেলে পাতার Q তালিকায় লেখা মিলিয়ে; তাও না পেলে প্রশ্নের লেখা।
   ৪. ঠিকানার শেষে #id=q… বা #t=… থাকলে সেই প্রশ্নে নিয়ে যায় (অ্যাডমিনের রিপোর্ট পাতার "প্রশ্নটা খুলুন" লিংক)।
   পাতায় একবার: <script src="/js/report.js" defer></script> (account.js নিজে থেকেই এটা লোড করে)। */
(function(){
  if(window.LBR)return;window.LBR=1;
  var K=[['ans','উত্তর ভুল'],['exp','ব্যাখ্যায় ভুল'],['q','প্রশ্ন বা অপশনে ভুল'],['other','অন্য কিছু']];
  var st=document.createElement('style');
  st.textContent='.rq{display:block;margin-top:10px;padding:7px 12px;border:1.3px solid #c8326a;border-radius:3px;background:#fffdf7;font:600 13.5px/1.45 "Noto Sans Bengali",sans-serif;color:#c8326a;cursor:pointer;text-align:left}'+
    '.rq small{display:block;font-weight:400;font-size:12.5px;color:#5f6366;margin-top:1px}'+
    '.rq:hover{background:#fdf1f5}'+
    '.rqf{margin-top:10px;padding:12px;border:1.3px solid #c8326a;border-radius:3px;background:#fffdf7;font:400 14.5px/1.5 "Noto Sans Bengali",sans-serif;color:#1d1f21}'+
    '.rqf p{margin:0 0 8px;font-weight:600;color:#13294b}'+
    '.rqf p .hl{display:block;margin-top:6px;padding:6px 9px;border-left:3px solid #c8326a;background:#fdf1f5;font-weight:600;font-size:14px;line-height:1.5;color:#c8326a}'+
    '.rqf .ks{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}'+
    '.rqf .ks button{font:inherit;font-size:13.5px;padding:5px 11px;border:1.3px solid #c8326a;border-radius:99px;background:#fff;color:#1d1f21;cursor:pointer}'+
    '.rqf .ks button[aria-pressed="true"]{background:#13294b!important;border-color:#13294b!important;color:#fff!important}'+
    '.rqf textarea{width:100%;box-sizing:border-box;min-height:58px;padding:8px;border:1.2px solid #c9c4b8;border-radius:3px;font:inherit;font-size:14px;resize:vertical;background:#fff;color:#1d1f21}'+
    '.rqf .ac{display:flex;gap:10px;align-items:center;margin-top:8px}'+
    '.rqf .go{font:600 14px/1 "Noto Sans Bengali",sans-serif;padding:9px 16px;border:0;border-radius:3px;background:#13294b;color:#fff;cursor:pointer}'+
    '.rqf .go:disabled{opacity:.5;cursor:default}'+
    '.rqf .x{font:inherit;font-size:13.5px;border:0;background:none;color:#5f6366;cursor:pointer;text-decoration:underline}'+
    '.rqd{margin-top:8px;font-size:13px;color:#1f8a4c}'+
    '.ud{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px dashed #c9c4b8;font:400 14px/1.45 "Noto Sans Bengali",sans-serif;color:#1d1f21}'+
    '.ud>span{margin-right:2px}'+
    '.ud button{font:600 14px/1 "Noto Sans Bengali",sans-serif;padding:8px 14px;min-height:36px;border:1.3px solid #13294b;border-radius:3px;background:#fff;color:#13294b;cursor:pointer}'+
    '.ud .ok{color:#1f8a4c;font-size:13.5px}'+
    '.uxl{margin-top:10px;font-size:12.5px;color:#1f6f5c}'+
    '.ud textarea{flex:1 1 100%;box-sizing:border-box;min-height:52px;padding:8px;border:1.2px solid #c9c4b8;border-radius:3px;font:inherit;font-size:14px;resize:vertical;background:#fff;color:#1d1f21}'+
    '.ud .go{background:#13294b;color:#fff}.ud .x{border:0;background:none;color:#5f6366;font-weight:400;text-decoration:underline;padding:8px 4px}';
  document.head.appendChild(st);

  function sent(){try{return JSON.parse(localStorage.getItem('lb:rep')||'{}')}catch(e){return {}}}
  function mark(k){try{var s=sent();s[k]=Date.now();var ks=Object.keys(s);if(ks.length>300)delete s[ks[0]];localStorage.setItem('lb:rep',JSON.stringify(s))}catch(e){}}
  function clean(t){return (t||'').replace(/\s+/g,' ').trim()}
  // প্রশ্নের লেখা: প্রশ্নের ঘরের লেখা, ব্যাখ্যা আর বোতাম বাদ দিয়ে
  function qText(box,exp){
    if(!box)return '';
    var t=box.querySelector('.qt,.qq,.tqq,h3,.q-t');
    // প্রশ্নের নম্বর (.n) আর উৎস-লেখা (.src, যেমন "২৮তম বিসিএস · বইয়ের অনুচ্ছেদ …") বাদ, শুধু প্রশ্নটা
    if(t){var tc=t.cloneNode(true);tc.querySelectorAll('.n,.src').forEach(function(n){n.remove()});return clean(tc.textContent).slice(0,400)}
    var c=box.cloneNode(true);c.querySelectorAll('.exp,.tqe,.rq,.rqf,.opts,button').forEach(function(n){n.remove()});
    return clean(c.textContent).slice(0,400);
  }
  function qId(box,text){
    var d=box&&box.closest('[data-id]');if(d&&d.dataset.id)return d.dataset.id;
    // অধ্যায় পাতাগুলোতে প্রশ্নের তালিকা Q নামে থাকে
    try{if(typeof Q!=='undefined'&&Q&&Q.length&&text){var n=clean(text).replace(/^[০-৯0-9]+[.।]\s*/,'');
      for(var i=0;i<Q.length;i++){var qq=clean(String(Q[i].q||'').replace(/<[^>]+>/g,''));if(qq&&(n.indexOf(qq.slice(0,60))===0||qq.indexOf(n.slice(0,60))===0))return Q[i].id||''}}}catch(e){}
    return '';
  }
  function open(btn){
    var exp=btn.parentNode,box=exp.closest('section.q,li.q,.q,.tq')||exp.parentNode;
    var text=qText(box,exp),id=qId(box,text),key=id||text.slice(0,80);
    if(sent()[key]){btn.outerHTML='<div class="rqd">✓ এই প্রশ্নের কথা আগেই জানিয়েছেন। ধন্যবাদ!</div>';return}
    var f=document.createElement('div');f.className='rqf';
    f.innerHTML='<p>কী মনে হলো এই প্রশ্নে?<span class="hl">আপনার দু-এক লাইনের উত্তরে আমাদের ব্যাখ্যা আরও ভালো হবে, আর তার সুফল পাবেন লাখ লাখ প্রার্থী।</span></p><div class="ks" role="group">'+K.map(function(k){return '<button type="button" data-k="'+k[0]+'" aria-pressed="false">'+k[1]+'</button>'}).join('')+
      '</div>'+
      '<textarea maxlength="600" placeholder="যেভাবে পারেন লিখুন: বাংলা, Banglish বা English। কোথায় আটকালেন, বা কী হলে ভালো হতো?"></textarea>'+
      '<div class="ac"><button type="button" class="go" disabled>পাঠান</button><button type="button" class="x">বাদ দিন</button></div>';
    btn.replaceWith(f);
    var kind='',go=f.querySelector('.go'),ta=f.querySelector('textarea');
    ta.oninput=function(){go.disabled=!kind&&!ta.value.trim()};
    f.querySelectorAll('.ks button').forEach(function(b){b.onclick=function(){
      f.querySelectorAll('.ks button').forEach(function(o){o.setAttribute('aria-pressed','false')});
      b.setAttribute('aria-pressed','true');kind=b.dataset.k;go.disabled=false;ta.focus()}});
    f.querySelector('.x').onclick=function(){f.replaceWith(make())};
    go.onclick=function(){
      go.disabled=true;go.textContent='পাঠানো হচ্ছে…';
      var body={qid:id,page:location.pathname+location.search+location.hash,q:text,kind:kind||'other',note:f.querySelector('textarea').value};
      fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)})
      .then(function(r){if(!r.ok)throw r.status;mark(key);
        f.outerHTML='<div class="rqd">✓ ধন্যবাদ! আপনার কথা পৌঁছেছে। যাচাই করে প্রশ্নটা ঠিক বা আরও সহজ করা হবে, যাতে পরের সবাই উপকার পায়।</div>'})
      .catch(function(s){go.disabled=false;go.textContent='পাঠান';
        var m=f.querySelector('.er')||f.appendChild(Object.assign(document.createElement('div'),{className:'er'}));
        m.style.cssText='margin-top:6px;font-size:13px;color:#b45309';
        m.textContent=s===429?'আজ অনেক জানানো হয়েছে, কাল আবার চেষ্টা করুন।':'পাঠানো গেল না, আবার চেষ্টা করুন।'});
    };
  }
  function make(){var b=document.createElement('button');b.type='button';b.className='rq';b.innerHTML='✎ প্রশ্নে বা উত্তরে ভুল পেলেন? জানান<small>আপনার দু-লাইনে লাখ লাখ প্রার্থীর পড়া ভালো হবে</small>';b.onclick=function(){open(b)};return b}

  // ---- বুঝেছি / বুঝিনি ----
  /* ব্যাখ্যার ছাপ h (মতামতের সারিতে যায়, রপ্তানিতে exp_shown_hash):
     ৮ অক্ষর = দাগের সংস্করণ-চিহ্নের ev-এর হুবহু হিসাব, FNV-1a(প্রশ্নের e, যেমন আছে) (js/account.js-এর qVer, functions/api, tools/build_qver.py);
       তাই "এই ব্যাখ্যা দেখে বুঝিনি" সরাসরি দাগের explanation_version আর বদলের খাতার সঙ্গে মেলে।
     ৯ অক্ষর ('0' + ৮) = প্রশ্নের e পাওয়া যায়নি, পাতায় দেখা লেখার ছাপ (আগের নিয়ম); শুধু একই প্রশ্নে ব্যাখ্যা বদলেছে কি না বোঝায়।
     প্রশ্নের e খোঁজা: ব্যাখ্যার ঘর বা তার ওপরের কোনো ঘরে .lbq (পাতা বসায়) → [data-id] ধরে window.LBQ[id] বা পাতার Q/paper/qs তালিকা
     → Q-তে প্রশ্নের লেখা মিলিয়ে। */
  function fnv(t){var h=0x811c9dc5;for(var i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return ('0000000'+h.toString(16)).slice(-8)}
  function lists(){var a=[];try{if(typeof Q!=='undefined'&&Q&&Q.length)a.push(Q)}catch(e){}try{if(typeof paper!=='undefined'&&paper&&paper.length&&typeof paper[0]==='object')a.push(paper)}catch(e){}
    try{if(typeof qs!=='undefined'&&qs&&qs.length&&typeof qs[0]==='object')a.push(qs)}catch(e){}return a}
  function qObj(el,id,text){
    for(var n=el;n&&n!==document;n=n.parentNode)if(n.lbq&&typeof n.lbq==='object')return n.lbq;
    if(id){try{if(window.LBQ&&window.LBQ[id])return window.LBQ[id]}catch(e){}
      var L=lists();for(var j=0;j<L.length;j++)for(var i=0;i<L[j].length;i++)if(L[j][i]&&L[j][i].id===id)return L[j][i]}
    try{if(text&&typeof Q!=='undefined'&&Q&&Q.length){var t=clean(text).replace(/^[০-৯0-9]+[.।]\s*/,'');
      for(var k=0;k<Q.length;k++){var qq=clean(String(Q[k].q||'').replace(/<[^>]+>/g,''));if(qq&&(t.indexOf(qq.slice(0,60))===0||qq.indexOf(t.slice(0,60))===0))return Q[k]}}}catch(e){}
    return null;
  }
  function expSig(el,id,text){var q=qObj(el,id,text);return q&&typeof q.e==='string'?fnv(q.e):'0'+fnv(expText(el))}
  function expText(el){var c=el.cloneNode(true);c.querySelectorAll('.ud,.rq,.rqf,.rqd,button').forEach(function(n){n.remove()});return clean(c.textContent)}
  function udSeen(){try{return JSON.parse(localStorage.getItem('lb:ud')||'{}')}catch(e){return {}}}
  function udMark(k,v){try{var s=udSeen();s[k]=v;var ks=Object.keys(s);if(ks.length>500)delete s[ks[0]];localStorage.setItem('lb:ud',JSON.stringify(s))}catch(e){}}
  // ছাত্রের কথায় বদলানো ব্যাখ্যার তালিকা: প্রথম ব্যাখ্যা খুললে একবার আনা (ছোট ফাইল, এক ঘণ্টা ক্যাশ)
  var UXP=null,MON=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  function uxMap(){return UXP||(UXP=fetch('/data/ux.json').then(function(r){return r.ok?r.json():{}}).then(function(j){return j&&j.q||{}},function(){return {}}))}
  function bnum(n){return String(n).replace(/[0-9]/g,function(c){return '০১২৩৪৫৬৭৮৯'[c]})}
  function uxMark(el,d,key,h){
    if(!/^[0-9a-f]{8}$/.test(h))return;
    uxMap().then(function(m){
      var row=(m[key]||[]).filter(function(r){return r[0]===h})[0];if(!row||!d.parentNode)return;
      var mm=String(row[2]||''),l=document.createElement('div');l.className='uxl';
      l.textContent='✎ ছাত্রের কথায় বদলানো'+(/^\d{4}-\d{2}$/.test(mm)?', '+MON[+mm.slice(5)-1]+' '+bnum(mm.slice(0,4)):'');
      el.insertBefore(l,d);
      // এই ফোনে এই প্রশ্নের আগের লেখায় "বুঝিনি" দেওয়া থাকলে
      var s=udSeen(),old=Object.keys(s).some(function(k){return k.indexOf(key+'|')===0&&k!==key+'|'+h&&s[k]===0});
      var q=d.querySelector(':scope>span');if(old&&q&&d.querySelector('button[data-v]'))q.textContent='আপনার "বুঝিনি"-র পরে নতুন করে লেখা। এবার বুঝলেন?';
    });
  }
  var TAPS={};   // পাতা ছাড়ার আগে পাঠানো বাকি: চাবি → [চাবি, ছাপ, ১/০, প্রশ্ন]
  function flush(){
    var a=Object.keys(TAPS).map(function(k){return TAPS[k]});if(!a.length)return;TAPS={};
    var body=JSON.stringify({page:location.pathname+location.search,taps:a});
    try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/fb',body))return}catch(e){}
    try{fetch('/api/fb',{method:'POST',body:body,keepalive:true,credentials:'same-origin'})}catch(e){}
  }
  addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush()});
  function ud(el){
    var box=el.closest('section.q,li.q,.q,.tq')||el.parentNode,text=qText(box,el),id=qId(box,text);
    var key=id||('t:'+text.slice(0,60)),h=expSig(el,id,text),mk=key+'|'+h,was=udSeen()[mk];
    var d=document.createElement('div');d.className='ud';
    function done(v){d.innerHTML='<span class="ok">'+(v?'✓ বুঝেছেন':'✓ জানিয়েছেন, ব্যাখ্যা আরও সহজ করা হবে। ধন্যবাদ!')+'</span>'}
    uxMark(el,d,key,h);
    if(was!=null){done(was);return d}
    d.innerHTML='<span>ব্যাখ্যাটা বুঝলেন?</span><button type="button" data-v="1">বুঝেছি</button><button type="button" data-v="0">বুঝিনি</button>';
    d.querySelectorAll('button').forEach(function(b){b.onclick=function(){
      var v=+b.dataset.v;TAPS[key]=[key,h,v,v?'':text.slice(0,160)];udMark(mk,v);
      if(v){done(1);return}
      d.innerHTML='<span>কোন জায়গাটা আটকাল? চাইলে এক লাইন লিখুন।</span><textarea maxlength="600" placeholder="যেমন: দ্বিতীয় লাইনের শব্দটা বুঝিনি / উদাহরণ চাই"></textarea><button type="button" class="go">পাঠান</button><button type="button" class="x">থাক</button>';
      var ta=d.querySelector('textarea');ta.focus();
      d.querySelector('.x').onclick=function(){done(0)};
      d.querySelector('.go').onclick=function(){
        var note=ta.value.trim();if(!note){done(0);return}
        var go=d.querySelector('.go');go.disabled=true;go.textContent='পাঠানো হচ্ছে…';
        fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
          body:JSON.stringify({qid:id,page:location.pathname+location.search+location.hash,q:text,kind:'hard',note:note,h:h})})
        .then(function(){done(0)},function(){done(0)});
      };
    }});
    return d;
  }
  function add(el){
    if(!el.classList||!(el.classList.contains('exp')||el.classList.contains('tqe')))return;
    if(el.querySelector(':scope>.rq,:scope>.rqf,:scope>.rqd'))return;
    if(el.classList.contains('tqe')&&el.hidden)return;
    if(!el.querySelector(':scope>.ud')&&expText(el).length>3)el.appendChild(ud(el));
    el.appendChild(make());
  }
  function scan(root){if(root.nodeType!==1)return;add(root);root.querySelectorAll&&root.querySelectorAll('.exp,.tqe').forEach(add)}
  new MutationObserver(function(ms){ms.forEach(function(m){
    if(m.type==='attributes'){add(m.target);return}
    m.addedNodes.forEach(scan);
    if(m.target.classList&&(m.target.classList.contains('exp')||m.target.classList.contains('tqe')))add(m.target);
  })}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(document.readyState!=='loading')scan(document.body);else document.addEventListener('DOMContentLoaded',function(){scan(document.body)});

  // ---- রিপোর্ট থেকে সরাসরি প্রশ্নে (অ্যাডমিনের /admin/reports/ পাতার লিংক) ----
  /* ঠিকানার শেষে #id=q… (প্রশ্নের id) বা #t=<প্রশ্নের লেখার শুরু> থাকলে প্রশ্নটা খুঁজে সেখানে নিয়ে যায়, গোলাপি দাগে চিহ্নিত করে।
     প্রশ্ন পরে আঁকা হলেও (কুইজ পাতা) ৮ সেকেন্ড পর্যন্ত খোঁজে। tools/build_qloc.py বলে দেয় কোন id কোন পাতায়। */
  (function(){
    var m=/^#(id|t)=(.+)$/.exec(location.hash);if(!m)return;
    var want=m[1]==='id'?m[2]:'',txt='';try{txt=m[1]==='t'?clean(decodeURIComponent(m[2])).slice(0,60):''}catch(e){}
    if(want&&!/^q[0-9a-f]{10}$/.test(want))return;if(!want&&txt.length<6)return;
    function find(){
      if(want)return document.querySelector('[data-id="'+want+'"]');
      var bs=document.querySelectorAll('section.q,li.q,.q,.tq');
      for(var i=0;i<bs.length;i++)if(qText(bs[i]).indexOf(txt)>=0||clean(bs[i].textContent).indexOf(txt)>=0)return bs[i];
      return null;
    }
    var n=0,iv=setInterval(function(){
      var el=find();if(!el&&++n<32)return;clearInterval(iv);
      if(!el){var w=document.createElement('div');w.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99;padding:10px 14px;border:1.3px solid #c8326a;border-radius:3px;background:#fffdf7;color:#1d1f21;font:400 14px/1.5 "Noto Sans Bengali",sans-serif';
        w.textContent='এই পাতায় রিপোর্টের প্রশ্নটা পাওয়া গেল না (প্রশ্নটা হয়তো সরানো বা বদলানো হয়েছে)।';document.body.appendChild(w);return}
      el.style.outline='3px solid #c8326a';el.style.outlineOffset='3px';el.style.scrollMarginTop='80px';
      var exp=el.querySelector('.exp,.tqe');if(exp&&exp.hidden)exp.hidden=false;
      el.scrollIntoView({block:'start'});
    },250);
  })();
})();
