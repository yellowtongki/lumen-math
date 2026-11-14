#!/usr/bin/env node
/* 학부모앱 v1-40 검사 — 📈 성적 추이 (시안 docs/mockup_parent_score_trend.html · 학원앱 v19-188 hist)
 *   가짜 서버(lumen_store) · 외부망 차단 · 가짜 이름(홍길동 AAA111) · 폰 화면
 *   pub_reports_AAA111.hist: 주간 10회(9/23~11/12 · 1회는 전국 등수 없음) · 일일 9회(학원 평균 1회 없음)
 *   ① 성적 탭 맨 위 카드(최근 전국 등수 있는 회차 · 378/823명 · 3등급 · 미니 막대 6) → 누르면 성적 추이
 *   ② 주간: 최근 8회 표 · 시험지 제목 · 등급 색 · 그래프 · 전체로 바꾸면 10회 ③ 일일: 학원 평균 이상 n/m · 차이 칩 · 시험지 제목
 *   ④ hist 없는 옛 발행(recent 만)도 그려짐 ⑤ 쓰기 없음(열어 본 기록 parent_open_ 빼고) · 버전 · parent.html 안 바뀜 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_p140.js parent_v1-40.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'parent_v1-40.html'));
const SHOT = process.env.P140_SHOT || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const WK = [['2026-09-23',88,72,124,830,'[중2] 주간 4회 · 일차부등식'],['2026-09-30',78,69,247,822,'[중2] 주간 5회'],['2026-10-07',85,73,181,819,'[중2] 주간 6회'],['2026-10-14',90,74,97,824,'[중2] 주간 7회'],['2026-10-21',75,70,288,817,'[중2] 주간 8회'],['2026-10-28',80,73,229,821,'[중2] 주간 9회'],['2026-11-04',70,68,378,823,'[중2] 주간 10회 · 삼각형의 성질'],['2026-11-06',60,null,null,null,'[중2] 주간 특강'],['2026-11-09',72,70,330,820,'[중2] 주간 11회'],['2026-11-12',66,64,401,818,'[중2] 주간 12회 · 외심']].map((x, i) => ({ d: x[0], s: x[1], avg: x[2], r: x[3], n: x[4], t: x[5], nat: i !== 7 }));
const DY = [['2026-10-29',40,55],['2026-10-30',87,79],['2026-11-03',63,60],['2026-11-04',58,null],['2026-11-05',47,52],['2026-11-06',66,58],['2026-11-09',75,70],['2026-11-10',41,49],['2026-11-11',80,71]].map((x) => ({ d: x[0], s: x[1], avg: x[2], t: '[중2] 일일 · ' + x[0].slice(5) }));
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.clock.setFixedTime(new Date('2026-11-10T20:00:00+09:00'));
  await pg.addInitScript((M) => {
    window.__KEYS = []; window.__W = [];
    window.__STORE = {
      or_studentdb: [{ id: 's1', name: '홍길동', lumen_rec_code: 'AAA111', grade: '중학교 2학년', group: 'T5' }],
      lumen_group_days: { T5: [1, 3, 5] },
      pub_reports_AAA111: { at: '2026-11-12T10:00:00Z', count: 3, url: '', recent: [{ date: '2026.11.12', score: '66', testType: 'weekly', rank: 401, total: 818, avgScore: 64, level: '4' }], hist: { v: 1, wk: M.wk, dy: M.dy } } };
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
  }, { wk: WK, dy: DY });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(600);
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  const P = (fn, a) => pg.evaluate(fn, a);
  const app = () => P(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));

  /* ① */
  await P(() => goTab('score')); await pg.waitForTimeout(200);
  const card = await P(() => { const c = document.querySelector('.p40card'); return c ? { txt: c.innerText.replace(/\s+/g, ' '), bars: c.querySelectorAll('.p40mini i').length, first: c === document.querySelector('#app .p40card, #app [class]') } : null; });
  t('① 성적 탭 맨 위 «📈 성적 추이» 카드 · 66점 · 401/818명(상위 49%) · 3등급 · 막대 6', !!card && /66점/.test(card.txt) && /401\/818명/.test(card.txt) && /3등급/.test(card.txt) && card.bars === 6, JSON.stringify(card));
  t('① 카드는 성적 탭 첫 카드(등수 카드보다 위)', await P(() => { const c = document.querySelector('.p40card'); const all = Array.from(document.querySelectorAll('#app *')); const k = document.querySelector('.kmc, .rkc, .amc'); return !!c && (!k || all.indexOf(c) < all.indexOf(k)); }), '');
  if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, 'score.png') }); }
  await pg.click('.p40card'); await pg.waitForTimeout(200);
  t('① 누르면 성적 추이 화면(strend)', (await P(() => P.tab)) === 'strend', '');
  /* ② */
  const wk = await P(() => ({ rows: Array.from(document.querySelectorAll('.p40r')).map((r) => r.innerText.replace(/\s+/g, ' ')), svg: document.querySelectorAll('.p40box svg').length, top: document.querySelector('.p40box').innerText.replace(/\s+/g, ' ') }));
  t('② 주간 최근 8회 · 최근이 위 · 시험지 제목 · 401/818명', wk.rows.length === 8 && /^11\/12/.test(wk.rows[0]) && /외심/.test(wk.rows[0]) && /401\/818명/.test(wk.rows[0]), JSON.stringify(wk.rows.slice(0, 3)));
  t('② 전국 등수 없는 회차(특강)는 «—»', wk.rows.some((x) => /11\/6/.test(x) && /특강/.test(x) && /—/.test(x)), JSON.stringify(wk.rows));
  t('② 위 요약: 66점 · 지난번보다 -6 · 상위 49% · 전국 평균 64점 · 그래프', /66점/.test(wk.top) && /지난번보다 -6/.test(wk.top) && /상위 49%/.test(wk.top) && /전국 평균 64점/.test(wk.top) && wk.svg === 1, wk.top.slice(0, 200));
  await P(() => p40Set('p', 'all')); await pg.waitForTimeout(100);
  t('② «전체» → 10회', (await P(() => document.querySelectorAll('.p40r').length)) === 10, '');
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'trend_wk.png'), fullPage: true });
  /* ③ */
  await P(() => { p40Set('p', '8'); p40Set('t', 'dy'); }); await pg.waitForTimeout(100);
  const dy = await P(() => ({ rows: Array.from(document.querySelectorAll('.p40r')).map((r) => r.innerText.replace(/\s+/g, ' ')), top: document.querySelector('.p40box').innerText.replace(/\s+/g, ' ') }));
  t('③ 일일 최근 8회 · 학원 평균 이상 5/7회(평균 없는 날 빼고)', dy.rows.length === 8 && /5 \/ 7회/.test(dy.top), dy.top.slice(0, 120));
  t('③ 날짜별 차이 칩 · 시험지 제목 · 평균 없는 날은 칩 없음', /^11\/11/.test(dy.rows[0]) && /\+9/.test(dy.rows[0]) && /일일/.test(dy.rows[0]) && dy.rows.some((x) => /^11\/4/.test(x) && !/[+-]\d/.test(x.replace(/11\/4|58점|일일 · 11-04/g, ''))), JSON.stringify(dy.rows));
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'trend_dy.png'), fullPage: true });
  /* ④ */
  await P(() => { delete P.pub.hist; P40.t = 'wk'; render(); });
  t('④ hist 없는 옛 발행 → recent 로 주간 1회', await P(() => document.querySelectorAll('.p40r').length === 1 && /401\/818명/.test(document.querySelector('.p40r').innerText)), '');
  /* ⑤ */
  t('⑤ PAR_VER v1-40', (await P(() => PAR_VER)) === 'v1-40', '');
  let same = false; try { same = execSync('git -C ' + ROOT + ' diff --quiet HEAD -- parent.html && echo same').toString().trim() === 'same'; } catch (e) {}
  t('⑤ parent.html 손대지 않음', same, '');
  t('⑤ 새 쓰기 없음 · 페이지 오류 없음', (await P(() => __W.filter((w) => !/parent_open_/.test(w)).length)) === 0 && errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
