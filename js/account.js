/* ঐচ্ছিক লগইন: পরীক্ষা দিতে লগইন লাগে না। প্রতিটি পরীক্ষার ফল এই ফোনে 'lb:att'-এ থাকে; লগইন করা থাকলে সার্ভারেও যায় (/api/att),
   তাই সব ফোনে একই ড্যাশবোর্ড (/account/)। ইন্টারনেট না থাকলে 'lb:q'-তে জমে থাকে, পরে যায়।
   পাতার finish() একবার ডাকে: window.LBA&&LBA.save({k,c,t,s,n,ok,no,sec,sb})
     k  = পুরোনো ইতিহাসের চাবি + '#' + তার ক্রম (যেমন 'sound-scores#3'), তাই পুরোনো ফল আমদানিতে একই পরীক্ষা দুবার আসে না
     c  = ধরন: ch অধ্যায় · jsci চাকরির বিজ্ঞান · bcs · job · run চলমান সিরিজ;  sb = {বিষয়: [সঠিক, মোট]}
   পাতায় একবার: <script src="/js/account.js" defer></script>। নাম না দিলে অধ্যায়ের নাম book-link.js-এর data-chapter থেকে নেয়।
   লগইনের খবর 'lb:u'-তে রাখা হয়, তাই সাধারণ পাতায় সার্ভারে কোনো অনুরোধ যায় না (শুধু ফল জমা দিতে)। */
(function(){
  var get=function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  var set=function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  var dev=get('lb:dev','');
  if(!dev){dev=Math.random().toString(36).slice(2,10);set('lb:dev',dev)}
  var user=function(){return get('lb:u',null)};

  var busy=false;
  function flush(){
    var q=get('lb:q',[]);
    if(busy||!q.length||!user()||!navigator.onLine)return Promise.resolve();
    busy=true;var part=q.slice(0,300);
    return fetch('/api/att',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:part})})
      .then(function(r){
        if(r.status===401){set('lb:u',null);return}
        if(!r.ok)return;
        var sent={};part.forEach(function(a){sent[a.k]=1});
        set('lb:q',get('lb:q',[]).filter(function(a){return !sent[a.k]}));
      })
      .catch(function(){}).then(function(){busy=false});
  }

  var css=false;
  function style(){
    if(css)return;css=true;
    var st=document.createElement('style');
    st.textContent='.lba-note{margin:12px auto 4px;max-width:560px;padding:10px 14px;border:1px dashed var(--rule,#d9d6cf);border-radius:12px;font-size:14.5px;line-height:1.6;text-align:center;color:var(--muted,#5f6366)}'+
      '.lba-note a{color:var(--navy,#13294b);font-weight:600;white-space:nowrap}'+
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .lba-note a{color:#e6c97a}}:root[data-theme="dark"] .lba-note a{color:#e6c97a}'+
      'nav.sec a.lba-me{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;margin-left:4px;border-radius:50%;background:rgba(230,201,122,.18);color:#e6c97a;text-decoration:none;overflow:hidden;padding:0;align-self:center}'+
      '.lba-me img{width:100%;height:100%;object-fit:cover}.lba-me svg{width:18px;height:18px}'+
      '@media(max-width:340px){nav.sec a.lba-me{display:none}}';
    document.head.appendChild(st);
  }

  // ফলের নিচে এক লাইন: লগইন না থাকলে কী পাবেন, থাকলে জমা হয়েছে
  function note(){
    var box=document.getElementById('scorebox');if(!box)return;
    style();
    var el=box.parentNode.querySelector('.lba-note');
    if(!el){el=document.createElement('p');el.className='lba-note';box.after(el)}
    el.innerHTML=user()
      ?'✓ ফলটি আপনার ড্যাশবোর্ডে জমা হলো। <a href="/account/">ড্যাশবোর্ড দেখুন →</a>'
      :'লগইন করলে প্রতিটি ফল, অধ্যায়ভিত্তিক অগ্রগতি আর দুর্বল জায়গা সব ফোনে জমা থাকবে। <a href="/account/">লগইন করুন →</a>';
  }

  function save(r){
    var a={k:dev+':'+r.k,ts:Date.now(),c:r.c||'ch',t:r.t||chapter()||document.title.split(/\s[·:]\s|:/)[0],p:location.pathname+location.hash,
      s:r.s,n:r.n,ok:r.ok,no:r.no,sec:r.sec};
    if(r.sb){var sb={};Object.keys(r.sb).forEach(function(k){if(k&&r.sb[k][1])sb[k]=r.sb[k]});if(Object.keys(sb).length)a.sb=sb}
    var all=get('lb:att',[]);all.push(a);set('lb:att',all.slice(-400));
    if(user()){var q=get('lb:q',[]);q.push(a);set('lb:q',q.slice(-1000));flush()}
    note();
  }
  function chapter(){var b=document.querySelector('script[src*="book-link.js"]');return b&&b.dataset.chapter}

  // উপরের নীল বারে ছোট একটা গোল: লগইন থাকলে নিজের ছবি
  function badge(){
    var nav=document.querySelector('.sitebar nav.sec, .bar nav.sec');if(!nav||document.querySelector('.lba-me'))return;
    style();
    var u=user(),a=document.createElement('a');a.className='lba-me';a.href='/account/';
    a.setAttribute('aria-label',u?'আমার ড্যাশবোর্ড':'লগইন ও আমার ড্যাশবোর্ড');a.title=a.getAttribute('aria-label');
    if(location.pathname==='/account/')a.setAttribute('aria-current','page');
    a.innerHTML=u&&u.pic?'<img src="'+u.pic.replace(/"/g,'')+'" alt="" referrerpolicy="no-referrer">'
      :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
    nav.appendChild(a);
  }

  window.LBA={save:save,user:user,dev:dev,flush:flush,get:get,set:set};
  function init(){badge();flush()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  addEventListener('online',flush);
})();
