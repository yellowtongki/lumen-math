#!/usr/bin/env node
/* 학원앱 v19-194 검사 — 학원앱에서 바로 만드는 리커버리 학습지에도 문항마다 출처(tagTop)
 *   외부망 차단 · 매쓰플랫은 가짜 api(필터·문제 목록·쌍둥이·만들기) · 실제 매쓰플랫 호출 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19194.js lumen_v19-194.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-194.html');
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const R = await pg.evaluate(async () => {
    const P = (id, lv) => ({ id, level: lv || 3, type: 'SHORT_ANSWER', answer: '1', autoScoredType: 'POSSIBLE_PLUS', autoScored: true });
    const calls = []; let body = null;
    const api = { call(m, p, b) { calls.push(m + ' ' + p);
      if (p === '/worksheet/filter/concept') return Promise.resolve({ filterId: 'F' + calls.length });
      if (p === '/worksheet/problem') return Promise.resolve([11, 12, 13, 14].reduce((a, c) => a.concat([1, 2, 3].map((k) => ({ problem: Object.assign(P(c * 100 + k), { conceptId: c }) }))), []));
      if (/^\/derivation\/problem\/500$/.test(p)) return Promise.resolve({ pairProblemList: [{ problem: P(5001) }], similarProblemList: [{ problem: P(5002) }] });
      if (/^\/derivation\/problem\/600$/.test(p)) return Promise.resolve({ pairProblemList: [], similarProblemList: [{ problem: P(6002) }] });
      if (m === 'POST' && p === '/worksheet') { body = b; return Promise.resolve({ id: 999 }); }
      return Promise.resolve(null); } };
    const model = { row: { st: { name: '○○○', grade: '중학교 1학년', group: 'M4' } }, sid: 'X', test: { title: '중1 (2026.11.14)' },
      wrong: [{ no: 7, pid: 500, cid: 11, lv: 3 }], range: [], rangeNames: [],
      bookWrong: [{ wpId: 1, bid: '1', book: '쎈 중등수학1(하)', page: 52, no: 463, pid: 600, cid: 12, lv: 3 }],
      tb: { bid: 'T', title: '교과서_비상 - 중등수학1', byCid: { 13: [Object.assign(P(1301), { cid: 13 })] } }, solved: {}, warn: [] };
    const rule = { auto: true, theory: false, hardest: false };
    const plan = { rule, test: [{ w: model.wrong[0], n: 2 }], tb: [{ w: { cid: 13, lv: 3, no: 7 }, n: 1 }], book: [{ w: model.bookWrong[0], n: 1 }], boost: [{ cid: 14, n: 1 }], r155: { ex: {}, extra: [] } };
    let err = '';
    try { await rcwsBuild(model, plan, api, null); } catch (e) { err = e.message; }
    return { err, tags: body ? body.problemList.map((x) => x.tagTop) : null, n: body ? body.problemList.length : 0 };
  });
  t('① 만들기 성공', !R.err && R.n >= 5, JSON.stringify(R));
  const tags = R.tags || [];
  t('② 시험 쌍둥이 «[쌍둥이] 중1 (2026.11.14) 7번»', tags.indexOf('[쌍둥이] 중1 (2026.11.14) 7번') >= 0, JSON.stringify(tags));
  t('③ 시험 유사 «[유사] 중1 (2026.11.14) 7번»', tags.indexOf('[유사] 중1 (2026.11.14) 7번') >= 0, JSON.stringify(tags));
  t('④ 교과서 «[교과서] 교과서_비상 - 중등수학1»', tags.indexOf('[교과서] 교과서_비상 - 중등수학1') >= 0, JSON.stringify(tags));
  t('⑤ 교재 유사 «[유사] 쎈 중등수학1(하) p.52 463번»', tags.indexOf('[유사] 쎈 중등수학1(하) p.52 463번') >= 0, JSON.stringify(tags));
  t('⑥ 보강 «[보강] …»', tags.some((x) => /^\[보강\] /.test(x || '')), JSON.stringify(tags));
  t('⑦ 빈 출처 없음', tags.every((x) => x && x.length <= 80), JSON.stringify(tags));
  t('⑧ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
