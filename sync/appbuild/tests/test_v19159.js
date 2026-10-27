#!/usr/bin/env node
/* 학원앱 v19-159 검사 — ① 위쪽 탭 «📅 운영 달력» ② 홈 «오늘 운영 할 일» 카드 ③ 플래너 AI 일괄 분석 세 세트씩
 *   가짜 학생 홍길동·박하나·김새봄 · 가짜 계획(오늘 기준으로 만든다)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19159.js lumen_v19-159.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-159.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-159');
  const g = await pg.evaluate(() => GROUPS.map((x) => x.key + ':' + x.subs.map((s) => s.v).join(',')));
  t('위쪽 탭: 홈(대시보드만) 다음에 운영 달력', g[0] === 'home:home' && g[1] === 'opscal:opscal', g.slice(0, 3).join(' | '));
  t('밀린 일은 계획 넣은 날 1주 전부터', await pg.evaluate(() => { OPS.plan = { upd: '2026-10-26' }; const a = opsStart(); OPS.plan = null; return a === '2026-10-19'; }));
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const td = opsToday(), dd = +td.slice(8, 10);
    const PLAN = { upd: td, year: +td.slice(0, 4), themes: [], keywords: [], tax: [], schoolExtra: [],
      events: [{ id: 'e1', n: '가짜 행사', type: '간담회', date: opsAdd(td, 3), d: [[-3, '원장', '오늘 할 일 하나'], [-4, '실장', '어제 못 한 일'], [0, '원장', '사흘 뒤 행사']] }],
      regular: [{ rule: 'day', d: dd, L: 'money', who: '실장', t: '오늘 정기 업무', st: ['가', '나'] }],
      mkt: { channels: [], steps: {}, exam: [], recruit: [], special: [] }, manuals: [], ranks: { r1: '원장' } };
    window.__STORE = { ops_plan: PLAN, ops_checks: {} };
    window.getSupaClient = function(){ return { storage: { from(){ return { list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } }, from(){ const o = { _k: null, in(c, ks){ o._k = ks; return p; }, eq(c, k){ o._k = [k]; return p; },
      then(res, rej){ return Promise.resolve({ data: (o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })), error: null }).then(res, rej); } };
      const p = new Proxy(o, { get(tg, k){ if (k in tg) return tg[k]; return function(){ return p; }; } }); return p; } }; };
    window.supaSetItem = function(k, v){ window.__STORE[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(true); };
    CT.loaded = true; CT.ev = { items: [] }; CT.dd = []; CT.sc = { schools: [] };
    OPS.loaded = false; VIEW = 'home'; render();
  });
  await pg.waitForTimeout(800);
  const hc = await pg.evaluate(() => { const b = [...document.querySelectorAll('b')].find((x) => x.textContent === '📅 오늘 운영 할 일'); return b ? b.closest('div[style*="border-radius:16px"]').innerText : ''; });
  t('홈에 «📅 오늘 운영 할 일» 카드', !!hc, hc);
  const over = true;
  t('오늘 할 일 · 정기 업무 · 밀린 일(어제 것 1) · 앞으로 7일', /오늘 할 일 하나/.test(hc) && /오늘 정기 업무/.test(hc) && (!over || /밀린 일 1/.test(hc) && /어제 못 한 일/.test(hc)) && /앞으로 7일[\s\S]*사흘 뒤 행사/.test(hc), hc);
  t('«오늘 챙길 것» 개수에 운영 할 일이 더해짐', (await pg.evaluate(() => opsHomeCount())) === (over ? 3 : 2));
  await pg.evaluate(() => { const it = opsHomeList().today.find((x) => x.t === '오늘 할 일 하나'); return opsTick(it.id, true); }); await pg.waitForTimeout(300);
  t('홈에서 체크 → 서버 저장 · 개수 줄어듦', (await pg.evaluate(() => Object.keys(window.__STORE.ops_checks).length)) === 1 && (await pg.evaluate(() => opsHomeCount())) === (over ? 2 : 1));
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /운영 달력 열기/.test(x.textContent)); b.click(); }); await pg.waitForTimeout(300);
  t('«운영 달력 열기 ›» → 운영 달력 화면', await pg.evaluate(() => VIEW === 'opscal' && !!document.querySelector('.o8-cal')));
  await pg.evaluate(() => { VIEW = 'home'; render(); });
  t('위쪽 탭 단추 «📅 운영 달력»이 보이고 누르면 운영 달력', await pg.evaluate(() => { const b = document.getElementById('grp-opscal'); if (!b || !b.offsetParent) return false; const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none'; b.click(); return VIEW === 'opscal'; }));
  /* ③ 플래너 일괄 분석 */
  const r = await pg.evaluate(async () => {
    const td = opsToday().replace(/-/g, '');
    const mk = (id, n) => ({ id, name: id, lumen_rec_code: 'C' + id, lumen_planner_photos: Array.from({ length: n }, (_, i) => ({ setId: td + '_10' + i + '0', urls: ['u'], reviewed: false })) });
    students.length = 0; students.push(mk('A', 3), mk('B', 2), mk('C', 1), mk('D', 1));
    try { apiKey = 'sk-test'; } catch (e) { window.apiKey = 'sk-test'; } try { plannerAiProvider = 'claude'; } catch (e) {}
    let cur = 0, mx = 0; const busy = {}; let overlap = 0; const order = [];
    window._analyzeWithRetry = async function(stId, si, setId){ cur++; mx = Math.max(mx, cur); if (busy[stId]) overlap++; busy[stId] = 1; order.push(stId);
      await new Promise((res) => setTimeout(res, 120)); delete busy[stId]; cur--; const p = students.find((s) => s.id === stId).lumen_planner_photos.find((x) => x.setId === setId); p.analysis = {}; return { ok: true, rateLimited: false }; };
    const el = document.createElement('div'); el.id = 'bulk-planner-status'; document.body.appendChild(el);
    const t0 = Date.now(); await bulkAnalyzePlanner(); const ms = Date.now() - t0;
    return { mx, overlap, n: order.length, ms };
  });
  t('7세트 모두 분석 · 동시에 최대 3세트', r.n === 7 && r.mx === 3, JSON.stringify(r));
  t('같은 학생 세트는 겹치지 않음', r.overlap === 0, JSON.stringify(r));
  t('한 세트씩(840ms)보다 빠름', r.ms < 700, JSON.stringify(r));
  const r2 = await pg.evaluate(async () => {
    students.forEach((s) => s.lumen_planner_photos.forEach((p) => { delete p.analysis; }));
    let cur = 0, mx = 0, n = 0;
    window._analyzeWithRetry = async function(stId, si, setId){ const first = (++n === 1); cur++; mx = Math.max(mx, cur); await new Promise((res) => setTimeout(res, 50)); cur--;
      students.find((s) => s.id === stId).lumen_planner_photos.find((x) => x.setId === setId).analysis = {}; return { ok: true, rateLimited: first }; };
    const realTO = window.setTimeout; window.setTimeout = function(f, ms){ return realTO(f, ms >= 1000 ? 1 : ms); };
    await bulkAnalyzePlanner(); window.setTimeout = realTO;
    return { n, gap: window._plannerAdaptiveGap };
  });
  t('429 가 나면 10초 간격 모드로 바뀌고 끝까지 분석', r2.n === 7 && r2.gap === 10, JSON.stringify(r2));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
