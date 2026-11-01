/* দিনের মতামত (পাইলট ব্যাচ, যেমন পেট্রোবাংলা প্রথম ব্যাচ): প্রতিদিন রাত ৯টা থেকে সকাল ৬টা (ঢাকা) পরীক্ষার পাতায় ৫টি প্রশ্ন।
   উত্তর অ্যাকাউন্টের সঙ্গে জমা (লগইন লাগে); একই রাতে আবার পাঠালে বদলায়, সকাল ৬টায় বন্ধ। সময় আর দিন গোনে সার্ভার (/api/fb)।
   পাতায় যা বসাতে হয়:
     <div id="day-fb" data-batch="petrobangla-1"></div>
     <script src="/js/day-fb.js" defer></script>
   দিনের অংশ আর প্রশ্নের তালিকা আসে data-cfg ফাইল থেকে (না দিলে /pilot/<batch>/days.json):
     {"days": {"1": {"parts": [["s1", "অংশের নাম"], …], "exam": "/running/…/data/x/pb01.json"}, "2": {…}}}
   "exam" ফাইলের প্রতিটি প্রশ্নে {id, q}; না থাকলে (গ)-তে শুধু হ্যাঁ/না থাকে।
   ব্যাচ শুরু হয় অ্যাডমিন পাতা /admin/pilot/ থেকে শুরুর তারিখ বসালে; তার আগে এখানে কিছুই দেখায় না। */
(function(){
  var box=document.getElementById('day-fb');
  if(!box||!box.dataset.batch||window.LBFB)return;window.LBFB=1;
  var batch=box.dataset.batch,cfgUrl=box.dataset.cfg||('/pilot/'+batch+'/days.json');
  var bn=function(x){return String(x).replace(/\d/g,function(d){return '০১২৩৪৫৬৭৮৯'[d]})};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var plain=function(s){var d=document.createElement('div');d.innerHTML=String(s||'');return (d.textContent||'').replace(/\s+/g,' ').trim()};
  var MINS=[['30','৩০ মিনিট'],['60','১ ঘণ্টা'],['120','২ ঘণ্টা'],['more','বেশি']];
  var st=document.createElement('style');
  st.textContent='.dfb{margin:22px 0;padding:16px;border:1.3px solid #c8326a;border-radius:3px;background:#fffdf7;color:#1d1f21;font:400 15px/1.6 "Noto Sans Bengali",sans-serif}'+
    '.dfb h3{margin:0 0 2px;font:400 21px/1.3 "Tiro Bangla",serif;color:#13294b}'+
    '.dfb .sub{margin:0 0 12px;font-size:13.5px;color:#5f6366}'+
    '.dfb fieldset{margin:0 0 16px;padding:0;border:0}'+
    '.dfb legend{padding:0;margin:0 0 6px;font-weight:600;color:#13294b}'+
    '.dfb textarea{width:100%;box-sizing:border-box;min-height:64px;padding:8px;border:1.2px solid #c9c4b8;border-radius:3px;font:inherit;font-size:15px;resize:vertical;background:#fff;color:#1d1f21}'+
    '.dfb .ch{display:flex;flex-wrap:wrap;gap:6px}'+
    '.dfb .ch button{font:inherit;font-size:14px;min-height:38px;padding:5px 12px;border:1.3px solid #c8326a;border-radius:3px;background:#fff;color:#1d1f21;cursor:pointer;text-align:left}'+
    '.dfb .ch button[aria-pressed="true"]{background:#13294b;border-color:#13294b;color:#fff}'+
    '.dfb .ch.col{flex-direction:column}.dfb .ch.col button{width:100%}'+
    '.dfb .ql{margin-top:8px;max-height:260px;overflow-y:auto;border:1px solid #d9d3c4;border-radius:3px;background:#fff}'+
    '.dfb .ql label{display:flex;gap:8px;align-items:flex-start;padding:7px 10px;border-bottom:1px solid #eee8db;font-size:14px;cursor:pointer}'+
    '.dfb .ql input{margin-top:5px;flex:none;accent-color:#13294b}'+
    '.dfb .go{font:600 15px/1 "Noto Sans Bengali",sans-serif;padding:12px 20px;border:0;border-radius:3px;background:#13294b;color:#fff;cursor:pointer}'+
    '.dfb .go:disabled{opacity:.5;cursor:default}'+
    '.dfb .msg{margin:10px 0 0;font-size:14px}.dfb .msg.ok{color:#1f8a4c}.dfb .msg.bad{color:#b23b3b}'+
    '.dfb-l{margin:18px 0;font-size:13.5px;color:#5f6366}';
  document.head.appendChild(st);

  function api(body){
    return fetch('/api/fb'+(body?'':'?batch='+encodeURIComponent(batch)),body?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{credentials:'same-origin',cache:'no-store'})
      .then(function(r){return r.json().then(function(j){j.status=r.status;return j})});
  }
  var hm=function(ts){return bn(new Date(ts).toLocaleTimeString('en-GB',{timeZone:'Asia/Dhaka',hour:'numeric',minute:'2-digit',hour12:true}).replace(/\s*(am|pm)$/i,'').replace(/:00$/,''))};

  api().then(function(s){
    if(!s.on||s.day<1||s.day>s.days)return;
    if(!s.open){
      if(s.login&&Date.now()<s.opens)box.innerHTML='<p class="dfb-l">দিন '+bn(s.day)+'-এর মতামত আজ রাত '+hm(s.opens)+'টায় খুলবে, চলবে সকাল ৬টা পর্যন্ত।</p>';
      return;
    }
    if(!s.login){
      box.innerHTML='<div class="dfb"><h3>দিনের মতামত · দিন '+bn(s.day)+'</h3><p class="sub">৫টি ছোট প্রশ্ন, সকাল ৬টা পর্যন্ত খোলা। উত্তর আপনার অ্যাকাউন্টের সঙ্গে জমা হয়, তাই আগে লগইন লাগবে।</p><a class="go" style="display:inline-block;text-decoration:none" href="/account/">লগইন করুন →</a></div>';
      return;
    }
    fetch(cfgUrl,{cache:'no-cache'}).then(function(r){return r.ok?r.json():{}}).catch(function(){return {}}).then(function(c){
      var d=(c.days||{})[String(s.day)]||{};
      if(!d.exam)return draw(s,d,[]);
      fetch(d.exam).then(function(r){return r.ok?r.json():[]}).catch(function(){return []}).then(function(q){
        q=Array.isArray(q)?q:(q&&q.q)||[];
        draw(s,d,q.filter(function(x){return x&&x.id}).map(function(x){return [x.id,plain(x.q)]}));
      });
    });
  }).catch(function(){});

  function draw(s,d,qs){
    var m=s.mine||{},parts=(d.parts||[]).filter(function(p){return p&&p[0]});
    var v={hard:m.hard||'',useful:m.useful||'',miss:m.miss==null?null:m.miss,missq:m.missq||[],rate:m.rate||null,mins:m.mins||''};
    var btns=function(name,list,cur,col){return '<div class="ch'+(col?' col':'')+'" data-n="'+name+'">'+list.map(function(x){
      return '<button type="button" data-v="'+esc(x[0])+'" aria-pressed="'+(String(cur)===String(x[0]))+'">'+esc(x[1])+'</button>'}).join('')+'</div>'};
    box.innerHTML='<form class="dfb" novalidate><h3>দিনের মতামত · দিন '+bn(s.day)+'</h3>'+
      '<p class="sub">সকাল '+hm(s.closes)+'টা পর্যন্ত খোলা, তার আগে যতবার খুশি বদলাতে পারবেন। আপনার নাম কোথাও দেখানো হয় না।</p>'+
      '<fieldset><legend>(ক) আজকের শিটের কোন অংশ বুঝতে সবচেয়ে কষ্ট হলো?</legend><textarea name="hard" maxlength="400" placeholder="এক-দুই লাইনে লিখুন">'+esc(v.hard)+'</textarea></fieldset>'+
      (parts.length?'<fieldset><legend>(খ) কোন ছক বা অংশ সবচেয়ে কাজে লাগল?</legend>'+btns('useful',parts,v.useful,1)+'</fieldset>':'')+
      '<fieldset><legend>(গ) এমন প্রশ্ন এসেছিল কি, যার উত্তর শিটে পাননি?</legend>'+btns('miss',[[1,'হ্যাঁ'],[0,'না']],v.miss)+
        (qs.length?'<div class="ql" '+(v.miss===1?'':'hidden')+'>'+qs.map(function(q,i){
          return '<label><input type="checkbox" value="'+esc(q[0])+'"'+(v.missq.indexOf(q[0])>=0?' checked':'')+'><span>'+bn(i+1)+'. '+esc(q[1].length>90?q[1].slice(0,88)+'…':q[1])+'</span></label>'}).join('')+'</div>':'')+'</fieldset>'+
      '<fieldset><legend>(ঘ) আজকের শিট কতটা কাজে লাগল?</legend>'+btns('rate',[[1,'১'],[2,'২'],[3,'৩'],[4,'৪'],[5,'৫']],v.rate)+'<p class="sub" style="margin:4px 0 0">১ = একদম না, ৫ = খুব কাজে লেগেছে</p></fieldset>'+
      '<fieldset><legend>(ঙ) আজ কত সময় পড়লেন?</legend>'+btns('mins',MINS,v.mins)+'</fieldset>'+
      '<button class="go" type="submit">'+(s.mine?'বদলে জমা দিন':'জমা দিন')+'</button><p class="msg" role="status">'+(s.mine?'আজকের মতামত জমা আছে।':'')+'</p></form>';
    var f=box.querySelector('form'),ql=f.querySelector('.ql'),msg=f.querySelector('.msg');
    f.querySelectorAll('.ch').forEach(function(g){g.addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b)return;
      g.querySelectorAll('button').forEach(function(o){o.setAttribute('aria-pressed',o===b?'true':'false')});
      var n=g.dataset.n,x=b.dataset.v;v[n]=n==='rate'||n==='miss'?+x:x;
      if(n==='miss'&&ql)ql.hidden=v.miss!==1;
    })});
    f.onsubmit=function(e){
      e.preventDefault();
      v.hard=f.hard.value.trim();
      v.missq=ql?[].map.call(ql.querySelectorAll('input:checked'),function(i){return i.value}).slice(0,15):[];
      if(!v.hard&&!v.useful&&v.miss==null&&!v.rate&&!v.mins){msg.className='msg bad';msg.textContent='অন্তত একটা প্রশ্নের উত্তর দিন।';return}
      var go=f.querySelector('.go');go.disabled=true;msg.className='msg';msg.textContent='পাঠানো হচ্ছে…';
      api({batch:batch,hard:v.hard,useful:v.useful,miss:v.miss,missq:v.miss===1?v.missq:[],rate:v.rate,mins:v.mins}).then(function(j){
        go.disabled=false;
        if(j.ok){msg.className='msg ok';msg.textContent='জমা হয়েছে, ধন্যবাদ। সকাল ৬টা পর্যন্ত বদলাতে পারবেন।';go.textContent='বদলে জমা দিন';return}
        msg.className='msg bad';
        msg.textContent=j.error==='closed'?'সকাল ৬টা পেরিয়ে গেছে, আজকের মতামত বন্ধ।':j.status===401?'লগইন শেষ হয়ে গেছে। আবার লগইন করে পাঠান।':'জমা হয়নি। একটু পরে আবার চেষ্টা করুন।';
      }).catch(function(){go.disabled=false;msg.className='msg bad';msg.textContent='ইন্টারনেট সংযোগ নেই। সংযোগ পেলে আবার "জমা দিন" চাপুন।'});
    };
  }
})();
