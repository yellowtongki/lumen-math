#!/usr/bin/env node
/* 학원앱 v19-157 검사 — ① 학생관리 «🔗 매쓰플랫과 연결 안 된 학생» 띠 ② 플래너 표 말일 잘림 ③ 데이터 재연결 나눠 읽기
 *   가짜 학생 홍길동·박하나(학원앱) · 매쓰플랫에만 있는 김새봄(중1)·이가을(초5) · 숨긴 계정 t
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19157.js lumen_v19-157.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-157.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-157');
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    students.length = 0;
    students.push({ id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' });
    students.push({ id: 'S2', name: '박하나', grade: '초등학교 6학년', group: 'E1', lumen_rec_code: 'BBB222' });
    window.saveStudents = function(){}; try { window.scheduleSync = function(){}; } catch (e) {}
    window.__SET = []; window.supaSetItem = function(k, v){ window.__SET.push([k, JSON.parse(JSON.stringify(v))]); return Promise.resolve(true); };
    MFU.loaded = true; MFU.at = Date.now();
    MFU.rows = [
      { mf_student_id: 'I1', name: '김새봄', grade: '1', school_type: 'MIDDLE', status: 'ACTIVE', lumen_rec_code: null },
      { mf_student_id: 'I2', name: '이가을', grade: '5', school_type: 'ELEMENTARY', status: 'ACTIVE', lumen_rec_code: null },
      { mf_student_id: 'I3', name: '홍 길동', grade: '2', school_type: 'MIDDLE', status: 'ACTIVE', lumen_rec_code: null },
      { mf_student_id: 'I4', name: '박하나', grade: '6', school_type: 'ELEMENTARY', status: 'ACTIVE', lumen_rec_code: 'BBB222' },
      { mf_student_id: 'I5', name: 't', grade: '', school_type: '', status: 'ACTIVE', lumen_rec_code: null },
      { mf_student_id: 'I6', name: '최겨울', grade: '3', school_type: 'HIGH', status: 'INACTIVE', lumen_rec_code: null }
    ];
    MFU.hide = ['I5'];
    VIEW = 'studentdb'; STU_SUBTAB = 'students'; render();
  });
  await pg.waitForTimeout(300);
  const band = await pg.$('#mfu-band');
  t('학생관리에 연결 안 된 학생 띠가 보인다', !!band);
  const bt = band ? await band.innerText() : '';
  t('띠: 3명 (김새봄·이가을·홍 길동) — 연결된 박하나·숨긴 t·INACTIVE 최겨울은 빠짐', /3명/.test(bt) && /김새봄/.test(bt) && /이가을/.test(bt) && !/박하나/.test(bt) && !/최겨울/.test(bt) && !/\bt\b/.test(bt.replace(/[가-힣]/g, '')), bt.slice(0, 200));
  t('학년 짧게: 중1 · 초5', /김새봄\s*중1/.test(bt) && /이가을\s*초5/.test(bt), bt);
  t('이름 띄어쓰기만 다른 홍 길동 = 등록됨 · 다음 수집 때 연결', /홍 길동[\s\S]*등록됨 · 다음 수집 때 연결/.test(bt));
  await pg.evaluate(() => mfuAdd('I1')); await pg.waitForTimeout(200);
  const f = await pg.evaluate(() => ({ n: document.getElementById('edit-name').value, g: document.getElementById('edit-grade').value, shown: document.getElementById('student-edit-form').style.display }));
  t('＋ 등록 → 학생 추가 창에 이름·학년 채움', f.n === '김새봄' && f.g === '중학교 1학년' && f.shown === 'block', JSON.stringify(f));
  await pg.evaluate(() => mfuAdd('I2'));
  t('초등 학년도 채움', (await pg.evaluate(() => document.getElementById('edit-grade').value)) === '초등학교 5학년');
  await pg.evaluate(() => mfuHide('I2')); await pg.waitForTimeout(200);
  const set1 = await pg.evaluate(() => window.__SET.slice());
  t('숨기기 → 서버 mf_unlink_hide 에 I5,I2', set1.some((x) => x[0] === 'mf_unlink_hide' && x[1].join() === 'I5,I2'), JSON.stringify(set1));
  t('숨긴 뒤 띠는 2명', /2명/.test(await pg.$eval('#mfu-band', (e) => e.innerText)));
  await pg.evaluate(() => mfuReq()); await pg.waitForTimeout(100);
  const set2 = await pg.evaluate(() => window.__SET.slice(-1)[0]);
  t('지금 수집 요청 → mf_collect_req requested', set2[0] === 'mf_collect_req' && set2[1].status === 'requested' && set2[1].by === 'studentdb');
  await pg.evaluate(() => { MFU.hide = ['I1', 'I2', 'I3', 'I5']; render(); });
  t('다 연결되거나 숨기면 띠가 사라짐', !(await pg.$('#mfu-band')));
  /* ③ 나눠 읽기 */
  const rel = await pg.evaluate(async () => {
    const keys = []; for (let i = 0; i < 230; i++) keys.push('student_planner_C' + String(i).padStart(3, '0'));
    for (let i = 0; i < 40; i++) keys.push('submissions_C' + i); keys.push('or_studentdb'); keys.push('mf_weekly');
    const calls = [];
    const sb = { from(){ const q = { _f: null, _r: [0, 0], select(){ return q; }, order(){ return q; }, range(a, b){ q._r = [a, b]; return q; },
      like(k, p){ q._f = (x) => x.indexOf(p.replace('%', '')) === 0; return q; }, eq(k, v){ q._f = (x) => x === v; return q; },
      then(res){ calls.push(q._r.join('-')); const all = keys.filter(q._f).map((k) => ({ key: k, value: {} })); res({ data: all.slice(q._r[0], q._r[1] + 1), error: null }); } }; return q; } };
    const rows = await mfuRelinkRows(sb); return { n: rows.length, calls: calls.length, mf: rows.some((r) => r.key === 'mf_weekly') };
  });
  t('데이터 재연결: 필요한 키만 100줄씩 (230+40+1 = 271줄, 다른 키 안 읽음)', rel.n === 271 && !rel.mf && rel.calls === 5, JSON.stringify(rel));
  t('openDataRelink 가 나눠 읽기를 쓴다', await pg.evaluate(() => /mfuRelinkRows\(sb\)/.test(openDataRelink.toString()) && !/select\('key,value'\);/.test(openDataRelink.toString())));
  /* ② 플래너 표 */
  await pg.evaluate(() => { PLANNER_MONTH = (function(){ const d = new Date(); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0'); })(); VIEW = 'planner'; try { PLANNER_VIEW = 'input'; } catch (e) {} render(); });
  await pg.waitForTimeout(600);
  const g = await pg.evaluate(() => {
    const w = document.getElementById('plGridWrap'); if (!w) return null;
    const ths = [...w.querySelectorAll('thead tr:nth-child(2) th')];
    const d31 = ths.find((x) => x.textContent.trim() === '31'), tot = ths[ths.length - 1];
    const auto = w.scrollLeft;
    w.scrollLeft = w.scrollWidth;
    return { ov: getComputedStyle(w).overflowX, sw: w.scrollWidth, cw: w.clientWidth, auto, d31r: d31 && d31.getBoundingClientRect().right, totL: tot.getBoundingClientRect().left };
  });
  t('플래너 표 틀이 가로로 밀린다 (overflow-x:auto)', g && g.ov === 'auto', JSON.stringify(g));
  t('표가 화면보다 넓으면 열 때 오늘 칸 쪽으로 밀어 둔다', g && (g.sw <= g.cw || g.auto > 0), JSON.stringify(g));
  t('끝까지 밀면 31일 칸이 합계 칸에 가려지지 않는다', g && g.d31r <= g.totL + 1, JSON.stringify(g));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
