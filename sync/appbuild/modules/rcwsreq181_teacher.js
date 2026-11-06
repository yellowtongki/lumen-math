/* ═══════════════════════════════════════════════════════════════════
 * v19-181: 🚑 리커버리 학습지 — «예약 → 서버가 천천히» (원장 2026-11-06 「내가 누른 후 바로 생성하지 말고 시간을 들여 하는 기능」 ·
 *          다른 세션 인계 docs/rcws_queue_handoff.md §3)
 *  [까닭] 원장 PC 브라우저가 매쓰플랫에 직접 쌍둥이 조회를 간격 없이 수백 번 불러 11/6 보안문자(CAPTCHA)에 막혔다.
 *         서버(sync/rcws_make.js --req --gap 3000)가 5분마다 lumen_store ws_make_req 를 보고 3초 간격으로 만든다.
 *  · 「⚡ 확정 전원 학습지 생성」 = 매쓰플랫을 직접 부르지 않고 ws_make_req = { status:'requested', wk, reqAt, by:'app' } 만 쓴다
 *    (supaSetItem → 설정 탭 GitHub 토큰이 있으면 서버를 바로 깨운다 · HTS_WAKE_KEYS 에 ws_make_req).
 *    이미 그 주가 requested/running 이면 다시 쓰지 않는다.
 *  · 진행률 띠(보드 맨 위 + 도구 「만들기」 칸): 서버가 적는 { status:'running'|'done'|'stopped', wk, total, done, items[], note,
 *    madeN, totalProblems, startedAt, finishedAt } 를 30초마다 읽는다(리커버리 화면일 때만 · 묻는 중이면 또 묻지 않는다).
 *    끝나면(done) 학습지 기록(rc_ws_made)을 다시 읽어 보드의 「학습지」 칸을 채운다.
 *  · 🧯 비상: 「이 PC 에서 바로 만들기」(옛 길, 매쓰플랫 계정 필요) 는 도구 칸 아래 작은 단추로 남긴다.
 *  · 🔐 계정 칸에는 「예약 방식은 계정이 필요 없어요(서버에 있음)」 한 줄.
 *  ※ 문자열 연결로만 HTML. ws_make_req 는 기기에 두지 않는다(PULL_SKIP_KEYS).
 * ═══════════════════════════════════════════════════════════════════ */
var RQ = { v: null, at: 0, busy: false, prevStatus: '' };
try { if (typeof PULL_SKIP_KEYS !== 'undefined' && PULL_SKIP_KEYS.indexOf('ws_make_req') < 0) PULL_SKIP_KEYS.push('ws_make_req'); } catch(e){}
try { if (typeof HTS_WAKE_KEYS !== 'undefined') HTS_WAKE_KEYS.ws_make_req = 1; } catch(e){}
function rqEsc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function rqHM(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : (('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }
function rqWk(){ try { return rcWeekKey(); } catch(e){ return ''; } }
/* 이번 주 요청만 본다 */
function rqCur(){ var v = RQ.v; if (!v || typeof v !== 'object') return null; if (v.wk && v.wk !== rqWk()) return null; return v; }
function rqActive(){ var v = rqCur(); return !!(v && (v.status === 'requested' || v.status === 'running')); }
function rqLoad(force){
  if (RQ.busy) return Promise.resolve(RQ.v);
  if (!force && RQ.at && Date.now() - RQ.at < 25000) return Promise.resolve(RQ.v);
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return Promise.resolve(RQ.v);
  RQ.busy = true;
  var qp; try { qp = sb.from('lumen_store').select('value').eq('key', 'ws_make_req'); } catch(e){ RQ.busy = false; RQ.at = Date.now(); return Promise.resolve(RQ.v); }
  return Promise.resolve(qp).then(function(r){
    RQ.busy = false; RQ.at = Date.now();
    var row = r && r.data; if (Array.isArray(row)) row = row[0] || null;
    var v = row ? row.value : null; if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e){ v = null; } }
    var was = RQ.prevStatus; RQ.v = v; var cur = rqCur(); RQ.prevStatus = cur ? cur.status : '';
    if (cur && cur.status === 'done' && was && was !== 'done') {   /* 방금 끝남 → 학습지 기록 다시 읽기 */
      try { var p = rcwsLoad(true); if (p && p.then) p.then(function(){ try { if (VIEW === 'recovery') render(); } catch(e){} }); } catch(e){}
      try { plToast('✅ 리커버리 학습지 ' + (cur.madeN != null ? cur.madeN : cur.done) + '명 완료' + (cur.totalProblems ? ' · ' + Number(cur.totalProblems).toLocaleString() + '문항' : '')); } catch(e){}
    }
    try { if (VIEW === 'recovery' && was !== RQ.prevStatus) render(); } catch(e){}
    return v;
  }, function(){ RQ.busy = false; RQ.at = Date.now(); return RQ.v; });
}
setInterval(function(){ try { if (VIEW === 'recovery' && !document.hidden) { var a = rqActive(); if (a || !RQ.at) rqLoad(false).then(function(){ try { if (VIEW === 'recovery' && rqActive()) rqPaint(); } catch(e){} }); } } catch(e){} }, 30000);

/* ── 띠 ── */
function rqBand(compact){
  var v = rqCur(); if (!v) return '';
  var st = v.status, total = Number(v.total) || 0, done = Number(v.done) || 0;
  var pct = total ? Math.round(done / total * 100) : 0;
  var bg = '#eff6ff', bd = '#93c5fd', fg = '#1e3a8a', msg = '';
  if (st === 'requested') msg = '⏳ 예약했습니다 · 5분 안에 서버가 시작해요' + (v.reqAt ? ' (예약 ' + rqHM(v.reqAt) + ')' : '') + ' · PC 를 꺼도 됩니다';
  else if (st === 'running') { var left = Math.max(1, (total - done) * 2); msg = '🛠 서버가 만드는 중 · ' + done + '/' + total + '명' + (total > done ? ' · 약 ' + left + '분 남음(쌍둥이 캐시가 차면 더 빨라요)' : ''); }
  else if (st === 'done') { var fin = v.finishedAt ? Date.parse(v.finishedAt) : 0; if (fin && Date.now() - fin > 36 * 3600000) return ''; bg = '#f0fdf4'; bd = '#86efac'; fg = '#14532d';
    msg = '✅ ' + (v.madeN != null ? v.madeN : done) + '명 완료' + (v.totalProblems ? ' · ' + Number(v.totalProblems).toLocaleString() + '문항' : '') + (v.finishedAt ? ' · ' + rqHM(v.finishedAt) : '') + ' · 매쓰플랫에 배정까지 끝' + (total && done < total ? ' · ' + (total - done) + '명은 못 만듦' : ''); }
  else if (st === 'stopped') { bg = '#fff7ed'; bd = '#fb923c'; fg = '#9a3412'; msg = '⚠ 멈췄어요 — ' + (v.note || '이유를 적지 않았어요') + ' · ' + done + '/' + total + '명 만듦'; }
  else return '';
  var h = '<div class="rq-band" data-rq="' + rqEsc(st) + '" style="border:2px solid ' + bd + ';background:' + bg + ';color:' + fg + ';border-radius:12px;padding:' + (compact ? '8px 10px' : '10px 14px') + ';margin:' + (compact ? '6px 0' : '0 0 12px') + ';font-size:' + (compact ? '11.5px' : '13px') + ';font-weight:800;line-height:1.5">'
    + '<div>' + rqEsc(msg) + '</div>';
  if (st === 'running' || (st === 'stopped' && total)) h += '<div style="height:7px;border-radius:4px;background:rgba(0,0,0,.08);overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:' + pct + '%;background:' + (st === 'stopped' ? '#f97316' : '#2563eb') + '"></i></div>';
  if (!compact && Array.isArray(v.items) && v.items.length && st !== 'requested') {
    var bad = v.items.filter(function(x){ return x && !x.ok; });
    if (bad.length) h += '<div style="margin-top:5px;font-size:11.5px;font-weight:700">못 만든 학생: ' + bad.slice(0, 8).map(function(x){ return rqEsc(x.name || x.key) + (x.why ? '(' + rqEsc(x.why) + ')' : ''); }).join(' · ') + (bad.length > 8 ? ' 외 ' + (bad.length - 8) + '명' : '') + '</div>';
  }
  if (st === 'stopped') h += '<button onclick="rcMakeWsAll()" style="margin-top:6px;border:none;background:#ea580c;color:#fff;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit">다시 예약</button>';
  return h + '</div>';
}
function rqPaint(){ try { render(); } catch(e){} }

/* ── 「⚡ 확정 전원 학습지 생성」 = 예약만 ── */
var _rq181Direct = (typeof rcMakeWsAll === 'function') ? rcMakeWsAll : null;
window.rqDirect = function(){   /* 🧯 비상: 옛 길(이 PC 에서 매쓰플랫 직접) */
  if (!_rq181Direct) return;
  if (!confirm('🧯 비상용 — 이 PC 에서 매쓰플랫을 직접 불러 바로 만듭니다.\n짧은 시간에 많이 부르면 매쓰플랫이 보안문자로 막을 수 있어요(11/6). 보통은 「⚡ 확정 전원 학습지 생성」(서버 예약)을 쓰세요.\n계속할까요?')) return;
  return _rq181Direct.apply(this, arguments);
};
rcMakeWsAll = function(){
  var wk = rqWk();
  return rqLoad(true).then(function(){
    var v = rqCur();
    if (v && (v.status === 'requested' || v.status === 'running')) { try { plToast('⏳ 이미 ' + (v.status === 'running' ? '서버가 만드는 중' : '예약됨') + ' — 띠에서 진행을 볼 수 있어요'); } catch(e){} try { render(); } catch(e){} return; }
    var n = 0; try { n = rcConfirmed().filter(function(c){ return !(c.e && c.e.done) && !rcwsMadeOf(c.k); }).length; } catch(e){}
    if (!confirm('이번 주(' + wk + ') 확정 학생 학습지를 서버에 예약합니다' + (n ? ' (아직 안 만든 ' + n + '명)' : '') + '.\n서버가 5분 안에 시작해 천천히(문항 사이 3초) 만들고 매쓰플랫에 배정까지 합니다.\nPC 를 꺼도 됩니다. 이미 만든 학생은 건너뜁니다. 예약할까요?')) return;
    var val = { status: 'requested', wk: wk, reqAt: new Date().toISOString(), by: 'app' };
    var p; try { p = supaSetItem('ws_make_req', val); } catch(e){ p = null; }
    RQ.v = val; RQ.at = Date.now(); RQ.prevStatus = 'requested';
    try { plToast('⏳ 예약했습니다 · 5분 안에 시작합니다'); } catch(e){}
    try { render(); } catch(e){}
    return p;
  });
};
window.rcMakeWsAll = rcMakeWsAll;

/* ── 도구 「만들기」 칸: 띠 + 버튼 글 + 비상 단추 ── */
if (typeof l3rMakeBox === 'function') l3rMakeBox = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (!RQ.at) rqLoad(false);
    var act = rqActive();
    if (act) h = h.replace(/<button type="button" class="l3-btn main" id="l3r-all"[^>]*>[\s\S]*?<\/button>/, '<button type="button" class="l3-btn main" id="l3r-all" disabled>⏳ 서버가 만드는 중</button>');
    var band = rqBand(true);
    var extra = band + '<span class="l3-sub" style="font-size:10.5px">⚡ = 서버 예약(천천히 · PC 꺼도 됨) · <a href="javascript:void(0)" onclick="rqDirect()" style="color:#94a3b8">🧯 비상: 이 PC 에서 바로</a></span>';
    var i = h.indexOf('<button type="button" class="l3-btn pri" id="l3r-pub"');
    h = i > 0 ? h.slice(0, i) + extra + h.slice(i) : h + extra;
  } catch(e){ try { console.error('[리커버리 예약 칸]', e); } catch(_){} }
  return h;
}; })(l3rMakeBox);

/* ── 🔐 계정 칸: 예약 방식은 계정이 필요 없음 ── */
if (typeof l3rAcctBox === 'function') l3rAcctBox = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try { h = h.replace('<b>🔐 매쓰플랫 계정</b>', '<b>🔐 매쓰플랫 계정</b><span class="l3-sub" style="color:#15803d">⚡ 서버 예약은 계정이 필요 없어요(서버에 있음) — 아래 칸은 🧯 비상용</span>'); } catch(e){}
  return h;
}; })(l3rAcctBox);

/* ── 보드 맨 위 띠 ── */
if (typeof rRecovery === 'function') rRecovery = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (typeof h !== 'string' || !RC || !RC.loaded || (RC.view && RC.view !== 'board')) return h;
    if (!RQ.at) rqLoad(false);
    var band = rqBand(false); if (!band) return h;
    var anchor = '<div style="padding:18px 22px 40px;max-width:1560px">';
    var k = h.indexOf(anchor);
    if (k >= 0) { var head = h.indexOf('🚑 리커버리 수업', k); var at = head > 0 ? h.indexOf('</button></div>', head) : -1;
      if (at > 0) h = h.slice(0, at + 15) + band + h.slice(at + 15); else h = h.slice(0, k + anchor.length) + band + h.slice(k + anchor.length); }
    else h = band + h;
  } catch(e){ try { console.error('[리커버리 예약 띠]', e); } catch(_){} }
  return h;
}; })(rRecovery);
