#!/usr/bin/env node
/**
 * 출결선생(checkbus) 관리자 로그인 시험 + 내부 API 관찰 — 1단계 정찰
 * ============================================================
 * 원장 지시 2026-10-17 「출결선생 관리자 웹페이지 있다. 네이버처럼 자동화를 원한다. 엑셀은 필요 없다.」
 * 목적: 등원·하원 기록(실제 방문 시각·체류 시간)을 자동으로 가져올 수 있는지 확인한다.
 *   ① 아이디/비밀번호로 로그인이 되는지
 *   ② 로그인 뒤 화면이 어떤 내부 주소(API)를 부르는지
 *   ③ 출결 기록 화면이 어떤 모양의 자료를 주는지 (열 이름·자료형만)
 *
 * 계정: 환경변수 CHECKBUS_ID / CHECKBUS_PASSWORD (GitHub Secrets)
 * 출력 규칙: 공개 저장소·공개 로그 — 비밀번호·토큰·쿠키는 절대 찍지 않는다. 학생 이름·전화번호는 가린다. 값은 자료형만.
 *
 * 실행: node sync/checkbus_login_test.js      (GitHub Actions: checkbus-test.yml)
 * ※ 이 작업 환경(클라우드 컨테이너)에서는 admin.checkbus.co.kr 접속이 막혀 있어 Actions 에서만 돈다.
 */
const { chromium } = require('playwright');

const ID = process.env.CHECKBUS_ID, PW = process.env.CHECKBUS_PASSWORD;
const HOME = 'https://admin.checkbus.co.kr/';
const t0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's]', ...a);
const SECRET_KEYS = /token|password|passwd|pwd|secret|authorization|cookie|session|jwt|apikey|api_key|otp/i;
const PII_KEYS = /name|phone|tel|mobile|hp|email|address|addr|birth|parent|student|memo|note/i;

function shape(obj, depth, key) {
  depth = depth || 0;
  if (depth > 5) return '…';
  if (Array.isArray(obj)) return obj.length ? ['[' + obj.length + '개]', shape(obj[0], depth + 1, key)] : '[]';
  if (obj && typeof obj === 'object') {
    const o = {}; Object.keys(obj).slice(0, 60).forEach((k) => { o[k] = shape(obj[k], depth + 1, k); });
    return o;
  }
  /* 값은 남기지 않는다 — code·msg·result 같은 상태 칸과 참/거짓만 그대로, 나머지는 자료형 */
  if (key && SECRET_KEYS.test(key)) return '***';
  if (key && /^(code|msg|message|result|status|success)$/i.test(key) && !(PII_KEYS.test(String(obj)))) return typeof obj === 'string' ? obj.slice(0, 40) : obj;
  if (typeof obj === 'boolean') return obj;
  if (obj == null) return null;
  if (typeof obj === 'number') return 'num';
  if (typeof obj === 'string') return (/^\d{4}-\d{2}-\d{2}/.test(obj) ? 'date' : (/^\d{2}:\d{2}/.test(obj) ? 'time' : (/^\d+$/.test(obj) ? 'numstr' : 'str' + obj.length)));
  return typeof obj;
}
const KEEP_KEYS = /date|time|page|size|limit|offset|type|state|sort|order|month|year|from|to$|start|end|status|flag|count|search|kind|mode|day/i;
function reqShape(o) {
  if (Array.isArray(o)) return o.length ? ['[' + o.length + '개]', reqShape(o[0])] : '[]';
  if (o && typeof o === 'object') { const r = {}; Object.keys(o).forEach((k) => { r[k] = (KEEP_KEYS.test(k) && !PII_KEYS.test(k) && !SECRET_KEYS.test(k)) ? o[k] : shape(o[k], 0, k); }); return r; }
  return o;
}
const cleanUrl = (u) => u.replace(/([?&])(token|key|auth|session|sid|pw|password)=[^&]*/gi, '$1$2=***');

async function main() {
  if (!ID || !PW) { console.error('❌ CHECKBUS_ID / CHECKBUS_PASSWORD 환경변수가 없습니다 — GitHub Secrets 에 등록해 주세요'); process.exit(1); }
  log('로그인 아이디:', ID.slice(0, 2) + '***');
  const launch = { headless: true, args: ['--no-sandbox', '--disable-quic'] };
  if (process.env.PW_CHROME) launch.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const api = [];
  page.on('response', async (r) => {
    const u = r.url();
    let host = ''; try { host = new URL(u).hostname; } catch (e) {}
    if (!/checkbus/i.test(host) || /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|map)(\?|$)/i.test(u)) return;
    const ct = r.headers()['content-type'] || '';
    let body = null;
    if (/json/.test(ct)) { try { body = await r.json(); } catch (e) {} }
    let req = null;
    try { const pd = r.request().postData(); if (pd) { try { req = reqShape(JSON.parse(pd)); } catch (e) { req = '(폼) ' + pd.replace(/=[^&]*/g, '=…').slice(0, 200); } } } catch (e) {}
    api.push({ method: r.request().method(), url: cleanUrl(u), status: r.status(), ct: ct.split(';')[0], req, shape: body ? shape(body) : null });
  });

  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  log('첫 주소:', page.url(), '· 제목:', (await page.title()).slice(0, 60));
  const ins = await page.$$eval('input', (els) => els.map((e) => (e.type || '') + '|' + (e.name || e.id || '') + '|' + (e.placeholder || '')));
  log('입력칸:', ins.join(' , ') || '(없음)');
  const btns = await page.$$eval('button, input[type=submit], a.btn', (els) => els.map((e) => (e.innerText || e.value || '').trim()).filter(Boolean).slice(0, 20));
  log('단추:', btns.join(' | '));
  const frames = page.frames().map((f) => f.url()).filter((u) => u && u !== 'about:blank');
  if (frames.length > 1) log('프레임:', frames.map(cleanUrl).join(' , '));

  /* 로그인: 비밀번호 칸이 있는 프레임(없으면 본문)에서 */
  let fr = page; for (const f of page.frames()) { try { if (await f.$('input[type="password"]')) { fr = f; break; } } catch (e) {} }
  const pwIn = await fr.$('input[type="password"]');
  if (!pwIn) { log('비밀번호 칸을 못 찾음 — 로그인 화면이 다른 주소일 수 있음'); }
  else {
    const idIn = await fr.$('input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
    if (!idIn) throw new Error('아이디 칸을 못 찾음');
    await idIn.click(); await idIn.fill(ID);
    await pwIn.fill(PW);
    let clicked = false;
    for (const sel of ['button:has-text("로그인")', 'input[type=submit]', 'button[type=submit]', 'a:has-text("로그인")', 'button']) {
      try { const b = await fr.$(sel); if (b) { await b.click({ timeout: 3000 }); clicked = true; break; } } catch (e) {}
    }
    if (!clicked) { await pwIn.press('Enter'); }
    await page.waitForTimeout(6000);
    const loginHits = api.filter((a) => /login|signin|auth|sign-in|member/i.test(a.url));
    log('로그인 관련 요청:', loginHits.length ? loginHits.map((a) => a.status + ' ' + a.method + ' ' + a.url + (a.shape ? ' 응답:' + JSON.stringify(a.shape).slice(0, 300) : '')).join('\n   ') : '(없음 — 폼 전송형일 수 있음)');
    const dlg = await page.evaluate(() => { const els = Array.from(document.querySelectorAll('[role=dialog], .modal, .swal2-container, .popup, .alert')); return els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120)).join(' / '); });
    if (dlg) log('안내창:', dlg);
  }
  log('로그인 뒤 주소:', cleanUrl(page.url()), '· 제목:', (await page.title()).slice(0, 60));
  const cookieNames = (await ctx.cookies()).map((c) => c.name + '@' + c.domain).join(', ');
  log('쿠키 이름(값 없음):', cookieNames || '(없음)');

  /* 메뉴 주소 모으기 */
  const hrefs = await page.$$eval('a[href]', (els) => Array.from(new Set(els.map((a) => a.getAttribute('href')))).filter((h) => h && !/^(#|javascript|mailto|tel)/.test(h)).slice(0, 80));
  const menuTexts = await page.$$eval('nav a, .menu a, .sidebar a, .lnb a, .gnb a, aside a, ul li a', (els) => els.map((a) => ((a.innerText || '').trim() + '→' + (a.getAttribute('href') || ''))).filter((s) => s.length > 2 && !/mailto|tel:/.test(s)).slice(0, 60));
  log('메뉴 글·주소:', menuTexts.join(' ; ') || '(없음)');
  log('링크 주소:', hrefs.map(cleanUrl).join(' ') || '(없음)');

  /* 출결 비슷한 메뉴를 열어 본다 */
  const cand = hrefs.filter((h) => /attend|check|in|out|hist|log|record|list|student|member|daily|report|stat|출결|등원|하원/i.test(h)).slice(0, 8);
  const extra = ['/attendance', '/attend', '/attendance/list', '/history', '/student', '/students', '/member', '/report'];
  const seen = {};
  for (const h of cand.concat(extra)) {
    let url; try { url = new URL(h, page.url()).href; } catch (e) { continue; }
    if (seen[url]) continue; seen[url] = 1;
    const before = api.length;
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { log('· ' + cleanUrl(url) + ' 열기 실패'); continue; }
    await page.waitForTimeout(5000);
    let pressed = '';
    for (const b of ['조회', '검색', '오늘']) { let btn = null; try { btn = await page.$('button:has-text("' + b + '"), a:has-text("' + b + '"), input[value="' + b + '"]'); } catch (e) {} if (btn) { try { await btn.click({ timeout: 3000 }); pressed = b; } catch (e) {} break; } }
    if (pressed) await page.waitForTimeout(5000);
    const heads = await page.$$eval('th', (els) => els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30));
    const rows = await page.$$eval('tbody tr', (els) => els.length);
    const title = (await page.title()).slice(0, 40);
    log('▶ ' + cleanUrl(url) + ' → ' + cleanUrl(page.url()) + ' 「' + title + '」' + (pressed ? ' · 「' + pressed + '」 누름' : '') + ' · 새 요청 ' + (api.length - before) + ' · 표 줄 ' + rows + ' · 표 머리: ' + heads.join(' | '));
    api.slice(before).forEach((a) => { if (a.shape || /json/.test(a.ct) || a.req) log('   ', a.status, a.method, a.url, '요청:', a.req ? JSON.stringify(a.req).slice(0, 400) : '-', '응답:', a.shape ? JSON.stringify(a.shape).slice(0, 900) : '(' + a.ct + ')'); });
  }
  const others = api.filter((a) => a.shape).slice(0, 40);
  log('JSON 을 준 요청 전체(최대 40):'); others.forEach((a) => log('   ', a.status, a.method, a.url));
  await browser.close();
  log('끝 — 이 로그를 보고 2단계(수집기)를 만든다');
}
main().catch((e) => { console.error('실패:', e && e.message && e.message.slice(0, 200)); process.exit(1); });
