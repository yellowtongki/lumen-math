/**
 * 매쓰플랫(teacher.mathflat.com) 로그인 테스트 스크립트
 *
 * 목적: Playwright로 매쓰플랫 선생님용 웹에 로그인이 되는지 확인하는 1단계 테스트.
 *
 * 사용법:
 *   MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_login_test.js
 *
 * 주의:
 *   - 아이디/비밀번호는 환경변수(MATHFLAT_ID, MATHFLAT_PASSWORD)로만 받는다. 절대 코드에 넣지 않는다.
 *   - 실행 결과 스크린샷은 sync/_debug/ 에 저장된다 (개인정보 포함 가능 → 커밋 금지).
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 사전 설치된 Chromium 실행 파일 자동 탐색 (클라우드 환경엔 브라우저가 이미 있음)
function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium-'));
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (_) {}
  return undefined; // 못 찾으면 playwright 기본값 사용
}

const ID = process.env.MATHFLAT_ID;
const PW = process.env.MATHFLAT_PASSWORD;

const LOGIN_URL = 'https://teacher.mathflat.com/login';
const DEBUG_DIR = path.join(__dirname, '_debug');

function log(...args) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${t}]`, ...args);
}

async function main() {
  if (!ID || !PW) {
    console.error('❌ 환경변수 MATHFLAT_ID / MATHFLAT_PASSWORD 가 설정되어 있지 않습니다.');
    process.exit(1);
  }
  log(`로그인 시도 아이디: ${ID.slice(0, 2)}***** (마스킹)`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: findChromium(),
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  // 로그인 이후 어떤 API를 부르는지 관찰하기 위해 응답 로깅
  const apiHits = [];
  page.on('response', (res) => {
    const url = res.url();
    if (/login|auth|token|academy|teacher|student/i.test(url) && !/\.(js|css|png|jpg|svg|woff)/i.test(url)) {
      apiHits.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });

  try {
    log(`페이지 이동: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    log('현재 URL:', page.url());
    log('페이지 제목:', await page.title());

    await page.screenshot({ path: path.join(DEBUG_DIR, '01_login_page.png'), fullPage: true });

    // 입력 필드 탐색 (여러 후보 셀렉터 시도)
    const idSel = await firstVisible(page, [
      'input[name="id"]',
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="아이디"]',
      'input[placeholder*="ID"]',
    ]);
    const pwSel = await firstVisible(page, [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="비밀번호"]',
    ]);

    log('아이디 입력칸 셀렉터:', idSel);
    log('비밀번호 입력칸 셀렉터:', pwSel);

    if (!idSel || !pwSel) {
      log('⚠️ 로그인 입력칸을 찾지 못했습니다. 페이지 구조를 확인하세요 (01_login_page.png).');
      const inputs = await page.$$eval('input', (els) =>
        els.map((e) => ({ name: e.name, type: e.type, ph: e.placeholder }))
      );
      log('페이지의 input 목록:', JSON.stringify(inputs));
      throw new Error('로그인 입력칸 탐색 실패');
    }

    await page.fill(idSel, ID);
    await page.fill(pwSel, PW);
    log('아이디/비밀번호 입력 완료');

    await page.screenshot({ path: path.join(DEBUG_DIR, '02_filled.png') });

    // 로그인 버튼 탐색 및 클릭
    const btn = await firstVisible(page, [
      'button[type="submit"]',
      'button:has-text("로그인")',
      'button:has-text("LOGIN")',
      'a:has-text("로그인")',
    ]);
    log('로그인 버튼 셀렉터:', btn);

    if (btn) {
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}),
        page.click(btn),
      ]);
    } else {
      // 버튼을 못 찾으면 엔터로 제출 시도
      await page.press(pwSel, 'Enter');
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    }

    await page.waitForTimeout(4000);
    const afterUrl = page.url();
    log('로그인 시도 후 URL:', afterUrl);
    log('로그인 시도 후 제목:', await page.title());
    await page.screenshot({ path: path.join(DEBUG_DIR, '03_after_login.png'), fullPage: true });

    // 성공 판정: URL이 /login 을 벗어났거나, 쿠키/토큰이 생겼는지 확인
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) =>
      /token|auth|session|access/i.test(c.name)
    );
    const stillOnLogin = /\/login/i.test(afterUrl);

    // 에러 메시지 탐색
    const errText = await page
      .$$eval('*', (els) =>
        els
          .map((e) => (e.childElementCount === 0 ? e.textContent : ''))
          .filter((t) => t && /(일치하지|틀렸|올바르지|실패|잘못|없습니다|오류)/.test(t))
          .slice(0, 3)
      )
      .catch(() => []);

    log('---------- 결과 요약 ----------');
    log('관찰된 인증 관련 네트워크 요청:');
    apiHits.slice(-15).forEach((h) => log('  ', h));
    log('인증 쿠키:', authCookie ? `${authCookie.name} (존재)` : '없음');
    if (errText.length) log('화면 에러 메시지 후보:', JSON.stringify(errText));

    if (!stillOnLogin || authCookie) {
      log('✅ 로그인 성공으로 보입니다.');
      console.log('\nRESULT=SUCCESS');
    } else {
      log('❌ 로그인 실패로 보입니다 (여전히 로그인 페이지).');
      console.log('\nRESULT=FAIL');
      process.exitCode = 2;
    }
  } catch (e) {
    log('❌ 예외 발생:', e.message);
    await page.screenshot({ path: path.join(DEBUG_DIR, '99_error.png'), fullPage: true }).catch(() => {});
    console.log('\nRESULT=ERROR');
    process.exitCode = 3;
  } finally {
    await browser.close();
  }
}

async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 })) return sel;
    } catch (_) {
      /* 다음 후보 */
    }
  }
  return null;
}

main();
