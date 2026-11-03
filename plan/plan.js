/* নিজের পরিকল্পনা: অবস্থা-যাচাইয়ের পাতা (/plan/bcs/ ইত্যাদি)। সার্ভার /api/diag/* (functions-এর "নিজের পরিকল্পনা" অংশ)।
   পাতায় <main id="view" data-set="bcs-start" data-name="বিসিএস">। লগইন বাধ্যতামূলক। নকশা: Lyanna_data/pilot/custom-plan/PLAN.md §৯।
   - এক প্রশ্ন এক পর্দায়, অপশনে প্রথম চাপেই লক; "বাদ দিন" চাপলে শেষে আবার আসে (সময় থাকলে)।
   - উত্তর এই ফোনে জমে ('lb:diag:<সেট>:<ভাগ>'), ৫টা করে সার্ভারে যায়; সময় সার্ভারের।
   - ফল: ঠিক / ভুল / বাদ আলাদা, নেট নম্বর বা −০.৫ নয়। কার্ডের ছবি ফোনেই আঁকা (canvas), সার্ভারে কিছু যায় না। */
(function(){
const V=document.getElementById('view'),S=V.dataset.set,NAME=V.dataset.name||'';
const $=id=>document.getElementById(id);
const bn=x=>String(x).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]),K='কখগঘঙচ';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const del=k=>{try{localStorage.removeItem(k)}catch(e){}};
async function api(p,b){
  const r=await fetch('/api/diag/'+p,b?{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({s:S,...b})}:{credentials:'same-origin',cache:'no-store'});
  const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'err');e.j=j;e.s=r.status;throw e}return j}
const mins=m=>m>=60?bn(Math.floor(m/60))+' ঘণ্টা'+(m%60?' '+bn(m%60)+' মিনিট':''):bn(m)+' মিনিট';
let ME=null,EX=null,tick=null;
// পরীক্ষার নিয়ম: ভূমিকায় আর প্রতিটা ভাগ শুরুর আগে একই কথা
const RULES=`<ul class="rules">
  <li>শান্ত জায়গায় বসে, একটানা দিন। শুরু করলে ঘড়ি চলতেই থাকে, পাতা বন্ধ করলেও।</li>
  <li>অপশনে চাপলেই উত্তর লক হয়ে যায়, আর বদলানো যায় না। তাই ভেবে চাপুন।</li>
  <li>না জানলে আন্দাজে না দাগিয়ে "বাদ দিন" চাপুন। বাদ দেওয়া প্রশ্ন ভাগের শেষে আরেকবার আসবে।</li>
  <li>বই বা অন্য কারও সাহায্য নেবেন না। আপনি এখন কোথায় আছেন, সেটা জানাই উদ্দেশ্য। ঠিক মাপ এলেই পরিকল্পনা ঠিক হবে।</li>
  <li>শুরুর আগে নেট বা ডেটা আছে কি না দেখে নিন। ভাগের সব প্রশ্ন শুরুতেই ফোনে চলে আসে, তাই মাঝপথে নেট গেলেও পরীক্ষা চলবে। উত্তর ফোনে জমে, নেট এলে নিজে থেকেই জমা হয়। তবে ঘড়ি থামে না।</li>
</ul>`;
const SUB=id=>(((ME&&ME.subjects)||(EX&&EX.subs)||[]).find(s=>s.id===id)||{}).name||id;
const back='<button class="btn ghost" data-home>← সব ভাগ</button>';
const wire=()=>V.querySelectorAll('[data-home]').forEach(b=>b.onclick=home);

// ---------- শুরু ----------
async function home(){
  clearInterval(tick);$('timer').hidden=true;
  V.innerHTML='<p class="dim">লোড হচ্ছে…</p>';
  try{ME=await api('me?s='+encodeURIComponent(S))}catch(e){
    const go=offlineParts();
    V.innerHTML='<div class="card">নেট নেই বলে পাতাটা পুরো খোলা যায়নি। নেট এলে আবার খুলুন।</div>'+go.map(x=>`<div class="card ex"><div><b>ভাগ ${bn(x.part)} চলছে</b><small>প্রশ্ন ফোনে আছে, নেট ছাড়াই চালিয়ে যেতে পারেন</small></div><button class="btn" data-off="${x.part}">চালিয়ে যান</button></div>`).join('');
    V.querySelectorAll('[data-off]').forEach(b=>b.onclick=()=>part(+b.dataset.off));return}
  if(!ME.user)return intro(true);
  if(!ME.ready)return intro(false);
  // সময় শেষ হয়ে গেছে কিন্তু ফল গোনা হয়নি: জমে থাকা উত্তরসহ বন্ধ করা
  const closing=ME.parts.filter(p=>p.st==='closing');
  if(closing.length){for(const p of closing)await sendPart(p.no,true).catch(()=>{});return home()}
  dash();
}
function total(){const n=ME.parts.reduce((a,p)=>a+p.n,0),m=ME.parts.reduce((a,p)=>a+p.mins,0);return {n,m}}
function intro(login){
  const t=total();
  V.innerHTML=`<h1>${esc(NAME)} · নিজের পরিকল্পনা</h1>
  <p class="sub">আগে নিজের অবস্থা যাচাই, তারপর সেই অনুযায়ী বিষয় ধরে প্রস্তুতি।</p>
  <div class="card"><ol class="path">
    <li><b>অবস্থা-যাচাই:</b> ${ME.ready?bn(t.n)+'টি প্রশ্ন, '+bn(ME.parts.length)+' ভাগে, মোট প্রায় '+mins(t.m):'কয়েকটা ভাগে ভাগ করা পরীক্ষা'}। একেক ভাগ একেক দিনে দেওয়া যায়।</li>
    <li><b>প্রতিটা ভাগের শেষে</b> ছোট ফল।</li>
    <li><b>সব ভাগ শেষে</b> আপনার কার্ড: কোন বিষয়ে শক্ত, কোথায় এখন ফোকাস।</li>
    <li><b>বিষয়ভিত্তিক পরিকল্পনা:</b> যেখানে সবচেয়ে বেশি নম্বর বাড়ানো যায়, সেখান থেকে শুরু।</li>
  </ol>
  </div>
  <h2>কীভাবে দেবেন</h2>
  <div class="card">${RULES}</div>
  ${login?'<div class="card"><p style="margin:0 0 8px">ফল আর অগ্রগতি জমিয়ে রাখতে আগে Google দিয়ে লগইন করুন। পাসওয়ার্ড লাগে না।</p><div id="g"></div></div>':'<div class="card"><b>প্রশ্ন তোলা হচ্ছে।</b> শিগগির এখান থেকেই শুরু করা যাবে।</div>'}`;
  if(login)loginBtn();
}
function loginBtn(){
  fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json()).then(j=>{
    if(!j.cid){$('g').innerHTML='<a href="/account/">লগইন করুন →</a>';return}
    const go=()=>{google.accounts.id.initialize({client_id:j.cid,ux_mode:'popup',context:'signin',callback:res=>{
      $('g').textContent='লগইন হচ্ছে…';
      fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:res.credential})})
        .then(r=>r.json()).then(x=>{if(x.user)set('lb:u',x.user);home()}).catch(()=>{$('g').textContent='লগইন হয়নি, আবার চেষ্টা করুন।'})}});
      google.accounts.id.renderButton($('g'),{theme:'filled_blue',size:'large',shape:'pill',text:'continue_with',locale:'bn',width:260})};
    const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=go;
    s.onerror=()=>{$('g').innerHTML='<a href="/account/">লগইন করুন →</a>'};document.head.appendChild(s);
  }).catch(()=>{$('g').innerHTML='<a href="/account/">লগইন করুন →</a>'});
}

function dash(){
  const t=total(),left=ME.parts.filter(p=>p.st!=='done').reduce((a,p)=>a+p.n,0),done=ME.parts.filter(p=>p.st==='done').length;
  let h=`<h1>${esc(NAME)} · নিজের পরিকল্পনা</h1>`;
  const msgs=(ME.msgs||[]).filter(x=>!x.seen||Date.now()-x.seen<3*864e5);
  if(msgs.length)h+=msgs.map(x=>`<div class="card msg"><b>লিয়ানা বুকস থেকে আপনার জন্য</b><p>${esc(x.text).replace(/\n/g,'<br>')}</p></div>`).join('');
  const unseen=(ME.msgs||[]).filter(x=>!x.seen).map(x=>x.id);if(unseen.length)api('seen',{ids:unseen}).catch(()=>{});
  if(ME.all)h+=`<div class="card ex"><div><b>আপনার কার্ড তৈরি</b><small>কোন বিষয়ে শক্ত, কোথায় এখন ফোকাস, কোথা থেকে শুরু</small></div><button class="btn" id="st">দেখুন</button></div>`;
  else h+=`<div class="card"><b>অবস্থা-যাচাই:</b> ${bn(t.n)}-এর মধ্যে ${bn(left)}টি প্রশ্ন বাকি<div class="prog"><i style="width:${Math.round((t.n-left)/t.n*100)}%"></i></div><span class="dim">${bn(ME.parts.length)} ভাগের ${bn(done)}টি শেষ। একেক ভাগ একেক দিনে দেওয়া যায়।</span></div>`;
  h+='<h2>ভাগগুলো</h2>'+ME.parts.map(p=>{
    const sub=p.subjects.map(SUB).join(' + ');
    let right,info=`${bn(p.n)}টি প্রশ্ন · ${bn(p.mins)} মিনিট`;
    if(p.st==='todo')right=`<button class="btn" data-go="${p.no}">শুরু করুন</button>`;
    else if(p.st==='going'){right=`<button class="btn" data-go="${p.no}">চালিয়ে যান</button>`;info=`চলছে · ${bn(Math.max(0,Math.ceil(p.left/60000)))} মিনিট বাকি`}
    else{right=`<button class="btn ghost" data-rs="${p.no}">ফল</button>`;info=`${bn(p.res.ok)}টি ঠিক, ${bn(p.res.no)}টি ভুল, ${bn(p.res.skip)}টি বাদ`}
    return `<div class="card ex"><div><b>ভাগ ${bn(p.no)} · ${esc(sub)}</b><small>${info}</small></div>${right}</div>`}).join('');
  V.innerHTML=h;
  V.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const p=ME.parts.find(x=>x.no===+b.dataset.go);p.st==='going'?part(p.no):ready(p)});
  V.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>result((ME.parts.find(p=>p.no===+b.dataset.rs)||{}).res));
  if($('st'))$('st').onclick=()=>status(false);
  scrollTo(0,0);
}

// ---------- একটা ভাগ ----------
const LK=no=>'lb:diag:'+S+':'+no,XK=no=>'lb:diag:'+S+':'+no+':ex';
// শুরু করা ভাগের প্রশ্ন (উত্তর ছাড়া) আর শেষ সময় ফোনে থাকে, যাতে নেট গেলে বা পাতা আবার খুললেও চলে
function offlineParts(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('lb:diag:'+S+':')&&k.endsWith(':ex')){const x=get(k,null);if(x&&x.end>Date.now())out.push(x)}}}catch(e){}return out}
let hidAt=0;
function local(no){return get(LK(no),{a:{},sent:[],hid:0,hn:0,skip:[]})}
// জমে থাকা উত্তর সার্ভারে; fin হলে ভাগ বন্ধ আর ফল ফেরত
async function sendPart(no,fin){
  const L=local(no),sent=new Set(L.sent),list=Object.entries(L.a).filter(([id])=>!sent.has(id)).map(([id,x])=>[id,x[0],x[1]]);
  if(!list.length&&!fin)return null;
  const r=await api('save',{part:no,ans:list,hid:Math.round(L.hid),hn:L.hn,fin:!!fin});
  const L2=local(no);L2.sent=[...new Set([...L2.sent,...list.map(x=>x[0])])];set(LK(no),L2);
  if(r.res){del(LK(no));del(XK(no))}
  return r;
}
addEventListener('offline',()=>{const n=$('net');if(n)n.textContent='নেট নেই। পরীক্ষা চলছে, উত্তর ফোনে জমছে।'});
addEventListener('online',()=>{const n=$('net');if(n)n.textContent='';if(EX)sendPart(EX.part,false).catch(()=>{})});
document.addEventListener('visibilitychange',()=>{
  if(!EX)return;const L=local(EX.part);
  if(document.hidden){hidAt=Date.now();L.hn++;set(LK(EX.part),L);sendPart(EX.part,false).catch(()=>{})}
  else if(hidAt){L.hid+=(Date.now()-hidAt)/1000;hidAt=0;set(LK(EX.part),L)}
});
function ready(p){
  V.innerHTML=`${back}<h1 style="margin-top:12px">ভাগ ${bn(p.no)} · ${esc(p.subjects.map(SUB).join(' + '))}</h1>
    <p class="sub">${bn(p.n)}টি প্রশ্ন, সময় ${bn(p.mins)} মিনিট।</p><div class="card">${RULES}</div>
    <button class="btn big" id="go">শুরু করুন</button>`;
  wire();$('go').onclick=()=>part(p.no);scrollTo(0,0);
}
async function part(no){
  V.innerHTML='<p class="dim">প্রশ্ন আসছে…</p>';
  let app=0;try{app=localStorage.getItem('lb:inapp')?1:0}catch(e){}
  try{EX=await api('start',{part:no,w:innerWidth,app});EX.end=Date.now()+EX.left;set(XK(no),{part:EX.part,title:EX.title,mins:EX.mins,qs:EX.qs,end:EX.end,done:[],subs:ME?ME.subjects:[]})}catch(e){
    const off=get(XK(no),null);
    if(!e.s&&off&&off.end>Date.now()){EX=off}else{if(e.message==='done')del(XK(no));V.innerHTML=`<div class="card">${e.message==='done'?'এই ভাগ আগেই শেষ হয়েছে।':'খোলা যায়নি। নেট দেখে আবার চেষ্টা করুন।'}</div>${back}`;wire();return}}
  const L=local(no);for(const [id,p] of EX.done){if(!L.a[id])L.a[id]=[p,0];if(!L.sent.includes(id))L.sent.push(id)}set(LK(no),L);
  // প্রথমে যেগুলো একবারও দেখানো হয়নি, তারপর বাদ দেওয়াগুলো (একবার)
  EX.queue=EX.qs.filter(q=>!L.a[q.id]&&!L.skip.includes(q.id)).map(q=>q.id).concat(L.skip.filter(id=>!L.a[id]));
  if(!EX.queue.length)return finish();
  timer();show();
}
function timer(){
  const t=$('timer');t.hidden=false;clearInterval(tick);
  const f=()=>{const s=Math.max(0,Math.round((EX.end-Date.now())/1000));t.textContent='সময় '+bn(String(Math.floor(s/60)).padStart(2,'0'))+':'+bn(String(s%60).padStart(2,'0'));
    t.classList.toggle('last',s<=60);if(!s){clearInterval(tick);finish()}};
  f();tick=setInterval(f,1000);
}
function show(){
  const L=local(EX.part),id=EX.queue[0],q=EX.qs.find(x=>x.id===id),answered=Object.values(L.a).filter(x=>x[0]>=0).length;
  const again=L.skip.includes(id);let t0=Date.now(),busy=false;
  V.innerHTML=`<div class="qh"><span>ভাগ ${bn(EX.part)} · ${esc(SUB(q.s))}</span><span>${bn(answered)} / ${bn(EX.qs.length)} উত্তর</span></div>
    ${again?'<p class="tag">আগে বাদ দিয়েছিলেন</p>':''}<div class="qt">${esc(q.q)}</div>
    ${q.o.map((o,k)=>`<button class="opt" data-o="${k}"><span class="k">${K[k]}</span><span>${esc(o)}</span></button>`).join('')}
    <p class="net" id="net">${navigator.onLine?'':'নেট নেই। পরীক্ষা চলছে, উত্তর ফোনে জমছে।'}</p>
    <div class="skip"><button class="btn ghost" id="sk">${again?'জানি না, ছেড়ে দিন':'বাদ দিন, পরে দেখব'}</button></div>`;
  const go=pick=>{
    if(busy)return;busy=true;
    const L=local(EX.part);
    if(pick<0&&!again){L.skip.push(id)}else L.a[id]=[pick,Date.now()-t0];
    set(LK(EX.part),L);EX.queue.shift();
    V.querySelectorAll('button').forEach(b=>b.disabled=true);
    if(Object.keys(L.a).length-L.sent.length>=5)sendPart(EX.part,false).catch(()=>{});
    setTimeout(()=>{EX.queue.length?show():finish()},pick>=0?300:120);
  };
  V.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{b.classList.add('sel');go(+b.dataset.o)});
  $('sk').onclick=()=>go(-1);
  scrollTo(0,0);
}
async function finish(){
  clearInterval(tick);$('timer').hidden=true;
  const no=EX.part,L=local(no);
  // একবারও দাগানো হয়নি এমন প্রশ্ন "বাদ" হিসেবে যায়
  for(const q of EX.qs)if(!L.a[q.id])L.a[q.id]=[-1,0];
  set(LK(no),L);
  V.innerHTML='<p class="dim">ফল গোনা হচ্ছে…</p>';
  let r=null;
  for(let i=0;i<4&&!r;i++){try{r=await sendPart(no,true)}catch(e){await new Promise(z=>setTimeout(z,2500))}}
  EX=null;
  if(!r||!r.res){V.innerHTML=`<div class="card"><b>আপনার সব উত্তর এই ফোনে রাখা আছে।</b><br>নেট এলে এক ঘণ্টার মধ্যে এই পাতা আবার খুলুন, নিজে থেকেই জমা হবে আর ফল দেখাবে।</div><button class="btn" id="rt">আবার চেষ্টা করুন</button>`;
    $('rt').onclick=async()=>{$('rt').disabled=true;const r2=await sendPart(no,true).catch(()=>null);if(r2&&r2.res){ME=await api('me?s='+encodeURIComponent(S)).catch(()=>ME);result(r2.res)}else $('rt').disabled=false};return}
  ME=await api('me?s='+encodeURIComponent(S)).catch(()=>ME);
  result(r.res);
}

// ---------- ফল ----------
// PLAN.md §৫: লজ্জা নয়; নম্বর সত্যি, সঙ্গে পরের এক ধাপ
const LINE={strong:'এই বিষয়ে আপনি শক্ত অবস্থানে। এখানে কম সময় দিয়ে অন্য বিষয়ে বেশি দিন।',
  mid:'ভিত্তি আছে। কয়েকটা টপিক গোছালেই এই বিষয়ে নম্বর উঠবে।',
  focus:'এই বিষয়েই সবচেয়ে বেশি নম্বর বাড়ানোর সুযোগ। আপনার পরিকল্পনা এখান থেকেই শুরু হবে।'};
const band=x=>{if(!x.n)return null;const p=x.ok/x.n*100;return p<40?'focus':p<70?'mid':'strong'};
function result(res){
  if(!res)return home();
  const left=ME.parts.filter(p=>p.st!=='done'&&p.no!==res.part).length;
  if(!left&&ME.status)return status(true);
  let h=`${back}<h1 style="margin-top:12px">ভাগ ${bn(res.part)}-এর ফল</h1>`;
  h+=Object.entries(res.by).map(([sid,x])=>{const b=band(x);
    return `<div class="card"><b>${esc(SUB(sid))}</b>: ${bn(x.n)}টির মধ্যে ${bn(x.ok)}টি ঠিক<div class="sub" style="margin:2px 0 0">${bn(x.no)}টি ভুল, ${bn(x.skip)}টি বাদ</div>${b&&LINE[b]?`<p style="margin:6px 0 0">${LINE[b]}</p>`:''}</div>`}).join('');
  h+=left?`<div class="card ex"><div><b>আরও ${bn(left)} ভাগ বাকি</b><small>সব শেষ হলেই আপনার কার্ড</small></div><button class="btn" data-home>পরের ভাগ</button></div>`
    :`<div class="card ex"><div><b>সব ভাগ শেষ!</b><small>আপনার কার্ড তৈরি</small></div><button class="btn" id="st">দেখুন</button></div>`;
  h+=`<details id="rv"><summary>ভুলগুলো দেখুন (ব্যাখ্যাসহ)</summary><div id="rvb"><p class="dim">লোড হচ্ছে…</p></div></details>`;
  V.innerHTML=h;wire();
  if($('st'))$('st').onclick=()=>status(false);
  $('rv').addEventListener('toggle',()=>{if($('rv').open&&!$('rv').dataset.ok)review(res.part)});
  scrollTo(0,0);
}
async function review(no){
  let r;try{r=await api('review?s='+encodeURIComponent(S)+'&part='+no)}catch(e){$('rvb').innerHTML='<p class="dim">খোলা যায়নি।</p>';return}
  $('rv').dataset.ok=1;
  const wrong=r.qs.filter(q=>q.pick!==q.a),ok=r.qs.filter(q=>q.pick===q.a);
  const card=q=>`<div class="card rv"><div class="qh"><span>${esc(SUB(q.s))}</span><span>${q.pick<0?'বাদ':q.pick===q.a?'ঠিক':'ভুল'}</span></div><div class="qt">${esc(q.q)}</div>${q.o.map((o,k)=>`<div class="opt${k===q.a?' right':k===q.pick?' wrong':''}"><span class="k">${K[k]}</span><span>${esc(o)}</span></div>`).join('')}${q.e?`<div class="exp">${esc(q.e)}</div>`:''}</div>`;
  $('rvb').innerHTML=(wrong.length?wrong.map(card).join(''):'<p>এই ভাগে কোনো ভুল নেই।</p>')+(ok.length?`<details><summary>ঠিকগুলোও দেখুন (${bn(ok.length)})</summary>${ok.map(card).join('')}</details>`:'');
  if(window.LBMath)try{LBMath(V)}catch(e){}
}

// ---------- সব ভাগ শেষে: বিষয়ের চিত্র আর পরিকল্পনা ----------
const BL={strong:'শক্ত',mid:'মাঝামাঝি',focus:'এখন ফোকাস'};
const first=()=>((ME.user&&ME.user.name)||'').trim().split(/\s+/)[0]||'';
function status(fresh){
  const st=ME.status;if(!st)return home();
  const subs=st.subjects.filter(x=>x.band),strong=subs.filter(x=>x.band==='strong'),plan=st.order.map(id=>st.subjects.find(x=>x.id===id));
  const nm=first(),tot=bn(ME.parts.reduce((a,p)=>a+p.n,0));
  let h=fresh?'':back;
  // শুভকামনা: শেষ করাটাই প্রথম বড় ধাপ; সামনে পথ আর পাশে থাকা
  h+=`<div class="hello"><h1>অভিনন্দন${nm?', '+esc(nm):''}!</h1>
    <p>${tot}টি প্রশ্নের পুরো অবস্থা-যাচাই আপনি শেষ করেছেন। অনেকে শুরু করেও শেষ করেন না, আপনি করেছেন। প্রস্তুতির প্রথম বড় ধাপ এটাই।</p>
    <p>এখন আপনি জানেন কোথায় আপনি শক্ত, আর কোথা থেকে শুরু করলে সবচেয়ে বেশি নম্বর বাড়বে। পথটা লম্বা, তবে একা হাঁটতে হবে না। প্রতিদিনের অনুশীলনে লিয়ানা বুকস আপনার পাশে আছে।</p>
    <p class="sig">শুভকামনা রইল।</p></div>`;
  h+=`<div class="card"><div id="cimg"><p class="dim">আপনার কার্ড তৈরি হচ্ছে…</p></div></div>`;
  h+=`<h2>বিষয় ধরে আপনার অবস্থা</h2><div class="card"><table><thead><tr><th>বিষয়</th><th>ঠিক</th><th>অবস্থা</th></tr></thead><tbody>`+subs.map(x=>
    `<tr><td>${esc(x.name)}</td><td>${bn(x.n)}-এ ${bn(x.ok)}</td><td class="bd-${x.band}">${BL[x.band]}${x.edge?'<small> · সীমানায়</small>':''}</td></tr>`).join('')+'</tbody></table>';
  if(subs.some(x=>x.small))h+='<p class="sub" style="margin:8px 0 0">২০টির কম প্রশ্নের বিষয়ে ফল ছোট পরীক্ষার, তাই শুধু ধারণা।</p>';
  h+='</div>';
  h+=`<h2>আপনার পরিকল্পনা: এই ক্রমে</h2><p class="sub">যে বিষয়ে সিলেবাসের নম্বর বেশি আর এখনো বেশি বাকি, সেটা আগে।</p><div class="card"><ol class="plan">`+
    plan.map(x=>`<li>${x.link?`<a href="${esc(x.link)}">${esc(x.name)}</a>`:esc(x.name)} <span class="dim">· সিলেবাসে ${bn(x.marks)} নম্বর</span></li>`).join('')+
    '</ol><p class="sub" style="margin:8px 0 0">বিষয়ে চাপলে সেই বিষয়ের প্রশ্ন আর পরীক্ষা। প্রতিদিনের অনুশীলন আর অগ্রগতি শিগগির এখানেই যোগ হবে।</p></div>';
  if(fresh)h+=`<p><button class="btn ghost" data-home>সব ভাগ দেখুন</button></p>`;
  V.innerHTML=h;wire();scrollTo(0,0);
  photo(st,strong,plan,nm);
}

// কার্ডের ছবি ১০৮০×১৩৫০। আপেক্ষিক, পরম নয়: মোট নম্বর, শতাংশ, র‍্যাঙ্ক, "দুর্বল" শব্দ নেই
async function photo(st,strong,plan,nm){
  try{await Promise.all(['600 60px "Tiro Bangla"','400 34px "Noto Sans Bengali"','600 34px "Noto Sans Bengali"'].map(f=>document.fonts.load(f,'অআকখ')))}catch(e){}
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const NAVY='#13294b',PINK='#c8326a',PAPER='#f8f5ee',INK='#1d1f21',MUTED='#5d5a55',GOLD='#e0b45c';
  g.fillStyle=PAPER;g.fillRect(0,0,W,H);
  g.fillStyle=NAVY;g.fillRect(0,0,W,210);
  g.fillStyle='#fff';g.font='600 58px "Tiro Bangla"';g.fillText(NAME+' অবস্থা-যাচাই',70,110);
  const d=new Date(Date.now()+6*36e5),MON=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  g.fillStyle=GOLD;g.font='400 32px "Noto Sans Bengali"';
  nm=(nm||'').slice(0,24);
  g.fillText((nm?nm+' · ':'')+bn(ME.parts.reduce((a,p)=>a+p.n,0))+' প্রশ্ন · '+bn(st.parts)+' ভাগ শেষ · '+bn(d.getUTCDate())+' '+MON[d.getUTCMonth()],70,168);
  const line=(label,txt,col,size)=>{g.fillStyle=col;g.font='600 '+size+'px "Noto Sans Bengali"';g.fillText(label,70,y);g.fillStyle=INK;g.font='400 '+size+'px "Noto Sans Bengali"';
    wrap(txt,70+g.measureText(label+' ').width+8,size);};
  const wrap=(t,x0,size)=>{let x=x0;for(const w of t.split(' ')){const ww=g.measureText(w+' ').width;if(x+ww>W-70){y+=size*1.5;x=70}g.fillText(w,x,y);x+=ww}y+=size*1.95};
  const focus=plan.slice(0,2).map(x=>x.name).join(', '),subs=st.subjects.filter(x=>x.band);
  let y;
  if(strong.length||subs.some(x=>x.band==='mid')){
    // বিষয়ের বার: তিন রং, সংখ্যা ছাড়া
    const COL={strong:'#1e7a46',mid:'#c48a1c',focus:PINK},LEN={strong:1,mid:.66,focus:.36};
    y=290;const bw=560,bx=430;
    g.font='400 34px "Noto Sans Bengali"';
    for(const x of subs){g.fillStyle=INK;g.fillText(x.name,70,y+30);g.fillStyle='#ece5d8';g.fillRect(bx,y,bw,36);g.fillStyle=COL[x.band];g.fillRect(bx,y,Math.round(bw*LEN[x.band]),36);y+=72}
    y+=30;
    if(strong.length)line('শক্ত:',strong.slice(0,3).map(x=>x.name).join(', '),'#1e7a46',34);
    line('এখন ফোকাস:',focus,PINK,34);
  }else{
    // কোনো বিষয় এখনো শক্ত বা মাঝামাঝি নয়: বার নয়, শুধু শুরু আর সংকল্প (লজ্জা নয়)
    y=420;g.fillStyle=NAVY;g.font='600 64px "Tiro Bangla"';g.fillText('প্রস্তুতি শুরু হলো',70,y);y+=120;
    line('এখন ফোকাস:',focus,PINK,44);
    g.fillStyle=MUTED;g.font='400 38px "Noto Sans Bengali"';wrap('প্রতিদিন একটু করে, এই দুই বিষয় দিয়ে শুরু। নিজের পরিকল্পনা তৈরি।',70,38);
  }
  g.fillStyle=PINK;g.fillRect(70,H-150,W-140,3);
  g.fillStyle=NAVY;g.font='600 40px "Noto Sans Bengali"';g.fillText('আমার পরিকল্পনা শুরু',70,H-80);
  g.fillStyle=MUTED;g.font='400 32px "Noto Sans Bengali"';const u='lyannabooks.com';g.fillText(u,W-70-g.measureText(u).width,H-80);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.86));
  const url=URL.createObjectURL(blob),file=new File([blob],'lyanna-plan.jpg',{type:'image/jpeg'});
  $('cimg').innerHTML=`<img src="${url}" alt="আপনার অবস্থার কার্ড" style="width:100%;margin:0 0 10px;border:1px solid var(--rule)"><div class="row"><a class="btn ghost" href="${url}" download="lyanna-plan.jpg">ছবি রাখুন</a>${navigator.canShare&&navigator.canShare({files:[file]})?'<button class="btn" id="sh">শেয়ার করুন</button>':''}</div>`;
  if($('sh'))$('sh').onclick=()=>navigator.share({files:[file],title:NAME+' অবস্থা-যাচাই',text:'আমার প্রস্তুতির পরিকল্পনা · lyannabooks.com'}).catch(()=>{});
}
home();
})();
