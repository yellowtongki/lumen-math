#!/usr/bin/env node
/* 학생앱 v2-164 검사 — 🔥 연속 기록: 홈 띠 · 연속 기록 화면 · TOP 5(전체 · 별명) · 달력 · 메달
 *   외부망 차단 · 가짜 Supabase(사진 목록 · submissions · streak_board 읽기만) · 가짜 학생 ○○○ AAA111(M4 · 월수금)
 *   + sync/streak_core.js 계산 검사(새벽 3시 · 녹음 수업일 · 12월부터 매일)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2164.js [student_v2-164.html] [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-164.html')), SHOT = process.argv[3] || '';
const STK = require(path.join(ROOT, 'sync', 'streak_core.js'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
/* ── 계산 ── */
(() => {
  const T = STK.todayK(), A = (n) => STK.addDay(T, n);
  const pd = STK.plannerDays(['X_' + A(-1) + '_2130_planner_today_t1.jpg', 'X_' + A(0) + '_0130_planner_today.jpg', 'X_' + A(-2) + '_2200_photo1.jpg']);
  t('core ① 새벽 1:30 사진은 전날 · planner 없는 이름은 뺌', pd[A(-1)] === 1 && !pd[A(0)] && !pd[A(-2)], JSON.stringify(pd));
  const has = {}; for (let i = 1; i <= 5; i++) has[A(-i)] = 1;
  const s = STK.streak(has, STK.everyDay);
  t('core ② 어제까지 5일 · 오늘 아직 → 5 (끊김 아님)', s.cur === 5 && !s.today && s.best === 5, JSON.stringify(s));
  const s2 = STK.streak(Object.assign({ [A(-7)]: 1 }, has), STK.everyDay);
  t('core ③ 6일 전 빈 날 → 최고는 5 그대로', s2.cur === 5 && s2.best === 5, JSON.stringify(s2));
  const rd = STK.recDays([{ id: A(-1) + '_1500', type: 'both' }, { id: A(-2) + '_1500', type: 'recording' }, { id: A(-3) + '_1500', type: 'photo' }]);
  t('core ④ 녹음 제출 날짜(both·recording만)', rd[A(-1)] && rd[A(-2)] && !rd[A(-3)], JSON.stringify(rd));
  const due = STK.recDue([1, 3, 5]);
  t('core ⑤ 녹음 내는 날: 월수금 · 2026-12-01부터 매일', due('20261116') && !due('20261117') && due('20261201') && due('20261202'), '');
})();
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const T = STK.todayK(), A = (n) => STK.addDay(T, n);
    const names = []; for (let i = 1; i <= 12; i++) names.push({ name: 'AAA111_' + A(-i) + '_2130_planner_today_tnone.jpg' });
    const subs = []; for (let i = 0; i <= 20; i++) { const k = A(-i); if ([1, 3, 5].indexOf(STK.dow(k)) >= 0) subs.push({ id: k + '_1500', type: 'both' }); }
    const board = { at: new Date().toISOString(), list: [
      { c: 'B1', n: '하얀 다람쥐', g: '중2', pl: 41, plB: 41, rc: 9, rcB: 9 }, { c: 'B2', n: '조용한 토끼', g: '초6', pl: 27, plB: 30, rc: 18, rcB: 18 },
      { c: 'AAA111', n: '무적 사자', g: '중1', pl: 12, plB: 12, rc: 9, rcB: 9 }, { c: 'B3', n: '작은 돌고래', g: '중1', pl: 9, plB: 9, rc: 2, rcB: 4 },
      { c: 'B4', n: '웃는 좌표', g: '고1', pl: 7, plB: 7, rc: 0, rcB: 3 }, { c: 'B5', n: '꿈꾸는 돌고래', g: '중3', pl: 3, plB: 5, rc: 7, rcB: 7 }, { c: 'B6', n: '○○○', g: '', pl: 0, plB: 2, rc: 0, rcB: 0 } ] };
    window.sb = { from(tbl) { const b = { select() { return b; }, in() { return b; }, eq() { return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, lt() { return b; }, gt() { return b; }, neq() { return b; }, is() { return b; }, not() { return b; }, like() { return b; }, ilike() { return b; }, range() { return b; }, match() { return b; }, contains() { return b; }, single() { return Promise.resolve({ data: null }); }, maybeSingle() { return Promise.resolve({ data: null }); }, order() { return b; }, limit() { return b; },
        then(r, j) { const data = tbl === 'lumen_store' ? [{ key: 'submissions_AAA111', value: subs }, { key: 'streak_board', value: board }] : []; return Promise.resolve({ data, error: null }).then(r, j); } }; return b; },
      storage: { from: () => ({ list: () => Promise.resolve({ data: names, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, rpc: () => Promise.resolve({}) };
    window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 1학년', group: 'M4' };
    go('screen-home');
  });
  await pg.evaluate(() => stkLoad(true)); await pg.waitForTimeout(400);
  const strip = await pg.evaluate(() => { const e = document.getElementById('stk-strip'); return { shown: e && e.style.display !== 'none', txt: e ? e.innerText.replace(/\s+/g, ' ') : '' }; });
  t('① 홈 띠: 12일 연속 · 오늘 아직! · 오늘 내면 13일 · 연속 랭킹 3위 · 녹음', strip.shown && /12\s*일 연속/.test(strip.txt) && /오늘 아직/.test(strip.txt) && /오늘 내면 13일/.test(strip.txt) && /연속 랭킹 3위/.test(strip.txt) && /녹음/.test(strip.txt), JSON.stringify(strip));
  t('① 띠는 공지 바로 밑 · 오늘 할 일 위', await pg.evaluate(() => { const s = document.getElementById('stk-strip'), nc = document.getElementById('hm-notice'), td = document.querySelector('.td4'); return !!(nc.compareDocumentPosition(s) & 4) && !!(s.compareDocumentPosition(td) & 4); }), '');
  /* 숙제 체크 = 오늘 할 일 셋째 칸 */
  await pg.evaluate(() => { SF.cfg = { hw: { on: true, off: [] } }; HW.loaded = true; HW.self = { byDate: {} }; HW.teach = { byDate: {} }; HW.days = { M4: [1, 3, 5] }; try { localStorage.removeItem('hw_fold_open'); } catch (e) {} hwHomeUpdate(); });
  const hw1 = await pg.evaluate(() => ({ tile: document.getElementById('td4-hw').style.display !== 'none', three: document.querySelector('.td4-row').classList.contains('td4-3'), card: document.getElementById('hw-home').style.display, st: document.getElementById('td4-hw-st').textContent, pc: document.getElementById('td4-hw-pc').textContent, after: !!(document.querySelector('.td4').compareDocumentPosition(document.getElementById('hw-home')) & 4) }));
  t('①-2 오늘 할 일 3칸(📚 숙제 체크 0% · 수업 전에) · 아래 숙제 카드는 접힘(숨김) · 카드 자리는 오늘 할 일 아래', hw1.tile && hw1.three && hw1.card === 'none' && /수업 전에/.test(hw1.st) && /^0%/.test(hw1.pc) && hw1.after, JSON.stringify(hw1));
  await pg.evaluate(() => hwTileTap()); await pg.waitForTimeout(150);
  const hw2 = await pg.evaluate(() => ({ card: document.getElementById('hw-home').style.display, st: document.getElementById('td4-hw-st').textContent, rows: document.querySelectorAll('#hw-home .hwk-r').length }));
  t('①-3 숙제 칸 누르면 아래에 숙제 체크 펼침(눈금 4줄)', hw2.card === 'block' && hw2.rows === 4 && /아래에서/.test(hw2.st), JSON.stringify(hw2));
  await pg.evaluate(() => hwTileTap()); await pg.waitForTimeout(100);
  t('①-4 다시 누르면 접힘', await pg.evaluate(() => document.getElementById('hw-home').style.display === 'none'), '');
  t('①-5 메뉴 4칸 한 줄', await pg.evaluate(() => { const t = Array.from(document.querySelectorAll('.h3-tiles4.hm4 > .h3-tile')).map((x) => Math.round(x.getBoundingClientRect().top)); return t.length === 4 && t.every((v) => Math.abs(v - t[0]) <= 2); }), JSON.stringify(await pg.evaluate(() => Array.from(document.querySelectorAll('.h3-tiles4.hm4 > .h3-tile')).map((x) => Math.round(x.getBoundingClientRect().top)))));
  if (SHOT) await pg.screenshot({ path: SHOT.replace(/\.png$/, '_home.png') });
  await pg.evaluate(() => document.getElementById('stk-strip').click()); await pg.waitForTimeout(400);
  const scr = await pg.evaluate(() => ({ act: document.getElementById('screen-streak').classList.contains('active'), txt: document.getElementById('stk-body').innerText.replace(/\s+/g, ' '),
    rows: Array.from(document.querySelectorAll('#stk-body .stk-rk')).map((r) => r.innerText.replace(/\s+/g, ' ')), me: (document.querySelector('#stk-body .stk-rk.me') || { innerText: '' }).innerText }));
  t('② 띠 누르면 «연속 기록» 화면', scr.act, '');
  t('③ 큰 카드 12일 연속 · 최고 12일 · 지금이 최고', /12일 연속/.test(scr.txt) && /최고 12일/.test(scr.txt) && /지금이 최고/.test(scr.txt), scr.txt.slice(0, 200));
  t('④ TOP 5 · 전체 학생 · 별명 · 1위 41일 · 나는 3위(주황)', scr.rows.length === 5 && /하얀 다람쥐/.test(scr.rows[0]) && /41일/.test(scr.rows[0]) && /나 · 무적 사자/.test(scr.me) && /전체 학생/.test(scr.txt), JSON.stringify(scr.rows));
  t('⑤ 메달: 7일 켜짐 · 14일 꺼짐', await pg.evaluate(() => { const m = Array.from(document.querySelectorAll('#stk-body .stk-ms b')); return m[0].className === 'on' && m[1].className === ''; }), '');
  t('⑥ 달력: 어제 칸 주황 · 오늘 점선', await pg.evaluate(() => { const T = STK.todayK(), y = STK.addDay(T, -1); const cells = Array.from(document.querySelectorAll('#stk-body .stk-cal span')); const f = (k) => cells.find((c) => c.textContent === String(+k.slice(6, 8))); return (y.slice(0, 6) !== T.slice(0, 6) || f(y).className === 'y') && f(T).className === 't'; }), '');
  if (SHOT) await pg.screenshot({ path: SHOT, fullPage: true });
  await pg.evaluate(() => stkTab('rc')); await pg.waitForTimeout(200);
  const rc = await pg.evaluate(() => ({ txt: document.getElementById('stk-body').innerText.replace(/\s+/g, ' '), rows: Array.from(document.querySelectorAll('#stk-body .stk-rk')).map((r) => r.innerText.replace(/\s+/g, ' ')) }));
  t('⑦ 녹음 탭: 수업일마다 · TOP 5 1위 조용한 토끼 18', /녹음 연속 제출/.test(rc.txt) && /조용한 토끼/.test(rc.rows[0]) && /18/.test(rc.rows[0]), JSON.stringify(rc.rows));
  await pg.evaluate(() => { stkMon(-1); }); await pg.waitForTimeout(100);
  t('⑧ ‹ 지난달 달력', await pg.evaluate(() => /년 \d+월/.test(document.querySelector('#stk-body .stk-mh').innerText)), '');
  await pg.evaluate(() => { window.isTest = true; stkPaintStrip(); });
  t('⑨ 테스트 모드면 띠 숨김', await pg.evaluate(() => document.getElementById('stk-strip').style.display === 'none'), '');
  t('⑩ 버전 v2-164 · 페이지 오류 없음', await pg.evaluate(() => STU_VER === 'v2-164') && errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
