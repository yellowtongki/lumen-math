#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 수학비서 교과서·시험대비 DB → 매쓰플랫 이식기  v1  (2026-08-31)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나요?】
 *   수학비서에서 구매한 교과서 교사용 DB(수백 문항)를 매쓰플랫 「기타 학습자료」
 *   학습지로 옮깁니다. 매쓰플랫 화면의 1회 인식 문항수 제한을 피하려고
 *   <b>대단원별로 잘라</b> 여러 장의 학습지로 등록합니다 (2026-08-31 원장 결정).
 *   기존 exam_twin_pipeline.js(기출 37장으로 검증)에 cellFilter만 얹은 것입니다.
 *
 * 【사용법】
 *   node sync/db_transplant.js --query "황선욱 미적분1" --subject 미적분1 --plan
 *       → 수학비서만 접속해 대상 DB·대단원 분할 미리보기 (매쓰플랫 접속 없음)
 *   node sync/db_transplant.js --query "황선욱 미적분1" --subject 미적분1
 *       → 실제 등록 (대단원별 학습지 + 폴더 정리)
 *   옵션: --mydb 123,456     제목 검색 대신 DB 번호 직접 지정
 *         --mylist "교과서 미적분1"   폴더 이름 (기본: 「교과서 <과목>」)
 *         --whole 123        분할 없이 이 DB 하나를 통짜 등록해 회당 상한 실측
 *                            (학습지는 안 만들고 기타자료 원본까지만)
 *         --limit N          앞에서 N묶음만 (시범)
 *         --chunk 50         한 묶음 최대 문항수 (대단원이 이보다 크면 반으로)
 *         --no-resume        이미 넣은 묶음도 다시 넣는다
 *
 * 【이어하기】 넣은 기록은 lumen_store 'db_transplant'에 남습니다.
 *   중간에 끊겨도 다시 실행하면 안 넣은 묶음부터 이어서 합니다.
 *
 * 계정: MATHSECR_ID/PASSWORD, MATHFLAT_ID/PASSWORD, SUPABASE_URL/SERVICE_KEY (환경변수만)
 * 주의: 매쓰플랫 동시 로그인 시 원장님 접속이 끊길 수 있습니다 — 새벽 실행 권장.
 */
const { runTwinPipeline } = require('./exam_twin_pipeline.js');

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const STATE_KEY = 'db_transplant';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

function log(...a) { console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 22개정 고등 과목 키 — hs_exam_import.js와 같은 실측값 (2026-08-28) */
const HS_TRIE = {
  '공통수학1': '1.4.4147.4175', '공통수학2': '1.4.4147.4176',
  '대수': '1.4.4147.4177', '미적분1': '1.4.4147.4178',
  '확률과통계': '1.4.4147.4179', '미적분2': '1.4.4147.4180', '기하': '1.4.4147.4181',
};
/* gradeSemester 표기 — 기출 37장에서 검증된 「고 N-S」 형식을 그대로 쓴다 */
const SUBJECT_GRADESEM = {
  '공통수학1': '고 1-1', '공통수학2': '고 1-2', '대수': '고 2-1', '미적분1': '고 2-2',
  '확률과통계': '고 3-1', '미적분2': '고 3-1', '기하': '고 3-2',
};

/* ── 수학비서 (hs_exam_import와 동일 방식) ── */
let MS_TOKEN = null;
const msH = () => ({ accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  MS_TOKEN = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!MS_TOKEN) throw new Error('수학비서 로그인 실패 ' + r.status);
}
async function msGet(p) {
  const r = await fetch(MS_API + p, { headers: msH() });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return j;
}
async function msListAll() {
  const all = []; let cursor = '';
  for (let i = 0; i < 60; i++) {
    const p = await msGet(`/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const items = (p.data && p.data.mydbs) || [];
    all.push(...items);
    cursor = p.pagination && p.pagination.cursor;
    if (!cursor || !items.length) break;
  }
  return all;
}
async function msCellsRaw(id) {
  const cells = []; let cursor = '';
  for (let i = 0; i < 40; i++) {
    const j = await msGet(`/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    ((j.data && j.data.pages) || []).forEach((pg) => (pg.cells || []).forEach((c) => cells.push(c)));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return cells;
}

/* 문항의 대단원 이름 — mockexam_engine과 같은 규칙:
 * chapters[0].chapter = [큰 분류, 대단원, 중단원, …] 에서 두 번째(없으면 첫 번째) */
function unitOf(c) {
  const chArr = (c.chapters && c.chapters[0] && c.chapters[0].chapter) || [];
  return (chArr.length > 1 ? chArr[1] : chArr[0]) || '단원 미분류';
}

/* ── 상태 (이어하기) ── */
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
async function stateGet() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${STATE_KEY}&select=value`, { headers: sbH() });
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v || { done: {} };
  } catch (e) { return { done: {} }; }
}
async function stateSet(st) {
  await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: STATE_KEY, value: st, updated_at: new Date().toISOString() }),
  });
}

/* DB 제목 → 학습지 제목에 붙일 짧은 자료명 (「자료1 (소단원 수준별문제)」→「수준별」) */
function kindOf(title) {
  const t = String(title || '');
  if (t.includes('수준별')) return '수준별';
  if (t.includes('대단원 평가')) return '대단원평가';
  if (t.includes('중단원 평가')) return '중단원평가';
  const m = t.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].replace(/문제$/, '').trim() : '';
}

(async () => {
  const QUERY = arg('query', '');
  const MYDB_ARG = arg('mydb', '');
  const SUBJECT = arg('subject', '');
  const PLAN = has('--plan');
  const WHOLE = arg('whole', '');
  const LIMIT = Number(arg('limit', 0));
  const CHUNK_MAX = Number(arg('chunk', 50));
  /* --maxunit 05: 대단원 코드가 이보다 큰 문항은 뺀다 (진도 절단 —
   * 예: 미적분1 2학기 중간 = 「05 함수의 증가와 감소」(삼차·사차 그래프)까지,
   * 06 방부등식·속도가속도, 07~ 적분 제외. 2026-08-31 원장 지시) */
  const MAX_UNIT = arg('maxunit', '');
  const RESUME = !has('--no-resume');
  const trie = HS_TRIE[SUBJECT];
  if (!WHOLE && !SUBJECT) throw new Error('--subject 과목명(예: 미적분1)이 필요합니다');
  if (SUBJECT && !trie) throw new Error(`--subject 「${SUBJECT}」의 교육과정 키가 없습니다 (가능: ${Object.keys(HS_TRIE).join(', ')})`);
  const MYLIST = arg('mylist', `교과서 ${SUBJECT}`);

  await msLogin();

  // 대상 DB 찾기
  let targets = [];
  if (MYDB_ARG) {
    targets = MYDB_ARG.split(',').map((s) => ({ id: Number(s.trim()), title: 'DB ' + s.trim() }));
  } else {
    if (!QUERY && !WHOLE) throw new Error('--query 또는 --mydb가 필요합니다');
    const all = await msListAll();
    const q = QUERY.replace(/\s+/g, '');
    targets = all.filter((d) => String(d.title || '').replace(/\s+/g, '').includes(q))
      .map((d) => ({ id: d.id, title: d.title }));
  }
  if (WHOLE) targets = [{ id: Number(WHOLE), title: 'DB ' + WHOLE }];
  if (!targets.length) throw new Error('대상 DB를 찾지 못했습니다 — --query를 확인해 주세요');
  log(`대상 DB ${targets.length}개:`); targets.forEach((t) => log(`  · [${t.id}] ${t.title}`));

  /* ── 통짜 상한 실측 모드 ──
   * 학습지는 만들지 않고(skipWorksheet) AI 인식 → 기타자료 원본까지만 —
   * 「한 번에 몇 문항까지 들어가나」를 재는 게 목적이라 결과물을 어지르지 않는다. */
  if (WHOLE) {
    const t0 = Date.now();
    const subj = SUBJECT || '미적분1';
    const out = await runTwinPipeline({
      mydb: Number(WHOLE), trie: trie || HS_TRIE[subj], grade: SUBJECT_GRADESEM[subj],
      gradeValue: subj, title: `상한실측 ${WHOLE}`, skipWorksheet: true, log,
    });
    log(`통짜 실측 결과: ${out.matchedTotal}상자 인식 · 문제은행 매칭 ${out.matched} · ${((Date.now() - t0) / 60000).toFixed(1)}분 · paper ${out.paperId}`);
    return;
  }

  // 대단원별 분할 계획
  const st = await stateGet();
  const jobs = [];
  for (const t of targets) {
    const cells = await msCellsRaw(t.id);
    const kind = kindOf(t.title);
    const groups = {};   // 대단원 → questionNumber 집합 (순서 보존)
    const order = [];
    let cut = 0;
    cells.forEach((c) => {
      const u = unitOf(c);
      if (MAX_UNIT) {
        const code = (u.match(/^(\d{2})/) || [])[1];
        if (!code || code > MAX_UNIT) { cut++; return; }   // 진도 밖 → 제외
      }
      if (!groups[u]) { groups[u] = []; order.push(u); }
      groups[u].push(c.questionNumber);
    });
    log(`[${t.id}] ${t.title} — ${cells.length}문항 · 대단원 ${order.length}개${cut ? ` · 진도 밖 제외 ${cut}문항 (--maxunit ${MAX_UNIT})` : ''}`);
    order.forEach((u) => {
      // 대단원이 상한보다 크면 앞/뒤로 나눈다 (문항 번호순 유지)
      const nos = groups[u];
      const parts = [];
      if (nos.length > CHUNK_MAX) {
        const n = Math.ceil(nos.length / Math.ceil(nos.length / CHUNK_MAX));
        for (let i = 0; i < nos.length; i += n) parts.push(nos.slice(i, i + n));
      } else parts.push(nos);
      parts.forEach((pNos, pi) => {
        const partLab = parts.length > 1 ? ` (${pi + 1}/${parts.length})` : '';
        const title = [SUBJECT, u, kind].filter(Boolean).join(' ') + partLab + ' (미래엔)';
        jobs.push({ key: `${t.id}|${u}|${pi}`, mydb: t.id, unit: u, title, nos: pNos });
        log(`    → 「${title}」 ${pNos.length}문항`);
      });
    });
  }
  let todo = jobs;
  if (RESUME) todo = jobs.filter((j) => !st.done[j.key]);
  if (LIMIT) todo = todo.slice(0, LIMIT);
  log(`등록할 묶음: ${todo.length}/${jobs.length}${RESUME ? ' (이미 넣은 것 제외)' : ''}`);
  if (PLAN) { log('--plan: 여기까지 (매쓰플랫 접속 없음)'); return; }

  // 등록 실행
  const ok = [], fail = [];
  for (let i = 0; i < todo.length; i++) {
    const j = todo[i];
    log(`\n── [${i + 1}/${todo.length}] ${j.title} (${j.nos.length}문항) ──`);
    const noSet = new Set(j.nos);
    try {
      const out = await runTwinPipeline({
        mydb: j.mydb, trie, grade: SUBJECT_GRADESEM[SUBJECT], gradeValue: SUBJECT,
        title: j.title, mylist: MYLIST, originalOnly: true, log,
        cellFilter: (c) => noSet.has(c.questionNumber),
      });
      ok.push({ key: j.key, title: j.title, ws: out.worksheetOriginal, matched: `${out.matched}/${out.matchedTotal}` });
      st.done[j.key] = { at: new Date().toISOString(), title: j.title, worksheet: out.worksheetOriginal, paper: out.paperId, n: j.nos.length };
      await stateSet(st);
      log(`✅ 완료 — 매칭 ${out.matched}/${out.matchedTotal}`);
    } catch (e) {
      fail.push({ key: j.key, title: j.title, err: String(e.message).slice(0, 200) });
      log(`❌ 실패: ${e.message.slice(0, 200)}`);
    }
    if (i < todo.length - 1) await sleep(3000);
  }
  console.log(`\n══ 마무리 ══\n성공 ${ok.length}묶음 · 실패 ${fail.length}묶음 → 폴더 「${MYLIST}」`);
  ok.forEach((x) => console.log(`  ✅ ${x.title} (학습지 ${x.ws} · 매칭 ${x.matched})`));
  fail.forEach((x) => console.log(`  ❌ ${x.title} — ${x.err}`));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
