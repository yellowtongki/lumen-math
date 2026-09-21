/* v19-27 검증 — 📝 백지테스트 (docs/blank_test_contract.md §7)
 * 실브라우저로 재료 → 초안 → 보관 → 인쇄 HTML → 할 일 보드 카드까지 왕복한다.
 * AI 는 부르지 않는다 (callAI 를 정해진 답으로 바꿔 끼운다) — 돈이 들지 않고 열쇠도 필요 없다.
 * 검증으로 만든 것은 끝에 전부 치운다. 학생 이름은 출력하지 않는다.
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_v1927.js [파일] */
const { chromium } = require('playwright'); const fs=require('fs');
const FILE=process.argv[2]||'/home/user/lumen-math/lumen_v19-27.html';
const SP=process.env.SP||'/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad';
const src=fs.readFileSync(FILE,'utf8');
const out=[]; let bad=0;
const ok=(n,c,x)=>{ if(!c) bad++; out.push((c?'  ✅ ':'  ❌ ')+n+(x!==undefined&&x!==''?(' — '+String(x).slice(0,200)):'')); };
async function route(p){
  await p.addInitScript(()=>{ sessionStorage.setItem('lumen_login_session',JSON.stringify({expires:Date.now()+1800000})); });
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
}
(async()=>{
  /* A. 소스 검사 */
  ok('버전이 바뀌었다', new RegExp("APP_VER = '"+(process.argv[3]||'v19-27')+"'").test(src));
  ok('탭이 생겼다', /\{v:'blank'[^}]*label:'백지테스트'/.test(src));
  ok('AI 는 1부만 쓴다고 프롬프트에 박혀 있다', src.indexOf('«백지테스트 1부 — 개념 백지»')>0 || src.indexOf('백지테스트 1부')>0);
  ok('할 일 보드·매쓰플랫 현황 화면이 그대로 있다', ['function rTodo','function rMfHub','function rTypeAch','function rAhaNote'].every(f=>src.indexOf(f)>0));

  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1500,height:1000}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,180)));
  await route(p);
  await p.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000});
  await p.waitForTimeout(15000);
  /* AI 를 정해진 답으로 바꿔 끼운다 */
  await p.evaluate(()=>{ window._aiCalls=0; window.callAI=async function(pr){ window._aiCalls++; window._lastPrompt=pr;
    return '{"title":"백지테스트 — 검증","p1":[{"type":"blank","q":"부등식의 양변에 [[  ]] 를 곱하면 부등호 방향이 바뀐다.","a":"음수"},{"type":"write","q":"ax>b (a<0) 의 해를 구하는 과정을 쓰시오.","a":"양변을 a로 나누고 부등호를 뒤집는다"}]}'; };
  });
  await p.evaluate(()=>{ VIEW='blank'; render(); });
  await p.waitForTimeout(9000);
  let t=await p.evaluate(()=>({ loaded:BT.loaded, err:BT.err, txt:document.getElementById('CONTENT').innerText.replace(/\s+/g,' ').slice(0,200) }));
  ok('화면이 뜨고 보관함을 읽었다', t.loaded && !t.err, JSON.stringify(t));

  /* ① 재료가 실제 기록과 같은지 — 막힌 문제가 가장 많은 학생으로 */
  const pick=await p.evaluate(()=>{
    var best=null, bn=-1;
    btActive().forEach(function(s){ var c=String(s.lumen_rec_code); var m=btMat(c);
      var n=m.stuck.length+m.aha.length; if(n>bn){ bn=n; best={ code:c, stuck:m.stuck.length, aha:m.aha.length, weak:m.weak.length, books:m.books.length }; } });
    return best;
  });
  ok('학생을 찾았다', !!pick && !!pick.code, JSON.stringify(pick));
  const code=pick.code;
  /* 앱이 센 막힌 문제 수 vs 서버 mf_stuck 원자료를 직접 센 수 */
  const cmp=await p.evaluate((code)=>{
    var days=BT.cfg.days||21;
    var lim=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
    var map=(HWC&&HWC.stuck)||{}; var seen={}, raw=0;
    Object.keys(map).forEach(function(k){ var q=k.split('|'); if(q[0]!==code||q[1]<lim) return;
      (map[k]||[]).forEach(function(x){ var tt=String(x.t||''); if(!tt||seen[tt]) return; seen[tt]=1; raw++; }); });
    return { raw:raw, app:btMat(code).stuck.length, ahaRaw:(typeof ahaPPending==='function'?ahaPPending(code).length:-1), ahaApp:btMat(code).aha.length };
  },code);
  ok('① 막힌 문제 수가 원자료와 같다', cmp.raw===cmp.app, JSON.stringify(cmp));
  ok('① 아하노트 미해결 수가 앱의 기존 계산(ahaPPending)과 같다', cmp.ahaRaw<0||cmp.ahaRaw===cmp.ahaApp, JSON.stringify(cmp));

  await p.evaluate((code)=>{ btPick(code); },code); await p.waitForTimeout(1200);
  let matTxt=await p.evaluate(()=>document.getElementById('CONTENT').innerText.replace(/\s+/g,' '));
  ok('재료 네 칸이 화면에 보인다', ['막힌 문제','아하노트 미해결','약한 유형','지금 푸는 교재'].every(x=>matTxt.indexOf(x)>=0), matTxt.slice(0,160));
  await p.screenshot({path:SP+'/blank/pc_mat.png'});

  /* ② 초안 — 1부는 AI, 2부는 앱이 실제 틀린 문항에서 */
  await p.evaluate(()=>btGen()); await p.waitForTimeout(3000);
  let d=await p.evaluate(()=>({ n:window._aiCalls, p1:BT.draft?BT.draft.p1.length:0, p2:BT.draft?BT.draft.p2.map(function(x){return x.label;}):[],
    p3:BT.draft?(BT.draft.p3||[]).length:0, title:BT.draft?BT.draft.title:'', prompt:String(window._lastPrompt||'') }));
  ok('② AI 를 한 번만 불렀고 1부가 들어왔다', d.n===1 && d.p1===2, JSON.stringify({n:d.n,p1:d.p1}));
  ok('② 3부는 기본으로 꺼져 있다', d.p3===0, d.p3);
  ok('② 프롬프트에 「계산해서 답이 숫자로 나오는 문제는 내지 않습니다」가 들어 있다', d.prompt.indexOf('숫자로 나오는')>0);
  const stuckTop=await p.evaluate((code)=>btMat(code).stuck.slice(0,4).map(function(x){ return x.book+((x.page?(' '+x.page+'쪽'):'')+(x.no?(' '+x.no):'')).replace(/\s+/g,' ').replace(/\s+$/,''); }),code);
  ok('② 2부가 실제 막힌 문항에서 나왔다', d.p2.length>0 ? d.p2.every(l=>stuckTop.some(s=>s.split(' ')[0]===String(l).split(' ')[0])) : true,
     JSON.stringify({보드:d.p2.slice(0,2),원자료:stuckTop.slice(0,2)}));

  /* ③ 고친 글이 저장되고 다시 열리는지 */
  await p.evaluate(()=>{ BT.draft.title='검증용 백지테스트(지울 것)'; btEdit('p1',0,'q','검증 문항 [[  ]] 입니다.'); btSave(); });
  await p.waitForTimeout(3000);
  await p.evaluate(()=>{ BT.draft=null; BT.loaded=false; return btLoad(true); }); await p.waitForTimeout(2500);
  let re=await p.evaluate(()=>{ var x=BT.saved.filter(function(y){ return y.title==='검증용 백지테스트(지울 것)'; })[0];
    if(!x) return null; btOpen(x.id); return { id:x.id, q:BT.draft.p1[0].q, code:BT.draft.code, hasName:JSON.stringify(x).indexOf('"name"')>=0 }; });
  ok('③ 고친 글이 서버(blank_tests)에 저장되고 다시 열린다', !!re && re.q==='검증 문항 [[  ]] 입니다.', JSON.stringify(re&&{q:re.q}));
  ok('③ 보관함에 학생 이름을 넣지 않는다 (코드만)', !!re && !re.hasName);

  /* ④ 인쇄 HTML — 그림이 하나도 없어야 한다 */
  const pr=await p.evaluate(()=>{
    var cap=''; var real=window.open;
    window.open=function(){ return { document:{ open:function(){}, write:function(h){ cap+=h; }, close:function(){} } }; };
    try{ btPrint(); }finally{ window.open=real; }
    return { len:cap.length, img:(cap.match(/<img/gi)||[]).length, a4:cap.indexOf('size:A4')>0,
      p1:cap.indexOf('1부. 개념 백지')>0, p2:cap.indexOf('2부. 내가 틀린 문제')>0,
      blank:(cap.match(/class="bl"/g)||[]).length, ans:cap.indexOf('음수')>=0 };
  });
  ok('④ 인쇄 HTML 에 문제 그림이 하나도 없다 (시험지 규칙)', pr.img===0, JSON.stringify(pr));
  ok('④ A4 · 1부 · 2부 · 빈칸이 들어 있다', pr.a4 && pr.p1 && pr.blank>0, JSON.stringify(pr));
  ok('④ 학생 시험지에는 모범답이 실리지 않는다', pr.ans===false, pr.ans);
  const an=await p.evaluate(()=>{ var cap=''; var real=window.open;
    window.open=function(){ return { document:{ open:function(){}, write:function(h){ cap+=h; }, close:function(){} } }; };
    try{ btAnswers(); }finally{ window.open=real; }
    return { has:cap.indexOf('음수')>=0, title:cap.indexOf('모범답')>0 }; });
  ok('④ 채점용 모범답 쪽지에는 답이 실린다', an.has && an.title, JSON.stringify(an));

  /* ⑤ 할 일 보드 카드 */
  await p.evaluate(()=>btToBoard()); await p.waitForTimeout(3500);
  let card=await p.evaluate((code)=>{ var a=(TD.items[code]||[]).filter(function(x){ return x.kind==='blank' && x.title==='검증용 백지테스트(지울 것)'; });
    return a.length?{ id:a[0].id, kind:a[0].kind, ref:a[0].ref, tst:a[0].tst }:null; },code);
  ok('⑤ 할 일 보드에 kind:blank 카드가 올라간다', !!card && card.kind==='blank' && card.tst==='todo', JSON.stringify(card));
  await p.screenshot({path:SP+'/blank/pc_draft.png'});

  /* 폰 */
  const ph=await ctx.newPage(); await ph.setViewportSize({width:390,height:844});
  const perr=[]; ph.on('pageerror',e=>perr.push(String(e.message).slice(0,180)));
  await route(ph);
  await ph.goto('https://yellowtongki.github.io/APP.html',{waitUntil:'domcontentloaded',timeout:70000}); await ph.waitForTimeout(15000);
  await ph.evaluate((code)=>{ MOB.view='blank'; render(); setTimeout(function(){ btPick(code); },1500); },code);
  await ph.waitForTimeout(7000);
  let mb=await ph.evaluate(()=>{ var t=(document.getElementById('MOB_OV')||{}).innerText||''; return { has:t.indexOf('백지테스트')>=0, mat:t.indexOf('약한 유형')>=0||t.indexOf('막힌 문제')>=0 }; });
  ok('폰 화면이 뜬다', mb.has && mb.mat, JSON.stringify(mb));
  await ph.screenshot({path:SP+'/blank/ph_blank.png'});

  /* ⑥ 회귀 */
  let reg=await p.evaluate(()=>{ var o={}; VIEW='typeach'; render(); o.ta=document.getElementById('CONTENT').innerHTML.length;
    VIEW='aha'; render(); o.aha=document.getElementById('CONTENT').innerHTML.length;
    VIEW='todo'; render(); o.td=document.getElementById('CONTENT').innerHTML.length;
    VIEW='bookdash'; MF.tab='all'; render(); o.bd=document.getElementById('CONTENT').innerHTML.length; return o; });
  ok('⑥ 옛 화면(유형성취도·아하노트·할 일 보드·매쓰플랫 현황)이 그대로다', reg.ta>200&&reg.aha>200&&reg.td>200&&reg.bd>200, JSON.stringify(reg));

  /* 정리 */
  await p.evaluate(async(code)=>{
    BT.saved=BT.saved.filter(function(x){ return String(x.title).indexOf('검증용')<0; }); await btSaveAll();
    TD.items[code]=(TD.items[code]||[]).filter(function(x){ return String(x.title).indexOf('검증용')<0; }); await tdSaveItems(code);
  },code);
  await p.evaluate(()=>{ BT.loaded=false; return btLoad(true); }); await p.waitForTimeout(2500);
  let cl=await p.evaluate((code)=>({ b:BT.saved.filter(function(x){ return String(x.title).indexOf('검증용')>=0; }).length,
    t:(TD.items[code]||[]).filter(function(x){ return String(x.title).indexOf('검증용')>=0; }).length }),code);
  ok('검증 자료를 전부 치웠다', cl.b===0 && cl.t===0, JSON.stringify(cl));
  ok('자바스크립트 오류 없음 (PC)', errs.length===0, errs.slice(0,3).join(' | '));
  ok('자바스크립트 오류 없음 (폰)', perr.length===0, perr.slice(0,3).join(' | '));
  await b.close();
  console.log(out.join('\n')); console.log('결과: '+(out.length-bad)+'/'+out.length);
  process.exit(bad?1:0);
})().catch(e=>{ console.error('하네스 오류', e); process.exit(2); });
