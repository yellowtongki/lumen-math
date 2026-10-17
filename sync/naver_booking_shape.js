#!/usr/bin/env node
/* 🔍 네이버 예약 2단계 정찰 — 예약 1건의 «칸 이름·종류»만 본다 (값은 날짜·시간·상태 코드만, 이름·전화·메모는 절대 출력 안 함)
 * 실행: 깃허브 Actions 「네이버 예약 정찰」 (mode=shape) */
const raw = process.env.NAVER_COOKIE || '';
const t = String(raw).replace(/[\u2028\u2029\u00a0\r\n\t]/g, ' ');
const pick = (k) => { const m = t.match(new RegExp(k + '\\s*=\\s*([^;\\s]+)')); return m ? k + '=' + m[1] : ''; };
const COOKIE = [pick('NID_AUT'), pick('NID_SES')].filter(Boolean).join('; ');
const BIZ = process.env.NAVER_BIZ_ID || '1419039';
const H = { cookie: COOKIE, accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36', referer: 'https://partner.booking.naver.com/' };
const SAFE = /(Date|Time|date|time|Code|code|Type|type|Count|count|Id$|bizItemName|serviceName|price|Price|is[A-Z])/;
const BAD = /(name|Name|phone|Phone|mail|message|Message|memo|Memo|guide|Guide|nick|user|User|desc|addr|Addr|answer|Answer|comment|Comment|extra|Extra|custom|Custom|option|Option)/;
function walk(o, p, out, depth) {
  if (depth > 4 || o == null) return;
  if (Array.isArray(o)) { out.push(p + ' : 배열[' + o.length + ']'); if (o.length) walk(o[0], p + '[0]', out, depth + 1); return; }
  if (typeof o === 'object') { Object.keys(o).forEach((k) => walk(o[k], p ? p + '.' + k : k, out, depth + 1)); return; }
  const k = p.split('.').pop().replace(/\[0\]$/, '');
  const safe = SAFE.test(k) && !(BAD.test(k) && !/bizItemName|serviceName/.test(k));
  out.push(p + ' : ' + typeof o + (safe ? ' = ' + String(o).slice(0, 40) : ''));
}
(async () => {
  const items = await (await fetch(`https://api-partner.booking.naver.com/v3.1/businesses/${BIZ}/biz-items`, { headers: H })).json();
  console.log('예약 상품', items.length + '개');
  items.forEach((it) => console.log(' -', it.bizItemId, it.name, '| 노출', it.isImp, '| 단위', it.bookingTimeUnitCode));
  for (const q of ['page=0&size=5', 'page=0&size=5&sort=startDate,desc', `page=0&size=5&startDateTime=2026-10-01T00:00:00&endDateTime=2026-10-31T23:59:59`, `page=0&size=5&bookingStartDate=2026-10-01&bookingEndDate=2026-10-31`, `page=0&size=5&startDate=2026-10-01&endDate=2026-10-31&dateDropdownType=TODAY&dateFilter=USEDATE`]) {
    const r = await fetch(`https://partner.booking.naver.com/api/businesses/${BIZ}/bookings?${q}`, { headers: H });
    let j = null; try { j = await r.json(); } catch (e) {}
    const arr = Array.isArray(j) ? j : (j && (j.content || j.bookings)) || [];
    console.log(`\n● ${q} → HTTP ${r.status} · ${Array.isArray(j) ? '배열' : typeof j} · ${arr.length}건 · 이용일 ${arr.map((b) => b.startDate).join(',')}` + (j && !Array.isArray(j) ? ' · 키 ' + Object.keys(j).join(',') : '') + ' · 헤더 total=' + (r.headers.get('x-total-count') || '-'));
  }
  const r = await fetch(`https://partner.booking.naver.com/api/businesses/${BIZ}/bookings?page=0&size=1&sort=regDateTime,desc`, { headers: H });
  const j = await r.json(); const b = (Array.isArray(j) ? j : j.content || [])[0];
  if (b) { const out = []; walk(b, '', out, 0); console.log('\n예약 1건의 칸 (값은 날짜·코드만):'); out.forEach((l) => console.log('  ' + l)); }
})().catch((e) => { console.log('실패', e.message); process.exit(1); });
