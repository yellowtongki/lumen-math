/* ═══════════════════════════════════════════════════════════════════
 * v19-159: 🏠 홈에 «📅 오늘 운영 할 일» 카드 + 위쪽 탭 «📅 운영 달력» (원장 10/26 「홈화면에 운영달력 안 보인다」)
 *   v19-158 은 홈 탭 안 «대시보드» 옆에 넣었는데, 홈 탭은 누르면 바로 대시보드라 그 줄이 보이지 않았다.
 *   · 홈 카드: 밀린 일(10/1 이후 · 체크 안 함) + 오늘 할 일(운영·마케팅·돈·지표) — 그 자리에서 체크 · «운영 달력 열기 ›»
 *   · «오늘 챙길 것» 개수에 운영 할 일(오늘 + 밀린 일)을 더한다
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
/* 밀린 일을 세기 시작하는 날 = 계획을 넣은 날의 1주 전 */
function opsStart(){ var u = (OPS.plan && (OPS.plan.start || OPS.plan.upd)) || '2026-10-01'; return opsAdd(String(u).slice(0, 10), -7); }
function opsHomeList(){
  if (!OPS.loaded || !OPS.plan) return null;
  var t = opsToday(), y = +t.slice(0, 4), m = +t.slice(5, 7), py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  var all = opsItems(py, pm).concat(opsItems(y, m)).filter(function(x){ return x.L !== 'sch' && x.L !== 'acad'; });
  return { over: all.filter(opsOver), today: all.filter(function(x){ return x.d === t; }),
    next: opsItems(y, m).concat(m === 12 ? opsItems(y + 1, 1) : opsItems(y, m + 1)).filter(function(x){ return x.d > t && x.d <= opsAdd(t, 7) && x.L !== 'acad'; }) };
}
function opsHomeCount(){ var l = opsHomeList(); if (!l) return 0; return l.over.length + l.today.filter(function(x){ return !opsDone(x); }).length; }
function opsHomeCard(){
  if (!OPS.loaded && !OPS.loading) setTimeout(function(){ opsLoad(); }, 0);
  var l = opsHomeList(), box = 'background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:16px 20px;box-shadow:0 3px 12px rgba(13,34,64,0.05);margin-bottom:16px';
  var go = '<button type="button" onclick="VIEW=\'opscal\';OPS.view=\'month\';OPS.man=\'\';render()" style="margin-left:auto;font-family:inherit;font-size:12.5px;font-weight:800;border:1.5px solid #1d4ed8;color:#1d4ed8;background:#fff;border-radius:10px;padding:5px 12px;cursor:pointer">📅 운영 달력 열기 ›</button>';
  var head = function(extra){ return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:15px;color:#0d2240">📅 오늘 운영 할 일</b>' + (extra || '') + go + '</div>'; };
  if (!OPS.loaded) return '<div style="' + box + '">' + head() + '<div style="font-size:13px;color:#94a3b8;font-weight:700">불러오는 중…</div></div>';
  if (!l) return '<div style="' + box + '">' + head() + '<div style="font-size:13px;color:#64748b">운영 계획이 아직 없습니다.</div></div>';
  var undone = l.today.filter(function(x){ return !opsDone(x); }).length;
  var h = opsCss() + '<div style="' + box + '">' + head('<span style="font-size:12.5px;font-weight:800;color:#2563eb;background:#e6eefc;border-radius:8px;padding:0 8px">오늘 ' + undone + '/' + l.today.length + '</span>' + (l.over.length ? '<span style="font-size:12.5px;font-weight:900;color:#dc2626;background:#fde8e8;border-radius:8px;padding:0 8px">밀린 일 ' + l.over.length + '</span>' : ''));
  var rows = l.over.concat(l.today);
  h += rows.slice(0, 7).map(function(x){ return opsRow(x, true, false); }).join('');
  if (rows.length > 7) h += '<div style="font-size:12.5px;color:#64748b;font-weight:700;padding-top:4px">외 ' + (rows.length - 7) + '건 — 운영 달력에서</div>';
  if (!rows.length) h += '<div style="font-size:13px;color:#16a34a;font-weight:800">오늘 할 운영 일이 없습니다 🎉</div>';
  if (l.next.length) h += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #eef1f7;font-size:12.5px;color:#475569;line-height:1.7"><b style="color:#0d2240">앞으로 7일</b> · '
    + l.next.slice(0, 6).map(function(x){ return '<span style="white-space:nowrap">' + opsMd(x.d) + ' ' + opsE(x.t.length > 18 ? x.t.slice(0, 18) + '…' : x.t) + '</span>'; }).join(' · ') + (l.next.length > 6 ? ' · 외 ' + (l.next.length - 6) : '') + '</div>';
  return h + '</div>';
}
