-- ══════════════════════════════════════════════════════════════
--  루멘수학 · 매쓰플랫 수집 데이터 테이블 만들기
--  사용법: Supabase 접속 → 왼쪽 "SQL Editor" → 이 파일 전체를 복사해
--          붙여넣고 오른쪽 아래 "Run" 클릭. (여러 번 실행해도 안전)
-- ══════════════════════════════════════════════════════════════

-- 1) 문항 단위 정오답 (학습지 + 교재 통합) ─ 핵심 테이블
create table if not exists mf_answer_records (
  id bigint generated always as identity primary key,
  record_key text unique not null,          -- 중복방지 키 (ws:.. / wb:..)
  source text check (source in ('학습지','교재')),
  student_worksheet_id bigint,              -- (학습지) 학생학습지 ID
  problem_seq int,                          -- (학습지) 문항 순번
  student_workbook_id bigint,               -- (교재) 학생-교재 인스턴스
  student_book_id bigint,                   -- (교재) 학생-교재 ID
  book_id bigint,                           -- (교재) 교재 원본 ID
  workbook_page_id bigint,                  -- (교재) 페이지 ID
  workbook_problem_id bigint,               -- (교재) 교재-문제 ID
  number text,                              -- (교재) 문항번호
  page text,                                -- (교재) 페이지 범위
  mf_student_id text not null,              -- 매쓰플랫 학생 ID
  lumen_rec_code text,                      -- 루멘 6자리 코드 (매핑되면 채움)
  academy_id text,
  class_id bigint,
  class_name text,
  worksheet_id bigint,
  worksheet_title text,                     -- 교재/학습지 이름
  worksheet_type text,
  chapter text,                             -- 단원
  school text,
  grade text,
  problem_id bigint,
  worksheet_problem_id bigint,
  concept_id bigint,                        -- 개념(유형) ID
  topic_id bigint,
  sub_topic_id bigint,
  level int,                                -- 난이도
  result text check (result in ('O','X','-')),  -- 정오답
  score int,
  score_datetime timestamptz,               -- 채점 시각 (복습 계산 기준)
  assign_datetime timestamptz,
  collected_at timestamptz default now()
);
-- (이미 테이블을 만든 경우를 위한 보정: book_id 컬럼 추가)
alter table mf_answer_records add column if not exists book_id bigint;
create index if not exists idx_mf_ans_student on mf_answer_records (mf_student_id, score_datetime);
create index if not exists idx_mf_ans_wrong   on mf_answer_records (result) where result = 'X';
create index if not exists idx_mf_ans_concept on mf_answer_records (concept_id);
create index if not exists idx_mf_ans_lumen   on mf_answer_records (lumen_rec_code);

-- 2) 학습지+교재 세션 단위 (시간순 요약) ─ 타임라인용
create table if not exists mf_study_sessions (
  id bigint generated always as identity primary key,
  mf_student_id text not null,
  source text check (source in ('학습지','교재')),
  book_type text,
  book_id bigint,
  title text,
  subtitle text,
  chapter text,
  page text,
  student_book_id bigint,
  student_workbook_id bigint,
  assigned_count int,
  correct_count int,
  wrong_count int,
  update_datetime timestamptz,              -- 학습/채점 시각
  problem_count int,
  status text,
  collected_at timestamptz default now(),
  unique (mf_student_id, book_id, student_workbook_id, student_book_id, update_datetime)
);
create index if not exists idx_mf_sess_student on mf_study_sessions (mf_student_id, update_datetime);
create index if not exists idx_mf_sess_source  on mf_study_sessions (source);

-- 2-B) 학생 명단 (mf_student_id → 이름·학년) ─ 앱에서 실제 이름 표시용
create table if not exists mf_students (
  mf_student_id text primary key,
  name text,
  login_id text,
  grade text,
  school_type text,
  status text,
  lumen_rec_code text,                      -- 루멘 코드 매핑되면 채움
  collected_at timestamptz default now()
);

-- 3) 학원앱(브라우저)이 데이터를 "읽을" 수 있도록 권한 설정
--    (쓰기는 수집기가 service_role 키로 저장하며 아래 정책과 무관하게 동작)
alter table mf_answer_records  enable row level security;
alter table mf_study_sessions  enable row level security;
alter table mf_students        enable row level security;

drop policy if exists "read mf_answer_records" on mf_answer_records;
drop policy if exists "read mf_study_sessions" on mf_study_sessions;
drop policy if exists "read mf_students" on mf_students;
create policy "read mf_answer_records" on mf_answer_records for select using (true);
create policy "read mf_study_sessions" on mf_study_sessions for select using (true);
create policy "read mf_students" on mf_students for select using (true);

-- 완료! 이제 수집기가 SUPABASE_URL / SUPABASE_SERVICE_KEY 로 데이터를 저장합니다.
