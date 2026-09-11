# sync/ — 매쓰플랫 자동 연동 스크립트

매쓰플랫(mathflat.com) 정오답 데이터를 자동 수집하기 위한 스크립트 모음입니다.

## 파일

| 파일 | 역할 |
|------|------|
| `mathflat_login_http.js` | **1단계: 로그인 테스트 (✅ 성공, 권장 방식).** 매쓰플랫 내부 로그인 API를 직접 호출 |
| `mathflat_collector.js` | **2단계: 학습 데이터 수집기 (✅ 검증됨).** 학습지 **+ 교재 문항별 O/X** + 세션별(시간순) 통합 수집 |
| `mathflat_login_test.js` | 로그인 테스트 (브라우저 방식). 클라우드 프록시 환경에서는 브라우저 연결이 차단되어 동작하지 않음 — 로컬 PC 참고용 |
| `aha_ws_recent.js` | **학생별 「최근 학습지 10장」 발행** (아하리그 2차). 매쓰플랫 로그인 불필요 — 아래 설명 |

## 수집기 사용법

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node sync/mathflat_collector.js --days 14
```

- `--days N` 최근 N일 (기본 30) · `--students N` 학생 수 제한 · `--limit N` 학습지 처리 제한 · `--wb-limit N` 교재 처리 제한
- `--skip-problems`(학습지) · `--skip-workbook`(교재 문항) · `--skip-history`(세션) 각각 생략 가능
- 결과는 `sync/_debug/`에 저장 (개인정보 포함 → **커밋 금지**, .gitignore 처리됨)
  - `mf_answer_records.json` — **학습지 + 교재 문항별 O/X** (`source`로 구분, `record_key`로 중복방지)
    - 고유키 형식: 학습지 `ws:학생학습지ID:문항순번` / 교재 `wb:학생교재ID:회차ID:문항ID`
    - 2026-08-28: 교재 키에 **회차ID**를 넣었다. 전에는 같은 교재를 2회차로 다시 풀면 1회차 기록을
      덮어써 문항수가 안 늘었다. 옛 기록(39,292건)은 `--fix-keys`가 새 키로 옮긴다(매일 수집에 포함).
      `node sync/mathflat_collector.js --fix-keys --dry-run` 으로 미리보기만 가능.
  - `mf_study_sessions.json` — 학습지+교재 세션별(시간순) 요약

> ⚠️ 교재 문항 수집은 교재 1권당 진도별로 수십~수백 회 호출한다(무거움). 야간 실행 시 `--days`를 좁혀 최근 활동만 수집 권장.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` 설정 시 각 테이블에 자동 upsert
- 저장 스키마: **`docs/mathflat_schema.md`**

검증 결과(2026-07-12): 활동학생 26명 · 학습지 문항 1,801개(오답 401) · 교재 세션 153개(오답 14,774) 정상 수집.

## 아하리그 2차 — 새로 붙은 두 단계 (2026-09-11)

아하노트에서 「매쓰플랫 학습지」를 출처로 고를 수 있게 하려고 두 가지를 추가했습니다.
둘 다 **새벽 수집 맨 끝**에서 자동으로 돌아가고, 실패해도 앞의 수집 결과에는 영향이 없습니다.

### ① 📄 학생별 최근 학습지 — `sync/aha_ws_recent.js`

이미 모아 둔 채점기록(`mf_answer_records`)만 다시 읽어, 학생 한 명마다
**최근에 채점된 학습지 10장**을 정리해 `lumen_store` 의 `mf_ws_recent_<학생코드>` 키에 저장합니다.
학생앱 아하노트의 「출처 고르기」 아코디언과 홈의 「오늘의 노트 후보」가 이 키를 읽습니다.

```bash
node sync/aha_ws_recent.js           # 저장까지
node sync/aha_ws_recent.js --dry     # 저장하지 않고 요약만 보기
node sync/aha_ws_recent.js --days 180  # 읽어 올 기간 (기본 120일)
```

- **매쓰플랫에 로그인하지 않습니다**(Supabase만 사용) → 낮에 돌려도 원장님 접속이 끊기지 않습니다.
- 학습지 한 장에 담기는 것: 제목·종류·배정일·채점일·문항 수 ·
  **틀린 번호(❌)** · **어려운데 맞힌 번호(⭐ 난이도 상 이상)** · 문항별 정오답.
- 교재 기록(학습지 번호가 없는 것)은 넣지 않습니다.
- 학생 이름 잇기: `mf_students`(매쓰플랫 이름) ↔ `or_studentdb`(학원 등록부) 를 이름으로 맞춥니다.
  동명이인은 학년으로 가르고, 그래도 못 가르면 그 학생만 건너뛰며 기록을 남깁니다(로그에도 실명은 안 씁니다).
- 첫 실행 결과(2026-09-11): 학생 27명 · 학습지 267장 발행.

### ② 🖼 아하노트 해설 그림 복사 — `copyAhaSolutions()` (수집기 안)

학생이 학습지 문항으로 올린 아하노트 중 **아직 해설 그림이 없는 것**만 골라,
매쓰플랫에서 그 문항의 해설 이미지를 받아 우리 저장소
`aha_photos/mfsol/<학습지번호>/<문항번호>.jpg` 에 보관하고 노트에 주소를 적어 둡니다.
학원앱 「💡 힌트 만들기」가 이 그림을 재료로 씁니다(학생에게 매쓰플랫 그림을 그대로 보여 주지는 않습니다).

```bash
# 해설 복사만 따로 (매쓰플랫 로그인 필요 → 새벽에만)
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node sync/mathflat_collector.js --aha-sol

# 최근 학습지 발행만 따로 (로그인 불필요)
node sync/mathflat_collector.js --ws-recent
```

- **질문이 올라온 문항만** 복사합니다(학습지 전체가 아닙니다). 이미 받아 둔 그림은 다시 받지 않습니다.
- `aha_notes` 에 `mf` 열이 아직 없으면(= `docs/aha_league2.sql` 실행 전) 조용히 건너뜁니다.
- 노트를 고칠 때 `mf` 안의 기존 값(학습지·문항번호·난이도 등)은 그대로 두고 `sol`(해설 주소)만 채웁니다.

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
