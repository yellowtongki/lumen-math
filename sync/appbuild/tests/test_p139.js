#!/usr/bin/env node
/* 학부모앱 v1-39 검사 — 📑 월간 학습 보고서 (시안 docs/mockup_monthly_report.html)
 *   가짜 서버(lumen_store) · 외부망 차단 · 가짜 이름(홍길동 AAA111) · 폰 화면 · 지금 = 2026-11-10 20:00 한국
 *   mfrep_pub_AAA111: 10월(11/10 공개 · 숙제·아하·플래너 다 있음) · 9월(루멘 기록 없음)
 *   ① 로그인 질의에 mfrep_pub_AAA111 · 쓰기 없음
 *   ② 홈 「📑 10월 학습 보고서가 도착했어요」 → 누르면 보고서 화면 · 이 폰에 «봄» 기록 → 홈 카드 사라짐
 *   ③ 리포트 탭 달별 줄(10월 위) · 예전 PDF 칸 대신
 *   ④ 보고서 화면 — 한눈에(정답률·문항·등급·전국·지난달 변화) · 3달 · 단원(많이 푼 순·70 미만 주황·8개까지) · 난이도(문항 0 뺌) · 역량 · 교재 5 + 학습지 · 의견 · 루멘 기록
 *   ⑤ 9월로 바꾸면 9월 숫자 · 루멘 기록 칸 없음 ⑥ 14일 지난 공개는 도착 카드 없음 · 다른 아이 코드 자료는 안 보임
 *   ⑦ 버전 · parent.html 안 바뀜 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_p139.js parent_v1-39.html   (P139_SHOT=/폴더 → 그림) */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'parent_v1-39.html'));
const SHOT = process.env.P139_SHOT || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const MONTH = (o) => Object.assign({ v: 1, at: '2026-11-10T05:00:00.000Z', reportId: 1, title: 't', rate: 79, count: 1092, rank: 3, level: 2, rateCmp: 74, prevRate: 78, prevM: '2026-09',
  months: [{ m: '2026-08', rate: 73, cmp: 73, n: 800 }, { m: '2026-09', rate: 78, cmp: 74, n: 950 }, { m: '2026-10', rate: 79, cmp: 74, n: 1092 }],
  weeks: [], levels: [{ l: 1, rate: 84, cmp: 88, n: 300 }, { l: 4, rate: 52, cmp: 66, n: 40 }, { l: 5, rate: 0, cmp: 55, n: 0 }],
  chapters: [{ name: '정수와 유리수', n: 20, rate: 90 }, { name: '일차함수', n: 120, rate: 64 }, { name: 'A3', n: 5, rate: 100 }, { name: 'A4', n: 6, rate: 100 }, { name: 'A5', n: 7, rate: 100 }, { name: 'A6', n: 8, rate: 100 }, { name: 'A7', n: 9, rate: 100 }, { name: 'A8', n: 10, rate: 100 }, { name: 'A9', n: 1, rate: 100 }],
  evals: [{ k: 'REASONING_ABILITY', name: '추론', rate: 77, cmp: 75, rank: 3 }],
  books: [{ title: '문제집B', kind: '시중 교재', from: 10, to: 40, n: 300, rate: 81 }, { title: '교과서A', kind: '교과서', from: 146, to: 147, n: 2, rate: 100 }],
  sheets: { n: 14, count: 273 }, comment: '이번 달 의견 글입니다.\n둘째 줄.',
  lumen: { hw: 90, hwN: 2, aha: 3, plan: 8.5, planN: 12 } }, o || {});
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
      mfrep_pub_AAA111: { code: 'AAA111', upd: '2026-11-10T05:00:00Z', months: { '2026-10': M.oct, '2026-09': M.sep } } };
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
  }, { oct: MONTH(), sep: MONTH({ at: '2026-10-05T05:00:00Z', rate: 78, count: 950, prevRate: 73, prevM: '2026-08', lumen: { hw: null, aha: null, plan: null }, comment: '9월 의견' }) });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(600);
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  const P = (fn, a) => pg.evaluate(fn, a);
  const app = () => P(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));

  /* ① */
  t('① 로그인 · 질의에 mfrep_pub_AAA111 · 새 쓰기 없음(원래 있던 열어 본 기록 parent_open_ 만)', (await P(() => P.st && P.st.name === '홍길동' && __KEYS.indexOf('mfrep_pub_AAA111') >= 0 && !!P.mpub)) && (await P(() => __W.filter((w) => !/parent_open_/.test(w)).length)) === 0, JSON.stringify(await P(() => __W)));

  /* ② */
  let tx = await app();
  t('② 홈 도착 카드 「10월 학습 보고서가 도착했어요 · 정답률 79% · 푼 문항 1092개」', /10월 학습 보고서가 도착했어요/.test(tx) && /정답률 79% · 푼 문항 1092개/.test(tx), tx.slice(0, 200));
  if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, 'home.png') }); }
  await pg.click('.p39arr'); await pg.waitForTimeout(200);
  t('② 누르면 보고서 화면(mrep · 10월) · 봄 기록 2026-10', (await P(() => P.tab === 'mrep' && P39.ym === '2026-10' && localStorage.getItem('p39_seen_AAA111') === '2026-10')), '');
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'report.png'), fullPage: true });

  /* ④ */
  tx = await app();
  t('④ 한눈에 — 79% · 1092 · 3등급 · 전국 74% · 9월보다 1%p 올랐어요', /79%\s*정답률/.test(tx) && /1092\s*푼 문항/.test(tx) && /3등급/.test(tx) && /전국 같은 학년 평균 74%/.test(tx) && /9월보다 1%p 올랐어요/.test(tx), tx.slice(0, 300));
  const bars = await P(() => Array.from(document.querySelectorAll('.p39card')).map((c) => ({ t: c.querySelector('.p39t').firstChild.textContent.trim(), rows: Array.from(c.querySelectorAll('.p39bar')).map((b) => ({ l: b.querySelector('.l').firstChild.textContent, v: b.querySelector('.v').textContent, low: !!b.querySelector('i.low'), cmp: !!b.querySelector('em') })) })));
  const card = (name) => bars.find((c) => c.t.indexOf(name) === 0) || { rows: [] };
  t('④ 최근 정답률 3달(8·9·10월) · 전국 세로줄', card('최근 정답률').rows.map((r) => r.l + r.v).join() === '8월73%,9월78%,10월79%' && card('최근 정답률').rows.every((r) => r.cmp), JSON.stringify(card('최근 정답률')));
  const ch = card('단원별 정답률').rows;
  t('④ 단원별 — 많이 푼 순 · 8개까지 · 일차함수 64% 주황', ch.length === 8 && ch[0].l === '일차함수' && ch[0].low && ch[1].l === '정수와 유리수' && !ch[1].low && ch.every((r) => r.l !== 'A9'), JSON.stringify(ch.map((r) => r.l)));
  t('④ 난이도 — 문항 0인 상 난이도 뺌', card('난이도별').rows.map((r) => r.l).join() === '하 난이도,중상 난이도', JSON.stringify(card('난이도별')));
  t('④ 수학 역량 — 추론 77%', card('수학 역량').rows.map((r) => r.l + r.v).join() === '추론77%', '');
  t('④ 공부한 것 — 문제집B p10~40 · 300문항 · 81% / 학습지 14장', /문제집B\s*p10~40 · 300문항 · 81%/.test(tx) && /학습지 14장\s*273문항/.test(tx), '');
  t('④ 선생님 의견(줄바꿈 그대로)', (await P(() => (document.querySelector('.p39q') || {}).innerHTML)) === '이번 달 의견 글입니다.<br>둘째 줄.', '');
  t('④ 루멘 기록 — 숙제 이행도 90% · 아하노트 질문 3개 · 플래너 8.5점', /90%\s*숙제 이행도/.test(tx) && /3개\s*아하노트 질문/.test(tx) && /8\.5점\s*플래너 평균/.test(tx), '');

  /* ⑤ */
  await P(() => p39Pick('2026-09')); await pg.waitForTimeout(100);
  tx = await app();
  t('⑤ 9월로 — 78% · 950 · 8월보다 5%p · 9월 의견 · 루멘 기록 칸 없음', /78%\s*정답률/.test(tx) && /950\s*푼 문항/.test(tx) && /8월보다 5%p 올랐어요/.test(tx) && /9월 의견/.test(tx) && !/루멘 기록/.test(tx), tx.slice(0, 260));

  /* ③ */
  await P(() => goTab('report')); await pg.waitForTimeout(100);
  const rl = await P(() => Array.from(document.querySelectorAll('.p39row b')).map((b) => b.textContent));
  t('③ 리포트 탭 달별 줄 — 2026년 10월 · 9월 순', JSON.stringify(rl) === JSON.stringify(['2026년 10월 보고서', '2026년 9월 보고서']), JSON.stringify(rl));
  await P(() => goTab('home')); await pg.waitForTimeout(100);
  t('② 본 뒤에는 홈 도착 카드 없음', !(await P(() => !!document.querySelector('.p39arr'))), '');

  /* ⑥ */
  await P(() => { localStorage.removeItem('p39_seen_AAA111'); P.mpub.months['2026-10'].at = '2026-10-20T00:00:00Z'; render(); });
  t('⑥ 공개 14일 지난 달은 도착 카드 없음', !(await P(() => !!document.querySelector('.p39arr'))), '');
  await P(() => { P.mpub.code = 'ZZZ999'; render(); goTab('report'); });
  t('⑥ 다른 아이 코드 자료면 안 보임(줄 0 · 화면 「아직 도착한 보고서가 없어요」)', (await P(() => document.querySelectorAll('.p39row').length)) === 0 && /아직 도착한 보고서가 없어요/.test(await P(() => { goTab('mrep'); return document.getElementById('app').innerText; })), '');

  /* ⑦ */
  t('⑦ PAR_VER v1-39', (await P(() => PAR_VER)) === 'v1-39', '');
  let same = false; try { same = execSync('git -C ' + ROOT + ' diff --quiet HEAD -- parent.html && echo same').toString().trim() === 'same'; } catch (e) {}
  t('⑦ parent.html 손대지 않음', same, '');
  t('⑦ 쓰기 없음 · 페이지 오류 없음', (await P(() => __W.filter((w) => !/parent_open_/.test(w)).length)) === 0 && errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
