-- ═══════════════════════════════════════════════════════════════════
-- 🔒 서버 잠금 1단계 — 「지우기」를 원장님만 할 수 있게 (2026-09-18)
-- ═══════════════════════════════════════════════════════════════════
--
-- 왜 필요한가
--   루멘 앱들은 «공개 주소»에 올라가 있고, 서버 열쇠(공개용 키)가 그 안에 들어 있습니다.
--   그래서 주소를 아는 사람이면 누구나 서버에 말을 걸 수 있습니다. 2026-09-18 실측 결과
--   읽기뿐 아니라 **고치기·지우기까지 열려 있었습니다** — 마음먹으면 학원 자료를 통째로
--   지울 수 있는 상태였습니다(아하노트 590건·기록 70,116건·저장소 697칸).
--
-- 이 파일이 하는 일 (1단계)
--   ① 일곱 표에 잠금을 켭니다.
--   ② 지금까지 하던 일(읽기·넣기·고치기)은 **그대로** 둡니다 — 앱이 멈추지 않습니다.
--   ③ **지우기만** 원장님 열쇠가 있을 때만 되게 합니다.
--      학원앱은 원장님 기기에 저장된 열쇠를 요청에 실어 보냅니다(학원앱 v19-18).
--      학생앱·학부모앱은 원래 지우지 않으므로 아무 영향이 없습니다.
--      수집기·워커는 관리자 열쇠(service_role)로 돌아 잠금을 그대로 통과합니다.
--
-- 2단계(나중에 따로)
--   읽기를 좁힙니다 — 학생은 자기 것만, 학부모는 자기 아이 것만. 로그인 방식을 함께
--   손봐야 해서 이 파일에는 넣지 않았습니다.
--
-- ── 실행 방법 ─────────────────────────────────────────────────────
--   Supabase → SQL Editor → 아래를 통째로 붙여 넣고 한 번 실행(Run).
--   실행 전에 **학원앱 v19-18을 원장님 기기에서 한 번 열어** 열쇠를 저장해 두십시오.
--   (Claude가 보내 드린 「열쇠 넣기」 주소를 PC와 아이패드에서 각각 한 번씩 누르면 됩니다)
-- ═══════════════════════════════════════════════════════════════════

-- 원장님 열쇠 (학원앱이 보내는 값과 같아야 합니다)
--   ⚠ 이 저장소는 «공개» 입니다. 진짜 열쇠를 이 파일에 적으면 누구나 읽어 갑니다.
--     실행할 때만 채팅으로 받은 진짜 열쇠로 바꿔 넣고, 파일에는 되돌려 두십시오.
--   열쇠를 바꾸려면 ① 이 값을 바꿔 다시 실행하고 ② 원장님 기기에서 «열쇠 넣기» 주소를 다시 한 번 여십시오.
create or replace function public.lumen_is_teacher() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-lumen-teacher',
    ''
  ) = '여기에-원장님-열쇠'   -- ⚠ 진짜 열쇠를 이 파일에 적지 마십시오 (저장소가 «공개» 입니다)
$$;

-- ── 표마다: 잠금 켜기 + 네 가지 규칙 ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'lumen_store','aha_notes','mf_answer_records','mf_students',
    'announcement_reads','vod_watch_logs','mf_study_sessions'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    -- 읽기 · 넣기 · 고치기 — 지금과 똑같이 열어 둔다 (1단계)
    execute format('drop policy if exists "lumen_read" on public.%I', t);
    execute format('create policy "lumen_read" on public.%I for select to anon, authenticated using (true)', t);

    execute format('drop policy if exists "lumen_insert" on public.%I', t);
    execute format('create policy "lumen_insert" on public.%I for insert to anon, authenticated with check (true)', t);

    execute format('drop policy if exists "lumen_update" on public.%I', t);
    execute format('create policy "lumen_update" on public.%I for update to anon, authenticated using (true) with check (true)', t);

    -- ★ 지우기는 원장님 열쇠가 맞을 때만
    execute format('drop policy if exists "lumen_delete_teacher" on public.%I', t);
    execute format('create policy "lumen_delete_teacher" on public.%I for delete to anon, authenticated using (public.lumen_is_teacher())', t);
  end loop;
end $$;

-- ── 확인 ────────────────────────────────────────────────────────
-- 아래를 함께 실행하면 표마다 규칙이 네 개씩 붙었는지 볼 수 있습니다.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- ═══════════════════════════════════════════════════════════════════
-- 되돌리기 (문제가 생기면 이 부분만 실행하십시오 — 잠금이 풀려 예전으로 돌아갑니다)
-- ═══════════════════════════════════════════════════════════════════
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'lumen_store','aha_notes','mf_answer_records','mf_students',
--     'announcement_reads','vod_watch_logs','mf_study_sessions'
--   ] loop
--     execute format('alter table public.%I disable row level security', t);
--   end loop;
-- end $$;
