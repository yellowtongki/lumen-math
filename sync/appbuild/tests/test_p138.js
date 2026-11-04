#!/usr/bin/env node
/* 학부모앱 v1-38 검사 — 숙제 체크 보이기 A안(선생님 확인만) + 📄 학습지 줄 + 📗 이번 숙제 줄
 *   (설계서 docs/hw_dispatch_contract.md §9-4 · 시안 docs/mockup_parent_hwcheck.html A안 ①②③)
 *   가짜 서버(lumen_store · aha_notes · storage.list) · 외부망 차단 · 가짜 이름(홍길동 AAA111) · 폰 화면
 *   지금 = 2026-11-03(화) 20:00 한국 시각 · 반 T5 = 월수금 → 다음 수업일 11/4(수)
 *   숙제 기록(lumen_hw) 10/19 · 10/21 · 10/23 · 10/26 · 10/28 · 10/30 · 11/2 — 11/4 는 아직 없음(확인 전)
 *   학습지(mf_wsq_AAA111): 901 숙제 11/2 배정 12문항 9맞음 · 902 숙제 11/3 배정 10문항 채점 전 · 903 주간테스트(안 보임)
 *                         904 숙제 10/28 8/8 → 10/30 열 ✓ · 905 숙제 10/19 2/5 → 10/21 열 · 906 숙제 10/31 채점 전 → 11/2 열 ○
 *                         문항에 가짜 그림 주소(secret_problem.png)가 들어 있다 — 어디에도 보이면 안 된다
 *   숙제 카드(todo_AAA111): 교재 11/4 마감(57~66쪽 38문항) · 프린트 11/4 · 학습지 카드 a:ws:1902(겹치니 안 그림) · hw:false 카드 · 11/2 마감 교재
 *   ① 확인 전 상자(다음 수업일 · 오늘 수업일 · 요일표 없음) ② 확인 뒤 카드 그대로 + 줄 ③ 📄 줄(HOMEWORK 만 · 7일 · 맞은 수/마감 · 그림 없음)
 *   ④ 7일 표 📄 줄 ⑤ 📗 줄 있을 때/없을 때 ⑥ hw_self 질의 없음 · 쓰기 없음 · parent.html 안 바뀜 ⑦ v1-37 회귀 · 페이지 오류 0
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_p138.js parent_v1-38.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'parent_v1-38.html'));
const SHOT = process.env.P138_SHOT || '';   // 화면 그림을 남길 폴더(선택)
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.clock.setFixedTime(new Date('2026-11-03T20:00:00+09:00'));
  await pg.addInitScript(() => {
    window.__KEYS = []; window.__LIST = []; window.__W = [];
    const HW = {
      '2026-10-19': { p: 100, c: 100, w: 100 }, '2026-10-21': { p: 100, c: 100, w: 60 }, '2026-10-23': { p: 100, c: 30, w: 0 },
      '2026-10-26': { p: 60, c: 0, w: 0 }, '2026-10-28': { p: 100, c: 100, w: 100 }, '2026-10-30': { p: 100, c: 100, w: 60 },
      '2026-11-02': { p: 100, c: 100, w: 60 } };
    const SECRET = 'https://cdn.example/secret_problem.png';
    const ws = (swId, title, date, tag, n, o, x, q, status) => ({ swId, wid: swId + 1000, title, date, tag, n, o, x, q, status, auto: false, score: n ? Math.round(o / n * 100) : null,
      problems: [{ wpId: 1, num: '1', type: 'SHORT_ANSWER', answer: '3', img: SECRET, pimg: SECRET, solimg: SECRET, result: o ? 'O' : '-' }] });
    window.__STORE = {
      or_studentdb: [
        { id: 's1', name: '홍길동', lumen_rec_code: 'AAA111', grade: '중학교 1학년', group: 'T5', lumen_hw: HW }],
      lumen_group_days: { T5: [1, 3, 5] },
      stuck_AAA111: { map: { '2026-10-21': [{ k: 'unk' }, { k: 're' }], '2026-10-23': [{ k: 'unk' }] } },
      rec_topics: { byGrade: { '중1': { '2026.11.03': { t: '소인수분해 설명해 보기' } } } },
      rec_review_AAA111: { byDate: { '2026-11-03': { ok: true, msg: '설명이 또렷했어요', sec: 180, topic: { t: '소인수분해 설명해 보기', src: 'grade' } } } },
      mf_wsq_AAA111: { code: 'AAA111', name: '홍길동', updated: '2026-11-03T07:00:00Z', list: [
        ws(902, '일차함수 연습', '2026-11-03', 'HOMEWORK', 10, 0, 0, 0, '학습가능'),
        ws(903, '주간테스트 11월 1주', '2026-11-03', 'WEEKLY_TEST', 20, 15, 5, 0, '학습완료'),
        ws(901, '오답 쌍둥이 프린트 (10/30)', '2026-11-02', 'HOMEWORK', 12, 9, 3, 0, '학습완료'),
        ws(906, '도형의 성질 숙제', '2026-10-31', 'homework', 6, 0, 0, 0, '풀이 중'),
        ws(904, '도형 숙제 (10/28)', '2026-10-28', 'HOMEWORK', 8, 8, 0, 0, '학습완료'),
        ws(905, '옛 숙제', '2026-10-19', 'HOMEWORK', 5, 2, 3, 0, '학습완료') ] },
      todo_AAA111: { items: [
        { id: 'hw:2026-11-04:b1', kind: 'book', hw: true, due: '2026-11-04', title: '개념+유형 중1(상) 57~66쪽', book: '개념+유형 중1(상)', bookId: 11, from: 57, to: 66, n: 38, src: 'hw' },
        { id: 'a:ws:1902', kind: 'ws', hw: true, due: '2026-11-04', title: '📄 일차함수 연습', wid: 1902, swId: 902, src: 'auto:ws', n: 10 },
        { id: 'hw:2026-11-02:b1', kind: 'book', hw: true, due: '2026-11-02', title: '개념+유형 중1(상) 45~56쪽', book: '개념+유형 중1(상)', bookId: 11, from: 45, to: 56, n: 30, src: 'hw', tst: 'ok' },
        { id: 'x1', kind: 'book', hw: false, due: '2026-11-04', title: '안 숙제 교재', book: '안 숙제 교재', from: 1, to: 2, n: 3 },
        { id: 'hw:p:abc', kind: 'etc', hw: true, print: true, title: '서술형 프린트 3장', n: 15, due: '2026-11-04', book: '', from: null, to: null, src: 'hw' } ] },
      hw_self_AAA111: { byDate: { '2026-11-04': { p: 100, c: 100, w: 100, a: 0 } } } };
    const AHA = ['2026-10-21T08:00:00Z', '2026-10-21T09:00:00Z'];
    const FILES = { AAA111: [{ name: 'AAA111_20261103_2030.webm', created_at: '2026-11-03T11:31:00Z' }] };
    const mk = (tbl) => { const b = { f: [], op: 'select', one: false,
      select() { return b; }, eq(k, v) { if (k === 'key') { window.__KEYS.push(v); b.f.push((x) => x === v); } return b; },
      in(k, a) { if (k === 'key') { a.forEach((x) => window.__KEYS.push(x)); b.f.push((x) => a.indexOf(x) >= 0); } return b; },
      like(k, p) { window.__KEYS.push('like:' + p); const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); b.f.push((x) => re.test(x)); return b; },
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
  t('버전 v1-38', (await pg.evaluate(() => PAR_VER)) === 'v1-38' && (await pg.title()).indexOf('v1-38') >= 0);
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  t('로그인 · 홍길동 · 숙제 자료 준비', await pg.evaluate(() => !!(P.st && P.st.name === '홍길동' && P.tab === 'home' && P.hwReady)));
  const shot = async (n) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, n + '.png'), fullPage: true }); } };
  const noSecret = async (where) => t(where + ': 문제 그림·문항 내용 없음(<img 0 · 그림 주소 0)', await pg.evaluate(() => { const a = document.getElementById('app'); return a.querySelectorAll('img').length === 0 && a.innerHTML.indexOf('secret_problem') < 0 && a.innerHTML.indexOf('cdn.example') < 0 && a.innerHTML.indexOf('<img') < 0; }));

  // ⑥ 서버 읽기 — 같은 질의에 mf_wsq_·todo_ 만 더함, hw_self_ 는 읽지 않음
  const keys = await pg.evaluate(() => __KEYS);
  t('⑥ 질의 키: mf_wsq_AAA111 · todo_AAA111 읽음 · hw_self_* 는 읽지 않음', keys.indexOf('mf_wsq_AAA111') >= 0 && keys.indexOf('todo_AAA111') >= 0 && keys.every((k) => String(k).indexOf('hw_self') < 0), JSON.stringify(keys));
  t('⑥ 읽은 학습지는 제목·숫자만(problems·그림 주소 버림) · 숙제 카드는 hw:true 만', await pg.evaluate(() => P.wsq.length === 6 && P.wsq.every((w) => !('problems' in w) && JSON.stringify(w).indexOf('secret') < 0) && P.wsq.some((w) => w.swId === 906 && w.tag === 'HOMEWORK')
    && P.todo.length === 4 && P.todo.every((it) => it.hw === true) && !P.todo.some((it) => it.id === 'x1')));

  // ① 홈 — 다음 수업일 11/5(수) · 아직 확인 전
  const pend = await pg.evaluate(() => { const c = document.querySelector('.p35card'); if (!c) return null; const p = c.querySelector('.p38pend');
    return { cls: c.className, t: p ? p.querySelector('.t').textContent : '', b: p ? p.querySelector('.b').textContent : '', d: p ? p.querySelector('.d').textContent : '',
      cells: Array.from(c.querySelectorAll('.p37stg.p38dim .c')).map((x) => x.querySelector('.n').textContent + '|' + x.querySelector('.m').textContent + '|' + x.querySelector('.p').textContent),
      dim: (() => { const x = c.querySelector('.p37stg.p38dim .c'); return x ? getComputedStyle(x).opacity : ''; })(),
      head: !!c.querySelector('.p35hd'), last: (c.querySelector('.p38last') || {}).textContent || '', lastIso: (c.querySelector('.p38last') || { dataset: {} }).dataset.iso || '' }; });
  t('① 확인 전 상자: 「루멘수학 · 숙제 · 11/4 (수) 수업」 · 「선생님 확인 전」 · 「수요일 수업 시간에 선생님이 직접 확인하면 바로 바뀌어요」', !!pend && pend.cls.indexOf('p38pendcard') >= 0 && pend.t === '루멘수학 · 숙제 · 11/4 (수) 수업' && pend.b === '선생님 확인 전' && pend.d === '수요일 수업 시간에 선생님이 직접 확인하면 바로 바뀌어요' && !pend.head, JSON.stringify(pend));
  t('① 4칸 흐리게 「확인 전」', !!pend && JSON.stringify(pend.cells) === JSON.stringify(['1 풀이|·|확인 전', '2 채점|·|확인 전', '3 오답|·|확인 전', '4 아하노트|·|확인 전']) && Number(pend.dim) < 0.7, pend && JSON.stringify([pend.cells, pend.dim]));
  t('① 「지난 수업 11/2 (월) 확인: ✓ ✓ ◐」 한 줄', !!pend && pend.lastIso === '2026-11-02' && pend.last.indexOf('지난 수업 11/2 (월) 확인: ✓ ✓ ◐') >= 0 && pend.last.indexOf('숙제 탭에서') >= 0, pend && pend.last);
  // ②③ 홈 카드 아래 줄
  const rows = (sel) => pg.evaluate((s) => Array.from(document.querySelectorAll(s + ' .p38ws .r')).map((r) => ({ sw: r.dataset.sw || '', id: r.dataset.id || '', ic: r.querySelector('.ic').textContent, b: r.querySelector('b').textContent, pl: Array.from(r.querySelectorAll('.pl')).map((p) => p.textContent + (p.classList.contains('g') ? '*g' : (p.classList.contains('b') ? '*b' : ''))) })), sel);
  const hr = await rows('.p35card');
  t('② 📄 학습지 줄: 숙제 태그 2개만(배정일 순) — 901 「12문항·9문항 맞음」 · 902 「10문항·수요일까지」', hr.filter((r) => r.sw).length === 2 && hr[0].sw === '901' && hr[0].ic === '📄' && hr[0].b === '오답 쌍둥이 프린트 (10/30)' && JSON.stringify(hr[0].pl) === JSON.stringify(['12문항*b', '9문항 맞음*g'])
    && hr[1].sw === '902' && hr[1].b === '일차함수 연습' && JSON.stringify(hr[1].pl) === JSON.stringify(['10문항*b', '수요일까지']), JSON.stringify(hr));
  t('② 주간테스트 태그 · 7일 밖 · 지난 수업 몫 학습지는 홈 카드에 없음', hr.every((r) => ['903', '904', '905', '906'].indexOf(r.sw) < 0) && (await pg.evaluate(() => { const c = document.querySelector('.p35card').textContent; return c.indexOf('주간테스트') < 0 && c.indexOf('옛 숙제') < 0 && c.indexOf('도형') < 0; })), JSON.stringify(hr));
  t('③ 📗 이번 숙제 줄: 교재 「개념+유형 중1(상) · p.57~66 · 38문항」 · 🖨️ 프린트 「서술형 프린트 3장 · 15문항」', (() => { const bk = hr.filter((r) => r.id); return bk.length === 2 && bk[0].id === 'hw:2026-11-04:b1' && bk[0].ic === '📗' && bk[0].b === '개념+유형 중1(상)' && JSON.stringify(bk[0].pl) === JSON.stringify(['p.57~66*b', '38문항'])
    && bk[1].id === 'hw:p:abc' && bk[1].ic === '🖨️' && bk[1].b === '서술형 프린트 3장' && JSON.stringify(bk[1].pl) === JSON.stringify(['15문항']); })(), JSON.stringify(hr));
  t('③ 학습지 카드(a:ws:*) · hw:false · 다른 날 마감 카드는 안 그림', hr.every((r) => r.id !== 'a:ws:1902' && r.id !== 'x1' && r.id !== 'hw:2026-11-02:b1') && (await pg.evaluate(() => document.querySelector('.p35card').textContent.indexOf('안 숙제') < 0)), JSON.stringify(hr));
  await noSecret('홈');
  await shot('1_home_pending');
  await pg.click('.p38pendcard .p38pend'); await pg.waitForTimeout(150);
  t('① 상자를 누르면 숙제 탭', await pg.evaluate(() => P.tab === 'hw'));

  // ④ 숙제 탭 7일 표 — 📄 학습지 줄
  const g = await pg.evaluate(() => { const s = document.querySelector('.p37sec'); if (!s) return null;
    const trs = Array.from(s.querySelectorAll('.p37g tbody tr'));
    const wsr = s.querySelector('tr.p38wsrow');
    return { head: Array.from(s.querySelectorAll('.p37g thead th')).map((x) => x.textContent), n: trs.length,
      ws: wsr ? Array.from(wsr.querySelectorAll('td')).map((td) => td.textContent) : null, cls: wsr ? Array.from(wsr.querySelectorAll('td:not(.l)')).map((td) => td.className.replace('a ', '')) : null,
      wsIdx: trs.indexOf(wsr), totIdx: trs.findIndex((r) => r.className === 'tot'), tip: Array.from(s.querySelectorAll('.p37tip')).map((x) => x.textContent).join(' '),
      w: s.querySelector('.p37g').getBoundingClientRect().width, sw: s.getBoundingClientRect().width }; });
  t('④ 7일 표 날짜 7개 (10/19 … 11/2)', !!g && JSON.stringify(g.head) === JSON.stringify(['', '10/19', '10/21', '10/23', '10/26', '10/28', '10/30', '11/2']), g && JSON.stringify(g.head));
  t('④ 📄 학습지 줄: — 2/5 — — — ✓ ○ (종합 줄 바로 위)', !!g && JSON.stringify(g.ws) === JSON.stringify(['📄학습지', '—', '2/5', '—', '—', '—', '✓', '○']) && g.wsIdx === 4 && g.totIdx === 5 && g.n === 6, g && JSON.stringify([g.ws, g.wsIdx, g.totIdx, g.n]));
  t('④ 📄 줄 칸 색: na half na na na ok no · 설명 한 줄 · 표가 카드 안에 들어감', !!g && JSON.stringify(g.cls) === JSON.stringify(['na', 'half', 'na', 'na', 'na', 'ok', 'no']) && g.tip.indexOf('📄 학습지 = 그 수업까지 마감이던 숙제 학습지 맞은 수/문항') >= 0 && g.w <= g.sw, g && JSON.stringify([g.cls, g.tip]));
  // ⑦ 회귀 — v1-37 숙제 탭 카드 · 녹음 그대로
  const c1 = await pg.evaluate(() => Array.from(document.querySelectorAll('.p37card .p37stg .c')).map((c) => c.querySelector('.m').textContent + c.querySelector('.p').textContent));
  t('⑦ 숙제 탭 과제 완성도 카드 그대로(11/2 · ✓100 ✓100 ◐60 — 해당 없음)', JSON.stringify(c1) === JSON.stringify(['✓100%', '✓100%', '◐60%', '—해당 없음']) && (await pg.evaluate(() => document.querySelector('.p37card .hwdate').textContent.indexOf('11/2 (월)') >= 0)), JSON.stringify(c1));
  t('⑦ v1-36 녹음 화면 그대로(주제 · ✓ 선생님이 들었어요 · 한마디) · <audio 0', await pg.evaluate(() => (document.querySelector('.p36topic') || {}).textContent.indexOf('소인수분해') >= 0 && (document.querySelector('.p36st') || {}).textContent.indexOf('✓ 선생님이 들었어요') >= 0 && (document.querySelector('.p36say') || {}).textContent.indexOf('설명이 또렷했어요') >= 0 && document.querySelectorAll('audio,video').length === 0));
  await noSecret('숙제 탭');
  await shot('2_hw_tab');
  await pg.evaluate(() => hwGoStat()); await pg.waitForTimeout(150);
  t('⑦ 월 기록 그대로(11월 수업 1일 · ◀ 10월 수업 6일 · 달력 점)', await pg.evaluate(() => { const b = document.querySelector('.p37mtop'); const a = !!b && b.querySelector('.mct').textContent === '단계별 평균 · 수업 1일' && document.querySelectorAll('.p37cal .c.on').length === 1 && document.querySelector('.mnav .ym').textContent === '2026년 11월'; hwShiftMon(-1); const c = document.querySelector('.p37mtop'); return a && !!c && c.querySelector('.mct').textContent === '단계별 평균 · 수업 6일' && document.querySelectorAll('.p37cal .c.on').length === 6 && document.querySelectorAll('.mbars .mb').length === 6; }));
  // ④ 학습지가 없는 아이는 📄 줄 자체가 없음
  t('④ 학습지 목록이 없으면 7일 표에 📄 줄 없음', await pg.evaluate(() => { const w = P.wsq; P.wsq = []; P.hwView = 'home'; goTab('hw'); const ok = !!document.querySelector('.p37sec') && !document.querySelector('tr.p38wsrow') && document.querySelector('.p37sec').textContent.indexOf('📄학습지') < 0; P.wsq = w; return ok; }));

  // ① 오늘이 수업일(11/4 수 10:00) · 아직 확인 전 → 「오늘 · 11/4 (수) 수업」 · 「오늘 수업 시간에」
  await pg.clock.setFixedTime(new Date('2026-11-04T10:00:00+09:00'));
  await pg.evaluate(() => goTab('home')); await pg.waitForTimeout(100);
  const pend2 = await pg.evaluate(() => { const p = document.querySelector('.p38pendcard .p38pend'); return p ? { t: p.querySelector('.t').textContent, d: p.querySelector('.d').textContent, due: Array.from(document.querySelectorAll('.p38pendcard .p38ws .r[data-sw="902"] .pl')).map((x) => x.textContent) } : null; });
  t('① 오늘 수업일 확인 전: 「오늘 · 11/4 (수) 수업」 · 「오늘 수업 시간에 …」 · 채점 전 학습지 「오늘까지」', !!pend2 && pend2.t === '루멘수학 · 숙제 · 오늘 · 11/4 (수) 수업' && pend2.d === '오늘 수업 시간에 선생님이 직접 확인하면 바로 바뀌어요' && JSON.stringify(pend2.due) === JSON.stringify(['10문항', '오늘까지']), JSON.stringify(pend2));

  // ② 선생님이 확인한 뒤(11/4 21:00 · lumen_hw[11/4] 생김) → 지금 카드 그대로 + 📄📗 줄
  await pg.clock.setFixedTime(new Date('2026-11-04T21:00:00+09:00'));
  await pg.evaluate(() => { P.st.lumen_hw['2026-11-04'] = { p: 100, c: 100, w: 60 }; render(); }); await pg.waitForTimeout(100);
  const done = await pg.evaluate(() => { const c = document.querySelector('.p35card'); return { cls: c.className, pend: !!c.querySelector('.p38pend'), k: c.querySelector('.p35hd .k').textContent, n: c.querySelector('.p35hd .n').textContent,
    cells: Array.from(c.querySelectorAll('.p37stg.mini .c')).map((x) => x.querySelector('.m').textContent + x.querySelector('.p').textContent), dim: !!c.querySelector('.p38dim'), tip: !!c.querySelector('.p37tip.mini'), note: !!c.querySelector('.note'),
    order: (() => { const ws = c.querySelector('.p38ws'), tip = c.querySelector('.p37tip.mini'), note = c.querySelector('.note'); return !!ws && !!tip && !!note && !!(tip.compareDocumentPosition(ws) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(ws.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
  const dr = await rows('.p35card');
  t('② 확인 뒤: 회색 상자 사라지고 v1-37 카드 그대로(오늘 11/4 (수) · 87% · ✓ ✓ ◐ —)', done.cls.indexOf('p38pendcard') < 0 && !done.pend && !done.dim && done.k.indexOf('오늘 11/4 (수)') >= 0 && done.n === '87%' && JSON.stringify(done.cells) === JSON.stringify(['✓100%', '✓100%', '◐60%', '—해당 없음']) && done.tip && done.note, JSON.stringify(done));
  t('② 확인 뒤에도 📄📗 줄(4칸 아래 · 코멘트 위) — 901 9문항 맞음 · 902 · 교재 · 프린트', done.order && dr.length === 4 && dr[0].sw === '901' && dr[0].pl[1] === '9문항 맞음*g' && dr[1].sw === '902' && dr[2].id === 'hw:2026-11-04:b1' && dr[3].id === 'hw:p:abc', JSON.stringify(dr));
  await noSecret('홈(확인 뒤)');
  await shot('3_home_done');
  // ⑤ 📗 카드가 없으면 줄 자체를 안 그림 · 학습지도 없으면 .p38ws 없음
  t('⑤ 숙제 카드 없음 → 📗 줄 없음(📄 만) · 둘 다 없음 → 줄 상자 자체 없음', await pg.evaluate(() => { const td = P.todo, w = P.wsq; P.todo = []; render(); const a = document.querySelectorAll('.p35card .p38ws .r').length === 2 && !document.querySelector('.p35card .p38ws .r[data-id]'); P.wsq = []; render(); const b = !document.querySelector('.p35card .p38ws'); P.todo = td; P.wsq = w; render(); return a && b; }));
  // ① 요일표가 없는 반 → 지금처럼 마지막 확인 날짜(11/3) · 그날 몫 줄(906 · 11/3 마감 교재)
  await pg.evaluate(() => { delete P.st.lumen_hw['2026-11-04']; P.gdays = null; render(); }); await pg.waitForTimeout(100);
  const nog = await pg.evaluate(() => { const c = document.querySelector('.p35card'); return { pend: !!c.querySelector('.p38pend'), k: c.querySelector('.p35hd .k').textContent, n: c.querySelector('.p35hd .n').textContent }; });
  const ngr = await rows('.p35card');
  t('① 요일표 없음: 확인 전 상자 없이 마지막 확인 11/2 카드 · 그 수업 몫 📄 906 「월요일까지」 · 📗 45~56쪽', !nog.pend && nog.k.indexOf('11/2 (월)') >= 0 && nog.n === '87%' && ngr.length === 2 && ngr[0].sw === '906' && JSON.stringify(ngr[0].pl) === JSON.stringify(['6문항*b', '월요일까지']) && ngr[1].id === 'hw:2026-11-02:b1' && ngr[1].pl[0] === 'p.45~56*b', JSON.stringify([nog, ngr]));
  await pg.evaluate(() => { P.gdays = { T5: [1, 3, 5] }; render(); });
  t('① 숙제 기록이 하나도 없는 아이: 확인 전 상자 + 「아직 선생님 확인 기록이 없어요」 · 요일표 없으면 예전 빈 카드', await pg.evaluate(() => { const h = P.st.lumen_hw; P.st.lumen_hw = {}; render(); const a = !!document.querySelector('.p38pendcard') && document.querySelector('.p38last').textContent.indexOf('아직 선생님 확인 기록이 없어요') >= 0; P.gdays = null; render(); const b = !document.querySelector('.p38pendcard') && document.querySelector('.p35card').textContent.indexOf('아직 기록이 없어요') >= 0; P.st.lumen_hw = h; P.gdays = { T5: [1, 3, 5] }; render(); return a && b; }));
  t('① 수업일 셈: 월(오늘)→오늘 · 화→수 · 토→월 · 요일표 없음 null', await pg.evaluate(() => { const o = p35Today; const f = (d) => { p35Today = () => d; const r = p38Session(); p35Today = o; return r; }; const a = f('2026-11-02') === '2026-11-02' && f('2026-11-03') === '2026-11-04' && f('2026-11-07') === '2026-11-09'; const gd = P.gdays; P.gdays = null; const b = p38Session() === null; P.gdays = gd; return a && b; }));

  // ⑥ 안전 — 서버 쓰기 없음 · parent.html(고정 주소) 안 바뀜 · 다른 판 안 바뀜
  t('⑥ 서버에 쓰지 않음(열람 기록 외)', (await pg.evaluate(() => __W)).every((k) => ['lumen_hw', 'stuck', 'aha_notes', 'mf_wsq', 'todo_', 'hw_self'].every((x) => String(k).indexOf(x) < 0)), JSON.stringify(await pg.evaluate(() => __W)));
  t('⑥ 녹음 목록은 내 아이 폴더만', JSON.stringify(await pg.evaluate(() => __LIST)) === JSON.stringify(['recordings:AAA111']));
  let gitSt = ''; try { gitSt = execSync('git status --porcelain -- parent.html parent_v1-35.html', { cwd: ROOT }).toString().trim(); } catch (e) { gitSt = 'git 오류 ' + e.message; }
  t('⑥ parent.html(고정 주소)·parent_v1-35.html 안 바뀜', gitSt === '', gitSt);
  t('⑥ 조립 결과: parent38.js 들어감 · hw_self 키를 읽는 코드 없음(주석만) · 가짜 이름 없음', (() => { const s = fs.readFileSync(FILE, 'utf8'); return s.indexOf('v1-38: 숙제 체크 보이기') >= 0 && s.indexOf("'hw_self") < 0 && s.indexOf('"hw_self') < 0 && s.indexOf('홍길동') < 0; })());
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
