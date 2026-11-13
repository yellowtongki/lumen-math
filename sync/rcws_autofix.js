#!/usr/bin/env node
/* 🧩 리커버리 학습지 «자동채점» 고치기 (2026-11-13 원장 「리커버리 학습지 매쓰플랫에서 자동채점으로 되어 있나? 안 되어 있으면 수정」)
 *
 * 배경: 매쓰플랫 학습지의 «자동 채점» 표시(autoScorableFlag)는 학습지를 만들 때 쓴 필터의 onlyAutoScorable 값이다.
 *   만든 뒤에는 바꿀 수 없다. 그래서 «자동채점 꺼짐»으로 만들어진 리커버리 학습지를
 *   같은 문항·같은 순서·같은 제목으로 «자동채점 켬» 필터로 다시 만들어 같은 학생에게 배정하고, 옛 학습지는 지운다.
 *
 * 고치는 대상 (모두 맞아야 함):
 *   - 제목이 «리커버리 …» 로 시작 (매쓰플랫 «[오답] 리커버리 …» 는 원장님이 매쓰플랫에서 만든 오답 학습지라 건드리지 않음)
 *   - 매쓰플랫 «자동 채점» 꺼짐
 *   - 배정된 학생 모두 아직 시작 안 함(INCOMPLETE · 0점) — 풀기 시작한 학습지는 건드리지 않는다
 *   - 최근 --days 일(기본 10) 안에 배정
 * 장부: rc_ws_made.byKey · rc_state.calls[주][학생].ws 의 옛 번호를 새 번호로 바꾼다.
 *
 * 사용법:
 *   node sync/rcws_autofix.js            # 설계만(바꾸지 않음) — 무엇을 고칠지 보여 준다
 *   node sync/rcws_autofix.js --go       # 실제로 다시 만들고 옛 것 지움
 *   --days 10 · --only <학습지번호,…>
 * 환경변수: MATHFLAT_ID · MATHFLAT_PASSWORD · SUPABASE_URL · SUPABASE_SERVICE_KEY (저장소에 넣지 않는다)
 */
const MF = 'https://api.mathflat.com', WEB = 'https://teacher.mathflat.com';
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const GO = args.includes('--go'), DAYS = Number(opt('days', 10));
const ONLY = (opt('only', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const DESIGN = { layoutType: 11, layoutColor: 'GREEN', partitionType: 4, wrongAnswerNoteFlag: false, conceptNameFlag: false, problemTrendFlag: false,
  answerRateFlag: false, qrFlag: true, relationWorkbookFlag: true, includeProblemFlag: false, pdfDateType: 'TODAY', pdfDate: null,
  designTemplateId: 41988, problemPadding: 60, conceptSortType: 'CHAPTER' };
const mask = (t) => String(t).replace(/(리커버리 [\d/]+ )(\S)(\S*)/, (a, b, c, d) => b + c + '○'.repeat(d.length));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
async function store(keys) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?select=key,value&key=in.(${keys.join(',')})`, { headers: H });
  const out = {}; (await r.json()).forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; }); return out;
}
async function setItem(key, value) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key, value }]) });
  if (!r.ok) throw new Error('저장 실패 ' + key + ' ' + r.status);
}

(async () => {
  if (!SB || !KEY || !process.env.MATHFLAT_ID) { console.error('❌ 환경변수 필요'); process.exit(1); }
  await login();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
  const cls = await mf('GET', '/lesson-classes'); const C = Array.isArray(cls) ? cls : (cls.content || []);
  const W = {};
  for (const c of C) {
    const r = await mf('GET', `/student-worksheet/lesson-class/${c.id || c.lessonClassId}?size=100&sort=assignDatetime,desc`);
    ((r && r.content) || []).forEach((x) => {
      const w = x.worksheet || {}; if (!/^리커버리 /.test(w.title || '')) return;
      const e = W[w.id] || (W[w.id] = { id: w.id, title: w.title, auto: !!w.autoScorable, at: String(x.assignDatetime || ''), st: [] });
      (x.assignedStudentList || []).forEach((s) => { if (!e.st.some((y) => y.studentId === s.studentId)) e.st.push(s); });
    });
  }
  const all = Object.values(W);
  const bad = all.filter((w) => !w.auto && w.at.slice(0, 10) >= since && (!ONLY.length || ONLY.includes(String(w.id))));
  const todo = bad.filter((w) => w.st.length && w.st.every((s) => s.status === 'INCOMPLETE' && !s.score));
  const started = bad.filter((w) => !todo.includes(w));
  console.log(`리커버리 학습지 ${all.length}개 중 최근 ${DAYS}일(${since}~) «자동채점 꺼짐» ${bad.length}개 · 아직 안 푼 것(고칠 대상) ${todo.length}개 · 이미 푼 것(그대로 둠) ${started.length}개`);
  started.forEach((w) => console.log(`  · 그대로: #${w.id} ${mask(w.title)} — ${w.st.map((s) => s.status + (s.score != null ? ':' + s.score : '')).join(',')}`));
  if (!todo.length) { console.log('고칠 것이 없습니다.'); return; }

  const st = await store(['rc_ws_made', 'rc_state']);
  const made = (st.rc_ws_made && st.rc_ws_made.byKey) || {}; const state = st.rc_state || {};
  for (const w of todo) {
    console.log(`\n▶ #${w.id} ${mask(w.title)} · 학생 ${w.st.length}명`);
    const d = await mf('GET', `/worksheet/${w.id}?ignoredForDeleted=true`);
    const ws = d.worksheet || d, probs = d.problems || ws.problems || [];
    const ids = probs.map((p) => p.id || (p.problem && p.problem.id)).filter(Boolean);
    const f0 = ws.filter || {};
    console.log(`  문항 ${ids.length}개 · ${ws.school} ${ws.grade} · 필터 자동채점 ${f0.onlyAutoScorable}`);
    if (!ids.length) { console.log('  ✗ 문항을 못 읽어 건너뜀'); continue; }
    if (!GO) { console.log('  (설계만 — --go 로 실제로 다시 만듭니다)'); continue; }
    const f = await mf('POST', '/worksheet/filter/concept', { type: 'CONCEPT', conceptIdList: (f0.conceptIdList || []).slice(0, 300), excludedTopicIds: [], excludedSubTopicIds: [], problemList: null,
      problemCount: 100, level: f0.level || 3, levelWeight: f0.levelWeight || [10, 30, 30, 20, 10], problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: true,
      excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null, minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [] });
    const fid = f.filterId || f;
    const res = await mf('POST', '/worksheet', { filterId: fid, problemList: ids.map((id) => ({ id, tagTop: null })), conceptIdList: [], littleChapterConceptIdList: [],
      assignStudentIdList: w.st.map((s) => s.studentId), shareScope: 'ACADEMY', title: ws.title, writer: ws.writer || '김정수 선생님', prefix: ws.titlePrefix || '취약유형',
      tag: ws.tag || 'WEAK_CONCEPT_CHIP', schoolType: ws.school, grade: String(ws.grade), revision: ws.revision || 'CURRICULUM_22', ...DESIGN });
    const nid = (res && (res.id || res.worksheetId)) || res;
    await sleep(1500);
    const chk = await mf('GET', `/worksheet/${nid}?ignoredForDeleted=true`); const cw = chk.worksheet || chk; const cp = (chk.problems || cw.problems || []).map((p) => p.id || (p.problem && p.problem.id));
    const same = cp.length === ids.length && cp.every((x, i) => x === ids[i]);
    console.log(`  ✅ 새 학습지 #${nid} · 자동채점 ${cw.autoScorableFlag ? '켜짐' : '꺼짐 ⚠'} · 문항 ${cp.length}개 ${same ? '(순서 같음)' : '(⚠ 순서·개수 다름)'}`);
    if (!cw.autoScorableFlag || !same) { console.log('  ⚠ 옛 학습지는 지우지 않습니다 — 매쓰플랫에서 확인해 주세요'); continue; }
    let gone = false; for (const pth of ['/worksheet', '/worksheet/trash/by-worksheet']) { try { await mf('DELETE', pth, [Number(w.id)]); gone = true; break; } catch (e) {} }
    console.log(gone ? `  🗑 옛 학습지 #${w.id} 지움` : `  ⚠ 옛 학습지 #${w.id} 를 못 지움 — 매쓰플랫에서 직접`);
    Object.keys(made).forEach((k) => { if (String(made[k].wsId) === String(w.id)) { made[k].wsId = nid; made[k].autoFlag = true; made[k].autofixFrom = w.id; console.log('  장부 rc_ws_made 바꿈'); } });
    Object.keys(state.calls || {}).forEach((wk) => Object.keys(state.calls[wk] || {}).forEach((k) => { const e = state.calls[wk][k]; if (e && e.ws && String(e.ws.wsId) === String(w.id)) { e.ws.wsId = nid; console.log('  장부 rc_state 바꿈 (' + wk + ')'); } }));
  }
  if (GO) {
    await setItem('rc_ws_made', { ...(st.rc_ws_made || {}), byKey: made, updated: new Date().toISOString() });
    const fresh = (await store(['rc_state'])).rc_state || {};   // 그사이 학원앱이 바꿨을 수 있으니 새로 읽어 학습지 번호만 옮긴다
    Object.keys(state.calls || {}).forEach((wk) => Object.keys(state.calls[wk] || {}).forEach((k) => { const a = state.calls[wk][k], b = fresh.calls && fresh.calls[wk] && fresh.calls[wk][k]; if (a && a.ws && b && b.ws && String(b.ws.wsId) !== String(a.ws.wsId) && todo.some((t) => String(t.id) === String(b.ws.wsId))) b.ws.wsId = a.ws.wsId; }));
    await setItem('rc_state', fresh);
    console.log('\n장부 저장 끝');
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
