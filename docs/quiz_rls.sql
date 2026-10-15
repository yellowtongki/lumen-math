-- ═══════════════════════════════════════════════════════════════════
-- 🧠 루멘 수학퀴즈 키 잠금 (제안 · 아직 실행하지 않음) — 학원앱 v19-121 · 학생앱 v2-137
-- ═══════════════════════════════════════════════════════════════════
--
-- 지금 서버(lumen_store)는 docs/rls_lock.sql 1단계 상태입니다:
--   읽기·넣기·고치기는 누구나(앱의 공개 열쇠) · 지우기만 원장님 열쇠(x-lumen-teacher 머리글, 학원앱이 보냄).
--   학생앱이 쓰는 키(student_planner_<코드>, submissions_<코드>, natopt_<코드> …)도 같은 규칙이라
--   «학생은 자기 것만 쓴다»는 아직 서버가 막지 못합니다(학생 로그인이 없어서 — 1단계 문서의 «2단계»).
--
-- 루멘 수학퀴즈가 새로 쓰는 키
--   원장님만 쓰는 것 : quiz_index · quiz_<퀴즈 id> · quiz_words_<학년>      ← 학원앱(원장님 열쇠 머리글이 실림)
--   학생이 쓰는 것   : quizlog_<학생 코드> · wordlog_<학생 코드>            ← 학생앱(공개 열쇠)
--   v19-121 · v2-137 은 서버 규칙을 바꾸지 않아도 그대로 동작합니다(지금 다른 키와 같은 수준).
--
-- 이 파일이 하는 일 (원하시면 새벽에 한 번 실행)
--   ① 원장님만 쓰는 퀴즈 키(quiz_ 로 시작)는 «넣기·고치기»도 원장님 열쇠가 있을 때만 → 학생·외부인이 퀴즈 대본을 못 바꿈
--      (quizlog_ 는 'quiz' 다음 글자가 '_' 가 아니라 'l' 이라 이 규칙에 걸리지 않습니다)
--   ② quizlog_ · wordlog_ 는 지금처럼 둡니다 — «자기 것만»은 학생 로그인(2단계)이 있어야 막을 수 있습니다.
--   ※ 수집기·워커(service_role)는 잠금을 그대로 통과합니다. 원장님 열쇠 값은 이 파일에 적지 않습니다
--     (1단계에서 만든 public.lumen_is_teacher() 함수를 그대로 씁니다).
--   ※ 실행 전 확인: 원장님 PC·아이패드 학원앱에 열쇠가 저장돼 있어야 합니다(없으면 퀴즈 저장·발행이 «권한 없음»으로 실패).
--   ※ CLAUDE.md 규칙대로 서버 규칙 변경은 새벽에만 (학생들이 쓰는 저녁 19~23시 금지).
--
-- 실행 방법: Supabase → SQL Editor → 아래를 붙여 넣고 Run.
-- ═══════════════════════════════════════════════════════════════════

-- 「제한 규칙(restrictive)」 — 1단계의 열린 규칙(lumen_insert / lumen_update)과 «그리고»로 함께 걸립니다.
drop policy if exists "quiz_teacher_insert" on public.lumen_store;
create policy "quiz_teacher_insert" on public.lumen_store
  as restrictive for insert to anon, authenticated
  with check ( key not like 'quiz\_%' or public.lumen_is_teacher() );

drop policy if exists "quiz_teacher_update" on public.lumen_store;
create policy "quiz_teacher_update" on public.lumen_store
  as restrictive for update to anon, authenticated
  using ( key not like 'quiz\_%' or public.lumen_is_teacher() )
  with check ( key not like 'quiz\_%' or public.lumen_is_teacher() );

-- 확인: 규칙이 붙었는지
select policyname, permissive, cmd from pg_policies
where schemaname = 'public' and tablename = 'lumen_store' order by policyname;

-- ═══════════════════════════════════════════════════════════════════
-- 되돌리기 (문제가 생기면 이것만 실행)
-- ═══════════════════════════════════════════════════════════════════
-- drop policy if exists "quiz_teacher_insert" on public.lumen_store;
-- drop policy if exists "quiz_teacher_update" on public.lumen_store;
