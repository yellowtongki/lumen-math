# 등록부(or_studentdb) 여러 기기 맞추기 — 학원앱 v19-87 (2026-10-07)

원장 「테블릿과 연동이 안된다」(숙제체크)에서 찾은 원인과 고침.

## 원인
- 등록부(학생·숙제체크·출결·플래너 점수 묶음)는 앱을 **켤 때 한 번** 서버 것을 받아 합치고(`applyCloudStudentDbMerge`), 그 뒤로는 이 기기 사본을 **통째로** 올렸다(`supaSetItem` upsert).
- 그래서 켜 둔 PC에는 태블릿 체크가 새로고침 전까지 안 보였고, 켜 둔 PC가 무엇이든 저장하면 태블릿 체크가 없는 옛 사본이 서버를 덮었다. 확인 당시 서버의 10월 숙제체크는 2칸뿐이었다.

## 고침 (`studb_sync` 모듈 · `SDS`)
1. **올리기 직전 합치기**: `scheduleSync`가 등록부를 올리기 전에 `sdsSync(false)`를 부른다. 서버 `updated_at`만 먼저 보고, 내가 마지막으로 본 시각(`SDS.cloudAt`, 내가 올린 시각 포함)과 같으면 내려받지 않는다.
2. **받아서 보이기**: 화면으로 돌아올 때(visibilitychange), 숙제체크 화면에 들어올 때, 숙제체크 화면에서는 90초마다 `sdsPullShow`. 숙제체크 칸이 바뀌면 「☁️ 다른 기기에서 고친 숙제체크 N칸을 받아왔어요」.
3. **칸마다 시각**: `hwcSave`가 `lumen_hw_at[날짜]`를 남긴다. 병합은 칸마다 더 최근 쪽이 이기고, 지운 칸도 시각이 더 최근이면 지운 채로 남는다. 시각 없는 옛 칸은 예전처럼 합집합.
4. **켤 때 한 번 올리기**: 받은 뒤 이 기기에만 있는 숙제체크가 있으면 올린다. 태블릿에 남아 있던 체크도 태블릿이 새 버전을 받으면 서버로 올라간다.
5. **받기에 실패한 기기**: 올릴 때 `sdsSync(true)`로 받아 합친 뒤 올린다. 한 번의 받기는 15초에서 끊어 다음 저장을 막지 않는다.
6. 합친 결과는 **달라진 칸만** 지금 쓰는 학생 객체에 넣는다(`sdsAdopt`). 진행 중인 작업(AI 분석 등)이 잡고 있는 객체를 바꾸지 않기 위해서다.

## 남은 한계
- 두 기기가 1초 안팎으로 동시에 올리면 늦게 올린 쪽이 이긴다(받기→올리기 사이).
- 숙제체크 말고 다른 칸(반·연락처 등 한 값짜리)은 예전 규칙(이 기기 우선) 그대로다.

## v19-90 (같은 날 저녁)
- 원장 「아이패드에서 체크한 숙제확인이 컴퓨터로 안들어온다」 — 아이패드 체크(10/7 M3 4명)는 19:10에 서버에 올라와 있었고 새로 연 PC에는 보였다. 켜 둔 PC가 아직 다시 받기 전이었다.
- 숙제체크 화면 위 「☁️ 다른 기기 체크 확인 HH:MM:SS · 30초마다 자동」 + **「☁️ 지금 받아오기」**(`sdsManual`). 자동 확인 90초 → 30초(서버 `updated_at`만 보는 가벼운 요청).
- 참고: 앱을 켤 때의 전체 받기(`supaFullPull`, lumen_store 전체)는 약 76MB다. 실패하면 등록부·교재만 받는 길로 넘어간다. 줄이는 일은 따로 할 것.

## v19-91 — 앱 시작 다운로드 76MB → 약 15MB
- `supaFullPull` 이 lumen_store 를 통째로 받던 것에서, 앱이 «서버에서 바로 읽는» 큰 키를 뺀다: `PULL_SKIP_PREFIX` (mf_bookans_ · mf_wsq_ · mf_textbook_ · mf_swb_ · mf_ws_recent_ · mf_wsans_ · ms_exam* · haesol_body_ · hw_synced_ · hw_scores_ · typeach_stu_ · stu_reports_ · pub_reports_ · submissions_ · or_students_archive_) + `PULL_SKIP_KEYS` (mf_type_ach · mf_sol_fix · mf_bookpages · ms_mydb_index · mf_ws_behaviors · mf_weekly · mf_progress · mf_books · mf_stuck).
- 확인: 이 키들을 로컬 사본(localStorage/_memStore)에서 읽는 코드가 없고(모두 `sb.from('lumen_store')` 로 직접 읽음), 올리기 목록(SYNC_KEYS)에도 없다. pub_reports_/stu_reports_ 는 발행 때 통째로 새로 쓴다.
- 실서버(쓰기 막음)로 앱을 켜 보니 전체 받기 14.9MB, 등록부 35명 · 리포트 1,709 · 교재 96 · 숙제체크 정상.
- 새 큰 키를 만들면 여기 목록에 넣을 것. 남은 큰 것은 리포트 달 서랍(or_students_YYYY-MM, 약 5MB) — 옛 달을 빼려면 리포트 올리기(rmPushMonthly) 안전을 먼저 확인할 것.
