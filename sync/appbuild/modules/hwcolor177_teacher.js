/* ═══════════════════════════════════════════════════════════════════
 * v19-177: 🎨 숙제체크 칸 3판 — 색 = 이행도 · 모양 = 누가 매겼나 (원장 2026-11-05 「추천대로 배포」 · 계약 docs/hw_dispatch_contract.md §12 · 시안 docs/mockup_hwcheck_selfcell.html ③)
 *  · 칸 색 = 이행도 4단(선생님 값이든 학생 값이든 같은 잣대): 100 진초록 · 60~99 연두 · 30~59 주황 · 0~29 빨강. 60 = 학부모앱 미흡 선(HWC_CFG.v.weakBelow).
 *  · 칸 모양 = 누가 매겼나: 선생님 확인(lumen_hw 있음) = 색 꽉 채움 + 실선 · 학생 제출(sub, 선생님 값 없음) = 흰 바탕 + 같은 색 2px 점선 + 「🙋 제출」
 *    · 학생 작성 중 = 흰 바탕 + 점점선 + 「✎ 작성 중」(조금 흐리게) · 둘 다 없음 = 빈 칸(지금 모양). 숫자 = 그 값의 종합 %.
 *  · 칸 아래쪽 4칸 띠: 풀이·채점·오답·아하 각 값 4단 색(아하 해당 없음 · 없음 = 회색, 학생이 안 누른 단계 = 옅은 회색).
 *  · 보라 배지 「🙋80」: 선생님 값이 있고 학생 종합 − 선생님 종합 ≥ 30 일 때만(그때 아하 배지 ✋💡? 는 왼쪽 모서리로).
 *  · 탭: 🙋 제출 칸(선생님 값 없음) 한 번 = 되돌리기 기록 + 학생 값 그대로 hwcSave(거울·hw_teach_ 발행 그대로) · ✎ 작성 중 칸 = 세부 창 · 그 밖 = 바탕 hwcTap 그대로.
 *  · 오늘 칸 = 파란 바깥선(노란 테두리 대신 — 주황 이행도와 안 헷갈리게).
 *  · 줄 끝 「최근 4번」: 선생님 확인 최근 4번 평균 종합 칩 + ↗/→/↘(최근 2번 − 그 앞 2번, ±10) + 최근 3번 중 2번 이상 미흡이면 「🚑 후보」.
 *  · 반 머리: 맨 위 띠(#hws-bar) 날짜의 반 평균 종합 칩(선생님 값 우선, 없으면 학생 제출 값).
 *  · 맨 위 범례 한 줄(#hwk-legend). v19-176 의 칸 밖 알약은 그리지 않는다. 띠 · 반 머리 🙋n/m · 세부 창 학생 칸 맨 위는 그대로.
 *  · 수업 모드 칸도 같은 색·모양(조금 크게) · 줄 끝 · 반 평균은 날짜 그리드에만(아이패드 폭). 학생별 보기·인쇄표는 그대로.
 *  ※ 서버를 새로 묻지 않는다(v19-173 hwsLoad 30초 캐시 그대로). 문자열 연결로만 HTML. 앞 부품 hwsDecorate 는 같은 이름으로 다시 정의해 덮는다.
 * ═══════════════════════════════════════════════════════════════════ */
var HWK_TIER = {
  100: { f: '#bbf7d0', s: '#16a34a', c: '#15803d', chip: '#16a34a', t: '100' },
  60:  { f: '#ecfccb', s: '#84cc16', c: '#4d7c0f', chip: '#65a30d', t: '60~99' },
  30:  { f: '#fed7aa', s: '#f97316', c: '#c2410c', chip: '#ea580c', t: '30~59' },
  0:   { f: '#fecaca', s: '#ef4444', c: '#b91c1c', chip: '#dc2626', t: '0~29' }
};
var HWK_GAP = 30;   /* 보라 배지: 학생 종합 − 선생님 종합 이 이만큼 이상 */
function hwkTier(t){ t = Number(t) || 0; return t >= 100 ? 100 : (t >= 60 ? 60 : (t >= 30 ? 30 : 0)); }
function hwkWeak(){ try { return Number(HWC_CFG.v.weakBelow) || 60; } catch(e){ return 60; } }
function hwkToday(){ return new Date().toISOString().slice(0, 10); }   /* 그리드의 「오늘」 칸과 같은 기준 */
/* 단계 하나 색 — null(학생이 안 누름) 옅은 회색 · 'na'(해당 없음/없음) 회색 · 숫자 = 4단 선 색 */
function hwkStepCol(x){ if (x == null) return '#e2e8f0'; if (x === 'na') return '#cbd5e1'; return HWK_TIER[hwkTier(x)].s; }
/* mode: 'big' 수업 모드 큰 칸 · 'sm' 수업 모드 작은 칸(32px 미만) · 그 밖 그리드 */
function hwkSteps(vals, mode){
  var w = mode === 'big' ? 8 : (mode === 'sm' ? 4 : 6), hh = mode === 'big' ? 5 : (mode === 'sm' ? 3 : 3);
  var h = '<span class="hwk-steps" style="display:flex;gap:' + (mode === 'big' ? 2 : (mode === 'sm' ? 1 : 1.5)) + 'px;pointer-events:none;line-height:0">';
  ['p', 'c', 'w', 'a'].forEach(function(k, i){
    h += '<i class="hwk-s-' + k + '" style="display:block;width:' + w + 'px;height:' + hh + 'px;border-radius:2px;background:' + hwkStepCol(vals[i]) + '"></i>';
  });
  return h + '</span>';
}
function hwkCode(st){ return st && st.lumen_rec_code ? String(st.lumen_rec_code) : ''; }

/* ── 칸 하나 다시 칠하기 ── */
function hwkPaint(el, st, iso, cm, today){
  var code = hwkCode(st), v = hwcOf(st, iso), s = code ? hwsOf(code, iso) : null;
  var kind = v ? 'T' : (s ? (s.sub ? 'S' : 'D') : '');
  var sz = cm ? (parseInt(el.style.width, 10) || 52) : 40, hh = cm ? sz : 44, big = cm ? (sz >= 52 ? 'big' : (sz < 32 ? 'sm' : '')) : '';
  var ring = (iso === today) ? 'outline:2px solid #1d6fe8;outline-offset:2px;' : '';
  var box = 'width:' + sz + 'px;height:' + hh + 'px;border-radius:' + (cm ? 11 : 9) + 'px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'gap:' + (cm ? 2 : 1) + 'px;font-weight:900;cursor:pointer;position:relative;box-sizing:border-box;line-height:1.05;font-variant-numeric:tabular-nums;padding:0;' + ring;
  el.setAttribute('data-hwk', kind);
  if (!kind) {
    el.style.cssText = box + (cm ? 'border:2px solid #e2e8f0' : 'border:1.5px solid #eef2f7') + ';background:#fbfcfe';
    return;
  }
  var tot = kind === 'T' ? hwcTotalFor(st, iso) : hwsTot(s), tier = hwkTier(tot), K = HWK_TIER[tier];
  el.setAttribute('data-tier', String(tier)); el.setAttribute('data-tot', String(tot));
  var shape = kind === 'T' ? 'background:' + K.f + ';border:2px solid ' + K.s
    : (kind === 'S' ? 'background:#fff;border:2px dashed ' + K.s : 'background:#fff;border:' + (cm ? 2 : 1.5) + 'px dotted ' + K.s + ';opacity:.8');
  el.style.cssText = box + shape + ';color:' + K.c;
  /* 바탕이 그린 아하 배지(✋ 💡 ?)는 살린다 */
  var keep = [];
  Array.prototype.forEach.call(el.children, function(c){ if (c.style && c.style.position === 'absolute') keep.push(c.outerHTML); });
  var fsV = cm ? (sz >= 52 ? 15 : sz >= 40 ? 12.5 : 10.5) : (kind === 'T' ? 11.5 : 10.5);
  var inner = '<span class="hwk-v" style="font-size:' + fsV + 'px">' + tot + '</span>';
  if (kind !== 'T') {
    var lab = kind === 'S' ? '🙋 제출' : '✎ 작성 중';
    if (cm && sz < 40) lab = kind === 'S' ? '🙋' : '✎';
    if (cm && sz < 32) lab = '';   /* 아주 작은 칸은 모양(점선 · 점점선)만으로 */
    if (lab) inner += '<span class="hwk-who" style="font-size:' + (cm ? (sz >= 52 ? 9.5 : 8.5) : 8) + 'px;font-weight:800;white-space:nowrap;letter-spacing:-.4px">' + lab + '</span>';
  }
  if (kind === 'T') {
    var ap = hwcAhaFinal(st, code, iso);
    inner += hwkSteps([v.p, v.c, v.w, (ap === null || ap === undefined) ? 'na' : ap], big);
  } else inner += hwkSteps([s.p, s.c, s.w, s.a], big);
  var purple = '';
  if (kind === 'T' && s) {
    var st2 = hwsTot(s);
    if (st2 - tot >= HWK_GAP) {
      purple = '<span class="hwk-bdg" title="' + hwsEsc('🙋 학생은 ' + st2 + '% 라고 했어요 (선생님 확인 ' + tot + '%)') + '" style="position:absolute;top:-7px;right:-8px;z-index:1;border-radius:10px;padding:0 ' + (cm ? 5 : 3) + 'px;font-size:' + (cm ? 10.5 : 8.5) + 'px;font-weight:900;line-height:' + (cm ? 17 : 14) + 'px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.18);background:#7c3aed;color:#fff;white-space:nowrap;letter-spacing:-.3px">🙋' + st2 + '</span>';
      keep = keep.map(function(x){ return x.replace(/right:-(\d+)px/, 'left:-$1px'); });   /* 아하 배지는 왼쪽 모서리로 */
    }
  }
  el.innerHTML = inner + keep.join('') + purple;
  /* 설명 줄 */
  var md = hwsMD(iso), nm = st.name || '';
  if (kind === 'S') el.setAttribute('title', nm + ' · ' + md + '\n🙋 학생 제출 (선생님 확인 전) — 한 번 누르면 학생 값 그대로 저장\n🙋 학생 스스로: ' + hwsLine(s) + '\n→ 학생 종합 ' + tot + '%');
  else if (kind === 'D') el.setAttribute('title', nm + ' · ' + md + '\n✎ 학생 작성 중 (아직 제출 전) — 누르면 세부 창\n🙋 학생 스스로: ' + hwsLine(s) + '\n→ 학생 종합 ' + tot + '%');
  else if (s) el.setAttribute('title', (el.getAttribute('title') || '') + '\n🙋 학생 스스로: ' + hwsLine(s) + ' (학생 종합 ' + hwsTot(s) + '%)');
}

/* ── 줄 끝 「최근 4번」 — 선생님 확인 기록만 · 날짜 내림차순 ── */
function hwkRecent(st){
  var today = hwkToday(), hw = (st && st.lumen_hw) || {};
  var ds = Object.keys(hw).filter(function(k){ return /^\d{4}-\d\d-\d\d$/.test(k) && k <= today && hwcOf(st, k); }).sort().reverse().slice(0, 4);
  var tots = ds.map(function(d){ return hwcTotalFor(st, d); });
  if (!tots.length) return null;
  var avg = function(a){ return a.reduce(function(x, y){ return x + y; }, 0) / a.length; };
  var out = { dates: ds, tots: tots, avg: Math.round(avg(tots)), trend: '', diff: null, rc: false };
  if (tots.length >= 2) {
    var cut = tots.length >= 3 ? 2 : 1;   /* 4번 = 최근 2번 vs 그 앞 2번 · 3번 = 최근 2번 vs 1번 · 2번 = 1번 vs 1번 */
    var d = avg(tots.slice(0, cut)) - avg(tots.slice(cut));
    out.diff = Math.round(d);
    out.trend = d >= 10 ? 'up' : (d <= -10 ? 'down' : 'flat');
    var wk = hwkWeak();
    out.rc = tots.slice(0, 3).filter(function(x){ return x < wk; }).length >= 2;
  }
  return out;
}
function hwkRecentTd(st){
  var r = hwkRecent(st);
  var h = '<td class="hwk-rec" style="white-space:nowrap;padding:3px 8px;font-size:11px;font-weight:900;text-align:left">';
  if (!r) return h + '<span style="color:#cbd5e1;font-weight:700;font-size:10px">기록 없음</span></td>';
  var K = HWK_TIER[hwkTier(r.avg)];
  var tip = '선생님 확인 최근 ' + r.tots.length + '번: ' + r.dates.map(function(d, i){ return hwsMD(d) + ' ' + r.tots[i] + '%'; }).join(' · ')
    + (r.diff !== null ? '\n추세: 최근 ' + (r.tots.length >= 3 ? 2 : 1) + '번 평균 − 그 앞 평균 = ' + (r.diff > 0 ? '+' : '') + r.diff : '');
  h += '<span class="hwk-avg" data-avg="' + r.avg + '" data-tier="' + hwkTier(r.avg) + '" title="' + hwsEsc(tip) + '" style="display:inline-block;border-radius:8px;padding:1px 7px;color:#fff;background:' + K.chip + '">' + r.avg + '%</span>';
  if (r.trend) {
    var ar = r.trend === 'up' ? ['↗', '#15803d'] : (r.trend === 'down' ? ['↘', '#dc2626'] : ['→', '#64748b']);
    h += ' <span class="hwk-trend" data-t="' + r.trend + '" style="font-size:13px;color:' + ar[1] + '">' + ar[0] + '</span>';
  }
  if (r.rc) h += '<span class="hwk-rc" title="' + hwsEsc('최근 3번 중 2번 이상 종합 ' + hwkWeak() + '% 미만 — 숙제 미흡 리커버리 후보') + '" style="display:inline-block;margin-left:4px;font-size:10px;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:1px 6px">🚑 후보</span>';
  return h + '</td>';
}

/* ── 반 머리 평균 — 그날 선생님 값 우선, 없으면 학생 제출 값 ── */
function hwkClassAvg(grp, iso){
  var a = [], nT = 0, nS = 0;
  (students || []).forEach(function(st){
    if (!st || st.withdrawn || hwsGridGroup(st) !== grp) return;
    if (hwcOf(st, iso)) { a.push(hwcTotalFor(st, iso)); nT++; return; }
    var code = hwkCode(st), s = code ? hwsOf(code, iso) : null;
    if (s && s.sub) { a.push(hwsTot(s)); nS++; }
  });
  if (!a.length) return null;
  return { avg: Math.round(a.reduce(function(x, y){ return x + y; }, 0) / a.length), nT: nT, nS: nS };
}

/* ── 범례 한 줄 ── */
function hwkLegendHtml(){
  var wk = hwkWeak();
  var sw = function(t){ var K = HWK_TIER[t]; return '<span class="hwk-sw" data-tier="' + t + '" style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap"><i style="display:inline-block;width:20px;height:13px;border-radius:4px;background:' + K.f + ';border:2px solid ' + K.s + ';box-sizing:border-box"></i>' + K.t + '</span>'; };
  var shp = function(css, txt){ return '<span style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap"><i style="display:inline-block;width:18px;height:13px;border-radius:4px;box-sizing:border-box;' + css + '"></i>' + txt + '</span>'; };
  var h = '<div id="hwk-legend" style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11px;font-weight:800;color:#475569;margin-bottom:8px;position:sticky;left:0">';
  h += '<span style="color:#0d2240;font-weight:900">이행도</span>' + sw(100) + sw(60);
  h += '<span class="hwk-weak" style="display:inline-block;border-left:2px dashed #dc2626;height:16px;margin:0 3px"></span>' + sw(30) + sw(0);
  h += '<span style="color:#dc2626;white-space:nowrap">← 빨간 점선 아래 = 학부모앱 「미흡」' + (wk !== 60 ? ' <b>(지금 기준은 종합 ' + wk + '% 미만)</b>' : '') + '</span>';
  h += '<span style="color:#cbd5e1">|</span><span style="color:#0d2240;font-weight:900">모양</span>';
  h += shp('background:#bbf7d0;border:2px solid #16a34a', '꽉 채움 = 선생님 확인');
  h += shp('background:#fff;border:2px dashed #16a34a', '점선 = 🙋 학생 제출');
  h += shp('background:#fff;border:1.5px dotted #16a34a;opacity:.8', '점점선 = ✎ 작성 중');
  h += '<span style="color:#cbd5e1">|</span><span style="white-space:nowrap"><b style="background:#7c3aed;color:#fff;border-radius:8px;padding:0 4px">🙋80</b> 학생이 ' + HWK_GAP + ' 이상 높게 말함</span>';
  h += shp('background:#fff;border:1.5px solid #eef2f7;outline:2px solid #1d6fe8;outline-offset:1px', '오늘');
  return h + '</div>';
}

/* ── 숙제체크 화면에 얹기 (v19-173 의 rHwCheck 감싸기가 이 이름을 부른다 · v19-176 판을 덮는다) ── */
function hwsDecorate(h, cm){
  var tp = document.createElement('template'); tp.innerHTML = h;
  var C = tp.content, today = hwkToday();
  var byId = {}; (students || []).forEach(function(s){ if (s && s.id) byId[s.id] = s; });
  /* ① 칸 — 색 = 이행도 · 모양 = 누가 매겼나 (칸 밖 알약 없음) */
  Array.prototype.forEach.call(C.querySelectorAll('[id^="hwc-c-"]'), function(el){
    var m = /^hwc-c-(.+)-(\d{4}-\d\d-\d\d)$/.exec(el.id); if (!m) return;
    var st = byId[m[1]]; if (!st) return;
    var iso = m[2];
    try { hwkPaint(el, st, iso, !!cm, today); } catch(e){ try { console.error('[숙제체크 칸 색]', e); } catch(_){} }
    if (!el.hasAttribute('oncontextmenu')) el.setAttribute('oncontextmenu', "event.preventDefault();hwcOpenPop('" + hwsQ(st.id) + "','" + iso + "')");
  });
  var wrap = C.querySelector('#hwc-wrap');
  /* 수업 없는 날 빈 자리도 같은 크기로(줄이 들쭉날쭉하지 않게) */
  if (!cm && wrap) Array.prototype.forEach.call(wrap.querySelectorAll('td > span:not([id])'), function(sp){
    if (sp.style.width === '30px' && /fafafa/i.test(sp.getAttribute('style') || '')) { sp.style.width = '40px'; sp.style.height = '44px'; sp.style.borderRadius = '9px'; }
  });
  /* ② 반 머리 「한 번에」 줄 — 날짜마다 🙋 n/m (v19-176 그대로) */
  Array.prototype.forEach.call(C.querySelectorAll('button[onclick^="hwcAllDone("]'), function(b){
    var mm = /^hwcAllDone\('(.*)','(\d{4}-\d\d-\d\d)'\)$/.exec(b.getAttribute('onclick') || ''); if (!mm) return;
    var grp = mm[1].replace(/\\'/g, "'"), iso = mm[2];
    var rows = hwsDayRows(iso, grp).filter(function(r){ return r.s === 'sub'; }); if (!rows.length) return;
    var size = (students || []).filter(function(st){ return st && !st.withdrawn && hwsGridGroup(st) === grp; }).length;
    var left = rows.filter(function(r){ return !hwcOf(r.st, iso); }).length;
    b.insertAdjacentHTML('afterend', '<button class="hws-chip" data-n="' + rows.length + '" data-m="' + size + '" onclick="hwsAcceptSub(\'' + hwsEsc(hwsQ(grp)) + '\',\'' + iso + '\')"'
      + ' title="' + hwsEsc(grp + ' 반 ' + hwsMD(iso) + ' — 제출한 학생 ' + rows.length + '명 / 반 ' + size + '명 · 누르면 제출한 학생만 학생 값 그대로 ✓ (아직 안 찍은 ' + left + '명 · 이미 찍은 칸은 건너뜁니다)') + '"'
      + ' style="display:block;margin:2px auto 0;border:1.5px solid #16a34a;background:' + (left ? '#16a34a' : '#f0fdf4') + ';color:' + (left ? '#fff' : '#15803d') + ';border-radius:999px;padding:1px ' + (cm ? 7 : 4) + 'px;font-size:' + (cm ? 12 : 10) + 'px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;line-height:1.3">🙋 ' + rows.length + '/' + size + '</button>');
  });
  /* ③ 맨 위 띠(v19-176) + 범례 */
  if (wrap) {
    wrap.insertAdjacentHTML('afterbegin', hwsBarHtml(cm ? HWC_CM : null));
    wrap.insertAdjacentHTML('afterbegin', hwkLegendHtml());
    var bar = wrap.querySelector('#hws-bar');
    if (bar) Array.prototype.forEach.call(bar.querySelectorAll('span'), function(sp){
      if (/알약/.test(sp.textContent || '')) sp.innerHTML = '<b style="color:#15803d">🙋 점선 칸</b> 한 번 누르면 학생 값 그대로 저장 · <b style="color:#15803d">✎ 점점선 칸</b> 누르면 세부 창';
    });
  }
  /* ④ 날짜 그리드만: 줄 끝 「최근 4번」 · 반 머리 평균 · 옛 안내 줄 */
  if (!cm && wrap) {
    var tbl = wrap.querySelector('table');
    var barIso = (wrap.querySelector('#hws-bar') || { getAttribute: function(){ return ''; } }).getAttribute('data-iso') || today;
    if (tbl) Array.prototype.forEach.call(tbl.querySelectorAll('tr'), function(tr){
      var first = tr.firstElementChild; if (!first) return;
      if (first.tagName === 'TH') { tr.insertAdjacentHTML('beforeend', '<th class="hwk-rec-h" style="font-size:10px;color:#94a3b8;font-weight:800;padding:4px 8px;white-space:nowrap;text-align:left" title="선생님이 확인한 최근 4번 평균 · 추세 · 🚑 리커버리 후보">최근 4번</th>'); return; }
      var rm = /^hwc-row-(.+)$/.exec(tr.id || '');
      if (rm) { var st = byId[rm[1]]; tr.insertAdjacentHTML('beforeend', st ? hwkRecentTd(st) : '<td></td>'); return; }
      if (first.hasAttribute('colspan')) {
        first.setAttribute('colspan', String((parseInt(first.getAttribute('colspan'), 10) || 1) + 1));
        var g = (first.firstChild && first.firstChild.nodeType === 3) ? String(first.firstChild.nodeValue || '').trim() : '';
        var ca = g ? hwkClassAvg(g, barIso) : null;
        if (ca) {
          var K = HWK_TIER[hwkTier(ca.avg)];
          first.insertAdjacentHTML('beforeend', ' <span class="hwk-cavg" data-avg="' + ca.avg + '" data-tier="' + hwkTier(ca.avg) + '" title="' + hwsEsc(g + ' 반 ' + hwsMD(barIso) + ' — 선생님 확인 ' + ca.nT + '명 · 학생 제출 ' + ca.nS + '명 (선생님 값 우선)') + '" style="display:inline-block;margin-left:4px;border-radius:10px;padding:0 7px;font-size:10px;font-weight:900;color:#fff;background:' + K.chip + '">' + hwsMD(barIso) + ' 평균 ' + ca.avg + '%</span>');
        }
        return;
      }
      if (String(first.textContent || '').trim() === '한 번에') tr.insertAdjacentHTML('beforeend', '<td style="background:#faf5ff"></td>');
    });
    Array.prototype.forEach.call(C.querySelectorAll('span'), function(sp){
      var tx = sp.textContent || '';
      if (/^막대 색:/.test(tx)) sp.innerHTML = '칸 아래 띠: <b>풀이 · 채점 · 오답 · 아하</b> (단계마다 이행도 색 · 회색 = 해당 없음)';
      else if (/^칸 클릭: 🟢 전부 100%/.test(tx)) sp.innerHTML = tx + ' · 🙋 제출 칸 = 한 번에 학생 값 저장 · ✎ 칸 = 창';
    });
  }
  return tp.innerHTML;
}

/* ── 탭: 🙋 제출 칸 = 학생 값 그대로 · ✎ 작성 중 칸 = 세부 창 · 그 밖 = 바탕 그대로 ── */
(function(){
  var orig = window.hwcTap; if (typeof orig !== 'function') return;
  window.hwkTapBase = orig;   /* 빈 칸 작은 창의 「🟢 전부 100%」 는 바탕 규칙 그대로 */
  window.hwcTap = function(stId, iso){
    try {
      var st = hwsStuById(stId);
      if (st && !hwcOf(st, iso)) {
        var code = hwkCode(st), s = code ? hwsOf(code, iso) : null;
        if (s && s.sub) {
          var md = hwsMD(iso), hw = hwsToHw(s);
          hwcMark([hwcSnap(st, iso)], st.name + ' ' + md + ' 학생값');
          hwcSave(st, iso, hw);
          HWC.pop = null; HWSF.arm = '';
          plToast('✓ ' + st.name + ' ' + md + ' — 🙋 학생 값 그대로 (풀이 ' + hw.p + ' · 채점 ' + hw.c + ' · 오답 ' + hw.w + ') · 잘못이면 ↩ 되돌리기');
          render(); return;
        }
        if (s) { hwcOpenPop(stId, iso); return; }
      }
    } catch(e){ try { console.error('[숙제체크 칸 탭]', e); } catch(_){} }
    return orig.apply(this, arguments);
  };
})();
if (typeof hwcPopHtml === 'function') hwcPopHtml = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try { if (h && h.indexOf('hws-mini') >= 0) h = h.replace(/onclick="hwcTap\(/g, 'onclick="hwkTapBase('); } catch(e){}
  return h;
}; })(hwcPopHtml);

/* ── 모양 ── */
(function(){
  var st = document.createElement('style'); st.id = 'hwk177-css';
  st.textContent = '[data-hwk="S"]:hover,[data-hwk="D"]:hover{filter:brightness(.97);box-shadow:0 1px 5px rgba(13,34,64,.18)}[data-hwk="T"]:hover{filter:brightness(.98)}';
  (document.head || document.documentElement).appendChild(st);
})();
