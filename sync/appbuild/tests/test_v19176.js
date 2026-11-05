#!/usr/bin/env node
/* 학원앱 v19-176 검사 — 🙋 학생 체크 잘 보이게 (docs/hw_dispatch_contract.md §11-2)
 *   ① hwsOf 가 sub(제출 시각)도 돌려줌 · 학생 종합 %
 *   ② 그리드 칸 아래 알약: 제출 「🙋 n」 초록 바탕 · 작성 중 「✎ n」 흰 바탕 초록 테두리 · 안 누름 없음 · 점·점선 없음 · 칸 title · 11px 이상
 *   ③ 맨 위 띠 #hws-bar: 보고 있는 날짜 제출/작성 중/안 함 수 · 「제출한 학생 전부 학생 값으로 ✓」 → 제출 학생만 · 이미 찍은 칸 건너뜀 · 토스트
 *   ④ 반 머리 「한 번에」 줄 🙋 n/m 칩 · 0 이면 없음 · 누르면 그 반 제출 학생만
 *   ⑤ 세부 창: 학생 칸이 제목 바로 다음 · 단계 4칸 · 상태 줄 · 「학생 값 그대로 ✓ 저장」(두 번 누르기) · 안 누른 학생 문구 · 옛 아래 줄 없음 · 빈 칸 작은 창도 같은 모양
 *   ⑥ hw_teach_ 발행 · XP 0 그대로   ⑦ 수업 모드 알약   ⑧ 회귀(홈·숙제체크·할 일 보드·리커버리 보드) · 실서버 쓰기 없음 · 페이지 오류 없음
 *   가짜 학생 6명(○○○1~6 · M4 매일 · T5 다른 요일) · 가짜 서버(lumen_store 흉내) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19176.js lumen_v19-176.html [그리드.png] [창.png]
 *   바탕: test_v19175.js 의 가짜 서버(mk) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-176.html');
const SHOT_A = process.argv[3] || '';
const SHOT_B = process.argv[4] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-176'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
/* 그리드의 「오늘」과 같은 기준(UTC 날짜) — 보고 있는 날짜가 오늘이 되게 M4 는 매일 수업 */
const D = new Date().toISOString().slice(0, 10);
const D0 = add(D, -1).slice(0, 7) === D.slice(0, 7) ? add(D, -1) : add(D, 1);
const T5DAYS = [(dow(D) + 3) % 7];   /* T5 는 D 에 수업 없음 */
const names = (n) => '○○○' + n;
const code = (n) => (n <= 4 ? 'AAA' : 'BBB') + String(n).repeat(3).slice(0, 3);
const STUDENTS = [];
for (let n = 1; n <= 6; n++) STUDENTS.push({ id: 'S' + n, name: names(n), grade: '중학교 1학년', group: n <= 4 ? 'M4' : 'T5', lumen_rec_code: code(n), lumen_planner: {} });
STUDENTS[0].lumen_hw = { [D]: { p: 0, c: 0, w: 0 } };   /* ○○○1 은 선생님이 이미 찍음 */
const C1 = code(1), C2 = code(2), C3 = code(3), C4 = code(4), C5 = code(5);
const AT = D + 'T07:20:00.000Z';    /* KST 16:20 작성 */
const SUB = D + 'T07:28:00.000Z';   /* KST 16:28 제출 */
const STORE = {
  lumen_group_days: { M4: [0, 1, 2, 3, 4, 5, 6], T5: T5DAYS },
  stu_features: { retry: { on: true, off: [] }, hw: { on: true, off: [] } },
  ['hw_self_' + C1]: { byDate: { [D]: { p: 100, c: 100, w: 0, at: AT, sub: SUB }, [D0]: { p: 100, at: D0 + 'T10:00:00Z' } }, upd: SUB },
  ['hw_self_' + C2]: { byDate: { [D]: { p: 100, c: 100, w: 100, a: 0, at: AT, sub: SUB } }, upd: SUB },
  ['hw_self_' + C3]: { byDate: { [D]: { p: 100, c: 60, w: 30, aNone: true, at: AT } }, upd: AT },
  ['hw_self_' + C5]: { byDate: { [D]: { p: 60, c: 0, w: 0, aNone: true, at: AT, sub: SUB } }, upd: SUB },
  ['todo_' + C2]: { items: [ { id: 'hw:' + D + ':702', kind: 'book', title: '가짜 교재 20쪽', ref: '', src: 'hw', hw: true, due: D, n: 4, from: 20, to: 20, bookId: 702, book: '가짜 교재', tst: 'todo', tat: {}, auto: null, at: D + 'T00:00:00Z', unit: null, order: 1 } ], upd: D + 'T00:00:00Z' } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  const reqs = []; let faked = false; await pg.route(/^https?:\/\//, (r) => { reqs.push((faked ? 'after:' : 'boot:') + r.request().url()); r.abort(); });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [], q: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, desc: '',
        select() { return b; }, eq(k, v) { b.desc += ' eq:' + v; b.f.push((x) => x === v); return b; }, in(k, a) { b.desc += ' in:' + a.length + ':' + String(a[0] || ''); b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { b.desc += ' like:' + p; const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or(str) { b.desc += ' or:' + str; const cs = String(str).split(',').map((c) => { const m = c.match(/^key\.(like|eq)\.(.*)$/); if (!m) return () => false; if (m[1] === 'eq') return (x) => x === m[2]; const pre = m[2].replace(/%$/, ''); return (x) => x.indexOf(pre) === 0; }); b.f.push((x) => cs.some((fn) => fn(x))); return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; T.ups.push({ tbl, keys: arr.map((r) => r.key) });
          if (tbl === 'lumen_store') arr.forEach((r) => { T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl === 'lumen_store') T.q.push(b.desc.trim()); if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.supaSetItem = (k, v) => { T.store[k] = clone(v); T.ups.push({ tbl: 'lumen_store', keys: [k] }); return Promise.resolve(true); };
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.alert = m; };
    try { localStorage.setItem('lumen_xp_pub_at', String(Date.now())); } catch (e) {}
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {}
    try { groupDays.M4 = [0, 1, 2, 3, 4, 5, 6]; groupDays.T5 = STORE.lumen_group_days.T5; saveGroupDays(); } catch (e) {}
    try { ['M4', 'T5'].forEach((g) => { if (groupList.indexOf(g) < 0) groupList.push(g); }); } catch (e) {}
  }, { STORE, STUDENTS });
  faked = true;
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const txt = () => pg.evaluate(() => (document.getElementById('content') || document.body).innerText);
  const resetHw = () => pg.evaluate(({ D }) => { students.forEach((s) => { s.lumen_hw = s.id === 'S1' ? { [D]: { p: 0, c: 0, w: 0 } } : {}; }); T.toasts.length = 0; T.ups.length = 0; HWC.pop = null; HWSF.arm = ''; render(); }, { D });

  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: hwsPill · hwsAcceptSub · hwsTot', await pg.evaluate(() => typeof hwsPill === 'function' && typeof hwsAcceptSub === 'function' && typeof hwsTot === 'function'));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWC_CM = ''; render(); }); await settle(600);
  await pg.waitForFunction(() => HWSF.loaded, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => render()); await settle(200);

  /* ① hwsOf sub */
  const v1 = await pg.evaluate(({ C1, D }) => hwsOf(C1, D), { C1, D });
  const v3 = await pg.evaluate(({ C3, D }) => hwsOf(C3, D), { C3, D });
  t('hwsOf: 제출한 학생은 sub(제출 시각) · 작성 중은 sub 빈 값 · 값 0/30/60/100·aNone 그대로', v1 && v1.sub === SUB && v1.p === 100 && v1.w === 0 && v3 && v3.sub === '' && v3.c === 60 && v3.a === 'na', JSON.stringify([v1, v3]));
  t('학생 종합 %: 풀이·채점·오답(+아하 숫자) 평균 — 67 · 75 · 63', await pg.evaluate(({ C1, C2, C3, D }) => hwsTot(hwsOf(C1, D)) === 67 && hwsTot(hwsOf(C2, D)) === 75 && hwsTot(hwsOf(C3, D)) === 63, { C1, C2, C3, D }));

  /* ② 칸 알약 */
  const cells = await pg.evaluate(({ D }) => ['S1', 'S2', 'S3', 'S4'].map((id) => {
    const el = document.getElementById('hwc-c-' + id + '-' + D); const td = el && el.closest('td'); const p = td && td.querySelector('.hws-pill');
    const cs = p ? getComputedStyle(p) : null;
    return { id, has: !!el, pill: p ? p.getAttribute('data-hws') : '', text: p ? p.textContent.replace(/\s/g, '') : '', bg: cs ? cs.backgroundColor : '', fw: cs ? cs.fontWeight : '', fs: cs ? parseFloat(cs.fontSize) : 0, bc: cs ? cs.borderTopColor : '', w: p ? p.offsetWidth : 0, cw: el ? el.offsetWidth : 0, title: el ? el.getAttribute('title') || '' : '' };
  }), { D });
  const [c1, c2, c3, c4] = cells;
  t('제출 칸 알약: 초록 바탕(#16a34a) 흰 굵은 글 「🙋 67」·「🙋 75」', c1.pill === 'sub' && c1.text === '🙋67' && c1.bg === 'rgb(22, 163, 74)' && Number(c1.fw) >= 800 && c2.pill === 'sub' && c2.text === '🙋75', JSON.stringify([c1, c2]));
  t('작성 중 칸 알약: 흰 바탕 초록 테두리 「✎ 63」', c3.pill === 'draft' && c3.text === '✎63' && c3.bg === 'rgb(255, 255, 255)' && c3.bc === 'rgb(22, 163, 74)', JSON.stringify(c3));
  t('안 누른 학생 칸: 알약 없음', c4.has && c4.pill === '', JSON.stringify(c4));
  t('알약 글자 11px 이상 · 폭이 칸 폭 근처(≤ 칸+8px)', cells.filter((c) => c.pill).every((c) => c.fs >= 11 && c.w <= c.cw + 8), JSON.stringify(cells.map((c) => [c.fs, c.w, c.cw])));
  t('점 4개·빈 점선 없음(그리드 어디에도 .hws-dots · dashed 없음)', await pg.evaluate(() => { const w = document.getElementById('hwc-wrap'); return !w.querySelector('.hws-dots') && !/dashed/.test([...w.querySelectorAll('[id^="hwc-c-"]')].map((e) => e.outerHTML).join('')); }));
  t('칸 title 에 「🙋 학생 스스로: 풀이 100 · 채점 100 · 오답 0 · 아하 — · 제출 16:28」', c1.title.indexOf('🙋 학생 스스로: 풀이 100 · 채점 100 · 오답 0 · 아하 — · 제출 16:28') >= 0, c1.title);
  t('작성 중 title 에 「아하 없음 · 아직 제출 안 함 (16:20 작성)」', c3.title.indexOf('아하 없음 · 아직 제출 안 함 (16:20 작성)') >= 0, c3.title.slice(-80));

  /* ③ 맨 위 띠 */
  const bar = await pg.evaluate(() => { const b = document.getElementById('hws-bar'); if (!b) return null; const n = (c) => Number((b.querySelector('.' + c) || {}).getAttribute ? b.querySelector('.' + c).getAttribute('data-n') : -1); return { iso: b.getAttribute('data-iso'), sub: n('hws-n-sub'), draft: n('hws-n-draft'), none: n('hws-n-none'), text: b.innerText, bg: getComputedStyle(b).backgroundColor, btn: !!b.querySelector('#hws-acc-all') }; });
  t('#hws-bar: 오늘 기준 「🙋 제출 3명 · ✎ 작성 중 1명 · 안 함 1명」(다른 반 제출 학생 포함 · 수업 없는 학생 뺌)', bar && bar.iso === D && bar.sub === 3 && bar.draft === 1 && bar.none === 1 && /🙋 제출 3명/.test(bar.text) && /✎ 작성 중 1명/.test(bar.text) && /안 함 1명/.test(bar.text), JSON.stringify(bar));
  t('#hws-bar 눈에 띄게(초록 연한 바탕) + 「제출한 학생 전부 학생 값으로 ✓」 단추', bar && bar.bg === 'rgb(220, 252, 231)' && bar.btn && /제출한 학생 전부 학생 값으로 ✓/.test(bar.text), JSON.stringify(bar && [bar.bg, bar.btn]));

  /* ④ 반 머리 칩 */
  const chips = await pg.evaluate(({ D, D0 }) => { const all = [...document.querySelectorAll('.hws-chip')]; return { n: all.length, list: all.map((b) => [b.getAttribute('onclick'), b.textContent]), d: all.filter((b) => b.getAttribute('onclick').indexOf(D) >= 0).map((b) => b.textContent), d0: all.filter((b) => b.getAttribute('onclick').indexOf(D0) >= 0).length, old: document.querySelectorAll('.hws-acc').length }; }, { D, D0 });
  t('반 머리 「한 번에」 줄: M4 오늘 「🙋 2/4」 칩 · 제출 0 인 날짜(어제)엔 없음 · 옛 🟢n 단추 없음', chips.d.length === 1 && chips.d[0] === '🙋 2/4' && chips.d0 === 0 && chips.old === 0, JSON.stringify(chips));
  await pg.evaluate(({ D }) => { T.toasts.length = 0; const b = [...document.querySelectorAll('.hws-chip')].find((x) => x.getAttribute('onclick').indexOf(D) >= 0); b.click(); }, { D }); await settle(400);
  const afterChip = await pg.evaluate(({ D }) => ({ s1: students[0].lumen_hw[D], s2: (students[1].lumen_hw || {})[D], s3: (students[2].lumen_hw || {})[D], s5: (students[4].lumen_hw || {})[D], toast: T.toasts.slice(-1)[0] }), { D });
  t('칩 누르면 그 반 제출 학생만(○○○2) 학생 값 저장 · 이미 찍은 ○○○1 건너뜀 · 작성 중 ○○○3·다른 반 ○○○5 안 건드림', afterChip.s2 && afterChip.s2.p === 100 && afterChip.s2.c === 100 && afterChip.s2.w === 100 && afterChip.s1.p === 0 && !afterChip.s3 && !afterChip.s5, JSON.stringify(afterChip));
  t('칩 토스트 「1명 적음 · 이미 찍은 1명 건너뜀」', /1명 적음 · 이미 찍은 1명 건너뜀/.test(afterChip.toast || ''), afterChip.toast);

  /* ③-2 띠 단추 */
  await resetHw();
  await pg.evaluate(() => document.getElementById('hws-acc-all').click()); await settle(500);
  const afterAll = await pg.evaluate(({ D }) => ({ s1: students[0].lumen_hw[D], s2: (students[1].lumen_hw || {})[D], s3: (students[2].lumen_hw || {})[D], s4: (students[3].lumen_hw || {})[D], s5: (students[4].lumen_hw || {})[D], toast: T.toasts.slice(-1)[0], aha: students[1].lumen_hw_aha }), { D });
  t('「제출한 학생 전부」 → 제출 학생(○○○2·○○○5)만 lumen_hw 저장 · 작성 중·안 함 안 건드림', afterAll.s2 && afterAll.s2.w === 100 && afterAll.s5 && afterAll.s5.p === 60 && afterAll.s5.c === 0 && !afterAll.s3 && !afterAll.s4, JSON.stringify(afterAll));
  t('이미 찍은 ○○○1 은 건너뜀 · 토스트 「2명 적음 · 이미 찍은 1명 건너뜀」', afterAll.s1.p === 0 && afterAll.s1.c === 0 && /2명 적음 · 이미 찍은 1명 건너뜀/.test(afterAll.toast || ''), JSON.stringify([afterAll.s1, afterAll.toast]));
  await settle(400);
  const teach = await pg.evaluate(({ C2, C5, D }) => [T.store['hw_teach_' + C2], T.store['hw_teach_' + C5]], { C2, C5, D });
  t('hw_teach_ 발행 그대로(○○○2·○○○5 byDate[오늘] = {p,c,w,t})', teach[0] && teach[0].byDate[D] && teach[0].byDate[D].w === 100 && teach[1] && teach[1].byDate[D] && teach[1].byDate[D].p === 60 && typeof teach[1].byDate[D].t === 'number', JSON.stringify(teach));
  t('XP 0 그대로(hwlSelfXP · calcXP 에 hwself 없음)', await pg.evaluate(({ C2 }) => { const r = hwlSelfXP(C2); const st = students.find((s) => s.lumen_rec_code === C2); const x = calcXP(st, []); return r.xp === 0 && r.month === 0 && !(x.breakdown && x.breakdown.hwself); }, { C2 }));

  /* ⑤ 세부 창 — 찍은 칸(○○○1, 제출) */
  await resetHw();
  await pg.evaluate(({ D }) => hwcOpenPop('S1', D), { D }); await settle(300);
  const pop1 = await pg.evaluate(() => {
    const p = document.getElementById('hwc-pop'); if (!p) return null; const ttl = p.firstElementChild, nx = ttl && ttl.nextElementSibling;
    const sec = p.querySelector('.hws-pop');
    return { n: p.querySelectorAll('.hws-pop').length, next: !!(nx && nx.classList.contains('hws-pop')), title: ttl ? ttl.textContent : '', boxes: sec ? [...sec.querySelectorAll('.hws-box')].map((b) => b.textContent) : [], st: sec && sec.querySelector('.hws-st') ? sec.querySelector('.hws-st').textContent : '', stc: sec && sec.querySelector('.hws-st') ? getComputedStyle(sec.querySelector('.hws-st')).color : '', btn: (document.getElementById('hws-acc-one') || {}).textContent || '', old: /학생 체크 그대로 ✓/.test(p.innerHTML), lastIsBottom: !![...p.children].slice(-3).find((c) => c.classList && c.classList.contains('hws-pop')) };
  });
  t('세부 창: 학생 칸이 제목(이름 · 날짜) 바로 다음 요소 · 한 번만', pop1 && pop1.next && pop1.n === 1 && /○○○1/.test(pop1.title), JSON.stringify(pop1));
  t('세부 창: 단계 4칸 「풀이 100 · 채점 100 · 오답 0 · 아하 —」', pop1 && pop1.boxes.join('|') === '풀이100|채점100|오답0|아하—', JSON.stringify(pop1 && pop1.boxes));
  t('세부 창: 상태 줄 「📤 제출 16:28」(초록)', pop1 && pop1.st === '📤 제출 16:28' && pop1.stc === 'rgb(21, 128, 61)', JSON.stringify(pop1 && [pop1.st, pop1.stc]));
  t('아래쪽 옛 줄(「학생 체크 그대로 ✓」 · 종합 위) 없음', pop1 && !pop1.old && !pop1.lastIsBottom, JSON.stringify(pop1 && [pop1.old, pop1.lastIsBottom]));
  t('단추 「학생 값 그대로 ✓ 저장 (이미 찍은 칸 — 두 번 누르기)」', pop1 && /학생 값 그대로 ✓ 저장/.test(pop1.btn) && /두 번 누르기/.test(pop1.btn), pop1 && pop1.btn);
  await pg.evaluate(() => document.getElementById('hws-acc-one').click()); await settle(200);
  const arm = await pg.evaluate(({ D }) => ({ hw: students[0].lumen_hw[D], btn: (document.getElementById('hws-acc-one') || {}).textContent || '' }), { D });
  await pg.evaluate(() => document.getElementById('hws-acc-one').click()); await settle(300);
  const saved = await pg.evaluate(({ D }) => ({ hw: students[0].lumen_hw[D], btn: (document.getElementById('hws-acc-one') || {}).textContent || '', aha: (students[0].lumen_hw_aha || {})[D] }), { D });
  t('이미 찍은 칸: 한 번 누르면 경고만 · 두 번째에 lumen_hw = 학생 값 {100,100,0} · 그 뒤 「이미 학생 값과 같습니다」', arm.hw.p === 0 && /한 번 더 누르면/.test(arm.btn) && saved.hw.p === 100 && saved.hw.c === 100 && saved.hw.w === 0 && /이미 학생 값과 같습니다/.test(saved.btn) && saved.aha === undefined, JSON.stringify([arm, saved]));

  /* 빈 칸 작은 창 — 작성 중 ○○○3 */
  await pg.evaluate(({ D }) => { HWC.pop = null; hwcOpenPop('S3', D); }, { D }); await settle(300);
  const pop3 = await pg.evaluate(() => { const p = document.getElementById('hwc-pop'); if (!p) return null; const sec = p.querySelector('.hws-pop'); return { mini: p.classList.contains('hws-mini'), next: !!(p.firstElementChild && p.firstElementChild.nextElementSibling === sec), boxes: sec ? [...sec.querySelectorAll('.hws-box')].map((b) => b.textContent) : [], st: sec && sec.querySelector('.hws-st') ? sec.querySelector('.hws-st').textContent : '', stc: sec && sec.querySelector('.hws-st') ? getComputedStyle(sec.querySelector('.hws-st')).color : '' }; });
  t('빈 칸 작은 창도 같은 모양: 제목 다음 학생 칸 · 「풀이 100 · 채점 60 · 오답 30 · 아하 없음」 · 「✎ 아직 제출 안 함 · 16:20 작성」(주황)', pop3 && pop3.mini && pop3.next && pop3.boxes.join('|') === '풀이100|채점60|오답30|아하없음' && pop3.st === '✎ 아직 제출 안 함 · 16:20 작성' && pop3.stc === 'rgb(194, 65, 12)', JSON.stringify(pop3));
  await pg.evaluate(() => document.getElementById('hws-acc-one').click()); await settle(300);
  t('작은 창 「학생 값 그대로 ✓ 저장」 → lumen_hw = {100,60,30}', await pg.evaluate(({ D }) => { const v = students[2].lumen_hw[D]; return v && v.p === 100 && v.c === 60 && v.w === 30; }, { D }));
  /* 안 누른 학생 */
  await pg.evaluate(({ D }) => { HWC.pop = null; students[3].lumen_hw = { [D]: { p: 100, c: 100, w: 100 } }; hwcOpenPop('S4', D); }, { D }); await settle(300);
  const pop4 = await pg.evaluate(() => { const p = document.getElementById('hwc-pop'); const sec = p && p.querySelector('.hws-pop'); return { next: !!(p && p.firstElementChild.nextElementSibling === sec), txt: sec ? sec.textContent : '', btn: !!document.getElementById('hws-acc-one') }; });
  t('안 누른 학생: 맨 위 「🙋 학생이 아직 체크하지 않았어요」 한 줄 · 단추 없음', pop4.next && pop4.txt === '🙋 학생이 아직 체크하지 않았어요' && !pop4.btn, JSON.stringify(pop4));
  /* 알약 누르면 세부 창 */
  await pg.evaluate(() => { HWC.pop = null; render(); }); await settle(200);
  await pg.evaluate(({ D }) => { const el = document.getElementById('hwc-c-S2-' + D).closest('td').querySelector('.hws-pill'); el.click(); }, { D }); await settle(300);
  t('알약을 누르면 그 칸 세부 창이 열림', await pg.evaluate(({ D }) => HWC.pop === 'S2|' + D && !!document.querySelector('#hwc-pop .hws-pop'), { D }));
  if (SHOT_B) { await pg.evaluate(({ D }) => { HWC.pop = null; students[0].lumen_hw = { [D]: { p: 0, c: 0, w: 0 } }; hwcOpenPop('S1', D); }, { D }); await settle(400);
    await pg.locator('#hwc-pop').screenshot({ path: SHOT_B }); }

  /* ⑦ 수업 모드 */
  await resetHw();
  await pg.evaluate(() => { HWC_CM = 'M4'; render(); }); await settle(400);
  const cm = await pg.evaluate(({ D }) => { const el = document.getElementById('hwc-c-S1-' + D); const p = el && el.closest('td').querySelector('.hws-pill'); const b = document.getElementById('hws-bar'); return { cm: !!document.getElementById('hwc-cm'), pill: p ? p.getAttribute('data-hws') : '', fs: p ? parseFloat(getComputedStyle(p).fontSize) : 0, sub: b ? Number(b.querySelector('.hws-n-sub').getAttribute('data-n')) : -1, draft: b ? Number(b.querySelector('.hws-n-draft').getAttribute('data-n')) : -1, dots: !!document.querySelector('.hws-dots') }; }, { D });
  t('수업 모드: 같은 알약(조금 크게 13px) · 띠는 그 반만(제출 2 · 작성 중 1) · 점 없음', cm.cm && cm.pill === 'sub' && cm.fs === 13 && cm.sub === 2 && cm.draft === 1 && !cm.dots, JSON.stringify(cm));
  await pg.evaluate(() => { HWC_CM = ''; render(); }); await settle(200);
  if (SHOT_A) { await pg.evaluate(() => { const w = document.getElementById('hwc-wrap'); if (w) w.scrollIntoView(); }); await settle(200);
    const wr = await pg.evaluate(() => { const r = document.getElementById('hwc-wrap').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await pg.screenshot({ path: SHOT_A, clip: { x: Math.max(0, wr.x), y: Math.max(0, wr.y), width: 1600 - Math.max(0, wr.x), height: 520 } }); }

  /* ⑧ 회귀 */
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(400);
  const home = await txt(); t('홈이 그려짐', home.length > 200, home.slice(0, 100));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; render(); }); await settle(300);
  t('숙제체크 그리드 그대로(표 · ✅ 한 번에 · 2차 확인 칸 · 띠)', await pg.evaluate(() => { const c = document.getElementById('content') || document.body; return !!c.querySelector('#hwc-wrap table') && !!c.querySelector('#hws-bar') && c.querySelectorAll('button[onclick^="hwcAllDone("]').length > 10; }));
  await pg.evaluate(() => { HWC_VIEW = 'stu'; render(); }); await settle(200);
  t('학생별 보기엔 알약·띠 안 붙음', await pg.evaluate(() => !document.getElementById('hws-bar') && !document.querySelector('.hws-pill')));
  await pg.evaluate(() => { HWC_VIEW = 'grid'; VIEW = 'todo'; TD.tab = 'board'; render(); }); await settle(300);
  t('할 일 보드 「📋 보드」 탭 그대로', /배정됨/.test(await txt()) && /확인 끝/.test(await txt()));
  await pg.evaluate(() => { VIEW = 'recovery'; GRP = groupOfView('recovery'); try { RC.view = 'board'; } catch (e) {} render(); }); await settle(500);
  t('리커버리 보드 그려짐', await pg.evaluate(() => (document.getElementById('content') || document.body).innerText.length > 100 && !/오류/.test((document.getElementById('content') || document.body).innerText.slice(0, 200))));
  t('가짜 서버 쓰기는 등록부·hw_teach_ 만(학생 키 hw_self_ 안 씀)', await pg.evaluate(() => [].concat.apply([], T.ups.map((u) => u.keys)).every((k) => !/^hw_self_/.test(k))));
  t('실서버 질의 없음(외부망 전부 차단 · 가짜 서버만)', reqs.filter((r) => /after:.*supabase/.test(r)).length === 0, reqs.filter((r) => /after:/.test(r)).slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
