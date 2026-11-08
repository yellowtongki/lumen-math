-- ═══════════════════════════════════════════════════════════════════
-- 서버 접근 규칙 정비 — 원장 열쇠 확인 방식 (2026-11-08, 학원앱 v19-182 와 함께)
-- ═══════════════════════════════════════════════════════════════════
-- 원장 열쇠는 이 파일·저장소 어디에도 적지 않는다. 서버에는 열쇠의 sha256 해시만 둔다.
-- 실행: Supabase → SQL Editor. 한산한 시간에(19~23시 피함).
--   ① 학원앱 설정 「🔑 서버 열쇠」 → ✨ 새 열쇠 만들기 → 다른 기기에 붙여넣기
--   ② 아래 A 를 붙여 넣고, 바로 밑에 학원앱 「📋 서버 등록 한 줄」을 붙여 넣어 함께 실행
--   ③ 두 기기에서 「🧪 열쇠 시험」 → ✅
-- 원장 열쇠를 쓰는 규칙(지우기 · quiz_* 쓰기 · naver_book* 읽기·쓰기)은 모두 public.lumen_is_teacher() 를 부르므로 이 함수만 바꾸면 된다.
-- ═══════════════════════════════════════════════════════════════════

-- A. 해시를 두는 비공개 칸 + 비교 방식
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.teacher_key (
  label text primary key,
  hash  text not null check (length(hash) = 64),
  created_at timestamptz not null default now()
);
revoke all on private.teacher_key from public, anon, authenticated;

create or replace function public.lumen_is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.teacher_key t
    where t.hash = encode(pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(nullif(pg_catalog.current_setting('request.headers', true), '')::json ->> 'x-lumen-teacher', ''),
      'UTF8')), 'hex')
  )
$$;

-- B. (학원앱이 복사해 주는 한 줄 — 저장소에 올리지 않는다)
-- insert into private.teacher_key(label, hash) values ('main', '<64글자>') on conflict (label) do update set hash = excluded.hash, created_at = now();

-- 확인 (값은 안 보이고 줄 수만)
-- select label, length(hash), created_at from private.teacher_key;

-- ═══════════════════════════════════════════════════════════════════
-- 되돌리기
--  1) 해시를 잘못 넣었을 때: 학원앱 「📋 서버 등록 한 줄」을 다시 실행
--  2) A 자체가 문제일 때: 옛 비교 방식으로 — '<옛 열쇠>' 는 SQL Editor 안에서만 붙여 넣는다(저장소에 적지 않음)
-- create or replace function public.lumen_is_teacher() returns boolean
-- language sql stable as $$
--   select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-lumen-teacher', '') = '<옛 열쇠>'
-- $$;
-- ═══════════════════════════════════════════════════════════════════
