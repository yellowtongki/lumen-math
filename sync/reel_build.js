#!/usr/bin/env node
/**
 * sync/reel_build.js — 영상 전용 숏츠·릴스 만들기 (1080×1920)
 *
 * 카드뉴스를 가져다 쓰는 것이 아니라 **영상용 화면을 따로 그린다.**
 * 1초에 30장씩 화면을 계산해서 찍고 이어 붙이므로 숫자가 올라가고 글자가 차례로 나타난다.
 *
 *   node sync/reel_build.js blog/<폴더>            reel.json 대로 영상 만들기
 *   node sync/reel_build.js blog/<폴더> --peek 3.2 그 시각의 화면 한 장만 (빨리 확인용)
 *   node sync/reel_build.js blog/<폴더> --music bgm.mp3
 *
 * 글 폴더에 **reel.json** 이 있어야 한다. 장면 종류:
 *   hook     큰 숫자가 올라간다 (51 → 79)
 *   timeline 날짜 두 개 + 막대가 차오르고 큰 숫자
 *   lines    글줄이 한 줄씩 나타난다 (*낱말* 로 감싸면 금색 밑줄이 그어진다)
 *   count    0부터 세어 올라가고 아래에 항목이 차례로
 *   formula  수식이 왼쪽부터 써진다 (수학학원용)
 *   close    51 → 79 + 로고
 *
 * 🧰 ffmpeg 이 있어야 한다 (맥: brew install ffmpeg).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = path.join(__dirname, '_fonts');
const MATHJAX = path.join(__dirname, '_vendor', 'tex-svg.js');
const LOGO = path.join(ROOT, 'assets', 'logo.png');

const args = process.argv.slice(2);
const folder = args.find(a => !a.startsWith('--') && a.includes('/'));
const opt = {
  peek: args.includes('--peek') ? Number(args[args.indexOf('--peek') + 1] || 0) : null,
  music: args.includes('--music') ? args[args.indexOf('--music') + 1] : null,
  fps: 30,
};
if (!folder) { console.error('사용법: node sync/reel_build.js blog/<폴더>'); process.exit(1); }
const dir = path.resolve(ROOT, folder);
const outDir = path.join(dir, 'reel');
const frameDir = path.join(outDir, 'frames');
fs.rmSync(frameDir, { recursive: true, force: true });
fs.mkdirSync(frameDir, { recursive: true });

const reel = JSON.parse(fs.readFileSync(path.join(dir, 'reel.json'), 'utf8'));
reel.fps = opt.fps;

function fontCss() {
  const map = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
  return Object.entries(map).map(([w, n]) =>
    `@font-face{font-family:'Pretendard';font-weight:${n};font-display:block;` +
    `src:url('file://${path.join(FONT_DIR, `Pretendard-${w}.woff2`)}') format('woff2')}`).join('\n');
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

  // 수식 장면이 있으면 MathJax 로 SVG 를 먼저 만들어 둔다 (영상에서는 글자가 아니라 그림이어야 한다)
  const needTex = (reel.scenes || []).some(s => s.type === 'formula');
  if (needTex) {
    if (!fs.existsSync(MATHJAX)) throw new Error('sync/_vendor/tex-svg.js 가 없습니다 (수식 장면에 필요)');
    const tmp = path.join(outDir, '_tex.html');
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><script src="file://${MATHJAX}"><\/script><div id=o></div>`);
    await page.goto('file://' + tmp);
    await page.waitForFunction(() => window.MathJax && window.MathJax.tex2svg, null, { timeout: 20000 });
    for (const s of reel.scenes) {
      if (s.type !== 'formula') continue;
      s._svg = await page.evaluate(t => {
        const n = window.MathJax.tex2svg(t, { display: true });
        const svg = n.querySelector('svg');
        svg.setAttribute('width', '860'); svg.removeAttribute('height');
        svg.querySelectorAll('[fill="currentColor"],path,use').forEach(e => e.setAttribute('fill', '#fff7df'));
        return svg.outerHTML;
      }, s.tex);
    }
  }

  const stage = fs.readFileSync(path.join(__dirname, 'reel_stage.html'), 'utf8')
    .replace('/*FONTS*/', fontCss())
    .replace('"/*MATHJAX*/"', JSON.stringify('file://' + MATHJAX))
    .replace('/*REEL*/', JSON.stringify(reel))
    .replace('/*LOGO*/', 'file://' + LOGO);
  const stageFile = path.join(outDir, '_stage.html');
  fs.writeFileSync(stageFile, stage);

  await page.goto('file://' + stageFile);
  await page.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const total = await page.evaluate(() => window.__render && (window.__render(0), R.total));

  if (opt.peek !== null) {
    await page.evaluate(t => window.__render(t), opt.peek);
    await page.waitForTimeout(120);
    const f = path.join(outDir, `peek_${opt.peek}.png`);
    await page.screenshot({ path: f });
    console.log(`\n👀 ${path.relative(ROOT, f)}  (${opt.peek}초 · 전체 ${total.toFixed(1)}초)\n`);
    await browser.close(); return;
  }

  // ── 한 장씩 찍기 ──
  const n = Math.round(total * opt.fps);
  console.log(`\n🎞  ${total.toFixed(1)}초 · ${n}장 그리는 중…`);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.__render(t), i / opt.fps);
    await page.screenshot({ path: path.join(frameDir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (i % 60 === 0) process.stdout.write(`   ${Math.round(i / n * 100)}%\r`);
  }
  await browser.close();
  console.log('   100%');

  // ── 이어 붙이기 ──
  const music = opt.music || reel.music;
  const musicPath = music ? path.join(dir, music) : null;
  const hasMusic = musicPath && fs.existsSync(musicPath);
  if (music && !hasMusic) console.log(`⚠️  배경음악 ${music} 을 못 찾았습니다 — 소리 없이 만듭니다.`);

  const out = path.join(outDir, (reel.out || 'reel') + '.mp4');
  const cmd = ['-framerate', String(opt.fps), '-i', path.join(frameDir, 'f%05d.jpg')];
  if (hasMusic) cmd.push('-i', musicPath);
  cmd.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(opt.fps));
  if (hasMusic) cmd.push('-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${(total - 1.3).toFixed(2)}:d=1.3`, '-shortest');
  cmd.push('-movflags', '+faststart', '-y', out);
  execFileSync('ffmpeg', cmd, { stdio: ['ignore', 'ignore', 'pipe'] });

  fs.rmSync(frameDir, { recursive: true, force: true });   // 중간 그림은 지운다 (수백 장이라 무겁다)
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`\n✅ ${path.relative(ROOT, out)}  (${mb}MB · ${total.toFixed(1)}초 · 1080×1920 · ${hasMusic ? '음악 있음' : '소리 없음'})\n`);
})();
