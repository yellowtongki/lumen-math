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
