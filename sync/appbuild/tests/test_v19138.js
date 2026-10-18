#!/usr/bin/env node
/* 학원앱 v19-138 검사 — ⚔️ 보스 고르면 미리보기 바로 · 💾 저장 단추 가까이 · 🏞 보스 배경 (docs/raid_s2_contract.md §7)
 *   가짜 서버(lumen_store 흉내, 쓰기·지우기를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○)
 *   보관함은 진짜 도구로 만든 것: node sync/boss_lib.js --json (보스 16종 + 배경 8종) + 모르는 칸·모르는 배경 하나
 *   ① 무대 자리 계산(rxStageLayout): 가로 가운데 · 보스 맨 아래 줄 = 배경 64번째 줄 · 0 아래로 안 감 · 보스가 크면 배경 칸을 키움
 *   ② 미리보기: 설정 보스(dragon_rm)+보스 기본 배경(volcano) — 모서리 점 = 배경 색 · 보스 맨 아래 줄 = 배경 64번째 줄 · 서버와 같으면 칩 없음
 *   ③ ✏️ 고치기 → 흑기사(dark_knight) 누름 → 그 자리에서 미리보기 = 흑기사 + 어둠의 성(castle) · 「저장 안 함」 칩 · 저장 안 함 띠 · 서버에 쓴 것 없음
 *      되돌리면 띠·칩 사라짐 · 체력 입력 → 미리보기 숫자만 새 체력 · 보스 고르기 바로 아래 💾 → race_season_draft(boss dark_knight) + 다시 세기 요청
 *      저장 뒤 「서버 다시 세기 전」 칩 · 띠는 버프 칸까지 내려가도 화면 위에 붙어 있음
 *   ④ 🏞 배경 고르기: sky → raids[].bg · 미리보기 모서리 = sky 색 · 「보스 기본 배경」 → bg 지움 · 배경 아래 💾 저장
 *   ⑤ 저장 안 하고 닫기 → 한 번 묻고, 「아니오」면 그대로
 *   ⑥ 🗃 보관함: 🏞 배경 칸(9종) · 보스 카드 기본 배경 이름 · 흑기사 기본 배경 바꾸기 → bg+bgSet 만 바뀌고 나머지(모르는 칸·Claude 보스·bgs) 그대로
 *   ⑦ 📣 공개: 다시 세기 전 raid_board_draft(드래곤·화산) 에 저장한 설정(흑기사·sky·체력 200000·이름)을 입혀 raid_board 로 · 퍼센트·남은 체력 다시 셈
 *      rxApplyCfg 순수 검사: 꺼 둔 레이드 빠짐 · 가리기 풀면 hideSch 지움 · 보관함 없으면 그림 그대로
 *   ⑧ PC 1180·1366 가로 넘침 없음 · 페이지 오류 없음 · 부품 글자 검사
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19138.js lumen_v19-138.html
 *   그림: $SP/v19138_pick.png · v19138_bg.png · v19138_lib.png · v19138_wide.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-138.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-138'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'raid138_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* 진짜 보관함 (보스 16 · 배경 8) + 모르는 칸 */
const LIBF = path.join(SP, 'v19138_lib.json');
execFileSync('node', [path.join(__dirname, '..', '..', 'boss_lib.js'), '--json', LIBF], { stdio: 'pipe' });
const LIB = JSON.parse(fs.readFileSync(LIBF, 'utf8'));
LIB.updated = '2026-10-18T10:00:00.000Z'; LIB.secret = 'keep';
LIB.bosses.forEach((b) => { if (b.key === 'kraken') b.xtra = 'keep'; });
LIB.bgs.push({ key: 'my_bg', name: '모르는 배경', desc: '', w: 4, h: 2, pal: ['#112233', '#445566'], rows: ['0101', '1010'], by: 'claude', odd: 1 });
const BOSS = (k) => LIB.bosses.find((b) => b.key === k);
const BG = (k) => LIB.bgs.find((b) => b.key === k);
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(); };
const CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colorAt = (a, x, y) => { const ch = a.rows[y][x]; return ch === '.' ? null : a.pal[CH.indexOf(ch)]; };
const artOf = (b) => ({ name: b.name, w: b.w, h: b.h, pal: b.pal, rows: b.rows });
const bgArtOf = (g) => ({ key: g.key, name: g.name, w: g.w, h: g.h, floor: 58, pal: g.pal, rows: g.rows });

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', school: '옥길중학교', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '고등학교 1학년', school: '범박고등학교', group: 'H1', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '초등학교 6학년', school: '옥길버들초등학교', group: 'E6', lumen_rec_code: 'AAA333', lumen_planner: {} }];
const TIERS = [{ k: 'bronze', n: '브론즈', at: 0 }, { k: 'silver', n: '실버', at: 2000 }];
const PRIZES = { open: true, count: 2, total: 50000, detail: [{ r: '1위', w: 30000 }, { r: '2위', w: 20000 }] };
const LIVE = { id: 'S20260824', name: '2학기 중간고사 진도 레이스', from: '2026-08-18', to: '2026-09-30', open: true, showTop: 5, showDaysAfter: 30,
  buff: { on: true, max: 0.4 }, tiers: TIERS, prizes: PRIZES, leagues: { mid: true, elem: true }, raids: [{ id: 'r0', on: true, name: '옛 레이드', boss: 'oni', from: '2026-09-02', to: '2026-09-30', hp: 1000 }] };
const LIVE_BOARD = { at: '2026-10-15T09:00:00Z', seasonId: 'S20260824', name: LIVE.name, from: LIVE.from, to: LIVE.to, open: true, ended: true, endedDays: 15,
  mid: [{ code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중3', pts: 100, n: 40, rate: 80, rank: 1, tier: 'bronze', label: '브론즈' }], elem: [] };
const DRAFT = { id: 'S20261016', name: '2학기 기말고사 진도 레이스', from: '2026-10-01', to: '2026-12-22', open: false, updated: '2026-10-18T01:00:00.000Z',
  schoolFrom: { '옥길중': '2026-10-02' }, leagues: { combined: true, mid: true, high: true, elem: true, elemGrades: ['6'] },
  tiers: TIERS, prizes: PRIZES, showTop: 5, showDaysAfter: 30, mystery: { keep: 1 },
  raids: [
    { id: 'mh', on: true, name: '중고등부 레이드', boss: 'dragon_rm', grs: ['중1', '중2', '중3', '고1', '고2', '고3'], sch: '', hp: 145000, from: '2026-10-01', to: '2026-12-17', showNames: 3, hideSch: true, xtra: 'keep' },
    { id: 'e6', on: true, name: '초6 레이드', boss: 'golem', grs: ['초6'], sch: '', hp: 58000, from: '2026-10-01', to: '2026-12-17', showNames: 3 }],
  buff: { on: true, max: 0.4, boost: { on: true, flat: 1.3, max: 1, windows: [{ sch: '', grs: ['초6'], from: '2026-12-04', to: '2026-12-17' }] } } };
/* 서버가 센 결과 (드래곤 명암 판 · 화산) */
const RBD = { at: '2026-10-18T02:00:00.000Z', on: true, list: [
  { art: artOf(BOSS('dragon_rm')), bgArt: bgArtOf(BG('volcano')), hideSch: true, id: 'mh', name: '중고등부 레이드', boss: 'dragon_rm', grs: DRAFT.raids[0].grs, sch: '', from: '2026-10-01', to: '2026-12-17', dday: 60,
    hp: 145000, dealt: 27201, left: 117799, pct: 18.8, cleared: false, yesterday: 900, perDay: 1500, eta: '2026-12-30', daysIn: 18, showNames: 3, front: ['AAA222'],
    rows: [{ code: 'AAA222', nm: '가짜 별명3', gr: '', sch: '', job: null, dealt: 20000, week: 3000, y: 500 }, { code: 'AAA111', nm: '가짜 별명1', gr: '', sch: '', job: 'mage', dealt: 7201, week: 900, y: 400 }] },
  { art: artOf(BOSS('golem')), bgArt: bgArtOf(BG('cave')), id: 'e6', name: '초6 레이드', boss: 'golem', grs: ['초6'], sch: '', from: '2026-10-01', to: '2026-12-17', dday: 60, hp: 58000, dealt: 11168, left: 46832, pct: 19.3, cleared: false,
    yesterday: 300, perDay: 600, eta: null, daysIn: 3, showNames: 3, front: ['AAA333'], rows: [{ code: 'AAA333', nm: '가짜 별명2', gr: '초6', sch: '옥길버들초', job: null, dealt: 11168, week: 800, y: 300 }] }] };
const RBDRAFT = { at: '2026-10-18T03:00:00.000Z', seasonId: 'S20261016', seasonUpdated: DRAFT.updated, draft: true, name: DRAFT.name, from: DRAFT.from, to: DRAFT.to, open: false,
  mid: [{ code: 'AAA111', nm: '가짜 별명1', sch: '옥길중', gr: '중3', pts: 200, n: 50, rate: 80, rank: 1, tier: 'bronze', label: '브론즈' }], elem: [] };
const SEED = { race_season: LIVE, race_board: LIVE_BOARD, race_history: { seasons: [] }, race_watch: { at: 'x', seasonId: 'S20260824', items: [] },
  raid_board: { at: 'x', on: true, list: [{ id: 'r0' }] }, race_season_draft: DRAFT, race_board_draft: RBDRAFT, race_watch_draft: { at: 'y', seasonId: 'S20261016', items: [] },
  raid_board_draft: RBD, raid_boss_lib: LIB };
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
    window.T = { store: {}, w: [], toasts: [], SEED, confirmAns: true, confirms: [] };
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
    window.confirm = (m) => { T.confirms.push(String(m)); return T.confirmAns; };
    window.raceCompute = async function () { return { board: null, recs: 0 }; };
    T.reset = () => { T.store = clone(T.SEED); T.w = []; T.toasts = []; };
    T.reset();
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
    /* 캔버스 한 점 색 (rgb 글자) */
    T.px = (cv, x, y) => { const d = cv.getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]].join(); };
  }, { STUDENTS, SEED });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const W = () => pg.evaluate(() => T.w.filter((x) => /^(race_|raid_)/.test(String(x.key || '')) || x.op === 'del-all?'));
  const forb = (w) => w.filter((x) => FORBID.indexOf(x.key) >= 0 || x.op === 'del-all?');
  /* 미리보기 카드 하나 읽기 — 모서리 점(1,1) · 보스 맨 아래 줄 점 · 칩 */
  const PV = (id, bossKey) => pg.evaluate(({ id, bossKey }) => {
    const pv = document.querySelector('#rnx-card .rx-pv[data-id="' + id + '"]'); if (!pv) return null;
    const st = pv.querySelector('.rx-stage'), cv = st && st.querySelector('canvas');
    const out = { st: pv.dataset.st, boss: st && st.dataset.boss, bg: st && st.dataset.bg, w: cv && cv.width, h: cv && cv.height, corner: cv && T.px(cv, 1, 1),
      chip: (pv.querySelector('.rx-pvchip') || {}).innerText || '', hp: (pv.querySelector('.rx-hp') || {}).innerText || '', left: (pv.querySelector('.rx-left') || {}).innerText || '', txt: pv.innerText };
    if (cv && bossKey){
      const g = rxBossGrid(bossKey), bw = g[0].length, bh = g.length, L = rxStageLayout(128, 72, bw, bh, 2);
      let bx = -1; for (let x = 0; x < bw; x++) if (g[bh - 1][x]) { bx = x; break; }
      out.bottom = { want: g[bh - 1][bx], got: T.px(cv, L.left + bx * 2 + 1, L.top + (bh - 1) * 2 + 1), row: (L.top + (bh - 1) * 2) / 2 };
      out.above = T.px(cv, L.left + bx * 2 + 1, L.top + bh * 2 + 1); out.ax = (L.left + bx * 2) / 2;   // 보스 바로 아래 칸(행 64) = 배경
    }
    return out;
  }, { id, bossKey });
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품 함수 있음', await pg.evaluate(() => ['rxStageLayout', 'rxStageCanvas', 'rxPvLook', 'rxPvState', 'rxApplyCfg', 'rxLibSetBg', 'rxDirtyPaint', 'rnxPublish'].every((f) => typeof window[f] === 'function')));
  t('보관함 = 진짜 도구 결과 (보스 16 · 배경 8+1 · 흑기사 기본 배경 castle)', LIB.bosses.length === 16 && LIB.bgs.length === 9 && BOSS('dark_knight').bg === 'castle' && BG('castle').w === 128 && BG('castle').h === 72, LIB.bosses.length + '/' + LIB.bgs.length);

  /* ① 무대 자리 계산 */
  const SL = await pg.evaluate(() => ({ a: rxStageLayout(128, 72, 40, 37, 2), b: rxStageLayout(128, 72, 30, 70, 1), c: rxStageLayout(128, 72, 200, 40, 1), d: rxStageLayout(128, 72, 41, 10, 3) }));
  t('흑기사 40x37 · 2배: 가로 가운데(88px) · top=(64−37)×2=54', SL.a.left === 88 && SL.a.top === 54 && SL.a.cw === 256 && SL.a.ch === 144 && SL.a.f === 1, JSON.stringify(SL.a));
  t('보스가 64줄보다 크면 top=0', SL.b.top === 0, JSON.stringify(SL.b));
  t('보스가 배경보다 넓으면 배경 칸을 키움(f=2 · 둘 다 줄여 보이게)', SL.c.f === 2 && SL.c.cw === 256 && SL.c.left === 28 && SL.c.top === 88, JSON.stringify(SL.c));
  t('홀수 폭은 칸 단위로 가운데 (41 · 3배 → left 129)', SL.d.left === 129 && SL.d.top === 162, JSON.stringify(SL.d));

  /* ② 미리보기 — 설정과 서버가 같을 때 */
  await pg.evaluate(() => { VIEW = 'race'; render(); }); await settle(1200);
  let P = await PV('mh', 'dragon_rm');
  t('미리보기 중고등부: 명암 드래곤 + 화산 배경 · 무대 256x144', P && P.boss === 'dragon_rm' && P.bg === 'volcano' && P.w === 256 && P.h === 144, JSON.stringify(P && { b: P.boss, bg: P.bg, w: P.w, h: P.h }));
  t('모서리 점(1,1) = 화산 배경 첫 칸 색', P && P.corner === hex(colorAt(BG('volcano'), 0, 0)), P && P.corner + ' vs ' + hex(colorAt(BG('volcano'), 0, 0)));
  t('보스 맨 아래 줄 = 배경 64번째 줄(행 63) · 그 칸 색 = 보스 색 · 바로 아래 = 배경', P && P.bottom.row === 63 && P.bottom.got === hex(P.bottom.want) && P.above === hex(colorAt(BG('volcano'), P.ax, 64)), JSON.stringify(P && [P.bottom, P.above, P.ax]));
  t('서버 계산과 설정이 같으면 칩 없음', P && P.st === '' && !P.chip, P && P.st);
  t('그리는 동안 서버에 쓴 것 없음', (await W()).length === 0);

  /* ③ 흑기사 고르기 → 바로 바뀜 */
  await pg.click('#rx-edit'); await settle(250);
  t('고치기 열림: 처음엔 저장 안 함 띠 숨김', await pg.evaluate(() => { const b = document.getElementById('rx-dirty'); return !!b && getComputedStyle(b).display === 'none'; }));
  t('보스 고르기 바로 아래 💾 저장 단추', await pg.evaluate(() => { const d = document.getElementById('rx-dex'), n = d && d.nextElementSibling; return !!(n && n.querySelector('#rx-save-boss')); }));
  await pg.click('#rx-dex .rx-boss[data-b="dark_knight"]'); await settle(300);
  P = await PV('mh', 'dark_knight');
  t('흑기사 누르자마자 미리보기 = 흑기사 + 어둠의 성(castle, 보스 기본 배경)', P && P.boss === 'dark_knight' && P.bg === 'castle', JSON.stringify(P && { b: P.boss, bg: P.bg }));
  t('미리보기 캔버스: 모서리 = 어둠의 성 색 · 맨 아래 줄 = 흑기사 색(행 63)', P && P.corner === hex(colorAt(BG('castle'), 0, 0)) && P.bottom.got === hex(P.bottom.want) && P.bottom.row === 63, JSON.stringify(P && { c: P.corner, b: P.bottom }));
  t('「✏️ 저장 안 함」 칩', P && P.st === 'unsaved' && /저장 안 함/.test(P.chip), P && P.chip);
  t('고른 보스 단추 강조 · 이름 칸 = 흑기사', await pg.evaluate(() => /a78bfa/.test(document.querySelector('#rx-dex .rx-boss[data-b="dark_knight"]').getAttribute('style')) && /흑기사/.test(document.querySelector('.rx-pv[data-id="mh"] .rx-pvboss').innerText)));
  t('저장 안 함 띠 보임 · 💾 단추 옆 안내 보임', await pg.evaluate(() => getComputedStyle(document.getElementById('rx-dirty')).display === 'flex' && /저장하지 않은 변경/.test(document.getElementById('rx-dirty').innerText) && getComputedStyle(document.querySelector('.rx-savehint')).visibility === 'visible'));
  t('고르기만 해서는 서버에 쓴 것 없음', (await W()).length === 0, JSON.stringify(await W()));
  await pg.screenshot({ path: SP + '/v19138_pick.png' });
  /* 되돌리면 띠·칩 사라짐 */
  await pg.click('#rx-dex .rx-boss[data-b="dragon_rm"]'); await settle(250);
  P = await PV('mh');
  t('다시 명암 드래곤 → 띠 숨김 · 칩 없음', P && P.st === '' && (await pg.evaluate(() => getComputedStyle(document.getElementById('rx-dirty')).display === 'none')), P && P.st);
  await pg.click('#rx-dex .rx-boss[data-b="dark_knight"]'); await settle(250);
  /* 체력 입력 → 미리보기 숫자만 새 체력 (입력 칸은 다시 그리지 않음) */
  await pg.fill('#rx-hp', '200000'); await settle(500);
  P = await PV('mh');
  t('체력 200000 → 막대 27,201 / 200,000 (13.6%) · 남은 체력 172,799 · 피해 숫자는 서버 것', P && /27,201 \/ 200,000 \(13\.6%\)/.test(P.hp) && P.left === '172,799', P && P.hp + ' ' + P.left);
  t('체력 입력 칸 포커스 그대로', await pg.evaluate(() => document.activeElement && document.activeElement.id === 'rx-hp'));
  /* 띠는 버프 칸까지 내려가도 화면 위에 붙어 있다 */
  await pg.evaluate(() => document.getElementById('rx-save').scrollIntoView({ block: 'end' })); await settle(150);
  const ST = await pg.evaluate(() => { const r = document.getElementById('rx-dirty').getBoundingClientRect(), h = document.querySelector('#rx-raid').getBoundingClientRect(); return { top: r.top, bot: r.bottom, ih: innerHeight, raidTop: h.top }; });
  t('아래 «💾 레이드·버프 저장» 까지 내려도 저장 안 함 띠가 화면 위에 보임', ST.top >= -1 && ST.bot <= ST.ih && ST.raidTop < 0, JSON.stringify(ST));
  /* 보스 아래 💾 저장 */
  await pg.evaluate(() => { T.w = []; T.toasts = []; }); await pg.click('#rx-save-boss'); await settle(600);
  let w = await W();
  const S1 = await pg.evaluate(() => ({ d: T.store.race_season_draft, rq: T.store.race_recount_req, edit: RX.edit, toast: T.toasts.join('|') }));
  t('보스 아래 💾 → race_season_draft + race_recount_req 만', w.map((x) => x.key).join() === 'race_season_draft,race_recount_req' && forb(w).length === 0, JSON.stringify(w));
  t('저장 값: 흑기사 · 체력 200000 · 모르는 칸 그대로 · 편집 닫힘 · 알림', S1.d.raids[0].boss === 'dark_knight' && S1.d.raids[0].hp === 200000 && S1.d.raids[0].xtra === 'keep' && S1.d.mystery.keep === 1 && !S1.edit && /저장했습니다/.test(S1.toast) && S1.rq && S1.rq.by === 'teacher', JSON.stringify(S1.d.raids[0]));
  P = await PV('mh', 'dark_knight');
  t('저장 뒤(다시 세기 전): 미리보기 흑기사 그대로 · 「⏳ 서버 다시 세기 전」 칩 · 띠 없음', P && P.boss === 'dark_knight' && P.st === 'recount' && /다시 세기 전/.test(P.chip) && !(await pg.evaluate(() => document.getElementById('rx-dirty'))), P && P.st);
  t('닫힌 칸 칩 줄에 배경 이름(🏞 어둠의 성)', await pg.evaluate(() => /흑기사 · 🏞 어둠의 성/.test(document.getElementById('rx-raid').innerText)));

  /* ④ 배경 고르기 */
  await pg.evaluate(() => rxEdit(true)); await settle(250);
  t('배경 고르기 = 보스 기본 + 보관함 9종 · 처음엔 「보스 기본 배경」 선택', await pg.evaluate(() => { const b = document.querySelectorAll('#rx-bgdex .rx-bg'); return b.length === 10 && /a78bfa/.test(b[0].getAttribute('style')) && b[0].dataset.bg === '' && /어둠의 성/.test(b[0].innerText) && b[0].querySelector('canvas').width === 128; }));
  await pg.click('#rx-bgdex .rx-bg[data-bg="sky"]'); await settle(300);
  P = await PV('mh', 'dark_knight');
  t('노을 구름(sky) 누름 → raids[].bg=sky · 미리보기 모서리 = sky 색 · 저장 안 함', (await pg.evaluate(() => RX.raids[0].bg)) === 'sky' && P.bg === 'sky' && P.corner === hex(colorAt(BG('sky'), 0, 0)) && P.st === 'unsaved' && /노을 구름/.test(P.txt), JSON.stringify({ bg: P.bg, c: P.corner, st: P.st }));
  t('보스는 그대로 흑기사 · 맨 아래 줄 행 63', P.boss === 'dark_knight' && P.bottom.row === 63 && P.bottom.got === hex(P.bottom.want));
  await pg.screenshot({ path: SP + '/v19138_bg.png' });
  await pg.click('#rx-bgdex .rx-bg[data-bg=""]'); await settle(250);
  P = await PV('mh');
  t('「보스 기본 배경」 → raids[].bg 지움 · 다시 어둠의 성', (await pg.evaluate(() => !('bg' in RX.raids[0]))) && P.bg === 'castle', P.bg);
  await pg.click('#rx-bgdex .rx-bg[data-bg="sky"]'); await settle(250);
  t('배경 고르기 바로 아래 💾 저장 단추', await pg.evaluate(() => { const d = document.getElementById('rx-bgdex'), n = d && d.nextElementSibling; return !!(n && n.querySelector('#rx-save-bg')); }));
  /* ⑤ 저장 안 하고 닫기 → 묻는다 */
  await pg.evaluate(() => { T.confirmAns = false; T.confirms = []; rxEdit(false); T.confirmAns = true; }); await settle(150);
  t('저장 안 하고 닫기 → 한 번 묻고 「아니오」면 그대로', await pg.evaluate(() => RX.edit && RX.raids[0].bg === 'sky' && T.confirms.length === 1 && /저장하지 않은 변경/.test(T.confirms[0])));
  await pg.evaluate(() => { T.w = []; T.toasts = []; }); await pg.click('#rx-save-bg'); await settle(600);
  w = await W();
  t('배경 아래 💾 → race_season_draft(bg sky) + 다시 세기 요청', w.map((x) => x.key).join() === 'race_season_draft,race_recount_req' && (await pg.evaluate(() => T.store.race_season_draft.raids[0].bg === 'sky' && T.store.race_season_draft.raids[0].boss === 'dark_knight')), JSON.stringify(w));
  t('변경 없이 닫으면 묻지 않음', await pg.evaluate(() => { rxEdit(true); T.confirms = []; rxEdit(false); return !RX.edit && T.confirms.length === 0; }));

  /* ⑥ 🗃 보관함 — 배경 칸 · 보스 기본 배경 바꾸기 */
  await pg.evaluate(() => { T.w = []; }); await pg.click('#rx-lib-open'); await settle(500);
  const B0 = await pg.evaluate(() => ({ bgc: document.querySelectorAll('#rxl-bgs .rxl-bgcard').length, cv: document.querySelectorAll('#rxl-bgs .rxl-bgcard canvas').length,
    dragon: (document.querySelector('.rxl-card[data-key="dragon"] .rxl-bgname') || {}).innerText || '', dk: (document.querySelector('.rxl-card[data-key="dark_knight"] .rxl-bgname') || {}).innerText || '',
    sel: document.querySelectorAll('.rxl-card .rxl-bgsel').length, cards: document.querySelectorAll('.rxl-card').length, users: ((document.querySelector('.rxl-bgcard[data-key="castle"]') || {}).innerText || '') }));
  t('🏞 배경 칸: 9종 그림 (8 + 모르는 배경)', B0.bgc === 9 && B0.cv === 9, JSON.stringify(B0));
  t('보스 카드마다 기본 배경 이름 (드래곤 → 화산 · 흑기사 → 어둠의 성) · 바꾸기 고르기 16개', /화산/.test(B0.dragon) && /어둠의 성/.test(B0.dk) && B0.sel === 16 && B0.cards === 16, JSON.stringify(B0).slice(0, 300));
  t('배경 카드에 쓰는 보스 (어둠의 성 ← 흑기사)', /흑기사/.test(B0.users), B0.users);
  await pg.screenshot({ path: SP + '/v19138_lib.png' });
  const before = await pg.evaluate(() => JSON.parse(JSON.stringify(T.store.raid_boss_lib)));
  await pg.evaluate(() => { T.w = []; const s = document.querySelector('.rxl-card[data-key="dark_knight"] .rxl-bgsel'); s.value = 'forest'; s.dispatchEvent(new Event('change')); }); await settle(500);
  w = await W();
  const after = await pg.evaluate(() => T.store.raid_boss_lib);
  const dkA = after.bosses.find((b) => b.key === 'dark_knight');
  t('흑기사 기본 배경 → 밤 숲: raid_boss_lib 하나만 씀 · bg forest · bgSet true', w.map((x) => x.key).join() === 'raid_boss_lib' && dkA.bg === 'forest' && dkA.bgSet === true, JSON.stringify(w));
  const others = (L) => JSON.stringify(L.bosses.map((b) => b.key === 'dark_knight' ? Object.assign({}, b, { bg: null, bgSet: null }) : b));
  const dkB = before.bosses.find((b) => b.key === 'dark_knight');
  t('나머지 그대로: 다른 보스 15 · 흑기사 그림 · bgs 9(모르는 배경 포함) · 모르는 칸(secret · xtra · odd)', others(after) === JSON.stringify(before.bosses.map((b) => b.key === 'dark_knight' ? Object.assign({}, b, { bg: null, bgSet: null }) : b))
    && JSON.stringify(after.bgs) === JSON.stringify(before.bgs) && after.secret === 'keep' && after.bosses.find((b) => b.key === 'kraken').xtra === 'keep' && after.bgs.find((b) => b.key === 'my_bg').odd === 1
    && dkA.rows.join() === dkB.rows.join() && after.bosses.filter((b) => b.by === 'claude').length === before.bosses.filter((b) => b.by === 'claude').length && after.updated !== before.updated, 'diff');
  t('카드에 새 배경 · 「원장님이 고름」 · 알림', await pg.evaluate(() => /밤 숲/.test(document.querySelector('.rxl-card[data-key="dark_knight"] .rxl-bgname').innerText) && /원장님이 고름/.test(document.querySelector('.rxl-card[data-key="dark_knight"] .rxl-bgname').innerText) && /밤 숲/.test(T.toasts.join('|'))));
  await pg.evaluate(() => { T.w = []; T.toasts = []; return rxLibSetBg('dark_knight', 'nope'); }); await settle(200);
  t('보관함에 없는 배경으로는 안 바꿈 (쓴 것 없음)', (await W()).length === 0 && (await pg.evaluate(() => /없는 배경/.test(T.toasts.join('|')))));
  await pg.evaluate(() => rxLibClose()); await settle(300);
  t('보관함에서 바꾼 기본 배경이 고르기 «보스 기본 배경»에 바로 (흑기사 → 밤 숲)', await pg.evaluate(() => { rxEdit(true); const b = document.querySelector('#rx-bgdex .rx-bg[data-bg=""]'); const ok = /밤 숲/.test(b.innerText); rxEdit(false); return ok; }));

  /* ⑦ 📣 공개 — 다시 세기 전 raid_board_draft(드래곤·화산) + 저장한 설정(흑기사·sky·200000) */
  const AP = await pg.evaluate(() => {
    const rbd = T.store.raid_board_draft, raids = JSON.parse(JSON.stringify(T.store.race_season_draft.raids));
    const a = rxApplyCfg(rbd, raids, T.store.raid_boss_lib, '2026-10-18');
    raids[1].on = false; raids[0].hideSch = false;
    const b = rxApplyCfg(rbd, raids, T.store.raid_boss_lib, '2026-10-18');
    const c = rxApplyCfg(rbd, raids, null, '2026-10-18');
    return { a0: a.list[0], n: a.list.length, bn: b.list.length, bHide: 'hideSch' in b.list[0], c0art: c.list[0].art && c.list[0].art.rows.length, c0bg: c.list[0].bgArt && c.list[0].bgArt.key, same: JSON.stringify(rbd) === JSON.stringify(T.store.raid_board_draft) };
  });
  t('rxApplyCfg: 흑기사 · sky · 체력 200000 → 13.6% · 남은 172,799 · 원본 안 바뀜', AP.a0.boss === 'dark_knight' && AP.a0.bgArt.key === 'sky' && AP.a0.hp === 200000 && AP.a0.pct === 13.6 && AP.a0.left === 172799 && AP.a0.cleared === false && AP.n === 2 && AP.same, JSON.stringify({ b: AP.a0.boss, bg: AP.a0.bgArt && AP.a0.bgArt.key, hp: AP.a0.hp, pct: AP.a0.pct }));
  t('rxApplyCfg: 꺼 둔 레이드 빠짐 · 가리기 풀면 hideSch 지움 · 보관함 없으면 그림·배경 그대로 아님(보스 바뀌면 art 빠짐)', AP.bn === 1 && !AP.bHide && !AP.c0art && AP.c0bg === 'volcano', JSON.stringify(AP).slice(0, 200));
  await pg.evaluate(() => { VIEW = 'race'; render(); T.w = []; T.toasts = []; T.confirms = []; }); await settle(300);
  await pg.click('#rnx-publish'); await settle(800);
  w = await W();
  const order = w.map((x) => x.op + ':' + x.key).join(' → ');
  t('공개 순서 그대로: 보관 → race_season → race_board → race_watch → raid_board → _draft 4개 지우기 → 다시 세기 요청',
    order === 'put:race_history → put:race_season → put:race_board → put:race_watch → put:raid_board → del:race_season_draft → del:race_board_draft → del:race_watch_draft → del:raid_board_draft → put:race_recount_req', order);
  const PB = await pg.evaluate(() => ({ r: T.store.raid_board, conf: T.confirms.join('\n'), toast: T.toasts.join('|') }));
  const m0 = PB.r.list[0], e0 = PB.r.list[1];
  t('raid_board 중고등부 = 흑기사 그림(보관함) · 배경 sky 그림 · 이름·체력 설정대로', m0.boss === 'dark_knight' && m0.art && m0.art.rows.join() === BOSS('dark_knight').rows.join() && m0.bgArt && m0.bgArt.key === 'sky' && m0.bgArt.rows.join() === BG('sky').rows.join() && m0.bgArt.floor === 58 && m0.hp === 200000 && m0.name === '중고등부 레이드', JSON.stringify({ b: m0.boss, bg: m0.bgArt && m0.bgArt.key, hp: m0.hp }));
  t('퍼센트·남은 체력 다시 셈 · 피해·명단은 서버 것 · hideSch 그대로', m0.dealt === 27201 && m0.pct === 13.6 && m0.left === 172799 && m0.cleared === false && m0.rows.length === 2 && m0.hideSch === true && PB.r.on === true && PB.r.at !== RBD.at, JSON.stringify({ pct: m0.pct, left: m0.left }));
  t('초6 = 골렘 · 동굴 그대로', e0.boss === 'golem' && e0.bgArt.key === 'cave' && e0.hp === 58000);
  t('공개 확인 글에 흑기사 · 배경 노을 구름 · 체력 200,000', /흑기사 · 배경 노을 구름 · 체력 200,000/.test(PB.conf), PB.conf.slice(0, 400));

  /* ⑧ 화면 폭 (학원앱은 600px 아래면 모바일 홈 · 진도 레이스 화면은 오른쪽 404px 고정 칸이 있어 다음 시즌 카드는 왼쪽 남는 폭) · 부품 글자 */
  for (const vw of [1180, 1366]) {
    await pg.setViewportSize({ width: vw, height: 1000 }); await settle(200);
    await pg.evaluate(() => { T.reset(); RNX.loaded = false; RNX.at = 0; RX.at = 0; RX.edit = false; RX.base = null; VIEW = 'race'; render(); }); await settle(1200);
    await pg.evaluate(() => { rxEdit(true); rxSet('boss:dark_knight'); }); await settle(400);
    const N1 = await pg.evaluate(() => { const c = document.getElementById('rnx-card'); return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth, w: window.innerWidth, dirty: getComputedStyle(document.getElementById('rx-dirty')).display }; });
    if (vw === 1366) { await pg.evaluate(() => document.querySelector('.rx-pv[data-id="mh"]').scrollIntoView()); await pg.screenshot({ path: SP + '/v19138_wide.png' }); }
    t(vw + 'px: 고치는 중(흑기사·배경 고르기·무대) 카드·화면 가로 넘침 없음', N1.cw > 200 && N1.sw <= N1.cw + 1 && N1.doc <= N1.w && N1.dirty === 'flex', JSON.stringify(N1));
    await pg.evaluate(() => { T.confirmAns = true; rxEdit(false); });
  }
  const src = fs.readFileSync(MOD, 'utf8');
  const a = src.indexOf('window.rnxPublish = async function'), b2 = src.indexOf('/* ══ ④', a);
  const outside = src.slice(0, a) + src.slice(b2);
  const bad = FORBID.filter((k) => new RegExp("(rnxPut|rnxDel)\\(sb, '" + k + "'").test(outside));
  t('부품 안 학생앱 키 쓰기는 rnxPublish 안에만', bad.length === 0 && a > 0 && b2 > a, bad.join());
  t('부품은 템플릿 글자(`)·화살표 함수를 쓰지 않는다', src.indexOf('`') < 0 && !/=>/.test(src));
  t('조립 결과에 부품이 그대로 (raid137 뒤)', (() => { const f = fs.readFileSync(FILE, 'utf8'); const i = f.indexOf(src.slice(0, 2000)), j = f.indexOf('window.RX = { edit: false'); return i > 0 && j > 0 && i > j; })());
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
