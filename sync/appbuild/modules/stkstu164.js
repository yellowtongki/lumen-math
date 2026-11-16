/* ═══════════════════════════════════════════════════════════════════
 * v2-164: 🔥 연속 기록 — 홈 띠 + «연속 기록» 화면(플래너/녹음 · 연속 랭킹 TOP 5 · 달력 · 메달)
 *   (원장 2026-11-16 「연속 학습 표기를 플래너와 녹음에 도입 · 홈 화면에 보이게 · 상위 5명 · 전체 학생 랭킹 · 추천대로」
 *    시안 docs/mockup_streak_student.html)
 *   내 연속 = 내 플래너 사진 목록(photos/<코드>)·내 녹음 제출(submissions_<코드>)로 바로 계산(STK — sync/streak_core.js 와 같은 코드)
 *   랭킹 = 서버가 매일 새벽 계산해 둔 streak_board(별명만) — 전체 학생 · TOP 5 · 내 순위
 *   새 탭 없음 — 홈의 띠를 누르면 screen-streak. ※ ES5 · 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var STKU = { loaded: false, busy: false, pl: null, rc: null, plHas: {}, rcHas: {}, board: null, tab: 'pl', ym: null };
function stkEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
async function stkLoad(force){
  if (!studentInfo || isTest || !sb) { var el0 = document.getElementById('stk-strip'); if (el0) el0.style.display = 'none'; return; }
  if (STKU.busy || (STKU.loaded && !force)) { stkPaintStrip(); return; }
  STKU.busy = true;
  var code = studentInfo.lumen_rec_code;
  try {
    var r1 = await sb.storage.from('photos').list(code, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
    var names = ((r1 && r1.data) || []).map(function(f){ return f && f.name; });
    STKU.plHas = STK.plannerDays(names);
  } catch(e){ STKU.plHas = {}; }
  try {
    var r2 = await sb.from('lumen_store').select('key,value').in('key', ['submissions_' + code, 'streak_board']);
    var kv = {}; ((r2 && r2.data) || []).forEach(function(x){ var v = x.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e2){ v = null; } } kv[x.key] = v; });
    var sub = kv['submissions_' + code];
    STKU.rcHas = STK.recDays(Array.isArray(sub) ? sub : []);
    STKU.board = kv.streak_board || null;
  } catch(e){ STKU.rcHas = {}; }
  STKU.pl = STK.streak(STKU.plHas, STK.everyDay);
  STKU.rc = STK.streak(STKU.rcHas, STK.recDue(STK.classDays(studentInfo.group)));
  STKU.loaded = true; STKU.busy = false;
  stkPaintStrip();
  var sc = document.getElementById('screen-streak'); if (sc && sc.classList.contains('active')) stkRender();
}
function stkRankOf(k){
  var B = STKU.board && STKU.board.list; if (!B || !B.length || !studentInfo) return null;
  var L = B.slice().sort(function(a, b){ return (b[k] || 0) - (a[k] || 0); }), code = String(studentInfo.lumen_rec_code), rank = 0, last = null;
  for (var i = 0; i < L.length; i++){ if (L[i][k] !== last){ rank = i + 1; last = L[i][k]; } if (String(L[i].c) === code) return (L[i][k] > 0) ? rank : null; }
  return null;
}
function stkPaintStrip(){
  var el = document.getElementById('stk-strip'); if (!el) return;
  if (!STKU.loaded || isTest){ el.style.display = 'none'; return; }
  var pl = STKU.pl, rc = STKU.rc, u = STK.recUnit(), rk = stkRankOf('pl');
  el.style.display = '';
  el.className = 'stk-strip' + (pl.cur ? '' : ' cold');
  el.innerHTML = (pl.cur && !pl.today ? '<span class="stk-hot">오늘 아직!</span>' : '')
    + '<span class="stk-fl">' + (pl.cur ? '🔥' : '🧊') + '</span>'
    + '<span class="stk-a"><b>' + pl.cur + '<small>일 연속</small></b>'
    + '<span class="stk-s">📒 플래너 · ' + (pl.cur ? (pl.today ? '오늘도 냈어요!' : '오늘 내면 ' + (pl.cur + 1) + '일!') : '오늘 내면 1일부터 시작!') + '</span>'
    + '<span class="stk-s">' + (rk ? '🏅 연속 랭킹 ' + rk + '위 · ' : '') + '눌러서 보기 ›</span></span>'
    + '<span class="stk-r">🎙 녹음<b>' + rc.cur + u + '</b></span>';
}
window.stkOpen = function(){ var n = new Date(Date.now() + 9 * 3600000); STKU.ym = [n.getUTCFullYear(), n.getUTCMonth()]; go('screen-streak'); };
window.stkTab = function(t){ STKU.tab = t; stkRender(); };
window.stkMon = function(d){ var y = STKU.ym[0], m = STKU.ym[1] + d; if (m < 0){ m = 11; y--; } if (m > 11){ m = 0; y++; } STKU.ym = [y, m]; stkRender(); };
function stkRender(){
  var box = document.getElementById('stk-body'); if (!box) return;
  if (!STKU.loaded){ box.innerHTML = '<div class="stk-empty">불러오는 중…</div>'; stkLoad(); return; }
  if (!STKU.ym){ var n0 = new Date(Date.now() + 9 * 3600000); STKU.ym = [n0.getUTCFullYear(), n0.getUTCMonth()]; }
  var isPl = STKU.tab === 'pl', st = isPl ? STKU.pl : STKU.rc, has = isPl ? STKU.plHas : STKU.rcHas;
  var u = isPl ? '일' : STK.recUnit(), key = isPl ? 'pl' : 'rc', due = isPl ? STK.everyDay : STK.recDue(STK.classDays(studentInfo.group));
  var h = '<div class="stk-seg"><button class="' + (isPl ? 'on' : '') + '" onclick="stkTab(\'pl\')">📒 플래너</button><button class="' + (isPl ? '' : 'on') + '" onclick="stkTab(\'rc\')">🎙 녹음</button></div>';
  /* 큰 카드 + 이번 주 */
  var t = STK.todayK(), mon = STK.addDay(t, -((STK.dow(t) + 6) % 7)), wk = '';
  for (var i = 0; i < 7; i++){ var k = STK.addDay(mon, i); wk += '<span>' + '월화수목금토일'[i] + '<i class="' + (has[k] ? 'y' : '') + (k === t ? ' t' : '') + '">' + (has[k] ? '✓' : '') + '</i></span>'; }
  h += '<div class="stk-big' + (st.cur ? '' : ' cold') + '"><div class="fl">' + (st.cur ? '🔥' : '🧊') + '</div>'
    + '<div class="lb">' + (isPl ? '📒 플래너 연속 제출 · 매일' : '🎙 녹음 연속 제출 · ' + (u === '일' ? '매일' : '수업일마다')) + '</div>'
    + '<div class="n">' + st.cur + '<small>' + u + ' 연속' + (st.cur ? '!' : '') + '</small></div>'
    + '<div class="m">' + (st.cur ? (st.today ? '오늘도 냈어요 · ' : '오늘 내면 ' + (st.cur + 1) + u + '! · ') : '오늘부터 다시 시작해요 · ') + '최고 ' + st.best + u + (st.cur && st.cur >= st.best ? ' — 지금이 최고 기록!' : '') + '</div>'
    + '<div class="stk-wk">' + wk + '</div></div>';
  /* 랭킹 TOP 5 */
  var B = (STKU.board && STKU.board.list) || [], code = String(studentInfo.lumen_rec_code);
  var L = B.filter(function(x){ return (x[key] || 0) > 0; }).sort(function(a, b){ return (b[key] || 0) - (a[key] || 0); });
  h += '<div class="stk-card"><h4>🏅 연속 랭킹 TOP 5 · ' + (isPl ? '플래너' : '녹음') + ' <small>전체 학생</small></h4>';
  if (!L.length) h += '<div class="stk-empty">아직 랭킹이 없어요 — 매일 새벽에 새로 매겨요</div>';
  var rank = 0, last = null, mine = null, MED = ['🥇', '🥈', '🥉'];
  L.forEach(function(x, i){ if (x[key] !== last){ rank = i + 1; last = x[key]; } x._r = rank; if (String(x.c) === code) mine = x; });
  L.slice(0, 5).forEach(function(x){
    var me = String(x.c) === code;
    h += '<div class="stk-rk' + (me ? ' me' : '') + '"><span class="no">' + (MED[x._r - 1] || x._r) + '</span><span class="nm">' + (me ? '나 · ' : '') + stkEsc(x.n || '○○○') + (x.g ? ' <small>(' + stkEsc(x.g) + ')</small>' : '') + '</span><span class="v">🔥 ' + x[key] + u + '</span></div>';
  });
  if (mine && mine._r > 5) h += '<div class="stk-rk me"><span class="no">' + mine._r + '</span><span class="nm">나 · ' + stkEsc(mine.n || '○○○') + '</span><span class="v">🔥 ' + mine[key] + u + '</span></div>';
  if (STKU.board && STKU.board.at){ var at = new Date(STKU.board.at); h += '<div class="stk-note">랭킹은 매일 새벽에 새로 매겨요 · ' + (at.getMonth() + 1) + '/' + at.getDate() + ' ' + (at.getHours() < 10 ? '0' : '') + at.getHours() + ':' + (at.getMinutes() < 10 ? '0' : '') + at.getMinutes() + ' 기준 · 이름은 별명</div>'; }
  h += '</div>';
  /* 달력 */
  var y = STKU.ym[0], mo = STKU.ym[1], first = new Date(Date.UTC(y, mo, 1)), nd = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), lead = (first.getUTCDay() + 6) % 7, cal = '';
  ['월','화','수','목','금','토','일'].forEach(function(d){ cal += '<b>' + d + '</b>'; });
  for (i = 0; i < lead; i++) cal += '<span></span>';
  for (var dd = 1; dd <= nd; dd++){
    var kk = '' + y + (mo < 9 ? '0' : '') + (mo + 1) + (dd < 10 ? '0' : '') + dd, cls = kk > t ? 'f' : has[kk] ? 'y' : kk === t ? 't' : (due(kk) ? 'n' : 'o');
    cal += '<span class="' + cls + '">' + dd + '</span>';
  }
  h += '<div class="stk-card"><div class="stk-mh"><button onclick="stkMon(-1)">‹</button><b>' + y + '년 ' + (mo + 1) + '월</b><button onclick="stkMon(1)">›</button></div><div class="stk-cal">' + cal + '</div>'
    + '<div class="stk-note">주황 = 낸 날 · 점선 = 오늘 · 회색 = 안 낸 날' + (isPl ? '' : (u === '일' ? '' : ' · 흐린 날 = 수업 없는 날')) + '</div></div>';
  /* 메달 */
  h += '<div class="stk-card"><h4>🎖 연속 메달 <small>최고 ' + st.best + u + '</small></h4><div class="stk-ms">';
  [7, 14, 30, 50, 100].forEach(function(m){ h += '<b class="' + (st.best >= m ? 'on' : '') + '">' + (st.best >= m ? '🏅 ' : '') + m + u + '</b>'; });
  h += '</div><div class="stk-note">끊기면 🧊 1부터 다시 · 최고 기록과 메달은 그대로 남아요</div></div>';
  box.innerHTML = h;
}
window.stkLoad = stkLoad; window.stkRender = stkRender;
