#!/usr/bin/env node
/* 학원앱 v19-112 검사 — 적중 분석 안에 «📚 교과서 일치» · 난이도 /9 (원장 2026-10-12 「교과서 일치는 적중분석 내부에 있어야 한다. 잘 보이게 표시하고,
 *   난이도를 수학비서 난이도 9로 하라고 했는데 왜 5인가? 그리고 옥길중에 교과서 일치 여부는 표시가 안 되었다.」)
 *   가짜 옥길중 중1 = 실제 모양: 문항 23개(서술형 나눔 3개는 mergedInto → 보이는 20) · 문항 diff 는 비어 있음(null) · exam.msLv 20개 · stats.past 없음 · stats.pub 있음
 *   ① 난이도: msLv 평균 «/9» (평균 = msLv 평균) · 킬러 = 6 이상 · 블로그 자료도 /9 / diff 있는 시험은 diff 평균 그대로 / 둘 다 없으면 «/5» + 「수학비서 DB화 전」
 *   ② 숫자 칸 「📚 교과서 일치」 5/20 · 학교 교과서 3 · 다른 출판사만 2 · 누르면 #pb-block 으로 스크롤
 *   ③ #pb-block 이 도넛 바로 아래 — 「우리 자료별 적중」(hts-bykind) · 지난 기출(pc-block) 보다 앞 · 제목 · 학교 교과서 표 · 「학교 교과서엔 없음」 1번 2번
 *   ④ 메뉴(GROUPS)에 tbmatch 없음 · 머리 단추 → 교과서일치도 · 「← 적중 분석」 → 돌아옴(HT.cur 그대로)
 *   ⑤ 시험 칩 📚 (출판사 비교 있는 시험만) · 왼쪽 목록에도
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19112.js lumen_v19-112.html
 *   그림: $SP/v19112_summary.png (옥길중 중1 요약) · $SP/v19112_nodb.png (수학비서 DB화 전 시험 요약)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수·시험 문항 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-112.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-112'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const C1 = '옥길중_중1_2026_2_중간', S2 = '소사고_고2_2026_2_중간', R3 = '범박고_고1_2026_2_중간', D4 = '옥길중_중1_2025_2_중간_시범';
const SVG = (c, txt) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><rect width="320" height="90" fill="' + c + '"/><text x="14" y="52" font-size="18" fill="#334155">' + txt + '</text></svg>');
const PB = (pub, bid, id, page, no, kind, extra) => Object.assign({ k: 'pub:' + id, bid: String(bid), pub, page, no: String(no), kind, why: '같은 유형', imgUrl: SVG('#ecfdf5', pub + ' ' + page + '쪽') }, extra || {});
const MSLV = [2, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 6, 3, 2, 4, 6, 4, 4, 3];   /* 실제 옥길중 중1 과 같은 모양(20개) */
const MEAN = Math.round(MSLV.reduce((a, b) => a + b, 0) / MSLV.length * 10) / 10;
const LV = [1, 2, 2, 5, 2, 3, 4, 2, 2, 3, 3, 1, 4, 2, 1, 3, 4, 4, 3, 3, 3, 1, 2];
const BKS = [{ bid: '91', pub: '교학사', n: 799 }, { bid: '92', pub: '미래엔', n: 994 }, { bid: '93', pub: '비상', n: 959 }, { bid: '94', pub: '와이비엠', n: 1032 }];
const item = (no, o) => Object.assign({ no, cid: 800 + no, chapter: '단원', type: '유형', level: LV[(no - 1) % LV.length], diff: null, essay: no >= 20, killer: no === 4 || no === 17, img: '', imgUrl: SVG('#eff6ff', '시험 ' + no + '번'), cands: [], hit: null, repeat: [], pub: [] }, o || {});
const c1items = [];
for (let n = 1; n <= 23; n++) c1items.push(item(n));
[6, 12, 18].forEach((n) => { c1items[n - 1].mergedInto = n - 1; });   /* 매쓰플랫이 서술형을 (1)(2)로 나눈 것 → 앞 문항에 합침 */
c1items[0].pub = [PB('교학사', 91, 101, 125, '1', 'var'), PB('비상', 93, 102, 130, '2', 'text')];            /* 다른 출판사에서만 */
c1items[1].pub = [PB('와이비엠', 94, 201, 40, '3', 'var')];                                                  /* 다른 출판사에서만 */
c1items[4].pub = [PB('비상', 93, 501, 60, '5.(1)', 'var'), PB('미래엔', 92, 502, 61, '5.(2)', 'var')];        /* 학교 교과서 */
c1items[5].pub = [PB('비상', 93, 601, 62, '4', 'var')];                                                      /* 합쳐진 문항 — 세지 않음 */
c1items[6].pub = [PB('비상', 93, 701, 70, '1', 'same')];                                                     /* 학교 교과서 */
c1items[8].pub = [PB('비상', 93, 901, 80, '2', 'text')];                                                     /* 지문 겹침만 */
c1items[12].pub = [PB('교학사', 91, 1301, 90, '7', 'var', { rejected: true })];                              /* ✗ 아님 */
c1items[13].pub = [PB('미래엔', 92, 1401, 91, '8', 'type')];
c1items[18].pub = [PB('비상', 93, 1901, 99, '3', 'var'), PB('와이비엠', 94, 1902, 98, '6', 'var')];           /* 학교 교과서 */
const STORE = {
  mf_textbooks: { books: { '93': { type: 'SCHOOL', grade: '1', title: '교과서_비상', fulltitle: '교과서_비상 - 중등수학1', publisher: '비상' } },
    bySchoolGrade: { '옥길중|중1': { n: 7, books: { '93': 7 } } } },
  exam_hit_index: { items: [
    { examId: S2, school: '소사고', grade: '고2', year: 2026, semester: '2', term: '중간', total: 6, at: '2026-10-12T05:00:00Z' },
    { examId: R3, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 4, at: '2026-10-12T04:00:00Z' },
    { examId: C1, school: '옥길중', grade: '중1', year: 2026, semester: '2', term: '중간', total: 23, at: '2026-10-12T03:00:00Z' },
    { examId: D4, school: '옥길중', grade: '중1', year: 2025, semester: '2', term: '중간', total: 2, at: '2026-10-04T12:00:00Z' } ] },
};
STORE['exam_hit_' + C1] = { examId: C1, exam: { school: '옥길중', grade: '중1', year: 2026, semester: '2', term: '중간', date: '2026-09-30', msId: 700001, mydb: null, msLv: MSLV },
  basis: 'same+var', students: ['AAA111'], items: c1items, mats: {},
  stats: { total: 23, byKind: { textbook: { mats: 10, hit: 0 }, ms: { mats: 0, hit: 0 }, upload: { mats: 0, hit: 0 }, ws: { mats: 5, hit: 0 }, book: { mats: 0, hit: 0 } },
    pub: { subject: '중등수학1', books: BKS, by: {}, items: 5 } } };
/* 소사고 고2 — PDF 로 올린 시험: msLv 없음 · 문항 diff 없음 */
STORE['exam_hit_' + S2] = { examId: S2, exam: { school: '소사고', grade: '고2', year: 2026, semester: '2', term: '중간', subject: '미적분1', mydb: null },
  basis: 'same+var', students: [], mats: {},
  items: [1, 2, 3, 4, 5, 6].map((n) => item(n, { level: [1, 2, 3, 4, 5, 3][n - 1], essay: false, killer: n >= 5, pub: n === 1 ? [PB('미래엔', 81, 3001, 14, '1', 'var')] : [] })),
  stats: { total: 6, pub: { subject: '미적분1', books: [{ bid: '81', pub: '미래엔', n: 505 }, { bid: '82', pub: '동아', n: 531 }], by: {}, items: 1 } } };
/* 범박고 고1 — 문항마다 diff 있음 · 지난 기출(stats.past) 있음 */
STORE['exam_hit_' + R3] = { examId: R3, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2', mydb: 715697 },
  basis: 'same+var', students: [], mats: {},
  items: [1, 2, 3, 4].map((n) => item(n, { diff: [3, 5, 6, 8][n - 1], level: 2, essay: false, killer: false, past: [], pub: n === 2 ? [PB('동아', 71, 4001, 50, '2', 'same')] : [] })),
  stats: { total: 4, pub: { subject: '공통수학2', books: [{ bid: '71', pub: '동아', n: 600 }], by: {}, items: 1 },
    past: { same: 0, var: 0, type: 0, text: 0, items: 0, exams: 2, years: 3, sameTerm: false, list: [{ mydb: '387519', exam: '2025 2학기 중간', year: 2025, sem: '2', term: '중간', n: 23 }] } } };
STORE['exam_hit_' + D4] = { examId: D4, exam: { school: '옥길중', grade: '중1', year: 2025, semester: '2', term: '중간' }, basis: 'same+var', students: [], mats: {},
  items: [item(1), item(2)], stats: { total: 2 } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], reads: [], likes: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: (cols) => ({
          eq: (k, v) => { T.reads.push(v); return Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }); },
          in: (k, arr) => Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T.store, x)).map((x) => ({ key: x })) }),
          /* 가벼운 읽기: key + value->stats->pub->>subject */
          like: (k, pat) => { T.likes.push(cols + ' ' + pat); const pre = pat.replace(/%$/, '');
            return Promise.resolve({ data: Object.keys(T.store).filter((x) => x.indexOf(pre) === 0).map((x) => ({ key: x, subj: (((T.store[x] || {}).stats || {}).pub || {}).subject || null })) }); } }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '옥길중', grade: '중학교 1학년', lumen_rec_code: 'AAA111' }];
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    HT.kicked = true; HT.idx = clone(STORE.exam_hit_index); HT.req = { status: 'done' }; HT.cur = '옥길중_중1_2026_2_중간'; HT.data = {}; HT.view = 'sheet';
  }, STORE);
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* ④-1 메뉴: tbmatch 없음 · 적중 분석으로 */
  const M = await pg.evaluate(async () => {
    const g = GROUPS.filter((x) => x.key === 'exams')[0], vs = g.subs.map((s) => s.v);
    subGo('exams', vs.indexOf('examhit')); htLoad(HT.cur, true); await new Promise((r) => setTimeout(r, 400)); render(); await new Promise((r) => setTimeout(r, 200));
    return { vs, view: VIEW, bar: [...document.querySelectorAll('#SUBTAB_BAR .stab')].map((b) => b.textContent) };
  });
  t('메뉴(GROUPS 「📝 시험·기출」)에 「교과서일치도」 칸 없음 · 위 가로 탭에도 없음', M.vs.indexOf('tbmatch') < 0 && M.vs.indexOf('examhit') >= 0 && !M.bar.some((b) => /교과서일치도/.test(b)) && M.view === 'examhit', JSON.stringify(M));

  /* ①②③ 옥길중 중1 요약 */
  const A = await pg.evaluate(() => {
    const CT = document.getElementById('CONTENT');
    const tiles = [...CT.querySelectorAll('.ht-tiles .ht-tile')].map((x) => x.textContent);
    const tile = CT.querySelector('#tb112-tile'), pb = CT.querySelector('#pb-block'), by = CT.querySelector('#hts-bykind'), grid = CT.querySelector('.ht-grid'), trend = [...CT.querySelectorAll('.ht-card')][1];
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const card = pb ? pb.closest('.ht-card') : null;
    return { tiles, tile: tile ? tile.textContent : '', tileInRow: !!(tile && tile.parentElement.classList.contains('ht-tiles')), tileBorder: tile ? getComputedStyle(tile).borderTopWidth : '',
      pb: !!pb, head: (CT.querySelector('#pb-head') || {}).textContent || '', pbBeforeBy: before(pb, by), gridBeforePb: before(grid, pb), hasBy: !!by,
      gap: (pb && grid) ? Math.round(pb.getBoundingClientRect().top - grid.getBoundingClientRect().bottom) : -1, next: !!(pb && grid && grid.nextElementSibling === pb), inCard: !!(card && grid && card.contains(grid)),
      sum: (CT.querySelector('#pb-sum') || {}).textContent || '', own: [...CT.querySelectorAll('#pb-block tr[data-pbown]')].map((r) => r.getAttribute('data-pbpub') + ':' + r.children[0].textContent),
      only: (CT.querySelector('#pb-only') || {}).textContent || '', onlyLinks: [...CT.querySelectorAll('#pb-only [data-pbonly]')].map((a) => a.getAttribute('data-pbonly')),
      md: htMd(HT.data[HT.cur]), visible: htVisible(HT.data[HT.cur]).length };
  });
  t('평균 난도 = 수학비서 시험 전체 난이도(msLv 20개) 평균 ' + MEAN + ' «/9» (문항 diff 비어 있음 · 문항 23개 ≠ 20)',
    A.tiles.some((x) => x === MEAN + '/9평균 난도 (수학비서 1~9)') && !A.tiles.some((x) => /\/5/.test(x)), JSON.stringify(A.tiles));
  t('킬러 = 수학비서 6 이상 2문항 · 어려움(5↑) 2', A.tiles.some((x) => x === '2☠ 킬러 (수학비서 6 이상) · 어려움(5↑) 2'), JSON.stringify(A.tiles));
  t('블로그 자료(.md)도 «/ 9 (수학비서 난이도)»', / \/ 9 \(수학비서 난이도\)/.test(A.md) && !/ \/ 5 /.test(A.md), (A.md.match(/- 총 문항.*$/m) || [''])[0]);
  t('숫자 칸 줄에 「📚 교과서 일치」 5/20 · 학교 교과서 3 · 다른 출판사만 2 (굵은 테두리)',
    A.tileInRow && A.tile === '5/20📚 교과서 일치학교 교과서 3 · 다른 출판사만 2' && parseFloat(A.tileBorder) > 1.5 && A.visible === 20, JSON.stringify([A.tile, A.tileInRow, A.tileBorder]));
  t('#pb-block — 도넛·숫자 칸(.ht-grid) 바로 다음 · 「우리 자료별 적중」보다 앞 · 같은 요약 카드 안', A.pb && A.hasBy && A.gridBeforePb && A.pbBeforeBy && A.gap >= 0 && A.gap < 40 && A.next && A.inCard, JSON.stringify([A.gap, A.next, A.inCard, A.pbBeforeBy]));
  t('제목 「📚 교과서 일치 (같은 문제 + 숫자변형)」 · 한 줄 요약(학교 교과서 비상 3 · 다른 출판사에서만 2 · 어느 교과서든 5 / 20)',
    /^📚 교과서 일치 \(같은 문제 \+ 숫자변형\)/.test(A.head) && /학교 교과서\(비상\)와 일치 3문항/.test(A.sum) && /다른 출판사에서만 2문항/.test(A.sum) && /어느 교과서든 5 \/ 20문항/.test(A.sum), A.head + ' / ' + A.sum);
  t('학교 교과서 줄(비상)에 「학교 교과서」 표', JSON.stringify(A.own) === '["비상:비상 학교 교과서"]', JSON.stringify(A.own));
  t('「학교 교과서엔 없음」 2문항: 1번(교학사) · 2번(와이비엠) — 합친 문항·✗ 아님·지문 겹침은 안 셈',
    /🟧 학교 교과서엔 없음 — 2문항: 1번\(교학사\) · 2번\(와이비엠\)$/.test(A.only) && JSON.stringify(A.onlyLinks) === '["1","2"]', A.only);
  await pg.setViewportSize({ width: 1400, height: 2600 }); await settle(300);
  await pg.evaluate(() => { const h = document.querySelector('.ui-scroll-hint, #uiScrollHint'); if (h) h.style.display = 'none'; });
  await pg.locator('#pb-block').evaluate((e) => e.closest('.ht-card').id = 'shot112');
  await pg.locator('#shot112').screenshot({ path: SP + '/v19112_summary.png' });
  await pg.setViewportSize({ width: 1400, height: 900 }); await settle(300);

  /* ② 칸 누르면 스크롤 */
  const B = await pg.evaluate(async () => {
    const CT = document.getElementById('CONTENT'), pb = document.getElementById('pb-block');
    const scrollers = [document.scrollingElement, CT].concat([...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.contains(pb)));
    scrollers.forEach((s) => { if (s) s.scrollTop = s.scrollHeight; }); await new Promise((r) => setTimeout(r, 100));
    const t0 = Math.round(pb.getBoundingClientRect().top);
    document.getElementById('tb112-tile').click(); await new Promise((r) => setTimeout(r, 1200));
    let sc = pb.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const top = sc ? Math.max(0, Math.round(sc.getBoundingClientRect().top)) : 0;
    return { t0, t1: Math.round(pb.getBoundingClientRect().top), top, vh: innerHeight };
  });
  t('「📚 교과서 일치」 칸을 누르면 #pb-block 으로 스크롤', B.t0 < 0 && B.t1 - B.top >= -2 && B.t1 - B.top < 40, JSON.stringify(B));

  /* ⑤ 칩 · 왼쪽 목록 📚 */
  const Ch = await pg.evaluate(() => {
    const chips = [...document.querySelectorAll('#CONTENT .ht-chip')].filter((b) => /htPick/.test(b.getAttribute('onclick') || '')).map((b) => b.textContent);
    const left = [...document.querySelectorAll('#LIST_CONTENT [data-l3h-exam]')].map((b) => b.getAttribute('data-l3h-exam') + ':' + (b.querySelector('.tb112-mk') ? '📚' : '-'));
    return { chips, left, likes: T.likes.slice(), loaded: Object.keys(HT.data) };
  });
  const mk = (re) => Ch.chips.filter((c) => re.test(c))[0] || '';
  t('시험 칩: 출판사 비교 있는 소사고 고2 · 범박고 고1 · 옥길중 중1 은 「📚」, 2025 시범은 없음 (불러오지 않은 시험도 — 가벼운 읽기 1번)',
    / 📚$/.test(mk(/소사고 고2/)) && / 📚$/.test(mk(/범박고 고1/)) && / 📚$/.test(mk(/옥길중 중1 · 2026/)) && !/📚/.test(mk(/2025년/)) && Ch.chips.length === 4 && Ch.likes.length === 1 && /value->stats->pub->>subject/.test(Ch.likes[0]) && Ch.loaded.length === 1,
    JSON.stringify(Ch));
  t('왼쪽 시험 목록에도 📚', Ch.left.length === 4 && Ch.left.filter((x) => /📚$/.test(x)).length === 3 && /_시범:-$/.test(Ch.left[3]), JSON.stringify(Ch.left));

  /* ① 다른 두 시험 — diff 있는 시험 · 수학비서 DB화 전 */
  const D = await pg.evaluate(async () => {
    const out = {};
    for (const id of ['범박고_고1_2026_2_중간', '소사고_고2_2026_2_중간']) {
      htPick(id); await new Promise((r) => setTimeout(r, 300)); render(); await new Promise((r) => setTimeout(r, 100));
      const CT = document.getElementById('CONTENT'), pb = CT.querySelector('#pb-block'), pc = CT.querySelector('#pc-block'), by = CT.querySelector('#hts-bykind');
      out[id] = { tiles: [...CT.querySelectorAll('.ht-tiles .ht-tile')].map((x) => x.textContent),
        pbBeforePc: !!(pb && pc && (pb.compareDocumentPosition(pc) & Node.DOCUMENT_POSITION_FOLLOWING)), pbBeforeBy: !!(pb && by && (pb.compareDocumentPosition(by) & Node.DOCUMENT_POSITION_FOLLOWING)),
        only: (CT.querySelector('#pb-only') || {}).textContent || '', tile: (CT.querySelector('#tb112-tile') || {}).textContent || '', md: htMd(HT.data[id]) };
    }
    return out;
  });
  const r3 = D['범박고_고1_2026_2_중간'], s2 = D['소사고_고2_2026_2_중간'];
  t('문항 diff 있는 시험(범박고 고1)은 지금처럼 diff 평균 5.5/9', r3.tiles.some((x) => x === '5.5/9평균 난도 (수학비서 1~9)'), JSON.stringify(r3.tiles));
  t('지난 기출 칸이 있어도 #pb-block 이 지난 기출·우리 자료별 적중보다 앞', r3.pbBeforePc && r3.pbBeforeBy, JSON.stringify(r3));
  t('학교 교과서를 모르는 시험: 칸 「학교 교과서 모름 · 어느 교과서든 1」 · 「셀 수 없습니다」', r3.tile === '1/4📚 교과서 일치학교 교과서 모름 · 어느 교과서든 1' && /학교 교과서를 몰라 셀 수 없습니다/.test(r3.only), r3.tile + ' / ' + r3.only);
  t('수학비서 난이도가 없는 시험(소사고 고2): «/5» + 「평균 난도 (매쓰플랫 1~5 · 수학비서 DB화 전)」 · 킬러도 같은 말',
    s2.tiles.some((x) => x === '3/5평균 난도 (매쓰플랫 1~5 · 수학비서 DB화 전)') && s2.tiles.some((x) => x === '2☠ 킬러 (매쓰플랫 난도 4·5 · 수학비서 DB화 전)'), JSON.stringify(s2.tiles));
  await pg.setViewportSize({ width: 1400, height: 2600 }); await settle(300);
  await pg.locator('#pb-block').evaluate((e) => e.closest('.ht-card').id = 'shot112b');
  await pg.locator('#shot112b').screenshot({ path: SP + '/v19112_nodb.png' });
  await pg.setViewportSize({ width: 1400, height: 900 }); await settle(300);

  /* ④-2 머리 단추 → 교과서일치도 → 「← 적중 분석」 */
  const E = await pg.evaluate(async () => {
    htPick('옥길중_중1_2026_2_중간'); await new Promise((r) => setTimeout(r, 100)); render();
    const r = {}; const btn = document.getElementById('tb112-open');
    r.btn = btn ? btn.textContent : ''; r.btnRow = btn ? [...btn.parentElement.querySelectorAll('button')].map((b) => b.textContent) : [];
    btn.click(); await new Promise((x) => setTimeout(x, 500));
    r.view = VIEW; r.tbmCur = TBM.cur; r.head = (document.querySelector('#LIST_CONTENT .l3-vhead') || {}).textContent || '';
    r.back = (document.getElementById('tbm-tohit') || {}).textContent || ''; r.rows = [...document.querySelectorAll('#CONTENT tr[data-tbm-row]')].map((x) => x.getAttribute('data-tbm-row'));
    r.title = (document.getElementById('RIGHT_TITLE') || {}).textContent;
    document.getElementById('tbm-tohit').click(); await new Promise((x) => setTimeout(x, 400));
    r.view2 = VIEW; r.cur2 = HT.cur; r.bar = ([...document.querySelectorAll('#SUBTAB_BAR .stab.on')][0] || {}).textContent; r.pb2 = !!document.querySelector('#CONTENT #pb-block');
    return r;
  });
  t('적중 분석 머리 단추 줄(시험지 올리기 · 기출 DB · 새로고침 옆)에 「📚 교과서일치도 · 학교 전체 비교」',
    E.btn === '📚 교과서일치도 · 학교 전체 비교' && E.btnRow.some((x) => /시험지 올리기/.test(x)) && E.btnRow.some((x) => /새로고침/.test(x)), JSON.stringify(E.btnRow));
  t('누르면 VIEW tbmatch(전체 한눈에) · 왼쪽 머리 「📚 교과서일치도」 · 출판사 비교 시험 3개', E.view === 'tbmatch' && E.tbmCur === '' && /📚 교과서일치도/.test(E.head) && E.rows.length === 3 && (E.title == null || E.title === '📚 교과서일치도'), JSON.stringify(E));
  t('「← 적중 분석」 → VIEW examhit · HT.cur 그대로(옥길중 중1) · 위 탭 적중 분석 · 교과서 일치 칸', E.back === '← 적중 분석' && E.view2 === 'examhit' && E.cur2 === '옥길중_중1_2026_2_중간' && /적중 분석/.test(E.bar) && E.pb2, JSON.stringify(E));

  /* 420px(PC 화면으로) — 가로 스크롤 없음 */
  await pg.setViewportSize({ width: 420, height: 860 }); await settle(400);
  const P = await pg.evaluate(async () => {
    try { mobSetPc(true); } catch (e) {}
    VIEW = 'examhit'; render(); await new Promise((x) => setTimeout(x, 150));
    const CT = document.getElementById('CONTENT');
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, tile: !!CT.querySelector('#tb112-tile'), pb: !!CT.querySelector('#pb-block'),
      wide: [...CT.querySelectorAll('.ht-wrap *')].filter((e) => { const b = e.getBoundingClientRect(); let p = e.parentElement, sc = false; while (p && p !== CT) { if (/auto|scroll/.test(getComputedStyle(p).overflowX)) sc = true; p = p.parentElement; } return !sc && b.width > 0 && b.right > innerWidth + 1; }).map((e) => e.tagName + '#' + e.id + '.' + e.className).slice(0, 5) };
  });
  t('420px(PC 화면): 가로 스크롤 없음 · 교과서 일치 칸·칸 모두 보임', P.sw <= P.iw && !P.wide.length && P.tile && P.pb, JSON.stringify(P));

  t('페이지 오류 없음', errs.length === 0, errs.join(' / '));
  await br.close();
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
