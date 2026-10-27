/* ═══════════════════════════════════════════════════════════════════
 * v19-161: 📋 상담 리포트 (원장 10/26 「학원앱에 상담 리포트 v19-161 로 만들어줘 · 주간테스트는 과정별(중1-1·중1-2) 그래프 ·
 *   숙제 현황판은 빼자 · 월별 공부 시간에서 수학 시간을 일평균으로」 — 설계 docs/consult_report_design.md)
 *   학생 한 명 + 기간(기본 3개월) + «집중 교재»(기본 = 진도 현황 대표 교재) → 학부모 상담용 그래프 리포트.
 *   읽기만 한다: BP(진도) · WK.tests(주간테스트) · mf_answer_records(학생 한 명·기간, 색인 idx_mf_ans_student) ·
 *     lumen_store hw_scores_<코드>(학생앱 채점 입력) · aha_notes(질문 수) · 학생 기록(lumen_hw · lumen_study_time · 플래너 사진 분석 · 수업 메모 · 출결)
 *   쓰기: lumen_store consult_<코드> { list:[{ at, from, to, focus, plan, home, nums }] } — 「💾 저장」 때만
 *   인쇄: 새 창에 리포트만 옮겨 인쇄(원장 메모 빠짐) — PDF 로 저장해 카톡으로 보낼 수 있다
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 그래프는 SVG 글자로 만들어 인쇄 창에도 그대로 간다.
 * ═══════════════════════════════════════════════════════════════════ */
var CR = { code: '', months: 3, focus: '', data: null, loading: false, err: '', memo: true, plan: null, home: null, saving: false, savedAt: '' };
var CRC = { ink: '#15233b', mute: '#5f6b80', grid: '#eceff4', line: '#e3e7ee', avg: '#9aa5b5', paper: '#ffffff',
  b: ['#e0670b', '#0d9488', '#2563eb', '#b5367f'], q1: '#0d2240', q2: '#5677a6', q3: '#a9bddb', bad: '#c81e1e', ok: '#15803d', warn: '#b45309' };

/* ── 날짜 ── */
function crToday(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function crT(s){ return Date.parse(String(s).slice(0, 10) + 'T00:00:00Z'); }
function crIso(t){ return new Date(t).toISOString().slice(0, 10); }
function crAdd(s, n){ return crIso(crT(s) + n * 86400000); }
function crMD(s){ s = String(s); return (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)); }
function crKday(ts){ return new Date(Date.parse(ts) + 9 * 3600000).toISOString().slice(0, 10); }
function crDow(s){ return new Date(crT(s)).getUTCDay(); }
function crMon(s){ var w = crDow(s); return crAdd(s, w === 0 ? -6 : 1 - w); }
function crE(s){ return (typeof esc2 === 'function') ? esc2(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function crHm(min){ min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return h ? (h + '시간' + (m ? ' ' + m + '분' : '')) : (m + '분'); }

/* ── SVG 글자 조각 ── */
function sT(x, y, s, o){ o = o || {}; return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (o.a || 'middle') + '" font-size="' + (o.fs || 11) + '" font-weight="' + (o.w || 400) + '" fill="' + (o.c || CRC.mute) + '">' + crE(s) + '</text>'; }
function sL(x1, y1, x2, y2, c, w, dash){ return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + c + '" stroke-width="' + (w || 1) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
function sP(pts, c, w, dash){ if (pts.length < 2) return ''; return '<polyline points="' + pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + c + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
function sC(x, y, r, c, tip, op){ return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + c + '"' + (op ? ' fill-opacity="' + op + '"' : '') + ' stroke="#fff" stroke-width="1.5">' + (tip ? '<title>' + crE(tip) + '</title>' : '') + '</circle>'; }
function sR(x, y, w, h, c, op, rx, tip){ return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="' + (rx || 0) + '" fill="' + c + '"' + (op != null ? ' fill-opacity="' + op + '"' : '') + '>' + (tip ? '<title>' + crE(tip) + '</title>' : '') + '</rect>'; }
function sB(x, y0, y1, w, c, tip){ var h = y0 - y1; if (h <= 0) return ''; var r = Math.min(4, w / 2, h);
  return '<path d="M' + x.toFixed(1) + ',' + y0.toFixed(1) + 'V' + (y1 + r).toFixed(1) + 'Q' + x.toFixed(1) + ',' + y1.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y1.toFixed(1) + 'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ',' + y1.toFixed(1) + ' ' + (x + w).toFixed(1) + ',' + (y1 + r).toFixed(1) + 'V' + y0.toFixed(1) + 'Z" fill="' + c + '">' + (tip ? '<title>' + crE(tip) + '</title>' : '') + '</path>'; }
function sSvg(w, h, body, label){ return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + crE(label) + '" style="display:block;width:100%;height:auto">' + body + '</svg>'; }
function sYAxis(L, R, Y, ticks, fmt){ return ticks.map(function(v){ return sL(L, Y(v), R, Y(v), CRC.grid, 1) + sT(L - 8, Y(v) + 4, fmt ? fmt(v) : String(v), { a: 'end' }); }).join(''); }

/* ── 교재 이름 ── */
function crBookName(bid){ var md = (BP.books || {})[bid] || {}; return String(md.n || ('교재 ' + bid)).replace(/\s+/g, ' ').trim(); }
function crAbbr(bid){ var n = crBookName(bid);
  if (/유형편/.test(n)) return '유형편'; if (/개념편/.test(n)) return '개념편';
  var m = n.split(/\s+-\s+|\s/)[0]; return m.length > 6 ? m.slice(0, 6) : m; }
function crNorm(s){ return String(s || '').replace(/[\s\-·]/g, ''); }

/* ── 자료 읽기 ── */
function crStu(){ var c = CR.code; return (students || []).filter(function(s){ return s && String(s.lumen_rec_code || '') === c; })[0] || null; }
window.crOpen = function(code){
  if (code) CR.code = String(code);
  CR.data = null; CR.focus = ''; CR.plan = null; CR.home = null; CR.err = ''; CR.savedAt = '';
  VIEW = 'consult'; render();
};
window.crSetStu = function(code){ crOpen(code); };
window.crSetMonths = function(m){ CR.months = +m || 3; CR.data = null; CR.plan = null; CR.home = null; render(); };
window.crSetFocus = function(bid){ CR.focus = String(bid); CR.plan = null; render(); };
window.crToggleMemo = function(){ CR.memo = !CR.memo; render(); };
async function crLoad(){
  if (CR.loading) return; CR.loading = true; CR.err = '';
  try {
    var st = crStu(); if (!st) throw new Error('학생을 고르세요');
    var sb = getSupaClient(); if (!sb) throw new Error('서버에 연결되지 않았습니다');
    try { await bpLoad(); } catch(e){}
    try { if (typeof wkLoad === 'function') await wkLoad(); } catch(e){}
    var sid = bpSidOf(st); if (sid == null) throw new Error('매쓰플랫과 연결되지 않은 학생입니다 (학생관리의 🔗 띠 참고)');
    var to = crToday(), from = crAdd(to, -Math.round(CR.months * 30.44));
    var recs = await raceFetchAll(sb, 'mf_answer_records', 'source,book_id,result,score_datetime,worksheet_title,student_worksheet_id',
      function(q){ return q.eq('mf_student_id', sid).gte('score_datetime', crAdd(from, -14) + 'T00:00:00').order('score_datetime', { ascending: true }); });
    var code = String(st.lumen_rec_code);
    var r2 = await sb.from('lumen_store').select('key,value').in('key', ['hw_scores_' + code, 'consult_' + code]);
    var hws = {}, saved = [];
    (r2.data || []).forEach(function(row){ var v = row.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      if (row.key === 'hw_scores_' + code) hws = (v && v.items) || {}; else saved = (v && v.list) || []; });
    var aha = [];
    try { var r3 = await sb.from('aha_notes').select('created_at').eq('student_code', code).gte('created_at', crAdd(from, -62) + 'T00:00:00'); aha = (r3.data || []).map(function(x){ return x.created_at; }); } catch(e){}
    CR.data = { code: code, sid: sid, from: from, to: to, recs: recs || [], hws: hws, aha: aha, saved: saved };
    if (saved.length) CR.savedAt = String(saved[saved.length - 1].at || '').slice(0, 10);
  } catch(e){ CR.err = e.message || String(e); }
  CR.loading = false;
  try { if (VIEW === 'consult') render(); } catch(e){}
}

/* ── 계산 ── */
var CR_MATH_RE = /수학|RPM|rpm|최상위|개념|쎈|디딤돌|유형|연산|매쓰|오답|리커버리|문제|프린트|학습지/;
var CR_NOTMATH_RE = /영어|한우리|국어|받아쓰기|어휘|단어|책읽기|독서|과학|사회|피아노|태권/;
function crCompute(){
  var d = CR.data, st = crStu(); if (!d || !st) return null;
  var from = d.from, to = d.to, sid = d.sid, X = { st: st, from: from, to: to };
  /* 문항 기록 → 교재·날짜별 */
  var byB = {}, ws = {}, tot = {}, wsheets = {};
  d.recs.forEach(function(r){
    var day = crKday(r.score_datetime);
    if (r.source === '교재' && r.book_id){ var b = String(r.book_id); (byB[b] = byB[b] || {})[day] = (byB[b][day] || 0) + 1; if (day >= from) tot[b] = (tot[b] || 0) + 1; }
    else if (r.source === '학습지'){ ws[day] = (ws[day] || 0) + 1;
      var k = r.student_worksheet_id || (r.worksheet_title + day); var w = wsheets[k] = wsheets[k] || { t: r.worksheet_title || '', day: day, n: 0, o: 0 };
      if (day < w.day) w.day = day; if (r.result === 'O'){ w.n++; w.o++; } else if (r.result === 'X'){ w.n++; } }
  });
  var books = Object.keys(tot).sort(function(a, b){ return tot[b] - tot[a]; });
  var row = bpStudentRow(st); X.row = row;
  var focus = CR.focus && (tot[CR.focus] || (BP.prog[sid] || {})[CR.focus]) ? CR.focus : ((row && row.bid && (tot[row.bid] || !books.length)) ? String(row.bid) : (books[0] || (row && row.bid ? String(row.bid) : '')));
  X.focus = focus; X.books = books; X.tot = tot; X.byB = byB; X.ws = ws;
  if (focus) books = [focus].concat(books.filter(function(b){ return b !== focus; })); X.books = books;
  X.color = {}; var ci = 1; books.forEach(function(b){ X.color[b] = (b === focus) ? CRC.b[0] : CRC.b[Math.min(3, ci++)]; });
  var fmd = (BP.books || {})[focus] || {}; X.fname = crBookName(focus); X.fshort = crAbbr(focus); X.fg = String(fmd.g || '');
  /* 수업일 판 */
  var dows = (st.group && typeof groupDays !== 'undefined' && groupDays[st.group]) || [], cls = [];
  for (var t = crT(crAdd(from, -14)); t <= crT(to); t += 86400000){ var ds = crIso(t); if (dows.indexOf(crDow(ds)) >= 0 && !(typeof CT_HOLI !== 'undefined' && CT_HOLI[ds])) cls.push(ds); }
  var board = [];
  for (var i = 1; i < cls.length; i++){ if (cls[i] < from) continue;
    var prev = cls[i - 1], c = cls[i], k = 0, oth = {};
    Object.keys(byB[focus] || {}).forEach(function(day){ if (day > prev && day <= c) k += byB[focus][day]; });
    books.forEach(function(b){ if (b === focus) return; Object.keys(byB[b] || {}).forEach(function(day){ if (day > prev && day <= c) oth[b] = (oth[b] || 0) + byB[b][day]; }); });
    var ob = Object.keys(oth).sort(function(a, b){ return oth[b] - oth[a]; })[0];
    board.push({ d: c, k: k, other: ob ? crAbbr(ob) : '' }); }
  X.board = board.slice(-20); X.noDays = !dows.length;
  X.bFull = X.board.filter(function(b){ return b.k >= 10; }).length; X.bPart = X.board.filter(function(b){ return b.k > 0 && b.k < 10; }).length; X.bNone = X.board.length - X.bFull - X.bPart;
  /* 집중 교재 빈 기간 (하루 2문항 이하가 7일 넘게) */
  var fd = byB[focus] || {}, firstAct = Object.keys(fd).filter(function(x){ return x >= from; }).sort()[0], gaps = [];
  if (firstAct){ var run = null;
    for (var t2 = crT(firstAct); t2 <= crT(to); t2 += 86400000){ var dd = crIso(t2), v = fd[dd] || 0;
      if (v <= 2){ if (!run) run = { a: dd, n: 0, k: 0 }; run.n++; run.k += v; run.b = dd; }
      else { if (run && run.n >= 7) gaps.push(run); run = null; } }
    if (run && run.n >= 7) gaps.push(run); }
  X.gaps = gaps;
  /* 주별 */
  var other = books.filter(function(b){ return b !== focus; })[0] || '', weeks = [];
  for (var w = crMon(from); w <= to; w = crAdd(w, 7)){ var a = 0, o = 0;
    for (var j = 0; j < 7; j++){ var dj = crAdd(w, j); a += fd[dj] || 0; o += (byB[other] || {})[dj] || 0; }
    weeks.push({ w: w, a: a, o: o, cur: crAdd(w, 6) >= to }); }
  X.weeks = weeks; X.other = other;
  /* 진도 */
  var pd = (BP.prog[sid] || {})[focus] || null; X.pd = pd;
  if (pd){ var total = bpTotalPages(focus), start = bpStartOfB(sid, focus, pd), limD = Math.round(bpMonthsOf(focus) * 30.44);
    var mid = (typeof bpMidStd === 'function') && bpMidStd(focus);
    var elapsed = start ? Math.max(1, Math.round((crT(to) - crT(start)) / 86400000) + 1) : null;
    var pct = total.n ? Math.min(100, Math.round(pd.maxPage / total.n * 100)) : null, pace = Number(pd.weekPages) || 0, need = null;
    if (total.n && !total.est && pd.maxPage < total.n && start){ var by = crT(start) + limD * 86400000, now = crT(to); if (by < now + 35 * 86400000) by = now + 35 * 86400000;
      need = { by: crIso(by), wk: Math.max(1, Math.ceil((total.n - pd.maxPage) / ((by - now) / (7 * 86400000)))), remain: total.n - pd.maxPage }; }
    X.prog = { total: total, start: start, limD: limD, tgtD: mid ? Math.round(2 * 30.44) : null, elapsed: elapsed, pct: pct, pace: pace, need: need, max: pd.maxPage,
      status: (row && String(row.bid) === String(focus)) ? row.status : '', why: (row && String(row.bid) === String(focus)) ? row.why : '' }; }
  /* 교재별 월 진행·정답률 */
  var mons = []; for (var m = from.slice(0, 7); m <= to.slice(0, 7); m = crIso(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7)) mons.push(m);
  X.mons = mons;
  X.mBooks = books.slice(0, 4).map(function(b){ var p = (BP.prog[sid] || {})[b] || {}, ms = p.months || {}, keys = Object.keys(ms).sort();
    return { b: b, pages: mons.map(function(mm){ if (!ms[mm]) return (p.firstDate && String(p.firstDate).slice(0, 7) <= mm && String(p.lastDate || '').slice(0, 7) >= mm) ? 0 : null;
        var prevK = keys.filter(function(k){ return k < mm; }).pop(); return Math.max(0, (ms[mm].maxP || 0) - (prevK ? (ms[prevK].maxP || 0) : 0)); }),
      acc: mons.map(function(mm){ var x = ms[mm]; return (x && x.t >= 10) ? Math.round(x.c / x.t * 100) : null; }) }; });
  /* 시험 — 과정별 */
  var tests = [];
  ((typeof WK !== 'undefined' && WK.tests) || []).forEach(function(tt){ var me = (tt.students || []).filter(function(s){ return String(s.sid) === String(sid); })[0]; if (!me || me.score == null) return;
    var day = String(me.date || tt.date || '').slice(0, 10); if (!day || day < from) return;
    var p = tt.paper || {}, lab = String(p.label || '');
    if (lab && lab.indexOf('-') < 0){ var sem = p.sem; if (!sem){ var mt = String(tt.title || '').match(/\((\d{4})\.(\d{2})\.\d{2}\)/); if (mt) sem = (+mt[2] <= 6) ? 1 : 2; } if (sem) lab = lab + '-' + sem; }
    tests.push({ d: day, s: me.score, avg: me.acadAvg, rank: me.acadRank, n: me.acadN, type: tt.type, title: tt.title || '', lab: lab || '기타', wc: me.wrongConcepts || [] }); });
  tests.sort(function(a, b){ return a.d < b.d ? -1 : 1; }); X.tests = tests;
  var labs = []; tests.forEach(function(x){ if (labs.indexOf(x.lab) < 0) labs.push(x.lab); });
  labs.sort(function(a, b){ var la = tests.filter(function(x){ return x.lab === a; }).pop().d, lb = tests.filter(function(x){ return x.lab === b; }).pop().d; return la < lb ? 1 : -1; });
  if (X.fg){ var fl = X.fg.indexOf('-') < 0 ? null : X.fg; if (fl){ labs = labs.filter(function(l){ return l !== fl; }); labs.unshift(fl); } }
  X.labs = labs.slice(0, 4);
  var fn = crNorm(X.fname.replace(/\(\d{4}\)/, ''));
  X.fws = Object.keys(wsheets).map(function(k){ return wsheets[k]; }).filter(function(w){ return w.day >= from && w.n >= 3 && fn && crNorm(w.t).indexOf(fn) >= 0; }).sort(function(a, b){ return a.day < b.day ? -1 : 1; });
  /* 틀린 개념 (최근 5주) */
  var wc = {}, wcFrom = crAdd(to, -35), wcT = [];
  tests.forEach(function(x){ if (x.d < wcFrom) return; wcT.push(x); x.wc.forEach(function(c){ if (c && c.n) wc[c.n] = (wc[c.n] || 0) + (c.cnt || 1); }); });
  X.wrong = Object.keys(wc).map(function(k){ return [k, wc[k]]; }).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 8); X.wrongN = wcT.length;
  /* 숙제 단계 월 평균 */
  X.hwm = mons.map(function(mm){ var n = 0, p = 0, c2 = 0, w2 = 0; Object.keys(st.lumen_hw || {}).forEach(function(k){ if (k.slice(0, 7) !== mm || k < from) return; var v = (typeof hwcNorm === 'function') ? hwcNorm(st.lumen_hw[k]) : null; if (!v) return; n++; p += v.p; c2 += v.c; w2 += v.w; });
    return n ? { n: n, p: Math.round(p / n), c: Math.round(c2 / n), w: Math.round(w2 / n) } : null; });
  /* 학생앱 채점 입력 */
  var app = {}; Object.keys(d.hws || {}).forEach(function(k){ var it = d.hws[k]; if (!it || !it.at) return; var day = crKday(it.at); if (day < from) return; var a2 = app[day] = app[day] || { n: 0, o: 0 }; a2.n++; if (it.r === 'O') a2.o++; });
  X.app = app;
  /* 공부 시간 — 월별 하루 평균 · 수학은 플래너 할 일 비율로 */
  var stt = st.lumen_study_time || {}, photos = st.lumen_planner_photos || [];
  X.time = mons.map(function(mm){ var days = 0, min = 0;
    Object.keys(stt).forEach(function(k){ var kk = k.replace(/\./g, '-'); if (kk.slice(0, 7) !== mm || kk < from) return; var v = Number(stt[k]) || 0; if (v > 0){ days++; min += v; } });
    var tn = 0, tm = 0; photos.forEach(function(ph){ var a3 = ph && ph.analysis; if (!a3 || !a3.date) return; var dd2 = String(a3.date).replace(/\./g, '-'); if (dd2.slice(0, 7) !== mm) return;
      (a3.tasksTranscript || []).forEach(function(tk){ tn++; if (CR_MATH_RE.test(tk) && !CR_NOTMATH_RE.test(tk)) tm++; }); });
    var share = tn >= 4 ? tm / tn : null;
    return { m: mm, days: days, avg: days ? min / days : null, math: (days && share != null) ? (min / days) * share : null, share: share, tn: tn }; });
  /* 아하노트 */
  X.aha = mons.map(function(mm){ return d.aha.filter(function(a4){ return crKday(a4).slice(0, 7) === mm; }).length; });
  /* 원장 메모 */
  var memo = [];
  var fake = photos.filter(function(ph){ var a5 = ph && ph.analysis; if (!a5 || a5.zeroCleared || !(a5.zeroReason === 'dup' || a5.zeroReason === 'sameDate')) return false; var dd3 = String(a5.date || '').replace(/\./g, '-'); return dd3 >= from; })
    .map(function(ph){ return crMD(String(ph.analysis.date).replace(/\./g, '-')); });
  if (fake.length) memo.push('<b>플래너</b>: ' + fake.join(' · ') + ' 사진이 예전 사진과 같은 쪽(또는 같은 날짜)으로 감지됐습니다. 상담 전에 사진을 직접 확인하세요.');
  var att = st.lumen_attendance || {}, ab = 0, lt = 0; Object.keys(att).forEach(function(k){ if (k < from) return; var s2 = att[k] && att[k].status; if (s2 === 'absent') ab++; else if (s2 === 'late') lt++; });
  memo.push('<b>출결</b>: 기간 중 결석 ' + ab + '회 · 지각 ' + lt + '회');
  var cm = st.lumen_classMemo || {}; Object.keys(cm).map(function(k){ return [k.replace(/\./g, '-'), cm[k]]; }).filter(function(x){ return x[1] && x[0] >= crAdd(from, -120); }).sort().slice(-4)
    .forEach(function(x){ memo.push('<b>수업 메모 ' + crMD(x[0]) + '</b>: ' + crE(String(x[1]).replace(/\n/g, ' '))); });
  var lastAha = d.aha.slice().sort().pop(); memo.push('<b>아하노트</b>: 마지막 질문 ' + (lastAha ? crMD(crKday(lastAha)) : '없음'));
  books.forEach(function(b){ if (b === focus) return; var p = (BP.prog[sid] || {})[b]; var lm = p && p.months && p.months[to.slice(0, 7)]; if (lm && lm.t >= 20 && lm.c / lm.t < 0.65) memo.push('<b>' + crE(crAbbr(b)) + '</b>: 이번 달 정답률 ' + Math.round(lm.c / lm.t * 100) + '% (' + lm.t + '문항)'); });
  X.memo = memo;
  /* 계획 기본 문장 */
  var plan = [];
  if (X.prog && X.prog.need) plan.push(X.fshort + ' 주 ' + X.prog.need.wk + '쪽씩 → ' + crMD(X.prog.need.by) + ' 완주');
  else if (X.bNone > X.bFull) plan.push(X.fshort + ' 숙제는 수업마다 확인 (채점까지 올리기)');
  if (X.wrong.length) plan.push(X.wrong.slice(0, 2).map(function(w3){ return w3[0]; }).join(' · ') + ' — 틀린 유형 학습지 주 1회');
  var lastHw = X.hwm.filter(Boolean).pop(); if (lastHw && (lastHw.c < 40 || lastHw.w < 40)) plan.push('수업 시작 10분, 지난 숙제의 채점·오답 정리를 함께 확인');
  var ahaLast = X.aha[X.aha.length - 1], ahaPrev = X.aha.slice(0, -1); if (ahaPrev.length && ahaLast * 2 < (ahaPrev.reduce(function(a6, b6){ return a6 + b6; }, 0) / ahaPrev.length)) plan.push('모르는 문제는 아하노트로 주 2개 (어려우면 수업 중에 말로)');
  X.planDef = plan.join('\n');
  X.homeDef = ['숙제를 끝냈다고 하면 «학생앱에 채점까지 했니?» 한 번만 물어봐 주세요', '플래너에 그날 수학 공부 시간을 따로 적게 해 주세요', '다른 과목 숙제가 몰리는 요일이 있으면 알려 주세요'].join('\n');
  return X;
}

/* ── 그래프 ── */
function crBoardHtml(X){
  if (X.noDays) return '<div class="cr-note">반 수업 요일이 등록되어 있지 않아 수업별 판을 그리지 못했습니다 (출결 · 반 요일 설정).</div>';
  if (!X.board.length) return '<div class="cr-note">기간 안에 수업일이 없습니다.</div>';
  return '<div class="cr-big"><b>' + X.bFull + '번</b><span>10문항 이상 해 온 수업</span><b style="color:' + CRC.warn + '">' + X.bPart + '번</b><span>1~9문항만</span><b style="color:' + CRC.mute + '">' + X.bNone + '번</b><span>안 해 옴</span></div>'
    + '<div class="cr-cls">' + X.board.map(function(c){ var k = c.k >= 10 ? 'full' : (c.k > 0 ? 'part' : 'none');
      return '<div class="cr-cd ' + k + '" title="' + crMD(c.d) + ' 수업까지 ' + crE(X.fshort) + ' ' + c.k + '문항' + (c.other ? ' · ' + crE(c.other) + '는 해 옴' : '') + '"><div class="d">' + crMD(c.d) + '</div><div class="m">' + (k === 'full' ? '✓' : (k === 'part' ? '△' : '✗')) + '</div><div class="n">' + (c.k ? c.k + '문항' : (c.other ? '<span class="rp">' + crE(c.other) + '</span>' : '')) + '</div></div>'; }).join('') + '</div>'
    + '<div class="cr-legend"><span><i style="background:' + CRC.b[0] + '"></i>해 옴 (10문항 이상)</span><span><i style="background:#fbe3d2;border:1px solid ' + CRC.b[0] + '"></i>조금 (1~9문항)</span><span><i style="border:2px dashed ' + CRC.bad + ';background:#fff"></i>안 해 옴</span><span><b style="color:' + CRC.b[1] + ';font-size:11px">다른 교재 이름</b> = 같은 기간 그 교재는 해 옴</span></div>';
}
function crLane(X){
  var W = 900, X0 = 200, X1 = 885, t0 = crT(X.from), t1 = crT(X.to) + 86400000, xp = function(ds){ return X0 + (crT(ds) + 43200000 - t0) / (t1 - t0) * (X1 - X0); };
  var lanes = X.books.slice(0, 3).map(function(b){ var nm = crBookName(b).replace(/^개념\+유형 /, ''); return { name: (b === X.focus ? '★ ' : '') + (nm.length > 14 ? nm.slice(0, 14) + '…' : nm), data: X.byB[b] || {}, c: X.color[b], hot: b === X.focus }; });
  lanes.push({ name: '학습지 · 테스트', data: X.ws, c: CRC.avg });
  var H = 30 + lanes.length * 52 + 30, b = '';
  X.gaps.forEach(function(g){ var x1 = xp(g.a) - 4, x2 = xp(g.b) + 4; b += sR(x1, 14, x2 - x1, 46, CRC.bad, 0.1, 6, g.n + '일 동안 ' + g.k + '문항'); b += sT((x1 + x2) / 2, 30, g.n + '일' + (g.k ? ' 동안 ' + g.k + '문항' : ' 비어 있음'), { fs: 11, w: 800, c: CRC.bad }); });
  for (var t = t0; t < t1; t += 86400000){ var ds = crIso(t); if (+ds.slice(8, 10) === 1 || +ds.slice(8, 10) === 15){ var x = xp(ds); b += sL(x, 12, x, H - 30, CRC.grid, 1) + sT(x, H - 12, crMD(ds)); } }
  lanes.forEach(function(ln, i){ var y = 40 + i * 52; b += sL(X0, y, X1, y, CRC.grid, ln.hot ? 2 : 1) + sT(X0 - 10, y + 4, ln.name, { a: 'end', fs: ln.hot ? 13 : 12, w: ln.hot ? 900 : 700, c: ln.hot ? CRC.ink : CRC.mute });
    Object.keys(ln.data).forEach(function(ds){ if (ds < X.from) return; var v = ln.data[ds]; b += sC(xp(ds), y, Math.max(3.5, Math.min(22, Math.sqrt(v) * 1.7)), ln.c, ln.name + ' · ' + crMD(ds) + ' · ' + v + '문항', ln.hot ? null : 0.78); }); });
  return sSvg(W, H, b, '교재별 날짜별 채점 문항 수');
}
function crWeeks(X){
  var W = 900, L0 = 44, R0 = 885, B = 196, Tp = 14, mx = 10; X.weeks.forEach(function(w){ mx = Math.max(mx, w.a, w.o); }); mx = Math.ceil(mx / 20) * 20;
  var Y = function(v){ return B - v / mx * (B - Tp); }, gw = (R0 - L0) / X.weeks.length, bw = Math.min(22, (gw - 12) / 2), b = sYAxis(L0, R0, Y, [0, mx / 2, mx]);
  X.weeks.forEach(function(w, i){ var x = L0 + i * gw; if (w.a <= 2 && !w.cur) b += sR(x + 2, Tp, gw - 4, B - Tp, CRC.bad, 0.1, 4);
    var xa = x + (gw - 2 * bw - 2) / 2;
    b += sB(xa, B, Y(w.a), bw, CRC.b[0], crMD(w.w) + ' 주 · ' + X.fshort + ' ' + w.a + '문항');
    if (X.other) b += sB(xa + bw + 2, B, Y(w.o), bw, X.color[X.other], crMD(w.w) + ' 주 · ' + crAbbr(X.other) + ' ' + w.o + '문항');
    b += sT(xa + bw / 2, Math.min(Y(w.a), B) - 5, String(w.a), { fs: 10.5, w: 800, c: w.a <= 2 ? CRC.bad : CRC.ink });
    b += sT(x + gw / 2, B + 17, crMD(w.w) + (w.cur ? '(이번 주)' : ''), { fs: 10.5 }); });
  return sSvg(W, 230, b, '주별 문항 수');
}
function crProgChart(X){
  var P = X.prog, pd = X.pd; if (!P || !pd) return '<div class="cr-note">진도 기록이 없습니다.</div>';
  var total = P.total.n || pd.maxPage || 100, start = P.start || X.from, end = crAdd(X.to, 45);
  if (P.need && P.need.by > end) end = crAdd(P.need.by, 10); var lim = crAdd(start, P.limD); if (lim > end) end = crAdd(lim, 5);
  var a0 = start < X.from ? start : X.from, L = 52, R = 880, T = 22, B = 250, t0 = crT(a0), t1 = crT(end);
  var xp = function(ds){ return L + (crT(ds) - t0) / (t1 - t0) * (R - L); }, Y = function(v){ return B - Math.min(v, total) / total * (B - T); }, b = '';
  b += sYAxis(L, R, Y, [0, Math.round(total / 4), Math.round(total / 2), Math.round(total * 3 / 4), total], function(v){ return v + '쪽'; });
  for (var t = t0; t <= t1; t += 86400000){ var ds = crIso(t); if (+ds.slice(8, 10) === 1) b += sT(xp(ds), B + 18, (+ds.slice(5, 7)) + '월'); }
  var td = xp(X.to); b += sL(td, T, td, B, CRC.line, 1.5) + sT(td, T - 6, '오늘 ' + crMD(X.to), { w: 700, c: CRC.ink });
  if (P.total.n && !P.total.est){
    if (P.tgtD){ var tg = crAdd(start, P.tgtD); b += sP([[xp(start), Y(0)], [xp(tg), Y(total)]], CRC.avg, 1.5, '5 5') + sT(xp(tg) - 4, Y(total) - 6, '목표 2개월 ' + crMD(tg), { a: 'end', w: 700 }); }
    b += sP([[xp(start), Y(0)], [xp(lim), Y(total)]], CRC.avg, 1.5, '5 5') + sT(xp(lim) - 6, Y(total * 0.94), '한계 ' + bpMonthsOf(X.focus) + '개월 ' + crMD(lim), { a: 'end', w: 700 });
    if (P.pace > 0){ var pe = crAdd(X.to, Math.min(Math.round((total - P.max) / P.pace * 7), Math.round((t1 - crT(X.to)) / 86400000))); b += sP([[td, Y(P.max)], [xp(pe), Y(P.max + P.pace * (crT(pe) - crT(X.to)) / (7 * 86400000))]], CRC.avg, 2, '2 4') + sT(xp(pe) - 2, Y(P.max + P.pace * (crT(pe) - crT(X.to)) / (7 * 86400000)) + 16, '지금 속도(주 +' + P.pace + '쪽)', { a: 'end', w: 700 }); }
    if (P.need){ b += sP([[td, Y(P.max)], [xp(P.need.by), Y(total)]], CRC.b[1], 2.5) + sC(xp(P.need.by), Y(total), 5, CRC.b[1], crMD(P.need.by) + ' 완주 (주 +' + P.need.wk + '쪽)') + sT(xp(P.need.by) - 10, Y(total) + 4, crMD(P.need.by) + ' 완주 · 주 +' + P.need.wk + '쪽', { a: 'end', fs: 11.5, w: 800, c: CRC.ink }); }
  }
  var ms = pd.months || {}, pts = [[start, 0]]; Object.keys(ms).sort().forEach(function(mm){ var e = crIso(Date.UTC(+mm.slice(0, 4), +mm.slice(5, 7), 0)); if (e > String(pd.lastDate).slice(0, 10)) e = String(pd.lastDate).slice(0, 10); if (e >= start) pts.push([e, ms[mm].maxP || 0]); });
  if (X.to > pts[pts.length - 1][0]) pts.push([X.to, pd.maxPage]);
  b += sP(pts.map(function(p){ return [xp(p[0]), Y(p[1])]; }), CRC.b[0], 3);
  pts.slice(1).forEach(function(p){ b += sC(xp(p[0]), Y(p[1]), 4, CRC.b[0], crMD(p[0]) + ' · ' + p[1] + '쪽'); });
  b += sT(td - 8, Y(pd.maxPage) - 10, pd.maxPage + '쪽' + (P.pct != null ? ' (' + P.pct + '%)' : ''), { a: 'end', fs: 12, w: 800, c: CRC.ink });
  return sSvg(900, 280, b, '집중 교재 누적 진도');
}
function crGrouped(cats, series, unit, maxV){
  var L = 44, R = 430, T = 18, B = 200, mx = maxV || 10; if (!maxV) series.forEach(function(s){ s.v.forEach(function(v){ if (v != null) mx = Math.max(mx, v); }); });
  if (!maxV) mx = Math.ceil(mx / 10) * 10; var Y = function(v){ return B - v / mx * (B - T); }, b = sYAxis(L, R, Y, [0, Math.round(mx / 2), mx], function(v){ return v + unit; });
  var gw = (R - L) / Math.max(1, cats.length), bw = Math.min(26, (gw - 20) / series.length - 2);
  cats.forEach(function(c, i){ var x0 = L + i * gw + (gw - series.length * (bw + 2)) / 2;
    series.forEach(function(s, j){ var v = s.v[i]; if (v == null){ b += sT(x0 + j * (bw + 2) + bw / 2, B - 6, '–'); return; }
      b += sB(x0 + j * (bw + 2), B, Y(v), bw, s.c, c + ' · ' + s.n + ' ' + (s.fmt ? s.fmt(v) : v + unit)); b += sT(x0 + j * (bw + 2) + bw / 2, Y(v) - 5, s.fmt ? s.fmt(v) : (v + unit), { fs: 10, w: 700, c: CRC.ink }); });
    b += sT(L + i * gw + gw / 2, B + 18, c, { fs: 12, w: 700, c: CRC.ink }); });
  return sSvg(440, 230, b, cats.join(' '));
}
function crMonLab(mm){ return (+mm.slice(5, 7)) + '월'; }
function crAccChart(X){
  var L = 44, R = 420, T = 18, B = 200, Y = function(v){ return B - (v - 40) / 60 * (B - T); }, n = X.mons.length, xs = X.mons.map(function(m, i){ return L + 40 + i * ((R - L - 80) / Math.max(1, n - 1)); });
  var b = sYAxis(L, R, Y, [40, 60, 80, 100], function(v){ return v + '%'; });
  X.mons.forEach(function(m, i){ b += sT(xs[i], B + 18, crMonLab(m), { fs: 12, w: 700, c: CRC.ink }); });
  X.mBooks.forEach(function(mb){ var pts = []; mb.acc.forEach(function(v, i){ if (v != null) pts.push([xs[i], Y(Math.max(40, v))]); }); b += sP(pts, X.color[mb.b], 2.5);
    mb.acc.forEach(function(v, i){ if (v != null) b += sC(xs[i], Y(Math.max(40, v)), 4, X.color[mb.b], crAbbr(mb.b) + ' ' + crMonLab(X.mons[i]) + ' · ' + v + '%'); });
    var li = -1; mb.acc.forEach(function(v, i){ if (v != null) li = i; }); if (li >= 0) b += sT(xs[li] + 8, Y(Math.max(40, mb.acc[li])) + 4, crAbbr(mb.b) + ' ' + mb.acc[li] + '%', { a: 'start', fs: 11, w: 800, c: CRC.ink }); });
  return sSvg(470, 230, b, '교재별 월 정답률');
}
function crTestPanel(X, lab){
  var tl = X.tests.filter(function(x){ return x.lab === lab; }), isF = (lab === X.fg), wsl = isF ? X.fws : [];
  var L = 40, R = 425, T = 16, B = 176, t0 = crT(X.from), t1 = crT(X.to) + 86400000, xp = function(ds){ return L + 6 + (crT(ds) - t0) / (t1 - t0) * (R - L - 12); }, Y = function(v){ return B - v / 100 * (B - T); };
  var b = sYAxis(L, R, Y, [0, 50, 100], function(v){ return v + '점'; });
  for (var t = t0; t < t1; t += 86400000){ var ds = crIso(t); if (+ds.slice(8, 10) === 1) b += sT(xp(ds), B + 16, crMonLab(ds)); }
  b += sP(tl.filter(function(x){ return x.avg != null; }).map(function(x){ return [xp(x.d), Y(x.avg)]; }), CRC.avg, 1.5, '5 5');
  b += sP(tl.map(function(x){ return [xp(x.d), Y(x.s)]; }), CRC.b[2], 2.5);
  tl.forEach(function(x, i){ b += sC(xp(x.d), Y(x.s), i === tl.length - 1 ? 5.5 : 4, CRC.b[2], crMD(x.d) + ' ' + x.title + ' · ' + x.s + '점' + (x.avg != null ? ' (평균 ' + x.avg + ')' : '')); });
  if (tl.length){ var lt = tl[tl.length - 1]; b += sT(xp(lt.d) - 8, Y(lt.s) + (lt.s > 85 ? 18 : -10), lt.s + '점', { a: 'end', fs: 12, w: 800, c: CRC.ink }); }
  wsl.forEach(function(w){ var sc = Math.round(w.o / w.n * 100); b += '<rect x="' + (xp(w.day) - 5).toFixed(1) + '" y="' + (Y(sc) - 5).toFixed(1) + '" width="10" height="10" transform="rotate(45 ' + xp(w.day).toFixed(1) + ' ' + Y(sc).toFixed(1) + ')" fill="' + CRC.b[0] + '" stroke="#fff" stroke-width="1.5"><title>' + crE(crMD(w.day) + ' ' + w.t + ' · ' + w.o + '/' + w.n + ' (' + sc + '점)') + '</title></rect>'; });
  if (!tl.length && !wsl.length) b += sT((L + R) / 2, (T + B) / 2, '이 기간 시험 기록이 없습니다', { fs: 12 });
  var cap = tl.length ? ('주간테스트·단원평가 ' + tl.length + '회 · 최근 ' + tl[tl.length - 1].s + '점') : '주간테스트 없음';
  if (isF) cap += wsl.length ? (' · ◆ ' + X.fshort + ' 학습지 ' + wsl.length + '장') : '';
  return '<div class="cr-tp"><div class="cr-tp-h"><b>' + crE(lab) + '</b>' + (isF ? '<span class="cr-tag">집중 교재 과정</span>' : '') + '<span>' + crE(cap) + '</span></div>' + sSvg(440, 200, b, lab + ' 시험 점수') + '</div>';
}
function crWrong(X){
  if (!X.wrong.length) return '<div class="cr-note">최근 5주 시험에서 틀린 개념이 없습니다.</div>';
  var mx = X.wrong[0][1], L = 210, R = 400, b = '';
  X.wrong.forEach(function(w, i){ var y = 10 + i * 26, ww = Math.max(4, w[1] / mx * (R - L - 30)), nm = w[0].length > 18 ? w[0].slice(0, 18) + '…' : w[0];
    b += sT(L - 8, y + 13, nm, { a: 'end', fs: 11.5, w: 700, c: CRC.ink }) + sR(L, y, ww, 18, CRC.b[0], null, 4, w[0] + ' · ' + w[1] + '번') + sT(L + ww + 6, y + 13, w[1] + '번', { a: 'start', fs: 11, w: 800, c: CRC.ink }); });
  return sSvg(440, 14 + X.wrong.length * 26, b, '최근 시험에서 틀린 개념');
}
function crApp(X){
  var days = Object.keys(X.app); if (!days.length) return '<div class="cr-note">기간 안에 학생앱 채점 입력이 없습니다.</div>';
  var a0 = crAdd(X.to, -55) > X.from ? crAdd(X.to, -55) : X.from, n = Math.round((crT(X.to) - crT(a0)) / 86400000) + 1, L = 40, R = 885, T = 14, B = 176, mx = 20;
  days.forEach(function(k){ if (k >= a0) mx = Math.max(mx, X.app[k].n); }); mx = Math.ceil(mx / 20) * 20;
  var Y = function(v){ return B - v / mx * (B - T); }, sw = (R - L) / n, bw = Math.max(3, sw - 3), b = sYAxis(L, R, Y, [0, mx / 2, mx]), run = null, gaps = [];
  for (var i = 0; i < n; i++){ var ds = crAdd(a0, i), x = L + i * sw + 1.5, a = X.app[ds];
    if (+ds.slice(8, 10) % 5 === 0) b += sT(x + bw / 2, B + 16, crMD(ds), { fs: 10.5 });
    if (!a){ if (!run) run = { a: ds, i: i, n: 0 }; run.n++; run.b = ds; continue; }
    if (run && run.n >= 4 && run.i > 0) gaps.push(run); run = null;
    var o = a.o, xx = a.n - a.o, tip = crMD(ds) + ' · ' + a.n + '문항 (맞음 ' + o + ' · 틀림 ' + xx + ')';
    if (xx > 0) b += sB(x, B, Y(a.n), bw, CRC.q3, tip);
    if (o > 0) b += sR(x, Y(o), bw, B - Y(o), CRC.q1, null, 0, tip) + (xx > 0 ? sL(x, Y(o), x + bw, Y(o), '#fff', 2) : ''); }
  if (run && run.n >= 4) gaps.push(run);
  gaps.forEach(function(g){ var x1 = L + g.i * sw, x2 = x1 + g.n * sw; b += sR(x1, T, x2 - x1, B - T, CRC.bad, 0.07) + sT((x1 + x2) / 2, T + 14, '입력 없음 ' + g.n + '일', { fs: 11, w: 700, c: CRC.bad }); });
  return sSvg(900, 200, b, '학생앱 하루 채점 입력');
}

/* ── 리포트 ── */
var CR_CSS = '.cr{font-family:"Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#15233b;max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:14px;font-size:14.5px;line-height:1.6}'
  + '.cr *{box-sizing:border-box}.cr-top{background:#0d2240;color:#fff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}'
  + '.cr-top .br{font-size:11.5px;letter-spacing:.14em;opacity:.75;font-weight:700}.cr-top h1{margin:2px 0;font-size:24px;font-weight:900}.cr-top .wh{text-align:right;font-size:12.5px;opacity:.85}'
  + '.cr-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cr-sum div{background:#fff;border:1px solid #e3e7ee;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:center;font-size:13.5px}'
  + '.cr-sum b{font-size:21px;font-weight:900;white-space:nowrap}.cr-sum .r b{color:#c81e1e}.cr-sum .g b{color:#15803d}.cr-sum .y b{color:#b45309}'
  + '.cr-focus{background:#fff;border:2px solid #e0670b;border-radius:12px;padding:14px 18px;display:flex;flex-direction:column;gap:14px}.cr-focus h2{margin:0;font-size:20px;font-weight:900}'
  + '.cr h3{margin:0 0 2px;font-size:15px;font-weight:900}.cr-take{margin:0 0 6px;font-size:13px;color:#5f6b80}.cr-take b{color:#15233b}'
  + '.cr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cr-card{background:#fff;border:1px solid #e3e7ee;border-radius:10px;padding:12px 16px 10px;min-width:0}.cr-card.wide{grid-column:1/-1}'
  + '.cr-cls{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px}.cr-cd{border-radius:8px;padding:5px 3px;text-align:center;border:2px solid transparent;min-width:0}'
  + '.cr-cd .d{font-size:11.5px;font-weight:700;color:#5f6b80}.cr-cd .m{font-size:19px;font-weight:900;line-height:1.3}.cr-cd .n{font-size:10.5px;color:#5f6b80;min-height:15px}'
  + '.cr-cd.full{background:#e0670b}.cr-cd.full .d,.cr-cd.full .m,.cr-cd.full .n{color:#fff}.cr-cd.part{background:#fbe3d2;border-color:#f3b993}.cr-cd.part .m{color:#e0670b}.cr-cd.none{border:2px dashed #c81e1e;background:#fff}.cr-cd.none .m{color:#c81e1e}'
  + '.cr-cd .rp{display:inline-block;font-size:10px;font-weight:800;color:#0d9488;border:1px solid #0d9488;border-radius:4px;padding:0 3px}'
  + '.cr-big{display:flex;gap:16px;flex-wrap:wrap;align-items:baseline;margin-bottom:6px}.cr-big b{font-size:30px;font-weight:900;color:#c81e1e}.cr-big span{font-size:13px;color:#5f6b80}'
  + '.cr-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#5f6b80;margin-top:4px}.cr-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}'
  + '.cr-legend i.ln{height:3px;width:16px;vertical-align:3px}.cr-legend i.dash{height:0;width:16px;border-top:2px dashed #9aa5b5;border-radius:0;vertical-align:3px}'
  + '.cr-tps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cr-tp{border:1px solid #e3e7ee;border-radius:8px;padding:8px 10px}.cr-tp-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:12.5px;color:#5f6b80}.cr-tp-h b{font-size:16px;color:#15233b}'
  + '.cr-tag{font-size:11px;font-weight:800;color:#e0670b;border:1px solid #e0670b;border-radius:5px;padding:0 6px}.cr-note{font-size:13px;color:#5f6b80;padding:8px 0}'
  + '.cr-plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cr-plan textarea{width:100%;min-height:118px;font:inherit;font-size:14px;border:1px solid #e3e7ee;border-radius:8px;padding:8px 10px;resize:vertical}'
  + '.cr-plan ol,.cr-plan ul{margin:4px 0 0;padding-left:20px}.cr-memo{background:#fff8e6;border:1.5px dashed #f1d48a;border-radius:10px;padding:12px 16px;font-size:13.5px}.cr-memo ul{margin:6px 0 0;padding-left:18px}'
  + '.cr-foot{font-size:11.5px;color:#5f6b80;text-align:center}'
  + '@media(max-width:820px){.cr-grid,.cr-tps,.cr-plan,.cr-sum{grid-template-columns:1fr}.cr-cls{grid-template-columns:repeat(5,minmax(0,1fr))}}';
function crLines(s){ return String(s || '').split('\n').map(function(x){ return x.trim(); }).filter(Boolean); }
function crReport(X, mode){
  var st = X.st, pr = mode === 'print', P = X.prog;
  var g = String(st.grade || '').replace(/등학교|학교/g, '').replace(/\s*학년/, '학년');
  var h = '<div class="cr">';
  h += '<header class="cr-top"><div><div class="br">LUMEN MATH · 루멘수학</div><h1>' + crE(st.name) + ' 학습 상담 리포트</h1><div style="font-size:13.5px;opacity:.9">' + crE([st.school, g, st.group ? st.group + '반' : ''].filter(Boolean).join(' · ')) + '</div></div>'
    + '<div class="wh">' + crE(X.from.replace(/-/g, '.')) + ' – ' + crE(X.to.replace(/-/g, '.')) + '<br>작성 ' + crE(crMD(X.to)) + '</div></header>';
  /* 요약 */
  var lt = X.tests.filter(function(x){ return x.type === 'WEEKLY'; }).pop() || X.tests[X.tests.length - 1];
  h += '<div class="cr-sum">'
    + '<div class="' + (X.board.length && X.bFull * 2 < X.board.length ? 'r' : 'g') + '"><b>' + (X.board.length ? X.board.length + '번 중 ' + X.bFull + '번' : '–') + '</b><span>최근 수업에 ' + crE(X.fshort) + ' 숙제를 해 온 날</span></div>'
    + '<div class="' + (P && P.status === 'r' ? 'r' : (P && P.status === 'y' ? 'y' : 'g')) + '"><b>' + (P && P.pct != null ? P.pct + '%' : '–') + '</b><span>' + crE(X.fshort) + ' 진도' + (P && P.elapsed ? ' · ' + P.elapsed + '일째' : '') + (P && P.status === 'r' ? ' · 급함' : (P && P.status === 'y' ? ' · 주의' : '')) + (P && P.need ? ' · 필요 주 +' + P.need.wk + '쪽' : '') + '</span></div>'
    + '<div class="' + (lt && lt.avg != null && lt.s < lt.avg ? 'r' : 'g') + '"><b>' + (lt ? lt.s + '점' : '–') + '</b><span>' + (lt ? '최근 시험 ' + crMD(lt.d) + ' ' + crE(lt.lab) + (lt.avg != null ? ' · 학원 평균 ' + lt.avg : '') : '기간 안 시험 없음') + '</span></div></div>';
  /* 집중 교재 */
  var wz = X.weeks.filter(function(w){ return w.a <= 2 && !w.cur; }).length;
  h += '<section class="cr-focus"><div><h2>' + crE(X.fname) + ' — 숙제 흐름</h2><p class="cr-take">매쓰플랫에 이 교재를 채점해 올린 날만 셉니다. 종이로 풀고 채점을 안 올린 날은 «안 해 옴»으로 보입니다.</p></div>';
  h += '<div><h3>최근 수업 ' + X.board.length + '번 — 그 수업까지 ' + crE(X.fshort) + '를 해 왔나</h3>' + crBoardHtml(X) + '</div>';
  h += '<div><h3>날마다 무엇을 풀었나</h3><p class="cr-take">점 크기 = 그날 채점한 문항 수' + (X.gaps.length ? ' · <b>' + crE(X.fshort) + ' 줄이 빈 기간 ' + X.gaps.length + '번</b>(빨간 띠)' : '') + '</p>' + crLane(X) + '</div>';
  h += '<div><h3>주마다 푼 문항 수 — ' + crE(X.fshort) + (X.other ? ' vs ' + crE(crAbbr(X.other)) : '') + '</h3><p class="cr-take">' + (wz ? '<b>' + crE(X.fshort) + '를 0~2문항만 푼 주가 ' + wz + '번</b>(빨간 배경)' : '주마다 꾸준히 풀었어요') + '</p>' + crWeeks(X)
    + '<div class="cr-legend"><span><i style="background:' + CRC.b[0] + '"></i>' + crE(X.fshort) + '</span>' + (X.other ? '<span><i style="background:' + X.color[X.other] + '"></i>' + crE(crBookName(X.other)) + '</span>' : '') + '</div></div>';
  h += '</section>';
  /* 그래프 칸 */
  h += '<div class="cr-grid">';
  h += '<section class="cr-card wide"><h3>' + crE(X.fname) + ' 진도 곡선</h3><p class="cr-take">' + (P && P.need ? '지금 속도(주 +' + P.pace + '쪽)로는 늦어요. <b>' + crMD(P.need.by) + '까지 끝내려면 주 +' + P.need.wk + '쪽</b>이 필요합니다.' : '누적 쪽수 · 점선 = 기준 기간 속도') + '</p>' + crProgChart(X)
    + '<div class="cr-legend"><span><i class="ln" style="background:' + CRC.b[0] + '"></i>실제 진도</span><span><i class="dash"></i>기준 속도</span>' + (P && P.need ? '<span><i class="ln" style="background:' + CRC.b[1] + '"></i>계획</span>' : '') + '<span><i class="ln" style="background:' + CRC.avg + '"></i>지금 속도 그대로</span></div></section>';
  var bl = '<div class="cr-legend">' + X.mBooks.map(function(mb){ return '<span><i style="background:' + X.color[mb.b] + '"></i>' + crE(crBookName(mb.b)) + '</span>'; }).join('') + '</div>';
  h += '<section class="cr-card"><h3>교재별 월 진행 쪽수</h3><p class="cr-take">한 달에 몇 쪽 나갔나</p>' + crGrouped(X.mons.map(crMonLab), X.mBooks.map(function(mb){ return { n: crAbbr(mb.b), c: X.color[mb.b], v: mb.pages }; }), '쪽') + bl + '</section>';
  h += '<section class="cr-card"><h3>교재별 월 정답률</h3><p class="cr-take">그달 10문항 이상 푼 교재만</p>' + crAccChart(X) + bl + '</section>';
  h += '<section class="cr-card wide"><h3>시험 점수 — 과정별</h3><p class="cr-take">주간테스트·단원평가를 과정(학년-학기)마다 따로 · 점선 = 학원 평균' + (X.fws.length ? ' · ◆ = ' + crE(X.fshort) + ' 학습지 점수' : '') + '</p>'
    + (X.labs.length ? '<div class="cr-tps">' + X.labs.map(function(l){ return crTestPanel(X, l); }).join('') + '</div>' : '<div class="cr-note">기간 안에 시험 기록이 없습니다.</div>')
    + '<div class="cr-legend"><span><i class="ln" style="background:' + CRC.b[2] + '"></i>점수</span><span><i class="dash"></i>학원 평균</span>' + (X.fws.length ? '<span><i style="background:' + CRC.b[0] + ';transform:rotate(45deg);width:9px;height:9px"></i>' + crE(X.fshort) + ' 학습지</span>' : '') + '</div></section>';
  h += '<section class="cr-card"><h3>최근 5주 시험에서 틀린 개념</h3><p class="cr-take">' + X.wrongN + '번의 시험에서 · 막대 = 틀린 횟수</p>' + crWrong(X) + '</section>';
  h += '<section class="cr-card"><h3>숙제 단계별 완성도 (월 평균)</h3><p class="cr-take">원장 숙제체크 · 풀이 / 채점 / 오답 정리</p>' + crGrouped(X.mons.map(crMonLab), [
      { n: '풀이', c: CRC.q1, v: X.hwm.map(function(x){ return x ? x.p : null; }) }, { n: '채점', c: CRC.q2, v: X.hwm.map(function(x){ return x ? x.c : null; }) }, { n: '오답 정리', c: CRC.q3, v: X.hwm.map(function(x){ return x ? x.w : null; }) }], '%', 100)
    + '<div class="cr-legend"><span><i style="background:' + CRC.q1 + '"></i>풀이</span><span><i style="background:' + CRC.q2 + '"></i>채점</span><span><i style="background:' + CRC.q3 + '"></i>오답 정리</span></div></section>';
  h += '<section class="cr-card wide"><h3>학생앱 채점 입력 (하루 문항 수)</h3><p class="cr-take">학생이 앱에 답을 넣어 채점한 문항 · 4일 넘게 빈 기간은 빨간 띠</p>' + crApp(X)
    + '<div class="cr-legend"><span><i style="background:' + CRC.q1 + '"></i>맞은 문항</span><span><i style="background:' + CRC.q3 + '"></i>틀린 문항</span></div></section>';
  var lastT = X.time.filter(function(t){ return t.avg != null; }).pop();
  h += '<section class="cr-card"><h3>하루 평균 공부 시간 · 수학 시간</h3><p class="cr-take">' + (lastT ? crMonLab(lastT.m) + ' 하루 평균 <b>' + crHm(lastT.avg) + '</b>' + (lastT.math != null ? ', 그중 수학 약 <b>' + crHm(lastT.math) + '</b>' : '') : '플래너 공부 시간 기록이 없습니다') + '</p>'
    + crGrouped(X.mons.map(crMonLab), [{ n: '하루 평균 공부', c: CRC.avg, v: X.time.map(function(t){ return t.avg != null ? Math.round(t.avg) : null; }), fmt: crHm },
      { n: '하루 평균 수학(추정)', c: CRC.b[2], v: X.time.map(function(t){ return t.math != null ? Math.round(t.math) : null; }), fmt: crHm }], '분')
    + '<div class="cr-legend"><span><i style="background:' + CRC.avg + '"></i>공부 (플래너 TOTAL TIME ÷ 기록한 날)</span><span><i style="background:' + CRC.b[2] + '"></i>수학 (플래너 할 일 중 수학 비율로 추정)</span></div>'
    + '<div style="font-size:11.5px;color:#5f6b80">' + X.time.map(function(t){ return crMonLab(t.m) + ' ' + t.days + '일 기록' + (t.share != null ? ' · 수학 ' + Math.round(t.share * 100) + '%' : ''); }).join(' · ') + '</div></section>';
  h += '<section class="cr-card"><h3>아하노트 질문 수</h3><p class="cr-take">모르는 문제를 물어본 횟수</p>' + crGrouped(X.mons.map(crMonLab), [{ n: '질문', c: CRC.b[2], v: X.aha }], '건') + '</section>';
  h += '</div>';
  /* 계획 */
  var plan = CR.plan != null ? CR.plan : X.planDef, home = CR.home != null ? CR.home : X.homeDef;
  if (pr) h += '<div class="cr-plan"><section class="cr-card"><h3>다음 달 학원 계획</h3><ol>' + crLines(plan).map(function(x){ return '<li>' + crE(x) + '</li>'; }).join('') + '</ol></section>'
    + '<section class="cr-card"><h3>가정에서 도와주실 것</h3><ul>' + crLines(home).map(function(x){ return '<li>' + crE(x) + '</li>'; }).join('') + '</ul></section></div>';
  else h += '<div class="cr-plan"><section class="cr-card"><h3>다음 달 학원 계획 <span style="font-size:11.5px;color:#5f6b80;font-weight:600">한 줄에 하나 · 고쳐 쓰세요</span></h3><textarea id="cr-plan" oninput="CR.plan=this.value">' + crE(plan) + '</textarea></section>'
    + '<section class="cr-card"><h3>가정에서 도와주실 것</h3><textarea id="cr-home" oninput="CR.home=this.value">' + crE(home) + '</textarea></section></div>';
  if (!pr && CR.memo) h += '<section class="cr-memo"><b>🔒 원장님만 보는 상담 준비 메모</b> <span style="color:#5f6b80;font-size:12px">— 인쇄·PDF 에는 빠집니다</span><ul>' + X.memo.map(function(m){ return '<li>' + m + '</li>'; }).join('') + '</ul></section>';
  h += '<div class="cr-foot">자료: 매쓰플랫 채점(교재·주간테스트·학습지) · 루멘 숙제체크 · 학생앱 채점 입력 · 모트모트 플래너 · 아하노트 · ' + crE(X.to.replace(/-/g, '.')) + ' 기준</div>';
  return h + '</div>';
}

/* ── 화면 ── */
function rConsult(){
  var stus = getSortedStudents().filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; });
  if (!CR.code && stus.length) CR.code = String(stus[0].lumen_rec_code);
  var bar = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:1000px;margin:0 auto 12px">'
    + '<b style="font-size:19px;color:#0d2240;margin-right:6px">📋 상담 리포트</b>'
    + '<select onchange="crSetStu(this.value)" style="font-family:inherit;font-size:14px;font-weight:800;border:1.5px solid #cbd5e1;border-radius:9px;padding:5px 8px">' + stus.map(function(s){ return '<option value="' + crE(s.lumen_rec_code) + '"' + (String(s.lumen_rec_code) === CR.code ? ' selected' : '') + '>' + crE(s.name) + ' · ' + crE(String(s.grade || '').replace(/등학교|학교|학년|\s/g, '')) + '</option>'; }).join('') + '</select>'
    + '<select onchange="crSetMonths(this.value)" style="font-family:inherit;font-size:13px;font-weight:700;border:1.5px solid #cbd5e1;border-radius:9px;padding:5px 8px">' + [2, 3, 4, 6].map(function(m){ return '<option value="' + m + '"' + (m === CR.months ? ' selected' : '') + '>최근 ' + m + '개월</option>'; }).join('') + '</select>';
  if (!CR.data && !CR.loading && !CR.err) setTimeout(crLoad, 0);
  var X = null; try { X = (CR.data && !CR.loading) ? crCompute() : null; } catch(e){ console.error(e); CR.err = '계산 오류: ' + e.message; }
  if (X && X.books.length) bar += '<select onchange="crSetFocus(this.value)" title="크게 볼 교재" style="font-family:inherit;font-size:13px;font-weight:700;border:1.5px solid #e0670b;color:#9a3412;border-radius:9px;padding:5px 8px">' + X.books.map(function(b){ return '<option value="' + crE(b) + '"' + (b === X.focus ? ' selected' : '') + '>집중: ' + crE(crBookName(b)) + '</option>'; }).join('') + '</select>';
  var btn = function(t, f, pri){ return '<button type="button" onclick="' + f + '" style="font-family:inherit;font-size:13px;font-weight:800;border-radius:9px;padding:6px 12px;cursor:pointer;' + (pri ? 'border:none;background:#0d2240;color:#fff' : 'border:1.5px solid #cbd5e1;background:#fff;color:#334155') + '">' + t + '</button>'; };
  bar += '<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + btn(CR.memo ? '🔒 메모 숨기기' : '🔒 메모 보기', 'crToggleMemo()') + btn('🔄 다시 읽기', 'CR.data=null;CR.err=\'\';render()') + btn(CR.saving ? '저장 중…' : '💾 저장' + (CR.savedAt ? ' (' + crMD(CR.savedAt) + ')' : ''), 'crSave()') + btn('🖨 인쇄 · PDF', 'crPrint()', 1) + '</span></div>';
  var body;
  if (CR.err) body = '<div style="max-width:1000px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:20px;color:#b91c1c;font-weight:800">' + crE(CR.err) + '</div>';
  else if (!X) body = '<div style="max-width:1000px;margin:0 auto;padding:60px;text-align:center;color:#94a3b8;font-weight:700">📋 진도·시험·숙제 기록을 모으는 중… (학생 한 명 · ' + CR.months + '개월)</div>';
  else body = crReport(X, 'screen');
  return '<style>' + CR_CSS + '</style><div style="padding:18px 22px 60px;background:#eef1f5;min-height:100%">' + bar + body + '</div>';
}
window.crPrint = function(){
  var X = null; try { X = crCompute(); } catch(e){} if (!X) return;
  var w = window.open('', '_blank'); if (!w){ try { plToast('⚠ 팝업이 막혔습니다 — 브라우저에서 팝업을 허용해 주세요'); } catch(e){} return; }
  w.document.open();
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + crE(X.st.name) + ' 상담 리포트 ' + crE(X.to) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap"><style>'
    + 'body{margin:0;padding:10px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}' + CR_CSS + '.cr-card,.cr-focus,.cr-tp{break-inside:avoid}@page{size:A4;margin:10mm}</style></head><body>' + crReport(X, 'print') + '</body></html>');
  w.document.close(); setTimeout(function(){ try { w.focus(); w.print(); } catch(e){} }, 900);
};
window.crSave = function(){
  var X = null; try { X = crCompute(); } catch(e){} if (!X || CR.saving) return;
  CR.saving = true; render();
  var key = 'consult_' + CR.data.code, sb = getSupaClient();
  var rec = { at: new Date().toISOString(), from: X.from, to: X.to, focus: X.focus, plan: CR.plan != null ? CR.plan : X.planDef, home: CR.home != null ? CR.home : X.homeDef,
    nums: { board: X.board.length, full: X.bFull, pct: X.prog ? X.prog.pct : null, need: X.prog && X.prog.need ? X.prog.need.wk : null, pace: X.prog ? X.prog.pace : null } };
  Promise.resolve(sb ? sb.from('lumen_store').select('value').eq('key', key) : { data: [] }).then(function(r){
    var v = r && r.data && r.data[0] ? r.data[0].value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    var list = (v && v.list) || []; list.push(rec); return supaSetItem(key, { list: list.slice(-24), upd: rec.at });
  }).then(function(ok){ CR.saving = false; if (ok !== false){ CR.savedAt = rec.at.slice(0, 10); try { plToast('💾 상담 리포트 저장 — 다음 상담 때 계획과 비교합니다'); } catch(e){} } render(); })
    .catch(function(e){ CR.saving = false; alert('저장 실패: ' + e.message); render(); });
};
/* 진도 현황 오른쪽 상세에 «📋 상담 리포트» */
var _bpDetailPanel160 = bpDetailPanel;
bpDetailPanel = function(x){
  var h = _bpDetailPanel160(x);
  if (!x || !x.st || !x.st.lumen_rec_code) return h;
  var b = '<button type="button" onclick="crOpen(\'' + String(x.st.lumen_rec_code).replace(/[^A-Za-z0-9]/g, '') + '\')" style="float:right;margin:-4px 0 6px 8px;font-family:inherit;font-size:12.5px;font-weight:800;border:1.5px solid #0d2240;color:#0d2240;background:#fff;border-radius:9px;padding:4px 11px;cursor:pointer">📋 상담 리포트</button>';
  var i = h.indexOf('>'); return i < 0 ? h : h.slice(0, i + 1) + b + h.slice(i + 1);
};
