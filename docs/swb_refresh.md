# 📗 교재 목록 새로고침 (v19-129 · 2026-10-17)

**왜 만들었나** — 매쓰플랫에서 중1 학생들에게 새 교재를 배정했는데 학생앱 숙제 화면에 안 보였다.
학생앱은 `lumen_store` 의 `mf_swb_<학생코드>` (학생별 교재·쪽 목록)를 읽는데, 이 값은 «전체 수집»(하루 3번 · 약 25분)이 돌 때만 다시 쓰였다.
이제 **교재 목록만** 1~2분에 새로 받는 빠른 길이 있다.

## 원장님이 하는 일
학원앱 → **울트라일일** → 빨간 「🔄 지금 가져오기」 바로 옆 **「📗 교재 목록 새로고침」** → 전체 / 학년 / 반 고르기 → 「📗 새로고침 요청하기」.
단추가 «⏳ 대기 중 → 📗 갱신 중… → ✅ 완료(몇 명 · 몇 분) / ⚠ 실패» 로 바뀐다(15초마다 확인).
GitHub 토큰(설정)이 있으면 요청 즉시 서버를 깨운다. 없으면 서버가 5분마다 확인하므로 **요청 뒤 최대 약 5분 + 갱신 1~2분**.

## 키 모양 — `lumen_store.mf_swb_req`
```
요청   { status:'requested', codes:['AAA111','BBB222'], reqAt:'…', by:'teacher' }   // codes 빈 배열 = 전체 학생
진행   { …, status:'running', startedAt:'…', note:'매쓰플랫 접속 중…' }
끝     { …, status:'done', ok:true|false, finishedAt:'…', note:'교재 목록 갱신 완료 (3명 · 약 1분)' }
```
- 워커 `sync/collect_request_worker.js` 의 `runSwbRequest()` 가 처리한다. **전체 수집 요청(`mf_collect_req`)보다 먼저**, 학습지 목록 갱신보다도 앞이다.
- `running` 인 채 20분이 지나면 죽은 것으로 보고 `done · ok:false` 로 정리한다. 수집기는 18분이 넘으면 강제 종료.
- 학생코드는 영문·숫자 3~16자만 받는다(수집기 인자로 넘기므로). 올바른 코드가 하나도 없으면 수집기를 안 돌리고 실패 처리.
- 앱은 30분 넘게 requested/running 인 요청을 «멈춘 것»으로 보고 다시 요청할 수 있게 푼다.

## 수집기 — `node sync/mathflat_collector.js --swb-only [--codes A,B]`
로그인 → `refreshStudentWorkbooks()` 만 실행하고 끝낸다. `--codes` 가 있으면 그 학생들만, 없으면 mf_students 전체.
- 일부 학생만 받을 때는 정답사전 대상(`mf_bookpages`)을 **기존 값에 합쳐서** 저장한다(다른 학생 교재가 빠지지 않게).
- 실패하면 종료 코드 1 → 워커가 `ok:false` 로 적는다. 다른 길(`--bookans-only` 등)의 교재 갱신은 예전처럼 «전체».
- 로그에는 학생코드 **개수**만 나온다(Actions 로그는 공개 — 이름·전화번호 없음).
- 필요: `SUPABASE_URL` `SUPABASE_SERVICE_KEY` `MATHFLAT_ID` `MATHFLAT_PASSWORD`. 하나라도 없으면 로그인 전에 멈춘다.

## 검사
- 서버 쪽: `env -u MATHFLAT_ID -u MATHFLAT_PASSWORD node sync/appbuild/tests/test_swb_refresh.js` (가짜 Supabase + 가짜 수집기, 진짜 매쓰플랫엔 안 붙음)
- 앱 쪽: `sync/appbuild/tests/test_v19129.js`
- **진짜 매쓰플랫으로 도는 것은 아직 확인 못 했다** — 배포 뒤 처음 눌러 보고 `mf_swb_<코드>` 의 `updated` 가 바뀌는지 본다.
