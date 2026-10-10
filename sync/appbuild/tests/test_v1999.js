#!/usr/bin/env node
/* 학원앱 v19-99 검사 — 🎯 적중 분석 «우리 자료 3종» 요청 화면 · 결과 화면 자료별 적중 · ⚡ 즉시 처리 (가짜 서버 · 외부망 차단)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v1999.js lumen_v19-99.html
 *   그림: $SP/v1999_src.png (요청 화면)
 *   가짜 자료: 범박고 고2 학생 2명(○○○·△△△) · 지정 교과서 3권(은행 2권만 있음) · 수학비서 학습지 3장(기간 안 2 + 기출 1) ·
 *   PDF 자료함 3개(인식됨 1 · 대기 1 · 다른 학년 1). 학생 실명·실제 점수 없음. GitHub 호출은 fetch 가짜로 기록만. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-99.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-99'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EXAM_ID = '범박고_고2_2026_2_중간';
const STORE = {
  mf_textbooks: { books: {
    '3219971': { type: 'SCHOOL', grade: '대수', title: '교과서_비상교육', fulltitle: '교과서_비상교육 - 대수' },
    '3227375': { type: 'SCHOOL', grade: '미적분1', title: '교과서_비상교육', fulltitle: '교과서_비상교육 - 미적분1' },
    '3300001': { type: 'SCHOOL', grade: '확률과 통계', title: '교과서_가상', fulltitle: '교과서_가상 - 확률과 통계' },
    '9000001': { type: 'COMMERCIAL', title: '시중교재', fulltitle: '시중교재' } },
    bySchoolGrade: { '범박고|고2': { n: 2, books: { '3219971': 1, '3227375': 2, '3300001': 1, '9000001': 1 } }, '범박고|고1': { n: 1, books: { '3119965': 1 } } } },
  mf_textbook_3219971: { bid: 3219971, title: '교과서_비상교육 - 대수', pages: [{ page: 10, title: '거듭제곱과 거듭제곱근' }], problems: [{ id: 1, page: 10, no: '1', cid: 11 }, { id: 2, page: 10, no: '2', cid: 11 }, { id: 3, page: 10, no: '3', cid: 12 }] },
  mf_textbook_3227375: { bid: 3227375, title: '교과서_비상교육 - 미적분1', pages: [{ page: 10, title: '함수의 극한' }], problems: [{ id: 4, page: 10, no: '1', cid: 21 }, { id: 5, page: 10, no: '2', cid: 21 }, { id: 6, page: 11, no: '1', cid: 22 }, { id: 7, page: 11, no: '2', cid: 22 }] },
  ms_papers_index: { updated: '2026-10-10T04:30:00Z', items: [
    { id: 900001, title: '교과서 변형 미적분1 1단원 함수의 극한 (고2)', folder: '고2', grade: '고2', uploadedAt: '2026-09-12T10:00:00+09:00', n: 24, status: 'ready', exam: false },
    { id: 900002, title: '미적분1 도함수의 활용 주간 점검', folder: '고2', grade: '고2', uploadedAt: '2026-10-03T10:00:00+09:00', n: 18, status: 'pending', exam: false },
    { id: 900003, title: '내신 2025년 경기 부천시 다른고 고2 공통 2학기 중간 미적분1', folder: '고2', grade: '고2', uploadedAt: '2026-07-03T10:00:00+09:00', n: 23, status: '', exam: true },
    { id: 900004, title: '공통수학1 다항식 복습', folder: '공수1', grade: '', uploadedAt: '2026-09-20T10:00:00+09:00', n: 30, status: '', exam: false } ] },
  exam_lib: { updated: '2026-10-01T00:00:00Z', items: [
    { id: 'L1', title: '미적분1 극한 보충 프린트', school: '범박고', grade: '고2', sem: '2', year: 2026, uploadedAt: '2026-09-20T10:00:00Z', src: 'exam_images/lib/L1.pdf', path: 'exam_images/lib/L1.pdf', n: 16, status: 'ready', items: [] },
    { id: 'L2', title: '고2 2학기 중간 대비 모의 1회', school: '범박고', grade: '고2', sem: '2', year: 2026, uploadedAt: '2026-10-02T10:00:00Z', src: 'aha_photos/_exam_hit/lib_L2/1.pdf', path: '', n: null, status: 'pending', items: [] },
    { id: 'L3', title: '고1 공통수학1 다항식 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-08T10:00:00Z', src: 'exam_images/lib/L3.pdf', n: 14, status: 'ready', items: [] } ] },
  school_calendar: { schools: [{ name: '범박고', exams: [{ label: '2학기 중간고사', from: '2026-10-07', to: '2026-10-10' }] }] },
  exam_hit_index: { items: [{ examId: EXAM_ID, school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', total: 4, at: '2026-10-10T12:00:00Z' }] },
};
/* 결과 화면용 — 네 종류 자료가 적중한 시험 하나 */
STORE['exam_hit_' + EXAM_ID] = { examId: EXAM_ID, exam: { school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', date: '2026-10-07' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-10-07', students: ['AAA111', 'BBB222'], src: { tb: { on: true, mode: 'all', bids: ['3219971'] }, ms: ['900001'], lib: ['L1'], mf: true },
  items: [
    { no: 1, chapter: '함수의 극한', type: '극한값 계산', level: 2, cands: [{ k: 'tb:4', kind: 'same', also: [] }], hit: null },
    { no: 2, chapter: '함수의 연속', type: '연속 조건', level: 3, cands: [{ k: 'ms:900001:3', kind: 'var', also: [] }], hit: null },
    { no: 3, chapter: '미분계수', type: '미분계수 정의', level: 3, cands: [{ k: 'ws:9', kind: 'type', also: [] }], hit: null },
    { no: 4, chapter: '도함수', type: '도함수 계산', level: 4, cands: [{ k: 'lib:L1:2', kind: 'var', also: [] }], hit: { k: 'lib:L1:2', kind: 'var', ok: true, by: 'teacher', at: '2026-10-10T12:30:00Z' } },
    { no: 5, chapter: '도함수', type: '접선', level: 3, cands: [{ k: 'ws:8', kind: 'same', also: [] }], hit: null } ],
  mats: {
    'tb:4': { kind: 'textbook', title: '교과서 비상교육 미적분1', where: '교과서 비상교육 미적분1 10쪽 1번', cid: 21, img: '', res: {} },
    'ms:900001:3': { kind: 'ms', title: '교과서 변형 미적분1 1단원 함수의 극한 (고2)', where: '교과서 변형 미적분1 1단원 함수의 극한 (고2) 3번', cid: 22, img: '', res: {} },
    'ws:9': { kind: 'ws', title: '미분계수 학습지', where: '미분계수 학습지 9번', cid: 23, img: '', res: { AAA111: 'O' } },
    'ws:8': { kind: 'ws', title: '접선 학습지', where: '접선 학습지 2번', cid: 24, img: '', res: { AAA111: 'X', BBB222: 'O' } },
    'lib:L1:2': { kind: 'upload', lib: true, title: '미적분1 극한 보충 프린트', where: '미적분1 극한 보충 프린트 2번', cid: 25, img: '', res: {} } },
  stats: { total: 5, byKind: { textbook: { mats: 7, hit: 1 }, ms: { mats: 24, hit: 1 }, upload: { mats: 16, hit: 1 }, ws: { mats: 2, hit: 1 }, book: { mats: 0, hit: 0 } } } };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T99 = { store: clone(STORE), upserts: [], reads: [], gh: [], toasts: [], inQ: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({
          eq: (k, v) => { T99.reads.push(v); return Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T99.store, v) ? [{ key: v, value: clone(T99.store[v]) }] : [] }); },
          in: (k, arr) => { T99.inQ.push(arr.slice()); return Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T99.store, x)).map((x) => ({ key: x })) }); } }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T99.upserts.push(r.key); T99.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '범박고', grade: '고등학교 2학년', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '△△△', school: '범박고', grade: '고등학교 2학년', lumen_rec_code: 'BBB222' }];
    window.plToast = (m) => { T99.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    /* GitHub 호출만 기록 (나머지는 실패) */
    const of = window.fetch;
    window.fetch = (url, opt) => { if (/api\.github\.com/.test(String(url))) { T99.gh.push({ url: String(url), opt: opt || {} }); return Promise.resolve({ status: 204, text: () => Promise.resolve('') }); } return Promise.reject(new Error('외부망 차단')); };
    window.confirm = () => true;
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    VIEW = 'examhit';
    HTDB.idx = { items: [{ id: 719864, t: '내신 2026년 경기 부천시 범박고 고2 공통 2학기 중간 미적분1', f: '작업공간', sc: '범박고', g: '고2', y: '2026', sem: '2', term: '중간', n: 23, ok: false }] };
  }, STORE);
  const settle = () => pg.evaluate(() => new Promise((r) => setTimeout(r, 120)));

  /* 1) 기출 DB → 🎯 적중 분석 → 요청 화면 (confirm 없이) */
  await pg.evaluate(() => { HT.kicked = true; HT.idx = clone0(); function clone0() { return { items: [] }; } htdbAnalyze(719864); });
  await settle(); await pg.evaluate(() => render()); await settle();
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'); const q = (s) => box.querySelector(s);
    const row = (k) => q('[data-hts="' + k + '"]'); const on = (k) => { const r = row(k); return !!(r && r.querySelector('.hts-cb.on')); };
    const c = htsCounts();
    return { ver: APP_VER, open: HTS.open, req: !!q('#hts-req'), title: (q('#hts-req') || {}).textContent || '',
      tbRows: [...box.querySelectorAll('[data-hts^="tb:"]')].map((r) => r.getAttribute('data-hts')), tbOn: ['tb:3219971', 'tb:3227375', 'tb:3300001'].map(on),
      tbSt: ['tb:3219971', 'tb:3227375', 'tb:3300001'].map((k) => (row(k).querySelector('.hts-st') || {}).textContent), inQ: T99.inQ.slice(),
      msOn: ['ms:900001', 'ms:900002', 'ms:900003'].map(on), examDim: row('ms:900003') && row('ms:900003').classList.contains('dim'), examNote: row('ms:900003') && /다른 학교·지난 기출/.test(row('ms:900003').textContent),
      otherFolderRow: !!row('ms:900004'), chips: [...box.querySelectorAll('[data-htsf]')].map((b) => b.getAttribute('data-htsf')),
      libRows: [...box.querySelectorAll('[data-hts^="lib:"]')].map((r) => r.getAttribute('data-hts')), libOn: ['lib:L1', 'lib:L2'].map(on), othersBtn: /다른 학년 보기 \(1\)/.test(box.innerHTML),
      mf: on('mf'), c, nums: ['hts-nSrc', 'hts-nAll', 'hts-nOk', 'hts-nWait'].map((id) => (document.getElementById(id) || {}).textContent),
      period: HTS.from + '~' + HTS.to, subj: HTS.subject, subjSel: (document.getElementById('hts-subject') || {}).value };
  });
  t('버전 ' + WANT, o1.ver === WANT, o1.ver);
  t('기출 DB 「🎯 적중 분석」 → confirm 대신 요청 화면 (시험 · 기간 · 학생 2명)', o1.open && o1.req && /범박고 고2 · 2026년 2학기 중간고사/.test(o1.title) && /학생 2명/.test(o1.title) && /기간 바꾸기/.test(o1.title), o1.title.slice(0, 200));
  t('기간 = 학기 시작 ~ 시험 첫날(학원 달력 10/7)', o1.period === '2026-07-01~2026-10-07', o1.period);
  t('고등부 과목 고르기 — 기출 DB 제목에서 「미적분1」', o1.subj === '미적분1' && o1.subjSel === '미적분1', JSON.stringify([o1.subj, o1.subjSel]));
  t('📘 교과서: 지정 교과서 3권(시중교재 제외) 모두 체크 · 은행 있는 2권 「준비됨」 · 없는 1권 「새벽 자동」 · key 만 읽는 확인', JSON.stringify(o1.tbRows) === '["tb:3219971","tb:3227375","tb:3300001"]' && o1.tbOn.every(Boolean) && o1.tbSt.join() === '준비됨,준비됨,새벽 자동' && o1.inQ.length >= 1 && o1.inQ[0].length === 3, JSON.stringify([o1.tbRows, o1.tbOn, o1.tbSt, o1.inQ]));
  t('📂 수학비서: 기간 안 학습지 2장 자동 체크 · 기출은 꺼짐·흐림·「다른 학교·지난 기출」 · 다른 폴더(공수1)는 칩으로만', o1.msOn.join() === 'true,true,false' && o1.examDim && o1.examNote && !o1.otherFolderRow && o1.chips[0] === '고2' && o1.chips.indexOf('공수1') > 0, JSON.stringify([o1.msOn, o1.examDim, o1.examNote, o1.chips]));
  t('📄 자료함: 이 학교·학년 2개(인식됨·대기) 체크 · 다른 학년 1개는 「다른 학년 보기 (1)」에 접힘', JSON.stringify(o1.libRows) === '["lib:L1","lib:L2"]' && o1.libOn.every(Boolean) && o1.othersBtn, JSON.stringify([o1.libRows, o1.libOn]));
  t('합계: 자료 3종 · 문항 7+42+16=65 · 인식 완료 7+24+16=47 · 새벽 처리 3건 · 🧮 매쓰플랫 자동 체크', o1.c.kinds === 3 && o1.c.all === 65 && o1.c.ok === 47 && o1.c.waitN === 3 && o1.nums.join() === '3,65,47,3' && o1.mf, JSON.stringify([o1.c, o1.nums]));
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const r0 = await pg.evaluate(() => { const a = document.getElementById('hts-req').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v1999_src.png', fullPage: true, clip: { x: Math.max(0, r0.x - 6), y: Math.max(0, r0.y - 6), width: r0.w + 12, height: r0.h + 12 } });

  /* 2) 고르기 — 대기 PDF 끄기 · 폴더 칩 · 시험 범위 단원만 · 💾 이 구성 기억 */
  const o2 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); const row = (k) => box.querySelector('[data-hts="' + k + '"]');
    row('lib:L2').click(); const c1 = htsCounts();
    box.querySelector('[data-htsf="공수1"]').click(); const otherVisible = !!row('ms:900004'); const otherOn = !!row('ms:900004').querySelector('.hts-cb.on');
    box.querySelector('[data-htsf="고2"]').click();
    [...box.querySelectorAll('.hts-seg button')].find((b) => /시험 범위 단원만/.test(b.textContent)).click();
    document.getElementById('hts-save').click(); await new Promise((r) => setTimeout(r, 60));
    return { c1, otherVisible, otherOn, mode: HTS.tbMode, cfg: T99.store['exam_hit_src_범박고_고2'] || null };
  });
  t('대기 PDF(L2) 끄기 → 새벽 처리 2건 · 문항 65 그대로(대기 PDF 문항 수 모름)', o2.c1.waitN === 2 && o2.c1.libN === 1, JSON.stringify(o2.c1));
  t('폴더 칩 「공수1」 → 그 폴더 학습지(기간 안이어도 학년 폴더가 아니면 자동 체크 안 함)', o2.otherVisible && !o2.otherOn, JSON.stringify(o2));
  t('「💾 이 구성 기억」 → exam_hit_src_범박고_고2 {folders, tbMode:scope, msOff, msOn, libOn:[L1], updated}', o2.cfg && JSON.stringify(o2.cfg.folders) === '["고2"]' && o2.cfg.tbMode === 'scope' && JSON.stringify(o2.cfg.libOn) === '["L1"]' && o2.cfg.msOff && o2.cfg.msOn && o2.cfg.updated, JSON.stringify(o2.cfg));

  /* 3) 🎯 시작 (토큰 없음) → exam_hit_req.src · GitHub 호출 없음 · 띠에 「🐙 GitHub에서 바로 실행」 */
  const o3 = await pg.evaluate(async () => {
    document.getElementById('hts-start').click(); await new Promise((r) => setTimeout(r, 120));
    const req = T99.store.exam_hit_req; render(); const box = document.getElementById('tdemo'); const a = box.querySelector('#hts-gh-link');
    return { req, gh: T99.gh.length, open: HTS.open, link: a ? { href: a.getAttribute('href'), target: a.getAttribute('target') } : null, hint: /Run workflow 를 누르면 1분 안에 시작됩니다/.test(box.innerHTML) };
  });
  const s3 = (o3.req && o3.req.src) || {};
  t('시작 → exam_hit_req: requested · mydb · 과목 · src.tb {on, mode:scope, bids 3} · src.ms 2장 · src.lib [L1] · mf', o3.req && o3.req.status === 'requested' && o3.req.mydb === 719864 && o3.req.exam.subject === '미적분1' && s3.tb && s3.tb.on && s3.tb.mode === 'scope' && JSON.stringify(s3.tb.bids) === '["3219971","3227375","3300001"]' && JSON.stringify(s3.ms) === '["900001","900002"]' && JSON.stringify(s3.lib) === '["L1"]' && s3.mf === true && !o3.open, JSON.stringify(o3.req));
  t('토큰 없음 → GitHub 호출 0 · 띠에 「🐙 GitHub에서 바로 실행」(새 창) + 「Run workflow …」 안내', o3.gh === 0 && o3.link && /actions\/workflows\/mathflat-ondemand\.yml$/.test(o3.link.href) && o3.link.target === '_blank' && o3.hint, JSON.stringify(o3));

  /* 4) 토큰 넣기 — 서버로 안 올라감 · 다시 열면 기억한 구성 · 시작하면 GitHub 깨우기 1번 */
  const o4 = await pg.evaluate(async () => {
    const up0 = T99.upserts.length;
    const sh = rSettings(); const box = sh.indexOf('id="hts-gh-box"') >= 0;
    localStorage.setItem('or_gh_token', 'test-token-123');
    await new Promise((r) => setTimeout(r, 2000));   /* 동기화 타이머(1.5초)가 지나도 서버에 안 올라가야 한다 */
    const synced = T99.upserts.slice(up0).filter((k) => k === 'or_gh_token').length;
    T99.store.exam_hit_req.status = 'done'; HT.req = T99.store.exam_hit_req;
    htdbAnalyze(719864); await new Promise((r) => setTimeout(r, 150)); render();
    const reopened = { mode: HTS.tbMode, l2: htsLibOn(htsLibItems().find((x) => x.id === 'L2')), cfg: !!HTS.cfg };
    document.getElementById('hts-start').click(); await new Promise((r) => setTimeout(r, 150));
    const g = T99.gh[0] || {}; const h = g.opt && g.opt.headers || {};
    render(); const strip = document.getElementById('tdemo').innerHTML;
    return { box, synced, reopened, n: T99.gh.length, url: g.url, method: g.opt && g.opt.method, auth: h.Authorization, acc: h.Accept, ver: h['X-GitHub-Api-Version'], body: g.opt && g.opt.body, toast: T99.toasts.slice(-3), wakeBtn: /⚡ 다시 깨우기/.test(strip), noLink: !/hts-gh-link/.test(strip) };
  });
  t('설정 탭에 「⚡ GitHub 토큰 (선택)」 칸', o4.box, '');
  t('or_gh_token 은 서버 동기화로 안 올라감', o4.synced === 0, o4.synced);
  t('다시 열면 기억한 구성(시험 범위 단원만 · L2 꺼짐)', o4.reopened.cfg && o4.reopened.mode === 'scope' && o4.reopened.l2 === false, JSON.stringify(o4.reopened));
  t('토큰 있음 → 요청 뒤 workflow_dispatch POST 1번 (주소·머리·{"ref":"main"}) · 토스트 「⚡ 서버 작업을 깨웠습니다 (1분 안 시작)」', o4.n === 1 && o4.url === 'https://api.github.com/repos/yellowtongki/lumen-math/actions/workflows/mathflat-ondemand.yml/dispatches' && o4.method === 'POST' && o4.auth === 'Bearer test-token-123' && o4.acc === 'application/vnd.github+json' && o4.ver === '2022-11-28' && o4.body === '{"ref":"main"}' && o4.toast.indexOf('⚡ 서버 작업을 깨웠습니다 (1분 안 시작)') >= 0, JSON.stringify(o4));
  t('토큰 있음 → 띠에 「⚡ 다시 깨우기」 · GitHub 링크 없음', o4.wakeBtn && o4.noLink, JSON.stringify([o4.wakeBtn, o4.noLink]));
  const o4b = await pg.evaluate(async () => {
    const n0 = T99.gh.length;
    await htKvSet('ms_mydb_index_req', { status: 'requested', at: new Date().toISOString(), by: 'app' }); await new Promise((r) => setTimeout(r, 50));
    await supaSetItem('mf_collect_req', { status: 'requested', date: '2026-10-10', by: 'app' }); await new Promise((r) => setTimeout(r, 50));
    await supaSetItem('mf_collect_req', { status: 'cancelled' }); await htKvSet('exam_hit_src_x', { status: 'requested' }); await new Promise((r) => setTimeout(r, 50));
    return T99.gh.length - n0;
  });
  t('기출 DB 목록 새로 받기 · 「지금 가져오기」 요청도 깨움(2번) · 취소·다른 키는 안 깨움', o4b === 2, o4b);

  /* 5) 결과 화면 — 우리 자료별 적중 · 후보 카드 종류 · 학생 «나눠 줌» · 보고서·.md */
  const o5 = await pg.evaluate(async () => {
    T99.store.exam_hit_req.status = 'done'; HT.req = T99.store.exam_hit_req; HTS.open = false; HT.data = {}; HT.cur = '범박고_고2_2026_2_중간'; HT.stuOpen = true; HT.view = 'sheet';
    htLoad(HT.cur, true); await new Promise((r) => setTimeout(r, 120)); render();
    const box = document.getElementById('tdemo'); const bk = box.querySelector('#hts-bykind');
    const val = (k) => { const b = box.querySelector('[data-htsk="' + k + '"]'); return b ? b.textContent : ''; };
    const d = HT.data[HT.cur]; const md = htMd(d);
    let printed = ''; const ow = window.open; window.open = () => ({ document: { open() {}, write(x) { printed += x; }, close() {} } });
    htPrint(''); window.open = ow;
    return { bk: !!bk, vals: ['tb', 'ms', 'pdf', 'mf'].map(val), matsLine: bk ? /교과서 7 · 수학비서 학습지 24 · 프린트 16 · 매쓰플랫 2/.test(bk.textContent) : false,
      labels: ['📘 교과서', '📂 수학비서 학습지', '📄 자료함 프린트', '🧮 매쓰플랫 학습지'].map((x) => box.innerHTML.indexOf(x) >= 0),
      given: /나눠 줌 \(채점 기록 없음\)/.test(box.innerHTML), stuCol: /<th>나눠 줌<\/th>/.test(box.innerHTML), row: htStudentRow(d, 'AAA111'),
      md: { line: /- 우리 자료별 적중 \(같은 문제 \+ 숫자변형\): 교과서 1 · 학원 학습지 1 · 학원 프린트 1 · 매쓰플랫 학습지·교재 1/.test(md), noMs: md.indexOf('수학비서') < 0, tbl: /\| 1 \| 함수의 극한 \| 극한값 계산 \| 2 \| 같은 문제 \(확인 중\) \| 교과서 \|/.test(md), src: /- 대조한 우리 자료: .*교과서 7문항 \+ 학원 학습지 24문항 \+ 학원 프린트 16문항/.test(md) },
      pr: { blk: /<h2>우리 자료별 적중<\/h2>/.test(printed), noMs: printed.indexOf('수학비서') < 0, tb: /<td>교과서<\/td><\/tr>/.test(printed) } };
  });
  t('결과: 「📚 우리 자료별 적중」 막대 — 교과서 1 · 수학비서 1 · 프린트 1(✓1) · 매쓰플랫 1 · 대조 문항 수(stats.byKind)', o5.bk && o5.vals[0] === '1' && o5.vals[1] === '1' && /^1/.test(o5.vals[2]) && /✓1/.test(o5.vals[2]) && o5.vals[3] === '1' && o5.matsLine, JSON.stringify([o5.vals, o5.matsLine]));
  t('후보 카드에 자료 종류 (교과서 · 수학비서 학습지 · 자료함 프린트 · 매쓰플랫 학습지) · 채점 없는 자료는 「나눠 줌」', o5.labels.every(Boolean) && o5.given, JSON.stringify(o5.labels));
  t('학생별: 「나눠 줌」 칸 · ○○○ = 적중 4 · 맞힘 0 · 틀림 1 · 나눠 줌 3', o5.stuCol && o5.row.hit === 4 && o5.row.X === 1 && o5.row.given === 3 && o5.row.none === 0, JSON.stringify(o5.row));
  t('블로그 .md: 자료별 적중 줄 · 대조 자료 줄 · 표의 자료 종류 «교과서» · 「수학비서」 낱말 없음', o5.md.line && o5.md.noMs && o5.md.tbl && o5.md.src, JSON.stringify(o5.md));
  t('학부모 보고서: 「우리 자료별 적중」 · 표 «교과서» · 「수학비서」 낱말 없음', o5.pr.blk && o5.pr.noMs && o5.pr.tb, JSON.stringify(o5.pr));

  /* 6) 시험지 올리기 입구도 confirm 없이 요청 화면 */
  const o6 = await pg.evaluate(async () => {
    let asked = 0; window.confirm = () => { asked++; return true; };
    HT.req = { status: 'done' }; HT.showForm = true; HT.form = { school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', date: '', matTitle: '' }; render();
    const inp = document.getElementById('ht-files'); const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4'], '시험지.pdf', { type: 'application/pdf' })); inp.files = dt.files;
    htSubmit(); await new Promise((r) => setTimeout(r, 150)); render();
    return { asked, open: HTS.open, files: HTS.files.length, head: /올릴 시험지 1개/.test(document.getElementById('tdemo').innerHTML) };
  });
  t('「📤 시험지 올리기」 → confirm 없이 요청 화면 (올릴 시험지 1개)', o6.asked === 0 && o6.open && o6.files === 1 && o6.head, JSON.stringify(o6));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
