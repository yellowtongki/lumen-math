const fs=require('fs'), path=require('path'), http=require('http'); const { chromium }=require('playwright');
const REPO='/home/user/lumen-math', SP=process.env.SP, TARGET=process.argv[2]||'lumen_v19-90.html', PORT=8951;
const mk=(n,c,g,hw)=>({id:'s'+n,name:'학생'+n,grade:'중2',group:g,lumen_rec_code:c,lumen_hw:hw||{}});
/* 서버: 학생1에 다른 기기 체크(10/6) */
const CLOUD=[mk(1,'C00001','M3',{'2026-10-06':{p:100,c:100,w:100}}),mk(2,'C00002','M3'),mk(3,'C00003','M3'),mk(4,'C00004','M4'),mk(5,'C00005','M4'),mk(6,'C00006','M4')];
/* 이 기기(태블릿): 서버에 못 올라간 체크(학생2 10/7)가 남아 있다 */
const LOCAL=JSON.parse(JSON.stringify(CLOUD)); LOCAL[0].lumen_hw={}; LOCAL[1].lumen_hw={'2026-10-07':{p:100,c:100,w:100}};
const STORE={ mf_bookans_TEST:{value:{big:1},at:'2026-10-01T00:00:00Z'}, or_studentdb:{value:CLOUD,at:'2026-10-07T06:00:00.000Z'}, lumen_group_days:{value:{M3:[1,3,5],M4:[1,3,5]},at:'2026-10-01T00:00:00Z'} };
let pushes=0, heads=0, reads=0;
const hwOf=(n,d)=>((STORE.or_studentdb.value.find(x=>x.name===n)||{}).lumen_hw||{})[d];
(async()=>{
  const umdBody=fs.readFileSync(SP+'/package/dist/umd/supabase.js');
  const server=http.createServer((req,res)=>{ const f=path.join(REPO,decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'); res.end(fs.readFileSync(f)); } else { res.statusCode=404; res.end('nf'); } }).listen(PORT,'127.0.0.1');
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(({db})=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+30*60*1000})); localStorage.setItem('lumen_demo_injected_v1','1'); localStorage.setItem('or_studentdb',JSON.stringify(db)); window.confirm=()=>true; window.alert=m=>{window.__lastAlert=String(m);}; },{db:LOCAL});
  await page.route('**/*',route=>{
    const req=route.request(), u=req.url();
    if(u.startsWith('http://127.0.0.1:'+PORT)) return route.continue();
    if(u.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js')) return route.fulfill({status:200,contentType:'application/javascript',body:umdBody});
    if(u.includes('supabase.co/rest/v1/lumen_store')){
      if(req.method()==='POST'){ let b=null; try{ b=JSON.parse(req.postData()||'null'); }catch(e){} (Array.isArray(b)?b:[b]).forEach(r=>{ if(r&&r.key){ STORE[r.key]={value:r.value,at:r.updated_at||new Date().toISOString()}; if(r.key==='or_studentdb') pushes++; } }); return route.fulfill({status:201,contentType:'application/json',body:'[]'}); }
      const url=new URL(u), kq=url.searchParams.get('key'), sel=url.searchParams.get('select')||'';
      let keys=Object.keys(STORE); if(kq&&!/^not\./.test(kq)){ const m=kq.match(/^eq\.(.+)$/); keys=m?keys.filter(k=>k===m[1]):[]; }
      else if(kq){ url.searchParams.getAll('key').forEach(f=>{ let m=f.match(/^not\.like\.(.+)%$/); if(m) keys=keys.filter(k=>!k.startsWith(m[1])); m=f.match(/^not\.in\.\((.*)\)$/); if(m){ const ex=m[1].split(',').map(x=>x.replace(/"/g,'')); keys=keys.filter(k=>ex.indexOf(k)<0); } }); }
      if(kq==='eq.or_studentdb'){ if(sel==='updated_at') heads++; else reads++; }
      const rows=keys.map(k=>({key:k,value:STORE[k].value,updated_at:STORE[k].at}));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
    }
    if(u.includes('supabase.co')) return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    return route.abort();
  });
  const res=[]; const ck=(n,ok,d)=>{ res.push(ok); console.log((ok?'  ✅ ':'  ❌ ')+n+(d?' — '+d:'')); };
  await page.goto('http://127.0.0.1:'+PORT+'/'+TARGET,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  ck('앱이 서버 등록부를 받음', await page.evaluate(()=>window._studbPulled===true));
  ck('시작 때 큰 자료(mf_bookans_)는 안 받음', await page.evaluate(()=>_memStore['mf_bookans_TEST']===undefined && localStorage.getItem('mf_bookans_TEST')===null));
  await page.waitForTimeout(7000);
  ck('켠 뒤 이 기기에만 있던 체크가 서버로 올라감', !!hwOf('학생2','2026-10-07'), 'pushes='+pushes);
  ck('그 push가 서버 체크(다른 기기)를 지우지 않음', !!hwOf('학생1','2026-10-06'));
  /* 숙제체크 화면 */
  await page.evaluate(()=>{ VIEW='hwcheck'; HWC_YEAR=2026; HWC_MONTH=10; render(); });
  await page.waitForTimeout(1500);
  /* 다른 기기(PC)가 학생3 10/7 체크 */
  const s3=STORE.or_studentdb.value.find(x=>x.name==='학생3'); s3.lumen_hw={'2026-10-07':{p:100,c:60,w:100}}; s3.lumen_hw_at={'2026-10-07':new Date().toISOString()}; STORE.or_studentdb.at=new Date().toISOString();
  await page.evaluate(()=>{ document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(3500);
  const got=await page.evaluate(()=>({ hw:!!(students.find(x=>x.name==='학생3').lumen_hw||{})['2026-10-07'], toast:(document.body.innerText.match(/다른 기기에서 고친 숙제체크 \d+칸/)||[''])[0] }));
  ck('다른 기기 체크가 화면에 들어옴 + 알림', got.hw && !!got.toast, got.toast);
  /* 이 기기에서 학생4 체크 → 올릴 때 학생3(다른 기기) 체크를 지우지 않음 */
  const s5=STORE.or_studentdb.value.find(x=>x.name==='학생5'); s5.lumen_hw={'2026-10-08':{p:30,c:30,w:30}}; STORE.or_studentdb.at=new Date().toISOString();
  await page.evaluate(()=>{ hwcSave(students.find(x=>x.name==='학생4'),'2026-10-07',{p:100,c:100,w:100}); render(); });
  await page.waitForTimeout(4000);
  ck('올릴 때 다른 기기 체크 유지', !!hwOf('학생3','2026-10-07') && !!hwOf('학생5','2026-10-08') && !!hwOf('학생4','2026-10-07'));
  ck('서버가 그대로일 땐 등록부를 다시 받지 않음(시각만)', heads>reads, 'heads='+heads+' reads='+reads);
  const s6=STORE.or_studentdb.value.find(x=>x.name==='학생6'); s6.lumen_hw={'2026-10-07':{p:100,c:100,w:100}}; STORE.or_studentdb.at=new Date().toISOString();
  const chip=await page.evaluate(()=>document.body.innerText.indexOf('지금 받아오기')>=0);
  await page.evaluate(()=>sdsManual()); await page.waitForTimeout(1500);
  const man=await page.evaluate(()=>({ hw:!!(students.find(x=>x.name==='학생6').lumen_hw||{})['2026-10-07'], t:(document.body.innerText.match(/숙제체크 \d+칸을 받아왔어요|서버와 같아요/)||[''])[0] }));
  ck('「지금 받아오기」 단추 + 바로 받아옴', chip && man.hw && !!man.t, man.t);
  await page.evaluate(()=>sdsManual()); await page.waitForTimeout(1200);
  ck('두 번째는 「서버와 같아요」', await page.evaluate(()=>document.body.innerText.indexOf('서버와 같아요')>=0));
  await page.screenshot({path:SP+'/v1987_hw.png',clip:{x:0,y:0,width:1500,height:520}});
  ck('오류 없음', errs.length===0, errs.slice(0,2).join(' | '));
  console.log('\n'+res.filter(Boolean).length+' 통과 / '+res.filter(x=>!x).length+' 실패');
  await browser.close(); server.close();
})();
