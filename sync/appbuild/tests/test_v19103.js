#!/usr/bin/env node
/* 학원앱 v19-103 검사 — 🎯 적중 분석 결과 화면 「📂 우리 자료 고르기 → 다시 판정」 (원장 지시 2026-10-11 「요청화면 수학비서가 어디에 있나? 잘 안 보인다」)
 *   ① 결과 머리 단추 → 요청 화면을 «다시 판정» 모드로 (지난 판정 src · 기간) → 「🔄 이 자료로 다시 판정」 = exam_hit_req { rejudge:true, src }
 *   ② 예전 「🔄 다시 판정」(htRejudge) 도 바로 요청하지 않고 같은 화면 · 「← 결과로 돌아가기」 = 요청 없음
 *   ③ 다른 폴더(공수2 · 기간 밖)에서 체크한 학습지 — 폴더가 많아도 칩이 앞쪽에 ✓1 · 체크된 채
 *   ④ 「우리 자료별 적중」 칸 — 「이번 판정에 쓴 자료: …」 한 줄 + 「바꾸기」 · src 가 없는 옛 시험은 기억한 구성(exam_hit_src_범박고_고1)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19103.js lumen_v19-103.html
 *   그림: $SP/v19103_btn.png (결과 머리 + 새 단추) · $SP/v19103_rej.png (다시 판정 화면)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-103.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-103'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고1_2026_2_중간';
/* 수학비서 폴더 18개(학습지 많음) — 예전 칩 순서(학습지 많은 폴더 먼저 · 16개까지)였다면 공수2 칩이 잘린다 */
const many = [];
for (let f = 1; f <= 18; f++) for (let j = 0; j < 3; j++) many.push({ id: 800000 + f * 10 + j, title: '폴더' + f + ' 학습지 ' + j, folder: '폴더' + String(f).padStart(2, '0'), grade: '', uploadedAt: '2026-09-01T10:00:00+09:00', n: 10, status: 'ready', exam: false });
const STORE = {
  mf_textbooks: { books: {
    '3119965': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상A', fulltitle: '교과서_가상A - 공통수학2' },
    '3119966': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상B', fulltitle: '교과서_가상B - 공통수학2' } },
    bySchoolGrade: { '범박고|고1': { n: 2, books: { '3119965': 2, '3119966': 1 } } } },
  mf_textbook_3119965: { bid: 3119965, problems: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }] },
  ms_papers_index: { updated: '2026-10-10T04:30:00Z', items: many.concat([
    { id: 900101, title: '공통수학2 도형의 방정식 주간 점검', folder: '고1', grade: '고1', uploadedAt: '2026-09-10T10:00:00+09:00', n: 20, status: 'ready', exam: false },
    { id: 900102, title: '공통수학2 집합 복습', folder: '고1', grade: '고1', uploadedAt: '2026-09-25T10:00:00+09:00', n: 15, status: 'ready', exam: false },
    { id: 900103, title: '1학기 다항식 정리', folder: '고1', grade: '고1', uploadedAt: '2026-05-01T10:00:00+09:00', n: 30, status: 'ready', exam: false },
    { id: 900201, title: '공통수학2 직선의 방정식 심화 (봄에 만든 것)', folder: '공수2', grade: '', uploadedAt: '2026-03-10T10:00:00+09:00', n: 12, status: 'ready', exam: false },
    { id: 900301, title: '미적분1 함수의 극한 맛보기', folder: '미적분1', grade: '', uploadedAt: '2026-09-15T10:00:00+09:00', n: 9, status: 'ready', exam: false } ]) },
  exam_lib: { updated: '2026-10-01T00:00:00Z', items: [
    { id: 'L1', title: '고1 도형의 방정식 보충 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-20T10:00:00Z', n: 10, status: 'ready', items: [] },
    { id: 'L2', title: '고1 집합 프린트', school: '범박고', grade: '고1', sem: '2', year: 2026, uploadedAt: '2026-09-25T10:00:00Z', n: 8, status: 'ready', items: [] } ] },
  /* 기억한 구성 — 공수2 폴더(기간 밖) 학습지를 켜 둠 · 시험 범위 단원만 · L1 */
  'exam_hit_src_범박고_고1': { folders: ['고1'], tbMode: 'scope', tbOff: {}, msOff: {}, msOn: { '900201': 1 }, libOn: ['L1'], mf: true, updated: '2026-10-01T00:00:00Z' },
  exam_hit_index: { items: [{ examId: EID, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 3, at: '2026-10-10T12:00:00Z' }] },
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
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], confirms: 0 };
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
    window.confirm = () => { T.confirms++; return true; };
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    VIEW = 'examhit';
    HTDB.idx = { items: [{ id: 719870, t: '내신 2026년 경기 부천시 범박고 고1 공통 2학기 중간 공통수학2', f: '작업공간', sc: '범박고', g: '고1', y: '2026', sem: '2', term: '중간', n: 21, ok: false }] };
  }, STORE);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);

  /* 1) 결과 화면 — 머리 단추 · 「이번 판정에 쓴 자료」 한 줄 */
  await pg.evaluate(() => { HT.kicked = true; HT.idx = clone1(); function clone1() { return JSON.parse(JSON.stringify(T.store.exam_hit_index)); } HT.req = { status: 'done' }; HT.data = {}; HT.cur = '범박고_고1_2026_2_중간'; htLoad(HT.cur, true); });
  await settle(); await pg.evaluate(() => render()); await settle(60);
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'); const b = box.querySelector('#hts-rej-btn'); const sel = box.querySelector('select[onchange^="htBasis"]');
    const head = b && b.parentElement; const used = box.querySelector('#hts-used');
    return { ver: APP_VER, btn: b ? b.textContent : '', sameRow: !!(head && sel && head.contains(sel)), oldBtn: [...box.querySelectorAll('button')].some((x) => x.textContent === '🔄 다시 판정'),
      used: used ? used.textContent : '', inByKind: !!(used && used.closest('#hts-bykind')), edit: !!box.querySelector('#hts-used-edit'), reqKeys: T.upserts.slice() };
  });
  t('버전 ' + WANT, o1.ver === WANT, o1.ver);
  t('결과 머리(적중 기준 옆)에 「📂 우리 자료 고르기 → 다시 판정」 · 예전 「🔄 다시 판정」도 남음', o1.btn === '📂 우리 자료 고르기 → 다시 판정' && o1.sameRow && o1.oldBtn, JSON.stringify(o1));
  t('「우리 자료별 적중」 칸에 「이번 판정에 쓴 자료: 교과서 1권(7문항) · 학원 대비 학습지 2장(32문항) · 프린트 0장 · 루멘수학 학습지·교재 자동(2문항)」 + 바꾸기',
    o1.inByKind && o1.edit && /이번 판정에 쓴 자료: 교과서 1권\(7문항\) · 학원 대비 학습지 2장\(32문항\) · 프린트 0장 · 루멘수학 학습지·교재 자동\(2문항\)/.test(o1.used) && /바꾸기/.test(o1.used), o1.used);
  const card = await pg.evaluate(() => { const c = document.getElementById('hts-rej-btn').closest('.ht-card'); const a = c.getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: Math.min(a.height, 520) }; });
  await pg.screenshot({ path: SP + '/v19103_btn.png', clip: { x: Math.max(0, card.x - 6), y: Math.max(0, card.y - 6), width: card.w + 12, height: card.h + 12 } });

  /* 2) 단추 → 다시 판정 화면 (지난 판정 src 로) */
  await pg.evaluate(() => document.getElementById('hts-rej-btn').click()); await settle(250); await pg.evaluate(() => render()); await settle(60);
  const o2 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'); const q = (s) => box.querySelector(s);
    const row = (k) => q('[data-hts="' + k + '"]'); const on = (k) => { const r = row(k); return !!(r && r.querySelector('.hts-cb.on')); };
    const chips = [...box.querySelectorAll('[data-htsf]')]; const ci = chips.findIndex((c) => c.getAttribute('data-htsf') === '공수2');
    return { open: HTS.open, rej: !!HTS.rejudge, title: (q('#hts-req') || {}).textContent || '', start: (q('#hts-start') || {}).textContent, back: (q('#hts-back') || {}).textContent,
      info: !!q('#hts-rej-info'), fromSrc: /지난 판정에 쓴 자료로 열었습니다/.test(box.innerHTML), period: HTS.from + '~' + HTS.to, subj: HTS.subject, mydb: HTS.mydb,
      tb: ['tb:3119965', 'tb:3119966'].map(on), mode: HTS.tbMode, ms: ['ms:900101', 'ms:900102', 'ms:900103'].map(on), lib: ['lib:L1', 'lib:L2'].map(on), mf: on('mf'),
      chipIdx: ci, chipN: ci >= 0 ? (chips[ci].querySelector('[data-htsn]') || {}).textContent : '', nChips: chips.length, otherBtn: !!q('[data-htsgo="공수2"]'), reqs: T.upserts.filter((k) => k === 'exam_hit_req').length };
  });
  t('단추 → 요청 화면 «다시 판정» 모드: 제목 「🔄 다시 판정 — 범박고 고1 · 2026년 2학기 중간고사 (공통수학2)」 · 안내 띠 · 「지난 판정에 쓴 자료로 열었습니다」',
    o2.open && o2.rej && /🔄 다시 판정 — 범박고 고1 · 2026년 2학기 중간고사 \(공통수학2\)/.test(o2.title) && o2.info && o2.fromSrc, o2.title.slice(0, 160));
  t('시작 단추 「🔄 이 자료로 다시 판정」 · 「← 결과로 돌아가기」', o2.start === '🔄 이 자료로 다시 판정' && o2.back === '← 결과로 돌아가기', JSON.stringify([o2.start, o2.back]));
  t('기간 = 지난 판정 7/1~10/7 · 과목 공통수학2 · 기출 DB 번호 그대로', o2.period === '2026-07-01~2026-10-07' && o2.subj === '공통수학2' && o2.mydb === 719865, JSON.stringify([o2.period, o2.subj, o2.mydb]));
  t('지난 src 그대로 체크: 교과서 A만 · 고1 학습지 900101만(900102 기간 안이어도 꺼짐) · 프린트 없음 · 매쓰플랫 켬', JSON.stringify(o2.tb) === '[true,false]' && o2.mode === 'all' && JSON.stringify(o2.ms) === '[true,false,false]' && JSON.stringify(o2.lib) === '[false,false]' && o2.mf, JSON.stringify(o2));
  t('공수2 폴더 칩이 앞쪽(16개 안)에 「✓1」 · 「다른 폴더에서 체크한 것」 줄에 공수2 단추', o2.chipIdx >= 1 && o2.chipIdx < 16 && o2.chipN === '✓1' && o2.otherBtn && o2.nChips >= 16, JSON.stringify([o2.chipIdx, o2.chipN, o2.nChips, o2.otherBtn]));
  const o2b = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); box.querySelector('[data-htsgo="공수2"]').click(); await new Promise((r) => setTimeout(r, 30));
    const r = box.querySelector('[data-hts="ms:900201"]'); return { vis: !!r, on: !!(r && r.querySelector('.hts-cb.on')), folder: HTS.folder };
  });
  t('공수2 단추 → 그 폴더 목록에 기간 밖 학습지 900201 이 체크된 채', o2b.vis && o2b.on && o2b.folder === '공수2', JSON.stringify(o2b));
  const r2 = await pg.evaluate(() => { const a = document.getElementById('hts-req').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19103_rej.png', fullPage: true, clip: { x: Math.max(0, r2.x - 6), y: Math.max(0, r2.y - 6), width: r2.w + 12, height: r2.h + 12 } });

  /* 3) 「← 결과로 돌아가기」 = 요청 없이 닫기 */
  const o3 = await pg.evaluate(async () => {
    document.getElementById('hts-back').click(); await new Promise((r) => setTimeout(r, 60)); render();
    return { open: HTS.open, rej: HTS.rejudge, req: T.store.exam_hit_req || null, result: !!document.getElementById('hts-rej-btn') };
  });
  t('「← 결과로 돌아가기」 → 화면 닫힘 · exam_hit_req 안 씀 · 결과 화면', !o3.open && !o3.rej && !o3.req && o3.result, JSON.stringify(o3));

  /* 4) 예전 htRejudge() — 바로 요청하지 않고 같은 화면 */
  const o4 = await pg.evaluate(async () => {
    const c0 = T.confirms; htRejudge(); await new Promise((r) => setTimeout(r, 200)); render();
    return { open: HTS.open, rej: !!HTS.rejudge, req: T.store.exam_hit_req || null, confirms: T.confirms - c0, start: (document.getElementById('hts-start') || {}).textContent };
  });
  t('htRejudge() → 요청 없이 같은 «다시 판정» 화면 (confirm 없음)', o4.open && o4.rej && !o4.req && o4.confirms === 0 && o4.start === '🔄 이 자료로 다시 판정', JSON.stringify(o4));

  /* 5) 「🔄 이 자료로 다시 판정」 → exam_hit_req { rejudge, src } · 결과 화면 + 진행 띠 */
  const o5 = await pg.evaluate(async () => {
    document.getElementById('hts-start').click(); await new Promise((r) => setTimeout(r, 150)); render();
    const box = document.getElementById('tdemo');
    return { req: T.store.exam_hit_req || null, open: HTS.open, rej: HTS.rejudge, cur: HT.cur, strip: /<div class="ht-strip"[^>]*><b>⏳ /.test(box.innerHTML), result: !!document.getElementById('hts-rej-btn') };
  });
  const q5 = o5.req || {}, s5 = q5.src || {};
  t('「🔄 이 자료로 다시 판정」 → exam_hit_req: requested · rejudge · examId · 과목 · mydb · 기간 · src.tb.bids [A] · src.ms [900101, 900201] · src.lib [] · mf',
    q5.status === 'requested' && q5.rejudge === true && q5.examId === '범박고_고1_2026_2_중간' && q5.exam && q5.exam.subject === '공통수학2' && q5.mydb === 719865 && q5.from === '2026-07-01' && q5.to === '2026-10-07'
    && s5.tb && s5.tb.on === true && s5.tb.mode === 'all' && JSON.stringify(s5.tb.bids) === '["3119965"]' && JSON.stringify((s5.ms || []).slice().sort()) === '["900101","900201"]' && JSON.stringify(s5.lib) === '[]' && s5.mf === true, JSON.stringify(q5));
  t('요청 뒤 결과 화면으로 돌아가 위 띠에 진행 상황 (⏳)', !o5.open && !o5.rej && o5.cur === '범박고_고1_2026_2_중간' && o5.strip && o5.result, JSON.stringify(o5));

  /* 6) src 가 없는 옛 시험 → 기억한 구성(공수2 학습지 켬)으로 · 「바꾸기」 입구 · 💾 기억 · 다시 판정 */
  const o6 = await pg.evaluate(async () => {
    T.store.exam_hit_req.status = 'done'; HT.req = T.store.exam_hit_req; if (HT.poll) { clearInterval(HT.poll); HT.poll = null; }
    delete HT.data[HT.cur].src; render();
    const box = document.getElementById('tdemo'); const used = (box.querySelector('#hts-used') || {}).textContent || '';
    box.querySelector('#hts-used-edit').click(); await new Promise((r) => setTimeout(r, 250)); render();
    const row = (k) => box.querySelector('[data-hts="' + k + '"]'); const on = (k) => { const r = row(k); return !!(r && r.querySelector('.hts-cb.on')); };
    const chips = [...box.querySelectorAll('[data-htsf]')].map((c) => c.getAttribute('data-htsf'));
    const st = { rej: !!HTS.rejudge, cfg: !!HTS.cfg, fromSrc: HTS.fromSrc, mode: HTS.tbMode, tb: ['tb:3119965', 'tb:3119966'].map(on), ms: ['ms:900101', 'ms:900102'].map(on), lib: ['lib:L1', 'lib:L2'].map(on),
      cfgNote: /기억한 구성으로 열었습니다/.test(box.innerHTML), chipIdx: chips.indexOf('공수2'), title: (box.querySelector('#hts-req') || {}).textContent || '' };
    box.querySelector('[data-htsf="공수2"]').click(); await new Promise((r) => setTimeout(r, 30));
    st.p201 = on('ms:900201');
    const n0 = T.upserts.length; document.getElementById('hts-save').click(); await new Promise((r) => setTimeout(r, 80));
    st.saved = T.upserts.slice(n0).indexOf('exam_hit_src_범박고_고1') >= 0; st.savedCfg = T.store['exam_hit_src_범박고_고1'];
    st.stillOpen = HTS.open && !!HTS.rejudge;
    document.getElementById('hts-start').click(); await new Promise((r) => setTimeout(r, 150));
    st.req = T.store.exam_hit_req; st.used = used; return st;
  });
  const s6 = (o6.req && o6.req.src) || {};
  t('src 없는 옛 시험: 쓴 자료 줄 「자료를 고르기 전 방식」', /이번 판정에 쓴 자료: 교과서 7문항 · 학원 대비 학습지 32문항 · 루멘수학 학습지·교재 자동\(2문항\)/.test(o6.used) && /자료를 고르기 전 방식/.test(o6.used), o6.used);
  t('「바꾸기」 → 다시 판정 화면이 기억한 구성으로 (시험 범위 단원만 · 교과서 2권 · 고1 기간 안 2장 · L1만)', o6.rej && o6.cfg && !o6.fromSrc && o6.cfgNote && o6.mode === 'scope' && JSON.stringify(o6.tb) === '[true,true]' && JSON.stringify(o6.ms) === '[true,true]' && JSON.stringify(o6.lib) === '[true,false]' && /🔄 다시 판정 — /.test(o6.title), JSON.stringify(o6));
  t('기억한 구성의 공수2 학습지(기간 밖 · 다른 폴더) — 칩 앞쪽 · 체크된 채', o6.chipIdx >= 1 && o6.chipIdx < 16 && o6.p201, JSON.stringify([o6.chipIdx, o6.p201]));
  t('다시 판정 화면에서도 「💾 이 구성 기억」 그대로 (msOn 900201 · 화면은 열린 채)', o6.saved && o6.savedCfg && o6.savedCfg.msOn && o6.savedCfg.msOn['900201'] && o6.savedCfg.tbMode === 'scope' && o6.stillOpen, JSON.stringify(o6.savedCfg));
  t('→ exam_hit_req: rejudge · src.ms 에 900201 · src.tb.bids 두 권 · mode scope · lib [L1]', o6.req && o6.req.rejudge === true && o6.req.status === 'requested' && (s6.ms || []).indexOf('900201') >= 0 && (s6.ms || []).length === 3 && JSON.stringify(s6.tb && s6.tb.bids) === '["3119965","3119966"]' && s6.tb.mode === 'scope' && JSON.stringify(s6.lib) === '["L1"]', JSON.stringify(o6.req));

  /* 7) 새 분석 입구(기출 DB → 🎯)는 예전 그대로 */
  const o7 = await pg.evaluate(async () => {
    T.store.exam_hit_req.status = 'done'; HT.req = T.store.exam_hit_req; if (HT.poll) { clearInterval(HT.poll); HT.poll = null; }
    htdbAnalyze(719870); await new Promise((r) => setTimeout(r, 200)); render();
    const box = document.getElementById('tdemo');
    return { open: HTS.open, rej: HTS.rejudge, start: (document.getElementById('hts-start') || {}).textContent, title: /🎯 적중 분석 요청 — /.test(box.innerHTML), info: !!document.getElementById('hts-rej-info') };
  });
  t('새 분석(기출 DB → 🎯)은 그대로: 「🎯 적중 분석 요청」 · 「🎯 적중 분석 시작」 · 다시 판정 표시 없음', o7.open && !o7.rej && o7.start === '🎯 적중 분석 시작' && o7.title && !o7.info, JSON.stringify(o7));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
