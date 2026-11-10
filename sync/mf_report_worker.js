#!/usr/bin/env node
/**
 * 📑 매쓰플랫 월간보고서 — 학원앱에서 한눈에 확인·의견 고치기·학부모앱 공개 (2026-11-01 원장 「여러 학생을 하나씩 열어봐서
 *    확인해야 해서 시간이 너무 오래 걸린다 · 학원앱에서 쉽게 확인하고 배포하는 방법 · 상의하자」 → 「학원앱 보고서 화면도 만들자」)
 *
 *  매쓰플랫 선생님 웹(10/29 판)이 쓰는 주소를 그대로 쓴다:
 *    목록  GET  /v2/report/custom?studentIds=..   · 내용 GET /v2/report/custom/{id}/scoring (request.commentComponent.comment · 설정)
 *    계산  POST /v2/report/custom/scoring (저장 안 함) · AI 의견 POST https://ai.mathflat.com/ai/report-comment
 *    만들기 POST /v2/report/custom (비공개로 생긴다) · 고치기 PUT /v2/report/custom/{id}
 *    공개  POST /v2/report/custom/share/parent-app {reportIds, shouldSendSmsToParent} · 비공개 POST /v2/report/custom/unshare/parent-app
 *
 *  저장(lumen_store): mfrep_<YYYY-MM> = { month, at, rows:[…], missing:[…] }  ← 학원앱이 읽는다 (학생 이름·의견 — 서버에만, 저장소엔 안 올림)
 *                     mfrep_req = { status:'requested'|'running'|'done'|'error', action, month, items, ids, sms, at }  ← 학원앱이 쓴다
 *                     mfrep_log = 최근 30번 처리 기록
 *                     mfrep_pub_<학습코드> = { code, upd, months:{ 'YYYY-MM': {숫자=매쓰플랫 그대로 · comment · lumen:{hw,aha,plan}} } }
 *                       ← 루멘 학부모앱이 자기 아이 것만 읽는다 (2026-11-10 · publish/unpublish 요청에 lumen:true 일 때 · mf:false 면 매쓰플랫은 안 건드림)
 *  실행: node sync/mf_report_worker.js --req            (요청 하나 처리 — collect_request_worker 가 5분마다 부른다)
 *        node sync/mf_report_worker.js --list 2026-10   (목록만 새로)
 *        node sync/mf_report_worker.js --make 2026-10 [--only I123,I456]   (그 달 보고서 «비공개»로 만들기 — 이미 있는 학생은 건너뜀)
 *        node sync/mf_report_worker.js --auto           (매달 2일: 지난달 보고서가 없으면 비공개로 만들고 목록 저장)
 *  환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID · MATHFLAT_PASSWORD (값은 어디에도 적지 않는다)
 *  ⚠ 학부모앱 공개는 «원장님이 학원앱에서 누른 요청»으로만 한다. --make·--auto 는 절대 공개하지 않는다.
 */
const MF = 'https://api.mathflat.com', AI = 'https://ai.mathflat.com', WEB = 'https://teacher.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SH = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const H = { 'content-type': 'application/json', accept: 'application/json, text/plain, */*', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: WEB, referer: WEB + '/' };
const COMPS = ['COVER', 'MONTHLY', 'COMMENT', 'WEEKLY', 'LEVEL', 'STUDY_HISTORY', 'STUDY_PERFORMANCE', 'SCORING_RESULT', 'STUDY_EVALUATION'];
const COMMENT_MAX = 650;   // 매쓰플랫 화면의 의견 글자 한도
const log = (...a) => console.log('[' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ']', ...a);
const argv = process.argv.slice(2), has = (n) => argv.includes(n), arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

/* ── Supabase ── */
async function getKv(k) { const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(k)}&select=value`, { headers: SH }); if (!r.ok) return null; const j = await r.json(); let v = j[0] ? j[0].value : null; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return v; }
async function setKv(k, v) { const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...SH, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: k, value: v, updated_at: new Date().toISOString() }]) }); if (!r.ok) throw new Error('저장 실패 ' + k + ' ' + r.status); }

/* ── 매쓰플랫 ── */
let A = null;
async function login() {
  const r = await fetch(MF + '/v2/login', { method: 'POST', headers: H, body: JSON.stringify({ id: String(process.env.MATHFLAT_ID || '').trim(), password: String(process.env.MATHFLAT_PASSWORD || '').trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json(); if (!r.ok || !j.accessToken) throw new Error('매쓰플랫 로그인 실패 ' + (j.code || r.status));
  A = { ...H, authorization: 'Bearer ' + j.accessToken, 'x-auth-token': j.accessToken };
}
async function mf(method, p, body, host) {
  for (let i = 0; ; i++) {
    const r = await fetch((host || MF) + p, { method, headers: A, body: body !== undefined ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (r.ok) return j && j.data !== undefined && j.comment === undefined ? j.data : j;
    if (i < 2 && (r.status === 401 || (j && j.code === 'UNAUTHORIZED'))) { await login(); continue; }   // 20분쯤 지나면 로그인이 풀린다
    if (i < 2 && (r.status === 429 || r.status >= 500)) { await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); continue; }
    const e = new Error(`${(j && j.code) || r.status} ${(j && j.message) || ''} @ ${p}`.trim()); e.code = j && j.code; throw e;
  }
}
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return { y, m, start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}`, title: `${y}년 ${String(m).padStart(2, '0')}월 보고서` }; };
async function activeStudents() { const st = await mf('GET', '/students?size=500'); return (st.content || st || []).filter((s) => s.status === 'ACTIVE'); }
async function monthReports(ids, ym) {
  const { y, m } = monthRange(ym), out = [];
  for (let i = 0; i < ids.length; i += 40) {
    for (let page = 0; page < 10; page++) {
      const r = await mf('GET', `/v2/report/custom?page=${page}&size=200&studentIds=${ids.slice(i, i + 40).join(',')}`);
      (r.content || []).forEach((x) => { if (x.year === y && x.month === m) out.push(x); });
      if (r.last !== false) break;
    }
  }
  return out;
}

/* ── 목록 저장 (학원앱이 읽는 것) ── */
async function buildList(ym) {
  const act = await activeStudents(), byId = {}; act.forEach((s) => { byId[s.id] = s; });
  const reps = await monthReports(act.map((s) => s.id), ym);
  /* 한 학생에 같은 달 보고서가 여럿이면 가장 최근 것 */
  const pick = {}; reps.forEach((x) => { const o = pick[x.studentId]; if (!o || String(x.createdAt) > String(o.createdAt)) pick[x.studentId] = x; });
  const rows = [];
  for (const sid of Object.keys(pick)) {
    const x = pick[sid], s = byId[sid] || {};
    let comment = '', commentOn = false;
    try { const d = await mf('GET', `/v2/report/custom/${x.id}/scoring`); const q = d.request || {}; comment = String((q.commentComponent || {}).comment || ''); commentOn = (q.components || []).includes('COMMENT'); } catch (e) { log('  내용 읽기 실패', x.id, e.message); }
    rows.push({ sid, name: s.name || x.studentName || '', grade: (s.schoolType === 'MIDDLE' ? '중' : s.schoolType === 'HIGH' ? '고' : s.schoolType === 'ELEMENTARY' ? '초' : '') + (s.grade || ''),
      reportId: x.id, title: x.title, scoringCount: (x.metric || {}).scoringCount || 0, correctRate: (x.metric || {}).correctRate || 0, rank: (x.metric || {}).rank || 0,
      shared: !!x.sharedToParent, pdf: x.pdfStatus, createdAt: x.createdAt, comment, commentOn, n: reps.filter((r) => r.studentId === sid).length });
  }
  rows.sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || String(a.name).localeCompare(String(b.name), 'ko'));
  /* ★ 2026-11-10: 루멘 학습코드 · 루멘 학부모앱 공개 여부(mfrep_pub_<코드>.months[ym]) */
  try {
    const cm = await codeMap(), codes = [];
    rows.forEach((r) => { r.code = cm[r.sid] || ''; if (r.code) codes.push(r.code); });
    const pubs = await getKvMany(codes.map((c) => 'mfrep_pub_' + c));
    rows.forEach((r) => { const p = r.code ? pubs['mfrep_pub_' + r.code] : null; r.lumen = !!(p && p.months && p.months[ym]); r.lumenAt = r.lumen ? (p.months[ym].at || null) : null; });
  } catch (e) { log('  루멘 공개 여부 읽기 실패', e.message); }
  const missing = act.filter((s) => !pick[s.id]).map((s) => ({ sid: s.id, name: s.name }));
  const val = { month: ym, at: new Date().toISOString(), rows, missing };
  await setKv('mfrep_' + ym, val);
  log(`📑 ${ym} 목록 저장 — 보고서 ${rows.length}명 · 공개 ${rows.filter((r) => r.shared).length} · 의견 있음 ${rows.filter((r) => r.comment.trim()).length} · 보고서 없음 ${missing.length}`);
  return val;
}

/* ── 보고서 만들기 (비공개) ── */
async function makeMonth(ym, only) {
  const R = monthRange(ym); let act = await activeStudents();
  if (only && only.length) act = act.filter((s) => only.includes(s.id));
  const done = new Set((await monthReports(act.map((s) => s.id), ym)).map((x) => x.studentId));
  let made = 0, none = 0, fail = 0;
  for (const s of act) {
    if (done.has(s.id)) continue;
    try {
      const fv = { startDate: R.start, endDate: R.end, title: R.title, studentWorksheetIds: null, studentWorkbookIds: null, assignedCasIds: null, worksheetTags: null, workbookTypes: null, casTypes: [], includeSelfLearning: true, components: COMPS, comparisonGroup: 'NATIONAL', additionalScore: 0 };
      const sc = await mf('POST', '/v2/report/custom/scoring', { studentId: s.id, ...fv, studyEvaluationComparisonGroup: 'GRADE', comparedStudentIds: null });
      const q = sc.request; if (!q || !(q.scoringCount > 0)) { none++; continue; }   // 그 달 채점 기록이 없으면 만들지 않는다(매쓰플랫도 같다)
      let comment = '';
      try { const ai = await mf('POST', '/ai/report-comment', { studentName: s.name, comparisonType: 'NATIONAL', rank: q.rank || 0, correctRate: q.correctRate || 0, scoringCount: q.scoringCount || 0, level: q.level || 0, monthlyComponent: q.monthlyComponent }, AI); comment = String((ai && ai.comment) || '').slice(0, COMMENT_MAX); } catch (e) { log('  AI 의견 실패', s.id, e.message); }
      await mf('POST', '/v2/report/custom', { students: [{ studentId: s.id, studentWorksheetIds: null, studentWorkbookIds: null, assignedCasIds: null, worksheetTags: null, workbookTypes: null, casTypes: [], includeSelfLearning: true, components: COMPS, aiCommentUsed: !!comment, comparisonGroup: 'NATIONAL', additionalScore: 0, request: { ...q, commentComponent: { comment } }, chapters: sc.chapters || [] }], source: 'CUSTOM_CREATE', groupKey: s.id, groupName: s.name, groupType: 'student' });
      made++;
    } catch (e) { fail++; log('  만들기 실패', s.id, e.message); }
  }
  log(`📑 ${ym} 보고서 만들기(비공개) — 새로 ${made} · 이미 있음 ${done.size} · 채점 없음 ${none} · 실패 ${fail}`);
  return { made, had: done.size, none, fail };
}

/* ── 의견 고치기 — 매쓰플랫이 저장해 둔 설정·내용 그대로, 의견 글만 바꾼다 ── */
async function setComment(reportId, text) {
  const d = await mf('GET', `/v2/report/custom/${reportId}/scoring`);
  const q = { ...(d.request || {}) }; if (!q.startDate) throw new Error('보고서 내용을 못 읽음');
  q.commentComponent = { comment: String(text || '').slice(0, COMMENT_MAX) };
  const comps = (q.components || []).slice(); if (!comps.includes('COMMENT')) comps.push('COMMENT');   // 의견 쪽이 꺼져 있던 보고서(8월 25명)도 켠다
  q.components = comps;
  await mf('PUT', `/v2/report/custom/${reportId}`, { startDate: q.startDate, endDate: q.endDate, title: q.title, studentWorksheetIds: d.studentWorksheetIds ?? null, studentWorkbookIds: d.studentWorkbookIds ?? null, assignedCasIds: d.assignedCasIds ?? null, worksheetTags: d.worksheetTags ?? null, workbookTypes: d.workbookTypes ?? null, casTypes: [], includeSelfLearning: d.includeSelfLearning !== false, components: comps, aiCommentUsed: false, comparisonGroup: d.comparisonGroup ?? q.comparisonType ?? 'NATIONAL', additionalScore: 0, request: q, chapters: d.chapters || [] });
}

/* ══ 루멘 학부모앱용 보고서 (2026-11-10 원장 「학부모앱에서도 월간보고서가 보이게」 · 시안 docs/mockup_monthly_report.html) ══
 *  숫자는 매쓰플랫 보고서(/v2/report/custom/{id}/scoring) 그대로 옮기고, 의견도 매쓰플랫에 저장된 글 그대로.
 *  «루멘 기록»(숙제 이행도·아하노트 질문·플래너 평균)만 우리 자료로 더한다.
 *  저장: lumen_store mfrep_pub_<학습코드> = { code, upd, months: { 'YYYY-MM': {...} } } — 학생마다 따로(학부모앱은 자기 아이 키만 읽는다). */
const EVAL_KO = { PROBLEM_SOLVING_ABILITY: '문제 해결', REASONING_ABILITY: '추론', COMMUNICATION_ABILITY: '의사소통', CONNECTION_ABILITY: '연결', INFORMATION_PROCESSING_ABILITY: '정보 처리' };
const BOOK_KO = { SCHOOL: '교과서', PUBLIC: '시중 교재', CUSTOM_SIGNATURE: '시그니처 교재' };
async function getKvMany(keys) {
  const out = {}; if (!keys.length) return out;
  for (let i = 0; i < keys.length; i += 60) {
    const part = keys.slice(i, i + 60).map((k) => '"' + k + '"').join(',');
    const r = await fetch(`${SB}/rest/v1/lumen_store?key=in.(${encodeURIComponent(part)})&select=key,value`, { headers: SH });
    if (!r.ok) continue; (await r.json()).forEach((x) => { out[x.key] = x.value; });
  }
  return out;
}
/* 매쓰플랫 학생 id → 루멘 학습코드 (mf_students 표) */
async function codeMap() {
  const r = await fetch(`${SB}/rest/v1/mf_students?select=mf_student_id,lumen_rec_code`, { headers: SH });
  const m = {}; if (r.ok) (await r.json()).forEach((x) => { if (x.mf_student_id && x.lumen_rec_code) m[String(x.mf_student_id)] = String(x.lumen_rec_code); });
  return m;
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
/* 매쓰플랫 보고서 내용 → 학부모앱 한 달 칸 (이름은 넣지 않는다 — 학부모앱이 자기 아이 이름을 안다) */
function pubFromScoring(d, ym, reportId) {
  const q = (d && d.request) || {};
  const mc = q.monthlyComponent || {}, wc = q.weeklyComponent || {}, hc = q.studyHistoryComponent || {};
  const byM = (arr) => (arr || []).map((x) => ({ m: `${x.year}-${String(x.month).padStart(2, '0')}`, s: num(x.student), c: num(x.comparison) }));
  const rates = byM(mc.correctRatesPerMonth), counts = byM(mc.scoringCountsPerMonth);
  const prev = rates.filter((x) => x.m < ym).slice(-1)[0] || null;
  const chapters = ((q.studyPerformanceComponent || {}).middleChapters || []).map((c) => ({ name: String(c.name || ''), n: num(c.scoringCount), rate: num(c.correctRate) })).filter((c) => c.name && c.n > 0);
  const sec = (((q.studyEvaluationComponent || {}).studyEvaluationSections) || [])[0] || {};
  const st = hc.scoringCountsPerStudyType || {};
  return {
    v: 1, at: new Date().toISOString(), reportId: Number(reportId) || null, title: String(q.title || ''),
    from: q.startDate || null, to: q.endDate || null,
    rate: num(q.correctRate), count: num(q.scoringCount), rank: num(q.rank), level: num(q.level),
    cmpType: q.comparisonType || '', rateCmp: (rates.find((x) => x.m === ym) || {}).c || 0,
    prevRate: prev ? prev.s : null, prevM: prev ? prev.m : null,
    months: rates.map((x) => ({ m: x.m, rate: x.s, cmp: x.c, n: ((counts.find((y) => y.m === x.m) || {}).s) || 0 })),
    weeks: (wc.scoringCountsPerWeek || []).map((x) => ({ w: num(x.week), n: num(x.student), rate: num(((wc.correctRatesPerWeek || []).find((y) => y.week === x.week) || {}).student) })),
    levels: (wc.correctRatesPerLevel || []).map((x) => ({ l: num(x.level), rate: num(x.student), cmp: num(x.comparison), n: num(((wc.scoringCountsPerLevel || []).find((y) => y.level === x.level) || {}).student) })),
    chapters,
    evals: (sec.behaviorSections || []).map((b) => ({ k: b.type, name: EVAL_KO[b.type] || String(b.type || ''), rate: num(b.studentCorrectRate), cmp: num(b.comparisonCorrectRate), rank: num(b.studentRank) })),
    books: (hc.workbooks || []).map((w) => ({ title: String(w.title || ''), kind: BOOK_KO[w.type] || '', from: num(w.scoringStartPageNumber), to: num(w.scoringEndPageNumber), n: num(w.scoringCount), rate: num(w.correctRate) })).sort((a, b) => b.n - a.n),
    sheets: { n: (hc.worksheets || []).length, count: num(st.worksheet) },
    byType: { workbook: num(st.workbook), worksheet: num(st.worksheet), other: num(st.levelUpOrWrongAnswer) + num(st.challenge) + num(st.cas) },
    comment: String((q.commentComponent || {}).comment || '').trim()
  };
}
/* 루멘 기록 — 숙제 이행도(선생님 확인 평균) · 아하노트 질문 수 · 플래너 평균 (그 달 · 없는 칸은 null) */
async function lumenRecord(code, ym) {
  const out = { hw: null, hwN: 0, aha: null, plan: null, planN: 0 };
  try {
    const kv = await getKvMany(['hw_teach_' + code, 'student_planner_' + code]);
    const ht = kv['hw_teach_' + code], by = (ht && ht.byDate) || {};
    const ts = Object.keys(by).filter((d) => d.slice(0, 7) === ym).map((d) => Number(by[d] && by[d].t)).filter((x) => isFinite(x));
    if (ts.length) { out.hw = Math.round(ts.reduce((a, b) => a + b, 0) / ts.length); out.hwN = ts.length; }
    const pl = kv['student_planner_' + code], sc = (pl && pl.scores) || {}, dot = ym.replace('-', '.');
    const ps = Object.keys(sc).filter((d) => d.slice(0, 7) === dot).map((d) => Number(sc[d])).filter((x) => isFinite(x));
    if (ps.length) { out.plan = Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 10) / 10; out.planN = ps.length; }   // 10점 만점 · 소수 한 자리
  } catch (e) { log('  루멘 기록(숙제·플래너) 읽기 실패', code, e.message); }
  try {
    const [y, m] = ym.split('-').map(Number), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    const from = `${ym}-01T00:00:00%2B09:00`, to = `${ny}-${String(nm).padStart(2, '0')}-01T00:00:00%2B09:00`;
    const r = await fetch(`${SB}/rest/v1/aha_notes?select=id&student_code=eq.${encodeURIComponent(code)}&created_at=gte.${from}&created_at=lt.${to}`, { headers: { ...SH, prefer: 'count=exact', range: '0-0' } });
    const cr = r.headers.get('content-range') || ''; const n = Number(cr.split('/')[1]); if (isFinite(n)) out.aha = n;
  } catch (e) { log('  루멘 기록(아하노트) 읽기 실패', code, e.message); }
  return out;
}
async function pubLumen(reportId, ym, code) {
  const d = await mf('GET', `/v2/report/custom/${reportId}/scoring`);
  const P = pubFromScoring(d, ym, reportId); P.lumen = await lumenRecord(code, ym);
  const cur = (await getKv('mfrep_pub_' + code)) || {};
  const months = Object.assign({}, cur.months || {}); months[ym] = P;
  await setKv('mfrep_pub_' + code, { code, upd: new Date().toISOString(), months });
}
async function unpubLumen(ym, code) {
  const cur = await getKv('mfrep_pub_' + code); if (!cur || !cur.months || !cur.months[ym]) return;
  const months = Object.assign({}, cur.months); delete months[ym];
  await setKv('mfrep_pub_' + code, { code, upd: new Date().toISOString(), months });
}

/* ── 요청 처리 ── */
async function runReq() {
  const rq = await getKv('mfrep_req');
  if (!rq || rq.status !== 'requested') return false;
  await setKv('mfrep_req', { ...rq, status: 'running', startedAt: new Date().toISOString() });
  const ym = /^\d{4}-\d{2}$/.test(rq.month || '') ? rq.month : null;
  const res = { ok: 0, fail: 0, errors: [] };
  try {
    if (!ym) throw new Error('달(month)이 없음');
    await login();
    if (rq.action === 'make') { const r = await makeMonth(ym, rq.only); res.ok = r.made; res.fail = r.fail; res.note = `새로 ${r.made} · 이미 ${r.had} · 채점 없음 ${r.none}`; }
    else if (rq.action === 'comment') {
      for (const it of (rq.items || [])) { try { await setComment(it.reportId, it.comment); res.ok++; } catch (e) { res.fail++; res.errors.push(it.reportId + ' ' + e.message); } }
    } else if (rq.action === 'publish' || rq.action === 'unpublish') {
      /* ★ 2026-11-10: 공개 대상 — rq.mf(매쓰플랫 학부모앱, 기본 켬) · rq.lumen(루멘 학부모앱, 기본 끔 — 옛 학원앱 요청은 매쓰플랫만) */
      const ids = (rq.ids || []).map(Number).filter(Boolean);
      const wantMf = rq.mf !== false, wantLm = rq.lumen === true;
      if (ids.length && wantMf) {
        if (rq.action === 'publish') await mf('POST', '/v2/report/custom/share/parent-app', { reportIds: ids, shouldSendSmsToParent: !!rq.sms });
        else { try { await mf('POST', '/v2/report/custom/unshare/parent-app', { reportIds: ids }); } catch (e) { await mf('POST', '/v2/report/custom/unshare/parent-app', ids); } }
        res.ok = ids.length;
      }
      if (ids.length && wantLm) {
        const list = (await getKv('mfrep_' + ym)) || {}, cm = await codeMap();
        res.lumen = 0;
        for (const id of ids) {
          const row = (list.rows || []).find((r) => Number(r.reportId) === id);
          const code = row ? (row.code || cm[row.sid]) : '';
          if (!code) { res.fail++; res.errors.push(id + ' 루멘 학습코드 없음'); continue; }
          try { if (rq.action === 'publish') await pubLumen(id, ym, code); else await unpubLumen(ym, code); res.lumen++; }
          catch (e) { res.fail++; res.errors.push(id + ' 루멘 ' + e.message); }
        }
        if (!wantMf) res.ok = res.lumen;
      }
    } else if (rq.action !== 'list') throw new Error('모르는 요청 ' + rq.action);
    await buildList(ym);
    await setKv('mfrep_req', { ...rq, status: res.fail && !res.ok ? 'error' : 'done', doneAt: new Date().toISOString(), result: res });
  } catch (e) {
    res.errors.push(e.message);
    await setKv('mfrep_req', { ...rq, status: 'error', doneAt: new Date().toISOString(), result: res, error: e.message });
  }
  const lg = (await getKv('mfrep_log')) || []; lg.unshift({ at: new Date().toISOString(), action: rq.action, month: rq.month, n: (rq.items || rq.ids || []).length, sms: !!rq.sms, result: res });
  await setKv('mfrep_log', lg.slice(0, 30));
  log(`📑 요청 처리 — ${rq.action} ${rq.month} · 성공 ${res.ok} · 실패 ${res.fail}`);
  return true;
}

if (require.main === module) (async () => {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  if (has('--req')) { await runReq(); return; }
  await login();
  if (arg('--make')) { await makeMonth(arg('--make'), (arg('--only') || '').split(',').filter(Boolean)); await buildList(arg('--make')); return; }
  if (arg('--list')) { await buildList(arg('--list')); return; }
  if (has('--auto')) {   // 매달 2일 새벽: 지난달 (비공개로) 만들기 + 목록
    const d = new Date(Date.now() + 9 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    const ym = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    const cfg = (await getKv('mfrep_config')) || {};
    if (cfg.auto === false) { log('📑 자동 만들기 꺼짐 (mfrep_config.auto=false) — 목록만'); }
    else await makeMonth(ym);
    await buildList(ym); return;
  }
  console.log('사용법: --req | --list YYYY-MM | --make YYYY-MM [--only id,..] | --auto');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

module.exports = { login, buildList, makeMonth, setComment, runReq, pubFromScoring, lumenRecord };
