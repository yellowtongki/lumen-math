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

(async () => {
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
