# sync/ — 매쓰플랫 자동 연동 스크립트

매쓰플랫(mathflat.com) 정오답 데이터를 자동 수집하기 위한 스크립트 모음입니다.

## 파일

| 파일 | 역할 |
|------|------|
| `mathflat_login_test.js` | **1단계: 로그인 테스트.** Playwright로 `teacher.mathflat.com` 로그인이 되는지 확인 |

## 사용법

```bash
# 계정 정보는 환경변수로만 전달 (절대 코드에 넣지 않기)
MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_login_test.js
```

실행하면 `sync/_debug/` 폴더에 단계별 스크린샷이 저장됩니다.
(01_login_page → 02_filled → 03_after_login, 오류 시 99_error)
이 폴더는 개인정보가 담길 수 있어 `.gitignore`로 커밋 제외되어 있습니다.

## ⚠️ 실행 환경 요구사항 (중요)

이 스크립트는 매쓰플랫 서버에 **실제로 인터넷 접속**을 해야 합니다.
Claude Code 클라우드 환경에서 실행하려면 **네트워크 정책이 `mathflat.com` 접속을
허용**해야 합니다.

기본(제한) 정책에서는 외부 사이트 접속이 차단되어(403) 로그인 테스트가 실패합니다.
환경 설정에서 인터넷 접속을 허용하는 정책으로 바꾸거나, `mathflat.com`을 허용
목록에 추가해야 합니다.
(참고: https://code.claude.com/docs/en/claude-code-on-the-web )

## 로컬(선생님 PC)에서 실행하려면

```bash
npm install playwright
npx playwright install chromium   # 브라우저 다운로드
MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_login_test.js
```
