/* ═══════════════════════════════════════════════════════════════════
 * 🏞 보스 배경 (raid_boss_lib.bgs) — 원장 2026-10-18 「보스 배경도 만들어줘」
 * ═══════════════════════════════════════════════════════════════════
 * 128 × 72 도트. 학생앱 레이드 카드 무대(가로 약 384px)에 3배로 깔린다.
 * 아래 14줄은 보스가 서는 «바닥»이다. 보스 그림과 같은 방식(팔레트 + 글자)으로 보관함에 들어간다.
 * 그리는 법: 하늘은 4×4 바이어 점묘로 색을 섞고, 산·성·나무는 높이 곡선으로 실루엣을 만든다.
 * 같은 씨앗(seed)이면 늘 같은 그림이 나온다.
 */
const W = 128, H = 72, FLOOR = 58;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function canvas() { const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill(null)); return g; }
function P(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; }
function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(g, x + i, y + j, c); }
/* 위→아래 색 띠를 점묘로 섞는다 */
function grad(g, y0, y1, cols) {
  const n = cols.length - 1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n;
    const k = Math.min(n - 1, Math.floor(t)), f = t - k;
    P(g, x, y, f * 16 > BAYER[y & 3][x & 3] + 0.5 ? cols[k + 1] : cols[k]);
  }
}
/* 높이 곡선 실루엣 (부드러운 잡음) */
function ridge(g, base, amp, freq, col, seed, jag) {
  const r = rng(seed); const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  for (let x = 0; x < W; x++) {
    let h = Math.sin(x * freq + ph[0]) * 0.6 + Math.sin(x * freq * 2.3 + ph[1]) * 0.3 + Math.sin(x * freq * 5.1 + ph[2]) * 0.1;
    if (jag) h += (r() - 0.5) * jag;
    const top = Math.round(base - h * amp);
    for (let y = top; y < FLOOR; y++) P(g, x, y, col);
  }
}
function circle(g, cx, cy, rad, c, ring) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = x * x + y * y;
    if (d <= rad * rad && (!ring || d >= (rad - 1) * (rad - 1))) P(g, cx + x, cy + y, c);
  }
}
function stars(g, n, cols, y1, seed) { const r = rng(seed); for (let i = 0; i < n; i++) P(g, r() * W, r() * y1, cols[Math.floor(r() * cols.length)]); }
/* 바닥: 윗줄 밝은 띠 + 아래로 어두워지는 돌·흙 무늬 */
function floor(g, cols, seed, spec) {
  const r = rng(seed);
  grad(g, FLOOR, H, [cols[1], cols[2], cols[3]]);
  for (let x = 0; x < W; x++) P(g, x, FLOOR, cols[0]);
  for (let i = 0; i < 70; i++) { const x = r() * W, y = FLOOR + 2 + r() * (H - FLOOR - 2); P(g, x, y, r() < 0.5 ? cols[1] : cols[3]); if (spec && r() < 0.3) P(g, x + 1, y, spec); }
}
function tree(g, x, base, h, col) {   // 전나무 실루엣
  for (let j = 0; j < h; j++) { const w = Math.round((j / h) * (h * 0.38)) + 1; rect(g, x - w, base - h + j, w * 2 + 1, 1, col); }
  rect(g, x, base, 1, 3, col);
}

const BGS = [
  { key: 'volcano', name: '화산', desc: '용암이 흐르는 붉은 하늘', draw(g) {
    grad(g, 0, 40, ['#1a0710', '#3a0d18', '#6e1a1c', '#b8401e']);
    grad(g, 40, FLOOR, ['#b8401e', '#e8722a']);
    stars(g, 40, ['#ffb35c', '#ff7a3a'], 50, 7);                               // 불티
    ridge(g, 44, 9, 0.05, '#2a0c14', 11);
    for (let x = 52; x < 78; x++) { const top = 22 + Math.abs(x - 65) * 1.4; for (let y = Math.round(top); y < FLOOR; y++) P(g, x, y, '#3a1018'); }
    rect(g, 62, 20, 6, 2, '#ff9b3a'); rect(g, 63, 22, 1, 10, '#ff6a2a'); rect(g, 66, 22, 1, 14, '#ff6a2a');   // 분화구 용암
    ridge(g, 52, 4, 0.11, '#1c0810', 23, 2);
    floor(g, ['#ff8a3a', '#5a1a14', '#3a0f10', '#220709'], 31, '#ff6a2a');
    for (let x = 0; x < W; x++) { const y = 64 + Math.round(Math.sin(x * 0.16) * 1.5); P(g, x, y, '#ff6a2a'); P(g, x, y + 1, '#ffb347'); }
  } },
  { key: 'castle', name: '어둠의 성', desc: '달빛 아래 검은 성', draw(g) {
    grad(g, 0, FLOOR, ['#0b0a1f', '#1a1640', '#33295e', '#4a3a72']);
    stars(g, 70, ['#ffffff', '#c9c3ff', '#8a84d8'], 40, 3);
    circle(g, 100, 14, 8, '#f6f0d2'); circle(g, 103, 12, 6, '#1a1640');        // 초승달
    ridge(g, 50, 3, 0.07, '#1d1838', 5);
    const C = '#120f26', L = '#ffcf5a';
    rect(g, 20, 22, 88, 36, C);
    [[16, 12, 14], [44, 16, 10], [74, 16, 10], [98, 12, 14]].forEach(([x, y, w]) => {
      rect(g, x, y, w, FLOOR - y, C); for (let i = 0; i < w; i += 3) rect(g, x + i, y - 2, 2, 2, C);
      rect(g, x + Math.floor(w / 2) - 1, y + 6, 2, 3, L); });
    for (let i = 0; i < 88; i += 4) rect(g, 20 + i, 20, 2, 2, C);
    rect(g, 56, 38, 16, 20, '#0a0818'); circle(g, 63.5, 38, 8, '#0a0818');       // 문
    [[30, 30], [92, 30], [36, 42], [86, 42]].forEach(([x, y]) => rect(g, x, y, 2, 3, L));
    floor(g, ['#5a5478', '#2e2a48', '#211d38', '#151229'], 17);
    for (let x = 0; x < W; x += 8) for (let y = FLOOR + 3; y < H; y += 4) rect(g, x + ((y >> 2) & 1) * 4, y, 1, 1, '#3c3760');
  } },
  { key: 'sea', name: '바다 밑', desc: '빛줄기가 내려오는 깊은 바다', draw(g) {
    grad(g, 0, FLOOR, ['#2a8fc4', '#1a6a9e', '#104878', '#0a2a52']);
    const r = rng(9);
    for (let k = 0; k < 5; k++) { const x0 = 10 + k * 26; for (let y = 0; y < 50; y++) if (((y + k) & 1) === 0) P(g, x0 + y * 0.35, y, '#5cc0e8'); }
    for (let i = 0; i < 26; i++) { const x = r() * W, y = 6 + r() * 46; circle(g, x, y, r() < 0.3 ? 2 : 1, '#9fe3ff', true); }
    for (let k = 0; k < 9; k++) { const x = 4 + k * 15 + Math.floor(r() * 6), h = 10 + Math.floor(r() * 16);
      for (let y = 0; y < h; y++) P(g, x + Math.round(Math.sin(y * 0.5 + k) * 1.5), FLOOR - y, k % 2 ? '#2f8f5a' : '#1f6e48'); }
    floor(g, ['#f0d9a0', '#c9a76a', '#a8854e', '#7a5f38'], 13, '#fff1c8');
    [[18, 62], [70, 66], [110, 61]].forEach(([x, y]) => { rect(g, x, y, 3, 2, '#e88a7a'); P(g, x + 1, y - 1, '#ffb3a3'); });
  } },
  { key: 'forest', name: '밤 숲', desc: '반딧불이 나는 전나무 숲', draw(g) {
    grad(g, 0, FLOOR, ['#0a1a2a', '#123048', '#1c4a5a', '#2a6a64']);
    stars(g, 60, ['#ffffff', '#cfe8ff'], 30, 21);
    circle(g, 24, 13, 6, '#fff6d8');
    const r = rng(4);
    for (let i = 0; i < 16; i++) tree(g, 4 + i * 8 + Math.floor(r() * 4), 50, 16 + Math.floor(r() * 8), '#163a3a');
    for (let i = 0; i < 10; i++) tree(g, 2 + i * 13 + Math.floor(r() * 5), 56, 22 + Math.floor(r() * 10), '#0c2626');
    for (let i = 0; i < 22; i++) { const x = r() * W, y = 24 + r() * 30; P(g, x, y, '#e8ff7a'); if (r() < 0.4) P(g, x + 1, y, '#a8d84a'); }
    floor(g, ['#5aa860', '#2e6a3a', '#1f4e2c', '#13341e'], 8, '#7fd07a');
    for (let x = 0; x < W; x += 3) P(g, x + (x % 2), FLOOR - 1, '#3e8a4a');
  } },
  { key: 'cave', name: '수정 동굴', desc: '빛나는 수정이 박힌 동굴', draw(g) {
    grad(g, 0, FLOOR, ['#0e0c18', '#1a1628', '#241e36', '#2e2642']);
    const r = rng(15);
    for (let x = 0; x < W; x++) { const h = 6 + Math.round(Math.sin(x * 0.2) * 3 + r() * 3); for (let y = 0; y < h; y++) P(g, x, y, '#0a0912'); }
    for (let k = 0; k < 9; k++) { const x = 6 + k * 14 + Math.floor(r() * 5), h = 4 + Math.floor(r() * 7);
      for (let j = 0; j < h; j++) rect(g, x - Math.max(0, Math.floor((h - j) / 3)), 6 + j, 1 + 2 * Math.max(0, Math.floor((h - j) / 3)), 1, '#0a0912'); }
    ridge(g, 46, 6, 0.09, '#191526', 19, 2);
    const CR = [['#5ce1e6', '#b8f6ff'], ['#c07cff', '#ecd2ff'], ['#4ad87a', '#c2ffd6']];
    [[14, 52, 0], [30, 50, 1], [96, 51, 2], [112, 53, 0], [80, 55, 1]].forEach(([x, y, c]) => {
      const [a, b] = CR[c]; for (let j = 0; j < 8; j++) rect(g, x - Math.floor(j / 3), y - 8 + j, 1 + 2 * Math.floor(j / 3), 1, a);
      rect(g, x - 1, y - 6, 1, 3, b); P(g, x + 3, y - 10, b); P(g, x - 4, y - 9, b); });
    floor(g, ['#4a4262', '#2a243c', '#1e1a2e', '#131020'], 27, '#5ce1e6');
  } },
  { key: 'grave', name: '해골 무덤', desc: '안개 낀 묘지와 마른 나무', draw(g) {
    grad(g, 0, FLOOR, ['#0c1410', '#16261c', '#24402c', '#3a5e3e']);
    circle(g, 96, 16, 9, '#d8f0c0'); circle(g, 96, 16, 9, '#b8d8a0', true);
    stars(g, 30, ['#cfe8c0'], 30, 41);
    const T = '#0d1a12';
    rect(g, 22, 22, 2, 36, T); [[23, 28, -1], [23, 34, 1], [23, 26, 1]].forEach(([x, y, d]) => { for (let i = 0; i < 8; i++) P(g, x + d * i, y - Math.floor(i / 2), T); });
    rect(g, 108, 30, 2, 28, T); for (let i = 0; i < 6; i++) { P(g, 108 - i, 36 - Math.floor(i / 2), T); P(g, 110 + i, 40 - Math.floor(i / 2), T); }
    [[38, 46], [58, 48], [76, 45], [90, 49]].forEach(([x, y]) => { rect(g, x, y, 8, FLOOR - y, '#5a6a62'); rect(g, x + 1, y - 2, 6, 2, '#5a6a62'); rect(g, x + 3, y + 2, 2, 5, '#3a4842'); rect(g, x + 1, y + 4, 6, 1, '#3a4842'); });
    const r = rng(5); for (let i = 0; i < 160; i++) { const x = r() * W, y = 48 + r() * 10; if (((x | 0) + (y | 0)) & 1) P(g, x, y, '#8fb89a'); }
    floor(g, ['#6a8a5a', '#3a5236', '#283a28', '#18261a'], 33);
  } },
  { key: 'classroom', name: '시험장', desc: '수식이 가득한 칠판 교실', draw(g) {
    grad(g, 0, FLOOR, ['#3a2e28', '#4a3a30']);
    rect(g, 10, 6, 108, 40, '#5a3a22'); rect(g, 12, 8, 104, 36, '#1f4a3a'); grad(g, 9, 43, ['#24543f', '#1c4434']);
    const W_ = '#e8f0e0', Y = '#ffe27a';
    const glyph = { '2': ['111', '001', '111', '100', '111'], 'x': ['000', '101', '010', '101', '000'], '+': ['000', '010', '111', '010', '000'], '=': ['000', '111', '000', '111', '000'],
      '3': ['111', '001', '111', '001', '111'], '5': ['111', '100', '111', '001', '111'], 'y': ['101', '101', '011', '001', '110'], '/': ['001', '001', '010', '100', '100'], '1': ['010', '110', '010', '010', '111'] };
    const write = (s, x, y, c) => { s.split('').forEach((ch, i) => { const gl = glyph[ch]; if (!gl) return; gl.forEach((row, j) => row.split('').forEach((b, k) => { if (b === '1') P(g, x + i * 4 + k, y + j, c); })); }); };
    write('2x+3=5', 18, 12, W_); write('y=x2+1', 18, 20, W_); write('1/2+1/3', 18, 30, Y);
    write('x=1', 80, 14, Y); circle(g, 88, 34, 6, W_, true); rect(g, 82, 34, 13, 1, W_); rect(g, 88, 28, 1, 13, W_);
    rect(g, 10, 46, 108, 2, '#7a5236'); rect(g, 30, 45, 6, 1, '#ffffff'); rect(g, 40, 45, 4, 1, '#ffd0e0');
    floor(g, ['#c9905a', '#9a6a3e', '#7a5230', '#5a3a22'], 3);
    for (let x = 0; x < W; x += 16) rect(g, x, FLOOR + 1, 1, H - FLOOR - 1, '#6a4428');
  } },
  { key: 'sky', name: '노을 구름', desc: '불타는 노을 속 구름 위', draw(g) {
    grad(g, 0, FLOOR, ['#2a1650', '#7a2a6a', '#d8506a', '#ff9a5a', '#ffd27a']);
    circle(g, 64, 50, 12, '#fff0b0');
    const cloud = (x, y, w, c, hl) => { for (let i = 0; i < w; i += 4) circle(g, x + i, y - Math.round(Math.sin(i * 0.3) * 2), 4, c); rect(g, x - 2, y, w + 4, 4, c); for (let i = 0; i < w; i += 6) P(g, x + i, y - 4, hl); };
    cloud(6, 20, 30, '#b8507a', '#e88aa0'); cloud(86, 14, 34, '#b8507a', '#e88aa0'); cloud(40, 34, 24, '#e8806a', '#ffc0a0');
    floor(g, ['#ffffff', '#f0e0f0', '#d8c0e0', '#b8a0d0'], 6);
    for (let x = 0; x < W; x += 7) circle(g, x, FLOOR + 1, 3, '#ffffff');
  } },
];

/* 보스마다 기본 배경 */
const BOSS_BG = { dragon: 'volcano', oni: 'forest', lich: 'grave', golem: 'cave', paper: 'classroom', slime: 'forest',
  king_slime: 'forest', kraken: 'sea', dark_knight: 'castle', phoenix: 'sky' };

function buildBgs(encode) {
  return BGS.map((B) => { const g = canvas(); B.draw(g);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) g[y][x] = '#000000';
    return { key: B.key, name: B.name, desc: B.desc, ...encode(g), by: 'claude' }; });
}
function bgOfBoss(key) { return BOSS_BG[String(key || '').replace(/_rm$/, '')] || 'castle'; }

module.exports = { buildBgs, bgOfBoss, BOSS_BG, BG_W: W, BG_H: H, BG_FLOOR: FLOOR };
