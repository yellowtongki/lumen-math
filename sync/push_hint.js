/* ═══════════════════════════════════════════════════════════════════
 * 💡 선생님 힌트 알림  v1   (원장 결정 2026-09-27 「즉시 1회, 밤 9시 묶음에 한 줄」)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나】
 *   ① 즉시 알림 — 학원앱에서 힌트를 「발송」하면 lumen_store push_hint_queue 에
 *      {id(노트), code(학생코드), src(교재·번호), at, status:'pending'} 이 쌓인다.
 *      5분마다 도는 워커가 이 파일을 불러, 학생마다 한 번씩 폰 알림을 보낸다
 *      (같은 5분 안에 노트 여러 개면 「힌트 2개」로 묶는다). 보낸 것은 'sent',
 *      그 학생이 알림을 안 켰으면 'nosub' 로 표시한다 — 학원앱이 이 표시를 본다.
 *   ② 밤 9시 묶음 — 하루 한 번, 발송된 지 1시간이 지났는데 아직 안 본 힌트가 있는
 *      학생에게 「💡 아직 안 본 힌트 n개」. 🔥 버프 밤 9시 알림을 받는 학생은
 *      그 알림에 한 줄만 더해지고(push_boost.js) 여기서는 건너뛴다(같은 밤에 두 번 안 울리게).
 *
 * 【읽는 것】 push_hint_queue · aha_hints(byId: 힌트) · aha_hint_seen_<코드>(학생앱이 적는 읽음) ·
 *   aha_notes(힌트 노트의 학생코드·상태, id 몇십 개만) · push_boost(오늘 버프 알림 받은 학생)
 * 【적는 것】 push_hint_queue(상태 갱신·14일 지난 것 정리) · push_hint = { night:'YYYY-MM-DD', sent }
 *
 * 【개인정보】 학생 이름은 서버 로그·알림 본문에 넣지 않는다 (공개 저장소의 Actions 로그).
 */

const { push } = require('./push.js');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const log = (...a) => console.log('[힌트알림]', ...a);

const HOUR = Number(process.env.HINT_PUSH_HOUR || 21);   // 밤 9시(한국)
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry');
const STUDENT_URL = './student_v1.html#aha';

const kstNow = () => new Date(Date.now() + 9 * 3600000);
const kstDay = () => kstNow().toISOString().slice(0, 10);

async function kvGet(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
async function kvSet(key, value) {
  await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
}

/* 학생 한 명에게 (알림을 켠 폰이 있으면) */
function toStudent(code) {
  return (s) => s.role !== 'owner' && String(s.code || '') === String(code);
}

/* ── ① 즉시 알림: 큐에 쌓인 요청 ── */
async function sendQueued() {
  const q = (await kvGet('push_hint_queue')) || {};
  const list = Array.isArray(q.list) ? q.list : [];
  const pending = list.filter((x) => x && x.status === 'pending' && x.code);
  if (!pending.length) return { list, changed: false };

  const byCode = {};
  pending.forEach((x) => { (byCode[x.code] = byCode[x.code] || []).push(x); });
  let sent = 0, nosub = 0;
  for (const code of Object.keys(byCode)) {
    const items = byCode[code];
    const first = items[0];
    const n = items.length;
    const src = String(first.src || '문제');
    const title = n === 1 ? '💡 선생님 힌트 도착' : `💡 선생님 힌트 ${n}개 도착`;
    const body = n === 1
      ? `${src}에 힌트가 왔어요. 정답 대신 힌트로 다시 풀어 보자! (힌트 보고 풀면 +2점)`
      : `${src} 외 ${n - 1}건에 힌트가 왔어요. 정답 대신 힌트로 다시 풀어 보자! (힌트 보고 풀면 +2점)`;
    let res = { sent: 0 };
    if (DRY) log(`(안 보냄) ${code}: ${title} / ${body}`);
    else res = await push({ kind: 'hint', tag: 'hint-' + code, title, body, url: STUDENT_URL }, toStudent(code));
    const now = new Date().toISOString();
    items.forEach((x) => { x.status = res.sent ? 'sent' : 'nosub'; x.doneAt = now; x.n = res.sent || 0; });
    if (res.sent) sent++; else nosub++;
  }
  log(`즉시 알림 — 학생 ${Object.keys(byCode).length}명 (보냄 ${sent} · 알림 안 켬 ${nosub}) · 노트 ${pending.length}건`);
  return { list, changed: true };
}

/* 14일 지난 항목은 지운다 (큐가 끝없이 자라지 않게) */
function trimQueue(list) {
  const cut = Date.now() - 14 * 864e5;
  const keep = list.filter((x) => x && Date.parse(x.at || 0) > cut);
  return { keep, changed: keep.length !== list.length };
}

/* ── 아직 안 본 힌트: { 학생코드: n } ──
 * 힌트(aha_hints)엔 학생코드가 없어 노트(aha_notes)에서 코드·상태를 읽는다.
 * 학원앱 v19-51부터는 발송 때 rec.code 를 같이 적으므로 그 뒤 것은 조회가 필요 없다. */
async function unseenHints(opt) {
  opt = opt || {};
  const minAge = opt.minAgeMs == null ? 3600000 : opt.minAgeMs;   // 발송 1시간 뒤부터 「안 봄」으로 센다
  const hints = (await kvGet('aha_hints')) || {};
  const by = hints.byId || {};
  const now = Date.now();
  const cands = [];   // {id, code?}
  Object.keys(by).forEach((id) => {
    const r = by[id];
    if (!r || r.status !== 'sent' || !Array.isArray(r.h) || r.h.length < 3) return;
    const t = Date.parse(r.sentAt || r.at || 0);
    if (!t || now - t < minAge || now - t > 30 * 864e5) return;   // 30일 지난 건 잊는다
    cands.push({ id: String(id), code: r.code ? String(r.code) : '' });
  });
  if (!cands.length) return {};

  /* 코드 없는 것(옛 발송)은 노트에서 읽는다 — 해결된 노트는 뺀다 */
  const need = cands.filter((c) => !c.code).map((c) => c.id);
  const status = {};
  const ids = cands.map((c) => c.id);
  try {
    const url = `${SB_URL}/rest/v1/aha_notes?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,student_code,status`;
    const r = await fetch(url, { headers: sbH() });
    if (r.ok) (await r.json()).forEach((n) => {
      status[String(n.id)] = n.status || 'pending';
      const c = cands.find((x) => x.id === String(n.id));
      if (c && !c.code) c.code = String(n.student_code || '');
    });
  } catch (e) { log('노트 조회 실패(코드 없는 힌트 ' + need.length + '건은 건너뜀):', e.message); }

  /* 학생별 읽음 기록 */
  const seen = {};   // code -> {id: at}
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.aha_hint_seen_*&select=key,value`, { headers: sbH() });
    if (r.ok) (await r.json()).forEach((row) => {
      const code = String(row.key).replace('aha_hint_seen_', '');
      let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      seen[code] = (v && v.seen) || {};
    });
  } catch (e) { log('읽음 기록 조회 실패:', e.message); }

  const out = {};
  cands.forEach((c) => {
    if (!c.code) return;
    if (status[c.id] && status[c.id] !== 'pending') return;   // 해결된 노트
    if (seen[c.code] && seen[c.code][c.id]) return;
    out[c.code] = (out[c.code] || 0) + 1;
  });
  return out;
}

/* ── ② 밤 9시 묶음 ── */
async function sendNightly() {
  const now = kstNow(), day = kstDay();
  if (!FORCE && now.getUTCHours() !== HOUR) return;
  const state = (await kvGet('push_hint')) || {};
  if (!FORCE && state.night === day) return;

  const unseen = await unseenHints();
  const boost = (await kvGet('push_boost')) || {};
  const boosted = (boost.day === day && Array.isArray(boost.codes)) ? boost.codes.map(String) : [];
  let sent = 0, skipped = 0, target = 0;
  for (const code of Object.keys(unseen)) {
    const n = unseen[code];
    if (!n) continue;
    target++;
    if (boosted.indexOf(code) >= 0) { skipped++; continue; }   // 버프 알림에 한 줄로 이미 들어갔다
    const title = `💡 아직 안 본 힌트 ${n}개`;
    const body = '선생님이 보낸 힌트가 기다리고 있어요. 정답 대신 힌트로 다시 풀어 보자! (힌트 보고 풀면 +2점)';
    if (DRY) { log(`(안 보냄) ${code}: ${title}`); continue; }
    const res = await push({ kind: 'hint', tag: 'hint-night-' + day, title, body, url: STUDENT_URL }, toStudent(code));
    sent += res.sent ? 1 : 0;
  }
  log(`밤 ${HOUR}시 묶음 — 안 본 힌트 있는 학생 ${target}명 · 보냄 ${sent} · 버프 알림에 합침 ${skipped}`);
  if (!DRY) await kvSet('push_hint', { ...state, night: day, at: new Date().toISOString(), sent, target });
}

/* ── 워커가 부르는 입구 ── */
async function runPushHint() {
  if (!process.env.VAPID_PRIVATE_KEY && !DRY) return;
  try {
    const { list, changed } = await sendQueued();
    const t = trimQueue(list);
    if ((changed || t.changed) && !DRY) await kvSet('push_hint_queue', { list: t.keep, upd: new Date().toISOString() });
  } catch (e) { log('즉시 알림 오류:', e.message); }
  try { await sendNightly(); } catch (e) { log('밤 묶음 오류:', e.message); }
}

module.exports = { runPushHint, unseenHints, sendQueued, sendNightly, trimQueue };

if (require.main === module) {
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  runPushHint().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
