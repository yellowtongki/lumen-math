#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📅 네이버 예약 수집기 — 파트너센터 예약을 15분마다 학원앱으로 (GitHub Actions naver-booking.yml)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 하는 일
 *   ① 예약 상품 목록(biz-items) · 예약 목록(bookings, 오래된 것부터 100건씩 쪽 넘김 — 날짜 조건은 네이버가 무시)
 *   ② 이용일이 오늘-30일 ~ 오늘+90일(또는 최근 14일 안에 신청·확정·취소된) 예약만 정리 (sync/naver_booking_core.js)
 *   ③ 학원 학생과 맞추기: 원장님이 앱에서 직접 고른 것(naver_booking_links) > 전화번호 > 메모·추가 답의 학생 이름
 *   ④ 저장 (lumen_store)
 *        naver_bookings        — 시간·상품·상태·연결된 학생 키만 (이름·전화·메모 없음)
 *        naver_bookings_pii    — 예약자 이름·전화·메모·추가 답을 «원장님 열쇠»로 잠근 상자(AES-GCM)
 *                                 열쇠 = GitHub 비밀값 LUMEN_TEACHER_KEY (학원앱의 lumen_db_key 와 같은 값). 없으면 이 칸은 만들지 않는다.
 *        naver_bookings_status — {at, ok, reason, code} (개인정보 없음)
 *      ⚠ lumen_store 는 학생앱·학부모앱의 공개 열쇠로 읽을 수 있다 → 학부모 이름·전화는 잠근 상자에만 둔다.
 *        서버 잠금 제안: docs/naver_booking_rls.sql (새벽에 원장님이 실행)
 *   ⑤ 로그인 만료(네이버가 화면/로그인 페이지를 돌려줌) → naver_bookings_status {ok:false, reason:'login'} 만 쓰고 끝(종료 코드 0).
 *      지난번 naver_bookings 는 그대로 둔다. 학원앱이 「네이버 다시 연결이 필요해요」를 띄운다.
 *
 * ⚠ 이 저장소와 실행 기록(로그)은 공개다. 이름·전화·이메일·메모·추가 답·안내문은 절대 찍지 않는다 — 건수와 코드만.
 *
 * 실행
 *   node sync/naver_booking_collect.js            (비밀값: NAVER_COOKIE · SUPABASE_URL · SUPABASE_SERVICE_KEY · LUMEN_TEACHER_KEY)
 *   node sync/naver_booking_collect.js --dry      (저장 안 함, 건수만)
 *   node sync/naver_booking_collect.js --fixture <가짜.json> [--out <결과.json>] [--now 2026-10-17T10:00:00+09:00]
 *        가짜 자료로 돌린다(네이버·Supabase 안 부름). 쓰려던 값은 --out 파일로. 검사: node sync/test_naver_booking.js
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const core = require('./naver_booking_core.js');

const BIZ = String(process.env.NAVER_BIZ_ID || '1419039');   /* 업체 번호 — 공개 예약 페이지에도 나오는 번호라 비밀 아님 */
const PAGE_SIZE = 100, PAGE_CAP = 30;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36';

/* ★ 2026-10-17: 맥 메모장에서 붙여 넣으면 보이지 않는 줄바꿈(U+2028)·공백이 섞인다 → NID_AUT·NID_SES 값만 골라 다시 만든다 (naver_booking_probe.js 와 같다) */
function cleanCookie(raw) {
  const t = String(raw || '').replace(/[\u2028\u2029\u00a0\r\n\t]/g, ' ');
  const pick = (k) => { const m = t.match(new RegExp(k + '\\s*=\\s*([^;\\s]+)')); return m ? k + '=' + m[1] : ''; };
  const parts = [pick('NID_AUT'), pick('NID_SES')].filter(Boolean);
  return parts.length ? parts.join('; ') : t.replace(/[^\x20-\x7e]/g, '').trim();
}

function args(argv) {
  const o = { dry: false, fixture: '', out: '', now: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') o.dry = true;
    else if (a === '--fixture') o.fixture = argv[++i] || '';
    else if (a === '--out') o.out = argv[++i] || '';
    else if (a === '--now') o.now = argv[++i] || '';
  }
  return o;
}

/* 네이버 응답 하나 — JSON 이 아니면(로그인 화면) 'login', 그 밖의 오류는 'http'. 본문·오류 글은 밖으로 내보내지 않는다(개인정보가 섞일 수 있음) */
class NaverErr extends Error { constructor(reason, code) { super(reason); this.reason = reason; this.code = code; } }
function naverIO(cookie) {
  const H = { cookie, accept: 'application/json, text/plain, */*', 'user-agent': UA, referer: 'https://partner.booking.naver.com/' };
  return async function getJson(url) {
    let r;
    try { r = await fetch(url, { headers: H, redirect: 'manual' }); }
    catch (e) { throw new NaverErr('http', 0); }
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400) throw new NaverErr(/nid\.naver|login/i.test(loc) ? 'login' : 'http', r.status);
    if (r.status === 401 || r.status === 403) throw new NaverErr('login', r.status);
    const text = await r.text();
    const t = text.trim();
    if (r.status !== 200) throw new NaverErr('http', r.status);
    if (!/^[\[{]/.test(t)) throw new NaverErr(/<html|<!doctype/i.test(t.slice(0, 200)) ? 'login' : 'http', r.status);
    let j; try { j = JSON.parse(t); } catch (e) { throw new NaverErr('http', 'json'); }
    return { json: j, total: Number(r.headers.get('x-total-count')) || 0 };
  };
}
function fixtureIO(fx) {
  return async function getJson(url) {
    if (fx.fail) throw new NaverErr(fx.fail.reason || 'login', fx.fail.code || 302);
    if (/biz-items/.test(url)) return { json: fx.items || [], total: 0 };
    const m = url.match(/[?&]page=(\d+)/); const p = m ? Number(m[1]) : 0;
    if (fx.htmlAtPage != null && p === fx.htmlAtPage) throw new NaverErr('login', 200);
    return { json: (fx.pages || [])[p] || [], total: Number(fx.total) || 0 };
  };
}

/* Supabase (service_role — 잠금 규칙을 그대로 통과) */
function storeIO() {
  const URL0 = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const H = { apikey: KEY, authorization: 'Bearer ' + KEY };
  return {
    ok: !!(URL0 && KEY),
    async get(keys) {
      const r = await fetch(URL0 + '/rest/v1/lumen_store?key=in.(' + keys.join(',') + ')&select=key,value', { headers: H });
      if (!r.ok) throw new Error('lumen_store 읽기 실패 ' + r.status);
      const out = {}; (await r.json()).forEach((x) => { out[x.key] = (typeof x.value === 'string') ? (() => { try { return JSON.parse(x.value); } catch (e) { return x.value; } })() : x.value; });
      return out;
    },
    async set(key, value) {
      const r = await fetch(URL0 + '/rest/v1/lumen_store', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' }, H),
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });
      return r.ok ? true : r.status;
    },
  };
}

/* 모든 예약 쪽 받기 — 오래된 것부터라 끝(빈 쪽·덜 찬 쪽)까지. 같은 쪽이 되풀이되면(쪽 넘김 무시) 멈춘다 */
async function fetchAll(getJson) {
  const itemsR = await getJson('https://api-partner.booking.naver.com/v3.1/businesses/' + BIZ + '/biz-items');
  const items = Array.isArray(itemsR.json) ? itemsR.json : (itemsR.json.content || itemsR.json.list || []);
  const url = (p) => 'https://partner.booking.naver.com/api/businesses/' + BIZ + '/bookings?page=' + p + '&size=' + PAGE_SIZE;
  const first = await getJson(url(0));
  const arr0 = Array.isArray(first.json) ? first.json : (first.json.content || first.json.bookings || []);
  let start = 0, skipped = 0;
  /* 총 건수를 알려 주면 너무 많을 때 최근 쪽부터 PAGE_CAP 쪽만 */
  if (first.total > PAGE_SIZE * PAGE_CAP) { start = Math.ceil(first.total / PAGE_SIZE) - PAGE_CAP; skipped = start; }
  const all = [], seen = {}; let pages = 0, prevFirst = null, capped = false;
  for (let p = start; ; p++) {
    if (pages >= PAGE_CAP) { capped = true; break; }
    let list;
    if (p === 0) list = arr0;
    else { const r = await getJson(url(p)); list = Array.isArray(r.json) ? r.json : (r.json.content || r.json.bookings || []); }
    pages++;
    if (!list.length) break;
    const f = String(list[0] && list[0].bookingId);
    if (prevFirst !== null && f === prevFirst) break;   /* 쪽 넘김이 안 먹음 */
    prevFirst = f;
    list.forEach((b) => { const id = String(b && b.bookingId); if (!seen[id]) { seen[id] = 1; all.push(b); } });
    if (list.length < PAGE_SIZE) break;
  }
  return { items, raw: all, pages, skipped, capped };
}

async function run(opt) {
  const log = opt.log || ((...a) => console.log('[네이버예약]', ...a));
  const now = opt.now ? Date.parse(opt.now) : Date.now();
  const at = new Date(now).toISOString();
  const today = core.nbTodayKst(now);
  const getJson = opt.getJson, store = opt.store, teacherKey = opt.teacherKey || '';
  const writes = {};
  const put = async (k, v) => { writes[k] = v; if (opt.dry || !store || !store.set) return true; const r = await store.set(k, v); if (r !== true) log('저장 실패', k, r); return r === true; };

  let prev = {};
  try { prev = store && store.get ? await store.get(['or_studentdb', 'naver_booking_links', 'naver_bookings_status']) : {}; }
  catch (e) { log('lumen_store 읽기 실패 — 학생 맞추기 없이 진행'); prev = {}; }
  const students = Array.isArray(prev.or_studentdb) ? prev.or_studentdb : [];
  const links = (prev.naver_booking_links && typeof prev.naver_booking_links === 'object') ? prev.naver_booking_links : {};

  let got;
  try { got = await fetchAll(getJson); }
  catch (e) {
    const reason = (e && e.reason) || 'http', code = (e && e.code != null) ? e.code : 0;
    log('네이버 접속 실패 · 이유 ' + reason + ' · 코드 ' + code + (reason === 'login' ? ' — 쿠키(NAVER_COOKIE) 만료로 보임' : ''));
    const ps = prev.naver_bookings_status || {};
    await put('naver_bookings_status', { at, ok: false, reason, code, lastOkAt: ps.ok ? ps.at : (ps.lastOkAt || '') });
    log('상태 저장: ok=false (지난번 예약 자료는 그대로 둠)' + (opt.dry ? ' [dry]' : ''));
    return { ok: false, reason, code, writes };
  }

  const items = (got.items || []).map((it) => ({ id: String(it.bizItemId), name: String(it.name || ''), kind: core.nbKindOf(it.name, it.bizItemId), imp: it.isImp !== false }));
  const bookings = [], piiById = {};
  const counts = { total: got.raw.length, inWindow: 0, byKind: {}, matched: 0, unmatched: 0, ambiguous: 0, how: {}, cancelled: 0, today: 0 };
  got.raw.forEach((b) => {
    const n = core.nbNormalize(b, got.items);
    if (!n.pub.id || !core.nbInWindow(n.pub, today)) return;
    const m = core.nbMatch(n.pub, n.pii, students, links);
    n.pub.match = (m && m.stKey) ? { stKey: m.stKey, code: m.code, how: m.how } : null;
    if (m && m.how === 'ambiguous') n.pub.cands = m.cands;
    if (m && m.how === 'none') n.pub.noStudent = true;
    bookings.push(n.pub); piiById[n.pub.id] = n.pii;
    counts.inWindow++;
    counts.byKind[n.pub.item.kind] = (counts.byKind[n.pub.item.kind] || 0) + 1;
    if (n.pub.match) { counts.matched++; counts.how[n.pub.match.how] = (counts.how[n.pub.match.how] || 0) + 1; }
    else { counts.unmatched++; if (m && m.how === 'ambiguous') counts.ambiguous++; }
    if (n.pub.status.k === 'cancelled') counts.cancelled++;
    if (n.pub.date === today) counts.today++;
  });
  bookings.sort((a, b) => (a.date + a.start + a.id < b.date + b.start + b.id ? -1 : 1));

  let pii = { enc: false, n: 0 };
  if (teacherKey) {
    try {
      const box = await core.nbSeal({ at, byId: piiById }, teacherKey);
      box.at = at; box.n = Object.keys(piiById).length;
      pii = { enc: true, n: box.n, kid: box.kid };
      await put('naver_bookings_pii', box);
    } catch (e) { log('개인정보 칸 잠그기 실패 — 이름·전화 없이 저장'); pii = { enc: false, n: 0, err: 'seal' }; }
  }
  const data = { at, ok: true, v: 1, bizId: BIZ, today, window: { back: 30, ahead: 90 }, items, bookings, counts, pii };
  await put('naver_bookings', data);
  await put('naver_bookings_status', { at, ok: true, n: bookings.length, lastOkAt: at });

  log('쪽 ' + got.pages + (got.skipped ? ' (앞쪽 ' + got.skipped + '쪽 건너뜀)' : '') + (got.capped ? ' · 한도 ' + PAGE_CAP + '쪽에서 멈춤' : '') + ' · 예약 전체 ' + counts.total + '건 · 기간 안 ' + counts.inWindow + '건 · 오늘 ' + counts.today + '건 · 취소 ' + counts.cancelled + '건');
  log('상품 ' + items.length + '개 · 종류별 ' + core.NB_KINDS.map((k) => k.label + ' ' + (counts.byKind[k.k] || 0)).join(' · '));
  log('학생 연결 ' + counts.matched + '건 (' + Object.keys(counts.how).map((h) => h + ' ' + counts.how[h]).join(' · ') + ') · 못 맞춤 ' + counts.unmatched + '건' + (counts.ambiguous ? ' (형제·동명 ' + counts.ambiguous + ')' : ''));
  log('이름·전화 칸: ' + (pii.enc ? '잠금 저장 ' + pii.n + '건' : (teacherKey ? '잠그기 실패' : 'LUMEN_TEACHER_KEY 없음 — 저장 안 함(시간·상품·상태만)')) + (opt.dry ? ' · [dry] 저장 안 함' : ' · 저장 완료'));
  return { ok: true, counts, writes };
}

module.exports = { run, fetchAll, cleanCookie, NaverErr };

if (require.main === module) {
  const o = args(process.argv.slice(2));
  (async () => {
    let getJson, store, teacherKey = process.env.LUMEN_TEACHER_KEY || '';
    if (o.fixture) {
      const fx = JSON.parse(fs.readFileSync(path.resolve(o.fixture), 'utf8'));
      getJson = fixtureIO(fx);
      store = { get: async () => JSON.parse(JSON.stringify(fx.store || {})), set: async () => true };
      if (fx.teacherKey != null) teacherKey = fx.teacherKey;
    } else {
      const cookie = cleanCookie(process.env.NAVER_COOKIE);
      if (!cookie) { console.log('[네이버예약] NAVER_COOKIE 가 없습니다 — GitHub Secrets 에 등록해 주세요'); process.exit(0); }
      getJson = naverIO(cookie);
      store = storeIO();
      if (!store.ok && !o.dry) { console.log('[네이버예약] SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없어 --dry 로 돌립니다'); o.dry = true; }
      if (!store.ok) store = null;
    }
    const r = await run({ getJson, store, teacherKey, dry: o.dry, now: o.now || '' });
    if (o.out) fs.writeFileSync(path.resolve(o.out), JSON.stringify(r.writes));
    process.exit(0);
  })().catch((e) => { console.log('[네이버예약] 예기치 못한 오류: ' + ((e && e.name) || 'Error')); process.exit(1); });
}
