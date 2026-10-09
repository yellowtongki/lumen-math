/* 실서버(읽기만)로 학원앱을 띄워 등록부·숙제체크·시작 다운로드 크기를 본다. 쓰기 요청은 모두 막는다(가짜 201). SP=임시폴더(supabase UMD: SP/package/dist/umd/supabase.js — npm pack @supabase/supabase-js@2 로 받기) */
const fs=require('fs'),path=require('path'),http=require('http'); const {chromium}=require('playwright');
const REPO='/home/user/lumen-math', SP=process.env.SP, PORT=8953, U=process.env.SUPABASE_URL, K=process.env.SUPABASE_SERVICE_KEY;
(async()=>{
  const umd=fs.readFileSync(SP+'/package/dist/umd/supabase.js');
  const server=http.createServer((q,s)=>{ const f=path.join(REPO,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ s.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'application/javascript'); s.end(fs.readFileSync(f)); } else { s.statusCode=404; s.end(); } }).listen(PORT,'127.0.0.1');
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const pg=await br.newPage({viewport:{width:1500,height:900}}); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('framenavigated',f=>{ if(f===pg.mainFrame()) console.log('NAV',f.url()); }); pg.on('close',()=>console.log('CLOSED')); pg.on('crash',()=>console.log('CRASH'));
  await pg.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); localStorage.setItem('lumen_demo_injected_v1','1'); });
  let blocked=0, gets=0;
  br.on('disconnected',()=>console.log('BROWSER GONE'));
  await pg.route('**/*', async route=>{ try{ const q=route.request(), u=q.url();
    if(u.startsWith('http://127.0.0.1:'+PORT)) return route.continue();
    if(u.includes('supabase-js')) return route.fulfill({status:200,contentType:'application/javascript',body:umd});
    if(u.includes('supabase.co/rest/v1/')){ if(q.method()!=='GET'&&q.method()!=='HEAD'){ blocked++; return route.fulfill({status:201,contentType:'application/json',body:'[]'}); }
      if(/select=key%2Cvalue%2Cupdated_at$|select=key,value,updated_at$/.test(u)){ console.log('FULLPULL → 500 (76MB 대신)'); return route.fulfill({status:500,contentType:'application/json',body:'{}'}); }
      gets++; const r=await fetch(U+u.slice(u.indexOf('/rest/v1/')),{headers:{apikey:K,Authorization:'Bearer '+K,Accept:q.headers()['accept']||'application/json'}}); const b=await r.text(); if(b.length>300000||/updated_at/.test(u)) console.log('GET',r.status,b.length,decodeURIComponent(u.slice(u.indexOf('/rest/v1/'))).slice(0,110)); return route.fulfill({status:r.status,contentType:'application/json',body:b}); }
    if(u.includes('supabase.co')) return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    return route.abort(); }catch(e){ console.log('ROUTE ERR',e.message); try{ await route.abort(); }catch(_){} } });
  await pg.goto('http://127.0.0.1:'+PORT+'/lumen_v19-91.html',{waitUntil:'domcontentloaded'}); for(let i=0;i<30;i++){ await pg.waitForTimeout(1000); }
  const o=await pg.evaluate(()=>({ pulled:window._studbPulled, sds:typeof SDS!=='undefined', n:students.length,
    rep:(typeof list!=='undefined'&&list?list.length:-1), full:!!window._reportsFullyLoaded, books:(typeof books!=='undefined'?books.length:-1), hw:students.filter(s=>s.lumen_hw&&s.lumen_hw['2026-10-07']).map(s=>s.group+':'+s.lumen_rec_code) }));
  console.log(JSON.stringify(o),'gets',gets,'blockedWrites',blocked,'errs',errs.slice(0,3));
  await br.close(); server.close();
})();
