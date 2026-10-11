#!/usr/bin/env node
/* 학원앱 v19-102 검사 — 📰 카드뉴스 블로그 브랜드 통일 + 「⬇ 블로그 폴더로 내려받기」 (원장 지시 2026-10-11 「v19-102 먼저 만들어 배포, 12색은 사용해보고 결정」)
 *   ① 브랜드 한 곳: CN_BRAND(_base.css 에서 조립 때 읽음) · 색 칩 맨 앞 브랜드 둘 · 새 시험 기본 = 브랜드 붉은 바탕 · 12색 그대로
 *     · 모든 새 스타일 카드 꼬리말 = 로고 + 「루멘수학」 + n / N · 기본 글꼴 칩 = Pretendard · 「기출」 없음 · 반복 출제 = 유형 이름만
 *   ② 블로그 폴더 zip: blog/<날짜>-<학교학년>-exam/ · cards/NN_종류.png · cards.json(external) · source.md · post_draft.md(AI 있을 때) · README.txt
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19102.js lumen_v19-102.html
 *   (선택) PRET=<Pretendard 폴더: pretendard.css + woff2/> 를 주면 그림에 진짜 Pretendard 가 들어간다 — 없으면 대체 글꼴
 *   그림: $SP/v19102_brand.png (브랜드 카드 3장 · 폰 너비 360px)
 *   그림은 모두 data: 주소(외부망 없음). 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-102.html');
const SP = process.env.SP || '/tmp';
const PRET = process.env.PRET || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-102'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고2_2026_2_중간';
const STORE = { exam_hit_index: { items: [{ examId: EID, school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', total: 6, at: '2026-10-10T12:00:00Z' }] } };
/* card 에 pal 이 없다 = 아직 색을 고르지 않은 새 시험 */
STORE['exam_hit_' + EID] = { examId: EID, exam: { school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', date: '2026-10-07' }, basis: 'same+var',
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
  card: { wm: true, picks: [1, 2, 4, 5], killers: [4, 5] } };
const BAN = /매쓰플랫|수학비서/;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  /* 외부망 차단 — PRET 가 있으면 Pretendard CSS·글꼴만 이 PC 파일로 대신 준다 */
  await pg.route(/^https:\/\//, (r) => {
    const u = r.request().url();
    if (PRET && /cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@v1\.3\.9\/dist\/web\/static\/pretendard\.min\.css/.test(u)) return r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(PRET, 'pretendard.css')), headers: { 'Access-Control-Allow-Origin': '*' } });
    const m = PRET && /pretendard@v1\.3\.9\/dist\/web\/static\/woff2\/(Pretendard-[A-Za-z]+\.woff2)/.exec(u);
    if (m && fs.existsSync(path.join(PRET, 'woff2', m[1]))) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(PRET, 'woff2', m[1])), headers: { 'Access-Control-Allow-Origin': '*' } });
    return r.abort();
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE }) => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const mk = (a, b) => { const c = document.createElement('canvas'); c.width = 216; c.height = 270; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 216, 270); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 216, 270); return c.toDataURL('image/png'); };
    const mkQ = (txt, bg) => { const c = document.createElement('canvas'); c.width = 300; c.height = 260; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 300, 260); g.fillStyle = '#111'; g.font = 'bold 30px sans-serif'; g.fillText(txt, 20, 70); g.font = '20px sans-serif'; g.fillText('(1) ______  (2) ______', 20, 140); return c.toDataURL('image/png'); };
    const store = clone(STORE);
    store.cn_bg_index = { updated: '2026-10-10T00:00:00Z', items: [{ id: 'bgA', pal: 1, url: mk('#2a7a5c', '#06231b'), path: 'cardbg/1/bgA.png', src: 'upload', at: '2026-10-10T00:00:00Z', note: '시험용' }] };
    const ex = store['exam_hit_범박고_고2_2026_2_중간'];
    ex.items[0].imgUrl = mkQ('lim (x² − 1)', '#ffffff'); ex.mats['tb:4'].img = mkQ('lim (x² + 3)', '#fff7ed');
    ex.items[1].imgUrl = mkQ('f(x) 연속', '#ffffff'); ex.items[3].imgUrl = mkQ("f'(x) = ?", '#ffffff'); ex.items[4].imgUrl = mkQ('y = 2x + 1', '#ffffff');
    window.T = { store, upserts: [], toasts: [], h2c: [], zips: [], ai: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({ eq: (k, v) => Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: (b) => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://example.invalid/' + p } }), remove: (a) => Promise.resolve({ data: a, error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.confirm = () => true;
    const of = window.fetch.bind(window);
    window.fetch = (url, opt) => { const u = String(url); if (/^data:/.test(u)) return of(url, opt); return Promise.reject(new Error('외부망 차단')); };
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1440px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    try { localStorage.removeItem('cn_style'); localStorage.removeItem('cn_size'); localStorage.removeItem('or_gemini_key'); localStorage.removeItem('or_api_key'); } catch (e) {}
    geminiKey = ''; try { apiKey = ''; } catch (e) {}
    VIEW = 'examhit'; HT.kicked = true; HT.idx = clone(store.exam_hit_index); HT.req = { status: 'done' }; HT.cur = '범박고_고2_2026_2_중간';
    htLoad(HT.cur, true); CN.open = true;
  }, { STORE });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  await settle(200); await pg.evaluate(() => render()); await settle(250); await pg.evaluate(() => render()); await settle(150);

  /* 카드 재기 (test_v19100 과 같은 잣대) */
  const measure = () => pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#cn-cards .cn2')];
    const pct = (el, w) => parseFloat(getComputedStyle(el).fontSize) / w * 100;
    let minF = 99, minAt = ''; const over = [], overlap = [], ttlLines = [];
    cards.forEach((c, ci) => {
      const w = c.clientWidth, cr = c.getBoundingClientRect();
      c.querySelectorAll('*').forEach((el) => { if (el.closest('svg') || el.closest('.wmk')) return;
        const has = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!has) return;
        const f = pct(el, w); if (f < minF) { minF = f; minAt = ci + ':' + el.className + ':' + el.textContent.slice(0, 12); } });
      const foot = c.querySelector('.foot').getBoundingClientRect(); if (foot.bottom > cr.bottom + 1) over.push(ci + 1);
      const up = c.querySelector('.viz') || c.querySelector('.kw') || c.querySelector('.ttl'); const lt = c.querySelector('.list').getBoundingClientRect();
      if (up.getBoundingClientRect().bottom > lt.top + 4) overlap.push(ci + 1);
      const tt = c.querySelector('.ttl'); ttlLines.push(Math.round(tt.getBoundingClientRect().height / parseFloat(getComputedStyle(tt).lineHeight)));
    });
    return { n: cards.length, minF, minAt, over, overlap, ttlLines };
  });
  /* 카드 글자 + 꼬리말 */
  const cardInfo = () => pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#cn-cards .cn2')], N = cards.length, wrap = document.querySelector('#cn-cards .cn2-wrap');
    const foots = cards.map((c, i) => { const f = c.querySelector('.foot'), dot = f && f.querySelector('.cn4dot');
      return { txt: f ? f.textContent.replace(/\s+/g, ' ').trim() : '', logo: dot ? getComputedStyle(dot).backgroundImage : '', want: '루멘수학' + (i + 1) + ' / ' + N, fs: f ? parseFloat(getComputedStyle(f).fontSize) / c.clientWidth * 100 : 0 }; });
    return { N, cls: wrap ? wrap.className : '', style: wrap ? wrap.getAttribute('style') : '', text: cards.map((c) => c.textContent).join('\n'), foots,
      ttlFam: cards[0] ? getComputedStyle(cards[0].querySelector('.ttl')).fontFamily : '', ttlW: cards[0] ? getComputedStyle(cards[0].querySelector('.ttl')).fontWeight : '',
      ttlStroke: cards[0] ? getComputedStyle(cards[0].querySelector('.ttl')).webkitTextStrokeWidth : '', ttlShadow: cards[0] ? getComputedStyle(cards[0].querySelector('.ttl')).textShadow : '' };
  });

  /* 1) 버전 · CN_BRAND · Pretendard <link> · 블로그 규칙 */
  const o1 = await pg.evaluate(() => ({ ver: APP_VER, b: window.CN_BRAND || null, rules: String(window.CN_BLOG_RULES || ''),
    link: !!document.querySelector('head link[rel="stylesheet"][href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"]') }));
  t('버전 ' + WANT, o1.ver === WANT, o1.ver);
  t('CN_BRAND (조립 때 _base.css 에서) — 붉은색 #c03f3f · 토큰 9개 · 로고 data:image/png', !!o1.b && o1.b.tokens.red === '#c03f3f' && o1.b.tokens.redDeep === '#8d2c2c' && o1.b.tokens.yellow === '#fdc108' && o1.b.tokens.navy === '#073756' && Object.keys(o1.b.tokens).length === 9 && /^data:image\/png;base64,[A-Za-z0-9+/=]{1000,}$/.test(o1.b.logo) && o1.b.font === 'Pretendard', JSON.stringify(o1.b && o1.b.tokens));
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'card_templates', '_base.css'), 'utf8');
  t('CN_BRAND 로고 = _base.css .footer .dot 그림과 같음', !!o1.b && css.indexOf(o1.b.logo) > 0, '');
  t('앱 머리에 Pretendard <link> (jsdelivr pretendard@v1.3.9)', o1.link, '');
  t('CN_BLOG_RULES = lumen_blog_profile.md 의 말투(4-2)·뼈대(4-3)·쓰지 않는 말(5)·규격(6)·해시태그(7)', /### 4-2\./.test(o1.rules) && /### 4-3\./.test(o1.rules) && /## 5\. 쓰지 않는 말/.test(o1.rules) && /## 6\. 글 한 편의 규격/.test(o1.rules) && /## 7\. 해시태그/.test(o1.rules) && !/### 브랜드 색/.test(o1.rules) && !/## 2\. 교습비/.test(o1.rules), o1.rules.length + '자');

  /* 2) 색 칩 — 브랜드 둘이 맨 앞 · 새 시험 기본 = 브랜드 붉은 바탕 */
  const o2 = await pg.evaluate(() => { const d = HT.data[HT.cur]; const bt = [...document.querySelectorAll('#cn-panel .cn-pal button')];
    const fresh = JSON.parse(JSON.stringify(d)); delete fresh.card; const fr = cnCfg(fresh);
    return { keys: bt.map((b) => b.getAttribute('data-cn4pal')), on: bt.filter((b) => b.classList.contains('on')).map((b) => b.getAttribute('data-cn4pal')), lab: bt.slice(0, 3).map((b) => b.textContent),
      pal: cnCfg(d).pal, fresh: fr.pal, pal2: CN_PAL2.length, pname: cn2Pal('br').n + '|' + cn2Pal('bi').n }; });
  t('색 칩 14개: 「★ 브랜드 · 붉은 바탕」「★ 브랜드 · 아이보리」 맨 앞 → 12색(1~12) 그대로 · CN_PAL2 12개', JSON.stringify(o2.keys) === JSON.stringify(['br', 'bi', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']) && /브랜드 · 붉은 바탕/.test(o2.lab[0]) && /브랜드 · 아이보리/.test(o2.lab[1]) && /^1\. 미드나잇 블루/.test(o2.lab[2]) && o2.pal2 === 12, JSON.stringify([o2.keys, o2.lab]));
  t('새 시험(색을 고른 적 없음) 기본 = 브랜드 붉은 바탕 (pal "br") · 칩 켜짐', o2.pal === 'br' && o2.fresh === 'br' && JSON.stringify(o2.on) === '["br"]', JSON.stringify(o2));

  /* 3) 기본 글꼴 = 브랜드 글꼴(Pretendard) · 붉은 바탕 카드 */
  const o3 = await pg.evaluate(() => ({ font: CN.font, chip: !!document.querySelector('[data-cn2="font:pre"].on'), chips: [...document.querySelectorAll('[data-cn2^="font:"]')].map((b) => b.getAttribute('data-cn2')), ls: localStorage.getItem('cn_font') }));
  const c3 = await cardInfo(); const m3 = await measure();
  t('기본 글꼴 칩 = 「브랜드 글꼴(Pretendard)」(맨 앞) · 굵은/부드러운 글꼴 칩도 그대로', o3.font === 'pre' && o3.chip && JSON.stringify(o3.chips) === '["font:pre","font:black","font:dohyeon"]' && o3.ls === 'pre', JSON.stringify(o3));
  t('제목 글꼴 Pretendard · 굵기 800 · 외곽선·그림자 그대로', /^"?Pretendard/.test(c3.ttlFam) && c3.ttlW === '800' && parseFloat(c3.ttlStroke) > 0 && c3.ttlShadow !== 'none', JSON.stringify([c3.ttlFam, c3.ttlW, c3.ttlStroke]));
  t('붉은 바탕: 카드 묶음 class pv-br · f-pre · 바탕색 = 브랜드 붉은색', /\bpv-br\b/.test(c3.cls) && /\bf-pre\b/.test(c3.cls) && /--b1:#c03f3f;--b2:#8d2c2c;--gd:#fdc108/.test(c3.style), c3.cls + ' | ' + c3.style);
  t('모든 카드 꼬리말 = 로고(data:image/png) + 「루멘수학」 + 쪽수 n / N · 꼬리말 글자 ≥2%', c3.N === 13 && c3.foots.every((f) => /data:image\/png/.test(f.logo) && f.txt.replace(/\s/g, '') === f.want.replace(/\s/g, '') && f.fs >= 1.99), JSON.stringify(c3.foots.slice(0, 2).map((f) => [f.txt, f.logo.slice(0, 30), f.fs])));
  t('붉은 바탕 4:5 — 글자 ≥2% · 꼬리말 카드 안 · 겹침 없음 · 제목 3줄 이하', m3.n === 13 && m3.minF >= 1.99 && !m3.over.length && !m3.overlap.length && m3.ttlLines.every((x) => x <= 3), JSON.stringify([m3.minF, m3.minAt, m3.over, m3.overlap, m3.ttlLines]));
  /* 「기출」 없음 · 반복 출제 = 유형 이름만(연도 없음) */
  const o4 = await pg.evaluate(() => { const v2 = cn2Cards(HT.data[HT.cur]); const txt = (h) => { const x = document.createElement('div'); x.innerHTML = h; return x.textContent; };
    const rep = v2.filter((c) => /_반복출제$/.test(c.file))[0]; const rx = document.createElement('div'); rx.innerHTML = rep.html;
    return { all: v2.map((c) => c.html).join('\n'), allTxt: v2.map((c) => txt(c.html)).join('\n'), repLi: [...rx.querySelectorAll('.li span')].map((s) => s.textContent), repTtl: rx.querySelector('.ttl').textContent, repSlogan: rx.querySelector('.slogan').textContent,
      pick1: txt(v2.filter((c) => /_1번적중$/.test(c.file))[0].html), picks: v2.filter((c) => /번적중$/.test(c.file)).map((c) => txt(c.html)),
      /* 연도 줄이 카드에 들어가는 경우(체크 줄 셋째) — 바꾸기 규칙만 따로 */
      fix: cn4YearLine('<b>2024·2025년</b> 기출에도') }; });
  t('새 스타일 카드 글·HTML 어디에도 「기출」 없음 (화면 카드 포함)', o4.all.indexOf('기출') < 0 && c3.text.indexOf('기출') < 0, (o4.allTxt.match(/.{0,12}기출.{0,12}/g) || []).join(' / '));
  t('반복 출제 카드 = 유형 이름만(번호·연도 없음) · 제목 「유형은 반복된다」 · 표어 「같은 학년 같은 시험의 출제 유형과 비교」', JSON.stringify(o4.repLi) === '["극한값 계산","도함수 계산"]' && /^유형은반복된다2문항$/.test(o4.repTtl.replace(/\s/g, '')) && /같은 학년 같은 시험의 출제 유형과 비교/.test(o4.repSlogan) && !/20\d\d|\(2\d/.test(o4.repLi.join('')), JSON.stringify([o4.repLi, o4.repTtl, o4.repSlogan]));
  t('문항 카드: 연도 없음(「2024·2025년 기출에도」 → 「지난 시험에도 나온 유형」) · 「시험 문항 1번」 이름표', o4.picks.every((x) => !/20\d\d년/.test(x)) && /시험 문항 1번/.test(o4.pick1) && o4.fix === '<b>지난 시험</b>에도 나온 유형', JSON.stringify([o4.fix, o4.pick1.slice(0, 120)]));
  t('카드 글에 「매쓰플랫」「수학비서」 없음', !BAN.test(o4.all) && !BAN.test(c3.text), '');

  /* 4) 1:1 크기도 붉은 바탕 + Pretendard 로 */
  await pg.evaluate(() => cn2Set('size', '11')); await settle(100);
  const m4 = await measure();
  t('붉은 바탕 1:1 — 글자 ≥2% · 꼬리말 카드 안 · 겹침 없음', m4.minF >= 1.99 && !m4.over.length && !m4.overlap.length, JSON.stringify([m4.minF, m4.minAt, m4.over, m4.overlap]));
  await pg.evaluate(() => cn2Set('size', '45')); await settle(80);

  /* 5) 아이보리 — 밝은 바탕 · 노랑 안 씀 · 진한 글자 */
  await pg.evaluate(() => document.querySelector('[data-cn4pal="bi"]').click()); await settle(150);
  const c5 = await cardInfo(); const m5 = await measure();
  const o5 = await pg.evaluate(() => { const cards = [...document.querySelectorAll('#cn-cards .cn2')]; const Y = 'rgb(253, 193, 8)'; let yellow = [];
    cards.forEach((c, ci) => { [c, ...c.querySelectorAll('*')].forEach((el) => { const cs = getComputedStyle(el); if (cs.display === 'none') return; if (cs.color === Y || cs.backgroundColor === Y) yellow.push(ci + ':' + el.className); }); });
    const c0 = cards[0]; return { saved: (T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).pal, yellow: yellow.slice(0, 5), ttl: getComputedStyle(c0.querySelector('.ttl')).color, li: getComputedStyle(c0.querySelector('.li span')).color, foot: getComputedStyle(c0.querySelector('.foot')).color }; });
  t('「★ 브랜드 · 아이보리」 → pal "bi" 저장 · class pv-bi · 바탕 아이보리 #f8f4ef', o5.saved === 'bi' && /\bpv-bi\b/.test(c5.cls) && /--b1:#f8f4ef/.test(c5.style), JSON.stringify([o5.saved, c5.cls]));
  t('아이보리: 노랑(#fdc108) 글자·바탕 없음 · 제목 진한 글자 #1c1414 · 꼬리말 로고 그대로', o5.yellow.length === 0 && o5.ttl === 'rgb(28, 20, 20)' && c5.foots.every((f) => /data:image\/png/.test(f.logo)), JSON.stringify([o5.yellow, o5.ttl]));
  t('아이보리 4:5 — 글자 ≥2% · 꼬리말 카드 안 · 겹침 없음 · 「기출」 없음', m5.minF >= 1.99 && !m5.over.length && !m5.overlap.length && c5.text.indexOf('기출') < 0, JSON.stringify([m5.minF, m5.minAt, m5.over, m5.overlap]));

  /* 6) 옛 12색으로 바꿔도 된다 (4. 차콜 오렌지) · 글꼴 칩 바꾸기 */
  await pg.evaluate(() => document.querySelector('[data-cn4pal="3"]').click()); await settle(150);
  const c6 = await cardInfo(); const m6 = await measure();
  const o6 = await pg.evaluate(() => ({ saved: (T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).pal, on: [...document.querySelectorAll('#cn-panel .cn-pal button.on')].map((b) => b.getAttribute('data-cn4pal')), b1: CN_PAL2[3].bg1, again: cnCfg(HT.data[HT.cur]).pal }));
  t('옛 색 「4. 차콜 오렌지」 → pal 3 저장 · 브랜드 class 없음 · 그 색 바탕 · 다시 읽어도 3 (이미 고른 색은 그대로)', o6.saved === 3 && o6.again === 3 && JSON.stringify(o6.on) === '["3"]' && !/pv-brand/.test(c6.cls) && c6.style.indexOf('--b1:' + o6.b1) === 0 && c6.N === 13, JSON.stringify([o6, c6.cls]));
  t('옛 색에서도 꼬리말 = 로고 + 루멘수학 + 쪽수 · 글자 ≥2% · 겹침 없음', c6.foots.every((f) => /data:image\/png/.test(f.logo) && f.txt.replace(/\s/g, '') === f.want.replace(/\s/g, '')) && m6.minF >= 1.99 && !m6.over.length && !m6.overlap.length, JSON.stringify([m6.minF, m6.over, m6.overlap]));
  await pg.evaluate(() => document.querySelector('[data-cn2="font:black"]').click()); await settle(80);
  const fBl = (await cardInfo()).ttlFam;
  await pg.evaluate(() => document.querySelector('[data-cn2="font:pre"]').click()); await settle(80);
  const fPr = await cardInfo();
  t('글꼴 칩: 굵은 글꼴 → Black Han Sans · 다시 브랜드 글꼴 → Pretendard (cn_font 기억)', /^"?Black Han Sans/.test(fBl) && /^"?Pretendard/.test(fPr.ttlFam) && (await pg.evaluate(() => localStorage.getItem('cn_font'))) === 'pre', JSON.stringify([fBl, fPr.ttlFam]));
  await pg.evaluate(() => document.querySelector('[data-cn4pal="br"]').click()); await settle(150);

  /* 7) 폰 너비 360px 브랜드 카드 3장 그림 — 표지(붉은 바탕) · 적중 결과(아이보리) · 문항 카드(붉은 바탕) */
  await pg.evaluate(() => { const d = HT.data[HT.cur], c = cnCfg(d); const host = document.createElement('div'); host.id = 'v102-shot';
    host.style.cssText = 'position:absolute;left:0;top:0;z-index:2147483000;background:#eef2f8;padding:12px;display:flex;gap:12px;align-items:flex-start';
    const one = (pal, file) => { c.pal = pal; const cards = cn2Cards(d); const x = cards.filter((k) => k.file === file)[0]; return '<div class="' + cn2WrapCls(c) + '" style="' + cn2PalVars(pal) + ';display:block;width:360px">' + x.html + '</div>'; };
    host.innerHTML = one('br', '01_표지') + one('bi', '05_적중결과') + one('br', '08_1번적중'); c.pal = 'br'; document.body.appendChild(host); });
  await settle(PRET ? 1500 : 300);
  const o7 = await pg.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} const cs = [...document.querySelectorAll('#v102-shot .cn2')]; return { n: cs.length, w: cs.map((c) => Math.round(c.clientWidth)), ttl: cs.map((c) => parseFloat(getComputedStyle(c.querySelector('.ttl')).fontSize)), li: cs.map((c) => parseFloat(getComputedStyle(c.querySelector('.li span')).fontSize)), pre: document.fonts.check('800 40px "Pretendard"', '루멘수학') }; });
  await pg.locator('#v102-shot').screenshot({ path: SP + '/v19102_brand.png' }).catch((e) => console.log('그림 실패', e.message));
  t('폰 너비 360px 브랜드 카드 3장 ($SP/v19102_brand.png) · 제목 ≥45px · 체크 줄 ≥13px' + (PRET ? (' · Pretendard 받음 ' + o7.pre) : ''), o7.n === 3 && o7.w.every((w) => w === 360) && o7.ttl.every((x) => x >= 44.9) && o7.li.every((x) => x >= 12.9), JSON.stringify(o7));
  await pg.evaluate(() => document.getElementById('v102-shot').remove());

  /* 8) 블로그 폴더로 내려받기 — html2canvas · JSZip 가짜로 기록 */
  const blog = (withAI) => pg.evaluate(async (withAI) => {
    window.html2canvas = (el, opt) => { T.h2c.push({ cls: el.className, wrap: el.parentElement.className, w: opt.width, h: opt.height, cors: opt.useCORS, pret: !!el.ownerDocument.querySelector('link[href*="pretendard@v1.3.9"]'), foot: el.querySelector('.foot').textContent, fam: getComputedStyle(el.querySelector('.ttl')).fontFamily });
      const c = document.createElement('canvas'); c.width = 4; c.height = 4; return Promise.resolve(c); };
    window.JSZip = function () { this.names = []; this.txt = {}; T.zips.push(this); };
    JSZip.prototype.file = function (n, b) { this.names.push(n); if (typeof b === 'string') this.txt[n] = b; };
    JSZip.prototype.generateAsync = function () { return Promise.resolve(new Blob(['zip'])); };
    if (withAI) window.callAI = async (p) => { T.ai.push(p); return '```markdown\n---\ntitle: 26년 범박고 2학년 2학기 중간 수학, 문항으로 본 시험 — 부천 옥길동 루멘수학\ndate: 2026-10-11\nrecruit: false\nhashtags: #범박고 #옥길동수학학원 #부천수학학원 #부천옥길동수학 #관리형수학학원 #루멘수학 #고등수학 #내신대비\n---\n10월 11일 일요일, 범박고 2학년 시험을 정리했습니다.\n\n6문항 중 4문항이 매쓰플랫 학습지와 겹쳤고 기출에서도 나왔습니다. 수학비서 자료도 봤습니다. 87명이 풀었습니다.\n\n[카드 1: 01_cover.png]\n\n경기도 부천시 소사구 옥길로 116 6층 618호\n```'; };
    const oc = HTMLAnchorElement.prototype.click; let dl = ''; HTMLAnchorElement.prototype.click = function () { dl = this.download; };
    const h0 = T.h2c.length; await cn4BlogExport(); await new Promise((r) => setTimeout(r, 100)); HTMLAnchorElement.prototype.click = oc;
    const z = T.zips[T.zips.length - 1]; const calls = T.h2c.slice(h0);
    return { names: z ? z.names : [], txt: z ? z.txt : {}, calls: calls.length, cards: cn2Cards(HT.data[HT.cur]).length, allW: calls.every((c) => c.w === 1080 && c.h === 1350 && c.cors), cls: calls.every((c) => /\bcn2\b/.test(c.cls) && /\bpv-br\b/.test(c.wrap) && /\bf-pre\b/.test(c.wrap)), pret: calls.every((c) => c.pret), foot: calls.map((c) => c.foot.replace(/\s/g, '')), dl, toast: T.toasts.slice(-1)[0] || '', ai: T.ai.slice(-1)[0] || '', btn: !!document.getElementById('cn4-blog'), btnTxt: (document.getElementById('cn4-blog') || {}).textContent, saved: !!(T.store['exam_hit_범박고_고2_2026_2_중간'].card || {}).blogAt };
  }, withAI);
  const b1 = await blog(false);
  const root = (b1.names[0] || '').replace(/cards\/.*$|[^/]*$/, '');
  const F = (n) => b1.txt[root + n] || '';
  const pngs = b1.names.filter((n) => /\.png$/.test(n)).map((n) => n.slice(root.length));
  const WANTF = ['cards/01_cover.png', 'cards/02_difficulty_flow.png', 'cards/03_units.png', 'cards/04_difficulty.png', 'cards/05_hit_result.png', 'cards/06_hit_map.png', 'cards/07_by_source.png', 'cards/08_q01.png', 'cards/09_q02.png', 'cards/10_q04.png', 'cards/11_q05.png', 'cards/12_repeat.png', 'cards/13_summary.png'];
  let cj = null; try { cj = JSON.parse(F('cards.json')); } catch (e) {}
  t('「⬇ 블로그 폴더로 내려받기」 단추 (기존 내려받기 옆)', b1.btn && /블로그 폴더로 내려받기/.test(b1.btnTxt), b1.btnTxt);
  t('zip 안 폴더 = blog/<YYYY-MM-DD>-beombak-g2-exam/ (오늘 한국 날짜) · zip 이름도 같음', /^blog\/\d{4}-\d{2}-\d{2}-[a-z]+-[mg]\d-exam\/$/.test(root) && /-beombak-g2-exam\/$/.test(root) && b1.dl === root.slice(5, -1) + '.zip' && root.slice(5, 15) === new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), JSON.stringify([root, b1.dl]));
  t('카드 PNG 13장 = cards/01_cover … 13_summary (문항 카드 qNN · 순서 = 새 스타일 카드)', JSON.stringify(pngs) === JSON.stringify(WANTF) && b1.calls === b1.cards, JSON.stringify(pngs));
  t('그리기: 1080×1350 · useCORS · 붉은 바탕 + Pretendard · 그리는 틀에 Pretendard <link> · 꼬리말 로고+쪽수', b1.allW && b1.cls && b1.pret && b1.foot[0] === '루멘수학1/13' && b1.foot[12] === '루멘수학13/13', JSON.stringify([b1.allW, b1.cls, b1.pret, b1.foot.slice(0, 2)]));
  t('cards.json — 모두 type external · file = PNG 이름 그대로 · note 한 줄 · _설명(학원앱 적중 분석 · 시험 정보 · 학생 이름 없음)', !!cj && cj.cards.length === 13 && cj.cards.every((c, i) => c.type === 'external' && c.file === WANTF[i].slice(6) && c.note && c.note.indexOf('\n') < 0) && /적중 분석/.test(cj['_설명']) && /범박고 2학년 · 2026년 · 2학기 · 중간고사/.test(cj['_설명']) && !/AAA111|BBB222/.test(JSON.stringify(cj)), cj ? JSON.stringify(cj.cards.slice(0, 2)) + ' ' + cj['_설명'] : F('cards.json').slice(0, 200));
  t('cards.json note — 표지 · 반복 출제 유형 · 1번 문항 사례', !!cj && /^표지 — /.test(cj.cards[0].note) && /^반복 출제 유형 — 유형은 반복된다/.test(cj.cards[11].note) && /^1번 문항 사례 — 1번 적중/.test(cj.cards[7].note), cj ? cj.cards.map((c) => c.note).join(' | ') : '');
  t('source.md = 블로그자료.md 내용 (카드 이름은 cards/NN_종류.png) · 숫자 칸 · 「기출」·연도 없음', /^# 블로그 자료 — 범박고 고2 2026년 2학기 중간고사 수학 분석/.test(F('source.md')) && /## 카드 01 \(그림: cards\/01_cover\.png\)/.test(F('source.md')) && /## 카드 12 \(그림: cards\/12_repeat\.png\)/.test(F('source.md')) && /## 이번 시험 숫자/.test(F('source.md')) && F('source.md').indexOf('기출') < 0 && !/\(2024|2025년/.test(F('source.md')), F('source.md').slice(0, 300));
  t('AI 키 없음 → post_draft.md 없음 · README.txt 3줄에 그 사유 · post_check → naver_draft · external', b1.names.indexOf(root + 'post_draft.md') < 0 && F('README.txt').trim().split('\n').length === 3 && /post_draft\.md 는 만들지 않았습니다/.test(F('README.txt')) && /AI 키가 없습니다/.test(F('README.txt')) && /node sync\/post_check\.js blog\/[^ ]+-exam → node sync\/naver_draft\.js blog\/[^ ]+-exam/.test(F('README.txt')) && /external/.test(F('README.txt')), F('README.txt'));
  t('파일 5종: cards/*.png · cards.json · source.md · README.txt (모두 그 폴더 안)', b1.names.every((n) => n.indexOf(root) === 0) && ['cards.json', 'source.md', 'README.txt'].every((n) => b1.names.indexOf(root + n) >= 0) && b1.names.length === 16, JSON.stringify(b1.names.map((n) => n.slice(root.length))));
  t('내보낸 글(cards.json · source.md · README)에 「매쓰플랫」「수학비서」 없음', !Object.values(b1.txt).some((x) => BAN.test(x)), Object.keys(b1.txt).filter((k) => BAN.test(b1.txt[k])).join(','));
  t('시험 설정에 blogAt 기록 · 안내 띄움', b1.saved && /블로그 폴더/.test(b1.toast), b1.toast);

  const b2 = await blog(true);
  const root2 = (b2.names[0] || '').replace(/cards\/.*$|[^/]*$/, '');
  const D = b2.txt[root2 + 'post_draft.md'] || '';
  t('AI 있음(callAI) → post_draft.md 생김 · 머리말 그대로 · 코드 울타리 없음 · README 에 초안 안내', !!D && /^---\ntitle: [^\n]+— 부천 옥길동 루멘수학\ndate: 2026-10-11\nrecruit: false\nhashtags: /.test(D) && D.indexOf('```') < 0 && /post_draft\.md 는 AI 초안입니다/.test(b2.txt[root2 + 'README.txt'] || ''), D.slice(0, 300));
  t('초안 다듬기: 「매쓰플랫」「수학비서」「기출」 없음 · source.md 에 없는 숫자(87)는 머리말 _check 줄', !BAN.test(D) && D.indexOf('기출') < 0 && /_check: source\.md 에 없는 숫자 87 /.test(D) && !/_check:[^\n]*\b(6|4|116|618)\b/.test(D), (D.match(/_check:[^\n]*/) || [''])[0]);
  t('AI 지시문 = 블로그 규칙(프로필 4-2·5·6·7 그대로) + source.md 사실 · 카드 파일 이름 · 금지(외부 서비스 이름·학생 이름·지어낸 숫자)', /### 4-2\. 원문에서 뽑은 말투 규칙/.test(b2.ai) && /### 5-2\. 법·윤리상 못 쓰는 말/.test(b2.ai) && /## 6\. 글 한 편의 규격/.test(b2.ai) && /\[사실 자료 — source\.md\]\n# 블로그 자료 — /.test(b2.ai) && /01_cover\.png, 02_difficulty_flow\.png/.test(b2.ai) && /지어내지 않는다/.test(b2.ai) && /학생 이름/.test(b2.ai) && /외부 서비스/.test(b2.ai) && !/AAA111|BBB222/.test(b2.ai), b2.ai.slice(0, 200));
  t('AI 있음 — 모든 내보낸 글에 「매쓰플랫」「수학비서」 없음 · 파일 17개', !Object.values(b2.txt).some((x) => BAN.test(x)) && b2.names.length === 17, JSON.stringify(b2.names.map((n) => n.slice(root2.length))));

  /* 9) 「⬇ 카드 내려받기」는 그대로 (파일 이름 · 블로그자료.md · 글꼴 줄) */
  const k1 = await pg.evaluate(async () => { const h0 = T.h2c.length; const oc = HTMLAnchorElement.prototype.click; let dl = ''; HTMLAnchorElement.prototype.click = function () { dl = this.download; };
    await cnExport(); await new Promise((r) => setTimeout(r, 100)); HTMLAnchorElement.prototype.click = oc; const z = T.zips[T.zips.length - 1];
    return { names: z.names, md: z.txt['블로그자료.md'] || '', n: T.h2c.length - h0, dl }; });
  t('「카드 내려받기」 그대로: 01_표지.png … + 블로그자료.md · 글꼴 줄 「브랜드 글꼴(Pretendard)」 · 색 「브랜드 · 붉은 바탕」', k1.n === 13 && k1.names[0] === '01_표지.png' && k1.names[7] === '08_1번적중.png' && k1.names[13] === '블로그자료.md' && /> - 카드 스타일: 새 스타일\(디자인 2판\) · 제목 글꼴 브랜드 글꼴\(Pretendard\) · 1080×1350 · 색 「브랜드 · 붉은 바탕」/.test(k1.md) && /^카드뉴스_범박고_고2_2026_2학기중간\.zip$/.test(k1.dl), JSON.stringify([k1.n, k1.names.slice(0, 2), k1.dl]));

  /* 10) 폴더 이름 만들기 */
  const sl = await pg.evaluate(() => [['옥길중', '중1'], ['범박중', '중3'], ['범박고', '고2'], ['소사고', '고1'], ['시온고', '고3'], ['정명고', '고2'], ['부천중', '중2'], ['어느고', '고1']].map((x) => cn4Slug({ school: x[0], grade: x[1] })));
  t('폴더 이름: okgil-m1 · beombak-m3 · beombak-g2 · sosa-g1 · sion-g3 · jeongmyeong-g2 · 모르는 학교 school-m2 / school-g1', JSON.stringify(sl) === JSON.stringify(['okgil-m1-exam', 'beombak-m3-exam', 'beombak-g2-exam', 'sosa-g1-exam', 'sion-g3-exam', 'jeongmyeong-g2-exam', 'school-m2-exam', 'school-g1-exam']), JSON.stringify(sl));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
