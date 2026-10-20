#!/usr/bin/env node
/* 학원앱 v19-135 검사 — 🎬 강의실 📦 묶음 배정 · 🗺 시청 지도 · 회차별 시청 기록
 *   (원장 2026-10-18 「학생이 동영상을 2번 이상 볼 수 있다 … 내가 영상을 내준 날짜와 학생이 시청한 날짜시간을 쉽게 확인」)
 *   ① 일괄 배정 창: «📦 묶음 이름»(기본 = 폴더 · 오늘) · 「📦 묶음으로 내주기」 → lumen_vod_bundles 한 건 + lumen_vod_assign(학생 합집합 · 마감) + lumen_vod_assign_at
 *   ② 영상 하나씩 체크(vodToggleAssign)도 내준 날짜를 남기고, 먼저 남은 날짜는 그대로
 *   ③ 시청 지도: 학생×영상 칸 · 칸 숫자 = 20초 이상 회차(3회 중 10초짜리 → 2) · 마감 지남 빨간 테두리 · ↻ · 학생앱 배정 모양 그대로
 *   ④ 칸 누르기 → 회차 목록(최근 먼저 · 날짜/시각) · 회차마다 구간 막대 · v19-135 전 배정 = 「기록 없음」
 *   ⑤ 서버에서 받을 때 합치기(서버에만 있는 묶음 유지 · 이 기기 것 우선 · 내준 날짜는 더 이른 쪽)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19135.js lumen_v19-135.html
 *   그림: $SP/v19135.png   가짜 서버 · 외부망 차단 · 한국 시각. 학생 실명 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-135.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-135'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STUDENTS = [
  { id: 'S1', name: '○○○', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'AAA111' },
  { id: 'S2', name: '○○○', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'BBB222' },
  { id: 'S3', name: '○○○', grade: '중학교 1학년', group: '중1 B반', lumen_rec_code: 'CCC333' },
  { id: 'S4', name: '○○○', grade: '중학교 2학년', group: '중2 A반', lumen_rec_code: 'DDD444' }];
const CATALOG = { folders: [{ id: 'F1', name: '공수2 집합', order: 0, completeThreshold: 90, seqOpen: false }], units: [],
  videos: [{ id: 'V1', folderId: 'F1', title: '집합 1강 p10 261001', youtubeId: 'aaaaaaaaaaa', durationSec: 600, order: 0, quiz: [] },
           { id: 'V2', folderId: 'F1', title: '집합 2강 p20 261005', youtubeId: 'bbbbbbbbbbb', durationSec: 600, order: 1, quiz: [] },
           { id: 'V3', folderId: 'F1', title: '집합 3강 p30 261008', youtubeId: 'ccccccccccc', durationSec: 600, order: 2, quiz: [] }] };
/* v19-135 전 배정 — 날짜 기록 없음 */
const ASSIGN0 = { V1: { codes: ['AAA111', 'BBB222'], due: '' } };
/* 시청 기록: AAA111×V1 = 3회차(그중 10초짜리 하나) + 다시 보내기로 생긴 같은 회차 중복 1줄 · BBB222×V1 = 1회차 */
const K = (s) => s;   /* 한국 시각 ISO */
const LOGS = [
  { id: 1, video_id: 'V1', student_code: 'AAA111', session_start: K('2026-10-10T20:00:00+09:00'), watched_sec: 300, max_position_sec: 300, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 0, end: 300, rate: 1 }], created_at: '2026-10-10T11:00:00Z' },
  { id: 2, video_id: 'V1', student_code: 'AAA111', session_start: K('2026-10-12T21:32:00+09:00'), watched_sec: 10, max_position_sec: 10, completed: false, playback_rate: 1, blur_count: 1, segments: [{ start: 0, end: 10, rate: 1 }], created_at: '2026-10-12T12:32:00Z' },
  { id: 3, video_id: 'V1', student_code: 'AAA111', session_start: K('2026-10-15T19:05:00+09:00'), watched_sec: 400, max_position_sec: 600, completed: true, playback_rate: 2, blur_count: 3, segments: [{ start: 200, end: 400, rate: 1 }, { start: 400, end: 600, rate: 2 }], created_at: '2026-10-15T10:05:00Z' },
  { id: 4, video_id: 'V1', student_code: 'AAA111', session_start: K('2026-10-15T19:05:00+09:00'), watched_sec: 150, max_position_sec: 350, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 200, end: 350, rate: 1 }], created_at: '2026-10-15T10:06:00Z' },
  { id: 5, video_id: 'V1', student_code: 'BBB222', session_start: K('2026-10-16T18:00:00+09:00'), watched_sec: 120, max_position_sec: 120, completed: false, playback_rate: 1, blur_count: 0, segments: [{ start: 0, end: 120, rate: 1 }], created_at: '2026-10-16T09:00:00Z' }];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, CATALOG, ASSIGN0, LOGS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.T = { store: {}, logs: LOGS, sync: [], toasts: [] };
    /* 가짜 서버: 어떤 표든 select/order/in/eq/not 이어 붙이고 await 하면 결과 */
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
    scheduleSync = (function () { return function (k) { T.sync.push(k); }; })();   /* 서버로 올라가는 키만 기록 */
    const _vt = vodToast; vodToast = function (m) { T.toasts.push(m); };
    localStorage.setItem('lumen_vod_catalog', JSON.stringify(CATALOG));
    localStorage.setItem('lumen_vod_assign', JSON.stringify(ASSIGN0));
    localStorage.removeItem('lumen_vod_bundles'); localStorage.removeItem('lumen_vod_assign_at');
    VOD_CATALOG = null; VOD_ASSIGN = null; VOD_LOGS = null; VOD5.bundles = null; VOD5.at = null; VOD5.sel = ''; VOD5.open = null;
    T.sync.length = 0;
  }, { STUDENTS, CATALOG, ASSIGN0, LOGS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 120)), ms);
  const ls = (k) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('SYNC_KEYS 에 lumen_vod_bundles · lumen_vod_assign_at (기존 lumen_vod_assign 그대로)', await pg.evaluate(() => SYNC_KEYS.indexOf('lumen_vod_bundles') >= 0 && SYNC_KEYS.indexOf('lumen_vod_assign_at') >= 0 && SYNC_KEYS.indexOf('lumen_vod_assign') >= 0));
  t('모니터링 첫 탭 = 시청 지도 (VOD_MON_TAB map)', await pg.evaluate(() => VOD_MON_TAB === 'map'));

  /* ── ① 묶음 배정 ── */
  await pg.evaluate(() => { VIEW = 'vod'; VOD_MODE = 'manage'; VOD_SEL_FOLDER = 'F1'; render(); vodBulkToggleVideo('V1'); vodBulkToggleVideo('V2'); vodBulkOpen(); });
  await settle(80);
  const today = await pg.evaluate(() => { const d = new Date(); return (d.getMonth() + 1) + '/' + d.getDate(); });
  const yday = await pg.evaluate(() => { const d = new Date(Date.now() - 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const m1 = await pg.evaluate(() => { const i = document.getElementById('vod5-bname'), b = document.getElementById('vod5-bapply');
    return { val: i && i.value, btn: b && b.textContent, old: !!document.querySelector('button[onclick="vodBulkApply()"]'), due: !!document.querySelector('input[type=date]') }; });
  t('일괄 배정 창에 «📦 묶음 이름» 기본값 「공수2 집합 · ' + today + '」 · 확인 단추 「📦 묶음으로 내주기」 (옛 단추 대신) · 마감일 칸 그대로',
    m1.val === '공수2 집합 · ' + today && /📦 묶음으로 내주기/.test(m1.btn || '') && !m1.old && m1.due, JSON.stringify(m1));
  await pg.evaluate((yday) => { vodBulkToggleStu('BBB222'); vodBulkToggleStu('CCC333'); VOD_BULK_DUE = yday; }, yday);
  await settle(50);
  t('학생 고른 뒤 다시 그려도 묶음 이름 칸 유지 · 단추에 「2명 · 영상 2개」', await pg.evaluate(() => /2명 · 영상 2개/.test(document.getElementById('vod5-bapply').textContent) && !!document.getElementById('vod5-bname')));
  await pg.fill('#vod5-bname', '시험 묶음 A'); await pg.click('#vod5-bapply'); await settle(80);
  const B1 = await ls('lumen_vod_bundles'), A1 = await ls('lumen_vod_assign'), AT1 = await ls('lumen_vod_assign_at');
  const b1 = B1 && B1.bundles && B1.bundles[0];
  t('lumen_vod_bundles 에 묶음 1건 {name, folderId F1, vids [V1,V2], codes [BBB222,CCC333], due 어제, at ISO, by teacher}',
    B1 && B1.bundles.length === 1 && b1.name === '시험 묶음 A' && b1.folderId === 'F1' && JSON.stringify(b1.vids) === '["V1","V2"]' && JSON.stringify(b1.codes) === '["BBB222","CCC333"]' && b1.due === yday && /^\d{4}-\d\d-\d\dT/.test(b1.at) && b1.by === 'teacher', JSON.stringify(B1));
  t('lumen_vod_assign: V1 학생 합집합 [AAA111,BBB222,CCC333] · V2 [BBB222,CCC333] · 마감 = 어제',
    JSON.stringify(A1.V1.codes) === '["AAA111","BBB222","CCC333"]' && JSON.stringify(A1.V2.codes) === '["BBB222","CCC333"]' && A1.V1.due === yday && A1.V2.due === yday, JSON.stringify(A1));
  t('학생앱이 읽는 배정 모양 그대로 (영상마다 codes·due 두 칸만)', Object.keys(A1).every((k) => JSON.stringify(Object.keys(A1[k]).sort()) === '["codes","due"]'), JSON.stringify(A1));
  t('lumen_vod_assign_at: 새로 받은 쌍(V1·CCC333, V2·BBB222, V2·CCC333) = 묶음 시각 · 예전부터 배정된 V1·AAA111/BBB222 는 날짜 없음',
    AT1 && AT1.V1.CCC333 === b1.at && AT1.V2.BBB222 === b1.at && AT1.V2.CCC333 === b1.at && !AT1.V1.AAA111 && !AT1.V1.BBB222, JSON.stringify(AT1));
  const s1 = await pg.evaluate(() => ({ sync: T.sync.slice(), toast: T.toasts.slice(-1)[0], open: VOD_BULK_OPEN, sel: VOD5.sel, vsel: Object.keys(VOD_VSEL).length }));
  t('서버로 올릴 키 3개(배정·묶음·내준 날짜) · 창 닫힘 · 선택 비움 · 토스트 · 지도가 이 묶음을 고름',
    ['lumen_vod_assign', 'lumen_vod_bundles', 'lumen_vod_assign_at'].every((k) => s1.sync.indexOf(k) >= 0) && !s1.open && s1.vsel === 0 && /시험 묶음 A/.test(s1.toast) && s1.sel === b1.id, JSON.stringify(s1));

  /* ── ② 영상 하나씩 체크 ── */
  await pg.evaluate(() => { vodToggleAssign('V3', 'DDD444'); });
  const at2 = (await ls('lumen_vod_assign_at')).V3;
  t('vodToggleAssign(V3, DDD444) → 내준 날짜 기록 · 배정도 됨', at2 && /^\d{4}-/.test(at2.DDD444) && (await ls('lumen_vod_assign')).V3.codes.indexOf('DDD444') >= 0, JSON.stringify(at2));
  await pg.evaluate(() => { const A = JSON.parse(localStorage.getItem('lumen_vod_assign_at')); A.V3.DDD444 = '2026-10-01T01:00:00.000Z'; localStorage.setItem('lumen_vod_assign_at', JSON.stringify(A)); VOD5.at = null;
    vodToggleAssign('V3', 'DDD444'); vodToggleAssign('V3', 'DDD444'); });
  const at3 = (await ls('lumen_vod_assign_at')).V3.DDD444, as3 = (await ls('lumen_vod_assign')).V3.codes;
  t('해제 → 다시 배정해도 먼저 남은 날짜(10/1) 그대로', at3 === '2026-10-01T01:00:00.000Z' && as3.indexOf('DDD444') >= 0, at3);
  /* 예전 일괄 배정 함수(vodBulkApply)도 날짜를 남긴다 */
  await pg.evaluate(() => { VOD_VSEL = { V3: true }; VOD_BULK_PICK = { CCC333: true }; VOD_BULK_DUE = ''; VOD_BULK_OPEN = true; vodBulkApply(); });
  t('예전 vodBulkApply 로 배정해도 V3·CCC333 내준 날짜 기록', /^\d{4}-/.test(((await ls('lumen_vod_assign_at')).V3 || {}).CCC333 || ''));

  /* ── ③ 시청 지도 ── */
  await pg.evaluate(() => { VOD_MODE = 'monitor'; VOD_MON_TAB = 'map'; VOD5.sel = ''; VOD_LOGS = null; render(); });
  await settle(250);
  const g1 = await pg.evaluate(() => {
    const tabs = [...document.querySelectorAll('button[onclick^="vodMonSetTab"]')].map((b) => b.textContent);
    const cells = [...document.querySelectorAll('#vod5-grid .vod5-cell')].map((c) => ({ v: c.dataset.vid, c: c.dataset.code, n: c.dataset.n, txt: c.textContent, late: c.dataset.late, re: c.dataset.re, na: c.classList.contains('vod5-na'), bd: c.style.borderColor || c.style.border, title: c.title }));
    return { tabs, cells, rows: document.querySelectorAll('#vod5-grid tr').length, sel: (document.getElementById('vod5-sel') || {}).value, legend: (document.getElementById('vod5-legend') || {}).textContent || '' };
  });
  t('탭 순서: 🗺 시청 지도 · 👤 학생별 · 🎬 영상별 · 🏫 반별', g1.tabs.join('|') === '🗺 시청 지도|👤 학생별|🎬 영상별|🏫 반별', g1.tabs.join('|'));
  const cell = (v, c) => g1.cells.filter((x) => x.v === v && x.c === c)[0] || {};
  t('폴더 전체: 학생 4줄 × 영상 3칸 (머리 1줄 + 4줄) · 칸 12개', g1.rows === 5 && g1.cells.length === 12, g1.rows + ' / ' + g1.cells.length);
  const a1 = cell('V1', 'AAA111');
  t('AAA111×V1: 3회차 중 10초짜리 빼고 «2» · 중복 줄은 하나로 · ↻ 표시 · 완료(초록) · 마감 지남이어도 완료라 테두리 없음',
    a1.n === '2' && /^2↻$/.test(a1.txt) && a1.re === '1' && a1.late === '0', JSON.stringify(a1));
  const bb = cell('V1', 'BBB222'), cc = cell('V2', 'CCC333');
  t('BBB222×V1: 1회차 «1» · ↻ 없음 · 마감(어제) 지남·미완료 → 빨간 테두리', bb.n === '1' && bb.re === '0' && bb.late === '1' && /220, 38, 38|dc2626/.test(bb.bd), JSON.stringify(bb));
  t('CCC333×V2: 안 봄 → 빈 칸 · 빨간 테두리', cc.n === '0' && cc.txt === '' && cc.late === '1', JSON.stringify(cc));
  t('배정 안 된 칸(AAA111×V2)은 «·»', cell('V2', 'AAA111').na && cell('V2', 'AAA111').txt === '·', JSON.stringify(cell('V2', 'AAA111')));
  t('칸 말풍선: 내준 날짜 · 마감 · 마지막 시청 (예전 배정 = 기록 없음)', /내준 날짜: 기록 없음\(v19-135 이전\)/.test(a1.title) && /마지막 시청: 10\/15 \(목\) 19:05/.test(a1.title) && /마감: /.test(bb.title), a1.title);
  t('범례 (안 봄 · 1~49% · 50%~ · 완료 · 숫자 = 본 횟수 · 마감 지남 · ↻)', /안 봄/.test(g1.legend) && /본 횟수/.test(g1.legend) && /마감 지남/.test(g1.legend) && /두 번 이상/.test(g1.legend), g1.legend);
  const hd = await pg.evaluate(() => [...document.querySelectorAll('#vod5-grid th.vod5-col')].map((h) => h.textContent));
  t('열 머리에 평균 % (V1: (100+20+0)/3 = 40%)', /평균 40%/.test(hd[0] || ''), JSON.stringify(hd));
  const rowEnd = await pg.evaluate(() => [...document.querySelectorAll('#vod5-grid tr')].slice(1).map((r) => r.lastElementChild.textContent));
  t('줄 끝 완료/배정 (AAA111 1/1 포함)', rowEnd.indexOf('1/1') >= 0, JSON.stringify(rowEnd));

  /* 묶음 고르기 */
  await pg.evaluate((id) => vod5Pick(id), b1.id); await settle(60);
  const g2 = await pg.evaluate(() => ({ opts: [...document.querySelectorAll('#vod5-sel option')].map((o) => o.textContent), cells: document.querySelectorAll('#vod5-grid .vod5-cell').length, txt: document.getElementById('vod5-map').textContent }));
  t('묶음 고르기: 목록에 「📦 시험 묶음 A · 날짜 내줌 · 영상 2 · 학생 2」 · 지도 2명 × 2영상 · 위에 내준 날짜·마감',
    g2.opts.some((o) => /📦 시험 묶음 A · \d+\/\d+ \(.\) \d\d:\d\d 내줌 · 영상 2 · 학생 2/.test(o)) && g2.cells === 4 && /내준 날짜/.test(g2.txt) && /마감/.test(g2.txt), JSON.stringify(g2.opts) + ' ' + g2.cells);

  /* ── ④ 칸 누르기 → 회차 상세 ── */
  await pg.evaluate(() => vod5Pick('')); await settle(40);
  await pg.click('#vod5-grid .vod5-cell[data-vid="V1"][data-code="AAA111"]'); await settle(80);
  const d1 = await pg.evaluate(() => { const d = document.getElementById('vod5-detail'); if (!d) return null;
    return { when: [...d.querySelectorAll('.vod5-ses .vod5-when')].map((x) => x.textContent), bars: d.querySelectorAll('.vod5-ses .vod5-bar').length, segs: [...d.querySelectorAll('.vod5-ses')].map((s) => s.querySelectorAll('.vod5-seg').length),
      short: d.querySelectorAll('.vod5-short').length, given: (d.querySelector('.vod5-given') || {}).textContent, txt: d.textContent }; });
  t('상세 열림 · 회차 3개 최근 먼저 (10/15 → 10/12 → 10/10 · 날짜/요일/시각)', d1 && JSON.stringify(d1.when) === JSON.stringify(['10/15 (목) 19:05', '10/12 (월) 21:32', '10/10 (토) 20:00']), JSON.stringify(d1 && d1.when));
  t('회차마다 구간 막대 하나 (3개) · 10/15 회차는 구간 2개 · 10초짜리는 «잠깐 열어봄»(흐리게)', d1.bars === 3 && d1.segs[0] === 2 && d1.short === 1 && /잠깐 열어봄/.test(d1.txt), JSON.stringify(d1.segs) + ' short ' + d1.short);
  t('회차 번호: 최근 = 2회차 · 첫 회 = 1회차 · 본 길이/가장 멀리/배속/이탈', /2회차10\/15/.test(d1.txt.replace(/\s/g, '')) && /1회차10\/10/.test(d1.txt.replace(/\s/g, '')) && /본 길이 6:40/.test(d1.txt) && /가장 멀리 10:00/.test(d1.txt) && /배속 ×2/.test(d1.txt) && /이탈 3회/.test(d1.txt), d1.txt.slice(0, 400));
  t('v19-135 전 배정 → 내준 날짜 「기록 없음(v19-135 이전)」', d1.given === '기록 없음(v19-135 이전)', d1.given);
  /* 묶음으로 새로 받은 학생 칸: 내준 날짜 = 묶음 시각 · 묶음 줄 */
  await pg.click('#vod5-grid .vod5-cell[data-vid="V2"][data-code="BBB222"]'); await settle(60);
  const d2 = await pg.evaluate(() => { const d = document.getElementById('vod5-detail'); return { given: (d.querySelector('.vod5-given') || {}).textContent, txt: d.textContent }; });
  const bWhen = await pg.evaluate((at) => vod5When(at), b1.at);
  t('묶음으로 새로 받은 칸: 내준 날짜 = 묶음 시각 「' + bWhen + '」 · 묶음 줄 · 마감 지남 · 아직 기록 없음', d2.given === bWhen && /📦 시험 묶음 A/.test(d2.txt) && /지남/.test(d2.txt) && /아직 시청 기록이 없습니다/.test(d2.txt), JSON.stringify(d2).slice(0, 300));
  await pg.click('#vod5-grid .vod5-cell[data-vid="V1"][data-code="AAA111"]'); await settle(80);
  await pg.screenshot({ path: SP + '/v19135.png' });
  /* 학생별 탭에 회차 · 마지막 시각 */
  await pg.evaluate(() => { VOD_MON_TAB = 'student'; VOD_MON_STU = 'AAA111'; render(); }); await settle(60);
  const mini = await pg.evaluate(() => [...document.querySelectorAll('.vod5-mini')].map((x) => x.textContent));
  t('학생별 탭 펼친 줄: 「회차 2 ↻ · 10/15 (목) 19:05」', mini.some((x) => /회차 2 ↻ · 10\/15 \(목\) 19:05/.test(x)), JSON.stringify(mini));
  /* 다른 탭 그대로 */
  const other = await pg.evaluate(() => { VOD_MON_TAB = 'class'; render(); const a = document.getElementById('CONTENT').textContent; VOD_MON_TAB = 'video'; VOD_SEL_VIDEO = 'V1'; render(); const b = document.getElementById('CONTENT').textContent; return { cls: /완료율/.test(a), vid: /구간 시청 맵/.test(b) }; });
  t('반별 · 영상별 탭은 예전 그대로 그려짐', other.cls && other.vid, JSON.stringify(other));

  /* ── ⑤ 서버에서 받을 때 합치기 ── */
  const mg = await pg.evaluate(async (b1id) => {
    T.sync.length = 0;
    T.store = {
      lumen_vod_bundles: { bundles: [{ id: 'vb_cloud', name: '다른 기기 묶음', folderId: 'F1', vids: ['V3'], codes: ['DDD444'], due: '', at: '2026-10-05T03:00:00.000Z', by: 'teacher' },
                                     { id: b1id, name: '옛 이름', folderId: 'F1', vids: ['V1'], codes: ['BBB222'], due: '', at: '2026-10-01T00:00:00.000Z', by: 'teacher' }] },
      lumen_vod_assign_at: { V1: { CCC333: '2026-10-02T00:00:00.000Z' }, V9: { EEE555: '2026-10-03T00:00:00.000Z' } } };
    const ok = await supaFullPull(['lumen_vod_bundles', 'lumen_vod_assign_at']);
    const B = JSON.parse(localStorage.getItem('lumen_vod_bundles')), A = JSON.parse(localStorage.getItem('lumen_vod_assign_at'));
    return { ok, ids: B.bundles.map((b) => b.id), mine: B.bundles.filter((b) => b.id === b1id)[0].name, A, sync: T.sync.slice(), mem: VOD5.bundles === null || vod5Bundles().length === 2 };
  }, b1.id);
  t('받기: 서버에만 있던 묶음(vb_cloud) 유지 · 같은 id 는 이 기기 것(이름 「시험 묶음 A」)', mg.ok && mg.ids.length === 2 && mg.ids.indexOf('vb_cloud') >= 0 && mg.mine === '시험 묶음 A' && mg.mem, JSON.stringify(mg).slice(0, 300));
  t('받기: 내준 날짜는 더 이른 쪽 (V1·CCC333 = 서버 10/2) · 서버에만 있던 V9 유지 · 이 기기에만 있던 V2·V3 유지',
    mg.A.V1.CCC333 === '2026-10-02T00:00:00.000Z' && mg.A.V9.EEE555 && mg.A.V2.BBB222 === b1.at && mg.A.V3.DDD444 === '2026-10-01T01:00:00.000Z', JSON.stringify(mg.A));
  t('받기: 이 기기에만 있던 것이 있으면 다시 올림(내준 날짜) · 묶음은 서버에 다 있으니 안 올림', mg.sync.indexOf('lumen_vod_assign_at') >= 0 && mg.sync.indexOf('lumen_vod_bundles') < 0, JSON.stringify(mg.sync));
  const mg2 = await pg.evaluate(() => { const r = vod5MergeBundlesObj({ bundles: [{ id: 'x1' }] }, { bundles: [{ id: 'x1' }, { id: 'x2' }] }); return r.obj.bundles.length === 2 && !r.extra; });
  t('묶음 합치기 함수: 합집합 · 이 기기에 새 것 없으면 extra=false', mg2);

  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' · 실패 ' + fail);
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
