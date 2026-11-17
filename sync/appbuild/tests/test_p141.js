#!/usr/bin/env node
/* 학부모앱 v1-41 검사 — 홈 📚 숙제 카드 C안 (시안 docs/mockup_parent_hwdate_c.html)
 *   가짜 서버 · 외부망 차단 · 가짜 이름(홍길동 AAA111) · 반 T5 = 월수금 · 숙제 확인 11/13(금) · 11/16(월)
 *   ① 11/17(화, 수업 없는 날): 11/16 결과가 크게 · 달력 11월 16 월요일 · 단계 % · 4단 색 · «다음 확인 11/18 (수)» · 띠 없음
 *   ② 11/18(수, 수업일 · 확인 전): 위 «오늘 확인» 띠 + 흐림 · 11/16 결과 그대로
 *   ③ 11/18 확인 뒤: 11/18 카드 · 다음 확인 줄 없음  ④ 버전 · 쓰기 없음 · 페이지 오류 없음
 *   실행: node sync/appbuild/tests/test_p141.js parent_v1-41.html  (P141_SHOT=폴더 → 그림) */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'parent_v1-41.html'));
const SHOT = process.env.P141_SHOT || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
async function open(br, when, hw){
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.clock.setFixedTime(new Date(when));
  await pg.addInitScript((M) => {
    window.__KEYS = []; window.__W = [];
    window.__STORE = {
      or_studentdb: [{ id: 's1', name: '홍길동', lumen_rec_code: 'AAA111', grade: '중학교 2학년', group: 'T5', lumen_hw: M.hw }],
      lumen_group_days: { T5: [1, 3, 5] } };
    const mk = (tbl) => { const b = { f: [], op: 'select', one: false,
      select() { return b; }, eq(k, v) { if (k === 'key') { __KEYS.push(v); b.f.push((x) => x === v); } return b; },
      in(k, a) { if (k === 'key') { a.forEach((x) => __KEYS.push(x)); b.f.push((x) => a.indexOf(x) >= 0); } return b; },
      like() { return b; }, ilike() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; },
      update() { b.op = 'u'; __W.push(tbl + ':update'); return b; }, delete() { b.op = 'd'; __W.push(tbl + ':delete'); return b; }, insert() { __W.push(tbl + ':insert'); return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => __W.push(tbl + ':' + r.key)); return Promise.resolve({ error: null }); },
      then(r, j) { let data = [];
        if (tbl === 'lumen_store' && b.op === 'select') data = Object.keys(__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(__STORE[k])) }));
        if (b.one) data = data[0] || null;
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    const fake = { from: mk, rpc: () => Promise.resolve({ data: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ list: () => Promise.resolve({ data: [], error: null }), upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }), createSignedUrl: () => Promise.resolve({ data: null }) }) } };
    const sbo = { createClient: () => fake };
    Object.defineProperty(window, 'supabase', { configurable: false, get: () => sbo, set: () => {} });
  }, { hw });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(600);
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  return { pg, errs, ctx };
}
const card = (pg) => pg.evaluate(() => { const c = document.querySelector('.p41card'); if (!c) return null;
  return { iso: c.getAttribute('data-iso'), txt: c.innerText.replace(/\s+/g, ' '), dim: c.classList.contains('p41dim'), band: !!c.querySelector('.p41today'), next: !!c.querySelector('.p41next'),
    st: Array.from(c.querySelectorAll('.p41stg .st')).map((x) => ({ s: x.getAttribute('data-s'), v: x.querySelector('.v').innerText.replace(/\s+/g, ''), bg: getComputedStyle(x).backgroundColor })),
    tot: (c.querySelector('.tot') || {}).innerText, pend: !!document.querySelector('.p38pendcard') }; });
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const HW = { '2026-11-13': { p: 100, c: 100, w: 60 }, '2026-11-16': { p: 100, c: 60, w: 30 } };
  /* ① */
  let o = await open(br, '2026-11-17T20:00:00+09:00', HW); let c = await card(o.pg);
  t('① 화요일: 옛 «확인 전» 카드 대신 11/16 결과 카드', !!c && c.iso === '2026-11-16' && !c.pend, JSON.stringify(c));
  t('① 달력 쪽지 11월 16 월요일', !!c && /11월 16 월요일/.test(c.txt), c && c.txt.slice(0, 80));
  t('① 단계 % 100 · 60 · 30', !!c && c.st[0].v === '100%' && c.st[1].v === '60%' && c.st[2].v === '30%', JSON.stringify(c && c.st));
  t('① 학원앱 4단 색 (진초록 · 연두 · 주황)', !!c && c.st[0].bg === 'rgb(187, 247, 208)' && c.st[1].bg === 'rgb(236, 252, 203)' && c.st[2].bg === 'rgb(254, 215, 170)', JSON.stringify(c && c.st));
  t('① 아하 해당 없음 · 종합 63% (세 단계 평균)', !!c && /해당없음/.test(c.st[3].v) && c.tot === '63%', JSON.stringify(c && [c.st[3], c.tot]));
  t('① «다음 확인 11/18 (수)» · 띠 없음 · 흐림 없음', !!c && c.next && /다음 확인 11\/18 \(수\)/.test(c.txt) && !c.band && !c.dim, c && c.txt);
  if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await o.pg.screenshot({ path: path.join(SHOT, 'p141_tue.png'), fullPage: true }); }
  t('① 쓰기 없음(열어 본 기록 빼고) · 오류 없음', (await o.pg.evaluate(() => __W.filter((w) => !/parent_open_/.test(w)))).length === 0 && !o.errs.length, JSON.stringify(o.errs));
  t('④ PAR_VER v1-41', (await o.pg.evaluate(() => PAR_VER)) === 'v1-41', '');
  await o.ctx.close();
  /* ② */
  o = await open(br, '2026-11-18T15:00:00+09:00', HW); c = await card(o.pg);
  t('② 수요일 확인 전: 11/16 결과 + «오늘 확인» 띠 + 흐림', !!c && c.iso === '2026-11-16' && c.band && c.dim && /오늘 11\/18 \(수\)/.test(c.txt), JSON.stringify(c));
  if (SHOT) await o.pg.screenshot({ path: path.join(SHOT, 'p141_wed_before.png'), fullPage: true });
  t('② 오류 없음', !o.errs.length, JSON.stringify(o.errs)); await o.ctx.close();
  /* ③ */
  o = await open(br, '2026-11-18T21:00:00+09:00', Object.assign({ '2026-11-18': { p: 100, c: 100, w: 100 } }, HW)); c = await card(o.pg);
  t('③ 확인 뒤: 11/18 카드 · 100% 진초록 · 다음 확인 줄 없음', !!c && c.iso === '2026-11-18' && c.tot === '100%' && !c.next && !c.band, JSON.stringify(c));
  if (SHOT) await o.pg.screenshot({ path: path.join(SHOT, 'p141_wed_after.png'), fullPage: true });
  t('③ 오류 없음', !o.errs.length, JSON.stringify(o.errs)); await o.ctx.close();
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})();
