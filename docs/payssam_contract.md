# 💳 결제선생(payssam) 수납 자동 연동 (원장 지시 2026-09-16)

목표: 결제선생 매니저(manager.payssam.kr)의 청구·결제 내역을 매일 자동으로 가져와 학원앱 「운영 › 💳 수강료」에서 월 매출·학생별 납부·미납을 보고, 리그 설정에 「매출 대비 상금 비율」을 보인다.

## 0. 실측 (2026-09-16, GitHub Actions에서 5회 관찰 — sync/payssam_login_test.js)
- 로그인: `POST https://api.payssam.kr:10043/v2/users/login` (화면 입력칸 `member_id`/`member_pw`, 이메일+비밀번호, 추가 인증 없음) → `info.accessToken`(360자)·`memberIdx`·`sessionId`.
- 상점: `POST api.payssam.kr:10043/merchants/list` {memberIdx} → `[{merchantCode, companyName, auth_level}]` (1개, 루멘수학교습소).
- 화면들이 부르는 내부 주소(`manager-api.payssam.kr:10023`, 본문 JSON):
  - 결제내역 `POST /payment/detail/v2` 요청 `{state:"ALL", payType:null, currentPage:1, startDate:"20260901", endDate:"20260916", vatRate:null, keyword:"", merchantCode, rowNumber:N, businessType:null}` → `info:[{txID,state,approvalState,customerName,customerPhone,reason(품목),amount,approvalOriginDatetime,approvalDatetime(ms),approvalMonthly,approvalNumber,ledgerType,receiptState,approvalIssuerName,approvalAcquirerName,payType,ledgerAndPayTypeName,studentSeq,approvalSupplyAmount,approvalTaxAmount}], pageInfo:{totalCount,currentPage,totalPage}`
  - 결제 합계 `POST /payment/detail/v2/count` {merchantCode,keyword,startDate,endDate,vatRate} → `[{totalPrice,totalCount,approvalState}]`
  - 청구서 `POST /bill/detail/v2/unpaid/bills` 요청 `{state:"BILL_ALL", currentPage, startDate, endDate, vatRate:null, keyword:"", merchantCode, rowNumber, businessType:null}` → `info:[{billId,txID,state,ledgerType,billingDatetime(ms),billingReason(품목),amount,customerName,customerPhone,infoMessage,approvalState,resendCount,destroyDatetime,payType,approvalDatetime,approvalNumber,studentSeq}]`, pageInfo
  - 청구 요약 `POST /bill/detail/v2/count` {endDate,keyword,merchantCode,startDate,vatRate,businessType,searchPaidType:"SENT"} → `{totalSendCount,totalSendAmount,paidCount,paidAmount,paidPercentage,nonPaidCount,nonPaidAmount,cancelledCount,cancelledAmount,destroyedCount,destroyedAmount,…}`
  - 매출 보고서 `POST /merchant/sales/v2/report` {merchantCode,startDate,endDate,reportType:"PAYMENT_METHOD_TYPE"} → 결제수단별 과세·부가세·면세·승인·취소·합계 + 전체 합계(`totalApprovalAmountReport` 등)
  - 학생 화면(/students)은 표(이름·재원·출결번호·클래스·입학일)는 보이나 API 응답을 못 잡음 → 학생 매칭은 결제·청구의 `customerName`+`studentSeq`로 한다.
- 인증 헤더 형식은 아직 모름 → 수집기는 브라우저가 보내는 첫 `manager-api` 요청의 **헤더를 그대로 복사**해 `context.request.post`로 재사용한다(Authorization/토큰 헤더 이름을 로그로 남기되 값은 절대 안 남김).
- 이 작업 환경에서는 10043/10023 포트가 막혀 있어 **수집기는 GitHub Actions에서만 실행·시험**한다(비밀값 `PAYSSAM_ID`·`PAYSSAM_PASSWORD`·`SUPABASE_URL`·`SUPABASE_SERVICE_KEY` 등록됨). 저장소는 공개이므로 로그에 이름·전화·금액 개별 값을 남기지 않는다(건수·합계만).

## 1. 저장 (Supabase lumen_store, 개인정보는 여기만)
- `pay_bills` = `{ updated, from, to, items:[{ billId, txID, name, phone4(뒤 4자리), amount, billedAt(ISO), paidAt(ISO|null), state, approvalState, reason, payType, studentSeq, resendCount, destroyedAt }] }` — 최근 120일 청구서 전부(매일 덮어씀).
- `pay_payments` = `{ updated, from, to, items:[{ txID, name, phone4, amount, approvedAt, cancelledAt|null, state, approvalState, monthly(approvalMonthly), reason, payType, ledger:ledgerAndPayTypeName, studentSeq, supply, tax }] }` — 최근 120일 결제.
- `pay_monthly` = `{ updated, byMonth:{ "2026-09":{ billed:{count,amount}, paid:{count,amount,pct}, unpaid:{count,amount}, cancelled:{count,amount}, destroyed:{count,amount}, sales:{approval,cancel,total,count, byMethod:[{name,approval,cancel,total,count}]} } } }` — 최근 4개월(달마다 count·report 호출).
- `pay_students` = `{ updated, byName:{ "<이름>":{ studentSeq, phone4, lastBilledAt, lastPaidAt } } }` — 청구·결제에서 모은 학생 목록.
- 학원앱 명단 매칭: 이름 완전 일치 → 동명이인이면 학부모 전화 뒤 4자리(`parentPhone`)로 → 못 맞추면 「미매칭」 표시(원장이 학생 정보에 `payssamName` 칸으로 손 매칭 저장, `or_studentdb` 학생 항목에 `payssamName` 추가).

## 2. 수집기 `sync/payssam_collector.js`
- 옵션: `--days 120`(기본) · `--months 4` · `--dry`(저장 안 함, 건수·합계만 출력). 로그는 건수·합계·달만.
- 순서: Playwright 로그인(`sync/payssam_login_test.js`와 같은 방식) → `/bills` 열어 첫 manager-api 요청 헤더 캡처 → merchantCode → 결제 목록(rowNumber 100, 쪽 넘김) → 청구 목록(같은 방식) → 달마다 count·report → 저장(upsert, 매쓰플랫 수집기의 Supabase 저장 함수 방식 그대로: `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, `prefer: resolution=merge-duplicates`).
- 실패해도 매쓰플랫 수집을 막지 않도록 **별도 워크플로** `.github/workflows/payssam-collect.yml`: 매일 04:40 KST(UTC 19:40) + 수동. Playwright 설치는 `payssam-test.yml`과 같게.
- 파싱·집계 함수(`parsePayments`, `parseBills`, `buildMonthly`, `buildStudents`)는 순수 함수로 두고 `sync/test_payssam.js`가 가짜 JSON(위 모양)으로 검사한다(이 환경에서 실행 가능).

## 3. 학원앱 (v19-8) 「운영 › 💳 수강료」
- 상단: 달 선택(최근 4개월) · 요약 카드 4개(청구 합계 / 수납 합계·수납률 / 미납 건수·금액 / 매출 보고서 승인−취소=합계) · 「결제선생 열기」 링크(manager.payssam.kr) · 「마지막 수집 시각」.
- 표: 학원앱 명단 순(반·학년) — 이름 · 이달 청구액 · 수납액 · 상태(수납/미납/부분/청구 없음) · 결제일 · 품목 · 결제수단. 미납은 빨간 줄. 명단에 없는 결제선생 이름은 아래 「미매칭」 묶음(손 매칭: 드롭다운으로 명단 학생 고르면 `payssamName` 저장).
- 「📋 미납 목록 복사」(카톡용 글: 이름·금액·청구일). 재발송은 결제선생에서(링크).
- 리그 설정 머리(v19-7 「시즌 상금 합계」 옆)에 **「이번 달 수납 n원 · 월 환산 상금 n원 · 비율 n%」** — `pay_monthly` 이달 `paid.amount`(없으면 「수납 자료 없음」). 월 환산 상금 = 진도(total÷시즌 개월)+IB아하(total÷시즌 개월)+플래너 total.
- `APP_VER='v19-8'` + 버전 메모(원장님용).

## 4. 검증
- `node sync/test_payssam.js`: 가짜 결제 5건·청구 6건(수납 3·미납 2·취소 1)·count·report → 저장 모양 4개와 월 집계 수치, 이름 매칭(동명이인·미매칭).
- 학원앱 하네스: fixture `pay_bills/pay_payments/pay_monthly/pay_students` + 명단(동명이인 1쌍·미매칭 1명) → 요약 카드·표 상태·미납 복사 글·손 매칭 저장(`or_studentdb` 업데이트 본문)·리그 설정 비율 줄. 퇴원생 10/10.
- 실제 수집은 GitHub Actions `payssam-collect.yml`을 `--dry`로 먼저 돌려 건수를 본 뒤 저장 실행.
