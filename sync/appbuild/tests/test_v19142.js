#!/usr/bin/env node
/* 학원앱 v19-142 검사 — 💳 수강료 3분할 (원장 2026-10-20 「오른쪽 접기 넣고 위쪽 탭 없애서 만들어」)
 *   가짜 서버(lumen_store 흉내) · 외부망 차단 · 가짜 학생(○○○) · 가짜 결제선생 자료(6개월 합계)
 *   ① PC 1366: 왼쪽 수강료 칸 일곱(점검 건수 배지) · 기간 칩 · 지난달 한눈에 · 바로 가기 · 접힌 공용 메뉴
 *      가운데 위쪽 칩 줄(#pay-tabs) 없음 · 왼쪽 칸 누르면 가운데가 그 칸으로
 *   ② 오른쪽 통계: 매출·고정비·변동비·손익분기·순이익(finRangeStat 와 같은 값) · 추세 막대 6개 · 다음 달 예상 · 챙길 것 → 누르면 그 칸
 *   ③ 접기 ▸ → 도구 칸 52px 띠(순이익) · 이 PC 기억(tu_right_fold) · 다시 그려도 접힘 · ◂ 통계 → 펼침
 *   ④ 기간 칩 「최근 3개월」 → 오른쪽 손익이 3개월 합 · 「지난달」→ 학생별 납부 달도 지난달
 *   ⑤ PC 1180: 도구 서랍(🛠 도구 단추) 안에 통계 · 접기 단추 없음 / 폰 390: 위쪽 칩 줄 그대로 · 왼쪽 메뉴 없음
 *   ⑥ 서버에 쓴 것 없음 · 가로 넘침 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19142.js lumen_v19-142.html
 *   그림: $SP/v19142_open.png · v19142_fold.png */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-142.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-142'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '고등학교 1학년', school: '범박고등학교', group: 'H1', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '초등학교 6학년', school: '옥길초등학교', group: 'E6', lumen_rec_code: 'AAA333', lumen_planner: {} }];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: 'Asia/Seoul' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    /* 가짜 결제선생 — 이달까지 6개월 */
    const ms = payRecentMonths(6), by = {};
    ms.forEach((m, i) => { const sales = [0, 0, 7420000, 8880000, 12370000, 9830000][5 - i] || 9000000;
      by[m] = { sales: { total: sales }, billed: { count: 10, amount: sales + 400000 }, paid: { count: 9, amount: sales }, unpaid: { count: 1, amount: 400000 } }; });
    const SEED = { pay_monthly: { updated: '2026-10-19T14:04:00Z', byMonth: by }, pay_bills: { items: [] }, pay_payments: { items: [] }, pay_students: { items: [] },
      fin_cfg: { updated: '', fixed: [{ id: 'fx1', name: '임대료', amount: 1000000, from: '', to: '', memo: '' }], varByMonth: {}, goal: { monthly: 0 }, ownerPay: 0 } };
    window.T = { store: clone(SEED), w: [] };
    const mk = (tbl) => { const b = { f: [], one: false, op: 'select',
      select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; }, like() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
      insert() { T.w.push({ tbl, op: 'insert' }); return Promise.resolve({ data: null, error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => T.w.push({ tbl, op: 'put', key: r.key })); return Promise.resolve({ data: null, error: null }); },
      then(r, j) { if (b.op !== 'select') T.w.push({ tbl, op: b.op }); if (tbl !== 'lumen_store' || b.op !== 'select') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
        const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]) }));
        return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } }; return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
    try { localStorage.removeItem('tu_right_fold'); } catch (e) {}
    PAY.loaded = false; PAY.tab = 'stu'; VIEW = 'tuition'; render();
  }, { STUDENTS });
  await pg.waitForTimeout(800);
  const P = (fn, a) => pg.evaluate(fn, a);
  const S = () => P(() => {
    const lc = document.getElementById('LIST_CONTENT'), tp = document.getElementById('TOOL_PANEL');
    return { tabs: [...lc.querySelectorAll('[data-tu-tab]')].map((b) => b.dataset.tuTab + (b.classList.contains('on') ? '*' : '') + ((b.querySelector('.n') || {}).textContent || '')),
      ranges: [...lc.querySelectorAll('[data-tu-range]')].map((b) => b.dataset.tuRange + (b.classList.contains('on') ? '*' : '')),
      last: !!lc.querySelector('#tu-last'), go: !!lc.querySelector('#tu-open-payssam') && !!lc.querySelector('#tu-reload'), common: !!lc.querySelector('#L3_COMMON'),
      payTabs: !!document.querySelector('#pay-tabs'), tab: PAY.tab, tpW: tp ? parseFloat(getComputedStyle(tp).width) : -1   /* 앱 전체 확대(zoom) 때문에 화면 크기 대신 CSS 폭 */, tpCls: tp ? tp.className : '',
      kpi: tp ? [...tp.querySelectorAll('.tu-kpi b')].map((b) => b.textContent) : [], bars: tp ? tp.querySelectorAll('.tu-bar').length : 0,
      fc: !!(tp && tp.querySelector('#tu-fc')), todo: tp ? [...tp.querySelectorAll('[data-tu-go]')].map((b) => b.dataset.tuGo) : [], fold: !!(tp && tp.querySelector('#tu-fold')), unfold: !!(tp && tp.querySelector('#tu-unfold')),
      over: document.documentElement.scrollWidth - window.innerWidth };
  });
  t('버전 ' + WANT, (await P(() => APP_VER)) === WANT);
  t('자료 불러옴', await P(() => PAY.loaded && !PAY.err));
  let s = await S();
  t('① 왼쪽 수강료 칸 일곱 · 지금 칸(학생별 납부) 표시 · 점검 배지', s.tabs.length === 7 && s.tabs[1].indexOf('stu*') === 0 && /^chk\d+/.test(s.tabs[2]), JSON.stringify(s.tabs));
  t('① 기간 칩 4 · 지난달 한눈에 · 바로 가기 · 접힌 공용 메뉴', s.ranges.length === 4 && s.ranges[0] === 'm0*' && s.last && s.go && s.common, JSON.stringify(s));
  t('① 가운데 위쪽 칩 줄 없음', !s.payTabs);
  await pg.click('[data-tu-tab="chk"]'); await pg.waitForTimeout(200);
  s = await S(); t('① 왼쪽 「점검」 → 가운데 점검 칸', s.tab === 'chk' && s.tabs[2].indexOf('chk*') === 0, s.tab);
  const st = await P(() => { const x = finRangeStat(); return [finMan(x.sales), finMan(x.fixed), finMan(x.vari), finMan(x.net)]; });
  t('② 오른쪽 손익 = finRangeStat (매출·고정·변동·순이익)', s.kpi[0] === st[0] && s.kpi[1] === st[1] && s.kpi[2] === st[2] && s.kpi[4] === st[3] && s.kpi.length === 5, JSON.stringify([s.kpi, st]));
  t('② 추세 막대 6 · 다음 달 예상 · 접기 단추 · 도구 칸 280 이상', s.bars === 6 && s.fc && s.fold && s.tpW >= 280, JSON.stringify(s));
  t('② 챙길 것: 미납 → 학생별 납부 · 점검 · 인건비 → 고정비', s.todo.indexOf('stu') >= 0 && s.todo.indexOf('chk') >= 0 && s.todo.indexOf('cost') >= 0, JSON.stringify(s.todo));
  await pg.click('#tu-todo [data-tu-go="cost"]'); await pg.waitForTimeout(200);
  t('② 챙길 것 누르면 그 칸', (await P(() => PAY.tab)) === 'cost');
  await pg.screenshot({ path: path.join(SP, 'v19142_open.png') });
  /* ③ 접기 */
  await pg.click('#tu-fold'); await pg.waitForTimeout(250);
  s = await S();
  t('③ 접기 → 52px 띠 · 순이익만 · 기억', Math.round(s.tpW) === 52 && s.unfold && s.kpi.length === 0 && /tu-folded/.test(s.tpCls) && (await P(() => localStorage.getItem('tu_right_fold'))) === '1', JSON.stringify(s));
  t('③ 띠에 순이익 글자', /순이익/.test(await P(() => document.getElementById('tu-unfold').innerText)));
  await P(() => render()); await pg.waitForTimeout(150);
  t('③ 다시 그려도 접힘', Math.round((await S()).tpW) === 52);
  await pg.screenshot({ path: path.join(SP, 'v19142_fold.png') });
  await P(() => { VIEW = 'examhit'; render(); }); await pg.waitForTimeout(200);
  t('③ 다른 화면 도구 칸은 접힘 영향 없음', !/tu-folded/.test(await P(() => (document.getElementById('TOOL_PANEL') || {}).className || '')));
  await P(() => { VIEW = 'tuition'; render(); }); await pg.waitForTimeout(200);
  await pg.click('#tu-unfold'); await pg.waitForTimeout(250);
  s = await S(); t('③ ◂ 통계 → 다시 넓게 · 숫자 보임', s.tpW >= 280 && s.kpi.length === 5 && (await P(() => localStorage.getItem('tu_right_fold'))) === '0', JSON.stringify(s.tpW));
  /* ④ 기간 */
  await pg.click('[data-tu-range="r3"]'); await pg.waitForTimeout(200);
  const r3 = await P(() => { const ms = payRangeMonths(); let x = 0; ms.forEach((m) => { x += finMonth(m).sales; }); return { n: ms.length, sales: finMan(x) }; });
  s = await S(); t('④ 최근 3개월 → 오른쪽 매출 = 3개월 합', r3.n === 3 && s.kpi[0] === r3.sales && s.ranges[2] === 'r3*', JSON.stringify([r3, s.kpi[0]]));
  await pg.click('[data-tu-range="m1"]'); await pg.waitForTimeout(200);
  t('④ 지난달 → 학생별 납부·점검 달도 지난달', (await P(() => PAY.ym)) === (await P(() => payRecentMonths(2)[1])));
  t('⑥ PC 1366 가로 넘침 없음', (await S()).over <= 0);
  /* ⑤ 1180 서랍 · 폰 */
  await pg.setViewportSize({ width: 1180, height: 860 }); await pg.waitForTimeout(500);
  s = await S();
  t('⑤ PC 1180: 위쪽 칩 줄 없음 · 서랍 안 통계 · 접기 단추 없음', !s.payTabs && s.kpi.length === 5 && !s.fold && s.over <= 0 && (await P(() => !!document.querySelector('#L3_FAB.on'))), JSON.stringify(s));
  await P(() => localStorage.setItem('tu_right_fold', '1')); await P(() => render()); await pg.waitForTimeout(150);
  t('⑤ PC 1180 에선 접어 둬도 서랍에 다 보임', (await S()).kpi.length === 5);
  await P(() => localStorage.setItem('tu_right_fold', '0'));
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(500);
  s = await S();
  t('⑤ 폰 390: 위쪽 칩 줄 그대로 · 왼쪽 수강료 메뉴 없음', s.payTabs && s.tabs.length === 0, JSON.stringify(s));
  t('⑥ 서버에 쓴 것 없음', (await P(() => T.w.filter((x) => x.tbl === 'lumen_store').length)) === 0, JSON.stringify(await P(() => T.w)));
  t('⑥ 페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
