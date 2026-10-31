/* প্রশ্নে ভুল জানান: প্রতিটি ব্যাখ্যার (.exp, হোমের আজকের প্রশ্নে .tqe) নিচে ছোট বোতাম।
   চাপলে ছোট ফর্ম (কী ভুল + চাইলে দু-লাইন), পাঠায় POST /api/report। লগইন লাগে না।
   প্রশ্ন চেনা: কাছের [data-id] থেকে প্রশ্নের id; না পেলে পাতার Q তালিকায় লেখা মিলিয়ে; তাও না পেলে প্রশ্নের লেখা।
   পাতায় একবার: <script src="/js/report.js" defer></script> (account.js নিজে থেকেই এটা লোড করে)। */
(function(){
  if(window.LBR)return;window.LBR=1;
  var K=[['ans','উত্তর ভুল'],['exp','ব্যাখ্যায় ভুল'],['q','প্রশ্ন বা অপশনে ভুল'],['other','অন্য কিছু']];
  var st=document.createElement('style');
  st.textContent='.rq{display:block;margin-top:8px;padding:0;border:0;background:none;font:400 12.5px/1.4 "Noto Sans Bengali",sans-serif;color:var(--muted,#5f6366);cursor:pointer;text-align:left;opacity:.9}'+
    '.rq:hover{color:#c8326a;text-decoration:underline}'+
    '.rqf{margin-top:10px;padding:12px;border:1.3px solid #c8326a;border-radius:3px;background:#fffdf7;font:400 14.5px/1.5 "Noto Sans Bengali",sans-serif;color:#1d1f21}'+
    '.rqf p{margin:0 0 8px;font-weight:600;color:#13294b}'+
    '.rqf .ks{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}'+
    '.rqf .ks button{font:inherit;font-size:13.5px;padding:5px 11px;border:1.3px solid #c8326a;border-radius:99px;background:#fff;color:#1d1f21;cursor:pointer}'+
    '.rqf .ks button[aria-pressed="true"]{background:#13294b!important;border-color:#13294b!important;color:#fff!important}'+
    '.rqf textarea{width:100%;box-sizing:border-box;min-height:58px;padding:8px;border:1.2px solid #c9c4b8;border-radius:3px;font:inherit;font-size:14px;resize:vertical;background:#fff;color:#1d1f21}'+
    '.rqf .ac{display:flex;gap:10px;align-items:center;margin-top:8px}'+
    '.rqf .go{font:600 14px/1 "Noto Sans Bengali",sans-serif;padding:9px 16px;border:0;border-radius:3px;background:#13294b;color:#fff;cursor:pointer}'+
    '.rqf .go:disabled{opacity:.5;cursor:default}'+
    '.rqf .x{font:inherit;font-size:13.5px;border:0;background:none;color:#5f6366;cursor:pointer;text-decoration:underline}'+
    '.rqd{margin-top:8px;font-size:13px;color:#1f8a4c}';
  document.head.appendChild(st);

  function sent(){try{return JSON.parse(localStorage.getItem('lb:rep')||'{}')}catch(e){return {}}}
  function mark(k){try{var s=sent();s[k]=Date.now();var ks=Object.keys(s);if(ks.length>300)delete s[ks[0]];localStorage.setItem('lb:rep',JSON.stringify(s))}catch(e){}}
  function clean(t){return (t||'').replace(/\s+/g,' ').trim()}
  // প্রশ্নের লেখা: প্রশ্নের ঘরের লেখা, ব্যাখ্যা আর বোতাম বাদ দিয়ে
  function qText(box,exp){
    if(!box)return '';
    var t=box.querySelector('.qt,.qq,.tqq,h3,.q-t');
    if(t)return clean(t.textContent).slice(0,400);
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
    f.innerHTML='<p>এই প্রশ্নে কী ভুল?</p><div class="ks" role="group">'+K.map(function(k){return '<button type="button" data-k="'+k[0]+'" aria-pressed="false">'+k[1]+'</button>'}).join('')+
      '</div><textarea maxlength="600" placeholder="চাইলে লিখুন: সঠিক উত্তর কী, বা কোথায় ভুল (ঐচ্ছিক)"></textarea>'+
      '<div class="ac"><button type="button" class="go" disabled>পাঠান</button><button type="button" class="x">বাদ দিন</button></div>';
    btn.replaceWith(f);
    var kind='',go=f.querySelector('.go');
    f.querySelectorAll('.ks button').forEach(function(b){b.onclick=function(){
      f.querySelectorAll('.ks button').forEach(function(o){o.setAttribute('aria-pressed','false')});
      b.setAttribute('aria-pressed','true');kind=b.dataset.k;go.disabled=false}});
    f.querySelector('.x').onclick=function(){f.replaceWith(make())};
    go.onclick=function(){
      go.disabled=true;go.textContent='পাঠানো হচ্ছে…';
      fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({qid:id,page:location.pathname+location.search,q:text,kind:kind,note:f.querySelector('textarea').value})})
      .then(function(r){if(!r.ok)throw r.status;mark(key);
        f.outerHTML='<div class="rqd">✓ ধন্যবাদ! আমরা যাচাই করে ঠিক করে দেব।</div>'})
      .catch(function(s){go.disabled=false;go.textContent='পাঠান';
        var m=f.querySelector('.er')||f.appendChild(Object.assign(document.createElement('div'),{className:'er'}));
        m.style.cssText='margin-top:6px;font-size:13px;color:#b45309';
        m.textContent=s===429?'আজ অনেক জানানো হয়েছে, কাল আবার চেষ্টা করুন।':'পাঠানো গেল না, আবার চেষ্টা করুন।'});
    };
  }
  function make(){var b=document.createElement('button');b.type='button';b.className='rq';b.textContent='⚑ প্রশ্নে ভুল আছে? জানান';b.onclick=function(){open(b)};return b}
  function add(el){
    if(!el.classList||!(el.classList.contains('exp')||el.classList.contains('tqe')))return;
    if(el.querySelector(':scope>.rq,:scope>.rqf,:scope>.rqd'))return;
    if(el.classList.contains('tqe')&&el.hidden)return;
    el.appendChild(make());
  }
  function scan(root){if(root.nodeType!==1)return;add(root);root.querySelectorAll&&root.querySelectorAll('.exp,.tqe').forEach(add)}
  new MutationObserver(function(ms){ms.forEach(function(m){
    if(m.type==='attributes'){add(m.target);return}
    m.addedNodes.forEach(scan);
    if(m.target.classList&&(m.target.classList.contains('exp')||m.target.classList.contains('tqe')))add(m.target);
  })}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(document.readyState!=='loading')scan(document.body);else document.addEventListener('DOMContentLoaded',function(){scan(document.body)});
})();
