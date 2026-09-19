/* ═══════════════════════════════════════════════════════════════════
 * ⏩ hw-flush — 학생앱 채점을 매쓰플랫에 바로 반영 (Supabase Edge Function)
 * ═══════════════════════════════════════════════════════════════════
 * 원장 결정 2026-09-19 (C-1안). 설명서: docs/edge_function_setup.md
 *
 * [왜] 이 일을 깃허브 예약(GitHub Actions)이 맡고 있었는데, 「5분마다」로 적혀 있어도
 *   깃허브가 무료 예약을 뒤로 미뤄 «2~4시간에 한 번»만 깨어났다. 그래서 학생이
 *   채점해도 매쓰플랫에 한참 뒤에야 넘어갔다(2026-09-19 109건이 밀려 있었다).
 *   이 일은 브라우저가 필요 없는 «순수 통신»이라 Supabase 안에서 돌 수 있다.
 *   추가 비용 0원 — 이미 쓰고 있는 Pro 요금에 포함된다.
 *
 * [무엇을 하나] lumen_store 의 hw_sync_<학생코드> 대기열을 읽어
 *   교재는 PATCH /student-workbook/scoring?version=v2
 *   학습지는 PATCH /student-worksheet/assign/{swId}/scoring
 *   로 보내고, 성공한 것은 hw_synced_<코드> 이력으로 옮긴다.
 *   (sync/hw_sync_flush.js 와 같은 규칙 — 한쪽을 고치면 다른 쪽도 고쳐야 한다)
 *
 * ⚠️ 매쓰플랫은 «동시 로그인»이 안 된다. 그래서 로그인을 최대한 아낀다:
 *   ① 밀린 것이 없으면 아예 로그인하지 않는다 (평소에는 조용하다)
 *   ② 받은 토큰을 lumen_store 의 mf_token 에 넣어 두고 다시 쓴다
 *   ③ 토큰이 만료되어 401 이 오면 그때만 새로 로그인한다
 *
 * [비밀값] 환경변수로만 읽는다 — 코드에 절대 적지 않는다.
 *   MATHFLAT_ID · MATHFLAT_PASSWORD · LUMEN_FLUSH_KEY
 *   SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 저절로 넣어 준다.
 */

const SB_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MF_ID = (Deno.env.get('MATHFLAT_ID') || '').trim();
const MF_PW = (Deno.env.get('MATHFLAT_PASSWORD') || '').trim();
const FLUSH_KEY = Deno.env.get('LUMEN_FLUSH_KEY') || '';

const MF_API = 'https://api.mathflat.com';
const MF_WEB = 'https://teacher.mathflat.com';

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
const lines: string[] = [];
const log = (s: string) => { lines.push(s); console.log('[반영] ' + s); };

/* ── 매쓰플랫 ── */
let TOKEN: string | null = null;
const mfH = () => ({
  'content-type': 'application/json', accept: 'application/json, text/plain, */*',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  authorization: `Bearer ${TOKEN}`, 'x-auth-token': TOKEN as string,
  origin: MF_WEB, referer: MF_WEB + '/',
});

async function kvGet(key: string) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${key}&select=value`, { headers: sbH() });
  if (!r.ok) return null;
  const j = await r.json();
  let v = j[0]?.value ?? null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  return v;
}
async function kvSet(key: string, value: unknown) {
  await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value }]),
  });
}

/* 토큰을 아껴 쓴다 — 저장해 둔 것을 먼저 쓰고, 없거나 만료면 새로 받는다 */
async function mfLogin(force = false) {
  if (!force) {
    const saved = await kvGet('mf_token');
    if (saved?.token && saved?.at && (Date.now() - Date.parse(saved.at)) < 6 * 3600 * 1000) {
      TOKEN = saved.token; return;
    }
  }
  const r = await fetch(`${MF_API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_WEB, referer: MF_WEB + '/' },
    body: JSON.stringify({ id: MF_ID, password: MF_PW, userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.accessToken) throw new Error(`매쓰플랫 로그인 실패: ${j.code || r.status}`);
  TOKEN = j.accessToken;
  await kvSet('mf_token', { token: TOKEN, at: new Date().toISOString() });
  log('매쓰플랫에 새로 로그인했습니다');
}

/* 401(토큰 만료)이면 한 번만 새로 로그인하고 다시 보낸다 */
async function mfCall(method: string, p: string, body?: unknown, retried = false): Promise<unknown> {
  const r = await fetch(`${MF_API}${p}`, { method, headers: mfH(), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { /* 성공하면 본문이 비어 있다 */ }
  if (r.status === 401 && !retried) { await mfLogin(true); return mfCall(method, p, body, true); }
  if (!r.ok) throw new Error(`${r.status} ${(j && j.code) || ''} @ ${p}`);
  return j && (j.data !== undefined ? j.data : j);
}

/* ★ 매쓰플랫이 쓰는 값 — 2026-09-19 실측. INCORRECT 는 400 으로 거부당한다. */
const RES_MAP: Record<string, string> = { O: 'CORRECT', X: 'WRONG', '?': 'UNKNOWN' };
const nap = (ms: number) => new Promise((z) => setTimeout(z, ms));

async function runFlush() {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.hw_sync_*&select=key,value`, { headers: sbH() });
  if (!r.ok) { log(`대기열 조회 실패 ${r.status}`); return { ok: 0, fail: 0, pend: 0 }; }
  const rows = await r.json();
  /* SQL LIKE 의 _ 는 한 글자 와일드카드 → hw_sync_* 가 hw_synced_*(이력)까지 잡는다 */
  const queues = rows
    .filter((x: any) => /^hw_sync_[^_]+$/.test(x.key))
    .map((x: any) => ({ key: x.key, v: (typeof x.value === 'string' ? JSON.parse(x.value) : x.value) || {} }))
    .filter((q: any) => Array.isArray(q.v.items) && q.v.items.length);

  const pend = queues.reduce((a: number, q: any) => a + q.v.items.length, 0);
  if (!queues.length) return { ok: 0, fail: 0, pend: 0, idle: true };
  log(`대기 ${pend}건 · 학생 ${queues.length}명`);

  await mfLogin();
  let totOk = 0, totFail = 0, totWs = 0;

  for (const q of queues) {
    const items = q.v.items as any[];
    const okIds = new Set<string>(); const failNote: Record<string, string> = {};

    /* 학습지 — 배정(swId)별로 묶어 보낸다 */
    const wsItems = items.filter((it) => it && it.kind === 'ws' && it.swId && it.wpId);
    const bySw: Record<string, any[]> = {};
    wsItems.forEach((it) => { (bySw[it.swId] = bySw[it.swId] || []).push(it); });
    for (const swId of Object.keys(bySw)) {
      const group = bySw[swId];
      const mk = (arr: any[]) => arr.map((it) => ({
        studentWorksheetId: Number(swId), worksheetProblemId: Number(it.wpId),
        userAnswer: it.userAnswer != null ? String(it.userAnswer) : '',
        result: RES_MAP[it.result] || it.result || 'NONE',
      }));
      try {
        await mfCall('PATCH', `/student-worksheet/assign/${swId}/scoring`, mk(group));
        group.forEach((it) => okIds.add(it.id));
      } catch (e) {
        let rec = 0;
        for (const it of group) {
          try { await mfCall('PATCH', `/student-worksheet/assign/${swId}/scoring`, mk([it])); okIds.add(it.id); rec++; }
          catch (e2) { failNote[it.id] = String((e2 as Error).message); }
          await nap(120);
        }
        if (!rec) log(`학습지 ${swId} 실패 — ${(e as Error).message}`);
      }
      await nap(150);
    }
    totWs += wsItems.filter((it) => okIds.has(it.id)).length;

    /* 교재 — progressId별로 묶어 보낸다 */
    const bkItems = items.filter((it) => !(it && it.kind === 'ws'));
    const byPid: Record<string, any[]> = {};
    bkItems.forEach((it) => { (byPid[it.pid] = byPid[it.pid] || []).push(it); });
    for (const pid of Object.keys(byPid)) {
      const group = byPid[pid];
      const mk = (arr: any[]) => arr.map((it) => ({
        studentWorkbookProgressId: Number(pid), workbookProblemId: Number(it.wpId),
        userAnswer: it.userAnswer != null ? String(it.userAnswer) : null,
        result: RES_MAP[it.result] || it.result || 'NONE',
      }));
      try {
        /* 성공(200)이면 매쓰플랫은 본문을 비워서 보낸다 — 예외 없이 돌아오면 성공이다 */
        await mfCall('PATCH', '/student-workbook/scoring?version=v2', mk(group));
        group.forEach((it) => okIds.add(it.id));
      } catch (e) {
        let rec = 0;
        for (const it of group) {
          try { await mfCall('PATCH', '/student-workbook/scoring?version=v2', mk([it])); okIds.add(it.id); rec++; }
          catch (e2) { failNote[it.id] = String((e2 as Error).message); }
          await nap(120);
        }
        if (!rec) log(`교재 progress ${pid} 실패 — ${(e as Error).message}`);
      }
      await nap(150);
    }

    /* 성공은 이력으로, 실패는 남겨 다음에 다시 */
    const remain = items.filter((it) => !okIds.has(it.id));
    const done = items.filter((it) => okIds.has(it.id)).map((it) => ({ ...it, syncedAt: new Date().toISOString() }));
    totOk += done.length; totFail += remain.length;
    const code = q.key.replace(/^hw_sync_/, '');
    if (done.length) {
      try {
        let hist = (await kvGet(`hw_synced_${code}`)) || { items: [] };
        hist.items = (hist.items || []).concat(done).slice(-500);
        hist.updated = new Date().toISOString();
        await kvSet(`hw_synced_${code}`, hist);
      } catch { /* 이력은 실패해도 반영 자체는 끝난 것이다 */ }
    }
    await kvSet(q.key, {
      items: remain, updated: new Date().toISOString(), lastRun: new Date().toISOString(),
      lastFail: Object.keys(failNote).length ? failNote : undefined,
    });
  }
  log(`성공 ${totOk}건 (그중 학습지 ${totWs}) · 실패 ${totFail}건`);
  return { ok: totOk, fail: totFail, pend, ws: totWs };
}

Deno.serve(async (req) => {
  /* 아무나 부르지 못하게 — Cron 이 보내는 열쇠를 확인한다 */
  if (FLUSH_KEY) {
    const got = req.headers.get('x-lumen-flush-key') || new URL(req.url).searchParams.get('k') || '';
    if (got !== FLUSH_KEY) return new Response('no', { status: 401 });
  }
  const t0 = Date.now();
  try {
    const out = await runFlush();
    /* 언제 무엇을 했는지 앱이 볼 수 있게 남긴다 */
    if (!(out as any).idle) {
      await kvSet('hw_flush_log', { at: new Date().toISOString(), ms: Date.now() - t0, ...out, lines: lines.slice(-12) });
    }
    return new Response(JSON.stringify({ ok: true, ...out }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const msg = String((e as Error).message);
    log('실패: ' + msg);
    await kvSet('hw_flush_log', { at: new Date().toISOString(), error: msg, lines: lines.slice(-12) });
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
