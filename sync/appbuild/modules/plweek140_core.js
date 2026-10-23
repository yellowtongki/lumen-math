/* ═══════════════════════════════════════════════════════════════
 * v19-140 · 학생앱 v2-145: 주간 점수 마감 새벽 3시 유예 + 코디 점검 주 «다음 주 계획» 면제
 *   원장 2026-10-19 「면제하고 새벽 3시 유예도 줘」
 *   ① 매일 플래너처럼 주간 마감도 새벽 3시까지 인정 — 계획·순공 사진: 월요일 03시 전 = 제출, 화요일 03시 전 = 지각
 *   ② 2026-10-12 주의 «다음 주(10/19) 계획»은 코디 점검(10/15~)으로 학생이 쓸 기회가 없었다 → 제출(5점)로 친다
 *   학원앱(plweek_core.js 뒤)과 학생앱(PW.week 뒤)에 «같은 글자»로 들어간다.
 * ═══════════════════════════════════════════════════════════════ */
(function(){
  var PW = window.PW; if (!PW || PW._v140) return; PW._v140 = true;
  PW.GRACE_H = 3;
  PW.dueMs = function(wMon){ return Date.parse(PW.add(wMon, 7) + 'T00:00:00+09:00') + PW.GRACE_H * 3600000; };
  PW.lateMs = function(wMon){ return Date.parse(PW.add(wMon, 8) + 'T00:00:00+09:00') + PW.GRACE_H * 3600000; };
  PW.EXEMPT = { plan: { '2026-10-12': '코디 점검 중이라 이번 한 번 면제' } };
  PW.planExempt = function(wMon){ return (PW.EXEMPT.plan && PW.EXEMPT.plan[wMon]) || ''; };
  var week0 = PW.week;
  PW.week = function(o){
    var r = week0(o), ex = PW.planExempt(o && o.wMon);
    if (ex && r.plan !== 'ok'){
      r.total += PW.PT.plan.ok - r.planPt;
      r.plan = 'ok'; r.planPt = PW.PT.plan.ok; r.planEx = ex;
    }
    return r;
  };
})();
