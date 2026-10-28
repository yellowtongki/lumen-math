#!/usr/bin/env node
/* 학원앱 v19-156 검사 — 출결·보충: 결석한 그 날 보충 (원장 2026-10-24 「같은날 보충도 가능하게 수정」)
 *   가짜 학생 홍길동 · 10/24 결석 → 보충 날짜 10/24 → 결석 기록 그대로 + makeupDate=10/24 · makeupSame
 *   보충완료 · 되돌리기 · 보충 취소가 결석 칸을 지우거나 바꾸지 않는지 · 다른 날 보충은 예전 그대로
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19156.js lumen_v19-156.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-156.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; const alerts = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => { alerts.push(d.message()); d.accept(); });
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-156');
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    students.length = 0; students.push({ id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111', lumen_attendance: { '2026-10-24': { status: 'absent', reason: '병원' }, '2026-10-20': { status: 'absent', reason: '집안사정' } } });
    window.saveStudents = function(){}; try { window.scheduleSync = function(){}; } catch (e) {}
  });
  const setInputs = (abs, d, tm) => pg.evaluate(({ abs, d, tm }) => {
    ['att-dp-', 'att-tp-'].forEach((p, i) => { let el = document.getElementById(p + abs); if (!el) { el = document.createElement('input'); el.id = p + abs; document.body.appendChild(el); } el.value = i ? tm : d; });
  }, { abs, d, tm });
  const M = () => pg.evaluate(() => JSON.parse(JSON.stringify(students[0].lumen_attendance)));
  await setInputs('2026-10-24', '2026-10-24', '14:00'); alerts.length = 0;
  await pg.evaluate(() => attSetPlan('홍길동', '2026-10-24'));
  let m = await M();
  t('같은 날 보충 지정 — 막는 창 없음', alerts.length === 0, alerts.join(' | '));
  t('결석 기록 그대로(status absent · 사유 병원) + makeupDate 10/24 · 14:00 · makeupSame', m['2026-10-24'].status === 'absent' && m['2026-10-24'].reason === '병원' && m['2026-10-24'].makeupDate === '2026-10-24' && m['2026-10-24'].makeupTime === '14:00' && m['2026-10-24'].makeupSame === true, JSON.stringify(m['2026-10-24']));
  t('미보충 수에서 빠짐(10/20 하나만 남음)', (await pg.evaluate(() => attUnmadeCount(students[0]))) === 1);
  await pg.evaluate(() => attMarkDone('홍길동', '2026-10-24')); m = await M();
  t('보충완료 → makeupDone · 결석 status 는 absent 그대로', m['2026-10-24'].makeupDone === true && m['2026-10-24'].status === 'absent', JSON.stringify(m['2026-10-24']));
  await pg.evaluate(() => attUndoDone('홍길동', '2026-10-24')); m = await M();
  t('되돌리기 → makeupDone false · 결석 그대로', m['2026-10-24'].makeupDone === false && m['2026-10-24'].status === 'absent');
  await pg.evaluate(() => attCancelPlan('홍길동', '2026-10-24')); m = await M();
  t('보충 취소 → 결석 기록은 남고 보충 칸만 지워짐', m['2026-10-24'] && m['2026-10-24'].status === 'absent' && !m['2026-10-24'].makeupDate && !m['2026-10-24'].makeupSame, JSON.stringify(m['2026-10-24']));
  /* 다른 날 보충은 예전 그대로 */
  await setInputs('2026-10-20', '2026-10-27', '16:00'); await pg.evaluate(() => attSetPlan('홍길동', '2026-10-20')); m = await M();
  t('다른 날 보충(10/20 → 10/27) 예전 그대로 — 10/27 planned 칸 생김', m['2026-10-20'].makeupDate === '2026-10-27' && m['2026-10-27'] && m['2026-10-27'].status === 'planned' && m['2026-10-27'].makeupOf === '2026-10-20' && !m['2026-10-20'].makeupSame);
  await pg.evaluate(() => attMarkDone('홍길동', '2026-10-20')); m = await M();
  t('다른 날 보충 완료 → 10/27 done', m['2026-10-27'].status === 'done' && m['2026-10-20'].makeupDone === true);
  /* 달력 글자 */
  await setInputs('2026-10-24', '2026-10-24', '14:00'); await pg.evaluate(() => attSetPlan('홍길동', '2026-10-24'));
  const src = await pg.evaluate(() => attSetPlan.toString() + attCancelPlan.toString());
  t('코드: 같은 날이면 결석 칸 안에만 적는다', /makeupSame=true/.test(src) && /mk!==absKey/.test(src));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
