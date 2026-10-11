/* ═══════════════════════════════════════════════════════════════════
 * v19-108: 🎯 적중 분석 난이도 = 수학비서 난이도(1~9)
 *   원장 지적 2026-10-11: 「난이도는 수학비서 난이도가 아닌가? 기출은 수학비서에서 난이도 표시를 해 놓았다. 1-9 까지이다.」
 *  [까닭] 서버(워커)는 기출 DB 시험지에서 문항별 수학비서 난이도(it.diff, 1~9)를 이미 받아 두고 킬러도 «수학비서 6 이상»으로
 *         정하는데, 결과 화면 요약·학부모 보고서·블로그 자료·요약 복사는 매쓰플랫 난도(it.level, 1~5)로 평균을 내고
 *         「킬러 (난도 4·5)」라고 적고 있었다.
 *  [고침] 시험 문항의 절반 이상에 수학비서 난이도가 있으면 평균 난도 = 수학비서 평균 «/9», 킬러 = 수학비서 6 이상,
 *         「어려움(5 이상)」 수도 함께. 수학비서 난이도가 없는 시험(사진으로 올린 시험지)은 지금처럼 매쓰플랫 «/5».
 *  ※ 문자열 연결만 쓴다. 바탕 함수는 감싸기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var MSD_KILL = 6, MSD_HARD = 5;
function msdInfo(d){
  var v = (typeof htVisible === 'function') ? htVisible(d) : ((d && d.items) || []);
  var xs = v.map(function(it){ return it.diff == null || it.diff === '' ? null : Number(it.diff); }).filter(function(x){ return x != null && !isNaN(x); });
  if (!v.length || xs.length * 2 < v.length) return null;
  var sum = xs.reduce(function(a, b){ return a + b; }, 0);
  return { avg: Math.round(sum / xs.length * 10) / 10, kill: xs.filter(function(x){ return x >= MSD_KILL; }).length, hard: xs.filter(function(x){ return x >= MSD_HARD; }).length, n: xs.length };
}
/* 요약 수치 — 수학비서 난이도가 있으면 평균·킬러를 그것으로 */
htStats = (function(o){ return function(d){
  var s = o(d); var m = msdInfo(d);
  if (m) { s.levelAvg = m.avg; s.killers = m.kill; s.hard = m.hard; s.lvMax = 9; s.lvSrc = 'ms'; }
  else { s.lvMax = 5; s.lvSrc = 'mf'; }
  return s; }; })(htStats);
/* 글자 바꾸기 — «/5» · 「킬러 (난도 4·5)」 → 수학비서 기준 */
function msdFix(txt, d){
  var m = msdInfo(d); if (!m) return txt;
  return String(txt)
    .split('<small style="font-size:12px;color:#94a3b8">/5</small></b><span>평균 난도</span>').join('<small style="font-size:12px;color:#94a3b8">/9</small></b><span>평균 난도 (수학비서 1~9)</span>')
    .split('☠ 킬러 (난도 4·5)').join('☠ 킬러 (수학비서 ' + MSD_KILL + ' 이상) · 어려움(' + MSD_HARD + '↑) ' + m.hard)
    .split('<small>/5</small></b>평균 난도').join('<small>/9</small></b>평균 난도 (수학비서)')
    .split(' / 5 · 킬러(난도 4~5) ').join(' / 9 (수학비서 난이도) · 킬러(수학비서 ' + MSD_KILL + ' 이상) ')
    .split('/5 · 킬러 ').join('/9(수학비서) · 킬러 ');
}
htSummaryHtml = (function(o){ return function(d){ return msdFix(o(d), d); }; })(htSummaryHtml);
htMd = (function(o){ return function(d){ return msdFix(o(d), d); }; })(htMd);
window.htPrint = (function(o){ return function(code){
  var d = HT.data[HT.cur], ow = window.open;
  window.open = function(){ var w = ow.apply(window, arguments); if (w && d) { try { var doc = w.document, wr = doc.write.bind(doc); doc.write = function(x){ return wr(msdFix(String(x), d)); }; } catch (e) {} } return w; };
  try { return o(code); } finally { window.open = ow; } }; })(window.htPrint);
window.htCopy = (function(o){ return function(){
  var d = HT.data[HT.cur], cw = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
  if (cw && d) { try { navigator.clipboard.writeText = function(t){ return cw(msdFix(String(t), d)); }; } catch (e) {} }
  try { return o(); } finally { if (cw) { try { navigator.clipboard.writeText = cw; } catch (e) {} } } }; })(window.htCopy);
