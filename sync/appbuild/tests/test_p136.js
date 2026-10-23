#!/usr/bin/env node
/* 학부모앱 v1-36 검사 — 🎙 녹음 숙제 «그날 주제 · ✓ 선생님 확인 · 한마디» (계약서 docs/rec_review_contract.md §4)
 *   가짜 서버(lumen_store · storage.list) · 외부망 차단 · 가짜 이름(홍길동 AAA111 · 박하나 BBB222) · 폰 화면
 *   지금 = 2026-10-21(수) 23:00 한국 시각 · 반 T5 = 월수금
 *   ① 홈 매일 확인 녹음 칸: ✓ 선생님 확인 · 💬 그날 주제(확인 때 복사한 주제가 rec_topics 보다 먼저)
 *   ② 숙제 탭: 노란 오늘 주제 · «제출 완료 · ✓ 선생님이 들었어요» + 3분 42초 · 파란 한마디 · 🔒 안내
 *   ③ 녹음 제출 기록: 통계(30일 4 · 연속 4 · 확인 2) · 목록(확인/확인 전 · 주제 우선순위 · 자유 제출 · 길이 · 한마디)
 *   녹음: 10/21(수 · 확인) · 10/19(월) · 10/16(금 · 확인 · 자유) · 10/14(수) → 월수금 4회 연속
 *   ④ 확인 전 모양(회색) · 미제출 모양(주황) · 미션 우선
 *   ⑤ <audio 0개 · rec_read_* 키를 읽지 않음 · 다른 학생 전문이 화면에 없음 · 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_p136.js parent_v1-36.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'parent_v1-36.html');
const SHOT = process.env.P136_SHOT || '';   // 화면 그림을 남길 폴더(선택)
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.clock.setFixedTime(new Date('2026-10-21T23:00:00+09:00'));
  await pg.addInitScript(() => {
    window.__KEYS = []; window.__LIKE = []; window.__LIST = []; window.__W = [];
    window.__STORE = {
      or_studentdb: [
        { id: 's1', name: '홍길동', lumen_rec_code: 'AAA111', grade: '중학교 2학년', group: 'T5' },
        { id: 's2', name: '박하나', lumen_rec_code: 'BBB222', grade: '중학교 2학년', group: 'T5' }],
      lumen_group_days: { T5: [1, 3, 5] },
      rec_topics: {
        byGrade: { '중2': {
          '2026.10.21': { t: '학년 주제 1021 (확인 칸이 먼저여야 함)' },
          '2026.10.19': { t: '연립방정식 가감법과 대입법 차이 설명해 보기' },
          '2026.10.13': { t: '학년 주제 1013' } } },
        byStudent: { AAA111: { '2026.10.11': { t: '개인 주제 — 일차함수와 정비례의 관계' } } } },
      rec_review_AAA111: { updated: '2026-10-21T13:30:00Z', byDate: {
        '2026-10-21': { file: 'AAA111_20261021_2130.webm', ok: true, at: '2026-10-21T13:30:00Z', msg: '기울기를 예시로 잘 풀어 설명했어요. 다음엔 y절편까지 같이!', sec: 222, topic: { t: '일차함수의 기울기와 y절편 설명해 보기', src: 'grade' } },
        '2026-10-16': { file: 'AAA111_20261016_2200.m4a', ok: true, at: '2026-10-17T00:10:00Z', msg: '', sec: 250, topic: { t: '', src: 'free' } } } },
      rec_review_BBB222: { byDate: { '2026-10-21': { ok: true, msg: '박하나한마디비밀', sec: 100 } } },
      'rec_read_2026-10-21': { date: '2026-10-21', items: { BBB222: [{ file: 'BBB222_20261021_2000.webm', stt: '박하나비밀전문입니다', summary: '박하나요약' }] } },
      rec_read_last: { at: '2026-10-21T20:14:00Z', dates: ['2026-10-21'] } };
    const FILES = { AAA111: [
      { name: 'AAA111_20261021_2130.webm', created_at: '2026-10-21T12:31:00Z' },
      { name: 'AAA111_20261019_2100.webm', created_at: '2026-10-19T12:01:00Z' },
      { name: 'AAA111_20261016_2200.m4a', created_at: '2026-10-16T13:01:00Z' },
      { name: 'AAA111_20261014_2000.webm', created_at: '2026-10-14T11:01:00Z' }],
      BBB222: [{ name: 'BBB222_20261021_2000.webm', created_at: '2026-10-21T11:00:00Z' }] };
    const mk = (tbl) => { const b = { f: [], op: 'select', one: false,
      select() { return b; }, eq(k, v) { if (k === 'key') { window.__KEYS.push(v); b.f.push((x) => x === v); } return b; },
      in(k, a) { if (k === 'key') { a.forEach((x) => window.__KEYS.push(x)); b.f.push((x) => a.indexOf(x) >= 0); } return b; },
      like(k, p) { window.__LIKE.push(p); const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); b.f.push((x) => re.test(x)); return b; },
      ilike() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; }, filter() { return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; },
      update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; }, insert() { return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => window.__W.push(r.key)); return Promise.resolve({ error: null }); },
      then(r, j) { let data = [];
        if (tbl === 'lumen_store' && b.op === 'select') data = Object.keys(window.__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) }));
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
  t('버전 v1-36', (await pg.evaluate(() => PAR_VER)) === 'v1-36' && (await pg.title()).indexOf('v1-36') >= 0);
  // 로그인 — 코드 입력 → 「우리 아이 보러가기」
  await pg.fill('#pcode', 'AAA111'); await pg.click('.login button'); await pg.waitForTimeout(900);
  t('로그인 · 홍길동 화면', await pg.evaluate(() => !!(P.st && P.st.name === '홍길동' && P.tab === 'home')));
  t('읽기: rec_topics · rec_review_AAA111 (q1)', await pg.evaluate(() => __KEYS.indexOf('rec_topics') >= 0 && __KEYS.indexOf('rec_review_AAA111') >= 0 && !!P.rtop && !!P.rrev), JSON.stringify(await pg.evaluate(() => __KEYS)));
  t('학년 키 중2', (await pg.evaluate(() => p36Gk())) === '중2');
  const noAudio = async (where) => t(where + ': <audio 0개', await pg.evaluate(() => document.querySelectorAll('audio,video').length === 0 && document.getElementById('app').innerHTML.indexOf('<audio') < 0));
  const shot = async (n) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, n + '.png'), fullPage: true }); } };

  // ① 홈
  const home = await pg.evaluate(() => { const b = document.querySelectorAll('.p35two .p35box')[1]; return b ? { cls: b.className, big: b.querySelector('.big').textContent, sub: b.querySelector('.sub').textContent, tp: (b.querySelector('.p36tp') || {}).textContent || '' } : null; });
  t('① 홈 녹음 칸: 오늘 제출 · 🔥 4회 연속 · ✓ 선생님 확인', !!home && home.big.indexOf('오늘 제출') >= 0 && home.sub.indexOf('4회 연속') >= 0 && home.sub.indexOf('✓ 선생님 확인') >= 0, JSON.stringify(home));
  t('① 홈 💬 그날 주제 = 확인 때 복사한 주제', !!home && home.tp === '💬 일차함수의 기울기와 y절편 설명해 보기', JSON.stringify(home));
  t('① 홈 플래너 칸은 그대로(주제 줄 없음)', await pg.evaluate(() => !document.querySelectorAll('.p35two .p35box')[0].querySelector('.p36tp')));
  await noAudio('① 홈'); await shot('1_home');

  // ② 숙제 탭
  await pg.evaluate(() => goTab('hw')); await pg.waitForTimeout(150);
  const hw = await pg.evaluate(() => { const g = (s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }; return { topic: g('.p36topic'), st: g('.p36st'), stc: (document.querySelector('.p36st') || {}).className || '', say: g('.p36say'), app: document.getElementById('app').textContent }; });
  t('② 노란 오늘 주제', hw.topic.indexOf('10/21 (수) 오늘 주제') >= 0 && hw.topic.indexOf('일차함수의 기울기와 y절편 설명해 보기') >= 0, hw.topic);
  t('② 제출 완료 · ✓ 선생님이 들었어요 · 3분 42초', hw.stc.indexOf('ok') >= 0 && hw.st.indexOf('제출 완료 · ✓ 선생님이 들었어요') >= 0 && hw.st.indexOf('3분 42초 · 오늘도 스스로 설명해 봤어요') >= 0, hw.st);
  t('② 파란 한마디 · 선생님 한마디 · 10/21 저녁', hw.say.indexOf('기울기를 예시로 잘 풀어 설명했어요') >= 0 && hw.say.indexOf('— 선생님 한마디 · 10/21 저녁') >= 0, hw.say);
  t('② 2주 띠 · 🔒 비공개 안내', hw.app.indexOf('최근 2주 제출 현황') >= 0 && hw.app.indexOf('🔒 녹음 소리는 선생님만 듣습니다') >= 0 && hw.app.indexOf('주제와 선생님 한마디만 보여 드려요') >= 0);
  await noAudio('② 숙제'); await shot('2_hw');

  // ③ 녹음 제출 기록
  await pg.evaluate(() => goTab('rec')); await pg.waitForTimeout(150);
  const rc = await pg.evaluate(() => ({ lock: (document.querySelector('.p36lock') || {}).textContent || '',
    stats: Array.from(document.querySelectorAll('.p36stats>div')).map((d) => d.textContent),
    items: Array.from(document.querySelectorAll('.p36item')).map((d) => ({ r1: d.querySelector('.r1').textContent, r2: d.querySelector('.r2').textContent, r3: (d.querySelector('.r3') || {}).textContent || '' })),
    app: document.getElementById('app').textContent }));
  t('③ 안내문(소리 비공개 · 한마디와 주제만)', rc.lock.indexOf('녹음 소리는 공개하지 않습니다') >= 0 && rc.lock.indexOf('선생님이 듣고 남긴 한마디와 그날 주제만') >= 0, rc.lock);
  t('③ 통계 30일 4회 · 연속 🔥4회 · 선생님 확인 2회', rc.stats.length === 3 && rc.stats[0] === '최근 30일 제출4회' && rc.stats[1] === '연속 제출🔥4회' && rc.stats[2] === '선생님 확인2회', JSON.stringify(rc.stats));
  const it = rc.items;
  t('③ 목록 4줄 · 최근 것부터', it.length === 4 && it[0].r1.indexOf('2026.10.21 (수)') >= 0 && it[3].r1.indexOf('2026.10.14 (수)') >= 0, JSON.stringify(it.map((x) => x.r1)));
  t('③ 10.21 ✓ 확인 · 복사된 주제 · 3분 42초 · 💬', !!it[0] && it[0].r1.indexOf('✓ 선생님 확인') >= 0 && it[0].r2 === '일차함수의 기울기와 y절편 설명해 보기 · 3분 42초' && it[0].r3.indexOf('💬 기울기를') === 0, JSON.stringify(it[0]));
  t('③ 10.19 확인 전 · 학년 주제 · 길이·한마디 없음', !!it[1] && it[1].r1.indexOf('확인 전') >= 0 && it[1].r2 === '연립방정식 가감법과 대입법 차이 설명해 보기' && !it[1].r3, JSON.stringify(it[1]));
  t('③ 10.16 ✓ 확인 · 자유 제출 · 4분 10초 · 한마디 비면 줄 없음', !!it[2] && it[2].r1.indexOf('✓ 선생님 확인') >= 0 && it[2].r2 === '자유 제출 · 4분 10초' && !it[2].r3, JSON.stringify(it[2]));
  t('③ 10.14 확인 전 · 개인 주제(10.11)가 학년 주제(10.13)보다 먼저', !!it[3] && it[3].r1.indexOf('확인 전') >= 0 && it[3].r2 === '개인 주제 — 일차함수와 정비례의 관계', JSON.stringify(it[3]));
  t('③ 5주 달력 그대로', rc.app.indexOf('최근 5주 제출 달력') >= 0);
  await noAudio('③ 기록'); await shot('3_rec');

  // ④ 확인 전 · 미제출 · 미션
  await pg.evaluate(() => { delete P.rrev.byDate['2026-10-21']; goTab('hw'); }); await pg.waitForTimeout(100);
  const w = await pg.evaluate(() => ({ stc: (document.querySelector('.p36st') || {}).className || '', st: (document.querySelector('.p36st') || {}).textContent || '', topic: (document.querySelector('.p36topic') || {}).textContent || '', say: !!document.querySelector('.p36say') }));
  t('④ 확인 전: 회색 «제출 완료 · 선생님 확인 전»', w.stc.indexOf('wait') >= 0 && w.st.indexOf('제출 완료 · 선생님 확인 전') >= 0, JSON.stringify(w));
  t('④ 확인 전: 주제는 rec_topics 학년 주제 · 한마디 칸 없음', w.topic.indexOf('학년 주제 1021') >= 0 && !w.say, JSON.stringify(w));
  await shot('4_hw_wait');
  await pg.evaluate(() => goTab('home')); await pg.waitForTimeout(80);
  t('④ 확인 전: 홈 녹음 칸에 «선생님 확인» 없음', await pg.evaluate(() => { const b = document.querySelectorAll('.p35two .p35box')[1]; return b.textContent.indexOf('선생님 확인') < 0 && b.querySelector('.p36tp').textContent.indexOf('학년 주제 1021') >= 0; }));
  await pg.evaluate(() => { P.recs = P.recs.filter((f) => f.name.indexOf('20261021') < 0); goTab('hw'); }); await pg.waitForTimeout(80);
  const n = await pg.evaluate(() => ({ stc: (document.querySelector('.p36st') || {}).className || '', st: (document.querySelector('.p36st') || {}).textContent || '' }));
  t('④ 미제출: 주황 «오늘 녹음이 아직 제출 전이에요»', n.stc.indexOf('no') >= 0 && n.st.indexOf('오늘 녹음이 아직 제출 전이에요') >= 0, JSON.stringify(n));
  await noAudio('④ 미제출'); await shot('5_hw_none');
  t('④ 미션이 개인·학년보다 먼저 · 확인된 날은 복사한 주제', await pg.evaluate(() => { P.st.lumen_rec_mission = '미션: 함수의 뜻 설명'; const a = p36Topic('2026-10-19'), b = p36Topic('2026-10-14'), c = p36Topic('2026-10-16'); P.st.lumen_rec_mission = ''; return a === '미션: 함수의 뜻 설명' && b === a && c === ''; }));
  t('④ 7일 안 가장 가까운 지난 날짜 · 7일 넘으면 없음', await pg.evaluate(() => p36Topic('2026-10-20') === '연립방정식 가감법과 대입법 차이 설명해 보기' && p36Topic('2026-10-10') === '' ));
  t('④ 주제·확인 칸이 없어도 오류 없이 그림', await pg.evaluate(() => { const a = P.rtop, b = P.rrev; P.rtop = null; P.rrev = null; goTab('rec'); const ok = document.querySelectorAll('.p36item').length === 3 && document.querySelector('.p36stats').textContent.indexOf('선생님 확인0회') >= 0; goTab('hw'); const ok2 = !document.querySelector('.p36topic'); P.rtop = a; P.rrev = b; return ok && ok2; }));

  // ⑤ 안전
  const keys = await pg.evaluate(() => __KEYS.concat(__LIKE));
  t('⑤ rec_read_* 키를 읽지 않음', keys.every((k) => String(k).indexOf('rec_read_') !== 0 && String(k).indexOf('rec_read') < 0), JSON.stringify(keys));
  t('⑤ 다른 학생 확인 칸(rec_review_BBB222)을 읽지 않음', keys.indexOf('rec_review_BBB222') < 0);
  t('⑤ 녹음 목록은 내 아이 폴더만', JSON.stringify(await pg.evaluate(() => __LIST)) === JSON.stringify(['recordings:AAA111']), JSON.stringify(await pg.evaluate(() => __LIST)));
  t('⑤ 다른 학생 전문·한마디가 화면·메모리에 없음', await pg.evaluate(() => { const s = document.documentElement.outerHTML + JSON.stringify(P.rrev) + JSON.stringify(P.rtop); return s.indexOf('박하나비밀전문') < 0 && s.indexOf('박하나한마디비밀') < 0 && s.indexOf('박하나요약') < 0; }));
  t('⑤ 서버에 녹음 칸을 쓰지 않음', (await pg.evaluate(() => __W)).every((k) => String(k).indexOf('rec_') !== 0), JSON.stringify(await pg.evaluate(() => __W)));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
