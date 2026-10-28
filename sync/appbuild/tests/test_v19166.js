#!/usr/bin/env node
/* 학원앱 v19-166 검사 — 체크하기 «📅 어느 수업 날?»(지난 수업 날 놓친 종이 체크) · «…» 창 잘림 · 📛 거짓 제출 사진(Storage)
 *   가짜 반/학생은 v19-118 검사 그대로(○○○1~10 · M4 7명 · T5 3명). T5 수업 요일을 «이번 주 월요일»로 바꿔 «어제 놓친 반»을 만든다(오늘이 월요일이면 지난 날 검사는 건너뜀).
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19166.js lumen_v19-166.html [그림.png]
 * 바탕: 학원앱 v19-118 검사 — v19-115 체크하기 검사(줄 선택자만 반 묶음 안까지) + 반별 묶음·두 칸
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
const FILE = path.resolve(process.argv[2] || 'lumen_v19-166.html');
const SHOT = process.argv[3] || '';
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-166'])[0];
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
  lumen_group_days: { M4: [JSDAY, (JSDAY + 2) % 7], T5: [1, 3, 5] },   /* T5 = 월수금 */
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
  const PAST = JSDAY !== 1 && JSDAY !== 0;   /* 이번 주 월요일이 오늘보다 앞 (화~토) */
  await pg.evaluate(() => { T.seed(); VIEW = 'plweek'; PWB.loaded = false; render(); }); await settle(1500);
  await pg.evaluate(() => { wkcGo('check'); }); await settle(400);
  const md = (s) => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  const chips = () => pg.evaluate(() => [...document.querySelectorAll('.wkc-days .wkc-dc')].map((b) => ({ d: b.getAttribute('data-day'), on: b.classList.contains('on'), red: b.classList.contains('red'), tx: b.innerText.replace(/\s+/g, ' ') })));
  const rows = () => pg.evaluate(() => [...document.querySelectorAll('.wkc-task[data-task="paper"] .wkc-row[data-code]')].map((r) => r.getAttribute('data-code') + ':' + r.getAttribute('data-state')));
  let C1 = await chips();
  console.log(JSON.stringify(C1));
  if (PAST) {
    const mon = C1.find((c) => c.d === MON), td = C1.find((c) => c.d === TODAY);
    t('날짜 칩: 이번 주 월(' + md(MON) + ') T5 남은 3명 빨강 · 오늘 칩 켜짐', mon && mon.red && /T5/.test(mon.tx) && /남은 3명/.test(mon.tx) && td && td.on, JSON.stringify(C1));
    const miss = await pg.evaluate(() => (document.querySelector('.wkc-dmiss') || {}).innerText || '');
    t('«체크 못 한 날이 있어요» 안내', /체크 못 한 날이 있어요/.test(miss) && /3명/.test(miss), miss);
    t('기본(오늘): 종이 카드에 T5 학생 없음', (await rows()).every((r) => !/^BBB/.test(r)), JSON.stringify(await rows()));
    await pg.evaluate((d) => wkcDay(d), MON); await settle(300);
    let R = await rows();
    const lab = await pg.evaluate(() => document.querySelector('.wkc-task[data-task="paper"]').innerText);
    t('월 칩 누르면 → T5 3명(BBB) 남음 · «월 ' + md(MON) + ' 수업» 표시 · ⏪ 안내', R.filter((r) => /^BBB.*:left$/.test(r)).length === 3 && R.every((r) => /^BBB/.test(r)) && lab.indexOf('월 ' + md(MON) + ' 수업') >= 0 && /⏪/.test(lab), JSON.stringify(R) + ' ' + lab.slice(0, 200));
    const c8 = await pg.evaluate(() => [...document.querySelectorAll('.wkc-task[data-task="paper"] .wkc-row[data-code]')].map((r) => r.getAttribute('data-code'))[0]);
    await pg.evaluate((c) => { document.querySelector('.wkc-task[data-task="paper"] .wkc-row[data-code="' + c + '"] [data-act="at"]').click(); }, c8); await settle(500);
    const P = await pg.evaluate(({ c, W }) => { const r = ((T.store.plweek_paper || {}).byCode || {})[c] || {}; const st = students.find((s) => s.lumen_rec_code === c); const sc = plwScore(st, W); return { r: r[W], paper: sc.paper, pt: sc.paperPt }; }, { c: c8, W });
    t('지난 날 «📔 가져옴» → 가져온 날 = 그 월요일(' + MON + ') · 실제 누른 시각 chk · 종이 5점(제출)', P.r && String(P.r.at).indexOf(MON) === 0 && P.r.chk && P.r.back === MON && P.paper === 'ok' && P.pt === 5, JSON.stringify(P));
    const c9 = await pg.evaluate(() => [...document.querySelectorAll('.wkc-task[data-task="paper"] .wkc-row[data-state="left"]')].map((r) => r.getAttribute('data-code'))[0]);
    await pg.evaluate((c) => { document.querySelector('.wkc-task[data-task="paper"] .wkc-row[data-code="' + c + '"] [data-act="miss"]').click(); }, c9); await settle(500);
    const M2 = await pg.evaluate(({ c, W }) => (((T.store.plweek_paper || {}).byCode || {})[c] || {})[W], { c: c9, W });
    R = await rows(); C1 = await chips();
    t('지난 날 «안 가져옴» → miss = 그 월요일 · 칩 «남은 1명»', M2 && M2.miss === MON && !M2.at && /남은 1명/.test((C1.find((c) => c.d === MON) || {}).tx || ''), JSON.stringify(M2) + JSON.stringify(C1));
    await pg.evaluate((d) => wkcDay(d), TODAY); await settle(300);
    t('오늘 칩으로 돌아가면 예전처럼(오늘 반)', (await rows()).every((r) => !/^BBB/.test(r)) && ((await chips()).find((c) => c.d === TODAY) || {}).on);
  } else console.log('(오늘이 월/일요일 — 지난 수업 날 검사 건너뜀)');
  /* «…» 창 */
  const F = await pg.evaluate(async () => {
    const man = document.querySelector('.wkc-task[data-task="manual"]'); man.open = true;
    const dets = [...man.querySelectorAll('details.wkc-more')];
    const out = [];
    for (const d of dets.slice(0, 4)) { d.open = true; await new Promise((r) => setTimeout(r, 60)); const p = d.querySelector('.wkc-pop').getBoundingClientRect(), b = wkcClipBox(d); out.push({ l: Math.round(p.left), r: Math.round(p.right), bl: Math.round(b.l), br: Math.round(b.r), n: document.querySelectorAll('details.wkc-more[open]').length }); }
    return out;
  });
  t('«…» 창: 둘레 상자 안에 들어옴(왼쪽·오른쪽 안 잘림) · 한 번에 하나만 열림', F.length >= 2 && F.every((x) => x.l >= x.bl - 1 && x.r <= x.br + 1 && x.n === 1), JSON.stringify(F));
  if (SHOT) await pg.screenshot({ path: SHOT });
  /* 📛 거짓 제출 사진 — 등록부 urls 가 비어 있으면 Storage 에서 */
  const PH = await pg.evaluate(async () => {
    const D = (n) => pfAddD(pfToday(), -n), sid = (n, hm) => D(n).replace(/-/g, '') + '_' + hm, dot = (n) => D(n).replace(/-/g, '.');
    const a = sid(9, '2350'), b = sid(18, '2300');
    T.files = [a + '_x_planner_tomorrow.jpg', a + '_x_planner_today.jpg', b + '_x_photo1.jpg', 'zz_other.jpg'].map((n) => 'AAA111_' + n);
    window.getSupaClient = ((orig) => () => { const c = orig(); c.storage = { from: () => ({ list: (code) => { T.listed = (T.listed || 0) + 1; return Promise.resolve({ data: T.files.map((name) => ({ name })), error: null }); }, getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }) }) }; return c; })(window.getSupaClient);
    const st0 = students[0]; st0.lumen_planner_photos = [
      { setId: b, urls: [], reviewed: true, analysis: { date: dot(18), tasksTranscript: ['[O] 수학'] } },
      { setId: a, urls: [], reviewed: true, analysis: { date: dot(18), tasksTranscript: ['[O] 수학'], zeroDay: true, zeroReason: 'sameDate', zeroDup: { day: D(18), setId: b, sim: 90, hd: 2 }, studyScore: '0' } } ];
    pfOpen(st0.id, a);
    const first = document.body.innerText.indexOf('사진 불러오는 중') >= 0;
    await new Promise((r) => setTimeout(r, 400));
    if (students[0] !== st0) { students[0] = st0; render(); }   /* 검사 환경이 등록부를 다시 읽어 바꿔치기하면 되돌림 */
    const imgs = [...document.querySelectorAll('img[alt="이번 제출"]')].map((i) => i.getAttribute('src')), prev = [...document.querySelectorAll('img[alt="먼저 낸 것"]')].map((i) => i.getAttribute('src'));
    return { first, imgs, prev, listed: T.listed, keep: st0.lumen_planner_photos[1].urls.length };
  });
  t('📛 거짓 제출: 사진 주소 없으면 저장소에서 찾아 나란히(오늘 사진 먼저) · 목록은 한 번만 · 등록부는 그대로', PH.imgs.length === 2 && /planner_today/.test(PH.imgs[0]) && PH.prev.length === 1 && /photo1/.test(PH.prev[0]) && PH.listed === 1 && PH.keep === 0, JSON.stringify(PH));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
