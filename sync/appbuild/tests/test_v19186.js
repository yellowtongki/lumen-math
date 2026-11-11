#!/usr/bin/env node
/* 학원앱 v19-186 검사 — 기기 저장 공간: 서버 쌍둥이 캐시 mfd_ 를 받지 않고, 이미 기기에 있으면 켤 때 버린다
 *   외부망 차단 · 켜기 전에 이 기기에 mfd_ 60개(각 20KB)와 보통 키 하나를 넣어 둔다 → 켠 뒤 mfd_ 0개 · 보통 키 그대로
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19186.js lumen_v19-186.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-186.html');
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE + '#seed', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} const big = 'x'.repeat(20000); for (let i = 0; i < 60; i++) localStorage.setItem('mfd_' + (1000 + i), big); localStorage.setItem('keep_me_test', '1'); });
  await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const ks = Object.keys(localStorage); return { mfd: ks.filter((k) => k.indexOf('mfd_') === 0).length, keep: localStorage.getItem('keep_me_test'), skip: PULL_SKIP_PREFIX.indexOf('mfd_') >= 0, mem: typeof isMemOnlyKey === 'function' && isMemOnlyKey('mfd_123'), ver: APP_VER }; });
  t('켤 때 이 기기의 mfd_ 60개를 모두 버림', r.mfd === 0, JSON.stringify(r));
  t('보통 키는 그대로', r.keep === '1', JSON.stringify(r));
  t('시작 다운로드에서 mfd_ 뺌(PULL_SKIP_PREFIX)', r.skip, '');
  t('mfd_ 는 기기에 두지 않는 키(isMemOnlyKey)', r.mem === true, '');
  t('APP_VER v19-186', r.ver === 'v19-186', r.ver);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
