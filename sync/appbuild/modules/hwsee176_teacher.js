/* ═══════════════════════════════════════════════════════════════════
 * v19-176: 🙋 학원앱에서 학생 체크 잘 보이게 (원장 2026-11-05 「학원앱에서 학생체크가 더 잘보이게」 · 계약 docs/hw_dispatch_contract.md §11-2)
 *  · 학생앱 v2-161 이 「📤 선생님께 제출」을 누르면 hw_self_<코드>.byDate[수업일].sub = 제출 시각 을 적는다.
 *    hwsOf 가 sub 도 돌려준다(값 0/30/60/100 · aNone → a='na' 는 v19-175 그대로).
 *  · 숙제체크 칸: 작은 점 4개(빈 칸 점선 포함)를 없애고 칸 아래 알약 하나 —
 *    제출 = 초록 바탕 흰 글자 「🙋 63」 · 제출 전 작성 중 = 흰 바탕 초록 테두리 「✎ 63」 · 안 누름 = 아무것도 안 그림.
 *    숫자 = 학생 종합(풀이·채점·오답 + 아하가 숫자면 아하, 평균 반올림). 알약을 누르면 세부 창(학생 값 보기).
 *  · 맨 위 띠 #hws-bar: 보고 있는 날짜(오늘 · 오늘 수업이 없으면 가장 최근 수업일) 「🙋 제출 n명 · ✎ 작성 중 n명 · 안 함 n명」
 *    + 「제출한 학생 전부 학생 값으로 ✓」(이미 선생님이 찍은 칸은 건너뜀). 수업 모드면 그 반만 센다.
 *  · 반 머리 「한 번에」 줄: 날짜마다 「🙋 n/m」(제출/반 인원) — 누르면 그 반·그 날짜 제출 학생만 학생 값으로 ✓. (v19-173 🟢n 단추 대신)
 *  · 세부 창: 「🙋 학생 스스로」 칸을 제목 바로 아래 맨 위로 올리고 크게(단계 4칸 · 제출 상태 줄 · 「학생 값 그대로 ✓ 저장」).
 *    빈 칸 오른쪽 클릭 작은 창도 같은 모양. 아래쪽 옛 줄은 옮겨 왔으므로 두 번 나오지 않는다.
 *  · 저장(hwcSave)·거울·hw_teach_ 발행·셀프 XP 끔은 v19-175 그대로. 서버는 v19-173 의 hwsLoad(30초 캐시 · 묻는 중이면 또 묻지 않기)만 쓴다.
 *  ※ 문자열 연결로만 HTML. 앞 부품 함수(hwsOf · hwsLine · hwsDecorate · hwsPopSec)는 같은 이름으로 다시 정의해 덮는다.
 * ═══════════════════════════════════════════════════════════════════ */

/* ── 값 읽기: v19-175 + sub(제출 시각) ── */
function hwsOf(code, iso){
  if (typeof HWSF === 'undefined' || !HWSF || !code || !iso) return null;
  var b = HWSF.by[String(code)]; var d = b && b.byDate && b.byDate[iso];
  if (!d || typeof d !== 'object') return null;
  var out = { at: d.at || '', aNone: !!d.aNone, sub: d.sub || '' }, any = false;
  HWSF_STEP.forEach(function(s){
    var k = s[0];
    if (k === 'a' && d.aNone) { out.a = 'na'; any = true; return; }
    if (d[k] == null || d[k] === '') { out[k] = null; return; }
    var n = Number(d[k]); if (isNaN(n)) { out[k] = null; return; }
    out[k] = n >= 100 ? 100 : (n >= 60 ? 60 : (n >= 30 ? 30 : 0)); any = true;
  });
  return any ? out : null;
}
/* 학생 종합 % — 풀이·채점·오답(안 누른 칸은 0) + 아하가 숫자면 아하 */
function hwsTot(v){
  if (!v) return 0;
  var a = [hwsNum(v.p), hwsNum(v.c), hwsNum(v.w)];
  if (typeof v.a === 'number') a.push(v.a);
  return Math.round(a.reduce(function(x, y){ return x + y; }, 0) / a.length);
}
function hwsState(v){ return !v ? '' : (v.sub ? 'sub' : 'draft'); }
function hwsVal(x, isA){ if (x == null) return '—'; if (x === 'na') return isA ? '없음' : '—'; return String(Number(x) || 0); }
/* 「풀이 60 · 채점 0 · 오답 0 · 아하 없음 · 제출 16:28」 */
function hwsLine(v){
  if (!v) return '아직 안 눌렀어요';
  return HWSF_STEP.map(function(s){ return s[1] + ' ' + hwsVal(v[s[0]], s[0] === 'a'); }).join(' · ')
    + (v.sub ? ' · 제출 ' + hwsHM(v.sub) : (' · 아직 제출 안 함' + (v.at ? ' (' + hwsHM(v.at) + ' 작성)' : '')));
}

/* ── 칸 아래 알약 ── */
function hwsPill(v, big, stId, iso){
  if (!v) return '';
  var sub = !!v.sub, fs = big ? 13 : 11;
  var sty = 'display:block;width:max-content;margin:2px auto 0;padding:0 ' + (big ? 6 : 3) + 'px;border-radius:999px;font-size:' + fs + 'px;line-height:' + (fs + 3) + 'px;'
    + 'font-weight:900;white-space:nowrap;letter-spacing:-.3px;cursor:pointer;box-sizing:border-box;font-variant-numeric:tabular-nums;'
    + (sub ? 'background:#16a34a;color:#fff;border:1.5px solid #16a34a' : 'background:#fff;color:#15803d;border:1.5px solid #16a34a');
  return '<span class="hws-pill" data-hws="' + (sub ? 'sub' : 'draft') + '" onclick="event.stopPropagation();hwcOpenPop(\'' + hwsEsc(hwsQ(stId)) + '\',\'' + iso + '\')"'
    + ' title="' + hwsEsc('🙋 학생 스스로: ' + hwsLine(v)) + '" style="' + sty + '">'
    + '<span style="font-size:' + (big ? 11 : 9) + 'px">' + (sub ? '🙋' : '✎') + '</span>' + (big ? ' ' : '') + hwsTot(v) + '</span>';
}

/* ── 날짜 하나의 학생 줄 — 그 날 수업 있는 반 학생 + 그 날 스스로 누른 학생 (grp 를 주면 그 반만) ── */
function hwsDow(iso){ return new Date(iso + 'T00:00:00Z').getUTCDay(); }
function hwsLesson(st, iso){
  var g = hwsGridGroup(st); if (g === '미배정') return false;   /* 수업요일이 없는 반은 「누른 학생」만 센다 */
  var dd = []; try { dd = (typeof groupDays !== 'undefined' && groupDays && groupDays[g]) || []; } catch(e){ dd = []; }
  return dd.length ? dd.indexOf(hwsDow(iso)) >= 0 : false;
}
function hwsDayRows(iso, grp){
  var out = [];
  (students || []).forEach(function(st){
    if (!st || st.withdrawn) return;
    if (grp && hwsGridGroup(st) !== grp) return;
    var code = st.lumen_rec_code ? String(st.lumen_rec_code) : ''; if (!code) return;
    var v = hwsOf(code, iso);
    if (!v && !hwsLesson(st, iso)) return;
    out.push({ st: st, code: code, v: v, s: hwsState(v) });
  });
  return out;
}
/* 보고 있는 날짜 — 그리드 달 안에서 오늘(없으면 그 달 끝)부터 거꾸로, 수업이 있거나 누른 학생이 있는 첫 날 */
function hwsBarDate(grp){
  var today = new Date().toISOString().slice(0, 10);   /* 그리드의 「오늘」 칸과 같은 기준 */
  var y = HWC_YEAR, m = HWC_MONTH, dinm = new Date(y, m, 0).getDate();
  var first = hwcIso(y, m, 1), last = hwcIso(y, m, dinm);
  var start = today < first ? last : (today > last ? last : today);
  for (var d = Number(start.slice(8, 10)); d >= 1; d--) {
    var iso = hwcIso(y, m, d);
    if (hwsDayRows(iso, grp).length) return iso;
  }
  return start;
}
function hwsDowTxt(iso){ return ['일', '월', '화', '수', '목', '금', '토'][hwsDow(iso)]; }

/* ── 숙제체크 화면에 얹기 (v19-173 의 rHwCheck 감싸기가 이 이름을 부른다) ── */
function hwsDecorate(h, cm){
  var tp = document.createElement('template'); tp.innerHTML = h;
  var byId = {}; (students || []).forEach(function(s){ if (s && s.id) byId[s.id] = s; });
  /* ① 칸 아래 알약 */
  var cells = tp.content.querySelectorAll('[id^="hwc-c-"]');
  Array.prototype.forEach.call(cells, function(el){
    var m = /^hwc-c-(.+)-(\d{4}-\d\d-\d\d)$/.exec(el.id); if (!m) return;
    var st = byId[m[1]]; var code = st && st.lumen_rec_code ? String(st.lumen_rec_code) : ''; if (!code) return;
    var iso = m[2], v = hwsOf(code, iso);
    if (v) {
      el.insertAdjacentHTML('afterend', hwsPill(v, !!cm, st.id, iso));
      el.setAttribute('title', (el.getAttribute('title') || '') + '\n🙋 학생 스스로: ' + hwsLine(v));
    }
    if (!el.hasAttribute('oncontextmenu')) el.setAttribute('oncontextmenu', "event.preventDefault();hwcOpenPop('" + hwsQ(st.id) + "','" + iso + "')");
  });
  /* ② 반 머리 「한 번에」 줄 — 날짜마다 🙋 n/m (그 반 그 날 제출 수 / 반 인원) */
  var btns = tp.content.querySelectorAll('button[onclick^="hwcAllDone("]');
  Array.prototype.forEach.call(btns, function(b){
    var mm = /^hwcAllDone\('(.*)','(\d{4}-\d\d-\d\d)'\)$/.exec(b.getAttribute('onclick') || ''); if (!mm) return;
    var grp = mm[1].replace(/\\'/g, "'"), iso = mm[2];
    var rows = hwsDayRows(iso, grp).filter(function(r){ return r.s === 'sub'; }); if (!rows.length) return;
    var size = (students || []).filter(function(st){ return st && !st.withdrawn && hwsGridGroup(st) === grp; }).length;
    var left = rows.filter(function(r){ return !hwcOf(r.st, iso); }).length;
    b.insertAdjacentHTML('afterend', '<button class="hws-chip" data-n="' + rows.length + '" data-m="' + size + '" onclick="hwsAcceptSub(\'' + hwsEsc(hwsQ(grp)) + '\',\'' + iso + '\')"'
      + ' title="' + hwsEsc(grp + ' 반 ' + hwsMD(iso) + ' — 제출한 학생 ' + rows.length + '명 / 반 ' + size + '명 · 누르면 제출한 학생만 학생 값 그대로 ✓ (아직 안 찍은 ' + left + '명 · 이미 찍은 칸은 건너뜁니다)') + '"'
      + ' style="display:block;margin:2px auto 0;border:1.5px solid #16a34a;background:' + (left ? '#16a34a' : '#f0fdf4') + ';color:' + (left ? '#fff' : '#15803d') + ';border-radius:999px;padding:1px ' + (cm ? 7 : 4) + 'px;font-size:' + (cm ? 12 : 10) + 'px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;line-height:1.3">🙋 ' + rows.length + '/' + size + '</button>');
  });
  /* ③ 맨 위 띠 */
  var wrap = tp.content.querySelector('#hwc-wrap');
  if (wrap) wrap.insertAdjacentHTML('afterbegin', hwsBarHtml(cm ? HWC_CM : null));
  return tp.innerHTML;
}
function hwsBarHtml(grp){
  var iso = hwsBarDate(grp), rows = hwsDayRows(iso, grp);
  var nSub = 0, nDraft = 0, nNone = 0, left = 0;
  rows.forEach(function(r){ if (r.s === 'sub') { nSub++; if (!hwcOf(r.st, iso)) left++; } else if (r.s === 'draft') nDraft++; else nNone++; });
  var chip = 'border-radius:999px;padding:3px 11px;white-space:nowrap;';
  var h = '<div id="hws-bar" data-iso="' + iso + '" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:900;color:#14532d;background:#dcfce7;border:2px solid #86efac;border-radius:12px;padding:8px 12px;margin-bottom:10px;position:sticky;left:0">';
  h += '<span style="white-space:nowrap">🙋 학생 체크 · ' + hwsMD(iso) + '(' + hwsDowTxt(iso) + ')' + (grp ? ' · ' + hwsEsc(grp) : '') + '</span>';
  h += '<span class="hws-n-sub" data-n="' + nSub + '" style="' + chip + 'background:#16a34a;color:#fff">🙋 제출 ' + nSub + '명</span>';
  h += '<span class="hws-n-draft" data-n="' + nDraft + '" style="' + chip + 'background:#fff;color:#15803d;border:1.5px solid #16a34a">✎ 작성 중 ' + nDraft + '명</span>';
  h += '<span class="hws-n-none" data-n="' + nNone + '" style="' + chip + 'background:#f1f5f9;color:#64748b">안 함 ' + nNone + '명</span>';
  h += '<button id="hws-acc-all" onclick="hwsAcceptSub(' + (grp ? '\'' + hwsEsc(hwsQ(grp)) + '\'' : 'null') + ',\'' + iso + '\')" style="border:none;border-radius:10px;padding:7px 13px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit;'
    + (left ? 'background:#15803d;color:#fff;box-shadow:0 2px 6px rgba(21,128,61,.3)' : 'background:#fff;color:#94a3b8;border:1px solid #bbf7d0') + '">제출한 학생 전부 학생 값으로 ✓'
    + '<span style="font-size:10.5px;font-weight:700;opacity:.8"> (' + (left ? '아직 안 찍은 ' + left + '명' : (nSub ? '모두 찍음' : '제출 없음')) + ')</span></button>';
  h += '<span style="margin-left:auto;font-size:10.5px;font-weight:700;color:#475569;white-space:nowrap">칸 아래 <b style="color:#fff;background:#16a34a;border-radius:999px;padding:0 4px">🙋63</b> 제출 · <b style="color:#15803d;border:1px solid #16a34a;border-radius:999px;padding:0 4px">✎63</b> 작성 중 (숫자 = 학생 종합 %) · 알약 누르면 학생 값</span>';
  h += '<span style="font-size:10px;font-weight:700;color:#64748b;white-space:nowrap">' + (HWSF.busy && !HWSF.loaded ? '🔄 학생 체크 읽는 중…' : (HWSF.err ? '⚠️ ' + hwsEsc(HWSF.err) : '30초마다 새로')) + '</span>';
  return h + '</div>';
}

/* ── 세부 창 학생 칸 — 크게 · 맨 위 (v19-173 의 hwcPopHtml 감싸기가 이 이름을 부른다) ── */
function hwsBoxCol(x){
  if (x == null || x === 'na') return ['#f1f5f9', '#94a3b8', '#e2e8f0'];
  var n = Number(x) || 0;
  return n >= 100 ? ['#dcfce7', '#15803d', '#86efac'] : n >= 60 ? ['#f0fdf4', '#16a34a', '#bbf7d0'] : n >= 30 ? ['#fefce8', '#a16207', '#fde68a'] : ['#fef2f2', '#dc2626', '#fecaca'];
}
function hwsPopSec(st, iso, cur){
  var code = st.lumen_rec_code ? String(st.lumen_rec_code) : ''; var v = code ? hwsOf(code, iso) : null;
  if (!code) return '<div class="hws-pop" data-hws="nocode" style="margin:4px 0 9px;border-radius:10px;padding:8px 10px;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:11px;font-weight:800;color:#94a3b8">🙋 학생앱 코드가 없는 학생 — 스스로 체크를 받을 수 없습니다</div>';
  if (!v) return '<div class="hws-pop" data-hws="none" style="margin:4px 0 9px;border-radius:10px;padding:9px 11px;border:1.5px dashed #cbd5e1;background:#f8fafc;font-size:12px;font-weight:800;color:#64748b">🙋 학생이 아직 체크하지 않았어요</div>';
  var key = st.id + '|' + iso, armed = (HWSF.arm === key), sub = !!v.sub;
  var h = '<div class="hws-pop" data-hws="' + (sub ? 'sub' : 'draft') + '" style="margin:4px 0 10px;border-radius:12px;padding:10px 11px;border:2px solid ' + (sub ? '#16a34a' : '#fdba74') + ';background:' + (sub ? '#f0fdf4' : '#fffbeb') + '">';
  h += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:900;color:#14532d;margin-bottom:7px">🙋 학생 스스로'
    + '<span style="margin-left:auto;font-size:11px;font-weight:800;color:#475569">학생 종합 <b style="font-size:15px;color:#15803d">' + hwsTot(v) + '%</b></span></div>';
  h += '<div class="hws-boxes" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
  HWSF_STEP.forEach(function(s){
    var x = v[s[0]], c = hwsBoxCol(x);
    h += '<div class="hws-box hws-box-' + s[0] + '" style="border-radius:9px;padding:5px 2px;text-align:center;background:' + c[0] + ';border:1.5px solid ' + c[2] + '">'
      + '<div style="font-size:10px;font-weight:800;color:#64748b">' + s[1] + '</div>'
      + '<div style="font-size:16px;font-weight:900;color:' + c[1] + ';line-height:1.2">' + hwsVal(x, s[0] === 'a') + '</div></div>';
  });
  h += '</div>';
  h += sub
    ? '<div class="hws-st" style="margin-top:7px;font-size:12px;font-weight:900;color:#15803d">📤 제출 ' + hwsHM(v.sub) + '</div>'
    : '<div class="hws-st" style="margin-top:7px;font-size:12px;font-weight:900;color:#c2410c">✎ 아직 제출 안 함' + (v.at ? ' · ' + hwsHM(v.at) + ' 작성' : '') + '</div>';
  var hw = hwsToHw(v), same = cur && cur.p === hw.p && cur.c === hw.c && cur.w === hw.w;
  h += '<button id="hws-acc-one" onclick="hwsAccept(\'' + hwsEsc(hwsQ(st.id)) + '\',\'' + iso + '\')" style="margin-top:7px;width:100%;border:none;border-radius:10px;padding:9px 6px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit;background:' + (armed ? '#b45309' : (same ? '#e2e8f0' : '#15803d')) + ';color:' + (same && !armed ? '#64748b' : '#fff') + '">'
    + (armed ? '⚠️ 한 번 더 누르면 학생 값으로 덮어씁니다 (풀이 ' + hw.p + ' · 채점 ' + hw.c + ' · 오답 ' + hw.w + ')'
       : (same ? '✓ 이미 학생 값과 같습니다' : '학생 값 그대로 ✓ 저장' + (cur ? '<span style="display:block;font-size:10.5px;opacity:.8;font-weight:700;margin-top:1px">(이미 찍은 칸 — 두 번 누르기)</span>' : '')))
    + '</button>';
  return h + '</div>';
}
/* v19-173 이 학생 칸을 「종합」 위(맨 아래)에 넣었다 → 제목 바로 다음으로 옮긴다(같은 칸을 옮기므로 두 번 나오지 않는다) */
if (typeof hwcPopHtml === 'function') hwcPopHtml = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (!h || h.indexOf('hws-pop') < 0) return h;
    var tp = document.createElement('template'); tp.innerHTML = h;
    var pop = tp.content.querySelector('#hwc-pop'), sec = tp.content.querySelector('.hws-pop');
    if (!pop || !sec) return h;
    var title = pop.firstElementChild;
    if (title && title !== sec && title.nextElementSibling !== sec) title.insertAdjacentElement('afterend', sec);
    return tp.innerHTML;
  } catch(e){ try { console.error('[학생 체크 창 옮기기]', e); } catch(_){} }
  return h;
}; })(hwcPopHtml);

/* ── 제출한 학생만 학생 값 그대로 ✓ — grp 가 없으면 그 날짜 전체(띠 단추), 있으면 그 반(반 머리 칩) · 이미 찍은 칸은 건너뜀 ── */
window.hwsAcceptSub = function(grp, iso){
  var rows = hwsDayRows(iso, grp || null).filter(function(r){ return r.s === 'sub'; });
  var snaps = [], n = 0, skip = 0, md = hwsMD(iso), head = (grp ? grp + ' 반 ' : '') + md;
  rows.forEach(function(r){
    if (hwcOf(r.st, iso)) { skip++; return; }
    snaps.push(hwcSnap(r.st, iso));
    hwcSave(r.st, iso, hwsToHw(r.v)); n++;
  });
  if (snaps.length) hwcMark(snaps, head + ' 제출 학생값');
  HWSF.arm = ''; HWC.pop = null;
  if (!rows.length) plToast(head + ' — 제출한 학생이 없습니다');
  else plToast('✓ ' + head + ' — ' + n + '명 적음 · 이미 찍은 ' + skip + '명 건너뜀');
  render();
};

/* ── 모양 ── */
(function(){
  var st = document.createElement('style'); st.id = 'hws176-css';
  st.textContent = '.hws-pill:hover{filter:brightness(1.08);box-shadow:0 1px 4px rgba(22,163,74,.35)}.hws-chip:hover{filter:brightness(1.08)}#hws-acc-all:hover{filter:brightness(1.06)}';
  (document.head || document.documentElement).appendChild(st);
})();
