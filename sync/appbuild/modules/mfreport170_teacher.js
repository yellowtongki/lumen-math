/* ═══════════════════════════════════════════════════════════════════
 * v19-170: 📑 매쓰플랫 월간보고서 — 진도·리포트 › 월간보고서 (원장 2026-11-01 「9월 보고서는 하나하나 만들어서 오래 걸렸다 ·
 *   여러 학생을 하나씩 열어봐서 확인해야 해서 시간이 너무 오래 걸린다 · 학원앱에서 쉽게 확인하고 배포 · 학원앱 보고서 화면도 만들자」)
 *  서버 sync/mf_report_worker.js (요청 mfrep_req → collect_request_worker 5분마다 · 매달 2일 03:20 mf-report.yml 이 지난달 «비공개»로 만듦)
 *  읽기: lumen_store mfrep_<YYYY-MM>(학생별 보고서·의견·공개 상태) · mfrep_req · mfrep_log  — 기기에 두지 않는다(PULL_SKIP_PREFIX 'mfrep_')
 *  쓰기: mfrep_req {status:'requested', action:'list'|'make'|'comment'|'publish'|'unpublish', month, items, ids, sms, at}
 *  화면: 달 고르기 · 요약(보고서·공개·의견·의견 쪽 꺼짐·보고서 없음) · 학생 줄(체크 · 채점 · 정답률 · 등수 · 공개 · 의견 고치기)
 *        · 아래 «고친 의견 저장 / 선택 학부모앱 공개(문자 선택) / 선택 비공개»
 *  ⚠ 학부모앱 공개는 원장님이 이 화면에서 누를 때만. 서버 자동 만들기는 늘 비공개.
 *  ※ 서버 질문은 «묻는 중이면 또 묻지 않기»(v19-168 교훈).
 * ═══════════════════════════════════════════════════════════════════ */
var MR = { month: '', data: {}, req: null, log: null, loading: false, t: 0, pick: {}, edit: {}, sms: false, open: '', timer: 0 };
function mrE(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function mrMonths(){ var d = new Date(), out = []; d.setDate(1); for (var i = 0; i < 4; i++){ d.setMonth(d.getMonth() - 1); out.push(d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1)); } return out; }   /* 지난달부터 넉 달 */
function mrMonth(){ if (!MR.month) MR.month = mrMonths()[0]; return MR.month; }
function mrWhen(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
function mrBusy(){ var r = MR.req; return !!(r && (r.status === 'requested' || r.status === 'running')); }
function mrLoad(force){
  if (MR.loading) return;   /* ★ 묻는 중이면 또 묻지 않는다 */
  if (!force && MR.t && Date.now() - MR.t < 30000 && MR.data[mrMonth()] !== undefined) return;
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return;
  MR.loading = true;
  var keys = ['mfrep_' + mrMonth(), 'mfrep_req', 'mfrep_log'];
  sb.from('lumen_store').select('key,value,updated_at').in('key', keys).then(function(r){
    MR.loading = false; MR.t = Date.now();
    if (MR.data[mrMonth()] === undefined) MR.data[mrMonth()] = null;
    ((r && r.data) || []).forEach(function(x){ var v = x.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      if (x.key === 'mfrep_req') MR.req = v; else if (x.key === 'mfrep_log') MR.log = v; else MR.data[x.key.slice(6)] = v; });
    mrPoll();
    try { if (VIEW === 'mfrep') render(); } catch(e){}
  }, function(){ MR.loading = false; MR.t = Date.now(); });
}
/* 요청이 처리되는 동안 20초마다 다시 읽는다 (이 화면에 있을 때만) */
function mrPoll(){
  if (MR.timer) { clearTimeout(MR.timer); MR.timer = 0; }
  if (!mrBusy()) return;
  MR.timer = setTimeout(function(){ MR.timer = 0; try { if (VIEW === 'mfrep') mrLoad(true); } catch(e){} }, 20000);
}
function mrSend(q, msg){
  if (mrBusy()){ alert('앞의 요청을 서버가 처리 중입니다 — 끝나면 다시 눌러 주세요 (보통 1~5분)'); return Promise.resolve(false); }
  q.status = 'requested'; q.month = mrMonth(); q.at = new Date().toISOString(); q.by = 'teacher';
  MR.req = q; render();
  return Promise.resolve(supaSetItem('mfrep_req', q)).then(function(ok){
    if (ok === false){ alert('서버 저장 실패 — 인터넷 연결을 확인하세요'); return false; }
    try { plToast(msg); } catch(e){}
    try { if (typeof htsWake === 'function') htsWake('월간보고서'); } catch(e){}
    mrPoll(); return true;
  });
}
window.mrSetMonth = function(m){ MR.month = m; MR.pick = {}; MR.edit = {}; MR.open = ''; mrLoad(true); render(); };
window.mrReload = function(){ mrLoad(true); try { plToast('↻ 다시 읽는 중…'); } catch(e){} };
window.mrRefresh = function(){ mrSend({ action: 'list' }, '↻ 매쓰플랫에서 다시 읽기를 요청했습니다 (1~5분)'); };
window.mrMake = function(){
  if (!confirm(mrMonth().replace('-', '년 ') + '월 보고서가 없는 재원생의 보고서를 매쓰플랫에 만들까요?\n· «비공개»로 만들어집니다 (학부모님께 안 보임)\n· 선생님의견은 매쓰플랫 AI가 먼저 씁니다 — 여기서 고칠 수 있어요\n· 그 달 채점 기록이 없는 학생은 빠집니다')) return;
  mrSend({ action: 'make' }, '＋ 보고서 만들기를 요청했습니다 (학생 수에 따라 3~10분)');
};
window.mrPick = function(id){ id = String(id); if (MR.pick[id]) delete MR.pick[id]; else MR.pick[id] = 1; render(); };
window.mrPickAll = function(on){ var d = MR.data[mrMonth()]; MR.pick = {}; if (on && d) (d.rows || []).forEach(function(x){ MR.pick[String(x.reportId)] = 1; }); render(); };
window.mrOpen = function(id){ MR.open = MR.open === String(id) ? '' : String(id); render(); };
window.mrEdit = function(id, el){ var d = MR.data[mrMonth()], row = d && (d.rows || []).filter(function(x){ return String(x.reportId) === String(id); })[0];
  var v = String(el.value || ''); if (row && v === String(row.comment || '')) delete MR.edit[String(id)]; else MR.edit[String(id)] = v;
  var c = document.getElementById('mr-cnt-' + id); if (c){ c.textContent = v.length + ' / 650'; c.style.color = v.length > 650 ? '#dc2626' : '#64748b'; }
  var s = document.getElementById('mr-savebar'); if (s) s.textContent = '💾 고친 의견 저장 (' + Object.keys(MR.edit).length + ')';
};
window.mrSaveComments = function(){
  var ids = Object.keys(MR.edit); if (!ids.length){ alert('고친 의견이 없습니다'); return; }
  var over = ids.filter(function(id){ return MR.edit[id].length > 650; });
  if (over.length){ alert('650자를 넘는 의견이 ' + over.length + '개 있습니다 — 매쓰플랫 한도라서 줄여 주세요'); return; }
  if (!confirm('고친 의견 ' + ids.length + '개를 매쓰플랫 보고서에 저장할까요?\n(공개 상태는 바뀌지 않습니다)')) return;
  mrSend({ action: 'comment', items: ids.map(function(id){ return { reportId: Number(id), comment: MR.edit[id] }; }) }, '💾 의견 저장을 요청했습니다').then(function(ok){ if (ok) MR.edit = {}; });
};
window.mrSms = function(el){ MR.sms = !!el.checked; };
window.mrPublish = function(on){
  var ids = Object.keys(MR.pick).map(Number); if (!ids.length){ alert('학생을 먼저 체크해 주세요'); return; }
  if (on && Object.keys(MR.edit).length){ alert('저장 안 한 의견이 있습니다 — 먼저 «💾 고친 의견 저장»을 눌러 주세요'); return; }
  var msg = on ? ('체크한 ' + ids.length + '명의 보고서를 매쓰플랫 학부모앱에 공개할까요?' + (MR.sms ? '\n📱 학부모님께 문자도 함께 갑니다' : '\n(문자는 보내지 않습니다)')) : ('체크한 ' + ids.length + '명의 보고서를 학부모앱에서 내릴까요(비공개)?');
  if (!confirm(msg)) return;
  mrSend({ action: on ? 'publish' : 'unpublish', ids: ids, sms: on ? !!MR.sms : false }, on ? '📤 학부모앱 공개를 요청했습니다' : '🙈 비공개를 요청했습니다').then(function(ok){ if (ok) MR.pick = {}; });
};
function mrReqLine(){
  var r = MR.req; if (!r) return '';
  var lab = { list: '다시 읽기', make: '보고서 만들기', comment: '의견 저장', publish: '학부모앱 공개', unpublish: '비공개' }[r.action] || r.action;
  if (r.status === 'requested') return '<div class="mr-req wait">⏳ «' + lab + '» 요청을 보냈습니다 (' + mrWhen(r.at) + ') — 서버가 곧 시작합니다 (최대 5분)</div>';
  if (r.status === 'running') return '<div class="mr-req wait">⚙️ 서버가 «' + lab + '» 처리 중… (' + mrWhen(r.startedAt) + ' 시작)</div>';
  var res = r.result || {};
  if (r.status === 'error') return '<div class="mr-req bad">⚠️ «' + lab + '» 실패 (' + mrWhen(r.doneAt) + ') — ' + mrE((res.errors || [r.error || '']).slice(0, 2).join(' · ')) + '</div>';
  return '<div class="mr-req ok">✅ «' + lab + '» 끝' + (r.doneAt ? ' (' + mrWhen(r.doneAt) + ')' : '') + (res.ok ? ' · ' + res.ok + '건' : '') + (res.note ? ' · ' + mrE(res.note) : '') + (res.fail ? ' · 실패 ' + res.fail : '') + '</div>';
}
function rMfrep(){
  mrLoad(false);
  var ym = mrMonth(), d = MR.data[ym], busy = mrBusy();
  var h = '<style>'
    + '.mr-wrap{max-width:1100px}.mr-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}'
    + '.mr-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer}.mr-chip.on{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.mr-btn{border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;background:#eef2f7;color:#0f172a}.mr-btn.pri{background:#0f766e;color:#fff}.mr-btn.warn{background:#1d4ed8;color:#fff}.mr-btn:disabled{opacity:.45;cursor:default}'
    + '.mr-req{border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;margin-bottom:10px}.mr-req.wait{background:#fef9c3;color:#854d0e}.mr-req.ok{background:#dcfce7;color:#166534}.mr-req.bad{background:#fee2e2;color:#991b1b}'
    + '.mr-sum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.mr-sum div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:12px;color:#64748b;font-weight:700}.mr-sum b{display:block;font-size:19px;color:#0f172a}'
    + '.mr-row{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;overflow:hidden}.mr-row.pk{border-color:#0f766e;box-shadow:0 0 0 2px rgba(15,118,110,.15)}'
    + '.mr-hd{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer}.mr-hd input{width:18px;height:18px}.mr-nm{font-weight:900;min-width:76px}.mr-g{font-size:12px;color:#64748b;font-weight:700}'
    + '.mr-st{font-size:12px;color:#334155;font-weight:700}.mr-badge{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px}.mr-badge.on{background:#dcfce7;color:#166534}.mr-badge.off{background:#f1f5f9;color:#64748b}.mr-badge.ed{background:#fef3c7;color:#92400e}.mr-badge.no{background:#fee2e2;color:#991b1b}'
    + '.mr-pv{flex:1;min-width:0;font-size:12.5px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.mr-body{padding:0 12px 12px}.mr-body textarea{width:100%;min-height:150px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:14px;line-height:1.6;resize:vertical;box-sizing:border-box}.mr-cnt{font-size:11px;color:#64748b;text-align:right;margin-top:3px}'
    + '.mr-bar{position:sticky;bottom:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}'
    + '</style><div class="mr-wrap">';
  h += '<div style="font-size:13px;color:#475569;margin-bottom:10px;line-height:1.6">매쓰플랫 «보고서»를 한 화면에서 봅니다. 의견을 바로 고치고, 체크한 학생만 <b>학부모앱에 공개</b>합니다. '
    + '버튼을 누르면 서버가 매쓰플랫에서 처리합니다(1~5분). 매달 <b>2일 새벽</b>에 지난달 보고서가 <b>비공개</b>로 자동으로 만들어집니다.</div>';
  h += '<div class="mr-top">' + mrMonths().map(function(m){ return '<button class="mr-chip' + (m === ym ? ' on' : '') + '" onclick="mrSetMonth(\'' + m + '\')">' + Number(m.slice(5)) + '월</button>'; }).join('')
    + '<span style="flex:1"></span><button class="mr-btn" onclick="mrReload()">↻ 화면 새로</button>'
    + '<button class="mr-btn" ' + (busy ? 'disabled' : '') + ' onclick="mrRefresh()">⤓ 매쓰플랫에서 다시 읽기</button>'
    + '<button class="mr-btn pri" ' + (busy ? 'disabled' : '') + ' onclick="mrMake()">＋ 이 달 보고서 만들기(비공개)</button></div>';
  h += mrReqLine();
  if (d === undefined || (MR.loading && !d)) return h + '<div style="padding:30px;text-align:center;color:#64748b">불러오는 중…</div></div>';
  if (!d) return h + '<div style="padding:30px;text-align:center;color:#64748b;background:#fff;border-radius:12px">' + Number(ym.slice(5)) + '월 목록이 아직 없습니다.<br>«⤓ 매쓰플랫에서 다시 읽기»를 누르거나, 보고서가 없으면 «＋ 이 달 보고서 만들기»를 눌러 주세요.</div></div>';
  var rows = d.rows || [], nOn = rows.filter(function(x){ return x.shared; }).length, nCm = rows.filter(function(x){ return String(x.comment || '').trim(); }).length, nOff = rows.filter(function(x){ return String(x.comment || '').trim() && !x.commentOn; }).length;
  h += '<div class="mr-sum"><div>보고서<b>' + rows.length + '명</b></div><div>학부모앱 공개<b style="color:#166534">' + nOn + '</b></div><div>비공개<b>' + (rows.length - nOn) + '</b></div><div>선생님의견 있음<b>' + nCm + '</b></div>'
    + (nOff ? '<div style="border-color:#fecaca">의견 쪽 꺼짐<b style="color:#dc2626">' + nOff + '</b></div>' : '')
    + '<div>보고서 없음<b>' + ((d.missing || []).length) + '</b></div><div style="flex:1;min-width:150px">마지막으로 읽은 때<b style="font-size:14px">' + mrWhen(d.at) + '</b></div></div>';
  if ((d.missing || []).length) h += '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px">보고서 없음: ' + d.missing.map(function(x){ return mrE(x.name); }).join(', ') + ' — 그 달 채점 기록이 없으면 매쓰플랫이 만들지 않습니다.</div>';
  rows.forEach(function(x){
    var id = String(x.reportId), pk = !!MR.pick[id], ed = MR.edit[id] !== undefined, cm = ed ? MR.edit[id] : String(x.comment || ''), op = MR.open === id;
    h += '<div class="mr-row' + (pk ? ' pk' : '') + '"><div class="mr-hd" onclick="mrOpen(\'' + id + '\')">'
      + '<input type="checkbox" ' + (pk ? 'checked' : '') + ' onclick="event.stopPropagation();mrPick(\'' + id + '\')">'
      + '<span class="mr-nm">' + mrE(x.name) + '</span><span class="mr-g">' + mrE(x.grade) + '</span>'
      + '<span class="mr-st">채점 ' + (x.scoringCount || 0) + ' · 정답률 ' + (x.correctRate || 0) + '% · 전국 ' + (x.rank || '-') + '등급</span>'
      + '<span class="mr-badge ' + (x.shared ? 'on">공개' : 'off">비공개') + '</span>'
      + (ed ? '<span class="mr-badge ed">고침 · 저장 전</span>' : '')
      + (!String(cm).trim() ? '<span class="mr-badge no">의견 없음</span>' : (!x.commentOn ? '<span class="mr-badge no">의견 쪽 꺼짐</span>' : ''))
      + '<span class="mr-pv">' + (op ? '' : mrE(cm)) + '</span><span style="color:#94a3b8">' + (op ? '▲' : '▼') + '</span></div>';
    if (op) h += '<div class="mr-body"><textarea oninput="mrEdit(\'' + id + '\',this)" placeholder="선생님의견을 써 주세요">' + mrE(cm) + '</textarea>'
      + '<div class="mr-cnt" id="mr-cnt-' + id + '">' + cm.length + ' / 650</div>'
      + (!x.commentOn ? '<div style="font-size:12px;color:#b91c1c;margin-top:4px">이 보고서는 «선생님의견» 쪽이 꺼져 있어 학부모님께 의견이 안 보입니다 — 의견을 저장하면 같이 켜집니다.</div>' : '')
      + '</div>';
    h += '</div>';   /* .mr-row 닫기 */
  });
  var np = Object.keys(MR.pick).length;
  h += '<div class="mr-bar"><button class="mr-btn" onclick="mrPickAll(' + (np < rows.length ? 'true' : 'false') + ')">' + (np < rows.length ? '☑ 전체 선택' : '☐ 선택 풀기') + '</button>'
    + '<span style="font-size:13px;font-weight:800;color:#0f766e">' + np + '명 선택</span><span style="flex:1"></span>'
    + '<button class="mr-btn" id="mr-savebar" ' + (busy ? 'disabled' : '') + ' onclick="mrSaveComments()">💾 고친 의견 저장 (' + Object.keys(MR.edit).length + ')</button>'
    + '<label style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:4px"><input type="checkbox" ' + (MR.sms ? 'checked' : '') + ' onchange="mrSms(this)"> 문자도 보내기</label>'
    + '<button class="mr-btn warn" ' + (busy || !np ? 'disabled' : '') + ' onclick="mrPublish(true)">📤 선택 학부모앱 공개</button>'
    + '<button class="mr-btn" ' + (busy || !np ? 'disabled' : '') + ' onclick="mrPublish(false)">🙈 선택 비공개</button></div>';
  if (MR.log && MR.log.length) h += '<details style="margin-top:12px;font-size:12.5px;color:#475569"><summary style="cursor:pointer;font-weight:800">지난 처리 기록</summary>'
    + MR.log.slice(0, 12).map(function(l){ return '<div style="padding:3px 0">' + mrWhen(l.at) + ' · ' + mrE(l.month) + ' · ' + mrE(l.action) + (l.n ? ' ' + l.n + '건' : '') + (l.sms ? ' · 문자' : '') + ' → 성공 ' + ((l.result || {}).ok || 0) + ((l.result || {}).fail ? ' · 실패 ' + l.result.fail : '') + '</div>'; }).join('') + '</details>';
  return h + '</div>';
}
