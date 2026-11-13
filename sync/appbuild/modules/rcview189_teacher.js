/* ═══════════════════════════════════════════════════════════════════
 * v19-189: 🚑 리커버리 — «카드 보기»를 오른쪽 도구함으로 · 도구함 폭 2배 (원장 2026-11-13 「카드로 보기를 하고 다시 돌아가기가 없다 ·
 *   카드보기를 오른쪽 도구함에서 보이게 · 도구함 가로를 2배로 잘 보이게」)
 *  ① 보드 위 보기 칩 줄의 «🗂 카드 보기» 칩을 빼고, 오른쪽 도구함 맨 위에 «🗂 보기 방식 [☰ 줄 표] [🗂 카드]» — 두 화면 어디서나 같은 자리에서 바꾼다
 *  ② 도구함(오른쪽 서랍) 폭 300 → 600px (펼친 띠 344 → 644px) · 화면이 좁으면 화면 폭의 42% 까지 (PC 1280px 이상)
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  try {
    var st = document.createElement('style');
    st.textContent = '@media(min-width:1280px){.tool-panel.l3-rail.l3-rail-open{width:min(644px,42vw)!important;min-width:min(644px,42vw)!important}.l3-rdrawer{width:auto!important}}'
      + '.rv189-seg{display:flex;gap:6px;margin-top:6px}.rv189-seg button{flex:1;border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:10px;padding:9px 6px;font-family:inherit;font-size:13px;font-weight:900;cursor:pointer}'
      + '.rv189-seg button.on{background:#0d2240;color:#fff;border-color:#0d2240}';
    (document.head || document.documentElement).appendChild(st);
  } catch(e){}
})();
function rv189ViewBox(){
  var mode = 'table'; try { mode = rb174View().mode || 'table'; } catch(e){}
  return '<div class="l3-tool" id="rv189-view"><b>🗂 보기 방식</b><span class="l3-sub">줄 표는 반·학년별 한눈에, 카드는 예전 카드 보드</span>'
    + '<div class="rv189-seg"><button type="button" data-rv189="table" class="' + (mode !== 'cards' ? 'on' : '') + '" onclick="rv189Mode(\'table\')">☰ 줄 표</button>'
    + '<button type="button" data-rv189="cards" class="' + (mode === 'cards' ? 'on' : '') + '" onclick="rv189Mode(\'cards\')">🗂 카드</button></div></div>';
}
window.rv189Mode = function(m){ try { if (RC.view !== 'board') RC.view = 'board'; } catch(e){} rb174Set('mode', m === 'cards' ? 'cards' : 'table'); };
if (typeof RIGHT_TOOLS === 'object' && typeof RIGHT_TOOLS.recovery === 'function') RIGHT_TOOLS.recovery = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try { if (!RC.loaded) return h; } catch(e){ return h; }
  var t = '<div class="l3-ttl">도구</div>';
  return h.indexOf(t) === 0 ? t + rv189ViewBox() + h.slice(t.length) : rv189ViewBox() + h;
}; })(RIGHT_TOOLS.recovery);
if (typeof rb174Chips === 'function') rb174Chips = (function(orig){ return function(){
  return String(orig.apply(this, arguments)).replace(/<button[^>]*data-rb174-mode="cards"[^>]*>[^<]*<\/button>/, '');
}; })(rb174Chips);
