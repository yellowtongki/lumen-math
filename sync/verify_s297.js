/* 학생앱 v2-97 검증 — 🗂 내 할 일 (docs/todo_board_contract.md §5-3·§8). 검증 카드를 한 학생 키에 넣었다가 끝에 원래대로 되돌린다.
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_s297.js [파일] */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'/home/user/lumen-math/student_v2-97.html';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const SB='https://bhkkkbcytcrlxhrtjgen.supabase.co', PUB='sb_publishable_D3ryC0YXrf5Fq2Buu8IA8A_OvmCQbbi';
const H={apikey:PUB,Authorization:'Bearer '+PUB,'Content-Type':'application/json'};
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,200)):'')); };
async function kv(key){ const r=await fetch(SB+'/rest/v1/lumen_store?key=eq.'+key+'&select=value',{headers:H}); const j=await r.json(); return j[0]?j[0].value:null; }
async function kvSet(key,value){ const r=await fetch(SB+'/rest/v1/lumen_store?on_conflict=key',{method:'POST',headers:Object.assign({},H,{Prefer:'resolution=merge-duplicates'}),body:JSON.stringify({key,value,updated_at:new Date().toISOString()})}); return r.status; }
(async()=>{
  /* 검증 학생 — 등록부의 첫 활성 학생 (이름은 출력하지 않는다) */
  const db=await kv('or_studentdb'); const stu=(db||[]).filter(s=>s&&s.lumen_rec_code&&!s.withdrawn)[0];
  const code=String(stu.lumen_rec_code);
  const prevItems=await kv('todo_'+code), prevSt=await kv('todo_st_'+code);
  const now=new Date().toISOString();
  const items=[
    { id:'c:zz:1', kind:'vod', title:'📺 검증 영상', ref:'3분', unit:0, unitTitle:'Ⅰ. 검증 단원', order:0, src:'course', tst:'todo', tat:{}, auto:null, at:now },
    { id:'c:zz:2', kind:'ws', title:'검증 학습지', ref:'', unit:0, unitTitle:'Ⅰ. 검증 단원', order:1, src:'course', tst:'got', tat:{got:now}, auto:null, at:now },
    { id:'c:zz:3', kind:'blank', title:'검증 백지테스트', ref:'사진으로 제출', unit:0, unitTitle:'Ⅰ. 검증 단원', order:2, src:'course', tst:'todo', tat:{}, auto:null, at:now },
    { id:'c:zz:4', kind:'book', title:'쎈 1~2쪽 (검증)', ref:'', unit:1, unitTitle:'Ⅱ. 다음 검증 단원', order:100, src:'course', tst:'todo', tat:{}, auto:null, at:now },
    { id:'m:zz:5', kind:'etc', title:'따로 받은 검증 할 일', ref:'', unit:null, unitTitle:'', order:5, src:'manual', tst:'todo', tat:{}, auto:{st:'done',at:now}, at:now }
  ];
  await kvSet('todo_'+code,{items,upd:now}); await kvSet('todo_st_'+code,{upd:now});
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,180)));
  await p.route('**/*', async r=>{
    const u=r.request().url();
    if(u.indexOf('/APP.html')>=0) return r.fulfill({contentType:'text/html',body:src});
    if(/supabase\.js/.test(u)) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync('/home/user/lumen-math/supabase.js','utf8')});
    if(u.indexOf('supabase.co')>=0){
      try{ const h=Object.assign({},r.request().headers()); delete h['host']; delete h['content-length'];
        const res=await fetch(u,{method:r.request().method(),headers:h,body:r.request().postData()});
        const body=Buffer.from(await res.arrayBuffer()); const rh={}; res.headers.forEach((v,k)=>{ if(!/^(content-encoding|transfer-encoding|content-length)$/i.test(k)) rh[k]=v; });
        return r.fulfill({status:res.status,headers:rh,body}); }catch(e){ return r.fulfill({status:500,body:String(e)}); }
    }
    return r.fulfill({status:200,contentType:'text/javascript',body:''});
  });
  await p.goto('https://yellowtongki.github.io/APP.html?code='+code,{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(12000);
  let home=await p.evaluate(()=>{ var el=document.getElementById('td-home'); return { shown:el&&el.style.display!=='none', txt:el?el.innerText.replace(/\s+/g,' '):'' , loaded:TD.loaded, n:TD.items.length }; });
  ok('홈에 「이번 할 일」 목록이 뜬다', home.shown && home.txt.indexOf('검증 영상')>=0 && home.txt.indexOf('검증 학습지')>=0, JSON.stringify(home).slice(0,240));
  ok('단원 순서 — 이번 단원(Ⅰ)만 홈에, 다음 단원(Ⅱ)은 홈에 없다', home.txt.indexOf('Ⅰ. 검증 단원')>=0 && home.txt.indexOf('쎈 1~2쪽')<0, home.txt.slice(0,200));
  ok('자동 제출된 카드(따로 받은 것)는 남은 할 일에서 빠진다', home.txt.indexOf('따로 받은 검증 할 일')<0);
  ok('원장이 찍은 「받음」(학습지)이 켜져 보인다', await p.evaluate(()=>{ var rows=[].slice.call(document.querySelectorAll('#td-home .tdb-row')); var r=rows.filter(x=>x.innerText.indexOf('검증 학습지')>=0)[0]; return !!(r&&r.querySelector('.tdb-b.on')); }));
  await p.screenshot({path:SP+'/todo/st_home.png'});
  /* 받음 → 하는 중 누르기 */
  await p.evaluate(()=>tdSet('c:zz:1','got')); await p.waitForTimeout(2500);
  let st=await kv('todo_st_'+code);
  ok('「받음」을 누르면 todo_st_<코드> 에만 적힌다', st && st['c:zz:1'] && st['c:zz:1'].st==='got', JSON.stringify(st).slice(0,160));
  let teacherKey=await kv('todo_'+code);
  ok('선생님 카드(todo_<코드>)는 건드리지 않는다', teacherKey && teacherKey.items && teacherKey.items.length===5 && teacherKey.items[0].tst==='todo');
  await p.evaluate(()=>tdSet('c:zz:1','doing')); await p.waitForTimeout(2000);
  await p.evaluate(()=>tdSet('c:zz:1','doing')); await p.waitForTimeout(2000);   /* 같은 단추 다시 → 한 칸 되돌림 */
  st=await kv('todo_st_'+code);
  ok('같은 단추를 다시 누르면 한 칸 되돌아간다 (하는 중 → 받음)', st && st['c:zz:1'] && st['c:zz:1'].st==='got', JSON.stringify(st['c:zz:1']));
  /* 내 할 일 화면 */
  await p.evaluate(()=>go('screen-todo')); await p.waitForTimeout(1500);
  let sc=await p.evaluate(()=>{ var t=document.getElementById('td-body').innerText.replace(/\s+/g,' '); return t; });
  ok('내 할 일 화면에 지금 단원 · 🔒 다음 단원 · 따로 받은 것이 모두 보인다', sc.indexOf('Ⅰ. 검증 단원')>=0 && sc.indexOf('Ⅱ. 다음 검증 단원')>=0 && sc.indexOf('따로 받은 할 일')>=0 && sc.indexOf('다음 ·')>=0, sc.slice(0,220));
  await p.screenshot({path:SP+'/todo/st_screen.png',fullPage:true});
  /* 기능 스위치 — 꺼진 학년이면 홈에 안 보인다 */
  let off=await p.evaluate(()=>{ SF.cfg={todo:{on:false}}; SF.loaded=true; tdHomeUpdate(); var el=document.getElementById('td-home'); var r=el.style.display; SF.cfg=null; tdHomeUpdate(); return r; });
  ok('기능 스위치를 끄면 홈 목록이 숨는다', off==='none');
  ok('자바스크립트 오류 없음', errs.length===0, errs.slice(0,3).join(' | '));
  await b.close();
  /* 정리 — 원래대로 */
  await kvSet('todo_'+code, prevItems||{items:[],upd:now}); await kvSet('todo_st_'+code, prevSt||{upd:now});
  const chk=await kv('todo_'+code); ok('검증 자료를 치웠다', !(chk&&chk.items&&chk.items.some(x=>String(x.id).indexOf('zz')>=0)));
  console.log(out.join('\n')); console.log('결과: '+(out.length-bad)+'/'+out.length);
  process.exit(bad?1:0);
})().catch(e=>{ console.error('하네스 오류', e); process.exit(2); });
