/* সাপ্তাহিক কাজের ছবি (social-review খ-৩, ঙ-৯): ফোনেই canvas-এ আঁকা, সার্ভারে কিছু যায় না।
   ছবিতে শুধু কাজ: শেষ ৭ দিনে কত দিন পড়া, কটা পরীক্ষা। নম্বর, মেধাক্রম, সময় কখনো নয়।
   নাম নিজে বাছেন (ডিফল্ট নাম ছাড়া)। "আজ" পাতা বোতাম চাপলে তবেই এই ফাইল আনে। */
(function(){
'use strict';
var bn=function(x){return String(x).replace(/\d/g,function(d){return '০১২৩৪৫৬৭৮৯'[d]})};
var MON=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
var WS=['রবি','সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি'];
var NAVY='#13294b',PINK='#c8326a',INK='#1d1f21',MUT='#5d5a55',PAPER='#f8f5ee',CARD='#fffdf7';
var SANS="'Noto Sans Bengali',sans-serif",SERIF="'Tiro Bangla',serif",MARK="'Lyanna Wordmark','Tiro Bangla',serif";
function P(s){return s.split('-').map(Number)}
function wd(s){var p=P(s);return new Date(Date.UTC(p[0],p[1]-1,p[2])).getUTCDay()}
function range(a,b){var x=P(a),y=P(b);return x[1]===y[1]?bn(x[2])+'–'+bn(y[2])+' '+MON[y[1]-1]:bn(x[2])+' '+MON[x[1]-1]+' – '+bn(y[2])+' '+MON[y[1]-1]}
function fit(c,t,font,size,max){do{c.font=font.replace('S',size+'px')}while(c.measureText(t).width>max&&(size-=2)>20);return size}
function logo(){return new Promise(function(ok){var i=new Image();i.onload=function(){ok(i)};i.onerror=function(){ok(null)};i.src='/img/logo/li-mark.svg'})}

function draw(cv,x,name,img){
  var W=1080,H=1080,c=cv.getContext('2d');cv.width=W;cv.height=H;
  var on=x.days.filter(function(d){return d.on}).length,tests=x.days.reduce(function(s,d){return s+d.tests},0);
  c.fillStyle=PAPER;c.fillRect(0,0,W,H);
  // OMR-কার্ড: নেভি দাগ, পেছনে গোলাপি ছায়া
  c.fillStyle=PINK;c.fillRect(78,78,940,940);
  c.fillStyle=CARD;c.fillRect(62,62,940,940);
  c.strokeStyle=NAVY;c.lineWidth=5;c.strokeRect(62,62,940,940);
  c.textAlign='left';c.textBaseline='alphabetic';
  if(img)c.drawImage(img,120,112,62,81);
  c.fillStyle=NAVY;c.font='600 48px '+MARK;c.fillText('লিয়ানা বুকস',img?198:120,172);
  c.textAlign='right';c.fillStyle=MUT;c.font='34px '+SANS;c.fillText(range(x.days[0].d,x.days[x.days.length-1].d),944,170);
  c.fillStyle=PINK;c.fillRect(120,222,824,3);
  // মূল কথা
  c.textAlign='center';c.fillStyle=INK;
  var h='শেষ ৭ দিনে '+bn(on)+' দিন পড়েছি';fit(c,h,'600 S '+SANS,78,824);c.fillText(h,540,350);
  // ৭ বাবল, OMR-এর মতো
  var r=44,gap=(824-14*r)/6;
  x.days.forEach(function(d,i){
    var cx=120+r+i*(2*r+gap),cy=470;
    c.beginPath();c.arc(cx,cy,r,0,7);
    if(d.on){c.fillStyle='#1d1d1f';c.fill()}else{c.lineWidth=4;c.strokeStyle=PINK;c.stroke()}
    c.fillStyle=MUT;c.font='30px '+SANS;c.fillText(WS[wd(d.d)],cx,cy+r+46);
  });
  c.fillStyle=NAVY;
  var t=tests?bn(tests)+'টি পরীক্ষা দিয়েছি':'সাইটে পড়েছি';fit(c,t,'600 S '+SANS,64,824);c.fillText(t,540,710);
  c.fillStyle=MUT;c.font='34px '+SANS;c.fillText(on>=5?'৭ দিনে ৫ দিনের লক্ষ্য পূরণ হয়েছে':'লক্ষ্য: ৭ দিনে ৫ দিন',540,772);
  if(name){c.fillStyle=INK;fit(c,'— '+name,'44px '+SERIF,44,824);c.fillText('— '+name,540,856)}
  c.fillStyle=PINK;c.fillRect(120,900,824,2);
  c.fillStyle=NAVY;c.font='600 34px '+SANS;c.fillText('lyannabooks.com · বিসিএস ও চাকরির সব পরীক্ষা ফ্রি',540,958);
}

window.LYWeek=function(box,x,nick){
  var name='',img=null,cv=document.createElement('canvas');
  box.innerHTML='<p class="sm mut">ছবিতে শুধু কত দিন পড়লেন আর কটা পরীক্ষা দিলেন, নম্বর বা সময় নয়। ছবি এই ফোনেই তৈরি হয়, কোথাও জমা হয় না।</p>'+
    '<img id="wkimg" alt="শেষ ৭ দিনের কাজের ছবি" style="width:100%;height:auto;display:block;margin:8px 0;border:1px solid #e6d3d9">'+
    (nick?'<label class="sm" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="wknm"> ছবিতে নাম দিন: '+nick.replace(/[&<>"']/g,'')+'</label>':'')+
    '<div class="row"><button class="btn" id="wksh">ফেসবুকে দিন</button><button class="btn line" id="wkdl">ছবি নামান</button></div><p class="sm mut" id="wkmsg"></p>';
  var $=function(id){return document.getElementById(id)},msg=function(t){$('wkmsg').textContent=t};
  function paint(){draw(cv,x,name,img);$('wkimg').src=cv.toDataURL('image/png')}
  function file(){return new Promise(function(ok){cv.toBlob(function(b){ok(b?new File([b],'lyanna-7-din.png',{type:'image/png'}):null)},'image/png')})}
  function save(f){var u=URL.createObjectURL(f),a=document.createElement('a');a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(u)},4000);msg('ছবি ফোনে নেমেছে (Downloads)। ফেসবুকে পোস্ট লিখে ছবিটা যোগ করুন।')}
  if($('wknm'))$('wknm').onchange=function(){name=this.checked?nick:'';paint()};
  $('wkdl').onclick=function(){file().then(function(f){if(f)save(f)})};
  $('wksh').onclick=function(){file().then(function(f){
    if(!f)return;
    if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],text:'আমার শেষ ৭ দিনের পড়া · lyannabooks.com'}).then(function(){msg('')},function(e){if(!e||e.name!=='AbortError')save(f)});
    else save(f);
  })};
  var fs=document.fonts;
  Promise.all([logo(),fs?Promise.all(['600 40px "Noto Sans Bengali"','40px "Noto Sans Bengali"','40px "Tiro Bangla"','600 40px "Lyanna Wordmark"'].map(function(f){return fs.load(f,'লিয়ানা').catch(function(){})})):null])
    .then(function(a){img=a[0];paint()});
};
})();
