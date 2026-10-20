/* ═══════════════════════════════════════════════════════════════
 * 📅 플래너 주간 점수 계산 — 학생앱·학원앱에 «같은 글자»로 들어간다 (원장 결정 2026-09-28)
 *   규칙: docs/planner_score_v2.md
 *   주간 점수(20) = 📅 주간계획 10 (다음 주 계획 5 + 실천 5) + 📔 순공피드백 10 (사진 5 + 종이 5) — 원장 결정 2026-10-07 「순공, 주간계획 10점씩」
 *     (2026-09-28 처음 정한 것은 10점 = 계획 3 + 실천 3 + 사진 2 + 종이 2)
 *   · 계획·사진: 일요일 24시(KST)까지 제출 · 월요일 24시까지 지각 · 그 뒤 미제출
 *   · 종이: 다음 주 첫 수업까지 제출 · 그 주 안 지각 · 안 가져옴 미제출 (원장님 「가져옴 ✓」 날짜로)
 *   · 일요일 밤이 지나면 «발표», 지각·종이는 들어오는 대로 «추가»된다
 *   · 시범 주: 9/28 주 — 첫 주간 점수는 10/5(월) 발표. 실천은 10/1(목)부터 센다
 * ═══════════════════════════════════════════════════════════════ */
var PW = window.PW || {};
window.PW = PW;
PW.START = '2026-10-01';   // 새 매일 점수 · 실천 계산 시작일
PW.W0 = '2026-09-28';      // 시범 주
PW.kst = function(t){ return new Date((t == null ? Date.now() : t) + 9 * 3600000); };
PW.day = function(t){ return PW.kst(t).toISOString().slice(0, 10); };
PW.dayOfIso = function(iso){ var t = Date.parse(iso || ''); return isNaN(t) ? '' : PW.day(t); };
PW.add = function(s, n){ var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
PW.dow = function(s){ return (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; };   /* 월0 … 일6 */
PW.mon = function(s){ return PW.add(s, -PW.dow(s)); };
PW.thisMon = function(){ return PW.mon(PW.day()); };
PW.md = function(s){ var p = String(s || '').split('-'); return p.length < 3 ? s : ((+p[1]) + '/' + (+p[2])); };
PW.DOW = ['월', '화', '수', '목', '금', '토', '일'];
/* 주 W(월요일 날짜)의 마감 — 일요일 24시 = W+7 00:00 KST · 지각 한도 = 월요일 24시 */
PW.dueMs = function(wMon){ return Date.parse(PW.add(wMon, 7) + 'T00:00:00+09:00'); };
PW.lateMs = function(wMon){ return Date.parse(PW.add(wMon, 8) + 'T00:00:00+09:00'); };
PW.judge = function(iso, wMon){
  if (!iso) return 'none';
  var t = Date.parse(iso); if (isNaN(t)) return 'none';
  if (t < PW.dueMs(wMon)) return 'ok';
  if (t < PW.lateMs(wMon)) return 'late';
  return 'none';
};
/* 그 주 첫 수업일 — lumen_group_days 의 요일(JS getDay: 0=일) 중 가장 이른 날. 없으면 월·수·금 */
PW.firstClass = function(wMon, days){
  var arr = (days && days.length) ? days : [1, 3, 5];
  for (var i = 0; i < 7; i++){ if (arr.indexOf((i + 1) % 7) >= 0) return PW.add(wMon, i); }
  return wMon;
};
/* 종이 판정: rec = { at:'가져온 시각', ov:'ok|late|none'(원장 손 고침) } */
PW.paperJudge = function(rec, wMon, days){
  if (rec && rec.ov) return rec.ov;
  if (!rec || !rec.at) return 'none';
  var d = PW.dayOfIso(rec.at), nMon = PW.add(wMon, 7), fc = PW.firstClass(nMon, days);
  if (d <= fc) return 'ok';
  if (d <= PW.add(nMon, 6)) return 'late';
  return 'none';
};
/* 코디 계획(codi_plan_<코드>)을 주간계획 모양으로 — 코디 학생은 코디 계획도 인정 */
PW.fromCodi = function(cp, wMon){
  if (!cp || cp.week !== wMon) return null;
  var items = (cp.blocks || []).map(function(b){ return { id: 'c_' + b.id, d: b.d, title: ((b.item || {}).title) || '', subj: ((b.item || {}).subj) || '수학', src: 'codi', cid: b.id }; }).filter(function(x){ return x.title; });
  return items.length ? { items: items, submittedAt: cp.made || cp.upd || null, src: 'codi' } : null;
};
/* 이번 주 계획 — 앱 주간계획이 있으면 그것, 없으면 코디 계획 */
PW.planOf = function(wp, cp, wMon){
  var w = wp && wp.weeks && wp.weeks[wMon];
  if (w && (w.items || []).length) return w;
  return PW.fromCodi(cp, wMon);
};
/* 실천 확인 모음: 앱 주간계획 확인(wplan_chk) + 코디 확인(codi_done) */
PW.chkOf = function(wc, cd, wMon){
  var out = {}, w = (wc && wc.weeks && wc.weeks[wMon]) || {}, k;
  for (k in w) out[k] = w[k];
  /* 코디 확인은 'c_'+칸 번호(예전 코디 계획)와 칸 번호 그대로(달력에 비친 코디 칸 — v2-112부터 달력 항목 id = 코디 칸 id) 둘 다로 */
  if (cd){ for (var i = 0; i < 7; i++){ var day = PW.add(wMon, i), m = cd[day] || {}; for (k in m){ if (m[k]){ out['c_' + k] = { ok: true, at: m[k].at }; if (!out[k]) out[k] = { ok: true, at: m[k].at }; } } } }
  return out;
};
/* ev = { 할일id: 0 } — 수학 할 일인데 그날 매쓰플랫 채점·아하노트 기록이 없어 실천으로 세지 않는 것 (학원앱이 plweek_ev 에 적는다 · 2026-10-05) */
PW.practice = function(plan, chk, wMon, ev){
  var items = ((plan && plan.items) || []).filter(function(it){ return it && it.title && PW.add(wMon, +it.d || 0) >= PW.START; });
  if (!items.length) return { n: 0, ok: 0, rate: 0, pt: 0, noEv: 0 };
  var noEv = 0;
  var ok = items.filter(function(it){ var o = chk && chk[it.id] && chk[it.id].ok; if (o && ev && ev[it.id] === 0){ noEv++; return false; } return o; }).length;
  var rate = Math.round(ok / items.length * 100);
  return { n: items.length, ok: ok, rate: rate, pt: rate >= 70 ? 5 : (rate >= 40 ? 3 : (ok > 0 ? 1 : 0)), noEv: noEv };
};
PW.PT = { plan: { ok: 5, late: 2, none: 0 }, photo: { ok: 5, late: 2, none: 0 }, paper: { ok: 5, late: 2, none: 0 } };
PW.MAX = { plan: 5, prac: 5, photo: 5, paper: 5, wp: 10, sg: 10, total: 20 };   /* 2026-10-07: 주간계획 10 + 순공피드백 10 */
PW.KO = { ok: '제출', late: '지각', none: '미제출' };
/* 한 학생의 주 W 주간 점수.  o = { wMon, planNext, plan, chk, sg, paper, days } */
PW.week = function(o){
  var W = o.wMon;
  var planJ = PW.judge(o.planNext && o.planNext.submittedAt, W);
  /* v19-86: 원장님이 사진 점수를 고친 주(plweek_paper 의 pov)는 그 값으로 */
  var sgAuto = (o.sg && o.sg.photo) ? PW.judge(o.sg.at, W) : 'none';
  var sgJ = (o.paper && o.paper.pov) ? o.paper.pov : sgAuto;
  var pr = PW.practice(o.plan, o.chk, W, o.ev || null);
  var paJ = PW.paperJudge(o.paper, W, o.days);
  var now = Date.now();
  return {
    wMon: W, plan: planJ, planPt: PW.PT.plan[planJ], prac: pr, photo: sgJ, photoPt: PW.PT.photo[sgJ], photoAuto: sgAuto, photoOv: !!(o.paper && o.paper.pov),
    paper: paJ, paperPt: PW.PT.paper[paJ], paperAt: (o.paper && o.paper.at) || null,
    total: PW.PT.plan[planJ] + pr.pt + PW.PT.photo[sgJ] + PW.PT.paper[paJ],
    released: now >= PW.dueMs(W), lateOpen: now < PW.lateMs(W), trial: W === PW.W0
  };
};
/* 학교 기본 시간 (원장 지시 2026-09-28) — 학생이 「🏫 학교 시간」에서 요일마다 고치기 전까지 달력에 칠하는 값
 *   초1·2 09:00~13:00 · 초3·4 09:00~14:00 · 초5·6 09:00~14:30 · 그 밖(중·고) 08:30~15:30 */
PW.schoolDef = function(grade){
  var m = String(grade || '').match(/(초등학교|초등|초)\s*(\d)/);
  if (m){ var g = +m[2]; return { start: '09:00', end: g <= 2 ? '13:00' : (g <= 4 ? '14:00' : '14:30'), elem: true }; }
  return { start: '08:30', end: '15:30', elem: false };
};
PW.schoolBlocks = function(grade){ var d = PW.schoolDef(grade); return [{ id: 'school', label: '학교', type: 'school', days: [0,1,2,3,4], start: d.start, end: d.end, dflt: true }]; };
/* 남은 시간 글자 */
PW.left = function(ms){
  var d = ms - Date.now(); if (d <= 0) return '마감';
  var h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000);
  if (h >= 48) return Math.floor(h / 24) + '일 ' + (h % 24) + '시간';
  return h + '시간 ' + m + '분';
};
