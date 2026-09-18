/* 서버 잠금(RLS) 확인 — 공개 키로 «지우기»가 막혔는지, 앱이 늘 하는 일(읽기·넣기·고치기)은
 * 그대로 되는지 실제로 찔러 본다. 표마다 시험용 행을 관리자 열쇠로 하나 넣고 → 공개 키로
 * 지워 보고 → 남아 있으면 잠긴 것. 끝나면 반드시 지운다. 실제 자료는 건드리지 않는다.
 *
 *   쓰기:  LUMEN_TEACHER_KEY=<원장님 열쇠> node sync/check_rls_lock.js
 *   (저장소가 «공개» 이므로 열쇠를 파일에 적지 않는다) */
const BASE = process.env.SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_KEY;
const PUB = 'sb_publishable_D3ryC0YXrf5Fq2Buu8IA8A_OvmCQbbi';
const TKEY = process.env.LUMEN_TEACHER_KEY || '';
if (!TKEY) { console.error('LUMEN_TEACHER_KEY 를 넣고 실행하십시오.'); process.exit(1); }
const TS = Date.now();

const call = async (p, o = {}, key = PUB, ex = {}) => {
  const r = await fetch(BASE + '/rest/v1/' + p, { ...o, headers: {
    apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json',
    Prefer: 'return=representation', ...ex } });
  let b = ''; try { b = await r.text(); } catch (e) {}
  return { s: r.status, b };
};

/* 표마다: 넣을 시험용 행 · 그 행만 고르는 조건 */
const CASES = [
  { t: 'lumen_store',        row: { key: '_lk_' + TS, value: {} },                                   where: 'key=eq._lk_' + TS },
  { t: 'aha_notes',          row: { student_code: '_LK' + TS, student_name: '잠금시험', student_grade: '중학교 1학년', source_type: 'book', source_name: '잠금시험', page: '1', problem_no: '1', status: 'pending', kind: 'ask', photo_url: '_lock_test' }, where: 'student_code=eq._LK' + TS },
  { t: 'mf_answer_records',  row: { record_key: '_lk_' + TS, source: '교재', result: 'O', mf_student_id: -TS },        where: 'record_key=eq._lk_' + TS },
  { t: 'mf_students',        row: { mf_student_id: -TS, name: '잠금시험' },                            where: 'mf_student_id=eq.' + (-TS) },
  { t: 'announcement_reads', row: { announcement_id: '_lk_' + TS, student_code: '_LK' + TS },          where: 'student_code=eq._LK' + TS },
  { t: 'vod_watch_logs',     row: { video_id: '_lk_' + TS, student_code: '_LK' + TS },                 where: 'student_code=eq._LK' + TS },
  { t: 'mf_study_sessions',  row: { mf_student_id: -TS, source: '교재' },                          where: 'mf_student_id=eq.' + (-TS) }
];

const alive = async (c) => {
  const r = await call(c.t + '?' + c.where + '&select=*', {}, SVC);
  try { return JSON.parse(r.b).length > 0; } catch (e) { return null; }
};

(async () => {
  console.log('\n═══ 표 일곱 개 «지우기» 잠금 확인 ═══\n');
  console.log('  표                       열쇠 없이 지우기      원장 열쇠로 지우기');
  console.log('  ' + '─'.repeat(64));
  let allLocked = true, allTeacher = true;
  for (const c of CASES) {
    const ins = await call(c.t, { method: 'POST', body: JSON.stringify(c.row) }, SVC);
    if (ins.s >= 300) { console.log('  ' + c.t.padEnd(22) + ' ⚠ 시험용 행을 못 넣음 — ' + ins.b.slice(0, 90)); continue; }

    await call(c.t + '?' + c.where, { method: 'DELETE' });              // 열쇠 없이
    const survived = await alive(c);
    let teacherOk = null;
    if (survived) {
      await call(c.t + '?' + c.where, { method: 'DELETE' }, PUB, { 'x-lumen-teacher': TKEY });   // 열쇠 싣고
      teacherOk = !(await alive(c));
    }
    await call(c.t + '?' + c.where, { method: 'DELETE' }, SVC);          // 뒷정리

    if (!survived) allLocked = false;
    if (survived && !teacherOk) allTeacher = false;
    console.log('  ' + c.t.padEnd(22) + ' ' +
      (survived ? '🔒 막힘          ' : '⚠️  그대로 지워짐  ') + '   ' +
      (survived ? (teacherOk ? '✅ 원장님은 지워짐' : '❌ 원장님도 못 지움') : '—'));
  }
  console.log('  ' + '─'.repeat(64));
  console.log('\n  ' + (allLocked && allTeacher
    ? '✅ 일곱 표 모두 잠겼습니다 — 남이 못 지우고, 원장님만 지울 수 있습니다.'
    : '⚠️ 아직 덜 된 표가 있습니다 (위 표를 보십시오).'));

  /* 앱이 늘 하는 일(읽기·넣기·고치기)이 그대로 되는지 */
  console.log('\n═══ 앱이 멈추지 않는지 (공개 키로 읽기·넣기·고치기) ═══\n');
  for (const c of CASES) {
    const rd = await call(c.t + '?select=*&limit=1');
    const ins = await call(c.t, { method: 'POST', body: JSON.stringify(c.row) });
    const up = ins.s < 300 ? await call(c.t + '?' + c.where, { method: 'PATCH', body: JSON.stringify({}) }) : { s: 0 };
    await call(c.t + '?' + c.where, { method: 'DELETE' }, SVC);
    console.log('  ' + c.t.padEnd(22) +
      ' 읽기 ' + (rd.s === 200 ? '✅' : '❌' + rd.s) +
      ' · 넣기 ' + (ins.s < 300 ? '✅' : '❌' + ins.s) +
      ' · 고치기 ' + (up.s === 0 ? '—' : (up.s < 300 ? '✅' : '❌' + up.s)));
  }
  console.log('');
})();
