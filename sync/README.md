# sync/ — 매쓰플랫 자동 연동 스크립트

매쓰플랫(mathflat.com) 정오답 데이터를 자동 수집하기 위한 스크립트 모음입니다.

## 파일

| 파일 | 역할 |
|------|------|
| `mathflat_login_http.js` | **1단계: 로그인 테스트 (✅ 성공, 권장 방식).** 매쓰플랫 내부 로그인 API를 직접 호출 |
| `mathflat_collector.js` | **2단계: 학습 데이터 수집기 (✅ 검증됨).** 학습지 **+ 교재 문항별 O/X** + 세션별(시간순) 통합 수집 |
| `mathflat_login_test.js` | 로그인 테스트 (브라우저 방식). 클라우드 프록시 환경에서는 브라우저 연결이 차단되어 동작하지 않음 — 로컬 PC 참고용 |

## 수집기 사용법

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node sync/mathflat_collector.js --days 14
```

- `--days N` 최근 N일 (기본 30) · `--students N` 학생 수 제한 · `--limit N` 학습지 처리 제한 · `--wb-limit N` 교재 처리 제한
- `--skip-problems`(학습지) · `--skip-workbook`(교재 문항) · `--skip-history`(세션) 각각 생략 가능
- 결과는 `sync/_debug/`에 저장 (개인정보 포함 → **커밋 금지**, .gitignore 처리됨)
  - `mf_answer_records.json` — **학습지 + 교재 문항별 O/X** (`source`로 구분, `record_key`로 중복방지)
  - `mf_study_sessions.json` — 학습지+교재 세션별(시간순) 요약

> ⚠️ 교재 문항 수집은 교재 1권당 진도별로 수십~수백 회 호출한다(무거움). 야간 실행 시 `--days`를 좁혀 최근 활동만 수집 권장.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` 설정 시 각 테이블에 자동 upsert
- 저장 스키마: **`docs/mathflat_schema.md`**

검증 결과(2026-07-12): 활동학생 26명 · 학습지 문항 1,801개(오답 401) · 교재 세션 153개(오답 14,774) 정상 수집.

## 사용법 (클라우드 환경)

```bash
# 계정 정보는 환경변수로만 전달 (절대 코드에 넣지 않기)
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node sync/mathflat_login_http.js
```

성공하면 `RESULT=SUCCESS`와 함께 학원ID/선생님ID/권한이 출력됩니다.
(토큰은 마스킹되어 표시되며 어디에도 저장되지 않습니다)

## 알아낸 매쓰플랫 API 구조 (2026-07 기준)

- **로그인**: `POST https://api.mathflat.com/v2/login`
  - 필수 헤더: `x-platform: TEACHER_WEB`, `x-freewheelin-host: mathflat.com`
  - 본문: `{ id, password, userType: "TEACHER", serviceType: "MATHFLAT" }`
  - 응답: `accessToken`, `refreshToken`, `academyId`, `userId`, `authorities` 등
- 이후 API 호출 시 발급받은 `accessToken`을 인증 헤더로 사용 (2단계 수집기에서 활용)

## 환경 요구사항

- **네트워크 허용 목록**: `teacher.mathflat.com`, `api.mathflat.com`
  (와일드카드 지원 시 `*.mathflat.com` 권장)
- 클라우드 환경은 프록시를 거치므로 Node 실행 시
  `NODE_USE_ENV_PROXY=1`, `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` 필요
- 브라우저(Playwright) 방식은 클라우드 프록시가 브라우저 연결을 끊어 사용 불가
  → HTTP 방식 사용 (더 가볍고 안정적)

## 로컬(선생님 PC)에서 실행하려면

```bash
MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_login_http.js
```
(프록시 관련 환경변수 없이 그대로 실행하면 됩니다)

## 다음 단계

1. ~~로그인 테스트~~ ✅ 완료 (2026-07-12)
2. **수집기 개발** — 학생 목록 → 교재별 정오답(O/X) 수집 API 파악·호출
3. Supabase `mf_answer_records` 테이블 설계·저장
4. 앱 기능 구현 (복습 스케줄러 등)
5. 매일 자동 실행 예약
