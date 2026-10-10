#!/usr/bin/env node
/**
 * 🧩 리커버리 학습지 — 확정 명단 전원을 서버에서 설계해 매쓰플랫에 즉시 생성·배정
 * ═══════════════════════════════════════════════════════════════════
 * 학원앱 v19-92 부품(sync/appbuild/modules/rcws_teacher.js)과 같은 규칙을 Node 에서 돌린다.
 * 원장 지시 2026-10-10 「리커버리 학습지 만들어서 매쓰플랫에 배정, 자동채점으로」.
 *
 *   규칙: 시험 오답 문항마다 쌍둥이 2 · 교과서 같은 유형 1 · 범위 안 교재 오답(최근 28일) 쌍둥이 1 · 두 번 이상 틀린 유형 보강 1
 *   자동채점: --auto (기본 켬) — «자동으로 채점되는 문항»만 고른다 = 서술형(ESSAY)이 아니고 정답 글자가 있는 문항.
 *            (매쓰플랫 자체 자동채점은 객관식뿐이지만, 단답은 학생앱(루멘 채점 엔진)이 자동채점한다 — v2-89.
 *             매쓰플랫 기준(객관식만)으로 하려면 --mf-auto. 그러면 교과서 문항은 거의 못 들어간다.)
 *            쌍둥이·유사에 그런 문항이 없으면 같은 유형의 다른 문항으로 대체한다.
 *
 * 실행
 *   node sync/rcws_make.js --dry            # 설계만 (매쓰플랫에 쓰지 않음, 조회만)
 *   node sync/rcws_make.js                  # 생성·배정 · rc_ws_made · 운영 장부(rc_state) 기록
 *   옵션 --week 2026-10-10  --no-auto  --only <학생키>
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID · MATHFLAT_PASSWORD (값은 어디에도 적지 않는다)
 * 출력에 학생 실명은 첫 글자만 쓴다(깃허브 로그).
 */
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !/^--/.test(args[i + 1]) ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const AUTO = !args.includes('--no-auto');
const MF_AUTO = args.includes('--mf-auto');   // 매쓰플랫 자체 자동채점(객관식) 기준
const ONLY = opt('only', '');
const RULE = { twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, theory: false, days: 28 };
const MF = 'https://api.mathflat.com', WEB = 'https://teacher.mathflat.com';
const DESIGN = { layoutType: 11, layoutColor: 'GREEN', partitionType: 4, wrongAnswerNoteFlag: false, conceptNameFlag: false, problemTrendFlag: false,
  answerRateFlag: false, qrFlag: true, relationWorkbookFlag: true, includeProblemFlag: false, pdfDateType: 'TODAY', pdfDate: null,
  designTemplateId: 41988, problemPadding: 60, conceptSortType: 'CHAPTER' };
const mask = (n) => (n ? String(n).charAt(0) + '○○' : '?');

/* ── Supabase ── */
async function q(path) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json(); }
async function store(keys) { const out = {}; const rows = await q(`lumen_store?select=key,value&key=in.(${keys.map(encodeURIComponent).join(',')})`); rows.forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; }); return out; }
async function setItem(key, value) { const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key, value }]) }); if (!r.ok) throw new Error(`저장 실패 ${key} ${r.status}`); }
async function recs(filter) { return q(`mf_answer_records?${filter}`); }

/* ── 매쓰플랫 ── */
let TOK = null;
async function mfLogin() {
  const r = await fetch(`${MF}/v2/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: WEB, referer: WEB + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json(); if (!r.ok || !j.accessToken) throw new Error('매쓰플랫 로그인 실패 ' + (j.code || r.status)); TOK = j.accessToken;
}
async function mf(method, p, body) {
  const r = await fetch(`${MF}${p}`, { method, headers: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', authorization: 'Bearer ' + TOK, 'x-auth-token': TOK, origin: WEB, referer: WEB + '/' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`${(j && j.code) || r.status} @ ${p}`);
  return j && (j.data !== undefined ? j.data : j);
}

/* ── 학생·시험 고르기 (학원앱 rcRows 와 같은 기준) ── */
function bandOf(grade) { const m = String(grade || '').match(/(초|중|고)[^0-9]*(\d)/); if (!m) return 'mid'; if (m[1] !== '초') return 'mid'; return Number(m[2]) >= 6 ? 'elem6' : 'elemLow'; }
function schoolOf(grade) { const m = String(grade || '').match(/(초|중|고)[^0-9]*(\d)/); if (!m || m[1] === '고') return null; return { schoolType: m[1] === '초' ? 'ELEMENTARY' : 'MIDDLE', grade: m[2] }; }
const bankId = (p) => { const m = String((p && p.pimg) || '').match(/\/problem\/(\d+)\//); return m ? Number(m[1]) : null; };
const isAuto = (p) => { if (!AUTO) return true; if (MF_AUTO) { const a = p && (p.autoScoredType || p.auto); return !!(a && a !== 'IMPOSSIBLE'); } return p && p.type !== 'ESSAY' && String(p.answer == null ? '' : p.answer).trim() !== '' && String(p.answer).trim() !== '.'; };

/* ── 재료 ── */
async function gather(sid, test, textbooks) {
  const M = { wrong: [], range: [], bookWrong: [], tb: { bid: null, title: '', byCid: {} }, solved: {}, warn: [] };
  let rs = await recs(`select=problem_seq,number,result,concept_id,level,problem_id,score_datetime,student_worksheet_id&worksheet_id=eq.${test.wid}&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.학습지&order=problem_seq.asc&limit=500`);
  if (rs.length) { const bySw = {}; rs.forEach((x) => { const sw = x.student_worksheet_id || '0'; (bySw[sw] = bySw[sw] || []).push(x); }); const ids = Object.keys(bySw); if (ids.length > 1) { ids.sort((a, b) => String(bySw[b][0].score_datetime || '').localeCompare(String(bySw[a][0].score_datetime || ''))); rs = bySw[ids[0]]; } }
  if (!rs.length) { M.warn.push('문항별 기록 없음'); return M; }
  const seen = {};
  rs.forEach((x) => { if (x.concept_id != null && !seen[x.concept_id]) { seen[x.concept_id] = 1; M.range.push(Number(x.concept_id)); }
    if (x.result === 'X') M.wrong.push({ no: x.number != null ? x.number : x.problem_seq, pid: x.problem_id ? Number(x.problem_id) : null, cid: Number(x.concept_id), lv: Number(x.level) || 3 }); });
  const since = new Date(Date.now() - RULE.days * 86400000).toISOString();
  const r2 = await recs(`select=book_id,page,number,workbook_problem_id,concept_id,level,score_datetime&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.교재&result=eq.X&concept_id=in.(${M.range.join(',') || 0})&score_datetime=gte.${since}&order=score_datetime.desc&limit=300`);
  const seenW = {}, bids = {};
  r2.forEach((x) => { const k = String(x.workbook_problem_id || ''); if (!k || seenW[k]) return; seenW[k] = 1; bids[String(x.book_id)] = 1;
    M.bookWrong.push({ wpId: Number(x.workbook_problem_id), bid: String(x.book_id), page: x.page, no: x.number, cid: Number(x.concept_id), lv: Number(x.level) || 3, date: String(x.score_datetime || '').slice(0, 10), pid: null }); });
  const mine = textbooks.byStudent && textbooks.byStudent[sid]; let tbid = null, tbTitle = '';
  ((mine && mine.books) || []).forEach((b) => { const info = textbooks.books && textbooks.books[b]; if (!tbid && info && info.type === 'SCHOOL') { tbid = String(b); tbTitle = info.fulltitle || info.title || ''; } });
  const keys = Object.keys(bids).map((b) => 'mf_textbook_' + b); if (tbid) keys.push('mf_textbook_' + tbid);
  const st = keys.length ? await store(keys) : {};
  Object.keys(bids).forEach((b) => { const bank = st['mf_textbook_' + b]; if (!bank || !bank.problems) return; const byWp = {}; bank.problems.forEach((p) => { byWp[String(p.id)] = p; });
    M.bookWrong.forEach((w) => { if (w.bid === b && byWp[String(w.wpId)]) { w.pid = bankId(byWp[String(w.wpId)]); w.book = bank.title || ''; } }); });
  if (tbid && st['mf_textbook_' + tbid]) { M.tb.bid = tbid; M.tb.title = tbTitle || st['mf_textbook_' + tbid].title || '';
    (st['mf_textbook_' + tbid].problems || []).forEach((p) => { const id = bankId(p); if (!id || p.cid == null) return; (M.tb.byCid[p.cid] = M.tb.byCid[p.cid] || []).push({ id, lv: Number(p.level) || 2, page: p.page, no: p.no, auto: p.auto, type: p.type, answer: p.answer }); }); }
  else M.warn.push('배정 교과서 없음 → 같은 유형으로 대체');
  const r3 = await recs(`select=problem_id&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.학습지&concept_id=in.(${M.range.join(',') || 0})&problem_id=not.is.null&limit=2000`);
  r3.forEach((x) => { M.solved[String(x.problem_id)] = 1; });
  M.wrong.forEach((w) => { if (w.pid) M.solved[String(w.pid)] = 1; }); M.bookWrong.forEach((w) => { if (w.pid) M.solved[String(w.pid)] = 1; });
  return M;
}
function plan(M) {
  const cnt = {}; M.wrong.forEach((w) => { cnt[w.cid] = (cnt[w.cid] || 0) + 1; }); M.bookWrong.forEach((w) => { cnt[w.cid] = (cnt[w.cid] || 0) + 1; });
  return { test: M.wrong.map((w) => ({ w, n: RULE.twinPer })), tb: M.wrong.map((w) => ({ w, n: RULE.tbPer })), book: M.bookWrong.map((w) => ({ w, n: RULE.bookTwin })),
    boost: Object.keys(cnt).filter((c) => cnt[c] >= 2).map((c) => ({ cid: Number(c), n: RULE.boost ? 1 : 0, times: cnt[c] })) };
}
function pick(list, lv, n, excl, chosen) { const out = []; const pool = list.filter((p) => isAuto(p) && !excl[String(p.id)] && !chosen[String(p.id)]); pool.sort((a, b) => Math.abs((a.lv || 3) - lv) - Math.abs((b.lv || 3) - lv)); pool.slice(0, n).forEach((p) => { chosen[String(p.id)] = 1; out.push(p.id); }); return out; }

/* ── 만들기 ── */
async function build(M, P, name, school, sid, recDate, log) {
  const cids = {}; M.wrong.forEach((w) => { cids[w.cid] = 1; }); M.bookWrong.forEach((w) => { cids[w.cid] = 1; }); P.boost.forEach((b) => { cids[b.cid] = 1; });
  const cidList = Object.keys(cids).map(Number); if (!cidList.length) throw new Error('넣을 유형 없음');
  const f = await mf('POST', '/worksheet/filter/concept', { type: 'CONCEPT', conceptIdList: cidList, excludedTopicIds: [], excludedSubTopicIds: [], problemList: null, problemCount: 100, level: 3, levelWeight: [10, 30, 30, 20, 10],
    problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: MF_AUTO, excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] });
  const fid = f.filterId || f;
  const chosen = {}, items = [], parts = { twin: 0, tb: 0, book: 0, boost: 0, fallback: 0 };
  let poolByCid = null;
  const addPool = (ps) => { (Array.isArray(ps) ? ps : (ps.problemList || [])).forEach((p) => { const pr = p.problem || p; if (pr.conceptId && pr.id) (poolByCid[pr.conceptId] = poolByCid[pr.conceptId] || []).push({ id: pr.id, lv: pr.level || 3, autoScoredType: pr.autoScoredType, type: pr.type, answer: pr.answer }); }); };
  const pool = async (cid) => { if (!poolByCid) { poolByCid = {}; try { addPool(await mf('POST', '/worksheet/problem', { filterId: fid })); } catch (e) {} }
    if (cid && !(poolByCid[cid] || []).some((p) => isAuto(p) && !M.solved[String(p.id)] && !chosen[String(p.id)]) && !poolByCid['_tried' + cid]) { poolByCid['_tried' + cid] = 1;
      try { const f2 = await mf('POST', '/worksheet/filter/concept', { type: 'CONCEPT', conceptIdList: [cid], excludedTopicIds: [], excludedSubTopicIds: [], problemList: null, problemCount: 40, level: 3, levelWeight: [10, 30, 30, 20, 10], problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: MF_AUTO, excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] }); addPool(await mf('POST', '/worksheet/problem', { filterId: f2.filterId || f2 })); } catch (e) {} }
    return poolByCid; };
  const twins = async (pid, lv, n, label) => { if (!n) return []; const d = await mf('POST', '/derivation/problem/' + pid, { excludedProblemIds: Object.keys(chosen).map(Number), filterId: fid, bookType: 'WORKSHEET', tagTop: null });
    const pk = (x) => ({ id: x.problem.id, lv: x.problem.level, autoScoredType: x.problem.autoScoredType, type: x.problem.type, answer: x.problem.answer });
    const pair = ((d && d.pairProblemList) || []).map(pk);
    const sim = ((d && d.similarProblemList) || []).map(pk);
    let got = pick(pair, lv, n, M.solved, chosen); if (got.length < n) got = got.concat(pick(sim, lv, n - got.length, M.solved, chosen));
    log(`    ${label}: 쌍둥이 ${pair.length}·유사 ${sim.length} → ${got.length}`); return got; };
  const same = async (cid, lv, n) => { if (!n) return []; const Pz = await pool(cid); return pick(Pz[cid] || [], lv, n, M.solved, chosen); };
  for (const x of P.test) { if (!x.n) continue; let got = x.w.pid ? await twins(x.w.pid, x.w.lv, x.n, x.w.no + '번') : []; if (got.length < x.n) { const g = await same(x.w.cid, x.w.lv, x.n - got.length); parts.fallback += g.length; got = got.concat(g); } got.forEach((id) => items.push({ id, kind: 'twin' })); parts.twin += got.length; }
  for (const y of P.tb) { if (!y.n) continue; let got = pick(M.tb.byCid[y.w.cid] || [], y.w.lv, y.n, M.solved, chosen); if (got.length < y.n) { const g = await same(y.w.cid, y.w.lv, y.n - got.length); parts.fallback += g.length; got = got.concat(g); } got.forEach((id) => items.push({ id, kind: 'tb' })); parts.tb += got.length; }
  for (const z of P.book) { if (!z.n) continue; let got = z.w.pid ? await twins(z.w.pid, z.w.lv, z.n, 'p.' + z.w.page + ' ' + z.w.no) : []; if (got.length < z.n) { const g = await same(z.w.cid, z.w.lv, z.n - got.length); parts.fallback += g.length; got = got.concat(g); } got.forEach((id) => items.push({ id, kind: 'book' })); parts.book += got.length; }
  for (const b of P.boost) { if (!b.n) continue; const got = await same(b.cid, 3, b.n); got.forEach((id) => items.push({ id, kind: 'boost' })); parts.boost += got.length; }
  if (!items.length) throw new Error('문항을 하나도 받지 못함');
  const d = new Date(recDate); const title = `리커버리 ${d.getMonth() + 1}/${d.getDate()} ${name}`;
  if (DRY) return { wsId: null, title, n: items.length, parts, items, at: new Date().toISOString() };
  const made = await mf('POST', '/worksheet', { filterId: fid, problemList: items.map((it) => ({ id: it.id, tagTop: null })), conceptIdList: [], littleChapterConceptIdList: [], assignStudentIdList: sid ? [sid] : [], shareScope: 'ACADEMY',
    title, writer: '김정수 선생님', prefix: '취약유형', tag: 'WEAK_CONCEPT_CHIP', schoolType: school.schoolType, grade: String(school.grade), revision: 'CURRICULUM_22', ...DESIGN });
  return { wsId: (made && (made.id || made.worksheetId)) || made, title, n: items.length, parts, items, at: new Date().toISOString() };
}

(async () => {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  const st = await store(['rc_state', 'rc_config', 'or_studentdb', 'mf_weekly', 'mf_textbooks', 'rc_ws_made']);
  const state = st.rc_state || { calls: {}, dates: {} }; const cfg = Object.assign({ minScore: 80, elem6Score: 75, weeks: 3 }, st.rc_config || {});
  const wk = opt('week', Object.keys(state.calls || {}).sort().pop()); const C = (state.calls || {})[wk] || {};
  const recDate = (state.dates && state.dates[wk]) || wk;
  const from = (cfg.range && cfg.range.from) || new Date(Date.now() - cfg.weeks * 7 * 86400000).toISOString().slice(0, 10), to = (cfg.range && cfg.range.to) || new Date().toISOString().slice(0, 10);
  const sdb = Array.isArray(st.or_studentdb) ? st.or_studentdb : Object.values(st.or_studentdb || {});
  const mfs = await q('mf_students?select=mf_student_id,name,lumen_rec_code');
  const tests = ((st.mf_weekly || {}).tests || []).filter((t) => t.type === 'WEEKLY');
  const made = (st.rc_ws_made && st.rc_ws_made.byKey) || {};
  console.log(`주 ${wk} (보충일 ${recDate}) · 기준 기간 ${from}~${to} · 자동채점 ${AUTO ? (MF_AUTO ? '매쓰플랫 기준(객관식)' : '서술형 제외·정답 있는 문항') : '제한 없음'} · ${DRY ? '[설계만]' : '[실제 생성·배정]'}`);
  const keys = Object.keys(C).filter((k) => C[k] && C[k].on && !C[k].done && !C[k].noshow && (!ONLY || k === ONLY));
  if (!DRY) await mfLogin();
  else await mfLogin();   // 조회(필터·쌍둥이)는 dry 에서도 매쓰플랫 로그인이 필요하다 (쓰기는 없음)
  const results = [];
  for (const k of keys) {
    const e = C[k]; const stu = sdb.find((s) => String(s.id) === String(k)) || sdb.find((s) => s.name === k) || sdb.find((s) => e.snap && s.name === e.snap.name);
    const name = (stu && stu.name) || (e.snap && e.snap.name) || k; const grade = (stu && stu.grade) || (e.snap && e.snap.grade) || '';
    const line = (s) => console.log(`  ${s}`);
    console.log(`\n▶ ${mask(name)} (${grade}) ${made[k] && made[k].wk === wk ? '— 이미 이번 주 학습지 있음 #' + made[k].wsId + ' (건너뜀)' : ''}`);
    if (made[k] && made[k].wk === wk) { results.push({ k, skip: 'already' }); continue; }
    let hit = stu && mfs.find((m) => m.lumen_rec_code && stu.lumen_rec_code && m.lumen_rec_code === stu.lumen_rec_code); if (!hit) { const same = mfs.filter((m) => m.name === name); if (same.length === 1) hit = same[0]; }
    const sid = hit && hit.mf_student_id; if (!sid) { line('✗ 매쓰플랫 학생 번호를 찾지 못함'); results.push({ k, skip: 'no sid' }); continue; }
    const school = schoolOf(grade); if (!school) { line('✗ 고등부(또는 학년 미상) — 제외'); results.push({ k, skip: 'school' }); continue; }
    const band = bandOf(grade); const cut = band === 'elem6' ? cfg.elem6Score : cfg.minScore;
    let test = null;
    tests.forEach((t) => { const me = (t.students || []).find((s) => String(s.sid) === String(sid) && s.score != null); if (!me) return; const on = me.date || t.date; if (!on || on < from || on > to) return; if (me.score < cut && (!test || String(on) > String(test.date))) test = { wid: t.wid, title: t.title, date: on, score: me.score }; });
    if (!test) tests.forEach((t) => { const me = (t.students || []).find((s) => String(s.sid) === String(sid) && s.score != null); if (!me) return; const on = me.date || t.date; if (on && on >= from && (!test || String(on) > String(test.date))) test = { wid: t.wid, title: t.title, date: on, score: me.score, anyScore: true }; });
    if (!test) { line('✗ 기간 안 주간테스트 기록 없음'); results.push({ k, skip: 'no test' }); continue; }
    line(`시험 ${test.title} ${test.date} ${test.score}점${test.anyScore ? ' (기준 점수 이상이지만 호출 확정이라 포함)' : ''}`);
    try {
      const M = await gather(sid, test, st.mf_textbooks || {}); const P = plan(M);
      line(`시험 오답 ${M.wrong.length} · 범위 유형 ${M.range.length} · 교재 오답(범위 안·${RULE.days}일) ${M.bookWrong.length}${M.bookWrong.filter((w) => !w.pid).length ? ' (번호 못 찾음 ' + M.bookWrong.filter((w) => !w.pid).length + ')' : ''} · 교과서 ${M.tb.title || '없음'} · 보강 유형 ${P.boost.length}` + (M.warn.length ? ' · ⚠ ' + M.warn.join(' / ') : ''));
      if (!M.wrong.length && !M.bookWrong.length) { line('✗ 틀린 문항이 없어 만들지 않음'); results.push({ k, skip: 'no wrong' }); continue; }
      const res = await build(M, P, name, school, sid, recDate, line);
      line(`${DRY ? '설계' : '✅ 생성·배정'} ${res.title.replace(name, mask(name))} · ${res.n}문항 (시험 쌍둥이 ${res.parts.twin} · 교과서 ${res.parts.tb} · 교재 쌍둥이 ${res.parts.book} · 보강 ${res.parts.boost}${res.parts.fallback ? ' · 같은 유형 대체 ' + res.parts.fallback : ''})${res.wsId ? ' · 매쓰플랫 #' + res.wsId : ''}`);
      results.push({ k, ok: true, res });
      if (!DRY) {
        made[k] = { wk, wsId: res.wsId, title: res.title, n: res.n, parts: res.parts, at: res.at, by: 'server', auto: AUTO };
        await setItem('rc_ws_made', { byKey: made, updated: new Date().toISOString() });
        const fresh = (await store(['rc_state'])).rc_state || state; if (fresh.calls && fresh.calls[wk] && fresh.calls[wk][k]) { fresh.calls[wk][k].ws = { wsId: res.wsId, n: res.n, parts: res.parts, at: res.at }; await setItem('rc_state', { calls: fresh.calls, dates: fresh.dates || {}, periods: fresh.periods || {}, updated: new Date().toISOString() }); }
      }
    } catch (err) { line('✗ 실패: ' + err.message); results.push({ k, skip: 'error', why: err.message }); }
    await new Promise((r) => setTimeout(r, 300));
  }
  const ok = results.filter((r) => r.ok); const tot = ok.reduce((s, r) => s + r.res.n, 0);
  console.log(`\n${DRY ? '[설계만]' : '[완료]'} 확정 ${keys.length}명 중 ${ok.length}명 ${DRY ? '설계' : '생성·배정'} · 총 ${tot}문항 · 건너뜀 ${results.length - ok.length}명 (${results.filter((r) => !r.ok).map((r) => r.skip).join(', ') || '-'})`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
