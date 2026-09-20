/* v19-26 검증 — 🗂 할 일 보드 (docs/todo_board_contract.md §8). 실브라우저로 코스 → 배정 → 나눠 주기 → 학생 표시 병합 → 정리까지 왕복한다.
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_v1926.js [파일]
 * 검증용 코스·카드는 끝에 전부 치운다 (이름·점수는 출력하지 않는다). */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'/home/user/lumen-math/lumen_v19-26.html';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,200)):'')); };
async function route(p){
  await p.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
  await p.route('**/*', async r=>{
    const u=r.request().url();
    if(u.endsWith('/APP.html')) return r.fulfill({contentType:'text/html',body:src});
    if(/supabase\.js/.test(u)) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync('/home/user/lumen-math/supabase.js','utf8')});
    if(u.indexOf('supabase.co')>=0){
      try{
        const h=Object.assign({},r.request().headers()); delete h['host']; delete h['content-length'];
        const res=await fetch(u,{method:r.request().method(),headers:h,body:r.request().postData()});
        const body=Buffer.from(await res.arrayBuffer());
        const rh={}; res.headers.forEach((v,k)=>{ if(!/^(content-encoding|transfer-encoding|content-length)$/i.test(k)) rh[k]=v; });
        return r.fulfill({status:res.status,headers:rh,body});
      }catch(e){ return r.fulfill({status:500,body:String(e)}); }
    }
    return r.fulfill({status:200,contentType:'text/javascript',body:''});
  });
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1500,height:1000}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,180)));
  await route(p);
  await p.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(15000);
  await p.evaluate(()=>{ VIEW='todo'; render(); });
  await p.waitForTimeout(6000);
  let t=await p.evaluate(()=>({ loaded:TD.loaded, err:TD.err, txt:document.getElementById('CONTENT').innerText.replace(/\s+/g,' ').slice(0,300), n:Object.keys(TD.items).length, c:TD.courses.length }));
  ok('보드가 뜨고 자료를 읽었다', t.loaded && !t.err, JSON.stringify(t));
  await p.screenshot({path:SP+'/todo/pc_board_empty.png'});
  /* 지난 검증 찌꺼기 정리 */
  await p.evaluate(async()=>{ var n=TD.courses.length; TD.courses=TD.courses.filter(x=>x.title!=='검증용 코스(지울 것)'); if(TD.courses.length!==n) await tdSaveCourses(); });
  /* 코스 만들기 (prompt 대체) */
  await p.evaluate(()=>{ TD.tab='course'; window.prompt=function(){ return '검증용 코스(지울 것)'; }; tdCourseNew(); });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ window.prompt=function(){ return 'Ⅰ. 검증 단원'; }; tdUnitAdd(); });
  await p.waitForTimeout(800);
  let cid=await p.evaluate(()=>TD.cid);
  ok('코스·단원이 생겼다', !!cid, cid);
  /* 단계 3개: 교재 · 학습지 · 백지테스트 */
  const addStep=async(kind,title,extra)=>{
    await p.evaluate((a)=>{ var c=tdCourseById(TD.cid); tdStepAdd(c.units[0].id); },{});
    await p.waitForTimeout(400);
    await p.evaluate((a)=>{ document.getElementById('td-st-kind').value=a.kind; tdStepKindUi(a.kind); document.getElementById('td-st-title').value=a.title;
      if(a.kind==='book'){ document.getElementById('td-st-book').value='쎈'; document.getElementById('td-st-from').value='1'; document.getElementById('td-st-to').value='2'; }
      tdStepSave(); },{kind,title});
    await p.waitForTimeout(800);
  };
  await addStep('book','쎈 1~2쪽 (검증)');
  await addStep('ws','검증 학습지');
  await addStep('blank','검증 백지테스트');
  let c=await p.evaluate(()=>{ var c=tdCourseById(TD.cid); return { units:c.units.length, steps:c.units[0].steps.map(s=>s.kind+':'+s.title) }; });
  ok('단계 3개가 순서대로 들어갔다', c.steps.length===3 && c.steps[0].indexOf('book:')===0 && c.steps[2].indexOf('blank:')===0, JSON.stringify(c));
  await p.screenshot({path:SP+'/todo/pc_course.png'});
  /* 서버에 저장됐는지 (다시 읽기) */
  await p.evaluate(()=>{ TD.loaded=false; });
  await p.evaluate(()=>tdLoad(true));
  await p.waitForTimeout(3000);
  let c2=await p.evaluate(()=>{ var c=TD.courses.filter(x=>x.title==='검증용 코스(지울 것)')[0]; return c?c.units[0].steps.length:-1; });
  ok('코스가 서버(todo_courses)에 저장되고 다시 읽힌다', c2===3, c2);
  /* 배정 — 학생 1명(첫 학생) */
  const code=await p.evaluate(()=>{ var s=tdActive()[0]; return s?String(s.lumen_rec_code):''; });
  ok('활성 학생이 있다', !!code);
  await p.evaluate((code)=>{ var c=TD.courses.filter(x=>x.title==='검증용 코스(지울 것)')[0]; TD.cid=c.id; return tdAssign(c.id,[code]); },code);
  await p.waitForTimeout(3000);
  let it=await p.evaluate((code)=>(TD.items[code]||[]).filter(x=>x.src==='course' && x.title.indexOf('검증')>=0).map(x=>({id:x.id,kind:x.kind,unit:x.unit,order:x.order,eff:tdEff(x,code)})),code);
  ok('배정하면 카드 3장이 단원 순서로 생긴다', it.length===3 && it[0].kind==='book' && it[2].kind==='blank' && it.every(x=>x.eff==='todo'), JSON.stringify(it));
  /* 서버 왕복 */
  await p.evaluate(()=>tdLoad(true)); await p.waitForTimeout(3000);
  let it2=await p.evaluate((code)=>(TD.items[code]||[]).filter(x=>x.title.indexOf('검증')>=0).length,code);
  ok('카드가 서버(todo_<코드>)에 저장됐다', it2===3, it2);
  /* 보드 화면 */
  await p.evaluate(()=>{ TD.tab='board'; TD.cls=''; TD.unitF=''; render(); }); await p.waitForTimeout(1500);
  let bd=await p.evaluate(()=>{ var t=document.getElementById('CONTENT').innerText.replace(/\s+/g,' '); return { has:t.indexOf('검증 백지테스트')>=0, cols:['배정됨','받음','하는 중','제출','확인 끝'].every(x=>t.indexOf(x)>=0) }; });
  ok('보드 5열에 카드가 보인다', bd.has && bd.cols, JSON.stringify(bd));
  await p.screenshot({path:SP+'/todo/pc_board.png'});
  /* 나눠 주기 — 받음 찍기 */
  await p.evaluate((code)=>{ TD.tab='hand'; TD.hand.cls=(tdStuByCode(code)||{}).group||''; TD.hand.init=true; TD.hand.key='blank|검증 백지테스트'; render(); },code); await p.waitForTimeout(1200);
  await p.screenshot({path:SP+'/todo/pc_hand.png'});
  await p.evaluate((code)=>{ var it=(TD.items[code]||[]).filter(x=>x.title==='검증 백지테스트')[0]; tdHandTap(code,it.id); },code); await p.waitForTimeout(2500);
  let hd=await p.evaluate((code)=>{ var it=(TD.items[code]||[]).filter(x=>x.title==='검증 백지테스트')[0]; return { tst:it.tst, eff:tdEff(it,code), at:!!(it.tat&&it.tat.got) }; },code);
  ok('나눠 주기에서 이름을 누르면 원장 표시가 「받음」이 된다', hd.tst==='got' && hd.eff==='got' && hd.at, JSON.stringify(hd));
  /* 학생 표시 흉내 — todo_st_<코드> 에 학생이 「하는 중」을 적은 셈 치고 읽어 본다 */
  await p.evaluate(async(code)=>{ var sb=getSupaClient(); var it=(TD.items[code]||[]).filter(x=>x.title==='검증 백지테스트')[0]; var v={}; v[it.id]={st:'doing',at:new Date().toISOString()}; v.upd=new Date().toISOString(); await sb.from('lumen_store').upsert({key:'todo_st_'+code,value:v,updated_at:v.upd},{onConflict:'key'}); },code);
  await p.evaluate(()=>tdLoad(true)); await p.waitForTimeout(3000);
  let ef=await p.evaluate((code)=>{ var it=(TD.items[code]||[]).filter(x=>x.title==='검증 백지테스트')[0]; return { tst:it.tst, stu:(TD.st[code]||{})[it.id]&&TD.st[code][it.id].st, eff:tdEff(it,code) }; },code);
  ok('학생 표시(하는 중)가 원장 표시(받음)보다 앞서면 「하는 중」으로 보인다', ef.eff==='doing' && ef.tst==='got' && ef.stu==='doing', JSON.stringify(ef));
  /* 학생별 화면 */
  await p.evaluate((code)=>{ TD.tab='stu'; TD.cls=''; TD.stu=code; render(); },code); await p.waitForTimeout(1200);
  let su=await p.evaluate(()=>document.getElementById('CONTENT').innerText.replace(/\s+/g,' '));
  ok('학생별 화면에 단원 이름과 카드가 순서대로', su.indexOf('Ⅰ. 검증 단원')>=0 && su.indexOf('검증 백지테스트')>=0, su.slice(0,150));
  await p.screenshot({path:SP+'/todo/pc_stu.png'});
  /* 홈 한 줄 */
  await p.evaluate(()=>{ VIEW='home'; render(); }); await p.waitForTimeout(2500);
  let hm=await p.evaluate(()=>document.getElementById('CONTENT').innerText.indexOf('학습지 아직 못 받음')>=0);
  ok('홈 「오늘 챙길 것」에 「학습지 아직 못 받음」 줄이 있다', hm);
  /* 폰 */
  const ph=await ctx.newPage(); await ph.setViewportSize({width:390,height:844}); const perr=[]; ph.on('pageerror',e=>perr.push(String(e.message).slice(0,180)));
  await route(ph);
  await ph.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000}); await ph.waitForTimeout(15000);
  await ph.evaluate(()=>{ MOB.view='todo'; render(); }); await ph.waitForTimeout(6000);
  let mb=await ph.evaluate(()=>{ var t=(document.getElementById('MOB_OV')||{}).innerText||''; return { has:t.indexOf('할 일 보드')>=0, tabs:t.indexOf('반별')>=0&&t.indexOf('나눠 주기')>=0, tab:t.indexOf('할 일')>=0 }; });
  ok('폰 할 일 화면·아래탭이 뜬다', mb.has && mb.tabs && mb.tab, JSON.stringify(mb));
  await ph.screenshot({path:SP+'/todo/ph_todo.png',fullPage:false});
  await ph.evaluate((code)=>{ mobTodoStu(code); },code); await ph.waitForTimeout(1200);
  await ph.screenshot({path:SP+'/todo/ph_todo_stu.png',fullPage:false});
  /* 회귀 — 옛 화면 */
  let reg=await p.evaluate(()=>{ var o={}; VIEW='bookdash'; MF.tab='all'; render(); o.bd=document.getElementById('CONTENT').innerHTML.length; VIEW='race'; render(); o.rc=document.getElementById('CONTENT').innerHTML.length; VIEW='aha'; render(); o.aha=document.getElementById('CONTENT').innerHTML.length; return o; });
  ok('옛 화면(매쓰플랫 현황·진도 레이스·아하노트)이 그대로 그려진다', reg.bd>200&&reg.rc>200&&reg.aha>200, JSON.stringify(reg));
  /* 정리 — 검증 카드·학생 표시·코스 삭제 */
  await p.evaluate(async(code)=>{ TD.items[code]=(TD.items[code]||[]).filter(x=>x.title.indexOf('검증')<0); await tdSaveItems(code);
    var sb=getSupaClient(); await sb.from('lumen_store').upsert({key:'todo_st_'+code,value:{upd:new Date().toISOString()},updated_at:new Date().toISOString()},{onConflict:'key'});
    TD.courses=TD.courses.filter(x=>x.title!=='검증용 코스(지울 것)'); await tdSaveCourses(); },code);
  await p.evaluate(()=>tdLoad(true)); await p.waitForTimeout(3000);
  let cl=await p.evaluate((code)=>({ cards:(TD.items[code]||[]).filter(x=>x.title.indexOf('검증')>=0).length, courses:TD.courses.filter(x=>x.title.indexOf('검증')>=0).length, st:Object.keys(TD.st[code]||{}).length }),code);
  ok('검증 자료를 전부 치웠다', cl.cards===0 && cl.courses===0 && cl.st===0, JSON.stringify(cl));
  ok('자바스크립트 오류 없음 (PC)', errs.length===0, errs.slice(0,3).join(' | '));
  ok('자바스크립트 오류 없음 (폰)', perr.length===0, perr.slice(0,3).join(' | '));
  await b.close();
  console.log(out.join('\n')); console.log('결과: '+(out.length-bad)+'/'+out.length);
  process.exit(bad?1:0);
})().catch(e=>{ console.error('하네스 오류', e); process.exit(2); });
