/* ═══════════════════════════════════════════════════════════════════
 * 제출을 지켜보다 원장님께 알림  v1
 * ═══════════════════════════════════════════════════════════════════
 *
 * 5분마다 도는 워커가 이 파일을 불러, 지난번 이후 새로 들어온
 *   ① 아하노트 (학생이 올린 질문·오답)
 *   ② 플래너 사진 (학생이 올린 공부 기록)
 * 이 있으면 원장님 폰으로 알림을 보냅니다.
 *
 * 【서버에 부담을 주지 않으려고 신경 쓴 점】
 *   학생 등록부(or_studentdb)는 587KB나 되어, 5분마다 통째로 읽으면
 *   하루 170MB입니다. 8월에 서버가 멈춘 원인이 바로 이런 큰 데이터를
 *   반복해서 읽은 것이었습니다.
 *   → 그래서 «언제 바뀌었는지»(updated_at)만 먼저 확인하고,
 *     실제로 바뀌었을 때만 본문을 읽습니다. 제출이 없는 대부분의 시간에는
 *     아주 작은 조회 한 번으로 끝납니다.
 *
 * 【마지막 확인 지점】
 *   push_watch = { aha: '마지막으로 본 아하노트 시각',
 *                  plUpdated: '마지막으로 본 등록부 갱신 시각',
 *                  plSet: '마지막으로 본 플래너 setId' }
 */

const { pushOwner } = require('./push.js');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const log = (...a) => console.log(`[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]`, ...a);

const STATE_KEY = 'push_watch';

async function getState() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${STATE_KEY}&select=value`, { headers: sbH() });
    if (!r.ok) return {};
    const j = await r.json();
    let v = (j[0] && j[0].value) || {};
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    return v || {};
  } catch (e) { return {}; }
}

async function setState(v) {
  await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: STATE_KEY, value: v, updated_at: new Date().toISOString() }),
  });
}

/* 여러 명이 올렸을 때 「가윤 외 2명」처럼 (이름은 원장님 폰에만 뜹니다) */
function whoText(names) {
  const u = [...new Set(names.filter(Boolean))];
  if (!u.length) return '학생';
  return u.length === 1 ? u[0] : `${u[0]} 외 ${u.length - 1}명`;
}

/* ── ① 아하노트 ── */
async function watchAha(state) {
  const since = state.aha || new Date(Date.now() - 3600 * 1000).toISOString();  // 첫 실행은 최근 1시간만
  const url = `${SB_URL}/rest/v1/aha_notes`
    + `?created_at=gt.${encodeURIComponent(since)}`
    + `&select=id,student_name,source_name,page,problem_no,created_at`
    + `&order=created_at.desc&limit=50`;
  const r = await fetch(url, { headers: sbH() });
  if (!r.ok) return state.aha;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return state.aha || since;

  const who = whoText(rows.map((x) => x.student_name));
  const first = rows[0];
  const where = [first.source_name, first.page ? first.page + '쪽' : '', first.problem_no ? first.problem_no + '번' : '']
    .filter(Boolean).join(' · ');

  await pushOwner({
    kind: 'aha',
    tag: 'lumen-aha',
    title: `💡 아하노트 ${rows.length}건`,
    body: rows.length === 1 ? `${who} — ${where || '질문을 올렸어요'}` : `${who}이 질문을 올렸어요`,
    url: './lumen_v1.html#aha',
  });
  log(`아하노트 알림: ${rows.length}건 (${who})`);
  return rows[0].created_at;
}

/* ── ② 플래너 사진 ──
 * 등록부가 언제 바뀌었는지 먼저 보고, 바뀐 경우에만 본문을 읽는다. */
async function watchPlanner(state) {
  const head = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.or_studentdb&select=updated_at`, { headers: sbH() });
  if (!head.ok) return state;
  const hj = await head.json();
  const upd = (hj[0] && hj[0].updated_at) || '';
  if (!upd || upd === state.plUpdated) return state;          // 안 바뀌었으면 여기서 끝 (거의 항상 이 경로)

  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.or_studentdb&select=value`, { headers: sbH() });
  if (!r.ok) return state;
  const j = await r.json();
  let list = (j[0] && j[0].value) || [];
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = []; } }
  if (!Array.isArray(list)) return state;

  // 지난번에 본 setId보다 뒤에 올라온 것만 (setId는 20260822_1232 형태라 문자열 비교로 시간순)
  const prev = state.plSet || '';
  let maxSet = prev;
  const fresh = [];
  list.forEach((s) => {
    if (!s || s.withdrawn) return;
    (s.lumen_planner_photos || []).forEach((p) => {
      const sid = p && p.setId ? String(p.setId) : '';
      if (!sid) return;
      if (sid > maxSet) maxSet = sid;
      if (prev && sid > prev) fresh.push({ name: s.name, setId: sid });
    });
  });

  const next = { ...state, plUpdated: upd, plSet: maxSet };
  if (!prev) { log(`플래너 기준점 설정 (${maxSet}) — 다음 제출부터 알립니다`); return next; }
  if (!fresh.length) return next;

  // 같은 학생이 사진 여러 장을 한 번에 올리므로 학생 기준으로 센다
  const who = whoText(fresh.map((x) => x.name));
  const nStu = new Set(fresh.map((x) => x.name)).size;
  await pushOwner({
    kind: 'planner',
    tag: 'lumen-planner',
    title: `📓 플래너 제출 ${nStu}명`,
    body: `${who} — 사진 ${fresh.length}장`,
    url: './lumen_v1.html#planner',
  });
  log(`플래너 알림: ${nStu}명 · 사진 ${fresh.length}장 (${who})`);
  return next;
}

/* ── ③ 하브루타 녹음 제출 (2026-08-28 원장님 요청) ──
 * 학생앱이 submissions_<학생코드>에 제출을 배열로 쌓는다. 이 행의 updated_at은
 * 갱신되지 않아 못 쓴다(실측: 8/27 제출인데 updated_at은 8/20). 대신 각 행의
 * <b>마지막 원소만</b> 뽑아(value->-1) 지난번에 본 제출 id와 비교한다.
 * 33명 전체를 훑어도 13KB라 5분마다 돌려도 부담이 없다(하루 4MB).
 * 【마지막 확인 지점】 state.rec = { 학생코드: '마지막으로 본 제출 id' } */
async function watchRec(state) {
  const url = `${SB_URL}/rest/v1/lumen_store?key=like.submissions_*&select=key,last:value-%3E-1`;
  const r = await fetch(url, { headers: sbH() });
  if (!r.ok) return state;
  const rows = await r.json();
  if (!Array.isArray(rows)) return state;

  const prev = state.rec || null;
  const seen = {};
  const fresh = [];
  rows.forEach((x) => {
    const code = String(x.key || '').replace('submissions_', '');
    const it = x.last;
    if (!code || !it || !it.id) return;
    seen[code] = String(it.id);
    // 제출 id는 20260827_1936 형태라 문자열 비교가 곧 시간순
    if (prev && String(it.id) > String(prev[code] || '')) fresh.push({ code, it });
  });

  const next = { ...state, rec: seen };
  if (!prev) { log(`녹음 제출 기준점 설정 (${rows.length}명) — 다음 제출부터 알립니다`); return next; }
  if (!fresh.length) return next;

  // 학생코드 → 이름 (mf_students가 가볍고 이름·코드를 둘 다 가진다)
  const names = {};
  try {
    const r2 = await fetch(`${SB_URL}/rest/v1/mf_students?select=name,lumen_rec_code&limit=1000`, { headers: sbH() });
    if (r2.ok) (await r2.json()).forEach((s) => { if (s.lumen_rec_code) names[s.lumen_rec_code] = s.name; });
  } catch (e) {}

  const who = whoText(fresh.map((x) => names[x.code] || x.code));
  const hasRec = fresh.some((x) => x.it.type === 'recording' || x.it.type === 'both');
  const first = fresh[0];
  await pushOwner({
    kind: 'rec',
    tag: 'lumen-rec',
    title: (hasRec ? '🎙️ 녹음 제출 ' : '📤 하브루타 제출 ') + fresh.length + '명',
    body: fresh.length === 1
      ? `${who}${first.it.title ? ' — ' + String(first.it.title).slice(0, 40) : ''}`
      : `${who}이 제출했어요`,
    url: './lumen_v1.html#submissions',
  });
  log(`녹음 제출 알림: ${fresh.length}명 (${who})`);
  return next;
}

/* ── 워커가 부르는 입구 ── */
async function runPushWatch() {
  if (!process.env.VAPID_PRIVATE_KEY) return;      // 열쇠가 아직 없으면 조용히 건너뜀
  const state = await getState();
  let next = { ...state };

  try { next.aha = await watchAha(state); } catch (e) { log('아하노트 확인 오류:', e.message); }
  try { next = await watchPlanner(next); } catch (e) { log('플래너 확인 오류:', e.message); }
  try { next = await watchRec(next); } catch (e) { log('녹음 제출 확인 오류:', e.message); }

  if (JSON.stringify(next) !== JSON.stringify(state)) await setState(next);
}

module.exports = { runPushWatch, watchAha, watchPlanner, watchRec, whoText };
