#!/usr/bin/env node
/* 학원앱 v19-107 검사 — 🎯 적중 분석 요청 화면: 수학비서 «📄 내 문제지» · «🗄 나만의 DB» 두 탭 + 「범위: 전체 / 시험 범위 단원만」
 *   (원장 2026-10-11 「수학비서는 DB 와 내 문제지가 다르다 … 수학비서 폴더 형태와 똑같아야 헷갈리지 않는다」)
 *   ① 기본 탭 = 내 문제지 · 폴더 나무 순서·겹침 = 넣어 둔 나무(수학비서) 그대로 · 파일 수 · 펼치기/접기
 *   ② 자동 체크: 기간 안 + 교과서 변형/그 학교 폴더 → 켬 · 통합기출 · 「내신」 · 「기출」 · 「25년 …」 · 다른 과목 · 다른 학교 · 기간 밖 · 맨 위 폴더 → 끔
 *   ③ 「🗄 나만의 DB」 탭 = ms_papers_index.tree 나무 · 예전 체크 규칙
 *   ④ 요청 src.mp · src.scope · 「💾 이 구성 기억」 mpOn/mpOff/scope · 범위 칩 켜고 끄기
 *   ⑤ 다시 판정 화면: 시험 단원 칩(문항 중단원·유형 → mf_typedb 소단원) · 「범위 밖 n문항」(ms_mypaper_<id>)
 *   ⑥ 결과 화면 「이번 판정에 쓴 자료」에 학원 문제지 n장 따로
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19107.js lumen_v19-107.html
 *   그림: $SP/v19107_tree.png (요청 화면 — 내 문제지 나무)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-107.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-107'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고1_2026_2_중간';
/* 내 문제지 폴더 나무 — 수학비서 순서 그대로 (이름 순이 아니다: 2026년 → 범박고 → 옥길중 → 교과서 변형 → 빈 폴더) */
const MP_TREE = [{ id: 1, n: '작업공간', fc: 2, tc: 11, c: [
  { id: 2, n: '2026년', fc: 0, tc: 2, c: [{ id: 3, n: '고1 통합기출', fc: 2, tc: 2, c: [] }] },
  { id: 4, n: '범박고', fc: 3, tc: 3, c: [] },
  { id: 5, n: '옥길중', fc: 1, tc: 1, c: [] },
  { id: 6, n: '교과서 변형', fc: 3, tc: 3, c: [] },
  { id: 7, n: '주간테스트', fc: 0, tc: 0, c: [] }] }];
const P = (id, title, folderId, folderPath, n, createdAt, status, progress) => ({ id, title, folderId, folderPath, n, progress: progress || 'completed', createdAt: createdAt + 'T10:00:00+09:00', status: status || '' });
const MP_ITEMS = [
  P(9101, '공통수학2 복습 프린트 (맨 위 폴더)', 1, '작업공간', 20, '2026-09-10'),
  P(9102, '오래된 메모', 1, '작업공간', 5, '2026-03-01'),
  P(9301, '2026 고1 통합 모의 3월', 3, '작업공간 › 2026년 › 고1 통합기출', 25, '2026-09-01'),
  P(9302, '고1 통합 학력평가 6월', 3, '작업공간 › 2026년 › 고1 통합기출', 25, '2026-09-02'),
  P(9401, '범박고1 2학기 중간 1회', 4, '작업공간 › 범박고', 19, '2026-09-21', 'ready'),
  P(9402, '25년 범박고 고1-1 기말', 4, '작업공간 › 범박고', 23, '2026-07-02'),
  P(9403, '내신 2026년 경기 부천시 범박고 고1 공통수학2', 4, '작업공간 › 범박고', 23, '2026-08-03'),
  P(9501, '옥길중1 2학기 예상문제', 5, '작업공간 › 옥길중', 19, '2026-09-04'),
  P(9601, '비상 공통수학2 중간고사(평행이동~집합)', 6, '작업공간 › 교과서 변형', 117, '2026-09-16', 'ready'),
  P(9602, '동아 미적분1 중간고사(~평균값)', 6, '작업공간 › 교과서 변형', 80, '2026-09-28'),
  P(9603, '비상 공수2 중간고사 난이도5', 6, '작업공간 › 교과서 변형', 8, '2026-10-06', 'ready') ];
/* 나만의 DB 폴더 나무 (워커가 ms_papers_index.tree 로) */
const DB_TREE = [{ id: 50, n: '작업공간', fc: 1, tc: 4, c: [
  { id: 51, n: '고등학교', fc: 0, tc: 2, c: [{ id: 52, n: '고1', fc: 2, tc: 2, c: [] }] },
  { id: 53, n: '공수2', fc: 1, tc: 1, c: [] }] }];
const STORE = {
  mf_textbooks: { books: { '3119965': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상A', fulltitle: '교과서_가상A - 공통수학2' } },
    bySchoolGrade: { '범박고|고1': { n: 1, books: { '3119965': 2 } } } },
  mf_textbook_3119965: { bid: 3119965, problems: [{ id: 1 }, { id: 2 }, { id: 3 }] },
  ms_mypapers_index: { updated: '2026-10-11T04:30:00Z', tree: MP_TREE, items: MP_ITEMS },
  ms_papers_index: { updated: '2026-10-11T04:30:00Z', tree: DB_TREE, items: [
    { id: 700001, title: '공통수학2 도형의 방정식 주간 점검', folder: '고1', grade: '고1', uploadedAt: '2026-09-10T10:00:00+09:00', n: 20, status: 'ready', exam: false, fid: 52 },
    { id: 700002, title: '내신 2025 다른 학교 고1 기말', folder: '고1', grade: '고1', uploadedAt: '2026-09-11T10:00:00+09:00', n: 21, status: '', exam: true, fid: 52 },
    { id: 700003, title: '수비프레스 공통수학2 대단원 테스트', folder: '공수2', grade: '', uploadedAt: '2026-08-10T10:00:00+09:00', n: 108, status: 'ready', exam: false, fid: 53 },
    { id: 700004, title: 'EBS 맨 위 자료', folder: '작업공간', grade: '', uploadedAt: '2026-09-01T10:00:00+09:00', n: 16, status: '', exam: false, fid: 50 } ] },
  exam_lib: { updated: '2026-10-01T00:00:00Z', items: [] },
  school_calendar: { schools: [{ name: '범박고', exams: [{ label: '2학기 중간고사', from: '2026-09-29' }] }] },
  exam_hit_index: { items: [{ examId: EID, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 3, at: '2026-10-10T12:00:00Z' }] },
  /* 유형 → 단원 (가짜 번호) */
  mf_concept_names: { 501: { m: '평면좌표', n: '두 점 사이의 거리' }, 502: { m: '직선의 방정식', n: '세 직선의 위치 관계' }, 503: { m: '원의 방정식', n: '원과 직선의 위치 관계' },
    601: { m: '다항식의 연산', n: '다항식의 덧셈' }, 602: { m: '경우의 수', n: '합의 법칙' } },
  mf_typedb: { grades: [{ g: '공통수학2', grp: '고등', b: [{ n: '도형의 방정식', c: 3, m: [
    { n: '평면좌표', s: [{ n: '두 점 사이의 거리', t: ['두 점 사이의 거리'] }] },
    { n: '직선의 방정식', s: [{ n: '두 직선의 위치 관계', t: ['세 직선의 위치 관계'] }] },
    { n: '원의 방정식', s: [{ n: '원과 직선', t: ['원과 직선의 위치 관계'] }] }] }] },
    { g: '공통수학1', grp: '고등', b: [{ n: '다항식', c: 2, m: [{ n: '다항식의 연산', s: [{ n: '다항식의 연산', t: ['다항식의 덧셈'] }] }, { n: '경우의 수', s: [{ n: '합의 법칙과 곱의 법칙', t: ['합의 법칙'] }] }] }] }] },
  /* 인식된 내 문제지 — 6문항 중 2문항이 시험 범위 밖(공통수학1) · 1문항은 유형 없음(남김) */
  ms_mypaper_9601: { id: 9601, kind: 'mp', title: '비상 공통수학2 중간고사(평행이동~집합)', status: 'ready', n: 6, items: [
    { no: 1, cid: 501 }, { no: 2, cid: 502 }, { no: 3, cid: 503 }, { no: 4, cid: 601 }, { no: 5, cid: 602 }, { no: 6, cid: null }] },
};
STORE['exam_hit_' + EID] = { examId: EID, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', date: '2026-09-29', mydb: 719865, subject: '공통수학2' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-09-29', students: ['AAA111'],
  src: { tb: { on: true, mode: 'all', bids: ['3119965'] }, ms: ['700001'], mp: ['9601', '9401'], lib: [], mf: true },
  items: [
    { no: 1, cid: 501, chapter: '평면좌표', type: '두 점 사이의 거리', level: 2, cands: [{ k: 'mp:9601:1', kind: 'var', also: [] }], hit: null },
    { no: 2, cid: 502, chapter: '직선의 방정식', type: '세 직선의 위치 관계', level: 3, cands: [{ k: 'ms:700001:3', kind: 'var', also: [] }], hit: null },
    { no: 3, cid: 503, chapter: '원의 방정식', type: '원과 직선의 위치 관계', level: 3, cands: [{ k: 'tb:2', kind: 'type', also: [] }], hit: null } ],
  mats: {
    'mp:9601:1': { kind: 'ms', mp: true, title: '비상 공통수학2 중간고사(평행이동~집합)', where: '비상 공통수학2 중간고사(평행이동~집합) 1번', cid: 501, img: '', res: {} },
    'ms:700001:3': { kind: 'ms', title: '공통수학2 도형의 방정식 주간 점검', where: '3번', cid: 502, img: '', res: {} },
    'tb:2': { kind: 'textbook', title: '교과서 가상A', where: '10쪽 1번', cid: 503, img: '', res: {} } },
  stats: { total: 3, byKind: { textbook: { mats: 3, hit: 0 }, ms: { mats: 156, hit: 2, mp: { mats: 136, hit: 1, papers: 2 } }, upload: { mats: 0, hit: 0 }, ws: { mats: 0, hit: 0 }, book: { mats: 0, hit: 0 } } } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
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
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    VIEW = 'examhit';
    HTDB.idx = { items: [{ id: 719870, t: '내신 2026년 경기 부천시 범박고 고1 공통 2학기 중간 공통수학2', f: '작업공간', sc: '범박고', g: '고1', y: '2026', sem: '2', term: '중간', n: 21, ok: false }] };
  }, STORE);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* 1) 새 분석(기출 DB → 🎯) — 요청 화면 · 기본 탭 내 문제지 */
  await pg.evaluate(() => { HT.kicked = true; HT.idx = JSON.parse(JSON.stringify(T.store.exam_hit_index)); HT.req = { status: 'done' }; HT.data = {}; htdbAnalyze(719870); });
  await settle(300); await pg.evaluate(() => render()); await settle(60);
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'); const q = (s) => box.querySelector(s);
    const tabs = [...box.querySelectorAll('[data-msttab]')].map((b) => ({ k: b.getAttribute('data-msttab'), on: b.classList.contains('on'), t: b.textContent }));
    return { open: HTS.open, to: HTS.to, tab: HTS.msTab, tabs, tree: !!q('[data-msttree="mp"]'), scope: !!q('#mst-scope'), cnt: (q('#hts-msCnt') || {}).textContent || '' };
  });
  t('요청 화면 · 시험 첫날 9/29(학원 달력) · 📂 수학비서 두 탭, 기본 「📄 내 문제지」', o1.open && o1.to === '2026-09-29' && o1.tab === 'mp' && o1.tabs.length === 2 && o1.tabs[0].k === 'mp' && o1.tabs[0].on && /📄 내 문제지/.test(o1.tabs[0].t) && /🗄 나만의 DB/.test(o1.tabs[1].t) && o1.tree, JSON.stringify(o1));

  /* 2) 폴더 나무 — 모두 펼친 뒤 순서·겹침·파일 수가 넣어 둔 나무와 같다 */
  const o2 = await pg.evaluate(async (MP_TREE) => {
    const box = document.getElementById('tdemo');
    const initial = [...box.querySelectorAll('[data-msttree="mp"] [data-mstf]')].map((e) => e.querySelector('.mst-fn').textContent);
    for (let k = 0; k < 10; k++) {   /* 접힌 폴더를 모두 펼친다 */
      const closed = [...box.querySelectorAll('[data-msttree="mp"] [data-mstf]')].find((e) => /▸/.test(e.textContent));
      if (!closed) break; closed.click(); await new Promise((r) => setTimeout(r, 20));
    }
    const got = [...box.querySelectorAll('[data-msttree="mp"] [data-mstf]')].map((e) => ({ n: e.querySelector('.mst-fn').textContent, d: Number(e.getAttribute('data-depth')), c: e.querySelector('.mst-fc').textContent }));
    const want = []; (function walk(fs, d) { fs.forEach((f) => { want.push({ n: f.n, d, c: String(f.tc) }); walk(f.c, d + 1); }); })(MP_TREE, 0);
    /* 폴더 아래 문제지 — 그 폴더 바로 다음(아래 폴더 뒤)에 */
    const seq = [...box.querySelectorAll('[data-msttree="mp"] > *')].map((e) => e.getAttribute('data-mstf') || e.getAttribute('data-hts') || '');
    return { initial, got, want, seq };
  }, MP_TREE);
  t('처음엔 맨 위 폴더 · 체크가 있는 폴더만 펼침 (2026년 › 고1 통합기출은 접힘)', o2.initial.indexOf('고1 통합기출') < 0 && o2.initial[0] === '작업공간', JSON.stringify(o2.initial));
  t('펼친 나무 = 수학비서 나무 그대로 (이름 · 순서 · 겹침 깊이 · 파일 수)', JSON.stringify(o2.got) === JSON.stringify(o2.want), JSON.stringify(o2.got));
  const iOf = (k) => o2.seq.indexOf(k);
  t('문제지는 자기 폴더 아래 (고1 통합기출 아래 9301 · 교과서 변형 아래 9601 · 맨 위 문제지는 아래 폴더들 뒤)',
    iOf('mp:3') < iOf('mp:9301') && iOf('mp:9301') < iOf('mp:4') && iOf('mp:6') < iOf('mp:9601') && iOf('mp:9601') < iOf('mp:7') && iOf('mp:9101') > iOf('mp:7'), JSON.stringify(o2.seq));

  /* 3) 자동 체크 규칙 */
  const o3 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'); const on = (id) => { const r = box.querySelector('[data-hts="mp:' + id + '"]'); return r ? !!r.querySelector('.hts-cb.on') : null; };
    const sm = (id) => { const r = box.querySelector('[data-hts="mp:' + id + '"]'); return r ? r.querySelector('small').textContent : ''; };
    const ids = [9101, 9102, 9301, 9302, 9401, 9402, 9403, 9501, 9601, 9602, 9603]; const o = {}; ids.forEach((id) => { o[id] = on(id); });
    return { o, s9602: sm(9602), s9501: sm(9501), s9402: sm(9402), s9603: sm(9603), cnt: (box.querySelector('#hts-msCnt') || {}).textContent };
  });
  t('자동 체크 켬: 교과서 변형 9601(9/16) · 범박고 폴더 9401(9/21)', o3.o[9601] === true && o3.o[9401] === true, JSON.stringify(o3.o));
  t('꺼 둠: 통합기출 9301·9302 · 「25년 …」 9402 · 「내신」 9403 · 다른 학교 9501 · 다른 과목 9602 · 기간 밖 9603 · 맨 위 폴더 9101·9102',
    [9101, 9102, 9301, 9302, 9402, 9403, 9501, 9602, 9603].every((id) => o3.o[id] === false), JSON.stringify(o3.o));
  t('꺼 둔 까닭이 보임 (다른 과목 · 다른 학교 · 지난 기출 · 기간 밖)', /다른 과목/.test(o3.s9602) && /다른 학교/.test(o3.s9501) && /지난 기출/.test(o3.s9402) && /기간 밖/.test(o3.s9603), JSON.stringify([o3.s9602, o3.s9501, o3.s9402, o3.s9603]));
  t('칸 머리 수: 내 문제지 2장', /내 문제지 2장/.test(o3.cnt), o3.cnt);
  await pg.evaluate(() => { const box = document.getElementById('tdemo'); box.querySelector('[data-hts="mp:9603"]').click(); });
  await settle(40);
  const shot = await pg.evaluate(() => { const a = document.getElementById('hts-req').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19107_tree.png', fullPage: true, clip: { x: Math.max(0, shot.x - 6), y: Math.max(0, shot.y - 6), width: shot.w + 12, height: Math.min(shot.h + 12, 1800) } });

  /* 4) 나만의 DB 탭 — ms_papers_index.tree 나무 · 예전 규칙(학년 폴더 기간 안 켬 · 기출 끔) */
  const o4 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); box.querySelector('[data-msttab="db"]').click(); await new Promise((r) => setTimeout(r, 30));
    for (let k = 0; k < 10; k++) { const c = [...box.querySelectorAll('[data-msttree="db"] [data-mstf]')].find((e) => /▸/.test(e.textContent)); if (!c) break; c.click(); await new Promise((r) => setTimeout(r, 20)); }
    const names = [...box.querySelectorAll('[data-msttree="db"] [data-mstf]')].map((e) => '  '.repeat(Number(e.getAttribute('data-depth'))) + e.querySelector('.mst-fn').textContent);
    const on = (id) => { const r = box.querySelector('[data-hts="ms:' + id + '"]'); return r ? !!r.querySelector('.hts-cb.on') : null; };
    const r = { tab: HTS.msTab, names, a: on(700001), b: on(700002), c: on(700003), d: on(700004) };
    box.querySelector('[data-hts="ms:700003"]').click(); await new Promise((r) => setTimeout(r, 20)); r.c2 = on(700003);
    box.querySelector('[data-msttab="mp"]').click(); await new Promise((r) => setTimeout(r, 20)); r.back = HTS.msTab;
    return r;
  });
  t('「🗄 나만의 DB」 탭 = 수학비서 나만의 DB 나무 (작업공간 › 고등학교 › 고1 · 공수2)', o4.tab === 'db' && JSON.stringify(o4.names) === JSON.stringify(['작업공간', '  고등학교', '    고1', '  공수2']), JSON.stringify(o4.names));
  t('나만의 DB 체크 규칙 그대로: 고1 폴더 기간 안 켬 · 기출 끔 · 다른 폴더 끔 → 눌러 켬', o4.a === true && o4.b === false && o4.c === false && o4.d === false && o4.c2 === true && o4.back === 'mp', JSON.stringify(o4));

  /* 5) 범위 칩 — 새 분석은 시험 단원을 아직 모름 · 켜고 끄기 · 기억 · 요청 src */
  const o5 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); const r = {};
    r.row = !!box.querySelector('#mst-scope'); r.allOn = box.querySelector('#mst-scope-all').classList.contains('on');
    box.querySelector('#mst-scope-exam').click(); await new Promise((x) => setTimeout(x, 80));
    r.scope = HTS.scope; r.tbMode = HTS.tbMode; r.examOn = box.querySelector('#mst-scope-exam').classList.contains('on'); r.note = box.querySelector('#mst-scope').textContent;
    const n0 = T.upserts.length; document.getElementById('hts-save').click(); await new Promise((x) => setTimeout(x, 80));
    r.saved = T.upserts.slice(n0).indexOf('exam_hit_src_범박고_고1') >= 0; r.cfg = T.store['exam_hit_src_범박고_고1'];
    /* 화면을 닫았다 다시 열면 기억한 구성(범위 · 9603 켬 · 700003 켬)으로 */
    htsClose(); htdbAnalyze(719870); await new Promise((x) => setTimeout(x, 300)); render();
    const on = (k) => { const e = box.querySelector('[data-hts="' + k + '"]'); return e ? !!e.querySelector('.hts-cb.on') : null; };
    r.re = { scope: HTS.scope, examOn: box.querySelector('#mst-scope-exam').classList.contains('on'), p9603: on('mp:9603'), p9601: on('mp:9601'), cfgNote: /기억한 구성으로 열었습니다/.test(box.innerHTML) };
    document.getElementById('hts-start').click(); await new Promise((x) => setTimeout(x, 150));
    r.req = T.store.exam_hit_req; return r;
  });
  t('머리에 「범위 전체 / 시험 범위 단원만」 (기본 전체)', o5.row && o5.allOn, JSON.stringify(o5));
  t('「시험 범위 단원만」 → scope exam · 교과서도 시험 범위 · 새 분석은 «시험지를 인식한 뒤» 안내', o5.scope === 'exam' && o5.tbMode === 'scope' && o5.examOn && /인식한 뒤/.test(o5.note), JSON.stringify([o5.scope, o5.tbMode, o5.note]));
  t('「💾 이 구성 기억」 = scope exam · mpOn 9603 · msOn 700003', o5.saved && o5.cfg && o5.cfg.scope === 'exam' && o5.cfg.mpOn && o5.cfg.mpOn['9603'] === 1 && o5.cfg.msOn && o5.cfg.msOn['700003'] === 1, JSON.stringify(o5.cfg));
  t('다시 열면 기억한 대로 (범위 켬 · 9603 켬 · 9601 자동 켬)', o5.re.scope === 'exam' && o5.re.examOn && o5.re.p9603 && o5.re.p9601 && o5.re.cfgNote, JSON.stringify(o5.re));
  const s5 = (o5.req && o5.req.src) || {};
  t('「🎯 적중 분석 시작」 → exam_hit_req.src.mp = [9401, 9601, 9603] · scope exam · tb.mode scope · ms 에 700001·700003',
    o5.req && o5.req.status === 'requested' && JSON.stringify((s5.mp || []).slice().sort()) === '["9401","9601","9603"]' && s5.scope === 'exam' && s5.tb && s5.tb.mode === 'scope'
    && (s5.ms || []).indexOf('700001') >= 0 && (s5.ms || []).indexOf('700003') >= 0, JSON.stringify(s5));

  /* 6) 다시 판정 화면 — 시험 단원 칩 · 범위 밖 n문항 */
  const o6 = await pg.evaluate(async () => {
    T.store.exam_hit_req.status = 'done'; HT.req = T.store.exam_hit_req; if (HT.poll) { clearInterval(HT.poll); HT.poll = null; }
    HT.cur = '범박고_고1_2026_2_중간'; htLoad(HT.cur, true); await new Promise((x) => setTimeout(x, 200)); render();
    const box = document.getElementById('tdemo'); const r = {};
    r.used = (box.querySelector('#hts-used') || {}).textContent || '';
    htsRejOpen(); await new Promise((x) => setTimeout(x, 400)); render(); await new Promise((x) => setTimeout(x, 200)); render();
    const on = (k) => { const e = box.querySelector('[data-hts="' + k + '"]'); return e ? !!e.querySelector('.hts-cb.on') : null; };
    r.rej = !!HTS.rejudge; r.scope = HTS.scope; r.p9601 = on('mp:9601'); r.p9401 = on('mp:9401'); r.p9603 = on('mp:9603');
    r.chips0 = [...box.querySelectorAll('[data-mstu]')].map((e) => e.getAttribute('data-mstu'));
    box.querySelector('#mst-scope-exam').click(); await new Promise((x) => setTimeout(x, 300)); render(); await new Promise((x) => setTimeout(x, 100)); render();
    r.chips = [...box.querySelectorAll('[data-mstu]')].map((e) => e.getAttribute('data-mstu'));
    const row = box.querySelector('[data-hts="mp:9601"]'); const out = row && row.querySelector('[data-mstout]');
    r.out = out ? out.getAttribute('data-mstout') : null; r.outTxt = out ? out.textContent : '';
    r.read = T.reads.indexOf('ms_mypaper_9601') >= 0; r.noHint9401 = !(box.querySelector('[data-hts="mp:9401"] [data-mstout]'));
    document.getElementById('hts-start').click(); await new Promise((x) => setTimeout(x, 150));
    r.req = T.store.exam_hit_req; return r;
  });
  t('결과 화면 「이번 판정에 쓴 자료」에 학원 문제지 2장(136문항) 따로 · 학원 대비 학습지 1장(20문항)', /학원 문제지 2장\(136문항\)/.test(o6.used) && /학원 대비 학습지 1장\(20문항\)/.test(o6.used), o6.used);
  t('다시 판정 화면: 지난 판정 src.mp 그대로 (9601·9401 켬 · 9603 끔) · 시험 단원 칩 = 평면좌표 · 직선의 방정식 · 원의 방정식',
    o6.rej && o6.p9601 && o6.p9401 && o6.p9603 === false && JSON.stringify(o6.chips0) === '["평면좌표","직선의 방정식","원의 방정식"]', JSON.stringify(o6));
  t('「시험 범위 단원만」 켜면 인식된 문제지 9601 에 「범위 밖 2문항」 (ms_mypaper_9601 읽음 · 유형 없는 문항은 남김) · 인식 안 된 9401 은 표시 없음',
    o6.scope === 'all' && o6.out === '2' && /범위 밖 2문항/.test(o6.outTxt) && o6.read && o6.noHint9401, JSON.stringify(o6));
  const s6 = (o6.req && o6.req.src) || {};
  t('→ 다시 판정 요청 src.scope exam · src.mp [9401, 9601] · rejudge', o6.req && o6.req.rejudge === true && s6.scope === 'exam' && JSON.stringify((s6.mp || []).slice().sort()) === '["9401","9601"]', JSON.stringify(s6));

  /* 7) 내 문제지 목록이 아직 없으면(새벽 준비 전) 예전처럼 나만의 DB 화면 */
  const o7 = await pg.evaluate(async () => {
    T.store.exam_hit_req.status = 'done'; HT.req = T.store.exam_hit_req; if (HT.poll) { clearInterval(HT.poll); HT.poll = null; }
    delete T.store.ms_mypapers_index; htsClose(); htdbAnalyze(719870); await new Promise((x) => setTimeout(x, 300)); render();
    const box = document.getElementById('tdemo'); return { tab: HTS.msTab, tabs: box.querySelectorAll('[data-msttab]').length, ms: !!box.querySelector('#hts-ms'), src: htsSrcValue().mp };
  });
  t('내 문제지 목록이 없으면 탭 없이 예전 나만의 DB 칸 · src.mp 빈 배열', o7.tab === 'db' && o7.tabs === 0 && o7.ms && Array.isArray(o7.src) && !o7.src.length, JSON.stringify(o7));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
