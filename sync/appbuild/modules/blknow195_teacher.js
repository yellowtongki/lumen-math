/* ═══════════════════════════════════════════════════════════════════
 * v19-195: 🖤 순위표(진도 레이스·리그 한눈에·모바일 레이스) 블랙반 엠블럼 — «지금 기수»만
 *   (원장 2026-11-16 「진도레이스나 주간테스트에서 블랙반은 현재 2기만 엠블럼이 표시되게 · 지금은 1기도 표시」 → 「추천대로」)
 *  [전] blkTinyOf = 지금 기수(마감 안 된 것)가 있으면 그것, 없으면 «지난 기수(출신)» 하나 → 1기 출신에게도 Ⅰ 이 붙었다.
 *       게다가 2기(9/1~12/30)가 «마감»으로 저장돼 있어 2기도 출신 취급이었다.
 *  [후] 지금 기수 = 오늘(한국 날짜)이 그 기수 기간(from~to) 안 — 기간이 없으면 «마감 안 됨»으로 판단.
 *       순위표에는 지금 기수만 · 출신은 안 붙인다. 학생 상세·블랙반 관리 화면(다른 함수)은 그대로.
 * ═══════════════════════════════════════════════════════════════════ */
function blkNowOf(code){
  var cs = []; try { cs = blkCohortsOf(code); } catch(e){ return null; }
  if (!cs.length) return null;
  var today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  var now = cs.filter(function(c){
    var f = String(c.from || '').slice(0, 10), t = String(c.to || '').slice(0, 10);
    if (f || t) return (!f || f <= today) && (!t || today <= t);
    return !c.closed;
  });
  return now.length ? now[now.length - 1] : null;
}
blkTinyOf = function(code, px){
  var c = blkNowOf(code);
  return c ? blkEmblem(c.no, px || 15, false) : '';
};
window.blkNowOf = blkNowOf; window.blkTinyOf = blkTinyOf;
