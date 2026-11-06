#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 학생이 실제로 «어디까지» 채점했나 — 소단원별 진도 보기   (2026-11-06)
 * ═══════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   주간테스트 범위를 「교재 최근 쪽수(recentPageNumber)」로 잡으면 틀린다.
 *   2026-11-06 실제로 틀렸다 — 소사고 고2를 「속도와 가속도까지」로 잡았는데,
 *   채점 기록을 보니 한 명은 0문항, 한 명은 8월에 푼 3문항뿐이었다(선행 때 흘러든 것).
 *   반대로 범박고는 「넓이」가 두 명 다 0문항이라 범위 밖이었다.
 *   → 범위는 «소단원별 채점 기록 + 마지막 채점일» 로 확인해야 한다.
 *
 * 무엇을 하나
 *   1) 매쓰플랫 내신대비 교과서 학습지에서 «유형번호(conceptId) → 소단원 이름» 사전을 만든다
 *      (Supabase 의 mf_answer_records 에는 소단원 이름이 없고 concept_id 만 있다)
 *   2) 학생별로 mf_answer_records 를 소단원으로 묶어 «문항 수 + 마지막 채점일» 을 보여 준다
 *
 * 쓰는 법
 *   node sync/mf_progress_by_unit.js --books 67899131,67899132,...,67707308 \
 *        --codes 1CIMK7,HEQR3U --since 2026-08-01
 *
 *   --books  소단원 사전을 만들 교과서 학습지 번호 (그 과목 전부를 넣으면 좋다.
 *            번호는 `node sync/mf_weekly_test.js --scan 미적분1` 로 찾는다)
 *   --codes  학생 6자리 코드(lumen_rec_code). 쉼표로. 이름은 적지 않는다(공개 저장소)
 *   --since  이 날짜 이후 채점만 (기본 90일 전)
 *   --min    몇 문항 이상만 보여 줄지 (기본 1)
 *
 * 환경변수: MATHFLAT_ID / MATHFLAT_PASSWORD / SUPABASE_URL / SUPABASE_SERVICE_KEY
 *
 * 함께 보기: sync/mf_weekly_test.js — 범위를 정한 뒤 학습지를 만드는 도구
 * ═══════════════════════════════════════════════════════════════════ */

const API = 'https://api.mathflat.com', BASE = 'https://teacher.mathflat.com';
let TOKEN = '';
const H = () => ({
  'content-type': 'application/json', 'x-platform': 'TEACHER_WEB',
  'x-freewheelin-host': 'mathflat.com', origin: BASE, referer: BASE + '/',
  ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}),
});
async function get(p) {
  const r = await fetch(API + encodeURI(p), { headers: H() });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${t.slice(0, 120)}`);
  const j = JSON.parse(t);
  return j.data !== undefined ? j.data : j;
}
async function login() {
  const id = (process.env.MATHFLAT_ID || '').trim(), pw = (process.env.MATHFLAT_PASSWORD || '').trim();
  if (!id || !pw) throw new Error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 없습니다');
  const r = await fetch(API + '/v2/login', { method: 'POST', headers: H(),
    body: JSON.stringify({ id, password: pw, userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  if (!r.ok) throw new Error('매쓰플랫 로그인 실패 ' + r.status);
  TOKEN = (await r.json()).accessToken;
}

(async () => {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

  const books = String(arg('books', '')).split(',').map((s) => s.trim()).filter(Boolean);
  const codes = String(arg('codes', '')).split(',').map((s) => s.trim()).filter(Boolean);
  const min = Number(arg('min', 1));
  const since = arg('since', new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10));
  if (!books.length || !codes.length) throw new Error('--books 와 --codes 를 주세요 (설명은 이 파일 맨 위)');

  const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다');

  await login();

  /* ① 유형번호 → 소단원 이름 사전 + 교과서에 나오는 순서(쪽수) */
  const name = {}, order = {};
  let seq = 0;
  for (const id of books) {
    const x = await get(`/worksheet/${id}?ignoredForDeleted=true`);
    const w = x.worksheet || x;
    const page = +((/p\.(\d+)/.exec(w.chapter || '') || [0, 9999])[1]);
    for (const p of (x.problems || w.problems || [])) {
      const u = ((p.concept || {}).littleChapterName) || p.conceptName;
      if (p.conceptId && u) {
        name[p.conceptId] = u;
        if (order[u] === undefined) order[u] = page * 1000 + (seq++);
      }
    }
  }
  console.log(`소단원 사전 ${Object.keys(name).length}개 (교과서 ${books.length}장) · ${since} 이후 채점\n`);

  /* ② 학생별 소단원 묶기 */
  const rows = {};
  for (const code of codes) {
    /* Supabase 는 한 번에 1000줄까지 주므로 끊어서 다 읽는다 */
    let data = [], bad = null;
    for (let off = 0; off < 40000; off += 1000) {
      const q = `select=concept_id,result,score_datetime&lumen_rec_code=eq.${code}` +
                `&score_datetime=gte.${since}&order=score_datetime.asc&limit=1000&offset=${off}`;
      const r = await fetch(`${SB}/rest/v1/mf_answer_records?${q}`, { headers: { apikey: KEY, authorization: 'Bearer ' + KEY } });
      const chunk = await r.json();
      if (!Array.isArray(chunk)) { bad = chunk; break; }
      data = data.concat(chunk);
      if (chunk.length < 1000) break;
    }
    if (bad) { console.log(`  ${code}: 읽기 실패 ${JSON.stringify(bad).slice(0, 120)}`); continue; }
    const by = {};
    for (const d of data) {
      const u = name[d.concept_id];
      if (!u) continue;
      by[u] = by[u] || { n: 0, wrong: 0, last: '' };
      by[u].n++;
      if (d.result === 'WRONG' || d.result === 'X' || d.result === false) by[u].wrong++;
      if ((d.score_datetime || '') > by[u].last) by[u].last = d.score_datetime || '';
    }
    rows[code] = by;
    console.log(`■ ${code} — 기록 ${data.length}건, 소단원으로 묶인 것 ${Object.values(by).reduce((a, b) => a + b.n, 0)}건`);
  }

  /* ③ 표 — 교과서 순서대로 */
  const units = [...new Set(Object.values(rows).flatMap((b) => Object.keys(b)))]
    .sort((a, b) => (order[a] ?? 9e9) - (order[b] ?? 9e9));
  const w1 = Math.max(10, ...units.map((u) => u.length));
  console.log('\n' + '소단원'.padEnd(w1) + ' | ' + codes.map((c) => c.padEnd(16)).join('| '));
  for (const u of units) {
    const cells = codes.map((c) => {
      const v = (rows[c] || {})[u];
      if (!v || v.n < min) return '—'.padEnd(16);
      return `${v.n}문 ${v.last.slice(5, 10)}`.padEnd(16);
    });
    console.log(u.padEnd(w1) + ' | ' + cells.join('| '));
  }
  console.log('\n* 「문항 수 + 마지막 채점일」. 숫자가 0~3이고 날짜가 오래됐으면 선행 때 흘러든 것일 수 있다 —');
  console.log('  그 소단원은 아직 진도가 안 나간 것으로 보고 시험범위에서 뺀다.');
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
