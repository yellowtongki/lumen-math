#!/usr/bin/env node
/* 학원앱 v19-112 검사 (2) — 🏫 학원 달력에 학교 일정 (원장 2026-10-12 「학교알리미에서 학교 일정을 읽고 학원 달력에 넣자」)
 *   실행: SP=<임시> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19112_cal.js lumen_v19-112.html
 *   가짜 서버 · 외부망 차단 · 학생 실명 없음 */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-112.html'); const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0; const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
const STORE = {
  lumen_events: { items: [{ id: 'e1', kind: 'off', title: '휴원', from: '2026-10-15', to: '2026-10-15', pub: true, target: { schools: [], grades: [], groups: [] } }] },
  school_calendar: { at: '2026-10-12T00:00:00Z', year: 2026, schools: [
    { name: '옥길중학교', short: '옥길중', kind: '중', exams: [{ from: '2026-11-13', to: '2026-11-17', label: '2학기 기말' }],
      events: [{ from: '2026-10-19', to: '2026-10-19', days: 1, name: '2학년 진로체험', kind: 'trip', grades: [2] }, { from: '2026-10-23', to: '2026-10-23', days: 1, name: '체육한마당', kind: 'event', grades: null }] },
    { name: '소사고등학교', short: '소사고등', kind: '고', exams: [], events: [{ from: '2026-10-26', to: '2026-10-26', days: 1, name: '재량휴업일', kind: 'vac', off: true, grades: [2] }] },
    { name: '먼학교', short: '먼학교', kind: '중', exams: [], events: [{ from: '2026-10-20', to: '2026-10-20', name: '다른 학교 행사', kind: 'event' }] } ] } };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    window.T = { store: STORE };
    window.getSupaClient = () => ({ from: () => ({ select: () => ({ in: (k, arr) => Promise.resolve({ data: arr.filter((x) => T.store[x]).map((x) => ({ key: x, value: JSON.parse(JSON.stringify(T.store[x])) })) }), eq: (k, v) => Promise.resolve({ data: T.store[v] ? [{ key: v, value: T.store[v] }] : [] }) }), upsert: () => Promise.resolve({ error: null }) }) });
    window.activeStudents = () => [{ id: 'S1', name: '○○○', school: '옥길중학교', grade: '중2' }, { id: 'S2', name: '○○○', school: '소사고등학교', grade: '고2' }];
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1300px;background:#eef2f8'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rCal(); };
    CT.y = 2026; CT.m = 10; CT.loaded = false; ctLoad(true);
  }, STORE);
  await pg.waitForTimeout(400); await pg.evaluate(() => render());
  const o = await pg.evaluate(() => { const b = document.getElementById('tdemo'); return { html: b.innerText, ev19: ctEventsOn('2026-10-19').map((e) => e.title), ev20: ctEventsOn('2026-10-20').map((e) => e.title), ev26: ctEventsOn('2026-10-26').map((e) => e.title + '|' + e.kind) }; });
  t('옥길중 10/19 「🚌 옥길중 2학년 진로체험 (2학년)」 띠', o.ev19.some((x) => /🚌 옥길중 2학년 진로체험 \(2학년\)/.test(x)) && /옥길중 2학년 진로체험/.test(o.html), JSON.stringify(o.ev19));
  t('우리 학생 없는 학교 일정은 안 보임', o.ev20.length === 0, JSON.stringify(o.ev20));
  t('소사고 재량휴업은 kind sch (학원 휴원 아님)', o.ev26.length === 1 && /sch$/.test(o.ev26[0]) && /🏖 소사고/.test(o.ev26[0]), JSON.stringify(o.ev26));
  t('범례 「학교 일정(학교알리미 …)」', /학교 일정\(학교알리미/.test(o.html));
  const o2 = await pg.evaluate(() => { CT.filter = '_ev'; const a = ctEventsOn('2026-10-19').length; CT.filter = '소사고'; const b = ctEventsOn('2026-10-19').length, c = ctEventsOn('2026-10-26').length; CT.filter = ''; return [a, b, c]; });
  t('「학원 일정만」이면 학교 일정 숨김 · 학교 칩 거르기', o2[0] === 0 && o2[1] === 0 && o2[2] === 1, JSON.stringify(o2));
  const o3 = await pg.evaluate(() => ctEventsOn('2026-10-15').map((e) => e.kind));
  t('학원 휴원 일정은 그대로', JSON.stringify(o3) === '["off"]', JSON.stringify(o3));
  await pg.screenshot({ path: SP + '/v19112_cal.png', fullPage: true });
  t('페이지 오류 없음', errs.length === 0, errs.join(' / '));
  await br.close(); console.log('\n' + pass + ' 통과 · ' + fail + ' 실패'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
