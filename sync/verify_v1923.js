/* v19-23 검증 — 📗 교재 상황판 (docs/book_dashboard_contract.md) */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'lumen_v19-23.html';
const WANT=process.argv[3]||'v19-23';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,170)):'')); };

/* ── 글자 검사 ── */
ok('APP_VER = '+WANT, new RegExp("APP_VER = '"+WANT+"'").test(src));
ok('PC 탭이 진도·리포트 그룹에 등록됐다', /\{v:'bookdash'[^}]*label:'교재 상황판'/.test(src));
ok('PC 화면 분기가 있다', /VIEW==='bookdash'/.test(src) && src.indexOf('function rBookDash')>0);
ok('폰 「교재별」 칩이 붙었다', /\['bk','📗 교재별'\]/.test(src) && /tab==='bk'/.test(src));
ok('새로 세지 않는다 — book_dash 한 칸만 읽는다',
   /eq\('key','book_dash'\)/.test(src) && !/from\('mf_answer_records'\)[^]{0,400}source/.test(src.slice(src.indexOf('function bdLoad'), src.indexOf('function bdLoad')+3000)));
ok('기존 화면이 그대로 있다', src.indexOf('function rBookProg')>0 && src.indexOf('function rHwBook')>0 && src.indexOf('function mobWsg')>0);
ok('학습지 문제 그림을 띄우지 않는다 (시험지 규칙)', !/rBdBook[^]{0,6000}pimg/.test(src));

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1500,height:1000}});
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

  /* PC 교재 상황판 */
  await p.evaluate(()=>{ VIEW='bookdash'; render(); });
  await p.waitForTimeout(9000);
  const pc=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    const D=BD.data;
    if(!D) return { err: BD.err||'자료 없음' };
    return { len:t.length, err:'', at:BD.at,
             rows:C?C.querySelectorAll('[onclick^="bdOpen"]').length:0,
             sum:D.sum, nbooks:D.books.length,
             head:t.slice(0,160),
             hasTiles:['쓰고 있는 교재','교재 푸는 학생','이번 주 푼 문항','평균 정답률','멈춘 교재'].every(x=>t.indexOf(x)>=0),
             hasSide:['지금 신경 쓸 것','최근 7일 푼 문항','난이도별 정답률'].every(x=>t.indexOf(x)>=0) };
  });
  ok('PC — 화면이 그려진다', !pc.err && pc.len>800, pc.err||(pc.len+'자'));
  ok('PC — 요약 다섯 칸이 다 있다', pc.hasTiles===true);
  ok('PC — 오른쪽 카드 셋이 다 있다', pc.hasSide===true);
  ok('PC — 교재 줄이 그려진다', pc.rows>3, pc.rows+'줄 · 집계 교재 '+pc.nbooks+'권');
  ok('PC — 요약 숫자가 집계와 같다', pc.sum && pc.sum.books===pc.nbooks,
     pc.sum?('쓰는 중 '+pc.sum.live+' · 학생 '+pc.sum.students+' · 이번주 '+pc.sum.week+' · 정답률 '+pc.sum.rate+'% · 멈춤 '+pc.sum.stalled):'');

  /* 교재 목록(mf_swb)을 불러와 둔다 — 교차 검증에 필요하다 */
  await p.evaluate(async()=>{ if(!HWB.loaded) await hwbLoad(); });
  await p.waitForTimeout(6000);

  /* 집계값이 서버 기록과 맞는지 — 교재 한 권을 직접 세어 비교 */
  const cross=await p.evaluate(async()=>{
    const D=BD.data;
    const b=D.books.filter(x=>x.state!=='idle' && x.items>200)[0];
    if(!b) return {skip:true};
    const sb=getSupaClient();
    /* 그 교재를 쓰는 학생들의 swId 를 등록부 교재 목록에서 찾는다 */
    const sw=[]; Object.keys(HWB.swb||{}).forEach(code=>{
      (HWB.swb[code]||[]).forEach(bk=>{ if(String(bk.bid)===String(b.bid)) sw.push(bk.swId); });
    });
    if(!sw.length) return {skip:true, why:'swId 못 찾음'};
    let all=[], from=0;
    for(;;){
      const r=await sb.from('mf_answer_records').select('result,workbook_page_id,lumen_rec_code')
        .eq('source','교재').in('student_workbook_id',sw).range(from,from+999);
      const d=(r&&r.data)||[]; all=all.concat(d); if(d.length<1000) break; from+=1000; if(from>20000) break;
    }
    const live=all.filter(x=>x.result!=='-');
    const n=live.filter(x=>x.result==='O'||x.result==='X').length;
    const okn=live.filter(x=>x.result==='O').length;
    const stus={}; live.forEach(x=>{ if(x.lumen_rec_code) stus[x.lumen_rec_code]=1; });
    return { skip:false, title:b.title, bid:b.bid,
             dashItems:b.items, realItems:live.length,
             dashRate:b.rate, realRate:Math.round(okn/n*1000)/10,
             dashStu:b.nstu, realStu:Object.keys(stus).length,
             dashPages:b.map.length };
  });
  ok('실제 기록과 문항 수가 같다', cross.skip||(cross.dashItems===cross.realItems),
     cross.skip?(cross.why||'건너뜀'):(cross.title+' · 상황판 '+cross.dashItems+' vs 실제 '+cross.realItems));
  ok('실제 기록과 정답률이 같다', cross.skip||(Math.abs(cross.dashRate-cross.realRate)<0.2),
     cross.skip?'':(cross.dashRate+'% vs '+cross.realRate+'%'));
  ok('실제 기록과 학생 수가 같다', cross.skip||(cross.dashStu===cross.realStu),
     cross.skip?'':(cross.dashStu+'명 vs '+cross.realStu+'명'));

  /* 교재 펼치기 */
  const openBid=await p.evaluate(()=>{ const b=BD.data.books.filter(x=>x.map&&x.map.length>20)[0]; if(!b) return null; bdOpen(String(b.bid)); return String(b.bid); });
  await p.waitForTimeout(3500);
  const one=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    const b=BD.data.books.filter(x=>String(x.bid)===String(BD.open))[0];
    /* 쪽 지도의 쪽 번호가 교재 쪽 범위 안에 있는지 */
    const mx=Math.max.apply(null,(b.map||[]).map(m=>m.p));
    const mn=Math.min.apply(null,(b.map||[]).map(m=>m.p));
    /* 교재의 실제 마지막 쪽 번호 (pages[] 는 «풀 쪽의 개수»라 쪽 번호와 다르다) */
    let maxPage=0;
    Object.keys(HWB.swb||{}).forEach(code=>{ (HWB.swb[code]||[]).forEach(bk=>{
      if(String(bk.bid)!==String(b.bid)) return;
      (bk.pages||[]).forEach(pg=>{ const v=Number(pg.page); if(v>maxPage) maxPage=v; }); }); });
    /* 진도가 mf_swb 의 COMPLETE 개수와 같은지 */
    let swbDone=null;
    Object.keys(HWB.swb||{}).forEach(code=>{
      (HWB.swb[code]||[]).forEach(bk=>{
        if(String(bk.bid)!==String(b.bid)) return;
        const row=b.stus.filter(s=>s.code===code)[0]; if(!row) return;
        const d=(bk.pages||[]).filter(pg=>pg.st==='COMPLETE').length;
        if(swbDone===null) swbDone=true;
        if(d!==row.done) swbDone=code+' '+d+'≠'+row.done;
      });
    });
    const cells=C?C.querySelectorAll('[title$="문항"],[title*="쪽 ·"]').length:0;
    return { len:t.length, title:b.title, pages:b.pages, maxPage, mapN:b.map.length, mn, mx, swbDone, cells,
             hasStu:t.indexOf('이 교재를 쓰는 학생')>=0, hasMap:t.indexOf('쪽 지도')>=0,
             hasHot:t.indexOf('많이 틀린 쪽')>=0, hasAha:t.indexOf('아하노트')>=0,
             stus:b.stus.length, head:t.slice(0,150) };
  });
  ok('교재 펼침 — 화면이 그려진다', one.len>600, one.title+' · '+one.len+'자');
  ok('교재 펼침 — 학생표·쪽지도·많이틀린쪽·아하노트가 다 있다', one.hasStu&&one.hasMap&&one.hasHot&&one.hasAha);

  /* 아하노트가 실제로 이어졌는지 — 교재 이름이 서로 달라도 붙어야 한다 */
  const aha=await p.evaluate(()=>{
    const D=BD.data; let hit=0, sample='';
    D.books.filter(b=>b.state!=='idle').forEach(b=>{
      const ns=bdAhaOf(b);
      if(ns.length){ hit++; if(!sample) sample=b.title+' ← '+ahaSourceName(ns[0])+' ('+ns.length+'건)'; }
    });
    /* 엉뚱하게 붙지 않았는지 — 학년이 어긋나는 짝이 있으면 실패 */
    let bad='';
    D.books.filter(b=>b.state!=='idle').forEach(b=>{
      const lv=bdLev(b.title); if(!lv) return;
      bdAhaOf(b).forEach(n=>{ const l2=bdLev(ahaSourceName(n)); if(l2 && l2!==lv) bad=b.title+' ↔ '+ahaSourceName(n); });
    });
    return { loaded: !!ahaNotes, hit, sample, bad };
  });
  ok('아하노트가 교재에 이어진다 (이름이 달라도)', !aha.loaded || aha.hit>0, aha.loaded?(aha.hit+'권 · 예: '+aha.sample):'아하노트 미로드');
  ok('엉뚱한 교재에 붙지 않는다 (학년·학기 확인)', !aha.bad, aha.bad||'어긋난 짝 없음');

  /* 단원별 정답률 */
  const un=await p.evaluate(()=>{
    const b=BD.data.books.filter(x=>String(x.bid)===String(BD.open))[0];
    const html=bdUnitList(b);
    const C=document.getElementById('CONTENT'); const t=C?C.innerText:'';
    return { has:html.length>50, onScreen:t.indexOf('어려워하는 단원')>=0 };
  });
  ok('📕 어려워하는 단원이 나온다', un.has&&un.onScreen);
  ok('쪽 지도 쪽 번호가 교재의 실제 쪽 범위 안이다', one.mn>=1 && one.maxPage>0 && one.mx<=one.maxPage,
     one.mn+'~'+one.mx+'쪽 · 교재 마지막 쪽 '+one.maxPage+' · 풀 쪽 '+one.pages+'개 · 지도 '+one.mapN+'칸');
  ok('진도(끝낸 쪽)가 mf_swb 의 COMPLETE 수와 같다', one.swbDone===true, String(one.swbDone));
  ok('쪽 네모가 실제로 그려졌다', one.cells>10, one.cells+'칸');
  await p.screenshot({path:SP+'/v1923_pc_book.png'});

  await p.evaluate(()=>{ bdOpen(null); });
  await p.waitForTimeout(2500);
  await p.screenshot({path:SP+'/v1923_pc_list.png'});

  /* 거르개·정렬 */
  const filt=await p.evaluate(()=>{
    const all=bdRows().length;
    bdSt('stall'); const st=bdRows(); const allStall=st.every(b=>b.state==='stall');
    bdSt('stall'); bdSort('rate'); const r=bdRows();
    let asc=true; for(let i=1;i<r.length;i++){ const a=r[i-1].rate===null?999:r[i-1].rate, c=r[i].rate===null?999:r[i].rate; if(a>c) asc=false; }
    bdSort('recent');
    bdBand('mid'); const mid=bdRows().every(b=>b.band==='mid'); bdBand('mid');
    return { all, stallN:st.length, allStall, asc, mid };
  });
  ok('🔴 멈춤 거르개가 맞게 걸러진다', filt.allStall===true, filt.stallN+'권');
  ok('정답률 낮은 순 정렬이 맞다', filt.asc===true);
  ok('중등 거르개가 맞게 걸러진다', filt.mid===true);

  /* 폰 */
  const ph=await ctx.newPage();
  ph.on('pageerror',e=>errs.push('폰: '+String(e.message).slice(0,160)));
  await ph.setViewportSize({width:390,height:844});
  await ph.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
  await ph.route('**/*', async r=>{
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
  await ph.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await ph.waitForTimeout(15000);
  await ph.evaluate(()=>{ MOB.view='grd'; mobGrdTab('bk'); });
  await ph.waitForTimeout(8000);
  const m1=await ph.evaluate(()=>{
    const ov=document.getElementById('MOB_OV');
    const t=ov?ov.innerText.replace(/\s+/g,' '):document.body.innerText.replace(/\s+/g,' ');
    return { len:t.length, tab:MOB.grdTab, cards:ov?ov.querySelectorAll('[onclick^="bdOpen"]').length:0,
             chip3:t.indexOf('교재별')>=0 && t.indexOf('학생별')>=0 && t.indexOf('학습지별')>=0,
             tiles:t.indexOf('쓰는 교재')>=0 && t.indexOf('평균 정답률')>=0 && t.indexOf('멈춘 교재')>=0 };
  });
  ok('폰 — 「교재별」 칩이 셋 다 보인다', m1.chip3===true);
  ok('폰 — 요약 세 칸이 있다', m1.tiles===true, m1.len+'자');
  ok('폰 — 교재 카드가 그려진다', m1.cards>2, m1.cards+'장');
  await ph.screenshot({path:SP+'/v1923_mob_list.png'});

  const m2=await ph.evaluate(()=>{ const b=BD.data.books.filter(x=>x.state!=='idle')[0]; bdOpen(String(b.bid)); return String(b.bid); });
  await ph.waitForTimeout(2500);
  const m3=await ph.evaluate(()=>{
    const ov=document.getElementById('MOB_OV');
    const t=ov?ov.innerText.replace(/\s+/g,' '):'';
    return { len:t.length, back:t.indexOf('←')>=0 };
  });
  ok('폰 — 교재 하나를 열면 학생이 나온다', m3.len>200, m3.len+'자');
  await ph.screenshot({path:SP+'/v1923_mob_one.png'});

  /* 회귀 — 기존 폰 화면 */
  const reg=await ph.evaluate(()=>{
    bdOpen(null); mobGrdTab('stu');
    const a=document.getElementById('MOB_OV'); const t1=a?a.innerText.length:0;
    mobGrdTab('ws');
    const t2=document.getElementById('MOB_OV')?document.getElementById('MOB_OV').innerText.length:0;
    return { stu:t1, ws:t2 };
  });
  await ph.waitForTimeout(2000);
  ok('회귀 — 폰 학생별·학습지별이 그대로 돈다', reg.stu>100 && reg.ws>100, '학생별 '+reg.stu+'자 · 학습지별 '+reg.ws+'자');

  const reg2=await p.evaluate(()=>{
    VIEW='bookprog'; render(); const a=document.getElementById('CONTENT').innerText.length;
    VIEW='lgall'; render(); const c=document.getElementById('CONTENT').innerText.length;
    return { bp:a, lg:c };
  });
  await p.waitForTimeout(2000);
  ok('회귀 — PC 진도 현황·리그 한눈에가 그대로 돈다', reg2.bp>200 && reg2.lg>200, '진도 '+reg2.bp+'자 · 리그 '+reg2.lg+'자');

  ok('자바스크립트 오류 없음', errs.length===0, errs.slice(0,3).join(' | '));
  await b.close();
  console.log(out.join('\n'));
  console.log('\n결과: '+(out.length-bad)+'/'+out.length+(bad?' ❌':' 통과 ✅'));
  process.exit(bad?1:0);
})();
