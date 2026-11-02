/* ═══════════════════════════════════════════════════════════════════
 * v19-172: 🎯 학교별 시험 D-day — 홈 맨 위 카드 + 맨 위 탭 바로 아래 얇은 한 줄(어느 화면에서나) (원장 2026-11-02
 *   「홈화면 상단에 학교별 디데이카드로 우선적으로 보이게 하자. 그리고 맨위의 탭 밑에 얇은 한줄로도 항상 보이게 하고 누르면 연결」)
 *  자료: 학원 달력(v19-46)과 같은 것 — ctExams()(나이스 시험 기간 + 시험대비 트랙에 손으로 적은 디데이) · ctLoad() · 학교 색 ctColor
 *        «우리 학생이 있는 학교»만, 학교·학년 묶음마다 다가오는 시험 하나(학원 달력 카드와 같은 규칙).
 *  누르면: 학원 달력(VIEW 'cal')으로 가서 그 학교만 걸러 보여 준다.
 *  ※ 새 서버 키 없음 · 저장 없음. 학원 달력 자료를 한 번 읽어 두고(ctLoad) 그리기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var DDS = { kicked: false };
/* 학교·학년 묶음마다 다가오는(또는 진행 중인) 시험 하나 — 학원 달력 카드와 같은 규칙 */
function ddsNext(){
  if (typeof ctExams !== 'function' || typeof CT === 'undefined' || !CT.loaded) return [];
  var today = ctTodayStr(), next = {};
  ctExams().forEach(function(e){ var k = e.school + (e.grades ? e.grades.join(',') : ''); if (e.to >= today && !next[k]) next[k] = e; });
  return Object.keys(next).map(function(k){ var e = next[k]; return { key: k, e: e, dn: ctDiff(today, e.from), on: today >= e.from && today <= e.to }; })
    .sort(function(a, b){ return a.e.from < b.e.from ? -1 : 1; });
}
function ddsLabel(x){ return x.on ? '시험 중' : (x.dn === 0 ? 'D-DAY' : 'D-' + x.dn); }
function ddsKick(){
  if (DDS.kicked) return; DDS.kicked = true;
  try { if (typeof CT !== 'undefined' && !CT.loaded && typeof ctLoad === 'function') ctLoad(); } catch(e){}   /* ctLoad 가 끝나면 render() → 띠·카드가 그려진다 */
}
window.ddsGo = function(school){
  try { if (typeof CT !== 'undefined'){ CT.filter = school || ''; CT.edit = null; } } catch(e){}
  VIEW = 'cal'; render();
  try { var c = document.getElementById('CONTENT'); if (c) c.scrollTop = 0; } catch(e){}
};
/* ── 맨 위 탭 바로 아래 얇은 한 줄 ── */
function ddsStripPaint(){
  var el = document.getElementById('DDAY_STRIP'); if (!el) return;
  ddsKick();
  var L = ddsNext();
  if (!L.length){ el.style.display = 'none'; el.innerHTML = ''; return; }
  var h = '<span class="dds-lead" onclick="ddsGo(\'\')" title="학원 달력 열기">🎯 시험</span>';
  L.forEach(function(x){
    var c = ctColor(x.e.school), hot = x.on || x.dn <= 14;
    h += '<button class="dds-chip' + (hot ? ' hot' : '') + '" style="--c:' + c + '" onclick="ddsGo(\'' + ctEsc(x.e.school) + '\')" title="' + ctEsc(x.key + ' ' + x.e.label + ' ' + ctMd(x.e.from) + (x.e.to !== x.e.from ? '~' + ctMd(x.e.to) : '')) + ' — 누르면 학원 달력">'
      + '<i></i>' + ctEsc(x.key) + ' <b>' + ddsLabel(x) + '</b><span>' + ctMd(x.e.from) + '</span></button>';
  });
  el.innerHTML = h; el.style.display = 'flex';
}
/* ── 홈 맨 위 카드 ── */
function ddsHomeCards(){
  ddsKick();
  var L = ddsNext();
  if (!L.length){
    if (typeof CT !== 'undefined' && !CT.loaded) return '<div class="dds-home"><div class="dds-empty">🎯 학교 시험 D-day 불러오는 중…</div></div>';
    return '';
  }
  var h = '<div class="dds-home"><div class="dds-hd"><b>🎯 학교별 시험 D-day</b><span>우리 학생이 다니는 학교 · 누르면 학원 달력</span></div><div class="dds-grid">';
  L.forEach(function(x){
    var c = ctColor(x.e.school), hot = x.on || x.dn <= 14;
    h += '<div class="dds-card' + (hot ? ' hot' : '') + '" style="--c:' + c + '" onclick="ddsGo(\'' + ctEsc(x.e.school) + '\')">'
      + '<div class="dds-k">' + ctEsc(x.key) + (x.e.n ? ' <small>' + x.e.n + '명</small>' : '') + '</div>'
      + '<div class="dds-d">' + ddsLabel(x) + '</div>'
      + '<div class="dds-l">' + ctEsc(x.e.label) + '</div>'
      + '<div class="dds-t">' + ctMd(x.e.from) + (x.e.to !== x.e.from ? ' ~ ' + ctMd(x.e.to) : '') + '</div></div>';
  });
  return h + '</div></div>';
}
(function(){
  /* 모양 */
  try {
    var st = document.createElement('style');
    st.textContent = '#DDAY_STRIP{display:none;align-items:center;gap:6px;padding:4px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;flex-shrink:0;overflow-x:auto;white-space:nowrap;min-height:30px}'
      + '#DDAY_STRIP .dds-lead{font-size:11.5px;font-weight:900;color:#0d2240;cursor:pointer;margin-right:2px}'
      + '#DDAY_STRIP .dds-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:2px 10px;font:inherit;font-size:11.5px;font-weight:800;color:#334155;cursor:pointer;flex-shrink:0}'
      + '#DDAY_STRIP .dds-chip i{width:8px;height:8px;border-radius:50%;background:var(--c)}'
      + '#DDAY_STRIP .dds-chip b{color:var(--c);font-weight:900}#DDAY_STRIP .dds-chip span{color:#94a3b8;font-weight:700;font-size:10.5px}'
      + '#DDAY_STRIP .dds-chip.hot{border-color:var(--c);background:color-mix(in srgb,var(--c) 8%,#fff)}'
      + '.dds-home{margin-bottom:18px}.dds-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.dds-hd b{font-size:15px;color:#0d2240}.dds-hd span{font-size:11.5px;color:#94a3b8;font-weight:700}'
      + '.dds-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}'
      + '.dds-card{background:#fff;border:1px solid #e6eaf1;border-top:6px solid var(--c);border-radius:14px;padding:11px 14px;cursor:pointer;box-shadow:0 2px 8px rgba(13,34,64,0.05)}'
      + '.dds-card:hover{box-shadow:0 4px 14px rgba(13,34,64,0.12)}.dds-card.hot{background:color-mix(in srgb,var(--c) 6%,#fff)}'
      + '.dds-k{font-size:13.5px;font-weight:900;color:#0d2240}.dds-k small{font-size:11px;color:#94a3b8;font-weight:700}'
      + '.dds-d{font-size:32px;font-weight:900;line-height:1.05;color:var(--c);letter-spacing:-.03em;margin:3px 0}'
      + '.dds-l{font-size:12px;font-weight:800;color:#0d2240}.dds-t{font-size:11px;color:#64748b;font-weight:700}'
      + '.dds-empty{font-size:12px;color:#94a3b8;font-weight:700;padding:6px 0}';
    document.head.appendChild(st);
  } catch(e){}
  /* 띠: 그릴 때마다(paintNav) 같이 */
  try { if (typeof paintNav === 'function'){ var _pn = paintNav; paintNav = function(){ _pn.apply(this, arguments); try { ddsStripPaint(); } catch(e){} }; } } catch(e){}
  /* 홈: 맨 위(헤더보다 먼저)에 카드 */
  try { if (typeof rHome === 'function'){ var _rh = rHome; rHome = function(){ var h = _rh.apply(this, arguments); var c = ddsHomeCards(); if (!c) return h;
    var tag = '<div class="hm3main">'; return h.indexOf(tag) >= 0 ? h.replace(tag, tag + c) : c + h; }; window.rHome = rHome; } } catch(e){}
})();
