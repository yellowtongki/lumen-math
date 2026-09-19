#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * ⏩ 학생앱 채점 → 매쓰플랫 되돌려쓰기 (단독 실행판)
 * ═══════════════════════════════════════════════════════════════════
 * 계약: docs/hw_autoscore_plan.md 11-2 · docs/worksheet_score_contract.md §1
 *
 * [왜 따로 떼었나] 이 일은 sync/collect_request_worker.js 안에 있었는데,
 *   그 워커는 깃허브 예약(GitHub Actions)으로만 돌고 «5분마다»로 적혀 있어도
 *   실제로는 2~4시간에 한 번만 깨어난다(깃허브가 무료 예약을 뒤로 미룬다).
 *   그래서 학생이 채점해도 매쓰플랫에 한참 뒤에야 넘어갔다.
 *   이 일만 떼어 두면 ① 지금 당장 손으로 한 번 돌릴 수 있고
 *   ② Supabase Edge Function 으로 옮겨 1분마다 돌릴 수 있다 (원장 결정 2026-09-19).
 *
 * ★ 이 일에는 브라우저가 필요 없다 — 매쓰플랫에 로그인해서 PATCH 를 보내는
 *   순수 통신이다. 수집(Playwright)만 깃허브에 남는다.
 *
 * ⚠️ 매쓰플랫은 동시 로그인이 안 된다 — 이 스크립트가 도는 동안 원장님이
 *   매쓰플랫에 접속해 계시면 원장님 쪽이 끊길 수 있다.
 *
 * 실행: node sync/hw_sync_flush.js
 *       node sync/hw_sync_flush.js --dry   (무엇이 밀려 있는지 세어만 본다)
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MF_API = 'https://api.mathflat.com';
const MF_WEB = 'https://teacher.mathflat.com';
const DRY = process.argv.includes('--dry');

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
const log = (...a) => console.log('[반영]', ...a);

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
    body: JSON.stringify({ id: (process.env.MATHFLAT_ID || '').trim(), password: (process.env.MATHFLAT_PASSWORD || '').trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
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

/* ★ 매쓰플랫이 쓰는 값 — 2026-09-19 실측.
 *   INCORRECT 를 보내면 400 MESSAGE_NOT_READABLE 로 거부당한다. WRONG 이 맞다. */
const RES_MAP    = { O: 'CORRECT', X: 'WRONG', '?': 'UNKNOWN' };   // 교재
const RES_MAP_WS = { O: 'CORRECT', X: 'WRONG', '?': 'UNKNOWN' };   // 학습지

async function runHwSync() {
  if (!SB_URL || !SB_KEY) { log('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); return false; }
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.hw_sync_*&select=key,value`, { headers: sbH() });
  if (!r.ok) { log(`대기열 조회 실패 ${r.status}`); return false; }
  const rows = await r.json();
  /* 주의: SQL LIKE 의 _ 는 한 글자 와일드카드 → hw_sync_* 가 hw_synced_*(이력)까지 잡는다. */
  const queues = rows.filter((x) => /^hw_sync_[^_]+$/.test(x.key))
    .map((x) => ({ key: x.key, v: (typeof x.value === 'string' ? JSON.parse(x.value) : x.value) || {} }))
    .filter((q) => Array.isArray(q.v.items) && q.v.items.length);

  const pend = queues.reduce((a, q) => a + q.v.items.length, 0);
  if (!queues.length) { log('밀린 것이 없습니다'); return false; }
  log(`대기 ${pend}건 · 학생 ${queues.length}명`);
  if (DRY) {
    queues.forEach((q) => {
      const ws = q.v.items.filter((it) => it && it.kind === 'ws').length;
      log(`   ${q.key.replace(/^hw_sync_/, '')} — ${q.v.items.length}건 (교재 ${q.v.items.length - ws} · 학습지 ${ws})`);
    });
    return true;
  }

  try { await mfLogin(); } catch (e) { log(`매쓰플랫 로그인 실패 — ${e.message}`); return true; }
  let totOk = 0, totFail = 0, totWsOk = 0;

  for (const q of queues) {
    const items = q.v.items;
    const okIds = new Set(); const failNote = {};

    /* ── 학습지 항목(kind:'ws') — 배정(swId)별로 묶어 PATCH ── */
    const wsItems = items.filter((it) => it && it.kind === 'ws' && it.swId && it.wpId);
    const bySw = {};
    wsItems.forEach((it) => { (bySw[it.swId] = bySw[it.swId] || []).push(it); });
    for (const swId of Object.keys(bySw)) {
      const group = bySw[swId];
      const mkBody = (arr) => arr.map((it) => ({
        studentWorksheetId: Number(swId),
        worksheetProblemId: Number(it.wpId),
        userAnswer: it.userAnswer != null ? String(it.userAnswer) : '',
        result: RES_MAP_WS[it.result] || it.result || 'NONE',
      }));
      try {
        await mfCall('PATCH', `/student-worksheet/assign/${swId}/scoring`, mkBody(group));
        group.forEach((it) => okIds.add(it.id));
      } catch (e) {
        let recovered = 0;
        for (const it of group) {
          try { await mfCall('PATCH', `/student-worksheet/assign/${swId}/scoring`, mkBody([it])); okIds.add(it.id); recovered++; }
          catch (e2) { failNote[it.id] = e2.message; }
          await new Promise((z) => setTimeout(z, 120));
        }
        if (!recovered) log(`학습지 ${swId} 실패 — ${e.message}`);
      }
      await new Promise((z) => setTimeout(z, 150));
    }
    totWsOk += wsItems.filter((it) => okIds.has(it.id)).length;

    /* ── 교재 항목 — progressId별로 묶어 PATCH ── */
    const bkItems = items.filter((it) => !(it && it.kind === 'ws'));
    const byPid = {};
    bkItems.forEach((it) => { (byPid[it.pid] = byPid[it.pid] || []).push(it); });
    for (const pid of Object.keys(byPid)) {
      const group = byPid[pid];
      const mk = (arr) => arr.map((it) => ({
        studentWorkbookProgressId: Number(pid),
        workbookProblemId: Number(it.wpId),
        userAnswer: it.userAnswer != null ? String(it.userAnswer) : null,
        result: RES_MAP[it.result] || it.result || 'NONE',
      }));
      try {
        /* 성공(200)일 때 매쓰플랫은 본문을 «비워서» 보낸다 — 예외 없이 돌아오면 성공이다
         * (2026-09-19: 본문이 있어야 성공으로 보다가 259건을 전부 실패로 셌던 일) */
        await mfCall('PATCH', '/student-workbook/scoring?version=v2', mk(group));
        group.forEach((it) => okIds.add(it.id));
      } catch (e) {
        let recovered = 0;
        for (const it of group) {
          try { await mfCall('PATCH', '/student-workbook/scoring?version=v2', mk([it])); okIds.add(it.id); recovered++; }
          catch (e2) { failNote[it.id] = e2.message; }
          await new Promise((z) => setTimeout(z, 120));
        }
        if (!recovered) log(`교재 progress ${pid} 실패 — ${e.message}`);
      }
      await new Promise((z) => setTimeout(z, 150));
    }

    /* 대기열 갱신: 성공은 이력으로, 실패는 남겨 다음에 다시 */
    const remain = items.filter((it) => !okIds.has(it.id));
    const done = items.filter((it) => okIds.has(it.id)).map((it) => ({ ...it, syncedAt: new Date().toISOString() }));
    totOk += done.length; totFail += remain.length;
    const code = q.key.replace(/^hw_sync_/, '');
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
  log(`성공 ${totOk}건 (그중 학습지 ${totWsOk}) · 실패(다음에 다시) ${totFail}건`);
  return true;
}

if (require.main === module) {
  runHwSync().then(() => process.exit(0)).catch((e) => { log('실패:', e.message); process.exit(1); });
}
module.exports = { runHwSync };
