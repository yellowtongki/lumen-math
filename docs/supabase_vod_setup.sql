-- ══════════════════════════════════════════════════════════════
--  루멘수학 · 강의실 시청 기록 테이블 만들기 (학생앱 v2-3용)
--  사용법: Supabase 접속 → 왼쪽 "SQL Editor" → 이 파일 전체를 복사해
--          붙여넣고 오른쪽 아래 "Run" 클릭. (여러 번 실행해도 안전)
--
--  학생앱이 영상 시청 기록을 여기에 저장하고,
--  학원앱의 강의실 → 모니터링 화면이 이 기록을 읽어 보여줍니다.
-- ══════════════════════════════════════════════════════════════

create table if not exists vod_watch_logs (
  id bigint generated always as identity primary key,
  video_id text not null,                   -- 강의실 영상 ID (학원앱 카탈로그의 id)
  student_code text not null,               -- 학생 6자리 루멘 코드
  student_name text,                        -- 학생 이름 (참고용)
  session_start timestamptz,                -- 시청 시작 시각
  watched_sec int default 0,                -- 실제 시청한 초
  max_position_sec int default 0,           -- 가장 멀리 본 지점(초)
  completed boolean default false,          -- 완료 여부
  playback_rate numeric default 1,          -- 최고 배속
  blur_count int default 0,                 -- 재생 중 화면 이탈 횟수
  quiz_result boolean,                      -- 확인질문 통과 여부 (없으면 null)
  questions jsonb default '[]',             -- 학생이 남긴 질문 [{at:초, memo:내용}]
  segments jsonb default '[]',              -- 시청 구간 [{start,end,rate}]
  created_at timestamptz default now()
);
create index if not exists idx_vod_logs_video   on vod_watch_logs (video_id, student_code);
create index if not exists idx_vod_logs_student on vod_watch_logs (student_code);

-- 학생앱(브라우저)이 기록을 쓰고, 학원앱이 읽을 수 있도록 권한 설정
alter table vod_watch_logs enable row level security;
drop policy if exists "read vod_watch_logs"   on vod_watch_logs;
drop policy if exists "insert vod_watch_logs" on vod_watch_logs;
drop policy if exists "update vod_watch_logs" on vod_watch_logs;
create policy "read vod_watch_logs"   on vod_watch_logs for select using (true);
create policy "insert vod_watch_logs" on vod_watch_logs for insert with check (true);
create policy "update vod_watch_logs" on vod_watch_logs for update using (true);

-- 완료! 이제 학생이 영상을 보면 학원앱 모니터링에 시청 현황이 표시됩니다.
