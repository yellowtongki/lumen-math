/* 학원앱·학생앱이 스스로 받는 최신본 기록 (lumen_store app_latest)
 *   학원앱 배포 뒤:  node sync/appbuild/app_latest.js teacher lumen_v19-92.html "메모"
 *   학생앱배포 뒤:   node sync/appbuild/app_latest.js student student_v2-132.html "메모"
 *   (teacher 를 고르면 real 도 같은 파일로 적는다 — CLAUDE.md 배포 규칙)
 *   환경변수 SUPABASE_URL · SUPABASE_SERVICE_KEY 필요. 클라우드 세션에서는
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt 를 앞에 붙인다. */
const [,, which, file, note] = process.argv;
const BASE = process.env.SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_KEY;
if (!BASE || !SVC || !/^(teacher|student)$/.test(which || '') || !file) { console.error('사용법: node app_latest.js teacher|student <파일명> [메모]'); process.exit(1); }
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
(async () => {
  const r = await fetch(BASE + '/rest/v1/lumen_store?key=eq.app_latest&select=value', { headers: H });
  const cur = (await r.json())[0]?.value || {};
  const add = which === 'teacher' ? { teacher: file, real: file } : { student: file };
  const next = Object.assign({}, cur, add, { at: new Date().toISOString(), note: note || cur.note || '' });
  const w = await fetch(BASE + '/rest/v1/lumen_store?on_conflict=key', { method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ key: 'app_latest', value: next }) });
  const v = await fetch(BASE + '/rest/v1/lumen_store?key=eq.app_latest&select=value', { headers: H }); const x = (await v.json())[0].value;
  console.log('기록', w.status, 'teacher=' + x.teacher, 'real=' + x.real, 'student=' + x.student);
})();
