#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📋 매쓰플랫 교재 문항 목록 (쪽·번호·단계·정답) — 풀이노트 칸 순서 만들 때 쓴다
 *
 * 원장 요청 2026-10-12~13: 쎈 중1-2 풀이노트. 매쓰플랫 그림은 «숫자를 바꾼 문제»라 책 그림으로 못 쓴다.
 *   → 여기서는 번호·쪽·단계(A/B/C)만 받고, 그림은 책 PDF 에서 자른다 (sync/solution_note_build.py).
 * 서버(Supabase)에 아무것도 쓰지 않는다 (읽기 전용). 환경변수: MATHFLAT_ID, MATHFLAT_PASSWORD
 *
 * 쓰는 법
 *   node sync/mf_workbook_list.js --find 쎈 중등수학1(하)          교재 찾기 (id·개정 표시)
 *   node sync/mf_workbook_list.js --bid 2129121 --out list.json     전체 문항 목록 저장
 *   node sync/mf_workbook_list.js --bid 2129121 --pages 87-120      그 쪽만 화면에 출력
 *   (쎈 중1-2 2022 개정 = 2129121, 중1-1 = 2119121)
 * ═══════════════════════════════════════════════════════════════════ */
const API = 'https://api.mathflat.com';
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const findIdx = argv.indexOf('--find');
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
  await login();
  if (findIdx >= 0) {
    const words = argv.slice(findIdx + 1).filter((x) => !x.startsWith('--'));
    const all = arr(await api('/workbook?type=PUBLIC&size=2000'));
    all.filter((w) => words.every((x) => ((w.fulltitle || '') + (w.title || '') + (w.subtitle || '') + (w.grade || '')).includes(x)))
      .forEach((w) => console.log(w.id, (w.fulltitle || w.title || '').trim(), '|', w.revision || ''));
    return;
  }
  const bid = val('--bid', '');
  if (!bid) { console.error('--find 또는 --bid 가 필요합니다 (맨 위 설명 참고)'); process.exit(1); }
  const range = val('--pages', '').split('-').map(Number);
  const pages = arr(await api(`/workbook/${bid}/page/v2`)).sort((a, b) => a.page - b.page)
    .filter((p) => !range[0] || (p.page >= range[0] && p.page <= (range[1] || range[0])));
  const out = [];
  for (const p of pages) {
    let a = []; try { a = arr(await api(`/workbook/${bid}/page/${p.id}?size=300`)); } catch (_) {}
    a.forEach((q) => out.push({ page: p.page, unit: p.title, no: q.number, step: (q.title || '').slice(0, 3), type: q.type, level: q.level, answer: q.answer }));
  }
  const f = val('--out', '');
  if (f) { require('fs').writeFileSync(f, JSON.stringify(out)); console.log(`문항 ${out.length}개 → ${f}`); }
  else out.forEach((q) => console.log(`${q.page}쪽 ${q.no}\t${q.step}\t${q.type}\t${q.unit}`));
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
