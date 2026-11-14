#!/usr/bin/env node
/* 학원앱 v19-188 검사 (2) — 📈 성적 추이 학부모앱 발행 · 리포트 안 «최근 성적» · 홈 왼쪽 단추
 *   외부망 차단 · getSupaClient 가짜(mf_weekly · mf_students 읽기만) · 이름 ○○○
 *   ① 홈 왼쪽 «명예의 전당» 밑 «📈 성적 한눈에» 단추 → VIEW scoreov
 *   ② soPubHist: wk(전국 등수·시험지 제목·nat) · dy(학원 평균) · 학교 성적 없음 · 최근 주간 리포트가 전국 숨김이면 r·n 비움
 *   ③ udPublishParent 가 meta.hist 를 넣는 줄이 있음
 *   ④ soRepRecent: 주간 리포트 → 주간만 최근 6회 막대(등급 색) + «378/823명 · 3등급» · 일일 리포트 → 일일만(학원 평균 차이 색) · 그 리포트 날짜 뒤 회차는 안 넣음
 *   ⑤ buildMultiReportHTML 결과에 «📊 최근 전국주간테스트» · 옛 «📈 성장 추이» 없음 ⑥ 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19188_pub.js lumen_v19-188.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-188.html');
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const P = (fn, a) => pg.evaluate(fn, a);
  await P(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const S = (sid, score, r, n, avg) => ({ sid, score, natRank: r, natN: n, natAvg: avg, acadAvg: 60, date: '' });
    window.__STORE = { mf_weekly: { tests: [
      { wid: 1, type: 'WEEKLY', title: '[중2] 주간 9회', date: '2026-10-28', students: [S('S1', 80, 229, 821, 73)] },
      { wid: 2, type: 'WEEKLY', title: '[중2] 주간 10회 · 삼각형의 성질', date: '2026-11-04', students: [S('S1', 70, 378, 823, 68)] } ] } };
    const mk = (tbl) => { const b = { f: {}, select() { return b; }, in(k, a) { b.f.in = a; return b; }, eq() { return b; }, like() { return b; }, ilike() { return b; }, not() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, gt() { return b; }, lt() { return b; }, lte() { return b; }, neq() { return b; }, is() { return b; }, maybeSingle() { return b; }, single() { return b; }, upsert() { return Promise.resolve({ error: null }); }, insert() { return Promise.resolve({ error: null }); },
      then(r, j) { let data = []; if (tbl === 'lumen_store') data = (b.f.in || []).filter((k) => k in __STORE).map((k) => ({ key: k, value: __STORE[k] }));
        if (tbl === 'mf_students') data = [{ mf_student_id: 'S1', lumen_rec_code: 'AAA111' }]; return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    getSupaClient = function () { return { from: mk }; };
    students.length = 0; students.push({ id: 'A', name: '○○○A', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' });
    list.length = 0;
    const R = (date, testType, score, extra) => Object.assign({ id: 'r' + date, name: '○○○A', studentId: 'A', grade: '중학교 2학년', date, testType, score: String(score), level: '3' }, extra || {});
    list.push(R('2026.10.28', 'weekly', 80, { rank: 229, total: 821, avgScore: 73 }));
    list.push(R('2026.11.04', 'weekly', 70, { rank: 378, total: 823, avgScore: 68 }));
    list.push(R('2026.11.05', 'class', 47, { acadAvg: 52 }));
    list.push(R('2026.11.06', 'class', 66, { acadAvg: 58 }));
    list.push(R('2026.11.10', 'class', 70, { acadAvg: 49 }));
    schoolScores = { A: [{ id: 'x', semester: { grade: 2, term: 2 }, examType: '중간', subjects: [{ name: '수학', score: 84 }] }] };
    SO.loaded = false; SO.busy = false;
  });

  /* ① */
  await P(() => { VIEW = 'home'; render(); }); await pg.waitForTimeout(400);
  const side = await P(() => { const b = Array.from(document.querySelectorAll('button')).filter((x) => /성적 한눈에/.test(x.innerText) && /전국주간 · 학교 시험 · 일일/.test(x.innerText)); const h = Array.from(document.querySelectorAll('button')).filter((x) => /명예의 전당/.test(x.innerText) && /주간테스트 1등/.test(x.innerText));
    return { n: b.length, after: b.length && h.length ? !!(h[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING) : false, onclick: b.length ? b[0].getAttribute('onclick') : '' }; });
  t('① 홈 왼쪽 «📈 성적 한눈에» 단추 · 명예의 전당 다음', side.n === 1 && side.after && /VIEW='scoreov'/.test(side.onclick), JSON.stringify(side));

  /* ② */
  const H = await P(async () => soPubHist(students[0]));
  t('② hist.wk 2회 · 전국 378/823 · 시험지 제목 · nat', H && H.wk.length === 2 && H.wk[1].r === 378 && H.wk[1].n === 823 && /삼각형의 성질/.test(H.wk[1].t) && H.wk[1].nat === true, JSON.stringify(H && H.wk));
  t('② hist.dy 3회 · 학원 평균', H && H.dy.length === 3 && H.dy[2].avg === 49 && H.dy[2].s === 70, JSON.stringify(H && H.dy));
  t('② 학교 성적은 넣지 않음', H && !('sch' in H) && !/84/.test(JSON.stringify(H.dy)), JSON.stringify(Object.keys(H || {})));
  const H2 = await P(async () => { list.filter((r) => r.testType === 'weekly').forEach((r) => { r.showRank = false; }); const x = await soPubHist(students[0]); list.forEach((r) => { delete r.showRank; }); return x; });
  t('② 최근 주간 리포트가 «전국 등수 숨김»이면 r·n 비움', H2 && H2.wk.every((e) => e.r === null && e.n === null) && H2.wk[1].s === 70, JSON.stringify(H2 && H2.wk));

  /* ③ */
  t('③ 학부모앱 발행(udPublishParent)에 meta.hist', await P(() => /meta\.hist=await soPubHist\(st\)/.test(String(udPublishParent))), '');

  /* ④ */
  const rw = await P(() => { const reps = list.slice().sort((a, b) => b.date.localeCompare(a.date)); const d = reps.find((r) => r.date === '2026.11.04'); const h = soRepRecent(reps, d); const box = document.createElement('div'); box.innerHTML = h; return { txt: box.innerText.replace(/\s+/g, ' '), bars: box.querySelectorAll('div[style*="border-radius:8px 8px 3px 3px"]').length, cols: Array.from(box.querySelectorAll('div[style*="border-radius:8px 8px 3px 3px"]')).map((x) => x.style.background) }; });
  t('④ 주간 리포트 → «최근 전국주간테스트 2회» · 378/823명 · 3등급 · 막대 2(일일 안 섞임)', /최근 전국주간테스트 2회/.test(rw.txt) && /378\/823명 · 3등급/.test(rw.txt) && rw.bars === 2, JSON.stringify(rw));
  t('④ 막대 색 = 전국 상위 % 등급(229/821 → 2등급 파랑 · 378/823 → 3등급 노랑)', /29, 111, 232/.test(rw.cols[0]) && /180, 83, 9/.test(rw.cols[1]), JSON.stringify(rw.cols));
  const rd = await P(() => { const reps = list.slice().sort((a, b) => b.date.localeCompare(a.date)); const d = reps.find((r) => r.date === '2026.11.06'); const box = document.createElement('div'); box.innerHTML = soRepRecent(reps, d); return { txt: box.innerText.replace(/\s+/g, ' '), bars: box.querySelectorAll('div[style*="border-radius:8px 8px 3px 3px"]').length }; });
  t('④ 일일 리포트(11/6) → 일일만 · 11/6까지 2회(11/10 빠짐) · +8 · -5', /최근 일일테스트 2회/.test(rd.txt) && rd.bars === 2 && /\+8/.test(rd.txt) && /-5/.test(rd.txt), JSON.stringify(rd));

  /* ⑤ */
  const mh = await P(() => buildMultiReportHTML(list.slice()));
  t('⑤ 리포트 HTML — «📊 최근 …» 들어감 · 옛 «📈 성장 추이» 빠짐', /📊 최근 (전국주간|일일)테스트/.test(mh) && !/📈 성장 추이/.test(mh), '');
  t('⑥ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
