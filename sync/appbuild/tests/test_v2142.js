#!/usr/bin/env node
/* 학생앱 v2-142 검사 — 보스 배경(bgArt) · 배경 없으면 v2-141 과 픽셀까지 같음 · <script> 블록 node --check
 * 외부망 차단 · 가짜 Supabase(읽기만 흉내, 실서버에 아무것도 안 씀) · 학생 이름은 가짜(○○)
 * 그림은 실제 보관함 그림: `node sync/boss_lib.js --json <파일>` 의 보스 dragon_rm · 배경 volcano
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2142.js student_v2-142.html [student_v2-141.html]
 *   SP 폴더에 레이드 카드 화면(stu_v2142_raid.png)을 남긴다. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-142.html'));
const OLD = path.resolve(process.argv[3] || path.join(ROOT, 'student_v2-141.html'));
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* ── 0) <script> 블록마다 node --check ── */
(function checkScripts() {
  const html = fs.readFileSync(FILE, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, bad = 0; const dir = fs.mkdtempSync(path.join(SP, 'v2142_js_'));
  while ((m = re.exec(html))) {
    i++; const f = path.join(dir, 'block' + i + '.js'); fs.writeFileSync(f, m[1]);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad++; console.log(String(e.stderr || e.message).slice(0, 600)); }
  }
  t('<script> 블록 ' + i + '개 node --check', i > 0 && bad === 0, bad + '개 오류');
})();

/* ── 실제 보관함 그림 ── */
const libFile = path.join(SP, 'v2142_bosslib.json');
execFileSync(process.execPath, [path.join(ROOT, 'sync', 'boss_lib.js'), '--json', libFile], { stdio: 'pipe' });
const LIB = JSON.parse(fs.readFileSync(libFile, 'utf8'));
const B0 = LIB.bosses.find((b) => b.key === 'dragon_rm');
const G0 = LIB.bgs.find((g) => g.key === 'volcano');
if (!B0 || !G0) { console.log('❌ 보관함에 dragon_rm / volcano 없음'); process.exit(1); }
const ART = { name: B0.name, w: B0.w, h: B0.h, pal: B0.pal, rows: B0.rows };
const BGART = { key: G0.key, name: G0.name, w: G0.w, h: G0.h, floor: 58, pal: G0.pal, rows: G0.rows };
const CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colOf = (art, x, y) => { const c = (art.rows[y] || '').charAt(x); const k = c && c !== '.' ? CH.indexOf(c) : -1; return k >= 0 ? String(art.pal[k]).toLowerCase() : null; };

/* 가짜 Supabase + 레이드 화면 띄우기 (페이지 안에서 돈다) */
async function openRaid(br, file, raidItem) {
  const pg = await (await br.newContext({ viewport: { width: 400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + file, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  const ver = await pg.evaluate(async ({ raidItem }) => {
    const kst = (d) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
    const store = {
      race_board: { at: new Date().toISOString(), name: '테스트 레이스', from: kst(-17), to: kst(40), open: true, showTop: 5,
        tiers: [{ k: 'bronze', n: '브론즈', at: 0 }], mid: [{ code: 'AAA111', nm: '나', sch: '테스트중', gr: '중2', pts: 500, n: 40, rank: 1, tier: 'bronze' }], elem: [] },
      raid_board: { on: true, at: new Date().toISOString(), list: [raidItem] },
    };
    const rowOf = (k) => (k in store ? { key: k, value: JSON.parse(JSON.stringify(store[k])) } : null);
    window.sb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, is() { return b; }, like() { return b; }, ilike() { return b; }, contains() { return b; }, range() { return b; }, order() { return b; }, limit() { return b; }, update() { return b; }, delete() { return b; },
      maybeSingle() { return Promise.resolve({ data: tbl === 'lumen_store' && b.f.eq ? rowOf(b.f.eq) : null, error: null }); },
      single() { return b.maybeSingle(); },
      insert() { return Promise.resolve({ data: null, error: null }); },
      upsert() { return Promise.resolve({ error: null }); },               /* 아무 데도 안 쓴다 */
      then(r, j) { let keys = tbl === 'lumen_store' ? Object.keys(store) : []; if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map(rowOf), error: null }).then(r, j); } }; return b; } };
    window.isTest = false;
    window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5' };
    window.confirm = () => true; window.alert = () => {};
    const host = document.createElement('div'); host.id = 't-race';
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:900px;overflow:auto;z-index:99999;background:#fff';
    document.body.appendChild(host);
    await rcInit('t-race');
    await new Promise((r) => setTimeout(r, 300));
    if (window._rdTimer) { clearInterval(window._rdTimer); window._rdTimer = null; }   /* 움직임 멈춤 — 같은 장면으로 비교 */
    RD.anim = 0; rdPaint();
    host.scrollTop = 0;
    return STU_VER;
  }, { raidItem });
  return { pg, errs, ver };
}
const px = (pg, pts) => pg.evaluate((pts) => {
  const cv = document.getElementById('rd-cv'); if (!cv) return null;
  const c = cv.getContext('2d');
  return pts.map(([x, y]) => { const d = c.getImageData(x, y, 1, 1).data; return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); });
}, pts);
const hashCv = (pg) => pg.evaluate(() => {
  const cv = document.getElementById('rd-cv'); if (!cv) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
  return [cv.width, cv.height, h];
});

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const kst = (d) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
  const base = { id: 'm2', name: '중2 레이드', boss: 'dragon_rm', art: ART, hp: 1000, dealt: 300, pct: 30, left: 700, yesterday: 5,
    dday: 20, from: kst(-10), to: kst(20), front: ['AAA111', 'BBB222', 'EEE555'],
    rows: [{ code: 'AAA111', nm: '나', dealt: 120, week: 10, job: 'mage' }, { code: 'BBB222', nm: '김○○', dealt: 100, week: 8 },
           { code: 'EEE555', nm: '최○○', dealt: 50, week: 3 }, { code: 'DDD444', nm: '박○○', dealt: 30, week: 1 }] };

  /* ── 1) 배경 있음 ── */
  const A = await openRaid(br, FILE, Object.assign({}, base, { bgArt: BGART }));
  t('버전 v2-142', A.ver === 'v2-142', A.ver);
  const lay = await A.pg.evaluate(() => { const cv = document.getElementById('rd-cv'); const L = rdBgLayout(cv, rdArtGrid(RD.mine.bgArt), rdArtGrid(RD.mine.art), RD.mine.bgArt.floor, (120 - 4 - RAIDART.H - 20) * 3); return { cv: [cv.width, cv.height], s: L.s, ox: L.ox, bx: L.bx, by: L.by }; });
  console.log('배치:', JSON.stringify(lay));
  /* 기대값 — 계약 §7: 무대 가로를 채우는 정수 배율(330/128 → 3), 배경·보스 가운데, top = (64 − h) × 배율 */
  const S = 3, OX = Math.round((330 - 128 * S) / 2), BX = OX + Math.round((128 - ART.w) / 2) * S, BY = (64 - ART.h) * S;
  t('캔버스 330 x 360 그대로', lay.cv[0] === 330 && lay.cv[1] === 360, JSON.stringify(lay.cv));
  t('배율 3 · 배경 왼쪽 ' + OX + 'px · 보스 (' + BX + ',' + BY + ')', lay.s === S && lay.ox === OX && lay.bx === BX && lay.by === BY, JSON.stringify(lay));
  /* 무대 네 귀퉁이 중 위 두 곳·옆 가운데 — 배경 칸 색 */
  const bgAt = (x, y) => colOf(BGART, Math.floor((x - OX) / S), Math.floor(y / S));
  const cornerPts = [[0, 0], [329, 0], [0, 150], [329, 150], [40, 100]];
  const cornerGot = await px(A.pg, cornerPts);
  const cornerExp = cornerPts.map(([x, y]) => bgAt(x, y));
  t('무대 귀퉁이·가장자리 = 배경(volcano) 색 ' + JSON.stringify(cornerExp), JSON.stringify(cornerGot) === JSON.stringify(cornerExp), JSON.stringify(cornerGot));
  t('별밤 바탕색(#0d0a1d) 없음 — 귀퉁이', cornerGot.every((c) => c !== '#0d0a1d'), JSON.stringify(cornerGot));
  /* 보스 칸 — 불투명 칸을 골고루 뽑아 그 칸 한가운데 색 (anim 0 → bob 0) */
  const bossPts = [], bossExp = [];
  for (let y = 2; y < ART.h; y += 5) for (let x = 2; x < ART.w; x += 7) {
    const c = colOf(ART, x, y); if (!c) continue;
    bossPts.push([BX + x * S + 1, BY + y * S + 1]); bossExp.push(c);
  }
  const bossGot = await px(A.pg, bossPts);
  const bossBad = bossPts.filter((p, i) => bossGot[i] !== bossExp[i]);
  t('보스(dragon_rm) 칸 ' + bossPts.length + '곳 = 보스 그림 색', bossPts.length >= 20 && bossBad.length === 0, bossBad.length + '곳 다름 ' + JSON.stringify(bossBad.slice(0, 3)));
  /* 보스 맨 아래 줄 = 배경 63번째 줄(0부터) → 64번째 줄에 발 */
  let lastRow = -1; for (let y = 0; y < ART.h; y++) if (/[^.]/.test(ART.rows[y])) lastRow = y;
  t('보스 맨 아래 줄이 배경 64번째 줄(픽셀 ' + (BY + (lastRow + 1) * S) + ')', BY + (lastRow + 1) * S === 64 * S, BY + ',' + lastRow);
  /* 보스 옆 빈 칸(투명)은 배경이 보인다 */
  const tpX = (() => { for (let x = 0; x < ART.w; x++) if (!colOf(ART, x, 0)) return x; return -1; })();
  const tpGot = (await px(A.pg, [[BX + tpX * S + 1, BY + 1]]))[0];
  t('보스 투명 칸 → 배경이 비쳐 보임', tpX >= 0 && tpGot === bgAt(BX + tpX * S + 1, BY + 1), tpGot + ' vs ' + bgAt(BX + tpX * S + 1, BY + 1));
  /* 영웅은 예전 자리 — 앞줄 첫 영웅(11칸, 바닥 116−24) 근처에 무언가 그려짐(배경 아래 어둡게 깐 바닥과 다른 색) */
  const heroArea = await A.pg.evaluate(() => {
    const cv = document.getElementById('rd-cv'); const c = cv.getContext('2d');
    const H = RAIDART.H, W = RAIDART.W, GROUND = 116; const d = c.getImageData(11 * 3, (GROUND - H) * 3, W * 3, H * 3).data;
    const set = {}; for (let i = 0; i < d.length; i += 4) set[d[i] + ',' + d[i + 1] + ',' + d[i + 2]] = 1; return Object.keys(set).length;
  });
  t('앞줄 영웅이 예전 자리에 그려짐(색 여러 가지)', heroArea >= 6, heroArea);
  const names = await A.pg.evaluate(() => (document.getElementById('rd-names') || {}).textContent || '');
  t('이름줄 그대로(나 · 김○○ · 최○○)', /나/.test(names) && /김○○/.test(names) && /최○○/.test(names), names);
  const cardTxt = await A.pg.evaluate(() => (document.querySelector('#t-race .rd') || {}).textContent || '');
  t('배경 이름(' + G0.name + ' / volcano)은 화면 어디에도 안 씀', cardTxt.indexOf(G0.name) < 0 && !/volcano/.test(cardTxt), '');
  /* 같은 장면을 다시 그려도 배경 미리그림을 다시 쓴다 */
  const reuse = await A.pg.evaluate(() => { const a = RD._bg && RD._bg.cv; RD.anim = 9; rdPaint(); const b = RD._bg && RD._bg.cv; RD.anim = 0; rdPaint(); return !!a && a === b; });
  t('배경은 한 번 그려 두고 다시 씀(0.11초마다 다시 안 그림)', reuse, '');
  /* 큰 보스(130 x 80) → 배경·보스 함께 줄임, 배경은 가로를 여전히 꽉 채움(거울 이어 붙이기) */
  const big = await A.pg.evaluate(() => {
    const keep = RD.mine.art; const rows = []; for (let y = 0; y < 80; y++) rows.push(new Array(131).join('1'));
    RD.mine.art = { name: '큰 거인', w: 130, h: 80, pal: ['#120e22', '#ff00ff'], rows: rows }; RD.anim = 0; rdPaint();
    const cv = document.getElementById('rd-cv'); const c = cv.getContext('2d');
    const p = (x, y) => { const d = c.getImageData(x, y, 1, 1).data; return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); };
    const L = rdBgLayout(cv, rdArtGrid(RD.mine.bgArt), rdArtGrid(RD.mine.art), 58, (120 - 4 - RAIDART.H - 20) * 3);
    const out = { s: L.s, bx: L.bx, by: L.by, mid: p(165, 80), left: p(L.bx + 1, 5), right: p(L.bx + 130 * L.s - 2, 5), c0: p(0, 0), c1: p(329, 0) };
    RD.mine.art = keep; RD.anim = 0; rdPaint(); return out;
  });
  t('130 x 80 보스 → 배율 2로 함께 줄여 통째로(가운데·양끝 #ff00ff)', big.s === 2 && big.by === 0 && [big.mid, big.left, big.right].every((c) => c === '#ff00ff'), JSON.stringify(big));
  t('줄였을 때도 귀퉁이까지 배경(별밤색 아님)', big.c0 !== '#0d0a1d' && big.c1 !== '#0d0a1d' && G0.pal.map((c) => c.toLowerCase()).indexOf(big.c0) >= 0, JSON.stringify([big.c0, big.c1]));
  await A.pg.waitForTimeout(100);
  const rdEl = await A.pg.$('#t-race .rd');
  const shot = path.join(SP, 'stu_v2142_raid.png');
  if (rdEl) await rdEl.screenshot({ path: shot });
  t('페이지 오류 없음(배경 있음)', A.errs.length === 0, A.errs.slice(0, 3).join(' | '));

  /* ── 2) 배경 없음 → v2-141 과 캔버스 픽셀까지 같음 ── */
  const N = await openRaid(br, FILE, base);
  const O = await openRaid(br, OLD, base);
  const hN = await hashCv(N.pg), hO = await hashCv(O.pg);
  t('배경 없으면 v2-141 과 캔버스 픽셀까지 같음(' + O.ver + ')', hN && hO && JSON.stringify(hN) === JSON.stringify(hO), JSON.stringify([hN, hO]));
  const oldPts = [[0, 0], [329, 0], [165, 100], [10, 350]];
  const pN = await px(N.pg, oldPts), pO = await px(O.pg, oldPts);
  t('배경 없으면 별밤 바탕(#0d0a1d) · 바닥 띠 그대로', pN[1] === '#0d0a1d' && JSON.stringify(pN) === JSON.stringify(pO), JSON.stringify([pN, pO]));
  /* 움직임(anim 9 · 11)도 같은지 */
  const anim = async (pg) => pg.evaluate(() => { RD.anim = 11; rdPaint(); const d = document.getElementById('rd-cv').getContext('2d').getImageData(0, 0, 330, 360).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h; });
  t('배경 없으면 움직인 장면(anim 11)도 v2-141 과 같음', (await anim(N.pg)) === (await anim(O.pg)), '');
  t('페이지 오류 없음(배경 없음 · v2-141 포함)', N.errs.length === 0 && O.errs.length === 0, N.errs.concat(O.errs).slice(0, 3).join(' | '));

  console.log('\n스크린샷: ' + shot);
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
