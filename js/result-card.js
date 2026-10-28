/* রেজাল্টের নিচে শুভকামনা, একটা পরামর্শ আর বইয়ের কার্ড। স্কোর বক্স (#scorebox) ভরলেই নিজে থেকে বসে যায়।
   অধ্যায়ের পাতায় একবার: <script src="/js/result-card.js" defer></script>
   নম্বর নেয় স্কোর বক্সের .ok/.no/.skip থেকে, অধ্যায়ের নাম book-link.js-এর data-chapter থেকে, নম্বর header .book থেকে। */
(function(){
  var box=document.getElementById('scorebox');if(!box)return;
  var en=function(s){return +String(s).replace(/[০-৯]/g,function(d){return '০১২৩৪৫৬৭৮৯'.indexOf(d)}).replace(/[^0-9.]/g,'')||0};
  var bn=function(x){return String(x).replace(/[0-9]/g,function(d){return '০১২৩৪৫৬৭৮৯'[d]})};
  var bl=document.querySelector('script[src*="book-link.js"]'),ch=bl&&bl.dataset.chapter;
  var hd=(document.querySelector('header .book')||{}).textContent||'',no=(hd.match(/অধ্যায় ([০-৯]+)/)||[])[1];
  var slug=location.pathname.split('/').filter(Boolean)[0]||'home',CODE='LB-'+slug.toUpperCase().replace(/[^A-Z]/g,'');
  /* কোডের ছাড় book/index.html-এর OFF আর CODES-এর সাথে মিলিয়ে রাখুন */
  var st=document.createElement('style');
  st.textContent=
    '.rc{margin:14px 0}'+
    '.rc-wish{position:relative;border-radius:12px;padding:16px 16px 14px;background:var(--rc-soft);text-align:center}'+
    '.rc-tag{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--rc-gold-ink);background:var(--rc-gold);border-radius:99px;padding:2px 10px}'+
    '.rc-wish h3{font-family:var(--display,serif);font-weight:400;font-size:23px;line-height:1.3;margin:10px 0 6px;color:var(--rc-navy-ink)}'+
    '.rc-wish p{margin:0;font-size:15px;line-height:1.7}'+
    '.rc-tip{margin:10px 0 0;font-size:14.5px;line-height:1.7;text-align:left;border-top:1px dashed var(--rc-rule);padding-top:10px}'+
    '.rc-tip b{color:var(--rc-navy-ink)}'+
    '.rc-book{display:flex;gap:14px;align-items:flex-start;margin-top:12px;border-radius:12px;padding:16px;background:#13294b;color:#fff}'+
    '.rc-book img{width:78px;height:auto;border-radius:3px;box-shadow:0 6px 16px rgba(0,0,0,.35);flex:none}'+
    '.rc-book .t{font-size:12px;color:#e0b45c;font-weight:600}'+
    '.rc-book h4{font-family:var(--display,serif);font-weight:400;font-size:20px;line-height:1.3;margin:2px 0 6px}'+
    '.rc-book p{margin:0;font-size:14px;line-height:1.65;color:#dfe5ee}'+
    '.rc-price{margin:8px 0 10px!important;color:#fff!important}.rc-price b{font-size:20px;color:#e0b45c}.rc-price s{opacity:.7;margin:0 6px}'+
    '.rc-code{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:10px 0 12px;border:1.5px dashed #e0b45c;border-radius:10px;padding:8px 12px;font-size:13.5px;color:#dfe5ee}'+
    '.rc-code code{font:700 17px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#fff;background:rgba(224,180,92,.18);border-radius:6px;padding:3px 8px}'+
    '.rc-cta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}'+
    '.rc-cta a{text-decoration:none;font-weight:600;font-size:15px}'+
    '.rc-cta .go{background:#e0b45c;color:#13294b;border-radius:8px;padding:9px 16px}'+
    '.rc-cta .go:hover{background:#ecc677}.rc-cta .s{color:#fff;border-bottom:1px solid rgba(255,255,255,.5)}'+
    '.rc-note{margin-top:8px!important;font-size:12.5px!important;color:#b8c3d4!important}'+
    ':root{--rc-soft:#f6efe0;--rc-gold:#e0b45c;--rc-gold-ink:#13294b;--rc-navy-ink:#13294b;--rc-rule:#d9cdb3}'+
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--rc-soft:#262318;--rc-navy-ink:#e9d6a8;--rc-rule:#4a4330}}'+
    ':root[data-theme="dark"]{--rc-soft:#262318;--rc-navy-ink:#e9d6a8;--rc-rule:#4a4330}'+
    '@media (max-width:380px){.rc-book img{width:62px}}';
  document.head.appendChild(st);

  function wish(r){
    if(r>=.8)return ['দারুণ! আপনি তৈরি হচ্ছেন','এই অধ্যায়ে আপনার প্রস্তুতি পরীক্ষার হলের জন্য প্রায় তৈরি। এই ধারা ধরে রাখুন, শুভকামনা রইল।'];
    if(r>=.6)return ['ভালো ভিত্তি তৈরি হয়েছে','আর কয়েকটা ভুল ঠিক করলেই অধ্যায়টা আপনার। পরের বার আরও ভালো হবে, শুভকামনা।'];
    if(r>=.4)return ['অর্ধেক পথ পার হয়েছেন','আজকের প্রতিটা ভুল পরীক্ষার হলে একটা করে নম্বর বাঁচাবে। লেগে থাকুন, শুভকামনা।'];
    return ['শুরুটা এভাবেই হয়','যাঁরা বিজ্ঞানে ভালো করেন, তাঁরাও একদিন এখান থেকেই শুরু করেছিলেন। হাল ছাড়বেন না, শুভকামনা রইল।'];
  }
  function tip(ok,bad,blank,n,r){
    if(bad>=4&&bad*2>ok)return 'নেগেটিভ মার্কিংয়ে আপনার '+bn(bad*.5)+' নম্বর কাটা গেছে। নিশ্চিত না হলে উত্তর ছেড়ে দেওয়াই ভালো।';
    if(blank>=Math.max(3,n*.3))return bn(blank)+'টি প্রশ্ন ছেড়ে দিয়েছেন। নিচের ব্যাখ্যাগুলো পড়ে নিলে পরের বার এগুলোও পারবেন।';
    if(r>=.8)return '২-৩ দিন পর আবার দিন। বিরতি দিয়ে আবার পড়লে পড়া অনেক দিন মনে থাকে।';
    return 'নিচে ভুল প্রশ্নগুলোর ব্যাখ্যা আগে পড়ুন, তারপর ২-৩ দিন পর আবার পরীক্ষা দিন।';
  }
  function render(){
    var g=function(c){var e=box.querySelector('.'+c);return e?en(e.textContent):0};
    var ok=g('ok'),bad=g('no'),blank=g('skip'),n=ok+bad+blank;if(!n)return;
    var r=(ok-bad*.5)/n;
    var w=wish(r),low=r<.6,chName=ch?(no?'অধ্যায় '+no+': '+ch:ch+' অধ্যায়'):'';
    var head=low?(ch?'এই অধ্যায়টা একবার গুছিয়ে পড়ে নিন':'অধ্যায়গুলো একবার গুছিয়ে পড়ে নিন'):(no?'বাকি ২০টা অধ্যায়ও এভাবে তৈরি করুন':'পুরো বিজ্ঞান এভাবে তৈরি করুন');
    var body=low&&ch?'“লিয়ানা বিসিএস বিজ্ঞান” বইয়ের '+chName+'-এ এই পরীক্ষার প্রতিটা বিষয় সহজ ভাষায় সাজানো, কোন বিসিএসে কী এসেছে তা চিহ্নিত।'
      :'“লিয়ানা বিসিএস বিজ্ঞান”: ২১টা অধ্যায়, প্রিলি আর লিখিত দুটোর বিজ্ঞান এক বইয়ে।';
    var old=document.querySelector('.rc');if(old)old.remove();
    var d=document.createElement('div');d.className='rc';
    d.innerHTML='<div class="rc-wish"><span class="rc-tag">শুভকামনা</span><h3>'+w[0]+'</h3><p>'+w[1]+'</p>'+
      '<p class="rc-tip"><b>পরামর্শ:</b> '+tip(ok,bad,blank,n,r)+'</p></div>'+
      '<div class="rc-book"><img src="/img/cover.webp" alt="লিয়ানা বিসিএস বিজ্ঞান বইয়ের প্রচ্ছদ" width="78" loading="lazy">'+
      '<div><div class="t">লিয়ানা বুকস-এর বই · প্রি-অর্ডার চলছে</div><h4>'+head+'</h4><p>'+body+'</p>'+
      '<div class="rc-code"><span>আপনার জন্য কোড</span><code>'+CODE+'</code><span>প্রতি কপিতে আরও ৳২০ ছাড়</span></div>'+
      '<p class="rc-price"><b>৳৩৩০</b><s>৳৫০০</s>কোডসহ · ডেলিভারি ফ্রি</p>'+
      '<div class="rc-cta"><a class="go" href="/book/?preorder&from='+slug+'-result&code='+CODE+'">প্রি-অর্ডার করুন →</a><a class="s" href="/sample/sound/?from='+slug+'-result">নমুনা অধ্যায় পড়ুন</a></div>'+
      '<p class="rc-note">সব পরীক্ষা সবসময় ফ্রি থাকবে। বই বিক্রির টাকায় সাইটটা চলে।</p></div></div>';
    box.parentNode.insertBefore(d,box.nextSibling);
    try{localStorage.setItem('lb:code',CODE)}catch(e){}
  }
  new MutationObserver(render).observe(box,{childList:true});
})();
