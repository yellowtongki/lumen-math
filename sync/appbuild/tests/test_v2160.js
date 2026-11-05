#!/usr/bin/env node
/* 학생앱 v2-160 검사 — 📊 「내 플래너 점수」 이번 달 탭의 달 고르기(◀ 2026년 10월 ▶ · 지난달 점수 보기)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111) — test_v2159.js 와 같은 틀
 *   가짜 자료: student_planner_AAA111 = 지난달 점수 4일 + 이번 달 점수 2일 + 주간 두 주(지난달·이번 달) · planner_ranking_<지난달>·<이번 달>
 *   ① 기본 이번 달 — 달 고르기 줄 · 요약 「이번 달 내 점수」 · 🏆 이번 달 Top 5 · 내 순위(이번 달 랭킹)
 *   ② ◀ → 지난달 — label 「지난달 · 10월」 · 요약 점수 그 달만(매일+주간) · 「10월 Top 5」 그 달 랭킹 · 「10월 주간 점수」 · 「10월 점수 기록」 그 달만 · 내 순위 그 달
 *   ③ ▶ 이번 달까지만 · ◀ 집계 시작 달(2026-05)까지만 · 기록 없는 달 안내(탭·달 고르기 그대로)
 *   ④ 화면 다시 열면 이번 달 · 이번 주/전체 탭 그대로 · 랭킹 질의 키 · 쓰기 없음
 *   ⑤ ES5 · 버전 · student_v1 그대로 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2160.js [student_v2-160.html]
 *        SHOT=/경로/stu160.png 를 주면 끝에 지난달 화면 스크린샷 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-160.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* 달 계산 (Node 쪽) — 브라우저와 같은 로컬 시간 기준 */
const pad2 = (n) => String(n).padStart(2, '0');
const now = new Date();
const CUR = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
const addYM = (ym, n) => { const p = ym.split('-'); let y = +p[0], m = +p[1] - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad2(m + 1); };
const PREV = addYM(CUR, -1), PREV2 = addYM(CUR, -2);
const START = '2026-05';
const monName = (ym) => (ym.slice(0, 4) === CUR.slice(0, 4) ? '' : (ym.slice(0, 4) + '년 ')) + (+ym.slice(5, 7)) + '월';
/* 그 달 안에 일요일이 드는 월요일 하나 — 15일에서 월요일로 물러난다 */
const addD = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monOf = (ym) => { let d = ym + '-15'; while (new Date(d + 'T00:00:00Z').getUTCDay() !== 1) d = addD(d, -1); return d; };
const W_PREV = monOf(PREV), W_CUR = monOf(CUR);
const dot = (ym) => ym.replace('-', '.');

/* 가짜 Supabase — lumen_store 를 흉내 낸다 (single() 이 key 로 찾아 주도록 보강 · 질의 키 __gets 기록) */
const MOCK = (D) => {
  window.__store = {}; window.__ups = []; window.__gets = []; window.__toasts = [];
  const store = window.__store;
  window.sb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; if (tbl === 'lumen_store' && k === 'key') __gets.push(v); return b; }, in(k, v) { b.f.in = v; return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, gte() { return b; }, lte() { return b; }, is() { return b; }, or() { return b; },
    single() { const k = b.f.eq; return Promise.resolve({ data: (tbl === 'lumen_store' && store[k] != null) ? { key: k, value: JSON.parse(JSON.stringify(store[k])) } : null, error: (tbl === 'lumen_store' && store[k] != null) ? null : { code: 'PGRST116' } }); },
    maybeSingle() { let keys = Object.keys(store); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.length ? { key: keys[0], value: store[keys[0]] } : null, error: null }); },
    upsert(row, opt) { __ups.push({ tbl, key: row.key, value: JSON.parse(JSON.stringify(row.value)), opt: opt || null }); if (tbl === 'lumen_store') store[row.key] = row.value; return Promise.resolve({ error: null }); },
    insert(row) { __ups.push({ tbl, key: 'insert', value: row }); return Promise.resolve({ data: null, error: null }); }, update(row) { __ups.push({ tbl, key: 'update', value: row }); return b; }, delete() { __ups.push({ tbl, key: 'delete' }); return b; },
    then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: [], error: null }).then(r, j); let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; },
    rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/' + p } }) }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) } };
  window.isTest = false;
  window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5', id: 7 };
  window.alert = () => {}; window.confirm = () => true;
  const o = window.toast; window.toast = function (m) { __toasts.push(String(m)); try { return o && o.apply(this, arguments); } catch (e) {} };
  /* 플래너 점수 — 지난달 4일(8·10·5·9 = 32) · 이번 달 2일(7·6 = 13) · 그 전달 1일(4) · 집계 시작 전(2026.04) 1일은 빠져야 한다 */
  const sc = {};
  sc[D.prevDot + '.03'] = 8; sc[D.prevDot + '.07'] = 10; sc[D.prevDot + '.12'] = 5; sc[D.prevDot + '.20'] = 9;
  sc[D.curDot + '.01'] = 7; sc[D.curDot + '.02'] = 6;
  sc[D.prev2Dot + '.11'] = 4;
  sc['2026.04.20'] = 10;
  const wk = {}; wk[D.W_PREV] = { t: 20, plan: 5, prac: 5, photo: 5, paper: 5 }; wk[D.W_CUR] = { t: 12, plan: 3, prac: 3, photo: 3, paper: 3 };
  store['student_planner_AAA111'] = { scores: sc, weekly: wk, flags: {}, teacherComment: '', studentId: 7 };
  store['planner_ranking_' + D.PREV] = { ranking: [ { id: 1, rank: 1, code: 'BBB222', maskedName: '김○수', total: 90 }, { id: 2, rank: 2, code: 'CCC333', maskedName: '이○희', total: 70 }, { id: 7, rank: 3, code: 'AAA111', maskedName: '○○○', total: 52 } ] };
  store['planner_ranking_' + D.CUR] = { ranking: [ { id: 7, rank: 1, code: 'AAA111', maskedName: '○○○', total: 25 }, { id: 1, rank: 2, code: 'BBB222', maskedName: '김○수', total: 20 } ] };
  window.plannerData = null; window.plannerRankingCache = {};
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
  await pg.evaluate(MOCK, { prevDot: dot(PREV), curDot: dot(CUR), prev2Dot: dot(PREV2), W_PREV, W_CUR, PREV, CUR });
  const P = (fn, a) => pg.evaluate(fn, a);
  const wait = (ms) => pg.waitForTimeout(ms || 250);
  /* 화면 상태 */
  const st = () => P(() => {
    const body = document.getElementById('planner-score-body'); const scr = document.getElementById('screen-planner-score');
    const q = (sel) => body.querySelector(sel); const tx = (el) => el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    const ymBar = q('#ps-ym-bar');
    const titles = Array.prototype.map.call(body.querySelectorAll('.ps-rank-title'), (e) => tx(e));
    const recCard = Array.prototype.filter.call(body.querySelectorAll('.ps-rank-card'), (c) => /점수 기록/.test(tx(c.querySelector('.ps-rank-title'))))[0];
    const recRows = recCard ? Array.prototype.map.call(recCard.querySelectorAll('div[style*="justify-content:space-between"]'), (r) => tx(r)) : [];
    const wkCard = Array.prototype.filter.call(body.querySelectorAll('.ps-rank-card'), (c) => /^📅 .*주간 점수$/.test(tx(c.querySelector('.ps-rank-title'))))[0];
    const rankRows = Array.prototype.map.call(body.querySelectorAll('#ps-rank-list .ps-rank-row'), (r) => tx(r));
    return { active: scr.classList.contains('active'), tabs: Array.prototype.map.call(scr.querySelectorAll('.ps-tab'), (b) => b.textContent + (b.classList.contains('active') ? '*' : '')),
      ymBar: !!ymBar, ymText: tx(q('#ps-ym-t')), prevDis: ymBar ? ymBar.querySelector('button[aria-label="지난달"]').disabled : null, nextDis: ymBar ? ymBar.querySelector('button[aria-label="다음 달"]').disabled : null,
      label: tx(q('.ps-summary-label')), big: tx(q('.ps-summary-big')), summary: tx(q('.ps-summary')), myRank: tx(q('#ps-my-rank')), titles, recRows, recCount: recRows.length,
      wkRows: wkCard ? Array.prototype.map.call(wkCard.querySelectorAll('div[style*="justify-content:space-between"]'), (r) => tx(r)) : [], rankRows, monthEmpty: tx(q('#ps-month-empty')), allEmpty: !q('.ps-summary') && !ymBar && /아직 승인된 플래너 점수가 없어요/.test(tx(body)),
      psym: window.PS_YM, txt: tx(body) };
  });
  const clickBtn = async (label) => { try { await pg.click('#ps-ym-bar button[aria-label="' + label + '"]', { timeout: 2000 }); } catch (e) { await P((l) => { const b = document.querySelector('#ps-ym-bar button[aria-label="' + l + '"]'); if (b && !b.disabled) b.click(); }, label); } await wait(); };
  const openScreen = async () => { await P(() => go('screen-planner-score')); await wait(400); };
  console.log('   (이번 달 ' + CUR + ' · 지난달 ' + PREV + ' · 주간 월요일 ' + W_PREV + ',' + W_CUR + ')');

  t('버전 v2-160', (await P(() => STU_VER)) === 'v2-160');
  t('새 함수 psMonthMove 있음 · 예전 함수(setPlannerScoreRange·getPlannerScoreDateRange·renderPlannerScoreScreen·loadPlannerRanking·goPlannerScore) 그대로', await P(() => ['psMonthMove', 'setPlannerScoreRange', 'getPlannerScoreDateRange', 'renderPlannerScoreScreen', 'loadPlannerRanking', 'goPlannerScore', 'plsBack'].every((f) => typeof window[f] === 'function')));

  /* ① 기본 이번 달 */
  await openScreen();
  await P(() => setPlannerScoreRange('month')); await wait(400);
  let S = await st();
  t('이번 달 탭 → 달 고르기 줄 「' + CUR.slice(0, 4) + '년 ' + (+CUR.slice(5)) + '월 · 이번 달」 · ▶ 흐림(이번 달까지) · ◀ 눌림 · PS_YM 비어 있음(=이번 달)', S.ymBar && S.ymText === CUR.slice(0, 4) + '년 ' + (+CUR.slice(5)) + '월 이번 달' && S.nextDis === true && S.prevDis === false && S.psym === null, JSON.stringify(S));
  t('이번 달 요약 — label 「이번 달 내 점수」 · 13 + 주간 12 = 25점 · 제출일 2일 · 최고점 7점', S.label === '이번 달 내 점수' && /^25\s*점/.test(S.big) && /매일 13 \+ 주간 12/.test(S.summary) && /제출일 2일/.test(S.summary) && /최고점 7점/.test(S.summary), S.summary);
  t('🏆 이번 달 Top 5 — 이번 달 랭킹(내가 1위 25점) · 내 순위 1위 · 📅 이번 달 주간 점수 한 줄 12점', S.titles.some((x) => /^🏆 이번 달 Top 5/.test(x)) && S.rankRows.length === 2 && /나 \(○○○\)/.test(S.rankRows[0]) && /25점/.test(S.rankRows[0]) && S.myRank === '1위' && S.titles.indexOf('📅 이번 달 주간 점수') >= 0 && S.wkRows.length === 1 && /12점/.test(S.wkRows[0]), JSON.stringify({ titles: S.titles, rank: S.rankRows, my: S.myRank, wk: S.wkRows }));
  t('📅 최근 점수 기록 — 이번 달 2일만(지난달 것 없음)', S.titles.indexOf('📅 최근 점수 기록') >= 0 && S.recCount === 2 && S.recRows.every((r) => r.indexOf(CUR.slice(5) + '.') === 0), JSON.stringify(S.recRows));

  /* ② ◀ → 지난달 */
  await clickBtn('지난달'); await wait(300);
  S = await st();
  t('◀ → 지난달 — 달 고르기 「' + PREV.slice(0, 4) + '년 ' + (+PREV.slice(5)) + '월 · 지난달」 · PS_YM=' + PREV + ' · ◀▶ 둘 다 눌림', S.ymText === PREV.slice(0, 4) + '년 ' + (+PREV.slice(5)) + '월 지난달' && S.psym === PREV && S.prevDis === false && S.nextDis === false, JSON.stringify({ ym: S.ymText, psym: S.psym, p: S.prevDis, n: S.nextDis }));
  t('지난달 요약 — label 「지난달 · ' + monName(PREV) + ' 내 점수」 · 32 + 주간 20 = 52점 (그 달만 합산) · 제출일 4일 · 최고점 10점 · 평균 8.0', S.label === '지난달 · ' + monName(PREV) + ' 내 점수' && /^52\s*점/.test(S.big) && /매일 32 \+ 주간 20/.test(S.summary) && /제출일 4일/.test(S.summary) && /최고점 10점/.test(S.summary) && /평균 8\.0점/.test(S.summary), S.summary);
  t('「🏆 ' + monName(PREV) + ' Top 5」 — 그 달 랭킹 3명(1위 김○수 90점) · 내 순위 3위(그 달 것)', S.titles.some((x) => x.indexOf('🏆 ' + monName(PREV) + ' Top 5') === 0) && S.rankRows.length === 3 && /김○수/.test(S.rankRows[0]) && /90점/.test(S.rankRows[0]) && /나 \(○○○\)/.test(S.rankRows[2]) && S.myRank === '3위', JSON.stringify({ titles: S.titles, rank: S.rankRows, my: S.myRank }));
  t('「📅 ' + monName(PREV) + ' 주간 점수」 — 그 달 주간 한 줄 20점(계획 5 · 실천 5 …)', S.titles.indexOf('📅 ' + monName(PREV) + ' 주간 점수') >= 0 && S.wkRows.length === 1 && /20점/.test(S.wkRows[0]) && /계획 5 · 실천 5/.test(S.wkRows[0]), JSON.stringify(S.wkRows));
  t('「📅 ' + monName(PREV) + ' 점수 기록」 — 그 달 4일만 · 최근 날짜부터(20일 9점 → 3일 8점) · 집계 시작 전(4월)·다른 달 것 없음', S.titles.indexOf('📅 ' + monName(PREV) + ' 점수 기록') >= 0 && S.recCount === 4 && S.recRows.every((r) => r.indexOf(PREV.slice(5) + '.') === 0) && /^\d\d\.20 9점$/.test(S.recRows[0]) && /^\d\d\.03 8점$/.test(S.recRows[3]), JSON.stringify(S.recRows));
  t('랭킹 질의 키 planner_ranking_' + PREV + ' (lumen_store 에서 읽음)', await P((k) => __gets.indexOf(k) >= 0, 'planner_ranking_' + PREV), await P(() => __gets.join(',')));

  /* ③ 범위 끝 · 기록 없는 달 */
  await clickBtn('다음 달'); await wait(300);
  S = await st();
  t('▶ → 이번 달로 돌아옴 · ▶ 흐림 · 한 번 더 눌러도 이번 달까지만', S.psym === null && S.label === '이번 달 내 점수' && S.nextDis === true && (await (async () => { await P(() => psMonthMove(1)); await wait(300); const x = await st(); return x.psym === null && x.nextDis === true; })()), JSON.stringify({ psym: S.psym, label: S.label }));
  await clickBtn('지난달'); await clickBtn('지난달'); await wait(300);
  S = await st();
  t('◀ 두 번 → ' + monName(PREV2) + ' — label 「' + monName(PREV2) + ' 내 점수」(「지난달」 아님) · 1일 4점 · 주간 없음(주간 카드 없음) · 랭킹 없음 「아직 랭킹이 없어요」 · 내 순위 「-」', S.psym === PREV2 && S.label === monName(PREV2) + ' 내 점수' && /^4\s*점/.test(S.big) && S.recCount === 1 && !S.titles.some((x) => /^📅 .*주간 점수$/.test(x)) && /아직 랭킹이 없어요/.test(S.txt) && S.myRank === '-', JSON.stringify({ psym: S.psym, label: S.label, big: S.big, rec: S.recCount, titles: S.titles, my: S.myRank }));
  await P((st) => { for (let i = 0; i < 40; i++) psMonthMove(-1); }, START); await wait(300);
  S = await st();
  t('◀ 를 계속 눌러도 집계 시작 달 ' + START + ' 까지만 · ◀ 흐림 · 그 달엔 기록 없음 안내 「2026년 5월엔…」/「5월엔 승인된 점수가 없어요」 · 요약 카드 없음', S.psym === START && S.prevDis === true && S.nextDis === false && /승인된 점수가 없어요/.test(S.monthEmpty) && new RegExp('^📋 ' + monName(START) + '엔 승인된 점수가 없어요').test(S.monthEmpty) && S.label === '', JSON.stringify({ psym: S.psym, p: S.prevDis, empty: S.monthEmpty, label: S.label }));
  t('기록 없는 달이어도 탭 3개(이번 달 활성) · 달 고르기 줄은 그대로 보임', S.tabs.join(',') === '이번 주,이번 달*,전체' && S.ymBar && S.ymText.indexOf(START.slice(0, 4) + '년 ' + (+START.slice(5)) + '월') === 0, JSON.stringify(S.tabs) + ' ' + S.ymText);

  /* ④ 화면 다시 열기 · 다른 탭 · 쓰기 없음 */
  await P(() => go('screen-home')); await wait(200);
  await openScreen();
  S = await st();
  t('화면을 다시 열면 이번 달로 돌아옴(PS_YM 비움) — 이번 달 탭 상태 유지 · 「이번 달 내 점수」 25점', S.active && S.psym === null && S.tabs.indexOf('이번 달*') >= 0 && S.label === '이번 달 내 점수' && /^25\s*점/.test(S.big), JSON.stringify({ psym: S.psym, tabs: S.tabs, label: S.label, big: S.big }));
  await P(() => { psMonthMove(-1); }); await wait(300);
  await P(() => setPlannerScoreRange('week')); await wait(300);
  S = await st();
  t('「이번 주」 탭 그대로 — 달 고르기 줄 없음 · label 「이번 주 내 점수」 · Top 5·주간 카드 없음', S.tabs.join(',') === '이번 주*,이번 달,전체' && !S.ymBar && S.label === '이번 주 내 점수' && !S.titles.some((x) => /Top 5|주간 점수/.test(x)), JSON.stringify({ tabs: S.tabs, bar: S.ymBar, label: S.label, titles: S.titles }));
  await P(() => setPlannerScoreRange('all')); await wait(300);
  S = await st();
  t('「전체」 탭 그대로 — 달 고르기 줄 없음 · 「전체 내 점수」 · 집계 시작(2026.05) 뒤 7일 전부(49점 · 기록 7일 · 4월 것 빠짐)', !S.ymBar && S.label === '전체 내 점수' && /^49\s*점/.test(S.big) && /제출일 7일/.test(S.summary) && S.recCount === 7, JSON.stringify({ label: S.label, big: S.big, summary: S.summary, rec: S.recCount }));
  await P(() => setPlannerScoreRange('month')); await wait(300);
  S = await st();
  t('이번 달 탭으로 돌아오면 아까 고른 지난달이 그대로(화면을 떠나지 않았으므로) — 「지난달 · ' + monName(PREV) + '」 52점', S.psym === PREV && S.label === '지난달 · ' + monName(PREV) + ' 내 점수' && /^52\s*점/.test(S.big), JSON.stringify({ psym: S.psym, label: S.label, big: S.big }));
  t('홈 타일·계획 탭 줄 글 그대로(원본 HTML) 「이번 달 점수 · 랭킹」 / 「이번 달 점수와 Top 5」', (() => { const src0 = fs.readFileSync(FILE, 'utf8'); return src0.indexOf('<div class="fd3" id="h3-plsc-desc">이번 달 점수 · 랭킹</div>') > 0 && src0.indexOf('<small id="plan-sc-sub">이번 달 점수와 Top 5</small>') > 0; })());
  t('서버 쓰기(upsert·insert·update·delete) 없음 — 읽기만', (await P(() => __ups.length)) === 0, await P(() => __ups.map((u) => u.tbl + ':' + u.key).join(',')));
  t('랭킹은 캐시 — 같은 달을 두 번 보면 질의는 한 번(planner_ranking_' + PREV + ')', (await P((k) => __gets.filter((x) => x === k).length, 'planner_ranking_' + PREV)) === 1, await P(() => __gets.join(',')));

  /* 전체 scores 가 빌 때만 화면 전체 빈 안내 */
  await P(() => { plannerData = { scores: {}, weekly: {} }; renderPlannerScoreScreen(); }); await wait(300);
  S = await st();
  t('전체 scores 가 비면 예전처럼 화면 전체 빈 안내(달 고르기 줄 없음)', S.allEmpty, S.txt.slice(0, 80));

  /* ⑤ ES5 · 버전 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-160: 「이번 달」 탭의 달 고르기 — PS_YM'), i1 = src.indexOf('// 내 점수 집계 (v1-18');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 있음(psYM·psAddYM·psYmLabel·psMonthMove·psYmBarHtml)', i0 > 0 && i1 > i0 && /function psYM\(\)/.test(blk) && /function psAddYM\(/.test(blk) && /function psYmLabel\(/.test(blk) && /window\.psMonthMove = function/.test(blk) && /function psYmBarHtml\(/.test(blk));
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk), '');
  t('STU_VER 갱신 · 버전 로그에 v2-160 줄 · 달 고르기 CSS(.ps-ym) 있음 · 집계 시작 PLANNER_SCORE_START_DATE 그대로', /v2-160 \(2026-11-05\)/.test(src) && src.indexOf("var STU_VER = 'v2-160'") > 0 && src.indexOf('.ps-ym {') > 0 && src.indexOf("var PLANNER_SCORE_START_DATE = '2026.05.01'") > 0);
  t('고정 주소 student_v1.html 은 그대로(v2-160 아님)', !fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-160'") < 0);
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-planner', 'screen-planner-score', 'planner-score-body', 'hw-home'].every((id) => !!document.getElementById(id))));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));

  if (process.env.SHOT) {
    try {
      await pg.evaluate(MOCK, { prevDot: dot(PREV), curDot: dot(CUR), prev2Dot: dot(PREV2), W_PREV, W_CUR, PREV, CUR });
      await openScreen(); await P(() => setPlannerScoreRange('month')); await wait(300); await P(() => psMonthMove(-1)); await wait(500);
      await P(() => window.scrollTo(0, 0));
      await pg.screenshot({ path: process.env.SHOT }); console.log('📸 ' + process.env.SHOT);
    } catch (e) { console.log('스크린샷 실패', e.message); }
  }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
