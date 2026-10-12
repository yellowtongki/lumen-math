/* ═══════════════════════════════════════════════════════════════════
 * v19-115: 📅 주간 점수 화면을 «✅ 체크하기 | 📊 점수 보기» 두 칸으로 — 시안 docs/mockup_week_check_score.html
 * 원장 2026-10-12 「v19-115 만들어 배포해줘」 (한 표 안에 단추·점수·시각이 섞여 헷갈리던 것)
 *
 *  ① 머리에 두 칸 단추: 「✅ 체크하기 (n)」 | 「📊 점수 보기」 — n = 남은 할 일 수
 *     · 기본: 월요일과 수업 있는 날(lumen_group_days)은 체크하기, 그 밖엔 점수 보기
 *     · 오늘 고른 칸은 이 기기에만 기억(wkc_mode — _origSetItem, 서버로 안 올림). 다음 날은 다시 위 기본
 *  ② ✅ 체크하기 — 점수 숫자 없이 «할 일 카드» + 큰 단추. 끝난 카드는 접히고, 셋 다 끝나면 「이번 주 체크 끝 🎉」
 *     a. 📔 순공 종이 — 가져왔나요? (오늘 수업 반만 / 전체) 「📔 가져옴」 = 예전 표의 「📔 가져옴 ✓」(plwPaper → plweek_paper)
 *        「안 가져옴」 = 오늘 확인했다는 표시(plweek_paper.byCode[코드][주].miss = 오늘 날짜) — 점수는 안 바뀐다(다음 수업에 다시 묻는다)
 *     b. 📸 순공 사진 — 확인 필요 (늦게 낸 것 · 마감 뒤 · 사진 없이 낸 것 · 다시 내기 뒤 새로 낸 것)
 *        「✓ 인정」 = 사진 점수 손 고침 pov(v19-86 sgsPov 와 같은 칸) — 지각이면 지각(2점) 그대로 굳히기, 마감 뒤·사진 없음이면 지각(2점)으로 인정
 *        「✕ 다시 내기」 = pov 'none'(0점) + povWhy '다시 내기 요청' — 학생이 새로 내면 이 카드에 다시 뜬다 · 「🔍 사진 보기」
 *     c. 📅 다음 주 계획 — 안 낸 학생: 「💬 n명에게 알림」(🗓 모아보기와 같은 확인 창 → v19-114 한마디 길) · 명단 인쇄
 *     d. 「✋ 손으로 고치기 — 전체 학생」: 학생마다 «…» = 예전 표의 「자동▾」(종이 판정 자동/제출/지각/미제출 → plwPaperOv) + 사진 점수(sgsPov)
 *  ③ 📊 점수 보기 — 보기만(단추·고르기 칸 없음): 「📅 주간계획 10점」(계획 5 · 실천 5) · 「📔 순공 10점」(사진 5 · 종이 5) 묶음 머리,
 *     칸 = 점수 알약(5 초록 · 3 파랑 · 2 주황 · 1 노랑 · 0 회색) — 마우스를 올리거나 누르면 낸 시각 · 주간 합 /20 + 막대 · 매일 합
 *     숫자는 모두 plwScore(예전 표와 같은 계산) · 이름(또는 줄)을 누르면 v19-114 오른쪽 주간계획표 · ↑/↓ 그대로
 *  ※ 바탕 코드는 고치지 않고 rPlWeek · render 를 감싼다(v19-114 감싸기 바깥). 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 *  ※ plwPaper 는 같은 저장 길(plwSavePaper)로 다시 정의 — 「가져옴」이 사진 손 고침(pov)을 지우던 것을 막고 «안 가져옴» 표시를 지운다.
 * ═══════════════════════════════════════════════════════════════════ */
var WKC = { todayOnly: true, tipT: 0 };

/* ── 이 기기에만 두는 설정 ── */
function wkcGet(k){ try { return (typeof _origGetItem === 'function' ? _origGetItem(k) : localStorage.getItem(k)); } catch(e){ return null; } }
function wkcSet(k, v){ try { if (typeof _origSetItem === 'function') _origSetItem(k, v); else localStorage.setItem(k, v); } catch(e){} }
/* 오늘 수업 있는 반 (lumen_group_days: 반 → JS 요일 0=일) */
window.wkcClassGroups = function(){
  var jd = (PW.dow(PW.day()) + 1) % 7, days = PWB.days || {};
  return Object.keys(days).filter(function(g){ return Array.isArray(days[g]) && days[g].indexOf(jd) >= 0; });
};
window.wkcDefaultMode = function(){ return (PW.dow(PW.day()) === 0 || wkcClassGroups().length) ? 'check' : 'score'; };
window.wkcMode = function(){
  var raw = wkcGet('wkc_mode'), v = null; try { v = raw ? JSON.parse(raw) : null; } catch(e){ v = null; }
  if (v && (v.m === 'check' || v.m === 'score') && v.d === PW.day()) return v.m;
  return wkcDefaultMode();
};
window.wkcGo = function(m){ wkcSet('wkc_mode', JSON.stringify({ m: m, d: PW.day() })); if (m === 'check') PWB.only = '';   /* 체크하기엔 거르기 칩이 없다 — ↑/↓ 순서가 숨은 거르기에 묶이지 않게 */
  render(); };
window.wkcToday = function(){ WKC.todayOnly = !WKC.todayOnly; render(); };

/* ── 「가져옴」 — 같은 저장 길 · 사진 손 고침(pov)은 남기고 «안 가져옴» 표시는 지운다 ── */
window.plwPaper = function(code){
  var W = PWB.W || plwDefaultW(); PWB._lastPaperCode = code;
  return plwSavePaper(function(v){
    v.byCode[code] = v.byCode[code] || {};
    var k = v.byCode[code][W] || {}, rec = { at: new Date().toISOString() };
    if (k.pov){ rec.pov = k.pov; if (k.povWhy) rec.povWhy = k.povWhy; if (k.povAt) rec.povAt = k.povAt; }
    v.byCode[code][W] = rec;
  });
};
/* 「안 가져옴」 — 오늘 확인함(점수 그대로 0 · 판정 손 고침도 지움) */
window.wkcPaperMiss = function(code){
  var W = PWB.W || plwDefaultW(), today = PW.day(); PWB._lastPaperCode = code;
  return plwSavePaper(function(v){
    v.byCode[code] = v.byCode[code] || {};
    var rec = v.byCode[code][W] || {};
    delete rec.at; delete rec.ov; rec.miss = today;
    v.byCode[code][W] = rec;
  });
};

/* ── 할 일 계산 ── */
function wkcPlanWeek(W){ var P = PW.add(W, 7); if (Date.now() >= PW.lateMs(W)) P = PW.add(PW.thisMon(), 7); return P; }
window.wkcTasks = function(){
  var W = PWB.W || plwDefaultW(), today = PW.day(), all = pwlAll(), cg = wkcClassGroups();
  var scoped = (WKC.todayOnly && cg.length) ? all.filter(function(s){ return cg.indexOf(String(s.group || '')) >= 0; }) : all;
  var rec = function(c){ return ((PWB.paper.byCode || {})[c] || {})[W] || {}; };
  /* a. 종이 */
  var paper = { rows: [], left: 0, nAt: 0, nMiss: 0, scope: (WKC.todayOnly && cg.length) ? cg : null };
  scoped.forEach(function(st){
    var c = st.lumen_rec_code, r = rec(c), brought = !!r.at, missT = r.miss === today;
    var doneT = (brought && PW.dayOfIso(r.at) === today) || missT;
    if (!brought && !missT){ paper.rows.push({ st: st, c: c, state: 'left' }); paper.left++; }
    else if (doneT){ paper.rows.push({ st: st, c: c, state: brought ? 'at' : 'miss' }); if (brought) paper.nAt++; else paper.nMiss++; }
  });
  paper.rows.sort(function(a, b){ return ((a.state === 'left' ? 0 : 1) - (b.state === 'left' ? 0 : 1)) || String(a.st.name || '').localeCompare(String(b.st.name || ''), 'ko'); });
  /* b. 사진 */
  var photo = { rows: [], left: 0 };
  all.forEach(function(st){
    var c = st.lumen_rec_code, sg = (PWB.sg[c] || {})[W] || null, r = rec(c);
    if (!sg) return;
    var auto = sg.photo ? PW.judge(sg.at, W) : 'none', why = '';
    if (!sg.photo) why = '사진 없이 냄';
    else if (auto === 'late') why = '월요일에 냄(지각)';
    else if (auto === 'none') why = '마감 뒤에 냄';
    var redo = r.pov === 'none' && r.povWhy === '다시 내기 요청' && sg.at && r.povAt && String(sg.at) > String(r.povAt);
    var need = (!r.pov && !!why) || redo;
    var doneT = !!r.pov && PW.dayOfIso(r.povAt) === today && !redo;
    if (need){ photo.rows.push({ st: st, c: c, sg: sg, auto: auto, why: redo ? '다시 냄' : why, state: 'left' }); photo.left++; }
    else if (doneT) photo.rows.push({ st: st, c: c, sg: sg, auto: auto, why: why, state: r.pov, povWhy: r.povWhy || '' });
  });
  /* c. 계획 */
  var P = wkcPlanWeek(W), plan = { P: P, no: [], left: [] };
  all.forEach(function(st){
    var c = st.lumen_rec_code; if (wppPlan(c, P).sub) return;
    plan.no.push(st); if (!plwRemindOf(c, P)) plan.left.push(c);
  });
  var n = paper.left + photo.left + (plan.left.length ? 1 : 0);
  return { W: W, paper: paper, photo: photo, plan: plan, n: n, cg: cg };
};

/* ── 단추 동작 ── */
window.wkcPhoto = function(code, act){
  var W = PWB.W || plwDefaultW(), sg = (PWB.sg[code] || {})[W] || null; if (!sg) return;
  var auto = sg.photo ? PW.judge(sg.at, W) : 'none';
  return sgsPaperMut(code, W, function(rec){
    var now = new Date().toISOString();
    if (act === 'ok'){ rec.pov = (auto === 'ok' || auto === 'late') ? auto : 'late'; rec.povWhy = '원장님 확인 — 인정'; rec.povAt = now; }
    else { rec.pov = 'none'; rec.povWhy = '다시 내기 요청'; rec.povAt = now; }
  });
};
window.wkcPhotoView = function(code){
  var W = PWB.W || plwDefaultW(), sg = (PWB.sg[code] || {})[W] || null;
  var url = (sg && sg.photo && typeof sgPhotoUrl === 'function') ? sgPhotoUrl(sg.photo) : '';
  if (!url){ wppToast('사진이 없어요'); return; }
  WPP.zoomUrl = url; wppZoom();
};
window.wkcRemind = function(){ var T = wkcTasks(); plwRemindDlg(T.plan.left.length ? T.plan.left : T.plan.no.map(function(s){ return s.lumen_rec_code; }), T.plan.P, '계획 안 낸 학생에게 알림'); };
window.wkcPrintPlan = function(){
  var T = wkcTasks(), P = T.plan.P, rows = T.plan.no.slice().sort(function(a, b){ return String(a.group || '').localeCompare(String(b.group || ''), 'ko') || String(a.name || '').localeCompare(String(b.name || ''), 'ko'); });
  var h = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>계획 안 낸 학생 ' + PW.md(P) + '</title><style>'
    + '@page{size:A4 portrait;margin:12mm}body{font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#0f172a;margin:0;font-size:13px}'
    + 'h1{font-size:18px;margin:0 0 4px;color:#0d2240}.sub{color:#475569;margin-bottom:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9;font-size:12px}'
    + '.bar{padding:8px 0}button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid #0d2240;background:#0d2240;color:#fff;font-weight:800}@media print{.bar{display:none}}</style></head><body>'
    + '<div class="bar"><button onclick="window.print()">🖨 인쇄</button></div><h1>📅 주간계획 안 낸 학생 (' + PW.md(P) + '~' + PW.md(PW.add(P, 6)) + ' 주)</h1>'
    + '<div class="sub">' + rows.length + '명 · ' + PW.md(PW.day()) + ' 현재 · 일요일 밤 12시 마감 ' + PW.PT.plan.ok + '점 · 월요일 ' + PW.PT.plan.late + '점</div>'
    + '<table><tr><th>#</th><th>이름</th><th>학년</th><th>반</th><th>알림</th><th>확인</th></tr>';
  rows.forEach(function(st, i){ var rm = plwRemindOf(st.lumen_rec_code, P); h += '<tr><td>' + (i + 1) + '</td><td>' + wppEsc(st.name) + '</td><td>' + wppEsc(wppGrade(st)) + '</td><td>' + wppEsc(st.group || '') + '</td><td>' + (rm ? '💬 ' + plwTime(rm.at) : '') + '</td><td style="width:60px"></td></tr>'; });
  h += '</table><script>setTimeout(function(){window.print()},300)<\/script></body></html>';
  var w = window.open('', '_blank'); if (!w){ alert('팝업이 막혔습니다 — 허용해 주세요'); return; }
  w.document.open(); w.document.write(h); w.document.close();
};

/* ── 그리기: 체크하기 ── */
function wkcName(st){
  return '<button type="button" class="wkc-nm" onclick="plwCal(\'' + wppJs(st.lumen_rec_code) + '\')" title="주간계획표 열기">' + wppEsc(st.name) + '<small>' + wppEsc(wppGrade(st)) + (st.group ? ' · ' + wppEsc(st.group) : '') + '</small></button>';
}
/* «…» = 예전 표의 「자동▾」(종이 판정) + 사진 점수 손 고침 */
function wkcMore(st, W){
  var c = st.lumen_rec_code, r = ((PWB.paper.byCode || {})[c] || {})[W] || {}, j = wppJs(c);
  var ob = function(on, label, js){ return '<button type="button" class="wkc-ob' + (on ? ' on' : '') + '" onclick="' + js + '">' + label + '</button>'; };
  return '<details class="wkc-more"><summary aria-label="' + wppEsc(st.name) + ' 손으로 고치기" title="손으로 고치기">…</summary><div class="wkc-pop">'
    + '<div><b>📔 종이 판정</b>' + ob(!r.ov, '자동', "plwPaperOv('" + j + "','')") + ob(r.ov === 'ok', '제출', "plwPaperOv('" + j + "','ok')") + ob(r.ov === 'late', '지각', "plwPaperOv('" + j + "','late')") + ob(r.ov === 'none', '미제출', "plwPaperOv('" + j + "','none')") + '</div>'
    + '<div><b>📸 사진 점수</b>' + ob(!r.pov, '규칙대로', "sgsPov('" + j + "','" + W + "','')") + ob(r.pov === 'ok', PW.PT.photo.ok + '점', "sgsPov('" + j + "','" + W + "','ok')") + ob(r.pov === 'late', PW.PT.photo.late + '점', "sgsPov('" + j + "','" + W + "','late')") + ob(r.pov === 'none', '0점', "sgsPov('" + j + "','" + W + "','none')") + '</div>'
    + '</div></details>';
}
function wkcCard(cls, key, open, title, cnt, why, body){
  return '<details class="wkc-task ' + cls + (open ? '' : ' done') + '" data-task="' + key + '"' + (open ? ' open' : '') + '><summary><span class="wkc-h">' + title + '</span><span class="wkc-n">' + cnt + '</span></summary>'
    + (why ? '<div class="wkc-why">' + why + '</div>' : '') + body + '</details>';
}
function wkcCheckHtml(){
  var T = wkcTasks(), W = T.W, h = '<div class="wkc-body">';
  var allDone = !T.n;
  if (allDone) h += '<div class="wkc-fin" role="status">이번 주 체크 끝 🎉 <small>' + PW.md(W) + '~' + PW.md(PW.add(W, 6)) + ' 주 · 고칠 것은 아래 «✋ 손으로 고치기»</small></div>';
  /* a. 종이 */
  var p = T.paper, pb = '';
  if (T.cg.length) pb += '<div class="wkc-opt"><label><input type="checkbox" ' + (WKC.todayOnly ? 'checked ' : '') + 'onchange="wkcToday()"> 오늘 수업 반만 (' + wppEsc(T.cg.join(' · ')) + ')</label></div>';
  p.rows.forEach(function(x){
    var c = wppJs(x.c);
    pb += '<div class="wkc-row" data-code="' + wppEsc(x.c) + '" data-state="' + x.state + '">' + wkcName(x.st) + '<span class="wkc-btns">'
      + '<button type="button" class="wkc-tb' + (x.state === 'at' ? ' on' : '') + '" data-act="at" onclick="' + (x.state === 'at' ? '' : "plwPaper('" + c + "')") + '"' + (x.state === 'at' ? ' aria-pressed="true"' : '') + '>📔 가져옴' + (x.state === 'at' ? ' ✓' : '') + '</button>'
      + '<button type="button" class="wkc-tb no' + (x.state === 'miss' ? ' on2' : '') + '" data-act="miss" onclick="' + (x.state === 'miss' ? '' : "wkcPaperMiss('" + c + "')") + '"' + (x.state === 'miss' ? ' aria-pressed="true"' : '') + '>안 가져옴' + (x.state === 'miss' ? ' ✓' : '') + '</button>'
      + wkcMore(x.st, W) + '</span></div>';
  });
  if (!p.rows.length) pb += '<div class="wkc-none">' + (p.scope ? '오늘 수업 반 학생은 모두 가져왔어요' : '모두 가져왔어요') + '</div>';
  h += wkcCard('t1', 'paper', p.left > 0, '📔 순공 종이 — 가져왔나요?', p.left ? (p.scope ? '오늘 수업 반 ' + wppEsc(p.scope.join('·')) + ' · ' : '') + '남은 ' + p.left + '명' : '✓ 끝' + (p.nAt || p.nMiss ? ' · 오늘 가져옴 ' + p.nAt + ' · 안 가져옴 ' + p.nMiss : ''),
    PW.md(W) + '~' + PW.md(PW.add(W, 6)) + ' 주 종이 · 누르면 바로 저장 · 안 가져온 학생은 다음 수업에 다시 물어요(다음 주 첫 수업까지 ' + PW.PT.paper.ok + '점 · 그 주 안 ' + PW.PT.paper.late + '점)', pb);
  /* b. 사진 */
  var ph = T.photo, sb = '';
  ph.rows.forEach(function(x){
    var c = wppJs(x.c), okLabel = '✓ 인정' + (x.auto === 'ok' ? '' : ' (지각 ' + PW.PT.photo.late + '점)');
    sb += '<div class="wkc-row" data-code="' + wppEsc(x.c) + '" data-state="' + x.state + '">' + wkcName(x.st) + '<span class="wkc-why2">' + wppEsc(x.why) + (x.sg && x.sg.at ? ' · ' + plwTime(x.sg.at) : '') + '</span><span class="wkc-btns">'
      + '<button type="button" class="wkc-tb' + (x.state === 'ok' || x.state === 'late' ? ' on' : '') + '" data-act="ok" onclick="wkcPhoto(\'' + c + '\',\'ok\')">' + okLabel + '</button>'
      + '<button type="button" class="wkc-tb x' + (x.state === 'none' ? ' on3' : '') + '" data-act="redo" onclick="wkcPhoto(\'' + c + '\',\'redo\')">✕ 다시 내기</button>'
      + (x.sg && x.sg.photo ? '<button type="button" class="wkc-tb no" data-act="view" onclick="wkcPhotoView(\'' + c + '\')">🔍 사진 보기</button>' : '')
      + wkcMore(x.st, W) + '</span></div>';
  });
  if (!ph.rows.length) sb += '<div class="wkc-none">확인할 사진이 없어요 — 나머지는 자동</div>';
  h += wkcCard('t2', 'photo', ph.left > 0, '📸 순공 사진 — 확인 필요', ph.left ? ph.left + '명' : '✓ 끝', '늦게 냈거나 사진 없이 낸 것만 여기에 · 나머지는 자동 · 「다시 내기」는 0점으로 두고 새로 내면 다시 여기에', sb);
  /* c. 계획 */
  var pl = T.plan, P = pl.P, cb = '';
  if (pl.no.length){
    cb += '<div class="wkc-row"><span class="wkc-nm2">한꺼번에</span><span class="wkc-btns">'
      + '<button type="button" class="wkc-tb' + (pl.left.length ? '' : ' on') + '" id="wkc-remind" onclick="wkcRemind()">💬 ' + (pl.left.length || pl.no.length) + '명에게 ' + (pl.left.length ? '알림' : '다시 알림') + '</button>'
      + '<button type="button" class="wkc-tb no" id="wkc-plan-print" onclick="wkcPrintPlan()">명단 인쇄</button></span></div>'
      + '<div class="wkc-chips">' + pl.no.map(function(st){ var rm = plwRemindOf(st.lumen_rec_code, P); return '<span class="wkc-chip' + (rm ? ' sent' : '') + '">' + wppEsc(st.name) + (rm ? ' 💬' : '') + '</span>'; }).join('') + '</div>';
  } else cb += '<div class="wkc-none">모두 냈어요</div>';
  var dueTxt = Date.now() < PW.dueMs(PW.add(P, -7)) ? '일요일 밤 12시 마감 · 월요일까지 내면 ' + PW.PT.plan.late + '점' : '오늘(월) 밤 12시까지 내면 ' + PW.PT.plan.late + '점';
  h += wkcCard('t3', 'plan', pl.left.length > 0, '📅 다음 주 계획 — 안 낸 학생 ' + pl.no.length + '명', pl.left.length ? PW.md(P) + '~ 주 · 알림 안 보낸 ' + pl.left.length + '명' : (pl.no.length ? '✓ 모두 알림 보냄' : '✓ 끝'), PW.md(P) + '~' + PW.md(PW.add(P, 6)) + ' 주 계획 · ' + dueTxt, cb);
  /* d. 전체 손 고침 */
  var mb = '<div class="wkc-all">';
  pwlAll().slice().sort(function(a, b){ return String(a.name || '').localeCompare(String(b.name || ''), 'ko'); }).forEach(function(st){
    var s = plwScore(st, W), pov0 = ((PWB.paper.byCode || {})[st.lumen_rec_code] || {})[W] || {};
    mb += '<div class="wkc-row" data-code="' + wppEsc(st.lumen_rec_code) + '">' + wkcName(st) + '<span class="wkc-why2">종이 ' + (s.paperAt ? PW.KO[s.paper] + (pov0.ov ? ' (손 고침)' : '') : '안 가져옴') + ' · 사진 ' + (s.photoOv ? PW.KO[s.photo] + ' (손 고침)' : PW.KO[s.photo]) + '</span><span class="wkc-btns">' + wkcMore(st, W) + '</span></div>';
  });
  mb += '</div>';
  h += '<details class="wkc-task t4" data-task="manual"><summary><span class="wkc-h">✋ 손으로 고치기 — 전체 학생 (예전 「자동▾」)</span><span class="wkc-n">' + pwlAll().length + '명</span></summary><div class="wkc-why">결석·전학 등 — 학생마다 «…»에서 종이 판정(자동·제출·지각·미제출)과 사진 점수를 고쳐요</div>' + mb + '</details>';
  return h + '</div>';
}

/* ── 그리기: 점수 보기 ── */
function wksPill(pt, tip, key){
  var cl = pt >= 5 ? 's5' : (pt >= 3 ? 's3' : (pt >= 2 ? 's2' : (pt >= 1 ? 's1' : 's0')));
  return '<span class="wks-pill ' + cl + '" data-k="' + key + '" title="' + wppEsc(tip) + '" onclick="wksTip(event,this)">' + pt + '</span>';
}
function wksScoreHtml(){
  var W = PWB.W || plwDefaultW(), order = PWB.order || [], h = '<div class="wks-body"><div class="wks-scroll"><table class="wks-t"><thead>'
    + '<tr><th class="l"></th><th colspan="2" class="grp">📅 주간계획 ' + PW.MAX.wp + '점</th><th colspan="2" class="grp">📔 순공 ' + PW.MAX.sg + '점</th><th></th><th></th></tr>'
    + '<tr><th class="l">학생</th><th>계획<br>' + PW.MAX.plan + '</th><th>실천<br>' + PW.MAX.prac + '</th><th>사진<br>' + PW.MAX.photo + '</th><th>종이<br>' + PW.MAX.paper + '</th><th>주간 합<br>/' + PW.MAX.total + '</th><th>매일 합<br><small>이 주</small></th></tr></thead><tbody>';
  order.forEach(function(c){
    var st = wppStu(c); if (!st) return;
    var s = plwScore(st, W), d = plwDaySum(st, W), pn = PW.planOf(PWB.wp[c], PWB.cp[c], PW.add(W, 7)), sg = (PWB.sg[c] || {})[W] || null, pr = ((PWB.paper.byCode || {})[c] || {})[W] || null;
    var jk = function(j, rel){ return (j === 'none' && !rel) ? '마감 전' : PW.KO[j]; };
    var tPlan = '다음 주 계획 · ' + jk(s.plan, s.released) + (pn && pn.submittedAt ? ' · 낸 시각 ' + plwTime(pn.submittedAt) + ' · ' + (pn.items || []).length + '개' + (pn.src === 'codi' ? ' 🧭 코디' : '') : '');
    var tPrac = s.prac.n ? ('계획 실천 ' + s.prac.ok + '/' + s.prac.n + ' · ' + s.prac.rate + '%' + (s.prac.noEv ? ' · 증거 없음 ' + s.prac.noEv : '')) : '계획 없음';
    var tPhoto = '순공 사진 · ' + jk(s.photo, s.released) + (sg && sg.at ? ' · 낸 시각 ' + plwTime(sg.at) + (sg.photo ? '' : ' · 사진 없음') : '') + (s.photoOv ? ' · 손 고침' : '');
    var tPaper = '순공 종이 · ' + (s.paperAt ? jk(s.paper, true) + ' · 가져온 시각 ' + plwTime(s.paperAt) + (pr && pr.ov ? ' · 손 고침' : '') : '아직 안 가져옴');
    var pct = Math.max(0, Math.min(100, Math.round(s.total / PW.MAX.total * 100)));
    h += '<tr data-wks="' + wppEsc(c) + '" data-wpp="' + wppEsc(c) + '" class="wpp-row" onclick="wksRow(event,\'' + wppJs(c) + '\')">'
      + '<td class="l nm"><span class="wks-nm" role="link" tabindex="0" onkeydown="if(event.key===\'Enter\')wppPick(\'' + wppJs(c) + '\')">' + wppEsc(st.name) + '</span><small>' + wppEsc(wppGrade(st)) + '</small></td>'
      + '<td>' + wksPill(s.planPt, tPlan, 'plan') + '</td><td>' + wksPill(s.prac.pt, tPrac, 'prac') + '</td><td>' + wksPill(s.photoPt, tPhoto, 'photo') + '</td><td>' + wksPill(s.paperPt, tPaper, 'paper') + '</td>'
      + '<td class="sum"><b class="wks-sum">' + s.total + '</b><div class="wks-bar"><i style="width:' + pct + '%"></i></div></td>'
      + '<td class="day">' + d.sum + '<small>/' + (d.n * 10) + '</small></td></tr>';
  });
  if (!order.length) h += '<tr><td colspan="7" class="wks-empty">학생이 없어요</td></tr>';
  h += '</tbody></table></div>'
    + '<div class="wks-lock">🔒 이 표는 보기만 합니다 · 색: <span class="wks-pill s5">5</span> 제때 <span class="wks-pill s3">3</span> <span class="wks-pill s2">2</span> 지각·중간 <span class="wks-pill s1">1</span> <span class="wks-pill s0">0</span> 없음 · 칸에 마우스를 올리거나 누르면 낸 시각 · 학생 이름(또는 줄)을 누르면 오른쪽에 주간계획표 · 정렬: 주간 합 높은 순 · 고치기는 <button type="button" class="pwl-link" onclick="wkcGo(\'check\')">✅ 체크하기</button>의 «…»</div></div>';
  return h;
}
window.wksRow = function(e, c){
  var t = e && e.target;
  if (t && t.classList && t.classList.contains('wks-pill')) return;
  wppPick(c);
};
window.wksTip = function(e, el){
  if (e) e.stopPropagation();
  var tip = document.getElementById('wks-tip');
  if (!tip){ tip = document.createElement('div'); tip.id = 'wks-tip'; tip.setAttribute('role', 'status'); document.documentElement.appendChild(tip); }   /* body 는 zoom 이 걸려 있어 화면 좌표가 어긋난다 — html 바로 아래에 */
  tip.textContent = el.getAttribute('title') || '';
  var r = el.getBoundingClientRect();
  tip.style.display = 'block';
  var x = Math.max(8, Math.min(window.innerWidth - 268, r.left + r.width / 2 - 130)), y = r.bottom + 6;
  if (y + 60 > window.innerHeight) y = Math.max(8, r.top - 58);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  clearTimeout(WKC.tipT); WKC.tipT = setTimeout(function(){ tip.style.display = 'none'; }, 3500);
};

/* ── rPlWeek 감싸기 (v19-114 감싸기 바깥) ── */
(function(){
  var o = window.rPlWeek; if (typeof o !== 'function') return;
  window.rPlWeek = function(){
    var h = o.apply(this, arguments);
    if (!PWB.loaded) return h;
    if (!PLWALL.msgAt) pwlMsgLoad(false);
    var mode = wkcMode(), T = null;
    try { T = wkcTasks(); } catch(e){ try { console.error('[주간 체크]', e); } catch(_){} }
    var n = T ? T.n : 0;
    var seg = '<span class="wkc-seg" role="tablist" aria-label="주간 점수 보기 방법">'
      + '<button type="button" role="tab" id="wkc-tab-check" aria-selected="' + (mode === 'check') + '" class="' + (mode === 'check' ? 'on' : '') + '" onclick="wkcGo(\'check\')">✅ 체크하기' + (n ? ' <span class="cnt">' + n + '</span>' : ' <span class="cnt ok">✓</span>') + '</button>'
      + '<button type="button" role="tab" id="wkc-tab-score" aria-selected="' + (mode === 'score') + '" class="' + (mode === 'score' ? 'on' : '') + '" onclick="wkcGo(\'score\')">📊 점수 보기</button></span>';
    var hd = '<span style="font-size:15px;font-weight:900">📅 주간 점수</span>';
    if (h.indexOf(hd) >= 0) h = h.replace(hd, hd + seg);
    var a = h.indexOf('<div style="overflow-x:auto;background:#fff;border:1px solid #e3e7ee;border-top:none;border-radius:0 0 12px 12px">');
    var b = a >= 0 ? h.indexOf('</table></div>', a) : -1;
    if (a < 0 || b < 0) return h;
    b += '</table></div>'.length;
    var body;
    try { body = mode === 'check' ? wkcCheckHtml() : wksScoreHtml(); }
    catch(e){ try { console.error('[주간 체크/점수]', e); } catch(_){} body = '<div class="wks-body" style="color:#b91c1c;font-weight:800">주간 점수 오류: ' + wppEsc(e.message) + '</div>'; }
    h = h.slice(0, a) + '<div class="wkc-mode" data-mode="' + mode + '">' + body + '</div>' + h.slice(b);
    if (mode === 'check') h = h.replace(/<button type="button" onclick="plwOnly\('(paper|plan)'\)"[^>]*>[^<]*<\/button>/g, '');
    h = h.replace('결석 등은 옆 칸에서 손으로 고친다. ', '결석 등은 ✅ 체크하기의 «…»(또는 ✋ 손으로 고치기)에서 손으로 고친다. ');
    return h;
  };
})();

/* 점수 표의 고른 줄 파란 띠 (v19-114 와 같은 모양) */
render = window.render = (function(o){ return function(){
  var r = o.apply(this, arguments);
  try {
    if (VIEW === 'plweek'){
      var rows = document.querySelectorAll('#CONTENT tr[data-wks]');
      for (var i = 0; i < rows.length; i++){ var on = rows[i].getAttribute('data-wks') === WPP.sel; rows[i].classList.toggle('wpp-sel', on); rows[i].setAttribute('aria-selected', on ? 'true' : 'false'); }
    }
    var tip = document.getElementById('wks-tip'); if (tip) tip.style.display = 'none';
  } catch(e){}
  return r; }; })(render);

/* ── 모양 ── */
(function(){
  if (document.getElementById('wkc-css')) return;
  var st = document.createElement('style'); st.id = 'wkc-css';
  st.textContent = ''
    + '.wkc-seg{display:inline-flex;background:rgba(255,255,255,.13);border-radius:12px;padding:3px;gap:3px}'
    + '.wkc-seg button{border:none;background:none;padding:7px 13px;border-radius:9px;font:inherit;font-size:13px;font-weight:900;color:#cbd5e1;cursor:pointer;white-space:nowrap}'
    + '.wkc-seg button.on{background:#fff;color:#0d2240}.wkc-seg button:focus-visible{outline:2px solid #fbbf24;outline-offset:1px}'
    + '.wkc-seg .cnt{background:#f97316;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:3px}.wkc-seg .cnt.ok{background:#16a34a}'
    + '.wkc-mode{background:#fff;border:1px solid #e3e7ee;border-top:none;border-radius:0 0 12px 12px;min-width:0}'
    + '.wkc-body,.wks-body{padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}'
    + '.wkc-fin{background:#f0fdf4;border:2px solid #86efac;color:#15803d;border-radius:14px;padding:12px 14px;font-size:16px;font-weight:900}.wkc-fin small{display:block;font-size:11.5px;color:#166534;font-weight:700;margin-top:2px}'
    + '.wkc-task{border:2px solid #e2e8f0;border-radius:14px;padding:9px 12px;min-width:0}.wkc-task>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
    + '.wkc-task>summary::-webkit-details-marker{display:none}.wkc-h{font-size:15px;font-weight:900;color:#0f172a}.wkc-n{margin-left:auto;font-size:12px;color:#64748b;font-weight:800}'
    + '.wkc-task.t1{border-color:#fdba74;background:#fffaf5}.wkc-task.t2{border-color:#93c5fd;background:#f8fbff}.wkc-task.t3{border-color:#d8b4fe;background:#fcfaff}.wkc-task.t4{border-color:#e2e8f0;background:#fff}'
    + '.wkc-task.done{border-color:#bbf7d0;background:#f7fef9;padding:6px 12px}.wkc-task.done .wkc-h{color:#15803d;font-size:13.5px}.wkc-task.done .wkc-n{color:#15803d}'
    + '.wkc-why{color:#64748b;font-size:12px;font-weight:600;margin:4px 0 6px}.wkc-opt{font-size:12.5px;font-weight:800;color:#9a3412;margin-bottom:4px}.wkc-opt input{width:16px;height:16px;vertical-align:-3px}'
    + '.wkc-row{display:grid;grid-template-columns:minmax(96px,150px) minmax(0,1fr);gap:4px 8px;align-items:center;padding:6px 0;border-top:1px solid #f1f5f9;min-width:0}'
    + '.wkc-row .wkc-why2{grid-column:2;font-size:11.5px;color:#b45309;font-weight:800}.wkc-row .wkc-why2+.wkc-btns{grid-column:2}'
    + '.wkc-nm{border:none;background:none;padding:0;font:inherit;font-weight:900;font-size:14px;color:#0d2240;cursor:pointer;text-align:left;overflow-wrap:anywhere}.wkc-nm small{color:#64748b;font-weight:700;font-size:11px;margin-left:4px}'
    + '.wkc-nm2{font-weight:900;font-size:14px;color:#0d2240}'
    + '.wkc-btns{display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0}'
    + '.wkc-tb{min-width:96px;min-height:42px;border-radius:10px;border:2px solid #e2e8f0;background:#fff;font:inherit;font-size:13.5px;font-weight:900;color:#0f172a;cursor:pointer;padding:0 12px}'
    + '.wkc-tb:hover{background:#f8fafc}.wkc-tb.on{background:#dcfce7;border-color:#86efac;color:#15803d}.wkc-tb.no{background:#f8fafc;color:#64748b}.wkc-tb.no.on2{background:#f1f5f9;border-color:#94a3b8;color:#334155}'
    + '.wkc-tb.x{border-color:#fecaca;color:#dc2626}.wkc-tb.x.on3{background:#fee2e2}.wkc-tb:focus-visible,.wkc-nm:focus-visible,.wkc-ob:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '.wkc-more{position:relative}.wkc-more>summary{list-style:none;cursor:pointer;min-width:42px;min-height:42px;display:flex;align-items:center;justify-content:center;border:2px solid #e2e8f0;border-radius:10px;font-weight:900;color:#475569;background:#fff}'
    + '.wkc-more>summary::-webkit-details-marker{display:none}.wkc-more[open]>summary{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.wkc-pop{position:absolute;right:0;top:calc(100% + 4px);z-index:30;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 10px 30px rgba(13,34,64,.2);padding:8px 10px;display:flex;flex-direction:column;gap:6px;width:max-content;max-width:min(330px,calc(100vw - 32px))}'
    + '.wkc-pop>div{display:flex;gap:4px;flex-wrap:wrap;align-items:center;font-size:12px}.wkc-pop b{min-width:74px;color:#0d2240}'
    + '.wkc-ob{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 9px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:#334155}.wkc-ob.on{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.wkc-none{font-size:12.5px;color:#15803d;font-weight:800;padding:4px 0}'
    + '.wkc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.wkc-chip{font-size:11.5px;font-weight:800;background:#f5f3ff;color:#5b21b6;border-radius:6px;padding:2px 7px}.wkc-chip.sent{background:#f0fdf4;color:#166534}'
    + '@media(max-width:640px){.wkc-row{grid-template-columns:minmax(0,1fr)}.wkc-row .wkc-why2,.wkc-row .wkc-why2+.wkc-btns{grid-column:1}.wkc-tb{min-width:0;flex:1 1 auto}}'
    /* 점수 보기 */
    + '.wks-scroll{overflow-x:auto;min-width:0}.wks-t{border-collapse:collapse;width:100%;min-width:560px;font-size:12.5px}'
    + '.wks-t th{font-size:11.5px;color:#475569;text-align:center;padding:7px 4px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:800}.wks-t th.grp{font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0}'
    + '.wks-t th.l,.wks-t td.l{text-align:left;padding-left:10px}.wks-t td{padding:8px 4px;text-align:center;border-bottom:1px solid #f1f5f9}'
    + '.wks-t td.nm{font-weight:900;color:#0d2240;white-space:nowrap}.wks-t td.nm small{color:#94a3b8;font-weight:700;font-size:10.5px;margin-left:4px}'
    + '.wks-nm{cursor:pointer;text-decoration:underline;text-decoration-color:#cbd5e1;text-underline-offset:3px}.wks-nm:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '.wks-pill{display:inline-block;min-width:30px;padding:3px 0;border-radius:7px;font-weight:900;text-align:center;cursor:help}'
    + '.wks-pill.s5{background:#dcfce7;color:#15803d}.wks-pill.s3{background:#e0f2fe;color:#0369a1}.wks-pill.s2{background:#fef3c7;color:#b45309}.wks-pill.s1{background:#fef9c3;color:#a16207}.wks-pill.s0{background:#f1f5f9;color:#94a3b8}'
    + '.wks-sum{font-size:16px;font-weight:900;color:#0d2240}.wks-bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin:3px auto 0;max-width:70px}.wks-bar i{display:block;height:100%;background:#2563eb}'
    + '.wks-t td.day{color:#475569}.wks-t td.day small{color:#94a3b8}.wks-empty{color:#94a3b8;padding:20px}'
    + '.wks-lock{font-size:11.5px;color:#64748b;font-weight:600;line-height:1.9}.wks-lock .wks-pill{min-width:20px;padding:0 4px;cursor:default}'
    + '#wks-tip{position:fixed;z-index:10002;display:none;max-width:260px;background:#0d2240;color:#fff;font-size:12px;font-weight:700;border-radius:8px;padding:7px 10px;box-shadow:0 8px 20px rgba(13,34,64,.3);line-height:1.5;pointer-events:none}';
  (document.head || document.documentElement).appendChild(st);
})();
