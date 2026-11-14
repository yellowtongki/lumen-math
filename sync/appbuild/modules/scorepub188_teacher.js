/* ═══════════════════════════════════════════════════════════════════
 * v19-188: 📈 성적 추이 2단계 — 학부모앱으로 함께 보내기 + 리포트 안 «최근 성적» + 홈 왼쪽 단추
 *   (원장 2026-11-13 「성적 한눈에를 홈 왼쪽 탭 명예의 전당 밑에 새 버튼 · 2단계 진행」 · 시안 docs/mockup_parent_score_trend.html)
 *  ① 홈 왼쪽 «🏆 명예의 전당» 밑 «📈 성적 한눈에» 단추 (build_app.py rep)
 *  ② 학부모앱 발행(udPublishParent) 때 pub_reports_<코드>.hist 를 함께 올린다 — 학원앱 «성적 한눈에»와 같은 자료(soOf)
 *     hist = { v:1, at, wk:[{d,t,s,avg,r,n,nat}], dy:[{d,t,s,avg}] } · 학교 성적은 넣지 않는다(원장 결정: 1단계 학부모앱은 주간·일일만)
 *     최근 전국주간 리포트가 «전국 등수 숨김»(showRank===false)이면 전국 등수 칸을 빼고 보낸다
 *  ③ 리포트 HTML 안 «📈 성장 추이»(주간·일일이 한 그래프에 겹치던 것) → 그 리포트 시험 종류의 최근 6회 막대
 *     주간 = 막대 색 전국 상위 % 등급 + 그 회차 378/823명 · 일일 = 학원 평균보다 높으면 초록, 낮으면 주황
 *     이미 발행한 옛 리포트 파일은 다음 발행 때 새로 만들어진다.
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
/* 발행 직전 성적 자료가 아직 없으면 기다려서 읽는다 */
function soLoadP(){
  if (SO.loaded) return Promise.resolve(true);
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return Promise.resolve(false);
  return Promise.all([
    sb.from('lumen_store').select('key,value').in('key', ['mf_weekly']),
    sb.from('mf_students').select('mf_student_id,lumen_rec_code')
  ]).then(function(rs){
    var a = rs[0] && rs[0].data ? rs[0].data[0] : null, v = a ? a.value : null;
    if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    SO.wk = v || { tests: [] };
    var m = {}; ((rs[1] && rs[1].data) || []).forEach(function(x){ if (x && x.lumen_rec_code && x.mf_student_id != null){ (m[x.lumen_rec_code] = m[x.lumen_rec_code] || []).push(String(x.mf_student_id)); } });
    SO.sidByCode = m; SO.loaded = true; SO.t = Date.now(); return true;
  }, function(){ return false; });
}
/* 학부모앱으로 보낼 짧은 성적 기록 */
async function soPubHist(st){
  if (!st) return null;
  await soLoadP();
  var o = soOf(st);
  var hideNat = false;
  try {
    var wr = list.filter(function(r){ return r && r.testType === 'weekly' && ((r.studentId && r.studentId === st.id) || (!r.studentId && r.name === st.name)); })
      .sort(function(a, b){ return (normalizeDate(b.date || '') || '').localeCompare(normalizeDate(a.date || '') || ''); });
    if (wr.length && wr[0].showRank === false) hideNat = true;
  } catch(e){}
  return {
    v: 1, at: new Date().toISOString(),
    wk: o.wk.slice(-40).map(function(e){ return { d: e.d, t: e.t, s: e.s, avg: e.avg == null ? null : e.avg, r: hideNat ? null : (e.r || null), n: hideNat ? null : (e.n || null), nat: !!e.nat }; }),
    dy: o.dy.slice(-40).map(function(e){ return { d: e.d, t: e.t, s: e.s, avg: e.avg == null ? null : e.avg }; })
  };
}
window.soPubHist = soPubHist;
/* 리포트 HTML 안 «최근 성적» — reports: 그 학생 리포트(최근이 앞) · d: 지금 보는 리포트 */
function soRepRecent(reports, d){
  try {
    var wk = d.testType === 'weekly', dd = normalizeDate(d.date || '') || '';
    var L = (reports || []).filter(function(r){ return r && r.score !== '' && r.score != null && ((r.testType === 'weekly') === wk) && (normalizeDate(r.date || '') || '') <= dd; })
      .sort(function(a, b){ return (normalizeDate(a.date || '') || '').localeCompare(normalizeDate(b.date || '') || ''); }).slice(-6);
    if (!L.length) return '';
    var h = '<div style="background:white;border-radius:18px;padding:22px;margin-top:18px;border:1px solid #e8eef8">'
      + '<div style="font-size:20px;font-weight:800;color:#0d2240;margin-bottom:6px">📊 최근 ' + (wk ? '전국주간테스트' : '일일테스트') + ' <span style="font-size:15px;color:#94a3b8;font-weight:700">' + L.length + '회</span></div>';
    if (wk && d.rank && d.total && d.showRank !== false) {
      var g = soGrade(d.rank, d.total), c = SO_GC[g] || SO_GC[3];
      h += '<div style="font-size:16px;color:#475569;margin-bottom:10px">이번 회 전국 <span style="display:inline-block;font-weight:900;color:' + c[0] + ';background:' + c[1] + ';border-radius:9px;padding:2px 10px">' + d.rank + '/' + d.total + '명 · ' + g + '등급</span></div>';
    } else if (!wk) h += '<div style="font-size:15px;color:#64748b;margin-bottom:10px">날마다 범위·난이도가 달라 그날 학원 평균과 비교해요 (초록 = 평균 이상)</div>';
    h += '<div style="display:flex;gap:8px;align-items:flex-end;height:150px;margin-top:6px">';
    L.forEach(function(r, i){
      var sc = Number(r.score) || 0, col = '#1d6fe8', sub = '';
      if (wk) { var gg = (r.rank && r.total && r.showRank !== false) ? soGrade(r.rank, r.total) : 0; col = gg ? SO_GC[gg][0] : '#94a3b8'; sub = gg ? gg + '등급' : ''; }
      else { var av = (r.acadAvg != null && r.acadAvg !== '') ? Number(r.acadAvg) : null; if (av != null) { var df = Math.round(sc - av); col = df >= 0 ? '#16a34a' : '#ea580c'; sub = (df >= 0 ? '+' : '') + df; } else col = '#94a3b8'; }
      var cur = i === L.length - 1;
      h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">'
        + '<b style="font-size:17px;color:' + col + '">' + sc + '</b>'
        + '<div style="width:100%;height:' + Math.max(6, Math.round(sc * 0.95)) + 'px;background:' + col + ';border-radius:8px 8px 3px 3px;opacity:' + (cur ? 1 : 0.55) + '"></div>'
        + '<span style="font-size:13px;color:#64748b;font-weight:700;white-space:nowrap">' + soMD(normalizeDate(r.date || '')) + '</span>'
        + (sub ? '<span style="font-size:12px;font-weight:800;color:' + col + '">' + sub + '</span>' : '') + '</div>';
    });
    h += '</div><div style="font-size:14px;color:#94a3b8;margin-top:12px;text-align:center">전체 흐름은 학부모앱 › 🏅 성적 › 📈 성적 추이에서 볼 수 있어요</div></div>';
    return h;
  } catch(e){ return ''; }
}
window.soRepRecent = soRepRecent;
