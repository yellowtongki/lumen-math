/* 매쓰플랫 로그인 줄이기 검사 — 가짜 매쓰플랫 · 가짜 서버(lumen_store) · 가짜 시계. 실제 매쓰플랫에 접속하지 않는다.
 * 실행: node sync/test_mf_login_guard.js */
const { make } = require('./mf_login_guard.js');
let p = 0, f = 0; const t = (n, ok, i) => { ok ? p++ : f++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' ← ' + i)); };
function world(loginAnswer) {
  const W = { clock: 1_800_000_000_000, store: null, mfLogins: 0, slept: 0, answer: loginAnswer || { accessToken: 'T', academyId: 1, userId: 2 } };
  const res = (st, b) => ({ ok: st < 300, status: st, json: async () => b, clone() { return res(st, b); } });
  W.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/rest/v1/lumen_store')) {
      if ((init && init.method) === 'POST') { W.store = JSON.parse(init.body)[0].value; return res(201, {}); }
      return res(200, W.store ? [{ value: JSON.parse(JSON.stringify(W.store)) }] : []);
    }
    if (u.includes('mathflat.com/v2/login')) { W.mfLogins++; const a = typeof W.answer === 'function' ? W.answer() : W.answer; return res(a.accessToken ? 200 : 403, a); }
    if (u.includes('mathflat.com/')) return res(200, { content: [] });
    throw new Error('모르는 주소 ' + u);
  };
  W.g = make(W.fetch, { sbUrl: 'http://sb', sbKey: 'k', now: () => W.clock, sleep: async (ms) => { W.slept += ms; W.clock += ms; }, log: () => {} });
  W.login = () => W.g.guarded('https://api.mathflat.com/v2/login', { method: 'POST', body: '{}' });
  return W;
}
(async () => {
  /* ① 작업 6개가 몰려도 매쓰플랫 로그인은 한 번 */
  let W = world();
  for (let i = 0; i < 6; i++) { const r = await W.login(); const j = await r.json(); if (!j.accessToken) throw new Error('토큰 없음'); W.clock += 10000; }
  t('작업 6개가 1분 안에 몰려도 매쓰플랫 로그인 1번 (나머지는 같은 열쇠)', W.mfLogins === 1, W.mfLogins);
  /* ② 2분 지나면 새로 로그인 · 60초 간격은 지켜짐 */
  W.clock += 3 * 60000; await W.login();
  t('2분 넘으면 새로 로그인(2번째)', W.mfLogins === 2, W.mfLogins);
  /* ③ 로그인 직후 열쇠가 없는 상황(예: 저장 실패)에서도 60초 간격 */
  W.store.at = null; W.slept = 0; await W.login();
  t('60초 안에 또 로그인하려면 기다림', W.slept > 0 && W.slept <= 60000 && W.mfLogins === 3, W.slept + ' / ' + W.mfLogins);
  /* ④ WAF_BLOCKED → 3시간 멈춤 · 다른 작업은 로그인하지 않음 */
  W = world({ code: 'WAF_BLOCKED' });
  let r = await W.login(); let j = await r.json();
  t('WAF_BLOCKED 답은 그대로 전달', j.code === 'WAF_BLOCKED' && W.mfLogins === 1, JSON.stringify(j));
  t('서버에 멈춤 기록 (3시간)', W.store && W.store.reason === 'WAF_BLOCKED' && Date.parse(W.store.blockedUntil) - W.clock === 3 * 3600000, JSON.stringify(W.store));
  W.clock += 3600000; for (let i = 0; i < 5; i++) { r = await W.login(); j = await r.json(); }
  t('멈춤 동안 다른 작업 5번 → 매쓰플랫엔 안 감 (MF_PAUSED)', W.mfLogins === 1 && j.code === 'MF_PAUSED' && r.status === 429, W.mfLogins + ' ' + j.code);
  /* ⑤ 3시간 지나면 다시 시도 · 성공하면 멈춤 풀림 */
  W.answer = { accessToken: 'T2' }; W.clock += 2 * 3600000 + 1000; r = await W.login(); j = await r.json();
  t('3시간 뒤 다시 시도 · 성공하면 멈춤 풀림', W.mfLogins === 2 && j.accessToken === 'T2' && !W.store.blockedUntil, JSON.stringify(W.store && { b: W.store.blockedUntil }));
  /* ⑥ CAPTCHA_REQUIRED 도 멈춤 */
  W = world({ code: 'CAPTCHA_REQUIRED' }); await W.login();
  t('CAPTCHA_REQUIRED 도 멈춤', W.store.reason === 'CAPTCHA_REQUIRED', JSON.stringify(W.store));
  /* ⑦ 로그인이 아닌 요청은 손대지 않음 · 서버 설정 없으면 통과 */
  W = world(); await W.g.guarded('https://api.mathflat.com/students?size=1', {});
  t('로그인 아닌 요청은 그대로(서버 안 읽음)', W.store === null && W.mfLogins === 0, '');
  const g2 = make(W.fetch, { sbUrl: '', sbKey: '' }); await g2.guarded('https://api.mathflat.com/v2/login', { method: 'POST' }); await g2.guarded('https://api.mathflat.com/v2/login', { method: 'POST' });
  t('서버 설정이 없으면 그대로 통과(로그인 2번)', W.mfLogins === 2, W.mfLogins);
  console.log('\n' + p + '/' + (p + f) + (f ? ' ❌' : ' ✅')); process.exit(f ? 1 : 0);
})();
