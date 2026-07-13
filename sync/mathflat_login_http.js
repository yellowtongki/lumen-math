/**
 * 매쓰플랫 로그인 테스트 (HTTP 방식) — 클라우드 환경 권장 방식
 *
 * 브라우저(Playwright) 없이, 매쓰플랫 선생님용 앱이 내부적으로 쓰는
 * 로그인 API(POST https://api.mathflat.com/v2/login)를 직접 호출한다.
 * 클라우드 프록시 환경에서 브라우저 연결이 차단되어도 이 방식은 동작한다.
 *
 * 사용법:
 *   MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_login_http.js
 *
 * 규칙:
 *   - 계정은 환경변수로만 받는다. 코드/저장소에 비밀번호 금지.
 *   - 토큰 등 민감정보는 화면에 일부만 마스킹 출력, 파일로 저장하지 않는다.
 */

const API_BASE = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';

const ID = process.env.MATHFLAT_ID;
const PW = process.env.MATHFLAT_PASSWORD;

function log(...args) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${t}]`, ...args);
}

function mask(s) {
  if (!s) return '(없음)';
  const str = String(s);
  return str.length <= 8 ? str[0] + '***' : str.slice(0, 6) + '...' + str.slice(-4);
}

async function main() {
  if (!ID || !PW) {
    console.error('❌ 환경변수 MATHFLAT_ID / MATHFLAT_PASSWORD 가 필요합니다.');
    process.exit(1);
  }
  log(`로그인 시도: ${ID.slice(0, 2)}***** → ${API_BASE}/v2/login`);

  let res;
  try {
    res = await fetch(`${API_BASE}/v2/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        // 매쓰플랫 API가 요구하는 플랫폼 증명 헤더 (선생님용 웹앱과 동일하게)
        'x-platform': 'TEACHER_WEB',
        'x-freewheelin-host': 'mathflat.com',
        origin: 'https://teacher.mathflat.com',
        referer: 'https://teacher.mathflat.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        id: ID.trim(),
        password: PW.trim(),
        userType: 'TEACHER',
        serviceType: 'MATHFLAT',
      }),
    });
  } catch (e) {
    log('❌ 네트워크 오류:', e.message);
    log('   (클라우드 환경이면: NODE_USE_ENV_PROXY=1 과 NODE_EXTRA_CA_CERTS 설정 필요)');
    console.log('\nRESULT=ERROR');
    process.exit(3);
  }

  log('응답 상태:', res.status, res.statusText);

  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch (_) {
    log('응답(JSON 아님, 앞 200자):', text.slice(0, 200));
  }

  if (res.ok && body) {
    // 토큰/식별자는 마스킹해서 표시
    const summary = {};
    for (const [k, v] of Object.entries(body)) {
      summary[k] = /token/i.test(k) ? mask(v) : v;
    }
    log('✅ 로그인 성공! 응답 요약:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\nRESULT=SUCCESS');
  } else {
    log('❌ 로그인 실패. 응답:');
    console.log(JSON.stringify(body, null, 2) || text.slice(0, 300));
    console.log('\nRESULT=FAIL');
    process.exitCode = 2;
  }
}

main();
