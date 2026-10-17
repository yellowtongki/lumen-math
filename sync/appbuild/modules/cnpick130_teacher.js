/* ═════════════════════════════════════════════════════════════════
 * v19-130: 🎯 문항별 적중 카드 «자동 선택» + 고르는 칸을 카드뉴스 설정 맨 위로 (원장 2026-10-17 「모자이크 기능이 사라졌다」)
 *
 *  왜: 문항 카드(08_1번적중 …)와 그 카드의 「🧩 모자이크」 칩은 원장님이 「🎯 문항별 적중 카드」 칸에서 고른 문항(card.picks)에만 생긴다.
 *      그런데 모든 시험의 picks 가 비어 있었고, 그 칸은 아주 긴 설정 칸(약 9700px)의 아래쪽에 있어 보이지 않았다 → «모자이크가 없어졌다»고 느낌.
 *
 *  ① 자동 선택: 시험의 card.picks 가 비어 있으면 카드뉴스는 «적중 문항 상위 4개»를 쓴다
 *       (cnRows 의 r.inB 인 문항 · 같은 문제 → 숫자변형 → (text) → 유사유형 순 · 같으면 번호 작은 것부터).
 *     카드를 만드는 곳(cnCards · cn2Cards — 화면 미리보기 · .zip 내려받기 · 블로그 폴더 · 블로그자료.md 가 모두 이 둘을 거친다)을
 *     감싸서, 부르는 동안만 c.picks 에 자동 목록을 잠깐 넣었다가 원래대로(빈 목록) 돌려놓는다 → 서버에는 저장하지 않는다.
 *     원장님이 칩을 처음 누르면 그때 자동 목록을 c.picks 에 옮겨 적고, 누른 것을 넣고/빼고, 저장한다(직접 고르기 시작).
 *     「자동으로 되돌리기」 칩 = c.picks=[] 저장. (직접 고른 것을 다 빼도 다시 자동이 된다.)
 *  ② 「🎯 문항별 적중 카드」 칸을 설정 맨 위(첫 안내 글 바로 아래, 「🎨 색」 위)로 옮긴다.
 *     v19-128(hitreview128)이 그 칸 바로 앞에 넣는 🤖 AI 안내 줄도 함께 옮긴다. 칸 제목 글자는 그대로 둔다(다른 부품이 이 글자로 찾는다).
 *     아래에 한 줄: 「문항 카드마다 🧩 모자이크 칩이 붙습니다 …」
 *  검사 sync/appbuild/tests/test_v19130.js
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 이전 부품은 고치지 않고 감싸기만 한다.
 * ═════════════════════════════════════════════════════════════════ */
var CNP130_ORD = { same:0, 'var':1, text:2, type:3, none:4 };
var CNP130_MAX = 4;
var CNP130_MK = '<div class="ht-h">🎯 문항별 적중 카드';

/* 자동으로 고른 문항 번호(it.no) — 적중 문항 상위 4개 */
function cnp130Auto(d){
  if(!d) return [];
  var R=[]; try{ R=cnRows(d); }catch(e){ return []; }
  return R.filter(function(r){ return r.inB; }).sort(function(a, b){
    var ka=CNP130_ORD.hasOwnProperty(a.kind)?CNP130_ORD[a.kind]:9, kb=CNP130_ORD.hasOwnProperty(b.kind)?CNP130_ORD[b.kind]:9;
    return (ka-kb) || ((+a.n||0)-(+b.n||0)); }).slice(0, CNP130_MAX).map(function(r){ return r.no; });
}
/* 원장님이 직접 고른 문항이 있나 (저장된 card.picks) */
function cnp130Manual(d){ var c=d&&d.card; return !!(c && c.picks && c.picks.length); }
/* 지금 카드에 쓰이는 문항 (직접 고른 것 · 없으면 자동) */
function cnp130Picks(d){ return cnp130Manual(d) ? d.card.picks.slice() : cnp130Auto(d); }
window.cnp130Picks=cnp130Picks;

/* fn 을 부르는 동안만 c.picks 에 자동 목록을 넣는다 (서버 저장 없음 · 끝나면 원래 빈 목록으로) */
function cnp130With(d, fn){
  if(!d) return fn();
  var c=cnCfg(d); if(c.picks && c.picks.length) return fn();
  var A=cnp130Auto(d); if(!A.length) return fn();
  var keep=c.picks; c.picks=A;
  try{ return fn(); } finally { if(c.picks===A) c.picks=keep; }
}
if(typeof cnCards==='function') cnCards=(function(o){ return function(d){ var self=this, a=arguments; return cnp130With(d, function(){ return o.apply(self, a); }); }; })(cnCards);
if(typeof cn2Cards==='function') cn2Cards=(function(o){ return function(d){ var self=this, a=arguments; return cnp130With(d, function(){ return o.apply(self, a); }); }; })(cn2Cards);

/* 칩을 누르면: 자동 상태였다면 자동 목록을 먼저 옮겨 적고 → 넣기/빼기 → 저장 (원래 cnToggleNo) */
if(typeof window.cnToggleNo==='function') window.cnToggleNo=(function(o){ return function(k, no, max){
  if(k!=='picks') return o.apply(this, arguments);
  var d=HT.data[HT.cur]; if(!d) return;
  var c=cnCfg(d);
  if(!(c.picks && c.picks.length)){
    var A=cnp130Auto(d);
    if(A.length){
      if(A.indexOf(no)<0 && max && A.length>=max){ htToast('자동으로 고른 문항이 이미 '+max+'개예요 — 먼저 하나를 빼고 골라 주세요'); return; }
      c.picks=A.slice();
    }
  }
  return o.apply(this, arguments); }; })(window.cnToggleNo);
window.cnp130Reset=function(){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); c.picks=[]; cnSave(d); htToast('🎯 문항 카드를 자동 선택으로 되돌렸어요 — 적중 문항 상위 '+cnp130Auto(d).length+'개'); render(); };

/* 문자열 h 의 i 위치 <div …> 가 닫히는 곳(</div> 다음 자리) */
function cnp130DivEnd(h, i){
  var re=/<div\b|<\/div>/g, dep=0, m; re.lastIndex=i;
  while((m=re.exec(h))){ if(m[0]==='</div>'){ dep--; if(dep===0) return m.index+6; } else dep++; }
  return -1;
}
/* 🎯 칸을 잘라 맨 위로 옮기고, 자동 선택 줄 · 되돌리기 칩 · 모자이크 안내를 붙인다 */
function cnp130Move(h, manual, nAuto){
  var i=h.indexOf(CNP130_MK); if(i<0) return h;
  var start=i, ai=h.lastIndexOf('<div class="ht-sub" id="hv-cn-ai"', i);
  if(ai>=0 && cnp130DivEnd(h, ai)===i) start=ai;   /* 🤖 AI 안내 줄(v19-128)이 바로 앞에 붙어 있으면 같이 옮긴다 */
  var hEnd=cnp130DivEnd(h, i); if(hEnd<0 || h.slice(hEnd, hEnd+4)!=='<div') return h;
  var end=cnp130DivEnd(h, hEnd); if(end<0) return h;
  var blk=h.slice(start, end-6);   /* 칩 칸이 닫히기 직전까지 */
  if(manual) blk+='<button class="cn-chip" id="cnp130-reset" data-cnp130="reset" style="border-style:dashed" title="직접 고른 것을 지우고 적중 문항 상위 4개로" onclick="cnp130Reset()">↺ 자동으로 되돌리기</button>';
  blk+='</div>';
  if(!manual && nAuto) blk+='<div class="ht-sub" id="cnp130-auto" style="margin:-4px 0 4px;color:#1d4ed8;font-weight:800">자동 선택: 적중 문항 상위 '+nAuto+'개 (직접 고르면 그대로 따릅니다)</div>';
  /* 10/17 원장 「어디에 모자이크가 있다는 말인가?」 — 원장님 기기가 「지금 스타일」(옛 카드)이었다. 🧩 모자이크·선명/흐리게·🖼 배경은 «✨ 새 스타일» 카드에만 붙는다 */
  if(typeof CN!=='undefined' && CN.style==='v1') blk+='<div class="ht-sub" id="cnp130-v1" style="margin-bottom:12px;padding:8px 10px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-weight:800">⚠ 지금은 «지금 스타일»(옛 카드)이라 🧩 모자이크 칩이 안 보입니다. 모자이크·선명/흐리게는 새 스타일 카드에만 있어요 '
    +'<button class="cn-chip on b" data-cnp130="v2" style="margin-left:6px" onclick="cn2Set(\'style\',\'v2\')">✨ 새 스타일로 바꾸기</button></div>';
  else blk+='<div class="ht-sub" id="cnp130-hint" style="margin-bottom:12px">문항 카드마다 🧩 모자이크 칩이 붙습니다 — 아래 카드 목록에서 «N · NN_N번적중.png» 이름 옆 「🧩 모자이크」를 누르면 그림 위에 상자를 그려 가릴 수 있어요</div>';
  blk='<div id="cnp130-sec">'+blk+'</div>';
  var rest=h.slice(0, start)+h.slice(end);
  var at=rest.indexOf('<div class="ht-h">🎨 색');
  if(at<0){ var s0=rest.indexOf('<div class="ht-sub" style="margin-bottom:10px">문항·색'); if(s0>=0) at=cnp130DivEnd(rest, s0); }
  if(at<0) return h.slice(0, start)+blk+h.slice(end);   /* 자리를 못 찾으면 제자리에 */
  return rest.slice(0, at)+blk+rest.slice(at);
}
if(typeof cnPanelHtml==='function') cnPanelHtml=(function(o){ return function(d){
  var self=this, a=arguments, manual=cnp130Manual(d), nAuto=manual?0:cnp130Auto(d).length;
  var h=cnp130With(d, function(){ return o.apply(self, a); });
  return cnp130Move(h, manual, nAuto); }; })(cnPanelHtml);
