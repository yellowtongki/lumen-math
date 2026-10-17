#!/usr/bin/env node
/* 📅 네이버 예약 수집기 검사 — 가짜 자료만(이름·전화는 지어낸 것). 네이버·Supabase 를 부르지 않는다.
 *   쪽 넘김 멈춤 · 기간 거르기 · UTC→한국 시간 · 상품 종류 · 전화/이름 맞추기 · 직접 연결 우선 · 로그인 만료 · 잠근 상자 ·
 *   «화면에 찍힌 글에 가짜 이름·전화·메모가 하나도 없다»
 *   실행: node sync/test_naver_booking.js */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const core = require('./naver_booking_core.js');
const col = require('./naver_booking_collect.js');

let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : '  ← ' + (info || ''))); };
const NOW = '2026-10-17T10:00:00+09:00', TODAY = '2026-10-17';
const D = (n) => core.nbAddDays(TODAY, n);
const utc = (ymd, hm) => { const t0 = Date.parse(ymd + 'T' + hm + ':00+09:00'); return new Date(t0).toISOString().replace('.000Z', 'Z'); };   /* 한국 시각 → 네이버처럼 UTC 'Z' */
const SP = process.env.SP || fs.mkdtempSync(path.join(os.tmpdir(), 'nbtest-'));

/* 가짜 학원 명단 */
const STU = [
  { id: 'S1', name: '가짜일', lumen_rec_code: 'F00001', parentPhone: '010-1111-0001', studentPhone: '', group: 'M3' },
  { id: 'S2', name: '가짜이', lumen_rec_code: 'F00002', parentPhone: '010 1111 0002 / 010-1111-0009', group: 'M2' },
  { id: 'S3', name: '시험삼', lumen_rec_code: 'F00003', parentPhone: '010-1111-0003', group: 'M1' },   /* 형제 */
  { id: 'S4', name: '시험사', lumen_rec_code: 'F00004', parentPhone: '01011110003', group: 'M1' },     /* 형제 */
  { id: 'S5', name: '나간오', lumen_rec_code: 'F00005', parentPhone: '010-1111-0005', withdrawn: true },
];
const ITEMS = [
  { bizItemId: 6773412, name: '루멘수학 테스트&상담', isImp: true }, { bizItemId: 7401437, name: 'TLP 학습심리분석 상담(재원생)', isImp: true },
  { bizItemId: 7170543, name: '텐투텐 신청 (재원생용)', isImp: true }, { bizItemId: 7380213, name: '리커버리 클래스(재원생)', isImp: true },
  { bizItemId: 7280930, name: 'KMM 경시대회 신청(재원생)', isImp: true }, { bizItemId: 7397966, name: '1:1 컨설팅(재원생)', isImp: true }];
let nid = 1000;
const bk = (o) => Object.assign({ bookingId: ++nid, bizItemId: 7380213, bizItemName: '리커버리 클래스(재원생)', bookingStatusCode: 'RC03', name: '가짜부모' + nid, phone: '010-9999-' + String(nid).slice(-4),
  email: 'fake' + nid + '@example.invalid', startDate: TODAY, endDate: TODAY, bookingCount: 1, requestMessage: '가짜메모' + nid, regDateTime: utc(D(-60), '09:00'),
  confirmedDateTime: utc(D(-60), '09:05'), isCompleted: false, snapshotJson: { startDateTime: utc(TODAY, '14:00'), endDateTime: utc(TODAY, '15:00'), customFormInputJson: [{ title: '학생 이름', value: '가짜답' + nid }] } }, o);
const at = (ymd, hm, hm2) => ({ startDate: ymd, snapshotJson: { startDateTime: utc(ymd, hm), endDateTime: utc(ymd, hm2 || hm), customFormInputJson: [] } });

/* 예약 — 오래된 것부터 */
const B = [];
B.push(bk(Object.assign(at(D(-40), '10:00'), {})));                                          /* 0 기간 밖(40일 전) */
B.push(bk(Object.assign(at(D(-5), '10:00'), { phone: '010-1111-0001', bookingStatusCode: 'RC08', isCompleted: true, completedDateTime: utc(D(-5), '11:00') })));   /* 1 전화 → S1 · 완료 */
B.push(bk(Object.assign(at(TODAY, '14:00', '15:00'), { phone: '+82 10-1111-0009' })));         /* 2 두 번째 번호 → S2 */
B.push(bk(Object.assign(at(TODAY, '13:00'), { phone: '010-1111-0003', requestMessage: '형제 중 시험사 예약합니다' })));  /* 3 형제 + 이름 → S4 */
B.push(bk(Object.assign(at(D(1), '19:00'), { phone: '010-1111-0003', requestMessage: '잘 부탁드려요' })));         /* 4 형제, 이름 없음 → 못 맞춤(ambiguous) */
B.push(bk(Object.assign(at(D(2), '10:00'), { bizItemId: 6773412, bizItemName: '루멘수학 테스트&상담', requestMessage: '중2 가짜이 친구 아님 새 학생' })));   /* 5 이름 → S2 (메모 안 이름) */
B.push(bk(Object.assign(at(D(3), '10:00'), { bizItemId: 7170543, bizItemName: '텐투텐 신청 (재원생용)', bookingCount: 2 })));   /* 6 텐투텐 · 못 맞춤 */
B.push(bk(Object.assign(at(D(3), '10:00'), { bizItemId: 7170543, bizItemName: '텐투텐 신청 (재원생용)', bookingStatusCode: 'RC04', cancelledDateTime: utc(D(-1), '08:00') })));   /* 7 텐투텐 취소 */
B.push(bk(Object.assign(at(D(100), '10:00'), { regDateTime: utc(D(-2), '09:00') })));          /* 8 100일 뒤지만 최근 신청 → 포함 */
B.push(bk(Object.assign(at(D(100), '10:00'), {})));                                           /* 9 100일 뒤 · 옛 신청 → 빠짐 */
B.push(bk(Object.assign(at(TODAY, '15:00'), { phone: '010-1111-0001' })));                    /* 10 전화로는 S1 이지만 직접 연결 S3 → S3 */
B.push(bk(Object.assign(at(TODAY, '16:00'), { phone: '010-1111-0002' })));                    /* 11 직접 「명단에 없음」 → 없음 */
B.push(bk(Object.assign(at(D(4), '10:00'), { bizItemId: 9999999, bizItemName: '새로 만든 특강' })));   /* 12 모르는 상품 → 기타 */
B.push(bk(Object.assign(at(D(4), '11:00'), { phone: '010-1111-0005' })));                     /* 13 퇴원생 전화 → 못 맞춤 */
B.push(bk(Object.assign(at(TODAY, '17:30'), { bookingStatusCode: 'RC02', confirmedDateTime: null, snapshotJson: { startDateTime: '2026-10-17T08:30:00Z', customFormInputJson: '[{"name":"학년","answer":["중1","가짜폼"]}]' } })));   /* 14 신청 · 문자열 form */
/* 쪽 나누기 — 100건씩. 앞쪽은 기간 밖 채우기 */
const filler = []; for (let i = 0; i < 180; i++) filler.push(bk(at(D(-200), '10:00')));
const ALL = filler.concat(B);
const pages = []; for (let i = 0; i < ALL.length; i += 100) pages.push(ALL.slice(i, i + 100));
const LINKS = {}; LINKS[String(B[10].bookingId)] = 'S3'; LINKS[String(B[11].bookingId)] = '';
const STORE = { or_studentdb: STU, naver_booking_links: LINKS, naver_bookings_status: { at: '2026-10-16T00:00:00Z', ok: true } };
const KEY = 'fake-teacher-key-for-test';
const FX = { items: ITEMS, pages, store: STORE, teacherKey: KEY };

(async () => {
  /* ── 순수 함수 ── */
  t('UTC→한국: 05:00Z → 14:00', core.nbKst('2025-07-20T05:00:00Z').time === '14:00' && core.nbKst('2025-07-20T05:00:00Z').date === '2025-07-20');
  t('UTC→한국: 날짜 넘김 16:30Z → 다음 날 01:30', core.nbKst('2026-10-17T16:30:00Z').date === '2026-10-18' && core.nbKst('2026-10-17T16:30:00Z').time === '01:30');
  t('시간대 표시 없는 값도 UTC 로', core.nbKst('2026-10-17T05:00:00').time === '14:00');
  const kinds = ITEMS.map((i) => core.nbKindOf(i.name, i.bizItemId)).join();
  t('상품 6개 종류: 상담·TLP·텐투텐·리커버리·KMM·컨설팅', kinds === 'counsel,tlp,tenten,recovery,kmm,consult', kinds);
  t('이름이 바뀌어도 번호로 (7380213 → 리커버리) · 모르는 것 → 기타', core.nbKindOf('토요 보충', 7380213) === 'recovery' && core.nbKindOf('새 특강', 1) === 'etc');
  t('상태: RC08 완료 · RC04 취소 · RC02 신청 · RC03 확정 · 모르는 코드는 그대로', core.nbStatusOf({ bookingStatusCode: 'RC08' }).k === 'completed' && core.nbStatusOf({ bookingStatusCode: 'RC04' }).k === 'cancelled'
    && core.nbStatusOf({ bookingStatusCode: 'RC02' }).k === 'requested' && core.nbStatusOf({ bookingStatusCode: 'RC03' }).k === 'confirmed' && core.nbStatusOf({ bookingStatusCode: 'RC77' }).label === '상태 RC77');
  t('전화 꺼내기: 한 칸에 둘 · +82 · 띄어쓰기', core.nbPhonesIn('010 1111 0002 / 010-1111-0009').join() === '01011110002,01011110009' && core.nbDigits('+82 10-1111-0009') === '01011110009');
  const F = core.nbFormOf({ customFormInputJson: '[{"name":"학년","answer":["중1","가짜폼"]},{"title":"","value":""}]' });
  t('추가 답(문자열 JSON · 배열 답) → [{q,a}] · 빈 칸 버림', F.length === 1 && F[0].q === '학년' && F[0].a === '중1, 가짜폼', JSON.stringify(F));

  /* ── 쪽 넘김 ── */
  let calls = [];
  const fio = (pgs, total) => async (url) => { calls.push(url); if (/biz-items/.test(url)) return { json: ITEMS, total: 0 }; const p = Number((url.match(/page=(\d+)/) || [])[1]); return { json: pgs[p] || [], total: total || 0 }; };
  let r = await col.fetchAll(fio(pages));
  t('쪽 넘김: 100·95 → 덜 찬 둘째 쪽에서 멈춤 · ' + ALL.length + '건', ALL.length === 195 && r.pages === 2 && r.raw.length === ALL.length && calls.filter((u) => /bookings/.test(u)).length === r.pages, JSON.stringify({ pages: r.pages, n: r.raw.length }));
  calls = [];
  const p2 = pages[1].concat(pages[0].slice(0, 5).map((b) => Object.assign({}, b, { bookingId: b.bookingId + 900000 }))); r = await col.fetchAll(fio([pages[0], p2, []]));
  t('딱 맞게 찬 쪽 다음 빈 쪽에서 멈춤', r.pages === 3 && r.raw.length === 200, JSON.stringify({ pages: r.pages }));
  calls = [];
  r = await col.fetchAll(async (url) => { calls.push(url); if (/biz-items/.test(url)) return { json: ITEMS, total: 0 }; return { json: pages[0], total: 0 }; });
  t('쪽 넘김을 무시하고 같은 쪽만 주면 둘째 쪽에서 멈춤(중복 없음)', r.pages === 2 && r.raw.length === 100, JSON.stringify({ pages: r.pages, n: r.raw.length }));
  calls = [];
  r = await col.fetchAll(async (url) => { calls.push(url); if (/biz-items/.test(url)) return { json: ITEMS, total: 0 }; const p = Number((url.match(/page=(\d+)/) || [])[1]); const a = []; for (let i = 0; i < 100; i++) a.push({ bookingId: p * 100 + i }); return { json: a, total: 5000 }; });
  t('총 5000건이면 최근 30쪽만 (앞 20쪽 건너뜀)', r.pages === 30 && r.skipped === 20 && r.raw[0].bookingId === 2000, JSON.stringify({ pages: r.pages, skipped: r.skipped }));

  /* ── 전체 실행 (가짜 저장) ── */
  const logs = [];
  const writes = {};
  const res = await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { writes[k] = v; return true; } }, teacherKey: KEY, now: NOW, log: (...a) => logs.push(a.join(' ')) });
  const NBd = writes.naver_bookings, byId = {}; (NBd.bookings || []).forEach((b) => { byId[b.id] = b; });
  const id = (i) => String(B[i].bookingId);
  t('저장한 키 = naver_bookings · naver_bookings_pii · naver_bookings_status', Object.keys(writes).sort().join() === 'naver_bookings,naver_bookings_pii,naver_bookings_status', Object.keys(writes).join());
  t('기간: 40일 전·100일 뒤(옛 신청)·200일 전 빠짐 · 100일 뒤(최근 신청) 포함', !byId[id(0)] && !byId[id(9)] && byId[id(8)] && !byId[String(filler[0].bookingId)] && NBd.counts.inWindow === B.length - 2, JSON.stringify(NBd.counts));
  t('시간: 오늘 14:00~15:00 (UTC 05:00Z)', byId[id(2)].start === '14:00' && byId[id(2)].end === '15:00' && byId[id(2)].date === TODAY);
  t('시간: 문자열 snapshot 08:30Z → 17:30 · 상태 신청', byId[id(14)].start === '17:30' && byId[id(14)].status.k === 'requested');
  t('종류: 상담 · 텐투텐 · 기타(모르는 상품)', byId[id(5)].item.kind === 'counsel' && byId[id(6)].item.kind === 'tenten' && byId[id(12)].item.kind === 'etc');
  const mk = (i) => byId[id(i)].match ? byId[id(i)].match.stKey + ':' + byId[id(i)].match.how : 'null';
  t('전화 → S1 (완료 예약도)', mk(1) === 'S1:phone' && byId[id(1)].status.k === 'completed' && byId[id(1)].match.code === 'F00001', mk(1));
  t('한 칸 두 번호 중 둘째 · +82 → S2', mk(2) === 'S2:phone', mk(2));
  t('형제 같은 전화 + 메모에 이름 → S4', mk(3) === 'S4:phone', mk(3));
  t('형제 같은 전화 · 이름 없음 → 못 맞춤 + 후보 2명', mk(4) === 'null' && (byId[id(4)].cands || []).join() === 'S3,S4', JSON.stringify(byId[id(4)]));
  t('메모 안 학생 이름 → S2 (name)', mk(5) === 'S2:name', mk(5));
  t('직접 연결이 전화보다 먼저 (S1 전화 → S3 직접)', mk(10) === 'S3:manual', mk(10));
  t('직접 「명단에 없음」 → 전화가 맞아도 연결 안 함', mk(11) === 'null' && byId[id(11)].noStudent === true, JSON.stringify(byId[id(11)]));
  t('퇴원생 전화는 맞추지 않음', mk(13) === 'null', mk(13));
  t('텐투텐 취소 → 상태 취소 · 2명 예약은 count 2', byId[id(7)].status.k === 'cancelled' && byId[id(6)].count === 2);
  const plain = JSON.stringify(NBd);
  const secrets = []; ALL.forEach((b) => { secrets.push(b.name, b.phone, b.email, b.requestMessage, String(b.phone).replace(/[^0-9]/g, '')); }); secrets.push('가짜답', '가짜폼', '형제 중', '010-1111', '01011110');
  t('공개 칸(naver_bookings)에 이름·전화·이메일·메모·추가 답 없음', secrets.every((x) => plain.indexOf(x) < 0), secrets.filter((x) => plain.indexOf(x) >= 0).slice(0, 3).join());
  t('공개 칸 pii 표시: 잠금 · 건수 · 열쇠 지문', NBd.pii.enc === true && NBd.pii.n === NBd.bookings.length && /^[0-9a-f]{8}$/.test(NBd.pii.kid));
  const box = writes.naver_bookings_pii;
  t('잠근 상자에는 글자가 그대로 안 보임', secrets.every((x) => JSON.stringify(box).indexOf(x) < 0));
  const opened = await core.nbOpen(box, KEY);
  t('원장님 열쇠로 열면 이름·전화·메모·추가 답', opened.byId[id(2)].booker === B[2].name && opened.byId[id(2)].phone === '010-1111-0009' && opened.byId[id(2)].msg === B[2].requestMessage && opened.byId[id(14)].form[0].a === '중1, 가짜폼', JSON.stringify(opened.byId[id(2)]));
  let bad = false; try { await core.nbOpen(box, 'wrong-key'); } catch (e) { bad = true; }
  t('다른 열쇠로는 못 엶', bad);
  t('상태 ok:true', writes.naver_bookings_status.ok === true && writes.naver_bookings_status.n === NBd.bookings.length);
  t('로그: 쪽 · 기간 안 · 종류별 · 연결/못 맞춤 건수', /쪽 \d/.test(logs.join('\n')) && /기간 안 \d+건/.test(logs.join('\n')) && /리커버리 \d/.test(logs.join('\n')) && /못 맞춤 \d+건/.test(logs.join('\n')), logs.join(' | '));

  /* 열쇠 없음 → 잠근 상자 안 만듦, 공개 칸만 */
  const w2 = {};
  await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { w2[k] = v; return true; } }, teacherKey: '', now: NOW, log: () => {} });
  t('LUMEN_TEACHER_KEY 없으면 naver_bookings_pii 를 쓰지 않음 · pii.enc=false', !w2.naver_bookings_pii && w2.naver_bookings.pii.enc === false && w2.naver_bookings.bookings.length === NBd.bookings.length);

  /* --dry: 저장 안 함 */
  const w3 = {};
  await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { w3[k] = v; return true; } }, teacherKey: KEY, dry: true, now: NOW, log: () => {} });
  t('--dry: 서버에 쓰지 않음', Object.keys(w3).length === 0);

  /* ── 명령줄(--fixture) — 찍힌 글 전체에 개인정보가 없는지 ── */
  const fxFile = path.join(SP, 'nb_fixture.json'), outFile = path.join(SP, 'nb_out.json');
  fs.writeFileSync(fxFile, JSON.stringify(FX));
  const env = Object.assign({}, process.env); delete env.NAVER_COOKIE; delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_KEY;
  const run1 = cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env, encoding: 'utf8' });
  const printed = (run1.stdout || '') + (run1.stderr || '');
  t('명령줄 --fixture 종료 0', run1.status === 0, printed.slice(0, 300));
  const leak = secrets.concat(STU.map((s) => s.name), STU.map((s) => s.parentPhone), ['F0000', KEY]).filter((x) => x && printed.indexOf(x) >= 0);
  t('찍힌 글에 가짜 이름·전화·이메일·메모·추가 답·학생 이름·코드·열쇠 없음', leak.length === 0, leak.slice(0, 5).join(' / '));
  const out1 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  t('--out 에 쓰려던 값 3개', Object.keys(out1).sort().join() === 'naver_bookings,naver_bookings_pii,naver_bookings_status');

  /* 로그인 만료 */
  const fxL = Object.assign({}, FX, { fail: { reason: 'login', code: 302 } });
  fs.writeFileSync(fxFile, JSON.stringify(fxL));
  const run2 = cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env, encoding: 'utf8' });
  const out2 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  t('로그인 만료: 종료 0 · naver_bookings_status {ok:false, reason:login, code:302} 만 · 지난 자료는 안 건드림', run2.status === 0 && Object.keys(out2).join() === 'naver_bookings_status' && out2.naver_bookings_status.ok === false
    && out2.naver_bookings_status.reason === 'login' && out2.naver_bookings_status.code === 302 && out2.naver_bookings_status.lastOkAt === '2026-10-16T00:00:00Z', JSON.stringify(out2));
  t('로그인 만료 로그에 개인정보 없음 · 쿠키 만료 안내', /쿠키\(NAVER_COOKIE\) 만료/.test(run2.stdout) && secrets.every((x) => run2.stdout.indexOf(x) < 0));
  /* 가운데 쪽이 로그인 화면(HTML) */
  const fxH = Object.assign({}, FX, { htmlAtPage: 1 });
  fs.writeFileSync(fxFile, JSON.stringify(fxH));
  cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env, encoding: 'utf8' });
  const out3 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  t('둘째 쪽이 HTML(로그인 화면) → login · 예약 자료는 안 씀', Object.keys(out3).join() === 'naver_bookings_status' && out3.naver_bookings_status.reason === 'login', JSON.stringify(out3));
  t('쿠키 정리(U+2028 섞임) → NID_AUT·NID_SES 만', col.cleanCookie('NID_AUT=aa\u2028bb; x=1; NID_SES=cc;\u00a0') === 'NID_AUT=aa; NID_SES=cc');

  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
