-- ═══════════════ IB아하노트 리그 2차 — aha_notes 열 추가 (2026-09-11) ═══════════════
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run.
-- 두 번 실행해도 안전합니다 (if not exists).
--
-- kind : 'ask' 질문노트(틀린 문제) | 'explore' 탐구노트(맞힌 어려운 문제) — 기본 'ask'
-- mf   : 매쓰플랫 학습지 연결 { wid, title, seq, pid, level, result:'O'|'X', conceptId, sol }
--        학생앱이 학습지를 고르면 채워지고, sol(해설 이미지 주소)은 새벽 수집기가 채웁니다.

alter table aha_notes add column if not exists kind text default 'ask';
alter table aha_notes add column if not exists mf   jsonb;

-- 확인
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'aha_notes' and column_name in ('kind','mf');
