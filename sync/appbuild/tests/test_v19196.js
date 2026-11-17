#!/usr/bin/env node
/* 학원앱 v19-196 검사 — 📱 모바일 «오늘 제출 현황» → 학생별 녹음·플래너
 *   폰 화면(390px) · 외부망 차단 · 학생 5명(가짜 이름) · 녹음 목록(fetchRecordings)·플래너 setId 가짜
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19196.js lumen_v19-196.html [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-196.html'), SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const n = new Date(), p2 = (x) => String(x).padStart(2, '0');
    const ymd = '' + n.getFullYear() + p2(n.getMonth() + 1) + p2(n.getDate());
    const tm = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), tmr = '' + tm.getFullYear() + p2(tm.getMonth() + 1) + p2(tm.getDate());
    const S = [
      { id: 'a', name: '○○가', grade: '중학교 1학년', group: 'M4', lumen_rec_code: 'R1', lumen_planner_photos: [{ setId: ymd + '_2110_x', urls: ['u', 'v'], reviewed: true }] },
      { id: 'b', name: '○○나', grade: '중학교 2학년', group: 'M4', lumen_rec_code: 'R2', lumen_planner_photos: [{ setId: tmr + '_0130_x', urls: ['u'] }] },
      { id: 'c', name: '○○다', grade: '초등학교 6학년', group: 'M3', lumen_rec_code: 'R3', lumen_planner_photos: [{ setId: ymd + '_0100_x', urls: ['u'] }] },
      { id: 'd', name: '○○라', grade: '중학교 3학년', group: 'M7', lumen_rec_code: 'R4', lumen_planner_photos: [] },
      { id: 'e', name: '○○마', grade: '중학교 1학년', group: 'M4', lumen_rec_code: '', lumen_planner_photos: [{ setId: ymd + '_1530_x', urls: ['u'] }] } ];
    mobRoster = function () { return { key: '월수금', list: S }; };
    const iso = n.toISOString();
    fetchRecordings = async function (code) { if (code === 'R1') return [{ name: 'rec_' + ymd + '_a.m4a', created_at: iso }, { name: 'rec_' + ymd + '_b.m4a', created_at: iso }]; if (code === 'R3') return [{ name: 'x_' + ymd + '.m4a', created_at: iso }]; if (code === 'R4') return [{ name: 'x_20200101.m4a', created_at: iso }]; return []; };
    window._homePlannerDone = true; window._homePlannerKicked = true;
    MOB.rec = { started: false, done: false, map: {} }; MOB.pc = false; MOB.view = 'home';
    mobRecLoad();
  });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(300);
  const home = await pg.evaluate(() => { const c = document.querySelector('#MOB_OV .m196-card'); return { has: !!c, txt: c ? c.innerText.replace(/\s+/g, ' ') : '' }; });
  t('① 홈 «오늘 제출 현황» 카드 누를 수 있음 · «학생별 보기» · 녹음 2/4 · 플래너 3/5(새벽 규칙)', home.has && /학생별 보기/.test(home.txt) && /2\/4/.test(home.txt.replace(/\s/g, '')) && /3\/5/.test(home.txt.replace(/\s/g, '')), JSON.stringify(home));
  await pg.evaluate(() => document.querySelector('#MOB_OV .m196-card').click()); await pg.waitForTimeout(300);
  const L = await pg.evaluate(() => Array.from(document.querySelectorAll('#MOB_OV .m196-row')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
  t('② 학생 5줄 · 안 낸 학생(○○라: 둘 다 ✗)이 맨 위', L.length === 5 && /○○라/.test(L[0]), JSON.stringify(L));
  const row = (nm) => L.find((x) => x.indexOf(nm) >= 0) || '';
  t('③ ○○가: 녹음 ✓ · 2개 / 플래너 ✓ 21:10 · 2장 · 확인함', /🎙 ✓ \d\d:\d\d · 2개/.test(row('○○가')) && /📒 ✓ 21:10 · 2장 · 확인함/.test(row('○○가')), row('○○가'));
  t('④ ○○나: 내일 01:30 낸 플래너 = 오늘 것(새벽) · 녹음 ✗', /📒 ✓ 01:30 새벽/.test(row('○○나')) && /🎙 ✗ 안 냄/.test(row('○○나')), row('○○나'));
  t('⑤ ○○다: 오늘 01:00 낸 플래너는 어제 것 → ✗ · 녹음 ✓', /📒 ✗ 안 냄/.test(row('○○다')) && /🎙 ✓/.test(row('○○다')), row('○○다'));
  t('⑥ ○○마: 학생 코드 없음 표시 · 플래너 ✓ 15:30', /코드 없음/.test(row('○○마')) && /📒 ✓ 15:30/.test(row('○○마')), row('○○마'));
  await pg.evaluate(() => m196F('nopl')); await pg.waitForTimeout(200);
  const nopl = await pg.evaluate(() => document.querySelectorAll('#MOB_OV .m196-row').length);
  t('⑦ «플래너 안 냄» 칩 → 2명(○○다·○○라)', nopl === 2, String(nopl));
  await pg.evaluate(() => m196F('all')); await pg.waitForTimeout(200);
  if (SHOT) await pg.screenshot({ path: SHOT, fullPage: false });
  await pg.evaluate(() => mobGo('home')); await pg.waitForTimeout(200);
  t('⑧ ‹ 홈 으로 돌아오면 홈 카드', await pg.evaluate(() => !!document.querySelector('#MOB_OV .m196-card')), '');
  t('⑨ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
