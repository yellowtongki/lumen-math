/* ═══════════════════════════════════════════════════════════════════
 * v19-155: 🚑 리커버리 학습지 3판 — «아직 틀린 문제» · 유형마다 1개 · 학생별 예상 · 최상 포함 선택 · 보드 한 줄
 *   계약서 docs/recovery_recent_contract.md + 원장 10/23 밤 추가 결정(계약서보다 이것이 이긴다)
 *   서버판 sync/rcws_make.js 와 같은 규칙. 규칙 값은 lumen_store rc_ws_rule 한 곳.
 *
 *  기본 구성 (원장 10/23 밤) = 테스트 오답 쌍둥이 1개 + 최근 «아직 틀린 문제» 유형마다 1개
 *    교과서 같은 유형 · 보강 · 범위 안 교재 오답 · 자동 단원 오답은 끔(오른쪽 «학습지 규칙» 체크칸으로 켠다) · 상한/하한 «없음»
 *    → 예전에 저장된 rc_ws_rule 에 v155 표시가 없으면 이 구성으로 한 번 바꿔 읽는다(다음 저장 때 v155:1 이 붙는다)
 *  규칙 칸 (rc_ws_rule)
 *    recent  { on:true, days:7 }  최근 N일(칩 1주·2주·4주) «문제별 마지막 결과가 아직 X» 인 문제 — 교재 workbook_problem_id · 학습지 problem_id 단위
 *    perType true                 최근 오답·교재 오답은 유형마다 1개 = 그 유형에서 가장 최근 틀린 문제
 *                                 (이번 주 테스트 오답 문제는 먼저 뺀 뒤 고른다 — 테스트 쌍둥이로 이미 들어가므로)
 *    hardest false                최상(5단계) 포함 — 끄면 쌍둥이·같은 유형을 고를 때 level 5 를 빼고 4단계까지
 *    unitAuto false               단원 정답률로 불린 학생의 자동 단원 오답
 *    max 0 · min 0                학생 한 명 문항 상한·하한(0 = 없음). 넘으면 «쌍둥이 첫째 → 최근 오답(새것) → 교과서 → 쌍둥이 둘째 → 보강 → 교재 오답»
 *                                 순으로 남기고, 모자라면 최근 오답 기간을 56일로 넓힌 뒤 테스트·최근 오답 유형의 같은 유형(보강)으로 채운다
 *    exclude ''                   뺄 유형 이름 정규식(mf_concept_names) — 모든 재료와 쌍둥이 고르기에서 뺀다
 *    per[학생키] (그 주에만)       recent:false · recentDays · hardest · max · min · unitOn 을 덮어쓴다
 *  재료  rcws3Gather 를 감싸 한 학생 기록(mf_student_id + score_datetime>=, 기존 색인)을 56일치 읽어 «아직 틀린 문제»를 더한다.
 *  계획  rcwsPlan 을 감싸 최근 오답 1개씩 · 빼는 유형 · 유형마다 1개 · 하한 · 상한 · 최상 포함 여부(plan.rule.hardest)
 *  만들기 rcwsBuild 를 감싸 하한에서 더한 문제를 재료에 넣고 빼는 유형을 매쓰플랫 응답에서 걸러 낸다 · rcwsPickFrom 을 감싸 최상 빼기
 *  화면  설계 팝업 «🕘 최근 오답» 칸 · 학생별 끄기·기간 칩·최상·문항 범위 / 오른쪽 «학습지 규칙» 칸 / «📊 학생별 예상»(확정 학생,
 *        매쓰플랫 호출 없이 기록만으로 «테스트 쌍둥이 n + 최근 오답 n유형 = 예상 n문항» + 중단원 비율 막대) / 보드 카드 «🕘» 한 줄
 *        보드·예상 자료는 후보 학생 전부를 in.(sid,…) 한 번(1000줄씩 넘김)에 읽어 메모리에 두고, 규칙을 바꾸면 다시 읽지 않고 센다.
 *  ※ 문자열 연결만(템플릿 리터럴 금지). 바탕·앞 부품 함수는 감싸기만. 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var RW155 = { cname:null, cnameP:null, mk:[], bd:{ key:'', loading:'', bySid:{}, partial:false, err:'', win:0 }, fullBook:null, fullBoost:null, curOpt:null };
var RW155_WIDE = 56;
var RW155_DAYS = [7, 14, 28];
var RW155_BASE = { twinPer:1, tbPer:0, bookTwin:0, boost:false, unitAuto:false, recent:{ on:true, days:7 }, perType:true, hardest:false, max:0, min:0, exclude:'', twoTestGrades:[] };
var RW155_AUTOMAX = 40;   /* 원장 최종 결정: 상한은 기본 없음 — 기간이 2주 이상인 학생만 40 */
RCWS_RULE_DEFAULT = Object.assign({}, RCWS_RULE_DEFAULT, RW155_BASE, { recent:{ on:true, days:7 } });

/* ── 규칙: 예전 저장분은 새 기본 구성으로 한 번 바꿔 읽는다 ── */
var _rw155Rule92 = rcwsRule;
rcwsRule = function(){
  var r = _rw155Rule92();
  if (RCWS.rule && !RCWS.rule.v155) Object.keys(RW155_BASE).forEach(function(k){ r[k] = RW155_BASE[k]; });
  r.recent = Object.assign({ on:true, days:7 }, (r.recent && typeof r.recent === 'object') ? r.recent : (r.recent === false ? { on:false } : {}));
  r.v155 = 1;
  r.auto = true;   /* 원장 10/23 밤 «리커버리 학습지는 항상 자동채점 문항으로만» — 매쓰플랫 기준, 끄는 칸 없음 */
  return r;
};
/* ── 자동채점 = 매쓰플랫 자체 자동채점 가능 문항(autoScoredType ≠ IMPOSSIBLE · 교과서 은행은 auto) — 없으면 뺀다 ── */
/* IMPOSSIBLE 로 시작하는 값(_DRAWING·_DESCRIPTIVE·_ETC·_EXAMPLE_ANSWER·_INPUT_LIMIT)과 UNDEFINED·UNIDENTIFIED 도 «자동채점 아님» (2026-10-23 초6·중1 전수 확인) */
function rw155AutoOk(a){ return a === true || (typeof a === 'string' && a !== '' && !/^IMPOSSIBLE/.test(a) && a !== 'UNDEFINED' && a !== 'UNIDENTIFIED'); }
function rw155MfAuto(p){ var a = p && (p.autoScoredType || p.auto); return rw155AutoOk(a); }
var _rw155IsAuto92 = rcwsIsAuto;
rcwsIsAuto = function(p, rule){
  if (p && (p.autoScoredType != null || p.auto != null)) return rw155MfAuto(p);
  return _rw155IsAuto92(p, { auto:true });                                  // 매쓰플랫 응답 단계에서 이미 걸렀다(rw155Api) — 남은 것은 서술형·정답 없음만 다시 본다
};
function rw155Clamp(d){ return Math.max(7, Math.min(120, Math.round(Number(d)) || 7)); }
function rw155Cfg(rule, opt){
  rule = rule || rcwsRule(); opt = opt || {};
  var rc = rule.recent, on = true, days = 7;
  if (rc === false) on = false;
  else if (rc && typeof rc === 'object'){ on = rc.on !== false; days = Number(rc.days) || 7; }
  var ruleDays = rw155Clamp(days);
  days = opt.recentDays ? rw155Clamp(opt.recentDays) : ruleDays;
  var num = function(v, d){ if (v === '' || v == null) return d; var n = Math.round(Number(v)); return n >= 0 ? n : d; };
  var maxSet = (opt.max != null && opt.max !== '') ? num(opt.max, 0) : ((Number(rule.max) > 0) ? num(rule.max, 0) : null);
  var max = (maxSet != null) ? maxSet : (days >= 14 ? RW155_AUTOMAX : 0), min = num(opt.min, num(rule.min, 0));
  if (max > 0 && min > max) min = max;
  var src = String(rule.exclude || '').trim(), ex = null;
  if (src){ try { ex = new RegExp(src); } catch(e){ ex = null; } }
  return { ruleRecentOn:on, recentOn:on && opt.recent !== false, days:days, ruleDays:ruleDays, perType:rule.perType !== false,
    hardest:(opt.hardest != null ? !!opt.hardest : rule.hardest === true), ruleHardest:rule.hardest === true, unitAuto:rule.unitAuto === true,
    max:max, autoMax:(maxSet == null && max > 0), min:min, ex:ex, exSrc:src };
}
function rw155DaysLabel(d){ return (d % 7 === 0) ? ((d / 7) + '주') : (d + '일'); }

/* ── 유형 이름 사전 (mf_concept_names → 없으면 유형성취도 사전) ── */
function rw155Names(){
  if (RW155.cname) return Promise.resolve(RW155.cname);
  if (RW155.cnameP) return RW155.cnameP;
  RW155.cnameP = rcwsStore(['mf_concept_names']).then(function(st){ RW155.cname = st.mf_concept_names || {}; return RW155.cname; },
    function(){ RW155.cname = {}; return RW155.cname; });
  return RW155.cnameP;
}
function rw155CName(cid){
  var c = RW155.cname && RW155.cname[cid];
  var n = (c && typeof c === 'object') ? (c.n || c.name || '') : (typeof c === 'string' ? c : '');
  if (!n){ var t = tqName(cid); if (t !== String(cid)) n = t; }
  return n || '';
}
function rw155Mid(cid){ var c = RW155.cname && RW155.cname[cid]; var m = (c && typeof c === 'object' && c.m) || ''; if (!m){ try { m = rcUnitOf(cid) || ''; } catch(e){} } return m; }
function rw155IsEx(cid, re){ if (!re || cid == null || isNaN(cid)) return false; var n = rw155CName(cid); return !!(n && re.test(n)); }
/* 교재·학습지 제목 → 「중1-2」 같은 짧은 학년 글자 (없으면 빈 글자) */
function rw155GL(title){
  var s = String(title || ''), m = s.match(/(초|중|고)[^0-9]{0,6}(\d)\s*-\s*(\d)/);
  if (m) return m[1] + m[2] + '-' + m[3];
  m = s.match(/(초|중|고)[^0-9]{0,6}(\d)\s*\(\s*(상|하)/);
  if (m) return m[1] + m[2] + '-' + (m[3] === '상' ? '1' : '2');
  return '';
}

/* ── 문항 기록 읽기: 학생 한 명(eq) 또는 여러 명(in) · 1000줄씩 넘겨 읽기 ── */
async function rw155Read(sids, since, cap){
  var sb = getSupaClient(); if (!sb) throw new Error('서버 연결 없음');
  var out = [], off = 0, pages = 0, partial = false;
  while (true){
    var q = sb.from('mf_answer_records').select('id,mf_student_id,source,worksheet_id,worksheet_title,student_worksheet_id,book_id,page,number,workbook_problem_id,problem_id,concept_id,level,result,score_datetime');
    q = (sids.length === 1) ? q.eq('mf_student_id', sids[0]) : q.in('mf_student_id', sids);
    q = q.gte('score_datetime', since).not('concept_id', 'is', null).order('id', { ascending:true });
    var canRange = typeof q.range === 'function';
    var r = await (canRange ? q.range(off, off + 999) : q.limit(1000));
    if (r && r.error) throw new Error(r.error.message || '문항 기록을 읽지 못했습니다');
    var d = (r && r.data) || []; out = out.concat(d); pages++;
    if (d.length < 1000 || !canRange) break;
    if (pages >= cap){ partial = true; break; }
    off += 1000;
  }
  return { rows:out, partial:partial };
}
/* 문제별 «마지막 결과» — 교재는 workbook_problem_id, 학습지는 problem_id (서버판 addRecent 와 같은 열쇠) */
function rw155Key(x){ return x.source === '교재' ? (x.workbook_problem_id ? 'w' + x.workbook_problem_id : '') : (x.problem_id ? 'p' + x.problem_id : ''); }
function rw155T(x){ return Date.parse(x && x.score_datetime || '') || 0; }
function rw155Still(rows, days, wideDays){
  var now = Date.now(), s1 = now - days * 86400000, s2 = now - wideDays * 86400000, last = {}, hadX = {};
  (rows || []).forEach(function(x){
    var k = rw155Key(x); if (!k) return; k = String(x.mf_student_id) + '|' + k;
    if (x.result === 'X' && rw155T(x) >= s1) hadX[k] = 1;
    var o = last[k], a = rw155T(x), b = o ? rw155T(o) : -1;
    if (!o || a > b || (a === b && Number(x.id || 0) >= Number(o.id || 0))) last[k] = x;
  });
  var rec = [], wide = [], fixed = 0;
  Object.keys(last).forEach(function(k){ var x = last[k]; if (x.result !== 'X'){ if (hadX[k]) fixed++; return; } var t = rw155T(x);
    if (t >= s1) rec.push(x); else if (t >= s2) wide.push(x); });
  var byD = function(a, b){ return rw155T(b) - rw155T(a); };
  rec.sort(byD); wide.sort(byD);
  return { rec:rec, wide:wide, fixed:fixed };
}
function rw155Item(x){
  var bk = x.source === '교재';
  return { wpId:bk ? Number(x.workbook_problem_id) : null, bid:bk ? String(x.book_id) : '', page:bk ? x.page : '학습지', no:(x.number != null ? x.number : ''),
    cid:Number(x.concept_id), lv:Number(x.level) || 3, date:String(x.score_datetime || '').slice(0, 10), at:rw155T(x), pid:bk ? null : Number(x.problem_id),
    recent:true, src:bk ? '교재' : '학습지', title:String(x.worksheet_title || ''), book:bk ? '' : String(x.worksheet_title || '') };
}
/* 교재 문제 → 문제은행 번호 (mf_textbook_<교재> 은행 · 메모리에 둔다) */
async function rw155Banks(items){
  var need = {};
  items.forEach(function(w){ if (w.src === '교재' && !w.pid && w.bid) need[w.bid] = 1; });
  var miss = Object.keys(need).filter(function(b){ return RCWS.cache['bank_' + b] === undefined; });
  if (miss.length){
    var st = await rcwsStore(miss.map(function(b){ return 'mf_textbook_' + b; }));
    miss.forEach(function(b){ var bank = st['mf_textbook_' + b], byWp = null;
      if (bank && bank.problems){ byWp = {}; bank.problems.forEach(function(p){ byWp[String(p.id)] = p; }); }
      RCWS.cache['bank_' + b] = byWp ? { title:bank.title || '', byWp:byWp } : null; });
  }
  items.forEach(function(w){ if (w.src !== '교재' || w.pid) return; var B = RCWS.cache['bank_' + w.bid]; if (!B) return;
    var p = B.byWp[String(w.wpId)]; if (p) w.pid = rcwsBankId(p); if (!w.book) w.book = B.title; });
}

/* ── 재료: «아직 틀린 문제» 더하기 ── */
async function rw155AddRecent(M, row, opt){
  var R = rw155Cfg(rcwsRule(), opt);
  M.recentWide = []; M.recentInfo = null;
  if (!R.ruleRecentOn || M.sid == null) return;
  var win = Math.max(R.days, RW155_WIDE), ck = 'r155_' + M.sid + '_' + win, got = RCWS.cache[ck];
  if (!got){ got = await rw155Read([M.sid], new Date(Date.now() - win * 86400000).toISOString(), 10); RCWS.cache[ck] = got; }
  await rw155Names();
  var S = rw155Still(got.rows, R.days, win);
  var testP = {}, byWp = {}, byP = {}, range = {};
  M.wrong.forEach(function(w){ if (w.pid) testP[w.pid] = 1; });
  M.bookWrong.forEach(function(w){ if (w.wpId) byWp[w.wpId] = w; if (w.pid) byP[w.pid] = w; });
  (M.range || []).forEach(function(c){ range[c] = 1; });
  var add = [], up = 0;
  S.rec.forEach(function(x){
    var w = rw155Item(x), o = (w.src === '교재') ? byWp[w.wpId] : byP[w.pid];
    if (w.src === '학습지' && testP[w.pid]) return;                         // 이번 테스트 오답 그 문제 — 쌍둥이로 이미 들어감(유형마다 1개 고르기 전에 뺀다)
    if (o){ if (!o.recent){ o.recent = true; o.rbase = o.unit ? 'unit' : 'book'; o.at = w.at; o.out = !range[o.cid]; up++; } return; }   // 범위 안 교재·단원 오답과 같은 문제 — 한 번만
    w.out = !range[w.cid]; add.push(w);
  });
  var wide = [];
  S.wide.forEach(function(x){ var w = rw155Item(x); if ((w.src === '학습지' && testP[w.pid]) || (w.src === '교재' ? byWp[w.wpId] : byP[w.pid])) return; w.wide = true; w.out = !range[w.cid]; wide.push(w); });
  await rw155Banks(add.concat(wide));
  add.forEach(function(w){ M.bookWrong.push(w); if (w.pid) M.solved[String(w.pid)] = 1; });
  wide.forEach(function(w){ if (w.pid) M.solved[String(w.pid)] = 1; });
  M.recentWide = wide;
  M.recentInfo = rw155Info(M.bookWrong.filter(function(w){ return w.recent; }), R);
  M.recentInfo.up = up; M.recentInfo.partial = !!got.partial; M.recentInfo.wideN = wide.length; M.recentInfo.fixed = S.fixed;
}
/* 교재·학습지별 · 중단원별 개수 */
function rw155Info(list, R){
  var bySrc = {}, byMid = {}, out = 0, types = {};
  list.forEach(function(w){
    var s = w.src === '학습지' ? ('학습지 ' + (w.title || '')) : (w.book || w.title || ('교재 ' + w.bid));
    s = s.length > 18 ? s.slice(0, 18) + '…' : s;
    bySrc[s] = (bySrc[s] || 0) + 1;
    var m = rw155Mid(w.cid) || '기타'; byMid[m] = (byMid[m] || 0) + 1;
    if (w.out) out++; types[w.cid] = 1;
  });
  var srt = function(o){ return Object.keys(o).map(function(k){ return [k, o[k]]; }).sort(function(a, b){ return b[1] - a[1]; }); };
  return { n:list.length, types:Object.keys(types).length, out:out, bySrc:srt(bySrc), byMid:srt(byMid), days:R.days };
}
var _rw155Gather123 = rcws3Gather;
rcws3Gather = async function(row, opt){
  RW155.curOpt = opt || null;
  var M;
  try { M = await _rw155Gather123(row, opt); } finally { RW155.curOpt = null; }
  try { await rw155TbAuto(M); } catch(e){}
  try { await rw155AddRecent(M, row, opt || {}); }
  catch(e){ M.recentWide = []; M.recentInfo = null; M.warn.push('최근 «아직 틀린 문제»를 읽지 못했습니다: ' + (e.message || e)); }
  return M;
};
/* 교과서 은행 문항도 매쓰플랫 자동채점(p.autoScoredType || p.auto)만 — 둘 다 없으면 뺀다 (모자라면 만들 때 같은 유형으로) */
async function rw155TbAuto(M){
  if (!M || !M.tb || !M.tb.bid) return;
  var ck = 'tbank_' + M.tb.bid, A = RCWS.cache[ck];
  if (A === undefined){ var st = await rcwsStore(['mf_textbook_' + M.tb.bid]), bank = st['mf_textbook_' + M.tb.bid]; A = null;
    if (bank && bank.problems){ A = {}; bank.problems.forEach(function(p){ var id = rcwsBankId(p); if (id) A[id] = p.autoScoredType || p.auto || ''; }); }
    RCWS.cache[ck] = A; }
  if (!A) return;
  var by = {}, drop = 0;
  Object.keys(M.tb.byCid || {}).forEach(function(c){ by[c] = (M.tb.byCid[c] || []).filter(function(q){ var a = A[q.id]; if (rw155AutoOk(a)){ q.autoScoredType = a; return true; } drop++; return false; }); });
  M.tb = Object.assign({}, M.tb, { byCid:by, autoDrop:drop });
}
/* 자동 단원 오답 — 꺼진 학생은 읽지 않는다(매쓰플랫 유형칩 호출도 없음). 팝업의 «단원 오답 넣기»로 켜면 다시 모은다 */
var _rw155Units123 = rcws3AddUnits;
rcws3AddUnits = async function(M, units){
  var o = RW155.curOpt;
  if (o && o.unit === false){ M.unitInfo = (units || []).map(function(u){ return { n:u.n, rate:u.rate, cids:0, wrong:0, how:'꺼짐 — «단원 오답 넣기»로 켜기' }; }); return; }
  return _rw155Units123.apply(this, arguments);
};
var _rw155Tog123 = window.rcws3Toggle;
window.rcws3Toggle = rcws3Toggle = function(k){
  var r = _rw155Tog123.apply(this, arguments);
  if (k === 'unit') return Promise.resolve(r).then(function(){ return rcws3Refresh(true); });
  return r;
};
/* 학생별 단추 반영: 최근 오답은 «학생별 끄기»만 본다 (교재 오답 빼기와 상관없음) */
var _rw155View123 = rcws3View;
rcws3View = function(raw, opt){
  var v = _rw155View123(raw, opt); opt = opt || {};
  var on = rw155Cfg(rcwsRule(), opt).recentOn, out = [];
  raw.bookWrong.forEach(function(w){
    if (w.recent && on){ out.push(w); return; }
    if (w.recent && !w.rbase) return;                                       // 최근 오답으로만 들어온 문제
    var keep = w.unit ? (opt.unit !== false) : !opt.noBook;
    if (keep) out.push(w.recent ? Object.assign({}, w, { recent:false }) : w);
  });
  v.bookWrong = out;
  v.recentWide = on ? (raw.recentWide || []) : [];
  v.recentInfo = raw.recentInfo || null;
  return v;
};

/* ── 학생별 선택 (그 주에만 — rcws3SaveOpt 와 같은 자리) ── */
var _rw155Opt123 = rcws3Opt;
rcws3Opt = function(row){
  var o = _rw155Opt123(row), p = (rcwsRule().per || {})[row.stKey], R = rw155Cfg(rcwsRule(), {});
  if (!p || p.wk !== rcWeekKey()) p = null;
  o.recent = !(p && p.recent === false);
  o.recentDays = (p && p.recentDays) ? rw155Clamp(p.recentDays) : null;
  o.hardest = (p && p.hardest != null) ? !!p.hardest : null;
  o.max = (p && p.max != null && p.max !== '') ? Number(p.max) : null;
  o.min = (p && p.min != null && p.min !== '') ? Number(p.min) : null;
  if (p && p.unitOn === true) o.unit = true;
  else if (!R.unitAuto) o.unit = false;                                      // 규칙에서 꺼짐 → 학생별로 켠 경우만
  return o;
};
var _rw155SaveOpt123 = rcws3SaveOpt;
rcws3SaveOpt = function(stKey, o){
  var keep = rcwsSaveRule, before = rcwsRule().per || {};
  rcwsSaveRule = function(r){
    if (r && r.per) Object.keys(before).forEach(function(k){ var sj = before[k] && before[k].subject; if (!sj) return;   /* 고등 과목은 주가 바뀌어도 남긴다 */
      if (r.per[k]){ if (!r.per[k].subject) r.per[k].subject = sj; } else r.per[k] = { subject:sj }; });
    if (o && r && r.per && r.per[stKey]){ var e = r.per[stKey];
      if (!o.custom) delete e.wids;                                          // 시험을 직접 고르지 않았으면 고정하지 않는다(새 주간테스트가 들어오면 그것으로)
      if (o.recent === false) e.recent = false;
      if (o.recentDays) e.recentDays = rw155Clamp(o.recentDays);
      if (o.hardest != null) e.hardest = !!o.hardest;
      if (o.max != null) e.max = Number(o.max);
      if (o.min != null) e.min = Number(o.min);
      e.unitOn = o.unit === true; }
    return keep(r);
  };
  try { return _rw155SaveOpt123(stKey, o); } finally { rcwsSaveRule = keep; }
};

/* ── 계획: 최근 오답 1개씩 · 빼는 유형 · 유형마다 1개 · 하한 · 상한 · 최상 ── */
function rw155Rank(x){ return (x.w.recent || x.wide) ? 0 : (x.w.unit ? 1 : 2); }
function rw155BookOrd(a, b){ var ra = rw155Rank(a), rb = rw155Rank(b); return (ra - rb) || (ra === 0 ? ((b.w.at || 0) - (a.w.at || 0)) || String(b.w.date || '').localeCompare(String(a.w.date || '')) : 0) || (a.i - b.i); }
function rw155ApplyPlan(p, M, opt){
  var R = rw155Cfg(p.rule, opt), info = { R:R, ex:{}, exN:0, grp:0, wide:0, fill:0, cut:null, cutN:0, extra:[] };
  p.r155 = info; p.rule.hardest = R.hardest;
  // ⓪ 최근 오답은 문제마다 쌍둥이 1개 (범위 안 교재 오답 칸과 따로)
  p.book.forEach(function(x){ if (x.w.recent) x.n = 1; });
  // ① 빼는 유형
  if (R.ex){
    var chk = function(c){ if (info.ex[c] === undefined) info.ex[c] = rw155IsEx(c, R.ex); return info.ex[c]; };
    ['test', 'tb', 'book'].forEach(function(k){ p[k].forEach(function(x){ if (chk(x.w.cid)){ if (k !== 'tb') info.exN++; x.n = 0; x.ex = true; } }); });
    p.boost.forEach(function(b){ if (chk(b.cid)){ b.n = 0; b.ex = true; } });
    Object.keys(info.ex).forEach(function(c){ if (!info.ex[c]) delete info.ex[c]; });
  }
  // ② 유형마다 1개 — 그 유형에서 가장 최근 틀린 문제(최근 오답 → 단원 오답 → 교재 오답 순)
  if (R.perType){
    var seen = {};
    p.book.filter(function(x){ return x.n > 0; }).sort(rw155BookOrd).forEach(function(x){
      var c = x.w.cid; if (seen[c]){ x.n = 0; x.grp = true; info.grp++; } else seen[c] = 1; });
  }
  var tot = function(){ return rcwsPlanTotals(p).total; };
  // ③ 하한 — 최근 오답 기간을 56일로 넓혀 → 그래도 모자라면 테스트·최근 오답 유형의 같은 유형(보강으로 셈)
  if (R.min > 0 && tot() < R.min){
    var per = {};
    p.book.forEach(function(x){ if (x.n > 0) per[x.w.cid] = (per[x.w.cid] || 0) + 1; });
    var wides = (R.recentOn && M.recentWide) || [];
    for (var i = 0; i < wides.length && tot() < R.min; i++){
      var w = wides[i]; if (rw155IsEx(w.cid, R.ex)) continue; if (R.perType && per[w.cid]) continue;
      per[w.cid] = (per[w.cid] || 0) + 1; p.book.push({ i:p.book.length, w:w, n:1, wide:true }); info.extra.push(w); info.wide++;
    }
    var need = R.min - tot();
    if (need > 0){
      var cl = [], sc = {};
      var addc = function(c){ if (c == null || isNaN(c) || sc[c] || rw155IsEx(c, R.ex)) return; sc[c] = 1; cl.push(Number(c)); };
      p.test.forEach(function(x){ addc(x.w.cid); });
      p.book.forEach(function(x){ if (x.w.recent || x.wide) addc(x.w.cid); });
      if (!cl.length) p.book.forEach(function(x){ addc(x.w.cid); });
      if (cl.length){ var fills = {};
        for (var j = 0; j < need; j++){ var c = cl[j % cl.length]; fills[c] = (fills[c] || 0) + 1; }
        cl.forEach(function(c){ if (fills[c]) p.boost.push({ cid:c, n:fills[c], times:0, fill:true }); });
        info.fill = need; }
    }
  }
  // ④ 상한 — 우선순위대로 남긴다
  if (R.max > 0 && tot() > R.max){
    var units = [];
    p.test.forEach(function(x, j){ for (var r = 0; r < x.n; r++) units.push({ x:x, pr:r ? 3 : 0, o:j, d:0, k:r ? 'twin2' : 'twin1' }); });
    p.book.forEach(function(x){ var rc = !!(x.w.recent || x.wide); for (var r = 0; r < x.n; r++) units.push({ x:x, pr:rc ? 1 : 5, o:x.i, d:rc ? (x.w.at || Date.parse(x.w.date || '') || 0) : 0, k:rc ? 'recent' : 'book' }); });
    p.tb.forEach(function(x, j){ for (var r = 0; r < x.n; r++) units.push({ x:x, pr:2, o:j, d:0, k:'tb' }); });
    p.boost.forEach(function(b, j){ for (var r = 0; r < b.n; r++) units.push({ x:b, pr:4, o:j, d:0, k:'boost' }); });
    units.sort(function(a, b){ return (a.pr - b.pr) || (b.d - a.d) || (a.o - b.o); });
    var cut = {}, all = [p.test, p.tb, p.book, p.boost];
    units.slice(R.max).forEach(function(u){ cut[u.k] = (cut[u.k] || 0) + 1; });
    all.forEach(function(L){ L.forEach(function(x){ x._k155 = 0; }); });
    units.slice(0, R.max).forEach(function(u){ u.x._k155++; });
    all.forEach(function(L){ L.forEach(function(x){ if (x.n !== x._k155) x.cut = x.n - x._k155; x.n = x._k155; delete x._k155; }); });
    info.cut = cut; info.cutN = units.length - R.max;
  }
  return p;
}
var _rw155Plan123 = rcwsPlan;
rcwsPlan = function(model, rule, opt){
  var p = _rw155Plan123(model, rule, opt);
  try { rw155ApplyPlan(p, model, p.opt || opt || (model && model.opt) || {}); } catch(e){ try { console.error('[리커버리 3판 계획]', e); } catch(_){} }
  return p;
};
var _rw155Totals123 = rcwsPlanTotals;
rcwsPlanTotals = function(plan){
  var t = _rw155Totals123(plan), u = 0, rc = 0, fl = 0;
  plan.book.forEach(function(x){ if (x.w.recent || x.wide) rc += x.n; else if (x.w.unit) u += x.n; });
  plan.boost.forEach(function(b){ if (b.fill) fl += b.n; });
  t.recent = rc; t.unit = u; t.bookOnly = t.book - u - rc; t.fill = fl;
  return t;
};

/* ── 만들기: 최상 빼기 · 하한에서 더한 문제를 재료에 · 빼는 유형은 매쓰플랫 응답에서 걸러 냄 ── */
var _rw155Pick92 = rcwsPickFrom;
rcwsPickFrom = function(list, lv, n, excl, chosen, rule){
  if (rule && rule.hardest === false){ list = (list || []).filter(function(p){ return (Number(p && p.lv) || 3) < 5; }); lv = Math.min(Number(lv) || 3, 4); }
  return _rw155Pick92(list, lv, n, excl, chosen, rule);
};
function rw155Strip(path, d, ex, st){
  st = st || { drop:0, auto:{} };
  var bad = function(pr){ var c = pr && (pr.conceptId != null ? pr.conceptId : pr.cid);
    if (pr && pr.id != null && rw155MfAuto(pr)) st.auto[pr.id] = 1;
    if (pr && !rw155MfAuto(pr)){ st.drop++; return true; }                    // 자동채점 아님 → 뺀다
    return c != null && ex[c]; };
  if (!d || typeof d !== 'object') return d;
  if (/^\/derivation\/problem\//.test(path)){
    var o = Object.assign({}, d);
    ['pairProblemList', 'similarProblemList'].forEach(function(k){ if (Array.isArray(d[k])) o[k] = d[k].filter(function(x){ return !bad(x && (x.problem || x)); }); });
    return o;
  }
  if (path === '/worksheet/problem'){
    if (Array.isArray(d)) return d.filter(function(x){ return !bad(x && (x.problem || x)); });
    if (Array.isArray(d.problemList)) return Object.assign({}, d, { problemList:d.problemList.filter(function(x){ return !bad(x && (x.problem || x)); }) });
  }
  return d;
}
function rw155Api(api, ex, st){
  ex = ex || {}; st = st || { drop:0, auto:{} };
  return { st:st, call:function(m, p, b){
    if (p === '/worksheet/filter/concept' && b) b = Object.assign({}, b, { onlyAutoScorable:true });   // 매쓰플랫 필터부터 자동채점 문항만
    return Promise.resolve(api.call(m, p, b)).then(function(d){ return rw155Strip(p, d, ex, st); }); } };
}
var _rw155Build123 = rcwsBuild;
rcwsBuild = async function(model, plan, api, onLog){
  var I = plan.r155 || { ex:{}, extra:[] }, ex = I.ex || {};
  var notEx = function(w){ return !ex[w.cid]; };
  var M2 = Object.assign({}, model, { wrong:model.wrong.filter(notEx), bookWrong:model.bookWrong.filter(notEx).concat(I.extra || []) });
  var P2 = Object.assign({}, plan, { boost:plan.boost.filter(function(b){ return !ex[b.cid]; }) });
  var API = rw155Api(api, ex);
  ((M2.tb && M2.tb.byCid) ? Object.keys(M2.tb.byCid) : []).forEach(function(c){ (M2.tb.byCid[c] || []).forEach(function(q){ if (rw155MfAuto(q)) API.st.auto[q.id] = 1; }); });
  var res = await _rw155Build123(M2, P2, API, onLog);
  try { var t = rcwsPlanTotals(plan); res.parts = res.parts || {}; res.parts.recent = t.recent; if (t.fill) res.parts.fill = t.fill;
    res.parts.nonAuto = (res.items || []).filter(function(it){ return !API.st.auto[it.id]; }).length; res.parts.autoDrop = API.st.drop; } catch(e){}
  return res;
};

/* ── 설계 팝업: «🕘 최근 오답» 칸 · 학생별 끄기·기간·최상·문항 범위 · 하한 채우기 칸 ── */
function rw155CurOk(){ var C = RCWS_CUR; return !!(C && !C.busy && !C.loading); }
window.rw155Tog = function(){ if (!rw155CurOk()) return; var C = RCWS_CUR; C.opt.recent = (C.opt.recent === false); rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(false); };
window.rw155Days = function(d){
  if (!rw155CurOk()) return; var C = RCWS_CUR, RR = rw155Cfg(C.rule, {});
  d = rw155Clamp(d); C.opt.recentDays = (d === RR.ruleDays) ? null : d;
  rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(true);
};
window.rw155Hard = function(){
  if (!rw155CurOk()) return; var C = RCWS_CUR, R = rw155Cfg(C.rule, C.opt), RR = rw155Cfg(C.rule, {});
  var v = !R.hardest; C.opt.hardest = (v === RR.ruleHardest) ? null : v;
  rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(false);
};
window.rw155Lim = function(k, v){
  if (!rw155CurOk()) return; var C = RCWS_CUR;
  var s = String(v == null ? '' : v).trim();
  var nv = (s === '') ? null : Math.max(0, Math.min(200, Math.round(Number(s)) || 0));
  if (nv === (C.opt[k] == null ? null : C.opt[k])) return;                 // 같은 값 (다시 그릴 때 blur 로 한 번 더 오는 change) — 무시
  C.opt[k] = nv;
  rcws3SaveOpt(C.stKey, C.opt); return rcws3Refresh(false);
};
var _rw155Sum123 = rcws3Summary;
rcws3Summary = function(M, P){
  if (RCWS_CUR && P === RCWS_CUR.plan && (RW155.fullBook || RW155.fullBoost)) P = Object.assign({}, P, { book:RW155.fullBook || P.book, boost:RW155.fullBoost || P.boost });
  var S = _rw155Sum123(M, P), t = rcwsPlanTotals(P);
  S.t = t;
  S.text = S.text.replace(' · 교재 오답 ', ' · 최근 오답 ' + t.recent + ' · 교재 오답 ');
  var I = P.r155;
  if (I){ var lim = [];
    if (!I.R.hardest) lim.push('최상 뺌');
    if (I.R.min || I.R.max) lim.push('문항 ' + (I.R.min || 0) + '~' + (I.R.max || '제한 없음'));
    if (I.cutN) lim.push('상한으로 ' + I.cutN + '문항 뺌');
    if (I.wide || I.fill) lim.push('하한 채움 ' + (I.wide ? '최근 ' + RW155_WIDE + '일 ' + I.wide : '') + (I.wide && I.fill ? ' · ' : '') + (I.fill ? '같은 유형 ' + I.fill : ''));
    if (lim.length) S.text += ' (' + lim.join(' · ') + ')'; }
  return S;
};
function rw155Chips(cur, pre, dis, attr){   /* pre = onclick 앞부분 (예 «rw155Days(») — 뒤에 일수와 «)» 를 붙인다 */
  return RW155_DAYS.map(function(d){ var on = d === cur;
    return '<button type="button" ' + (attr || '') + ' data-rw155-days="' + d + '" onclick="' + pre + d + ')" style="border:1.5px solid ' + (on ? '#c2410c' : '#e2e8f0') + ';background:' + (on ? '#c2410c' : '#fff') + ';color:' + (on ? '#fff' : '#64748b') + ';border-radius:7px;padding:3px 8px;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer"' + (dis || '') + '>' + rw155DaysLabel(d) + '</button>'; }).join('');
}
function rw155PaintPatch(h, C, full, fullBoost){
  var M = C.model, P = C.plan, I = P.r155 || { R:rw155Cfg(P.rule, C.opt), ex:{} }, R = I.R, RR = rw155Cfg(P.rule, {}), O = C.opt || {}, RI = M.recentInfo;
  var rowH = function(no, main, sub, ctl){ return '<div style="display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;padding:7px 11px;border-top:1px solid #f1f5f9;font-size:12px"><span style="font-family:ui-monospace,monospace;font-weight:700;color:#64748b">' + no + '</span><span><b>' + main + '</b><small style="display:block;color:#64748b;font-size:10.5px;font-weight:700">' + sub + '</small></span>' + ctl + '</div>'; };
  var blk = function(title, sub, attr){ return '<div ' + (attr || '') + ' style="border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;margin-bottom:9px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;background:#f1f5f9;flex-wrap:wrap"><b style="font-size:12.5px">' + title + '</b><small style="font-size:11px;color:#64748b;font-weight:700">' + sub + '</small></div>'; };
  var lvTag = function(lv){ return ' <span style="font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;background:' + (lv >= 5 ? '#fee2e2;color:#b91c1c' : '#fef3c7;color:#b45309') + '">' + (RCWS_LV[lv] || '') + '</span>'; };
  // ① 학생별: 최근 오답 끄기 · 기간 칩 · 최상 · 문항 범위 (구성 한 줄 바로 위)
  var on = R.recentOn, dis = (C.loading || C.busy) ? ' disabled' : '';
  var btn = function(attr, onc, active, label, title, col){ return '<button ' + attr + ' onclick="' + onc + '" title="' + esc2(title) + '" style="border:1.5px solid ' + (active ? col : '#e2e8f0') + ';background:' + (active ? '#fff7ed' : '#fff') + ';color:' + (active ? col : '#64748b') + ';border-radius:8px;padding:5px 10px;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer"' + dis + '>' + (active ? '✓ ' : '') + label + '</button>'; };
  var ctl = '<div data-rw155-ctl style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:11.5px;font-weight:800;color:#475569">'
    + (R.ruleRecentOn ? btn('data-rcws-tg="recent"', 'rw155Tog()', on, '🕘 최근 오답 넣기', '최근 «아직 틀린 문제»(테스트 범위와 상관없이) — 이 학생만 끄기', '#c2410c')
        + (on ? '<span style="display:inline-flex;gap:3px;align-items:center">' + rw155Chips(R.days, 'rw155Days(', dis) + (O.recentDays ? '<small style="color:#c2410c">이 학생만</small>' : '') + '</span>' : '')
      : '<span style="color:#94a3b8">🕘 최근 오답 — 규칙에서 꺼짐(오른쪽 «학습지 규칙»)</span>')
    + btn('data-rw155-hard', 'rw155Hard()', R.hardest, '최상(5단계) 포함', '끄면 쌍둥이·같은 유형을 고를 때 최상 문제를 빼고 상(4단계)까지', '#b91c1c')
    + (R.autoMax && !O.max ? '<span data-rw155-automax style="color:#b91c1c">· 기간 2주 이상 → 상한 ' + RW155_AUTOMAX + ' 자동</span>' : '')
    + '<label>문항 <input id="rw155-min" type="number" min="0" max="200" value="' + (O.min != null ? O.min : '') + '" placeholder="' + (RR.min || '없음') + '" onchange="rw155Lim(\'min\',this.value)" style="width:46px;font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px"' + dis + '>~<input id="rw155-max" type="number" min="0" max="200" value="' + (O.max != null ? O.max : '') + '" placeholder="' + (RR.max || '없음') + '" onchange="rw155Lim(\'max\',this.value)" style="width:46px;font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid #e2e8f0;border-radius:7px;padding:3px 5px"' + dis + '> <small style="color:#94a3b8">(이 학생만 · 비우면 규칙)</small></label>'
    + (R.perType ? '<span style="color:#64748b">· 유형마다 1개</span>' : '')
    + (R.exSrc ? '<span style="color:#b91c1c">· 빼는 유형 «' + esc2(R.exSrc) + '»' + (I.exN ? ' ' + I.exN + '문항 뺌' : '') + '</span>' : '')
    + '</div>';
  var k = h.indexOf('<div data-rcws-sum'); if (k >= 0) h = h.slice(0, k) + ctl + h.slice(k);
  // ② 상한·하한 안내
  var notes = '';
  if (I.cutN){ var nm = { twin1:'쌍둥이 첫째', recent:'최근 오답', tb:'교과서', twin2:'쌍둥이 둘째', boost:'보강', book:'교재·단원 오답' };
    notes += '<div data-rw155-cut style="background:#fef2f2;color:#991b1b;border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:800;margin-bottom:8px">✂ 상한 ' + R.max + '문항 — ' + I.cutN + '문항 뺐습니다 (' + Object.keys(I.cut).map(function(x){ return (nm[x] || x) + ' ' + I.cut[x]; }).join(' · ') + ') · 남기는 순서: 쌍둥이 첫째 → 최근 오답 → 교과서 → 쌍둥이 둘째 → 보강 → 교재 오답</div>'; }
  if (I.wide || I.fill) notes += '<div data-rw155-fill style="background:#f0fdf4;color:#166534;border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:800;margin-bottom:8px">➕ 하한 ' + R.min + '문항 — ' + (I.wide ? '최근 오답 기간을 ' + RW155_WIDE + '일로 넓혀 ' + I.wide + '문항' : '') + (I.wide && I.fill ? ' · ' : '') + (I.fill ? '테스트·최근 오답 유형의 같은 유형 ' + I.fill + '문항(보강)' : '') + ' 더했습니다</div>';
  if (notes){ var k2 = h.indexOf('<div data-rcws-sum'); if (k2 >= 0){ var e2 = h.indexOf('</div>', k2); if (e2 >= 0) h = h.slice(0, e2 + 6) + notes + h.slice(e2 + 6); } }
  // ③ 🕘 최근 오답 칸
  var rl = full.filter(function(x){ return x.w.recent || x.wide; });
  rl.sort(function(a, b){ return (a.wide ? 1 : 0) - (b.wide ? 1 : 0) || (b.w.at || 0) - (a.w.at || 0) || a.i - b.i; });
  var rb = '';
  if (R.ruleRecentOn){
    var n = RI ? RI.n : 0, sum = rl.reduce(function(a, x){ return a + x.n; }, 0);
    rb += blk('🕘 최근 오답 ' + (on ? n : 0) + '문항' + (on && RI ? ' (' + RI.types + '유형)' : '') + ' → 쌍둥이 ' + (on ? sum : 0), on ? ('최근 ' + rw155DaysLabel(R.days) + ' «아직 틀린 문제» · 다시 풀어 맞힌 문제는 뺌' + (RI && RI.out ? ' · 테스트 범위 밖 ' + RI.out : '')) : '이 학생은 끔', 'data-rw155-recent');
    if (!on) rb += '<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">🕘 최근 오답 넣기를 끈 학생입니다</div>';
    else if (!rl.length && !(RI && RI.n)) rb += '<div style="padding:10px 11px;font-size:12px;color:#94a3b8;font-weight:700">최근 ' + rw155DaysLabel(R.days) + '에 아직 틀린 문제가 없습니다</div>';
    else {
      if (RI){
        rb += '<div data-rw155-src style="padding:6px 11px;border-top:1px solid #f1f5f9;font-size:11.5px;font-weight:800;color:#9a3412">교재·학습지별 ' + RI.bySrc.slice(0, 5).map(function(a){ return esc2(a[0]) + ' ' + a[1]; }).join(' · ') + (RI.bySrc.length > 5 ? ' …' : '') + '</div>';
        rb += '<div data-rw155-mid style="padding:6px 11px;border-top:1px solid #f1f5f9;font-size:11.5px;font-weight:800;color:#9a3412">중단원별 ' + RI.byMid.slice(0, 6).map(function(a){ return esc2(a[0]) + ' ' + a[1]; }).join(' · ') + (RI.byMid.length > 6 ? ' …' : '') + '</div>';
        var gone = []; if (RI.fixed) gone.push('다시 풀어 맞힌 문제 ' + RI.fixed); if (I.exN) gone.push('빼는 유형 «' + esc2(R.exSrc) + '» ' + I.exN); if (I.grp) gone.push('같은 유형의 더 오래된 오답 ' + I.grp);
        if (gone.length) rb += '<div data-rw155-gone style="padding:6px 11px;border-top:1px solid #f1f5f9;font-size:11.5px;font-weight:800;color:#64748b">🚫 뺀 것 ' + gone.join(' · ') + '</div>';
        if (RI.partial) rb += '<div style="padding:6px 11px;font-size:11px;font-weight:800;color:#b45309">⚠ 기록이 많아 일부만 읽었습니다</div>';
      }
      rl.forEach(function(x, j){ var w = x.w, tags = [];
        if (w.out) tags.push('<span style="color:#c2410c">테스트 범위 밖</span>');
        if (x.wide) tags.push('하한 채우기(' + RW155_WIDE + '일)');
        if (w.rbase) tags.push(w.rbase === 'unit' ? '단원 오답과 같은 문제' : '범위 안 교재 오답과 같은 문제');
        if (x.grp) tags.push('같은 유형의 더 최근 문제가 있어 뺌');
        if (x.ex) tags.push('<span style="color:#b91c1c">빼는 유형</span>');
        if (x.cut) tags.push('상한으로 ' + x.cut + ' 뺌');
        var title = (w.src === '학습지' ? '📄 ' + (w.title ? w.title.slice(0, 16) + ' ' : '') + w.no + '번' : (w.book ? w.book.slice(0, 16) + ' ' : '') + 'p.' + w.page + ' ' + w.no + '번');
        rb += rowH(String(j + 1), esc2(title) + lvTag(w.lv), esc2(rw155CName(w.cid) || tqName(w.cid)) + ' · ' + esc2(String(w.date || '').slice(5).replace('-', '.')) + ' 채점' + (w.pid ? '' : ' · 번호 못 찾음 → 같은 유형으로 대체') + (tags.length ? ' · ' + tags.join(' · ') : ''), rcwsSeg('book', x.i, x.n, 2));
      });
    }
    rb += '</div>';
  }
  // ④ 하한 채우기 (같은 유형 · 보강으로 셈)
  var fl = []; (fullBoost || []).forEach(function(b, i){ if (b.fill) fl.push({ b:b, i:i }); });
  if (fl.length){ rb += blk('➕ 하한 채우기 — 같은 유형', '테스트·최근 오답 유형 · 보강으로 셈', 'data-rw155-fillblk');
    fl.forEach(function(f){ rb += rowH('+' + f.b.n, esc2(rw155CName(f.b.cid) || tqName(f.b.cid)), '문항이 하한(' + R.min + ')보다 적어 같은 유형으로 채움' + (f.b.cut ? ' · 상한으로 ' + f.b.cut + ' 뺌' : ''), rcwsSeg('boost', f.i, f.b.n, Math.max(3, f.b.n))); });
    rb += '</div>'; }
  if (rb){
    var g = h.indexOf('<div style="display:grid;grid-template-columns:repeat(6,1fr)');
    var b4 = h.indexOf('<b style="font-size:12.5px">④ 보강');
    var at = b4 >= 0 ? h.lastIndexOf('<div style="border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;margin-bottom:9px">', b4) : g;
    if (at < 0) at = g;
    if (at >= 0) h = h.slice(0, at) + rb + h.slice(at);
  }
  // ⑤-0 자동채점: 끄는 칸 숨김(항상 매쓰플랫 기준) · 결과에 «자동채점 아님 n»
  h = h.replace(/<label title="서술형을 빼고[^"]*"><input type="checkbox" id="rcws-auto"[^>]*> 자동채점 문항만<\/label>/, '<span data-rw155-auto style="color:#15803d">✓ 자동채점 문항만(매쓰플랫 기준 · 항상)</span><input type="checkbox" id="rcws-auto" checked disabled style="display:none">');
  if (C.result && C.result.parts && C.result.parts.nonAuto != null) h = h.replace(' — 매쓰플랫 → 학습지 → 내학습지에서 인쇄', ' · <span data-rw155-nonauto>자동채점 아님 ' + C.result.parts.nonAuto + '</span>' + (C.result.parts.autoDrop ? ' (후보 중 자동채점 아님 ' + C.result.parts.autoDrop + ' 뺌)' : '') + ' — 매쓰플랫 → 학습지 → 내학습지에서 인쇄');
  // ⑤ 합계 칸에 «최근 오답»
  var gi = h.indexOf('<div style="display:grid;grid-template-columns:repeat(6,1fr)');
  if (gi >= 0){
    h = h.slice(0, gi) + h.slice(gi).replace('repeat(6,1fr)', 'repeat(7,1fr)');
    var ci = h.indexOf('<div data-rcws-tot="교재 오답"');
    var cs = ci >= 0 ? h.lastIndexOf('<div style="border:1px solid #e2e8f0;border-radius:9px;padding:6px 4px;text-align:center">', ci) : -1;
    if (cs >= 0){ var tt = rcwsPlanTotals(Object.assign({}, P, { book:full, boost:fullBoost || P.boost }));
      h = h.slice(0, cs) + '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:6px 4px;text-align:center"><div data-rcws-tot="최근 오답" style="font-size:18px;font-weight:900;color:#c2410c">' + tt.recent + '</div><div style="font-size:10px;color:#64748b;font-weight:800">최근 오답</div></div>' + h.slice(cs); }
  }
  return h;
}
var _rw155Paint123 = rcwsPaint;
rcwsPaint = function(){
  var C = RCWS_CUR;
  if (!C || !C.plan || !C.model || !document.getElementById('rc-pop')) return _rw155Paint123.apply(this, arguments);
  var full = C.plan.book, fullBoost = C.plan.boost, keepShow = rcPopShow;
  RW155.fullBook = full; RW155.fullBoost = fullBoost;
  C.plan.book = full.filter(function(x){ return !(x.w.recent || x.wide); });
  C.plan.boost = fullBoost.filter(function(b){ return !b.fill; });   // 하한 채우기는 맨 뒤에 붙으므로 앞의 번호는 그대로
  rcPopShow = function(h){ var out = h; try { out = rw155PaintPatch(h, C, full, fullBoost); } catch(e){ try { console.error('[리커버리 3판 팝업]', e); } catch(_){} } return keepShow(out); };
  try { return _rw155Paint123.apply(this, arguments); }
  finally { C.plan.book = full; C.plan.boost = fullBoost; rcPopShow = keepShow; RW155.fullBook = null; RW155.fullBoost = null; }
};

/* ── 「확정 전원 생성」 확인 글에 새 규칙 한 줄 ── */
var _rw155All123 = rcMakeWsAll;
rcMakeWsAll = function(){
  var keep = window.confirm, R = rw155Cfg(rcwsRule(), {});
  window.confirm = function(m){ window.confirm = keep;
    var line = '\n · 아직 틀린 문제: ' + (R.ruleRecentOn ? '최근 ' + rw155DaysLabel(R.days) : '끔') + ' · 유형마다 1개: ' + (R.perType ? '켬' : '끔') + ' · 최상(5단계): ' + (R.hardest ? '포함' : '뺌') + ' · 문항 ' + (R.min || (R.max && !R.autoMax) ? (R.min || 0) + '~' + (R.max || '제한 없음') : '제한 없음(기간 2주 이상인 학생만 상한 ' + RW155_AUTOMAX + ')') + (R.exSrc ? ' · 빼는 유형 «' + R.exSrc + '»' : '') + ' (학생별 기간·끄기·최상·문항 범위는 그대로)';
    return keep.call(window, String(m).replace('\n매쓰플랫에 즉시', line + '\n매쓰플랫에 즉시')); };
  try { return _rw155All123.apply(this, arguments); } finally { window.confirm = keep; }
};
window.rcMakeWsAll = rcMakeWsAll;

/* ── 오른쪽 도구 «학습지 규칙»: 칸 더하기 ── */
window.rw155Rule = function(k, v){
  if (!RCWS.loaded) return;
  var r = rcwsRule(); delete r.updated;
  var rc = Object.assign({}, r.recent);
  if (k === 'recentOn') rc.on = !!v;
  else if (k === 'days') rc.days = rw155Clamp(v);
  else if (k === 'perType' || k === 'hardest' || k === 'unitAuto') r[k] = !!v;
  else if (k === 'min' || k === 'max'){
    var s = String(v == null ? '' : v).trim(), n = s === '' ? 0 : Math.round(Number(s)); if (!(n >= 0)) n = 0; n = Math.min(200, n); r[k] = n;
    var mx = Number(r.max) || 0, mn = Number(r.min) || 0;
    if (k === 'min' && mx > 0 && n > mx) r.max = n;
    if (k === 'max' && n > 0 && mn > n) r.min = n;
  } else if (k === 'exclude'){
    var x = String(v == null ? '' : v).trim();
    if (x){ try { new RegExp(x); } catch(e){ plToast('빼는 유형 글자를 알아볼 수 없어요 — ' + e.message); render(); return; } }
    r.exclude = x;
  }
  r.recent = rc;
  var p = rcwsSaveRule(r); render(); return p;
};
if (typeof l3rRuleBox === 'function'){
  var _rw155RuleBox123 = l3rRuleBox;
  l3rRuleBox = function(){
    var h = _rw155RuleBox123.apply(this, arguments); if (!RCWS.loaded) return h;
    var R = rw155Cfg(rcwsRule(), {}), r = rcwsRule();
    var ninp = function(id, k, val){ return '<input type="number" id="' + id + '" min="0" max="200" value="' + (val ? l3bQ(val) : '') + '" placeholder="없음" onchange="rw155Rule(\'' + k + '\',this.value)" style="width:48px">'; };
    var add = '<label class="l3r-ck" data-l3r-rule="recent" title="테스트 범위와 상관없이 최근 기간에 «다시 풀어도 아직 틀린» 문제(교재·학습지)를 재료에 넣습니다"><input type="checkbox" id="l3r-recent"' + (R.ruleRecentOn ? ' checked' : '') + ' onchange="rw155Rule(\'recentOn\',this.checked)"><span>아직 틀린 문제</span></label>'
      + (R.ruleRecentOn ? '<span data-l3r-rule="rdays" style="display:flex;gap:4px;align-items:center;padding-left:22px">' + rw155Chips(R.ruleDays, 'rw155RuleDays(', '', 'class="l3r-rday"') + '</span>' : '')
      + '<label class="l3r-ck" data-l3r-rule="perType" title="최근 오답·교재 오답은 유형마다 그 유형에서 가장 최근 틀린 문제 1개 (테스트 오답 쌍둥이는 묶지 않음)"><input type="checkbox" id="l3r-pertype"' + (R.perType ? ' checked' : '') + ' onchange="rw155Rule(\'perType\',this.checked)"><span>유형마다 1개</span></label>'
      + '<label class="l3r-ck" data-l3r-rule="hardest" title="끄면 쌍둥이·같은 유형을 고를 때 최상 문제를 빼고 상(4단계)까지"><input type="checkbox" id="l3r-hardest"' + (R.ruleHardest ? ' checked' : '') + ' onchange="rw155Rule(\'hardest\',this.checked)"><span>최상(5단계) 난이도 포함</span></label>'
      + '<label class="l3r-ck" data-l3r-rule="unitAuto" title="단원 정답률로 불린 학생은 그 단원의 최근 교재 오답을 더합니다"><input type="checkbox" id="l3r-unitauto"' + (R.unitAuto ? ' checked' : '') + ' onchange="rw155Rule(\'unitAuto\',this.checked)"><span>자동 단원 오답</span></label>'
      + '<label class="l3b-num" data-l3r-rule="minmax" title="학생 한 명 문항 수 (비우면 없음) — 넘으면 우선순위대로 남기고, 모자라면 최근 오답 기간을 56일로 넓히고 같은 유형으로 채웁니다">문항<span style="display:flex;align-items:center;gap:3px">' + ninp('l3r-min', 'min', Number(r.min) || 0) + '~' + ninp('l3r-max', 'max', Number(r.max) || 0) + '</span></label>'
      + '<label class="l3b-num" data-l3r-rule="exclude" title="이 유형 이름이 들어간 문제는 모든 재료와 쌍둥이에서 뺍니다 (여러 개는 농도|속력)">빼는 유형<input type="text" id="l3r-excl" placeholder="예: 농도" value="' + l3bQ(R.exSrc) + '" onchange="rw155Rule(\'exclude\',this.value)" style="width:110px"></label>';
    h = h.replace(/<label class="l3r-ck" data-l3r-rule="auto"[\s\S]*?<\/label>/, '<span class="l3r-ck" data-l3r-rule="auto" title="매쓰플랫이 자동채점할 수 있는 문항만(autoScoredType ≠ IMPOSSIBLE) — 원장 결정으로 항상 켜짐" style="color:#15803d">✓ 자동채점 문항만 (매쓰플랫 기준 · 항상)</span>');
    var k = h.indexOf('<span class="l3-sub">「확정 전원'); h = k >= 0 ? h.slice(0, k) + add + h.slice(k) : h;
    return h.replace('<span class="l3-sub">「확정 전원 생성」과 학생별 설계 팝업이 이 규칙으로 시작합니다.</span>', '<span class="l3-sub">「확정 전원 생성」과 학생별 설계 팝업이 이 규칙으로 시작합니다. 규칙을 바꾸면 가운데 «🔢 학생별 예상»이 바로 다시 계산됩니다(매쓰플랫에는 «생성»을 눌러야 만들어집니다).</span>');
  };
}
window.rw155RuleDays = function(d){ return rw155Rule('days', d); };


/* ═══ 고등부 — 같은 규칙 · 과목 = per[학생키].subject 또는 가장 최근 HIGH_TEST 제목의 [과목] (서버판 --high 와 같은 뜻) ═══ */
var RW155_SUBJ = ['공통수학1', '공통수학2', '대수', '미적분1', '확률과 통계', '미적분2', '기하'];
function rw155SubjNorm(s){
  var k = String(s || '').replace(/\s/g, '').replace(/Ⅱ/g, '2').replace(/Ⅰ/g, '1').replace(/^(공통수학|미적분)II$/, '$12').replace(/^(공통수학|미적분)I$/, '$11');
  if (k === '확률과통계') return '확률과 통계';
  return RW155_SUBJ.indexOf(k) >= 0 ? k : '';
}
function rw155TitleSubj(title){ var m = String(title || '').match(/\[([^\]]+)\]/); return m ? rw155SubjNorm(m[1]) : ''; }
function rw155IsHigh(st){ var m = String((st && st.grade) || '').match(/(초|중|고)[^0-9]*(\d)/); return !!(m && m[1] === '고'); }
function rw155Subject(st){
  if (!st) return null;
  var k = String(st.id || st.name), p = ((RCWS.rule && RCWS.rule.per) || {})[k];
  if (p && p.subject && rw155SubjNorm(p.subject)) return { subj:rw155SubjNorm(p.subject), how:'manual' };
  var sid = null; try { sid = bpSidOf(st); } catch(e){}
  if (sid == null) return null;
  var mine = [];
  ((typeof WK !== 'undefined' && WK.tests) || []).forEach(function(t){
    if (t.type !== 'HIGH_TEST' && t.type !== 'CHAPTER' && t.type !== 'WEEKLY') return;
    var me = (t.students || []).find(function(s){ return String(s.sid) === String(sid); }); if (!me) return;
    var sj = rw155TitleSubj(t.title); if (sj) mine.push({ d:String(me.date || t.date || ''), sj:sj, title:t.title });
  });
  mine.sort(function(a, b){ return b.d.localeCompare(a.d); });
  return mine.length ? { subj:mine[0].sj, how:'auto', title:mine[0].title } : null;
}
var _rw155School = rcWsSchool;
rcWsSchool = function(st){
  var r = _rw155School.apply(this, arguments); if (r || !rw155IsHigh(st)) return r;
  var S = rw155Subject(st); return S ? { schoolType:'HIGH', grade:S.subj, how:S.how } : null;
};
window.rw155SetSubject = function(stKey, v){
  if (!RCWS.loaded) return;
  var r = rcwsRule(); delete r.updated; r.per = Object.assign({}, r.per || {});
  var e = Object.assign({}, r.per[stKey] || {}), sj = rw155SubjNorm(v);
  if (sj) e.subject = sj; else delete e.subject;
  if (Object.keys(e).length) r.per[stKey] = e; else delete r.per[stKey];
  var p = rcwsSaveRule(r); render(); return p;
};
function rw155SubjPick(x){
  var S = rw155Subject(x.st), k = String(x.stKey).replace(/'/g, '');
  var opts = '<option value="">' + (S ? '과목 자동' : '과목 고르기') + '</option>' + RW155_SUBJ.map(function(sj){ return '<option value="' + esc2(sj) + '"' + (S && S.how === 'manual' && S.subj === sj ? ' selected' : '') + '>' + esc2(sj) + '</option>'; }).join('');
  return '<span data-rw155-subj="' + esc2(String(x.stKey)) + '" style="display:inline-flex;gap:5px;align-items:center;font-size:11.5px;font-weight:800;color:' + (S ? '#475569' : '#b45309') + '">'
    + (S ? '📘 ' + esc2(S.subj) + (S.how === 'auto' ? ' <small style="color:#94a3b8">(최근 시험 제목에서)</small>' : '') : '📘 고등 과목을 골라 주세요')
    + '<select onchange="rw155SetSubject(\'' + k + '\',this.value)" style="font-family:inherit;font-size:11.5px;font-weight:800;border:1.5px solid ' + (S ? '#e2e8f0' : '#f59e0b') + ';border-radius:7px;padding:3px 5px">' + opts + '</select></span>';
}

/* ═══ 보드·예상 자료 — 후보 학생 전부를 한 번에 (매쓰플랫 호출 없음) ═══ */
function rw155Rows(){ try { return rcRows(); } catch(e){ return []; } }
function rw155Win(rows){
  var w = 28, now = Date.now();
  rows.forEach(function(row){
    try { var o = rcws3Opt(row), R = rw155Cfg(rcwsRule(), o); if (R.days > w) w = R.days;
      rcws3Mine(row).forEach(function(t){ if (o.wids.indexOf(String(t.wid)) >= 0){ var a = Math.ceil((now - (Date.parse(String(t.date || '').slice(0, 10)) || now)) / 86400000) + 2; if (a > w) w = a; } }); } catch(e){}
  });
  return Math.min(120, w);
}
function rw155Kick(rows){
  rows = rows || rw155Rows();
  var sids = [];
  rows.forEach(function(x){ if (x && x.sid != null && sids.indexOf(String(x.sid)) < 0) sids.push(String(x.sid)); });
  if (!sids.length) return;
  sids.sort();
  var win = rw155Win(rows), B = RW155.bd, sk = sids.join(',');
  if (B.key && B.win >= win && B.sidKey === sk) return;                   // 이미 넉넉히 읽음 — 규칙을 바꿔도 다시 읽지 않고 센다
  var key = win + '|' + sk;
  if (B.loading === key) return;
  B.loading = key;
  Promise.all([rw155Names(), rw155Read(sids, new Date(Date.now() - win * 86400000).toISOString(), 30)]).then(function(a){
    if (B.loading !== key) return;
    var by = {}; a[1].rows.forEach(function(x){ var s = String(x.mf_student_id); (by[s] = by[s] || []).push(x); });
    B.bySid = by; B.partial = a[1].partial; B.key = key; B.win = win; B.sidKey = sk; B.loading = ''; B.err = '';
    try { if (VIEW === 'recovery') render(); } catch(e){}
  }, function(e){
    if (B.loading !== key) return;
    B.bySid = {}; B.key = key; B.win = win; B.sidKey = sk; B.loading = ''; B.err = (e && e.message) || String(e);
    try { if (VIEW === 'recovery') render(); } catch(_){}
  });
}
/* 한 학생: 고른 시험의 오답(가장 최근 응시) · 범위 · 최근 «아직 틀린» 문제 (테스트 문제 먼저 뺌) */
function rw155Stu(row, rule){
  rule = rule || rcwsRule();
  var rs = RW155.bd.bySid[String(row.sid)] || [], o = {}, wids = [];
  try { o = rcws3Opt(row); wids = (o.wids || []).map(String); } catch(e){}
  if (!wids.length && row.testHit && row.testHit.wid != null) wids = [String(row.testHit.wid)];
  var R = rw155Cfg(rule, o), byW = {}, range = {}, hasR = false, testP = {}, wrong = [], seenP = {};
  rs.forEach(function(x){ if (x.source === '학습지' && wids.indexOf(String(x.worksheet_id)) >= 0){ var w = String(x.worksheet_id), sw = String(x.student_worksheet_id || '0');
    var a = byW[w] = byW[w] || {}; (a[sw] = a[sw] || []).push(x); } });
  Object.keys(byW).forEach(function(w){ var a = byW[w], best = null, bt = -1;
    Object.keys(a).forEach(function(sw){ var t = Math.max.apply(null, a[sw].map(rw155T)); if (t > bt){ bt = t; best = sw; } });
    a[best].forEach(function(x){ if (x.concept_id != null){ range[Number(x.concept_id)] = 1; hasR = true; } if (x.problem_id) testP[Number(x.problem_id)] = 1;
      if (x.result === 'X'){ var pid = Number(x.problem_id) || null; if (pid && seenP[pid]) return; if (pid) seenP[pid] = 1; wrong.push({ pid:pid, cid:Number(x.concept_id), lv:Number(x.level) || 3 }); } }); });
  if (!hasR && row.testHit && Array.isArray(row.testHit.wrong)) row.testHit.wrong.forEach(function(w){ if (w && w.id != null){ range[Number(w.id)] = 1; hasR = true; } });
  var still = rw155Still(rs, R.days, R.days).rec.filter(function(x){ return !(x.source === '학습지' && (testP[Number(x.problem_id)] || wids.indexOf(String(x.worksheet_id)) >= 0)); });
  return { o:o, R:R, wids:wids, wrong:wrong, range:range, hasR:hasR, still:still, rs:rs };
}
/* 보드 줄 (한 학생) — 유형 수로 센다 (유형마다 1개 규칙과 같은 단위) */
function rw155LineData(row){
  var S = rw155Stu(row), list = S.still.filter(function(x){ return !rw155IsEx(Number(x.concept_id), S.R.ex); });
  var all = {}, out = {}, g = {};
  list.forEach(function(x){ var c = Number(x.concept_id); all[c] = 1; if (S.hasR && S.range[c]) return; if (out[c]) return; out[c] = 1;
    var gl = rw155GL(x.worksheet_title), mid = rw155Mid(c) || '기타', k = gl + '|' + mid; (g[k] = g[k] || { gl:gl, mid:mid, c:0 }).c++; });
  return { n:Object.keys(all).length, probs:list.length, m:S.hasR ? Object.keys(out).length : null, groups:Object.keys(g).map(function(k){ return g[k]; }).sort(function(a, b){ return b.c - a.c; }), days:S.R.days };
}
/* 학생별 예상 (매쓰플랫 호출 없이 · rcwsPlan 과 같은 셈) */
function rw155Est(row, rule){
  rule = rule || rcwsRule();
  var S = rw155Stu(row, rule), R = S.R, o = S.o, ex = function(c){ return rw155IsEx(c, R.ex); };
  var wrong = S.wrong.filter(function(w){ return !ex(w.cid); }), exN = S.wrong.length - wrong.length;
  var twinPer = Number(rule.twinPer) || 0; if (o.twin1 && twinPer > 0) twinPer = 1;
  var tbPer = Number(rule.tbPer) || 0, bookTwin = Number(rule.bookTwin) || 0;
  var rec = R.recentOn ? S.still.filter(function(x){ return !ex(Number(x.concept_id)); }) : [], picks = [], seen = {};
  rec.forEach(function(x){ var c = Number(x.concept_id); if (R.perType && seen[c]) return; seen[c] = 1; picks.push({ cid:c, lv:Number(x.level) || 3, key:rw155Key(x) }); });
  var book = [];
  if (bookTwin > 0 && !o.noBook){
    var since = Date.now() - (Number(rule.days) || 28) * 86400000, pk = {}, sw = {};
    picks.forEach(function(p){ pk[p.key] = 1; });
    S.rs.forEach(function(x){ if (x.source !== '교재' || x.result !== 'X' || !S.range[Number(x.concept_id)] || rw155T(x) < since || ex(Number(x.concept_id))) return;
      var k = rw155Key(x); if (!k || sw[k] || pk[k]) return; sw[k] = 1;
      var c = Number(x.concept_id); if (R.perType && seen[c]) return; seen[c] = 1; book.push({ cid:c, lv:Number(x.level) || 3 }); });
  }
  var cnt = {}; wrong.forEach(function(w){ cnt[w.cid] = (cnt[w.cid] || 0) + 1; }); rec.forEach(function(x){ var c = Number(x.concept_id); cnt[c] = (cnt[c] || 0) + 1; }); book.forEach(function(b){ cnt[b.cid] = (cnt[b.cid] || 0) + 1; });
  var boost = rule.boost ? Object.keys(cnt).filter(function(c){ return cnt[c] >= 2 && !ex(Number(c)); }).length : 0;
  var tw = wrong.length * twinPer, tb = wrong.length * tbPer, rn = picks.length, bn = book.length * bookTwin, raw = tw + tb + rn + bn + boost, total = raw;
  if (R.min > 0 && total < R.min) total = R.min;
  if (R.max > 0 && total > R.max) total = R.max;
  var hard = wrong.filter(function(w){ return w.lv >= 5; }).length + picks.filter(function(p){ return p.lv >= 5; }).length + book.filter(function(b){ return b.lv >= 5; }).length;
  // 단원 비율: 테스트(가장 많은 단원) 한 칸 + 최근·교재 오답 중단원 상위 3 + 기타
  var tm = {}; wrong.forEach(function(w){ var m = rw155Mid(w.cid) || '기타'; tm[m] = (tm[m] || 0) + 1; });
  var tTop = Object.keys(tm).sort(function(a, b){ return tm[b] - tm[a]; })[0] || '';
  var segs = []; if (tw + tb) segs.push({ label:'테스트' + (tTop ? '(' + tTop + ')' : ''), w:tw + tb, test:true });
  var mid = {}; picks.forEach(function(p){ var m = rw155Mid(p.cid) || '기타'; mid[m] = (mid[m] || 0) + 1; }); book.forEach(function(b){ var m = rw155Mid(b.cid) || '기타'; mid[m] = (mid[m] || 0) + bookTwin; });
  var mids = Object.keys(mid).map(function(k){ return [k, mid[k]]; }).sort(function(a, b){ return b[1] - a[1]; });
  mids.slice(0, 3).forEach(function(m){ segs.push({ label:m[0], w:m[1] }); });
  var etc = mids.slice(3).reduce(function(a, x){ return a + x[1]; }, 0) + boost; if (etc) segs.push({ label:'기타', w:etc });
  return { twin:tw, tb:tb, types:rn, book:bn, boost:boost, total:total, raw:raw, hard:hard, hardOn:R.hardest, segs:segs, R:R, wrongN:wrong.length, exN:exN };
}
var RW155_COL = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#94a3b8'];
function rw155EstSum(){
  var sum = 0, n = 0;
  if (!RW155.bd.key) return null;
  try { var rule = rcwsRule(); rcConfirmed().forEach(function(c){ if (!c.row || (c.e && c.e.done) || rcwsMadeOf(c.k) || !rcWsSchool(c.row.st)) return; sum += rw155Est(c.row, rule).total; n++; }); } catch(e){ return null; }
  return { sum:sum, n:n };
}
function rw155EstTable(){
  var conf = []; try { conf = rcConfirmed().filter(function(c){ return c.row && !(c.e && c.e.done); }); } catch(e){}
  if (!conf.length) return '';
  rw155Kick();
  var B = RW155.bd, rule = rcwsRule(), R0 = rw155Cfg(rule, {});
  var h = '<div id="rw155-est" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:14px">'
    + '<div style="font-size:14px;font-weight:900;color:#0d2240">🔢 학생별 예상 · 이번 주 확정 ' + conf.length + '명 <span style="font-size:11.5px;color:#64748b;font-weight:700">· 규칙: ' + (R0.ruleRecentOn ? '최근 ' + rw155DaysLabel(R0.ruleDays) : '최근 오답 끔') + ' · ' + (R0.perType ? '유형마다 1개' : '유형 묶지 않음') + ' · 최상 ' + (R0.ruleHardest ? '포함' : '빼기') + ' · 자동채점 문항만' + (R0.exSrc ? ' · 빼는 유형 «' + esc2(R0.exSrc) + '»' : '') + '</span></div>';
  if (!B.key){ return h + '<div style="padding:12px;color:#94a3b8;font-weight:700;font-size:12.5px">채점 기록 읽는 중…</div></div>'; }
  var th = 'padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11.5px;font-weight:800;text-align:left;white-space:nowrap';
  var td = 'padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:12.5px';
  h += '<div style="overflow-x:auto;margin-top:6px"><table style="border-collapse:collapse;width:100%;min-width:640px"><thead><tr>'
    + '<th style="' + th + '">학생</th><th style="' + th + '">기간</th><th style="' + th + ';text-align:right">테스트 쌍둥이</th><th style="' + th + ';text-align:right">최근 오답</th><th style="' + th + ';text-align:right">예상</th><th style="' + th + '">단원 비율</th><th style="' + th + ';text-align:right">최상</th></tr></thead><tbody>';
  var sum = 0;
  conf.forEach(function(c){
    var sch = rcWsSchool(c.row.st), k = String(c.k).replace(/'/g, '');
    var E = rw155Est(c.row, rule); sum += E.total;
    var pill = E.total > 40 ? '<span style="font-size:10.5px;font-weight:900;border-radius:20px;padding:1px 8px;background:#fef3c7;color:#b45309">많음</span>' : (E.total < 20 ? '<span style="font-size:10.5px;font-weight:900;border-radius:20px;padding:1px 8px;background:#e0e7ff;color:#3730a3">적음</span>' : '');
    var tw = 0; E.segs.forEach(function(s){ tw += s.w; }); tw = tw || 1;
    var bar = '', leg = [], ci = 0;
    E.segs.forEach(function(s){ var col = s.test ? '#0d2240' : RW155_COL[s.label === '기타' ? 4 : Math.min(ci++, 3)];
      bar += '<span style="display:block;height:100%;width:' + (s.w / tw * 100).toFixed(1) + '%;background:' + col + '"></span>';
      leg.push('<span style="color:' + col + '">■</span> ' + esc2(s.label) + ' ' + Math.round(s.w / tw * 100) + '%'); });
    h += '<tr data-rw155-est="' + esc2(String(c.k)) + '">'
      + '<td style="' + td + '"><button type="button" onclick="rcwsOpen(\'' + k + '\')" style="border:none;background:none;padding:0;font-family:inherit;font-size:13px;font-weight:900;color:#0d2240;cursor:pointer;text-decoration:underline dotted">' + esc2(c.name) + '</button>'
        + '<div style="font-size:10.5px;color:#94a3b8;font-weight:700">' + esc2(String((c.row.st && c.row.st.grade) || '').replace(/학교|학년/g, '').replace(/\s/g, '')) + (c.group ? ' · ' + esc2(c.group) : '') + (rw155IsHigh(c.row.st) ? (sch ? ' · ' + esc2(sch.grade) : ' · <b style="color:#b45309">과목 고르기</b>') : '') + '</div></td>'
      + '<td style="' + td + ';white-space:nowrap">' + (E.R.ruleRecentOn ? rw155Chips(E.R.days, 'rw155EstDays(\'' + k + '\',', '', '') + (E.R.days !== E.R.ruleDays ? ' <small style="color:#c2410c;font-weight:800">학생별</small>' : '') : '<span style="color:#94a3b8">끔</span>') + '</td>'
      + '<td data-rw155-twin style="' + td + ';text-align:right;font-variant-numeric:tabular-nums">' + E.twin + (E.tb ? ' <small style="color:#64748b">+교과서 ' + E.tb + '</small>' : '') + (E.exN ? ' <small style="color:#b91c1c">(뺌 ' + E.exN + ')</small>' : '') + '</td>'
      + '<td data-rw155-types style="' + td + ';text-align:right;font-variant-numeric:tabular-nums">' + E.types + (E.R.perType ? '유형' : '문항') + (E.book ? ' <small style="color:#64748b">+교재 ' + E.book + '</small>' : '') + (E.boost ? ' <small style="color:#64748b">+보강 ' + E.boost + '</small>' : '') + '</td>'
      + '<td data-rw155-total style="' + td + ';text-align:right;white-space:nowrap"><b style="font-size:16px;color:#0d2240">' + E.total + '</b>' + (E.total !== E.raw ? ' <small style="color:#64748b">(' + E.raw + (E.R.max && E.raw > E.R.max ? ' → 상한 ' + E.R.max + (E.R.autoMax ? ' 자동' : '') : ' → 하한 ' + E.R.min) + ')</small>' : '') + ' ' + pill + '</td>'
      + '<td style="' + td + ';min-width:190px">' + (bar ? '<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:#f1f5f9">' + bar + '</div><div data-rw155-mids style="font-size:10.5px;color:#64748b;font-weight:700;line-height:1.5;margin-top:2px">' + leg.join(' ') + '</div>' : '<span style="color:#94a3b8">—</span>') + '</td>'
      + '<td data-rw155-hard style="' + td + ';text-align:right;white-space:nowrap">' + (E.hardOn ? E.hard : '0' + (E.hard ? ' <small style="color:#94a3b8">(켜면 +' + E.hard + ')</small>' : '')) + '<div data-rw155-nonauto style="font-size:10px;color:#15803d;font-weight:800">자동채점 아님 0</div></td></tr>';
  });
  h += '</tbody></table></div>'
    + '<div data-rw155-sum style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:6px">합계 약 <b style="color:#0d2240">' + sum + '문항</b> · 예상은 채점 기록만으로 센 숫자라(매쓰플랫 호출 없음), 매쓰플랫에 쌍둥이가 없는 문제는 같은 유형으로 바뀌어 1~2문항 다를 수 있습니다. 「많음」은 40 넘을 때, 「적음」은 20 아래일 때. 이름을 누르면 설계 팝업이 열립니다.'
    + (B.partial ? ' ⚠ 기록이 많아 일부만 읽었습니다.' : '') + (B.err ? ' <span style="color:#b91c1c">기록을 읽지 못했습니다: ' + esc2(B.err) + '</span>' : '') + '</div></div>';
  return h;
}
window.rw155EstDays = function(stKey, d){
  var row = rw155Rows().find(function(r){ return String(r.stKey) === String(stKey); }); if (!row || !RCWS.loaded) return;
  var o = rcws3Opt(row), RR = rw155Cfg(rcwsRule(), {}); d = rw155Clamp(d);
  o.recentDays = (d === RR.ruleDays) ? null : d;
  var p = rcws3SaveOpt(row.stKey, o); render(); return p;
};
if (typeof l3rMakeBox === 'function'){
  var _rw155MakeBox123 = l3rMakeBox;
  l3rMakeBox = function(){
    var h = _rw155MakeBox123.apply(this, arguments), S = rw155EstSum();
    if (S && S.n) h = h.replace(/(⚡ 확정 전원 학습지 생성 \(\d+명)\)/, '$1 · 예상 ' + S.sum + '문항)');
    return h;
  };
}

/* ── 보드 카드 한 줄 «🕘 최근 1주 아직 틀린 n유형 · 테스트 범위 밖 m (…)» · 고등 과목 칸 ── */
var _rw155WsBtn123 = rcWsBtn;
rcWsBtn = function(x){
  var h = _rw155WsBtn123.apply(this, arguments);
  try { var m = x && rcwsMadeOf(x.stKey); if (m && m.parts && m.parts.recent) h = h.replace(' · 보강 ', ' · 최근 오답 ' + m.parts.recent + ' · 보강 '); if (m && m.parts && m.parts.nonAuto != null) h = h.replace(/(✅ [^<]*)<\/span>/, '$1 · 자동채점 아님 ' + m.parts.nonAuto + '</span>'); } catch(e){}
  try { if (x && x.st && rw155IsHigh(x.st)) h += rw155SubjPick(x); } catch(e){}
  if (x && x.stKey != null){ RW155.mk.push(x); h = '<!--rw155#' + (RW155.mk.length - 1) + '-->' + h; }
  return h;
};
function rw155Line(x){
  var B = RW155.bd, base = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;font-weight:800;border-radius:9px;padding:6px 10px;';
  var at = ' data-rw155-line="' + esc2(String(x.stKey)) + '"';
  if (!B.key){ if (B.loading) return '<div' + at + ' style="' + base + 'background:#f8fafc;color:#94a3b8;border:1px dashed #e2e8f0">🕘 아직 틀린 문제 읽는 중…</div>'; return ''; }
  if (B.err) return '';
  var d = rw155LineData(x), lab = '최근 ' + rw155DaysLabel(d.days);
  if (!d.n) return '<div' + at + ' data-rw155-out="0" style="' + base + 'background:#f8fafc;color:#64748b;border:1px solid #e2e8f0">🕘 ' + lab + ' 아직 틀린 문제 없음</div>';
  var orange = d.m > 0, prev = null;
  var g = d.groups.slice(0, 4).map(function(a){ var s = (a.gl && a.gl !== prev ? a.gl + ' ' : '') + a.mid + ' ' + a.c; prev = a.gl || prev; return esc2(s); }).join(' · ') + (d.groups.length > 4 ? ' …' : '');
  var txt = '🕘 ' + lab + ' 아직 틀린 <b>' + d.n + '유형</b> <small style="font-weight:700">(' + d.probs + '문항)</small>' + (d.m != null ? ' · 테스트 범위 밖 <b>' + d.m + '</b>' : '') + (g ? ' <span style="font-weight:700">(' + g + ')</span>' : '') + (B.partial ? ' <small style="color:#94a3b8">· 일부만 읽음</small>' : '');
  var tip = '다시 풀어 맞힌 문제는 뺀 수입니다(유형 수 = 유형마다 1개 규칙의 최근 오답 수). 테스트 범위 밖이 많으면 테스트와 지금 진도가 달라 예전 규칙이면 빠졌을 오답입니다' + (rw155Cfg(rcwsRule(), {}).ruleRecentOn ? '' : ' — 지금 규칙에서 꺼져 있음');
  return '<div' + at + ' data-rw155-out="' + (d.m || 0) + '" title="' + esc2(tip) + '" style="' + base + (orange ? 'background:#fff7ed;color:#c2410c;border:1.5px solid #fdba74' : 'background:#f8fafc;color:#475569;border:1px solid #e2e8f0') + '">' + txt + '</div>';
}
var RW155_WSROW = '<div style="display:flex;align-items:center;gap:8px;margin-top:9px">';
var _rRecovery155 = rRecovery;
rRecovery = function(){
  RW155.mk = [];
  var h = _rRecovery155.apply(this, arguments);
  try {
    if (RC.loaded && RC.view === 'board'){
      var rows = RW155.mk.slice();
      if (rows.length) h = h.replace(/<div style="display:flex;align-items:center;gap:8px;margin-top:9px"><!--rw155#(\d+)-->/g, function(all, n){ var x = rows[Number(n)]; return (x ? rw155Line(x) : '') + RW155_WSROW; });
      var est = rw155EstTable();
      if (est){ var gi = h.indexOf('<div class="l3r-grid"'); if (gi < 0) gi = h.indexOf('<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px'); if (gi >= 0) h = h.slice(0, gi) + est + h.slice(gi); }
      else if (rows.length) rw155Kick();
    }
  } catch(e){ try { console.error('[리커버리 3판 보드]', e); } catch(_){} }
  return h.replace(/<!--rw155#\d+-->/g, '');
};
/* 「↻ 다시 읽기」 때 최근 오답 메모리도 비운다 */
if (typeof window.rc154Reload === 'function'){
  var _rw155Reload154 = window.rc154Reload;
  window.rc154Reload = function(){
    RW155.bd.key = ''; RW155.bd.win = 0;
    try { Object.keys(RCWS.cache).forEach(function(k){ if (/^r155_/.test(k)) delete RCWS.cache[k]; }); } catch(e){}
    return _rw155Reload154.apply(this, arguments);
  };
}
