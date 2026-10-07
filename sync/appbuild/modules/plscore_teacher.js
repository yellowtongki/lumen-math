/* ═══════════════════════════════════════════════════════════════
 * v19-54: 📒 플래너 점수 개편 — 10월 1일부터 (원장 결정 2026-09-28 · docs/planner_score_v2.md)
 *   매일 10 = 제출 4(2장 4 · 1장 2 · 지각 1) + 타임테이블 2 + 실천 2(50%·20%) + 구체 1 + 피드백 1
 *     · 점수 칸은 예전 이름을 그대로 쓴다(studyScore → 타임테이블 0~2, practiceScore → 실천 0~2) — 합산하는 곳이 많아서
 *     · AI는 숫자만 읽고(ttFilled·ttLife·practiceRate) 점수는 코드가 매긴다 — 기준선은 플래너 설정의 ttMinHours·ttMinLife (시범값 5·1)
 *     · 9월 30일까지의 플래너는 한 글자도 안 바뀐다 (promptVersion v2.1 그대로)
 *   주간 10 = 다음 주 계획 3 + 계획 실천 3 + 순공 사진 2 + 순공 종이 2 — 계산은 PW(공용), 이 화면은 「주간 점수판」
 *   계획 실천: 학생이 앱에 쓴 주간계획(wplan_<코드>) 중 그날 항목을 분석 프롬프트에 붙여 planCheck 를 받고 wplan_chk_<코드>에 적는다
 * ═══════════════════════════════════════════════════════════════ */
function plDateKey(s){
  var m = String(s || '').match(/(\d{4})[.\-\/]?(\d{2})[.\-\/]?(\d{2})/);
  return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
}
function plV2(s){ var k = plDateKey(s); return !!k && k >= PW.START; }
window.plV2 = plV2;
function plSb(){ return (typeof getSupaClient === 'function') ? getSupaClient() : window.sb; }

/* ── ① AI 프롬프트를 10월판(v3.0)으로 — 타임테이블 숫자·실천율만 읽게 ── */
window.plV3PromptEdit = function(lines, expectedDate){
  if (!plV2(expectedDate) || !Array.isArray(lines)) return lines;
  var out = [], i = 0, skip = false;
  for (i = 0; i < lines.length; i++){
    var L = String(lines[i]);
    if (L.indexOf('① studyScore') === 0){
      skip = true;
      out.push('① 타임테이블 (TIMETABLE 칸) — 점수는 코드가 매깁니다. 아래 숫자만 정확히 세세요');
      out.push('  - ttFilled: 아침 6시~밤 23시 사이 한 시간 칸 가운데 «색칠·표시·글씨»가 있는 칸의 개수 (0~18). 빈 칸은 세지 않음');
      out.push('  - ttLife: 그 칸들에 적힌 «생활» 활동의 종류 수 — 학교·등교·식사(아침/점심/저녁)·수면·낮잠·이동·운동·휴식·가족. 학원·숙제·인강·과목 공부는 생활이 아님');
      out.push('  - ttLifeItems: 생활 활동 이름 배열 (예: ["학교","저녁","잠"])');
      out.push('  - 타임테이블 칸이 사진에 없거나 전혀 읽을 수 없으면 ttFilled=0, ttLife=0 이고 unreadableItems 에 "studyScore" 를 넣으세요');
      out.push('  - studyScore 는 "0" 으로 두세요 (코드가 다시 계산합니다)');
      out.push('');
      continue;
    }
    if (skip && L.indexOf('② practiceScore') === 0) skip = false;
    if (skip) continue;
    if (/^  - \d+% 이상이면 1점$/.test(L)){ out.push('  - practiceRate 를 정확히 적으세요 (코드가 50% 이상 2점 · 20% 이상 1점으로 매깁니다). practiceScore 는 "0" 으로 두세요'); continue; }
    if (L.indexOf('【 채점 항목 (총 4점') === 0){ out.push('【 채점 항목 】'); continue; }
    out.push(L);
    if (L.indexOf('  "unreadableItems":') === 0){ out.push('  "ttFilled": 숫자,'); out.push('  "ttLife": 숫자,'); out.push('  "ttLifeItems": ["학교"],'); }
  }
  return out;
};
/* ── ② AI가 읽은 숫자로 10월판 점수 매기기 ── */
window.plV3Apply = function(analysis, expectedDate){
  if (!analysis) return analysis;
  var dk = plDateKey(analysis.date) || plDateKey(expectedDate);
  if (!dk || dk < PW.START) return analysis;
  var cfg = (typeof getPlannerConfig === 'function') ? getPlannerConfig() : {};
  var minH = Number(cfg.ttMinHours) || 5, minL = (cfg.ttMinLife === 0) ? 0 : (Number(cfg.ttMinLife) || 1);
  var ur = Array.isArray(analysis.unreadableItems) ? analysis.unreadableItems : [];
  var filled = Number(analysis.ttFilled) || 0, life = Number(analysis.ttLife) || 0;
  var tt = (filled >= minH ? 1 : 0) + (filled > 0 && life >= minL ? 1 : 0);
  var rate = parseInt(String(analysis.practiceRate || '').replace(/[^\d]/g, ''), 10) || 0;
  var pr = rate >= 50 ? 2 : (rate >= 20 ? 1 : 0);
  if (ur.indexOf('practiceScore') >= 0) pr = 0;
  analysis.studyScore = String(tt);
  analysis.practiceScore = String(pr);
  analysis.v3 = { tt: tt, filled: filled, life: life, rate: rate, minH: minH, minL: minL };
  analysis.promptVersion = 'v3.0';
  return analysis;
};

/* ── ③ 주간계획(앱) 대조 줄 · 결과 저장 ── */
var PLW = { cache: {}, at: {} };
async function plPlanOf(code, wMon){
  var now = Date.now();
  if (!PLW.cache[code] || now - (PLW.at[code] || 0) > 120000){
    try {
      var r = await plSb().from('lumen_store').select('key,value').in('key', ['wplan_' + code, 'codi_plan_' + code]);
      var got = {}; ((r && r.data) || []).forEach(function(row){ var v = row.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } got[row.key] = v; });
      PLW.cache[code] = { wp: got['wplan_' + code] || null, cp: got['codi_plan_' + code] || null }; PLW.at[code] = now;
    } catch(e){ PLW.cache[code] = { wp: null, cp: null }; }
  }
  var c = PLW.cache[code] || {};
  var w = c.wp && c.wp.weeks && c.wp.weeks[wMon];
  return (w && (w.items || []).length) ? w : null;   /* 코디 계획은 코디 대조(codiCheck)가 따로 맡는다 */
}
window.plPlanPromptLines = async function(stInfo, expectedDate){
  var code = String((stInfo && stInfo.lumen_rec_code) || ''), day = plDateKey(expectedDate);
  if (!code || !day || day < PW.START) return [];
  var W = PW.mon(day), d = PW.dow(day), plan = await plPlanOf(code, W);
  if (!plan) return [];
  /* v19-55: 코디 계획으로 비친 칸(학생앱 v2-112 달력 ↔ codi_plan_)은 코디 대조(codiCheck)가 맡는다 — 두 번 묻지 않는다 */
  var cp = (PLW.cache[code] || {}).cp, cpIds = {}; if (cp && cp.week === W) (cp.blocks || []).forEach(function(b){ cpIds[b.id] = 1; });
  var items = (plan.items || []).filter(function(it){ return +it.d === d && it.title && !cpIds[it.id]; });
  if (!items.length) return [];
  return ['', '━━━━━━━━━━━━━━━━━━━━━━━━━', '【 주간계획 대조 (추가) 】', '━━━━━━━━━━━━━━━━━━━━━━━━━', '',
    '이 학생이 이 날(' + day + ') 앱의 주간계획에 쓴 할 일은 다음과 같습니다:']
    .concat(items.map(function(it, i){ return '  ' + (i + 1) + '. [' + it.id + '] ' + (it.subj ? it.subj + ' ' : '') + it.title; }))
    .concat(['',
      '당일 플래너의 TASKS 전사와 대조해서, 각 할 일이 완료(O 또는 △) 표시된 줄과 «내용이 같거나 비슷하면» done=true, 아니면 false 로 판단하세요.',
      '(예: "쎈 42~45쪽" ↔ TASKS "[O] 쎈 42-45" 은 같은 것. 쪽수가 조금 달라도 같은 교재면 같은 것으로 봅니다. 플래너에 없으면 false.)',
      '출력 JSON에 다음 키를 «추가»하세요 (id 는 위 대괄호 안 글자 그대로):',
      '  "planCheck": [' + items.map(function(it){ return '{"id": "' + it.id + '", "done": true 또는 false}'; }).join(', ') + ']']);
};
window.plPlanCheckSave = async function(stInfo, analysis, expectedDate){
  var code = String((stInfo && stInfo.lumen_rec_code) || '');
  if (!code || !analysis || !Array.isArray(analysis.planCheck) || !analysis.planCheck.length) return;
  var day = plDateKey(analysis.date) || plDateKey(expectedDate); if (!day) return;
  var W = PW.mon(day), now = new Date().toISOString();
  try {
    var sb = plSb(); var r = await sb.from('lumen_store').select('value').eq('key', 'wplan_chk_' + code);
    var v = (r && r.data && r.data[0]) ? r.data[0].value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    v = v || { weeks: {} }; v.weeks = v.weeks || {}; v.weeks[W] = v.weeks[W] || {};
    analysis.planCheck.forEach(function(x){ if (x && x.id) v.weeks[W][String(x.id)] = { ok: !!x.done, at: now, src: 'planner', day: day }; });
    v.upd = now;
    await sb.from('lumen_store').upsert({ key: 'wplan_chk_' + code, value: v, updated_at: now }, { onConflict: 'key' });
  } catch(e){ console.warn('[주간계획 대조] 저장 실패', e); }
};

/* ── ④ 📅 주간 점수판 (VIEW='plweek') ── */
var PWB = { W: null, loaded: false, loading: false, at: 0, wp: {}, chk: {}, sg: {}, cp: {}, cd: {}, paper: { byCode: {} }, days: {}, only: '' };
window.plwLoad = async function(force){
  if (PWB.loading) return; if (PWB.loaded && !force && Date.now() - PWB.at < 60000) return; PWB.loading = true;
  try {
    var r = await plSb().from('lumen_store').select('key,value').or('key.like.wplan_%,key.like.sungong_%,key.eq.plweek_paper,key.eq.lumen_group_days,key.like.codi_plan_%,key.like.codi_done_%,key.like.codi_fixed_%');
    var wp = {}, chk = {}, sg = {}, cp = {}, cd = {}, fx = {}, paper = { byCode: {} }, days = {};
    ((r && r.data) || []).forEach(function(row){
      var k = String(row.key), v = row.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      if (k.indexOf('wplan_chk_') === 0) chk[k.slice(10)] = v;
      else if (k.indexOf('wplan_') === 0) wp[k.slice(6)] = v;
      else if (k === 'plweek_paper') paper = v || { byCode: {} };
      else if (k === 'lumen_group_days') days = v || {};
      else if (k.indexOf('sungong_') === 0 && k !== 'sungong_goals') sg[k.slice(8)] = (v && v.weeks) || {};
      else if (k.indexOf('codi_plan_') === 0) cp[k.slice(10)] = v;
      else if (k.indexOf('codi_done_') === 0) cd[k.slice(10)] = v;
      else if (k.indexOf('codi_fixed_') === 0) fx[k.slice(11)] = v;   /* v19-56: 학생 달력의 고정 일정 */
    });
    if (!paper.byCode) paper.byCode = {};
    PWB.wp = wp; PWB.chk = chk; PWB.sg = sg; PWB.cp = cp; PWB.cd = cd; PWB.fx = fx; PWB.paper = paper; PWB.days = days; PWB.loaded = true; PWB.at = Date.now();
  } catch(e){ console.warn('[주간 점수판] 불러오기 실패', e); PWB.loaded = true; PWB.at = Date.now(); }
  PWB.loading = false;
  if (VIEW === 'plweek') render();
  if (force && typeof plwRepublish === 'function') plwRepublish();   /* v19-62: 주간 점수 → 월 랭킹 */
};
function plwDefaultW(){ var t = PW.thisMon(), last = PW.add(t, -7); return last >= PW.W0 ? last : t; }
window.plwScore = function(st, W){
  var c = st.lumen_rec_code;
  return PW.week({ wMon: W, planNext: PW.planOf(PWB.wp[c], PWB.cp[c], PW.add(W, 7)), plan: PW.planOf(PWB.wp[c], PWB.cp[c], W),
    chk: PW.chkOf(PWB.chk[c], PWB.cd[c], W), sg: (PWB.sg[c] || {})[W] || null, paper: ((PWB.paper.byCode || {})[c] || {})[W] || null,
    days: PWB.days[st.group || ''] || null });
};
function plwDaySum(st, W){
  var sum = 0, n = 0, pl = st.lumen_planner || {};
  for (var i = 0; i < 7; i++){ var d = PW.add(W, i).replace(/-/g, '.'); if (pl[d] !== undefined && pl[d] !== null && pl[d] !== ''){ sum += Number(pl[d]) || 0; n++; } }
  return { sum: sum, n: n };
}
window.plwGo = function(dw){ PWB.W = PW.add(PWB.W || plwDefaultW(), 7 * dw); render(); };
window.plwOnly = function(k){ PWB.only = (PWB.only === k ? '' : k); render(); };
async function plwSavePaper(mut){
  var sb = plSb(); if (!sb){ alert('클라우드 연결이 없어 저장하지 못했습니다.'); return; }
  var r = await sb.from('lumen_store').select('value').eq('key', 'plweek_paper');
  var v = (r && r.data && r.data[0]) ? r.data[0].value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
  v = v || { byCode: {} }; if (!v.byCode) v.byCode = {};
  mut(v); v.upd = new Date().toISOString();
  var w = await sb.from('lumen_store').upsert({ key: 'plweek_paper', value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (w && w.error){ alert('저장 실패: ' + w.error.message); return; }
  PWB.paper = v; render();
  if (PWB._lastPaperCode && typeof plwRepublish === 'function') plwRepublish(PWB._lastPaperCode);   /* v19-62 */
}
window.plwPaper = function(code){
  var W = PWB.W || plwDefaultW(); PWB._lastPaperCode = code;
  plwSavePaper(function(v){ v.byCode[code] = v.byCode[code] || {}; v.byCode[code][W] = { at: new Date().toISOString() }; });
};
window.plwPaperOv = function(code, ov){
  var W = PWB.W || plwDefaultW(); PWB._lastPaperCode = code;
  plwSavePaper(function(v){ v.byCode[code] = v.byCode[code] || {}; if (!ov) delete v.byCode[code][W]; else { var cur = v.byCode[code][W] || {}; cur.ov = ov; if (!cur.at) cur.at = new Date().toISOString(); v.byCode[code][W] = cur; } });
};
function plwTag(j, released){
  var map = { ok: ['#dcfce7', '#15803d'], late: ['#fef3c7', '#b45309'], none: ['#fee2e2', '#b91c1c'], wait: ['#f1f5f9', '#64748b'] };
  var key = (j === 'none' && !released) ? 'wait' : j, c = map[key];
  return '<span style="font-size:10.5px;font-weight:900;border-radius:6px;padding:2px 7px;white-space:nowrap;background:' + c[0] + ';color:' + c[1] + '">' + (key === 'wait' ? '마감 전' : PW.KO[j]) + '</span>';
}
function plwTime(iso){ if (!iso) return ''; var d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
window.rPlWeek = function(){
  if (!PWB.loaded){ try { plwLoad(); } catch(e){} return '<div style="padding:40px;text-align:center;color:#94a3b8">⏳ 주간 점수 불러오는 중…</div>'; }
  if (!PWB.W) PWB.W = plwDefaultW();
  var W = PWB.W, esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  var list = (students || []).filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; });
  var rows = list.map(function(st){ return { st: st, s: plwScore(st, W), d: plwDaySum(st, W) }; });
  var nPlan = rows.filter(function(r){ return r.s.plan !== 'none'; }).length, nPaper = rows.filter(function(r){ return r.s.paperAt; }).length, nPhoto = rows.filter(function(r){ return r.s.photo !== 'none'; }).length;
  if (PWB.only === 'paper') rows = rows.filter(function(r){ return !r.s.paperAt; });
  if (PWB.only === 'plan') rows = rows.filter(function(r){ return r.s.plan === 'none'; });
  rows.sort(function(a, b){ return (b.s.total - a.s.total) || String(a.st.name || '').localeCompare(String(b.st.name || '')); });
  PWB.order = rows.map(function(r){ return r.st.lumen_rec_code; });   /* v19-56: 달력 ‹ › 넘기기 순서 */
  var chip = function(on, label, fn){ return '<button type="button" onclick="' + fn + '" style="border-radius:8px;padding:6px 12px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;' + (on ? 'background:#fff;color:#0d2240;border:1px solid #fff' : 'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3)') + '">' + label + '</button>'; };
  var s0 = rows.length ? rows[0].s : PW.week({ wMon: W });
  var h = '<div style="padding:14px 18px">';
  h += '<div style="background:linear-gradient(135deg,#0d2240,#164a7a);color:#fff;border-radius:12px 12px 0 0;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<span style="font-size:15px;font-weight:900">📅 주간 점수</span>'
    + '<span style="font-size:12px;opacity:.9">' + PW.md(W) + ' ~ ' + PW.md(PW.add(W, 6)) + ' 주' + (W === PW.W0 ? ' · 🧪 시범 주 (발표 10/5)' : '') + ' · ' + (s0.released ? '발표됨' : ('마감까지 ' + PW.left(PW.dueMs(W)))) + '</span>'
    + '<span style="font-size:12px;opacity:.9">다음 주 계획 <b style="color:#ffd54a">' + nPlan + '/' + list.length + '</b> · 순공 사진 <b style="color:#ffd54a">' + nPhoto + '</b> · 종이 가져옴 <b style="color:#ffd54a">' + nPaper + '</b></span>'
    + '<span style="flex:1"></span>' + chip(false, '‹ 지난 주', 'plwGo(-1)') + chip(W === plwDefaultW(), '이 주', 'PWB.W=null;render()') + chip(false, '다음 주 ›', 'plwGo(1)')
    + chip(PWB.only === 'paper', '종이 안 가져온 학생', "plwOnly('paper')") + chip(PWB.only === 'plan', '계획 안 낸 학생', "plwOnly('plan')") + chip(false, '🔄', 'plwLoad(true)') + '</div>';
  h += '<div style="overflow-x:auto;background:#fff;border:1px solid #e3e7ee;border-top:none;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:980px">';
  h += '<tr style="background:#f8fafc">' + ['학생', '다음 주 계획 (일 24시)', '계획 실천', '순공 사진 (일 24시)', '순공 종이 (학원)', '주간', '매일 합'].map(function(t){ return '<th style="text-align:left;font-size:11px;color:#64748b;font-weight:800;padding:9px 10px;border-bottom:1px solid #e3e7ee">' + t + '</th>'; }).join('') + '</tr>';
  rows.forEach(function(r){
    var st = r.st, s = r.s, c = st.lumen_rec_code, pn = PW.planOf(PWB.wp[c], PWB.cp[c], PW.add(W, 7)), sg = (PWB.sg[c] || {})[W], pr = ((PWB.paper.byCode || {})[c] || {})[W] || null;
    var grade = String(st.grade || '').replace('학교', '').replace('등', '');
    var paperCell = s.paperAt
      ? (plwTag(s.paper, true) + ' <span style="font-size:10.5px;color:#64748b">' + plwTime(s.paperAt) + (pr && pr.ov ? ' · 손 고침' : '') + '</span> ' + s.paperPt)
      : ('<button type="button" onclick="plwPaper(\'' + esc(c) + '\')" style="border:none;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:900;font-family:inherit;background:#0d2240;color:#fff;cursor:pointer">📔 가져옴 ✓</button>');
    paperCell += ' <select aria-label="종이 판정 고치기" onchange="plwPaperOv(\'' + esc(c) + '\',this.value)" style="font-size:11px;border:1px solid #e2e8f0;border-radius:6px;padding:2px 4px;font-family:inherit"><option value="">자동</option><option value="ok"' + (pr && pr.ov === 'ok' ? ' selected' : '') + '>제출</option><option value="late"' + (pr && pr.ov === 'late' ? ' selected' : '') + '>지각</option><option value="none"' + (pr && pr.ov === 'none' ? ' selected' : '') + '>미제출</option></select>';
    h += '<tr>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9;font-weight:900;color:#0d2240;white-space:nowrap"><button type="button" onclick="plwCal(\'' + esc(c) + '\')" title="주간계획표 보기" style="border:none;background:none;padding:0;font:inherit;font-weight:900;color:#0d2240;cursor:pointer;text-decoration:underline;text-decoration-color:#cbd5e1;text-underline-offset:3px">' + esc(st.name) + '</button><small style="font-size:10.5px;color:#94a3b8;font-weight:700;margin-left:4px">' + esc(grade) + '</small> <button type="button" onclick="plwCal(\'' + esc(c) + '\')" aria-label="주간계획표 보기" style="border:1px solid #e2e8f0;background:#fff;border-radius:6px;padding:1px 5px;font-size:11px;cursor:pointer">📅</button></td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9">' + plwTag(s.plan, s.released) + ' <span style="font-size:10.5px;color:#64748b">' + (pn && pn.submittedAt ? plwTime(pn.submittedAt) + ' · ' + (pn.items || []).length + '개' + (pn.src === 'codi' ? ' 🧭' : '') : '') + '</span> ' + s.planPt + '</td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9">' + (s.prac.n ? (s.prac.ok + '/' + s.prac.n + ' · ' + s.prac.rate + '%' + (s.prac.noEv ? ('<div style="font-size:10.5px;color:#b45309;font-weight:800" title="플래너엔 O 인데 그날 매쓰플랫 채점·아하노트 기록이 없는 수학 할 일">증거 없음 ' + s.prac.noEv + '</div>') : '')) : '<span style="color:#94a3b8">계획 없음</span>') + ' · ' + s.prac.pt + '</td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9">' + plwTag(s.photo, s.released) + ' <span style="font-size:10.5px;color:#64748b">' + (sg && sg.at ? plwTime(sg.at) + (sg.photo ? '' : ' · 사진 없음') : '') + '</span> ' + s.photoPt + '</td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9">' + paperCell + '</td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:15px;font-weight:900;color:#0d2240">' + s.total + '</td>'
      + '<td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#475569">' + r.d.sum + '<small style="color:#94a3b8">/' + (r.d.n * 10) + '</small></td></tr>';
  });
  h += '</table></div>';
  h += '<div style="margin-top:10px;font-size:11.5px;color:#374151;line-height:1.65;background:#fff;border:1px solid #e6eaf1;border-radius:12px;padding:10px 14px">'
    + '<b style="color:#0d2240">판정</b> · 계획·사진은 학생앱이 낸 시각으로 자동 — 일요일 24시 전 <b>제출</b>, 월요일 24시 전 <b>지각</b>, 그 뒤 <b>미제출</b>. '
    + '종이는 「📔 가져옴 ✓」을 누른 날이 <b>다음 주 첫 수업일</b>(반 수업 요일) 이하면 제출, 그 주 안이면 지각. 결석 등은 옆 칸에서 손으로 고친다. '
    + '학생 이름(또는 📅)을 누르면 그 학생의 <b>주간계획표 달력</b>이 뜬다. '
    + '「계획 실천」은 학생이 앱에 쓴 할 일이 그날 플래너 사진에 O로 보였는지(AI 대조) — 10월 1일부터 센다. 지각·종이는 들어오는 대로 점수에 더해진다.</div>';
  return h + '</div>';
};

/* ── ⑤ 📅 학생 주간계획표 보기 (v19-56 · 원장 지시 2026-09-28) — 학생앱 v2-112 달력과 같은 모양, 읽기만 ── */
var PWC = { code: null, W: null };
var PWC_COL = { '수학':['#fde2e1','#b3261e'], '영어':['#dbeafe','#1d4ed8'], '국어':['#ede9fe','#6d28d9'], '과학':['#d1fae5','#047857'], '사회':['#ffedd5','#c2410c'], '기타':['#e5e7eb','#374151'] };
var PWC_S0 = 14, PWC_SN = 34, PWC_H = 18;
function pwcSlotT(i){ var m = (PWC_S0 + i) * 30, h = Math.floor(m / 60); return (h < 10 ? '0' : '') + h + ':' + (m % 60 ? '30' : '00'); }
function pwcTSlot(t){ var p = String(t || '').split(':'); if (p.length < 2) return -1; return Math.round((Number(p[0]) * 60 + Number(p[1])) / 30) - PWC_S0; }
function pwcHm(m){ var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
function pwcFixed(st){
  var f = PWB.fx && PWB.fx[st.lumen_rec_code], arr = ((f && f.blocks) || PW.schoolBlocks(st.grade)).slice();   /* v19-57: 학년별 학교 기본 시간 */
  var g = String(st.group || ''), gd = (PWB.days || {})[g];
  if (gd && gd.length){
    var dg = (g.match(/(\d+)/) || [])[1] || '', h = 17, mi = '00';
    if (dg){ h = Number(dg.length >= 3 ? dg.slice(0, dg.length - 2) : dg); mi = dg.length >= 3 ? dg.slice(-2) : '00'; if (h < 9) h += 12; }
    var stm = h * 60 + Number(mi);
    arr.push({ id:'lumen', label:'루멘', type:'lumen', days: gd.map(function(d){ return (d + 6) % 7; }), start: pwcHm(stm), end: pwcHm(stm + 120), auto:true });
  }
  return { list: arr, mine: !!f };
}
window.plwCal = function(code, W){
  PWC.code = code;
  if (!W){ var b = PWB.W || plwDefaultW(), has = function(w){ var x = PWB.wp[code] && PWB.wp[code].weeks && PWB.wp[code].weeks[w]; return !!(x && (x.items || []).length); };
    W = (!has(b) && has(PW.add(b, 7))) ? PW.add(b, 7) : b; }   /* 표의 주가 비고 다음 주에 계획이 있으면 다음 주부터 */
  PWC.W = W; pwcShow();
};
window.plwCalClose = function(){ var ov = document.getElementById('plw-cal-ov'); if (ov) ov.remove(); PWC.code = null; };
window.plwCalWeek = function(W){ PWC.W = W; pwcShow(); };
window.plwCalStep = function(dir){ var o = PWB.order || [], i = o.indexOf(PWC.code); if (i < 0 || !o.length) return; PWC.code = o[(i + dir + o.length) % o.length]; pwcShow(); };
function pwcShow(){
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  var st = (students || []).filter(function(s){ return s && s.lumen_rec_code === PWC.code; })[0]; if (!st) return;
  var c = st.lumen_rec_code, W = PWC.W, base = PWB.W || plwDefaultW(), today = PW.day();
  var wk = (PWB.wp[c] && PWB.wp[c].weeks && PWB.wp[c].weeks[W]) || null;
  var codiOnly = false, items = (wk && wk.items) || [];
  if (!items.length){ var cp = PWB.cp[c]; if (cp && cp.week === W && (cp.blocks || []).length){ codiOnly = true; items = cp.blocks.map(function(b){ var it = b.item || {}; return { id: b.id, d: b.d, t: pwcSlotT(b.s), n: b.n, subj: it.subj || '수학', title: it.title || '', src: 'codi', part: b.part || '' }; }); } }
  var chk = PW.chkOf(PWB.chk[c], PWB.cd[c], W), fx = pwcFixed(st);
  var sub = wk && wk.submittedAt, j = sub ? PW.judge(sub, PW.add(W, -7)) : 'none';
  var mins = 0, okN = 0; items.forEach(function(it){ mins += (+it.n || 2) * 30; if (chk[it.id] && chk[it.id].ok) okN++; });
  var grade = String(st.grade || '').replace('학교', '').replace('등', '');
  var btn = function(on, label, fn){ return '<button type="button" onclick="' + fn + '" style="border-radius:8px;padding:6px 11px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;' + (on ? 'background:#fff;color:#0d2240;border:1px solid #fff' : 'background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.3)') + '">' + label + '</button>'; };
  var h = '<div style="background:#fff;border-radius:16px;width:min(920px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(13,34,64,.35)">';
  h += '<div style="background:linear-gradient(135deg,#0d2240,#164a7a);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + btn(false, '‹', 'plwCalStep(-1)') + '<span style="font-size:16px;font-weight:900">📅 ' + esc(st.name) + ' <small style="font-size:12px;opacity:.75;font-weight:700">' + esc(grade) + ' · ' + esc(st.group || '') + '</small></span>' + btn(false, '›', 'plwCalStep(1)')
    + '<span style="flex:1"></span>' + btn(W === base, PW.md(base) + ' 주', "plwCalWeek('" + base + "')") + btn(W === PW.add(base, 7), PW.md(PW.add(base, 7)) + ' 주 (다음)', "plwCalWeek('" + PW.add(base, 7) + "')")
    + '<button type="button" onclick="plwCalClose()" aria-label="닫기" style="border:none;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:32px;height:32px;font-size:15px;cursor:pointer">✕</button></div>';
  /* 요약 한 줄 */
  var tag = function(t, bg, fg){ return '<span style="font-size:11px;font-weight:900;border-radius:6px;padding:2px 8px;background:' + bg + ';color:' + fg + '">' + t + '</span>'; };
  h += '<div style="padding:10px 16px;border-bottom:1px solid #eef2f6;display:flex;gap:12px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:#334155;font-weight:700">'
    + '<span>' + PW.md(W) + ' ~ ' + PW.md(PW.add(W, 6)) + '</span>'
    + '<span>할 일 <b style="color:#0d2240">' + items.length + '개</b> · 공부 <b style="color:#0d2240">' + (Math.floor(mins / 60) ? Math.floor(mins / 60) + '시간 ' : '') + (mins % 60 ? (mins % 60) + '분' : (mins ? '' : '0')) + '</b></span>'
    + '<span>계획 제출 ' + (sub ? (j === 'ok' ? tag('제출', '#dcfce7', '#15803d') : (j === 'late' ? tag('지각', '#fef3c7', '#b45309') : tag('마감 뒤', '#fee2e2', '#b91c1c'))) + ' <span style="color:#64748b">' + plwTime(sub) + '</span>' : (Date.now() < PW.dueMs(PW.add(W, -7)) ? tag('아직 · 마감 ' + PW.left(PW.dueMs(PW.add(W, -7))), '#f1f5f9', '#64748b') : tag('안 냄', '#fee2e2', '#b91c1c'))) + '</span>'
    + (items.length ? '<span>실천 확인 <b style="color:#0d2240">' + okN + '/' + items.length + '</b></span>' : '')
    + (codiOnly ? tag('🧭 코디가 짠 계획 (학생 달력은 비어 있음)', '#f5f3ff', '#5b21b6') : '')
    + (fx.mine ? '' : tag('고정 일정 안 넣음 — 학교 기본값', '#fff7ed', '#9a3412')) + '</div>';
  /* 달력 */
  var cols = '44px repeat(7,minmax(0,1fr))';
  h += '<div style="overflow:auto;padding:12px 16px 16px"><div style="min-width:640px;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden">';
  h += '<div style="display:grid;grid-template-columns:' + cols + ';background:#0d2240;color:#fff"><div></div>';
  for (var d = 0; d < 7; d++){ var dt = PW.add(W, d); h += '<div style="text-align:center;font-size:12px;font-weight:900;padding:6px 0;' + (dt === today ? 'background:#ea580c;' : '') + (d === 5 ? 'color:#93c5fd;' : (d === 6 ? 'color:#fca5a5;' : '')) + '">' + PW.DOW[d] + ' <span style="font-size:10.5px;opacity:.8;font-weight:700">' + PW.md(dt) + '</span></div>'; }
  h += '</div><div style="display:grid;grid-template-columns:' + cols + ';height:' + (PWC_SN * PWC_H) + 'px"><div style="position:relative;background:#f8fafc;border-right:1px solid #e3e8ef">';
  for (var i = 0; i < PWC_SN; i += 2) h += '<span style="position:absolute;top:' + (i * PWC_H + 2) + 'px;left:0;right:0;text-align:center;font-size:10px;font-weight:800;color:#64748b">' + ((PWC_S0 + i) / 2) + '시</span>';
  h += '</div>';
  for (d = 0; d < 7; d++){
    var date = PW.add(W, d);
    h += '<div style="position:relative;border-right:1px solid #eef2f6;background-color:' + (date === today ? '#fff8f1' : '#fff') + ';background-image:linear-gradient(#e3e8ef 1px,transparent 1px),linear-gradient(#f3f5f8 1px,transparent 1px);background-size:100% ' + (PWC_H * 2) + 'px,100% ' + PWC_H + 'px">';
    fx.list.forEach(function(b){
      if ((b.days || []).indexOf(d) < 0) return; var a = Math.max(0, pwcTSlot(b.start)), e = Math.min(PWC_SN, pwcTSlot(b.end)); if (e <= a) return;
      var sty = b.type === 'lumen' ? 'background:#fee2e2;color:#b3261e;border:1.5px solid #b3261e' : (b.type === 'school' ? 'background:#e5e7eb;color:#6b7280' : 'background:#f1f5f9;color:#475569;border:1px dashed #94a3b8');
      h += '<div style="position:absolute;left:2px;right:2px;top:' + (a * PWC_H) + 'px;height:' + ((e - a) * PWC_H - 1) + 'px;border-radius:5px;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;' + sty + '">' + esc(b.label) + '</div>';
    });
    items.forEach(function(it){
      if (+it.d !== d || !it.t) return; var a = pwcTSlot(it.t), n = +it.n || 2; if (a < 0 || a >= PWC_SN) return; if (a + n > PWC_SN) n = PWC_SN - a;
      var cc = PWC_COL[it.subj] || PWC_COL['기타'], ok = chk[it.id] && chk[it.id].ok;
      h += '<div title="' + esc(it.subj + ' · ' + it.title + ' · ' + it.t + ' ' + (n * 30) + '분') + '" style="position:absolute;left:2px;right:2px;top:' + (a * PWC_H) + 'px;height:' + (n * PWC_H - 1) + 'px;border-radius:5px;border-left:3px solid ' + cc[1] + ';background:' + cc[0] + ';color:' + cc[1] + ';font-size:10.5px;font-weight:800;line-height:1.2;padding:2px 3px;overflow:hidden;box-sizing:border-box;z-index:1;' + (ok ? 'opacity:.6' : '') + (n === 1 ? ';white-space:nowrap;text-overflow:ellipsis' : '') + '">' + (ok ? '✓ ' : '') + (it.src === 'codi' ? '🧭' : '') + esc(it.title) + (it.part ? ' ' + esc(it.part) : '') + '</div>';
    });
    h += '</div>';
  }
  h += '</div></div>';
  var untimed = items.filter(function(it){ return !it.t; });
  if (untimed.length) h += '<div style="margin-top:10px;font-size:12px;color:#334155"><b style="color:#0d2240">⏱ 시간 안 정한 할 일</b> · ' + untimed.map(function(it){ return PW.DOW[+it.d || 0] + ' ' + esc(it.subj || '') + ' ' + esc(it.title) + ((chk[it.id] && chk[it.id].ok) ? ' ✓' : ''); }).join(' · ') + '</div>';
  if (!items.length) h += '<div style="margin-top:10px;font-size:12.5px;color:#64748b;font-weight:700">이 주에 쓴 계획이 아직 없어요.</div>';
  h += '<div style="margin-top:10px;font-size:11px;color:#64748b">✓ = 그날 플래너 사진에 O로 보였거나(AI 대조) 코디 화면에서 체크한 할 일 · 🧭 = 코디가 넣은 칸 · 학원앱에서는 보기만 해요(고치기는 학생앱)</div></div></div>';
  var ov = document.getElementById('plw-cal-ov');
  if (!ov){ ov = document.createElement('div'); ov.id = 'plw-cal-ov'; ov.setAttribute('role', 'dialog'); ov.style.cssText = 'position:fixed;inset:0;background:rgba(13,34,64,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px'; ov.onclick = function(e){ if (e.target === ov) plwCalClose(); }; document.body.appendChild(ov); }
  ov.innerHTML = h;
}
document.addEventListener('keydown', function(e){ if (!PWC.code) return; if (e.key === 'Escape') plwCalClose(); else if (e.key === 'ArrowRight') plwCalStep(1); else if (e.key === 'ArrowLeft') plwCalStep(-1); });

/* ── ⑥ 월 랭킹 = 매일 점수 합 + 주간 점수 합 (v19-62 · 원장 결정 2026-09-29 「한 랭킹으로 합치기」) ──
 *   · 주간 점수는 «그 주 일요일이 든 달»에 넣는다 (9/28~10/4 시범 주 → 10월)
 *   · 발표된 주(일요일 밤이 지난 주)만 — 지각·종이는 들어오는 대로 다시 계산된다
 *   · calcPlannerRankingForMonth(원래 코드)가 이 값을 더한다 → 학생앱 랭킹 · 📔 플래너 리그(상금)가 같은 합계를 쓴다 */
window.plwMonthWeeks = function(ym){
  var out = [], W = PW.W0;
  for (var i = 0; i < 80; i++){ var sun = PW.add(W, 6), m = sun.slice(0, 7); if (m > ym) break; if (m === ym && Date.now() >= PW.dueMs(W)) out.push(W); W = PW.add(W, 7); }
  return out;
};
window.plwMonthWeekly = function(st, ym){
  if (!PWB.loaded || !st || !st.lumen_rec_code) return 0;
  var s = 0; plwMonthWeeks(ym).forEach(function(W){ s += plwScore(st, W).total; }); return s;
};
/* 학생앱에 보낼 주별 점수 — 발표된 주만 */
window.plwStudentWeeks = function(st){
  var out = {}; if (!PWB.loaded || !st || !st.lumen_rec_code) return out;
  var W = PW.W0;
  for (var i = 0; i < 80; i++){ if (Date.now() < PW.dueMs(W)) break; var s = plwScore(st, W); out[W] = { t: s.total, plan: s.planPt, prac: s.prac.pt, photo: s.photoPt, paper: s.paperPt }; W = PW.add(W, 7); }
  return out;
};
/* 주간 점수가 바뀌었을 때(점수판을 열 때 · 종이 가져옴) 랭킹을 다시 올린다. code 를 주면 그 학생 점수표(student_planner_)도 */
window.plwRepublish = async function(code){
  try {
    if (code){ var st = (students || []).filter(function(s){ return s && s.lumen_rec_code === code; })[0]; if (st && typeof publishPlannerDataForStudent === 'function'){ await publishPlannerDataForStudent(st); return; } }
    var sb = plSb(); if (!sb || typeof calcPlannerRankingForMonth !== 'function') return;
    var now = new Date(), ymThis = getCurrentYearMonth(), pd = new Date(); pd.setMonth(pd.getMonth() - 1);
    var ymPrev = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0');
    var rows = [[ymThis, calcPlannerRankingForMonth(ymThis)], [ymPrev, calcPlannerRankingForMonth(ymPrev)]];
    for (var i = 0; i < rows.length; i++){ if (!rows[i][1].length && i > 0) continue;
      await sb.from('lumen_store').upsert({ key: 'planner_ranking_' + rows[i][0], value: { month: rows[i][0], ranking: rows[i][1], updatedAt: now.toISOString() }, updated_at: now.toISOString() }, { onConflict: 'key' }); }
    if (typeof lgPlannerPublish === 'function'){ try { await lgPlannerPublish(); } catch(e2){} }
  } catch(e){ console.warn('[주간 → 랭킹] 다시 올리기 실패', e); }
};
