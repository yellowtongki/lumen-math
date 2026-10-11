#!/usr/bin/env node
/* 학원앱 v19-101 검사 — 📰 카드뉴스 2판 고침 (원장 지시 2026-10-11 「매쓰플랫 용어 대신 학원 교재 · 기출문제도 보이게 · 모자이크는 내가 직접」)
 *   test_v19100 의 검사(디자인 2판 · 배경함 · 내려받기)를 그대로 두고 더한다:
 *   ① 카드 · 블로그자료.md · 적중 분석 .md · 학부모 보고서에 「매쓰플랫」 없음 · 자료 이름 다섯 종류
 *   ② 문항 카드 두 그림(시험 문항 + 우리 자료) · 이름표 · 기본 선명 · 「흐리게」 칩 저장
 *   ③ 🧩 모자이크 창 — 상자 그리기 · 저장(0~1 비율) · 카드 그림이 모자이크 data:image/png · 되돌리기 · 모두 지우기 · CORS 없는 그림 경고 · 내려받기에도 모자이크
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19101.js lumen_v19-101.html
 *   그림: $SP/v19101_mosaic.png (모자이크 넣은 문항 카드) · $SP/v19101_modal.png (모자이크 창) · $SP/v19101_square.png (1:1 문항 카드) · v19101_cards.png · v19101_phone.png
 *   그림은 모두 data: 주소(외부망 없음) · CORS 없는 그림은 $SP/v19101_nocors.png (file://). 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-101.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-101'])[0];
const NEW101 = true;
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EXAM_ID = '범박고_고2_2026_2_중간';
const STORE = {
  exam_hit_index: { items: [{ examId: EXAM_ID, school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', total: 6, at: '2026-10-10T12:00:00Z' }] },
};
STORE['exam_hit_' + EXAM_ID] = { examId: EXAM_ID, exam: { school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', date: '2026-10-07' }, basis: 'same+var',
  from: '2026-07-01', to: '2026-10-07', students: ['AAA111', 'BBB222'],
  items: [
    { no: 1, chapter: '함수의 극한', type: '극한값 계산', level: 2, cands: [{ k: 'tb:4', kind: 'same', also: [] }], hit: null, repeat: [{ year: 2024 }, { year: 2025 }] },
    { no: 2, chapter: '함수의 연속', type: '연속 조건', level: 3, cands: [{ k: 'ms:900001:3', kind: 'var', also: [] }], hit: null },
    { no: 3, chapter: '미분계수', type: '미분계수 정의', level: 3, cands: [{ k: 'ws:9', kind: 'type', also: [] }], hit: null, essay: true },
    { no: 4, chapter: '도함수', type: '도함수 계산', level: 4, cands: [{ k: 'lib:L1:2', kind: 'var', also: [] }], hit: { k: 'lib:L1:2', kind: 'var', ok: true, by: 'teacher', at: '2026-10-10T12:30:00Z' }, repeat: [{ year: 2025 }] },
    { no: 5, chapter: '도함수', type: '접선의 방정식', level: 5, cands: [{ k: 'ws:8', kind: 'same', also: [] }], hit: null },
    { no: 6, chapter: '함수의 극한', type: '극한의 대소', level: 1, cands: [], hit: null } ],
  mats: {
    'tb:4': { kind: 'textbook', title: '교과서 비상교육 미적분1', where: '교과서 비상교육 미적분1 10쪽 1번', cid: 21, img: '', res: {} },
    'ms:900001:3': { kind: 'ms', title: '교과서 변형 미적분1 1단원 함수의 극한 (고2)', where: '교과서 변형 3번', cid: 22, img: '', res: {} },
    'ws:9': { kind: 'ws', title: '미분계수 학습지', where: '미분계수 학습지 9번', cid: 23, img: '', res: { AAA111: 'O' } },
    'ws:8': { kind: 'ws', title: '접선 학습지', where: '접선 학습지 2번', cid: 24, img: '', res: { AAA111: 'X', BBB222: 'O' } },
    'lib:L1:2': { kind: 'upload', lib: true, title: '미적분1 극한 보충 프린트', where: '미적분1 극한 보충 프린트 2번', cid: 25, img: '', res: {} } },
  stats: { total: 6 },
  card: { pal: 1, wm: true, picks: [1, 2, 4, 5], killers: [4, 5] } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  /* CORS 로 읽을 수 없는 그림(file://) — 모자이크 «적용할 수 없음» 경고 검사용 */
  const NOCORS_PNG = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 160); g.fillStyle = '#1d4ed8'; for (let i = 0; i < 20; i++) g.fillRect(i * 10, (i % 4) * 30, 6, 60); return c.toDataURL('image/png').split(',')[1]; });
  const NOCORS = path.join(path.resolve(SP), 'v19101_nocors.png'); require('fs').writeFileSync(NOCORS, Buffer.from(NOCORS_PNG, 'base64'));
  const NOCORS_URL = 'file://' + NOCORS;
  await pg.evaluate(({ STORE, NOCORS_URL }) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    /* 배경 그림 두 장(색 1번) — 그림은 data: 주소로 만든다(외부망 없음) */
    const mk = (a, b) => { const c = document.createElement('canvas'); c.width = 216; c.height = 270; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 216, 270); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 216, 270);
      g.fillStyle = 'rgba(245,197,66,.85)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(20 + i * 23, 30 + (i % 3) * 40, 6 + (i % 4) * 3, 0, 7); g.fill(); } return c.toDataURL('image/png'); };
    const BG1 = mk('#2a7a5c', '#06231b'), BG2 = mk('#7a5c2a', '#1b1306');
    const store = clone(STORE);
    store.cn_bg_index = { updated: '2026-10-10T00:00:00Z', items: [
      { id: 'bgA', pal: 1, url: BG1, path: 'cardbg/1/bgA.png', src: 'upload', at: '2026-10-10T00:00:00Z', note: '시험용 1' },
      { id: 'bgB', pal: 1, url: BG2, path: 'cardbg/1/bgB.png', src: 'gemini', at: '2026-10-10T00:00:00Z', note: '시험용 2' } ] };
    /* 문항 그림(흐리게) 하나 */
    store['exam_hit_범박고_고2_2026_2_중간'].items[0].imgUrl = mk('#ffffff', '#cbd5e1');
    /* v19-101: 잔무늬 그림(모자이크가 눈에 보이게) — 1번 시험 문항 · 1번 우리 자료(교과서) · 2번 우리 자료는 CORS 없는 그림 */
    const mkDetail = (a, b) => { const c = document.createElement('canvas'); c.width = 240; c.height = 300; const g = c.getContext('2d'); for (let y = 0; y < 300; y += 3) for (let x = 0; x < 240; x += 3) { g.fillStyle = ((x + y) / 3) % 2 ? a : b; g.fillRect(x, y, 3, 3); } g.fillStyle = '#111'; g.font = 'bold 44px sans-serif'; g.fillText('x² + 1', 24, 150); return c.toDataURL('image/png'); };
    store['exam_hit_범박고_고2_2026_2_중간'].items[0].imgUrl = mkDetail('#ffffff', '#94a3b8');
    store['exam_hit_범박고_고2_2026_2_중간'].mats['tb:4'].img = mkDetail('#fff7ed', '#f97316');
    store['exam_hit_범박고_고2_2026_2_중간'].mats['ms:900001:3'].img = NOCORS_URL;
    window.IMG0 = { exam: store['exam_hit_범박고_고2_2026_2_중간'].items[0].imgUrl, mat: store['exam_hit_범박고_고2_2026_2_중간'].mats['tb:4'].img };
    window.T = { store, upserts: [], ups: [], rms: [], gem: [], toasts: [], h2c: [], zips: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({ eq: (k, v) => Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: (b) => ({
        upload: (p, blob, opt) => { T.ups.push({ b, p, type: opt && opt.contentType, size: blob && blob.size }); return Promise.resolve({ data: { path: p }, error: null }); },
        getPublicUrl: (p) => ({ data: { publicUrl: 'https://bhkkkbcytcrlxhrtjgen.supabase.co/storage/v1/object/public/' + b + '/' + p } }),
        remove: (a) => { T.rms.push({ b, a }); return Promise.resolve({ data: a, error: null }); } }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.confirm = () => true;
    const of = window.fetch.bind(window);
    window.fetch = (url, opt) => { const u = String(url);
      if (/^data:/.test(u)) return of(url, opt);
      if (/generativelanguage\.googleapis\.com/.test(u)) { T.gem.push({ url: u, opt: opt || {} });
        const png = BG2.split(',')[1];
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }) }); }
      return Promise.reject(new Error('외부망 차단')); };
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1440px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    try { localStorage.removeItem('cn_style'); localStorage.removeItem('cn_font'); localStorage.removeItem('cn_size'); localStorage.removeItem('or_gemini_key'); } catch (e) {}
    geminiKey = '';
    VIEW = 'examhit'; HT.kicked = true; HT.idx = clone(store.exam_hit_index); HT.req = { status: 'done' }; HT.cur = '범박고_고2_2026_2_중간';
    htLoad(HT.cur, true); CN.open = true;
  }, { STORE, NOCORS_URL });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  await settle(200); await pg.evaluate(() => render()); await settle(250); await pg.evaluate(() => render()); await settle(100);

  /* 카드 크기 재기 — 카드 폭 대비 % (cqw) */
  const measure = () => pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#cn-cards .cn2')];
    const pct = (el, w) => parseFloat(getComputedStyle(el).fontSize) / w * 100;
    let minF = 99, minAt = '', over = [], overlap = [], bl = [], ttlLines = [];
    cards.forEach((c, ci) => {
      const w = c.clientWidth, cr = c.getBoundingClientRect();
      c.querySelectorAll('*').forEach((el) => { if (el.closest('svg') || el.closest('.wmk')) return;
        const has = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!has) return;
        const f = pct(el, w); if (f < minF) { minF = f; minAt = ci + ':' + el.className + ':' + el.textContent.slice(0, 12); } });
      const foot = c.querySelector('.foot').getBoundingClientRect(); if (foot.bottom > cr.bottom + 1) over.push(ci + 1);
      const up = c.querySelector('.viz') || c.querySelector('.kw') || c.querySelector('.ttl'); const lt = c.querySelector('.list').getBoundingClientRect();
      if (up.getBoundingClientRect().bottom > lt.top + 4) overlap.push(ci + 1);
      const vz = c.querySelector('.viz'); if (vz) { const vr = vz.getBoundingClientRect(); vz.querySelectorAll('.ch > *, .big').forEach((x) => { const xr = x.getBoundingClientRect(); if (xr.top < vr.top - 1 || xr.bottom > vr.bottom + 1) overlap.push('viz' + (ci + 1)); }); }
      const lis = [...c.querySelectorAll('.li span')]; bl.push({ n: lis.length, len: lis.map((x) => x.textContent).join('').length });
      const tt = c.querySelector('.ttl'); ttlLines.push(Math.round(tt.getBoundingClientRect().height / parseFloat(getComputedStyle(tt).lineHeight)));
    });
    const c0 = cards[0], w0 = c0 ? c0.clientWidth : 1;
    return { n: cards.length, w0, ttl: c0 ? pct(c0.querySelector('.ttl'), w0) : 0, li: c0 ? pct(c0.querySelector('.li span'), w0) : 0, foot: c0 ? pct(c0.querySelector('.foot'), w0) : 0,
      eyebrow: c0 ? pct(c0.querySelector('.eyebrow'), w0) : 0, minF, minAt, over, overlap, bl, ttlLines,
      ar: c0 ? getComputedStyle(c0).aspectRatio : '', hw: c0 ? c0.clientHeight / c0.clientWidth : 0, fam: c0 ? getComputedStyle(c0.querySelector('.ttl')).fontFamily : '' };
  });

  /* 1) 기본 = 새 스타일 */
  const o1 = await pg.evaluate(() => { const cc = document.getElementById('cn-cards'); const files = cn2Cards(HT.data[HT.cur]).map((x) => x.file); const v1f = cnCards(HT.data[HT.cur]).map((x) => x.file);
    return { ver: APP_VER, style: CN.style, panel: !!document.getElementById('cn-panel'), opts: !!document.getElementById('cn2-opts'), oldCn: cc ? cc.querySelectorAll('.cn').length : -1, files, v1f,
      text: cc ? cc.textContent : '', html: cc ? cc.innerHTML : '', bgbox: !!document.getElementById('cn2-bgbox'), font: !!document.getElementById('cn2-font'),
      pal2: CN_PAL2.length, pal2ok: CN_PAL2.every((p, i) => p.n === CN_PAL[i].n && p.bg1 && p.bg2 && p.gold && p.red && p.ink && p.panel) }; });
  const m1 = await measure();
  t('버전 ' + WANT, o1.ver === WANT, o1.ver);
  t('기본 = 새 스타일(v2) · 카드뉴스 칸 맨 위 칩 · 🖼 배경함 칸 · 글꼴 <link> 한 번', o1.style === 'v2' && o1.panel && o1.opts && o1.bgbox && o1.font, JSON.stringify([o1.style, o1.panel, o1.opts, o1.bgbox, o1.font]));
  t('카드 12장 이상 .cn2 (9장 + 고른 문항 4장) · 옛 .cn 없음 · 파일 이름·순서 = 지금 스타일과 같음', m1.n >= 12 && m1.n === 13 && o1.oldCn === 0 && JSON.stringify(o1.files) === JSON.stringify(o1.v1f), JSON.stringify([m1.n, o1.oldCn, o1.files]));
  t('12색 진한 짝 CN_PAL2 (이름·순서 같음 · bg1/bg2/gold/red/ink/panel)', o1.pal2 === 12 && o1.pal2ok, '');
  t('글자 크기(카드 폭 대비): 제목 ≥12% · 체크 줄 ≥3.6% · 꼬리말 ≥2% · 위 띠 3.4%', m1.ttl >= 12 && m1.li >= 3.59 && m1.foot >= 1.99 && Math.abs(m1.eyebrow - 3.4) < 0.05, JSON.stringify([m1.ttl, m1.li, m1.foot, m1.eyebrow]));
  t('모든 카드의 모든 글자 ≥ 2.0% (그래프 SVG 제외)', m1.minF >= 1.99, m1.minF + ' @ ' + m1.minAt);
  t('체크 줄 3줄 이하 · 합쳐 60자 이하 · 제목 3줄 이하', m1.bl.every((b) => b.n >= 1 && b.n <= 3 && b.len <= 60) && m1.ttlLines.every((x) => x <= 3), JSON.stringify([m1.bl, m1.ttlLines]));
  t('4:5 — 꼬리말이 카드 안 · 그래프/키워드와 흰 패널이 겹치지 않음', m1.over.length === 0 && m1.overlap.length === 0 && Math.abs(m1.hw - 1.25) < 0.01, JSON.stringify([m1.over, m1.overlap, m1.hw]));
  t('카드 글에 「수학비서」·학생 이름 없음 · 자료는 종류만 · 마지막 카드 「루멘수학」', o1.text.indexOf('수학비서') < 0 && o1.text.indexOf('○○○') < 0 && /교과서/.test(o1.text) && (NEW101 ? (/학원 대비 학습지/.test(o1.text) && /루멘수학 학습지/.test(o1.text) && o1.text.indexOf('매쓰플랫') < 0) : (/학원 학습지/.test(o1.text) && /매쓰플랫 학습지·교재/.test(o1.text))) && /학원 프린트/.test(o1.text) && /— 루멘수학/.test(o1.text), '');
  t('그래프 카드에 큰 숫자 하나 (적중 %)', /적중 <\/small>67%|적중 67%/.test(o1.html.replace(/<small>/g, '')) || /67%/.test(o1.text), '');
  /* v19-101 부터: 시험 문항 + 우리 자료 두 그림, 기본은 선명 (흐리게는 칩으로) */
  t(NEW101 ? '문항 카드: 흰 패널 안에 시험 그림(선명) + 우리 자료 그림 + 큰 번호' : '문항 카드: 흰 패널 안에 흐린 시험 그림 + 큰 번호', await pg.evaluate((NEW101) => { const c = [...document.querySelectorAll('#cn-cards .cn2.pick')]; return c.length === 4 && (NEW101 ? (!!c[0].querySelector('.list .pk figure.exam img') && !c[0].querySelector('.list .pk img.blur')) : !!c[0].querySelector('.list .pk img.blur[data-blur]')) && c[0].querySelector('.pk .no b').textContent === '1'; }, NEW101), '');
  await pg.screenshot({ path: SP + '/v19101_cards.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('cn-panel').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: Math.min(2600, r.height) }; }) }).catch((e) => console.log('그림 실패', e.message));

  /* 2) 지금 스타일로 → 옛 그림 그대로 · 다시 새 스타일 */
  const o2 = await pg.evaluate(() => { document.querySelector('[data-cn2="style:v1"]').click(); const cc = document.getElementById('cn-cards');
    const r = { cn: cc.querySelectorAll('.cn').length, cn2: cc.querySelectorAll('.cn2').length, ls: localStorage.getItem('cn_style'), bgbox: !!document.getElementById('cn2-bgbox'), oldTtl: !!cc.querySelector('.cn .ttl em') };
    document.querySelector('[data-cn2="style:v2"]').click(); r.back = document.querySelectorAll('#cn-cards .cn2').length; return r; });
  t('「지금 스타일」 → 옛 .cn 카드(.cn2 없음) · 배경함 숨김 · 기억(cn_style=v1) → 「새 스타일」로 돌아옴', o2.cn >= 12 && o2.cn2 === 0 && o2.oldTtl && !o2.bgbox && o2.ls === 'v1' && o2.back === 13, JSON.stringify(o2));

  /* 3) 글꼴 칩 · 크기 칩 */
  await pg.evaluate(() => document.querySelector('[data-cn2="font:dohyeon"]').click());
  const fDh = (await measure()).fam;
  await pg.evaluate(() => document.querySelector('[data-cn2="font:black"]').click());
  const fBl = (await measure()).fam;
  t('글꼴 칩 → 제목 글꼴 Do Hyeon ↔ Black Han Sans (cn_font 기억)', /^"?Do Hyeon/.test(fDh) && /^"?Black Han Sans/.test(fBl), JSON.stringify([fDh, fBl]));
  await pg.evaluate(() => document.querySelector('[data-cn2="size:11"]').click());
  const m3 = await measure();
  t('크기 칩 1:1 → aspect-ratio 1/1 · 꼬리말 카드 안 · 겹침 없음 · 글자 ≥2%', /1 \/ 1/.test(m3.ar) && Math.abs(m3.hw - 1) < 0.01 && m3.over.length === 0 && m3.overlap.length === 0 && m3.minF >= 1.99, JSON.stringify([m3.ar, m3.hw, m3.over, m3.overlap, m3.minF, m3.minAt]));
  await pg.evaluate(() => document.querySelector('[data-cn2="size:45"]').click());
  t('다시 4:5', /4 \/ 5/.test((await measure()).ar), '');

  /* 4) 배경함 — 색 1번 2장 · 색 2번 0장 */
  const o4 = await pg.evaluate(async () => { document.querySelector('.cn2-bgt').click(); await new Promise((r) => setTimeout(r, 150));
    const n1 = document.querySelectorAll('#cn2-bgbox .cn2-th').length, ids = [...document.querySelectorAll('#cn2-bgbox .cn2-th')].map((x) => x.getAttribute('data-bgid'));
    cnSet('pal', 2); await new Promise((r) => setTimeout(r, 80)); const n2 = document.querySelectorAll('#cn2-bgbox .cn2-th').length; const other = /다른 색 배경 2장/.test(document.getElementById('cn2-bgbox').textContent);
    cnSet('pal', 1); await new Promise((r) => setTimeout(r, 80));
    return { n1, n2, ids, other, dim: !!document.getElementById('cn2-dim') }; });
  t('🖼 배경함: 색 1번 2장(bgA·bgB) · 색 2번 0장(「다른 색 배경 2장」) · 「배경 어둡게」 막대', o4.n1 === 2 && o4.n2 === 0 && o4.ids.join() === 'bgA,bgB' && o4.other && o4.dim, JSON.stringify(o4));

  /* 5) 카드 1 배경 고르기 → <img> · 시험 설정에 저장 · 전체에 같은 배경 */
  const o5 = await pg.evaluate(async () => {
    document.querySelector('[data-cn2bg="01_표지"]').click(); await new Promise((r) => setTimeout(r, 50));
    const pk = document.querySelector('[data-cn2pick="01_표지"] .cn2-pk[data-pk="bgA"]'); if (!pk) return { pk: false };
    pk.click(); await new Promise((r) => setTimeout(r, 120));
    const cards = [...document.querySelectorAll('#cn-cards .cn2')];
    const r = { pk: true, c1: !!cards[0].querySelector('img.bgimg'), c1dim: !!cards[0].querySelector('.bgdim'), c2: !!cards[1].querySelector('img.bgimg'), saved: ((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).bg || {})['01_표지'] };
    document.querySelector('[data-cn2all]').click(); await new Promise((r) => setTimeout(r, 120));
    const cards2 = [...document.querySelectorAll('#cn-cards .cn2')]; const bg = (T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).bg || {};
    r.all = cards2.length && cards2.every((c) => c.querySelector('img.bgimg')); r.star = bg['*']; r.keys = Object.keys(bg).length;
    cn2Dim(0.6); r.dimLs = localStorage.getItem('cn_bgdim'); r.dimCss = (document.querySelector('#cn-cards .cn2 .bgdim').getAttribute('style') || '').indexOf('0.60') >= 0;
    return r; });
  t('카드 1 「🖼 배경」 → bgA 고르기 → 카드 1에만 <img.bgimg> + 어둡게 덮개 · exam_hit_<시험>.card.bg 에 저장', o5.pk && o5.c1 && o5.c1dim && !o5.c2 && o5.saved === 'bgA', JSON.stringify(o5));
  t('「전체에 같은 배경」 → 모든 카드에 배경 · bg["*"]=bgA', o5.all && o5.star === 'bgA' && o5.keys === 14, JSON.stringify([o5.all, o5.star, o5.keys]));
  t('「배경 어둡게」 0.6 → 덮개 진하기 · cn_bgdim 기억', o5.dimLs === '0.6' && o5.dimCss, JSON.stringify([o5.dimLs, o5.dimCss]));
  await pg.evaluate(() => { cn2Dim(0.35); });

  /* 폰 너비 그림: 카드 3장(표지·적중결과(배경)·문항) 360px */
  await pg.evaluate(() => { const d = HT.data[HT.cur]; const c = cnCfg(d); c.bg = { '05_적중결과': 'bgA' }; const pv = document.createElement('div'); pv.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#eef2f8;padding:12px;width:1140px'; document.body.appendChild(pv); pv.id = 'cn2-phone-host'; pv.innerHTML = cnCardsHtml(d);
    const w = pv.querySelector('.cn2-wrap'); const keep = ['01_표지.png', '05_적중결과.png', '08_1번적중.png'];
    [...w.children].forEach((ch) => { const lab = ch.querySelector('.cn2-lab .ht-sub'); if (!keep.some((k) => lab && lab.textContent.indexOf(k) >= 0)) ch.style.display = 'none'; });
    w.style.gridTemplateColumns = 'repeat(3,360px)'; w.id = 'cn2-phone'; });
  await settle(300);
  const m6 = await measure();
  await pg.screenshot({ path: SP + '/v19101_phone.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('cn2-phone').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: Math.min(r.width, 1120), height: 480 }; }) }).catch((e) => console.log('그림 실패', e.message));
  const o6p = await pg.evaluate(() => [...document.querySelectorAll('#cn2-phone .cn2')].filter((x) => x.offsetParent).map((x) => ({ w: x.getBoundingClientRect().width, cw: x.clientWidth, li: parseFloat(getComputedStyle(x.querySelector('.li span')).fontSize), ttl: parseFloat(getComputedStyle(x.querySelector('.ttl')).fontSize) })));
  t('폰 너비 360px 카드 3장: 체크 줄 ≥ 13px(3.6%) · 제목 ≥ 45px(12.5%)', o6p.length === 3 && o6p.every((x) => Math.abs(x.cw - 360) < 1 && x.li >= 12.9 && x.ttl >= 44.9), JSON.stringify(o6p));
  await pg.evaluate(() => { document.getElementById('cn2-phone-host').remove(); const d = HT.data[HT.cur]; cnCfg(d).bg = {}; render(); });

  /* 6) Gemini — 키 없음 → 안내 · fetch 없음 */
  const o6 = await pg.evaluate(async () => { document.getElementById('cn2-gen').click(); await new Promise((r) => setTimeout(r, 60)); return { msg: (document.getElementById('cn2-msg') || {}).textContent || '', n: T.gem.length }; });
  t('Gemini 키 없음 → 「Gemini 키가 없습니다」 · 요청 0번', /Gemini 키가 없습니다/.test(o6.msg) && o6.n === 0, JSON.stringify(o6));
  /* 키 있음 → 요청 1번(IMAGE · 글자 없음) → 미리보기 → 보관 = Storage + 목록 */
  const o7 = await pg.evaluate(async () => { geminiKey = 'test-gem-key'; const up0 = T.ups.length;
    document.getElementById('cn2-gen').click(); await new Promise((r) => setTimeout(r, 250));
    const g = T.gem[0] || {}; let body = {}; try { body = JSON.parse(g.opt.body); } catch (e) {}
    const prompt = (((body.contents || [])[0] || {}).parts || [])[0] || {};
    const shown = !!document.querySelector('#cn2-genbox img');
    document.getElementById('cn2-keep').click(); await new Promise((r) => setTimeout(r, 400));
    const idx = T.store.cn_bg_index; const last = idx.items[idx.items.length - 1]; const up = T.ups.slice(up0);
    const thumbs = document.querySelectorAll('#cn2-bgbox .cn2-th').length;
    geminiKey = '';
    return { n: T.gem.length, url: g.url, method: g.opt && g.opt.method, mod: body.generationConfig && body.generationConfig.responseModalities, ar: body.generationConfig && body.generationConfig.imageConfig && body.generationConfig.imageConfig.aspectRatio,
      noText: /no text/i.test(prompt.text || ''), ko: /글자 없음/.test(prompt.text || ''), colors: /#1d5a46/.test(prompt.text || ''), shown, up, items: idx.items.length, last, thumbs }; });
  t('키 있음 → generateContent 요청 1번 (gemini-2.5-flash-image · responseModalities [IMAGE] · 4:5)', o7.n === 1 && /\/v1beta\/models\/gemini-2\.5-flash-image:generateContent\?key=test-gem-key$/.test(o7.url) && o7.method === 'POST' && JSON.stringify(o7.mod) === '["IMAGE"]' && o7.ar === '4:5', JSON.stringify([o7.url, o7.mod, o7.ar]));
  t('지시문: "no text" · 「글자 없음」 · 이 색의 바탕색', o7.noText && o7.ko && o7.colors, JSON.stringify([o7.noText, o7.ko, o7.colors]));
  t('미리보기 → 「보관」 → photos/cardbg/1/<id>.png 올림 · cn_bg_index 3장(src gemini) · 썸네일 3', o7.shown && o7.up.length === 1 && o7.up[0].b === 'photos' && /^cardbg\/1\/bg[a-z0-9]+\.png$/.test(o7.up[0].p) && o7.up[0].type === 'image/png' && o7.items === 3 && o7.last.src === 'gemini' && o7.last.pal === 1 && /\/object\/public\/photos\/cardbg\/1\//.test(o7.last.url) && o7.thumbs === 3, JSON.stringify([o7.up, o7.items, o7.last && o7.last.src, o7.thumbs]));

  /* 7) 그림 올리기 → Storage + 목록 · ✕ 삭제 */
  const o8 = await pg.evaluate(async () => { const up0 = T.ups.length;
    const c = document.createElement('canvas'); c.width = 1600; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#334'; g.fillRect(0, 0, 1600, 2000);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const inp = document.getElementById('cn2-file'); const dt = new DataTransfer(); dt.items.add(new File([blob], '배경.png', { type: 'image/png' })); inp.files = dt.files;
    await cn2UpFile(inp); await new Promise((r) => setTimeout(r, 100));
    const idx = T.store.cn_bg_index; const last = idx.items[idx.items.length - 1]; const up = T.ups.slice(up0);
    const n0 = idx.items.length; await cn2BgDel(last.id); await new Promise((r) => setTimeout(r, 100));
    return { up, items: n0, last, after: T.store.cn_bg_index.items.length, rms: T.rms.slice(-1), thumbs: document.querySelectorAll('#cn2-bgbox .cn2-th').length }; });
  t('「＋ 그림 올리기」 → 1080×1350 안으로 줄여 photos/cardbg/1/ 에 올림 · cn_bg_index 에 src upload', o8.up.length === 1 && o8.up[0].b === 'photos' && /^cardbg\/1\/bg[a-z0-9]+\.png$/.test(o8.up[0].p) && o8.items === 4 && o8.last.src === 'upload' && o8.last.note === '배경.png', JSON.stringify([o8.up, o8.items, o8.last]));
  t('「✕ 삭제」 → 목록에서 빠짐 · 파일 지우기 시도', o8.after === 3 && o8.rms.length === 1 && o8.rms[0].a[0] === o8.last.path && o8.thumbs === 3, JSON.stringify([o8.after, o8.rms, o8.thumbs]));

  /* ═════ v19-101 ═════ */
  /* 카드 한 장 찍기 — 로그인 덮개 위로 따로 띄워서 (폭 540px) */
  const shotCard = async (file) => {
    await pg.evaluate(() => { const w = document.querySelector('#cn-cards .cn2-wrap'), c = [...document.querySelectorAll('#cn-cards .cn2.pick')][0]; const pv = document.createElement('div'); pv.id = 'cn3-shot';
      pv.style.cssText = 'position:absolute;left:0;top:0;z-index:2147483000;background:#eef2f8;padding:10px'; pv.innerHTML = '<div class="' + w.className + '" style="' + w.getAttribute('style') + ';display:block;width:540px">' + c.outerHTML + '</div>'; document.body.appendChild(pv); });
    await settle(150); await pg.locator('#cn3-shot').screenshot({ path: SP + '/' + file }).catch((e) => console.log('그림 실패', e.message)); await pg.evaluate(() => document.getElementById('cn3-shot').remove()); };
  const EID = '범박고_고2_2026_2_중간';
  /* 9) 「매쓰플랫」 낱말 없음 — 카드(새·지금 스타일) · 블로그자료.md · 적중 분석 .md · 학부모 보고서(전체·학생 한 명) */
  const o9 = await pg.evaluate(() => {
    const d = HT.data[HT.cur]; const v2 = cn2Cards(d); const v1 = cnCards(d);
    const txt = (h) => { const x = document.createElement('div'); x.innerHTML = h; return x.textContent; };
    const cardsAll = v2.map((c) => txt(c.html) + c.html + c.para + (c.facts || []).join('')).join('\n') + v1.map((c) => txt(c.html) + c.html + c.para + (c.facts || []).join('')).join('\n');
    const md2 = cnMd(d, v2), md1 = cnMd(d, v1), hmd = htMd(d);
    let printed = ''; const ow = window.open; window.open = () => ({ document: { open() {}, write(x) { printed += x; }, close() {} } });
    htPrint(''); htPrint('AAA111'); window.open = ow;
    const screen = document.getElementById('cn-cards').textContent;
    const c07 = v2.filter((c) => c.file === '07_자료별적중')[0];
    return { mfCards: (cardsAll + screen).indexOf('매쓰플랫'), mfMd: (md2 + md1).indexOf('매쓰플랫'), mfHmd: hmd.indexOf('매쓰플랫'), mfRep: printed.indexOf('매쓰플랫'), repLen: printed.length,
      c07: txt(c07.html), c07facts: c07.facts, md2, hmdLine: (hmd.match(/- 우리 자료별 적중[^\n]*/) || [''])[0], hmdSrc: (hmd.match(/- 대조한 우리 자료[^\n]*/) || [''])[0],
      hmdT: hmd.split('\n').filter((l) => /^\| [25] \|/.test(l)), hmdTbl: /\| 2 \| 함수의 연속 \| 연속 조건 \| 3 \| 숫자변형 \(확인 중\) \| 학원 대비 학습지 \|/.test(hmd) && /\| 5 \| 도함수 \| 접선의 방정식 \| 5 \| 같은 문제 \(확인 중\) \| 루멘수학 학습지 \|/.test(hmd),
      rep: { book0: printed.indexOf('루멘수학 시험대비 교재 <b>0</b>') >= 0, ms1: printed.indexOf('학원 대비 학습지 <b class="red">1</b>') >= 0, tdMs: printed.indexOf('<td>학원 대비 학습지</td></tr>') >= 0, tdWs: printed.indexOf('<td>루멘수학 학습지</td></tr>') >= 0 },
      names: ['textbook', 'ws', 'book', 'ms', 'upload'].map((k) => cn3Kind({ kind: k })), lv: /기준: 문항 난도/.test(cardsAll), lvMd: /난이도\(문항 난도 1~5/.test(md2),
      pickTxt: txt(v2.filter((c) => /_1번적중$/.test(c.file))[0].html), pickPara: v2.filter((c) => /_2번적중$/.test(c.file))[0].para };
  });
  t('「매쓰플랫」 낱말 없음 — 카드(새·지금 스타일) · 블로그자료.md · 적중 분석 .md · 학부모 보고서(전체·학생)', o9.mfCards < 0 && o9.mfMd < 0 && o9.mfHmd < 0 && o9.mfRep < 0 && o9.repLen > 2000, JSON.stringify([o9.mfCards, o9.mfMd, o9.mfHmd, o9.mfRep, o9.repLen]));
  t('자료 이름 다섯 종류: 교과서 · 루멘수학 학습지 · 루멘수학 시험대비 교재 · 학원 대비 학습지 · 학원 프린트', o9.names.join('|') === '교과서|루멘수학 학습지|루멘수학 시험대비 교재|학원 대비 학습지|학원 프린트', o9.names.join('|'));
  t('07 자료별 적중 카드 = 새 이름 4종 · .md 숫자 줄도 새 이름 · 문항 카드 줄 「교과서에 같은 문제」', ['교과서', '루멘수학 학습지', '학원 대비 학습지', '학원 프린트'].every((k) => o9.c07.indexOf(k) >= 0) && o9.c07facts.some((f) => /^학원 대비 학습지 1문항: 2번/.test(f)) && /- 숫자: 루멘수학 학습지 1문항: 5번/.test(o9.md2) && /교과서에 같은 문제/.test(o9.pickTxt) && /^2번은 학원 대비 학습지에 있던 문제와 숫자만 다른 문제였습니다/.test(o9.pickPara), JSON.stringify([o9.c07, o9.c07facts, o9.pickPara]));
  t('난이도 기준 「문항 난도」(카드·.md) · 적중 분석 .md 자료별 줄·대조 자료 줄·표 · 보고서 «우리 자료별 적중» 다섯 종류·표', o9.lv && o9.lvMd && /교과서 1 · 루멘수학 학습지 1 · 루멘수학 시험대비 교재 0 · 학원 대비 학습지 1 · 학원 프린트 1/.test(o9.hmdLine) && /학원에서 푼 루멘수학 학습지·교재 문항/.test(o9.hmdSrc) && o9.hmdTbl && o9.rep.book0 && o9.rep.ms1 && o9.rep.tdMs && o9.rep.tdWs, JSON.stringify([o9.lv, o9.lvMd, o9.hmdT, o9.hmdTbl, o9.rep]));

  /* 10) 문항 카드 — 시험 문항 + 우리 자료 두 그림 · 이름표 · 큰 번호 · 기본 선명 (4:5 · 1:1) */
  const pickBox = () => pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#cn-cards .cn2.pick')]; const card = cards[0]; const cr = card.getBoundingClientRect(); const lr = card.querySelector('.list').getBoundingClientRect();
    const figs = [...card.querySelectorAll('.list .pk2 figure')];
    return { nCards: cards.length, imgs: card.querySelectorAll('.list .pk2 img').length, caps: figs.map((f) => f.querySelector('figcaption').textContent), cls: figs.map((f) => f.className),
      exSrc: (card.querySelector('figure.exam img') || { getAttribute: () => '' }).getAttribute('src') === IMG0.exam, matSrc: (card.querySelector('figure.mat img') || { getAttribute: () => '' }).getAttribute('src') === IMG0.mat,
      blur: card.querySelectorAll('img.blur').length, no: card.querySelector('.pk .no b').textContent,
      inside: figs.every((f) => { const r = f.getBoundingClientRect(); return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1 && r.right <= cr.right + 1 && r.left >= cr.left - 1; }),
      side: figs.length === 2 && figs[1].getBoundingClientRect().left > figs[0].getBoundingClientRect().right - 1,
      imgH: [...card.querySelectorAll('.list .pk2 img')].map((i) => Math.round(i.getBoundingClientRect().height / cr.height * 100)),
      chips: !!document.querySelector('[data-cn3blur="08_1번적중:0"].on') && !!document.querySelector('[data-cn3blur="08_1번적중:1"]') && !!document.querySelector('[data-cn3mz="08_1번적중"]'), nMz: document.querySelectorAll('[data-cn3mz]').length };
  });
  const o10 = await pickBox();
  t('문항 카드: 두 그림(시험 문항 · 우리 자료) 나란히 + 이름표 「시험 문항 1번」「교과서 문항」 · 큰 번호 · 기본 선명', o10.nCards === 4 && o10.imgs === 2 && o10.caps.join('|') === '시험 문항 1번|교과서 문항' && o10.exSrc && o10.matSrc && o10.blur === 0 && o10.no === '1' && o10.side, JSON.stringify(o10));
  t('4:5 — 두 그림이 흰 패널 안 · 그림 높이 ≥ 카드의 15% · 문항 카드마다 칩(선명/흐리게 · 🧩 모자이크) 4장', o10.inside && o10.imgH.every((h) => h >= 15) && o10.chips && o10.nMz === 4, JSON.stringify([o10.inside, o10.imgH, o10.chips, o10.nMz]));
  await pg.evaluate(() => cn2Set('size', '11')); await settle(80);
  const o10b = await pickBox(); const m10b = await measure();
  t('1:1 — 두 그림이 흰 패널 안 · 그림 높이 ≥ 카드의 10% · 꼬리말 카드 안 · 겹침 없음', o10b.inside && o10b.imgs === 2 && o10b.imgH.every((h) => h >= 10) && m10b.over.length === 0 && m10b.overlap.length === 0, JSON.stringify([o10b.inside, o10b.imgH, m10b.over, m10b.overlap]));
  await shotCard('v19101_square.png');
  await pg.evaluate(() => cn2Set('size', '45')); await settle(80);

  /* 11) 「흐리게」 칩 → 시험 문항만 흐리게 · 시험 설정에 저장 · 「선명」으로 되돌림 */
  const o11 = await pg.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-cn3blur="08_1번적중:1"]').click(); await wait(100);
    const card = () => [...document.querySelectorAll('#cn-cards .cn2.pick')][0];
    const r = { ex: !!card().querySelector('figure.exam img.blur[data-blur]'), mat: !!card().querySelector('figure.mat img.blur'), saved: ((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).blur || {})['08_1번적중'],
      chip: !!document.querySelector('[data-cn3blur="08_1번적중:1"].on'), other: [...document.querySelectorAll('#cn-cards .cn2.pick')][1].querySelectorAll('img.blur').length };
    render(); await wait(60); r.after = !!card().querySelector('figure.exam img.blur');
    document.querySelector('[data-cn3blur="08_1번적중:0"]').click(); await wait(100);
    r.back = document.querySelectorAll('#cn-cards .cn2.pick img.blur').length; r.saved2 = ((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).blur || {})['08_1번적중'];
    return r; });
  t('「흐리게」 → 1번 카드 시험 문항만 흐리게(data-blur) · exam_hit_<시험>.card.blur 저장 · 다시 그려도 남음 · 「선명」 → 원래대로', o11.ex && !o11.mat && o11.saved === true && o11.chip && o11.other === 0 && o11.after && o11.back === 0 && o11.saved2 === undefined, JSON.stringify(o11));

  /* 12) 🧩 모자이크 창 — 상자 그리기 → 저장(0~1 비율) → 카드 그림 = 모자이크 data:image/png · 되돌리기 · 모두 지우기 */
  const o12 = await pg.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
    /* 원본과 비교: 상자 안은 색 가짓수가 줄고(네모 칸), 상자 밖은 그대로 */
    const cmp = async (a, b, q) => { const A = await load(a), B = await load(b); const W = A.naturalWidth, H = A.naturalHeight;
      const px = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
      const da = px(A), db = px(B); const col = (d, x, y) => { const i = (y * W + x) * 4; return d[i] + ',' + d[i + 1] + ',' + d[i + 2]; };
      const sa = new Set(), sb = new Set(); const x0 = Math.round((q.x + q.w * 0.25) * W), y0 = Math.round((q.y + q.h * 0.25) * H), x1 = Math.round((q.x + q.w * 0.75) * W), y1 = Math.round((q.y + q.h * 0.75) * H);
      let chg = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sa.add(col(da, x, y)); sb.add(col(db, x, y)); n++; if (col(da, x, y) !== col(db, x, y)) chg++; }
      let same = 0, tot = 0; for (let y = Math.round(H * 0.9); y < H; y++) for (let x = Math.round(W * 0.9); x < W; x++) { tot++; if (col(da, x, y) === col(db, x, y)) same++; }
      /* 한 칸(1/40 폭) 안은 한 색 */
      const blk = Math.max(2, Math.round(W / 40)); const bx = Math.ceil(q.x * W) + blk, by = Math.ceil(q.y * H) + blk; const one = new Set(); for (let y = by + 1; y < by + blk - 1; y++) for (let x = bx + 1; x < bx + blk - 1; x++) one.add(col(db, x, y));
      return { W, H, inA: sa.size, inB: sb.size, chg: Math.round(chg / Math.max(1, n) * 100) / 100, outSame: same === tot, oneBlock: one.size }; };
    const r = {};
    document.querySelector('[data-cn3mz="08_1번적중"]').click(); await wait(300);
    r.open = !!document.getElementById('cn3-mz'); r.tabs = [...document.querySelectorAll('[data-cn3tab]')].map((b) => b.textContent.replace(/ \(\d+\)/, '')); r.which = CN3.mz.which; r.warn = !!document.getElementById('cn3-warn');
    r.btns = ['cn3-undo', 'cn3-clear', 'cn3-save', 'cn3-close'].map((id) => (document.getElementById(id) || {}).textContent);
    const cv = document.getElementById('cn3-cv'); r.cv = [cv.width, cv.height]; r.cvCss = [cv.getBoundingClientRect().width, cv.getBoundingClientRect().height];
    /* 끌어서 상자 그리기 (마우스 흉내) */
    const b = cv.getBoundingClientRect(); const ev = (type, fx, fy) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: b.left + b.width * fx, clientY: b.top + b.height * fy, pointerId: 1 }));
    ev('pointerdown', 0.1, 0.1); ev('pointermove', 0.3, 0.3); ev('pointermove', 0.6, 0.5); ev('pointerup', 0.6, 0.5);
    r.drag = JSON.stringify(CN3.mz.rects.exam);
    document.getElementById('cn3-save').click(); await wait(400);
    const st = () => ((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).mosaic || {})['08_1번적중'];
    r.saved1 = JSON.stringify(st());
    const exImg = () => document.querySelector('#cn-cards .cn2.pick figure.exam img'), matImg = () => document.querySelector('#cn-cards .cn2.pick figure.mat img');
    r.exSrc = exImg().getAttribute('src'); r.exPng = /^data:image\/png;base64,/.test(r.exSrc) && r.exSrc !== IMG0.exam; r.exCache = Object.values(CN3.mzCache).indexOf(r.exSrc) >= 0;
    r.exCmp = await cmp(IMG0.exam, r.exSrc, st().exam[0]);
    r.chip = (document.querySelector('[data-cn3mz="08_1번적중"]') || {}).textContent;
    /* 우리 자료 탭 — 상자 2개 → 되돌리기 → 1개 */
    await cn3MzTab('mat'); await wait(150); r.which2 = CN3.mz.which;
    cn3MzAdd(0, 0, 0.5, 0.5); cn3MzAdd(0.5, 0.5, 0.3, 0.3); r.nMat = CN3.mz.rects.mat.length;
    document.getElementById('cn3-undo').click(); r.nUndo = CN3.mz.rects.mat.length; r.dirty = /저장 안 됨/.test(document.getElementById('cn3-mz').textContent);
    document.getElementById('cn3-save').click(); await wait(400);
    r.saved2 = JSON.stringify(st());
    r.matSrc = matImg().getAttribute('src'); r.matPng = /^data:image\/png;base64,/.test(r.matSrc) && r.matSrc !== IMG0.mat;
    r.matCmp = await cmp(IMG0.mat, r.matSrc, st().mat[0]);
    /* 시험 문항 탭 — 모두 지우기 → 원래 그림 */
    await cn3MzTab('exam'); await wait(150);
    document.getElementById('cn3-clear').click(); r.nClear = CN3.mz.rects.exam.length;
    document.getElementById('cn3-save').click(); await wait(400);
    r.saved3 = JSON.stringify(st()); r.exBack = exImg().getAttribute('src') === IMG0.exam; r.matStill = matImg().getAttribute('src') === r.matSrc;
    document.getElementById('cn3-close').click(); r.closed = !document.getElementById('cn3-mz');
    return r; });
  t('🧩 모자이크 창: 탭 「시험 문항 / 우리 자료」 · 단추 4개 · 그림 원래 크기 캔버스(화면에 맞춰 줄임) · 경고 없음', o12.open && o12.tabs.join('|') === '시험 문항|우리 자료' && o12.which === 'exam' && !o12.warn && o12.btns.join('|') === '되돌리기(마지막 상자)|모두 지우기|저장|닫기' && o12.cv.join('x') === '240x300' && o12.cvCss[0] > 100, JSON.stringify([o12.tabs, o12.which, o12.btns, o12.cv, o12.cvCss]));
  t('끌어서 상자 → 저장 → card.mosaic["08_1번적중"].exam = [{x:.1,y:.1,w:.5,h:.4}] (0~1 비율) · 칩 「🧩 모자이크 1」', o12.drag === '[{"x":0.1,"y":0.1,"w":0.5,"h":0.4}]' && o12.saved1 === '{"exam":[{"x":0.1,"y":0.1,"w":0.5,"h":0.4}]}' && /🧩 모자이크 1/.test(o12.chip), JSON.stringify([o12.drag, o12.saved1, o12.chip]));
  t('시험 문항 카드 그림 = 모자이크 data:image/png (상자 안 절반 넘게 바뀜 · 한 칸 한 색 · 상자 밖 그대로)', o12.exPng && o12.exCache && o12.exCmp.chg > 0.5 && o12.exCmp.oneBlock === 1 && o12.exCmp.outSame, JSON.stringify(o12.exCmp));
  t('우리 자료 탭: 상자 2개 → 「되돌리기」 → 1개 · 저장 → mat 저장 · 카드 그림 모자이크', o12.which2 === 'mat' && o12.nMat === 2 && o12.nUndo === 1 && o12.dirty && o12.saved2 === '{"exam":[{"x":0.1,"y":0.1,"w":0.5,"h":0.4}],"mat":[{"x":0,"y":0,"w":0.5,"h":0.5}]}' && o12.matPng && o12.matCmp.chg > 0.5 && o12.matCmp.oneBlock === 1 && o12.matCmp.outSame, JSON.stringify([o12.nMat, o12.nUndo, o12.saved2, o12.matCmp]));
  t('시험 문항 탭 「모두 지우기」 → 저장 → 원래 그림(src = 원본) · 우리 자료 모자이크는 남음 · 「닫기」', o12.nClear === 0 && o12.saved3 === '{"mat":[{"x":0,"y":0,"w":0.5,"h":0.5}]}' && o12.exBack && o12.matStill && o12.closed, JSON.stringify([o12.saved3, o12.exBack, o12.matStill, o12.closed]));

  /* 13) CORS 로 읽을 수 없는 그림(2번 카드 우리 자료 = file://) → 창에 경고 · 카드는 원본 그대로 */
  const o13 = await pg.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-cn3mz="09_2번적중"]').click(); await wait(500);
    const r = { which: CN3.mz && CN3.mz.which, examOff: !!document.querySelector('[data-cn3tab="exam"][disabled]'), warn: ((document.getElementById('cn3-warn') || {}).textContent || ''), im: !!(CN3.mz && CN3.mz.im) };
    cn3MzAdd(0.2, 0.2, 0.4, 0.4); document.getElementById('cn3-save').click(); await wait(500);
    const img = [...document.querySelectorAll('#cn-cards .cn2.pick')][1].querySelector('figure.mat img');
    r.src = img.getAttribute('src'); r.saved = JSON.stringify((((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).mosaic || {})['09_2번적중']));
    document.getElementById('cn3-clear').click(); document.getElementById('cn3-save').click(); await wait(200); document.getElementById('cn3-close').click();
    r.after = JSON.stringify((((T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).mosaic || {})['09_2번적중']));
    return r; });
  t('CORS 없는 그림 → 창에 「이 그림은 모자이크를 적용할 수 없습니다 (원본 서버 설정)」 · 카드는 원본 그대로 · 시험 그림 없으면 탭 꺼짐', o13.which === 'mat' && o13.examOff && /이 그림은 모자이크를 적용할 수 없습니다 \(원본 서버 설정\)/.test(o13.warn) && o13.im && o13.src === NOCORS_URL && o13.saved === '{"mat":[{"x":0.2,"y":0.2,"w":0.4,"h":0.4}]}' && o13.after === undefined, JSON.stringify(o13));

  /* 모자이크 그림 — 1번 카드 시험 문항에 상자(식 부분)를 다시 넣고 카드 한 장 찍기 */
  await pg.evaluate(async () => { document.querySelector('[data-cn3mz="08_1번적중"]').click(); await new Promise((r) => setTimeout(r, 300));
    cn3MzAdd(0.08, 0.36, 0.62, 0.22); document.getElementById('cn3-save').click(); await new Promise((r) => setTimeout(r, 400)); });
  await pg.locator('#cn3-mz .cn3-mzin').screenshot({ path: SP + '/v19101_modal.png' }).catch((e) => console.log('그림 실패', e.message));
  await pg.evaluate(() => document.getElementById('cn3-close').click());
  await settle(200);
  const o14 = await pg.evaluate(() => { const c = [...document.querySelectorAll('#cn-cards .cn2.pick')][0]; c.scrollIntoView(); return { ex: /^data:image\/png/.test(c.querySelector('figure.exam img').getAttribute('src')) && c.querySelector('figure.exam img').getAttribute('src') !== IMG0.exam, mat: c.querySelector('figure.mat img').getAttribute('src') !== IMG0.mat }; });
  await shotCard('v19101_mosaic.png');
  t('1번 카드: 시험 문항 · 우리 자료 둘 다 모자이크 그림 ($SP/v19101_mosaic.png)', o14.ex && o14.mat, JSON.stringify(o14));

  /* 8) 내려받기 — html2canvas · JSZip 가짜로 기록 */
  const dl = (size) => pg.evaluate(async (size) => {
    window.html2canvas = (el, opt) => { T.h2c.push({ cls: el.className, w: opt.width, h: opt.height, cors: opt.useCORS, bg: el.querySelectorAll('img.bgimg').length, fam: getComputedStyle(el.querySelector('.ttl')).fontFamily, fh: el.getBoundingClientRect().height, pk: [...el.querySelectorAll('.pk2 img')].map((i) => i.getAttribute('src') || '') }); return Promise.resolve({ toBlob: (cb) => cb(new Blob(['png'], { type: 'image/png' })) }); };
    window.JSZip = function () { this.names = []; this.md = ''; T.zips.push(this); };
    JSZip.prototype.file = function (n, b) { this.names.push(n); if (/\.md$/.test(n)) this.md = b; };
    JSZip.prototype.generateAsync = function () { return Promise.resolve(new Blob(['zip'])); };
    if (size) cn2Set('size', size);
    const h0 = T.h2c.length; await cnExport(); await new Promise((r) => setTimeout(r, 100));
    const z = T.zips[T.zips.length - 1]; const calls = T.h2c.slice(h0);
    return { n: calls.length, names: z ? z.names : [], md: z ? z.md : '', calls: calls.slice(0, 2), allW: calls.every((c) => c.w === 1080), hs: [...new Set(calls.map((c) => c.h))], cls: calls.every((c) => /\bcn2\b/.test(c.cls)), cors: calls.every((c) => c.cors), cards: cn2Cards(HT.data[HT.cur]).length, toast: T.toasts.slice(-1)[0], exp: !!cnCfg(HT.data[HT.cur]).exportedAt, fh: [...new Set(calls.map((c) => Math.round(c.fh)))], pk: calls.map((c) => c.pk || []), mz: Object.values(CN3.mzCache).filter((v) => /^data:/.test(v)), mzCard: [...document.querySelectorAll('#cn-cards .cn2.pick')][0].querySelector('figure.exam img').getAttribute('src') };
  }, size);
  await pg.evaluate(() => { const d = HT.data[HT.cur]; cn2BgAll('bgA'); });
  const d1 = await dl('');
  t('내려받기(4:5): 카드 수만큼 PNG + 블로그자료.md · 1080×1350 · useCORS · .cn2 · 배경 그림 포함', d1.n === d1.cards && d1.names.length === d1.cards + 1 && d1.names.filter((x) => /\.png$/.test(x)).length === d1.cards && d1.names.indexOf('블로그자료.md') >= 0 && d1.allW && JSON.stringify(d1.hs) === '[1350]' && JSON.stringify(d1.fh) === '[1350]' && d1.cls && d1.cors && d1.calls[0].bg === 1, JSON.stringify([d1.n, d1.names.length, d1.hs, d1.fh, d1.calls[0]]));
  t('블로그자료.md = 그대로 + 「카드 스타일: 새 스타일」 한 줄 · 「수학비서」 없음 · 글꼴', /> - 카드 스타일: 새 스타일\(디자인 2판\) · 제목 글꼴 굵은 글꼴\(Black Han Sans\) · 1080×1350/.test(d1.md) && /## 카드 01 \(그림: 01_표지\.png\)/.test(d1.md) && d1.md.indexOf('수학비서') < 0 && /Black Han Sans/.test(d1.calls[0].fam) && d1.exp, d1.md.slice(0, 400));
  t('내려받기에도 모자이크 그림 — 1번 카드 PNG 의 시험 문항 그림 = 화면 카드의 모자이크 그림', d1.pk.some((a) => a.indexOf(d1.mzCard) >= 0) && /^data:image\/png/.test(d1.mzCard) && d1.mz.indexOf(d1.mzCard) >= 0, JSON.stringify(d1.pk.map((a) => a.map((x) => x.slice(0, 30) + '…' + x.length))));
  const d2 = await dl('11');
  t('내려받기(1:1): 1080×1080', d2.n === d2.cards && JSON.stringify(d2.hs) === '[1080]' && JSON.stringify(d2.fh) === '[1080]' && /1080×1080/.test(d2.md), JSON.stringify([d2.hs, d2.fh]));
  await pg.evaluate(() => cn2Set('size', '45'));
  const d3 = await pg.evaluate(async () => { cn2Set('style', 'v1'); const h0 = T.h2c.length; await cnExport(); await new Promise((r) => setTimeout(r, 100)); const calls = T.h2c.slice(h0); const z = T.zips[T.zips.length - 1]; cn2Set('style', 'v2');
    return { n: calls.length, old: calls.every((c) => / ?cn( |$)/.test(c.cls) && !/cn2/.test(c.cls)), hs: [...new Set(calls.map((c) => c.h))], md: /카드 스타일/.test(z.md) }; });
  t('지금 스타일 내려받기는 예전 그대로(.cn · 1350 · md 에 스타일 줄 없음)', d3.n >= 12 && d3.old && JSON.stringify(d3.hs) === '[1350]' && !d3.md, JSON.stringify(d3));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
