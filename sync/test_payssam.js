#!/usr/bin/env node
/**
 * 결제선생 수집기 점검 — 계약 docs/payssam_contract.md §4
 * ============================================================================
 * 결제선생 서버에 접속하지 않고(이 환경에서는 포트가 막혀 있다),
 * 실측해 둔 응답 모양 그대로 만든 "가짜 자료"를 수집기의 순수 함수에 넣어
 * 저장 모양 4개(pay_payments·pay_bills·pay_monthly·pay_students)와
 * 달 집계 수치, 이름 매칭(동명이인·미매칭)이 맞는지 검사한다.
 *
 * 가짜 자료: 결제 5건(취소 1) · 청구 6건(수납 3 · 미납 2 · 취소 1) · 청구 요약 · 매출 보고서
 *
 * 실행: node sync/test_payssam.js
 */
'use strict';

const C = require('./payssam_collector.js');

/* ── 아주 작은 검사 도구 ── */
let pass = 0; const fails = [];
function ok(label, cond) { if (cond) { pass++; console.log('  ✅ ' + label); } else { fails.push(label); console.log('  ❌ ' + label); } }
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✅ ' + label + ' = ' + w); }
  else { fails.push(label); console.log('  ❌ ' + label + ' → 받은 값 ' + g + ' / 기대 ' + w); }
}

/* ── 가짜 시각(한국 낮 12시) 만들기 ── */
const ms = (y, m, d) => Date.UTC(y, m - 1, d, 3, 0, 0);   // 03:00 UTC = 12:00 KST

/* ═════════ 가짜 결제 5건 (payment/detail/v2 의 info 모양) ═════════ */
const payRows = [
  { txID: 'T001', state: 'ALL', approvalState: 'APPROVAL', customerName: '김하준', customerPhone: '010-1234-5678',
    reason: '9월 수강료', amount: 350000, approvalOriginDatetime: ms(2026, 9, 3), approvalDatetime: ms(2026, 9, 3),
    approvalMonthly: 0, payType: 'CARD', ledgerAndPayTypeName: '신용카드', studentSeq: 101,
    approvalSupplyAmount: 350000, approvalTaxAmount: 0 },
  { txID: 'T002', state: 'ALL', approvalState: 'APPROVAL', customerName: '이서연', customerPhone: '010-2222-3333',
    reason: '9월 수강료', amount: 300000, approvalOriginDatetime: ms(2026, 9, 5), approvalDatetime: ms(2026, 9, 5),
    approvalMonthly: 3, payType: 'CARD', ledgerAndPayTypeName: '신용카드(3개월)', studentSeq: 201,
    approvalSupplyAmount: 300000, approvalTaxAmount: 0 },
  { txID: 'T003', state: 'ALL', approvalState: 'APPROVAL', customerName: '박민준', customerPhone: '010-4444-5555',
    reason: '9월 수강료', amount: 280000, approvalOriginDatetime: ms(2026, 9, 7), approvalDatetime: ms(2026, 9, 7),
    approvalMonthly: 0, payType: 'CARD', ledgerAndPayTypeName: '신용카드', studentSeq: 301,
    approvalSupplyAmount: 280000, approvalTaxAmount: 0 },
  // 동명이인(박민준) — 전화 뒤 4자리와 studentSeq 가 다르다
  { txID: 'T004', state: 'ALL', approvalState: 'APPROVAL', customerName: '박민준', customerPhone: '010-7777-8888',
    reason: '9월 교재비', amount: 250000, approvalOriginDatetime: ms(2026, 9, 8), approvalDatetime: ms(2026, 9, 8),
    approvalMonthly: 0, payType: 'TRANSFER', ledgerAndPayTypeName: '계좌이체', studentSeq: 302,
    approvalSupplyAmount: 250000, approvalTaxAmount: 0 },
  // 취소 건 — 승인은 9/2, 취소는 9/10
  { txID: 'T005', state: 'ALL', approvalState: 'CANCEL', customerName: '최윤아', customerPhone: '010-6666-7777',
    reason: '9월 수강료', amount: 300000, approvalOriginDatetime: ms(2026, 9, 2), approvalDatetime: ms(2026, 9, 10),
    approvalMonthly: 0, payType: 'CARD', ledgerAndPayTypeName: '신용카드', studentSeq: 401,
    approvalSupplyAmount: 300000, approvalTaxAmount: 0 },
];

/* ═════════ 가짜 청구 6건 (bill/detail/v2/unpaid/bills 의 info 모양) ═════════ */
const billRows = [
  { billId: 'B001', txID: 'T001', state: 'BILL_PAID', billingDatetime: ms(2026, 9, 1), billingReason: '9월 수강료',
    amount: 350000, customerName: '김하준', customerPhone: '010-1234-5678', approvalState: 'APPROVAL',
    resendCount: 0, destroyDatetime: null, payType: 'CARD', approvalDatetime: ms(2026, 9, 3), studentSeq: 101 },
  { billId: 'B002', txID: 'T002', state: 'BILL_PAID', billingDatetime: ms(2026, 9, 1), billingReason: '9월 수강료',
    amount: 300000, customerName: '이서연', customerPhone: '010-2222-3333', approvalState: 'APPROVAL',
    resendCount: 1, destroyDatetime: null, payType: 'CARD', approvalDatetime: ms(2026, 9, 5), studentSeq: 201 },
  { billId: 'B003', txID: 'T003', state: 'BILL_PAID', billingDatetime: ms(2026, 9, 1), billingReason: '9월 수강료',
    amount: 280000, customerName: '박민준', customerPhone: '010-4444-5555', approvalState: 'APPROVAL',
    resendCount: 0, destroyDatetime: null, payType: 'CARD', approvalDatetime: ms(2026, 9, 7), studentSeq: 301 },
  // 미납 2건
  { billId: 'B004', txID: null, state: 'BILL_SENT', billingDatetime: ms(2026, 9, 1), billingReason: '9월 수강료',
    amount: 320000, customerName: '정도윤', customerPhone: '010-8888-1111', approvalState: null,
    resendCount: 0, destroyDatetime: null, payType: null, approvalDatetime: null, studentSeq: 501 },
  { billId: 'B005', txID: null, state: 'BILL_SENT', billingDatetime: ms(2026, 9, 2), billingReason: '9월 수강료',
    amount: 300000, customerName: '한지우', customerPhone: '010-9999-2222', approvalState: null,
    resendCount: 2, destroyDatetime: null, payType: null, approvalDatetime: null, studentSeq: 601 },
  // 취소 1건 (결제됐다가 취소)
  { billId: 'B006', txID: 'T005', state: 'BILL_CANCEL', billingDatetime: ms(2026, 9, 1), billingReason: '9월 수강료',
    amount: 300000, customerName: '최윤아', customerPhone: '010-6666-7777', approvalState: 'CANCEL',
    resendCount: 0, destroyDatetime: null, payType: 'CARD', approvalDatetime: ms(2026, 9, 2), studentSeq: 401 },
];

/* ═════════ 가짜 청구 요약 · 매출 보고서 (달마다) ═════════ */
const countByMonth = {
  '2026-09': {
    totalSendCount: 6, totalSendAmount: 1850000,
    paidCount: 3, paidAmount: 930000, paidPercentage: 50.3,
    nonPaidCount: 2, nonPaidAmount: 620000,
    cancelledCount: 1, cancelledAmount: 300000,
    destroyedCount: 0, destroyedAmount: 0,
  },
};
const reportByMonth = {
  '2026-09': {
    info: [
      { payMethodName: '신용카드', totalApprovalAmount: 1230000, totalCancelAmount: 300000, totalAmount: 930000, totalCount: 4 },
      { payMethodName: '계좌이체', totalApprovalAmount: 250000, totalCancelAmount: 0, totalAmount: 250000, totalCount: 1 },
    ],
    totalApprovalAmountReport: 1480000,
    totalCancelAmountReport: 300000,
    totalAmountReport: 1180000,
    totalCountReport: 5,
  },
};

/* ═════════════════════ 1. pay_payments ═════════════════════ */
console.log('\n【1】 결제 파싱 (pay_payments.items)');
const payments = C.parsePayments(payRows);
eq('건수', payments.length, 5);
eq('합계(원)', payments.reduce((s, p) => s + p.amount, 0), 1480000);
eq('전화는 뒤 4자리만', payments.map((p) => p.phone4), ['5678', '3333', '5555', '8888', '7777']);
ok('전화 원본이 남지 않았다', !JSON.stringify(payments).includes('010-'));
eq('첫 건 승인시각(ISO)', payments[0].approvedAt, new Date(ms(2026, 9, 3)).toISOString());
eq('첫 건 취소시각 없음', payments[0].cancelledAt, null);
eq('취소 건 취소시각(ISO)', payments[4].cancelledAt, new Date(ms(2026, 9, 10)).toISOString());
eq('취소 건도 최초 승인시각은 남는다', payments[4].approvedAt, new Date(ms(2026, 9, 2)).toISOString());
eq('할부 개월', payments[1].monthly, 3);
eq('결제수단 이름(ledger)', payments[3].ledger, '계좌이체');
eq('공급가·부가세', [payments[0].supply, payments[0].tax], [350000, 0]);
ok('계약 §1 칸이 모두 있다', payments.every((p) => ['txID', 'name', 'phone4', 'amount', 'approvedAt', 'cancelledAt', 'state', 'approvalState', 'monthly', 'reason', 'payType', 'ledger', 'studentSeq', 'supply', 'tax'].every((k) => k in p)));

/* ═════════════════════ 2. pay_bills ═════════════════════ */
console.log('\n【2】 청구 파싱 (pay_bills.items)');
const bills = C.parseBills(billRows);
eq('건수', bills.length, 6);
eq('합계(원)', bills.reduce((s, b) => s + b.amount, 0), 1850000);
eq('수납 건수(paidAt 있음)', bills.filter((b) => b.paidAt).length, 3);
eq('미납 건수(paidAt 없고 취소 아님)', bills.filter((b) => !b.paidAt && !/CANCEL/.test(String(b.state))).length, 2);
eq('취소 건은 수납으로 세지 않는다', bills[5].paidAt, null);
eq('청구 시각(ISO)', bills[0].billedAt, new Date(ms(2026, 9, 1)).toISOString());
eq('재발송 횟수', bills[4].resendCount, 2);
eq('품목(billingReason)', bills[0].reason, '9월 수강료');
ok('전화 원본이 남지 않았다', !JSON.stringify(bills).includes('010-'));
ok('계약 §1 칸이 모두 있다', bills.every((b) => ['billId', 'txID', 'name', 'phone4', 'amount', 'billedAt', 'paidAt', 'state', 'approvalState', 'reason', 'payType', 'studentSeq', 'resendCount', 'destroyedAt'].every((k) => k in b)));

/* ═════════════════════ 3. pay_monthly ═════════════════════ */
console.log('\n【3】 달 집계 (pay_monthly.byMonth) — 요약 API 를 받은 경우');
const byMonth = C.buildMonthly(countByMonth, reportByMonth, payments, bills);
eq('달 목록', Object.keys(byMonth), ['2026-09']);
const m9 = byMonth['2026-09'];
eq('청구', [m9.billed.count, m9.billed.amount], [6, 1850000]);
eq('수납', [m9.paid.count, m9.paid.amount], [3, 930000]);
eq('수납률(API 값 그대로)', m9.paid.pct, 50.3);
eq('미납', [m9.unpaid.count, m9.unpaid.amount], [2, 620000]);
eq('취소', [m9.cancelled.count, m9.cancelled.amount], [1, 300000]);
eq('파기', [m9.destroyed.count, m9.destroyed.amount], [0, 0]);
eq('매출 승인−취소=합계', [m9.sales.approval, m9.sales.cancel, m9.sales.total], [1480000, 300000, 1180000]);
eq('매출 건수', m9.sales.count, 5);
eq('결제수단별', m9.sales.byMethod.map((x) => x.name + ':' + x.total), ['신용카드:930000', '계좌이체:250000']);

console.log('\n【3-2】 요약 API 를 못 받은 경우 — 목록만으로 직접 셈');
const byMonth2 = C.buildMonthly({}, {}, payments, bills);
const f9 = byMonth2['2026-09'];
eq('청구(직접 셈)', [f9.billed.count, f9.billed.amount], [6, 1850000]);
eq('수납(직접 셈)', [f9.paid.count, f9.paid.amount], [3, 930000]);
eq('미납(직접 셈)', [f9.unpaid.count, f9.unpaid.amount], [2, 620000]);
eq('취소(직접 셈)', [f9.cancelled.count, f9.cancelled.amount], [1, 300000]);
eq('수납률(직접 셈)', f9.paid.pct, Math.round(930000 / 1850000 * 1000) / 10);
eq('매출(직접 셈) 승인−취소=합계', [f9.sales.approval, f9.sales.cancel, f9.sales.total], [1480000, 300000, 1180000]);

/* ═════════════════════ 4. pay_students ═════════════════════ */
console.log('\n【4】 학생 목록 (pay_students.byName)');
const byName = C.buildStudents(payments, bills);
eq('이름 수(동명이인은 한 칸)', Object.keys(byName).length, 6);
eq('김하준 studentSeq', byName['김하준'].studentSeq, 101);
eq('김하준 전화 뒤 4자리', byName['김하준'].phone4, '5678');
eq('김하준 마지막 청구일', byName['김하준'].lastBilledAt, new Date(ms(2026, 9, 1)).toISOString());
eq('김하준 마지막 납부일', byName['김하준'].lastPaidAt, new Date(ms(2026, 9, 3)).toISOString());
eq('한지우(미납만) 납부일 없음', byName['한지우'].lastPaidAt, null);
eq('최윤아(취소만) 납부일 없음', byName['최윤아'].lastPaidAt, null);
ok('동명이인 박민준은 alts 로 둘 다 남는다', !!byName['박민준'].alts && byName['박민준'].alts.length === 1);
eq('박민준 두 사람의 전화 뒤 4자리',
  [byName['박민준'].phone4].concat(byName['박민준'].alts.map((a) => a.phone4)).sort(), ['5555', '8888']);
eq('박민준 두 사람의 studentSeq',
  [byName['박민준'].studentSeq].concat(byName['박민준'].alts.map((a) => a.studentSeq)).sort(), [301, 302]);

/* ═════════════════════ 5. 학원앱 명단 매칭 (§1 규칙) ═════════════════════ */
console.log('\n【5】 학원앱 명단 매칭 — 이름 일치 → 동명이인이면 전화 뒤 4자리 → 못 맞추면 미매칭');
// 학원앱 명단 흉내 (동명이인 1쌍 · 결제선생에 없는 학생 1명)
const roster = [
  { name: '김하준', parentPhone: '010-1234-5678' },
  { name: '이서연', parentPhone: '010-2222-3333' },
  { name: '박민준', parentPhone: '010-4444-5555' },   // 동명이인 A
  { name: '박민준', parentPhone: '010-7777-8888' },   // 동명이인 B
  { name: '강서윤', parentPhone: '010-5555-0000' },   // 결제선생에 없음 → 미매칭
];
const tail4 = (s) => String(s || '').replace(/\D/g, '').slice(-4);
function matchOne(stu) {
  const e = byName[stu.name];
  if (!e) return null;                                   // 이름조차 없음
  const cands = [e].concat(e.alts || []);
  if (cands.length === 1) return cands[0];               // 이름 하나뿐 → 그대로
  return cands.find((c) => c.phone4 && c.phone4 === tail4(stu.parentPhone)) || null; // 동명이인 → 전화로
}
const matched = roster.map(matchOne);
eq('명단 5명 중 맞춘 수', matched.filter(Boolean).length, 4);
eq('동명이인 A → seq 301', matched[2] && matched[2].studentSeq, 301);
eq('동명이인 B → seq 302', matched[3] && matched[3].studentSeq, 302);
eq('강서윤은 미매칭(null)', matched[4], null);
// 반대 방향: 결제선생에는 있는데 명단에 없는 이름 = 「미매칭」 묶음
const rosterNames = new Set(roster.map((r) => r.name));
const orphan = Object.keys(byName).filter((n) => !rosterNames.has(n)).sort();
eq('명단에 없는 결제선생 이름', orphan, ['정도윤', '최윤아', '한지우']);

/* ═════════════════════ 6. 저장 모양 전체 ═════════════════════ */
console.log('\n【6】 저장 모양 4개');
const updated = new Date().toISOString();
const store = {
  pay_payments: { updated, from: '20260519', to: '20260916', items: payments },
  pay_bills: { updated, from: '20260519', to: '20260916', items: bills },
  pay_monthly: { updated, byMonth },
  pay_students: { updated, byName },
};
eq('키 4개', Object.keys(store).sort(), ['pay_bills', 'pay_monthly', 'pay_payments', 'pay_students']);
ok('pay_bills 에 updated·from·to·items', ['updated', 'from', 'to', 'items'].every((k) => k in store.pay_bills));
ok('pay_monthly 에 updated·byMonth', ['updated', 'byMonth'].every((k) => k in store.pay_monthly));
ok('pay_students 에 updated·byName', ['updated', 'byName'].every((k) => k in store.pay_students));
ok('JSON 으로 저장 가능', (() => { try { JSON.parse(JSON.stringify(store)); return true; } catch (e) { return false; } })());
ok('저장본에 전화 원본·주민번호 형태 없음', !/010-\d{4}-\d{4}/.test(JSON.stringify(store)));

/* ═════════════════════ 마무리 ═════════════════════ */
console.log('\n────────────────────────────────────────');
if (fails.length) {
  console.log(`❌ 실패 ${fails.length}건 / 통과 ${pass}건`);
  fails.forEach((f) => console.log('   · ' + f));
  process.exit(1);
}
console.log(`✅ 모두 통과 — 검사 ${pass}건 (결제 5건 · 청구 6건[수납 3·미납 2·취소 1] · 달 집계 · 이름 매칭)`);
