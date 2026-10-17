#!/usr/bin/env node
/* 학원앱 v19-128 검사 — 🎯 적중 분석 검토 빠르게 (원장 2026-10-17 「판정은 내가 하나하나 봐야 해서 너무 오래 걸린다」)
 *   가짜 범박고 고2 미적분1 (src.mp 비어 있음) — 문항 11개, 후보 종류 섞음:
 *     1 [같은 문제] · 2 [숫자변형, 유사유형] · 3 [숫자변형, 같은 문제](후보 2개) · 4 [유사, 유사] · 5 [유사] + 교과서 숫자변형 · 6 [숫자변형] 원장 ✗ 적중 없음
 *     7 [같은 문제] 원장 숫자변형 확정 · 8 후보 없음 · 9 [지문만] · 10 [유사] · 11 [유사, 숫자변형(✗ 아님)]
 *   ① hitEff — 원장 확정이 AI 보다 먼저 · AI 자동(1·2·3) · 끄면 htEff 가 v19-127 htEff 와 똑같음 · 켜도 AI 아닌 문항은 똑같음
 *   ② 적중률: 켬 = 확정 4(AI 3) · 후보 0 · 확정 안 한 문항 5 / 끔 = 확정 1 · 후보 3 · 확정 안 한 문항 8 (두 경우 모두 적중 4/11 = 36%)
 *      도넛 · 요약 줄 · 오른쪽 칸(스위치 · AI 수 · 접어 둔 수 · ⚡ 빠른 검토) · 왼쪽 목록 · 학부모 보고서 (AI) · .md «AI 판정» · 요약 복사 · 카드뉴스 .md·칩 / 끄면 AI 글자 없음
 *   ③ 유사유형 접기 — 4·10·11 한 줄 · 눌러서 펼침 · 「유사유형만 문항도 펼치기」(ht_type_open)
 *   ④ ⚡ 빠른 검토 — 목록 1·2·3(3번 「후보 2개 이상」) · 「유사유형만 3문항 — 접어 둠」 · 키 2 → 1번 숫자변형(htSetKind 와 같은 저장) · 키 4 → 2번 ✗(htConfirm 과 같은 저장)
 *      · ↓ 다음 후보 · ← · Enter · 키 1 → 3번 둘째 후보 같은 문제 · Esc · 다시 열면 «없음» · 포함하기 = 유사유형만 문항
 *   ⑤ 고등부 내 문제지 자동 체크 — 다시 판정 화면(src.mp 비어 있음): 미적분1·미적1·폴더 미적분1 = 3장 · 기출·다른 과목·다른 학교·시험 뒤·0문항 뺌 · 끄기 · 새 요청(공통수학2 → 공수2) · 중학교는 띠 없음
 *   ⑥ 결과 노란 띠 「수학비서 자료 없이 판정된 결과예요 — 다시 판정을 권해요」 · 단추 → 다시 판정 화면 · src.mp 있으면 띠 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19128.js lumen_v19-128.html
 *   그림: $SP/v19128.png (⚡ 빠른 검토 · 가짜 자료)
 *   가짜 서버 · 외부망 차단. 학생 실명·실제 점수·시험 문항 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-128.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-128'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const EID = '범박고_고2_2026_2_중간', K = 'exam_hit_' + EID;
const SVG = (c, txt, h) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="520" height="' + (h || 180) + '"><rect width="520" height="' + (h || 180) + '" fill="' + c + '"/><text x="18" y="60" font-size="22" fill="#334155">' + txt + '</text><text x="18" y="100" font-size="16" fill="#64748b">(가짜 그림)</text></svg>');
const C = (k, kind, o) => Object.assign({ k, kind, why: { same: '숫자·조건까지 같음', var: '숫자만 다름', type: '같은 유형', text: '소재만 같음' }[kind], also: [] }, o || {});
const item = (no, o) => Object.assign({ no, cid: 700 + no, chapter: '미분', type: '유형 ' + no, level: 3, img: '', imgUrl: SVG('#eff6ff', '시험 ' + no + '번', 220), cands: [], hit: null, repeat: [], pub: [] }, o || {});
const MAT = (title, where, c) => ({ kind: 'ms', mp: true, title, where, img: SVG(c || '#f5f3ff', title + ' ' + where), res: {} });
const STORE = {
  exam_hit_index: { items: [{ examId: EID, school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', total: 11, at: '2026-10-16T05:00:00Z' }] },
  ms_mypapers_index: { updated: '2026-10-16', tree: [{ id: 1, n: '작업공간', c: [{ id: 2, n: '미적분1', c: [] }, { id: 3, n: '소사고', c: [] }, { id: 4, n: '범박고', c: [] }, { id: 5, n: '공수2', c: [] }] }],
    items: [
      { id: 'A1', title: '미적분1 3단원 점검', folderId: 2, folderPath: '작업공간 › 미적분1', n: 20, createdAt: '2026-09-10T01:00:00Z', status: 'ready' },
      { id: 'B2', title: '미적1 교과서 변형', folderId: 2, folderPath: '작업공간 › 미적분1', n: 15, createdAt: '2026-09-20T01:00:00Z', status: 'pending' },
      { id: 'C3', title: '공수2 복습', folderId: 5, folderPath: '작업공간 › 공수2', n: 12, createdAt: '2026-09-15T01:00:00Z', status: 'ready' },
      { id: 'D4', title: '2학기 대비 프린트', folderId: 2, folderPath: '작업공간 › 미적분1', n: 8, createdAt: '2026-09-25T01:00:00Z', status: 'ready' },
      { id: 'E5', title: '25년 범박고 미적분1 기출', folderId: 4, folderPath: '작업공간 › 범박고', n: 21, createdAt: '2026-09-01T01:00:00Z', status: 'ready' },
      { id: 'F6', title: '미적분1 소사고 대비', folderId: 3, folderPath: '작업공간 › 소사고', n: 18, createdAt: '2026-09-11T01:00:00Z', status: 'ready' },
      { id: 'G7', title: '미적분1 마무리', folderId: 2, folderPath: '작업공간 › 미적분1', n: 10, createdAt: '2026-11-20T01:00:00Z', status: 'pending' },
      { id: 'H8', title: '미적분1 빈 문제지', folderId: 2, folderPath: '작업공간 › 미적분1', n: 0, createdAt: '2026-09-12T01:00:00Z', status: 'pending' } ] },
};
STORE[K] = { examId: EID, exam: { school: '범박고', grade: '고2', year: 2026, semester: '2', term: '중간', subject: '미적분1', mydb: null, date: '2026-10-01' }, basis: 'same+var', students: ['AAA111'],
  from: '2026-07-01', to: '2026-10-01', src: { tb: { on: false, mode: 'all', bids: [] }, ms: [], lib: [], mf: true, mp: [] },
  items: [
    item(1, { cands: [C('mp:9:1', 'same')] }),
    item(2, { cands: [C('mp:9:2', 'var'), C('mp:9:3', 'type')] }),
    item(3, { cands: [C('mp:9:4', 'var'), C('mp:9:5', 'same')] }),
    item(4, { cands: [C('mp:9:6', 'type'), C('mp:9:7', 'type')] }),
    item(5, { cands: [C('mp:9:8', 'type')], pub: [{ k: 'pub:51', pub: '동아', page: 40, no: '3', kind: 'var', imgUrl: SVG('#ecfeff', '교과서') }] }),
    item(6, { cands: [C('mp:9:9', 'var')], hit: { k: null, kind: 'none', ok: false, by: 'teacher', at: '2026-10-16T06:00:00Z' } }),
    item(7, { cands: [C('mp:9:10', 'same')], hit: { k: 'mp:9:10', kind: 'var', ok: true, by: 'teacher', at: '2026-10-16T06:00:00Z' } }),
    item(8),
    item(9, { cands: [C('mp:9:11', 'text')] }),
    item(10, { cands: [C('mp:9:12', 'type')] }),
    item(11, { cands: [C('mp:9:13', 'type'), C('mp:9:14', 'var', { rejected: true, ai: 'var' })] }) ],
  mats: {}, stats: { total: 11, byKind: { ms: { mats: 120, hit: 3, mp: { mats: 0, hit: 0, papers: 0 } } } } };
['1번 3', '2번 1', '2번 2', '4번 5', '4번 6', '1번 7', '1번 8', '3번 2', '5번 1', '6번 4', '7번 2', '8번 9', '3번 3', '9번 9'].forEach((w, i) => {
  STORE[K].mats['mp:9:' + (i + 1)] = MAT('미적분1 점검', w, ['#fef2f2', '#fff7ed', '#f5f3ff'][i % 3]); });

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STORE) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), upserts: [], toasts: [], printed: '', copied: '', asked: [] };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({
          eq: (k, v) => Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: clone(T.store[v]) }] : [] }),
          like: () => Promise.resolve({ data: [] }),
          in: (k, arr) => Promise.resolve({ data: arr.filter((x) => Object.prototype.hasOwnProperty.call(T.store, x)).map((x) => ({ key: x })) }) }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push(r.key); T.store[r.key] = clone(r.value); }); return Promise.resolve({ error: null }); } }),
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }) }) } });
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', school: '범박고', grade: '고등학교 2학년', lumen_rec_code: 'AAA111' }];
    window.plToast = (m) => { T.toasts.push(m); };
    window.eaSign = () => Promise.resolve();
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = (m) => { T.asked.push(String(m)); return true; };
    window.open = () => ({ document: { open() {}, write(x) { T.printed += x; }, close() {} } });
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (x) => { T.copied = String(x); return Promise.resolve(); } } }); } catch (e) {}
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rExamHit(); };
    VIEW = 'examhit';
    try { localStorage.removeItem('ht_type_open'); } catch (e) {}
  }, STORE);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);
  const load = async () => {
    await pg.evaluate((EID) => { HT.kicked = true; HT.idx = JSON.parse(JSON.stringify(T.store.exam_hit_index)); HT.req = { status: 'done' }; HT.data = {}; HT.view = 'sheet'; HT.unfold = {}; HT.cur = EID; HTS.open = false; HTS.rejudge = null; htLoad(HT.cur, true); }, EID);
    await settle(250); await pg.evaluate(() => render()); await settle(250); await pg.evaluate(() => render()); await settle(60);
  };
  await load();

  /* ── ① hitEff ── */
  const e1 = await pg.evaluate(() => {
    const d = HT.data[HT.cur], it = (n) => d.items.filter((x) => x.no === n)[0];
    const pick = (e) => ({ kind: e.kind, by: e.by, k: e.cand ? e.cand.k : null });
    const on = {}; d.items.forEach((x) => { on[x.no] = pick(hitEff(x, d)); });
    const sameOld = (filter) => d.items.filter(filter).every((x) => { const a = htEff(x), b = hvOrigEff(x); return a.kind === b.kind && a.k === b.k && a.sure === b.sure; });
    const onKeep = sameOld((x) => hitEff(x, d).by !== 'ai');
    d.autoAi = false;
    const off = {}; d.items.forEach((x) => { off[x.no] = pick(hitEff(x, d)); });
    const offSame = sameOld(() => true);
    delete d.autoAi;
    return { on, off, onKeep, offSame, hit7: it(7).hit.kind };
  });
  t('hitEff 켬: 1 AI 같은 문제 · 2 AI 숫자변형 · 3 AI 숫자변형(1순위) · 4 유사(미확정) · 11 ✗ 아님 뺀 1순위 유사(미확정)',
    e1.on[1].by === 'ai' && e1.on[1].kind === 'same' && e1.on[2].by === 'ai' && e1.on[2].kind === 'var' && e1.on[3].by === 'ai' && e1.on[3].k === 'mp:9:4'
      && e1.on[4].by === null && e1.on[4].kind === 'type' && e1.on[11].by === null && e1.on[11].kind === 'type', JSON.stringify(e1.on));
  t('원장 확정이 AI 보다 먼저: 7번 후보는 같은 문제지만 원장 숫자변형 · 6번 원장 ✗ 적중 없음',
    e1.on[7].by === 'teacher' && e1.on[7].kind === 'var' && e1.on[6].by === 'teacher' && e1.on[6].kind === 'none' && e1.off[7].by === 'teacher', JSON.stringify([e1.on[6], e1.on[7]]));
  t('끄면(autoAi=false) AI 없음 · htEff 가 v19-127 htEff 와 11문항 모두 같음', !Object.keys(e1.off).some((n) => e1.off[n].by === 'ai') && e1.offSame, JSON.stringify(e1.off));
  t('켜도 AI 가 아닌 문항의 htEff 는 v19-127 과 같음', e1.onKeep);

  /* ── ② 적중률 · 화면 숫자 ── */
  const nums = () => pg.evaluate(() => {
    const d = HT.data[HT.cur], s = htStats(d), box = document.getElementById('tdemo'), q = (x) => box.querySelector(x);
    const sum = [...box.querySelectorAll('.ht-card')][1] || box;
    return { s: { hitSure: s.hitSure, hitCand: s.hitCand, hitAi: s.hitAi, aiN: s.aiN, open: s.open, typeOnly: s.typeOnly, pctAll: s.pctAll, pctSure: s.pctSure, autoAi: s.autoAi },
      donut: (q('.ht-grid svg[aria-label]') || { getAttribute: () => '' }).getAttribute('aria-label'), donutTxt: (q('.ht-grid svg') || {}).textContent || '',
      sub: ((q('.ht-grid .ht-sub') || {}).textContent || '').slice(0, 40), aiLine: (q('#hv-ai-line') || {}).textContent || '', ctl: !!q('#hv-ctl'), revBtn: (q('#hv-rev-btn') || {}).textContent || '',
      right: RIGHT_TOOLS.examhit(), left: l3hExamSub(HT.idx.items[0]), sheetAi: (q('#hv-sheet-ai') || {}).textContent || '', aiPills: box.querySelectorAll('.hv-aipill').length };
  });
  const n1 = await nums();
  t('켬: 확정 4(그중 AI 3) · 후보 0 · 확정 안 한 문항 5 · 유사유형만 3 · 적중 36% (4/11)',
    n1.s.hitSure === 4 && n1.s.hitAi === 3 && n1.s.aiN === 3 && n1.s.hitCand === 0 && n1.s.open === 5 && n1.s.typeOnly === 3 && n1.s.pctAll === 36 && n1.s.pctSure === 36 && n1.s.autoAi === true, JSON.stringify(n1.s));
  t('요약: 도넛 36% · 「확정 4 (AI 3) · 후보 0」 · 🤖 AI 줄 · 스위치 · ⚡ 빠른 검토 (3) · 분석지 「그중 AI 3」 · AI 알약',
    n1.donut === '적중률 36%' && /확정 4 \(AI 3\) · 후보 0/.test(n1.sub) && /AI 판정 3문항/.test(n1.aiLine) && n1.ctl && /빠른 검토 \(3\)/.test(n1.revBtn) && /AI 3/.test(n1.sheetAi) && n1.aiPills >= 3, JSON.stringify(n1).slice(0, 400));
  t('오른쪽 칸: 적중 36% · 스위치 · 🤖 AI 판정 3문항 · 유사유형만 3문항 접어 둠 · ⚡ 빠른 검토 3문항 / 왼쪽 목록 «AI 3»',
    /적중 <b[^>]*>36%/.test(n1.right) && /id="l3h-ai"/.test(n1.right) && /AI 판정 3문항 반영/.test(n1.right) && /유사유형만 3문항 — 접어 둠/.test(n1.right) && /id="l3h-rev"[\s\S]*3문항/.test(n1.right) && /AI 3$/.test(n1.left), n1.left + ' | ' + n1.right.slice(0, 300));
  /* 보고서 · .md · 복사 · 카드뉴스 */
  const out1 = await pg.evaluate(() => {
    const d = HT.data[HT.cur]; T.printed = ''; htPrint(''); const pr = T.printed; T.copied = ''; htCopy();
    return { pr, md: htMd(d), copied: T.copied, cnmd: cnMd(d, []), cnp: cnPanelHtml(d), rows: htReportRows(d).filter((r) => r.inB).map((r) => r.n + ':' + r.e.kind + ':' + r.e.sure) };
  });
  await settle(50);
  const copied1 = await pg.evaluate(() => T.copied);
  const prRow = (n) => (out1.pr.match(new RegExp('<tr><td><b>' + n + '</b>[\\s\\S]*?</tr>')) || [''])[0];
  t('학부모 보고서: 1·2·3번 «(AI)» · 7번은 표시 없음 · AI 3문항 설명 글',
    /같은 문제 <small[^>]*>\(AI\)/.test(prRow(1)) && /숫자변형 <small[^>]*>\(AI\)/.test(prRow(2)) && /\(AI\)/.test(prRow(3)) && !/\(AI\)/.test(prRow(7)) && /\(AI\) 표시 3문항은 원장님 확인 전 AI 판정/.test(out1.pr), prRow(1) + ' || ' + prRow(7));
  const mdRow = (n) => (out1.md.split('\n').filter((l) => l.indexOf('| ' + n + ' | ') === 0)[0] || '');
  t('블로그 .md: 1·2·3번 «AI 판정» · 7번 그대로 · 「AI 판정 3문항(1, 2, 3번)」 줄 · (확인 중) 없음',
    /같은 문제 \(AI 판정\)/.test(mdRow(1)) && /숫자변형 \(AI 판정\)/.test(mdRow(2)) && !/AI/.test(mdRow(7)) && /AI 판정 3문항\(1, 2, 3번\)/.test(out1.md) && !/확인 중\)/.test(mdRow(1)), [mdRow(1), mdRow(7)].join(' || '));
  t('요약 복사 · 카드뉴스(.md 줄 · 칩 AI · 안내)',
    /AI 판정 3문항 포함 \(1, 2, 3번/.test(copied1) && /적중 문항 중 3문항\(1, 2, 3번\)은 원장님 확인 전 AI 판정/.test(out1.cnmd) && (out1.cnp.match(/data-hvai="1"/g) || []).length === 3 && /id="hv-cn-ai"/.test(out1.cnp),
    copied1 + ' || ' + out1.cnp.slice(0, 120));
  t('적중 지도·카드 행: 기준 안 1·2·3·7번 (AI 는 sure=ai)', out1.rows.join(',') === '1:same:ai,2:var:ai,3:var:ai,7:var:true', out1.rows.join(','));

  /* 끄기 → 예전과 같음 */
  await pg.evaluate(() => hvAutoAi(false)); await settle(80);
  const n0 = await nums();
  const out0 = await pg.evaluate(() => { const d = HT.data[HT.cur]; T.printed = ''; htPrint(''); return { pr: T.printed, md: htMd(d), saved: T.store[HT.cur ? 'exam_hit_' + HT.cur : ''].autoAi }; });
  t('끔(스위치): 저장 autoAi=false · 확정 1 · 후보 3 · 확정 안 한 문항 8 · 적중 그대로 36% · 확정만 9%',
    out0.saved === false && n0.s.hitSure === 1 && n0.s.hitCand === 3 && n0.s.hitAi === 0 && n0.s.open === 8 && n0.s.pctAll === 36 && n0.s.pctSure === 9 && n0.donut === '적중률 36%', JSON.stringify(n0.s));
  t('끔: 요약 「확정 1 · 후보 3」 · AI 줄·AI 알약 없음 · 보고서 «(확인 중)» · .md 에 AI 판정 없음',
    /확정 1 · 후보 3/.test(n0.sub) && !n0.aiLine && n0.aiPills === 0 && /확인 중/.test(out0.pr) && !/AI 판정/.test(out0.md) && !/\(AI\)/.test(out0.pr), n0.sub);
  await pg.evaluate(() => hvAutoAi(true)); await settle(80);

  /* ── ③ 유사유형 접기 ── */
  const f1 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); return { rows: [...box.querySelectorAll('.hv-typerow')].map((x) => x.getAttribute('data-hvtype')), sw: /유사유형만 문항도 펼치기 \(3\)/.test(box.textContent), q5: !!box.querySelector('#ht-q-5:not(.hv-typerow)') }; });
  t('분석지: 유사유형뿐인 4·10·11번은 한 줄 · 교과서 숫자변형이 있는 5번은 펼쳐 둠 · 스위치 「유사유형만 문항도 펼치기 (3)」', f1.rows.join(',') === '4,10,11' && f1.q5 && f1.sw, JSON.stringify(f1));
  await pg.click('#tdemo .hv-typerow[data-hvtype="4"]'); await settle(60);
  const f2 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); return { rows: [...box.querySelectorAll('.hv-typerow')].map((x) => x.getAttribute('data-hvtype')), fold: !!box.querySelector('[data-hvfold="4"]') }; });
  t('4번 줄을 누르면 펼침(「▲ 유사유형 접기」) · 나머지는 그대로', f2.rows.join(',') === '10,11' && f2.fold, JSON.stringify(f2));
  await pg.evaluate(() => { hvTypeTog(4); hvTypeAll(); }); await settle(60);
  const f3 = await pg.evaluate(() => ({ n: document.querySelectorAll('#tdemo .hv-typerow').length, ls: localStorage.getItem('ht_type_open') }));
  t('「유사유형만 문항도 펼치기」 → 접힌 줄 0 · 이 기기 기억 ht_type_open=1', f3.n === 0 && f3.ls === '1', JSON.stringify(f3));
  await pg.evaluate(() => hvTypeAll()); await settle(60);

  /* ── ④ ⚡ 빠른 검토 ── */
  const SNAP = await pg.evaluate(() => JSON.stringify(HT.data[HT.cur]));
  await pg.evaluate(() => document.getElementById('l3h-rev') ? 0 : 0);
  await pg.evaluate(() => hvRevOpen()); await settle(80);
  await pg.evaluate(() => { const o = document.getElementById('hv-rev'); if (o) o.style.display = ''; });
  const r1 = await pg.evaluate(() => { const o = document.getElementById('hv-rev'); if (!o) return { open: false };
    return { open: true, prog: (o.querySelector('#hv-prog') || {}).textContent, chips: [...o.querySelectorAll('[data-hvchip]')].map((x) => x.getAttribute('data-hvchip')), type: (o.querySelector('#hv-type') || {}).textContent || '',
      row: (o.querySelector('.hv-row') || { getAttribute: () => '' }).getAttribute('data-hvno'), imgs: o.querySelectorAll('.hv-row img').length, kind: (o.querySelector('#hv-kind') || {}).textContent || '',
      acts: [...o.querySelectorAll('[data-hvact]')].map((x) => x.getAttribute('data-hvact')), nextCand: !!o.querySelector('#hv-next-cand') }; });
  t('빠른 검토: 1·2·3번만 · 「1/3」 · 「유사유형만 3문항 — 접어 둠」 · 그림 2장(시험|후보) · AI: 같은 문제 · 단추 4개 + 다음 후보',
    r1.open && r1.chips.join(',') === '1,2,3' && r1.prog === '1/3' && /유사유형만 3문항 — 접어 둠/.test(r1.type) && r1.row === '1' && r1.imgs === 2 && /같은 문제/.test(r1.kind) && r1.acts.join(',') === 'same,var,type,no' && r1.nextCand, JSON.stringify(r1));
  await pg.screenshot({ path: path.join(SP, 'v19128.png') });
  /* 키 2 → 1번 숫자변형 */
  await pg.keyboard.press('2'); await settle(80);
  const r2 = await pg.evaluate(() => ({ prog: document.querySelector('#hv-prog').textContent, row: document.querySelector('#hv-rev .hv-row').getAttribute('data-hvno'), hit: T.store[ 'exam_hit_' + HT.cur].items[0] }));
  t('키 2 → 1번 숫자변형 확정 저장 · 다음 문항 2/3', r2.prog === '2/3' && r2.row === '2' && r2.hit.hit && r2.hit.hit.kind === 'var' && r2.hit.hit.ok === true && r2.hit.hit.by === 'teacher' && r2.hit.hit.k === 'mp:9:1', JSON.stringify(r2));
  /* 키 4 → 2번 ✗ 아님 (남은 후보 유사유형만 → 넘어감) */
  await pg.keyboard.press('4'); await settle(80);
  const r3 = await pg.evaluate(() => ({ prog: document.querySelector('#hv-prog').textContent, row: document.querySelector('#hv-rev .hv-row').getAttribute('data-hvno'), it2: T.store['exam_hit_' + HT.cur].items[1], multi: !!document.querySelector('#hv-multi'), cpos: document.querySelector('#hv-cpos').textContent }));
  t('키 4 → 2번 숫자변형 후보 ✗(rejected) · 남은 유사유형만 → 3번으로 (3/3 · 「후보 2개 이상」 · 후보 1/2)',
    r3.prog === '3/3' && r3.row === '3' && r3.it2.cands.filter((c) => c.k === 'mp:9:2')[0].rejected === true && !r3.it2.hit && r3.multi && r3.cpos === '후보 1/2', JSON.stringify(r3).slice(0, 300));
  /* 예전 단추와 같은 저장인가 — 같은 시작 자료에 htSetKind / htConfirm 을 직접 */
  const same = await pg.evaluate((SNAP) => {
    const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'at' ? undefined : v)));
    const viaRev = strip(T.store['exam_hit_' + HT.cur].items.slice(0, 2));
    const keep = HT.data[HT.cur]; HT.data[HT.cur] = JSON.parse(SNAP);
    const _r = window.render; window.render = () => {};
    htSetKind(1, 'mp:9:1', 'var'); htConfirm(2, 'mp:9:2', false);
    window.render = _r;
    const viaOld = strip(HT.data[HT.cur].items.slice(0, 2));
    HT.data[HT.cur] = keep;
    return { a: JSON.stringify(viaRev), b: JSON.stringify(viaOld) };
  }, SNAP);
  t('빠른 검토의 저장 = 예전 단추(htSetKind 숫자변형 · htConfirm ✗ 아님)와 같은 it.hit·후보', same.a === same.b, same.a + '\n   vs ' + same.b);
  /* ↓ 다음 후보 · ← 이전 · Enter 다음 · 키 1 */
  await pg.keyboard.press('ArrowDown'); await settle(50);
  const r4 = await pg.evaluate(() => ({ cpos: document.querySelector('#hv-cpos').textContent, kind: document.querySelector('#hv-kind').textContent }));
  await pg.keyboard.press('ArrowLeft'); await settle(50);
  const r5 = await pg.evaluate(() => document.querySelector('#hv-prog').textContent);
  await pg.keyboard.press('Enter'); await settle(50);
  const r6 = await pg.evaluate(() => ({ prog: document.querySelector('#hv-prog').textContent, cpos: document.querySelector('#hv-cpos').textContent }));
  t('↓ 다음 후보(2/2 같은 문제) · ← 이전(2/3) · Enter 다음(3/3 · 고른 후보 그대로)', r4.cpos === '후보 2/2' && /같은 문제/.test(r4.kind) && r5 === '2/3' && r6.prog === '3/3' && r6.cpos === '후보 2/2', JSON.stringify([r4, r5, r6]));
  await pg.keyboard.press('1'); await settle(80);
  const r7 = await pg.evaluate(() => ({ it3: T.store['exam_hit_' + HT.cur].items[2].hit, done: document.querySelector('#hv-done').textContent, chips: [...document.querySelectorAll('#hv-rev [data-hvchip]')].map((x) => x.textContent) }));
  t('키 1 → 3번 둘째 후보(mp:9:5) 같은 문제 확정 · 결정 3 · 번호 칩 1·3 ✓ (2번은 유사유형만 남아 미확정)', r7.it3 && r7.it3.k === 'mp:9:5' && r7.it3.kind === 'same' && r7.it3.by === 'teacher' && r7.done === '결정 3' && r7.chips.join(',') === '1번 ✓,2번,3번 ✓', JSON.stringify(r7));
  await pg.keyboard.press('Escape'); await settle(60);
  const r8 = await pg.evaluate(() => ({ gone: !document.getElementById('hv-rev'), s: htStats(HT.data[HT.cur]) }));
  t('Esc 닫기 · 적중 3/11 = 27% (1·3·7번 원장 확정 · 2번은 ✗ 로 빠짐 · AI 0)', r8.gone && r8.s.hitSure === 3 && r8.s.hitAi === 0 && r8.s.hitCand === 0 && r8.s.pctAll === 27, JSON.stringify({ g: r8.gone, h: r8.s.hitSure, a: r8.s.hitAi, p: r8.s.pctAll }));
  await pg.evaluate(() => hvRevOpen()); await settle(60);
  const r9 = await pg.evaluate(() => ({ empty: /결정이 필요한 문항이 없습니다/.test(document.getElementById('hv-rev').textContent), type: (document.querySelector('#hv-type') || {}).textContent || '' }));
  await pg.evaluate(() => hvRevInc()); await settle(60);
  const r10 = await pg.evaluate(() => ({ chips: [...document.querySelectorAll('#hv-rev [data-hvchip]')].map((x) => x.getAttribute('data-hvchip')), prog: document.querySelector('#hv-prog').textContent, type: document.querySelector('#hv-type').textContent }));
  t('다시 열면 «결정이 필요한 문항이 없습니다» · 포함하기 → 유사유형만 2·4·10·11번 (1/4)', r9.empty && /유사유형만 4문항/.test(r9.type) && r10.chips.join(',') === '2,4,10,11' && r10.prog === '1/4' && /포함/.test(r10.type), JSON.stringify([r9, r10]));
  await pg.evaluate(() => hvRevClose()); await settle(60);

  /* ── ⑥ 결과 노란 띠 ── */
  await pg.evaluate(() => render()); await settle(120); await pg.evaluate(() => render()); await settle(60);
  const nt = await pg.evaluate(() => { const el = document.querySelector('#tdemo #hv-mp-notice'); return el ? el.textContent : ''; });
  t('결과: 고등부 · src.mp 비어 있음 → 노란 띠 「수학비서 자료 없이 판정된 결과예요 — 다시 판정을 권해요」 + 미적분1 내 문제지 3장',
    /수학비서 자료 없이 판정된 결과예요 — 다시 판정을 권해요/.test(nt) && /미적분1 에 맞는 내 문제지 3장/.test(nt) && /내 문제지 넣고 다시 판정/.test(nt), nt);
  const nt2 = await pg.evaluate(() => { const d = HT.data[HT.cur], keep = d.src; d.src = Object.assign({}, keep, { mp: ['A1'] }); const a = htSummaryHtml(d).indexOf('hv-mp-notice') >= 0;
    const e = d.exam; d.exam = Object.assign({}, e, { grade: '중2' }); d.src = keep; const b = htSummaryHtml(d).indexOf('hv-mp-notice') >= 0; d.exam = e; return { a, b }; });
  t('src.mp 가 있거나 중학교면 띠 없음', !nt2.a && !nt2.b, JSON.stringify(nt2));

  /* ── ⑤ 다시 판정 화면 — 과목에 맞는 내 문제지 자동 체크 ── */
  await pg.click('#tdemo #hv-mp-rej'); await settle(300); await pg.evaluate(() => render()); await settle(100);
  const m1 = await pg.evaluate(() => { const box = document.getElementById('tdemo'), b = box.querySelector('#hv-mp-auto');
    return { open: HTS.open, rej: !!HTS.rejudge, txt: b ? b.textContent : '', rows: b ? [...b.querySelectorAll('[data-hvmp]')].map((x) => x.getAttribute('data-hvmp') + (x.querySelector('input').checked ? '+' : '-')) : [], mp: htsSrcValue().mp }; });
  t('다시 판정 화면(지난 판정 내 문제지 0장) → 「📄 과목에 맞는 수학비서 내 문제지 3장을 자동으로 넣었어요」 · 미적분1 제목 · 미적1 줄임말 · 폴더 미적분1',
    m1.open && m1.rej && /📄 과목에 맞는 수학비서 내 문제지 3장을 자동으로 넣었어요/.test(m1.txt) && m1.rows.join(',') === 'A1+,B2+,D4+', JSON.stringify(m1));
  t('요청 src.mp 에 A1·B2·D4 — 다른 과목(공수2)·기출·다른 학교·시험 뒤·0문항은 빠짐', ['A1', 'B2', 'D4'].every((x) => m1.mp.indexOf(x) >= 0) && !['C3', 'E5', 'F6', 'G7', 'H8'].some((x) => m1.mp.indexOf(x) >= 0), JSON.stringify(m1.mp));
  await pg.click('#tdemo [data-hvmp="B2"] input'); await settle(80);
  const m2 = await pg.evaluate(() => ({ n: (document.querySelector('#tdemo #hv-mp-n') || {}).textContent, mp: htsSrcValue().mp, off: Object.keys(HTS.mpOff) }));
  t('체크 끄기(B2) → 2장 · src.mp 에서 빠짐 (mpOff 에 기억)', m2.n === '2장' && m2.mp.indexOf('B2') < 0 && m2.off.indexOf('B2') >= 0, JSON.stringify(m2));
  /* 새 요청 — 공통수학2 → «공수2 복습» / 중학교는 띠 없음 / 줄임말 */
  await pg.evaluate(() => { htsClose(); htsOpen({ school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2', date: '2026-10-01' }, {}); }); await settle(300); await pg.evaluate(() => render()); await settle(80);
  const m3 = await pg.evaluate(() => { const b = document.querySelector('#tdemo #hv-mp-auto'); return { rows: b ? [...b.querySelectorAll('[data-hvmp]')].map((x) => x.getAttribute('data-hvmp')) : [], mp: htsSrcValue().mp }; });
  await pg.evaluate(() => { htsClose(); htsOpen({ school: '옥길중', grade: '중2', year: 2026, semester: '2', term: '중간', date: '2026-10-01' }, {}); }); await settle(300); await pg.evaluate(() => render()); await settle(80);
  const m4 = await pg.evaluate(() => ({ band: !!document.querySelector('#tdemo #hv-mp-auto'), syn: [hvSubjOf('공수1 연습'), hvSubjOf('미적1 문제'), hvSubjOf('확통 마무리'), hvSubjOf('공통수학Ⅱ 점검'), hvSubjNorm('확률과 통계'), hvSubjOf('미적분Ⅱ')].join(',') }));
  t('새 요청 고1 공통수학2 → 「공수2 복습」 자동 체크 · 중학교 시험은 띠 없음', m3.rows.join(',') === 'C3' && m3.mp.indexOf('C3') >= 0 && !m4.band, JSON.stringify([m3, m4.band]));
  t('과목 줄임말: 공수1·미적1·확통·공통수학Ⅱ·확률과 통계·미적분Ⅱ', m4.syn === '공통수학1,미적분1,확률과통계,공통수학2,확률과통계,미적분2', m4.syn);
  await pg.evaluate(() => htsClose());

  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' · 실패 ' + fail);
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
