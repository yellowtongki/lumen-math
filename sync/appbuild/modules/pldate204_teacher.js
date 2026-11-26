/* ═══════════════════════════════════════════════════════════════════
 * v19-204: 📓 플래너 날짜 «연도 오독» 바로잡기 (원장 2026-11-26 「날짜 오독 보완도 해서 배포」)
 *  김○○ 11/16 플래너를 AI가 «2025.11.16»으로 읽어 → 10월판 점수 규칙이 안 걸리고(2026-10-01 이전으로 봄) «365일 지각» → 점수 0 · 분석 멈춤.
 *  학생은 연도를 안 쓰거나 작게 써서 AI가 연도를 짐작한다. 그래서:
 *   AI가 읽은 날짜가 «제출로 본 날짜(expectedDate)»와 연도만 1년 다르고, 연도를 맞추면 3일 안이면 → 연도를 제출 연도로 고친다(dateNext 도 같이).
 *   고쳤으면 analysis.yearFixed = '2025→2026' 을 남긴다. 그 밖(날짜가 정말 다른 경우)은 그대로 — 다른 날짜 검사(plzCheck)는 그대로 동작.
 *  plV3Apply(10월판 점수) 앞에서 고친다 → 바로 뒤 plzCheck·지각 계산도 고친 날짜로 한다. 서버 새벽 채점기(sync/planner_night_grader.js)도 같은 규칙.
 * ═══════════════════════════════════════════════════════════════════ */
function plYearFix(analysis, expectedDate){
  if(!analysis || !analysis.date) return false;
  var re=/(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/, a=String(analysis.date).match(re), e=String(expectedDate||'').match(re);
  if(!e){ var m=String(expectedDate||'').match(/^(\d{4})(\d{2})(\d{2})/); if(m) e=[m[0],m[1],m[2],m[3]]; }
  if(!a || !e) return false;
  var ay=+a[1], ey=+e[1]; if(Math.abs(ay-ey)!==1) return false;
  var fixed=Date.UTC(ey, +a[2]-1, +a[3]), exp=Date.UTC(ey, +e[2]-1, +e[3]);
  if(Math.abs(fixed-exp) > 3*86400000) return false;
  function pad(n){ return (n<10?'0':'')+n; }
  analysis.date=ey+'.'+pad(+a[2])+'.'+pad(+a[3]);
  var n=String(analysis.dateNext||'').match(re);
  if(n && +n[1]===ay) analysis.dateNext=(+n[1]+(ey-ay))+'.'+pad(+n[2])+'.'+pad(+n[3]);
  analysis.yearFixed=ay+'→'+ey;
  return true;
}
window.plYearFix=plYearFix;
if(typeof window.plV3Apply==='function') window.plV3Apply=(function(o){ return function(analysis, expectedDate){
  try{ plYearFix(analysis, expectedDate); }catch(e){}
  return o.apply(this, arguments);
}; })(window.plV3Apply);
try{ if(typeof plV3Apply!=='undefined') plV3Apply=window.plV3Apply; }catch(e){}
