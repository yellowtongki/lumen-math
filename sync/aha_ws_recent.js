#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📄 학생별 「최근 매쓰플랫 학습지」 발행기  v1  (2026-09-11)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 무엇을 하나 —
 *   이미 수집해 둔 채점기록(mf_answer_records)만 읽어서, 학생 한 명마다
 *   「최근에 채점된 학습지 10장」을 한 덩어리로 정리해 lumen_store 의
 *   mf_ws_recent_<학생코드> 키에 저장한다.
 *   학생앱 아하노트의 「출처 고르기」 아코디언과 「오늘의 노트 후보」가 이 키를 읽는다.
 *
 * ★ 매쓰플랫 로그인이 필요 없다 (Supabase 만 쓴다) → 아무 때나 돌려도 안전하다.
 *
 * 저장 모양 (구현 계약서 §2)
 *   { updated:ISO, items:[ WS, … ] }            // 최근 채점순 10개
 *   WS = { wid, title, type, assignedAt:'YYYY-MM-DD', gradedAt:'YYYY-MM-DD',
 *          n, wrong:[문항번호…], hardOk:[{seq,level}…],
 *          problems:{ [문항번호]: { pid, level, result, conceptId, wpId } } }
 *   · wrong  = 틀린 문항(X)
 *   · hardOk = 맞혔는데(O) 난이도가 상(3) 이상인 문항 — 탐구노트 후보
 *
 * 실행
 *   node sync/aha_ws_recent.js            저장까지
 *   node sync/aha_ws_recent.js --dry      저장하지 않고 요약만
 *   node sync/aha_ws_recent.js --days 180 읽어 올 기간(기본 120일)
 *   수집기 새벽 실행 끝에서도 부른다 → require('./aha_ws_recent').run()
 *
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (다른 sync 스크립트와 같다)
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });

const log = (...a) => console.log('[학습지최근]', ...a);

const KEEP = 10;          // 학생 한 명당 보관할 학습지 수 (계약서 §2)
const HARD_LV = 3;        // 「어려운데 맞힘」 기준 난이도 (3 상, 4·5 최상)

/* ── Supabase 도우미 (race_engine.js 와 같은 방식) ───────────────── */
async function sbAll(path) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { ...sbH(), range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`조회 실패 ${r.status} @ ${path.slice(0, 60)}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) break;
    from += 1000;
    if (from > 400000) break;   // 안전장치
  }
  return out;
}
async function kvGet(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
/* 여러 키를 한 번에 저장 (PostgREST 는 배열을 그대로 받는다) */
async function kvSetMany(rows) {
  let ok = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50).map((r) => ({ key: r.key, value: r.value, updated_at: new Date().toISOString() }));
    const res = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbH(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) log(`저장 실패 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
    else ok += chunk.length;
  }
  return ok;
}

/* ── 학생 명단 ────────────────────────────────────────────────────
 * mf_answer_records 의 lumen_rec_code 는 비어 있으므로(수집 때 매핑 안 함)
 * mf_students(매쓰플랫ID→이름) 와 or_studentdb(이름→학원코드)를 이름으로 잇는다.
 * — sync/race_engine.js loadStudents() 와 같은 규칙.
 * 동명이인은 학년(초·중·고 + 몇 학년)으로 갈라 보고, 그래도 못 가르면 건너뛰고 알린다.
 * 로그에는 실명을 쓰지 않는다(김○○ 꼴). */
function bandOf(grade) {
  const g = String(grade || '');
  return /고등/.test(g) ? 'high' : (/중학/.test(g) ? 'mid' : 'elem');
}
function mfBand(schoolType) {
  const t = String(schoolType || '').toUpperCase();
  return /HIGH/.test(t) ? 'high' : (/MIDDLE/.test(t) ? 'mid' : 'elem');
}
async function loadStudents() {
  let arr = await kvGet('or_studentdb');
  if (!Array.isArray(arr)) arr = [];
  const byName = {};          // 이름 → [{code, band, gnum}]
  const info = {};            // code → {nm, gr, band}
  arr.forEach((s) => {
    if (!s || !s.name || s.lumen_rec_code == null || s.withdrawn) return;
    const nm = String(s.name).trim();
    const g = String(s.grade || '');
    const band = bandOf(g);
    const gnum = (g.match(/(\d)\s*학년/) || [])[1] || '';
    const code = String(s.lumen_rec_code);
    (byName[nm] = byName[nm] || []).push({ code, band, gnum });
    info[code] = { nm: nm.slice(0, 1) + '○○', band, gr: (band === 'high' ? '고' : band === 'mid' ? '중' : '초') + gnum };
  });

  const rows = await sbAll('mf_students?select=mf_student_id,name,grade,school_type');
  const sid2code = {};
  let skipped = 0;
  rows.forEach((m) => {
    const nm = String(m.name || '').trim();
    const cands = nm ? byName[nm] : null;
    if (!cands || !cands.length) return;                       // 학원 등록부에 없는 학생(퇴원 등)
    if (cands.length === 1) { sid2code[m.mf_student_id] = cands[0].code; return; }
    // 동명이인 → 학년으로 가른다
    const band = mfBand(m.school_type);
    const gnum = String(m.grade == null ? '' : m.grade).replace(/[^0-9]/g, '');
    const hit = cands.filter((c) => c.band === band && (!gnum || !c.gnum || c.gnum === gnum));
    if (hit.length === 1) { sid2code[m.mf_student_id] = hit[0].code; return; }
    skipped++;
    log(`동명이인 구분 불가 → 건너뜀: ${nm.slice(0, 1)}○○ (후보 ${cands.length}명)`);
  });
  if (skipped) log(`동명이인으로 건너뛴 학생 ${skipped}명`);
  return { sid2code, info };
}

/* ── 본체 ────────────────────────────────────────────────────────── */
const day = (iso) => String(iso || '').slice(0, 10);   // score_datetime 은 이미 한국시간이다 (race_engine 주석 참고)

function buildItems(recs, sid2code) {
  // code → wid → WS
  const byCode = {};
  recs.forEach((r) => {
    if (!r.worksheet_id) return;                       // 교재 기록 제외 (계약서 §2)
    const code = sid2code[r.mf_student_id];
    if (!code) return;
    const wid = String(r.worksheet_id);
    const m = byCode[code] || (byCode[code] = {});
    const ws = m[wid] || (m[wid] = {
      wid: r.worksheet_id, title: r.worksheet_title || '', type: r.worksheet_type || '',
      assignedAt: day(r.assign_datetime), gradedAt: day(r.score_datetime),
      n: 0, wrong: [], hardOk: [], problems: {},
      _sort: r.score_datetime || '',
    });
    if (!ws.title && r.worksheet_title) ws.title = r.worksheet_title;
    if (!ws.assignedAt) ws.assignedAt = day(r.assign_datetime);
    // 같은 학습지를 두 번 배정받았으면 나중에 채점한 쪽을 남긴다
    const t = r.score_datetime || '';
    if (t > (ws._sort || '')) { ws._sort = t; ws.gradedAt = day(t); }
    const seq = Number(r.problem_seq);
    if (!seq) return;
    const prev = ws.problems[seq];
    if (prev && (prev._t || '') > t) return;            // 더 최신 채점이 이미 있음
    ws.problems[seq] = {
      pid: r.problem_id || null, level: r.level == null ? null : Number(r.level),
      result: r.result || '-', conceptId: r.concept_id || null, wpId: r.worksheet_problem_id || null,
      _t: t,
    };
  });

  // 마무리: wrong·hardOk·n 계산 → 최근 채점순 10개
  const out = {};
  Object.keys(byCode).forEach((code) => {
    const list = Object.keys(byCode[code]).map((wid) => {
      const ws = byCode[code][wid];
      const seqs = Object.keys(ws.problems).map(Number).sort((a, b) => a - b);
      ws.n = seqs.length;
      ws.wrong = []; ws.hardOk = [];
      seqs.forEach((seq) => {
        const p = ws.problems[seq];
        delete p._t;
        if (p.result === 'X') ws.wrong.push(seq);
        else if (p.result === 'O' && Number(p.level) >= HARD_LV) ws.hardOk.push({ seq, level: Number(p.level) });
      });
      return ws;
    });
    list.sort((a, b) => String(b._sort || '').localeCompare(String(a._sort || '')));
    const items = list.slice(0, KEEP).map((ws) => { delete ws._sort; return ws; });
    if (items.length) out[code] = items;
  });
  return out;
}

async function run(opts) {
  const o = opts || {};
  const dry = !!o.dry;
  const days = Number(o.days) > 0 ? Number(o.days) : 120;
  if (!SB_URL || !SB_KEY) { log('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다'); return null; }

  const { sid2code, info } = await loadStudents();
  log(`학생 매핑 ${Object.keys(sid2code).length}명`);

  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) + 'T00:00:00';
  const recs = await sbAll(
    'mf_answer_records?select=mf_student_id,worksheet_id,worksheet_title,worksheet_type,problem_seq,' +
    'problem_id,level,result,concept_id,worksheet_problem_id,assign_datetime,score_datetime' +
    `&worksheet_id=not.is.null&score_datetime=gte.${since}&order=score_datetime.asc`);
  log(`최근 ${days}일 학습지 채점기록 ${recs.length}건`);

  const byCode = buildItems(recs, sid2code);
  const codes = Object.keys(byCode);
  const wsCount = codes.reduce((s, c) => s + byCode[c].length, 0);
  const updated = new Date().toISOString();

  // 요약 (실명 없이 김○○ 꼴로)
  codes.slice(0, 5).forEach((c) => {
    const it = byCode[c][0];
    const who = (info[c] && info[c].nm) || '○○';
    log(`  · ${who} ${info[c] ? info[c].gr : ''} · 학습지 ${byCode[c].length}장 · 최근 「${it.title}」 ${it.gradedAt} · ${it.n}문항 · 틀림 ${it.wrong.length} · 어려운맞힘 ${it.hardOk.length}`);
  });
  log(`학생 ${codes.length}명 · 학습지 ${wsCount}장 (학생당 최대 ${KEEP}장)`);

  if (dry) { log('[미리보기] 저장하지 않았습니다'); return { students: codes.length, worksheets: wsCount, saved: 0 }; }

  const rows = codes.map((c) => ({ key: `mf_ws_recent_${c}`, value: { updated, items: byCode[c] } }));
  const saved = await kvSetMany(rows);
  log(`저장 완료: ${saved}개 키 (mf_ws_recent_*)`);
  return { students: codes.length, worksheets: wsCount, saved };
}

module.exports = { run, loadStudents, buildItems };

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--days');
  run({ dry: args.includes('--dry'), days: i >= 0 ? Number(args[i + 1]) : 0 })
    .catch((e) => { log('❌ 오류:', e.message); process.exit(1); });
}
