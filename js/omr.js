/* Site background: a faint OMR answer sheet (black timing marks on the left, numbered rows of ক খ গ ঘ bubbles), drawn to fit the page. */
(function(){if(document.querySelector('.omr'))return;var box=document.createElement('div');box.className='omr';box.setAttribute('aria-hidden','true');document.body.insertBefore(box,document.body.firstChild);
var B='০১২৩৪৫৬৭৮৯',last='';
function bn(n){return String(n).replace(/\d/g,function(d){return B[d]})}
function draw(){var W=document.documentElement.clientWidth,H=Math.max(document.body.offsetHeight,innerHeight),mob=W<=700,
mx=mob?0:14,mw=mob?9:22,x0=mob?62:72,nc=Math.max(1,Math.floor((W-x0-130)/190)+1),rows=Math.ceil((H-20)/34),key=nc+'|'+rows+'|'+mob;
if(key===last)return;last=key;var h=rows*34+40,t='',i,c;
for(c=0;c<nc;c++){var x=x0+190*c;t+='<rect x="'+(x+2)+'" y="20" width="130" height="'+(rows*34)+'" fill="url(#ob)"/>';
for(i=0;i<rows;i++)t+='<text x="'+x+'" y="'+(42+34*i)+'" text-anchor="end" font-size="13">'+bn(c*rows+i+1)+'</text>'}
var bub='';for(i=0;i<4;i++)bub+='<circle cx="'+(16+32*i)+'" cy="17" r="11" stroke-width="1.3"/><text x="'+(16+32*i)+'" y="21.5" text-anchor="middle" font-size="11" stroke="none" fill="#c8326a">'+'কখগঘ'[i]+'</text>';
box.innerHTML='<svg width="'+W+'" height="'+h+'"><defs><pattern id="tm" width="'+mw+'" height="34" patternUnits="userSpaceOnUse" y="33"><rect width="'+mw+'" height="8" fill="#1b1b1b"/></pattern>'+
'<pattern id="ob" width="130" height="34" patternUnits="userSpaceOnUse" x="'+(x0+2)+'" y="20"><g fill="none" stroke="#c8326a">'+bub+'</g></pattern></defs>'+
'<rect x="'+mx+'" y="33" width="'+mw+'" height="'+(rows*34)+'" fill="url(#tm)"/><g opacity=".17" font-family="Noto Sans Bengali,sans-serif" fill="#c8326a">'+t+'</g></svg>'}
var q=0;function later(){if(!q)q=requestAnimationFrame(function(){q=0;draw()})}
draw();addEventListener('resize',later);addEventListener('load',later);
if('ResizeObserver' in window)new ResizeObserver(later).observe(document.body);})();

/* Loading: wherever a page shows "লোড হচ্ছে…", show a pencil filling an OMR bubble instead (the words stay under it). */
(function(){var PEN='<svg class="pen" viewBox="0 0 34 34" aria-hidden="true"><g transform="rotate(45 17 17)"><rect x="13" y="-2" width="8" height="24" fill="#e7b73a" stroke="#7a5a14" stroke-width=".8"/><rect x="13" y="-2" width="2.6" height="24" fill="#f3cc5e"/><rect x="13" y="-6" width="8" height="4.5" fill="#c8326a"/><rect x="12.6" y="-2.2" width="8.8" height="2.2" fill="#b9b9bf"/><path d="M13 22 L17 31 L21 22 Z" fill="#f1d9b0" stroke="#7a5a14" stroke-width=".8"/><path d="M15.6 28 L17 31 L18.4 28 Z" fill="#2a2a30"/></g></svg>';
function swap(el){if(el.dataset.omrLd||!/লোড (করা )?হচ্ছে/.test(el.textContent)||el.children.length)return;var t=el.textContent.trim();el.dataset.omrLd=1;
el.innerHTML='<span class="omr-ld" role="status"><span class="lb" aria-hidden="true"><span class="b">ক</span><span class="b">খ</span><span class="b g">গ</span><span class="b">ঘ</span>'+PEN+'</span><span>'+t+'</span></span>'}
function scan(root){if(root.nodeType!==1)return;if(root.matches('p'))swap(root);root.querySelectorAll&&root.querySelectorAll('p').forEach(swap)}
scan(document.body);
if('MutationObserver' in window)new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(scan)})}).observe(document.body,{childList:true,subtree:true});})();
/* results: point to the explanations below the marks (a button under the score, a floating pill until they come into view) */
(function(){var H=/উত্তর ও ব্যাখ্যা/,pill=null;
function heads(){return [].filter.call(document.querySelectorAll('h2'),function(h){return H.test(h.textContent)})}
function go(h){h.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
function wire(h){if(h.dataset.omrJump)return;h.dataset.omrJump=1;if(!h.id)h.id='exp-'+Math.random().toString(36).slice(2,7);
 var box=h.parentNode,sb=box.querySelector('#scorebox')||box.querySelector('.score');if(!sb||sb.parentNode!==box)return;
 var a=document.createElement('a');a.className='exp-jump';a.href='#'+h.id;a.innerHTML='<span aria-hidden="true">↓</span> প্রতিটি প্রশ্নের ব্যাখ্যাসহ উত্তর নিচে দেখুন';
 a.onclick=function(e){e.preventDefault();go(h)};h._j=[sb,a];sb.insertAdjacentElement('afterend',a)}
function tick(){var hs=heads();hs.forEach(wire);hs.forEach(function(h){var j=h._j;if(j&&j[0].nextElementSibling!==j[1])j[0].insertAdjacentElement('afterend',j[1])});var h=hs.filter(function(x){return x.offsetParent})[0];
 var show=h&&h.getBoundingClientRect().top>innerHeight-40;
 var cx=document.querySelector('.chx:not([hidden])'),cr=cx&&cx.getBoundingClientRect();if(cr&&cr.top<innerHeight&&cr.bottom>0)show=false;
 if(show&&!pill){pill=document.createElement('button');pill.type='button';pill.className='exp-pill';pill.innerHTML='<span aria-hidden="true">↓</span> ব্যাখ্যা দেখুন';document.body.appendChild(pill)}
 if(pill){if(pill.hidden!==!show)pill.hidden=!show;pill.onclick=function(){var t=heads().filter(function(x){return x.offsetParent})[0];if(t)go(t)}}
 if(h&&!document.body.hasAttribute('data-noch'))ch()}
/* বন্ধুকে চ্যালেঞ্জ: ফল দেখা গেলে তবেই js/challenge.js আসে */
var chs=0;function ch(){if(window.LBC)return LBC.scan();if(chs)return;chs=document.createElement('script');chs.src='/js/challenge.js?v=2';chs.defer=true;document.head.appendChild(chs)}
var q=0;function later(){if(!q){q=1;requestAnimationFrame(function(){q=0;tick()})}}
addEventListener('scroll',later,{passive:true});addEventListener('resize',later);
if('MutationObserver' in window)new MutationObserver(later).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
tick();})();
