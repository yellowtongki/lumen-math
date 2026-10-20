#!/usr/bin/env node
/* 교재 목록 새로고침(mf_swb_req) 서버 쪽 검사 — v19-129
 *   ① 수집기 --swb-only --codes A,B 인자 읽기 + 환경변수 없으면 멈춤(매쓰플랫에 붙지 않는다)
 *   ② 워커 새 길: 가짜 Supabase(내 컴퓨터 안) + 가짜 수집기로 requested → running → done, 인자·메모·오래된 running 정리·잘못된 코드
 *   실행: node sync/appbuild/tests/test_swb_refresh.js
 *   ※ 진짜 매쓰플랫·진짜 Supabase 에는 절대 붙지 않는다 (환경변수 MATHFLAT_*, SUPABASE_* 는 비워서 돌린다). */
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
const cleanEnv = () => { const e = Object.assign({}, process.env); ['MATHFLAT_ID', 'MATHFLAT_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY', 'VAPID_PRIVATE_KEY'].forEach((k) => delete e[k]); return e; };

/* ① 수집기 인자 · 환경변수 빠짐 */
let r = spawnSync('node', [path.join(ROOT, 'sync/mathflat_collector.js'), '--swb-only', '--codes', 'A1,B2'], { env: cleanEnv(), encoding: 'utf8' });
t('수집기 --swb-only: Supabase 환경변수 없으면 코드 1로 멈춤', r.status === 1 && /SUPABASE_URL/.test(r.stderr), r.status + ' ' + r.stderr);
r = spawnSync('node', [path.join(ROOT, 'sync/mathflat_collector.js'), '--swb-only', '--codes', 'A1,B2'], { env: Object.assign(cleanEnv(), { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_KEY: 'x' }), encoding: 'utf8' });
t('수집기 --swb-only: 매쓰플랫 계정 없으면 코드 1로 멈춤 (로그인 시도 안 함)', r.status === 1 && /MATHFLAT_ID/.test(r.stderr) && !/로그인 성공/.test(r.stdout), r.status + ' ' + r.stderr + r.stdout);
const src = fs.readFileSync(path.join(ROOT, 'sync/mathflat_collector.js'), 'utf8');
t('수집기: --swb-only 가 머리말 설명에 있음', /\*\s+--swb-only/.test(src));
t('수집기: --swb-only 가 refreshStudentWorkbooks(CODES) 만 부름', /has\('--swb-only'\)[\s\S]{0,900}refreshStudentWorkbooks\(CODES\)/.test(src));
t('수집기: 다른 길(--bookans-only)은 인자 없이 그대로 부름', /await refreshStudentWorkbooks\(\);\s*\n\s*else log/.test(src) || /!SKIP_SWB\) await refreshStudentWorkbooks\(\);/.test(src));
const fnBody = src.slice(src.indexOf('async function refreshStudentWorkbooks'), src.indexOf('async function refreshStudentWorkbooks') + 6500);
t('수집기: 교재 갱신 함수 로그에 이름·전화 변수 없음', !/log\([^)]*(st\.name|\.phone|\.mobile)/.test(fnBody));

/* ② 워커 */
const tmp = fs.mkdtempSync(path.join(process.env.SP || os.tmpdir(), 'swb-'));
const argsFile = path.join(tmp, 'args.txt');
const fakeColl = path.join(tmp, 'fake_collector.js');
fs.writeFileSync(fakeColl, "const fs=require('fs');fs.appendFileSync(" + JSON.stringify(argsFile) + ",process.argv.slice(2).join(' ')+'\\n');process.exit(Number(process.env.FAKE_EXIT||0));\n");
const store = {}; const writes = [];
const server = http.createServer((q, s) => {
  const u = new URL(q.url, 'http://x'); let body = '';
  q.on('data', (d) => body += d); q.on('end', () => {
    s.setHeader('content-type', 'application/json');
    if (q.method === 'POST' && u.pathname === '/rest/v1/lumen_store') {
      JSON.parse(body).forEach((row) => { store[row.key] = { value: row.value, updated_at: new Date().toISOString() }; writes.push(row.key + ':' + (row.value && row.value.status)); });
      return s.end('[]');
    }
    if (q.method === 'GET' && u.pathname === '/rest/v1/lumen_store') {
      const k = u.searchParams.get('key') || '';
      if (k.startsWith('eq.')) { const e = store[k.slice(3)]; return s.end(JSON.stringify(e ? [{ key: k.slice(3), value: e.value, updated_at: e.updated_at }] : [])); }
      if (k === 'like.mf_swb_*') { const since = u.searchParams.get('updated_at') || ''; return s.end(JSON.stringify(Object.keys(store).filter((x) => /^mf_swb_/.test(x) && x !== 'mf_swb_req').map((x) => ({ key: x })))); }
    }
    s.end('[]');
  });
});
function runWorker(extra) {
  return new Promise((res) => {
    const port = server.address().port; let out = '';
    const p = spawn('node', [path.join(ROOT, 'sync/collect_request_worker.js')], { env: Object.assign(cleanEnv(), { SUPABASE_URL: 'http://127.0.0.1:' + port, SUPABASE_SERVICE_KEY: 'test', SWB_COLLECTOR_SCRIPT: fakeColl, WSQ_MIN_GAP_MIN: '99999' }, extra || {}) });
    p.stdout.on('data', (d) => out += d); p.stderr.on('data', (d) => out += d);
    p.on('close', (c) => res({ code: c, out }));
  });
}
const kv = (k) => store[k] && store[k].value;
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  /* 요청 없음 */
  let w = await runWorker();
  t('워커: 요청이 없으면 수집기를 안 돌림', !fs.existsSync(argsFile), w.out.slice(-300));
  /* 학생 지정 요청 */
  store.mf_swb_req = { value: { status: 'requested', codes: ['AAA111', 'BBB222', 'bad code!', 'AAA111'], reqAt: new Date().toISOString(), by: 'teacher' } };
  store.mf_swb_AAA111 = { value: { books: [] }, updated_at: new Date().toISOString() };
  store.mf_swb_BBB222 = { value: { books: [] }, updated_at: new Date().toISOString() };
  w = await runWorker();
  const a1 = fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trim().split('\n') : [];
  t('워커: 수집기에 --swb-only --codes AAA111,BBB222 (잘못된 코드·중복 뺌)', a1.length === 1 && a1[0].endsWith('--swb-only --codes AAA111,BBB222'), JSON.stringify(a1));
  t('워커: running → done 순서로 기록', writes.indexOf('mf_swb_req:running') >= 0 && writes.indexOf('mf_swb_req:done') > writes.indexOf('mf_swb_req:running'), writes.join(','));
  t('워커: done · ok · 메모 «교재 목록 갱신 완료 (2명 · 약 1분)»', kv('mf_swb_req').status === 'done' && kv('mf_swb_req').ok === true && kv('mf_swb_req').note === '교재 목록 갱신 완료 (2명 · 약 1분)', JSON.stringify(kv('mf_swb_req')));
  t('워커: 기존 필드(codes·reqAt·by)는 그대로 남김', kv('mf_swb_req').by === 'teacher' && kv('mf_swb_req').codes.length === 4);
  t('워커: 로그에 학생코드 개수만 (코드 값·이름 없음)', /학생 2명/.test(w.out) && !/AAA111/.test(w.out), w.out.slice(-400));
  /* 같은 요청을 두 번 처리하지 않음 */
  w = await runWorker();
  t('워커: 끝난 요청(done)은 다시 안 돌림', fs.readFileSync(argsFile, 'utf8').trim().split('\n').length === 1);
  /* 전체 요청 + 수집기 실패 */
  store.mf_swb_req = { value: { status: 'requested', codes: [], reqAt: new Date().toISOString(), by: 'teacher' } };
  w = await runWorker({ FAKE_EXIT: '3' });
  const a2 = fs.readFileSync(argsFile, 'utf8').trim().split('\n');
  t('워커: 빈 codes = 전체 → --codes 없이 --swb-only', a2.length === 2 && a2[1].endsWith('--swb-only') && a2[1].indexOf('--codes') < 0, JSON.stringify(a2));
  t('워커: 수집기가 실패하면 done · ok:false · 실패 메모', kv('mf_swb_req').status === 'done' && kv('mf_swb_req').ok === false && /실패 \(코드 3\)/.test(kv('mf_swb_req').note), JSON.stringify(kv('mf_swb_req')));
  /* 오래된 running 정리 / 새 running 은 건너뜀 */
  store.mf_swb_req = { value: { status: 'running', startedAt: new Date(Date.now() - 30 * 60000).toISOString(), codes: [], by: 'teacher' } };
  await runWorker();
  t('워커: 20분 넘은 running 은 done · ok:false 로 정리', kv('mf_swb_req').status === 'done' && kv('mf_swb_req').ok === false && /중단/.test(kv('mf_swb_req').note), JSON.stringify(kv('mf_swb_req')));
  store.mf_swb_req = { value: { status: 'running', startedAt: new Date(Date.now() - 3 * 60000).toISOString(), codes: [], by: 'teacher' } };
  await runWorker();
  t('워커: 3분 된 running 은 그대로 둠 (수집기 또 안 돌림)', kv('mf_swb_req').status === 'running' && fs.readFileSync(argsFile, 'utf8').trim().split('\n').length === 2);
  /* 전부 잘못된 코드 */
  store.mf_swb_req = { value: { status: 'requested', codes: ['!!', 'x y'], reqAt: new Date().toISOString(), by: 'teacher' } };
  await runWorker();
  t('워커: 올바른 코드가 하나도 없으면 수집기 안 돌리고 done · ok:false', kv('mf_swb_req').status === 'done' && kv('mf_swb_req').ok === false && fs.readFileSync(argsFile, 'utf8').trim().split('\n').length === 2, JSON.stringify(kv('mf_swb_req')));
  server.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
})();
