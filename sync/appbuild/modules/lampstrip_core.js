/* ═══ LAMP 활동지 «인쇄된 칸 이름» 빼기 — 학생앱(v2-148)·학원앱(v19-151)·엣지 함수 aha-read 가 같은 규칙 ═══
 * 원장 2026-10-22 「칸 이름은 빼도록 고쳐줘」. 학생이 칸을 비워 두면 AI 가 인쇄된 제목
 *   «Learn the question (문제를 정확히 이해하기)» «Pinpoint your confusion (…) - 모르겠다» 를 학생 글로 옮겼다.
 * 영어 제목(인쇄라 잘 읽힘) + 바로 뒤 괄호 설명 + 이어 붙은 «-»·«:» 를 줄마다 떼고, 남은 것이 없으면 그 칸은 빈칸(unread)으로. */
var LAMP_HEAD_RE = /^\s*(?:[LAMP]\s*[.:)\-]?\s*)?(?:learn\s+the\s+question|activate\s+(?:your\s+)?knowledge|model\s+your\s+reasoning|pinpoint\s+your\s+confusion)\s*(?:\([^)]*\)?)?\s*[-–—:·]?\s*/i;
var LAMP_HEAD_KO_RE = /^\s*\([^)]*(?:이해하기|떠올리기|풀었나요|접근했나요|정리하기|표현하기|집어내)[^)]*\)?\s*[-–—:·]?\s*/;
function lampStripHead(s){
  return String(s == null ? '' : s).split(/\n/).map(function(line){
    return line.replace(LAMP_HEAD_RE, '').replace(LAMP_HEAD_KO_RE, '').trim();
  }).filter(function(x){ return x !== ''; }).join('\n');
}
function lampStripAi(ai){
  if (!ai || typeof ai !== 'object') return ai;
  var un = Array.isArray(ai.unread) ? ai.unread.slice() : [];
  ['L','A','M','P'].forEach(function(k){
    if (ai[k] == null) return;
    var before = String(ai[k]), after = lampStripHead(before);
    if (after !== before.trim()) ai.headStripped = (ai.headStripped || []).concat([k]);
    ai[k] = after;
    if (!after && un.indexOf(k) < 0) un.push(k);
  });
  ai.unread = un;
  return ai;
}
