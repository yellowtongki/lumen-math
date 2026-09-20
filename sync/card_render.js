#!/usr/bin/env node
/**
 * sync/card_render.js — 카드 생성기 (3단계)
 *
 * 글 폴더의 cards.json 을 읽어 카드 PNG(1080×1350)를 만든다. HTML로 그려 Playwright로 찍는다.
 * (AI 그림이 아니라서 한글이 안 깨진다. 블로그 카드와 인스타 캐러셀을 같은 파일로 쓴다)
 *
 *   node sync/card_render.js blog/2026-09-20-banten          # → blog/2026-09-20-banten/cards/01_cover.png …
 *   node sync/card_render.js blog/2026-09-20-banten --only 3 # 3번 카드만 다시
 *
 * cards.json 형식:
 *   { "cards": [ { "type": "cover", "kicker": "...", "title": "...", "sub": "..." }, … ] }
 *   type: cover | qa | stat | compare | list | closing   (템플릿은 sync/card_templates/<type>.html)
 *
 * 글자가 칸을 넘치면 .fit 요소의 글자 크기를 조금씩 줄여서 맞춘다 (로그에 "글자 줄임" 표시).
 * 폰트(Pretendard)는 sync/_fonts/ 에 없으면 GitHub에서 자동으로 받는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TPL_DIR = path.join(__dirname, 'card_templates');
const FONT_DIR = path.join(__dirname, '_fonts');
const FONT_WEIGHTS = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
const FONT_URL = (w) => `https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-${w}.woff2`;
const W = 1080, H = 1350;

const args = process.argv.slice(2);
const folder = args.find(a => !a.startsWith('--'));
const onlyIdx = args.includes('--only') ? parseInt(args[args.indexOf('--only') + 1], 10) : null;
if (!folder) { console.error('사용법: node sync/card_render.js <글 폴더> [--only N]'); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

async function ensureFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  for (const w of Object.keys(FONT_WEIGHTS)) {
    const f = path.join(FONT_DIR, `Pretendard-${w}.woff2`);
    if (fs.existsSync(f) && fs.statSync(f).size > 100000) continue;
    process.stderr.write(`⬇️  폰트 내려받는 중: Pretendard-${w}… `);
    const r = await fetch(FONT_URL(w));
    if (!r.ok) throw new Error(`폰트 다운로드 실패 ${r.status} — sync/_fonts/ 에 Pretendard-${w}.woff2 를 직접 넣어주세요`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    process.stderr.write('완료\n');
  }
}
function fontCss() {
  return Object.entries(FONT_WEIGHTS).map(([w, n]) =>
    `@font-face{font-family:'Pretendard';font-weight:${n};font-display:block;src:url('file://${path.join(FONT_DIR, `Pretendard-${w}.woff2`)}') format('woff2')}`).join('\n');
}

// 배열 필드를 HTML 조각으로 (템플릿의 {{{…Html}}} 자리)
function derive(card) {
  const d = { ...card };
  const li = (arr) => (arr || []).map(t => `<li style="display:flex;gap:14px;margin-bottom:14px"><span style="color:var(--gold);font-weight:800">—</span><span>${esc(t)}</span></li>`).join('');
  if (card.type === 'compare') { d.leftItemsHtml = li(card.leftItems); d.rightItemsHtml = li(card.rightItems); }
  if (card.type === 'list') {
    d.itemsHtml = (card.items || []).map((it, i) => {
      const h = typeof it === 'string' ? it : it.h, desc = typeof it === 'string' ? '' : (it.d || '');
      return `<div style="display:flex;gap:26px;align-items:flex-start">
        <div style="font-size:52px;font-weight:800;color:var(--blue);line-height:1.2;flex:none">${CIRCLED[i] || (i + 1)}</div>
        <div><div style="font-size:44px;font-weight:800;line-height:1.3">${esc(h)}</div>${desc ? `<div style="font-size:33px;color:var(--muted);margin-top:10px;line-height:1.45">${esc(desc)}</div>` : ''}</div></div>`;
    }).join('');
  }
  return d;
}
function fill(tpl, data) {
  return tpl
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => String(data[k] ?? ''))
    .replace(/\{\{(\w+)\}\}/g, (_, k) => esc(data[k] ?? '').replace(/\n/g, '<br>'));
}

(async () => {
  const dir = path.resolve(ROOT, folder);
  const spec = JSON.parse(fs.readFileSync(path.join(dir, 'cards.json'), 'utf8'));
  const cards = spec.cards || [];
  if (!cards.length) throw new Error('cards.json 에 cards 배열이 없습니다');
  await ensureFonts();
  const outDir = path.join(dir, 'cards'), htmlDir = path.join(outDir, 'html');
  fs.mkdirSync(htmlDir, { recursive: true });
  const base = fs.readFileSync(path.join(TPL_DIR, '_base.css'), 'utf8');

  // 크롬 위치: 환경변수 CHROMIUM_PATH > 클라우드 기본 경로(/opt/pw-browsers/chromium) > Playwright 기본
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const made = [];
  for (let i = 0; i < cards.length; i++) {
    const n = i + 1;
    if (onlyIdx && onlyIdx !== n) continue;
    const card = cards[i];
    const tplPath = path.join(TPL_DIR, `${card.type}.html`);
    if (!fs.existsSync(tplPath)) throw new Error(`${n}번 카드: 모르는 type "${card.type}" (템플릿 없음)`);
    const body = fill(fs.readFileSync(tplPath, 'utf8'), derive({ ...card, page: `${n} / ${cards.length}` }));
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${fontCss()}\n${base}</style></head><body>${body}</body></html>`;
    const htmlFile = path.join(htmlDir, `${String(n).padStart(2, '0')}_${card.type}.html`);
    fs.writeFileSync(htmlFile, html, 'utf8');
    await page.goto('file://' + htmlFile);
    await page.evaluate(() => document.fonts.ready);
    // 넘치는 글자 줄이기: .fit 요소마다 scrollHeight가 칸(max-height/높이) 안에 들어올 때까지 2px씩
    const shrunk = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.fit')) {
        const limit = parseFloat(getComputedStyle(el).maxHeight) || el.clientHeight;
        let size = parseFloat(getComputedStyle(el).fontSize), steps = 0;
        while (el.scrollHeight > limit + 1 && size > 18 && steps < 60) { size -= 2; el.style.fontSize = size + 'px'; steps++; }
        if (steps) out.push(`${el.tagName.toLowerCase()} → ${size}px`);
      }
      return out;
    });
    const png = path.join(outDir, `${String(n).padStart(2, '0')}_${card.type}.png`);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: W, height: H } });
    made.push(png);
    console.log(`✅ ${path.relative(ROOT, png)}${shrunk.length ? `   (글자 줄임: ${shrunk.join(', ')})` : ''}`);
  }
  await browser.close();
  console.log(`\n${made.length}장 완료 → ${path.relative(ROOT, outDir)}/`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
