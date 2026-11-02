#!/usr/bin/env node
/* 학생앱 v2-152 검사 — 학습지로 올린 IB아하노트가 서버 검사 규칙(source_type: book·print 만)에 걸리면 'print' 로 다시 저장
 * 실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2152.js student_v2-152.html */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-152.html');
let pass = 0, fail = 0; const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (i || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  const o = await pg.evaluate(async () => {
    const rows = [], tries = [];
    const ok = (st) => st === 'book' || st === 'print';   /* 실제 서버 규칙 */
    const mk = () => { const b = { _d: null, insert(d) { b._d = d; tries.push(d.source_type); return b; }, update(d) { b._d = d; tries.push('u:' + d.source_type); return b; }, select() { return b; }, eq() { return b; },
      then(r, j) { const d = b._d; const res = ok(d.source_type) ? (rows.push(d), { data: [{ id: 1 }], error: null }) : { data: null, error: { message: 'new row for relation "aha_notes" violates check constraint "aha_notes_source_type_check"' } }; return Promise.resolve(res).then(r, j); } }; return b; };
    window.sb = { from: () => mk() };
    const base = { source_type: 'worksheet', source_name: '10/31 리커버리 학습지', page: null, problem_no: '3', kind: 'ask', mf: { wid: 7101, pid: 99 }, memo: '질문' };
    const r1 = await a7Insert(Object.assign({}, base), true);
    const r2 = await a7Insert(Object.assign({}, base, { source_type: 'book', source_name: '쎈' }), false);
    const r3 = await a7Update(Object.assign({}, base), 5);
    return { ver: STU_VER, r1err: r1 && r1.error, r2err: r2 && r2.error, r3err: r3 && r3.error, rows, tries };
  });
  t('버전 v2-152', o.ver === 'v2-152', o.ver);
  t('학습지 노트: 한 번 거절 → print 로 저장됨', !o.r1err && o.rows[0] && o.rows[0].source_type === 'print' && o.rows[0].source_name === '10/31 리커버리 학습지', JSON.stringify(o.rows[0]));
  t('학습지 연결(mf)·문항 번호는 그대로', o.rows[0] && o.rows[0].mf && o.rows[0].mf.wid === 7101 && o.rows[0].problem_no === '3');
  t('교재 노트는 한 번에 그대로', !o.r2err && o.rows[1] && o.rows[1].source_type === 'book');
  t('고쳐 저장(update)도 같은 방식', !o.r3err && o.rows[2] && o.rows[2].source_type === 'print');
  t('시도 순서', o.tries.join(',') === 'worksheet,print,book,u:worksheet,u:print', o.tries.join(','));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
