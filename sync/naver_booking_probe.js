#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🔍 네이버 예약 정찰 (1단계) — 직접 연동 가능한지 확인만 한다
 * ═══════════════════════════════════════════════════════════════════
 *
 * 원장님의 네이버 로그인 쿠키(NID_AUT·NID_SES)로 예약 파트너센터의
 * 내부 API에 접속해 「어떤 주소에서 어떤 모양의 데이터가 오는지」를
 * 확인한다. 저장은 하지 않는다 — 구조를 본 뒤 진짜 수집기를 만든다.
 *
 * ── 비밀값 (GitHub Secrets) ──────────────────────────────────────
 *   NAVER_COOKIE = "NID_AUT=...; NID_SES=..."
 *   · 쿠키는 비밀번호와 같다 — 코드/저장소에 절대 넣지 않는다
 *   · 만료되면(보통 수 주) 다시 복사해 Secrets만 갱신하면 된다
 *
 * ── 개인정보 ─────────────────────────────────────────────────────
 *   깃허브 실행 로그는 남으므로, 이름·전화번호로 보이는 값은
 *   가려서(마스킹) 출력한다. 원본은 어디에도 저장하지 않는다.
 *
 * 실행: 깃허브 Actions 「네이버 예약 정찰」 수동 실행
 * ═══════════════════════════════════════════════════════════════════ */

/* ★ 2026-10-17: 맥 메모장에서 붙여 넣으면 보이지 않는 줄바꿈(U+2028)·공백이 섞인다 → NID_AUT·NID_SES 값만 골라 다시 만든다 */
function cleanCookie(raw) {
  const t = String(raw || '').replace(/[\u2028\u2029\u00a0\r\n\t]/g, ' ');
  const pick = (k) => { const m = t.match(new RegExp(k + '\\s*=\\s*([^;\\s]+)')); return m ? k + '=' + m[1] : ''; };
  const parts = [pick('NID_AUT'), pick('NID_SES')].filter(Boolean);
  return parts.length ? parts.join('; ') : t.replace(/[^\x20-\x7e]/g, '').trim();
}
const COOKIE = cleanCookie(process.env.NAVER_COOKIE);
const log = (...a) => console.log('[정찰]', ...a);

if (!COOKIE) { log('NAVER_COOKIE가 없습니다 — Secrets에 등록해 주세요'); process.exit(1); }
log(`쿠키 확인: NID_AUT ${/NID_AUT=/.test(COOKIE) ? '있음' : '없음 ⚠️'} · NID_SES ${/NID_SES=/.test(COOKIE) ? '있음' : '없음 ⚠️'} (값은 출력하지 않음)`);

const H = {
  cookie: COOKIE,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  referer: 'https://partner.booking.naver.com/',
};

/* 이름·전화번호처럼 보이는 값을 가린다 (로그 안전용) */
function mask(s) {
  return String(s)
    .replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, '01*-****-****')
    .replace(/"(name|userName|bookerName|customerName|nickname|phone|phoneNumber|tel|telephone|email)"\s*:\s*"[^"]*"/gi,
      (m) => m.replace(/:\s*"[^"]*"/, ': "＊가림＊"'));
}

async function probe(label, url) {
  try {
    const r = await fetch(url, { headers: H, redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400) {
      log(`● ${label}\n   ${url}\n   → ${r.status} 이동: ${loc.slice(0, 90)}${/nid\.naver/.test(loc) ? '  ⚠️ 로그인 필요(쿠키 만료/오류)' : ''}`);
      return null;
    }
    const text = await r.text();
    const isJson = /^[\[{]/.test(text.trim());
    log(`● ${label}\n   ${url}\n   → HTTP ${r.status} · ${isJson ? 'JSON' : (text.slice(0, 60).includes('<html') ? 'HTML(화면)' : '기타')} · ${text.length.toLocaleString()}자`);
    if (isJson && r.status === 200) {
      log('   내용 앞부분(개인정보 가림):');
      log('   ' + mask(text).slice(0, 1500).replace(/\n/g, ' ').replace(/\s+/g, ' '));
      try { return JSON.parse(text); } catch (e) { return null; }
    }
    return null;
  } catch (e) { log(`● ${label}\n   ${url}\n   → 실패: ${e.message}`); return null; }
}

(async () => {
  log('네이버 예약 파트너센터 내부 API 정찰을 시작합니다');

  /* 1) 내 업체 목록 — 여러 주소 후보를 순서대로 시도 */
  const bizCandidates = [
    ['업체 목록 A', 'https://partner.booking.naver.com/api/businesses'],
    ['업체 목록 B', 'https://partner.booking.naver.com/api/businesses?page=0&size=20'],
    ['업체 목록 C', 'https://partner.booking.naver.com/api/v3.1/businesses'],
    ['업체 목록 D', 'https://partner.booking.naver.com/api/v3/businesses?page=0&size=20'],
  ];
  let bizIds = [];
  /* ★ 2026-10-17: 원장님 화면 주소(partner.booking.naver.com/bizes/1419039)에서 업체 번호 확인 — 공개 예약 페이지에도 나오는 번호라 비밀 아님 */
  if (process.env.NAVER_BIZ_ID || true) bizIds.push(String(process.env.NAVER_BIZ_ID || '1419039'));
  for (const [label, url] of bizCandidates) {
    const j = await probe(label, url);
    if (!j) continue;
    const arr = Array.isArray(j) ? j : (j.content || j.businesses || j.list || j.data || []);
    if (Array.isArray(arr) && arr.length) {
      arr.forEach((b) => {
        const id = b.businessId || b.bizItemId || b.id;
        if (id) bizIds.push(String(id));
        log(`   ▶ 업체 발견: id=${id} 이름=${mask(JSON.stringify(b.name || b.businessName || b.serviceName || ''))}`);
      });
      if (bizIds.length) break;
    }
  }
  bizIds = [...new Set(bizIds)].slice(0, 3);
  /* ★ 업체 번호로 바로 되는 주소 후보 (bizes/… 화면이 쓰는 내부 API 추정) */
  for (const id of bizIds.slice(0, 1)) {
    for (const [label, url] of [
      ['업체 정보', `https://partner.booking.naver.com/api/businesses/${id}`],
      ['예약 상품 A', `https://partner.booking.naver.com/api/businesses/${id}/biz-items`],
      ['예약 상품 B', `https://partner.booking.naver.com/api/v3.1/businesses/${id}/biz-items`],
      ['예약 상품 C', `https://api-partner.booking.naver.com/v3.1/businesses/${id}/biz-items`],
    ]) await probe(label, url);
  }

  /* 2) 예약 목록 — 업체 id가 잡혔으면 그 업체로, 아니면 대표 주소만 확인 */
  const today = new Date();
  const d = (x) => x.toISOString().slice(0, 10);
  const from = d(new Date(today.getTime() - 30 * 86400000));
  const to = d(new Date(today.getTime() + 30 * 86400000));
  const bookingCandidates = [];
  for (const id of (bizIds.length ? bizIds : ['0'])) {
    bookingCandidates.push(
      [`예약 목록 A (업체 ${id})`, `https://partner.booking.naver.com/api/businesses/${id}/bookings?page=0&size=20`],
      [`예약 목록 B (업체 ${id})`, `https://partner.booking.naver.com/api/businesses/${id}/bookings?page=0&size=20&startDate=${from}&endDate=${to}`],
      [`예약 목록 C (업체 ${id})`, `https://partner.booking.naver.com/api/v3.1/businesses/${id}/bookings?page=0&size=20`],
      [`예약 목록 D (업체 ${id})`, `https://partner.booking.naver.com/api/businesses/${id}/bookings?bizItemTypes=STANDARD&startDateTime=${from}T00:00:00&endDateTime=${to}T23:59:59&page=0&size=20`],
      [`예약 목록 E (업체 ${id})`, `https://api-partner.booking.naver.com/v3.1/businesses/${id}/bookings?page=0&size=20&startDate=${from}&endDate=${to}`],
      [`예약 목록 F (업체 ${id})`, `https://partner.booking.naver.com/api/v3.1/businesses/${id}/bookings/statistics?startDate=${from}&endDate=${to}`],
    );
  }
  for (const [label, url] of bookingCandidates) {
    const j = await probe(label, url);
    if (j) { log('   ✅ 이 주소가 동작합니다 — 이 모양대로 수집기를 만들면 됩니다'); break; }
  }

  /* 3) 새 스마트플레이스 쪽 주소도 확인 (파트너센터가 막혀 있을 때 대비) */
  await probe('스마트플레이스 내 업체', 'https://new.smartplace.naver.com/api/businesses?page=0&size=10');

  log('정찰 끝 — 이 로그를 보고 다음 단계(수집기)를 만듭니다');
})();
