-- 아하 여정 1단계 — aha_notes 확장 (모두 nullable, 옛 노트 호환)
-- Supabase SQL Editor에서 1회 실행. 실행 전 백업 권장.
alter table public.aha_notes
  add column if not exists q_try        text,
  add column if not exists q_stuck      text,
  add column if not exists q_guess      text,
  add column if not exists q_ask        text,
  add column if not exists directive    text,      -- 설명|비교|논증|추론|적용|해석|평가
  add column if not exists q_type       text,      -- fact|concept|debate
  add column if not exists concepts     text[],    -- change, equivalence, generalization, validity, approximation, model, pattern, quantity, representation, simplification, space, system
  add column if not exists self_eval    jsonb,     -- {a,b,c,d, expected}
  add column if not exists self_solved  jsonb,     -- {how, photo_url, at, reflect:{learned,wonder}}
  add column if not exists hints_opened integer default 0,
  add column if not exists reflect      jsonb,     -- {learned, wonder, at}
  add column if not exists timer_used   boolean default false;

-- status 값에 'self_pending' 추가 (기존 제약이 있을 때만 필요)
-- 제약 이름은 환경마다 다르므로 먼저 확인:
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.aha_notes'::regclass;
-- 제약이 있으면 예:
--   alter table public.aha_notes drop constraint aha_notes_status_check;
--   alter table public.aha_notes add constraint aha_notes_status_check check (status in ('pending','resolved','self_pending'));

create index if not exists aha_notes_status_idx on public.aha_notes (status);
create index if not exists aha_notes_qtype_idx  on public.aha_notes (q_type);
