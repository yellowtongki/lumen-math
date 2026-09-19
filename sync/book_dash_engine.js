#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📗 교재 상황판 집계 엔진  v1  (2026-09-19)
 * ═══════════════════════════════════════════════════════════════════
 * 계약서: docs/book_dashboard_contract.md
 *
 * 매쓰플랫에서 자동으로 들어온 교재 채점 기록(mf_answer_records, source='교재')을
 * <b>교재 단위</b>로 다시 묶어, 학원앱이 한 번에 읽을 수 있는 요약 한 칸을 만든다.
 *
 * ★ 왜 서버가 미리 세는가
 *   교재 기록은 5만 건이 넘는다. 앱이 화면을 열 때마다 이걸 다 읽으면 느리고,
 *   0.5GB 서버에도 부담이다(2026-09-18 저녁 서버 멈춤 — docs/incident_2026-09-18_supabase.md).
 *   진도 레이스(race_board)와 같은 방식으로 새벽에 한 번 세어 넣어 둔다.
 *
 * ── 입력 (lumen_store · Supabase) ─────────────────────────────────
 *   mf_answer_records   source='교재' 인 문항별 정오답
 *   lumen_store mf_swb_<학생코드>   학생별 교재 목록 (books[].pages[] 에 쪽·pid)
 *   lumen_store or_studentdb        등록부 (퇴원생 제외·학년 판정용. 이름은 쓰지 않는다)
 *   lumen_store book_dash_cfg       원장님이 화면에서 바꾸는 기준 (없으면 기본값)
 *
 * ── 출력 (lumen_store) ────────────────────────────────────────────
 *   book_dash   교재 상황판 요약  ← 학원앱이 이것만 읽는다
 *
 * ⚠️ 학생 이름은 넣지 않는다. 코드(lumen_rec_code)만 넣고 이름은 앱이 등록부에서 붙인다.
 * ⚠️ score_datetime 은 «이미 한국시간»이다 — 9시간을 더하지 않는다
 *    (race_engine.js 의 같은 주의 참고. 2026-08-27에 잡은 버그).
 *
 * 실행: node sync/book_dash_engine.js        저장까지
 *       node sync/book_dash_engine.js --dry  계산만 하고 결과를 보여 준다
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
const log = (...a) => console.log('[교재판]', ...a);
const DRY = process.argv.includes('--dry');

/* ── 기본 기준 (원장님이 학원앱에서 바꾼다 → book_dash_cfg) ─────── */
const DEF_CFG = {
  stallDays: 7,        // 며칠째 채점이 없으면 🔴 멈춤
  idleDays: 30,        // 이보다 오래 손 안 댄 교재는 「보관」 — 목록에서 접어 둔다
  hardRate: 65,        // 정답률이 이보다 낮으면 🟡 어려움
  nearPct: 90,         // 진도가 이보다 높으면 🏁 곧 끝
  sort: 'recent',      // 교재 목록 기본 정렬 — recent | stall | name | rate
  mapTop: 8,           // 🔥 많이 틀린 쪽 몇 개까지
};

/* ═══ 심부름꾼 ═══ */
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
  if (DRY) { log(`[미리보기] ${key} — 저장하지 않았습니다`); return true; }
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) { log(`저장 실패 ${key} ${r.status} ${(await r.text()).slice(0, 160)}`); return false; }
  return true;
}
/* PostgREST 는 한 번에 1000행까지 → range 헤더로 이어 받는다 */
async function sbAll(path, cap) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { ...sbH(), range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`조회 실패 ${r.status} @ ${path.slice(0, 70)}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) break;
    from += 1000;
    if (from > (cap || 200000)) break;
  }
  return out;
}

const day = (iso) => String(iso || '').slice(0, 10);                 // 한국시간 그대로
const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const pct = (ok, n) => (n > 0 ? Math.round((ok / n) * 1000) / 10 : null);

/* 학년 글자 → 초·중·고 */
function bandOf(grade) {
  const g = String(grade || '');
  if (/고|공통수학|미적분|확률|기하|대수|수학[ⅠⅡI]/.test(g)) return 'high';
  if (/중/.test(g)) return 'mid';
  if (/초/.test(g)) return 'elem';
  return '';
}

/* ═══ ① 학생 · 교재 목록 ═══
 * mf_swb_<코드>.books[] — 학생마다 자기 교재(swId)를 갖는다.
 * 같은 교재는 bid 가 같다. 그래서 bid 로 묶고, swId → bid 를 표로 만들어 둔다. */
async function loadBooks() {
  const alive = {};                       // 재원생 코드만
  let db = await kvGet('or_studentdb');
  if (!Array.isArray(db)) db = [];
  db.forEach((s) => { if (s && s.lumen_rec_code != null && !s.withdrawn) alive[String(s.lumen_rec_code)] = true; });

  const rows = await sbAll('lumen_store?key=like.mf_swb_*&select=key,value');
  const sw2bid = {};                      // swId → bid
  const books = {};                       // bid → { bid, title, grade, kind, pages:{page:{title}}, npages, stus:{} }
  const pid2page = {};                    // "<코드>:<pid>" → 쪽 번호
  rows.forEach((row) => {
    const code = String((row.key || '').replace(/^mf_swb_/, ''));
    if (!alive[code]) return;             // 퇴원생은 상황판에 넣지 않는다
    const list = (row.value && row.value.books) || [];
    list.forEach((b) => {
      if (!b || b.bid == null) return;
      const bid = String(b.bid);
      sw2bid[String(b.swId)] = bid;
      if (!books[bid]) books[bid] = { bid, title: String(b.title || '(이름 없음)'), grade: String(b.grade || ''), kind: String(b.type || ''), pages: {}, npages: 0, stus: {} };
      const B = books[bid];
      if (!B.grade && b.grade) B.grade = String(b.grade);
      const pgs = b.pages || [];
      let done = 0;
      pgs.forEach((p) => {
        if (!p) return;
        const pg = Number(p.page);
        if (p.st === 'COMPLETE') done++;
        /* ⚠️ 쪽을 잇는 열쇠는 wpid 다. pid 는 다른 번호이고 기록의 workbook_page_id 와 맞지 않는다
         *   (실측 2026-09-19: 기록 workbook_page_id=39885953 ↔ pages[].wpid=39885953, pid 는 678676994). */
        if (p.wpid != null) pid2page[code + ':' + p.wpid] = pg;
        if (!isNaN(pg) && !B.pages[pg]) B.pages[pg] = String(p.title || '');
      });
      B.npages = Math.max(B.npages, pgs.length);
      B.stus[code] = { code, done, pages: pgs.length, recent: Number(b.recentPage) || 0, round: Number(b.round) || 1 };
    });
  });
  return { books, sw2bid, pid2page, alive };
}

/* ═══ ② 교재 채점 기록 ═══ */
async function loadRecords() {
  const cols = 'lumen_rec_code,student_workbook_id,workbook_page_id,number,level,result,score_datetime';
  return sbAll(`mf_answer_records?source=eq.${encodeURIComponent('교재')}&select=${cols}&order=id.asc`, 300000);
}

/* ═══ ③ 집계 ═══ */
function build(cfg, src, recs) {
  const { books, sw2bid, pid2page } = src;
  const today = new Date().toISOString().slice(0, 10);
  const w1From = dayAgo(7), w2From = dayAgo(14);
  const weekBuckets = {};                 // 최근 7일: 날짜 → 문항수
  for (let i = 6; i >= 0; i--) weekBuckets[dayAgo(i)] = 0;
  const allLv = {}; for (let i = 1; i <= 5; i++) allLv[i] = { n: 0, ok: 0 };
  let seen = 0, skipped = 0;

  recs.forEach((r) => {
    const res = String(r.result || '');
    if (res === '-') return;              // 아직 채점 안 된 것
    const code = String(r.lumen_rec_code || '');
    const bid = sw2bid[String(r.student_workbook_id)];
    if (!code || !bid || !books[bid]) { skipped++; return; }
    const B = books[bid];
    const S = B.stus[code] || (B.stus[code] = { code, done: 0, pages: 0, recent: 0, round: 1 });
    const d = day(r.score_datetime);
    const ok = (res === 'O') ? 1 : 0;
    const graded = (res === 'O' || res === 'X') ? 1 : 0;     // ? 는 문항수에만 센다
    seen++;

    /* 교재 전체 */
    B.items = (B.items || 0) + 1;
    B.n = (B.n || 0) + graded; B.ok = (B.ok || 0) + ok;
    if (!B.last || d > B.last) B.last = d;
    if (d >= w1From) { B.w1n = (B.w1n || 0) + graded; B.w1ok = (B.w1ok || 0) + ok; if (weekBuckets[d] !== undefined) weekBuckets[d]++; }
    else if (d >= w2From) { B.w2n = (B.w2n || 0) + graded; B.w2ok = (B.w2ok || 0) + ok; }

    /* 난이도 */
    const lv = Number(r.level);
    if (lv >= 1 && lv <= 5 && graded) {
      B.lv = B.lv || {}; B.lv[lv] = B.lv[lv] || { n: 0, ok: 0 };
      B.lv[lv].n++; B.lv[lv].ok += ok;
      allLv[lv].n++; allLv[lv].ok += ok;
    }

    /* 학생별 */
    S.items = (S.items || 0) + 1;
    S.n = (S.n || 0) + graded; S.ok = (S.ok || 0) + ok;
    S.wrong = (S.wrong || 0) + (res === 'X' ? 1 : 0);
    if (!S.last || d > S.last) S.last = d;

    /* 쪽 지도 — 쪽 번호는 반드시 pid 로 찾는다 (page 칸은 "32~63" 같은 범위라 못 쓴다) */
    const pg = pid2page[code + ':' + r.workbook_page_id];
    if (pg != null && !isNaN(pg)) {
      B.map = B.map || {};
      const M = B.map[pg] || (B.map[pg] = { n: 0, ok: 0, items: 0, stus: {} });
      M.items++; M.n += graded; M.ok += ok;
      if (res === 'X') M.stus[code] = (M.stus[code] || 0) + 1;
    }
  });

  /* 교재 줄로 펴기 */
  const out = [];
  Object.keys(books).forEach((bid) => {
    const B = books[bid];
    if (!B.items) return;                                  // 아무도 채점하지 않은 교재는 뺀다
    const stus = Object.keys(B.stus).map((c) => B.stus[c]).filter((s) => s.items > 0);
    if (!stus.length) return;

    const doneSum = stus.reduce((a, s) => a + (s.done || 0), 0);
    const pgSum = stus.reduce((a, s) => a + (s.pages || 0), 0);
    const npages = B.npages || Math.max(...stus.map((s) => s.pages || 0), 0);
    const rate = pct(B.ok, B.n);
    const r1 = pct(B.w1ok, B.w1n), r2 = pct(B.w2ok, B.w2n);
    const delta = (B.w1n >= 10 && B.w2n >= 10 && r1 != null && r2 != null) ? Math.round((r1 - r2) * 10) / 10 : null;
    const gone = B.last ? Math.round((new Date(today) - new Date(B.last)) / 86400000) : 999;
    const prog = pgSum ? Math.round((doneSum / pgSum) * 100) : 0;

    /* 상태 — 오래 손 안 댄 교재(idle)는 「멈춤」과 나눈다.
     * 한 번 쓰고 만 교재까지 전부 빨간불이 되면 정작 봐야 할 것이 묻힌다. */
    let state = 'ok';
    if (gone >= cfg.idleDays) state = 'idle';
    else if (gone >= cfg.stallDays) state = 'stall';
    else if (rate != null && rate < cfg.hardRate) state = 'hard';
    else if (prog >= cfg.nearPct) state = 'near';

    /* 쪽 지도 — 쪽 오름차순 배열로.
     * 단원 이름(t)은 «앞 쪽과 다를 때만» 넣는다. 쪽마다 넣으면 요약이 몇 배로 부푼다.
     * 화면은 t 가 있는 곳에서 단원 줄을 바꾸면 된다. */
    let lastT = null;
    const map = Object.keys(B.map || {}).map(Number).sort((a, b) => a - b).map((p) => {
      const M = B.map[p];
      const t = B.pages[p] || '';
      const row = { p, n: M.n, ok: M.ok, i: M.items, s: Object.keys(M.stus).length };
      if (t && t !== lastT) { row.t = t; lastT = t; }
      return row;
    });
    /* 🔥 많이 틀린 쪽 — 「틀린 학생이 많고 정답률이 낮은」 쪽 */
    const hot = map.filter((m) => m.n >= 3 && m.s >= 1)
      .sort((a, b) => (b.s - a.s) || ((a.ok / a.n) - (b.ok / b.n)))
      .slice(0, cfg.mapTop)
      .map((m) => ({ p: m.p, s: m.s, r: pct(m.ok, m.n), t: m.t }));

    const lv = {}; for (let i = 1; i <= 5; i++) if (B.lv && B.lv[i]) lv[i] = B.lv[i];

    out.push({
      bid: B.bid, title: B.title, grade: B.grade, band: bandOf(B.grade), kind: B.kind,
      nstu: stus.length, pages: npages, avg: Math.round(doneSum / stus.length), done: doneSum, pgSum, prog,
      items: B.items, n: B.n, ok: B.ok, rate, delta, last: B.last || '', gone, state, lv,
      stus: stus.map((s) => ({
        code: s.code, done: s.done, pages: s.pages, items: s.items, n: s.n, ok: s.ok,
        rate: pct(s.ok, s.n), wrong: s.wrong || 0, last: s.last || '', round: s.round,
        next: (s.recent || 0) + 1,
        gone: s.last ? Math.round((new Date(today) - new Date(s.last)) / 86400000) : 999,
      })).sort((a, b) => (a.done / (a.pages || 1)) - (b.done / (b.pages || 1))),
      /* 오래 손 안 댄 교재(보관)는 쪽 지도를 싣지 않는다 — 요약을 가볍게 유지한다.
       * 다시 풀기 시작하면 다음 집계에서 저절로 돌아온다. */
      map: (state === 'idle' ? [] : map), hot,
    });
  });

  /* 정렬 — 기본은 최근 학습 순 */
  out.sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.items - a.items);

  const stuSet = {}; out.forEach((b) => b.stus.forEach((s) => { stuSet[s.code] = 1; }));
  const wk = Object.keys(weekBuckets).sort().map((d) => ({ d, n: weekBuckets[d] }));
  const tot = out.reduce((a, b) => ({ n: a.n + b.n, ok: a.ok + b.ok }), { n: 0, ok: 0 });
  const w1 = out.reduce((a, b) => ({ n: a.n + (b.w1n || 0), ok: a.ok + (b.w1ok || 0) }), { n: 0, ok: 0 });

  return {
    at: new Date().toISOString(),
    cfg,
    sum: {
      books: out.length,
      students: Object.keys(stuSet).length,
      week: wk.reduce((a, x) => a + x.n, 0),
      items: tot.n, rate: pct(tot.ok, tot.n),
      stalled: out.filter((b) => b.state === 'stall').length,
      hard: out.filter((b) => b.state === 'hard').length,
      near: out.filter((b) => b.state === 'near').length,
      idle: out.filter((b) => b.state === 'idle').length,
      live: out.filter((b) => b.state !== 'idle').length,
    },
    week: wk,
    levels: allLv,
    books: out,
    _seen: seen, _skipped: skipped,
  };
}

/* ═══ 실행 ═══ */
async function runBookDash() {
  if (!SB_URL || !SB_KEY) { log('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); return null; }
  let cfg = await kvGet('book_dash_cfg');
  cfg = Object.assign({}, DEF_CFG, (cfg && typeof cfg === 'object') ? cfg : {});

  const src = await loadBooks();
  log(`교재 후보 ${Object.keys(src.books).length}권 · 학생 교재 연결 ${Object.keys(src.sw2bid).length}개`);
  const recs = await loadRecords();
  log(`교재 채점 기록 ${recs.length}건`);

  const dash = build(cfg, src, recs);
  log(`→ 교재 ${dash.sum.books}권(쓰는 중 ${dash.sum.live} · 보관 ${dash.sum.idle}) · 학생 ${dash.sum.students}명 · 이번 주 ${dash.sum.week}문항 · 평균 정답률 ${dash.sum.rate}% · 멈춤 ${dash.sum.stalled}권`);
  if (dash._skipped) log(`  (교재 목록에 없어 건너뜀 ${dash._skipped}건 — 퇴원생이거나 아직 수집 안 된 교재)`);

  if (DRY) {
    dash.books.slice(0, 8).forEach((b) => {
      const ic = { stall: '🔴', hard: '🟡', near: '🏁', idle: '⬜' }[b.state] || '🟢';
      log(`   ${ic} ${b.title} · 학생 ${b.nstu} · 평균 ${b.avg}/${b.pages}쪽(${b.prog}%) · 정답률 ${b.rate}%${b.delta != null ? (b.delta > 0 ? ' ▲' + b.delta : ' ▼' + Math.abs(b.delta)) : ''} · 최근 ${b.last} · 쪽지도 ${b.map.length}쪽 · 틀린쪽 ${b.hot.length}`);
    });
    const size = JSON.stringify(dash).length;
    log(`   요약 크기 ${(size / 1024).toFixed(0)}KB`);
    return dash;
  }
  delete dash._seen; delete dash._skipped;
  const okSave = await kvSet('book_dash', dash);
  log(okSave ? '저장 완료 — lumen_store book_dash' : '저장 실패');
  return dash;
}

if (require.main === module) {
  runBookDash().then(() => process.exit(0)).catch((e) => { log('실패:', e.message); process.exit(1); });
}
module.exports = { runBookDash, build, DEF_CFG };
