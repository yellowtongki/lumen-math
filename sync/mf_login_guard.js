/* ═══════════════════════════════════════════════════════════════════
 * 🛡 매쓰플랫 로그인 줄이기 (원장 2026-11-27 「로그인 줄이기 만들어」)
 * ═══════════════════════════════════════════════════════════════════
 * 왜: 11/27 오전 11시쯤부터 매쓰플랫이 우리 계정의 «프로그램 로그인»을 WAF_BLOCKED 로 막았다.
 *     작업마다 따로 로그인하고(수집·지금 가져오기·쌍둥이·오답 쌍둥이·리커버리…), 깃허브가 예약을 늦게 돌려
 *     작업이 한꺼번에 몰리면 짧은 시간에 로그인이 여러 번 일어난다. 막힌 뒤에도 6개 작업이 계속 두드렸다.
 *
 * 어떻게: 모든 매쓰플랫 스크립트의 «로그인 요청(POST …/v2/login)» 한 곳만 가로챈다 — 스크립트 25개를 고치지 않는다.
 *   node 를 `--require ./sync/mf_login_guard.js` 로 띄우면(깃허브 작업은 NODE_OPTIONS 로 자동) fetch 를 감싼다.
 *   ① 멈춤: 서버 lumen_store «mf_login_guard».blockedUntil 이 지나지 않았으면 로그인하지 않고 바로 실패(code MF_PAUSED)
 *   ② 같이 쓰기: 최근 REUSE_MS(2분) 안에 받은 열쇠(토큰)가 있으면 새로 로그인하지 않고 그 답을 돌려준다
 *   ③ 간격: 마지막 로그인 뒤 GAP_MS(60초)가 안 지났으면 기다렸다가 한다(최대 90초)
 *   ④ 차단 기록: 로그인 답이 WAF_BLOCKED · CAPTCHA_REQUIRED 면 blockedUntil = 지금 + PAUSE_MS(3시간) 을 남긴다
 *      → 다른 작업들도 그 시간 동안 로그인하지 않는다. 사람이 풀었으면 `node sync/mf_login_guard.js --clear`
 *   서버(SUPABASE_URL·SUPABASE_SERVICE_KEY)가 없으면 아무것도 안 하고 그대로 통과한다.
 *   열쇠(토큰)는 lumen_store 에 저장한다 — 공개 저장소에는 절대 적지 않는다(로그에도 안 찍는다).
 *
 * 쓰는 법
 *   NODE_OPTIONS="--require $PWD/sync/mf_login_guard.js" node sync/rcws_make.js …     (채팅 세션)
 *   node sync/mf_login_guard.js --status | --clear | --pause 3h
 *   환경변수로 바꾸기: MFG_REUSE_MS · MFG_GAP_MS · MFG_PAUSE_MS · MFG_OFF=1(끄기)
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';
const KEY = 'mf_login_guard';
const REUSE_MS = Number(process.env.MFG_REUSE_MS || 2 * 60000);
const GAP_MS = Number(process.env.MFG_GAP_MS || 60000);
const PAUSE_MS = Number(process.env.MFG_PAUSE_MS || 3 * 3600000);
const MAX_WAIT = 90000;
const BLOCK_CODES = ['WAF_BLOCKED', 'CAPTCHA_REQUIRED'];

function make(realFetch, opts) {
  opts = opts || {};
  const SB = String(('sbUrl' in opts ? opts.sbUrl : process.env.SUPABASE_URL) || '').replace(/\/$/, '');
  const SK = ('sbKey' in opts ? opts.sbKey : process.env.SUPABASE_SERVICE_KEY) || '';
  const now = opts.now || (() => Date.now());
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = opts.log || ((...a) => console.log('[로그인 줄이기]', ...a));
  const H = { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' };
  async function read() {
    try {
      const r = await realFetch(SB + '/rest/v1/lumen_store?key=eq.' + KEY + '&select=value', { headers: H });
      if (!r.ok) return {};
      const j = await r.json(); let v = j && j[0] && j[0].value;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return {}; }
  }
  async function write(v) {
    try {
      await realFetch(SB + '/rest/v1/lumen_store?on_conflict=key', { method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ key: KEY, value: v, updated_at: new Date(now()).toISOString() }]) });
    } catch (e) {}
  }
  function fake(status, body) {
    const txt = JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, json: async () => JSON.parse(txt), text: async () => txt, clone() { return fake(status, body); } };
  }
  function isLogin(url, init) {
    const u = String((url && url.url) || url || '');
    const m = String((init && init.method) || (url && url.method) || 'GET').toUpperCase();
    return m === 'POST' && /mathflat\.com\/v2\/login(\?|$)/.test(u);
  }
  async function guarded(url, init) {
    if (!SB || !SK || process.env.MFG_OFF === '1' || !isLogin(url, init)) return realFetch(url, init);
    let st = await read(); const t = now();
    if (st.blockedUntil && Date.parse(st.blockedUntil) > t) {
      log('멈춤 중 — ' + st.reason + ' · ' + st.blockedUntil + ' 까지 로그인하지 않음');
      return fake(429, { code: 'MF_PAUSED', message: '매쓰플랫 로그인 멈춤(' + (st.reason || '') + ') ~' + st.blockedUntil });
    }
    if (st.body && st.body.accessToken && st.at && t - Date.parse(st.at) < REUSE_MS) {
      log('최근 열쇠 같이 씀 (' + Math.round((t - Date.parse(st.at)) / 1000) + '초 전 로그인)');
      return fake(200, st.body);
    }
    const last = st.lastLoginAt ? Date.parse(st.lastLoginAt) : 0;
    if (last && t - last < GAP_MS) { const w = Math.min(MAX_WAIT, GAP_MS - (t - last)); log('로그인 간격 ' + Math.round(w / 1000) + '초 기다림'); await sleep(w); }
    st = await read(); st.lastLoginAt = new Date(now()).toISOString(); st.logins = (st.logins || 0) + 1; await write(st);
    const res = await realFetch(url, init);
    let body = null; try { body = await res.clone().json(); } catch (e) { body = null; }
    if (body && BLOCK_CODES.indexOf(body.code) >= 0) {
      const until = new Date(now() + PAUSE_MS).toISOString();
      st = await read(); Object.assign(st, { blockedUntil: until, reason: body.code, blockedAt: new Date(now()).toISOString(), body: null, at: null }); await write(st);
      log('⛔ ' + body.code + ' — ' + until + ' 까지 모든 작업 로그인 멈춤');
    } else if (res.ok && body && body.accessToken) {
      st = await read(); Object.assign(st, { body, at: new Date(now()).toISOString(), blockedUntil: null, reason: '' }); await write(st);
    }
    return res;
  }
  return { guarded, read, write };
}
module.exports = { make, KEY };

/* --require 로 불렸을 때: 전역 fetch 감싸기 */
if (require.main !== module && typeof globalThis.fetch === 'function' && !globalThis.__mfLoginGuard) {
  const g = make(globalThis.fetch.bind(globalThis));
  globalThis.__mfLoginGuard = true;
  globalThis.fetch = (u, i) => g.guarded(u, i);
}

/* 직접 실행: 상태 보기 · 풀기 · 멈추기 */
if (require.main === module) {
  (async () => {
    const g = make(globalThis.fetch.bind(globalThis));
    const a = process.argv.slice(2), st = await g.read();
    const show = (s) => console.log(JSON.stringify({ blockedUntil: s.blockedUntil || null, reason: s.reason || '', blockedAt: s.blockedAt || null, lastLoginAt: s.lastLoginAt || null, logins: s.logins || 0, tokenAt: s.at || null }, null, 1));
    if (a[0] === '--clear') { Object.assign(st, { blockedUntil: null, reason: '', body: null, at: null }); await g.write(st); console.log('풀었음'); }
    else if (a[0] === '--pause') { const h = parseFloat(a[1] || '3'); Object.assign(st, { blockedUntil: new Date(Date.now() + h * 3600000).toISOString(), reason: 'MANUAL', body: null, at: null }); await g.write(st); console.log(h + '시간 멈춤'); }
    show(st.blockedUntil !== undefined || a.length ? await g.read() : st);
  })();
}
