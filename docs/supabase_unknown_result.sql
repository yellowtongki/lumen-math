-- ─────────────────────────────────────────────────────────────
-- 매쓰플랫 「모름」 체크를 저장할 수 있게 제약을 넓힙니다
--
-- 배경
--   매쓰플랫 문항 채점 결과 원본값은 4가지입니다.
--     CORRECT  정답        → 'O'
--     WRONG    오답        → 'X'
--     UNKNOWN  모름(학생이 직접 누름)  ← 지금까지 '-'로 뭉개져 버려지고 있었음
--     NONE     미채점      → '-'
--
--   「모름」은 학생이 스스로 "이건 모르겠다"고 표시한 것이라,
--   아하노트(오답 정리로도 해결 안 되는 문제를 질문하는 것)의 대상 그 자체입니다.
--   오답(X)·미채점(-)과 반드시 구분해서 '?'로 저장합니다.
--
-- 실행 방법
--   Supabase 대시보드 → SQL Editor → 아래 내용 붙여넣고 Run (한 번만)
--   실행 전까지는 수집기가 자동으로 '-'로 낮춰 저장하므로 수집이 멈추지는 않습니다.
-- ─────────────────────────────────────────────────────────────

alter table mf_answer_records
  drop constraint if exists mf_answer_records_result_check;

alter table mf_answer_records
  add constraint mf_answer_records_result_check
  check (result in ('O', 'X', '-', '?'));

-- 「모름」만 빠르게 찾기 위한 인덱스
create index if not exists mf_answer_records_unknown_idx
  on mf_answer_records (mf_student_id, score_datetime)
  where result = '?';

-- 확인용 — 실행 후 아래를 돌리면 지금까지 '-'로 저장된 건수가 나옵니다.
-- (이 중 일부가 「모름」입니다. 정확히 가르려면 수집기를 --days 60 으로 한 번 다시 돌리면 됩니다)
-- select result, count(*) from mf_answer_records group by result order by 2 desc;
