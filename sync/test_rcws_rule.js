#!/usr/bin/env node
/* 서버판 리커버리 학습지(sync/rcws_make.js) 규칙 검사 — v19-155 와 같은 규칙인지 (가짜 fetch · 실제 서버·매쓰플랫 호출 없음 · 가짜 번호만)
 *   ① rc_ws_rule 읽기(예전 저장분 → 새 기본 구성 · --classic) ② 학생 한 명 규칙(명령줄 → 학생별 per → 규칙)
 *   ③ 최근 «아직 틀린 문제»(다시 풀어 맞힌 문제·테스트 문제 빼기 · 범위 안 교재 오답과 한 번만 · 56일 넓히기 재료)
 *   ④ 유형마다 1개(가장 최근) ⑤ 상한 우선순위 ⑥ 하한(넓히기 → 같은 유형) ⑦ 최상 빼기 ⑧ 고등 과목 글자
 *   실행: node sync/test_rcws_rule.js */
process.env.SUPABASE_URL = 'http://sb.fake'; process.env.SUPABASE_SERVICE_KEY = 'fake';
process.argv = [process.argv[0], 'rcws_make.js', '--dry'];
const DAY = 86400000, iso = (d) => new Date(Date.now() - d * DAY).toISOString();
const CID = {}, LV = {}; let fn = 0; const FIL = {}; const CALLS = [];
let RECS = [];
const BANK = { mf_textbook_77: { title: '가짜 교재', problems: [{ id: 1, pimg: 'https://x/problem/1001/a.png' }, { id: 3, pimg: 'https://x/problem/1003/a.png' }, { id: 5, pimg: 'https://x/problem/1005/a.png' }] } };
const prob = (id, c, lv) => { CID[id] = c; LV[id] = lv; return { id, conceptId: c, level: lv, type: 'SHORT', answer: '1' }; };
global.fetch = async (url, o) => {
  const u = String(url), body = o && o.body ? JSON.parse(o.body) : null; CALLS.push((o && o.method || 'GET') + ' ' + u.replace(/\?.*/, ''));
  const ok = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
  if (u.startsWith('http://sb.fake/rest/v1/mf_answer_records')) return ok(RECS);
  if (u.startsWith('http://sb.fake/rest/v1/lumen_store')) { const m = decodeURIComponent(u).match(/key=in\.\(([^)]*)\)/); const ks = m ? m[1].split(',') : []; return ok(ks.filter((k) => BANK[k]).map((k) => ({ key: k, value: BANK[k] }))); }
  if (u.startsWith('https://api.mathflat.com')) {
    const p = u.slice('https://api.mathflat.com'.length);
    if (p === '/worksheet/filter/concept') { fn++; FIL['F' + fn] = (body.conceptIdList || []).slice(); return ok({ data: { filterId: 'F' + fn } }); }
    if (p.startsWith('/derivation/problem/')) { const pid = Number(p.split('/').pop()); const c = CID[pid] || 999;
      return ok({ data: { pairProblemList: [prob(pid * 10 + 1, c, 5), prob(pid * 10 + 2, c, 4), prob(pid * 10 + 3, c, 3)].map((x) => ({ problem: x })), similarProblemList: [] } }); }
    if (p === '/worksheet/problem') { const out = []; (FIL[body.filterId] || []).forEach((c) => { for (let k = 1; k <= 6; k++) out.push({ problem: prob(c * 100 + k, c, k <= 2 ? 5 : 3) }); }); return ok({ data: out }); }
  }
  throw new Error('막힌 주소 ' + u);
};
const X = require('./rcws_make.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : '  ← ' + (info || ''))); };

(async () => {
  /* ① 규칙 읽기 */
  const old = X.ruleOf({ twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, twoTestGrades: ['중학교 3학년'], per: { S1: { wk: 'w', twin1: true } } }, []);
  t('규칙 ① 예전 저장분 → 쌍둥이 1 · 교과서 0 · 교재 0 · 보강 끔 · 최근 1주 · 유형마다 1개 · 최상 빼기 · 상한 없음 · 중3 2개 끔', old.twinPer === 1 && old.tbPer === 0 && old.bookTwin === 0 && old.boost === false && old.recent.on && old.recent.days === 7 && old.perType && old.hardest === false && old.max === 0 && old.twoTestGrades.length === 0 && old.per.S1.twin1, JSON.stringify(old));
  const keep = X.ruleOf({ v155: 1, twinPer: 2, recent: { on: true, days: 14 }, hardest: true }, []);
  t('규칙 ② v155 로 저장된 값은 그대로 (쌍둥이 2 · 2주 · 최상 포함)', keep.twinPer === 2 && keep.recent.days === 14 && keep.hardest === true);
  const cl = X.ruleOf({ v155: 1 }, ['--classic']);
  t('규칙 ③ --classic = 예전 구성 (쌍둥이 2 · 교과서 1 · 교재 1 · 보강 · 자동 단원 · 최근 끔 · 최상 포함)', cl.twinPer === 2 && cl.tbPer === 1 && cl.bookTwin === 1 && cl.boost && cl.unitAuto && cl.recent.on === false && cl.hardest);

  /* ② 학생 한 명 규칙 */
  const r0 = X.ruleOf({}, []);
  let c = X.cfgFor(r0, null, 'S1', []);
  t('학생 ① 기본: 최근 7일 · 유형마다 1개 · 최상 빼기 · 상한·하한 없음 · 자동 단원 끔', c.R && c.R.days === 7 && c.perType && !c.hardest && c.max === 0 && c.min === 0 && !c.unitOn, JSON.stringify(c));
  c = X.cfgFor(r0, { recentDays: 14 }, 'S1', []);
  t('학생 ② 학생별 2주 → 상한 40 자동', c.R.days === 14 && c.max === 40 && c.autoMax, JSON.stringify(c));
  c = X.cfgFor(Object.assign({}, r0, { recent: { on: true, days: 28 } }), null, 'S1', []);
  t('학생 ③ 규칙 4주 → 상한 40 자동', c.max === 40 && c.autoMax);
  c = X.cfgFor(r0, { recentDays: 14 }, 'S1', ['--max', '30', '--min', '20']);
  t('학생 ④ 명령줄 --max/--min 이 이긴다', c.max === 30 && c.min === 20 && !c.autoMax, JSON.stringify(c));
  c = X.cfgFor(r0, { recentDays: 14, max: 0 }, 'S1', []);
  t('학생 ⑤ 학생별 상한 0 = 없음', c.max === 0);
  c = X.cfgFor(r0, null, 'S1', ['--recent', 'S1=21:중1', '--recent', 'S2=5']);
  t('학생 ⑥ --recent <학생키>=21:정규식 이 이긴다 (그 학생만)', c.R.cli && c.R.days === 21 && c.R.re && c.R.re.test('중1-2') && c.max === 40);
  t('학생 ⑦ --no-recent · 학생별 recent:false · 규칙 끔', !X.cfgFor(r0, null, 'S1', ['--no-recent']).R && !X.cfgFor(r0, { recent: false }, 'S1', []).R && !X.cfgFor(Object.assign({}, r0, { recent: { on: false, days: 7 } }), null, 'S1', []).R);
  t('학생 ⑧ 최상: 학생별 hardest · --hardest/--no-hardest', X.cfgFor(r0, { hardest: true }, 'S1', []).hardest && X.cfgFor(r0, null, 'S1', ['--hardest']).hardest && !X.cfgFor(r0, { hardest: true }, 'S1', ['--no-hardest']).hardest);
  t('학생 ⑨ 유형마다 1개: --no-per-type · 단원: 학생별 unitOn · --no-unit-auto', !X.cfgFor(r0, null, 'S1', ['--no-per-type']).perType && X.cfgFor(r0, { unitOn: true }, 'S1', []).unitOn && !X.cfgFor(r0, { unitOn: true }, 'S1', ['--no-unit-auto']).unitOn);

  /* ③ 최근 «아직 틀린 문제» */
  RECS = [
    { id: 1, source: '교재', book_id: 77, page: 10, number: 1, workbook_problem_id: 1, concept_id: 10, level: 3, result: 'X', score_datetime: iso(2) },
    { id: 2, source: '교재', book_id: 77, page: 10, number: 2, workbook_problem_id: 2, concept_id: 10, level: 3, result: 'X', score_datetime: iso(3) },
    { id: 3, source: '교재', book_id: 77, page: 11, number: 3, workbook_problem_id: 3, concept_id: 11, level: 3, result: 'X', score_datetime: iso(4) },
    { id: 4, source: '교재', book_id: 77, page: 11, number: 4, workbook_problem_id: 4, concept_id: 12, level: 3, result: 'X', score_datetime: iso(5) },
    { id: 5, source: '교재', book_id: 77, page: 11, number: 4, workbook_problem_id: 4, concept_id: 12, level: 3, result: 'O', score_datetime: iso(1) },
    { id: 6, source: '학습지', worksheet_title: '주간', number: 7, problem_id: 500, concept_id: 13, level: 3, result: 'X', score_datetime: iso(3) },
    { id: 7, source: '학습지', worksheet_title: '단원평가', number: 2, problem_id: 600, concept_id: 14, level: 5, result: 'X', score_datetime: iso(2) },
    { id: 8, source: '교재', book_id: 77, page: 12, number: 1, workbook_problem_id: 5, concept_id: 15, level: 3, result: 'X', score_datetime: iso(20) },
  ].sort((a, b) => a.score_datetime.localeCompare(b.score_datetime));
  const M = { wrong: [{ no: 7, pid: 500, cid: 13, lv: 3 }], range: [11, 13], bookWrong: [{ wpId: 3, bid: '77', page: 11, no: 3, cid: 11, lv: 3, date: '', pid: 1003 }], tb: { bid: null, title: '', byCid: {} }, solved: { 500: 1, 1003: 1 }, warn: [] };
  const n = await X.addRecent(M, 'M1', { days: 7, re: null });
  const ids = M.bookWrong.map((w) => (w.wpId ? 'w' + w.wpId : 'p' + w.pid) + (w.recent ? 'R' : '')).sort().join(',');
  t('최근 ① 1주 안 아직 틀린 문제 3개 더함(w1·w2·학습지 600) · 범위 안 w3 은 «최근» 표시만', n === 3 && ids === 'p600R,w1R,w2R,w3R', ids);
  t('최근 ② 다시 풀어 맞힌 w4 · 테스트 문제 500 은 빠짐', !M.bookWrong.some((w) => w.wpId === 4 || w.pid === 500) && M.recentFixed === 1);
  t('최근 ③ 교재 은행으로 번호(w1→1001) · 이미 푼 문제로 표시', M.bookWrong.find((w) => w.wpId === 1).pid === 1001 && M.solved[1001] && M.solved[600]);
  t('최근 ④ 1주 밖·56일 안 w5 는 넓히기 재료(recentWide)', M.recentWide.length === 1 && M.recentWide[0].wpId === 5 && M.recentWide[0].pid === 1005, JSON.stringify(M.recentWide));

  /* ④ 유형마다 1개 */
  Object.assign(X.RULE, { twinPer: 1, tbPer: 0, bookTwin: 0, boost: false });
  const P = X.plan(M, null);
  t('계획 ① 최근 오답은 쌍둥이 1개씩 (교재 오답 칸이 0이어도)', P.book.filter((z) => z.w.recent).every((z) => z.n === 1));
  const g = X.groupPerType(P);
  t('계획 ② 유형마다 1개 = 가장 최근 (c10 은 w1 만)', g === 1 && P.book.find((z) => z.w.wpId === 1).n === 1 && P.book.find((z) => z.w.wpId === 2).n === 0, JSON.stringify(P.book.map((z) => [z.w.wpId || z.w.pid, z.n])));

  /* ⑤ 상한 우선순위 */
  const mkM = () => ({ wrong: [{ no: 1, pid: 2001, cid: 20, lv: 3 }, { no: 2, pid: 2002, cid: 21, lv: 3 }, { no: 3, pid: 2003, cid: 22, lv: 3 }], range: [20, 21, 22],
    bookWrong: [{ wpId: 31, pid: 3001, cid: 30, lv: 3, page: 1, no: 1, recent: true, unit: true, at: Date.now() - 5 * DAY }, { wpId: 32, pid: 3002, cid: 31, lv: 3, page: 1, no: 2, recent: true, unit: true, at: Date.now() - 1 * DAY }, { wpId: 33, pid: 3003, cid: 32, lv: 3, page: 1, no: 3 }],
    tb: { bid: '9', title: '교과서', byCid: { 20: [{ id: 4001, lv: 3, type: 'SHORT', answer: '1' }], 21: [{ id: 4002, lv: 3, type: 'SHORT', answer: '1' }], 22: [{ id: 4003, lv: 3, type: 'SHORT', answer: '1' }] } }, solved: {}, warn: [] });
  [2001, 2002, 2003].forEach((p, i) => { CID[p] = 20 + i; }); CID[3001] = 30; CID[3002] = 31; CID[3003] = 32;
  const P2 = () => ({ test: [0, 1, 2].map((i) => ({ w: mkM().wrong[i], n: 2 })), tb: [0, 1, 2].map((i) => ({ w: mkM().wrong[i], n: 1 })), book: mkM().bookWrong.map((w) => ({ w, n: 1 })), boost: [{ cid: 20, n: 1, times: 2 }] });
  const logs = []; const log = (s) => logs.push(s);
  let r = await X.build(mkM(), P2(), '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 8, min: 0, hardest: true });
  t('상한 ① 13 → 8 = 쌍둥이 첫째 3 · 최근 오답 2 · 교과서 3 (쌍둥이 둘째·보강·교재 오답 뺌)', r.n === 8 && r.parts.twin === 3 && r.parts.recent === 2 && r.parts.tb === 3 && r.parts.boost === 0 && r.parts.book === 2 && r.parts.cut === 5, JSON.stringify(r.parts));
  r = await X.build(mkM(), P2(), '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 4, min: 0, hardest: true });
  t('상한 ② 4 → 쌍둥이 첫째 3 + 최근 오답 중 새것(3002 쌍둥이)', r.n === 4 && r.parts.recent === 1 && r.items.some((it) => Math.floor(it.id / 10) === 3002) && !r.items.some((it) => Math.floor(it.id / 10) === 3001), JSON.stringify(r.items.map((it) => it.id)));
  r = await X.build(mkM(), P2(), '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 0, min: 0, hardest: true });
  t('상한 ③ 상한 없음이면 13 그대로', r.n === 13, r.n);

  /* ⑥ 하한 — 넓히기 → 같은 유형 */
  const M3 = mkM(); M3.recentWide = [{ wpId: 41, pid: 5001, cid: 40, lv: 3, page: 2, no: 1, recent: true, wide: true }, { wpId: 42, pid: 5002, cid: 41, lv: 3, page: 2, no: 2, recent: true, wide: true }]; CID[5001] = 40; CID[5002] = 41;
  const P3 = { test: M3.wrong.map((w) => ({ w, n: 1 })), tb: M3.wrong.map((w) => ({ w, n: 0 })), book: [], boost: [] };
  logs.length = 0;
  r = await X.build(M3, P3, '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 0, min: 7, hardest: true, perType: true });
  t('하한 ① 3 → 7 = 넓히기 2 (56일) + 같은 유형 2', r.n === 7 && r.parts.wide === 2 && r.parts.recent === 2 && r.parts.boost === 2, JSON.stringify(r.parts) + ' ' + logs.join(' | '));
  t('하한 ② 넓힌 유형도 첫 필터에 들어감', FIL['F' + (fn - 0)] ? Object.values(FIL).some((l) => l.includes(40) && l.includes(41)) : false);

  /* ⑦ 최상 빼기 */
  const M4 = mkM(); M4.wrong[0].lv = 5;
  const P4 = { test: [{ w: M4.wrong[0], n: 1 }], tb: [], book: [], boost: [] };
  r = await X.build(M4, P4, '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 0, min: 0, hardest: false });
  t('최상 ① 빼기 — 최상 문제의 쌍둥이도 상(4)으로', r.items.length === 1 && LV[r.items[0].id] === 4, JSON.stringify(r.items));
  r = await X.build(mkM(), { test: [{ w: Object.assign(mkM().wrong[0], { lv: 5 }), n: 1 }], tb: [], book: [], boost: [] }, '가짜', { schoolType: 'MIDDLE', grade: '2' }, 'M1', '2026-10-24', log, { max: 0, min: 0, hardest: true });
  t('최상 ② 포함 — 최상 그대로', r.items.length === 1 && LV[r.items[0].id] === 5);

  /* ⑧ 고등 과목 */
  t('고등 ① 제목 [공통수학2] → 공통수학2 · 미적분Ⅰ → 미적분1 · 확률과통계 → 확률과 통계 · 없는 과목은 빈 글자',
    X.subjFromTitle('[공통수학2] 집합과 명제') === '공통수학2' && X.subjNorm('미적분Ⅰ') === '미적분1' && X.subjNorm('확률과통계') === '확률과 통계' && X.subjFromTitle('고1 일일테스트') === '' && X.subjNorm('수학') === '');
  t('외부 호출은 가짜뿐 (만들기 POST /worksheet 없음 — --dry)', !CALLS.some((c) => /POST https:\/\/api\.mathflat\.com\/worksheet$/.test(c)));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
