# 📔 플래너를 루멘 리그에 (원장 결정 2026-09-16 「플래너 시상은 1·2·3등, 총 30,000원, 학원앱에서 조정·노출 여부」)

시안: docs/mockup_league_planner.html. 학원앱 v19-7 · 학생앱 v2-87.

## 0. 있는 것
- 학원앱이 플래너 승인 때마다 `planner_ranking_<YYYY-MM>` = `{month, ranking:[{code?, name, score, days?…}], updatedAt}` 를 발행(publishPlannerDataForStudent, 약 32384줄). 학생앱 「📊 내 플래너 점수」(screen-planner-score)가 이것을 읽어 Top 5·내 순위를 그린다.
- 리그 설정 `aha_league_cfg` (`ibqCfgDefault/ibqCfg/ibqCfgFill`): prize·champion·speaking 칸. 종합 챔피언 `lgChampion(board)`·`lgPoints(rank)`(순위→점수표 `champion.points`).
- 학생앱 리그 `LG.tab` = race|aha|speak|total, `lgTabsHtml`, `lgTotalHtml`, `lgMyChamp`. 상금 카드 규칙(`prize.showTotal`·`open`·`awards[].w`)은 IB아하와 진도 레이스가 이미 같은 방식.

## 1. 저장
### 설정 (`aha_league_cfg.planner`, 학원앱 리그 설정에서 편집)
```
planner:{ enabled:true, total:30000, showTotal:true, open:true,
          awards:[{k:'p1',icon:'🥇',name:'1등',w:15000},{k:'p2',icon:'🥈',name:'2등',w:10000},{k:'p3',icon:'🥉',name:'3등',w:5000}],
          inChampion:true, minDays:5, publicTop:5 }
```
- 상은 **순위 순**(1등·2등·3등). 상 추가·삭제·이름·금액 편집. 합계≠total 이면 빨간 경고(저장은 됨).
- `showTotal:false` → 발행에 금액이 한 글자도 안 실림. `open:false` → total 만 실리고 상마다 금액은 안 실림(IB아하와 동일 규칙).

### 발행 (`league_planner`, 학원앱이 리그 발행·플래너 승인·월말 확정 때마다 씀)
```
{ month:'2026-09', end:'2026-09-30', enabled, prize:{ total?, showTotal, open, awards:[{k,icon,name,w?}] },
  minDays, publicTop, inChampion,
  last:{ month:'2026-08', winners:[{rank,k,icon,name,who(가린 이름),code,score,w?}] } | null,
  updatedAt }
```
### 수상 확정 (`planner_awards`) = `{ byMonth:{ '2026-08':{ winners:[{rank,k,code,name,score,w}], at, by:'teacher' } } }`

## 2. 학원앱 (v19-7)
- **리그 설정** 화면(`lgSeasonPane`/설정 창)에 「📔 플래너 상금」 칸: 총상금·보이기 두 스위치·리그 탭 켜기(enabled)·종합 챔피언 포함·상 목록 편집(순위 순, 추가/삭제)·최소 제출일·공개 순위 Top N. 저장은 `ibqSaveCfg`. 저장 뒤 `league_planner` 재발행.
- **리그 화면**에 「📔 플래너」 탭(`LG.tab='planner'`): 이번 달 순위표(`planner_ranking_<이달>` 그대로, minDays 미달은 회색 「후보 제외」), 상금 요약, **월말 수상자 확정**: 후보 = 이달 순위 1·2·3등(동점이면 나란히 표시하고 원장이 고름; 「나눠 주기」는 두 사람에게 같은 상을 주는 것으로 w 그대로 기록), 「✓ 확정」 → `planner_awards.byMonth[월]` 저장 + `league_planner.last` 갱신 + 토스트. 이미 확정된 달은 「확정됨 · 다시 확정」. 지난달 것도 고를 수 있게 달 선택(이달·지난달).
- **종합 챔피언 포함**(`inChampion`): `lgChampion`에 플래너 종목을 더한다 — 시즌 안에 **확정된 달**마다 `planner_awards` 순위(1~10위는 ranking 순서로)에 `lgPoints(rank)` 부여, 달마다 누적. 확정 안 된 달은 0. 리그 화면 종합 표에 「📔 플래너」 열 추가.
- 플래너 승인 함수가 `planner_ranking_*`를 발행하는 자리에서 `league_planner`도 같이 갱신(`lgPlannerPublish()` 한 함수로).
- 리그 설정 머리에 **「시즌 상금 합계」** 한 줄: 진도(race_season.prizes.total, open일 때)+IB아하(prize.total)+플래너(total×시즌 개월)+종합(문자열) 표시.
- `APP_VER='v19-7'` + 버전 메모(원장님용).

## 3. 학생앱 (v2-87)
- 리그 탭 줄에 **📔 플래너**(`enabled`일 때만; D-일수 = 이달 말일까지). 탭 안: 상금 카드(IB아하 `lgPrizeOpen/lgPrizeHide` 규칙 재사용 → 총상금+상 3개 카드 / 총상금만 / 상 이름만), 「📊 이번 달 나」(점수·제출일·연속🔥·순위 — `planner_ranking_<이달>`과 내 플래너 자료), Top N(가린 이름, `publicTop`), 「🏅 지난달 수상」(`last.winners`, 내가 받았으면 배지 「🏅 내가 받았어요」), 「📊 내 플래너 점수 자세히 ›」 → 기존 screen-planner-score(기능 켜고 끄기로 숨겨져 있어도 이 링크는 동작).
- 리그 맨 위 **💰 상금 한눈에** 카드(모든 탭 공통, 탭 줄 바로 아래): 진도(RC.board.prizeTotal·open 규칙)·IB아하(board.prize)·플래너(league_planner.prize)·종합(champion.prize 문자열). 금액이 오지 않은 종목은 「비공개」, 합계는 온 금액만.
- 👑 종합 탭 표에 「📔 플래너」 줄(학원앱 발행 champion 자료에 planner 점수가 오면 표시; 없으면 줄 숨김). 홈 배너 두 번째 줄에 「📔 플래너 n위」 추가(순위 있을 때).
- `STU_VER='v2-87'` + 버전 메모.

## 4. 검증
- 학원앱: 설정 저장(`aha_league_cfg.planner`) → `league_planner` 발행 본문(showTotal false면 금액 없음) → 월말 확정(동점 케이스) → `planner_awards`·`league_planner.last` → 종합 점수에 플래너 반영(확정된 달만). 퇴원생 10/10.
- 학생앱: fixture `league_planner`(open true/false 두 경우)·`planner_ranking_<이달>`·`race_season`·아하 board → 탭 표시·상금 한눈에 합계·플래너 탭 내용·지난달 수상 배지·자세히 링크 동작·enabled:false면 탭 없음.
