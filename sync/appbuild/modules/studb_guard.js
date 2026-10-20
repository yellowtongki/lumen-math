/* ═══════════════════════════════════════════════════════════════
 * v19-52: 🛡️ 등록부 유실 자가 치유 — 「유령 세트」 되살리기 (사고 2026-09-27 저녁)
 *   [무슨 일] 기기 저장공간(5MB)이 가득 차자 등록부의 «비상 슬림본»(사진 세트 14일·AI 분석 5일만 남긴 사본)이
 *   메모리 전체본을 덮었고, 그것이 그대로 클라우드에 올라가 9/13 이전 플래너 세트의 승인·분석 기록이 사라졌다.
 *   (점수(lumen_planner)는 날짜 합집합으로 보호돼 그대로다. 사진은 Storage 에 그대로다.)
 *   [증상] 플래너 탭이 Storage 사진 목록으로 세트를 다시 만들면서, 이미 승인했던 세트가 「미검토」로 되살아난다.
 *   [치유] 이틀 넘게 지난 세트가 «분석도 승인도 없는데» 그 날짜(또는 전날)에 플래너 점수가 이미 있으면
 *   = 예전에 승인했던 세트다 → 다시 「승인」으로 표시한다(healed 표시). 새벽 자동 분석 결과가 있으면 먼저 붙인다.
 *   같은 판에서: 큰 서버 키를 기기에 쓰지 않고(isMemOnlyKey 확장), 등록부는 클라우드 병합 전엔 절대 올리지 않으며,
 *   슬림본이 메모리 전체본을 덮지 못하게 했다 (본문 setItem 훅·scheduleSync·safePullSetItem).
 * ═══════════════════════════════════════════════════════════════ */
function plHealGhostSets(onlySt){
  var cut = new Date(Date.now() - 2 * 864e5);
  var cutKey = cut.getFullYear() + String(cut.getMonth()+1).padStart(2,'0') + String(cut.getDate()).padStart(2,'0');
  var n = 0;
  var arr = onlySt ? [onlySt] : (students || []);
  arr.forEach(function(st){
    if (!st || !st.lumen_rec_code || st.withdrawn) return;
    var sc = st.lumen_planner || {};
    (st.lumen_planner_photos || []).forEach(function(p){
      if (!p || !p.setId || p.reviewed || p.analysis || p.analyzing || p.analysisError) return;
      var m = String(p.setId).match(/^(\d{4})(\d{2})(\d{2})_/);
      if (!m) return;
      if (m[1] + m[2] + m[3] >= cutKey) return;                     // 최근 이틀은 진짜 미검토일 수 있다
      var d = new Date(+m[1], +m[2] - 1, +m[3]);
      var k0 = m[1] + '.' + m[2] + '.' + m[3];
      var pv = new Date(d.getTime() - 864e5);
      var k1 = pv.getFullYear() + '.' + String(pv.getMonth()+1).padStart(2,'0') + '.' + String(pv.getDate()).padStart(2,'0');
      if ((sc[k0] === undefined || sc[k0] === null) && (sc[k1] === undefined || sc[k1] === null)) return;
      p.reviewed = true; p.healed = true; p.healedAt = new Date().toISOString();
      n++;
    });
  });
  if (n && !onlySt) { try { saveStudents(); } catch(e) {} console.warn('[등록부 치유] 승인 기록이 사라졌던 플래너 세트 ' + n + '개를 되살렸습니다'); }
  return n;
}
window.plHealGhostSets = plHealGhostSets;
