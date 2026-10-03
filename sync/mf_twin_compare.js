#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 👯 매쓰플랫 「시중교재 쪽 → 쌍둥이 문제」 조사·비교표 — 원본과 쌍둥이를 나란히 놓은 HTML 한 장
 * ═══════════════════════════════════════════════════════════════════
 * 원장 요청 2026-10-03: 「쎈 중등수학1(상) 174~175쪽. 매쓰플랫에 쌍둥이가 있는지, 몇 번이 있는지 조사해 보여 달라.」
 *
 * 매쓰플랫 선생님 웹의 「교재 → 쌍둥이·유사 학습지」 화면이 쓰는 요청을 그대로 쓴다 (2026-10-03 번들 분석, docs/mathflat_workbook_twin_api.md):
 *   ① GET /workbook/{bid}                                        → 교재 정보(pairX = 쌍둥이 배수, pairFlag) + 배정 학생
 *   ② GET /student-workbook/student/{sid}?workbookType=ALL         → 그 학생의 교재 인스턴스(swId·revId)
 *   ③ GET /student-workbook/student/{sid}/{swId}/{revId}?size=2000 → 쪽 목록(쪽 번호 ↔ 쪽 id)
 *   ④ GET /workbook/{bid}/page/{pid}?size=300                       → 그 쪽의 문항(번호·id·유형·난이도·정답·원본 그림)
 *   ⑤ GET /derivation/workbook/problem?workbookId=&studentIdList=&workbookProblemIdList=…&pairX=3&similarX=0&levelType=NORMAL
 *          &excludePrevious=false&includeSameProblem=false&onlyAutoScorable=false&limitProblemCountPerConcept=10
 *        → 문항별 쌍둥이(숫자 변형) 문항: 그림·정답 그림·해설 그림·난이도.  ★ limitProblemCountPerConcept 기본값 3이면
 *          같은 유형의 문항은 합쳐서 3개까지만 와서 「쌍둥이 없음」으로 잘못 보인다 → 크게 준다.
 *   ⑥ GET /concept/chips?curriculumKey=1&workbookIds={bid}          → 유형 번호 → 유형 이름
 *   읽기만 한다. 학습지를 만들거나 배정하지 않는다. 학생 이름은 저장하지 않는다.
 *
 * 쓰는 법
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *   node sync/mf_twin_compare.js --book 2119121 --pages 174-175 [--out 파일.html] [--no-embed] [--runs 2]
 *     --book    매쓰플랫 교재 id (시중교재 목록: GET /workbook?type=PUBLIC&schoolType=MIDDLE&size=1000)
 *     --pages   쪽 범위 (174-175) 또는 쪽 하나 (174)
 *     --out     결과 HTML 경로 (기본 sync/_debug/twin_compare_<교재>_<쪽>.html — .gitignore 에 있음)
 *     --no-embed 그림을 data URI 로 심지 않고 매쓰플랫 주소를 그대로 둔다 (파일은 작아지지만 artifact 에서는 그림이 안 뜬다)
 *     --runs N  쌍둥이 요청을 N번 보내 합친다(매쓰플랫이 매번 3개를 무작위로 고르므로 풀이 더 크면 더 모인다). 기본 2
 *   환경변수: MATHFLAT_ID · MATHFLAT_PASSWORD
 * ═══════════════════════════════════════════════════════════════════ */
const fs = require('fs'); const path = require('path');
const API = 'https://api.mathflat.com';
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BID = String(val('--book', '')); const PAGES = String(val('--pages', ''));
if (!BID || !PAGES) { console.error('--book <교재id> --pages <174-175> 가 필요합니다'); process.exit(1); }
const [P0, P1] = PAGES.split('-').map(Number); const PMAX = P1 || P0;
const EMBED = !has('--no-embed'); const RUNS = Math.max(1, Number(val('--runs', 2)) || 2);
const OUT = val('--out', path.join(__dirname, '_debug', `twin_compare_${BID}_${PAGES}.html`));
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
  if (!res.ok) throw new Error(`${res.status} @ ${p.slice(0, 80)} ${text.slice(0, 160)}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}
const asList = (r) => (Array.isArray(r) ? r : ((r && r.content) || []));
const qs = (o) => Object.entries(o).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}=${encodeURIComponent(x)}`) : [`${k}=${encodeURIComponent(v)}`])).join('&');
const TYPE_KO = { SINGLE_CHOICE: '객관식', MULTIPLE_CHOICE: '객관식(복수)', SHORT_ANSWER: '주관식', ESSAY: '서술형' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 그림을 data URI 로 (artifact 는 바깥 그림 주소를 막는다) */
async function dataUri(url) {
  if (!url) return null; if (!EMBED) return url;
  try { const r = await fetch(url); if (!r.ok) return url; const buf = Buffer.from(await r.arrayBuffer());
    const mime = /\.jpe?g(\?|$)/i.test(url) ? 'image/jpeg' : 'image/png'; return `data:${mime};base64,${buf.toString('base64')}`; } catch (_) { return url; }
}

(async () => {
  await login(); log('매쓰플랫 로그인 OK');
  const book = await api(`/workbook/${BID}`);
  const title = (book.fulltitle || `${book.title} ${book.subtitle || ''}`).replace(/\s+/g, ' ').trim();
  const PAIRX = book.pairFlag && book.pairX ? book.pairX : 0;
  log(`교재 ${BID} 「${title}」 ${book.publisher || ''} · ${book.revision === 'CURRICULUM_22' ? '22개정' : '15개정'} · 쌍둥이 배수 pairX=${PAIRX}`);
  if (!PAIRX) log('⚠ 이 교재는 pairFlag 가 꺼져 있어 매쓰플랫 쌍둥이가 없습니다. 원본만 정리합니다.');
  /* 배정 학생은 교재 상세(/workbook/{id})에는 없고 교재 목록(/workbook?type=…)의 list 에만 온다 */
  let assigned = book.list || [];
  if (!assigned.length) { try { const row = asList(await api(`/workbook?type=${book.type || 'PUBLIC'}&schoolType=${book.schoolType}&size=1000`)).find((w) => String(w.id) === BID); assigned = (row && row.list) || []; } catch (e) { log('교재 목록 조회 실패:', e.message); } }
  const stu = assigned.find((s) => s.studentStatus === 'ACTIVE') || assigned[0];
  if (!stu) { log('이 교재가 배정된 학생이 없어 쪽 목록을 열 수 없습니다 (매쓰플랫에서 학생 한 명에게 배정 후 다시)'); process.exit(1); }
  const SID = stu.studentId;                                   // 학생 id 만 쓴다. 이름은 어디에도 남기지 않는다
  const inst = asList(await api(`/student-workbook/student/${SID}?workbookType=ALL`)).find((x) => String(x.id) === BID);
  if (!inst || !inst.studentWorkbook) { log('학생 교재함에서 교재를 못 찾았습니다'); process.exit(1); }
  const det = await api(`/student-workbook/student/${SID}/${inst.studentWorkbook.id}/${inst.recentRevisionId}?size=2000`);
  const pages = ((det.page && det.page.content) || []).map((pg) => ({ pid: pg.workbookPage.id, page: pg.workbookPage.page, title: pg.workbookPage.title || '' }))
    .filter((p) => p.page >= P0 && p.page <= PMAX).sort((a, b) => a.page - b.page);
  if (!pages.length) { log(`${PAGES}쪽이 교재 쪽 목록에 없습니다 (이 교재 쪽 범위를 확인)`); process.exit(1); }
  log(`쪽 ${pages.map((p) => p.page + '(' + p.title + ')').join(' · ')}`);

  const problems = [];
  for (const p of pages) {
    const arr = asList(await api(`/workbook/${BID}/page/${p.pid}?size=300`));
    arr.forEach((q) => problems.push({ id: q.id, page: p.page, pageTitle: p.title, no: String(q.number || ''), step: q.title || '', cid: q.conceptId, level: q.level,
      type: q.type, answer: (q.answer && q.answer !== '.') ? String(q.answer) : '', img: (q.exampleProblem && q.exampleProblem.url) || (q.problem && q.problem.url) || null,
      aimg: q.answerImageUrl || null, twins: [] }));
    await sleep(80);
  }
  log(`원본 문항 ${problems.length}개`);

  /* 유형 이름 */
  const cname = {};
  try { asList(await api(`/concept/chips?curriculumKey=1&workbookIds=${BID}`)).forEach((c) => { if (c.conceptId && !cname[c.conceptId]) cname[c.conceptId] = { name: c.conceptName, chapter: c.littleChapterName, kind: c.conceptChipType }; }); } catch (e) { log('유형 이름 조회 실패:', e.message); }

  /* 쌍둥이 */
  if (PAIRX) {
    const base = { workbookId: BID, studentIdList: [SID], workbookProblemIdList: problems.map((q) => q.id), pairX: PAIRX, similarX: 0, levelType: 'NORMAL',
      excludePrevious: false, includeSameProblem: false, onlyAutoScorable: false, limitProblemCountPerConcept: 10 };
    const seen = {};
    for (let r = 0; r < RUNS; r++) {
      const d = await api(`/derivation/workbook/problem?${qs(base)}`);
      (d.problemList || []).forEach((t) => {
        const q = problems.find((x) => x.id === t.workbookProblemId); if (!q) return;
        const k = q.id + ':' + t.id; if (seen[k]) return; seen[k] = 1;
        q.twins.push({ id: t.id, level: t.level, type: t.type, cid: t.conceptId, img: t.problemImageUrl, aimg: t.answerImageUrl, simg: t.solutionImageUrl,
          rate: t.problemSummary && t.problemSummary.answerRate != null ? t.problemSummary.answerRate : null });
      });
      log(`  쌍둥이 요청 ${r + 1}/${RUNS}: ${d.problemSize}문항 받음 (누적 서로 다른 ${Object.keys(seen).length}개)`);
      await sleep(400);
    }
  }
  problems.forEach((q) => q.twins.sort((a, b) => a.id - b.id));
  const withTwin = problems.filter((q) => q.twins.length).length, nTwin = problems.reduce((s, q) => s + q.twins.length, 0);
  console.log('\n쪽  번호   유형                                        난이도  형식     쌍둥이');
  problems.forEach((q) => console.log(`${q.page}  ${q.no.padEnd(6)} ${((cname[q.cid] || {}).name || q.cid || '').slice(0, 26).padEnd(28)} ${String(q.level).padEnd(6)} ${(TYPE_KO[q.type] || q.type).padEnd(8)} ${q.twins.length}개`));
  console.log(`\n합계: 원본 ${problems.length}문항 · 쌍둥이 있는 문항 ${withTwin} · 쌍둥이 총 ${nTwin}개 · 3개 미만 ${problems.filter((q) => q.twins.length < 3).map((q) => q.no + '번(' + q.twins.length + ')').join(', ') || '없음'}`);

  /* 그림 심기 */
  if (EMBED) { log('그림을 파일 안에 심는 중…'); for (const q of problems) { q.img = await dataUri(q.img); q.aimg = await dataUri(q.aimg); for (const t of q.twins) { t.img = await dataUri(t.img); t.aimg = await dataUri(t.aimg); t.simg = await dataUri(t.simg); } } }

  /* HTML */
  const short = title.replace(/\s*-\s*/, ' ').replace('중등수학', '중');
  const LV = (l) => `<span class="lv lv${l || 0}" title="난이도 ${l}">${['', '최하', '하', '중', '상', '최상'][l] || l}</span>`;
  const ans = (q) => q.answer ? `<span class="ans">정답 <b>${esc(q.answer)}</b></span>` : '';
  const twinCard = (t, i) => `<figure class="twin">
      <figcaption><span class="tag">쌍둥이 ${i + 1}</span>${LV(t.level)}<span class="muted">${esc(TYPE_KO[t.type] || t.type)}${t.rate != null ? ' · 정답률 ' + Math.round(t.rate) + '%' : ''}</span></figcaption>
      ${t.img ? `<img src="${t.img}" alt="쌍둥이 문제 ${i + 1}" loading="lazy">` : '<p class="muted">그림 없음</p>'}
      <details><summary>정답·해설</summary>${t.aimg ? `<img src="${t.aimg}" alt="정답" loading="lazy">` : ''}${t.simg ? `<img src="${t.simg}" alt="해설" loading="lazy">` : ''}</details>
    </figure>`;
  const cards = problems.map((q) => { const c = cname[q.cid] || {}; return `<section class="prob" id="p${esc(q.no)}">
    <header class="prob-h"><h2><span class="pg">${q.page}쪽</span> ${esc(q.no)}번</h2>
      <p class="meta">${esc(c.name || ('유형 ' + q.cid))}${c.kind ? ` <span class="kind">${esc(c.kind)}</span>` : ''} · ${esc(q.step)} · ${LV(q.level)} · ${esc(TYPE_KO[q.type] || q.type)}</p>
      <p class="count ${q.twins.length ? (q.twins.length >= 3 ? 'ok' : 'few') : 'none'}">매쓰플랫 쌍둥이 ${q.twins.length}개</p></header>
    <div class="row">
      <figure class="orig"><figcaption><span class="tag orig-tag">원본</span>${ans(q)}</figcaption>${q.img ? `<img src="${q.img}" alt="원본 ${q.no}번">` : '<p class="muted">그림 없음</p>'}</figure>
      <div class="twins">${q.twins.length ? q.twins.map(twinCard).join('') : '<p class="empty">매쓰플랫에 이 문항의 쌍둥이가 없습니다. 여기가 Claude 가 채울 자리입니다.</p>'}</div>
    </div></section>`; }).join('\n');
  const few = problems.filter((q) => q.twins.length < 3);
  const html = `<title>${esc(short)} ${esc(PAGES)}쪽 쌍둥이</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600&display=swap">
<style>
/* 레이아웃: 문항마다 한 띠. 왼쪽 원본 1칸, 오른쪽 쌍둥이 최대 3칸. 좁으면 세로로 쌓인다 */
:root{--bg:#f2f4f7;--card:#ffffff;--fg:#1c2330;--muted:#5c6b7f;--line:#d9dee6;--accent:#1f6f8b;--accent-soft:#e3f0f5;--orig:#8a4b1f;--orig-soft:#f6ebe1;--ok:#2e7d4f;--few:#b26a00;--none:#b3261e;
 --f-body:"Noto Sans KR",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;--f-head:"Noto Serif KR","Noto Sans KR",serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141922;--card:#1d2430;--fg:#e6eaf0;--muted:#9aa7b8;--line:#2f3947;--accent:#6fb7d0;--accent-soft:#1b3340;--orig:#e0a071;--orig-soft:#3a2a1c;--ok:#6fcf97;--few:#f0b35a;--none:#f28b82;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141922;--card:#1d2430;--fg:#e6eaf0;--muted:#9aa7b8;--line:#2f3947;--accent:#6fb7d0;--accent-soft:#1b3340;--orig:#e0a071;--orig-soft:#3a2a1c;--ok:#6fcf97;--few:#f0b35a;--none:#f28b82;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--f-body);line-height:1.5;margin:0}
.wrap{max-width:1180px;margin:0 auto;padding-block:20px 48px;padding-inline:16px}
h1{font-family:var(--f-head);font-size:1.5rem;margin:0 0 4px;text-wrap:balance}
.sub{color:var(--muted);margin:0 0 16px;font-size:.92rem}
.sum{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}
.sum div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;min-width:120px;flex:1 1 140px}
.sum b{display:block;font-size:1.4rem;font-variant-numeric:tabular-nums}
.sum span{font-size:.8rem;color:var(--muted)}
.jump{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}
.jump a{font-size:.85rem;padding:4px 10px;border:1px solid var(--line);border-radius:999px;color:var(--fg);text-decoration:none;background:var(--card)}
.jump a.none{border-color:var(--none);color:var(--none)} .jump a.few{border-color:var(--few);color:var(--few)}
.prob{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 16px}
.prob-h{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;margin:0 0 10px}
.prob-h h2{font-family:var(--f-head);font-size:1.15rem;margin:0}
.pg{color:var(--muted);font-weight:500;font-size:.9rem;margin-right:2px}
.meta{margin:0;color:var(--muted);font-size:.88rem;flex:1 1 300px;min-width:0}
.kind{font-size:.75rem;border:1px solid var(--line);border-radius:4px;padding:0 5px}
.count{margin:0;font-weight:700;font-size:.9rem}.count.ok{color:var(--ok)}.count.few{color:var(--few)}.count.none{color:var(--none)}
.row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,3fr);gap:12px}
@media (max-width:860px){.row{grid-template-columns:1fr}}
figure{margin:0;min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--bg)}
figure img{display:block;width:100%;max-width:100%;height:auto;border-radius:4px;background:#fff}
figcaption{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8rem;color:var(--muted);margin:0 0 6px}
.tag{font-weight:700;letter-spacing:.04em;font-size:.72rem;text-transform:uppercase;padding:1px 7px;border-radius:4px;background:var(--accent-soft);color:var(--accent)}
.orig-tag{background:var(--orig-soft);color:var(--orig)} .orig{border-color:var(--orig)}
.ans{margin-left:auto;color:var(--fg)}
.twins{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;min-width:0}
.empty{margin:0;padding:14px;border:1px dashed var(--none);border-radius:8px;color:var(--none);font-size:.9rem}
.lv{font-size:.72rem;padding:1px 6px;border-radius:4px;border:1px solid var(--line)}
.lv4,.lv5{border-color:var(--few)} .lv5{font-weight:700}
.muted{color:var(--muted)}
details{margin-top:6px;font-size:.82rem}summary{cursor:pointer;color:var(--accent)}details img{margin-top:6px}
.foot{color:var(--muted);font-size:.8rem;margin-top:24px;border-top:1px solid var(--line);padding-top:10px}
@media (prefers-reduced-motion:no-preference){.jump a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}}
</style>
<div class="wrap">
<h1>${esc(short)} ${esc(PAGES)}쪽 · 매쓰플랫 쌍둥이 조사</h1>
<p class="sub">${esc(book.publisher || '')} · ${book.revision === 'CURRICULUM_22' ? '2022 개정' : '2015 개정'} · ${pages.map((p) => p.page + '쪽 ' + esc(p.title)).join(' · ')} · 조사 ${new Date().toISOString().slice(0, 10)} · 교재의 쌍둥이 배수 ${PAIRX}</p>
<div class="sum">
 <div><b>${problems.length}</b><span>원본 문항</span></div>
 <div><b>${withTwin}</b><span>쌍둥이 있는 문항</span></div>
 <div><b>${nTwin}</b><span>매쓰플랫 쌍둥이 총수</span></div>
 <div><b>${few.length}</b><span>3개 미만인 문항${few.length ? ' · ' + few.map((q) => q.no + '번').join(', ') : ''}</span></div>
</div>
<nav class="jump">${problems.map((q) => `<a href="#p${esc(q.no)}" class="${q.twins.length ? (q.twins.length >= 3 ? '' : 'few') : 'none'}">${esc(q.no)}번 · ${q.twins.length}</a>`).join('')}</nav>
${cards}
<p class="foot">매쓰플랫 쌍둥이는 「교재 → 쌍둥이 학습지」 화면이 쓰는 같은 요청(derivation/workbook/problem)으로 받았고, 유형당 문항 수 제한을 풀어 전부 보이게 했습니다. 그림은 매쓰플랫·좋은책신사고 저작물이라 원장님 확인용으로만 쓰고 밖으로 내보내지 않습니다. 학생 이름·기록은 이 파일에 없습니다.</p>
</div>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  fs.writeFileSync(OUT.replace(/\.html$/, '.json'), JSON.stringify({ bid: BID, title, pairX: PAIRX, pages, problems: problems.map((q) => ({ ...q, img: EMBED ? '(embedded)' : q.img, aimg: EMBED ? '(embedded)' : q.aimg, twins: q.twins.map((t) => ({ ...t, img: EMBED ? '(embedded)' : t.img, aimg: EMBED ? '(embedded)' : t.aimg, simg: EMBED ? '(embedded)' : t.simg })) })) }, null, 1));
  log(`저장: ${OUT} (${Math.round(html.length / 1024)}KB)`);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
