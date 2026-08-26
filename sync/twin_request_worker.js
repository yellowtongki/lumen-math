/* ═══════════════════════════════════════════════════════════════════
 * 기출 쌍둥이 요청 처리기  v1
 * ═══════════════════════════════════════════════════════════════════
 *
 * 학원앱 「🏭 기출 쌍둥이」 버튼은 매쓰플랫·수학비서에 직접 못 붙는다
 * (앱은 공개 파일이라 비밀번호가 없다). 대신 Supabase에 요청서만 남긴다:
 *
 *   lumen_store 'twin_req' = {
 *     status: 'requested' | 'running' | 'done' | 'error',
 *     mode:   'now'(다음 5분 워커) | 'dawn'(새벽 4시대에만 실행),
 *     items:  [{ mydb, trie?, mylist?, title? }],   // mydb = 수학비서 시험지 id
 *     reqAt, startedAt, doneAt, results, error
 *   }
 *
 * 5분마다 도는 워커(collect_request_worker)가 이 파일을 불러 요청을 처리한다.
 *   - mode:'dawn'이면 한국시간 새벽 4시대에만 실행 (수업 중 매쓰플랫 접속이
 *     끊기지 않게. 매쓰플랫은 동시 로그인 시 기존 접속이 끊길 수 있다)
 *   - pdf-lib는 깃허브 서버에 없어서, 요청이 실제로 있을 때만 즉석 설치한다
 *     (요청이 없는 평소 실행에는 아무 부담이 없다)
 *
 * 결과는 두 곳에 남긴다:
 *   'twin_done' = { byMydb: { <mydb>: {title, paperId, wsOriginal, wsTwin,
 *                  matched, matchedTotal, mylist, at} } }  ← 앱이 ✓완료 표시에 사용
 *   'twin_log'  = { runs: [{at, lines}] }                  ← 최근 20회 작업 일지
 */

const { execSync } = require('child_process');
const path = require('path');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });

const REQ_KEY = 'twin_req';
const DONE_KEY = 'twin_done';
const LOG_KEY = 'twin_log';
const STALE_MIN = 40;          // 이보다 오래 running이면 죽은 것으로 보고 다시 받는다

const LINES = [];
const log = (...a) => {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[쌍둥이] [${t}]`, ...a);
  LINES.push(a.join(' '));
};

async function kvGet(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${key}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
async function kvSet(key, value) {
  await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

/* 한국시간 시(hour) — 새벽 예약 판정용 */
const kstHour = () => (new Date().getUTCHours() + 9) % 24;

/* pdf-lib가 없으면 즉석 설치 (요청이 있을 때만 — 보통 5~10초) */
function ensurePdfLib() {
  try { require('pdf-lib'); return true; } catch (e) {}
  log('pdf-lib 즉석 설치 중…');
  try {
    execSync('npm install pdf-lib@^1 --no-save --no-audit --no-fund --loglevel=error',
      { cwd: path.join(__dirname, '..'), stdio: 'pipe', timeout: 120000 });
    require('pdf-lib');
    return true;
  } catch (e) {
    log('pdf-lib 설치 실패:', e.message.slice(0, 150));
    return false;
  }
}

async function runTwinRequests() {
  if (!SB_URL || !SB_KEY) return;
  const req = await kvGet(REQ_KEY);
  if (!req || !Array.isArray(req.items) || !req.items.length) return;

  // 오래 매달린 running은 다시 requested로
  if (req.status === 'running') {
    const age = (Date.now() - new Date(req.startedAt || 0).getTime()) / 60000;
    if (age < STALE_MIN) return;
    log(`running ${Math.round(age)}분 경과 → 다시 시도`);
    req.status = 'requested';
  }
  if (req.status !== 'requested') return;

  // 새벽 예약이면 한국시간 새벽 4시대에만
  if (req.mode === 'dawn' && kstHour() !== 4) return;

  if (!process.env.MATHFLAT_ID || !process.env.MATHSECR_ID) { log('계정 환경변수 없음 — 건너뜀'); return; }
  if (!ensurePdfLib()) { await kvSet(REQ_KEY, { ...req, status: 'error', error: 'pdf-lib 설치 실패', doneAt: new Date().toISOString() }); return; }

  await kvSet(REQ_KEY, { ...req, status: 'running', startedAt: new Date().toISOString() });
  const { runTwinPipeline } = require('./exam_twin_pipeline.js');

  const done = (await kvGet(DONE_KEY)) || {};
  done.byMydb = done.byMydb || {};
  const results = [];
  let nOk = 0, nFail = 0;

  for (const item of req.items) {
    try {
      log(`시작: 수학비서 ${item.mydb}`);
      const r = await runTwinPipeline({
        mydb: item.mydb, trie: item.trie || '', mylist: item.mylist || '',
        title: item.title || '', log,
      });
      done.byMydb[String(item.mydb)] = {
        title: r.title, paperId: r.paperId,
        wsOriginal: r.worksheetOriginal, wsTwin: r.worksheetTwin,
        matched: r.matched, matchedTotal: r.matchedTotal,
        mylist: r.mylist, at: new Date().toISOString(),
      };
      results.push({ mydb: item.mydb, ok: true, title: r.title, matched: `${r.matched}/${r.matchedTotal}` });
      nOk++;
    } catch (e) {
      log(`실패: ${item.mydb} — ${e.message.slice(0, 200)}`);
      results.push({ mydb: item.mydb, ok: false, error: e.message.slice(0, 300) });
      nFail++;
    }
  }

  await kvSet(DONE_KEY, done);
  await kvSet(REQ_KEY, { ...req, status: nFail && !nOk ? 'error' : 'done', results, doneAt: new Date().toISOString() });

  const logs = (await kvGet(LOG_KEY)) || {};
  logs.runs = [{ at: new Date().toISOString(), lines: LINES.slice(-60) }, ...(logs.runs || [])].slice(0, 20);
  await kvSet(LOG_KEY, logs);
  log(`끝: 성공 ${nOk} · 실패 ${nFail}`);
}

module.exports = { runTwinRequests };

if (require.main === module) {
  runTwinRequests().catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
