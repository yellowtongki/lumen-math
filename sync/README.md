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

---

# 수학비서 기출 출제경향 분석 (보고서 · 발표 PPT)

수학비서(mathsecr.com) 「나만의 DB」에 담긴 학교별 기출 문항을 읽어
**학교·학년·학기별 출제경향 보고서(HTML)와 수업 발표용 슬라이드(PPTX)** 를 만든다.

## 스크립트

| 파일 | 역할 |
|------|------|
| `mathsecr_exam_collector.js` | 기출 문항 메타데이터 수집 (단원·유형·정답·배점·난이도) |
| `exam_image_fetch.js` | 문항 이미지 내려받기 (`_debug/exam_images/`) |
| `exam_report_gen.js` | 출제경향 보고서 HTML 생성 (+ `--analysis` 로 분석 JSON 내보내기) |
| `exam_ppt_gen.js` | 그 분석 JSON으로 발표용 PPT 생성 |

## 만드는 순서 (예: 옥길중 중1 2학기 중간)

```bash
export P="NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt"

# 1) 문항 데이터 수집  (계정: MATHSECR_ID / MATHSECR_PASSWORD)
$P node sync/mathsecr_exam_collector.js --school 옥길중

# 2) 문항 이미지 내려받기 (PPT·전체판 보고서에 넣을 때만 필요)
$P node sync/exam_image_fetch.js --data sync/_debug/ms_exams_옥길중.json

# 3) 보고서 + 분석 JSON
node sync/exam_report_gen.js --data sync/_debug/ms_exams_옥길중.json \
  --school 옥길중 --grade 중1 --semester 2 --term 중간 \
  --out docs/exam_reports/okgil_m1_2_mid.html \
  --analysis sync/_debug/an_m1.json

# 4) 발표용 PPT
node sync/exam_ppt_gen.js --analysis sync/_debug/an_m1.json \
  --out "옥길중_중1_2학기_중간고사_출제경향.pptx"
```

- `--embed` 를 붙이면 문항 이미지를 넣은 **전체판 보고서**가 나온다(파일이 커서 커밋하지 않음).
  저장소에 올리는 것은 이미지 없는 **공개용**뿐이다.
- PPT 생성에는 `pptxgenjs` 가 필요하다: `npm install pptxgenjs`

### PPT 색상 테마

| 옵션 | 배색 |
|------|------|
| `--theme brand` (기본) | 루멘수학 로고 색 — 붉은색(표지·강조) + 네이비(제목) + 골드(보조) |
| `--theme navy` | 네이비·파랑 계열 |

붉은색은 **표지·섹션·마무리 슬라이드의 바탕**과 **강조 요소**(번호 배지, ★ 우리 학교 출제,
핵심 숫자)에만 쓰고, 문제를 읽는 본문 슬라이드는 흰 바탕 + 네이비 제목으로 둔다.
붉은 바탕을 20장 넘게 깔면 눈이 피로하고, 수학 자료에서 빨강은 이미 "오답 · 난이도 상"의
뜻으로 쓰이기 때문이다.

## 우리 학교 기출이 1회분뿐일 때 — 인근 학교 비교 모드

현행 교육과정 기준으로 우리 학교 기출이 한 회분밖에 없으면 "매년 반복되는 유형"을 뽑을 수 없다.
이때는 **같은 학군 인접 학교의 같은 시험**을 함께 넣고 `--anchor` 로 우리 학교 시험지를 기준(★)으로 지정한다.

```bash
# 시험지 id 를 직접 지정해 수집 (옥길중 2025 + 범박중 2025·2024 + 옥길새길중 2025)
$P node sync/mathsecr_exam_collector.js --ids 493934,547267,406211,387594
mv sync/_debug/ms_exams_ids.json sync/_debug/ms_exams_okgil_m2_2mid.json
$P node sync/exam_image_fetch.js --data sync/_debug/ms_exams_okgil_m2_2mid.json

node sync/exam_report_gen.js --data sync/_debug/ms_exams_okgil_m2_2mid.json \
  --school 옥길중 --grade 중2 --semester 2 --term 중간 --anchor 493934 \
  --scope "중2-2: 01 이등변삼각형과 직각삼각형 - 05 도형의 닮음, 09 피타고라스 정리" \
  --out docs/exam_reports/okgil_m2_2_mid.html --analysis sync/_debug/an_m2.json
```

- 이 모드에서는 "2개 이상 시험지에 나온 유형"이 반복 유형이 되고, **★ 우리 학교 출제** 배지가 붙는다.
- 인근 학교는 시험 범위가 조금씩 다를 수 있어 보고서·PPT에 그 안내 문구가 자동으로 들어간다.
- `--ids` 로 모은 데이터에는 시험 범위 정보가 없으므로 `--scope` 로 직접 적어 준다.

## 유형별 핵심 개념 (요점정리 ②)

`exam_report_gen.js` 안의 `CONCEPTS` 에 세부유형 이름별 설명을 적어 둔다.

- 문자열로 적으면 **"✎ 교재 확인 대기"**(검수 전 초안) 배지가 붙고,
- `{ src: '개념 따라쓰기 1-1 · 반비례', text: '...' }` 형태로 바꾸면 **"📖 교재 근거 확인"** 배지가 붙는다.

새 학년·단원을 분석할 때마다 여기에 유형을 추가하면 보고서와 PPT에 동시에 반영된다.
