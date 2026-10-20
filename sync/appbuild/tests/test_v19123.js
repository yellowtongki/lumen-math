#!/usr/bin/env node
/* 학원앱 v19-123 검사 — 🧩 리커버리 학습지 새 규칙
 *   가짜 서버(lumen_store · mf_students · mf_answer_records 흉내, 쓰기를 모두 적는다) · 가짜 매쓰플랫(rcwsApi.call) · 외부망 차단 · 가짜 학생(○○○)
 *   ① 중3 기본 = 응시일 기준 최근 2개(시험지 날짜가 아니라 학생 응시일) · 다른 학년 = 보드가 고른 1개
 *   ② 두 시험 합치기: 오답(같은 문제 한 번만) · 범위 유형 · 교재 오답 합침 / 이번 주만 · 지난 주만 고르기 → rc_ws_rule.per 에 저장 · 다시 열어도 그대로
 *   ③ 오답 1배수 · 교재 오답 빼기 · 구성 한 줄
 *   ④ 단원으로 불린 학생: 매쓰플랫 교재 단원표(bigChapterName)로 그 단원 오답만 더함 (다른 단원 오답 안 섞임) · 계정 없으면 유형DB 중단원으로 대신
 *   ⑤ 만들면 rc_state 의 snap.score/scoreDate/testTitle = 쓴 시험 중 가장 최근 · rc_ws_made 기록 · 매쓰플랫 POST /worksheet 한 번(가짜)
 *   ⑥ 규칙 저장: twoTestGrades 끄기/켜기 · 다른 규칙 단추가 per·twoTestGrades 를 지우지 않음 · 지난 주 선택은 무시
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19123.js lumen_v19-123.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-123.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-123'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'rcws123_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ts = (n) => new Date(Date.now() + n * 86400000).toISOString();

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', group: 'M3', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 1학년', group: 'M1', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중학교 2학년', group: 'M2', lumen_rec_code: 'AAA333', lumen_planner: {} }];
const MFS = [{ mf_student_id: 'M1', name: '○○○1', lumen_rec_code: 'AAA111' }, { mf_student_id: 'M2', name: '○○○2', lumen_rec_code: 'AAA222' }, { mf_student_id: 'M3', name: '○○○3', lumen_rec_code: 'AAA333' }];
/* 시험지 날짜(t.date)와 학생 응시일(me.date)을 일부러 엇갈리게 — 응시일로 골라야 101(이번 주)·100(지난 주) */
const TESTS = [
  { wid: 101, type: 'WEEKLY', title: '중3 주간 B', date: day(-9), students: [{ sid: 'M1', score: 60, date: day(-1), correct: 6, total: 10 }] },
  { wid: 100, type: 'WEEKLY', title: '중3 주간 A', date: day(-1), students: [{ sid: 'M1', score: 70, date: day(-8), correct: 7, total: 10 }] },
  { wid: 99, type: 'WEEKLY', title: '중3 주간 옛', date: day(-15), students: [{ sid: 'M1', score: 90, date: day(-15), correct: 9, total: 10 }] },
  { wid: 201, type: 'WEEKLY', title: '중1·2 주간', date: day(-2), students: [{ sid: 'M2', score: 85, date: day(-2), correct: 17, total: 20 }, { sid: 'M3', score: 50, date: day(-2), correct: 5, total: 10 }] }];
const R = [];
const ws = (wid, sid, seq, cid, res, pid) => R.push({ source: '학습지', worksheet_id: wid, mf_student_id: sid, problem_seq: seq, number: seq, result: res, concept_id: cid, level: 3, problem_id: pid, score_datetime: ts(-1), student_worksheet_id: 'sw' + wid });
ws(101, 'M1', 1, 11, 'X', 1001); ws(101, 'M1', 2, 12, 'X', 1002); ws(101, 'M1', 3, 13, 'X', 1003); ws(101, 'M1', 4, 14, 'O', 1004); ws(101, 'M1', 5, 15, 'O', 1005);
ws(100, 'M1', 1, 11, 'X', 1001); ws(100, 'M1', 2, 16, 'X', 1006); ws(100, 'M1', 3, 17, 'O', 1007);
ws(201, 'M2', 1, 81, 'X', 2001); ws(201, 'M2', 2, 82, 'O', 2002);
ws(201, 'M3', 1, 81, 'X', 3001); ws(201, 'M3', 2, 82, 'X', 3002);
const bk = (sid, bid, wp, cid, res, chapter, dd) => R.push({ source: '교재', mf_student_id: sid, book_id: bid, page: '50', number: String(wp % 100), workbook_problem_id: wp, concept_id: cid, level: 3, result: res, chapter, score_datetime: ts(dd == null ? -3 : dd) });
bk('M1', 'B1', 5001, 12, 'X', '1 다항식'); bk('M1', 'B1', 5002, 16, 'X', '2 인수분해'); bk('M1', 'B1', 5003, 99, 'X', '3 기타');
bk('M2', 'B7', 7001, 71, 'X', '5 다면체와 회전체'); bk('M2', 'B7', 7002, 72, 'X', 'STEP 1 쏙쏙 개념 익히기'); bk('M2', 'B7', 7003, 73, 'O', 'STEP 2 탄탄');
bk('M2', 'B7', 7004, 71, 'X', '5 다면체와 회전체', -60);   /* 기준 일수 밖 */
bk('M2', 'B7', 8001, 81, 'X', '3 다각형');                  /* 다른 단원(평면도형의 성질) — 시험 범위 안 교재 오답 */
bk('M2', 'B7', 8002, 83, 'X', '3 다각형');                  /* 다른 단원 · 범위 밖 — 어디에도 안 들어가야 */
const CHIPS = { B7: [{ conceptId: 71, bigChapterName: '입체도형의 성질' }, { conceptId: 72, bigChapterName: '입체도형의 성질' }, { conceptId: 73, bigChapterName: '입체도형의 성질' },
  { conceptId: 81, bigChapterName: '평면도형의 성질' }, { conceptId: 83, bigChapterName: '평면도형의 성질' }] };
const SEED = {
  rc_config: { minScore: 80, minUnit: 60, elem6Score: 75, weeks: 3 },
  mf_weekly: { tests: TESTS },
  mf_progress: { byStudent: { M2: { B7: { lastDate: day(-1), firstDate: day(-30), maxPage: 111, curKey: 'r1', chapters: [{ n: '평면도형의 성질', minP: 80, maxP: 100, correct: 40, total: 50 }, { n: '입체도형의 성질', minP: 101, maxP: 111, correct: 5, total: 10 }] } } } },
  mf_books: { books: { B7: { n: '가짜 교재 중등수학1(하)', g: '중1-2' }, B1: { n: '가짜 교재 3', g: '중3-1' } } },
  mf_textbooks: { byStudent: {}, books: {} },
  mf_textbook_B1: { title: '가짜 교재 3', problems: [{ id: 5001, pimg: '/problem/9001/a' }, { id: 5002, pimg: '/problem/9002/a' }] },
  mf_textbook_B7: { title: '가짜 교재 1', problems: [{ id: 7001, pimg: '/problem/9701/a' }, { id: 7002, pimg: '/problem/9702/a' }, { id: 8001, pimg: '/problem/9801/a' }] },
  mf_type_ach: { periods: ['2026-10-01'], names: { 11: { m: '다항식', n: '유형11' }, 71: { m: '다면체와 회전체', n: '유형71' }, 72: { m: '입체도형의 겉넓이와 부피', n: '유형72' }, 81: { m: '다각형', n: '유형81' } }, data: {} },
  mf_typedb: { grades: [{ g: '중1-2', b: [{ n: '입체도형의 성질', m: [{ n: '다면체와 회전체' }, { n: '입체도형의 겉넓이와 부피' }] }, { n: '평면도형의 성질', m: [{ n: '다각형' }] }] }] },
  rc_ws_rule: { twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, theory: false, days: 28, auto: true },
  rc_ws_made: { byKey: {} } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, SEED, MFS, R, CHIPS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], toasts: [], mf: [], SEED, MFS, R, CHIPS };
    const mk = (tbl) => {
      const b = { f: [], one: false, op: 'select', eqv: [], lim: 1e9, ord: null,
        select() { return b; }, eq(k, v) { b.eqv.push(v); b.f.push((x) => String(x[k]) === String(v)); return b; },
        in(k, a) { const s = a.map(String); b.f.push((x) => s.indexOf(String(x[k])) >= 0); return b; },
        gte(k, v) { b.f.push((x) => String(x[k]) >= String(v)); return b; }, lte(k, v) { b.f.push((x) => String(x[k]) <= String(v)); return b; },
        not(k, op, v) { if (op === 'is' && v === null) b.f.push((x) => x[k] != null); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => String(x[k]).indexOf(pre) === 0); return b; },
        or() { return b; }, order(k, o) { b.ord = { k, asc: !o || o.ascending !== false }; return b; }, limit(n) { b.lim = n; return b; }, range() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.w.push({ op: 'put', tbl, key: r.key }); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) {
          if (b.op !== 'select') { T.w.push({ op: b.op, tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          let rows = tbl === 'lumen_store' ? Object.keys(T.store).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }))
            : tbl === 'mf_students' ? clone(T.MFS) : tbl === 'mf_answer_records' ? clone(T.R) : [];
          rows = rows.filter((x) => b.f.every((fn) => fn(x)));
          if (b.ord) rows.sort((x, y) => (String(x[b.ord.k]) < String(y[b.ord.k]) ? -1 : String(x[b.ord.k]) > String(y[b.ord.k]) ? 1 : 0) * (b.ord.asc ? 1 : -1));
          rows = rows.slice(0, b.lim);
          return Promise.resolve({ data: b.one ? (rows[0] || null) : rows, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('ALERT ' + m); };
    /* 가짜 매쓰플랫 — 문제 번호는 부르는 순서대로 새로 */
    let nid = 50000;
    const prob = (cid) => ({ id: ++nid, level: 3, type: 'SHORT_ANSWER', answer: '3', conceptId: cid });
    rcwsApi.call = async (m, p, body) => {
      T.mf.push({ m, p, body: clone(body) });
      if (p.indexOf('/concept/chips') === 0) { const bid = (p.match(/workbookIds=([^&]+)/) || [])[1]; return clone(T.CHIPS[bid] || []); }
      if (p === '/worksheet/filter/concept') return { filterId: 'F' + T.mf.length, cids: body.conceptIdList };
      if (p === '/worksheet/problem') { const out = []; const f = T.mf.slice().reverse().find((x) => x.p === '/worksheet/filter/concept'); ((f && f.body.conceptIdList) || []).forEach((c) => { for (let i = 0; i < 6; i++) out.push(prob(c)); }); return out; }
      if (p.indexOf('/derivation/problem/') === 0) return { pairProblemList: [{ problem: prob(1) }, { problem: prob(1) }, { problem: prob(1) }], similarProblemList: [{ problem: prob(1) }] };
      if (p === '/worksheet' && m === 'POST') return { id: 777000 + T.mf.filter((x) => x.p === '/worksheet').length };
      throw new Error('모르는 매쓰플랫 주소 ' + p);
    };
    localStorage.setItem('or_mf_id', 'fake_id'); localStorage.setItem('or_mf_pw', 'fake_pw');
    T.reset = () => { T.store = clone(T.SEED); T.w = []; T.toasts = []; T.mf = []; };
    T.reset();
    /* 앱의 뒤쪽 동기화가 학생 목록을 바꿀 수 있어 칸마다 다시 넣는다 */
    T.stu = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); };
    T.stu();
  }, { STUDENTS, SEED, MFS, R, CHIPS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const boot = async (extra) => {
    await pg.evaluate((extra) => {
      T.reset(); if (extra) extra.forEach(([k, v]) => { T.store[k] = v; });
      const wk = rcWeekKey();
      T.store.rc_state = T.store.rc_state || { calls: { [wk]: {
        S1: { on: true, snap: { name: '○○○1', grade: '중학교 3학년', score: 70, rx: [], units: [] } },
        S2: { on: true, snap: { name: '○○○2', grade: '중학교 1학년', score: null, rx: [], units: [{ n: '입체도형의 성질', rate: 50 }] } },
        S3: { on: true, snap: { name: '○○○3', grade: '중학교 2학년', score: 50, rx: [], units: [] } } } }, dates: {}, periods: {} };
      T.stu(); RC.loaded = false; BP.loaded = false; WK.loaded = false; RCWS.loaded = false; RCWS.cache = {}; RCWS.made = {}; RCWS.rule = null; window.MF_TYPE_ACH = null;
    }, extra || null);
    await pg.evaluate(async () => { await rcLoad(true); await tqLoad(true); await rcwsLoad(true); });
  };
  const open = async (k) => { await pg.evaluate((k) => rcwsOpen(k), k); for (let i = 0; i < 40; i++) { await settle(100); if (await pg.evaluate(() => RCWS_CUR && !RCWS_CUR.loading && !!RCWS_CUR.model)) break; } };
  const cur = () => pg.evaluate(() => { const C = RCWS_CUR, M = C.model, P = C.plan, tt = rcwsPlanTotals(P);
    return { wids: C.opt.wids, tests: M.tests.map((x) => x.wid), wrong: M.wrong.map((w) => w.pid), dup: M.dup, range: M.range.slice().sort((a, b) => a - b), book: M.bookWrong.filter((w) => !w.unit).map((w) => w.wpId), unit: M.bookWrong.filter((w) => w.unit).map((w) => w.wpId),
      unitInfo: M.unitInfo, testN: P.test.map((x) => x.n), tt, sum: (document.querySelector('[data-rcws-sum]') || {}).innerText || '', checks: [...document.querySelectorAll('[data-rcws-wid]')].map((x) => x.dataset.rcwsWid + (x.checked ? '+' : '-')) }; });

  await boot();
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품 함수 있음', await pg.evaluate(() => ['rcws3Opt', 'rcws3Gather', 'rcws3Merge', 'rcws3CidsFromChips', 'rcws3PickTest', 'rcws3Toggle', 'rcws3TwoToggle'].every((f) => typeof window[f] === 'function')));
  t('기본 규칙: twoTestGrades = 중학교 3학년 · unitDays 28', await pg.evaluate(() => rcwsRule().twoTestGrades.join() === '중학교 3학년' && rcwsRule().unitDays === 28));

  /* ① 기본 고르기 */
  const O = await pg.evaluate(() => { const rows = rcRows(); const g = (k) => rows.find((r) => r.stKey === k); return { s1: rcws3Opt(g('S1')), s3: rcws3Opt(g('S3')), s2: rcws3Opt(g('S2')), my: rcws3MyTests('M1').map((x) => x.wid + '@' + x.date), s2row: !!g('S2'), s2hit: g('S2') && g('S2').testHit, s2units: g('S2') && rcws3Units(g('S2')) }; });
  t('중3 기본 = 응시일 기준 최근 2개 (101 이번 주 · 100 지난 주 — 시험지 날짜와 반대)', O.s1.wids.join() === '101,100' && O.s1.two && !O.s1.custom, JSON.stringify(O.s1) + ' ' + O.my.join());
  t('중2 기본 = 보드가 고른 시험 1개 (201)', O.s3.wids.join() === '201' && !O.s3.two, JSON.stringify(O.s3));
  t('단원으로 불린 중1(시험 85점 · 기준 이상) = 기간 안 최근 시험 1개 · 보드 행 있음 · 단원 「입체도형의 성질」 교재 B7', O.s2row && !O.s2hit && O.s2.wids.join() === '201' && O.s2units.length === 1 && O.s2units[0].n === '입체도형의 성질' && O.s2units[0].bids.join() === 'B7', JSON.stringify(O.s2units));

  /* ② 두 시험 합치기 */
  await pg.evaluate(() => { VIEW = 'recovery'; render(); }); await settle(400);
  const btn = await pg.evaluate(() => { const rows = rcRows(); return ['S1', 'S2', 'S3'].map((k) => /rcwsOpen/.test(rcWsBtn(rows.find((r) => r.stKey === k)))); });
  t('학생 카드 단추: 중3·중2 · 단원 학생(기준 이상 점수)도 「🧩 학습지 설계」 열림', btn.every(Boolean), JSON.stringify(btn));
  await pg.evaluate(() => { T.w = []; });
  await open('S1');
  let c = await cur();
  t('합친 오답 4 (1001·1002·1003·1006) · 같은 문제 1001 은 한 번만', c.wrong.join() === '1001,1002,1003,1006' && c.dup === 1, JSON.stringify(c.wrong) + ' dup ' + c.dup);
  t('범위 유형 합침 (11~17) · 교재 오답 합침 (5001 · 5002, 범위 밖 5003 없음)', c.range.join() === '11,12,13,14,15,16,17' && c.book.slice().sort().join() === '5001,5002', JSON.stringify([c.range, c.book]));
  t('시험 체크 3칸(최근 순) · 101·100 체크', c.checks.join() === '101+,100+,99-', JSON.stringify(c.checks));
  t('구성 한 줄: 시험 오답 4개 (시험 2개 합침) · 쌍둥이 ×2 = 8 · 교과서 4 · 교재 오답 2 · 예상 문항 수', /시험 오답 4개 \(시험 2개 합침\)/.test(c.sum) && /쌍둥이 ×2 = 8/.test(c.sum) && /교과서 4/.test(c.sum) && /교재 오답 2/.test(c.sum) && new RegExp('예상 ' + c.tt.total + '문항').test(c.sum), c.sum);
  t('열기만 했을 때 서버에 쓴 것 없음', (await pg.evaluate(() => T.w.length)) === 0, JSON.stringify(await pg.evaluate(() => T.w)));
  await pg.screenshot({ path: SP + '/v19123_two.png' });
  // 이번 주 빼기 → 지난 주만
  await pg.evaluate(() => rcws3PickTest('101', false)); await settle(300);
  c = await cur();
  const per1 = await pg.evaluate(() => T.store.rc_ws_rule.per);
  t('「이번 주」 빼면 지난 주만: 오답 2 (1001·1006) · 교재 오답 5002 만', c.tests.join() === '100' && c.wrong.join() === '1001,1006' && c.book.join() === '5002' && /시험 1개/.test(c.sum), JSON.stringify(c));
  t('선택이 rc_ws_rule.per[S1] = {wk 이번 주, wids [100]} 로 저장', per1 && per1.S1 && per1.S1.wids.join() === '100' && per1.S1.wk === (await pg.evaluate(() => rcWeekKey())), JSON.stringify(per1));
  await pg.evaluate(() => rcws3PickTest('101', true)); await settle(200); await pg.evaluate(() => rcws3PickTest('100', false)); await settle(300);
  c = await cur();
  t('이번 주만: 오답 3 (1001·1002·1003)', c.tests.join() === '101' && c.wrong.join() === '1001,1002,1003', JSON.stringify(c.wrong));
  await pg.evaluate(() => rcPopClose()); await open('S1');
  c = await cur();
  t('다시 열어도 고른 시험(이번 주만) 그대로', c.wids.join() === '101' && c.checks.join() === '101+,100-,99-', JSON.stringify(c.checks));
  await pg.evaluate(() => rcws3PickTest('100', true)); await settle(300);
  c = await cur();
  t('둘 다 다시 고르면 최근 순 [101,100]', c.wids.join() === '101,100' && c.wrong.length === 4, JSON.stringify(c.wids));

  /* ③ 오답 1배수 · 교재 오답 빼기 */
  await pg.evaluate(() => rcws3Toggle('twin1')); await settle(200);
  c = await cur();
  t('오답 1배수: 시험 오답마다 쌍둥이 1 (4) · 구성 한 줄 ×1', c.testN.every((n) => n === 1) && c.tt.twin === 4 && /쌍둥이 ×1 = 4/.test(c.sum), JSON.stringify([c.testN, c.sum]));
  await pg.evaluate(() => rcws3Toggle('noBook')); await settle(200);
  c = await cur();
  const per2 = await pg.evaluate(() => T.store.rc_ws_rule.per.S1);
  t('교재 오답 빼기: 교재 오답 0 · 시험 오답만', c.book.length === 0 && c.tt.bookOnly === 0 && /교재 오답 0/.test(c.sum), JSON.stringify(c.book));
  t('학생별 선택 저장 {wids, twin1:true, noBook:true}', per2.twin1 === true && per2.noBook === true && per2.wids.join() === '101,100', JSON.stringify(per2));
  await pg.evaluate(() => rcws3Toggle('noBook')); await settle(200);
  c = await cur();
  t('교재 오답 다시 넣기 → 2', c.book.length === 2);

  /* ⑤ 만들기 → 보드 점수 갱신 */
  await pg.evaluate(() => { T.w = []; T.mf = []; });
  const total0 = c.tt.total;
  await pg.evaluate(() => rcwsMake()); for (let i = 0; i < 30; i++) { await settle(100); if (await pg.evaluate(() => !!RCWS_CUR.result || !!RCWS_CUR.err)) break; }
  const MK = await pg.evaluate(() => { const wk = rcWeekKey(); return { err: RCWS_CUR.err, res: RCWS_CUR.result && { n: RCWS_CUR.result.n, ws: RCWS_CUR.result.wsId }, snap: T.store.rc_state.calls[wk].S1.snap, ws: T.store.rc_state.calls[wk].S1.ws, made: T.store.rc_ws_made.byKey.S1,
    posts: T.mf.filter((x) => x.p === '/worksheet').map((x) => ({ n: x.body.problemList.length, assign: x.body.assignStudentIdList })), keys: T.w.map((x) => x.key) }; });
  t('매쓰플랫(가짜) POST /worksheet 한 번 · M1 배정 · 문항 수 = 예상 문항 수', MK.posts.length === 1 && MK.posts[0].assign.join() === 'M1' && MK.posts[0].n === total0 && MK.res && MK.res.n === total0, JSON.stringify(MK.posts) + ' ' + total0 + ' ' + MK.err);
  t('보드 점수 = 쓴 시험 중 가장 최근(101 · 60점 · 응시일) — snap.score·scoreDate·testTitle', MK.snap.score === 60 && MK.snap.scoreDate === day(-1) && MK.snap.testTitle === '중3 주간 B' && MK.snap.name === '○○○1', JSON.stringify(MK.snap));
  t('rc_state 에 ws 기록 · rc_ws_made 에 시험 2개 기록', MK.ws && MK.ws.wsId === MK.res.ws && MK.made && MK.made.tests.length === 2 && MK.made.wk === (await pg.evaluate(() => rcWeekKey())), JSON.stringify(MK.made));
  t('쓴 키: rc_ws_rule(규칙) · rc_ws_made · rc_state 만', MK.keys.every((k) => ['rc_ws_rule', 'rc_ws_made', 'rc_state'].indexOf(k) >= 0) && MK.keys.indexOf('rc_state') >= 0, MK.keys.join());
  const kept = await pg.evaluate(() => T.store.rc_ws_rule);
  t('「이 규칙을 기본으로」 저장해도 학생별 선택·2개 학년이 지워지지 않음', kept.per && kept.per.S1 && kept.per.S1.twin1 === true && kept.twoTestGrades.join() === '중학교 3학년', JSON.stringify(kept));
  await pg.evaluate(() => rcPopClose());

  /* ④ 단원 학생 */
  await pg.evaluate(() => { T.mf = []; });
  await open('S2');
  c = await cur();
  t('단원 오답: 「입체도형의 성질」 유형 3개(매쓰플랫 교재 단원표) → 최근 오답 2 (7001 · 7002 — 「STEP 1」 글자 기록도)', c.unitInfo.length === 1 && c.unitInfo[0].cids === 3 && /단원표/.test(c.unitInfo[0].how) && c.unit.slice().sort().join() === '7001,7002', JSON.stringify([c.unitInfo, c.unit]));
  t('다른 단원 오답(8002) · 기준 일수 밖(7004) 안 섞임 · 시험 범위 교재 오답 8001 은 교재 오답 칸', c.unit.indexOf(8002) < 0 && c.unit.indexOf(7004) < 0 && c.book.join() === '8001', JSON.stringify([c.unit, c.book]));
  t('시험 오답 1 (2001) + 단원 2 · 구성 한 줄 「단원 오답 2」', c.wrong.join() === '2001' && c.tt.unit === 2 && /단원 오답 2/.test(c.sum), c.sum);
  t('교재 칩은 GET /concept/chips?…workbookIds=B7 로 받음', (await pg.evaluate(() => T.mf.filter((x) => x.m === 'GET' && /workbookIds=B7/.test(x.p)).length)) === 1);
  await pg.screenshot({ path: SP + '/v19123_unit.png' });
  await pg.evaluate(() => rcws3Toggle('noBook')); await settle(200);
  c = await cur();
  t('교재 오답 빼기 → 범위 교재 오답만 빠지고 단원 오답은 남음', c.book.length === 0 && c.unit.length === 2, JSON.stringify([c.book, c.unit]));
  await pg.evaluate(() => rcws3Toggle('unit')); await settle(200);
  c = await cur();
  t('단원 오답 끄기 → 0', c.unit.length === 0 && c.tt.unit === 0);
  await pg.evaluate(() => { rcPopClose(); localStorage.removeItem('or_mf_id'); RCWS.cache = {}; rcws3SaveOpt('S2', null); }); await settle(100);
  await open('S2');
  c = await cur();
  t('매쓰플랫 계정이 없으면 유형DB 중단원(다면체와 회전체·입체도형의 겉넓이와 부피)으로 대신 → 같은 2문항', /중단원/.test(c.unitInfo[0].how) && c.unit.slice().sort().join() === '7001,7002', JSON.stringify(c.unitInfo));
  await pg.evaluate(() => { rcPopClose(); localStorage.setItem('or_mf_id', 'fake_id'); RCWS.cache = {}; });

  /* 순수 함수 */
  const PF = await pg.evaluate(() => ({ chips: rcws3CidsFromChips(T.CHIPS.B7, ' 입체도형의  성질 '), mids: rcws3CidsFromMids([{ concept_id: 1, chapter: '5 다면체와 회전체' }, { concept_id: 2, chapter: 'STEP 1' }, { concept_id: 3, chapter: 'x' }], ['다면체와 회전체'], (c) => (c === 3 ? '다면체와 회전체' : '')),
    merge: rcws3Merge([{ test: { wid: 1 }, wrong: [{ pid: 5, no: 1 }, { pid: null, no: 2 }], range: [1], bookWrong: [{ wpId: 9 }], solved: { a: 1 }, warn: ['w'] }, { test: { wid: 2 }, wrong: [{ pid: 5, no: 3 }, { pid: 6, no: 4 }, { pid: null, no: 5 }], range: [1, 2], bookWrong: [{ wpId: 9 }, { wpId: 10 }], solved: { b: 1 }, warn: ['w'] }]) }));
  t('rcws3CidsFromChips: 띄어쓰기 달라도 같은 단원 3개', PF.chips.join() === '71,72,73', PF.chips.join());
  t('rcws3CidsFromMids: chapter 글자(앞 번호 뗌) 또는 유형 중단원', PF.mids.join() === '1,3', PF.mids.join());
  t('rcws3Merge: 같은 pid 한 번만 · 번호 없는 문제는 모두 · 교재 오답·범위·solved 합침 · 경고 한 번', PF.merge.wrong.map((w) => w.pid + ':' + w.tn).join() === '5:1,null:1,6:2,null:2' && PF.merge.dup === 1 && PF.merge.range.join() === '1,2' && PF.merge.bookWrong.length === 2 && PF.merge.solved.a && PF.merge.solved.b && PF.merge.warn.length === 1, JSON.stringify(PF.merge.wrong));

  /* ⑥ 규칙 저장 */
  await pg.evaluate(() => { T.w = []; });
  await pg.evaluate(() => rcws3TwoToggle(false)); await settle(200);
  let RL = await pg.evaluate(() => ({ r: T.store.rc_ws_rule, keys: T.w.map((x) => x.key) }));
  t('「중3 2개 합치기」 끄기 → rc_ws_rule.twoTestGrades [] (학생별 선택은 그대로)', RL.r.twoTestGrades.length === 0 && RL.r.per && RL.r.per.S1 && RL.keys.join() === 'rc_ws_rule', JSON.stringify(RL));
  await pg.evaluate(() => { RCWS.rule = null; RCWS.loaded = false; return rcwsLoad(true); });
  const O2 = await pg.evaluate(() => { T.stu(); const rows = rcRows();  const s1 = rows.find((r) => r.stKey === 'S1'); rcws3SaveOpt('S1', null); return { opt: rcws3Opt(s1), two: rcwsRule().twoTestGrades }; }); await settle(150);
  t('서버에서 다시 읽어도 꺼진 채 · 중3 기본이 1개(보드 시험 101)로', O2.two.length === 0 && O2.opt.wids.join() === '101' && !O2.opt.two, JSON.stringify(O2));
  await pg.evaluate(() => rcws3TwoToggle(true)); await settle(150);
  if (await pg.evaluate(() => typeof l3rRule === 'function')) { await pg.evaluate(() => l3rRule('twinPer', 1)); await settle(150); }
  RL = await pg.evaluate(() => T.store.rc_ws_rule);
  t('다시 켜기 · 오른쪽 칸 다른 규칙(쌍둥이 1)을 바꿔도 twoTestGrades·unitDays 유지', RL.twoTestGrades.join() === '중학교 3학년' && RL.unitDays === 28 && (RL.twinPer === 1 || RL.twinPer === 2), JSON.stringify(RL));
  const O3 = await pg.evaluate(() => { T.stu(); const wk = rcWeekKey(); const r = rcwsRule(); r.per = { S1: { wk: '2000-01-01', wids: ['99'], twin1: true } }; RCWS.rule = r; const s1 = rcRows().find((x) => x.stKey === 'S1'); return rcws3Opt(s1); });
  t('지난 주에 고른 선택(wk 다름)은 쓰지 않음 → 기본 2개', O3.wids.join() === '101,100' && !O3.twin1, JSON.stringify(O3));

  /* 오른쪽 도구 칸 (≥1280) */
  await pg.evaluate(() => { T.stu(); VIEW = 'recovery'; render(); }); await settle(500);
  const TP = await pg.evaluate(() => ({ two: !!document.getElementById('l3r-two'), ud: !!document.getElementById('l3r-udays'), all: (document.getElementById('l3r-all') || {}).innerText || '' }));
  t('오른쪽 도구 칸: 「중3은 주간테스트 2개 합치기」 · 「단원 오답 최근 N일」 · 확정 전원 2명 (S1 은 이미 만듦 · 단원 학생 S2 도 셈)', TP.two && TP.ud && /\(2명\)/.test(TP.all), JSON.stringify(TP));

  /* 확정 전원 */
  await pg.evaluate(() => { T.stu(); T.w = []; T.mf = []; RCWS.made = {}; T.store.rc_ws_made = { byKey: {} }; RCWS.cache = {}; });
  await pg.evaluate(() => rcMakeWsAll()); await settle(1500);
  const ALL = await pg.evaluate(() => ({ made: Object.keys(T.store.rc_ws_made.byKey).sort(), posts: T.mf.filter((x) => x.p === '/worksheet').map((x) => x.body.assignStudentIdList.join()), s1: T.store.rc_ws_made.byKey.S1, snap3: T.store.rc_state.calls[rcWeekKey()].S3.snap, alert: T.toasts.filter((x) => /ALERT/.test(x)) }));
  t('「확정 전원 생성」 3명 (단원 학생 포함) · 중3 은 시험 2개', ALL.made.join() === 'S1,S2,S3' && ALL.posts.sort().join() === 'M1,M2,M3' && ALL.s1.tests.length === 2, JSON.stringify(ALL));
  t('확정 전원도 보드 점수 갱신 (중2 = 201 · 50점)', ALL.snap3.score === 50 && ALL.snap3.testTitle === '중1·2 주간', JSON.stringify(ALL.snap3));

  /* 부품 글자 */
  const src = fs.readFileSync(MOD, 'utf8');
  t('부품에 중첩 템플릿 리터럴 없음 · 조립 결과에 그대로', src.indexOf('`') < 0 && fs.readFileSync(FILE, 'utf8').indexOf(src.slice(0, 1500)) >= 0);
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
