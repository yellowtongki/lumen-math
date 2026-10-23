/* ═══════════════════════════════════════════════════════════════════
 * v19-153: 🚑 리커버리 — 네이버 예약 시간 자동 연동 · 전용 왼쪽 기둥 · 📊 통계 (계약서 docs/recovery_tab_contract.md · 시안 docs/mockup_recovery_tab.html)
 * 원장 2026-10-23 「리커버리 A안 추천대로 진행」 = 시안의 추천 전부
 *
 *  A 예약 시간 자동 연동 (rcSidePanel · rcSetSlot · nbkRcBadge 를 감싼다)
 *    1 보드를 그릴 때(네이버 예약을 읽은 뒤) 그 주 확정 학생(완료 아님)의 그 날 리커버리 예약 시간을 시간 칸(e.slot)에 넣는다
 *      — e.slotSrc 가 'manual' 이 아니고 시간이 다를 때만. 바뀐 것은 모아서 rcSaveState() 한 번 + setTimeout(render,0) 한 번.
 *    2 원장님이 칩을 직접 누르면 e.slotSrc='manual' (같은 칩 다시 눌러 해제하면 slotSrc 삭제 → 다음 그리기에서 예약 시간이 다시 들어감)
 *      예약과 다르면 «✋ 직접 HH:MM · ⚠ 예약과 다름» + 「예약 시간으로」(rn153UseBook)
 *    3 칩 = RC.cfg.slots ∪ 그 날 예약 시간 ∪ 최근 8주 리커버리 예약 시간(D-2). 네이버에서 온 시간은 점선. 원장 설정(RC.cfg.slots)은 바꾸지 않는다
 *    4 예약 취소 + slotSrc 'naver' → 시간은 두고 «⚠ 예약 취소됨 (HH:MM)» · 예약도 시간도 없으면 «예약 아직»
 *    5 옛 「시간 넣기」 단추는 그리지 않는다(nbkRcSlot 함수는 남김). 학생앱 알림·안내문은 e.slot 을 그대로 읽는다
 *  B 왼쪽 기둥(PC ≥900) l3rLeft 를 통째로 다시 그린다: ① 이번 주 숫자 4칸 ② 시간대별 인원 ③ 명단 ④ 📨 예약 안 한 학생
 *    ⑤ 📊 통계 요약(숫자 4칸 · 6개월 막대 · 🔁 3회 이상 · 통계 자세히 · 📜 장부) ⑥ ⚙ 기준 + 접힌 공용 메뉴
 *  C 가운데 「📊 통계」 탭(RC.view 'stats') — rRecovery 를 감싼다. 자료는 있는 것만(rc_state · 주간테스트 mf_weekly · naver_bookings)
 *  D-1 홈 «🚑 내일(오늘) 리커버리 · 예약 아직 n명» 한 줄 — nbkHomeCard 를 감싼다(리커버리 전날~당일, 0명이면 없음)
 *  ※ 새로 적는 칸은 e.slotSrc('naver'|'manual')·e.slotAt 두 개뿐. 네이버 예약은 읽기만. 등록부 안 씀.
 *  ※ 바탕 함수는 감싸기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var RN153 = { reTimer:null, homeKick:false, memo:null, memoTick:-2 };

/* ── 작은 도움 ── */
function rn153Q(s){ return esc2(s); }
function rn153K(k){ return String(k == null ? '' : k).replace(/'/g, ''); }
function rn153Today(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function rn153Add(ymd, n){ var t = Date.parse(String(ymd || '').slice(0, 10) + 'T00:00:00Z'); if (isNaN(t)) return ''; return new Date(t + n * 86400000).toISOString().slice(0, 10); }
function rn153NowYm(){ var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); }   /* l3rLedgerBox 와 같은 «이번 달» */
function rn153YmAdd(ym, n){ var y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7)) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }
function rn153Md(ymd){ var d = new Date(String(ymd || '') + 'T00:00:00'); if (isNaN(d)) return String(ymd || ''); return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + ['일','월','화','수','목','금','토'][d.getDay()] + ')'; }
function rn153Min(t){ var m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; }
function rn153Clock(t){ var m = String(t || '').match(/^(\d{1,2})/); var h = m ? Number(m[1]) % 12 : 0; return ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'][h]; }
function rn153Sign(v){ if (v == null || isNaN(v)) return '—'; if (v > 0) return '+' + v; if (v < 0) return '−' + Math.abs(v); return '±0'; }
function rn153R1(v){ return Math.round(v * 10) / 10; }
function rn153Stu(k){ var a = (typeof students !== 'undefined' && students) ? students : []; for (var i = 0; i < a.length; i++){ if (String(a[i].id || a[i].name) === String(k)) return a[i]; } return null; }
/* 학년 키 — ultra_night_writer.js gradeKey 규칙(«중학교 2학년» → 중2) + «초6»처럼 이미 짧은 것도 */
function rn153Grade(g){
  var s = String(g || ''), m = s.match(/(\d)\s*학년/);
  if (m) return (/초등/.test(s) ? '초' : (/고등/.test(s) ? '고' : '중')) + m[1];
  m = s.match(/(초|중|고)[^0-9]*(\d)/);
  return m ? (m[1] + m[2]) : '—';
}
function rn153GradeRank(g){ var m = String(g).match(/^(초|중|고)(\d)$/); return m ? ({ '초':0, '중':10, '고':20 }[m[1]] + Number(m[2])) : 99; }

/* ── 네이버 예약 ── */
function rn153NbkOk(){ try { return !!(typeof NBK !== 'undefined' && NBK.loaded && typeof nbkHas === 'function' && nbkHas()); } catch(e){ return false; } }
function rn153Book(k, dt){ try { return rn153NbkOk() ? nbkRecOf(k, dt) : null; } catch(e){ return null; } }
/* 그 학생 그 날 «취소된» 리커버리 예약 (살아 있는 예약이 있으면 그것을 쓰므로 여기선 취소만) */
function rn153Cancel(k, dt){
  if (!rn153NbkOk()) return null;
  var out = nbkAll().filter(function(b){ if (!(b.item && b.item.kind === 'recovery') || b.date !== dt || nbkLive(b)) return false; var m = nbkMatch(b); return m && m.st && m.stKey === String(k); });
  out.sort(function(a, b){ return String(b.start).localeCompare(String(a.start)); });
  return out[0] || null;
}
/* 칩 목록 = 원장 설정 ∪ 그 날 리커버리 예약 시간 ∪ 최근 8주 리커버리 예약 시간 (취소 빼고) · nv = 네이버에서만 온 시간 */
function rn153Times(dt, extra){
  var base = (RC.cfg && Array.isArray(RC.cfg.slots)) ? RC.cfg.slots.slice() : [], seen = {}, nv = {}, list = [];
  base.forEach(function(s){ if (s && !seen[s]){ seen[s] = 1; list.push(s); } });
  var add = function(t, isNv){ if (!t || !/^\d{1,2}:\d{2}$/.test(String(t)) || seen[t]) return; seen[t] = 1; list.push(String(t)); if (isNv) nv[t] = 1; };
  var since = rn153Add(rn153Today(), -56);
  try {
    if (rn153NbkOk()) nbkAll().forEach(function(b){
      if (!(b.item && b.item.kind === 'recovery') || !nbkLive(b) || !b.start) return;
      if (b.date === dt || String(b.date) >= since) add(b.start, true);
    });
  } catch(e){}
  try {   /* 예약 통계(v19-127)가 «전체 보관»을 이미 읽어 두었으면 그것도 (새로 읽지는 않는다) */
    if (typeof NBS !== 'undefined' && NBS.arch && Array.isArray(NBS.arch.rows)) NBS.arch.rows.forEach(function(r){
      if (r && r.kind === 'recovery' && !r.canc && r.start && String(r.date) >= since) add(r.start, true);
    });
  } catch(e){}
  (extra || []).forEach(function(t){ add(t, false); });
  list.sort(function(a, b){ return rn153Min(a) - rn153Min(b); });
  return { list:list, nv:nv };
}

/* ═══ A-1 자동 맞춤 — 그리는 중에는 저장만, 다시 그리기는 한 번 뒤로 ═══ */
function rn153Sync(conf, wk){
  if (!rn153NbkOk() || !RC.loaded) return 0;
  var dt = rcRecDate(wk), n = 0, at = new Date().toISOString();
  (conf || []).forEach(function(c){
    var e = c && c.e; if (!e || !e.on || e.done) return;
    if (e.slotSrc === 'manual') return;
    var b = rn153Book(c.k, dt); if (!b || !b.start) return;
    if (e.slot === b.start) return;
    e.slot = b.start; e.slotSrc = 'naver'; e.slotAt = at; n++;
  });
  if (n){
    rcSaveState();
    if (!RN153.reTimer) RN153.reTimer = setTimeout(function(){ RN153.reTimer = null; try { render(); } catch(e){} }, 0);
  }
  return n;
}

/* ═══ A-2 손으로 고른 시간 보호 ═══ */
var _rcSetSlot153 = window.rcSetSlot;
window.rcSetSlot = function(k, slot){
  try {
    var wk = rcWeekKey(), W = RC.state.calls[wk] = RC.state.calls[wk] || {}, e = W[k] = W[k] || {};
    if (e.slot === slot){ delete e.slotSrc; delete e.slotAt; }          /* 해제 → 다음 그리기에서 예약 시간이 다시 들어간다 */
    else { e.slotSrc = 'manual'; e.slotAt = new Date().toISOString(); }
  } catch(err){}
  return _rcSetSlot153.apply(this, arguments);
};
/* 「예약 시간으로」 — 직접 고른 시간을 버리고 네이버 예약 시간으로 */
window.rn153UseBook = function(k){
  if (k == null) return;
  var wk = rcWeekKey(), b = rn153Book(k, rcRecDate(wk)); if (!b || !b.start) return;
  var W = RC.state.calls[wk] = RC.state.calls[wk] || {}, e = W[k] = W[k] || {};
  e.slot = b.start; e.slotSrc = 'naver'; e.slotAt = new Date().toISOString();
  rcSaveState(); render();
  try { plToast('🕑 네이버 예약 시간 ' + b.start + ' 으로 바꿨어요'); } catch(err){}
};

/* ═══ A-2·4·5 배지 — 「시간 넣기」 없이 ═══ */
var _nbkRcBadge153 = nbkRcBadge;
nbkRcBadge = function(c, recDt, big){
  try { return rn153Badge(c, recDt, big); } catch(err){ return _nbkRcBadge153.apply(this, arguments); }
};
function rn153Badge(c, recDt, big){
  var b = rn153Book(c.k, recDt), e = c.e || {}, done = !!e.done, kq = rn153Q(rn153K(c.k));
  if (!b){
    if (done) return '';
    var cx = rn153Cancel(c.k, recDt);
    if (cx && e.slot && (e.slotSrc === 'naver' || (!e.slotSrc && e.slot === cx.start)))
      return '<span class="nbk-rcb rn153-cx" data-nbk-rc="cancel" title="네이버 예약이 취소됐어요 — 시간 칸은 그대로 두었습니다">⚠ 예약 취소됨 (' + rn153Q(e.slot) + ')</span>';
    return '<span class="nbk-rcb no" data-nbk-rc="no" title="' + rn153Q(rn153Md(recDt)) + ' 리커버리 네이버 예약이 아직 없어요">예약 아직</span>';
  }
  var t = b.start || '';
  var h = '<span class="nbk-rcb ok" data-nbk-rc="ok" title="네이버 예약 · ' + rn153Q(b.status && b.status.label) + '">✓ 네이버 예약 ' + rn153Q(t) + '</span>';
  if (big || done || !t) return h;
  if (e.slot && e.slotSrc === 'manual' && e.slot !== t){
    h += '<span class="nbk-rcb rn153-man" data-nbk-rc="manual">✋ 직접 ' + rn153Q(e.slot) + ' · ⚠ 예약과 다름</span>'
      + '<button type="button" class="nbk-rcslot warn" data-rn153-use="' + kq + '" title="직접 고른 시간 대신 네이버 예약 시간(' + rn153Q(t) + ')으로" onclick="rn153UseBook(this.getAttribute(\'data-rn153-use\'))">예약 시간으로</button>';
  } else if (e.slot === t && e.slotSrc === 'manual') h += '<span class="nbk-rcb rn153-man" data-nbk-rc="manual">✋ 직접</span>';
  else if (e.slot === t) h += '<span class="nbk-rcb rn153-auto" data-nbk-rc="auto" title="네이버 예약 시간이 자동으로 들어갔어요">⟳ 자동</span>';
  return h;
}

/* ═══ A-1·3 오른쪽 «확정 명단 · 시간 배분» ═══ */
function rn153MarkChips(h, T){
  return h.replace(/<button onclick="rcSetSlot\('([^']*)','([^']*)'\)" style="/g, function(m, k, t){
    var nv = !!(T && T.nv && T.nv[t]);
    return '<button class="rn153-chip' + (nv ? ' rn153-nv' : '') + '" data-rn153-k="' + k + '" data-rn153-slot="' + t + '"' + (nv ? ' title="네이버 예약에서 온 시간"' : '') + ' onclick="rcSetSlot(\'' + k + '\',\'' + t + '\')" style="';
  });
}
var _rcSidePanel153 = rcSidePanel;
rcSidePanel = function(conf, wk){
  try { rn153Sync(conf, wk); } catch(err){ try { console.error('[리커버리 자동 시간]', err); } catch(_){} }
  var keep = RC.cfg.slots, T = null, h;
  try { T = rn153Times(rcRecDate(wk)); RC.cfg.slots = T.list; } catch(err){ T = null; }
  try { h = _rcSidePanel153.apply(this, arguments); }
  finally { RC.cfg.slots = keep; }                                    /* 원장 설정은 그대로 */
  try {
    h = rn153MarkChips(h, T);
    h = h.replace('💡 시간대를 누르면 배정 — 안내문·출결 기록에 자동 반영', '💡 네이버 예약 시간이 자동으로 들어갑니다(⟳ · 점선 = 네이버 시간) · 직접 누르면 ✋ 직접으로 고정 — 안내문·학생앱·출결 기록에 반영');
  } catch(err){}
  return h;
};

/* ═══ C 통계 자료 (있는 것만 센다) ═══ */
/* 리커버리 날짜 «뒤» 첫 주간테스트 (고등은 v19-149 처럼 HIGH_TEST·단원 TEST 도) */
function rn153Next(k, dt){
  try {
    var st = rn153Stu(k); if (!st || typeof WK === 'undefined' || !WK.tests) return null;
    var sid = bpSidOf(st); if (sid == null) return null;
    var hi = /고/.test(String(st.grade || '')), best = null;
    WK.tests.forEach(function(t){
      if (t.type !== 'WEEKLY' && !(hi && (t.type === 'HIGH_TEST' || t.type === 'CHAPTER'))) return;
      var me = (t.students || []).find(function(x){ return String(x.sid) === String(sid) && x.score != null; }); if (!me) return;
      var took = String(me.date || t.date || ''); if (!took || took <= String(dt)) return;
      if (!best || took < best.date) best = { score:Number(me.score), date:took, title:t.title || '' };
    });
    return best;
  } catch(e){ return null; }
}
function rn153Why(e){
  var r = String(e.reason || e.why || '');
  if (r){ if (/직접|manual/i.test(r)) return '직접'; if (/둘|both/i.test(r)) return '둘 다'; if (/단원|unit/i.test(r)) return '단원'; if (/주간|테스트|test|week/i.test(r)) return '주간테스트'; }
  if (e.manual) return '직접';
  var s = e.snap || {}, hasT = s.score != null, hasU = !!(s.units && s.units.length);
  return hasT && hasU ? '둘 다' : (hasT ? '주간테스트' : (hasU ? '단원' : '기타'));
}
function rn153WsRate(ws){
  if (!ws) return null;
  if (ws.total && ws.correct != null) return { c:Number(ws.correct), t:Number(ws.total) };
  if (ws.rate != null && !isNaN(ws.rate)) return { c:Number(ws.rate), t:100 };
  return null;
}
function rn153Entries(){
  var calls = RC.state.calls || {}, out = [];
  Object.keys(calls).forEach(function(wk){
    var W = calls[wk] || {}, dt = String(rcRecDate(wk) || wk);
    Object.keys(W).forEach(function(k){
      var e = W[k]; if (!e || !(e.on || e.done)) return;
      var snap = e.snap || {}, st = rn153Stu(k);
      var sc = (snap.score != null && !isNaN(Number(snap.score))) ? Number(snap.score) : null;
      var nx = sc != null ? rn153Next(k, dt) : null;
      out.push({ wk:wk, dt:dt, ym:dt.slice(0, 7), k:k, nm:rcNameOf(k, e.snap), grade:rn153Grade(snap.grade || (st && st.grade) || ''), e:e,
        done:!!e.done, noshow:!!e.noshow && !e.done, ws:!!e.ws, wsr:rn153WsRate(e.ws), score:sc, next:nx,
        delta:(e.done && sc != null && nx) ? (nx.score - sc) : null, why:rn153Why(e) });
    });
  });
  out.sort(function(a, b){ return a.dt < b.dt ? -1 : (a.dt > b.dt ? 1 : 0); });
  return out;
}
function rn153Stats(force){
  var tick = (typeof L3B !== 'undefined' && L3B) ? L3B.tick : -1;
  if (!force && RN153.memo && RN153.memoTick === tick && tick >= 0) return RN153.memo;
  var E = rn153Entries(), nowYm = rn153NowYm(), months = [], by = {};
  for (var i = 5; i >= 0; i--){ var ym = rn153YmAdd(nowYm, -i); months.push(ym); by[ym] = { ym:ym, calls:0, done:0, noshow:0, ws:0, dSum:0, dN:0, up:0, wc:0, wt:0 }; }
  var G = {}, from6 = months[0];
  E.forEach(function(x){
    var m = by[x.ym]; if (!m) return;
    m.calls++; if (x.done) m.done++; if (x.noshow) m.noshow++; if (x.ws) m.ws++;
    if (x.wsr){ m.wc += x.wsr.c; m.wt += x.wsr.t; }
    if (x.delta != null){ m.dSum += x.delta; m.dN++; if (x.delta > 0) m.up++; }
    var g = G[x.grade] = G[x.grade] || { g:x.grade, calls:0, why:{} }; g.calls++; g.why[x.why] = (g.why[x.why] || 0) + 1;
  });
  months.forEach(function(ym){ var m = by[ym]; m.rate = m.calls ? Math.round(m.done / m.calls * 100) : null; m.avg = m.dN ? rn153R1(m.dSum / m.dN) : null; m.wsRate = m.wt ? Math.round(m.wc / m.wt * 100) : null; });
  var grades = Object.keys(G).map(function(k){ return G[k]; }).sort(function(a, b){ return rn153GradeRank(a.g) - rn153GradeRank(b.g); });
  /* 🔁 자주 오는 학생 — 최근 3개월 */
  var since3 = rn153Add(rn153Today(), -92), P = {};
  E.forEach(function(x){
    if (x.dt < since3) return;
    var p = P[x.k] = P[x.k] || { k:x.k, nm:x.nm, calls:0, done:0, noshow:0, scores:[], last:'' };
    p.nm = x.nm; p.calls++; if (x.done) p.done++; if (x.noshow) p.noshow++;
    if (x.score != null) p.scores.push(x.score);
    if (x.dt > p.last) p.last = x.dt;
  });
  var freq = Object.keys(P).map(function(k){
    var p = P[k], nx = rn153Next(k, p.last), seq = p.scores.slice();
    if (nx) seq.push(nx.score);
    var dir = seq.length >= 2 ? (seq[seq.length - 1] > seq[0] ? '↗' : (seq[seq.length - 1] < seq[0] ? '↘' : '→')) : '';
    p.flow = seq.length ? (seq.join(' → ') + '점' + (dir ? ' ' + dir : '')) : '';
    p.next = nx; p.signal = p.calls >= 3;
    return p;
  }).sort(function(a, b){ return ((b.signal ? 1 : 0) - (a.signal ? 1 : 0)) || (b.calls - a.calls) || String(a.nm).localeCompare(String(b.nm), 'ko'); });
  RN153.memo = { entries:E, months:months, by:by, cur:by[nowYm], nowYm:nowYm, grades:grades, freq:freq, freq3:freq.filter(function(p){ return p.signal; }), from6:from6 };
  RN153.memoTick = tick;
  return RN153.memo;
}

/* ═══ B 왼쪽 기둥 ═══ */
function rn153Sub(x){
  var r = x.row, bits = [];
  if (r && r.testHit){ var t = r.testHit; bits.push(((t.ttype && t.ttype !== 'WEEKLY') ? '테스트 ' : '주간 ') + ((t.correct != null && t.total) ? (t.correct + '/' + t.total) : (t.score + '점'))); }
  else if (x.score != null) bits.push('주간 ' + x.score + '점');
  else if (r && r.unitHits && r.unitHits.length) bits.push('단원 ' + r.unitHits[0].rate + '%');
  if (x.manual) bits.push('👋 직접');
  return bits.join(' · ');
}
/* 명단 오른쪽 — ✓HH:MM · ✋HH:MM ⚠ · 예약 아직 · 📄 · ✅/⛔ */
function rn153Right(x, dt, nbOk){
  var e = x.e || {};
  if (!e.on && !e.done) return '미정';
  var bits = [];
  if (e.done) bits.push('✅');
  else if (e.noshow) bits.push('⛔');
  else {
    var b = nbOk ? rn153Book(x.k, dt) : null;
    if (b){
      if (e.slot && e.slotSrc === 'manual' && e.slot !== b.start) bits.push('✋' + e.slot + ' ⚠');
      else if (e.slot && e.slotSrc === 'manual') bits.push('✋' + e.slot);
      else bits.push('✓' + (e.slot || b.start));
    } else if (nbOk){
      var cx = rn153Cancel(x.k, dt);
      if (cx && e.slot && (e.slotSrc === 'naver' || (!e.slotSrc && e.slot === cx.start))) bits.push('⚠ 취소 ' + e.slot);
      else bits.push((e.slot ? '✋' + e.slot + ' · ' : '') + '예약 아직');
    } else bits.push(e.slot || '시간 미정');
  }
  var ws = false; try { ws = !!rcwsMadeOf(x.k); } catch(err){}
  if (ws || e.ws) bits.push('📄');
  return bits.join(' · ');
}
function rn153Bars(S){
  var mx = 1; S.months.forEach(function(ym){ if (S.by[ym].calls > mx) mx = S.by[ym].calls; });
  var w = 120, hgt = 34, bw = 16, gap = (w - bw * 6) / 5, svg = '<svg class="rn153-bars" viewBox="0 0 ' + w + ' ' + (hgt + 11) + '" role="img" aria-label="최근 6개월 리커버리 호출 수" preserveAspectRatio="none">';
  S.months.forEach(function(ym, i){
    var c = S.by[ym].calls, bh = c ? Math.max(2, Math.round(c / mx * hgt)) : 1, x = Math.round(i * (bw + gap));
    svg += '<rect x="' + x + '" y="' + (hgt - bh) + '" width="' + bw + '" height="' + bh + '" rx="2" fill="#60a5fa" opacity="' + (ym === S.nowYm ? '1' : '.45') + '"><title>' + Number(ym.slice(5)) + '월 호출 ' + c + '명</title></rect>'
      + '<text x="' + (x + bw / 2) + '" y="' + (hgt + 9) + '" text-anchor="middle" font-size="7.5" fill="rgba(232,238,246,.55)">' + Number(ym.slice(5)) + '</text>';
  });
  return svg + '</svg>';
}
function rn153Num(v, k, cls, attr){ return '<div class="' + (cls || '') + '"' + (attr || '') + '><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }
function rn153Left(){
  var h = l3LeftHead('recovery');
  if (!RC.loaded){ try { rcLoad().then(function(){ if (VIEW === 'recovery') render(); }); } catch(e){}
    return h + '<div class="l3-sec" style="font-weight:700">불러오는 중…</div>' + l3CommonFold(); }
  try { nbkKick('recovery'); } catch(e){}
  var wk = rcWeekKey(), dt = rcRecDate(wk), nbOk = rn153NbkOk();
  var L = l3rList(), conf = L.filter(function(x){ return x.e && x.e.on; });
  var live = conf.filter(function(x){ return !x.e.done; });
  var booked = nbOk ? conf.filter(function(x){ return !!rn153Book(x.k, dt); }) : [];
  var noBook = nbOk ? live.filter(function(x){ return !rn153Book(x.k, dt); }) : [];
  var made = conf.filter(function(x){ var m = false; try { m = !!rcwsMadeOf(x.k); } catch(e){} return m || !!x.e.ws; });
  /* ① 이번 주 */
  h += '<div class="l3-sec" data-rn153-sec="week">🚑 이번 주 · ' + rn153Q(rn153Md(dt)) + '</div>';
  h += '<div class="rn153-num" data-rn153-week="1">'
    + rn153Num(conf.length, '확정', '', ' data-rn153-n="conf"')
    + rn153Num(nbOk ? booked.length : '—', '네이버 예약', 'ok', ' data-rn153-n="booked"')
    + rn153Num(nbOk ? noBook.length : '—', '예약 아직', 'warn', ' data-rn153-n="nobook"')
    + rn153Num(made.length, '학습지 만듦', '', ' data-rn153-n="ws"') + '</div>';
  /* ② 시간대별 인원 */
  var cnt = {}, none = 0, extra = [];
  live.forEach(function(x){ var s = x.e.slot; if (s){ cnt[s] = (cnt[s] || 0) + 1; extra.push(s); } else none++; });
  var T = rn153Times(dt, extra), anyT = false;
  T.list.forEach(function(t){
    if (!cnt[t]) return; anyT = true;
    h += '<div class="l3-lb rn153-static" data-rn153-time="' + rn153Q(t) + '"><span>' + rn153Clock(t) + ' ' + rn153Q(t) + (T.nv[t] ? ' <small style="display:inline">네이버</small>' : '') + '</span><span class="n">' + cnt[t] + '명</span></div>';
  });
  if (none) h += '<div class="l3-lb rn153-static l3r-dim" data-rn153-time="none"><span>시간 미정</span><span class="n">' + none + '명</span></div>';
  /* ③ 명단 */
  h += '<div class="l3-sec">명단 · 호출 ' + conf.length + ' · 미정 ' + (L.length - conf.length) + '</div>';
  if (!L.length) h += '<div class="l3-sec" style="font-weight:700;letter-spacing:0">지금 기준으로 선발·호출된 학생이 없습니다</div>';
  var mi = false;
  L.forEach(function(x){
    if (!x.e.on && !x.e.done && !mi){ mi = true; h += '<div class="l3-sec" style="padding-top:6px">예상 명단 · 미정</div>'; }
    var on = L3B.rcFocus === x.k, sub = rn153Sub(x);
    h += '<button type="button" class="l3-lb' + (on ? ' on' : '') + (x.e.on || x.e.done ? '' : ' l3r-dim') + '" data-l3r-stu="' + rn153Q(x.k) + '" onclick="l3rPick(this.getAttribute(\'data-l3r-stu\'))"><span>' + (x.e.on || x.e.done ? '🚑 ' : '') + rn153Q(x.name) + (sub ? '<small>' + rn153Q(sub) + '</small>' : '') + '</span><span class="n" data-rn153-right="' + rn153Q(x.k) + '">' + rn153Q(rn153Right(x, dt, nbOk)) + '</span></button>';
  });
  /* ④ 예약 안 한 학생 */
  if (noBook.length){
    var nm = noBook.slice(0, 3).map(function(x){ return x.name; }).join(' · ') + (noBook.length > 3 ? ' …' : '');
    h += '<div class="l3-sec">📨 예약 안 한 ' + noBook.length + '명</div>'
      + '<button type="button" class="l3-lb" data-rn153-nobook="' + noBook.length + '" onclick="rcOpenSms()"><span>' + rn153Q(nm) + '</span><span class="n">안내문 ›</span></button>';
  }
  /* ⑤ 통계 요약 */
  var S = rn153Stats(), C = S.cur;
  h += '<div class="l3-sec">📊 통계 · ' + Number(S.nowYm.slice(5)) + '월</div>';
  h += '<div class="rn153-num" data-rn153-month="' + S.nowYm + '">'
    + rn153Num(C.calls, '호출', '', ' data-rn153-n="calls"')
    + rn153Num(C.done, '출석' + (C.rate != null ? ' (' + C.rate + '%)' : ''), 'ok', ' data-rn153-n="done"')
    + rn153Num(C.noshow, '노쇼', 'bad', ' data-rn153-n="noshow"')
    + rn153Num(rn153Sign(C.avg), '다음 테스트 ' + (C.avg != null && C.avg < 0 ? '↓' : '↑'), C.avg != null && C.avg < 0 ? 'bad' : 'ok', ' data-rn153-n="delta"') + '</div>';
  h += '<div class="rn153-barbox" title="최근 6개월 호출">' + rn153Bars(S) + '</div>';
  if (S.freq3.length) h += '<button type="button" class="l3-lb" data-rn153-freq="' + S.freq3.length + '" onclick="rn153GoFreq()"><span>🔁 3회 이상 · ' + S.freq3.length + '명</span><span class="n">상담 신호 ›</span></button>';
  h += '<button type="button" class="l3-lb' + (RC.view === 'stats' ? ' on' : '') + '" data-rn153-stats="1" onclick="rcSetView(\'stats\')"><span>📊 통계 자세히</span><span class="n">›</span></button>';
  if (RC.view === 'stats') h += '<button type="button" class="l3-lb" onclick="rcSetView(\'board\')"><span>🚑 이번 주 보드로</span></button>';
  h += '<div class="l3-sec">📜 장부</div>' + l3rLedgerBox();
  /* ⑥ 기준 */
  var cf = RC.cfg || {};
  h += '<div class="l3-sec">⚙ 기준</div><div class="rn153-cfg" data-rn153-cfg="1">'
    + '<button type="button" onclick="rcEditCfg(\'score\')" title="중·고 주간테스트 기준 점수">주간 ' + rn153Q(cf.minScore) + '점</button>'
    + '<button type="button" onclick="rcEditCfg(\'unit\')" title="단원 정답률 기준">단원 ' + rn153Q(cf.minUnit) + '%</button>'
    + '<button type="button" onclick="rcEditCfg(\'elem6\')" title="초6 주간테스트 기준 점수">초6 ' + rn153Q(cf.elem6Score) + '점</button>'
    + (cf.range ? '<button type="button" onclick="rcOpenPeriod()" title="선발 기준 기간">🗓 기간</button>' : '<button type="button" onclick="rcEditCfg(\'weeks\')" title="최근 몇 주를 볼까요">' + rn153Q(cf.weeks) + '주</button>')
    + '</div>';
  return h + l3CommonFold();
}
var _l3rLeft153 = l3rLeft;
l3rLeft = function(){
  try { return rn153Left(); }
  catch(e){ try { console.error('[리커버리 왼쪽 기둥]', e); } catch(_){} return _l3rLeft153.apply(this, arguments); }
};
window.rn153GoFreq = function(){
  RC.view = 'stats'; render();
  try { l3bFlash('#rn153-freq'); } catch(e){ var el = document.getElementById('rn153-freq'); if (el && el.scrollIntoView) el.scrollIntoView(); }
};
window.rn153GoNbs = function(){
  VIEW = 'naverstats'; try { GRP = groupOfView('naverstats'); } catch(e){}
  try { if (typeof nbsKick === 'function') nbsKick('naverstats', true); } catch(e){}
  try { renderFuncTab(); } catch(e){ render(); }
};

/* ═══ C 가운데 📊 통계 화면 ═══ */
function rn153Card(l, v, sub, cls, attr){
  var bg = cls === 'b' ? '#eff6ff' : (cls === 'g' ? '#f0fdf4' : (cls === 'y' ? '#fffbeb' : (cls === 'r' ? '#fef2f2' : '#f8fafc')));
  var bd = cls === 'b' ? '#3b82f6' : (cls === 'g' ? '#22c55e' : (cls === 'y' ? '#f59e0b' : (cls === 'r' ? '#ef4444' : '#cbd5e1')));
  return '<div' + (attr || '') + ' style="flex:1;min-width:140px;background:' + bg + ';border-left:4px solid ' + bd + ';border-radius:13px;padding:12px 15px">'
    + '<div style="font-size:11px;color:#64748b;font-weight:800">' + l + '</div>'
    + '<div style="font-size:23px;font-weight:900;color:#0d2240;line-height:1.15;margin-top:2px;font-variant-numeric:tabular-nums">' + v + '</div>'
    + (sub ? '<div style="font-size:11.5px;color:#15803d;font-weight:800;margin-top:2px">' + sub + '</div>' : '') + '</div>';
}
function rn153DeltaTd(v){ var col = v == null ? '#94a3b8' : (v > 0 ? '#15803d' : (v < 0 ? '#b91c1c' : '#475569')); return '<td class="rn153-n" style="color:' + col + ';font-weight:900">' + rn153Sign(v) + '</td>'; }
function rn153StatsHtml(){
  var S = rn153Stats(), C = S.cur, h = '';
  var curDN = C.dN, curUp = C.up;
  h += '<div class="rn153-stats" data-rn153-statsview="1">';
  h += '<div style="font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:12px">숫자는 지금 있는 자료(리커버리 장부 · 주간테스트 · 학습지)로만 셉니다. 달은 리커버리 날짜 기준 · «다음 테스트»는 출석한 학생의 호출 때 점수 → 리커버리 날짜 뒤 첫 주간테스트.</div>';
  h += '<div style="display:flex;gap:11px;margin-bottom:16px;flex-wrap:wrap">';
  h += rn153Card('📞 ' + Number(S.nowYm.slice(5)) + '월 호출', C.calls + '<span style="font-size:12px;color:#94a3b8;font-weight:800"> 명</span>', '', 'b', ' data-rn153-kpi="calls"');
  h += rn153Card('✅ 출석률', C.rate != null ? C.rate + '%' : '—', C.calls ? (C.done + '/' + C.calls + '명') : '', 'g', ' data-rn153-kpi="rate"');
  h += rn153Card('⛔ 노쇼', C.noshow + '<span style="font-size:12px;color:#94a3b8;font-weight:800"> 명</span>', '', 'r', ' data-rn153-kpi="noshow"');
  h += rn153Card('📈 리커버리 뒤 다음 주간테스트', C.avg != null ? rn153Sign(C.avg) + '점' : '—', curDN ? (curDN + '명 중 ' + curUp + '명 올랐어요') : '아직 다음 테스트 기록이 없어요', 'y', ' data-rn153-kpi="delta"');
  h += rn153Card('🧩 학습지 정답률', C.wsRate != null ? C.wsRate + '%' : '—', C.wsRate != null ? '' : '<span style="color:#94a3b8">채점 기록 없음</span>', '', ' data-rn153-kpi="wsrate"');
  h += '</div>';
  /* ① 달별 6개월 */
  h += '<div class="rn153-box"><div class="rn153-bh">📅 달별 (최근 6개월)</div><div class="rn153-tw"><table class="rn153-t" data-rn153-table="months"><tr><th>달</th><th class="rn153-n">호출</th><th class="rn153-n">출석</th><th class="rn153-n">노쇼</th><th class="rn153-n">출석률</th><th class="rn153-n">학습지</th><th class="rn153-n">다음 테스트</th></tr>';
  S.months.slice().reverse().forEach(function(ym){
    var m = S.by[ym];
    h += '<tr data-rn153-ym="' + ym + '" data-calls="' + m.calls + '" data-done="' + m.done + '" data-noshow="' + m.noshow + '" data-ws="' + m.ws + '" data-avg="' + (m.avg == null ? '' : m.avg) + '"' + (ym === S.nowYm ? ' style="background:#f8fbff"' : '') + '>'
      + '<td style="font-weight:900;color:#0d2240">' + Number(ym.slice(5)) + '월' + (ym === S.nowYm ? ' <span style="font-size:10.5px;color:#1d6fe8">이번 달</span>' : '') + '</td>'
      + '<td class="rn153-n">' + m.calls + '</td><td class="rn153-n">' + m.done + '</td><td class="rn153-n">' + m.noshow + '</td>'
      + '<td class="rn153-n">' + (m.rate != null ? m.rate + '%' : '—') + '</td><td class="rn153-n">' + (m.ws || '—') + '</td>' + rn153DeltaTd(m.avg) + '</tr>';
  });
  h += '</table></div></div>';
  /* ② 학년 × 사유 · ③ 자주 오는 학생 */
  h += '<div class="rn153-two">';
  h += '<div class="rn153-box"><div class="rn153-bh">🎓 학년 · 사유 <span class="rn153-sub">(최근 6개월)</span></div>';
  if (!S.grades.length) h += '<div class="rn153-empty">아직 기록이 없어요</div>';
  else {
    h += '<table class="rn153-t" data-rn153-table="grades"><tr><th>학년</th><th class="rn153-n">호출</th><th>사유</th></tr>';
    var ORD = ['주간테스트', '단원', '둘 다', '직접', '기타'], SH = { '주간테스트':'주간', '단원':'단원', '둘 다':'둘 다', '직접':'직접', '기타':'기타' };
    S.grades.forEach(function(g){
      var why = ORD.filter(function(w){ return g.why[w]; }).map(function(w){ return SH[w] + ' ' + g.why[w]; }).join(' · ');
      h += '<tr data-rn153-grade="' + rn153Q(g.g) + '"><td style="font-weight:900;color:#0d2240;white-space:nowrap">' + rn153Q(g.g) + '</td><td class="rn153-n">' + g.calls + '</td><td>' + rn153Q(why) + '</td></tr>';
    });
    h += '</table>';
  }
  h += '</div>';
  h += '<div class="rn153-box" id="rn153-freq"><div class="rn153-bh">🔁 자주 오는 학생 <span class="rn153-sub">(최근 3개월 · 3회 이상 먼저)</span></div>';
  var F = S.freq.filter(function(p){ return p.calls >= 2; }).slice(0, 12);
  if (!F.length) h += '<div class="rn153-empty">3개월 동안 두 번 넘게 온 학생이 없어요</div>';
  else {
    h += '<table class="rn153-t" data-rn153-table="freq"><tr><th>학생</th><th class="rn153-n">호출</th><th class="rn153-n">출석</th><th>흐름</th></tr>';
    F.forEach(function(p){
      var flow = (p.flow || '—') + (p.noshow ? ' · 노쇼 ' + p.noshow : '');
      h += '<tr data-rn153-stu="' + rn153Q(p.k) + '"' + (p.signal ? ' style="background:#fff7ed"' : '') + '><td style="font-weight:900;color:#0d2240;white-space:nowrap">' + rn153Q(p.nm) + '</td><td class="rn153-n">' + p.calls + '</td><td class="rn153-n">' + p.done + '</td>'
        + '<td>' + rn153Q(flow) + (p.signal ? ' <span class="rn153-sig" title="같은 학생이 3번 넘게 오면 리커버리로는 모자란 신호 — 상담을 권해요">상담 권유</span>' : '') + '</td></tr>';
    });
    h += '</table>';
  }
  h += '<div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:8px">«흐름» = 호출 때 점수들 → 마지막 리커버리 뒤 첫 주간테스트. 3번 넘게 오면 리커버리로는 모자란 신호라 상담을 권합니다.</div>';
  h += '</div></div>';
  h += '<div class="rn153-nbs">요일×시간 열지도 · 학생별 월간 참여 · 학부모 카톡 글은 <b>📊 예약 통계</b>(v19-127)에 있어요.'
    + '<button type="button" onclick="rn153GoNbs()">📊 예약 통계 열기 ›</button></div>';
  h += '</div>';
  return h;
}
/* 탭 줄: 🚑 이번 주 보드 · 📒 운영 장부 · 📊 통계 */
var RN153_TABBAR = '<div style="display:inline-flex;background:#f1f5f9;border-radius:12px;padding:4px;gap:4px;margin-bottom:14px">';
function rn153Tabs(h){
  var i = h.indexOf(RN153_TABBAR); if (i < 0) return h;
  var j = h.indexOf('</div>', i); if (j < 0) return h;
  var tb = function(v, label){ var on = (RC.view === v); return '<button data-rn153-tab="' + v + '" onclick="rcSetView(\'' + v + '\')" style="border:none;font-family:inherit;font-size:14px;font-weight:900;padding:9px 18px;border-radius:10px;cursor:pointer;' + (on ? 'background:#0d2240;color:#fff' : 'background:transparent;color:#64748b') + '">' + label + '</button>'; };
  return h.slice(0, i) + RN153_TABBAR + tb('board', '🚑 이번 주 보드') + tb('ledger', '📒 운영 장부') + tb('stats', '📊 통계') + h.slice(j);
}
var _rRecovery153 = rRecovery;
rRecovery = function(){
  if (RC.view !== 'stats' || !RC.loaded) return rn153Tabs(_rRecovery153.apply(this, arguments));
  var keep = rcLedger, h;
  rcLedger = rn153StatsHtml; RC.view = 'ledger';                     /* 머리·탭은 바탕 그대로, 장부 자리에 통계를 그린다 */
  try { h = _rRecovery153.apply(this, arguments); }
  finally { RC.view = 'stats'; rcLedger = keep; }
  return rn153Tabs(h);
};

/* ═══ D-1 홈 — 리커버리 전날~당일 «예약 아직» ═══ */
function rn153HomeLine(){
  if (!rn153NbkOk()) return '';
  var today = rn153Today();
  if (!RC.loaded){
    var wk0 = rcWeekKey();
    if (!RN153.homeKick && rn153Add(wk0, -2) <= today && today <= wk0){
      RN153.homeKick = true;
      try { rcLoad().then(function(){ if (VIEW === 'home') render(); }); } catch(e){}
    }
    return '';
  }
  var wk = rcWeekKey(), dt = String(rcRecDate(wk));
  if (!(today >= rn153Add(dt, -1) && today <= dt)) return '';
  var miss = rcConfirmed().filter(function(c){ return c.e && !c.e.done && !rn153Book(c.k, dt); });
  if (!miss.length) return '';
  var names = miss.slice(0, 4).map(function(c){ return c.name; }).join(' · ') + (miss.length > 4 ? ' …' : '');
  return '<div class="rn153-home" data-rn153-home="' + miss.length + '"><span>🚑 ' + (today === dt ? '오늘' : '내일') + ' 리커버리 · 예약 아직 <b>' + miss.length + '명</b> — ' + rn153Q(names) + '</span>'
    + '<button type="button" onclick="rn153GoSms()">📨 안내문</button></div>';
}
window.rn153GoSms = function(){
  VIEW = 'recovery'; try { GRP = groupOfView('recovery'); } catch(e){}
  RC.view = 'board';
  try { renderFuncTab(); } catch(e){ render(); }
  rcLoad().then(function(){ try { rcOpenSms(); } catch(e){} });
};
if (typeof window.nbkHomeCard === 'function') window.nbkHomeCard = (function(o){
  return function(){
    var h = o.apply(this, arguments);
    try {
      if (!h) return h;
      var x = rn153HomeLine();
      if (x){ var i = h.lastIndexOf('</div>'); if (i > 0) h = h.slice(0, i) + x + h.slice(i); }
    } catch(e){ try { console.error('[리커버리 · 홈]', e); } catch(_){} }
    return h;
  };
})(window.nbkHomeCard);

/* ── 모양 ── */
(function(){
  if (document.getElementById('rn153-css')) return;
  var st = document.createElement('style'); st.id = 'rn153-css';
  st.textContent = ''
    /* A 칩·배지 */
    + '.rn153-chip.rn153-nv{border-style:dashed!important}'
    + '.rn153-chip.rn153-nv[style*="color:#94a3b8"]{border-color:#1d6fe8!important;color:#1d6fe8!important}'
    + '.rn153-chip.rn153-nv[style*="background:#1d6fe8"]{border-color:#bfdbfe!important}'
    + '.nbk-rcb.rn153-auto{background:#e8f0fd;color:#1d6fe8}.nbk-rcb.rn153-man{background:#fef3c7;color:#b45309}.nbk-rcb.rn153-cx{background:#fee2e2;color:#b91c1c}'
    /* B 왼쪽 기둥 (어두운 바탕) */
    + '.rn153-num{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:2px 10px 6px}'
    + '.rn153-num>div{background:rgba(255,255,255,.07);border-radius:9px;padding:6px 9px;min-width:0}'
    + '.rn153-num .v{font-size:17px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums;line-height:1.2}'
    + '.rn153-num .k{font-size:10.5px;color:rgba(232,238,246,.6);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.rn153-num .ok .v{color:#86efac}.rn153-num .warn .v{color:#fcd34d}.rn153-num .bad .v{color:#fca5a5}'
    + '.l3-lb.rn153-static{cursor:default;padding:7px 12px;font-size:13px}.l3-lb.rn153-static:hover{background:rgba(255,255,255,.07)}'
    + '.rn153-barbox{padding:2px 14px 6px}.rn153-bars{display:block;width:100%;height:46px}'
    + '.rn153-cfg{display:flex;flex-wrap:wrap;gap:5px;padding:2px 10px 6px}'
    + '.rn153-cfg button{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#e8eef6;border-radius:8px;padding:5px 9px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}'
    + '.rn153-cfg button:hover{background:rgba(255,255,255,.16)}.rn153-cfg button:focus-visible{outline:2px solid #fbbf24;outline-offset:1px}'
    /* C 통계 화면 */
    + '.rn153-box{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;min-width:0;margin-bottom:14px}'
    + '.rn153-bh{font-size:14px;font-weight:900;color:#0d2240;margin-bottom:8px}.rn153-sub{font-size:11px;color:#94a3b8;font-weight:700}'
    + '.rn153-tw{overflow-x:auto}.rn153-t{border-collapse:collapse;width:100%;font-size:12.5px}'
    + '.rn153-t th,.rn153-t td{padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}'
    + '.rn153-t th{color:#64748b;font-weight:800;font-size:11.5px}.rn153-t .rn153-n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}'
    + '.rn153-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.rn153-two{grid-template-columns:1fr}}'
    + '.rn153-empty{font-size:12.5px;color:#94a3b8;font-weight:700;padding:10px 2px}'
    + '.rn153-sig{display:inline-block;font-size:10.5px;font-weight:900;color:#b45309;background:#fef3c7;border-radius:20px;padding:1px 8px;margin-left:4px}'
    + '.rn153-nbs{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px;color:#475569;font-weight:700;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 13px}'
    + '.rn153-nbs button{margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:9px;padding:6px 12px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer}'
    /* D-1 홈 */
    + '.rn153-home{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:7px;font-size:12.5px;font-weight:800;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:6px 10px}'
    + '.rn153-home span{flex:1;min-width:0}.rn153-home button{flex:none;border:none;background:#ffd54a;color:#0d2240;border-radius:8px;padding:5px 10px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer}';
  (document.head || document.documentElement).appendChild(st);
})();
