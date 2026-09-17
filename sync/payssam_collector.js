#!/usr/bin/env node
/**
 * 결제선생(payssam) 수납 수집기 — 계약 docs/payssam_contract.md §0·§1·§2
 * ============================================================================
 * 하는 일 (하루 한 번, GitHub Actions에서):
 *   ① Playwright로 결제선생 매니저(manager.payssam.kr)에 로그인한다.
 *   ② /bills 화면을 열어 브라우저가 내부 주소(manager-api.payssam.kr:10023)를
 *      부를 때 쓰는 "인증 헤더"를 그대로 베낀다. (값은 절대 로그에 안 남긴다)
 *   ③ 그 헤더로 결제 목록·청구 목록·달별 요약·매출 보고서를 직접 불러온다.
 *   ④ 계약 §1 모양으로 다듬어 Supabase `lumen_store` 에 4개 키로 저장한다.
 *        pay_bills · pay_payments · pay_monthly · pay_students
 *
 * 실행:
 *   node sync/payssam_collector.js               (최근 120일 · 최근 4개월 · 저장)
 *   node sync/payssam_collector.js --dry         (저장 안 함 · 건수와 합계만 출력)
 *   node sync/payssam_collector.js --days 30 --months 2
 *
 * 필요한 환경변수 (절대 코드에 넣지 않는다 — GitHub Secrets에만):
 *   PAYSSAM_ID, PAYSSAM_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * ⚠ 로그 규칙: 이 저장소는 공개이고 Actions 로그도 공개다.
 *   비밀번호·토큰·학생 이름·전화번호·개별 금액은 절대 찍지 않는다.
 *   남기는 것은 "건수 · 합계 · 달 · 단계 이름 · 상태코드 · 헤더 이름"뿐.
 *
 * ※ 이 작업 환경에서는 결제선생 포트(10023/10043)가 막혀 있어 실행 시험이 불가능하다.
 *   그래서 파싱·집계는 순수 함수로 떼어 두고 `sync/test_payssam.js` 가 가짜 자료로 검사한다.
 */

'use strict';

/* ═══════════════════════════ 0. 공통 도구 ═══════════════════════════ */

const PAY_API = 'https://api.payssam.kr:10043';        // 로그인 · 상점 목록
const MGR_API = 'https://manager-api.payssam.kr:10023'; // 화면이 쓰는 내부 주소

const t0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAP = 300; // 요청 사이 쉬는 시간(ms) — 상대 서버에 부담 주지 않기

/** 전화번호는 뒤 4자리만 남긴다 (개인정보 최소 수집) */
function phone4(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : '';
}
/** 밀리초(또는 숫자 문자열/ISO 문자열) → ISO 문자열. 못 읽으면 null */
function toIso(v) {
  if (v == null || v === '' || v === 0) return null;
  let ms = v;
  if (typeof v === 'string') {
    if (/^\d+$/.test(v)) ms = Number(v);
    else { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  }
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return null;
  if (ms < 1e12) ms *= 1000;              // 초 단위로 온 경우 보정
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
/** 숫자로 바꾸기 (콤마 낀 문자열도) */
function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}
/** ISO 문자열 → 'YYYY-MM' (한국 시간 기준) */
function monthOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + 9 * 3600 * 1000); // KST
  return k.toISOString().slice(0, 7);
}
/** 여러 후보 키 중 먼저 있는 값을 숫자로 */
function pickNum(obj, keys) {
  if (!obj) return 0;
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return num(obj[k]);
  return 0;
}
/** 여러 후보 키 중 먼저 있는 문자열 */
function pickStr(obj, keys) {
  if (!obj) return '';
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  return '';
}
/** 취소/파기 여부 판별 (state·approvalState 어디에 들어오든) */
const isCancelled = (r) => /CANCEL|취소/i.test(String(r.approvalState || '') + ' ' + String(r.state || ''));
const isDestroyed = (r) => !!r.destroyDatetime || /DESTROY|파기/i.test(String(r.state || ''));
const round1 = (n) => Math.round(n * 10) / 10;

/* ═══════════════ 1. 순수 함수 (test_payssam.js 가 검사하는 부분) ═══════════════ */

/**
 * 결제내역 원본 줄 → 계약 §1 `pay_payments.items` 모양
 * 원본 칸: txID,state,approvalState,customerName,customerPhone,reason,amount,
 *          approvalOriginDatetime,approvalDatetime(ms),approvalMonthly,payType,
 *          ledgerAndPayTypeName,studentSeq,approvalSupplyAmount,approvalTaxAmount
 * ※ 추정: approvalOriginDatetime = 최초 승인 시각, approvalDatetime = 마지막 사건 시각
 *   (취소 건이면 취소 시각). 그래서 취소 건의 cancelledAt 은 approvalDatetime 을 쓴다.
 */
function parsePayments(rows) {
  return (rows || []).map((r) => {
    const cancelled = isCancelled(r);
    const origin = toIso(r.approvalOriginDatetime);
    const last = toIso(r.approvalDatetime);
    return {
      txID: r.txID == null ? null : String(r.txID),
      name: String(r.customerName || '').trim(),
      phone4: phone4(r.customerPhone),
      amount: num(r.amount),
      approvedAt: origin || (cancelled ? null : last),
      cancelledAt: cancelled ? (last || origin || null) : null,
      state: r.state == null ? null : String(r.state),
      approvalState: r.approvalState == null ? null : String(r.approvalState),
      monthly: num(r.approvalMonthly),
      reason: String(r.reason || ''),
      payType: r.payType == null ? null : String(r.payType),
      ledger: r.ledgerAndPayTypeName == null ? null : String(r.ledgerAndPayTypeName),
      studentSeq: r.studentSeq == null ? null : r.studentSeq,
      supply: num(r.approvalSupplyAmount),
      tax: num(r.approvalTaxAmount),
    };
  });
}

/**
 * 청구서 원본 줄 → 계약 §1 `pay_bills.items` 모양
 * 원본 칸: billId,txID,state,billingDatetime(ms),billingReason,amount,customerName,
 *          customerPhone,approvalState,resendCount,destroyDatetime,payType,
 *          approvalDatetime,studentSeq
 */
function parseBills(rows) {
  return (rows || []).map((r) => {
    const cancelled = isCancelled(r);
    const paidAt = toIso(r.approvalDatetime);
    return {
      billId: r.billId == null ? null : String(r.billId),
      txID: r.txID == null ? null : String(r.txID),
      name: String(r.customerName || '').trim(),
      phone4: phone4(r.customerPhone),
      amount: num(r.amount),
      billedAt: toIso(r.billingDatetime),
      paidAt: cancelled ? null : paidAt,   // 취소 건은 납부로 보지 않는다
      state: r.state == null ? null : String(r.state),
      approvalState: r.approvalState == null ? null : String(r.approvalState),
      reason: String(r.billingReason || r.reason || ''),
      payType: r.payType == null ? null : String(r.payType),
      studentSeq: r.studentSeq == null ? null : r.studentSeq,
      resendCount: num(r.resendCount),
      destroyedAt: toIso(r.destroyDatetime),
    };
  });
}

/** 매출 보고서 응답에서 결제수단별 줄을 찾아낸다 (응답 칸 이름이 확실치 않아 너그럽게 읽음) */
function methodRows(report) {
  if (!report) return [];
  if (Array.isArray(report)) return report;
  for (const k of ['info', 'list', 'data', 'reports', 'report', 'items', 'result']) {
    if (Array.isArray(report[k])) return report[k];
  }
  // 그 밖: 배열인 아무 칸이나 (객체 줄이 들어 있는 것)
  for (const k of Object.keys(report)) {
    const v = report[k];
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
  }
  return [];
}

/** 매출 보고서 → {approval, cancel, total, count, byMethod:[…]} */
function parseReport(report) {
  const rows = methodRows(report);
  const byMethod = rows.map((r) => {
    const approval = pickNum(r, ['totalApprovalAmount', 'approvalAmount', 'approvalTotalAmount', 'approval', 'approvalSum']);
    const cancel = pickNum(r, ['totalCancelAmount', 'cancelAmount', 'cancelTotalAmount', 'cancel', 'cancelSum']);
    let total = pickNum(r, ['totalAmount', 'sumAmount', 'total', 'amount']);
    if (!total) total = approval - cancel;
    return {
      name: pickStr(r, ['payMethodName', 'paymentMethodTypeName', 'paymentMethodName', 'ledgerAndPayTypeName', 'typeName', 'name', 'type', 'payType', 'reportType']) || '기타',
      approval, cancel, total,
      count: pickNum(r, ['totalCount', 'approvalCount', 'count', 'cnt']),
    };
  });
  const src = Array.isArray(report) ? {} : (report || {});
  let approval = pickNum(src, ['totalApprovalAmountReport', 'totalApprovalAmount', 'approvalAmount', 'sumApprovalAmount']);
  let cancel = pickNum(src, ['totalCancelAmountReport', 'totalCancelAmount', 'cancelAmount', 'sumCancelAmount']);
  let total = pickNum(src, ['totalAmountReport', 'totalSumAmount', 'totalAmount']);
  let count = pickNum(src, ['totalCountReport', 'totalCount', 'approvalCount']);
  if (!approval) approval = byMethod.reduce((s, m) => s + m.approval, 0);
  if (!cancel) cancel = byMethod.reduce((s, m) => s + m.cancel, 0);
  if (!count) count = byMethod.reduce((s, m) => s + m.count, 0);
  if (!total) total = approval - cancel;
  return { approval, cancel, total, count, byMethod };
}

/**
 * 달별 집계 — 계약 §1 `pay_monthly.byMonth`
 *  countByMonth  : { 'YYYY-MM': /bill/detail/v2/count 응답 }   (없으면 청구 목록으로 직접 셈)
 *  reportByMonth : { 'YYYY-MM': /merchant/sales/v2/report 응답 } (없으면 결제 목록으로 직접 셈)
 *  payments·bills: parsePayments/parseBills 결과
 */
function buildMonthly(countByMonth, reportByMonth, payments, bills) {
  countByMonth = countByMonth || {};
  reportByMonth = reportByMonth || {};
  payments = payments || [];
  bills = bills || [];

  // 다룰 달 모으기: count·report 로 받은 달 + 자료에 들어 있는 달
  const months = new Set([].concat(Object.keys(countByMonth), Object.keys(reportByMonth)));
  bills.forEach((b) => { const m = monthOf(b.billedAt); if (m) months.add(m); });
  payments.forEach((p) => { const m = monthOf(p.approvedAt || p.cancelledAt); if (m) months.add(m); });

  const byMonth = {};
  Array.from(months).sort().forEach((m) => {
    const mb = bills.filter((b) => monthOf(b.billedAt) === m);
    const mp = payments.filter((p) => monthOf(p.approvedAt || p.cancelledAt) === m);
    const c = countByMonth[m];

    // ── 청구·수납·미납·취소·파기 ──
    let billed, paid, unpaid, cancelled, destroyed;
    if (c) {
      billed = { count: pickNum(c, ['totalSendCount']), amount: pickNum(c, ['totalSendAmount']) };
      paid = { count: pickNum(c, ['paidCount']), amount: pickNum(c, ['paidAmount']), pct: 0 };
      unpaid = { count: pickNum(c, ['nonPaidCount', 'unpaidCount']), amount: pickNum(c, ['nonPaidAmount', 'unpaidAmount']) };
      cancelled = { count: pickNum(c, ['cancelledCount', 'cancelCount']), amount: pickNum(c, ['cancelledAmount', 'cancelAmount']) };
      destroyed = { count: pickNum(c, ['destroyedCount', 'destroyCount']), amount: pickNum(c, ['destroyedAmount', 'destroyAmount']) };
      const apiPct = pickNum(c, ['paidPercentage', 'paidPercent']);
      paid.pct = apiPct || (billed.amount ? round1(paid.amount / billed.amount * 100) : 0);
    } else {
      // count 응답이 없으면 청구 목록으로 직접 센다
      const okBills = mb.filter((b) => !isDestroyed({ destroyDatetime: b.destroyedAt, state: b.state }));
      const paidB = okBills.filter((b) => b.paidAt);
      const cancelB = mb.filter((b) => /CANCEL|취소/i.test(String(b.approvalState || '') + ' ' + String(b.state || '')));
      const destroyB = mb.filter((b) => b.destroyedAt);
      const unpaidB = okBills.filter((b) => !b.paidAt && !cancelB.includes(b));
      const sum = (a) => a.reduce((s, x) => s + num(x.amount), 0);
      billed = { count: mb.length, amount: sum(mb) };
      paid = { count: paidB.length, amount: sum(paidB), pct: 0 };
      unpaid = { count: unpaidB.length, amount: sum(unpaidB) };
      cancelled = { count: cancelB.length, amount: sum(cancelB) };
      destroyed = { count: destroyB.length, amount: sum(destroyB) };
      paid.pct = billed.amount ? round1(paid.amount / billed.amount * 100) : 0;
    }

    // ── 매출 보고서 ──
    let sales;
    if (reportByMonth[m]) sales = parseReport(reportByMonth[m]);
    else {
      const okP = mp.filter((p) => !p.cancelledAt);
      const cxP = mp.filter((p) => p.cancelledAt);
      const sum = (a) => a.reduce((s, x) => s + num(x.amount), 0);
      const approval = sum(okP) + sum(cxP), cancel = sum(cxP);
      sales = { approval, cancel, total: approval - cancel, count: mp.length, byMethod: [] };
    }

    byMonth[m] = { billed, paid, unpaid, cancelled, destroyed, sales };
  });
  return byMonth;
}

/**
 * 학생 목록 — 계약 §1 `pay_students.byName`
 * 결제·청구에 찍힌 이름으로 모은다 (학생 화면 API를 못 잡았기 때문).
 * 결제선생 쪽에 같은 이름이 둘 이상이면 `alts` 에 나머지를 담아 둔다(전화 뒤 4자리로 구분용).
 */
function buildStudents(payments, bills) {
  const bySeq = new Map();   // '이름|seq|phone4' → 항목
  const touch = (name, seq, ph, billedAt, paidAt) => {
    name = String(name || '').trim();
    if (!name) return;
    const key = name + '|' + (seq == null ? '' : seq) + '|' + (ph || '');
    let e = bySeq.get(key);
    if (!e) { e = { name, studentSeq: seq == null ? null : seq, phone4: ph || '', lastBilledAt: null, lastPaidAt: null }; bySeq.set(key, e); }
    if (seq != null && e.studentSeq == null) e.studentSeq = seq;
    if (ph && !e.phone4) e.phone4 = ph;
    if (billedAt && (!e.lastBilledAt || billedAt > e.lastBilledAt)) e.lastBilledAt = billedAt;
    if (paidAt && (!e.lastPaidAt || paidAt > e.lastPaidAt)) e.lastPaidAt = paidAt;
  };
  (bills || []).forEach((b) => touch(b.name, b.studentSeq, b.phone4, b.billedAt, b.paidAt));
  // 취소된 결제는 "낸 것"으로 보지 않으므로 lastPaidAt 에 넣지 않는다
  (payments || []).forEach((p) => touch(p.name, p.studentSeq, p.phone4, null, p.cancelledAt ? null : p.approvedAt));

  // 이름별로 묶기 — 가장 최근에 움직인 항목을 대표로
  const groups = new Map();
  Array.from(bySeq.values()).forEach((e) => {
    const g = groups.get(e.name) || [];
    g.push(e); groups.set(e.name, g);
  });
  const last = (e) => e.lastPaidAt || e.lastBilledAt || '';
  const byName = {};
  groups.forEach((g, name) => {
    g.sort((a, b) => String(last(b)).localeCompare(String(last(a))));
    const head = g[0];
    const one = { studentSeq: head.studentSeq, phone4: head.phone4, lastBilledAt: head.lastBilledAt, lastPaidAt: head.lastPaidAt };
    if (g.length > 1) {
      one.alts = g.slice(1).map((e) => ({ studentSeq: e.studentSeq, phone4: e.phone4, lastBilledAt: e.lastBilledAt, lastPaidAt: e.lastPaidAt }));
    }
    byName[name] = one;
  });
  return byName;
}

/* ═══════════════════════ 2. Supabase 저장 (매쓰플랫 수집기와 같은 방식) ═══════════════════════ */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
function sbH(extra) { return Object.assign({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` }, extra || {}); }
async function storeGet(keys) {
  const url = SB_URL + '/rest/v1/lumen_store?key=in.(' + keys.join(',') + ')&select=key,value';
  try {
    const r = await fetch(url, { headers: { apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) return {};
    const rows = await r.json();
    const out = {};
    rows.forEach((x) => { out[x.key] = x.value; });
    return out;
  } catch (e) { return {}; }
}

async function storeSet(key, value) {
  if (!SB_URL || !SB_KEY) { log(`저장 건너뜀 (SUPABASE 환경변수 없음): ${key}`); return false; }
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST',
    headers: sbH({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) log(`lumen_store ${key} 저장 실패 ${r.status}`);
  else log(`lumen_store ${key} 저장 완료`);
  return r.ok;
}

/* ═══════════════════════ 3. 날짜 도구 (한국 시간 기준) ═══════════════════════ */

function kstNow() { return new Date(Date.now() + 9 * 3600 * 1000); }
let FORCE = false;                 // --force 일 때만 빈 결과로 덮어쓴다
function ymd(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }        // YYYYMMDD
function daysAgo(d, n) { return new Date(d.getTime() - n * 86400000); }
/* 결제선생은 1년이 넘는 기간을 조회하면 빈 결과를 돌려준다(2026-09-16 실측: 730일 → 0건).
 * 그래서 긴 기간은 90일짜리 조각으로 나눠 받아 합친다. */
function dateChunks(nowDate, days, win) {
  win = win || 90;
  const out = [];
  let end = new Date(nowDate.getTime());
  let left = days;
  while (left > 0) {
    const take = Math.min(left, win);
    const start = daysAgo(end, take);
    out.push({ start: ymd(start), end: ymd(end) });
    end = daysAgo(start, 1);
    left -= take;
  }
  return out.reverse();
}
/** 최근 n개월의 {ym:'YYYY-MM', start:'YYYYMMDD', end:'YYYYMMDD'} 목록 (이번 달 포함, 옛→새) */
function recentMonths(n) {
  const now = kstNow();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    out.push({ ym: first.toISOString().slice(0, 7), start: ymd(first), end: ymd(lastDay) });
  }
  return out;
}

/* ═══════════════════════ 4. 결제선생 호출 (헤더 베끼기 + 대안 경로) ═══════════════════════ */

// 브라우저 요청에서 베껴 오면 안 되는(또는 다시 만들어지는) 헤더
const DROP_HEADERS = /^(:|content-length$|host$|connection$|accept-encoding$|origin$|referer$|cookie$)/i;
// 브라우저 안 fetch 로 다시 보낼 때 쓰면 안 되는 헤더 (브라우저가 막는 것)
const BROWSER_FORBIDDEN = /^(:|content-length$|host$|connection$|accept-encoding$|origin$|referer$|cookie$|user-agent$|sec-|proxy-)/i;

function cleanHeaders(h, forBrowser) {
  const out = {};
  Object.keys(h || {}).forEach((k) => {
    const lk = k.toLowerCase();
    if (forBrowser ? BROWSER_FORBIDDEN.test(lk) : DROP_HEADERS.test(lk)) return;
    out[lk] = h[k];
  });
  out['content-type'] = 'application/json';
  return out;
}

/** 응답 본문에서 목록 꺼내기 (info / data / 배열 그대로) */
function listOf(j) {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  for (const k of ['info', 'data', 'list', 'items', 'result']) if (Array.isArray(j[k])) return j[k];
  return [];
}

/**
 * manager-api 호출기.
 *  1순위: context.request.post (베낀 헤더 그대로)
 *  2순위: 401/403 이거나 실패하면 page.evaluate 안에서 브라우저 fetch (쿠키·CORS 그대로)
 * 둘 중 되는 쪽으로 자동 전환한다.
 */
function makeCaller(ctx, page, headers) {
  let mode = 'ctx';
  return async function call(url, body, label) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (mode === 'ctx') {
        try {
          const res = await ctx.request.post(url, { headers: cleanHeaders(headers, false), data: body, timeout: 60000 });
          const st = res.status();
          if (st === 401 || st === 403) { log(`· ${label}: 헤더 복사 경로 ${st} → 브라우저 fetch 경로로 전환`); mode = 'eval'; continue; }
          if (!res.ok()) { log(`· ${label}: 실패 ${st}`); return null; }
          return await res.json().catch(() => null);
        } catch (e) {
          log(`· ${label}: 헤더 복사 경로 오류 → 브라우저 fetch 경로로 전환`);
          mode = 'eval'; continue;
        }
      } else {
        const out = await page.evaluate(async (a) => {
          try {
            const r = await fetch(a.url, { method: 'POST', headers: a.headers, body: JSON.stringify(a.body), credentials: 'include' });
            const t = await r.text();
            let j = null; try { j = JSON.parse(t); } catch (e) { /* JSON 아님 */ }
            return { status: r.status, json: j };
          } catch (e) { return { status: 0, json: null }; }
        }, { url, headers: cleanHeaders(headers, true), body });
        if (!out || out.status === 0) { log(`· ${label}: 브라우저 fetch 실패(연결)`); return null; }
        if (out.status < 200 || out.status >= 300) { log(`· ${label}: 실패 ${out.status}`); return null; }
        return out.json;
      }
    }
    return null;
  };
}

/* ═══════════════════════ 5. 본체 ═══════════════════════ */

function parseArgs(argv) {
  const get = (name, def) => {
    const i = argv.indexOf(name);
    if (i < 0 || !argv[i + 1]) return def;
    const n = Number(argv[i + 1]);
    return isFinite(n) && n > 0 ? n : def;
  };
  return { days: get('--days', 120), months: get('--months', 4), dry: argv.includes('--dry'), force: argv.includes('--force') };
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const ID = process.env.PAYSSAM_ID, PW = process.env.PAYSSAM_PASSWORD;
  if (!ID || !PW) { console.error('❌ PAYSSAM_ID / PAYSSAM_PASSWORD 환경변수가 없습니다'); process.exit(1); }
  FORCE = !!opt.force;
  log(`시작 · 최근 ${opt.days}일 · 달 ${opt.months}개 · ${opt.dry ? '시험(저장 안 함)' : '저장'}${FORCE ? ' · 강제 덮어쓰기' : ''}`);

  const { chromium } = require('playwright');
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const launch = { headless: true, args: ['--no-sandbox', '--disable-quic'] };
  if (proxy) { launch.proxy = { server: proxy }; launch.args.push('--ignore-certificate-errors'); }
  if (process.env.PW_CHROME) launch.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'ko-KR', ignoreHTTPSErrors: !!proxy,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  let stage = '로그인';
  try {
    /* ── (a) 화면이 부르는 요청·응답 엿듣기 ── */
    let capHeaders = null;        // manager-api 첫 요청의 헤더 전부 (값은 로그에 안 남김)
    let merchantCode = null;      // 상점 코드
    let memberIdx = null;         // 로그인한 회원 번호
    let loginStatus = null;

    page.on('request', (req) => {
      try {
        const u = req.url();
        if (!/manager-api\.payssam\.kr/.test(u)) return;
        if (!capHeaders) {
          capHeaders = req.headers();
          log('인증 헤더 캡처 · 헤더 이름:', Object.keys(capHeaders).filter((k) => !/^:/.test(k)).sort().join(', '));
        }
        if (!merchantCode) {
          const pd = req.postData();
          if (pd) { const o = JSON.parse(pd); if (o && o.merchantCode) merchantCode = o.merchantCode; }
        }
      } catch (e) { /* 무시 */ }
    });
    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (/\/v2\/users\/login/.test(u)) {
          loginStatus = res.status();
          const j = await res.json().catch(() => null);
          const info = (j && (j.info || j.data)) || {};
          if (info.memberIdx != null) memberIdx = info.memberIdx;
        } else if (/\/merchants\/list/.test(u)) {
          const j = await res.json().catch(() => null);
          const arr = listOf(j);
          if (arr.length && arr[0].merchantCode && !merchantCode) merchantCode = arr[0].merchantCode;
        }
      } catch (e) { /* 무시 */ }
    });

    /* ── (b) 로그인 ── */
    await page.goto('https://manager.payssam.kr/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    const idIn = await page.$('input[name="member_id"]') ||
      await page.$('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])');
    if (!idIn) throw new Error('아이디 칸을 못 찾음');
    await idIn.click(); await idIn.fill(ID);
    await page.fill('input[name="member_pw"], input[type="password"]', PW);
    await page.click('button:has-text("로그인")');
    for (let i = 0; i < 60 && !loginStatus; i++) await page.waitForTimeout(500);
    if (!loginStatus) {
      // 안내창이 막고 있을 수 있다 → 「확인」 닫고 한 번 더
      try { const ok = await page.$('button:has-text("확인")'); if (ok) await ok.click(); } catch (e) {}
      await page.waitForTimeout(1500);
      try {
        await page.fill('input[name="member_pw"], input[type="password"]', PW);
        await page.click('button:has-text("로그인")');
      } catch (e) {}
      for (let i = 0; i < 60 && !loginStatus; i++) await page.waitForTimeout(500);
    }
    log('로그인 응답 상태:', loginStatus == null ? '(못 잡음)' : loginStatus);
    await page.waitForTimeout(3000);
    try { const ok = await page.$('button:has-text("확인")'); if (ok) { await ok.click(); await page.waitForTimeout(1500); log('첫 화면 안내창 닫음'); } } catch (e) {}

    /* ── (c) /bills 를 열어 인증 헤더 캡처 ── */
    stage = '헤더 캡처';
    await page.goto('https://manager.payssam.kr/bills', { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let i = 0; i < 40 && !capHeaders; i++) await page.waitForTimeout(500);
    if (!capHeaders) throw new Error('manager-api 요청을 못 잡음 (로그인 실패 가능)');

    /* ── (d) merchantCode 확보 ── */
    stage = 'merchantCode';
    const call = makeCaller(ctx, page, capHeaders);
    if (!merchantCode && memberIdx != null) {
      const j = await call(`${PAY_API}/merchants/list`, { memberIdx }, 'merchants/list');
      const arr = listOf(j);
      if (arr.length && arr[0].merchantCode) merchantCode = arr[0].merchantCode;
      await sleep(GAP);
    }
    if (!merchantCode) throw new Error('merchantCode 를 못 찾음');
    log('상점 코드 확보 (값은 로그 생략)');

    /* ── (e) 기간 ── */
    const now = kstNow();
    const endDate = ymd(now), startDate = ymd(daysAgo(now, opt.days));
    log(`조회 기간: ${startDate} ~ ${endDate}`);

    /* ── (f)(g) 결제·청구 목록 — 90일 조각으로 나눠 받아 합친다 ── */
    const chunks = dateChunks(now, opt.days, 90);
    if (chunks.length > 1) log(`기간을 ${chunks.length}조각으로 나눠 받습니다 (한 번에 1년이 넘으면 결제선생이 빈 결과를 줍니다)`);
    const payRows = [], billRows = [];
    const seenPay = {}, seenBill = {};
    for (const ch of chunks) {
      stage = '결제 목록';
      const pr = await fetchPaged(call, `${MGR_API}/payment/detail/v2`, {
        state: 'ALL', payType: null, startDate: ch.start, endDate: ch.end, vatRate: null, keyword: '',
        merchantCode, rowNumber: 100, businessType: null,
      }, `결제 목록 ${ch.start}~${ch.end}`);
      pr.forEach((x) => { const k = String(x && (x.txID || x.approvalNumber) || Math.random()); if (!seenPay[k]) { seenPay[k] = 1; payRows.push(x); } });
      await sleep(GAP);
      stage = '청구 목록';
      const br = await fetchPaged(call, `${MGR_API}/bill/detail/v2/unpaid/bills`, {
        state: 'BILL_ALL', startDate: ch.start, endDate: ch.end, vatRate: null, keyword: '',
        merchantCode, rowNumber: 100, businessType: null,
      }, `청구 목록 ${ch.start}~${ch.end}`);
      br.forEach((x) => { const k = String(x && (x.billId || x.txID) || Math.random()); if (!seenBill[k]) { seenBill[k] = 1; billRows.push(x); } });
      await sleep(GAP);
    }

    /* ── (h) 달별 요약·매출 보고서 ── */
    stage = '달별 요약';
    const countByMonth = {}, reportByMonth = {};
    for (const m of recentMonths(opt.months)) {
      const c = await call(`${MGR_API}/bill/detail/v2/count`, {
        merchantCode, keyword: '', startDate: m.start, endDate: m.end,
        vatRate: null, businessType: null, searchPaidType: 'SENT',
      }, `청구 요약 ${m.ym}`);
      if (c) countByMonth[m.ym] = (c && !Array.isArray(c) && (c.info || c.data)) || c;
      await sleep(GAP);
      const r = await call(`${MGR_API}/merchant/sales/v2/report`, {
        merchantCode, startDate: m.start, endDate: m.end, reportType: 'PAYMENT_METHOD_TYPE',
      }, `매출 보고서 ${m.ym}`);
      if (r) reportByMonth[m.ym] = (r && !Array.isArray(r) && (r.info || r.data)) || r;
      await sleep(GAP);
    }

    /* ── (i) 다듬기 ── */
    stage = '집계';
    const payments = parsePayments(payRows);
    const bills = parseBills(billRows);
    const byMonth = buildMonthly(countByMonth, reportByMonth, payments, bills);
    const byName = buildStudents(payments, bills);
    const updated = new Date().toISOString();

    const sum = (a) => a.reduce((s, x) => s + num(x.amount), 0);
    log(`결제 ${payments.length}건 · 합계 ${sum(payments).toLocaleString()}원 (취소 ${payments.filter((p) => p.cancelledAt).length}건)`);
    log(`청구 ${bills.length}건 · 합계 ${sum(bills).toLocaleString()}원 (수납 ${bills.filter((b) => b.paidAt).length}건)`);
    log(`학생(결제선생 이름) ${Object.keys(byName).length}명`);
    Object.keys(byMonth).sort().forEach((m) => {
      const v = byMonth[m];
      log(`  ${m} · 청구 ${v.billed.count}건 ${v.billed.amount.toLocaleString()}원 · 수납 ${v.paid.count}건 ${v.paid.amount.toLocaleString()}원(${v.paid.pct}%) · 미납 ${v.unpaid.count}건 ${v.unpaid.amount.toLocaleString()}원 · 매출 ${v.sales.total.toLocaleString()}원`);
    });

    /* ── (j) 저장 ── */
    if (opt.dry) { log('시험 실행(--dry) — 저장하지 않음'); }
    else {
      stage = '저장';
      /* 안전장치: 이번에 하나도 못 받았는데 전에 받아 둔 것이 있으면 덮어쓰지 않는다.
       * (2026-09-16: 730일 조회가 빈 결과를 줘서 청구 116건·결제 100건이 통째로 지워졌던 일) */
      const prev = await storeGet(['pay_payments', 'pay_bills', 'pay_students']);
      const keep = (name, got, before) => {
        if (got > 0 || FORCE) return true;
        if (before > 0) { log(`⚠ ${name}: 이번엔 0건인데 전에 ${before}건이 있어 덮어쓰지 않습니다 (강제로 덮으려면 --force)`); return false; }
        return true;
      };
      const nPrevPay = ((prev.pay_payments || {}).items || []).length;
      const nPrevBill = ((prev.pay_bills || {}).items || []).length;
      const nPrevStu = Object.keys((prev.pay_students || {}).byName || {}).length;
      if (keep('결제 목록', payments.length, nPrevPay)) await storeSet('pay_payments', { updated, from: startDate, to: endDate, items: payments });
      if (keep('청구 목록', bills.length, nPrevBill)) await storeSet('pay_bills', { updated, from: startDate, to: endDate, items: bills });
      await storeSet('pay_monthly', { updated, byMonth });
      if (keep('학생 목록', Object.keys(byName).length, nPrevStu)) await storeSet('pay_students', { updated, byName });
    }
    await browser.close();
    log('끝');
  } catch (e) {
    log(`실패 · 단계=${stage} · 사유=${(e && e.message ? String(e.message) : '알 수 없음').slice(0, 120)}`);
    try { await browser.close(); } catch (e2) {}
    process.exit(1);
  }
}

/** 목록 API 쪽 넘김 (pageInfo.totalPage 만큼) */
async function fetchPaged(call, url, baseBody, label) {
  const rows = [];
  let totalPage = 1;
  for (let p = 1; p <= totalPage; p++) {
    const j = await call(url, Object.assign({}, baseBody, { currentPage: p }), `${label} ${p}쪽`);
    if (!j) break;
    const list = listOf(j);
    rows.push.apply(rows, list);
    const pi = j.pageInfo || (j.info && j.info.pageInfo) || null;
    if (p === 1) {
      totalPage = pi && pi.totalPage ? Number(pi.totalPage) : 1;
      if (!isFinite(totalPage) || totalPage < 1) totalPage = 1;
      if (totalPage > 200) totalPage = 200;  // 안전장치
      log(`${label}: 총 ${pi && pi.totalCount != null ? pi.totalCount : list.length}건 · ${totalPage}쪽`);
    }
    if (!list.length) break;
    await sleep(GAP);
  }
  return rows;
}

module.exports = { parsePayments, parseBills, buildMonthly, buildStudents, parseReport, phone4, toIso, monthOf };

if (require.main === module) main();
