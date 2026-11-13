/* ═══════════════════════════════════════════════════════════════════
 * v19-190: 🚑 리커버리 — 학생 서랍에 그 학생 안내문 · 고른 학생 «학생별 예상» 줄 노랗게
 *   (원장 2026-11-13 「학생별 안내문이 보이게 하자. 개별 화면에서 · ○○○이 안 보인다」)
 *  ① 오른쪽 서랍(학생)의 «동작» 위에 «📨 학부모 안내문» — 전체 안내문 창(rcOpenSms)과 같은 글(r145Text)을 그 학생 것만 바로 보여 준다.
 *     칸에서 고쳐 쓸 수 있고 «📋 이 글 복사» · «📨 전체 안내문 창». 호출 확정(완료 전) 학생만.
 *  ② «학생별 예상» 표는 호출 확정 순서라 줄 표와 순서가 달라 찾기 어렵다 → 서랍에서 고른 학생 줄을 노랗게 + «◀ 지금 보는 학생».
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
function rv190NoteBox(k){
  var c = null; try { c = rcConfirmed().filter(function(x){ return String(x.k) === String(k); })[0]; } catch(e){}
  if (!c || (c.e && c.e.done)) return '';
  var txt = ''; try { txt = r145Text(c); } catch(e){ return ''; }
  var id = 'l3r-note-' + String(k).replace(/[^A-Za-z0-9_\-]/g, '');
  return '<div class="rb174-sec" data-rv190-note="' + esc2(String(k)) + '"><span class="rb174-st">📨 학부모 안내문 <small style="color:#94a3b8;font-weight:700">· 고쳐서 복사할 수 있어요 (보내지지 않음)</small></span>'
    + '<textarea id="' + id + '" style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 10px;font-family:inherit;font-size:12.5px;line-height:1.7;color:#334155;min-height:150px;resize:vertical">' + esc2(txt) + '</textarea>'
    + '<div class="rb174-row"><button type="button" class="l3-btn pri" data-rv190-copy="1" onclick="rv190Copy(\'' + id + '\')">📋 이 글 복사</button>'
    + '<button type="button" class="l3-btn" onclick="rcOpenSms()">📨 전체 안내문 창</button></div></div>';
}
window.rv190Copy = function(id){
  var ta = document.getElementById(id); if (!ta) return;
  var v = ta.value, done = function(ok){ try { plToast(ok ? '📋 안내문을 복사했어요 — 문자앱에 붙여 넣어 보내세요' : '복사가 막혔어요 — 글을 길게 눌러 복사하세요'); } catch(e){} };
  try { navigator.clipboard.writeText(v).then(function(){ done(true); }, function(){ try { ta.select(); done(document.execCommand('copy')); } catch(e){ done(false); } }); }
  catch(e){ try { ta.select(); done(document.execCommand('copy')); } catch(e2){ done(false); } }
};
if (typeof rb174StuPanel === 'function') rb174StuPanel = (function(orig){ return function(k, pop){
  var h = orig.apply(this, arguments);
  try { var box = rv190NoteBox(k); var a = '<div class="rb174-sec rb174-acts">'; if (box) h = h.indexOf(a) >= 0 ? h.replace(a, box + a) : h + box; } catch(e){}
  return h;
}; })(rb174StuPanel);
/* 고른 학생 줄 노랗게 */
function rv190Mark(h, sel){
  if (!sel) return h;
  var a = '<tr data-rw155-est="' + esc2(String(sel)) + '">';
  if (h.indexOf(a) < 0) return h;
  h = h.replace(a, '<tr data-rw155-est="' + esc2(String(sel)) + '" data-rv190-sel="1" style="background:#fef9c3;outline:2px solid #facc15">');
  return h;
}
if (typeof rw155EstTable === 'function') rw155EstTable = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try { if (RB174 && RB174.kind === 'stu' && RB174.sel) h = rv190Mark(h, RB174.sel); } catch(e){}
  return h;
}; })(rw155EstTable);
