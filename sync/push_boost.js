/* ═══════════════════════════════════════════════════════════════════
 * 🔥 추가 버프 — 밤 9시 알림  v1   (원장 결정 2026-09-22, docs/race_boost_contract.md §6)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나】
 *   추가 버프가 켜져 있는 동안 <b>하루 한 번, 밤 9시</b>에 학생 폰으로 알림을 보낸다.
 *     · 그날 플래너를 아직 안 올린 학생 → 「버프가 ○시간 남았어요」
 *     · 이미 올린 학생               → 그날 들어간 피해와 보스 남은 체력
 *   버프가 꺼지거나 시즌이 끝나면 <b>저절로 멈춘다</b>.
 *
 * 【서버에 부담을 주지 않으려고】 (docs/incident_2026-09-18_supabase.md)
 *   5분마다 도는 워커가 부르지만, 맨 먼저 <b>시각과 「오늘 이미 보냈나」만</b> 본다.
 *   9시가 아니거나 이미 보냈으면 작은 조회 한 번으로 끝난다.
 *   보내는 날에도 읽는 것은 race_board · raid_board · 레이드에 낀 학생의 플래너뿐이다.
 *   (학생 등록부처럼 큰 것은 읽지 않는다 — raid_board 에 학생코드가 이미 들어 있다)
 *
 * 【마지막 확인 지점】
 *   push_boost = { day:'YYYY-MM-DD', at:'보낸 시각', sent:보낸 수 }
 */

const { push } = require('./push.js');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const log = (...a) => console.log(`[버프알림]`, ...a);

const HOUR = Number(process.env.BOOST_PUSH_HOUR || 21);   // 한국 시각(시). 시험 때는 바꿔 쓴다
const FORCE = process.argv.includes('--force');           // 시각을 무시하고 한 번 보낸다(시험용)
const DRY = process.argv.includes('--dry');               // 보내지 않고 누구에게 뭐라고 갈지만 찍는다

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
const num = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/* 플래너 날짜 키를 YYYY-MM-DD 로 (엔진 planDay 와 같은 규칙) */
const planDay = (k) => {
  const m = String(k || '').match(/^\s*(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : null;
};

async function runBoostPush() {
  const now = kstNow(), day = kstDay();

  /* ① 가장 싼 확인부터 — 시각 */
  if (!FORCE && now.getUTCHours() !== HOUR) return;

  /* ② 오늘 이미 보냈나 */
  const state = (await kvGet('push_boost')) || {};
  if (!FORCE && state.day === day) return;

  /* ③ 버프가 켜져 있나 */
  const board = await kvGet('race_board');
  const bz = board && board.buff && board.buff.boost;
  if (!bz || !bz.on) { log('추가 버프가 꺼져 있습니다 — 보내지 않습니다'); return; }
  if (board.ended) { log('시즌이 끝났습니다 — 보내지 않습니다'); return; }
  if (bz.from && day < String(bz.from)) { log(`아직 시작일(${bz.from}) 전입니다`); return; }

  const flat = Number(bz.flat) || 1, mx = Number(bz.max) || 0.4;
  const top = flat * (1 + mx);
  const dleft = Math.max(0, Number(bz.dday) || 0) + 1;     // 오늘 포함 남은 날

  /* ④ 레이드 상태 */
  const raid = await kvGet('raid_board');
  const raids = (raid && raid.on && Array.isArray(raid.list)) ? raid.list : [];
  const ofCode = {};   // 학생코드 → 그 학생이 낀 레이드
  raids.forEach((r) => (r.rows || []).forEach((x) => { if (x && x.code && !ofCode[x.code]) ofCode[x.code] = r; }));
  const codes = Object.keys(ofCode);
  if (!codes.length) { log('레이드에 낀 학생이 없습니다'); return; }

  /* ⑤ 오늘 플래너를 올렸나 — 레이드에 낀 학생 것만 읽는다 */
  const done = {};
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.student_planner_*&select=key,value`, { headers: sbH() });
    if (r.ok) {
      for (const row of await r.json()) {
        const code = String(row.key).replace('student_planner_', '');
        if (!ofCode[code]) continue;
        let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
        const sc = (v && v.scores) || {};
        for (const k of Object.keys(sc)) {
          if (planDay(k) === day && Number(sc[k]) > 0) { done[code] = Number(sc[k]); break; }
        }
      }
    }
  } catch (e) { log('플래너 확인 실패(모두 미제출로 봅니다):', e.message); }

  /* ⑥ 학생마다 문구를 만들어 보낸다 */
  const hoursLeft = Math.max(1, 24 - now.getUTCHours());   // 자정까지 남은 시간
  let sent = 0, skipped = 0;
  for (const code of codes) {
    const r = ofCode[code];
    const left = Math.max(0, (Number(r.hp) || 0) - (Number(r.dealt) || 0));
    const cleared = !!r.cleared || left <= 0;
    let title, body;
    if (done[code]) {
      title = cleared ? '🎉 보스를 부쉈어요!' : `🛡️ 보스 체력 ${num(left)} 남음`;
      body = cleared
        ? `오늘 플래너도 올렸네요 (${done[code]}점). 버프는 ${dleft}일 더 갑니다 — 지금 푸는 문제도 ×${flat.toFixed(1)}이에요.`
        : `오늘 플래너 ${done[code]}점 올렸어요 — 오늘 푼 문제는 최대 ×${top.toFixed(1)}로 들어갑니다. 남은 ${dleft}일, 할 수 있어요!`;
    } else {
      title = `🔥 버프가 ${hoursLeft}시간 남았어요`;
      body = cleared
        ? `오늘 플래너를 올리면 오늘 푼 문제가 최대 ×${top.toFixed(1)}이 됩니다.`
        : `플래너를 올리면 오늘 푼 문제가 최대 ×${top.toFixed(1)}이 돼요. 보스 체력 ${num(left)} 남음 · 남은 ${dleft}일.`;
    }
    if (DRY) { log(`(안 보냄) ${code}: ${title} / ${body}`); skipped++; continue; }
    const res = await push({ title, body, kind: 'boost', url: './student_v1.html', tag: 'boost-' + day },
      (s) => s.role !== 'owner' && String(s.code || '') === code);
    sent += res.sent;
  }
  log(`밤 ${HOUR}시 알림 — ${sent}건 보냄${skipped ? ` (미리보기 ${skipped}건)` : ''} · 대상 학생 ${codes.length}명 · 플래너 올린 학생 ${Object.keys(done).length}명`);
  if (!DRY) await kvSet('push_boost', { day, at: new Date().toISOString(), sent, students: codes.length });
}

module.exports = { runBoostPush };

if (require.main === module) {
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  runBoostPush().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
