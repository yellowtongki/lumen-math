#!/usr/bin/env node
/* 학원앱 v19-118 검사 — v19-115 체크하기 검사(줄 선택자만 반 묶음 안까지) + 반별 묶음·두 칸
 * 원래: 학원앱 v19-115 검사 — 🗓 주간계획 모아보기 (시안 docs/mockup_plan_wall.html) + 📅 주간 점수 «✅ 체크하기 | 📊 점수 보기» (시안 docs/mockup_week_check_score.html)
 *   (원장 2026-10-12 「고정 스케줄과 학생들이 세운 계획, 학습 코디가 짠 계획이 구분이 되나?」 → 「v19-115 만들어 배포해줘」)
 *   가짜 학생 10명(이름 ○○○1~10), 반 M4 7명(오늘 수업) · T5 3명(오늘 수업 없음). 실제 모양의 키:
 *     wplan_<코드>.weeks[월요일].items[{d,t,n,subj,title,kind,src}] + submittedAt · wplan_chk_ · codi_plan_ · codi_done_ · codi_fixed_ ·
 *     sungong_ · plweek_paper · lumen_group_days · student_planner_ · wpmsg_
 *   날짜는 «오늘이 든 주(MON)»에서 셈 — 모아보기 기본 주 = MON · 주간 점수 표의 기본 주 W = MON-7. 계획은 MON · MON+7 두 주에 같게 넣어
 *   요일과 상관없이(월요일 지각 창 / 그 뒤 다음 주) 「안 낸 학생」이 같다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19115.js lumen_v19-115.html
 *   그림: $SP/v19115_wall.png (1500px) · $SP/v19115_check.png · $SP/v19115_score.png · 가짜 서버 · 외부망 차단. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-115.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-115'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const TODAY = iso(new Date(Date.now() + 9 * 3600000));
const JSDAY = new Date(TODAY + 'T00:00:00Z').getUTCDay();
const MON = add(TODAY, -((JSDAY + 6) % 7));
const W = add(MON, -7), NX = add(MON, 7);
const it = (id, d, tm, n, subj, title, src, kind) => ({ id, d, t: tm, n, subj, title, kind: kind || '', ref: '', src, part: '', mv: false, at: W + 'T10:00:00Z' });
const names = (n) => '○○○' + n;
const code = (n) => (n <= 7 ? 'AAA' : 'BBB') + String(n).repeat(3).slice(0, 3);
const STUDENTS = [];
for (let n = 1; n <= 10; n++) STUDENTS.push({ id: 'S' + n, name: names(n), grade: n === 5 ? '초등학교 6학년' : '중학교 1학년', group: n <= 7 ? 'M4' : 'T5', lumen_rec_code: code(n), lumen_planner: {} });
const C = {}; for (let n = 1; n <= 10; n++) C[n] = code(n);
/* 계획: 두 주(MON · NX)에 같게 */
const twoWeeks = (items, sub) => { const o = {}; [MON, NX].forEach((w) => { o[w] = { items: items.map((x) => Object.assign({}, x)) }; if (sub) o[w].submittedAt = add(w, -3) + 'T12:00:00Z'; }); return o; };
const PLANS = {
  1: { items: [it('a1', 0, '17:00', 2, '수학', '쎈 30~33쪽', 'codi', 'book'), it('a2', 1, '19:00', 2, '수학', '학습지 7', 'codi', 'ws'), it('a3', 2, '16:00', 2, '수학', '오답 5문제', 'codi', 'wrong'),
                   it('a4', 0, '21:00', 1, '영어', '단어 50개', 'me'), it('a5', 5, '10:00', 4, '국어', '문법 정리', 'me')], sub: true },
  3: null,   /* 코디 계획만 (codi_plan_) */
  4: { items: [it('d1', 1, '20:00', 2, '수학', '쓰는 중 계획', 'me'), it('d2', 3, '20:00', 2, '영어', '독해', 'me')], sub: false },
  5: { items: [it('e1', 0, '15:00', 2, '수학', '개념서', 'me'), it('e2', 2, '15:00', 2, '과학', '실험', 'me'), it('e3', 4, '15:00', 2, '사회', '요약', 'me')], sub: true },
  7: { items: [it('g1', 1, '18:00', 2, '수학', '코디 학습지', 'codi', 'todo'), it('g2', 6, '08:00', 2, '영어', '아침 단어', 'me')], sub: true },
  8: { items: [it('h1', 0, '20:00', 2, '수학', 'RPM', 'me'), it('h2', 0, '20:00', 2, '영어', '동시간 영어', 'me')], sub: true } };
const SUBMITTED = [1, 3, 5, 7, 8], NOSUB = [2, 4, 6, 9, 10];
const STORE = {
  lumen_group_days: { M4: [JSDAY, (JSDAY + 2) % 7], T5: [(JSDAY + 1) % 7, (JSDAY + 3) % 7] },
  plweek_paper: { byCode: { [C[1]]: { [W]: { at: add(W, 6) + 'T05:00:00Z' } } } },
  codi_fixed_AAA111: { blocks: [{ id: 'school', label: '학교', type: 'school', days: [0, 1, 2, 3, 4], start: '08:40', end: '16:00' }, { id: 'x1', label: '영어학원', type: 'academy', days: [1, 3], start: '19:00', end: '21:00' }] },
  codi_plan_AAA333: { week: MON, made: add(MON, -2) + 'T09:00:00Z', upd: add(MON, -2) + 'T09:00:00Z', blocks: [
    { id: 'c1', d: 0, s: 20, n: 2, part: '', item: { kind: 'book', subj: '수학', title: '개념서 30~35쪽' } },
    { id: 'c2', d: 2, s: 22, n: 2, part: '', item: { kind: 'todo', subj: '수학', title: '학습지 9' } }] },
  wplan_chk_AAA111: { weeks: { [MON]: { a4: { ok: true, at: MON + 'T13:00:00Z' } } } },
  codi_done_AAA777: { [add(MON, 1)]: { g1: { at: add(MON, 1) + 'T12:00:00Z' } } },
  sungong_AAA111: { code: C[1], weeks: { [W]: { total: 600, photo: 'AAA111/s1.jpg', at: add(W, 5) + 'T10:00:00Z' } } },
  sungong_AAA555: { code: C[5], weeks: { [W]: { total: 420, photo: 'AAA555/s5.jpg', at: MON + 'T03:00:00Z' } } },   /* 월 12:00 KST = 지각 */
  sungong_AAA666: { code: C[6], weeks: { [W]: { total: 300, photo: '', at: add(W, 5) + 'T10:00:00Z' } } },          /* 사진 없이 냄 */
  student_planner_AAA111: { studentId: 'S1', scores: {}, weekly: {}, teacherComment: '' },
  student_planner_AAA222: { studentId: 'S2', scores: {}, weekly: {}, teacherComment: '' },
  plweek_ev: { byCode: {} } };
Object.keys(PLANS).forEach((n) => { const p = PLANS[n]; if (!p) return; STORE['wplan_' + C[n]] = { code: C[n], weeks: twoWeeks(p.items, p.sub) }; });

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  const reqs = []; let faked = false; await pg.route(/^https?:\/\//, (r) => { reqs.push((faked ? 'after:' : 'boot:') + r.request().url()); r.abort(); });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [], opened: [], q: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, desc: '',
        select() { return b; }, eq(k, v) { b.desc += ' eq:' + v; b.f.push((x) => x === v); return b; }, in(k, a) { b.desc += ' in:' + a.length; b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { b.desc += ' like:' + p; const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or(str) { b.desc += ' or:' + str; const cs = String(str).split(',').map((c) => { const m = c.match(/^key\.(like|eq)\.(.*)$/); if (!m) return () => false; if (m[1] === 'eq') return (x) => x === m[2]; const pre = m[2].replace(/%$/, ''); return (x) => x.indexOf(pre) === 0; }); b.f.push((x) => cs.some((fn) => fn(x))); return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; T.ups.push({ tbl, keys: arr.map((r) => r.key), upd: arr.map((r) => Object.prototype.hasOwnProperty.call(r, 'updated_at')) });
          if (tbl === 'lumen_store') arr.forEach((r) => { T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl === 'lumen_store') T.q.push(b.desc.trim()); if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    window.open = () => { const doc = { html: '', open() {}, write(s) { doc.html += s; }, close() {} }; T.opened.push(doc); return { document: doc }; };
    try { _origSetItem('lumen_plw_pub_stamp', rk113Stamp()); } catch (e) {}
    try { localStorage.removeItem('wkc_mode'); } catch (e) {}
    T.seed = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {} };
    T.seed();
    Object.assign(PWB, { loaded: false, loading: false, at: 0, W: null });
  }, { STORE, STUDENTS });
  faked = true;
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);

  /* ① 메뉴 자리 */
  const M = await pg.evaluate(() => {
    const g = GROUPS.find((x) => x.key === 'class'), i = g.subs.findIndex((s) => s.v === 'plweek');
    VIEW = 'plweek'; const left = perViewLeftNav('plwall'), d = document.createElement('div'); d.innerHTML = left || '';
    const ids = [...d.querySelectorAll('[data-planview]')].map((b) => b.getAttribute('data-planview'));
    return { next: (g.subs[i + 1] || {}).v, lab: (g.subs[i + 1] || {}).label, ids, title: (function(){ try { return l3ViewTitle('plwall').name; } catch (e) { return ''; } })() };
  });
  const li = M.ids.indexOf('@plweek');
  t('메뉴: 왼쪽 「주간 · 순공 · 코디」 = 주간 점수 → 🗓 주간계획 모아보기 → 순공피드백 · 위 기능 탭도 주간 점수 바로 뒤', li >= 0 && M.ids[li + 1] === '@plwall' && M.ids[li + 2] === '@sungong' && M.next === 'plwall' && M.lab === '주간계획 모아보기' && /주간계획 모아보기/.test(M.title), JSON.stringify(M));

  /* ② 모아보기 열기 (왼쪽 메뉴 단추로) */
  await pg.evaluate(() => { T.seed(); VIEW = 'plweek'; PWB.loaded = false; render(); });
  await settle(1500);
  await pg.evaluate(() => { const b = document.querySelector('[data-planview="@plwall"]'); b.click(); });
  await settle(1200);
  const A = await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#CONTENT .pwl-card')];
    return { v: VIEW, n: cards.length, codes: cards.map((c) => c.getAttribute('data-code')), pg: (document.querySelector('.pwl-pgn') || {}).textContent, sum: (document.querySelector('.pwl-sum') || {}).innerText || '',
      grps: [...document.querySelectorAll('.pwl-grps .pwl-c')].map((b) => b.textContent), wk: [...document.querySelectorAll('.pwl-hd .pwl-c.on')].map((b) => b.textContent)[0],
      leftOn: (() => { const b = document.querySelector('[data-planview="@plwall"]'); return b ? getComputedStyle(b).backgroundImage + getComputedStyle(b).backgroundColor : ''; })(),
      cols: getComputedStyle(document.querySelector('.pwl-grid')).gridTemplateColumns.split(' ').length, q: T.q.slice() };
  });
  console.log(JSON.stringify({ codes: A.codes, pg: A.pg, sum: A.sum, grps: A.grps, wk: A.wk, q: A.q }));
  const md = (s) => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  t('왼쪽 「🗓 주간계획 모아보기」 → VIEW plwall · 이번 주(' + md(MON) + '~) 기본', A.v === 'plwall' && A.wk.indexOf(md(MON) + '~' + md(add(MON, 6)) + ' 이번 주') === 0, A.v + ' ' + A.wk);
  t('한 화면 6명 · 3칸(1600px) · 「1 / 2」 (전체 10명)', A.n === 6 && A.cols === 3 && A.pg === '1 / 2', JSON.stringify([A.n, A.cols, A.pg]));
  t('반 칩: 전체 10 · M4 7 · T5 3', JSON.stringify(A.grps) === JSON.stringify(['전체 10', 'M4 7', 'T5 3']), JSON.stringify(A.grps));
  t('안 낸 학생 먼저: 첫 5장 = 안 낸 5명(○○○2·4·6·9·10)', A.codes.slice(0, 5).sort().join() === NOSUB.map((n) => C[n]).sort().join() && A.codes[5] && SUBMITTED.map((n) => C[n]).indexOf(A.codes[5]) >= 0, JSON.stringify(A.codes));
  const nIt = [1, 3, 5, 7, 8].reduce((s, n) => s + (n === 3 ? 2 : PLANS[n].items.length), 0) + PLANS[4].items.length;
  t('요약: 5/10명 계획 냄 · 할 일 ' + nIt + '개 · 실천 ✓ 2개 · 안 낸 5명 → 💬 모아서 알림', /5\/10명 계획 냄/.test(A.sum) && new RegExp('할 일 ' + nIt + '개').test(A.sum) && /실천 ✓ 2개/.test(A.sum) && /안 낸 5명/.test(A.sum) && /모아서 알림/.test(A.sum) && /안 낸 학생 먼저/.test(A.sum), A.sum);
  t('자료 읽기: 주간 점수와 같은 한 번의 or 질의 + wpmsg_% 한 번 (학생마다 따로 읽지 않음)', A.q.filter((x) => /or:key\.like\.wplan_%/.test(x)).length >= 1 && A.q.filter((x) => /like:wpmsg_%/.test(x)).length >= 1 && !A.q.some((x) => /eq:wplan_/.test(x)), JSON.stringify(A.q));

  /* ③ 다음 6명 · 반 칩 */
  await pg.click('.pwl-pg button:last-child'); await settle(300);
  const B = await pg.evaluate(() => ({ n: document.querySelectorAll('.pwl-card').length, pg: document.querySelector('.pwl-pgn').textContent, dis: document.querySelector('.pwl-pg button:last-child').disabled, codes: [...document.querySelectorAll('.pwl-card')].map((c) => c.getAttribute('data-code')) }));
  t('「다음 6명 ›」 → 4장 · 2 / 2 · 다음 단추 꺼짐', B.n === 4 && B.pg === '2 / 2' && B.dis, JSON.stringify(B));
  await pg.click('.pwl-grps .pwl-c[data-g="M4"]'); await settle(300);
  const B2 = await pg.evaluate(() => ({ n: document.querySelectorAll('.pwl-card').length, pg: document.querySelector('.pwl-pgn').textContent, codes: [...document.querySelectorAll('.pwl-card')].map((c) => c.getAttribute('data-code')), sum: document.querySelector('.pwl-sum').innerText }));
  t('M4 칩 → 첫 쪽으로 · 6명 · 1 / 2 · M4 학생만 · 요약 3/7… 안 낸 3명', B2.n === 6 && B2.pg === '1 / 2' && B2.codes.every((c) => /^AAA/.test(c)) && /4\/7명 계획 냄/.test(B2.sum) && /안 낸 3명/.test(B2.sum), JSON.stringify(B2));
  await pg.click('.pwl-grps .pwl-c[data-g="T5"]'); await settle(300);
  const B3 = await pg.evaluate(() => ({ n: document.querySelectorAll('.pwl-card').length, pg: document.querySelector('.pwl-pgn').textContent }));
  t('T5 칩 → 3명 · 1 / 1', B3.n === 3 && B3.pg === '1 / 1', JSON.stringify(B3));
  await pg.click('.pwl-sort .pwl-c:nth-of-type(2)'); await settle(200);
  const B4 = await pg.evaluate(() => [...document.querySelectorAll('.pwl-card')].map((c) => c.querySelector('.pwl-ch b').textContent));
  t('정렬 「이름」 → ○○○10 · ○○○8 · ○○○9 (가나다)', JSON.stringify(B4) === JSON.stringify(['○○○10', '○○○8', '○○○9']), JSON.stringify(B4));
  await pg.click('.pwl-grps .pwl-c[data-g="M4"]'); await pg.click('.pwl-sort .pwl-c:nth-of-type(1)'); await settle(300);

  /* ④ 출처 구분 · 고정 일정 · 실천 ✓ */
  const S = await pg.evaluate(() => {
    const one = (c) => { const el = document.querySelector('.pwl-card[data-code="' + c + '"]'); if (!el) return null;
      const its = [...el.querySelectorAll('.pwl-it')];
      return { codi: its.filter((x) => x.dataset.src === 'codi').length, me: its.filter((x) => x.dataset.src === 'me').length,
        codiSolid: its.filter((x) => x.dataset.src === 'codi').every((x) => getComputedStyle(x).borderTopStyle === 'solid' && /^🧭/.test(x.textContent)),
        meDashed: its.filter((x) => x.dataset.src === 'me').every((x) => getComputedStyle(x).borderTopStyle === 'dashed' && /^✏️/.test(x.textContent)),
        done: its.filter((x) => x.classList.contains('done')).map((x) => x.dataset.id), doneOutline: its.filter((x) => x.classList.contains('done')).map((x) => getComputedStyle(x).outlineColor + ' ' + getComputedStyle(x).outlineStyle),
        foot: el.querySelector('.pwl-ft').textContent, tags: (el.querySelector('.pwl-tags') || {}).textContent || '', tag: el.querySelector('.pwl-tag').textContent,
        fx: [...el.querySelectorAll('.pwl-fx')].map((x) => x.className.replace('pwl-fx ', '') + ':' + x.textContent), lumBg: (el.querySelector('.pwl-fx.lum') ? getComputedStyle(el.querySelector('.pwl-fx.lum')).backgroundColor : ''), schBg: (el.querySelector('.pwl-fx.sch') ? getComputedStyle(el.querySelector('.pwl-fx.sch')).backgroundColor : ''),
        rm: !!el.querySelector('.pwl-rm') }; };
    const out = {}; ['AAA111', 'AAA222', 'AAA333', 'AAA444'].forEach((c) => { out[c] = one(c); });
    PLWALL.page = 1; render(); out.AAA777 = one('AAA777'); out.p2 = PLWALL.vis.slice(); PLWALL.page = 0; render(); return out;
  });
  console.log(JSON.stringify(S, null, 0));
  const s1 = S.AAA111, s3 = S.AAA333, s7 = S.AAA777, s2 = S.AAA222, s4 = S.AAA444;
  t('○○○1: 🧭 코디 3칸 실선 · ✏️ 직접 2칸 점선', s1 && s1.codi === 3 && s1.me === 2 && s1.codiSolid && s1.meDashed, JSON.stringify(s1));
  t('○○○1 아래 줄 「실천 1/5 · 코디 3 · 직접 2 · 시간 5.5h」 · 실천 ✓ 초록 테두리(a4)', s1 && s1.foot === '실천 1/5 · 코디 3 · 직접 2 · 시간 5.5h' && JSON.stringify(s1.done) === '["a4"]' && /rgb\(22, 163, 74\) solid/.test(s1.doneOutline[0]), JSON.stringify(s1 && [s1.foot, s1.done, s1.doneOutline]));
  t('○○○1 고정 일정 = codi_fixed_(학교 5일 · 영어학원 2일 회색) + 루멘 수업 2일(빨강) · 📌 태그 없음', s1 && s1.fx.filter((x) => /^sch:/.test(x)).length === 5 && s1.fx.filter((x) => /^oth:영어학원/.test(x)).length === 2 && s1.fx.filter((x) => x === 'lum:루멘 수업').length === 2 && /rgb\(254, 226, 226\)/.test(s1.lumBg) && /rgb\(229, 231, 235\)/.test(s1.schBg) && !/고정 일정 안 넣음/.test(s1.tags), JSON.stringify(s1 && [s1.fx, s1.lumBg, s1.schBg, s1.tags]));
  t('○○○3: 코디 계획만 → 「🧭 코디 계획 2개」 · 코디 2 실선 · 📌 고정 일정 안 넣음(학교 기본)', s3 && s3.codi === 2 && s3.me === 0 && s3.codiSolid && /코디 계획 2개/.test(s3.tag) && /📌 고정 일정 안 넣음\(학교 기본\)/.test(s3.tags), JSON.stringify(s3));
  t('○○○7: codi_done_ 로 코디 칸 ✓ · 아침 8시 할 일도 9시 칸 위에 보임', s7 && JSON.stringify(s7.done) === '["g1"]' && s7.codi === 1 && s7.me === 1, JSON.stringify(s7));
  t('○○○2: 「안 냄」 · 「💬 알림」 · 학교 기본 시간(학교 5일) + 루멘', s2 && s2.tag === '안 냄' && s2.rm && s2.fx.filter((x) => /^sch:학교/.test(x)).length === 5 && /고정 일정 안 넣음/.test(s2.tags), JSON.stringify(s2));
  t('○○○4: 할 일 있어도 「계획 내기」 전이면 「안 냄」 + 쓰는 중 2개', s4 && s4.tag === '안 냄' && /✏️ 쓰는 중 2개/.test(s4.tags) && s4.me === 2, JSON.stringify(s4));
  /* 모든 보이는 카드에서 출처 개수가 자료와 같은지 */
  const SRC = await pg.evaluate(() => { const P = PLWALL.W || PW.thisMon(); return PLWALL.vis.map((c) => { const el = document.querySelector('.pwl-card[data-code="' + c + '"]'); const items = wppPlan(c, P).items.filter((x) => x.t);
    return { c, wantCodi: items.filter((x) => x.src === 'codi').length, wantMe: items.filter((x) => x.src !== 'codi').length, codi: el.querySelectorAll('.pwl-it.codi').length, me: el.querySelectorAll('.pwl-it.me').length }; }); });
  t('보이는 6장 모두: 실선 🧭 개수 = 코디 할 일 · 점선 ✏️ 개수 = 직접 할 일', SRC.length === 6 && SRC.every((x) => x.codi === x.wantCodi && x.me === x.wantMe), JSON.stringify(SRC));

  /* ⑤ 카드 누르면 큰 달력 창 */
  await pg.click('.pwl-card[data-code="AAA111"] .pwl-ch'); await settle(300);
  const K = await pg.evaluate(() => { const ov = document.getElementById('plw-cal-ov'); const r = { open: !!ov, code: PWC.code, W: PWC.W, txt: ov ? ov.innerText.slice(0, 120) : '', order: PWB.order.slice() }; return r; });
  t('카드 누르면 큰 달력 창(plwCal) — ○○○1 · 같은 주 · ‹ › 순서 = 이 화면 순서', K.open && K.code === 'AAA111' && K.W === MON && /○○○1/.test(K.txt) && K.order.length === 7, JSON.stringify(K));
  await pg.evaluate(() => plwCalClose()); await settle(100);

  /* ⑥ 💬 모아서 알림 (M4 → 안 낸 3명) */
  await pg.evaluate(() => { T.ups = []; T.toasts = []; });
  await pg.click('#pwl-remind-all'); await settle(200);
  const D0 = await pg.evaluate(() => { const ov = document.getElementById('plw-rem-ov'); return { open: !!ov, codes: ov && ov.getAttribute('data-codes'), txt: (document.getElementById('plw-rem-txt') || {}).value, n: (document.getElementById('plw-rem-n') || {}).textContent, names: ov ? [...ov.querySelectorAll('.plw-rem-nm')].map((x) => x.textContent) : [], pt: PW.PT.plan.ok }; });
  t('확인 창: 3명 · 이름 · 기본 글(점수는 PW.PT) · 글 고칠 수 있음', D0.open && D0.n === '3명' && D0.codes.split(',').sort().join() === 'AAA222,AAA444,AAA666' && D0.names.length === 3 && /계획을 아직 안 냈어요/.test(D0.txt) && new RegExp('(' + D0.pt + '|2)점!').test(D0.txt), JSON.stringify(D0));
  await pg.fill('#plw-rem-txt', '계획 내 주세요! (검사)');
  await pg.click('#plw-rem-go'); await settle(800);
  const D = await pg.evaluate(() => ({ ov: !!document.getElementById('plw-rem-ov'), msgs: Object.keys(T.store).filter((k) => /^wpmsg_/.test(k)).sort(), w: T.store.wpmsg_AAA222, sp2: T.store.student_planner_AAA222.teacherComment, sp4: T.store.student_planner_AAA444 || null,
    ups: T.ups.map((u) => u.keys.join('+') + ':' + u.upd[0]), toast: T.toasts.slice(-1)[0] || '', sent: (document.querySelector('.pwl-card[data-code="AAA222"] .pwl-sent') || {}).textContent || '' }));
  console.log(JSON.stringify(D));
  const e2 = D.w && D.w.weeks && D.w.weeks[MON];
  t('모아서 알림 = 안 낸 3명에게만 wpmsg_ (○○○2·4·6) — v19-114 모양 { text, like:false, at, remind } + log', JSON.stringify(D.msgs) === '["wpmsg_AAA222","wpmsg_AAA444","wpmsg_AAA666"]' && e2 && e2.text === '계획 내 주세요! (검사)' && e2.like === false && e2.remind === true && D.w.code === 'AAA222' && D.w.log.length === 1 && !D.ov, JSON.stringify(D.msgs) + ' ' + JSON.stringify(D.w));
  t('학생앱 줄(student_planner_.teacherComment)에 들어감 · 줄 없는 학생은 새로 안 만듦 · updated_at 안 보냄', /계획 내 주세요! \(검사\) — 원장님$/.test(D.sp2) && !D.sp4 && D.ups.indexOf('student_planner_AAA222:false') >= 0 && !D.ups.some((u) => /student_planner_AAA444/.test(u)) && /3명에게 보냈어요/.test(D.toast) && /첫 승인 때/.test(D.toast), JSON.stringify([D.sp2, D.ups, D.toast]));
  t('카드에 「💬 보냄 시각」 · 「다시 알림」', /💬 보냄 \d+\/\d+ \d\d:\d\d/.test(D.sent), D.sent);
  /* 한 명 💬 알림 · 취소 */
  await pg.evaluate(() => { T.ups = []; }); await pg.click('.pwl-card[data-code="AAA222"] .pwl-rm'); await settle(200);
  const D2 = await pg.evaluate(() => ({ codes: document.getElementById('plw-rem-ov').getAttribute('data-codes'), cal: !!document.getElementById('plw-cal-ov') }));
  await pg.click('#plw-rem-no'); await settle(100);
  const D3 = await pg.evaluate(() => ({ ov: !!document.getElementById('plw-rem-ov'), ups: T.ups.length }));
  t('카드의 「💬 다시 알림」 = 그 학생만(카드 열기 안 함) · 취소하면 아무것도 안 씀', D2.codes === 'AAA222' && !D2.cal && !D3.ov && D3.ups === 0, JSON.stringify([D2, D3]));

  /* ⑦ 🖨 6명 한 장 */
  await pg.evaluate(() => { T.opened = []; }); await pg.click('#pwl-print'); await settle(100);
  const PR = await pg.evaluate(() => { const h = (T.opened[0] || {}).html || ''; const d = document.createElement('div'); d.innerHTML = h.replace(/<script[\s\S]*?<\/script>/g, ''); return { n: d.querySelectorAll('.pwl-card').length, a4: /@page\{size:A4 landscape/.test(h), one: (h.match(/class="pp"/g) || []).length, btn: d.querySelectorAll('.pwl-card .pwl-rm').length, print: /window\.print/.test(h) }; });
  t('🖨 = 새 창 한 장(A4 가로) · 보이는 6장 · 알림 단추는 안 찍힘', PR.n === 6 && PR.a4 && PR.one === 1 && PR.btn === 0 && PR.print, JSON.stringify(PR));
  /* 주 넘기기 */
  await pg.click('.pwl-hd .pwl-gp:first-of-type .pwl-c:last-child'); await settle(300);
  const WK = await pg.evaluate(() => ({ W: PLWALL.W, lab: document.querySelector('.pwl-hd .pwl-c.on').textContent, sum: document.querySelector('.pwl-sum').innerText }));
  await pg.click('.pwl-hd .pwl-gp:first-of-type .pwl-c:nth-child(2)'); await settle(300);
  const WK2 = await pg.evaluate(() => PLWALL.W);
  t('주 › → 다음 주(' + md(NX) + ') · 가운데 칩 → 이번 주', WK.W === NX && /다음 주/.test(WK.lab) && WK2 === MON, JSON.stringify([WK, WK2]));

  /* ⑧ 그림 1500 (전체 반 · 첫 쪽) */
  await pg.setViewportSize({ width: 1500, height: 1000 });
  await pg.evaluate(() => { PLWALL.grp = ''; PLWALL.page = 0; const h = document.querySelector('.ui-scroll-hint, #uiScrollHint'); if (h) h.style.display = 'none'; render(); }); await settle(400);
  await pg.screenshot({ path: SP + '/v19115_wall.png', fullPage: false });

  /* ⑨ 폭: 1600 / 1180 / 820 / 420 — 칸 수 · 가로 스크롤 없음 */
  const WS = {};
  for (const w of [1600, 1180, 820, 420]) {
    await pg.setViewportSize({ width: w, height: 900 }); await settle(300);
    if (w === 420) await pg.evaluate(() => { mobSetPc(true); });
    await pg.evaluate(() => { VIEW = 'plwall'; render(); }); await settle(300);
    WS[w] = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, cols: getComputedStyle(document.querySelector('.pwl-grid')).gridTemplateColumns.split(' ').length,
      over: [...document.querySelectorAll('.pwl-card')].filter((c) => c.getBoundingClientRect().right > innerWidth + 1).length }));
  }
  console.log(JSON.stringify(WS));
  t('모아보기 칸: 1600·1180(아이패드 가로) 3칸 · 820 2칸 · 420 1칸', WS[1600].cols === 3 && WS[1180].cols === 3 && WS[820].cols === 2 && WS[420].cols === 1, JSON.stringify(WS));
  t('모아보기 가로 스크롤 없음 (1600/1180/820/420)', [1600, 1180, 820, 420].every((w) => WS[w].sw <= w && WS[w].bw <= w && WS[w].over === 0), JSON.stringify(WS));
  await pg.evaluate(() => { mobSetPc(false); });
  await pg.setViewportSize({ width: 1600, height: 1000 }); await settle(300);

  /* ═════ B. 📅 주간 점수 — 체크하기 / 점수 보기 ═════ */
  await pg.evaluate(() => { try { localStorage.removeItem('wkc_mode'); } catch (e) {} VIEW = 'plweek'; PWB.W = null; render(); }); await settle(500);
  const B0 = await pg.evaluate(() => ({ mode: (document.querySelector('.wkc-mode') || {}).dataset ? document.querySelector('.wkc-mode').dataset.mode : '', def: wkcDefaultMode(), cg: wkcClassGroups(),
    tabs: [...document.querySelectorAll('.wkc-seg [role=tab]')].map((b) => b.textContent + '|' + b.getAttribute('aria-selected')), cnt: (document.querySelector('#wkc-tab-check .cnt') || {}).textContent }));
  console.log(JSON.stringify(B0));
  t('머리에 「✅ 체크하기 (n)」|「📊 점수 보기」 · 오늘 수업 반(M4) 있음 → 기본 체크하기', B0.mode === 'check' && B0.def === 'check' && JSON.stringify(B0.cg) === '["M4"]' && /^✅ 체크하기/.test(B0.tabs[0]) && /true$/.test(B0.tabs[0]) && /^📊 점수 보기\|false$/.test(B0.tabs[1]), JSON.stringify(B0));
  const CK = await pg.evaluate(() => {
    const card = (k) => document.querySelector('.wkc-task[data-task="' + k + '"]');
    const rows = (k) => [...card(k).querySelectorAll('.wkc-row')].map((r) => r.dataset.code + ':' + r.dataset.state);
    return { cnt: document.querySelector('#wkc-tab-check .cnt').textContent, paper: rows('paper'), photo: rows('photo'), planN: card('plan').querySelector('.wkc-h').textContent, planBtn: (document.getElementById('wkc-remind') || {}).textContent,
      open: ['paper', 'photo', 'plan'].map((k) => card(k).open), nums: document.querySelectorAll('.wkc-mode .wks-pill').length, noTable: !document.querySelector('.wkc-mode table'),
      planChips: [...card('plan').querySelectorAll('.wkc-chip')].map((x) => x.textContent) };
  });
  console.log(JSON.stringify(CK));
  t('📔 종이 카드: 오늘 수업 반(M4)만 — 가져온 ○○○1 빼고 6명 남음', CK.paper.length === 6 && CK.paper.every((x) => /:left$/.test(x)) && !CK.paper.some((x) => /^AAA111/.test(x)) && CK.paper.every((x) => /^AAA/.test(x)), JSON.stringify(CK.paper));
  t('📸 사진 카드: 늦게 낸 ○○○5 · 사진 없이 낸 ○○○6 만', CK.photo.slice().sort().join() === 'AAA555:left,AAA666:left', JSON.stringify(CK.photo));
  /* 「안 낸 학생」은 알림을 이미 보낸 ○○○2·4·6 이 (모아보기에서 보낸 주가 계획 주와 같으면) 알림 보냄으로 빠진다 */
  const planP = await pg.evaluate(() => wkcTasks().plan.P);
  const NOSUBP = planP === MON ? NOSUB : NOSUB.concat([3]);   /* 월요일이 지나면 계획 주 = 다음 주 — ○○○3 코디 계획은 이번 주 것뿐 */
  const planLeft = planP === MON ? 2 : NOSUBP.length;
  t('📅 계획 카드: 안 낸 학생 ' + NOSUBP.length + '명 · 「💬 ' + planLeft + '명에게 알림」 · 명단', new RegExp('안 낸 학생 ' + NOSUBP.length + '명').test(CK.planN) && CK.planBtn === '💬 ' + planLeft + '명에게 알림' && CK.planChips.length === NOSUBP.length, JSON.stringify([CK.planN, CK.planBtn, CK.planChips, planP]));
  t('체크하기 = 점수 숫자 없음(표 없음) · 할 일 카드 셋 다 펼침 · 숫자 배지 = 6 + 2 + 1 = 9', CK.noTable && CK.nums === 0 && CK.open.every(Boolean) && CK.cnt === '9', JSON.stringify(CK));
  await pg.screenshot({ path: SP + '/v19115_check.png', fullPage: false });
  const G = await pg.evaluate(() => {
    const sec = (k) => [...document.querySelectorAll('.wkc-task[data-task="' + k + '"] .wkg-sec')].map((x) => x.dataset.group + (x.classList.contains('today') ? '*' : '') + ':' + x.querySelectorAll('.wkc-row').length);
    const g = document.querySelector('.wkc-task[data-task="manual"] .wkg-grid');
    const d = document.querySelector('.wkc-task[data-task="manual"]'); d.open = true;
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    const hd = (document.querySelector('.wkc-task[data-task="paper"] .wkg-hd') || {}).textContent;
    const stray = document.querySelectorAll('.wkc-task[data-task="paper"] > .wkc-row[data-code], .wkc-task[data-task="manual"] .wkc-all > .wkc-row').length;
    return { paper: sec('paper'), manual: sec('manual'), cols, hd, stray, w: innerWidth };
  });
  t('체크하기 반별 묶음 — 종이: 오늘 수업 반 M4 만(오늘 표시) · 손으로 고치기: M4(오늘) 7명 → T5 3명', JSON.stringify(G.paper) === '["M4*:6"]' && JSON.stringify(G.manual) === '["M4*:7","T5:3"]' && G.stray === 0, JSON.stringify(G));
  t('묶음 머리 「M4 반 · 6명 · 남은 n · 오늘 수업」', /^M4 반6명 · 남은 \d+오늘 수업$/.test(G.hd || ''), G.hd);
  t('넓은 화면 = 한 줄에 두 명', G.cols === 2, G.cols + ' @' + G.w);
  await pg.evaluate(() => { const d = document.querySelector('.wkc-task[data-task="manual"]'); d.open = false; });
  await pg.screenshot({ path: SP + '/v19118_check.png', fullPage: false });

  /* 종이: 가져옴 / 안 가져옴 — 같은 저장 길(plweek_paper) */
  await pg.evaluate(() => { T.ups = []; });
  await pg.click('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA222"] .wkc-tb[data-act="at"]'); await settle(400);
  await pg.click('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA333"] .wkc-tb[data-act="miss"]'); await settle(400);
  const PP = await pg.evaluate(({ W }) => ({ r2: T.store.plweek_paper.byCode.AAA222[W], r3: T.store.plweek_paper.byCode.AAA333[W], ups: T.ups.map((u) => u.keys.join('+')), s2: plwScore(students.find((s) => s.lumen_rec_code === 'AAA222'), W),
    rows: [...document.querySelectorAll('.wkc-task[data-task="paper"] .wkc-row')].map((r) => r.dataset.code + ':' + r.dataset.state), cnt: document.querySelector('#wkc-tab-check .cnt').textContent }), { W });
  console.log(JSON.stringify(PP));
  t('「📔 가져옴」 → plweek_paper.byCode[○○○2][W].at (예전 「📔 가져옴 ✓」와 같은 판정)', PP.r2 && !!PP.r2.at && PP.s2.paperAt === PP.r2.at && PP.ups.filter((k) => k === 'plweek_paper').length === 2, JSON.stringify(PP));
  t('「안 가져옴」 → miss = 오늘 · 점수 0 그대로 · 두 줄은 ✓ 표시로 남고 숫자 배지 9 → 7', PP.r3 && PP.r3.miss === TODAY && !PP.r3.at && PP.rows.indexOf('AAA222:at') >= 0 && PP.rows.indexOf('AAA333:miss') >= 0 && PP.cnt === '7', JSON.stringify(PP));
  /* 사진: 인정 / 다시 내기 → pov */
  await pg.click('.wkc-task[data-task="photo"] .wkc-row[data-code="AAA555"] .wkc-tb[data-act="ok"]'); await settle(400);
  await pg.click('.wkc-task[data-task="photo"] .wkc-row[data-code="AAA666"] .wkc-tb[data-act="redo"]'); await settle(400);
  const PH = await pg.evaluate(({ W }) => { const st5 = students.find((s) => s.lumen_rec_code === 'AAA555'), st6 = students.find((s) => s.lumen_rec_code === 'AAA666');
    return { r5: T.store.plweek_paper.byCode.AAA555[W], r6: T.store.plweek_paper.byCode.AAA666[W], s5: plwScore(st5, W), s6: plwScore(st6, W), card: document.querySelector('.wkc-task[data-task="photo"]').open, cnt: document.querySelector('#wkc-tab-check .cnt').textContent }; }, { W });
  console.log(JSON.stringify(PH));
  t('「✓ 인정」 = pov(지각은 지각 2점으로 굳힘) · 「✕ 다시 내기」 = pov none + povWhy 다시 내기 요청 · 사진 카드 접힘', PH.r5.pov === 'late' && PH.s5.photoPt === 2 && PH.s5.photoOv && PH.r6.pov === 'none' && PH.r6.povWhy === '다시 내기 요청' && PH.s6.photoPt === 0 && PH.card === false && PH.cnt === '5', JSON.stringify(PH));
  /* 가져옴은 사진 손 고침(pov)을 지우지 않는다 */
  await pg.click('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA555"] .wkc-tb[data-act="at"]'); await settle(400);
  const PV = await pg.evaluate(({ W }) => T.store.plweek_paper.byCode.AAA555[W], { W });
  t('사진을 고친 뒤 「📔 가져옴」 해도 pov 그대로 (예전엔 지워졌음)', PV.at && PV.pov === 'late' && /인정/.test(PV.povWhy), JSON.stringify(PV));
  /* 다시 낸 사진은 다시 확인 카드로 */
  await pg.evaluate(({ W }) => { PWB.sg.AAA666[W] = Object.assign({}, PWB.sg.AAA666[W], { photo: 'AAA666/new.jpg', at: new Date(Date.now() + 1000).toISOString() }); render(); }, { W }); await settle(200);
  const RE = await pg.evaluate(() => [...document.querySelectorAll('.wkc-task[data-task="photo"] .wkc-row')].map((r) => r.dataset.code + ':' + r.dataset.state + ':' + r.querySelector('.wkc-why2').textContent));
  t('「다시 내기」 뒤 학생이 새로 내면 → 사진 카드에 「다시 냄」으로 다시', RE.some((x) => /^AAA666:left:다시 냄/.test(x)), JSON.stringify(RE));
  /* «…» = 예전 「자동▾」 (자동 · 제출 · 지각 · 미제출) */
  const OPT = await pg.evaluate(() => { const d = document.querySelector('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA444"] .wkc-more'); d.open = true;
    return [...d.querySelectorAll('.wkc-pop > div:first-child .wkc-ob')].map((b) => b.textContent + '=' + (b.getAttribute('onclick').match(/,'(\w*)'\)/) || [])[1]); });
  t('«…» 종이 판정 = 예전 select 와 같은 값: 자동 · 제출(ok) · 지각(late) · 미제출(none)', JSON.stringify(OPT) === JSON.stringify(['자동=', '제출=ok', '지각=late', '미제출=none']), JSON.stringify(OPT));
  await pg.click('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA444"] .wkc-more .wkc-pop > div:first-child .wkc-ob:nth-of-type(3)'); await settle(400);
  const OV = await pg.evaluate(({ W }) => ({ r: T.store.plweek_paper.byCode.AAA444[W], s: plwScore(students.find((s) => s.lumen_rec_code === 'AAA444'), W) }), { W });
  t('«…» 지각 → plwPaperOv → ov late · 종이 2점', OV.r && OV.r.ov === 'late' && OV.s.paperPt === 2, JSON.stringify(OV));
  /* 전체 학생 손 고침 칸 */
  const MAN = await pg.evaluate(() => { const d = document.querySelector('.wkc-task[data-task="manual"]'); return { n: d.querySelectorAll('.wkc-row').length, more: d.querySelectorAll('.wkc-more').length, open: d.open }; });
  t('「✋ 손으로 고치기 — 전체 학생」: 10명 모두 «…» (접혀 있음)', MAN.n === 10 && MAN.more === 10 && !MAN.open, JSON.stringify(MAN));
  /* 이름 → 오른쪽 주간계획표 */
  await pg.click('.wkc-task[data-task="paper"] .wkc-row[data-code="AAA666"] .wkc-nm'); await settle(500);
  const RP = await pg.evaluate(() => ({ sel: WPP.sel, h: (document.querySelector('#wpp-panel h3') || {}).textContent || '' }));
  t('체크하기에서 이름 → v19-114 오른쪽 주간계획표(○○○6)', RP.sel === 'AAA666' && RP.h === '📅 ○○○6 주간계획표', JSON.stringify(RP));
  /* 오늘 수업 반만 끄기 → 전체 */
  await pg.click('.wkc-opt input'); await settle(300);
  const ALL = await pg.evaluate(() => [...document.querySelectorAll('.wkc-task[data-task="paper"] .wkc-row')].map((r) => r.dataset.code + ':' + r.dataset.state));
  t('「오늘 수업 반만」 끄면 T5 학생도 (BBB…)', ALL.filter((x) => /^BBB/.test(x)).length === 3, JSON.stringify(ALL));
  await pg.click('.wkc-opt input'); await settle(300);
  /* 계획 알림 */
  await pg.evaluate(() => { T.ups = []; }); await pg.click('#wkc-remind'); await settle(200);
  const PR2 = await pg.evaluate(() => ({ codes: document.getElementById('plw-rem-ov').getAttribute('data-codes'), wk: document.getElementById('plw-rem-ov').getAttribute('data-week') }));
  await pg.click('#plw-rem-go'); await settle(800);
  const PR3 = await pg.evaluate(({ planP }) => ({ msgs: Object.keys(T.store).filter((k) => /^wpmsg_/.test(k)).filter((k) => (T.store[k].weeks || {})[planP]).sort(), card: document.querySelector('.wkc-task[data-task="plan"]').open, h: document.querySelector('.wkc-task[data-task="plan"] .wkc-n').textContent }), { planP });
  t('📅 「💬 n명에게 알림」 → 같은 확인 창 → 안 낸 학생에게만 · 카드 접힘(✓ 모두 알림 보냄)', PR2.wk === planP && PR3.msgs.length === NOSUBP.length && PR3.msgs.every((k) => NOSUBP.map((n) => 'wpmsg_' + C[n]).indexOf(k) >= 0) && PR3.card === false && /모두 알림 보냄/.test(PR3.h), JSON.stringify([PR2, PR3]));
  await pg.evaluate(() => { T.opened = []; wkcPrintPlan(); });
  const LP = await pg.evaluate(() => (T.opened[0] || {}).html || '');
  t('명단 인쇄 = 안 낸 학생 표', (LP.match(/<tr><td>\d+<\/td>/g) || []).length === NOSUBP.length && /○○○9/.test(LP) && !/○○○1<\/td>/.test(LP), LP.slice(0, 120));
  /* 남은 종이 끝내기 → 「이번 주 체크 끝 🎉」 */
  await pg.evaluate(async () => { const T0 = wkcTasks(); for (const r of T0.paper.rows) if (r.state === 'left') await wkcPaperMiss(r.c); for (const r of T0.photo.rows) if (r.state === 'left') await wkcPhoto(r.c, 'ok'); render(); });
  await settle(500);
  const FIN = await pg.evaluate(() => ({ fin: (document.querySelector('.wkc-fin') || {}).textContent || '', cnt: (document.querySelector('#wkc-tab-check .cnt') || {}).textContent, open: [...document.querySelectorAll('.wkc-task')].map((d) => d.dataset.task + ':' + d.open + ':' + d.classList.contains('done')) }));
  t('다 끝나면 「이번 주 체크 끝 🎉」 · 배지 ✓ · 카드 셋 접힘', /이번 주 체크 끝 🎉/.test(FIN.fin) && FIN.cnt === '✓' && FIN.open.slice(0, 3).every((x) => /:false:true$/.test(x)), JSON.stringify(FIN));

  /* ── 📊 점수 보기 ── */
  await pg.click('#wkc-tab-score'); await settle(400);
  const SC = await pg.evaluate(() => {
    const W = PWB.W || plwDefaultW(), tb = document.querySelector('.wkc-mode table');
    const rows = [...tb.querySelectorAll('tbody tr[data-wks]')].map((tr) => { const st = students.find((s) => s.lumen_rec_code === tr.dataset.wks), s = plwScore(st, W), d = plwDaySum(st, W);
      const p = [...tr.querySelectorAll('.wks-pill')]; return { c: tr.dataset.wks, got: p.map((x) => +x.textContent).concat([+tr.querySelector('.wks-sum').textContent]), want: [s.planPt, s.prac.pt, s.photoPt, s.paperPt, s.total],
        cls: p.map((x) => x.className.replace('wks-pill ', '')), bar: tr.querySelector('.wks-bar i').style.width, day: tr.querySelector('td.day').textContent, dwant: d.sum + '/' + (d.n * 10), tip: p[0].getAttribute('title') }; });
    return { mode: document.querySelector('.wkc-mode').dataset.mode, stored: localStorage.getItem('wkc_mode'), grp: [...tb.querySelectorAll('thead tr:first-child th.grp')].map((x) => x.textContent + '/' + x.colSpan), head: [...tb.querySelectorAll('thead tr:nth-child(2) th')].map((x) => x.innerText.replace(/\n/g, ' ')),
      ctrls: tb.querySelectorAll('button,select,input').length, rows, order: PWB.order.slice(), sortedOk: rows.every((r, i) => i === 0 || rows[i - 1].want[4] >= r.want[4]) };
  });
  console.log(JSON.stringify({ grp: SC.grp, head: SC.head, rows: SC.rows.slice(0, 4) }));
  t('「📊 점수 보기」 → 이 기기에 기억(wkc_mode, 오늘 날짜) · 묶음 머리 「📅 주간계획 10점」(2칸)「📔 순공 10점」(2칸)', SC.mode === 'score' && JSON.parse(SC.stored).m === 'score' && JSON.parse(SC.stored).d === TODAY && JSON.stringify(SC.grp) === JSON.stringify(['📅 주간계획 10점/2', '📔 순공 10점/2']) && /계획 5/.test(SC.head[1]) && /실천 5/.test(SC.head[2]) && /사진 5/.test(SC.head[3]) && /종이 5/.test(SC.head[4]) && /주간 합 \/20/.test(SC.head[5]), JSON.stringify([SC.grp, SC.head, SC.stored]));
  t('점수 표: 단추·고르기 칸 없음(보기만) · 10줄 · 주간 합 높은 순', SC.ctrls === 0 && SC.rows.length === 10 && SC.sortedOk, JSON.stringify([SC.ctrls, SC.rows.length]));
  t('점수 알약·주간 합 = plwScore(예전 표와 같은 계산) · 매일 합 같음', SC.rows.every((r) => JSON.stringify(r.got) === JSON.stringify(r.want) && r.day === r.dwant), JSON.stringify(SC.rows.filter((r) => JSON.stringify(r.got) !== JSON.stringify(r.want))));
  const colOk = SC.rows.every((r) => r.got.slice(0, 4).every((v, i) => r.cls[i] === (v >= 5 ? 's5' : v >= 3 ? 's3' : v >= 2 ? 's2' : v >= 1 ? 's1' : 's0')) && r.bar === Math.round(r.want[4] / 20 * 100) + '%');
  const someVals = new Set(); SC.rows.forEach((r) => r.got.slice(0, 4).forEach((v) => someVals.add(v)));
  t('알약 색 = 5 초록 · 3 파랑 · 2 주황 · 1 노랑 · 0 회색 · 막대 = 합/20 (값 ' + [...someVals].sort().join(',') + ')', colOk && someVals.has(5) && someVals.has(2) && someVals.has(0), JSON.stringify(SC.rows.map((r) => r.cls)));
  const r1 = SC.rows.find((r) => r.c === 'AAA111');
  t('칸 마우스(title) = 낸 시각', r1 && /낸 시각 \d+\/\d+ \d\d:\d\d/.test(r1.tip), r1 && r1.tip);
  await pg.click('tr[data-wks="AAA111"] .wks-pill[data-k="photo"]'); await settle(150);
  const TIP = await pg.evaluate(() => { const t = document.getElementById('wks-tip'); return { vis: t && getComputedStyle(t).display !== 'none', txt: t ? t.textContent : '', sel: WPP.sel }; });
  t('칸을 누르면 작은 말풍선(낸 시각) — 학생 고르기는 안 함', TIP.vis && /순공 사진/.test(TIP.txt) && /낸 시각/.test(TIP.txt) && TIP.sel === 'AAA666', JSON.stringify(TIP));
  await pg.click('tr[data-wks="AAA555"] .wks-nm'); await settle(500);
  const RP2 = await pg.evaluate(() => ({ sel: WPP.sel, h: (document.querySelector('#wpp-panel h3') || {}).textContent || '', selRows: [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.dataset.wks) }));
  t('점수 보기에서 이름 → 오른쪽 주간계획표(○○○5) · 그 줄만 파란 띠', RP2.sel === 'AAA555' && RP2.h === '📅 ○○○5 주간계획표' && JSON.stringify(RP2.selRows) === '["AAA555"]', JSON.stringify(RP2));
  await pg.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  const before = await pg.evaluate(() => PWB.order.indexOf(WPP.sel));
  await pg.keyboard.press('ArrowDown'); await settle(300);
  const KB = await pg.evaluate(() => ({ i: PWB.order.indexOf(WPP.sel), selRows: [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.dataset.wks) }));
  t('↓ 키 = 다음 학생 (점수 표 순서 그대로)', KB.i === before + 1 && KB.selRows.length === 1, JSON.stringify([before, KB]));
  await pg.evaluate(() => { const h = document.querySelector('.ui-scroll-hint, #uiScrollHint'); if (h) h.style.display = 'none'; const t = document.getElementById('wks-tip'); if (t) t.style.display = 'none'; });
  await pg.screenshot({ path: SP + '/v19115_score.png', fullPage: false });

  /* 기본 모드 규칙 · 기억 */
  const MD = await pg.evaluate(() => { const out = {}; _origSetItem('wkc_mode', JSON.stringify({ m: 'score', d: '2000-01-01' })); out.stale = wkcMode(); _origSetItem('wkc_mode', JSON.stringify({ m: 'check', d: PW.day() })); out.today = wkcMode();
    const save = PWB.days; PWB.days = {}; out.noClass = wkcDefaultMode(); PWB.days = save; out.isMon = PW.dow(PW.day()) === 0; _origSetItem('wkc_mode', JSON.stringify({ m: 'score', d: PW.day() })); return out; });
  t('기본: 수업 날 → 체크하기 · 수업 없고 월요일 아니면 점수 보기 · 오늘 고른 것은 기억 · 지난 날 기억은 무시', MD.stale === 'check' && MD.today === 'check' && MD.noClass === (MD.isMon ? 'check' : 'score'), JSON.stringify(MD));

  /* 폭: 1600/1180/820/420 × 두 모드 — 가로 스크롤 없음 */
  const PS = {};
  for (const m of ['check', 'score']) for (const w of [1600, 1180, 820, 420]) {
    await pg.setViewportSize({ width: w, height: 900 }); await settle(250);
    if (w === 420) await pg.evaluate(() => { mobSetPc(true); });
    await pg.evaluate((m) => { _origSetItem('wkc_mode', JSON.stringify({ m, d: PW.day() })); VIEW = 'plweek'; render(); }, m); await settle(300);
    PS[m + w] = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, mode: document.querySelector('.wkc-mode').dataset.mode,
      big: [...document.querySelectorAll('.wkc-tb')].filter((b) => b.getBoundingClientRect().height < 40 * (parseFloat(getComputedStyle(document.body).zoom) || 1) - 1).length }));
  }
  console.log(JSON.stringify(PS));
  t('주간 점수 두 모드 가로 스크롤 없음 (1600/1180/820/420)', Object.keys(PS).every((k) => PS[k].sw <= +k.replace(/\D/g, '') && PS[k].bw <= +k.replace(/\D/g, '')) && PS.check420.mode === 'check' && PS.score420.mode === 'score', JSON.stringify(PS));
  await pg.evaluate(() => { mobSetPc(false); }); await pg.setViewportSize({ width: 1600, height: 1000 }); await settle(200);

  t('가짜 서버로 바꾼 뒤 Supabase 로 나간 요청 없음 (외부망은 모두 막힘)', reqs.filter((u) => /^after:.*supabase/.test(u)).length === 0, reqs.filter((u) => /supabase/.test(u)).slice(0, 3).join(' '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
