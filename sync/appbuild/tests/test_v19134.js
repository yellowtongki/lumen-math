#!/usr/bin/env node
/* 학원앱 v19-134 검사 — 적중 분석 «서버 기다리는 중» 안내 · GitHub 단추 이름 (원장 2026-10-18)
 *   (아래 줄들은 v19-130 검사에서 가져온 가짜 서버 설명)
 *   ① card.picks 가 비면 적중 문항 상위 4개(같은 문제 → 숫자변형 → 유사유형 · 같으면 번호 순)로 문항 카드 · 서버에는 저장 안 함
 *   ② 자동 카드에도 「🧩 모자이크」 칩 · 고르는 칩은 자동 문항이 켜진 채로 보임 · 「자동 선택: 적중 문항 상위 4개」 줄
 *   ③ 칩을 처음 누르면 자동 목록을 옮겨 적은 뒤 넣기/빼기 → 저장 · 자동이 4개일 때 다른 칩 → 안내만 · 「↺ 자동으로 되돌리기」
 *   ④ 🎯 칸이 맨 위(🎨 색 · 🔥 킬러 칸보다 위) · 🤖 AI 안내 줄(v19-128)이 바로 앞에 붙어 같이 옮겨짐 · AI 표시 칩 그대로 · 모자이크 안내 줄
 *   ⑤ 내려받기(.zip) · 블로그 폴더(cards/ · cards.json · source.md) · 블로그자료.md 가 화면과 같은 문항을 씀 · 🧩 모자이크 창 열림
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19130.js lumen_v19-130.html
 *   그림: $SP/v19130_panel.png (설정 칸 맨 위)   가짜 서버 · 외부망 차단. 학생 실명 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-134.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-134'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EXAM_ID = '가나고_고1_2026_2_중간';
const OK = (k, kind) => ({ k, kind, ok: true, by: 'teacher', at: '2026-10-16T12:00:00Z' });
/* 적중(같은 문제 + 숫자변형 기준): 2 var(원장) · 3 same(AI) · 4 var(AI) · 5 same(원장) · 9 same(원장) → 자동 = 3,5,9,2 (4번은 다섯째라 빠짐) */
const STORE = { exam_hit_index: { items: [{ examId: EXAM_ID, school: '가나고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 9, at: '2026-10-16T12:00:00Z' }] } };
STORE['exam_hit_' + EXAM_ID] = { examId: EXAM_ID, exam: { school: '가나고', grade: '고1', year: 2026, semester: '2', term: '중간', date: '2026-10-10' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-10-10', students: ['AAA111'],
  items: [
    { no: 1, chapter: '다항식', type: '다항식 연산', level: 2, cands: [{ k: 'ws:1', kind: 'type', also: [] }], hit: null },
    { no: 2, chapter: '다항식', type: '나머지정리', level: 3, cands: [{ k: 'ws:2', kind: 'var', also: [] }], hit: OK('ws:2', 'var') },
    { no: 3, chapter: '방정식', type: '복소수', level: 3, cands: [{ k: 'ws:3', kind: 'same', also: [] }], hit: null },
    { no: 4, chapter: '방정식', type: '이차방정식', level: 4, cands: [{ k: 'ws:4', kind: 'var', also: [] }], hit: null },
    { no: 5, chapter: '방정식', type: '판별식', level: 4, cands: [{ k: 'ws:5', kind: 'same', also: [] }], hit: OK('ws:5', 'same') },
    { no: 6, chapter: '부등식', type: '연립부등식', level: 2, cands: [{ k: 'ws:6', kind: 'type', also: [] }], hit: null },
    { no: 7, chapter: '부등식', type: '절댓값 부등식', level: 5, cands: [], hit: null },
    { no: 8, chapter: '부등식', type: '이차부등식', level: 3, cands: [{ k: 'ws:8', kind: 'var', also: [] }], hit: { k: null, kind: 'none', ok: false, by: 'teacher' } },
    { no: 9, chapter: '경우의 수', type: '순열', level: 5, cands: [{ k: 'ws:9', kind: 'same', also: [] }], hit: OK('ws:9', 'same') } ],
  mats: {}, stats: { total: 9 },
  card: { pal: 1, wm: true, picks: [], killers: [7, 9] } };
['ws:1', 'ws:2', 'ws:3', 'ws:4', 'ws:5', 'ws:6', 'ws:8', 'ws:9'].forEach((k, i) => { STORE['exam_hit_' + EXAM_ID].mats[k] = { kind: 'ws', title: '수업 학습지 ' + (i + 1), where: '수업 학습지 ' + (i + 1) + ' 3번', cid: 30 + i, img: '', res: {} }; });

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, EXAM_ID }) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const mk = () => { const c = document.createElement('canvas'); c.width = 240; c.height = 180; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 180); g.fillStyle = '#111'; g.font = 'bold 36px sans-serif'; g.fillText('x² + 1', 30, 100); return c.toDataURL('image/png'); };
    const store = clone(STORE); store['exam_hit_' + EXAM_ID].items.forEach((it) => { it.imgUrl = mk(); });
    window.T = { store, upserts: [], toasts: [], h2c: [], zips: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({ eq: (k, v) => Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push({ key: r.key, picks: r.value && r.value.card ? clone(r.value.card.picks) : undefined }); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://example.invalid/' + p } }), remove: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.confirm = () => true;
    const of = window.fetch.bind(window);
    window.fetch = (url, opt) => /^data:/.test(String(url)) ? of(url, opt) : Promise.reject(new Error('외부망 차단'));
    store.cn_bg_index = { updated: '2026-10-10T00:00:00Z', items: [] };
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1440px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    try { localStorage.removeItem('cn_style'); localStorage.removeItem('cn_size'); } catch (e) {}
    VIEW = 'examhit'; HT.kicked = true; HT.idx = clone(store.exam_hit_index); HT.req = { status: 'done' }; HT.cur = EXAM_ID;
    htLoad(HT.cur, true); CN.open = true;
  }, { STORE, EXAM_ID });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  await settle(200); await pg.evaluate(() => render()); await settle(250); await pg.evaluate(() => render()); await settle(100);


  const wait = (ms) => settle(ms);
  const r = await pg.evaluate(() => { try { localStorage.removeItem('or_gh_token'); } catch (e) {}
    HT.req = { status: 'requested', examId: HT.cur, exam: HT.data[HT.cur].exam, reqAt: new Date().toISOString() }; const h = rExamHit();
    const l3 = (typeof l3hServerBox === 'function') ? l3hServerBox() : '';
    return { old5: /5분 안/.test(h), wait: /자동 순번은 몇 시간 간격/.test(h), link: /GitHub에서 바로 실행 \(적중 분석 포함\)/.test(h), how: /매쓰플랫 요청 처리 \(지금 가져오기 · 🎯 적중 분석\)/.test(h),
      l3wait: !l3 || /자동 순번은 몇 시간 간격/.test(l3), l3link: !l3 || /적중 분석 포함/.test(l3) }; });
  t('«5분 안» 문구 없음 · «자동 순번은 몇 시간 간격» 안내', !r.old5 && r.wait, JSON.stringify(r));
  t('GitHub 단추 «적중 분석 포함» · 열리는 작업 이름 안내', r.link && r.how, JSON.stringify(r));
  t('PC 오른쪽 서버 상태 칸도 같은 안내', r.l3wait && r.l3link, JSON.stringify(r));
  const y = require('fs').readFileSync(path.join(path.dirname(FILE), '.github/workflows/mathflat-ondemand.yml'), 'utf8').split('\n')[0];
  t('워크플로 이름 = 매쓰플랫 요청 처리 (지금 가져오기 · 🎯 적중 분석)', y === 'name: 매쓰플랫 요청 처리 (지금 가져오기 · 🎯 적중 분석)', y);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail) + ' 통과');
  await br.close(); process.exit(fail ? 1 : 0);
})();
