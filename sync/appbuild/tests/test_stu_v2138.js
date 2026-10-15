#!/usr/bin/env node
/* 학생앱 v2-138 검사 — 진도 레이스 시상 발표 뒤 14일은 진도 탭이 보인다 (원장 2026-10-15)
 * 실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2138.js student_v2-138.html */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-138.html');
let pass = 0, fail = 0; const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https:\/\//, (r) => r.abort());
  await p.goto('file://' + FILE); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const board = { at: 'x', open: true, seasonId: 'S1', from: day(-60), to: day(-15), endedDays: 15, showDaysAfter: 7 };
    const o = {};
    RC.board = board; RC.awards = null; o.noAwards = lgRaceOn();
    RC.awards = { seasonId: 'S1', publishedAt: new Date(Date.now() - 3600000).toISOString() }; o.fresh = lgRaceOn();
    RC.awards = { seasonId: 'S1', publishedAt: new Date(Date.now() - 15 * 86400000).toISOString() }; o.old = lgRaceOn();
    RC.awards = { seasonId: 'S0', publishedAt: new Date().toISOString() }; o.other = lgRaceOn();
    RC.board = Object.assign({}, board, { to: day(3), endedDays: 0 }); RC.awards = null; o.running = lgRaceOn();
    RC.board = Object.assign({}, board, { endedDays: 5 }); o.within = lgRaceOn();
    RC.board = Object.assign({}, board, { open: false }); RC.awards = { seasonId: 'S1', publishedAt: new Date().toISOString() }; o.closed = lgRaceOn();
    RC.board = board; RC.awards = { seasonId: 'S1', publishedAt: new Date().toISOString() }; LG.tab = 'race';
    o.tabs = /lgTab\('race'\)/.test(lgTabsHtml());
    o.ver = STU_VER; return o;
  });
  t('버전 v2-138', r.ver === 'v2-138', r.ver);
  t('끝난 지 15일 · 발표 없음 → 진도 탭 숨김(예전과 같음)', r.noAwards === false);
  t('끝난 지 15일 · 오늘 발표 → 진도 탭 보임', r.fresh === true);
  t('발표한 지 15일 지남 → 숨김', r.old === false);
  t('다른 시즌 발표 → 숨김', r.other === false);
  t('진행 중 레이스 → 보임', r.running === true);
  t('끝난 지 5일(7일 안) → 보임', r.within === true);
  t('레이스 꺼 둠(open:false) → 발표 있어도 숨김', r.closed === false);
  t('리그 탭 줄에 「🏁 진도」 단추', r.tabs === true);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n결과: ' + pass + ' 통과 / ' + fail + ' 실패'); await b.close(); process.exit(fail ? 1 : 0);
})();
