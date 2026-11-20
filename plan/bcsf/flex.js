/* বিসিএস প্রিলি · নিজের মেয়াদ (/plan/bcsf/): অবস্থা-যাচাই শেষে পরীক্ষার তারিখ আর মেয়াদ বাছাই।
   নকশা: Lyanna_data pilot/bcs-flex/course-design.md §২; PIASH-এর সিদ্ধান্ত ২০২৬-১১-২০ (claude.ai "LY Sites" claude/bcs-flex-fable-review.md):
   - মেয়াদ বাছাই যাচাইয়ের পরে; রোজের কাজের দিন ১ শুরু হলে তালা (তার আগে বদলানো যায়)।
   - পরীক্ষার তারিখ জানা থাকলে হাতের দিনের চেয়ে বড় মেয়াদ বন্ধ।
   প্রথম সংস্করণ: বাছাই এই ফোনে (localStorage 'lb:bcsf'); D1-এ রাখা পরে, PIASH-এর অনুমতিতে। রোজের কাজ LY Course-এর সেট এলে।
   plan.js ডাকে: window.LBFLEX(ME, el, {status}) — ME.all = চার ভাগ শেষ। */
(function(){
const bn=x=>String(x).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const MON=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const dd=s=>{const x=String(s||'').split('-');return x.length===3?bn(+x[2])+' '+MON[+x[1]-1]+' '+bn(x[0]):''};
const get=()=>{try{return JSON.parse(localStorage.getItem('lb:bcsf'))||{}}catch(e){return {}}};
const put=v=>{try{localStorage.setItem('lb:bcsf',JSON.stringify(v))}catch(e){}};
const ymd=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const today=()=>ymd(Date.now()),addDays=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const diff=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
// রেসিপির flex.durations (course-design.md §২-এর ছক)
const D=[
  {d:50,t:'দিনে প্রায় ৩ ঘণ্টা',p:'৬ সপ্তাহে পুরো সিলেবাস, দিনে ২টি পাঠ',r:'',f:'শেষের ৮ দিন মডেল আর রিভিশন',m:2},
  {d:80,t:'দিনে প্রায় ২ ঘণ্টা',p:'৯ সপ্তাহে পুরো সিলেবাস',r:'',f:'শেষের ১৭ দিন মডেল আর রিভিশন',m:3},
  {d:100,t:'দিনে ১ থেকে দেড় ঘণ্টা',p:'১২ সপ্তাহে পুরো সিলেবাস, দিনে ১টি পাঠ',r:'',f:'শেষের ১৬ দিন মডেল আর রিভিশন',m:3},
  {d:120,t:'দিনে ১ থেকে দেড় ঘণ্টা',p:'১২ সপ্তাহে পুরো সিলেবাস',r:'২ সপ্তাহ ফোকাসের বিষয় আবার',f:'শেষের ২২ দিন মডেল আর রিভিশন',m:4},
  {d:150,t:'দিনে পৌনে এক থেকে ১ ঘণ্টা',p:'১৬ সপ্তাহে পুরো সিলেবাস, বড় পাঠ দুই দিনে',r:'৩ সপ্তাহ ফোকাসের বিষয় আবার',f:'শেষের ১৭ দিন মডেল আর রিভিশন',m:4}
];
window.LBFLEX=function(ME,el,h){
  if(!el)return;
  if(!ME.all){el.innerHTML='<div class="card"><b>চারটি ভাগ শেষ হলে</b><small class="dim" style="display:block">ফল দেখে নিজের মেয়াদ বাছবেন: ৫০, ৮০, ১০০, ১২০ বা ১৫০ দিন। তারপর প্রতিদিনের পরিকল্পনা।</small></div>';return}
  const S=get();
  if(S.d)return chosen(S);
  pick(S);
  function pick(S){
    const ex=S.exam||'',left=ex?diff(today(),ex):null;
    el.innerHTML=`<div class="card ex"><div><b>চার ভাগ শেষ, আপনার ফল তৈরি</b><small>বিষয় ধরে অবস্থা; দেখে তারপর মেয়াদ বাছুন</small></div><button class="btn" id="fx-st0">ফল দেখুন</button></div>
    <h2>আপনার মেয়াদ বাছুন</h2>
    <div class="card"><label class="nm">বিসিএস প্রিলি কবে?<input type="date" id="fx-ex" value="${ex}" min="${addDays(today(),1)}"></label>
      <label style="font-size:14.5px"><input type="checkbox" id="fx-nx" ${S.nx?'checked':''}> এখনো জানি না</label>
      ${left!=null?`<p class="dim" style="margin:6px 0 0">হাতে আছে ${bn(left)} দিন।</p>`:''}</div>
    <div class="grid">${D.map(x=>{const off=left!=null&&x.d>left-1;return `<button class="card ex fx-d" data-d="${x.d}" ${off?'disabled':''} style="text-align:left;font:inherit;width:100%;cursor:${off?'default':'pointer'};${off?'opacity:.45':''}">
      <div><b>${bn(x.d)} দিন</b><small>${x.t} · ${x.p}${x.r?' · '+x.r:''}</small>${off?'<small>পরীক্ষার আগে শেষ হবে না</small>':''}</div><span class="st">বাছুন →</span></button>`}).join('')}</div>
    ${left!=null&&left-1<50?'<div class="card note">পরীক্ষার আগে ৫০ দিনও নেই। তবু ৫০ দিনের মেয়াদ নিতে পারেন; শেষের মডেল আর রিভিশন পরীক্ষার আগে পুরো হবে না।</div>':''}
    <p class="dim" style="font-size:14px">রোজের কাজ শুরু হওয়ার আগে পর্যন্ত মেয়াদ বদলানো যাবে। দিন ১ শুরু হলে আর নয়।</p>`;
    const re=()=>pick(get());
    el.querySelector('#fx-st0').onclick=()=>h&&h.status&&h.status();
    el.querySelector('#fx-ex').onchange=e=>{const v=e.target.value;put({...get(),exam:v,nx:v?0:get().nx});re()};
    el.querySelector('#fx-nx').onchange=e=>{put({...get(),nx:e.target.checked?1:0,exam:e.target.checked?'':get().exam});re()};
    // পরীক্ষার তারিখ হাতে আছে কিন্তু ৫০ দিনের কম হলে ৫০ খোলা রাখা (নোটসহ)
    if(left!=null&&left-1<50){const b=el.querySelector('.fx-d[data-d="50"]');if(b){b.disabled=false;b.style.opacity='';b.style.cursor='pointer';const s=b.querySelectorAll('small')[1];if(s)s.remove()}}
    el.querySelectorAll('.fx-d').forEach(b=>b.onclick=()=>{if(b.disabled)return;const x=get();if(!x.exam&&!x.nx){alertDate();return}
      put({...x,d:+b.dataset.d,at:today(),start:addDays(today(),1)});chosen(get())});
    function alertDate(){const c=el.querySelector('#fx-ex').closest('.card');c.style.borderColor='var(--pink)';
      if(!c.querySelector('.fx-w')){const p=document.createElement('p');p.className='fx-w';p.style.cssText='margin:6px 0 0;color:var(--pink);font-size:14.5px';p.textContent='আগে পরীক্ষার তারিখ দিন, অথবা "এখনো জানি না" চাপুন।';c.appendChild(p)}
      c.scrollIntoView({behavior:'smooth',block:'center'})}
  }
  function chosen(S){
    const x=D.find(z=>z.d===S.d)||D[2],end=addDays(S.start,x.d-1),late=S.exam&&diff(end,S.exam)<0;
    el.innerHTML=`<h2>আপনার পরিকল্পনা</h2>
    <div class="card"><b>${bn(x.d)} দিনের মেয়াদ</b><small class="dim" style="display:block">${x.t} · শুরু ${dd(S.start)} · শেষ ${dd(end)}${S.exam?' · পরীক্ষা '+dd(S.exam):''}</small>
      <ol class="plan" style="margin-top:8px"><li>${x.p}; প্রতিদিন পাঠের প্রশ্ন আর আপনার ফোকাসের বিষয়ে নিজের পরীক্ষা</li>
      <li>প্রতি সপ্তাহের ৭ম দিন সাপ্তাহিক পরীক্ষা</li>${x.r?`<li>${x.r}</li>`:''}
      <li>${x.f}: ${bn(x.m)}টি পূর্ণ মডেল টেস্ট (২০০ প্রশ্ন, ২ ঘণ্টা), শেষে আবার অবস্থা-যাচাই আর শুরু-শেষের তুলনা</li></ol>
      ${late?'<p class="warn">এই মেয়াদ পরীক্ষার পরে শেষ হবে।</p>':''}</div>
    <div class="card ex"><div><b>কোন বিষয়ে কতটা ফোকাস</b><small>আপনার যাচাইয়ের ফল থেকে: যেখানে নম্বর বাড়ানো সবচেয়ে সহজ, সেখানে বেশি সময়</small></div><button class="btn" id="fx-st">দেখুন</button></div>
    <div class="card"><b>রোজের কাজ</b><small class="dim" style="display:block">প্রতিদিনের পাঠ আর পরীক্ষা এখানে "আজকের কাজ" হিসেবে খুলবে। প্রশ্ন সাজানোর কাজ শেষ পর্যায়ে; চালু হলেই আপনার দিন ১।</small></div>
    <p><button class="btn ghost" id="fx-ch">মেয়াদ বদলান</button></p>`;
    el.querySelector('#fx-st').onclick=()=>h&&h.status&&h.status();
    el.querySelector('#fx-ch').onclick=()=>{const y=get();delete y.d;delete y.at;delete y.start;put(y);pick(y)};
  }
};
})();
