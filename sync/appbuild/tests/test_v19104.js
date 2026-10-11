#!/usr/bin/env node
/* 학원앱 v19-104 검사 — 🧱 3분할 틀 (원장 결정 2026-10-11 「공용 메뉴 접기 좋다 · 순서 그대로」, 시안 docs/mockup_layout3.html)
 *   ① PC 1400px: 세 번째 칸 #TOOL_PANEL 이 있고, 홈 · 도구 없는 화면에서는 0 폭(지금 두 칸 그대로) · RIGHT_TOOLS.vod 를 끼우면 280px 칸
 *   ② 홈은 공용 메뉴 그대로 · 자기 왼쪽 메뉴가 없는 화면(적중 분석 · 기출 분석)은 화면 이름 + 접힌 「▸ 공용 메뉴」(안에 rList) · 펼침이 l3_common_open 에 기억
 *   ③ 1100px: 도구 칸은 숨기고 「🛠 도구」 단추 → 서랍 · 420px: 새로 보이는 것 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19104.js lumen_v19-104.html
 *   그림: $SP/v19104_1400.png · $SP/v19104_1100.png
 *   외부망 차단 · 서버 없음(가짜). 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-104.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-104'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.getSupaClient = () => null; window.plToast = () => {}; window.fetch = () => Promise.reject(new Error('외부망 차단'));
    try { localStorage.removeItem('l3_common_open'); } catch (e) {}
    window.__sync = []; scheduleSync = (function (o) { return function (k) { window.__sync.push(k); }; })(scheduleSync);   /* 서버로 올라가는 키 기록 (실제로는 안 올림) */
  });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 120)), ms);
  /* 화면 하나 그리고 모양 읽기 */
  const look = (v) => pg.evaluate((v) => {
    VIEW = v; render();
    const tp = document.getElementById('TOOL_PANEL'), LC = document.getElementById('LIST_CONTENT');
    const det = LC.querySelector('details.common-menu'), fab = document.getElementById('L3_FAB');
    const cs = tp ? getComputedStyle(tp) : null;
    return { tp: !!tp, after: !!(tp && tp.previousElementSibling && tp.previousElementSibling.classList.contains('right-panel')),
      tpW: tp ? Math.round(tp.getBoundingClientRect().width) : -1, tpCssW: cs ? cs.width : '', tpDisp: cs ? cs.display : '', tpPos: cs ? cs.position : '',
      det: !!det, detOpen: !!(det && det.open), sum: det ? det.querySelector('summary').textContent : '', head: (LC.querySelector('.l3-vhead') || {}).textContent || '',
      inner: det ? det.querySelector('.l3-cm-body').innerHTML.length : 0, innerTxt: det ? det.querySelector('.l3-cm-body').textContent : '',
      lcTxt: LC.textContent, lcLen: LC.innerHTML.length, rLen: (function () { const d = document.createElement('div'); d.innerHTML = rList(); return d.innerHTML.length; })(), fab: !!fab, fabVis: !!(fab && getComputedStyle(fab).display !== 'none'), tools: tp ? tp.textContent : '' };
  }, v);

  /* ① 1400px — 홈 */
  const h1 = await look('home');
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('1400px 홈: 세 번째 칸 #TOOL_PANEL 이 .right-panel 바로 뒤에 있고 0 폭 (도구 없음)', h1.tp && h1.after && h1.tpW === 0, JSON.stringify(h1).slice(0, 300));
  const full = await pg.evaluate(() => rList().length);
  t('홈: 공용 메뉴 그대로 (접힘 상자 없음 · rList 전부)', !h1.det && h1.lcLen === full && /진도 현황/.test(h1.lcTxt), JSON.stringify([h1.det, h1.lcLen, full]));
  await pg.screenshot({ path: SP + '/v19104_home.png' });

  /* 도구 없는 화면 (위험 신호) — 칸 0 */
  const r1 = await look('risk');
  t('도구 없는 화면(위험 신호): 칸 0 폭', r1.tp && r1.tpW === 0 && !r1.fabVis, JSON.stringify([r1.tpW, r1.fabVis]));

  /* ② 적중 분석 · 기출 분석 — 접힌 공용 메뉴 */
  const e1 = await look('examhit');
  t('적중 분석: 왼쪽 맨 위 화면 이름 「🎯 적중 분석」 · 접힌 「▸ 공용 메뉴 (진도 현황 · 리커버리 · 명예의 전당 …)」',
    /🎯 적중 분석/.test(e1.head) && e1.det && !e1.detOpen && /▸ 공용 메뉴 \(진도 현황 · 리커버리 · 명예의 전당 …\)/.test(e1.sum), JSON.stringify([e1.head, e1.det, e1.detOpen, e1.sum]));
  t('적중 분석: 접힌 상자 안에 rList() 공용 메뉴 전부', e1.inner > 1000 && /진도 현황/.test(e1.innerTxt), String(e1.inner));
  const a1 = await look('examanal');
  t('기출 분석(자기 왼쪽 메뉴 없음): 같은 접힘 · 상자 안 = rList() 와 같은 내용', a1.det && !a1.detOpen && /📚 기출 분석/.test(a1.head) && a1.inner === a1.rLen, JSON.stringify([a1.det, a1.head, a1.inner, a1.rLen]));
  /* 자기 왼쪽 메뉴가 있는 화면은 그대로 */
  const u1 = await look('vod');
  const vodNav = await pg.evaluate(() => vodLeftNav().length);
  t('강의실(자기 왼쪽 메뉴): 손대지 않음 (접힘 상자 없음)', !u1.det && u1.lcLen === vodNav, JSON.stringify([u1.det, u1.lcLen, vodNav]));
  const sd = await look('list');
  t('학생 목록 화면(list): 공용 메뉴 그대로', !sd.det && sd.lcLen === sd.rLen, JSON.stringify([sd.det, sd.lcLen, sd.rLen]));

  /* 펼치기 → l3_common_open 기억 → 다시 그려도 펼친 채 → 접기 */
  await look('examanal');
  await pg.evaluate(() => document.querySelector('#LIST_CONTENT details.common-menu > summary').click()); await settle();
  const o1 = await pg.evaluate(() => ({ ls: localStorage.getItem('l3_common_open'), open: document.querySelector('#LIST_CONTENT details.common-menu').open }));
  const a2 = await look('examhit');
  t('공용 메뉴 펼치기 → l3_common_open=1 · 다른 화면에서도 펼친 채', o1.ls === '1' && o1.open && a2.detOpen && /▾ 공용 메뉴 접기/.test(a2.sum), JSON.stringify([o1, a2.detOpen]));
  /* 펼친 상자 안 단추가 살아 있다 (진도 현황 → bookprog) */
  const go1 = await pg.evaluate(() => { const b = [...document.querySelectorAll('#LIST_CONTENT details.common-menu button')].find((x) => /진도 현황/.test(x.textContent)); if (!b) return 'no'; b.click(); return VIEW; });
  t('펼친 공용 메뉴의 「진도 현황」 단추 → 그 화면으로', go1 === 'bookprog', go1);
  await look('examanal');
  await pg.evaluate(() => document.querySelector('#LIST_CONTENT details.common-menu > summary').click()); await settle();
  const o2 = await pg.evaluate(() => localStorage.getItem('l3_common_open'));
  const a3 = await look('examanal');
  t('다시 접기 → l3_common_open=0 · 접힌 채 그려짐', o2 === '0' && !a3.detOpen, JSON.stringify([o2, a3.detOpen]));
  /* 서버로 올라가는 동기화에 안 실림 */
  const sync = await pg.evaluate(() => (window.__sync || []).slice());
  t('l3_common_open 은 서버 동기화(scheduleSync)로 안 올라감 — 이 PC 에만', sync.indexOf('l3_common_open') < 0, JSON.stringify(sync));

  /* RIGHT_TOOLS 에 가짜 도구 → 칸이 열림 */
  await pg.evaluate(() => { window.RIGHT_TOOLS.vod = function (v) { return '<div class="l3-ttl">시험용</div><div class="l3-tool" id="dummy-tool"><b>가짜 도구 ' + v + '</b><button class="l3-btn" onclick="window.__dummyHit=(window.__dummyHit||0)+1">눌러 보기</button></div>'; }; });
  const v1 = await look('vod');
  const v1b = await pg.evaluate(() => { document.querySelector('#TOOL_PANEL #dummy-tool button').click(); return { hit: window.__dummyHit, hook: perViewRightTools('vod') !== null && perViewRightTools('home') === null }; });
  t('RIGHT_TOOLS.vod 가짜 도구 → 칸 280px · 내용 · 단추 동작 · perViewRightTools', v1.tpCssW === '280px' && v1.tpW > 200 && /가짜 도구 vod/.test(v1.tools) && v1b.hit === 1 && v1b.hook, JSON.stringify([v1.tpCssW, v1.tpW, v1b]));
  t('1400px 에서는 「🛠 도구」 단추 안 보임', !v1.fabVis, String(v1.fabVis));
  const lay = await pg.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const L = r('.left-panel'), R = r('.right-panel'), T = r('#TOOL_PANEL'); return { ok: L.right <= R.left + 1 && R.right <= T.left + 1 && Math.abs(T.height - R.height) < 2, L: Math.round(L.width), R: Math.round(R.width), T: Math.round(T.width) }; });
  t('세 칸이 왼쪽 → 가운데 → 도구 순서 · 같은 높이', lay.ok, JSON.stringify(lay));
  await pg.screenshot({ path: SP + '/v19104_1400.png' });
  /* 도구 오류는 칸 안에 빨간 글로 (화면 전체가 멈추지 않음) */
  await pg.evaluate(() => { window.RIGHT_TOOLS.risk = function () { throw new Error('일부러 낸 오류'); }; });
  const rk = await look('risk');
  t('도구 함수 오류 → 칸 안에 「도구 칸 오류」 (화면은 그대로)', /도구 칸 오류: 일부러 낸 오류/.test(rk.tools), rk.tools.slice(0, 80));
  await pg.evaluate(() => { delete window.RIGHT_TOOLS.risk; });

  /* ③ 1100px — 칸 숨김 · 🛠 단추 · 서랍 */
  await pg.setViewportSize({ width: 1100, height: 850 }); await settle(400);
  const m1 = await look('vod');
  t('1100px: 도구 칸 숨김 · 「🛠 도구」 단추 보임', m1.tpW === 0 && m1.tpDisp === 'none' && m1.fabVis, JSON.stringify([m1.tpW, m1.tpDisp, m1.fabVis]));
  await pg.evaluate(() => document.getElementById('L3_FAB').click()); await settle();
  const m2 = await pg.evaluate(() => { const tp = document.getElementById('TOOL_PANEL'), cs = getComputedStyle(tp); return { cls: tp.className, pos: cs.position, w: Math.round(tp.getBoundingClientRect().width), back: getComputedStyle(document.getElementById('L3_BACK')).display, txt: tp.textContent }; });
  t('「🛠 도구」 → 서랍(오른쪽에 붙은 칸) · 뒤 가림막 · 가짜 도구 내용', /l3-drawer/.test(m2.cls) && m2.pos === 'fixed' && m2.w > 200 && m2.back === 'block' && /가짜 도구 vod/.test(m2.txt), JSON.stringify(m2).slice(0, 200));
  await pg.screenshot({ path: SP + '/v19104_1100.png' });
  await pg.evaluate(() => document.getElementById('L3_BACK').click()); await settle();
  const m3 = await pg.evaluate(() => ({ cls: document.getElementById('TOOL_PANEL').className, disp: getComputedStyle(document.getElementById('TOOL_PANEL')).display }));
  t('가림막 누르면 서랍 닫힘', !/l3-drawer/.test(m3.cls) && m3.disp === 'none', JSON.stringify(m3));
  const m4 = await look('risk');
  t('1100px 도구 없는 화면: 단추 없음', !m4.fabVis && m4.tpW === 0, JSON.stringify([m4.fabVis, m4.tpW]));
  const m5 = await look('examanal');
  t('1100px 에서도 공용 메뉴 접힘', m5.det && !m5.detOpen, JSON.stringify([m5.det, m5.detOpen]));

  /* ④ 420px — 새로 보이는 것 없음 */
  await pg.setViewportSize({ width: 420, height: 860 }); await settle(400);
  const p1 = await look('examanal');
  const p2 = await look('vod');
  t('420px 기출 분석: 접힘 상자 없음 · 왼쪽은 예전 그대로 rList', !p1.det && !p1.head && p1.lcLen === p1.rLen, JSON.stringify([p1.det, p1.head, p1.lcLen, p1.rLen]));
  t('420px 강의실(도구 있음): 도구 칸·단추 안 보이고 비어 있음', p2.tpW === 0 && p2.tpDisp === 'none' && !p2.fabVis && p2.tools === '', JSON.stringify([p2.tpW, p2.tpDisp, p2.fabVis, p2.tools.length]));
  await pg.screenshot({ path: SP + '/v19104_420.png' });

  /* 다시 넓히면 구간이 바뀌어 저절로 다시 그림 */
  await pg.setViewportSize({ width: 1400, height: 900 }); await settle(500);
  const w1 = await pg.evaluate(() => ({ v: VIEW, w: Math.round(document.getElementById('TOOL_PANEL').getBoundingClientRect().width) }));
  t('창을 다시 1400px 로 → 도구 칸 저절로 다시 보임', w1.v === 'vod' && w1.w > 200, JSON.stringify(w1));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
