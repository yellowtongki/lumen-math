#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 * 📖 매쓰플랫 교재 목차 수집기 — 「페이지별 문항 수」를 자동으로 가져온다
 * ══════════════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   시험대비 트랙의 「목표 문항 수」를 지금까지는 어림값(⚠추정)으로 넣었다.
 *   실제로는 M1-2가 162페이지까지 747문항인데 330으로 잡히는 식으로 크게 틀렸다.
 *   이 스크립트가 매쓰플랫에서 교재의 페이지마다 문항이 몇 개인지 직접 세어 온다.
 *
 * 어떻게 가져오나 (매쓰플랫에 교재 목차 API가 따로 없어서 두 단계로 우회한다)
 *   ① 그 교재를 가진 학생 한 명을 찾는다
 *      GET /student-workbook/student/{학생}?workbookType=PUBLIC|SCHOOL|CUSTOM
 *      → 교재 목록. 여기서 studentWorkbook.id(swId)와 recentRevisionId(revId)를 얻는다
 *   ② 그 학생의 교재 상세를 열면 「전체 페이지 목록」이 나온다 (푼 페이지만이 아니다)
 *      GET /student-workbook/student/{학생}/{swId}/{revId}?size=2000
 *      → page.content[].workbookPage.{id, page, title}
 *   ③ 페이지마다 문항 목록을 받아 개수를 센다
 *      GET /workbook/{교재}/page/{페이지id}  → 문항 배열
 *
 * 저장
 *   lumen_store 'mf_booktoc_<교재id>' = { bid, title, minPage, maxPage,
 *       pc:{ "4":6, "5":8, ... }  ← 페이지별 문항 수, total, pages, updated }
 *
 * 그리고 --apply 를 주면 exam_track(시험대비 트랙)의 목표 문항 수를 실제값으로 고친다.
 *   · 시험범위(pFrom~pTo)가 있으면 그 범위의 문항 수만 합산
 *   · 항목에 pc(페이지별 문항 수)를 함께 넣어 두어, 원장님이 나중에 범위를 바꿔도
 *     학원앱이 그 자리에서 정확히 다시 계산할 수 있게 한다
 *   · ⚠추정 배지(needCheck)는 지운다
 *
 * 쓰는 법
 *   node sync/mf_book_toc.js --track            트랙에 담긴 교재 전부 수집(적용은 안 함)
 *   node sync/mf_book_toc.js --track --apply    수집 후 트랙 목표 문항 수까지 갱신
 *   node sync/mf_book_toc.js --bids 10748021    특정 교재만
 *   옵션: --force (이미 받아 둔 목차도 다시 받기), --limit N (교재 수 제한)
 *
 * 주의: 매쓰플랫은 동시 로그인 시 기존 접속이 끊길 수 있다 → 수업 없는 시간에 실행.
 * ══════════════════════════════════════════════════════════════════════════ */

const API = 'https://api.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!SB || !SKEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }

const sbH = { apikey: SKEY, authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/* ── 인자 ─────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OPT = {
  track: has('--track'),
  bids: String(val('--bids', '')).split(',').map((s) => s.trim()).filter(Boolean),
  apply: has('--apply'),
  force: has('--force'),
  limit: Number(val('--limit', 0)) || 0,
};

/* ── 매쓰플랫 통신 ────────────────────────────────────────────────────── */
let TOKEN = '';
const mfH = () => ({
  'content-type': 'application/json',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/',
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
});
async function login() {
  const res = await fetch(`${API}/v2/login`, {
    method: 'POST', headers: mfH(),
    body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !(j && j.accessToken)) throw new Error('매쓰플랫 로그인 실패: ' + res.status + ' ' + JSON.stringify(j).slice(0, 200));
  TOKEN = j.accessToken;
}
async function api(p, _retried) {
  const res = await fetch(`${API}${p}`, { headers: mfH() });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch (_) {}
  if (res.status === 401 && !_retried) { await login(); return api(p, true); }
  if (!res.ok) throw new Error(`${res.status} ${(j && j.code) || ''} @ ${p}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}

/* ── Supabase ─────────────────────────────────────────────────────────── */
async function sbGet(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH });
  if (!r.ok) return null;
  const j = await r.json();
  let v = (j[0] || {}).value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) {} }
  return v === undefined ? null : v;
}
async function sbSet(key, value) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  return r.ok;
}

/* ── ① 교재를 가진 학생 찾기 ─────────────────────────────────────────── */
// 학생 한 명씩 교재 목록을 열어 bid → {sid, swId, revId, title} 색인을 만든다.
// 찾으려는 교재를 모두 만나면 즉시 멈춘다(매쓰플랫 부하 최소화).
async function buildBookIndex(wantBids) {
  const want = new Set(wantBids.map(String));
  const found = {};
  const rs = await fetch(`${SB}/rest/v1/mf_students?select=mf_student_id,name&mf_student_id=not.is.null`, { headers: sbH });
  const students = rs.ok ? await rs.json() : [];
  log(`  학생 ${students.length}명의 교재함을 훑습니다…`);
  let scanned = 0;
  for (const st of students) {
    if (Object.keys(found).length >= want.size) break;
    scanned++;
    /* ★ workbookType=ALL 로 한 번에 받는다 (2026-09-02 수정).
     * 예전에는 CUSTOM·SCHOOL·PUBLIC 세 종류만 훑었는데, 원장님이 직접 만드신
     * 시그니처 교재(type=CUSTOM_SIGNATURE, 예: Lumen Brilliance M1-1)는
     * 그 셋 어디에도 안 잡혀 통째로 빠졌다. 그래서 배정된 학생이 버젓이 있는데도
     * 「배정 없음」으로 보고 경로B(쪽 번호를 모르는 훑기)로 새어, 시험범위
     * 301~350p 같은 계산을 못 해 ⚠추정 배지가 남아 있었다.
     * ALL 하나면 20권이 다 나온다 — 통신도 3분의 1로 준다. */
    let list = null;
    try { list = await api(`/student-workbook/student/${st.mf_student_id}?workbookType=ALL`); } catch (_) { continue; }
    if (!Array.isArray(list)) list = (list && list.content) || [];
    for (const b of list) {
      const bid = String(b.id);
      if (!want.has(bid) || found[bid]) continue;
      const swId = b.studentWorkbook && b.studentWorkbook.id;
      const revId = b.recentRevisionId;
      if (!swId || !revId) continue;
      found[bid] = { sid: st.mf_student_id, swId, revId, title: (b.fulltitle || b.title || '').trim(), minPage: b.minPage, maxPage: b.maxPage };
    }
    await sleep(60);
  }
  log(`  → 학생 ${scanned}명 확인 · 교재 ${Object.keys(found).length}/${want.size}권을 찾았습니다`);
  return found;
}

/* ── ③ 한 페이지의 문항 수 ────────────────────────────────────────────
 * ★ size를 반드시 크게 준다. 안 주면 매쓰플랫이 한 번에 10문항까지만 돌려주어
 *   문항이 많은 페이지가 10개로 잘린다(= 또 틀린 숫자가 된다). */
async function pageProblems(bid, pid) {
  const j = await api(`/workbook/${bid}/page/${pid}?size=300`);
  return Array.isArray(j) ? j : ((j && j.content) || []);
}

/* ── ② 경로 A: 배정된 학생을 통해 「쪽 번호 + 문항 수」를 정확히 받는다 ── */
async function collectToc(bid, ref) {
  const det = await api(`/student-workbook/student/${ref.sid}/${ref.swId}/${ref.revId}?size=2000`);
  const content = (det && det.page && det.page.content) || [];
  const pages = content.map((pg) => ({
    pid: pg.workbookPage && pg.workbookPage.id,
    page: pg.workbookPage && pg.workbookPage.page,
  })).filter((p) => p.pid && p.page != null);
  if (!pages.length) return null;

  const pc = {}; let total = 0, ok = 0;
  const miss = [];
  const grab = async (p) => {
    let arr = null;
    try { arr = await pageProblems(bid, p.pid); } catch (_) { miss.push(p); await sleep(200); return; }
    pc[String(p.page)] = (pc[String(p.page)] || 0) + arr.length;   // 같은 쪽이 여러 번 나올 수 있어 더한다
    total += arr.length; ok++;
    await sleep(90);
  };
  for (const p of pages) { await grab(p); if (ok % 40 === 0) process.stdout.write(`    …${ok}/${pages.length}쪽\r`); }
  // 한 번 실패한 쪽은 다시 시도한다(다른 곳에서 매쓰플랫에 로그인해 세션이 끊겼을 수 있다).
  // 그래도 실패가 남으면 숫자가 모자란 것이므로 partial 로 표시해 두고, 트랙에는 반영하지 않는다.
  if (miss.length) {
    log(`     ↻ 못 받은 ${miss.length}쪽을 다시 시도합니다`);
    await login();
    const again = miss.splice(0, miss.length);
    for (const p of again) await grab(p);
  }
  const fail = miss.length;
  const nums = Object.keys(pc).map(Number).filter((n) => !isNaN(n));
  return {
    bid: Number(bid), title: ref.title, pc, total, route: 'A',
    pages: pages.length, ok, fail, partial: fail > 0,
    minPage: nums.length ? Math.min(...nums) : null,
    maxPage: nums.length ? Math.max(...nums) : null,
    updated: new Date().toISOString(),
  };
}

/* ── 경로 B: 지금은 아무 학생에게도 배정돼 있지 않은 교재 ─────────────
 * 배정이 없으면 쪽 목록을 받을 길이 없다. 다만 매쓰플랫의 페이지 id는
 * 한 교재 안에서 연속된 번호라, 우리 학생이 예전에 푼 페이지 id를 출발점으로
 * 위·아래로 훑으면 교재 전체 문항 수를 셀 수 있다.
 * 단점: 「몇 쪽」인지는 알 수 없어 시험범위 제한에는 쓸 수 없다(전체 수만). */
async function collectTocByScan(bid) {
  const r = await fetch(`${SB}/rest/v1/mf_answer_records?select=workbook_page_id&book_id=eq.${bid}&workbook_page_id=not.is.null&limit=1000`, { headers: sbH });
  if (!r.ok) return null;
  const seen = Array.from(new Set((await r.json()).map((x) => Number(x.workbook_page_id)).filter(Boolean))).sort((a, b) => a - b);
  if (!seen.length) return null;

  const counts = {}; let fail = 0;
  // 통신 오류를 「빈 쪽」으로 오해하면 훑기가 중간에 끊겨 문항 수가 모자라게 나온다.
  // 그래서 실패하면 다시 로그인해 두 번까지 더 시도하고, 그래도 안 되면 -1(모름)로 둔다.
  const probe = async (pid) => {
    for (let t = 0; t < 3; t++) {
      try { const arr = await pageProblems(bid, pid); counts[pid] = arr.length; await sleep(90); return arr.length; }
      catch (_) { await sleep(300); try { await login(); } catch (_2) {} }
    }
    fail++; return -1;
  };
  for (const pid of seen) await probe(pid);

  const MISS = 4;      // 문항이 없는 쪽(표지·해설 등)이 섞일 수 있어 연속 4번 비면 끝으로 본다
  const CAP = 1500;
  let miss = 0;
  for (let pid = seen[0] - 1, i = 0; i < CAP && miss < MISS; pid--, i++) {
    if (counts[pid] != null) continue;
    const n = await probe(pid); if (n < 0) break;          // 모르는 쪽이 생기면 그 방향은 멈춘다
    miss = n > 0 ? 0 : miss + 1;
  }
  miss = 0;
  for (let pid = seen[seen.length - 1] + 1, i = 0; i < CAP && miss < MISS; pid++, i++) {
    if (counts[pid] != null) continue;
    const n = await probe(pid); if (n < 0) break;
    miss = n > 0 ? 0 : miss + 1;
  }
  const ids = Object.keys(counts).map(Number).filter((p) => counts[p] > 0).sort((a, b) => a - b);
  const total = ids.reduce((s, p) => s + counts[p], 0);
  if (!total) return null;
  return {
    bid: Number(bid), title: '', pc: null, total, route: 'B', noPageMap: true,
    pages: ids.length, ok: ids.length, fail, partial: fail > 0,
    firstPageId: ids[0], lastPageId: ids[ids.length - 1],
    updated: new Date().toISOString(),
  };
}

/* ── 범위 안 문항 수 합계 ─────────────────────────────────────────────── */
function sumRange(pc, from, to) {
  let s = 0;
  Object.keys(pc || {}).forEach((k) => {
    const p = Number(k);
    if (isNaN(p)) return;
    if (from != null && p < from) return;
    if (to != null && p > to) return;
    s += pc[k] || 0;
  });
  return s;
}

/* ── 메인 ─────────────────────────────────────────────────────────────── */
(async () => {
  const track = await sbGet('exam_track');
  let bids = OPT.bids.slice();
  if (OPT.track || !bids.length) {
    // 기본은 ⚠추정이 붙은 항목만 (학습지처럼 이미 정확한 항목은 건드리지 않는다).
    // --all 을 주면 트랙의 모든 교재를 대상으로 한다.
    const set = new Set();
    const pick = (items) => (items || []).forEach((it) => {
      if (!it || !it.id) return;
      if (!has('--all') && !it.needCheck) return;
      set.add(String(it.id));
    });
    Object.keys((track && track.tracks) || {}).forEach((k) => pick((track.tracks[k] || {}).items));
    Object.keys((track && track.indiv) || {}).forEach((k) => pick((track.indiv[k] || {}).items));
    bids = Array.from(set);
  }
  if (OPT.limit) bids = bids.slice(0, OPT.limit);
  log(`📖 대상 교재 ${bids.length}권: ${bids.join(', ')}`);
  if (!bids.length) return;

  // 이미 받아 둔 목차는 건너뛴다
  const cached = {};
  for (const bid of bids) {
    const v = await sbGet(`mf_booktoc_${bid}`);
    if (v && v.total && !v.partial && !OPT.force) cached[bid] = v;
  }
  const todo = bids.filter((b) => !cached[b]);
  if (Object.keys(cached).length) log(`  이미 있는 목차 ${Object.keys(cached).length}권은 건너뜁니다 (--force 로 다시 받기)`);

  if (todo.length) {
    await login(); log('🔑 매쓰플랫 로그인 완료');
    const idx = await buildBookIndex(todo);
    for (const bid of todo) {
      const ref = idx[bid];
      let toc = null;
      if (ref) {
        log(`  📘 ${bid} ${ref.title} — 쪽 목록을 받는 중…`);
        try { toc = await collectToc(bid, ref); } catch (e) { log(`     실패: ${e.message}`); }
      } else {
        log(`  📕 ${bid} — 지금 이 교재를 가진 학생이 없습니다 → 예전 채점 기록을 실마리로 훑습니다`);
        try { toc = await collectTocByScan(bid); } catch (e) { log(`     실패: ${e.message}`); }
      }
      if (!toc) { log('     ⛔ 문항 수를 알아내지 못했습니다 (원장님이 직접 입력해 주세요)'); continue; }
      if (toc.partial) log(`     ⚠ ${toc.fail}쪽을 끝내 못 받았습니다 → 숫자가 모자랄 수 있어 트랙에는 반영하지 않습니다 (--force 로 다시 받아 주세요)`);
      if (!toc.title) toc.title = (ref && ref.title) || '';
      await sbSet(`mf_booktoc_${bid}`, toc);
      cached[bid] = toc;
      log(toc.route === 'A'
        ? `     ✅ ${toc.ok}쪽 · 총 ${toc.total}문항 (${toc.minPage}~${toc.maxPage}쪽)${toc.fail ? ` · 실패 ${toc.fail}쪽` : ''}`
        : `     ✅ 총 ${toc.total}문항 (${toc.pages}쪽 분량) — 쪽 번호는 알 수 없어 시험범위 제한은 못 씁니다`);
    }
  }

  /* ── 트랙에 반영 ── */
  if (!OPT.apply) {
    log('\n(적용하지 않았습니다 — 트랙 목표 문항 수까지 고치려면 --apply 를 붙여 주세요)');
    Object.keys(cached).forEach((b) => log(`   ${b} → 전체 ${cached[b].total}문항`));
    return;
  }
  if (!track || !track.tracks) { log('exam_track 이 없습니다'); return; }
  let changed = 0;
  const walk = (items) => (items || []).forEach((it) => {
    const toc = cached[String(it.id)];
    if (!toc || !toc.total || toc.partial) return;   // 덜 받아 온 목차는 반영하지 않는다
    if (toc.pc) {
      const t = sumRange(toc.pc, it.pFrom != null ? Number(it.pFrom) : null, it.pTo != null ? Number(it.pTo) : null);
      if (!t) return;
      it.pc = toc.pc;               // 학원앱이 시험범위를 바꿔도 그 자리에서 다시 계산할 수 있게
      it.total = t;
    } else {
      // 쪽 번호를 모르는 교재. 시험범위가 지정돼 있으면 「그 범위의 문항 수」를 셀 수 없으므로
      // 원장님이 넣어 둔 값을 함부로 덮어쓰지 않는다(전체 수로 바꾸면 오히려 더 틀린다).
      if (it.pFrom != null || it.pTo != null) { it.bookTotal = toc.total; return; }
      it.total = toc.total;         // 범위 지정이 없을 때만 전체 문항 수로
      delete it.pc;
    }
    it.bookTotal = toc.total;       // 교재 전체 문항 수
    delete it.needCheck;
    changed++;
  });
  Object.keys(track.tracks).forEach((k) => walk((track.tracks[k] || {}).items));
  Object.keys(track.indiv || {}).forEach((k) => walk((track.indiv[k] || {}).items));
  track.updated = new Date().toISOString();
  const ok = await sbSet('exam_track', track);
  log(`\n${ok ? '✅' : '❌'} 트랙 항목 ${changed}개의 목표 문항 수를 실제값으로 고쳤습니다`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
