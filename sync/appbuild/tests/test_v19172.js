#!/usr/bin/env node
/* 학원앱 v19-172 검사 — 🎯 학교별 시험 D-day (홈 카드 + 탭 아래 한 줄) · 바탕: v19-170 검사 — 📑 매쓰플랫 월간보고서 화면 (가짜 서버 mfrep_2026-10 · 학생 이름 ○○○) · 바탕: v19-169 검사 — 📄 오답 쌍둥이 숙제 화면 (가짜 학생 ○○○1~10 + 중3 1명 · M4=월수금(금요일 출제) · T5=화목토(토요일 출제) · 가짜 서버 wt_* 키)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19169.js lumen_v19-172.html [그림.png]
 * 바탕(가짜 서버·학생): 학원앱 v19-118 검사 — v19-115 체크하기 검사(줄 선택자만 반 묶음 안까지) + 반별 묶음·두 칸
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
const FILE = path.resolve(process.argv[2] || 'lumen_v19-172.html');
const SHOT = process.argv[3] || '';
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-172'])[0];
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
/* v19-170: 가짜 10월 보고서 목록 (이름 ○○○) */
STORE['mfrep_2026-10'] = { month: '2026-10', at: '2026-11-01T02:55:54Z', missing: [{ sid: 'I9', name: '○○○9' }],
  rows: [1, 2, 3, 4].map((n) => ({ sid: 'I' + n, name: '○○○' + n, grade: '중1', reportId: 9000 + n, title: '2026년 10월 보고서', scoringCount: 100 + n, correctRate: 60 + n, rank: 3, shared: n === 1, pdf: 'SUCCESS', createdAt: '2026-11-01T02:40:00', comment: n === 4 ? '' : ('○○○' + n + ' 학생은 이번 달에 꾸준히 학습했습니다.'), commentOn: n !== 3, n: 1 })) };
/* v19-172: 가짜 학사일정 — 옥길중 1·2학년 기말(D-46) · 범박고 기말(D-10) · 우리 학생 없는 학교(빠져야 함) */
STUDENTS.forEach((s, i) => { s.school = i < 6 ? '옥길중학교' : (i < 9 ? '범박고등학교' : ''); });
STORE.school_calendar = { schools: [
  { name: '옥길중학교', exams: [{ label: '2학기 기말', from: add(TODAY, 46), to: add(TODAY, 50), grades: ['1', '2'] }] },
  { name: '범박고등학교', exams: [{ label: '2학기 기말', from: add(TODAY, 10), to: add(TODAY, 13) }] },
  { name: '먼학교', exams: [{ label: '기말', from: add(TODAY, 5), to: add(TODAY, 6) }] }] };
STORE.mfrep_log = [{ at: '2026-11-01T02:56:00Z', action: 'list', month: '2026-10', n: 0, sms: false, result: { ok: 0, fail: 0 } }];

/* ── v19-169: 오답 쌍둥이 자료 ── */
STUDENTS.push({ id: 'S11', name: '○○○11', grade: '중학교 3학년', group: 'M4', lumen_rec_code: 'CCC111', lumen_planner: {} });
STORE.lumen_group_days = { M4: [1, 3, 5], T5: [2, 4, 6] };
STORE.wt_config = { on: true, start: '2026-10-01', chunk: 60, maxPer: 60, excludeGrades: ['중3'], skip: {}, v: 1 };
STORE.wt_scope = { v: 1, note: '작년 범위 초안', byKey: { '옥길중|중1': { exam: '2학기 기말', date: '2026-12-18', src: '작년', mids: ['다각형', '원과 부채꼴'] } } };
STORE.wt_preview = { at: '2026-10-28T05:00:00Z', batch: 'fri', dry: true, rows: [
  { code: C[1], grp: 'M4', grade: '중1', batch: 'fri', at: '2026-10-28T05:00:00Z', dry: true, scope: '옥길중|중1', nWrong: 60, carry: 60, fixed: 8, outScope: 30, unknown: 2, already: 0, bySrc: { ws: 30, book: 20, test: 10 }, n: 58, twin: 40, same: 18, none: 2, sheets: 1 },
  { code: C[2], grp: 'M4', grade: '중1', batch: 'fri', at: '2026-10-28T05:00:00Z', dry: true, scope: '', nWrong: 0, fixed: 1, outScope: 0, bySrc: { ws: 0, book: 0, test: 0 }, n: 0, sheets: 0 },
  { code: C[8], grp: 'T5', grade: '중1', batch: 'sat', at: '2026-10-28T05:00:00Z', dry: true, scope: '', nWrong: 12, fixed: 0, outScope: 0, bySrc: { ws: 5, book: 6, test: 1 }, n: 12, twin: 10, same: 2, sheets: 1 } ] };
STORE.wt_state = { byCode: { [C[3]]: { given: {}, runs: [{ at: '2026-10-24T20:10:00Z', batch: 'fri', n: 33, ws: [84300001] }] } } };
STORE.wt_log = { runs: [{ at: '2026-10-24T20:10:00Z', batch: 'fri', dry: false, students: 7, problems: 210, sheets: 6, fail: 0 }] };

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
  await pg.evaluate(() => { T.seed(); try { CT.loaded = false; CT.loading = false; } catch (e) {} DDS.kicked = false; VIEW = 'home'; render(); }); await settle(900);
  await pg.evaluate(() => render()); await settle(400);
  const v = await pg.evaluate(() => {
    const strip = document.getElementById('DDAY_STRIP'), cards = [...document.querySelectorAll('#CONTENT .dds-card')];
    const firstMain = document.querySelector('#CONTENT .hm3main'); 
    return { strip: strip ? strip.innerText.replace(/\s+/g, ' ') : null, shown: strip && strip.style.display, cards: cards.map((c) => c.innerText.replace(/\s+/g, ' ')),
      firstIsDds: firstMain && firstMain.firstElementChild && firstMain.firstElementChild.classList.contains('dds-home'),
      stripUnderTabs: strip && strip.previousElementSibling && strip.previousElementSibling.id === 'FUNC_TAB_BAR' };
  });
  t('탭 바로 아래 한 줄이 보임', v.shown === 'flex' && v.stripUnderTabs, JSON.stringify(v));
  t('한 줄: 범박고 D-10 먼저, 옥길중1,2 D-46', /범박고\s*D-10/.test(v.strip) && /옥길중1,2\s*D-46/.test(v.strip) && v.strip.indexOf('범박고') < v.strip.indexOf('옥길중'), v.strip);
  t('우리 학생 없는 학교는 안 보임', !/먼학교/.test(v.strip || ''));
  t('홈 맨 위(헤더보다 먼저)에 카드 2장', v.firstIsDds && v.cards.length === 2, JSON.stringify(v.cards));
  t('카드: D-10 은 «가까움» 표시', await pg.evaluate(() => document.querySelector('#CONTENT .dds-card').classList.contains('hot')));
  /* 다른 화면에서도 한 줄은 그대로 */
  await pg.evaluate(() => { VIEW = 'mfrep'; render(); }); await settle(300);
  t('다른 화면(월간보고서)에서도 한 줄이 보임', await pg.evaluate(() => document.getElementById('DDAY_STRIP').style.display === 'flex' && /D-10/.test(document.getElementById('DDAY_STRIP').innerText)));
  /* 누르면 학원 달력 · 그 학교만 */
  await pg.evaluate(() => { document.querySelectorAll('#DDAY_STRIP .dds-chip')[0].click(); }); await settle(300);
  const go = await pg.evaluate(() => ({ view: VIEW, filter: CT.filter, txt: (document.getElementById('CONTENT') || {}).innerText.slice(0, 60) }));
  t('칩을 누르면 학원 달력 · 범박고만', go.view === 'cal' && go.filter === '범박고', JSON.stringify(go));
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(200);
  await pg.evaluate(() => { document.querySelectorAll('#CONTENT .dds-card')[1].click(); }); await settle(200);
  t('카드를 누르면 학원 달력 · 옥길중만', await pg.evaluate(() => VIEW === 'cal' && CT.filter === '옥길중'));
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(300);
  await pg.setViewportSize({ width: 1400, height: 900 });
  if (SHOT) await pg.screenshot({ path: SHOT, fullPage: false });
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
