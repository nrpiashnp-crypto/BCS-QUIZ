/* Site background: a faint OMR answer sheet (black timing marks on the left, numbered rows of ক খ গ ঘ bubbles), drawn to fit the page. */
(function(){if(document.querySelector('.omr'))return;var box=document.createElement('div');box.className='omr';box.setAttribute('aria-hidden','true');document.body.insertBefore(box,document.body.firstChild);
var B='০১২৩৪৫৬৭৮৯',last='';
function bn(n){return String(n).replace(/\d/g,function(d){return B[d]})}
function draw(){var W=document.documentElement.clientWidth,H=document.body.offsetHeight,mob=W<=700,
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
