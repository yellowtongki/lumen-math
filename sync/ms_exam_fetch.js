#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 수학비서 기출 시험지 한 장 받기 — 해설집 만들 때 쓰는 원재료  (2026-10-29)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 수학비서 「나만의 DB」 시험지(mydb id)의 문항 그림과 문항 정보(정답·배점·난이도·단원)를
 * 받아 폴더에 저장한다. 해설집(docs/exam_reports/<코드>/) 작업의 출발점.
 *
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/ms_exam_fetch.js 366369 <폴더>
 *
 *   <폴더>/cells.json   [{no, score, difficulty, answer, answerType, chapter}]
 *   <폴더>/img/qNN.png  문항 그림 (저작권 — 저장소에 올리지 않는다. 해설집 폴더면 img/ 는 .gitignore)
 *   <폴더>/img/pNN.png  여러 문항이 함께 쓰는 지문·그림(passage)이 있으면 그 문항 번호로 (예: 산점도)
 *   <폴더>/meta.json    시험지 제목·문항 수
 *
 * 그림 열쇠: cells 응답의 Set-Cookie(Cloud-CDN-Cookie) — exam_twin_pipeline.js 와 같은 방식
 * 계정: MATHSECR_ID / MATHSECR_PASSWORD (환경변수만)
 */
const fs = require('fs');
const path = require('path');
const MS_API = 'https://api.mathsecr.com', MS_ORIGIN = 'https://mathsecr.com';
let TOK = null, CDN = null;
const H = () => ({ accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: 'Bearer ' + TOK });

async function login() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json();
  TOK = j.data ? j.data.accessToken : j.accessToken;
  if (!TOK) throw new Error('수학비서 로그인 실패');
}
async function cells(id) {
  const out = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${MS_API}/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: H() });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    const hit = sc.find((c) => c && c.includes('Cloud-CDN-Cookie'));
    if (hit) CDN = hit.split(';')[0];
    const j = await r.json();
    ((j.data && j.data.pages) || []).forEach((pg) => (pg.cells || []).forEach((c) => out.push(c)));
    ((j.data && j.data.cells) || []).forEach((c) => out.push(c));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return out.sort((a, b) => a.questionNumber - b.questionNumber);
}
/* 객관식 정답 1~5 → ①~⑤ */
const CIRC = ['', '①', '②', '③', '④', '⑤'];
function answerOf(c) {
  const a = (c.answers || [])[0] || {};
  const raw = Array.isArray(a.answer) ? a.answer.join(', ') : (a.answer == null ? '' : String(a.answer));
  const type = a.type || '';
  if (/choice/.test(type)) return { answer: raw.split(/[,\s]+/).filter(Boolean).map((d) => CIRC[Number(d)] || d).join(''), answerType: type };
  return { answer: raw || a.latex || '', answerType: type || 'short_answer' };
}

(async () => {
  const [id, dir] = process.argv.slice(2);
  if (!id || !dir) { console.error('사용법: node sync/ms_exam_fetch.js <mydb id> <폴더>'); process.exit(1); }
  await login();
  const m = (await (await fetch(`${MS_API}/bms/api/v1/mydbs/${id}`, { headers: H() })).json()).data || {};
  const cs = await cells(id);
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const rows = [];
  for (const c of cs) {
    const no = c.questionNumber;
    const mi = (c.myDbInfos || [])[0] || {};
    const ch = ((c.chapters || []).find((x) => String(x.curriculumId) === '1') || (c.chapters || [])[0] || {}).chapter || [];
    const a0 = (c.answers || [])[0] || {};
    const psg = c.passage && c.passage.imagePath;
    rows.push({ no, score: (mi.scores || [])[0] ?? null, difficulty: (a0.difficulty && a0.difficulty.mathSecr) ?? null, ...answerOf(c), chapter: ch.join(' > '), ...(psg ? { passage: c.passage.id } : {}) });
    if (psg) {
      const r = await fetch(psg, { headers: { cookie: CDN, origin: MS_ORIGIN, referer: MS_ORIGIN + '/' } });
      if (r.ok) fs.writeFileSync(path.join(dir, 'img', `p${String(no).padStart(2, '0')}.png`), Buffer.from(await r.arrayBuffer()));
    }
    if (c.imagePath) {
      const r = await fetch(c.imagePath, { headers: { cookie: CDN, origin: MS_ORIGIN, referer: MS_ORIGIN + '/' } });
      if (!r.ok) { console.error(`  ${no}번 그림 ${r.status}`); continue; }
      fs.writeFileSync(path.join(dir, 'img', `q${String(no).padStart(2, '0')}.png`), Buffer.from(await r.arrayBuffer()));
    }
  }
  fs.writeFileSync(path.join(dir, 'cells.json'), JSON.stringify(rows, null, 1));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id: Number(id), title: m.title, questionCount: m.questionCount }, null, 1));
  console.log(`「${m.title}」 ${rows.length}문항 → ${dir}`);
  rows.forEach((r) => console.log(`  ${r.no}. ${r.answer} · ${r.score}점 · 난이도 ${r.difficulty} · ${r.chapter}`));
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
