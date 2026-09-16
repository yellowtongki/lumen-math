#!/usr/bin/env node
/**
 * 결제선생(payssam) 매니저 로그인 시험 + 내부 API 관찰
 * ============================================================
 * 목적: 수납·결제 내역을 자동으로 가져올 수 있는지 확인하는 1단계.
 *   ① 이메일/비밀번호로 로그인이 되는지
 *   ② 로그인 뒤 화면이 어떤 내부 주소(API)를 부르는지
 *   ③ 결제·청구 내역 화면이 어떤 모양의 자료를 주는지 (열 이름만)
 *
 * 계정: 환경변수 PAYSSAM_ID / PAYSSAM_PASSWORD (GitHub Secrets · 클라우드 환경변수)
 * 출력 규칙: 비밀번호·토큰은 절대 찍지 않는다. 학생 이름·전화번호는 가린다.
 *
 * 실행: node sync/payssam_login_test.js      (GitHub Actions: payssam-test.yml)
 */
const { chromium } = require('playwright');

const ID = process.env.PAYSSAM_ID, PW = process.env.PAYSSAM_PASSWORD;
const t0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's]', ...a);
const SECRET_KEYS = /token|password|passwd|secret|authorization|cookie|session|jwt|apikey|api_key/i;
const PII_KEYS = /name|phone|tel|mobile|email|address|birth|parent|student/i;

function maskVal(k, v) {
  if (v == null) return v;
  if (SECRET_KEYS.test(k)) return '***';
  if (typeof v === 'string') {
    if (/^\d{2,3}-?\d{3,4}-?\d{4}$/.test(v)) return v.slice(0, 3) + '-****-' + v.slice(-2);
    if (PII_KEYS.test(k) && v.length >= 2) return v[0] + '*'.repeat(Math.min(v.length - 1, 3));
    if (v.length > 60) return v.slice(0, 40) + '…(' + v.length + '자)';
  }
  return v;
}
function shape(obj, depth, key) {
  depth = depth || 0;
  if (depth > 5) return '…';
  if (Array.isArray(obj)) return obj.length ? ['[' + obj.length + '개]', shape(obj[0], depth + 1, key)] : '[]';
  if (obj && typeof obj === 'object') {
    const o = {}; Object.keys(obj).slice(0, 60).forEach((k) => { o[k] = shape(obj[k], depth + 1, k); });
    return o;
  }
  /* 공개 저장소 로그이므로 값은 남기지 않는다 — code·msg·플래그만 그대로, 나머지는 자료형 */
  if (key === 'code' || key === 'msg') return obj;
  if (typeof obj === 'boolean') return obj;
  if (obj == null) return null;
  if (typeof obj === 'number') return 'num';
  if (typeof obj === 'string') return (/^\d{4}-\d{2}-\d{2}/.test(obj) ? 'date' : (/^\d+$/.test(obj) ? 'numstr' : 'str' + obj.length));
  return typeof obj;
}

async function main() {
  if (!ID || !PW) { console.error('❌ PAYSSAM_ID / PAYSSAM_PASSWORD 환경변수가 없습니다'); process.exit(1); }
  log('로그인 아이디:', ID.slice(0, 3) + '***');
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
  const api = [];       // { method, url, status, keys }
  page.on('response', async (r) => {
    const u = r.url();
    let host = ''; try { host = new URL(u).hostname; } catch (e) {}
    if (!/payssam\.kr$|paymint/.test(host) || /manager\.payssam\.kr$/.test(host) || /\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/.test(u)) return;
    const ct = r.headers()['content-type'] || '';
    let body = null;
    if (/json/.test(ct)) { try { body = await r.json(); } catch (e) {} }
    if (!body) return;
    api.push({ method: r.request().method(), url: u.replace(/([?&])(token|key)=[^&]*/gi, '$1$2=***'), status: r.status(), shape: body ? shape(body) : null });
  });

  await page.goto('https://manager.payssam.kr/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  const ins = await page.$$eval('input', (els) => els.map((e) => (e.type || '') + '|' + (e.name || '') + '|' + (e.placeholder || '')));
  log('입력칸:', ins.join(' , '));
  const idIn = await page.$('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])');
  if (!idIn) throw new Error('아이디 칸을 못 찾음');
  await idIn.click(); await idIn.fill(ID);
  await page.fill('input[type="password"]', PW);
  await page.click('button:has-text("로그인")');
  // 로그인 응답 기다리기
  let loginHit = null;
  for (let i = 0; i < 40 && !loginHit; i++) { await page.waitForTimeout(500); loginHit = api.find((a) => /login/i.test(a.url)); }
  log('로그인 응답:', loginHit ? (loginHit.status + ' ' + loginHit.url) : '(못 잡음)');
  if (loginHit && loginHit.shape) log('로그인 응답 모양:', JSON.stringify(loginHit.shape).slice(0, 800));
  await page.waitForTimeout(4000);
  log('로그인 뒤 주소:', page.url());
  // 첫 화면 안내창 닫기
  try { const ok = await page.$('button:has-text("확인")'); if (ok) { await ok.click(); await page.waitForTimeout(1500); log('안내창 닫음'); } } catch (e) {}

  // 메뉴 탐색 — 왼쪽 메뉴 글자로 이동하고, 조회 단추가 있으면 누른다. 화면 글은 남기지 않는다.
  const menus = ['학생', '수납내역', '결제내역', '매출 보고서', '청구서 관리', '현금영수증'];
  for (const m of menus) {
    const before = api.length;
    let el = null;
    try { el = await page.$('nav >> text="' + m + '"'); } catch (e) {}
    if (!el) { try { el = await page.$('text="' + m + '"'); } catch (e) {} }
    if (!el) { log('· 「' + m + '」 메뉴 못 찾음'); continue; }
    try { await el.click({ timeout: 5000 }); } catch (e) { log('· 「' + m + '」 클릭 실패'); continue; }
    await page.waitForTimeout(6000);
    const url1 = page.url();
    let btn = null;
    for (const b of ['조회', '검색', '전체']) { try { btn = await page.$('button:has-text("' + b + '")'); } catch (e) {} if (btn) { try { await btn.click({ timeout: 3000 }); log('   「' + b + '」 단추 누름'); } catch (e) {} break; } }
    await page.waitForTimeout(5000);
    const heads = await page.$$eval('th', (els) => els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30));
    log('▶ 「' + m + '」 → ' + url1 + ' · 새 요청 ' + (api.length - before) + ' · 표 머리: ' + heads.join(' | '));
    api.slice(before).forEach((a) => { if (!/fail\/count|charge\/auto|configuration|active-events|merchants\/list|offline-payment|reserved\/count|point\/available|calculate\/menu/.test(a.url)) log('   ', a.status, a.method, a.url, a.shape ? JSON.stringify(a.shape).slice(0, 1500) : ''); });
  }
  await browser.close();
  log('끝');
}
main().catch((e) => { console.error('실패:', e && e.message); process.exit(1); });
