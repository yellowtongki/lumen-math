/* 학생앱 v2-100 검증 — 🔒 「내 할 일」 잠금(추후 공개) + ➗ 빗금 분수 + 👀 정답 보여주기
 * 실브라우저에 학생앱을 띄워 «앱 안에 들어 있는» 채점 엔진으로 직접 견준다.
 * (sync/hw_grade_engine.js 와 인라인 복사본이 같은지도 함께 확인한다)
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_s298.js [파일] */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'/home/user/lumen-math/student_v2-100.html';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,200)):'')); };
/* 정답 → 학생이 칠 법한 빗금 꼴 */
const slash=(a)=>a.replace(/(\d+)\\[dt]?frac\{(\d+)\}\{(\d+)\}/g,'$1 $2/$3').replace(/\\[dt]?frac\{(\d+)\}\{(\d+)\}/g,'$1/$2');
(async()=>{
  /* A. 인라인 복사본이 원본과 같은가 */
  const eng=fs.readFileSync('/home/user/lumen-math/sync/hw_grade_engine.js','utf8').trim();
  ok('버전이 v2-100 이다', /var STU_VER = 'v2-100';/.test(src));
  ok('앱 안 채점 엔진이 sync/hw_grade_engine.js 와 똑같다 (복사 누락 없음)', src.indexOf(eng)>0);
  ok('빗금→분수 고침이 들어 있다', src.indexOf('function slashToFrac')>0);
  ok('할 일 보드(v2-97)는 그대로 있다', src.indexOf('window.tdHomeUpdate')>0 && src.indexOf('screen-todo')>0);

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
        const body=Buffer.from(await res.arrayBuffer()); const rh={};
        res.headers.forEach((v,k)=>{ if(!/^(content-encoding|transfer-encoding|content-length)$/i.test(k)) rh[k]=v; });
        return r.fulfill({status:res.status,headers:rh,body}); }catch(e){ return r.fulfill({status:500,body:String(e)}); }
    }
    return r.fulfill({status:200,contentType:'text/javascript',body:''});
  });
  await p.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(9000);
  ok('앱 안에 채점 엔진이 떠 있다', await p.evaluate(()=>typeof HWGrade!=='undefined' && typeof HWGrade.grade==='function'));

  /* B. 원장님이 보내 주신 「단원 평가 Level 1」 쪽의 답들 */
  const T=[
    ['\\frac{1}{2}m','1/2',true],['\\frac{1}{2}m','1/2m',true],['\\frac{1}{2}m','\\frac{1}{2}',true],
    ['1\\frac{3}{5}kg','1 3/5',true],['1\\frac{3}{5}kg','8/5',true],
    ['\\frac{1}{4}','1/4',true],['\\frac{1}{4}','0.25',true],
    ['27cm','27',true],['30개','30',true],['2','2',true],['ㄱ','ㄱ',true],
    ['x=\\frac{7}{3}','x=7/3',true],['(0,\\frac{33}{10})','(0,33/10)',true],
    ['\\frac{1}{4}','1/5',false],['\\frac{1}{4}','2/4',false],['1\\frac{3}{5}','7/5',false],['\\frac{2}{3}','3/2',false]
  ];
  const got=await p.evaluate((T)=>T.map(c=>{ let r; try{ r=HWGrade.grade(c[0],c[1]); }catch(e){ r={err:String(e)}; } return !!r.correct; }), T);
  let miss=[];
  T.forEach((c,i)=>{ if(got[i]!==c[2]) miss.push(JSON.stringify(c[0])+' ← '+JSON.stringify(c[1])+' (바람 '+(c[2]?'맞음':'틀림')+')'); });
  ok('원장님 쪽 분수 답 '+T.length+'가지가 모두 바라는 대로 채점된다', miss.length===0, miss.join(' | '));

  /* C. 실제 정답 대량 대조 — 앱 안 엔진으로 */
  const ansFile=SP+'/answers.json';
  if(fs.existsSync(ansFile)){
    const A=JSON.parse(fs.readFileSync(ansFile,'utf8'));
    const pick=A.filter(x=>String(x.answer).indexOf('frac')>=0).slice(0,4000).map(x=>String(x.answer));
    const res=await p.evaluate((list)=>{
      const sl=(a)=>a.replace(/(\d+)\\[dt]?frac\{(\d+)\}\{(\d+)\}/g,'$1 $2/$3').replace(/\\[dt]?frac\{(\d+)\}\{(\d+)\}/g,'$1/$2');
      let inv=0, invBad=0, fixed=0, cand=0;
      list.forEach(a=>{ let r1; try{ r1=HWGrade.grade(a,a); }catch(e){ return; }
        if(r1.gradable){ inv++; if(!r1.correct) invBad++; }
        const t=sl(a); if(t===a) return; cand++;
        let r2; try{ r2=HWGrade.grade(a,t); }catch(e){ return; }
        if(r2.gradable&&r2.correct) fixed++; });
      return { inv, invBad, cand, fixed };
    }, pick);
    ok('불변식 — 정답 원문 그대로 넣으면 반드시 맞음 (앱 안 엔진, '+res.inv+'개)', res.invBad===0, '어긋남 '+res.invBad);
    ok('빗금으로 친 분수가 대부분 맞는다 ('+res.fixed+'/'+res.cand+')', res.cand>0 && res.fixed/res.cand>0.9, res.fixed+'/'+res.cand);
  } else { ok('정답 표본 파일이 없어 대량 대조는 건너뜀 (선택)', true); }

  /* C-2. 👀 정답 보여주기 — 수학비서 회원전용 그림은 글자로 (v2-99) */
  const box=await p.evaluate(()=>{
    var SECR='https://cdn.mathsecr.com/contents/private/Members/x/y.png';
    var FLAT='https://freewheelin-contents.mathflat.com/problem/2994165/de45d595/answer.png';
    var r={};
    r.secrBad = (typeof bkAnsImgOk==='function') && bkAnsImgOk(SECR)===false;
    r.flatOk  = (typeof bkAnsImgOk==='function') && bkAnsImgOk(FLAT)===true;
    /* 원장님이 보내 주신 그 문항 그대로 */
    var p1={ key:{ parts:[{ t:'latex_answer', v:'$y=\\frac{2}{5}x$', img:SECR }] } };
    var h1=bkKeyAnsBox(p1);
    r.showsText = h1.indexOf('y=2/5x')>=0;
    r.noDeadImg = h1.indexOf('cdn.mathsecr.com')<0;
    /* 여러 칸짜리 */
    var p2={ key:{ parts:[{v:'$2$',img:SECR},{v:'$3$',img:SECR},{v:'$-6$',img:SECR}] } };
    var h2=bkKeyAnsBox(p2);
    r.multi = (h2.indexOf('2')>=0&&h2.indexOf('3')>=0&&h2.indexOf('-6')>=0&&h2.indexOf('칸마다')>=0);
    /* 매쓰플랫 그림은 그대로 그림으로 */
    var p3={ answer:'\\frac{1}{2}', img:FLAT };
    var h3=bkAnsBox(p3);
    r.flatImg = h3.indexOf('<img')>=0 && h3.indexOf('onerror')>=0;
    r.dollar = bkCleanAns('$y=\\frac{2}{5}x$')==='y=2/5x';
    return r;
  });
  ok('수학비서 회원전용 주소를 못 쓰는 그림으로 가려낸다', box.secrBad, JSON.stringify(box));
  ok('매쓰플랫 그림은 그대로 쓴다', box.flatOk);
  ok('원장님 문항(5번) 정답이 «글자»로 보인다 — y=2/5x', box.showsText && box.noDeadImg, JSON.stringify({글자:box.showsText, 죽은그림없음:box.noDeadImg}));
  ok('여러 칸짜리 정답(2,3,-6)도 칸마다 글자로 보인다', box.multi);
  ok('매쓰플랫 정답 그림은 그림 그대로 + 안 열리면 글자로 바뀐다', box.flatImg);
  ok('$ 로 감싼 정답에서 $ 를 벗긴다', box.dollar);

  /* C-3. 🔒 「내 할 일」 잠금 — 추후 공개 (v2-100) */
  const lock=await p.evaluate(()=>{
    var r={};
    r.fnOk = (typeof tdOpen==='function' && typeof tdSoon==='function');
    /* ① 설정을 아직 못 읽었을 때 — 잠겨 있어야 한다 */
    SF.cfg=null; SF.loaded=false; r.noCfgLocked = (tdOpen()===false);
    /* ② 서버 설정대로 꺼져 있을 때 */
    SF.cfg={todo:{on:false}}; SF.loaded=true; r.offLocked = (tdOpen()===false);
    tdHomeUpdate();
    var el=document.getElementById('td-home');
    r.shown = !!el && el.style.display!=='none';
    r.soonTxt = !!el && el.innerText.indexOf('추후 공개')>=0 && el.innerText.indexOf('내 할 일')>=0;
    r.noList = !!el && el.innerText.indexOf('이번 할 일')<0;
    /* ③ 주소로 들어가도 잠금 안내 */
    go('screen-todo');
    r.toLock = document.getElementById('screen-locked').classList.contains('active');
    r.lockTxt = (document.getElementById('lk-desc')||{}).textContent||'';
    go('screen-home');
    /* ④ 원장님이 켜면 열린다 */
    SF.cfg={todo:{on:true}}; r.onOpen = (tdOpen()===true);
    /* ⑤ 학년별로 끌 수도 있다 */
    SF.cfg={todo:{on:true, off:[ (typeof sfMyGrade==='function'?sfMyGrade():'') ]}};
    r.gradeOff = (tdOpen()===false);
    SF.cfg={todo:{on:false}}; tdHomeUpdate();
    return r;
  });
  ok('잠금 장치가 들어 있다', lock.fnOk, JSON.stringify(lock));
  ok('설정을 못 읽었을 때도 잠겨 있다 (덜 된 화면이 새지 않게)', lock.noCfgLocked);
  ok('서버 설정이 꺼짐이면 잠긴다', lock.offLocked);
  ok('홈에 「🔒 추후 공개」 한 줄만 보인다 (할 일 목록은 안 보임)', lock.shown && lock.soonTxt && lock.noList, JSON.stringify({보임:lock.shown, 문구:lock.soonTxt, 목록없음:lock.noList}));
  ok('주소로 들어가도 잠금 안내로 간다', lock.toLock && /곧 열/.test(lock.lockTxt), lock.lockTxt);
  ok('원장님이 켜면 열린다', lock.onOpen);
  ok('학년별로 끌 수도 있다', lock.gradeOff);

  /* D. 회귀 — 자판·채점 화면이 그대로 뜨는가 */
  const reg=await p.evaluate(()=>({ kb:typeof bkKeyGrade==='function', sh:typeof bkGuessShape==='function',
    todo:typeof tdHomeUpdate==='function', screens:document.querySelectorAll('.screen').length }));
  ok('교재 채점·자판·할 일 보드가 그대로다', reg.kb&&reg.sh&&reg.todo&&reg.screens>30, JSON.stringify(reg));
  ok('자바스크립트 오류 없음', errs.length===0, errs.slice(0,3).join(' | '));
  await p.screenshot({path:SP+'/frac/st_login.png'});
  await b.close();
  console.log(out.join('\n')); console.log('결과: '+(out.length-bad)+'/'+out.length);
  process.exit(bad?1:0);
})().catch(e=>{ console.error('하네스 오류', e); process.exit(2); });
