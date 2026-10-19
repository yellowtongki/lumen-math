#!/usr/bin/env node
/* 학생앱 v2-146 검사 — 🛡 루멘 영상 플레이어(LYP): 영상 보다가 유튜브로 빠져나가지 못하게
 * 외부망 차단 · 가짜 Supabase(기록만 받아 적음, 실서버에 아무것도 안 씀) · 가짜 YT.Player(호출을 받아 적고 상태를 쏴 줌)
 * 학생 이름은 가짜(○○○)
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2146.js student_v2-146.html
 *   SP 폴더에 플레이어 화면(stu_v2146_player.png · stu_v2146_pause.png)을 남긴다. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-146.html'));
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 0) <script> 블록마다 node --check ── */
(function checkScripts() {
  const html = fs.readFileSync(FILE, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, bad = 0; const dir = fs.mkdtempSync(path.join(SP, 'v2146_js_'));
  while ((m = re.exec(html))) {
    i++; const f = path.join(dir, 'block' + i + '.js'); fs.writeFileSync(f, m[1]);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad++; console.log(String(e.stderr || e.message).slice(0, 600)); }
  }
  t('<script> 블록 ' + i + '개 node --check', i > 0 && bad === 0, bad + '개 오류');
  /* 새 플레이어 부품은 ES5 만 */
  const a = html.indexOf('/* ══ v2-146 🛡 루멘 영상 플레이어(LYP)'), b = html.indexOf('/* ── 플레이어(유튜브) + 시청 기록 ── */');
  const blk = a >= 0 && b > a ? html.slice(a, b) : '';
  t('LYP 부품 ES5(=> · let · const · ` · ... 없음)', blk.length > 1000 && !/=>|\blet |\bconst |`|\.\.\./.test(blk), blk.length);
  t('유튜브 맨 iframe 주소(youtube.com/embed) 더 없음', html.indexOf('youtube.com/embed/') < 0, '');
})();

/* 가짜 유튜브 — 페이지 스크립트보다 먼저 */
const FAKE_YT = () => {
  window.__yt = [];
  function P(id, o) {
    this.id = id; this.o = o; this.calls = []; this.st = -1; this.t = 100; this.r = 1; this.d = 600;
    const el = document.getElementById(id); const f = document.createElement('iframe'); f.id = id;
    f.setAttribute('srcdoc', '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#475569,#0f172a);color:#fff;font:600 18px sans-serif">🎬 테스트용 가짜 영상</body>');
    el.parentNode.replaceChild(f, el); this.f = f; window.__yt.push(this);
    const me = this; setTimeout(() => { if (me.o.events.onReady) me.o.events.onReady({ target: me }); }, 10);
  }
  P.prototype.playVideo = function () { this.calls.push(['play']); };
  P.prototype.pauseVideo = function () { this.calls.push(['pause']); };
  P.prototype.seekTo = function (s, a) { this.calls.push(['seek', s, a]); this.t = s; };
  P.prototype.getCurrentTime = function () { return this.t; };
  P.prototype.getDuration = function () { return this.d; };
  P.prototype.getPlayerState = function () { return this.st; };
  P.prototype.getPlaybackRate = function () { return this.r; };
  P.prototype.setPlaybackRate = function (r) { this.calls.push(['rate', r]); this.r = r; const me = this; setTimeout(() => { if (me.o.events.onPlaybackRateChange) me.o.events.onPlaybackRateChange({ data: r, target: me }); }, 5); };
  P.prototype.destroy = function () { this.calls.push(['destroy']); this.dead = true; if (this.f.parentNode) this.f.parentNode.removeChild(this.f); };
  P.prototype.getIframe = function () { return this.f; };
  P.prototype._fire = function (s) { this.st = s; this.o.events.onStateChange({ data: s, target: this }); };
  window.YT = { Player: P, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 400, height: 860 }, hasTouch: false });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.addInitScript(FAKE_YT);
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);

  /* 가짜 Supabase + 강의 한 편 배정 */
  const ver = await pg.evaluate(() => {
    window.__sbLog = [];
    const rowsOf = () => [];
    window.sb = { from(tbl) { const b = { f: {}, op: 'select', row: null,
      select() { return b; }, eq(k, v) { b.f.eq = [k, v]; if (b.op === 'update') window.__sbLog.push({ tbl, op: 'update', row: b.row, eq: [k, v] }); return b; },
      in() { return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, is() { return b; },
      update(row) { b.op = 'update'; b.row = JSON.parse(JSON.stringify(row)); return b; },
      insert(row) { window.__sbLog.push({ tbl, op: 'insert', row: JSON.parse(JSON.stringify(row)) }); b.op = 'insert'; return b; },
      upsert() { return Promise.resolve({ error: null }); }, delete() { return b; },
      single() { return Promise.resolve({ data: b.op === 'insert' ? { id: 77 } : null, error: null }); },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      then(r, j) { return Promise.resolve({ data: b.op === 'select' ? rowsOf() : null, error: null }).then(r, j); } }; return b; } };
    window.isTest = false;
    window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5' };
    window.confirm = () => true; window.alert = () => {};
    VS3.cat = { folders: [{ id: 'f1', name: '중2 연립방정식', order: 1, completeThreshold: 90, maxRate: 1.5 }], units: [],
      videos: [{ id: 'v1', folderId: 'f1', title: '연립방정식 개념 1강', youtubeId: 'abcDEF12345', durationSec: 600, order: 1 }] };
    VS3.asn = { v1: { codes: ['AAA111'], due: '' } };
    VS3.logs = [];
    vs3Open('v1');
    return STU_VER;
  });
  t('버전 v2-146', ver === 'v2-146', ver);
  await pg.waitForTimeout(150);

  const P = (fn, arg) => pg.evaluate(fn, arg);
  const calls = () => P(() => window.__yt[window.__yt.length - 1].calls.slice());
  const fire = (s) => P((s) => window.__yt[window.__yt.length - 1]._fire(s), s);
  const topAt = () => P(() => {
    const f = document.querySelector('#vs3-playhost iframe'); const r = f.getBoundingClientRect();
    const pts = { center: [r.left + r.width / 2, r.top + r.height / 2], tl: [r.left + 2, r.top + 2], br: [r.right - 3, r.bottom - 3], tr: [r.right - 3, r.top + 2], bl: [r.left + 2, r.bottom - 3] };
    const out = {}; Object.keys(pts).forEach((k) => { const e = document.elementFromPoint(pts[k][0], pts[k][1]);
      out[k] = !e ? 'none' : (e === f ? 'IFRAME' : (e.classList.contains('lyp-shield') ? 'shield' : (e.closest('.lyp-cover') ? 'cover' : (e.closest('.lyp-strip') ? 'strip' : e.tagName + '.' + e.className)))); });
    return out;
  });

  /* ── 1) 유튜브 설정 ── */
  const cfg = await P(() => { const y = window.__yt[0]; return { n: window.__yt.length, id: y.id, videoId: y.o.videoId, pv: y.o.playerVars, ev: Object.keys(y.o.events), same: VS3.player === y, inWrap: !!document.querySelector('#vs3-playhost .lyp .lyp-stage iframe#vs3-yt') }; });
  t('유튜브 플레이어 1개 · 영상 abcDEF12345 · VS3.player 연결', cfg.n === 1 && cfg.videoId === 'abcDEF12345' && cfg.same, JSON.stringify(cfg));
  const pv = cfg.pv || {};
  t('playerVars controls:0 · fs:0 · disablekb:1 · rel:0 · iv_load_policy:3 · playsinline:1 · modestbranding:1',
    pv.controls === 0 && pv.fs === 0 && pv.disablekb === 1 && pv.rel === 0 && pv.iv_load_policy === 3 && pv.playsinline === 1 && pv.modestbranding === 1, JSON.stringify(pv));
  t('이벤트 onStateChange · onPlaybackRateChange 연결', cfg.ev.indexOf('onStateChange') >= 0 && cfg.ev.indexOf('onPlaybackRateChange') >= 0, JSON.stringify(cfg.ev));
  t('iframe 이 LYP 무대 안에 있음(id vs3-yt 그대로)', cfg.inWrap, '');
  const ifr = await P(() => { const f = document.querySelector('#vs3-playhost iframe'); return f.getAttribute('tabindex'); });
  t('iframe 은 탭으로 못 들어감(tabindex -1)', ifr === '-1', ifr);

  /* ── 2) 시작 전 → 우리 판이 덮음 ── */
  let top = await topAt();
  t('시작 전: 영상 전체를 우리 판(▶ + 제목)이 덮음', Object.values(top).every((v) => v === 'cover'), JSON.stringify(top));
  const startTxt = await P(() => document.querySelector('#vs3-playhost .lyp-cover').textContent);
  t('시작 판에 제목', /연립방정식 개념 1강/.test(startTxt), startTxt);
  await pg.click('#vs3-playhost .lyp-cover .lyp-big');
  let c = await calls();
  t('▶ 누르면 playVideo', c.some((x) => x[0] === 'play'), JSON.stringify(c));
  await fire(1);
  top = await topAt();
  t('재생 중: 가운데·네 귀퉁이 모두 방패(iframe 아님)', Object.values(top).every((v) => v === 'shield'), JSON.stringify(top));
  const tick = await P(() => !!VS3.tick && !!VS3.saveTimer && VS3.segStart === 100);
  t('재생 이벤트 → 기존 시청 기록 타이머·구간 시작(vs3OnState)', tick, '');
  await pg.waitForTimeout(1150);
  const w1 = await P(() => VS3.ses.watched);
  t('1초마다 본 시간 세기(vs3Tick) 그대로', w1 >= 1, w1);

  /* 화면 사진(재생 중 · 막대 보임) */
  const shot = path.join(SP, 'stu_v2146_player.png');
  await (await pg.$('#screen-vod-play')).screenshot({ path: shot });

  /* ── 3) 방패 톡 = 멈춤 / 멈춤 판 ── */
  const shieldBox = await (await pg.$('#vs3-playhost .lyp-shield')).boundingBox();
  await pg.mouse.click(shieldBox.x + shieldBox.width / 2, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(400);
  c = await calls();
  t('방패 톡 → pauseVideo', c.filter((x) => x[0] === 'pause').length === 1, JSON.stringify(c));
  await fire(2);
  await pg.waitForTimeout(100);
  top = await topAt();
  const pTxt = await P(() => document.querySelector('#vs3-playhost .lyp-cover').textContent);
  t('멈춤: 우리 판이 영상 전체를 덮음(유튜브 추천 안 보임)', Object.values(top).every((v) => v === 'cover') && /멈춤/.test(pTxt), JSON.stringify(top) + ' ' + pTxt);
  const ins = await P(() => window.__sbLog.filter((x) => x.tbl === 'vod_watch_logs'));
  t('멈춤 → 시청 기록 저장(vod_watch_logs insert · 영상 v1 · 본 시간 ≥1)', ins.length >= 1 && ins[0].op === 'insert' && ins[0].row.video_id === 'v1' && ins[0].row.watched_sec >= 1 && ins[0].row.student_code === 'AAA111', JSON.stringify(ins).slice(0, 300));
  await (await pg.$('#screen-vod-play')).screenshot({ path: path.join(SP, 'stu_v2146_pause.png') });
  /* 멈춘 화면 보기 → 판만 걷히고 방패는 그대로 */
  await pg.click('#vs3-playhost .lyp-peek');
  top = await topAt();
  t('「🔍 멈춘 화면 보기」: 판은 걷히고 방패가 그대로 막음', Object.values(top).every((v) => v === 'shield'), JSON.stringify(top));
  await pg.mouse.click(shieldBox.x + shieldBox.width / 2, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(400);
  c = await calls();
  t('멈춤 중 방패 톡 → playVideo', c.filter((x) => x[0] === 'play').length === 2, JSON.stringify(c));
  await fire(1);

  /* ── 4) 두 번 톡 = 10초 · −10/+10 단추 · 진행 막대 ── */
  const n0 = (await calls()).length;
  await pg.mouse.click(shieldBox.x + shieldBox.width * 0.15, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(80);
  await pg.mouse.click(shieldBox.x + shieldBox.width * 0.15, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(400);
  await pg.mouse.click(shieldBox.x + shieldBox.width * 0.85, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(80);
  await pg.mouse.click(shieldBox.x + shieldBox.width * 0.85, shieldBox.y + shieldBox.height / 2);
  await pg.waitForTimeout(400);
  c = (await calls()).slice(n0);
  t('두 번 톡: 왼쪽 → 10초 뒤로(90) · 오른쪽 → 10초 앞으로(100) · 재생/멈춤은 안 건드림',
    JSON.stringify(c) === JSON.stringify([['seek', 90, true], ['seek', 100, true]]), JSON.stringify(c));
  await P(() => { window.__yt[0].t = 200; });
  await pg.click('#vs3-playhost .lyp-back');
  await pg.click('#vs3-playhost .lyp-fwd');
  c = (await calls()).slice(-2);
  t('−10초 단추 → seekTo(190) · +10초 단추 → seekTo(200)', JSON.stringify(c) === JSON.stringify([['seek', 190, true], ['seek', 200, true]]), JSON.stringify(c));
  const pb = await (await pg.$('#vs3-playhost .lyp-prog')).boundingBox();
  const pmax = await P(() => document.querySelector('#vs3-playhost .lyp-prog').max);
  await pg.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await pg.waitForTimeout(100);
  c = (await calls()).slice(-1)[0];
  t('진행 막대 가운데 누르기 → seekTo(약 300초 · 막대 끝 600)', pmax === '600' && c[0] === 'seek' && c[1] >= 280 && c[1] <= 320 && c[2] === true, pmax + ' ' + JSON.stringify(c));
  const tl = await P(() => [document.querySelector('#vs3-playhost .lyp-cur').textContent, document.querySelector('#vs3-playhost .lyp-dur').textContent]);
  await pg.waitForTimeout(300);
  const tl2 = await P(() => [document.querySelector('#vs3-playhost .lyp-cur').textContent, document.querySelector('#vs3-playhost .lyp-dur').textContent]);
  t('시간 표시(지금 / 전체 10:00)', tl2[1] === '10:00' && /^[45]:\d\d$/.test(tl2[0]), JSON.stringify([tl, tl2]));

  /* ── 5) 배속 — 최대 배속 1.5 지킴 · 기존 vs3OnRate 기록 ── */
  await pg.click('#vs3-playhost .lyp-rate'); await pg.waitForTimeout(60);
  const r1 = await P(() => ({ seg: VS3.segRate, lbl: document.querySelector('#vs3-playhost .lyp-rate').textContent, segs: VS3.ses.segments.length }));
  t('배속 단추 → setPlaybackRate(1.25) · vs3OnRate 가 구간 배속 1.25 기록', r1.seg === 1.25 && r1.lbl === '1.25×', JSON.stringify(r1));
  await pg.click('#vs3-playhost .lyp-rate'); await pg.waitForTimeout(60);
  await pg.click('#vs3-playhost .lyp-rate'); await pg.waitForTimeout(60);
  c = (await calls()).filter((x) => x[0] === 'rate').map((x) => x[1]);
  t('배속 순서 1.25 → 1.5 → 0.75 (선생님 최대 1.5배라 2배 없음)', JSON.stringify(c) === JSON.stringify([1.25, 1.5, 0.75]), JSON.stringify(c));
  await P(() => window.__yt[0].setPlaybackRate(2)); await pg.waitForTimeout(80);
  c = (await calls()).filter((x) => x[0] === 'rate').map((x) => x[1]);
  t('다른 길로 2배가 되면 기존 vs3OnRate 가 1.5배로 되돌림', c[c.length - 1] === 1.5, JSON.stringify(c));
  await pg.waitForTimeout(1100);
  const sr = await P(() => VS3.ses.rate);
  t('시청 기록의 최고 배속(ses.rate) 기록 그대로', sr >= 1.5, sr);

  /* ── 6) 전체 화면 — 우리 틀 ── */
  await pg.click('#vs3-playhost .lyp-fs'); await pg.waitForTimeout(300);
  const fs1 = await P(() => { const w = document.querySelector('#vs3-playhost .lyp'); const fe = document.fullscreenElement || document.webkitFullscreenElement; return { native: fe === w, css: w.classList.contains('lyp-full'), lbl: document.querySelector('#vs3-playhost .lyp-fs').getAttribute('aria-label') }; });
  t('⛶ → 우리 틀(방패·막대 포함)이 전체 화면 (' + (fs1.native ? '진짜 전체 화면' : 'CSS 꽉 찬 화면') + ')', (fs1.native || fs1.css) && fs1.lbl === '전체 화면 끄기', JSON.stringify(fs1));
  top = await topAt();
  t('전체 화면에서도 방패가 영상 전체를 막음', Object.values(top).every((v) => v === 'shield'), JSON.stringify(top));
  await pg.click('#vs3-playhost .lyp-fs'); await pg.waitForTimeout(300);
  const fs2 = await P(() => { const w = document.querySelector('#vs3-playhost .lyp'); return { fe: !!(document.fullscreenElement), css: w.classList.contains('lyp-full') }; });
  t('🗗 → 전체 화면 끔', !fs2.fe && !fs2.css, JSON.stringify(fs2));
  /* 아이폰 흉내: 틀 전체 화면이 없음 → CSS 꽉 찬 화면 */
  await P(() => { Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false }); Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; });
  await pg.click('#vs3-playhost .lyp-fs'); await pg.waitForTimeout(150);
  const fs3 = await P(() => { const w = document.querySelector('#vs3-playhost .lyp'); const r = w.getBoundingClientRect(); return { css: w.classList.contains('lyp-full'), lock: document.body.classList.contains('lyp-lock'), r: [r.left, r.top, r.width, r.height], fe: !!document.fullscreenElement, flash: document.querySelector('#vs3-playhost .lyp-flash').textContent }; });
  t('아이폰(틀 전체 화면 없음) → CSS 꽉 찬 화면 0,0,400×860 · 옆으로 돌리기 안내', fs3.css && fs3.lock && !fs3.fe && fs3.r.join(',') === '0,0,400,860' && /옆으로/.test(fs3.flash), JSON.stringify(fs3));
  top = await topAt();
  t('꽉 찬 화면에서도 방패가 영상 전체를 막음', Object.values(top).every((v) => v === 'shield'), JSON.stringify(top));
  await (await pg.$('#vs3-playhost .lyp-fs')).focus(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  const fs4 = await P(() => [document.querySelector('#vs3-playhost .lyp').classList.contains('lyp-full'), document.body.classList.contains('lyp-lock')]);
  t('Esc → 꽉 찬 화면 끔', !fs4[0] && !fs4[1], JSON.stringify(fs4));

  /* ── 7) 끝 ── */
  await fire(0); await pg.waitForTimeout(150);
  top = await topAt();
  const eTxt = await P(() => document.querySelector('#vs3-playhost .lyp-cover').textContent);
  t('끝: 「다 봤어요 ✅」 판이 영상 전체를 덮음(끝 추천 영상 안 보임)', Object.values(top).every((v) => v === 'cover') && /다 봤어요 ✅/.test(eTxt), JSON.stringify(top) + ' ' + eTxt);
  const done = await P(() => ({ comp: VS3.ses.completed, upd: window.__sbLog.filter((x) => x.tbl === 'vod_watch_logs' && x.op === 'update' && x.row.completed === true && x.eq[1] === 77).length }));
  t('끝 이벤트 → 기존대로 완료 저장(update · completed:true · 같은 기록 id)', done.comp && done.upd >= 1, JSON.stringify(done));
  const nb = (await calls()).length;
  await pg.click('#vs3-playhost .lyp-cover [data-act="replay"]');
  c = (await calls()).slice(nb);
  t('↺ 다시 보기 → seekTo(0) + playVideo', JSON.stringify(c) === JSON.stringify([['seek', 0, true], ['play']]), JSON.stringify(c));

  /* ── 8) 아이폰 첫 재생 길(가운데만 잠깐 열기) ── */
  const first = await P(async () => {
    const host = document.createElement('div'); host.id = 't-first'; host.style.cssText = 'position:fixed;left:0;top:0;width:300px;z-index:99999';   /* body zoom(글씨 크기) 때문에 화면보다 좁게 */
    document.body.appendChild(host);
    const cc = lypCreate(host, { videoId: 'zzzFIRST001', title: '첫 재생 시험' });
    await new Promise((r) => setTimeout(r, 60));
    host.querySelector('.lyp-big').click();
    await new Promise((r) => setTimeout(r, 3200));
    const f = host.querySelector('iframe'); const r = f.getBoundingClientRect();
    const at = (x, y) => { const e = document.elementFromPoint(x, y); if (!e) return 'none'; return e === f ? 'IFRAME' : (e.closest('.lyp-strip') ? 'strip' : (e.closest('.lyp-cover') ? 'cover' : e.className)); };
    const o = { cls: cc.wrap.classList.contains('lyp-first'), center: at(r.left + r.width / 2, r.top + r.height / 2), tl: at(r.left + 2, r.top + 2), tr: at(r.right - 3, r.top + 2), br: at(r.right - 3, r.bottom - 3), bl: at(r.left + 2, r.bottom - 3), topMid: at(r.left + r.width / 2, r.top + 8) };
    cc.player._fire(1);
    o.after = cc.wrap.classList.contains('lyp-first'); o.afterCenter = at(r.left + r.width / 2, r.top + r.height / 2);
    lypDestroy(cc); host.remove(); return o;
  });
  t('첫 재생이 안 되면 3초 뒤 가운데만 열림 · 제목줄·네 귀퉁이는 막힘', first.cls && first.center === 'IFRAME' && ['tl', 'tr', 'br', 'bl', 'topMid'].every((k) => first[k] === 'strip'), JSON.stringify(first));
  t('재생이 시작되면 다시 전부 방패', !first.after && first.afterCenter === 'lyp-shield', JSON.stringify(first));

  /* ── 9) 닫기 → 정리 ── */
  const nIns = await P(() => window.__sbLog.length);
  await P(() => vs3Close()); await pg.waitForTimeout(200);
  const cl = await P(() => ({ d: window.__yt[0].calls.some((x) => x[0] === 'destroy'), live: LYP.list.length, lyp: VS3.lyp, pl: VS3.player, saved: window.__sbLog.length }));
  t('← 닫기 → 플레이어 destroy · LYP 정리 · 마지막 기록 저장', cl.d && cl.live === 0 && !cl.lyp && !cl.pl && cl.saved > nIns, JSON.stringify(cl));

  /* ── 10) ✍️ 손풀이 문항 카드 🎬 풀이 영상 ── */
  const hs = await P(async () => {
    const host = document.createElement('div'); host.id = 't-hsb'; host.style.cssText = 'position:fixed;left:0;top:0;width:340px;height:700px;overflow:auto;z-index:99999;background:#fff';
    document.body.appendChild(host);
    const bk = { id: 'b1', reveal: 'open' }, g = { gi: 4, num: '3', ids: [], sols: [{ id: 's1', img: '', title: '', vid: { yt: 'hsbVID00001', start: 42 } }] };
    const pgx = { page: '12', pid: null, groups: [g] };
    let how = 'card';
    try { host.innerHTML = hsbCardHtml(bk, pgx, g); } catch (e) { how = 'manual:' + e.message; host.innerHTML = '<div class="hsb-play" id="hsb-v4" data-on="0" style="display:none" data-yt="hsbVID00001" data-st="42"></div><button onclick="hsbVidToggle(4)">🎬</button>'; }
    const btn = Array.prototype.filter.call(host.querySelectorAll('button'), (b) => /🎬/.test(b.textContent))[0];
    const n0 = window.__yt.length; btn.click();
    await new Promise((r) => setTimeout(r, 80));
    const y = window.__yt[window.__yt.length - 1];
    const f = host.querySelector('#hsb-v4 iframe');
    const out = { how, made: window.__yt.length === n0 + 1, pv: y.o.playerVars, vid: y.o.videoId, hasIframe: !!f, rawEmbed: /youtube\.com\/embed/.test(host.innerHTML) };
    y._fire(1);
    const r = f.getBoundingClientRect();
    out.top = ['c', 'tl', 'br'].map((k) => { const p = k === 'c' ? [r.left + r.width / 2, r.top + r.height / 2] : (k === 'tl' ? [r.left + 2, r.top + 2] : [r.right - 3, r.bottom - 3]); const e = document.elementFromPoint(p[0], p[1]); return e === f ? 'IFRAME' : e.className; });
    out.bar = !!host.querySelector('#hsb-v4 .lyp-bar .lyp-play');
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    out.closed = y.dead === true && !host.querySelector('#hsb-v4 .lyp') && LYP.list.length === 0;
    host.remove();
    return out;
  });
  t('손풀이 🎬 풀이 영상도 LYP(' + hs.how + ') · 맨 embed iframe 없음', hs.made && hs.hasIframe && !hs.rawEmbed && hs.vid === 'hsbVID00001', JSON.stringify(hs));
  t('손풀이 영상 playerVars controls:0 · fs:0 · disablekb:1 · start:42', hs.pv && hs.pv.controls === 0 && hs.pv.fs === 0 && hs.pv.disablekb === 1 && hs.pv.start === 42, JSON.stringify(hs.pv));
  t('손풀이 영상도 방패가 가운데·귀퉁이 막음 + 우리 막대', hs.top.every((x) => x === 'lyp-shield') && hs.bar, JSON.stringify(hs.top));
  t('🎬 다시 누르면 접히고 플레이어 정리', hs.closed, JSON.stringify(hs));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n스크린샷: ' + shot);
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
