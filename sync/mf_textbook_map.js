#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📘 매쓰플랫 「학생별 배정 교과서」 읽기 → lumen_store 'mf_textbooks'
 * ═══════════════════════════════════════════════════════════════════
 * 원장 지시 2026-09-24: 「학교별 교과서는 매쓰플랫의 학생마다 교과서가 배정되어 있어서 읽을 수 있어야 한다.
 *   옥길중 1·2 비상교육, 옥길중 3 미래엔, 고등부는 학년마다 다르다. 소사고와 범박고를 읽어 봐라.」
 *
 * 어떻게
 *   GET /students?size=500                                 → 활동 학생(ACTIVE)
 *   GET /student-workbook/student/{학생}?workbookType=SCHOOL → 그 학생에게 배정된 교과서(학교 교재)
 *   → 학생별 교과서 id 와 「학교|학년 → 교과서」 집계를 저장한다. 약점 문제집(교과서 원문항)이 이 표를 본다.
 *
 * 저장 (이름은 넣지 않는다 — 학생 id 와 교과서 id 만)
 *   mf_textbooks = { updated, books:{ [bid]:{ title, fulltitle, grade, minPage, maxPage, n } },
 *                    byStudent:{ [mf_student_id]:{ school, grade, books:[bid] } },
 *                    bySchoolGrade:{ "옥길중|중1":{ n, books:{ [bid]: 학생 수 } } } }
 *
 * 쓰는 법: node sync/mf_textbook_map.js [--dry-run]
 *   (2026-09-24 원장 확인: 매쓰플랫은 동시 접속이 된다 → 낮에 돌려도 된다)
 * ═══════════════════════════════════════════════════════════════════ */
const API = 'https://api.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!SB || !SKEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }
const DRY = process.argv.includes('--dry-run');
const sbH = { apikey: SKEY, authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

let TOKEN = '';
const mfH = () => ({ 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) });
async function login() {
  const res = await fetch(`${API}/v2/login`, { method: 'POST', headers: mfH(), body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await res.json().catch(() => null);
  if (!res.ok || !(j && j.accessToken)) throw new Error('매쓰플랫 로그인 실패: ' + res.status);
  TOKEN = j.accessToken;
}
async function api(p, _retried) {
  const res = await fetch(`${API}${p}`, { headers: mfH() });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch (_) {}
  if (res.status === 401 && !_retried) { await login(); return api(p, true); }
  if (!res.ok) throw new Error(`${res.status} ${(j && j.code) || ''} @ ${p}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}
async function sbSet(key, value) {
  if (DRY) { log(`[dry-run] ${key} 저장 생략`); return true; }
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...sbH, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
  return r.ok;
}
const schoolKey = (s) => String(s || '').replace(/\s/g, '').replace(/등학교$|학교$/, '').replace(/고등$/, '고');
const gradeKey = (st) => {
  const g = String(st.grade || st.schoolGrade || ''); const t = String(st.schoolType || '');
  const n = (g.match(/(\d)/) || [])[1] || ''; const lv = /HIGH|고/.test(t + g) ? '고' : (/ELEMENT|초/.test(t + g) ? '초' : '중');
  return n ? lv + n : g;
};

/* 매쓰플랫 학생 기록에는 학교 이름이 없다 → 우리 학생 등록부(or_studentdb)에서 학교를 가져온다 (mf_students 로 이어서) */
async function schoolByMfId() {
  const out = {};
  try {
    const r = await fetch(`${SB}/rest/v1/mf_students?select=mf_student_id,lumen_rec_code&lumen_rec_code=not.is.null`, { headers: sbH });
    const map = {}; if (r.ok) (await r.json()).forEach((x) => { map[String(x.lumen_rec_code)] = String(x.mf_student_id); });
    const r2 = await fetch(`${SB}/rest/v1/lumen_store?key=eq.or_studentdb&select=value`, { headers: sbH });
    let db = r2.ok ? ((await r2.json())[0] || {}).value : null; if (typeof db === 'string') { try { db = JSON.parse(db); } catch (_) { db = null; } }
    const list = Array.isArray(db) ? db : ((db && (db.students || db.list)) || Object.values(db || {}));
    (list || []).forEach((st) => { if (!st) return; const code = String(st.lumen_rec_code || st.code || ''); const sid = map[code]; if (sid && st.school) out[sid] = schoolKey(st.school); });
  } catch (e) { log('학교 이름 읽기 실패:', e.message); }
  return out;
}

(async () => {
  await login(); log('매쓰플랫 로그인 OK');
  const schoolOf = await schoolByMfId(); log(`학교 이름을 아는 학생 ${Object.keys(schoolOf).length}명`);
  const d = await api('/students?size=500');
  const students = ((d && d.content) || []).filter((s) => s.status === 'ACTIVE');
  log(`활동 학생 ${students.length}명 · 학생 필드: ${Object.keys(students[0] || {}).join(',')}`);
  const books = {}, byStudent = {}, bySG = {};
  let shownBook = false;
  for (const st of students) {
    let list = null;
    try { list = await api(`/student-workbook/student/${st.id}?workbookType=SCHOOL`); } catch (e) { log(`  학생 ${st.id}: ${e.message}`); continue; }
    if (!Array.isArray(list)) list = (list && list.content) || [];
    if (!shownBook && list[0]) { shownBook = true; log(`  교과서 필드: ${Object.keys(list[0]).join(',')}`); }
    const school = schoolOf[String(st.id)] || schoolKey(st.schoolName || st.school || '') || '?', grade = gradeKey(st);
    const ids = [];
    for (const b of list) {
      const bid = String(b.id); ids.push(bid);
      const bk = books[bid] || (books[bid] = { title: (b.title || '').trim(), fulltitle: (b.fulltitle || b.title || '').trim(), grade: b.grade || b.schoolGrade || null,
        publisher: b.publisher || b.author || null, type: b.type || b.workbookType || null, minPage: b.minPage, maxPage: b.maxPage, n: 0 });
      bk.n++;
    }
    byStudent[String(st.id)] = { school, grade, books: ids };
    const k = `${school}|${grade}`; const g = bySG[k] || (bySG[k] = { n: 0, books: {} }); g.n++;
    ids.forEach((bid) => { g.books[bid] = (g.books[bid] || 0) + 1; });
    await sleep(60);
  }
  log('── 학교·학년별 배정 교과서 (학생 수) ──');
  Object.keys(bySG).sort().forEach((k) => {
    const g = bySG[k]; const line = Object.keys(g.books).map((bid) => `${books[bid].fulltitle} ×${g.books[bid]}`).join(' / ') || '(배정 없음)';
    log(`  ${k} (${g.n}명): ${line}`);
  });
  const ok = await sbSet('mf_textbooks', { updated: new Date().toISOString(), books, byStudent, bySchoolGrade: bySG });
  log(ok ? `저장: mf_textbooks (교과서 ${Object.keys(books).length}권 · 학생 ${Object.keys(byStudent).length}명)` : '저장 실패');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
