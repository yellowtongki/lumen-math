/* ══════════════════════════════════════════════════════════════════════════
 * v19-122: 🆕 다음 시즌 (원장님만 보기 🔒) — 진도 레이스 화면 안 카드
 *   원장 지시 2026-10-16: 「2학기 기말 레이스를 지금 시작하되, 학생·학부모에게는 내가 공개를 누를 때까지 숨긴다」
 *
 *   ★ 학생앱·학부모앱이 읽는 키(race_season · race_board · race_watch · raid_board · race_history)는
 *     「📣 학생앱에 공개」(rnxPublish) 를 누를 때만 바뀐다. 이 부품의 다른 곳은 아래 키만 쓴다.
 *       race_season_draft  = 다음 시즌 설정 (이 카드가 저장)
 *       race_board_draft   = 그 순위표 (서버 sync/race_engine.js 가 계산 — 브라우저에서 세지 않는다)
 *       race_watch_draft   = 그 이상 신호 (서버)
 *       race_recount_req   = {at, by:'teacher'} 「🔄 다시 세기 요청」 → 서버(collect_request_worker.js)가 30분을 안 기다리고 바로 센다
 *   ★ 새 설정 칸: schoolFrom(학교별 시작일) · highMult(고등 «문제» 점수 ×배수) · leagues.combined(중고등부 한 줄)
 *     → 이 규칙은 서버 엔진만 안다. 학원앱 안의 옛 계산기 raceCompute 는 모른다(이미 엔진과 어긋나 있다 — 부 나누기 등).
 *       그래서 공개 뒤 새 규칙 시즌에서 「🔄 지금 다시 세기」를 누르면 브라우저에서 세지 않고 서버에 요청만 남긴다(아래 맨 끝).
 *   공개 순서(rnxPublish): ① 지난 시즌을 race_history 에 보관(없을 때만) → ② race_season ← 다음 시즌(open:true)
 *     → ③ race_board ← race_board_draft(open:true) → race_watch · raid_board(꺼짐) → ④ _draft 키 지우기
 * ══════════════════════════════════════════════════════════════════════════ */
window.RNX = { loaded: false, loading: false, season: null, board: null, req: null, edit: false, f: null, busy: false, timer: null };
var RNX_HM_OPTS = [1.0, 1.2, 1.3, 1.5, 1.8, 2.0];

/* ── 작은 도구 ── */
function rnxClone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function rnxVal(v){ if (typeof v === 'string'){ try { return JSON.parse(v); } catch(e){ return null; } } return v == null ? null : v; }
function rnxDayAfter(d){ var t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? '' : new Date(t + 86400000).toISOString().slice(0, 10); }
function rnxIsDate(d){ return /^\d{4}-\d\d-\d\d$/.test(String(d || '')) && !isNaN(Date.parse(d + 'T00:00:00Z')); }
function rnxSchoolKey(name){ return String(name || '').trim().replace(/고등학교$/, '고').replace(/중학교$/, '중').replace(/초등학교$/, '초'); }
function rnxRound100(x){ return Math.round((Number(x) || 0) / 100) * 100; }
function rnxFmt(iso){ try { return iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; } catch(e){ return String(iso || ''); } }
/* 새 규칙(엔진만 아는 칸)을 쓰는 시즌인가 */
window.rnxIsNewRules = function(s){
  if (!s) return false;
  var sf = s.schoolFrom && typeof s.schoolFrom === 'object' && Object.keys(s.schoolFrom).length;
  var hm = Number(s.highMult) > 0 && Number(s.highMult) !== 1;
  return !!(sf || hm || (s.leagues && s.leagues.combined));
};

/* ── 서버 읽기·쓰기 (lumen_store) ── */
async function rnxGet(sb, keys){
  var r = await sb.from('lumen_store').select('key,value').in('key', keys);
  if (r && r.error) throw new Error(r.error.message || String(r.error));
  var m = {}; ((r && r.data) || []).forEach(function(row){ m[row.key] = rnxVal(row.value); });
  return m;
}
async function rnxPut(sb, key, value){
  var r = await sb.from('lumen_store').upsert({ key: key, value: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (r && r.error) throw new Error(key + ' 저장 실패: ' + (r.error.message || r.error));
}
async function rnxDel(sb, key){
  var r = await sb.from('lumen_store').delete().eq('key', key);
  if (r && r.error) throw new Error(key + ' 지우기 실패: ' + (r.error.message || r.error));
}

window.rnxLoad = async function(force){
  if ((RNX.loaded && !force) || RNX.loading) return;
  var sb = getSupaClient(); if (!sb) return;
  RNX.loading = true; RNX.at = Date.now();
  try {
    var m = await rnxGet(sb, ['race_season_draft', 'race_board_draft', 'race_recount_req']);
    RNX.season = m.race_season_draft || null; RNX.board = m.race_board_draft || null; RNX.req = m.race_recount_req || null;
    RNX.loaded = true; RNX.err = '';
  } catch(e){ RNX.err = e.message || String(e); console.warn('[다음 시즌] 불러오기 실패', e); }
  RNX.loading = false;
  rnxPoll();
  if (VIEW === 'race') render();
};
/* 다시 세기를 요청해 두었으면 1분마다 결과를 다시 읽는다 (레이스 화면에 있을 때만) */
function rnxPending(){
  var q = RNX.req; if (!q || !q.at) return false;
  if (q.doneAt && Date.parse(q.doneAt) >= Date.parse(q.at)) return false;
  var b = RNX.board; return !(b && b.at && Date.parse(b.at) >= Date.parse(q.at));
}
function rnxPoll(){
  if (RNX.timer){ clearTimeout(RNX.timer); RNX.timer = null; }
  if (!rnxPending()) return;
  RNX.timer = setTimeout(function(){ RNX.timer = null; if (VIEW === 'race') rnxLoad(true); }, 60000);
}

/* ── 🆕 새 시즌 만들기 — 값 채우기 (순수 함수: 검사에서 그대로 부른다) ──
 *   live = 지금 race_season · cal = school_calendar · hist = race_history · today = 'YYYY-MM-DD' */
window.rnxNewId = function(today, live, hist){
  var base = 'S' + String(today || '').replace(/-/g, '').slice(0, 8);
  var used = {}; if (live && live.id) used[live.id] = 1;
  ((hist && hist.seasons) || []).forEach(function(x){ if (x && x.seasonId) used[x.seasonId] = 1; });
  var id = base, k = 0, abc = 'bcdefghij';
  while (used[id] && k < abc.length) id = base + abc[k++];
  return id;
};
/* 학교별 시작일: 그 학교 «다음 시험» 바로 앞 시험(2학기 중간)이 끝난 다음 날 — 단 지금 시즌 끝난 다음 날보다 이르지 않게.
 * 초등학교(시험 없음)는 넣지 않는다 → 시즌 시작일(from)부터. */
window.rnxAutoSchoolFrom = function(cal, liveTo){
  var out = {}, label = '', maxTo = '';
  var floor = liveTo ? rnxDayAfter(liveTo) : '';
  ((cal && cal.schools) || []).forEach(function(sc){
    if (!sc || sc.kind === '초' || /초등학교$/.test(sc.name || '')) return;
    var ex = (sc.exams || []).filter(function(e){ return e && rnxIsDate(e.from) && rnxIsDate(e.to); })
      .slice().sort(function(a, b){ return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    var nx = sc.next && sc.next.label ? sc.next.label : '';
    var ti = -1;
    for (var i = 0; i < ex.length; i++){
      if (nx ? ex[i].label === nx : (floor && ex[i].from >= floor && /기말/.test(ex[i].label || ''))){ ti = i; break; }
    }
    if (ti < 0) return;
    var tl = ex[ti].label || '';
    if (!label) label = tl;
    ex.forEach(function(e){ if (e.label === tl && e.from >= ex[ti].from && e.to > maxTo) maxTo = e.to; });
    var start = ti > 0 ? rnxDayAfter(ex[ti - 1].to) : '';
    if (!start) return;
    if (floor && start < floor) start = floor;
    var key = rnxSchoolKey(sc.name || sc.short); if (!key) return;
    out[key] = start;
  });
  return { map: out, label: label, maxTo: maxTo };
};
window.rnxMakeDraft = function(live, cal, hist, today){
  live = live || {};
  var t16 = function(ts){ return (ts || []).map(function(t){ return { k: t.k, n: t.n, at: rnxRound100((Number(t.at) || 0) * 1.6) }; }); };
  var defT = (typeof raceDefSeason === 'function') ? raceDefSeason().tiers : [];
  var from = live.to ? rnxDayAfter(live.to) : '2026-10-01';
  var auto = rnxAutoSchoolFrom(cal, live.to || '');
  var to = auto.maxTo && auto.maxTo > from ? auto.maxTo : '2026-12-22';
  var name = auto.label ? (auto.label + '고사 진도 레이스') : '2학기 기말고사 진도 레이스';
  var bz = live.buff || { on: false, max: 0.4 };
  var buff = { on: !!bz.on, max: Number(bz.max) || 0.4 };
  if (bz.boost) buff.boost = Object.assign({}, bz.boost, { on: false });
  var d = {
    id: rnxNewId(today, live, hist), name: name, from: from, to: to,
    schoolFrom: auto.map, highMult: 1.5,
    leagues: { combined: true, mid: true, high: true, elem: true, elemGrades: ['6'] },
    open: false, buff: buff,
    tiers: t16((live.tiers && live.tiers.length) ? live.tiers : defT),
    prizes: rnxClone(live.prizes || { total: 100000, count: 5, detail: [] }),
    showTop: Number(live.showTop) || 5, showDaysAfter: Number(live.showDaysAfter) || 7,
    created: new Date().toISOString(), updated: new Date().toISOString()
  };
  /* 초등부 따로 문턱이 있으면 같이 ×1.6 (중고등부는 공통 문턱) */
  if (live.bands && live.bands.elem && live.bands.elem.tiers && live.bands.elem.tiers.length) d.bands = { elem: { tiers: t16(live.bands.elem.tiers) } };
  if (live.todoPts === false) d.todoPts = false;
  return d;
};
window.rnxCreate = async function(){
  if (RNX.busy) return;
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  RNX.busy = true; render();
  try {
    var m = await rnxGet(sb, ['race_season', 'school_calendar', 'race_history', 'race_season_draft']);
    if (m.race_season_draft){ RNX.season = m.race_season_draft; plToast('다음 시즌이 이미 있습니다 — 그것을 보여 드립니다'); }
    else {
      var d = rnxMakeDraft(m.race_season, m.school_calendar, m.race_history, raceTodayK());
      await rnxPut(sb, 'race_season_draft', d);
      RNX.season = d; RNX.board = null;
      RNX.edit = true; RNX.f = rnxFormOf(d);
      await rnxRequestRecount(true);
      plToast('🆕 다음 시즌을 만들었습니다 (학생앱에는 안 보입니다) — 값을 확인하고 저장해 주세요');
    }
    RNX.loaded = true;
  } catch(e){ plToast('만들기 실패: ' + (e.message || e)); }
  RNX.busy = false; render();
};

/* ── ✏️ 고치기 ── */
function rnxFormOf(s){
  var f = rnxClone(s) || {};
  f._sf = Object.keys(f.schoolFrom || {}).sort(function(a, b){ return String(f.schoolFrom[a]).localeCompare(String(f.schoolFrom[b])) || a.localeCompare(b); })
    .map(function(k){ return { k: k, d: f.schoolFrom[k] }; });
  f.leagues = f.leagues || { combined: true, mid: true, high: true, elem: true, elemGrades: ['6'] };
  f.buff = f.buff || { on: false, max: 0.4 };
  f.prizes = f.prizes || { total: 0, count: 0, detail: [] };
  f.prizes.detail = f.prizes.detail || [];
  f.tiers = f.tiers || [];
  return f;
}
window.rnxEdit = function(on){ RNX.edit = !!on; RNX.f = on ? rnxFormOf(RNX.season) : null; render(); };
window.rnxSet = function(path, v){
  var f = RNX.f; if (!f) return;
  var p = String(path).split(':'), re = false;
  if (p[0] === 'name') f.name = String(v || '');
  else if (p[0] === 'from') f.from = String(v || '').slice(0, 10);
  else if (p[0] === 'to') f.to = String(v || '').slice(0, 10);
  else if (p[0] === 'sfk') f._sf[Number(p[1])].k = String(v || '').trim();
  else if (p[0] === 'sfd') f._sf[Number(p[1])].d = String(v || '').slice(0, 10);
  else if (p[0] === 'sfadd'){ f._sf.push({ k: '', d: f.from || '' }); re = true; }
  else if (p[0] === 'sfdel'){ f._sf.splice(Number(p[1]), 1); re = true; }
  else if (p[0] === 'hm'){ f.highMult = Number(v) || 1; re = true; }
  else if (p[0] === 'combined'){ f.leagues.combined = !!v; re = true; }
  else if (p[0] === 'tier') f.tiers[Number(p[1])].at = Math.max(0, Number(v) || 0);
  else if (p[0] === 'etier') f.bands.elem.tiers[Number(p[1])].at = Math.max(0, Number(v) || 0);
  else if (p[0] === 'prize') f.prizes.detail[Number(p[1])].w = Math.max(0, Number(v) || 0);
  else if (p[0] === 'total') f.prizes.total = Math.max(0, Number(v) || 0);
  else if (p[0] === 'buffOn'){ f.buff.on = !!v; re = true; }
  else if (p[0] === 'buffMax') f.buff.max = Number(v) || 0.4;
  if (re) render();
};
window.rnxSeasonFromForm = function(f){
  var s = rnxClone(f); delete s._sf;
  var sf = {};
  (f._sf || []).forEach(function(r){ if (r && String(r.k || '').trim() && rnxIsDate(r.d)) sf[String(r.k).trim()] = r.d; });
  s.schoolFrom = sf;
  s.prizes.count = (s.prizes.detail || []).length;
  s.open = false;
  return s;
};
function rnxCheck(f){
  if (!String(f.name || '').trim()) return '이름을 적어 주세요';
  if (!rnxIsDate(f.from) || !rnxIsDate(f.to) || f.from > f.to) return '기간을 확인해 주세요 (시작일이 종료일보다 늦습니다)';
  for (var i = 0; i < (f._sf || []).length; i++){
    var r = f._sf[i]; if (!String(r.k || '').trim() && !r.d) continue;
    if (!String(r.k || '').trim()) return (i + 1) + '번째 학교 이름이 비었습니다';
    if (!rnxIsDate(r.d)) return '「' + r.k + '」 시작일을 확인해 주세요';
    if (r.d > f.to) return '「' + r.k + '」 시작일이 시즌 종료일보다 늦습니다';
  }
  var ck = function(ts){ for (var j = 1; j < (ts || []).length; j++) if (ts[j].at <= ts[j - 1].at) return false; return true; };
  if (!ck(f.tiers) || !ck(f.bands && f.bands.elem && f.bands.elem.tiers)) return '리그 점수는 아래에서 위로 커져야 합니다';
  return '';
}
window.rnxSave = async function(){
  var f = RNX.f; if (!f) return;
  var bad = rnxCheck(f); if (bad){ plToast(bad); return; }
  var s = rnxSeasonFromForm(f);
  if (RACE.season && RACE.season.id && s.id === RACE.season.id){ plToast('다음 시즌 id 가 지금 시즌과 같습니다 — 「새 시즌 만들기」로 다시 만들어 주세요'); return; }
  s.updated = new Date().toISOString();
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  try {
    await rnxPut(sb, 'race_season_draft', s);
    RNX.season = s; RNX.edit = false; RNX.f = null;
    await rnxRequestRecount(true);
    plToast('저장했습니다 (학생앱에는 안 보입니다) — 서버에 다시 세기를 요청했어요');
  } catch(e){ plToast('저장 실패: ' + (e.message || e)); }
  render();
};

/* ── 🔄 다시 세기 요청 — 서버(엔진)가 센다. 브라우저에서는 세지 않는다 ── */
window.rnxRequestRecount = async function(quiet){
  var sb = getSupaClient(); if (!sb){ if (!quiet) plToast('서버에 연결되어 있지 않습니다'); return false; }
  var q = { at: new Date().toISOString(), by: 'teacher' };
  try {
    await rnxPut(sb, 'race_recount_req', q);
    RNX.req = q;
    var woke = false;
    try { if (typeof htsGhToken === 'function' && htsGhToken() && typeof htsWake === 'function') woke = await htsWake('race_recount_req'); } catch(e){}
    if (!quiet) plToast(woke ? '⚡ 서버를 깨웠습니다 — 1~3분 뒤 결과가 바뀝니다' : '다시 세기를 요청했습니다 — 서버가 다음 차례(보통 5분~몇 시간)에 셉니다');
    rnxPoll();
    if (!quiet) render();
    return true;
  } catch(e){ if (!quiet) plToast('요청 실패: ' + (e.message || e)); return false; }
};

/* ── 📣 학생앱에 공개 ── */
function rnxArchiveEntry(live, lb){
  var slim = function(rows){ return (rows || []).map(function(r){ return { code: r.code, nm: r.nm, sch: r.sch, gr: r.gr, pts: r.pts, n: r.n, rate: r.rate, hard: r.hard, days: r.days, rank: r.rank, tier: r.tier, label: r.label }; }); };
  var ok = lb && lb.seasonId === live.id;
  return { seasonId: live.id, name: live.name || '', from: live.from, to: live.to,
    endedAt: (ok && lb.at) || new Date().toISOString(), prizeTotal: Number((live.prizes || {}).total) || 0,
    elem: slim(ok && lb.elem), mid: slim(ok && lb.mid), high: slim(ok && lb.high),
    midAwards: (ok && lb.midAwards) || null, highAwards: (ok && lb.highAwards) || null, compare: (ok && lb.compare) || null,
    by: 'publish' };
}
window.rnxPublish = async function(){
  if (RNX.busy) return;
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  var m;
  try { m = await rnxGet(sb, ['race_season', 'race_board', 'race_history', 'race_season_draft', 'race_board_draft', 'race_watch_draft']); }
  catch(e){ plToast('불러오기 실패: ' + (e.message || e)); return; }
  var live = m.race_season, lb = m.race_board, d = m.race_season_draft, db = m.race_board_draft;
  if (!d){ plToast('다음 시즌이 없습니다'); return; }
  if (!db || !db.at || db.seasonId !== d.id){ plToast('아직 서버가 이 시즌을 세지 않았습니다 — 「🔄 다시 세기 요청」 뒤 순위가 나오면 공개해 주세요'); return; }
  if (live && live.id && live.id === d.id){ plToast('다음 시즌 id 가 지금 시즌과 같아 공개할 수 없습니다'); return; }
  if (d.updated && db.seasonUpdated !== undefined && db.seasonUpdated !== d.updated && !confirm('설정을 바꾼 뒤 아직 다시 세지 않은 순위표입니다. 그래도 공개할까요? (공개 뒤 서버가 곧 다시 셉니다)')) return;
  var msg = '📣 「' + (d.name || '다음 시즌') + '」을 학생앱·학부모앱에 공개할까요?\n\n'
    + '· 학생앱 진도 레이스 화면의 지난 시즌' + (live ? ' 「' + (live.name || '') + '」' : '') + ' 결과(순위·시상 화면)가 이 새 시즌으로 바뀝니다.\n'
    + '· 지난 시즌 결과는 「지난 시즌 보관함(race_history)」에 남습니다(없으면 지금 담습니다).\n'
    + '· 보스 레이드는 꺼집니다(새 시즌에는 레이드가 없습니다).\n'
    + '· 되돌리려면 Claude 에게 부탁해야 합니다.';
  if (!confirm(msg)) return;
  RNX.busy = true; render();
  var step = '';
  try {
    var now = new Date().toISOString();
    /* ① 지난 시즌 보관 — race_history 에 없을 때만 */
    step = '지난 시즌 보관';
    if (live && live.id){
      var hist = m.race_history || {};
      hist.seasons = Array.isArray(hist.seasons) ? hist.seasons : [];
      if (!hist.seasons.some(function(x){ return x && x.seasonId === live.id; })){
        hist.seasons.unshift(rnxArchiveEntry(live, lb));
        hist.seasons = hist.seasons.slice(0, 12); hist.updated = now;
        await rnxPut(sb, 'race_history', hist);
      }
    }
    /* ② 시즌 */
    step = '시즌 설정(race_season)';
    var ns = rnxClone(d); ns.open = true; ns.publishedAt = now; ns.updated = now; delete ns.paused;
    await rnxPut(sb, 'race_season', ns);
    /* ③ 순위표 */
    step = '순위표(race_board)';
    var nb = rnxClone(db); nb.open = true; nb.publishedAt = now; delete nb.draft; delete nb.seasonUpdated;
    await rnxPut(sb, 'race_board', nb);
    step = '이상 신호·레이드';
    await rnxPut(sb, 'race_watch', m.race_watch_draft || { at: now, seasonId: d.id, items: [] });
    await rnxPut(sb, 'raid_board', { at: now, on: false, list: [] });
    /* ④ 다음 시즌 키 지우기 */
    step = '다음 시즌 키 지우기';
    await rnxDel(sb, 'race_season_draft');
    await rnxDel(sb, 'race_board_draft');
    await rnxDel(sb, 'race_watch_draft');
    RACE.season = ns; RACE.board = nb; RACE.watch = m.race_watch_draft || null; RACE.edit = false;
    try { if (window.SEA_T) { SEA_T.open = false; SEA_T.draft = null; } } catch(e){}
    try { if (window.RAID) RAID.board = null; } catch(e){}
    RNX.season = null; RNX.board = null; RNX.edit = false; RNX.f = null;
    await rnxRequestRecount(true);   /* 공개한 시즌을 서버가 곧 다시 센다 */
    plToast('📣 공개했습니다 — 학생앱 진도 레이스가 「' + (ns.name || '') + '」으로 바뀝니다');
  } catch(e){
    plToast('공개 중 멈춤 (' + step + '): ' + (e.message || e) + ' — 화면을 새로 고친 뒤 상태를 확인해 주세요');
  }
  RNX.busy = false; render();
};

/* ── 카드 그리기 (rRaceBody 안, 시즌 마무리 카드 바로 아래) ── */
var RNX_BTN = 'padding:8px 14px;border-radius:9px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit;border:none';
function rnxIn(path, val, w, type, extra){
  return '<input type="' + (type || 'text') + '" value="' + esc2(val == null ? '' : val) + '" oninput="rnxSet(\'' + path + '\',this.value)"' + (extra || '')
    + ' style="width:' + (w || 90) + 'px;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:700;font-family:inherit;color:#0d2240">';
}
function rnxLbl(t, inner){ return '<div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:3px">' + t + '</div>' + inner + '</div>'; }
function rnxFormHtml(){
  var f = RNX.f; if (!f) return '';
  var h = '<div class="rnx-form" style="background:#f8fafc;border-radius:11px;padding:13px 15px;margin-top:10px">';
  h += '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">'
    + rnxLbl('이름', rnxIn('name', f.name, 240, 'text', ' id="rnx-name"'))
    + rnxLbl('시작일 (학교가 안 맞는 학생)', rnxIn('from', f.from, 140, 'date', ' id="rnx-from"'))
    + rnxLbl('종료일', rnxIn('to', f.to, 140, 'date', ' id="rnx-to"'))
    + rnxLbl('🎓 고등 문제 점수', '<select id="rnx-hm" onchange="rnxSet(\'hm\',this.value)" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:800;font-family:inherit">'
      + RNX_HM_OPTS.map(function(x){ return '<option value="' + x + '"' + (Number(f.highMult || 1) === x ? ' selected' : '') + '>×' + x.toFixed(1) + (x === 1 ? ' (안 곱함)' : '') + '</option>'; }).join('') + '</select>')
    + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer;padding-bottom:6px"><input type="checkbox" id="rnx-comb" ' + (f.leagues.combined ? 'checked ' : '') + 'onchange="rnxSet(\'combined\',this.checked)">중등·고등을 한 줄로 (「중고등부」)</label>'
    + '</div>';
  /* 학교별 시작일 */
  h += '<div style="font-size:12px;font-weight:900;color:#0d2240;margin:4px 0 6px">🏫 학교별 시작일 <span style="font-size:11px;color:#94a3b8;font-weight:700">학생 등록부 학교 이름 앞부분이 맞으면 그 날부터 셉니다 · 비우면 위 시작일</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">';
  (f._sf || []).forEach(function(r, i){
    h += '<div class="rnx-sf" style="display:flex;gap:7px;align-items:center">' + rnxIn('sfk:' + i, r.k, 120) + rnxIn('sfd:' + i, r.d, 140, 'date')
      + '<button onclick="rnxSet(\'sfdel:' + i + '\')" title="지우기" style="padding:4px 9px;border:1px solid #fecaca;background:#fff;color:#dc2626;border-radius:7px;font-weight:900;cursor:pointer;font-family:inherit">✕</button></div>';
  });
  h += '<button onclick="rnxSet(\'sfadd\')" style="align-self:flex-start;padding:4px 10px;border:1.5px dashed #cbd5e1;background:#fff;color:#475569;border-radius:7px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">+ 학교 넣기</button></div>';
  /* 리그 문턱 */
  var tierRow = function(ts, pre){ return (ts || []).map(function(t, i){ return '<div style="text-align:center"><div style="font-size:10.5px;color:#64748b;font-weight:800">' + esc2(t.n) + '</div>' + (i === 0 ? '<div style="font-size:12px;font-weight:800;color:#94a3b8;padding:6px 0">0</div>' : rnxIn(pre + ':' + i, t.at, 74, 'number')) + '</div>'; }).join(''); };
  h += '<div style="font-size:12px;font-weight:900;color:#0d2240;margin:4px 0 6px">🏆 리그 문턱 <span style="font-size:11px;color:#94a3b8;font-weight:700">지난 시즌 × 1.6 으로 채웠습니다</span></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><span style="font-size:11px;font-weight:800;color:#475569;width:62px;padding-top:16px">' + (f.leagues.combined ? '중고등부' : '중·고등부') + '</span>' + tierRow(f.tiers, 'tier') + '</div>';
  if (f.bands && f.bands.elem && f.bands.elem.tiers) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:11px;font-weight:800;color:#475569;width:62px;padding-top:16px">초등부</span>' + tierRow(f.bands.elem.tiers, 'etier') + '</div>';
  /* 상금 · 버프 */
  var sum = (f.prizes.detail || []).reduce(function(a, p){ return a + (Number(p.w) || 0); }, 0);
  h += '<div style="font-size:12px;font-weight:900;color:#0d2240;margin:4px 0 6px">💰 상금 <span style="font-size:11px;color:' + (sum === Number(f.prizes.total) ? '#0f8a4e' : '#dc2626') + ';font-weight:800">합계 ' + raceNum(sum) + '원 / 총상금 ' + raceNum(f.prizes.total) + '원</span></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">'
    + rnxLbl('총상금', rnxIn('total', f.prizes.total, 96, 'number'))
    + (f.prizes.detail || []).map(function(p, i){ return rnxLbl(esc2(p.r), rnxIn('prize:' + i, p.w, 86, 'number')); }).join('') + '</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'
    + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer"><input type="checkbox" id="rnx-buff" ' + (f.buff.on ? 'checked ' : '') + 'onchange="rnxSet(\'buffOn\',this.checked)">🔥 집중 버프 (플래너 올린 날 점수 ↑)</label>'
    + (f.buff.on ? '<span style="font-size:12px;font-weight:800;color:#475569">최대 ' + '<select onchange="rnxSet(\'buffMax\',this.value)" style="padding:5px 7px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-weight:800">'
      + [0.2, 0.3, 0.4, 0.5, 0.6].map(function(x){ return '<option value="' + x + '"' + (Number(f.buff.max) === x ? ' selected' : '') + '>×' + (1 + x).toFixed(1) + '</option>'; }).join('') + '</select></span>' : '')
    + '<span style="font-size:11px;color:#94a3b8;font-weight:700">추가 버프(boost)는 꺼 둡니다 — 공개 뒤 ⚙️ 시즌 설정에서 켤 수 있어요</span></div>';
  h += '<div style="display:flex;gap:8px"><button id="rnx-save" onclick="rnxSave()" style="' + RNX_BTN + ';background:#0d2240;color:#fff">💾 저장 (원장님만)</button>'
    + '<button onclick="rnxEdit(false)" style="' + RNX_BTN + ';background:#fff;color:#64748b;border:1.5px solid #e2e8f0">닫기</button></div>';
  return h + '</div>';
}
function rnxBoardHtml(){
  var s = RNX.season, b = RNX.board;
  var h = '<div style="margin-top:12px">';
  var stale = '';
  if (!b || !b.at) stale = '아직 서버가 이 시즌을 세지 않았습니다 — 「🔄 다시 세기 요청」을 눌러 주세요.';
  else if (b.seasonId !== s.id) stale = '다른 시즌 설정으로 센 결과입니다 — 다시 세기를 요청해 주세요.';
  else if (s.updated && b.seasonUpdated !== undefined && b.seasonUpdated !== s.updated) stale = '설정을 바꾼 뒤 아직 다시 세지 않았습니다.';
  if (rnxPending()) h += '<div style="background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin-bottom:8px">⏳ 서버에 다시 세기를 요청했습니다 (' + esc2(rnxFmt(RNX.req.at)) + ') — 끝나면 이 표가 바뀝니다 (1분마다 확인)</div>';
  if (stale) h += '<div style="background:#fff7ed;color:#9a3412;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin-bottom:8px">' + stale + '</div>';
  if (!b || !b.at) return h + '</div>';
  h += '<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-bottom:8px">🖥 서버 계산 ' + esc2(rnxFmt(b.at)) + ' · ' + esc2(b.from) + ' ~ ' + esc2(b.to)
    + (b.highMult ? ' · 🎓 고등 문제 ×' + b.highMult + ' ' + raceNum(b.hiTotal || 0) + '건' : '') + ' · 🔒 학생앱에는 안 보입니다</div>';
  var BN = Object.assign({ elem: '초등부 (체험)', mid: '중등부', high: '고등부' }, b.bandNames || {});
  ['mid', 'high', 'elem'].forEach(function(band){
    var rows = b[band]; if (!rows) return;
    h += '<div class="rnx-band" data-band="' + band + '" style="border:1.5px solid #eef2f7;border-radius:11px;padding:10px 12px;margin-bottom:9px;overflow-x:auto">'
      + '<div style="font-size:13px;font-weight:900;color:#0d2240;margin-bottom:6px">' + esc2(BN[band] === '초등부' ? '초등부 (체험)' : BN[band]) + ' <span style="font-size:11px;color:#94a3b8;font-weight:700">' + rows.length + '명</span></div>';
    if (!rows.length){ h += '<div style="font-size:12px;color:#94a3b8">학생 없음</div></div>'; return; }
    h += '<table style="border-collapse:collapse;width:100%;font-size:12px;min-width:560px"><thead><tr style="color:#64748b;text-align:right">'
      + '<th style="text-align:left;padding:4px 6px">순위</th><th style="text-align:left;padding:4px 6px">학생</th><th style="text-align:left;padding:4px 6px">학교</th><th style="text-align:left;padding:4px 6px">리그</th>'
      + '<th style="padding:4px 6px">점수</th><th style="padding:4px 6px">문항</th>' + (b.highMult ? '<th style="padding:4px 6px">고등 ×' + b.highMult + '</th>' : '')
      + '<th style="padding:4px 6px">정답률</th>' + (b.schoolFrom ? '<th style="padding:4px 6px">시작일</th>' : '') + '</tr></thead><tbody>';
    rows.forEach(function(r){
      h += '<tr class="rnx-row" style="border-top:1px solid #f1f5f9;text-align:right">'
        + '<td style="text-align:left;padding:4px 6px;font-weight:900">' + r.rank + '</td>'
        + '<td style="text-align:left;padding:4px 6px;font-weight:800">' + esc2(raceName(r.code, r.nm)) + '</td>'
        + '<td style="text-align:left;padding:4px 6px;color:#64748b">' + esc2((r.sch || '') + ' ' + (r.gr || '')) + '</td>'
        + '<td style="text-align:left;padding:4px 6px">' + raceBadge(r) + '</td>'
        + '<td style="padding:4px 6px;font-weight:900;color:#0d2240">' + raceNum(r.pts) + '</td>'
        + '<td style="padding:4px 6px">' + raceNum(r.n) + '</td>'
        + (b.highMult ? '<td style="padding:4px 6px;color:' + (r.hi ? '#7c3aed' : '#cbd5e1') + ';font-weight:800">' + raceNum(r.hi || 0) + '</td>' : '')
        + '<td style="padding:4px 6px">' + (r.n ? r.rate + '%' : '-') + '</td>'
        + (b.schoolFrom ? '<td style="padding:4px 6px;color:#64748b">' + esc2(String(r.from || b.from).slice(5).replace('-', '/')) + '</td>' : '')
        + '</tr>';
    });
    h += '</tbody></table></div>';
  });
  return h + '</div>';
}
window.rnxCardHtml = function(){
  /* 처음 · 2분 넘게 지났으면 뒤에서 다시 읽는다 (실패해도 2분 안에는 다시 안 부른다 — 그리기↔읽기 무한 반복 방지) */
  if (!RNX.loading && !RNX.busy && (!RNX.at || Date.now() - RNX.at > 120000)) setTimeout(function(){ rnxLoad(true); }, 0);
  var s = RNX.season;
  var h = '<div id="rnx-card" style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1.5px dashed #a5b4fc">';
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<div style="font-size:15px;font-weight:900;color:#312e81">🆕 다음 시즌 <span style="font-size:12px;color:#6366f1">(원장님만 보기 🔒)</span></div>'
    + '<span style="font-size:11.5px;color:#64748b;font-weight:700">학생앱·학부모앱에는 「📣 학생앱에 공개」를 누를 때까지 안 보입니다 · 점수는 서버가 셉니다</span></div>';
  if (!RNX.loaded){ return h + '<div style="font-size:12px;color:#94a3b8;margin-top:8px">' + (RNX.err ? '불러오기 실패: ' + esc2(RNX.err) : '불러오는 중…') + '</div></div>'; }
  if (!s){
    return h + '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button id="rnx-create" onclick="rnxCreate()" ' + (RNX.busy ? 'disabled ' : '') + 'style="' + RNX_BTN + ';background:linear-gradient(135deg,#6366f1,#312e81);color:#fff">🆕 새 시즌 만들기</button>'
      + '<span style="font-size:11.5px;color:#64748b;font-weight:700">학교 시험 일정(나이스)으로 학교별 시작일을 채우고, 지난 시즌 상금·버프를 가져옵니다. 고등 문제 ×1.5 · 중고등부 한 줄.</span></div></div>';
  }
  var sfk = Object.keys(s.schoolFrom || {});
  h += '<div style="margin-top:10px;font-size:13px;font-weight:900;color:#0d2240">' + esc2(s.name || '') + ' <span style="font-size:11.5px;color:#64748b;font-weight:700">' + esc2(s.from) + ' ~ ' + esc2(s.to) + ' · id ' + esc2(s.id || '') + '</span></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
    + (sfk.length ? sfk.map(function(k){ return '<span style="font-size:11px;font-weight:800;background:#eef2ff;color:#3730a3;border-radius:50px;padding:3px 9px">🏫 ' + esc2(k) + ' ' + esc2(String(s.schoolFrom[k]).slice(5).replace('-', '/')) + '~</span>'; }).join('') : '')
    + (Number(s.highMult) > 0 && Number(s.highMult) !== 1 ? '<span style="font-size:11px;font-weight:800;background:#f5f3ff;color:#6d28d9;border-radius:50px;padding:3px 9px">🎓 고등 문제 ×' + Number(s.highMult) + '</span>' : '')
    + ((s.leagues || {}).combined ? '<span style="font-size:11px;font-weight:800;background:#ecfdf5;color:#047857;border-radius:50px;padding:3px 9px">중고등부 한 줄</span>' : '')
    + ((s.buff || {}).on ? '<span style="font-size:11px;font-weight:800;background:#fff7ed;color:#c2410c;border-radius:50px;padding:3px 9px">🔥 버프 최대 ×' + (1 + (Number(s.buff.max) || 0.4)).toFixed(1) + '</span>' : '')
    + '<span style="font-size:11px;font-weight:800;background:#fefce8;color:#a16207;border-radius:50px;padding:3px 9px">💰 ' + raceNum((s.prizes || {}).total || 0) + '원</span>'
    + '</div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    + '<button id="rnx-edit" onclick="rnxEdit(' + (RNX.edit ? 'false' : 'true') + ')" style="' + RNX_BTN + ';background:#fff;color:#312e81;border:1.5px solid #c7d2fe">' + (RNX.edit ? '✏️ 고치기 닫기' : '✏️ 고치기') + '</button>'
    + '<button id="rnx-recount" onclick="rnxRequestRecount()" style="' + RNX_BTN + ';background:#eef2ff;color:#312e81">🔄 다시 세기 요청</button>'
    + '<button id="rnx-publish" onclick="rnxPublish()" ' + (RNX.busy ? 'disabled ' : '') + 'style="' + RNX_BTN + ';background:linear-gradient(135deg,#e8192c,#b91c1c);color:#fff;margin-left:auto">📣 학생앱에 공개</button>'
    + '</div>';
  if (RNX.edit) h += rnxFormHtml();
  h += rnxBoardHtml();
  return h + '</div>';
};

/* ── 공개 뒤: 새 규칙 시즌은 브라우저에서 세지 않는다 ──
 * 학원앱 raceCompute 는 schoolFrom · highMult · 중고등부를 모른다 → 「🔄 지금 다시 세기」(시즌 설정·레이드 저장 뒤 자동 포함)는
 * 서버에 다시 세기를 요청만 한다. 「🔥 버프 미리보기」도 막는다(엉뚱한 숫자를 보여 주지 않게). 옛 규칙 시즌은 예전 그대로. */
(function(){
  var oRe = window.raceRecount, oPv = window.raceBuffPreview;
  if (typeof oRe === 'function') window.raceRecount = async function(){
    if (rnxIsNewRules(RACE.season)){
      var ok = await rnxRequestRecount(true);
      plToast(ok ? '이 시즌은 새 규칙(학교별 시작일·고등 문제 ×배수·중고등부)이라 서버에서만 셉니다 — 다시 세기를 요청했어요' : '다시 세기 요청 실패');
      return;
    }
    return oRe.apply(this, arguments);
  };
  if (typeof oPv === 'function') window.raceBuffPreview = async function(){
    if (rnxIsNewRules(RACE.season)){ plToast('이 시즌은 새 규칙이라 이 화면의 미리보기가 맞지 않습니다 — 서버 미리보기(node sync/race_engine.js --dry --buff)로 확인해 주세요'); return; }
    return oPv.apply(this, arguments);
  };
})();
