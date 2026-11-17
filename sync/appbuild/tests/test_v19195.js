#!/usr/bin/env node
/* 학원앱 v19-195 · 학생앱 v2-163 검사 — 순위표 블랙반 엠블럼은 «지금 기수»(날짜 기준)만
 *   외부망 차단 · BLK.data 를 실제 모양(1기 3/1~8/31 마감 · 2기 9/1~12/30 마감)으로
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19195.js lumen_v19-195.html student_v2-163.html */
const { chromium } = require('playwright');
const path = require('path');
const FILES = process.argv.slice(2).map((f) => path.resolve(f));
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const F of FILES) {
    const nm = path.basename(F);
    const pg = await (await br.newContext()).newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
    await pg.route(/^https?:\/\//, (r) => r.abort());
    await pg.goto('file://' + F, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
    const R = await pg.evaluate(() => {
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const add = (n) => new Date(Date.now() + 9 * 3600000 + n * 864e5).toISOString().slice(0, 10);
      BLK.data = { cohorts: [
        { no: 1, name: '블랙반 1기', from: '2026-03-01', to: '2026-08-31', closed: true, hidden: false, codes: ['A', 'C'] },
        { no: 2, name: '블랙반 2기', from: add(-60), to: add(40), closed: true, codes: ['B', 'C'] },
        { no: 3, name: '블랙반 3기', closed: false, codes: ['D'] } ] };
      BLK.loaded = true;
      const s = (c) => String(blkTinyOf(c, 14) || '');
      return { A: s('A'), B: s('B'), C: s('C'), D: s('D'), Z: s('Z'), today };
    });
    const isT = /lumen_/.test(nm);
    t(nm + ' ① 1기 출신만(A) → 엠블럼 없음', R.A === '', R.A.slice(0, 80));
    t(nm + ' ② 2기(마감 표시지만 기간 안, B) → 엠블럼' + (isT ? ' Ⅱ' : ' 🖤 BLACK'), isT ? />II</.test(R.B) : /BLACK/.test(R.B), R.B.slice(0, 120));
    t(nm + ' ③ 1기+2기(C) → 지금 2기', isT ? />II</.test(R.C) && !/>I</.test(R.C) : /BLACK/.test(R.C), R.C.slice(0, 120));
    t(nm + ' ④ 기간 없는 기수는 «마감 안 됨»이면 지금(D)', R.D !== '', R.D.slice(0, 60));
    t(nm + ' ⑤ 블랙반 아님(Z) → 없음', R.Z === '', R.Z);
    t(nm + ' ⑥ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
