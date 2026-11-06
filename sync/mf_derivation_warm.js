#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 쌍둥이 문제 미리 받아 두기 (새벽 일꾼)            (2026-11-06 원장 지시)
 * ═══════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   리커버리 학습지를 만들 때 `/derivation/problem`(쌍둥이 조회)를 한 번에 770회
 *   부르다가 매쓰플랫 보안문자(CAPTCHA_REQUIRED)에 막혔다(2026-11-06, 세 기기 모두).
 *   3초 간격으로 늦추면 막히지 않지만 35분이 걸린다.
 *   → 매일 새벽에 «어제 새로 생긴 오답 문항»의 쌍둥이만 미리 받아 두면,
 *     리커버리를 만들 때는 캐시에서 꺼내 쓰므로 쌍둥이 조회가 거의 0회가 된다.
 *
 * 하는 일
 *   ① 최근 N일(기본 35) 틀린 문항의 «문제은행 번호»를 모은다
 *        · 학습지 오답 → mf_answer_records.problem_id 가 그대로 번호
 *        · 교재 오답   → workbook_problem_id → lumen_store `mf_textbook_<교재>` 의
 *                        problems[].pimg 주소 안 /problem/<번호>/ 에서 꺼낸다
 *   ② mf_derivation_cache 에 이미 있는 번호는 뺀다
 *   ③ 남은 것을 «유형(concept)별로 묶어» 유형마다 필터를 하나 만들고
 *      (`/derivation/problem` 은 filterId 가 없으면 NOT_ALLOW_NULL — 2026-11-06 실측)
 *      문항마다 간격을 두고(기본 3초) 받아 캐시에 넣는다
 *   ④ 보안문자가 뜨면 그 자리에서 멈춘다. 재시도하지 않는다(우회가 아니다)
 *   ⑤ 오래된 줄(기본 90일)은 지운다 — 문제은행이 바뀔 수 있다
 *
 * 쓰는 법
 *   node sync/mf_derivation_warm.js --dry              # 몇 개 받을지만 보여 준다
 *   node sync/mf_derivation_warm.js                    # 기본: 최근 35일 · 한 번에 300개 · 3초 간격
 *   node sync/mf_derivation_warm.js --days 60 --max 500 --gap 4000
 *   node sync/mf_derivation_warm.js --prune-only       # 오래된 줄만 지운다
 *
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID · MATHFLAT_PASSWORD
 *
 * 캐시 두는 곳: 전용 표 mf_derivation_cache 가 있으면 거기, 없으면 lumen_store 의 `mfd_<번호>`.
 *   (표를 만드는 SQL 은 서비스 열쇠로 못 돌린다 — 원장님이 Supabase 화면에서
 *    docs/mf_derivation_cache.sql 을 한 번 돌리면 그때부터 저절로 표 쪽을 쓴다. 안 해도 돌아간다.)
 * 함께 보기: docs/mathflat_derivation_cache.md
 * ═══════════════════════════════════════════════════════════════════ */

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const MF = 'https://api.mathflat.com', WEB = 'https://teacher.mathflat.com';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !/^--/.test(args[i + 1]) ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const PRUNE_ONLY = args.includes('--prune-only');
const DAYS = Number(opt('days', '35'));
const MAX = Number(opt('max', '300'));
const GAP = Number(opt('gap', '3000'));
const KEEP_DAYS = Number(opt('keep', '90'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function q(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}
/* Supabase 는 한 번에 1000줄까지 준다 → 끊어서 다 읽는다 */
async function qAll(path, cap) {
  let out = [];
  for (let off = 0; off < (cap || 20000); off += 1000) {
    const rows = await q(`${path}&limit=1000&offset=${off}`);
    out = out.concat(rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function store(keys) {
  const out = {};
  for (let i = 0; i < keys.length; i += 40) {
    const part = keys.slice(i, i + 40);
    const rows = await q(`lumen_store?select=key,value&key=in.(${part.map(encodeURIComponent).join(',')})`);
    rows.forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; });
  }
  return out;
}

/* ── 매쓰플랫 (토큰은 5분쯤에 끊긴다 → 2분 30초마다 새로) ── */
let TOK = null, TOK_AT = 0;
async function mfLogin() {
  const r = await fetch(`${MF}/v2/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: WEB, referer: WEB + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error('매쓰플랫 로그인 실패 ' + (j.code || r.status));
  TOK = j.accessToken; TOK_AT = Date.now();
}
async function mf(method, p, body, retried) {
  if (Date.now() - TOK_AT > 150000) await mfLogin();
  const r = await fetch(`${MF}${p}`, { method, headers: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*',
    'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', authorization: 'Bearer ' + TOK, 'x-auth-token': TOK, origin: WEB, referer: WEB + '/' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.status === 401 && !retried) { await mfLogin(); return mf(method, p, body, true); }
  if (!r.ok) throw new Error(`${(j && j.code) || r.status} @ ${p}`);
  return j && (j.data !== undefined ? j.data : j);
}

let WHERE = 'table';
const SIM_KEEP = 30;        // 유사는 앞 30개만 담는다 — pick() 은 보통 2개만 집는다
const bankId = (p) => { const m = String((p && p.pimg) || '').match(/\/problem\/(\d+)\//); return m ? Number(m[1]) : null; };
async function haveIds(ids) {
  const have = new Set();
  for (let i = 0; i < ids.length; i += 150) {
    const part = ids.slice(i, i + 150);
    try {
      if (WHERE === 'table') {
        const rows = await q(`mf_derivation_cache?select=problem_id&problem_id=in.(${part.join(',')})`);
        rows.forEach((x) => have.add(Number(x.problem_id)));
      } else {
        const rows = await q(`lumen_store?select=key&key=in.(${part.map((x) => 'mfd_' + x).join(',')})`);
        rows.forEach((x) => have.add(Number(String(x.key).slice(4))));
      }
    } catch (e) { /* 못 읽으면 그냥 다시 받는다 */ }
  }
  return have;
}
async function putOne(id, d) {
  const pair = ((d && d.pairProblemList) || []).map(slimP).filter(Boolean);
  const similar = ((d && d.similarProblemList) || []).map(slimP).filter(Boolean).slice(0, SIM_KEEP);
  if (WHERE === 'table') {
    await fetch(`${SB}/rest/v1/mf_derivation_cache?on_conflict=problem_id`, { method: 'POST',
      headers: { ...H, prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ problem_id: id, pair, similar, fetched_at: new Date().toISOString() }]) });
  } else {
    await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST',
      headers: { ...H, prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ key: 'mfd_' + id, value: { pair, similar, at: new Date().toISOString() } }]) });
  }
}
const slimP = (x) => (x && x.problem ? { problem: { id: x.problem.id, level: x.problem.level, autoScoredType: x.problem.autoScoredType, type: x.problem.type, answer: x.problem.answer } } : null);

async function prune() {
  const cut = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
  if (WHERE === 'table') {
    const r = await fetch(`${SB}/rest/v1/mf_derivation_cache?fetched_at=lt.${cut}`, { method: 'DELETE', headers: { ...H, prefer: 'count=exact' } });
    if (!r.ok) { log(`오래된 줄 지우기 실패 ${r.status}`); return; }
    log(`${KEEP_DAYS}일 넘은 줄 지움 (${(r.headers.get('content-range') || '').split('/')[1] || '?'}건)`);
    return;
  }
  /* lumen_store 쪽은 값 안의 at 을 보고 지운다 */
  let old = [];
  try {
    const rows = await qAll('lumen_store?select=key,value&key=like.mfd_*');
    old = rows.filter((x) => { const a = x.value && x.value.at; return a && a < cut; }).map((x) => x.key);
  } catch (e) { return; }
  for (let i = 0; i < old.length; i += 100) {
    const part = old.slice(i, i + 100);
    await fetch(`${SB}/rest/v1/lumen_store?key=in.(${part.map(encodeURIComponent).join(',')})`, { method: 'DELETE', headers: H });
  }
  if (old.length) log(`${KEEP_DAYS}일 넘은 캐시 ${old.length}개 지움`);
}

(async () => {
  if (!SB || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다');

  /* 캐시를 어디에 둘까 — 전용 표가 있으면 거기, 없으면 lumen_store 의 `mfd_<번호>` */
  const probe = await fetch(`${SB}/rest/v1/mf_derivation_cache?select=problem_id&limit=1`, { headers: H });
  WHERE = probe.ok ? 'table' : 'store';
  log(`캐시 두는 곳: ${WHERE === 'table' ? 'mf_derivation_cache 표' : 'lumen_store 의 mfd_* (전용 표가 아직 없습니다 — docs/mf_derivation_cache.sql 을 한 번 돌리면 저절로 표 쪽을 씁니다)'}`);
  if (PRUNE_ONLY) { await prune(); return; }

  const since = new Date(Date.now() - DAYS * 86400000).toISOString();
  log(`최근 ${DAYS}일 오답에서 쌍둥이를 미리 받습니다 · 한 번에 ${MAX}개 · 간격 ${GAP}ms`);

  /* ① 학습지 오답 — problem_id 가 그대로 문제은행 번호 */
  const want = new Map();           // problem_id → concept_id
  const r1 = await qAll(`mf_answer_records?select=problem_id,concept_id&source=eq.학습지&result=eq.X&problem_id=not.is.null&score_datetime=gte.${since}`);
  r1.forEach((x) => { if (x.problem_id) want.set(Number(x.problem_id), Number(x.concept_id) || null); });
  log(`  학습지 오답 ${r1.length}건 → 문항 ${want.size}개`);

  /* ② 교재 오답 — 교재 은행에서 번호를 찾는다 */
  const r2 = await qAll(`mf_answer_records?select=book_id,workbook_problem_id,concept_id&source=eq.교재&result=eq.X&workbook_problem_id=not.is.null&score_datetime=gte.${since}`);
  const byBook = {};
  r2.forEach((x) => { const b = String(x.book_id || ''); if (!b) return; (byBook[b] = byBook[b] || []).push(x); });
  const banks = await store(Object.keys(byBook).map((b) => 'mf_textbook_' + b));
  let fromBook = 0;
  Object.entries(byBook).forEach(([b, rows]) => {
    const bank = banks['mf_textbook_' + b];
    if (!bank || !bank.problems) return;
    const byWp = {}; bank.problems.forEach((p) => { byWp[String(p.id)] = p; });
    rows.forEach((x) => {
      const p = byWp[String(x.workbook_problem_id)]; if (!p) return;
      const id = bankId(p); if (!id) return;
      if (!want.has(id)) fromBook++;
      want.set(id, Number(x.concept_id) || (p.cid != null ? Number(p.cid) : null));
    });
  });
  log(`  교재 오답 ${r2.length}건 → 새로 더한 문항 ${fromBook}개 (교재 ${Object.keys(byBook).length}권)`);

  /* ③ 이미 캐시에 있는 것 빼기 */
  const ids = [...want.keys()];
  const have = await haveIds(ids);
  let todo = ids.filter((id) => !have.has(id) && want.get(id));   // 유형을 모르면 필터를 못 만든다
  const noCid = ids.filter((id) => !have.has(id) && !want.get(id)).length;
  log(`  전체 ${ids.length}개 · 이미 받아 둠 ${have.size}개 · 받을 것 ${todo.length}개` + (noCid ? ` (유형을 몰라 건너뜀 ${noCid}개)` : ''));
  if (!todo.length) { log('새로 받을 것이 없습니다.'); await prune(); return; }
  if (todo.length > MAX) { log(`  이번에는 ${MAX}개만 받습니다 (나머지는 다음 새벽에)`); todo = todo.slice(0, MAX); }

  if (DRY) { log('[살펴보기만] 받지 않았습니다.'); return; }

  /* ④ 유형별로 묶어 필터를 하나 만들고, 간격을 두고 받는다 */
  await mfLogin();
  const groups = {};
  todo.forEach((id) => { const c = want.get(id); (groups[c] = groups[c] || []).push(id); });
  let got = 0, fail = 0, last = 0;
  outer:
  for (const [cid, list] of Object.entries(groups)) {
    let fid = null;
    try {
      const f = await mf('POST', '/worksheet/filter/concept', { type: 'CONCEPT', conceptIdList: [Number(cid)], excludedTopicIds: [], excludedSubTopicIds: [],
        problemList: null, problemCount: 20, level: 3, levelWeight: [10, 30, 30, 20, 10], problemFilterType: 'ALL', practiceTest: 'INCLUDE',
        onlyAutoScorable: false, excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true,
        equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] });
      fid = (f && f.filterId) || f;
    } catch (e) { log(`  유형 ${cid} 필터 실패 — ${list.length}개 건너뜀 (${e.message.slice(0, 60)})`); fail += list.length; continue; }

    for (const id of list) {
      const wait = GAP - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        const d = await mf('POST', '/derivation/problem/' + id, { excludedProblemIds: [], filterId: fid, bookType: 'WORKSHEET', tagTop: null });
        await putOne(id, d);
        got++;
        if (got % 25 === 0) log(`  … ${got}/${todo.length}개 받음`);
      } catch (e) {
        if (/CAPTCHA/i.test(e.message)) {
          log(`  ⛔ ${got}개째에서 보안문자 — 여기서 멈춥니다(재시도하지 않습니다). 나머지는 다음 새벽에 받습니다.`);
          break outer;
        }
        fail++;
        if (fail <= 5) log(`  문항 ${id} 실패: ${e.message.slice(0, 70)}`);
      }
    }
  }
  log(`받음 ${got}개 · 실패 ${fail}개`);
  await prune();
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
