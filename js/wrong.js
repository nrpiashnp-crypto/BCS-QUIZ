/* ভুল প্রশ্ন: অধ্যায়-পরীক্ষায় ভুল বা বাদ দেওয়া প্রশ্ন এই ফোনে মনে রাখে, পরে আলাদা করে অনুশীলন করা যায়।
   অধ্যায় পাতা তিন জায়গায় ডাকে: finish() → LW.exam, অনুশীলনে উত্তর → LW.mark, renderPrac-এর ফিল্টার → LW.has (filt==='w')।
   পাতার Q, filt, renderPrac, show ব্যবহার করে। স্টোরেজ: localStorage 'lw:/<অধ্যায়>/' = প্রশ্নের লেখার তালিকা। */
(function(){
  const KEY='lw:'+location.pathname.replace(/index\.html$/,'');
  const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
  const $=id=>document.getElementById(id);
  const id=q=>q.q;
  let set=null;
  function load(){if(set)return set;try{set=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch(e){set=new Set()}return set}
  function save(){try{localStorage.setItem(KEY,JSON.stringify([...set].slice(-600)))}catch(e){}}
  // শুধু যে প্রশ্নগুলো এখনো ভান্ডারে আছে সেগুলো গোনা হয়; job-science-এ শুধু বাছাই করা অধ্যায়ের (pool())
  function count(){const s=load(),L=typeof pool==='function'?pool():typeof Q==='undefined'?null:Q;return L?L.filter(q=>s.has(id(q))).length:s.size}

  function openWrong(){
    filt='w';
    [...$('chips').children].forEach(c=>c.setAttribute('aria-pressed',c.dataset.k==='w'));
    renderPrac();show('prac');window.scrollTo(0,0);
  }
  function ui(){
    const n=count(), go=$('practice'), chips=$('chips');
    if(!go||!chips)return;
    let b=$('wrongp');
    if(!b){b=document.createElement('button');b.type='button';b.className='btn ghost';b.id='wrongp';b.onclick=openWrong;go.after(b)}
    b.hidden=!n;b.innerHTML=`ভুল প্রশ্ন অনুশীলন <b>(${bn(n)})</b>`;
    b.title='আগের পরীক্ষা আর অনুশীলনে যেগুলো ভুল হয়েছে বা উত্তর দেননি। সঠিক হলে তালিকা থেকে বাদ যায়।';
    let c=chips.querySelector('[data-k="w"]');
    if(!c&&n){c=document.createElement('button');c.type='button';c.className='chip';c.dataset.k='w';c.setAttribute('aria-pressed',filt==='w');chips.appendChild(c)}
    if(c){if(!n&&filt!=='w')c.remove();else c.textContent=`আমার ভুল (${bn(n)})`}
  }

  window.LW={
    has:q=>load().has(id(q)),
    count,
    exam(paper,pick){load();paper.forEach((q,i)=>{pick[i]===q.a?set.delete(id(q)):set.add(id(q))});save();ui()},
    mark(q,good){load();good?set.delete(id(q)):set.add(id(q));save();ui()}
  };
  // শুরুর পাতা যখনই দেখা যায় (ফিরে আসা, job-science-এ অধ্যায় বাছাই) সংখ্যা নতুন করে দেখানো হয়
  function init(){ui();const st=$('start');if(st)new MutationObserver(()=>{if(!st.hidden)ui()}).observe(st,{attributes:true,attributeFilter:['hidden']})}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
