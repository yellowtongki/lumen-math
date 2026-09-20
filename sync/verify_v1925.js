/* v19-24 검증 — 📊 매쓰플랫 현황 한 탭으로 (docs/mathflat_hub_contract.md) */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'lumen_v19-25.html';
const WANT=process.argv[3]||'v19-25';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,170)):'')); };

/* ── 글자 검사 ── */
ok('APP_VER = '+WANT, new RegExp("APP_VER = '"+WANT+"'").test(src));
ok('탭 이름이 「매쓰플랫 현황」으로 바뀌었다', /\{v:'bookdash'[^}]*label:'매쓰플랫 현황'/.test(src));
ok('새 탭을 만들지 않았다 (VIEW 값 그대로)', /VIEW==='bookdash'/.test(src) && src.indexOf("v:'mfhub'")<0);
ok('「학습지 채점」 탭이 없어졌다', src.indexOf("label:'학습지 채점'")<0);
ok('옛 바로가기가 학습지별로 넘어간다', /VIEW==='wsgrade'\)\{ VIEW='bookdash'; MF\.tab='sheet'/.test(src));
ok('칩 네 개가 있다', /\['all','한눈에'\],\['book','📗 교재별'\],\['sheet','📄 학습지별'\],\['stu','👤 학생별'\]/.test(src));
ok('학습지 화면은 그대로 쓴다 (다시 만들지 않았다)', /MF\.tab==='sheet'|t==='sheet'/.test(src) && /rWsGrade\(\)/.test(src));
ok('새로 세지 않는다 — 세 모델을 합칠 뿐', /function mfStuModel/.test(src) && /wsgModel\(\)/.test(src) && /hwbModel\(\)/.test(src) && /BD\.data/.test(src));
ok('폰 칩 다섯 개 그대로', /\['all','한눈에'\],\['bk','📗 교재'\],\['ws','📄 학습지'\],\['mfstu','👤 학생'\],\['stu','⚠️ 확인'\]/.test(src));
ok('폰 아래탭 이름이 매쓰플랫', /\['grd','📊','매쓰플랫'\]/.test(src));
ok('기존 화면이 그대로 있다', ['function rWsGrade','function rBookProg','function rHwBook','function mobWsg','function mobGrdListHtml','function mobGrdDetail','function rBdBook'].every(f=>src.indexOf(f)>0));
ok('학습지 문제 그림을 띄우지 않는다 (시험지 규칙)', !/rMfStu[^]{0,7000}pimg/.test(src));

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1500,height:1000}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,180)));
  const route=async r=>{
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
  };
  await p.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
  await p.route('**/*', route);
  await p.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(15000);

  /* 한눈에 */
  await p.evaluate(()=>{ VIEW='bookdash'; MF.tab='all'; render(); });
  await p.waitForTimeout(22000);                     /* 교재·학습지·자기채점 셋 다 읽는다 */
  const all=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    return { len:t.length, tab:MF.tab,
      chips:['한눈에','📗 교재별','📄 학습지별','👤 학생별'].every(x=>t.indexOf(x)>=0),
      tiles:['오늘 푼 문항','이번 주 문항','평균 정답률','훑어볼 자기채점','반영 대기','멈춘 교재'].every(x=>t.indexOf(x)>=0),
      noWrongName:(t.indexOf('확인 필요')<0 && t.indexOf('애매하다고 표시')<0),
      badWord:(t.indexOf('확인 필요')>=0?'「확인 필요」가 아직 있음':''),
      split:(()=>{ const n=mfAllNums(); const m=mfHwb().reduce((a,x)=>a+(x.selfRows||[]).length,0);
                   return n.chk===m && (n.chkX+n.chkQ)<=n.chk; })(),
      todo:t.indexOf('오늘 할 일')>=0, week:t.indexOf('최근 7일')>=0, eye:t.indexOf('눈에 띄는 것')>=0,
      loaded:{bd:BD.loaded, wsg:WSG.loaded, hwb:HWB.loaded},
      nums:mfAllNums() };
  });
  ok('PC 한눈에 — 화면이 그려진다', all.len>800, all.len+'자');
  ok('PC 한눈에 — 칩 네 개가 다 있다', all.chips===true);
  ok('PC 한눈에 — 요약 여섯 칸이 다 있다', all.tiles===true);
  ok('「확인 필요」라는 틀린 이름이 사라졌다', all.noWrongName===true, all.badWord||'');
  ok('자기채점을 ◯·✗·애매로 나눠 센다', all.split===true,
     all.nums?('전체 '+all.nums.chk+'건 · ✗ '+all.nums.chkX+' · 애매 '+all.nums.chkQ):'');
  ok('PC 한눈에 — 오늘 할 일·7일 막대·눈에 띄는 것', all.todo&&all.week&&all.eye);
  ok('세 자료를 다 읽었다', all.loaded.bd&&all.loaded.wsg&&all.loaded.hwb, JSON.stringify(all.loaded));
  ok('한눈에 숫자가 나온다', all.nums && all.nums.S && all.nums.S.books>0,
     all.nums?('오늘 교재 '+all.nums.bkToday+'+학습지 '+all.nums.wsToday+' · 이번주 '+(all.nums.bkWeek+all.nums.wsWeek)+' · 확인 '+all.nums.chk+' · 대기 '+all.nums.pend):'');
  await p.screenshot({path:SP+'/v1924_pc_all.png'});

  /* 한눈에 숫자 ↔ 각 화면 숫자 대조 */
  const cross=await p.evaluate(()=>{
    const N=mfAllNums();
    /* 확인 필요 = 자기채점 화면의 합계와 같아야 한다 */
    let chk=0, pend=0; hwbModel().forEach(x=>{ chk+=(x.selfRows||[]).length; pend+=(x.pend||0); });
    /* 멈춘 교재 = 교재별 화면의 멈춤 칩 수 */
    const stall=BD.data.books.filter(b=>b.state==='stall').length;
    /* 학생별 표의 확인 필요 합계도 같아야 한다 */
    const rows=mfStuModel();
    const sumChk=rows.reduce((a,r)=>a+r.chk,0), sumPend=rows.reduce((a,r)=>a+r.pend,0);
    /* 학습지 장수 */
    const sheets=wsgModel().length;
    const sumSheets=new Set(); rows.forEach(r=>r.sheets.forEach(s=>sumSheets.add(String(s.wid))));
    return { nChk:N.chk, chk, nPend:N.pend, pend, nStall:N.S.stalled, stall,
             sumChk, sumPend, students:rows.length, sheets, sumSheets:sumSheets.size };
  });
  ok('「확인 필요」가 자기채점 화면의 합계와 같다', cross.nChk===cross.chk, cross.nChk+' vs '+cross.chk);
  ok('「반영 대기」가 대기열 합계와 같다', cross.nPend===cross.pend, cross.nPend+' vs '+cross.pend);
  ok('「멈춘 교재」가 교재별 화면과 같다', cross.nStall===cross.stall, cross.nStall+' vs '+cross.stall);
  ok('학생별 표의 확인 필요 합계가 한눈에와 같다', cross.sumChk===cross.nChk, cross.sumChk+' vs '+cross.nChk);
  ok('학생별 표의 반영 대기 합계가 한눈에와 같다', cross.sumPend===cross.nPend, cross.sumPend+' vs '+cross.nPend);
  ok('학습지가 학생에게 이어졌다', cross.sumSheets>0, '학습지 '+cross.sheets+'장 중 '+cross.sumSheets+'장이 학생에 붙음 · 학생 '+cross.students+'명');

  /* 교재별 — v19-23 과 같은지 */
  await p.evaluate(()=>{ mfTab('book'); });
  await p.waitForTimeout(3000);
  const bk=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    return { len:t.length, rows:C.querySelectorAll('[onclick^="bdOpen"]').length,
             tiles:['쓰고 있는 교재','교재 푸는 학생','평균 정답률'].every(x=>t.indexOf(x)>=0),
             side:['지금 신경 쓸 것','최근 7일 푼 문항','난이도별 정답률'].every(x=>t.indexOf(x)>=0) };
  });
  ok('📗 교재별 — v19-23 화면이 그대로 나온다', bk.tiles&&bk.side&&bk.rows>3, bk.rows+'줄 · '+bk.len+'자');
  /* 교재 펼치기도 되는지 */
  const bkOne=await p.evaluate(()=>{ const b=BD.data.books.filter(x=>x.map&&x.map.length>20)[0]; bdOpen(String(b.bid)); return 1; });
  await p.waitForTimeout(2500);
  const bkOneT=await p.evaluate(()=>{ const t=document.getElementById('CONTENT').innerText;
    return { map:t.indexOf('쪽 지도')>=0, stu:t.indexOf('이 교재를 쓰는 학생')>=0, chip:t.indexOf('📄 학습지별')>=0 }; });
  ok('📗 교재 펼침이 그대로 되고 칩 줄도 남는다', bkOneT.map&&bkOneT.stu&&bkOneT.chip);
  await p.evaluate(()=>{ bdOpen(null); });
  await p.waitForTimeout(1500);

  /* 학습지별 — 옛 화면 그대로인지 */
  await p.evaluate(()=>{ mfTab('sheet'); });
  await p.waitForTimeout(4000);
  const sh=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    return { len:t.length, head:t.indexOf('📄 학습지 채점')>=0, key:t.indexOf('정답 대장')>=0,
             same:(t.indexOf('매쓰플랫은 객관식만')>=0), chip:t.indexOf('👤 학생별')>=0 };
  });
  ok('📄 학습지별 — 옛 화면이 글자 그대로 나온다', sh.head&&sh.key&&sh.same, sh.len+'자');
  ok('📄 학습지별 — 위에 칩 줄이 남는다', sh.chip===true);

  /* 옛 바로가기 */
  const legacy=await p.evaluate(()=>{ VIEW='wsgrade'; render(); return { view:VIEW, tab:MF.tab }; });
  await p.waitForTimeout(2500);
  ok('옛 바로가기(VIEW=wsgrade)가 학습지별로 넘어간다', legacy.view==='bookdash'&&legacy.tab==='sheet', legacy.view+' / '+legacy.tab);

  /* 학생별 */
  await p.evaluate(()=>{ mfTab('stu'); });
  await p.waitForTimeout(3500);
  const st=await p.evaluate(()=>{
    const C=document.getElementById('CONTENT'); const t=C?C.innerText.replace(/\s+/g,' '):'';
    const rows=mfStuRows();
    return { len:t.length, rows:C.querySelectorAll('[onclick^="mfStu"]').length, model:rows.length,
             head:['학생','📗 교재','📄 학습지','자기채점','반영 대기'].every(x=>t.indexOf(x)>=0),
             first:rows[0]?{ name:rows[0].name, books:rows[0].books.length, sheets:rows[0].sheets.length,
                             rate:rows[0].bookRate, avg:rows[0].shAvg, chk:rows[0].chk }:null };
  });
  ok('👤 학생별 — 표가 그려진다', st.head&&st.rows>3, st.rows+'줄 · 학생 '+st.model+'명');
  ok('👤 학생별 — 한 줄에 교재와 학습지가 함께 있다', st.first && (st.first.books>0||st.first.sheets>0),
     st.first?(st.first.name+' · 교재 '+st.first.books+'권 · 학습지 '+st.first.sheets+'장 · 교재 정답률 '+st.first.rate+' · 학습지 평균 '+st.first.avg):'');

  /* 학생별 값이 교재별·학습지별 값과 같은지 */
  const same=await p.evaluate(()=>{
    const rows=mfStuModel();
    const r=rows.filter(x=>x.books.length&&x.sheets.length)[0];
    if(!r) return {skip:true};
    /* 교재: book_dash 의 그 학생 줄과 같아야 한다 */
    let bookOk=true, bookWhy='';
    r.books.forEach(bb=>{
      const b=BD.data.books.filter(x=>String(x.bid)===String(bb.bid))[0];
      const s=b.stus.filter(x=>x.code===r.code)[0];
      if(!s || s.done!==bb.done || s.rate!==bb.rate){ bookOk=false; bookWhy=b.title; }
    });
    /* 학습지: wsgModel 의 그 학생 행과 같아야 한다 */
    let shOk=true, shWhy='';
    r.sheets.forEach(ss=>{
      const sh=wsgModel().filter(x=>String(x.wid)===String(ss.wid))[0];
      const row=sh?sh.rows.filter(x=>x.code===r.code)[0]:null;
      if(!row || row.score!==ss.score || row.mfScore!==ss.mfScore){ shOk=false; shWhy=ss.title; }
    });
    return { skip:false, name:r.name, bookOk, bookWhy, shOk, shWhy, nb:r.books.length, ns:r.sheets.length };
  });
  ok('학생별의 교재 값이 교재별 화면과 같다', same.skip||same.bookOk, same.skip?'겹치는 학생 없음':(same.name+' 교재 '+same.nb+'권'+(same.bookWhy?(' ✗'+same.bookWhy):'')));
  ok('학생별의 학습지 값이 학습지별 화면과 같다', same.skip||same.shOk, same.skip?'':(same.name+' 학습지 '+same.ns+'장'+(same.shWhy?(' ✗'+same.shWhy):'')));

  /* 펼치기 */
  const panel=await p.evaluate(()=>{ const r=mfStuRows().filter(x=>x.books.length&&x.sheets.length)[0]||mfStuRows()[0]; mfStu(r.code); return r.name; });
  await p.waitForTimeout(2500);
  const pt=await p.evaluate(()=>{ const t=document.getElementById('CONTENT').innerText;
    return { book:t.indexOf('이 학생의 교재')>=0, sheet:t.indexOf('이 학생의 학습지')>=0 }; });
  ok('👤 학생 펼침 — 교재와 학습지가 나란히 나온다', pt.book&&pt.sheet, panel);
  await p.screenshot({path:SP+'/v1924_pc_stu.png'});

  /* 거르개 */
  const filt=await p.evaluate(()=>{
    mfStu(null); mfOnly('chk'); const a=mfStuRows(); const allChk=a.every(r=>(r.chkX+r.chkQ)>0);
    mfOnly('chk'); mfSort('wrong'); const w=mfStuRows();
    let wrongSort=true; for(let i=1;i<w.length;i++){ if((w[i-1].chkQ*3+w[i-1].chkX)<(w[i].chkQ*3+w[i].chkX)) wrongSort=false; }
    mfSort('watch'); mfOnly('chk');
    mfOnly('chk'); mfOnly('dead'); const d=mfStuRows(); const allDead=d.every(r=>r.gone>=7&&r.gone<900);
    mfOnly('dead'); mfBand('mid'); const m=mfStuRows().every(r=>r.band==='mid'); mfBand('mid');
    return { chkN:a.length, allChk, wrongSort, deadN:d.length, allDead, m };
  });
  ok('✗·애매 있는 학생 거르개가 맞다', filt.allChk===true, filt.chkN+'명');
  ok('✗ 많은 순 정렬이 맞다', filt.wrongSort===true);
  ok('🔴 채점 끊김 거르개가 맞다', filt.allDead===true, filt.deadN+'명');
  ok('중등 거르개가 맞다', filt.m===true);

  /* 회귀 — 기존 PC 화면 */
  const reg=await p.evaluate(()=>{
    VIEW='bookprog'; render(); const a=document.getElementById('CONTENT').innerText.length;
    VIEW='lgall'; render(); const c=document.getElementById('CONTENT').innerText.length;
    VIEW='hwcheck'; render(); const d=document.getElementById('CONTENT').innerText.length;
    return { bp:a, lg:c, hw:d };
  });
  await p.waitForTimeout(2000);
  ok('회귀 — 진도 현황·리그 한눈에·숙제체크가 그대로', reg.bp>200&&reg.lg>200&&reg.hw>200, '진도 '+reg.bp+' · 리그 '+reg.lg+' · 숙제 '+reg.hw);

  /* 폰 */
  const ph=await ctx.newPage();
  ph.on('pageerror',e=>errs.push('폰: '+String(e.message).slice(0,160)));
  await ph.setViewportSize({width:390,height:844});
  await ph.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
  await ph.route('**/*', route);
  await ph.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await ph.waitForTimeout(15000);
  await ph.evaluate(()=>{ MOB.view='grd'; mobGrdTab('all'); });
  await ph.waitForTimeout(20000);
  const m1=await ph.evaluate(()=>{
    const ov=document.getElementById('MOB_OV');
    const t=ov?ov.innerText.replace(/\s+/g,' '):'';
    return { len:t.length, tab:MOB.grdTab,
      chips:['한눈에','📗 교재','📄 학습지','👤 학생','⚠️ 확인'].every(x=>t.indexOf(x)>=0),
      todo:t.indexOf('오늘 할 일')>=0, week:t.indexOf('최근 7일')>=0 };
  });
  ok('폰 한눈에 — 칩 다섯 개가 다 있다', m1.chips===true);
  ok('폰 한눈에 — 오늘 할 일·7일 막대', m1.todo&&m1.week, m1.len+'자');
  await ph.screenshot({path:SP+'/v1924_mob_all.png'});

  await ph.evaluate(()=>{ mobGrdTab('mfstu'); });
  await ph.waitForTimeout(3000);
  const m2=await ph.evaluate(()=>{
    const ov=document.getElementById('MOB_OV');
    return { len:ov?ov.innerText.length:0, cards:ov?ov.querySelectorAll('[onclick^="mfStu"]').length:0 };
  });
  ok('폰 학생별 — 카드가 그려진다', m2.cards>2, m2.cards+'장');
  await ph.screenshot({path:SP+'/v1924_mob_stu.png'});

  /* 폰 회귀 — 확인 필요 고치기·학습지·교재 */
  const mreg=await ph.evaluate(()=>{
    mobGrdTab('stu'); const a=document.getElementById('MOB_OV').innerText.length;
    mobGrdTab('ws');  const c=document.getElementById('MOB_OV').innerText.length;
    mobGrdTab('bk');  const d=document.getElementById('MOB_OV').innerText.length;
    return { chk:a, ws:c, bk:d };
  });
  await ph.waitForTimeout(2500);
  ok('폰 회귀 — ⚠️확인·학습지·교재가 그대로', mreg.chk>100&&mreg.ws>100&&mreg.bk>100, '확인 '+mreg.chk+' · 학습지 '+mreg.ws+' · 교재 '+mreg.bk);

  ok('자바스크립트 오류 없음', errs.length===0, errs.slice(0,3).join(' | '));
  await b.close();
  console.log(out.join('\n'));
  console.log('\n결과: '+(out.length-bad)+'/'+out.length+(bad?' ❌':' 통과 ✅'));
  process.exit(bad?1:0);
})();
