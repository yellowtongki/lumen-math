#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🗂 루멘 문제 DB ① 뼈대 — 매쓰플랫에서 교재 문항 목록 + 단원·유형 이름 받기
 *
 * 원장 요청 2026-10-27: 「기존 문제집 PDF 를 문항 하나씩 잘라 출처(쎈 p.93 547번)를 박고 DB 로 쌓아
 *   대단원·중단원·유형을 체크해 출력물로 나눠 주고 싶다」 — 시범 쎈 중1-2 다각형.
 *   그림은 책 PDF 에서 자르고(sync/bank_build.py), 여기서는 «글자 정보»만 받는다.
 * 서버(Supabase)에 아무것도 쓰지 않는다 (읽기 전용). 환경변수: MATHFLAT_ID, MATHFLAT_PASSWORD
 *
 * 쓰는 법
 *   node sync/bank_meta.js --bid 2129121 --short "쎈 중1-2" --out meta.json [--pages 83-103]
 *   교재 번호는 node sync/mf_workbook_list.js --find 블랙라벨 중등수학1 로 찾는다
 * 결과 meta.json
 *   { book:{bid,title,short,publisher,revision}, problems:[{page,no,base,step,type,level,answer,
 *     cid,concept,big,mid,little,mf_wpid,mf_twin,mf_twin_img}] }
 *   no = 책 번호 그대로(528.(2) 같은 작은 문항 포함), base = 큰 번호(528) — 그림은 base 하나에 한 장
 *   mf_twin = 매쓰플랫이 같은 자리에 넣어 둔 «숫자 바꾼 비슷한 문제» 번호 (나중 변형 문제용)
 * ═══════════════════════════════════════════════════════════════════ */
/* sync/.env.local 이 있으면 읽는다 (맥미니용 · 깃에 안 올라감 — MATHFLAT_ID=… 한 줄씩) */
(function loadLocalEnv() {
  try {
    const p = require('path').join(__dirname, '.env.local');
    if (!require('fs').existsSync(p)) return;
    require('fs').readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) {}
})();
const API = 'https://api.mathflat.com';
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
let TOKEN = '';
const H = () => ({ 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/', ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}) });
async function login() {
  const r = await fetch(API + '/v2/login', { method: 'POST', headers: H(), body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.accessToken) throw new Error('매쓰플랫 로그인 실패 ' + r.status);
  TOKEN = j.accessToken;
}
async function api(p) {
  const r = await fetch(API + p, { headers: H() });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
  if (!r.ok) throw new Error(r.status + ' @ ' + p);
  return j && j.data !== undefined ? j.data : j;
}
const arr = (d) => (Array.isArray(d) ? d : ((d && d.content) || []));

(async () => {
  const bid = val('--bid', ''), out = val('--out', '');
  if (!bid || !out) { console.error('--bid 와 --out 이 필요합니다 (맨 위 설명 참고)'); process.exit(1); }
  await login();
  const wb = await api(`/workbook/${bid}`);
  const title = ((wb.title || '') + ' ' + (wb.subtitle || '')).replace(/\s+/g, ' ').trim();
  const short = val('--short', title);
  const chips = {};
  arr(await api(`/concept/chips?curriculumKey=1&workbookIds=${bid}`)).forEach((c) => {
    if (c.conceptId && !chips[c.conceptId]) chips[c.conceptId] = { concept: String(c.conceptName || '').split(';')[0].trim(),
      big: c.bigChapterName || '', mid: c.middleChapterName || '', little: c.littleChapterName || '', ord: String(c.orderingNumber || '') };
  });
  const range = val('--pages', '').split('-').map(Number);
  const pages = arr(await api(`/workbook/${bid}/page/v2`)).sort((a, b) => a.page - b.page)
    .filter((p) => !range[0] || (p.page >= range[0] && p.page <= (range[1] || range[0])));
  const problems = [];
  for (const p of pages) {
    let a = []; try { a = arr(await api(`/workbook/${bid}/page/${p.id}?size=300`)); } catch (e) { console.error(`${p.page}쪽 못 받음: ${e.message}`); }
    a.sort((x, y) => (x.order || 0) - (y.order || 0)).forEach((q) => {
      const c = chips[q.conceptId] || {};
      const no = String(q.number || '').trim();
      problems.push({ page: p.page, no, base: no.split('.')[0].replace(/\(.*$/, ''), step: (q.title || '').slice(0, 3),
        step_title: q.title || '', type: q.type, level: q.level, answer: q.answer,
        cid: q.conceptId, concept: c.concept || '', big: c.big || '', mid: c.mid || '', little: c.little || p.title || '', ord: c.ord || '',
        mf_wpid: q.id, mf_twin: (q.exampleProblem && q.exampleProblem.id) || null, mf_twin_img: (q.exampleProblem && q.exampleProblem.url) || '' });
    });
  }
  const meta = { made: new Date().toISOString(), book: { bid: Number(bid), title, short, publisher: wb.publisher || '', revision: wb.revision || '',
    grade: wb.grade, semester: wb.semester }, problems };
  require('fs').writeFileSync(out, JSON.stringify(meta, null, 1));
  const bases = new Set(problems.map((q) => q.page + '|' + q.base)).size;
  const noName = problems.filter((q) => !q.concept).length;
  console.log(`${short}: ${pages.length}쪽 · 문항 ${problems.length}개(그림 ${bases}장) → ${out}` + (noName ? ` · 유형 이름 없음 ${noName}개` : ''));
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
