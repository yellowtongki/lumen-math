/* ═══════════════════════════════════════════════════════════════════
 * v19-119: ⏰ 반 수업 시간 (lumen_store 키 lumen_group_times)
 * 원장 2026-10-13 「학원앱에서 각 클래스의 시간을 조정하는 기능이 있나? 없으면 만들자.」 · 「학생들이 학원시간을 수정할 수 있게 하자.」
 *
 *  [까닭] 주간계획 모아보기 · 큰 달력 · 학생앱 주간계획표 · 스터디 코디의 «루멘 수업» 칸은
 *         반 이름에서 시각을 짐작했다(T5 → 17:00 · T730 → 19:30 · M7 → 19:00, 늘 2시간, 수업 요일마다 같은 시각).
 *         실제는 요일마다 다르다(예: 화목 19:30 · 토 10:30 2시간 30분).
 *  [자료] lumen_group_times = { "<반>": { "<요일 0=일..6=토>": { "start":"HH:MM", "min":150 } } }
 *         수업 «요일»은 그대로 lumen_group_days. 시간이 없는 요일은 예전처럼 반 이름으로 짐작(「짐작」 표시).
 *         SYNC_KEYS 에 넣어 lumen_group_days 처럼 기기 ↔ 서버로 오간다(조립 때 build_app.py 가 넣는다) + 저장 단추는 서버에 바로 올린다.
 *  [학생이 고친 시간] 학생앱 v2-135 가 codi_fixed_<코드>.blocks 안에 { type:'lumen', own:true, days(월0~일6), start, end } 로 저장한다.
 *         있으면 반 시간 대신 그것을 그린다(학원앱 · 학생앱 모두) — 카드에 「✏️ 학생이 고친 학원 시간」.
 *  [화면] ① 운영 › ⚙️ 설정 › 👥 반(그룹) 관리 › 「⏰ 반 수업 시간」 ② 수업·출결 › 🗓 주간계획 모아보기 머리 「⏰ 반 수업 시간」
 *  ※ 바탕 코드는 고치지 않는다(pwcFixed 는 같은 이름으로 다시 정의 — 뒤 것이 쓰인다). 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var LGT = { open: false, base: null, draft: null, st: {}, cleared: {}, groups: [], busy: false, msg: '' };
var LGT_DOW = ['일', '월', '화', '수', '목', '금', '토'];
var LGT_ORDER = [1, 2, 3, 4, 5, 6, 0];   /* 월요일부터 */
var LGT_DUR = [[60, '1시간'], [90, '1시간 30분'], [120, '2시간'], [150, '2시간 30분'], [180, '3시간'], [210, '3시간 30분']];

function lgtHm(m){ m = Math.max(0, Math.min(24 * 60, Math.round(m))); var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
function lgtMin(t){ var p = String(t || '').split(':'); if (p.length < 2) return -1; return Number(p[0]) * 60 + Number(p[1]); }
function lgtEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
/* 반 이름으로 짐작 (예전 규칙 그대로): 숫자 1~2자리 = 시(9 미만은 오후), 3~4자리 = 시+분 · 숫자 없으면 17:00 · 2시간 */
function lgtGuess(g){
  var dg = (String(g || '').match(/(\d+)/) || [])[1] || '', h = 17, mi = '00';
  if (dg){ h = Number(dg.length >= 3 ? dg.slice(0, dg.length - 2) : dg); mi = dg.length >= 3 ? dg.slice(-2) : '00'; if (h < 9) h += 12; }
  return { start: lgtHm(h * 60 + Number(mi)), min: 120 };
}
function lgtOk(x){ return !!(x && /^\d{1,2}:\d{2}$/.test(String(x.start || '')) && Number(x.min) > 0); }
function lgtLocal(){ try { var v = JSON.parse(localStorage.getItem('lumen_group_times') || 'null'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch(e){ return {}; } }
/* 지금 쓰는 반 시간 — 서버에서 읽은 것(PWB.gt)이 있으면 그것, 없으면 이 기기 사본 */
window.lgtMap = function(){ return (typeof PWB !== 'undefined' && PWB.gt && typeof PWB.gt === 'object') ? PWB.gt : lgtLocal(); };
/* 한 반의 요일별 시간 { JS요일: { start, min, src:'set'|'guess' } } — 수업 요일(lumen_group_days)만 */
window.lgtPerDay = function(g, daysMap, timesMap){
  var gd = (daysMap || {})[g], out = {}; if (!Array.isArray(gd) || !gd.length) return out;
  var tm = (timesMap || {})[g] || {};
  gd.forEach(function(d){ d = Number(d); var x = tm[d] || tm[String(d)]; if (lgtOk(x)) out[d] = { start: x.start, min: Number(x.min), src: 'set' }; else { var q = lgtGuess(g); out[d] = { start: q.start, min: q.min, src: 'guess' }; } });
  return out;
};
/* 루멘 수업 칸 — 시작·끝이 같은 요일끼리 한 덩어리 (days = 월0~일6) */
window.lgtBlocks = function(g, daysMap, timesMap){
  var per = lgtPerDay(g, daysMap, timesMap), by = {}, keys = [];
  Object.keys(per).forEach(function(d){ var x = per[d], s = lgtMin(x.start), k = x.start + '|' + (s + x.min); if (!by[k]){ by[k] = { start: x.start, end: lgtHm(s + x.min), days: [], guess: false }; keys.push(k); } by[k].days.push((Number(d) + 6) % 7); if (x.src === 'guess') by[k].guess = true; });
  keys.sort();
  return keys.map(function(k, i){ var b = by[k]; b.days.sort(); return { id: i ? 'lumen_' + (i + 1) : 'lumen', label: '루멘', type: 'lumen', days: b.days, start: b.start, end: b.end, auto: true, guess: b.guess }; });
};
/* ★ 주간계획 모아보기 · 큰 달력 · 주간 점수의 고정 일정 (plscore_teacher.js 의 pwcFixed 를 바꾼다)
 *   학생이 고친 학원 시간(codi_fixed_ 안 type 'lumen')이 있으면 그것 · 없으면 반 시간(요일별) · 그것도 없으면 반 이름 짐작 */
function pwcFixed(st){
  var f = PWB.fx && PWB.fx[st.lumen_rec_code], base = (f && f.blocks) || PW.schoolBlocks(st.grade);
  var arr = base.filter(function(b){ return b && b.type !== 'lumen'; }).slice();
  var own = base.filter(function(b){ return b && b.type === 'lumen' && (b.days || []).length && lgtMin(b.end) > lgtMin(b.start); });
  var src = '';
  if (own.length){
    own.forEach(function(b){ arr.push({ id: b.id || 'lumen_me', label: '루멘', type: 'lumen', days: (b.days || []).slice(), start: b.start, end: b.end, own: true }); });
    src = 'own';
  } else {
    var lb = lgtBlocks(String(st.group || ''), PWB.days || {}, lgtMap());
    lb.forEach(function(b){ arr.push(b); });
    src = lb.length ? (lb.some(function(b){ return b.guess; }) ? 'guess' : 'set') : '';
  }
  return { list: arr, mine: !!f, lumen: src };
}

/* ── 설정 칸 한 줄 요약 (⚙️ 설정 › 반별 수업 요일 옆) ── */
window.lgtSummary = function(g){
  var per = lgtPerDay(g, (typeof groupDays !== 'undefined' ? groupDays : {}), lgtMap()), ds = LGT_ORDER.filter(function(d){ return per[d]; });
  if (!ds.length) return '';
  var guess = ds.some(function(d){ return per[d].src === 'guess'; });
  return '<span class="lgt-sum">' + ds.map(function(d){ var x = per[d]; return LGT_DOW[d] + ' ' + x.start + '~' + lgtHm(lgtMin(x.start) + x.min); }).join(' · ') + (guess ? ' <em>짐작</em>' : '') + '</span>';
};

/* ── ⏰ 반 수업 시간 창 ── */
function lgtAllGroups(){
  var gl = (typeof groupList !== 'undefined' && Array.isArray(groupList)) ? groupList.slice() : [];
  var gd = (typeof groupDays !== 'undefined') ? groupDays : {};
  Object.keys(gd).forEach(function(g){ if ((gd[g] || []).length && gl.indexOf(g) < 0) gl.push(g); });
  return gl.filter(function(g){ return g; });
}
function lgtDraftFrom(map){
  var gd = (typeof groupDays !== 'undefined') ? groupDays : {};
  LGT.groups = lgtAllGroups(); LGT.draft = {}; LGT.st = {};
  LGT.groups.forEach(function(g){
    var per = lgtPerDay(g, gd, map); LGT.draft[g] = {}; LGT.st[g] = {};
    Object.keys(per).forEach(function(d){ LGT.draft[g][d] = { start: per[d].start, min: per[d].min }; LGT.st[g][d] = per[d].src; });
  });
}
window.lgtOpen = async function(){
  LGT.open = true; LGT.cleared = {}; LGT.msg = ''; LGT.base = lgtMap();
  lgtDraftFrom(LGT.base); lgtShow();
  /* 서버 것을 새로 읽어 다른 기기에서 고친 것도 보이게 (고치기 전이면 바꿔 그린다) */
  try {
    var sb = (typeof getSupaClient === 'function') ? getSupaClient() : null; if (!sb) return;
    var r = await sb.from('lumen_store').select('value').eq('key', 'lumen_group_times');
    if (r && !r.error){
      var v = (r.data && r.data[0]) ? r.data[0].value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      v = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
      if (typeof PWB !== 'undefined') PWB.gt = v;
      LGT.base = v;
      if (LGT.open && !lgtDirty()){ lgtDraftFrom(v); lgtShow(); }
    }
  } catch(e){ try { console.warn('[반 수업 시간] 서버 읽기 실패', e); } catch(_){} }
};
function lgtDirty(){ var d = false; Object.keys(LGT.st).forEach(function(g){ Object.keys(LGT.st[g]).forEach(function(k){ if (LGT.st[g][k] === 'edit') d = true; }); }); return d || Object.keys(LGT.cleared).length > 0; }
window.lgtClose = function(){ if (LGT.busy) return; var ov = document.getElementById('lgt-ov'); if (ov) ov.remove(); LGT.open = false; };
function lgtTimeOpts(sel){
  var o = '', hit = false;
  for (var m = 7 * 60; m <= 22 * 60 + 50; m += 10){ var t = lgtHm(m); if (t === sel) hit = true; o += '<option value="' + t + '"' + (t === sel ? ' selected' : '') + '>' + t + '</option>'; }
  if (sel && !hit) o = '<option value="' + lgtEsc(sel) + '" selected>' + lgtEsc(sel) + '</option>' + o;
  return o;
}
function lgtDurOpts(sel){
  var o = '', hit = false;
  LGT_DUR.forEach(function(x){ if (x[0] === sel) hit = true; o += '<option value="' + x[0] + '"' + (x[0] === sel ? ' selected' : '') + '>' + x[1] + '</option>'; });
  if (sel && !hit) o += '<option value="' + sel + '" selected>' + Math.floor(sel / 60) + '시간' + (sel % 60 ? ' ' + (sel % 60) + '분' : '') + '</option>';
  return o;
}
function lgtBody(){
  var gd = (typeof groupDays !== 'undefined') ? groupDays : {}, h = '';
  h += '<div class="lgt-intro">반마다 <b>요일별 시작 시간</b>과 <b>수업 길이</b>를 정해요. 주간계획 모아보기 · 학생앱 주간계획표 · 스터디 코디의 «루멘 수업» 칸이 이 시간으로 그려져요.'
    + '<br><span class="lgt-b guess">짐작</span> = 아직 안 정해서 반 이름으로 짐작한 시간(지금 그렇게 그려지고 있어요) · 저장하면 보이는 시간 그대로 정해져요. 학생이 학생앱에서 자기 학원 시간을 고치면 그 학생은 학생 것이 먼저예요.</div>';
  if (!LGT.groups.length) h += '<div class="lgt-empty">반이 아직 없어요 — ⚙️ 설정 › 👥 반(그룹) 관리에서 반을 먼저 넣어 주세요.</div>';
  LGT.groups.forEach(function(g, gi){
    var days = (gd[g] || []).map(Number), cleared = !!LGT.cleared[g], hasSet = !!(LGT.base && LGT.base[g] && Object.keys(LGT.base[g]).length);
    h += '<section class="lgt-g" data-g="' + lgtEsc(g) + '"><div class="lgt-gh"><b>' + lgtEsc(g) + '</b>'
      + '<span class="lgt-days" role="group" aria-label="' + lgtEsc(g) + ' 수업 요일">' + LGT_ORDER.map(function(d){ var on = days.indexOf(d) >= 0; return '<button type="button" class="lgt-d' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="lgtDay(' + gi + ',' + d + ')" title="수업 요일 ' + (on ? '빼기' : '넣기') + '">' + LGT_DOW[d] + '</button>'; }).join('') + '</span>'
      + ((hasSet && !cleared) ? '<button type="button" class="lgt-clr" onclick="lgtClear(' + gi + ')" title="정한 시간을 지우고 반 이름 짐작으로">↺ 짐작으로</button>' : '')
      + (cleared ? '<span class="lgt-b guess">저장하면 짐작으로 돌아가요</span>' : '') + '</div>';
    if (!days.length){ h += '<div class="lgt-none">수업 요일이 없어요 — 위 요일 단추를 눌러 넣어 주세요.</div></section>'; return; }
    LGT_ORDER.forEach(function(d){
      if (days.indexOf(d) < 0) return;
      var x = (LGT.draft[g] || {})[d] || lgtGuess(g), s = (LGT.st[g] || {})[d] || 'guess';
      if (cleared){ x = lgtGuess(g); s = 'guess'; }
      var end = lgtHm(lgtMin(x.start) + Number(x.min)), id = 'lgt-' + gi + '-' + d;
      h += '<div class="lgt-row" data-day="' + d + '"><span class="lgt-dn">' + LGT_DOW[d] + '</span>'
        + '<label class="lgt-f"><span>시작</span><select id="' + id + '-s" aria-label="' + lgtEsc(g) + ' ' + LGT_DOW[d] + '요일 시작" onchange="lgtSet(' + gi + ',' + d + ')"' + (cleared ? ' disabled' : '') + '>' + lgtTimeOpts(x.start) + '</select></label>'
        + '<label class="lgt-f"><span>길이</span><select id="' + id + '-m" aria-label="' + lgtEsc(g) + ' ' + LGT_DOW[d] + '요일 수업 길이" onchange="lgtSet(' + gi + ',' + d + ')"' + (cleared ? ' disabled' : '') + '>' + lgtDurOpts(Number(x.min)) + '</select></label>'
        + '<span class="lgt-end">→ <b>' + end + '</b> 끝</span>'
        + '<span class="lgt-b ' + s + '">' + (s === 'set' ? '정함' : (s === 'edit' ? '고침' : '짐작')) + '</span></div>';
    });
    h += '</section>';
  });
  return h;
}
function lgtShow(){
  if (!LGT.open) return;
  var ov = document.getElementById('lgt-ov');
  if (!ov){
    ov = document.createElement('div'); ov.id = 'lgt-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '반 수업 시간');
    ov.onclick = function(e){ if (e.target === ov) lgtClose(); };
    document.body.appendChild(ov);
  }
  var y = 0, sc = ov.querySelector('.lgt-scroll'); if (sc) y = sc.scrollTop;
  ov.innerHTML = '<div class="lgt-box"><div class="lgt-hd"><b>⏰ 반 수업 시간</b><button type="button" class="lgt-x" onclick="lgtClose()" aria-label="닫기">✕</button></div>'
    + '<div class="lgt-scroll">' + lgtBody() + '</div>'
    + '<div class="lgt-ft"><span id="lgt-msg" class="lgt-msg" aria-live="polite">' + lgtEsc(LGT.msg) + '</span>'
    + '<button type="button" class="lgt-btn" onclick="lgtClose()">닫기</button>'
    + '<button type="button" class="lgt-btn pri" id="lgt-save" onclick="lgtSave()"' + (LGT.busy ? ' disabled' : '') + '>' + (LGT.busy ? '저장 중…' : '💾 저장') + '</button></div></div>';
  var sc2 = ov.querySelector('.lgt-scroll'); if (sc2) sc2.scrollTop = y;
  lgtFit();
}
/* 글씨 크기(「가」 — body zoom)를 키우면 100vh 가 화면보다 커져 창 위·아래가 잘린다 → 실제 화면 높이에 맞춘다 */
function lgtFit(){
  var b = document.querySelector('#lgt-ov .lgt-box'); if (!b) return;
  var z = 1; try { z = parseFloat(getComputedStyle(document.body).zoom) || 1; } catch(e){}
  b.style.maxHeight = Math.max(240, Math.floor(window.innerHeight / z) - 24) + 'px';
}
window.addEventListener('resize', function(){ if (LGT.open) lgtFit(); });
window.lgtSet = function(gi, d){
  var g = LGT.groups[gi]; if (g == null) return;
  var s = document.getElementById('lgt-' + gi + '-' + d + '-s'), m = document.getElementById('lgt-' + gi + '-' + d + '-m');
  LGT.draft[g] = LGT.draft[g] || {}; LGT.st[g] = LGT.st[g] || {};
  LGT.draft[g][d] = { start: s ? s.value : lgtGuess(g).start, min: m ? Number(m.value) : 120 }; LGT.st[g][d] = 'edit'; LGT.msg = '';
  lgtShow();
};
/* 수업 요일 넣기·빼기 — ⚙️ 설정의 요일 단추와 같은 자료(lumen_group_days) */
window.lgtDay = function(gi, d){
  var g = LGT.groups[gi]; if (g == null || typeof groupDays === 'undefined') return;
  if (!groupDays[g]) groupDays[g] = [];
  var i = groupDays[g].indexOf(d); if (i >= 0) groupDays[g].splice(i, 1); else groupDays[g].push(d);
  try { saveGroupDays(); } catch(e){}
  if (typeof PWB !== 'undefined' && PWB.days) PWB.days[g] = groupDays[g].slice();
  LGT.draft[g] = LGT.draft[g] || {}; LGT.st[g] = LGT.st[g] || {};
  if (i < 0 && !LGT.draft[g][d]){
    var ks = Object.keys(LGT.draft[g]), x = ks.length ? LGT.draft[g][ks[0]] : lgtGuess(g);   /* 새 요일은 같은 반 다른 요일 시간으로 시작 */
    LGT.draft[g][d] = { start: x.start, min: x.min }; LGT.st[g][d] = ks.length ? 'edit' : 'guess';
  }
  LGT.msg = '수업 요일은 바로 저장돼요'; lgtShow();
  try { if (VIEW === 'plwall' || VIEW === 'settings') render(); } catch(e){}
};
window.lgtClear = function(gi){ var g = LGT.groups[gi]; if (g == null) return; LGT.cleared[g] = true; LGT.msg = ''; lgtShow(); };
window.lgtSave = async function(){
  if (LGT.busy) return;
  var gd = (typeof groupDays !== 'undefined') ? groupDays : {};
  var out = JSON.parse(JSON.stringify(LGT.base || {}));
  LGT.groups.forEach(function(g){
    if (LGT.cleared[g]){ delete out[g]; return; }
    var days = (gd[g] || []).map(Number); if (!days.length) return;
    var o = {};
    days.forEach(function(d){ var x = (LGT.draft[g] || {})[d] || lgtGuess(g); if (lgtOk(x)) o[d] = { start: x.start, min: Number(x.min) }; });
    out[g] = o;
  });
  LGT.busy = true; LGT.msg = '저장 중…'; lgtShow();
  try { localStorage.setItem('lumen_group_times', JSON.stringify(out)); } catch(e){}
  if (typeof PWB !== 'undefined') PWB.gt = out;
  var ok = false;
  try { ok = (typeof supaSetItem === 'function') ? !!(await supaSetItem('lumen_group_times', out)) : false; } catch(e){ ok = false; }
  LGT.busy = false; LGT.base = out; LGT.cleared = {};
  lgtDraftFrom(out);
  LGT.msg = ok ? '✅ 저장했어요 — 학원앱·학생앱 «루멘 수업» 칸이 이 시간으로 그려져요' : '⚠️ 이 기기에는 저장했지만 서버에 못 올렸어요 — 인터넷을 확인하면 자동으로 다시 올려요';
  lgtShow();
  try { if (typeof plToast === 'function') plToast(ok ? '⏰ 반 수업 시간을 저장했어요' : '⚠️ 반 수업 시간 — 서버에 못 올렸어요'); } catch(e){}
  try { render(); } catch(e){}
};
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && document.getElementById('lgt-ov')) lgtClose(); });

/* ── 주간계획 모아보기: 짐작으로 그려지는 반이 있으면 머리 아래 한 줄 ── */
if (typeof window.rPlWall === 'function'){
  window.rPlWall = (function(o){ return function(){
    var h = o.apply(this, arguments);
    try {
      if (!PWB.loaded) return h;
      var gs = {}; (typeof pwlAll === 'function' ? pwlAll() : []).forEach(function(s){ var g = String(s.group || ''); if (!g) return; if (PLWALL.grp && PLWALL.grp !== g) return; gs[g] = 1; });
      var guess = Object.keys(gs).filter(function(g){ var p = lgtPerDay(g, PWB.days || {}, lgtMap()); return Object.keys(p).some(function(d){ return p[d].src === 'guess'; }); });
      if (guess.length) h = h.replace('<div class="pwl-sum">', '<div class="pwl-lgt-note">⏰ <b>' + guess.map(lgtEsc).join(' · ') + '</b> 반 수업 시간이 아직 반 이름으로 짐작한 시간이에요 <button type="button" class="pwl-link" onclick="lgtOpen()">정하기 ›</button></div><div class="pwl-sum">');
    } catch(e){}
    return h;
  }; })(window.rPlWall);
}

/* ── 모양 ── */
(function(){
  if (document.getElementById('lgt-css')) return;
  var st = document.createElement('style'); st.id = 'lgt-css';
  st.textContent = ''
    + '#lgt-ov{position:fixed;inset:0;z-index:10003;background:rgba(13,34,64,.5);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.lgt-box{background:#fff;border-radius:16px;width:min(860px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(13,34,64,.35)}'
    + '.lgt-hd{background:linear-gradient(135deg,#0d2240,#164a7a);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px}.lgt-hd b{font-size:17px;font-weight:900;flex:1}'
    + '.lgt-x{border:none;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:40px;height:40px;font-size:16px;cursor:pointer}'
    + '.lgt-scroll{overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}'
    + '.lgt-intro{font-size:12.5px;color:#475569;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px}'
    + '.lgt-empty,.lgt-none{font-size:13px;color:#64748b;font-weight:700;padding:8px 4px}'
    + '.lgt-g{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}'
    + '.lgt-gh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lgt-gh>b{font-size:16px;color:#0d2240;min-width:56px}'
    + '.lgt-days{display:inline-flex;gap:4px;flex-wrap:wrap}'
    + '.lgt-d{width:38px;height:38px;border-radius:50%;border:1.5px solid #e2e8f0;background:#fff;color:#94a3b8;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.lgt-d.on{background:#0d2240;border-color:#0d2240;color:#fff}'
    + '.lgt-clr{margin-left:auto;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;border-radius:8px;padding:8px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;min-height:38px}'
    + '.lgt-row{display:grid;grid-template-columns:34px minmax(120px,1fr) minmax(140px,1fr) auto 52px;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #f1f5f9}'
    + '.lgt-dn{font-size:16px;font-weight:900;color:#b91c1c;text-align:center}'
    + '.lgt-f{display:flex;align-items:center;gap:6px;min-width:0}.lgt-f>span{font-size:12px;color:#64748b;font-weight:800;white-space:nowrap}'
    + '.lgt-f select{flex:1;min-width:0;height:42px;border:1.5px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;font-size:15px;font-weight:800;color:#0d2240;background:#fff}'
    + '.lgt-f select:disabled{background:#f1f5f9;color:#94a3b8}'
    + '.lgt-end{font-size:13px;color:#475569;font-weight:700;white-space:nowrap}.lgt-end b{color:#0d2240;font-size:15px}'
    + '.lgt-b{font-size:11px;font-weight:900;border-radius:6px;padding:3px 7px;text-align:center;white-space:nowrap}.lgt-b.guess{background:#fff7ed;color:#9a3412}.lgt-b.set{background:#dcfce7;color:#15803d}.lgt-b.edit{background:#dbeafe;color:#1d4ed8}'
    + '.lgt-ft{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid #e2e8f0;background:#fff;flex-wrap:wrap}'
    + '.lgt-msg{flex:1;min-width:160px;font-size:12.5px;font-weight:800;color:#15803d}'
    + '.lgt-btn{border:1px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:10px;padding:0 18px;min-height:44px;font:inherit;font-size:14px;font-weight:900;cursor:pointer}.lgt-btn.pri{background:#0d2240;border-color:#0d2240;color:#fff}.lgt-btn[disabled]{opacity:.5}'
    + '.lgt-d:focus-visible,.lgt-btn:focus-visible,.lgt-clr:focus-visible,.lgt-x:focus-visible,.lgt-f select:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '@media(max-width:640px){.lgt-gh>b{width:100%}.lgt-d{width:36px;height:36px}.lgt-row{grid-template-columns:30px minmax(0,1fr) minmax(0,1fr);row-gap:4px}.lgt-end{grid-column:2}.lgt-b{grid-column:3;justify-self:start}.lgt-f>span{display:none}#lgt-ov{padding:8px}.lgt-scroll{padding:10px}.lgt-msg{flex:1 1 100%}.lgt-ft .lgt-btn{flex:1}}'
    + '.lgt-sum{font-size:11.5px;color:#475569;font-weight:700;margin-left:4px}.lgt-sum em{font-style:normal;font-size:10.5px;background:#fff7ed;color:#9a3412;border-radius:5px;padding:1px 5px}'
    + '.lgt-open{width:100%;margin-top:6px;padding:11px;background:#fff;color:#0d2240;border:1.5px solid #0d2240;border-radius:10px;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;min-height:44px}'
    + '.pwl-hd .pwl-lgt{background:#fff;color:#0d2240;border-color:#fff;min-height:32px}'
    + '.pwl-lgt-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:8px 12px;font-size:12.5px;font-weight:700}'
    + '.pwl-owntag{background:#fef3c7;color:#92400e}';
  (document.head || document.documentElement).appendChild(st);
})();
