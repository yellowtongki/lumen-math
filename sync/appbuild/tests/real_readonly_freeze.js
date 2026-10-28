/* 실서버 자료(읽기만 · 쓰기는 가짜 성공)로 학원앱을 띄워 한 화면이 멈추는지 재는 도구 — 멈추면 디버거로 멈춘 자리(줄 번호)를 찍는다.
 *   2026-10-28 리커버리 멈춤(v19-168) 찾을 때 만듦. 학생 실명이 화면 글에 나올 수 있으니 출력은 채팅·로그에 그대로 붙이지 말 것.
 *   실행: SUPABASE_SERVICE_KEY=… NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/real_readonly_freeze.js lumen_v19-168.html recovery */
/* 실서버 자료로 학원앱 띄우기 — 읽기만(쓰기 요청은 모두 가짜 성공) · 멈추면 디버거로 멈춘 자리 찍기 */
const { chromium } = require('playwright');
const FILE = require('path').resolve(process.argv[2]); const HASH = process.argv[3] || 'recovery';
const SB = 'https://bhkkkbcytcrlxhrtjgen.supabase.co', K = process.env.SUPABASE_SERVICE_KEY;
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  pg.on('dialog', (d) => d.dismiss());
  let reads = 0, blocked = [];
  await pg.route(/^https?:\/\//, async (r) => {
    const req = r.request(), u = req.url(), m = req.method();
    if (!u.startsWith(SB)) { if (/fonts\.g|cdnjs|jsdelivr|unpkg/.test(u)) return r.continue(); return r.abort(); }
    const isRead = m === 'GET' || m === 'HEAD' || (m === 'POST' && /\/storage\/v1\/object\/list\//.test(u)) || (m === 'POST' && /\/rest\/v1\/rpc\//.test(u) && false);
    if (!isRead) { blocked.push(m + ' ' + u.replace(SB, '').slice(0, 80)); return r.fulfill({ status: 200, contentType: 'application/json', body: m === 'POST' && /rest\/v1/.test(u) ? '[]' : '{}' }); }
    try {
      const src = req.headers(), h = { apikey: K, authorization: 'Bearer ' + K }; ['content-type','accept','prefer','range','range-unit','accept-profile','content-profile','x-client-info'].forEach((k) => { if (src[k]) h[k] = src[k]; });
      const res = await fetch(u, { method: m, headers: h, body: m === 'POST' ? req.postData() : undefined });
      const body = Buffer.from(await res.arrayBuffer()); reads++;
      const hh = {}; res.headers.forEach((v, k) => { if (!/encoding|length/.test(k)) hh[k] = v; }); hh['access-control-allow-origin'] = '*';
      return r.fulfill({ status: res.status, headers: hh, body });
    } catch (e) { return r.abort(); }
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' });
  await pg.waitForTimeout(8000);
  console.log('boot reads', reads, 'errs', errs.slice(0, 3), 'students', await pg.evaluate(() => (typeof students !== 'undefined' ? students.length : -1)), 'VIEW', await pg.evaluate(() => VIEW));
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Debugger.enable');
  let paused = null; cdp.on('Debugger.paused', (e) => { paused = e; });
  const t0 = Date.now();
  pg.evaluate((h) => { const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none'; VIEW = h; render(); }, HASH).catch((e) => console.log('nav err', e.message));
  /* 15초 동안 응답 확인 */
  let alive = true;
  for (let i = 0; i < 15; i++) {
    const ok = await Promise.race([pg.evaluate(() => 1).then(() => true).catch(() => false), new Promise((r) => setTimeout(() => r(false), 2000))]);
    if (!ok) { alive = false; break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('alive', alive, 'after', Date.now() - t0, 'ms · reads', reads, 'blocked writes', blocked.length);
  if (!alive) {
    await cdp.send('Debugger.pause'); await new Promise((r) => setTimeout(r, 1500));
    if (paused) { for (const f of paused.callFrames.slice(0, 14)) console.log('  at', f.functionName || '(anon)', 'line', f.location.lineNumber + 1, 'col', f.location.columnNumber); }
    else console.log('pause 안 됨');
  } else {
    await new Promise((r) => setTimeout(r, 5000)); console.log('Q', await pg.evaluate(async () => { const r = await getSupaClient().from('lumen_store').select('key,updated_at').in('key', ['mf_weekly', 'mf_collect_req']); return JSON.stringify({ e: r.error && r.error.message, n: (r.data || []).length, d: r.data }).slice(0, 300); })); console.log('RC154', await pg.evaluate(() => JSON.stringify({ t: RC154.t, loading: RC154.loading, at: RC154.at, req: RC154.req && RC154.req.status })));
    const tx = await pg.evaluate(() => (document.getElementById('CONTENT') || document.body).innerText.slice(0, 300));
    console.log(tx);
  }
  console.log('blocked', blocked.slice(0, 8));
  await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
