/* ═══════════════════════════════════════════════════════════════════
 * v19-160: 📚 진도 기준 바꾸기 + 🔔 원장님 알림 (원장 10/26 「중등부 교재는 1권이 2달에서 최대 2.5달 · 고등부는 학기 중엔 숙제체크 진도만 · 내가 알 수 있는 알림」
 *   시안 https://claude.ai/artifact/Hzu1pWgMr91xSTqTdW1tth → 「모두 적용 배포」)
 *   ① 중등 교재(매쓰플랫 교재 학년 중1~중3, 없으면 이름의 «중등·중학»)는 ✎ 로 기준을 따로 적지 않았으면
 *      목표 2개월 · 한계 2.5개월. 예상 완주 > 2개월 🟡 주의 · > 2.5개월(또는 이미 넘김) 🔴 급함. 그 밖의 교재는 예전 그대로(기본 3개월)
 *      🔴🟡 에는 «○/○까지 끝내려면 주 +N쪽 (지금 +M쪽)» — 한계일이 5주 안 남았거나 지났으면 오늘부터 5주
 *   ② 고등학생은 학기 중(3~7월 · 9~12월)엔 교재 %·초과·끊김을 보지 않고 최근 2주 수업일의 숙제체크 «풀이(진도) 100%» 여부만 본다
 *      (bp_config.hiSem === false 면 끈다 — 진도 현황 머리의 단추)
 *   ③ 🔔 알림 = 🚨 위험 신호(riskOf) 중 원장님이 바로 알아야 할 것만: 진도 급함 · 고등 숙제 진도 미흡 · 채점 7일 이상 없음 · 플래너 0점/거짓 제출 · 주간테스트 급락
 *      홈 «🔔 이번 주 경고» 카드 + 위쪽 줄 🔔 단추(개수). 「확인함」 = 2주 동안 숨김(더 나빠지면 바로 다시) · 처음 본 날로 «새로»(7일)
 *      저장: lumen_store `alert_state` { ack:{키:날짜}, seen:{키:날짜}, init } — 학원앱만 읽고 쓴다(시작 다운로드에서 뺌)
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var BP_MID = { tgt: 2, lim: 2.5 };
function bpLvlOf(bid){
  var md = (BP.books || {})[bid] || {}, i = bpGradeIdx(md.g), n = String(md.n || '');
  if (i >= 7 && i <= 9) return 'mid';
  if (i >= 10) return 'high';
  if (i >= 1) return 'elem';
  if (/중등|중학/.test(n)) return 'mid';
  if (/고등|공통수학|미적분|확률과|기하|수학\s*(상|하|I|Ⅰ|Ⅱ)/.test(n)) return 'high';
  if (/초등/.test(n)) return 'elem';
  return '';
}
/* ✎ 로 이 교재 기준을 직접 적었으면 그 값이 한계(예전 방식), 아니면 중등 교재는 2/2.5개월 */
function bpMidStd(bid){ return !(Number(BP.cfg.months[bid]) > 0) && bpLvlOf(bid) === 'mid'; }
var _bpMonthsOf159 = bpMonthsOf;
bpMonthsOf = function(bid){ return bpMidStd(bid) ? BP_MID.lim : _bpMonthsOf159(bid); };

/* ── 고등부 학기 중 ── */
function bpKst(off){ return new Date(Date.now() + 9 * 3600000 + (off || 0) * 86400000).toISOString().slice(0, 10); }
function bpHiSemNow(){ var m = +bpKst().slice(5, 7); return BP.cfg.hiSem !== false && [1, 2, 8].indexOf(m) < 0; }
function bpIsHighSt(st){ return /고등/.test(String((st && st.grade) || '')); }
function bpHsOf(st){ return bpHiSemNow() && bpIsHighSt(st) && !(st && st.withdrawn); }
/* 최근 2주 수업일(반 요일 · 공휴일 빼고)의 숙제체크 — 풀이 100% = ✓ · 적었는데 100 아님 = ✗ · 안 적음 = ? (오늘은 적었을 때만) */
function bpHwOf(st){
  var gd = (st.group && typeof groupDays !== 'undefined' && groupDays[st.group]) || [], hw = st.lumen_hw || {}, cells = [];
  for (var k = 14; k >= 0; k--){
    var d = bpKst(-k), dow = new Date(d + 'T12:00:00+09:00').getDay(), v = (typeof hwcNorm === 'function') ? hwcNorm(hw[d]) : null;
    if (typeof CT_HOLI !== 'undefined' && CT_HOLI[d]) continue;
    if (gd.length ? gd.indexOf(dow) < 0 : !v) continue;
    if (k === 0 && !v) continue;
    cells.push({ d: d, v: !v ? 'unk' : (v.p >= 100 ? 'ok' : 'bad') });
  }
  var c = { ok: 0, bad: 0, unk: 0 }; cells.forEach(function(x){ c[x.v]++; });
  return { cells: cells, ok: c.ok, bad: c.bad, unk: c.unk, n: cells.length };
}
function bpHwStat(hw){
  if (!hw || !hw.n) return { c: '#94a3b8', t: '수업일 없음', s: 0 };
  if (hw.bad >= 2) return { c: '#6d28d9', t: '미흡 ' + hw.bad, s: 2 };
  if (hw.bad + hw.unk >= 2) return { c: '#b45309', t: (hw.bad ? '미흡 ' + hw.bad + ' · ' : '') + '안 찍음 ' + hw.unk, s: 1 };
  if (hw.bad || hw.unk) return { c: '#b45309', t: hw.bad ? '미흡 1' : '안 찍음 1', s: 0 };
  return { c: '#15803d', t: '완료', s: 0 };
}
function bpHwCells(hw){
  return '<span style="display:inline-flex;gap:3px;flex-wrap:wrap">' + (hw.cells || []).map(function(x){
    var bg = x.v === 'ok' ? '#16a34a' : (x.v === 'bad' ? '#dc2626' : '#94a3b8');
    return '<i title="' + x.d.slice(5).replace('-', '/') + (x.v === 'ok' ? ' 풀이 100%' : (x.v === 'bad' ? ' 풀이 덜 함' : ' 숙제체크 안 찍음')) + '" style="width:17px;height:17px;border-radius:5px;font-style:normal;font-size:10px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:' + bg + '">' + (x.v === 'ok' ? '✓' : (x.v === 'bad' ? '✗' : '?')) + '</i>';
  }).join('') + '</span>';
}
/* 위험 신호용 — 고등 학기 중 숙제 진도 (riskOf 끝에서 부른다) */
function bpHwSig(st){
  if (!bpHsOf(st)) return null;
  var hw = bpHwOf(st), s = bpHwStat(hw); if (s.s < 1) return null;
  return { k: 'hwp', sev: s.s, t: '숙제 진도 ' + hw.ok + '/' + hw.n + ' (최근 2주) · ' + s.t, d: '고등 학기 중 — 교재 진도 대신 숙제체크 «풀이 100%»로 봐요', go: 'hwcheck' };
}

/* ── 학생 한 줄 판정을 덮어쓴다 ── */
var _bpStudentRow159 = bpStudentRow;
bpStudentRow = function(st){
  var x = _bpStudentRow159(st);
  if (!x) return x;
  if (bpHsOf(st)){
    x.hs = true; x.hw = bpHwOf(st); x.hwStat = bpHwStat(x.hw);
    if (!x.none){ x.status = 'g'; x.why = '🎓 학기 중 — 숙제 진도로 봐요'; }
    return x;
  }
  if (x.none || x.allDone || x.likelyDone || !x.bid) return x;
  var mid = bpMidStd(x.bid), limD = x.limD, tgtD = Math.round(BP_MID.tgt * 30.44);
  if (mid && x.lastAgo < 14){
    var proj = (x.pct != null && !x.total.est && x.pct >= 4 && x.elapsed != null) ? x.elapsed / (x.pct / 100) : null;
    x.tag = '';
    if (x.elapsed != null && x.elapsed > limD){ x.status = 'r'; x.tag = '급함'; x.why = '급함 — 중등 교재 한계 2.5개월을 넘김 (' + x.elapsed + '일째 ' + (x.pct != null ? x.pct + '%' : '') + ')'; }
    else if (proj != null && proj > limD){ x.status = 'r'; x.tag = '급함'; x.why = '급함 — 이대로면 한계 2.5개월을 넘김'; }
    else if (proj != null && proj > tgtD){ x.status = 'y'; x.tag = '주의'; x.why = '이대로면 목표 2개월을 넘김'; }
    else if (x.elapsed != null && x.elapsed > tgtD){ x.status = 'y'; x.tag = '주의'; x.why = '목표 2개월 지남 (' + x.elapsed + '일째)'; }
    else { x.status = 'g'; x.why = ''; }
  }
  x.mid = mid;
  /* 필요한 속도 — 쪽수가 확정된 교재만 */
  if ((x.status === 'r' || x.status === 'y') && x.lastAgo < 14 && x.total && x.total.n && !x.total.est && x.d && x.d.maxPage < x.total.n && x.start){
    var now = Date.parse(bpKst() + 'T00:00:00Z'), by = Date.parse(String(x.start).slice(0, 10) + 'T00:00:00Z') + limD * 86400000;
    if (by < now + 35 * 86400000) by = now + 35 * 86400000;
    var remain = x.total.n - x.d.maxPage, wk = Math.max(1, Math.ceil(remain / ((by - now) / (7 * 86400000))));
    x.need = { by: new Date(by), wk: wk, remain: remain, cur: x.pace || 0 };
  }
  return x;
};

/* ── 진도 현황 화면 조각 ── */
function bpStdBar(){
  var on = BP.cfg.hiSem !== false, sem = bpHiSemNow();
  var pill = function(t, hot){ return '<span style="border:1.5px solid ' + (hot ? '#2563eb' : '#cbd5e1') + ';color:' + (hot ? '#1d4ed8' : '#475569') + ';background:#fff;border-radius:9px;padding:1px 9px;font-weight:900">' + t + '</span>'; };
  return '<div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center;background:#f6f8fb;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin:8px 0 4px;font-size:12.5px;font-weight:700;color:#334155">'
    + '<b style="color:#0d2240">기준</b> 중등 교재 ' + pill('목표 2개월', 1) + pill('한계 2.5개월', 1)
    + '<span style="margin-left:6px">그 밖의 교재</span>' + pill((BP.cfg.def || 3) + '개월', 0)
    + '<span style="margin-left:6px">🎓 고등부</span><button type="button" onclick="bpHiSemToggle()" style="font-family:inherit;font-size:12px;font-weight:900;border-radius:9px;padding:2px 10px;cursor:pointer;border:1.5px solid ' + (on ? '#6d28d9' : '#cbd5e1') + ';background:' + (on ? '#6d28d9' : '#fff') + ';color:' + (on ? '#fff' : '#64748b') + '">학기 중엔 숙제 진도로 · ' + (on ? '켜짐' : '꺼짐') + '</button>'
    + '<span style="color:#94a3b8;font-size:11.5px">' + (on ? (sem ? '지금 학기 중(3~7·9~12월)' : '지금 방학 — 교재 기준') : '') + ' · 교재마다 ✎ 로 따로 적은 기준이 먼저</span></div>';
}
window.bpHiSemToggle = function(){ BP.cfg.hiSem = (BP.cfg.hiSem === false); bpSaveCfg(); render(); };
function bpHsList(hsRows, selKey){
  if (!hsRows.length) return '';
  var h = '<div style="font-size:12px;color:#6d28d9;font-weight:900;padding:10px 4px 6px">🎓 고등부 · 학기 중 숙제 진도 <span style="color:#94a3b8;font-weight:700">최근 2주 수업일 · 칸 = 숙제체크 풀이 100% ✓ · 덜 함 ✗ · 안 찍음 ?</span></div>';
  hsRows.slice().sort(function(a, b){ return (b.hwStat.s - a.hwStat.s) || ((b.hw.bad + b.hw.unk) - (a.hw.bad + a.hw.unk)); }).forEach(function(x){
    var k = x.stKey || String(x.st.id || x.st.name), on = (k === selKey), s = x.hwStat;
    h += '<div onclick="bpSelect(\'' + esc2(k).replace(/'/g, '') + '\')" style="display:flex;align-items:center;gap:8px;padding:8px 11px;border:' + (on ? '2.5px solid #0891b2;background:#f0fdff' : (s.s ? '1.5px solid #ddd6fe;background:#faf7ff' : '1px solid #f1f5f9;background:#fff')) + ';border-radius:12px;margin-bottom:6px;cursor:pointer">';
    h += '<span style="width:15px;height:15px;border-radius:50%;flex-shrink:0;background:' + s.c + '"></span>';
    h += '<span style="width:78px;flex-shrink:0"><span style="display:block;font-size:18px;font-weight:900;color:#0d2240">' + esc2(x.st.name) + '</span><span style="display:block;font-size:11px;color:#94a3b8;font-weight:700">' + esc2((x.st.grade || '').replace(/학교|학년/g, '').replace(/\s/g, '')) + '·' + esc2(x.st.group || '') + '</span></span>';
    h += '<span style="flex:1;min-width:0;font-size:13px;font-weight:800;color:#475569">숙제 진도 ' + x.hw.ok + '/' + x.hw.n + '<div style="margin-top:3px">' + bpHwCells(x.hw) + '</div></span>';
    h += '<span style="width:80px;flex-shrink:0;text-align:right;font-size:13.5px;font-weight:900;color:' + s.c + '">' + esc2(s.t) + '</span></div>';
  });
  return h;
}
function bpNeedBox(x){
  if (!x || !x.need) return '';
  var n = x.need, by = n.by, ds = (by.getUTCMonth() + 1) + '/' + by.getUTCDate(), times = n.cur > 0 ? Math.round(n.wk / n.cur * 10) / 10 : null;
  return '<div style="background:' + (x.status === 'r' ? '#fef2f2;color:#b91c1c;border:1.5px solid #fecaca' : '#fffbeb;color:#92400e;border:1.5px solid #fde68a') + ';border-radius:12px;padding:9px 13px;margin:0 0 10px;font-size:14px;font-weight:800">'
    + '🏃 남은 ' + n.remain + '쪽 — <b>' + ds + '까지</b> 끝내려면 <b>주 +' + n.wk + '쪽</b> (지금 +' + n.cur + '쪽' + (times && times >= 1.3 ? ' · 약 ' + times + '배' : '') + ')'
    + (x.mid ? '<div style="font-size:11.5px;font-weight:700;opacity:.8;margin-top:2px">중등 교재 목표 2개월 · 한계 2.5개월 — 한계일이 5주 안 남았거나 지났으면 오늘부터 5주로 잡았어요</div>' : '') + '</div>';
}
function bpHsBox(x){
  if (!x || !x.hs) return '';
  var s = x.hwStat;
  return '<div style="background:#faf7ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:10px 13px;margin:0 0 10px">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:#6d28d9;font-size:14.5px">🎓 학기 중 — 숙제 진도 ' + x.hw.ok + '/' + x.hw.n + '</b><span style="font-weight:900;color:' + s.c + '">' + esc2(s.t) + '</span>'
    + '<button type="button" onclick="riskGo(\'hwcheck\')" style="margin-left:auto;font-family:inherit;font-size:12px;font-weight:800;border:1.5px solid #6d28d9;color:#6d28d9;background:#fff;border-radius:9px;padding:2px 10px;cursor:pointer">숙제체크 ›</button></div>'
    + '<div style="margin-top:6px">' + bpHwCells(x.hw) + '</div>'
    + '<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:5px">시험대비 기간이라 교재 %·초과·끊김 경고는 띄우지 않아요. 아래 교재 기록은 참고용.</div></div>';
}
var _bpDetailPanel159 = bpDetailPanel;
bpDetailPanel = function(x){
  var h = _bpDetailPanel159(x), extra = bpHsBox(x) + bpNeedBox(x);
  if (!extra) return h;
  /* «마지막 채점 …» 줄 바로 아래 (기록 없는 학생은 이름 줄 아래) */
  var i = h.indexOf('margin:4px 0 13px'), e = h.indexOf('</div>', i >= 0 ? i : 0);
  return e < 0 ? h + extra : h.slice(0, e + 6) + extra + h.slice(e + 6);
};

/* ═══ 🔔 원장님 알림 ═══ */
var AL = { st: null, loading: false, kicked: false, ready: false, open: false, saving: false };
var AL_ICON = { prog: '🔴', hwp: '🎓', stop: '⏸', plz: '📔', plzlie: '📛', wk: '📉' };
function alLoadState(){
  var sb = (typeof getSupaClient === 'function') ? getSupaClient() : null;
  if (!sb) return Promise.resolve(AL.st = AL.st || { ack: {}, seen: {} });
  return Promise.resolve(sb.from('lumen_store').select('value').eq('key', 'alert_state')).then(function(r){
    var v = r && r.data && r.data[0] ? r.data[0].value : null;
    if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    AL.st = (v && typeof v === 'object') ? { ack: v.ack || {}, seen: v.seen || {}, init: v.init || '' } : { ack: {}, seen: {}, init: '' };
  }).catch(function(){ AL.st = AL.st || { ack: {}, seen: {}, init: '' }; });
}
function alSave(){
  if (AL.saving) return; AL.saving = true;
  var mine = AL.st;
  /* 다른 기기에서 누른 «확인함»도 살리게 서버 것을 먼저 읽고 합친다 */
  var sb = (typeof getSupaClient === 'function') ? getSupaClient() : null;
  var p = sb ? Promise.resolve(sb.from('lumen_store').select('value').eq('key', 'alert_state')).then(function(r){
    var v = r && r.data && r.data[0] ? r.data[0].value : null;
    if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    if (v && typeof v === 'object'){
      ['ack', 'seen'].forEach(function(f){ var o = v[f] || {}; Object.keys(o).forEach(function(k){ if (!mine[f][k] || (f === 'ack' && String(o[k]) > String(mine[f][k])) || (f === 'seen' && String(o[k]) < String(mine[f][k]))) mine[f][k] = o[k]; }); });
      if (v.init && (!mine.init || v.init < mine.init)) mine.init = v.init;
    }
  }).catch(function(){}) : Promise.resolve();
  return p.then(function(){
    var cut = bpKst(-60);
    ['ack', 'seen'].forEach(function(f){ Object.keys(mine[f]).forEach(function(k){ if (String(mine[f][k]) < cut) delete mine[f][k]; }); });
    return supaSetItem('alert_state', { ack: mine.ack, seen: mine.seen, init: mine.init || bpKst(), upd: new Date().toISOString() });
  }).catch(function(){}).then(function(){ AL.saving = false; });
}
function alKick(){
  if (AL.kicked) return; AL.kicked = true; AL.loading = true;
  var ps = [alLoadState()];
  try { ps.push(bpLoad()); } catch(e){}
  try { if (typeof wkLoad === 'function') ps.push(wkLoad()); } catch(e){}
  Promise.all(ps.map(function(p){ return Promise.resolve(p).catch(function(){}); })).then(function(){
    AL.loading = false; AL.ready = true; alSeen(); alBadge();
    try { if (VIEW === 'home') render(); } catch(e){}
  });
}
/* 지금 걸린 알림 — 위험 신호에서 원장님이 바로 알아야 할 것만 */
function alCompute(){
  var out = [];
  var stus = (typeof getSortedStudents === 'function' ? getSortedStudents() : (students || [])).filter(function(s){ return s && !s.withdrawn && s.lumen_rec_code; });
  stus.forEach(function(st){
    var sig = []; try { sig = riskOf(st) || []; } catch(e){ sig = []; }
    var hs = bpHsOf(st);
    sig.forEach(function(x){
      var ok = (x.k === 'prog' && x.sev === 2 && !/끊김/.test(x.t))
        || x.k === 'hwp'
        || (x.k === 'stop' && !hs && /\d+일/.test(x.t))
        || x.k === 'plz' && x.sev === 2 || x.k === 'plzlie' || x.k === 'wk';
      if (!ok) return;
      var sk = String(st.lumen_rec_code || st.id || st.name);
      out.push({ key: sk + '|' + x.k + '|' + x.sev, st: st, k: x.k, sev: x.sev, t: x.t, d: x.d, go: x.go });
    });
  });
  return out;
}
function alAcked(a){ var v = AL.st && AL.st.ack[a.key]; return !!(v && String(v) >= bpKst(-14)); }
function alIsNew(a){ var v = AL.st && AL.st.seen[a.key]; return !!(v && String(v) >= bpKst(-6)); }
/* 처음 본 날 기록 — 처음 켤 때는 «이미 아는 것»으로 깐다(진도 급함만 오늘 기준이 바뀌었으니 새로) */
function alSeen(){
  if (!AL.st || !AL.ready) return;
  var first = !AL.st.init, t = bpKst(), ch = false;
  alCompute().forEach(function(a){ if (!AL.st.seen[a.key]){ AL.st.seen[a.key] = (first && a.k !== 'prog') ? bpKst(-30) : t; ch = true; } });
  if (first){ AL.st.init = t; ch = true; }
  if (ch) alSave();
}
function alActive(){
  if (!AL.ready) return [];
  return alCompute().filter(function(a){ return !alAcked(a); }).sort(function(a, b){ return (alIsNew(b) - alIsNew(a)) || (b.sev - a.sev) || String(a.st.name).localeCompare(String(b.st.name)); });
}
function alBadge(){
  var el = document.getElementById('al-bell-n'); if (!el) return;
  var n = alActive().length; el.textContent = n > 99 ? '99+' : String(n); el.style.display = n ? '' : 'none';
}
window.alAck = function(key){
  if (!AL.st) return; AL.st.ack[key] = bpKst(); alSave(); alBadge(); render(); if (AL.open) alPopDraw();
  try { plToast('✓ 확인함 — 2주 동안 숨깁니다 (더 나빠지면 다시 떠요)'); } catch(e){}
};
window.alGo = function(i){
  var a = (AL._last || [])[i]; if (!a) return;
  alPopClose();
  if (a.go === 'bookprog'){ try { BP.sel = String(a.st.id || a.st.name); } catch(e){} }
  riskGo(a.go);
};
function alRows(list, max){
  AL._last = list;
  return list.slice(0, max).map(function(a, i){
    return '<div style="display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:start;padding:8px 0;border-top:1px dashed #e2e8f0">'
      + '<span style="font-size:17px">' + (AL_ICON[a.k] || '⚠️') + '</span>'
      + '<span style="min-width:0"><b style="font-size:14px;color:' + (a.sev === 2 ? '#b91c1c' : '#92400e') + '">' + esc2(a.st.name) + ' · ' + esc2(a.t) + '</b>' + (alIsNew(a) ? '<span style="font-size:10.5px;font-weight:900;background:#dc2626;color:#fff;border-radius:6px;padding:0 6px;margin-left:5px">새로</span>' : '')
      + '<span style="display:block;font-size:12px;color:#64748b;font-weight:700">' + esc2(a.d || '') + '</span></span>'
      + '<span style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end"><button type="button" onclick="alGo(' + i + ')" style="font-family:inherit;font-size:12px;font-weight:800;border:1.5px solid #1d4ed8;color:#1d4ed8;background:#fff;border-radius:9px;padding:2px 9px;cursor:pointer;white-space:nowrap">' + esc2((typeof RISK_NAMES !== 'undefined' && RISK_NAMES[a.k]) || '보기') + ' ›</button>'
      + '<button type="button" onclick="alAck(\'' + esc2(a.key).replace(/'/g, '') + '\')" style="font-family:inherit;font-size:12px;font-weight:800;border:1px solid #cbd5e1;color:#475569;background:#f8fafc;border-radius:9px;padding:2px 9px;cursor:pointer;white-space:nowrap">확인함</button></span></div>';
  }).join('');
}
function alMonday(){
  if (new Date(bpKst() + 'T12:00:00Z').getUTCDay() !== 1 || !AL.st) return '';
  var from = bpKst(-7), nNew = 0, nAck = 0;
  Object.keys(AL.st.seen).forEach(function(k){ var v = String(AL.st.seen[k]); if (v >= from && v < bpKst()) nNew++; });
  Object.keys(AL.st.ack).forEach(function(k){ var v = String(AL.st.ack[k]); if (v >= from && v < bpKst()) nAck++; });
  return '<div style="background:#eef2ff;border-radius:10px;padding:7px 11px;margin-bottom:6px;font-size:13px;font-weight:800;color:#3730a3">🗓 지난주 요약 — 새 경고 ' + nNew + '건 · 확인함 ' + nAck + '건 · 지금 남은 경고 ' + alActive().length + '건</div>';
}
function alHomeCard(){
  alKick();
  var box = 'background:#fff;border:1.5px solid #fecaca;border-radius:16px;padding:16px 20px;box-shadow:0 3px 12px rgba(13,34,64,0.05);margin-bottom:16px';
  var go = '<button type="button" onclick="riskGo(\'risk\')" style="margin-left:auto;font-family:inherit;font-size:12.5px;font-weight:800;border:1.5px solid #dc2626;color:#dc2626;background:#fff;border-radius:10px;padding:5px 12px;cursor:pointer">🚨 위험 신호 전체 ›</button>';
  if (!AL.ready) return '<div style="' + box + '"><div style="display:flex;align-items:center;gap:8px"><b style="font-size:15px;color:#0d2240">🔔 이번 주 경고</b>' + go + '</div><div style="font-size:13px;color:#94a3b8;font-weight:700;margin-top:6px">진도·숙제·채점 기록 불러오는 중…</div></div>';
  var l = alActive(), nNew = l.filter(alIsNew).length;
  setTimeout(alBadge, 0);
  var h = '<div style="' + (l.length ? box : box.replace('#fecaca', '#e6eaf1')) + '"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><b style="font-size:15px;color:#0d2240">🔔 이번 주 경고</b>'
    + (l.length ? '<span style="font-size:12.5px;font-weight:900;color:#dc2626;background:#fde8e8;border-radius:8px;padding:0 8px">' + l.length + '건' + (nNew ? ' · 새로 ' + nNew : '') + '</span>' : '') + go + '</div>';
  h += alMonday();
  if (!l.length) h += '<div style="font-size:13px;color:#16a34a;font-weight:800">✅ 지금 알릴 경고가 없습니다</div>';
  h += alRows(l, 5);
  if (l.length > 5) h += '<div style="font-size:12.5px;color:#64748b;font-weight:700;padding-top:6px">외 ' + (l.length - 5) + '건 — 위쪽 🔔 알림 또는 🚨 위험 신호에서</div>';
  h += '<div style="font-size:11px;color:#94a3b8;font-weight:700;margin-top:6px">진도 급함 · 고등 숙제 진도 미흡 · 채점 7일 없음 · 플래너 0점/거짓 제출 · 주간테스트 20점 넘게 하락 — «확인함»은 2주 동안 숨기고, 더 나빠지면 다시 띄웁니다. 원장님만 봅니다.</div>';
  return h + '</div>';
}
/* 위쪽 줄 🔔 — 어느 화면에서나 */
function alPopDraw(){
  var p = document.getElementById('al-pop'); if (!p) return;
  var l = alActive();
  p.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:15px;color:#0d2240">🔔 알림 ' + l.length + '건</b>'
    + '<button type="button" onclick="alPopClose();riskGo(\'risk\')" style="margin-left:auto;font-family:inherit;font-size:12px;font-weight:800;border:1.5px solid #dc2626;color:#dc2626;background:#fff;border-radius:9px;padding:3px 10px;cursor:pointer">🚨 위험 신호 ›</button>'
    + '<button type="button" onclick="alPopClose()" aria-label="닫기" style="font-family:inherit;font-size:16px;border:none;background:none;cursor:pointer;color:#64748b">✕</button></div>'
    + (AL.ready ? (l.length ? alRows(l, 40) : '<div style="padding:14px 0;color:#16a34a;font-weight:800">✅ 지금 알릴 경고가 없습니다</div>') : '<div style="padding:14px 0;color:#94a3b8;font-weight:700">불러오는 중…</div>');
}
window.alPopClose = function(){ AL.open = false; var p = document.getElementById('al-pop'); if (p) p.style.display = 'none'; };
window.alBell = function(){
  alKick();
  var p = document.getElementById('al-pop');
  if (!p){ p = document.createElement('div'); p.id = 'al-pop'; p.style.cssText = 'position:fixed;top:88px;right:14px;z-index:9000;width:min(460px,calc(100vw - 28px));max-height:70vh;overflow-y:auto;background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;box-shadow:0 12px 36px rgba(13,34,64,.25);padding:14px 16px;font-family:inherit'; document.body.appendChild(p); }
  AL.open = !AL.open; p.style.display = AL.open ? '' : 'none';
  if (AL.open) alPopDraw();
};
/* 앱을 켜고 잠시 뒤 한 번 읽어 🔔 숫자를 채운다 · 30분마다 다시 센다(서버는 다시 읽지 않음) */
(function(){
  try {
    setTimeout(function(){ try { alKick(); } catch(e){} }, 6000);
    setInterval(function(){ try { if (AL.ready){ alSeen(); alBadge(); if (AL.open) alPopDraw(); } } catch(e){} }, 1800000);
  } catch(e){}
})();
