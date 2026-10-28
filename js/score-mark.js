/* খাতার মতো নম্বর: #scorebox .big-এর "প্রাপ্ত / মোট" লেখাকে উপরে-নিচে সাজিয়ে লাল কালির গোল দাগে ঘিরে দেয়।
   পাতায় একবার: <script src="/js/score-mark.js" defer></script>। স্কোর বক্স পরে তৈরি হলেও (চলমান সিরিজ) কাজ করে।
   textContent আগের মতোই "প্রাপ্ত / মোট" থাকে, তাই শেয়ার কার্ড (js/share.js) একই নম্বর পড়ে। */
(function(){
  var st=document.createElement('style');
  st.textContent=
    '#scorebox .big.sm-on{display:flex;justify-content:center;margin:2px 0 4px;font-size:inherit;line-height:1}'+
    '.sm{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:150px;height:150px;transform:rotate(-6deg);'+
      'font-family:"Noto Sans Bengali",system-ui,sans-serif;font-weight:700;color:#c62828;font-variant-numeric:tabular-nums}'+
    '.sm svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}'+
    '.sm .bg{fill:#fffaf0;filter:drop-shadow(0 4px 10px rgba(0,0,0,.18))}'+
    '.sm .ink{fill:none;stroke:#c62828;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:520;stroke-dashoffset:520;animation:smdraw .9s ease-out .15s forwards}'+
    '.sm b,.sm i{position:relative;font-style:normal;font-weight:700;line-height:1.05}'+
    '.sm b{font-size:var(--smn,40px)}.sm i{font-size:var(--smd,30px)}'+
    '.sm u{position:relative;display:block;width:68%;height:3.5px;margin:5px 0 6px;border-radius:3px;background:#c62828;transform:rotate(-3deg);text-decoration:none}'+
    '.sm s{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'+
    '@keyframes smdraw{to{stroke-dashoffset:0}}'+
    '@media (prefers-reduced-motion:reduce){.sm .ink{animation:none;stroke-dashoffset:0}}';
  document.head.appendChild(st);
  // হাতে আঁকা গোল: পুরোপুরি বন্ধ নয়, শেষটা একটু উপর দিয়ে চলে যায়
  var RING='<svg viewBox="0 0 150 150" aria-hidden="true"><circle class="bg" cx="76" cy="76" r="72"/>'+
    '<path class="ink" d="M40 30 C70 6 128 14 140 58 C152 102 118 140 72 139 C30 138 6 104 12 70 C17 42 44 22 80 20 C96 19 108 23 116 28"/></svg>';
  function mark(big){
    var t=big.textContent.trim(),m=t.match(/^(.+?)\s*\/\s*(.+)$/);if(!m)return;
    var n=m[1].trim(),d=m[2].trim();
    big.classList.add('sm-on');
    big.innerHTML='<span class="sm" role="img" aria-label="'+n+' / '+d+'">'+RING+'<b>'+n+'</b><s> / </s><u></u><i>'+d+'</i></span>';
    var sm=big.firstChild;
    if(n.length>4)sm.style.setProperty('--smn',(n.length>5?28:34)+'px');
    if(d.length>3)sm.style.setProperty('--smd','24px');
  }
  function scan(){var b=document.querySelector('#scorebox .big:not(.sm-on)');if(b)mark(b)}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);
})();
