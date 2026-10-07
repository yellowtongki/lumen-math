const { chromium } = require('/home/user/lumen-math/node_modules/playwright');
let pass=0,fail=0; const t=(n,ok,x)=>{ (ok?pass++:fail++); console.log((ok?'  ✅ ':'  ❌ ')+n+(x!==undefined?('  → '+x):'')); };
const U=process.env.SUPABASE_URL,K=process.env.SUPABASE_SERVICE_KEY;
(async()=>{
  const rows=await (await fetch(U+'/rest/v1/lumen_store?select=key,value&or=(key.like.sungong_*,key.eq.plweek_paper,key.eq.lumen_group_days,key.eq.or_studentdb)',{headers:{apikey:K,Authorization:'Bearer '+K}})).json();
  const D={sg:{},data:{},goals:{}}; let studs=[],paper={byCode:{}},days={};
  rows.forEach(r=>{ let v=r.value; if(typeof v==='string')v=JSON.parse(v); if(r.key==='or_studentdb') studs=v.filter(s=>s&&s.lumen_rec_code&&!s.withdrawn).map(s=>({id:s.id,name:s.name,grade:s.grade,group:s.group,lumen_rec_code:s.lumen_rec_code})); else if(r.key==='plweek_paper') paper=v; else if(r.key==='lumen_group_days') days=v; else if(r.key==='sungong_goals') D.goals=(v&&v.map)||{}; else { D.data[r.key.slice(8)]=v; D.sg[r.key.slice(8)]=v.weeks||{}; } });
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const pg=await (await br.newContext({viewport:{width:1500,height:950}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message)));
  await pg.route(/^https:\/\//, r=>r.abort());
  await pg.goto('file:///home/user/lumen-math/lumen_v19-89.html',{waitUntil:'load'}); await pg.waitForTimeout(1500);
  const o=await pg.evaluate(({D,studs,paper,days})=>{
    const out={ver:APP_VER};
    window.getSortedStudents=()=>studs.slice().sort((a,b)=>String(a.group).localeCompare(String(b.group))); try{ students.length=0; studs.forEach(s=>students.push(s)); }catch(e){}
    Object.assign(PWB,{loaded:true,loading:false,at:Date.now(),wp:{},chk:{},cp:{},cd:{},ev:{byCode:{}},days:days,sg:D.sg,paper:paper});
    SG.loaded=true; SG.kicked=true; SG.data=D.data; SG.goals=D.goals;
    const C=document.createElement('div'); C.id='T'; document.body.innerHTML=''; document.body.appendChild(C); C.style.background='#f4f6fb';
    C.innerHTML=rSungong(); const tx=C.innerText;
    out.title=tx.indexOf('순공피드백 점수')>=0; out.months=/9월\+10월/.test(tx);
    out.rowMin=(tx.match(/2주 연속 미제출/g)||[]).length;
    const trs=[...C.querySelectorAll('tr')]; out.rows=trs.length; out.h=Math.round(C.getBoundingClientRect().height);
    out.cols=trs[0]?trs[0].cells.length:0;
    sgvSet('range','this'); out.cols1=document.querySelector('#T tr')?0:0; C.innerHTML=rSungong(); out.colsThis=C.querySelector('tr').cells.length;
    sgvSet('sort','score'); C.innerHTML=rSungong(); out.top=(C.querySelectorAll('tr')[1]||{}).innerText||'';
    sgvSet('sort','group'); sgvSet('range','2'); C.innerHTML=rSungong();
    SG.pop={code:studs[0].lumen_rec_code,mon:'2026-09-28'}; const P=document.createElement('div'); P.innerHTML=sgPopup(); out.goal=P.innerText.indexOf('주간 목표 순공시간')>=0; SG.pop=null;
    return out;
  },{D,studs,paper,days});
  console.log(JSON.stringify(o));
  t('학원앱 버전', o.ver==='v19-89'); t('제목·기간 칩', o.title&&o.months); t('2주 연속 미제출 딱지 없음', o.rowMin===0);
  t('2달 칸 > 이번 달 칸', o.cols>o.colsThis, o.cols+' / '+o.colsThis); t('점수 높은 순 맨 위(합계 칸이 가장 큼)', /\d+\/\d+$/.test(o.top.trim()), '(이름은 출력하지 않음)');
  t('창에 목표 설정', o.goal); t('오류 없음', errs.length===0, errs.slice(0,2).join(' | '));
  await pg.screenshot({path:process.env.SP+'/v1989_sg.png',fullPage:false});
  console.log(`\n${pass} 통과 / ${fail} 실패`); await br.close();
})();
