/* সাইটে কাজের সময় ("আছি"): শুধু লগইন করা থাকলে। নিজে-চাপা ঘড়ি নয়; পাতা সামনে থাকলে আর শেষ ২ মিনিটে ছোঁয়া, স্ক্রল বা চাপ
   হলে প্রতি ১৫ সেকেন্ড গোনা হয়। জমা যায় প্রতি ৫ মিনিটে একবার আর পাতা ছাড়ার সময় (POST /api/here {s}); সার্ভার আগের
   জমার পর যত সময় গেছে তার বেশি মানে না, তাই কয়েকটা ট্যাব খোলা থাকলেও সময় দ্বিগুণ হয় না। সময় শুধু নিজে দেখেন (/today/)।
   পাতায় আলাদা করে বসাতে হয় না: js/account.js আর plan.js নিজে এটা আনে। ড্যাশবোর্ড/অ্যাডমিন পাতায় গোনা হয় না। */
(function(){
  if(window.LBH)return;window.LBH=1;
  var u=null;try{u=JSON.parse(localStorage.getItem('lb:u')||'null')}catch(e){}
  if(!u)return;
  if(/^\/(today|account|admin|myjobs)\//.test(location.pathname))return;
  var TICK=15e3,SEND=300e3,IDLE=120e3,acc=0,act=Date.now(),sent=Date.now();
  var touch=function(){act=Date.now()};
  ['pointerdown','keydown','scroll','touchstart','wheel'].forEach(function(e){addEventListener(e,touch,{passive:true,capture:true})});
  var send=function(){
    if(acc<5)return;
    var b=JSON.stringify({s:Math.min(acc,300)});acc=0;sent=Date.now();
    try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/here',new Blob([b],{type:'application/json'})))return}catch(e){}
    try{fetch('/api/here',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:b}).catch(function(){})}catch(e){}
  };
  setInterval(function(){
    if(document.visibilityState==='visible'&&Date.now()-act<IDLE)acc+=TICK/1e3;
    if(Date.now()-sent>=SEND)send();
  },TICK);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')send()});
  addEventListener('pagehide',send);
})();
