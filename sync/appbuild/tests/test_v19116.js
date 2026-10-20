#!/usr/bin/env node
/* 학원앱 v19-116 검사 — 📚 교과서 문항도 등급으로 적중 확정 · 같은 그림 카드 합치기 · 교과서 일치 「공통」 한 번만
 *   (원장 2026-10-12 「6번의 경우 교과서 숫자변형인데 아래쪽 교과서 모음에 있어서 숫자변형 체크를 못하게 되었다.」)
 *   가짜 범박고 고1 공통수학2 (학교 교과서 = 비상교육) — 문항 6개
 *     1번: 우리 자료(매쓰플랫 학습지)로 숫자변형 확정 · 교과서 동아(숫자변형) · 비상교육(지문)
 *     2번: 우리 자료 후보 유사유형(확정 전) · 교과서 «같은 그림» 동아·와이비엠·지학사·천재(홍) 숫자변형 + 미래엔(지문, 다른 그림)
 *     3번: 미래엔만 같은 문제 · 4번: 같은 그림 비상교육·동아 숫자변형(학교 교과서가 낀 공통) · 5번: 없음 · 6번: 같은 그림 동아·지학사 같은 문제
 *   ① 2번 「📚 출판사 교과서」 — 같은 그림 4곳이 카드 하나 「동아·와이비엠·지학사·천재(홍) 공통 문항」 + 출판사별 쪽·번호 · 등급 단추 5개 · 안내 글
 *   ② 숫자변형 누르기 → it.hit {k:pub:21, kind:var, ok, by:teacher} · mats[pub:21] kind textbook · it.pub[] kind var(ai 남김) · exam_hit_ 저장
 *      → 도넛·적중률 1→2 · 「우리 자료별 적중」 교과서 0→1 · 접힌 줄 그림 · 보고서·.md·카드뉴스 자료 종류 「교과서」
 *   ③ 1번(우리 자료 확정)에서 교과서 등급 → 바꿀지 묻기(아니오 = 그대로 · 예 = 교과서로) ④ ↺ 풀기 → 적중 풀림 · mats 칸 지움
 *   ⑤ ✗ 아님(합친 카드) → 4곳 모두 · 되돌리기 ⑥ 교과서 일치 표: 출판사 줄 = 그 출판사에만 있는 그림 · 「🔗 공통」 줄 한 번 · 학교 교과서 낀 공통 = 학교 교과서 일치
 *   ⑦ 교과서일치도: 지도 「🔗 공통」 칸 · 자주 나온 곳 = 그 출판사에만 있는 문항으로 · 한 시험 표 공통 줄 · .md ⑧ 표 보기 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19116.js lumen_v19-116.html
 *   그림: $SP/v19116_item.png (합친 교과서 카드 + 등급 단추)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수·시험 문항 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-116.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-116'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고1_2026_2_중간', K = 'exam_hit_' + EID;
const SVG = (c, txt) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><rect width="320" height="90" fill="' + c + '"/><text x="14" y="52" font-size="18" fill="#334155">' + txt + '</text></svg>');
const IMG = { A: SVG('#ecfdf5', '공통 그림 A'), B: SVG('#f0fdf4', '공통 그림 B'), C: SVG('#f7fee7', '공통 그림 C') };
const PB = (pub, id, page, no, kind, img) => ({ k: 'pub:' + id, bid: { 동아: '1', 미래엔: '2', 비상교육: '3', 지학사: '4', 와이비엠: '5', '천재(홍)': '6' }[pub], pub, page, no: String(no), kind, why: kind === 'text' ? '그림만 같음' : '숫자만 다름', imgUrl: img || SVG('#ffffff', pub + ' ' + page + '쪽 ' + no + '번') });
const item = (no, o) => Object.assign({ no, cid: 500 + no, chapter: '단원', type: '유형 ' + no, level: 2, img: '', imgUrl: SVG('#eff6ff', '시험 ' + no + '번'), cands: [], hit: null, repeat: [], pub: [] }, o || {});
const STORE = {
  mf_textbooks: { books: { '3': { type: 'SCHOOL', grade: '공통수학2', title: '교과서_비상교육', fulltitle: '교과서_비상교육 - 공통수학2' } }, bySchoolGrade: { '범박고|고1': { n: 3, books: { '3': 3 } } } },
  exam_hit_index: { items: [{ examId: EID, school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', total: 6, at: '2026-10-12T05:00:00Z' }] },
};
STORE[K] = { examId: EID, exam: { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2', mydb: null }, basis: 'same+var', students: ['AAA111'],
  from: '2026-07-01', to: '2026-09-29',
  items: [
    item(1, { cands: [{ k: 'ws:1', kind: 'var', also: [] }], hit: { k: 'ws:1', kind: 'var', ok: true, by: 'teacher' }, pub: [PB('동아', 11, 45, 3, 'var'), PB('비상교육', 12, 20, 1, 'text')] }),
    item(2, { cands: [{ k: 'ms:9:3', kind: 'type', also: [] }], pub: [PB('동아', 21, 50, 2, 'var', IMG.A), PB('와이비엠', 22, 61, 4, 'var', IMG.A), PB('지학사', 23, 48, 7, 'var', IMG.A), PB('천재(홍)', 24, 77, 1, 'var', IMG.A), PB('미래엔', 25, 33, 5, 'text')] }),
    item(3, { pub: [PB('미래엔', 31, 90, 6, 'same')] }),
    item(4, { pub: [PB('비상교육', 41, 120, 3, 'var', IMG.B), PB('동아', 42, 118, 9, 'var', IMG.B)] }),
    item(5),
    item(6, { pub: [PB('동아', 61, 140, 2, 'same', IMG.C), PB('지학사', 62, 151, 8, 'same', IMG.C)] }) ],
  mats: {
    'ws:1': { kind: 'ws', title: '공통수학2 주간 학습지', where: '3번', cid: 501, img: SVG('#fef2f2', '우리 학습지 3번'), res: { AAA111: 'O' } },
    'ms:9:3': { kind: 'ms', title: '공통수학2 점검', where: '3번', cid: 502, img: SVG('#f5f3ff', '수학비서 3번'), res: {} } },
  stats: { total: 6, pub: { subject: '공통수학2', books: [{ bid: '1', pub: '동아', n: 600 }, { bid: '2', pub: '미래엔', n: 500 }, { bid: '3', pub: '비상교육', n: 535 }, { bid: '4', pub: '지학사', n: 520 }, { bid: '5', pub: '와이비엠', n: 510 }, { bid: '6', pub: '천재(홍)', n: 530 }], by: {}, items: 5 } } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], reads: [], printed: '', asked: [], answer: true };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({
          eq: (k, v) => { T.reads.push(v); return Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }); },
          like: () => Promise.resolve({ data: [] }),
          in: (k, arr) => Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T.store, x)).map((x) => ({ key: x })) }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '범박고', grade: '고등학교 1학년', lumen_rec_code: 'AAA111' }];
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = (m) => { T.asked.push(String(m)); return T.answer; };
    window.open = () => ({ document: { open() {}, write(x) { T.printed += x; }, close() {} } });
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = VIEW === 'tbmatch' ? rTbMatch() : rExamHit(); };
    VIEW = 'examhit';
  }, STORE);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);
  await pg.evaluate((EID) => { HT.kicked = true; HT.idx = JSON.parse(JSON.stringify(T.store.exam_hit_index)); HT.req = { status: 'done' }; HT.data = {}; HT.view = 'sheet'; HT.unfold = {}; HT.cur = EID; htLoad(HT.cur, true); }, EID);
  await settle(300); await pg.evaluate(() => render()); await settle(300); await pg.evaluate(() => render()); await settle(60);

  /* 요약 숫자 읽기 */
  const sum = () => pg.evaluate(() => {
    const box = document.getElementById('tdemo'), q = (s) => box.querySelector(s);
    const tk = (k) => ((q('#hts-bykind [data-htsk="' + k + '"]') || {}).textContent || '');
    return { donut: (q('.ht-grid svg[aria-label]') || { getAttribute: () => '' }).getAttribute('aria-label'), tb: tk('tb'), mf: tk('mf'), ms: tk('ms'),
      rank: [...box.querySelectorAll('.ht-card')].filter((c) => /어떤 자료가 맞혔나/.test(c.textContent)).map((c) => c.textContent)[0] || '',
      rates: (q('.ht-grid') || {}).textContent || '' };
  });
  const s0 = await sum();
  t('처음: 적중률 17% (1/6 — 1번 우리 자료) · 우리 자료별 적중 교과서 0 · 매쓰플랫 1', s0.donut === '적중률 17%' && /^0/.test(s0.tb) && /^1/.test(s0.mf), JSON.stringify(s0).slice(0, 300));

  /* ① 2번 교과서 줄 — 합친 카드 */
  const o1 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'), sec = box.querySelector('#pb-it-2'); if (!sec) return { sec: false };
    const cards = [...sec.querySelectorAll('.pb-card')];
    const m = sec.querySelector('.pb-card.pg116-multi');
    return { sec: true, n: cards.length, titles: cards.map((c) => c.querySelector('div > b').textContent), multi: m ? { k: m.getAttribute('data-pbk'), ks: m.getAttribute('data-pbks'), pbn: m.getAttribute('data-pbn'),
      wh: (m.querySelector('.pg116-wh') || {}).textContent || '', segs: [...m.querySelectorAll('[data-pg116seg]')].map((b) => b.getAttribute('data-pg116seg')), rej: !!m.querySelector('.pg116-rej'),
      cap: (m.querySelector('.pg116-cap') || {}).textContent || '', imgs: m.querySelectorAll('img').length } : null,
      head: (sec.querySelector('[data-pg116cap]') || {}).textContent || '', blkCap: (box.querySelector('#pb-block [data-pg116cap]') || {}).textContent || '' };
  });
  t('2번 — 같은 그림 4곳이 카드 하나 「동아·와이비엠·지학사·천재(홍) 공통 문항」 + 미래엔 카드 (2장)',
    o1.sec && o1.n === 2 && o1.titles[0] === '동아·와이비엠·지학사·천재(홍) 공통 문항' && o1.titles[1] === '미래엔 33쪽 5번' && o1.multi && o1.multi.pbn === '4' && o1.multi.k === 'pub:21' && o1.multi.imgs === 1, JSON.stringify(o1));
  t('합친 카드: 출판사별 쪽·번호 작은 글씨 · 등급 단추(같은 문제·숫자변형·유사유형·지문만) + ✗ 아님',
    o1.multi && o1.multi.wh === '동아 50쪽 2번 · 와이비엠 61쪽 4번 · 지학사 48쪽 7번 · 천재(홍) 77쪽 1번' && o1.multi.segs.join(',') === 'same,var,type,text' && o1.multi.rej, JSON.stringify(o1.multi));
  const CAP = '쪽·번호는 매쓰플랫 교과서 기준 — 실제 교과서와 다를 수 있어요';
  t('안내 글 「' + CAP + '」 — 칸 머리 · 카드 · 교과서 일치 표', o1.multi && o1.multi.cap === CAP && o1.head.indexOf(CAP) >= 0 && o1.blkCap.indexOf(CAP) >= 0, JSON.stringify([o1.head, o1.blkCap]));

  /* ⑥ 교과서 일치 표 — 공통 한 번 */
  const o6 = await pg.evaluate(() => {
    const box = document.getElementById('tdemo');
    const rows = {}; box.querySelectorAll('#pb-block tr[data-pbpub]').forEach((r) => { rows[r.getAttribute('data-pbpub')] = [...r.children].map((c) => c.textContent).join('|') + (r.hasAttribute('data-pbown') ? '*' : '') + (r.hasAttribute('data-pbcommon') ? '#' : ''); });
    const st = pbStats(HT.data[HT.cur]);
    return { rows, order: [...box.querySelectorAll('#pb-block tr[data-pbpub]')].map((r) => r.getAttribute('data-pbpub')), sum: (box.querySelector('#pb-sum') || {}).textContent || '',
      only: [...box.querySelectorAll('#pb-only [data-pbonly]')].map((a) => a.getAttribute('data-pbonly')), tile: (box.querySelector('#tb112-tile') || {}).textContent || '',
      items: st.items, rowsN: st.rows.length, foot: (box.querySelector('#pb-block').textContent.match(/한 문항이 여러 출판사[^]*?셉니다/) || [''])[0],
      head: (box.querySelector('#pb-head') || {}).textContent || '' };
  });
  t('교과서 일치 표 — 동아 1(1번만 · 그 출판사에만 있는 그림) · 미래엔 같은 문제 1(3번) · 「🔗 공통」 같은 1 · 숫자변형 2 (2·4·6번) 맨 아래',
    /^동아\|·\|1\|·\|1번$/.test(o6.rows['동아']) && /^미래엔\|1\|·\|1\|3번$/.test(o6.rows['미래엔']) && /^🔗 공통 .*\|1\|2\|·\|2번4번6번#$/.test(o6.rows['공통(여러 출판사)'] || '')
      && o6.order[o6.order.length - 1] === '공통(여러 출판사)' && /^지학사\|·\|·\|·\|—$/.test(o6.rows['지학사']) && /^와이비엠/.test(o6.rows['와이비엠']), JSON.stringify(o6.rows));
  t('교과서 6종(공통 줄은 종 수에 안 듦) · 어느 교과서든 5문항', /공통수학2 교과서 6종/.test(o6.head) && o6.rowsN === 6 && o6.items === 5, o6.head + ' / ' + o6.rowsN + ' / ' + o6.items);
  t('학교 교과서(비상교육) 일치 1 — 비상교육이 낀 공통 4번 · 다른 출판사에서만 4문항(1·2·3·6번) · 비상교육 줄은 학교 교과서 표시',
    /학교 교과서\(비상교육\)와 일치 1문항/.test(o6.sum) && /다른 출판사에서만 4문항/.test(o6.sum) && o6.only.join(',') === '1,2,3,6' && /\*$/.test(o6.rows['비상교육']) && /학교 교과서 1 · 다른 출판사만 4/.test(o6.tile),
    JSON.stringify([o6.sum, o6.only, o6.tile, o6.rows['비상교육']]));
  t('셈 규칙 글 — 「🔗 공통」 한 번만 · 그 출판사에만 있는', /공통」 줄에 한 번만/.test(o6.foot) && /그 출판사에만 있는/.test(o6.foot), o6.foot);

  /* ② 2번 합친 카드 「숫자변형」 */
  await pg.evaluate(() => { T.upserts.length = 0; document.querySelector('#pb-it-2 .pb-card.pg116-multi [data-pg116seg="var"]').click(); });
  await settle(120);
  const o2 = await pg.evaluate((K) => {
    const D = T.store[K], it = D.items[1], m = (D.mats || {})['pub:21'];
    return { hit: it.hit, mat: m, kinds: it.pub.map((p) => p.k + ':' + p.kind + ':' + (p.ai || '') + ':' + (p.by || '')), ups: T.upserts.slice(), asked: T.asked.length,
      fold: (() => { const el = document.getElementById('ht-q-2'); return el ? { txt: el.textContent, imgs: el.querySelectorAll('img').length, folded: !el.querySelector('.pb-sec') } : null; })() };
  }, K);
  t('숫자변형 → it.hit {k:pub:21, kind:var, ok, by:teacher} · 묻지 않음(우리 자료 확정 없음) · exam_hit_ 저장',
    o2.hit && o2.hit.k === 'pub:21' && o2.hit.kind === 'var' && o2.hit.ok === true && o2.hit.by === 'teacher' && o2.asked === 0 && o2.ups.indexOf(K) >= 0, JSON.stringify([o2.hit, o2.ups]));
  t('mats[pub:21] = 교과서(kind textbook) · 「동아·와이비엠·지학사·천재(홍) 교과서」 · 쪽·번호 · 그림 · pub',
    o2.mat && o2.mat.kind === 'textbook' && o2.mat.title === '동아·와이비엠·지학사·천재(홍) 교과서' && o2.mat.where === '동아 50쪽 2번 · 와이비엠 61쪽 4번 · 지학사 48쪽 7번 · 천재(홍) 77쪽 1번' && /^data:image\/svg/.test(o2.mat.img) && o2.mat.pub === true && o2.mat.store === '' && JSON.stringify(o2.mat.res) === '{}',
    JSON.stringify(o2.mat));
  t('합친 4곳 모두 kind var · ai 남김 · by teacher (미래엔 지문 카드는 그대로)',
    JSON.stringify(o2.kinds) === JSON.stringify(['pub:21:var:var:teacher', 'pub:22:var:var:teacher', 'pub:23:var:var:teacher', 'pub:24:var:var:teacher', 'pub:25:text::']), JSON.stringify(o2.kinds));
  t('확정하면 접힌다 — 접힌 줄에 교과서 그림·쪽 번호', o2.fold && o2.fold.folded && o2.fold.imgs === 2 && /50쪽 2번/.test(o2.fold.txt) && /숫자변형 ✓/.test(o2.fold.txt), JSON.stringify(o2.fold));
  const s2 = await sum();
  t('적중률 17% → 33% (2/6) · 우리 자료별 적중 교과서 0 → 1 ✓1 · 매쓰플랫 1 그대로', s2.donut === '적중률 33%' && /^1\s*✓1/.test(s2.tb) && /^1/.test(s2.mf) && /2\/6 · 33%/.test(s2.rates), JSON.stringify(s2).slice(0, 400));
  t('「어떤 자료가 맞혔나」 — 「동아·와이비엠·지학사·천재(홍) 교과서」 📘 교과서 · 2번', /동아·와이비엠·지학사·천재\(홍\) 교과서/.test(s2.rank) && /📘 교과서 · 2번/.test(s2.rank), s2.rank);

  /* 보고서 · .md · 카드뉴스 */
  const o3 = await pg.evaluate(() => {
    const d = HT.data[HT.cur], rr = htReportRows(d), cr = cnRows(d);
    T.printed = ''; htPrint('');
    const md = htMd(d);
    return { rm: rr[1].m ? rr[1].m.kind + ':' + rr[1].m.title : null, rm1: rr[0].m ? rr[0].m.kind : null, cnTop: cr[1].top ? cr[1].top.k : null, cnMk: cr[1].mk, cnM: cr[1].m ? cr[1].m.kind : null,
      printed: T.printed, md, cands: d.items[1].cands.map((c) => c.k).join(',') };
  });
  const prRow = (o3.printed.match(/<tr><td><b>2<\/b>[\s\S]*?<\/tr>/) || [''])[0];
  t('보고서 문항 표 2번 — 학원 자료 「교과서」 · 「우리 자료별 적중」 교과서 1', /<td>교과서<\/td><\/tr>$/.test(prRow) && /우리 자료별 적중<\/h2><div>[^<]*교과서 <b class="red">1<\/b>/.test(o3.printed), prRow.slice(-200));
  t('블로그 자료(.md) — 적중 문항 표 2번 「숫자변형 | 교과서」 · 우리 자료별 적중 교과서 1 · 「매쓰플랫」 낱말 없는 줄 그대로',
    /\| 2 \| 단원 \| 유형 2 \| 2 \| 숫자변형 \| 교과서 \|/.test(o3.md) && /우리 자료별 적중 \(같은 문제 \+ 숫자변형\): 교과서 1/.test(o3.md), (o3.md.match(/.*적중 문항 목록[\s\S]*?\n\n/) || [''])[0]);
  t('카드뉴스 자료 줄 — cnRows 2번 top = pub:21 · 자료 「교과서」 · 후보 목록(cands)은 그대로', o3.cnTop === 'pub:21' && o3.cnMk === '교과서' && o3.cnM === 'textbook' && o3.cands === 'ms:9:3' && o3.rm === 'textbook:동아·와이비엠·지학사·천재(홍) 교과서' && o3.rm1 === 'ws', JSON.stringify(o3).slice(0, 300));
  const o3b = await pg.evaluate(() => { try { const c = (typeof cn2Cards === 'function') ? cn2Cards(HT.data[HT.cur]) : []; return { n: c.length, ok: true }; } catch (e) { return { ok: false, e: String(e) }; } });
  t('카드뉴스 만들기 — 오류 없음', o3b.ok, JSON.stringify(o3b));

  /* 그림 — 2번 펼친 카드(합친 교과서 카드 ✓ 숫자변형) */
  await pg.evaluate(() => { HT.unfold[2] = true; render(); }); await settle(80);
  const r2 = await pg.evaluate(() => { const a = document.getElementById('ht-q-2').getBoundingClientRect(); return { x: a.left + scrollX, y: a.top + scrollY, w: a.width, h: a.height }; });
  await pg.screenshot({ path: SP + '/v19116_item.png', fullPage: true, clip: { x: Math.max(0, r2.x - 6), y: Math.max(0, r2.y - 6), width: r2.w + 12, height: Math.min(r2.h + 12, 1400) } });
  const o2b = await pg.evaluate(() => { const sec = document.getElementById('pb-it-2'), m = sec.querySelector('.pg116-multi');
    return { on: [...m.querySelectorAll('[data-pg116seg]')].filter((b) => /✓/.test(b.textContent)).map((b) => b.getAttribute('data-pg116seg')), undo: !!m.querySelector('[data-pg116undo]'), headUndo: !!sec.querySelector(':scope > div [data-pg116undo]'),
      pill: (document.querySelector('#ht-q-2 [data-pg116hit]') || {}).textContent || '', first: sec.querySelector('.pb-card').getAttribute('data-pbk') }; });
  t('펼친 2번 — 합친 카드 「✓ 숫자변형」 · ↺ 풀기 단추(카드·칸 머리) · 머리 알약 「📘 교과서 적중」', o2b.on.join() === 'var' && o2b.undo && o2b.headUndo && /📘 교과서 적중 · 동아·와이비엠·지학사·천재\(홍\) 교과서/.test(o2b.pill) && o2b.first === 'pub:21', JSON.stringify(o2b));

  /* ③ 1번(우리 자료 숫자변형 확정)에서 교과서 「같은 문제」 → 바꿀지 묻기 */
  await pg.evaluate(() => { HT.unfold[1] = true; render(); T.answer = false; T.asked.length = 0; document.querySelector('#pb-it-1 .pb-card[data-pbk="pub:11"] [data-pg116seg="same"]').click(); });
  await settle(80);
  const o4a = await pg.evaluate((K) => ({ asked: T.asked.slice(), hit: HT.data[HT.cur].items[0].hit, mat: !!(HT.data[HT.cur].mats || {})['pub:11'], kind: HT.data[HT.cur].items[0].pub[0].kind }), K);
  t('1번: 우리 자료로 확정된 문항 → 바꿀지 묻는다 · 「아니오」면 그대로', o4a.asked.length === 1 && /이미 우리 자료\(공통수학2 주간 학습지 3번\)로 적중 확정/.test(o4a.asked[0]) && o4a.hit.k === 'ws:1' && !o4a.mat && o4a.kind === 'var', JSON.stringify(o4a));
  await pg.evaluate(() => { T.answer = true; T.asked.length = 0; document.querySelector('#pb-it-1 .pb-card[data-pbk="pub:11"] [data-pg116seg="same"]').click(); });
  await settle(120);
  const o4b = await pg.evaluate((K) => { const D = T.store[K]; return { asked: T.asked.length, hit: D.items[0].hit, mat: (D.mats || {})['pub:11'], kind: D.items[0].pub[0].kind, ai: D.items[0].pub[0].ai }; }, K);
  const s4 = await sum();
  t('「예」 → 1번 적중 = 동아 45쪽 3번 같은 문제 (교과서) · 저장 · 우리 자료별 적중 교과서 2 · 매쓰플랫 0 · 적중률 33% 그대로',
    o4b.asked === 1 && o4b.hit.k === 'pub:11' && o4b.hit.kind === 'same' && o4b.mat && o4b.mat.title === '동아 교과서' && o4b.mat.where === '45쪽 3번' && o4b.kind === 'same' && o4b.ai === 'var'
      && /^2\s*✓2/.test(s4.tb) && /^0/.test(s4.mf) && s4.donut === '적중률 33%', JSON.stringify([o4b, s4.tb, s4.mf, s4.donut]));
  const o4c = await pg.evaluate(() => { const D = HT.data[HT.cur]; return { stu: htStudentRow(D, 'AAA111') }; });
  t('학생별 — 교과서 적중 2문항은 «나눠 줌»', o4c.stu.hit === 2 && o4c.stu.given === 2 && o4c.stu.O === 0, JSON.stringify(o4c.stu));

  /* ④ ↺ 풀기 (2번) */
  await pg.evaluate(() => { HT.unfold[2] = true; render(); document.querySelector('#pb-it-2 .pg116-multi [data-pg116undo]').click(); });
  await settle(120);
  const o5 = await pg.evaluate((K) => { const D = T.store[K]; return { hit: D.items[1].hit, mat21: !!(D.mats || {})['pub:21'], mat11: !!(D.mats || {})['pub:11'], ws1: !!(D.mats || {})['ws:1'], kind: D.items[1].pub[0].kind }; }, K);
  const s5 = await sum();
  t('↺ 풀기 → 2번 적중 풀림 · 저장본에서 mats[pub:21] 지움(1번 pub:11 · 우리 자료 ws:1 은 남음) · 적중률 17% · 교과서 1',
    o5.hit === null && !o5.mat21 && o5.mat11 && o5.ws1 && s5.donut === '적중률 17%' && /^1\s*✓1/.test(s5.tb), JSON.stringify([o5, s5.donut, s5.tb]));

  /* ⑤ 합친 카드 ✗ 아님 → 4곳 모두 · 공통 줄 숫자 · 되돌리기 */
  await pg.evaluate(() => { document.querySelector('#pb-it-2 .pg116-multi .pg116-rej').click(); });
  await settle(120);
  const o6a = await pg.evaluate((K) => { const D = T.store[K]; return { rej: D.items[1].pub.map((p) => !!p.rejected), cm: (() => { const r = document.querySelector('#pb-block tr[data-pbcommon]'); return r ? [...r.children].map((c) => c.textContent).join('|') : ''; })(),
    btn: (document.querySelector('#pb-it-2 .pg116-multi .pg116-rej') || {}).textContent || '', last: [...document.querySelectorAll('#pb-it-2 .pb-card')].map((c) => c.getAttribute('data-pbk')) }; }, K);
  t('✗ 아님(합친 카드) → 4곳 모두 rejected (미래엔은 그대로) · 공통 줄 숫자변형 2 → 1 (4번만) · 카드는 뒤로 · 「↺ 되돌리기」',
    JSON.stringify(o6a.rej) === '[true,true,true,true,false]' && /\|1\|1\|·\|4번6번$/.test(o6a.cm) && o6a.btn === '↺ 되돌리기' && o6a.last[o6a.last.length - 1] === 'pub:21', JSON.stringify(o6a));
  await pg.evaluate(() => { document.querySelector('#pb-it-2 .pg116-multi .pg116-rej').click(); });
  await settle(120);
  const o6b = await pg.evaluate((K) => T.store[K].items[1].pub.map((p) => !!p.rejected), K);
  t('되돌리기 → 4곳 모두 살아남', JSON.stringify(o6b) === '[false,false,false,false,false]', JSON.stringify(o6b));

  /* ⑧ 표 보기 — 교과서 적중 줄 · 펼친 줄에 가짜 후보 없음 */
  await pg.evaluate(() => { HT.view = 'table'; HT.open = { 1: true }; render(); }); await settle(60);
  const o8 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); const tr = [...box.querySelectorAll('.ht-tbl tr')].filter((r) => r.getAttribute('onclick') === 'htToggle(1)')[0];
    const det = tr ? tr.nextElementSibling : null;
    return { cell: tr ? tr.lastElementChild.textContent : '', cands: det ? det.querySelectorAll('.ht-cand').length : -1, pbsec: det ? !!det.querySelector('#pb-it-1') : false,
      still: HT.data[HT.cur].items[0].cands.map((c) => c.k).join(',') }; });
  t('표 보기 — 1번 줄 우리 자료 칸 「45쪽 3번」 · 펼친 줄 우리 자료 후보 1장(가짜 없음) + 출판사 교과서 줄', o8.cell === '45쪽 3번' && o8.cands === 1 && o8.pbsec && o8.still === 'ws:1', JSON.stringify(o8));
  await pg.evaluate(() => { HT.view = 'sheet'; render(); }); await settle(40);

  /* ⑦ 교과서일치도 */
  await pg.evaluate(() => { VIEW = 'tbmatch'; TBM.kicked = false; TBM.cur = ''; render(); }); await settle(400); await pg.evaluate(() => render()); await settle(60);
  const o7 = await pg.evaluate((EID) => {
    const box = document.getElementById('tdemo'), tr = box.querySelector('tr[data-tbm-row="' + EID + '"]');
    const cells = {}; if (tr) tr.querySelectorAll('[data-tbm-cell]').forEach((td) => { cells[td.getAttribute('data-tbm-cell')] = td.textContent + (td.classList.contains('own') ? '*' : ''); });
    const kp = [...box.querySelectorAll('#tbm-kpis .tbm-kpi')].map((k) => k.textContent);
    return { cells, cm: tr ? ((tr.querySelector('[data-tbm-common]') || {}).textContent || '') : '', th: [...box.querySelectorAll('.tbm-t thead th')].map((x) => x.textContent), kp,
      only: tr ? tr.querySelector('[data-tbm-onlycell]').textContent : '', legend: (box.querySelector('.tbm-legend') || {}).textContent || '' };
  }, EID);
  t('교과서일치도 지도 — 동아 1 · 미래엔 1 · 비상교육 0(학교) · 「🔗 공통」 칸 3 (다른 곳에서만 앞)',
    o7.cells['동아'] === '1' && o7.cells['미래엔'] === '1' && o7.cells['비상교육'] === '·*' && o7.cm === '3' && o7.th.indexOf('🔗 공통') === o7.th.indexOf('다른 곳에서만') - 1 && /🔗 공통/.test(o7.legend), JSON.stringify(o7));
  t('교과서일치도 숫자 칸 — 학교 교과서 일치 1 / 6 · 다른 출판사에서만 4 · 자주 나온 곳 「동아 · 미래엔」(공통 문항으로 동아·지학사에 점수 안 줌) · 다른 곳에서만 4문항',
    /^1 \/ 6/.test(o7.kp[1]) && /^4/.test(o7.kp[2]) && /^동아 · 미래엔/.test(o7.kp[3]) && /^4문항/.test(o7.only), JSON.stringify([o7.kp, o7.only]));
  await pg.evaluate((EID) => tbmOpen(EID), EID); await settle(60);
  const o7b = await pg.evaluate(() => {
    const box = document.getElementById('tdemo'), rows = {};
    box.querySelectorAll('#tbm-pubt tr[data-tbm-pub]').forEach((r) => { rows[r.getAttribute('data-tbm-pub')] = [...r.children].map((c) => c.textContent).join('|'); });
    return { rows, last: [...box.querySelectorAll('#tbm-pubt tr[data-tbm-pub]')].map((r) => r.getAttribute('data-tbm-pub')).pop(), rule: (box.querySelector('#pg116-rule') || {}).textContent || '',
      kp: [...box.querySelectorAll('.tbm-kpis .tbm-kpi')].map((k) => k.textContent), md: tbmMd(), rec: tbmTools() };
  });
  t('한 시험 표 — 「🔗 공통」 줄 맨 아래 (3 · 같은 1 · 숫자변형 2 · 2·4·6번) · 동아 1(1번 — 위에서 같은 문제로 확정) · 셈 규칙 글',
    o7b.last === '공통' && /\|3\|1\|2\|·\|2번4번6번$/.test(o7b.rows['공통'] || '') && /^동아\|1\|1\|·\|·\|1번$/.test(o7b.rows['동아']) && /그 출판사에만 있는/.test(o7b.rule) && o7b.rule.indexOf(CAP) >= 0, JSON.stringify(o7b.rows));
  t('한 시험 숫자 칸 = 적중 분석 칸과 같음 (학교 교과서 1 / 6 · 다른 출판사에서만 4 · 어느 교과서든 5 / 6)', /^1 \/ 6/.test(o7b.kp[0]) && /^4/.test(o7b.kp[1]) && /^5 \/ 6/.test(o7b.kp[2]), JSON.stringify(o7b.kp));
  t('교과서일치도 .md — 「여러 출판사 공통(같은 그림) 3」 · 「매쓰플랫」 낱말 없음', /출판사별 일치 문항: 동아 1 · 미래엔 1 · 여러 출판사 공통\(같은 그림\) 3/.test(o7b.md) && !/매쓰플랫/.test(o7b.md), (o7b.md.match(/- 출판사별.*/) || [''])[0]);
  t('대비 추천 — 비상교육 + 동아 · 미래엔 (지학사·와이비엠·천재(홍)은 공통 문항뿐이라 빠짐)', /비상교육 \+ <b[^>]*>동아 · 미래엔<\/b>/.test(o7b.rec), (o7b.rec.match(/data-tbm-rec[^]*?<\/div>/) || [''])[0]);
  /* 교과서일치도 ✗ 아님 — 공통 그림이면 함께 */
  await pg.evaluate(() => { tbmFocus('6'); }); await settle(60);
  await pg.evaluate(() => { document.querySelector('#tbm-focus .tbm-q [data-tbm-act="rej"]').click(); }); await settle(120);
  const o7c = await pg.evaluate((K) => T.store[K].items[5].pub.map((p) => p.pub + ':' + !!p.rejected), K);
  t('교과서일치도 ✗ 아님(6번 동아) → 같은 그림 지학사도 함께', JSON.stringify(o7c) === '["동아:true","지학사:true"]', JSON.stringify(o7c));

  /* 다시 적중 분석 — 저장한 결과를 새로 읽어도 교과서 적중 그대로 · 교과서 mats 가 빠진 옛 저장도 화면에서 다시 만든다 */
  await pg.evaluate((K) => { delete T.store[K].mats['pub:11']; VIEW = 'examhit'; HT.data = {}; htLoad(HT.cur, true); }, K); await settle(300); await pg.evaluate(() => render()); await settle(60);
  const o9 = await sum();
  const o9b = await pg.evaluate(() => { const m = (HT.data[HT.cur].mats || {})['pub:11']; return m ? m.kind + ':' + m.where : null; });
  t('새로 읽기 · mats 빠진 교과서 적중도 다시 만들어 셈 — 교과서 1 ✓1 · 적중률 17%', /^1\s*✓1/.test(o9.tb) && o9.donut === '적중률 17%' && o9b === 'textbook:45쪽 3번', JSON.stringify([o9.tb, o9.donut, o9b]));

  t('블로그 자료(.md)·교과서일치도 .md 에 학생 이름 없음 (가짜 이름 ○○○ 도 안 나감)', !/○○○/.test(o3.md) && !/○○○/.test(o7b.md), '');
  t('페이지 오류 없음', errs.length === 0, errs.join(' / '));
  await br.close();
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
