#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📄 매쓰플랫 학습지 한 장의 문항을 받아 온다 (읽기 전용, 저장 안 함)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 왜 — 기출 해설집을 만들 때 문항별 <b>문제·정답·풀이 그림 주소</b>와 정답·유형·난도가
 *      필요하다. 수학비서 기출 DB에는 정답·단원만 있고 그림은 회원 전용(403)이라
 *      쓸 수 없다. 같은 시험지가 매쓰플랫에 학습지로 올라와 있으면 이쪽에서 받는다.
 *      (exam_ws_map 의 시험지마다 worksheetId 가 적혀 있다)
 *
 * 사용법
 *   node sync/ws_problems_fetch.js --ws 81039534
 *   node sync/ws_problems_fetch.js --exam 387569      # exam_ws_map 에서 worksheetId 를 찾는다
 *
 * 결과: sync/_debug/ws_<번호>.json  (⚠️ _debug 는 .gitignore — 커밋 금지)
 *   { id, title, chapter, problems:[{ no, problemId, answer, type, optionCount,
 *                                     level, concept, pimg, aimg, simg }] }
 *   ⚠️ 그림 파일은 받지 않는다 — 주소만 적는다.
 *
 * 환경변수: MATHFLAT_ID · MATHFLAT_PASSWORD (그리고 --exam 은 SUPABASE_*)
 * ⚠️ 매쓰플랫은 동시 로그인 시 기존 접속이 끊긴다 — 새벽에 쓰는 것이 좋다.
 */
const fs = require('fs');
const path = require('path');

const API = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';
const OUT_DIR = path.join(__dirname, '_debug');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const WS = arg('ws', null);
const EXAM = arg('exam', null);

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
let TOKEN = null;
const H = () => ({ accept: 'application/json', authorization: `Bearer ${TOKEN}`,
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' });

async function login() {
  const id = process.env.MATHFLAT_ID, pw = process.env.MATHFLAT_PASSWORD;
  if (!id || !pw) throw new Error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 없습니다');
  const r = await fetch(`${API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB',
      'x-freewheelin-host': 'mathflat.com', origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' },
    body: JSON.stringify({ id: id.trim(), password: pw.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error(`로그인 실패: ${j.code || r.status}`);
  TOKEN = j.accessToken;
  log(`로그인 성공 · 학원 ${j.academyId}`);
}
async function api(p) {
  const r = await fetch(`${API}${p}`, { headers: H() });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  if (!r.ok) throw new Error(`${r.status} @ ${p}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}

(async () => {
  let wsId = WS;
  if (!wsId && EXAM) {
    const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), K = process.env.SUPABASE_SERVICE_KEY;
    const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.exam_ws_map&select=value`, { headers: { apikey: K, authorization: 'Bearer ' + K } });
    let v = (await r.json())[0].value; if (typeof v === 'string') v = JSON.parse(v);
    const e = (v.exams || v)[String(EXAM)];
    if (!e || !e.worksheetId) throw new Error(`exam_ws_map 에 ${EXAM} 의 worksheetId 가 없습니다`);
    wsId = e.worksheetId;
    log(`시험지 ${EXAM} → 학습지 ${wsId} (${e.worksheetTitle || ''})`);
  }
  if (!wsId) throw new Error('--ws <학습지번호> 또는 --exam <시험지번호> 를 지정하세요');

  await login();
  const head = await api(`/worksheet/${wsId}`);
  const d = await api(`/worksheet/${wsId}/problem?size=300`);
  const rows = (d && d.content) || [];
  const problems = rows.map((c, i) => {
    const p = c.problem || c;
    return {
      no: i + 1, problemId: p.id, wpId: c.worksheetProblemId || p.id,
      answer: p.answer != null ? String(p.answer) : '',
      type: p.type || '', optionCount: p.optionCount || 0,
      level: p.level || null, concept: p.conceptName || '',
      answerRate: p.problemSummary ? p.problemSummary.answerRate : null,
      pimg: p.problemImageUrl || '', aimg: p.answerImageUrl || '', simg: p.solutionImageUrl || '',
    };
  });
  const out = { id: Number(wsId), title: head.title || '', chapter: head.chapter || '',
    grade: head.grade || '', problemCount: problems.length, fetched: new Date().toISOString(), problems };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const f = path.join(OUT_DIR, `ws_${wsId}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  log(`「${out.title}」 ${problems.length}문항 · 그림 있는 것 ${problems.filter((x) => x.pimg).length}`);
  log(`저장: ${f}`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
