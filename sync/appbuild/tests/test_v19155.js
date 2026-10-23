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
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
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
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const wk = rcWeekKey();
    const STU = [
      { id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' },
      { id: 'S2', name: '박하나', grade: '초등학교 6학년', group: 'M3', lumen_rec_code: 'BBB222' },
      { id: 'S3', name: '이순신', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'CCC333' }];
    students.length = 0; STU.forEach((s) => students.push(JSON.parse(JSON.stringify(s))));
    window.__TABLES.mf_students = STU.map((s, i) => ({ mf_student_id: 'M' + (i + 1), name: s.name, lumen_rec_code: s.lumen_rec_code }));
    /* 문항 기록 */
    const R = []; let id = 1;
    const rec = (o) => R.push(Object.assign({ id: id++, problem_seq: null, number: null, level: 3, book_id: null, page: null, workbook_problem_id: null, problem_id: null, worksheet_id: null, worksheet_title: '', student_worksheet_id: null, chapter: '' }, o));
    const CIDOF = {};
    // 홍길동 주간테스트 13 (20문항, 유형 101~104) — 오답 1·2·3번
    for (let k = 1; k <= 20; k++) { const c = 100 + ((k - 1) % 4) + 1; const wrong = k <= 3; const pid = wrong ? 9000 + k : 8000 + k; CIDOF[pid] = c;
      rec({ mf_student_id: 'M1', source: '학습지', worksheet_id: 13, worksheet_title: '중2 주간 B', problem_seq: k, number: k, problem_id: pid, concept_id: c, result: wrong ? 'X' : 'O', score_datetime: day(3), student_worksheet_id: 'sw1' }); }
    const bk = (sid, wp, c, d, res, title) => rec({ mf_student_id: sid, source: '교재', book_id: 500, worksheet_title: title || '중등수학1(하)', page: 10 + (wp % 50), number: wp % 10 + 1, workbook_problem_id: wp, concept_id: c, result: res, score_datetime: day(d) });
    bk('M1', 7001, 201, 5, 'X'); bk('M1', 7002, 201, 6, 'X'); bk('M1', 7003, 201, 7, 'X'); bk('M1', 7004, 202, 8, 'X');
    bk('M1', 7005, 203, 10, 'X'); bk('M1', 7005, 203, 2, 'O');            // 다시 풀어 맞힘 → 빠져야 함
    bk('M1', 7008, 101, 9, 'X');                                             // 범위 안 교재 오답 (최근으로 한 번만)
    bk('M1', 7006, 205, 40, 'X'); bk('M1', 7007, 206, 45, 'X');               // 28일 밖 · 56일 안 → 하한 넓히기
    bk('M1', 7009, 207, 70, 'X');                                            // 56일 밖 → 안 읽힘
    rec({ mf_student_id: 'M1', source: '학습지', worksheet_id: 300, worksheet_title: '중1-2 단원평가', number: 4, problem_id: 9100, concept_id: 204, result: 'X', score_datetime: day(4) }); CIDOF[9100] = 204;
    // 이순신 주간테스트 13 — 20문항 중 18개 틀림 + 범위 밖 교재 오답 c301 ×3
    for (let k = 1; k <= 20; k++) { const c = 100 + ((k - 1) % 4) + 1; const wrong = k <= 18; const pid = wrong ? 9200 + k : 8200 + k; CIDOF[pid] = c;
      rec({ mf_student_id: 'M3', source: '학습지', worksheet_id: 13, worksheet_title: '중2 주간 B', problem_seq: k, number: k, problem_id: pid, concept_id: c, result: wrong ? 'X' : 'O', score_datetime: day(3), student_worksheet_id: 'sw3' }); }
    bk('M3', 7101, 301, 5, 'X'); bk('M3', 7102, 301, 6, 'X'); bk('M3', 7103, 301, 7, 'X');
    // 박하나 초6 주간 — 오답 2, 최근 교재 오답 없음
    for (let k = 1; k <= 10; k++) { const c = 401 + (k % 2); const pid = 9300 + k; CIDOF[pid] = c;
      rec({ mf_student_id: 'M2', source: '학습지', worksheet_id: 12, worksheet_title: '초6 주간', problem_seq: k, number: k, problem_id: pid, concept_id: c, result: k <= 2 ? 'X' : 'O', score_datetime: day(4), student_worksheet_id: 'sw2' }); }
    window.__TABLES.mf_answer_records = R;
    /* 교재 은행 (7003 은 없음 → 번호 못 찾음) */
    const bank = [7001, 7002, 7004, 7006, 7007, 7008, 7101, 7102].map((wp) => ({ id: wp, pimg: 'https://x/problem/' + (880000 + wp % 1000) + '/a.png' }));
    [[7001, 201], [7002, 201], [7004, 202], [7006, 205], [7007, 206], [7008, 101], [7101, 301], [7102, 301]].forEach(([wp, c]) => { CIDOF[880000 + wp % 1000] = c; });
    window.__CIDOF = CIDOF;
    const names = { 101: { n: '일차식의 계산', m: '문자와 식' }, 102: { n: '식의 값', m: '문자와 식' }, 103: { n: '농도 문제', m: '일차방정식의 활용' }, 104: { n: '등식', m: '일차방정식' },
      201: { n: '다각형의 내각', m: '다각형' }, 202: { n: '부채꼴의 넓이', m: '원과 부채꼴' }, 203: { n: '대각선', m: '다각형' }, 204: { n: '속력 문제', m: '속력과 거리' },
      205: { n: '삼각형의 외각', m: '다각형' }, 206: { n: '호의 길이', m: '원과 부채꼴' }, 301: { n: '평행선', m: '기본 도형' }, 401: { n: '비율', m: '비와 비율' }, 402: { n: '백분율', m: '비와 비율' } };
    window.MF_TYPE_ACH = { names, periods: {} };
    const sn = (name, grade, score) => ({ name, group: '', grade, score, rx: [], holes: 0, rxN: 0, units: [] });
    const calls = {}; calls[wk] = { S1: { on: true, snap: sn('홍길동', '중학교 2학년', 60) }, S2: { on: true, snap: sn('박하나', '초등학교 6학년', 50) }, S3: { on: true, snap: sn('이순신', '중학교 2학년', 40) } };
    const W = (sid, score, date) => ({ sid, score, correct: Math.round(score / 5), total: 20, date, wrongConcepts: [] });
    const d3 = day(3).slice(0, 10), d4 = day(4).slice(0, 10);
    Object.assign(window.__STORE, {
      or_studentdb: STU,
      rc_config: { minScore: 80, minUnit: 60, elem6Score: 75, weeks: 3, slots: ['10:00', '11:00'], range: null },
      rc_state: { calls, dates: {}, periods: {} },
      mf_weekly: { tests: [
        { wid: 12, key: 'w12', type: 'WEEKLY', title: '초6 주간', date: d4, students: [W('M2', 50, d4)] },
        { wid: 13, key: 'w13', type: 'WEEKLY', title: '중2 주간 B', date: d3, students: [W('M1', 60, d3), W('M3', 40, d3)] }] },
      mf_textbook_500: { title: '중등수학1(하)', problems: bank },
      mf_concept_names: names });
    window.getSupaClient = window.__FAKE;
    RC.loaded = false; RC.view = 'board'; BP.loaded = false; WK.loaded = false;
    try { NBK.loaded = false; NBK.data = null; } catch (e) {}
    RCWS.made = {}; RCWS.rule = null; RCWS.loaded = true; RCWS.cache = {};
    window.__W.length = 0;
    VIEW = 'recovery'; render();
    return { today, wk };
  });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(300);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-155');

  /* ── 보드 한 줄 ── */
  const line = (k) => pg.evaluate((k) => { const el = document.querySelector('[data-rw155-line="' + k + '"]'); return el ? { txt: el.innerText.replace(/\s+/g, ' '), out: el.getAttribute('data-rw155-out'), st: el.getAttribute('style') } : null; }, k);
  let L1 = await line('S1');
  t('보드 ① 홍길동 «🕘 최근 4주 아직 틀린 문제 6개 · 테스트 범위 밖 5개»', !!L1 && /🕘 최근 4주 아직 틀린 문제 6개 · 테스트 범위 밖 5개/.test(L1.txt), L1 && L1.txt);
  t('보드 ② 범위 밖 단원별 개수 «(중1-2 다각형 3 · …)»', !!L1 && /\(중1-2 다각형 3 · 속력과 거리 1 · 원과 부채꼴 1\)/.test(L1.txt), L1 && L1.txt);
  t('보드 ③ 범위 밖이 있으면 주황', !!L1 && L1.out === '5' && /#fff7ed/.test(L1.st));
  t('보드 ④ 다시 풀어 맞힌 문제(c203)·56일 밖은 빠짐 (대각선 없음)', !!L1 && !/대각선/.test(L1.txt));
  const L2 = await line('S2');
  t('보드 ⑤ 최근 오답 없는 학생 «아직 틀린 문제 없음»(회색)', !!L2 && /아직 틀린 문제 없음/.test(L2.txt) && !/#fff7ed/.test(L2.st), L2 && L2.txt);
  const L3 = await line('S3');
  t('보드 ⑥ 이순신 «아직 틀린 문제 3개 · 테스트 범위 밖 3개»', !!L3 && /아직 틀린 문제 3개 · 테스트 범위 밖 3개/.test(L3.txt), L3 && L3.txt);
  let Q = await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records'));
  t('보드 ⑦ 기록은 카드 학생 전부를 in.(sid,…) 한 번에 (학생마다 따로 읽지 않음)', Q.filter((q) => /in:mf_student_id/.test(q.desc)).length === 1 && Q.filter((q) => /eq:mf_student_id/.test(q.desc)).length === 0, JSON.stringify(Q));
  await pg.evaluate(() => { render(); render(); }); await pg.waitForTimeout(300);
  Q = await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records'));
  t('보드 ⑧ 다시 그려도 다시 읽지 않음(메모리)', Q.length === 1, Q.length);
  t('보드 ⑨ 보드 줄은 학습지 단추 줄 바로 위', await pg.evaluate(() => { const el = document.querySelector('[data-rw155-line="S1"]'); const n = el && el.nextElementSibling; return !!(n && /학습지 설계|다시 설계/.test(n.innerText)); }));
  t('보드 ⑩ 표시용 주석이 화면에 남지 않음', await pg.evaluate(() => document.getElementById('CONTENT').innerHTML.indexOf('rw155#') < 0));

  /* ── 재료·계획 (홍길동, 기본 규칙) ── */
  const plan = (k, rulePatch) => pg.evaluate(async ([k, rp]) => {
    const row = rcRows().find((r) => r.stKey === k); const opt = rcws3Opt(row); const raw = await rcws3Gather(row, opt); const m = rcws3View(raw, opt);
    const p = rcwsPlan(m, Object.assign(rcwsRule(), rp || {}), opt); const tt = rcwsPlanTotals(p);
    return { t: tt, I: { exN: p.r155.exN, grp: p.r155.grp, wide: p.r155.wide, fill: p.r155.fill, cut: p.r155.cut, cutN: p.r155.cutN },
      rec: p.book.filter((x) => x.w.recent || x.wide).map((x) => ({ wp: x.w.wpId, pid: x.w.pid, cid: x.w.cid, n: x.n, wide: !!x.wide, grp: !!x.grp, rbase: x.w.rbase || '', out: !!x.w.out })),
      test: p.test.map((x) => ({ no: x.w.no, cid: x.w.cid, n: x.n, ex: !!x.ex })), tb: p.tb.map((x) => x.n), boost: p.boost.map((b) => ({ cid: b.cid, n: b.n, fill: !!b.fill })), info: m.recentInfo };
  }, [k, rulePatch]);
  let P1 = await plan('S1');
  const recWp = P1.rec.filter((r) => !r.wide).map((r) => r.wp || ('p' + r.pid)).sort().join(',');
  t('재료 ① 범위 밖 «아직 틀린 문제» 더함 (7001·7002·7003·7004·학습지 9100) + 범위 안 7008 은 «최근»으로 한 번만', recWp === '7001,7002,7003,7004,7008,p9100', recWp);
  t('재료 ② 다시 풀어 맞힌 7005 는 빠짐', !P1.rec.some((r) => r.wp === 7005));
  t('재료 ③ 범위 안 교재 오답과 겹친 7008 → 한 줄(rbase=book)', P1.rec.filter((r) => r.wp === 7008).length === 1 && P1.rec.find((r) => r.wp === 7008).rbase === 'book');
  t('재료 ④ 교재 은행으로 문제은행 번호 찾음 (7001→880001) · 은행에 없는 7003 은 번호 없음', P1.rec.find((r) => r.wp === 7001).pid === 880001 && !P1.rec.find((r) => r.wp === 7003).pid);
  t('재료 ⑤ 최근 오답 개수·교재/학습지별·중단원별', P1.info && P1.info.n === 6 && P1.info.out === 5 && P1.info.bySrc.some((a) => /중등수학1\(하\)/.test(a[0]) && a[1] === 5) && P1.info.byMid.some((a) => a[0] === '다각형' && a[1] === 3), JSON.stringify(P1.info));
  t('계획 ① 유형마다 1개 — c201 3번 틀림 → 2개만 (가장 오래된 7003 묶음)', P1.rec.filter((r) => r.cid === 201 && r.n > 0).length === 2 && P1.rec.find((r) => r.wp === 7003).grp && P1.I.grp === 1, JSON.stringify(P1.rec));
  t('계획 ② 하한 30 — 먼저 기간 56일로 넓혀 c205·c206 (70일 전 c207 은 없음)', P1.I.wide === 2 && P1.rec.filter((r) => r.wide).map((r) => r.cid).sort().join(',') === '205,206', JSON.stringify(P1.I));
  t('계획 ③ 그래도 모자라 같은 유형 12문항(보강으로 셈) → 정확히 30', P1.t.total === 30 && P1.I.fill === 12 && P1.t.fill === 12 && P1.t.boost === 14, JSON.stringify(P1.t));
  t('계획 ④ 합계 칸: 쌍둥이 6 · 교과서 3 · 최근 7 · 교재 0', P1.t.twin === 6 && P1.t.tb === 3 && P1.t.recent === 7 && P1.t.bookOnly === 0, JSON.stringify(P1.t));
  t('계획 ⑤ 채우기 유형 = 테스트·최근 오답 유형만', P1.boost.filter((b) => b.fill).every((b) => [101, 102, 103, 201, 202, 204, 205, 206].indexOf(b.cid) >= 0), JSON.stringify(P1.boost));

  /* ── 상한 40 우선순위 (이순신) ── */
  const P3 = await plan('S3');
  t('상한 ① 이순신 61 → 40', P3.t.total === 40, JSON.stringify(P3.t));
  t('상한 ② 쌍둥이 첫째 18 모두 · 최근 오답 2 · 교과서 18 · 쌍둥이 둘째 2 · 보강 0', P3.test.filter((x) => x.n >= 1).length === 18 && P3.t.recent === 2 && P3.t.tb === 18 && P3.t.twin === 20 && P3.t.boost === 0, JSON.stringify(P3.t));
  t('상한 ③ 쌍둥이 둘째는 앞 문항부터 남김(1·2번)', P3.test[0].n === 2 && P3.test[1].n === 2 && P3.test[2].n === 1, JSON.stringify(P3.test.slice(0, 3)));
  t('상한 ④ 뺀 것 기록 (쌍둥이 둘째 16 · 보강 5)', P3.I.cutN === 21 && P3.I.cut.twin2 === 16 && P3.I.cut.boost === 5, JSON.stringify(P3.I));
  t('상한 ⑤ 최근 오답은 새것 먼저 (7101·7102 남고 7103 은 유형마다 1개로 묶임)', P3.rec.filter((r) => r.n > 0).map((r) => r.wp).sort().join(',') === '7101,7102', JSON.stringify(P3.rec));

  /* ── 빼는 유형 ── */
  const PX = await plan('S1', { exclude: '농도' });
  t('빼는 유형 ① «농도» → 테스트 3번(c103) 쌍둥이·교과서 0', PX.test.find((x) => x.cid === 103).n === 0 && PX.test.find((x) => x.cid === 103).ex && PX.tb[2] === 0, JSON.stringify(PX.test));
  t('빼는 유형 ② 하한 채우기에도 c103 없음 · 여전히 30', !PX.boost.some((b) => b.cid === 103 && b.n > 0) && PX.t.total === 30, JSON.stringify(PX.boost));

  /* ── 오른쪽 «학습지 규칙» 칸 ── */
  const box = await pg.evaluate(() => l3rRuleBox());
  t('규칙 칸 ① 아직 틀린 문제 최근 [28]일 · 유형마다 1개 · 문항 [30]~[40] · 빼는 유형', /아직 틀린 문제 최근/.test(box) && /id="l3r-rdays"[^>]*value="28"/.test(box) && /유형마다 1개/.test(box) && /id="l3r-min"[^>]*value="30"/.test(box) && /id="l3r-max"[^>]*value="40"/.test(box) && /id="l3r-excl"/.test(box), box.slice(0, 300));
  await pg.evaluate(() => { window.__W.length = 0; rw155Rule('days', 21); rw155Rule('perType', false); rw155Rule('min', 25); rw155Rule('max', 35); rw155Rule('exclude', '농도'); });
  await pg.waitForTimeout(200);
  let RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('규칙 칸 ② rc_ws_rule 에 저장 (recent{on,days:21} · perType false · min 25 · max 35 · exclude 농도)', RW && RW.recent && RW.recent.on === true && RW.recent.days === 21 && RW.perType === false && RW.min === 25 && RW.max === 35 && RW.exclude === '농도', JSON.stringify(RW));
  await pg.evaluate(() => { rw155Rule('exclude', '(농도'); }); await pg.waitForTimeout(100);
  t('규칙 칸 ③ 잘못된 정규식은 저장 안 함', (await pg.evaluate(() => rcwsRule().exclude)) === '농도');
  t('규칙 칸 ④ 옛 칸(쌍둥이·교과서·보강 등)은 그대로', RW.twinPer === 2 && RW.tbPer === 1 && RW.bookTwin === 1 && RW.boost === true);
  await pg.evaluate(() => { rw155Rule('days', 28); rw155Rule('perType', true); rw155Rule('min', 30); rw155Rule('max', 40); rw155Rule('exclude', ''); render(); }); await pg.waitForTimeout(600);
  t('규칙 칸 ⑤ 일수를 바꾸면 보드 줄을 다시 읽음', (await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records' && /in:mf_student_id/.test(q.desc)).length)) >= 2);

  /* ── 설계 팝업 ── */
  await pg.evaluate(() => rcwsOpen('S1')); await pg.waitForTimeout(800);
  const pop = () => pg.evaluate(() => { const p = document.getElementById('rc-pop'); if (!p) return null; const tot = {}; p.querySelectorAll('[data-rcws-tot]').forEach((e) => { tot[e.getAttribute('data-rcws-tot')] = Number(e.innerText); });
    const rb = p.querySelector('[data-rw155-recent]'); return { txt: p.innerText.replace(/\s+/g, ' '), tot, recent: rb ? rb.innerText.replace(/\s+/g, ' ') : '', src: (p.querySelector('[data-rw155-src]') || {}).innerText || '', mid: (p.querySelector('[data-rw155-mid]') || {}).innerText || '', fill: !!p.querySelector('[data-rw155-fillblk]'), make: (document.getElementById('rcws-make') || {}).innerText || '' }; });
  let PP = await pop();
  t('팝업 ① «🕘 최근 오답 6문항 → 쌍둥이 5» 칸', !!PP && /🕘 최근 오답 6문항 → 쌍둥이 5/.test(PP.recent), PP && PP.recent.slice(0, 200));
  t('팝업 ② 교재·학습지별 · 중단원별 개수 줄', /중등수학1\(하\) 5/.test(PP.src) && /다각형 3/.test(PP.mid), PP.src + ' / ' + PP.mid);
  t('팝업 ③ 합계 칸 «최근 오답 7» · 총 30 · 단추 30문항', PP.tot['최근 오답'] === 7 && PP.tot['총 문항'] === 30 && /30문항/.test(PP.make), JSON.stringify(PP.tot) + ' ' + PP.make);
  t('팝업 ④ 하한 채우기 칸 · 안내 줄', PP.fill && /하한 30문항/.test(PP.txt));
  t('팝업 ⑤ 구성 한 줄에 «최근 오답 7»', /최근 오답 7 · 교재 오답 0/.test(PP.txt), PP.txt.slice(0, 400));
  t('팝업 ⑥ 범위 밖 표시 · 묶음 표시 · 넓힘 표시', /테스트 범위 밖/.test(PP.recent) && /유형마다 1개로 묶음/.test(PP.recent) && /하한 채우기\(56일\)/.test(PP.recent));
  // 학생별 끄기
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('[data-rcws-tg="recent"]'); await pg.waitForTimeout(500);
  PP = await pop();
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ⑦ 이 학생만 끄기 → per.S1.recent=false 저장 (그 주)', RW && RW.per && RW.per.S1 && RW.per.S1.recent === false && RW.per.S1.wk === FX.wk, JSON.stringify(RW && RW.per));
  t('팝업 ⑧ 끄면 최근 오답 0 · 7008 은 범위 안 교재 오답으로 돌아감 · 여전히 30', PP.tot['최근 오답'] === 0 && PP.tot['교재 오답'] === 1 && PP.tot['총 문항'] === 30, JSON.stringify(PP.tot));
  // 학생별 상한
  await pg.fill('#rw155-max', '20'); await pg.dispatchEvent('#rw155-max', 'change'); await pg.waitForTimeout(500);
  PP = await pop();
  RW = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_ws_rule').map((x) => x.value).pop());
  t('팝업 ⑨ 이 학생 문항 상한 20 → 저장 · 총 20 (하한도 20으로)', RW.per.S1.max === 20 && RW.per.S1.recent === false && PP.tot['총 문항'] === 20, JSON.stringify(RW.per.S1) + ' ' + JSON.stringify(PP.tot));
  t('팝업 ⑩ 옛 학생별 선택(시험·1배수·교재 빼기) 칸도 그대로 저장', Array.isArray(RW.per.S1.wids) && RW.per.S1.wids[0] === '13' && RW.per.S1.twin1 === false && RW.per.S1.noBook === false);
  await pg.evaluate(() => rcws3ResetOpt()); await pg.waitForTimeout(600);
  PP = await pop();
  t('팝업 ⑪ ↺ 기본으로 → 다시 최근 오답 켜짐 · 30', PP.tot['최근 오답'] === 7 && PP.tot['총 문항'] === 30, JSON.stringify(PP.tot));

  /* ── 만들기 (가짜 매쓰플랫) — 빼는 유형은 쌍둥이 응답에서 걸러짐 ── */
  await pg.evaluate(() => { rcPopClose(); rw155Rule('exclude', '농도'); });
  await pg.evaluate(() => {
    const CID = window.__CIDOF; window.__MF = { calls: [], made: null, filters: {} }; let fn = 0;
    const prob = (id, c) => ({ id, level: 3, conceptId: c, type: 'SHORT', answer: '1' });
    rcwsApi.call = (m, p, b) => { window.__MF.calls.push(m + ' ' + p);
      if (p === '/worksheet/filter/concept') { fn++; window.__MF.filters['F' + fn] = (b.conceptIdList || []).slice(); return Promise.resolve({ filterId: 'F' + fn }); }
      if (/^\/derivation\/problem\//.test(p)) { const pid = Number(p.split('/').pop()); const c = CID[pid] || 999;
        const pair = [prob(pid * 10 + 1, 103), prob(pid * 10 + 2, c), prob(pid * 10 + 3, c), prob(pid * 10 + 4, c)];   // 맨 앞은 빼는 유형(농도) 문제
        pair.forEach((x) => { CID[x.id] = x.conceptId; }); return Promise.resolve({ pairProblemList: pair.map((x) => ({ problem: x })), similarProblemList: [] }); }
      if (p === '/worksheet/problem') { const cl = window.__MF.filters[b.filterId] || []; const out = []; cl.forEach((c) => { for (let k = 1; k <= 30; k++) { const id = c * 1000 + k; CID[id] = c; out.push({ problem: prob(id, c) }); } });
        for (let k = 1; k <= 5; k++) { CID[103000 + 900 + k] = 103; out.push({ problem: prob(103000 + 900 + k, 103) }); } return Promise.resolve(out); }
      if (p === '/worksheet') { window.__MF.made = b; return Promise.resolve({ id: 5555 }); }
      return Promise.resolve({}); };
  });
  await pg.evaluate(() => rcwsOpen('S1')); await pg.waitForTimeout(800);
  PP = await pop();
  t('만들기 ① 빼는 유형 켠 팝업 — «빼는 유형 «농도» 1문항 뺌»', /빼는 유형 «농도» 1문항 뺌/.test(PP.txt) && PP.tot['총 문항'] === 30, PP.txt.slice(0, 300));
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('#rcws-make'); await pg.waitForTimeout(1500);
  const MD = await pg.evaluate(() => ({ made: window.__MF.made, cid: window.__CIDOF, w: window.__W.filter((x) => x.key === 'rc_ws_made').map((x) => x.value).pop() }));
  const ids = MD.made ? MD.made.problemList.map((x) => x.id) : [];
  t('만들기 ② 매쓰플랫에 30문항 학습지', ids.length === 30, ids.length);
  t('만들기 ③ 빼는 유형(농도 c103) 문제는 하나도 없음', ids.length > 0 && ids.every((id) => MD.cid[id] !== 103), ids.filter((id) => MD.cid[id] === 103).join(','));
  t('만들기 ④ 하한에서 넓힌 c205·c206 유형도 필터에 들어감', await pg.evaluate(() => { const f = window.__MF.filters.F1 || []; return f.indexOf(205) >= 0 && f.indexOf(206) >= 0; }));
  t('만들기 ⑤ rc_ws_made 기록에 최근 오답 수(parts.recent)', MD.w && MD.w.byKey && MD.w.byKey.S1 && MD.w.byKey.S1.parts && MD.w.byKey.S1.parts.recent === 7, JSON.stringify(MD.w && MD.w.byKey && MD.w.byKey.S1 && MD.w.byKey.S1.parts));
  await pg.evaluate(() => { rcPopClose(); render(); }); await pg.waitForTimeout(300);
  t('만들기 ⑥ 카드 ✅ 칸에 «최근 오답 7»', await pg.evaluate(() => /최근 오답 7 · 보강/.test(document.getElementById('CONTENT').innerText)));

  /* ── ↻ 다시 읽기 → 보드 줄 다시 읽음 ── */
  const q0 = await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records' && /in:mf_student_id/.test(q.desc)).length);
  await pg.evaluate(() => rc154Reload(true)); await pg.waitForTimeout(1200);
  t('다시 읽기 → 보드 줄 기록도 다시 읽음', (await pg.evaluate(() => window.__Q.filter((q) => q.tbl === 'mf_answer_records' && /in:mf_student_id/.test(q.desc)).length)) === q0 + 1);
  t('등록부(or_studentdb)에 쓰지 않음', await pg.evaluate(() => window.__W.filter((x) => x.key === 'or_studentdb').length === 0));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
