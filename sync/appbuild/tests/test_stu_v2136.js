#!/usr/bin/env node
/* 학생앱 v2-136 검사 — ⚖️ 스터디 코디 과목 균형 (원장 승인 시안 docs/mockup_codi_balance.html)
 *   ① 초6(수학 할 일 많음 · 영어학원 월수금): 그 주 처음 → 「이번 주 다른 과목 할 일 있어?」 카드 (계획은 아직 안 짬)
 *      영어 「영어 단어 시험 준비 (목)」 30분 · 국어 「독서록 쓰기」 1시간 넣기 → codi_goals_ 에 me · week · due(목=3)
 *      「✨ 이대로 계획 짜 줘」 → 한 주 ≤ 10시간 · 수학 ≤ 6시간 · 미룬 수학 줄 · 영어학원 날(월수금) 「영어학원 숙제」 · 「독서 30분」
 *      학생이 넣은 영어 칸 = 목요일 19:00(가장 좋은 칸 · 먼저 자리) · ✏️ · src 'me' · 주간계획표(wplan_)에도 subj 그대로
 *      「다시 짜 줘」는 다시 묻지 않음 · 「✏️ 다른 과목 넣기」로 다시 열고 ✕ 로 빼면 다시 짤 때 빠짐
 *   ② 중1 「없어요」 → ≤ 14시간 · 수학 ≤ 8시간 · 과학 · 사회 칸 · 물어본 주 기록
 *   ③ 고2 → ≤ 18시간 · 수학 ≤ 10.5시간 · 영어 독해 · 국어
 *   ④ 시험대비 D-14 → 수학 6할 넘게(8할까지) + 「시험 2주 전」 줄
 *   ⑤ 주간계획표 「🧭 코디가 채워 주기」 → 묻기 시트 → 채우기 · 달력 위 요약 카드
 *   ⑥ 390px 가로 넘침 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2136.js student_v2-136.html
 *   그림: $SP/stu2136_ask.png · $SP/stu2136_week.png · $SP/stu2136_codi.png · $SP/stu2136_cal.png · 가짜 서버 · 외부망 차단 · 학생 이름 ○○○ */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-136.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v2-\d+/) || ['v2-136'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const school = (s, e) => ({ id: 'school', label: '학교', type: 'school', days: [0, 1, 2, 3, 4], start: s, end: e });
    const rules = { night: '22:00', rest: true, sunday: true, morning: '09:00' };
    const cards = (n, pre) => ({ items: Array.from({ length: n }, (_, i) => (i % 2 ? { id: pre + i, kind: 'ws', title: pre + ' 학습지 (' + String(i + 1).padStart(2, '0') + ')' } : { id: pre + i, kind: 'book', title: 'RPM ' + (100 + i * 6) + '~' + (105 + i * 6) + '쪽', ref: (100 + i * 6) + '~' + (105 + i * 6) })) });
    window.T = { store: {
      lumen_group_days: { T3: [1, 3, 5], M7: [2, 4] }, lumen_group_times: { T3: { 1: { start: '15:00', min: 120 }, 3: { start: '15:00', min: 120 }, 5: { start: '15:00', min: 120 } } },
      codi_settings: { targets: ['*'] },
      /* 초6: 학교 09:00~14:30 · 영어학원 월수금 17:30~18:30 · 수학 할 일 10개(10시간) */
      codi_fixed_AAA111: { blocks: [school('09:00', '14:30'), { id: 'e1', label: '영어학원', type: 'academy', days: [0, 2, 4], start: '17:30', end: '18:30' }], rules },
      todo_AAA111: cards(10, '초6'),
      /* 중1: 수학 6개(6시간) */
      codi_fixed_BBB222: { blocks: [school('08:30', '15:30'), { id: 't1', label: '태권도', type: 'academy', days: [1, 3], start: '18:00', end: '19:00' }], rules },
      todo_BBB222: cards(6, '중1'),
      /* 고2: 수학 14개(14시간) */
      codi_fixed_CCC333: { blocks: [school('08:00', '16:30')], rules },
      todo_CCC333: cards(14, '고2'),
      /* 중2 시험대비: 수학 10개 + 시험대비 3칸 */
      codi_fixed_DDD444: { blocks: [school('08:30', '15:30')], rules },
      todo_DDD444: cards(10, '중2'),
      /* 중2 달력 */
      codi_fixed_EEE555: { blocks: [school('08:30', '15:30'), { id: 'e2', label: '영어학원', type: 'academy', days: [1, 3], start: '16:00', end: '18:00' }], rules },
      todo_EEE555: cards(8, '중2b'),
    }, ups: [], toasts: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false,
        select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; }, or() { return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.ups.push(r.key); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]) }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    sb = { from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: p } }) }) } };
    window.supabase = { createClient: () => sb };
    studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '초등학교 6학년', school: '옥길초', group: 'T3', id: 'S1' }; isTest = false;
    window.toast = (m) => { T.toasts.push(m); };
    scSetToday('2026-10-19');   /* 월요일 */
  });
  const ver = await pg.evaluate(() => STU_VER);
  t('버전 ' + WANT, ver === WANT, ver);
  const wait = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  const W = '2026-10-19';
  const ana = (c) => pg.evaluate((c) => { const p = T.store['codi_plan_' + c]; if (!p) return null; const by = {}; let tot = 0;
    const tm = (s) => { const m = (14 + s) * 30; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    p.blocks.forEach((b) => { by[b.item.subj] = (by[b.item.subj] || 0) + b.n; tot += b.n; });
    return { week: p.week, tot, by, bal: p.bal, blocks: p.blocks.map((b) => ({ d: b.d, t: tm(b.s), n: b.n, subj: b.item.subj, title: b.item.title, kind: b.item.kind, src: b.item.src })) }; }, c);
  const noOverflow = () => pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  const switchTo = (info) => pg.evaluate(async (info) => { Object.assign(studentInfo, info); await scLoad(true); }, info);

  /* ① 초6 — 그 주 처음: 묻기 카드 */
  await pg.evaluate(() => go('screen-codi')); await wait(900);
  const A0 = await pg.evaluate(() => { const b = document.getElementById('sc-body'); return { txt: b.innerText.replace(/\s+/g, ' '), card: !!b.querySelector('#sc-ask'), chips: [...b.querySelectorAll('.sc-ask-chips button')].map((x) => x.textContent).join(','), plan: !!T.store.codi_plan_AAA111 }; });
  t('그 주 처음 코디 화면: 「이번 주 다른 과목 할 일 있어?」 카드 · 영어·국어·과학·사회 칩 · 두 단추 · 계획은 아직 안 짬',
    A0.card && /이번 주 다른 과목 할 일 있어\?/.test(A0.txt) && A0.chips === '영어,국어,과학,사회' && /✨ 이대로 계획 짜 줘/.test(A0.txt) && /없어요 — 코디가 알아서 채워 줘/.test(A0.txt) && /초등 10시간/.test(A0.txt) && !A0.plan, JSON.stringify(A0).slice(0, 300));
  await pg.fill('#sc-body .sca-t', '영어 단어 시험 준비 (목)'); await pg.selectOption('#sc-body .sca-m', '30');
  await pg.click('#sc-body .sca-add'); await wait(250);
  await pg.click('#sc-body .sc-ask-chips button:has-text("국어")'); await wait(100);
  await pg.fill('#sc-body .sca-t', '독서록 쓰기'); await pg.selectOption('#sc-body .sca-m', '60');
  await pg.click('#sc-body .sca-add'); await wait(250);
  const G = await pg.evaluate(() => ({ items: (T.store.codi_goals_AAA111 || {}).items || [], list: [...document.querySelectorAll('#sc-body .sc-ask-list .ad')].map((x) => x.innerText.replace(/\s+/g, ' ')) }));
  console.log(JSON.stringify(G.list));
  const g1 = G.items.find((g) => g.subj === '영어'), g2 = G.items.find((g) => g.subj === '국어');
  t('넣은 두 개 → codi_goals_AAA111 (me · 이번 주 · 영어 30분 「(목)」→ due 3 · 국어 60분) · 목록 2줄 ✕',
    G.items.length === 2 && g1 && g1.me && g1.week === W && g1.due === 3 && g1.title === '영어 단어 시험 준비' && g1.min === 30 && g2 && g2.min === 60 && g2.due == null && G.list.length === 2 && /\(목\)/.test(G.list[0]),
    JSON.stringify(G));
  await pg.evaluate(() => { const b = document.getElementById('sc-ask'); if (b) b.scrollIntoView({ block: 'start' }); }); await wait(150);
  await pg.screenshot({ path: SP + '/stu2136_ask.png', fullPage: false });
  const N0 = await noOverflow();
  t('390px: 묻기 카드 가로 넘침 없음', N0.doc <= 390 && N0.body <= 390, JSON.stringify(N0));
  await pg.click('#sc-body .sca-go'); await wait(900);
  const P1 = await ana('AAA111');
  console.log(JSON.stringify({ tot: P1 && P1.tot, by: P1 && P1.by, bal: P1 && P1.bal }));
  t('초6 계획: 한 주 ≤ 10시간(20칸) · 수학 ≤ 6시간(12칸) · 이번 주 · 물어본 주 기록', P1 && P1.week === W && P1.tot <= 20 && P1.tot >= 18 && (P1.by['수학'] || 0) <= 12 && (P1.by['수학'] || 0) >= 10, JSON.stringify(P1 && { tot: P1.tot, by: P1.by }));
  const asked = await pg.evaluate(() => !!(T.store.codi_goals_AAA111.asked || {})['2026-10-19']);
  t('codi_goals_AAA111.asked[이번 주] 기록', asked, String(asked));
  const eng = P1.blocks.filter((b) => b.title === '영어학원 숙제');
  t('영어학원 가는 월·수·금 저녁(19:00 뒤)에 「영어학원 숙제」(영어 · 🧭 codi)', JSON.stringify(eng.map((b) => b.d)) === '[0,2,4]' && eng.every((b) => b.subj === '영어' && b.t >= '19:00' && (b.src || 'codi') === 'codi'), JSON.stringify(eng));
  t('초등 남는 칸: 「독서 30분」(국어) · 「영어 단어 복습」', P1.blocks.some((b) => b.title === '독서 30분' && b.subj === '국어') && P1.blocks.some((b) => b.title === '영어 단어 복습' && b.subj === '영어'), JSON.stringify(P1.blocks.map((b) => b.title)));
  const me = P1.blocks.find((b) => b.title === '영어 단어 시험 준비');
  t('학생이 넣은 영어 칸: 목요일 19:00(먼저 자리) · src me · kind goal', me && me.d === 3 && me.t === '19:00' && me.src === 'me' && me.kind === 'goal', JSON.stringify(me));
  t('학생이 넣은 국어 「독서록 쓰기」 1시간도 들어감', P1.blocks.filter((b) => b.title === '독서록 쓰기').reduce((a, b) => a + b.n, 0) === 2, JSON.stringify(P1.blocks.filter((b) => b.kind === 'goal')));
  t('일요일은 비움', !P1.blocks.some((b) => b.d === 6), '');
  t('수학이 넘쳐 미룬 것이 있음 (bal.deferred)', P1.bal && P1.bal.deferred.length >= 1 && P1.bal.cap === 20 && P1.bal.mathCap === 12 && !P1.bal.exam, JSON.stringify(P1.bal));
  const V = await pg.evaluate(() => { const b = document.getElementById('sc-body'), bal = document.getElementById('sc-bal'); return { bal: bal ? bal.innerText.replace(/\s+/g, ' ') : '', segs: bal ? bal.querySelectorAll('.bar i').length : 0, ask: !!b.querySelector('#sc-ask'), mine: [...b.querySelectorAll('.sc-blk')].map((x) => x.innerText.replace(/\s+/g, ' ')) }; });
  console.log(V.bal);
  t('요약 카드: 「공부 N시간 / 초등 한도 10시간」 「✓ 한도 안」 · 막대 · 「수학 6h 60%」 · 「…다음 주로 미뤘어요」 · 단추 둘',
    /공부 \d+시간( \d+분)? \/ 초등 한도 10시간/.test(V.bal) && /✓ 한도 안/.test(V.bal) && V.segs >= 2 && /수학 \d(\.5)?h \d+%/.test(V.bal) && /수학 할 일 중 «.+»(은|는| 외 \d+개는) 다음 주로 미뤘어요/.test(V.bal) && /다른 과목 넣기/.test(V.bal) && /다시 짜 줘/.test(V.bal) && !V.ask,
    V.bal);
  /* 오늘(월) 칸: 영어학원 숙제 🧭 */
  t('오늘 칸에 🧭 표시', V.mine.some((x) => /영어학원 숙제🧭|영어학원 숙제 🧭/.test(x)), JSON.stringify(V.mine));
  const WP1 = await pg.evaluate(() => { const w = ((T.store.wplan_AAA111 || {}).weeks || {})['2026-10-19']; return w ? { n: w.items.length, subj: [...new Set(w.items.map((x) => x.subj))].sort().join(','), me: w.items.filter((x) => x.src === 'me').map((x) => x.title), codiEng: w.items.filter((x) => x.src === 'codi' && x.subj === '영어').length, bal: !!w.bal } : null; });
  t('주간계획표(wplan_)에도 과목 그대로 · 학생 칸 src me · 코디 영어 칸 src codi · bal 보관', WP1 && /국어/.test(WP1.subj) && /영어/.test(WP1.subj) && /수학/.test(WP1.subj) && WP1.me.indexOf('영어 단어 시험 준비') >= 0 && WP1.codiEng >= 3 && WP1.bal, JSON.stringify(WP1));
  await pg.screenshot({ path: SP + '/stu2136_codi.png', fullPage: true });
  const N1 = await noOverflow();
  t('390px: 코디 화면(요약 카드) 가로 넘침 없음', N1.doc <= 390 && N1.body <= 390, JSON.stringify(N1));
  /* 주간 계획 화면 */
  await pg.evaluate(() => { go('screen-codi-week'); scRenderWeek(); }); await wait(200);
  const WK = await pg.evaluate(() => document.getElementById('sc-week-body').innerText.replace(/\s+/g, ' '));
  t('주간 계획 화면: 요약 카드 · 「✏️ 다른 과목 넣기 · 다시 짜 줘」 · 일요일 쉬는 날 · ✏️ 칸', /초등 한도 10시간/.test(WK) && /다른 과목 넣기/.test(WK) && /쉬는 날/.test(WK) && /영어 단어 시험 준비✏️|영어 단어 시험 준비 ✏️/.test(WK), WK.slice(0, 200));
  await pg.screenshot({ path: SP + '/stu2136_week.png', fullPage: true });
  const N2 = await noOverflow();
  t('390px: 주간 계획 화면 가로 넘침 없음', N2.doc <= 390 && N2.body <= 390, JSON.stringify(N2));
  /* 다시 짜 줘: 다시 묻지 않음 · 학생 칸 그대로 */
  await pg.evaluate(async () => { go('screen-codi'); await new Promise((r) => setTimeout(r, 400)); await scBuild(); }); await wait(500);
  const R1 = await ana('AAA111'); const R1ask = await pg.evaluate(() => !!document.querySelector('#sc-body #sc-ask'));
  t('「다시 짜 줘」: 다시 묻지 않고 바로 짬 · 학생 칸 그대로 · 한도 안', !R1ask && R1.tot <= 20 && (R1.by['수학'] || 0) <= 12 && R1.blocks.some((b) => b.title === '영어 단어 시험 준비' && b.d === 3), JSON.stringify({ R1ask, tot: R1.tot, by: R1.by }));
  /* ✏️ 다른 과목 넣기 → ✕ → 이대로 */
  await pg.evaluate(() => scAskOpen()); await wait(200);
  const RO = await pg.evaluate(() => { const b = document.querySelector('#sc-body #sc-ask'); return b ? { n: b.querySelectorAll('.sc-ask-list .ad').length, close: /닫기/.test(b.innerText) } : null; });
  t('「✏️ 다른 과목 넣기」로 다시 열림 · 넣은 2개 · 「닫기」 단추', RO && RO.n === 2 && RO.close, JSON.stringify(RO));
  await pg.click('#sc-body .sc-ask-list .ad:has-text("독서록") button'); await wait(250);
  await pg.click('#sc-body .sca-go'); await wait(800);
  const R2 = await ana('AAA111'); const R2g = await pg.evaluate(() => T.store.codi_goals_AAA111.items.length);
  t('✕ 로 뺀 「독서록 쓰기」는 다시 짤 때 빠짐 · 영어 칸은 그대로', R2g === 1 && !R2.blocks.some((b) => b.title === '독서록 쓰기') && R2.blocks.some((b) => b.title === '영어 단어 시험 준비') && R2.tot <= 20, JSON.stringify({ R2g, titles: R2.blocks.map((b) => b.title) }));

  /* ② 중1 — 「없어요」 */
  await switchTo({ lumen_rec_code: 'BBB222', grade: '중학교 1학년', school: '옥길중', group: 'M7' });
  await pg.evaluate(() => scInit()); await wait(800);
  const B0 = await pg.evaluate(() => !!document.querySelector('#sc-body #sc-ask'));
  await pg.click('#sc-body .sca-none'); await wait(800);
  const P2 = await ana('BBB222');
  console.log(JSON.stringify({ tot: P2 && P2.tot, by: P2 && P2.by }));
  const g2s = await pg.evaluate(() => T.store.codi_goals_BBB222 || null);
  t('중1 「없어요」: 묻기 카드 → 바로 짬 · 넣은 것 없음 · 물어본 주 기록', B0 && P2 && g2s && (g2s.items || []).length === 0 && !!(g2s.asked || {})[W], JSON.stringify(g2s));
  t('중1: 한 주 ≤ 14시간(28칸) · 수학 ≤ 8시간(16칸) · 수학 할 일 6시간 다 들어감 · 미룬 것 없음', P2.tot <= 28 && P2.tot >= 24 && (P2.by['수학'] || 0) === 12 && !P2.bal.deferred.length && P2.bal.mathCap === 16, JSON.stringify({ tot: P2.tot, by: P2.by, bal: P2.bal }));
  t('중1 남는 칸: 영어·국어·과학·사회 모두 (과학 교과서 복습 · 사회 교과서 복습)', ['영어', '국어', '과학', '사회'].every((x) => P2.by[x] >= 1) && P2.blocks.some((b) => b.title === '과학 교과서 복습') && P2.blocks.some((b) => b.title === '사회 교과서 복습'), JSON.stringify(P2.by));
  const B1 = await pg.evaluate(() => (document.getElementById('sc-bal') || {}).innerText || '');
  t('중1 요약: 「중등 한도 14시간」 · 미룬 줄 없음', /중등 한도 14시간/.test(B1) && !/미뤘어요/.test(B1), B1.replace(/\s+/g, ' '));
  const days2 = [0, 1, 2, 3, 4, 5].map((d) => P2.blocks.filter((b) => b.d === d).reduce((a, b) => a + b.n, 0));
  t('중1: 날마다 고르게 (월~토 모두 칸 있음)', days2.every((x) => x >= 2), JSON.stringify(days2));

  /* ③ 고2 */
  await switchTo({ lumen_rec_code: 'CCC333', grade: '고등학교 2학년', school: '부천고', group: '' });
  await pg.evaluate(() => scInit()); await wait(800);
  await pg.click('#sc-body .sca-none'); await wait(800);
  const P3 = await ana('CCC333');
  console.log(JSON.stringify({ tot: P3 && P3.tot, by: P3 && P3.by }));
  t('고2: 한 주 ≤ 18시간(36칸) · 수학 ≤ 10.5시간(21칸) · 미룬 수학 있음', P3 && P3.tot <= 36 && P3.tot >= 30 && (P3.by['수학'] || 0) <= 21 && (P3.by['수학'] || 0) >= 18 && P3.bal.deferred.length >= 1 && P3.bal.mathCap === 21, JSON.stringify(P3 && { tot: P3.tot, by: P3.by, bal: P3.bal }));
  t('고2 남는 칸: 「영어 독해」 · 「국어 문학·비문학」 (과학·사회 없음)', P3.blocks.some((b) => b.title === '영어 독해') && P3.blocks.some((b) => b.title === '국어 문학·비문학') && !P3.by['과학'] && !P3.by['사회'], JSON.stringify(P3.by));

  /* ④ 시험대비 D-14 */
  await switchTo({ lumen_rec_code: 'DDD444', grade: '중학교 2학년', school: '옥길중', group: '' });
  await pg.evaluate(() => { XTS.my = { dd: { date: '2026-10-26' }, items: [] }; window.xtMine = () => ({ cur: 0, rows: [{ it: { title: '2학기 중간고사' }, sv: 0 }] }); window.xtItemTotalS = () => 60; });
  await pg.evaluate(() => scInit()); await wait(800);
  await pg.click('#sc-body .sca-none'); await wait(800);
  const P4 = await ana('DDD444');
  console.log(JSON.stringify({ tot: P4 && P4.tot, by: P4 && P4.by, bal: P4 && P4.bal }));
  const B4 = await pg.evaluate(() => (document.getElementById('sc-bal') || {}).innerText || '');
  t('시험 D-7: 수학이 6할(16칸) 넘게 · 8할(22칸)까지 · 시험대비 3시간은 다 넣음(안 미룸) · 「시험 2주 전이라 수학을 8할까지」', P4 && P4.bal.exam && P4.bal.mathCap === 22 && (P4.by['수학'] || 0) > 16 && (P4.by['수학'] || 0) <= 22 && P4.tot <= 28 && P4.blocks.filter((b) => b.kind === 'exam').reduce((a, b) => a + b.n, 0) === 6 && !P4.bal.deferred.some((x) => /시험대비/.test(x)) && /시험 2주 전이라 수학을 8할까지/.test(B4), JSON.stringify({ by: P4 && P4.by, B4 }));
  await pg.evaluate(() => { XTS.my = null; });

  /* ⑤ 주간계획표 「🧭 코디가 채워 주기」 — 묻기 시트 → 채우기 · 요약 */
  await pg.evaluate(() => scSetToday(null));
  await switchTo({ lumen_rec_code: 'EEE555', grade: '중학교 2학년', school: '옥길중', group: '' });
  await pg.evaluate(async () => { wplOpen('next'); await new Promise((r) => setTimeout(r, 700)); });
  const NW = await pg.evaluate(() => PW.add(PW.thisMon(), 7));
  await pg.evaluate(async () => { await wplCodiFill(); }); await wait(300);
  const S0 = await pg.evaluate(() => { const ov = document.getElementById('sc-ask-ov'); return { show: ov.classList.contains('show'), txt: ov.innerText.replace(/\s+/g, ' ') }; });
  t('달력 「🧭 코디가 채워 주기」: 그 주 처음이면 묻기 시트', S0.show && /이번 주 다른 과목 할 일 있어\?/.test(S0.txt), S0.txt.slice(0, 120));
  await pg.click('#sc-ask-sheet .sc-ask-chips button:has-text("과학")'); await wait(100);
  await pg.fill('#sc-ask-sheet .sca-t', '과학 수행평가 보고서'); await pg.selectOption('#sc-ask-sheet .sca-m', '90');
  await pg.click('#sc-ask-sheet .sca-go'); await wait(900);
  const C = await pg.evaluate((nw) => { const w = ((T.store.wplan_EEE555 || {}).weeks || {})[nw]; const by = {}; let tot = 0; ((w && w.items) || []).forEach((x) => { by[x.subj] = (by[x.subj] || 0) + (+x.n || 2); tot += (+x.n || 2); });
    const bal = document.getElementById('wp-bal'); return { tot, by, me: ((w && w.items) || []).filter((x) => x.src === 'me').map((x) => x.subj + ':' + x.title + ':' + x.n), eng: ((w && w.items) || []).filter((x) => x.title === '영어학원 숙제').map((x) => x.d), hasBal: !!(w && w.bal), ov: document.getElementById('sc-ask-ov').classList.contains('show'), balTxt: bal ? bal.innerText.replace(/\s+/g, ' ') : '' }; }, NW);
  console.log(JSON.stringify(C));
  t('달력 채우기: 시트 닫힘 · 다음 주 ≤ 14시간 · 수학 ≤ 8시간 · 학생 과학 1시간 30분(src me) · 영어학원 화·목 숙제',
    !C.ov && C.tot <= 28 && C.tot >= 20 && (C.by['수학'] || 0) <= 16 && C.me.join('|').replace(/:\d+/g, '') === '과학:과학 수행평가 보고서|과학:과학 수행평가 보고서' && JSON.stringify(C.eng) === '[1,3]' && C.hasBal, JSON.stringify(C));
  t('달력 위 요약 카드: 「중등 한도 14시간」 · 「✏️ 다른 과목 넣기」', /중등 한도 14시간/.test(C.balTxt) && /다른 과목 넣기/.test(C.balTxt), C.balTxt);
  await pg.evaluate(() => { const b = document.getElementById('wp-bal'); if (b) b.scrollIntoView({ block: 'start' }); }); await wait(150);
  await pg.screenshot({ path: SP + '/stu2136_cal.png', fullPage: false });
  const N3 = await noOverflow();
  t('390px: 주간계획표(요약 카드) 가로 넘침 없음', N3.doc <= 390 && N3.body <= 390, JSON.stringify(N3));
  /* 두 번째 누르면 다시 묻지 않음 */
  const n0 = await pg.evaluate(() => T.toasts.length);
  await pg.evaluate(async () => { await wplCodiFill(); }); await wait(300);
  const S2 = await pg.evaluate((n0) => ({ show: document.getElementById('sc-ask-ov').classList.contains('show'), toast: T.toasts.slice(n0).join(' | ') }), n0);
  t('달력 두 번째 「채워 주기」: 다시 묻지 않음 · 한도가 차서 더 안 넣음', !S2.show && /한도까지 찼어요|채웠어요/.test(S2.toast), JSON.stringify(S2));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
