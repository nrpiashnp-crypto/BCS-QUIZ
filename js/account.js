/* ঐচ্ছিক লগইন: পরীক্ষা দিতে লগইন লাগে না। প্রতিটি পরীক্ষার ফল এই ফোনে 'lb:att'-এ থাকে; লগইন করা থাকলে সার্ভারেও যায় (/api/att),
   তাই সব ফোনে একই ড্যাশবোর্ড (/account/)। ইন্টারনেট না থাকলে 'lb:q'-তে জমে থাকে, পরে যায়।
   পাতার finish() একবার ডাকে: window.LBA&&LBA.save({k,c,t,s,n,ok,no,sec,sb})
     k  = পুরোনো ইতিহাসের চাবি + '#' + তার ক্রম (যেমন 'sound-scores#3'), তাই পুরোনো ফল আমদানিতে একই পরীক্ষা দুবার আসে না
     c  = ধরন: ch অধ্যায় · jsci চাকরির বিজ্ঞান · bcs · job · run চলমান সিরিজ;  sb = {বিষয়: [সঠিক, মোট]}
     qa = LBA.qa(প্রশ্নের তালিকা, pick): উত্তর দেওয়া প্রতিটা প্রশ্নের [id, ঠিক 1/ভুল 0]; লগইন থাকলে 'lb:qa'-তে জমে /api/att-এর সঙ্গে যায়,
          সার্ভারে নাম ছাড়া প্রশ্ন ধরে গোনা হয় (কঠিনতা আর বেশি ভুল হওয়া প্রশ্ন বের করতে)
     qd = প্রতিটি প্রশ্ন [id, দাগানো বিকল্প (ফাঁকা −1)]; LBA.qa() ডাকলেই নিজে তৈরি হয়, তাই কোনো পাতা বদলাতে হয় না।
          ফলের সঙ্গে ফোনে থাকে (শেষ QD_KEEP টা ফলে) আর লগইন থাকলে সার্ভারে ব্যবহারকারীর নামে যায় (attq), কাস্টম প্ল্যানের জন্য।
          লগইন না করে দেওয়া পরীক্ষাও পরে লগইন করলে উত্তরসহ যায়।
     tm = qd-র ক্রমে প্রতিটি দাগের সময় (শুরুর পর দশমাংশ-সেকেন্ড, ১২৩ = ১২.৩ সে; ফাঁকায় ''), m = {v, hid: আড়ালে থাকা সেকেন্ড, hn: কতবার, w: পর্দা, app, tmx: সময় না মেলার কারণ};
          দুটোই নিচের "প্রতিটি উত্তরের সময়" অংশ নিজে বানায়, পাতাকে কিছু দিতে হয় না।
   পাতায় একবার: <script src="/js/account.js" defer></script>। নাম না দিলে অধ্যায়ের নাম book-link.js-এর data-chapter থেকে নেয়।
   লগইনের খবর 'lb:u'-তে রাখা হয়, তাই সাধারণ পাতায় সার্ভারে কোনো অনুরোধ যায় না (শুধু ফল জমা দিতে)। */
(function(){
  var get=function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  var set=function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  var dev=get('lb:dev','');
  if(!dev){dev=Math.random().toString(36).slice(2,10);set('lb:dev',dev)}
  var user=function(){return get('lb:u',null)};
  var QD_KEEP=150,lastQd=null,lastT=null;

  /* প্রতিটি উত্তরের সময় (শিক্ষার্থীর পর্যালোচনার জন্য, শুধু অ্যাডমিন দেখেন), পরীক্ষার পাতা না বদলে:
     কোনো বিকল্পে চাপ পড়লে পাতার নিজের হ্যান্ডলার আগে চলে আর বোতামে 'sel' বসায়; তারপর এখানে সেই মুহূর্ত লেখা হয়।
     পরীক্ষা শেষে qa() পাতার সব button.sel পাতার ক্রমে নেয়; সংখ্যা আর প্রতিটির বিকল্প-ক্রম pick-এর সঙ্গে মিললে তবেই সময় রাখা,
     নইলে সময় বাদ (ভুল সময়ের চেয়ে না-থাকা ভালো)। প্রথম চাপের পর থেকে পাতা কতক্ষণ আড়ালে ছিল (অন্য অ্যাপ/ট্যাব) আর কতবার, সেটাও।
     সার্ভারে যায় ফলের সঙ্গেই, একই সারিতে (attq.tm, attq.m), তাই বাড়তি লেখা নেই। */
  var taps=typeof WeakMap=='function'?new WeakMap():null,firstTap=0,lastTap=0,hid=0,hn=0,hidAt=0;
  if(taps){
    document.addEventListener('click',function(e){
      var b=e.target&&e.target.closest?e.target.closest('button'):null;
      if(!b||taps.has(b)||!b.classList.contains('sel'))return;
      var t=Date.now();taps.set(b,t);if(!firstTap)firstTap=t;lastTap=t;
    });
    document.addEventListener('visibilitychange',function(){
      if(!firstTap)return;
      if(document.hidden){if(!hidAt){hidAt=Date.now();hn++}}
      else if(hidAt){hid+=Date.now()-hidAt;hidAt=0}
    });
  }
  // সময় না মিললে কেন, সেটা m.tmx-এ থাকে (পরে দেখা যায় কোন পাতায় সময় হারাচ্ছে): none = কোনো চাপ ধরা পড়েনি, n = সংখ্যা মেলেনি, order = বিকল্প মেলেনি
  var tmx='';
  function times(pick){
    tmx='';
    if(!taps){tmx='old';return null}
    if(!firstTap){tmx='none';return null}
    var sel=document.querySelectorAll('button.sel'),idx=[],T=[];
    for(var i=0;i<pick.length;i++)if(pick[i]>=0)idx.push(i);
    if(!idx.length||sel.length!==idx.length){tmx='n';return null}
    for(var k=0;k<sel.length;k++){
      var b=sel[k],t=taps.get(b),pos=b.parentNode?Array.prototype.indexOf.call(b.parentNode.children,b):-1;
      if(!t||pos!==pick[idx[k]]){tmx='order';return null}
      T[idx[k]]=t;
    }
    return T;
  }
  function meta(){
    var away=hid+(hidAt?Date.now()-hidAt:0);
    var m={v:1,hid:Math.round(away/1000),hn:hn,w:window.innerWidth||0};
    if(tmx)m.tmx=tmx;
    try{if(matchMedia('(display-mode: standalone)').matches)m.app=1}catch(e){}
    return m;
  }
  function reset(){firstTap=0;lastTap=0;hid=0;hn=0;hidAt=0;tmx=''}

  var busy=false;
  function flush(){
    var q=get('lb:q',[]),qa=get('lb:qa',[]);
    if(busy||!(q.length||qa.length)||!user()||!navigator.onLine)return Promise.resolve();
    busy=true;var part=q.slice(0,300),qpart=qa.slice(0,600);
    return fetch('/api/att',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:part,q:qpart})})
      .then(function(r){
        if(r.status===401){set('lb:u',null);return}
        if(!r.ok)return;
        var sent={};part.forEach(function(a){sent[a.k]=1});
        set('lb:q',get('lb:q',[]).filter(function(a){return !sent[a.k]}));
        set('lb:qa',get('lb:qa',[]).slice(qpart.length));
      })
      .catch(function(){}).then(function(){busy=false});
  }

  var css=false;
  function style(){
    if(css)return;css=true;
    var st=document.createElement('style');
    st.textContent='.lba-note{margin:12px auto 4px;max-width:560px;padding:10px 14px;border:1px dashed var(--rule,#d9d6cf);border-radius:12px;font-size:14.5px;line-height:1.6;text-align:center;color:var(--muted,#5f6366)}'+
      '.lba-note a{color:var(--navy,#13294b);font-weight:600;white-space:nowrap}'+
      '.lba-card{display:flex;flex-direction:column;align-items:center;gap:8px;border-style:solid;border-color:#e6c97a;background:rgba(230,201,122,.10);padding:16px 16px 12px}'+
      '.lba-card b{font-size:17px;color:var(--ink,#1d1f21)}.lba-card small{font-size:13px}.lba-g{min-height:44px;display:grid;place-items:center}'+
      '.lba-x{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}'+
      'nav.sec a.lba-me{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;margin-left:4px;border-radius:50%;background:rgba(230,201,122,.18);color:#e6c97a;text-decoration:none;overflow:hidden;padding:0;align-self:center}'+
      '.lba-me img{width:100%;height:100%;object-fit:cover}.lba-me svg{width:18px;height:18px}'+
      '@media(max-width:340px){nav.sec a.lba-me{display:none}}';
    document.head.appendChild(st);
  }

  // ফলের নিচে: লগইন থাকলে এক লাইন "জমা হলো"; না থাকলে একটা কার্ড, সেখানেই Google বোতাম (পাতা ছেড়ে যেতে হয় না)।
  // সার্ভারে লগইন চালু না থাকলে (cid নেই) কিছুই দেখায় না, তাই অর্ধেক কাজ করা বোতাম কেউ দেখে না।
  var cidP=null;
  function cid(){
    if(!cidP)cidP=fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():{}})
      .then(function(j){if(j.user)set('lb:u',j.user);return j.cid||''}).catch(function(){return ''});
    return cidP;
  }
  function slot(){
    var box=document.getElementById('scorebox');if(!box)return null;
    style();
    var el=box.parentNode.querySelector('.lba-note');
    if(!el){el=document.createElement('div');el.className='lba-note';box.after(el)}
    return el;
  }
  function done(el){
    el.className='lba-note';
    el.innerHTML='✓ ফলটি আপনার রেজাল্ট কার্ডে জমা হলো। <a href="/account/">রেজাল্ট কার্ড দেখুন →</a>';
  }
  function note(){
    var el=slot();if(!el)return;
    if(user())return done(el);
    if(get('lb:nolog',0)>Date.now()){el.remove();return}
    el.hidden=true;
    cid().then(function(id){
      if(user()){el.hidden=false;return done(el)}
      if(!id){el.remove();return}
      el.className='lba-note lba-card';el.hidden=false;
      el.innerHTML='<b>আপনার অগ্রগতি সেভ করে রাখুন</b>'+
        '<span>Google দিয়ে একবার লগইন করলে এই ফলসহ সব পরীক্ষার হিসাব, অধ্যায়ভিত্তিক অগ্রগতি আর দুর্বল জায়গা জমা থাকবে। ফোন বদলালেও হারাবে না।</span>'+
        '<span class="lba-g"></span>'+
        '<small>লগইন ছাড়াও সব পরীক্ষা দেওয়া যাবে। পাসওয়ার্ড লাগে না। <button type="button" class="lba-x">এখন না</button></small>';
      el.querySelector('.lba-x').onclick=function(){set('lb:nolog',Date.now()+7*864e5);el.remove()};
      gis(id,el);
    });
  }
  function gis(id,el){
    var g=el.querySelector('.lba-g');
    var go=function(){
      google.accounts.id.initialize({client_id:id,ux_mode:'popup',context:'signin',callback:function(res){login(res,el)}});
      google.accounts.id.renderButton(g,{theme:'filled_blue',size:'large',shape:'pill',text:'continue_with',locale:'bn',width:260});
    };
    if(window.google&&google.accounts)return go();
    var s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=go;
    s.onerror=function(){g.innerHTML='<a href="/account/">লগইন করুন →</a>'};document.head.appendChild(s);
  }
  function login(res,el){
    var g=el.querySelector('.lba-g');g.textContent='লগইন হচ্ছে…';
    fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:res.credential})})
      .then(function(r){return r.json().then(function(j){if(!r.ok||!j.user)throw 0;return j})})
      .then(function(j){
        set('lb:u',j.user);
        // এই ফোনে 'lb:att'-এ যা আছে (এইমাত্র দেওয়া পরীক্ষাসহ) সব পাঠানো হয়; একই k সার্ভারে দুবার থাকে না
        var q=get('lb:q',[]),have={};q.forEach(function(a){have[a.k]=1});
        get('lb:att',[]).forEach(function(a){if(!have[a.k])q.push(a)});
        set('lb:q',q.slice(-1000));flush();done(el);
        var b=document.querySelector('.lba-me');if(b&&j.user.pic)b.innerHTML='<img src="'+j.user.pic.replace(/"/g,'')+'" alt="" referrerpolicy="no-referrer">';
      })
      .catch(function(){g.innerHTML='লগইন হয়নি। <a href="/account/">আবার চেষ্টা করুন →</a>'});
  }

  function save(r){
    var a={k:dev+':'+r.k,ts:Date.now(),c:r.c||'ch',t:r.t||chapter()||document.title.split(/\s[·:]\s|:/)[0],p:location.pathname+location.search+location.hash,
      s:r.s,n:r.n,ok:r.ok,no:r.no,sec:r.sec};
    var qd=r.qd||lastQd,T=lastT;lastQd=null;lastT=null;if(qd&&qd.length)a.qd=qd;
    // সময়: পরীক্ষা শুরুর পর কত দশমাংশ-সেকেন্ডে দাগ (শুরু = এখন − sec; sec না থাকলে প্রথম চাপ), qd-র ক্রমে, ফাঁকায় ''
    if(qd&&qd.length&&T&&!r.qd){
      var t0=T.reduce(function(x,y){return y&&y<x?y:x},a.ts),st=r.sec>0?Math.min(a.ts-r.sec*1000,t0):t0;
      a.tm=qd.map(function(x,i){return T[i]?Math.max(0,Math.round((T[i]-st)/100)):''}).join(',');
    }
    if(qd&&qd.length)a.m=meta();
    reset();
    if(r.sb){var sb={};Object.keys(r.sb).forEach(function(k){if(k&&r.sb[k][1])sb[k]=r.sb[k]});if(Object.keys(sb).length)a.sb=sb}
    var all=get('lb:att',[]);all.push(a);all=all.slice(-400);
    // পুরোনো ফলের উত্তর-তালিকা বাদ (ফোনের জায়গা), সার শুধু থাকে
    for(var i=0;i<all.length-QD_KEEP;i++)if(all[i].qd){delete all[i].qd;delete all[i].tm;delete all[i].m}
    set('lb:att',all);
    if(user()){var q=get('lb:q',[]);q.push(a);set('lb:q',q.slice(-1000));
      if(r.qa&&r.qa.length)set('lb:qa',get('lb:qa',[]).concat(r.qa).slice(-3000));flush()}
    note();
  }
  function qa(qs,pick){
    var T=times(pick||[]),keep=[];
    lastQd=(qs||[]).map(function(q,i){if(q&&q.id)keep.push(T?T[i]||0:0);return [q&&q.id||'',pick[i]>=0?pick[i]:-1]}).filter(function(x){return x[0]});
    lastT=T?keep:null;
    var o=[];(qs||[]).forEach(function(q,i){if(q&&q.id&&pick[i]>=0)o.push([q.id,pick[i]===q.a?1:0])});return o}
  function chapter(){var b=document.querySelector('script[src*="book-link.js"]');return b&&b.dataset.chapter}

  // উপরের নীল বারে ছোট একটা গোল: লগইন থাকলে নিজের ছবি
  function badge(){
    var nav=document.querySelector('.sitebar nav.sec, .bar nav.sec');if(!nav||document.querySelector('.lba-me'))return;
    style();
    var u=user(),a=document.createElement('a');a.className='lba-me';a.href='/account/';a.setAttribute('aria-label','আমার রেজাল্ট কার্ড');a.title='আমার রেজাল্ট কার্ড';
    a.setAttribute('aria-label',u?'আমার রেজাল্ট কার্ড':'লগইন ও রেজাল্ট কার্ড');a.title=a.getAttribute('aria-label');
    if(location.pathname==='/account/')a.setAttribute('aria-current','page');
    a.innerHTML=u&&u.pic?'<img src="'+u.pic.replace(/"/g,'')+'" alt="" referrerpolicy="no-referrer">'
      :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
    nav.appendChild(a);
  }

  window.LBA={save:save,qa:qa,user:user,dev:dev,flush:flush,get:get,set:set};
  function init(){badge();flush()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  addEventListener('online',flush);
  // প্রতিটি ব্যাখ্যার নিচে "প্রশ্নে ভুল আছে? জানান" (js/report.js); প্রশ্ন দেখানো সব পাতায় account.js আছে
  if(!window.LBR){var r=document.createElement('script');r.src='/js/report.js';r.defer=true;document.head.appendChild(r)}
})();
