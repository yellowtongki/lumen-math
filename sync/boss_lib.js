#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🗃 보스 보관함 도구 (raid_boss_lib)  — docs/raid_s2_contract.md §4
 * ═══════════════════════════════════════════════════════════════════
 * 원장 2026-10-18 「다음번에 활용할 수 있게 보스디자인을 저장 · 도트디자인을 더 살린 모양」.
 *
 *  · 기본 6종 = 학원앱 코드(RAIDART.BOSSES)의 그림을 그대로 옮긴다 (by:'builtin')
 *  · Claude 가 그린 보스 = 아래 DESIGNS (by:'claude')
 *    - 글자 지도(왼쪽 절반만 그리고 좌우 대칭) + 재료 글자마다 5단 명암(밝은 빛·밝음·바탕·그늘·깊은 그늘)
 *    - 빛은 왼쪽 위에서 온다. 재료 덩어리 안에서 위·왼쪽일수록 밝고, 경계는 바둑판 점묘로 섞는다
 *    - 바깥 테두리는 기본 보스와 같은 #120e22
 *  · 리마스터 = 기본 보스 그림에 같은 명암을 입힌 것 (key 뒤에 _rm)
 *
 * 실행:
 *   node sync/boss_lib.js --json <파일>      보관함 모양 JSON 을 파일로 (서버에 안 씀 · 미리보기용)
 *   node sync/boss_lib.js --seed [--dry]     서버 raid_boss_lib 에 넣기 — 원장이 만든 것(by:'teacher')은 그대로 둔다
 *   환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY (--seed 만)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const BG = require('./boss_bg.js');   // 🏞 보스 배경 8종 (2026-10-18)

const CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OUT = '#120e22';

/* ── 그림 ↔ 보관함 글자 ─────────────────────────────── */
function encode(grid) {
  const pal = [], idx = {};
  const rows = grid.map((r) => r.map((c) => {
    if (!c) return '.';
    if (idx[c] == null) { if (pal.length >= CH.length) throw new Error('색이 62개를 넘습니다'); idx[c] = pal.length; pal.push(c); }
    return CH[idx[c]];
  }).join(''));
  return { w: grid[0].length, h: grid.length, pal, rows };
}
function decode(b) {
  return b.rows.map((r) => r.split('').map((ch) => (ch === '.' ? null : b.pal[CH.indexOf(ch)])));
}

/* ── 색 다루기 (HSL) ────────────────────────────────── */
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/* 5단 명암 — 밝을수록 노랑 쪽, 어두울수록 보라·파랑 쪽으로 색을 살짝 돌린다(도트 그림의 기본 기법) */
function ramp(hex) {
  const [h, s, l] = rgb2hsl(...hex2rgb(hex));
  const toward = (target, amt) => { let d = ((target - h + 540) % 360) - 180; return h + d * amt; };
  return [
    hsl2hex(toward(55, 0.18), s * 0.85, Math.min(0.92, l + 0.24)),   // 0 밝은 빛
    hsl2hex(toward(55, 0.08), s * 0.95, Math.min(0.85, l + 0.11)),   // 1 밝음
    hex,                                                            // 2 바탕
    hsl2hex(toward(255, 0.12), Math.min(1, s * 1.05), l * 0.74),     // 3 그늘
    hsl2hex(toward(255, 0.22), Math.min(1, s * 1.1), l * 0.52),      // 4 깊은 그늘
  ];
}

/* ── 명암 입히기 ────────────────────────────────────── */
/* mat[y][x] = 재료 이름(같은 이름끼리 한 덩어리로 본다) 또는 null · flat[y][x] = 명암 없이 그대로 칠할 색 */
function shade(mat, mats, flat) {
  const H = mat.length, W = mat[0].length;
  const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill(null));
  const run = (x, y, dx, dy) => { let n = 0; const m = mat[y][x];
    for (let i = x + dx, j = y + dy; i >= 0 && j >= 0 && i < W && j < H && mat[j][i] === m; i += dx, j += dy) n++; return n; };
  const TH = [0.17, 0.40, 0.70, 0.88];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (flat && flat[y][x]) { g[y][x] = flat[y][x]; continue; }
    const m = mat[y][x]; if (!m) continue;
    const up = run(x, y, 0, -1), dn = run(x, y, 0, 1), lf = run(x, y, -1, 0), rt = run(x, y, 1, 0);
    let s = 0.62 * (up / (up + dn + 1)) + 0.38 * (lf / (lf + rt + 1));
    if (up === 0) s -= 0.16;                   // 위를 향한 가장자리 — 빛을 받는다
    if (dn === 0) s += 0.14;                   // 아래 가장자리 — 그늘
    if (rt === 0) s += 0.06;
    let k = 0; while (k < TH.length && s >= TH[k]) k++;
    /* 경계 근처는 바둑판 점묘로 섞는다 */
    for (let t = 0; t < TH.length; t++) if (Math.abs(s - TH[t]) < 0.022 && ((x + y) & 1)) { k = s < TH[t] ? t + 1 : t; break; }
    const r = mats[m]; g[y][x] = Array.isArray(r) ? r[Math.min(4, k)] : r;
  }
  /* 바깥 테두리 */
  const o = g.map((r) => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x]) continue;
    if ((y > 0 && g[y - 1][x]) || (y < H - 1 && g[y + 1][x]) || (x > 0 && g[y][x - 1]) || (x < W - 1 && g[y][x + 1])) o[y][x] = OUT;
  }
  return o;
}

/* 글자 지도 → 그림. half=true 면 왼쪽 절반만 적고 좌우 대칭(가운데 줄이 두 칸). 대문자 = 명암 없는 색 */
function fromMap(lines, pal, opt) {
  opt = opt || {};
  const rows = lines.map((r) => (opt.half ? r + r.split('').reverse().join('') : r));
  const W = Math.max(...rows.map((r) => r.length));
  const mat = [], flat = [];
  rows.forEach((r) => {
    const m = [], f = [];
    for (let x = 0; x < W; x++) {
      const ch = r[x] || '.';
      if (ch === '.' || ch === ' ') { m.push(null); f.push(null); continue; }
      if (!pal[ch]) throw new Error('색 없음: ' + ch);
      if (/[A-Z]/.test(ch)) { m.push('flat'); f.push(pal[ch]); } else { m.push(ch); f.push(null); }
    }
    mat.push(m); flat.push(f);
  });
  const mats = {}; Object.keys(pal).forEach((k) => { if (!/[A-Z]/.test(k)) mats[k] = ramp(pal[k]); });
  return shade(mat, mats, flat);
}

/* 기본 보스 그림에 명암 입히기 (리마스터) — 칸 수가 적은 색(눈·이빨)은 그대로 둔다 */
function remaster(grid) {
  const H = grid.length, W = grid[0].length, cnt = {};
  grid.forEach((r) => r.forEach((c) => { if (c && c !== OUT) cnt[c] = (cnt[c] || 0) + 1; }));
  const mat = [], flat = [];
  for (let y = 0; y < H; y++) { const m = [], f = [];
    for (let x = 0; x < W; x++) { const c = grid[y][x];
      if (!c || c === OUT) { m.push(null); f.push(null); }
      else if (cnt[c] < 14) { m.push('flat'); f.push(c); }
      else { m.push(c); f.push(null); } }
    mat.push(m); flat.push(f); }
  const mats = {}; Object.keys(cnt).forEach((c) => { mats[c] = ramp(c); });
  return shade(mat, mats, flat);
}

/* ── Claude 가 그린 보스 ─────────────────────────────── */
const DESIGNS = [
  { key: 'king_slime', name: '킹 슬라임', en: 'KING SLIME', desc: '왕관을 쓴 슬라임. 초등부 첫 보스로 좋습니다.', half: true,
    pal: { g: '#3fc6a8', c: '#e8b23a', R: '#e0434f', B: '#3a7bd5', K: '#0e2a2a', W: '#ffffff', P: '#ff8fa3', M: '#123433', T: '#f4f7f0', d: '#2a9a85' },
    map: [
      '.........c...c...c',
      '.........cc..cc.cc',
      '.........ccccccccc',
      '.........ccRcccccB',
      '.........ccccccccc',
      '.......ggggggggggg',
      '.....ggggggggggggg',
      '....gggggggggggggg',
      '...ggggggggggggggg',
      '..gggggggggggggggg',
      '..gggggggggggggggg',
      '.ggggggggKKKgggggg',
      '.gggggggKKWKKggggg',
      '.gggggggKKKKKggggg',
      'ggggggggKKKKKggggg',
      'gggggggggKKKgggggg',
      'ggggggPPgggggggggg',
      'gggggggggggggMTMMM',
      'ggggggggggggggMMMM',
      'gggggggggggggggggg',
      'gggggggggggggggggg',
      '.ggggggggggggggggg',
      '..dggggggggggggggg',
      '..d.dgggggggggggdg',
      '..d..ddggggggdd..d',
      '.......d.....d....',
    ] },
  { key: 'kraken', name: '크라켄', en: 'KRAKEN', desc: '바다 밑 거대 문어. 다리 여덟 개가 화면을 꽉 채웁니다.', half: true,
    pal: { p: '#9b3fb5', q: '#c46ad6', Y: '#ffd84a', K: '#1a0a22', W: '#ffffff', S: '#f2b8e6', M: '#3a0f45', o: '#6a2a8a' },
    map: [
      '..............pppppppppp',
      '...........ppppppppppppp',
      '.........ppppppppppppppp',
      '........pppppqqppppppppp',
      '.......pppppqqpppppppppp',
      '......pppppppppppppppppp',
      '......pppppppppppppppppp',
      '.....ppppppppppppppppppp',
      '.....ppppppppppppppppppp',
      '.....pppppppYYYYpppppppp',
      '.....ppppppYYYYYYppppppp',
      '.....ppppppYYKKYYppppppp',
      '.....ppppppYKKWKYppppppp',
      '.....ppppppYYKKYYppppppp',
      '......pppppppYYYYppppppp',
      '......pppppppppppppppppp',
      '.......ppppppppppppMMMMM',
      '.......ppppppppppppppppp',
      '........pppppppppppppppp',
      '.....pp..ppppppppppppppp',
      '....ppp...pppppp.ppp.ppp',
      '...ppSp...pppSpp.pSp.pSp',
      '...pppp..ppppppp.ppp.ppp',
      '..ppSpp..ppSppp..ppp.pSp',
      '..pppp..pppppp...pSp.ppp',
      '.ppSpp..ppSpp...pppp.ppp',
      '.pppp..pppppp...ppSp.pSp',
      '.pSpp..ppSpp...ppppp.ppp',
      '.pppp..pppp....ppSpp.ppp',
      '..pppp.ppSp...ppppp..pSp',
      '...pppppppp...ppSpp..ppp',
      '....ppSppp...ppppp...ppp',
      '.....pppp...pppSpp..pppp',
      '...........ppppppp..pSpp',
      '..........pppppp...pppp.',
      '.........ppppp....pppp..',
      '...................pp...',
    ] },
  { key: 'dark_knight', name: '흑기사', en: 'DARK KNIGHT', desc: '뿔 달린 투구와 붉은 망토. 큰 칼을 땅에 꽂고 서 있습니다.', half: true,
    pal: { a: '#4a5578', h: '#e8dcc0', c: '#a3243a', g: '#d9a23a', b: '#c9d3e3', R: '#ff3b3b', K: '#0d0b1a', d: '#2c3350' },
    map: [
      '....h...............',
      '....hh..............',
      '....hhh.............',
      '.....hhh....aaaaaaaa',
      '......hhh.aaaaaaaaaa',
      '.......hhaaaaaaaaaaa',
      '.........aaaaaaaaaaa',
      '.........aaaaaaagggg',
      '.........aaaaKKKKKKK',
      '.........aaaKRRKKKKK',
      '.........aaaaKKKKKKK',
      '.........aaaaaaaaaaa',
      '..........aaaaaaaaaa',
      '...cc......aaaaaaaaa',
      '..ccccaaaa..dddddddd',
      '..cccaaaaaaaaaaaaaaa',
      '.cccaaaaaaaaaaaaaaaa',
      '.cccaaaaaggaaaaaaaaa',
      '.ccccaaaaaaaaaaaaaga',
      '.cccc.aaaaaaaaaaagga',
      '.cccc.aaaaaaaaaaagbb',
      'ccccc.aaa.aaaaaaagbb',
      'ccccc.aaa.aaaaaaaabb',
      'ccccc.aaa.aaaaaaagbb',
      'ccccc.aaa.ddddddddbb',
      'cccc..ggg.aaaaaaaabb',
      'cccc..aaa.aaaaaaaabb',
      'cccc......aaaaaaaabb',
      'cccc......aaaaaa.gbb',
      'cccc......aaaaaa..bb',
      'ccc.......aaaaaa..bb',
      'ccc.......aaaaa...bb',
      'ccc.......aaaaa...bb',
      'cc........aaaaa...bb',
      'cc.......aaaaaa...bb',
      'c........aaaaaa...bb',
      '........aaaaaaa....b',
    ] },
  { key: 'phoenix', name: '불사조', en: 'PHOENIX', desc: '불꽃 날개를 활짝 편 새. 쓰러져도 다시 일어나는 시험 직전 보스.', half: true,
    pal: { f: '#f0702a', y: '#ffc93a', r: '#c8282e', K: '#2a0a08', W: '#fffbe0', o: '#ff9a3c' },
    map: [
      'yy........................',
      'yyy.......................',
      'fyyy......................',
      'ffyyy.....................',
      'fffyyy....................',
      'rfffyyy...................',
      'rffffyyy..............y...',
      'rrffffyyy.............yy.y',
      '.rrffffyyy.............yyy',
      '.rrrffffyyy.........oooooo',
      '..rrrffffyyy.......ooooooo',
      '..rrrrffffyyy.....oooKKooo',
      '...rrrrffffyyy....oooKWooo',
      '...rr.rrffffyyy...ooooooyy',
      '....r.rrrffffyyy...oooooyy',
      '......rr.rrffffyyyyfffoooy',
      '.......r.rrrfffffyyfffoooo',
      '...........rrrfffffffffooo',
      '.........r..rrrrfffffffooo',
      '..............rrrrfffffooo',
      '...............r.rrffffooo',
      '....................ffoooo',
      '....................ffoooo',
      '.....................foooo',
      '.....................ffooo',
      '......................fooo',
      '.....................ffyyo',
      '....................ffyyyy',
      '...................rffy.yy',
      '..................rrff..fy',
      '.................rrff...ff',
      '................rrf....rff',
      '...............rr.....rrf.',
      '..............r......rr...',
      '.....................r....',
    ] },
];

/* ── 기본 6종 (학원앱 코드에서 그대로) ─────────────────── */
function builtins() {
  const root = path.join(__dirname, '..');
  const f = fs.readdirSync(root).filter((n) => /^lumen_v19-\d+\.html$/.test(n))
    .sort((a, b) => Number(b.match(/(\d+)\.html$/)[1]) - Number(a.match(/(\d+)\.html$/)[1]))[0];
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const a = src.indexOf('window.RAIDART = {');
  const st = src.lastIndexOf('(function(){', a), en = src.indexOf('})();', a) + 5;
  const box = { window: {}, document: { createElement: () => ({ getContext: () => ({}), style: {} }) } };
  vm.runInNewContext(src.slice(st, en), box);
  return box.window.RAIDART.BOSSES.map((B) => ({ key: B.key, name: B.name, en: B.en, tag: B.tag, desc: B.desc, grid: B.grid }));
}

function buildLib() {
  const now = new Date().toISOString();
  const out = [];
  builtins().forEach((B) => out.push({ ...pick(B), ...encode(B.grid), by: 'builtin', base: null, created: now, log: [] }));
  DESIGNS.forEach((D) => { const g = fromMap(D.map, D.pal, { half: D.half });
    out.push({ key: D.key, name: D.name, en: D.en, tag: `${g[0].length} x ${g.length}`, desc: D.desc, ...encode(g), by: 'claude', base: null, created: now, log: [] }); });
  builtins().forEach((B) => { const g = remaster(B.grid);
    out.push({ key: B.key + '_rm', name: B.name, en: B.en, tag: `${g[0].length} x ${g.length} · 명암 판`, desc: B.name + '에 5단 명암을 입힌 판 (학생앱에는 이름만 보인다)', ...encode(g), by: 'claude', base: B.key, created: now, log: [] }); });
  out.forEach((b) => { b.bg = BG.bgOfBoss(b.base || b.key); });   // 보스마다 기본 배경
  return out;
}
function pick(B) { return { key: B.key, name: B.name, en: B.en, tag: B.tag || '', desc: B.desc || '' }; }

/* 지난 시즌 사용 기록 (2학기 중간, 세 마리 모두 격파) */
const PAST = {
  golem: { seasonId: 'S20260824', raid: '옥길중 중1 레이드', from: '2026-09-02', to: '2026-09-30', hp: 45000, cleared: true },
  slime: { seasonId: 'S20260824', raid: '초6 레이드', from: '2026-09-02', to: '2026-09-30', hp: 24000, cleared: true },
  lich: { seasonId: 'S20260824', raid: '중2·중3 레이드', from: '2026-09-02', to: '2026-09-30', hp: 22000, cleared: true },
};

module.exports = { encode, decode, ramp, shade, fromMap, remaster, buildLib, DESIGNS, CH };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  (async () => {
    const bosses = buildLib();
    bosses.forEach((b) => { if (PAST[b.key]) b.log = [PAST[b.key]]; });
    if (arg('json')) { fs.writeFileSync(arg('json'), JSON.stringify({ v: 1, bosses, bgs: BG.buildBgs(encode) }, null, 1)); console.log(`보스 ${bosses.length}종 → ${arg('json')}`); return; }
    if (!args.includes('--seed')) { console.log('--json <파일> 또는 --seed [--dry]'); return; }
    const U = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), K = process.env.SUPABASE_SERVICE_KEY || '';
    if (!U || !K) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다');
    const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
    const r = await fetch(`${U}/rest/v1/lumen_store?key=eq.raid_boss_lib&select=value`, { headers: H });
    let cur = ((await r.json())[0] || {}).value || null; if (typeof cur === 'string') cur = JSON.parse(cur);
    const old = (cur && Array.isArray(cur.bosses)) ? cur.bosses : [];
    const mine = new Set(bosses.map((b) => b.key));
    /* 원장이 만든 것·Claude 목록에 없는 것은 그대로 두고, 같은 key 의 사용 기록(log)은 이어 붙인다 */
    bosses.forEach((b) => { const o = old.find((x) => x.key === b.key); if (o) { b.log = (o.log && o.log.length) ? o.log : b.log; b.created = o.created || b.created; } });
    const keep = old.filter((x) => !mine.has(x.key));
    /* 배경도 같은 방식 — Claude 배경은 새로, 원장이 만든 배경은 그대로 */
    const bgs = BG.buildBgs(encode); const bgMine = new Set(bgs.map((b) => b.key));
    const bgKeep = ((cur && Array.isArray(cur.bgs)) ? cur.bgs : []).filter((x) => x && !bgMine.has(x.key));
    bosses.forEach((b) => { const o = old.find((x) => x.key === b.key); if (o && o.bgSet && o.bg) { b.bg = o.bg; b.bgSet = true; } });  // 원장이 고른 배경은 지킨다
    const lib = Object.assign({}, cur || {}, { v: 1, updated: new Date().toISOString(), bosses: bosses.concat(keep), bgs: bgs.concat(bgKeep) });
    console.log(`보관함: 기본·Claude ${bosses.length}종 + 그대로 둔 것 ${keep.length}종 · 배경 ${lib.bgs.length}종`);
    if (args.includes('--dry')) { console.log('(미리보기 — 저장 안 함)'); return; }
    const w = await fetch(`${U}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ key: 'raid_boss_lib', value: lib, updated_at: new Date().toISOString() }]) });
    console.log('저장', w.status);
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
