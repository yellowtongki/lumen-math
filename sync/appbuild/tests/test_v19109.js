#!/usr/bin/env node
/* 학원앱 v19-109 검사 — 🔁 적중 분석 «지난 기출과 비교» (원장 2026-10-11 「범박고 분석 시 범박고 기출에서 나온 것도 확인할 수 있나?」)
 *   ① 요약 칸 「🔁 범박고 기출에서 n문항」(같은 문제 + 숫자변형) + 작은 글씨 유사유형 · 옛 결과(stats.past 없음)는 예전 「반복 출제 (지난 기출)」
 *   ② 「우리 자료별 적중」 아래 「🔁 범박고 지난 기출과 비교」 목록 — 누르면 그 문항 카드(접힌 것도 펼침)로
 *   ③ 문항 카드 「🔁 지난 기출」 줄 — 후보 그림 · 등급 단추 확정(it.pastHit) · ✗ 아님 · ✗ 겹침 없음 · ↺ 풀기 → 서버에 저장
 *   ④ 요청 화면 · 다시 판정 화면 칩 → exam_hit_req.src.past · 「💾 이 구성 기억」에도 past
 *   ⑤ 블로그 자료(.md) · 학부모 보고서 · 카드뉴스(새·옛 스타일) — 새 숫자, 「수학비서」 없음, 카드엔 「기출」 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19109.js lumen_v19-109.html
 *   그림: $SP/v19109_result.png (결과 요약 + 비교 칸) · $SP/v19109_item.png (문항 카드 지난 기출 줄)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수·시험 문항 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-109.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-109'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고1_2026_2_중간', OLD = '옥길중_중1_2025_2_중간';
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const PP = (mydb, year, sem, term, no, kind, why) => ({ k: 'past:' + mydb + ':' + no, mydb: String(mydb), exam: year + ' ' + sem + '학기 ' + term, year, sem: String(sem), term, no, kind, why: why || '', img: '', imgUrl: GIF, idSame: false });
const STORE = {
  mf_textbooks: { books: { '3119965': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_가상A' } }, bySchoolGrade: { '범박고|고1': { n: 1, books: { '3119965': 2 } } } },
  mf_textbook_3119965: { bid: 3119965, problems: [{ id: 1 }, { id: 2 }] },
  ms_papers_index: { updated: '2026-10-11T04:30:00Z', items: [{ id: 700001, title: '공통수학2 주간 점검', folder: '고1', grade: '고1', uploadedAt: '2026-09-10T10:00:00+09:00', n: 20, status: 'ready', exam: false }] },
  exam_lib: { updated: '2026-10-01T00:00:00Z', items: [] },
  school_calendar: { schools: [{ name: '범박고', exams: [{ label: '2학기 중간고사', from: '2026-09-29' }] }] },
  exam_hit_index: { items: [
    { examId: EID, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 4, at: '2026-10-11T12:00:00Z' },
    { examId: OLD, school: '옥길중', grade: '중1', year: 2025, semester: '2', term: '중간', total: 2, at: '2026-10-04T12:00:00Z' } ] },
};
STORE['exam_hit_' + EID] = { examId: EID, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', date: '2026-09-29', mydb: 715697, subject: '공통수학2' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-09-29', students: ['AAA111'],
  src: { tb: { on: true, mode: 'all', bids: ['3119965'] }, ms: ['700001'], lib: [], mf: true, past: { on: true, years: 3, sameTerm: true } },
  items: [
    { no: 1, cid: 501, chapter: '평면좌표', type: '두 점 사이의 거리', level: 2, img: '', imgUrl: GIF, cands: [{ k: 'tb:1', kind: 'var', also: [] }], hit: { k: 'tb:1', kind: 'var', ok: true, by: 'teacher' },
      repeat: [{ year: 2025, no: 3 }], past: [PP(387519, 2025, 2, '중간', 3, 'var', '숫자만 다름'), PP(304646, 2022, 2, '중간', 7, 'type', '같은 유형 번호')], pastTop: { k: 'past:387519:3', kind: 'var' } },
    { no: 2, cid: 502, chapter: '직선의 방정식', type: '세 직선의 위치 관계', level: 3, img: '', imgUrl: GIF, cands: [{ k: 'ms:700001:3', kind: 'type', also: [] }], hit: null,
      repeat: [{ year: 2025, no: 12 }], past: [PP(387519, 2025, 2, '중간', 12, 'same', '같은 문제'), PP(545468, 2024, 2, '중간', 4, 'type'), PP(342050, 2024, 2, '중간', 9, 'text', '그림만 같음')], pastTop: { k: 'past:387519:12', kind: 'same' } },
    { no: 3, cid: 503, chapter: '원의 방정식', type: '원과 직선의 위치 관계', level: 3, img: '', imgUrl: GIF, cands: [], hit: null, repeat: [], past: [], pastTop: null },
    { no: 4, cid: 504, chapter: '집합', type: '유한집합의 원소의 개수', level: 2, img: '', imgUrl: GIF, cands: [], hit: null, repeat: [], past: [PP(304653, 2024, 2, '기말', 1, 'type')], pastTop: { k: 'past:304653:1', kind: 'type' } } ],
  mats: {
    'tb:1': { kind: 'textbook', title: '교과서 가상A', where: '10쪽 1번', cid: 501, img: GIF, res: {} },
    'ms:700001:3': { kind: 'ms', title: '공통수학2 주간 점검', where: '3번', cid: 502, img: GIF, res: {} } },
  stats: { total: 4, byKind: { textbook: { mats: 2, hit: 1 }, ms: { mats: 20, hit: 0 }, upload: { mats: 0, hit: 0 }, ws: { mats: 0, hit: 0 }, book: { mats: 0, hit: 0 } },
    past: { same: 1, var: 1, type: 1, text: 0, items: 2, exams: 9, years: 4, sameTerm: false,
      list: [{ mydb: '387519', exam: '2025 2학기 중간', year: 2025, sem: '2', term: '중간', n: 23 }, { mydb: '304646', exam: '2022 2학기 중간', year: 2022, sem: '2', term: '중간', n: 20 }] } } };
STORE['exam_hit_' + OLD] = { examId: OLD, exam: { school: '옥길중', grade: '중1', year: 2025, semester: '2', term: '중간' }, basis: 'same+var', students: [],
  items: [{ no: 1, cid: 1, chapter: '가', type: '가', level: 2, cands: [], hit: null, repeat: [{ year: 2024, no: 1 }] }, { no: 2, cid: 2, chapter: '나', type: '나', level: 2, cands: [], hit: null, repeat: [] }],
  mats: {}, stats: { total: 2 } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], reads: [], printed: '' };
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
    window.open = () => ({ document: { open() {}, write(x) { T.printed += x; }, close() {} } });
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    VIEW = 'examhit';
    HTDB.idx = { items: [{ id: 719870, t: '내신 2026년 경기 부천시 범박고 고1 공통 2학기 중간 공통수학2', f: '작업공간', sc: '범박고', g: '고1', y: '2026', sem: '2', term: '중간', n: 21, ok: false }] };
  }, STORE);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* 1) 결과 화면 — 요약 칸 · 비교 칸 */
  await pg.evaluate(() => { HT.kicked = true; HT.idx = JSON.parse(JSON.stringify(T.store.exam_hit_index)); HT.req = { status: 'done' }; HT.data = {}; HT.view = 'sheet'; HT.cur = '범박고_고1_2026_2_중간'; htLoad(HT.cur, true); });
  await settle(250); await pg.evaluate(() => render()); await settle(60);
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'), tile = box.querySelector('#pc-tile'), blk = box.querySelector('#pc-block'), bk = box.querySelector('#hts-bykind');
    const rows = [...box.querySelectorAll('.pc-li')].map((r) => ({ no: r.getAttribute('data-pcno'), t: r.textContent }));
    return { tile: tile ? tile.textContent : '', small: tile ? (tile.querySelector('[data-pctype]') || {}).textContent : '', old: /반복 출제 \(지난 기출\)/.test(box.innerHTML),
      blk: blk ? blk.textContent : '', after: !!(bk && blk && (bk.compareDocumentPosition(blk) & Node.DOCUMENT_POSITION_FOLLOWING)), rows, range: !!box.querySelector('#pc-range') };
  });
  t('요약 칸 「🔁 범박고 기출에서 2문항」 + 작은 글씨 「유사유형 1」 · 옛 「반복 출제 (지난 기출)」 칸 없음', /🔁 범박고 기출에서 2문항/.test(o1.tile) && o1.small === '유사유형 1' && !o1.old, JSON.stringify(o1));
  t('「우리 자료별 적중」 아래 「🔁 범박고 지난 기출과 비교」 — 지난 시험 9장 (2022~2025년 · 중간·기말) · 범위 바꾸기 링크', o1.after && /🔁 범박고 지난 기출과 비교/.test(o1.blk) && /지난 시험 9장/.test(o1.blk) && /2022~2025년 · 중간·기말/.test(o1.blk) && o1.range, o1.blk.slice(0, 200));
  t('목록 = 같은 문제 → 숫자변형 → 유사유형 순 (2번 2025·2학기·중간·12번 같은 문제 · 1번 숫자변형 · 4번 유사유형) · 겹침 없는 3번은 빠짐',
    JSON.stringify(o1.rows.map((r) => r.no)) === '["2","1","4"]' && /2025 · 2학기 · 중간 · 12번/.test(o1.rows[0].t) && /같은 문제/.test(o1.rows[0].t) && /숫자변형/.test(o1.rows[1].t) && /2024 · 2학기 · 기말 · 1번/.test(o1.rows[2].t) && /겹친 지난 기출 없음 1문항/.test(o1.blk), JSON.stringify(o1.rows));
  const s1 = await pg.evaluate(() => { const a = document.getElementById('pc-block').closest('.ht-card').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19109_result.png', fullPage: true, clip: { x: Math.max(0, s1.x - 6), y: Math.max(0, s1.y - 6), width: s1.w + 12, height: Math.min(s1.h + 12, 1600) } });

  /* 2) 목록 줄 누르면 문항 카드로 — 확정해서 접혀 있던 1번도 펼친다 */
  const o2 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); const r = {};
    r.folded = !box.querySelector('#pc-it-1') && !!box.querySelector('[data-pcfold="1"]');
    r.foldTxt = (box.querySelector('[data-pcfold="1"]') || {}).textContent || '';
    box.querySelector('.pc-li[data-pcno="1"]').click(); await new Promise((x) => setTimeout(x, 80));
    const sec = box.querySelector('#pc-it-1'); r.sec = !!sec; r.cards = sec ? sec.querySelectorAll('.pc-card').length : 0; r.imgs = sec ? sec.querySelectorAll('.pc-card img').length : 0;
    r.head = sec ? sec.querySelector('.pc-card b').textContent : '';
    r.pill = (box.querySelector('[data-pcpill="1"]') || {}).textContent || ''; r.oldPill = /반복 2025 3번/.test(box.innerHTML);
    r.sec3 = (box.querySelector('#pc-it-3') || {}).textContent || '';
    return r;
  });
  t('접힌 1번 줄에 「🔁 2025 2학기 중간 3번 · 숫자변형」 · 목록 누르면 펼쳐지고 「🔁 지난 기출」 줄(그림 2개)',
    o2.folded && /2025 2학기 중간 3번 · 숫자변형/.test(o2.foldTxt) && o2.sec && o2.cards === 2 && o2.imgs === 2 && /2025 · 2학기 · 중간 · 3번/.test(o2.head), JSON.stringify(o2));
  t('카드 머리 옛 「반복 …」 알약 → 「🔁 … · 등급」 · 겹침 없는 3번은 「지난 기출이 없습니다」', /🔁 2025 2학기 중간 3번 · 숫자변형/.test(o2.pill) && !o2.oldPill && /지난 기출이 없습니다/.test(o2.sec3), JSON.stringify([o2.pill, o2.sec3]));

  /* 3) 확정 — 등급 단추 · ✗ 아님 · ✗ 겹침 없음 · ↺ 풀기 (서버에 저장) */
  const o3 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'), K = 'exam_hit_범박고_고1_2026_2_중간', r = {};
    const card = (no, k) => box.querySelector('#pc-it-' + no + ' .pc-card[data-pck="' + k + '"]');
    card(2, 'past:545468:4').querySelector('[data-pcseg="var"]').click(); await new Promise((x) => setTimeout(x, 40));
    r.hit = JSON.parse(JSON.stringify(T.store[K].items[1].pastHit || null)); r.saved = T.upserts.indexOf(K) >= 0;
    r.list2 = (box.querySelector('.pc-li[data-pcno="2"]') || {}).textContent || '';
    r.tile = box.querySelector('#pc-tile').textContent;
    card(1, 'past:387519:3').querySelector('[data-pcseg="no"]').click(); await new Promise((x) => setTimeout(x, 40));
    const p1 = T.store[K].items[0].past; r.rej = p1.filter((p) => p.k === 'past:387519:3')[0].rejected === true; r.firstAfterRej = p1[0].k;
    r.list1 = (box.querySelector('.pc-li[data-pcno="1"]') || {}).textContent || ''; r.tile2 = box.querySelector('#pc-tile').textContent;
    box.querySelector('[data-pcnone="4"]').click(); await new Promise((x) => setTimeout(x, 40));
    r.none = JSON.parse(JSON.stringify(T.store[K].items[3].pastHit || null)); r.has4 = !!box.querySelector('.pc-li[data-pcno="4"]');
    box.querySelector('[data-pcundo="1"]').click(); await new Promise((x) => setTimeout(x, 40));
    r.undo = T.store[K].items[0].past.every((p) => !p.rejected) && !T.store[K].items[0].pastHit;
    r.tile3 = box.querySelector('#pc-tile').textContent;
    r.matHit = JSON.parse(JSON.stringify(T.store[K].items[0].hit));   /* 우리 자료 확정은 그대로 */
    return r;
  });
  t('등급 단추(2번 · 2024 4번 → 숫자변형) → it.pastHit {k, kind:var, ok:true} 서버 저장 · 목록 2번이 확정 숫자변형 ✓',
    o3.saved && o3.hit && o3.hit.k === 'past:545468:4' && o3.hit.kind === 'var' && o3.hit.ok === true && /2024 · 2학기 · 중간 · 4번/.test(o3.list2) && /숫자변형 ✓/.test(o3.list2) && /2문항/.test(o3.tile), JSON.stringify(o3));
  t('✗ 아님(1번 2025 3번) → rejected · 다음 후보(2022 7번 유사유형)가 앞으로 → 기출에서 1문항', o3.rej && o3.firstAfterRej === 'past:304646:7' && /2022 · 2학기 · 중간 · 7번/.test(o3.list1) && /기출에서 1문항/.test(o3.tile2), JSON.stringify(o3));
  t('✗ 겹침 없음(4번) → pastHit {k:null, ok:false} · 목록에서 빠짐 · ↺ 풀기 → 원래대로 · 우리 자료 확정은 그대로',
    o3.none && o3.none.k === null && o3.none.ok === false && !o3.has4 && o3.undo && /기출에서 2문항/.test(o3.tile3) && o3.matHit && o3.matHit.ok === true && o3.matHit.k === 'tb:1', JSON.stringify(o3));
  const s2 = await pg.evaluate(() => { const a = document.getElementById('pc-it-2').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19109_item.png', fullPage: true, clip: { x: Math.max(0, s2.x - 6), y: Math.max(0, s2.y - 6), width: s2.w + 12, height: Math.min(s2.h + 12, 900) } });

  /* 4) 표 보기 — 펼친 줄에도 지난 기출 */
  const o4 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); htView('table'); await new Promise((x) => setTimeout(x, 30));
    pcGo(2); await new Promise((x) => setTimeout(x, 60)); const r = { sec: !!box.querySelector('#pc-it-2'), cards: box.querySelectorAll('#pc-it-2 .pc-card').length };
    htView('sheet'); return r;
  });
  t('표 보기에서 목록 누르면 그 줄이 펼쳐지고 지난 기출 3개', o4.sec && o4.cards === 3, JSON.stringify(o4));

  /* 5) 블로그 자료(.md) · 학부모 보고서 · 카드뉴스 */
  const o5 = await pg.evaluate((SEED) => {
    const d = HT.data[HT.cur], r = {};
    d.items.forEach((it, i) => { it.past = JSON.parse(JSON.stringify(SEED.items[i].past)); delete it.pastHit; });   /* 3) 에서 바꾼 확정을 처음대로 */
    const md = htMd(d);
    r.mdLine = (md.split('\n').filter((l) => /기출에서 다시 나온 문항:/.test(l))[0]) || '';
    r.mdSec = /## 범박고 기출과 비교 \(지난 시험 9장 · 2022~2025년 · 중간·기말\)/.test(md) && /- 2번 세 직선의 위치 관계 — 범박고 2025년 2학기 중간고사 12번과 같은 문제/.test(md) && /숫자만 바뀌어\(또는 그대로\) 다시 나온 문항 2개/.test(md);
    r.mdOld = /## 반복 출제 유형/.test(md); r.mdMs = /수학비서/.test(md); r.mdGuide = /기출에서 다시 나온 문항」은 우리 자료 적중과 다른 숫자다/.test(md);
    T.printed = ''; htPrint(''); const p = T.printed;
    r.rep = /<h2>범박고 기출과 비교<\/h2>/.test(p) && /숫자만 바뀌어\(또는 그대로\) 다시 나온 문항 2개/.test(p) && /<th>범박고 기출<\/th>/.test(p) && /2025 2학기 중간 12번 · 같은 문제/.test(p);
    r.repOrder = p.indexOf('<h2>범박고 기출과 비교</h2>') < p.indexOf('<h2>문항 요약</h2>'); r.repMs = /수학비서/.test(p);
    const c2 = cn2Cards(d).filter((x) => /_반복출제$/.test(x.file))[0] || {}, c1 = cnCards(d).filter((x) => /_반복출제$/.test(x.file))[0] || {};
    r.c2 = /지난 시험에서/.test(c2.html) && /2문항/.test(c2.html) && !/기출/.test(c2.html) && /같은 학교 지난 시험 문제와 하나씩 비교/.test(c2.html);
    r.c2para = c2.para || ''; r.c1 = /지난 시험에서<br><em>다시 나온 문항<\/em>/.test(c1.html || '') && !/기출/.test(c1.html || ''); r.c1facts = (c1.facts || []).join(' | ');
    r.c2y = /20\d\d/.test((c2.html || '').replace(/<[^>]+>/g, ''));
    return r;
  }, STORE['exam_hit_' + EID]);
  t('블로그 자료 .md: 「범박고 기출에서 다시 나온 문항: 2문항 (똑같은 문제 1 · 숫자만 바뀐 문제 1)」 · 「## 범박고 기출과 비교」 문항별 · 안내 줄 · 「수학비서」 없음',
    /범박고 기출에서 다시 나온 문항: 2문항 \(똑같은 문제 1 · 숫자만 바뀐 문제 1\)/.test(o5.mdLine) && o5.mdSec && !o5.mdOld && !o5.mdMs && o5.mdGuide, JSON.stringify(o5));
  t('학부모 보고서: 「범박고 기출과 비교」 칸(문항 요약 앞) · 표 칸 「범박고 기출」 · 「수학비서」 없음', o5.rep && o5.repOrder && !o5.repMs, JSON.stringify([o5.rep, o5.repOrder, o5.repMs]));
  t('카드뉴스 새 스타일: 「지난 시험에서 다시 나온 문항 2문항」 · 「기출」·연도 없음 · 문단 초안도 새 숫자', o5.c2 && !o5.c2y && /4문항 중 2문항이 지난 시험 문제와 같거나 숫자만 바뀌어/.test(o5.c2para) && !/기출/.test(o5.c2para), JSON.stringify([o5.c2, o5.c2y, o5.c2para]));
  t('카드뉴스 옛 스타일 카드도 같은 내용 · 사실 줄 「2번 … — 똑같이 다시 나옴」', o5.c1 && /2번 세 직선의 위치 관계 — 똑같이 다시 나옴/.test(o5.c1facts), o5.c1facts);

  /* 6) 옛 결과(stats.past 없음) — 예전 칸 그대로 */
  const o6 = await pg.evaluate(async () => {
    htPick('옥길중_중1_2025_2_중간'); await new Promise((x) => setTimeout(x, 150)); render();
    const box = document.getElementById('tdemo'); const d = HT.data[HT.cur];
    return { old: /<b>1<\/b><span>반복 출제 \(지난 기출\)<\/span>/.test(box.innerHTML), tile: !!box.querySelector('#pc-tile'), blk: !!box.querySelector('#pc-block'), sec: !!box.querySelector('.pc-sec'), md: /## 반복 출제 유형/.test(htMd(d)) };
  });
  t('옛 결과(지난 기출 비교 전): 예전 「반복 출제 (지난 기출)」 칸 · 새 칸·줄 없음 · .md 도 예전대로', o6.old && !o6.tile && !o6.blk && !o6.sec && o6.md, JSON.stringify(o6));

  /* 7) 다시 판정 화면 — 지난 판정 src.past 로 열림 · 칩 → 요청 src.past */
  const o7 = await pg.evaluate(async () => {
    HT.cur = '범박고_고1_2026_2_중간'; render(); htsRejOpen(); await new Promise((x) => setTimeout(x, 300)); render();
    const box = document.getElementById('tdemo'), q = (s) => box.querySelector(s), r = {};
    const yOn = () => [...box.querySelectorAll('[data-pcy]')].filter((b) => b.classList.contains('on')).map((b) => b.getAttribute('data-pcy'));
    r.row = !!q('#pc-req'); r.txt = (q('#pc-req') || {}).textContent || ''; r.y0 = yOn(); r.same0 = q('#pc-same').classList.contains('on'); r.on0 = q('#pc-on').classList.contains('on');
    r.beforePanels = !!(q('#pc-req') && q('.hts-panels') && (q('#pc-req').compareDocumentPosition(q('.hts-panels')) & Node.DOCUMENT_POSITION_FOLLOWING));
    q('[data-pcy="5"]').click(); await new Promise((x) => setTimeout(x, 20)); q('#pc-same').click(); await new Promise((x) => setTimeout(x, 20));
    r.y1 = yOn(); r.same1 = q('#pc-same').classList.contains('on');
    q('#hts-start').click(); await new Promise((x) => setTimeout(x, 150));
    r.req = JSON.parse(JSON.stringify(T.store.exam_hit_req || null));
    return r;
  });
  t('다시 판정 화면에 「🔁 지난 기출 비교 켜기/끄기 · 최근 2/3/4/5년 · 같은 시험만(중간)」 — 지난 판정 src.past(3년 · 같은 시험만)로 열림 · 네 칸 위',
    o7.row && /지난 기출 비교/.test(o7.txt) && /같은 시험만\(중간\)/.test(o7.txt) && JSON.stringify(o7.y0) === '["3"]' && o7.same0 && o7.on0 && o7.beforePanels, JSON.stringify(o7));
  const sp7 = (o7.req && o7.req.src && o7.req.src.past) || {};
  t('5년 · 같은 시험만 끄기 → 다시 판정 요청 src.past {on:true, years:5, sameTerm:false} · rejudge', o7.req && o7.req.rejudge === true && sp7.on === true && sp7.years === 5 && sp7.sameTerm === false && JSON.stringify(o7.y1) === '["5"]' && !o7.same1, JSON.stringify(o7.req && o7.req.src));

  /* 8) 새 분석(기출 DB → 🎯) — 기본 켬 · 4년 · 끄기 → src.past.on false · 「💾 이 구성 기억」에 past */
  const o8 = await pg.evaluate(async () => {
    T.store.exam_hit_req.status = 'done'; HT.req = T.store.exam_hit_req; if (HT.poll) { clearInterval(HT.poll); HT.poll = null; }
    htsClose(); htdbAnalyze(719870); await new Promise((x) => setTimeout(x, 300)); render();
    const box = document.getElementById('tdemo'), q = (s) => box.querySelector(s), r = {};
    r.y = [...box.querySelectorAll('[data-pcy]')].filter((b) => b.classList.contains('on')).map((b) => b.getAttribute('data-pcy')); r.on = q('#pc-on').classList.contains('on'); r.same = q('#pc-same').classList.contains('on');
    r.src0 = JSON.parse(JSON.stringify(htsSrcValue().past));
    q('#pc-off').click(); await new Promise((x) => setTimeout(x, 20)); r.offTxt = q('#pc-req').textContent;
    q('#hts-save').click(); await new Promise((x) => setTimeout(x, 80)); r.cfg = JSON.parse(JSON.stringify((T.store['exam_hit_src_범박고_고1'] || {}).past || null));
    htsClose(); htdbAnalyze(719870); await new Promise((x) => setTimeout(x, 300)); render();
    r.reOff = q('#pc-off').classList.contains('on');
    q('#hts-start').click(); await new Promise((x) => setTimeout(x, 150));
    r.req = JSON.parse(JSON.stringify(T.store.exam_hit_req || null));
    return r;
  });
  t('새 분석 기본 = 켬 · 최근 4년 · 중간/기말 모두 (src.past {on:true, years:4, sameTerm:false})', o8.on && JSON.stringify(o8.y) === '["4"]' && !o8.same && JSON.stringify(o8.src0) === '{"on":true,"years":4,"sameTerm":false}', JSON.stringify(o8));
  t('끄기 → 「💾 이 구성 기억」 past.on false · 다시 열면 끈 채로 · 요청 src.past.on false', /비교하지 않습니다/.test(o8.offTxt) && o8.cfg && o8.cfg.on === false && o8.reOff && o8.req && o8.req.status === 'requested' && o8.req.src && o8.req.src.past && o8.req.src.past.on === false, JSON.stringify([o8.cfg, o8.req && o8.req.src && o8.req.src.past]));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
