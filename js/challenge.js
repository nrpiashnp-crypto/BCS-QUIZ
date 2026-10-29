/* বন্ধুকে চ্যালেঞ্জ: যেকোনো পরীক্ষার ফলের নিচে একটা কার্ড। নাম লিখে চাপলে "উত্তর ও ব্যাখ্যা" থেকে প্রশ্ন, সঠিক উত্তর আর
   নিজের দাগ পড়ে সার্ভারে পাঠায় (POST /api/ch), সার্ভার নম্বর গোনে আর একটা ছোট লিংক (/c/<id>) দেয়; বন্ধু সেটা খুলে একই প্রশ্নে পরীক্ষা দেয়।
   js/omr.js ফলের পাতা দেখলে এটা নিজে থেকে আনে আর LBC.scan() ডাকে। challenge/index.html-ও LBC.share() ব্যবহার করে। */
(function(){
var B='০১২৩৪৫৬৭৮৯';
function bn(n){return String(n).replace(/\d/g,function(d){return B[d]})}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function myName(){var n=ls('ch:name');if(n)return n;try{var u=JSON.parse(ls('lb:u')||'null');if(u&&u.name)return u.name.split(' ')[0]}catch(e){}return ''}
var ALLOW={B:1,I:1,U:1,SUB:1,SUP:1,BR:1,TABLE:1,THEAD:1,TBODY:1,TR:1,TD:1,TH:1,SPAN:1,P:1,DIV:1,SMALL:1,STRONG:1,EM:1};
/* শুধু সাধারণ লেখার ট্যাগ, কোনো অ্যাট্রিবিউট নয় (সার্ভারও একই কাজ করে, এটা দ্বিতীয় পাহারা) */
function clean(node){var out=document.createElement('div');(function walk(src,dst){[].forEach.call(src.childNodes,function(n){
  if(n.nodeType===3)dst.appendChild(document.createTextNode(n.nodeValue));
  else if(n.nodeType===1){if(/^(SCRIPT|STYLE|TEMPLATE)$/.test(n.tagName))return;if(ALLOW[n.tagName]){var e=document.createElement(n.tagName.toLowerCase());dst.appendChild(e);walk(n,e)}else walk(n,dst)}})})(node,out);return out.innerHTML.trim()}
function safe(html){var d=new DOMParser().parseFromString('<body>'+(html||''),'text/html');return clean(d.body)}

/* পাতার শিরোনাম থেকে পরীক্ষার নাম: "শব্দ: বিসিএস অনলাইন পরীক্ষা" → "শব্দ", "টাস্ক ১: শুরুর যাচাই ১ · পেট্রোবাংলা" পুরোটাই */
function title(){var ps=document.title.split(' · ').map(function(x){return x.trim()}).filter(function(x){return x&&!/লিয়ানা বুকস/.test(x)}),f=ps[0]||'';
  if(/:.*পরীক্ষা/.test(f))f=f.split(':')[0].trim();var t=[f].concat(ps.slice(1,2)).filter(Boolean).join(' · ');
  var h=document.querySelector('h1');return (t||h&&h.textContent.trim()||'পরীক্ষা').slice(0,100)}
/* ফলের তালিকা থেকে প্রশ্ন পড়া: .qt = প্রশ্ন, .opt = বিকল্প (.right সঠিক, .wrong নিজের ভুল দাগ), .exp = ব্যাখ্যা */
function read(list){var qs=[],picks=[];
  [].forEach.call(list.querySelectorAll('section.q'),function(s){
    var qt=s.querySelector('.qt'),os=[].slice.call(s.querySelectorAll('.opt'));if(!qt||os.length<2)return;
    var a=-1,w=-1;os.forEach(function(o,j){if(o.classList.contains('right'))a=j;if(o.classList.contains('wrong'))w=j});if(a<0)return;
    var q=qt.cloneNode(true);[].forEach.call(q.querySelectorAll('.src,.pend,.ref,a,button'),function(x){x.remove()});
    var o=os.map(function(b){var c=b.cloneNode(true),k=c.querySelector('.k');if(k)k.remove();return clean(c)});
    var ex=s.querySelector('.exp'),e='';
    if(ex){var c=ex.cloneNode(true);[].forEach.call(c.querySelectorAll('.ok,.no,.skip,.src,.bl,a,button'),function(x){x.remove()});e=clean(c).replace(/^\s*সঠিক উত্তর:[^।]*।\s*/,'')}
    var mark=w>=0?w:ex&&ex.querySelector('.ok')?a:-1;
    qs.push({q:clean(q),o:o,a:a,e:e});picks.push(mark)});
  return {qs:qs,picks:picks}}

function link(id){return location.origin+'/c/'+id}
/* শেয়ার বোতামগুলো: হোয়াটসঅ্যাপ, মেসেঞ্জার/ফেসবুক, কপি, আর ফোনের নিজের শেয়ার মেনু */
function share(box,id,text){var u=link(id),msg=text+'\n'+u;
  box.innerHTML='<p class="chx-link"><span>'+u.replace(/^https?:\/\//,'')+'</span></p><div class="chx-btns">'+
   '<a class="chx-b wa" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent(msg)+'">হোয়াটসঅ্যাপ</a>'+
   '<a class="chx-b fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(u)+'">ফেসবুক</a>'+
   '<button type="button" class="chx-b cp">লিংক কপি</button>'+(navigator.share?'<button type="button" class="chx-b mo">আরও…</button>':'')+'</div>';
  var cp=box.querySelector('.cp');cp.onclick=function(){var done=function(){cp.textContent='কপি হয়েছে ✓';setTimeout(function(){cp.textContent='লিংক কপি'},2000)};
   if(navigator.clipboard)navigator.clipboard.writeText(msg).then(done,function(){prompt('লিংকটা কপি করুন',u)});else prompt('লিংকটা কপি করুন',u)};
  var mo=box.querySelector('.mo');if(mo)mo.onclick=function(){navigator.share({title:'লিয়ানা বুকস চ্যালেঞ্জ',text:text,url:u}).catch(function(){})};
  box.hidden=false}
function post(body){return fetch('/api/ch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.id)throw j;return j})})}
function fail(e){return e&&e.error==='slow'?'এক ঘণ্টায় অনেকগুলো চ্যালেঞ্জ হয়ে গেছে, একটু পরে আবার চেষ্টা করুন।':e&&e.error==='bad'?'এই পরীক্ষা থেকে চ্যালেঞ্জ বানানো গেল না।':'ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'}

function card(list){var el=document.createElement('div');el.className='chx';
  el.innerHTML='<div class="chx-h"><span class="chx-i" aria-hidden="true">⚔</span><div><b>বন্ধুকে চ্যালেঞ্জ করুন</b><small>এই প্রশ্নগুলোতেই বন্ধু আপনাকে হারাতে পারবে? লিংক পাঠান, লগইন ছাড়াই দিতে পারবে।</small></div></div>'+
   '<form class="chx-f"><label><span>আপনার নাম</span><input name="n" maxlength="24" autocomplete="given-name" placeholder="যেমন: রাহিম"></label><button class="chx-go" type="submit">লিংক বানান</button></form><p class="chx-e" hidden></p><div class="chx-s" hidden></div>';
  var f=el.querySelector('form'),inp=f.n,err=el.querySelector('.chx-e'),go=el.querySelector('.chx-go');inp.value=myName();
  f.onsubmit=function(ev){ev.preventDefault();var name=inp.value.trim();if(!name){inp.focus();return}ls('ch:name',name);
   var d=read(list);if(d.qs.length<3){err.textContent='এই পরীক্ষা থেকে চ্যালেঞ্জ বানানো গেল না।';err.hidden=false;return}
   var ok=d.qs.reduce(function(s,q,i){return s+(d.picks[i]===q.a?1:0)},0),sec=+(el.dataset.sec||0);
   go.disabled=true;go.textContent='বানানো হচ্ছে…';err.hidden=true;
   post({name:name,title:title(),src:location.pathname+location.hash,qs:d.qs,picks:d.picks,sec:sec}).then(function(j){
     ls('ch:own:'+j.id,'1');f.hidden=true;
     el.querySelector('.chx-h small').textContent='লিংক তৈরি। পাঠিয়ে দিন, কে বেশি পায় দেখা যাবে।';
     share(el.querySelector('.chx-s'),j.id,name+' আপনাকে চ্যালেঞ্জ করেছে! '+title()+'-এর '+bn(j.n)+'টি প্রশ্নে সে পেয়েছে '+bn(j.ok)+'টি সঠিক। আপনি পারবেন?')
   },function(e){go.disabled=false;go.textContent='লিংক বানান';err.textContent=fail(e);err.hidden=false})};
  return el}

function key(list){var q=list.querySelector('section.q .qt');return list.children.length+'|'+(q?q.textContent.slice(0,40):'')}
/* প্রতিটি দেখা যাওয়া "উত্তর ও ব্যাখ্যা" অংশে একটা কার্ড; নতুন পরীক্ষা হলে কার্ড নতুন করে বসে */
function scan(){if(document.body.hasAttribute('data-noch'))return;
  [].forEach.call(document.querySelectorAll('h2'),function(h){if(!/উত্তর ও ব্যাখ্যা/.test(h.textContent)||!h.offsetParent)return;
   var box=h.parentNode,list=box.querySelector('#rlist')||h.nextElementSibling,sb=box.querySelector('#scorebox')||box.querySelector('.score');
   if(!list||!sb||sb.parentNode!==box||!list.querySelector('section.q .opt.right'))return;
   var k=key(list),c=box.querySelector(':scope > .chx');if(c&&c.dataset.k===k)return;if(c)c.remove();
   c=card(list);c.dataset.k=k;var sec=(sb.textContent.match(/([০-৯\d]+)\s*মিনিট\s*(?:([০-৯\d]+)\s*সেকেন্ড)?/)||[]);
   if(sec[1]){var en=function(x){return +String(x||0).replace(/[০-৯]/g,function(d){return B.indexOf(d)})};c.dataset.sec=en(sec[1])*60+en(sec[2])}
   var j=sb.nextElementSibling&&sb.nextElementSibling.classList.contains('exp-jump')?sb.nextElementSibling:sb;j.insertAdjacentElement('afterend',c)})}
window.LBC={scan:scan,share:share,post:post,fail:fail,safe:safe,name:myName,store:ls,bn:bn};
scan();})();
