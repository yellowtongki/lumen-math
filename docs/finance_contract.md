# 📈 경영 현황판 (원장 지시 2026-09-16 「순서대로 코딩」)

시안: `docs/mockup_finance.html`. 순서 ① 손익 현황판 + 고정비·변동비 + 기간 설정(v19-9) → ② 점검·수납 흐름·학년별(v19-9 같이) → ③ 학생 경제·세금·시뮬레이션(v19-10).
바탕: v19-8 「운영 › 💳 수강료」(`PAY` 상태·`payLoad`·`payData`·`paySummary`·`rTuition`)를 그대로 쓰고 넓힌다.

## 0. 이미 있는 자료 (결제선생 수집기가 매일 04:40 저장 — 실측 모양)
- `pay_bills` = `{updated, from, to, items:[{billId,txID,name,phone4,amount,billedAt(ISO),paidAt(ISO|null),destroyedAt(ISO|null),state,approvalState,reason,payType,studentSeq,resendCount}]}` (116건)
- `pay_payments` = `{updated, items:[{txID,name,phone4,amount,approvedAt,cancelledAt,state,approvalState,monthly,reason,payType,ledger,studentSeq,supply,tax}]}` (100건)
- `pay_monthly` = `{updated, byMonth:{ "2026-08":{ billed:{count,amount}, paid:{count,amount,pct}, unpaid:{count,amount}, cancelled:{count,amount}, destroyed:{count,amount}, sales:{approval,cancel,total,count, byMethod:[{name,count,approval,cancel,total}]} } }}` (2026-05~09; byMethod 이름은 「신용・체크카드」「계좌이체」「현금」 등)
- `pay_students` = `{updated, byName:{ "<이름>":{studentSeq,phone4,lastBilledAt,lastPaidAt,alts?} }}` (30명)
- 명단 `or_studentdb`(전역 `students`): `name·grade·group·parentPhone·withdrawn·payssamName`

## 1. 새 저장 (lumen_store)
### `fin_cfg` — 고정비·변동비·목표 (원장이 입력)
```
{ updated,
  fixed:[ {id, name, amount, from:"2025-03"|"", to:"2026-10"|"", memo} ],       // 매달 같은 돈
  varByMonth:{ "2026-08":{ items:[{id,name,amount,memo}] } },                   // 달마다 직접 입력
  goal:{ monthly:13500000 },                                                    // 월 매출 목표(0이면 안 보임)
  ownerPay:0 }                                                                  // 원장 인건비(0이면 「인건비 전」 표시)
```
- 고정비 기본 항목(처음 열 때 한 번만 씨앗): 임대료 0 · 관리비·전기·수도 0 · 통신·인터넷 0 · 매쓰플랫 구독 0 · 보험·기타 0 (금액 0, 원장이 채움).
- `from`/`to`가 있으면 그 달 범위에서만 센다(빈 값 = 늘).
- 변동비는 달마다 따로. 「지난달 것 복사」 단추.

### `fin_rule` — 수강료 규칙 (예상 매출·금액 점검에 씀)
```
{ updated, base:{ "초":280000, "중":320000, "고":450000 }, siblingPct:10,
  byStudent:{ "<학생 id>":400000 }, siblingIds:["<id>",…] }
```
- 학생 1명의 규칙 금액 = `byStudent[id]` 있으면 그 값, 없으면 `base[학년대]`. 형제(`lumen_siblings`가 있거나 `siblingIds`에 있으면) −`siblingPct`%.
- 처음 열 때 초 280,000 · 중 320,000 · 고 450,000 · 형제 10%로 씨앗(원장이 고침).

## 2. 자동 변동비 (입력 없이 계산 — 표에 🔗 표시, 고칠 수 없음)
- **리그 상금(월 환산)**: v19-8 `payPrizeMonthly()` 그대로.
- **결제선생 쌤포인트**: 그 달 `billed.count` × 55원.

## 3. 기간 설정 (모든 화면 공통)
`PAY.range = { kind:'month'|'range', ym:'2026-09', from:'2026-06-01', to:'2026-08-31' }`
- 단추: 이달 · 지난달 · 최근 3개월 · 올해 · 📅 직접(날짜 두 칸).
- 달 하나면 지금처럼 `pay_monthly`를 쓰고, 여러 달이면 각 달을 더한다(`pay_monthly`에 없는 달은 목록에서 직접 집계).
- 화면 제목 옆에 고른 기간을 글로("2026-06-01 ~ 2026-08-31 · 3개월").

## 4. 📈 손익 현황판 (운영 › 수강료 안 첫 칸, 기존 표는 「학생별 납부」 칸으로)
왼쪽 세로 메뉴 대신 **가로 칩 줄**(앱 관행): `📈 손익` · `👨‍👩‍👧 학생별 납부` · `⚠ 점검` · `🧾 고정비·변동비` · `⚙ 수강료 규칙`. `PAY.tab`.
- 카드: 매출(`sales.total`) · 고정비 · 변동비 · **순이익**(매출−고정−변동, 크게) · **손익분기 학생 수**(올림((고정+변동) ÷ 1인 평균 수납액), 1인 평균 = 그 기간 수납액 ÷ 수납 학생 수) · 목표 달성률(goal 있을 때).
- 카드 밑 한 줄: 「원장님 인건비 전」(ownerPay 0일 때) 또는 「원장님 인건비 n원 뺀 뒤」.
- **월별 그래프**(SVG, 최근 6개월 또는 고른 기간): 매출·비용 막대 2개 + 순이익 선. 색은 검증된 값 — 매출 `#1d6fe8` · 비용 `#d97706` · 순이익 `#0f9d8a`(밝은·어두운 화면 모두 통과). 범례 필수, 막대 사이 2px 틈, 값은 막대 위에 직접(모든 점이 아니라 선의 마지막 점과 막대 값만), 축은 한 개(원), 세로 격자 점선.
- **다음 달 예상**: 명단 규칙 합계(예상 청구) × 최근 3개월 평균 수납률 − (고정+변동) = 예상 순이익. 한 줄 표.

## 5. ⚠ 점검 (새 칸)
그 달 기준으로 아래를 세어 알림 줄로. 각 줄에 해당 학생 이름(가리지 않음 — 원장 전용 화면).
1. **청구 누락**: 재원인데 그 달 청구서가 없는 학생.
2. **이중 청구**: 같은 학생·같은 달에 살아 있는 청구서 2건 이상(파기·재발송 짝은 뺀다 — v19-8 `payData`의 `resent` 규칙 재사용).
3. **금액 다름**: 청구액 ≠ 규칙 금액(±1,000원 넘게). 두 값을 함께.
4. **파기 재발송 필요**: v19-8에 이미 있음 — 여기로 모으고 「📋 카톡 문구 복사」.
5. **연체 습관**: 최근 3달 중 2달 이상 「청구 → 납부」가 6일 넘은 학생.
각 줄 오른쪽에 「결제선생 열기」.

## 6. 📅 수납 흐름 (손익 칸 아래)
- **납부 소요일**: 그 기간 청구서의 `billedAt→paidAt` 일수를 1일 안 / 2~5일 / 6일 넘게 / 미납·파기 네 칸 막대(가로). 평균 일수도.
- **납부일 달력**: 그 달 1~말일 칸, 그날 수납액에 따라 4단계 농도(연파랑→진파랑, 한 색 명도 변화 = 수량 표현). 칸에 마우스 올리면 날짜·금액.
- **결제수단**: `sales.byMethod`에서 금액 0인 수단은 빼고 가로 막대 + 비율. 한 색(`#1d6fe8`) 명도 단계.
- **학년별 매출 구성**: 그 기간 수납액을 초·중·고로 나눠 가로 막대 + 인원·1인 평균.

## 7. 🧾 고정비·변동비 · ⚙ 수강료 규칙 (입력 칸)
- 고정비 표: 항목·금액·시작·종료·메모 · 「+ 항목」 · 「✕」. 합계 줄.
- 변동비 표: 자동 2줄(🔗 리그 상금 · 쌤포인트, 회색·못 고침) + 직접 입력 줄. 「지난달 것 복사」.
- 목표·원장 인건비 입력.
- 수강료 규칙: 학년대 3칸 + 형제 할인 % + 학생별 예외 표(학생 고르기 → 금액). 아래 「명단 27명 규칙 합계 = n원」.
- 저장은 `lumen_store` upsert(기존 `bkhStoreSet` 같은 방식). 입력 중에는 다시 그리지 않는다(커서 튐 방지 — v19-7 `ibqCfgSet` 방식).

## 8. 그 밖
- `APP_VER='v19-9'` + 버전 메모(원장님용 한국어: 어디에 무엇이, 고정비 한 번 적으면 매달 자동, 기간 설정, 순이익·손익분기 뜻, 점검 5가지).
- 기존 「학생별 납부」·미매칭·미납 복사·리그 설정 비율 줄은 그대로 둔다.

## 9. 검증
- 문법 acorn · `node sync/check_withdrawn_leak.js lumen_v19-9.html` 10/10.
- 하네스 `verify_v199.js`(`verify_v198.js` 본떠): fixture에 `fin_cfg`·`fin_rule`·계약 §0 네 키·명단 6명(초1·중2·고2·퇴원1, 형제 1쌍) →
  (a) 순이익·손익분기·목표 달성률 수치, (b) 기간 3개월 고르면 합산되는지, (c) 그래프 막대·선 개수와 범례, (d) 점검 5가지 각각 한 건씩 잡히는지, (e) 수납 소요일·달력·결제수단·학년별 수치, (f) 고정비 추가·삭제·저장 본문(`fin_cfg`), 규칙 저장 본문(`fin_rule`), (g) 퇴원생 미노출, (h) 기존 v19-8 기능(학생별 납부·미납 복사·손 매칭) 회귀.
