/* ═══════════════════════════════════════════════════════════════════
 * v19-179: 🚑 리커버리 — 「기간 지정」 밖에 더 새 주간테스트가 있으면 경고 (원장 2026-11-06 「화목반 주간테스트 점수가 안 들어왔다」 → 「경고 띄우는 걸로 넣고 배포해」)
 *  [까닭] rc_config.range 를 10/29~11/04 로 고정해 둔 뒤 화목토반이 11/5 에 본 시험이 기간 밖이라 보드에 10/29 점수가 대신 떴다.
 *  · 기간 지정(RC.cfg.range)을 쓰고 있고, 그 끝날 뒤에 본 시험(학생 응시일 me.date — rcRows 와 같은 기준)이 있으면
 *    보드 맨 위에 주황 띠 「⚠ 기간(10/29~11/4) 밖에 더 새 시험이 있어요 — 9명 · 11/5」 + 단추 두 개:
 *      ① 「기간을 오늘까지 옮기기 (10/31~11/6)」 = 같은 길이로 끝을 오늘(KST)로 → rcSaveCfg
 *      ② 「최근 1주(자동)로」 = rcSetWeeks(1)
 *  · 선발 기준 줄의 기간 칩 옆에도 작은 「⚠ 기간 밖 새 시험 n명」 칩(누르면 ①).
 *  · 셈은 rcRows 와 같은 규칙: 초5 이하 빼고 · 중등은 WEEKLY · 고등은 WEEKLY·HIGH_TEST·CHAPTER · 점수 있는 응시만.
 *  ※ 문자열 연결로만 HTML. 기간을 바꾸는 것은 단추를 누를 때만(자동으로 안 바꿈).
 * ═══════════════════════════════════════════════════════════════════ */
function rcrToday(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function rcrAdd(ymd, n){ return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function rcrMD(ymd){ return ymd ? (Number(ymd.slice(5, 7)) + '/' + Number(ymd.slice(8, 10))) : ''; }
/* 기간 끝 뒤에 본 시험 — { n: 학생 수, last: 가장 늦은 응시일, from, to } 또는 null */
function rcrBeyond(){
  try {
    var R = RC && RC.cfg && RC.cfg.range; if (!R || !R.from || !R.to) return null;
    var tests = (typeof WK !== 'undefined' && WK.tests) || []; if (!tests.length) return null;
    var seen = {}, last = '';
    (typeof getSortedStudents === 'function' ? getSortedStudents() : []).forEach(function(st){
      if (!st || st.withdrawn) return;
      var sid = (typeof bpSidOf === 'function') ? bpSidOf(st) : null; if (sid == null) return;
      var band = (typeof rcGradeBand === 'function') ? rcGradeBand(st) : ''; if (band === 'elemLow') return;
      var hi = /고/.test(String(st.grade || ''));
      tests.forEach(function(t){
        if (t.type !== 'WEEKLY' && !(hi && (t.type === 'HIGH_TEST' || t.type === 'CHAPTER'))) return;
        var me = (t.students || []).find(function(sx){ return String(sx.sid) === String(sid) && sx.score != null; });
        if (!me) return;
        var took = me.date || t.date; if (!took || took <= R.to) return;
        seen[String(st.id || st.name)] = 1; if (took > last) last = took;
      });
    });
    var n = Object.keys(seen).length; if (!n) return null;
    return { n: n, last: last, from: R.from, to: R.to };
  } catch(e){ try { console.error('[리커버리 기간 밖 시험]', e); } catch(_){} return null; }
}
/* ① 같은 길이로 끝을 오늘로 */
function rcrShifted(){
  var R = RC.cfg.range; var span = Math.max(0, Math.round((Date.parse(R.to + 'T00:00:00Z') - Date.parse(R.from + 'T00:00:00Z')) / 86400000));
  var to = rcrToday(); return { from: rcrAdd(to, -span), to: to };
}
window.rcrShift = function(){
  if (!RC.cfg.range) return;
  var nx = rcrShifted();
  RC.cfg.range = { from: nx.from, to: nx.to };
  try { rcSaveCfg(); } catch(e){}
  try { plToast('🗓️ 선발 기간을 ' + rcrMD(nx.from) + ' ~ ' + rcrMD(nx.to) + ' 로 옮겼어요'); } catch(e){}
  try { render(); } catch(e){}
};
window.rcrAuto = function(){ try { rcSetWeeks(1); plToast('🗓️ 선발 기간 = 최근 1주(자동)'); } catch(e){} };
function rcrBanner(b){
  var nx = rcrShifted();
  return '<div class="rcr-warn" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff7ed;border:2px solid #fb923c;border-radius:13px;padding:10px 14px;margin:0 0 12px;font-size:13px;font-weight:800;color:#9a3412">'
    + '<span style="font-size:15px">⚠</span><span>선발 기간(' + rcrMD(b.from) + ' ~ ' + rcrMD(b.to) + ') 밖에 <b>더 새 시험</b>이 있어요 — <b>' + b.n + '명</b> · 가장 늦은 응시 ' + rcrMD(b.last) + '. 지금 보드에는 그 점수가 안 들어가 있어요.</span>'
    + '<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">'
    + '<button onclick="rcrShift()" style="border:none;background:#ea580c;color:#fff;border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">기간을 오늘까지 옮기기 (' + rcrMD(nx.from) + ' ~ ' + rcrMD(nx.to) + ')</button>'
    + '<button onclick="rcrAuto()" style="border:1.5px solid #fdba74;background:#fff;color:#9a3412;border-radius:9px;padding:6px 12px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">최근 1주(자동)로</button>'
    + '</span></div>';
}
if (typeof rRecovery === 'function') rRecovery = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (typeof h !== 'string' || !RC || !RC.loaded || (RC.view && RC.view !== 'board')) return h;
    var b = rcrBeyond(); if (!b) return h;
    /* 기간 칩 옆 작은 칩 */
    var i = h.indexOf('onclick="rcOpenPeriod()"');
    if (i >= 0) { var j = h.indexOf('</button>', i); if (j > 0) h = h.slice(0, j + 9) + '<button onclick="rcrShift()" title="기간을 같은 길이로 오늘까지 옮깁니다" style="background:#fff7ed;border:1.5px solid #fb923c;border-radius:50px;padding:5px 12px;font-size:12px;font-weight:900;color:#c2410c;cursor:pointer;font-family:inherit">⚠ 기간 밖 새 시험 ' + b.n + '명</button>' + h.slice(j + 9); }
    /* 맨 위 띠 — 첫 머리(🚑 리커버리 수업 줄) 다음 */
    var anchor = '<div style="padding:18px 22px 40px;max-width:1560px">';
    var k = h.indexOf(anchor);
    if (k >= 0) { var head = h.indexOf('🚑 리커버리 수업', k);
      var at = (head > 0) ? h.indexOf('</button></div>', head) : -1;
      if (at > 0) h = h.slice(0, at + 15) + rcrBanner(b) + h.slice(at + 15);
      else h = h.slice(0, k + anchor.length) + rcrBanner(b) + h.slice(k + anchor.length);
    } else h = rcrBanner(b) + h;
  } catch(e){ try { console.error('[리커버리 기간 경고]', e); } catch(_){} }
  return h;
}; })(rRecovery);
