/* ═══════════════════════════════════════════════════════════════
 * v19-141: 💾 PC 저장 공간 줄이기 — 「저장 공간이 가득 찼습니다」 (원장 2026-10-20 「예전 리포트 저장을 적게 하자. 느려진다」)
 *   실측(서버 1,522개 키): 앱이 시작할 때 받는 것 45MB · 그중 PC 디스크에 쓰는 것 약 20MB.
 *   ① 루멘 분석기 글자 은행 ptx_* 약 6.7MB · analyzer_report_* 0.25MB — 학원앱은 쓰지 않는다(10/18 새로 생김)
 *   ② 적중 분석 exam_hit_* 약 1MB · 단원 트리 mf_tree_* 약 45MB(메모리) — 화면이 서버에서 바로 읽는다(htKv · 트리 get)
 *   ③ 예전 달 리포트·피드백 서랍(or_students_YYYY-MM · lumen_comments_YYYY-MM) — 3달 넘은 것은 디스크에 두지 않는다
 *   → ①② 시작 다운로드에서 빼고(PULL_SKIP_PREFIX) 디스크 사본도 지운다. ③ 는 «메모리 전용»(isMemOnlyKey)이라
 *     전과 똑같이 받아서 화면·클라우드 동기화는 그대로, PC 디스크에만 안 쓴다.
 *   backup_* (서버 백업) 도 시작 때 받지 않는다.
 * ═══════════════════════════════════════════════════════════════ */
(function(){
  var SKIP = ['ptx_', 'analyzer_report_', 'exam_hit_', 'mf_tree_', 'backup_'];
  try { SKIP.forEach(function(p){ if (PULL_SKIP_PREFIX.indexOf(p) < 0) PULL_SKIP_PREFIX.push(p); }); } catch(e){}
  var KEEP_MONTHS = 3;   /* 이번 달 포함 최근 3달만 디스크에 */
  function oldDrawer(k){
    var m = /^(or_students|lumen_comments)_(\d{4})-(\d\d)$/.exec(k); if (!m) return false;
    var d = new Date(), cur = d.getFullYear() * 12 + d.getMonth(), km = (+m[2]) * 12 + (+m[3] - 1);
    return cur - km >= KEEP_MONTHS;
  }
  var base = isMemOnlyKey;
  isMemOnlyKey = function(k){
    k = String(k || '');
    return base(k) || SKIP.some(function(p){ return k.indexOf(p) === 0; }) || oldDrawer(k);
  };
  window.lumenOldDrawer = oldDrawer;
  /* 켜질 때 한 번: 이제 메모리 전용이 된 키의 디스크 사본 → 메모리로 옮기고 디스크에서 지운다 (화면은 메모리를 먼저 읽어 그대로) */
  var freed = 0, n = 0;
  try {
    Object.keys(localStorage).forEach(function(k){
      if (!isMemOnlyKey(k)) return;
      var v = _origGetItem(k); if (v === null) return;
      var skip = SKIP.some(function(p){ return k.indexOf(p) === 0; });
      if (!skip && _memStore[k] === undefined) _memStore[k] = v;   /* 옛 서랍은 메모리에 — 받지 않는 키(①②)는 버린다(서버에 있다) */
      freed += v.length; n++;
      _origRemoveItem(k);
    });
  } catch(e){}
  window.__store141 = { freedKB: Math.round(freed / 1024), keys: n, at: new Date().toISOString() };
  if (n) try { console.log('[v19-141] PC 저장 공간 정리: ' + n + '개 키 · ' + Math.round(freed / 1024) + 'KB 비움'); } catch(e){}
})();
