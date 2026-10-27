#!/usr/bin/env node
/* 학부모앱 v1-37 검사 — 📚 숙제 4단계가 처음부터 보이게 (시안 docs/mockup_parent_hw4.html ①②③)
 *   가짜 서버(lumen_store · aha_notes · storage.list) · 외부망 차단 · 가짜 이름(홍길동 AAA111) · 폰 화면
 *   지금 = 2026-10-23(금) 21:00 한국 시각 · 반 T5 = 월수금
 *   숙제 기록(lumen_hw) — 최근 수업일 7번 = 10/9 · 10/12 · 10/14 · 10/16 · 10/19 · 10/21 · 10/23
 *     10/23 {100,100,60} 막힘 2(unk·re) 질문 1 → ✓ ✓ ◐ ◔(질문 1/막힘 2 · 50%) 종합 78
 *     10/12 {100,30,0} 막힘 2 질문 0 → ✓ ◔ ○ 0/2 · 10/14 {60,0,0} → ◐ ○ ○ — · 10/2 옛 기록 'done'
 *     7번 평균: 풀이 94 · 채점 76 · 오답 54 · 질문 4/7(57) → 가장 낮은 단계 = 「3 오답 다시 풀기」
 *     10월(9일) 평균 풀이 96 · 채점 81 · 오답 64 · 질문 4/7  /  9월(3일) 100 · 87 · 50 · 1/1(100)
 *       → 가장 많이 오른 단계 3 오답 +14%p · 가장 많이 내린 단계 4 아하노트 질문 −43%p
 *   ① 숙제 탭 과제 완성도 카드(4칸 항상 펼침 · 눈금 · % · 코멘트 · 눈금 설명 · 집에서 할 것 · FAQ) + 홈 📚 카드 4칸
 *   ② 단계별 체크 표(7 × 4 + 종합) · 가장 낮은 단계 글 · 집에서 할 것 한 줄
 *   ③ 월 기록: 단계별 평균 · 지난달 대비 · 막대 그대로 · 달력 점
 *   ④ v1-36 녹음 화면 그대로 · <audio 0개 · 서버 쓰기 없음 · 페이지 오류 0
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_p137.js parent_v1-37.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'parent_v1-37.html');
const SHOT = process.env.P137_SHOT || '';   // 화면 그림을 남길 폴더(선택)
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.clock.setFixedTime(new Date('2026-10-23T21:00:00+09:00'));
  await pg.addInitScript(() => {
    window.__KEYS = []; window.__LIST = []; window.__W = [];
    const HW = {
      '2026-09-14': { p: 100, c: 100, w: 60 }, '2026-09-16': { p: 100, c: 60, w: 30 }, '2026-09-18': { p: 100, c: 100, w: 60 },
      '2026-10-02': 'done', '2026-10-07': { p: 100, c: 100, w: 100 },
      '2026-10-09': { p: 100, c: 100, w: 60 }, '2026-10-12': { p: 100, c: 30, w: 0 }, '2026-10-14': { p: 60, c: 0, w: 0 },
      '2026-10-16': { p: 100, c: 100, w: 100 }, '2026-10-19': { p: 100, c: 100, w: 60 }, '2026-10-21': { p: 100, c: 100, w: 100 },
      '2026-10-23': { p: 100, c: 100, w: 60 } };
    window.__STORE = {
      or_studentdb: [
        { id: 's1', name: '홍길동', lumen_rec_code: 'AAA111', grade: '중학교 2학년', group: 'T5', lumen_hw: HW }],
      lumen_group_days: { T5: [1, 3, 5] },
      stuck_AAA111: { map: {
        '2026-09-16': [{ k: 'unk' }],
        '2026-10-12': [{ k: 'unk' }, { k: 're' }],
        '2026-10-16': [{ k: 're' }, { k: 'tri' }],          // tri(같은 유형 3회째)는 점수에서 뺀다
        '2026-10-21': [{ k: 'unk' }, { k: 'unk' }],
        '2026-10-23': [{ k: 'unk' }, { k: 're' }, { k: 'tri' }] } },
      rec_topics: { byGrade: { '중2': { '2026.10.23': { t: '일차함수의 기울기 설명해 보기' } } } },
      rec_review_AAA111: { byDate: { '2026-10-23': { ok: true, msg: '설명이 또렷했어요', sec: 200, topic: { t: '일차함수의 기울기 설명해 보기', src: 'grade' } } } } };
    const AHA = ['2026-09-16T08:00:00Z', '2026-10-16T08:00:00Z', '2026-10-21T08:00:00Z', '2026-10-21T09:00:00Z', '2026-10-23T05:00:00Z'];
    const FILES = { AAA111: [{ name: 'AAA111_20261023_2030.webm', created_at: '2026-10-23T11:31:00Z' }, { name: 'AAA111_20261021_2100.webm', created_at: '2026-10-21T12:01:00Z' }] };
    const mk = (tbl) => { const b = { f: [], op: 'select', one: false,
      select() { return b; }, eq(k, v) { if (k === 'key') { window.__KEYS.push(v); b.f.push((x) => x === v); } return b; },
      in(k, a) { if (k === 'key') { a.forEach((x) => window.__KEYS.push(x)); b.f.push((x) => a.indexOf(x) >= 0); } return b; },
      like(k, p) { const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); b.f.push((x) => re.test(x)); return b; },
      ilike() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; }, filter() { return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; },
      update() { b.op = 'u'; window.__W.push(tbl + ':update'); return b; }, delete() { b.op = 'd'; window.__W.push(tbl + ':delete'); return b; }, insert() { window.__W.push(tbl + ':insert'); return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => window.__W.push(tbl + ':' + r.key)); return Promise.resolve({ error: null }); },
      then(r, j) { let data = [];
        if (tbl === 'lumen_store' && b.op === 'select') data = Object.keys(window.__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) }));
        if (tbl === 'aha_notes' && b.op === 'select') data = AHA.map((x) => ({ created_at: x }));
        if (b.one) data = data[0] || null;
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    const fake = { from: mk, rpc: () => Promise.resolve({ data: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: (bucket) => ({
        list: (prefix) => { window.__LIST.push(bucket + ':' + prefix); return Promise.resolve({ data: bucket === 'recordings' ? JSON.parse(JSON.stringify(FILES[String(prefix).replace(/\/$/, '')] || [])) : [], error: null }); },
        upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }), createSignedUrl: () => Promise.resolve({ data: null }) }) } };
    const sbo = { createClient: () => fake };
    Object.defineProperty(window, 'supabase', { configurable: false, get: () => sbo, set: () => {} });
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(600);
  t('버전 v1-37', (await pg.evaluate(() => PAR_VER)) === 'v1-37' && (await pg.title()).indexOf('v1-37') >= 0);
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  t('로그인 · 홍길동 · 숙제 자료 준비', await pg.evaluate(() => !!(P.st && P.st.name === '홍길동' && P.tab === 'home' && P.hwReady && P.ahaCnt['2026-10-21'] === 2)));
  const noAudio = async (where) => t(where + ': <audio 0개', await pg.evaluate(() => document.querySelectorAll('audio,video').length === 0 && document.getElementById('app').innerHTML.indexOf('<audio') < 0));
  const shot = async (n) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, n + '.png'), fullPage: true }); } };
  const cells = (sel) => pg.evaluate((s) => Array.from(document.querySelectorAll(s + ' .c')).map((c) => ({ s: c.dataset.s, n: c.querySelector('.n').textContent, m: c.querySelector('.m').textContent, p: c.querySelector('.p').textContent, q: (c.querySelector('.q') || {}).textContent || '' })), sel);
  const expCells = (c) => c.length === 4
    && c[0].n === '1 풀이' && c[0].m === '✓' && c[0].p === '100%'
    && c[1].n === '2 채점' && c[1].m === '✓' && c[1].p === '100%'
    && c[2].n === '3 오답' && c[2].m === '◐' && c[2].p === '60%'
    && c[3].n === '4 아하노트' && c[3].m === '◔' && c[3].p === '질문 1/막힘 2' && c[3].q === '50%';

  // ① 홈 📚 카드 — 4칸 같은 눈금
  const hc = await cells('.p35card .p37stg.mini');
  t('① 홈 📚 카드 4칸: ✓100 · ✓100 · ◐60 · ◔ 질문 1/막힘 2', expCells(hc), JSON.stringify(hc));
  t('① 홈 📚 카드: 종합 78% · 눈금 설명 · 예전 % 칸 없음', await pg.evaluate(() => { const c = document.querySelector('.p35card'); return c.querySelector('.p35hd .n').textContent === '78%' && !!c.querySelector('.p37tip.mini') && !c.querySelector('.cells'); }));
  await shot('1_home');

  // ① 숙제 탭 과제 완성도 카드
  await pg.evaluate(() => goTab('hw')); await pg.waitForTimeout(150);
  const c1 = await cells('.p37card .p37stg');
  t('① 숙제 탭 카드 4칸 (항상 펼침)', expCells(c1), JSON.stringify(c1));
  const card = await pg.evaluate(() => { const c = document.querySelector('.p37card'); return c ? { open: !!c.querySelector('.hwbd.open'), car: !!c.querySelector('.hwcar'), click: c.querySelector('.hwhd').getAttribute('onclick'), big: c.querySelector('.hw2 b').textContent, date: c.querySelector('.hwdate').textContent, desc: c.querySelector('.p37desc').textContent, co: c.querySelector('.hwco').textContent, tip: c.querySelector('.p37tip').textContent, home: c.querySelector('.hwsub') ? c.querySelector('.hwsub').textContent : '', vis: c.querySelector('.p37stg').getBoundingClientRect().height > 0, faq: !!(c.nextElementSibling && c.nextElementSibling.className === 'hwfaq') } : null; });
  t('① 접기 없음(펼친 채 · 화살표·누르기 없음)', !!card && card.open && !card.car && !card.click && card.vis, JSON.stringify(card));
  t('① 머리: 78% · 10/23 (금) · «풀이·채점은 다 했고, 오답 다시 풀기는 절반 했어요»', !!card && card.big === '78%' && card.date.indexOf('10/23 (금)') >= 0 && card.desc === '풀이·채점은 다 했고, 오답 다시 풀기는 절반 했어요', JSON.stringify(card));
  t('① 선생님 코멘트 줄(hwLine) · 눈금 설명', !!card && card.co.indexOf('오답 정리') >= 0 && card.co.indexOf('60%') >= 0 && card.tip.indexOf('✓ 다 함 · ◐ 절반(60%) · ◔ 조금(30%) · ○ 안 함') === 0, JSON.stringify(card));
  t('① 집에서 할 것 · FAQ 그대로', !!card && card.home.indexOf('🏠 집에서 할 것') >= 0 && card.home.indexOf('오늘 플래너') >= 0 && card.home.indexOf('녹음 숙제') >= 0 && card.faq, JSON.stringify(card));
  t('① 해당 없음 칸 · 모두 마친 날 머리 글', await pg.evaluate(() => { const a = p37Cells('2026-10-14', false), b = p37Desc('2026-10-16'), c = p37Desc('2026-10-09'), d = p37Desc('2026-10-12'), e = p37Desc('2026-10-14');
    return a.indexOf('해당 없음') >= 0 && a.indexOf('>—<') >= 0 && b === '네 단계를 모두 마쳤어요' && c === '풀이·채점은 다 했고, 오답 다시 풀기는 절반 했어요' && d === '풀이는 다 했고, 채점하기는 조금 했어요' && e === '문제 풀기는 절반 했어요'; }));
  await shot('2_hw');

  // ② 단계별 체크 · 최근 수업일 7번
  const g = await pg.evaluate(() => { const s = document.querySelector('.p37sec'); if (!s) return null;
    const rows = Array.from(s.querySelectorAll('.p37g tbody tr')).map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent));
    const cls = Array.from(s.querySelectorAll('.p37g tbody tr')).map((r) => Array.from(r.querySelectorAll('td:not(.l)')).map((td) => td.className.replace('a ', '')));
    return { st: s.querySelector('.st').textContent, head: Array.from(s.querySelectorAll('.p37g thead th')).map((x) => x.textContent), rows, cls,
      msg: s.querySelector('.p37msg').textContent, low: (s.querySelector('.p37low') || {}).textContent || '', home: s.querySelector('.p37home').textContent,
      w: s.querySelector('.p37g').getBoundingClientRect().width, sw: s.getBoundingClientRect().width }; });
  t('② 카드 제목 · 최근 수업일 7번 · 월 기록 ›', !!g && g.st.indexOf('단계별 체크') >= 0 && g.st.indexOf('최근 수업일 7번') >= 0 && g.st.indexOf('월 기록 ›') >= 0, g && g.st);
  t('② 날짜 7개 (10/9 … 10/23)', !!g && JSON.stringify(g.head) === JSON.stringify(['', '10/9', '10/12', '10/14', '10/16', '10/19', '10/21', '10/23']), g && JSON.stringify(g.head));
  const R = g ? g.rows : [];
  t('② 1 풀이 ✓✓◐✓✓✓✓', JSON.stringify(R[0]) === JSON.stringify(['1 풀이', '✓', '✓', '◐', '✓', '✓', '✓', '✓']), JSON.stringify(R[0]));
  t('② 2 채점 ✓◔○✓✓✓✓', JSON.stringify(R[1]) === JSON.stringify(['2 채점', '✓', '◔', '○', '✓', '✓', '✓', '✓']), JSON.stringify(R[1]));
  t('② 3 오답 ◐○○✓◐✓◐', JSON.stringify(R[2]) === JSON.stringify(['3 오답', '◐', '○', '○', '✓', '◐', '✓', '◐']), JSON.stringify(R[2]));
  t('② 4 아하 — 0/2 — 1/1 — 2/2 1/2', JSON.stringify(R[3]) === JSON.stringify(['4 아하', '—', '0/2', '—', '1/1', '—', '2/2', '1/2']), JSON.stringify(R[3]));
  t('② 종합 87 33 20 100 87 100 78', JSON.stringify(R[4]) === JSON.stringify(['종합', '87', '33', '20', '100', '87', '100', '78']), JSON.stringify(R[4]));
  t('② 칸 색: ok·half·no·na', !!g && JSON.stringify(g.cls[1]) === JSON.stringify(['ok', 'half', 'no', 'ok', 'ok', 'ok', 'ok']) && JSON.stringify(g.cls[3]) === JSON.stringify(['na', 'no', 'na', 'ok', 'na', 'ok', 'half']), g && JSON.stringify(g.cls));
  t('② 가장 낮은 단계 글: 이 아이는 「3 오답 다시 풀기」에서 멈춰요 (평균 54%)', !!g && g.low === '「3 오답 다시 풀기」' && g.msg.indexOf('이 아이는 「3 오답 다시 풀기」에서 멈춰요') >= 0 && g.msg.indexOf('최근 7번 평균 54%') >= 0, g && g.msg);
  t('② 집에서 할 것 한 줄(3단계 문구)', !!g && g.home.indexOf('답 보기 전에 한 번 더') >= 0, g && g.home);
  t('② 표가 폰 화면 카드 안에 들어감', !!g && g.w <= g.sw, g && (g.w + ' / ' + g.sw));
  t('② 단계 문구 4개 · 모두 100 이면 칭찬', await pg.evaluate(() => p37Low({ p: 100, c: 100, w: 100, a: null }) === null && p37Low({ p: 60, c: 30, w: 30, a: 100 }) === 'c' && p37Low({ p: 100, c: 100, w: 100, a: 50 }) === 'a' && p37Low({ p: 90, c: 100, w: 100, a: null }) === 'p' && ['p', 'c', 'w', 'a'].every((k) => !!P37_HOME[k])));
  t('② 예전 «최근 7일» 총합 막대 카드는 빠짐 · 미흡했던 날 목록은 그대로 위', await pg.evaluate(() => { const a = document.getElementById('app').textContent; return a.indexOf('루멘수학 · 최근 7일') < 0 && a.indexOf('10월에 미흡했던 날') >= 0 && a.indexOf('10월에 미흡했던 날') < a.indexOf('단계별 체크'); }));

  // ④ v1-36 녹음 화면 그대로 (숙제 탭)
  const rec = await pg.evaluate(() => ({ topic: (document.querySelector('.p36topic') || {}).textContent || '', st: (document.querySelector('.p36st') || {}).textContent || '', say: (document.querySelector('.p36say') || {}).textContent || '', app: document.getElementById('app').textContent }));
  t('④ v1-36 숙제 탭 녹음: 주제 · ✓ 선생님이 들었어요 · 한마디 · 🔒 안내', rec.topic.indexOf('일차함수의 기울기 설명해 보기') >= 0 && rec.st.indexOf('✓ 선생님이 들었어요') >= 0 && rec.say.indexOf('설명이 또렷했어요') >= 0 && rec.app.indexOf('🔒 녹음 소리는 선생님만 듣습니다') >= 0, JSON.stringify(rec).slice(0, 300));
  await noAudio('② 숙제');

  // ③ 월 기록
  await pg.evaluate(() => hwGoStat()); await pg.waitForTimeout(150);
  const ms = await pg.evaluate(() => { const b = document.querySelector('.p37mtop'); if (!b) return null;
    return { mct: b.querySelector('.mct').textContent, avg: Array.from(b.querySelectorAll('.p37avg>div')).map((d) => d.querySelector('.v').textContent + '|' + d.querySelector('.k').textContent), cmp: b.querySelector('.p37cmp').textContent,
      first: b.previousElementSibling && b.previousElementSibling.className, ym: document.querySelector('.mnav .ym').textContent }; });
  t('③ 맨 위 «단계별 평균 · 수업 9일» (mnav 바로 아래)', !!ms && ms.mct === '단계별 평균 · 수업 9일' && ms.first === 'mnav' && ms.ym === '2026년 10월', JSON.stringify(ms));
  t('③ 4칸: 96% 풀이 · 81% 채점 · 64% 오답 · 4/7 질문/막힘', !!ms && JSON.stringify(ms.avg) === JSON.stringify(['96%|1 풀이', '81%|2 채점', '64%|3 오답', '4/7|4 질문/막힘']), ms && JSON.stringify(ms.avg));
  t('③ 지난달 대비: 오른 3 오답 +14%p · 내린 4 아하노트 질문 −43%p', !!ms && ms.cmp.indexOf('9월보다') >= 0 && ms.cmp.indexOf('가장 많이 오른 단계 3 오답 다시 풀기 +14%p') >= 0 && ms.cmp.indexOf('가장 많이 내린 단계 4 아하노트 질문 −43%p') >= 0, ms && ms.cmp);
  t('③ 날짜별 막대 그대로(9개) · 예전 단계별 평균·총평 그대로', await pg.evaluate(() => document.querySelectorAll('.mbars .mb').length === 9 && document.getElementById('app').textContent.indexOf('10월 단계별 평균') >= 0 && !!document.querySelector('.mfoot')));
  const cal = await pg.evaluate(() => { const b = document.querySelector('.p37calbox'); if (!b) return null;
    const on = Array.from(b.querySelectorAll('.p37cal .c.on'));
    const dots = (iso) => { const c = b.querySelector('.c.on[data-iso="' + iso + '"]'); return c ? Array.from(c.querySelectorAll('.dots i')).map((i) => i.dataset.s + ':' + i.className + ':' + (i.style.backgroundColor || '')) : null; };
    return { n: on.length, all: b.querySelectorAll('.p37cal .c:not(.e)').length, blanks: b.querySelectorAll('.p37cal .c.e').length, d23: dots('2026-10-23'), d14: dots('2026-10-14'), d02: dots('2026-10-02'), sel: (b.querySelector('.c.sel') || {}).dataset ? b.querySelector('.c.sel').dataset.iso : '',
      afterBars: (() => { const m = document.querySelector('.mbars'); return !!m && !!(m.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
  t('③ 달력: 31칸 · 10/1 목요일 앞 빈칸 4 · 수업일 9칸에 점 · 막대 아래', !!cal && cal.all === 31 && cal.blanks === 4 && cal.n === 9 && cal.afterBars, JSON.stringify(cal));
  t('③ 10/23 점: 풀이·채점 진한 점 · 오답·아하 연한 점 (단계 색)', !!cal && JSON.stringify(cal.d23) === JSON.stringify(['p:f:rgb(59, 130, 246)', 'c:f:rgb(245, 158, 11)', 'w:pt:rgb(34, 197, 94)', 'a:pt:rgb(168, 85, 247)']), cal && JSON.stringify(cal.d23));
  t('③ 10/14 점: 풀이 연한 · 채점·오답 회색 · 아하 해당 없음 / 10/2 옛 기록 done → 3 진한 점', !!cal && JSON.stringify(cal.d14) === JSON.stringify(['p:pt:rgb(59, 130, 246)', 'c:z:', 'w:z:', 'a:x:']) && JSON.stringify(cal.d02) === JSON.stringify(['p:f:rgb(59, 130, 246)', 'c:f:rgb(245, 158, 11)', 'w:f:rgb(34, 197, 94)', 'a:x:']), cal && JSON.stringify([cal.d14, cal.d02]));
  t('③ 달력 선택 = 막대 선택(마지막 날)', !!cal && cal.sel === '2026-10-23', cal && cal.sel);
  await shot('3_stat');
  await pg.click('.p37cal .c.on[data-iso="2026-10-12"]'); await pg.waitForTimeout(100);
  t('③ 달력 칸을 누르면 그 날 기록', await pg.evaluate(() => P.hwSel === '2026-10-12' && document.querySelector('.mb.sel .dl').textContent === '12' && document.querySelector('.mday').textContent.indexOf('10/12') >= 0 && document.querySelector('.p37cal .c.sel').dataset.iso === '2026-10-12'));
  await pg.evaluate(() => hwShiftMon(-1)); await pg.waitForTimeout(100);
  t('③ 9월: 수업 3일 · 8월 기록 없음 안내', await pg.evaluate(() => { const b = document.querySelector('.p37mtop'); return !!b && b.querySelector('.mct').textContent === '단계별 평균 · 수업 3일' && b.querySelector('.p37cmp').textContent.indexOf('8월 기록이 없어') >= 0 && document.querySelectorAll('.p37cal .c.on').length === 3; }));
  await pg.evaluate(() => hwShiftMon(-1)); await pg.waitForTimeout(100);
  t('③ 기록 없는 달: 오류 없이 빈 안내', await pg.evaluate(() => !document.querySelector('.p37mtop') && document.getElementById('app').textContent.indexOf('이 달에는 숙제 기록이 없어요') >= 0));
  await noAudio('③ 월 기록');

  // ④ 녹음 제출 기록 그대로 · 안전
  await pg.evaluate(() => { P.hwView = 'home'; goTab('rec'); }); await pg.waitForTimeout(150);
  t('④ v1-36 녹음 제출 기록 그대로(🔒 안내 · 통계 3칸 · 목록)', await pg.evaluate(() => !!document.querySelector('.p36lock') && document.querySelectorAll('.p36stats>div').length === 3 && document.querySelectorAll('.p36item').length === 2));
  await noAudio('④ 녹음 기록');
  t('④ 숙제 기록이 없어도 오류 없이 그림', await pg.evaluate(() => { const h = P.st.lumen_hw; P.st.lumen_hw = {}; goTab('home'); const a = document.querySelector('.p35card').textContent.indexOf('아직 기록이 없어요') >= 0; goTab('hw'); const b = !document.querySelector('.p37card') && !document.querySelector('.p37sec'); P.st.lumen_hw = h; goTab('home'); return a && b; }));
  t('④ 서버에 쓰지 않음(열람 기록 외)', (await pg.evaluate(() => __W)).every((k) => String(k).indexOf('lumen_hw') < 0 && String(k).indexOf('stuck') < 0 && String(k).indexOf('aha_notes') < 0), JSON.stringify(await pg.evaluate(() => __W)));
  t('④ 녹음 목록은 내 아이 폴더만', JSON.stringify(await pg.evaluate(() => __LIST)) === JSON.stringify(['recordings:AAA111']), JSON.stringify(await pg.evaluate(() => __LIST)));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
