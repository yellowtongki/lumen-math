-- ═══════════════════════════════════════════════════════════════════
-- ⚡ 색인(index) 추가 — 큰 표를 통째로 훑지 않게 (2026-09-18)
-- ═══════════════════════════════════════════════════════════════════
--
-- 왜 필요한가
--   mf_answer_records(채점 기록)는 7만 건이 넘습니다. 학생앱 「🗂 지난 기록」·학원앱 여러 화면이
--   이 표를 «학생 코드» 또는 «매쓰플랫 학생 번호»로 골라 읽는데, 색인이 없으면 서버는
--   요청마다 7만 건을 처음부터 끝까지 훑습니다. 학생 여럿이 앱을 열면 디스크 예산이 금방 바닥납니다
--   (2026-09-18 저녁 서버 멈춤의 배경).
--
-- 이 파일이 하는 일
--   자주 쓰는 «찾는 조건»마다 색인을 하나씩 만듭니다. 이미 있으면 건너뜁니다(if not exists).
--   자료는 바뀌지 않습니다. 만드는 데 몇 초~몇십 초 걸립니다.
--
-- 실행 방법
--   Supabase → SQL Editor → 통째로 붙여 넣고 Run. 「Success. No rows returned」 가 나오면 끝.
-- ═══════════════════════════════════════════════════════════════════

-- 채점 기록 — 학생 코드로 최근 것부터 (학생앱 「지난 기록」)
create index if not exists mf_answer_records_reccode_time_idx
  on public.mf_answer_records (lumen_rec_code, score_datetime desc);

-- 채점 기록 — 매쓰플랫 학생 번호로 최근 것부터 (학원앱 학생별 화면·학생앱 취약유형)
create index if not exists mf_answer_records_student_time_idx
  on public.mf_answer_records (mf_student_id, score_datetime desc);

-- 채점 기록 — 시각 순 (학원앱 「최근 채점」·기간 조회)
create index if not exists mf_answer_records_time_idx
  on public.mf_answer_records (score_datetime desc);

-- 채점 기록 — 갈래(교재/학습지) + 시각 (학습지 채점 현황)
create index if not exists mf_answer_records_source_time_idx
  on public.mf_answer_records (source, score_datetime desc);

-- 아하노트 — 학생 코드별 (학생앱 아하노트 목록)
create index if not exists aha_notes_student_idx
  on public.aha_notes (student_code, created_at desc);

-- 아하노트 — 미해결만 빠르게 (학원앱 질문함)
create index if not exists aha_notes_status_idx
  on public.aha_notes (status, created_at desc);

-- 공부 세션 — 학생 번호별 최근 것부터
create index if not exists mf_study_sessions_student_idx
  on public.mf_study_sessions (mf_student_id, update_datetime desc);

-- 확인 — 표마다 어떤 색인이 붙었는지
select tablename as "표", indexname as "색인"
from pg_indexes
where schemaname = 'public'
  and tablename in ('mf_answer_records','aha_notes','mf_study_sessions')
order by tablename, indexname;
