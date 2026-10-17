-- ═══════════════════════════════════════════════════════════════════
-- 📅 네이버 예약 키 잠금 (제안 · 아직 실행하지 않음) — 학원앱 v19-124 · sync/naver_booking_collect.js
-- ═══════════════════════════════════════════════════════════════════
--
-- 지금 서버(lumen_store)는 docs/rls_lock.sql 1단계 상태입니다:
--   읽기·넣기·고치기는 누구나(학생앱·학부모앱에 들어 있는 공개 열쇠) · 지우기만 원장님 열쇠(x-lumen-teacher 머리글).
--   → 학생앱 주소를 아는 사람은 lumen_store 의 어떤 키든 «읽을» 수 있습니다.
--
-- 네이버 예약이 새로 쓰는 키
--   naver_bookings         예약 시간·상품·상태·연결된 학생 키 (예약자 이름·전화·메모 없음)
--   naver_bookings_pii     예약자 이름·전화·메모·추가 답 — 원장님 열쇠로 «잠근 상자»(AES-GCM)로만 저장
--   naver_bookings_status  수집 성공/실패 (개인정보 없음)
--   naver_booking_links    원장님이 앱에서 고른 «예약 ↔ 학생» 연결
--   v19-124 는 이 SQL 없이도 동작합니다. 학부모 이름·전화는 이미 잠근 상자에만 있어서 공개 열쇠로 읽어도 알아볼 수 없습니다.
--   이 SQL 은 «두 번째 자물쇠»입니다 — 잠근 상자·예약 시간표 자체를 원장님 열쇠가 없는 요청에는 아예 보여 주지 않습니다.
--
-- 이 파일이 하는 일 (원하시면 새벽에 한 번 실행)
--   naver_book 으로 시작하는 키는 읽기·넣기·고치기 모두 원장님 열쇠가 있을 때만.
--   (학원앱은 원장님 기기에 저장된 열쇠를 모든 요청에 실어 보냅니다 · 수집기는 service_role 이라 그대로 통과)
--   학생앱·학부모앱은 이 키를 읽지 않으므로 영향이 없습니다.
--
-- ※ 실행 전 확인: 원장님 PC·아이패드 학원앱에 «서버 잠금 열쇠»가 저장돼 있어야 합니다(학원앱 주소 뒤에 #dbkey=… 를 붙여 한 번 연 기기 · 없으면 네이버 예약 화면이 비어 보임).
-- ※ CLAUDE.md 규칙대로 서버 규칙 변경은 새벽에만 (학생들이 쓰는 저녁 19~23시 금지).
-- ※ 원장님 열쇠 값은 이 파일에 적지 않습니다(1단계의 public.lumen_is_teacher() 함수를 그대로 씁니다).
--   ⚠⚠ 2026-10-17 확인: 원장님 열쇠가 이미 두 곳에서 새고 있습니다.
--     ① lumen_store 에 'lumen_db_key' 줄이 있습니다 — 옛 학원앱이 열쇠를 서버 동기화로 올린 것으로 보입니다(공개 열쇠로 누구나 읽힘).
--        v19-124 부터는 올리지도(scheduleSync 막음) 받지도(시작 다운로드 제외) 않습니다.
--     ② docs/rls_lock.sql 에 1단계 때의 열쇠 값이 글자 그대로 있습니다(공개 저장소).
--     → 지금 열쇠로는 «지우기 잠금»도, 이 잠금도, 이름·전화 상자도 지켜지지 않습니다. 새벽에 이 순서로:
--        (가) lumen_store 의 'lumen_db_key' 줄 지우기   delete from public.lumen_store where key = 'lumen_db_key';
--        (나) 새 열쇠 만들기 → lumen_is_teacher() 의 값 바꾸기(이 파일·저장소에는 적지 않는다)
--        (다) 원장님 PC·아이패드에서 학원앱(v19-124 이상 — 옛 버전은 다시 올릴 수 있음) 주소#dbkey=새값 으로 한 번씩 열기
--        (라) GitHub 비밀값 LUMEN_TEACHER_KEY = 새값 (네이버 예약 이름·전화 상자 열쇠)
--        (마) 이 파일 실행
--
-- 실행 방법: Supabase → SQL Editor → 아래를 붙여 넣고 Run.
-- ═══════════════════════════════════════════════════════════════════

-- 「제한 규칙(restrictive)」 — 1단계의 열린 규칙(lumen_read / lumen_insert / lumen_update)과 «그리고»로 함께 걸립니다.
drop policy if exists "naver_teacher_select" on public.lumen_store;
create policy "naver_teacher_select" on public.lumen_store
  as restrictive for select to anon, authenticated
  using ( key not like 'naver\_book%' or public.lumen_is_teacher() );

drop policy if exists "naver_teacher_insert" on public.lumen_store;
create policy "naver_teacher_insert" on public.lumen_store
  as restrictive for insert to anon, authenticated
  with check ( key not like 'naver\_book%' or public.lumen_is_teacher() );

drop policy if exists "naver_teacher_update" on public.lumen_store;
create policy "naver_teacher_update" on public.lumen_store
  as restrictive for update to anon, authenticated
  using ( key not like 'naver\_book%' or public.lumen_is_teacher() )
  with check ( key not like 'naver\_book%' or public.lumen_is_teacher() );

-- 확인: 규칙이 붙었는지
select policyname, permissive, cmd from pg_policies
where schemaname = 'public' and tablename = 'lumen_store' order by policyname;

-- 확인 2 (공개 열쇠로): 학생앱 열쇠로 아래 주소를 열면 [] 가 나와야 합니다
--   <SUPABASE_URL>/rest/v1/lumen_store?select=key&key=like.naver_book*

-- ═══════════════════════════════════════════════════════════════════
-- 되돌리기 (문제가 생기면 이것만 실행)
-- ═══════════════════════════════════════════════════════════════════
-- drop policy if exists "naver_teacher_select" on public.lumen_store;
-- drop policy if exists "naver_teacher_insert" on public.lumen_store;
-- drop policy if exists "naver_teacher_update" on public.lumen_store;
