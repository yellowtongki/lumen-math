/* ═══════════════════════════════════════════════════════════════════
 * v19-173: 🟢 학생 스스로 숙제 체크(hw_self_<코드>) 를 숙제체크 화면에 — 최소판 (docs/hw_dispatch_contract.md §9-3)
 *  · 학생앱이 날짜(=확인받는 수업일) 단위로 누르는 키 hw_self_<코드> = { byDate:{ 'YYYY-MM-DD':{p,c,w,a(0|100),at} }, upd }.
 *    학원앱은 «읽기만» 한다 — 숙제체크 화면을 열 때 + 30초마다 활동 학생 전원의 키를 in('key',[…]) 로 한 번에 읽어 HWSF.by[코드] 에 둔다.
 *    기기에 저장하지 않는다(PULL_SKIP_PREFIX 에 'hw_self_'). 묻는 중이면 또 묻지 않는다(30초 캐시).
 *  · 그리드 칸마다 학생 값을 작은 점 4개(풀이·채점·오답·아하)로 미리 보여 준다 — 100 초록 · 0 회색 · 안 누름 빈 점선.
 *    수업 모드(아이패드) 칸에도 같은 점(조금 크게). 칸에 마우스를 올리면 「학생 스스로: …」 줄이 설명에 붙는다.
 *  · 세부 창(hwcPopHtml)에 「🟢 학생 스스로 풀이 ✓ 채점 ✓ 오답 ○ 아하 — · 18:40」 줄 + 「학생 체크 그대로 ✓」 단추.
 *    아직 안 찍은 칸(빈 칸)도 마우스 오른쪽 클릭이면 작은 창이 열린다(학생 값 보기 · 그대로 적기 · 전부 100%).
 *  · 「학생 체크 그대로 ✓」: 칸 하나(세부 창) / 반 전부(반 머리 「한 번에」 줄의 👩‍🎓✓, 날짜마다)
 *    → lumen_hw[날짜]={p,c,w} 를 hwcSave 길 그대로 적는다(lumen_hw_at·리포트 경고등·되돌리기 그대로). 아하(a)는 안 적는다 — 자동 계산.
 *    이미 선생님이 찍은 칸: 반 전부는 그 칸만 건너뛰고, 세부 창은 단추를 «두 번» 눌러야 덮어쓴다(confirm 창 없음).
 *  · v19-171 카드 2차 확인 줄의 「학생 셀프」 4칸: 카드 단위 체크(todo_st_…hw)가 있으면 그것, 없으면 그 카드 마감 날짜의 hw_self 값.
 *  · calcXP +5: v19-171 이 카드 단위로 세던 것을 날짜 단위와 합쳐 센다 — 같은 날짜·같은 단계는 한 번만. 계산 때 서버를 묻지 않는다(읽어 둔 값만).
 *    xp_board 게시(lvPublishAll) 가 돌 때만 먼저 한 번 읽어 둔다(30초 캐시) — 숙제체크를 안 열어도 학생 레벨에 +5 가 들어가게.
 *  ※ 바탕 코드는 고치지 않고 감싼다. 문자열 연결로만 HTML 을 만든다. 같은 이름 함수는 대입으로 바꾼다(hwlSelfHw · hwlSelfXP).
 * ═══════════════════════════════════════════════════════════════════ */
var HWSF = { by: {}, at: 0, busy: false, loaded: false, err: '', arm: '', p: null, nq: 0 };
try { if (typeof HWS === 'object' && HWS) HWS.by = HWSF.by; } catch(e){}   /* 설계 메모의 이름(HWS.by) 로도 닿게 — 같은 객체 */
try { if (typeof PULL_SKIP_PREFIX !== 'undefined' && PULL_SKIP_PREFIX.indexOf('hw_self_') < 0) PULL_SKIP_PREFIX.push('hw_self_'); } catch(e){}
var HWSF_STEP = [['p', '풀이'], ['c', '채점'], ['w', '오답'], ['a', '아하']];
var HWSF_TTL = 30000;

function hwsEsc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function hwsQ(s){ return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function hwsMD(iso){ return iso ? String(iso).slice(5).replace(/^0/, '').replace('-', '/').replace('/0', '/') : ''; }
function hwsHM(at){ if (!at) return ''; var d = new Date(at); if (isNaN(d.getTime())) return ''; d = new Date(d.getTime() + 9 * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
function hwsCodes(){ return (typeof tdActive === 'function' ? tdActive() : []).map(function(s){ return String(s.lumen_rec_code); }); }

/* ── 읽기 — 활동 학생 전원의 hw_self_* 를 한 번에 (30초 캐시 · 묻는 중이면 또 묻지 않는다) ── */
function hwsLoad(force){
  if (HWSF.busy) return HWSF.p || Promise.resolve();
  if (!force && HWSF.at && Date.now() - HWSF.at < HWSF_TTL) return Promise.resolve();
  var codes = hwsCodes();
  if (!codes.length) { HWSF.at = Date.now(); HWSF.loaded = true; return Promise.resolve(); }
  var sb = null; try { sb = getSupaClient(); } catch(e){ sb = null; }
  if (!sb) { HWSF.err = '오프라인'; HWSF.at = Date.now(); HWSF.loaded = true; return Promise.resolve(); }
  HWSF.busy = true;
  var chunks = []; for (var i = 0; i < codes.length; i += 80) chunks.push(codes.slice(i, i + 80));
  HWSF.nq += chunks.length;
  HWSF.p = Promise.all(chunks.map(function(ch){ return sb.from('lumen_store').select('key,value').in('key', ch.map(function(c){ return 'hw_self_' + c; })); })).then(function(rs){
    var fresh = {};
    rs.forEach(function(r){
      if (r && r.error) throw r.error;
      ((r && r.data) || []).forEach(function(row){
        var m = /^hw_self_(.+)$/.exec(String(row.key || '')); if (!m) return;
        var v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e){ v = null; } }
        if (v && typeof v === 'object' && v.byDate && typeof v.byDate === 'object') fresh[m[1]] = v;
      });
    });
    Object.keys(HWSF.by).forEach(function(k){ if (!fresh[k]) delete HWSF.by[k]; });   /* 같은 객체를 제자리에서 바꾼다(HWS.by 도 같이) */
    Object.keys(fresh).forEach(function(k){ HWSF.by[k] = fresh[k]; });
    HWSF.at = Date.now(); HWSF.busy = false; HWSF.loaded = true; HWSF.err = '';
    try { if (VIEW === 'hwcheck') render(); } catch(e){}
  }).catch(function(e){
    HWSF.busy = false; HWSF.at = Date.now(); HWSF.loaded = true; HWSF.err = '읽지 못했습니다: ' + ((e && e.message) || e);
    try { if (VIEW === 'hwcheck') render(); } catch(e2){}
  });
  return HWSF.p;
}
/* 화면이 열려 있는 동안 30초마다 — 다른 화면이면 묻지 않는다 */
setInterval(function(){ try { if (VIEW === 'hwcheck' && !document.hidden) hwsLoad(false); } catch(e){} }, HWSF_TTL);

/* ── 값 읽기 ── */
function hwsOf(code, iso){
  if (typeof HWSF === 'undefined' || !HWSF || !code || !iso) return null;
  var b = HWSF.by[String(code)]; var d = b && b.byDate && b.byDate[iso];
  if (!d || typeof d !== 'object') return null;
  var out = { at: d.at || '' }, any = false;
  HWSF_STEP.forEach(function(s){ var k = s[0]; if (d[k] == null || d[k] === '') { out[k] = null; return; } out[k] = Number(d[k]) >= 100 ? 100 : 0; any = true; });
  return any ? out : null;
}
function hwsToHw(v){ return { p: v && v.p >= 100 ? 100 : 0, c: v && v.c >= 100 ? 100 : 0, w: v && v.w >= 100 ? 100 : 0 }; }
function hwsMark(x){ return x == null ? '—' : (x >= 100 ? '✓' : '○'); }
function hwsLine(v){ if (!v) return '아직 안 눌렀어요'; return HWSF_STEP.map(function(s){ return s[1] + ' ' + hwsMark(v[s[0]]); }).join(' · ') + (v.at ? ' · ' + hwsHM(v.at) : ''); }
/* 작은 점 4개 — 100 초록 · 0 회색 · 안 누름 빈 점선 */
function hwsDots(v, big){
  var sz = big ? 6 : 4, h = '<span class="hws-dots" data-hws="' + (v ? 'y' : 'n') + '" style="display:flex;gap:' + (big ? 3 : 2) + 'px;justify-content:center;pointer-events:none;margin-top:1px;line-height:0">';
  HWSF_STEP.forEach(function(s){
    var x = v ? v[s[0]] : null;
    var sty = 'display:block;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;box-sizing:border-box;';
    sty += (x == null) ? 'background:transparent;border:1px dashed #cbd5e1' : (x >= 100 ? 'background:#16a34a' : 'background:#cbd5e1');
    h += '<i class="hws-d-' + s[0] + '" style="' + sty + '"></i>';
  });
  return h + '</span>';
}
function hwsStuById(stId){ return (students || []).filter(function(x){ return x && x.id === stId; })[0] || null; }
/* 그 반(반 이름 · 미배정) 학생 중 그 날짜에 스스로 누른 사람 — 그리드가 반을 묶는 규칙과 같게(반 목록에 없는 반은 「미배정」 머리 아래) */
function hwsGridGroup(st){
  var g = String(st.group || '').trim(); var gl = null; try { gl = (typeof groupList !== 'undefined' && Array.isArray(groupList)) ? groupList : null; } catch(e){}
  return (g && (!gl || gl.indexOf(g) >= 0)) ? g : '미배정';
}
function hwsClassRows(grp, iso){
  var out = [];
  (students || []).forEach(function(st){
    if (!st || st.withdrawn) return;
    if (hwsGridGroup(st) !== grp) return;
    var code = st.lumen_rec_code ? String(st.lumen_rec_code) : ''; if (!code) return;
    var v = hwsOf(code, iso); if (!v) return;
    out.push({ st: st, code: code, v: v });
  });
  return out;
}

/* ── 숙제체크 화면에 얹기 — 그린 HTML 을 DOM 으로 읽어 칸·반 머리에 덧붙인다(바탕 함수는 그대로) ── */
function hwsDecorate(h, cm){
  var tp = document.createElement('template'); tp.innerHTML = h;
  var byId = {}; (students || []).forEach(function(s){ if (s && s.id) byId[s.id] = s; });
  var cells = tp.content.querySelectorAll('[id^="hwc-c-"]'); var nDot = 0;
  Array.prototype.forEach.call(cells, function(el){
    var m = /^hwc-c-(.+)-(\d{4}-\d\d-\d\d)$/.exec(el.id); if (!m) return;
    var st = byId[m[1]]; var code = st && st.lumen_rec_code ? String(st.lumen_rec_code) : ''; if (!code) return;
    var iso = m[2], v = hwsOf(code, iso);
    el.insertAdjacentHTML('beforeend', hwsDots(v, !!cm)); nDot++;
    if (v) el.setAttribute('title', (el.getAttribute('title') || '') + '\n  🟢 학생 스스로: ' + hwsLine(v));
    if (!el.hasAttribute('oncontextmenu')) el.setAttribute('oncontextmenu', "event.preventDefault();hwcOpenPop('" + hwsQ(st.id) + "','" + iso + "')");
  });
  /* 반 머리 「한 번에」 줄 — 날짜마다 👩‍🎓✓ (그 반에 스스로 누른 학생이 있을 때만) */
  var btns = tp.content.querySelectorAll('button[onclick^="hwcAllDone("]');
  Array.prototype.forEach.call(btns, function(b){
    var mm = /^hwcAllDone\('(.*)','(\d{4}-\d\d-\d\d)'\)$/.exec(b.getAttribute('onclick') || ''); if (!mm) return;
    var grp = mm[1].replace(/\\'/g, "'"), iso = mm[2];
    var rows = hwsClassRows(grp, iso); if (!rows.length) return;
    var left = rows.filter(function(r){ return !hwcOf(r.st, iso); }).length;
    b.insertAdjacentHTML('afterend', '<button class="hws-acc" onclick="hwsAcceptClass(\'' + hwsEsc(hwsQ(grp)) + '\',\'' + iso + '\')" title="' + hwsEsc(grp + ' 반 ' + hwsMD(iso) + ' — 학생이 스스로 체크한 값 그대로 적기 (' + rows.length + '명 중 아직 안 찍은 ' + left + '명 · 이미 찍은 칸은 건너뜁니다)') + '" style="border:1px solid #bbf7d0;background:' + (left ? '#f0fdf4' : '#fff') + ';border-radius:6px;padding:2px 3px;font-size:9px;font-weight:900;color:#15803d;cursor:pointer;font-family:inherit;white-space:nowrap;margin-left:2px;' + (left ? '' : 'opacity:.45') + '">🟢' + rows.length + '</button>');
  });
  /* 머리 안내 줄 */
  var wrap = tp.content.querySelector('#hwc-wrap');
  if (wrap) {
    var nStu = Object.keys(HWSF.by).length;
    var info = '<div id="hws-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;font-weight:800;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:5px 10px;margin-bottom:8px">'
      + '<span>🟢 칸 아래 <b>작은 점 4개</b> = 학생이 스스로 체크한 풀이·채점·오답·아하 (초록 = 했음 · 회색 = 안 함 · 점선 = 안 누름)</span>'
      + '<span style="color:#475569">· 반 머리 「한 번에」 줄의 <b style="color:#15803d">🟢n</b> = 그 반 학생 값 그대로 적기 · 칸 오른쪽 클릭 = 학생 값 보고 그대로 적기</span>'
      + '<span style="margin-left:auto;color:#64748b">' + (HWSF.busy && !HWSF.loaded ? '🔄 학생 체크 읽는 중…' : (HWSF.err ? '⚠️ ' + hwsEsc(HWSF.err) : '학생 ' + nStu + '명 체크 읽음 · 30초마다 새로')) + '</span></div>';
    wrap.insertAdjacentHTML('afterbegin', info);
  }
  return tp.innerHTML;
}
if (typeof rHwCheck === 'function') rHwCheck = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    hwsLoad(false);
    if (HWC_CM || HWC_VIEW === 'grid') h = hwsDecorate(h, !!HWC_CM);
  } catch(e){ try { console.error('[학생 스스로 체크]', e); } catch(_){} }
  return h;
}; })(rHwCheck);

/* ── 세부 창 — 「🟢 학생 스스로 …」 줄 + 「학생 체크 그대로 ✓」 ── */
function hwsPopSec(st, iso, cur){
  var code = st.lumen_rec_code ? String(st.lumen_rec_code) : ''; var v = code ? hwsOf(code, iso) : null;
  var key = st.id + '|' + iso, armed = (HWSF.arm === key);
  var h = '<div class="hws-pop" style="margin-top:8px;border-radius:10px;padding:8px 10px;border:1.5px solid ' + (v ? '#bbf7d0' : '#e2e8f0') + ';background:' + (v ? '#f0fdf4' : '#f8fafc') + '">';
  h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;font-weight:900;color:' + (v ? '#15803d' : '#94a3b8') + '">🟢 학생 스스로' + (v ? hwsDots(v, true) : '') + '<span style="font-weight:800;color:' + (v ? '#166534' : '#94a3b8') + '">' + hwsEsc(hwsLine(v)) + '</span></div>';
  if (!code) h += '<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-top:3px">학생앱 코드가 없는 학생 — 스스로 체크를 받을 수 없습니다</div>';
  else if (v) {
    var hw = hwsToHw(v), same = cur && cur.p === hw.p && cur.c === hw.c && cur.w === hw.w;
    h += '<button id="hws-acc-one" onclick="hwsAccept(\'' + hwsQ(st.id) + '\',\'' + iso + '\')" style="margin-top:6px;width:100%;border:none;border-radius:9px;padding:7px 6px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit;background:' + (armed ? '#b45309' : (same ? '#e2e8f0' : '#15803d')) + ';color:' + (same && !armed ? '#64748b' : '#fff') + '">'
      + (armed ? '⚠️ 한 번 더 누르면 학생 값으로 덮어씁니다 (풀이 ' + hw.p + ' · 채점 ' + hw.c + ' · 오답 ' + hw.w + ')' : (same ? '✓ 이미 학생 값과 같습니다' : '학생 체크 그대로 ✓' + (cur ? ' <span style="opacity:.75;font-weight:700">(이미 찍은 칸 — 두 번 누르기)</span>' : '')))
      + '</button>';
  }
  return h + '</div>';
}
if (typeof hwcPopHtml === 'function') hwcPopHtml = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (!HWC.pop) return h;
    var parts = String(HWC.pop).split('|'), stId = parts[0], iso = parts[1];
    var st = hwsStuById(stId); if (!st || !iso) return h;
    var cur = hwcOf(st, iso);
    if (h) {
      var sec = hwsPopSec(st, iso, cur);
      var mk = '<div style="margin-top:9px;background:#0d2240;color:#fff;border-radius:10px;padding:9px 12px;display:flex;align-items:center;font-size:12px;font-weight:800">종합';
      var i = h.indexOf(mk);
      if (i >= 0) h = h.slice(0, i) + sec + h.slice(i);
      else { var tail = '</div></div>'; h = (h.slice(-tail.length) === tail) ? (h.slice(0, -tail.length) + sec + tail) : (h + sec); }
      return h;
    }
    /* 아직 안 찍은 칸(빈 칸) — 작은 창: 학생 값 보기 · 그대로 적기 · 전부 100% */
    if (cur) return h;
    var md = hwsMD(iso);
    var m = '<div id="hwc-pop" class="hws-mini" style="position:absolute;z-index:40;background:#fff;border:2px solid #15803d;border-radius:14px;box-shadow:0 12px 34px rgba(13,34,64,0.24);padding:13px 14px;width:318px;left:0;top:0;visibility:hidden" onclick="event.stopPropagation()">';
    m += '<div style="font-size:12.5px;font-weight:900;color:#0d2240;margin-bottom:2px">' + hwsEsc(st.name) + ' · ' + md + ' 숙제 <span style="font-size:10px;color:#94a3b8;font-weight:700">아직 선생님이 안 찍은 칸</span></div>';
    m += hwsPopSec(st, iso, null);
    m += '<div style="display:flex;gap:6px;margin-top:8px">';
    m += '<button onclick="hwcTap(\'' + hwsQ(stId) + '\',\'' + iso + '\')" style="flex:1;border:none;border-radius:9px;padding:8px 4px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit;background:#dbeafe;color:#1d4ed8">🟢 전부 100%</button>';
    m += '<button onclick="hwcClosePop()" style="flex:1;border:none;border-radius:9px;padding:8px 4px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit;background:#f1f5f9;color:#475569">닫기</button>';
    return m + '</div></div>';
  } catch(e){ try { console.error('[학생 스스로 체크 창]', e); } catch(_){} }
  return h;
}; })(hwcPopHtml);

/* ── 「학생 체크 그대로 ✓」 — 칸 하나 (이미 찍은 칸은 두 번 누르기) ── */
window.hwsAccept = function(stId, iso){
  var st = hwsStuById(stId); if (!st) return;
  var code = st.lumen_rec_code ? String(st.lumen_rec_code) : ''; var v = code ? hwsOf(code, iso) : null;
  if (!v) { plToast('학생이 아직 스스로 체크하지 않았습니다'); return; }
  var cur = hwcOf(st, iso), hw = hwsToHw(v), key = stId + '|' + iso, md = hwsMD(iso);
  if (cur && cur.p === hw.p && cur.c === hw.c && cur.w === hw.w) { HWSF.arm = ''; plToast('이미 학생 값과 같습니다'); return; }
  if (cur && HWSF.arm !== key) { HWSF.arm = key; plToast('이미 찍힌 칸입니다 — 단추를 한 번 더 누르면 학생 값으로 덮어씁니다'); render(); return; }
  HWSF.arm = '';
  try { hwcMark([hwcSnap(st, iso)], st.name + ' ' + md + ' 학생값'); } catch(e){}
  hwcSave(st, iso, hw);
  HWC.pop = stId + '|' + iso;
  plToast('✓ ' + st.name + ' ' + md + ' — 학생 체크 그대로 (풀이 ' + hw.p + ' · 채점 ' + hw.c + ' · 오답 ' + hw.w + ')');
  render();
};
/* 반 전부 — 그 반·그 날짜에 스스로 누른 학생 모두. 이미 찍은 칸은 건너뛴다 */
window.hwsAcceptClass = function(grp, iso){
  var rows = hwsClassRows(grp, iso), snaps = [], n = 0, skip = 0, md = hwsMD(iso);
  rows.forEach(function(r){
    if (hwcOf(r.st, iso)) { skip++; return; }
    snaps.push(hwcSnap(r.st, iso));
    hwcSave(r.st, iso, hwsToHw(r.v)); n++;
  });
  if (snaps.length) hwcMark(snaps, grp + ' 학생값 ' + md);
  HWSF.arm = ''; HWC.pop = null;
  if (!rows.length) plToast(grp + ' 반 ' + md + ' — 스스로 체크한 학생이 없습니다');
  else plToast('✓ ' + grp + ' 반 ' + md + ' — ' + n + '명 학생 값 그대로 적음' + (skip ? ' · 이미 찍은 ' + skip + '명은 건너뜀' : ''));
  render();
};

/* ── v19-171 카드 2차 확인 줄의 「학생 셀프」 — 카드 단위가 없으면 그 카드 마감 날짜의 hw_self 값 ── */
if (typeof hwlSelfHw === 'function') hwlSelfHw = function(code, it){
  var s = ((typeof TD !== 'undefined' && TD.st) || {})[code]; s = s && it ? s[it.id] : null;
  if (s && s.hw && typeof s.hw === 'object') return s.hw;
  var v = (it && it.due) ? hwsOf(code, it.due) : null; if (!v) return null;
  return { p: v.p || 0, c: v.c || 0, w: v.w || 0, a: v.a || 0 };
};

/* ── XP — 날짜 단위(hw_self) + 카드 단위(todo_st_) 합쳐 단계 100 하나마다 +5 · 같은 날짜·단계는 한 번만 · 서버는 묻지 않는다 ── */
if (typeof hwlSelfXP === 'function') hwlSelfXP = function(code){
  var seen = {}, n = 0, m = 0, ym = (typeof hwlToday === 'function' ? hwlToday() : new Date().toISOString()).slice(0, 7);
  var hit = function(k, mon){ if (seen[k]) return; seen[k] = 1; n++; if (mon === ym) m++; };
  try {
    var items = ((typeof TD !== 'undefined' && TD.items) || {})[code] || [], dueOf = {};
    items.forEach(function(it){ if (it && it.id) dueOf[it.id] = it.due || ''; });
    var stm = ((typeof TD !== 'undefined' && TD.st) || {})[code] || {};
    Object.keys(stm).forEach(function(id){
      var s = stm[id]; if (!s || !s.hw || typeof s.hw !== 'object') return;
      ['p', 'c', 'w', 'a'].forEach(function(f){ if (Number(s.hw[f]) >= 100) hit((dueOf[id] || ('card:' + id)) + '|' + f, String(s.hat || s.at || '').slice(0, 7)); });
    });
  } catch(e){}
  try {
    var b = HWSF.by[String(code)]; var bd = (b && b.byDate) || {};
    Object.keys(bd).forEach(function(d){ var v = hwsOf(code, d); if (!v) return; ['p', 'c', 'w', 'a'].forEach(function(f){ if (v[f] >= 100) hit(d + '|' + f, d.slice(0, 7)); }); });
  } catch(e){}
  return { xp: n * 5, month: m * 5 };
};
/* xp_board 게시 전에 한 번 읽어 둔다(30초 캐시) — calcXP 자체는 읽어 둔 값만 쓴다 */
if (typeof lvPublishAll === 'function') (function(orig){
  window.lvPublishAll = function(force){
    var self = this, args = arguments, need = false;
    try { var last = Number(localStorage.getItem('lumen_xp_pub_at') || 0); need = !!force || (Date.now() - last >= 3600000); } catch(e){ need = !!force; }
    if (!need) return orig.apply(self, args);
    var p; try { p = hwsLoad(false); } catch(e){ p = null; }
    return Promise.resolve(p).catch(function(){}).then(function(){ return orig.apply(self, args); });
  };
})(lvPublishAll);

/* ── 모양 ── */
(function(){
  var st = document.createElement('style'); st.id = 'hws-css';
  st.textContent = '.hws-acc:hover{background:#dcfce7!important}.hws-pop button:hover{filter:brightness(1.05)}';
  (document.head || document.documentElement).appendChild(st);
})();
