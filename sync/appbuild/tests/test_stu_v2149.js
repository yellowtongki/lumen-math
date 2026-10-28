#!/usr/bin/env node
/* 학생앱 v2-149 검사 — 플래너 제출 안내 맨 위 «📒 플래너는 모트모트로 내요»
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2149.js student_v2-149.html */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-149.html');
let pass = 0, fail = 0; const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (i || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
  t('버전 v2-149', await pg.evaluate(() => STU_VER === 'v2-149'));
  const box = await pg.evaluate(() => { const b = document.getElementById('pl-mottmott'); if (!b) return null; const card = b.parentElement; return { txt: b.innerText, first: card.firstElementChild === b }; });
  t('모트모트 상자가 안내 카드 맨 위', box && box.first, JSON.stringify(box));
  t('네 줄: 꽉 차게 · 점수 낮게 · O/△ · TOTAL TIME', box && /꽉 차게/.test(box.txt) && /점수가 낮게/.test(box.txt) && /O,\s*반쯤/.test(box.txt) && /TOTAL TIME 칸에/.test(box.txt), box && box.txt);
  t('예전 안내(사진 2장 · 날짜 · 형광펜 · 지난 날짜)는 그대로', await pg.evaluate(() => { const c = document.getElementById('pl-mottmott').parentElement.innerText; return /사진 2장을 함께/.test(c) && /맨 위에 날짜/.test(c) && /형광펜/.test(c) && /지난 날짜 플래너를 늦게/.test(c); }));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
