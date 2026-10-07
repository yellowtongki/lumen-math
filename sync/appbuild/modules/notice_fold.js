/* ═══════════════════════════════════════════════════════════════════
 * v19-75: 📋 발행한 공지 — 접어서 한 줄 · 학생앱 순서 / 최신순 · 찾기
 * 원장 지시 2026-10-05 「이전에 쓴 글을 찾기가 어렵다. 가운데 글을 아코디언으로 접고,
 *   학생앱에 표시한 순서대로나 최근글부터 나오면 편집하기 쉽겠다」
 *  - 카드는 기본으로 접혀 한 줄(분류·📌·🏠·상태·제목·날짜·읽음·✏️ 수정). 줄을 누르면 예전 카드 그대로 펼친다.
 *  - 「📱 학생앱 순서」: 학생앱과 똑같이 노출 중인 것만 고정 먼저 → 시작일(없으면 쓴 날) 최신순, 번호 1·2·3…
 *    그 아래 예약 · 숨김 · 종료를 같은 순서로 따로 묶는다.
 *  - 「🕘 최신순」: 쓴 날 최신순 (고정·상태 상관없이).
 *  - 🔍 제목·내용 찾기. 기존 공지 저장·발행 방식은 그대로(읽기만 바꿈).
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var NOTICE_SORT = (function(){ try{ return localStorage.getItem('notice_sort')||'app'; }catch(e){ return 'app'; } })();
var NOTICE_OPEN = {};
var NOTICE_Q = '';
function noticeAppKey(n){ return n.startDate || String(n.createdAt||'').slice(0,10); }
function noticeAppCmp(a, b){
  if(!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  var c = noticeAppKey(b).localeCompare(noticeAppKey(a)); if(c) return c;
  return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
}
function noticeRecentCmp(a, b){ return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); }
function noticeMatchQ(n){
  var q = String(NOTICE_Q||'').trim().toLowerCase(); if(!q) return true;
  return (String(n.title||'') + ' ' + String(n.body||'')).toLowerCase().indexOf(q) >= 0;
}
window.noticeSetSort = function(s){ NOTICE_SORT = s; try{ localStorage.setItem('notice_sort', s); }catch(e){} render(); };
window.noticeToggleOpen = function(id){ NOTICE_OPEN[id] = !NOTICE_OPEN[id]; render(); };
window.noticeOpenAll = function(on){ NOTICE_OPEN = {}; if(on) (NOTICE_INDEX||[]).forEach(function(n){ NOTICE_OPEN[n.id] = true; }); render(); };
window.noticeSearch = function(v){ NOTICE_Q = v; var el = document.getElementById('notice-list'); if(el) el.innerHTML = noticeListInner2(); };

function noticeToolbarHtml(){
  var chip = function(k, t){ var on = NOTICE_SORT===k; return '<button onclick="noticeSetSort(\'' + k + '\')" style="font-size:12px;font-weight:800;border:1px solid ' + (on?'#0d2240':'#e2e8f0') + ';background:' + (on?'#0d2240':'#fff') + ';color:' + (on?'#fff':'#475569') + ';border-radius:999px;padding:5px 12px;cursor:pointer;font-family:inherit">' + t + '</button>'; };
  var anyOpen = Object.keys(NOTICE_OPEN).some(function(k){ return NOTICE_OPEN[k]; });
  return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'
    + chip('app', '📱 학생앱 순서') + chip('recent', '🕘 최신순')
    + '<input type="search" placeholder="🔍 제목·내용 찾기" value="' + noticeEsc(NOTICE_Q) + '" oninput="noticeSearch(this.value)" style="flex:1;min-width:150px;font-size:12.5px;border:1px solid #e2e8f0;border-radius:9px;padding:6px 10px;font-family:inherit;outline:none">'
    + '<button onclick="noticeOpenAll(' + (anyOpen?'false':'true') + ')" style="font-size:12px;font-weight:700;border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:9px;padding:6px 10px;cursor:pointer;font-family:inherit">' + (anyOpen?'▲ 모두 접기':'▼ 모두 펼치기') + '</button>'
    + '</div>';
}

/* 접힌 한 줄 */
function noticeRow(n, no){
  var cat = n.category || { name:'일반', color:'#6b7280' };
  var st = noticeStatusLabel(n), rc = noticeReadCount(n);
  var editing = NOTICE_FORM && NOTICE_FORM.id === n.id;
  var dim = (!n.visible || st.t==='종료');
  var d = String(n.createdAt||'').slice(5,10).replace('-', '.');
  var h = '<div onclick="noticeToggleOpen(\'' + n.id + '\')" title="눌러서 펼치기" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;background:#fff;border:1px solid ' + (editing?'#1d6fe8':'#e7e9ef') + ';border-left:4px solid ' + cat.color + ';border-radius:11px;padding:9px 12px;margin-bottom:7px;cursor:pointer' + (dim?';opacity:0.6':'') + (editing?';box-shadow:0 0 0 2px #bfdbfe':'') + '">';
  h += '<span style="min-width:22px;text-align:center;font-size:12px;font-weight:900;color:' + (no?'#1d6fe8':'#cbd5e1') + ';font-variant-numeric:tabular-nums">' + (no||'·') + '</span>';
  h += '<span style="font-size:10.5px;font-weight:800;color:#fff;background:' + cat.color + ';padding:2px 7px;border-radius:9px;flex-shrink:0">' + noticeEsc(cat.name) + '</span>';
  if(n.pinned) h += '<span style="font-size:11px;flex-shrink:0">📌</span>';
  if(n.home) h += '<span style="font-size:11px;flex-shrink:0" title="학생앱 홈">🏠</span>';
  h += '<span style="font-size:10.5px;font-weight:700;color:' + st.c + ';background:' + st.bg + ';padding:2px 7px;border-radius:9px;flex-shrink:0">' + st.t + '</span>';
  if(editing) h += '<span style="font-size:10.5px;font-weight:800;color:#fff;background:#1d6fe8;padding:2px 7px;border-radius:9px;flex-shrink:0">✏️ 수정 중</span>';
  h += '<span style="flex:1 1 180px;min-width:0;font-size:13.5px;font-weight:800;color:#0d2240;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + noticeEsc(n.title||'(제목 없음)') + '</span>';
  h += '<span style="font-size:11px;color:#94a3b8;font-weight:700;flex-shrink:0;font-variant-numeric:tabular-nums">' + d + '</span>';
  h += '<span style="font-size:11px;color:#475569;font-weight:800;flex-shrink:0;font-variant-numeric:tabular-nums" title="읽은 학생">👀 ' + rc.read + '/' + rc.total + '</span>';
  h += '<button onclick="event.stopPropagation();noticeEdit(\'' + n.id + '\')" style="font-size:11.5px;font-weight:800;border:1px solid #e7e9ef;background:#fff;color:#475569;border-radius:7px;padding:4px 8px;cursor:pointer;font-family:inherit;flex-shrink:0">✏️ 수정</button>';
  h += '<span style="font-size:11px;color:#94a3b8;flex-shrink:0">▼</span>';
  return h + '</div>';
}
/* 펼친 카드 — 예전 카드 그대로 + 접기 띠 */
function noticeOpenCard(n, no){
  return '<div style="margin-bottom:4px"><div onclick="noticeToggleOpen(\'' + n.id + '\')" style="font-size:11px;font-weight:800;color:#1d6fe8;cursor:pointer;padding:0 4px 4px">' + (no?('#' + no + ' · '):'') + '▲ 접기</div>' + noticeCard(n) + '</div>';
}
function noticeGroupHead(t, n, c){ return '<div style="font-size:12px;font-weight:900;color:' + (c||'#475569') + ';margin:12px 2px 6px">' + t + ' <span style="color:#94a3b8;font-weight:700">' + n + '</span></div>'; }

function noticeListInner2(){
  if(!NOTICE_INDEX.length){
    return '<div style="background:#fff;border:1px dashed #d8dde7;border-radius:14px;padding:40px;text-align:center;color:#94a3b8;font-size:13px">아직 발행한 공지가 없습니다.<br>왼쪽에서 첫 공지를 작성해 보세요.</div>';
  }
  var _stMap = { visible:'노출 중', reserved:'예약', ended:'종료', hidden:'숨김' };
  var arr = NOTICE_INDEX.slice().filter(function(n){
    if(NOTICE_FILTER_STATUS!=='all' && noticeStatusLabel(n).t !== _stMap[NOTICE_FILTER_STATUS]) return false;
    if(NOTICE_FILTER_CAT!=='all'){ var cn=(n.category&&n.category.name)||'일반'; if(cn!==NOTICE_FILTER_CAT) return false; }
    return noticeMatchQ(n);
  });
  if(!arr.length) return '<div style="background:#fff;border:1px dashed #d8dde7;border-radius:14px;padding:30px;text-align:center;color:#94a3b8;font-size:13px">조건에 맞는 공지가 없습니다.</div>';
  var one = function(n, no){ return NOTICE_OPEN[n.id] ? noticeOpenCard(n, no) : noticeRow(n, no); };
  var h = '';
  if(NOTICE_SORT === 'recent'){
    arr.sort(noticeRecentCmp).forEach(function(n){ h += one(n, 0); });
    return h;
  }
  /* 학생앱 순서 — 노출 중(학생앱에 보이는 것) → 예약 → 숨김 → 종료 */
  var groups = [['노출 중','📱 학생앱에 보이는 순서','#15803d'], ['예약','🟣 예약','#7c3aed'], ['숨김','🙈 숨김','#64748b'], ['종료','⚪ 종료','#94a3b8']];
  var used = {};
  groups.forEach(function(g){
    var part = arr.filter(function(n){ return noticeStatusLabel(n).t === g[0]; }).sort(noticeAppCmp);
    part.forEach(function(n){ used[n.id] = 1; });
    if(!part.length) return;
    h += noticeGroupHead(g[1], part.length, g[2]);
    part.forEach(function(n, i){ h += one(n, g[0]==='노출 중' ? i+1 : 0); });
  });
  var rest = arr.filter(function(n){ return !used[n.id]; }).sort(noticeAppCmp);
  if(rest.length){ h += noticeGroupHead('기타', rest.length); rest.forEach(function(n){ h += one(n, 0); }); }
  return h;
}
