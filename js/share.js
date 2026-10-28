/* ফলাফল শেয়ার: অধ্যায়-পরীক্ষার ফল দেখানোর সময় "ফলাফল শেয়ার করুন" বোতাম যোগ করে।
   বোতাম চাপলে ১০৮০×১০৮০ ছবি বানায় (অধ্যায়, নম্বর, সঠিক/ভুল, সাইটের লিংক) আর ফোনের শেয়ার মেনু খোলে;
   শেয়ার মেনু না থাকলে ছবিটা ডাউনলোড হয়। পাতার DOM থেকেই পড়ে: h1, #scorebox .big, #scorebox .stats। */
(function(){
  const $=id=>document.getElementById(id);
  const res=$('result'),box=$('scorebox');
  if(!res||!box)return;
  const NAVY='#13294b',GOLD='#e0b45c',SOFT='#c9d2e2';
  const chapter=()=>((document.querySelector('h1')||{}).textContent||'').split(':')[0].trim();
  const sub=()=>((document.querySelector('header .book')||{}).textContent||'বিসিএস প্রস্তুতি').trim();
  const url=location.origin+location.pathname;

  function logo(){return new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src='/img/logo/final-onnavy-transparent.svg'})}
  function fit(ctx,text,font,size,max){do{ctx.font=`${size}px ${font}`;size-=2}while(ctx.measureText(text).width>max&&size>20);return ctx.font}

  async function draw(){
    await document.fonts.ready;
    const W=1080,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d');
    x.fillStyle=NAVY;x.fillRect(0,0,W,W);
    x.strokeStyle='rgba(224,180,92,.45)';x.lineWidth=3;x.strokeRect(40,40,W-80,W-80);
    const L=await logo();if(L)x.drawImage(L,W/2-130,96,260,260*L.height/L.width);
    x.textAlign='center';x.fillStyle='#fff';
    x.font=fit(x,chapter(),"'Tiro Bangla',serif",76,900);x.fillText(chapter(),W/2,470);
    x.fillStyle=SOFT;x.font="34px 'Noto Sans Bengali',sans-serif";x.fillText(sub(),W/2,530);
    const big=(box.querySelector('.big')||{}).textContent||'';
    x.fillStyle=GOLD;x.font=fit(x,big,"'Noto Sans Bengali',sans-serif",170,900);x.fillText(big,W/2,730);
    const st=[...box.querySelectorAll('.stats span')].slice(0,3).map(s=>s.textContent).join('  ·  ');
    x.fillStyle='#fff';x.font=fit(x,st,"'Noto Sans Bengali',sans-serif",38,900);x.fillText(st,W/2,810);
    x.fillStyle=SOFT;x.font="34px 'Noto Sans Bengali',sans-serif";x.fillText('তুমিও দাও, সম্পূর্ণ ফ্রি:',W/2,930);
    x.fillStyle=GOLD;x.font="600 40px 'Noto Sans Bengali',sans-serif";x.fillText(url.replace(/^https?:\/\//,''),W/2,985);
    return new Promise(ok=>c.toBlob(ok,'image/png'));
  }

  async function share(btn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='ছবি তৈরি হচ্ছে…';
    try{
      const blob=await draw(),file=new File([blob],'lyanna-result.png',{type:'image/png'});
      const text=`${chapter()} অধ্যায়ের পরীক্ষায় পেলাম ${(box.querySelector('.big')||{}).textContent||''}। তুমিও দাও, ফ্রি:`;
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],text:text+' '+url}).catch(()=>{});
      }else{
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),4000);
        try{await navigator.clipboard.writeText(text+' '+url)}catch(e){}
        btn.textContent='ছবি ডাউনলোড হয়েছে, লিংক কপি হয়েছে';btn.disabled=false;setTimeout(()=>btn.textContent=old,3500);return;
      }
    }catch(e){}
    btn.disabled=false;btn.textContent=old;
  }

  function add(){
    if($('sharebtn'))return;
    const row=res.querySelector('.btns');if(!row)return;
    const b=document.createElement('button');b.type='button';b.className='btn ghost';b.id='sharebtn';b.textContent='ফলাফল শেয়ার করুন';
    b.onclick=()=>share(b);row.appendChild(b);
  }
  new MutationObserver(()=>{if(!res.hidden)add()}).observe(res,{attributes:true,attributeFilter:['hidden']});
})();
