#!/usr/bin/env node
/* 학원앱 v19-167 검사 — 등록부 합치기에서 퇴원·복귀는 «더 나중에 누른 쪽»이 이긴다 (가짜 학생 홍길동·박하나)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19167.js lumen_v19-167.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-167.html');
const WANT = (FILE.match(/v19-\d+/) || ['v19-167'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  const M = (local, cloud) => pg.evaluate(({ local, cloud }) => {
    _origSetItem('or_studentdb', JSON.stringify(local)); try { _memStore['or_studentdb'] = JSON.stringify(local); } catch (e) {}   /* 등록부는 메모리 사본이 먼저 읽힌다 */
    const out = applyCloudStudentDbMerge(cloud);
    const h = out.find((s) => s.name === '홍길동') || {};
    return { w: h.withdrawn, wd: h.withdrawnDate || '', at: h.withdrawnAt || '' };
  }, { local, cloud });
  const base = { id: 's1', name: '홍길동', grade: '초등학교 5학년', group: 'T3', lumen_rec_code: 'HGD001' };
  const other = { id: 's2', name: '박하나', grade: '중학교 1학년', group: 'M4', lumen_rec_code: 'PHN002' };
  const R = '2026-10-27T08:00:00.000Z';
  /* ① 옛 기기(퇴원 사본 · 시각 없음) + 서버(복귀 · 시각 있음) → 재원 */
  let r = await M([Object.assign({}, base, { withdrawn: true, withdrawnDate: '2026.06.26' }), other], [Object.assign({}, base, { withdrawn: false, withdrawnAt: R }), other]);
  t('옛 기기 «퇴원» 사본이 서버의 «복귀»를 덮지 못함 → 재원 · 퇴원 날짜 지움', r.w === false && !r.wd && r.at === R, JSON.stringify(r));
  /* ② 서버(복귀 시각 없음 · 옛 퇴원 날짜 남음) + 이 기기 «복귀»(시각) → 재원 · 날짜 지움 */
  r = await M([Object.assign({}, base, { withdrawn: false, withdrawnAt: R }), other], [Object.assign({}, base, { withdrawn: false, withdrawnDate: '2026.06.26' }), other]);
  t('이 기기 «복귀» + 서버에 남은 옛 퇴원 날짜 → 날짜 지움', r.w === false && !r.wd, JSON.stringify(r));
  /* ③ 새로 퇴원(이 기기, 더 나중) + 서버 복귀(더 앞) → 퇴원 */
  r = await M([Object.assign({}, base, { withdrawn: true, withdrawnDate: '2026.10.28', withdrawnAt: '2026-10-28T01:00:00.000Z' }), other], [Object.assign({}, base, { withdrawn: false, withdrawnAt: R }), other]);
  t('더 나중에 누른 «퇴원»은 이긴다', r.w === true && r.wd === '2026.10.28', JSON.stringify(r));
  /* ④ 시각 없는 예전 경우는 예전 규칙 그대로 (서버 퇴원 + 기기 말 없음 → 퇴원) */
  r = await M([Object.assign({}, base), other], [Object.assign({}, base, { withdrawn: true, withdrawnDate: '2026.06.26' }), other]);
  t('시각 없는 예전 경우: 서버 «퇴원» + 기기 말 없음 → 퇴원(v18-91 그대로)', r.w === true && r.wd === '2026.06.26', JSON.stringify(r));
  /* ⑤ 복귀·퇴원 단추가 시각을 적는다 */
  const B = await pg.evaluate(() => { students.length = 0; students.push({ id: 's9', name: '홍길동', lumen_rec_code: 'HGD001', withdrawn: true, withdrawnDate: '2026.06.26' }); window.saveStudents = () => {}; window.scheduleSync = () => {}; window.render = () => {};
    restoreStudent('s9'); const a = Object.assign({}, students[0]); withdrawStudent('s9'); const b = Object.assign({}, students[0]); return { a, b }; });
  t('«복귀» → withdrawn false · 날짜 지움 · withdrawnAt / «퇴원» → withdrawnAt 새로', B.a.withdrawn === false && !B.a.withdrawnDate && !!B.a.withdrawnAt && B.b.withdrawn === true && !!B.b.withdrawnAt && B.b.withdrawnAt >= B.a.withdrawnAt, JSON.stringify(B));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
