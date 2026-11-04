#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 수학비서 「내 문제지」 만들기 — 나만의 DB 문항을 골라 새 문제지에 담는다  (2026-11-04)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 원장님 요청 「김원경 자료로 1,2회 제작해줘」 때 수학비서 웹 화면 코드에서 찾은 쓰기 주소.
 *   새 문제지      POST /bms/api/v1/my-papers                {title, folderId, category:'paper'} → data.id
 *   문항 담기      POST /bms/api/v1/my-papers/{id}/cells?action=add&curriculumId=2  {cellIds:[…], afterNumber:0} → 204
 *                  (cellIds = 나만의 DB cells 의 id. 보낸 순서대로 1번부터 들어간다 — 실측)
 *   폴더 옮기기    POST /bms/api/v1/my-papers?action=move&targetPaperIds=…&targetFolderId=… → 204
 *   (그 밖: 복제 action=duplicate · 지우기 DELETE /my-papers?targetPaperIds= · 이름 PATCH /my-papers/{id})
 *   ⚠️ 이렇게 새로 만든 문제지는 cells 를 읽을 때 curriculumId=2 를 붙여야 한다(없으면 400).
 *
 * 쓰는 법
 *   node sync/ms_paper_make.js --mydb 386423 --nums 39,40,44 --title "[비상] 공수2 기말 교사용 1회" [--folder 190225] [--paper 2162541] [--dry]
 *     --mydb   나만의 DB id (문항을 가져올 원본)
 *     --nums   원본 문항 번호(쉼표). 적은 순서대로 담는다
 *     --title  새 문제지 이름 (--paper 를 주면 그 빈 문제지에 담고 새로 만들지 않는다 — 비어 있어야 함)
 *     --folder 넣을 폴더 id (기본 190225 「매쓰플랫 올리기」 → 바로 mypaper_to_mathflat.js 로 올릴 수 있다)
 *   그 뒤 매쓰플랫: node sync/mypaper_to_mathflat.js --paper <새 id>
 *
 * 계정: MATHSECR_ID / MATHSECR_PASSWORD (환경변수만)
 */
const A = 'https://api.mathsecr.com', O = 'https://mathsecr.com';
let T = '';
const H = () => ({ accept: 'application/json', 'content-type': 'application/json', origin: O, referer: O + '/', authorization: 'Bearer ' + T });
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');

async function call(method, p, body) {
  const r = await fetch(A + p, { method, headers: H(), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${t.slice(0, 200)}`);
  return j;
}
async function cellsOf(kind, id) {
  const out = []; let cur = '';
  for (let i = 0; i < 40; i++) {
    const j = await call('GET', `/bms/api/v1/${kind}/${id}/cells?curriculumId=2&limit=48${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`);
    const d = j.data || {};
    const cs = (d.cells || []).concat(...(d.pages || []).map((p) => p.cells || []));
    out.push(...cs);
    cur = j.pagination && j.pagination.cursor;
    if (!cur || !cs.length) break;
  }
  return out;
}

(async () => {
  const mydb = arg('mydb'), nums = (arg('nums', '') || '').split(',').map(Number).filter(Boolean);
  const title = arg('title'), folder = Number(arg('folder', '190225')), paper = arg('paper');
  if (!mydb || !nums.length || (!title && !paper)) throw new Error('--mydb, --nums, --title(또는 --paper) 가 필요합니다');
  const r = await fetch(A + '/mim/api/v1/identities/members/login', { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: O, referer: O + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }) });
  const lj = await r.json(); T = lj.data ? lj.data.accessToken : lj.accessToken;
  if (!T) throw new Error('수학비서 로그인 실패');

  const src = await cellsOf('mydbs', mydb);
  const ids = nums.map((n) => { const c = src.find((x) => x.questionNumber === n); if (!c) throw new Error(`원본에 ${n}번이 없습니다`); return c.id; });
  const avg = nums.reduce((s, n) => s + (src.find((x) => x.questionNumber === n).answers[0].difficulty.mathSecr || 0), 0) / nums.length;
  console.log(`원본 ${mydb} (${src.length}문항)에서 ${nums.length}문항 · 평균 난이도 ${avg.toFixed(2)}`);
  if (DRY) return console.log('(미리보기 — 만들지 않음)');

  let pid = paper ? Number(paper) : null;
  if (pid) {
    const d = (await call('GET', `/bms/api/v1/my-papers/${pid}`)).data;
    if (d.questionCount) throw new Error(`문제지 ${pid} 가 비어 있지 않습니다(${d.questionCount}문항) — 덮어쓰지 않음`);
  } else {
    pid = (await call('POST', '/bms/api/v1/my-papers', { title, folderId: folder, category: 'paper' })).data.id;
    console.log(`새 문제지 ${pid} 「${title}」`);
  }
  await call('POST', `/bms/api/v1/my-papers/${pid}/cells?action=add&curriculumId=2`, { cellIds: ids, afterNumber: 0 });
  if (paper && folder) await call('POST', `/bms/api/v1/my-papers?action=move&targetPaperIds=${pid}&targetFolderId=${folder}`);

  const got = await cellsOf('my-papers', pid);
  const back = got.sort((a, b) => a.questionNumber - b.questionNumber).map((c) => { const s = src.find((o) => o.id === c.id || o.imagePath === c.imagePath); return s ? s.questionNumber : '?'; });
  const ok = JSON.stringify(back) === JSON.stringify(nums);
  console.log(`확인: ${got.length}문항 · 원본 번호 ${back.join(',')} · 계획과 ${ok ? '같음 ✅' : '다름 ⚠'}`);
  if (!ok) process.exitCode = 1;
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
