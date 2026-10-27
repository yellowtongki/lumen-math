#!/usr/bin/env node
/* 학원앱 v19-150 검사 — 💡 아하 리그 등급: 시즌 동안 한 번 오른 등급 유지 (원장 2026-10-22 「예전 등급 유지되게 고쳐줘」)
 *   가짜 서버(lumen_store aha_tier_best) · 외부망 차단 · 가짜 코드(AAA111 …)
 *   ① 서버 기록(knowledge) 있고 지금 평균이 낮아 inquirer → knowledge 로 보임
 *   ② 지금 계산이 더 높으면(thinker) 그대로 + 기록을 올려 서버에 저장
 *   ③ 기록 없는 학생 · 지금 inquirer → inquirer, 저장 안 함(쓸데없는 줄 안 만듦)
 *   ④ 설정 «강등 있음»(demote:true) → 지금 계산만
 *   ⑤ 시즌 시작일이 바뀌면 기록 새로 · 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19150.js lumen_v19-150.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-150.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.addInitScript(() => {
    window.__W = []; window.__STORE = { aha_tier_best: { season: '2026-09-07', byCode: { AAA111: 'knowledge' } } };
    const mk = (tbl) => { const b = { f: [], op: 'select', select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; }, like() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; }, filter() { return b; }, single() { return b; }, maybeSingle() { return b; },
      update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; }, insert() { return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { window.__W.push({ key: r.key, value: JSON.parse(JSON.stringify(r.value)) }); }); return Promise.resolve({ error: null }); },
      then(r, j) { const data = tbl === 'lumen_store' && b.op === 'select' ? Object.keys(window.__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })) : []; return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    window.__FAKE = () => ({ from: mk, rpc: () => Promise.resolve({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, storage: { from: () => ({ upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } });
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { window.getSupaClient = window.__FAKE; TK150.data = null; TK150.loading = false; tk150Load(); }); await pg.waitForTimeout(300);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-150');
  t('서버 기록 읽음', await pg.evaluate(() => !!(TK150.data && TK150.data.byCode.AAA111 === 'knowledge')), JSON.stringify(await pg.evaluate(() => TK150.data)));
  const cfg = { seasonStart: '2026-09-07', demote: false, tiers: { know: { avg: 6, cnt: 5 }, think: { avg: 8, selfOrExplore: 3 }, reflect: { aha: 10, rec: 0 } } };
  const R = (row, c) => pg.evaluate(({ row, c }) => iblTierOf(row, c), { row, c: c || cfg });
  t('① 기록 knowledge · 지금 평균 5.2 → knowledge', (await R({ code: 'AAA111', avg: 5.2, qcnt: 14, self: 0, explore: 0, aha: 0, rec: 0 })) === 'knowledge');
  await pg.evaluate(() => { window.__W.length = 0; });
  t('② 지금 thinker → thinker', (await R({ code: 'BBB222', avg: 8.5, qcnt: 9, self: 2, explore: 1, aha: 0, rec: 0 })) === 'thinker');
  await pg.waitForTimeout(1800);
  const w = await pg.evaluate(() => window.__W.filter((x) => x.key === 'aha_tier_best'));
  t('② 기록 올려 서버 저장(BBB222 thinker · AAA111 그대로)', w.length === 1 && w[0].value.byCode.BBB222 === 'thinker' && w[0].value.byCode.AAA111 === 'knowledge', JSON.stringify(w));
  await pg.evaluate(() => { window.__W.length = 0; });
  t('③ 기록 없음 · inquirer → inquirer', (await R({ code: 'CCC333', avg: 2, qcnt: 3, self: 0, explore: 0, aha: 0, rec: 0 })) === 'inquirer');
  await pg.waitForTimeout(1800);
  t('③ 저장 안 함 · 기록에 안 생김', (await pg.evaluate(() => window.__W.length === 0 && !TK150.data.byCode.CCC333)));
  t('④ 강등 있음 → 지금 계산(inquirer)', (await R({ code: 'AAA111', avg: 5.2, qcnt: 14, self: 0, explore: 0, aha: 0, rec: 0 }, Object.assign({}, cfg, { demote: true }))) === 'inquirer');
  t('⑤ 새 시즌 → 기록 새로(inquirer)', (await R({ code: 'AAA111', avg: 5.2, qcnt: 14, self: 0, explore: 0, aha: 0, rec: 0 }, Object.assign({}, cfg, { seasonStart: '2026-12-01' }))) === 'inquirer' && (await pg.evaluate(() => TK150.data.season)) === '2026-12-01');
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
