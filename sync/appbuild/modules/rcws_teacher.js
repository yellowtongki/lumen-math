/* ═══════════════════════════════════════════════════════════════════
 * v19-92·93: 🧩 리커버리 학습지 «설계 → 매쓰플랫 즉시 생성» (원장 결정 2026-10-09 · 10-10 「자동채점으로」)
 *   「주간테스트 오답은 쌍둥이 2문제씩 + 틀린 문제만큼 같은 유형을 교과서에서 + 범위 안 교재 오답은 쌍둥이 + 보강.
 *    최대 문항 제한 없음. 학원앱에서 출제하면 5분 안에, 빠르면 즉시 매쓰플랫에 만들어지면 좋겠다.」
 *
 *  [왜 즉시 되나] 매쓰플랫 API(api.mathflat.com)는 어느 주소에서 오는 브라우저 요청이든 받는다(CORS *, 2026-10-09 확인).
 *    그래서 학원앱이 원장님 PC 에서 직접 로그인해 만든다. 5분 워커(ws_make_req)는 그대로 두고 쓰지 않는다.
 *  [계정] 매쓰플랫 아이디·비밀번호는 이 PC 의 localStorage(or_mf_id · or_mf_pw)에만 둔다 — 서버·저장소에 절대 올리지 않는다.
 *  [재료 — 전부 서버에 이미 있는 것]
 *    · 시험 오답: mf_answer_records (worksheet_id=시험지, mf_student_id, source 학습지) → problem_id(문제은행 번호)·유형·난이도
 *    · 시험 범위: 그 시험지 문항들의 유형(concept) 묶음
 *    · 교재 오답: mf_answer_records (source 교재, result X, 범위 유형, 기준 기간) → 교재 은행 mf_textbook_<교재> 으로 문제은행 번호를 찾는다
 *    · 교과서: mf_textbooks.byStudent[학생] 의 SCHOOL 교재 → mf_textbook_<교재>.problems (cid=유형, pimg 에 문제은행 번호)
 *  [매쓰플랫 호출 — 2026-10-09 실검증]
 *    POST /worksheet/filter/concept → filterId
 *    POST /derivation/problem/{문제번호} {excludedProblemIds, filterId, bookType:'WORKSHEET', tagTop:null} → pairProblemList(쌍둥이)·similarProblemList(유사)
 *    POST /worksheet/problem {filterId} → 유형 문제 목록(보강·대체용)
 *    POST /worksheet {filterId, problemList:[{id,tagTop}], …, assignStudentIdList:[학생]} → 학습지 번호 (지정한 문항이 그대로 들어감)
 *  [기록] lumen_store rc_ws_made { byKey: { <학생키>: { wk, wsId, title, n, parts, at } } } · 규칙 rc_ws_rule
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 학생 실명은 화면에만, 저장소 코드·문서에는 넣지 않는다.
 * ═══════════════════════════════════════════════════════════════════ */
var RCWS = { tok:null, tokAt:0, made:{}, rule:null, loaded:false, busy:false, cache:{}, log:[] };
var RCWS_MF = 'https://api.mathflat.com';
var RCWS_DESIGN = { layoutType:11, layoutColor:'GREEN', partitionType:4, wrongAnswerNoteFlag:false, conceptNameFlag:false, problemTrendFlag:false,
  answerRateFlag:false, qrFlag:true, relationWorkbookFlag:true, includeProblemFlag:false, pdfDateType:'TODAY', pdfDate:null,
  designTemplateId:41988, problemPadding:60, conceptSortType:'CHAPTER' };
var RCWS_RULE_DEFAULT = { twinPer:2, tbPer:1, bookTwin:1, boost:true, theory:false, days:28, auto:true };
/* ★ v19-93: 「자동채점 문항만」 = 서술형(ESSAY)이 아니고 정답 글자가 있는 문항 (원장 지시 2026-10-10 「자동채점으로」).
 *   단답은 학생앱 루멘 엔진이 채점하므로 매쓰플랫 자체 기준(객관식만)보다 넓다. sync/rcws_make.js 와 같은 기준. */
function rcwsIsAuto(p, rule){ if(!rule||!rule.auto) return true; if(!p) return false; var a=String(p.answer==null?'':p.answer).trim(); return p.type!=='ESSAY'&&a!==''&&a!=='.'; }
var RCWS_LV = { 1:'최하', 2:'하', 3:'중', 4:'상', 5:'최상' };

/* ── 계정 (이 PC 에만) ── */
function rcwsAcct(){ try{ return { id:localStorage.getItem('or_mf_id')||'', pw:localStorage.getItem('or_mf_pw')||'' }; }catch(e){ return { id:'', pw:'' }; } }
window.rcwsSaveAcct=function(){
  var id=(document.getElementById('rcws-id')||{}).value||'', pw=(document.getElementById('rcws-pw')||{}).value||'';
  id=String(id).trim(); pw=String(pw).trim();
  if(!id||!pw){ alert('매쓰플랫 아이디와 비밀번호를 넣어 주세요'); return; }
  try{ localStorage.setItem('or_mf_id',id); localStorage.setItem('or_mf_pw',pw); }catch(e){}
  RCWS.tok=null; plToast('🔐 매쓰플랫 계정을 이 PC 에 저장했습니다'); render();
};
window.rcwsClearAcct=function(){ if(!confirm('이 PC 에 저장된 매쓰플랫 계정을 지울까요?')) return; try{ localStorage.removeItem('or_mf_id'); localStorage.removeItem('or_mf_pw'); }catch(e){} RCWS.tok=null; render(); };
function rcwsAcctBox(){
  var a=rcwsAcct();
  if(a.id&&a.pw) return '<div style="font-size:10.5px;color:#64748b;font-weight:700;text-align:right;margin-bottom:6px">🔐 매쓰플랫 '+esc2(a.id.slice(0,3))+'*** 연결됨 · <button onclick="rcwsClearAcct()" style="border:none;background:none;color:#94a3b8;font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit">지우기</button></div>';
  return '<div style="border:1.5px dashed #c7d2fe;border-radius:10px;padding:9px 11px;margin-bottom:8px;background:#f8faff">'
    +'<div style="font-size:11.5px;font-weight:900;color:#3730a3;margin-bottom:5px">🔐 매쓰플랫 계정 (이 PC 에만 저장 · 학습지를 바로 만들 때 씁니다)</div>'
    +'<div style="display:flex;gap:5px"><input id="rcws-id" placeholder="아이디" style="flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-family:inherit;font-size:12px">'
    +'<input id="rcws-pw" type="password" placeholder="비밀번호" style="flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-family:inherit;font-size:12px">'
    +'<button onclick="rcwsSaveAcct()" style="border:none;border-radius:7px;padding:6px 10px;background:#3730a3;color:#fff;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer">저장</button></div></div>';
}

/* ── 매쓰플랫 통신 (브라우저에서 직접) ── */
async function rcwsLogin(){
  if(RCWS.tok&&(Date.now()-RCWS.tokAt)<45*60000) return RCWS.tok;
  var a=rcwsAcct(); if(!a.id||!a.pw) throw new Error('매쓰플랫 계정이 없습니다 — 오른쪽 패널에서 저장해 주세요');
  var r=await fetch(RCWS_MF+'/v2/login',{ method:'POST', headers:{ 'content-type':'application/json', 'x-platform':'TEACHER_WEB', 'x-freewheelin-host':'mathflat.com' },
    body:JSON.stringify({ id:a.id, password:a.pw, userType:'TEACHER', serviceType:'MATHFLAT' }) });
  var j=null; try{ j=await r.json(); }catch(e){}
  if(!r.ok||!j||!j.accessToken) throw new Error('매쓰플랫 로그인 실패 ('+(j&&j.code||r.status)+') — 아이디·비밀번호를 확인해 주세요');
  RCWS.tok=j.accessToken; RCWS.tokAt=Date.now(); return RCWS.tok;
}
async function rcwsCall(method, path, body){
  var tok=await rcwsLogin();
  var r=await fetch(RCWS_MF+path,{ method:method, headers:{ 'content-type':'application/json', accept:'application/json, text/plain, */*', 'x-platform':'TEACHER_WEB', 'x-freewheelin-host':'mathflat.com', authorization:'Bearer '+tok, 'x-auth-token':tok }, body:body?JSON.stringify(body):undefined });
  var t=await r.text(); var j=null; try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok) throw new Error((j&&j.code||r.status)+' @ '+path);
  return j&&(j.data!==undefined?j.data:j);
}
/* 시험용으로 바꿔 끼울 수 있게 한 벌로 묶는다 */
var rcwsApi = { call: function(m,p,b){ return rcwsCall(m,p,b); } };

/* ── 기록·규칙 읽기 ── */
async function rcwsLoad(force){
  if(RCWS.loaded&&!force) return;
  try{
    var sb=getSupaClient(); if(!sb) return;
    var r=await sb.from('lumen_store').select('key,value').in('key',['rc_ws_made','rc_ws_rule']);
    ((r&&r.data)||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
      if(row.key==='rc_ws_made') RCWS.made=(v&&v.byKey)||{};
      if(row.key==='rc_ws_rule') RCWS.rule=v||null; });
    RCWS.loaded=true;
  }catch(e){}
}
setTimeout(function(){ try{ rcwsLoad(); }catch(e){} }, 3000);
function rcwsRule(){ return Object.assign({}, RCWS_RULE_DEFAULT, RCWS.rule||{}); }
function rcwsMadeOf(stKey){ var m=RCWS.made[stKey]; return (m&&m.wk===rcWeekKey())?m:null; }

/* ── 재료 모으기 ── */
function rcwsBankId(p){ var m=String((p&&p.pimg)||'').match(/\/problem\/(\d+)\//); return m?Number(m[1]):null; }
async function rcwsStore(keys){
  var out={}; try{ var sb=getSupaClient(); var r=await sb.from('lumen_store').select('key,value').in('key',keys);
    ((r&&r.data)||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } out[row.key]=v; }); }catch(e){}
  return out;
}
/* 학생 한 명의 설계 재료: 시험 오답·범위·교재 오답·교과서 같은 유형 */
async function rcwsGather(row){
  var sb=getSupaClient(); var sid=row.sid, t=row.testHit;
  var model={ row:row, sid:sid, test:t, wrong:[], range:[], rangeNames:[], bookWrong:[], tb:{ bid:null, title:'', byCid:{} }, solved:{}, warn:[] };
  // ① 시험지 문항 기록 (가장 최근 응시)
  var r=await sb.from('mf_answer_records').select('problem_seq,number,result,concept_id,level,problem_id,score_datetime,student_worksheet_id')
    .eq('worksheet_id',t.wid).eq('mf_student_id',sid).eq('source','학습지').order('problem_seq',{ascending:true}).limit(500);
  var recs=(r&&r.data)||[];
  if(recs.length){
    var bySw={}; recs.forEach(function(x){ var sw=x.student_worksheet_id||'0'; (bySw[sw]=bySw[sw]||[]).push(x); });
    var swIds=Object.keys(bySw);
    if(swIds.length>1){ swIds.sort(function(a,b){ return String(bySw[b][0].score_datetime||'').localeCompare(String(bySw[a][0].score_datetime||'')); }); recs=bySw[swIds[0]]; }
  }
  if(!recs.length){ model.warn.push('이 시험의 문항별 기록이 아직 없습니다 (수집기가 문항 단위로 가져오면 설계할 수 있어요)'); return model; }
  var seenC={};
  recs.forEach(function(x){ if(x.concept_id!=null&&!seenC[x.concept_id]){ seenC[x.concept_id]=1; model.range.push(Number(x.concept_id)); }
    if(x.result==='X') model.wrong.push({ no:(x.number!=null?x.number:x.problem_seq), pid:x.problem_id?Number(x.problem_id):null, cid:Number(x.concept_id), lv:Number(x.level)||3 }); });
  model.rangeNames=model.range.map(function(c){ var n=tqName(c); return n===String(c)?'':n; }).filter(function(n){ return n; });
  // ② 범위 안 교재 오답 (기준 기간)
  var since=new Date(Date.now()-rcwsRule().days*86400000).toISOString();
  var r2=await sb.from('mf_answer_records').select('book_id,page,number,workbook_problem_id,concept_id,level,score_datetime')
    .eq('mf_student_id',sid).eq('source','교재').eq('result','X').in('concept_id',model.range).gte('score_datetime',since).order('score_datetime',{ascending:false}).limit(300);
  var seenW={}; var bids={};
  ((r2&&r2.data)||[]).forEach(function(x){ var k=String(x.workbook_problem_id||''); if(!k||seenW[k]) return; seenW[k]=1; bids[String(x.book_id)]=1;
    model.bookWrong.push({ wpId:Number(x.workbook_problem_id), bid:String(x.book_id), page:x.page, no:x.number, cid:Number(x.concept_id), lv:Number(x.level)||3, date:String(x.score_datetime||'').slice(0,10), pid:null }); });
  // ③ 교재 은행 (교재 오답의 문제은행 번호) + 교과서
  var keys=Object.keys(bids).map(function(b){ return 'mf_textbook_'+b; }); keys.push('mf_textbooks');
  var st=await rcwsStore(keys);
  var tbs=st.mf_textbooks||{}; var mine=(tbs.byStudent&&tbs.byStudent[sid])||null; var tbid=null, tbTitle='';
  ((mine&&mine.books)||[]).forEach(function(b){ var info=tbs.books&&tbs.books[b]; if(!tbid&&info&&info.type==='SCHOOL'){ tbid=String(b); tbTitle=info.fulltitle||info.title||''; } });
  if(tbid&&!st['mf_textbook_'+tbid]){ var st2=await rcwsStore(['mf_textbook_'+tbid]); st['mf_textbook_'+tbid]=st2['mf_textbook_'+tbid]; }
  Object.keys(bids).forEach(function(b){ var bank=st['mf_textbook_'+b]; if(!bank||!bank.problems) return; var byWp={}; bank.problems.forEach(function(p){ byWp[String(p.id)]=p; });
    model.bookWrong.forEach(function(w){ if(w.bid===b&&byWp[String(w.wpId)]){ w.pid=rcwsBankId(byWp[String(w.wpId)]); w.book=bank.title||''; } }); });
  if(tbid&&st['mf_textbook_'+tbid]){ model.tb.bid=tbid; model.tb.title=tbTitle||st['mf_textbook_'+tbid].title||'';
    (st['mf_textbook_'+tbid].problems||[]).forEach(function(p){ var id=rcwsBankId(p); if(!id||p.cid==null) return; (model.tb.byCid[p.cid]=model.tb.byCid[p.cid]||[]).push({ id:id, lv:Number(p.level)||2, page:p.page, no:p.no, type:p.type, answer:p.answer }); }); }
  else model.warn.push('이 학생에게 배정된 교과서가 매쓰플랫에 없어 교과서 문항 대신 같은 유형 문제를 넣습니다');
  // ④ 이미 푼 문제(학습지) — 쌍둥이에서 뺀다
  var r3=await sb.from('mf_answer_records').select('problem_id').eq('mf_student_id',sid).eq('source','학습지').in('concept_id',model.range).not('problem_id','is',null).limit(2000);
  ((r3&&r3.data)||[]).forEach(function(x){ model.solved[String(x.problem_id)]=1; });
  model.wrong.forEach(function(w){ if(w.pid) model.solved[String(w.pid)]=1; });
  model.bookWrong.forEach(function(w){ if(w.pid) model.solved[String(w.pid)]=1; });
  return model;
}

/* ── 설계(plan): 문항마다 몇 개를 어떤 방법으로 ── */
function rcwsPlan(model, rule){
  rule=Object.assign({}, RCWS_RULE_DEFAULT, rule||{});
  var cnt={};
  model.wrong.forEach(function(w){ cnt[w.cid]=(cnt[w.cid]||0)+1; });
  model.bookWrong.forEach(function(w){ cnt[w.cid]=(cnt[w.cid]||0)+1; });
  var plan={ rule:rule, test:[], tb:[], book:[], boost:[] };
  model.wrong.forEach(function(w,i){ plan.test.push({ i:i, w:w, n:rule.twinPer }); plan.tb.push({ i:i, w:w, n:rule.tbPer }); });
  model.bookWrong.forEach(function(w,i){ plan.book.push({ i:i, w:w, n:rule.bookTwin }); });
  Object.keys(cnt).forEach(function(c){ if(cnt[c]>=2) plan.boost.push({ cid:Number(c), n:rule.boost?1:0, times:cnt[c] }); });
  return plan;
}
function rcwsPlanTotals(plan){
  var t={ twin:0, tb:0, book:0, boost:0 };
  plan.test.forEach(function(x){ t.twin+=x.n; }); plan.tb.forEach(function(x){ t.tb+=x.n; }); plan.book.forEach(function(x){ t.book+=x.n; }); plan.boost.forEach(function(x){ t.boost+=x.n; });
  t.total=t.twin+t.tb+t.book+t.boost; return t;
}

/* ── 만들기(build): 매쓰플랫에서 문항을 모아 학습지 한 장 ── */
function rcwsPickFrom(list, lv, n, excl, chosen, rule){
  var out=[]; var pool=list.filter(function(p){ return rcwsIsAuto(p, rule)&&!excl[String(p.id)]&&!chosen[String(p.id)]; });
  pool.sort(function(a,b){ return Math.abs((a.lv||3)-lv)-Math.abs((b.lv||3)-lv); });
  pool.slice(0,n).forEach(function(p){ chosen[String(p.id)]=1; out.push(p.id); });
  return out;
}
async function rcwsBuild(model, plan, api, onLog){
  var log=function(s){ if(onLog) onLog(s); };
  var cids={}; model.wrong.forEach(function(w){ cids[w.cid]=1; }); model.bookWrong.forEach(function(w){ cids[w.cid]=1; }); plan.boost.forEach(function(b){ cids[b.cid]=1; });
  var cidList=Object.keys(cids).map(Number);
  if(!cidList.length) throw new Error('넣을 문항이 없습니다');
  log('① 유형 필터 만드는 중 ('+cidList.length+'개 유형)');
  var f=await api.call('POST','/worksheet/filter/concept',{ type:'CONCEPT', conceptIdList:cidList, excludedTopicIds:[], excludedSubTopicIds:[], problemList:null,
    problemCount:100, level:3, levelWeight:[10,30,30,20,10], problemFilterType:'ALL', practiceTest:'INCLUDE', onlyAutoScorable:false, excludePrevious:false, previousExclusionScope:null,
    studentIds:null, excludeOOC:true, equalityLevel:null, minRate:0, maxRate:100, selectedConceptIdList:[], selectedLittleChapterIdList:[] });
  var fid=f&&(f.filterId||f); var rule=plan.rule;
  var chosen={}; var items=[]; var parts={ twin:0, tb:0, book:0, boost:0, fallback:0 };
  var poolByCid=null;
  function addPool(ps){ (Array.isArray(ps)?ps:(ps.problemList||[])).forEach(function(p){ var pr=p.problem||p; if(pr.conceptId&&pr.id) (poolByCid[pr.conceptId]=poolByCid[pr.conceptId]||[]).push({ id:pr.id, lv:pr.level||3, type:pr.type, answer:pr.answer }); }); }
  /* 유형 풀 — 처음 한 번 100문항, 그 유형이 비면 그 유형만의 필터를 따로 만든다 (v19-93) */
  async function pool(cid){
    if(!poolByCid){ poolByCid={}; try{ addPool(await api.call('POST','/worksheet/problem',{ filterId:fid })); }catch(e){} }
    var has=(poolByCid[cid]||[]).some(function(p){ return rcwsIsAuto(p, rule)&&!model.solved[String(p.id)]&&!chosen[String(p.id)]; });
    if(cid&&!has&&!poolByCid['_t'+cid]){ poolByCid['_t'+cid]=1;
      try{ var f2=await api.call('POST','/worksheet/filter/concept',{ type:'CONCEPT', conceptIdList:[cid], excludedTopicIds:[], excludedSubTopicIds:[], problemList:null, problemCount:40, level:3, levelWeight:[10,30,30,20,10], problemFilterType:'ALL', practiceTest:'INCLUDE', onlyAutoScorable:false, excludePrevious:false, previousExclusionScope:null, studentIds:null, excludeOOC:true, equalityLevel:null, minRate:0, maxRate:100, selectedConceptIdList:[], selectedLittleChapterIdList:[] });
        addPool(await api.call('POST','/worksheet/problem',{ filterId:(f2&&(f2.filterId||f2)) })); }catch(e){} }
    return poolByCid;
  }
  async function twinsOf(pid, lv, n, label){
    if(!n) return [];
    var d=await api.call('POST','/derivation/problem/'+pid,{ excludedProblemIds:Object.keys(chosen).map(Number), filterId:fid, bookType:'WORKSHEET', tagTop:null });
    var pk=function(x){ return { id:x.problem.id, lv:x.problem.level, type:x.problem.type, answer:x.problem.answer }; };
    var pair=((d&&d.pairProblemList)||[]).map(pk), sim=((d&&d.similarProblemList)||[]).map(pk);
    var got=rcwsPickFrom(pair, lv, n, model.solved, chosen, rule);
    if(got.length<n) got=got.concat(rcwsPickFrom(sim, lv, n-got.length, model.solved, chosen, rule));
    log('  '+label+' → 쌍둥이 '+pair.length+'·유사 '+sim.length+' 중 '+got.length+'개');
    return got;
  }
  async function sameType(cid, lv, n, label){
    if(!n) return [];
    var P=await pool(cid); var got=rcwsPickFrom(P[cid]||[], lv, n, model.solved, chosen, rule);
    if(got.length) log('  '+label+' → 같은 유형 '+got.length+'개'); else log('  '+label+' → 같은 유형 문제를 더 찾지 못함');
    return got;
  }
  // ② 시험 오답 쌍둥이
  log('② 시험 오답 '+plan.test.length+'문항의 쌍둥이');
  for(var i=0;i<plan.test.length;i++){ var x=plan.test[i]; if(!x.n) continue; var got=[];
    if(x.w.pid) got=await twinsOf(x.w.pid, x.w.lv, x.n, x.w.no+'번');
    if(got.length<x.n){ var g2=await sameType(x.w.cid, x.w.lv, x.n-got.length, x.w.no+'번 대체'); parts.fallback+=g2.length; got=got.concat(g2); }
    got.forEach(function(id){ items.push({ id:id, kind:'twin', from:x.w.no }); }); parts.twin+=got.length; }
  // ③ 교과서 같은 유형
  log('③ 교과서 같은 유형 ('+(model.tb.title||'교과서 없음')+')');
  for(var j=0;j<plan.tb.length;j++){ var y=plan.tb[j]; if(!y.n) continue;
    var tbl=model.tb.byCid[y.w.cid]||[]; var got3=rcwsPickFrom(tbl, y.w.lv, y.n, model.solved, chosen, rule);
    if(got3.length<y.n){ var g3=await sameType(y.w.cid, y.w.lv, y.n-got3.length, y.w.no+'번 교과서 대체'); parts.fallback+=g3.length; got3=got3.concat(g3); }
    got3.forEach(function(id){ items.push({ id:id, kind:'tb', from:y.w.no }); }); parts.tb+=got3.length; }
  // ④ 교재 오답 쌍둥이
  if(plan.book.length) log('④ 범위 안 교재 오답 '+plan.book.length+'문항의 쌍둥이');
  for(var k=0;k<plan.book.length;k++){ var z=plan.book[k]; if(!z.n) continue; var got4=[]; var lab=(z.w.book?z.w.book.slice(0,10)+' ':'')+'p.'+z.w.page+' '+z.w.no;
    if(z.w.pid) got4=await twinsOf(z.w.pid, z.w.lv, z.n, lab);
    if(got4.length<z.n){ var g4=await sameType(z.w.cid, z.w.lv, z.n-got4.length, lab+' 대체'); parts.fallback+=g4.length; got4=got4.concat(g4); }
    got4.forEach(function(id){ items.push({ id:id, kind:'book', from:lab }); }); parts.book+=got4.length; }
  // ⑤ 보강
  if(plan.boost.some(function(b){ return b.n; })) log('⑤ 두 번 이상 틀린 유형 보강');
  for(var q=0;q<plan.boost.length;q++){ var b=plan.boost[q]; if(!b.n) continue; var got5=await sameType(b.cid, 3, b.n, tqName(b.cid)); got5.forEach(function(id){ items.push({ id:id, kind:'boost', from:b.cid }); }); parts.boost+=got5.length; }
  if(!items.length) throw new Error('매쓰플랫에서 문항을 하나도 받지 못했습니다');
  // ⑥ 학습지 생성 + 배정
  var sch=rcWsSchool(model.row.st)||{ schoolType:'MIDDLE', grade:'1' };
  var recDt=rcRecDate(rcWeekKey()); var dd=new Date(recDt); var title='리커버리 '+(dd.getMonth()+1)+'/'+dd.getDate()+' '+model.row.st.name;
  log('⑥ 학습지 '+items.length+'문항 만드는 중 — '+title);
  var body=Object.assign({ filterId:fid, problemList:items.map(function(it){ return { id:it.id, tagTop:null }; }),
    conceptIdList:(plan.rule.theory?cidList:[]), littleChapterConceptIdList:[], assignStudentIdList:(model.sid?[model.sid]:[]), shareScope:'ACADEMY',
    title:title, writer:'김정수 선생님', prefix:'취약유형', tag:'WEAK_CONCEPT_CHIP', schoolType:sch.schoolType, grade:String(sch.grade), revision:'CURRICULUM_22' }, RCWS_DESIGN);
  var made=await api.call('POST','/worksheet', body);
  var wsId=(made&&(made.id||made.worksheetId))||made;
  return { wsId:wsId, title:title, n:items.length, parts:parts, items:items, at:new Date().toISOString() };
}

/* ── 기록 저장 ── */
async function rcwsSaveMade(stKey, res){
  RCWS.made[stKey]={ wk:rcWeekKey(), wsId:res.wsId, title:res.title, n:res.n, parts:res.parts, at:res.at };
  try{ await supaSetItem('rc_ws_made',{ byKey:RCWS.made, updated:new Date().toISOString() }); }catch(e){}
  try{ var wk=rcWeekKey(); if(RC.state.calls[wk]&&RC.state.calls[wk][stKey]){ RC.state.calls[wk][stKey].ws={ wsId:res.wsId, n:res.n, parts:res.parts, at:res.at }; rcSaveState(); } }catch(e){}
}
async function rcwsSaveRule(rule){ RCWS.rule=rule; try{ await supaSetItem('rc_ws_rule', Object.assign({ updated:new Date().toISOString() }, rule)); }catch(e){} }

/* ── 학생 카드 단추 (기존 rcWsBtn 을 덮어쓴다) ── */
function rcWsBtn(x){
  var sch=rcWsSchool(x.st);
  if(!x.testHit||!sch){
    var why=!x.testHit?'주간테스트 기록이 없어 설계할 수 없어요':'고등부는 아직 매쓰플랫에서 직접 만들어 주세요';
    return '<span title="'+esc2(why)+'" style="font-size:11.5px;font-weight:800;color:#cbd5e1;border:1.5px dashed #e2e8f0;border-radius:9px;padding:6px 12px">🧩 학습지</span>';
  }
  var m=rcwsMadeOf(x.stKey);
  var h='';
  if(m){ var p=m.parts||{}; h+='<span title="매쓰플랫 → 학습지 → 내학습지 #'+esc2(String(m.wsId))+'" style="font-size:11.5px;font-weight:900;color:#15803d;background:#dcfce7;border:1.5px solid #bbf7d0;border-radius:9px;padding:7px 12px">✅ '+m.n+'문항 · 시험 쌍둥이 '+(p.twin||0)+' · 교과서 '+(p.tb||0)+' · 교재 '+(p.book||0)+' · 보강 '+(p.boost||0)+'</span>'; }
  h+='<button onclick="rcwsOpen(\''+esc2(x.stKey).replace(/'/g,'')+'\')" style="border:none;background:linear-gradient(135deg,#0d2240,#1d4f91);color:#fff;border-radius:9px;padding:7px 13px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit">🧩 '+(m?'다시 설계':'학습지 설계')+'</button>';
  return h;
}

/* ── 설계 팝업 ── */
var RCWS_CUR = null;   // { model, plan, stKey, busy }
window.rcwsOpen=async function(stKey){
  var row=rcRows().find(function(r){ return r.stKey===stKey; });
  if(!row||!row.testHit){ alert('이 학생의 주간테스트 기록을 찾지 못했습니다.'); return; }
  rcPopShow(rcPopHead('🧩 학습지 설계 — '+esc2(row.st.name))+'<div style="padding:30px;text-align:center;color:#94a3b8;font-weight:700">시험 오답·교재 오답·교과서 문항을 모으는 중…</div>');
  var model;
  try{ model=await rcwsGather(row); }catch(e){ rcPopShow(rcPopHead('🧩 학습지 설계')+'<div style="padding:20px;color:#dc2626;font-weight:800">재료를 읽지 못했습니다: '+esc2(e.message)+'</div>'); return; }
  if(!document.getElementById('rc-pop')) return;
  RCWS_CUR={ model:model, plan:rcwsPlan(model, rcwsRule()), stKey:stKey, busy:false, logs:[], result:null, err:'' };
  rcwsPaint();
};
function rcwsSeg(kind, i, n, max){
  var h='<span style="display:inline-flex;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden">';
  for(var k=0;k<=max;k++){ var on=(n===k); h+='<button onclick="rcwsSet(\''+kind+'\','+i+','+k+')" style="border:none;border-left:'+(k?'1.5px solid #e2e8f0':'none')+';background:'+(on?(k?'#ede9fe':'#fee2e2'):'#fff')+';color:'+(on?(k?'#6d28d9':'#b91c1c'):'#94a3b8')+';font-family:inherit;font-size:11px;font-weight:900;padding:5px 8px;cursor:pointer">'+(k===0?'빼기':k)+'</button>'; }
  return h+'</span>';
}
window.rcwsSet=function(kind,i,n){ var C=RCWS_CUR; if(!C||C.busy) return; var L=C.plan[kind]; if(L&&L[i]){ L[i].n=n; rcwsPaint(); } };
window.rcwsRuleChange=function(){ var C=RCWS_CUR; if(!C||C.busy) return; var g=function(id){ var el=document.getElementById(id); return el?el.value:''; };
  var rule={ twinPer:Number(g('rcws-twin'))||0, tbPer:Number(g('rcws-tb'))||0, bookTwin:Number(g('rcws-bk'))||0, boost:!!(document.getElementById('rcws-boost')||{}).checked, theory:!!(document.getElementById('rcws-theory')||{}).checked, days:Number(g('rcws-days'))||28, auto:!!(document.getElementById('rcws-auto')||{}).checked };
  C.plan=rcwsPlan(C.model, rule); rcwsPaint(); };
function rcwsPaint(){
  var C=RCWS_CUR; if(!C||!document.getElementById('rc-pop')) return;
  var M=C.model, P=C.plan, t=rcwsPlanTotals(P), rule=P.rule;
  var h=rcPopHead('🧩 학습지 설계 — '+esc2(M.row.st.name)+' <span style="font-size:12px;color:#64748b;font-weight:700">'+esc2(M.row.st.grade||'')+'</span>');
  h+='<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:8px">'+esc2(M.test.title||'주간테스트')+' · '+M.test.score+'점'+(M.test.correct!=null?' ('+M.test.correct+'/'+M.test.total+')':'')+' · 응시 '+esc2(String(M.test.date||'').slice(5).replace('-','.'))+'</div>';
  if(M.rangeNames.length) h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;font-size:11px;font-weight:800;color:#64748b">범위 '+M.rangeNames.slice(0,8).map(function(n){ return '<span style="background:#eef2ff;color:#3730a3;border-radius:50px;padding:2px 9px">'+esc2(n)+'</span>'; }).join('')+(M.rangeNames.length>8?' 외 '+(M.rangeNames.length-8):'')+'</div>';
  M.warn.forEach(function(w){ h+='<div style="background:#fef3c7;color:#92400e;border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:800;margin-bottom:8px">⚠ '+esc2(w)+'</div>'; });
  var blk=function(title, sub){ return '<div style="border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;margin-bottom:9px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;background:#f1f5f9;flex-wrap:wrap"><b style="font-size:12.5px">'+title+'</b><small style="font-size:11px;color:#64748b;font-weight:700">'+sub+'</small></div>'; };
  var rowH=function(no, main, sub, ctl){ return '<div style="display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:center;padding:7px 11px;border-top:1px solid #f1f5f9;font-size:12px"><span style="font-family:ui-monospace,monospace;font-weight:700;color:#64748b">'+no+'</span><span><b>'+main+'</b><small style="display:block;color:#64748b;font-size:10.5px;font-weight:700">'+sub+'</small></span>'+ctl+'</div>'; };
  var lvTag=function(lv){ return ' <span style="font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;background:#fef3c7;color:#b45309">'+(RCWS_LV[lv]||'')+'</span>'; };
  // ① 시험 오답
  h+=blk('① 주간테스트 오답 '+M.wrong.length+'문항 → 쌍둥이', '같은 유형·같은 난이도의 다른 문제 · 이미 푼 문제는 뺌');
  if(!M.wrong.length) h+='<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">틀린 문항이 없습니다</div>';
  P.test.forEach(function(x){ var nm=tqName(x.w.cid); h+=rowH(x.w.no+'번', esc2(nm===String(x.w.cid)?'유형 정보 없음':nm)+lvTag(x.w.lv), x.w.pid?'문제은행 #'+x.w.pid:'문제 번호 없음 → 같은 유형으로 대체', rcwsSeg('test',x.i,x.n,3)); });
  h+='</div>';
  // ② 교과서
  h+=blk('② 틀린 문항마다 교과서 같은 유형', M.tb.title?esc2(M.tb.title):'배정 교과서 없음 → 같은 유형 문제로 대체');
  P.tb.forEach(function(y){ var tbl=M.tb.byCid[y.w.cid]||[]; h+=rowH(y.w.no+'번', esc2(tqName(y.w.cid)), tbl.length?('교과서에 이 유형 '+tbl.length+'문항'+(tbl[0]&&tbl[0].page?' (p.'+tbl[0].page+'~)':'')):'교과서에 이 유형 없음 → 같은 유형으로 대체', rcwsSeg('tb',y.i,y.n,2)); });
  h+='</div>';
  // ③ 교재 오답
  h+=blk('③ 범위 안 교재 오답 '+M.bookWrong.length+'문항 → 쌍둥이', '최근 '+rule.days+'일 · 매쓰플랫 채점 기록');
  if(!M.bookWrong.length) h+='<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">범위 안에서 교재로 틀린 문제가 없습니다</div>';
  P.book.forEach(function(z){ h+=rowH(String(z.i+1), esc2((z.w.book?z.w.book.slice(0,16)+' ':'')+'p.'+z.w.page+' '+z.w.no+'번')+lvTag(z.w.lv), esc2(tqName(z.w.cid))+' · '+z.w.date.slice(5).replace('-','.')+' 채점'+(z.w.pid?'':' · 번호 못 찾음 → 같은 유형으로 대체'), rcwsSeg('book',z.i,z.n,2)); });
  h+='</div>';
  // ④ 보강
  if(P.boost.length){ h+=blk('④ 보강 — 두 번 이상 틀린 유형', '유형마다 1문항');
    P.boost.forEach(function(b,i){ h+=rowH('+1', esc2(tqName(b.cid)), '시험·교재 합쳐 '+b.times+'번 틀림', rcwsSeg('boost',i,b.n,1)); }); h+='</div>'; }
  // 합계
  h+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 10px">'
    +[['총 문항',t.total,'#0d2240'],['시험 쌍둥이',t.twin,'#6d28d9'],['교과서',t.tb,'#0e7490'],['교재 쌍둥이',t.book,'#6d28d9'],['보강',t.boost,'#b45309']].map(function(c){ return '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:6px 8px;text-align:center"><div style="font-size:18px;font-weight:900;color:'+c[2]+'">'+c[1]+'</div><div style="font-size:10px;color:#64748b;font-weight:800">'+c[0]+'</div></div>'; }).join('')+'</div>';
  // 규칙
  var sel=function(id,val,max){ var s='<select id="'+id+'" onchange="rcwsRuleChange()" style="font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px">'; for(var k=0;k<=max;k++) s+='<option'+(k===val?' selected':'')+'>'+k+'</option>'; return s+'</select>'; };
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:11.5px;font-weight:800;color:#475569;margin-bottom:10px">'
    +'<label>시험 오답 쌍둥이 '+sel('rcws-twin',rule.twinPer,3)+'</label><label>교과서 '+sel('rcws-tb',rule.tbPer,2)+'</label><label>교재 오답 쌍둥이 '+sel('rcws-bk',rule.bookTwin,2)+'</label>'
    +'<label><input type="checkbox" id="rcws-boost" onchange="rcwsRuleChange()"'+(rule.boost?' checked':'')+'> 보강</label>'
    +'<label><input type="checkbox" id="rcws-theory" onchange="rcwsRuleChange()"'+(rule.theory?' checked':'')+'> 이론 박스</label>'
    +'<label title="서술형을 빼고 정답 글자가 있는 문항만 — 단답은 학생앱이 채점"><input type="checkbox" id="rcws-auto" onchange="rcwsRuleChange()"'+(rule.auto?' checked':'')+'> 자동채점 문항만</label>'
    +'<label>교재 오답 최근 <input id="rcws-days" type="number" value="'+rule.days+'" min="7" max="120" onchange="rcwsRuleChange()" style="width:48px;font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px">일</label>'
    +'<label><input type="checkbox" id="rcws-save" checked> 이 규칙을 「확정 전원」 기본으로</label></div>';
  // 진행·결과
  if(C.logs.length) h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 11px;font-size:11.5px;font-weight:700;color:#334155;margin-bottom:10px;max-height:160px;overflow:auto">'+C.logs.map(function(l){ return '<div>'+esc2(l)+'</div>'; }).join('')+'</div>';
  if(C.err) h+='<div style="background:#fee2e2;color:#b91c1c;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:800;margin-bottom:10px">✗ '+esc2(C.err)+'</div>';
  if(C.result){ var R=C.result; h+='<div style="background:#dcfce7;color:#166534;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:900;margin-bottom:10px">✅ 매쓰플랫에 만들어 배정했습니다 — 「'+esc2(R.title)+'」 '+R.n+'문항 · 학습지 #'+esc2(String(R.wsId))+'<div style="font-size:11px;font-weight:700;margin-top:3px">시험 쌍둥이 '+R.parts.twin+' · 교과서 '+R.parts.tb+' · 교재 쌍둥이 '+R.parts.book+' · 보강 '+R.parts.boost+(R.parts.fallback?' · 같은 유형으로 대체 '+R.parts.fallback:'')+' — 매쓰플랫 → 학습지 → 내학습지에서 인쇄</div></div>'; }
  h+='<div style="display:flex;gap:7px;flex-wrap:wrap">';
  if(!C.result) h+='<button onclick="rcwsMake()" '+(C.busy?'disabled':'')+' style="border:none;border-radius:10px;padding:10px 14px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:#1d4f91;color:#fff">'+(C.busy?'⏳ 만드는 중…':'🧩 매쓰플랫에 만들기 · 배정 ('+t.total+'문항)')+'</button>';
  h+='<button onclick="rcPopClose()" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:#fff;color:#64748b">'+(C.result?'닫기':'취소')+'</button></div>';
  rcPopShow(h);
}
window.rcwsMake=async function(){
  var C=RCWS_CUR; if(!C||C.busy) return;
  var t=rcwsPlanTotals(C.plan); if(!t.total){ alert('넣을 문항이 없습니다 — 쌍둥이 수를 올려 주세요'); return; }
  if((document.getElementById('rcws-save')||{}).checked) rcwsSaveRule(C.plan.rule);
  C.busy=true; C.err=''; C.logs=[]; rcwsPaint();
  try{
    var res=await rcwsBuild(C.model, C.plan, rcwsApi, function(s){ C.logs.push(s); rcwsPaint(); });
    C.result=res; await rcwsSaveMade(C.stKey, res);
    plToast('🧩 학습지 #'+res.wsId+' · '+res.n+'문항 — 매쓰플랫에 만들어 배정했습니다');
  }catch(e){ C.err=e.message||String(e); }
  C.busy=false; rcwsPaint(); if(VIEW==='recovery') render();
};
/* 기존 단추들을 새 길로 — 학생 카드의 rcMakeWs 와 우측 패널 「확정 전원」 */
window.rcMakeWs=function(stKey){ rcwsOpen(stKey); };
window.rcMakeWsAll=async function(){
  if(RCWS.busy) return;
  var rows=rcRows();
  var targets=rcConfirmed().map(function(c){ return rows.find(function(r){ return r.stKey===c.k; }); })
    .filter(function(x){ return x&&x.testHit&&rcWsSchool(x.st)&&!rcwsMadeOf(x.stKey); });
  if(!targets.length){ alert('확정 명단 중 만들 수 있는 학생이 없습니다.\n(호출 확정 + 주간테스트 기록이 있는 초·중등 학생, 이번 주에 아직 안 만든 학생)'); return; }
  var rule=rcwsRule();
  if(!confirm('🧩 확정 명단 '+targets.length+'명의 학습지를 저장된 규칙으로 바로 만들까요?\n(시험 오답 쌍둥이 '+rule.twinPer+' · 교과서 '+rule.tbPer+' · 교재 오답 쌍둥이 '+rule.bookTwin+' · 보강 '+(rule.boost?'넣음':'안 넣음')+' · '+(rule.auto?'자동채점 문항만':'서술형 포함')+')\n매쓰플랫에 즉시 만들어 배정됩니다.')) return;
  RCWS.busy=true; var ok=0, bad=[];
  for(var i=0;i<targets.length;i++){ var x=targets[i];
    plToast('🧩 '+(i+1)+'/'+targets.length+' '+x.st.name+' 만드는 중…');
    try{ var model=await rcwsGather(x); var plan=rcwsPlan(model, rule); if(!rcwsPlanTotals(plan).total) throw new Error('넣을 문항 없음');
      var res=await rcwsBuild(model, plan, rcwsApi, null); await rcwsSaveMade(x.stKey, res); ok++; }
    catch(e){ bad.push(x.st.name+': '+(e.message||e)); }
    if(VIEW==='recovery') render();
  }
  RCWS.busy=false; if(VIEW==='recovery') render();
  alert('🧩 '+ok+'명 완료'+(bad.length?'\n\n실패 '+bad.length+'명\n'+bad.join('\n'):''));
};
