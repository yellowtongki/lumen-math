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

const KEEP_KEYS = /date|time|page|size|limit|offset|type|state|sort|order|merchantCode|month|year|from|to$|start|end|status|flag|count|search|keyword$/i;
function reqShape(o) {
  if (Array.isArray(o)) return o.length ? ['[' + o.length + '개]', reqShape(o[0])] : '[]';
  if (o && typeof o === 'object') { const r = {}; Object.keys(o).forEach((k) => { r[k] = (KEEP_KEYS.test(k) && !/name|phone/i.test(k)) ? o[k] : shape(o[k], 0, k); }); return r; }
  return o;
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
    if (!body && !/student/i.test(u)) return;
    let req = null;
    try { const pd = r.request().postData(); if (pd) { const o = JSON.parse(pd); req = reqShape(o); } } catch (e) { req = '(json 아님)'; }
    api.push({ method: r.request().method(), url: u.replace(/([?&])(token|key)=[^&]*/gi, '$1$2=***'), status: r.status(), req: req, shape: body ? shape(body) : null });
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
  for (let i = 0; i < 60 && !loginHit; i++) { await page.waitForTimeout(500); loginHit = api.find((a) => /login/i.test(a.url)); }
  if (!loginHit) {
    // 화면에 안내창이 떠 있으면 그 글(개인정보 없음)만 남기고 한 번 더 시도
    const dlg = await page.evaluate(() => { const els = Array.from(document.querySelectorAll('[role=dialog], .modal, .swal2-container, .popup')); return els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120)).join(' / '); });
    log('로그인 응답 없음 · 안내창:', dlg || '(없음)', '· 주소', page.url());
    try { const ok = await page.$('button:has-text("확인")'); if (ok) await ok.click(); } catch (e) {}
    await page.waitForTimeout(1500);
    try { await page.fill('input[type="password"]', PW); await page.click('button:has-text("로그인")'); } catch (e) {}
    for (let i = 0; i < 60 && !loginHit; i++) { await page.waitForTimeout(500); loginHit = api.find((a) => /login/i.test(a.url)); }
  }
  log('로그인 응답:', loginHit ? (loginHit.status + ' ' + loginHit.url) : '(못 잡음)');
  if (loginHit && loginHit.shape) log('로그인 응답 모양:', JSON.stringify(loginHit.shape).slice(0, 800));
  await page.waitForTimeout(4000);
  log('로그인 뒤 주소:', page.url());
  // 첫 화면 안내창 닫기
  try { const ok = await page.$('button:has-text("확인")'); if (ok) { await ok.click(); await page.waitForTimeout(1500); log('안내창 닫음'); } } catch (e) {}

  // 왼쪽 메뉴의 주소만 모은다 (글자 없이 href)
  try {
    await page.goto('https://manager.payssam.kr/bills', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    const hrefs = await page.$$eval('a[href]', (els) => Array.from(new Set(els.map((a) => a.getAttribute('href')))).filter((h) => h && h.startsWith('/')).slice(0, 60));
    log('메뉴 주소:', hrefs.join(' '));
  } catch (e) { log('메뉴 주소 수집 실패', e.message.slice(0, 80)); }
  // 화면을 직접 열고, 조회 단추가 있으면 누른 뒤 자료 모양(자료형만)과 표 머리를 남긴다
  const pages = ['/students', '/payments', '/bills', '/report'];
  for (const path of pages) {
    const before = api.length;
    try { await page.goto('https://manager.payssam.kr' + path, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { log('· ' + path + ' 열기 실패'); continue; }
    await page.waitForTimeout(7000);
    if (/\/404/.test(page.url())) { log('· ' + path + ' → 없음'); continue; }
    let pressed = '';
    for (const b of ['조회', '검색']) { let btn = null; try { btn = await page.$('button:has-text("' + b + '")'); } catch (e) {} if (btn) { try { await btn.click({ timeout: 3000 }); pressed = b; } catch (e) {} break; } }
    await page.waitForTimeout(6000);
    const heads = await page.$$eval('th', (els) => els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30));
    const rows = await page.$$eval('tbody tr', (els) => els.length);
    log('▶ ' + path + ' → ' + page.url() + (pressed ? ' · 「' + pressed + '」 누름' : '') + ' · 새 요청 ' + (api.length - before) + ' · 표 줄 ' + rows + ' · 표 머리: ' + heads.join(' | '));
    api.slice(before).forEach((a) => { if (path === '/students' || !/fail\/count|charge\/auto|configuration|active-events|merchants\/list|offline-payment|reserved\/count|point\/available|calculate\/menu|merchant\/v2\/user/.test(a.url)) log('   ', a.status, a.method, a.url, '요청:', a.req ? JSON.stringify(a.req).slice(0, 500) : '-', '응답:', a.shape ? JSON.stringify(a.shape).slice(0, 900) : ''); });
  }
  await browser.close();
  log('끝');
}
main().catch((e) => { console.error('실패:', e && e.message); process.exit(1); });
