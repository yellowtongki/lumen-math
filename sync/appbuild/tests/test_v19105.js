#!/usr/bin/env node
/* 학원앱 v19-105 검사 — 🎯 적중 분석을 3분할로 (원장 결정 2026-10-11, 시안 docs/mockup_layout3.html)
 *   ① 왼쪽: 「시험」 3개(지금 것 파란색) · 누르면 HT.cur 바뀜 · 「새로」 기출 DB · 시험지 올리기 · PDF 자료함(2장) · 접힌 공용 메뉴
 *   ② 오른쪽: 우리 자료 요약(교과서 1권 · 학습지 2장 · PDF 0장 · 자동) · 「🔄 이 구성으로 다시 판정」 → v19-103 화면 · 💾 구성 기억
 *            적중 기준 — 가운데 고르기와 서로 따라감 · 내보내기 네 단추 · 서버 상태(⏳ · ⚡ / 🐙)
 *   ③ 가운데 단추는 그대로 · 1100px 「🛠 도구」 · 420px 변화 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19105.js lumen_v19-105.html
 *   그림: $SP/v19105_hit.png (1400px 전체 화면)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-105.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-105'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고1_2026_2_중간', E2 = '옥길중_중2_2026_2_중간', E3 = '옥길중_중1_2026_2_중간';
const STORE = {
  mf_textbooks: { books: {
    '3119965': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상A', fulltitle: '교과서_가상A - 공통수학2' },
    '3119966': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상B', fulltitle: '교과서_가상B - 공통수학2' } },
    bySchoolGrade: { '범박고|고1': { n: 2, books: { '3119965': 2, '3119966': 1 } } } },
  mf_textbook_3119965: { bid: 3119965, problems: [{ id: 1 }, { id: 2 }, { id: 3 }] },
  ms_papers_index: { updated: '2026-10-10T04:30:00Z', items: [
    { id: 900101, title: '공통수학2 도형의 방정식 주간 점검', folder: '고1', grade: '고1', uploadedAt: '2026-09-10T10:00:00+09:00', n: 20, status: 'ready', exam: false },
    { id: 900102, title: '공통수학2 집합 복습', folder: '고1', grade: '고1', uploadedAt: '2026-09-25T10:00:00+09:00', n: 15, status: 'ready', exam: false },
    { id: 900201, title: '공통수학2 직선의 방정식 심화', folder: '공수2', grade: '', uploadedAt: '2026-03-10T10:00:00+09:00', n: 12, status: 'ready', exam: false } ] },
  exam_lib: { updated: '2026-10-01T00:00:00Z', items: [
    { id: 'L1', title: '고1 도형의 방정식 보충 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-20T10:00:00Z', n: 10, status: 'ready', items: [] },
    { id: 'L2', title: '고1 집합 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-25T10:00:00Z', n: 8, status: 'ready', items: [] },
    { id: 'L3', title: '지운 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-25T10:00:00Z', n: 8, status: 'ready', items: [], deleted: true } ] },
  exam_hit_index: { items: [
    { examId: EID, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 3, at: '2026-10-10T12:00:00Z' },
    { examId: E2, school: '옥길중', grade: '중2', year: 2026, semester: '2', term: '중간', total: 21, at: '2026-10-09T12:00:00Z' },
    { examId: E3, school: '옥길중', grade: '중1', year: 2026, semester: '2', term: '중간', total: 20, at: '2026-10-08T12:00:00Z' } ] },
};
STORE['exam_hit_' + EID] = { examId: EID, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', date: '2026-10-07', mydb: 719865, subject: '공통수학2' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-10-07', students: ['AAA111', 'BBB222'],
  src: { tb: { on: true, mode: 'all', bids: ['3119965'] }, ms: ['900101', '900201'], lib: [], mf: true },
  items: [
    { no: 1, chapter: '도형의 방정식', type: '두 점 사이의 거리', level: 2, cands: [{ k: 'tb:4', kind: 'same', also: [] }], hit: null },
    { no: 2, chapter: '도형의 방정식', type: '직선의 방정식', level: 3, cands: [{ k: 'ms:900201:3', kind: 'var', also: [] }], hit: null },
    { no: 3, chapter: '집합', type: '부분집합', level: 3, cands: [{ k: 'ws:9', kind: 'type', also: [] }], hit: null } ],
  mats: {
    'tb:4': { kind: 'textbook', title: '교과서 가상A', where: '교과서 가상A 10쪽 1번', cid: 21, img: '', res: {} },
    'ms:900201:3': { kind: 'ms', title: '공통수학2 직선의 방정식 심화', where: '3번', cid: 22, img: '', res: {} },
    'ws:9': { kind: 'ws', title: '부분집합 학습지', where: '9번', cid: 23, img: '', res: { AAA111: 'O' } } },
  stats: { total: 3, byKind: { textbook: { mats: 7, hit: 1 }, ms: { mats: 32, hit: 1 }, upload: { mats: 0, hit: 0 }, ws: { mats: 2, hit: 1 }, book: { mats: 0, hit: 0 } } } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], calls: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({
          eq: (k, v) => Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }),
          in: (k, arr) => Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T.store, x)).map((x) => ({ key: x })) }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '범박고', grade: '고등학교 1학년', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '△△△', school: '범박고', grade: '고등학교 1학년', lumen_rec_code: 'BBB222' }];
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    try { _origRemoveItem('or_gh_token'); } catch (e) {}
    HT.kicked = false; HT.idx = null; HT.req = null; HT.cur = ''; HT.data = {};
    VIEW = 'examhit'; render();
  }, STORE);
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  await settle(400); await pg.evaluate(() => render()); await settle(100);

  /* ① 왼쪽 */
  const L = await pg.evaluate(() => {
    const LC = document.getElementById('LIST_CONTENT');
    const ex = [...LC.querySelectorAll('[data-l3h-exam]')];
    const nw = [...LC.querySelectorAll('[data-l3h-new]')].map((b) => b.getAttribute('data-l3h-new') + ':' + b.textContent);
    const det = LC.querySelector('details.common-menu');
    return { ver: APP_VER, cur: HT.cur, n: ex.length, on: ex.filter((b) => b.classList.contains('on')).map((b) => b.getAttribute('data-l3h-exam')), txt: ex.map((b) => b.textContent),
      head: (LC.querySelector('.l3-vhead') || {}).textContent, nw, det: !!det, detOpen: !!(det && det.open), detInner: det ? det.querySelector('.l3-cm-body').textContent.length : 0,
      order: det && ex[0] ? !!(ex[0].compareDocumentPosition(det) & Node.DOCUMENT_POSITION_FOLLOWING) : false };
  });
  t('버전 ' + WANT, L.ver === WANT, L.ver);
  t('왼쪽 「시험」 3개 · 지금 연 범박고 고1 이 파란색(하나만)', L.n === 3 && L.on.length === 1 && L.on[0] === '범박고_고1_2026_2_중간' && L.cur === L.on[0], JSON.stringify([L.n, L.on, L.cur]));
  t('시험 이름 «범박고 고1 · 2026 2학기 중간» · 불러온 시험은 «후보 3 · 확정 0» · 안 불러온 시험은 문항 수', /범박고 고1 · 2026 2학기 중간/.test(L.txt[0]) && /후보 3 · 확정 0/.test(L.txt[0]) && /옥길중 중2 · 2026 2학기 중간/.test(L.txt[1]) && /21문항/.test(L.txt[1]), JSON.stringify(L.txt));
  t('「새로」: 📚 기출 DB에서 찾기 · 📤 시험지 올리기 · 📄 PDF 자료함 2장(지운 것 빼고)', L.nw.length === 3 && /^db:📚 기출 DB에서 찾기/.test(L.nw[0]) && /^up:📤 시험지 올리기/.test(L.nw[1]) && /^lib:📄 PDF 자료함2장$/.test(L.nw[2]), JSON.stringify(L.nw));
  t('맨 위 「🎯 적중 분석」 · 맨 아래 접힌 「▸ 공용 메뉴」(안에 공용 메뉴)', /🎯 적중 분석/.test(L.head) && L.det && !L.detOpen && L.detInner > 100 && L.order, JSON.stringify([L.head, L.det, L.detOpen, L.detInner, L.order]));

  /* ② 오른쪽 */
  const R = await pg.evaluate(() => {
    const tp = document.getElementById('TOOL_PANEL'); const q = (s) => tp.querySelector(s);
    const src = {}; tp.querySelectorAll('[data-l3h-src]').forEach((e) => { src[e.getAttribute('data-l3h-src')] = { t: e.textContent, on: !e.querySelector('i.off') }; });
    return { w: Math.round(tp.getBoundingClientRect().width), css: getComputedStyle(tp).width, src, rej: (q('#l3h-rej') || {}).textContent, cfg: (q('#l3h-cfg') || {}).textContent,
      x: [...tp.querySelectorAll('[data-l3h-x]')].map((b) => b.getAttribute('data-l3h-x') + ':' + b.textContent), req: (q('#l3h-req') || {}).textContent, tok: (q('#l3h-tok') || {}).textContent, gh: q('#l3h-gh') ? q('#l3h-gh').getAttribute('href') : '' };
  });
  t('1400px 도구 칸 280px 열림', R.css === '280px' && R.w > 200, JSON.stringify([R.css, R.w]));
  t('📂 우리 자료: 교과서 1권(7문항) ✓ · 학원 대비 학습지 2장(32문항) ✓ · PDF 0장 □ · 루멘수학 학습지·교재 자동(2문항) ✓',
    R.src.tb && /교과서 1권 \(7문항\)/.test(R.src.tb.t) && R.src.tb.on && /학원 대비 학습지 2장 \(32문항\)/.test(R.src.ms.t) && R.src.ms.on && /PDF 0장/.test(R.src.pdf.t) && !R.src.pdf.on && /루멘수학 학습지·교재 자동 \(2문항\)/.test(R.src.mf.t) && R.src.mf.on, JSON.stringify(R.src));
  t('단추 「🔄 이 구성으로 다시 판정」 · 「💾 구성 기억」', R.rej === '🔄 이 구성으로 다시 판정' && R.cfg === '💾 구성 기억', JSON.stringify([R.rej, R.cfg]));
  t('내보내기: 📰 카드뉴스 · 🖨 학부모 보고서 · ⬇ 블로그 폴더 · 📝 블로그 자료 .md', R.x.join('|') === 'card:📰 카드뉴스|print:🖨 학부모 보고서|blog:⬇ 블로그 폴더로 내려받기|md:📝 블로그 자료 .md', JSON.stringify(R.x));
  t('서버 상태: 요청 대기 없음 · 토큰 없음 → 「🐙 GitHub에서 바로 실행」 링크', /요청 대기 없음/.test(R.req) && /즉시 처리 꺼짐/.test(R.tok) && /github\.com\/.*mathflat-ondemand\.yml/.test(R.gh), JSON.stringify([R.req, R.tok, R.gh]));
  await pg.screenshot({ path: SP + '/v19105_hit.png' });

  /* 적중 기준 — 가운데 ↔ 오른쪽 */
  const B = await pg.evaluate(async () => {
    const C = () => document.querySelector('#CONTENT select[onchange^="htBasis"]'), Rr = () => document.getElementById('l3h-basis');
    const o = { c0: C().value, r0: Rr().value };
    C().value = 'type'; C().dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 80));
    o.c1 = C().value; o.r1 = Rr().value; o.s1 = T.store['exam_hit_범박고_고1_2026_2_중간'].basis;
    Rr().value = 'same'; Rr().dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 80));
    o.c2 = C().value; o.r2 = Rr().value; o.s2 = T.store['exam_hit_범박고_고1_2026_2_중간'].basis;
    Rr().value = 'same+var'; Rr().dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 80));
    o.c3 = C().value; return o;
  });
  t('적중 기준: 처음 둘 다 「같은 문제 + 숫자변형」', B.c0 === 'same+var' && B.r0 === 'same+var', JSON.stringify(B));
  t('가운데를 「유사유형까지」로 → 오른쪽도 type · 저장됨', B.c1 === 'type' && B.r1 === 'type' && B.s1 === 'type', JSON.stringify(B));
  t('오른쪽을 「같은 문제만」으로 → 가운데도 same · 저장됨', B.c2 === 'same' && B.r2 === 'same' && B.s2 === 'same' && B.c3 === 'same+var', JSON.stringify(B));

  /* 내보내기 단추 → 지금 있는 함수 */
  const X = await pg.evaluate(async () => {
    window.cnToggle = () => T.calls.push('card'); window.htPrint = (c) => T.calls.push('print:' + c); window.cn4BlogExport = () => T.calls.push('blog'); window.htExportMd = () => T.calls.push('md');
    render(); await new Promise((r) => setTimeout(r, 30));
    ['card', 'print', 'blog', 'md'].forEach((k) => document.querySelector('#TOOL_PANEL [data-l3h-x="' + k + '"]').click());
    return T.calls.slice();
  });
  t('내보내기 네 단추 → cnToggle · htPrint(전체) · cn4BlogExport · htExportMd', X.join(',') === 'card,print:,blog,md', X.join(','));

  /* 서버 상태 — 진행 중 · 토큰 있음 */
  const S = await pg.evaluate(async () => {
    HT.req = { status: 'running', examId: '옥길중_중2_2026_2_중간', exam: { school: '옥길중', grade: '중2', year: 2026, semester: '2', term: '중간' }, step: '문항 나누는 중', pct: 40 };
    _origSetItem('or_gh_token', 'test-token-not-real'); render(); await new Promise((r) => setTimeout(r, 30));
    const o = { req: document.getElementById('l3h-req').textContent, tok: document.getElementById('l3h-tok').textContent, gh: !!document.getElementById('l3h-gh'),
      wake: [...document.querySelectorAll('#TOOL_PANEL button')].some((b) => /다시 깨우기/.test(b.textContent)), left: [...document.querySelectorAll('[data-l3h-exam]')].map((b) => b.textContent)[1] };
    _origRemoveItem('or_gh_token'); clearInterval(HT.poll); HT.poll = null; HT.req = null; render(); return o;
  });
  t('서버 상태: ⏳ 옥길중 중2 — 문항 나누는 중 · 40% · ⚡ 즉시 처리 켜짐 + 다시 깨우기 · 🐙 링크 없음 · 왼쪽 그 시험 «⏳ 분석 중»',
    /⏳ 옥길중 중2 · 2026년 2학기 중간고사 — 문항 나누는 중 · 40%/.test(S.req) && /즉시 처리 켜짐/.test(S.tok) && !S.gh && S.wake && /⏳ 분석 중/.test(S.left), JSON.stringify(S));

  /* 왼쪽에서 다른 시험 → HT.cur 바뀜 · 결과 없음 → 「시험을 고르세요」 */
  const P = await pg.evaluate(async () => {
    document.querySelector('#LIST_CONTENT [data-l3h-exam="옥길중_중2_2026_2_중간"]').click(); await new Promise((r) => setTimeout(r, 120)); render();
    const on = [...document.querySelectorAll('#LIST_CONTENT [data-l3h-exam].on')].map((b) => b.getAttribute('data-l3h-exam'));
    return { cur: HT.cur, on, none: !!document.querySelector('#TOOL_PANEL #l3h-none'), noneTxt: (document.querySelector('#TOOL_PANEL #l3h-none') || {}).textContent || '',
      newBtns: document.querySelectorAll('#TOOL_PANEL [data-l3h-new]').length };
  });
  t('왼쪽 옥길중 중2 클릭 → HT.cur 바뀜 · 그 줄이 파란색', P.cur === '옥길중_중2_2026_2_중간' && P.on.length === 1 && P.on[0] === P.cur, JSON.stringify(P));
  t('결과가 없으면 오른쪽 「시험을 고르세요」 + 새로 단추 3개', P.none && /시험을 고르세요/.test(P.noneTxt) && P.newBtns === 3, JSON.stringify(P));
  await pg.evaluate(async () => { document.querySelector('#LIST_CONTENT [data-l3h-exam="범박고_고1_2026_2_중간"]').click(); await new Promise((r) => setTimeout(r, 120)); render(); });

  /* 「🔄 이 구성으로 다시 판정」 → v19-103 다시 판정 화면 */
  const J = await pg.evaluate(async () => {
    document.getElementById('l3h-rej').click(); await new Promise((r) => setTimeout(r, 300)); render();
    const o = { open: HTS.open, rej: !!HTS.rejudge, title: (document.getElementById('hts-req') || {}).textContent || '', start: (document.getElementById('hts-start') || {}).textContent, fromSrc: HTS.fromSrc,
      tools: !!document.querySelector('#TOOL_PANEL #l3h-src'), req: T.store.exam_hit_req || null };
    document.getElementById('hts-back').click(); await new Promise((r) => setTimeout(r, 60)); render();
    o.closed = !HTS.open && !HTS.rejudge; return o;
  });
  t('「🔄 이 구성으로 다시 판정」 → 다시 판정 화면(HTS.open · rejudge · 지난 판정 자료) · 아직 요청 안 함', J.open && J.rej && /🔄 다시 판정 — 범박고 고1/.test(J.title) && J.start === '🔄 이 자료로 다시 판정' && J.fromSrc && !J.req, JSON.stringify(J).slice(0, 300));
  t('다시 판정 화면에서도 도구 칸 유지 · 「← 결과로 돌아가기」로 닫힘', J.tools && J.closed, JSON.stringify([J.tools, J.closed]));

  /* 💾 구성 기억 → exam_hit_src_범박고_고1 · 결과 화면으로 돌아옴 */
  const G = await pg.evaluate(async () => {
    document.getElementById('l3h-cfg').click(); await new Promise((r) => setTimeout(r, 500)); render();
    return { cfg: T.store['exam_hit_src_범박고_고1'] || null, open: HTS.open, toast: T.toasts.filter((m) => /자료 구성을 기억했습니다/.test(m)).length, result: !!document.querySelector('#CONTENT #hts-rej-btn'), req: T.store.exam_hit_req || null };
  });
  const gc = G.cfg || {};
  t('「💾 구성 기억」 → exam_hit_src_범박고_고1 (공수2 학습지 켬 · 고1 학습지 900102 끔 · 교과서 B 끔) · 결과 화면 그대로 · 요청 없음',
    G.cfg && gc.msOn && gc.msOn['900201'] === 1 && gc.msOff && gc.msOff['900102'] === 1 && gc.tbOff && gc.tbOff['3119966'] === 1 && gc.mf === true && !G.open && G.toast === 1 && G.result && !G.req, JSON.stringify(G).slice(0, 400));

  /* 「새로」 단추 → 지금 있는 입구 */
  const N = await pg.evaluate(async () => {
    const o = {};
    document.querySelector('#LIST_CONTENT [data-l3h-new="up"]').click(); await new Promise((r) => setTimeout(r, 60));
    o.up = HT.showForm && !!document.getElementById('ht-files');
    document.querySelector('#LIST_CONTENT [data-l3h-new="db"]').click(); await new Promise((r) => setTimeout(r, 60));
    o.db = HTDB.open && !HT.showForm && !!document.getElementById('htdb');
    document.querySelector('#LIST_CONTENT [data-l3h-new="lib"]').click(); await new Promise((r) => setTimeout(r, 400)); render(); await new Promise((r) => setTimeout(r, 30));
    o.lib = HTS.open && !!HTS.rejudge && !!document.getElementById('hts-lib');
    window.htsClose(); HTDB.open = false; render();
    return o;
  });
  t('새로: 📤 → 시험지 올리기 칸 · 📚 → 기출 DB 칸 · 📄 → 우리 자료 화면의 PDF 자료함 칸', N.up && N.db && N.lib, JSON.stringify(N));

  /* 가운데 단추는 그대로 */
  const K = await pg.evaluate(() => { const tx = [...document.querySelectorAll('#CONTENT button')].map((b) => b.textContent.trim()); return ['📤 시험지 올리기', '📚 기출 DB에서 찾기', '🔄 새로고침', '📂 우리 자료 고르기 → 다시 판정', '🖨 학부모 보고서 (전체)', '📝 블로그 자료 (.md)', '📰 카드뉴스', '📋 요약 글 복사', '🔄 다시 판정'].filter((x) => tx.indexOf(x) < 0); });
  t('가운데 화면 단추 9개 그대로 (빠진 것 없음)', K.length === 0, JSON.stringify(K));

  /* 1100px · 420px */
  await pg.setViewportSize({ width: 1100, height: 850 }); await settle(400);
  const M = await pg.evaluate(() => { render(); const fb = document.getElementById('L3_FAB'); return { fab: !!fb && getComputedStyle(fb).display !== 'none', tp: getComputedStyle(document.getElementById('TOOL_PANEL')).display, left: document.querySelectorAll('#LIST_CONTENT [data-l3h-exam]').length }; });
  t('1100px: 도구 칸 숨김 · 「🛠 도구」 단추 · 왼쪽 시험 목록', M.fab && M.tp === 'none' && M.left === 3, JSON.stringify(M));
  await pg.setViewportSize({ width: 420, height: 860 }); await settle(400);
  const Q = await pg.evaluate(() => { render(); const LC = document.getElementById('LIST_CONTENT'), fb = document.getElementById('L3_FAB'); const d = document.createElement('div'); d.innerHTML = rList();
    return { exams: LC.querySelectorAll('[data-l3h-exam]').length, det: !!LC.querySelector('details.common-menu'), same: LC.innerHTML.length === d.innerHTML.length, fab: !!fb && getComputedStyle(fb).display !== 'none', tools: document.getElementById('TOOL_PANEL').textContent }; });
  t('420px: 왼쪽은 예전 공용 메뉴 그대로 · 도구·단추 없음', Q.exams === 0 && !Q.det && Q.same && !Q.fab && Q.tools === '', JSON.stringify(Q));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
