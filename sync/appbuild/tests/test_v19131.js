#!/usr/bin/env node
/* 학원앱 v19-131 검사 — 자동 선택은 원장 확정 먼저 · «지금 스타일»(옛 카드)에도 🧩 모자이크 (원장 2026-10-17)
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
const FILE = path.resolve(process.argv[2] || 'lumen_v19-131.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-131'])[0];
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
  /* ① 자동 선택: 확정(5 same · 9 same · 2 var) 먼저 → AI(3 same) — 4번(AI var)은 다섯째 */
  const a1 = await pg.evaluate(() => cnp130Picks(HT.data[HT.cur]));
  t('자동 선택 = 확정 5·9(같은 문제)·2(숫자변형) → AI 3(같은 문제)', JSON.stringify(a1) === '[5,9,2,3]', JSON.stringify(a1));
  const a2 = await pg.evaluate(() => { const d = HT.data[HT.cur], h = d.items[8].hit; d.items[8].hit = null; const r = cnp130Picks(d); d.items[8].hit = h; return r; });
  t('9번 확정을 풀면 AI 쪽으로 내려감 → 5·2 다음 3·9', JSON.stringify(a2) === '[5,2,3,9]', JSON.stringify(a2));

  /* ② 지금 스타일(v1) */
  await pg.evaluate(() => { cn2Set('style', 'v1'); }); await wait(300);
  const v1 = await pg.evaluate(() => { const labs = [...document.querySelectorAll('.cn131-lab')];
    return { style: CN.style, labs: labs.map((x) => x.innerText.replace(/\s+/g, ' ')), red: !!document.getElementById('cnp130-v1'), hint: (document.getElementById('cnp130-hint') || {}).textContent || '',
      mz: document.querySelectorAll('[data-cn3mz]').length, blurImgs: [...document.querySelectorAll('.cn .img2 img.blur')].length }; });
  t('지금 스타일: 문항 카드 4장 이름 옆에 「선명 · 흐리게 · 🧩 모자이크」', v1.style === 'v1' && v1.labs.length === 4 && v1.labs.every((s) => /선명.*흐리게.*🧩 모자이크/.test(s)) && v1.mz === 4, JSON.stringify(v1));
  t('빨간 «모자이크 안 보임» 안내 없음 · 보통 안내(두 스타일 모두)', !v1.red && /지금 스타일·새 스타일 모두/.test(v1.hint), JSON.stringify(v1));
  t('모자이크 없는 옛 카드 시험 그림은 예전처럼 흐리게', v1.blurImgs === 4, String(v1.blurImgs));

  const f1 = await pg.evaluate(() => document.querySelector('[data-cn3mz]').getAttribute('data-cn3mz'));
  await pg.evaluate((f) => { cn3MzOpen(f); }, f1); await wait(500);
  const dlg = await pg.evaluate(() => ({ open: !!document.querySelector('.cn3-mzin'), which: CN3.mz && CN3.mz.which }));
  t('지금 스타일에서 🧩 모자이크 창 열림', dlg.open && dlg.which === 'exam', JSON.stringify(dlg));
  await pg.evaluate(() => { cn3MzAdd(0.1, 0.2, 0.5, 0.3); return cn3MzSave(); }); await wait(600);
  await pg.evaluate(() => { cn3MzClose(); render(); }); await wait(500); await pg.evaluate(() => render()); await wait(200);
  const v1b = await pg.evaluate((f) => { const d = HT.data[HT.cur], c = d.card; const lab = [...document.querySelectorAll('.cn131-lab')].find((x) => x.querySelector('[data-cn3mz="' + f + '"]'));
    const card = lab && lab.parentElement.querySelector('.cn'); const im = card && card.querySelector('.img2 img[data-which="exam"]');
    return { saved: JSON.stringify((T.store['exam_hit_' + HT.cur].card.mosaic || {})[f] || null), chip: lab ? lab.innerText.replace(/\s+/g, ' ') : '', mzk: im && im.getAttribute('data-mzk'), data: im ? /^data:image\/png/.test(im.getAttribute('src')) : false,
      blur: im ? im.classList.contains('blur') : null, bl: card ? !!card.querySelector('.img2 .bl') : null }; }, f1);
  t('상자 저장 → 서버 card.mosaic 에 들어감 · 칩 「🧩 모자이크 1」', /"exam":\[\{"x":0.1/.test(v1b.saved) && /🧩 모자이크 1/.test(v1b.chip), JSON.stringify(v1b));
  t('옛 카드 시험 그림 = 모자이크 그림(data:png) · 흐림 없이 선명', !!v1b.mzk && v1b.data && v1b.blur === false && v1b.bl === false, JSON.stringify(v1b));

  await pg.evaluate((f) => cn3Blur(f, 1), f1); await wait(200);
  const bl1 = await pg.evaluate((f) => { const lab = [...document.querySelectorAll('.cn131-lab')].find((x) => x.querySelector('[data-cn3mz="' + f + '"]')); const im = lab.parentElement.querySelector('.img2 img[data-which="exam"]'); return { blur: im.classList.contains('blur'), v: HT.data[HT.cur].card.blur[f] }; }, f1);
  await pg.evaluate((f) => cn3Blur(f, 0), f1); await wait(200);
  const bl0 = await pg.evaluate((f) => { const lab = [...document.querySelectorAll('.cn131-lab')].find((x) => x.querySelector('[data-cn3mz="' + f + '"]')); const im = lab.parentElement.querySelector('.img2 img[data-which="exam"]'); return { blur: im.classList.contains('blur'), v: HT.data[HT.cur].card.blur[f], stored: (T.store['exam_hit_' + HT.cur].card.blur || {})[f] }; }, f1);
  t('흐리게 → 흐림 · 선명 → false 로 저장되어 선명 유지', bl1.blur === true && bl1.v === true && bl0.blur === false && bl0.v === false && bl0.stored === false, JSON.stringify([bl1, bl0]));

  /* ③ 새 스타일로 바꿔도 같은 문항 모자이크가 이어짐 */
  const n1 = Number(/_(\d+)번적중$/.exec(f1)[1]);
  await pg.evaluate(() => { cn2Set('style', 'v2'); }); await wait(500); await pg.evaluate(() => render()); await wait(300);
  const v2 = await pg.evaluate((n) => { const b = [...document.querySelectorAll('[data-cn3mz]')].find((x) => new RegExp('_' + n + '번적중$').test(x.getAttribute('data-cn3mz')));
    const f = b && b.getAttribute('data-cn3mz'); const wrap = b && b.closest('div[style*="min-width"]'); const im = wrap && wrap.querySelector('figure.exam img');
    return { f, chip: b ? b.textContent : '', mzk: im && im.getAttribute('data-mzk') }; }, n1);
  t('새 스타일 같은 문항(' + n1 + '번) 카드에도 모자이크 이어짐', /🧩 모자이크 1/.test(v2.chip) && !!v2.mzk, JSON.stringify(v2));
  if (v2.f && v2.f !== f1) {
    await pg.evaluate((f) => { cn3MzOpen(f); }, v2.f); await wait(500);
    await pg.evaluate(() => { cn3MzAdd(0.6, 0.6, 0.2, 0.2); return cn3MzSave(); }); await wait(600); await pg.evaluate(() => cn3MzClose());
    const keys = await pg.evaluate((n) => Object.keys(T.store['exam_hit_' + HT.cur].card.mosaic || {}).filter((k) => new RegExp('_' + n + '번적중$').test(k)), n1);
    t('새 스타일에서 다시 저장 → 같은 번호 칸은 하나만 (옛 이름 지움)', keys.length === 1 && keys[0] === v2.f, JSON.stringify(keys));
  } else t('두 스타일 파일 이름이 같음 — 하나만 저장', true);

  /* ③-2 다른 이름(예: 옛 07_N번적중)으로 저장돼 있어도 번호로 이어 씀 · 저장하면 하나로 */
  const al = await pg.evaluate(async (n) => { const d = HT.data[HT.cur], c = d.card; cn2Set('style', 'v1');
    const cur = Object.keys(c.mosaic).find((k) => new RegExp('_' + n + '번적중$').test(k)); const fake = '99_' + n + '번적중';
    c.mosaic[fake] = c.mosaic[cur]; delete c.mosaic[cur]; if (c.blur) { delete c.blur[cur]; } render(); await new Promise((r) => setTimeout(r, 300));
    const b = document.querySelector('[data-cn3mz="' + cur + '"]'); const chip = b ? b.textContent : '';
    cn3MzOpen(cur); await new Promise((r) => setTimeout(r, 400)); const had = CN3.mz.rects.exam.length; await cn3MzSave(); cn3MzClose();
    return { chip, had, keys: Object.keys(T.store['exam_hit_' + HT.cur].card.mosaic).filter((k) => new RegExp('_' + n + '번적중$').test(k)) }; }, n1);
  t('다른 파일 이름으로 저장된 모자이크도 같은 번호 카드에 보임 · 다시 저장하면 이름 하나', /🧩 모자이크 [1-9]/.test(al.chip) && al.had >= 1 && al.keys.length === 1 && !/^99_/.test(al.keys[0]), JSON.stringify(al));

  /* ④ 내려받기 준비(옛 카드) */
  const prep = await pg.evaluate(async () => { cn2Set('style', 'v1'); await cn3MzPrep(HT.data[HT.cur]); const ks = Object.keys(CN3.mzCache); return ks.length && ks.every((k) => CN3.mzCache[k] !== 'busy'); });
  t('옛 카드 내려받기 전 모자이크 그림 준비 끝', prep === true, String(prep));
  try { await pg.evaluate(() => { cn2Set('style', 'v1'); render(); }); await pg.locator('#cn-panel').screenshot({ path: path.join(SP, 'v19131_v1.png') }); } catch (e) {}

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail) + ' 통과');
  await br.close(); process.exit(fail ? 1 : 0);
})();
