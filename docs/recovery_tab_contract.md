# 🚑 리커버리 — 네이버 예약 시간 자동 연동 · 전용 왼쪽 기둥 · 📊 통계 — 계약서 (2026-10-23)

원장 결정(10/23): 「리커버리 A안 추천대로 진행」 = 시안 `docs/mockup_recovery_tab.html` 의 추천 전부 —
A 예약 있으면 자동 · 손으로 고른 것은 보호 / B 왼쪽 기둥 시안 그대로 / C 📊 통계는 가운데 새 화면 / D 더 발전시킬 것 1·2 지금(3·4 다음).
학원앱 **v19-153** 한 판. 코딩은 오퍼스. 바꾸는 파일: 새 부품 `sync/appbuild/modules/rcnaver153_teacher.js` + `build_app.py >=153` + `memos/memo_19153.txt` + `tests/test_v19153.js`.

## 0. 지금 있는 것 (바꾸지 않는다)
- 리커버리 상태 lumen_store `rc_state` = { calls:{ <주키 wk=그 주 토요일 YYYY-MM-DD>: { <학생키 k=id||name>: e } }, dates:{wk: 실제 리커버리 날짜}, periods }. `e` = { on, done, doneAt, noshow, slot:'10:00', manual, snap:{name,group,grade,score,scoreDate,testTitle,rx…}, ws, reason, why, at }. 저장 `rcSaveState()`(통째 upsert). 주키 `rcWeekKey()`, 날짜 `rcRecDate(wk)`.
- 기준 `rc_config` = RC.cfg { minScore, minUnit, elem6Score, weeks, slots:['10:00','11:00','13:00'], range }. 시간 칩은 오른쪽 «📞 확정 명단 · 시간 배분»(`rcSidePanel(conf, wk)`)에서 `RC.cfg.slots` 로만 그린다 · 누르면 `rcSetSlot(k, slot)`(같은 것 다시 누르면 해제) · `rcToggleNoshow` · `rcMarkDone`.
- 네이버 예약: lumen_store `naver_bookings` {bookings:[ { id, item:{id,name,kind:'recovery'|…}, status:{k:'cancelled'|…,label}, date:'YYYY-MM-DD', start:'HH:MM', end, match:{stKey,how} } ], items } · 앱 전역 `NBK`(`nbkKick('recovery')`로 읽음, `nbkAll()`, `nbkLive(b)`, `nbkMatch(b)`→{stKey,st,how}|null, `nbkRecOf(k, ymd)`→그 학생 그 날 리커버리 예약 1건, `nbkRcBadge`, `nbkRcSlot`(「시간 넣기」), `nbkRcSide`). 부품 `modules/naverbook124_teacher.js`(+125·126·127) — **고치지 말고 새 부품에서 감싼다**.
- 왼쪽 기둥(3분할, PC ≥900): `modules/layout3_bt_rc_teacher.js` 의 `l3rLeft()`(이번 주 호출 명단 → 미정 → 장부 `l3rLedgerBox()`), 왼쪽 클릭 `l3rPick(k)`(가운데 카드로 깜빡). 오른쪽 도구 `RIGHT_TOOLS.recovery`(학습지 규칙·만들기·계정). 가운데 `rRecovery()` 는 `RC.view` 'board' | 'ledger' (`rcSetView`). 장부 자료 `rcLedgerData()` → { weekRows:[{wk, called:[{k,nm,grp,done,noshow,snap,e}], doneN, period}], stuRows:[{k,nm,grp,calls,dones,noshows,last,weeks,streak,lastSnap}] }.
- 학부모 안내문 `rcOpenSms()`(v19-145~148, 학생별 복사 · 네이버 예약 있으면 «확인했습니다»). 홈 네이버 칸 `nbkHomeCard()`(naverbook124). 주간테스트 점수: 보드 행 `rcRows()`의 `testHit`(score, date) · 수집기 `mf_weekly`.
- 학생 학년 키: `gradeKey` 규칙(ultra_night_writer.js) — 등록부 grade '중학교 2학년' → '중2'.

## 1. A — 예약 시간 자동 연동 (부품이 `rcSidePanel`·`rcSetSlot`·`nbkRcBadge` 를 감싼다)
1. **자동 맞춤**: 보드를 그릴 때(NBK 읽힌 뒤) 그 주 확정 학생(`rcConfirmed()`, done 아님) 중 `nbkRecOf(k, recDt)` 가 있고 `b.start` 가 있으면 — `e.slotSrc!=='manual'` 이고 `e.slot!==b.start` 이면 `e.slot=b.start; e.slotSrc='naver'; e.slotAt=ISO` 로 바꾸고 **한 번에 모아** `rcSaveState()`(그리는 중에는 저장만, render 재귀 금지 — 바꾼 뒤 setTimeout(render,0) 한 번). 예약 시간이 바뀌면 같은 규칙으로 따라간다.
2. **손으로 고른 시간 보호**: `rcSetSlot` 을 감싸 `e.slotSrc='manual'` 을 적는다(해제하면 slotSrc 삭제 → 다음 그리기에서 예약 시간이 다시 자동으로 들어감). 예약과 다르면 배지 «✋ 직접 HH:MM · ⚠ 예약과 다름» + 「예약 시간으로」 단추(누르면 slot=예약, slotSrc='naver').
3. **칩 목록** = `RC.cfg.slots` ∪ {그 날 리커버리 예약(취소 제외)에 나온 시간들} ∪ {최근 8주 리커버리 예약에 나온 시간들(D-2, 「네이버 시간대」)} 를 시간순. 네이버에서 온 시간은 점선 테두리, 켜진 칩은 지금처럼 파랑. 기본 칩 세 개는 그대로 둔다(원장 설정).
4. **취소·변경**: 예약이 취소(`!nbkLive`)인데 `e.slotSrc==='naver'` 면 시간은 두고 배지 «⚠ 예약 취소됨 (HH:MM)». 예약이 없고 slot 도 없으면 «예약 아직»(지금 그대로).
5. 옛 「시간 넣기」 단추는 자동이 되므로 숨긴다(함수는 남김). 학생앱 알림(`rcPublishCalls`)·안내문(`rcOpenSms`)은 `e.slot` 을 읽으니 바꿀 것 없음 — 검사로 확인만.

## 2. B — 왼쪽 기둥 (시안 ② 그대로, `l3rLeft` 를 감싸서 통째로 다시 그린다)
위에서부터: ① `🚑 이번 주 · M/D (요일)` + 숫자 4칸(확정 · 네이버 예약 · 예약 아직 · 학습지 만듦 `rcwsMadeOf`) ② 시간대별 인원(칩마다 n명, 시간 미정 n명) ③ 명단(호출 n · 미정 n — 지금 목록 유지, 오른쪽에 `✓HH:MM`/`✋HH:MM ⚠`/`예약 아직` · 📄(학습지) · ✅/⛔) ④ `📨 예약 안 한 n명` 한 줄(이름 … · 「안내문 ›」= `rcOpenSms()`) ⑤ `📊 통계 · M월` 숫자 4칸(호출 · 출석 n(%) · 노쇼 · 다음 테스트 ↑ 평균) + 최근 6개월 호출 막대(작은 SVG) + 「🔁 3회 이상 · n명 상담 신호 ›」(통계 화면 그 표로) + 「📊 통계 자세히 ›」(`rcSetView('stats')`) + 「📜 장부」(지금 `l3rLedgerBox` 줄) ⑥ `⚙ 기준` 한 줄(주간 80점 · 단원 60% · 초6 75점 · 3주 → `rcEditCfg`) + 접힌 공용 메뉴 `l3CommonFold()`. 폰·태블릿(<900)은 왼쪽 기둥이 없으니 바뀌는 것 없음.

## 3. C — 📊 리커버리 통계 (가운데 `RC.view==='stats'`, `rRecovery` 를 감싸 탭 「📊 통계」 추가)
자료는 전부 있는 것으로 센다(새 수집 없음): `rcLedgerData()` + `rc_state` + `naver_bookings` + 주간테스트 점수(`mf_weekly`/`testHit`) + 학습지 채점(`rc_ws_made`·`mf_answer_records` 는 있으면, 없으면 «—»).
- 머리 숫자: 이번 달 호출 · 출석률 · 노쇼 · **리커버리 뒤 다음 주간테스트 변화**(호출 때 `e.snap.score` → 그 학생의 리커버리 날짜 이후 첫 주간테스트 점수, 평균 ±점 · «n명 중 m명 올랐어요») · 학습지 정답률(있으면).
- 표 ① 달별 6개월: 호출 · 출석 · 노쇼 · 출석률 · 학습지 · 다음 테스트 ±. 표 ② 학년 × 사유(`e.reason`/`e.why`/`e.manual` → 주간테스트 · 단원 · 둘 다 · 직접). 표 ③ 🔁 자주 오는 학생(3개월, 호출 3회↑ 먼저): 호출 · 출석 · 흐름(점수 → 다음 테스트 ↗→↘ · 노쇼 n) · 「상담 카드」(있는 상담 화면으로 가는 단추가 없으면 글만).
- 「요일×시간 열지도 · 학생별 월간 참여·학부모 카톡 글은 📊 예약 통계(v19-127)에」 안내 줄 + 단추.
- D-4(효과 숫자 복사)는 다음 판 — 넣지 않는다.

## 4. D-1 — 전날 저녁 «예약 안 한 학생» 챙기기
- 홈 `nbkHomeCard()` 를 감싸 **리커버리 전날(= `rcRecDate(rcWeekKey())` 의 하루 전)부터 당일까지** 확정 학생 중 예약 없는 n명을 «🚑 내일(오늘) 리커버리 · 예약 아직 n명 — 이름 …» 한 줄 + 「📨 안내문」(`VIEW='recovery'` 로 가서 `rcOpenSms()`) 로 보인다. 0명이면 안 보임. 홈이 아닌 곳엔 안 넣는다.

## 5. 저장·안전
- `e.slotSrc`('naver'|'manual')·`e.slotAt` 두 칸만 새로. `rc_state` 통째 저장이라 보드를 그릴 때 자동 맞춤이 생긴 경우에만 저장(변화 없으면 저장 안 함 — 검사로 «쓰기 0회» 확인).
- 네이버 예약 자료는 읽기만. 등록부 안 씀. 실명 금지(검사·메모는 홍길동·박하나…).
- 검사 `tests/test_v19153.js`(가짜 서버: or_studentdb 6명 · rc_config · rc_state(이번 주 확정 5명: 자동 대상 2 · 손으로 고른 1 · 취소 1 · 예약 없음 1) · naver_bookings · lumen_group_days · mf_weekly 흉내): A 1~5 · B 기둥 6칸 · C 통계 숫자(다음 테스트 ± 계산 포함) · D-1 홈 줄 · 저장 횟수 · 안내문이 자동 시간을 쓰는지. 이전 검사 `test_v19145~149` 가 v19-153 에서도 통과(버전 항목 제외).
