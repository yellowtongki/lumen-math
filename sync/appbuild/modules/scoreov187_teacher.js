/* ═══════════════════════════════════════════════════════════════════
 * v19-187: 📈 성적 한눈에 (원장 2026-11-11 「학원앱에서 학생 성적을 쉽게 — 주간테스트와 학교 중간고사 실제 성적」 → 「추천대로 · 만들어」)
 *   설계 docs/score_overview_design.md · 시안 docs/mockup_score_overview.html
 *  ① 새 메뉴 «📈 성적 한눈에»(VIEW 'scoreov'): 학년 고르기 · 정렬(이름 / 전국 위치 / 최근 하락 큰 순)
 *     학생 줄 = 🌐 전국주간(최근 6회 미니 막대 · 점수 · 378/823명) · 🎓 최근 학교 시험(수학 점수·등급·직전 대비·석차) · 📝 일일(학원 평균 이상 n/m)
 *     오른쪽 = 고른 학생: 전국주간 그래프(점수 + 전국 평균 점선 · 점마다 등급 색) + 회차 표(시험지 제목) · 학교 시험 학기별(수학 + ＋다른 과목) · 일일 학원 평균 차이 막대
 *  ② 학생 프로필 새 탭 «📈 성적»(같은 그림) · 리포트가 없어도 등록부에 있으면 프로필이 열린다(build_app.py rep)
 *  등급 색 = 전국 상위 %(≤10 1 초록 · ≤30 2 파랑 · ≤50 3 노랑 · ≤70 4 주황 · 그 아래 5 빨강) — 원장 결정 11/11
 *  자료: 주간 = lumen_store mf_weekly(WEEKLY + 제목에 «주간»인 HIGH_TEST · 전국 등수 natRank/natN/natAvg — 2026-11-12 수집기가 보존)
 *        + 옛 회차·빈 전국 등수는 리포트(list, testType 'weekly' 의 rank/total/avgScore)로 보충
 *        학교 = school_scores[학생 id] · 일일 = 리포트(testType ≠ weekly, acadAvg 있는 것)
 *        학생 짝 = 등록부 lumen_rec_code ↔ mf_students.mf_student_id (이름은 마지막 수단)
 *  읽기만 · 서버 쓰기 없음 · ※ 문자열 연결로만 HTML
 * ═══════════════════════════════════════════════════════════════════ */
var SO = { loaded: false, busy: false, t: 0, wk: null, sidByCode: {}, sel: null, g: 'all', sort: 'name', more: {} };
var SO_GC = { 1: ['#059669', '#ecfdf5'], 2: ['#1d6fe8', '#eaf2ff'], 3: ['#b45309', '#fef3c7'], 4: ['#c2410c', '#ffedd5'], 5: ['#dc2626', '#fee2e2'] };
function soE(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function soGrade(rank, n){ rank = Number(rank); n = Number(n); if (!rank || !n) return 0; var p = rank / n * 100; return p <= 10 ? 1 : p <= 30 ? 2 : p <= 50 ? 3 : p <= 70 ? 4 : 5; }
function soRk(rank, n){ var g = soGrade(rank, n); if (!g) return '<span style="font-size:11px;color:#94a3b8;font-weight:700">전국 —</span>'; var c = SO_GC[g];
  return '<span class="so-rk" style="color:' + c[0] + ';background:' + c[1] + '">' + rank + '/' + n + '명<small>' + g + '등급</small></span>'; }
function soShortGrade(gr){ var m = String(gr || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? m[1] + m[2] : String(gr || ''); }
function soDot(d){ return String(d || '').slice(0, 10).replace(/\./g, '-'); }
function soMD(d){ d = soDot(d); return d ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) : ''; }
function soLoad(force){
  if (SO.busy) return; if (!force && SO.loaded && Date.now() - SO.t < 120000) return;
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return;
  SO.busy = true;
  Promise.all([
    sb.from('lumen_store').select('key,value').in('key', ['mf_weekly']),
    sb.from('mf_students').select('mf_student_id,lumen_rec_code')
  ]).then(function(rs){
    var a = rs[0] && rs[0].data ? rs[0].data[0] : null, v = a ? a.value : null;
    if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    SO.wk = v || { tests: [] };
    var m = {}; ((rs[1] && rs[1].data) || []).forEach(function(x){ if (x && x.lumen_rec_code && x.mf_student_id != null){ (m[x.lumen_rec_code] = m[x.lumen_rec_code] || []).push(String(x.mf_student_id)); } });
    SO.sidByCode = m; SO.loaded = true; SO.busy = false; SO.t = Date.now();
    try { if (VIEW === 'scoreov' || VIEW === 'student_detail') render(); } catch(e){}
  }, function(){ SO.busy = false; SO.loaded = true; SO.t = Date.now(); });
}
/* 한 학생 성적표 — { wk:[{d,t,s,avg,r,n,acadAvg}], sch:[{label,term,math:{score,grade,rank,avg},others:[{name,score}]}], dy:[{d,s,avg,t}] } */
function soOf(st){
  var out = { wk: [], sch: [], dy: [] }; if (!st) return out;
  var sids = (SO.sidByCode[st.lumen_rec_code] || []), byDate = {};
  ((SO.wk && SO.wk.tests) || []).forEach(function(t){
    if (!(t.type === 'WEEKLY' || (t.type === 'HIGH_TEST' && /주간/.test(String(t.title || ''))))) return;
    (t.students || []).forEach(function(x){
      if (sids.indexOf(String(x.sid)) < 0 || x.score == null) return;
      var e = { d: soDot(x.date || t.date), t: String(t.title || ''), s: Number(x.score), avg: x.natAvg, r: x.natRank, n: x.natN, acadAvg: x.acadAvg, nat: t.type === 'WEEKLY' };
      out.wk.push(e); byDate[e.d] = e;
    });
  });
  /* 리포트 — 옛 회차 보충 · 전국 등수 비면 채움 · 일일 */
  var reps = (typeof list !== 'undefined' && Array.isArray(list)) ? list.filter(function(r){ return r && r.score !== '' && r.score != null && ((r.studentId && r.studentId === st.id) || (!r.studentId && r.name === st.name)); }) : [];
  reps.forEach(function(r){
    var d = soDot(normalizeDate(r.date || '')); if (!d) return;
    if (r.testType === 'weekly') {
      var e = byDate[d];
      var rk = Number(r.rank) || null, tot = Number(r.total) || null;
      if (e) { if (!e.r && rk && tot && r.showRank !== false) { e.r = rk; e.n = tot; } if (e.avg == null && r.avgScore) e.avg = Number(r.avgScore); }
      else { e = { d: d, t: (r.paper && r.paper.label ? r.paper.label + ' ' : '') + (r.testTypeName || '전국주간') + (r.paper && r.paper.range ? ' · ' + r.paper.range : ''), s: Number(r.score), avg: r.avgScore ? Number(r.avgScore) : null, r: rk, n: tot, acadAvg: r.acadAvg, nat: true, fromRep: true };
        out.wk.push(e); byDate[d] = e; }
    } else {
      out.dy.push({ d: d, s: Number(r.score), avg: (r.acadAvg != null && r.acadAvg !== '') ? Number(r.acadAvg) : null, t: (r.paper && r.paper.label ? r.paper.label + ' · ' : '') + (r.bookname || r.testTypeName || '일일테스트') });
    }
  });
  out.wk.sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  out.dy.sort(function(a, b){ return a.d < b.d ? -1 : 1; });
  /* 학교 시험 — 수학 + 다른 과목 */
  var recs = []; try { recs = (typeof schoolScores !== 'undefined' && schoolScores[st.id]) || []; } catch(e){}
  recs.forEach(function(rc){
    var subs = rc.subjects || [], m = null, oth = [];
    subs.forEach(function(sj){ if (!sj) return; if (!m && /수학/.test(String(sj.name || ''))) m = sj; else oth.push({ name: sj.name, score: sj.score, grade: sj.grade }); });
    var sem = rc.semester || {}, label = (rc.year ? rc.year + ' ' : '') + (sem.grade ? sem.grade + '학년 ' : '') + (sem.term ? sem.term + '학기' : '');
    out.sch.push({ key: rc.id || label + rc.examType, label: label.trim() || (rc.examName || ''), term: rc.examType || rc.examName || '', date: rc.examDate || rc.createdAt || '',
      math: m ? { score: m.score, grade: m.grade, rank: m.rank || (m.rankNum && m.totalStudents ? m.rankNum + '/' + m.totalStudents : ''), avg: m.average } : null, others: oth, school: rc.school || '' });
  });
  out.sch.sort(function(a, b){ var ka = (a.label || '') + (/기말/.test(a.term) ? 2 : 1), kb = (b.label || '') + (/기말/.test(b.term) ? 2 : 1); return ka < kb ? -1 : ka > kb ? 1 : String(a.date) < String(b.date) ? -1 : 1; });
  return out;
}
function soLast(a){ return a && a.length ? a[a.length - 1] : null; }
/* 요약에 쓸 회차 — 전국 등수가 있는 전국주간 회차들(없으면 전부) · 고등 자체 시험은 표에만 */
function soNatList(o){ var n = o.wk.filter(function(e){ return e.nat && e.r && e.n; }); return n.length ? n : o.wk; }
function soPct(e){ return e && e.r && e.n ? e.r / e.n : null; }
function soDrop(o){ var w = soNatList(o).filter(function(e){ return soPct(e) != null; }); if (w.length < 2) return -9; return soPct(w[w.length - 1]) - soPct(w[w.length - 2]); }
function soStudents(){
  var all = (typeof students !== 'undefined' ? students : []).filter(function(s){ return s && s.name && !s.withdrawn; });
  return all;
}
/* 미니 막대 (최근 6회 · 등급 색) */
function soSpark(wk){
  var h = '<span class="so-spark">';
  wk.slice(-6).forEach(function(e){ var g = soGrade(e.r, e.n), c = g ? SO_GC[g][0] : '#cbd5e1'; h += '<i title="' + soE(soMD(e.d) + ' ' + e.s + '점') + '" style="height:' + Math.max(4, Math.round(e.s * 0.28)) + 'px;background:' + c + '"></i>'; });
  return h + '</span>';
}
function soRow(st, o){
  var w = soLast(soNatList(o)), sc = null, pv = null;
  var sm = o.sch.filter(function(x){ return x.math && x.math.score != null && x.math.score !== ''; }); sc = soLast(sm); pv = sm.length > 1 ? sm[sm.length - 2] : null;
  var df = sc && pv ? Number(sc.math.score) - Number(pv.math.score) : null;
  var dl = o.dy.slice(-8).filter(function(x){ return x.avg != null; }), up = dl.filter(function(x){ return x.s >= x.avg; }).length;
  var h = '<button type="button" class="so-row' + (SO.sel === st.id ? ' on' : '') + '" onclick="soPick(\'' + soE(st.id) + '\')">';
  h += '<span class="so-nm"><b>' + soE(st.name) + '</b><small>' + soE(soShortGrade(st.grade)) + (st.group ? ' · ' + soE(st.group) : '') + '</small></span>';
  h += '<span class="so-wkc">' + (w ? soSpark(soNatList(o)) + '<span class="so-wkt"><b>' + w.s + '점</b> ' + soRk(w.r, w.n) + '</span>' : '<span class="so-none">주간 기록 없음</span>') + '</span>';
  h += '<span class="so-sch">' + (sc ? '<b>' + soE(sc.math.score) + '점</b>' + (sc.math.grade ? ' · ' + soE(sc.math.grade) + '등급' : '') + (df == null ? '' : (df >= 0 ? ' <span class="so-up">↑' + df + '</span>' : ' <span class="so-dn">↓' + (-df) + '</span>')) + '<small>' + soE(sc.label + ' ' + sc.term) + (sc.math.rank ? ' · 석차 ' + soE(sc.math.rank) : '') + '</small>' : '<span class="so-none">입력 없음</span>') + '</span>';
  h += '<span class="so-dly">' + (dl.length ? up + '/' + dl.length + '<small>학원 평균 이상</small>' : '<span class="so-none">—</span>') + '</span></button>';
  return h;
}
window.soPick = function(id){ SO.sel = id; render(); };
window.soSetG = function(g){ SO.g = g; render(); };
window.soSetSort = function(s){ SO.sort = s; render(); };
window.soMore = function(k){ SO.more[k] = !SO.more[k]; render(); };
window.soReload = function(){ soLoad(true); try { plToast('↻ 다시 읽는 중…'); } catch(e){} };
window.soOpenProfile = function(id){ var st = soStudents().filter(function(s){ return s.id === id; })[0]; if (!st) return; selectStudent(st.name, st.grade); STUDENT_TAB = '성적'; render(); };
var SO_CSS = '<style>'
  + '.so-wrap{display:grid;grid-template-columns:minmax(0,500px) minmax(0,1fr);gap:14px;align-items:start}@media(max-width:1500px){.so-wrap{grid-template-columns:1fr}}'
  + '.so-left{background:#f5f7fb;border:1px solid #e2e8f0;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}'
  + '.so-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px}.so-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 11px;font:inherit;font-weight:800;font-size:12px;cursor:pointer;color:#475569}.so-chip.on{background:#0d2240;color:#fff;border-color:#0d2240}'
  + '.so-hdr,.so-row{display:grid;grid-template-columns:90px minmax(0,1.3fr) minmax(0,1.1fr) 76px;gap:8px;align-items:center}'
  + '.so-hdr{font-size:11px;color:#64748b;font-weight:800;padding:2px 10px}'
  + '.so-row{background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:8px 10px;cursor:pointer;text-align:left;font:inherit;color:#0d2240}.so-row.on{border-color:#1d6fe8;box-shadow:0 0 0 2px #eaf2ff}'
  + '.so-nm b{display:block;font-size:13.5px}.so-nm small{font-size:11px;color:#64748b;font-weight:700}'
  + '.so-wkc{display:flex;align-items:center;gap:8px;min-width:0}.so-spark{display:flex;gap:2px;align-items:flex-end;height:28px;flex:none}.so-spark i{display:block;width:6px;border-radius:2px 2px 1px 1px}'
  + '.so-wkt{min-width:0}.so-wkt b{font-size:14px}.so-rk{display:inline-flex;align-items:baseline;gap:3px;font-size:11.5px;font-weight:900;border-radius:7px;padding:1px 7px;white-space:nowrap}.so-rk small{font-size:9.5px;font-weight:800;opacity:.85}'
  + '.so-sch{font-size:12px;min-width:0}.so-sch b{font-size:13px}.so-sch small{display:block;color:#64748b;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.so-up{color:#16a34a;font-weight:900}.so-dn{color:#c2410c;font-weight:900}.so-none{font-size:11.5px;color:#94a3b8;font-weight:700}'
  + '.so-dly{font-size:12px;font-weight:800;text-align:right}.so-dly small{display:block;font-size:10px;color:#64748b;font-weight:700}'
  + '.so-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:13px 14px;margin-bottom:12px}.so-ct{display:flex;align-items:center;gap:6px;font-weight:900;font-size:14px;margin-bottom:8px;flex-wrap:wrap;color:#0d2240}.so-ct small{margin-left:auto;font-size:11px;color:#64748b;font-weight:700}'
  + '.so-kp{display:flex;gap:12px;flex-wrap:wrap;align-items:baseline;margin-bottom:6px}.so-kp b{font-size:26px;color:#0d2240}.so-note{font-size:11.5px;color:#64748b;line-height:1.55}'
  + '.so-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.so-tbl th{text-align:left;font-size:11px;color:#64748b;font-weight:800;padding:6px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.so-tbl td{padding:7px 6px;border-bottom:1px dashed #e2e8f0;vertical-align:top;white-space:nowrap}.so-tbl td.t{color:#64748b;font-size:11.5px;white-space:normal;min-width:180px}'
  + '.so-sem{display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:start;border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:8px}.so-sem b{display:block;font-size:13px}.so-sem small{font-size:11px;color:#64748b;font-weight:700}'
  + '.so-subj{display:flex;flex-wrap:wrap;gap:6px}.so-sj{border:1px solid #e2e8f0;border-radius:10px;padding:6px 9px;min-width:96px;font-size:11.5px;color:#64748b;background:#f5f7fb}.so-sj b{display:block;color:#0d2240;font-size:15px}.so-sj.m{border-color:#1d6fe8;background:#eaf2ff}'
  + '.so-more{border:1.5px dashed #cbd5e1;background:transparent;border-radius:9px;padding:5px 10px;font:inherit;font-size:12px;font-weight:800;color:#1d6fe8;cursor:pointer;margin-top:6px}'
  + '.so-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:800px){.so-two{grid-template-columns:1fr}}'
  + '.so-btn{border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer;background:#eef2f7;color:#0f172a}'
  + '</style>';
/* 전국주간 그래프 */
function soWkChart(L){
  var W2 = 560, H = 170, pl = 30, pr = 16, pt = 18, pb = 22;
  var x = function(i){ return pl + (L.length < 2 ? (W2 - pl - pr) / 2 : i * (W2 - pl - pr) / (L.length - 1)); }, y = function(v){ v = Math.max(0, Math.min(100, Number(v) || 0)); return pt + (100 - v) * (H - pt - pb) / 100; };
  var g = '';
  [0, 25, 50, 75, 100].forEach(function(v){ g += '<line x1="' + pl + '" x2="' + (W2 - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e2e8f0"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" font-size="10" text-anchor="end" fill="#94a3b8">' + v + '</text>'; });
  var av = L.filter(function(e){ return e.avg != null; });
  if (av.length > 1) g += '<polyline fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="4 4" points="' + L.map(function(e, i){ return e.avg != null ? x(i) + ',' + y(e.avg) : ''; }).filter(Boolean).join(' ') + '"/>';
  if (L.length > 1) g += '<polyline fill="none" stroke="#1d6fe8" stroke-width="2.4" stroke-linejoin="round" points="' + L.map(function(e, i){ return x(i) + ',' + y(e.s); }).join(' ') + '"/>';
  var step = Math.max(1, Math.ceil(L.length / 10));
  L.forEach(function(e, i){ var gg = soGrade(e.r, e.n), c = gg ? SO_GC[gg][0] : '#94a3b8';
    g += '<circle cx="' + x(i) + '" cy="' + y(e.s) + '" r="' + (i === L.length - 1 ? 6 : 4.5) + '" fill="' + c + '" stroke="#fff" stroke-width="1.5"><title>' + soE(soMD(e.d) + ' ' + e.s + '점') + '</title></circle>';
    if (i % step === 0 || i === L.length - 1) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="#64748b">' + soMD(e.d) + '</text>'; });
  return '<svg viewBox="0 0 ' + W2 + ' ' + H + '" style="display:block;width:100%;max-width:760px;height:auto" role="img" aria-label="전국주간 점수 추이">' + g + '</svg>';
}
function soDyChart(L){
  var Wd = 300, Hd = 150, mid = 75, bw = (Wd - 16) / Math.max(1, L.length), g = '<line x1="0" x2="' + Wd + '" y1="' + mid + '" y2="' + mid + '" stroke="#64748b"/>';
  L.forEach(function(e, i){ var df = Math.round(e.s - e.avg), hh = Math.min(60, Math.abs(df) * 3.2), xx = 8 + i * bw + bw * .2, wd = bw * .6, c = df >= 0 ? '#16a34a' : '#c2410c';
    g += '<rect x="' + xx + '" y="' + (df >= 0 ? mid - hh : mid) + '" width="' + wd + '" height="' + Math.max(2, hh) + '" rx="3" fill="' + c + '"><title>' + soE(soMD(e.d) + ' ' + e.s + '점 · 학원 평균 ' + e.avg) + '</title></rect><text x="' + (xx + wd / 2) + '" y="' + (df >= 0 ? mid - hh - 4 : mid + hh + 11) + '" font-size="10" font-weight="800" text-anchor="middle" fill="' + c + '">' + (df >= 0 ? '+' : '') + df + '</text>'; });
  return '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" style="display:block;width:100%;max-width:520px;height:auto" role="img" aria-label="일일테스트 학원 평균과의 차이">' + g + '</svg>';
}
/* 학생 한 명 — 성적 한눈에 오른쪽 · 학생 프로필 «📈 성적» 탭이 같이 쓴다 */
function soDetail(st, inProfile){
  var o = soOf(st), NL = soNatList(o), w = soLast(NL);
  var h = '';
  if (!inProfile) h += '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;margin-bottom:10px"><b style="font-size:19px;color:#0d2240">' + soE(st.name) + '</b><span class="so-note">' + soE(soShortGrade(st.grade)) + (st.group ? ' · ' + soE(st.group) : '') + (st.school ? ' · ' + soE(st.school) : '') + '</span><button type="button" class="so-btn" onclick="soOpenProfile(\'' + soE(st.id) + '\')">👤 학생 프로필 열기</button></div>';
  /* 전국주간 */
  h += '<div class="so-card"><div class="so-ct">🌐 전국주간테스트 <small>전국 같은 학년 · 같은 시험지</small></div>';
  if (!w) h += '<p class="so-note">아직 주간테스트 기록이 없어요.</p>';
  else {
    var pw = NL.length > 1 ? NL[NL.length - 2] : null, d = pw ? w.s - pw.s : null;
    h += '<div class="so-kp"><b>' + w.s + '점</b>' + soRk(w.r, w.n) + '<span class="so-note">' + (w.r && w.n ? '상위 ' + Math.max(1, Math.round(w.r / w.n * 100)) + '%' : '') + (w.avg != null ? ' · 전국 평균 ' + w.avg + '점' : '') + (d != null ? ' · 지난번보다 <span class="' + (d >= 0 ? 'so-up' : 'so-dn') + '">' + (d >= 0 ? '+' : '') + d + '</span>' : '') + '</span></div>';
    h += '<div class="so-note" style="color:#0d2240;font-weight:700;margin-bottom:4px">' + soE(w.t) + '</div>';
    h += soWkChart(o.wk.slice(-16));
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:11px;color:#64748b;font-weight:700;margin-top:4px"><span><i style="display:inline-block;width:14px;height:3px;background:#1d6fe8;vertical-align:middle;margin-right:4px"></i>점수</span><span><i style="display:inline-block;width:14px;height:3px;background:#94a3b8;vertical-align:middle;margin-right:4px"></i>전국 평균</span>'
      + [1, 2, 3, 4, 5].map(function(n){ return '<span class="so-rk" style="color:' + SO_GC[n][0] + ';background:' + SO_GC[n][1] + '">' + n + '등급</span>'; }).join('') + '<span>전국 상위 10·30·50·70%</span></div>';
    h += '<div style="overflow-x:auto;margin-top:8px"><table class="so-tbl"><thead><tr><th>날짜</th><th>시험지</th><th>점수</th><th>전국 평균</th><th>전국 위치</th><th>학원 평균</th></tr></thead><tbody>';
    o.wk.slice().reverse().forEach(function(e){ h += '<tr><td>' + soMD(e.d) + '</td><td class="t">' + soE(e.t) + '</td><td><b>' + e.s + '</b></td><td>' + (e.avg != null ? e.avg : '—') + '</td><td>' + (e.nat ? soRk(e.r, e.n) : '<span class="so-none">고등 자체</span>') + '</td><td>' + (e.acadAvg != null ? e.acadAvg : '—') + '</td></tr>'; });
    h += '</tbody></table></div>';
  }
  h += '</div><div class="so-two"><div class="so-card"><div class="so-ct">🎓 학교 시험 <small>실제 성적표 · 수학</small></div>';
  if (!o.sch.length) h += '<p class="so-note">아직 입력한 학교 성적이 없어요. «🎓 학교성적»에서 넣으면 여기에 이어집니다.</p>';
  else o.sch.slice().reverse().forEach(function(c){
    var k = st.id + '_' + c.key, op = !!SO.more[k];
    h += '<div class="so-sem"><span><b>' + soE(c.label) + ' ' + soE(c.term) + '</b><small>' + (c.math && c.math.avg ? '학교 평균 ' + soE(c.math.avg) + '점' : soE(c.school || '')) + '</small></span><span><span class="so-subj">';
    h += c.math ? '<span class="so-sj m"><b>' + soE(c.math.score) + '점</b>수학' + (c.math.grade ? ' · ' + soE(c.math.grade) + '등급' : '') + (c.math.rank ? ' · ' + soE(c.math.rank) : '') + '</span>' : '<span class="so-sj">수학 없음</span>';
    if (op) c.others.forEach(function(x){ h += '<span class="so-sj"><b>' + soE(x.score) + '</b>' + soE(x.name) + (x.grade ? ' · ' + soE(x.grade) + '등급' : '') + '</span>'; });
    h += '</span>' + (c.others.length ? '<button type="button" class="so-more" onclick="soMore(\'' + soE(k) + '\')">' + (op ? '－ 접기' : '＋ 다른 과목 ' + c.others.length) + '</button>' : '') + '</span></div>';
  });
  h += '</div><div class="so-card"><div class="so-ct">📝 일일테스트 <small>그날 학원 평균과의 차이</small></div>';
  var dl = o.dy.filter(function(x){ return x.avg != null; }).slice(-10);
  if (!dl.length) h += '<p class="so-note">학원 평균이 적힌 일일테스트 기록이 없어요.</p>';
  else h += soDyChart(dl) + '<p class="so-note">최근 ' + dl.length + '회 중 ' + dl.filter(function(x){ return x.s >= x.avg; }).length + '회 학원 평균 이상 · 마지막 ' + soMD(soLast(dl).d) + ' ' + soLast(dl).s + '점</p>';
  h += '</div></div>';
  return h;
}
/* 새 메뉴 화면 */
function rScoreOv(){
  soLoad(false);
  var all = soStudents(), gs = [];
  all.forEach(function(s){ var g = soShortGrade(s.grade); if (g && gs.indexOf(g) < 0) gs.push(g); });
  var ord = { '초': 0, '중': 1, '고': 2 }; gs.sort(function(a, b){ return (ord[a[0]] - ord[b[0]]) || (a < b ? -1 : 1); });
  var L = all.filter(function(s){ return SO.g === 'all' || soShortGrade(s.grade) === SO.g; }).map(function(s){ return { st: s, o: soOf(s) }; });
  if (SO.sort === 'rank') L.sort(function(a, b){ var x = soPct(soLast(soNatList(a.o))), y = soPct(soLast(soNatList(b.o))); return (x == null ? 9 : x) - (y == null ? 9 : y); });
  else if (SO.sort === 'drop') L.sort(function(a, b){ return soDrop(b.o) - soDrop(a.o); });
  else L.sort(function(a, b){ return String(a.st.name).localeCompare(String(b.st.name), 'ko'); });
  if (!SO.sel || !L.some(function(x){ return x.st.id === SO.sel; })) SO.sel = L.length ? L[0].st.id : null;
  var h = SO_CSS + '<div style="font-size:13px;color:#475569;margin-bottom:10px;line-height:1.6">학생마다 <b>전국주간</b>(최근 6회 · 전국 위치 378/823명) · <b>학교 시험</b>(수학) · <b>일일테스트</b>를 한 줄로 봅니다. 줄을 누르면 오른쪽에 자세히 나옵니다. 색 = 전국 상위 % 등급(10·30·50·70%).'
    + (SO.busy && !SO.loaded ? ' <b>불러오는 중…</b>' : '') + '</div>';
  h += '<div class="so-wrap"><div class="so-left"><div class="so-top"><button type="button" class="so-chip' + (SO.g === 'all' ? ' on' : '') + '" onclick="soSetG(\'all\')">전체</button>'
    + gs.map(function(g){ return '<button type="button" class="so-chip' + (SO.g === g ? ' on' : '') + '" onclick="soSetG(\'' + g + '\')">' + g + '</button>'; }).join('') + '</div>';
  h += '<div class="so-top" style="font-size:12px;color:#64748b;font-weight:700">정렬 ' + [['name', '이름'], ['rank', '전국 위치'], ['drop', '최근 하락 큰 순']].map(function(x){ return '<button type="button" class="so-chip' + (SO.sort === x[0] ? ' on' : '') + '" onclick="soSetSort(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('')
    + '<span style="flex:1"></span><button type="button" class="so-btn" onclick="soReload()">↻ 새로</button></div>';
  h += '<div class="so-hdr"><span>학생</span><span>🌐 전국주간 · 최근 6회</span><span>🎓 최근 학교 시험(수학)</span><span>📝 일일</span></div>';
  h += L.length ? L.map(function(x){ return soRow(x.st, x.o); }).join('') : '<p class="so-note">학생이 없어요.</p>';
  h += '</div><div style="min-width:0">';
  var sel = L.filter(function(x){ return x.st.id === SO.sel; })[0];
  h += sel ? soDetail(sel.st, false) : '<p class="so-note">학생을 골라 주세요.</p>';
  return h + '</div></div>';
}
/* 학생 프로필 «📈 성적» 탭 */
function soStudentTab(name, grade, stInfo){
  soLoad(false);
  var st = stInfo || soStudents().filter(function(s){ return s.name === name; })[0];
  if (!st) return '<div style="padding:20px;color:#64748b">등록부에서 학생을 찾지 못했어요.</div>';
  return SO_CSS + '<div style="padding:14px 16px">' + soDetail(st, true) + '</div>';
}
