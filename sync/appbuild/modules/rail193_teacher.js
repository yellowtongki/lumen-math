/* ═══════════════════════════════════════════════════════════════════
 * v19-193: 🛠 오른쪽 도구 띠 2배 · 글자 이름 · 리커버리 «카드 ↔ 줄 표» 단추를 띠에 바로
 *   (원장 2026-11-14 「리커버리 예전 버전 카드로 변환하는 버튼이 안 보인다. 오른쪽 도구에 버튼 만들고,
 *    오른쪽 도구함 전체적으로 잘 보이게 2배 크기로」)
 *  [까닭] v19-189 에서 «보기 방식»을 도구함 «안»에 넣었는데, 도구함이 접혀 있으면 오른쪽 끝 44px 띠에
 *         작은 그림(👤📝🛠…)만 보여 어디를 눌러야 하는지 알 수 없었다.
 *  [고침] ① 띠 폭 44 → 88px · 단추 32 → 64×56px · 그림 16 → 24px · 그림 밑에 이름(학생·규칙·만들기 …)
 *         ② 리커버리 화면에선 띠 맨 위에 «🗂 카드 보기» / «☰ 줄 표» 단추 — 도구함을 열지 않고 한 번에 바꾼다
 *         ③ 펼친 도구함 폭은 그대로 2배(≈600px) + 띠 88px
 *  PC 1280px 이상에서만(그보다 좁으면 예전처럼 둥근 단추). ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  try {
    var st = document.createElement('style');
    st.textContent = '@media(min-width:1280px){'
      + '.tool-panel.l3-rail{width:88px!important;min-width:88px!important}'
      + '.tool-panel.l3-rail.l3-rail-open{width:min(688px,46vw)!important;min-width:min(688px,46vw)!important}'
      + '.l3-rbar{width:88px!important;gap:8px!important;padding:12px 0!important}'
      + '.l3-ric{width:72px!important;height:58px!important;border-radius:12px!important;font-size:24px!important;flex-direction:column!important;gap:3px!important;line-height:1!important}'
      + '.l3-ric .r193-t{display:block;font-size:11.5px;font-weight:900;color:#334155;letter-spacing:-.02em;white-space:nowrap}'
      + '.l3-ric.on .r193-t{color:#fff}'
      + '.l3-ric.r193-view{background:#fff7ed!important;border:2px solid #ea580c!important;height:64px!important}'
      + '.l3-ric.r193-view .r193-t{color:#c2410c}'
      + '.l3-ric.r193-view:hover{background:#ffedd5!important}'
      + '.l3-rlb{font-size:12px!important;margin-top:6px!important}'
      + '}';
    (document.head || document.documentElement).appendChild(st);
  } catch(e){}
})();
var R193_NAME = { stu:'학생', rule:'규칙', make:'만들기', sms:'안내문', print:'인쇄', acct:'계정', tools:'도구' };
function r193ViewBtn(){
  var mode = 'table'; try { mode = rb174View().mode || 'table'; } catch(e){}
  var toCards = mode !== 'cards';
  return '<button type="button" class="l3-ric r193-view" data-l3-ric="view" data-r193-to="' + (toCards ? 'cards' : 'table') + '"'
    + ' title="' + (toCards ? '예전 카드 보드로 보기' : '줄 표로 돌아가기') + '" aria-label="' + (toCards ? '카드 보기' : '줄 표') + '"'
    + ' onclick="rv189Mode(\'' + (toCards ? 'cards' : 'table') + '\')">' + (toCards ? '🗂' : '☰') + '<span class="r193-t">' + (toCards ? '카드 보기' : '줄 표') + '</span></button>';
}
if (typeof rb174RailIcons === 'function') rb174RailIcons = (function(orig){ return function(v){
  var h = String(orig.apply(this, arguments));
  /* 단추마다 그림 밑에 이름 */
  h = h.replace(/(<button type="button" class="l3-ric[^"]*" data-l3-ric="([a-z]+)"[^>]*>)([\s\S]*?)(<\/button>)/g, function(all, open, id, ic, close){
    var nm = R193_NAME[id]; return nm ? open + ic + '<span class="r193-t">' + nm + '</span>' + close : all;
  });
  var rcOk = false; try { rcOk = v === 'recovery' && RC && RC.loaded && typeof rv189Mode === 'function'; } catch(e){}
  return rcOk ? r193ViewBtn() + h : h;
}; })(rb174RailIcons);
