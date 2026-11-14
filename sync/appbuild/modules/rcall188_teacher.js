/* ═══════════════════════════════════════════════════════════════════
 * v19-188: 🚑 리커버리 보드 — 주간 점수를 모든 줄에 · 기준 통과 학생도 반 목록에
 *   (원장 2026-11-13 「리커버리 월수금 ○○○이 안 보이고 화목토반 ○○○ 주간테스트 점수가 안 보인다 · 초등도 주간 몇 점인지 안 보인다」)
 *  [까닭] 보드는 «호출 후보»(주간 점수 기준 미만 또는 단원 정답률 미만)만 줄로 그리고, 주간 점수도 «기준 미만일 때만» 사유 칩으로 적었다.
 *         → 단원 때문에 후보가 된 학생은 주간 점수가 안 보였고, 두 기준을 다 넘은 학생은 줄 자체가 없었다.
 *  [고침] ① 모든 줄에 이번 기간 «가장 최근 주간 점수» — 호출 사유가 아니면 회색 칩(「주간 85점 · 11/12」)
 *         ② 두 기준을 다 넘은 재원생도 반·학년 묶음 맨 아래에 흐리게 «✓ 기준 통과»로(전체 보기에서만 · 1순위·확정·미정 칩에서는 빠짐)
 *            그 줄에서도 호출 토글을 눌러 직접 부를 수 있다.
 *         ③ 묶음 머리 «n명 · 🔥 · 확정»은 예전처럼 후보만 세고 «· 통과 n» 을 덧붙인다.
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  try {
    var css = document.createElement('style');
    css.textContent = '.rb188-pass td{opacity:.6}.rb188-pass:hover td{opacity:1}.rb174-pill.rb188-wk{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.rb174-pill.rb188-ok{background:#ecfdf5;color:#15803d}';
    (document.head || document.documentElement).appendChild(css);
  } catch(e){}
})();
/* 이번 기간 가장 최근 주간 점수 (리커버리 기간 · 학생 본인 응시일 · 고등부는 HIGH_TEST·단원도) */
function rb188Latest(st){
  if (!st) return null;
  var sid = null; try { sid = bpSidOf(st); } catch(e){} if (sid == null) return null;
  var P = null; try { P = rcPeriod(); } catch(e){ return null; }
  var hi = /고/.test(String(st.grade || '')), best = null;
  ((typeof WK !== 'undefined' && WK.tests) || []).forEach(function(t){
    if (t.type !== 'WEEKLY' && !(hi && (t.type === 'HIGH_TEST' || t.type === 'CHAPTER'))) return;
    var me = (t.students || []).filter(function(sx){ return String(sx.sid) === String(sid) && sx.score != null; })[0];
    if (!me) return;
    var on = me.date || t.date; if (!on || on < P.from || on > P.to) return;
    if (!best || String(on) > String(best.date)) best = { ttype: t.type, title: t.title, score: me.score, date: on };
  });
  return best;
}
function rb188WkPill(t, note){
  if (!t) return '';
  return rb174Pill('rb188-wk', rb174Q(rb174TestLabel(t)) + ' ' + t.score + '점 · <span class="rb174-sub">' + rb174Q(rb174Md(t.date)) + '</span>', note || ('매쓰플랫 채점일 ' + String(t.date || '')));
}
if (typeof rb174List === 'function') rb174List = (function(orig){ return function(wk){
  var out = orig.apply(this, arguments);
  var W = ((RC.state || {}).calls || {})[wk] || {}, seen = {};
  out.forEach(function(x){ seen[x.k] = 1; if (x.st) x.latest = rb188Latest(x.st); });
  var all = []; try { all = getSortedStudents(); } catch(e){ all = []; }
  all.forEach(function(st){
    if (!st || st.withdrawn || !st.name) return;
    var k = String(st.id || st.name); if (seen[k]) return; seen[k] = 1;
    var x = { k: k, name: st.name, grade: st.grade || '', group: st.group || '', st: st, row: null, e: W[k] || {}, manual: false, pri: 9, pass: true, latest: rb188Latest(st) };
    x.day = rb174DayKey(x.group); x.gk = rb174GradeKey(x.grade); x.done = !!(x.e.done || x.e.noshow);
    out.push(x);
  });
  return out;
}; })(rb174List);
if (typeof rb174Why === 'function') rb174Why = (function(orig){ return function(x, full){
  if (x && x.pass) {
    var e = x.e || {};
    return (x.latest ? rb188WkPill(x.latest, '이번 기간 최근 점수 — 기준 이상') : '<span class="rb174-dim">이번 기간 주간 기록 없음</span>')
      + (e.on ? rb174Pill('b', '👋 직접', '원장님이 직접 호출') : rb174Pill('rb188-ok', '✓ 기준 통과', '이번 기간 주간·단원 기준을 모두 넘었어요'));
  }
  var h = orig.apply(this, arguments);
  if (x && !(x.row && x.row.testHit) && x.latest) h = rb188WkPill(x.latest, '이번 기간 최근 점수 — 기준 이상(호출 사유 아님)') + h;
  return h;
}; })(rb174Why);
if (typeof rb174Pass === 'function') rb174Pass = (function(orig){ return function(x, f, dt){
  if (x && x.pass && !(x.e && x.e.on) && f !== 'all') return false;
  return orig.apply(this, arguments);
}; })(rb174Pass);
if (typeof rb174GroupStat === 'function') rb174GroupStat = (function(orig){ return function(list){
  var cand = list.filter(function(x){ return !x.pass || (x.e && x.e.on); }), ps = list.length - cand.length;
  return orig.call(this, cand) + (ps ? ' · 통과 ' + ps : '');
}; })(rb174GroupStat);
if (typeof rb174Row === 'function') rb174Row = (function(orig){ return function(x, dt){
  var h = orig.apply(this, arguments);
  if (x && x.pass && !(x.e && x.e.on)) h = h.replace('<tr class="rb174-r', '<tr class="rb174-r rb188-pass');
  return h;
}; })(rb174Row);
