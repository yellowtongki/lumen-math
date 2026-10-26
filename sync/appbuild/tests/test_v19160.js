#!/usr/bin/env node
/* 학원앱 v19-160 검사 — ① 중등 교재 목표 2·한계 2.5개월 ② 고등 학기 중 숙제 진도 ③ 🔔 알림(홈 카드·종·확인함)
 *   가짜 학생 홍길동(초6·중등 교재 급함)·박하나(중2·정상)·김새봄(중1·주의)·이초등(초5·초등 교재)·최고등(고1·숙제 미흡)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19160.js lumen_v19-160.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-160.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-160');
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.__STORE = {};
    window.getSupaClient = function(){ return { storage: { from(){ return { list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } }, from(){ const o = { _k: null, in(c, ks){ o._k = ks; return p; }, eq(c, k){ o._k = [k]; return p; },
      then(res, rej){ return Promise.resolve({ data: (o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })), error: null }).then(res, rej); } };
      const p = new Proxy(o, { get(tg, k){ if (k in tg) return tg[k]; return function(){ return p; }; } }); return p; } }; };
    window.supaSetItem = function(k, v){ window.__STORE[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(true); };
    try { WK.loaded = true; } catch (e) {}
    const D = (n) => bpKst(-n);
    const book = (g, n, pages) => ({ n, g, pages });
    BP.books = { b1: book('중1-2', '가짜 개념편 중등수학1(하)', 158), b2: book('중2-2', '가짜 유형 중등수학2(하)', 100), b3: book('중1-1', '가짜 RPM 중등수학1(상)', 100), b4: book('초5-2', '가짜 최상위 초등수학5-2', 100) };
    const pr = (start, last, maxPage, wk) => ({ firstDate: start, lastDate: last, maxPage, weekPages: wk, months: {}, chapters: [] });
    BP.prog = { m1: { b1: pr(D(80), D(3), 84, 4) }, m2: { b2: pr(D(20), D(1), 40, 14) }, m3: { b3: pr(D(40), D(1), 55, 9) }, m4: { b4: pr(D(80), D(2), 53, 4) }, m5: { b2: pr(D(100), D(30), 30, 0) } };
    BP.mfList = [1, 2, 3, 4, 5].map((i) => ({ mf_student_id: 'm' + i, name: 'x' + i, lumen_rec_code: 'C' + i }));
    BP.cfg = { def: 3, months: {}, pages: {}, rep: {}, done: {}, starts: {} };
    BP.loaded = true;
    groupDays.H1 = [0, 1, 2, 3, 4, 5, 6];
    const hw = {}; hw[D(1)] = { p: 40, c: 0, w: 0 }; hw[D(2)] = { p: 100, c: 100, w: 100 }; hw[D(3)] = { p: 0, c: 0, w: 0 };
    for (let k = 4; k <= 14; k++) hw[D(k)] = { p: 100, c: 100, w: 100 };
    students.length = 0;
    students.push(
      { id: 's1', name: '홍길동', grade: '초등학교 6학년', group: 'M3', lumen_rec_code: 'C1' },
      { id: 's2', name: '박하나', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'C2' },
      { id: 's3', name: '김새봄', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'C3' },
      { id: 's4', name: '이초등', grade: '초등학교 5학년', group: 'M3', lumen_rec_code: 'C4' },
      { id: 's5', name: '최고등', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'C5', lumen_hw: hw });
  });
  const rows = await pg.evaluate(() => { const o = {}; students.forEach((s) => { const x = bpStudentRow(s); o[s.name] = { st: x.status, tag: x.tag || '', why: x.why, lim: x.limD, hs: !!x.hs, need: x.need ? { wk: x.need.wk, rem: x.need.remain, cur: x.need.cur, by: x.need.by.toISOString().slice(0, 10) } : null, short: bpShortWhy(x) }; }); o.today = bpKst(); return o; });
  const H = rows['홍길동'];
  t('중등 교재 한계 = 2.5개월(76일)', H.lim === 76, JSON.stringify(H));
  t('홍길동(81일째 53%) → 🔴 급함', H.st === 'r' && H.tag === '급함' && H.short === '53%·급함', JSON.stringify(H));
  const by = new Date(Date.parse(rows.today + 'T00:00:00Z') + 35 * 86400000).toISOString().slice(0, 10);
  t('필요한 속도: 남은 74쪽 · 오늘부터 5주 → 주 +15쪽 (지금 +4)', H.need && H.need.rem === 74 && H.need.wk === 15 && H.need.cur === 4 && H.need.by === by, JSON.stringify(H.need));
  t('박하나(21일째 40%) → 🟢 정상', rows['박하나'].st === 'g' && !rows['박하나'].need, JSON.stringify(rows['박하나']));
  t('김새봄(41일째 55% → 예상 75일) → 🟡 주의(목표 2개월 넘김)', rows['김새봄'].st === 'y' && /목표 2개월/.test(rows['김새봄'].why), JSON.stringify(rows['김새봄']));
  t('초등 교재는 예전 그대로 3개월(91일) · 🟡', rows['이초등'].lim === 91 && rows['이초등'].st === 'y' && !rows['이초등'].tag, JSON.stringify(rows['이초등']));
  t('최고등(고1) 학기 중 → 숙제 진도로 (교재 경고 없음)', rows['최고등'].hs && rows['최고등'].st === 'g', JSON.stringify(rows['최고등']));
  t('✎ 로 기준을 직접 적은 중등 교재는 그 값만 씀', await pg.evaluate(() => { BP.cfg.months.b1 = 4; const a = bpMonthsOf('b1') === 4 && !bpMidStd('b1') && bpStudentRow(students[0]).status !== 'r'; delete BP.cfg.months.b1; return a && bpMonthsOf('b1') === 2.5; }));
  const hw = await pg.evaluate(() => { const x = bpHwOf(students[4]); return { ok: x.ok, bad: x.bad, unk: x.unk, n: x.n, s: bpHwStat(x) }; });
  t('최고등 숙제 진도: ✗ 2번 → 미흡 2', hw.bad === 2 && hw.s.s === 2 && hw.s.t === '미흡 2', JSON.stringify(hw));
  const rk = await pg.evaluate(() => ({ h: riskOf(students[0]).map((x) => x.k + x.sev), g: riskOf(students[4]).map((x) => x.k + x.sev) }));
  t('위험 신호: 홍길동 진도🔴 · 최고등 고등 숙제 진도(진도 경고 없음)', rk.h.includes('prog2') && rk.g.includes('hwp2') && !rk.g.some((k) => /^prog/.test(k)), JSON.stringify(rk));
  /* 진도 현황 화면 */
  await pg.evaluate(() => { BP.sel = 's1'; VIEW = 'bookprog'; render(); }); await pg.waitForTimeout(400);
  const bp = await pg.evaluate(() => document.body.innerText);
  t('진도 현황: 기준 줄(목표 2개월 · 한계 2.5개월 · 고등 단추)', /목표 2개월/.test(bp) && /한계 2\.5개월/.test(bp) && /학기 중엔 숙제 진도로 · 켜짐/.test(bp));
  t('진도 현황: «53%·급함» · 🎓 고등부 숙제 진도 칸 · 고등 미흡 칩', /53%·급함/.test(bp) && /고등부 · 학기 중 숙제 진도/.test(bp) && /고등 숙제 미흡 1\/1/.test(bp) && /🔴 급함·늦음 1/.test(bp));
  t('홍길동 상세: «주 +15쪽» · 교재 카드 «목표 2 · 한계 2.5개월 ✎»', /주 \+15쪽/.test(bp) && /목표 2 · 한계 2\.5개월 ✎/.test(bp));
  await pg.evaluate(() => { bpSelect('s5'); }); await pg.waitForTimeout(200);
  t('최고등을 누르면 상세에 «학기 중 — 숙제 진도 …/…»', /학기 중 — 숙제 진도 \d+\/\d+/.test(await pg.evaluate(() => document.body.innerText)));
  await pg.evaluate(() => bpHiSemToggle()); await pg.waitForTimeout(200);
  t('고등 단추 끄기 → 저장(hiSem:false) · 최고등도 교재 기준', await pg.evaluate(() => window.__STORE.bp_config && window.__STORE.bp_config.hiSem === false && !bpStudentRow(students[4]).hs && /꺼짐/.test(document.body.innerText)));
  await pg.evaluate(() => bpHiSemToggle());
  /* 🔔 알림 */
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await pg.waitForTimeout(1200);
  const card = async () => pg.evaluate(() => { const b = [...document.querySelectorAll('b')].find((x) => x.textContent === '🔔 이번 주 경고'); return b ? b.closest('div[style*="border-radius:16px"]').innerText : ''; });
  let hc = await card();
  t('홈 «🔔 이번 주 경고» 카드', !!hc, hc);
  t('카드: 홍길동 진도 급함(새로) · 최고등 숙제 진도 · 채점 끊김(박하나 아님)', /홍길동 · 진도 · 급함[\s\S]*새로/.test(hc) && /최고등 · 숙제 진도/.test(hc) && !/박하나/.test(hc), hc);
  t('처음 켤 때 진도 말고는 «새로» 아님', await pg.evaluate(() => { const l = alActive(); const g = l.find((a) => a.k === 'hwp'); const h = l.find((a) => a.k === 'prog'); return g && h && !alIsNew(g) && alIsNew(h) && !!window.__STORE.alert_state; }));
  const n0 = await pg.evaluate(() => document.getElementById('al-bell-n').textContent);
  t('위쪽 🔔 단추에 개수', +n0 >= 2 && await pg.evaluate(() => !!document.getElementById('al-bell').offsetParent), n0);
  await pg.evaluate(() => { const a = alActive().find((x) => x.st.name === '홍길동' && x.k === 'prog'); alAck(a.key); }); await pg.waitForTimeout(300);
  hc = await card();
  t('«확인함» → 카드에서 사라지고 서버(alert_state.ack)에 저장 · 숫자 줄어듦', !/홍길동 · 진도/.test(hc) && await pg.evaluate(() => Object.keys(window.__STORE.alert_state.ack).some((k) => /^C1\|prog\|2$/.test(k))) && (+await pg.evaluate(() => document.getElementById('al-bell-n').textContent)) === (+n0) - 1, hc);
  await pg.evaluate(() => document.getElementById('al-bell').click()); await pg.waitForTimeout(200);
  const pop = await pg.evaluate(() => { const p = document.getElementById('al-pop'); return p && p.style.display !== 'none' ? p.innerText : ''; });
  t('🔔 누르면 알림 목록 창', /🔔 알림 \d+건/.test(pop) && /최고등/.test(pop), pop);
  await pg.evaluate(() => { const i = AL._last.findIndex((a) => a.k === 'hwp'); alGo(i); }); await pg.waitForTimeout(200);
  t('알림 줄의 «고등 숙제 진도 ›» → 숙제체크 화면 · 창 닫힘', await pg.evaluate(() => VIEW === 'hwcheck' && document.getElementById('al-pop').style.display === 'none'));
  t('월요일 요약 한 줄 함수(월요일이 아니면 빈칸)', await pg.evaluate(() => { const r = alMonday(); return new Date(bpKst() + 'T12:00:00Z').getUTCDay() === 1 ? /지난주 요약/.test(r) : r === ''; }));
  t('시작 다운로드에서 alert_state 뺌', await pg.evaluate(() => PULL_SKIP_KEYS.indexOf('alert_state') >= 0));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
