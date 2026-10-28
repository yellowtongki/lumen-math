/* ═══════════════════════════════════════════════════════════════════
 * v19-169: 📄 오답 쌍둥이 숙제 — 진도·리포트 › 오답 쌍둥이 (원장 2026-10-28 「월수금은 금요일 · 화목토는 토요일
 *   오답 프린트 숙제를 자동으로 · 오답 쌍둥이 · 문제 제한 없음 · 매쓰플랫 숙제 태그 · 처음은 10월부터(시험범위) · 중3 제외 ·
 *   새벽 5시 · 많으면 나눠서 · 다시 맞힌 문제는 뺌 · 리커버리와 겹쳐도 둘 다」)
 *  계약서 docs/wrong_twin_contract.md · 시안 docs/mockup_wrong_twin.html · 서버 sync/wrongtwin_make.js · 예약 wrongtwin.yml(금·토 05:00)
 *  읽기: lumen_store wt_config · wt_scope · wt_state · wt_preview · wt_log · wt_req · lumen_group_days (모두 서버에서 바로, 기기에 안 둠)
 *  쓰기: wt_config(자동 켜고 끄기 · 이번엔 건너뛰기 skip[코드]=다음 출제일) · wt_scope(시험범위 단원) · wt_req(다시 계산 · 지금 출제)
 *  화면: 다음 출제(금·토) · 규칙 · 탭 «금요일 반 / 토요일 반 / 지난 출제 / 시험범위» · 학생 줄(새 오답 · 출처 · 다시 맞힘 · 범위 밖 · 쌍둥이 수 · 장수 · 마지막 출제)
 *  ※ 문자열 연결로만 쓴다. 서버 질문은 «묻는 중이면 또 묻지 않기»(v19-168 리커버리 멈춤 교훈).
 * ═══════════════════════════════════════════════════════════════════ */
var WT = { loaded: false, loading: false, t: 0, tab: '', cfg: null, scope: null, state: null, pv: null, log: null, req: null, days: null, open: '', busy: false };
var WT_KEYS = { wt_config: 'cfg', wt_scope: 'scope', wt_state: 'state', wt_preview: 'pv', wt_log: 'log', wt_req: 'req', lumen_group_days: 'days' };
function wtE(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function wtJs(s){ return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function wtTwo(n){ return (n < 10 ? '0' : '') + n; }
function wtYmd(d){ return d.getFullYear() + '-' + wtTwo(d.getMonth() + 1) + '-' + wtTwo(d.getDate()); }
function wtMd(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : (d.getMonth() + 1) + '/' + d.getDate(); }
function wtWhen(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' (' + '일월화수목금토'.charAt(d.getDay()) + ') ' + wtTwo(d.getHours()) + ':' + wtTwo(d.getMinutes()); }
function wtGk(g){ var m = String(g || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? m[1] + m[2] : ''; }
function wtShortSchool(s){ return String(s || '').trim().replace(/등학교$|학교$/, ''); }
function wtScopeKey(st){ return wtShortSchool(st.school) + '|' + wtGk(st.grade); }
function wtCfg(){ return Object.assign({ on: true, start: '2026-10-01', chunk: 60, maxPer: 60, excludeGrades: ['중3'], skip: {} }, WT.cfg || {}); }
/* 반 → 금(fri) / 토(sat) : 금요일 수업이 있는 반은 금요일, 그 밖의 수업 반은 토요일 (서버와 같은 규칙) */
function wtBatchOf(g){ var d = (WT.days || {})[String(g || '').trim()]; if (!Array.isArray(d) || !d.length) return ''; return d.indexOf(5) >= 0 ? 'fri' : 'sat'; }
/* 다음 출제 시각 (그 요일 05:00) */
function wtNext(batch){ var want = batch === 'fri' ? 5 : 6, d = new Date(); d.setHours(5, 0, 0, 0); for (var i = 0; i < 8; i++){ if (d.getDay() === want && d.getTime() > Date.now() - 4 * 3600000) return d; d.setDate(d.getDate() + 1); } return d; }
function wtStudents(){
  var ex = wtCfg().excludeGrades || [];
  return (typeof students !== 'undefined' ? students : []).filter(function(s){ return s && !s.withdrawn && s.lumen_rec_code && ex.indexOf(wtGk(s.grade)) < 0; });
}
function wtLoad(force){
  if (WT.loading) return;   /* ★ 묻는 중이면 또 묻지 않는다 */
  if (WT.loaded && !force && Date.now() - WT.t < 60000) return;
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return;
  WT.loading = true;
  sb.from('lumen_store').select('key,value,updated_at').in('key', Object.keys(WT_KEYS)).then(function(r){
    WT.loading = false; WT.loaded = true; WT.t = Date.now();
    ((r && r.data) || []).forEach(function(x){ var v = x.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } WT[WT_KEYS[x.key]] = v; });
    try { if (VIEW === 'wtwin') render(); } catch(e){}
  }, function(){ WT.loading = false; WT.loaded = true; WT.t = Date.now(); });
}
window.wtTab = function(t){ WT.tab = t; WT.open = ''; render(); };
window.wtOpen = function(c){ WT.open = WT.open === c ? '' : c; render(); };
window.wtReload = function(){ wtLoad(true); try { plToast('↻ 다시 읽는 중…'); } catch(e){} };
function wtSave(key, val, msg){
  WT.busy = true; render();
  return Promise.resolve(supaSetItem(key, val)).then(function(ok){ WT.busy = false; if (ok === false){ alert('서버 저장 실패 — 인터넷 연결을 확인하세요'); } else { try { plToast(msg || '저장했습니다'); } catch(e){} } WT.t = 0; wtLoad(true); render(); });
}
window.wtToggleOn = function(){ var c = wtCfg(); c.on = !c.on; WT.cfg = c; wtSave('wt_config', c, c.on ? '✅ 자동 출제 켬 (금·토 새벽 5시)' : '⏸ 자동 출제 끔'); };
window.wtSkip = function(code, batch, on){ var c = wtCfg(); c.skip = Object.assign({}, c.skip || {}); if (on) c.skip[code] = wtYmd(wtNext(batch)); else delete c.skip[code]; WT.cfg = c; wtSave('wt_config', c, on ? '이번 출제에서 건너뜁니다' : '이번 출제에 넣습니다'); };
window.wtRequest = function(batch, dry){
  var r = WT.req; if (r && (r.status === 'requested' || r.status === 'running')){ alert('이미 요청이 처리 중입니다 — 잠시 뒤 «↻ 다시 읽기»'); return; }
  var lab = batch === 'fri' ? '금요일 반(월수금)' : batch === 'sat' ? '토요일 반(화목토)' : '전체';
  if (!dry && !confirm(lab + ' 오답 쌍둥이를 지금 매쓰플랫에 «숙제»로 만들어 배정할까요?\n(건너뛰기로 표시한 학생은 빠집니다 · 몇 분 걸립니다)')) return;
  var q = { status: 'requested', batch: batch, dry: !!dry, only: [], at: new Date().toISOString(), by: 'teacher' };
  WT.req = q; wtSave('wt_req', q, dry ? '👁 다시 계산을 요청했습니다' : '📤 출제를 요청했습니다').then(function(){ try { if (typeof htsWake === 'function') htsWake('오답 쌍둥이'); } catch(e){} });
};
/* 시험범위 저장 */
window.wtScopeSave = function(k){
  var el = document.getElementById('wt-mids-' + k.replace(/[^가-힣A-Za-z0-9]/g, '_')); if (!el) return;
  var sc = JSON.parse(JSON.stringify(WT.scope || { byKey: {} })); sc.byKey = sc.byKey || {};
  var e = sc.byKey[k] || {}; e.mids = el.value.split(/[,，\n]/).map(function(x){ return x.trim(); }).filter(Boolean); e.upd = new Date().toISOString(); sc.byKey[k] = e;
  WT.scope = sc; wtSave('wt_scope', sc, '시험범위를 저장했습니다 — 다음 출제부터');
};
window.wtScopeDel = function(k){ if (!confirm(k + ' 시험범위를 지울까요? (지우면 그 학생들은 10/1 이후 오답 전부)')) return; var sc = JSON.parse(JSON.stringify(WT.scope || { byKey: {} })); delete sc.byKey[k]; WT.scope = sc; wtSave('wt_scope', sc, '시험범위를 지웠습니다'); };
window.wtScopeAdd = function(){ var k = prompt('학교|학년 (예: 범박중|중2)'); if (!k || k.indexOf('|') < 0) return; var sc = JSON.parse(JSON.stringify(WT.scope || { byKey: {} })); sc.byKey = sc.byKey || {}; if (!sc.byKey[k]) sc.byKey[k] = { exam: '2학기 기말', mids: [], src: '원장님이 추가' }; WT.scope = sc; wtSave('wt_scope', sc, k + ' 추가 — 단원을 적고 저장하세요'); };

var WT_CSS = '.wt{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:12px;font-size:14px}'
  + '.wt-top{background:#0d2240;color:#fff;border-radius:16px;padding:14px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}.wt-top h2{margin:0;font-size:21px;font-weight:900}.wt-top .s{color:#cbd5e1;font-size:12.5px;font-weight:700}'
  + '.wt-top .sw{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
  + '.wt-b{font:inherit;font-weight:900;font-size:13px;border-radius:10px;padding:7px 12px;border:1.5px solid #e2e8f0;background:#fff;color:#0f172a;cursor:pointer}.wt-b.pri{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.wt-b.gh{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}.wt-b:disabled{opacity:.5;cursor:default}'
  + '.wt-tog{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:0;color:#fff;border-radius:10px;padding:6px 11px;font:inherit;font-weight:900;font-size:13px;cursor:pointer}.wt-tog i{width:34px;height:20px;border-radius:10px;background:#64748b;position:relative}.wt-tog i:after{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff}.wt-tog.on i{background:#22c55e}.wt-tog.on i:after{left:auto;right:2px}'
  + '.wt-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.wt-nx{background:#fff;border:1.5px solid #bfdbfe;border-radius:14px;padding:11px 14px}.wt-nx.sat{border-color:#fde68a}.wt-nx .d{font-size:21px;font-weight:900}.wt-nx .n{font-size:12.5px;color:#5f6b80;font-weight:700}.wt-nx .n b{color:#0f172a;font-size:15px}'
  + '.wt-chip{display:inline-block;font-size:11.5px;font-weight:900;border-radius:7px;padding:1px 7px;background:#eef4ff;color:#1d4ed8;margin:2px 3px 0 0}.wt-nx.sat .wt-chip{background:#fff7e6;color:#b45309}'
  + '.wt-rule{background:#fff;border:1.5px solid #e3e7ee;border-radius:14px;padding:10px 14px;display:flex;flex-wrap:wrap;gap:6px}.wt-rule span{background:#f3f5f9;border:1px solid #e3e7ee;border-radius:9px;padding:4px 9px;font-weight:700;font-size:12.5px}.wt-rule b{color:#1d4ed8}'
  + '.wt-req{background:#fff7e6;border:1.5px solid #fcd34d;border-radius:12px;padding:8px 12px;font-weight:800;color:#92400e;font-size:13px}.wt-req.ok{background:#effdf4;border-color:#bbf7d0;color:#15803d}.wt-req.err{background:#fdecec;border-color:#fca5a5;color:#c81e1e}'
  + '.wt-tabs{display:flex;gap:6px;flex-wrap:wrap}.wt-tab{font:inherit;font-weight:900;font-size:13.5px;border-radius:10px;padding:7px 14px;border:1.5px solid #e3e7ee;background:#fff;color:#5f6b80;cursor:pointer}.wt-tab.on{background:#0d2240;border-color:#0d2240;color:#fff}'
  + '.wt-tbl{background:#fff;border:1.5px solid #e3e7ee;border-radius:14px;overflow:hidden}'
  + '.wt-row{display:grid;grid-template-columns:30px minmax(110px,1.3fr) 60px repeat(3,minmax(44px,.5fr)) 62px 62px 84px minmax(140px,1.2fr);gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #eef1f5;font-weight:700}'
  + '.wt-row.h{border-top:0;background:#f3f5f9;font-size:11.5px;color:#5f6b80;font-weight:900}.wt-row.skip{opacity:.55}.wt-row .nm{cursor:pointer}.wt-row .nm b{font-size:14.5px}.wt-row .nm small{display:block;font-size:11.5px;color:#5f6b80}'
  + '.wt-num{text-align:right;font-variant-numeric:tabular-nums}.wt-big{font-size:18px;font-weight:900;color:#1d4ed8;text-align:right}.wt-fix{color:#15803d;text-align:right;font-size:12.5px}.wt-out{color:#94a3b8;text-align:right;font-size:12.5px}'
  + '.wt-st{font-size:12px;font-weight:900;border-radius:7px;padding:2px 8px;display:inline-block}.wt-st.w{background:#eef4ff;color:#1d4ed8}.wt-st.d{background:#effdf4;color:#15803d}.wt-st.x{background:#f3f5f9;color:#5f6b80}.wt-st.e{background:#fdecec;color:#c81e1e}'
  + '.wt-det{padding:8px 14px 12px 50px;border-top:1px dashed #e3e7ee;background:#fafbfd;font-size:12.5px;font-weight:700;color:#475569;line-height:1.8}'
  + '.wt-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:9px 12px;border-top:1px solid #e3e7ee;background:#f3f5f9;font-weight:800;font-size:13px}'
  + '.wt-card{background:#fff;border:1.5px solid #e3e7ee;border-radius:14px;padding:12px 14px}.wt-card h3{margin:0 0 8px;font-size:15px}'
  + '.wt-sc{border-top:1px solid #eef1f5;padding:9px 0;display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:10px;align-items:start}.wt-sc:first-of-type{border-top:0}.wt-sc textarea{width:100%;min-height:42px;font:inherit;font-size:13px;border:1.5px solid #e3e7ee;border-radius:9px;padding:6px 8px;box-sizing:border-box}'
  + '.wt-sc small{display:block;color:#5f6b80;font-weight:700;font-size:11.5px}'
  + '.wt-lg{display:grid;grid-template-columns:150px 90px minmax(0,1fr) 90px;gap:8px;padding:6px 0;border-top:1px solid #eef1f5;font-weight:700;font-size:13px}.wt-lg:first-of-type{border-top:0}'
  + '@media(max-width:860px){.wt-g2{grid-template-columns:minmax(0,1fr)}.wt-row{grid-template-columns:26px minmax(0,1fr) 56px 76px;row-gap:3px}.wt-row .hx{display:none}.wt-sc{grid-template-columns:minmax(0,1fr)}.wt-lg{grid-template-columns:minmax(0,1fr) 80px}.wt-lg .hx{display:none}}';

function wtReqLine(){
  var r = WT.req; if (!r || !r.status) return '';
  var lab = (r.dry ? '👁 다시 계산' : '📤 출제') + ' · ' + (r.batch === 'fri' ? '금요일 반' : r.batch === 'sat' ? '토요일 반' : '전체');
  if (r.status === 'requested') return '<div class="wt-req">⏳ ' + lab + ' 요청 대기 중 (' + wtWhen(r.at) + ') — 서버가 받으면 몇 분 안에 끝납니다 · <button type="button" class="wt-b" onclick="wtReload()">↻ 다시 읽기</button></div>';
  if (r.status === 'running') return '<div class="wt-req">⚙ ' + lab + ' 진행 중 (' + wtWhen(r.startedAt) + ' 시작) · <button type="button" class="wt-b" onclick="wtReload()">↻ 다시 읽기</button></div>';
  if (r.status === 'error') return '<div class="wt-req err">⚠ ' + lab + ' 실패 (' + wtWhen(r.doneAt) + ') ' + wtE(r.error || '') + '</div>';
  if (r.doneAt && Date.now() - Date.parse(r.doneAt) < 6 * 3600000) return '<div class="wt-req ok">✅ ' + lab + ' 끝 (' + wtWhen(r.doneAt) + ')</div>';
  return '';
}
function wtTable(batch){
  var cfg = wtCfg(), pv = WT.pv || { rows: [] }, by = {}; (pv.rows || []).forEach(function(r){ by[r.code] = r; });
  var st = (WT.state && WT.state.byCode) || {}, nextD = wtYmd(wtNext(batch));
  var list = wtStudents().filter(function(s){ return wtBatchOf(s.group) === batch; }).sort(function(a, b){ return String(a.group || '').localeCompare(String(b.group || ''), 'ko') || String(a.name || '').localeCompare(String(b.name || ''), 'ko'); });
  var h = '<div class="wt-tbl"><div class="wt-row h"><span></span><span>학생</span><span class="hx">반</span><span class="wt-num hx">학습지</span><span class="wt-num hx">교재</span><span class="wt-num hx">주간T</span><span class="wt-fix hx">다시 맞힘</span><span class="wt-out hx">범위 밖</span><span class="wt-big" style="font-size:11.5px">만들 쌍둥이</span><span>상태</span></div>';
  var nOn = 0, nP = 0, nS = 0;
  list.forEach(function(s){
    var c = s.lumen_rec_code, r = by[c] || null, sk = !!(cfg.skip && cfg.skip[c] && cfg.skip[c] >= wtYmd(new Date())), my = st[c] || {}, last = (my.runs || []).slice(-1)[0];
    var bs = (r && r.bySrc) || {}, n = r ? (r.n != null ? r.n : r.nWrong) : null;
    if (!sk){ nOn++; nP += n || 0; nS += (r && r.sheets) || (n ? Math.ceil(n / (cfg.chunk || 50)) : 0); }
    var stt = r && r.err ? '<span class="wt-st e">' + wtE(r.err) + '</span>' : sk ? '<span class="wt-st x">이번엔 건너뜀</span>' : !r ? '<span class="wt-st x">계산 전</span>' : (n === 0 ? '<span class="wt-st d">새 오답 없음</span>' : '<span class="wt-st w">' + (((r.sheets || 1) > 1) ? r.sheets + '장으로 나눔' : '대기') + '</span>' + (r.carry ? ' <span class="wt-st x">다음 주로 ' + r.carry + '</span>' : ''));
    h += '<div class="wt-row' + (sk ? ' skip' : '') + '"><input type="checkbox" ' + (sk ? '' : 'checked ') + 'aria-label="' + wtE(s.name) + ' 출제" onchange="wtSkip(\'' + wtJs(c) + '\',\'' + batch + '\',!this.checked)">'
      + '<span class="nm" onclick="wtOpen(\'' + wtJs(c) + '\')"><b>' + wtE(s.name) + (WT.open === c ? ' ▴' : ' ▾') + '</b><small>' + wtE(wtGk(s.grade)) + ' · ' + (r && r.scope ? '범위 ' + wtE(r.scope.split('|')[0]) : '범위 없음 → 전부') + '</small></span>'
      + '<span class="hx">' + wtE(s.group || '') + '</span><span class="wt-num hx">' + (r ? bs.ws || 0 : '–') + '</span><span class="wt-num hx">' + (r ? bs.book || 0 : '–') + '</span><span class="wt-num hx">' + (r ? bs.test || 0 : '–') + '</span>'
      + '<span class="wt-fix hx">' + (r && r.fixed ? '−' + r.fixed : '0') + '</span><span class="wt-out hx">' + (r && r.outScope ? r.outScope : '') + '</span>'
      + '<span class="wt-big"' + (sk ? ' style="color:#94a3b8"' : '') + '>' + (n == null ? '–' : n) + '</span><span>' + stt + '</span></div>';
    if (WT.open === c){
      h += '<div class="wt-det">';
      if (r) h += '계산 ' + wtWhen(r.at) + (r.dry ? ' (설계만)' : '') + ' · 아직 틀린 새 문제 ' + (r.nWrong || 0) + ' → 쌍둥이 ' + (r.twin || 0) + ' · 같은 유형 ' + (r.same || 0) + (r.none ? ' · 못 찾음 ' + r.none : '') + (r.already ? ' · 이미 낸 것 ' + r.already : '') + (r.unknown ? ' · 단원 모름 ' + r.unknown + '(넣음)' : '') + '<br>';
      if (r && r.scope){ var e = ((WT.scope || {}).byKey || {})[r.scope] || {}; h += '시험범위 ' + wtE(r.scope) + ' — ' + wtE((e.mids || []).join(' · ')) + '<br>'; }
      h += (my.runs && my.runs.length ? '지난 출제: ' + my.runs.slice(-5).reverse().map(function(x){ return wtMd(x.at) + ' ' + x.n + '문항' + (x.ws && x.ws.length ? ' (#' + x.ws.join(', #') + ')' : ''); }).join(' · ') : '아직 낸 적 없음 — 첫 회는 ' + wtE(cfg.start) + '부터 모읍니다') + '</div>';
    }
  });
  if (!list.length) h += '<div class="wt-det" style="padding-left:14px">이 요일 반 학생이 없습니다 — 반 수업 요일(⏰ 반 수업 시간)을 확인하세요</div>';
  h += '<div class="wt-foot"><span>' + list.length + '명 중 ' + nOn + '명 출제 · 쌍둥이 약 <b style="color:#1d4ed8">' + nP + '</b>문항 · 학습지 약 ' + nS + '장' + (WT.pv && WT.pv.at ? ' <small style="color:#5f6b80;font-weight:700">(계산 ' + wtWhen(WT.pv.at) + ')</small>' : '') + '</span>'
    + '<span><button type="button" class="wt-b" onclick="wtRequest(\'' + batch + '\',true)"' + (WT.busy ? ' disabled' : '') + '>👁 다시 계산</button> <button type="button" class="wt-b pri" onclick="wtRequest(\'' + batch + '\',false)"' + (WT.busy ? ' disabled' : '') + '>📤 ' + (batch === 'fri' ? '금요일' : '토요일') + ' 반 지금 출제</button></span></div></div>';
  return h;
}
function wtScopeTab(){
  var sc = (WT.scope && WT.scope.byKey) || {}, ks = Object.keys(sc).sort(), stu = wtStudents(), h = '<div class="wt-card"><h3>📚 시험범위 (매쓰플랫 단원 이름)</h3>';
  h += '<div style="font-size:12.5px;color:#5f6b80;font-weight:700;margin-bottom:6px">' + wtE((WT.scope && WT.scope.note) || '') + ' · 단원은 쉼표로 · 범위가 없는 학교·학년(초등 등)은 10/1 이후 오답 전부</div>';
  ks.forEach(function(k){
    var e = sc[k] || {}, who = stu.filter(function(s){ return wtScopeKey(s) === k; }).length, id = 'wt-mids-' + k.replace(/[^가-힣A-Za-z0-9]/g, '_');
    h += '<div class="wt-sc"><div><b>' + wtE(k) + '</b><small>' + wtE(e.exam || '') + (e.date ? ' · ' + wtE(e.date) : '') + ' · 학생 ' + who + '명</small></div>'
      + '<div><textarea id="' + id + '" aria-label="' + wtE(k) + ' 단원">' + wtE((e.mids || []).join(', ')) + '</textarea><small>' + wtE(e.src || '') + '</small></div>'
      + '<div style="display:flex;flex-direction:column;gap:4px"><button type="button" class="wt-b pri" onclick="wtScopeSave(\'' + wtJs(k) + '\')">저장</button><button type="button" class="wt-b" onclick="wtScopeDel(\'' + wtJs(k) + '\')">지우기</button></div></div>';
  });
  var none = {}; stu.forEach(function(s){ var k = wtScopeKey(s); if (!sc[k]) none[k] = (none[k] || 0) + 1; });
  h += '<div style="margin-top:8px;font-size:12.5px;color:#5f6b80;font-weight:700">범위 없음(→ 전부): ' + Object.keys(none).sort().map(function(k){ return wtE(k) + ' ' + none[k] + '명'; }).join(' · ') + '</div>';
  h += '<div style="margin-top:8px"><button type="button" class="wt-b" onclick="wtScopeAdd()">＋ 학교·학년 추가</button></div></div>';
  return h;
}
function wtLogTab(){
  var runs = (WT.log && WT.log.runs) || [], h = '<div class="wt-card"><h3>🗂 지난 출제 (최근 20회)</h3>';
  if (!runs.length) h += '<div style="color:#5f6b80;font-weight:700">아직 기록이 없습니다</div>';
  runs.forEach(function(r){
    h += '<div class="wt-lg"><span>' + wtWhen(r.at) + '</span><span class="hx">' + (r.batch === 'fri' ? '금요일 반' : r.batch === 'sat' ? '토요일 반' : '전체') + '</span><span>' + (r.dry ? '👁 설계만 · ' : '📤 ') + r.students + '명 · ' + r.problems + '문항 · ' + (r.sheets || 0) + '장' + (r.fail ? ' · <b style="color:#c81e1e">실패 ' + r.fail + '명</b>' : '') + '</span><span class="hx">' + (r.only ? '골라서 ' + r.only + '명' : '') + '</span></div>';
  });
  return h + '</div>';
}
window.rWtwin = function(){
  wtLoad(false);
  if (!WT.tab){ var d = new Date().getDay(); WT.tab = (d === 6) ? 'sat' : 'fri'; }
  var cfg = wtCfg(), stu = wtStudents(), fri = stu.filter(function(s){ return wtBatchOf(s.group) === 'fri'; }), sat = stu.filter(function(s){ return wtBatchOf(s.group) === 'sat'; });
  var grpOf = function(b){ var g = {}; Object.keys(WT.days || {}).forEach(function(k){ if (wtBatchOf(k) === b) g[k] = 1; }); return Object.keys(g).sort(); };
  var h = '<style>' + WT_CSS + '</style><div class="wt">';
  h += '<div class="wt-top"><div><h2>📄 오답 쌍둥이 숙제</h2><div class="s">틀린 문제마다 쌍둥이 1문제 → 매쓰플랫 «숙제» 태그로 학생마다 출제 · 월수금 반 금요일 · 화목토 반 토요일 새벽 5시</div></div>'
    + '<div class="sw"><button type="button" class="wt-tog' + (cfg.on !== false ? ' on' : '') + '" onclick="wtToggleOn()" aria-pressed="' + (cfg.on !== false) + '">자동 출제 <i></i></button><button type="button" class="wt-b gh" onclick="wtReload()">↻ 다시 읽기</button></div></div>';
  if (!WT.loaded) return h + '<div class="wt-card">서버에서 읽는 중…</div></div>';
  h += wtReqLine();
  h += '<div class="wt-g2">';
  [['fri', fri], ['sat', sat]].forEach(function(x){
    var b = x[0], nx = wtNext(b);
    h += '<div class="wt-nx ' + b + '"><div class="n">' + (b === 'fri' ? '월수금 반 → 매주 <b>금요일</b>' : '화목토 반 → 매주 <b>토요일</b>') + ' 새벽 5시</div><div class="d">' + (nx.getMonth() + 1) + '/' + nx.getDate() + ' (' + (b === 'fri' ? '금' : '토') + ')' + (cfg.on === false ? ' <span style="font-size:13px;color:#c81e1e">자동 꺼짐</span>' : '') + '</div>'
      + '<div>' + grpOf(b).map(function(g){ return '<span class="wt-chip">' + wtE(g) + '</span>'; }).join('') + '</div><div class="n">대상 <b>' + x[1].length + '명</b></div></div>';
  });
  h += '</div>';
  h += '<div class="wt-rule"><span>틀린 문제 1개 → <b>쌍둥이 1개</b> (없으면 같은 유형)</span>' + (cfg.maxPer ? '<span>한 번에 <b>최대 ' + cfg.maxPer + '문항</b> · 최근에 틀린 것 먼저 · 나머지는 다음 주</span>' : '<span>문제 수 <b>제한 없음</b> · ' + (cfg.chunk || 50) + '문항씩 나눔</span>') + '<span>지난 출제 뒤 새로 틀린 것만 · <b>다시 맞힌 문제는 뺌</b></span><span>첫 회 <b>' + wtE(cfg.start) + '</b>부터</span><span>학교 <b>시험범위 단원만</b></span><span>매쓰플랫 <b>자동채점</b> 문항</span><span>태그 <b>숙제</b></span><span><b>' + wtE((cfg.excludeGrades || []).join('·')) + ' 제외</b></span></div>';
  h += '<div class="wt-tabs">' + [['fri', '금요일 반 (월수금) ' + fri.length + '명'], ['sat', '토요일 반 (화목토) ' + sat.length + '명'], ['log', '지난 출제'], ['scope', '시험범위']].map(function(t){ return '<button type="button" class="wt-tab' + (WT.tab === t[0] ? ' on' : '') + '" onclick="wtTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  if (WT.tab === 'fri' || WT.tab === 'sat') h += wtTable(WT.tab);
  else if (WT.tab === 'log') h += wtLogTab();
  else h += wtScopeTab();
  return h + '</div>';
};
