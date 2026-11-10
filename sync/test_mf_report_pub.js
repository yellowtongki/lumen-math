#!/usr/bin/env node
/* 검사 — sync/mf_report_worker.js 루멘 학부모앱 공개(mfrep_pub_<코드>) · 2026-11-10
 *   가짜 fetch 로 매쓰플랫·Supabase 를 흉내 낸다(실서버·실계정에 아무것도 안 감). 이름·숫자는 지어낸 것.
 *   ① pubFromScoring — 매쓰플랫 숫자 그대로 · 지난달 · 단원 · 평가 · 교재 · 의견
 *   ② 공개(mf+lumen) → 매쓰플랫 share 1번 · mfrep_pub_<코드>.months[달] · 루멘 기록(숙제·아하·플래너) · 목록 rows[].lumen
 *   ③ 루멘만 공개 취소(mf:false) → 매쓰플랫 호출 없음 · 그 달만 지움(다른 달 그대로)
 *   ④ 옛 학원앱 요청(lumen 없음) → 루멘 저장 없음 · 매쓰플랫만
 *   ⑤ 학습코드 없는 학생 → 실패로 셈 · 다른 학생은 계속
 *   실행: node sync/test_mf_report_pub.js */
process.env.SUPABASE_URL = 'https://fake-sb.local'; process.env.SUPABASE_SERVICE_KEY = 'fake-service-key';
process.env.MATHFLAT_ID = 'fake-id'; process.env.MATHFLAT_PASSWORD = 'fake-pw';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STORE = {}, CALLS = [];
const SC = (id) => ({ request: {
  title: '2026년 10월 월간 리포트', startDate: '2026-10-01', endDate: '2026-10-31', rank: 3, correctRate: 79, scoringCount: 1092, level: 2, comparisonType: 'NATIONAL',
  components: ['MONTHLY', 'COMMENT'], commentComponent: { comment: '  10월 의견 글 ' + id + '  ' },
  monthlyComponent: {
    correctRatesPerMonth: [{ year: 2026, month: 8, student: 73, comparison: 73 }, { year: 2026, month: 9, student: 78, comparison: 74 }, { year: 2026, month: 10, student: 79, comparison: 74 }],
    scoringCountsPerMonth: [{ year: 2026, month: 8, student: 800, comparison: 500 }, { year: 2026, month: 9, student: 950, comparison: 520 }, { year: 2026, month: 10, student: 1092, comparison: 530 }] },
  weeklyComponent: { scoringCountsPerWeek: [{ week: 2, student: 197 }, { week: 3, student: 262 }], correctRatesPerWeek: [{ week: 2, student: 80 }, { week: 3, student: 77 }],
    correctRatesPerLevel: [{ level: 1, student: 84, comparison: 88 }, { level: 5, student: 11, comparison: 55 }], scoringCountsPerLevel: [{ level: 1, student: 300 }, { level: 5, student: 9 }] },
  studyHistoryComponent: { scoringCountsPerStudyType: { workbook: 819, worksheet: 273, levelUpOrWrongAnswer: 0, challenge: 0, cas: 0, total: 1092 },
    workbooks: [{ type: 'SCHOOL', title: '교과서A', scoringStartPageNumber: 146, scoringEndPageNumber: 147, scoringCount: 2, correctRate: 100 }, { type: 'PUBLIC', title: '문제집B', scoringStartPageNumber: 10, scoringEndPageNumber: 40, scoringCount: 300, correctRate: 81 }],
    worksheets: [{ title: 't', scoringDatetime: '2026-10-06', scoringCount: 20, correctRate: 70 }] },
  studyPerformanceComponent: { middleChapters: [{ name: '일차함수', scoringCount: 40, correctRate: 64 }, { name: '빈칸', scoringCount: 0, correctRate: 0 }] },
  studyEvaluationComponent: { studyEvaluationSections: [{ behaviorSections: [{ type: 'REASONING_ABILITY', studentRank: 3, studentCorrectRate: 77, comparisonCorrectRate: 75 }] }] } } });

global.fetch = async (url, opt) => {
  opt = opt || {}; const method = opt.method || 'GET'; const u = String(url);
  const J = (x, h) => ({ ok: true, status: 200, headers: { get: (k) => (h || {})[String(k).toLowerCase()] || null }, json: async () => x, text: async () => JSON.stringify(x) });
  CALLS.push(method + ' ' + u.replace(/^https?:\/\/[^/]+/, ''));
  if (u.startsWith('https://api.mathflat.com') || u.startsWith('https://ai.mathflat.com')) {
    const p = u.replace(/^https:\/\/[^/]+/, '');
    if (p === '/v2/login') return J({ accessToken: 'tok' });
    if (p.startsWith('/students')) return J({ data: { content: [{ id: 'S1', status: 'ACTIVE', name: '○○○', schoolType: 'MIDDLE', grade: 2 }, { id: 'S2', status: 'ACTIVE', name: '○○○', schoolType: 'MIDDLE', grade: 1 }] } });
    if (/^\/v2\/report\/custom\/\d+\/scoring$/.test(p)) return J({ data: SC(p.split('/')[4]) });
    if (p.startsWith('/v2/report/custom?')) return J({ data: { content: [{ id: 101, studentId: 'S1', year: 2026, month: 10, createdAt: '2026-11-01', metric: {}, sharedToParent: false, pdfStatus: 'SUCCESS' }, { id: 102, studentId: 'S2', year: 2026, month: 10, createdAt: '2026-11-01', metric: {}, sharedToParent: false, pdfStatus: 'SUCCESS' }], last: true } });
    if (p.includes('/share/parent-app') || p.includes('/unshare/parent-app')) return J({ data: {} });
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ code: 'NF' }), text: async () => '{}' };
  }
  if (u.includes('/rest/v1/mf_students')) return J([{ mf_student_id: 'S1', lumen_rec_code: 'AAA111' }]);
  if (u.includes('/rest/v1/aha_notes')) return J([], { 'content-range': '0-0/3' });
  if (u.includes('/rest/v1/lumen_store')) {
    if (method === 'POST') { JSON.parse(opt.body).forEach((r) => { STORE[r.key] = JSON.parse(JSON.stringify(r.value)); }); return J(null); }
    const eq = u.match(/key=eq\.([^&]+)/); if (eq) { const k = decodeURIComponent(eq[1]); return J(k in STORE ? [{ key: k, value: STORE[k] }] : []); }
    const inn = u.match(/key=in\.\(([^)]*)\)/); if (inn) { const ks = decodeURIComponent(inn[1]).split(',').map((x) => x.replace(/"/g, '')); return J(ks.filter((k) => k in STORE).map((k) => ({ key: k, value: STORE[k] }))); }
    return J([]);
  }
  throw new Error('검사에서 막은 주소 ' + u);
};

const W = require('./mf_report_worker.js');
(async () => {
  /* ① */
  const P = W.pubFromScoring(SC(101), '2026-10', 101);
  t('① 숫자 그대로 — 정답률 79 · 문항 1092 · 등급 3 · 전국 74 · 지난달 78(2026-09)', P.rate === 79 && P.count === 1092 && P.rank === 3 && P.rateCmp === 74 && P.prevRate === 78 && P.prevM === '2026-09', JSON.stringify(P).slice(0, 200));
  t('① 3달 추이 · 주 · 난이도', P.months.length === 3 && P.months[2].n === 1092 && P.weeks[1].rate === 77 && P.levels[1].cmp === 55 && P.levels[1].n === 9, JSON.stringify([P.months, P.weeks, P.levels]));
  t('① 단원(0문항 뺌) · 평가 한국말 · 교재 많이 푼 순 · 학습지 수 · 의견 앞뒤 공백 정리', P.chapters.length === 1 && P.chapters[0].name === '일차함수' && P.evals[0].name === '추론' && P.books[0].title === '문제집B' && P.books[1].kind === '교과서' && P.sheets.n === 1 && P.comment === '10월 의견 글 101', JSON.stringify([P.chapters, P.evals, P.books[0], P.comment]));
  t('① 학생 이름은 넣지 않음', !/○○○/.test(JSON.stringify(P)), '');

  /* ② */
  STORE['hw_teach_AAA111'] = { byDate: { '2026-10-07': { t: 80 }, '2026-10-21': { t: 100 }, '2026-11-04': { t: 0 } } };
  STORE['student_planner_AAA111'] = { scores: { '2026.10.01': 90, '2026.10.15': 70, '2026.09.30': 10 } };
  await W.login(); await W.buildList('2026-10');
  STORE['mfrep_req'] = { status: 'requested', action: 'publish', month: '2026-10', ids: [101, 102], sms: false, mf: true, lumen: true, at: 'x' };
  CALLS.length = 0; await W.runReq();
  const shares = CALLS.filter((c) => c.includes('/share/parent-app'));
  const pub = STORE['mfrep_pub_AAA111']; const m = pub && pub.months && pub.months['2026-10'];
  t('② 매쓰플랫 공개 1번(두 명 한꺼번에)', shares.length === 1, JSON.stringify(shares));
  t('② mfrep_pub_AAA111.months["2026-10"] — 숫자·의견', !!m && m.rate === 79 && m.comment === '10월 의견 글 101' && pub.code === 'AAA111', JSON.stringify(pub).slice(0, 160));
  t('② 루멘 기록 — 숙제 90(10월 2번) · 아하 3 · 플래너 80(10월 2번)', m && m.lumen.hw === 90 && m.lumen.hwN === 2 && m.lumen.aha === 3 && m.lumen.plan === 80 && m.lumen.planN === 2, JSON.stringify(m && m.lumen));
  const rq = STORE['mfrep_req'];
  t('② 학습코드 없는 학생(S2) → 실패 1 · 루멘 성공 1 · 상태 done', rq.status === 'done' && rq.result.lumen === 1 && rq.result.fail === 1 && /102 루멘 학습코드 없음/.test(rq.result.errors.join()), JSON.stringify(rq.result));
  const rows = STORE['mfrep_2026-10'].rows; const r1 = rows.find((r) => r.sid === 'S1'), r2 = rows.find((r) => r.sid === 'S2');
  t('② 목록 rows — S1 code·lumen ✓ · S2 lumen ✗', r1.code === 'AAA111' && r1.lumen === true && !!r1.lumenAt && r2.lumen === false, JSON.stringify([r1.code, r1.lumen, r2.code, r2.lumen]));

  /* ③ */
  STORE['mfrep_pub_AAA111'].months['2026-09'] = { rate: 1 };
  STORE['mfrep_req'] = { status: 'requested', action: 'unpublish', month: '2026-10', ids: [101], mf: false, lumen: true, at: 'x' };
  CALLS.length = 0; await W.runReq();
  t('③ 루멘만 공개 취소 → 매쓰플랫 호출 없음', !CALLS.some((c) => c.includes('share/parent-app')), JSON.stringify(CALLS.filter((c) => c.includes('mathflat') || c.includes('share'))));
  t('③ 그 달만 지움 · 9월 그대로', !STORE['mfrep_pub_AAA111'].months['2026-10'] && !!STORE['mfrep_pub_AAA111'].months['2026-09'], JSON.stringify(Object.keys(STORE['mfrep_pub_AAA111'].months)));
  t('③ 목록 rows S1 lumen ✗', STORE['mfrep_2026-10'].rows.find((r) => r.sid === 'S1').lumen === false, '');

  /* ④ */
  delete STORE['mfrep_pub_AAA111'];
  STORE['mfrep_req'] = { status: 'requested', action: 'publish', month: '2026-10', ids: [101], sms: true, at: 'x' };
  CALLS.length = 0; await W.runReq();
  t('④ 옛 요청(lumen 없음) → 매쓰플랫만 · 루멘 저장 없음', CALLS.filter((c) => c.includes('/share/parent-app')).length === 1 && !STORE['mfrep_pub_AAA111'] && STORE['mfrep_req'].status === 'done', JSON.stringify(STORE['mfrep_req'].result));

  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
