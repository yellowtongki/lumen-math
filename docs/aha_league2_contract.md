# 아하리그 2차 — 구현 계약서 (원장 결정 2026-09-11)

세 팀이 동시에 코딩한다 — **학원앱**(lumen_v18-164) · **학생앱**(student_v2-77) · **수집기/서버**(sync/). 서로 주고받는 데이터 모양을 여기서 못 박는다. 시안: `docs/artifact_aha_review.html`(재점검) · `docs/artifact_aha_workbench.html`(채점 작업대) · `docs/artifact_league_preview.html`(발행 전 안내·글씨 「가」) · `docs/aha_scoring_sheet.html`(채점표).

## 0. 원장 결정 요약 (2026-09-10~11)

| 항목 | 결정 |
|---|---|
| 🔎 탐구노트 | 같은 LAMP 활동지, P칸 뜻만 「막힐 곳 + 핵심 한 줄」. **진짜 맞힌(O) 난이도 상·최상만** 후보. 보너스 **상 +1 · 최상 +2**(해결 경로 보너스 없음). **하루 2건 중 탐구는 1건까지** |
| 해결 경로 보너스 | **스스로 +3**(학습지 기록으로 「틀렸던 문제」가 확인될 때) / 확인 안 되면 +2 · 힌트1 +2 · 힌트2 +1 · 힌트3 +1 · 손풀이 +1 |
| 리그 나누기 | **초·중·고 통합 한 리그로 시작**. 부별 분리는 연습리그 뒤 결정 (설정으로 전환 가능) |
| 성찰자 등급 | 시즌 1은 **AHA 10건만**(녹음 조건 끔) |
| 사고자 등급 | 「스스로 해결 **또는 탐구노트** 3건」 |
| 연습 주간 | 시즌 첫 **7일**은 채점만 하고 리그 점수 0 (연습리그) |
| 학습지 연결 | 학생앱 출처 = **매쓰플랫 학습지 최근순 아코디언** → 틀린 번호(❌)·어려운데 맞힌 번호(⭐) 칩 → 종류 자동 |
| 오늘의 후보 | 홈에 「어제 틀린 문제 → 질문노트 / 어제 맞힌 어려운 문제 → 탐구노트」 카드 |
| 답지·힌트 | 교재 = 해설지 PDF(기존). 학습지 = **질문된 문항만** 매쓰플랫 해설 이미지를 새벽에 복사해 AI 힌트 재료로. 학생에게 매쓰플랫 그림 직접 노출 없음 |
| 채점 작업대 | 날짜 머리줄 + 줄 안에서 확정. 기본 **최근 7일**, 「어제 / 7일 / 전체」. 머리 단추 정리(리그 중복 제거, ⋯ 더보기) |
| 발행 전 안내 | 실제 노트 하나(원장 지정, 이름 가림)로 채점 예시 + 예시 순위표 + 상 4개 |
| 글씨 크기 | 학생앱 머리 오른쪽 **「가」 단추**, 홈 아래 칸 제거 |
| 손풀이 타일 | 풀이가 **있을 때만 2칸**, 없으면 1칸 |
| 밀린 노트 | 최근 7일만 작업대에 (그 전은 「전체」에서만) |
| 순서 | ① 작업대 → ② 아코디언·후보 → ③ 탐구노트 → ④ 해설 자동·힌트 → ⑤ 발행 전 안내·「가」 |

## 1. `aha_notes` 새 열 (SQL은 원장이 실행 — `docs/aha_league2.sql`)

```sql
alter table aha_notes add column if not exists kind text default 'ask';   -- 'ask' 질문노트 | 'explore' 탐구노트
alter table aha_notes add column if not exists mf jsonb;                  -- 학습지 연결 (아래 모양)
```
`mf` = `{ wid, title, seq, pid, level, result:'O'|'X', conceptId, sol:null|url }`
- `level` 매쓰플랫 난이도 숫자(1하 2중 3상 4·5최상). `result` 채점 당시 정오.
- `sol` 은 **수집기가 채운다**(§4). 학생앱은 null 로 넣는다.
- **두 앱 모두 열이 없어도 죽지 않는다**: insert 실패 메시지에 `kind`/`mf` 가 있으면 그 두 필드를 빼고 다시 insert. 학원앱은 시작 시 `select kind,mf from aha_notes limit 1` 로 확인해 없으면 헤더에 「⚠ SQL 실행 필요 — docs/aha_league2.sql」 띠.

## 2. 학생별 최근 학습지 — `lumen_store` 키 `mf_ws_recent_<code>` (수집기가 씀, 학생앱·학원앱 읽기)

```
{ updated:ISO, items:[ WS, … ] }          // 최근 채점순 10개
WS = { wid, title, type, assignedAt:'YYYY-MM-DD', gradedAt:'YYYY-MM-DD',
       n, wrong:[seq…], hardOk:[{seq,level}…],           // hardOk = result O 이고 level>=3
       problems:{ [seq]: { pid, level, result, conceptId, wpId } } }
```
- 원천: `mf_answer_records` (worksheet_id·worksheet_title·worksheet_type·problem_seq·problem_id·level·result·concept_id·worksheet_problem_id·assign_datetime·score_datetime). `lumen_rec_code` 가 비어 있으므로 `mf_students`(mf_student_id→name) ↔ `or_studentdb`(name→code) 를 이름으로 잇는다 — `sync/race_engine.js loadStudents()` 와 같은 규칙(동명이인은 학년으로 구분, 안 되면 건너뛰고 로그).
- 새 스크립트 `sync/aha_ws_recent.js` — 매쓰플랫 로그인 **불필요**(Supabase만). `node sync/aha_ws_recent.js` 로 바로 실행 가능. 수집기 새벽 실행 끝에 이것도 호출(`mathflat_collector.js` 마지막에 `require('./aha_ws_recent').run()` 한 줄).

## 3. 「오늘의 후보」 (학생앱이 §2 로 계산, 별도 키 없음)
- 기준일 = items 중 가장 최근 gradedAt.
- ❓ 후보 = 그날 wrong 전부(최대 3개 표시) · 🔎 후보 = 그날 hardOk 중 level 높은 순 2개.
- 이미 그 (wid,seq) 로 노트가 있으면 후보에서 뺀다.

## 4. 해설 이미지 복사 (수집기 새벽, 매쓰플랫 로그인 필요)
- `aha_notes` 중 `mf.wid` 있고 `mf.sol` null 인 노트를 모아 wid 별로 `GET /worksheet/{wid}/problem?size=300`(또는 학생 학습지 endpoint) → 해당 seq 의 `solutionImageUrl` → 내려받아 Storage **`aha_photos/mfsol/<wid>/<seq>.jpg`** 로 올리고 `mf.sol` 을 그 공개 주소로 update.
- **질문된 문항만** 복사한다(전체 학습지 아님). 이미 있으면 재사용.
- 학원앱 `hntGenerate` 는 교재면 해설지 PDF 쪽(기존), 학습지면 `n.mf.sol` 이미지를 같은 자리에 넣는다. 없으면 「해설 아직 없음 — 새벽에 채워집니다」.

## 5. 리그 설정 `aha_league_cfg` 추가 필드 (학원앱)
```
divisions:'all'|'band'      // 기본 'all' (통합). 'band' 면 초·중·고 따로
practiceDays:7              // 시즌 시작 후 N일은 연습 — 채점은 하되 league=0, score.practice=true
pathPt:{ self:3, selfUnverified:2, h1:2, h2:1, h3:1, hand:1, none:0 }
explorePt:{ lv3:1, lv4:2 }  // 탐구노트 난이도 보너스 (level>=4 → lv4)
exploreDailyCap:1
tiers:{ know:{avg:6,cnt:5}, think:{avg:8,selfOrExplore:3}, reflect:{aha:10,rec:0} }
introNoteId:null            // 발행 전 안내에 쓸 예시 노트 id (원장이 채점 패널에서 「📌 예시로」)
```
- `IBQ_PATH_PT` 상수는 cfg.pathPt 로 대체. `ibqApplyBonus`:
  - kind==='explore': pathBonus 0, `levelBonus` = mf.level>=4?lv4 : mf.level===3?lv3 : 0 (mf 없으면 원장이 패널에서 난이도 고름, 기본 0). 후보 조건(mf.result==='O' && level>=3)이 아니면 패널에 「탐구 조건 미달」 경고, 저장은 가능.
  - kind==='ask' && path==='self': mf&&mf.result==='X' ? pathPt.self : pathPt.selfUnverified.
  - league = total + typeBonus + pathBonus + levelBonus + selfMatch + pick + best; total<minQ → 0; 연습 주간이면 0(practice:true).
- 상한: 하루 2건 중 explore ≤1(점수 높은 것부터 채우되 explore 는 하나만), 주 8건.
- 등급: think 조건 = 평균≥8 && (self 확정 + explore 확정) ≥3. reflect = aha≥10 (rec 조건 0이면 무시).
- `iblBoard()`: divisions==='all' 이면 한 표(키 `all`). `aha_league_board.divisions = { all:[ROW] }` 또는 `{ elem, mid, high }`. ROW 에 `explore`(탐구 확정 수)·`band`('elem'|'mid'|'high') 추가. 종합 챔피언은 부별로 뽑되 아하 순위는 통합 표에서의 순위를 그대로 씀.

## 6. 발행 전 안내 — `lumen_store` 키 `aha_league_intro` (학원앱 「📣 안내 발행」 → 학생앱)
```
{ season:{start,end,label}, opensAt:'YYYY-MM-DD', practiceUntil:'YYYY-MM-DD',
  divisions:'all'|'band', publicTop:5, prize:{total, awards:[{k,name,icon}]},
  sample:{ img, L,A,M,P,AHA, total, typeBonus, pathLabel, league, coach:{fb,ff}, q_ask, kind } | null,   // 이름·학생 정보 없음
  demoRows:[ {rank, name:'박○○', tier, league}, … 7개 ],   // 가짜 예시. 학생앱은 「예시입니다」 표시
  rules:'…', publishedAt:ISO }
```
학생앱 IB아하 탭: `aha_league_board` 없으면 `aha_league_intro` 로 ①열리는 날·지금 할 일 ②채점 방식(sample) ③등수 보는 법(demoRows·등급·상) 세 화면. 둘 다 없으면 지금 문구.

## 7. 학생앱 화면 (v2-77)
1. **출처 아코디언** — `mf_ws_recent_<code>`: 「📄 매쓰플랫 학습지 (최근 N)」 펼침 → WS 카드(제목·gradedAt·n·틀림 수·어려운 맞힘 수) → ❌ wrong 칩 · ⭐ hardOk 칩(level 표시). 칩 탭 → problem_no=seq, mf 채움, kind 자동(❌→ask, ⭐→explore). 「📚 내 교재」(기존 교재 목록) · 「📝 프린트물·기타」(기존 직접 입력). 학습지 카드에서 칩 없이 번호 직접 입력도 가능(kind 는 학생이 고름).
2. **종류 화면** ❓/🔎 두 카드. explore 선택 시 보라 안내(「P칸에는 막힐 곳 + 핵심 한 줄」, 난이도 보너스). explore 인데 mf 없거나 result!=='O'||level<3 이면 「선생님이 확인해요」 문구(제출은 허용).
3. **홈 「오늘의 노트 후보」** 카드(§3). 누르면 ①이 채워진 채 시작 화면.
4. **점수 화면**: kind 라벨, 난이도 보너스 줄, 경로 보너스 문구 갱신(+3/+2/+1), 연습 주간이면 「연습 — 리그 점수 0」.
5. **리그 화면**: divisions 'all' 이면 부 탭 숨기고 한 표. 연습 주간 배너. §6 안내 화면.
6. **글씨 「가」**: 헤더 오른쪽 단추 → 보통/크게/아주 크게 팝오버(기존 fzApply 재사용). 홈 fz-box 제거.
7. **손풀이 타일**: 세트 있으면 `grid-column:span 2` + 배지, 없으면 1칸.
8. 스스로 해결 문구 「+2」 → 「+3(학습지 기록으로 확인되면) · +2」.
9. insert 시 `kind`,`mf` 포함, 열 없으면 재시도(§1).

## 8. 학원앱 화면 (v18-164)
1. **📋 채점 작업대**(아하노트 기본 탭): 날짜 머리줄(건수·미채점·「이 날 8점 이상 확정」·접기) → 줄(사진 썸네일+칸 색 / 이름·학년·시각·출처(학습지면 제목·번호·난이도·정오) / AI 읽은 질문 / 칸별 평가 칩 / 코치 초안 / 점수 5칸 / ✓확정·✏️·💡). 범위 「어제 / 7일(기본) / 전체」. 「학습지별 보기」 토글 → wid 로 묶고 같은 seq 를 「5번 — 3명」으로 합침. kind 배지(❓/🔎), 탐구 조건 미달 경고, 연습 주간 표시.
2. **머리 정리**: 학생별·반별은 탭으로 유지. 단추 = 🤖 AI 초안 일괄 · ✓ 8점 이상 확정 · 🏆 리그(lgGo) · ⋯ 더보기(재풀이 자동해결·⚙ 설정·📺 수업 모드·🔁 재풀이·🙋 스스로). **「🏆 리그 순위표」(iblOpen) 단추 제거**(리그 화면 안에 있음).
3. **채점 패널**: kind 표시·전환, 탐구노트면 난이도 선택(상/최상, mf 있으면 자동), 「📌 발행 전 안내 예시로」 단추(cfg.introNoteId).
4. **설정**: divisions · practiceDays · pathPt · explorePt · exploreDailyCap · tiers(rec 0) 편집.
5. **📣 안내 발행**(리그 화면 발행 탭): §6 생성·upsert. sample 은 introNoteId 노트에서 이름 빼고 구성, demoRows 는 가짜 7줄.
6. **힌트**: hntGenerate 에 mf.sol 경로(§4).
7. **SQL 확인 띠**(§1). 8. `iblBoard`·발행 §5. 9. APP_VER v18-164, 버전 로그.

## 9. 공통 규칙
- 새 버전 파일만(`lumen_v18-164.html`, `student_v2-77.html`), 이전 파일 수정 금지. 문자열 결합만. 오버레이 한 번에 하나.
- 검증: acorn 문법 → 학원앱 `node sync/check_withdrawn_leak.js` 10/10 → Playwright 하네스(fixture 로 Supabase 대체, 콘솔 오류 0). 스크래치패드는 비워졌으니 하네스는 `sync/_debug/` 가 아니라 **`/tmp/claude-0/-home-user-lumen-math/8137f117-8053-52a0-bbe4-f0c2d44ca15d/scratchpad/`** 에 새로 쓴다. chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` `--no-sandbox`, supabase UMD 는 node_modules/@supabase/supabase-js/dist/umd/supabase.js.
- 매쓰플랫 로그인이 필요한 코드는 **실행하지 않는다**(동시 로그인 끊김) — 코드와 dry 테스트만. `sync/aha_ws_recent.js` 는 Supabase만 쓰므로 실행해도 된다.
- 커밋·배포·student_v1/parent.html/lumen_v1 교체는 하지 않는다(제가 한다). 비밀·실명 데이터 파일 커밋 금지. 코드 주석에 AI 모델 이름 금지. 버전 로그는 원장님용 한국어.
