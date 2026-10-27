/* ═══════════════════════════════════════════════════════════════════
 * v19-144: 💡 IB아하노트 — 「8점 이상 확정」 → 「전부 확정」 · 학생이 나중에 올린 스스로 해결을 초안에 맞추기
 * 원장 2026-10-21 「질문은 8점이상 확정말고 전부 확정하자. 아하리그 시작부터 이제까지 점수반영이 안된 것 같다.
 *   학생앱에서 스스로 고쳤으면 학원앱 아하노트에서 학생이 스스로 고쳤다고 체크가 안되는 것 같다」
 *  점검(서버): 시즌(9/7~11/30) 노트 126건 중 확정 34 · AI 초안만 89 · 초안 없음 3 — 리그는 «확정»만 센다.
 *    8점 미만 초안은 일괄 확정에서 빠져 계속 쌓였다 → 단추 문구·조건은 build_app.py(>=144) 가 바꾼다.
 *  스스로 해결: AI 초안을 만든 «뒤에» 학생이 🙋 스스로 해결을 올리면 초안의 해결 경로(path)가 'none' 으로 남아
 *    채점 칸의 「🙋 스스로 해결」 칩이 꺼져 있고 확정해도 보너스가 안 붙었다(예: 9/20 노트 — 초안 9/22, 스스로 해결 9/24).
 *    → 확정 전이고 원장이 손대지 않은 AI 초안(by:'ai')이면 노트의 지금 경로(ibqPathOf)로 맞추고 보너스를 다시 센다.
 *       채점 작업대를 열 때 · 일괄 확정·하루 확정·한 줄 확정 직전에. 바뀐 것이 있으면 aha_scores 에 한 번 저장.
 *  ※ 바탕 함수를 감싸기만 한다. 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var A144 = { saving:false };
/* 노트 하나 — 바뀌었으면 true */
function a144Sync(n){
  if(!n || !n.id) return false;
  var d=IBQ_SCORES[n.id];
  if(!d || d.status==='final' || d.by!=='ai') return false;
  var p; try{ p=ibqPathOf(n); }catch(e){ return false; }
  if(!p || p==='none' || d.path===p) return false;
  d.path=p;
  try{ ibqApplyBonus(d, n); }catch(e){}
  return true;
}
/* 전부 — 바뀐 수 */
function a144SyncAll(){
  var c=0;
  try{ (ahaNotes||[]).forEach(function(n){ if(a144Sync(n)) c++; }); }catch(e){}
  return c;
}
window.a144SyncAll=a144SyncAll;
function a144SaveIf(c){
  if(!c || A144.saving) return Promise.resolve();
  A144.saving=true;
  return Promise.resolve(ibqSaveScores()).then(function(){ A144.saving=false; }, function(){ A144.saving=false; });
}
/* 채점 작업대를 그릴 때 */
wbMain=(function(o){ return function(){ try{ a144SaveIf(a144SyncAll()); }catch(e){} return o.apply(this, arguments); }; })(wbMain);
/* 확정 직전에 */
['ibqBulkConfirm','wbConfirmDay','wbConfirm'].forEach(function(nm){
  var o=window[nm]; if(typeof o!=='function') return;
  window[nm]=function(){ try{ a144SyncAll(); }catch(e){} return o.apply(this, arguments); };
});
