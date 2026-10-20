#!/usr/bin/env node
/**
 * 출결선생(checkbus) 3단계 — 문자 2차 인증을 한 번 통과하고 「기기 기억」을 서버에 잠가 둔다
 * ============================================================
 * 2단계 정찰(2026-10-17)에서 본 것:
 *   · POST api.checkbus.co.kr/login → accessToken (아이디·비밀번호 + 보이지 않는 reCAPTCHA)
 *   · 그 뒤 「접속 보안 인증 — IP 환경이 바뀌어 딱 1회만 인증, 저장되어 이후 추가 인증 없음」
 *     POST /{cid}/user/{uid}/cookie/check-device-code → {result:false} = 아직 이 기기 인증 안 됨
 *   · 화면: 「휴대폰 번호 인증하기」 단추 → 등록된 선생님 번호로 문자 → 「인증번호 확인」
 *
 * 이 스크립트가 하는 일:
 *   ① 로그인 → 「휴대폰 번호 인증하기」 누름(문자 발송)
 *   ② lumen_store 'checkbus_otp' 에 인증번호가 올라오기를 최대 OTP_WAIT 분 기다린다
 *      (원장님이 채팅으로 번호를 알려 주면 Claude 세션이 그 키에 적는다)
 *   ③ 번호 입력 → 「인증번호 확인」 → check-device-code 응답 확인
 *   ④ 성공하면 쿠키(checkbus 도메인 전부)·localStorage 를 «예약 열쇠(NAVER_PII_KEY)»로 잠가
 *      lumen_store 'checkbus_device' 에 저장 → 2단계 수집기가 매번 이 기기 상태로 시작한다
 *   ⑤ 인증 뒤 화면이 부르는 내부 주소(출결 기록 API)를 관찰해 로그에 남긴다(값은 자료형만)
 *
 * 환경변수: CHECKBUS_ID · CHECKBUS_PASSWORD · SUPABASE_URL · SUPABASE_SERVICE_KEY · NAVER_PII_KEY
 * 로그 규칙: 공개 저장소 — 비밀번호·토큰·쿠키 값·인증번호·학생 이름·전화번호를 절대 찍지 않는다.
 */
const { chromium } = require('playwright');
const core = require('./naver_booking_core.js');

const ID = process.env.CHECKBUS_ID, PW = process.env.CHECKBUS_PASSWORD;
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SK = process.env.SUPABASE_SERVICE_KEY || '';
const SEAL = (process.env.NAVER_PII_KEY || '').trim();
const OTP_WAIT = Number(process.env.OTP_WAIT_MIN || 8);
const HOME = 'https://admin.checkbus.co.kr/';
const t0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's]', ...a);
const SECRET_KEYS = /token|password|passwd|pwd|secret|authorization|cookie|session|jwt|apikey|api_key|otp|code$/i;
const PII_KEYS = /name|phone|tel|mobile|hp|email|address|addr|birth|parent|student|memo|note/i;
function shape(obj, depth, key) {
  depth = depth || 0; if (depth > 5) return '…';
  if (Array.isArray(obj)) return obj.length ? ['[' + obj.length + '개]', shape(obj[0], depth + 1, key)] : '[]';
  if (obj && typeof obj === 'object') { const o = {}; Object.keys(obj).slice(0, 60).forEach((k) => { o[k] = shape(obj[k], depth + 1, k); }); return o; }
  if (key && SECRET_KEYS.test(key)) return '***';
  if (key && /^(code|msg|message|result|status|success|status_code)$/i.test(key) && typeof obj !== 'string') return obj;
  if (typeof obj === 'boolean') return obj;
  if (obj == null) return null;
  if (typeof obj === 'number') return 'num';
  if (typeof obj === 'string') return (/^\d{4}-\d{2}-\d{2}/.test(obj) ? 'date' : (/^\d{2}:\d{2}/.test(obj) ? 'time' : (/^\d+$/.test(obj) ? 'numstr' : 'str' + obj.length)));
  return typeof obj;
}
const cleanUrl = (u) => u.replace(/([?&])(token|key|auth|session|sid|pw|password|code)=[^&]*/gi, '$1$2=***');
const H = { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' };
async function kvGet(key) { const r = await fetch(SB + '/rest/v1/lumen_store?key=eq.' + key + '&select=value', { headers: H }); const j = await r.json(); let v = j[0] && j[0].value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} } return v; }
async function kvSet(key, value) { const r = await fetch(SB + '/rest/v1/lumen_store', { method: 'POST', headers: Object.assign({ prefer: 'resolution=merge-duplicates' }, H), body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) }); return r.ok; }
async function kvDel(key) { await fetch(SB + '/rest/v1/lumen_store?key=eq.' + key, { method: 'DELETE', headers: H }); }

async function main() {
  if (!ID || !PW) { console.error('❌ CHECKBUS_ID / CHECKBUS_PASSWORD 가 없습니다'); process.exit(1); }
  if (!SB || !SK) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
  if (!SEAL) { console.error('❌ NAVER_PII_KEY(예약 열쇠)가 없습니다 — 기기 기억을 잠글 열쇠'); process.exit(1); }
  await kvDel('checkbus_otp');   /* 지난 번호가 남아 있으면 지운다 */
  const launch = { headless: true, args: ['--no-sandbox', '--disable-quic'] };
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const api = [];
  page.on('response', async (r) => {
    const u = r.url(); let host = ''; try { host = new URL(u).hostname; } catch (e) {}
    if (!/checkbus/i.test(host) || /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|map|json)(\?|$)/i.test(u)) return;
    const ct = r.headers()['content-type'] || ''; let body = null;
    if (/json/.test(ct)) { try { body = await r.json(); } catch (e) {} }
    let req = null; try { const pd = r.request().postData(); if (pd) { try { req = shape(JSON.parse(pd)); } catch (e) { req = '(폼)'; } } } catch (e) {}
    api.push({ method: r.request().method(), url: cleanUrl(u), status: r.status(), req, shape: body ? shape(body) : null });
  });

  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const pwIn = await page.$('input[type="password"]'); if (!pwIn) throw new Error('로그인 화면이 아님');
  const idIn = await page.$('input[type="text"]'); await idIn.click(); await idIn.fill(ID); await pwIn.fill(PW);
  /* 「로그인 유지」 체크 */
  try { const cb = await page.$('input[type="checkbox"]'); if (cb && !(await cb.isChecked())) await cb.check(); } catch (e) {}
  await page.click('input[type=submit], button:has-text("로그인")');
  await page.waitForTimeout(6000);
  const dev0 = api.find((a) => /check-device-code/.test(a.url));
  log('로그인 뒤 기기 확인:', dev0 ? JSON.stringify(dev0.shape) : '(없음)');
  const already = dev0 && dev0.shape && dev0.shape.result === true;
  if (!already) {
    /* 문자 보내기 */
    let sent = false;
    for (const sel of ['button:has-text("휴대폰 번호 인증하기")', 'a:has-text("휴대폰 번호 인증하기")', 'button:has-text("인증하기")', ':text("휴대폰 번호 인증하기")']) {
      try { const b = await page.$(sel); if (b) { await b.click({ timeout: 3000 }); sent = true; break; } } catch (e) {}
    }
    await page.waitForTimeout(4000);
    const smsReq = api.filter((a) => /sms|send|auth|verify|device|otp/i.test(a.url) && !/check-device-code/.test(a.url));
    log('문자 발송 단추 ' + (sent ? '누름' : '못 찾음') + ' · 관련 요청:', smsReq.map((a) => a.status + ' ' + a.method + ' ' + a.url + ' 응답:' + JSON.stringify(a.shape)).join(' | ') || '(없음)');
    const txt = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400));
    log('화면 글:', txt.replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, '01*-****-****').replace(/\d{4,}/g, '####'));
    /* 인증번호 기다리기 */
    log('인증번호를 기다립니다 (최대 ' + OTP_WAIT + '분) — 원장님이 채팅으로 알려 주면 Claude 가 lumen_store checkbus_otp 에 적습니다');
    let otp = '';
    for (let i = 0; i < OTP_WAIT * 6 && !otp; i++) { await page.waitForTimeout(10000); try { const v = await kvGet('checkbus_otp'); if (v && v.code && String(v.code).replace(/\D/g, '').length >= 4) otp = String(v.code).replace(/\D/g, ''); } catch (e) {} if (i % 6 === 5) log('… ' + ((i + 1) / 6) + '분 지남'); }
    if (!otp) { log('인증번호가 오지 않아 멈춥니다'); await browser.close(); process.exit(0); }
    log('인증번호 받음 (' + otp.length + '자리) — 입력');
    const otpIn = await page.$('input[placeholder*="인증번호"]'); if (!otpIn) throw new Error('인증번호 칸을 못 찾음');
    await otpIn.click(); await otpIn.fill(otp);
    const before = api.length;
    let ok2 = false;
    for (const sel of ['button:has-text("인증번호 확인")', ':text("인증번호 확인")', 'button:has-text("확인")']) { try { const b = await page.$(sel); if (b) { await b.click({ timeout: 3000 }); ok2 = true; break; } } catch (e) {} }
    if (!ok2) await otpIn.press('Enter');
    await page.waitForTimeout(6000);
    api.slice(before).forEach((a) => log('   인증 뒤 요청:', a.status, a.method, a.url, '응답:', JSON.stringify(a.shape).slice(0, 300)));
    await kvDel('checkbus_otp');
  }
  await page.waitForTimeout(3000);
  log('지금 주소:', cleanUrl(page.url()), '· 제목:', (await page.title()).slice(0, 60));
  const cookies = await ctx.cookies();
  const ls = await page.evaluate(() => { const o = {}; Object.keys(localStorage).forEach((k) => { o[k] = localStorage.getItem(k); }); return o; });
  log('쿠키 이름:', cookies.map((c) => c.name + '@' + c.domain).join(', '));
  log('localStorage 키:', Object.keys(ls).map((k) => k + '(' + String(ls[k] || '').length + '자)').join(', '));
  const onLogin = /\/login/.test(page.url());
  if (onLogin) {
    const txt = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300));
    log('아직 로그인 화면입니다 · 화면 글:', txt.replace(/\d{4,}/g, '####'));
  } else {
    /* 기기 기억 저장(잠금) */
    const box = await core.nbSeal({ at: new Date().toISOString(), cookies, ls, ua: 'mac-chrome-127' }, SEAL);
    box.at = new Date().toISOString(); box.kk = 'pii';
    log('기기 기억 저장:', (await kvSet('checkbus_device', box)) ? '완료 (checkbus_device · 잠금)' : '실패');
    /* 메뉴·내부 주소 관찰 */
    const menu = await page.$$eval('a[href], [routerlink], li', (els) => Array.from(new Set(els.map((a) => ((a.innerText || '').trim().slice(0, 14) + '→' + (a.getAttribute('href') || a.getAttribute('routerlink') || ''))))).filter((s) => s.length > 2 && s.indexOf('→') > 0).slice(0, 80));
    log('메뉴:', menu.join(' ; ') || '(없음)');
    const hrefs = await page.$$eval('a[href]', (els) => Array.from(new Set(els.map((a) => a.getAttribute('href')))).filter((h) => h && h.startsWith('/')).slice(0, 60));
    const cands = hrefs.filter((h) => /attend|check|hist|log|record|student|member|daily|report|stat|출결/i.test(h)).slice(0, 10);
    for (const h of ['/', '/statistics', '/attendance', '/student/list'].concat(cands)) {
      const b0 = api.length;
      try { await page.goto(new URL(h, HOME).href, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { continue; }
      await page.waitForTimeout(6000);
      for (const b of ['조회', '검색', '오늘']) { try { const btn = await page.$('button:has-text("' + b + '"), a:has-text("' + b + '")'); if (btn) { await btn.click({ timeout: 2000 }); await page.waitForTimeout(5000); break; } } catch (e) {} }
      const heads = await page.$$eval('th', (els) => els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30));
      const rows = await page.$$eval('tbody tr', (els) => els.length);
      log('▶ ' + h + ' → ' + cleanUrl(page.url()) + ' 「' + (await page.title()).slice(0, 30) + '」 · 표 줄 ' + rows + ' · 표 머리: ' + heads.join(' | '));
      api.slice(b0).forEach((a) => { if (a.shape && !/super\/popup|meta\.json/.test(a.url)) log('   ', a.status, a.method, a.url, '요청:', JSON.stringify(a.req || null).slice(0, 300), '응답:', JSON.stringify(a.shape).slice(0, 900)); });
    }
  }
  await browser.close();
  log('끝');
}
main().catch((e) => { console.error('실패:', e && e.message && String(e.message).slice(0, 200)); process.exit(1); });
