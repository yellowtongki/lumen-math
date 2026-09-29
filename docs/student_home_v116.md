# 🏠 학생앱 홈 새 디자인 (v2-116 · K안) — 무엇이 어디로 갔나

원장 결정 2026-09-29 (시안 https://claude.ai/artifact/T5RaaxyPXZCVV7GEmWiQGH — K안). 학원앱 v19-63과 짝.

## 홈 (한 화면 · 스크롤 없음)

| 순서 | 칸 | 채우는 것 |
|---|---|---|
| 머리 | 이름 옆 캐릭터 동그라미(Lv 딱지 · 누르면 내 캐릭터) · 「가」 글씨 크기 · **🔔 알림**(숫자 배지) | `paintStrip` · `bellCount` |
| ① | **📢 공지 카드** — 학원앱에서 「🏠 홈에 보이기」로 고른 공지 하나(`home:true`), 없으면 최신 공지. 안 읽음 수 배지. 「전체 ›」 | `hmNoticePaint` (updateNoticeBadge 가 부른다) |
| ② | 📌 오늘 할 일 — 하브루타 · 플래너 (모양 그대로) | `updateTodayCard` |
| ③ | 🏆 루멘 리그 — 진도 · IB아하 · 플래너 · 스피치 4칸 + 👑 종합, 가까운 마감 D-day | `rcHomeUpdate` → `LGC` → `lgCellsPaint` · 버프 칩은 플래너 칸 안(`bfHomeChip`) |
| ④ | 큰 칸 4개 — 주간테스트 · IB아하노트 · 교재 채점(진도·정답률·모름) · 플래너 점수(매일+주간 · 순위). 남는 세로를 채운다 | `hallHomeBadge` · `hnPaint` · `bkHomeUpdate` · `plscPaint` |

## 🔔 알림 서랍 (홈에서 뺀 줄들)

힌트 도착(`hn-strip`) · 리커버리(`h3-rcv`) · 다음 주 계획 마감(`bell-wpl`, 일요일 24시 · 월요일 24시 지각) · 기출 다시풀기(`rtbn`) · 시험 D-day 30일 안(`bell-dday` — `calHomeStrip` 결과 복사) · 이번 할 일(`td-home`).
서랍 안이 바뀌면(MutationObserver) 배지를 다시 센다. 어디로 이동하든 `go()`가 서랍을 닫는다.

## 아래 탭 (홈 · 공부 · 계획 · 나 — `btabsPaint`)

- **📚 공부** `screen-study`: 강의실 · 로드맵 · 손풀이(`h3-hand`) · 기출 다시풀기(`h3-retry`) + 교재 채점 · 정답률·약한 유형 · 시험대비 트랙 · 내 교재 책장
- **📅 계획** `screen-plan`: 주간계획표 큰 카드(이번 주 할 일 수 · 다음 주 계획 마감) · 스터디 코디(`sc-home`) · 내 달력(`cal-strip`) + 오늘 플래너 · 플래너 점수·랭킹 · 순공 피드백 · 이번 할 일. 목요일부터 다음 주 계획을 안 냈으면 탭에 「!」
- **🧍 나** `screen-me`: 캐릭터 띠(`av-strip`) · 추가 버프(`bz-banner`) · 블랙반(`blk-home`) + 내 캐릭터·뱃지 · 내 리포트 · 알림 켜기 · 글씨 크기 · 로그아웃 · 버전
- 리그는 홈 카드 → 기존 🏆 루멘 리그 화면(종목 탭)으로.

## 학원앱 (v19-63)

공지사항 카드마다 **「🏠 홈에 보이기」** 단추. 한 개만 켜진다(다른 공지를 켜면 옮겨 간다). `lumen_announcements[i].home = true`. 노출 중이 아닌 공지는 학생앱이 걸러낸다.

## 만드는 법

`SP=… python3 $SP/build_student_116.py` (v2-115 → v2-116). 홈 HTML `home116.html` · CSS `home116.css` · 모듈 `home116.js`. 검사 `node $SP/test_s2116.js` (15) · `node $SP/test_v1963.js` (6).
