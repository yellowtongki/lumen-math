const { chromium } = require('/home/user/lumen-math/node_modules/playwright');
let pass=0,fail=0; const t=(n,ok,x)=>{ (ok?pass++:fail++); console.log((ok?'  ✅ ':'  ❌ ')+n+(x!==undefined?('  → '+x):'')); };
(async()=>{
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const pg=await (await br.newContext({viewport:{width:1600,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message))); pg.on('dialog',d=>d.accept());
  await pg.route(/^https:\/\//, r=>r.abort());
  await pg.goto('file:///home/user/lumen-math/lumen_v19-91.html',{waitUntil:'load'}); await pg.waitForTimeout(1500);
  const o=await pg.evaluate(async()=>{
    const out={ver:APP_VER};
    const st={id:'s1',name:'김철수',group:'T5',lumen_rec_code:'AAA111',lumen_planner:{'2026.10.01':8}};
    Object.assign(PWB,{loaded:true,loading:false,at:Date.now(),wp:{},chk:{},cp:{},cd:{},ev:{byCode:{}},days:{T5:[2,4,6]},
      sg:{AAA111:{'2026-09-28':{photo:'p',at:'2026-10-05T13:18:00Z'}}},paper:{byCode:{AAA111:{'2026-09-28':{at:'2026-10-07T05:57:09Z',pov:'ok'}}}}});
    out.head1=plrGridHead(2026,10,4,1); out.head2=plrGridHead(2026,10,4,2); out.cell=plrGridCell(st,2026,10,4); out.none=plrGridHead(2026,10,5,1);
    out.total=plrGridTotal(st,'2026.10',8,'#000');
    out.rules=(typeof plrPanelHtml==='function')?(plrPanelHtml().replace(/<[^>]+>/g,' ').match(/주간 20점[^(]*/)||[''])[0]:'';
    out.nav=document.documentElement.innerHTML.indexOf("label:'주간 점수(계획·순공)'")>=0;
    /* 실제 입력 표에서 칸 수가 줄마다 맞나 */
    try{ students.length=0; students.push(st); }catch(e){}
    VIEW='planner'; let html=''; try{ html=rPlannerInput(); }catch(e){ out.err=e.message; }
    const D=document.createElement('div'); D.innerHTML=html; document.body.appendChild(D);
    const tb=[...D.querySelectorAll('table')].find(x=>x.innerText.indexOf('계획')>=0&&x.innerText.indexOf('순공')>=0);
    if(tb){ const rows=[...tb.rows]; out.widths=rows.slice(0,3).map(r=>[...r.cells].reduce((a,c)=>a+(c.colSpan||1),0)); }
    return out;
  });
  const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  console.log(JSON.stringify({head2:strip(o.head2),cell:strip(o.cell),total:strip(o.total),widths:o.widths,err:o.err}));
  t('학원앱 버전', o.ver==='v19-91'); t('일요일 머리 두 칸', /colspan="2"/.test(o.head1) && strip(o.head2)==='계획 순공'); t('일요일 아니면 칸 없음', o.none==='');
  t('계획 0 · 순공 4 (사진 2 + 종이 2 손고침? 종이 지각 1)', strip(o.cell)==='0 7', strip(o.cell));
  t('합계 = 매일 + 계획 + 순공', strip(o.total)==='15 매일 8 · 계획 0 · 순공 7', strip(o.total));
  t('왼쪽 탭 이름', o.nav); t('점수 기준표 20점', /주간 20점 = 주간계획 10 \+ 순공 10/.test(o.rules), o.rules); t('입력 표 줄마다 칸 수 같음', o.widths&&o.widths.length>=2&&o.widths.every(w=>w===o.widths[0]), JSON.stringify(o.widths));
  t('학원앱 오류 없음', errs.length===0&&!o.err, (errs.slice(0,2).join(' | '))+(o.err||''));
  /* 학생앱 */
  const sp=await (await br.newContext({viewport:{width:420,height:900}})).newPage();
  const errs2=[]; sp.on('pageerror',e=>errs2.push(String(e.message)));
  await sp.route(/^https:\/\//, r=>r.abort());
  await sp.goto('file:///home/user/lumen-math/student_v2-131.html',{waitUntil:'load'}); await sp.waitForTimeout(1500);
  const s=await sp.evaluate(async()=>{
    const out={ver:STU_VER}; const store={ sungong_AAA111:{code:'AAA111',weeks:{'2026-09-28':{subj:{'수학':60},total:60,photo:'p',at:'2026-10-05T13:18:00Z'}}},
      plweek_paper:{byCode:{AAA111:{'2026-09-28':{at:'2026-10-07T05:57:09Z',pov:'ok'}}}}, lumen_group_days:{T5:[2,4,6]} };
    studentInfo={lumen_rec_code:'AAA111',name:'김철수',grade:'중2',group:'T5'}; isTest=false;
    sb={ storage:{from(){return{upload(){ return Promise.resolve({error:null}); }};}}, from(){ const b={ f:{}, select(){return b;}, in(k,v){b.f.in=v;return b;}, eq(k,v){b.f.eq=v;return b;}, or(){return b;}, like(){return b;}, order(){return b;}, limit(){return b;}, gte(){return b;}, upsert(row){ store[row.key]=row.value; return Promise.resolve({error:null}); },
      then(r,j){ let keys=Object.keys(store); if(b.f.in) keys=keys.filter(k=>b.f.in.indexOf(k)>=0); if(b.f.eq) keys=keys.filter(k=>k===b.f.eq); return Promise.resolve({data:keys.map(k=>({key:k,value:store[k]})),error:null}).then(r,j); } }; return b; } };
    await sgInit(); const body=document.getElementById('sg-body'); out.card=(body.innerText.match(/내 순공피드백 점수[\s\S]*?이번 주[^\n]*/)||[''])[0];
    const sc=document.createElement('div'); sc.innerHTML=(function(){ try{ return document.getElementById('wp-body')?'':''; }catch(e){ return ''; } })();
    WP.sg=store.sungong_AAA111.weeks; WP.paper=store.plweek_paper.byCode.AAA111; out.wpS=wplScore('2026-09-28'); out.wp=typeof wplScore==='function'?JSON.stringify(wplScore('2026-09-28')):'';
    const d=document.createElement('div'); d.style.cssText='width:396px;padding:12px;background:#f4f6fb'; d.innerHTML=body.innerHTML; document.body.innerHTML=''; document.body.appendChild(d);
    return out;
  });
  console.log(JSON.stringify(s));
  t('학생앱 버전', s.ver==='v2-131'); t('학생앱 주간 = 사진 5 + 종이 2 = 7/20', s.wpS&&s.wpS.photoPt===5&&s.wpS.paperPt===2&&s.wpS.total===7, JSON.stringify(s.wpS&&[s.wpS.photoPt,s.wpS.paperPt,s.wpS.total])); t('순공 화면 점수 카드 (지난 주 3/4)', /지난 주[\s\S]*7\s*\/10/.test(s.card), s.card.replace(/\n/g,' | ').slice(0,160));
  await sp.screenshot({path:process.env.SP+'/v2130_sg.png',clip:{x:0,y:0,width:420,height:300}});
  t('학생앱 오류 없음', errs2.length===0, errs2.slice(0,2).join(' | '));
  console.log(`\n${pass} 통과 / ${fail} 실패`); await br.close();
})();
