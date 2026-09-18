#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 학습지 «정답 대장» 만들기 — 수학비서 원본 → lumen_store        (2026-09-17 원장님 지시)
 * ═══════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   매쓰플랫은 «객관식만» 자동채점한다(단답은 답이 숫자 하나여도 채점하지 않는다 — 실측).
 *   그래서 수학비서에서 올린 학습지는 108문항 중 31문항만 매쓰플랫이 채점할 수 있다.
 *   나머지는 «루멘 학생앱이 채점»한다. 그러려면 답을 칸 단위로 정확히 알아야 하는데,
 *   매쓰플랫에 들어간 답은 여러 칸을 쉼표로 이어 붙인 한 줄이라 칸 수·유형·단위가 사라진다.
 *   수학비서 원본에는 칸마다 유형(참거짓·정수·단답·수식)과 정답 그림까지 있다 — 그것을 옮겨 둔다.
 *
 * 저장: lumen_store 키 `mf_wsans_<학습지id>`
 *   { wid, title, msPaperId, n, updated, source:'mathsecr',
 *     items:[ { no, cnt, kind, parts:[{seq,t,v,tex,disp,img}], shape, self, unit, gradable } ] }
 *   ※ 학생 이름·성적은 들어가지 않는다 (문제지 정답만).
 *
 * 쓰는 법
 *   node sync/mf_answerkey.js                 … 올린 기록(msecr_mf_state)에 있는 학습지 전부
 *   node sync/mf_answerkey.js --paper 1984215 … 그 수학비서 문제지만
 *   node sync/mf_answerkey.js --paper 1984215 --ws 82557472   … 학습지를 직접 지정
 *   --dry 는 저장하지 않고 무엇이 만들어지는지만 보여 준다
 *
 * 계정: 환경변수 MATHSECR_ID/PASSWORD · MATHFLAT_ID/PASSWORD · SUPABASE_URL/SERVICE_KEY
 * ═══════════════════════════════════════════════════════════════════ */

const path = require('path');
const HWGrade = require(path.join(__dirname, 'hw_grade_engine.js'));

const MS_API = 'https://api.mathsecr.com', MS_ORIGIN = 'https://mathsecr.com';
const MF_API = 'https://api.mathflat.com', MF_BASE = 'https://teacher.mathflat.com';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const STATE_KEY = 'msecr_mf_state';

let MS_TOKEN = '', MF_TOKEN = '';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
const msH = () => ({ 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: 'Bearer ' + MS_TOKEN });
const mfH = () => ({ 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_BASE, referer: MF_BASE + '/', ...(MF_TOKEN ? { authorization: 'Bearer ' + MF_TOKEN } : {}) });

/* ── 로그인 ── */
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }) });
  const j = await r.json();
  MS_TOKEN = j.data ? j.data.accessToken : j.accessToken;
  if (!MS_TOKEN) throw new Error('수학비서 로그인 실패');
}
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST', headers: mfH(),
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
async function msGet(p, _retried) {
  const r = await fetch(MS_API + p, { headers: msH() });
  if (r.status === 401 && !_retried) { await msLogin(); return msGet(p, true); }
  const t = await r.text();
  if (!r.ok) throw new Error(`수학비서 GET ${p} → ${r.status} ${t.slice(0, 160)}`);
  return JSON.parse(t);
}
async function mfGet(p, _retried) {
  const r = await fetch(MF_API + p, { headers: mfH() });
  if (r.status === 401 && !_retried) { await mfLogin(); return mfGet(p, true); }
  const t = await r.text();
  if (!r.ok) throw new Error(`매쓰플랫 GET ${p} → ${r.status} ${t.slice(0, 160)}`);
  const j = JSON.parse(t);
  return j && j.data !== undefined ? j.data : j;
}

/* ── lumen_store ── */
async function kvGet(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  if (!r.ok) return null;
  const j = await r.json();
  let v = j[0] ? j[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} }
  return v;
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store`, { method: 'POST',
    headers: { ...sbH(), prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
  if (!r.ok) throw new Error(`저장 실패 ${key} ${r.status}`);
}

/* ── 수학비서 문항 ── */
async function msCells(paperId) {
  const cells = []; let cursor = '';
  for (let i = 0; i < 40; i++) {
    const j = await msGet(`/bms/api/v1/my-papers/${paperId}/cells?limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const d = j.data || {};
    (d.cells || []).forEach((c) => cells.push(c));
    (d.pages || []).forEach((pg) => (pg.cells || []).forEach((c) => cells.push(c)));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return cells.sort((a, b) => a.questionNumber - b.questionNumber);
}

/* ── 답 한 칸을 대장 모양으로 ──────────────────────────────────
 * 수학비서 answers[] : { seq, type, answer:[...], latex, display, imagePath }
 *   type: single_choice · multiple_choice · boolean_choice · integer_answer · short_answer · latex_answer
 *   display: boolean_choice 일 때 'O/X' 처럼 무엇으로 답하는지
 *   imagePath: 그 칸의 «정답 그림» (자기채점 문항에서 학생에게 보여 준다) */
/* 수학비서가 가끔 각도를 «\$\{50DEG\}\$» 처럼 흘려 보낸다(실측 48번) → 「50°」로 고쳐 담는다.
 * 그대로 두면 채점 엔진이 수식으로 보고 자기채점으로 넘겨 버린다. */
function fixDeg(s) {
  return String(s == null ? '' : s).replace(/\\?\$\s*\\?\{\s*(-?\d+(?:\.\d+)?)\s*DEG\s*\\?\}\s*\\?\$/gi, '$1°');
}
function partOf(a) {
  const raw = Array.isArray(a.answer) ? a.answer.join(', ') : String(a.answer == null ? '' : a.answer);
  const val = fixDeg(raw);
  return {
    seq: Number(a.seq || 0) || 0,
    t: String(a.type || ''),
    v: val,
    tex: fixDeg(a.latex),
    ...(a.display ? { disp: String(a.display) } : {}),
    ...(a.imagePath ? { img: String(a.imagePath) } : {}),
  };
}
/* 참거짓 답을 학생이 보는 말로 — False→X, True→O */
function oxOf(v) {
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'o' || s === '○') return 'O';
  if (s === 'false' || s === 'x' || s === '×') return 'X';
  return String(v).trim();
}

/* 문항 하나 → 대장 항목 */
function itemOf(cell) {
  const parts = (cell.answers || []).map(partOf).sort((a, b) => a.seq - b.seq);
  const types = parts.map((p) => p.t);
  const allOx = parts.length > 0 && types.every((t) => t === 'boolean_choice');
  const allChoice = parts.length > 0 && types.every((t) => /^(single_choice|multiple_choice)$/.test(t));
  const allNum = parts.length > 0 && types.every((t) => t === 'integer_answer');
  let kind = 'mixed';
  if (allChoice) kind = 'choice';
  else if (allOx) kind = 'ox';
  else if (allNum) kind = 'num';
  else if (parts.length === 1) kind = types[0] === 'short_answer' ? 'text' : 'latex';

  /* 참거짓은 O/X 로 바꿔 담는다 — 학생앱이 그대로 단추로 쓴다 */
  if (allOx) parts.forEach((p) => { p.v = oxOf(p.v); });

  /* 루멘 채점 엔진이 이 답을 어떻게 볼지 미리 계산해 둔다 (앱은 이 값을 믿고 그린다) */
  const objective = allChoice;
  const joined = parts.map((p) => p.v).join(', ');
  let sh = { shape: 'free', self: true, gradable: false, unit: '' };
  try {
    sh = HWGrade.shapeOf({ type: objective ? (types.includes('multiple_choice') ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE') : 'SHORT_ANSWER',
      answer: joined, objective, cnt: parts.length, units: [] }) || sh;
  } catch (e) {}
  /* 참거짓·객관식은 엔진 판정과 상관없이 «반드시» 자동채점된다 (단추로 받기 때문) */
  const forced = allOx || allChoice;
  return {
    no: Number(cell.questionNumber),
    cnt: parts.length,
    kind,
    parts,
    shape: allOx ? 'ox' : (allChoice ? 'choice' : sh.shape),
    self: forced ? false : !!sh.self,
    gradable: forced ? true : !!sh.gradable,
    ...(sh.unit ? { unit: sh.unit } : {}),
  };
}

/* ── 학습지 한 장의 대장 만들기 ── */
async function buildKey(wid, cells, from, to, msPaperId) {
  const ws = await mfGet(`/worksheet/${wid}?ignoredForDeleted=true`);
  const w = ws.worksheet || ws;
  const probs = ws.problems || w.problems || [];
  const slice = cells.filter((c) => c.questionNumber >= from && c.questionNumber <= to);
  if (!slice.length) throw new Error(`수학비서에 ${from}~${to}번이 없습니다`);
  if (probs.length !== slice.length)
    throw new Error(`문항 수가 다릅니다 — 학습지 ${probs.length} · 수학비서 ${slice.length} (${from}~${to})`);
  const items = slice.map((c, i) => {
    const it = itemOf(c);
    const p = probs[i] || {};
    it.wpIndex = i + 1;                       /* 학습지 안 순서 (배정마다 바뀌는 wpId 대신 순서로 잇는다) */
    it.pid = p.id || p.problemId || null;     /* 문제은행 문항 id — 순서가 어긋났는지 확인용 */
    it.mfType = p.type || '';
    it.mfAnswer = p.answer == null ? '' : String(p.answer);
    it.mfAuto = !!p.autoScored;
    return it;
  });
  return {
    wid: Number(wid), title: String(w.title || ''), msPaperId: Number(msPaperId) || null,
    n: items.length, range: `${from}~${to}`, updated: new Date().toISOString(), source: 'mathsecr',
    autoFlag: !!w.autoScorableFlag,
    mfAuto: items.filter((x) => x.mfAuto).length,       /* 매쓰플랫이 채점하는 문항 수 (객관식) */
    lumenAuto: items.filter((x) => x.gradable && !x.self).length,   /* 루멘이 채점할 수 있는 문항 수 */
    selfN: items.filter((x) => x.self).length,          /* 학생이 스스로 ◯✗ 하는 문항 수 */
    items,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const onlyPaper = Number(arg('paper', 0)) || 0;
  const onlyWs = Number(arg('ws', 0)) || 0;
  const dry = args.includes('--dry');
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다');

  await msLogin(); await mfLogin();
  log('로그인 OK (수학비서 · 매쓰플랫)');

  const state = (await kvGet(STATE_KEY)) || { processed: {} };
  const jobs = [];
  Object.entries(state.processed || {}).forEach(([pid, p]) => {
    if (onlyPaper && Number(pid) !== onlyPaper) return;
    const parts = (p.parts && p.parts.length) ? p.parts : (p.worksheetIds || []).map((w) => ({ worksheetId: w, range: `1~${p.n || 0}` }));
    parts.forEach((x) => {
      if (!x.worksheetId) return;
      if (onlyWs && Number(x.worksheetId) !== onlyWs) return;
      const m = String(x.range || '').match(/(\d+)~(\d+)/);
      jobs.push({ msPaperId: Number(pid), wid: Number(x.worksheetId), from: m ? Number(m[1]) : 1, to: m ? Number(m[2]) : (p.n || 9999), title: x.title || p.title });
    });
  });
  if (onlyPaper && onlyWs && !jobs.length) jobs.push({ msPaperId: onlyPaper, wid: onlyWs, from: 1, to: 9999, title: '' });
  if (!jobs.length) throw new Error('만들 학습지를 찾지 못했습니다 (--paper / --ws 로 지정해 주세요)');
  log(`대장을 만들 학습지 ${jobs.length}장`);

  const cellCache = {};
  const done = [], failed = [];
  for (const j of jobs) {
    try {
      if (!cellCache[j.msPaperId]) { cellCache[j.msPaperId] = await msCells(j.msPaperId); await sleep(150); }
      const cells = cellCache[j.msPaperId];
      const to = Math.min(j.to, cells.length ? cells[cells.length - 1].questionNumber : j.to);
      const key = await buildKey(j.wid, cells, j.from, to, j.msPaperId);
      log(`· 학습지 ${j.wid} 「${key.title}」 ${key.n}문항 — 매쓰플랫 자동채점 ${key.mfAuto} · 루멘 채점 가능 ${key.lumenAuto} · 스스로 채점 ${key.selfN}`);
      if (!dry) { await kvSet('mf_wsans_' + j.wid, key); log(`  저장: mf_wsans_${j.wid}`); }
      done.push({ wid: j.wid, n: key.n, mfAuto: key.mfAuto, lumenAuto: key.lumenAuto, selfN: key.selfN });
    } catch (e) {
      log(`· 학습지 ${j.wid} 실패 — ${e.message.slice(0, 200)}`);
      failed.push({ wid: j.wid, error: e.message.slice(0, 200) });
    }
    await sleep(200);
  }
  log(`\n═══ 끝 ═══ 성공 ${done.length} · 실패 ${failed.length}${dry ? ' (미리보기라 저장 안 함)' : ''}`);
  const sum = done.reduce((a, x) => ({ n: a.n + x.n, mf: a.mf + x.mfAuto, lu: a.lu + x.lumenAuto, se: a.se + x.selfN }), { n: 0, mf: 0, lu: 0, se: 0 });
  if (done.length) log(`전체 ${sum.n}문항 — 매쓰플랫 ${sum.mf} · 루멘 ${sum.lu} · 스스로 ${sum.se}`);
}

module.exports = { itemOf, buildKey };
if (require.main === module) main().catch((e) => { console.error('실패:', e && e.message); process.exit(1); });
