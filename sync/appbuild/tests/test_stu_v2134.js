#!/usr/bin/env node
/* 학생앱 v2-134 검사 — 계획 내기 점수 글(5점 · 지각 2점, 점수 표 PW.PT 에서) · 홈 플래너 점수 = 매일 + 주간(랭킹 줄 값)
 *   (원장 2026-10-12 「1,2,3 다 고쳐줘」)
 *   ① 주간계획표 「다음 주」 마감 줄: 「일요일 밤 12시까지 「계획 내기」 5점」 · 「월요일에 내면 2점」 / 낸 뒤 「다음 주 계획을 냈어요 — 5점」 · 알림 「— 5점!」
 *      「이번 주」 지각 줄(월요일): 「오늘 밤 12시까지 내면 2점」 · 옛 글(3점·1점) 없음 · 점수 표를 바꾸면 글도 바뀜
 *   ② 홈 「📊 플래너 점수」: 저장된 weekly(옛 값 8) 대신 랭킹 줄의 주간 점수(9) → 「매일 d + 주간 9 = d+9점 · 1위」 = 랭킹 합계
 *      랭킹 줄이 없으면 전처럼 저장된 weekly
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2134.js student_v2-134.html
 *   그림: $SP/stu2134_plan.png · 가짜 서버 · 외부망 차단 · 학생 이름 ○○○ */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-134.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v2-\d+/) || ['v2-134'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: { lumen_group_days: { T5: [2, 4, 6] } }, ups: [], toasts: [] };
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
    studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중2', group: 'T5', id: 'S1' }; isTest = false;
    window.toast = (m) => { T.toasts.push(m); };
  });
  const ver = await pg.evaluate(() => STU_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* ① 주간계획표 — 다음 주 탭 */
  const A = await pg.evaluate(async () => {
    const out = {};
    wplOpen('next'); await new Promise((r) => setTimeout(r, 600));
    const due = () => { const e = document.querySelector('#wp-body .wp-due'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; };
    out.before = due();
    /* 다음 주에 할 일 하나 넣고 「계획 내기」 */
    const nW = PW.add(PW.thisMon(), 7); WP.data.weeks[nW] = { items: [{ id: 'x1', d: 0, t: '19:00', n: 2, subj: '영어', title: '단어 30개', src: 'me' }] };
    WP.tab = 'next'; await wplSubmit(); await new Promise((r) => setTimeout(r, 300));
    out.after = due(); out.toasts = T.toasts.slice(); out.saved = !!(T.store.wplan_AAA111 && T.store.wplan_AAA111.weeks[nW] && T.store.wplan_AAA111.weeks[nW].submittedAt);
    /* 이번 주 탭 · 월요일 낮(지각 시간)으로 시계를 잠깐 맞춤 */
    const realNow = Date.now; Date.now = () => Date.parse('2026-10-12T15:00:00+09:00');
    try { WP.data.weeks['2026-10-12'] = { items: [] }; WP.tab = 'this'; wplRender(); out.late = due(); } finally { Date.now = realNow; }
    /* 점수 표를 바꾸면 글도 바뀐다 */
    const keep = JSON.parse(JSON.stringify(PW.PT.plan)); PW.PT.plan.ok = 7; PW.PT.plan.late = 4; WP.tab = 'next'; delete WP.data.weeks[nW].submittedAt; wplRender(); out.alt = due(); PW.PT.plan.ok = keep.ok; PW.PT.plan.late = keep.late;
    WP.tab = 'next'; wplRender(); out.restored = due();
    out.html = document.documentElement.outerHTML;
    return out;
  });
  console.log(JSON.stringify({ before: A.before, after: A.after, late: A.late, alt: A.alt, toasts: A.toasts }, null, 1));
  t('다음 주 마감 줄: 「계획 내기」 5점 · 월요일에 내면 2점', /일요일 밤 12시까지 「계획 내기」 5점/.test(A.before) && /월요일에 내면 2점 · 안 내면 0점/.test(A.before), A.before);
  t('낸 뒤: 「다음 주 계획을 냈어요 — 5점」 · 알림 「계획을 냈어요 — 5점!」 · 저장됨', /다음 주 계획을 냈어요 — 5점/.test(A.after) && A.toasts.some((m) => m === '📅 계획을 냈어요 — 5점!') && A.saved, JSON.stringify([A.after, A.toasts, A.saved]));
  t('이번 주 지각 줄(월요일): 「오늘 밤 12시까지 내면 2점」', /이번 주 계획 — 오늘 밤 12시까지 내면 2점/.test(A.late), A.late);
  t('점수 표(PW.PT.plan)를 바꾸면 글도 바뀜 (7점 · 4점)', /「계획 내기」 7점/.test(A.alt) && /월요일에 내면 4점/.test(A.alt), A.alt);
  const src = A.html.split('\n').filter((L) => !/^\s*\*/.test(L)).join('\n');   /* 버전 기록 주석(v2-111 옛 규칙 설명)은 빼고 */
  t('옛 글(— 3점 · 내면 1점 · 늦게 냈어요 — 1점 · (1점)) 이 화면 코드에 없음(주석 제외)', !/계획을 냈어요 — 3점|「계획 내기」 3점|내면 1점<\/b>|늦게 냈어요 — 1점|월요일 밤 12시까지 \(1점\)|월요일에 내면 1점/.test(src), (src.match(/.{30}(— 3점|내면 1점|\(1점\)).{10}/) || [''])[0]);
  /* 그림: 다음 주 탭 마감 줄 */
  await pg.evaluate(() => { WP.tab = 'next'; wplRender(); window.scrollTo(0, 0); const b = document.getElementById('wp-body'); if (b) b.scrollTop = 0; });
  await pg.waitForTimeout(300);
  const box = await pg.evaluate(() => { const e = document.querySelector('#wp-body .wp-due'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { y: Math.max(0, r.top - 120) }; });
  await pg.screenshot({ path: SP + '/stu2134_plan.png', clip: { x: 0, y: box ? box.y : 0, width: 420, height: 320 } });

  /* ② 홈 플래너 점수 칸 */
  const B = await pg.evaluate(async () => {
    const out = {};
    const ym = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7), y = ym.slice(0, 4), m = ym.slice(5, 7);
    const scores = {}; for (let d = 1; d <= 5; d++) scores[y + '.' + m + '.0' + d] = 8;
    const firstW = (() => { let W = PW.mon(ym + '-01'); if (PW.add(W, 6).slice(0, 7) !== ym) W = PW.add(W, 7); return W; })();
    const weekly = {}; weekly[firstW] = { t: 8, plan: 5, prac: 0, photo: 3, paper: 0 };   /* 학생앱 줄에 남은 옛 값 */
    T.store.student_planner_AAA111 = { studentId: 'S1', scores, weekly, teacherComment: '', lastUpdated: '2026-10-09T00:00:00Z' };
    plannerData = null; try { plannerRankingCache = {}; } catch (e) {}
    out.daily = Number((function(){ plannerData = T.store.student_planner_AAA111; return (aggregateMyScores('month') || {}).total; })()) || 0; plannerData = null;
    /* (가) 랭킹 줄 없음 → 저장된 weekly 8 */
    await plscPaint(); out.noRank = document.getElementById('h3-plsc-desc').textContent;
    /* (나) 랭킹 줄 있음 → 랭킹 주간 9 */
    T.store['planner_ranking_' + ym] = { month: ym, ranking: [{ id: 'S1', code: 'AAA111', maskedName: '○○○', total: out.daily + 9, daily: out.daily, weekly: 9, days: 5, max: 8, rank: 1 }, { id: 'S2', code: 'BBB222', maskedName: '○○○', total: 30, daily: 30, weekly: 0, days: 4, max: 8, rank: 2 }] };
    try { plannerRankingCache = {}; } catch (e) {}
    await plscPaint(); out.withRank = document.getElementById('h3-plsc-desc').textContent;
    out.rankTotal = out.daily + 9; out.sub = (document.getElementById('plan-sc-sub') || {}).textContent || '';
    return out;
  });
  console.log(JSON.stringify(B));
  t('랭킹 줄이 없으면 전처럼 저장된 주간 8: 「매일 d + 주간 8 = d+8점」', B.noRank === '매일 ' + B.daily + ' + 주간 8 = ' + (B.daily + 8) + '점', B.noRank);
  t('홈 = 매일 + 주간(랭킹 줄 9) = 랭킹 합계 · 1위', B.daily === 40 && B.withRank === '매일 40 + 주간 9 = ' + B.rankTotal + '점 · 1위', B.withRank);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
