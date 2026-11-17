#!/usr/bin/env node
/* 학원앱 v19-197 검사 — 📱 모바일 제출 현황 › 학생 이름 → 날짜별 달력 (test_v19196 틀)
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19197.js lumen_v19-197.html [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-197.html'), SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const FX = await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const p2 = (x) => String(x).padStart(2, '0'), n = new Date();
    const K = (d) => '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
    /* 이번 달 지난 수업일(월수금) 목록 */
    const cls = []; for (let dd = 1; dd <= n.getDate(); dd++) { const d = new Date(n.getFullYear(), n.getMonth(), dd); if ([1, 3, 5].indexOf(d.getDay()) >= 0) cls.push(d); }
    const a = cls[0], b = cls[1];
    const aNext = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1);
    const S = [{ id: 'a', name: '○○가', grade: '중학교 1학년', group: 'M4', lumen_rec_code: 'R1',
      lumen_planner_photos: [{ setId: K(a) + '_2110_x', urls: ['u'] }, { setId: K(aNext) + '_0130_x', urls: ['u'] }] }];
    students.length = 0; S.forEach((s) => students.push(s));
    mobRoster = function () { return { key: '월수금', list: S }; };
    fetchRecordings = async function () { return [{ name: 'r_' + K(a) + '.m4a', created_at: a.toISOString() }, { name: 'r_' + K(n) + '.m4a', created_at: n.toISOString() }]; };
    window._homePlannerDone = true; window._homePlannerKicked = true;
    MOB.rec = { started: false, done: false, map: {} }; MOB.pc = false; MOB.view = 'subm';
    mobRecLoad();
    return { a: K(a), b: K(b), nCls: cls.length, today: K(n) };
  });
  await pg.waitForTimeout(800); await pg.evaluate(() => render()); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('#MOB_OV .m196-row').click()); await pg.waitForTimeout(300);
  const C = await pg.evaluate((fx) => { const g = (k) => { const e = document.querySelector('#MOB_OV .m197-day[data-d="' + k + '"]'); return e ? e.innerText.replace(/\s+/g, ' ') : null; };
    const sum = document.querySelector('#MOB_OV .m197-sum'); return { a: g(fx.a), b: g(fx.b), t: g(fx.today), sum: sum ? sum.innerText.replace(/\s+/g, ' ') : '', all: document.getElementById('MOB_OV').innerText.replace(/\s+/g, ' ') }; }, FX);
  t('① 이름 누르면 달력 · 이름·반·수업 월수금', /○○가/.test(C.all) && /수업 월수금/.test(C.all) && /년 \d+월/.test(C.all), C.all.slice(0, 160));
  t('② 첫 수업일 칸: 🎙✓ 📒✓ (다음날 01:30 플래너도 그날로)', C.a && /🎙✓/.test(C.a) && /📒✓/.test(C.a), C.a);
  t('③ 둘째 수업일 칸: 🎙✗ 📒✗', C.b && /🎙✗/.test(C.b) && /📒✗/.test(C.b), C.b);
  t('④ 요약 «수업일 녹음 2/n · 플래너 1/n»', new RegExp('2/' + FX.nCls + '.*1/' + FX.nCls).test(C.sum), C.sum + ' n=' + FX.nCls);
  t('⑤ 안 낸 수업일 줄', /안 낸 수업일/.test(C.all), '');
  t('⑤-2 오늘 칸: 녹음 ✓ · 플래너는 ⏳(마감 전, ✗ 아님)', C.t && /🎙✓/.test(C.t) && /📒⏳/.test(C.t), C.t);
  if (SHOT) await pg.screenshot({ path: SHOT });
  await pg.evaluate(() => m197Mon(-1)); await pg.waitForTimeout(200);
  t('⑥ ‹ 지난달로', await pg.evaluate(() => { const n = new Date(); const m = n.getMonth() === 0 ? 12 : n.getMonth(); return new RegExp(' ' + m + '월').test(document.getElementById('MOB_OV').innerText); }), '');
  await pg.evaluate(() => m197Back()); await pg.waitForTimeout(200);
  t('⑦ ‹ 제출 현황 으로 돌아옴', await pg.evaluate(() => !!document.querySelector('#MOB_OV .m196-row')), '');
  t('⑧ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
