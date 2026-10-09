#!/usr/bin/env node
/* 학원앱 v19-92 검사 — 🧩 리커버리 학습지 설계·즉시 생성 (외부망 차단 · 가짜 Supabase · 가짜 매쓰플랫)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v1992.js lumen_v19-92.html
 *   학생 이름은 ○○○ · 코드는 가짜. 그림: $SP/v1992_rcws.png */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-92.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const o = await pg.evaluate(async () => {
    const out = { ver: APP_VER };
    /* ── 가짜 서버 자료 ── */
    const pimg = (id) => 'https://x/problem/' + id + '/ab/problem.png';
    const store = {
      mf_textbooks: { books: { '2110004': { type: 'SCHOOL', title: '교과서_비상', fulltitle: '교과서_비상 - 중등수학1' } }, byStudent: { I1: { books: ['2110004'] } } },
      mf_textbook_2110004: { title: '교과서_비상 - 중등수학1', problems: [
        { id: 900001, cid: 101, level: 2, page: 80, no: '1', pimg: pimg(70001) }, { id: 900002, cid: 101, level: 3, page: 81, no: '3', pimg: pimg(70002) },
        { id: 900003, cid: 102, level: 3, page: 90, no: '2', pimg: pimg(70003) }, { id: 900004, cid: 103, level: 1, page: 95, no: '5', pimg: pimg(70004) } ] },
      mf_textbook_5550: { title: '라이트 중1-2', problems: [{ id: 800001, cid: 101, level: 3, page: 84, no: '7', pimg: pimg(60001) }] },
    };
    const recs = [
      { source: '학습지', worksheet_id: 777, mf_student_id: 'I1', problem_seq: 1, number: '4', result: 'X', concept_id: 101, level: 2, problem_id: 50004, score_datetime: '2026-10-06T10:00:00Z', student_worksheet_id: 1 },
      { source: '학습지', worksheet_id: 777, mf_student_id: 'I1', problem_seq: 2, number: '7', result: 'X', concept_id: 102, level: 3, problem_id: 50007, score_datetime: '2026-10-06T10:00:00Z', student_worksheet_id: 1 },
      { source: '학습지', worksheet_id: 777, mf_student_id: 'I1', problem_seq: 3, number: '9', result: 'O', concept_id: 103, level: 3, problem_id: 50009, score_datetime: '2026-10-06T10:00:00Z', student_worksheet_id: 1 },
      { source: '학습지', worksheet_id: 777, mf_student_id: 'I1', problem_seq: 4, number: '11', result: 'X', concept_id: 101, level: 3, problem_id: 50011, score_datetime: '2026-10-06T10:00:00Z', student_worksheet_id: 1 },
      { source: '교재', book_id: 5550, mf_student_id: 'I1', workbook_problem_id: 800001, page: '84', number: '7', result: 'X', concept_id: 101, level: 3, score_datetime: '2026-10-02T10:00:00Z' },
      { source: '교재', book_id: 5550, mf_student_id: 'I1', workbook_problem_id: 800009, page: '99', number: '1', result: 'X', concept_id: 999, level: 3, score_datetime: '2026-10-02T10:00:00Z' },   // 범위 밖 → 빠져야 함
    ];
    const match = (row, f) => f.every(([op, k, v]) => {
      if (op === 'eq') return String(row[k]) === String(v);
      if (op === 'in') return v.map(String).indexOf(String(row[k])) >= 0;
      if (op === 'gte') return String(row[k] || '') >= String(v);
      if (op === 'not') return row[k] != null;
      return true;
    });
    const fakeSb = { from(tbl) { const b = { f: [], select() { return b; }, eq(k, v) { b.f.push(['eq', k, v]); return b; }, in(k, v) { b.f.push(['in', k, v]); return b; }, gte(k, v) { b.f.push(['gte', k, v]); return b; }, not(k) { b.f.push(['not', k]); return b; }, order() { return b; }, limit() { return b; },
      then(r, j) { let data; if (tbl === 'lumen_store') { const keys = (b.f.find((x) => x[0] === 'in') || [])[2] || []; data = keys.filter((k) => store[k]).map((k) => ({ key: k, value: store[k] })); } else data = recs.filter((x) => match(x, b.f)); return Promise.resolve({ data, error: null }).then(r, j); } }; return b; } };
    window.getSupaClient = () => fakeSb;
    window.supaSetItem = async (k, v) => { store[k] = v; return true; };
    /* ── 가짜 매쓰플랫 ── */
    const calls = [];
    const fakeApi = { call: async (m, p, body) => { calls.push({ m, p, body });
      if (p === '/worksheet/filter/concept') return { filterId: 'F1' };
      if (p.indexOf('/derivation/problem/') === 0) { const pid = Number(p.split('/').pop()); const ex = (body.excludedProblemIds || []).map(Number);
        const mk = (id, lv) => ({ problem: { id, level: lv, conceptId: 101 }, tagTop: null });
        const pair = pid === 50007 ? [mk(61001, 3), mk(61002, 3)] : [];
        const sim = [mk(pid + 100, 2), mk(pid + 101, 3), mk(pid + 102, 3), mk(pid + 103, 4), mk(50011, 3)];   // 50011 = 이미 틀린(푼) 문제 → 빠져야 함
        return { pairProblemList: pair.filter((x) => ex.indexOf(x.problem.id) < 0), similarProblemList: sim.filter((x) => ex.indexOf(x.problem.id) < 0) }; }
      if (p === '/worksheet/problem') return [{ id: 71001, conceptId: 101, level: 3 }, { id: 71002, conceptId: 102, level: 2 }, { id: 71003, conceptId: 103, level: 3 }];
      if (p === '/worksheet') return 83800001;
      throw new Error('unexpected ' + p); } };
    /* ── 재료 → 설계 → 만들기 ── */
    const row = { st: { name: '○○○', grade: '중1', group: 'T5' }, stKey: 'S1', sid: 'I1', testHit: { wid: 777, title: '중1 (2026.10.03)', score: 70, correct: 14, total: 20, date: '2026-10-06' } };
    window.tqName = (c) => ({ 101: '다각형의 내각', 102: '부채꼴의 호', 103: '원의 성질' })[c] || String(c);
    window.rcWeekKey = () => '2026-10-11'; window.rcRecDate = () => '2026-10-11'; window.rcWsSchool = () => ({ schoolType: 'MIDDLE', grade: '1' });
    window.RC = window.RC || {}; RC.state = { calls: { '2026-10-11': { S1: { on: true } } }, dates: {}, periods: {} }; window.rcSaveState = async () => {}; window.VIEW = 'x'; window.render = () => {};
    const model = await rcwsGather(row);
    out.model = { wrong: model.wrong.map((w) => w.no + ':' + w.cid + ':' + w.pid), range: model.range, bookWrong: model.bookWrong.map((w) => w.page + '/' + w.no + ':' + w.pid), tb: Object.keys(model.tb.byCid), solved: Object.keys(model.solved), warn: model.warn };
    const plan = rcwsPlan(model, { twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, theory: false, days: 28 });
    out.plan = { test: plan.test.map((x) => x.n), tb: plan.tb.map((x) => x.n), book: plan.book.map((x) => x.n), boost: plan.boost.map((b) => b.cid + ':' + b.n + ':' + b.times), totals: rcwsPlanTotals(plan) };
    const logs = [];
    const res = await rcwsBuild(model, plan, fakeApi, (s) => logs.push(s));
    out.res = { wsId: res.wsId, n: res.n, parts: res.parts, ids: res.items.map((i) => i.kind + ':' + i.id), title: res.title };
    const wsCall = calls.find((c) => c.p === '/worksheet');
    out.wsBody = { n: wsCall.body.problemList.length, assign: wsCall.body.assignStudentIdList, title: wsCall.body.title, design: wsCall.body.designTemplateId, concept: wsCall.body.conceptIdList.length, school: wsCall.body.schoolType + wsCall.body.grade, dup: new Set(wsCall.body.problemList.map((p) => p.id)).size };
    out.logs = logs;
    /* 팝업 그리기 */
    RCWS_CUR = { model, plan, stKey: 'S1', busy: false, logs: [], result: res, err: '' };
    rcPopShow('<div></div>'); rcwsPaint(); out.popup = (document.getElementById('rc-pop') || {}).innerText || '';   // rcwsPaint 는 팝업이 열려 있을 때만 그린다
    /* 카드 단추 — 만든 뒤 */
    await rcwsSaveMade('S1', res); out.btn = rcWsBtn(row).replace(/<[^>]+>/g, ' ');
    out.acct = rcwsAcctBox().indexOf('rcws-id') >= 0;
    return out;
  });
  console.log(JSON.stringify(o, null, 1).slice(0, 4000));
  t('버전 v19-92', o.ver === 'v19-92');
  t('시험 오답 3문항 (범위 유형 101·102·103)', o.model.wrong.length === 3 && o.model.range.join(',') === '101,102,103', JSON.stringify(o.model));
  t('교재 오답: 범위 안 1문항만 · 은행으로 문제 번호 60001', o.model.bookWrong.length === 1 && o.model.bookWrong[0] === '84/7:60001', JSON.stringify(o.model.bookWrong));
  t('교과서 유형 3가지 읽음', o.model.tb.length === 3, JSON.stringify(o.model.tb));
  t('설계: 쌍둥이 2·2·2 교과서 1·1·1 교재 1 보강(101은 3번) 1', o.plan.test.join('') === '222' && o.plan.tb.join('') === '111' && o.plan.book.join('') === '1' && o.plan.boost.join('|') === '101:1:3' && o.plan.totals.total === 11, JSON.stringify(o.plan));
  t('만들기: 11문항 · 학습지 #83800001', o.res.n === 11 && o.res.wsId === 83800001, JSON.stringify(o.res));
  t('7번은 쌍둥이(pair) 61001·61002 우선', o.res.ids.indexOf('twin:61001') >= 0 && o.res.ids.indexOf('twin:61002') >= 0, JSON.stringify(o.res.ids));
  t('이미 푼 50011 은 쌍둥이에 안 들어감 · 중복 없음', o.res.ids.indexOf('twin:50011') < 0 && o.wsBody.dup === 11, JSON.stringify(o.res.ids));
  t('교과서 문항(70001·70002·70003) 들어감', ['tb:70001', 'tb:70002', 'tb:70003'].every((x) => o.res.ids.indexOf(x) >= 0), JSON.stringify(o.res.ids));
  t('교재 오답 쌍둥이 1 · 보강 1', o.res.parts.book === 1 && o.res.parts.boost === 1, JSON.stringify(o.res.parts));
  t('학습지 요청: 배정 I1 · 녹색 서식 41988 · 이론 없음 · 중1 · 제목 「리커버리 10/11 ○○○」', o.wsBody.assign.join('') === 'I1' && o.wsBody.design === 41988 && o.wsBody.concept === 0 && o.wsBody.school === 'MIDDLE1' && o.wsBody.title === '리커버리 10/11 ○○○', JSON.stringify(o.wsBody));
  t('팝업에 결과·합계 표시', /✅ 매쓰플랫에 만들어 배정/.test(o.popup) && /총 문항/.test(o.popup), o.popup.slice(0, 200));
  t('카드 단추: ✅ 11문항 요약 + 다시 설계', /11문항/.test(o.btn) && /다시 설계/.test(o.btn), o.btn);
  t('계정 입력 칸', o.acct === true);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'rc-pop' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });   // 로그인 화면이 팝업을 가린다
  await pg.locator('#rc-pop > div').screenshot({ path: SP + '/v1992_rcws.png' });
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
