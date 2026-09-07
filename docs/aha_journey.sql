-- ═══════════════════════════════════════════════════════════════
--  아하 여정 1단계 — aha_notes 확장
--  Supabase → SQL Editor 에 이 파일 전체를 붙여넣고 [Run] 한 번만 누르면 됩니다.
--  · 새 칸은 모두 「비어 있어도 되는」 칸이라 지금까지의 노트 558건은 그대로 남습니다.
--  · 여러 번 실행해도 안전합니다(이미 있으면 건너뜁니다).
--  확인일 2026-09-07: 현재 status 값은 pending 54건 · resolved 504건뿐 → 아래 제약을 걸어도 안전.
-- ═══════════════════════════════════════════════════════════════

-- ① 질문 4칸 · 지시어 · 개념 칩 · 자기평가 · 스스로 해결 · 되돌아보기 칸 추가
alter table public.aha_notes
  add column if not exists q_try        text,      -- ① 여기까지는 했어요(시도)
  add column if not exists q_stuck      text,      -- ② 여기서 막혔어요(지점)
  add column if not exists q_guess      text,      -- ③ 내 생각엔(가설)
  add column if not exists q_ask        text,      -- ④ 선생님께 원하는 것
  add column if not exists directive    text,      -- 설명|비교|논증|추론|적용|해석|평가
  add column if not exists q_type       text,      -- fact|concept|debate
  add column if not exists concepts     text[],    -- change, equivalence, generalization, validity,
                                                   -- approximation, model, pattern, quantity,
                                                   -- representation, simplification, space, system
  add column if not exists self_eval    jsonb,     -- {a,b,c,d, expected}
  add column if not exists self_solved  jsonb,     -- {how, photo_url, at, reflect:{learned,wonder}}
  add column if not exists hints_opened integer default 0,
  add column if not exists reflect      jsonb,     -- {learned, wonder, at}
  add column if not exists timer_used   boolean default false;

-- ② status 에 'self_pending'(스스로 해결 확인 대기) 허용
--    옛 제약이 있으면 지우고 새로 겁니다. 제약이 없으면 새로 만듭니다.
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.aha_notes'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.aha_notes drop constraint %I', c.conname);
  end loop;

  alter table public.aha_notes
    add constraint aha_notes_status_check
    check (status in ('pending','resolved','self_pending'));
end $$;

-- ③ 찾기 빠르게
create index if not exists aha_notes_status_idx on public.aha_notes (status);
create index if not exists aha_notes_qtype_idx  on public.aha_notes (q_type);

-- ④ 잘 됐는지 확인 (결과에 새 칸 이름들이 보이면 성공)
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'aha_notes'
   and column_name in ('q_try','q_stuck','q_guess','q_ask','directive','q_type',
                       'concepts','self_eval','self_solved','hints_opened','reflect','timer_used')
 order by column_name;
