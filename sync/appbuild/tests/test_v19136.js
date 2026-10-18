#!/usr/bin/env node
/* 학원앱 v19-136 검사 — 🗺 시청 지도 2판 (세로 = 영상(단원별) · 가로 = 학생)
 *   (원장 2026-10-18 「시청지도가 가로로 쭈욱 되어있어서 보기힘들다. 왼쪽 폴더별로 눌렀을 때 한눈에 볼 수 있는것이 나을까?」
 *    → 시안 보고 「이대로 v19-136 만들어」)
 *   ① 줄 = 영상, 폴더 단원 순서대로 묶음 · 미분류 맨 끝 · 칸 = 이 화면에서 배정된 학생만(앱 순서) · 끝 = 영상 평균 %
 *   ② 칸 뜻은 v19-135 그대로 (회차 숫자 · 빨간 테두리 · ↻ · «·»)
 *   ③ 단원 줄 누르면 접힘 · 단원 평균 · 「배정 없음」
 *   ④ 학생 띠: 완료/배정 · 다시 봄 · 마지막 시청
 *   ⑤ 제목 아래 내준 날짜 · 마감(지남은 빨강 — 모두 완료면 지남 아님)
 *   ⑥ 묶음 고르면 그 영상·학생만 · 칸 누르면 회차 창(최근 먼저) · 1200px 에서 가로 넘침 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19136.js lumen_v19-136.html
 *   그림: $SP/v19136.png   가짜 서버 · 외부망 차단 · 한국 시각. 학생 실명 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-136.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-136'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
/* 앱 순서(getSortedStudents) = 중2 먼저 — 표의 학생 칸도 이 순서여야 한다. EEE555 는 아무것도 배정 안 됨 → 칸 없음 */
const STUDENTS = [
  { id: 'S4', name: '○○라', grade: '중학교 2학년', group: '중2 A반', lumen_rec_code: 'DDD444' },
  { id: 'S1', name: '○○가', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'AAA111' },
  { id: 'S2', name: '○○나', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'BBB222' },
  { id: 'S3', name: '○○다', grade: '중학교 1학년', group: '중1 B반', lumen_rec_code: 'CCC333' },
  { id: 'S5', name: '○○마', grade: '중학교 1학년', group: '중1 B반', lumen_rec_code: 'EEE555' }];
/* 단원 순서: 집합(order 0) → 명제(order 1) — 배열에는 거꾸로 넣어 «순서대로» 묶는지 본다. V4 는 단원 없음(미분류) */
const CATALOG = { folders: [{ id: 'F1', name: '공수2 집합', order: 0, completeThreshold: 90, seqOpen: false }],
  units: [{ id: 'U2', folderId: 'F1', name: '명제', order: 1 }, { id: 'U1', folderId: 'F1', name: '집합', order: 0 }],
  videos: [{ id: 'V4', folderId: 'F1', title: '오리엔테이션', youtubeId: 'ddddddddddd', durationSec: 300, order: 0, quiz: [] },
           { id: 'V3', folderId: 'F1', title: '명제와 조건 p40 261010', youtubeId: 'ccccccccccc', durationSec: 600, order: 3, quiz: [], unitId: 'U2' },
           { id: 'V5', folderId: 'F1', title: '명제의 역과 대우 — 아주 긴 제목이 줄바꿈되는지 보는 영상 p44 261012', youtubeId: 'eeeeeeeeeee', durationSec: 600, order: 4, quiz: [], unitId: 'U2' },
           { id: 'V1', folderId: 'F1', title: '집합 1강 p10 261001', youtubeId: 'aaaaaaaaaaa', durationSec: 600, order: 1, quiz: [], unitId: 'U1' },
           { id: 'V2', folderId: 'F1', title: '집합 2강 p20 261005', youtubeId: 'bbbbbbbbbbb', durationSec: 600, order: 2, quiz: [], unitId: 'U1' }] };
const ASSIGN0 = { V1: { codes: ['AAA111', 'BBB222'], due: '' } };   /* v19-135 전 배정 — 날짜 기록 없음 */
const LOGS = [
  { id: 1, video_id: 'V1', student_code: 'AAA111', session_start: '2026-10-10T20:00:00+09:00', watched_sec: 300, max_position_sec: 300, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 0, end: 300, rate: 1 }], created_at: '2026-10-10T11:00:00Z' },
  { id: 2, video_id: 'V1', student_code: 'AAA111', session_start: '2026-10-12T21:32:00+09:00', watched_sec: 10, max_position_sec: 10, completed: false, playback_rate: 1, blur_count: 1, segments: [{ start: 0, end: 10, rate: 1 }], created_at: '2026-10-12T12:32:00Z' },
  { id: 3, video_id: 'V1', student_code: 'AAA111', session_start: '2026-10-15T19:05:00+09:00', watched_sec: 400, max_position_sec: 600, completed: true, playback_rate: 2, blur_count: 3, segments: [{ start: 200, end: 400, rate: 1 }, { start: 400, end: 600, rate: 2 }], created_at: '2026-10-15T10:05:00Z' },
  { id: 4, video_id: 'V1', student_code: 'AAA111', session_start: '2026-10-15T19:05:00+09:00', watched_sec: 150, max_position_sec: 350, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 200, end: 350, rate: 1 }], created_at: '2026-10-15T10:06:00Z' },
  { id: 5, video_id: 'V1', student_code: 'BBB222', session_start: '2026-10-16T18:00:00+09:00', watched_sec: 120, max_position_sec: 120, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 0, end: 120, rate: 1 }], created_at: '2026-10-16T09:00:00Z' },
  { id: 6, video_id: 'V3', student_code: 'DDD444', session_start: '2026-10-17T09:30:00+09:00', watched_sec: 600, max_position_sec: 600, completed: true, playback_rate: 1, blur_count: 0, segments: [{ start: 0, end: 600, rate: 1 }], created_at: '2026-10-17T00:30:00Z' }];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, CATALOG, ASSIGN0, LOGS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.T = { store: {}, logs: LOGS, sync: [], toasts: [] };
    const chain = (table) => { const q = { _in: null,
      select() { return q; }, order() { return q; }, eq() { return q; }, not() { return q; }, limit() { return q; },
      in(k, v) { q._in = v; return q; },
      _res() { if (table === 'vod_watch_logs') return { data: JSON.parse(JSON.stringify(T.logs)), error: null };
        if (table === 'lumen_store') return { data: Object.keys(T.store).filter((k) => !q._in || q._in.indexOf(k) >= 0).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(T.store[k])), updated_at: '2026-10-18T00:00:00Z' })), error: null };
        return { data: [], error: null }; },
      then(a, b) { return Promise.resolve(q._res()).then(a, b); }, catch(f) { return Promise.resolve(q._res()).catch(f); },
      upsert() { return Promise.resolve({ error: null }); } }; return q; };
    window.getSupaClient = () => ({ from: chain });
    window.getSortedStudents = () => STUDENTS;
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('ALERT ' + m); };
    scheduleSync = (function () { return function (k) { T.sync.push(k); }; })();
    vodToast = function (m) { T.toasts.push(m); };
    localStorage.setItem('lumen_vod_catalog', JSON.stringify(CATALOG));
    localStorage.setItem('lumen_vod_assign', JSON.stringify(ASSIGN0));
    localStorage.removeItem('lumen_vod_bundles'); localStorage.removeItem('lumen_vod_assign_at');
    VOD_CATALOG = null; VOD_ASSIGN = null; VOD_LOGS = null; VOD5.bundles = null; VOD5.at = null; VOD5.sel = ''; VOD5.open = null;
  }, { STUDENTS, CATALOG, ASSIGN0, LOGS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 120)), ms);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  const dates = await pg.evaluate(() => { const f = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { yday: f(new Date(Date.now() - 86400000)), tmr: f(new Date(Date.now() + 86400000)) }; });

  /* 배정 만들기: 묶음(V1·V2 → BBB222·CCC333, 마감 어제) · V3 → DDD444(내준 날 10/1, 마감 어제) · V4 → AAA111(마감 내일) · V5 아무도 */
  await pg.evaluate(() => { VIEW = 'vod'; VOD_MODE = 'manage'; VOD_SEL_FOLDER = 'F1'; render(); vodBulkToggleVideo('V1'); vodBulkToggleVideo('V2'); vodBulkOpen(); });
  await settle(80);
  await pg.evaluate((yday) => { vodBulkToggleStu('BBB222'); vodBulkToggleStu('CCC333'); VOD_BULK_DUE = yday; }, dates.yday);
  await settle(50);
  await pg.fill('#vod5-bname', '시험 묶음 A'); await pg.click('#vod5-bapply'); await settle(80);
  const b1 = await pg.evaluate(() => JSON.parse(localStorage.getItem('lumen_vod_bundles')).bundles[0]);
  await pg.evaluate(({ yday, tmr }) => {
    vodToggleAssign('V3', 'DDD444'); vodToggleAssign('V4', 'AAA111');
    const A = JSON.parse(localStorage.getItem('lumen_vod_assign_at')); A.V3.DDD444 = '2026-10-01T01:00:00.000Z'; localStorage.setItem('lumen_vod_assign_at', JSON.stringify(A)); VOD5.at = null;
    VOD_ASSIGN.V3.due = yday; VOD_ASSIGN.V4.due = tmr; vodSaveAssign();
  }, dates);
  t('준비: 묶음 1건 · V3·V4 배정', !!(b1 && b1.name === '시험 묶음 A') && await pg.evaluate(() => VOD_ASSIGN.V3.codes[0] === 'DDD444' && VOD_ASSIGN.V4.codes[0] === 'AAA111'));

  /* ── 시청 지도 (폴더 전체) ── */
  await pg.evaluate(() => { VOD_MODE = 'monitor'; VOD_MON_TAB = 'map'; VOD5.sel = ''; VOD5.open = null; VOD_LOGS = null; render(); });
  await settle(300);
  const read = () => pg.evaluate(() => {
    const g = document.getElementById('vod5-grid'); if (!g) return null;
    const rows = [...g.querySelectorAll('tbody tr')].map((r) => r.classList.contains('vod6-unit')
      ? { u: r.dataset.k, txt: r.textContent, avg: (r.querySelector('.vod6-uavg') || {}).textContent }
      : { v: r.dataset.vid, given: (r.querySelector('.vod6-given') || {}).textContent || '', due: r.querySelector('.vod6-due') ? r.querySelector('.vod6-due').textContent : null,
          dueRed: r.querySelector('.vod6-due') ? /220, 38, 38/.test(getComputedStyle(r.querySelector('.vod6-due')).color) : false,
          avg: (r.querySelector('.vod6-ravg') || {}).textContent });
    const cols = [...g.querySelectorAll('th.vod6-colh')].map((h) => h.dataset.code);
    const cells = [...g.querySelectorAll('.vod5-cell')].map((c) => ({ v: c.dataset.vid, c: c.dataset.code, n: c.dataset.n, txt: c.textContent, late: c.dataset.late, re: c.dataset.re, na: c.classList.contains('vod5-na'), bd: c.style.borderColor || c.style.border }));
    const strip = [...document.querySelectorAll('.vod6-stu')].map((s) => ({ c: s.dataset.code, txt: s.textContent, done: s.dataset.done, asg: s.dataset.asg, re: s.dataset.re, last: (s.querySelector('.vod6-last') || {}).textContent }));
    return { rows, cols, cells, strip, head: (document.getElementById('vod6-head') || {}).textContent || '', legend: (document.getElementById('vod5-legend') || {}).textContent || '',
      oldCols: document.querySelectorAll('th.vod5-col').length, sticky: getComputedStyle(g.querySelector('thead th')).position };
  });
  let g1 = await read();
  t('지도 그려짐 · 옛 가로 지도(영상 열 머리) 없음', !!g1 && g1.oldCols === 0, JSON.stringify(g1 && g1.oldCols));
  const order = g1.rows.map((r) => r.u ? ('[' + r.u.split('|')[1] + ']') : r.v).join(' ');
  t('줄 순서: [집합] V1 V2 · [명제] V3 V5 · [미분류] V4 (단원 order 순 · 미분류 맨 끝 · 배정 없는 V5 도 줄)', order === '[U1] V1 V2 [U2] V3 V5 [] V4', order);
  t('단원 줄 글자: 「집합 · 2강」 · 미분류 이름', /집합 · 2강/.test(g1.rows[0].txt) && /미분류 · 1강/.test(g1.rows[6].txt), g1.rows[0].txt + ' / ' + g1.rows[6].txt);
  t('학생 칸 = 배정된 학생만 · 앱 순서 (DDD444, AAA111, BBB222, CCC333 · EEE555 없음)', g1.cols.join(',') === 'DDD444,AAA111,BBB222,CCC333', g1.cols.join(','));
  t('표 머리 붙박이(sticky)', g1.sticky === 'sticky', g1.sticky);
  const cell = (g, v, c) => g.cells.filter((x) => x.v === v && x.c === c)[0] || {};
  const a1 = cell(g1, 'V1', 'AAA111');
  t('AAA111×V1: 10초짜리 빼고 «2» · 중복 줄 하나로 · ↻ · 완료라 테두리 없음', a1.n === '2' && a1.txt === '2↻' && a1.re === '1' && a1.late === '0', JSON.stringify(a1));
  const bb = cell(g1, 'V1', 'BBB222'), cc = cell(g1, 'V2', 'CCC333');
  t('BBB222×V1: «1» · 마감(어제) 지남·미완료 → 빨간 테두리', bb.n === '1' && bb.re === '0' && bb.late === '1' && /220, 38, 38|dc2626/.test(bb.bd), JSON.stringify(bb));
  t('CCC333×V2: 안 봄 → 빈 칸 · 빨간 테두리', cc.n === '0' && cc.txt === '' && cc.late === '1', JSON.stringify(cc));
  t('배정 안 된 칸 «·» (AAA111×V2 · DDD444×V1 · V5 전부)', cell(g1, 'V2', 'AAA111').na && cell(g1, 'V2', 'AAA111').txt === '·' && cell(g1, 'V1', 'DDD444').na && g1.cells.filter((x) => x.v === 'V5').every((x) => x.na && x.txt === '·'), JSON.stringify(g1.cells.filter((x) => x.v === 'V5')));
  const d3 = cell(g1, 'V3', 'DDD444');
  t('DDD444×V3: 다 봄 «1» · 마감 어제지만 완료라 테두리 없음', d3.n === '1' && d3.late === '0', JSON.stringify(d3));
  t('칸 수 = 영상 5 × 학생 4 = 20', g1.cells.length === 20, g1.cells.length);
  const R = (v) => g1.rows.filter((r) => r.v === v)[0] || {};
  t('영상 평균 %: V1 (100+20+0)/3 = 40% · V2 0% · V3 100% · V4 0% · V5 빈칸', R('V1').avg === '40%' && R('V2').avg === '0%' && R('V3').avg === '100%' && R('V4').avg === '0%' && R('V5').avg === '', [R('V1').avg, R('V2').avg, R('V3').avg, R('V4').avg, R('V5').avg].join(','));
  t('단원 평균: 집합 (100+20+0+0+0)/5 = 24% · 명제 100% · 미분류 0%', /단원 평균 24%/.test(g1.rows[0].avg) && /단원 평균 100%/.test(g1.rows[3].avg) && /단원 평균 0%/.test(g1.rows[6].avg), g1.rows.filter((r) => r.u).map((r) => r.avg).join(' | '));
  t('머리줄 「공수2 집합 · 영상 5 · 배정 4명 · 평균 완료율 31%」 (220/7)', /공수2 집합/.test(g1.head) && /영상 5 · 배정 4명 · 평균 완료율 31%/.test(g1.head), g1.head);
  const today = await pg.evaluate((at) => vod6DateOnly(at), b1.at);
  t('V1 내준 날짜 = 학생 중 가장 먼저(묶음 시각) 「' + today + '」 · 마감 어제 «지남» 빨강', R('V1').given === '📅 내준 날짜 ' + today && / 지남$/.test(R('V1').due || '') && R('V1').dueRed, JSON.stringify(R('V1')));
  t('V3 내준 날짜 「10/1 (목)」 · 마감 어제지만 모두 완료 → «지남» 없음 · 빨강 아님', R('V3').given === '📅 내준 날짜 10/1 (목)' && /^⏰ 마감 \d+\/\d+ \(.\)$/.test(R('V3').due || '') && !R('V3').dueRed, JSON.stringify(R('V3')));
  t('V4 마감 내일 → «지남» 없음 · V5 배정 없음 → 「기록 없음」 · 마감 줄 없음', /^⏰ 마감 \d+\/\d+ \(.\)$/.test(R('V4').due || '') && !R('V4').dueRed && R('V5').given === '📅 내준 날짜 기록 없음' && R('V5').due === null, JSON.stringify([R('V4'), R('V5')]));
  const S_ = (c) => g1.strip.filter((s) => s.c === c)[0] || {};
  t('학생 띠 4칸 (배정된 학생만 · 같은 순서)', g1.strip.map((s) => s.c).join(',') === 'DDD444,AAA111,BBB222,CCC333', g1.strip.map((s) => s.c).join(','));
  t('학생 띠 AAA111: 완료 1 / 배정 2 · 다시 봄 1 · 마지막 시청 10/15 (목) 19:05', S_('AAA111').done === '1' && S_('AAA111').asg === '2' && S_('AAA111').re === '1' && /완료 1 \/ 배정 2/.test(S_('AAA111').txt) && /다시 봄 1/.test(S_('AAA111').txt) && S_('AAA111').last === '10/15 (목) 19:05', JSON.stringify(S_('AAA111')));
  t('학생 띠 BBB222: 완료 0 / 배정 2 · 다시 봄 0 · 마지막 10/16 (금) 18:00 · CCC333 마지막 「없음」 · DDD444 완료 1 / 배정 1',
    /완료 0 \/ 배정 2/.test(S_('BBB222').txt) && /다시 봄 0/.test(S_('BBB222').txt) && S_('BBB222').last === '10/16 (금) 18:00' && S_('CCC333').last === '없음' && /완료 1 \/ 배정 1/.test(S_('DDD444').txt), JSON.stringify([S_('BBB222'), S_('CCC333'), S_('DDD444')]));
  t('범례 (안 봄 · 1~49% · 50%~ · 완료 · 본 횟수 · 마감 지남 · 두 번 이상 · 배정 안 됨)', ['안 봄', '1~49%', '50%~', '완료', '본 횟수', '마감 지남', '두 번 이상', '배정 안 됨'].every((w) => g1.legend.indexOf(w) >= 0), g1.legend);

  /* ── 단원 접기 ── */
  await pg.click('#vod5-grid tr.vod6-unit[data-k="F1|U1"]'); await settle(60);
  let g2 = await read();
  const order2 = g2.rows.map((r) => r.u ? ('[' + r.u.split('|')[1] + ']') : r.v).join(' ');
  t('「집합」 눌러 접기 → V1·V2 줄 사라짐 · 단원 줄 ▸ · 단원 평균 24% 그대로', order2 === '[U1] [U2] V3 V5 [] V4' && /^▸/.test(g2.rows[0].txt) && /단원 평균 24%/.test(g2.rows[0].avg), order2 + ' ' + g2.rows[0].txt);
  t('접어도 학생 띠·머리줄 숫자 그대로 (전체 기준)', /평균 완료율 31%/.test(g2.head) && (g2.strip.filter((s) => s.c === 'AAA111')[0] || {}).asg === '2', g2.head);
  await pg.click('#vod5-grid tr.vod6-unit[data-k="F1|U1"]'); await settle(60);
  g2 = await read();
  t('다시 누르면 펼침 (V1·V2 돌아옴)', g2.rows.filter((r) => r.v === 'V1' || r.v === 'V2').length === 2 && /^▾/.test(g2.rows[0].txt));

  /* ── 칸 누르기 → 회차 창 ── */
  await pg.click('#vod5-grid .vod5-cell[data-vid="V1"][data-code="AAA111"]'); await settle(100);
  const d1 = await pg.evaluate(() => { const d = document.getElementById('vod5-detail'); if (!d) return null;
    const m = document.getElementById('vod6-main').getBoundingClientRect(), s = document.getElementById('vod6-side').getBoundingClientRect();
    return { when: [...d.querySelectorAll('.vod5-ses .vod5-when')].map((x) => x.textContent), bars: d.querySelectorAll('.vod5-ses .vod5-bar').length, short: d.querySelectorAll('.vod5-short').length,
      given: (d.querySelector('.vod5-given') || {}).textContent, txt: d.textContent, side: s.left >= m.right - 1 ? 'right' : 'below', mainW: Math.round(m.width), sideW: Math.round(s.width),
      sel: (document.querySelector('.vod5-cell[data-vid="V1"][data-code="AAA111"]') || {}).style.boxShadow || '' }; });
  t('회차 창 열림 · 회차 3개 최근 먼저 (10/15 → 10/12 → 10/10)', d1 && JSON.stringify(d1.when) === JSON.stringify(['10/15 (목) 19:05', '10/12 (월) 21:32', '10/10 (토) 20:00']), JSON.stringify(d1 && d1.when));
  t('회차 창 내용 v19-135 그대로 (막대 3 · 잠깐 열어봄 1 · 2회차/1회차 · 내준 날짜 기록 없음)', d1.bars === 3 && d1.short === 1 && /2회차10\/15/.test(d1.txt.replace(/\s/g, '')) && /1회차10\/10/.test(d1.txt.replace(/\s/g, '')) && d1.given === '기록 없음(v19-135 이전)', d1.txt.slice(0, 200));
  await settle(30);
  const ua = await pg.evaluate(() => { const tb = document.getElementById('vod6-tbl').getBoundingClientRect(); return [...document.querySelectorAll('.vod6-uavg')].map((x) => x.getBoundingClientRect().right <= tb.right + 1); });
  t('표가 옆으로 스크롤돼도 단원 평균 글자가 표 상자 안에 보임', ua.length === 3 && ua.every(Boolean), JSON.stringify(ua));
  t('누른 칸 표시(테두리 그림자)', /rgb\(13, 34, 64\)|#0d2240/.test(d1.sel), d1.sel);
  t('1200px 창(글씨 115% 기본)에서 회차 창은 표 오른쪽', d1.side === 'right', d1.side + ' · 표 ' + d1.mainW + 'px · 창 ' + d1.sideW + 'px');
  const ov = await pg.evaluate(() => { const de = document.documentElement, m = document.getElementById('vod5-map');
    return { sw: de.scrollWidth, cw: de.clientWidth, bsw: document.body.scrollWidth, msw: m.scrollWidth, mcw: m.clientWidth }; });
  t('1200px 가로 넘침 없음 (페이지 · 지도 영역) — 회차 창 열린 채', ov.sw <= ov.cw && ov.msw <= ov.mcw, JSON.stringify(ov));
  /* 글씨 130%(좁아짐) → 회차 창이 표 아래로 · 그래도 가로 넘침 없음 */
  const nar = await pg.evaluate(() => { fzSet('l'); render(); const m = document.getElementById('vod6-main').getBoundingClientRect(), s = document.getElementById('vod6-side').getBoundingClientRect();
    const de = document.documentElement, mp = document.getElementById('vod5-map'); const r = { below: s.top >= m.bottom - 1, sw: de.scrollWidth, cw: de.clientWidth, msw: mp.scrollWidth, mcw: mp.clientWidth };
    fzSet('m'); render(); return r; });
  t('글씨 130%: 회차 창이 표 아래로 내려옴 · 가로 넘침 없음', nar.below && nar.sw <= nar.cw && nar.msw <= nar.mcw, JSON.stringify(nar));
  /* 접은 단원 + 회차 창 → 그림 */
  await pg.click('#vod5-grid tr.vod6-unit[data-k="F1|U2"]'); await settle(80);
  t('회차 창 연 채로 「명제」 접기 → 창 그대로', !!(await pg.$('#vod5-detail')) && (await read()).rows.filter((r) => r.v === 'V3').length === 0);
  await pg.screenshot({ path: SP + '/v19136.png' });
  await pg.click('#vod5-grid tr.vod6-unit[data-k="F1|U2"]'); await settle(60);
  /* 같은 칸 다시 누르면 닫힘 */
  await pg.click('#vod5-grid .vod5-cell[data-vid="V1"][data-code="AAA111"]'); await settle(60);
  t('같은 칸 다시 누르면 회차 창 닫힘', !(await pg.$('#vod5-detail')));

  /* ── 묶음 고르기 ── */
  await pg.evaluate((id) => vod5Pick(id), b1.id); await settle(80);
  const g3 = await read();
  const order3 = g3.rows.map((r) => r.u ? ('[' + r.u.split('|')[1] + ']') : r.v).join(' ');
  t('묶음 고르면 그 영상만 (단원 묶음 그대로: [집합] V1 V2)', order3 === '[U1] V1 V2', order3);
  t('묶음 학생만 (BBB222, CCC333) · 띠도 2칸 · 칸 4개', g3.cols.join(',') === 'BBB222,CCC333' && g3.strip.length === 2 && g3.cells.length === 4, g3.cols.join(',') + ' / ' + g3.cells.length);
  t('묶음 머리줄 「📦 시험 묶음 A · 영상 2 · 배정 2명」 · 위에 묶음 내준 날짜·마감 상자', /📦 시험 묶음 A · 영상 2 · 배정 2명/.test(g3.head) && /내준 날짜/.test(await pg.evaluate(() => document.getElementById('vod5-map').textContent)), g3.head);
  t('묶음 안 V1 평균 (20+0)/2 = 10% · 단원 평균 (20+0+0+0)/4 = 5%', (g3.rows.filter((r) => r.v === 'V1')[0] || {}).avg === '10%' && /단원 평균 5%/.test(g3.rows[0].avg), JSON.stringify(g3.rows));
  await pg.click('#vod5-grid .vod5-cell[data-vid="V2"][data-code="BBB222"]'); await settle(80);
  const d2 = await pg.evaluate(() => { const d = document.getElementById('vod5-detail'); return d ? { given: (d.querySelector('.vod5-given') || {}).textContent, txt: d.textContent } : null; });
  const bWhen = await pg.evaluate((at) => vod5When(at), b1.at);
  t('묶음 칸 누르기 → 내준 날짜 「' + bWhen + '」 · 묶음 줄 · 지남 · 기록 없음', d2 && d2.given === bWhen && /📦 시험 묶음 A/.test(d2.txt) && /지남/.test(d2.txt) && /아직 시청 기록이 없습니다/.test(d2.txt), JSON.stringify(d2).slice(0, 200));
  await pg.evaluate(() => vod5Pick('')); await settle(60);
  t('폴더 전체로 돌아오면 줄 7개(단원 3 + 영상 5) 다시', (await read()).rows.length === 8);

  /* ── 학생이 많을 때(12명) 가로 넘침 · 표만 옆으로 스크롤 ── */
  const wide = await pg.evaluate(() => {
    const more = []; for (let i = 0; i < 12; i++) more.push({ id: 'X' + i, name: '○○' + i, grade: '중학교 1학년', group: '중1 C반', lumen_rec_code: 'X0000' + (i < 10 ? '0' : '') + i });
    const base = getSortedStudents(); window.getSortedStudents = () => base.concat(more);
    VOD_ASSIGN.V5 = { codes: more.map((s) => s.lumen_rec_code), due: '' }; vodSaveAssign();
    VOD5.open = { vid: 'V1', code: 'AAA111' }; render();
    const de = document.documentElement, m = document.getElementById('vod5-map'), tb = document.getElementById('vod6-tbl');
    return { cols: document.querySelectorAll('th.vod6-colh').length, sw: de.scrollWidth, cw: de.clientWidth, msw: m.scrollWidth, mcw: m.clientWidth, tsw: tb.scrollWidth, tcw: tb.clientWidth };
  });
  t('학생 16명: 페이지·지도 영역은 넘치지 않고 표 상자만 옆으로 스크롤', wide.cols === 16 && wide.sw <= wide.cw && wide.msw <= wide.mcw && wide.tsw > wide.tcw, JSON.stringify(wide));

  /* 다른 탭 그대로 */
  const other = await pg.evaluate(() => { VOD_MON_TAB = 'class'; render(); const a = document.getElementById('CONTENT').textContent; VOD_MON_TAB = 'video'; VOD_SEL_VIDEO = 'V1'; render(); const b = document.getElementById('CONTENT').textContent; VOD_MON_TAB = 'student'; VOD_MON_STU = 'AAA111'; render(); const c = [...document.querySelectorAll('.vod5-mini')].map((x) => x.textContent).join('|'); return { cls: /완료율/.test(a), vid: /구간 시청 맵/.test(b), stu: /회차 2 ↻/.test(c) }; });
  t('반별 · 영상별 · 학생별 탭 그대로', other.cls && other.vid && other.stu, JSON.stringify(other));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' · 실패 ' + fail);
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
