#!/usr/bin/env node
/**
 * sync/shorts_build.js — 카드뉴스로 숏츠·릴스(세로 영상) 만들기
 *
 * 이미 만든 카드 PNG 를 세로 1080×1920 화면에 얹고, 천천히 움직이게 해서 MP4 로 뽑는다.
 * 글자는 **카드 생성기와 같은 방식(HTML→PNG)** 으로 얹는다. ffmpeg 으로 글자를 그리면 한글이 깨진다.
 *
 *   node sync/shorts_build.js blog/<폴더>              shorts.json 대로 영상 만들기
 *   node sync/shorts_build.js blog/<폴더> --still      움직임 없이 장면 그림만 (빨리 확인용)
 *   node sync/shorts_build.js blog/<폴더> --music bgm.mp3
 *
 * 글 폴더에 **shorts.json** 이 있어야 한다.
 *   { "scenes": [ { "card": "01_표지.png", "caption": "51점이 79점이 됐습니다", "sec": 2.5 }, … ] }
 *
 * 🎵 배경음악은 **저작권 없는 것**만 쓴다. 파일을 글 폴더에 두고 --music 으로 알려준다.
 * 🧰 ffmpeg 이 있어야 한다 (맥: brew install ffmpeg).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = path.join(__dirname, '_fonts');
const args = process.argv.slice(2);
const folder = args.find(a => !a.startsWith('--'));
const opt = {
  still: args.includes('--still'),
  music: args.includes('--music') ? args[args.indexOf('--music') + 1] : null,
  fade: 0.4,   // 장면이 겹치며 바뀌는 시간(초)
  fps: 30,
};
if (!folder) { console.error('사용법: node sync/shorts_build.js blog/<폴더>'); process.exit(1); }
const dir = path.resolve(ROOT, folder);
const outDir = path.join(dir, 'shorts');
fs.mkdirSync(outDir, { recursive: true });

const spec = JSON.parse(fs.readFileSync(path.join(dir, 'shorts.json'), 'utf8'));
const scenes = spec.scenes || [];
if (!scenes.length) { console.error('shorts.json 에 scenes 가 없습니다'); process.exit(1); }

// 브랜드 색 (docs/lumen_blog_profile.md)
const C = { bg: '#140f0f', red: '#c03f3f', yellow: '#fdc108', ink: '#ffffff', dim: 'rgba(255,255,255,.62)' };

function fontCss() {
  const map = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
  return Object.entries(map).map(([w, n]) =>
    `@font-face{font-family:'Pretendard';font-weight:${n};font-display:block;` +
    `src:url('file://${path.join(FONT_DIR, `Pretendard-${w}.woff2`)}') format('woff2')}`).join('\n');
}

function sceneHtml(sc, i, total) {
  const card = path.join(dir, 'cards', sc.card);
  if (!fs.existsSync(card)) throw new Error(`카드가 없습니다: ${sc.card}`);
  const cap = (sc.caption || '').replace(/\n/g, '<br>');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:${C.bg};font-family:'Pretendard',sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
.glow{position:absolute;top:-220px;left:50%;transform:translateX(-50%);width:1300px;height:900px;
  background:radial-gradient(ellipse at center, rgba(253,193,8,.16), transparent 62%)}
.card{width:1000px;border-radius:36px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.6);
  border:2px solid rgba(255,255,255,.08);margin-top:40px}
.card img{display:block;width:100%}
.cap{margin-top:62px;width:940px;text-align:center;font-weight:800;font-size:${cap.length > 22 ? 62 : 74}px;
  line-height:1.3;color:${C.ink};letter-spacing:-.02em;text-shadow:0 6px 24px rgba(0,0,0,.5)}
.bar{position:absolute;bottom:150px;left:90px;right:90px;height:6px;background:rgba(255,255,255,.14);border-radius:3px}
.bar i{display:block;height:100%;width:${Math.round(((i + 1) / total) * 100)}%;background:${C.yellow};border-radius:3px}
.foot{position:absolute;bottom:72px;left:0;right:0;text-align:center;font-weight:600;font-size:32px;color:${C.dim}}
</style></head><body>
<div class="glow"></div>
<div class="card"><img src="file://${card}"></div>
<div class="cap">${cap}</div>
<div class="bar"><i></i></div>
<div class="foot">루멘수학 · 부천 옥길동</div>
</body></html>`;
}

(async () => {
  // ── ① 장면 그림 만들기 (HTML → PNG) ──
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const pngs = [];
  for (let i = 0; i < scenes.length; i++) {
    const htmlFile = path.join(outDir, `scene_${String(i + 1).padStart(2, '0')}.html`);
    fs.writeFileSync(htmlFile, sceneHtml(scenes[i], i, scenes.length));
    await page.goto('file://' + htmlFile);
    await page.waitForTimeout(350);
    const png = path.join(outDir, `scene_${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: png });
    pngs.push(png);
    console.log(`✅ 장면 ${i + 1} — ${scenes[i].card}  「${(scenes[i].caption || '').slice(0, 20)}」`);
  }
  await browser.close();
  if (opt.still) { console.log(`\n장면 그림만 만들었습니다 → ${outDir}\n`); return; }

  // ── ② ffmpeg 으로 움직이게 + 이어 붙이기 ──
  const fps = opt.fps, fade = opt.fade;
  const secs = scenes.map(s => Number(s.sec) || 2.5);
  const inputs = [];
  pngs.forEach((p, i) => inputs.push('-loop', '1', '-t', String(secs[i]), '-i', p));

  // 천천히 커지는 효과(켄 번스). 흔들림을 막으려고 크게 키운 뒤 줄인다.
  const parts = pngs.map((_, i) => {
    const frames = Math.round(secs[i] * fps);
    return `[${i}:v]scale=2160:3840,zoompan=z='min(zoom+0.0009,1.10)':d=${frames}` +
           `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${fps},setsar=1[v${i}]`;
  });
  let last = 'v0', off = 0;
  for (let i = 1; i < pngs.length; i++) {
    off += secs[i - 1] - fade;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${off.toFixed(2)}[x${i}]`);
    last = `x${i}`;
  }
  const total = secs.reduce((a, b) => a + b, 0) - fade * (pngs.length - 1);

  const music = opt.music || spec.music;
  const musicPath = music ? path.join(dir, music) : null;
  const hasMusic = musicPath && fs.existsSync(musicPath);
  if (music && !hasMusic) console.log(`⚠️  배경음악 ${music} 을 못 찾았습니다 — 소리 없이 만듭니다.`);

  const out = path.join(outDir, (spec.out || 'shorts') + '.mp4');
  const cmd = [...inputs];
  if (hasMusic) cmd.push('-i', musicPath);
  cmd.push('-filter_complex', parts.join(';'), '-map', `[${last}]`);
  if (hasMusic) cmd.push('-map', `${pngs.length}:a`, '-af', `afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`, '-shortest');
  cmd.push('-t', total.toFixed(2), '-r', String(fps),
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-movflags', '+faststart', '-y', out);

  console.log(`\n🎬 영상 만드는 중… ${total.toFixed(1)}초 · 장면 ${pngs.length}개${hasMusic ? ' · 음악 있음' : ' · 소리 없음'}`);
  execFileSync('ffmpeg', cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`\n✅ ${path.relative(ROOT, out)}  (${mb}MB · ${total.toFixed(1)}초 · 1080×1920)\n`);
})();
