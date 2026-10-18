#!/usr/bin/env node
/* 학원앱 v19-137 검사 — ⚔️ 다음 시즌 보스 레이드 · 🔥 학교별 시험 2주 전 버프 · 🗃 보스 보관함(꾸미기) (docs/raid_s2_contract.md §5)
 *   가짜 서버(lumen_store 흉내, 쓰기·지우기 순서를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○)
 *   ① 보관함 글자표: RAIDART 6종 → 보관함 6마리 · decode(encode(grid)) = grid · 62색 넘으면 줄임
 *   ② 버프 기간 자동 채우기: 가짜 school_calendar → 옥길중 중3 10/30~11/17 (시험 11/13~11/17) 등 계약서 6줄 · 초6 줄은 남김
 *   ③ 화면: 다음 시즌 카드 안 레이드 미리보기(raid_board_draft · art 로 그림 · 학교·학년 가림) · 버프 칸
 *   ④ 고치기 → 📅 채우기 → 💾 저장 = race_season_draft(모르는 칸 그대로) + race_recount_req 만
 *   ⑤ 보관함 만들기 → 꾸미기(왕관·불꽃·띠·별·색조·점 찍기) → 저장 = 원장 보스(t_YYYYMMDD_1) 추가 · 서버에 먼저 들어온 claude 보스 그대로
 *      명암 판(dragon_rm) 고르기 표시 · 기본 보스 못 지움 · 원장 보스 지우기
 *   ⑥ 📣 공개: raid_board_draft → raid_board (at 새로) · raid_board_draft 지움 · 레이드 없으면 꺼짐
 *   ⑦ 부품 글자 검사: 학생앱 키 쓰기는 rnxPublish 안에만
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19137.js lumen_v19-137.html
 *   그림: $SP/v19137_card.png · v19137_lib.png · v19137_deco.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-137.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-137'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'raid137_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '고등학교 1학년', school: '범박고등학교', group: 'H1', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '초등학교 6학년', school: '옥길버들초등학교', group: 'E6', lumen_rec_code: 'AAA333', lumen_planner: {} }];
const TIERS = [{ k: 'bronze', n: '브론즈', at: 0 }, { k: 'silver', n: '실버', at: 2000 }, { k: 'gold', n: '골드', at: 4000 }];
const PRIZES = { open: true, count: 2, total: 50000, detail: [{ r: '1위', w: 30000 }, { r: '2위', w: 20000 }] };
const LIVE = { id: 'S20260824', name: '2학기 중간고사 진도 레이스', from: '2026-08-18', to: '2026-09-30', open: true, showTop: 5, showDaysAfter: 30,
  buff: { on: true, max: 0.4 }, tiers: TIERS, prizes: PRIZES, leagues: { mid: true, elem: true }, raids: [{ id: 'r0', on: true, name: '옛 레이드', boss: 'oni', from: '2026-09-02', to: '2026-09-30', hp: 1000 }] };
const LIVE_BOARD = { at: '2026-10-15T09:00:00Z', seasonId: 'S20260824', name: LIVE.name, from: LIVE.from, to: LIVE.to, open: true, ended: true, endedDays: 15,
  mid: [{ code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중3', pts: 100, n: 40, rate: 80, rank: 1, tier: 'bronze', label: '브론즈' }], elem: [] };
const ex = (label, from, to, grades) => ({ label, from, to, days: 1, name: '지필평가', grades: grades || null });
const CAL = { at: '2026-10-15T21:37:20Z', year: 2026, keyed: true, students: {}, schools: [
  { name: '범박중학교', short: '범박중', kind: '중', exams: [ex('2학기 중간', '2026-09-29', '2026-09-29'), ex('2학기 기말', '2026-11-10', '2026-11-12', [3]), ex('2학기 기말', '2026-12-09', '2026-12-10', [1, 2])] },
  { name: '옥길중학교', short: '옥길중', kind: '중', exams: [ex('2학기 중간', '2026-09-30', '2026-10-01'), ex('2학기 기말', '2026-11-13', '2026-11-17', [3]), ex('2학기 기말', '2026-12-18', '2026-12-22', [1, 2])] },
  { name: '옥길버들초등학교', short: '옥길버들초등학교', kind: '초', exams: [] },
  { name: '범박고등학교', short: '범박고등', kind: '고', exams: [ex('2학기 중간', '2026-09-29', '2026-10-06'), ex('2학기 기말', '2026-12-07', '2026-12-11')] },
  { name: '소사고등학교', short: '소사고등', kind: '고', exams: [ex('2학기 중간', '2026-10-06', '2026-10-13'), ex('2학기 기말', '2026-12-10', '2026-12-16')] }] };
const WANT_WIN = [
  { sch: '범박중', grs: ['중3'], from: '2026-10-27', to: '2026-11-12' },
  { sch: '옥길중', grs: ['중3'], from: '2026-10-30', to: '2026-11-17' },
  { sch: '범박고', grs: [], from: '2026-11-23', to: '2026-12-11' },
  { sch: '범박중', grs: ['중1', '중2'], from: '2026-11-25', to: '2026-12-10' },
  { sch: '소사고', grs: [], from: '2026-11-26', to: '2026-12-16' },
  { sch: '옥길중', grs: ['중1', '중2'], from: '2026-12-04', to: '2026-12-22' }];
const DRAFT = { id: 'S20261016', name: '2학기 기말고사 진도 레이스', from: '2026-10-01', to: '2026-12-22', open: false, updated: '2026-10-18T01:00:00.000Z',
  schoolFrom: { '옥길중': '2026-10-02', '범박고': '2026-10-07' }, highMult: 1.5, leagues: { combined: true, mid: true, high: true, elem: true, elemGrades: ['6'] },
  tiers: TIERS, prizes: PRIZES, showTop: 5, showDaysAfter: 30, mystery: { keep: 1 },
  raids: [
    { id: 'mh', on: true, name: '중고등부 레이드', boss: 'dragon_rm', grs: ['중1', '중2', '중3', '고1', '고2', '고3'], sch: '', hp: 145000, from: '2026-10-01', to: '2026-12-17', showNames: 3, hideSch: true, xtra: 'keep' },
    { id: 'e6', on: true, name: '초6 레이드', boss: 'golem', grs: ['초6'], sch: '', hp: 58000, from: '2026-10-01', to: '2026-12-17', showNames: 3 }],
  buff: { on: true, max: 0.4, boost: { on: true, flat: 1.3, max: 1, extra: 'keep', windows: [{ sch: '', grs: ['초6'], from: '2026-12-04', to: '2026-12-17' }] } } };
/* 엔진이 보관함에서 담아 준 그림(art) — 4 x 3 짜리 작은 그림 */
const ART = { name: '드래곤', w: 4, h: 3, pal: ['#120e22', '#c03a4e', '#ffd24a'], rows: ['0110', '1221', '0110'] };
const RBD = { at: '2026-10-18T02:00:00.000Z', on: true, list: [
  { art: ART, hideSch: true, id: 'mh', name: '중고등부 레이드', boss: 'dragon_rm', grs: DRAFT.raids[0].grs, sch: '', from: '2026-10-01', to: '2026-12-17', dday: 60,
    hp: 145000, dealt: 27201, left: 117799, pct: 18.8, cleared: false, yesterday: 900, perDay: 1500, eta: '2026-12-30', daysIn: 18, showNames: 3, front: ['AAA222'],
    rows: [{ code: 'AAA222', nm: '가짜 별명3', gr: '', sch: '', job: null, dealt: 20000, week: 3000, y: 500 }, { code: 'AAA111', nm: '가짜 별명1', gr: '', sch: '', job: 'mage', dealt: 7201, week: 900, y: 400 }] },
  { id: 'e6', name: '초6 레이드', boss: 'golem', grs: ['초6'], sch: '', from: '2026-10-01', to: '2026-12-17', dday: 60, hp: 58000, dealt: 11168, left: 46832, pct: 19.3, cleared: false,
    yesterday: 300, perDay: 600, eta: null, daysIn: 3, showNames: 3, front: ['AAA333'], rows: [{ code: 'AAA333', nm: '가짜 별명2', gr: '초6', sch: '옥길버들초', job: null, dealt: 11168, week: 800, y: 300 }] }] };
const RBDRAFT = { at: '2026-10-18T03:00:00.000Z', seasonId: 'S20261016', seasonUpdated: DRAFT.updated, draft: true, name: DRAFT.name, from: DRAFT.from, to: DRAFT.to, open: false,
  mid: [{ code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중3', pts: 200, n: 50, rate: 80, rank: 1, tier: 'bronze', label: '브론즈' }], elem: [] };
const SEED = { race_season: LIVE, race_board: LIVE_BOARD, race_history: { seasons: [] }, school_calendar: CAL, race_watch: { at: 'x', seasonId: 'S20260824', items: [] },
  raid_board: { at: 'x', on: true, list: [{ id: 'r0' }] }, race_season_draft: DRAFT, race_board_draft: RBDRAFT, race_watch_draft: { at: 'y', seasonId: 'S20261016', items: [] }, raid_board_draft: RBD };
const FORBID = ['race_season', 'race_board', 'race_watch', 'raid_board', 'race_history'];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 900 }, timezoneId: 'Asia/Seoul' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, SEED }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], toasts: [], SEED };
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
    window.raceCompute = async function () { return { board: null, recs: 0 }; };
    T.reset = () => { T.store = clone(T.SEED); T.w = []; T.toasts = []; };
    T.reset();
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
  }, { STUDENTS, SEED });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const W = () => pg.evaluate(() => T.w.filter((x) => /^(race_|raid_)/.test(String(x.key || '')) || x.op === 'del-all?'));
  const forb = (w) => w.filter((x) => FORBID.indexOf(x.key) >= 0 || x.op === 'del-all?');
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품 함수 있음', await pg.evaluate(() => ['rxEncodeGrid', 'rxDecodeArt', 'rxLibFromArt', 'rxWindowsFromCal', 'rxMergeWindows', 'rxDecoCompose', 'rxSave', 'rxLibOpen', 'rnxPublish'].every((f) => typeof window[f] === 'function')));

  /* ① 보관함 글자표 */
  const L1 = await pg.evaluate(() => {
    const lib = rxLibFromArt('2026-10-18T00:00:00Z');
    const same = RAIDART.BOSSES.map((x) => { const b = lib.bosses.filter((y) => y.key === x.key)[0]; return !!b && JSON.stringify(rxDecodeArt(b)) === JSON.stringify(x.grid); });
    const ok = lib.bosses.every((b) => b.by === 'builtin' && b.base === null && b.w === b.rows[0].length && b.h === b.rows.length && b.rows.every((r) => /^[0-9a-zA-Z.]+$/.test(r)) && b.pal.length <= 62 && b.pal.indexOf('#120e22') >= 0);
    const many = []; for (let y = 0; y < 2; y++) { const r = []; for (let x = 0; x < 50; x++) r.push('#' + ('0' + (y * 50 + x).toString(16)).slice(-2) + '4080'); many.push(r); }
    const e = rxEncodeGrid(many);
    return { n: lib.bosses.length, keys: lib.bosses.map((b) => b.key).join(), v: lib.v, same, ok, many: e.pal.length, manyRows: e.rows.every((r) => r.indexOf('.') < 0 && r.length === 50) };
  });
  t('RAIDART → 보관함 6마리 (dragon·oni·lich·golem·paper·slime) · v:1', L1.n === 6 && L1.keys === 'dragon,oni,lich,golem,paper,slime' && L1.v === 1, L1.keys);
  t('6마리 모두 decode(encode(grid)) = grid', L1.same.length === 6 && L1.same.every(Boolean), JSON.stringify(L1.same));
  t('글자표 모양: BOSS_CH 글자 · 테두리색 포함 · by:builtin · w/h 맞음', L1.ok);
  t('100색 그림은 62색으로 줄임 (빈 칸 없이)', L1.many === 62 && L1.manyRows, L1.many);

  /* ② 버프 기간 자동 채우기 */
  const G = await pg.evaluate(() => ({ gen: rxWindowsFromCal(T.SEED.school_calendar), merged: rxMergeWindows(T.SEED.race_season_draft.buff.boost.windows, rxWindowsFromCal(T.SEED.school_calendar)) }));
  const ok3 = G.gen.filter((w) => w.sch === '옥길중' && w.grs.join() === '중3')[0];
  t('옥길중 중3: 시험 11/13~11/17 → 버프 10/30~11/17', ok3 && ok3.from === '2026-10-30' && ok3.to === '2026-11-17', JSON.stringify(ok3));
  t('계약서 6줄 그대로 (범박중·옥길중 학년 지정 · 고등 학년 비움 · 초등 없음 · 날짜순)', JSON.stringify(G.gen) === JSON.stringify(WANT_WIN), JSON.stringify(G.gen));
  t('채우기 뒤에도 손으로 넣은 초6 줄은 맨 뒤에 남음', G.merged.length === 7 && G.merged[6].grs.join() === '초6' && G.merged[6].sch === '', JSON.stringify(G.merged[6]));

  /* ③ 화면 — 다음 시즌 카드 안 레이드 미리보기 · 버프 칸 */
  await pg.evaluate(() => { VIEW = 'race'; render(); }); await settle(1200);
  const V = await pg.evaluate(() => {
    const pv = [...document.querySelectorAll('#rnx-card .rx-pv')];
    const cv = pv[0] && pv[0].querySelector('.rx-art canvas'), cv2 = pv[1] && pv[1].querySelector('.rx-art canvas');
    return { n: pv.length, ids: pv.map((x) => x.dataset.id).join(), w: cv && cv.width, h: cv && cv.height, w2: cv2 && cv2.width,
      px: cv && (() => { const d = cv.getContext('2d').getImageData(cv.width / 2 - 1, cv.height / 2 - 1, 1, 1).data; return [d[0], d[1], d[2]].join(); })(),
      txt0: pv[0] ? pv[0].innerText : '', txt1: pv[1] ? pv[1].innerText : '', boost: (document.getElementById('rx-boost') || {}).innerText || '', raid: !!document.getElementById('rx-raid'), w0: T.w.length };
  });
  t('레이드 미리보기 2개 (mh · e6)', V.n === 2 && V.ids === 'mh,e6', V.ids);
  t('중고등부: 순위판 art(4x3) 로 그림 — 캔버스 108x81 · 가운데 칸 = art 색(#ffd24a)', V.w === 108 && V.h === 81 && V.px === '255,210,74', [V.w, V.h, V.px].join(' '));
  t('초6: art 없으면 앱 기본 골렘 그림', V.w2 > 0);
  t('체력 막대·피해·앞줄·파티 명단 · 🙈 학교·학년 가림 칸 없음', /27,201 \/ 145,000/.test(V.txt0) && /앞줄/.test(V.txt0) && /파티 명단 2명/.test(V.txt0) && /학교·학년 가림/.test(V.txt0) && !/학교·학년\n/.test(V.txt0.split('파티 명단')[1] || '') && /학교·학년/.test(V.txt1.split('파티 명단')[1] || ''), V.txt0.slice(0, 300));
  t('격파 예상이 마감을 넘기면 경고', /마감을 넘깁니다/.test(V.txt0));
  t('🔥 추가 버프 칸: 켜짐 · ×1.3 · 초6 줄', /켜짐/.test(V.boost) && /×1.3/.test(V.boost) && /초6/.test(V.boost), V.boost.slice(0, 200));
  t('그리는 동안 서버에 쓴 것 없음', (await W()).length === 0, JSON.stringify(await W()));
  await pg.evaluate(() => document.getElementById('rx-raid').scrollIntoView()); await pg.screenshot({ path: SP + '/v19137_card.png' });

  /* ④ 고치기 → 채우기 → 저장 */
  await pg.click('#rx-edit'); await settle(200);
  t('고치기 열림: 레이드 칸 · 보스 고르기(보관함 없음 → 기본 6종)', await pg.evaluate(() => !!document.getElementById('rx-name') && document.querySelectorAll('#rx-dex .rx-boss').length === 6));
  await pg.click('#rx-fill'); await settle(300);
  const F = await pg.evaluate(() => RX.boost.windows);
  t('📅 채우기 → 7줄 (일정 6 + 초6)', F.length === 7 && F.some((w) => w.sch === '옥길중' && w.grs.join() === '중3' && w.from === '2026-10-30' && w.to === '2026-11-17'), JSON.stringify(F).slice(0, 200));
  await pg.fill('#rx-name', '중고등부 레이드 2판'); await pg.fill('#rx-hp', '150000');
  await pg.click('.rx-gr[data-g="고3"]'); await settle(150);
  await pg.selectOption('#rx-bflat', '1.5'); await settle(150);
  await pg.evaluate(() => { T.w = []; }); await pg.click('#rx-save'); await settle(500);
  let w = await W();
  const S = await pg.evaluate(() => ({ d: T.store.race_season_draft, rq: T.store.race_recount_req, edit: RX.edit }));
  t('💾 저장 → race_season_draft + race_recount_req 만 (학생앱 키 안 건드림)', w.map((x) => x.key).join() === 'race_season_draft,race_recount_req' && forb(w).length === 0, JSON.stringify(w));
  t('저장 값: 이름 · 체력 150000 · 고3 뺌 · ×1.5 · 7줄', S.d.raids[0].name === '중고등부 레이드 2판' && S.d.raids[0].hp === 150000 && S.d.raids[0].grs.join() === '중1,중2,중3,고1,고2' && S.d.buff.boost.flat === 1.5 && S.d.buff.boost.windows.length === 7, JSON.stringify(S.d.raids[0]));
  t('모르는 칸 그대로 (mystery · raids[].xtra · boost.extra · hideSch · schoolFrom · id)', S.d.mystery && S.d.mystery.keep === 1 && S.d.raids[0].xtra === 'keep' && S.d.buff.boost.extra === 'keep' && S.d.raids[0].hideSch === true && S.d.schoolFrom['옥길중'] === '2026-10-02' && S.d.id === 'S20261016' && S.d.updated !== '2026-10-18T01:00:00.000Z', JSON.stringify(S.d).slice(0, 200));
  t('다시 세기 요청 · 편집 닫힘', S.rq && S.rq.by === 'teacher' && !S.edit);
  await pg.evaluate(() => { rxEdit(true); }); await settle(150);
  await pg.fill('#rx-to', '2026-09-01'); await pg.evaluate(() => { T.w = []; T.toasts = []; }); await pg.click('#rx-save'); await settle(200);
  t('레이드 기간이 뒤집히면 저장 안 함', (await W()).length === 0 && (await pg.evaluate(() => /기간을 확인/.test(T.toasts.join('|')))));
  await pg.evaluate(() => rxEdit(false)); await settle(100);

  /* ⑤ 보관함 */
  await pg.evaluate(() => { T.w = []; }); await pg.click('#rx-lib-open'); await settle(400);
  const B0 = await pg.evaluate(() => ({ m: !!document.getElementById('rxlib-modal'), build: !!document.getElementById('rxl-build'), cards: document.querySelectorAll('.rxl-card').length, cv: document.querySelectorAll('.rxl-card canvas').length }));
  t('🗃 보관함 창: 보관함 없음 → 「📦 보관함 만들기」 · 기본 6종 그림', B0.m && B0.build && B0.cards === 6 && B0.cv === 6, JSON.stringify(B0));
  await pg.click('#rxl-build'); await settle(400);
  w = await W();
  const B1 = await pg.evaluate(() => T.store.raid_boss_lib);
  t('만들기 → raid_boss_lib 하나만 씀 · 6마리 builtin', w.map((x) => x.key).join() === 'raid_boss_lib' && B1.bosses.length === 6 && B1.bosses.every((b) => b.by === 'builtin'), JSON.stringify(w));
  /* 그 사이 서버 도구가 Claude 보스(명암 판 포함)를 넣었다 + 모르는 칸 */
  const today = await pg.evaluate(() => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, ''));
  await pg.evaluate(() => {
    const L = T.store.raid_boss_lib, d = L.bosses[0];
    L.bosses.push({ key: 'king_slime', name: '킹 슬라임', en: 'KING SLIME', tag: '30 x 26', desc: '', w: 3, h: 2, pal: ['#120e22', '#4fd6c1'], rows: ['010', '111'], by: 'claude', base: null, created: 'x', log: [] });
    L.bosses.push(Object.assign({}, d, { key: 'dragon_rm', tag: '46 x 38 · 명암 판', by: 'claude', base: 'dragon' }));
    L.secret = 'keep'; T.w = [];
  });
  await pg.evaluate(() => rxLibOpen()); await settle(400);
  const B2 = await pg.evaluate(() => ({ cards: document.querySelectorAll('.rxl-card').length, rm: (document.querySelector('.rxl-card[data-key="dragon_rm"]') || {}).innerText || '', delB: !!document.querySelector('.rxl-card[data-key="dragon"] .rxl-del'), delC: !!document.querySelector('.rxl-card[data-key="king_slime"] .rxl-del') }));
  t('다시 열면 8마리 · 명암 판 표시 · 기본 보스엔 지우기 단추 없음', B2.cards === 8 && /명암 판/.test(B2.rm) && /Claude/.test(B2.rm) && !B2.delB && B2.delC, JSON.stringify(B2).slice(0, 200));
  await pg.screenshot({ path: SP + '/v19137_lib.png' });
  /* 꾸미기 */
  await pg.click('.rxl-card[data-key="dragon"] .rxl-deco'); await settle(300);
  await pg.click('#rxd-head-crown'); await settle(150); await pg.click('#rxd-flame'); await settle(150); await pg.click('#rxd-band'); await settle(150); await pg.click('#rxd-spark'); await settle(150);
  await pg.evaluate(() => { const i = document.querySelector('.rxd-pc[data-i="1"]'); i.value = '#2255ee'; i.dispatchEvent(new Event('change')); }); await settle(150);
  await pg.evaluate(() => { const r = document.getElementById('rxd-hue'); r.value = '30'; r.dispatchEvent(new Event('input')); }); await settle(100);
  const D0 = await pg.evaluate(() => ({ w: RXL.last.w, h: RXL.last.h, padT: RXL.last.padT, padL: RXL.last.padL, top: RXL.last.grid[0].some(Boolean) }));
  t('얹기: 위로 칸이 늘어남 (불꽃 4칸 이상) · 옆 2칸 · 46 → 50 폭', D0.padT >= 4 && D0.padL === 2 && D0.w === 50 && D0.h >= 42, JSON.stringify(D0));
  /* 확대 격자에 펜으로 점 하나 (맨 왼쪽 위 칸) */
  await pg.evaluate(() => { RXL.d.color = '#00ff00'; });
  const box = await pg.locator('#rxd-cv').boundingBox();
  await pg.mouse.click(box.x + 2, box.y + 2); await settle(150);
  const D1 = await pg.evaluate(() => ({ e: JSON.stringify(RXL.d.edits), c: RXL.last.grid[0][0], crown: RXL.last.grid.some((r) => r.indexOf('#f5c542') >= 0), flame: RXL.last.grid.some((r) => r.indexOf('#ff7a1a') >= 0), band: RXL.last.grid.some((r) => r.indexOf('#dbe3f2') >= 0) }));
  t('펜: 확대 격자 칸 (0,0) = 바탕 좌표 (-2,-padT) 에 #00ff00', D1.c === '#00ff00' && D1.e === JSON.stringify({ ['-2,' + (-D0.padT)]: '#00ff00' }), JSON.stringify(D1));
  t('왕관(금색) · 불꽃 · 갑옷 띠가 그림에 들어감', D1.crown && D1.flame && D1.band, JSON.stringify(D1));
  await pg.evaluate(() => { RXL.d.tool = 'eraser'; rxDecoPaintAt(0, 0); RXL.d.tool = 'pen'; RXL.d.color = '#ff00ff'; rxDecoPaintAt(1, 0); });
  t('지우개: 같은 칸이 투명으로', await pg.evaluate(() => RXL.last.grid[0][0] === null && RXL.last.grid[0][1] === '#ff00ff'));
  await pg.fill('#rxd-name', '불꽃 왕 드래곤'); await settle(80);
  await pg.screenshot({ path: SP + '/v19137_deco.png' });
  const want = await pg.evaluate(() => JSON.stringify(rxDecoCompose(rxBossGrid('dragon'), RXL.d).grid));
  await pg.evaluate(() => { T.w = []; }); await pg.click('#rxd-save'); await settle(400);
  w = await W();
  const B3 = await pg.evaluate(() => T.store.raid_boss_lib);
  const tb = B3.bosses.filter((b) => b.by === 'teacher')[0];
  t('꾸미기 저장 → raid_boss_lib 하나만 씀', w.map((x) => x.key).join() === 'raid_boss_lib', JSON.stringify(w));
  t('원장 보스 추가: key t_' + today + '_1 · by teacher · base dragon · 이름', tb && tb.key === 't_' + today + '_1' && tb.base === 'dragon' && tb.name === '불꽃 왕 드래곤' && tb.w === 50 && tb.h === D0.h && tb.rows.length === tb.h, JSON.stringify(tb && { k: tb.key, w: tb.w, h: tb.h }));
  t('저장된 그림 = 꾸민 그림 (decode 일치)', tb && (await pg.evaluate((b) => JSON.stringify(rxDecodeArt(b)), tb)) === want);
  t('먼저 들어온 Claude 보스 2마리 · 기본 6 · 모르는 칸 그대로 (9마리)', B3.bosses.length === 9 && B3.bosses.some((b) => b.key === 'king_slime' && b.by === 'claude') && B3.bosses.some((b) => b.key === 'dragon_rm') && B3.secret === 'keep' && B3.bosses.filter((b) => b.by === 'builtin').length === 6, B3.bosses.map((b) => b.key).join());
  /* 두 번째 저장은 _2 */
  await pg.evaluate(() => { rxDecoStart('king_slime'); RXL.d.name = '둘째'; }); await settle(150);
  await pg.evaluate(() => rxDecoSave()); await settle(300);
  t('같은 날 두 번째 원장 보스 = _2 · 바탕 claude 보스', await pg.evaluate((d) => T.store.raid_boss_lib.bosses.some((b) => b.key === 't_' + d + '_2' && b.base === 'king_slime'), today));
  /* 보스 고르기에 명암 판 · 원장 보스 */
  await pg.evaluate(() => rxLibClose()); await settle(200);
  await pg.evaluate(() => rxEdit(true)); await settle(200);
  const P = await pg.evaluate(() => ({ n: document.querySelectorAll('#rx-dex .rx-boss').length, rm: (document.querySelector('#rx-dex .rx-boss[data-b="dragon_rm"]') || {}).innerText || '', sel: !!document.querySelector('#rx-dex .rx-boss[data-b="dragon_rm"][style*="#a78bfa"]'), t1: !!document.querySelector('#rx-dex .rx-boss[data-b="t_' + new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '') + '_1"] canvas') }));
  t('보스 고르기 = 보관함 10마리 · dragon_rm «명암 판» 표시·선택됨 · 원장 보스 그림', P.n === 10 && /명암 판/.test(P.rm) && P.sel && P.t1, JSON.stringify(P));
  await pg.evaluate(() => rxEdit(false)); await settle(100);
  /* 지우기 */
  await pg.evaluate(() => { T.w = []; T.toasts = []; return rxLibDel('dragon'); }); await settle(200);
  t('기본 보스 지우기 막힘 (쓴 것 없음)', (await W()).length === 0 && (await pg.evaluate(() => /기본 보스/.test(T.toasts.join('|')))));
  await pg.evaluate((d) => rxLibDel('t_' + d + '_1'), today); await settle(300);
  const B4 = await pg.evaluate(() => T.store.raid_boss_lib.bosses.map((b) => b.key));
  t('원장 보스 지우기 → 그 하나만 빠짐 (Claude 보스 그대로)', B4.length === 9 && B4.indexOf('t_' + today + '_1') < 0 && B4.indexOf('king_slime') >= 0 && B4.indexOf('dragon_rm') >= 0, B4.join());
  await pg.evaluate(() => { T.w = []; T.toasts = []; return rxLibDel('dragon_rm'); }); await settle(200);
  t('레이드에서 쓰는 보스(dragon_rm)는 지우기 막힘', (await W()).length === 0 && (await pg.evaluate(() => /쓰는 보스/.test(T.toasts.join('|')))));
  /* 보관함이 있으면 미리보기의 art 없는 보스도 보관함 그림 */
  t('보관함이 없을 때 명암 판(dragon_rm)은 원본 드래곤 그림으로', await pg.evaluate(() => { const keep = RX.lib; rxSetLib(null); const g = rxBossGrid('dragon_rm'); const ok = !!g && g === RAIDART.BOSSES[0].grid; rxSetLib(keep); return ok; }));
  t('지금 시즌 레이드 칸에 🗃 보스 보관함 단추', fs.readFileSync(FILE, 'utf8').indexOf('id="raid-lib-open" onclick="rxLibOpen()"') > 0);

  /* ⑥ 공개 */
  await pg.evaluate(() => { T.w = []; T.toasts = []; }); await pg.click('#rnx-publish'); await settle(700);
  w = await W();
  const order = w.map((x) => x.op + ':' + x.key).join(' → ');
  t('공개 순서: 보관 → race_season → race_board → race_watch → raid_board → _draft 4개 지우기 → 다시 세기 요청',
    order === 'put:race_history → put:race_season → put:race_board → put:race_watch → put:raid_board → del:race_season_draft → del:race_board_draft → del:race_watch_draft → del:raid_board_draft → put:race_recount_req', order);
  const PB = await pg.evaluate(() => ({ r: T.store.raid_board, left: 'raid_board_draft' in T.store, s: T.store.race_season, rb: RAID.board, toast: T.toasts.join('|') }));
  t('raid_board = raid_board_draft (on · 레이드 2개 · art · hideSch · at 새로)', PB.r.on === true && PB.r.list.length === 2 && PB.r.list[0].id === 'mh' && PB.r.list[0].art && PB.r.list[0].art.rows.join() === ART.rows.join() && PB.r.list[0].hideSch === true && PB.r.at !== RBD.at && Date.parse(PB.r.at) > Date.parse(RBD.at) && !PB.left, JSON.stringify(PB.r).slice(0, 200));
  t('race_season = 저장한 다음 시즌 (레이드 설정 포함) · 화면 RAID 도 새 순위판', PB.s.id === 'S20261016' && PB.s.raids[0].name === '중고등부 레이드 2판' && PB.rb && PB.rb.list.length === 2 && /보스 레이드 2개/.test(PB.toast), PB.toast);
  /* 레이드 없는 다음 시즌 → 꺼짐 */
  await pg.evaluate(() => { T.reset(); delete T.store.raid_board_draft; T.w = []; });
  await pg.evaluate(() => rnxPublish()); await settle(500);
  t('raid_board_draft 가 없으면 raid_board = 꺼짐', await pg.evaluate(() => T.store.raid_board.on === false && T.store.raid_board.list.length === 0 && T.store.race_season.id === 'S20261016'));
  await pg.evaluate(() => { T.reset(); T.store.raid_board_draft = { at: 'z', on: true, list: [] }; T.w = []; });
  await pg.evaluate(() => rnxPublish()); await settle(500);
  t('raid_board_draft 목록이 비면 raid_board = 꺼짐 · draft 지움', await pg.evaluate(() => T.store.raid_board.on === false && !('raid_board_draft' in T.store)));

  /* ⑦ 부품 글자 검사 */
  const src = fs.readFileSync(MOD, 'utf8');
  const a = src.indexOf('window.rnxPublish = async function'), b2 = src.indexOf('/* ══════', a);
  const outside = src.slice(0, a) + src.slice(b2);
  const bad = FORBID.filter((k) => new RegExp("(rnxPut|rnxDel)\\(sb, '" + k + "'").test(outside) || new RegExp("key:\\s*'" + k + "'").test(outside));
  t('부품 안 학생앱 키 쓰기는 rnxPublish 안에만', bad.length === 0 && a > 0 && b2 > a, bad.join());
  t('부품은 템플릿 글자(`)·화살표 함수를 쓰지 않는다', src.indexOf('`') < 0 && !/=>/.test(src));
  t('조립 결과에 부품이 그대로', fs.readFileSync(FILE, 'utf8').indexOf(src.slice(0, 3000)) >= 0);
  t('시작 다운로드 제외: raid_board_draft · raid_boss_lib', await pg.evaluate(() => ['raid_board_draft', 'raid_boss_lib'].every((k) => PULL_SKIP_KEYS.indexOf(k) >= 0)));
  await pg.evaluate(() => { T.reset(); RNX.loaded = false; RNX.at = 0; RX.at = 0; VIEW = 'race'; render(); }); await settle(1200);
  const N1 = await pg.evaluate(() => { const c = document.getElementById('rnx-card'); return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth, w: window.innerWidth }; });
  t('1180px: 카드·화면 가로 넘침 없음', N1.sw <= N1.cw + 1 && N1.doc <= N1.w, JSON.stringify(N1));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
