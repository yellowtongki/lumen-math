#!/usr/bin/env node
/* 📚 숙제미흡 리커버리 학습지 (2026-11-14 원장 「숙제 미흡 리커버리 이름으로 40문제 이상 · 벌 개념으로 더 배정」)
 *
 * 주간테스트 리커버리와 «따로 한 장 더» 만든다(원장 결정).
 *   문항 = 최근 2주 숙제 범위(교재로 나간 문항의 유형)에서 같은 유형 문제 · 난도 중~중상(2~4) · 이미 푼 문제 뺌
 *          유형마다 고르게 — 많이 나가고 많이 틀린 유형부터 돌아가며 1개씩
 *   매쓰플랫: 자동채점 켬(onlyAutoScorable) · 문항마다 출처(«연관 문항 정보») 「[숙제 범위] 책 이름 · 유형」
 *   제목: 「숙제미흡 리커버리 11/14 이름」 · 학생에게 배정
 *   기록: rc_state.calls[주][학생].hw = {wsId,n,title,at,books} · rc_hw_log.items 에 한 줄(누적 횟수용)
 *
 * ⚠ 초안 — 구성(문항 수·내용)은 원장님과 상의 중(docs/mockup_recovery_hw2.html). 결정 전에는 --go 로 돌리지 않는다.
 * 사용법:
 *   node sync/rcws_hw_make.js --week 2026-11-14 --names 옥서정,한소율,유현준            # 설계만
 *   node sync/rcws_hw_make.js --week 2026-11-14 --names 옥서정,한소율,유현준 --go       # 만들고 배정
 *   --n 40 (문항 수) · --days 14 (숙제 범위 기간)
 * 환경변수: MATHFLAT_ID · MATHFLAT_PASSWORD · SUPABASE_URL · SUPABASE_SERVICE_KEY
 * 출력에 학생 이름은 첫 글자만.
 */
const MF = 'https://api.mathflat.com', WEB = 'https://teacher.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const GO = args.includes('--go'), WK = opt('week', ''), N = Number(opt('n', 40)), DAYS = Number(opt('days', 14));
const GAP = Number(opt('gap', 3000));
const NAMES = (opt('names', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
const DESIGN = { layoutType: 11, layoutColor: 'GREEN', partitionType: 4, wrongAnswerNoteFlag: false, conceptNameFlag: false, problemTrendFlag: false,
  answerRateFlag: false, qrFlag: true, relationWorkbookFlag: true, includeProblemFlag: false, pdfDateType: 'TODAY', pdfDate: null,
  designTemplateId: 41988, problemPadding: 60, conceptSortType: 'CHAPTER' };
const mask = (s) => String(s || '').slice(0, 1) + '○○';
const FILTER = (cids, count) => ({ type: 'CONCEPT', conceptIdList: cids, excludedTopicIds: [], excludedSubTopicIds: [], problemList: null, problemCount: count, level: 3, levelWeight: [0, 30, 40, 30, 0],
  problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: true, excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] });

let TOK = null, TOK_AT = 0;
async function login() {
  const r = await fetch(MF + '/v2/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: WEB, referer: WEB + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json(); if (!r.ok || !j.accessToken) throw new Error('매쓰플랫 로그인 실패'); TOK = j.accessToken; TOK_AT = Date.now();
}
async function mf(method, p, body) {
  if (Date.now() - TOK_AT > 150000) await login();
  const r = await fetch(MF + p, { method, headers: { 'content-type': 'application/json', accept: 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', authorization: 'Bearer ' + TOK, 'x-auth-token': TOK, origin: WEB, referer: WEB + '/' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`${(j && j.code) || r.status} @ ${p}`);
  return j && (j.data !== undefined ? j.data : j);
}
async function q(path) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(path.slice(0, 40) + ' → ' + r.status); return r.json(); }
async function store(keys) { const out = {}; (await q(`lumen_store?select=key,value&key=in.(${keys.join(',')})`)).forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; }); return out; }
async function setItem(key, value) { const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key, value }]) }); if (!r.ok) throw new Error('저장 실패 ' + key); }
const schoolOf = (g) => { const m = String(g || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? { schoolType: { 초: 'ELEMENTARY', 중: 'MIDDLE', 고: 'HIGH' }[m[1]], grade: m[2] } : { schoolType: 'MIDDLE', grade: '1' }; };

async function plan(st, code, sid) {
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const rs = await q(`mf_answer_records?select=worksheet_title,concept_id,result,score_datetime&lumen_rec_code=eq.${code}&source=eq.${encodeURIComponent('교재')}&score_datetime=gte.${since}&concept_id=not.is.null&limit=5000`);
  const C = {}, books = {};
  rs.forEach((x) => { const c = Number(x.concept_id); const o = C[c] || (C[c] = { cid: c, n: 0, x: 0, book: x.worksheet_title || '교재' }); o.n++; if (x.result === 'X') o.x++; books[o.book] = (books[o.book] || 0) + 1; });
  const solvedRows = await q(`mf_answer_records?select=problem_id&lumen_rec_code=eq.${code}&problem_id=not.is.null&score_datetime=gte.${new Date(Date.now() - 180 * 864e5).toISOString()}&limit=20000`);
  const solved = {}; solvedRows.forEach((x) => { solved[String(x.problem_id)] = 1; });
  const list = Object.values(C).sort((a, b) => (b.x * 3 + b.n) - (a.x * 3 + a.n));
  return { list, books, rows: rs.length, solved };
}

(async () => {
  if (!SB || !KEY || !process.env.MATHFLAT_ID || !WK || !NAMES.length) { console.error('❌ --week 와 --names, 환경변수가 필요합니다'); process.exit(1); }
  await login();
  const st = await store(['or_studentdb', 'rc_state', 'rc_hw_log']);
  const db = st.or_studentdb; const L = Array.isArray(db) ? db : (db.students || Object.values(db));
  const mfs = await q('mf_students?select=mf_student_id,name,lumen_rec_code');
  const d = new Date(WK); const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const out = [];
  for (const name of NAMES) {
    const s = L.find((x) => x && x.name === name && !x.withdrawn); if (!s) { console.log(`✗ ${mask(name)} 등록부에 없음`); continue; }
    const code = s.lumen_rec_code, sidRow = mfs.find((x) => x.lumen_rec_code && x.lumen_rec_code === code) || (mfs.filter((x) => x.name === name).length === 1 ? mfs.find((x) => x.name === name) : null); const sid = sidRow && sidRow.mf_student_id;
    if (!sid) { console.log(`✗ ${mask(name)} 매쓰플랫 학생 번호 없음`); continue; }
    const P = await plan(st, code, sid);
    /* 같은 주 주간테스트 리커버리 학습지 문제와 겹치지 않게 */
    const wsw = (((st.rc_state || {}).calls || {})[WK] || {})[String(s.id)]; const wid = wsw && wsw.ws && wsw.ws.wsId;
    if (wid) { try { const w = await mf('GET', `/worksheet/${wid}?ignoredForDeleted=true`); ((w && w.problems) || []).forEach((p) => { P.solved[String(p.id || (p.problem && p.problem.id))] = 1; }); } catch (e) {} }
    console.log(`\n▶ ${mask(name)} (${s.grade}) · 최근 ${DAYS}일 교재 기록 ${P.rows}개 · 유형 ${P.list.length}개 · 책 ${Object.entries(P.books).map(([b, n]) => b + ' ' + n).join(' · ')}`);
    if (!P.list.length) { console.log('  ✗ 숙제 범위 기록 없음 — 건너뜀'); continue; }
    /* 유형마다 문제 모으기 (중~중상 · 자동채점 · 안 푼 것) */
    /* 유형 20개(문항 수 절반)가 찰 때까지 많이 나가고 많이 틀린 유형부터 문제를 모은다 */
    const want = Math.ceil(N / 2), pool = {}, chosen = {}, top = []; let err = '';
    for (const c of P.list) {
      if (top.length >= want) break;
      await new Promise((r) => setTimeout(r, GAP));   /* 2026-11-14 새벽: 간격 없이 60번 부르다 CAPTCHA — 3초씩 쉰다 */
      try { const f = await mf('POST', '/worksheet/filter/concept', FILTER([c.cid], 30)); const ps = await mf('POST', '/worksheet/problem', { filterId: f.filterId || f });
        const L = (Array.isArray(ps) ? ps : (ps.problemList || [])).map((x) => x.problem || x).filter((p) => p && p.id && !P.solved[String(p.id)] && (p.level || 3) >= 2 && (p.level || 3) <= 4);
        if (L.length) { pool[c.cid] = L; top.push(c); } } catch (e) { err = err || e.message; if (/CAPTCHA/i.test(e.message)) { console.log('  ⛔ 매쓰플랫 보안문자 — 여기서 멈춥니다(재시도 안 함)'); process.exit(2); } }
    }
    if (err) console.log('  (일부 유형 문제 받기 실패: ' + err + ')');
    /* 난도는 중(3) 위주로 중상(4)·중하(2) 섞기 — 유형마다 3 → 4 → 3 → 2 차례 */
    const LV = [3, 4, 3, 2, 3, 4];
    const items = []; let pass = 0;
    while (items.length < N && pass < 12) { let added = 0;
      for (const c of top) { if (items.length >= N) break; const free = (pool[c.cid] || []).filter((x) => !chosen[x.id]); if (!free.length) continue;
        const t = LV[pass % LV.length]; free.sort((a, b) => Math.abs((a.level || 3) - t) - Math.abs((b.level || 3) - t)); const p = free[0]; chosen[p.id] = 1; added++;
        items.push({ id: p.id, cid: c.cid, lv: p.level, src: ('[숙제 범위] ' + String(c.book).replace(/\s*-\s*/, ' ') + (p.conceptName ? ' · ' + p.conceptName : '')).slice(0, 80) }); }
      if (!added) break; pass++; }
    const lv = {}; items.forEach((it) => { lv[it.lv] = (lv[it.lv] || 0) + 1; });
    const title = `숙제미흡 리커버리 ${md} ${name}`;
    console.log(`  설계 ${N}문항 목표 → ${items.length}문항 · 유형 ${new Set(items.map((i) => i.cid)).size}개 · 난도 ${Object.keys(lv).sort().map((k) => 'Lv' + k + ' ' + lv[k]).join(' · ')}`);
    console.log(`  출처 예: ${items.slice(0, 3).map((i) => i.src).join(' / ')}`);
    if (items.length < N) console.log(`  ⚠ ${N}문항을 다 못 채움 — 숙제 범위 유형의 안 푼 문제가 모자람`);
    if (!GO) continue;
    /* 학습지 «자동 채점» 표시는 만들 때 쓰는 필터 값 — 모든 유형을 담은 필터(자동채점 켬)로 만든다 */
    const fAll = await mf('POST', '/worksheet/filter/concept', FILTER([...new Set(items.map((i) => i.cid))].slice(0, 300), 100));
    const sc = schoolOf(s.grade);
    const res = await mf('POST', '/worksheet', { filterId: fAll.filterId || fAll, problemList: items.map((it) => ({ id: it.id, tagTop: it.src })), conceptIdList: [], littleChapterConceptIdList: [],
      assignStudentIdList: [sid], shareScope: 'ACADEMY', title, writer: '김정수 선생님', prefix: '숙제', tag: 'HOMEWORK', schoolType: sc.schoolType, grade: String(sc.grade), revision: 'CURRICULUM_22', ...DESIGN });
    const wsId = (res && (res.id || res.worksheetId)) || res;
    let flag = null; try { const w = await mf('GET', `/worksheet/${wsId}?ignoredForDeleted=true`); flag = !!((w && w.worksheet) || w).autoScorableFlag; } catch (e) {}
    console.log(`  ✅ 만들고 배정 #${wsId} · 자동채점 ${flag ? '켜짐' : '⚠ 꺼짐'}`);
    out.push({ key: String(s.id), name, wsId, n: items.length, title, books: Object.keys(P.books), at: new Date().toISOString(), autoFlag: flag });
  }
  if (GO && out.length) {
    const fresh = (await store(['rc_state'])).rc_state || {}; fresh.calls = fresh.calls || {}; const W = fresh.calls[WK] = fresh.calls[WK] || {};
    out.forEach((o) => { const e = W[o.key] = W[o.key] || {}; e.hw = { wsId: o.wsId, n: o.n, title: o.title, at: o.at, books: o.books, reason: 'hw' }; });
    await setItem('rc_state', fresh);
    const log = st.rc_hw_log || { items: [] }; out.forEach((o) => log.items.push({ wk: WK, key: o.key, wsId: o.wsId, n: o.n, at: o.at })); log.updated = new Date().toISOString();
    await setItem('rc_hw_log', log);
    console.log(`\n장부 저장: rc_state.calls[${WK}][학생].hw · rc_hw_log (${out.length}명)`);
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
