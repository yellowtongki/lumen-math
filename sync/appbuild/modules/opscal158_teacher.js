/* ═══════════════════════════════════════════════════════════════════
 * v19-158: 📅 운영 달력 — 운영(학관노 매뉴얼) · 마케팅 실행 · 학교 일정 · 수납·세금 · 지표를 한 달력에 층으로
 *   원장 2026-10-25~26 「학관노 매뉴얼 + 2026 연간마케팅 플랜을 운영 달력에」 · 「월 달력 밑에 체크리스트」 · 「오른쪽 칸 없애고」
 *   시안 docs/mockup_home_ops.html · 채팅 artifact 3yQ98nsixtHd7sPiXJ9DLE
 *   읽는 것: lumen_store ops_plan  { year, themes[12], keywords[12][], tax[[YYYY-MM-DD,글]], schoolExtra[[YYYY-MM-DD,글]],
 *                                    events[{id,n,type,date,d:[[D,담당,할 일]]}], regular[{rule,d?,L,who,t,st[],man?}],
 *                                    mkt{ channels[], steps{채널:[단계]}, exam[[기준,D,채널,글]], recruit[[D,채널,글]], special[[YYYY-MM-DD,채널,글]] },
 *                                    manuals[{name,rank,cycle,timing,where,what,prep[],steps[],done,evid,report,ex[]}], ranks{r1:'원장'…},
 *                                    kpi{ year, ask[12], reg[12], out[12], goal }, traffic{ weeks[], rows{이름:[숫자]} } }
 *            lumen_store ops_checks { '<날짜>|<할 일>':1, '<날짜>|<할 일>#<단계>':1, 'day|<날짜>|<업무>#<단계>':1 }
 *            학원 달력(cal_teacher.js) 의 CT: 나이스 시험(ctExams) · 학원 일정(lumen_events) · 공휴일(CT_HOLI)
 *   쓰는 것: ops_checks 만 (체크할 때마다 서버 최신본을 받아 그 한 칸만 바꿔 올린다 — 체크 해제도 그대로 남는다)
 *   두 키는 시작 다운로드에서 뺀다(PULL_SKIP_KEYS) — 화면이 서버에서 바로 읽는다.
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var OPS = { loaded: false, loading: false, err: '', plan: null, ck: {}, y: 0, m: 0, view: 'month', sel: '', who: '전체',
  on: { sch: 1, acad: 1, ops: 1, mkt: 1, money: 1, kpi: 1 }, man: '' };
var OPS_L = { sch: ['학교', '#6d28d9', '#efe7fd'], acad: ['학원 일정', '#374151', '#e5e7eb'], ops: ['운영', '#1d4ed8', '#e6eefc'], mkt: ['마케팅', '#be185d', '#fce7f1'], money: ['돈', '#0f766e', '#d9f3ef'], kpi: ['지표', '#b45309', '#fef3c7'] };
var OPS_WCOL = { '원장': '#7c3aed', '실장': '#2563eb', '강사': '#0f766e', '조교': '#c2410c' };
var OPS_DOW = ['일', '월', '화', '수', '목', '금', '토'];
function opsE(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function opsJs(s){ return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function opsToday(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function opsAdd(s, n){ var t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function opsDow(s){ return new Date(s + 'T00:00:00Z').getUTCDay(); }
function opsSat(s){ return opsDow(s) === 0 ? opsAdd(s, -1) : s; }        /* 일요일(휴무)이면 토요일로 당김 */
function opsYmd(y, m, d){ return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
function opsMd(s){ return Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10)); }
function opsDim(y, m){ return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function opsDl(n){ return n === 0 ? 'D-day' : (n < 0 ? 'D' + n : 'D+' + n); }

async function opsLoad(force){
  if (OPS.loading) return; if (OPS.loaded && !force) return;
  OPS.loading = true; OPS.err = '';
  try {
    var sb = getSupaClient(); if (!sb) throw new Error('서버 연결이 없습니다');
    var r = await sb.from('lumen_store').select('key,value').in('key', ['ops_plan', 'ops_checks']);
    if (r.error) throw r.error;
    var got = {}; (r.data || []).forEach(function(x){ var v = x.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } got[x.key] = v; });
    OPS.plan = got.ops_plan || null; OPS.ck = got.ops_checks || {};
    OPS.loaded = true;
  } catch(e){ OPS.err = String(e.message || e); }
  OPS.loading = false;
  try { if (typeof CT !== 'undefined' && !CT.loaded && typeof ctLoad === 'function') ctLoad(); } catch(e){}
  try { if (VIEW === 'opscal') render(); } catch(e){}
}

/* ── 학교 시험 물결: 나이스 시험(ctExams)을 20일 넘게 떨어지면 끊어 묶는다 ── */
function opsWaves(){
  var ex = []; try { ex = (typeof ctExams === 'function' && typeof CT !== 'undefined' && CT.loaded) ? ctExams() : []; } catch(e){ ex = []; }
  var w = [], cur = null;
  ex.slice().sort(function(a, b){ return a.from < b.from ? -1 : 1; }).forEach(function(e){
    var to = e.to || e.from;
    if (cur && opsDiff(cur.to, e.from) <= 20){ if (to > cur.to) cur.to = to; cur.n++; }
    else { cur = { from: e.from, to: to, n: 1 }; w.push(cur); }
  });
  w.forEach(function(x){ var m = Number(x.from.slice(5, 7)); x.label = m <= 5 ? '1학기 중간' : m <= 8 ? '1학기 기말' : m <= 10 ? '2학기 중간' : '2학기 기말'; });
  return w;
}
function opsDiff(a, b){ return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

/* ── 한 달의 할 일 만들기 ── */
function opsItems(y, m){
  var P = OPS.plan || {}, out = [], ym = y + '-' + ('0' + m).slice(-2);
  var inM = function(d){ return d && d.slice(0, 7) === ym; };
  var push = function(d, L, t, sub, o){ if (!inM(d)) return; var it = { d: d, L: L, t: t, sub: sub || '', who: '', st: [] }; for (var k in (o || {})) it[k] = o[k]; it.id = d + '|' + t; out.push(it); };
  /* 학교 일정: 나이스 시험 + 시트에서 옮긴 학교 행사 */
  try { if (typeof ctExams === 'function' && CT.loaded) ctExams().forEach(function(e){
    for (var d = e.from; d <= (e.to || e.from); d = opsAdd(d, 1)) push(d, 'sch', e.school + ' ' + (e.label || '시험') + (d === e.from && e.to && e.to !== e.from ? ' (' + opsMd(e.from) + '~' + opsMd(e.to) + ')' : ''), '학교 시험 · 나이스 학사일정', { first: d === e.from });
  }); } catch(e){}
  (P.schoolExtra || []).forEach(function(x){ push(x[0], 'sch', x[1], '학교 일정'); });
  /* 학원 일정 (학원 달력 lumen_events) */
  try { if (typeof ctEventsOn === 'function' && CT.loaded) for (var dd = 1; dd <= opsDim(y, m); dd++){ var ds = opsYmd(y, m, dd); ctEventsOn(ds).forEach(function(ev){ push(ds, 'acad', ev.title || '학원 일정', '학원 달력' + (ev.time ? ' · ' + ev.time : '')); }); } } catch(e){}
  /* 세금 */
  (P.tax || []).forEach(function(x){ push(x[0], 'money', x[1], '세금', { who: '원장', st: ['금액 확인 (세무사·홈택스)', '납부·신고', '영수증 보관'] }); });
  /* 정기 업무 */
  (P.regular || []).forEach(function(r){
    var d = '';
    if (r.rule === 'day') d = opsYmd(y, m, Math.min(r.d, opsDim(y, m)));
    else if (r.rule === 'last') d = opsYmd(y, m, opsDim(y, m));
    else if (r.rule === 'firstMon'){ for (var i = 1; i <= 7; i++){ if (opsDow(opsYmd(y, m, i)) === 1){ d = opsYmd(y, m, i); break; } } }
    if (!d) return; if (r.rule !== 'firstMon') d = opsSat(d);
    push(d, r.L || 'money', r.t, r.sub || '매월', { who: r.who || '', st: r.st || [], man: r.man || '' });
  });
  /* 운영 행사 D-업무 + 모집 행사 마케팅 */
  var MK = P.mkt || {}, CH = MK.steps || {};
  var mk = function(d, ch, txt, sub){ if ((MK.channels || []).indexOf(ch) < 0) return; push(opsSat(d), 'mkt', ch + ': ' + txt, sub, { who: '원장', st: CH[ch] || [] }); };
  (P.events || []).forEach(function(e){
    (e.d || []).forEach(function(x){ var raw = opsAdd(e.date, x[0]); push(opsSat(raw), 'ops', x[2], e.n + ' · ' + opsDl(x[0]) + (opsDow(raw) === 0 ? ' · 일요일→토요일' : ''), { who: x[1], mark: x[0] === 0 }); });
    if (e.type === '신규모집') (MK.recruit || []).forEach(function(x){ mk(opsAdd(e.date, x[0]), x[1], x[2], e.n + ' · ' + opsDl(x[0])); });
  });
  /* 시험 물결 마케팅 */
  opsWaves().forEach(function(w){ (MK.exam || []).forEach(function(x){ var base = x[0] === 'start' ? w.from : w.to; mk(opsAdd(base, x[1]), x[2], x[3].replace('{w}', w.label), '시험 ' + (x[0] === 'start' ? '시작' : '끝') + ' ' + opsDl(x[1]) + ' · 자동 제안'); }); });
  (MK.special || []).forEach(function(x){ mk(x[0], x[1], x[2], '기념일'); });
  out.sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  return out;
}
function opsVis(it){ return OPS.on[it.L] && (OPS.who === '전체' || it.L === 'sch' || it.L === 'acad' || it.who === OPS.who); }
function opsDone(it){ return !!OPS.ck[it.id]; }
function opsOver(it){ return it.L !== 'sch' && it.L !== 'acad' && it.d < opsToday() && !opsDone(it) && it.d >= '2026-10-01'; }

/* ── 체크 저장: 서버 최신본에 그 칸만 바꿔 올린다 ── */
window.opsTick = async function(key, on, parent, n){
  if (on) OPS.ck[key] = 1; else delete OPS.ck[key];
  if (parent && on){ var all = true; for (var i = 0; i < n; i++) if (!OPS.ck[parent + '#' + i]) all = false; if (all) OPS.ck[parent] = 1; }
  try { render(); } catch(e){}
  try {
    var sb = getSupaClient(); var cur = {};
    if (sb){ var r = await sb.from('lumen_store').select('value').eq('key', 'ops_checks'); var v = r && r.data && r.data[0] ? r.data[0].value : {}; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = {}; } } cur = v || {}; }
    if (on) cur[key] = 1; else delete cur[key];
    if (parent && on && OPS.ck[parent]) cur[parent] = 1;
    var ok = await supaSetItem('ops_checks', cur);
    if (ok === false) throw new Error('저장 실패');
    OPS.ck = cur;
  } catch(e){ try { plToast('⚠ 체크를 서버에 저장하지 못했습니다 — 다시 눌러 주세요'); } catch(e2){} }
};

/* ── 화면 ── */
function opsCss(){
  return '<style id="ops158-css">'
    + '.o8{padding:18px 22px 60px;background:#eef2f8;min-height:100%;font-size:14px;color:#14213a}'
    + '.o8 h2{margin:0;font-size:21px;font-weight:900;color:#0d2240}'
    + '.o8-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}'
    + '.o8-seg{display:flex;gap:4px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:4px;margin-left:auto}'
    + '.o8-seg button,.o8-chip{font-family:inherit;font-size:13px;font-weight:800;border:0;border-radius:9px;padding:6px 13px;cursor:pointer;background:transparent;color:#475569}'
    + '.o8-seg button.on{background:#0d2240;color:#fff}'
    + '.o8-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}'
    + '.o8-chip{border:1.5px solid #e2e8f0;background:#fff;padding:3px 11px;display:inline-flex;align-items:center;gap:5px}'
    + '.o8-chip.off{opacity:.45;text-decoration:line-through}.o8-chip.sel{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.o8-chip i{width:10px;height:10px;border-radius:3px;display:inline-block}'
    + '.o8-card{background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:13px 15px;margin-bottom:12px}'
    + '.o8-mh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.o8-mh b{font-size:19px;min-width:130px;text-align:center}'
    + '.o8-nav{font-family:inherit;font-size:16px;font-weight:900;border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;width:34px;height:34px;cursor:pointer}'
    + '.o8-th{font-size:13px;color:#be185d;font-weight:800;margin-left:auto}'
    + '.o8-cal{width:100%;border-collapse:collapse;table-layout:fixed;min-width:700px}'
    + '.o8-cal th{font-size:12.5px;color:#64748b;padding:5px;border-bottom:1px solid #e2e8f0}.o8-cal th:first-child{color:#dc2626}'
    + '.o8-cal td{border:1px solid #e2e8f0;vertical-align:top;height:108px;padding:4px 5px;cursor:pointer;font-size:12px;line-height:1.35;background:#fff}'
    + '.o8-cal td.out{background:#f8fafc;cursor:default}.o8-cal td.hol{background:#fff1f2}.o8-cal td.today{outline:2.5px solid #2563eb;outline-offset:-2px}.o8-cal td.sel{background:#e6eefc}'
    + '.o8-dn{font-weight:900;font-size:13px;display:flex;justify-content:space-between;gap:4px}.o8-dn small{font-size:10.5px;color:#dc2626;font-weight:800;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
    + '.o8-it{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;border-radius:5px;padding:1px 5px;margin-top:2px;font-weight:700;word-break:keep-all}'
    + '.o8-it.dn{opacity:.5;text-decoration:line-through}.o8-more{color:#64748b;font-weight:800;font-size:11.5px;display:block;margin-top:2px}'
    + '.o8-cg{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}@media(max-width:1100px){.o8-cg{grid-template-columns:1fr}}'
    + '.o8-wk{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin-bottom:10px;background:#fff}.o8-wk h4{margin:0 0 2px;font-size:15px}.o8-wk h4 small{font-size:12px;color:#64748b;font-weight:700;margin-left:6px}'
    + '.o8-ck{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;padding:8px 0;border-top:1px dashed #e2e8f0;font-size:14px}.o8-ck:first-of-type{border-top:0}'
    + '.o8-ck>input{width:18px;height:18px;margin-top:3px;accent-color:#2563eb}.o8-ck.hl{background:#e6eefc;border-radius:8px;padding-left:6px;padding-right:6px}'
    + '.o8-ck b{font-weight:800}.o8-ck small{display:block;color:#64748b;font-size:12.5px}.o8-ck.dn b{text-decoration:line-through;opacity:.5}.o8-ck.ov b{color:#dc2626}'
    + '.o8-k{font-size:11px;font-weight:900;border-radius:6px;padding:0 6px;margin-right:4px}.o8-w{font-size:11px;font-weight:900;border-radius:6px;padding:0 6px;margin-right:4px;color:#fff}'
    + '.o8-cd{font-weight:900;font-size:13px;margin-right:6px}'
    + '.o8-sub{margin-top:3px}.o8-sub summary{cursor:pointer;font-size:12.5px;font-weight:800;color:#2563eb}.o8-sub label,.o8-dl{display:block;font-size:13px;padding:2px 0 2px 4px;cursor:pointer}'
    + '.o8-go{font-family:inherit;font-size:12px;font-weight:800;color:#2563eb;border:1.5px solid #2563eb;background:transparent;border-radius:12px;padding:0 8px;margin-top:3px;cursor:pointer}'
    + '.o8-prog{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.o8-prog .b{flex:1;min-width:160px;height:10px;border-radius:5px;background:#e2e8f0;overflow:hidden}.o8-prog .b i{display:block;height:100%;background:#2563eb}'
    + '.o8-ovr{font-size:13px;font-weight:900;color:#dc2626;background:#fde8e8;border-radius:8px;padding:0 8px}'
    + '.o8-daily{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;align-self:start;background:#f8fafc}.o8-daily h4{margin:0 0 4px;font-size:15px}'
    + '.o8-year{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}@media(max-width:1100px){.o8-year{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.o8-year{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '.o8-mon{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;cursor:pointer;text-align:left;font-family:inherit;color:inherit;display:flex;flex-direction:column;gap:5px}'
    + '.o8-mon.past{background:#f8fafc}.o8-mon.now{border-color:#2563eb;box-shadow:inset 0 0 0 1.5px #2563eb}'
    + '.o8-kw span{font-size:11.5px;background:#fce7f1;color:#be185d;border-radius:6px;padding:0 6px;font-weight:700;margin:0 3px 3px 0;display:inline-block}'
    + '.o8-t{border-collapse:collapse;font-size:13px;min-width:100%}.o8-t th,.o8-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center;white-space:nowrap}.o8-t th{background:#f8fafc;font-size:12px;color:#64748b}.o8-t td:first-child{text-align:left;font-weight:800}'
    + '.o8-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}@media(max-width:800px){.o8-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '.o8-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px}.o8-kpi .v{font-size:28px;font-weight:900;line-height:1.2}.o8-kpi .k{font-size:13px;color:#64748b;font-weight:800}'
    + '.o8-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}'
    + '.o8-mbox{background:#fff;border-radius:16px;max-width:860px;width:100%;padding:18px 20px}.o8-pages{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.o8-pages{grid-template-columns:1fr}}'
    + '.o8-pg{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}.o8-pg h5{margin:0 0 6px;font-size:12.5px;color:#64748b}.o8-kv{display:grid;grid-template-columns:56px minmax(0,1fr);gap:6px;margin:3px 0}.o8-kv b{color:#0d2240}'
    + '</style>';
}
function opsWho(w){ return w ? '<span class="o8-w" style="background:' + (OPS_WCOL[w] || '#64748b') + '">' + opsE(w) + '</span>' : ''; }
function opsKind(L){ var c = OPS_L[L]; return '<span class="o8-k" style="background:' + c[2] + ';color:' + c[1] + '">' + c[0] + '</span>'; }
function opsRow(it, showDate, hl){
  var st = it.st || [], done = opsDone(it), nd = 0; st.forEach(function(s, i){ if (OPS.ck[it.id + '#' + i]) nd++; });
  if (it.L === 'sch' || it.L === 'acad') return '<div class="o8-ck' + (hl ? ' hl' : '') + '"><span></span><div>' + (showDate ? '<span class="o8-cd">' + opsMd(it.d) + ' (' + OPS_DOW[opsDow(it.d)] + ')</span>' : '') + opsKind(it.L) + '<b>' + opsE(it.t) + '</b><small>' + opsE(it.sub) + '</small></div></div>';
  var k = opsJs(it.id);
  return '<div class="o8-ck' + (done ? ' dn' : '') + (opsOver(it) ? ' ov' : '') + (hl ? ' hl' : '') + '"><input type="checkbox"' + (done ? ' checked' : '') + ' onchange="opsTick(\'' + k + '\',this.checked)" aria-label="완료"><div>'
    + (showDate ? '<span class="o8-cd">' + opsMd(it.d) + ' (' + OPS_DOW[opsDow(it.d)] + ')</span>' : '') + opsKind(it.L) + opsWho(it.who) + '<b>' + opsE(it.t) + '</b>'
    + '<small>' + opsE(it.sub) + (opsOver(it) ? ' · 기한 지남' : '') + '</small>'
    + (st.length ? '<details class="o8-sub"' + (OPS.open === it.id ? ' open' : '') + ' ontoggle="OPS.open=this.open?\'' + k + '\':(OPS.open===\'' + k + '\'?\'\':OPS.open)"><summary>단계 ' + nd + '/' + st.length + '</summary>'
      + st.map(function(s, i){ return '<label><input type="checkbox"' + (OPS.ck[it.id + '#' + i] ? ' checked' : '') + ' onchange="OPS.open=\'' + k + '\';opsTick(\'' + k + '#' + i + '\',this.checked,\'' + k + '\',' + st.length + ')"> ' + opsE(s) + '</label>'; }).join('') + '</details>' : '')
    + (it.man ? '<button type="button" class="o8-go" onclick="opsMan(\'' + opsJs(it.man) + '\')">매뉴얼 ›</button>' : '')
    + '</div></div>';
}
function rOpsCal(){
  if (!OPS.y){ var t = opsToday(); OPS.y = +t.slice(0, 4); OPS.m = +t.slice(5, 7); OPS.sel = t; }
  if (!OPS.loaded && !OPS.loading) setTimeout(function(){ opsLoad(); }, 0);
  var h = opsCss() + '<div class="o8"><div class="o8-top"><div><h2>📅 운영 달력</h2><div style="font-size:12.5px;color:#64748b;font-weight:700;margin-top:2px">운영(학관노 매뉴얼) · 마케팅 · 학교 일정 · 수납·세금 · 지표를 한 달력에서 계획하고 체크합니다</div></div>'
    + '<div class="o8-seg">' + [['year', '1년 한눈에'], ['month', '월 달력 · 체크리스트'], ['kpi', '목표·지표']].map(function(v){ return '<button type="button" class="' + (OPS.view === v[0] ? 'on' : '') + '" onclick="OPS.view=\'' + v[0] + '\';render()">' + v[1] + '</button>'; }).join('') + '</div>'
    + eaBtn('🗓 학원 일정 넣기', "VIEW='cal';CT.edit=null;render()") + eaBtn('🔄', 'opsLoad(true)') + '</div>';
  if (OPS.err) h += '<div class="o8-card" style="color:#b91c1c;font-weight:800">' + opsE(OPS.err) + '</div>';
  if (!OPS.loaded) return h + '<div class="o8-card" style="color:#94a3b8;font-weight:700">불러오는 중…</div></div>';
  if (!OPS.plan) return h + '<div class="o8-card"><b>아직 운영 계획이 없습니다.</b><div style="color:#64748b;margin-top:4px">학관노 도구 백업 파일과 연간 마케팅 시트를 채팅에 주시면 Claude가 서버(ops_plan)에 넣습니다.</div></div></div>';
  h += '<div class="o8-bar"><span style="font-size:13px;font-weight:800;color:#64748b">층</span>' + Object.keys(OPS_L).map(function(L){ var c = OPS_L[L]; return '<button type="button" class="o8-chip' + (OPS.on[L] ? '' : ' off') + '" onclick="OPS.on.' + L + '=OPS.on.' + L + '?0:1;render()"><i style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('')
    + '<span style="font-size:13px;font-weight:800;color:#64748b;margin-left:10px">담당</span>' + ['전체', '원장', '실장', '강사', '조교'].map(function(w){ return '<button type="button" class="o8-chip' + (OPS.who === w ? ' sel' : '') + '" onclick="OPS.who=\'' + w + '\';render()">' + w + '</button>'; }).join('') + '</div>';
  if (OPS.view === 'year') h += opsYear(); else if (OPS.view === 'kpi') h += opsKpi(); else h += opsMonth();
  h += '</div>';
  if (OPS.man) h += opsManHtml(OPS.man);
  return h;
}
function opsMonth(){
  var y = OPS.y, m = OPS.m, P = OPS.plan, today = opsToday(), items = opsItems(y, m).filter(opsVis);
  var first = opsDow(opsYmd(y, m, 1)), dim = opsDim(y, m), rows = Math.ceil((first + dim) / 7), n = 1 - first;
  var holi = (typeof CT_HOLI !== 'undefined') ? CT_HOLI : {};
  var h = '<div class="o8-card"><div class="o8-mh"><button class="o8-nav" type="button" onclick="opsMove(-1)" aria-label="이전 달">‹</button><b>' + y + '년 ' + m + '월</b><button class="o8-nav" type="button" onclick="opsMove(1)" aria-label="다음 달">›</button>'
    + '<button class="o8-chip" type="button" onclick="opsMove(0)">오늘</button>'
    + '<span class="o8-th">' + opsE((P.themes || [])[m - 1] || '') + ' ' + ((P.keywords || [])[m - 1] || []).map(function(k){ return '#' + opsE(k); }).join(' ') + '</span></div>'
    + '<div style="overflow-x:auto"><table class="o8-cal"><thead><tr>' + OPS_DOW.map(function(d){ return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>';
  for (var w = 0; w < rows; w++){ h += '<tr>';
    for (var d = 0; d < 7; d++, n++){
      if (n < 1 || n > dim){ h += '<td class="out"></td>'; continue; }
      var ds = opsYmd(y, m, n), l = items.filter(function(x){ return x.d === ds && !(x.L === 'sch' && x.first === false); }), ho = holi[ds];
      var c = []; if (ho) c.push('hol'); if (ds === today) c.push('today'); if (ds === OPS.sel) c.push('sel');
      h += '<td class="' + c.join(' ') + '" onclick="opsPick(\'' + ds + '\')"><div class="o8-dn"><span' + (d === 0 ? ' style="color:#dc2626"' : '') + '>' + n + '</span>' + (ho ? '<small>' + opsE(ho) + '</small>' : '') + '</div>'
        + l.slice(0, 3).map(function(x){ var cc = OPS_L[opsOver(x) ? 'mkt' : x.L]; var red = opsOver(x); return '<span class="o8-it' + (opsDone(x) ? ' dn' : '') + '" title="' + opsE((x.who ? x.who + ' · ' : '') + x.t) + '" style="background:' + (red ? '#fde8e8' : cc[2]) + ';color:' + (red ? '#dc2626' : cc[1]) + '">' + (opsDone(x) ? '✓ ' : x.mark ? '● ' : '') + opsE(x.t) + '</span>'; }).join('')
        + (l.length > 3 ? '<span class="o8-more">외 ' + (l.length - 3) + '건</span>' : '') + '</td>';
    }
    h += '</tr>'; }
  h += '</tbody></table></div></div>';
  /* 체크리스트 (달력 바로 아래) */
  var todo = items.filter(function(x){ return x.L !== 'sch' && x.L !== 'acad'; }), dn = todo.filter(opsDone).length, ov = todo.filter(opsOver).length;
  h += '<div class="o8-card"><div class="o8-mh" style="justify-content:flex-start"><b style="text-align:left;min-width:0">✅ ' + m + '월 체크리스트</b></div>'
    + '<div class="o8-prog"><b>' + dn + ' / ' + todo.length + ' 완료</b>' + (ov ? '<span class="o8-ovr">기한 지남 ' + ov + '</span>' : '') + '<div class="b"><i style="width:' + (todo.length ? Math.round(dn / todo.length * 100) : 0) + '%"></i></div></div>'
    + '<div class="o8-cg"><div>';
  var wk = []; items.forEach(function(x){ if (x.L === 'sch' && x.first === false) return; var wi = Math.floor((Number(x.d.slice(8, 10)) + first - 1) / 7); (wk[wi] = wk[wi] || []).push(x); });
  for (var i = 0; i < 6; i++){ if (!wk[i]) continue; var a = Math.max(1, i * 7 - first + 1), b = Math.min(dim, i * 7 + 7 - first), td = wk[i].filter(function(x){ return x.L !== 'sch' && x.L !== 'acad'; });
    h += '<div class="o8-wk" id="o8w' + i + '"><h4>' + (i + 1) + '주 <small>' + m + '/' + a + ' ~ ' + m + '/' + b + ' · ' + td.filter(opsDone).length + '/' + td.length + '</small></h4>' + wk[i].map(function(x){ return opsRow(x, true, x.d === OPS.sel); }).join('') + '</div>'; }
  if (!items.length) h += '<div style="color:#64748b">이 달에는 할 일이 없습니다.</div>';
  h += '</div>' + opsDaily() + '</div></div>';
  return h;
}
function opsDaily(){
  var day = OPS.sel || opsToday(), P = OPS.plan, rk = P.ranks || {};
  var ms = (P.manuals || []).filter(function(x){ return x.cycle === 'daily' && x.steps && x.steps.length && (OPS.who === '전체' || rk[x.rank] === OPS.who); });
  var h = '<aside class="o8-daily"><h4>매일 체크리스트 <small style="font-size:12px;color:#64748b;font-weight:700">' + opsMd(day) + ' (' + OPS_DOW[opsDow(day)] + ') · 날마다 따로</small></h4>';
  ms.forEach(function(x){ var base = 'day|' + day + '|' + x.name, k = opsJs(base);
    h += '<div class="o8-ck"><span></span><div>' + opsWho(rk[x.rank]) + '<b>' + opsE(x.name) + '</b> <button type="button" class="o8-go" onclick="opsMan(\'' + opsJs(x.name) + '\')">매뉴얼</button>'
      + x.steps.map(function(s, i){ return '<label class="o8-dl"><input type="checkbox"' + (OPS.ck[base + '#' + i] ? ' checked' : '') + ' onchange="opsTick(\'' + k + '#' + i + '\',this.checked)"> ' + opsE(s) + '</label>'; }).join('') + '</div></div>'; });
  if (!ms.length) h += '<div style="color:#64748b;font-size:13px">매일 업무 매뉴얼이 없습니다.</div>';
  return h + '<div style="font-size:12px;color:#64748b;margin-top:6px">달력에서 날짜를 누르면 그 날 것으로 바뀝니다. 학관노 매뉴얼의 단계가 그대로 체크 칸입니다.</div></aside>';
}
function opsYear(){
  var y = OPS.y, P = OPS.plan, now = opsToday().slice(0, 7), h = '<div class="o8-year">';
  for (var m = 1; m <= 12; m++){
    var l = opsItems(y, m).filter(opsVis), c = function(L){ return l.filter(function(x){ return x.L === L; }).length; };
    var ex = []; l.forEach(function(x){ if (x.L === 'sch' && x.first){ var s = x.t.replace(/ \(.*/, ''); if (ex.indexOf(s) < 0) ex.push(s); } });
    var ev = []; l.forEach(function(x){ if (x.L === 'ops'){ var s = x.sub.split(' · ')[0]; if (ev.indexOf(s) < 0) ev.push(s); } });
    var ym = y + '-' + ('0' + m).slice(-2);
    h += '<button type="button" class="o8-mon' + (ym < now ? ' past' : '') + (ym === now ? ' now' : '') + '" onclick="OPS.m=' + m + ';OPS.sel=\'' + ym + '-01\';OPS.view=\'month\';render()">'
      + '<span style="display:flex;justify-content:space-between"><b style="font-size:17px">' + m + '월</b><small style="color:#64748b;font-weight:800">' + (ym === now ? '이번 달' : ym < now ? '지남' : '') + '</small></span>'
      + '<span style="font-size:13px;font-weight:800;color:#be185d">' + opsE((P.themes || [])[m - 1] || '') + '</span><span class="o8-kw">' + ((P.keywords || [])[m - 1] || []).map(function(k){ return '<span>#' + opsE(k) + '</span>'; }).join('') + '</span>'
      + (OPS.on.sch && ex.length ? '<span style="font-size:12.5px"><b style="color:#6d28d9">●</b> ' + opsE(ex.slice(0, 4).join(' · ')) + (ex.length > 4 ? ' 외 ' + (ex.length - 4) : '') + '</span>' : '')
      + (OPS.on.ops ? (ev.length ? '<span style="font-size:12.5px"><b style="color:#1d4ed8">●</b> ' + opsE(ev.join(' · ')) + '</span>' : '<span style="font-size:12px;color:#dc2626;font-weight:800">운영 계획 없음</span>') : '')
      + '<span style="display:flex;gap:4px;flex-wrap:wrap">' + ['ops', 'mkt', 'money'].filter(function(L){ return OPS.on[L]; }).map(function(L){ var cc = OPS_L[L]; return '<span class="o8-k" style="background:' + cc[2] + ';color:' + cc[1] + '">' + cc[0] + ' ' + c(L) + '</span>'; }).join('') + '</span></button>';
  }
  return h + '</div><div style="font-size:12.5px;color:#64748b;margin-top:8px">달을 누르면 그 달 달력과 체크리스트가 열립니다. 「운영 계획 없음」 = 행사 D-업무가 없는 달 · 학관노 도구에서 행사를 더하면 채워집니다.</div>';
}
function opsKpi(){
  var K = (OPS.plan && OPS.plan.kpi) || null, T = (OPS.plan && OPS.plan.traffic) || null, h = '';
  if (!K) return '<div class="o8-card">지표가 아직 없습니다.</div>';
  var sum = function(a){ return (a || []).reduce(function(s, v){ return s + (+v || 0); }, 0); }, reg = sum(K.reg), out = sum(K.out), ask = sum(K.ask), goal = K.goal || 0;
  h += '<div class="o8-kpis"><div class="o8-kpi"><div class="k">' + K.year + ' 신규생 목표 ' + goal + '명</div><div class="v">' + reg + '<span style="font-size:15px;color:#64748b"> / ' + goal + '</span></div><div class="o8-prog" style="margin:6px 0 0"><div class="b"><i style="width:' + (goal ? Math.min(100, Math.round(reg / goal * 100)) : 0) + '%"></i></div></div></div>'
    + '<div class="o8-kpi"><div class="k">퇴원</div><div class="v">' + out + '</div></div><div class="o8-kpi"><div class="k">순증</div><div class="v">' + (reg - out >= 0 ? '+' : '') + (reg - out) + '</div></div><div class="o8-kpi"><div class="k">문의 → 등록</div><div class="v">' + ask + ' → ' + reg + '</div></div></div>'
    + '<div style="font-size:12.5px;color:#64748b;margin:6px 0 14px">' + opsE(K.note || '연간 마케팅 시트에 적힌 숫자입니다.') + '</div>';
  h += '<div class="o8-card"><b>월별 문의 · 등록 · 퇴원 (' + K.year + ')</b><div style="overflow-x:auto;margin-top:6px"><table class="o8-t"><thead><tr><th></th>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function(m){ return '<th>' + m + '월</th>'; }).join('') + '</tr></thead><tbody>'
    + [['문의', K.ask], ['등록', K.reg], ['퇴원', K.out]].map(function(r){ return '<tr><td>' + r[0] + '</td>' + (r[1] || []).map(function(v){ return '<td>' + (v || '·') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
  if (T && T.rows) h += '<div class="o8-card"><b>작년 같은 주 방문 수</b> <span style="font-size:12.5px;color:#64748b">(시트 「작년」 줄 · 진할수록 많음)</span><div style="overflow-x:auto;margin-top:6px"><table class="o8-t"><thead><tr><th>주 시작</th>' + (T.weeks || []).map(function(w){ return '<th>' + opsE(w) + '</th>'; }).join('') + '</tr></thead><tbody>'
    + Object.keys(T.rows).map(function(k){ var a = T.rows[k], mx = Math.max.apply(null, a.filter(function(v){ return v != null; }).concat([1]));
      return '<tr><td>' + opsE(k) + '</td>' + a.map(function(v){ if (v == null) return '<td>·</td>'; var p = v / mx; return '<td style="background:rgba(245,158,11,' + (p * 0.55).toFixed(2) + ');' + (p > 0.8 ? 'font-weight:900' : '') + '">' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'
    + (T.note ? '<div style="font-size:13px;margin-top:8px;color:#92400e">' + opsE(T.note) + '</div>' : '') + '</div>';
  return h;
}
function opsManHtml(name){
  var x = ((OPS.plan && OPS.plan.manuals) || []).filter(function(t){ return t.name === name; })[0];
  if (!x) return '';
  var rk = (OPS.plan.ranks || {})[x.rank] || '', kv = function(k, v){ return v ? '<div class="o8-kv"><b>' + k + '</b><span>' + opsE(v) + '</span></div>' : ''; };
  return '<div class="o8-modal" onclick="if(event.target===this){OPS.man=\'\';render()}"><div class="o8-mbox"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><b style="font-size:18px">📘 ' + opsE(x.name) + '</b>' + opsWho(rk) + '<button type="button" class="o8-chip" style="margin-left:auto" onclick="OPS.man=\'\';render()">닫기 ✕</button></div>'
    + '<div class="o8-pages"><div class="o8-pg"><h5>1쪽 · 언제 → 누가 → 어디서 → 무엇을 → 어떻게</h5>' + kv('언제', x.timing) + kv('누가', rk + (x.with ? ' · ' + x.with : '')) + kv('어디서', x.where) + kv('무엇을', [x.what, (x.prep || []).length ? '준비: ' + x.prep.join(' / ') : ''].filter(Boolean).join(' · '))
    + '<div class="o8-kv"><b>어떻게</b><span></span></div><ol style="margin:4px 0 0;padding-left:22px">' + (x.steps || []).map(function(s){ return '<li>' + opsE(s) + '</li>'; }).join('') + '</ol></div>'
    + '<div class="o8-pg"><h5>2쪽 · 완료와 보고</h5>' + kv('완료', x.done) + kv('증빙', x.evid) + kv('보고', x.report) + ((x.ex || []).length ? '<div class="o8-kv"><b>예외</b><span>' + x.ex.map(opsE).join('<br>') + '</span></div>' : '') + '</div></div>'
    + '<div style="font-size:12px;color:#64748b;margin-top:8px">학관노 도구에서 쓴 매뉴얼입니다. 고치려면 학관노 도구에서 고친 뒤 백업 파일을 채팅에 주세요.</div></div></div>';
}
window.opsMan = function(n){ OPS.man = n; render(); };
window.opsMove = function(n){ if (!n){ var t = opsToday(); OPS.y = +t.slice(0, 4); OPS.m = +t.slice(5, 7); OPS.sel = t; } else { OPS.m += n; if (OPS.m > 12){ OPS.m = 1; OPS.y++; } if (OPS.m < 1){ OPS.m = 12; OPS.y--; } OPS.sel = opsYmd(OPS.y, OPS.m, 1); } render(); };
window.opsPick = function(ds){
  OPS.sel = ds; render();
  setTimeout(function(){ var el = document.querySelector('.o8-ck.hl'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
};
