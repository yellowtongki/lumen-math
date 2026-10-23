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
/* ★ 2026-10-16 원장 지시 (리커버리 10/17)
 *   --twin1 <학생키,…>            시험 오답 쌍둥이를 2 → 1 (문항 수 줄이기)
 *   --tests2 <학년 글자>          그 학년은 최근 주간테스트 2개(이번 주·지난 주) 오답을 합쳐 만든다 (예: --tests2 "중학교 3학년")
 *   --unit <학생키>=<단원 정규식>  단원 정답률로 호출된 학생 — 그 단원(교재 기록의 chapter 이름이 맞는 것)의 최근 오답을 교재 오답에 더한다
 *   --update-score               실제 생성 때 리커버리 보드의 점수(snap.score)를 이번에 쓴 최신 시험 점수로 바꾼다
 * ★ 2026-10-16 (학원앱 v19-123 과 같은 규칙 — 원장 「학원앱에도 넣어」 · 「이번주 지난주는 선택가능하게」)
 *   · 시험 2개 학년은 rc_ws_rule.twoTestGrades(기본 ['중학교 3학년'])를 따른다 (--tests2 를 주면 그 학년으로 덮음)
 *   · 학원앱 팝업에서 고른 학생별 선택 rc_ws_rule.per[학생키] = { wk, wids, twin1, noBook, unit } 을 그 주에 그대로 쓴다
 *   --tests <학생키>=<wid,wid>   그 학생은 이 주간테스트들만 쓴다 (이번 주만·지난 주만·둘 다)
 *   --unit 을 안 주면 «자동 단원 오답»: 보드 기록(snap.units)의 단원(대단원 이름) → 그 교재의 매쓰플랫 유형칩
 *       (GET /concept/chips?curriculumKey=1&workbookIds=<교재>) 중 bigChapterName 이 같은 유형 → 그 유형들의 최근 교재 오답.
 *       수집기가 단원 정답률(mf_progress chapters)을 만든 바로 그 사전이다. 칩을 못 받으면 유형DB(mf_typedb 대단원→중단원) +
 *       유형 사전(mf_concept_names 의 중단원) / 기록 chapter 글자(앞 번호 뗀 것)로 대신한다. --no-unit-auto 로 끈다.
 *   --no-book 은 «범위 안 교재 오답»만 뺀다(단원 오답은 남긴다 — 학원앱과 같음)
 *   --force-design (--dry 와 함께만) 이번 주 학습지가 이미 있어도 설계만 다시 해 본다 */
const csv = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const TWIN1 = csv(opt('twin1', ''));
const TESTS2 = opt('tests2', '');
const UNIT = {}; args.forEach((a, i) => { if (a === '--unit' && args[i + 1]) { const m = args[i + 1].match(/^([^=]+)=(.+)$/); if (m) UNIT[m[1]] = new RegExp(m[2]); } });
const UPD_SCORE = args.includes('--update-score');
const SKIP = csv(opt('skip', ''));   // 이번에는 건너뛸 학생키
const NOBOOK = csv(opt('no-book', ''));   // 교재 오답 쌍둥이를 빼고 시험 오답만으로 (문항 수 줄이기)
const TESTS = {}; args.forEach((a, i) => { if (a === '--tests' && args[i + 1]) { const m = args[i + 1].match(/^([^=]+)=(.+)$/); if (m) TESTS[m[1]] = csv(m[2]); } });
const UNIT_AUTO = !args.includes('--no-unit-auto');
const FORCE_DESIGN = args.includes('--force-design');
if (FORCE_DESIGN && !DRY) { console.error('❌ --force-design 는 --dry 와 함께만 쓸 수 있습니다'); process.exit(1); }
const gradeKey = (g) => { const m = String(g || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? m[1] + m[2] : String(g || '').trim(); };
const nrm = (x) => String(x || '').replace(/[\s\.\-–·()\[\]0-9ⅠⅡⅢⅣⅤⅥⅦ]/g, '').toLowerCase();   // 학원앱 rcNrm 과 같다
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
/* ★ 2026-10-23 원장 「고1 윤○○ 리커버리 만들어줘」 — 고등부는 과목을 지정한 학생만 만든다.
 *   --high <학생키>=<과목>  (과목 = 매쓰플랫 고등 grade 값: 공통수학1 · 공통수학2 · 대수 · 미적분1 · 확률과 통계 · 미적분2 · 기하 — sync/mypaper_to_mathflat.js GRADE_VALUE_22 와 같음)
 *   지정하지 않으면 예전처럼 고등부는 건너뛴다. 교과서 은행이 없으면 «같은 유형»으로 대체된다. */
const HIGH = {}; args.forEach((a, i) => { if (a === '--high' && args[i + 1]) { const m = args[i + 1].match(/^([^=]+)=(.+)$/); if (m) HIGH[m[1]] = m[2]; } });
const bankId = (p) => { const m = String((p && p.pimg) || '').match(/\/problem\/(\d+)\//); return m ? Number(m[1]) : null; };
const isAuto = (p) => { if (!AUTO) return true; if (MF_AUTO) { const a = p && (p.autoScoredType || p.auto); return !!(a && a !== 'IMPOSSIBLE'); } return p && p.type !== 'ESSAY' && String(p.answer == null ? '' : p.answer).trim() !== '' && String(p.answer).trim() !== '.'; };

/* ── 재료 ── */
async function gather(sid, test, textbooks, unitRe) {
  if (!test || (Array.isArray(test) && !test.length)) {   // 시험 없이 단원 오답만 (단원으로 불린 학생)
    const M = { wrong: [], range: [], bookWrong: [], tb: { bid: null, title: '', byCid: {} }, solved: {}, warn: [], tag: '' };
    if (unitRe) await addUnit(M, sid, unitRe); return M;
  }
  const tests = Array.isArray(test) ? test : [test];
  if (tests.length > 1) {   // ★ 여러 시험: 시험마다 모은 뒤 합친다 (같은 문항은 한 번만)
    const all = []; for (const t of tests) all.push(await gather(sid, t, textbooks, null));
    const M = all[0]; const seenP = {}; M.wrong.forEach((w) => { if (w.pid) seenP[w.pid] = 1; });
    all.slice(1).forEach((o) => { o.wrong.forEach((w) => { if (w.pid && seenP[w.pid]) return; if (w.pid) seenP[w.pid] = 1; w.no = '(' + o.tag + ') ' + w.no; M.wrong.push(w); });
      o.range.forEach((c) => { if (M.range.indexOf(c) < 0) M.range.push(c); });
      const seenW = {}; M.bookWrong.forEach((w) => { seenW[w.wpId] = 1; }); o.bookWrong.forEach((w) => { if (!seenW[w.wpId]) { seenW[w.wpId] = 1; M.bookWrong.push(w); } });
      Object.assign(M.solved, o.solved); });
    if (unitRe) await addUnit(M, sid, unitRe);
    return M;
  }
  test = tests[0];
  const M = { wrong: [], range: [], bookWrong: [], tb: { bid: null, title: '', byCid: {} }, solved: {}, warn: [], tag: test.title };
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
  if (unitRe) await addUnit(M, sid, unitRe);
  return M;
}
/* ★ 단원 오답: unit = RegExp(수동 --unit: 교재 기록 chapter 글자) 또는 { cids:[유형 번호] }(자동) — 그 유형의 최근 오답(교재)을 더한다 */
async function addUnit(M, sid, re) {
  const since = new Date(Date.now() - RULE.days * 86400000).toISOString();
  let list = [];
  if (re instanceof RegExp) {
    const all = await recs(`select=chapter,concept_id&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.교재&concept_id=not.is.null&limit=5000`);
    const cids = {}; all.forEach((x) => { if (re.test(String(x.chapter || ''))) cids[Number(x.concept_id)] = 1; }); list = Object.keys(cids);
  } else list = (re.cids || []).map(String);
  M.unitN = 0; if (!list.length) { M.warn.push('단원 유형 못 찾음'); return; }
  const r = await recs(`select=book_id,page,number,workbook_problem_id,concept_id,level,score_datetime&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.교재&result=eq.X&concept_id=in.(${list.join(',')})&score_datetime=gte.${since}&order=score_datetime.desc&limit=300`);
  const seenW = {}; M.bookWrong.forEach((w) => { seenW[w.wpId] = 1; }); const bids = {};
  r.forEach((x) => { const k = Number(x.workbook_problem_id); if (!k || seenW[k]) return; seenW[k] = 1; bids[String(x.book_id)] = 1; M.unitN++;
    M.bookWrong.push({ wpId: k, bid: String(x.book_id), page: x.page, no: x.number, cid: Number(x.concept_id), lv: Number(x.level) || 3, date: String(x.score_datetime || '').slice(0, 10), pid: null, unit: true }); });
  const st = Object.keys(bids).length ? await store(Object.keys(bids).map((b) => 'mf_textbook_' + b)) : {};
  Object.keys(bids).forEach((b) => { const bank = st['mf_textbook_' + b]; if (!bank || !bank.problems) return; const byWp = {}; bank.problems.forEach((p) => { byWp[String(p.id)] = p; });
    M.bookWrong.forEach((w) => { if (w.unit && w.bid === b && !w.pid && byWp[String(w.wpId)]) { w.pid = bankId(byWp[String(w.wpId)]); w.book = bank.title || ''; if (w.pid) M.solved[String(w.pid)] = 1; } }); });
  const r3 = await recs(`select=problem_id&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.학습지&concept_id=in.(${list.join(',')})&problem_id=not.is.null&limit=2000`);
  r3.forEach((x) => { M.solved[String(x.problem_id)] = 1; });
}
/* ★ 자동 단원 → 유형 번호 (학원앱 rcws123_teacher.js 와 같은 길)
 *   보드 단원 이름 = 수집기가 «유형 → 매쓰플랫 유형칩 bigChapterName» 으로 묶은 이름 → 교재 유형칩에서 같은 이름의 유형을 고른다 */
const CHIPS = {}; let TYPEDB = null, CNAME = null;
async function unitCids(units, sid, prog, books) {
  const P = (prog && prog[sid]) || {}; const out = []; const info = [];
  for (const u of units) {
    const k = nrm(u.n); if (!k) continue;
    let hits = [];
    const scan = (loose) => Object.keys(P).forEach((b) => ((P[b] && P[b].chapters) || []).forEach((c) => { const ck = nrm(c.n); if (ck && (ck === k || (loose && (ck.includes(k) || k.includes(ck))))) hits.push({ bid: b, n: c.n }); }));
    scan(false); if (!hits.length) scan(true);
    const name = hits.length ? hits[0].n : u.n; const bids = [...new Set(hits.filter((h) => nrm(h.n) === nrm(name)).map((h) => h.bid))];
    const cids = new Set(); let how = '';
    for (const bid of bids) {
      if (CHIPS[bid] === undefined) { try { CHIPS[bid] = await mf('GET', `/concept/chips?curriculumKey=1&workbookIds=${bid}`); } catch (e) { CHIPS[bid] = null; } }
      const fromChips = (Array.isArray(CHIPS[bid]) ? CHIPS[bid] : []).filter((c) => c && c.conceptId != null && nrm(c.bigChapterName) === nrm(name)).map((c) => Number(c.conceptId));
      if (fromChips.length) { fromChips.forEach((c) => cids.add(c)); how = how || '매쓰플랫 교재 단원표'; continue; }
      // 대신 길: 유형DB 대단원 → 중단원 이름 · 유형 사전 중단원 / 기록 chapter 글자
      if (!TYPEDB) { const st = await store(['mf_typedb', 'mf_concept_names']); TYPEDB = st.mf_typedb || {}; CNAME = st.mf_concept_names || {}; }
      const gl = (books[bid] && books[bid].g) || ''; const mids = [];
      const midsOf = (g) => ((TYPEDB.grades) || []).forEach((G) => { if (g && G.g !== g) return; (G.b || []).forEach((B) => { if (nrm(B.n) === nrm(name)) (B.m || []).forEach((m) => { if (!mids.includes(m.n)) mids.push(m.n); }); }); });
      midsOf(gl); if (!mids.length) midsOf(''); if (!mids.length) mids.push(name);
      const ks = mids.map(nrm);
      const rs = await recs(`select=concept_id,chapter&mf_student_id=eq.${encodeURIComponent(sid)}&source=eq.교재&book_id=eq.${bid}&limit=3000`);
      rs.forEach((x) => { if (x.concept_id == null) return; const m = (CNAME[x.concept_id] || {}).m || ''; const lab = String(x.chapter || '').replace(/^\s*\d+\s*/, ''); if ((m && ks.includes(nrm(m))) || ks.includes(nrm(lab))) cids.add(Number(x.concept_id)); });
      if (cids.size) how = how || '중단원 이름으로 대신 (' + mids.join('·') + ')';
    }
    info.push({ n: name, rate: u.rate, cids: cids.size, how, bids }); cids.forEach((c) => { if (!out.includes(c)) out.push(c); });
  }
  return { cids: out, info };
}
function plan(M, twinPer) {
  const cnt = {}; M.wrong.forEach((w) => { cnt[w.cid] = (cnt[w.cid] || 0) + 1; }); M.bookWrong.forEach((w) => { cnt[w.cid] = (cnt[w.cid] || 0) + 1; });
  return { test: M.wrong.map((w) => ({ w, n: twinPer == null ? RULE.twinPer : twinPer })), tb: M.wrong.map((w) => ({ w, n: RULE.tbPer })), book: M.bookWrong.map((w) => ({ w, n: RULE.bookTwin })),
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
  const st = await store(['rc_state', 'rc_config', 'or_studentdb', 'mf_weekly', 'mf_textbooks', 'rc_ws_made', 'rc_ws_rule', 'mf_progress', 'mf_books']);
  const rule = Object.assign({ twoTestGrades: ['중학교 3학년'], per: {} }, st.rc_ws_rule || {});
  const state = st.rc_state || { calls: {}, dates: {} }; const cfg = Object.assign({ minScore: 80, elem6Score: 75, weeks: 3 }, st.rc_config || {});
  const wk = opt('week', Object.keys(state.calls || {}).sort().pop()); const C = (state.calls || {})[wk] || {};
  const recDate = (state.dates && state.dates[wk]) || wk;
  const from = (cfg.range && cfg.range.from) || new Date(Date.now() - cfg.weeks * 7 * 86400000).toISOString().slice(0, 10), to = (cfg.range && cfg.range.to) || new Date().toISOString().slice(0, 10);
  const sdb = Array.isArray(st.or_studentdb) ? st.or_studentdb : Object.values(st.or_studentdb || {});
  const mfs = await q('mf_students?select=mf_student_id,name,lumen_rec_code');
  const tests = ((st.mf_weekly || {}).tests || []).filter((t) => t.type === 'WEEKLY' || t.type === 'HIGH_TEST');   // 2026-10-22: 고등부는 모든 테스트(수집기 HIGH_TEST)도
  const made = (st.rc_ws_made && st.rc_ws_made.byKey) || {};
  console.log(`주 ${wk} (보충일 ${recDate}) · 기준 기간 ${from}~${to} · 자동채점 ${AUTO ? (MF_AUTO ? '매쓰플랫 기준(객관식)' : '서술형 제외·정답 있는 문항') : '제한 없음'} · ${DRY ? '[설계만]' : '[실제 생성·배정]'}`);
  const keys = Object.keys(C).filter((k) => C[k] && C[k].on && !C[k].done && !C[k].noshow && (!ONLY || k === ONLY) && SKIP.indexOf(k) < 0);
  if (!DRY) await mfLogin();
  else await mfLogin();   // 조회(필터·쌍둥이)는 dry 에서도 매쓰플랫 로그인이 필요하다 (쓰기는 없음)
  const results = [];
  for (const k of keys) {
    const e = C[k]; const stu = sdb.find((s) => String(s.id) === String(k)) || sdb.find((s) => s.name === k) || sdb.find((s) => e.snap && s.name === e.snap.name);
    const name = (stu && stu.name) || (e.snap && e.snap.name) || k; const grade = (stu && stu.grade) || (e.snap && e.snap.grade) || '';
    const line = (s) => console.log(`  ${s}`);
    const already = made[k] && made[k].wk === wk;
    console.log(`\n▶ ${mask(name)} (${grade}) ${already ? '— 이미 이번 주 학습지 있음 #' + made[k].wsId + (FORCE_DESIGN ? ' (설계만 다시 — --force-design)' : ' (건너뜀)') : ''}`);
    if (already && !FORCE_DESIGN) { results.push({ k, skip: 'already' }); continue; }
    let hit = stu && mfs.find((m) => m.lumen_rec_code && stu.lumen_rec_code && m.lumen_rec_code === stu.lumen_rec_code); if (!hit) { const same = mfs.filter((m) => m.name === name); if (same.length === 1) hit = same[0]; }
    const sid = hit && hit.mf_student_id; if (!sid) { line('✗ 매쓰플랫 학생 번호를 찾지 못함'); results.push({ k, skip: 'no sid' }); continue; }
    const school = schoolOf(grade) || (HIGH[k] && /고/.test(String(grade)) ? { schoolType: 'HIGH', grade: HIGH[k] } : null);
    if (!school) { line('✗ 고등부(또는 학년 미상) — 제외 (만들려면 --high <학생키>=<과목>)'); results.push({ k, skip: 'school' }); continue; }
    if (school.schoolType === 'HIGH') line(`고등부 과목 ${school.grade} (--high)`);
    const band = bandOf(grade); const cut = band === 'elem6' ? cfg.elem6Score : cfg.minScore;
    let test = null;
    tests.forEach((t) => { const me = (t.students || []).find((s) => String(s.sid) === String(sid) && s.score != null); if (!me) return; const on = me.date || t.date; if (!on || on < from || on > to) return; if (me.score < cut && (!test || String(on) > String(test.date))) test = { wid: t.wid, title: t.title, date: on, score: me.score }; });
    if (!test) tests.forEach((t) => { const me = (t.students || []).find((s) => String(s.sid) === String(sid) && s.score != null); if (!me) return; const on = me.date || t.date; if (on && on >= from && (!test || String(on) > String(test.date))) test = { wid: t.wid, title: t.title, date: on, score: me.score, anyScore: true }; });
    if (!test && !(e.snap && e.snap.units && e.snap.units.length)) { line('✗ 기간 안 주간테스트 기록 없음'); results.push({ k, skip: 'no test' }); continue; }
    if (test) line(`시험 ${test.title} ${test.date} ${test.score}점${test.anyScore ? ' (기준 점수 이상이지만 호출 확정이라 포함)' : ''}`);
    else line('기간 안 주간테스트 없음 — 단원 오답으로만');
    let useTests = test;
    const mine = []; tests.forEach((t) => { const me = (t.students || []).find((s) => String(s.sid) === String(sid) && s.score != null); if (me) mine.push({ wid: t.wid, title: t.title, date: me.date || t.date, score: me.score }); });
    mine.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const per = (rule.per || {})[k] && rule.per[k].wk === wk ? rule.per[k] : null;
    const two = TESTS2 ? String(grade).indexOf(TESTS2) >= 0 : (rule.twoTestGrades || []).some((g) => gradeKey(g) === gradeKey(grade));
    const pickW = TESTS[k] || (per && Array.isArray(per.wids) ? per.wids.map(String) : null);
    if (pickW) {   // ★ 고른 주간테스트 (--tests 또는 학원앱 팝업 선택)
      const sel = mine.filter((t) => pickW.includes(String(t.wid)));
      if (sel.length || !pickW.length) { useTests = sel; line(`고른 시험 ${sel.length}개${TESTS[k] ? ' (--tests)' : ' (학원앱 선택)'}: ${sel.map((t) => t.title + ' ' + t.date + ' ' + t.score + '점').join(' + ') || '없음'}`); }
    } else if (two) {   // ★ 최근 주간테스트 2개 (응시일 기준)
      useTests = mine.slice(0, 2);
      line(`시험 2개 합침: ${useTests.map((t) => t.title + ' ' + t.date + ' ' + t.score + '점').join(' + ')}`);
    }
    const twinPer = (TWIN1.indexOf(k) >= 0 || (per && per.twin1)) ? 1 : null; if (twinPer) line('시험 오답 쌍둥이 1개씩 (줄임)');
    const noBook = NOBOOK.indexOf(k) >= 0 || !!(per && per.noBook);
    let unitArg = UNIT[k] || null, unitInfo = null;
    if (!unitArg && UNIT_AUTO && !(per && per.unit === false) && e.snap && e.snap.units && e.snap.units.length) {
      const U = await unitCids(e.snap.units, sid, st.mf_progress && st.mf_progress.byStudent, (st.mf_books && st.mf_books.books) || {});
      unitInfo = U.info; if (U.cids.length) unitArg = { cids: U.cids };
      U.info.forEach((u) => line(`단원 「${u.n}」${u.rate != null ? ' ' + u.rate + '%' : ''} → 유형 ${u.cids}개${u.how ? ' (' + u.how + ')' : ' (못 찾음)'}`));
    }
    try {
      const M = await gather(sid, useTests, st.mf_textbooks || {}, unitArg); if (noBook) { M.bookWrong = M.bookWrong.filter((w) => w.unit); line('교재 오답 뺌 (줄임 · 단원 오답은 남김)'); } const P = plan(M, twinPer); if (unitArg) line(`단원 오답 ${M.unitN || 0}문항 더함 (${UNIT[k] ? UNIT[k].source : '자동'})`);
      line(`시험 오답 ${M.wrong.length} · 범위 유형 ${M.range.length} · 교재 오답(범위 안·${RULE.days}일) ${M.bookWrong.length}${M.bookWrong.filter((w) => !w.pid).length ? ' (번호 못 찾음 ' + M.bookWrong.filter((w) => !w.pid).length + ')' : ''} · 교과서 ${M.tb.title || '없음'} · 보강 유형 ${P.boost.length}` + (M.warn.length ? ' · ⚠ ' + M.warn.join(' / ') : ''));
      if (!M.wrong.length && !M.bookWrong.length) { line('✗ 틀린 문항이 없어 만들지 않음'); results.push({ k, skip: 'no wrong' }); continue; }
      const res = await build(M, P, name, school, sid, recDate, line);
      line(`${DRY ? '설계' : '✅ 생성·배정'} ${res.title.replace(name, mask(name))} · ${res.n}문항 (시험 쌍둥이 ${res.parts.twin} · 교과서 ${res.parts.tb} · 교재 쌍둥이 ${res.parts.book} · 보강 ${res.parts.boost}${res.parts.fallback ? ' · 같은 유형 대체 ' + res.parts.fallback : ''})${res.wsId ? ' · 매쓰플랫 #' + res.wsId : ''}`);
      results.push({ k, ok: true, res });
      if (!DRY) {
        made[k] = { wk, wsId: res.wsId, title: res.title, n: res.n, parts: res.parts, at: res.at, by: 'server', auto: AUTO };
        await setItem('rc_ws_made', { byKey: made, updated: new Date().toISOString() });
        const fresh = (await store(['rc_state'])).rc_state || state; if (fresh.calls && fresh.calls[wk] && fresh.calls[wk][k]) { fresh.calls[wk][k].ws = { wsId: res.wsId, n: res.n, parts: res.parts, at: res.at }; if (UPD_SCORE && fresh.calls[wk][k].snap) { const lt = (Array.isArray(useTests) ? useTests.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))) : [useTests])[0]; if (lt) { fresh.calls[wk][k].snap.score = lt.score; fresh.calls[wk][k].snap.scoreDate = lt.date; fresh.calls[wk][k].snap.testTitle = lt.title; } } await setItem('rc_state', { calls: fresh.calls, dates: fresh.dates || {}, periods: fresh.periods || {}, updated: new Date().toISOString() }); }
      }
    } catch (err) { line('✗ 실패: ' + err.message); results.push({ k, skip: 'error', why: err.message }); }
    await new Promise((r) => setTimeout(r, 300));
  }
  const ok = results.filter((r) => r.ok); const tot = ok.reduce((s, r) => s + r.res.n, 0);
  console.log(`\n${DRY ? '[설계만]' : '[완료]'} 확정 ${keys.length}명 중 ${ok.length}명 ${DRY ? '설계' : '생성·배정'} · 총 ${tot}문항 · 건너뜀 ${results.length - ok.length}명 (${results.filter((r) => !r.ok).map((r) => r.skip).join(', ') || '-'})`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
