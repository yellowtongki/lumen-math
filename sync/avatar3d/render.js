const fs=require('fs'); const { chromium } = require('/home/user/lumen-math/node_modules/playwright');
const DIR=__dirname;
const SK_M='#f2c49a', SK_F='#f6d3b0';
const CFG={
  soccer_m:{ skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', number:'10', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#1b1f27', prop:'ball', badge:'전사', armFwd:[0.15,-0.1] },
  soccer_f:{ skin:SK_F, hair:'bun', hairC:'#5b3a1e', top:'#e0463c', stripes:'#f8fafc', number:'7', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#f8fafc', prop:'ball', armFwd:[0.15,-0.1] },
  doctor_m:{ skin:SK_M, hair:'short', hairC:'#1f2937', top:'#60a5fa', coat:'#f8fafc', shirt:'#60a5fa', sleeve:'#f8fafc', leg:'#334155', shoe:'#1b1f27', stetho:true, glasses:true },
  doctor_f:{ skin:SK_F, hair:'long', hairC:'#3b2a1e', top:'#60a5fa', coat:'#f8fafc', shirt:'#60a5fa', sleeve:'#f8fafc', leg:'#334155', shoe:'#1b1f27', stetho:true },
  gamer_m:{ skin:SK_M, hair:'short', hairC:'#111827', top:'#1e293b', hoodie:true, hood:'#1e293b', sleeve:'#1e293b', leg:'#0f172a', shoe:'#f8fafc', headset:true, led:'#22d3ee' },
  gamer_f:{ skin:SK_F, hair:'long', hairC:'#7c2d12', top:'#4c1d95', hoodie:true, hood:'#4c1d95', sleeve:'#4c1d95', leg:'#0f172a', shoe:'#f8fafc', headset:true, led:'#f472b6' },
  codi:{ skin:'#f2d6b3', hair:'short', hairC:'#3b2a6e', hat:'#7c4bd6', top:'#5b36a8', sleeve:'#5b36a8', leg:'#3b2a6e', robe:'#5b36a8', belt:'#c58a12', shoe:'#1b1f27', glasses:true, prop:'scroll', armFwd:[-0.5,0], mode:'happy' },
  golem:{ golem:true, yaw:-0.4 },
  soccer_happy:{ skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', number:'10', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#1b1f27', mode:'happy', yaw:0 },
  soccer_worried:{ skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', number:'10', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#1b1f27', mode:'worried', yaw:0 },
  soccer_bust:{ bust:true, skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', yaw:-0.35 },
  soccer_bust_happy:{ bust:true, mode:'happy', skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', yaw:-0.35 },
  codi_bust:{ bust:true, mode:'happy', skin:'#f2d6b3', hair:'short', hairC:'#3b2a6e', hat:'#7c4bd6', top:'#5b36a8', sleeve:'#5b36a8', glasses:true, yaw:-0.3 },
  doctor_f_bust:{ bust:true, skin:SK_F, hair:'long', hairC:'#3b2a1e', top:'#60a5fa', coat:'#f8fafc', shirt:'#60a5fa', sleeve:'#f8fafc', yaw:-0.35 },
  gamer_m_bust:{ bust:true, skin:SK_M, hair:'short', hairC:'#111827', top:'#1e293b', hoodie:true, hood:'#1e293b', sleeve:'#1e293b', headset:true, led:'#22d3ee', yaw:-0.35 },
  soccer_f_bust:{ bust:true, skin:SK_F, hair:'bun', hairC:'#5b3a1e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', yaw:-0.35 },
  /* ── 얼굴 고르기 (같은 몸, 얼굴·머리·피부만 다름) ── */
  face1:{ bust:true, yaw:-0.3, skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'oval', mouth:'smile' } },
  face2:{ bust:true, yaw:-0.3, skin:'#f6d3b0', hair:'ponytail', hairC:'#5b3a1e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'round', mouth:'grin' } },
  face3:{ bust:true, yaw:-0.3, skin:'#c98d5a', hair:'spiky', hairC:'#1d4ed8', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'sharp', mouth:'cat', blush:false } },
  face4:{ bust:true, yaw:-0.3, skin:'#fbe3c8', hair:'curly', hairC:'#b3261e', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'round', mouth:'o', freckles:true } },
  face5:{ bust:true, yaw:-0.3, skin:'#a8703f', hair:'bob', hairC:'#111827', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'sleepy', mouth:'smile' }, earring:true },
  face6:{ bust:true, yaw:-0.3, skin:SK_M, hair:'long', hairC:'#c58a12', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'oval', mouth:'grin', eyeC:'#1d4ed8' } },
  face7:{ bust:true, yaw:-0.3, skin:'#f6d3b0', hair:'bun', hairC:'#7c4bd6', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'sharp', mouth:'smile' }, glasses:true },
  face8:{ bust:true, yaw:-0.3, skin:'#c98d5a', hair:'short', hairC:'#111827', top:'#e0463c', stripes:'#f8fafc', sleeveTop:'#e0463c', face:{ eyes:'round', mouth:'cat', eyeC:'#15803d' } },
  /* ── 같은 얼굴(face3)로 평소 옷 ↔ 레이드 옷 ── */
  same_job:{ skin:'#c98d5a', hair:'spiky', hairC:'#1d4ed8', face:{ eyes:'sharp', mouth:'cat', blush:false }, top:'#e0463c', stripes:'#f8fafc', number:'10', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#1b1f27', prop:'ball' },
  same_mage:{ skin:'#c98d5a', hair:'spiky', hairC:'#1d4ed8', face:{ eyes:'sharp', mouth:'cat', blush:false }, hat:'#4c1d95', top:'#5b36a8', sleeve:'#5b36a8', robe:'#5b36a8', belt:'#c58a12', leg:'#3b2a6e', shoe:'#1b1f27', outfit:'mage', armFwd:[-0.4,0] },
  same_archer:{ skin:'#c98d5a', hair:'spiky', hairC:'#1d4ed8', face:{ eyes:'sharp', mouth:'cat', blush:false }, top:'#166534', sleeve:'#166534', belt:'#7c4a1e', leg:'#3b2a1e', shoe:'#1b1f27', outfit:'archer', armFwd:[-0.4,0] },
  same_warrior:{ skin:'#c98d5a', hair:'spiky', hairC:'#1d4ed8', face:{ eyes:'sharp', mouth:'cat', blush:false }, top:'#475569', sleeve:'#475569', leg:'#334155', shoe:'#1b1f27', outfit:'warrior', prop:'sword' },
  soccer_front:{ skin:SK_M, hair:'short', hairC:'#3b2a1e', top:'#e0463c', stripes:'#f8fafc', number:'10', shorts:'#f8fafc', sleeveTop:'#e0463c', sock:'#e0463c', shoe:'#1b1f27', yaw:0 }
};
(async()=>{
  const br=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--allow-file-access-from-files','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg=await br.newPage({ viewport:{ width:900, height:1100 } }); pg.on('pageerror',e=>console.log('ERR',e.message)); pg.on('console',m=>{ if(m.type()==='error') console.log('CON',m.text()); });
  await pg.goto('file://'+DIR+'/avatar.html'); await pg.waitForFunction('window.ready===true',{timeout:60000});
  const only=process.argv.slice(2);
  for(const k of Object.keys(CFG)){ if(only.length&&only.indexOf(k)<0) continue; const url=await pg.evaluate(c=>window.render(c), CFG[k]); fs.writeFileSync(DIR+'/'+k+'.png', Buffer.from(url.split(',')[1],'base64')); console.log('rendered', k); }
  await br.close();
})().catch(e=>{ console.error('FAIL',e.message); process.exit(1); });
