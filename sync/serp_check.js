#!/usr/bin/env node
/**
 * sync/serp_check.js — 네이버 검색 점검기
 *
 * 검색어를 하나씩 네이버에 쳐 보고, 첫 화면에 우리 블로그 글이 있는지 센다.
 * 결과를 docs/serp_history/ 에 날짜별로 쌓고, docs/serp_latest.html 보고서를 만든다.
 *
 *   node sync/serp_check.js              # 점검 → 기록 → 보고서
 *   node sync/serp_check.js --pc         # PC 화면으로 (기본은 모바일)
 *   node sync/serp_check.js --render     # 검색은 건너뛰고 기록으로 보고서만 다시
 *   node sync/serp_check.js --demo       # 가짜 자료로 보고서 모양만 확인
 *
 * ⚠️ 맥미니(또는 집·학원 컴퓨터)에서만 돌린다. 클라우드 서버에서 돌리면
 *    데이터센터 IP로 잡혀 캡차가 뜬다. 로그인은 하지 않는다 — 검색 화면을 읽기만 한다.
 *
 * 왜 모바일이 기본인가: 학부모는 대부분 휴대폰으로 검색한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'serp_keywords.json'), 'utf8'));
const HIST_DIR = path.join(ROOT, 'docs/serp_history');
const OUT_HTML = path.join(ROOT, 'docs/serp_latest.html');
const DEBUG_DIR = path.join(__dirname, '_debug/serp');

const args = process.argv.slice(2);
const opt = {
  pc: args.includes('--pc'),
  renderOnly: args.includes('--render'),
  demo: args.includes('--demo'),
};
const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── 검색 ─────────────────────────────────────────────────────────
async function collect() {
  const { chromium } = require('playwright');
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = opt.pc
    ? await browser.newContext({ viewport: { width: 1280, height: 1600 } })
    : await browser.newContext({
        viewport: { width: 412, height: 1400 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      });
  const page = await ctx.newPage();
  fs.mkdirSync(DEBUG_DIR, { recursive: true });

  const results = [];
  for (const [i, kw] of CFG.keywords.entries()) {
    const base = opt.pc ? 'https://search.naver.com/search.naver' : 'https://m.search.naver.com/search.naver';
    const url = `${base}?query=${encodeURIComponent(kw.q)}`;
    log(`🔎 (${i + 1}/${CFG.keywords.length}) ${kw.q}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1500 + Math.random() * 1500);

      const screenH = opt.pc ? 1600 : 1400;   // "첫 화면" = 스크롤 없이 보이는 높이
      const found = await page.evaluate((h) => {
        const seen = new Set(), out = [];
        for (const a of document.querySelectorAll('a[href*="blog.naver.com"]')) {
          const m = a.href.match(/blog\.naver\.com\/([A-Za-z0-9_-]+)(?:\/(\d+))?/);
          if (!m) continue;
          const r = a.getBoundingClientRect();
          if (r.top < 0 || r.top > h || r.width < 40 || r.height < 10) continue;   // 첫 화면 밖 / 안 보이는 링크
          const key = m[1] + '/' + (m[2] || '');
          if (seen.has(key)) continue;
          const title = (a.innerText || '').trim().replace(/\s+/g, ' ');
          if (!title || title.length < 4) continue;                                // 썸네일·블로그명 링크는 건너뜀
          seen.add(key);
          out.push({ blogId: m[1], postId: m[2] || null, title: title.slice(0, 120), top: Math.round(r.top) });
        }
        return out.sort((a, b) => a.top - b.top);
      }, screenH);

      const captcha = await page.evaluate(() => /captcha|자동입력 방지|비정상적인 검색/i.test(document.body.innerText || ''));
      if (captcha) { log('⚠️  캡차가 떴습니다. 잠시 뒤 다시 돌려주세요.'); await browser.close(); process.exit(2); }

      await page.screenshot({ path: path.join(DEBUG_DIR, `${String(i + 1).padStart(2, '0')}_${kw.q.replace(/\s/g, '_')}.png`) });
      const mine = found.filter(f => f.blogId === CFG.blogId);
      results.push({ ...kw, total: found.length, mine: mine.length, posts: found });
      log(`   블로그 글 ${found.length}건 중 내 글 ${mine.length}편`);
    } catch (e) {
      log(`   ❌ ${e.message}`);
      results.push({ ...kw, error: e.message, total: 0, mine: 0, posts: [] });
    }
    await sleep(3000 + Math.random() * 3000);   // 사람처럼 쉬어 간다
  }
  await browser.close();
  return results;
}

// ── 우리 블로그에 실제로 올라가 있나 (RSS) ──────────────────────
async function checkPublished() {
  const local = [];
  const blogDir = path.join(ROOT, 'blog');
  if (fs.existsSync(blogDir)) {
    for (const d of fs.readdirSync(blogDir)) {
      const p = path.join(blogDir, d, 'post.md');
      if (!fs.existsSync(p)) continue;
      const m = fs.readFileSync(p, 'utf8').match(/^---\n([\s\S]*?)\n---/);
      const t = m && m[1].match(/^title:\s*(.+)$/m);
      if (t) local.push({ folder: d, title: t[1].trim() });
    }
  }
  if (!local.length) return null;
  try {
    const r = await fetch(`https://rss.blog.naver.com/${CFG.blogId}.xml`);
    if (!r.ok) throw new Error('RSS ' + r.status);
    const xml = await r.text();
    const live = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map(m => m[1].trim());
    const norm = (s) => s.replace(/[\s·—\-–"'"']/g, '').toLowerCase();
    return local.map(p => ({ ...p, published: live.some(l => norm(l).includes(norm(p.title).slice(0, 25))) }));
  } catch (e) {
    log(`   (RSS 확인 실패: ${e.message} — 이 부분은 건너뜁니다)`);
    return local.map(p => ({ ...p, published: null }));
  }
}

// ── 보고서 ───────────────────────────────────────────────────────
function render(run, history) {
  const hit = run.results.filter(r => r.mine > 0).length;
  const n = run.results.length;
  const totalMine = run.results.reduce((s, r) => s + r.mine, 0);
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const prevHit = prev ? prev.results.filter(r => r.mine > 0).length : null;
  const delta = prevHit === null ? null : hit - prevHit;

  // 남의 글 중 자주 보이는 블로그 = 이 동네에서 이기고 있는 곳
  const rivals = new Map();
  for (const r of run.results) for (const p of r.posts) {
    if (p.blogId === CFG.blogId) continue;
    const v = rivals.get(p.blogId) || { n: 0, titles: [] };
    v.n++; if (v.titles.length < 3) v.titles.push(p.title);
    rivals.set(p.blogId, v);
  }
  const top = [...rivals.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);

  const strip = (r) => {
    if (r.error) return `<div class="err">확인 실패 — ${esc(r.error)}</div>`;
    if (!r.total) return `<div class="err">첫 화면에 블로그 글이 없습니다 (다른 유형이 채우고 있음)</div>`;
    return `<div class="blocks">` + r.posts.map((p, i) => {
      const ours = p.blogId === CFG.blogId;
      return `<span class="b ${ours ? 'me' : ''}" tabindex="0"
        data-tip="${esc(`${i + 1}번째 · ${ours ? '⭐ 우리 글' : p.blogId}\n${p.title}`)}"></span>`;
    }).join('') + `</div>`;
  };

  const trend = history.length < 2 ? '' : (() => {
    const pts = history.slice(-12).map(h => ({ d: h.date, v: h.results.filter(r => r.mine > 0).length, n: h.results.length }));
    const W = 640, H = 120, P = 24, maxV = Math.max(...pts.map(p => p.n), 1);
    const x = (i) => P + (W - P * 2) * (pts.length === 1 ? .5 : i / (pts.length - 1));
    const y = (v) => H - P - (H - P * 2) * (v / maxV);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    return `<section class="card"><h2>추이</h2><p class="sub">점검할 때마다 쌓입니다. 검색어 ${pts[0].n}개 중 몇 개에 우리 글이 떴는지.</p>
      <svg viewBox="0 0 ${W} ${H}" class="trend" role="img" aria-label="점검 추이">
        <line x1="${P}" y1="${y(0)}" x2="${W - P}" y2="${y(0)}" class="ax"/>
        <path d="${d}" class="ln"/>
        ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="5" class="dt"><title>${p.d} — ${p.v}/${p.n}</title></circle>`).join('')}
        ${pts.map((p, i) => `<text x="${x(i)}" y="${y(p.v) - 14}" class="vl">${p.v}</text>`).join('')}
      </svg>
      <div class="xlab">${pts.map(p => `<span>${p.d.slice(5)}</span>`).join('')}</div></section>`;
  })();

  const pub = run.published && run.published.length ? `<section class="card"><h2>블로그에 올라가 있나</h2>
    <p class="sub">저장소 <code>blog/</code> 폴더의 글이 실제 네이버 블로그에서 보이는지 확인했습니다.</p>
    <ul class="pub">${run.published.map(p => `<li><span class="dot ${p.published === true ? 'ok' : p.published === false ? 'no' : 'unk'}"></span>
      <span>${esc(p.title)}</span><em>${p.published === true ? '올라감' : p.published === false ? '못 찾음 — 발행 안 했거나 제목이 바뀜' : '확인 못 함'}</em></li>`).join('')}</ul></section>` : '';

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>블로그 검색 점검 — 루멘수학</title>
<style>
:root{--bg:#eef2f8;--card:#fff;--ink:#0f172a;--ink2:#51607a;--mut:#8896ab;--line:#dde3ec;
  --navy:#0d2240;--me:#b5893a;--other:#6b7c96;--blue:#1d6fe8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;
  --bg:#0b1220;--card:#131c2b;--ink:#f1f5fb;--ink2:#b7c3d6;--mut:#7f8 da;--mut:#7f8da0;--line:#22304a;
  --navy:#e8eef8;--me:#d9a84e;--other:#93a3bb}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#0b1220;--card:#131c2b;--ink:#f1f5fb;--ink2:#b7c3d6;
  --mut:#7f8da0;--line:#22304a;--navy:#e8eef8;--me:#d9a84e;--other:#93a3bb}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);line-height:1.6;padding:0 16px 80px;
  font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  word-break:keep-all;-webkit-font-smoothing:antialiased}
.wrap{max-width:820px;margin:0 auto}
header{padding:44px 0 26px}
h1{font-size:15px;font-weight:700;color:var(--blue);letter-spacing:.04em}
.hero{font-size:64px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:12px 0 6px;color:var(--navy)}
.hero small{font-size:26px;font-weight:700;color:var(--mut)}
.sub{font-size:14px;color:var(--ink2)}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 30px}
.kpi{flex:1;min-width:150px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .l{font-size:13px;color:var(--ink2)}
.kpi .v{font-size:30px;font-weight:800;letter-spacing:-.02em;margin-top:2px}
.kpi .d{font-size:13px;font-weight:700;margin-top:2px}
.up{color:#0f9d58}.down{color:#d9534f}.flat{color:var(--mut)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 22px 24px;margin-bottom:18px}
h2{font-size:17px;font-weight:800;margin-bottom:4px}
.legend{display:flex;gap:16px;font-size:13px;color:var(--ink2);margin:14px 0 18px;font-weight:600}
.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px}
.kw{padding:15px 0;border-top:1px solid var(--line)}
.kw:first-of-type{border-top:0}
.kwh{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.kwq{font-size:16px;font-weight:700}
.kwm{font-size:13px;color:var(--mut);font-variant-numeric:tabular-nums}
.why{font-size:12.5px;color:var(--mut);margin-top:1px}
.blocks{display:flex;gap:4px;flex-wrap:wrap;margin-top:10px}
.b{width:26px;height:30px;border-radius:5px;background:var(--other);position:relative;cursor:default}
.b.me{background:var(--me);outline:2px solid var(--me);outline-offset:2px}
.b:hover::after,.b:focus::after{content:attr(data-tip);white-space:pre-line;position:absolute;left:0;top:36px;z-index:9;
  background:var(--navy);color:var(--bg);font-size:12.5px;line-height:1.45;padding:9px 12px;border-radius:9px;width:280px;
  box-shadow:0 6px 22px rgba(0,0,0,.28)}
.err{font-size:13.5px;color:var(--mut);margin-top:8px}
.riv li{list-style:none;padding:11px 0;border-top:1px solid var(--line);font-size:14px}
.riv li:first-child{border-top:0}
.riv b{font-weight:700}.riv em{font-style:normal;color:var(--mut);font-size:12.5px}
.riv p{font-size:13px;color:var(--ink2);margin-top:4px}
.pub li{list-style:none;display:grid;grid-template-columns:10px 1fr;gap:6px 10px;align-items:start;
  padding:12px 0;border-top:1px solid var(--line);font-size:14px}
.pub li:first-child{border-top:0}
.pub em{grid-column:2;font-style:normal;font-size:12.5px;color:var(--mut)}
.dot{width:10px;height:10px;border-radius:50%;margin-top:7px}
.dot.ok{background:#0f9d58}.dot.no{background:#d9534f}.dot.unk{background:var(--other)}
.trend{width:100%;height:auto}
.ax{stroke:var(--line);stroke-width:2}
.ln{fill:none;stroke:var(--me);stroke-width:2;stroke-linejoin:round}
.dt{fill:var(--me);stroke:var(--card);stroke-width:2}
.vl{fill:var(--ink2);font-size:13px;font-weight:700;text-anchor:middle}
.xlab{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);padding:0 18px;font-variant-numeric:tabular-nums}
.note{font-size:13px;color:var(--ink2)}
.note li{margin:6px 0 6px 18px}
footer{font-size:12.5px;color:var(--mut);text-align:center;padding-top:26px}
</style></head><body><div class="wrap">
<header>
  <h1>블로그 검색 점검 · 루멘수학</h1>
  <div class="hero">${hit} <small>/ ${n}</small></div>
  <p class="sub">검색어 ${n}개를 ${opt.pc ? 'PC' : '휴대폰'} 네이버에 하나씩 쳐 보고, 첫 화면에 우리 글이 있는지 셌습니다. ${run.date} 기준.</p>
  <div class="kpis">
    <div class="kpi"><div class="l">첫 화면에 우리 글이 뜬 검색어</div><div class="v">${hit} / ${n}</div>
      <div class="d ${delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}">${delta === null ? '첫 점검' : delta === 0 ? '지난번과 같음' : `지난번보다 ${delta > 0 ? '+' : ''}${delta}`}</div></div>
    <div class="kpi"><div class="l">첫 화면에 뜬 우리 글 (중복 포함)</div><div class="v">${totalMine}건</div></div>
    <div class="kpi"><div class="l">점검한 날</div><div class="v" style="font-size:22px">${run.date}</div>
      <div class="d flat">${history.length}번째 점검</div></div>
  </div>
</header>

<section class="card">
  <h2>검색어별로 첫 화면에 무엇이 떴나</h2>
  <p class="sub">칸 하나가 첫 화면에 뜬 블로그 글 하나입니다(나온 차례대로). 칸에 손을 올리면 어느 블로그의 어떤 글인지 나옵니다.</p>
  <div class="legend"><span><i style="background:var(--me)"></i>우리 글</span><span><i style="background:var(--other)"></i>남의 글</span></div>
  ${run.results.map(r => `<div class="kw">
    <div class="kwh"><div><div class="kwq">${esc(r.q)}${r.mine ? ' ⭐' : ''}</div><div class="why">${esc(r.why || '')}</div></div>
      <div class="kwm">블로그 글 ${r.total}건 중 <b>내 글 ${r.mine}편</b></div></div>
    ${strip(r)}</div>`).join('')}
</section>

${trend}

${top.length ? `<section class="card"><h2>이 동네에서 이기고 있는 블로그</h2>
  <p class="sub">첫 화면에 자주 뜬 남의 블로그입니다. <b>제목을 보면 어떤 글이 먹히는지</b> 보입니다 — 글감으로 쓰세요.</p>
  <ul class="riv">${top.map(([id, v]) => `<li><b>${esc(id)}</b> <em>${v.n}번 등장</em>
    ${v.titles.map(t => `<p>· ${esc(t)}</p>`).join('')}</li>`).join('')}</ul></section>` : ''}

${pub}

<section class="card"><h2>읽을 때 주의할 것</h2>
  <ul class="note">
    <li>네이버가 매기는 «순위»가 아니라 <b>화면에 나온 차례</b>입니다. 검색 결과는 사람·기기·시간마다 다릅니다.</li>
    <li>«첫 화면»은 스크롤하지 않고 보이는 만큼입니다. 더 내리면 우리 글이 있을 수도 있습니다.</li>
    <li>${opt.pc ? 'PC' : '휴대폰'} 화면 기준입니다. 학부모는 대부분 휴대폰으로 찾습니다.</li>
    <li>로그인하지 않고 검색 화면만 읽습니다. 글을 쓰거나 고치지 않습니다.</li>
    <li>네이버 화면 구조가 바뀌면 숫자가 어긋날 수 있습니다. <code>sync/_debug/serp/</code> 에 검색할 때 찍은 화면이 저장되니, 이상하면 그 사진과 맞춰 보세요.</li>
  </ul></section>

<footer>node sync/serp_check.js · 기록은 docs/serp_history/ 에 쌓입니다</footer>
</div></body></html>`;
}

// ── 실행 ─────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(HIST_DIR, { recursive: true });
  let history = fs.readdirSync(HIST_DIR).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), 'utf8')));

  if (!opt.renderOnly && !opt.demo) {
    const results = await collect();
    const published = await checkPublished();
    const run = { date: today(), device: opt.pc ? 'pc' : 'mobile', blogId: CFG.blogId, results, published };
    fs.writeFileSync(path.join(HIST_DIR, `${run.date}.json`), JSON.stringify(run, null, 1), 'utf8');
    history = history.filter(h => h.date !== run.date).concat(run).sort((a, b) => a.date.localeCompare(b.date));
  }
  if (!history.length) { log('❌ 기록이 없습니다. --demo 로 모양만 볼 수 있습니다.'); process.exit(1); }

  fs.writeFileSync(OUT_HTML, render(history[history.length - 1], history), 'utf8');
  const last = history[history.length - 1];
  log(`✅ ${path.relative(ROOT, OUT_HTML)} — 검색어 ${last.results.length}개 중 ${last.results.filter(r => r.mine > 0).length}개가 첫 화면`);
})().catch(e => { log('❌', e.message); process.exit(1); });
