#!/usr/bin/env node
/* 학생앱 v2-162 검사 — 💡 아하노트 미해결 접힌 줄 · ✓ 수업 중 해결 (시안 docs/mockup_aha_fold.html)
 *   외부망 차단 · 가짜 Supabase(aha_notes update 만 기록 — 실서버에 아무것도 안 씀) · 가짜 학생 ○○○ · AAA111
 *   ① 미해결 탭 = 교재별 묶음 · 페이지·번호 순 · 줄에 p·# · 날짜 · 상태 칩 · 틀린 이유 · 오른쪽 체크 단추 · 해결/스스로해결 대기 노트는 안 나옴
 *   ② 줄 누르면 원래 카드가 펼쳐짐(고치기·삭제·스스로 풀었어요) · 다시 누르면 접힘
 *   ③ 체크 → 묻는 줄 → 아니요(아무 저장 없음) · 네 → update 본문(status resolved · resolved_at · resolved_note JSON reason class·by student·student class + 기존 칸 유지)
 *      → 미해결에서 빠짐 · 통계 칸 수 · 되돌리기 띠
 *   ④ 되돌리기 → status pending · resolved_at null · 학생 표시만 지움(선생님이 넣은 다른 칸 유지)
 *   ⑤ 해결 탭: 오늘 내가 체크한 카드 「🏫 수업 중 해결 (내가 체크)」 + 「↩ 미해결로」 · 어제 것은 단추 없음 · 선생님 해결은 「선생님이 확인」
 *   ⑥ 전체 탭은 예전 날짜별 카드 · 카드 안 「✓ 수업 중 해결했어요」(옛 「이제 알아요」 대신) → 카드 안 묻는 줄
 *   ⑦ 저장 실패면 그대로 미해결 · 테스트 모드는 막음 ⑧ 버전 · student_v1 그대로 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2162.js [student_v2-162.html]   (SHOT=/경로/a.png 로 접힌 화면 그림) */
const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-162.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const MOCK = () => {
  window.__upd = []; window.__fail = false;
  window.sb = { from(tbl) { const b = { op: 'select', body: null, id: null, select() { return b; }, eq(k, v) { if (k === 'id') b.id = v; return b; }, in() { return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, gte() { return b; }, lte() { return b; }, like() { return b; }, not() { return b; }, is() { return b; }, or() { return b; }, ilike() { return b; }, range() { return b; }, filter() { return b; }, match() { return b; }, gt() { return b; }, lt() { return b; },
    single() { return Promise.resolve({ data: null, error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    update(body) { b.op = 'u'; b.body = JSON.parse(JSON.stringify(body)); return b; }, upsert() { return Promise.resolve({ error: null }); }, insert() { return Promise.resolve({ error: null }); }, delete() { b.op = 'd'; return b; },
    then(r, j) { if (b.op === 'u') { if (window.__fail) return Promise.resolve({ error: { message: '가짜 실패' } }).then(r, j); __upd.push({ tbl, id: b.id, body: b.body }); } return Promise.resolve({ data: [], error: null }).then(r, j); } }; return b; },
    rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/' + p } }), remove: () => Promise.resolve({}) }) } };
  window.isTest = false;
  window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 3학년', school: '테스트중학교', group: 'T5' };
  window.alert = () => {}; window.confirm = () => true;
  const now = Date.now(), D = (d) => new Date(now - d * 86400000).toISOString();
  const yest = D(1);
  window.__seed = [
    { id: 'n1', student_code: 'AAA111', source_type: 'book', source_name: '쎈 중등수학3(하)', page: '71', problem_no: '869', status: 'pending', created_at: D(2), error_types: ['개념부족'], q_ask: '접선과 현이 이루는 각' },
    { id: 'n2', student_code: 'AAA111', source_type: 'book', source_name: '개념원리 중등수학3(하)', page: '112', problem_no: '7', status: 'pending', created_at: D(11), error_types: ['개념부족'], q_ask: '원주각' },
    { id: 'n3', student_code: 'AAA111', source_type: 'book', source_name: '개념원리 중등수학3(하)', page: '109', problem_no: '20', status: 'pending', created_at: D(13), error_types: ['문제잘못읽음'], q_ask: '그 기가 이 공식을', resolved_note: '{"keep":"x"}' },
    { id: 'n4', student_code: 'AAA111', source_type: 'book', source_name: '개념원리 중등수학3(하)', page: '109', problem_no: '9', status: 'pending', created_at: D(5), error_types: ['계산실수'], q_ask: '' },
    { id: 'n5', student_code: 'AAA111', source_type: 'print', source_name: '범박중 프린트', page: '', problem_no: '9', status: 'pending', created_at: D(1), error_types: [], q_ask: '조건' },
    { id: 'r1', student_code: 'AAA111', source_type: 'book', source_name: '쎈 중등수학3(하)', page: '52', problem_no: '701', status: 'resolved', resolved_at: D(15), created_at: D(16), resolved_note: '{"reason":"answered","by":"teacher"}' },
    { id: 'r2', student_code: 'AAA111', source_type: 'book', source_name: '쎈 중등수학3(하)', page: '50', problem_no: '690', status: 'resolved', resolved_at: yest, created_at: D(3), resolved_note: JSON.stringify({ reason: 'class', by: 'student', at: yest, student: 'class', student_at: yest }) },
    { id: 's1', student_code: 'AAA111', source_type: 'book', source_name: '쎈 중등수학3(하)', page: '60', problem_no: '777', status: 'self_pending', created_at: D(4), self_solved: { how: 'x', photo_url: '' } }
  ];
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
  await pg.evaluate(MOCK);
  const P = (fn, a) => pg.evaluate(fn, a);
  const seed = async () => { await P(() => { if (!document.getElementById('screen-aha').classList.contains('active')) go('screen-aha'); }); await pg.waitForTimeout(400); await P(() => { ahaNotes = JSON.parse(JSON.stringify(__seed)); ahaHintMap = {}; ahaRetryMap = {}; AHF.open = {}; AHF.ask = null; AHF.busy = false; __upd.length = 0; try { ahfHideUndo(); } catch (e) {} try { renderAhaStats(); } catch (e) {} }); };
  const tab = (f) => P((f) => { ahaSetFilter(f); }, f);
  const view = () => P(() => {
    const L = document.getElementById('aha-list');
    return { grps: Array.prototype.map.call(L.querySelectorAll('.ahf-grp'), (g) => g.innerText.replace(/\s+/g, ' ')),
      rows: Array.prototype.map.call(L.querySelectorAll('.ahf-row'), (r) => r.getAttribute('data-ahf')),
      pn: Array.prototype.map.call(L.querySelectorAll('.ahf-pn'), (x) => x.firstChild.textContent),
      open: Array.prototype.map.call(L.querySelectorAll('.ahf-row.open'), (r) => r.getAttribute('data-ahf')),
      cards: L.querySelectorAll('.aha-card').length, ask: L.querySelectorAll('.ahf-ask').length, txt: L.innerText.replace(/\s+/g, ' '),
      cnt: { p: document.getElementById('aha-cnt-pending').textContent, r: document.getElementById('aha-cnt-resolved').textContent } };
  });
  const tap = async (sel) => { try { await pg.click(sel, { timeout: 2500 }); } catch (e) { await P((s) => document.querySelector(s).click(), sel); } await pg.waitForTimeout(80); };

  /* ① */
  await seed(); await tab('pending');
  let v = await view();
  t('① 교재별 묶음(가나다 · 프린트는 뒤) · 개수', JSON.stringify(v.grps.map((x) => x.replace(/\s/g, ''))) === JSON.stringify(['📕개념원리중등수학3(하)3개', '📕쎈중등수학3(하)1개', '📝범박중프린트1개']), JSON.stringify(v.grps));
  t('① 그 안은 페이지·번호 순 (p109#9 → p109#20 → p112#7)', JSON.stringify(v.rows) === JSON.stringify(['n4', 'n3', 'n2', 'n1', 'n5']), JSON.stringify(v.rows));
  t('① 줄에 p·# 크게 (프린트는 #만)', v.pn[0] === 'p109 · #9' && v.pn[1] === 'p109 · #20' && v.pn[4] === '#9', JSON.stringify(v.pn));
  t('① 상태 칩 · 틀린 이유 · 체크 단추 · 접힘(카드 0)', /답변 대기/.test(v.txt) && /문제잘못읽음/.test(v.txt) && (await P(() => document.querySelectorAll('#aha-list .ahf-ck').length)) === 5 && v.cards === 0, v.txt.slice(0, 160));
  t('① 해결·스스로해결 대기 노트는 미해결 줄에 없음', v.rows.indexOf('r1') < 0 && v.rows.indexOf('s1') < 0, '');
  if (process.env.SHOT) { await P(() => { const l = document.getElementById('aha-tabs'); if (l) l.scrollIntoView(); AHF.ask = 'n3'; renderAhaList(); }); await pg.waitForTimeout(150); await pg.screenshot({ path: process.env.SHOT, fullPage: false }); await P(() => { AHF.ask = null; renderAhaList(); }); }

  /* ② */
  await tap('.ahf-row[data-ahf="n3"] .ahf-hd');
  v = await view();
  t('② 줄 누르면 원래 카드 펼침(고치기·삭제·스스로)', v.open.join() === 'n3' && v.cards === 1 && /고치기/.test(v.txt) && /삭제/.test(v.txt) && /스스로/.test(v.txt), v.txt.slice(0, 200));
  t('② 펼친 카드 안 「✓ 수업 중 해결했어요」 (옛 「이제 알아요」 없음)', /수업 중 해결했어요/.test(v.txt) && !/이제 알아요/.test(v.txt), '');
  await tap('.ahf-row[data-ahf="n3"] .ahf-hd');
  t('② 다시 누르면 접힘', (await view()).cards === 0, '');

  /* ③ */
  await tap('.ahf-row[data-ahf="n3"] .ahf-ck');
  v = await view();
  t('③ 체크 → 묻는 줄 「p109 · #20 — 수업 시간에 해결했나요?」 · 아직 저장 없음', v.ask === 1 && /p109 · #20 — 수업 시간에 해결했나요/.test(v.txt) && (await P(() => __upd.length)) === 0, v.txt.slice(0, 200));
  await tap('.ahf-row[data-ahf="n3"] .ahf-no');
  t('③ 아니요 → 묻는 줄 닫힘 · 저장 없음', (await view()).ask === 0 && (await P(() => __upd.length)) === 0, '');
  await tap('.ahf-row[data-ahf="n3"] .ahf-ck'); await tap('.ahf-row[data-ahf="n3"] .ahf-yes'); await pg.waitForTimeout(100);
  const U = await P(() => __upd.slice());
  const b = U[0] && U[0].body; let rn = {}; try { rn = JSON.parse(b.resolved_note); } catch (e) {}
  t('③ 네 → aha_notes 그 줄 update 1번 · status resolved · resolved_at', U.length === 1 && U[0].tbl === 'aha_notes' && U[0].id === 'n3' && b.status === 'resolved' && /^\d{4}-\d\d-\d\dT/.test(b.resolved_at), JSON.stringify(U));
  t('③ resolved_note = reason class · by student · student class · 시각 · 기존 칸(keep) 유지', rn.reason === 'class' && rn.by === 'student' && rn.student === 'class' && rn.at === b.resolved_at && rn.student_at === b.resolved_at && rn.keep === 'x', JSON.stringify(rn));
  v = await view();
  t('③ 미해결 줄에서 빠짐 · 칸 수 미해결 4·해결 3 (스스로 대기 포함 셈은 예전대로)', v.rows.indexOf('n3') < 0 && v.rows.length === 4 && v.cnt.r === '3', JSON.stringify(v.cnt) + ' ' + v.rows.join());
  const ub = await P(() => { const x = document.getElementById('ahf-undo'); return x ? x.innerText.replace(/\s+/g, ' ') : null; });
  t('③ 아래 띠 「🏫 p109 · #20 수업 중 해결로 옮겼어요 · 되돌리기」', ub && /p109 · #20 수업 중 해결로 옮겼어요/.test(ub) && /되돌리기/.test(ub), ub);

  /* ④ */
  await P(() => { __upd.length = 0; }); await tap('#ahf-undo-btn'); await pg.waitForTimeout(100);
  const U2 = await P(() => __upd.slice()); const b2 = U2[0] && U2[0].body; let rn2 = {}; try { rn2 = JSON.parse(b2.resolved_note); } catch (e) {}
  t('④ 되돌리기 → status pending · resolved_at null · 학생 표시만 지움(keep 유지)', U2.length === 1 && b2.status === 'pending' && b2.resolved_at === null && !rn2.reason && !rn2.by && !rn2.student && rn2.keep === 'x', JSON.stringify(b2));
  v = await view();
  t('④ 미해결 줄로 돌아옴 · 띠 사라짐', v.rows.indexOf('n3') >= 0 && !(await P(() => !!document.getElementById('ahf-undo'))), v.rows.join());

  /* ⑤ */
  await tap('.ahf-row[data-ahf="n4"] .ahf-ck'); await tap('.ahf-row[data-ahf="n4"] .ahf-yes'); await pg.waitForTimeout(100);
  await tab('resolved');
  const rs = await P(() => { const L = document.getElementById('aha-list'); const c = (id) => { const e = L.querySelector('.aha-card[data-hnid="' + id + '"]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }; return { n4: c('n4'), r2: c('r2'), r1: c('r1'), backs: L.querySelectorAll('.ahf-back').length, rows: L.querySelectorAll('.ahf-row').length }; });
  t('⑤ 해결 탭은 예전 카드 · 오늘 내가 체크 → 「🏫 수업 중 해결 (내가 체크)」 + 「↩ 미해결로」', rs.rows === 0 && /수업 중 해결 \(내가 체크\)/.test(rs.n4) && /미해결로/.test(rs.n4), rs.n4.slice(0, 200));
  t('⑤ 어제 체크한 것은 표시만 · 되돌리기 단추 없음(단추 1개)', /내가 체크/.test(rs.r2) && !/미해결로/.test(rs.r2) && rs.backs === 1, rs.r2.slice(0, 160));
  t('⑤ 선생님이 해결한 것은 「선생님이 확인」', /선생님이 확인/.test(rs.r1) && !/내가 체크/.test(rs.r1), rs.r1.slice(0, 120));
  await P(() => { __upd.length = 0; }); await tap('.aha-card[data-hnid="n4"] .ahf-back'); await pg.waitForTimeout(100);
  t('⑤ 「↩ 미해결로」 → pending 으로 저장', (await P(() => __upd.length === 1 && __upd[0].body.status === 'pending' && __upd[0].id === 'n4')), '');

  /* ⑥ */
  await seed(); await tab('all');
  v = await view();
  t('⑥ 전체 탭은 예전 날짜별 카드(접힌 줄 없음)', v.rows.length === 0 && v.cards === 8 && (await P(() => document.querySelectorAll('#aha-list .aha-date-hdr').length)) > 0, JSON.stringify({ rows: v.rows.length, cards: v.cards }));
  await P(() => { const b = document.querySelector('.aha-card[data-hnid="n1"] .ahlk'); b.scrollIntoView(); b.click(); }); await pg.waitForTimeout(80);
  const inCard = await P(() => { const c = document.querySelector('.aha-card[data-hnid="n1"]'); return c ? !!c.querySelector('.ahf-ask') : false; });
  t('⑥ 카드 안 「✓ 수업 중 해결했어요」 → 카드 안 묻는 줄', inCard, '');
  await P(() => document.querySelector('.aha-card[data-hnid="n1"] .ahf-yes').click()); await pg.waitForTimeout(100);
  t('⑥ 카드 안에서 「네」 → 같은 저장', (await P(() => __upd.length === 1 && __upd[0].id === 'n1' && __upd[0].body.status === 'resolved')), '');

  /* ⑦ */
  await seed(); await tab('pending'); await P(() => { __fail = true; });
  await tap('.ahf-row[data-ahf="n1"] .ahf-ck'); await tap('.ahf-row[data-ahf="n1"] .ahf-yes'); await pg.waitForTimeout(100);
  v = await view();
  t('⑦ 저장 실패면 그대로 미해결 · 띠 없음', v.rows.indexOf('n1') >= 0 && !(await P(() => !!document.getElementById('ahf-undo'))) && (await P(() => ahaNotes.filter((n) => n.id === 'n1')[0].status)) === 'pending', '');
  await P(() => { __fail = false; isTest = true; ahfAsk('n1'); });
  t('⑦ 테스트 모드는 체크 막음(묻는 줄 안 열림)', (await view()).ask === 0, '');
  await P(() => { isTest = false; });

  /* ⑧ */
  t('⑧ STU_VER v2-162 · 버전 로그 줄', (await P(() => STU_VER)) === 'v2-162' && /v2-162 \(2026-11-10\)/.test(require('fs').readFileSync(FILE, 'utf8')), '');
  let same = false; try { same = execSync('git -C ' + ROOT + ' diff --quiet HEAD -- student_v1.html && echo same').toString().trim() === 'same'; } catch (e) {}
  t('⑧ 고정 주소 student_v1.html 손대지 않음', same, '');
  await P(() => { ahaSetFilter('all'); go('screen-home'); });
  t('⑧ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
