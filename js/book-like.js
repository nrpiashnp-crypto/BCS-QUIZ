/* অধ্যায় পড়ার শেষে: "বইটি ভালো লেগেছে? হ্যাঁ / না" + পরামর্শের ঘর (বাংলা বা বাংলিশে)।
   বসানো: <div class="bklike" data-ch="sound"></div>
   জমা /api/fb-তে: হ্যাঁ/না → চাবি "book-like:<অধ্যায়>" (১ হ্যাঁ, ০ না);
   পরামর্শ → চাবি "book-sug:<অধ্যায়>", প্রতি ১৬০ অক্ষরে এক সারি (আলাদা ছাপ, তাই প্রতিটা আলাদা দেখা যায়)।
   দেখা: /admin/reports/ ("বুঝেছি/বুঝিনি" ট্যাব), বা সাপ্তাহিক রপ্তানি (fb_tap)।
   data-q="buy" দিলে পাতার ওপরের প্রশ্ন: "বইটি বাজারে এলে কি কিনবেন? হ্যাঁ / না" → চাবি "book-buy:<অধ্যায়>"।
   একই পাতায় একই প্রশ্নের একাধিক ঘর থাকলে একটায় উত্তর দিলেই বাকিগুলোতেও "ধন্যবাদ"। */
(function(){
  var css='.bklike{max-width:560px;margin:28px auto;padding:18px 16px;border:1.4px solid #c8326a;border-radius:3px;background:#fffdf7;text-align:center;font-family:"Noto Sans Bengali",system-ui,sans-serif;color:#13294b}'+
    '.bklike p{margin:0 0 12px;font-size:17px;font-weight:600}.bklike .b{display:flex;gap:12px;justify-content:center}'+
    '.bklike button{min-width:96px;min-height:44px;font:600 16px "Noto Sans Bengali",sans-serif;border:1.4px solid #13294b;border-radius:3px;background:#fff;color:#13294b;cursor:pointer}'+
    '.bklike button.y,.bklike button.s{background:#13294b;color:#fff}.bklike .t{font-size:15px;font-weight:500;margin:0}'+
    '.bklike textarea{display:block;width:100%;box-sizing:border-box;min-height:96px;margin:0 0 10px;padding:10px 12px;font:16px/1.5 "Noto Sans Bengali",sans-serif;border:1px solid #c9c2b3;border-radius:3px;background:#fff;color:#1d1f21}'+
    '.bklike label{display:block;text-align:left;font-size:15px;font-weight:500;margin:4px 0 6px}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function send(taps){return fetch('/api/fb',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({page:location.pathname,taps:taps})}).catch(function(){})}
  document.querySelectorAll('.bklike[data-ch]').forEach(function(el){
    var ch=el.getAttribute('data-ch'),buy=el.getAttribute('data-q')==='buy',
        key=(buy?'lb:buy:':'lb:like:')+ch,sel='.bklike[data-ch="'+ch+'"]'+(buy?'[data-q="buy"]':':not([data-q])');
    function done(){el.innerHTML='<p class="t">ধন্যবাদ! আপনার মত জমা হয়েছে।</p>'}
    function thanks(){document.querySelectorAll(sel).forEach(function(o){o.innerHTML='<p class="t">ধন্যবাদ! আপনার মত জমা হয়েছে।</p>'})}
    if(buy){
      if(get(key)){done();return}
      el.innerHTML='<p>বইটি বাজারে এলে কি আপনি কিনবেন?</p><div class="b"><button type="button" class="y" data-v="1">হ্যাঁ</button><button type="button" data-v="0">না</button></div>';
      el.querySelectorAll('button').forEach(function(b){b.onclick=function(){
        var v=+b.getAttribute('data-v');send([['book-buy:'+ch,'1',v,'']]);set(key,String(v));thanks();
      }});
      return;
    }
    function suggest(v){
      el.innerHTML='<p class="t" style="margin-bottom:10px">'+(v?'জেনে ভালো লাগল!':'জানানোর জন্য ধন্যবাদ।')+'</p>'+
        '<label for="bks-'+ch+'">বইটা আরও ভালো করতে কোনো পরামর্শ থাকলে লিখুন (বাংলা বা বাংলিশে, চাইলে)</label>'+
        '<textarea id="bks-'+ch+'" maxlength="640" placeholder="যেমন: ছক আরও বেশি হলে ভালো হতো…"></textarea>'+
        '<div class="b"><button type="button" class="s">পাঠান</button><button type="button" class="n">থাক</button></div>';
      var ta=el.querySelector('textarea');
      el.querySelector('.s').onclick=function(){
        var t=(ta.value||'').trim();if(!t){thanks();return}
        var base=Date.now(),taps=[];
        for(var i=0;i<t.length&&taps.length<4;i+=160)taps.push(['book-sug:'+ch,((base*10+taps.length)%0xffffffffffff).toString(16),0,t.slice(i,i+160)]);
        send(taps);set(key+':s','1');thanks();
      };
      el.querySelector('.n').onclick=thanks;
    }
    if(get(key)){done();return}
    el.innerHTML='<p>অধ্যায়টি পড়ে বইটি কি আপনার ভালো লেগেছে?</p><div class="b"><button type="button" class="y" data-v="1">হ্যাঁ</button><button type="button" data-v="0">না</button></div>';
    el.querySelectorAll('button').forEach(function(b){b.onclick=function(){
      var v=+b.getAttribute('data-v');
      send([['book-like:'+ch,'1',v,'']]);set(key,String(v));
      document.querySelectorAll(sel).forEach(function(x){if(x!==el)x.innerHTML='<p class="t">ধন্যবাদ! আপনার মত জমা হয়েছে।</p>'});suggest(v);
    }});
  });
})();
