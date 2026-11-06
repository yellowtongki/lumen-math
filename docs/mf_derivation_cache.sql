-- 쌍둥이 문제 미리 받아 두기 (docs/mathflat_derivation_cache.md)
-- ⚠ 새벽에만 실행한다. 학생들이 앱을 쓰는 저녁 19~23시 금지 (CLAUDE.md 작업 규칙)
-- 2026-11-06 작성

create table if not exists mf_derivation_cache (
  problem_id  bigint      primary key,                    -- 매쓰플랫 문제은행 번호
  pair        jsonb       not null default '[]'::jsonb,   -- pairProblemList (진짜 쌍둥이)
  similar     jsonb       not null default '[]'::jsonb,   -- similarProblemList (유사)
  fetched_at  timestamptz not null default now(),
  tries       int         not null default 1,
  last_error  text
);

create index if not exists mf_deriv_fetched_at on mf_derivation_cache (fetched_at);

-- 줄 하나에는 {problem:{id,level,type,answer,autoScoredType}} 만 추려 담는다.
-- 통째로 담으면 표가 금방 커진다 (sync/rcws_make.js 의 slimP() 가 추린다).

-- 잠금(RLS): 서비스 열쇠로만 쓴다. 학생앱·학부모앱은 이 표를 보지 않는다.
alter table mf_derivation_cache enable row level security;
