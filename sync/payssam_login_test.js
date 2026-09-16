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
function shape(obj, depth) {
  depth = depth || 0;
  if (depth > 4) return '…';
  if (Array.isArray(obj)) return obj.length ? ['[' + obj.length + '개]', shape(obj[0], depth + 1)] : '[]';
  if (obj && typeof obj === 'object') {
    const o = {}; Object.keys(obj).slice(0, 40).forEach((k) => { o[k] = shape(maskVal(k, obj[k]), depth + 1); });
    return o;
  }
  return obj;
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
    if (!/payssam|paymint/.test(u) || /\.(js|css|png|jpg|svg|woff2?|ico|json\?\d+)$/.test(u)) return;
    const ct = r.headers()['content-type'] || '';
    let body = null;
    if (/json/.test(ct)) { try { body = await r.json(); } catch (e) {} }
    api.push({ method: r.request().method(), url: u.replace(/([?&])(token|key)=[^&]*/gi, '$1$2=***'), status: r.status(), shape: body ? shape(body) : null });
  });

  await page.goto('https://manager.payssam.kr/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  const idIn = (await page.$('input[type="email"]')) || (await page.$('input[type="text"]'));
  await idIn.fill(ID);
  await page.fill('input[type="password"]', PW);
  await page.click('button:has-text("로그인")');
  // 로그인 응답 기다리기
  let loginHit = null;
  for (let i = 0; i < 40 && !loginHit; i++) { await page.waitForTimeout(500); loginHit = api.find((a) => /login/i.test(a.url)); }
  log('로그인 응답:', loginHit ? (loginHit.status + ' ' + loginHit.url) : '(못 잡음)');
  if (loginHit && loginHit.shape) log('로그인 응답 모양:', JSON.stringify(loginHit.shape).slice(0, 800));
  await page.waitForTimeout(4000);
  log('로그인 뒤 주소:', page.url());
  const txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  log('화면 글(앞 300자):', txt.slice(0, 300));
  if (/로그인|비밀번호/.test(txt.slice(0, 200)) && /매니저 로그인/.test(txt)) log('⚠ 아직 로그인 화면 — 추가 인증(휴대폰 등)이 있을 수 있음');

  // 메뉴 링크
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a,button')).map((a) => ((a.innerText || '').trim().replace(/\s+/g, ' ') + '|' + (a.getAttribute('href') || ''))).filter((x) => x.length > 2 && x.length < 60));
  log('메뉴 후보(' + links.length + '):', Array.from(new Set(links)).slice(0, 60).join(' · '));

  // 결제·청구 관련 메뉴를 눌러 자료 모양 관찰
  const words = ['결제내역', '결제 내역', '수납', '청구', '납부', '매출', '정산', '학생', '원생'];
  for (const w of words) {
    const el = await page.$('a:has-text("' + w + '"), button:has-text("' + w + '")');
    if (!el) continue;
    const before = api.length;
    try { await el.click({ timeout: 5000 }); } catch (e) { continue; }
    await page.waitForTimeout(3500);
    log('▶ 「' + w + '」 눌렀음 → 주소', page.url(), '· 새 요청', api.length - before);
  }
  log('── payssam 요청 목록 (' + api.length + ') ──');
  api.forEach((a) => log(a.status, a.method, a.url, a.shape ? JSON.stringify(a.shape).slice(0, 700) : ''));
  await browser.close();
  log('끝');
}
main().catch((e) => { console.error('실패:', e && e.message); process.exit(1); });
