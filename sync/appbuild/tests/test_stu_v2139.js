#!/usr/bin/env node
/* 학생앱 v2-139 검사 — 스터디 코디 «점검 중» (원장 2026-10-15)
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2139.js student_v2-139.html */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-139.html'); const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0; const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https:\/\//, (r) => r.abort());
  await p.goto('file://' + FILE); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const o = { ver: STU_VER };
    const fake = (v) => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [{ value: v }] }) }) }) });
    window.sb = fake({ on: false, paused: true, targets: ['*'] }); await scSettings(true);
    o.paused = scPaused();
    await scHomeUpdate(); const el = document.getElementById('sc-home'); o.home = el.textContent; o.homeShow = el.style.display;
    await scInit(); o.body = (document.getElementById('sc-body') || {}).textContent || '';
    window.sb = fake({ on: true, targets: ['*'] }); await scSettings(true); o.notPaused = scPaused();
    return o;
  });
  t('버전 v2-139', r.ver === 'v2-139', r.ver);
  t('paused 설정 → scPaused()', r.paused === true && r.notPaused === false);
  t('홈 카드 「스터디 코디 · 점검 중」 보임', /점검 중/.test(r.home) && r.homeShow === 'flex', r.home);
  t('코디 화면 = 점검 안내', /점검 중/.test(r.body), r.body.slice(0, 60));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n결과: ' + pass + ' 통과 / ' + fail + ' 실패'); await b.close(); process.exit(fail ? 1 : 0);
})();
