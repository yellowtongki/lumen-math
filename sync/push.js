/* ═══════════════════════════════════════════════════════════════════
 * 루멘수학 알림 보내는 담당  v1
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【이게 뭔가요?】
 *   5분마다 도는 워커가 이 파일을 써서 폰으로 알림을 보냅니다.
 *   새 프로그램을 깔지 않아도 되도록, Node에 원래 들어 있는 기능만 씁니다
 *   (워커는 지금도 추가 설치 없이 도는데, 그 원칙을 지켰습니다).
 *
 * 【보내는 방법】
 *   신호에 내용을 실어 보내지 않고, ① Supabase에 «이 사람 앞으로 온 알림»을
 *   적어 두고 ② 「알림 왔다」는 빈 신호만 폰에 보냅니다. 폰의 sw.js가 깨어나
 *   적어둔 내용을 읽어 띄웁니다. 내용을 실어 보내려면 암호화 과정이 필요한데,
 *   그 과정 전체가 빠져서 훨씬 단순하고 고장 날 곳이 적습니다.
 *
 * 【열쇠】
 *   공개키는 앱에 그대로 들어갑니다(공개돼도 안전한 종류입니다).
 *   개인키는 GitHub Secrets의 VAPID_PRIVATE_KEY에만 있고, 저장소에는 없습니다.
 */

const crypto = require('crypto');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const VAPID_PUBLIC = 'BHi5DiYIQjSC8Nknpcrrb7pgYtFBfEGSRvB4Rh8lgve8vwCcsd09v7rLqkR9L_m43LUA936QxojfgMScB_RyuDs';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = 'mailto:yellowtongki@gmail.com';

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/* 구독 주소 → 짧은 아이디 (sw.js와 규칙이 같아야 합니다) */
function subIdOf(endpoint) {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

/* ── VAPID 신분증(JWT) 만들기 ──
 * 푸시 서비스(구글·애플)에 «이 알림은 루멘수학이 보낸 게 맞다»를 증명합니다.
 * 보내는 주소(origin)마다 따로 만들어야 하고, 12시간 동안 유효합니다. */
function vapidToken(endpoint) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  }));
  const raw = unb64u(VAPID_PUBLIC);               // 0x04 || x(32) || y(32)
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE, x: b64u(raw.slice(1, 33)), y: b64u(raw.slice(33, 65)) },
    format: 'jwk',
  });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

/* ── 구독 목록 읽기 ──
 * push_subs = { 짧은아이디: {endpoint, role, code, name, at, ua, off:{...}} } */
async function loadSubs() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.push_subs&select=value`, { headers: sbH() });
    if (!r.ok) return {};
    const j = await r.json();
    let v = (j[0] && j[0].value) || {};
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    return (v && typeof v === 'object') ? v : {};
  } catch (e) { return {}; }
}

async function saveSubs(subs) {
  try {
    await fetch(`${SB_URL}/rest/v1/lumen_store`, {
      method: 'POST',
      headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: 'push_subs', value: subs, updated_at: new Date().toISOString() }),
    });
  } catch (e) {}
}

async function storeSet(key, value) {
  await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

/* ── 알림 한 건 보내기 ──
 * 성공하면 true. 구독이 죽었으면(폰에서 앱을 지웠거나 알림을 껐거나) 'gone'.  */
async function sendTo(sub, msg) {
  if (!sub || !sub.endpoint) return false;
  const id = subIdOf(sub.endpoint);
  // ① 내용을 먼저 적어 둔다 (폰이 이걸 읽어 띄운다)
  await storeSet('push_inbox_' + id, {
    title: msg.title, body: msg.body || '', url: msg.url || './lumen_v1.html',
    tag: msg.tag || 'lumen', at: new Date().toISOString(),
  });
  // ② 「알림 왔다」 빈 신호만 보낸다
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400',                                   // 폰이 꺼져 있으면 하루까지 기다렸다 전달
        Urgency: msg.urgency || 'normal',
        Authorization: `vapid t=${vapidToken(sub.endpoint)}, k=${VAPID_PUBLIC}`,
        'Content-Length': '0',
      },
    });
    if (res.status === 404 || res.status === 410) return 'gone';   // 더 이상 없는 구독
    return res.ok || res.status === 201;
  } catch (e) {
    return false;
  }
}

/* ── 여러 명에게 보내기 ──
 * pick(sub) 가 true인 구독에만 보냅니다. 죽은 구독은 목록에서 자동으로 지웁니다. */
async function push(msg, pick) {
  if (!VAPID_PRIVATE) { console.log('[알림] VAPID_PRIVATE_KEY가 없어 발송을 건너뜁니다'); return { sent: 0, gone: 0 }; }
  const subs = await loadSubs();
  const ids = Object.keys(subs).filter((id) => {
    const s = subs[id];
    if (!s || !s.endpoint) return false;
    if (msg.kind && s.off && s.off[msg.kind]) return false;   // 이 종류를 꺼 둔 사람은 제외
    return pick ? pick(s) : true;
  });
  let sent = 0, gone = 0, dirty = false;
  for (const id of ids) {
    const r = await sendTo(subs[id], msg);
    if (r === 'gone') { delete subs[id]; gone++; dirty = true; }
    else if (r) sent++;
  }
  if (dirty) await saveSubs(subs);
  return { sent, gone };
}

/* 원장님(학원앱)에게만 */
const pushOwner = (msg) => push({ ...msg, url: msg.url || './lumen_v1.html' }, (s) => s.role === 'owner');

module.exports = { push, pushOwner, loadSubs, saveSubs, subIdOf, vapidToken, VAPID_PUBLIC };
