#!/usr/bin/env node
/**
 * 🚑 리커버리 맞춤 학습지 — «주간테스트 오답 + 시험범위 교재 오답»을 전부 쌍둥이로, 학생마다 매쓰플랫 학습지로 만들어 배정
 * ═══════════════════════════════════════════════════════════════════
 * 원장 2026-10-30 「중1·중2 리커버리 학습지 — 박수아 빼고 2주치 · 문제 수 제한 없이 주간테스트 위주 오답과 시험범위 교재 오답 ·
 *   고1 윤서연도 · 중1 주간테스트는 2회 분량 · 조은율·김래아 신규생 제외 · 성재연 나누자 · 오답은 다 쌍둥이 문제로」.
 *
 * 고르기 (sync/wrongtwin_make.js 와 같은 «아직 틀린» 규칙)
 *   · 주간테스트 오답: mf_weekly 의 그 학생 시험 — tests:'last2' = 최근 2회 · tests:'days' = bookDays 안에 본 시험 전부 →
 *       그 학습지에서 마지막 결과가 ✗ 인 문제
 *   · 시험범위 교재 오답: 최근 bookDays 일 교재 기록 중 마지막 결과 ✗ · 단원(mf_concept_names.m)이 wt_scope 범위 안(범위 없으면 전부)
 *   · 문제마다 쌍둥이 1개: 매쓰플랫 쌍둥이(pair) → 없으면 유사(similar) → 없으면 같은 유형. 자동채점 문항만 · 이 학생이 푼 문제는 안 고름.
 *     교재 오답은 교재 번호표(mf_textbook_<교재>)로 매쓰플랫 문제번호를 찾는다.
 *   · 순서: 테스트 오답 → 교재 오답(새것 먼저) · chunk 문항씩 나눠 여러 장(«이름 (1/3)»)
 * 학습지: 리커버리 학습지와 같은 태그(WEAK_CONCEPT_CHIP · 머리말 «취약유형») · 제목 «리커버리 10/31 이름» · 바로 배정
 *
 * 실행: node sync/rc_twin_make.js --plan <계획.json> [--title-date 10/31] [--dry] [--no-save]
 *   계획.json = [{ code:'학생코드', tests:'last2'|'days', bookDays:14, chunk:60 }]  (이름은 넣지 않는다 — 등록부에서 찾음)
 * 기록: lumen_store rc_twin_log = { runs:[{at, dry, rows:[{code, test, book, n, twin, sim, same, none, ws:[]}]}] } 최근 20
 * 로그에는 이름 첫 글자만.
 */
const fs = require('fs');
const W = require('./wrongtwin_make.js');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !/^--/.test(args[i + 1]) ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const ONLY = String(opt('only', '')).split(',').filter(Boolean), SKIP_ITEMS = Number(opt('skip-items', '0')) || 0;
/* ★ 원장 2026-10-31 「유사 문제 빼고 쌍둥이로만 · 성재연 줄이자, 유형별 3개 이하」
 *   --twin-only : 매쓰플랫 쌍둥이(pair)만 — 없으면 그 문제는 뺀다(유사·같은 유형으로 대신하지 않음)
 *   계획의 perConcept:N : 같은 유형(conceptId) 오답은 N개까지만(테스트 오답 먼저, 교재는 새것 먼저)
 *   --replace : 계획의 replace:[옛 학습지 번호] 를 새 학습지를 다 만든 뒤 매쓰플랫에서 지운다 */
const TWIN_ONLY = args.includes('--twin-only'), REPLACE = args.includes('--replace');   // 이어 만들기: 그 학생만 · 앞 N문항(이미 만든 장)은 건너뜀
const T = (s) => Date.parse(s || '') || 0;
const mask = (n) => (n ? String(n).charAt(0) + '○○' : '?');

async function main() {
  const plan = JSON.parse(fs.readFileSync(opt('plan', ''), 'utf8'));
  const titleDate = opt('title-date', (() => { const d = new Date(Date.now() + 9 * 3600000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); })());
  const st = await W.store(['or_studentdb', 'mf_weekly', 'wt_scope', 'mf_concept_names']);
  const db = (st.or_studentdb || []).filter((s) => s && !s.withdrawn);
  const tests = (st.mf_weekly || {}).tests || [], scope = (st.wt_scope || {}).byKey || {}, CN = st.mf_concept_names || {};
  const mfs = await W.q('mf_students?select=mf_student_id,name,lumen_rec_code');
  await W.mfLogin();
  const bankCache = {};
  const bankOf = async (bid) => { if (bankCache[bid] !== undefined) return bankCache[bid]; const s2 = await W.store(['mf_textbook_' + bid]); const b = s2['mf_textbook_' + bid]; const m = {}; if (b && b.problems) b.problems.forEach((p) => { const id = W.bankId(p); if (id) m[String(p.id)] = id; }); return (bankCache[bid] = Object.keys(m).length ? m : null); };
  const rows = [], startedAt = new Date().toISOString();
  console.log(`🚑 리커버리 맞춤 · ${plan.length}명 · 제목 날짜 ${titleDate} · ${DRY ? '[설계만]' : '[실제 출제]'}`);
  for (const p of plan.filter((x) => !ONLY.length || ONLY.includes(x.code))) {
    const s = db.find((x) => x.lumen_rec_code === p.code); const row = { code: p.code };
    if (!s) { row.err = '등록부에 없음'; rows.push(row); continue; }
    const hit = mfs.find((m) => m.lumen_rec_code === p.code); if (!hit) { row.err = '매쓰플랫 연결 없음'; rows.push(row); continue; }
    const sid = String(hit.mf_student_id), name = s.name;
    console.log(`\n▶ ${mask(name)} ${W.gradeKey(s.grade)} ${s.group || ''}`);
    try {
      const bookSince = new Date(Date.now() - (p.bookDays || 14) * 864e5).toISOString();
      const mine = tests.map((t) => { const me = (t.students || []).find((x) => String(x.sid) === sid); return me ? { wid: String(t.wid), d: String(me.date || t.date), title: t.title } : null; }).filter(Boolean).sort((a, b) => b.d.localeCompare(a.d));
      const useT = p.tests === 'last2' ? mine.slice(0, 2) : mine.filter((t) => t.d >= bookSince.slice(0, 10));
      const wids = new Set(useT.map((t) => t.wid));
      const since = [bookSince].concat(useT.map((t) => t.d + 'T00:00:00+09:00')).sort()[0];
      let rs = []; for (let off = 0; ; off += 1000) { const a = await W.q(`mf_answer_records?select=source,worksheet_id,workbook_problem_id,problem_id,concept_id,level,result,score_datetime,book_id&mf_student_id=eq.${sid}&score_datetime=gte.${encodeURIComponent(since)}&order=score_datetime.asc,id.asc&limit=1000&offset=${off}`); rs = rs.concat(a); if (a.length < 1000) break; }
      const solved = {}; rs.forEach((x) => { if (x.problem_id) solved[String(x.problem_id)] = 1; });
      const last = {}; rs.forEach((x) => { const k = x.source === '교재' ? (x.workbook_problem_id ? 'w' + x.workbook_problem_id : '') : (x.problem_id ? 'p' + x.problem_id : ''); if (k) last[k] = x; });
      const sc = scope[W.scopeKey(s)], mids = sc ? sc.mids : null;
      const testW = [], bookW = [];
      Object.values(last).forEach((x) => {
        if (x.result !== 'X') return;
        if (x.source !== '교재') { if (wids.has(String(x.worksheet_id))) testW.push({ pid: Number(x.problem_id), cid: Number(x.concept_id), lv: Number(x.level) || 3, at: x.score_datetime }); return; }
        if (T(x.score_datetime) < T(bookSince)) return;
        const m = (CN[x.concept_id] || {}).m || ''; if (mids && m && mids.indexOf(m) < 0) return;
        bookW.push({ bid: String(x.book_id), wpId: Number(x.workbook_problem_id), pid: null, cid: Number(x.concept_id), lv: Number(x.level) || 3, at: x.score_datetime });
      });
      bookW.sort((a, b) => T(b.at) - T(a.at));
      for (const w of bookW) { const b = await bankOf(w.bid); if (b && b[String(w.wpId)]) w.pid = b[String(w.wpId)]; }
      Object.assign(row, { test: testW.length, book: bookW.length, tests: useT.map((t) => t.d.slice(5)).join('·') });
      console.log(`  주간테스트 ${useT.length}회(${row.tests}) 오답 ${testW.length} · 범위 교재 오답 ${bookW.length}${sc ? '' : ' (범위 없음 → 전부)'} · 번호표 없는 교재 오답 ${bookW.filter((w) => !w.pid).length}`);
      let all = testW.concat(bookW);
      if (p.perConcept){ const c = {}, before = all.length; all = all.filter((w) => { c[w.cid] = (c[w.cid] || 0) + 1; return c[w.cid] <= p.perConcept; }); row.capped = before - all.length; console.log(`  유형마다 ${p.perConcept}개까지 → ${row.capped}문제 뺌 (${before} → ${all.length})`); }
      if (!all.length) { row.n = 0; rows.push(row); continue; }
      all.forEach((w) => { if (w.pid) solved[String(w.pid)] = 1; });
      const cids = [...new Set(all.map((w) => w.cid).filter(Boolean))];
      const f = await W.mf('POST', '/worksheet/filter/concept', W.FILTER(cids.slice(0, 300))); const fid = f.filterId || f;
      const chosen = {}, pool = {}, tried = {}; const cnt = { twin: 0, sim: 0, same: 0, none: 0 };
      const pick = (list, lv) => { const ok = list.filter((x) => W.mfAutoOk(x.autoScoredType) && !solved[String(x.id)] && !chosen[String(x.id)]); ok.sort((a, b) => Math.abs((a.lv || 3) - lv) - Math.abs((b.lv || 3) - lv)); const x = ok[0]; if (x) chosen[String(x.id)] = 1; return x || null; };
      const addPool = (ps) => (Array.isArray(ps) ? ps : (ps && ps.problemList) || []).forEach((q) => { const pr = q.problem || q; if (pr.conceptId && pr.id) (pool[pr.conceptId] = pool[pr.conceptId] || []).push({ id: pr.id, lv: pr.level || 3, autoScoredType: pr.autoScoredType }); });
      const same = async (cid, lv) => { let x = pick(pool[cid] || [], lv); if (x || tried[cid]) return x; tried[cid] = 1; try { const f2 = await W.mf('POST', '/worksheet/filter/concept', W.FILTER([cid], 40)); addPool(await W.mf('POST', '/worksheet/problem', { filterId: f2.filterId || f2 })); } catch (e) {} return pick(pool[cid] || [], lv); };
      const items = [];
      for (const w of all) {
        let x = null, how = '';
        if (w.pid) { try { const d = await W.mf('POST', '/derivation/problem/' + w.pid, { excludedProblemIds: Object.keys(chosen).map(Number), filterId: fid, bookType: 'WORKSHEET', tagTop: null });
          const pk = (y) => ({ id: y.problem.id, lv: y.problem.level, autoScoredType: y.problem.autoScoredType });
          x = pick(((d && d.pairProblemList) || []).map(pk), w.lv); how = 'twin'; if (!x && !TWIN_ONLY) { x = pick(((d && d.similarProblemList) || []).map(pk), w.lv); how = 'sim'; } } catch (e) {} }
        if (!x && !TWIN_ONLY) { x = await same(w.cid, w.lv); how = 'same'; }
        if (!x) { cnt.none++; continue; }
        cnt[how]++; items.push({ id: x.id, cid: w.cid });
      }
      Object.assign(row, { n: items.length }, cnt);
      const chunk = Math.max(10, Number(p.chunk) || 60), parts = []; for (let i = 0; i < items.length; i += chunk) parts.push(items.slice(i, i + chunk));
      const skipParts = SKIP_ITEMS ? Math.round(SKIP_ITEMS / chunk) : 0;   // 이미 만든 앞 장
      row.sheets = parts.length;
      console.log(`  → 쌍둥이 ${cnt.twin} · 유사 ${cnt.sim} · 같은 유형 ${cnt.same} · 못 찾음 ${cnt.none} = ${items.length}문항 · ${parts.length}장`);
      if (DRY) { rows.push(row); continue; }
      const school = W.schoolOf(s.grade, (sc && sc.subject) || ({ '고1': '공통수학2', '고2': '미적분1' })[W.gradeKey(s.grade)]);
      if (!school) { row.err = '학년·과목 모름'; rows.push(row); continue; }
      row.ws = [];
      for (let i = skipParts; i < parts.length; i++) {
        /* ★ 매쓰플랫은 학습지를 만들 때 쓴 문제 묶음(filterId)을 한 번 쓰면 버린다(2026-10-30 둘째 장 WORKSHEET_NOT_FOUND) → 장마다 새 묶음 */
        const fp = i === 0 ? fid : await (async () => { const f3 = await W.mf('POST', '/worksheet/filter/concept', W.FILTER([...new Set(parts[i].map((it) => it.cid).filter(Boolean))])); return f3.filterId || f3; })();
        const title = `리커버리 ${titleDate} ${name}` + (parts.length > 1 ? ` (${i + 1}/${parts.length})` : '');
        const made = await W.mf('POST', '/worksheet', { filterId: fp, problemList: parts[i].map((it) => ({ id: it.id, tagTop: null })), conceptIdList: [], littleChapterConceptIdList: [], assignStudentIdList: [sid], shareScope: 'ACADEMY',
          title, writer: '김정수 선생님', prefix: '취약유형', tag: 'WEAK_CONCEPT_CHIP', schoolType: school.schoolType, grade: String(school.grade), revision: 'CURRICULUM_22', ...W.DESIGN });
        const wsId = (made && (made.id || made.worksheetId)) || made; row.ws.push(wsId);
        console.log(`  ✅ 매쓰플랫 #${wsId} ${title.replace(name, mask(name))} · ${parts[i].length}문항`);
      }
      if (REPLACE && Array.isArray(p.replace) && p.replace.length && row.ws && row.ws.length === parts.length - skipParts) {   /* 새 것이 다 생긴 뒤에만 옛 학습지 지우기 */
        for (const old of p.replace) { let gone = false; for (const pth of ['/worksheet', '/worksheet/trash/by-worksheet']) { try { await W.mf('DELETE', pth, [Number(old)]); gone = true; break; } catch (e2) {} } console.log(`  ${gone ? '🗑 옛 학습지 #' + old + ' 지움' : '⚠ 옛 학습지 #' + old + ' 를 못 지움 — 매쓰플랫에서 직접'}`); (row.deleted = row.deleted || []).push(gone ? old : '!' + old); }
      }
    } catch (e) { row.err = e.message; console.log('  ✗ 실패: ' + e.message); }
    rows.push(row);
  }
  const tot = rows.reduce((a, r) => a + (r.n || 0), 0);
  console.log(`\n${DRY ? '[설계만]' : '[완료]'} ${rows.length}명 · ${tot}문항 · 학습지 ${rows.reduce((a, r) => a + (r.sheets || 0), 0)}장 · 실패 ${rows.filter((r) => r.err).length}`);
  const lg = (await W.store(['rc_twin_log'])).rc_twin_log || { runs: [] };
  lg.runs = [{ at: startedAt, dry: DRY, titleDate, rows }].concat(lg.runs || []).slice(0, 20);
  await W.setItem('rc_twin_log', lg);
}
main().catch((e) => { console.error('❌', e.message); process.exit(1); });
