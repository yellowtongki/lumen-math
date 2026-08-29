#!/usr/bin/env node
/*
 * check_withdrawn_leak.js — 퇴원생 노출 회귀 검사 (v18-104 재발 방지)
 *
 * 왜: 퇴원생이 화면에 남는 버그가 반복됐다(v12-10 플래너·녹음, v16-18/29 학생관리,
 *     v18-104 아하노트). 화면마다 필터를 따로 달다 보니 새 화면을 만들 때마다 빠뜨린다.
 *     → 배포 전 이 스크립트를 돌리면, 가짜 등록부(퇴원생 포함)로 앱을 실제 구동해
 *       퇴원생 이름이 주요 화면에 나타나는지 자동으로 잡아낸다.
 *
 * 사용: NODE_PATH=/home/user/lumen-math/node_modules node sync/check_withdrawn_leak.js [파일.html]
 *       (파일 생략 시 lumen_v18-*.html 중 최신 번호)
 *
 * 검사 항목:
 *   1. 아하노트 화면(반별·학생별·일별)에 퇴원생 이름이 없다
 *   2. 아하노트 미매칭 카운트에 퇴원생 노트가 흘러들지 않는다
 *   3. 학생관리 좌측 현황 총원 = 재원생 수 (퇴원생 미포함)
 *   4. 홈 화면에 퇴원생 이름이 없다
 *   5. activeStudents() 헬퍼가 존재하고 퇴원생을 거른다
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..');
const PORT = 8934;

// ── 대상 파일 ──
function latestLumen() {
  const files = fs.readdirSync(REPO).filter(f => /^lumen_v18-\d+\.html$/.test(f));
  files.sort((a, b) => parseInt(b.match(/-(\d+)\.html/)[1], 10) - parseInt(a.match(/-(\d+)\.html/)[1], 10));
  return files[0];
}
const TARGET = process.argv[2] || latestLumen();

// ── 가짜 데이터: 재원 2명 + 퇴원 1명(아하노트 보유) ──
const GHOST = '테스트퇴원생';
const studentdb = [
  { name: '재원학생A', grade: '중2', group: 'T5', lumen_rec_code: 'AAAAAA' },
  { name: '재원학생B', grade: '중1', group: 'T630', lumen_rec_code: 'BBBBBB' },
  { name: GHOST, grade: '중3', group: 'T5', lumen_rec_code: 'GHOST1', withdrawn: true },
];
const ahaNotes = [
  { id: 'n1', student_code: 'AAAAAA', status: 'pending', created_at: '2026-08-25T10:00:00+09:00', source_type: 'book', source_name: 'RPM', page: 10, problem_no: '3' },
  { id: 'n2', student_code: 'GHOST1', status: 'pending', created_at: '2026-08-20T10:00:00+09:00', source_type: 'book', source_name: 'RPM', page: 20, problem_no: '5' },
  { id: 'n3', student_code: 'GHOST1', status: 'resolved', created_at: '2026-08-18T10:00:00+09:00', source_type: 'book', source_name: 'RPM', page: 21, problem_no: '7' },
];

// ── supabase UMD 확보 (없으면 npm pack) ──
function findSupabaseUmd() {
  const cands = [
    path.join(REPO, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),
  ];
  const scratchBase = '/tmp/claude-0/-home-user-lumen-math';
  try {
    for (const d of fs.readdirSync(scratchBase)) {
      cands.push(path.join(scratchBase, d, 'scratchpad/package/dist/umd/supabase.js'));
    }
  } catch (e) {}
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return null;
}

(async () => {
  const umd = findSupabaseUmd();
  if (!umd) { console.error('supabase UMD 없음 — npm pack @supabase/supabase-js@2 후 재실행'); process.exit(2); }
  const umdBody = fs.readFileSync(umd);

  // 정적 서버
  const server = http.createServer((req, res) => {
    const f = path.join(REPO, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
      res.end(fs.readFileSync(f));
    } else { res.statusCode = 404; res.end('nf'); }
  }).listen(PORT, '127.0.0.1');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

  // 로그인 게이트 우회 + 로컬 등록부 주입
  await page.addInitScript(({ db }) => {
    sessionStorage.setItem('lumen_login_session', JSON.stringify({ expires: Date.now() + 30 * 60 * 1000 }));
    localStorage.setItem('lumen_demo_injected_v1', '1'); // 첫 실행 예시학생 주입 방지
    localStorage.setItem('or_studentdb', JSON.stringify(db));
  }, { db: studentdb });

  // 외부 요청 fixture
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1:' + PORT)) return route.continue();
    if (u.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: umdBody });
    }
    if (u.includes('supabase.co/rest/v1/aha_notes')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ahaNotes) });
    }
    if (u.includes('supabase.co/rest/v1/lumen_store')) {
      const url = new URL(u);
      const keyEq = url.searchParams.get('key');
      if (keyEq && keyEq.startsWith('eq.')) {
        const k = keyEq.slice(3);
        if (k === 'or_studentdb') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ key: k, value: JSON.stringify(studentdb), updated_at: '2026-08-29T00:00:00Z' }]) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      // 전체/like 조회
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ key: 'or_studentdb', value: JSON.stringify(studentdb), updated_at: '2026-08-29T00:00:00Z' }]) });
    }
    if (u.includes('supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.abort();
  });

  const results = [];
  function check(name, ok, detail) { results.push({ name, ok, detail }); console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail ? ' — ' + detail : '')); }

  await page.goto('http://127.0.0.1:' + PORT + '/' + TARGET, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 5) 헬퍼 존재
  const helper = await page.evaluate(() => {
    if (typeof window.activeStudents !== 'function') return { exists: false };
    const act = window.activeStudents();
    return { exists: true, count: act.length, hasGhost: act.some(s => s.withdrawn), names: act.map(s => s.name) };
  });
  check('activeStudents() 헬퍼 존재', helper.exists);
  if (helper.exists) check('activeStudents()가 퇴원생 제외', !helper.hasGhost && helper.count === 2, '재원 ' + helper.count + '명: ' + (helper.names||[]).join(','));

  // 4) 홈 화면
  let body = await page.evaluate(() => document.body.innerText);
  check('홈 화면에 퇴원생 이름 없음', !body.includes(GHOST));

  // 1·2) 아하노트 화면 (반별 기본)
  await page.evaluate(() => { VIEW='aha'; try{ ahaLoad(); }catch(e){} render(); });
  await page.waitForTimeout(2200);
  for (const axis of ['class', 'student', 'day']) {
    await page.evaluate(a => { if (typeof window.ahaSetAxis === 'function') window.ahaSetAxis(a); }, axis);
    await page.waitForTimeout(500);
    body = await page.evaluate(() => document.body.innerText);
    const label = { class: '반별', student: '학생별', day: '일별' }[axis];
    check('아하노트 ' + label + ' — 퇴원생 이름 없음', !body.includes(GHOST));
  }
  const aha = await page.evaluate(() => {
    const notes = (typeof ahaNotes !== 'undefined' && ahaNotes) || [];
    let um = 0; notes.forEach(n => { if (typeof ahaStudentByCode === 'function' && !ahaStudentByCode(n.student_code)) um++; });
    return { total: notes.length, unmatched: um, allKept: (typeof ahaNotesAll !== 'undefined' && ahaNotesAll) ? ahaNotesAll.length : null };
  });
  check('아하노트 집계에서 퇴원생 노트 제외', aha.total === 1, '표시 ' + aha.total + '건 (기대 1)');
  check('퇴원생 노트가 미매칭으로 새지 않음', aha.unmatched === 0, '미매칭 ' + aha.unmatched);
  check('원본(ahaNotesAll)에는 기록 보존', aha.allKept === 3, '보존 ' + aha.allKept + '건 (기대 3)');

  // 3) 학생관리 좌측 현황
  await page.evaluate(() => { VIEW='studentdb'; render(); });
  await page.waitForTimeout(900);
  const dbCount = await page.evaluate(() => {
    // 좌측 현황 박스의 큰 숫자
    const el = [...document.querySelectorAll('div')].find(d => d.style && d.style.fontSize === '24px' && d.style.fontWeight === '900');
    return el ? parseInt(el.textContent, 10) : null;
  });
  if (dbCount !== null) check('학생관리 현황 총원 = 재원생 수', dbCount === 2, '표시 ' + dbCount + '명 (기대 2)');
  else check('학생관리 현황 총원 = 재원생 수', false, '현황 숫자를 찾지 못함 (화면 진입 실패?)');

  await browser.close(); server.close();
  const fail = results.filter(r => !r.ok).length;
  console.log('\n결과: ' + (results.length - fail) + '/' + results.length + ' 통과' + (fail ? ' — ❌ ' + fail + '건 실패' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('실행 오류:', e.message); process.exit(2); });
