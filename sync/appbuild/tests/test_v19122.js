#!/usr/bin/env node
/* 학원앱 v19-122 검사 — 🏁 진도 레이스 «🆕 다음 시즌 (원장님만 보기 🔒)»
 *   가짜 서버(lumen_store 흉내, 쓰기·지우기 순서를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○)
 *   ① 새 시즌 값 채우기(rnxMakeDraft): id ≠ 지금 시즌 id · 가짜 school_calendar → 학교별 시작일 · 기간 · ×1.6 · 버프(추가 버프 끔) · 상금 · 레이드 없음
 *   ② 화면: 지난 시즌이 접혀 있어도 카드가 보임 · 「🆕 새 시즌 만들기」 → race_season_draft + race_recount_req 만 씀
 *   ③ 고치기 → 💾 저장 = race_season_draft 만 (race_season · race_board 안 건드림) · 「🔄 다시 세기 요청」 = race_recount_req 만
 *   ④ race_board_draft 보여 주기(중고등부 · 고등 ×1.5 칸 · 시작일 칸) · raceCompute 는 한 번도 불리지 않음
 *   ⑤ 📣 공개 순서: race_history(보관) → race_season → race_board → race_watch · raid_board → _draft 지우기 → race_recount_req
 *      보관이 이미 있으면 race_history 를 다시 쓰지 않음 · 순위표가 없으면 공개 거절(아무것도 안 씀)
 *   ⑥ 공개 뒤 새 규칙 시즌에서 「🔄 지금 다시 세기」 = 서버 요청만 (raceCompute 안 부름 · race_board 안 씀)
 *   ⑦ 부품 글자 검사: race_season/race_board/race_watch/raid_board/race_history 쓰기는 rnxPublish 안에만 · raceCompute( 호출 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19122.js lumen_v19-122.html
 *   그림: $SP/v19122_card.png · v19122_form.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-122.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-122'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'racenext122_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 1학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '고등학교 1학년', school: '범박고등학교', group: 'H1', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '초등학교 6학년', school: '옥길버들초등학교', group: 'E6', lumen_rec_code: 'AAA333', lumen_planner: {} }];
const TIERS = [{ k: 'bronze', n: '브론즈', at: 0 }, { k: 'silver', n: '실버', at: 2000 }, { k: 'gold', n: '골드', at: 4000 }, { k: 'platinum', n: '플래티넘', at: 6500 }, { k: 'emerald', n: '에메랄드', at: 9000 }, { k: 'diamond', n: '다이아', at: 10800 }, { k: 'master', n: '마스터', at: 12000 }];
const ETIERS = [{ k: 'bronze', n: '브론즈', at: 0 }, { k: 'silver', n: '실버', at: 1400 }, { k: 'gold', n: '골드', at: 2800 }, { k: 'platinum', n: '플래티넘', at: 4500 }, { k: 'emerald', n: '에메랄드', at: 5200 }, { k: 'diamond', n: '다이아', at: 6800 }, { k: 'master', n: '마스터', at: 8300 }];
const PRIZES = { open: true, count: 5, total: 100000, detail: [{ r: '1위', w: 45000 }, { r: '2위', w: 25000 }, { r: '3위', w: 10000 }, { r: '꾸준상', w: 10000 }, { r: '성장상', w: 10000 }] };
const LIVE = { id: 'S20260824', name: '2학기 중간고사 진도 레이스', from: '2026-08-18', to: '2026-09-30', open: true, showTop: 5, showDaysAfter: 30,
  buff: { on: true, max: 0.4, boost: { on: true, max: 1, flat: 1.3, from: '2026-09-22' } }, tiers: TIERS, bands: { elem: { tiers: ETIERS } }, prizes: PRIZES,
  leagues: { mid: true, elem: true, high: false, elemGrades: ['6'] }, raids: [{ id: 'r0', on: true, name: '레이드', from: '2026-09-02', to: '2026-09-30', hp: 1000 }] };
const LIVE_BOARD = { at: '2026-10-15T09:00:00Z', seasonId: 'S20260824', name: LIVE.name, from: LIVE.from, to: LIVE.to, open: true, ended: true, endedDays: 15,
  mid: [{ code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중1', pts: 100, n: 40, rate: 80, hard: 1, days: 9, rank: 1, tier: 'bronze', label: '브론즈 IV' }],
  elem: [{ code: 'AAA333', nm: '가짜 별명2', sch: '옥길버들초', gr: '초6', pts: 50, n: 20, rate: 70, hard: 0, days: 5, rank: 1, tier: 'bronze', label: '브론즈 IV' }], midAwards: null, compare: {} };
const ex = (label, from, to, grades) => ({ label, from, to, days: 1, name: '지필평가', grades: grades || null });
const CAL = { at: '2026-10-15T21:37:20Z', year: 2026, keyed: true, students: {}, schools: [
  { name: '범박중학교', short: '범박중', kind: '중', next: { label: '2학기 기말', from: '2026-11-10', to: '2026-11-12' }, exams: [ex('1학기 중간', '2026-04-27', '2026-04-27'), ex('1학기 기말', '2026-06-30', '2026-07-02'), ex('2학기 중간', '2026-09-29', '2026-09-29'), ex('2학기 기말', '2026-11-10', '2026-11-12', [3]), ex('2학기 기말', '2026-12-09', '2026-12-10', [1, 2])] },
  { name: '옥길중학교', short: '옥길중', kind: '중', next: { label: '2학기 기말', from: '2026-11-13', to: '2026-11-17' }, exams: [ex('1학기 중간', '2026-04-28', '2026-04-29'), ex('1학기 기말', '2026-07-06', '2026-07-08'), ex('2학기 중간', '2026-09-30', '2026-10-01'), ex('2학기 기말', '2026-11-13', '2026-11-17', [3]), ex('2학기 기말', '2026-12-18', '2026-12-22', [1, 2])] },
  { name: '옥길버들초등학교', short: '옥길버들초등학교', kind: '초', next: null, exams: [] },
  { name: '범박고등학교', short: '범박고등', kind: '고', next: { label: '2학기 기말', from: '2026-12-07', to: '2026-12-11' }, exams: [ex('1학기 중간', '2026-04-27', '2026-04-30'), ex('1학기 기말', '2026-06-29', '2026-07-03'), ex('2학기 중간', '2026-09-29', '2026-10-06'), ex('2학기 기말', '2026-12-07', '2026-12-11')] },
  { name: '소사고등학교', short: '소사고등', kind: '고', next: { label: '2학기 기말', from: '2026-12-10', to: '2026-12-16' }, exams: [ex('1학기 기말', '2026-06-29', '2026-07-03'), ex('1학기 중간', '2026-04-23', '2026-04-29'), ex('2학기 중간', '2026-10-06', '2026-10-13'), ex('2학기 기말', '2026-12-10', '2026-12-16')] }] };
const SEED = { race_season: LIVE, race_board: LIVE_BOARD, race_history: { seasons: [] }, school_calendar: CAL, race_watch: { at: 'x', seasonId: 'S20260824', items: [] },
  raid_board: { at: 'x', on: true, list: [{ id: 'r0' }] }, race_awards: { seasonId: 'S20260824', awards: [] } };
const FORBID = ['race_season', 'race_board', 'race_watch', 'raid_board', 'race_history'];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, SEED }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], toasts: [], computeN: 0, SEED };
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
          if (b.op === 'delete') { Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).forEach((k) => { T.w.push({ op: 'del', tbl, key: k }); delete T.store[k]; }); if (!b.eqv.length) T.w.push({ op: 'del-all?', tbl }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          if (b.op === 'update') { T.w.push({ op: 'update', tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    window.raceCompute = async function () { T.computeN++; return { board: null, recs: 0 }; };   /* 불리면 안 된다 — 불리면 센다 */
    T.reset = () => { T.store = clone(T.SEED); T.w = []; T.toasts = []; };
    T.reset();
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
  }, { STUDENTS, SEED });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  /* 앱이 뒤에서 하는 다른 동기화(cn_font 등)는 빼고 레이스 키만 본다 */
  const W = () => pg.evaluate(() => T.w.filter((x) => /^(race_|raid_)/.test(String(x.key || '')) || x.op === 'del-all?'));
  const forb = (w) => w.filter((x) => FORBID.indexOf(x.key) >= 0 || x.op === 'del-all?');
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품 함수 있음 (rnxCardHtml · rnxMakeDraft · rnxPublish)', await pg.evaluate(() => ['rnxCardHtml', 'rnxMakeDraft', 'rnxPublish', 'rnxSave', 'rnxRequestRecount', 'rnxCreate'].every((f) => typeof window[f] === 'function')));

  /* ① 값 채우기 (순수 함수) */
  const D = await pg.evaluate(() => rnxMakeDraft(T.SEED.race_season, T.SEED.school_calendar, T.SEED.race_history, '2026-10-16'));
  t('새 id = S20261016 (지금 시즌 S20260824 와 다름)', D.id === 'S20261016' && D.id !== 'S20260824', D.id);
  const idSame = await pg.evaluate(() => [rnxNewId('2026-08-24', { id: 'S20260824' }, null), rnxNewId('2026-10-16', { id: 'S20260824' }, { seasons: [{ seasonId: 'S20261016' }] })]);
  t('같은 날 만들면 id 끝에 b — 지금 시즌·보관함 id 와 겹치지 않음', idSame[0] === 'S20260824b' && idSame[1] === 'S20261016b', JSON.stringify(idSame));
  t('학교별 시작일 = 범박중 10/1 · 옥길중 10/2 · 범박고 10/7 · 소사고 10/14 (초등 없음)', JSON.stringify(D.schoolFrom) === JSON.stringify({ '범박중': '2026-10-01', '옥길중': '2026-10-02', '범박고': '2026-10-07', '소사고': '2026-10-14' }), JSON.stringify(D.schoolFrom));
  t('이름 「2학기 기말고사 진도 레이스」 · 10/1 ~ 12/22', D.name === '2학기 기말고사 진도 레이스' && D.from === '2026-10-01' && D.to === '2026-12-22', [D.name, D.from, D.to].join(' '));
  t('highMult 1.5 · 중고등부 한 줄 · 초6 체험 · open:false · 레이드 없음', D.highMult === 1.5 && D.leagues.combined === true && D.leagues.mid && D.leagues.high && D.leagues.elem && D.leagues.elemGrades.join() === '6' && D.open === false && !D.raids && !D.raid && !D.next, JSON.stringify(D.leagues));
  t('리그 문턱 = 지난 시즌 ×1.6 (100 단위) · 초등부 문턱도', D.tiers.map((x) => x.at).join() === '0,3200,6400,10400,14400,17300,19200' && D.bands.elem.tiers.map((x) => x.at).join() === '0,2200,4500,7200,8300,10900,13300', D.tiers.map((x) => x.at).join());
  t('버프 = 지난 시즌 것 · 추가 버프 끔 · 상금·공개 인원·발표 뒤 날수 그대로', D.buff.on === true && D.buff.max === 0.4 && D.buff.boost && D.buff.boost.on === false && JSON.stringify(D.prizes) === JSON.stringify(PRIZES) && D.showTop === 5 && D.showDaysAfter === 30, JSON.stringify(D.buff));
  const D2 = await pg.evaluate(() => { const c = JSON.parse(JSON.stringify(T.SEED.school_calendar)); c.schools[1].exams.forEach((e) => { if (e.label === '2학기 중간') { e.from = '2026-09-10'; e.to = '2026-09-11'; } }); return rnxAutoSchoolFrom(c, '2026-09-30').map; });
  t('중간고사가 지난 시즌 안에 끝났으면 시작일 = 지난 시즌 끝난 다음 날(10/1)', D2['옥길중'] === '2026-10-01', JSON.stringify(D2));

  /* ② 화면 · 만들기 */
  await pg.evaluate(() => { VIEW = 'race'; render(); }); await settle(900);
  const V0 = await pg.evaluate(() => ({ card: !!document.getElementById('rnx-card'), create: !!document.getElementById('rnx-create'), folded: typeof seaFolded === 'function' && seaFolded(), fold: /지난 시즌 「/.test(document.body.innerText), txt: (document.getElementById('rnx-card') || {}).innerText || '' }));
  t('지난 시즌이 접혀 있어도 「🆕 다음 시즌 (원장님만 보기 🔒)」 카드 · 「🆕 새 시즌 만들기」', V0.card && V0.create && V0.folded && V0.fold && /원장님만 보기/.test(V0.txt), JSON.stringify(V0).slice(0, 200));
  t('처음 화면을 그리는 동안 서버에 쓴 것 없음', (await W()).length === 0, JSON.stringify(await W()));
  await pg.click('#rnx-create'); await settle(500);
  let w = await W();
  const C1 = await pg.evaluate(() => ({ d: T.store.race_season_draft, rq: T.store.race_recount_req, form: !!document.getElementById('rnx-name'), live: T.store.race_season.id }));
  t('만들기 → race_season_draft + race_recount_req 만 씀 (학생앱 키 안 건드림)', w.map((x) => x.key).join() === 'race_season_draft,race_recount_req' && forb(w).length === 0, JSON.stringify(w));
  t('저장된 다음 시즌 id ≠ 지금 시즌 id · open:false · 지금 시즌 그대로', C1.d && C1.d.id !== C1.live && /^S\d{8}/.test(C1.d.id) && C1.d.open === false && C1.live === 'S20260824', C1.d && C1.d.id);
  t('다시 세기 요청 {at, by:teacher} · 만들면 바로 고치기 칸이 열림', C1.rq && C1.rq.by === 'teacher' && !!Date.parse(C1.rq.at) && C1.form, JSON.stringify(C1.rq));
  await pg.screenshot({ path: SP + '/v19122_form.png', fullPage: false });

  /* ③ 고치기 → 저장 */
  await pg.evaluate(() => { T.w = []; });
  await pg.fill('#rnx-name', '2학기 기말 레이스 (시험)'); await pg.selectOption('#rnx-hm', '1.3'); await settle(150);
  await pg.click('#rnx-comb'); await settle(150);
  await pg.fill('.rnx-sf:nth-child(1) input[type=date]', '2026-10-03'); await settle(80);
  const nSf = await pg.evaluate(() => RNX.f._sf.length);
  await pg.evaluate(() => rnxSet('sfadd')); await settle(150);
  await pg.fill('.rnx-sf:nth-child(' + (nSf + 1) + ') input[type=text]', '부천중'); await pg.fill('.rnx-sf:nth-child(' + (nSf + 1) + ') input[type=date]', '2026-10-20'); await settle(80);
  await pg.click('#rnx-save'); await settle(400);
  w = await W();
  const S1 = await pg.evaluate(() => ({ d: T.store.race_season_draft, edit: RNX.edit, live: T.store.race_season }));
  t('💾 저장 → race_season_draft (+ 다시 세기 요청) 만 · race_season/race_board 안 건드림', w.map((x) => x.key).join() === 'race_season_draft,race_recount_req' && forb(w).length === 0, JSON.stringify(w));
  t('저장 값: 이름 · ×1.3 · 중고등부 끔 · 첫 학교 10/3 · 부천중 10/20 넣음 · 폼 닫힘', S1.d.name === '2학기 기말 레이스 (시험)' && S1.d.highMult === 1.3 && S1.d.leagues.combined === false && S1.d.schoolFrom['범박중'] === '2026-10-03' && S1.d.schoolFrom['부천중'] === '2026-10-20' && !S1.edit && !('_sf' in S1.d), JSON.stringify(S1.d.schoolFrom) + ' ' + S1.d.highMult);
  t('지금 시즌(race_season) 은 처음 그대로', JSON.stringify(S1.live) === JSON.stringify(LIVE));
  await pg.evaluate(() => { T.w = []; rnxEdit(true); }); await settle(150);
  await pg.fill('#rnx-to', '2026-09-01'); await pg.click('#rnx-save'); await settle(200);
  t('기간이 뒤집히면 저장 안 함 (안내)', (await W()).length === 0 && (await pg.evaluate(() => /기간을 확인/.test(T.toasts.join('|')))), JSON.stringify(await W()));
  await pg.evaluate(() => rnxEdit(false)); await settle(100);
  await pg.evaluate(() => { T.w = []; }); await pg.click('#rnx-recount'); await settle(200);
  w = await W();
  t('「🔄 다시 세기 요청」 → race_recount_req 하나만', w.map((x) => x.key).join() === 'race_recount_req', JSON.stringify(w));

  /* ④ 서버가 센 race_board_draft 보여 주기 */
  await pg.evaluate(() => {
    const d = T.store.race_season_draft;
    T.store.race_board_draft = { at: new Date(Date.now() + 1000).toISOString(), seasonId: d.id, seasonUpdated: d.updated, draft: true, name: d.name, from: d.from, to: d.to, open: false,
      highMult: 1.5, hiTotal: 37, combined: true, bandNames: { elem: '초등부', mid: '중고등부' }, schoolFrom: d.schoolFrom, tiers: d.tiers,
      mid: [{ code: 'AAA222', nm: '가짜 별명3', sch: '범박고등', gr: '고1', pts: 300, n: 40, hi: 37, rate: 75, rank: 1, tier: 'bronze', label: '브론즈 IV', from: '2026-10-07' },
            { code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중1', pts: 200, n: 50, hi: 0, rate: 80, rank: 2, tier: 'bronze', label: '브론즈 IV', from: '2026-10-02' }],
      elem: [{ code: 'AAA333', nm: '가짜 별명2', sch: '옥길버들초', gr: '초6', pts: 90, n: 30, hi: 0, rate: 70, rank: 1, tier: 'bronze', label: '브론즈 IV', from: '2026-10-01' }] };
    T.store.race_watch_draft = { at: 'y', seasonId: d.id, items: [] };
    T.w = []; });
  await pg.evaluate(() => rnxLoad(true)); await settle(400);
  const B1 = await pg.evaluate(() => { const bands = [...document.querySelectorAll('.rnx-band')]; return { bands: bands.map((x) => x.dataset.band + ':' + x.querySelector('div').innerText), rows: document.querySelectorAll('.rnx-row').length, hiCol: /고등 ×1.5/.test((document.getElementById('rnx-card') || {}).innerText), first: (document.querySelector('.rnx-row') || {}).innerText || '', pend: /다시 세기를 요청했습니다/.test(document.getElementById('rnx-card').innerText) }; });
  t('순위표: 중고등부 2명 · 초등부(체험) 1명 · 고등 ×1.5 칸 · 시작일 칸', B1.bands.length === 2 && /중고등부/.test(B1.bands[0]) && /초등부 \(체험\)/.test(B1.bands[1]) && B1.rows === 3 && B1.hiCol && /37/.test(B1.first) && /10\/07/.test(B1.first), JSON.stringify(B1));
  t('계산이 요청보다 새로우면 «요청 중» 띠가 사라짐', !B1.pend);
  t('보여 주는 동안 쓴 것 없음 · raceCompute 한 번도 안 불림', (await W()).length === 0 && (await pg.evaluate(() => T.computeN)) === 0, JSON.stringify(await W()));
  await pg.screenshot({ path: SP + '/v19122_card.png', fullPage: false });
  const N1 = await pg.evaluate(() => { const c = document.getElementById('rnx-card'); return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth, w: window.innerWidth }; });
  t('1180px: 카드·화면 가로 넘침 없음', N1.sw <= N1.cw + 1 && N1.doc <= N1.w, JSON.stringify(N1));

  /* ⑤ 공개 */
  await pg.evaluate(() => { T.w = []; T.toasts = []; });
  await pg.click('#rnx-publish'); await settle(600);
  w = await W();
  const order = w.map((x) => x.op + ':' + x.key).join(' → ');
  t('공개 순서: 보관 → race_season → race_board → race_watch · raid_board → _draft 3개 지우기 → 다시 세기 요청',
    order === 'put:race_history → put:race_season → put:race_board → put:race_watch → put:raid_board → del:race_season_draft → del:race_board_draft → del:race_watch_draft → put:race_recount_req', order);
  const P1 = await pg.evaluate(() => ({ h: T.store.race_history, s: T.store.race_season, b: T.store.race_board, raid: T.store.raid_board, left: ['race_season_draft', 'race_board_draft', 'race_watch_draft'].filter((k) => k in T.store), rs: RACE.season && RACE.season.id, card: !!document.getElementById('rnx-create'), toast: T.toasts.join('|') }));
  t('보관함에 지난 시즌 S20260824 (순위 포함)', P1.h.seasons.length === 1 && P1.h.seasons[0].seasonId === 'S20260824' && P1.h.seasons[0].mid.length === 1 && P1.h.seasons[0].elem.length === 1, JSON.stringify(P1.h).slice(0, 200));
  t('race_season = 다음 시즌 (open:true) · race_board = 미리 센 순위표 (open:true · draft 표시 없음)', P1.s.id !== 'S20260824' && P1.s.open === true && P1.b.seasonId === P1.s.id && P1.b.open === true && !P1.b.draft && P1.b.mid.length === 2 && P1.raid.on === false, JSON.stringify([P1.s.id, P1.b.seasonId, P1.b.open]));
  t('_draft 키가 모두 지워짐 · 화면이 새 시즌으로 · 카드는 다시 「새 시즌 만들기」', P1.left.length === 0 && P1.rs === P1.s.id && P1.card && /공개했습니다/.test(P1.toast), JSON.stringify(P1.left) + P1.toast);

  /* ⑥ 공개 뒤 새 규칙 시즌 — 「지금 다시 세기」는 서버 요청만 */
  await pg.evaluate(() => { T.w = []; T.computeN = 0; });
  await pg.evaluate(() => raceRecount()); await settle(300);
  w = await W();
  t('새 규칙 시즌에서 「🔄 지금 다시 세기」 → race_recount_req 만 · raceCompute 안 부름', w.map((x) => x.key).join() === 'race_recount_req' && (await pg.evaluate(() => T.computeN)) === 0, JSON.stringify(w));
  await pg.evaluate(() => { T.w = []; T.toasts = []; raceBuffPreview(); }); await settle(200);
  t('새 규칙 시즌에서 「🔥 버프 미리보기」 막힘', (await W()).length === 0 && (await pg.evaluate(() => T.computeN)) === 0 && (await pg.evaluate(() => /새 규칙/.test(T.toasts.join('|')))));
  await pg.evaluate(() => { RACE.season = JSON.parse(JSON.stringify(T.SEED.race_season)); T.computeN = 0; return raceRecount(); }); await settle(200);
  t('옛 규칙 시즌은 예전 그대로 raceCompute 로 셈', (await pg.evaluate(() => T.computeN)) === 1);

  /* 보관이 이미 있으면 race_history 를 다시 쓰지 않는다 · 순위표가 없으면 공개 거절 */
  await pg.evaluate(() => { T.reset(); T.store.race_history = { seasons: [{ seasonId: 'S20260824', name: '옛 보관', mid: [] }] };
    const d = rnxMakeDraft(T.store.race_season, T.store.school_calendar, T.store.race_history, '2026-10-16'); T.store.race_season_draft = d;
    T.store.race_board_draft = { at: new Date().toISOString(), seasonId: d.id, seasonUpdated: d.updated, mid: [], elem: [] }; T.w = []; });
  await pg.evaluate(() => rnxPublish()); await settle(400);
  w = await W();
  t('보관이 이미 있으면 race_history 안 씀 (옛 보관 그대로)', w[0] && w[0].key === 'race_season' && !w.some((x) => x.key === 'race_history') && (await pg.evaluate(() => T.store.race_history.seasons[0].name)) === '옛 보관', w.map((x) => x.key).join());
  await pg.evaluate(() => { T.reset(); T.store.race_season_draft = rnxMakeDraft(T.store.race_season, T.store.school_calendar, null, '2026-10-16'); T.w = []; T.toasts = []; });
  await pg.evaluate(() => rnxPublish()); await settle(300);
  t('서버가 아직 안 셌으면(race_board_draft 없음) 공개 거절 · 아무것도 안 씀', (await W()).length === 0 && (await pg.evaluate(() => /아직 서버가/.test(T.toasts.join('|')))), JSON.stringify(await W()));
  await pg.evaluate(() => { T.reset(); const d = rnxMakeDraft(T.store.race_season, T.store.school_calendar, null, '2026-10-16'); T.store.race_season_draft = d; T.store.race_board_draft = { at: 'z', seasonId: 'S20260824', mid: [] }; T.w = []; });
  await pg.evaluate(() => rnxPublish()); await settle(300);
  t('다른 시즌 id 로 센 순위표면 공개 거절', (await W()).length === 0);

  /* ⑦ 부품 글자 검사 */
  const src = fs.readFileSync(MOD, 'utf8');
  const pubStart = src.indexOf('window.rnxPublish = async function'), pubEnd = src.indexOf('/* ── 카드 그리기', pubStart);
  const outside = src.slice(0, pubStart) + src.slice(pubEnd);
  const bad = FORBID.filter((k) => new RegExp("(rnxPut|rnxDel)\\(sb, '" + k + "'").test(outside) || new RegExp("key:\\s*'" + k + "'").test(outside));
  t('부품 안 race_season·race_board·race_watch·raid_board·race_history 쓰기는 rnxPublish 안에만', bad.length === 0 && pubStart > 0 && pubEnd > pubStart, bad.join());
  t('부품은 raceCompute 를 부르지 않는다 (다음 시즌은 브라우저에서 안 셈)', !/raceCompute\s*\(/.test(src));
  t('조립 결과에 부품이 그대로 들어 있음', fs.readFileSync(FILE, 'utf8').indexOf(src.slice(0, 2000)) >= 0);
  t('시작 다운로드 제외 목록에 다음 시즌 키', await pg.evaluate(() => ['race_season_draft', 'race_board_draft', 'race_watch_draft', 'race_recount_req'].every((k) => PULL_SKIP_KEYS.indexOf(k) >= 0)));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
