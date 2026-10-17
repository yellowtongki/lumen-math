#!/usr/bin/env node
/* 📅 네이버 예약 수집기 검사 — 가짜 자료만(이름·전화는 지어낸 것). 네이버·Supabase 를 부르지 않는다.
 *   쪽 넘김 멈춤 · 기간 거르기 · UTC→한국 시간 · 상품 종류 · 전화/이름 맞추기 · 직접 연결 우선 · 로그인 만료 · 잠근 상자 ·
 *   기억한 전화(직접 연결이 가르침 → 같은 전화 다음 예약 learned · 형제는 후보만 · 지문만 저장 · 비밀값 따라 지문 다름) ·
 *   예약 열쇠(NAVER_PII_KEY)가 LUMEN_TEACHER_KEY 보다 먼저 · 상자에 kk·kid ·
 *   «화면에 찍힌 글에 가짜 이름·전화·메모·열쇠가 하나도 없다»
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

  /* ── 예약 열쇠(NAVER_PII_KEY) — 공개된 서버 잠금 열쇠 대신 (2026-10-17) ── */
  const PK = 'fake pii passphrase for test 2026';
  t('열쇠가 LUMEN_TEACHER_KEY 뿐이면 kk=teacher · kid=그 열쇠 지문', box.kk === 'teacher' && NBd.pii.kk === 'teacher' && box.kid === (await core.nbKid(KEY)) && NBd.pii.kid === box.kid, JSON.stringify({ kk: box.kk, kid: box.kid }));
  const w5 = {}, lg5 = [];
  await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { w5[k] = v; return true; } }, teacherKey: KEY, piiKey: PK, now: NOW, log: (...a) => lg5.push(a.join(' ')) });
  const box5 = w5.naver_bookings_pii;
  let o5 = null, t5 = false; try { o5 = await core.nbOpen(box5, PK); } catch (e) { o5 = null; } try { await core.nbOpen(box5, KEY); t5 = true; } catch (e) { t5 = false; }
  t('둘 다 있으면 NAVER_PII_KEY 로 잠금 (예약 열쇠로 열림 · 서버 잠금 열쇠로는 안 열림)', !!o5 && o5.byId[id(2)].booker === B[2].name && !t5);
  t('상자·공개 칸에 kk=pii · kid=예약 열쇠 지문(8글자)', box5.kk === 'pii' && w5.naver_bookings.pii.kk === 'pii' && box5.kid === (await core.nbKid(PK)) && /^[0-9a-f]{8}$/.test(box5.kid) && w5.naver_bookings.pii.kid === box5.kid && box5.kid !== box.kid, JSON.stringify({ kk: box5.kk, kid: box5.kid }));
  t('로그: 「열쇠 NAVER_PII_KEY」 · 열쇠 글은 안 찍힘', lg5.some((x) => /잠금 저장 \d+건 \(열쇠 NAVER_PII_KEY\)/.test(x)) && lg5.every((x) => x.indexOf(PK) < 0 && x.indexOf(KEY) < 0 && x.indexOf('passphrase') < 0), lg5.join(' | '));
  const w6 = {};
  await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { w6[k] = v; return true; } }, teacherKey: '', piiKey: '  ' + PK + '\n', now: NOW, log: () => {} });
  let o6 = null; try { o6 = await core.nbOpen(w6.naver_bookings_pii, PK); } catch (e) { o6 = null; }
  t('예약 열쇠만 있어도 저장 · 앞뒤 빈칸·줄바꿈은 무시', !!o6 && w6.naver_bookings_pii.kk === 'pii' && w6.naver_bookings.pii.enc === true);
  const w7 = {}, lg7 = [];
  await col.run({ getJson: fio(pages), store: { get: async () => JSON.parse(JSON.stringify(STORE)), set: async (k, v) => { w7[k] = v; return true; } }, teacherKey: '', piiKey: 'short', now: NOW, log: (...a) => lg7.push(a.join(' ')) });
  t('짧은 예약 열쇠 → 저장은 하되 「짧아요」 경고 (열쇠 글은 안 찍힘)', !!w7.naver_bookings_pii && lg7.some((x) => /짧아요/.test(x)) && lg7.every((x) => x.indexOf('short') < 0), lg7.join(' | '));

  /* ── 명령줄(--fixture) — 찍힌 글 전체에 개인정보가 없는지 ── */
  const fxFile = path.join(SP, 'nb_fixture.json'), outFile = path.join(SP, 'nb_out.json');
  fs.writeFileSync(fxFile, JSON.stringify(FX));
  const env = Object.assign({}, process.env); delete env.NAVER_COOKIE; delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_KEY; delete env.NAVER_PII_KEY; delete env.LUMEN_TEACHER_KEY;
  const run1 = cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env, encoding: 'utf8' });
  const printed = (run1.stdout || '') + (run1.stderr || '');
  t('명령줄 --fixture 종료 0', run1.status === 0, printed.slice(0, 300));
  const leak = secrets.concat(STU.map((s) => s.name), STU.map((s) => s.parentPhone), ['F0000', KEY]).filter((x) => x && printed.indexOf(x) >= 0);
  t('찍힌 글에 가짜 이름·전화·이메일·메모·추가 답·학생 이름·코드·열쇠 없음', leak.length === 0, leak.slice(0, 5).join(' / '));
  const out1 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  t('--out 에 쓰려던 값 3개', Object.keys(out1).sort().join() === 'naver_bookings,naver_bookings_pii,naver_bookings_status');
  /* 명령줄: 비밀값(환경변수) NAVER_PII_KEY + LUMEN_TEACHER_KEY 둘 다 → 예약 열쇠 */
  const FXE = Object.assign({}, FX); delete FXE.teacherKey;
  fs.writeFileSync(fxFile, JSON.stringify(FXE));
  const envK = Object.assign({}, env, { NAVER_PII_KEY: PK, LUMEN_TEACHER_KEY: KEY });
  const run5 = cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env: envK, encoding: 'utf8' });
  const pr5 = (run5.stdout || '') + (run5.stderr || ''), out5 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  let o7 = null; try { o7 = await core.nbOpen(out5.naver_bookings_pii, PK); } catch (e) { o7 = null; }
  t('명령줄(환경변수 둘 다): NAVER_PII_KEY 로 잠금 · kk pii · kid 기록', run5.status === 0 && !!o7 && out5.naver_bookings_pii.kk === 'pii' && out5.naver_bookings_pii.kid === (await core.nbKid(PK)) && /열쇠 NAVER_PII_KEY/.test(pr5), pr5.slice(0, 300));
  const leak5 = secrets.concat(STU.map((s) => s.name), ['F0000', KEY, PK, 'passphrase', out5.naver_bookings_pii.kid]).filter((x) => x && pr5.indexOf(x) >= 0);
  t('명령줄 찍힌 글에 이름·전화·메모·열쇠·열쇠 지문 없음', leak5.length === 0, leak5.slice(0, 5).join(' / '));
  const pub5 = JSON.stringify(out5.naver_bookings);
  t('명령줄: 공개 칸(naver_bookings)에 이름·전화·열쇠 없음', secrets.concat([KEY, PK]).every((x) => pub5.indexOf(x) < 0));
  fs.writeFileSync(fxFile, JSON.stringify(FX));

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

  /* ── 기억한 전화 (원장 2026-10-17 「연결」) — 명단 전화 칸이 비어 있어도, 한 번 직접 연결한 학부모 전화로 다음 예약을 자동 연결 ── */
  const SK = 'fake-service-key-for-test', SK2 = 'other-fake-service-key';
  const STU2 = STU.concat([
    { id: 'S6', name: '가짜육', lumen_rec_code: 'F00006', parentPhone: '', group: 'M2' },
    { id: 'S7', name: '형제칠', lumen_rec_code: 'F00007', parentPhone: '', group: 'M1' },
    { id: 'S8', name: '형제팔', lumen_rec_code: 'F00008', parentPhone: '', group: 'M1' }]);
  const P6 = '010-2222-0006', P7 = '010-2222-0007', P10 = '010-2222-0010';
  const L = [];
  L.push(bk(Object.assign(at(D(1), '10:00'), { phone: P6, requestMessage: '잘 부탁드립니다' })));            /* 0 직접 → S6 (가르침) */
  L.push(bk(Object.assign(at(D(2), '10:00'), { phone: P6, requestMessage: '또 예약합니다' })));              /* 1 같은 전화 → S6 learned */
  L.push(bk(Object.assign(at(D(3), '10:00'), { phone: '+82 10-2222-0006', requestMessage: '' })));           /* 2 +82 모양 → S6 learned */
  L.push(bk(Object.assign(at(D(1), '11:00'), { phone: P7 })));                                              /* 3 직접 → S7 */
  L.push(bk(Object.assign(at(D(1), '12:00'), { phone: P7 })));                                              /* 4 직접 → S8 (형제) */
  L.push(bk(Object.assign(at(D(2), '11:00'), { phone: P7, requestMessage: '잘 부탁드려요' })));              /* 5 형제 전화 · 이름 없음 → 후보만 */
  L.push(bk(Object.assign(at(D(2), '12:00'), { phone: P7, requestMessage: '형제팔 보강 예약' })));           /* 6 형제 전화 + 이름 → S8 learned */
  L.push(bk(Object.assign(at(D(1), '13:00'), { phone: P10 })));                                             /* 7 직접 「명단에 없음」 → 안 가르침 */
  L.push(bk(Object.assign(at(D(2), '13:00'), { phone: P10, requestMessage: '' })));                          /* 8 같은 전화 → 못 맞춤 */
  L.push(bk(Object.assign(at(D(2), '14:00'), { phone: '010-1111-0001', requestMessage: '' })));              /* 9 명단 전화 S1 (직접 연결 B[10] 은 S3 를 가르쳤지만 명단이 먼저) */
  L.forEach((b) => { b.snapshotJson.customFormInputJson = []; });
  const lid = (i) => String(L[i].bookingId);
  const LK = Object.assign({}, LINKS); LK[lid(0)] = 'S6'; LK[lid(3)] = 'S7'; LK[lid(4)] = 'S8'; LK[lid(7)] = '';
  const PG = [B.concat(L)];
  const ST2 = { or_studentdb: STU2, naver_booking_links: LK, naver_bookings_status: { at: '2026-10-16T00:00:00Z', ok: true } };
  const runL = async (store, opt) => { const w = {}, lg = []; const r = await col.run(Object.assign({ getJson: fio(opt.pages || PG), store: { get: async () => JSON.parse(JSON.stringify(store)), set: async (k, v) => { w[k] = v; return true; } }, teacherKey: KEY, serviceKey: SK, now: NOW, log: (...a) => lg.push(a.join(' ')) }, opt)); return { w, lg, r }; };
  const fpOf = (p, k) => col.phoneFp(core.nbDigits(p), col.phoneSecret(k || SK));
  let R = await runL(ST2, {});
  const PL = R.w.naver_phone_links, bL = {}; (R.w.naver_bookings.bookings || []).forEach((b) => { bL[b.id] = b; });
  const mkL = (i) => bL[lid(i)].match ? bL[lid(i)].match.stKey + ':' + bL[lid(i)].match.how : 'null';
  t('기억: naver_phone_links 저장 · 지문 24글자(16진) · 열쇠 지문', !!PL && Object.keys(PL.map).every((k) => /^[0-9a-f]{24}$/.test(k)) && /^[0-9a-f]{8}$/.test(PL.kid), JSON.stringify(PL && Object.keys(PL.map)));
  t('기억: 직접 연결이 가르침 → 지문 = S6 (from manual · n 1)', PL.map[fpOf(P6)] && PL.map[fpOf(P6)].stKey === 'S6' && PL.map[fpOf(P6)].from === 'manual' && PL.map[fpOf(P6)].n === 1, JSON.stringify(PL.map[fpOf(P6)]));
  t('기억: 같은 전화 다른 예약 → S6 learned (+82 모양도)', mkL(1) === 'S6:learned' && mkL(2) === 'S6:learned' && bL[lid(1)].match.code === 'F00006', mkL(1) + ' ' + mkL(2));
  t('기억: 가르친 예약 자신은 직접(manual)', mkL(0) === 'S6:manual', mkL(0));
  t('기억: 형제(한 전화 → 두 학생 직접) → cands 만 · stKey 없음', !PL.map[fpOf(P7)].stKey && (PL.map[fpOf(P7)].cands || []).join() === 'S7,S8', JSON.stringify(PL.map[fpOf(P7)]));
  t('기억: 형제 전화 · 이름 없음 → 자동 연결 안 함 + 후보 2명', mkL(5) === 'null' && (bL[lid(5)].cands || []).join() === 'S7,S8', JSON.stringify(bL[lid(5)]));
  t('기억: 형제 전화 + 메모에 이름 → S8 learned', mkL(6) === 'S8:learned', mkL(6));
  t('기억: 「명단에 없음」은 가르치지 않음', !PL.map[fpOf(P10)] && mkL(8) === 'null', mkL(8));
  t('기억: 명단 전화가 기억보다 먼저 (직접 B[10]→S3 이 같은 전화를 가르쳐도 S1 phone)', PL.map[fpOf('010-1111-0001')] && PL.map[fpOf('010-1111-0001')].stKey === 'S3' && mkL(9) === 'S1:phone', mkL(9));
  t('기억: counts.how.learned 3 · phoneMemo 3', R.w.naver_bookings.counts.how.learned === 3 && R.w.naver_bookings.counts.phoneMemo === 3, JSON.stringify(R.w.naver_bookings.counts));
  t('기억 로그: 「기억한 전화 3개 · 기억으로 연결 3건」', R.lg.some((x) => x.indexOf('기억한 전화 3개 · 기억으로 연결 3건') >= 0), R.lg.join(' | '));
  const rawPh = []; L.concat(B).forEach((b) => { const d = core.nbDigits(b.phone); rawPh.push(d, d.slice(1), d.slice(3), core.nbFmtPhone(d), String(b.phone)); });
  const notBox = JSON.stringify(Object.keys(R.w).filter((k) => k !== 'naver_bookings_pii').map((k) => R.w[k]));
  t('기억: 잠근 상자 밖 어디에도 전화번호 없음(숫자·하이픈·뒷자리)', rawPh.every((x) => notBox.indexOf(x) < 0), rawPh.filter((x) => notBox.indexOf(x) >= 0).slice(0, 3).join());
  t('기억 로그에 전화·지문 없음', rawPh.concat(Object.keys(PL.map)).every((x) => R.lg.join('\n').indexOf(x) < 0));
  t('지문: 서버 비밀값이 다르면 다름 · 같은 번호 모양은 같음', fpOf(P6, SK) !== fpOf(P6, SK2) && fpOf(P6) === fpOf('+82 10 2222 0006') && fpOf(P6).length === 24);

  /* 다음 실행: 가르친 예약은 이제 안 받아도(오래돼 빠짐) 기억은 남는다 · 새 예약(다른 번호)도 자동 */
  const ST3 = Object.assign({}, ST2, { naver_phone_links: PL });
  const NEW = bk(Object.assign(at(D(5), '10:00'), { phone: P6, requestMessage: '' })); NEW.snapshotJson.customFormInputJson = [];
  R = await runL(ST3, { pages: [B.concat([L[1], NEW])] });
  const nb = (R.w.naver_bookings.bookings || []).filter((b) => b.id === String(NEW.bookingId))[0];
  t('다음 실행: 같은 전화 새 예약 → S6 learned (가르친 예약이 목록에 없어도)', nb && nb.match && nb.match.stKey === 'S6' && nb.match.how === 'learned', JSON.stringify(nb));
  t('다음 실행: 기억이 그대로면 naver_phone_links 다시 쓰지 않음', !R.w.naver_phone_links, Object.keys(R.w).join());
  /* 「직접 연결 풀기」 → 그 예약이 가르친 것을 잊음 · 다른 학생으로 바꾸면 나중 것이 이김 */
  const LK2 = Object.assign({}, LK); delete LK2[lid(0)]; LK2[lid(3)] = 'S1'; LK2[lid(4)] = 'S1';
  R = await runL(Object.assign({}, ST3, { naver_booking_links: LK2 }), { pages: [B.concat([L[1]])] });
  const PL2 = R.w.naver_phone_links;
  t('연결 풀기 → 잊음 · 형제 둘 다 S1 로 바꿈 → stKey S1 (나중 것)', PL2 && !PL2.map[fpOf(P6)] && PL2.map[fpOf(P7)] && PL2.map[fpOf(P7)].stKey === 'S1' && !PL2.map[fpOf(P7)].cands, JSON.stringify(PL2 && PL2.map));
  /* 「명단에 없음」으로 바꿔도 지우지 않음 */
  const LK3 = Object.assign({}, LK); LK3[lid(0)] = '';
  R = await runL(Object.assign({}, ST3, { naver_booking_links: LK3 }), { pages: [B.concat([L[1]])] });
  t('「명단에 없음」으로 바꿔도 기억은 그대로', !R.w.naver_phone_links && (R.w.naver_bookings.bookings.filter((b) => b.id === lid(1))[0].match || {}).how === 'learned');
  /* 서버 비밀값이 바뀌면 옛 지문은 버리고 새로 */
  R = await runL(ST3, { serviceKey: SK2 });
  const PL3 = R.w.naver_phone_links;
  t('비밀값이 바뀌면 열쇠 지문이 달라 새 지문으로 다시 만듦', PL3 && PL3.kid !== PL.kid && !PL3.map[fpOf(P6)] && PL3.map[fpOf(P6, SK2)] && PL3.map[fpOf(P6, SK2)].stKey === 'S6');
  /* 비밀값 없음 → 기억 쉼 */
  R = await runL(ST3, { serviceKey: '' });
  t('SUPABASE_SERVICE_KEY 없으면 기억 쉼(쓰지 않음 · learned 0)', !R.w.naver_phone_links && !R.w.naver_bookings.counts.how.learned);
  /* 명령줄 --fixture (서버 비밀값 있음) — 찍힌 글·--out 파일에 전화 없음 */
  fs.writeFileSync(fxFile, JSON.stringify({ items: ITEMS, pages: PG, store: ST2, teacherKey: KEY, serviceKey: SK }));
  const run4 = cp.spawnSync(process.execPath, [path.join(__dirname, 'naver_booking_collect.js'), '--fixture', fxFile, '--out', outFile, '--now', NOW], { env, encoding: 'utf8' });
  const out4 = JSON.parse(fs.readFileSync(outFile, 'utf8')); delete out4.naver_bookings_pii;
  const o4 = JSON.stringify(out4), p4 = (run4.stdout || '') + (run4.stderr || '');
  t('명령줄: --out 에 naver_phone_links · 전화번호 없음 · 찍힌 글에도 없음', run4.status === 0 && !!out4.naver_phone_links && rawPh.every((x) => o4.indexOf(x) < 0 && p4.indexOf(x) < 0) && /기억한 전화 3개/.test(p4), p4.slice(0, 400));

  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
