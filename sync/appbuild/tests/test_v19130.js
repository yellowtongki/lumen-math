#!/usr/bin/env node
/* 학원앱 v19-130 검사 — 🎯 문항별 적중 카드 «자동 선택» + 고르는 칸을 카드뉴스 설정 맨 위로 (원장 2026-10-17 「모자이크 기능이 사라졌다」)
 *   ① card.picks 가 비면 적중 문항 상위 4개(같은 문제 → 숫자변형 → 유사유형 · 같으면 번호 순)로 문항 카드 · 서버에는 저장 안 함
 *   ② 자동 카드에도 「🧩 모자이크」 칩 · 고르는 칩은 자동 문항이 켜진 채로 보임 · 「자동 선택: 적중 문항 상위 4개」 줄
 *   ③ 칩을 처음 누르면 자동 목록을 옮겨 적은 뒤 넣기/빼기 → 저장 · 자동이 4개일 때 다른 칩 → 안내만 · 「↺ 자동으로 되돌리기」
 *   ④ 🎯 칸이 맨 위(🎨 색 · 🔥 킬러 칸보다 위) · 🤖 AI 안내 줄(v19-128)이 바로 앞에 붙어 같이 옮겨짐 · AI 표시 칩 그대로 · 모자이크 안내 줄
 *   ⑤ 내려받기(.zip) · 블로그 폴더(cards/ · cards.json · source.md) · 블로그자료.md 가 화면과 같은 문항을 씀 · 🧩 모자이크 창 열림
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19130.js lumen_v19-130.html
 *   그림: $SP/v19130_panel.png (설정 칸 맨 위)   가짜 서버 · 외부망 차단. 학생 실명 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-130.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-130'])[0];
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
  const nums = (files) => files.filter((f) => /번적중$/.test(f)).map((f) => Number(/_(\d+)번적중$/.exec(f)[1]));
  const state = () => pg.evaluate((EXAM_ID) => { const d = HT.data[HT.cur], P = document.getElementById('cn-panel');
    const chips = [...P.querySelectorAll('button[onclick^="cnToggleNo(\'picks\'"]')];
    return { ver: APP_VER, mem: d.card.picks.slice(), eff: cnp130Picks(d), stored: ((T.store['exam_hit_' + EXAM_ID] || {}).card || {}).picks,
      v2: cn2Cards(d).map((x) => x.file), v1: cnCards(d).map((x) => x.file),
      shown: [...document.querySelectorAll('#cn-cards [data-cn2bg]')].map((x) => x.getAttribute('data-cn2bg')),
      mz: [...document.querySelectorAll('#cn-cards [data-cn3mz]')].map((x) => x.getAttribute('data-cn3mz')),
      on: chips.filter((b) => b.classList.contains('on')).map((b) => Number(/,(\d+),4\)/.exec(b.getAttribute('onclick'))[1])),
      chips: chips.length, ai: chips.filter((b) => b.querySelector('[data-hvai]')).length,
      auto: (document.getElementById('cnp130-auto') || {}).textContent || '', reset: !!document.getElementById('cnp130-reset'), hint: (document.getElementById('cnp130-hint') || {}).textContent || '',
      ups: T.upserts.filter((u) => u.key === 'exam_hit_' + EXAM_ID).map((u) => u.picks) }; }, EXAM_ID);

  /* ── ① 자동 선택 ── */
  const s1 = await state();
  t('버전 ' + WANT, s1.ver === WANT, s1.ver);
  t('picks 비어 있음 → 자동 = 3·5·9·2 (같은 문제 3·5·9 → 숫자변형 2 · 4번(숫자변형·다섯째)·유사유형·✗ 는 빠짐 · 최대 4)', JSON.stringify(s1.eff) === '[3,5,9,2]', JSON.stringify(s1.eff));
  t('새 스타일 카드: 문항 카드 4장 08_3번적중 · 09_5번적중 · 10_9번적중 · 11_2번적중', JSON.stringify(s1.v2.filter((f) => /번적중$/.test(f))) === '["08_3번적중","09_5번적중","10_9번적중","11_2번적중"]', JSON.stringify(s1.v2));
  t('지금 스타일(cnCards)도 같은 문항 4장', JSON.stringify(nums(s1.v1)) === '[3,5,9,2]', JSON.stringify(s1.v1));
  t('자동 선택은 저장 안 함 — 메모리 card.picks=[] · 서버 card.picks=[] · picks 든 저장 0번', s1.mem.length === 0 && Array.isArray(s1.stored) && s1.stored.length === 0 && !s1.ups.some((p) => p && p.length), JSON.stringify([s1.mem, s1.stored, s1.ups]));
  t('화면 카드 목록에 문항 카드 4장 + 🧩 모자이크 칩 4개', JSON.stringify(nums(s1.shown)) === '[3,5,9,2]' && JSON.stringify(s1.mz) === '["08_3번적중","09_5번적중","10_9번적중","11_2번적중"]', JSON.stringify([s1.shown, s1.mz]));
  t('고르는 칩: 적중 5개 · 자동 문항 4개가 켜짐 · AI 표시 칩(3·4번) 그대로', s1.chips === 5 && JSON.stringify(s1.on.slice().sort((a, b) => a - b)) === '[2,3,5,9]' && s1.ai === 2, JSON.stringify([s1.chips, s1.on, s1.ai]));
  t('「자동 선택: 적중 문항 상위 4개 (직접 고르면 그대로 따릅니다)」 · 되돌리기 칩 없음', s1.auto === '자동 선택: 적중 문항 상위 4개 (직접 고르면 그대로 따릅니다)' && !s1.reset, JSON.stringify([s1.auto, s1.reset]));
  t('모자이크 안내 줄', /문항 카드마다 🧩 모자이크 칩이 붙습니다 — 카드 목록에서 누르면 그림 위에 상자를 그려 가릴 수 있어요/.test(s1.hint), s1.hint);

  /* ── ④ 자리 ── */
  const pos = await pg.evaluate(() => { const P = document.getElementById('cn-panel'), heads = [...P.querySelectorAll('.ht-h')], top = P.getBoundingClientRect().top;
    const y = (re) => { const h = heads.find((x) => re.test(x.textContent)); return h ? Math.round(h.getBoundingClientRect().top - top) : -1; };
    const sec = document.getElementById('cnp130-sec'), ai = document.getElementById('hv-cn-ai'), mk = heads.find((x) => /🎯 문항별 적중 카드/.test(x.textContent));
    const html = P.innerHTML;
    return { pick: y(/🎯 문항별 적중 카드/), color: y(/🎨 색/), killer: y(/🔥 킬러/), diff: y(/📊 난이도/), inSec: !!(sec && mk && sec.contains(mk) && ai && sec.contains(ai)), adj: !!(ai && ai.nextElementSibling === mk),
      aiTxt: ai ? ai.textContent : '', one: html.split('🎯 문항별 적중 카드').length - 1, firstH: (heads[0] || {}).textContent || '', intro: html.indexOf('문항·색·난이도 칸을 고르면') < html.indexOf('id="cnp130-sec"'), mk: html.indexOf('<div class="ht-h">🎯 문항별 적중 카드') >= 0 }; });
  t('🎯 칸이 맨 위 — 첫 소제목 · 🎨 색 · 📊 난이도 · 🔥 킬러 칸보다 위 · 안내 글 아래', pos.pick >= 0 && pos.pick < pos.color && pos.color < pos.diff && pos.diff < pos.killer && /🎯 문항별 적중 카드/.test(pos.firstH) && pos.intro, JSON.stringify(pos));
  t('🤖 AI 안내 줄이 🎯 제목 바로 앞(같이 옮겨짐) · 칸은 하나뿐 · 제목 글자 그대로', pos.inSec && pos.adj && /AI 판정 2문항\(3, 4번\)/.test(pos.aiTxt) && pos.one === 1 && pos.mk, JSON.stringify(pos));
  await pg.screenshot({ path: SP + '/v19130_panel.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('cn-panel').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: 560 }; }) }).catch((e) => console.log('그림 실패', e.message));

  /* ── ⑤ 내려받기 · 블로그 폴더 · .md ── */
  const ex = await pg.evaluate(async () => {
    window.html2canvas = (el, opt) => { T.h2c.push(1); const c = document.createElement('canvas'); c.width = 4; c.height = 4; return Promise.resolve(c); };
    window.JSZip = function () { this.names = []; this.txt = {}; T.zips.push(this); };
    JSZip.prototype.file = function (n, b) { this.names.push(n); if (typeof b === 'string') this.txt[n] = b; };
    JSZip.prototype.generateAsync = function () { return Promise.resolve(new Blob(['zip'])); };
    window.callAI = async () => { throw new Error('API 키 없음'); };
    const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    await cnExport(); await new Promise((r) => setTimeout(r, 100)); const z1 = T.zips[T.zips.length - 1];
    await cn4BlogExport(); await new Promise((r) => setTimeout(r, 100)); const z2 = T.zips[T.zips.length - 1];
    HTMLAnchorElement.prototype.click = oc;
    const md1 = Object.keys(z1.txt).filter((n) => /\.md$/.test(n)).map((n) => z1.txt[n]).join('\n');
    const src = Object.keys(z2.txt).filter((n) => /source\.md$/.test(n)).map((n) => z2.txt[n]).join('\n');
    const cj = Object.keys(z2.txt).filter((n) => /cards\.json$/.test(n)).map((n) => z2.txt[n]).join('');
    const md0 = cnMd(HT.data[HT.cur], cn2Cards(HT.data[HT.cur]));
    return { zip1: z1 ? z1.names.filter((n) => /\.png$/.test(n)) : [], zip2: z2 ? z2.names.filter((n) => /cards\/.*\.png$/.test(n)) : [], md1, src, notes: cj ? JSON.parse(cj).cards.map((c) => c.note) : [], md0, mem: HT.data[HT.cur].card.picks.slice() }; });
  const qn = (a) => a.filter((n) => /번적중/.test(n)).map((n) => Number(/_(\d+)번적중/.exec(n)[1]));
  t('「카드 그림 + 글 자료 내려받기」 zip: 문항 카드 3·5·9·2번', JSON.stringify(qn(ex.zip1)) === '[3,5,9,2]', JSON.stringify(ex.zip1));
  t('블로그자료.md(zip 안 · cnMd) 에 문항 카드 4장(3·5·9·2번)', ['08_3번적중', '09_5번적중', '10_9번적중', '11_2번적중'].every((f) => ex.md1.indexOf(f) >= 0 && ex.md0.indexOf(f) >= 0), ex.md0.slice(0, 200));
  const notes = ex.notes.filter((n) => /번 문항 사례/.test(n)).map((n) => Number(/^(\d+)번/.exec(n)[1]));
  t('「블로그 폴더로 내려받기」: cards/ 그림 ' + ex.zip2.length + '장 · cards.json 문항 사례 3·5·9·2번 · source.md 에도 문항 카드', ex.zip2.length === 13 && JSON.stringify(notes) === '[3,5,9,2]' && /3번/.test(ex.src) && (ex.src.match(/번 문항|번적중|q0\d/g) || []).length >= 4, JSON.stringify([ex.zip2, ex.notes]));
  t('내려받은 뒤에도 picks 는 저장 안 함(메모리 [])', ex.mem.length === 0 && !(await state()).ups.some((p) => p && p.length), JSON.stringify(ex.mem));

  /* ── ③ 직접 고르기 ── */
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#cn-panel button[onclick="cnToggleNo(\'picks\',4,4)"]')][0]; b.click(); }); await settle(150);
  const s3a = await state();
  t('자동 4개일 때 다른 칩(4번) → 안내만 · 그대로 자동(저장 없음)', s3a.mem.length === 0 && !s3a.ups.some((p) => p && p.length) && /자동으로 고른 문항이 이미 4개/.test(await pg.evaluate(() => T.toasts.slice(-1)[0] || '')), JSON.stringify([s3a.mem, s3a.ups]));
  await pg.evaluate(() => { document.querySelector('#cn-panel button[onclick="cnToggleNo(\'picks\',9,4)"]').click(); }); await settle(200);
  const s3 = await state();
  t('자동 문항 9번 칩을 누름 → 자동 목록을 옮겨 적고 9번만 뺌 → picks [3,5,2] 저장', JSON.stringify(s3.mem) === '[3,5,2]' && JSON.stringify(s3.stored) === '[3,5,2]' && JSON.stringify(s3.ups.slice(-1)[0]) === '[3,5,2]', JSON.stringify([s3.mem, s3.stored, s3.ups]));
  t('직접 고르기: 문항 카드 3장 · 🧩 3개 · 자동 줄 없음 · 「↺ 자동으로 되돌리기」 칩', JSON.stringify(nums(s3.shown)) === '[3,5,2]' && s3.mz.length === 3 && !s3.auto && s3.reset, JSON.stringify([s3.shown, s3.mz, s3.auto, s3.reset]));
  await pg.evaluate(() => { document.querySelector('#cn-panel button[onclick="cnToggleNo(\'picks\',4,4)"]').click(); }); await settle(200);
  const s4 = await state();
  t('이어서 4번 넣기 → [3,5,2,4] 저장 · 카드 4장 순서 그대로', JSON.stringify(s4.stored) === '[3,5,2,4]' && JSON.stringify(nums(s4.v2)) === '[3,5,2,4]', JSON.stringify([s4.stored, s4.v2]));
  /* 🧩 모자이크 창 */
  const mzo = await pg.evaluate(() => new Promise((r) => { document.querySelector('#cn-cards [data-cn3mz]').click(); setTimeout(() => r({ dlg: !!document.querySelector('.cn3-mzin'), head: (document.querySelector('.cn3-mzh') || {}).textContent || '' }), 400); }));
  t('🧩 모자이크 창이 열림 (3번 카드)', mzo.dlg && /3번/.test(mzo.head), JSON.stringify(mzo));
  await pg.evaluate(() => { const x = document.querySelector('.cn3-mz'); if (x) x.remove(); CN3.mz = null; });
  /* 되돌리기 */
  await pg.evaluate(() => document.getElementById('cnp130-reset').click()); await settle(200);
  const s5 = await state();
  t('「↺ 자동으로 되돌리기」 → picks [] 저장 · 다시 자동 3·5·9·2 · 자동 줄 · 되돌리기 칩 사라짐', s5.mem.length === 0 && Array.isArray(s5.stored) && s5.stored.length === 0 && JSON.stringify(s5.ups.slice(-1)[0]) === '[]' && JSON.stringify(nums(s5.shown)) === '[3,5,9,2]' && /상위 4개/.test(s5.auto) && !s5.reset, JSON.stringify([s5.mem, s5.stored, s5.shown, s5.auto, s5.reset]));
  /* 직접 고른 것을 다 빼면 자동으로 */
  await pg.evaluate(() => { document.querySelector('#cn-panel button[onclick="cnToggleNo(\'picks\',3,4)"]').click(); }); await settle(150);
  for (const n of [5, 9, 2]) { await pg.evaluate((n) => { document.querySelector('#cn-panel button[onclick="cnToggleNo(\'picks\',' + n + ',4)"]').click(); }, n); await settle(150); }
  const s6 = await state();
  t('직접 고른 것을 하나씩 다 빼면 → picks [] · 다시 자동 4장', s6.mem.length === 0 && JSON.stringify(nums(s6.shown)) === '[3,5,9,2]' && /상위 4개/.test(s6.auto), JSON.stringify([s6.mem, s6.shown]));

  /* ── 기준을 «유사유형까지»로 → 유사유형(1·6번)은 맨 뒤 ── */
  const s7 = await pg.evaluate(() => { const d = HT.data[HT.cur], b = d.basis; d.basis = 'type'; d.items[8].hit = { k: null, kind: 'none', ok: false, by: 'teacher' }; d.items[4].hit = { k: null, kind: 'none', ok: false, by: 'teacher' };
    const r = cnp130Picks(d); d.basis = b; return r; });
  t('기준 «유사유형까지» · 5·9번 ✗ → 같은 문제 3 → 숫자변형 2·4 → 유사유형 1 (최대 4)', JSON.stringify(s7) === '[3,2,4,1]', JSON.stringify(s7));

  /* ── 적중 없음 → 문항 카드 없음 · 줄 없음 ── */
  const s8 = await pg.evaluate(() => { const d = HT.data[HT.cur]; d.items.forEach((it) => { it.hit = { k: null, kind: 'none', ok: false, by: 'teacher' }; }); render();
    return { eff: cnp130Picks(d), q: cn2Cards(d).filter((x) => /번적중$/.test(x.file)).length, auto: !!document.getElementById('cnp130-auto'), sec: !!document.getElementById('cnp130-sec'), none: /적중 문항이 없습니다/.test(document.getElementById('cn-panel').textContent) }; });
  t('적중 0 → 자동 없음 · 문항 카드 0 · 「적중 문항이 없습니다」 그대로', s8.eff.length === 0 && s8.q === 0 && !s8.auto && s8.sec && s8.none, JSON.stringify(s8));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail) + ' 통과');
  await br.close(); process.exit(fail ? 1 : 0);
})();
