#!/usr/bin/env node
/* 「🔄 지금 가져오기」 요청 처리기 (v18-59)
 *
 * 학원앱 울트라일일의 빨간 「🔄 지금 가져오기」 버튼은 매쓰플랫 수집을 직접
 * 실행할 수 없다(수집기는 GitHub 서버에서 돈다). 대신 버튼은 Supabase
 * lumen_store 'mf_collect_req'에 요청만 남긴다:
 *
 *   { status:'requested', date:'2026-08-16', reqAt:'...', by:'app' }
 *
 * 이 스크립트를 GitHub Actions가 5분마다 실행해서:
 *   ① 대기 중인 요청이 없으면 → 아무것도 안 하고 조용히 끝낸다(대부분의 실행)
 *   ② 요청이 있으면 → status를 'running'으로 바꾸고 수집기를 돌린 뒤 'done'으로 마무리
 *
 * 앱은 30초마다 이 상태를 확인해서, 'done'이 되면 그 날짜를 다시 불러오고
 * 초안이 없는 학생만 AI 초안을 만든다(이미 있는 초안은 건드리지 않음).
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ 수집기용 매쓰플랫 계정)
 */
const { spawn } = require('child_process');
const path = require('path');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const KEY = 'mf_collect_req';
// 오래 매달린 요청을 영원히 붙잡지 않도록 하는 안전장치(분)
const STALE_MIN = 90;

if (!SB_URL || !SB_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다');
  process.exit(1);
}

const sbH = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
});
const log = (m) => console.log(`[요청처리] ${m}`);

async function getReq() {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${KEY}&select=value`, { headers: sbH() });
  if (!r.ok) throw new Error(`요청 읽기 실패 ${r.status}`);
  const rows = await r.json();
  let v = rows[0] && rows[0].value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v || null;
}

async function setReq(obj) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: KEY, value: obj }]),
  });
  if (!r.ok) log(`상태 저장 실패 ${r.status}`);
}

/* 수집기를 자식 프로세스로 실행하고, 출력은 그대로 흘려보낸다. */
function runCollector(days) {
  return new Promise((resolve) => {
    const p = spawn('node', [path.join(__dirname, 'mathflat_collector.js'), '--days', String(days)], {
      stdio: 'inherit',
      env: process.env,
    });
    p.on('close', (code) => resolve(code));
    p.on('error', (e) => { console.error('수집기 실행 실패:', e.message); resolve(1); });
  });
}

/* ═══ v18-65: 학습지 생성 요청(ws_make_req) 처리 ═══════════════════════
 * 리커버리 카드의 「🧩 학습지 만들기」가 남긴 요청을 처리한다.
 *   { status:'requested', reqAt, jobs:[{ key, name, title, conceptIds:[...],
 *     count, mfStudentId, schoolType, grade, assign }] }
 * 검증된 3단계(docs/mathflat_worksheet_api.md 확정 스펙):
 *   필터 생성 → 문제 목록 → 학습지 생성(주간 리커버리 템플릿 41988 · 이론 제외)
 */
const WS_KEY = 'ws_make_req';
const MF_API = 'https://api.mathflat.com';
const MF_WEB = 'https://teacher.mathflat.com';
// 원장님의 「주간 리커버리」 디자인 템플릿(41988) 실측값 — 녹색 · 이론(개념 박스) 제외
const WS_DESIGN = {
  layoutType: 11, layoutColor: 'GREEN', partitionType: 4,
  wrongAnswerNoteFlag: false, conceptNameFlag: false, problemTrendFlag: false,
  answerRateFlag: false, qrFlag: true, relationWorkbookFlag: true,
  includeProblemFlag: false, pdfDateType: 'TODAY', pdfDate: null,
  designTemplateId: 41988, problemPadding: 60, conceptSortType: 'CHAPTER',
};
let MF_TOKEN = null;
const mfH = () => ({
  'content-type': 'application/json', accept: 'application/json, text/plain, */*',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  authorization: `Bearer ${MF_TOKEN}`, 'x-auth-token': MF_TOKEN,
  origin: MF_WEB, referer: MF_WEB + '/',
});
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_WEB, referer: MF_WEB + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error(`매쓰플랫 로그인 실패: ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
async function mfCall(method, p, body) {
  const r = await fetch(`${MF_API}${p}`, { method, headers: mfH(), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
  const d = j && (j.data !== undefined ? j.data : j);
  if (!r.ok) throw new Error(`${r.status} ${(j && j.code) || ''} @ ${p}`);
  return d;
}
async function getWsReq() {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${WS_KEY}&select=value`, { headers: sbH() });
  if (!r.ok) return null;
  const rows = await r.json();
  let v = rows[0] && rows[0].value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v || null;
}
async function setWsReq(obj) {
  await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: WS_KEY, value: obj }]),
  });
}
/* 학생 1명 분량 학습지 생성 — 성공 시 {ok:true, worksheetId, problemN} */
async function makeOneWorksheet(job) {
  const conceptIds = (job.conceptIds || []).map(Number).filter(Boolean);
  if (!conceptIds.length) return { ok: false, why: '약점 유형 없음' };
  const count = Math.min(30, Math.max(4, Number(job.count) || 12));
  // ① 필터
  const filter = await mfCall('POST', '/worksheet/filter/concept', {
    type: 'CONCEPT', conceptIdList: conceptIds,
    excludedTopicIds: [], excludedSubTopicIds: [], problemList: null,
    problemCount: count, level: 2, levelWeight: [0, 50, 50, 0, 0],
    problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: false,
    excludePrevious: false, previousExclusionScope: null, studentIds: null,
    excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100,
    selectedConceptIdList: [], selectedLittleChapterIdList: [],
  });
  const filterId = filter.filterId || filter;
  // ② 문제 목록
  const probs = await mfCall('POST', '/worksheet/problem', { filterId });
  const list = Array.isArray(probs) ? probs : (probs.problemList || []);
  if (!list.length) return { ok: false, why: '조건에 맞는 문제 없음' };
  // ③ 생성 (+선택 배정)
  const made = await mfCall('POST', '/worksheet', {
    filterId,
    problemList: list.slice(0, count).map((p) => ({ id: p.id, tagTop: p.tagTop || null })),
    // ★ 이론(개념 박스) 제거의 핵심: 생성 body의 conceptIdList를 비운다.
    //   문제 선택은 위 필터가 이미 conceptIds로 끝냈으므로 구성에는 영향이 없고,
    //   이 값을 채워 보내면 문제 위에 「유형명 + 개념 설명 박스」가 함께 인쇄된다.
    //   (실측: 채우면 이론 있음 / 비우면 문제만 — 원장 요청은 문제만)
    conceptIdList: [], littleChapterConceptIdList: [],
    assignStudentIdList: (job.assign && job.mfStudentId) ? [job.mfStudentId] : [],
    shareScope: 'ACADEMY',
    title: job.title || `리커버리 ${job.name || ''}`.trim(),
    writer: '김정수 선생님', prefix: '취약유형', tag: 'WEAK_CONCEPT_CHIP',
    schoolType: job.schoolType || 'MIDDLE', grade: String(job.grade || '1'),
    revision: 'CURRICULUM_22',
    ...WS_DESIGN,
  });
  const worksheetId = (made && (made.id || made.worksheetId)) || made;
  return { ok: true, worksheetId, problemN: Math.min(count, list.length) };
}
async function runWsRequests() {
  const req = await getWsReq();
  if (!req || req.status !== 'requested' || !Array.isArray(req.jobs) || !req.jobs.length) return false;
  log(`학습지 생성 요청 발견 — ${req.jobs.length}건`);
  await setWsReq({ ...req, status: 'running', startedAt: new Date().toISOString(), note: '학습지 만드는 중…' });
  try { await mfLogin(); } catch (e) {
    await setWsReq({ ...req, status: 'done', ok: false, finishedAt: new Date().toISOString(), note: '매쓰플랫 로그인 실패 — 잠시 후 다시 시도해 주세요' });
    log('로그인 실패:', e.message); return true;
  }
  const results = [];
  for (const job of req.jobs) {
    try {
      const r = await makeOneWorksheet(job);
      results.push({ key: job.key, name: job.name, ...r });
      log(`  ${job.name}: ${r.ok ? `✅ id=${r.worksheetId} (${r.problemN}문항)` : `실패 — ${r.why}`}`);
    } catch (e) {
      results.push({ key: job.key, name: job.name, ok: false, why: e.message.slice(0, 80) });
      log(`  ${job.name}: 오류 — ${e.message.slice(0, 80)}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const okN = results.filter((r) => r.ok).length;
  await setWsReq({ ...req, status: 'done', ok: okN > 0, results, finishedAt: new Date().toISOString(), note: `학습지 ${okN}/${results.length}개 생성` });
  log(`학습지 생성 완료 — ${okN}/${results.length}`);
  return true;
}

/* ═══ v18-74: 교재 채점 되돌려쓰기 (hw_sync_<학생코드>) ═══════════════════
 * 학생앱이 채점한 O/X/?를 매쓰플랫에 기록한다 (계약: docs/hw_autoscore_plan.md 11-2).
 * 학생앱은 비밀번호가 없으므로 lumen_store 'hw_sync_<code>'에 대기열만 쌓는다:
 *   { items:[{ id, pid(progressId), wpId(workbookProblemId), result:'CORRECT|INCORRECT|UNKNOWN',
 *              userAnswer, at }], updated }
 * 워커가 progressId별로 묶어 PATCH /student-workbook/scoring (본문=배열 그대로) 후
 * 성공한 항목을 대기열에서 제거하고 'hw_synced_<code>'에 이력으로 남긴다.
 * 실패 항목은 남겨서 다음 실행(5분 뒤·새벽)에 재시도된다. */
async function runHwSync() {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.hw_sync_*&select=key,value`, { headers: sbH() });
  if (!r.ok) return false;
  const rows = await r.json();
  // 주의: SQL LIKE에서 _ 는 한 글자 와일드카드 → hw_sync_* 가 hw_synced_*(반영 이력)까지 잡는다.
  // 이력을 큐로 착각해 지우지 않도록 정확한 키만 남긴다.
  const queues = rows.filter((x) => /^hw_sync_[^_]+$/.test(x.key))
    .map((x) => ({ key: x.key, v: (typeof x.value === 'string' ? JSON.parse(x.value) : x.value) || {} }))
    .filter((q) => Array.isArray(q.v.items) && q.v.items.length);
  if (!queues.length) return false;

  let token = null;
  try { token = await mfLogin(); } catch (e) { log(`교재채점 반영: 매쓰플랫 로그인 실패 — ${e.message}`); return true; }
  const RES_MAP = { O: 'CORRECT', X: 'INCORRECT', '?': 'UNKNOWN' };
  let totOk = 0, totFail = 0;

  for (const q of queues) {
    const items = q.v.items;
    // progressId별로 묶어 한 번에 PATCH
    const byPid = {};
    items.forEach((it) => { (byPid[it.pid] = byPid[it.pid] || []).push(it); });
    const okIds = new Set(); const failNote = {};
    for (const pid of Object.keys(byPid)) {
      const group = byPid[pid];
      const body = group.map((it) => ({
        studentWorkbookProgressId: Number(pid),
        workbookProblemId: Number(it.wpId),
        userAnswer: it.userAnswer != null ? String(it.userAnswer) : null,
        result: RES_MAP[it.result] || it.result || 'NONE',
      }));
      try {
        const res = await mfCall('PATCH', '/student-workbook/scoring?version=v2', body);
        if (res && res.__ok !== false) { group.forEach((it) => okIds.add(it.id)); }
        else { group.forEach((it) => { failNote[it.id] = 'PATCH 실패'; }); }
      } catch (e) {
        // UNKNOWN(모름)을 서버가 거부하면 각 항목별로 한 번 더 — 안전하게 개별 처리
        let recovered = 0;
        for (const it of group) {
          try {
            await mfCall('PATCH', '/student-workbook/scoring?version=v2', [{
              studentWorkbookProgressId: Number(pid), workbookProblemId: Number(it.wpId),
              userAnswer: it.userAnswer != null ? String(it.userAnswer) : null,
              result: RES_MAP[it.result] || it.result || 'NONE',
            }]);
            okIds.add(it.id); recovered++;
          } catch (e2) { failNote[it.id] = e2.message; }
          await new Promise((z) => setTimeout(z, 120));
        }
        if (!recovered) log(`교재채점 반영: progress ${pid} 실패 — ${e.message}`);
      }
      await new Promise((z) => setTimeout(z, 150));
    }
    // 대기열 갱신: 성공 항목 제거(이력으로 이동), 실패 항목 유지
    const remain = items.filter((it) => !okIds.has(it.id));
    const done = items.filter((it) => okIds.has(it.id)).map((it) => ({ ...it, syncedAt: new Date().toISOString() }));
    totOk += done.length; totFail += remain.length;
    const code = q.key.replace(/^hw_sync_/, '');
    // 이력 (최근 500개만 유지)
    if (done.length) {
      try {
        const rh = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.hw_synced_${code}&select=value`, { headers: sbH() });
        let hist = { items: [] };
        if (rh.ok) { const jh = await rh.json(); if (jh[0] && jh[0].value) hist = (typeof jh[0].value === 'string' ? JSON.parse(jh[0].value) : jh[0].value) || { items: [] }; }
        hist.items = (hist.items || []).concat(done).slice(-500);
        hist.updated = new Date().toISOString();
        await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: `hw_synced_${code}`, value: hist }]) });
      } catch (e) {}
    }
    await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ key: q.key, value: { items: remain, updated: new Date().toISOString(), lastRun: new Date().toISOString(), lastFail: Object.keys(failNote).length ? failNote : undefined } }]),
    });
  }
  log(`교재채점 반영: 성공 ${totOk} · 실패(재시도 예정) ${totFail}`);
  return true;
}

(async () => {
  // v18-79: 제출 알림 — 2026-08-26 원장님 지시로 중지 (컴퓨터에 알림이 안 떠서 원인 확인 전까지).
  // 재개하려면 아래 PUSH_PAUSED를 false로 바꾸면 된다. 코드·구독·설정은 그대로 남아 있다.
  const PUSH_PAUSED = true;
  if (!PUSH_PAUSED) {
    try {
      const { runPushWatch } = require('./push_watch.js');
      await runPushWatch();
    } catch (e) { log('제출 알림 오류:', e.message); }
  }
  // 교재 채점 되돌려쓰기 — 가볍고 학생이 기다리므로 그다음
  try { await runHwSync(); } catch (e) { log('교재채점 반영 오류:', e.message); }
  // 학습지 생성 요청은 수집보다 가볍고 빠르므로 먼저 처리한다
  try { await runWsRequests(); } catch (e) { log('학습지 요청 처리 오류:', e.message); }

  const req = await getReq();

  if (!req || !req.status) { log('대기 중인 요청 없음'); return; }

  // 이전 실행이 중간에 죽어 'running'으로 남은 경우 정리
  if (req.status === 'running') {
    const started = Date.parse(req.startedAt || req.reqAt || '') || 0;
    const mins = (Date.now() - started) / 60000;
    if (mins > STALE_MIN) {
      log(`오래된 running 요청 정리 (${Math.round(mins)}분 경과)`);
      await setReq({ ...req, status: 'done', finishedAt: new Date().toISOString(), note: '이전 실행이 중단되어 정리됨', ok: false });
    } else {
      log(`이미 수집 중 (${Math.round(mins)}분 경과) — 이번 차례는 건너뜀`);
    }
    return;
  }

  if (req.status !== 'requested') { log(`처리할 요청 없음 (status=${req.status})`); return; }

  // ── 요청 처리 시작 ──
  const startedAt = new Date().toISOString();
  log(`요청 발견 (대상일 ${req.date || '오늘'}) — 수집 시작`);
  await setReq({ ...req, status: 'running', startedAt, note: '매쓰플랫 접속 중…' });

  // 하루치만 보면 놓치는 채점이 있을 수 있어 최근 2일을 본다(중복은 수집기가 알아서 정리).
  const code = await runCollector(2);
  const finishedAt = new Date().toISOString();
  const mins = Math.max(1, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 60000));

  await setReq({
    ...req,
    status: 'done',
    startedAt,
    finishedAt,
    ok: code === 0,
    note: code === 0 ? `수집 완료 (약 ${mins}분)` : `수집 실패 (코드 ${code}) — 새벽 자동 수집 때 다시 시도됩니다`,
  });

  log(code === 0 ? `완료 (약 ${mins}분)` : `실패 (코드 ${code})`);
  // 실패해도 워크플로 자체는 성공으로 끝낸다 — 앱이 상태(ok:false)로 알려주고,
  // 새벽 자동 수집이 어차피 다시 돌기 때문에 빨간 실패 알림을 띄우지 않는다.
})().catch((e) => {
  console.error('요청 처리 중 오류:', e.message);
  process.exit(1);
});
