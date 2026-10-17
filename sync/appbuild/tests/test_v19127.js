#!/usr/bin/env node
/* 학원앱 v19-127 검사 — 📊 예약 통계 · 학생별 월간 참여(학부모 카톡) · 텐투텐 주말 체크
 *   가짜 서버(lumen_store 흉내, 쓰기를 모두 적는다) · 외부망 차단 · 가짜 학생(가짜중일 …) · 이름·전화 없는 가짜 보관(archive)
 *   ① 메뉴 「수업·출결 › 예약 통계」(네이버 예약 바로 뒤 · 네이버 로고) · 제목 · 시작 다운로드 제외 3키
 *   ② 숫자 칸(2025년: 전체 19 · 완료 13 · 취소 3 · 종류별) · 달 고르면(3월) 12 · 달마다 막대 합 = 전체 · 요일 × 시간 · 종류별 표 · 유입 경로
 *   ③ 학생별 월간 참여: 취소·신청 빼고 · 같은 날 1회 · 노쇼 따로 · 못 맞춤/퇴원생은 빠지고 건수만 · 직접 연결(naver_booking_links)이 먼저 · 정렬
 *   ④ 카톡 글: 기본 틀(이/가 · {한마디} 4회↑/1~3/0) · 틀 고치기 저장(naver_msg_tpl) → 바로 반영 · 한 명 복사 · 전체 복사(빈 줄) · 복사 대체(execCommand → prompt)
 *   ⑤ 텐투텐 주말 체크: 이번 주말(naver_bookings) ✓ 시간 · ✕ 취소 · ✓ 대기 · ✗ · 지난 주말(보관) ○ · 노쇼 · 「필수 아님」(tenten_optional) · 미예약 복사 · 금요일 안내 글 · TOP 5
 *   ⑥ 홈: 금·토만 「이번 주말 텐투텐 미예약 n명」 · 다른 요일엔 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19127.js lumen_v19-127.html
 *   그림: $SP/v19127.png (예약 통계 화면 · 가짜 자료) */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-127.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-127'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'naverstats127_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STUDENTS = [
  { id: 'S1', name: '가짜중일', grade: '중학교 1학년', group: 'M1', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '가짜중이', grade: '중학교 2학년', group: 'M2', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '가짜고일', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'AAA333', lumen_planner: {} },
  { id: 'S4', name: '가짜초육', grade: '초등학교 6학년', group: 'E6', lumen_rec_code: 'AAA444', lumen_planner: {} },
  { id: 'S5', name: '가짜퇴원', grade: '중학교 3학년', group: 'M3', lumen_rec_code: 'AAA555', withdrawn: true, lumen_planner: {} },
  { id: 'S6', name: '가짜고이', grade: '고등학교 2학년', group: 'H2', lumen_rec_code: 'AAA666', lumen_planner: {} },
  { id: 'S7', name: '가짜중삼', grade: '중학교 3학년', group: 'M3', lumen_rec_code: 'AAA777', lumen_planner: {} }];

/* 2025년 보관 (날짜 고정) — 기대값은 아래 검사 */
const A25 = [
  ['a1', 'tenten', '2025-03-01', '15:00', 'completed', 'S1', { reg: '2025-02-27T10:00:00+09:00' }],
  ['a2', 'tenten', '2025-03-01', '19:00', 'completed', 'S1'],        /* 같은 날 → 1회 */
  ['a3', 'tenten', '2025-03-08', '15:00', 'completed', 'S1'],
  ['a4', 'tenten', '2025-03-15', '10:00', 'cancelled', 'S1'],        /* 취소 → 안 셈 */
  ['a5', 'recovery', '2025-03-15', '15:00', 'completed', 'S1', { reg: '2025-03-15T08:00:00+09:00' }],
  ['a6', 'recovery', '2025-03-22', '13:00', 'noshow', 'S2'],         /* 노쇼 따로 */
  ['a7', 'tenten', '2025-03-22', '09:00', 'confirmed', 'S2'],
  ['a8', 'tenten', '2025-03-22', '15:00', 'completed', ''],          /* 못 맞춤 → 빠짐 */
  ['a9', 'tenten', '2025-03-23', '10:00', 'completed', 'S5'],        /* 퇴원생 → 직접 연결로 S2 */
  ['a10', 'kmm', '2025-03-29', '10:00', 'completed', 'S3'],
  ['a11', 'counsel', '2025-03-10', '11:00', 'cancelled', '', { area: '네이버 플레이스 - 검색 목록', gr: '중1', sch: '옥길중' }],
  ['a12', 'counsel', '2025-03-12', '11:00', 'cancelled', '', { area: '네이버 플레이스 - 검색 목록' }],
  ['a13', 'counsel', '2025-04-02', '16:00', 'completed', '', { area: '네이버 플레이스 - 상세페이지', gr: '?6' }],
  ['a14', 'tlp', '2025-04-05', '11:00', 'completed', 'S3'],
  ['a15', 'tenten', '2025-04-05', '15:00', 'requested', 'S2'],       /* 신청 대기 → 참여로 안 셈 */
  ['a16', 'tenten', '2025-04-12', '10:00', 'completed', 'S3'],
  ['a17', 'tenten', '2025-04-13', '10:00', 'completed', 'S3'],
  ['a18', 'tenten', '2025-04-19', '15:00', 'completed', 'S3'],
  ['a19', 'tenten', '2025-04-26', '15:00', 'completed', 'S3']];

async function harness(pg) {
  await pg.evaluate(({ STUDENTS, A25 }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], allW: [], toasts: [], clip: [], exec: [], prompts: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, op: 'select', eqv: [], lim: 1e9,
        select() { return b; }, eq(k, v) { b.eqv.push(v); b.f.push((x) => String(x[k]) === String(v)); return b; },
        in(k, a) { const s = a.map(String); b.f.push((x) => s.indexOf(String(x[k])) >= 0); return b; },
        gte() { return b; }, lte() { return b; }, not() { return b; }, like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => String(x[k]).indexOf(pre) === 0); return b; },
        or() { return b; }, order() { return b; }, limit(n) { b.lim = n; return b; }, range() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.w.push({ op: 'put', tbl, key: r.key }); T.allW.push(r.key + '=' + JSON.stringify(r.value)); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) {
          if (b.op !== 'select') { T.w.push({ op: b.op, tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          let rows = tbl === 'lumen_store' ? Object.keys(T.store).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' })) : [];
          rows = rows.filter((x) => b.f.every((fn) => fn(x))).slice(0, b.lim);
          return Promise.resolve({ data: b.one ? (rows[0] || null) : rows, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('ALERT ' + m); };
    window.prompt = (m, v) => { T.prompts.push(v); return null; };
    T.clipOn = () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (x) => { T.clip.push(x); return Promise.resolve(); } } }); };
    T.clipOff = (execOk) => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); document.execCommand = (c) => { T.exec.push(c); return execOk; }; };
    T.clipOn();
    T.stu = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); };
    T.stu();
    /* 보관 + 이번 주(naver_bookings) — 이번 주말·지난 주말은 오늘 기준으로 만든다 */
    T.make = async () => {
      const today = nbTodayKst(), sat = nbsComingSat(today), sun = nbAddDays(sat, 1), psat = nbAddDays(sat, -7), psun = nbAddDays(sat, -6);
      const row = (x) => { const o = { id: x[0], kind: x[1], item: '1', date: x[2], start: x[3], st: x[4], code: 'RC', cnt: 1 }; if (x[5]) o.stu = x[5]; return Object.assign(o, x[6] || {}); };
      const rows = A25.map(row);
      rows.push(row(['p1', 'tenten', psat, '15:00', 'completed', 'S1']));          /* 지난 주말 ○ */
      rows.push(row(['p2', 'tenten', psun, '10:00', 'noshow', 'S7']));             /* 지난 주말 노쇼 */
      const at = new Date(Date.now() - 60 * 60000).toISOString();
      T.store = {
        naver_bookings_archive: { at, v: 2, h: 'f'.repeat(16), items: [], n: rows.length, from: rows[0].date, to: psun, rows },
        naver_booking_links: { a9: 'S2' }, tenten_optional: { S6: true },
        or_studentdb: clone(STUDENTS) };   /* 앱이 뒤에서 등록부를 다시 받아도 가짜 학생 그대로 */
      const it = (k) => ({ id: '1', name: k, kind: k });
      const st = (k) => ({ code: 'RC', k, label: k });
      const B = [
        { id: 'c1', item: it('tenten'), status: st('confirmed'), date: sat, start: '15:00', end: '', count: 1, match: { stKey: 'S1', how: 'phone' } },
        { id: 'c2', item: it('tenten'), status: st('cancelled'), date: sat, start: '10:00', end: '', count: 1, match: { stKey: 'S2', how: 'phone' } },
        { id: 'c3', item: it('tenten'), status: st('requested'), date: sun, start: '19:00', end: '', count: 1, match: { stKey: 'S3', how: 'phone' } },
        { id: 'c4', item: it('tenten'), status: st('confirmed'), date: sat, start: '09:00', end: '', count: 1, match: { stKey: 'S4', how: 'phone' } },
        { id: 'p2', item: it('tenten'), status: st('noshow'), date: psun, start: '10:00', end: '', count: 1, match: { stKey: 'S7', how: 'phone' } }];
      T.store.naver_bookings = { at: new Date().toISOString(), ok: true, v: 1, today, items: [], bookings: B, counts: {}, pii: { enc: false, n: 0 } };
      T.store.naver_bookings_status = { at: new Date().toISOString(), ok: true, n: B.length };
      T.w = []; T.toasts = []; T.clip = []; T.exec = []; T.prompts = [];
      NBK.loaded = false; NBK.at = 0; NBS.loaded = false; NBS.at = 0; NBS.optAt = 0; NBS.y = '2025'; NBS.m = ''; NBS.pm = '2025-03'; NBS.wm = ''; NBS.show0 = true; NBS.tpl = null; NBS.opt = {};
      await nbkLoad(true); await nbsLoad(true);
      return { today, sat, sun, psat, psun };
    };
  }, { STUDENTS, A25 });
}

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await harness(pg);
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const show = async (v) => { await pg.evaluate((v) => { T.stu(); VIEW = v; render(); }, v); await settle(400); };
  const D = await pg.evaluate(() => T.make());

  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  /* ① 메뉴 · 제목 · 시작 다운로드 제외 */
  const MN = await pg.evaluate(() => { const g = GROUPS.find((x) => x.key === 'class'); const i = g.subs.findIndex((s) => s.v === 'naverstats'); return { i, prev: (g.subs[i - 1] || {}).v, label: (g.subs[i] || {}).label, svg: /^<svg class="nbk-logo"/.test((g.subs[i] || {}).icon || '') }; });
  t('메뉴: 수업·출결 › 「예약 통계」 = 네이버 예약 바로 뒤 · 네이버 로고', MN.i > 0 && MN.prev === 'naverbk' && MN.label === '예약 통계' && MN.svg, JSON.stringify(MN));
  await pg.evaluate(() => { const g = GROUPS.find((x) => x.key === 'class'); subGo('class', g.subs.findIndex((s) => s.v === 'naverstats')); }); await settle(600);
  const TT = await pg.evaluate(() => ({ view: VIEW, ttl: (document.querySelector('#CONTENT .nbs-ttl') || {}).innerText || '', raw: document.body.innerText.indexOf('<svg') >= 0, title: l3ViewTitle('naverstats').name }));
  t('메뉴 누르면 화면 「📊 예약 통계」 · SVG 글자가 그대로 보이지 않음', TT.view === 'naverstats' && /📊 예약 통계/.test(TT.ttl) && !TT.raw && TT.title === '예약 통계', JSON.stringify(TT));
  t('시작 다운로드 제외: naver_bookings_archive · naver_msg_tpl · tenten_optional', await pg.evaluate(() => ['naver_bookings_archive', 'naver_msg_tpl', 'tenten_optional'].every((k) => PULL_SKIP_KEYS.indexOf(k) >= 0)));

  /* ② 숫자 칸 · 달마다 · 요일×시간 · 종류 표 · 유입 경로 */
  await show('naverstats');
  const kpi = () => pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-nbs-kpi]').forEach((x) => { o[x.dataset.nbsKpi] = Number(x.dataset.v); }); return o; });
  let K = await kpi();
  t('2025년 숫자 칸: 전체 19 · 완료 13 · 취소 3(16%) · 앞으로 0', K.total === 19 && K.done === 13 && K.cx === 3 && K.up === 0 && /취소\s*16%/.test(await pg.evaluate(() => document.querySelector('[data-nbs-kpi="cx"]').innerText)), JSON.stringify(K));
  t('종류별: 텐투텐 12 · 리커버리 2 · KMM 1 · 상담 3 · TLP 1 · 없는 종류는 칸 없음', K['k-tenten'] === 12 && K['k-recovery'] === 2 && K['k-kmm'] === 1 && K['k-counsel'] === 3 && K['k-tlp'] === 1 && !('k-consult' in K), JSON.stringify(K));
  const MO = await pg.evaluate(() => [...document.querySelectorAll('[data-nbs-mon]')].map((g) => [g.dataset.nbsMon, Number(g.dataset.v), g.querySelectorAll('rect').length]));
  t('달마다 막대: 12달 · 3월 12 · 4월 7 · 합 19 = 전체', MO.length === 12 && MO.find((x) => x[0] === '2025-03')[1] === 12 && MO.find((x) => x[0] === '2025-04')[1] === 7 && MO.reduce((s, x) => s + x[1], 0) === K.total && MO.find((x) => x[0] === '2025-03')[2] === 4, JSON.stringify(MO.filter((x) => x[1])));
  const HT = await pg.evaluate(() => { const c = (k, w, h) => { const e = document.querySelector('[data-nbs-heat="' + k + '"] [data-wd="' + w + '"][data-h="' + h + '"]'); return e ? Number(e.dataset.v) : null; }; return { t615: c('tenten', 6, 15), t010: c('tenten', 0, 10), r615: c('recovery', 6, 15), r613: c('recovery', 6, 13), cx: c('tenten', 6, 10) }; });
  t('요일×시간(취소 뺌): 텐투텐 토 15시 6 · 일 10시 2 · 토 10시 1(취소 빼고) · 리커버리 토 15시 1 · 토 13시(노쇼) 1', HT.t615 === 6 && HT.t010 === 2 && HT.cx === 1 && HT.r615 === 1 && HT.r613 === 1, JSON.stringify(HT));
  const KT = await pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-nbs-kind]').forEach((r) => { o[r.dataset.nbsKind] = { n: +r.dataset.n, cx: +r.dataset.cx, med: r.dataset.med, same: +r.dataset.same }; }); return o; });
  t('종류 표: 상담 3건 취소 67% · 텐투텐 예약~이용 2.2일 · 리커버리 0.3일 · 당일 100%', KT.counsel.n === 3 && KT.counsel.cx === 67 && KT.tenten.med === '2.2' && KT.tenten.same === 0 && KT.recovery.med === '0.3' && KT.recovery.same === 100, JSON.stringify(KT));
  const AR = await pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-nbs-area]').forEach((x) => { o[x.dataset.nbsArea] = +x.dataset.v; }); const g = {}; document.querySelectorAll('[data-nbs-gr]').forEach((x) => { g[x.dataset.nbsGr] = +x.dataset.v; }); const s = {}; document.querySelectorAll('[data-nbs-sch]').forEach((x) => { s[x.dataset.nbsSch] = +x.dataset.v; }); return { o, g, s }; });
  t('유입 경로(짧은 이름): 플레이스 검색 목록 2 · 상세 1 · 기록 없음 16 · 학년 중1 1 · 6학년(학교급 모름) 1 · 학교 옥길중 1', AR.o['플레이스 검색 목록'] === 2 && AR.o['플레이스 상세'] === 1 && AR.o['(기록 없음)'] === 16 && AR.g['중1'] === 1 && AR.g['6학년(학교급 모름)'] === 1 && AR.s['옥길중'] === 1, JSON.stringify(AR));
  await pg.evaluate(() => nbsSet('m', '03')); await settle(200);
  K = await kpi();
  t('달 고르기(3월) → 전체 12 · 취소 3 · 막대는 연도 전체 그대로', K.total === 12 && K.cx === 3 && (await pg.evaluate(() => document.querySelectorAll('[data-nbs-mon]').length)) === 12, JSON.stringify(K));
  await pg.evaluate(() => nbsSet('m', '')); await settle(150);

  /* ③ 학생별 월간 참여 (2025-03) */
  const stuRows = () => pg.evaluate(() => [...document.querySelectorAll('tr[data-nbs-stu]')].map((r) => ({ k: r.dataset.nbsStu, tt: +r.dataset.tt, rc: +r.dataset.rc, kmm: +r.dataset.kmm, tlp: +r.dataset.tlp, ns: +r.dataset.ns })));
  let SR = await stuRows();
  const g = (k) => SR.find((x) => x.k === k) || {};
  t('3월: 가짜중일 텐투텐 2(같은 날 1회 · 취소 빼고) · 리커버리 1', g('S1').tt === 2 && g('S1').rc === 1, JSON.stringify(g('S1')));
  t('3월: 가짜중이 텐투텐 2(확정 + 직접 연결로 옮긴 퇴원생 예약) · 리커버리 0 · 노쇼 1', g('S2').tt === 2 && g('S2').rc === 0 && g('S2').ns === 1, JSON.stringify(g('S2')));
  t('3월: 가짜고일 KMM 1 · 퇴원생·초등(참여 없음)은 표에 없음 · 중·고등 0회 학생(가짜고이·가짜중삼)은 보임', g('S3').kmm === 1 && !g('S5').k && !g('S4').k && g('S6').tt === 0 && g('S7').tt === 0, JSON.stringify(SR));
  t('정렬: 합계 많은 순 → 이름 (가짜중일 3 · 가짜중이 2 · 가짜고일 1 · 0회 둘)', SR.map((x) => x.k).join() === 'S1,S2,S3,S6,S7', SR.map((x) => x.k).join());
  t('못 맞춘 참여 예약 1건은 빠지고 건수만 · 노쇼 칸 보임', (await pg.evaluate(() => document.querySelector('[data-nbs-unmatched]').dataset.nbsUnmatched)) === '1' && (await pg.evaluate(() => [...document.querySelectorAll('.nbs-stu th')].some((x) => x.innerText === '노쇼'))));
  await pg.evaluate(() => nbsSet('show0', false)); await settle(150);
  SR = await stuRows();
  t('「참여 없는 중·고등 학생도 보기」 끄면 0회 학생 빠짐', SR.map((x) => x.k).join() === 'S1,S2,S3', SR.map((x) => x.k).join());
  await pg.evaluate(() => nbsSet('show0', true)); await settle(150);

  /* ④ 카톡 글 */
  const M = await pg.evaluate(() => { const R = nbsRows(), T0 = nbsStuTable(R, '2025-03', true), A = nbsStuTable(R, '2025-04', true); const m = (T, k, ym) => nbsMsgOf(T.list.find((x) => x.k === k), ym); return { s1: m(T0, 'S1', '2025-03'), s2: m(T0, 'S2', '2025-03'), s7: m(T0, 'S7', '2025-03'), s3a: m(A, 'S3', '2025-04') }; });
  t('기본 글: 「가짜중일이 3월에 텐투텐 2회, 리커버리 1회 참여했습니다. 다음 달엔 조금 더 자주…」', M.s1 === '[루멘수학] 가짜중일이 3월에 텐투텐 2회, 리커버리 1회 참여했습니다. 다음 달엔 조금 더 자주 보면 좋겠어요.', M.s1);
  t('받침 없는 이름 → 「가짜중이가」', /^\[루멘수학\] 가짜중이가 3월에 텐투텐 2회, 리커버리 0회/.test(M.s2), M.s2);
  t('{한마디}: 0회 → 주말 텐투텐 부탁 · 4회 → 꾸준히', /다음 달엔 주말 텐투텐 참여를 부탁드려요\.$/.test(M.s7) && /4월에 텐투텐 4회.*꾸준히 잘 참여하고 있어요\.$/.test(M.s3a), M.s7 + ' / ' + M.s3a);
  t('예시 줄 = 표 첫 학생 글', (await pg.evaluate(() => document.querySelector('[data-nbs-ex]').innerText)).indexOf(M.s1) >= 0);
  await pg.click('button[data-nbs-copy="S1"]'); await settle(200);
  let C = await pg.evaluate(() => ({ clip: T.clip.slice(), toast: T.toasts.slice(-1)[0] || '' }));
  t('「📋 카톡」 한 명 → 클립보드에 그 학생 글 · 알림', C.clip.length === 1 && C.clip[0] === M.s1 && /가짜중일 학부모 글을 복사/.test(C.toast), JSON.stringify(C));
  await pg.click('button[data-nbs-copyall]'); await settle(200);
  C = await pg.evaluate(() => ({ clip: T.clip.slice(), toast: T.toasts.slice(-1)[0] || '' }));
  const all = C.clip[1] || '';
  t('「📋 전체 복사」 → 5명 글을 빈 줄로 나눔 (표 순서)', all.split('\n\n').length === 5 && all.split('\n\n')[0] === M.s1 && /5명 글을 모두 복사/.test(C.toast), all);
  /* 틀 고치기 → 저장 → 바로 반영 */
  await pg.evaluate(() => { document.querySelector('details.nbs-tpl').open = true; });
  await pg.fill('#nbsTplIn', '{학생}은(는) {월}월 텐투텐 {텐투텐}번 · 리커버리 {리커버리}번 · KMM {KMM} · TLP {TLP}\n{한마디}');
  await pg.fill('#nbsH1', '조금만 더 힘내요!');
  await pg.click('details.nbs-tpl button.pri'); await settle(300);
  const TP = await pg.evaluate(() => ({ st: T.store.naver_msg_tpl, ex: document.querySelector('[data-nbs-ex]').innerText, open: !!(document.querySelector('details.nbs-tpl') || {}).open }));
  t('틀 저장 → lumen_store naver_msg_tpl {tpl, h4, h1, h0} · 안 고친 문장은 그대로', TP.st && /\{학생\}은\(는\)/.test(TP.st.tpl) && TP.st.h1 === '조금만 더 힘내요!' && TP.st.h4 === '꾸준히 잘 참여하고 있어요.' && TP.st.h0 === '다음 달엔 주말 텐투텐 참여를 부탁드려요.', JSON.stringify(TP.st));
  const M2 = await pg.evaluate(() => { const T0 = nbsStuTable(nbsRows(), '2025-03', true); return [nbsMsgOf(T0.list.find((x) => x.k === 'S1'), '2025-03'), nbsMsgOf(T0.list.find((x) => x.k === 'S2'), '2025-03'), nbsMsgOf(T0.list.find((x) => x.k === 'S3'), '2025-03')]; });
  t('고친 틀 반영: 「가짜중일은 3월 텐투텐 2번 · …\\n조금만 더 힘내요!」 · 「가짜중이는」 · KMM 칸', M2[0] === '가짜중일은 3월 텐투텐 2번 · 리커버리 1번 · KMM 0 · TLP 0\n조금만 더 힘내요!' && /^가짜중이는 /.test(M2[1]) && /KMM 1/.test(M2[2]) && TP.ex.indexOf('가짜중일은') >= 0 && TP.open, JSON.stringify(M2));
  await pg.evaluate(() => { NBS.tpl = null; NBS.loaded = false; return nbsLoad(true); }); await show('naverstats');
  t('다시 읽어도(서버에서) 고친 틀 그대로', (await pg.evaluate(() => nbsTpl().h1)) === '조금만 더 힘내요!');
  await pg.evaluate(() => nbsTplReset()); await settle(300);
  t('「↩ 처음 글로」 → 기본 틀', (await pg.evaluate(() => T.store.naver_msg_tpl.tpl)) === '[루멘수학] {학생}이(가) {월}월에 텐투텐 {텐투텐}회, 리커버리 {리커버리}회 참여했습니다. {한마디}');
  /* 복사 대체 */
  const ta0 = await pg.evaluate(() => document.querySelectorAll('textarea').length);
  await pg.evaluate(() => T.clipOff(true)); await pg.click('button[data-nbs-copyall]'); await settle(200);
  C = await pg.evaluate(() => ({ exec: T.exec.slice(), last: NBS.lastCopy, toast: T.toasts.slice(-1)[0] || '', ta: document.querySelectorAll('textarea').length }));
  t('클립보드 없음 → 숨은 글상자 + execCommand(copy) · 알림 · 글상자 치움', C.exec.join() === 'copy' && C.last.split('\n\n').length === 5 && /모두 복사/.test(C.toast) && C.ta === ta0, JSON.stringify({ exec: C.exec, toast: C.toast, ta: C.ta, ta0 }));
  await pg.evaluate(() => T.clipOff(false)); await pg.click('button[data-nbs-copy="S2"]'); await settle(200);
  C = await pg.evaluate(() => ({ prompts: T.prompts.slice() }));
  t('execCommand 도 안 되면 → 직접 복사 창(prompt)에 글', C.prompts.length === 1 && /^\[루멘수학\] 가짜중이가/.test(C.prompts[0]), JSON.stringify(C));
  await pg.evaluate(() => T.clipOn());

  /* ⑤ 텐투텐 주말 체크 */
  await pg.evaluate(() => { NBS.wm = ''; }); await show('naverstats');
  const cell = (k, d) => pg.evaluate(({ k, d }) => { const e = document.querySelector('[data-nbs-cell="' + k + '|' + d + '"]'); return e ? { m: e.dataset.m, text: e.innerText.replace(/\s+/g, ' ').trim() } : null; }, { k, d });
  const WE = await pg.evaluate((sat) => { const e = document.querySelector('[data-nbs-we="' + sat + '"]'); return e ? { miss: +e.dataset.miss, coming: e.dataset.coming === '1', first: document.querySelector('[data-nbs-we]') === e, text: e.innerText, cls: e.className } : null; }, D.sat);
  t('이번 주말(' + D.sat + ') 줄: 맨 위 · 강조(coming) · 예약 안 한 학생 2명 (가짜중이 취소 · 가짜중삼)', WE && WE.coming && WE.first && /coming/.test(WE.cls) && WE.miss === 2 && /가짜중이\s*취소/.test(WE.text) && /가짜중삼/.test(WE.text) && !/가짜고이/.test(WE.text) && !/가짜초육/.test(WE.text), JSON.stringify(WE));
  const c1 = await cell('S1', D.sat), c2 = await cell('S2', D.sat), c3 = await cell('S3', D.sun), c7 = await cell('S7', D.sat);
  t('칸: 가짜중일 토 ✓ 15:00 · 가짜중이 토 ✕(취소) · 가짜고일 일 ✓ 19:00 대기 · 가짜중삼 ✗', c1.m === 'ok' && /✓ ?15:00/.test(c1.text) && c2.m === 'cx' && c2.text === '✕' && c3.m === 'wait' && /19:00 대기/.test(c3.text) && c7.m === 'no' && c7.text === '✗', JSON.stringify([c1, c2, c3, c7]));
  const p1 = await cell('S1', D.psat), p7 = await cell('S7', D.psun);
  t('지난 주말(보관): 가짜중일 토 ○ 다녀감 · 가짜중삼 일 노쇼', p1 && p1.m === 'done' && /○/.test(p1.text) && p7 && p7.m === 'ns', JSON.stringify([p1, p7]));
  t('대상 = 중·고등 재원생만 (초등·퇴원생 줄 없음) · 학년 순', (await pg.evaluate(() => [...document.querySelectorAll('tr[data-nbs-row]')].map((r) => r.dataset.nbsRow).join())) === 'S1,S2,S7,S3,S6');
  await pg.click('button[data-nbs-miss="' + D.sat + '"]'); await settle(150);
  C = await pg.evaluate(() => T.clip.slice(-1)[0]);
  t('「📋 복사」 → 「m/d~m/d 텐투텐 미예약 2명: 가짜중이, 가짜중삼」', C === (Number(D.sat.slice(5, 7)) + '/' + Number(D.sat.slice(8)) + '~' + Number(D.sun.slice(5, 7)) + '/' + Number(D.sun.slice(8)) + ' 텐투텐 미예약 2명: 가짜중이, 가짜중삼'), C);
  await pg.click('button[data-nbs-remind="' + D.sat + '"]'); await settle(150);
  C = await pg.evaluate(() => T.clip.slice(-1)[0]);
  t('「📋 금요일 안내 글」 → 「가짜중이 학생, 이번 주말 텐투텐 예약 부탁드려요」 한 줄씩', C === '가짜중이 학생, 이번 주말 텐투텐 예약 부탁드려요\n가짜중삼 학생, 이번 주말 텐투텐 예약 부탁드려요', C);
  await pg.click('button[data-nbs-opt="S7"]'); await settle(300);
  const OP = await pg.evaluate((sat) => ({ st: T.store.tenten_optional, miss: +document.querySelector('[data-nbs-we="' + sat + '"]').dataset.miss, cls: document.querySelector('tr[data-nbs-row="S7"]').className, btn: document.querySelector('button[data-nbs-opt="S7"]').innerText }), D.sat);
  t('「필수 아님」(가짜중삼) → tenten_optional {S7:true} · 미예약 1명으로 · 줄 흐리게', OP.st && OP.st.S7 === true && OP.miss === 1 && /opt/.test(OP.cls) && /✓/.test(OP.btn), JSON.stringify(OP));
  await pg.evaluate(() => { NBS.opt = {}; NBS.loaded = false; return nbsLoad(true); }); await show('naverstats');
  t('다시 읽어도 「필수 아님」 그대로', (await pg.evaluate((sat) => +document.querySelector('[data-nbs-we="' + sat + '"]').dataset.miss, D.sat)) === 1);
  await pg.click('button[data-nbs-opt="S7"]'); await settle(300);
  t('한 번 더 누르면 필수로 (그 학생 키만 지움)', (await pg.evaluate(() => JSON.stringify(T.store.tenten_optional))) === '{"S6":true}');
  await pg.evaluate(() => nbsSet('wm', '2025-03')); await settle(200);
  const TOP = await pg.evaluate(() => [...document.querySelectorAll('[data-nbs-topk]')].map((x) => x.dataset.nbsTopk + ':' + x.dataset.v));
  t('3월 TOP 5 = 가짜중이 2 · 가짜중일 2 (같으면 이름 순 · 퇴원생·못 맞춤 빠짐)', TOP.join() === 'S2:2,S1:2', TOP.join());
  const WL = await pg.evaluate(() => [...document.querySelectorAll('[data-nbs-we]')].map((x) => x.dataset.nbsWe));
  t('3월 주말 5번(최근 것 먼저) + 이번 주말(맨 위)', WL.length === 6 && WL[0] === D.sat && WL.slice(1).join() === '2025-03-29,2025-03-22,2025-03-15,2025-03-08,2025-03-01', WL.join());
  await pg.evaluate(() => nbsSet('wm', '2025-04')); await settle(200);
  t('4월 TOP 5 = 가짜고일 4 (신청 대기는 안 셈)', (await pg.evaluate(() => [...document.querySelectorAll('[data-nbs-topk]')].map((x) => x.dataset.nbsTopk + ':' + x.dataset.v).join())) === 'S3:4');
  await pg.evaluate(() => nbsSet('wm', '')); await settle(100);

  /* 그림 */
  await pg.evaluate(() => { NBS.pm = '2025-03'; NBS.y = '2025'; NBS.tplOpen = false; }); await show('naverstats');
  await pg.evaluate(() => { const c = document.getElementById('CONTENT'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); });
  /* 가운데 칸이 스스로 밀리는 상자라 전체를 담으려면 창을 화면 길이만큼 늘린다 */
  const fullH = await pg.evaluate(() => { const w = document.querySelector('#CONTENT .nbs-wrap'); return w ? Math.ceil(w.scrollHeight + w.getBoundingClientRect().top + 500) : 950; });
  await pg.setViewportSize({ width: 1280, height: Math.min(9000, Math.max(950, fullH)) }); await settle(400);
  await pg.screenshot({ path: path.join(SP, 'v19127.png'), fullPage: false });
  await pg.setViewportSize({ width: 1400, height: 950 });
  t('그림 저장 ' + path.join(SP, 'v19127.png'), fs.existsSync(path.join(SP, 'v19127.png')));

  /* 폰 폭 */
  await pg.setViewportSize({ width: 390, height: 800 }); await show('naverstats');
  const ov = await pg.evaluate(() => { const w = document.querySelector('.nbs-wrap'); return w ? w.scrollWidth <= w.clientWidth + 2 : null; });
  t('폰 폭(390): 화면이 가로로 안 넘침(표·막대는 안에서 밀기)', ov === true, String(ov));
  await pg.setViewportSize({ width: 1400, height: 950 });

  /* ⑥ 홈: 금·토만 */
  const fri = await pg.evaluate((sat) => nbAddDays(sat, -1), D.sat);
  const HM = await pg.evaluate(async (d) => {
    const real = window.nbsToday, out = {};
    window.nbsToday = () => d.fri; NBS.optAt = Date.now(); VIEW = 'home'; render(); await new Promise((r) => setTimeout(r, 300));
    let e = document.querySelector('[data-nbk-home] [data-nbs-home]'); out.fri = e ? { n: e.dataset.nbsHome, text: e.innerText } : null;
    window.nbsToday = () => d.sat; render(); await new Promise((r) => setTimeout(r, 200));
    e = document.querySelector('[data-nbs-home]'); out.sat = e ? e.dataset.nbsHome : null;
    window.nbsToday = () => nbAddDays(d.sat, -3); render(); await new Promise((r) => setTimeout(r, 200));
    out.wed = !!document.querySelector('[data-nbs-home]');
    window.nbsToday = real; render();
    return out;
  }, { fri, sat: D.sat });
  t('홈(금요일): 「오늘 네이버 예약」 칸 안에 「🔟 이번 주말 텐투텐 미예약 2명」', HM.fri && HM.fri.n === '2' && /이번 주말 텐투텐 미예약 2명/.test(HM.fri.text), JSON.stringify(HM));
  t('홈(토요일)도 보이고 · 수요일엔 없음', HM.sat === '2' && HM.wed === false, JSON.stringify(HM));
  await pg.evaluate(() => { window.nbsToday = (() => nbTodayKst()); });
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(200);
  await pg.evaluate(() => nbsGoWeekend()); await settle(700);
  t('홈 줄 누르면 → 예약 통계 화면', (await pg.evaluate(() => VIEW)) === 'naverstats' && (await pg.evaluate(() => !!document.getElementById('nbsSecWe'))));

  /* 개인정보 · 서버 쓰기 */
  const NW = await pg.evaluate(() => T.w.filter((x) => x.tbl === 'lumen_store' && /^(naver_|tenten_)/.test(String(x.key))).map((x) => x.key));
  t('예약 쪽 서버 쓰기는 naver_msg_tpl · tenten_optional 뿐 (보관·예약·연결 자료는 안 씀)', NW.length > 0 && NW.every((k) => k === 'naver_msg_tpl' || k === 'tenten_optional'), JSON.stringify(NW));
  t('그 쓰기에 학생 이름 없음', await pg.evaluate((ns) => T.allW.filter((x) => /^(naver_|tenten_)/.test(x)).every((x) => ns.every((n) => x.indexOf(n) < 0)), STUDENTS.map((s) => s.name)));
  const src = fs.readFileSync(MOD, 'utf8'), html = fs.readFileSync(FILE, 'utf8');
  t('부품에 템플릿 리터럴 없음 · 조립 결과에 그대로', src.indexOf('`') < 0 && html.indexOf(src.slice(0, 1500)) >= 0);
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
