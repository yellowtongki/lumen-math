#!/usr/bin/env node
/* 학원앱 v19-158 검사 — 📅 운영 달력 (가짜 계획 · 가짜 서버)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19158.js lumen_v19-158.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-158.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const PLAN = {
  year: 2026, themes: ['1','2','3','4','5','6','7','8','9','10','수능','12'], keywords: [[],[],[],[],[],[],[],[],[],[],['대수능','수험생 할인'],[]],
  tax: [['2026-11-10', '원천세 납부']], schoolExtra: [['2026-11-19', '수능']],
  events: [{ id: 'e1', n: '겨울특강 모집 시작', type: '신규모집', date: '2026-11-02', d: [[-14, '원장', '커리큘럼 확정'], [0, '실장', '모집 시작 안내'], [6, '실장', '신청 현황 확인']] },
           { id: 'e2', n: '간담회', type: '간담회', date: '2026-12-12', d: [[-21, '원장', '간담회 주제 확정']] }],
  regular: [{ rule: 'day', d: 20, L: 'money', who: '실장', t: '결제선생 청구서 발송', st: ['대조', '발송'], man: '수납' },
            { rule: 'day', d: 30, L: 'money', who: '실장', t: '2차 파기 확인', st: ['확인'] },
            { rule: 'firstMon', L: 'kpi', who: '실장', t: '지난주 지표 입력', st: ['플레이스', '블로그', '당근'] }],
  mkt: { channels: ['블로그', '인스타'], steps: { '블로그': ['글감', '본문', '검수'], '인스타': ['카드', '올리기'] },
         exam: [['start', -21, '블로그', '{w} 시험범위'], ['end', 3, '블로그', '{w} 후기']], recruit: [[0, '인스타', '특강 카드뉴스'], [3, '당근', '광고']], special: [['2026-11-18', '인스타', '수능 응원']] },
  manuals: [{ name: '수납', rank: 'r2', cycle: 'regular', timing: '매월 20일', steps: ['대조', '발송'], done: '다 보냄', ex: ['환불은 원장'] },
            { name: '매일테스트 출력', rank: 'r4', cycle: 'daily', steps: ['배정 확인', '출력'] }],
  ranks: { r1: '원장', r2: '실장', r3: '강사', r4: '조교' },
  kpi: { year: 2026, goal: 50, ask: [1,0,0,0,0,0,0,0,0,0,0,0], reg: [2,0,0,1,0,0,0,0,0,0,0,0], out: [1,0,0,0,0,0,0,0,0,0,0,0] },
  traffic: { weeks: ['7/5', '7/12'], rows: { '플레이스 방문': [70, 91] } }
};
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-158');
  t('시작 다운로드에서 ops_plan·ops_checks 뺌', await pg.evaluate(() => PULL_SKIP_KEYS.indexOf('ops_plan') >= 0 && PULL_SKIP_KEYS.indexOf('ops_checks') >= 0));
  t('홈 탭에 📅 운영 달력', await pg.evaluate(() => GROUPS[0].subs.some((x) => x.v === 'opscal')));
  await pg.evaluate((PLAN) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    students.length = 0; students.push({ id: 'S1', name: '홍길동', grade: '중학교 3학년', school: '옥길중학교', lumen_rec_code: 'AAA111' });
    window.__STORE = { ops_plan: PLAN, ops_checks: { 'x|old': 1 } }; window.__SETS = [];
    const q = (rows) => ({ data: rows, error: null });
    window.getSupaClient = function(){ return { from(){ const o = { _k: null, select(){ return o; }, in(c, ks){ o._k = ks; return o; }, eq(c, k){ o._k = [k]; return o; },
      then(res){ res(q((o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })))); } }; return o; } }; };
    window.supaSetItem = function(k, v){ window.__SETS.push([k, JSON.parse(JSON.stringify(v))]); window.__STORE[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(true); };
    CT.loaded = true; CT.ev = { items: [{ id: 'a1', kind: 'off', title: '학원 휴원', from: '2026-11-21' }] }; CT.dd = [];
    CT.sc = { schools: [{ name: '옥길중학교', exams: [{ from: '2026-11-25', to: '2026-11-27', label: '2학기 기말' }] }] };
    OPS.y = 2026; OPS.m = 11; OPS.sel = '2026-11-02'; VIEW = 'opscal'; render();
  }, PLAN);
  await pg.waitForTimeout(500);
  const txt = await pg.evaluate(() => document.querySelector('.o8') ? document.querySelector('.o8').innerText : '');
  t('운영 달력이 그려진다 (11월 · 테마 수능 #대수능)', /2026년 11월/.test(txt) && /수능 #대수능/.test(txt), txt.slice(0, 200));
  const it = await pg.evaluate(() => opsItems(2026, 11).map((x) => x.d + '|' + x.L + '|' + (x.who || '') + '|' + x.t));
  const has = (s) => it.some((x) => x.indexOf(s) >= 0);
  t('운영 D-업무: 11/2 실장 모집 시작 · 11/8(일)→11/7(토) 신청 현황', has('2026-11-02|ops|실장|모집 시작 안내') && has('2026-11-07|ops|실장|신청 현황 확인'), it.join('\n'));
  t('10월 D-14 업무는 11월에 안 나옴', !has('커리큘럼 확정'));
  t('정기: 20일 청구 · 30일 2차 파기 · 첫 월요일(11/2) 지표', has('2026-11-20|money|실장|결제선생 청구서 발송') && has('2026-11-30|money|실장|2차 파기 확인') && has('2026-11-02|kpi|실장|지난주 지표 입력'));
  t('세금 · 학교 행사 · 학원 일정(학원 달력)', has('2026-11-10|money|원장|원천세 납부') && has('2026-11-19|sch||수능') && has('2026-11-21|acad||학원 휴원'));
  t('나이스 시험 3일 (11/25~27)', has('2026-11-25|sch||옥길중 2학기 기말') && has('2026-11-27|sch||옥길중 2학기 기말'));
  t('모집 마케팅: 쓰는 채널만 (인스타 O · 당근 X)', has('2026-11-02|mkt|원장|인스타: 특강 카드뉴스') && !has('당근: 광고'));
  t('시험 물결 마케팅: 시작 3주 전(11/4) · 끝 3일 뒤(11/30) · 기념일', has('2026-11-04|mkt|원장|블로그: 2학기 기말 시험범위') && has('2026-11-30|mkt|원장|블로그: 2학기 기말 후기') && has('2026-11-18|mkt|원장|인스타: 수능 응원'));
  t('오른쪽 그날 할 일 칸 없음 · 달력 아래 체크리스트', await pg.evaluate(() => !document.querySelector('.dayp') && /11월 체크리스트/.test(document.querySelector('.o8').innerText)));
  t('선택 날짜(11/2) 줄이 파랗게', (await pg.$$eval('.o8-ck.hl', (e) => e.length)) >= 3);
  await pg.evaluate(() => opsPick('2026-11-20')); await pg.waitForTimeout(150);
  t('날짜 누르면 그날로 바뀜', (await pg.$$eval('.o8-ck.hl', (e) => e.map((x) => x.innerText).join('|'))).indexOf('결제선생 청구서 발송') >= 0);
  /* 체크 */
  await pg.evaluate(() => opsTick('2026-11-20|결제선생 청구서 발송#0', true, '2026-11-20|결제선생 청구서 발송', 2)); await pg.waitForTimeout(150);
  t('단계 1/2 → 아직 완료 아님', await pg.evaluate(() => !OPS.ck['2026-11-20|결제선생 청구서 발송']));
  await pg.evaluate(() => opsTick('2026-11-20|결제선생 청구서 발송#1', true, '2026-11-20|결제선생 청구서 발송', 2)); await pg.waitForTimeout(150);
  const last = await pg.evaluate(() => window.__SETS.slice(-1)[0]);
  t('단계 다 체크 → 자동 완료 · 서버 ops_checks 에 저장 (옛 체크 보존)', last[0] === 'ops_checks' && last[1]['2026-11-20|결제선생 청구서 발송'] === 1 && last[1]['x|old'] === 1, JSON.stringify(last));
  t('달력 칸에 ✓', /✓ 결제선생/.test(await pg.evaluate(() => document.querySelector('.o8-cal').innerText)));
  await pg.evaluate(() => opsTick('2026-11-20|결제선생 청구서 발송', false)); await pg.waitForTimeout(150);
  t('체크 해제도 서버에 반영', await pg.evaluate(() => !window.__STORE.ops_checks['2026-11-20|결제선생 청구서 발송']));
  t('매일 체크리스트(매일테스트 출력 · 조교)', /매일테스트 출력/.test(await pg.evaluate(() => document.querySelector('.o8-daily').innerText)));
  /* 층 · 담당 */
  await pg.evaluate(() => { OPS.on.mkt = 0; render(); });
  t('마케팅 층 끄면 달력에서 빠짐', !/특강 카드뉴스/.test(await pg.evaluate(() => document.querySelector('.o8-cal').innerText)));
  await pg.evaluate(() => { OPS.on.mkt = 1; OPS.who = '조교'; render(); });
  const wt = await pg.evaluate(() => document.querySelector('.o8-cg').innerText);
  t('담당 조교 → 실장 일 안 보임, 학교 일정은 보임', !/결제선생/.test(wt) && /옥길중/.test(wt));
  await pg.evaluate(() => { OPS.who = '전체'; OPS.view = 'year'; render(); });
  const yt = await pg.evaluate(() => document.querySelector('.o8-year').innerText);
  t('1년 한눈에: 12달 · 3월 운영 계획 없음 · 11월 행사', (await pg.$$eval('.o8-mon', (e) => e.length)) === 12 && /운영 계획 없음/.test(yt) && /겨울특강 모집 시작/.test(yt));
  await pg.evaluate(() => { OPS.view = 'kpi'; render(); });
  const kt = await pg.evaluate(() => document.querySelector('.o8').innerText);
  t('목표·지표: 3 / 50 · 퇴원 1 · 순증 +2 · 방문표', /3\s*\/ 50/.test(kt) && /순증\s*\+2/.test(kt) && /플레이스 방문/.test(kt), kt.slice(0, 300));
  await pg.evaluate(() => { OPS.view = 'month'; opsMan('수납'); });
  t('매뉴얼 창 (2쪽)', /1쪽[\s\S]*대조[\s\S]*2쪽[\s\S]*환불은 원장/.test(await pg.evaluate(() => document.querySelector('.o8-modal').innerText)));
  await pg.setViewportSize({ width: 420, height: 900 }); await pg.evaluate(() => { OPS.man = ''; render(); });
  t('좁은 화면에서도 오류 없이 그려짐', !!(await pg.$('.o8-cal')));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
