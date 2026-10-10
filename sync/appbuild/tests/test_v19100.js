#!/usr/bin/env node
/* 학원앱 v19-100 검사 — 📰 카드뉴스 «디자인 2판»(새 스타일 · 글꼴 · 1:1) + 🖼 배경함(올리기 · Gemini) (가짜 서버 · 외부망 차단)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19100.js lumen_v19-100.html
 *   그림: $SP/v19100_cards.png (데스크톱 카드 목록) · $SP/v19100_phone.png (카드 3장을 폰 너비 360px 로)
 *   가짜 자료: test_v1999 의 범박고 고2 시험(5문항 · 네 종류 자료 적중)을 조금 늘림 · 배경함 2장(색 1번).
 *   학생 실명·실제 점수 없음. Gemini · Storage 는 가짜로 기록만. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-100.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-100'])[0];
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
  await pg.evaluate((STORE) => {
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
  }, STORE);
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
  t('카드 글에 「수학비서」·학생 이름 없음 · 자료는 종류만 · 마지막 카드 「루멘수학」', o1.text.indexOf('수학비서') < 0 && o1.text.indexOf('○○○') < 0 && /교과서/.test(o1.text) && /학원 학습지/.test(o1.text) && /학원 프린트/.test(o1.text) && /매쓰플랫 학습지·교재/.test(o1.text) && /— 루멘수학/.test(o1.text), '');
  t('그래프 카드에 큰 숫자 하나 (적중 %)', /적중 <\/small>67%|적중 67%/.test(o1.html.replace(/<small>/g, '')) || /67%/.test(o1.text), '');
  t('문항 카드: 흰 패널 안에 흐린 시험 그림 + 큰 번호', await pg.evaluate(() => { const c = [...document.querySelectorAll('#cn-cards .cn2.pick')]; return c.length === 4 && !!c[0].querySelector('.list .pk img.blur[data-blur]') && c[0].querySelector('.pk .no b').textContent === '1'; }), '');
  await pg.screenshot({ path: SP + '/v19100_cards.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('cn-panel').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: Math.min(2600, r.height) }; }) }).catch((e) => console.log('그림 실패', e.message));

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
  await pg.screenshot({ path: SP + '/v19100_phone.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('cn2-phone').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: Math.min(r.width, 1120), height: 480 }; }) }).catch((e) => console.log('그림 실패', e.message));
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

  /* 8) 내려받기 — html2canvas · JSZip 가짜로 기록 */
  const dl = (size) => pg.evaluate(async (size) => {
    window.html2canvas = (el, opt) => { T.h2c.push({ cls: el.className, w: opt.width, h: opt.height, cors: opt.useCORS, bg: el.querySelectorAll('img.bgimg').length, fam: getComputedStyle(el.querySelector('.ttl')).fontFamily, fh: el.getBoundingClientRect().height }); return Promise.resolve({ toBlob: (cb) => cb(new Blob(['png'], { type: 'image/png' })) }); };
    window.JSZip = function () { this.names = []; this.md = ''; T.zips.push(this); };
    JSZip.prototype.file = function (n, b) { this.names.push(n); if (/\.md$/.test(n)) this.md = b; };
    JSZip.prototype.generateAsync = function () { return Promise.resolve(new Blob(['zip'])); };
    if (size) cn2Set('size', size);
    const h0 = T.h2c.length; await cnExport(); await new Promise((r) => setTimeout(r, 100));
    const z = T.zips[T.zips.length - 1]; const calls = T.h2c.slice(h0);
    return { n: calls.length, names: z ? z.names : [], md: z ? z.md : '', calls: calls.slice(0, 2), allW: calls.every((c) => c.w === 1080), hs: [...new Set(calls.map((c) => c.h))], cls: calls.every((c) => /\bcn2\b/.test(c.cls)), cors: calls.every((c) => c.cors), cards: cn2Cards(HT.data[HT.cur]).length, toast: T.toasts.slice(-1)[0], exp: !!cnCfg(HT.data[HT.cur]).exportedAt, fh: [...new Set(calls.map((c) => Math.round(c.fh)))] };
  }, size);
  await pg.evaluate(() => { const d = HT.data[HT.cur]; cn2BgAll('bgA'); });
  const d1 = await dl('');
  t('내려받기(4:5): 카드 수만큼 PNG + 블로그자료.md · 1080×1350 · useCORS · .cn2 · 배경 그림 포함', d1.n === d1.cards && d1.names.length === d1.cards + 1 && d1.names.filter((x) => /\.png$/.test(x)).length === d1.cards && d1.names.indexOf('블로그자료.md') >= 0 && d1.allW && JSON.stringify(d1.hs) === '[1350]' && JSON.stringify(d1.fh) === '[1350]' && d1.cls && d1.cors && d1.calls[0].bg === 1, JSON.stringify([d1.n, d1.names.length, d1.hs, d1.fh, d1.calls[0]]));
  t('블로그자료.md = 그대로 + 「카드 스타일: 새 스타일」 한 줄 · 「수학비서」 없음 · 글꼴', /> - 카드 스타일: 새 스타일\(디자인 2판\) · 제목 글꼴 굵은 글꼴\(Black Han Sans\) · 1080×1350/.test(d1.md) && /## 카드 01 \(그림: 01_표지\.png\)/.test(d1.md) && d1.md.indexOf('수학비서') < 0 && /Black Han Sans/.test(d1.calls[0].fam) && d1.exp, d1.md.slice(0, 400));
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
