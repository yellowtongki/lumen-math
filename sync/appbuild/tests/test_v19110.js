#!/usr/bin/env node
/* 학원앱 v19-110 검사 — 📚 적중 분석 «출판사 교과서 출처» (원장 2026-10-11 「숫자변형 문제가 어느 출판사에서 나왔는지」)
 *   (아래 v19-109 설명은 가짜 자료를 함께 쓰는 지난 검사 것)
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
const FILE = path.resolve(process.argv[2] || 'lumen_v19-110.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-110'])[0];
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
(function(){ const D = STORE['exam_hit_' + EID];
  const PB = (pub, id, page, no, kind, why) => ({ k: 'pub:' + id, bid: '1', pub, page, no, kind, why: why || '', imgUrl: GIF });
  D.items[0].pub = [PB('동아', 11, 45, '3', 'var', '숫자만 다름'), PB('비상교육', 12, 20, '1', 'text', '같은 그림')];
  D.items[1].pub = [PB('동아', 21, 50, '2', 'same', '같은 문제'), PB('미래엔', 22, 33, '4', 'var', '숫자만 다름')];
  D.items[2].pub = [];
  D.items[3].pub = [PB('지학사', 41, 12, '5', 'var')];
  D.stats.pub = { subject: '공통수학2', books: [{ bid: '1', pub: '동아', n: 600 }, { bid: '2', pub: '미래엔', n: 500 }, { bid: '3', pub: '비상교육', n: 535 }, { bid: '4', pub: '지학사', n: 520 }], by: {}, items: 3 };
})();
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
  await pg.evaluate(() => { HT.kicked = true; HT.idx = JSON.parse(JSON.stringify(T.store.exam_hit_index)); HT.req = { status: 'done' }; HT.data = {}; HT.view = 'sheet'; HT.cur = '범박고_고1_2026_2_중간'; htLoad(HT.cur, true); });
  await settle(250); await pg.evaluate(() => render()); await settle(60);
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'), blk = box.querySelector('#pb-block'), pc = box.querySelector('#pc-block');
    const rows = [...box.querySelectorAll('#pb-block tr[data-pbpub]')].map((r) => r.getAttribute('data-pbpub') + ':' + [...r.children].map((c) => c.textContent).join('|'));
    return { blk: blk ? blk.textContent : '', after: !!(pc && blk && (pc.compareDocumentPosition(blk) & Node.DOCUMENT_POSITION_FOLLOWING) && !pc.contains(blk)),
      before: !!(pc && blk && (blk.compareDocumentPosition(pc) & Node.DOCUMENT_POSITION_FOLLOWING) && !blk.contains(pc)), rows };
  });
  /* v19-112 부터: 칸 이름 「📚 교과서 일치 (같은 문제 + 숫자변형)」 · 도넛 바로 아래(지난 기출 칸보다 앞)로 옮김 (원장 2026-10-12) */
  const V112 = Number(WANT.replace('v19-', '')) >= 112;
  t(V112 ? '지난 기출 칸 앞(도넛 바로 아래)에 「📚 교과서 일치 (같은 문제 + 숫자변형)」 — 공통수학2 교과서 4종 · 가장 많은 교과서 동아 2문항' : '지난 기출 칸 뒤에 「📚 출판사 교과서 출처」 — 공통수학2 교과서 4종 · 가장 많은 교과서 동아 2문항',
    (V112 ? (o1.before && /📚 교과서 일치 \(같은 문제 \+ 숫자변형\)/.test(o1.blk)) : (o1.after && /📚 출판사 교과서 출처/.test(o1.blk))) && /공통수학2 교과서 4종/.test(o1.blk) && /가장 많은 교과서: 동아 2문항/.test(o1.blk), o1.blk.slice(0, 300));
  t('표: 동아(같은 1·숫자변형 1 · 1번 2번) → 미래엔·지학사(숫자변형 1) → 비상교육(지문 겹침 1)',
    o1.rows.length === 4 && /^동아:동아\|1\|1\|·\|1번2번/.test(o1.rows[0]) && /^비상교육:비상교육\|·\|·\|1\|—/.test(o1.rows[3]) && /^(미래엔|지학사)/.test(o1.rows[1]), JSON.stringify(o1.rows));
  const s1 = await pg.evaluate(() => { const a = document.getElementById('pb-block').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19110_result.png', fullPage: true, clip: { x: Math.max(0, s1.x - 6), y: Math.max(0, s1.y - 6), width: s1.w + 12, height: s1.h + 12 } });

  const o2 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'), r = {};
    r.fold = (box.querySelector('[data-pbfold="1"]') || {}).textContent || '';
    [...box.querySelectorAll('#pb-block a')].filter((a) => a.textContent === '1번')[0].click(); await new Promise((x) => setTimeout(x, 80));
    const sec = box.querySelector('#pb-it-1'); r.sec = !!sec; r.cards = sec ? [...sec.querySelectorAll('.pb-card > div:first-child > b')].map((b) => b.textContent) : [];
    r.imgs = sec ? sec.querySelectorAll('.pb-card img').length : 0;
    r.sec3 = (box.querySelector('#pb-it-3') || {}).textContent || '';
    return r;
  });
  t('접힌 1번 줄 「📚 동아」 · 표에서 1번 누르면 펼쳐지고 「📚 출판사 교과서」 줄(동아 45쪽 3번 → 비상교육 20쪽 1번, 그림 2)',
    /📚 동아/.test(o2.fold) && o2.sec && JSON.stringify(o2.cards) === '["동아 45쪽 3번","비상교육 20쪽 1번"]' && o2.imgs === 2, JSON.stringify(o2));
  t('후보 없는 3번 — 「찾지 못했습니다」', /찾지 못했습니다/.test(o2.sec3), o2.sec3);
  const s2 = await pg.evaluate(() => { const a = document.getElementById('pb-it-1').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19110_item.png', fullPage: true, clip: { x: Math.max(0, s2.x - 6), y: Math.max(0, s2.y - 6), width: s2.w + 12, height: Math.min(s2.h + 12, 900) } });

  const o3 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'), K = 'exam_hit_범박고_고1_2026_2_중간', r = {};
    box.querySelector('#pb-it-1 .pb-card[data-pbk="pub:11"] [data-pbno]').click(); await new Promise((x) => setTimeout(x, 60));
    r.rej = T.store[K].items[0].pub.filter((p) => p.k === 'pub:11')[0].rejected === true;
    r.top = (box.querySelector('#pb-block').textContent.match(/가장 많은 교과서: (\S+) (\d)문항/) || []).slice(1).join(' ');
    r.dong = ([...box.querySelectorAll('#pb-block tr[data-pbpub="동아"] td')].map((c) => c.textContent).join('|'));
    box.querySelector('#pb-it-1 .pb-card[data-pbk="pub:11"] [data-pbno]').click(); await new Promise((x) => setTimeout(x, 60));
    r.back = !T.store[K].items[0].pub.some((p) => p.rejected);
    T.upserts.length = 0; box.querySelector('#pb-redo').click(); await new Promise((x) => setTimeout(x, 60));
    r.req = JSON.parse(JSON.stringify(T.store.exam_hit_req || null));
    r.md = htMd(HT.data[HT.cur]);
    return r;
  });
  t('✗ 아님(1번 동아) → rejected 저장 · 동아 숫자변형 0 · 다시 누르면 되돌림', o3.rej && /^동아\|1\|·\|·\|2번/.test(o3.dong) && o3.back, JSON.stringify(o3).slice(0, 400));
  t('「📚 출판사 비교만 다시」 → exam_hit_req { only:pub, examId }', o3.req && o3.req.only === 'pub' && o3.req.examId === '범박고_고1_2026_2_중간' && o3.req.status === 'requested' && !o3.req.rejudge, JSON.stringify(o3.req));
  t('블로그 자료(.md) — 「## 출판사 교과서 출처」 동아 2문항(1번, 2번) · 「매쓰플랫」「수학비서」 없음',
    /## 출판사 교과서 출처 \(공통수학2 교과서 4종과 비교\)/.test(o3.md) && /동아 2문항\(1번, 2번\)/.test(o3.md) && !/매쓰플랫|수학비서/.test(o3.md), o3.md.slice(-400));

  /* 옛 결과(stats.pub 없음) — 칸 없음 */
  await pg.evaluate(() => { HT.cur = '옥길중_중1_2025_2_중간'; htLoad(HT.cur, true); }); await settle(250); await pg.evaluate(() => render()); await settle(60);
  const o4 = await pg.evaluate(() => ({ pb: !!document.querySelector('#pb-block'), sec: !!document.querySelector('.pb-sec') }));
  t('옛 결과는 출판사 칸 없음', !o4.pb && !o4.sec, JSON.stringify(o4));
  t('페이지 오류 없음', errs.length === 0, errs.join(' / '));
  await br.close();
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
