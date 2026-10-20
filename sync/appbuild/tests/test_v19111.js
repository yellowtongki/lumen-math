#!/usr/bin/env node
/* 학원앱 v19-111 검사 — 📚 교과서일치도 (원장 2026-10-12 「교과서일치도 · 대비 학습지는 나중에 · 일치도는 숫자변형인가」, 시안 docs/mockup_textbook_match.html)
 *   ① 메뉴: 「📝 시험·기출」 에서 「🎯 적중 분석」 바로 뒤 「📚 교과서일치도」
 *   ② 전체 한눈에: 숫자 칸(시험 3 · 학교 교과서 일치 4/12 · 다른 출판사에서만 5 · 와이비엠 · 미래엔) · 과목마다 지도 표(공통수학2 · 중등수학1)
 *      칸 숫자 = 같은 문제+숫자변형 · 파란 테두리 = 학교 교과서(교과서 번호로 / 다른 과목 교과서면 출판사 이름으로) · 「다른 곳에서만」
 *      출판사 비교가 없는 시험(stats.pub 없음)은 안 보인다
 *   ③ 한 시험: 출판사별 표 · 번호 누르면 그 문항 그림 · 「학교 교과서에 없던 문항」 2개 → ✗ 아님 → 서버에 rejected 저장 · 1개로
 *      「🎯 적중 분석에서 보기」 → VIEW examhit · HT.cur
 *   ④ 오른쪽 도구 칸: 다음 시험 대비 추천 · 대비 학습지 «준비 중»(누를 수 없음) · 채팅 안내 · 블로그 자료(.md) — 「매쓰플랫」「수학비서」 없음
 *   ⑤ 820px · 420px(PC 화면): 가로 스크롤 없음 · 칩 · 도구는 아래에
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19111.js lumen_v19-111.html
 *   그림: $SP/v19111_overview.png (1400px 전체 한눈에) · $SP/v19111_exam.png (범박고 고1) · $SP/v19111_tablet.png (820px) · $SP/v19111_phone.png (420px PC 화면)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수·시험 문항 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-111.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-111'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const A = '범박고_고1_2026_2_중간', B = '소사고_고1_2026_2_중간', C = '옥길중_중1_2026_2_중간', D = '옥길중_중2_2026_2_중간';
/* 작은 그림(색만 다름) */
const SVG = (c, txt) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" fill="' + c + '"/><text x="16" y="66" font-size="20" fill="#334155">' + txt + '</text></svg>');
const PB = (pub, bid, id, page, no, kind, why) => ({ k: 'pub:' + id, bid: String(bid), pub, page, no: String(no), kind, why: why || '', imgUrl: SVG('#ecfdf5', pub + ' ' + page + '쪽 ' + no + '번') });
const IT = (no, pub) => ({ no, cid: 500 + no, chapter: '단원', type: '유형', level: 2, img: '', imgUrl: SVG('#eff6ff', '시험 ' + no + '번'), cands: [], hit: null, pub });
const BK2 = [{ bid: '11', pub: '비상교육', n: 535 }, { bid: '12', pub: '미래엔', n: 500 }, { bid: '13', pub: '동아', n: 600 }, { bid: '14', pub: '와이비엠', n: 480 }];
const STORE = {
  mf_textbooks: {
    books: { '11': { title: '교과서_비상교육 - 공통수학2' }, '999': { type: 'SCHOOL', title: '교과서_동아 - 공통수학1', fulltitle: '교과서_동아 - 공통수학1' }, '21': { title: '교과서_비상교육 - 중등수학1' } },
    bySchoolGrade: { '범박고|고1': { n: 3, books: { '11': 3 } }, '소사고|고1': { n: 2, books: { '999': 2 } }, '옥길중|중1': { n: 4, books: { '21': 4 } } } },
  exam_hit_index: { items: [
    { examId: A, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 5, at: '2026-10-11T12:00:00Z' },
    { examId: B, school: '소사고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 4, at: '2026-10-11T13:00:00Z' },
    { examId: C, school: '옥길중', grade: '중1', year: 2026, semester: '2', term: '중간', total: 3, at: '2026-10-12T01:00:00Z' },
    { examId: D, school: '옥길중', grade: '중2', year: 2026, semester: '2', term: '중간', total: 2, at: '2026-10-12T02:00:00Z' } ] },
};
/* 범박고 고1 — 학교 교과서 비상교육(교과서 번호로) · 2·3번이 다른 출판사에서만 */
STORE['exam_hit_' + A] = { examId: A, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2' }, basis: 'same+var',
  items: [
    IT(1, [PB('비상교육', 11, 101, 20, 1, 'same', '같은 문제'), PB('미래엔', 12, 102, 33, 4, 'var', '숫자만 다름')]),
    IT(2, [PB('미래엔', 12, 201, 41, 2, 'var', '숫자만 다름'), PB('동아', 13, 202, 50, 6, 'var', '조건 같고 숫자만')]),
    IT(3, [PB('와이비엠', 14, 301, 104, 9, 'same', '같은 극값 조건'), PB('비상교육', 11, 302, 70, 3, 'text', '지문만 비슷')]),
    IT(4, [PB('비상교육', 11, 401, 88, 5, 'var', '숫자만 다름')]),
    IT(5, [PB('동아', 13, 501, 12, 1, 'type')]) ],
  mats: {}, stats: { total: 5, pub: { subject: '공통수학2', books: BK2, by: {}, items: 4 } } };
/* 소사고 고1 — 배정 교과서가 동아 공통수학1(번호가 다름) → 출판사 이름으로 동아 */
STORE['exam_hit_' + B] = { examId: B, exam: { school: '소사고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2' }, basis: 'same+var',
  items: [
    IT(1, [PB('동아', 13, 601, 30, 2, 'same')]),
    IT(2, [PB('와이비엠', 14, 602, 77, 5, 'var', '숫자만 다름')]),
    IT(3, [PB('와이비엠', 14, 603, 86, 6, 'var'), PB('미래엔', 12, 604, 23, 1, 'same')]),
    IT(4, [PB('미래엔', 12, 605, 40, 3, 'text')]) ],
  mats: {}, stats: { total: 4, pub: { subject: '공통수학2', books: BK2, by: {}, items: 3 } } };
/* 옥길중 중1 — 중등수학1 */
STORE['exam_hit_' + C] = { examId: C, exam: { school: '옥길중', grade: '중1', year: 2026, semester: '2', term: '중간' }, basis: 'same+var',
  items: [IT(1, [PB('천재교육', 22, 701, 15, 3, 'var')]), IT(2, [PB('비상교육', 21, 702, 18, 4, 'same')]), IT(3, [])],
  mats: {}, stats: { total: 3, pub: { subject: '중등수학1', books: [{ bid: '21', pub: '비상교육', n: 400 }, { bid: '22', pub: '천재교육', n: 410 }], by: {}, items: 2 } } };
/* 옥길중 중2 — 출판사 비교 없음 → 화면에 안 나옴 */
STORE['exam_hit_' + D] = { examId: D, exam: { school: '옥길중', grade: '중2', year: 2026, semester: '2', term: '중간' }, basis: 'same+var', items: [IT(1), IT(2)], mats: {}, stats: { total: 2 } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], reads: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({
          eq: (k, v) => { T.reads.push(v); return Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }); },
          in: (k, arr) => Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T.store, x)).map((x) => ({ key: x })) }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '범박고', grade: '고등학교 1학년', lumen_rec_code: 'AAA111' }];
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    HT.kicked = true; HT.idx = clone(STORE.exam_hit_index); HT.req = null; HT.cur = ''; HT.data = {};
  }, STORE);
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);

  /* ① 메뉴 */
  /* v19-112 부터: 메뉴 칸 대신 적중 분석 머리 단추 「📚 교과서일치도 · 학교 전체 비교」로 연다 (원장 2026-10-12 「교과서 일치는 적중분석 내부에 있어야 한다」) */
  const V112 = Number(WANT.replace('v19-', '')) >= 112;
  const M = await pg.evaluate(async (V112) => {
    const g = GROUPS.filter((x) => x.key === 'exams')[0], vs = g.subs.map((s) => s.v);
    const i = vs.indexOf('tbmatch'), sub = g.subs[i];
    let btn = '';
    if (V112) { subGo('exams', vs.indexOf('examhit')); await new Promise((r) => setTimeout(r, 300)); const b = document.getElementById('tb112-open'); btn = b ? b.textContent : ''; if (b) b.click(); }
    else subGo('exams', i);
    await new Promise((r) => setTimeout(r, 400));
    const bar = [...document.querySelectorAll('#SUBTAB_BAR .stab')].map((b) => b.textContent);
    return { ver: APP_VER, i, hit: vs.indexOf('examhit'), label: sub && (sub.icon + ' ' + sub.label), view: VIEW, bar, btn, title: (document.getElementById('RIGHT_TITLE') || {}).textContent };
  }, V112);
  t('버전 ' + WANT, M.ver === WANT, M.ver);
  if (V112) {
    t('(v19-112) 메뉴엔 「교과서일치도」 칸 없음 · 적중 분석 머리 단추 「📚 교과서일치도 · 학교 전체 비교」 → VIEW tbmatch', M.i < 0 && M.btn === '📚 교과서일치도 · 학교 전체 비교' && M.view === 'tbmatch', JSON.stringify(M));
    t('(v19-112) 위 가로 탭엔 없음 (오른쪽 제목 칸이 있으면 그 이름)', !M.bar.some((b) => /교과서일치도/.test(b)) && (M.title == null || M.title === '📚 교과서일치도'), JSON.stringify([M.bar, M.title]));
  } else {
    t('메뉴 「📚 교과서일치도」 — 「🎯 적중 분석」 바로 뒤 · 누르면 VIEW tbmatch', M.i === M.hit + 1 && M.label === '📚 교과서일치도' && M.view === 'tbmatch', JSON.stringify(M));
    t('위 가로 탭에도 적중 분석 다음 (오른쪽 제목 칸이 있으면 그 이름)', M.bar.indexOf('📚교과서일치도') === M.bar.indexOf('🎯적중 분석') + 1 && (M.title == null || M.title === '📚 교과서일치도'), JSON.stringify([M.bar, M.title]));
  }
  await pg.evaluate(() => render()); await settle(100);

  /* ② 전체 한눈에 */
  const O = await pg.evaluate(() => {
    const CT = document.getElementById('CONTENT'), LC = document.getElementById('LIST_CONTENT'), TP = document.getElementById('TOOL_PANEL');
    const kp = [...CT.querySelectorAll('#tbm-kpis .tbm-kpi')].map((k) => k.querySelector('b').textContent + '|' + k.querySelector('span').textContent);
    const tables = [...CT.querySelectorAll('.tbm-subj')].map((s) => s.getAttribute('data-tbm-subj'));
    const rows = {}; CT.querySelectorAll('tr[data-tbm-row]').forEach((tr) => {
      const cells = {}; tr.querySelectorAll('[data-tbm-cell]').forEach((td) => { cells[td.getAttribute('data-tbm-cell')] = td.textContent + (td.classList.contains('own') ? '*' : '') + '/' + (td.className.match(/h\d/) || [''])[0]; });
      rows[tr.getAttribute('data-tbm-row')] = { cells, only: tr.querySelector('[data-tbm-onlycell]').textContent };
    });
    const heads = [...CT.querySelectorAll('.tbm-t')].map((tb) => [...tb.querySelectorAll('thead th')].map((th) => th.textContent).join(','));
    const left = [...LC.querySelectorAll('[data-tbm-left]')].map((b) => b.getAttribute('data-tbm-left') + ':' + b.textContent + (b.classList.contains('on') ? '(on)' : ''));
    const own = [...CT.querySelectorAll('td.own')].map((td) => { const s = getComputedStyle(td); return s.outlineStyle + ' ' + s.outlineColor; });
    return { kp, tables, rows, heads, left, def: (CT.querySelector('#tbm-def') || {}).textContent, own, fold: !!LC.querySelector('details.common-menu'), head: (LC.querySelector('.l3-vhead') || {}).textContent,
      tools: TP ? TP.textContent : '', tpw: TP ? getComputedStyle(TP).width : '', ws: TP && TP.querySelector('#tbm-ws') ? { dis: TP.querySelector('#tbm-ws').disabled, t: TP.querySelector('#tbm-ws').textContent } : null,
      rec: TP ? [...TP.querySelectorAll('[data-tbm-rec]')].map((e) => e.textContent) : [] };
  });
  t('맨 위 한 줄 「일치도 = 같은 문제 + 숫자변형 (지문 겹침·유사유형은 세지 않음)」', O.def === '일치도 = 같은 문제 + 숫자변형 (지문 겹침·유사유형은 세지 않음)', O.def);
  t('숫자 칸: 분석한 시험 3 · 학교 교과서 일치 4 / 12 · 다른 출판사에서만 5 · 자주 나온 곳 와이비엠 · 미래엔',
    O.kp.length === 4 && /^3\|분석한 시험/.test(O.kp[0]) && /^4 \/ 12\|학교 교과서와 일치한 문항$/.test(O.kp[1]) && /^5\|학교 교과서엔 없고/.test(O.kp[2]) && /^와이비엠 · 미래엔\|/.test(O.kp[3]), JSON.stringify(O.kp));
  t('표 2개: 공통수학2 · 중등수학1 (출판사 비교 없는 옥길중 중2 는 없음)', JSON.stringify(O.tables) === '["공통수학2","중등수학1"]' && !O.rows['옥길중_중2_2026_2_중간'], JSON.stringify(O.tables));
  t('공통수학2 열: 미래엔 · 와이비엠 · 동아 · 비상교육 · 다른 곳에서만', O.heads[0] === '시험,미래엔,와이비엠,동아,비상교육,다른 곳에서만', JSON.stringify(O.heads));
  const ra = (O.rows['범박고_고1_2026_2_중간'] || {}), rb = (O.rows['소사고_고1_2026_2_중간'] || {}), rc = (O.rows['옥길중_중1_2026_2_중간'] || {});
  t('범박고 고1: 미래엔 2 · 와이비엠 1 · 동아 1 · 비상교육 2(파란 테두리) · 다른 곳에서만 2문항',
    ra.cells && ra.cells['미래엔'] === '2/h1' && ra.cells['와이비엠'] === '1/h1' && ra.cells['동아'] === '1/h1' && ra.cells['비상교육'] === '2*/h1' && ra.only === '2문항', JSON.stringify(ra));
  t('소사고 고1: 학교 교과서 = 동아(공통수학1 배정 → 출판사 이름) · 비상교육 0 · 다른 곳에서만 «2문항 · 와이비엠 2»',
    rb.cells && rb.cells['동아'] === '1*/h1' && rb.cells['와이비엠'] === '2/h1' && rb.cells['비상교육'] === '·/h0' && rb.only === '2문항 · 와이비엠 2', JSON.stringify(rb));
  t('옥길중 중1(중등수학1): 비상교육 1(학교) · 천재교육 1 · 다른 곳에서만 1문항', rc.cells && rc.cells['비상교육'] === '1*/h1' && rc.cells['천재교육'] === '1/h1' && /^1문항/.test(rc.only), JSON.stringify(rc));
  t('파란 테두리(학교 교과서 칸) 3개 · 실제로 파란 선', O.own.length === 3 && O.own.every((s) => /^solid rgb\(37, 99, 235\)/.test(s)), JSON.stringify(O.own));
  t('왼쪽: 「📚 교과서일치도」 머리 · 전체 한눈에(3, 켜짐) · 시험 3개(고등 먼저) · 접힌 공용 메뉴',
    /📚 교과서일치도/.test(O.head) && O.left.length === 4 && /^:📊 전체 한눈에3\(on\)$/.test(O.left[0]) && /^범박고_고1.*범박고 고1공통수학2 · 학교 교과서 2\/5$/.test(O.left[1]) && /^소사고_고1/.test(O.left[2]) && /^옥길중_중1/.test(O.left[3]) && O.fold, JSON.stringify([O.head, O.left]));
  t('오른쪽 도구 칸 280px: 다음 시험 대비 추천 · 출판사 비교는 채팅에서 · 블로그 자료(.md) 복사', O.tpw === '280px' && /다음 시험 대비 추천/.test(O.tools) && /출판사 비교 요청은 채팅에서/.test(O.tools) && /블로그 자료\(\.md\) 복사/.test(O.tools), O.tpw + ' ' + O.tools.slice(0, 200));
  t('추천: 범박고 고1 — 비상교육 + 미래엔 · 동아 / 소사고 고1 — 동아 + 와이비엠 · 미래엔', O.rec[0] === '범박고 고1 — 비상교육 + 미래엔 · 동아' && O.rec[1] === '소사고 고1 — 동아 + 와이비엠 · 미래엔', JSON.stringify(O.rec));
  t('「추천 교과서 문항으로 대비 학습지」는 «준비 중» · 누를 수 없음', O.ws && O.ws.dis && /준비 중/.test(O.ws.t), JSON.stringify(O.ws));
  await pg.screenshot({ path: SP + '/v19111_overview.png' });

  /* ③ 칸 누르기 → 그 시험 */
  const E = await pg.evaluate(async () => {
    document.querySelector('tr[data-tbm-row="범박고_고1_2026_2_중간"] td[data-tbm-cell="미래엔"]').click(); await new Promise((r) => setTimeout(r, 120));
    const CT = document.getElementById('CONTENT');
    const pubs = [...CT.querySelectorAll('#tbm-pubt tr[data-tbm-pub]')].map((tr) => tr.getAttribute('data-tbm-pub') + ':' + [...tr.children].map((c) => c.textContent).join('|') + (tr.classList.contains('hl') ? '(hl)' : ''));
    const only = [...CT.querySelectorAll('#tbm-only .tbm-q')].map((q) => q.getAttribute('data-no') + ':' + q.querySelector('.hd').textContent + ':' + q.querySelectorAll('img').length + '그림');
    return { cur: TBM.cur, h: (CT.querySelector('#tbm-exam-h') || {}).textContent, pubs, only, alts: [...CT.querySelectorAll('#tbm-only .tbm-q[data-no="2"] .tbm-chip')].map((b) => b.textContent),
      leftOn: [...document.querySelectorAll('#LIST_CONTENT [data-tbm-left].on')].map((b) => b.getAttribute('data-tbm-left')), rec: [...document.querySelectorAll('#TOOL_PANEL [data-tbm-rec]')].map((e) => e.textContent) };
  });
  t('지도 칸(범박고 고1 × 미래엔) → 그 시험 · 왼쪽도 그 시험 켜짐 · 미래엔 줄 강조', E.cur === '범박고_고1_2026_2_중간' && /범박고 고1 · 2026 2학기 중간/.test(E.h) && E.leftOn[0] === E.cur && E.pubs.some((p) => /^미래엔:.*\(hl\)$/.test(p)), JSON.stringify([E.cur, E.h, E.leftOn]));
  t('출판사별 표: 비상교육(학교) 맨 위 2 · 같은 1 · 숫자변형 1 · 지문 1 · 1번 4번', /^비상교육:비상교육 학교 교과서\|2\|1\|1\|1\|1번4번$/.test(E.pubs[0]) && /^미래엔:미래엔\|2\|·\|2\|·\|1번2번/.test(E.pubs[1]), JSON.stringify(E.pubs));
  t('「학교 교과서에 없던 문항」 2개: 2번 ↔ 미래엔 41쪽 2번(숫자변형, 그림 2) · 3번 ↔ 와이비엠 104쪽 9번(같은 문제)',
    E.only.length === 2 && /^2:2번 ↔ 미래엔 41쪽 2번숫자변형:2그림$/.test(E.only[0]) && /^3:3번 ↔ 와이비엠 104쪽 9번같은 문제:2그림$/.test(E.only[1]), JSON.stringify(E.only));
  t('2번은 함께 나온 곳 칩 2개(미래엔 · 동아)', E.alts.length === 2 && /동아 50쪽 6번/.test(E.alts[1]), JSON.stringify(E.alts));
  t('오른쪽 추천은 이 시험만', E.rec.length === 1 && /^범박고 고1/.test(E.rec[0]), JSON.stringify(E.rec));
  await pg.screenshot({ path: SP + '/v19111_exam.png', fullPage: false });

  const F = await pg.evaluate(async () => {
    const CT = document.getElementById('CONTENT'), r = {};
    CT.querySelector('#tbm-only .tbm-q[data-no="2"] .tbm-chip:nth-of-type(2)').click(); await new Promise((x) => setTimeout(x, 60));
    r.sel = document.querySelector('#tbm-only .tbm-q[data-no="2"] .hd').textContent;
    [...CT.querySelectorAll('#tbm-pubt tr[data-tbm-pub="비상교육"] .tbm-no')].filter((b) => b.textContent === '4번')[0].click(); await new Promise((x) => setTimeout(x, 60));
    r.focus = (document.querySelector('#tbm-focus') || {}).textContent || '';
    document.querySelector('#tbm-only .tbm-q[data-no="3"] [data-tbm-act="ok"]').click(); await new Promise((x) => setTimeout(x, 40));
    r.ok = document.querySelector('#tbm-only .tbm-q[data-no="3"]').classList.contains('ok');
    T.upserts.length = 0;
    document.querySelector('#tbm-only .tbm-q[data-no="3"] [data-tbm-act="rej"]').click(); await new Promise((x) => setTimeout(x, 120));
    const K = 'exam_hit_범박고_고1_2026_2_중간';
    r.saved = T.upserts.indexOf(K) >= 0; r.rej = (T.store[K].items[2].pub.filter((p) => p.k === 'pub:301')[0] || {}).rejected === true;
    r.others = T.store[K].items[2].pub.filter((p) => p.k !== 'pub:301').every((p) => !p.rejected);
    r.only = [...document.querySelectorAll('#tbm-only .tbm-q')].map((q) => q.getAttribute('data-no'));
    r.shared = HT.data['범박고_고1_2026_2_중간'].items[2].pub[0].rejected === true;
    return r;
  });
  t('칩을 누르면 2번 그림이 동아 50쪽 6번으로', /2번 ↔ 동아 50쪽 6번/.test(F.sel), F.sel);
  t('표의 번호(비상교육 4번) → 「🔍 4번 — 일치한 교과서」 그림', /🔍 4번 — 일치한 교과서/.test(F.focus) && /비상교육 88쪽 5번/.test(F.focus), F.focus.slice(0, 120));
  t('✓ 맞음 → 초록 표시', F.ok, '');
  t('✗ 아님(3번 와이비엠) → 서버 exam_hit_범박고… 에 rejected 저장 · 다른 후보는 그대로 · 적중 분석 자료(HT.data)에도 · 목록 1개(2번)', F.saved && F.rej && F.others && F.shared && JSON.stringify(F.only) === '["2"]', JSON.stringify(F));

  /* ④ 블로그 자료 .md */
  const G = await pg.evaluate(async () => {
    document.getElementById('tbm-md').click(); await new Promise((x) => setTimeout(x, 150));
    const one = TBM.md; tbmOpen(''); await new Promise((x) => setTimeout(x, 60));
    document.getElementById('tbm-md').click(); await new Promise((x) => setTimeout(x, 150));
    return { one, all: TBM.md, toast: T.toasts.slice(-2) };
  });
  t('.md (한 시험): 범박고 고1 — 학교 교과서(비상교육) 2/5 · 다른 출판사에서만 1문항(2번(미래엔·동아)) · 일치도 정의',
    /## 범박고 고1 2026 2학기 중간 \(공통수학2, 5문항\)/.test(G.one) && /학교 교과서\(비상교육\)와 일치: 2문항 \/ 5문항/.test(G.one) && /다른 출판사 교과서에서만 나온 문항: 1문항 — 2번\(미래엔·동아\)/.test(G.one) && /일치도 = 같은 문제 \+ 숫자변형/.test(G.one) && !/소사고/.test(G.one), G.one);
  t('.md (전체): 시험 3개 · 「매쓰플랫」「수학비서」 없음 · 학생 이름 없음', (G.all.match(/^## .*문항\)$/gm) || []).length === 3 && !/매쓰플랫|수학비서|○○○/.test(G.all), G.all.slice(0, 300));
  t('복사 알림(또는 내려받기 알림)', G.toast.length === 2 && G.toast.every((m) => /복사했습니다|내려받았습니다/.test(m)), JSON.stringify(G.toast));

  /* ⑤ 🎯 적중 분석에서 보기 */
  const H = await pg.evaluate(async () => {
    tbmOpen('범박고_고1_2026_2_중간'); await new Promise((x) => setTimeout(x, 60));
    document.querySelector('#tbm-only .tbm-q[data-no="2"] [data-tbm-act="hit"]').click(); await new Promise((x) => setTimeout(x, 400));
    return { view: VIEW, cur: HT.cur, bar: ([...document.querySelectorAll('#SUBTAB_BAR .stab.on')][0] || {}).textContent, card: !!document.getElementById('pb-it-2') || !!document.getElementById('ht-q-2') };
  });
  t('「🎯 적중 분석에서 보기」 → VIEW examhit · HT.cur = 범박고 고1 · 위 탭 적중 분석', H.view === 'examhit' && H.cur === '범박고_고1_2026_2_중간' && /적중 분석/.test(H.bar), JSON.stringify(H));

  /* ⑥ 420px — 가로 스크롤 없음 · 칩 · 도구는 아래 */
  await pg.evaluate(() => { VIEW = 'tbmatch'; TBM.cur = ''; render(); });
  /* 820px(태블릿 — 왼쪽 목록 칸 없음) 먼저 */
  await pg.setViewportSize({ width: 820, height: 900 }); await settle(400);
  const Q = await pg.evaluate(async () => {
    render(); await new Promise((x) => setTimeout(x, 60));
    const CT = document.getElementById('CONTENT');
    return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, chips: CT.querySelectorAll('.tbm-chips .tbm-chip').length, inline: !!CT.querySelector('.tbm-inline-tools #tbm-rec'),
      wide: [...CT.querySelectorAll('.tbm-wrap *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > window.innerWidth + 1 && !e.closest('.tbm-scroll'); }).map((e) => e.tagName + '.' + e.className).slice(0, 5) };
  });
  t('820px: 가로 스크롤 없음 · 시험 칩 · 도구는 가운데 아래', Q.sw <= Q.iw && !Q.wide.length && Q.chips === 4 && Q.inline, JSON.stringify(Q));
  await pg.locator('#CONTENT .tbm-wrap').screenshot({ path: SP + '/v19111_tablet.png' });
  /* 420px — 폰 전용 화면 대신 「🖥 PC 화면」으로 넘긴 상태 */
  await pg.setViewportSize({ width: 420, height: 860 }); await settle(400);
  const P = await pg.evaluate(async () => {
    mobSetPc(true); VIEW = 'tbmatch'; TBM.cur = ''; render(); await new Promise((x) => setTimeout(x, 60));
    const CT = document.getElementById('CONTENT'), r = {};
    r.sw = document.documentElement.scrollWidth; r.iw = window.innerWidth;
    r.wide = [...CT.querySelectorAll('.tbm-wrap *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > window.innerWidth + 1 && !e.closest('.tbm-scroll'); }).map((e) => e.tagName + '.' + e.className).slice(0, 5);
    r.chips = CT.querySelectorAll('.tbm-chips .tbm-chip').length; r.inline = !!CT.querySelector('.tbm-inline-tools #tbm-rec');
    CT.querySelectorAll('.tbm-chips .tbm-chip')[1].click(); await new Promise((x) => setTimeout(x, 80));
    r.cur = TBM.cur; r.sw2 = document.documentElement.scrollWidth;
    r.wide2 = [...CT.querySelectorAll('.tbm-wrap *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > window.innerWidth + 1 && !e.closest('.tbm-scroll'); }).map((e) => e.tagName + '.' + e.className).slice(0, 5);
    return r;
  });
  t('420px(PC 화면으로): 가로 스크롤 없음(전체 · 한 시험) · 시험 칩 4개 · 도구는 가운데 아래', P.sw <= P.iw && P.sw2 <= P.iw && !P.wide.length && !P.wide2.length && P.chips === 4 && P.inline && P.cur === '범박고_고1_2026_2_중간', JSON.stringify(P));
  await pg.locator('#CONTENT .tbm-wrap').screenshot({ path: SP + '/v19111_phone.png' });

  t('페이지 오류 없음', errs.length === 0, errs.join(' / '));
  await br.close();
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
