# 📄 오답 쌍둥이 숙제 — 계약서 (2026-10-28)

원장 지시: 「월수금은 금요일 · 화목토는 토요일 오답 프린트 숙제를 자동으로 · 오답 쌍둥이(틀린 문제 쌍둥이) · 문제 제한 없음 ·
매쓰플랫에 숙제 태그로 각 학생에게 출제 · 처음은 10월부터, 시험범위 단원만 · 중3 제외 · 새벽 5시 · 많으면 나눠서 ·
다시 맞힌 문제는 뺌 · 리커버리 학습지와 겹쳐도 둘 다」. 만드는 이유: 매주 금·토 오답 프린트 숙제를 사람 손 없이 주기적으로.
시안 `docs/mockup_wrong_twin.html`.

## 부품
| 무엇 | 어디 |
|---|---|
| 서버 출제 | `sync/wrongtwin_make.js` (`--batch fri\|sat\|all\|auto` · `--dry` · `--only 코드,…` · `--wait-collect` · `--no-save`) |
| 예약 실행 | `.github/workflows/wrongtwin.yml` — 한국 금 05:00(월수금 반) · 토 05:00(화목토 반), 손 실행(batch·dry·only) |
| 앱 요청 처리 | `sync/collect_request_worker.js` 의 `wt_req` 블록 (mathflat-ondemand.yml, 원장 PC 토큰이면 즉시 깨움) |
| 학원앱 화면 | v19-169 `sync/appbuild/modules/wrongtwin169_teacher.js` — 진도·리포트 › 📄 오답 쌍둥이 |
| 검사 | `sync/appbuild/tests/test_v19169.js` (가짜 학생·가짜 서버) |

## 규칙 (서버 = 화면 같은 규칙)
- **대상**: 재원생 · `wt_config.excludeGrades`(기본 중3) 제외 · `wt_config.skip[코드] ≥ 오늘`이면 이번엔 건너뜀.
- **요일**: 반 수업 요일 `lumen_group_days` 에 금요일(5)이 있으면 **금요일 출제(fri)**, 그 밖의 수업 반은 **토요일 출제(sat)** (T3 화목도 토요일).
- **문제 고르기** (`mf_answer_records`, 학생 매쓰플랫 번호로 `wt_config.start` 이후 기록):
  - 문제마다(교재 = `w`+workbook_problem_id, 학습지·주간테스트 = `p`+problem_id) **마지막 결과가 ✗** 인 것만 — 다시 풀어 맞힌 문제는 뺀다.
  - 그 ✗ 뒤에 이미 쌍둥이를 냈으면 뺀다 (`wt_state.byCode[코드].given[문제키] = 낸 시각`). 낸 뒤 원래 문제를 또 틀리면 다시 낸다. → 첫 회는 10/1 이후 «아직 틀린» 문제 전부, 다음부터는 새로 틀린 것만.
  - **시험범위**: `wt_scope.byKey["학교|학년"].mids` (매쓰플랫 중단원 이름, `mf_concept_names[유형].m` 과 맞춤)가 있으면 그 단원만. 단원 이름을 모르는 유형은 넣는다(수 `unknown`). 범위가 없는 학교·학년(초등 등)은 전부.
- **쌍둥이**: 매쓰플랫 `/derivation/problem/{문제번호}` 의 쌍둥이(pair) → 없으면 유사(similar) → 없으면 같은 유형·비슷한 난도(`/worksheet/filter/concept`). 자동채점 문항만(`onlyAutoScorable`), 이 학생이 이미 푼 문제·이번에 고른 문제는 안 고름.
  - 교재 오답은 기록에 매쓰플랫 문제번호가 없다 → 교재 번호표 `mf_textbook_<교재>`(`sync/mf_textbook_bank.js`)로 찾고, 없으면 같은 유형.
- **한 번에 최대 `wt_config.maxPer`(60)문항** (원장 2026-10-28 — 첫 회 분량이 금요일 반만 1,350문항, 많은 학생 222): 최근에 틀린 것 먼저 고르고, 안 낸 것은 장부에 안 적으니 다음 출제에 다시 나온다(`wt_preview.rows[].carry`).
- **학습지**: 태그 `HOMEWORK` · 머리말 `숙제` · 제목 «오답쌍둥이 10/30 이름 (1/3)» · `wt_config.chunk`(60)문항씩 나눔 · 그 학생에게 바로 배정 · 모양은 리커버리 학습지와 같음(DESIGN).
  고등부 학습지 학년 칸은 과목 = `wt_scope` 의 `subject` → 없으면 `wt_config.hiSubject[고1/고2/고3]`.
- **정기 수집 기다림**(예약 실행만): `mf_weekly` 가 오늘 03시(한국) 뒤에 갱신될 때까지 5분마다 최대 90분.

## 서버 키 (lumen_store) — 학원앱은 기기에 두지 않는다(`PULL_SKIP_PREFIX` 에 `wt_`)
| 키 | 쓰는 쪽 | 모양 |
|---|---|---|
| `wt_config` | 학원앱 · 서버(처음 기본값) | `{ on, start:'2026-10-01', chunk:60, maxPer:60, excludeGrades:['중3'], hiSubject:{고1,고2,고3}, skip:{코드:'YYYY-MM-DD'} }` |
| `wt_scope` | 학원앱 · 서버(처음 초안) | `{ note, byKey:{ '옥길중\|중1':{ exam, date, subject?, src, mids:[중단원…] } } }` |
| `wt_state` | 서버 | `{ byCode:{ 코드:{ given:{문제키:낸시각}, runs:[{at,batch,n,ws:[학습지번호]}] } } }` (학생마다 출제 직후 저장) |
| `wt_preview` | 서버 | `{ at, batch, dry, rows:[{code,grp,grade,batch,scope,nWrong,fixed,outScope,unknown,already,bySrc:{ws,book,test},n,twin,same,none,sheets,ws?,err?}] }` (이름 없음) |
| `wt_log` | 서버 | `{ runs:[{at,batch,dry,only,students,problems,sheets,fail,codes:[{code,n,sheets,ws,err}]}] }` 최근 20 |
| `wt_req` | 학원앱 → 워커 | `{ status:'requested'\|'running'\|'done'\|'error', batch, dry, only:[코드], at, startedAt, doneAt, error }` |

## 시험범위 초안 (작년 2학기 기말 — 원장 확인 2026-10-28)
| 학교·학년 | 단원(매쓰플랫 중단원) |
|---|---|
| 옥길중 중1 | 다각형 · 원과 부채꼴 · 다면체와 회전체 · 입체도형의 겉넓이와 부피 · 자료의 정리와 해석 |
| 옥길중 중2 | 닮은 도형의 성질 · 피타고라스 정리 · 경우의 수와 확률 |
| 범박고 고1 | 명제 · 함수 · 유리함수와 무리함수 (공통수학2) |
| 소사고 고1 | 집합 · 명제 · 함수 · 유리함수와 무리함수 (공통수학2) |
| 범박고·소사고 고2 | 도함수의 활용 · 부정적분과 정적분 · 정적분의 활용 (미적분1) |
학교에서 실제 범위가 나오면 학원앱 «시험범위» 탭에서 고친다. 시험이 끝나면 다음 시험 범위로 바꾸거나 지운다(지우면 10/1 이후 전부).

## 아직 / 다음
- 교재 번호표(`mf_textbook_<교재>`)가 31권 중 6권만 있다 → 나머지는 같은 유형으로 대신. 번호표를 받아 두면 진짜 쌍둥이 비율이 오른다(`node sync/mf_textbook_bank.js --bids …`).
- 학생앱에는 따로 표시하지 않는다(매쓰플랫 숙제로 나감). 풀이율은 매쓰플랫 채점 기록으로 다음 회에 «다시 맞힘»으로 나타난다.
