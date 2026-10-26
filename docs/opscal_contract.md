# 📅 운영 달력 계약서 (학원앱 v19-158~)

원장 2026-10-25~26: 「학관노 업무 매뉴얼 + 2026 연간마케팅 플랜을 운영 달력에」 · 「월 달력 밑에 체크리스트」 · 「오른쪽 칸 없애고 v19-158 진행」.
시안: `docs/mockup_home_ops.html`(첫 화면·운영 달력) · 채팅 artifact (2026 운영·마케팅 달력, 학원 숫자가 있어 저장소에 없음).

## 화면 (부품 `sync/appbuild/modules/opscal158_teacher.js`, VIEW `opscal`)
- 🏠 홈 탭 › 📅 운영 달력. 학원 달력(VIEW `cal`) 머리에도 «📅 운영 달력» 단추.
- 보기: **1년 한눈에**(달마다 테마·키워드·시험·행사, 「운영 계획 없음」) · **월 달력 · 체크리스트**(달력 바로 아래 주별 체크리스트 + 오른쪽 매일 체크리스트, 날짜를 누르면 그날 줄이 파랗게) · **목표·지표**.
- 층: 학교(나이스 시험 `ctExams` + `schoolExtra`) · 학원 일정(학원 달력 `lumen_events`) · 운영(행사 D-업무) · 마케팅 · 돈(정기 수납·급여·세금) · 지표. 담당(원장·실장·강사·조교) 거르기.
- 일요일(휴무)에 걸린 할 일은 토요일로 당긴다(첫 월요일 규칙은 그대로).
- 「기한 지남」은 2026-10-01 이후 할 일만 센다(그 전은 계획이 없던 때).

## 서버 키 (lumen_store, 둘 다 시작 다운로드 `PULL_SKIP_KEYS` 에서 뺌 — 화면이 바로 읽는다)
### `ops_plan` (Claude 가 `sync/ops_plan_seed.js` 로 넣는다)
```
{ year, themes[12], keywords[12][],
  tax[[YYYY-MM-DD, 글]], schoolExtra[[YYYY-MM-DD, 글]],
  events[{ id, n, type, date, d:[[D, 담당, 할 일]] }],          // 학관노 STEP 2·3 «행사를 역할로 나누기»
  regular[{ rule:'day'|'last'|'firstMon', d?, L, who, t, sub, st[], man? }],
  mkt{ channels[], steps{채널:[단계]}, exam[['start'|'end', D, 채널, '{w} 글']], recruit[[D, 채널, 글]], special[[YYYY-MM-DD, 채널, 글]] },
  manuals[{ name, rank, cycle, timing, with, where, what, prep[], steps[], done, evid, report, ex[], status }],   // 학관노 매뉴얼 그대로
  ranks{ r1:'원장', … }, kpi{ year, goal, ask[12], reg[12], out[12], note }, traffic{ weeks[], rows{이름:[숫자]}, note }, upd }
```
- 마케팅 `recruit` 는 `type:'신규모집'` 행사에만 붙는다. `exam` 은 나이스 시험을 20일 넘게 떨어지면 끊어 묶은 «물결»마다(1학기 중간·기말, 2학기 중간·기말).
- 채널은 원장님이 쓰는 네 개만: 블로그 · 인스타 · 당근 · 카카오채널 (맘카페·문자 안 씀).
### `ops_checks`
`{ '<YYYY-MM-DD>|<할 일>':1, '<…>#<단계 번호>':1, 'day|<YYYY-MM-DD>|<매일 업무>#<단계>':1 }` — 체크할 때마다 서버 최신본을 받아 그 칸만 바꿔 올린다(해제도 남는다). 단계를 다 체크하면 할 일도 체크.

## 고치는 길
- 운영 내용(행사·매뉴얼)은 학관노 도구에서 고친다 → 백업 파일을 채팅에 → Claude 가 `ops_plan` 을 다시 만든다(지금 내용은 원장님 임시안).
- 지표(문의·등록·퇴원)는 지금 시트 숫자. 다음 단계: 학원앱 등록부·네이버 예약에서 자동으로 세기, 매주 월 «지표 입력»을 화면에서 받기.
- 다음 단계 후보: 첫 화면(홈) «오늘 할 일»·«앞으로 2주» 카드(시안 `docs/mockup_home_ops.html`), 학관노 STEP 7 같은 30일 점검.
