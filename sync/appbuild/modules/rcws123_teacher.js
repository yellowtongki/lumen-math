/* ═══════════════════════════════════════════════════════════════════
 * v19-123: 🧩 리커버리 학습지 새 규칙 (원장 지시 2026-10-16 「학원앱에도 넣어」 · 「이번주 지난주는 선택가능하게 한다」)
 *   서버판 sync/rcws_make.js 에 10/16 넣은 규칙을 학원앱 설계 팝업에도 같게 넣는다. rcws_teacher.js(v19-92·93) 위에 덮어쓴다.
 *   ① 주간테스트 고르기 — 학생마다 최근 주간테스트(응시일 me.date||t.date 기준)를 ☑ 로 고른다(이번 주만·지난 주만·둘 다).
 *      기본: rc_ws_rule.twoTestGrades(기본 ['중학교 3학년']) 학년은 최근 2개(이번 주+지난 주), 나머지는 1개(지금처럼 기준 미만 최근 시험).
 *      여러 시험의 오답을 합친다(같은 문제은행 번호는 한 번만) · 범위 유형 합침 · 교재 오답 합침.
 *   ② 「오답 1배수」 — 시험 오답 쌍둥이 2 → 1 (학생별)
 *   ③ 「교재 오답 빼기」 — 범위 안 교재 오답을 빼고 시험 오답만 (단원 오답은 따로 켜고 끈다)
 *   ④ 단원 정답률로 불린 학생 — 그 단원(대단원)의 최근 오답을 더한다.
 *      [단원 → 문항 잇기] 보드의 단원 이름(mf_progress.byStudent[sid][bid].chapters[].n)은 수집기가
 *        «문항 기록의 유형(concept_id) → 매쓰플랫 유형칩의 bigChapterName» 으로 묶은 이름이다(sync/mathflat_collector.js refreshRoadmap).
 *        mf_answer_records.chapter(「5 다면체와 회전체」「STEP 1 …」)는 교재 목차 글자라 단원 이름과 맞지 않는다 → 쓰지 않는다.
 *        그래서 거꾸로 간다: 그 교재의 매쓰플랫 유형칩(GET /concept/chips?curriculumKey=1&workbookIds=<교재>) 중
 *        bigChapterName 이 단원 이름과 같은 유형 → 그 유형들의 최근 교재 오답(result X, 기준 일수 unitDays). 수집기와 같은 사전이라 정답률과 정확히 맞는다.
 *        (매쓰플랫 계정이 없거나 실패하면) 유형DB mf_typedb(학년 → 대단원 → 중단원) + 유형 이름 사전(mf_type_ach.names[cid].m = 중단원)
 *        또는 기록의 chapter 글자(앞 번호 뗀 것)가 그 단원의 중단원 이름인 유형으로 대신한다.
 *   ⑤ 만들면 보드의 그 학생 기록(rc_state.calls[주][학생].snap)의 점수를 이번에 쓴 가장 최근 시험 점수로 바꾼다(score·scoreDate·testTitle).
 *      저장은 지금과 같은 rcSaveState 한 번(ws 기록과 함께) — 더 자주 덮어쓰지 않는다.
 *   ⑥ 만들기 전 구성 한 줄: 시험 오답 n개 (시험 1·2) · 쌍둥이 ×1/×2 · 교과서 · 교재/단원 오답 · 보강 · 예상 문항 수 — 단추를 바꾸면 다시 짠다.
 *   학생별 선택은 rc_ws_rule.per[학생키] = { wk, wids, twin1, noBook, unit } — 그 주에만 쓴다(다음 주는 다시 기본).
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
RCWS_RULE_DEFAULT = Object.assign({}, RCWS_RULE_DEFAULT, { twoTestGrades:['중학교 3학년'], unitDays:28, per:{} });

/* ── 학년 글자 맞추기: 「중학교 3학년」 = 「중3」 ── */
function rcws3GradeKey(g){ var m=String(g||'').match(/(초|중|고)[^0-9]*(\d)/); return m?(m[1]+m[2]):String(g||'').trim(); }
function rcws3IsTwo(grade, rule){ var k=rcws3GradeKey(grade); return ((rule&&rule.twoTestGrades)||[]).some(function(g){ return rcws3GradeKey(g)===k; }); }

/* ── 이 학생이 본 주간테스트 (응시일 최신 순) ── */
function rcws3MyTests(sid){
  var out=[];
  ((typeof WK!=='undefined'&&WK.tests)||[]).forEach(function(t){
    if(t.type!=='WEEKLY') return;
    var me=(t.students||[]).find(function(s){ return String(s.sid)===String(sid)&&s.score!=null; }); if(!me) return;
    out.push({ wid:t.wid, title:t.title, date:me.date||t.date, score:me.score, correct:me.correct, total:me.total, paper:t.paper||null });
  });
  out.sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
  return out;
}
/* 보드가 고른 시험(row.testHit)이 목록에 없으면 넣는다 (mf_weekly 를 아직 못 읽었을 때 등) */
function rcws3Mine(row){
  var mine=rcws3MyTests(row.sid), h=row.testHit;
  if(h&&h.wid!=null&&!mine.some(function(t){ return String(t.wid)===String(h.wid); })){ mine.push(h); mine.sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); }); }
  return mine;
}
/* 기본으로 고르는 시험: 2개 학년 = 최근 2개 · 나머지 = 보드가 고른 시험(기준 미만 최근) → 없으면 기간 안 최근 1개 */
function rcws3DefaultWids(row, mine, two){
  if(two) return mine.slice(0,2).map(function(t){ return String(t.wid); });
  if(row&&row.testHit&&row.testHit.wid!=null) return [String(row.testHit.wid)];
  var P=(typeof rcPeriod==='function')?rcPeriod():{ from:'', to:'9999' };
  var inP=mine.filter(function(t){ return t.date&&t.date>=P.from&&t.date<=P.to; });
  return inP.slice(0,1).map(function(t){ return String(t.wid); });
}
/* 학생별 선택 (그 주에만) */
function rcws3Opt(row){
  var rule=rcwsRule(); var p=(rule.per||{})[row.stKey]; if(!p||p.wk!==rcWeekKey()) p=null;
  var mine=rcws3Mine(row); var two=rcws3IsTwo(row.st&&row.st.grade, rule);
  var def=rcws3DefaultWids(row, mine, two), wids=def, custom=false;
  if(p&&Array.isArray(p.wids)){ custom=true; wids=p.wids.map(String).filter(function(w){ return mine.some(function(t){ return String(t.wid)===w; }); });
    if(!wids.length&&p.wids.length){ wids=def; custom=false; } }   // 고른 시험이 목록에서 사라졌으면 기본으로
  return { wids:wids, twin1:!!(p&&p.twin1), noBook:!!(p&&p.noBook), unit:!(p&&p.unit===false), two:two, custom:custom, def:def };
}
function rcws3SaveOpt(stKey, o){
  var r=rcwsRule(); delete r.updated; var wk=rcWeekKey(); var per={};
  Object.keys(r.per||{}).forEach(function(k){ if(r.per[k]&&r.per[k].wk===wk) per[k]=r.per[k]; });   // 지난 주 것은 지운다
  if(o) per[stKey]={ wk:wk, wids:(o.wids||[]).map(String), twin1:!!o.twin1, noBook:!!o.noBook, unit:o.unit!==false };
  else delete per[stKey];
  r.per=per; return rcwsSaveRule(r);
}

/* ── 단원 (보드의 단원 정답률 · 이월 · 호출 기록) → 교재 단원 이름으로 맞춤 ── */
function rcws3Units(row){
  var sid=row.sid, books=(typeof BP!=='undefined'&&BP.prog&&BP.prog[sid])||{}, out=[], idx={};
  var add=function(n, rate, bid){
    var k=rcNrm(n); if(!k) return;
    var hits=[];
    var scan=function(loose){ Object.keys(books).forEach(function(b){ var d=books[b]; ((d&&d.chapters)||[]).forEach(function(c){ var ck=rcNrm(c.n); if(!ck) return;
      if(ck===k||(loose&&(ck.indexOf(k)>=0||k.indexOf(ck)>=0))) hits.push({ bid:String(b), n:c.n }); }); }); };
    scan(false); if(!hits.length) scan(true);
    if(bid!=null&&!hits.some(function(h){ return h.bid===String(bid); })) hits.unshift({ bid:String(bid), n:n });
    var name=hits.length?hits[0].n:n; var nk=rcNrm(name);
    var u=idx[nk]; if(!u){ u=idx[nk]={ n:name, rate:rate, bids:[] }; out.push(u); }
    if(u.rate==null||(rate!=null&&rate<u.rate)) u.rate=rate;
    hits.forEach(function(h){ if(rcNrm(h.n)===nk&&u.bids.indexOf(h.bid)<0) u.bids.push(h.bid); });
    if(!u.bids.length) hits.forEach(function(h){ if(u.bids.indexOf(h.bid)<0) u.bids.push(h.bid); });
  };
  (row.unitHits||[]).forEach(function(u){ add(u.n, u.rate, u.bid); });
  (row.carryHits||[]).forEach(function(u){ add(u.n, u.rate, null); });
  try{ var e=((RC.state.calls||{})[rcWeekKey()]||{})[row.stKey]; ((e&&e.snap&&e.snap.units)||[]).forEach(function(u){ add(u.n, u.rate, null); }); }catch(err){}
  return out;
}
/* 유형칩 → 그 단원(대단원) 유형 번호 */
function rcws3CidsFromChips(chips, name){
  var k=rcNrm(name), out=[];
  (Array.isArray(chips)?chips:[]).forEach(function(c){ if(c&&c.conceptId!=null&&rcNrm(c.bigChapterName)===k&&out.indexOf(Number(c.conceptId))<0) out.push(Number(c.conceptId)); });
  return out;
}
/* 대신 길: 유형DB(학년 → 대단원 → 중단원) + 유형 중단원 이름 / 기록의 chapter 글자 */
function rcws3MidsOf(typedb, gradeLabel, name){
  var k=rcNrm(name), mids=[];
  ((typedb&&typedb.grades)||[]).forEach(function(G){ if(gradeLabel&&G.g!==gradeLabel) return;
    (G.b||[]).forEach(function(B){ if(rcNrm(B.n)===k) (B.m||[]).forEach(function(M){ if(M.n&&mids.indexOf(M.n)<0) mids.push(M.n); }); }); });
  return mids;
}
function rcws3CidsFromMids(recs, mids, midOf){
  var ks=mids.map(rcNrm), out=[];
  (recs||[]).forEach(function(x){ if(x.concept_id==null) return; var c=Number(x.concept_id); if(out.indexOf(c)>=0) return;
    var m=midOf?midOf(c):''; var lab=String(x.chapter||'').replace(/^\s*\d+\s*/,'');
    if((m&&ks.indexOf(rcNrm(m))>=0)||ks.indexOf(rcNrm(lab))>=0) out.push(c); });
  return out;
}
async function rcws3UnitCids(bid, name, sid){
  var how='', cids=[];
  var ck='chips_'+bid, chips=RCWS.cache[ck];
  if(chips===undefined){ chips=null; var a=rcwsAcct(); if(a.id&&a.pw){ try{ chips=await rcwsApi.call('GET','/concept/chips?curriculumKey=1&workbookIds='+bid); }catch(e){ chips=null; } } RCWS.cache[ck]=chips; }
  if(chips){ cids=rcws3CidsFromChips(chips, name); if(cids.length) return { cids:cids, how:'매쓰플랫 교재 단원표' }; }
  // 대신 길
  if(RCWS.cache.typedb===undefined){ var st=await rcwsStore(['mf_typedb']); RCWS.cache.typedb=st.mf_typedb||null; }
  var gl=(typeof BP!=='undefined'&&BP.books&&BP.books[bid]&&BP.books[bid].g)||'';
  var mids=rcws3MidsOf(RCWS.cache.typedb, gl, name); if(!mids.length) mids=rcws3MidsOf(RCWS.cache.typedb, '', name);
  if(!mids.length) mids=[name];
  var sb=getSupaClient(); var r=await sb.from('mf_answer_records').select('concept_id,chapter').eq('mf_student_id',sid).eq('source','교재').eq('book_id',bid).limit(3000);
  cids=rcws3CidsFromMids((r&&r.data)||[], mids, function(c){ var A=window.MF_TYPE_ACH; var n=A&&A.names&&A.names[c]; return (n&&n.m)||''; });
  return { cids:cids, how:cids.length?'중단원 이름으로 대신 ('+mids.join('·')+')':'' };
}

/* ── 여러 시험 합치기 (순수 함수 — 검사용) ── */
function rcws3Merge(models){
  var M0=models[0];
  var M={ row:M0.row, sid:M0.sid, test:M0.test, tests:[], wrong:[], range:[], rangeNames:[], bookWrong:[], tb:{ bid:null, title:'', byCid:{} }, solved:{}, warn:[], dup:0 };
  var seenP={}, seenW={};
  models.forEach(function(o, ti){
    if(o.test) M.tests.push(o.test);
    (o.wrong||[]).forEach(function(w){ if(w.pid&&seenP[w.pid]){ M.dup++; return; } if(w.pid) seenP[w.pid]=1; M.wrong.push(Object.assign({}, w, { tn:ti+1, tt:(o.test&&o.test.title)||'' })); });
    (o.range||[]).forEach(function(c){ if(M.range.indexOf(c)<0) M.range.push(c); });
    (o.rangeNames||[]).forEach(function(n){ if(M.rangeNames.indexOf(n)<0) M.rangeNames.push(n); });
    (o.bookWrong||[]).forEach(function(w){ if(seenW[w.wpId]) return; seenW[w.wpId]=1; M.bookWrong.push(Object.assign({}, w)); });
    Object.keys(o.solved||{}).forEach(function(k){ M.solved[k]=1; });
    if(!M.tb.bid&&o.tb&&o.tb.bid) M.tb=o.tb;
    (o.warn||[]).forEach(function(w){ if(M.warn.indexOf(w)<0) M.warn.push(w); });
  });
  if(!M.tb.bid&&M0.tb) M.tb=M0.tb;
  return M;
}
function rcws3Empty(row){ return { row:row, sid:row.sid, test:null, tests:[], wrong:[], range:[], rangeNames:[], bookWrong:[], tb:{ bid:null, title:'', byCid:{} }, solved:{}, warn:[], dup:0 }; }

/* ── 재료 모으기: 고른 시험들 + 단원 오답 ── */
var _rcwsGather92=rcwsGather;
async function rcws3Gather(row, opt){
  var mine=rcws3Mine(row), days=rcwsRule().days;
  var tests=mine.filter(function(t){ return opt.wids.indexOf(String(t.wid))>=0; });
  var models=[];
  for(var i=0;i<tests.length;i++){ var t=tests[i]; var ck='g_'+row.sid+'_'+t.wid+'_'+days;
    if(!RCWS.cache[ck]) RCWS.cache[ck]=await _rcwsGather92(Object.assign({}, row, { testHit:t }));
    models.push(RCWS.cache[ck]); }
  var M=models.length?rcws3Merge(models):rcws3Empty(row);
  M.row=row; M.test=M.tests[0]||null; M.unitInfo=[];
  await rcws3AddUnits(M, rcws3Units(row));
  return M;
}
async function rcws3AddUnits(M, units){
  if(!units.length) return;
  var sb=getSupaClient(), sid=M.sid, rule=rcwsRule();
  var since=new Date(Date.now()-(Number(rule.unitDays)||28)*86400000).toISOString();
  var seenW={}; M.bookWrong.forEach(function(w){ seenW[w.wpId]=1; });
  var bids={}, allC={};
  for(var i=0;i<units.length;i++){ var u=units[i]; var cids=[], how='';
    for(var j=0;j<u.bids.length;j++){ var r=await rcws3UnitCids(u.bids[j], u.n, sid); r.cids.forEach(function(c){ if(cids.indexOf(c)<0) cids.push(c); }); how=how||r.how; }
    var info={ n:u.n, rate:u.rate, cids:cids.length, wrong:0, how:how };
    M.unitInfo.push(info);
    if(!cids.length){ M.warn.push('단원 「'+u.n+'」의 유형을 찾지 못해 단원 오답을 넣지 못했습니다'); continue; }
    cids.forEach(function(c){ allC[c]=1; });
    var q=await sb.from('mf_answer_records').select('book_id,page,number,workbook_problem_id,concept_id,level,score_datetime')
      .eq('mf_student_id',sid).eq('source','교재').eq('result','X').in('concept_id',cids).gte('score_datetime',since).order('score_datetime',{ascending:false}).limit(300);
    ((q&&q.data)||[]).forEach(function(x){ var k=Number(x.workbook_problem_id); if(!k||seenW[k]) return; seenW[k]=1; bids[String(x.book_id)]=1; info.wrong++;
      M.bookWrong.push({ wpId:k, bid:String(x.book_id), page:x.page, no:x.number, cid:Number(x.concept_id), lv:Number(x.level)||3, date:String(x.score_datetime||'').slice(0,10), pid:null, unit:u.n }); });
  }
  var keys=Object.keys(bids).map(function(b){ return 'mf_textbook_'+b; });
  var st=keys.length?await rcwsStore(keys):{};
  Object.keys(bids).forEach(function(b){ var bank=st['mf_textbook_'+b]; if(!bank||!bank.problems) return; var byWp={}; bank.problems.forEach(function(p){ byWp[String(p.id)]=p; });
    M.bookWrong.forEach(function(w){ if(w.unit&&w.bid===b&&!w.pid&&byWp[String(w.wpId)]){ w.pid=rcwsBankId(byWp[String(w.wpId)]); w.book=bank.title||''; } }); });
  M.bookWrong.forEach(function(w){ if(w.unit&&w.pid) M.solved[String(w.pid)]=1; });
  var cl=Object.keys(allC).map(Number);
  if(cl.length){ var r3=await sb.from('mf_answer_records').select('problem_id').eq('mf_student_id',sid).eq('source','학습지').in('concept_id',cl).not('problem_id','is',null).limit(2000);
    ((r3&&r3.data)||[]).forEach(function(x){ M.solved[String(x.problem_id)]=1; }); }
}
/* 학생별 단추 반영: 교재 오답 빼기 · 단원 오답 끄기 */
function rcws3View(raw, opt){
  return Object.assign({}, raw, { opt:opt, bookWrong:raw.bookWrong.filter(function(w){ return w.unit?(opt.unit!==false):!opt.noBook; }) });
}
rcwsGather=async function(row){ return rcws3View(await rcws3Gather(row, rcws3Opt(row)), rcws3Opt(row)); };

/* ── 설계: 오답 1배수 ── */
var _rcwsPlan92=rcwsPlan, _rcwsPlanTotals92=rcwsPlanTotals;
rcwsPlan=function(model, rule, opt){
  var p=_rcwsPlan92(model, rule); opt=opt||model.opt||{}; p.opt=opt;
  if(opt.twin1) p.test.forEach(function(x){ x.n=p.rule.twinPer>0?1:0; });
  return p;
};
rcwsPlanTotals=function(plan){
  var t=_rcwsPlanTotals92(plan); t.unit=0; plan.book.forEach(function(x){ if(x.w.unit) t.unit+=x.n; }); t.bookOnly=t.book-t.unit; return t;
};
/* 구성 한 줄 (⑥) */
function rcws3Summary(M, P){
  var t=rcwsPlanTotals(P), nT=(M.tests||[]).length;
  var tw=P.test.length?P.test[0].n:(P.opt&&P.opt.twin1?1:P.rule.twinPer);
  var bits=['시험 오답 '+M.wrong.length+'개'+(nT?' (시험 '+(nT>1?(nT+'개 합침'):'1개')+')':' (시험 없음)'),
    '쌍둥이 ×'+tw+' = '+t.twin, '교과서 '+t.tb, '교재 오답 '+t.bookOnly, '단원 오답 '+t.unit, '보강 '+t.boost];
  return { text:bits.join(' · ')+' → 예상 '+t.total+'문항', t:t };
}

/* ── 만든 기록 + 보드 점수 갱신 (⑤) ── */
function rcws3ApplySnap(e, tests){
  var lt=(tests||[]).slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); })[0];
  if(!e||!lt) return false;
  e.snap=e.snap||{}; e.snap.score=lt.score; e.snap.scoreDate=lt.date; e.snap.testTitle=lt.title; return true;
}
rcwsSaveMade=async function(stKey, res, model){
  model=model||(RCWS_CUR&&RCWS_CUR.stKey===stKey?RCWS_CUR.model:null);
  var tests=(model&&model.tests)||[];
  RCWS.made[stKey]={ wk:rcWeekKey(), wsId:res.wsId, title:res.title, n:res.n, parts:res.parts, at:res.at,
    tests:tests.map(function(t){ return { wid:t.wid, date:t.date, score:t.score }; }), unitN:res.unitN||0 };
  try{ await supaSetItem('rc_ws_made',{ byKey:RCWS.made, updated:new Date().toISOString() }); }catch(e){}
  try{ var wk=rcWeekKey(); var e=RC.state.calls[wk]&&RC.state.calls[wk][stKey];
    if(e){ e.ws={ wsId:res.wsId, n:res.n, parts:res.parts, at:res.at }; if(!e.snap){ var s=rcSnapOf(stKey); if(s) e.snap=s; } rcws3ApplySnap(e, tests); rcSaveState(); } }catch(err){}
};

/* ── 학생 카드 단추: 기준 미만 시험이 없어도 (단원으로 불렸거나 시험 기록이 있으면) 설계할 수 있게 ── */
function rcws3Can(x){ if(!x||!rcWsSchool(x.st)) return false; return !!(x.testHit||rcws3MyTests(x.sid).length||(x.unitHits&&x.unitHits.length)||(x.carryHits&&x.carryHits.length)); }
rcWsBtn=function(x){
  if(!rcws3Can(x)){
    var why=!rcWsSchool(x.st)?'고등부는 아직 매쓰플랫에서 직접 만들어 주세요':'주간테스트·단원 기록이 없어 설계할 수 없어요';
    return '<span title="'+esc2(why)+'" style="font-size:11.5px;font-weight:800;color:#cbd5e1;border:1.5px dashed #e2e8f0;border-radius:9px;padding:6px 12px">🧩 학습지</span>';
  }
  var m=rcwsMadeOf(x.stKey), h='';
  if(m){ var p=m.parts||{}; h+='<span title="매쓰플랫 → 학습지 → 내학습지 #'+esc2(String(m.wsId))+'" style="font-size:11.5px;font-weight:900;color:#15803d;background:#dcfce7;border:1.5px solid #bbf7d0;border-radius:9px;padding:7px 12px">✅ '+m.n+'문항 · 시험 쌍둥이 '+(p.twin||0)+' · 교과서 '+(p.tb||0)+' · 교재 '+(p.book||0)+(m.unitN?' (단원 '+m.unitN+')':'')+' · 보강 '+(p.boost||0)+'</span>'; }
  h+='<button onclick="rcwsOpen(\''+esc2(x.stKey).replace(/'/g,'')+'\')" style="border:none;background:linear-gradient(135deg,#0d2240,#1d4f91);color:#fff;border-radius:9px;padding:7px 13px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit">🧩 '+(m?'다시 설계':'학습지 설계')+'</button>';
  return h;
};

/* ── 설계 팝업 ── */
rcwsOpen=async function(stKey){
  var row=rcRows().find(function(r){ return r.stKey===stKey; });
  if(!row||!rcws3Can(row)){ alert('이 학생의 주간테스트·단원 기록을 찾지 못했습니다.'); return; }
  RCWS_CUR={ row:row, stKey:stKey, opt:rcws3Opt(row), rule:rcwsRule(), raw:null, model:null, plan:null, busy:false, loading:true, logs:[], result:null, err:'' };
  rcPopShow(rcPopHead('🧩 학습지 설계 — '+esc2(row.st.name))+'<div style="padding:30px;text-align:center;color:#94a3b8;font-weight:700">시험 오답·교재 오답·단원 오답·교과서 문항을 모으는 중…</div>');
  await rcws3Refresh(true);
};
window.rcwsOpen=rcwsOpen;
async function rcws3Refresh(regather){
  var C=RCWS_CUR; if(!C) return;
  if(regather){ C.loading=true; if(C.raw) rcwsPaint();
    try{ C.raw=await rcws3Gather(C.row, C.opt); }
    catch(e){ C.loading=false; rcPopShow(rcPopHead('🧩 학습지 설계')+'<div style="padding:20px;color:#dc2626;font-weight:800">재료를 읽지 못했습니다: '+esc2(e.message)+'</div>'); return; }
    if(RCWS_CUR!==C) return; }
  C.loading=false; C.model=rcws3View(C.raw, C.opt); C.plan=rcwsPlan(C.model, C.rule, C.opt);
  if(document.getElementById('rc-pop')) rcwsPaint();
}
window.rcws3PickTest=function(wid, on){
  var C=RCWS_CUR; if(!C||C.busy||C.loading) return; wid=String(wid);
  var w=C.opt.wids.filter(function(x){ return x!==wid; }); if(on) w.push(wid);
  var order=rcws3Mine(C.row).map(function(t){ return String(t.wid); });
  w.sort(function(a,b){ return order.indexOf(a)-order.indexOf(b); });
  C.opt.wids=w; C.opt.custom=true; rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(true);
};
window.rcws3Toggle=function(k){
  var C=RCWS_CUR; if(!C||C.busy||C.loading) return;
  if(k==='unit') C.opt.unit=!(C.opt.unit!==false); else C.opt[k]=!C.opt[k];
  rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(false);
};
window.rcws3ResetOpt=function(){
  var C=RCWS_CUR; if(!C||C.busy||C.loading) return;
  var p=rcws3SaveOpt(C.stKey, null); C.opt=rcws3Opt(C.row); rcws3Refresh(true); return p;
};
rcwsRuleChange=function(){ var C=RCWS_CUR; if(!C||C.busy||C.loading) return; var g=function(id){ var el=document.getElementById(id); return el?el.value:''; };
  C.rule=Object.assign({}, C.rule, { twinPer:Number(g('rcws-twin'))||0, tbPer:Number(g('rcws-tb'))||0, bookTwin:Number(g('rcws-bk'))||0, boost:!!(document.getElementById('rcws-boost')||{}).checked,
    theory:!!(document.getElementById('rcws-theory')||{}).checked, days:Number(g('rcws-days'))||28, auto:!!(document.getElementById('rcws-auto')||{}).checked, unitDays:Number(g('rcws-udays'))||28 });
  rcws3Refresh(false); };
window.rcwsRuleChange=rcwsRuleChange;

rcwsPaint=function(){
  var C=RCWS_CUR; if(!C||!document.getElementById('rc-pop')||!C.model) return;
  if(!C.row) C.row=C.model.row; if(!C.opt) C.opt=C.model.opt||rcws3Opt(C.row); if(!C.logs) C.logs=[];
  var M=C.model, P=C.plan, rule=P.rule, O=C.opt, S=rcws3Summary(M, P), t=S.t;
  var h=rcPopHead('🧩 학습지 설계 — '+esc2(M.row.st.name)+' <span style="font-size:12px;color:#64748b;font-weight:700">'+esc2(M.row.st.grade||'')+'</span>');
  // 주간테스트 고르기 (①)
  var mine=rcws3Mine(C.row), show=mine.slice(0,4);
  mine.forEach(function(t2){ if(O.wids.indexOf(String(t2.wid))>=0&&show.indexOf(t2)<0) show.push(t2); });
  h+='<div style="border:1px solid #e2e8f0;border-radius:11px;padding:8px 11px;margin-bottom:9px"><div style="font-size:11.5px;font-weight:900;color:#334155;margin-bottom:5px">📝 쓸 주간테스트 <small style="color:#64748b;font-weight:700">(응시일 순 · '+(O.two?esc2(rcws3GradeKey(M.row.st.grade))+' 기본 = 이번 주+지난 주':'기본 = 최근 1개')+')</small>'
    +(O.custom?' <button onclick="rcws3ResetOpt()" style="border:none;background:none;color:#1d4f91;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit">↺ 기본으로</button>':'')+'</div>';
  if(!show.length) h+='<div style="font-size:11.5px;color:#94a3b8;font-weight:700">주간테스트 기록이 없습니다 — 단원 오답으로만 만듭니다</div>';
  show.forEach(function(t2, i){ var on=O.wids.indexOf(String(t2.wid))>=0;
    h+='<label style="display:flex;gap:7px;align-items:center;font-size:12px;font-weight:800;color:'+(on?'#0d2240':'#94a3b8')+';padding:2px 0;cursor:pointer"><input type="checkbox" data-rcws-wid="'+esc2(String(t2.wid))+'" onchange="rcws3PickTest(\''+esc2(String(t2.wid)).replace(/'/g,'')+'\',this.checked)"'+(on?' checked':'')+(C.loading||C.busy?' disabled':'')+'>'
      +esc2(t2.title||'주간테스트')+' <span style="color:#64748b">· 응시 '+esc2(String(t2.date||'').slice(5).replace('-','.'))+' · '+t2.score+'점'+(t2.correct!=null?' ('+t2.correct+'/'+t2.total+')':'')+'</span>'+(i===0?' <small style="color:#1d4f91">가장 최근</small>':'')+'</label>'; });
  h+='</div>';
  if(C.loading) h+='<div style="padding:8px;text-align:center;color:#94a3b8;font-weight:700;font-size:12px">다시 모으는 중…</div>';
  // 학생별 단추 (②③④)
  var tg=function(k, on, label, title){ return '<button onclick="rcws3Toggle(\''+k+'\')" data-rcws-tg="'+k+'" title="'+esc2(title)+'" style="border:1.5px solid '+(on?'#6d28d9':'#e2e8f0')+';background:'+(on?'#ede9fe':'#fff')+';color:'+(on?'#6d28d9':'#64748b')+';border-radius:8px;padding:5px 10px;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer">'+(on?'✓ ':'')+label+'</button>'; };
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+tg('twin1', O.twin1, '오답 1배수', '시험 오답 쌍둥이를 '+rule.twinPer+'개 → 1개로 (문항 수 줄이기)')
    +tg('noBook', O.noBook, '교재 오답 빼기', '범위 안 교재 오답을 빼고 시험 오답만')
    +((M.unitInfo&&M.unitInfo.length)?tg('unit', O.unit!==false, '단원 오답 넣기', '단원 정답률로 불린 단원의 최근 교재 오답'):'')+'</div>';
  // 구성 한 줄 (⑥)
  h+='<div data-rcws-sum style="background:#eef2ff;color:#3730a3;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:900;margin-bottom:9px">📋 '+esc2(S.text)+'</div>';
  if(M.rangeNames.length) h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;font-size:11px;font-weight:800;color:#64748b">범위 '+M.rangeNames.slice(0,8).map(function(n){ return '<span style="background:#eef2ff;color:#3730a3;border-radius:50px;padding:2px 9px">'+esc2(n)+'</span>'; }).join('')+(M.rangeNames.length>8?' 외 '+(M.rangeNames.length-8):'')+'</div>';
  M.warn.forEach(function(w){ h+='<div style="background:#fef3c7;color:#92400e;border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:800;margin-bottom:8px">⚠ '+esc2(w)+'</div>'; });
  var blk=function(title, sub){ return '<div style="border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;margin-bottom:9px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;background:#f1f5f9;flex-wrap:wrap"><b style="font-size:12.5px">'+title+'</b><small style="font-size:11px;color:#64748b;font-weight:700">'+sub+'</small></div>'; };
  var rowH=function(no, main, sub, ctl){ return '<div style="display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;padding:7px 11px;border-top:1px solid #f1f5f9;font-size:12px"><span style="font-family:ui-monospace,monospace;font-weight:700;color:#64748b">'+no+'</span><span><b>'+main+'</b><small style="display:block;color:#64748b;font-size:10.5px;font-weight:700">'+sub+'</small></span>'+ctl+'</div>'; };
  var lvTag=function(lv){ return ' <span style="font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;background:#fef3c7;color:#b45309">'+(RCWS_LV[lv]||'')+'</span>'; };
  var multi=(M.tests||[]).length>1, tno=function(w){ return (multi?'시험'+(w.tn||1)+' ':'')+w.no+'번'; };
  h+=blk('① 주간테스트 오답 '+M.wrong.length+'문항 → 쌍둥이'+(O.twin1?' ×1':''), (multi?'시험 '+M.tests.length+'개 합침'+(M.dup?' · 같은 문제 '+M.dup+'개는 한 번만':'')+' · ':'')+'이미 푼 문제는 뺌');
  if(!M.wrong.length) h+='<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">틀린 문항이 없습니다</div>';
  P.test.forEach(function(x){ var nm=tqName(x.w.cid); h+=rowH(tno(x.w), esc2(nm===String(x.w.cid)?'유형 정보 없음':nm)+lvTag(x.w.lv), (multi&&x.w.tt?esc2(x.w.tt)+' · ':'')+(x.w.pid?'문제은행 #'+x.w.pid:'문제 번호 없음 → 같은 유형으로 대체'), rcwsSeg('test',x.i,x.n,3)); });
  h+='</div>';
  if(P.tb.length){ h+=blk('② 틀린 문항마다 교과서 같은 유형', M.tb.title?esc2(M.tb.title):'배정 교과서 없음 → 같은 유형 문제로 대체');
    P.tb.forEach(function(y){ var tbl=M.tb.byCid[y.w.cid]||[]; h+=rowH(tno(y.w), esc2(tqName(y.w.cid)), tbl.length?('교과서에 이 유형 '+tbl.length+'문항'+(tbl[0]&&tbl[0].page?' (p.'+tbl[0].page+'~)':'')):'교과서에 이 유형 없음 → 같은 유형으로 대체', rcwsSeg('tb',y.i,y.n,2)); });
    h+='</div>'; }
  var bk=P.book.filter(function(z){ return !z.w.unit; }), un=P.book.filter(function(z){ return z.w.unit; });
  var bookRow=function(z, k){ return rowH(String(k+1), esc2((z.w.book?z.w.book.slice(0,16)+' ':'')+'p.'+z.w.page+' '+z.w.no+'번')+lvTag(z.w.lv), esc2(tqName(z.w.cid))+' · '+String(z.w.date||'').slice(5).replace('-','.')+' 채점'+(z.w.pid?'':' · 번호 못 찾음 → 같은 유형으로 대체'), rcwsSeg('book',z.i,z.n,2)); };
  h+=blk('③ 범위 안 교재 오답 '+bk.length+'문항 → 쌍둥이', O.noBook?'뺌 (교재 오답 빼기)':'최근 '+rule.days+'일 · 매쓰플랫 채점 기록');
  if(!bk.length) h+='<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">'+(O.noBook?'교재 오답 빼기 — 시험 오답만으로 만듭니다':'범위 안에서 교재로 틀린 문제가 없습니다')+'</div>';
  bk.forEach(function(z,k){ h+=bookRow(z,k); });
  h+='</div>';
  if(M.unitInfo&&M.unitInfo.length){
    h+=blk('③-2 단원 오답 '+un.length+'문항 → 쌍둥이', O.unit===false?'끔':'단원 정답률로 불린 단원 · 최근 '+(rule.unitDays||28)+'일');
    M.unitInfo.forEach(function(u){ h+='<div style="padding:6px 11px;border-top:1px solid #f1f5f9;font-size:11.5px;font-weight:800;color:#92400e">「'+esc2(u.n)+'」'+(u.rate!=null?' '+u.rate+'%':'')+' · 유형 '+u.cids+'개'+(u.how?' ('+esc2(u.how)+')':'')+' · 최근 오답 '+u.wrong+'문항</div>'; });
    un.forEach(function(z,k){ h+=bookRow(z,k); });
    h+='</div>'; }
  if(P.boost.length){ h+=blk('④ 보강 — 두 번 이상 틀린 유형', '유형마다 1문항');
    P.boost.forEach(function(b,i){ h+=rowH('+1', esc2(tqName(b.cid)), '시험·교재 합쳐 '+b.times+'번 틀림', rcwsSeg('boost',i,b.n,1)); }); h+='</div>'; }
  h+='<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:4px 0 10px">'
    +[['총 문항',t.total,'#0d2240'],['시험 쌍둥이',t.twin,'#6d28d9'],['교과서',t.tb,'#0e7490'],['교재 오답',t.bookOnly,'#6d28d9'],['단원 오답',t.unit,'#b45309'],['보강',t.boost,'#b45309']].map(function(c){ return '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:6px 4px;text-align:center"><div data-rcws-tot="'+c[0]+'" style="font-size:18px;font-weight:900;color:'+c[2]+'">'+c[1]+'</div><div style="font-size:10px;color:#64748b;font-weight:800">'+c[0]+'</div></div>'; }).join('')+'</div>';
  var sel=function(id,val,max){ var s='<select id="'+id+'" onchange="rcwsRuleChange()" style="font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px">'; for(var k=0;k<=max;k++) s+='<option'+(k===val?' selected':'')+'>'+k+'</option>'; return s+'</select>'; };
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:11.5px;font-weight:800;color:#475569;margin-bottom:10px">'
    +'<label>시험 오답 쌍둥이 '+sel('rcws-twin',rule.twinPer,3)+'</label><label>교과서 '+sel('rcws-tb',rule.tbPer,2)+'</label><label>교재 오답 쌍둥이 '+sel('rcws-bk',rule.bookTwin,2)+'</label>'
    +'<label><input type="checkbox" id="rcws-boost" onchange="rcwsRuleChange()"'+(rule.boost?' checked':'')+'> 보강</label>'
    +'<label><input type="checkbox" id="rcws-theory" onchange="rcwsRuleChange()"'+(rule.theory?' checked':'')+'> 이론 박스</label>'
    +'<label title="서술형을 빼고 정답 글자가 있는 문항만 — 단답은 학생앱이 채점"><input type="checkbox" id="rcws-auto" onchange="rcwsRuleChange()"'+(rule.auto?' checked':'')+'> 자동채점 문항만</label>'
    +'<label>교재 오답 최근 <input id="rcws-days" type="number" value="'+rule.days+'" min="7" max="120" onchange="rcwsRuleChange()" style="width:48px;font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px">일</label>'
    +'<label>단원 오답 최근 <input id="rcws-udays" type="number" value="'+(rule.unitDays||28)+'" min="7" max="120" onchange="rcwsRuleChange()" style="width:48px;font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px">일</label>'
    +'<label><input type="checkbox" id="rcws-save" checked> 이 규칙을 「확정 전원」 기본으로</label></div>';
  if(C.logs.length) h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 11px;font-size:11.5px;font-weight:700;color:#334155;margin-bottom:10px;max-height:160px;overflow:auto">'+C.logs.map(function(l){ return '<div>'+esc2(l)+'</div>'; }).join('')+'</div>';
  if(C.err) h+='<div style="background:#fee2e2;color:#b91c1c;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:800;margin-bottom:10px">✗ '+esc2(C.err)+'</div>';
  if(C.result){ var R=C.result; h+='<div style="background:#dcfce7;color:#166534;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:900;margin-bottom:10px">✅ 매쓰플랫에 만들어 배정했습니다 — 「'+esc2(R.title)+'」 '+R.n+'문항 · 학습지 #'+esc2(String(R.wsId))+'<div style="font-size:11px;font-weight:700;margin-top:3px">시험 쌍둥이 '+R.parts.twin+' · 교과서 '+R.parts.tb+' · 교재·단원 쌍둥이 '+R.parts.book+' · 보강 '+R.parts.boost+(R.parts.fallback?' · 같은 유형으로 대체 '+R.parts.fallback:'')+' — 매쓰플랫 → 학습지 → 내학습지에서 인쇄 · 보드 점수를 '+(M.test?M.test.score+'점('+esc2(String(M.test.date||'').slice(5).replace('-','.'))+')':'-')+'으로 바꿨습니다</div></div>'; }
  h+='<div style="display:flex;gap:7px;flex-wrap:wrap">';
  if(!C.result) h+='<button id="rcws-make" onclick="rcwsMake()" '+(C.busy||C.loading?'disabled':'')+' style="border:none;border-radius:10px;padding:10px 14px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:#1d4f91;color:#fff">'+(C.busy?'⏳ 만드는 중…':'🧩 매쓰플랫에 만들기 · 배정 ('+t.total+'문항)')+'</button>';
  h+='<button onclick="rcPopClose()" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:#fff;color:#64748b">'+(C.result?'닫기':'취소')+'</button></div>';
  rcPopShow(h);
};

/* 지금 저장된 규칙(학생별 선택·2개 학년 포함)에 팝업에서 바꾼 숫자만 얹어 저장 */
function rcws3RuleToSave(r){ var cur=rcwsRule(); var o=Object.assign({}, cur, r||{}); o.per=cur.per||{}; o.twoTestGrades=cur.twoTestGrades; delete o.updated; return o; }
rcwsMake=async function(){
  var C=RCWS_CUR; if(!C||C.busy||C.loading) return;
  var t=rcwsPlanTotals(C.plan); if(!t.total){ alert('넣을 문항이 없습니다 — 시험을 고르거나 쌍둥이 수를 올려 주세요'); return; }
  if((document.getElementById('rcws-save')||{}).checked) rcwsSaveRule(rcws3RuleToSave(C.plan.rule));
  C.busy=true; C.err=''; C.logs=[]; rcwsPaint();
  try{
    var res=await rcwsBuild(C.model, C.plan, rcwsApi, function(s){ C.logs.push(s); rcwsPaint(); });
    res.unitN=t.unit; C.result=res; await rcwsSaveMade(C.stKey, res, C.model);
    plToast('🧩 학습지 #'+res.wsId+' · '+res.n+'문항 — 매쓰플랫에 만들어 배정했습니다');
  }catch(e){ C.err=e.message||String(e); }
  C.busy=false; rcwsPaint(); if(VIEW==='recovery') render();
};
window.rcwsMake=rcwsMake;
rcMakeWsAll=async function(){
  if(RCWS.busy) return;
  var rows=rcRows();
  var targets=rcConfirmed().map(function(c){ return rows.find(function(r){ return r.stKey===c.k; }); })
    .filter(function(x){ return x&&rcws3Can(x)&&!rcwsMadeOf(x.stKey); });
  if(!targets.length){ alert('확정 명단 중 만들 수 있는 학생이 없습니다.\n(호출 확정 + 주간테스트·단원 기록이 있는 초·중등 학생, 이번 주에 아직 안 만든 학생)'); return; }
  var rule=rcwsRule();
  if(!confirm('🧩 확정 명단 '+targets.length+'명의 학습지를 저장된 규칙으로 바로 만들까요?\n(시험 오답 쌍둥이 '+rule.twinPer+' · 교과서 '+rule.tbPer+' · 교재 오답 쌍둥이 '+rule.bookTwin+' · 보강 '+(rule.boost?'넣음':'안 넣음')+' · '+(rule.auto?'자동채점 문항만':'서술형 포함')
    +'\n · 시험 2개 합치기: '+((rule.twoTestGrades||[]).join(', ')||'없음')+' · 단원으로 불린 학생은 단원 오답(최근 '+(rule.unitDays||28)+'일) · 학생별 선택(시험·1배수·교재 빼기)은 그대로)\n매쓰플랫에 즉시 만들어 배정됩니다.')) return;
  RCWS.busy=true; var ok=0, bad=[];
  for(var i=0;i<targets.length;i++){ var x=targets[i];
    plToast('🧩 '+(i+1)+'/'+targets.length+' '+x.st.name+' 만드는 중…');
    try{ var opt=rcws3Opt(x); var raw=await rcws3Gather(x, opt); var model=rcws3View(raw, opt); var plan=rcwsPlan(model, rule, opt); var tt=rcwsPlanTotals(plan);
      if(!tt.total) throw new Error('넣을 문항 없음');
      var res=await rcwsBuild(model, plan, rcwsApi, null); res.unitN=tt.unit; await rcwsSaveMade(x.stKey, res, model); ok++; }
    catch(e){ bad.push(x.st.name+': '+(e.message||e)); }
    if(VIEW==='recovery') render();
  }
  RCWS.busy=false; if(VIEW==='recovery') render();
  alert('🧩 '+ok+'명 완료'+(bad.length?'\n\n실패 '+bad.length+'명\n'+bad.join('\n'):''));
};
window.rcMakeWsAll=rcMakeWsAll;
window.rcMakeWs=function(stKey){ rcwsOpen(stKey); };

/* ── 오른쪽 도구 칸(v19-106): 「시험 2개 합치기」 학년 · 단원 오답 일수 · 만들 수 있는 인원 ── */
window.rcws3TwoToggle=function(on){
  if(!RCWS.loaded) return; var r=rcwsRule(); delete r.updated;
  var g=(r.twoTestGrades||[]).filter(function(x){ return rcws3GradeKey(x)!=='중3'; }); if(on) g.push('중학교 3학년');
  r.twoTestGrades=g; var p=rcwsSaveRule(r); render(); return p;
};
window.rcws3UnitDays=function(v){ if(!RCWS.loaded) return; var r=rcwsRule(); delete r.updated; r.unitDays=Math.max(7, Math.min(120, Number(v)||28)); var p=rcwsSaveRule(r); render(); return p; };
if(typeof l3rRuleBox==='function'){
  var _l3rRuleBox123=l3rRuleBox;
  l3rRuleBox=function(){
    var h=_l3rRuleBox123.apply(this, arguments); if(!RCWS.loaded) return h;
    var r=rcwsRule(), on=(r.twoTestGrades||[]).some(function(g){ return rcws3GradeKey(g)==='중3'; });
    var add='<label class="l3r-ck" data-l3r-rule="two" title="학생별 설계 팝업에서 시험을 따로 고를 수도 있어요"><input type="checkbox" id="l3r-two"'+(on?' checked':'')+' onchange="rcws3TwoToggle(this.checked)"><span>중3은 주간테스트 2개(이번 주+지난 주) 합치기</span></label>'
      +'<label class="l3b-num">단원 오답 최근<input type="number" id="l3r-udays" min="7" max="120" value="'+(Number(r.unitDays)||28)+'" onchange="rcws3UnitDays(this.value)">일</label>';
    var k=h.indexOf('<span class="l3-sub">「확정 전원'); return k>=0?h.slice(0,k)+add+h.slice(k):h;
  };
}
if(typeof l3rMakeBox==='function'){
  var _l3rMakeBox123=l3rMakeBox;
  l3rMakeBox=function(){
    var h=_l3rMakeBox123.apply(this, arguments), can=0;
    try{ var conf=(L3B.rcConf&&L3B.rcConf.tick===L3B.tick)?L3B.rcConf.conf:rcConfirmed();
      conf.filter(function(c){ return !(c.e&&c.e.done); }).forEach(function(c){ if(c.row&&!rcwsMadeOf(c.k)&&rcws3Can(c.row)) can++; }); }catch(e){}
    return h.replace(/⚡ 확정 전원 학습지 생성( \(\d+명\))?/, '⚡ 확정 전원 학습지 생성'+(can?' ('+can+'명)':''));
  };
}
