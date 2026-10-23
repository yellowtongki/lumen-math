/* ═══════════════════════════════════════════════════════════════════════
 * v19-154: 🚑 리커버리 「🔄 채점 새로고침」 (원장 2026-10-23 「매쓰플랫 채점결과가 바로 적용이 안된다 · 새로고침 단추 넣어줘」)
 *  까닭 두 가지
 *   ① 서버 수집은 하루 6번이지만 GitHub 가 2~5시간씩 미룬다 → 원장이 원할 때 수집을 바로 요청한다.
 *      울트라일일 「🔄 지금 가져오기」와 같은 길: lumen_store `mf_collect_req` {status:'requested'} 를 쓰면
 *      mathflat-ondemand.yml 이 수집기(주간테스트 mf_weekly 포함)를 돌린다. 설정 탭 GitHub 토큰이 있으면
 *      supaSetItem 감싸기(v19-99 HTS_WAKE_KEYS)가 바로 깨운다(1분 안 시작). 없으면 GitHub 예약을 기다린다.
 *   ② 보드 머리의 예전 「새로고침」은 rcLoad(true) 만 불러 rc_state 만 다시 읽고, 주간테스트(wkLoad)·진도(bpLoad)는
 *      한 번 읽은 것을 계속 썼다 → 서버가 새로 모아 와도 앱을 껐다 켜기 전엔 그대로였다. 이제 셋 다 + 네이버 예약을 다시 읽는다.
 *  보드 머리 아래 한 줄: «📡 채점 자료 마지막 수집 HH:MM (n분 전)» + 단추(요청됨/수집 중/완료 상태) + «다시 읽기».
 *  ※ 문자열 연결만. 바탕 함수는 감싸기만.
 * ═══════════════════════════════════════════════════════════════════════ */
var RC154 = { at: '', req: null, poll: null, loading: false, t: 0 };
var RC154_COOL_MIN = 10;
function rc154HM(iso){ try { var d = new Date(iso); if (isNaN(d)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch(e){ return ''; } }
function rc154Ago(iso){ var m = (Date.now() - Date.parse(iso)) / 60000; if (!(m >= 0)) return ''; if (m < 1) return '방금'; if (m < 60) return Math.round(m) + '분 전'; if (m < 60 * 24) return Math.floor(m / 60) + '시간 ' + (Math.round(m % 60) ? Math.round(m % 60) + '분 ' : '') + '전'; return Math.floor(m / 1440) + '일 전'; }
/* 서버에서 «마지막 수집 시각»(mf_weekly 가 마지막으로 바뀐 때)과 요청 상태를 읽는다 */
function rc154Meta(){
  var sb = null; try { sb = getSupaClient(); } catch(e){}
  if (!sb || RC154.loading) return Promise.resolve();
  RC154.loading = true;
  return sb.from('lumen_store').select('key,value,updated_at').in('key', ['mf_weekly', 'mf_collect_req']).then(function(r){
    RC154.loading = false; RC154.t = Date.now();
    ((r && r.data) || []).forEach(function(row){
      if (row.key === 'mf_weekly') RC154.at = row.updated_at || (row.value && row.value.updated) || RC154.at;
      if (row.key === 'mf_collect_req'){ var v = row.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } RC154.req = v || null; }
    });
  }, function(){ RC154.loading = false; RC154.t = Date.now(); });
}
function rc154State(){
  var q = RC154.req;
  if (!q || !q.status) return { k: 'idle' };
  if (q.status === 'requested') return { k: 'wait', q: q };
  if (q.status === 'running') return { k: 'run', q: q };
  if (q.status === 'done'){ var fin = Date.parse(q.finishedAt || q.reqAt || '') || 0, mins = (Date.now() - fin) / 60000; if (mins < RC154_COOL_MIN) return { k: 'cool', q: q, left: Math.max(1, Math.ceil(RC154_COOL_MIN - mins)) }; }
  return { k: 'idle', q: q };
}
/* 앱이 들고 있는 자료를 전부 다시 읽는다 (서버 수집 없이) */
window.rc154Reload = function(quiet){
  var jobs = [];
  try { if (typeof wkLoad === 'function') jobs.push(wkLoad(true)); } catch(e){}
  try { if (typeof bpLoad === 'function') jobs.push(bpLoad(true)); } catch(e){}
  try { if (typeof nbkLoad === 'function') jobs.push(nbkLoad(true)); } catch(e){}
  jobs.push(rc154Meta());
  return Promise.all(jobs.map(function(p){ return Promise.resolve(p).catch(function(){}); }))
    .then(function(){ return rcLoad(true); })
    .then(function(){ try { render(); } catch(e){} if (!quiet) plToast('🔄 채점·예약 자료를 다시 읽었어요' + (RC154.at ? ' (마지막 수집 ' + rc154HM(RC154.at) + ')' : '')); });
};
/* 서버 수집 요청 */
window.rc154Fetch = function(){
  var st = rc154State();
  if (st.k === 'wait' || st.k === 'run' || st.k === 'cool') return;
  var tok = ''; try { tok = (typeof htsGhToken === 'function') ? htsGhToken() : ''; } catch(e){}
  var msg = '🔄 채점 새로고침\n\n매쓰플랫 채점 기록과 주간테스트 점수를 지금 서버에서 새로 모읍니다.\n\n'
    + (tok ? '· 설정의 GitHub 토큰으로 서버를 바로 깨웁니다 (1분 안 시작 · 다 모으는 데 10~20분)\n'
           : '· 설정 탭에 GitHub 토큰이 없어 서버가 요청을 확인할 때까지 기다립니다 (몇 시간 걸릴 수 있어요)\n')
    + '· 끝나면 이 화면이 저절로 새 점수로 바뀝니다\n· 학습지·확정 명단은 바뀌지 않습니다\n\n지금 요청할까요?';
  if (!confirm(msg)) return;
  var d = new Date(), iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  var req = { status: 'requested', date: iso, reqAt: new Date().toISOString(), by: 'recovery' };
  Promise.resolve(supaSetItem('mf_collect_req', req)).then(function(ok){
    if (!ok){ plToast('요청 저장 실패 — 네트워크를 확인해 주세요'); return; }
    RC154.req = req; rc154Poll(); try { render(); } catch(e){}
    plToast(tok ? '🔄 요청했습니다 — 서버를 깨웠어요' : '🔄 요청했습니다 — 서버가 확인하면 시작돼요');
  });
};
window.rc154Cancel = function(){
  if (!RC154.req) return;
  if (RC154.req.status === 'running'){ alert('이미 수집이 시작되어 취소할 수 없습니다. 곧 끝납니다.'); return; }
  if (!confirm('채점 새로고침 요청을 취소할까요?')) return;
  Promise.resolve(supaSetItem('mf_collect_req', Object.assign({}, RC154.req, { status: 'cancelled', cancelledAt: new Date().toISOString() }))).then(function(){ RC154.req = null; try { render(); } catch(e){} plToast('요청을 취소했습니다'); });
};
function rc154Poll(){
  if (RC154.poll) return;
  RC154.poll = setInterval(function(){
    var before = RC154.req && RC154.req.status;
    rc154Meta().then(function(){
      var st = rc154State();
      if (st.k === 'cool' || (RC154.req && RC154.req.status === 'done' && before !== 'done')){
        clearInterval(RC154.poll); RC154.poll = null;
        plToast('✅ 수집 완료 — 새 점수를 불러옵니다');
        rc154Reload(true);
        return;
      }
      if (st.k !== 'wait' && st.k !== 'run'){ clearInterval(RC154.poll); RC154.poll = null; }
      try { if (VIEW === 'recovery') render(); } catch(e){}
    });
  }, 30000);
}
function rc154Bar(){
  if (!RC154.t || Date.now() - RC154.t > 120000) rc154Meta().then(function(){ try { if (VIEW === 'recovery') render(); } catch(e){} });
  var st = rc154State(); if (st.k === 'wait' || st.k === 'run') rc154Poll();
  var lastTxt = RC154.at ? ('마지막 수집 <b>' + rc154HM(RC154.at) + '</b> <span style="color:#94a3b8">(' + rc154Ago(RC154.at) + ')</span>') : '마지막 수집 확인 중…';
  var btn, base = 'border:none;font-family:inherit;font-size:12.5px;font-weight:900;padding:8px 14px;border-radius:10px;';
  if (st.k === 'wait' || st.k === 'run'){
    btn = '<button type="button" id="rc154-btn" data-rc154="' + st.k + '" onclick="rc154Cancel()" style="' + base + 'cursor:pointer;background:#475569;color:#fff">'
      + (st.k === 'wait' ? '⏳ 요청됨 · 곧 시작' : '🔄 수집 중…') + ' <span style="font-size:10.5px;opacity:.85">' + (st.k === 'wait' ? ('요청 ' + rc154HM(st.q.reqAt) + ' · 누르면 취소') : esc2(st.q.note || '10~20분')) + '</span></button>';
  } else if (st.k === 'cool'){
    btn = '<button type="button" id="rc154-btn" data-rc154="cool" disabled style="' + base + 'cursor:default;background:#94a3b8;color:#fff">🕓 방금 모음 <span style="font-size:10.5px;opacity:.85">' + st.left + '분 후 다시 가능</span></button>';
  } else {
    btn = '<button type="button" id="rc154-btn" data-rc154="idle" onclick="rc154Fetch()" title="매쓰플랫 채점·주간테스트 점수를 서버에서 지금 새로 모읍니다" style="' + base + 'cursor:pointer;background:linear-gradient(135deg,#dc2626,#f43f5e);color:#fff;box-shadow:0 4px 12px rgba(220,38,38,.3)">🔄 채점 새로고침</button>';
  }
  return '<div id="rc154-bar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:8px 12px;margin:0 0 12px;font-size:12.5px;font-weight:700;color:#7c2d12">'
    + '<span>📡 매쓰플랫 채점 자료 · ' + lastTxt + '</span>'
    + '<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
    + '<button type="button" id="rc154-reload" onclick="rc154Reload()" title="서버에 이미 모인 자료를 앱이 다시 읽습니다 (몇 초)" style="border:1.5px solid #fdba74;background:#fff;color:#9a3412;font-family:inherit;font-size:12px;font-weight:800;padding:7px 11px;border-radius:10px;cursor:pointer">↻ 다시 읽기</button>'
    + btn + '</span></div>';
}
var RC154_TABBAR = '<div style="display:inline-flex;background:#f1f5f9;border-radius:12px;padding:4px;gap:4px;margin-bottom:14px">';
var _rRecovery154 = rRecovery;
rRecovery = function(){
  var h = _rRecovery154.apply(this, arguments);
  try {
    if (!RC.loaded) return h;
    h = h.split('rcLoad(true).then(function(){render()})').join('rc154Reload()');   /* 머리의 옛 새로고침도 전부 다시 읽기로 */
    var i = h.indexOf(RC154_TABBAR);
    if (i >= 0) h = h.slice(0, i) + rc154Bar() + h.slice(i);
  } catch(e){}
  return h;
};
