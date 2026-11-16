/* 🔥 연속 기록 계산 — 서버(sync/streak_board.js)와 학생앱(v2-164)이 «같은 코드»를 쓴다 (ES5 · 날짜는 한국 시간)
 *   (원장 2026-11-16 「연속 학습 표기를 플래너와 녹음에 도입 · 상위 5명 · 전체 학생 랭킹」)
 *   플래너 = 매일 · 새벽 3시 전 제출은 전날 것 (사진 파일 이름 «코드_YYYYMMDD_HHMM_planner_…»)
 *   녹음   = 수업일만(반 이름 M → 월수금, T → 화목토), 2026-12-01 부터 매일 (submissions_<코드> 의 id «YYYYMMDD_HHMM»)
 *   지금 연속 = 내야 하는 날을 오늘부터 거꾸로 세다가 안 낸 날에서 멈춤 · 오늘 아직이면 어제부터
 *   최고 = 남은 기록 안에서 가장 길었던 연속 */
var STK = (function(){
  var REC_DAILY_FROM = '20261201';
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  function kst(d){ return new Date((d ? d.getTime() : Date.now()) + 9 * 3600000); }   /* UTC 필드로 읽는 한국 시각 */
  function ymdOf(dk){ return dk.getUTCFullYear() + p2(dk.getUTCMonth() + 1) + p2(dk.getUTCDate()); }
  function todayK(){ return ymdOf(kst()); }
  function addDay(k, n){ var d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8) + n)); return ymdOf(d); }
  function dow(k){ return new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8))).getUTCDay(); }
  function classDays(group){ var g = String(group || ''); return /^m/i.test(g) ? [1, 3, 5] : /^t/i.test(g) ? [2, 4, 6] : []; }
  /* 파일 이름들 → 플래너 낸 날 {YYYYMMDD:1} */
  function plannerDays(names){
    var o = {};
    (names || []).forEach(function(n){
      n = String(n || ''); if (n.indexOf('planner') < 0) return;
      var m = /_(\d{8})_(\d{2})(\d{2})/.exec(n); if (!m) return;
      var k = m[1]; if ((+m[2]) * 100 + (+m[3]) < 300) k = addDay(k, -1);
      o[k] = 1;
    });
    return o;
  }
  /* submissions_<코드> → 녹음 낸 날 */
  function recDays(list){
    var o = {};
    (list || []).forEach(function(x){
      if (!x || (x.type !== 'recording' && x.type !== 'both')) return;
      var m = /^(\d{8})_/.exec(String(x.id || ''));
      var k = m ? m[1] : (x.submittedAt ? ymdOf(kst(new Date(x.submittedAt))) : '');
      if (k) o[k] = 1;
    });
    return o;
  }
  function recDue(cls){ return function(k){ return k >= REC_DAILY_FROM || cls.indexOf(dow(k)) >= 0; }; }
  function everyDay(){ return true; }
  function streak(has, due){
    var t = todayK(), k = t, cur = 0, started = false, i;
    for (i = 0; i < 500; i++){
      if (due(k)){
        if (has[k]){ cur++; started = true; }
        else if (k === t && !started){ /* 오늘은 마감 전 */ }
        else break;
      }
      k = addDay(k, -1);
    }
    var keys = Object.keys(has).sort(), best = 0, run = 0;
    if (keys.length){ k = keys[0];
      for (i = 0; i < 1200 && k <= t; i++){ if (due(k)){ if (has[k]){ run++; if (run > best) best = run; } else if (k !== t) run = 0; } k = addDay(k, 1); } }
    return { cur: cur, best: Math.max(best, cur), today: !!has[t] };
  }
  function recUnit(){ return todayK() >= REC_DAILY_FROM ? '일' : '회'; }
  return { REC_DAILY_FROM: REC_DAILY_FROM, todayK: todayK, addDay: addDay, dow: dow, classDays: classDays,
           plannerDays: plannerDays, recDays: recDays, recDue: recDue, everyDay: everyDay, streak: streak, recUnit: recUnit };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = STK;
