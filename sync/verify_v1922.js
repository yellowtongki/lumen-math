/* v19-22 검증 — 💡 아하노트 수업 모드 «반으로 고르기» */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'lumen_v19-22.html';
const WANT=process.argv[3]||'v19-22';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,160)):'')); };

/* ── 글자 검사 ── */
ok('APP_VER = '+WANT, new RegExp("APP_VER = '"+WANT+"'").test(src));
ok('수업 모드에 반 고르개 함수가 있다', src.indexOf('function acmClsPicker')>0 && src.indexOf('window.acmSetCls')>0);
ok('반 목록·블랙반 기수를 이미 있는 것에서 읽는다', src.indexOf('function acmClsList')>0 && /acmClsCodes[^]{0,600}ahaBlackCodes/.test(src));
ok('상단 바에 고르개가 붙었다', /h\+=acmClsPicker\(\);/.test(src));
ok('골라 온 명단이 있으면 그 쪽이 먼저다', /if\(ACM\.pick\) ACM\.cls=''/.test(src));
ok('질문 목록·해결 처리는 그대로다', src.indexOf('function acmPending')>0 && src.indexOf('window.acmResolve')>0 && src.indexOf('function acmComBody')>0);

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1400,height:1000}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,180)));
  await p.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
  await p.route('**/*', async r=>{
    const u=r.request().url();
    if(u.endsWith('/APP.html')) return r.fulfill({contentType:'text/html',body:src});
    if(/supabase\.js/.test(u)) return r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync('/home/user/lumen-math/supabase.js','utf8')});
    if(u.indexOf('supabase.co')>=0){
      try{ const h=Object.assign({},r.request().headers()); delete h['host']; delete h['content-length'];
        const res=await fetch(u,{method:r.request().method(),headers:h,body:r.request().postData()||undefined});
        return r.fulfill({status:res.status,contentType:res.headers.get('content-type')||'application/json',body:await res.text()});
      }catch(e){ return r.fulfill({status:200,contentType:'application/json',body:'[]'}); }
    }
    return r.fulfill({status:200,contentType:'text/javascript',body:''});
  });
  await p.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(15000);

  /* 아하노트 → 수업 모드 (반 고르기 없이 바로 = 원장님이 하신 경로) */
  await p.evaluate(()=>{ go('aha'); });
  await p.waitForTimeout(14000);
  await p.evaluate(()=>{ acmOpen(); });
  await p.waitForTimeout(3000);

  const s1=await p.evaluate(()=>{
    const ov=document.querySelector('select[onchange^="acmSetCls"]');
    const opts=ov?Array.from(ov.options).map(o=>({v:o.value,t:o.textContent})):[];
    return { open:!!ACM.on, hasSel:!!ov, nOpt:opts.length,
             today:opts.some(o=>o.v==='__today'), all:opts.some(o=>o.v==='__all'),
             cls:opts.filter(o=>o.v.indexOf('c:')===0).map(o=>o.t).slice(0,4),
             blk:opts.filter(o=>o.v.indexOf('b:')===0).map(o=>o.t).slice(0,3),
             chips:acmStudents().length };
  });
  ok('수업 모드가 열린다', s1.open===true);
  ok('반 고르개가 화면에 있다', s1.hasSel===true, s1.nOpt+'개 고를 수 있음');
  ok('「오늘 수업 반」·「전체 학생」이 있다', s1.today&&s1.all);
  ok('진짜 반 이름이 나온다', s1.cls.length>0, s1.cls.join(' / '));
  ok('🖤 블랙반 기수도 나온다', s1.blk.length>0, s1.blk.join(' / '));

  /* 반 하나를 골라 본다 — 그 반 학생만 나오는지 */
  const pick=await p.evaluate(()=>{
    const ov=document.querySelector('select[onchange^="acmSetCls"]');
    const opt=Array.from(ov.options).filter(o=>o.value.indexOf('c:')===0)[0];
    const g=opt.value.slice(2);
    const before=acmStudents().map(x=>x.name);
    acmSetCls(opt.value);
    const rows=acmStudents();
    /* 등록부에서 그 반 학생 코드 */
    const want={}; getSortedStudents().forEach(s=>{ if(s.lumen_rec_code&&(s.group||'미배정')===g) want[s.lumen_rec_code]=1; });
    const allInClass=rows.every(r=>!!want[r.code]);
    /* 미해결 건수가 진짜 집계와 같은지 */
    const nSame=rows.every(r=>r.n===ahaPPending(r.code).length);
    return { g, before:before.length, after:rows.length, allInClass, nSame,
             names:rows.slice(0,6).map(r=>r.name+'('+r.n+')'), cls:ACM.cls, sel:ACM.sel,
             selInRows:rows.some(r=>r.code===ACM.sel) };
  });
  ok('반을 고르면 그 반 학생만 나온다', pick.allInClass===true, pick.g+' · '+pick.after+'명 · '+pick.names.join(' '));
  ok('미해결 건수가 진짜 집계와 같다', pick.nSame===true);
  ok('고른 뒤 학생 하나가 자동으로 잡힌다', pick.selInRows===true, String(pick.sel));

  await p.waitForTimeout(1500);
  const draw=await p.evaluate(()=>{
    const ov=document.getElementById('acmOverlay')||document.querySelector('[id*="acm" i]');
    const t=(ov?ov.innerText:document.body.innerText).replace(/\s+/g,' ');
    return { len:t.length, hasPull:t.indexOf('반 풀기')>=0, tabanGone:t.indexOf('타반')<0 };
  });
  ok('반을 고르면 화면이 다시 그려진다', draw.len>300, draw.len+'자');
  ok('「✕ 반 풀기」 단추가 생긴다', draw.hasPull===true);
  ok('고른 반이면 「타반」 표시가 사라진다', draw.tabanGone===true);
  await p.screenshot({path:SP+'/v1922_acm_cls.png'});

  /* 블랙반 기수도 되는지 */
  const blk=await p.evaluate(()=>{
    const ov=document.querySelector('select[onchange^="acmSetCls"]');
    const opt=Array.from(ov.options).filter(o=>o.value.indexOf('b:')===0)[0];
    if(!opt) return {skip:true};
    acmSetCls(opt.value);
    const rows=acmStudents();
    const want={}; ahaBlackCodes(opt.value.slice(2)).forEach(c=>want[c]=1);
    return { skip:false, n:rows.length, allIn:rows.every(r=>!!want[r.code]), label:opt.textContent };
  });
  ok('🖤 블랙반 기수로도 고를 수 있다', blk.skip||(blk.allIn===true&&blk.n>0), blk.skip?'기수 없음':(blk.label+' '+blk.n+'명'));

  /* 반 풀기 → 예전 동작 그대로 */
  const back=await p.evaluate(()=>{
    acmSetCls('__today');
    const rows=acmStudents();
    return { cls:ACM.cls, showAll:ACM.showAll, n:rows.length, taban:rows.filter(r=>!r.today).length };
  });
  ok('반 풀기를 누르면 오늘 수업 반으로 돌아간다', back.cls==='' && back.showAll===false, back.n+'명');

  /* 예전 길(아하노트 반별에서 골라 오기)이 그대로인지 */
  const legacy=await p.evaluate(()=>{
    acmClose(); ahaSetAxis('class');
    const gs=Object.keys((function(){ const m={}; ahaNotes.forEach(n=>{ const st=ahaStudentByCode(n.student_code); if(st) m[st.group||'미배정']=1; }); return m; })());
    if(!gs.length) return {skip:true};
    ahaPickToggleClass(gs[0]);
    acmOpen();
    return { skip:false, pick:!!ACM.pick, label:ACM.pick?ACM.pick.label:'', cls:ACM.cls, n:acmStudents().length };
  });
  ok('예전 길 — 반별에서 골라 오면 그 명단이 따라온다', legacy.skip||(legacy.pick===true&&legacy.cls===''), legacy.skip?'반 없음':(legacy.label+' '+legacy.n+'명'));

  /* 공통 질문·해결 처리가 그대로인지 */
  const keep=await p.evaluate(()=>{
    let com=-1; try{ com=acmComGroups().length; }catch(e){ return {err:e.message}; }
    acmMode('com'); const c1=document.body.innerText.indexOf('공통')>=0;
    acmMode('stu');
    return { com, c1, fns:['acmResolve','acmPrint','acmNav','acmView'].every(f=>typeof window[f]==='function') };
  });
  ok('👥 공통 질문이 그대로 돈다', !keep.err && keep.c1===true, keep.err||('묶음 '+keep.com+'개'));
  ok('✔ 해결·프린트·사진 넘기기 그대로', keep.fns===true);

  ok('자바스크립트 오류 없음', errs.length===0, errs.slice(0,3).join(' | '));
  await b.close();
  console.log(out.join('\n'));
  console.log('\n결과: '+(out.length-bad)+'/'+out.length+(bad?' ❌':' 통과 ✅'));
  process.exit(bad?1:0);
})();
