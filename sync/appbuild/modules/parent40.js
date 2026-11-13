/* ═══════════════════════════════════════════════════════════════════
 * v1-40: 📈 성적 추이 (원장 2026-11-11~13 · 시안 docs/mockup_parent_score_trend.html · 학원앱 «📈 성적 한눈에»와 같은 그림)
 *  읽기: pub_reports_<코드>.hist = { wk:[{d,t,s,avg,r,n,nat}], dy:[{d,t,s,avg}] } ← 학원앱 v19-188 이 리포트 발행 때 함께 올린다
 *        (없으면 pub_reports_<코드>.recent 최근 8개로 대신 그린다)
 *  ① 🏅 성적 탭 맨 위 카드: 최근 전국주간 점수 · 378/823명(등급 색) · 최근 6회 막대 → 누르면 «📈 성적 추이»
 *  ② 성적 추이 화면(P.tab 'strend'): 🌐 전국주간 / 📝 일일 · 최근 8회 / 전체
 *     주간 = 점수 + 전국 평균 점선 · 점·막대 색 = 전국 상위 % 등급(10·30·50·70%) · 회차마다 시험지 제목 · 378/823명
 *     일일 = 그날 학원 평균과의 차이 ± 막대(초록 = 평균 이상) · 날짜마다 시험지 제목
 *  학교 성적은 보이지 않는다(원장 결정). 쓰기 없음. ES5 · 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var P40 = { t: 'wk', p: '8' };
var P40_GC = { 1: ['#059669', '#ecfdf5'], 2: ['#1d6fe8', '#eaf2ff'], 3: ['#b45309', '#fef3c7'], 4: ['#c2410c', '#ffedd5'], 5: ['#dc2626', '#fee2e2'] };
function p40Grade(r, n){ r = Number(r); n = Number(n); if (!r || !n) return 0; var p = r / n * 100; return p <= 10 ? 1 : p <= 30 ? 2 : p <= 50 ? 3 : p <= 70 ? 4 : 5; }
function p40Rk(r, n){ var g = p40Grade(r, n); if (!g) return ''; var c = P40_GC[g]; return '<span class="p40rk" style="color:' + c[0] + ';background:' + c[1] + '">' + r + '/' + n + '명<small>' + g + '등급</small></span>'; }
function p40MD(d){ d = String(d || '').replace(/\./g, '-'); return d.length >= 10 ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) : d; }
/* 자료 — hist 가 없으면 recent(최근 8개)로 */
function p40Data(){
  var pb = P.pub || {}, h = pb.hist;
  if (h && (h.wk || h.dy)) return { wk: (h.wk || []).slice(), dy: (h.dy || []).slice(), full: true };
  var wk = [], dy = [];
  (pb.recent || []).slice().reverse().forEach(function(r){
    var d = String(r.date || '').replace(/\./g, '-'), s = Number(r.score); if (!d || isNaN(s)) return;
    var t = (r.paper && r.paper.label ? r.paper.label + ' ' : '') + (r.paper && r.paper.range ? r.paper.range : (r.bookname || ''));
    if (r.testType === 'weekly') wk.push({ d: d, t: t || '전국주간테스트', s: s, avg: r.avgScore != null ? Number(r.avgScore) : null, r: (r.showRank !== false && r.rank) ? Number(r.rank) : null, n: (r.showRank !== false && r.total) ? Number(r.total) : null, nat: true });
    else dy.push({ d: d, t: t || '일일테스트', s: s, avg: (r.acadAvg != null && r.acadAvg !== '') ? Number(r.acadAvg) : null });
  });
  return { wk: wk, dy: dy, full: false };
}
function p40Nat(D){ var n = D.wk.filter(function(e){ return e.nat && e.r && e.n; }); return n.length ? n : D.wk; }
/* ① 성적 탭 맨 위 카드 */
function p40Card(){
  var D = p40Data(); if (!D.wk.length && !D.dy.length) return '';
  var NL = p40Nat(D), w = NL[NL.length - 1];
  var h = '<div class="p40card" onclick="goTab(\'strend\')"><div class="p40ct">📈 성적 추이 <span class="go">자세히 ›</span></div>';
  if (w) {
    h += '<div class="p40row"><div><b class="p40big">' + w.s + '점</b> ' + p40Rk(w.r, w.n) + '<div class="p40t">' + esc(w.t) + ' · ' + p40MD(w.d) + '</div></div><div class="p40mini">';
    NL.slice(-6).forEach(function(e, i, a){ var g = p40Grade(e.r, e.n), c = g ? P40_GC[g][0] : '#94a3b8'; h += '<i style="height:' + Math.max(4, Math.round(e.s * 0.36)) + 'px;background:' + c + ';opacity:' + (i === a.length - 1 ? 1 : 0.6) + '"></i>'; });
    h += '</div></div>';
  } else h += '<div class="p40t">일일테스트 ' + D.dy.length + '회 기록 · 눌러서 보기</div>';
  return h + '</div>';
}
window.p40Set = function(k, v){ P40[k] = v; render(); };
function p40WkChart(L){
  var W = 330, H = 160, pl = 28, pr = 12, pt = 16, pb = 22;
  var x = function(i){ return pl + (L.length < 2 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (L.length - 1)); }, y = function(v){ v = Math.max(0, Math.min(100, Number(v) || 0)); return pt + (100 - v) * (H - pt - pb) / 100; };
  var g = '';
  [0, 50, 100].forEach(function(v){ g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e2e8f0"/><text x="' + (pl - 5) + '" y="' + (y(v) + 4) + '" font-size="10" text-anchor="end" fill="#94a3b8">' + v + '</text>'; });
  var av = L.filter(function(e){ return e.avg != null; });
  if (av.length > 1) g += '<polyline fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="4 4" points="' + L.map(function(e, i){ return e.avg != null ? x(i) + ',' + y(e.avg) : ''; }).filter(Boolean).join(' ') + '"/>';
  if (L.length > 1) g += '<polyline fill="none" stroke="#1d6fe8" stroke-width="2.4" stroke-linejoin="round" points="' + L.map(function(e, i){ return x(i) + ',' + y(e.s); }).join(' ') + '"/>';
  L.forEach(function(e, i){ var gg = p40Grade(e.r, e.n), c = gg ? P40_GC[gg][0] : '#94a3b8', last = i === L.length - 1;
    g += '<circle cx="' + x(i) + '" cy="' + y(e.s) + '" r="' + (last ? 5.5 : 4) + '" fill="' + c + '" stroke="#fff" stroke-width="1.5"/>';
    if (last) g += '<text x="' + (x(i) - 4) + '" y="' + (y(e.s) - 9) + '" font-size="12" font-weight="800" text-anchor="end" fill="' + c + '">' + e.s + '점</text>'; });
  if (L.length) g += '<text x="' + x(0) + '" y="' + (H - 5) + '" font-size="10" fill="#64748b">' + p40MD(L[0].d) + '</text><text x="' + x(L.length - 1) + '" y="' + (H - 5) + '" font-size="10" text-anchor="end" fill="#64748b">' + p40MD(L[L.length - 1].d) + '</text>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:auto" role="img" aria-label="전국주간 점수 추이">' + g + '</svg>';
}
function p40DyChart(L){
  var W = 330, H = 150, mid = 75, bw = (W - 16) / Math.max(1, L.length), g = '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" stroke="#64748b"/><text x="' + (W - 2) + '" y="' + (mid - 4) + '" font-size="10" text-anchor="end" fill="#64748b">학원 평균</text>';
  L.forEach(function(e, i){ var df = Math.round(e.s - e.avg), hh = Math.min(60, Math.abs(df) * 3.2), xx = 8 + i * bw + bw * .2, w = bw * .6, c = df >= 0 ? '#16a34a' : '#ea580c';
    g += '<rect x="' + xx + '" y="' + (df >= 0 ? mid - hh : mid) + '" width="' + w + '" height="' + Math.max(2, hh) + '" rx="3" fill="' + c + '"/><text x="' + (xx + w / 2) + '" y="' + (df >= 0 ? mid - hh - 4 : mid + hh + 11) + '" font-size="10" font-weight="800" text-anchor="middle" fill="' + c + '">' + (df >= 0 ? '+' : '') + df + '</text>'; });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:auto" role="img" aria-label="일일테스트 학원 평균과의 차이">' + g + '</svg>';
}
/* ② 성적 추이 화면 */
function vStrend(){
  var D = p40Data();
  var h = '<div class="pagehd"><button class="bk" onclick="goTab(\'score\')">←</button>📈 성적 추이</div><div class="p40wrap">';
  if (!D.wk.length && !D.dy.length) return h + '<div class="empty">아직 보여 드릴 시험 기록이 없어요.<br>테스트 리포트가 발행되면 이곳에 쌓입니다.</div></div>';
  if (!D.wk.length && P40.t === 'wk') P40.t = 'dy';
  h += '<div class="p40seg">' + [['wk', '🌐 전국주간테스트'], ['dy', '📝 일일테스트']].map(function(x){ return '<button type="button" class="' + (P40.t === x[0] ? 'on' : '') + '" onclick="p40Set(\'t\',\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="p40seg sm">' + [['8', '최근 8회'], ['all', '전체']].map(function(x){ return '<button type="button" class="' + (P40.p === x[0] ? 'on' : '') + '" onclick="p40Set(\'p\',\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
  if (P40.t === 'wk') {
    var L = P40.p === 'all' ? D.wk : D.wk.slice(-8);
    if (!L.length) return h + '<div class="empty">전국주간테스트 기록이 아직 없어요.</div></div>';
    var NL = p40Nat({ wk: L }), w = NL[NL.length - 1], pv = NL.length > 1 ? NL[NL.length - 2] : null, d = pv ? w.s - pv.s : null;
    h += '<div class="p40box"><div class="p40ct">🌐 전국주간테스트 <small>전국 같은 학년이 같은 시험지</small></div>'
      + '<div><b class="p40big">' + w.s + '점</b>' + (d != null ? ' <span class="' + (d >= 0 ? 'p40up' : 'p40dn') + '">지난번보다 ' + (d >= 0 ? '+' : '') + d + '</span>' : '') + '</div>'
      + '<div class="p40t" style="color:#0d2240;font-weight:800">' + esc(w.t) + '</div>'
      + (w.r && w.n ? '<div class="p40t">전국 ' + p40Rk(w.r, w.n) + ' · 상위 ' + Math.max(1, Math.round(w.r / w.n * 100)) + '%' + (w.avg != null ? ' · 전국 평균 ' + w.avg + '점' : '') + '</div>' : '')
      + p40WkChart(L)
      + '<div class="p40lg"><span><i style="background:#1d6fe8"></i>우리 아이</span><span><i style="background:#94a3b8"></i>전국 평균</span>' + [1, 2, 3, 4, 5].map(function(n){ return '<span class="p40rk" style="color:' + P40_GC[n][0] + ';background:' + P40_GC[n][1] + '">' + n + '등급</span>'; }).join('') + '</div>'
      + '<div class="p40t" style="margin-top:4px">등급 = 전국 상위 % (10% 이내 1 · 30% 2 · 50% 3 · 70% 4 · 그 아래 5)</div></div>';
    h += '<div class="p40box"><div class="p40ct">회차별 <small>최근이 위</small></div>';
    L.slice().reverse().forEach(function(e){ h += '<div class="p40r"><span class="dt">' + p40MD(e.d) + '</span><span class="mid"><b>' + e.s + '점</b>' + (e.avg != null ? ' <small>평균 ' + e.avg + '</small>' : '') + '<em>' + esc(e.t) + '</em></span>' + (e.nat && e.r && e.n ? p40Rk(e.r, e.n) : '<span class="p40t">—</span>') + '</div>'; });
    h += '</div>';
  } else {
    var A = (P40.p === 'all' ? D.dy : D.dy.slice(-8)), C = A.filter(function(e){ return e.avg != null; });
    if (!A.length) return h + '<div class="empty">일일테스트 기록이 아직 없어요.</div></div>';
    var up = C.filter(function(e){ return e.s >= e.avg; }).length, last = A[A.length - 1];
    h += '<div class="p40box"><div class="p40ct">📝 일일테스트 <small>날마다 범위·난이도가 달라요</small></div>'
      + (C.length ? '<div><b class="p40big">' + up + ' / ' + C.length + '회</b> <span class="p40up">학원 평균 이상</span></div>' : '')
      + '<div class="p40t" style="color:#0d2240;font-weight:800">최근: ' + esc(last.t) + ' · ' + last.s + '점</div>'
      + '<div class="p40t">점수만 보면 오르내림이 커 보여서, 그날 학원 평균과의 차이로 봅니다. 위로 초록 = 평균보다 높음.</div>'
      + (C.length ? p40DyChart(C) : '') + '</div>';
    h += '<div class="p40box"><div class="p40ct">날짜별 <small>최근이 위</small></div>';
    A.slice().reverse().forEach(function(e){ var df = e.avg != null ? Math.round(e.s - e.avg) : null; h += '<div class="p40r"><span class="dt">' + p40MD(e.d) + '</span><span class="mid"><b>' + e.s + '점</b>' + (e.avg != null ? ' <small>학원 평균 ' + e.avg + '</small>' : '') + '<em>' + esc(e.t) + '</em></span>' + (df != null ? '<span class="p40tag ' + (df >= 0 ? 'up' : 'dn') + '">' + (df >= 0 ? '+' : '') + df + '</span>' : '') + '</div>'; });
    h += '</div>';
  }
  return h + '</div>';
}
