#!/usr/bin/env node
/* 학원앱 v19-155 검사 — 🕘 리커버리 학습지 3판 (계약서 docs/recovery_recent_contract.md)
 *   가짜 서버(조건을 실제로 거르는 supabase 흉내 — mf_answer_records eq/in/gte/not is null/order/range) · 외부망 차단 · 매쓰플랫도 가짜
 *   이름은 가짜(홍길동·박하나·이순신) · 쓰기는 window.__W, 읽기 질의는 window.__Q 에 모은다
 *   홍길동(중2): 주간테스트 13 오답 3(유형 101·102·103) · 테스트 범위 밖 «아직 틀린» 교재 오답 c201×3 · c202 · 학습지 c204
 *               · c203 은 틀렸다가 다시 풀어 맞힘(빠져야 함) · 범위 안 교재 오답 c101(최근으로 한 번만) · 40·45일 전 c205·c206(하한 넓히기)
 *   이순신(중2): 테스트 오답 18 → 상한 40 우선순위 · 박하나(초6): 최근 오답 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19155.js lumen_v19-155.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-155.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => { if (process.env.DBG) console.log('DIALOG', d.message().slice(0, 120)); d.accept(); });
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.addInitScript(() => {
    window.__W = []; window.__Q = []; window.__STORE = {}; window.__TABLES = {};
    const mk = (tbl) => { const b = { fs: [], desc: [], op: 'select', ord: [], lim: null, rg: null, one: false,
      select() { return b; },
      eq(k, v) { b.fs.push((x) => String(x[k]) === String(v)); b.desc.push('eq:' + k); return b; },
      in(k, a) { const s = (a || []).map(String); b.fs.push((x) => s.indexOf(String(x[k])) >= 0); b.desc.push('in:' + k); return b; },
      gte(k, v) { b.fs.push((x) => x[k] != null && String(x[k]) >= String(v)); b.desc.push('gte:' + k); return b; },
      gt(k, v) { b.fs.push((x) => x[k] != null && String(x[k]) > String(v)); return b; },
      lte(k, v) { b.fs.push((x) => x[k] != null && String(x[k]) <= String(v)); return b; },
      lt(k, v) { b.fs.push((x) => x[k] != null && String(x[k]) < String(v)); return b; },
      neq(k, v) { b.fs.push((x) => String(x[k]) !== String(v)); return b; },
      not(k, op, v) { if (op === 'is') b.fs.push((x) => x[k] != null); return b; },
      is(k) { b.fs.push((x) => x[k] == null); return b; },
      like() { return b; }, ilike() { return b; }, or() { return b; }, filter() { return b; }, match() { return b; },
      order(k, o) { b.ord.push([k, !(o && o.ascending === false)]); return b; },
      limit(n) { b.lim = n; return b; }, range(a, z) { b.rg = [a, z]; return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; },
      update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; }, insert() { return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { window.__W.push({ tbl, key: r.key, value: JSON.parse(JSON.stringify(r.value === undefined ? null : r.value)) }); if (tbl === 'lumen_store' && r.key) window.__STORE[r.key] = JSON.parse(JSON.stringify(r.value)); }); return Promise.resolve({ error: null }); },
      then(r, j) { let data = [];
        if (b.op === 'select') {
          const all = tbl === 'lumen_store' ? Object.keys(window.__STORE).map((k) => ({ key: k, value: window.__STORE[k], updated_at: (window.__STORE[k] && window.__STORE[k].updated) || null })) : (window.__TABLES[tbl] || []);
          data = all.filter((x) => b.fs.every((fn) => fn(x)));
          if (b.ord.length) data = data.slice().sort((p, q) => { for (const [k, asc] of b.ord) { const a1 = p[k], b1 = q[k]; if (a1 === b1) continue; const c = (typeof a1 === 'number' && typeof b1 === 'number') ? a1 - b1 : String(a1).localeCompare(String(b1)); return asc ? c : -c; } return 0; });
          if (b.rg) data = data.slice(b.rg[0], b.rg[1] + 1); else if (b.lim != null) data = data.slice(0, b.lim);
          data = JSON.parse(JSON.stringify(data));
          if (tbl !== 'lumen_store') window.__Q.push({ tbl, desc: b.desc.join(','), n: data.length });
          if (b.one) data = data[0] || null;
        }
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    window.__FAKE = () => ({ from: mk, rpc: () => Promise.resolve({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, storage: { from: () => ({ upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } });
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);

  /* ── 가짜 자료 ── */
  const FX = await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
    const wk = rcWeekKey();
    const STU = [
      { id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' },
      { id: 'S2', name: '박하나', grade: '초등학교 6학년', group: 'M3', lumen_rec_code: 'BBB222' },
      { id: 'S3', name: '이순신', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'CCC333' },
      { id: 'S4', name: '신사임당', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'DDD444' },
      { id: 'S5', name: '장보고', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'EEE555' }];
    students.length = 0; STU.forEach((s) => students.push(JSON.parse(JSON.stringify(s))));
    window.__TABLES.mf_students = STU.map((s, i) => ({ mf_student_id: 'M' + (i + 1), name: s.name, lumen_rec_code: s.lumen_rec_code }));
    const R = []; let id = 1; const CIDOF = {};
    const rec = (o) => R.push(Object.assign({ id: id++, problem_seq: null, number: null, level: 3, book_id: null, page: null, workbook_problem_id: null, problem_id: null, worksheet_id: null, worksheet_title: '', student_worksheet_id: null, chapter: '' }, o));
    const test = (sid, wid, title, n, nWrong, base, d, cids, lv5) => { for (let k = 1; k <= n; k++) { const c = cids[(k - 1) % cids.length]; const wrong = k <= nWrong; const pid = (wrong ? base : base + 500) + k; CIDOF[pid] = c;
      rec({ mf_student_id: sid, source: '학습지', worksheet_id: wid, worksheet_title: title, problem_seq: k, number: k, problem_id: pid, concept_id: c, level: (lv5 && k === 1) ? 5 : 3, result: wrong ? 'X' : 'O', score_datetime: day(d), student_worksheet_id: 'sw' + sid }); } };
    const bk = (sid, wp, c, d, res, title) => rec({ mf_student_id: sid, source: '교재', book_id: 500, worksheet_title: title || '중등수학1(하)', page: 10 + (wp % 50), number: wp % 10 + 1, workbook_problem_id: wp, concept_id: c, result: res, score_datetime: day(d) });
    // 홍길동: 주간테스트 13 오답 1·2·3번(유형 101·102·103, 1번은 최상)
    test('M1', 13, '중2 주간 B', 20, 3, 9000, 3, [101, 102, 103, 104], true);
    bk('M1', 7001, 201, 2, 'X'); bk('M1', 7002, 201, 3, 'X'); bk('M1', 7003, 201, 5, 'X'); bk('M1', 7004, 202, 6, 'X');
    rec({ mf_student_id: 'M1', source: '학습지', worksheet_id: 300, worksheet_title: '중1-2 단원평가', number: 4, problem_id: 9100, concept_id: 204, result: 'X', score_datetime: day(4) }); CIDOF[9100] = 204;
    bk('M1', 7010, 208, 5, 'X'); bk('M1', 7010, 208, 1, 'O');                // 1주 안에 틀렸다가 다시 풀어 맞힘
    bk('M1', 7005, 203, 10, 'X'); bk('M1', 7005, 203, 2, 'O');                // 2주 안에 틀렸다가 맞힘
    bk('M1', 7008, 101, 10, 'X');                                            // 범위 안 교재 오답(1주 밖 · 2주 안)
    bk('M1', 7011, 209, 12, 'X');                                            // 2주 안
    bk('M1', 7006, 205, 40, 'X'); bk('M1', 7007, 206, 45, 'X');               // 56일 안 (하한 넓히기)
    bk('M1', 7009, 207, 70, 'X');                                            // 56일 밖
    // 이순신: 테스트 오답 18 + 범위 밖 c301 ×3
    test('M3', 13, '중2 주간 B', 20, 18, 9200, 3, [101, 102, 103, 104]);
    bk('M3', 7101, 301, 2, 'X'); bk('M3', 7102, 301, 3, 'X'); bk('M3', 7103, 301, 5, 'X');
    // 박하나: 초6 주간 오답 2
    test('M2', 12, '초6 주간', 10, 2, 9300, 4, [401, 402]);
    // 고등: 신사임당 [공통수학2] · 장보고 제목에 과목 없음
    test('M4', 15, '[공통수학2] 집합과 명제', 10, 2, 9400, 2, [501, 502]);
    test('M5', 16, '고1 일일테스트', 10, 3, 9500, 2, [601]);
    window.__TABLES.mf_answer_records = R;
    const bank = [7001, 7002, 7004, 7006, 7007, 7008, 7011, 7101, 7102].map((wp) => ({ id: wp, pimg: 'https://x/problem/' + (880000 + wp % 1000) + '/a.png' }));
    [[7001, 201], [7002, 201], [7004, 202], [7006, 205], [7007, 206], [7008, 101], [7011, 209], [7101, 301], [7102, 301]].forEach(([wp, c]) => { CIDOF[880000 + wp % 1000] = c; });
    window.__CIDOF = CIDOF;
    const names = { 101: { n: '일차식의 계산', m: '문자와 식' }, 102: { n: '식의 값', m: '문자와 식' }, 103: { n: '농도 문제', m: '일차방정식의 활용' }, 104: { n: '등식', m: '일차방정식' },
      201: { n: '다각형의 내각', m: '다각형' }, 202: { n: '부채꼴의 넓이', m: '원과 부채꼴' }, 203: { n: '대각선', m: '다각형' }, 204: { n: '속력 문제', m: '속력과 거리' },
      205: { n: '삼각형의 외각', m: '다각형' }, 206: { n: '호의 길이', m: '원과 부채꼴' }, 208: { n: '정다각형', m: '다각형' }, 209: { n: '중심각', m: '원과 부채꼴' },
      301: { n: '평행선', m: '기본 도형' }, 401: { n: '비율', m: '비와 비율' }, 402: { n: '백분율', m: '비와 비율' }, 501: { n: '집합', m: '집합' }, 502: { n: '명제', m: '명제' }, 601: { n: '다항식', m: '다항식' } };
    window.MF_TYPE_ACH = { names, periods: {} };
    const sn = (name, grade, score) => ({ name, group: '', grade, score, rx: [], holes: 0, rxN: 0, units: [] });
    const calls = {}; calls[wk] = { S1: { on: true, snap: sn('홍길동', '중학교 2학년', 60) }, S2: { on: true, snap: sn('박하나', '초등학교 6학년', 50) }, S3: { on: true, snap: sn('이순신', '중학교 2학년', 40) }, S4: { on: true, snap: sn('신사임당', '고등학교 1학년', 50) } };
    const W = (sid, score, d) => ({ sid, score, correct: Math.round(score / 5), total: 20, date: day(d).slice(0, 10), wrongConcepts: [] });
    Object.assign(window.__STORE, {
      or_studentdb: STU,
      rc_config: { minScore: 80, minUnit: 60, elem6Score: 75, weeks: 3, slots: ['10:00', '11:00'], range: null },
      rc_state: { calls, dates: {}, periods: {} },
      mf_weekly: { tests: [
        { wid: 12, key: 'w12', type: 'WEEKLY', title: '초6 주간', date: day(4).slice(0, 10), students: [W('M2', 50, 4)] },
        { wid: 13, key: 'w13', type: 'WEEKLY', title: '중2 주간 B', date: day(3).slice(0, 10), students: [W('M1', 60, 3), W('M3', 40, 3)] },
        { wid: 15, key: 'w15', type: 'HIGH_TEST', title: '[공통수학2] 집합과 명제', date: day(2).slice(0, 10), students: [W('M4', 50, 2)] },
        { wid: 16, key: 'w16', type: 'HIGH_TEST', title: '고1 일일테스트', date: day(2).slice(0, 10), students: [W('M5', 40, 2)] }] },
      mf_textbook_500: { title: '중등수학1(하)', problems: bank },
      mf_concept_names: names });
    window.getSupaClient = window.__FAKE;
    /* 앱이 처음 켜질 때 진짜 서버 부품으로 보낸 진도 읽기(외부망 차단으로 실패)가 늦게 끝나며 BP.mfList 를 [] 로 덮는 일이 있어 가짜 명단으로 고정한다 */
    Object.defineProperty(BP, 'mfList', { configurable: true, get() { return window.__TABLES.mf_students; }, set() {} });
    RC.loaded = false; RC.view = 'board'; BP.loaded = false; WK.loaded = false;
    try { NBK.loaded = false; NBK.data = null; } catch (e) {}
    /* 예전에 저장된 규칙(v155 표시 없음) — 새 기본 구성으로 한 번 바꿔 읽혀야 한다 */
    RCWS.made = {}; RCWS.rule = { twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, theory: false, days: 28, auto: true, twoTestGrades: ['중학교 3학년'], unitDays: 28, per: {} }; RCWS.loaded = true; RCWS.cache = {};
    window.__W.length = 0;
    VIEW = 'recovery'; render();
    return { wk };
  });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(300);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-155');

  /* ── 규칙 기본값 (원장 10/23 밤 최종) ── */
  const RU = await pg.evaluate(() => rcwsRule());
  t('규칙 ① 예전 저장분 → 새 기본 구성(쌍둥이 1 · 교과서 0 · 교재 0 · 보강 끔 · 자동 단원 끔)', RU.twinPer === 1 && RU.tbPer === 0 && RU.bookTwin === 0 && RU.boost === false && RU.unitAuto === false, JSON.stringify(RU));
  t('규칙 ② 최근 1주 · 유형마다 1개 · 최상 빼기 · 상한/하한 없음 · 중3 2개 합산 끔', RU.recent.on === true && RU.recent.days === 7 && RU.perType === true && RU.hardest === false && RU.max === 0 && RU.min === 0 && RU.twoTestGrades.length === 0, JSON.stringify(RU));
  t('규칙 ③ 예전 칸(자동채점·기간·학생별)은 그대로', RU.auto === true && RU.days === 28 && RU.v155 === 1 && typeof RU.per === 'object');

  /* ── 보드 한 줄 ── */
  const line = (k) => pg.evaluate((k) => { const el = document.querySelector('[data-rw155-line="' + k + '"]'); return el ? { txt: el.innerText.replace(/\s+/g, ' '), out: el.getAttribute('data-rw155-out'), st: el.getAttribute('style') } : null; }, k);
  let L1 = await line('S1');
  t('보드 ① 홍길동 «🕘 최근 1주 아직 틀린 3유형 (5문항) · 테스트 범위 밖 3»', !!L1 && /🕘 최근 1주 아직 틀린 3유형 \(5문항\) · 테스트 범위 밖 3/.test(L1.txt), L1 && L1.txt);
  t('보드 ② 범위 밖 단원 «(중1-2 다각형 1 · 속력과 거리 1 · 원과 부채꼴 1)» · 주황', !!L1 && /\(중1-2 다각형 1 · 속력과 거리 1 · 원과 부채꼴 1\)/.test(L1.txt) && L1.out === '3' && /#fff7ed/.test(L1.st), L1 && L1.txt);
  t('보드 ③ 다시 풀어 맞힌 문제·1주 밖은 빠짐', !!L1 && !/정다각형|중심각/.test(L1.txt));
  const L2 = await line('S2');
  t('보드 ④ 최근 오답 없는 학생 «아직 틀린 문제 없음»(회색)', !!L2 && /아직 틀린 문제 없음/.test(L2.txt) && !/#fff7ed/.test(L2.st), L2 && L2.txt);
  let Q = await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records'));
  t('보드 ⑤ 기록은 후보 학생 전부를 in.(sid,…) 한 번에 (학생마다 따로 읽지 않음)', Q.filter((q) => /in:mf_student_id/.test(q.desc)).length === 1 && Q.filter((q) => /eq:mf_student_id/.test(q.desc)).length === 0, JSON.stringify(Q));
  t('보드 ⑥ 보드 줄은 학습지 단추 줄 바로 위 · 표시용 주석 없음', await pg.evaluate(() => { const el = document.querySelector('[data-rw155-line="S1"]'); const n = el && el.nextElementSibling; return !!(n && /학습지 설계|다시 설계/.test(n.innerText)) && document.getElementById('CONTENT').innerHTML.indexOf('rw155#') < 0; }));

  /* ── 학생별 예상 표 ── */
  const est = (k) => pg.evaluate((k) => { const r = document.querySelector('[data-rw155-est="' + k + '"]'); if (!r) return null; const g = (a) => ((r.querySelector('[' + a + ']') || {}).innerText || '').replace(/\s+/g, ' ');
    return { twin: g('data-rw155-twin'), types: g('data-rw155-types'), total: g('data-rw155-total'), hard: g('data-rw155-hard'), mids: g('data-rw155-mids'), txt: r.innerText.replace(/\s+/g, ' ') }; }, k);
  let E1 = await est('S1');
  t('예상 ① 가운데 «🔢 학생별 예상» 표 (확정 4명)', await pg.evaluate(() => { const e = document.getElementById('rw155-est'); return !!e && /학생별 예상 · 이번 주 확정 4명/.test(e.innerText) && /최근 1주 · 유형마다 1개 · 최상 빼기/.test(e.innerText); }));
  t('예상 ② 홍길동: 테스트 쌍둥이 3 + 최근 오답 3유형 = 6 «적음»', !!E1 && /^3/.test(E1.twin) && /^3유형/.test(E1.types) && /^6/.test(E1.total) && /적음/.test(E1.total), JSON.stringify(E1));
  t('예상 ③ 최상 «0 (켜면 +1)»', !!E1 && /^0 \(켜면 \+1\)/.test(E1.hard), E1 && E1.hard);
  t('예상 ④ 단원 비율 «테스트(…) 50% · 다각형 …»', !!E1 && /테스트\([^)]+\) 50%/.test(E1.mids) && /다각형 17%/.test(E1.mids), E1 && E1.mids);
  const q1 = await pg.evaluate(() => window.__Q.length);
  await pg.evaluate(() => { window.__W.length = 0; rw155Rule('days', 14); }); await pg.waitForTimeout(400);
  E1 = await est('S1');
  t('예상 ⑤ 규칙을 2주로 → 바로 다시 셈 (홍길동 8 = 3 + 5유형) · 다시 읽지 않음', !!E1 && /^8/.test(E1.total) && /^5유형/.test(E1.types) && (await pg.evaluate(() => window.__Q.length)) === q1, JSON.stringify(E1));
  let RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('예상 ⑥ 규칙 저장 recent{on,days:14} · v155 표시', RW && RW.recent && RW.recent.days === 14 && RW.v155 === 1, JSON.stringify(RW && RW.recent));
  await pg.evaluate(() => rw155Rule('days', 7)); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const b = document.querySelector('[data-rw155-est="S3"] [data-rw155-days="14"]'); b.click(); }); await pg.waitForTimeout(400);
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  const E3 = await est('S3');
  t('예상 ⑦ 표에서 학생별 2주 칩 → per.S3.recentDays=14 (그 주) · «학생별»', RW.per && RW.per.S3 && RW.per.S3.recentDays === 14 && RW.per.S3.wk === FX.wk && !RW.per.S3.wids && /학생별/.test(E3.txt), JSON.stringify(RW.per));
  t('예상 ⑧ 이순신 18 + 1유형 = 19', /^19/.test(E3.total), JSON.stringify(E3));
  const E4 = await est('S4');
  t('예상 ⑨ 고등(신사임당) 같은 규칙 · 과목 공통수학2', !!E4 && /공통수학2/.test(E4.txt) && /^2/.test(E4.twin), JSON.stringify(E4));
  t('예상 ⑩ 만들기 단추 «(n명 · 예상 N문항)»', /예상 \d+문항\)/.test(await pg.evaluate(() => l3rMakeBox())));

  /* ── 재료·계획 ── */
  const plan = (k, rulePatch) => pg.evaluate(async ([k, rp]) => {
    const row = rcRows().find((r) => r.stKey === k); const opt = rcws3Opt(row); const raw = await rcws3Gather(row, opt); const m = rcws3View(raw, opt);
    const p = rcwsPlan(m, Object.assign(rcwsRule(), rp || {}), opt); const tt = rcwsPlanTotals(p);
    return { t: tt, I: { exN: p.r155.exN, grp: p.r155.grp, wide: p.r155.wide, fill: p.r155.fill, cut: p.r155.cut, cutN: p.r155.cutN, max: p.r155.R.max, autoMax: p.r155.R.autoMax }, hardest: p.rule.hardest,
      rec: p.book.filter((x) => x.w.recent || x.wide).map((x) => ({ wp: x.w.wpId, pid: x.w.pid, cid: x.w.cid, n: x.n, wide: !!x.wide, grp: !!x.grp, rbase: x.w.rbase || '', out: !!x.w.out })),
      test: p.test.map((x) => ({ no: x.w.no, cid: x.w.cid, n: x.n, ex: !!x.ex })), boost: p.boost.map((b) => ({ cid: b.cid, n: b.n, fill: !!b.fill })), info: m.recentInfo };
  }, [k, rulePatch]);
  let P1 = await plan('S1');
  t('재료 ① 1주 «아직 틀린 문제» 7001·7002·7003·7004·학습지 9100 (테스트 문제·맞힌 문제 빼고)', P1.rec.map((r) => r.wp || ('p' + r.pid)).sort().join(',') === '7001,7002,7003,7004,p9100', JSON.stringify(P1.rec));
  t('재료 ② 교재 은행으로 문제은행 번호 (7001→880001) · 은행에 없는 7003 은 번호 없음', P1.rec.find((r) => r.wp === 7001).pid === 880001 && !P1.rec.find((r) => r.wp === 7003).pid);
  t('재료 ③ 개수·유형·범위 밖·다시 풀어 맞힌 수', P1.info && P1.info.n === 5 && P1.info.types === 3 && P1.info.out === 5 && P1.info.fixed === 1, JSON.stringify(P1.info));
  t('계획 ① 유형마다 1개 = 가장 최근 (c201 은 7001 만)', P1.rec.filter((r) => r.cid === 201 && r.n > 0).map((r) => r.wp).join(',') === '7001' && P1.I.grp === 2, JSON.stringify(P1.rec));
  t('계획 ② 기본 구성 = 쌍둥이 3 + 최근 3 = 6 (교과서·보강·교재 0)', P1.t.total === 6 && P1.t.twin === 3 && P1.t.recent === 3 && P1.t.tb === 0 && P1.t.boost === 0 && P1.t.bookOnly === 0, JSON.stringify(P1.t));
  t('계획 ③ 1주면 상한 없음 · 최상 빼기(plan.rule.hardest=false)', P1.I.max === 0 && P1.hardest === false, JSON.stringify(P1.I));
  await pg.evaluate(() => rw155Rule('days', 14));
  const P1b = await plan('S1');
  await pg.evaluate(() => rw155Rule('days', 7));
  t('계획 ④ 2주 — 범위 안 교재 오답 7008 도 «최근»(한 줄) · 7011 더함 · 8문항 · 상한 40 자동', P1b.t.total === 8 && P1b.rec.filter((r) => r.wp === 7008).length === 1 && P1b.rec.find((r) => r.wp === 7008).rbase === 'book' && P1b.rec.some((r) => r.wp === 7011) && P1b.I.max === 40 && P1b.I.autoMax, JSON.stringify(P1b.I) + JSON.stringify(P1b.t));
  const P1m = await plan('S1', { min: 10 });
  t('하한 ① 최근 오답 기간을 56일로 넓혀 7011·7006·7007 → 그래도 모자라 같은 유형 1 → 10', P1m.I.wide === 3 && P1m.I.fill === 1 && P1m.t.total === 10 && P1m.rec.filter((r) => r.wide).map((r) => r.wp).sort().join(',') === '7006,7007,7011', JSON.stringify(P1m.I) + JSON.stringify(P1m.rec));
  t('하한 ② 채우기는 테스트·최근 오답 유형', P1m.boost.filter((b) => b.fill).every((b) => [101, 102, 103, 201, 202, 204, 205, 206, 209].indexOf(b.cid) >= 0), JSON.stringify(P1m.boost));
  const OLD = { twinPer: 2, tbPer: 1, boost: true };
  const P3 = await plan('S3', Object.assign({ max: 40 }, OLD));
  t('상한 ① 이순신(예전 구성: 쌍둥이 2·교과서 1·보강) 60 → 40', P3.t.total === 40, JSON.stringify(P3.t));
  t('상한 ② 쌍둥이 첫째 18 · 최근 1 · 교과서 18 · 쌍둥이 둘째 3 · 보강 0', P3.test.filter((x) => x.n >= 1).length === 18 && P3.t.recent === 1 && P3.t.tb === 18 && P3.t.twin === 21 && P3.t.boost === 0, JSON.stringify(P3.t));
  t('상한 ③ 쌍둥이 둘째는 앞 문항부터 · 뺀 것 기록(쌍둥이 둘째 15 · 보강 5)', P3.test[0].n === 2 && P3.test[2].n === 2 && P3.test[3].n === 1 && P3.I.cutN === 20 && P3.I.cut.twin2 === 15 && P3.I.cut.boost === 5, JSON.stringify(P3.I));
  const P3w = await plan('S3', OLD);
  t('상한 ④ 이순신은 학생별 2주 → 상한 40 자동', P3w.t.total === 40 && P3w.I.autoMax, JSON.stringify(P3w.I));
  await pg.evaluate(() => rw155EstDays('S3', 7)); await pg.waitForTimeout(200);
  const P3n = await plan('S3', OLD);
  t('상한 ⑤ 1주로 돌리면 상한 없음 → 60', P3n.t.total === 60 && !P3n.I.max, JSON.stringify(P3n.I));
  const PX = await plan('S1', { exclude: '농도' });
  t('빼는 유형 ① «농도» → 테스트 3번(c103) 0 · 5문항', PX.test.find((x) => x.cid === 103).n === 0 && PX.test.find((x) => x.cid === 103).ex && PX.t.total === 5, JSON.stringify(PX.test));

  /* ── 오른쪽 «학습지 규칙» 칸 ── */
  const box = await pg.evaluate(() => l3rRuleBox());
  t('규칙 칸 ① 아직 틀린 문제 [1주][2주][4주] · 유형마다 1개 · 최상 포함 · 자동 단원 오답 · 문항 없음~없음 · 빼는 유형', /아직 틀린 문제/.test(box) && /data-rw155-days="7"[^>]*background:#c2410c/.test(box) && /유형마다 1개/.test(box) && /최상\(5단계\) 난이도 포함/.test(box) && /id="l3r-hardest" onchange/.test(box) && /가운데 «🔢 학생별 예상»이 바로 다시 계산/.test(box) && /자동 단원 오답/.test(box) && /id="l3r-min"[^>]*value=""[^>]*placeholder="없음"/.test(box) && /id="l3r-excl"/.test(box), box.slice(0, 200));
  await pg.evaluate(() => { window.__W.length = 0; rw155Rule('hardest', true); rw155Rule('min', 25); rw155Rule('max', 35); rw155Rule('exclude', '농도'); rw155Rule('unitAuto', true); });
  await pg.waitForTimeout(200);
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('규칙 칸 ② 저장 (hardest · min 25 · max 35 · exclude · unitAuto)', RW && RW.hardest === true && RW.min === 25 && RW.max === 35 && RW.exclude === '농도' && RW.unitAuto === true, JSON.stringify(RW));
  await pg.evaluate(() => { rw155Rule('exclude', '(농도'); }); await pg.waitForTimeout(100);
  t('규칙 칸 ③ 잘못된 정규식은 저장 안 함', (await pg.evaluate(() => rcwsRule().exclude)) === '농도');
  await pg.evaluate(() => { rw155Rule('hardest', false); rw155Rule('min', ''); rw155Rule('max', ''); rw155Rule('exclude', ''); rw155Rule('unitAuto', false); render(); }); await pg.waitForTimeout(300);
  t('규칙 칸 ④ 비우면 «없음»(0)', await pg.evaluate(() => rcwsRule().min === 0 && rcwsRule().max === 0));

  /* ── 설계 팝업 ── */
  const pop = () => pg.evaluate(() => { const p = document.getElementById('rc-pop'); if (!p) return null; const tot = {}; p.querySelectorAll('[data-rcws-tot]').forEach((e) => { tot[e.getAttribute('data-rcws-tot')] = Number(e.innerText); });
    const rb = p.querySelector('[data-rw155-recent]'); return { txt: p.innerText.replace(/\s+/g, ' '), tot, recent: rb ? rb.innerText.replace(/\s+/g, ' ') : '', gone: (p.querySelector('[data-rw155-gone]') || {}).innerText || '', src: (p.querySelector('[data-rw155-src]') || {}).innerText || '', make: (document.getElementById('rcws-make') || {}).innerText || '' }; });
  await pg.evaluate(() => rcwsOpen('S1')); await pg.waitForTimeout(800);
  let PP = await pop();
  t('팝업 ① «🕘 최근 오답 5문항 (3유형) → 쌍둥이 3»', !!PP && /🕘 최근 오답 5문항 \(3유형\) → 쌍둥이 3/.test(PP.recent), PP && PP.recent.slice(0, 200));
  t('팝업 ② «🚫 뺀 것 다시 풀어 맞힌 문제 1 · 같은 유형의 더 오래된 오답 2» · 교재별 줄', /다시 풀어 맞힌 문제 1/.test(PP.gone) && /더 오래된 오답 2/.test(PP.gone) && /중등수학1\(하\) 4/.test(PP.src), PP.gone + ' / ' + PP.src);
  t('팝업 ③ 합계 «최근 오답 3» · 총 6 · 단추 6문항 · 구성 줄', PP.tot['최근 오답'] === 3 && PP.tot['총 문항'] === 6 && /6문항/.test(PP.make) && /최근 오답 3 · 교재 오답 0/.test(PP.txt) && /최상 뺌/.test(PP.txt), JSON.stringify(PP.tot) + ' ' + PP.make);
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('#rc-pop [data-rw155-days="14"]'); await pg.waitForTimeout(600);
  PP = await pop();
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ④ 이 학생만 2주 → per.S1.recentDays=14 · 8문항 · «상한 40 자동» 안내', RW.per.S1 && RW.per.S1.recentDays === 14 && PP.tot['총 문항'] === 8 && /상한 40 자동/.test(PP.txt), JSON.stringify(RW.per.S1) + JSON.stringify(PP.tot));
  await pg.click('#rc-pop [data-rw155-hard]'); await pg.waitForTimeout(400);
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ⑤ 이 학생만 최상 포함 → per.S1.hardest=true', RW.per.S1.hardest === true && RW.per.S1.recentDays === 14, JSON.stringify(RW.per.S1));
  await pg.click('[data-rcws-tg="recent"]'); await pg.waitForTimeout(500);
  PP = await pop();
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ⑥ 이 학생만 최근 오답 끄기 → recent:false · 쌍둥이 3만', RW.per.S1.recent === false && PP.tot['최근 오답'] === 0 && PP.tot['총 문항'] === 3, JSON.stringify(PP.tot));
  await pg.fill('#rw155-max', '2'); await pg.dispatchEvent('#rw155-max', 'change'); await pg.waitForTimeout(400);
  PP = await pop();
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ⑦ 이 학생 상한 2 → 저장 · 총 2', RW.per.S1.max === 2 && PP.tot['총 문항'] === 2, JSON.stringify(RW.per.S1) + JSON.stringify(PP.tot));
  await pg.evaluate(() => rcws3ResetOpt()); await pg.waitForTimeout(600);
  PP = await pop();
  t('팝업 ⑧ ↺ 기본으로 → 1주 · 6문항', PP.tot['총 문항'] === 6 && PP.tot['최근 오답'] === 3, JSON.stringify(PP.tot));
  t('팝업 ⑨ 자동 단원 오답 꺼짐 → 매쓰플랫 유형칩 호출 없음', await pg.evaluate(() => !Object.keys(RCWS.cache).some((k) => /^chips_/.test(k))));

  /* ── 만들기 (가짜 매쓰플랫) — 최상 빼기 · 빼는 유형 걸러짐 ── */
  await pg.evaluate(() => { rcPopClose(); rw155Rule('exclude', '농도'); });
  await pg.evaluate(() => {
    const CID = window.__CIDOF, LV = {}; window.__LV = LV; window.__MF = { calls: [], made: null, filters: {} }; let fn = 0;
    const prob = (id, c, lv) => { CID[id] = c; LV[id] = lv; return { id, level: lv, conceptId: c, type: 'SHORT', answer: '1' }; };
    rcwsApi.call = (m, p, b) => { window.__MF.calls.push(m + ' ' + p);
      if (p === '/worksheet/filter/concept') { fn++; window.__MF.filters['F' + fn] = (b.conceptIdList || []).slice(); return Promise.resolve({ filterId: 'F' + fn }); }
      if (/^\/derivation\/problem\//.test(p)) { const pid = Number(p.split('/').pop()); const c = CID[pid] || 999;
        const pair = [prob(pid * 10 + 1, 103, 3), prob(pid * 10 + 2, c, 5), prob(pid * 10 + 3, c, 4), prob(pid * 10 + 4, c, 3)];
        return Promise.resolve({ pairProblemList: pair.map((x) => ({ problem: x })), similarProblemList: [] }); }
      if (p === '/worksheet/problem') { const cl = window.__MF.filters[b.filterId] || []; const out = []; cl.forEach((c) => { for (let k = 1; k <= 10; k++) out.push({ problem: prob(c * 1000 + k, c, k <= 2 ? 5 : 3) }); }); return Promise.resolve(out); }
      if (p === '/worksheet') { window.__MF.made = b; return Promise.resolve({ id: 5555 }); }
      return Promise.resolve({}); };
  });
  await pg.evaluate(() => rcwsOpen('S1')); await pg.waitForTimeout(800);
  PP = await pop();
  if (!PP) console.log('POP 없음', errs, await pg.evaluate(() => { try { const rs = rcRows(); return JSON.stringify(rs.map((r) => [r.stKey, !!r.testHit, rcws3Can(r)])) + ' ' + VIEW + ' wk' + (WK.tests || []).length + ' bp' + (BP.mfList || []).length; } catch (e) { return 'ERR ' + e.message + e.stack; } }));
  t('만들기 ① 빼는 유형 켠 팝업 — «빼는 유형 «농도» 1문항 뺌» · 5문항', /빼는 유형 «농도» 1문항 뺌/.test(PP.txt) && PP.tot['총 문항'] === 5, PP.txt.slice(0, 300));
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('#rcws-make'); await pg.waitForTimeout(1500);
  const MD = await pg.evaluate(() => ({ made: window.__MF.made, cid: window.__CIDOF, lv: window.__LV, w: window.__W.filter((x) => x.key === 'rc_ws_made').map((x) => x.value).pop() }));
  const ids = MD.made ? MD.made.problemList.map((x) => x.id) : [];
  t('만들기 ② 매쓰플랫에 5문항 학습지', ids.length === 5, ids.length);
  t('만들기 ③ 빼는 유형(농도 c103) 문제 없음', ids.length > 0 && ids.every((id) => MD.cid[id] !== 103));
  t('만들기 ④ 최상 빼기 — 최상(5) 문제 없음 · 최상이던 1번은 상(4)으로', ids.every((id) => MD.lv[id] !== 5) && ids.indexOf(90013) >= 0, JSON.stringify(ids.map((id) => [id, MD.lv[id]])));
  t('만들기 ⑤ rc_ws_made 기록에 최근 오답 수(parts.recent=3)', MD.w && MD.w.byKey && MD.w.byKey.S1 && MD.w.byKey.S1.parts.recent === 3, JSON.stringify(MD.w && MD.w.byKey && MD.w.byKey.S1 && MD.w.byKey.S1.parts));
  t('만들기 ⑥ 최상 포함이면 고른다 (rcwsPickFrom 감싸기)', await pg.evaluate(() => { const L = [{ id: 1, lv: 5 }, { id: 2, lv: 4 }]; return rcwsPickFrom(L, 5, 1, {}, {}, { hardest: false, auto: false })[0] === 2 && rcwsPickFrom(L, 5, 1, {}, {}, { hardest: true, auto: false })[0] === 1; }));
  await pg.evaluate(() => { rcPopClose(); rw155Rule('exclude', ''); render(); }); await pg.waitForTimeout(300);
  t('만들기 ⑦ 카드 ✅ 칸에 «최근 오답 3»', await pg.evaluate(() => /최근 오답 3 · 보강/.test(document.getElementById('CONTENT').innerText)));

  /* ── 고등부 ── */
  t('고등 ① 신사임당 — 최근 HIGH_TEST 제목 [공통수학2] 에서 과목 자동', await pg.evaluate(() => { const s = rcWsSchool(students.find((x) => x.id === 'S4')); return !!s && s.schoolType === 'HIGH' && s.grade === '공통수학2'; }));
  t('고등 ② 장보고 — 제목에 과목 없음 → «과목 고르기» 칸', await pg.evaluate(() => !rcWsSchool(students.find((x) => x.id === 'S5')) && /고등 과목을 골라 주세요/.test((document.querySelector('[data-rw155-subj="S5"]') || {}).innerText || '')));
  await pg.evaluate(() => { window.__W.length = 0; rw155SetSubject('S5', '대수'); }); await pg.waitForTimeout(300);
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('고등 ③ 과목 고르면 per.S5.subject 저장 → 학습지 설계 가능', RW.per.S5 && RW.per.S5.subject === '대수' && (await pg.evaluate(() => { const s = rcWsSchool(students.find((x) => x.id === 'S5')); return !!s && s.grade === '대수' && rcws3Can(rcRows().find((r) => r.stKey === 'S5')); })), JSON.stringify(RW.per));
  await pg.evaluate(() => rw155EstDays('S1', 14)); await pg.waitForTimeout(300);
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('고등 ④ 다른 학생 선택을 저장해도 과목은 남음', RW.per.S5 && RW.per.S5.subject === '대수' && RW.per.S1.recentDays === 14, JSON.stringify(RW.per));
  t('고등 ⑤ 과목 표기 정리 (미적분Ⅰ→미적분1 · 확률과통계)', await pg.evaluate(() => rw155SubjNorm('미적분Ⅰ') === '미적분1' && rw155SubjNorm('확률과 통계') === '확률과 통계' && rw155TitleSubj('[공통수학 1] 다항식') === '공통수학1' && rw155SubjNorm('수학') === ''));
  const S5plan = await plan('S5');
  t('고등 ⑥ 고등도 같은 규칙 (쌍둥이 3)', S5plan.t.twin === 3, JSON.stringify(S5plan.t));

  /* ── ↻ 다시 읽기 → 다시 읽음 ── */
  const q0 = await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records' && /in:mf_student_id/.test(q.desc)).length);
  await pg.evaluate(() => rc154Reload(true)); await pg.waitForTimeout(1200);
  t('다시 읽기 → 보드·예상 기록도 다시 읽음', (await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records' && /in:mf_student_id/.test(q.desc)).length)) === q0 + 1);
  t('등록부(or_studentdb)에 쓰지 않음', await pg.evaluate(() => window.__W.filter((x) => x.key === 'or_studentdb').length === 0));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
