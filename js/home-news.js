/* হোমের "আজকের গুরুত্বপূর্ণ সংবাদ" ফালি (LY Sites)।
   তথ্য LY News-এর: /news/index.json → "latest" → /news/day/<তারিখ>.json → "top"-এর ৭টা।
   ফালি পর্দার কাছে এলে তবেই ফাইল আনে (প্রথম স্ক্রিন হালকা থাকে); না পেলে ফালি লুকানোই থাকে।
   "আরও পড়ুন" লিংক: /news/ লাইভ হলে MORE = true করুন। */
(function(){
  var box=document.getElementById('news');if(!box)return;
  var MORE=true;
  var BN='০১২৩৪৫৬৭৮৯',MON=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  function bn(s){return String(s).replace(/\d/g,function(d){return BN[d]})}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka'}).format(new Date())}catch(e){return ''}}
  function get(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()})}
  function show(d){
    var t=(d&&d.top||[]).slice(0,7);if(!t.length)return;
    var p=String(d.date).split('-'),dt=bn(+p[2])+' '+MON[+p[1]-1],td=today(),dd=0;
    if(td){dd=Math.round((Date.parse(td)-Date.parse(d.date))/864e5)}
    var now=dd<=0;
    box.querySelector('h2').textContent=now?'আজকের গুরুত্বপূর্ণ সংবাদ':'সাম্প্রতিক গুরুত্বপূর্ণ সংবাদ';
    box.querySelector('.nd').textContent=dt+(now?'':' '+bn(p[0]))+'-এর সংবাদ';
    function li(x){return '<li><b><span class="ns">'+esc(x.section_bn)+' —</span> '+esc(x.title)+'</b><p>'+esc(x.short)+'</p></li>'}
    var h='',r='';
    for(var i=0;i<t.length;i++){if(i<3)h+=li(t[i]);else r+=li(t[i])}
    box.querySelector('ol').innerHTML=h;
    if(r){var dl=box.querySelector('details');dl.querySelector('summary').textContent='আরও '+bn(t.length-3)+'টি';dl.querySelector('ol').innerHTML=r;dl.hidden=false}
    if(MORE){var a=box.querySelector('.nm');a.href='/news/'+p[0]+'/'+p[1]+'/'+p[2]+'/';a.textContent=(now?'আজকের সব সংবাদ পড়ুন':'সব সংবাদ পড়ুন')+' →';a.hidden=false}
    box.hidden=false;
  }
  function go(){get('/news/index.json').then(function(ix){
    if(!ix||!/^\d{4}-\d\d-\d\d$/.test(ix.latest||''))throw 0;
    return get('/news/day/'+ix.latest+'.json')}).then(show).catch(function(){})}
  var mark=document.getElementById('news-at')||box.parentNode;
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();go()}},{rootMargin:'700px 0px'});
    io.observe(mark);
  }else go();
})();
