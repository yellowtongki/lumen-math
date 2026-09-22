/* 2025 옥길중 중1 해설집 검증 — 학원앱 📖 기출 해설집 화면에서 실제로 열리는지 본다
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_h25.js [학원앱파일]
 * 읽기 전용 — 서버에 아무것도 쓰지 않는다. */
const { chromium } = require('playwright'); const fs = require('fs');
const FILE = process.argv[2] || '/home/user/lumen-math/lumen_v19-28.html';
const CODE = 'okgil_m1_2025_2mid';
const src = fs.readFileSync(FILE, 'utf8');
const out = []; let bad = 0;
const ok = (n, c, x) => { if (!c) bad++; out.push((c ? '  ✅ ' : '  ❌ ') + n + (x !== undefined && x !== '' ? (' — ' + String(x).slice(0, 220)) : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 180)));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.indexOf('/APP.html') >= 0) return r.fulfill({ contentType: 'text/html', body: src });
    if (/supabase\.js/.test(u)) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('/home/user/lumen-math/supabase.js', 'utf8') });
    if (u.indexOf('supabase.co') >= 0) {
      try {
        const h = Object.assign({}, r.request().headers()); delete h['host']; delete h['content-length'];
        const res = await fetch(u, { method: r.request().method(), headers: h, body: r.request().postData() });
        const body = Buffer.from(await res.arrayBuffer()); const rh = {};
        res.headers.forEach((v, k) => { if (!/^(content-encoding|transfer-encoding|content-length)$/i.test(k)) rh[k] = v; });
        return r.fulfill({ status: res.status, headers: rh, body });
      } catch (e) { return r.fulfill({ status: 500, body: String(e) }); }
    }
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  await p.goto('https://yellowtongki.github.io/APP.html', { waitUntil: 'domcontentloaded', timeout: 70000 });
  await p.waitForTimeout(6000);

  /* 해설집 목록을 앱의 제 함수로 읽는다 */
  const cat = await p.evaluate(async () => { await hsLoad(true); return (HS.cat && HS.cat.items || []).map(x => ({ code: x.code, n: x.n, title: x.title })); });
  const it = cat.find(x => x.code === CODE);
  ok('해설집 목록에 2025 옥길중 중1이 보인다', !!it, it ? it.title : '목록 ' + cat.length + '권');
  ok('21문항으로 잡혀 있다', it && it.n === 21, it && it.n);

  /* 본문을 연다 */
  const body = await p.evaluate(async (code) => {
    const v = await hsBodyLoad(code);
    if (!v) return null;
    return { keys: Object.keys(v.items || {}).length, head: (v.head || '').length, cover: (v.cover || '').length,
             one: String((v.items || {})['11'] || '').slice(0, 4000) };
  }, CODE);
  ok('본문이 서버에서 열린다', !!body, body ? body.keys + '문항' : '');
  ok('문항 21개가 모두 들어 있다', body && body.keys === 21, body && body.keys);
  ok('머리말(CSS·MathJax)이 살아 있다', body && body.head > 5000, body && body.head);

  /* 문항 하나(11번)를 실제로 띄워 본다 */
  const q11 = body ? body.one : '';
  ok('11번에 실제 시험지 그림이 붙어 있다', /class="qshot"[\s\S]*mathflat/.test(q11));
  ok('11번 정답이 ① 로 적혀 있다', /class="val">[\s\S]{0,40}①/.test(q11), (q11.match(/class="val">([\s\S]{0,60})/) || [])[1]);
  ok('11번에 「확인이 필요한 문항」 알림이 있다', /class="check"/.test(q11));
  ok('단계별 풀이가 들어 있다', (q11.match(/class="step"/g) || []).length >= 3, (q11.match(/class="step"/g) || []).length);
  ok('「가장 잦은 실수」가 있다', /class="miss"/.test(q11));

  /* 정답 목록이 수학비서 원본과 같은지 (카탈로그 qs) */
  const qs = await p.evaluate((code) => {
    const it = (HS.cat.items || []).find(x => x.code === code);
    return (it && it.qs || []).map(q => ({ no: q.no, ans: q.ans, warn: !!q.warn }));
  }, CODE);
  const MS = { 1: '①', 2: '②', 3: '③', 4: '④', 5: '②', 6: '④', 7: '⑤', 8: '⑤', 9: '③', 10: '①',
    11: '①', 12: '③', 13: '⑤', 14: '①', 15: '④', 16: '③', 17: '②', 18: '④', 19: '④', 20: '④' };
  const diff = qs.filter(q => MS[q.no] && MS[q.no] !== q.ans).map(q => q.no + '번');
  ok('객관식 20문항 정답이 수학비서 원본과 모두 같다', diff.length === 0, diff.join(', '));
  ok('확인 필요 표시가 11·15·20번 세 곳에 있다',
    JSON.stringify(qs.filter(q => q.warn).map(q => q.no)) === '[11,15,20]',
    JSON.stringify(qs.filter(q => q.warn).map(q => q.no)));

  /* 기존 해설집이 그대로 있는지 (회귀) */
  ok('2024 옥길중 중1 해설집이 그대로 남아 있다', !!cat.find(x => x.code === 'okgil_m1_2024_2mid'));
  ok('해설집이 모두 9권이다', cat.length === 9, cat.length);
  ok('자바스크립트 오류가 없다', errs.length === 0, errs.join(' | '));

  await b.close();
  console.log(out.join('\n'));
  console.log(bad ? `\n❌ ${bad}개 실패` : `\n✅ ${out.length}/${out.length} 통과`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
