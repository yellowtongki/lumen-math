#!/usr/bin/env node
/* 학원앱 v19-149 검사 — 🚑 리커버리: 고등부는 모든 테스트 (원장 2026-10-22 「우선은 체계가 잡히기 전에 고등부는 모든 테스트를 하자」)
 *   외부망 차단 · 가짜 학생(홍길동 중2 · 이순신 고1) · WK.tests 는 수집기 모양(WEEKLY · HIGH_TEST · CHAPTER)으로 심는다
 *   ① 고1 = HIGH_TEST 62점(85 미만) → 선발 · testHit.ttype HIGH_TEST
 *   ② 고1 의 단원 TEST(CHAPTER) 70점도 고등이면 읽음(더 최근이면 그것)
 *   ③ 중2 = HIGH_TEST·CHAPTER 는 안 읽음(WEEKLY 90점 → 선발 안 됨) · WEEKLY 60점이면 선발(예전 그대로)
 *   ④ 리커버리 학습지 재료(rcws3MyTests) 에 HIGH_TEST 포함
 *   ⑤ 안내문: 고1 «이번 주 테스트(…)에서» · 중2 «이번 주 주간테스트» · 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19149.js lumen_v19-149.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-149.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => {
    const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    students.length = 0;
    students.push({ id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' });
    students.push({ id: 'S2', name: '이순신', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'BBB222' });
    BP.mfList = [{ lumen_rec_code: 'AAA111', mf_student_id: 'M1', name: '홍길동' }, { lumen_rec_code: 'BBB222', mf_student_id: 'M2', name: '이순신' }];
    RC.cfg.minScore = 85; RC.cfg.weeks = 2; RC.cfg.range = null;
    const st = (sid, score, dd) => ({ sid, score, correct: Math.round(score / 5), total: 20, date: d(dd), wrongConcepts: [] });
    WK.tests = [
      { wid: 1, type: 'WEEKLY', title: '중2 주간', date: d(2), students: [st('M1', 90, 2)] },
      { wid: 2, type: 'HIGH_TEST', origType: 'SCHOOL_PREPARE_TEXTBOOK', title: '[공통수학1] 다항식-가상출판사', date: d(3), students: [st('M2', 62, 3), st('M1', 40, 3)] },
      { wid: 3, type: 'CHAPTER', title: '단원 TEST', date: d(1), students: [st('M2', 70, 1), st('M1', 30, 1)] }];
    const rows = rcRows();
    const by = (n) => rows.find((x) => x.st && x.st.name === n);
    const hi = by('이순신'), mid = by('홍길동');
    const out = { hi: hi && hi.testHit, mid: mid && mid.testHit };
    out.myTests = (typeof rcws3MyTests === 'function') ? rcws3MyTests('M2').map((x) => x.wid) : null;
    WK.tests[0].students = [st('M1', 60, 2)];
    const m2 = rcRows().find((x) => x.st && x.st.name === '홍길동');
    out.mid2 = m2 && m2.testHit;
    return out;
  });
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-149');
  t('①② 고1 → 최근 단원 TEST 70점(85 미만)으로 선발 · ttype CHAPTER', r.hi && r.hi.score === 70 && r.hi.ttype === 'CHAPTER', JSON.stringify(r.hi));
  t('③ 중2 → HIGH_TEST·CHAPTER 안 읽음 · WEEKLY 90점이라 시험 기준 없음', !r.mid, JSON.stringify(r.mid));
  t('③ 중2 WEEKLY 60점 → 선발(예전 그대로) · ttype WEEKLY', r.mid2 && r.mid2.score === 60 && r.mid2.ttype === 'WEEKLY', JSON.stringify(r.mid2));
  t('④ 리커버리 학습지 재료에 HIGH_TEST 포함', Array.isArray(r.myTests) && r.myTests.indexOf(2) >= 0, JSON.stringify(r.myTests));
  /* ① HIGH_TEST 단독 */
  const hiOnly = await pg.evaluate(() => { WK.tests = WK.tests.filter((x) => x.type !== 'CHAPTER'); const h = rcRows().find((x) => x.st && x.st.name === '이순신'); return h && h.testHit; });
  t('① 고1 HIGH_TEST 62점 → 선발 · ttype HIGH_TEST', hiOnly && hiOnly.score === 62 && hiOnly.ttype === 'HIGH_TEST', JSON.stringify(hiOnly));
  /* ⑤ 안내문 */
  const tx = await pg.evaluate(() => {
    window.nbkHas = () => false;
    const rows = rcRows();
    window.rcConfirmed = () => rows.filter((x) => x.testHit).map((x) => ({ k: x.stKey, name: x.st.name, score: x.testHit.score, rx: [], row: x, e: { on: true } }));
    rcOpenSms();
    return [0, 1].map((i) => (document.getElementById('rc-sms-' + i) || {}).value || '');
  });
  const hiTx = tx.find((x) => /순신이가/.test(x)) || '', midTx = tx.find((x) => /길동이가/.test(x)) || '';
  t('⑤ 고1 안내문 «이번 주 테스트(…)에서»', /이번 주 테스트\(\d+\/\d+ .\)에서 20문항 중 \d+문항을 맞혀 62점/.test(hiTx), hiTx);
  t('⑤ 중2 안내문 «이번 주 주간테스트»', /이번 주 주간테스트\(/.test(midTx), midTx);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
