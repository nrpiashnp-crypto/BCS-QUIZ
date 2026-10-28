/* অ্যাপ: অফলাইনের জন্য /sw.js চালু করে। Android/Chrome-এ ইনস্টল করা গেলে পাতার [data-install] বোতামগুলো দেখায়। */
(function(){
  if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});
  var ask=null;
  function btns(show){document.querySelectorAll('[data-install]').forEach(function(b){b.hidden=!show})}
  addEventListener('beforeinstallprompt',function(e){e.preventDefault();ask=e;btns(true)});
  addEventListener('appinstalled',function(){ask=null;btns(false)});
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-install]');if(!b||!ask)return;
    ask.prompt();ask.userChoice.then(function(){ask=null;btns(false)});
  });
})();
