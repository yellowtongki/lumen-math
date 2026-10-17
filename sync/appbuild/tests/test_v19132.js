#!/usr/bin/env node
/* 학원앱 v19-132 검사 — 모자이크 창 오른쪽 참고 그림 · 🤖 자동 상자 숫자만/식/둘 다 (원장 2026-10-17)
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
const FILE = path.resolve(process.argv[2] || 'lumen_v19-132.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-132'])[0];
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
  /* 시험 문항 그림: 문항 번호 22 · 한글 · 숫자 15 · 수식 x+2 · 수식 A(-3,-5) — 토큰 위치를 기억해 «가짜 AI»가 번호를 고르게 */
  await pg.evaluate(() => {
    const W = 900, H = 160, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = '34px serif'; g.textBaseline = 'alphabetic';
    const toks = [['22', 'qno'], ['두', 'text'], ['점', 'text'], ['15', 'num'], ['x+2', 'expr'], ['와', 'text'], ['A(-3,-5)', 'expr'], ['를', 'text']];
    let x = 20; window.TOK = [];
    toks.forEach(([t, k]) => { const w = g.measureText(t).width; g.fillText(t, x, 70); TOK.push({ t, k, x0: x, x1: x + w }); x += w + 34; });
    g.font = '34px serif'; g.fillText('7', 20, 130); TOK.push({ t: '7', k: 'num', x0: 20, x1: 20 + g.measureText('7').width, line2: true });
    const exam = c.toDataURL('image/png');
    const m = document.createElement('canvas'); m.width = 700; m.height = 120; const h = m.getContext('2d'); h.fillStyle = '#fff'; h.fillRect(0, 0, 700, 120); h.fillStyle = '#123'; h.font = '30px serif'; h.fillText('두 점 A(5,2), B(-1,7)', 20, 70);
    const mat = m.toDataURL('image/png');
    const d = HT.data[HT.cur]; d.items.forEach((it) => { it.imgUrl = exam; }); Object.keys(d.mats).forEach((k) => { d.mats[k].img = mat; });
    window.EXAM_URL = exam; window.MAT_URL = mat;
    /* 가짜 AI: 덩어리 왼쪽 끝이 어느 토큰에 걸리는지로 종류를 정한다 */
    window.cn132AskHook = async (seg) => { T.asked = (T.asked || 0) + 1; const items = [];
      seg.boxes.forEach((b) => { const cx = (b.x0 + b.x1) / 2 / seg.sc, line2 = b.y0 / seg.sc > 95; const tk = TOK.find((q) => !!q.line2 === line2 && cx >= q.x0 - 4 && cx <= q.x1 + 4);
        if (tk && (tk.k === 'num' || tk.k === 'expr')) items.push({ id: b.id, kind: tk.k, t: tk.t }); });
      return { items }; };
    render();
  }); await wait(400);

  const f = await pg.evaluate(() => { const b = document.querySelector('[data-cn3mz]'); return b && b.getAttribute('data-cn3mz'); });
  await pg.evaluate((f) => cn3MzOpen(f), f); await wait(700);
  const r1 = await pg.evaluate(() => { const two = document.getElementById('cn132-two'), ref = document.getElementById('cn132-refimg'), cv = document.getElementById('cn3-cv');
    return { two: !!two, cap: (document.querySelector('.cn132-cap') || {}).textContent || '', refMat: ref ? ref.getAttribute('src') === MAT_URL : false, im: !!(CN3.mz && CN3.mz.im),
      fit: cv && two ? (parseFloat(cv.style.width) <= cv.parentNode.clientWidth) : false, ai: [...document.querySelectorAll('button[data-cn132]')].map((x) => x.textContent) }; });
  t('시험 문항 탭: 오른쪽 참고 그림 = 우리 자료 (보기만)', r1.two && r1.refMat && /참고 — .*보기만/.test(r1.cap), JSON.stringify(r1));
  t('왼쪽 그림이 칸 안에 맞음 · 자동 상자 단추 3개 + 참고 숨기기', r1.im && r1.fit && JSON.stringify(r1.ai) === JSON.stringify(['숫자만', '식', '둘 다', '참고 그림 숨기기']), JSON.stringify(r1));
  try { await pg.locator('.cn3-mzin').screenshot({ path: path.join(SP, 'v19132_dialog.png') }); } catch (e) {}

  await pg.evaluate(() => cn132RefToggle()); await wait(150);
  const r2 = await pg.evaluate(() => ({ two: !!document.getElementById('cn132-two'), btn: (document.querySelector('[data-cn132="ref"]') || {}).textContent }));
  await pg.evaluate(() => cn132RefToggle()); await wait(150);
  t('「참고 그림 숨기기」 → 한 칸 · 다시 보기', !r2.two && r2.btn === '참고 그림 보기' && await pg.evaluate(() => !!document.getElementById('cn132-two')), JSON.stringify(r2));

  /* 덩어리 찾기 */
  const sg = await pg.evaluate(() => { const s = cn132Segment(CN3.mz.im); return { n: s.boxes.length, lines: [...new Set(s.boxes.map((b) => b.y0 > 95 * s.sc ? 2 : 1))] }; });
  t('글자 덩어리 찾기: 토큰 9개 → 덩어리 9개 이상 · 두 줄', sg.n >= 9 && sg.lines.length === 2, JSON.stringify(sg));

  const run = async (mode) => { await pg.evaluate(() => { CN3.mz.rects.exam = []; }); await pg.evaluate((m) => cn132Auto(m), mode); await wait(300);
    return pg.evaluate(() => { const L = CN132.last, rs = CN3.mz.rects.exam.map((q) => ({ x0: q.x * EXW, x1: (q.x + q.w) * EXW, y: q.y * EXH }));
      const hits = (tk) => rs.some((q) => q.x0 <= tk.x0 + 3 && q.x1 >= tk.x1 - 3 && (!!tk.line2) === (q.y > 95));
      return { n: rs.length, msg: CN3.mz.aiMsg, cover: TOK.map((tk) => tk.t + ':' + (hits(tk) ? 'Y' : 'n')).join(' '), dirty: CN3.mz.dirty }; }); };
  await pg.evaluate(() => { window.EXW = CN3.mz.im.naturalWidth; window.EXH = CN3.mz.im.naturalHeight; });
  const e1 = await run('expr');
  t('식: x+2 · A(-3,-5) 만 통째로 (숫자 15·7·문항번호 22·한글은 안 가림)', /x\+2:Y/.test(e1.cover) && /A\(-3,-5\):Y/.test(e1.cover) && /15:n/.test(e1.cover) && /22:n/.test(e1.cover) && /두:n/.test(e1.cover) && /7:n/.test(e1.cover) && e1.n === 2, JSON.stringify(e1));
  const n1 = await run('num');
  t('숫자만: 15 · 7 은 가림 · 문항번호 22·한글은 안 가림 · 수식은 숫자 글자(또는 통째)', /15:Y/.test(n1.cover) && /7:Y/.test(n1.cover) && /22:n/.test(n1.cover) && /두:n/.test(n1.cover) && n1.n >= 4, JSON.stringify(n1));
  const nx = await pg.evaluate(() => { const L = CN132.last, b = L.seg.boxes.find((q) => L.ans.items.some((i) => i.id === q.id && i.t === 'x+2')); const d = b && cn132DigitBoxes(b, 'x+2'); return { glyphs: b && b.glyphs.length, d: d ? d.length : null }; });
  console.log('   숫자만 결과:', n1.cover, '| 안내:', n1.msg);
  t('수식 x+2 → 글자 3개로 나뉘면 «2» 만 가림', nx.glyphs !== 3 || nx.d === 1, JSON.stringify(nx));
  const b1 = await run('both');
  t('둘 다: 15 · 7 · x+2 · A(-3,-5) (22·한글 빼고)', b1.n === 4 && /15:Y/.test(b1.cover) && /x\+2:Y/.test(b1.cover) && /A\(-3,-5\):Y/.test(b1.cover) && /7:Y/.test(b1.cover) && /22:n/.test(b1.cover), JSON.stringify(b1));
  t('안내 줄 «상자 N개를 넣었습니다 — 확인하고 「저장」» · 저장 전 표시', /상자 4개를 넣었습니다/.test(b1.msg) && b1.dirty === true, JSON.stringify(b1));
  const st0 = await pg.evaluate((f) => JSON.stringify(((T.store['exam_hit_' + HT.cur].card || {}).mosaic || {})[f] || null), f);
  t('저장 누르기 전에는 서버에 안 들어감', st0 === 'null', st0);
  await pg.evaluate(() => cn3MzSave()); await wait(500);
  const st1 = await pg.evaluate((f) => (((T.store['exam_hit_' + HT.cur].card || {}).mosaic || {})[f] || {}).exam || [], f);
  t('「저장」 → 서버 card.mosaic 에 상자 4개', st1.length === 4, JSON.stringify(st1).slice(0, 120));
  const twice = await pg.evaluate(async () => { await cn132Auto('both'); return CN3.mz.rects.exam.length; });
  t('같은 자동 상자를 또 눌러도 겹쳐 넣지 않음', twice === 4, String(twice));

  /* 우리 자료 탭 → 참고 그림 = 시험 문항 */
  await pg.evaluate(() => cn3MzTab('mat')); await wait(500);
  const r3 = await pg.evaluate(() => { const ref = document.getElementById('cn132-refimg'); return { which: CN3.mz.which, cap: (document.querySelector('.cn132-cap') || {}).textContent || '', exam: ref ? /^data:image\/png/.test(ref.getAttribute('src')) : false, msg: CN3.mz.aiMsg || '' }; });
  t('우리 자료 탭: 참고 그림 = 시험 문항(가린 모습) · 안내 줄 새로', r3.which === 'mat' && /시험 문항/.test(r3.cap) && r3.exam && r3.msg === '', JSON.stringify(r3));

  /* 키 없음 */
  const nk = await pg.evaluate(async () => { const h = window.cn132AskHook; window.cn132AskHook = null; try { localStorage.removeItem('or_api_key'); } catch (e) {} await cn132Auto('num'); window.cn132AskHook = h; return CN3.mz.aiMsg; });
  t('Claude 키가 없으면 안내만 (상자 안 넣음)', /Claude 키가 없습니다/.test(nk), nk);
  await pg.evaluate(() => cn3MzClose());

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail) + ' 통과');
  await br.close(); process.exit(fail ? 1 : 0);
})();
