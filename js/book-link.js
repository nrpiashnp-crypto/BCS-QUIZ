/* Shared book link under every quiz explanation (.exp), plus comfortable reading for long explanations.
   Include once per quiz page: <script src="/js/book-link.js" data-kind="science|jobs" data-chapter="আলো" defer></script> (data-chapter optional) */
(function(){
  var me=document.currentScript, kind=(me&&me.dataset.kind)||'science', ch=me&&me.dataset.chapter;
  var text=kind==='jobs'
    ?'লিয়ানা বুকস-এর বই: “লিয়ানা বিসিএস বিজ্ঞান” · দেখুন →'
    :ch?'এই বিষয় “লিয়ানা বিসিএস বিজ্ঞান” বইয়ের '+ch+' অধ্যায়ে বিস্তারিত · বইটি দেখুন →'
    :'এই বিষয় “লিয়ানা বিসিএস বিজ্ঞান” বইয়ে বিস্তারিত · বইটি দেখুন →';
  var from=location.pathname.split('/').filter(Boolean)[0]||'home';
  var st=document.createElement('style');
  st.textContent='.exp{font-size:16px;line-height:1.75}'+
    '.exp .bl{display:block;margin-top:8px;font-size:12.5px;color:var(--muted,#5f6366);text-decoration:none;opacity:.85}'+
    '.exp .bl:hover{color:var(--accent,#13294b);text-decoration:underline}';
  document.head.appendChild(st);
  function add(el){
    if(!el.classList||!el.classList.contains('exp')||el.querySelector('.bl'))return;
    var a=document.createElement('a');a.className='bl';a.href='/book/?from='+from;a.textContent=text;el.appendChild(a);
  }
  function scan(root){if(root.nodeType!==1)return;add(root);root.querySelectorAll&&root.querySelectorAll('.exp').forEach(add)}
  new MutationObserver(function(ms){ms.forEach(function(m){
    m.addedNodes.forEach(scan);
    if(m.type==='childList'&&m.target.classList&&m.target.classList.contains('exp'))add(m.target);
  })}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',function(){scan(document.body)});
})();
