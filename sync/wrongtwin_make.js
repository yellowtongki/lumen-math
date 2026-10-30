#!/usr/bin/env node
/**
 * 📄 오답 쌍둥이 숙제 — 학생마다 «아직 틀린 문제»마다 쌍둥이 1문제를 매쓰플랫 «숙제» 학습지로 출제
 * ═══════════════════════════════════════════════════════════════════
 * 원장 2026-10-28 「월수금은 금요일 · 화목토는 토요일 오답 프린트를 자동으로 · 오답 쌍둥이 · 문제 제한 없음 ·
 *   매쓰플랫에 숙제 태그로 각 학생에게 출제 · 처음은 10월부터(시험범위 단원만) · 중3 제외 · 새벽 5시 ·
 *   많으면 나눠서 · 다시 맞힌 문제는 뺌 · 리커버리 학습지와 겹쳐도 둘 다」 · 시험범위 초안(작년 2학기 기말) 원장 확인.
 * 계약서: docs/wrong_twin_contract.md · 시안: docs/mockup_wrong_twin.html
 *
 * 규칙
 *   · 대상 = 재원생 · 중3 제외(wt_config.excludeGrades) · 반 요일(lumen_group_days)로 나눔:
 *       금요일 출제(fri) = 금요일 수업이 있는 반(월수금) · 토요일 출제(sat) = 그 밖의 수업 반(화목토 · 화목)
 *   · 문제 = 매쓰플랫 채점 기록(mf_answer_records)에서 문제마다 마지막 결과가 ✗ 인 것(다시 풀어 맞힌 문제는 뺌)
 *       · 그 ✗ 가 wt_config.start(첫 회 10/1) 뒤이고 · 그 문제를 아직 쌍둥이로 낸 적이 없을 때(또는 낸 뒤에 또 틀렸을 때)
 *       · 학교 시험범위(wt_scope «학교|학년».mids = 매쓰플랫 중단원 이름)가 있으면 그 단원만 · 없으면(초등 등) 전부
 *   · 쌍둥이 = 매쓰플랫 쌍둥이(/derivation) 1개 — 없으면 같은 유형·비슷한 난도 다른 문제 1개 · 자동채점 문항만 ·
 *       이 학생이 이미 푼 문제는 안 고름 · 한 번에 최대 wt_config.maxPer(60)문항 — 최근에 틀린 것 먼저, 나머지는 다음 출제로 넘김
 *       (원장 2026-10-28 «첫 회 분량이 크다(금요일 반 1,350문항) → 한 번에 최대 60»). wt_config.chunk(60)문항씩 나눠 여러 장
 *   · 학습지 = 태그 HOMEWORK · 머리말 «숙제» · 제목 «오답쌍둥이 10/30 이름 (1/3)» · 그 학생에게 바로 배정
 *   · 교재 오답은 매쓰플랫 문항 번호가 기록에 없다 → 교재 번호표(mf_textbook_<교재>)로 찾고, 없으면 같은 유형으로
 *
 * 실행
 *   node sync/wrongtwin_make.js --batch fri|sat|auto [--dry] [--only 코드,코드] [--wait-collect]
 *     --batch auto : 한국 시간 오늘이 금 → fri · 토 → sat · 그 밖이면 아무것도 안 함
 *     --dry        : 설계만(매쓰플랫에서 쌍둥이 조회는 함 · 학습지는 안 만듦) → wt_preview 에 학생별 숫자
 *     --wait-collect: 새벽 정기 수집이 아직이면 최대 90분 기다린다(예약 실행용)
 *     --no-save    : 서버에 아무것도 안 씀(검사용)
 * 서버 키(lumen_store): wt_config · wt_scope · wt_state(낸 문제 장부) · wt_preview(설계 결과) · wt_log(최근 실행 20개) · wt_req(학원앱 요청)
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID · MATHFLAT_PASSWORD (값은 어디에도 적지 않는다)
 * 로그에는 학생 이름 첫 글자만 쓴다(깃허브 로그는 공개).
 */
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !/^--/.test(args[i + 1]) ? args[i + 1] : d; };
const DRY = args.includes('--dry'), NOSAVE = args.includes('--no-save'), WAIT = args.includes('--wait-collect');
const ONLY = String(opt('only', '')).split(',').map((s) => s.trim()).filter(Boolean);
const EXCL_WS = String(opt('exclude-ws', '')).split(',').map((s) => s.trim()).filter(Boolean);   // ★ 이 학습지들에 이미 든 문제는 고르지 않음(예: 같은 날 리커버리 학습지와 겹치지 않게)
const MF = 'https://api.mathflat.com', WEB = 'https://teacher.mathflat.com';
const DESIGN = { layoutType: 11, layoutColor: 'GREEN', partitionType: 4, wrongAnswerNoteFlag: false, conceptNameFlag: false, problemTrendFlag: false,
  answerRateFlag: false, qrFlag: true, relationWorkbookFlag: true, includeProblemFlag: false, pdfDateType: 'TODAY', pdfDate: null,
  designTemplateId: 41988, problemPadding: 60, conceptSortType: 'CHAPTER' };   // 리커버리 학습지와 같은 모양
const mask = (n) => (n ? String(n).charAt(0) + '○○' : '?');
const log = (...a) => console.log(...a);

/* 기본 설정 — 서버에 wt_config / wt_scope 가 없을 때 처음 한 번 써 둔다(학원앱에서 고친다) */
const DEF_CONFIG = { on: true, twinOnly: true, start: '2026-10-01', chunk: 60, maxPer: 60, excludeGrades: ['중3'], hiSubject: { '고1': '공통수학2', '고2': '미적분1', '고3': '미적분2' }, skip: {}, v: 1 };
/* 시험범위 초안 = 작년 같은 시험(2학기 기말) 범위 — 원장 확인 2026-10-28. mids = 매쓰플랫 중단원 이름(/concept/chips middleChapterName) */
const DEF_SCOPE = { v: 1, note: '작년 2학기 기말 범위로 만든 초안 (원장 확인 2026-10-28) — 학교에서 실제 범위가 나오면 고친다', byKey: {
  '옥길중|중1': { exam: '2학기 기말', date: '2026-12-18', src: '2024·2025 2학기 기말: 중1-2 다각형 ~ 자료의 정리와 해석', mids: ['다각형', '원과 부채꼴', '다면체와 회전체', '입체도형의 겉넓이와 부피', '자료의 정리와 해석'] },
  '옥길중|중2': { exam: '2학기 기말', date: '2026-12-18', src: '2024 2학기 기말: 중2-2 평행선과 선분의 길이의 비 ~ 확률', mids: ['닮은 도형의 성질', '피타고라스 정리', '경우의 수와 확률'] },
  '범박고|고1': { exam: '2학기 기말', date: '2026-12-07', subject: '공통수학2', src: '2025 2학기 기말: 공통수학2 명제 ~ 무리식과 무리함수', mids: ['명제', '함수', '유리함수와 무리함수', '유리식과 유리함수', '무리식과 무리함수'] },
  '범박고|고2': { exam: '2학기 기말', date: '2026-12-07', subject: '미적분1', src: '2025 2학기 기말: 미적분1 방정식·부등식과 직선운동 ~ 정적분의 활용', mids: ['도함수의 활용', '부정적분과 정적분', '정적분의 활용'] },
  '소사고|고1': { exam: '2학기 기말', date: '2026-12-10', subject: '공통수학2', src: '2025 2학기 기말: 공통수학2 집합의 연산 ~ 무리식과 무리함수', mids: ['집합', '명제', '함수', '유리함수와 무리함수', '유리식과 유리함수', '무리식과 무리함수'] },
  '소사고|고2': { exam: '2학기 기말', date: '2026-12-10', subject: '미적분1', src: '2024 2학기 기말: 미적분1 함수의 증가와 감소 ~ 정적분의 활용', mids: ['도함수의 활용', '부정적분과 정적분', '정적분의 활용'] } } };

/* ── 작은 도구 ── */
const kst = (d) => new Date((d ? new Date(d) : new Date()).getTime() + 9 * 3600000);
const kday = (iso) => kst(iso).toISOString().slice(0, 10);
const T = (iso) => Date.parse(iso || '') || 0;
const gradeKey = (g) => { const m = String(g || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? m[1] + m[2] : ''; };
const shortSchool = (s) => String(s || '').trim().replace(/등학교$|학교$/, '').replace(/^(.+)(초|중|고)$/, '$1$2');
const scopeKey = (st) => shortSchool(st.school) + '|' + gradeKey(st.grade);
function schoolOf(grade, subject) {
  const m = String(grade || '').match(/(초|중|고)[^0-9]*(\d)/); if (!m) return null;
  if (m[1] === '고') return subject ? { schoolType: 'HIGH', grade: subject } : null;
  return { schoolType: m[1] === '초' ? 'ELEMENTARY' : 'MIDDLE', grade: m[2] };
}
const mfAutoOk = (a) => a === true || (typeof a === 'string' && a !== '' && !/^IMPOSSIBLE/.test(a) && a !== 'UNDEFINED' && a !== 'UNIDENTIFIED');   // rcws_make.js 와 같다
const bankId = (p) => { const m = String((p && p.pimg) || '').match(/\/problem\/(\d+)\//); return m ? Number(m[1]) : null; };

/* ── Supabase ── */
async function q(path) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`${path.slice(0, 60)} → ${r.status}`); return r.json(); }
async function store(keys) { const out = {}; if (!keys.length) return out; const rows = await q(`lumen_store?select=key,value,updated_at&key=in.(${keys.map(encodeURIComponent).join(',')})`); rows.forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; out['@' + x.key] = x.updated_at; }); return out; }
async function setItem(key, value) { if (NOSAVE) return; const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) }); if (!r.ok) throw new Error(`저장 실패 ${key} ${r.status}`); }
async function recsOf(sid, since) {
  const sel = 'select=source,worksheet_type,worksheet_title,book_id,page,number,workbook_problem_id,problem_id,concept_id,level,result,score_datetime';
  let out = [];
  for (let off = 0; off < 20000; off += 1000) {
    const a = await q(`mf_answer_records?${sel}&mf_student_id=eq.${encodeURIComponent(sid)}&score_datetime=gte.${encodeURIComponent(since)}&order=score_datetime.asc,id.asc&limit=1000&offset=${off}`);
    out = out.concat(a); if (a.length < 1000) break;
  }
  return out;
}

/* ── 매쓰플랫 ── */
let TOK = null;
async function mfLogin() {
  const r = await fetch(`${MF}/v2/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: WEB, referer: WEB + '/' },
    body: JSON.stringify({ id: String(process.env.MATHFLAT_ID || '').trim(), password: String(process.env.MATHFLAT_PASSWORD || '').trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json(); if (!r.ok || !j.accessToken) throw new Error('매쓰플랫 로그인 실패 ' + (j.code || r.status)); TOK = j.accessToken;
}
async function mf(method, p, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(`${MF}${p}`, { method, headers: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', authorization: 'Bearer ' + TOK, 'x-auth-token': TOK, origin: WEB, referer: WEB + '/' }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (r.ok) return j && (j.data !== undefined ? j.data : j);
    if (i < 2 && (r.status === 401 || (j && j.code === 'UNAUTHORIZED'))) { await mfLogin(); continue; }   // 오래 돌면 로그인이 풀린다(2026-10-28 실측 약 20분) → 다시 로그인
    if (i < 2 && (r.status === 429 || r.status >= 500)) { await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); continue; }
    throw new Error(`${(j && j.code) || r.status} @ ${p}`);
  }
}
const FILTER = (cids, n) => ({ type: 'CONCEPT', conceptIdList: cids, excludedTopicIds: [], excludedSubTopicIds: [], problemList: null, problemCount: n || 100, level: 3, levelWeight: [10, 30, 30, 20, 10],
  problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: true, excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] });

/* ── 한 학생: 문제 고르기 ── */
function wrongList(rs, cfg, given, mids, CN) {
  const last = {}, firstX = {}, solved = {};
  rs.forEach((x) => {
    const bk = x.source === '교재';
    const k = bk ? (x.workbook_problem_id ? 'w' + x.workbook_problem_id : '') : (x.problem_id ? 'p' + x.problem_id : '');
    if (x.problem_id) solved[String(x.problem_id)] = 1;
    if (!k) return;
    if (x.result === 'X' && !firstX[k]) firstX[k] = x;
    const o = last[k]; if (!o || T(x.score_datetime) >= T(o.score_datetime)) last[k] = x;
  });
  const out = [], st = { fixed: 0, outScope: 0, unknown: 0, already: 0 };
  Object.keys(last).forEach((k) => {
    const x = last[k];
    if (x.result !== 'X') { if (firstX[k]) st.fixed++; return; }
    if (given[k] && T(given[k]) >= T(x.score_datetime)) { st.already++; return; }   // 이 ✗ 뒤에 이미 쌍둥이를 냈다
    const m = (CN[x.concept_id] || {}).m || '';
    if (mids) { if (!m) st.unknown++; else if (mids.indexOf(m) < 0) { st.outScope++; return; } }
    const bk = x.source === '교재', test = !bk && (x.worksheet_type === 'WEEKLY' || /주간/.test(String(x.worksheet_title || '')));
    out.push({ k, src: bk ? 'book' : (test ? 'test' : 'ws'), bid: bk ? String(x.book_id) : '', wpId: bk ? Number(x.workbook_problem_id) : null, pid: bk ? null : Number(x.problem_id),
      cid: Number(x.concept_id), lv: Number(x.level) || 3, m, at: x.score_datetime, page: x.page, no: x.number, title: x.worksheet_title || '' });
  });
  out.sort((a, b) => T(a.at) - T(b.at));
  return { list: out, solved, st };
}

async function main() {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  const startedAt = new Date().toISOString();
  let batch = opt('batch', 'auto');
  if (batch === 'auto') { const d = kst().getUTCDay(); batch = d === 5 ? 'fri' : d === 6 ? 'sat' : ''; if (!batch) { log('오늘은 출제하는 날이 아닙니다(금·토만)'); return; } }
  if (['fri', 'sat', 'all'].indexOf(batch) < 0) { console.error('❌ --batch fri|sat|all|auto'); process.exit(1); }
  let st = await store(['wt_config', 'wt_scope', 'wt_state', 'or_studentdb', 'lumen_group_days', 'mf_concept_names', 'mf_weekly']);
  if (!st.wt_config) { await setItem('wt_config', DEF_CONFIG); st.wt_config = DEF_CONFIG; if (!NOSAVE) log('wt_config 기본값을 처음 저장'); }
  if (!st.wt_scope) { await setItem('wt_scope', DEF_SCOPE); st.wt_scope = DEF_SCOPE; if (!NOSAVE) log('wt_scope 시험범위 초안을 처음 저장'); }
  const cfg = Object.assign({}, DEF_CONFIG, st.wt_config || {});
  if (cfg.on === false && !DRY && !ONLY.length) { log('자동 출제가 꺼져 있습니다(wt_config.on=false)'); return; }
  /* ★ 같은 날 같은 반 출제는 한 번만 — 깃허브 예약이 늦게 돌거나 손으로 먼저 돌렸을 때 두 번 나가지 않게 (2026-10-31) */
  if (!DRY && !ONLY.length) { const lg0 = (await store(['wt_log'])).wt_log || { runs: [] }; const dup = (lg0.runs || []).find((r) => !r.dry && !r.only && r.batch === batch && kday(r.at) === kday()); if (dup) { log(`오늘(${kday()}) ${batch} 출제는 이미 했습니다 (${dup.at}) — 건너뜀`); return; } }
  /* 새벽 정기 수집이 끝났는지 — mf_weekly 가 오늘 한국 03시 뒤에 갱신됐는지. 아니면 최대 90분 기다림 */
  if (WAIT) {
    const need = Date.parse(kday() + 'T03:00:00+09:00');
    for (let i = 0; i < 18 && T(st['@mf_weekly']) < need; i++) { log(`정기 수집 기다림 (${i + 1}/18) — 마지막 ${st['@mf_weekly'] || '없음'}`); await new Promise((r) => setTimeout(r, 300000)); st = Object.assign(st, await store(['mf_weekly'])); }
  }
  const scope = (st.wt_scope && st.wt_scope.byKey) || {};
  const CN = st.mf_concept_names || {};
  const days = st.lumen_group_days || {};
  const state = st.wt_state || { byCode: {}, v: 1 }; state.byCode = state.byCode || {};
  const batchOf = (g) => { const d = days[String(g || '').trim()]; if (!Array.isArray(d) || !d.length) return ''; return d.indexOf(5) >= 0 ? 'fri' : 'sat'; };
  const sdb = (Array.isArray(st.or_studentdb) ? st.or_studentdb : Object.values(st.or_studentdb || {})).filter((s) => s && !s.withdrawn && s.lumen_rec_code);
  const excl = (cfg.excludeGrades || []).map(String);
  const today = kday();
  const targets = sdb.filter((s) => {
    if (ONLY.length) return ONLY.indexOf(s.lumen_rec_code) >= 0;
    if (excl.indexOf(gradeKey(s.grade)) >= 0) return false;
    if (cfg.skip && cfg.skip[s.lumen_rec_code] && cfg.skip[s.lumen_rec_code] >= today) return false;   // 원장이 «이번엔 건너뛰기»
    return batch === 'all' || batchOf(s.group) === batch;
  });
  const mfs = await q('mf_students?select=mf_student_id,name,lumen_rec_code');
  log(`📄 오답 쌍둥이 ${batch === 'fri' ? '금요일(월수금 반)' : batch === 'sat' ? '토요일(화목토 반)' : '전체'} · 대상 ${targets.length}명 · 시작 ${cfg.start} · ${cfg.chunk}문항씩 · ${DRY ? '[설계만]' : '[실제 출제]'}`);
  await mfLogin();
  const exclIds = {}; for (const w of EXCL_WS){ try { const a = await mf('GET', '/worksheet/' + w); ((a && (a.problems || a.problemList)) || []).forEach((p) => { if (p && p.id) exclIds[String(p.id)] = 1; });   /* GET /worksheet/{id} 의 문제 목록 칸 = problems */ } catch(e){ log('⚠ 학습지 #' + w + ' 문제 목록을 못 읽음: ' + e.message); } }
  if (EXCL_WS.length) log(`빼는 문제: 학습지 ${EXCL_WS.length}장 · ${Object.keys(exclIds).length}문제`);
  const bankCache = {};
  const bankOf = async (bid) => { if (bankCache[bid] !== undefined) return bankCache[bid]; const s2 = await store(['mf_textbook_' + bid]); const b = s2['mf_textbook_' + bid]; const m = {}; if (b && b.problems) b.problems.forEach((p) => { const id = bankId(p); if (id) m[String(p.id)] = id; }); bankCache[bid] = Object.keys(m).length ? m : null; return bankCache[bid]; };
  const prevRows = {}; ((await store(['wt_preview'])).wt_preview || { rows: [] }).rows.forEach((r) => { prevRows[r.code] = r; });
  const rows = [], dd = kst(); const md = (dd.getUTCMonth() + 1) + '/' + dd.getUTCDate();
  for (const s of targets) {
    const code = s.lumen_rec_code, name = s.name || code;
    const hit = mfs.find((m) => m.lumen_rec_code && m.lumen_rec_code === code) || (mfs.filter((m) => m.name === name).length === 1 ? mfs.find((m) => m.name === name) : null);
    const row = { code, grp: s.group || '', grade: gradeKey(s.grade), batch: batchOf(s.group), at: startedAt, dry: DRY };
    log(`\n▶ ${mask(name)} ${row.grade} ${row.grp}`);
    if (!hit) { row.err = '매쓰플랫 학생 번호 없음'; log('  ✗ ' + row.err); rows.push(row); continue; }
    const sid = hit.mf_student_id, sk = scopeKey(s), sc = scope[sk] || null;
    const my = state.byCode[code] = state.byCode[code] || { given: {}, runs: [] }; my.given = my.given || {};
    try {
      const rs = await recsOf(sid, cfg.start + 'T00:00:00+09:00');
      const W = wrongList(rs, cfg, my.given, sc ? sc.mids : null, CN);
      Object.assign(row, { scope: sc ? sk : '', nWrong: W.list.length, fixed: W.st.fixed, outScope: W.st.outScope, unknown: W.st.unknown, already: W.st.already,
        bySrc: { ws: W.list.filter((w) => w.src === 'ws').length, book: W.list.filter((w) => w.src === 'book').length, test: W.list.filter((w) => w.src === 'test').length } });
      log(`  기록 ${rs.length} · 아직 틀린 새 문제 ${W.list.length} (학습지 ${row.bySrc.ws} · 교재 ${row.bySrc.book} · 주간T ${row.bySrc.test}) · 다시 맞힘 ${W.st.fixed} · 이미 냄 ${W.st.already}${sc ? ` · 범위 ${sk}: 범위 밖 ${W.st.outScope} · 단원 모름 ${W.st.unknown}(넣음)` : ' · 범위 없음 → 전부'}`);
      if (!W.list.length) { row.n = 0; rows.push(row); continue; }
      const maxPer = Number(cfg.maxPer) || 0;   /* 한 번에 최대 — 최근에 틀린 것 먼저. 안 낸 것은 장부(given)에 안 적으니 다음 출제에 다시 나온다 */
      if (maxPer && W.list.length > maxPer) { const keep = W.list.slice().sort((a, b) => T(b.at) - T(a.at)).slice(0, maxPer); row.carry = W.list.length - keep.length; W.list = keep.sort((a, b) => T(a.at) - T(b.at)); log(`  한 번에 최대 ${maxPer} — 최근 ${maxPer}개만 · ${row.carry}개는 다음 출제로`); }
      /* 교재 오답 → 매쓰플랫 문항 번호(교재 번호표) */
      for (const w of W.list) if (w.src === 'book' && w.bid && !w.pid) { const b = await bankOf(w.bid); if (b && b[String(w.wpId)]) w.pid = b[String(w.wpId)]; }
      const solved = W.solved; W.list.forEach((w) => { if (w.pid) solved[String(w.pid)] = 1; }); Object.assign(solved, exclIds);
      const cids = [...new Set(W.list.map((w) => w.cid).filter((c) => c))];
      const fid = await (async () => { const f = await mf('POST', '/worksheet/filter/concept', FILTER(cids.slice(0, 300))); return f.filterId || f; })();
      const chosen = {}, pool = {}, tried = {}; let nTwin = 0, nSame = 0, nNone = 0;
      const pick = (list, lv) => { const ok = list.filter((p) => mfAutoOk(p.autoScoredType) && !solved[String(p.id)] && !chosen[String(p.id)]); ok.sort((a, b) => Math.abs((a.lv || 3) - lv) - Math.abs((b.lv || 3) - lv)); const p = ok[0]; if (p) chosen[String(p.id)] = 1; return p || null; };
      const addPool = (ps) => (Array.isArray(ps) ? ps : (ps && ps.problemList) || []).forEach((p) => { const pr = p.problem || p; if (pr.conceptId && pr.id) (pool[pr.conceptId] = pool[pr.conceptId] || []).push({ id: pr.id, lv: pr.level || 3, autoScoredType: pr.autoScoredType }); });
      const same = async (cid, lv) => {
        let p = pick(pool[cid] || [], lv); if (p || tried[cid]) return p; tried[cid] = 1;
        try { const f2 = await mf('POST', '/worksheet/filter/concept', FILTER([cid], 40)); addPool(await mf('POST', '/worksheet/problem', { filterId: f2.filterId || f2 })); } catch (e) {}
        return pick(pool[cid] || [], lv);
      };
      const items = [], noTwin = [], twinOnly = cfg.twinOnly !== false;   /* ★ 원장 2026-10-31 «유사 문제 빼고 쌍둥이로만» — 쌍둥이 없는 문제는 빼고 장부에 적어 다음에 또 찾지 않는다(그 문제를 또 틀리면 다시) */
      for (const w of W.list) {
        let p = null, how = '';
        if (w.pid) {
          try { const d = await mf('POST', '/derivation/problem/' + w.pid, { excludedProblemIds: Object.keys(chosen).map(Number), filterId: fid, bookType: 'WORKSHEET', tagTop: null });
            const pk = (x) => ({ id: x.problem.id, lv: x.problem.level, autoScoredType: x.problem.autoScoredType });
            p = pick(((d && d.pairProblemList) || []).map(pk), w.lv); how = 'twin'; if (!p && !twinOnly) { p = pick(((d && d.similarProblemList) || []).map(pk), w.lv); how = 'sim'; }
          } catch (e) { /* 같은 유형으로 */ }
        }
        if (!p && !twinOnly) { p = await same(w.cid, w.lv); how = 'same'; }
        if (!p) { nNone++; noTwin.push(w.k); continue; }
        if (how === 'same') nSame++; else nTwin++;
        items.push({ id: p.id, k: w.k, at: w.at, how, src: w.src, cid: w.cid });
      }
      row.n = items.length; row.twin = nTwin; row.same = nSame; row.none = nNone;
      const chunk = Math.max(10, Number(cfg.chunk) || 50), parts = [];
      for (let i = 0; i < items.length; i += chunk) parts.push(items.slice(i, i + chunk));
      row.sheets = parts.length;
      log(`  쌍둥이 ${nTwin} · 같은 유형 ${nSame} · 못 찾음 ${nNone} → ${items.length}문항 · ${parts.length}장`);
      if (DRY || !items.length) { rows.push(row); continue; }
      const school = schoolOf(s.grade, (sc && sc.subject) || (cfg.hiSubject || {})[gradeKey(s.grade)]);
      if (!school) { row.err = '학년·과목을 몰라 학습지를 못 만듦'; log('  ✗ ' + row.err); rows.push(row); continue; }
      row.ws = [];
      for (let i = 0; i < parts.length; i++) {
        /* ★ 매쓰플랫은 학습지를 만들 때 쓴 문제 묶음(filterId)을 한 번 쓰면 버린다(2026-10-30 rc_twin_make 둘째 장 WORKSHEET_NOT_FOUND) → 둘째 장부터 새 묶음 */
        const fp = i === 0 ? fid : await (async () => { const cs = [...new Set(parts[i].map((it) => it.cid).filter(Boolean))]; const f3 = await mf('POST', '/worksheet/filter/concept', FILTER(cs.length ? cs : cids.slice(0, 300))); return f3.filterId || f3; })();
        const title = `오답쌍둥이 ${md} ${name}` + (parts.length > 1 ? ` (${i + 1}/${parts.length})` : '');
        const made = await mf('POST', '/worksheet', { filterId: fp, problemList: parts[i].map((it) => ({ id: it.id, tagTop: null })), conceptIdList: [], littleChapterConceptIdList: [], assignStudentIdList: [sid], shareScope: 'ACADEMY',
          title, writer: '김정수 선생님', prefix: '숙제', tag: 'HOMEWORK', schoolType: school.schoolType, grade: String(school.grade), revision: 'CURRICULUM_22', ...DESIGN });
        const wsId = (made && (made.id || made.worksheetId)) || made; row.ws.push(wsId);
        parts[i].forEach((it) => { my.given[it.k] = startedAt; });
        if (i === 0) noTwin.forEach((k) => { my.given[k] = startedAt; });
        log(`  ✅ 매쓰플랫 #${wsId} ${title.replace(name, mask(name))} · ${parts[i].length}문항`);
      }
      my.runs = (my.runs || []).concat([{ at: startedAt, batch, n: items.length, ws: row.ws }]).slice(-30);
      await setItem('wt_state', state);   // 학생마다 바로 적는다(중간에 멈춰도 낸 것은 장부에)
    } catch (e) { row.err = e.message; log('  ✗ 실패: ' + e.message); }
    rows.push(row);
    await new Promise((r) => setTimeout(r, 200));
  }
  const ok = rows.filter((r) => !r.err), tot = ok.reduce((a, r) => a + (r.n || 0), 0), sheets = ok.reduce((a, r) => a + (r.sheets || 0), 0);
  log(`\n${DRY ? '[설계만]' : '[완료]'} ${targets.length}명 · ${tot}문항 · 학습지 ${sheets}장 · 실패 ${rows.length - ok.length}명`);
  if (!ONLY.length || DRY) {
    const pv = { at: startedAt, batch, dry: DRY, rows: Object.values(Object.assign({}, prevRows, Object.fromEntries(rows.map((r) => [r.code, r])))) };
    await setItem('wt_preview', pv);
  }
  const lg = (await store(['wt_log'])).wt_log || { runs: [] };
  lg.runs = [{ at: startedAt, batch, dry: DRY, only: ONLY.length ? ONLY.length : 0, students: targets.length, problems: tot, sheets, fail: rows.length - ok.length,
    codes: rows.map((r) => ({ code: r.code, n: r.n || 0, sheets: r.sheets || 0, ws: r.ws || [], err: r.err || '' })) }].concat(lg.runs || []).slice(0, 20);
  await setItem('wt_log', lg);
  return { rows, tot, sheets };
}
if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { wrongList, scopeKey, shortSchool, gradeKey, DEF_SCOPE, DEF_CONFIG, mf, mfLogin, FILTER, mfAutoOk, store, setItem, q, schoolOf, bankId, DESIGN };
