#!/usr/bin/env node
/* 학원앱 v19-152 검사 — 🎙 녹음관리 › 👀 훑어보기 (원장 2026-10-23 「안 A로 진행」 · docs/rec_review_contract.md §3)
 *   가짜 서버(lumen_store · Storage recordings) · 외부망 차단 · 가짜 학생 6명(홍길동·박하나·이순신·김유신·장보고·신사임당)
 *   ① 메뉴 «👀 훑어보기» 맨 위 · 녹음관리 들어가면 훑어보기부터 · 시작 다운로드 제외(rec_read_ · rec_review_)
 *   ② 화면 그려짐 · 기본 날짜 = 결과가 있는 가장 최근 날짜 · 머리줄(rec_read_last) · 요약 5칸 숫자
 *   ③ 학년 섹션 초→중→고 · 그날 학년 주제(7일 안 가장 가까운 지난 날짜) · 없음(배정 안 됨) · 🧭 공통 · 미제출(수업일) · «n명 제출 / m명 수업»
 *   ④ 카드: 이름 · m분 s초 · 배지 · 개인 주제 · 빠진 것 · ▶ 듣기(카드 안 audio) · 📄 전문
 *   ⑤ 칩 거르기(전체 / 주제 다름만 / 아직 안 본 것)
 *   ⑥ ✓ 확인 → rec_review_<코드> 에 sec·topic 과 함께 저장 · 다른 기기 날짜 보존 · 💬 한마디 칩 = msg + ok · ✏️ 직접 쓰기 · 확인 취소 = 그 날짜 칸 삭제
 *   ⑦ 날짜 ◀ ▶ · 결과 없는 날 · 읽기 실패 카드
 *   ⑧ 그리드 ✅(새벽 읽기만 있어도) · 팝업 «🌙 새벽 읽기» 전문
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19152.js lumen_v19-152.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-152.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const DB = [
  { id: 's1', name: '홍길동', grade: '중학교 2학년', group: '중2A', lumen_rec_code: 'AAA111' },
  { id: 's2', name: '박하나', grade: '중학교 2학년', group: '중2A', lumen_rec_code: 'BBB222' },
  { id: 's3', name: '이순신', grade: '중2', group: '중2A', lumen_rec_code: 'CCC333' },
  { id: 's4', name: '김유신', grade: '중학교 2학년', group: '중2B', lumen_rec_code: 'DDD444' },
  { id: 's5', name: '장보고', grade: '중학교 3학년', group: '중3', lumen_rec_code: 'EEE555' },
  { id: 's6', name: '신사임당', grade: '고등학교 1학년', group: '고1', lumen_rec_code: 'FFF666' }
];
const T2 = '일차함수의 기울기와 y절편 설명해 보기';
const it = (code, o) => Object.assign({ file: code + '_20261021_2130.webm', code, grade: '중2', sec: 200, topic: { t: T2, src: 'grade' }, title: '오늘 배운 것', stt: '', sttSrc: 'gemini', summary: '', match: 'ok', why: '', missing: '', err: '', at: '2026-10-21T20:12:00Z' }, o);
const STORE = {
  or_studentdb: DB,
  lumen_group_days: { '중2A': [1, 3, 5], '중2B': [2, 4], '중3': [3], '고1': [1, 3, 5] },
  rec_topics: { byGrade: { '중2': { '2026.10.21': { t: T2 } }, '중3': { '2026.10.19': { t: '근의 공식 유도 설명하기' } } }, byStudent: { DDD444: { '2026.10.21': { t: '틀린 일차함수 식 세우기 다시 설명' } } } },
  rec_read_last: { at: '2026-10-21T20:14:00Z', dates: ['2026-10-21'], made: 5, fail: 0, model: 'gemini-2.5-flash-lite' },
  'rec_read_2026-10-21': { date: '2026-10-21', updated: '2026-10-21T20:14:00Z', model: 'gemini-2.5-flash-lite',
    items: {
      AAA111: [it('AAA111', { sec: 222, stt: '기울기는 x가 1 커질 때 y가 얼마나 변하는지예요. y=2x+3 이면 기울기 2, y절편 3이에요.', summary: '기울기를 예로 설명하고 y절편까지 맞게 말함.', why: '개념 오류 없음 · 예시 1개' })],
      BBB222: [it('BBB222', { file: 'BBB222_20261021_2200.webm', sec: 125, stt: '기울기는 기울어진 정도예요.', summary: '기울기만 설명하고 y절편은 말하지 않음.', match: 'part', why: '주제 일부', missing: 'y절편' })],
      CCC333: [it('CCC333', { sec: 250, stt: '연립방정식 가감법은…', summary: '연립방정식 가감법을 설명함.', match: 'off', why: '주제와 다름 · 설명 자체는 정확' })],
      DDD444: [it('DDD444', { sec: 200, topic: { t: '틀린 일차함수 식 세우기 다시 설명', src: 'student' }, stt: '이 문제는…', summary: '막힌 지점을 스스로 말함.', why: '개념 오류 없음', err: '' })],
      EEE555: [it('EEE555', { grade: '중3', sec: 18, topic: { t: '근의 공식 유도 설명하기', src: 'grade' }, stt: '[녹음 내용 없음]', summary: '말이 거의 없음.', match: 'short', why: '' })]
    },
    byGrade: { '중2': { n: 4, brief: 'y절편을 x절편과 섞어 말한 학생이 있어요' } },
    fail: {} },
  'rec_read_2026-10-19': { date: '2026-10-19', items: {}, byGrade: {}, fail: { EEE555: ['EEE555_20261019_2200.webm'] } },
  'rec_read_2026-09-30': { date: '2026-09-30', items: { AAA111: [it('AAA111', { file: 'AAA111_20260930_2100.webm' })] }, byGrade: {}, fail: {} },
  rec_review_AAA111: { byDate: { '2026-10-20': { file: 'AAA111_20261020_2100.webm', ok: true, at: '2026-10-21T00:10:00Z', msg: '다른 기기에서', sec: 100, topic: { t: 'x', src: 'grade' } } }, updated: '2026-10-21T00:10:00Z' }
};
const FILES = {
  AAA111: [{ name: 'AAA111_20261021_2130.webm', metadata: { size: 120000 } }],
  BBB222: [{ name: 'BBB222_20261022_2130.webm', metadata: { size: 90000 } }, { name: 'BBB222_20261021_2200.webm', metadata: { size: 80000 } }]
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.addInitScript(({ STORE, FILES }) => {
    window.__W = []; window.__STORE = STORE; window.__FILES = FILES;
    const likeRe = (p) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$');
    const mk = (tbl) => { const b = { f: [], op: 'select', select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; }, like(k, p) { const re = likeRe(p); b.f.push((x) => re.test(x)); return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; }, filter() { return b; }, single() { return b; }, maybeSingle() { return b; },
      update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; }, insert() { return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { const v = JSON.parse(JSON.stringify(r.value)); window.__W.push({ key: r.key, value: v }); if (tbl === 'lumen_store') window.__STORE[r.key] = v; }); return Promise.resolve({ error: null }); },
      then(r, j) { const data = tbl === 'lumen_store' && b.op === 'select' ? Object.keys(window.__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })) : []; return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    window.__FAKE = () => ({ from: mk, rpc: () => Promise.resolve({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({}), list: (pre) => Promise.resolve({ data: JSON.parse(JSON.stringify(window.__FILES[pre] || [])), error: null }), remove: () => Promise.resolve({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/recordings/' + p } }) }) } });
  }, { STORE, FILES });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((DB) => { window.getSupaClient = window.__FAKE; students = JSON.parse(JSON.stringify(DB)); window.alert = () => {}; }, DB);

  /* ① */
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-152');
  t('① 부품에 템플릿 리터럴 없음', fs.readFileSync(path.join(__dirname, '..', 'modules', 'recreview152_teacher.js'), 'utf8').indexOf('`') < 0);
  const nav = await pg.evaluate(() => rRecMgrLeftNav());
  t('① 왼쪽 메뉴 «👀 훑어보기»가 그리드 앞', nav.indexOf('data-rv="review"') >= 0 && nav.indexOf('data-rv="review"') < nav.indexOf('data-rv="grid"') && nav.indexOf('훑어보기') >= 0);
  const v0 = await pg.evaluate(() => { const g = GROUPS.find((x) => x.key === 'daily'); const s = g.subs.find((x) => x.v === 'recmgr'); s.act(); return [VIEW, REC_MGR_VIEW]; });
  t('① 녹음관리 들어가면 훑어보기부터', v0[0] === 'recmgr' && v0[1] === 'review', JSON.stringify(v0));
  t('① 시작 다운로드 제외 rec_read_ · rec_review_', await pg.evaluate(() => PULL_SKIP_PREFIX.indexOf('rec_read_') >= 0 && PULL_SKIP_PREFIX.indexOf('rec_review_') >= 0));

  /* ② */
  await pg.evaluate(() => render()); await pg.waitForTimeout(800);
  const S = await pg.evaluate(() => {
    const r = document.getElementById('rr152-root'); if (!r) return null;
    const n = {}; r.querySelectorAll('#rr152-sum .rr-n').forEach((e) => { n[e.getAttribute('data-k')] = +e.textContent; });
    return { date: document.getElementById('rr152-date').textContent, night: document.getElementById('rr152-night').textContent, n, css: !!document.getElementById('rr152-css') };
  });
  t('② 화면 그려짐(#rr152-root · 스타일)', !!S && S.css, JSON.stringify(S));
  t('② 기본 날짜 = 결과가 있는 가장 최근 날짜 10/21 (수)', S && S.date === '10/21 (수)', S && S.date);
  t('② 머리줄 «🌙 새벽 읽기 10/22 05:14 · 5건 · 실패 0»', S && S.night === '🌙 새벽 읽기 10/22 05:14 · 5건 · 실패 0', S && S.night);
  t('② 요약 5칸: 제출 5 · ✅ 2 · ⚠️ 1 · ❌🔇 2 · 미제출 1', S && S.n.n === 5 && S.n.ok === 2 && S.n.part === 1 && S.n.bad === 2 && S.n.miss === 1, JSON.stringify(S && S.n));

  if (process.env.SHOT) { await pg.evaluate(() => { const o = document.getElementById('login-overlay'); if (o) o.style.display = 'none'; }); await pg.screenshot({ path: process.env.SHOT }); }   /* 눈으로 볼 때: SHOT=<파일.png> */
  /* ③ */
  const G = await pg.evaluate(() => [...document.querySelectorAll('#rr152-root .rr-grade')].map((g) => ({
    gk: g.getAttribute('data-gk'), topic: (g.querySelector('.rr-topic') || {}).textContent, cnt: (g.querySelector('.rr-cnt') || {}).textContent,
    brief: (g.querySelector('.rr-brief') || {}).textContent || '', miss: (g.querySelector('.rr-missing') || {}).textContent || '',
    names: [...g.querySelectorAll('.rr-card .rr-nm')].map((e) => e.textContent) })));
  t('③ 학년 순서 중2 → 중3 → 고1', G.map((g) => g.gk).join(',') === '중2,중3,고1', G.map((g) => g.gk).join(','));
  const g2 = G[0] || {}, g3 = G[1] || {}, g1 = G[2] || {};
  t('③ 중2 주제 · 4명 제출 / 4명 수업 · 🧭 공통', g2.topic === '오늘 주제: ' + T2 && g2.cnt === '4명 제출 / 4명 수업' && /🧭 이 학년 공통: y절편을 x절편과/.test(g2.brief), JSON.stringify(g2));
  t('③ 중3 주제 = 7일 안 가장 가까운 지난 날짜(10/19) · 1명 / 1명', g3.topic === '오늘 주제: 근의 공식 유도 설명하기' && g3.cnt === '1명 제출 / 1명 수업', JSON.stringify(g3));
  t('③ 고1 주제 없음(배정 안 됨) · 미제출 신사임당 · 0명 / 1명', g1.topic === '오늘 주제: 없음(배정 안 됨)' && /미제출 1명: 신사임당/.test(g1.miss) && g1.cnt === '0명 제출 / 1명 수업' && g1.names.length === 0, JSON.stringify(g1));
  const ord2 = await pg.evaluate(() => getSortedStudents().filter((s) => ['AAA111', 'BBB222', 'CCC333', 'DDD444'].indexOf(s.lumen_rec_code) >= 0).map((s) => s.name).join(','));
  t('③ 중2 카드 순서 = 등록부 순(getSortedStudents, 그리드와 같음) · 미제출 없음(김유신은 수업일 아님)', g2.names.length === 4 && g2.names.join(',') === ord2 && !g2.miss, JSON.stringify(g2) + ' 기대 ' + ord2);

  /* ④ */
  const C = await pg.evaluate(() => { const o = {}; document.querySelectorAll('#rr152-root .rr-card').forEach((c) => { o[c.getAttribute('data-code')] = { cls: c.className, len: c.querySelector('.rr-len').textContent, badge: c.querySelector('.rr-badge').textContent, text: c.textContent }; }); return o; });
  t('④ 홍길동 3분 42초 · ✅ 주제대로', C.AAA111 && C.AAA111.len === '3분 42초' && C.AAA111.badge === '✅ 주제대로', JSON.stringify(C.AAA111));
  t('④ 박하나 ⚠️ 일부만 · 빠진 것 y절편 · 노란 테두리', C.BBB222 && C.BBB222.badge === '⚠️ 일부만' && /빠진 것: y절편/.test(C.BBB222.text) && /rr-warn/.test(C.BBB222.cls), JSON.stringify(C.BBB222));
  t('④ 이순신 ❌ 다른 내용 · 장보고 🔇 너무 짧음 0분 18초', C.CCC333 && C.CCC333.badge === '❌ 다른 내용' && /rr-bad/.test(C.CCC333.cls) && C.EEE555 && C.EEE555.badge === '🔇 너무 짧음' && C.EEE555.len === '0분 18초');
  t('④ 김유신 «🎯 개인 주제»', C.DDD444 && /🎯 개인 주제: 틀린 일차함수 식 세우기 다시 설명/.test(C.DDD444.text), C.DDD444 && C.DDD444.text);
  await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="AAA111"]'); [...c.querySelectorAll('button')].find((b) => b.textContent === '▶ 듣기').click(); });
  const au = await pg.evaluate(() => { const a = document.querySelector('#rr152-root .rr-card[data-code="AAA111"] audio'); return a ? { src: a.getAttribute('src'), controls: a.controls } : null; });
  t('④ ▶ 듣기 → 카드 안 <audio controls> (getRecordingUrl)', au && au.controls && au.src === 'https://fake.local/recordings/AAA111/AAA111_20261021_2130.webm', JSON.stringify(au));
  const full = await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="AAA111"]'); const f = c.querySelector('.rr-full'); const before = f.style.display; [...c.querySelectorAll('button')].find((b) => b.textContent === '📄 전문').click(); return { before, after: f.style.display, text: f.textContent }; });
  t('④ 📄 전문 펼치기(제목 + 전문)', full.before === 'none' && full.after === '' && /y=2x\+3/.test(full.text) && /제출 제목/.test(full.text), JSON.stringify(full));

  /* ⑤ */
  const filt = async (f) => { await pg.evaluate((f) => document.querySelector('#rr152-root .rr152-f[data-f="' + f + '"]').click(), f); return pg.evaluate(() => ({ names: [...document.querySelectorAll('#rr152-root .rr-card .rr-nm')].map((e) => e.textContent), grades: [...document.querySelectorAll('#rr152-root .rr-grade')].map((g) => g.getAttribute('data-gk')), miss: document.querySelectorAll('#rr152-root .rr-missing').length, on: document.querySelector('#rr152-root .rr152-f.rr-on').getAttribute('data-f') })); };
  const fd = await filt('diff');
  t('⑤ 주제 다름만 → 박하나·이순신·장보고 (고1 섹션·미제출 숨김)', fd.on === 'diff' && fd.names.join(',') === '박하나,이순신,장보고' && fd.grades.join(',') === '중2,중3' && fd.miss === 0, JSON.stringify(fd));
  const fu = await filt('unseen');
  t('⑤ 아직 안 본 것 → 5장', fu.names.length === 5, JSON.stringify(fu));

  /* ⑥ */
  await pg.evaluate(() => { window.__W.length = 0; document.querySelector('#rr152-root .rr-card[data-code="AAA111"] .rr-btn.rr-p').click(); });
  await pg.waitForTimeout(400);
  const w1 = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rec_review_AAA111'));
  const e1 = w1.length ? (w1[w1.length - 1].value.byDate || {})['2026-10-21'] : null;
  t('⑥ ✓ 확인 → rec_review_AAA111 저장(file·ok·sec·topic·msg 빈 글)', w1.length === 1 && e1 && e1.ok === true && e1.file === 'AAA111_20261021_2130.webm' && e1.sec === 222 && e1.topic && e1.topic.t === T2 && e1.topic.src === 'grade' && e1.msg === '' && !!e1.at, JSON.stringify(w1));
  t('⑥ 다른 기기 날짜(10/20) 보존 · updated', w1.length && w1[0].value.byDate['2026-10-20'] && w1[0].value.byDate['2026-10-20'].msg === '다른 기기에서' && !!w1[0].value.updated);
  const fu2 = await pg.evaluate(() => [...document.querySelectorAll('#rr152-root .rr-card .rr-nm')].map((e) => e.textContent));
  t('⑥ «아직 안 본 것»에서 빠짐(4장)', fu2.length === 4 && fu2.indexOf('홍길동') < 0, JSON.stringify(fu2));
  await filt('all');
  const d1 = await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="AAA111"]'); return { cls: c.className, done: (c.querySelector('.rr-donel') || {}).textContent || '', p: !!c.querySelector('.rr-btn.rr-p') }; });
  t('⑥ 확인된 카드 흐리게 · «✓ 확인 HH:MM» · 확인 취소 · ✓ 단추 없음', /rr-done/.test(d1.cls) && /^✓ 확인 \d\d:\d\d/.test(d1.done) && /확인 취소/.test(d1.done) && !d1.p, JSON.stringify(d1));
  /* 💬 한마디 칩 (part → missing 넣은 칩 먼저) */
  const ch = await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="BBB222"]'); [...c.querySelectorAll('.rr-acts button')].find((b) => b.textContent === '💬 한마디').click(); const m = c.querySelector('.rr-msgs'); return { vis: m.style.display, chips: [...m.querySelectorAll('.rr-chip')].map((b) => b.textContent) }; });
  t('⑥ 한마디 칩: 일부만 → «다음엔 y절편도 같이» 먼저 · ✏️ 직접 쓰기 끝', ch.vis === '' && ch.chips[0] === '다음엔 y절편도 같이' && ch.chips[1] === '핵심은 잘 짚었어요, 다음엔 y절편까지' && ch.chips[ch.chips.length - 1] === '✏️ 직접 쓰기', JSON.stringify(ch));
  await pg.evaluate(() => { window.__W.length = 0; [...document.querySelectorAll('#rr152-root .rr-card[data-code="BBB222"] .rr-msgs .rr-chip')][0].click(); });
  await pg.waitForTimeout(400);
  const w2 = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rec_review_BBB222'));
  const e2 = w2.length ? w2[0].value.byDate['2026-10-21'] : null;
  t('⑥ 칩 한 번에 msg + ok:true 저장 (sec 125 · topic)', e2 && e2.ok === true && e2.msg === '다음엔 y절편도 같이' && e2.sec === 125 && e2.file === 'BBB222_20261021_2200.webm' && e2.topic.t === T2, JSON.stringify(w2));
  const d2 = await pg.evaluate(() => (document.querySelector('#rr152-root .rr-card[data-code="BBB222"] .rr-donel') || {}).textContent || '');
  t('⑥ 카드에 «💬 msg» 표시', /💬 다음엔 y절편도 같이/.test(d2), d2);
  const oc = await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="CCC333"]'); [...c.querySelectorAll('.rr-acts button')].find((b) => b.textContent === '💬 한마디').click(); return [...c.querySelectorAll('.rr-msgs .rr-chip')].map((b) => b.textContent); });
  t('⑥ 다른 내용 → «오늘 주제로 다시 한 번!» 먼저', oc[0] === '오늘 주제로 다시 한 번!', JSON.stringify(oc));
  await pg.evaluate(() => { window.__W.length = 0; window.prompt = () => '  가감법 설명은 정확해요  '; [...document.querySelectorAll('#rr152-root .rr-card[data-code="CCC333"] .rr-msgs .rr-chip')].pop().click(); });
  await pg.waitForTimeout(400);
  const w3 = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rec_review_CCC333'));
  t('⑥ ✏️ 직접 쓰기 → 그 글로 저장(앞뒤 빈칸 정리)', w3.length === 1 && w3[0].value.byDate['2026-10-21'].msg === '가감법 설명은 정확해요' && w3[0].value.byDate['2026-10-21'].ok === true, JSON.stringify(w3));
  await pg.evaluate(() => { window.__W.length = 0; [...document.querySelectorAll('#rr152-root .rr-card[data-code="AAA111"] .rr-donel button')].find((b) => b.textContent === '확인 취소').click(); });
  await pg.waitForTimeout(400);
  const w4 = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rec_review_AAA111'));
  t('⑥ 확인 취소 → 그 날짜 칸 삭제 · 10/20 보존', w4.length === 1 && !w4[0].value.byDate['2026-10-21'] && !!w4[0].value.byDate['2026-10-20'], JSON.stringify(w4));
  const d4 = await pg.evaluate(() => { const c = document.querySelector('#rr152-root .rr-card[data-code="AAA111"]'); return { cls: c.className, p: !!c.querySelector('.rr-btn.rr-p') }; });
  t('⑥ 취소 뒤 카드 원래대로(✓ 확인 단추)', !/rr-done/.test(d4.cls) && d4.p, JSON.stringify(d4));
  /* 다른 기기가 그사이 같은 학생 다른 날짜를 확인 → 합치기 */
  await pg.evaluate(() => { window.__STORE.rec_review_DDD444 = { byDate: { '2026-10-17': { file: 'DDD444_20261017_2000.webm', ok: true, at: '2026-10-18T00:00:00Z', msg: '', sec: 90, topic: { t: 'y', src: 'grade' } } } }; window.__W.length = 0; document.querySelector('#rr152-root .rr-card[data-code="DDD444"] .rr-btn.rr-p').click(); });
  await pg.waitForTimeout(400);
  const w5 = await pg.evaluate(() => window.__W.filter((x) => x.key === 'rec_review_DDD444'));
  t('⑥ 쓰기 전 최신본 읽어 합침(화면 연 뒤 생긴 10/17 보존) · 개인 주제 src student', w5.length === 1 && !!w5[0].value.byDate['2026-10-17'] && w5[0].value.byDate['2026-10-21'].topic.src === 'student', JSON.stringify(w5));

  /* ⑦ */
  await pg.evaluate(() => document.getElementById('rr152-prev').click()); await pg.waitForTimeout(200);
  const p1 = await pg.evaluate(() => ({ d: document.getElementById('rr152-date').textContent, txt: document.getElementById('rr152-root').textContent }));
  t('⑦ ◀ 10/20 (화) · 결과 없음 안내', p1.d === '10/20 (화)' && /아직 새벽 읽기 결과가 없어요/.test(p1.txt), JSON.stringify(p1.d));
  await pg.evaluate(() => document.getElementById('rr152-prev').click()); await pg.waitForTimeout(200);
  const p2 = await pg.evaluate(() => ({ d: document.getElementById('rr152-date').textContent, cards: [...document.querySelectorAll('#rr152-root .rr-card')].map((c) => c.querySelector('.rr-nm').textContent + '|' + c.querySelector('.rr-badge').textContent) }));
  t('⑦ 10/19 읽기 실패 카드(장보고 · ⚠ 읽기 실패)', p2.d === '10/19 (월)' && p2.cards.join(',') === '장보고|⚠ 읽기 실패', JSON.stringify(p2));
  await pg.evaluate(() => { document.getElementById('rr152-next').click(); document.getElementById('rr152-next').click(); }); await pg.waitForTimeout(200);
  t('⑦ ▶▶ 다시 10/21', (await pg.evaluate(() => document.getElementById('rr152-date').textContent)) === '10/21 (수)');
  await pg.evaluate(() => { window.__STORE.rec_read_last = Object.assign({}, window.__STORE.rec_read_last, { made: 6, fail: 1 }); [...document.querySelectorAll('#rr152-root .rr-night button')][0].click(); });
  await pg.waitForTimeout(600);
  const rf = await pg.evaluate(() => ({ night: document.getElementById('rr152-night').textContent, d: document.getElementById('rr152-date').textContent, n: document.querySelectorAll('#rr152-root .rr-card').length }));
  t('⑦ ⟳ 새로고침 → 머리줄 다시 읽음 · 고른 날짜 유지', /6건 · 실패 1$/.test(rf.night) && rf.d === '10/21 (수)' && rf.n === 5, JSON.stringify(rf));

  /* ⑧ 그리드 · 팝업 */
  await pg.evaluate(() => { REC_MGR_MONTH = '2026.10'; REC_MGR_VIEW = 'grid'; RR152.read = {}; RR152.month = {}; RR152.monthP = {}; render(); });
  await pg.waitForTimeout(1800);
  const gr = await pg.evaluate(() => { const cell = (code, d) => { const r = document.getElementById('rec-row-' + code); return r ? r.querySelectorAll('td')[d].textContent : null; }; return { a21: cell('AAA111', 21), b21: cell('BBB222', 21), b22: cell('BBB222', 22) }; });
  t('⑧ 그리드 ✅ = 새벽 읽기 있는 날(손 받아쓰기 없이)', gr.a21 === '✅' && gr.b21 === '✅', JSON.stringify(gr));
  t('⑧ 새벽 읽기 없는 날은 🎙️ 그대로', gr.b22 === '🎙️', JSON.stringify(gr));
  await pg.evaluate(() => openRecPopup('AAA111', 's1', '홍길동', null, '2026.10.21')); await pg.waitForTimeout(400);
  const pp = await pg.evaluate(() => { const p = document.getElementById('rec-popup-box'); return p ? p.textContent : ''; });
  t('⑧ 팝업 «🌙 새벽 읽기» · 판정 · 전문', /🌙 새벽 읽기/.test(pp) && /✅ 주제대로/.test(pp) && /y=2x\+3 이면 기울기 2/.test(pp) && !/🔤 STT/.test(pp), pp.slice(0, 300));
  await pg.evaluate(() => { closeRecPopup(); students[0].lumen_recordings = { 'AAA111_20261021_2130.webm': { stt: '손으로 받아쓴 글', sttAt: '2026-10-22T01:00:00Z' } }; });
  await pg.evaluate(() => openRecPopup('AAA111', 's1', '홍길동', null, '2026.10.21')); await pg.waitForTimeout(400);
  const pp2 = await pg.evaluate(() => { const p = document.getElementById('rec-popup-box'); return p ? p.textContent : ''; });
  t('⑧ 손 받아쓰기 있으면 «🔤 STT» 예전 그대로 + 🌙 판정(전문은 한 번만)', /🔤 STT손으로 받아쓴 글/.test(pp2) && /🌙 새벽 읽기/.test(pp2) && !/y=2x\+3 이면 기울기 2/.test(pp2), pp2.slice(0, 300));
  await pg.evaluate(() => closeRecPopup());

  const wk = await pg.evaluate(() => window.__W.map((x) => x.key));
  t('등록부(or_studentdb)에 쓰지 않음', wk.indexOf('or_studentdb') < 0, JSON.stringify(wk));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
