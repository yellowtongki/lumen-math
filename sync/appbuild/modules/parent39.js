/* ═══════════════════════════════════════════════════════════════════
 * v1-39: 📑 월간 학습 보고서 — 루멘 학부모앱에서 보기 (원장 2026-11-10 「학부모앱에서도 월간보고서가 보이게」 · 시안 docs/mockup_monthly_report.html)
 *  읽기: lumen_store mfrep_pub_<내 아이 코드> = { code, months: { 'YYYY-MM': {...} } }
 *        ← 원장님이 학원앱 📑 월간보고서에서 「루멘 학부모앱」에 공개하면 서버(sync/mf_report_worker.js)가 쓴다.
 *        숫자는 매쓰플랫 보고서 그대로 · 의견 = 원장님이 확정한 글 · «루멘 기록»(숙제 이행도·아하노트 질문·플래너)만 우리 자료.
 *  ① 리포트 탭 맨 위: 달별 보고서 줄(누르면 보고서 화면) — 없으면 예전 v1-34 PDF 목록(있을 때만) 그대로
 *  ② 보고서 화면(P.tab 'mrep'): 달 고르기 · 한눈에 · 3달 정답률 · 단원별 · 난이도별 · 학습 영역 · 공부한 교재 · 선생님 의견 · 루멘 기록
 *  ③ 홈 맨 위 「📑 10월 학습 보고서가 도착했어요」 — 공개 14일 안 · 이 폰에서 아직 안 연 달만(localStorage p39_seen_<코드>)
 *  쓰기 없음. ES5 · 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var P39 = { ym: '' };
function p39Months(){
  var v = P.mpub; if (!v || typeof v !== 'object' || !v.months) return [];
  if (v.code && String(v.code) !== String(P.code || '')) return [];   /* 다른 아이 것이면 안 보인다 */
  return Object.keys(v.months).filter(function(k){ return /^\d{4}-\d{2}$/.test(k) && v.months[k]; }).sort().reverse();
}
function p39Get(ym){ var v = P.mpub; return (v && v.months && v.months[ym]) || null; }
function p39Ml(ym){ return Number(String(ym).slice(5, 7)) + '월'; }
function p39Seen(){ try { return localStorage.getItem('p39_seen_' + P.code) || ''; } catch(e){ return ''; } }
function p39MarkSeen(ym){ try { if (ym > p39Seen()) localStorage.setItem('p39_seen_' + P.code, ym); } catch(e){} }
window.p39Open = function(ym){ var ms = p39Months(); P39.ym = ym || ms[0] || ''; if (P39.ym) p39MarkSeen(P39.ym); goTab('mrep'); };
window.p39Pick = function(ym){ P39.ym = ym; p39MarkSeen(ym); render(); window.scrollTo(0, 0); };

/* ③ 홈 도착 카드 */
function p39ArriveCard(){
  var ms = p39Months(); if (!ms.length) return '';
  var ym = ms[0], m = p39Get(ym); if (!m) return '';
  if (p39Seen() >= ym) return '';
  var at = Date.parse(m.at || ''); if (!isNaN(at) && Date.now() - at > 14 * 864e5) return '';
  return '<button type="button" class="p39arr" onclick="p39Open(\'' + ym + '\')"><span class="ic">📑</span><span class="tx"><b>' + p39Ml(ym) + ' 학습 보고서가 도착했어요</b><small>정답률 ' + (m.rate || 0) + '% · 푼 문항 ' + (m.count || 0) + '개 · 선생님 의견</small></span><span class="go">보기 ›</span></button>';
}
/* ① 리포트 탭 — 달별 줄 */
function p39ReportList(){
  var ms = p39Months(); if (!ms.length) return '';
  var h = '<div class="p39box"><div class="p39h">📑 월간 학습 보고서</div><div class="p39s">한 달 공부를 정리한 보고서입니다 · 눌러서 보세요</div>';
  ms.forEach(function(ym){
    var m = p39Get(ym);
    h += '<button type="button" class="p39row" onclick="p39Open(\'' + ym + '\')"><span class="ic">📑</span><span class="tx"><b>' + ym.slice(0, 4) + '년 ' + p39Ml(ym) + ' 보고서</b><small>정답률 ' + (m.rate || 0) + '% · 푼 문항 ' + (m.count || 0) + '개</small></span><span class="go">보기 ›</span></button>';
  });
  return h + '</div>';
}
/* 막대 한 줄 */
function p39Bar(label, rate, cmp, n, low){
  rate = Math.max(0, Math.min(100, Number(rate) || 0));
  var h = '<div class="p39bar"><span class="l">' + esc(label) + (n != null ? '<small>' + n + '문항</small>' : '') + '</span><span class="tr"><i class="' + (low ? 'low' : '') + '" style="width:' + rate + '%"></i>';
  if (cmp != null && cmp > 0) h += '<em style="left:' + Math.min(100, cmp) + '%" title="전국 같은 학년 ' + cmp + '%"></em>';
  return h + '</span><span class="v">' + rate + '%</span></div>';
}
/* ② 보고서 화면 */
function vMrep(){
  var ms = p39Months();
  var h = '<div class="pagehd"><button class="bk" onclick="goTab(\'report\')">←</button>📑 월간 학습 보고서</div>';
  if (!ms.length) return h + '<div class="empty">아직 도착한 보고서가 없어요.<br>원장님이 보고서를 올리면 이곳에서 볼 수 있습니다.</div>';
  if (!P39.ym || ms.indexOf(P39.ym) < 0) P39.ym = ms[0];
  var ym = P39.ym, m = p39Get(ym) || {};
  h += '<div class="p39wrap">';
  if (ms.length > 1) h += '<div class="p39mon">' + ms.slice().reverse().map(function(x){ return '<button type="button" class="' + (x === ym ? 'on' : '') + '" onclick="p39Pick(\'' + x + '\')">' + p39Ml(x) + '</button>'; }).join('') + '</div>';
  /* 한눈에 */
  var dif = (m.prevRate != null) ? (Number(m.rate || 0) - Number(m.prevRate)) : null;
  h += '<div class="p39card"><div class="p39t">' + esc(ym.slice(0, 4) + '년 ' + p39Ml(ym)) + ' 한눈에</div><div class="p39big">'
    + '<div><b>' + (m.rate || 0) + '%</b><span>정답률</span></div><div><b>' + (m.count || 0) + '</b><span>푼 문항</span></div>'
    + (m.rank ? '<div><b>' + m.rank + '등급</b><span>전국 같은 학년</span></div>' : '') + '</div>';
  var sub = [];
  if (m.rateCmp) sub.push('전국 같은 학년 평균 ' + m.rateCmp + '%');
  if (dif != null) sub.push(p39Ml(m.prevM || '') + '보다 ' + (dif > 0 ? dif + '%p 올랐어요 ↑' : (dif < 0 ? (-dif) + '%p 내려갔어요 ↓' : '같아요')));
  if (sub.length) h += '<div class="p39sub' + (dif != null && dif < 0 ? ' dn' : '') + '">' + esc(sub.join(' · ')) + '</div>';
  h += '</div>';
  /* 3달 정답률 */
  if ((m.months || []).length > 1) {
    h += '<div class="p39card"><div class="p39t">최근 정답률 <small>막대 = 우리 아이 · 세로줄 = 전국 같은 학년</small></div>';
    m.months.forEach(function(x){ h += p39Bar(p39Ml(x.m), x.rate, x.cmp, x.n, false); });
    h += '</div>';
  }
  /* 단원별 */
  var ch = (m.chapters || []).slice().sort(function(a, b){ return (b.n || 0) - (a.n || 0); }).slice(0, 8);
  if (ch.length) {
    h += '<div class="p39card"><div class="p39t">단원별 정답률 <small>많이 푼 단원 순</small></div>';
    ch.forEach(function(c){ h += p39Bar(c.name, c.rate, null, c.n, (c.rate || 0) < 70); });
    h += '</div>';
  }
  /* 난이도별 */
  var lv = (m.levels || []).filter(function(x){ return (x.n || 0) > 0; });
  if (lv.length) {
    var LN = { 1: '하', 2: '중하', 3: '중', 4: '중상', 5: '상' };
    h += '<div class="p39card"><div class="p39t">난이도별 정답률 <small>세로줄 = 전국 같은 학년</small></div>';
    lv.forEach(function(x){ h += p39Bar((LN[x.l] || x.l) + ' 난이도', x.rate, x.cmp, x.n, false); });
    h += '</div>';
  }
  /* 학습 영역 */
  if ((m.evals || []).length) {
    h += '<div class="p39card"><div class="p39t">수학 역량 <small>세로줄 = 전국 같은 학년</small></div>';
    m.evals.forEach(function(x){ h += p39Bar(x.name, x.rate, x.cmp, null, false); });
    h += '</div>';
  }
  /* 공부한 교재 */
  var bk = (m.books || []).slice(0, 5), shN = (m.sheets && m.sheets.n) || 0;
  if (bk.length || shN) {
    h += '<div class="p39card"><div class="p39t">이번 달 공부한 것</div>';
    bk.forEach(function(b){ h += '<div class="p39bk"><b>' + esc(b.title) + '</b><span>' + (b.from ? 'p' + b.from + (b.to && b.to !== b.from ? '~' + b.to : '') + ' · ' : '') + (b.n || 0) + '문항 · ' + (b.rate || 0) + '%</span></div>'; });
    if (shN) h += '<div class="p39bk"><b>학습지 ' + shN + '장</b><span>' + ((m.sheets && m.sheets.count) || 0) + '문항</span></div>';
    h += '</div>';
  }
  /* 선생님 의견 */
  if (String(m.comment || '').trim()) h += '<div class="p39card"><div class="p39t">선생님 의견</div><p class="p39q">' + esc(m.comment).replace(/\n/g, '<br>') + '</p><div class="p39sig">루멘수학</div></div>';
  /* 루멘 기록 */
  var L = m.lumen || {}, li = [];
  if (L.hw != null) li.push(['숙제 이행도', L.hw + '%', '수업 때 선생님 확인 ' + (L.hwN || 0) + '번 평균']);
  if (L.aha != null) li.push(['아하노트 질문', L.aha + '개', '모르는 문제를 스스로 질문으로 정리한 수']);
  if (L.plan != null) li.push(['플래너 평균', L.plan + '점', '10점 만점 · ' + (L.planN || 0) + '일']);
  if (li.length) {
    h += '<div class="p39card"><div class="p39t">루멘 기록 <small>학원 안에서 쌓은 기록</small></div><div class="p39lm">';
    li.forEach(function(x){ h += '<div><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span><small>' + esc(x[2]) + '</small></div>'; });
    h += '</div></div>';
  }
  h += '<div class="p39foot">숫자는 매쓰플랫 학습 기록으로 만든 보고서와 같습니다.</div></div>';
  return h;
}
