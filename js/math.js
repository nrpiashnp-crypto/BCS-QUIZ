// Renders $…$ math in questions and explanations with KaTeX, loaded only when a page shows some.
(function(){
  var K='https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/',st=0,wait=[],t;
  function load(cb){
    if(st===2)return cb();wait.push(cb);if(st)return;st=1;
    var l=document.createElement('link');l.rel='stylesheet';l.href=K+'katex.min.css';document.head.appendChild(l);
    var a=document.createElement('script');a.src=K+'katex.min.js';a.onload=function(){
      var b=document.createElement('script');b.src=K+'contrib/auto-render.min.js';
      b.onload=function(){st=2;wait.splice(0).forEach(function(f){f()})};document.head.appendChild(b)};
    document.head.appendChild(a)}
  // শুধু দেখা যায় এমন লেখায় $…$ খোঁজা; <script>-এর ভেতরের ${…} টেমপ্লেট আগে ভুল করে KaTeX নামাত
  function hasMath(r){var w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode&&n.parentNode.nodeName;return p==='SCRIPT'||p==='STYLE'||p==='TEMPLATE'?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}}),n;
    while((n=w.nextNode()))if(/\$[^$\n]{1,120}\$/.test(n.nodeValue))return true;return false}
  function run(){
    var r=document.getElementById('view')||document.body;
    if(!hasMath(r))return;
    load(function(){obs.disconnect();
      renderMathInElement(r,{delimiters:[{left:'$$',right:'$$',display:false},{left:'$',right:'$',display:false}],throwOnError:false,ignoredClasses:['katex']});
      obs.observe(document.body,{childList:true,subtree:true})})}
  var obs=new MutationObserver(function(){clearTimeout(t);t=setTimeout(run,30)});
  function go(){obs.observe(document.body,{childList:true,subtree:true});run()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go();
})();
