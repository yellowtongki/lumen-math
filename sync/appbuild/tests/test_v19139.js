#!/usr/bin/env node
/* 학원앱 v19-139 검사 — 🎯 시험대비 트랙: 학사일정 보고 다음 시험 트랙 자동 · 디데이 자동 · 트랙마다 공개 · 화면에서 만들기
 *   가짜 서버(lumen_store 흉내, 쓰기를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○) · 오늘 = 2026-10-19 (KST, 시계 고정)
 *   가짜 학사일정은 실제 모양 그대로: 옥길중 중1·2 기말 12/18~12/22 · 중3 11/13~11/17 / 범박중 중3 11/10~11/12 · 중1·2 12/9~12/10 /
 *     범박고 12/7~12/11 / 소사고 12/10~12/16 / 2학기 중간 9/29~10/13 / 1학기 중간(4월) / 초등은 시험 없음
 *   가짜 exam_track: 2학기 중간 트랙들 · 옛 「🏫 학사일정」 디데이(지난 중간) · 손으로 넣은 디데이 · 옛 pubTracks(옥길중 중1만) · 모르는 칸
 *   ① 디데이: 범박고·소사고 기말 들어옴 · 지난 중간 빠짐 · 손으로 넣은 것 남음 · 학년별(옥길중3 11/13 · 옥길중1,2 12/18)
 *   ② 자동 새 트랙: 중간이 끝난 트랙 → 기말 트랙(🔒 비공개 · 빈 교재) · 지난 트랙 past 보관(개별 배정 포함) · 초등 건너뜀 · 날짜 바뀐 트랙 고침
 *      pubTracks = ['__none__'] (배포된 학생앱이 읽는 칸) · 모르는 칸 그대로 · 띠에 무엇을 했는지
 *   ③ 학생앱(student_v2-143 = 배포본과 같은 트랙 코드): 비공개 새 트랙 → 아무것도 안 보임(지난 트랙 안 보임) · 공개하면 보임
 *   ④ ↩ 되돌리기 → 지난 트랙·개별 배정 돌아옴 · 다시 열어도 다시 안 만듦(skipNext)
 *   ⑤ 「＋ 시험 트랙 만들기」: 학사일정 시험 고르기 + 지난 트랙 교재 가져오기 · 직접 입력 · 비공개로 시작
 *   ⑥ 🔒/👁 공개 단추 · ✏️ 시험 고치기 · 🗑 트랙 지우기(보관함으로) · 다른 기기가 바꾼 칸을 지우지 않음(서버 다시 읽기)
 *   ⑦ 1180px 가로 넘침 없음 · 페이지 오류 없음 · 부품 글자 검사
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19139.js lumen_v19-139.html [student_v2-143.html]
 *   그림: $SP/v19139_auto.png · v19139_make.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'lumen_v19-139.html'));
const STU = path.resolve(process.argv[3] || path.join(ROOT, 'student_v2-143.html'));
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-139'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'xtnext139_teacher.js');
const NOW = new Date('2026-10-19T10:00:00+09:00');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 1학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 1학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중학교 3학년', school: '옥길중학교', group: 'M3', lumen_rec_code: 'AAA333', lumen_planner: {} },
  { id: 'S4', name: '○○○4', grade: '중학교 3학년', school: '범박중학교', group: 'M3', lumen_rec_code: 'AAA444', lumen_planner: {} },
  { id: 'S5', name: '○○○5', grade: '중학교 1학년', school: '범박중학교', group: 'T6', lumen_rec_code: 'AAA555', lumen_planner: {} },
  { id: 'S6', name: '○○○6', grade: '고등학교 1학년', school: '범박고등학교', group: 'H1', lumen_rec_code: 'AAA666', lumen_planner: {} },
  { id: 'S7', name: '○○○7', grade: '고등학교 2학년', school: '소사고등학교', group: 'M7', lumen_rec_code: 'AAA777', lumen_planner: {} },
  { id: 'S8', name: '○○○8', grade: '초등학교 6학년', school: '옥길버들초등학교', group: 'E6', lumen_rec_code: 'AAA888', lumen_planner: {} }];
const EX = (from, to, label, grades) => ({ from, to, days: 1, name: '지필평가', label, grades: grades || null });
const CAL = { at: '2026-10-19T03:00:00Z', year: 2026, students: { '옥길중학교': 3 }, schools: [
  { name: '옥길중학교', short: '옥길중', kind: '중', exams: [EX('2026-04-28', '2026-04-30', '1학기 중간'), EX('2026-09-30', '2026-10-01', '2학기 중간'), EX('2026-11-13', '2026-11-17', '2학기 기말', [3]), EX('2026-12-18', '2026-12-22', '2학기 기말', [1, 2])], next: { from: '2026-11-13' } },
  { name: '범박중학교', short: '범박중', kind: '중', exams: [EX('2026-09-29', '2026-09-29', '2학기 중간'), EX('2026-11-10', '2026-11-12', '2학기 기말', [3]), EX('2026-12-09', '2026-12-10', '2학기 기말', [1, 2])] },
  { name: '범박고등학교', short: '범박고등', kind: '고', exams: [EX('2026-09-29', '2026-10-06', '2학기 중간'), EX('2026-12-07', '2026-12-11', '2학기 기말')] },
  { name: '소사고등학교', short: '소사고등', kind: '고', exams: [EX('2026-10-06', '2026-10-13', '2학기 중간'), EX('2026-12-10', '2026-12-16', '2학기 기말')] },
  { name: '옥길버들초등학교', short: '옥길버들초', kind: '초', exams: [] }] };
const IT = (id, title, extra) => Object.assign({ id, title, thumb: '', total: 100, kind: '교재' }, extra || {});
const XT0 = {
  publish: true, updated: '2026-10-01T00:00:00Z', mystery: { keep: 1 }, pubTracks: ['옥길중 중1'],
  ddays: [
    { school: '범박중', label: '2학기 중간', date: '2026-09-29', grades: null },
    { school: '범박고', label: '2학기 중간 (09-29~10-06)', date: '2026-09-29', grades: null },
    { school: '옥길중', label: '2학기 중간 (09-30~10-01)', date: '2026-09-30', grades: null },
    { school: '소사고', label: '2학기 중간 (10-06~10-13)', date: '2026-10-06', grades: null },
    { school: '옥길중', label: '2학기 기말 · 3학년 (11-13~11-17)', date: '2026-11-13', grades: [3] },
    { school: '옥길중', label: '학원 모의고사', date: '2026-11-01' }],
  tracks: {
    '옥길중 중1': { school: '옥길중', xtra: 'keep', items: [IT('B1', '옥길중 1-2 중간고사대비 #1', { pFrom: 10, pTo: 40 }), IT('B2', '옥길중 1-2 중간고사대비 #2', { pc: { 1: 10, 2: 12, 3: 8 }, bookTotal: 30, pFrom: 1, pTo: 2 })] },
    '옥길중 중3': { school: '옥길중', items: [IT('B3', '중3 중간 대비')] },
    '범박중 중3': { school: '범박중', exam: { label: '2학기 기말', from: '2026-11-09', to: '2026-11-11' }, items: [IT('B4', '중3 기말 대비')] },
    '범박고 고1': { school: '범박고', items: [IT('B5', '고1 중간 대비')] },
    '소사고 고2': { school: '소사고', items: [IT('B6', '고2 중간 대비')] },
    '옥길버들초 초6': { school: '옥길버들초', items: [IT('B7', '초6 심화')] } },
  indiv: { AAA111: [IT('X1', '개별 끼워넣기')], ZZZ999: [IT('X9', '모르는 학생 개별')] } };
const SEED = { exam_track: XT0, school_calendar: CAL };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 900 }, timezoneId: 'Asia/Seoul' });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(NOW);
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, SEED }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], toasts: [], SEED, confirmAns: true, confirms: [], alerts: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, op: 'select', eqv: [],
        select() { return b; }, eq(k, v) { b.eqv.push(v); b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.w.push({ op: 'put', tbl, key: r.key }); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) {
          if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          if (b.op === 'delete') { T.w.push({ op: 'del', tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          if (b.op === 'update') { T.w.push({ op: 'update', tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-19T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = (m) => { T.confirms.push(String(m)); return T.confirmAns; };
    window.alert = (m) => { T.alerts.push(String(m)); };
    T.reset = () => { T.store = clone(T.SEED); T.w = []; T.toasts = []; T.confirms = []; };
    T.reset();
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
  }, { STUDENTS, SEED });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const XW = () => pg.evaluate(() => T.w.filter((x) => x.key === 'exam_track').length);
  const S = () => pg.evaluate(() => JSON.parse(JSON.stringify(T.store.exam_track)));
  const open = async () => { await pg.evaluate(() => { XT.loaded = false; XT.a139 = null; XT.grp = ''; XT.view = 'grp'; VIEW = 'examtrack'; render(); }); await settle(1200); };

  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품 함수 있음', await pg.evaluate(() => ['xt139Auto', 'xt139Merge', 'xt139SyncDdays', 'xt139Roll', 'xt139Undo', 'xt139MkOpen', 'xt139MkOk', 'xt139PullItems'].every((f) => typeof window[f] === 'function')));
  t('오늘 = 2026-10-19 (시계 고정)', (await pg.evaluate(() => xt139Today())) === '2026-10-19');

  /* ── ①② 화면 열기 → 자동 ── */
  await open();
  let s = await S();
  t('열자마자 exam_track 한 번 저장 (바뀐 것이 있어서)', (await XW()) === 1, String(await XW()));
  const dk = (x) => x.school + '|' + x.date + '|' + (x.grades || []).join('·');
  const DK = s.ddays.map(dk);
  t('디데이: 범박고 기말 12/07 · 소사고 기말 12/10 들어옴', DK.indexOf('범박고|2026-12-07|') >= 0 && DK.indexOf('소사고|2026-12-10|') >= 0, DK.join(' , '));
  t('디데이: 학년별 — 옥길중 3학년 11/13 · 1·2학년 12/18 · 범박중 3학년 11/10 · 1·2학년 12/09', ['옥길중|2026-11-13|3', '옥길중|2026-12-18|1·2', '범박중|2026-11-10|3', '범박중|2026-12-09|1·2'].every((k) => DK.indexOf(k) >= 0), DK.join(' , '));
  t('디데이: 지난 2학기 중간(9/29·9/30·10/6) 모두 빠짐 · 1학기 없음', !s.ddays.some((x) => /중간/.test(x.label)), DK.join(' , '));
  t('디데이: 손으로 넣은 「학원 모의고사」 그대로 (auto 표시 없음)', s.ddays.some((x) => x.label === '학원 모의고사' && x.date === '2026-11-01' && !x.auto));
  t('디데이: 학사일정 것은 auto:true · 끝날(to) · 날짜순 · 모두 7개', s.ddays.filter((x) => x.auto).length === 6 && s.ddays.length === 7 && s.ddays.find((x) => x.school === '소사고').to === '2026-12-16' && DK.join() === DK.slice().sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1])).join(), DK.join(' , '));
  const T1 = s.tracks['옥길중 중1'];
  t('옥길중 중1: 새 트랙 = 2학기 기말 12/18~12/22 · 🔒 비공개 · 빈 교재 · auto', T1.exam && T1.exam.label === '2학기 기말' && T1.exam.from === '2026-12-18' && T1.exam.to === '2026-12-22' && T1.pub === false && T1.items.length === 0 && T1.auto === true && !!T1.from, JSON.stringify(T1));
  t('옥길중 중3: 2학기 기말 11/13~11/17 · 비공개', s.tracks['옥길중 중3'].exam.from === '2026-11-13' && s.tracks['옥길중 중3'].exam.to === '2026-11-17' && s.tracks['옥길중 중3'].pub === false);
  t('범박고 고1 → 기말 12/07~12/11 · 소사고 고2 → 기말 12/10~12/16', s.tracks['범박고 고1'].exam.from === '2026-12-07' && s.tracks['범박고 고1'].exam.to === '2026-12-11' && s.tracks['소사고 고2'].exam.from === '2026-12-10' && s.tracks['소사고 고2'].items.length === 0);
  const T4 = s.tracks['범박중 중3'];
  t('범박중 중3(아직 안 끝남): 새로 안 만듦 · 학사일정이 바꾼 날짜로 고침 11/09~11/11 → 11/10~11/12 · 교재 그대로', T4.exam.from === '2026-11-10' && T4.exam.to === '2026-11-12' && T4.items.length === 1 && !T4.auto, JSON.stringify(T4.exam));
  t('초등(옥길버들초 초6) 건너뜀: 시험 안 붙고 교재·모양 그대로', !s.tracks['옥길버들초 초6'].exam && s.tracks['옥길버들초 초6'].items.length === 1 && !s.tracks['옥길버들초 초6'].auto);
  const P1 = (s.past || []).find((p) => p.grp === '옥길중 중1');
  t('지난 트랙 보관: past 4개(옥길중 중1·중3·범박고 고1·소사고 고2) · why auto', (s.past || []).length === 4 && s.past.every((p) => p.why === 'auto' && p.pid && p.archivedAt), JSON.stringify((s.past || []).map((p) => p.grp)));
  t('옥길중 중1 보관본 = 2학기 중간 9/30~10/01 · 교재 2권 · 모르는 칸(xtra) · 옛 공개(pub:true) · 그 학년 개별 배정(AAA111) 같이', P1 && P1.exam.label === '2학기 중간' && P1.exam.from === '2026-09-30' && P1.items.length === 2 && P1.xtra === 'keep' && P1.pub === true && P1.indiv && P1.indiv.AAA111 && P1.indiv.AAA111[0].id === 'X1' && T1.from === P1.pid, JSON.stringify(P1 && P1.exam));
  t('개별 배정: 옥길중 중1 학생 것은 보관함으로 · 모르는 학생(ZZZ999) 것은 그대로', !s.indiv.AAA111 && s.indiv.ZZZ999 && s.indiv.ZZZ999[0].id === 'X9');
  t('공개: 옛 pubTracks(옥길중 중1만) → 새 트랙 모두 비공개 → pubTracks=[\'__none__\'] (배포된 학생앱이 아무것도 안 보여 줌)', JSON.stringify(s.pubTracks) === '["__none__"]' && s.tracks['옥길버들초 초6'].pub === false && s.tracks['범박중 중3'].pub === false, JSON.stringify(s.pubTracks));
  t('모르는 칸 그대로: mystery · publish', s.mystery && s.mystery.keep === 1 && s.publish === true);
  /* 띠 */
  const BN = await pg.evaluate(() => { const b = document.getElementById('xt139-banner'); return b ? { txt: b.innerText, made: b.querySelectorAll('.xt139-made').length, upd: b.querySelectorAll('.xt139-upd').length, undo: b.querySelectorAll('.xt139-undo').length } : null; });
  t('띠: 새 트랙 4줄 · 날짜 고침 1줄 · 되돌리기 단추 4개 · 디데이 새로/지움 안내', BN && BN.made === 4 && BN.upd === 1 && BN.undo === 4 && /디데이 새로/.test(BN.txt) && /끝난 시험 디데이 지움/.test(BN.txt) && /비공개/.test(BN.txt), BN && BN.txt.slice(0, 300));
  t('왼쪽에 「＋ 시험 트랙 만들기」 · 트랙 상자에 🔒 비공개 · 📝 시험', await pg.evaluate(() => { const n = document.getElementById('xt139-new'), p = document.getElementById('xt139-pub'), e = document.getElementById('xt139-exam'); return !!n && /시험 트랙 만들기/.test(n.innerText) && !!p && /비공개/.test(p.innerText) && !!e && /2학기 기말/.test(e.innerText); }));
  t('빈 새 트랙(첫 학년 범박고 고1)에 「📥 지난 트랙 교재 가져오기 (2학기 중간 · 1권)」', await pg.evaluate(() => { const b = document.getElementById('xt139-pull'); return XT.grp === '범박고 고1' && !!b && /2학기 중간 · 1권/.test(b.innerText); }), await pg.evaluate(() => XT.grp));
  await pg.screenshot({ path: SP + '/v19139_auto.png' });
  /* 다시 열어도 그대로 (한 번만) */
  await pg.evaluate(() => { T.w = []; }); await open();
  t('다시 열면 바뀐 것이 없어 저장 안 함 · 띠 없음', (await XW()) === 0 && !(await pg.evaluate(() => document.getElementById('xt139-banner'))), String(await XW()));
  const s2 = await S();
  t('다시 열어도 트랙·디데이·past 그대로', JSON.stringify(s2.tracks) === JSON.stringify(s.tracks) && s2.past.length === 4 && s2.ddays.length === 7);

  /* ── ③ 학생앱: 비공개 새 트랙 → 아무것도 / 공개 → 보임 ── */
  const stuCheck = async (store, info) => {
    const sp = await (await br.newContext({ viewport: { width: 400, height: 800 }, timezoneId: 'Asia/Seoul' })).newPage();
    await sp.clock.setFixedTime(NOW);
    const se = []; sp.on('pageerror', (e) => se.push(String(e.message)));
    await sp.route(/^https?:\/\//, (r) => r.abort());
    await sp.goto('file://' + STU, { waitUntil: 'load' }); await sp.waitForTimeout(1200);
    const out = await sp.evaluate(async ({ store, info }) => {
      const rowOf = (k) => (k in store ? { key: k, value: JSON.parse(JSON.stringify(store[k])) } : null);
      window.sb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, is() { return b; }, like() { return b; }, ilike() { return b; }, contains() { return b; }, range() { return b; }, order() { return b; }, limit() { return b; }, update() { return b; }, delete() { return b; },
        maybeSingle() { return Promise.resolve({ data: tbl === 'lumen_store' && b.f.eq ? rowOf(b.f.eq) : null, error: null }); }, single() { return b.maybeSingle(); },
        insert() { return Promise.resolve({ data: null, error: null }); }, upsert() { return Promise.resolve({ error: null }); },
        then(r, j) { let keys = tbl === 'lumen_store' ? Object.keys(store) : []; if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map(rowOf), error: null }).then(r, j); } }; return b; } };
      window.isTest = false; window.studentInfo = info;
      await xtLoad(true);
      return { my: XTS.my ? { n: XTS.my.items.length, ids: XTS.my.items.map((x) => x.id), dd: XTS.my.dd && XTS.my.dd.date } : null, ver: STU_VER };
    }, { store, info });
    await sp.context().close();
    return { out, se };
  };
  const ST1 = { lumen_rec_code: 'AAA111', name: '○○○1', grade: '중학교 1학년', school: '옥길중학교', group: 'T5' };
  let R = await stuCheck({ exam_track: s, or_studentdb: STUDENTS }, ST1);
  t('학생앱(' + path.basename(STU) + '): 비공개 새 트랙 → 시험대비 트랙 안 보임(지난 중간 트랙·개별 배정도 안 보임)', R.out.my === null && R.se.length === 0, JSON.stringify(R.out) + R.se.join('|'));
  R = await stuCheck({ exam_track: XT0, or_studentdb: STUDENTS }, ST1);
  t('대조: 바꾸기 전 서버 자료면 학생앱에 중간 트랙(3권) 보였음', R.out.my && R.out.my.n === 3, JSON.stringify(R.out));

  /* ── ④ 되돌리기 ── */
  await pg.evaluate(() => { XT.a139 = null; XT.loaded = false; T.reset(); T.w = []; VIEW = 'examtrack'; render(); }); await settle(1200);
  t('(다시 처음 자료로) 띠 다시 나옴', await pg.evaluate(() => !!document.getElementById('xt139-banner')));
  const ui = await pg.evaluate(() => XT.a139.made.findIndex((m) => m.grp === '옥길중 중1'));
  await pg.evaluate(() => { T.w = []; });
  await pg.locator('#xt139-banner .xt139-made').nth(ui).locator('.xt139-undo').click();
  await settle(600);
  s = await S();
  const U1 = s.tracks['옥길중 중1'];
  t('↩ 되돌리기: 옥길중 중1 = 지난 중간 트랙(교재 2권 · xtra · 공개) · skipNext=2학기 기말|2026-12-18', U1.items.length === 2 && U1.xtra === 'keep' && U1.pub === true && U1.exam.label === '2학기 중간' && U1.skipNext === '2학기 기말|2026-12-18' && !U1.grp && !U1.pid && !U1.archivedAt, JSON.stringify(U1).slice(0, 300));
  t('↩ 개별 배정 AAA111 돌아옴 · past 3개 · pubTracks=[옥길중 중1]', s.indiv.AAA111 && s.indiv.AAA111[0].id === 'X1' && s.past.length === 3 && JSON.stringify(s.pubTracks) === '["옥길중 중1"]', JSON.stringify(s.pubTracks));
  t('띠: 그 줄은 「되돌렸어요」 · 나머지 3줄 그대로', await pg.evaluate(() => { const b = document.getElementById('xt139-banner'); return !!b && /되돌렸어요/.test(b.innerText) && b.querySelectorAll('.xt139-undo').length === 3; }));
  await pg.evaluate(() => { T.w = []; }); await open();
  s = await S();
  t('다시 열어도 옥길중 중1 은 다시 안 만듦(skipNext) · 저장 없음', s.tracks['옥길중 중1'].items.length === 2 && s.tracks['옥길중 중1'].exam.label === '2학기 중간' && (await XW()) === 0, String(await XW()));
  t('되돌린 트랙 상자에 안내 「되돌린 트랙」', await pg.evaluate(() => { xtSetGrp('옥길중 중1'); return /되돌린 트랙/.test(document.querySelector('.xt139-box').innerText); }));
  /* 날짜 고침 되돌리기 */
  await pg.evaluate(() => { XT.a139 = { made: [], upd: [{ grp: '범박중 중3', label: '2학기 기말', old: { from: '2026-11-09', to: '2026-11-11' }, now: { from: '2026-11-10', to: '2026-11-12' } }], dd: { add: [], del: [] }, inf: [] }; render(); });
  await pg.click('.xt139-undo-upd'); await settle(500);
  s = await S();
  t('날짜 고침 ↩: 11/09~11/11 · examManual(학사일정이 다시 안 덮음)', s.tracks['범박중 중3'].exam.from === '2026-11-09' && s.tracks['범박중 중3'].examManual === true);
  await pg.evaluate(() => { T.w = []; }); await open();
  t('다시 열어도 직접 둔 날짜 그대로', (await S()).tracks['범박중 중3'].exam.from === '2026-11-09' && (await XW()) === 0);

  /* ── ⑤ 「＋ 시험 트랙 만들기」: 옥길중 중1 (지난 중간 트랙 → 기말, 교재 가져오기) ── */
  await pg.evaluate(() => { xtSetGrp('옥길중 중1'); T.w = []; T.confirms = []; });
  await pg.click('#xt139-new'); await settle(200);
  const MK = await pg.evaluate(() => { const m = document.getElementById('xt139-modal'); return m ? { grp: document.getElementById('xt139-grp').value, ex: [...m.querySelectorAll('.xt139-ex')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), pick: XT.mk.pick, copy: document.getElementById('xt139-copy').checked, txt: m.innerText } : null; });
  t('만들기 창: 학년 = 옥길중 중1(시험 끝남) · 학사일정 시험 = 2학기 기말 12/18~12/22 + 직접 입력 · 기본 선택 · 교재 가져오기 켜짐', MK && MK.grp === '옥길중 중1' && MK.ex.length === 2 && /2학기 기말 12\/18~12\/22/.test(MK.ex[0]) && /D-60/.test(MK.ex[0]) && MK.pick === 'cal:0' && MK.copy && /2학기 중간 · 2권/.test(MK.txt) && /비공개/.test(MK.txt), JSON.stringify(MK && { g: MK.grp, ex: MK.ex, p: MK.pick, c: MK.copy }));
  await pg.screenshot({ path: SP + '/v19139_make.png' });
  await pg.click('#xt139-mk-ok'); await settle(600);
  s = await S();
  const N1 = s.tracks['옥길중 중1'];
  t('만들기 → 기말 트랙 · 교재 2권 그대로(시험범위 p 비움 · 범위 있던 B1은 ⚠ 추정 · pc 있는 B2는 그대로) · 🔒 비공개 · 확인 한 번', N1.exam.label === '2학기 기말' && N1.exam.from === '2026-12-18' && N1.pub === false && N1.items.length === 2 && N1.items.every((i) => i.pFrom == null && i.pTo == null) && N1.items[0].needCheck === true && !N1.items[1].needCheck && N1.items[1].pc && (await pg.evaluate(() => T.confirms.length)) === 1 && !N1.examManual, JSON.stringify(N1).slice(0, 300));
  if (process.env.DBG) console.log('DBG', JSON.stringify({ keys: Object.keys(s.tracks), past: s.past.map((p) => [p.grp, p.why, p.exam && p.exam.label, Object.keys(p.indiv || {})]), indiv: Object.keys(s.indiv), mk: await pg.evaluate(() => XT.mk), toasts: await pg.evaluate(() => T.toasts.slice(-3)) }));
  t('지난 중간 트랙은 past 로(why new) · 개별 배정도 같이 · 창 닫힘', s.past.some((p) => p.grp === '옥길중 중1' && p.why === 'new' && p.exam.label === '2학기 중간' && p.indiv && p.indiv.AAA111) && !s.indiv.AAA111 && !(await pg.evaluate(() => document.getElementById('xt139-modal'))));
  /* 직접 입력 · 트랙 없는 학년(범박중 중1) */
  await pg.evaluate(() => { T.confirms = []; xt139MkOpen('new', ''); }); await settle(150);
  t('트랙 없는 학년이 먼저 골라짐(범박중 중1) · 학사일정 기말 12/09~12/10', await pg.evaluate(() => XT.mk.grp === '범박중 중1' && /12\/09~12\/10/.test(document.querySelector('.xt139-ex').innerText)), await pg.evaluate(() => XT.mk.grp));
  await pg.click('.xt139-ex[data-v="manual"] input'); await settle(150);
  await pg.fill('#xt139-label', '2학기 기말 (직접)'); await pg.fill('#xt139-from', '2026-12-08'); await pg.fill('#xt139-to', '2026-12-10');
  await pg.click('#xt139-mk-ok'); await settle(600);
  s = await S();
  const N5 = s.tracks['범박중 중1'];
  t('직접 입력 트랙: 이름·날짜 그대로 · examManual · 비공개 · 빈 교재 · 확인 안 물음', N5 && N5.exam.label === '2학기 기말 (직접)' && N5.exam.from === '2026-12-08' && N5.exam.to === '2026-12-10' && N5.examManual === true && N5.pub === false && N5.items.length === 0 && (await pg.evaluate(() => T.confirms.length)) === 0, JSON.stringify(N5));
  /* 잘못된 입력은 안 만든다 */
  await pg.evaluate(() => { xt139MkOpen('new', '범박중 중1'); xt139MkSet('pick', 'manual'); XT.mk.label = '이상한 시험'; XT.mk.from = '2026-12-10'; XT.mk.to = '2026-12-01'; T.w = []; xt139MkOk(); }); await settle(300);
  t('끝 < 시작이면 안 만들고 안내', (await XW()) === 0 && (await pg.evaluate(() => /시험을 고르거나/.test(T.toasts[T.toasts.length - 1]) && !!XT.mk)));
  await pg.evaluate(() => xt139MkClose());

  /* ── ⑥ 공개 단추 · 시험 고치기 · 지우기 · 다른 기기 칸 지키기 ── */
  await pg.evaluate(() => { xtSetGrp('옥길중 중1'); T.w = []; });
  /* 다른 기기가 그 사이에 바꿈: 개별 배정 + 다른 트랙 교재 + 새 칸 */
  await pg.evaluate(() => { const v = T.store.exam_track; v.indiv.BBB000 = [{ id: 'Y1', title: '다른 기기 개별', total: 5 }]; v.tracks['소사고 고2'].items.push({ id: 'Y2', title: '다른 기기 교재', total: 9 }); v.otherDevice = 'keep'; });
  await pg.click('#xt139-pub'); await settle(500);
  s = await S();
  t('👁 공개 누름 → 옥길중 중1 pub:true · pubTracks=[옥길중 중1] · 단추 「👁 공개」', s.tracks['옥길중 중1'].pub === true && JSON.stringify(s.pubTracks) === '["옥길중 중1"]' && (await pg.evaluate(() => /👁 공개/.test(document.getElementById('xt139-pub').innerText))), JSON.stringify(s.pubTracks));
  t('저장 전에 서버를 다시 읽어 다른 기기 것(개별 배정 · 소사고 고2 교재 · 새 칸) 그대로', s.indiv.BBB000 && s.indiv.BBB000[0].id === 'Y1' && s.tracks['소사고 고2'].items.some((i) => i.id === 'Y2') && s.otherDevice === 'keep' && s.mystery.keep === 1 && s.indiv.ZZZ999, JSON.stringify(Object.keys(s)));
  R = await stuCheck({ exam_track: s, or_studentdb: STUDENTS }, ST1);
  t('학생앱: 공개한 옥길중 중1 기말 트랙 → 교재 2권 보임', R.out.my && R.out.my.n === 2 && R.out.my.ids.join() === 'B1,B2', JSON.stringify(R.out));
  console.log('   (참고) 학생앱 트랙 화면 디데이 = ' + (R.out.my && R.out.my.dd) + ' — 학생앱은 학교 첫 디데이를 쓰고 학년을 안 본다');
  const ST3 = { lumen_rec_code: 'AAA333', name: '○○○3', grade: '중학교 3학년', school: '옥길중학교', group: 'M3' };
  R = await stuCheck({ exam_track: s, or_studentdb: STUDENTS }, ST3);
  t('학생앱: 다른 학년(옥길중 중3, 비공개 새 트랙)은 여전히 안 보임', R.out.my === null, JSON.stringify(R.out));
  await pg.click('#xt139-pub'); await settle(500);
  s = await S();
  t('🔒 다시 누름 → 비공개 · pubTracks=[__none__]', s.tracks['옥길중 중1'].pub === false && JSON.stringify(s.pubTracks) === '["__none__"]');
  await pg.evaluate(() => xtPubAll()); await settle(400);
  s = await S();
  t('「전체」 → 모든 트랙 pub:true · pubTracks = 트랙 전부', Object.keys(s.tracks).every((k) => s.tracks[k].pub === true) && s.pubTracks.length === Object.keys(s.tracks).length, JSON.stringify(s.pubTracks));
  await pg.evaluate(() => xtPubOnly('옥길중 중3')); await settle(400);
  s = await S();
  t('「이 학년만」 → 옥길중 중3 하나', JSON.stringify(s.pubTracks) === '["옥길중 중3"]');
  /* ✏️ 시험 고치기 */
  await pg.click('#xt139-edit'); await settle(200);
  t('고치기 창: 지금 시험(학사일정 기말)이 골라져 있음', await pg.evaluate(() => XT.mk && XT.mk.mode === 'edit' && /2학기 기말/.test(document.querySelector('.xt139-ex input:checked').closest('label').innerText)));
  await pg.click('.xt139-ex[data-v="manual"] input'); await settle(150);
  await pg.fill('#xt139-from', '2026-12-17'); await pg.click('#xt139-mk-ok'); await settle(500);
  s = await S();
  t('✏️ 고치기 → 12/17~12/22 · examManual · 이름 그대로', s.tracks['옥길중 중1'].exam.from === '2026-12-17' && s.tracks['옥길중 중1'].exam.to === '2026-12-22' && s.tracks['옥길중 중1'].exam.label === '2학기 기말' && s.tracks['옥길중 중1'].examManual === true);
  /* 🗑 지우기 */
  await pg.evaluate(() => { xtSetGrp('범박중 중1'); T.confirms = []; }); await pg.click('#xt139-del'); await settle(500);
  s = await S();
  t('🗑 지우기 → 확인 한 번 · 트랙 없어짐 · past 에 why delete', !s.tracks['범박중 중1'] && s.past.some((p) => p.grp === '범박중 중1' && p.why === 'delete') && (await pg.evaluate(() => T.confirms.length)) === 1 && s.past.length <= 20);
  /* 📥 지난 트랙 교재 가져오기 (범박고 고1 빈 새 트랙) */
  await pg.evaluate(() => { xtSetGrp('범박고 고1'); }); await pg.click('#xt139-pull'); await settle(500);
  s = await S();
  t('📥 지난 트랙 교재 가져오기 → 범박고 고1 교재 1권(B5)', s.tracks['범박고 고1'].items.length === 1 && s.tracks['범박고 고1'].items[0].id === 'B5');
  /* 🏫 학사일정 단추 — 학교가 날짜를 바꾸면 고침 */
  await pg.evaluate(() => { const c = T.store.school_calendar; c.schools[3].exams[1] = { from: '2026-12-11', to: '2026-12-17', days: 1, name: '지필평가', label: '2학기 기말', grades: null }; XT.a139 = null; T.w = []; });
  await pg.evaluate(() => xtPullDdays()); await settle(700);
  s = await S();
  t('🏫 학사일정: 소사고 기말 날짜 바뀜 → 트랙 12/11~12/17 · 디데이 12/11 · 띠에 날짜 고침', s.tracks['소사고 고2'].exam.from === '2026-12-11' && s.tracks['소사고 고2'].exam.to === '2026-12-17' && s.ddays.some((x) => x.school === '소사고' && x.date === '2026-12-11') && !s.ddays.some((x) => x.school === '소사고' && x.date === '2026-12-10') && (await pg.evaluate(() => document.querySelectorAll('#xt139-banner .xt139-upd').length === 1)), JSON.stringify(s.tracks['소사고 고2'].exam));
  await pg.evaluate(() => { T.w = []; T.toasts = []; xtPullDdays(); }); await settle(500);
  t('🏫 다시 누르면 「이미 최신」 · 저장 없음', (await XW()) === 0 && (await pg.evaluate(() => /이미 최신/.test(T.toasts.join('|')))));
  /* 서버를 못 읽으면 자동 저장 안 함 */
  await pg.evaluate(() => { window._gsc = window.getSupaClient; const base = window._gsc(); window.getSupaClient = () => Object.assign({}, base, { from: (tbl) => { const b = base.from(tbl); const th = b.then; b.then = function (r, j) { return tbl === 'lumen_store' ? Promise.resolve({ data: null, error: { message: '끊김' } }).then(r, j) : th.call(b, r, j); }; return b; } }); T.w = []; XT.loaded = false; render(); });
  await settle(800);
  t('서버 읽기 실패 → 자동 정리·저장 안 함 · 안내', (await XW()) === 0 && (await pg.evaluate(() => XT.loadFail === true && /못 읽었습니다/.test(T.toasts.join('|')))));
  await pg.evaluate(() => { window.getSupaClient = window._gsc; XT.loaded = false; render(); }); await settle(800);
  t('다시 연결되면 정상', await pg.evaluate(() => XT.loadFail === false));

  /* ── ⑦ 화면 폭 · 오류 · 부품 글자 ── */
  for (const v of ['grp', 'assign', 'school']) {
    await pg.evaluate((v) => { XT.view = v; XT.mk = null; xtSetGrp('옥길중 중1'); XT.view = v; render(); }, v); await settle(300);
    const W = await pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, w: window.innerWidth }));
    t('1180px ' + v + ' 화면 가로 넘침 없음', W.doc <= W.w, JSON.stringify(W));
  }
  await pg.evaluate(() => { XT.view = 'grp'; xt139MkOpen('new', ''); xt139MkSet('pick', 'manual'); }); await settle(200);
  const W2 = await pg.evaluate(() => { const m = document.querySelector('#xt139-modal > div'); const r = m.getBoundingClientRect(); return { doc: document.documentElement.scrollWidth, w: window.innerWidth, right: r.right }; });
  t('만들기 창(직접 입력 열림) 가로 넘침 없음', W2.doc <= W2.w && W2.right <= W2.w, JSON.stringify(W2));
  await pg.setViewportSize({ width: 390, height: 800 }); await settle(200);
  const W3 = await pg.evaluate(() => { const m = document.querySelector('#xt139-modal > div'); return m ? m.getBoundingClientRect().right <= window.innerWidth + 1 : true; });
  t('좁은 화면(390px)에서도 만들기 창이 화면 안', W3);
  await pg.evaluate(() => xt139MkClose());
  const src = fs.readFileSync(MOD, 'utf8');
  t('부품은 템플릿 글자(`)·화살표 함수를 쓰지 않는다', src.indexOf('`') < 0 && !/=>/.test(src));
  t('조립 결과에 부품이 그대로 (원래 시험대비 트랙 코드 뒤)', (() => { const f = fs.readFileSync(FILE, 'utf8'); const i = f.indexOf(src.slice(0, 1500)), j = f.indexOf('function xtPubList()'); return i > 0 && j > 0 && i > j; })());
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
