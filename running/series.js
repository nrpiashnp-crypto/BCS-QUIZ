/* চলমান নিয়োগ: shared free exam-series engine (task list, timed exam, result with weak topics).
   Page: <div id="view"></div><script src="/running/series.js" data-plan="data/plan.json" defer></script>
   plan.json: {key,title,sub,neg,topics:{code:name},practice:[{t,m,href}],exams:[{id,day,label,title,topic,phase,n,min}]}
   An exam is ready when data/x/<id>.json exists in plan (ready:true); questions {q,o[],a,e,s,t}. No dates: progress lives in localStorage. */
(function(){
const me=document.currentScript,PLAN_URL=(me&&me.dataset.plan)||'data/plan.json',BASE=PLAN_URL.replace(/[^/]*$/,'');
const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const K=['A','B','C','D','E'];
const $=id=>document.getElementById(id);
const V=()=>$('view');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=x=>bn(Number.isInteger(x)?x:(Math.round(x*100)/100).toString());
const PH={topic:'টপিক',revision:'রিভিশন',final:'রিভিশন',model:'মডেল টেস্ট',prev:'আসল প্রশ্ন'};
// benchmark tasks: {bench:'start'|'end'} or {phase:'check'} (+ vs:'id'|[ids] on the end ones)
const isEnd=e=>e.bench==='end'||(e.phase==='check'&&!!e.vs);
const isStart=e=>e.bench==='start'||(e.phase==='check'&&!e.vs);
const phOf=e=>isStart(e)?'শুরুর যাচাই':isEnd(e)?'শেষ যাচাই':(PH[e.phase]||'');
let P=null;
const KEY=()=>'series-'+P.key;
function load(){try{return JSON.parse(localStorage.getItem(KEY())||'{}')}catch(e){return {}}}
function save(o){try{localStorage.setItem(KEY(),JSON.stringify(o))}catch(e){}}
const best=(st,id)=>{const r=st[id];return r&&r.length?r.reduce((a,b)=>b.p>a.p?b:a):null};
const tname=c=>(P.topics&&P.topics[c])||c||'অন্যান্য';
const lab=e=>e.label||('টাস্ক '+bn(e.day));
const nextTask=st=>P.exams.find(e=>e.ready&&!(st[e.id]&&st[e.id].length));

function home(){
  const st=load(),L=P.exams,done=L.filter(e=>st[e.id]&&st[e.id].length).length,nx=nextTask(st);
  document.title=P.title+' · লিয়ানা বুকস';
  const weeks={};L.forEach(e=>{const w=e.week||Math.ceil(e.day/5);(weeks[w]=weeks[w]||[]).push(e)});
  const pc=Math.round(done*100/L.length);
  V().innerHTML=`<nav class="crumb"><a href="/running/">চলমান নিয়োগ</a><span>${esc(P.short||P.title)}</span></nav>
  <h1>${esc(P.title)}</h1><p class="sub">${P.sub||''}</p>
  <div class="prog"><div class="pbar"><i style="width:${pc}%"></i></div><span>${bn(done)} / ${bn(L.length)} টাস্ক শেষ</span></div>
  ${nx?`<a class="card big today" href="#/x/${nx.id}"><span class="m">${done?'আজকের টাস্ক':'এখান থেকে শুরু করুন'}</span><span class="t">${lab(nx)} · ${esc(nx.title)}</span><span class="m">${esc(nx.topic||'')}</span><span class="m">${bn(nx.n)}টি প্রশ্ন · ${bn(nx.min)} মিনিট</span><span class="go">শুরু করুন →</span></a>`:done?'<p class="note">সব তৈরি টাস্ক শেষ! দুর্বল টপিকের টাস্কগুলো আবার দিয়ে দেখুন।</p>':''}
  <p class="note">যেদিন শুরু করবেন সেদিনই আপনার টাস্ক ১। প্রতিদিন একটা করে দিলে ${bn(Math.ceil(L.length/5))} সপ্তাহে শেষ হবে (সপ্তাহে ৫টি)। কোন টাস্ক দিয়েছেন আর কত পেয়েছেন, তা এই ফোনেই মনে থাকে।</p>
  ${Object.entries(weeks).map(([w,l])=>`<h2 class="grp">সপ্তাহ ${bn(w)}</h2><div class="tlist">${l.map(e=>{const b=best(st,e.id);
    return `<a class="tl${b?' done':''}${e.ready?'':' soon'}" ${e.ready?`href="#/x/${e.id}"`:'aria-disabled="true"'}><span class="dn">${bn(e.day)}</span><span class="body"><span class="tt">${esc(e.title)}</span><span class="st">${esc(e.topic||'')}</span><span class="st">${phOf(e)} · ${bn(e.n)} প্রশ্ন · ${bn(e.min)} মিনিট${b?` · <b>সেরা ${fmt(b.s)}/${bn(b.n)}</b>`:''}</span></span><span class="gobtn">${!e.ready?'শীঘ্রই':b?'আবার':'শুরু →'}</span></a>`}).join('')}</div>`).join('')}
  ${P.practice&&P.practice.length?`<h2 class="grp">আসল প্রশ্নপত্রে অনুশীলন</h2><p class="sub">${esc(P.practiceNote||'')}</p><div class="tlist">${P.practice.map(x=>`<a class="tl" href="${x.href}"><span class="body"><span class="tt">${esc(x.t)}</span><span class="st">${esc(x.m||'')}</span></span><span class="gobtn">শুরু →</span></a>`).join('')}</div>`:''}
  ${done?'<p class="sub" style="margin-top:20px"><button class="btn ghost" id="reset" type="button">এই ফোনের অগ্রগতি মুছে নতুন করে শুরু</button></p>':''}`;
  const r=$('reset');if(r){let arm=0;r.onclick=()=>{if(arm&&Date.now()-arm<4000){save({});home()}else{arm=Date.now();r.textContent='নিশ্চিত হলে আবার চাপুন'}}}
}

let E=null,Q=[],pick=[],timer=null,endAt=0,startAt=0,armed=0,NEG=0.25,MIN=0;
async function exam(id){
  E=P.exams.find(e=>e.id===id);if(!E||!E.ready)return home();
  V().innerHTML='<p class="load">প্রশ্ন লোড হচ্ছে…</p>';
  try{Q=await (await fetch(BASE+'x/'+id+'.json')).json()}catch(err){V().innerHTML='<p class="load">প্রশ্ন লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';return}
  MIN=E.min;document.title=lab(E)+': '+E.title+' · '+(P.short||P.title);
  V().innerHTML=`<nav class="crumb"><a href="/running/">চলমান নিয়োগ</a><span><a href="#/">${esc(P.short||P.title)}</a></span><span>${lab(E)}</span></nav>
  <section id="start"><p class="kick">${lab(E)} · ${phOf(E)}</p><h1>${esc(E.title)}</h1><p class="sub">${esc(E.topic||'')}</p>
   <div class="btns start"><button class="btn" id="go" type="button">পরীক্ষা শুরু করুন →</button></div>
   <ul class="rules"><li>প্রশ্ন ${bn(Q.length)}টি, সময় <b>${bn(MIN)}</b> মিনিট। সময় শেষ হলে নিজে থেকেই জমা হবে।</li>
   <li>সঠিক উত্তরে ১ নম্বর, ভুল উত্তরে <b id="negt"></b>। উত্তর না দিলে নম্বর কাটা যায় না।</li>
   <li>শেষে ফল, কোন টপিকে দুর্বল আর প্রতিটি প্রশ্নের ব্যাখ্যা দেখাবে।</li></ul>
   <p class="lbl">নেগেটিভ মার্কিং</p><div class="chips" id="negc"><button type="button" class="chip" data-v="0.5">−০.৫</button><button type="button" class="chip" data-v="0.25">−০.২৫</button><button type="button" class="chip" data-v="0">নেই</button></div>
   <div class="hist" id="hist" hidden></div></section>
  <section id="exam" hidden><div class="bar"><span class="clock" id="clock"></span><span>উত্তর <b id="ans">০</b> / <b>${bn(Q.length)}</b></span><button class="btn" id="submit" type="button">জমা দিন</button></div><main id="elist"></main><div class="btns"><button class="btn" id="submit2" type="button">জমা দিন</button></div></section>
  <section id="result" hidden><div class="score" id="scorebox"></div><div id="weak"></div><div class="btns"><a class="btn" id="nextbtn" href="#/">পরের টাস্ক →</a><button class="btn ghost" id="again" type="button">আবার দিন</button><a class="btn ghost" href="#/">সব টাস্ক</a></div><h2>উত্তর ও ব্যাখ্যা</h2><main id="rlist"></main></section>`;
  let v=P.neg!=null?P.neg:0.25;try{const s=localStorage.getItem('series-neg');if(s!=null)v=parseFloat(s)}catch(e){}
  setNeg(v);
  $('negc').onclick=ev=>{const x=ev.target.dataset&&ev.target.dataset.v;if(x===undefined)return;setNeg(parseFloat(x));try{localStorage.setItem('series-neg',x)}catch(e){}};
  $('go').onclick=$('again').onclick=startExam;
  $('submit').onclick=$('submit2').onclick=askSubmit;
  drawHist();window.scrollTo(0,0);
}
function setNeg(v){NEG=v;[...$('negc').children].forEach(c=>c.setAttribute('aria-pressed',parseFloat(c.dataset.v)===v));$('negt').textContent=v?'−'+bn(v):'০ (নেগেটিভ নেই)'}
const show=id=>{['start','exam','result'].forEach(s=>$(s).hidden=s!==id);window.scrollTo(0,0)};
const qhtml=(q,i)=>`<div class="qh"><span class="num">${bn(i+1)}.</span><div class="qt">${q.q.includes('<table')?'<div class="tb">'+q.q+'</div>':q.q}</div></div>`;
function drawHist(){
  const h=load()[E.id]||[],el=$('hist');if(!h.length){el.hidden=true;return}
  el.hidden=false;el.innerHTML='<b>এই ফোনে আগের ফল</b><table><tr><th>তারিখ</th><th>নম্বর</th><th>নেগেটিভ</th></tr>'+h.slice(-8).map(r=>`<tr><td>${r.d}</td><td>${fmt(r.s)} / ${bn(r.n)}</td><td>${r.g?'−'+bn(r.g):'নেই'}</td></tr>`).join('')+'</table>';
}
function startExam(){
  pick=Q.map(()=>-1);const box=$('elist');box.innerHTML='';
  Q.forEach((q,i)=>{const s=document.createElement('section');s.className='q';s.innerHTML=qhtml(q,i)+'<div class="opts"></div>';
    const o=s.querySelector('.opts');
    q.o.forEach((t,j)=>{const b=document.createElement('button');b.type='button';b.className='opt';b.innerHTML=`<span class="k">${K[j]}</span><span>${t}</span>`;
      b.onclick=()=>{pick[i]=pick[i]===j?-1:j;[...o.children].forEach((x,k)=>x.classList.toggle('sel',k===pick[i]));$('ans').textContent=bn(pick.filter(x=>x>=0).length)};o.appendChild(b)});
    box.appendChild(s)});
  $('ans').textContent='০';startAt=Date.now();endAt=startAt+MIN*60000;tick();clearInterval(timer);timer=setInterval(tick,500);show('exam');
}
function tick(){const left=Math.max(0,endAt-Date.now()),s=Math.ceil(left/1000);
  $('clock').textContent=bn(String(Math.floor(s/60)).padStart(2,'0'))+':'+bn(String(s%60).padStart(2,'0'));$('clock').classList.toggle('low',s<=60);if(left<=0)finish()}
function askSubmit(){
  const blank=pick.filter(x=>x<0).length;
  if(armed&&Date.now()-armed<4000){finish();return}
  armed=Date.now();[$('submit'),$('submit2')].forEach(b=>b.textContent=blank?`${bn(blank)}টি বাকি, তবু জমা দিতে আবার চাপুন`:'নিশ্চিত হলে আবার চাপুন');
  setTimeout(()=>{if(Date.now()-armed>=4000)[$('submit'),$('submit2')].forEach(b=>b.textContent='জমা দিন')},4100);
}
// task where a topic code is taught: first topic-phase exam whose questions carry it (plan lists codes in e.tc)
const taskFor=code=>P.exams.find(e=>e.phase==='topic'&&e.tc&&e.tc.includes(code));
function finish(){
  clearInterval(timer);timer=null;armed=0;
  let ok=0,bad=0;const byT={},byS={};
  Q.forEach((q,i)=>{const t=q.t||q.s||'অন্যান্য',s=q.s||'';
    const T=byT[t]=byT[t]||[0,0,0],S=byS[s]=byS[s]||[0,0];T[2]++;S[1]++;
    if(pick[i]<0)return;if(pick[i]===q.a){ok++;T[0]++;S[0]++}else{bad++;T[1]++}});
  const n=Q.length,blank=n-ok-bad,score=ok-bad*NEG,used=Math.min(MIN*60,Math.round((Date.now()-startAt)/1000));
  const d=new Date(),ds=bn(d.getDate())+'/'+bn(d.getMonth()+1)+'/'+bn(d.getFullYear());
  const st=load();(st[E.id]=st[E.id]||[]).push({d:ds,s:score,n,g:NEG,p:score/n,sb:byS});save(st);
  const pc=score/n;
  $('scorebox').innerHTML=`<p class="kick">${lab(E)} · ${esc(E.title)}</p><div class="big">${fmt(score)} / ${bn(n)}</div>
   <div class="stats"><span class="ok">সঠিক ${bn(ok)}</span><span class="no">ভুল ${bn(bad)}</span><span class="skip">উত্তর দেননি ${bn(blank)}</span><span>সময় ${bn(Math.floor(used/60))} মিনিট ${bn(used%60)} সেকেন্ড</span></div>
   ${Object.keys(byS).length>1?`<div class="sbj">${Object.entries(byS).map(([k,v])=>`${esc(k)}: ${bn(v[0])}/${bn(v[1])}`).join(' · ')}</div>`:''}
   <p>${pc>=.7?'চমৎকার! এই মানের প্রস্তুতি ধরে রাখুন।':pc>=.5?'ভালো হয়েছে। ভুলগুলোর ব্যাখ্যা পড়ে নিন।':'ব্যাখ্যাগুলো মন দিয়ে পড়ুন, কয়েক দিন পর টাস্কটা আবার দিন।'}</p>`;
  // topic table, weakest first; weak = below 60% correct among at least 2 questions
  const rows=Object.entries(byT).map(([t,v])=>({t,ok:v[0],n:v[2],r:v[0]/v[2]})).sort((a,b)=>a.r-b.r||b.n-a.n);
  const weak=rows.filter(r=>r.n>=2&&r.r<.6).slice(0,3);
  $('weak').innerHTML=rows.length>1?`<div class="wk"><h2>টপিক ধরে ফল</h2>
    ${weak.length?`<p class="wtip">সবচেয়ে দুর্বল: <b>${weak.map(r=>esc(tname(r.t))).join(', ')}</b>। ${weak.map(r=>{const x=taskFor(r.t);return x&&x.id!==E.id?`<a href="#/x/${x.id}">${lab(x)} (${esc(x.title)})</a>`:''}).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'নিচের ব্যাখ্যাগুলো আগে পড়ুন'}${weak.some(r=>{const x=taskFor(r.t);return x&&x.id!==E.id})?' আবার দিয়ে দেখুন।':'।'}</p>`:'<p class="wtip">কোনো টপিকে বড় দুর্বলতা নেই। চমৎকার!</p>'}
    <table>${rows.map(r=>`<tr class="${r.n>=2&&r.r<.6?'low':''}"><td>${esc(tname(r.t))}</td><td>${bn(r.ok)}/${bn(r.n)}</td><td><span class="mb"><i style="width:${Math.round(r.r*100)}%"></i></span></td></tr>`).join('')}</table></div>`:'';
  $('weak').insertAdjacentHTML('afterbegin',benchCmp(st));
  const nx=nextTask(load());const nb=$('nextbtn');if(nx){nb.href='#/x/'+nx.id;nb.textContent='পরের টাস্ক: '+lab(nx)+' →'}else{nb.textContent='সব টাস্ক →'}
  const box=$('rlist');box.innerHTML='';
  Q.forEach((q,i)=>{const p=pick[i];const s=document.createElement('section');s.className='q';
    s.innerHTML=qhtml(q,i)+`<div class="opts">${q.o.map((t,j)=>`<button type="button" class="opt${j===q.a?' right':''}${j===p&&p!==q.a?' wrong':''}" disabled><span class="k">${K[j]}</span><span>${t}</span></button>`).join('')}</div>
     <div class="exp">${p<0?'<span class="skip">উত্তর দেননি।</span> সঠিক উত্তর: '+K[q.a]+'।':p===q.a?'<span class="ok">সঠিক (+১)।</span>':'<span class="no">ভুল ('+(NEG?'−'+bn(NEG):'০')+')।</span> সঠিক উত্তর: '+K[q.a]+'।'} ${q.e||''}${q.t&&P.topics&&P.topics[q.t]?`<span class="src">টপিক: ${esc(tname(q.t))}</span>`:''}</div>`;
    box.appendChild(s)});
  show('result');drawHist();
}
// end benchmark: compare with the average first attempt of the start benchmarks, in total % and by subject
function benchCmp(st){
  if(!isEnd(E))return '';
  const vs=E.vs?[].concat(E.vs):null;
  const S=P.exams.filter(e=>vs?vs.includes(e.id):isStart(e)).map(e=>st[e.id]&&st[e.id][0]).filter(Boolean);
  if(!S.length)return '<div class="wk"><p class="wtip">শুরুর যাচাই টাস্কগুলো দেওয়া থাকলে এখানে আগে-পরের তুলনা দেখাত।</p></div>';
  const cur=st[E.id][st[E.id].length-1],pct=x=>Math.round(x*100);
  const before=S.reduce((a,r)=>a+r.p,0)/S.length,agg={},now=cur.sb||{};
  S.forEach(r=>Object.entries(r.sb||{}).forEach(([k,v])=>{const A=agg[k]=agg[k]||[0,0];A[0]+=v[0];A[1]+=v[1]}));
  const sign=d=>d>0?'+'+bn(d):d<0?'−'+bn(-d):'০';
  const rows=Object.keys(now).filter(k=>agg[k]&&agg[k][1]).map(k=>{const b=pct(agg[k][0]/agg[k][1]),a=pct(now[k][0]/now[k][1]);return `<tr><td>${esc(k||'অন্যান্য')}</td><td>${bn(b)}%</td><td>${bn(a)}%</td><td class="${a>=b?'ok':'no'}">${sign(a-b)}</td></tr>`}).join('');
  const d=pct(cur.p)-pct(before);
  return `<div class="wk cmp"><h2>শুরুর তুলনায় আপনি</h2><p class="wtip">শুরুর যাচাইয়ে গড়ে পেয়েছিলেন <b>${bn(pct(before))}%</b>, এখন পেলেন <b>${bn(pct(cur.p))}%</b> (${sign(d)})। ${d>=10?'দারুণ উন্নতি!':d>0?'উন্নতি হয়েছে, এভাবেই চালিয়ে যান।':'দুর্বল টপিকের টাস্কগুলো আবার দিয়ে নিন।'}</p>
   ${rows?`<table><tr><th>বিষয়</th><th>শুরুতে</th><th>এখন</th><th>বদল</th></tr>${rows}</table>`:''}</div>`;
}
function route(){
  if(timer){clearInterval(timer);timer=null}
  const p=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  if(p[0]==='x'&&p[1])return exam(p[1]);
  home();
}
window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0)});
window.addEventListener('beforeunload',e=>{if($('exam')&&!$('exam').hidden){e.preventDefault();e.returnValue=''}});
fetch(PLAN_URL).then(r=>r.json()).then(x=>{P=x;route()}).catch(()=>{V().innerHTML='<p class="load">তালিকা লোড হয়নি। আবার চেষ্টা করুন।</p>'});
// book link under every explanation
const bl=document.createElement('script');bl.src='/js/book-link.js';bl.dataset.kind='jobs';document.head.appendChild(bl);
})();
