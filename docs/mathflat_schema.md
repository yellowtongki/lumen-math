# 매쓰플랫 수집 데이터 · Supabase 스키마

수집기(`sync/mathflat_collector.js`)가 매쓰플랫에서 가져온 **문항 단위 정오답**을 저장하는 테이블 설계입니다.

## 1. `mf_answer_records` — 문항 단위 정오답 (핵심 테이블, 학습지+교재 통합)

학생 × (학습지 또는 교재) × 문항 1개 = 1행. `source`로 학습지/교재를 구분한다.

- **학습지**: `/student-worksheet/assign/{swId}/problem`
- **교재**: `/student-workbook/student/{sid}/{studentWorkbookId}/{studentBookId}/{progressId}`
  (진도별 응답을 `workbook_problem_id`로 dedup, 최신 채점 유지)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK, 자동) | 행 고유번호 |
| `record_key` | text UNIQUE | **중복방지 키**. 학습지 `ws:{swId}:{seq}` / 교재 `wb:{studentWorkbookId}:{workbookProblemId}` |
| `source` | text | **`학습지` / `교재`** |
| `student_worksheet_id` | bigint (nullable) | (학습지) 학생학습지 ID |
| `problem_seq` | int (nullable) | (학습지) 문항 순번 |
| `student_workbook_id` | bigint (nullable) | (교재) 학생-교재 인스턴스 ID |
| `student_book_id` | bigint (nullable) | (교재) 학생-교재 ID |
| `workbook_page_id` | bigint (nullable) | (교재) 페이지 ID |
| `workbook_problem_id` | bigint (nullable) | (교재) 교재-문제 ID |
| `number` | text (nullable) | (교재) 문항번호 (예: `필수 문제 2.(1)`) |
| `page` | text (nullable) | (교재) 페이지 범위 |
| `mf_student_id` | text | 매쓰플랫 학생 ID (예: `I2090532`) |
| `lumen_rec_code` | text (nullable) | 루멘 6자리 학생코드 — 매핑되면 채움 (아래 3 참고) |
| `academy_id` | text | 학원 ID (`D1358`) |
| `class_id` | bigint | 반 ID |
| `class_name` | text | 반 이름 |
| `worksheet_id` | bigint | 학습지 ID |
| `worksheet_title` | text | 학습지 이름 |
| `worksheet_type` | text | `EXAM` / `WORKBOOK` 등 |
| `chapter` | text | 단원 |
| `school` | text | `ELEMENTARY`/`MIDDLE`/`HIGH` |
| `grade` | text | 학년 |
| `problem_id` | bigint | 매쓰플랫 문제 고유 ID (문제 이미지·해설 매칭용) |
| `worksheet_problem_id` | bigint | 학습지-문제 매핑 ID |
| `concept_id` | bigint | 개념 ID (유형분석용) |
| `topic_id` | bigint | 토픽 ID |
| `sub_topic_id` | bigint | 세부 토픽 ID |
| `level` | int | 난이도(1~5) |
| `result` | text | **`O`(정답) / `X`(오답) / `-`(미채점)** |
| `score` | int | 그 학습지 총점 |
| `score_datetime` | timestamptz | **채점 시각** (복습 스케줄 계산의 기준) |
| `assign_datetime` | timestamptz | 출제(배정) 시각 |
| `collected_at` | timestamptz (기본 now()) | 수집 시각 |

**중복 방지 키(upsert 기준)**: `record_key` UNIQUE (학습지·교재 공통).
같은 문항을 다시 수집해도 갱신(merge)되어 중복 저장 안 됨.

```sql
create table if not exists mf_answer_records (
  id bigint generated always as identity primary key,
  record_key text unique not null,
  source text check (source in ('학습지','교재')),
  student_worksheet_id bigint,
  problem_seq int,
  student_workbook_id bigint,
  student_book_id bigint,
  workbook_page_id bigint,
  workbook_problem_id bigint,
  number text,
  page text,
  mf_student_id text not null,
  lumen_rec_code text,
  academy_id text,
  class_id bigint,
  class_name text,
  worksheet_id bigint,
  worksheet_title text,
  worksheet_type text,
  chapter text,
  school text,
  grade text,
  problem_id bigint,
  worksheet_problem_id bigint,
  concept_id bigint,
  topic_id bigint,
  sub_topic_id bigint,
  level int,
  result text check (result in ('O','X','-')),
  score int,
  score_datetime timestamptz,
  assign_datetime timestamptz,
  collected_at timestamptz default now(),
  unique (student_worksheet_id, problem_seq)
);
create index on mf_answer_records (mf_student_id, score_datetime);
create index on mf_answer_records (result) where result = 'X';
create index on mf_answer_records (concept_id);
```

## 1-B. `mf_study_sessions` — 학습지+교재 세션 단위(시간순)

학생이 푼 **학습지·교재**를 세션(구간) 단위로 시간순 수집. 교재 오답을 시간별로 담는 테이블.
(학습내역 API `/student-history/work/student/{id}` 기반)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | |
| `mf_student_id` | text | 매쓰플랫 학생 ID |
| `source` | text | **`학습지` / `교재`** |
| `book_type` | text | `WORKSHEET` / `WORKBOOK` |
| `book_id` | bigint | 교재/학습지 원본 ID |
| `title` | text | 교재·학습지 이름 (예: RPM, 일품) |
| `subtitle` | text | 부제 (예: 중등수학1(상)) |
| `chapter` | text | 단원 |
| `page` | text | 페이지 범위 (교재, 예: `66~165`) |
| `student_book_id` | bigint | 학생-교재/학습지 인스턴스 ID |
| `student_workbook_id` | bigint | 학생-교재 인스턴스 ID (교재) |
| `assigned_count` | int | 배정 문항 수 |
| `correct_count` | int | 정답 수 |
| `wrong_count` | int | **오답 수** |
| `update_datetime` | timestamptz | **학습/채점 시각** |
| `problem_count` | int | 문항 수 (교재 progressId 수) |
| `status` | text | 상태 |
| `collected_at` | timestamptz (기본 now()) | 수집 시각 |

**중복 방지 키**: `(mf_student_id, book_id, student_workbook_id, student_book_id, update_datetime)`.

```sql
create table if not exists mf_study_sessions (
  id bigint generated always as identity primary key,
  mf_student_id text not null,
  source text check (source in ('학습지','교재')),
  book_type text, book_id bigint,
  title text, subtitle text, chapter text, page text,
  student_book_id bigint, student_workbook_id bigint,
  assigned_count int, correct_count int, wrong_count int,
  update_datetime timestamptz, problem_count int, status text,
  collected_at timestamptz default now(),
  unique (mf_student_id, book_id, student_workbook_id, student_book_id, update_datetime)
);
create index on mf_study_sessions (mf_student_id, update_datetime);
create index on mf_study_sessions (source);
```

> **교재의 문항별 O/X 상세** ✅ 완료(2026-07-13): `/student-workbook/student/{sid}/{studentWorkbookId}/{studentBookId}/{progressId}`
> 로 문항별 O/X·시각·단원·문항번호·유형까지 수집해 `mf_answer_records`에 `source='교재'`로 저장.
> `mf_study_sessions`는 페이지·세션 단위 요약(타임라인용)으로 계속 병행.

## 2. `mf_review_schedule` — 에빙하우스 복습 스케줄 (다음 단계)

틀린 문항마다 다음 복습일을 관리. 복습에서 또 틀리면 주기 리셋.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | |
| `mf_student_id` | text | 학생 |
| `problem_id` | bigint | 문제 |
| `first_wrong_at` | timestamptz | 최초 오답 시각 |
| `stage` | int | 복습 단계 (0→1→2→3→4 = 1·3·7·14·30일) |
| `next_review_date` | date | 다음 복습 예정일 |
| `consecutive_correct` | int | 연속 정답 수 |
| `status` | text | `pending`/`done` |
| `updated_at` | timestamptz | |

주기 규칙: 오답 시 `stage=0`, 이후 정답마다 `stage++` 하며 `next_review_date`를
`first`+[1,3,7,14,30]일로 갱신. 복습에서 오답이면 `stage=0`으로 **리셋**.

## 3. 학생 매핑 (`mf_student_id` ↔ 루멘 `lumen_rec_code`)

매쓰플랫 학생ID(`I2090532`)와 루멘 학생코드(6자리)는 다른 체계라 **한 번 매핑 테이블을 만들어야** 함.
방법 후보:
- 이름+학교+학년으로 자동 매칭 후, 애매한 건 원장님이 화면에서 수동 확정
- 또는 학원앱 학생 등록부(`or_studentdb`)에 `mf_student_id` 필드를 추가해 연결

매핑 전에도 `mf_student_id` 기준으로 수집·저장은 가능하며, 앱 표시 단계에서 이름을 붙이면 됨.

## 참고: 수집 원천 API (매쓰플랫, 비공식)

| 데이터 | 엔드포인트 |
|------|------|
| 로그인 | `POST /v2/login` |
| 반 목록 | `GET /lesson-classes` |
| 반별 학습지+배정학생 | `GET /student-worksheet/lesson-class/{classId}` |
| 채점 요약(시각·점수) | `GET /student-worksheet/assign/{studentWorksheetId}` |
| 문항별 정오답+유형 | `GET /student-worksheet/assign/{studentWorksheetId}/problem` |

⚠️ 공개 API가 아니므로 매쓰플랫 업데이트 시 변경될 수 있음. 새벽 실행 권장(동시 로그인 시 접속 끊김).
