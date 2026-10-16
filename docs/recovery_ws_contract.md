# 🧩 리커버리 학습지 «설계 → 매쓰플랫 즉시 생성» — 계약 (학원앱 v19-92, 2026-10-09)

원장 결정 2026-10-09:
- 교재 오답은 **쌍둥이**로. 최대 문항 제한 **없음**. 주간테스트(20문항)에서 틀린 문제마다 **쌍둥이 2문제** + **틀린 문제만큼 같은 유형을 교과서(없으면 문제집)에서** 추가. 교과서는 필수로 넣는 방향.
- **보강**(두 번 이상 틀린 유형에 1문항) 넣음.
- 새벽 시범 없이 바로 진행. 학원앱에서 출제하면 **5분 안에, 빠르면 즉시** 매쓰플랫에 만들어지기를 원함.

## 1. 즉시 생성이 되는 까닭
`api.mathflat.com` 은 어느 주소에서 오는 브라우저 요청이든 받는다(`access-control-allow-origin: *`, 필요한 헤더 모두 허용 — 2026-10-09 확인).
그래서 학원앱이 **원장님 PC 에서 직접** 로그인해 만든다. 5분 워커(`ws_make_req`, `sync/collect_request_worker.js`)는 건드리지 않고 쓰지 않는다.

- 계정: 리커버리 우측 패널 「🔐 매쓰플랫 계정」 → `localStorage` `or_mf_id` / `or_mf_pw` (**이 PC 에만**. 서버·저장소·커밋 금지).
- 토큰은 메모리에 45분 보관.

## 2. 재료 (전부 서버에 이미 있는 것 — 새 수집 없음)
| 재료 | 어디서 | 쓰는 칸 |
|---|---|---|
| 시험 오답 문항 | `mf_answer_records` (worksheet_id=시험지, mf_student_id, source 학습지, 가장 최근 응시) | problem_id(문제은행 번호)·concept_id·level·number |
| 시험 범위 | 같은 시험지 기록의 concept_id 묶음 | — |
| 교재 오답 | `mf_answer_records` (source 교재, result X, 범위 유형 안, 최근 N일) | book_id·page·number·workbook_problem_id·concept_id·level |
| 교재 오답의 문제은행 번호 | 교재 은행 `mf_textbook_<book_id>` (v19-41) `problems[].id`=workbook_problem_id → `pimg` 의 `/problem/<번호>/` | 없으면 같은 유형으로 대체 |
| 교과서 | `mf_textbooks.byStudent[학생].books` 중 `books[].type==='SCHOOL'` → `mf_textbook_<교재>` `problems[].cid` | 같은 유형·가까운 난이도 |
| 이미 푼 문제 | `mf_answer_records` (학습지, 범위 유형, problem_id) + 틀린 문제 자신 | 쌍둥이에서 제외 |

## 3. 매쓰플랫 호출 (2026-10-09 실검증 — 시험 학습지 1장 생성·확인·삭제)
```
POST /worksheet/filter/concept  {type:'CONCEPT', conceptIdList:[…], …}                  → {filterId}
POST /derivation/problem/{문제번호} {excludedProblemIds:[…], filterId, bookType:'WORKSHEET', tagTop:null}
     → { pairProblemList:[{problem:{id,level,conceptId,…},tagTop}], similarProblemList:[…] }   (pair=쌍둥이, similar=유사)
POST /worksheet/problem {filterId}                                                      → 유형 문제 목록 (보강·대체용)
POST /worksheet {filterId, problemList:[{id,tagTop:null}…], conceptIdList:[], assignStudentIdList:[학생], …서식}  → 학습지 번호
     지정한 문항이 그대로 들어간다 (GET /worksheet/{id}/problem 으로 확인)
DELETE /worksheet  본문 [학습지번호]  (삭제 — 앱에서는 쓰지 않는다)
```
서식: 녹색 「주간 리커버리」 41988 · 이론 없음(conceptIdList 비움, 「이론 박스」 체크 시 채움) · 이름 「리커버리 M/D 이름」 · 배정 포함.

## 4. 설계 규칙 (기본값 `RCWS_RULE_DEFAULT`, 저장 `rc_ws_rule`)
| 항목 | 기본 | 고르기 |
|---|---|---|
| 시험 오답 문항마다 쌍둥이 | 2 | 0~3 (쌍둥이 → 같은 난이도 유사 → 유사 순) |
| 시험 오답 문항마다 교과서 같은 유형 | 1 | 0~2 (교과서 없으면 같은 유형 문제) |
| 범위 안 교재 오답 문항마다 쌍둥이 | 1 | 0~2 |
| 보강 (시험·교재 합쳐 2번 이상 틀린 유형) | 1 | 켜기/끄기 |
| 교재 오답 기간 | 최근 28일 | 7~120일 |
| 이론 박스 | 끔 | |
「이 규칙을 「확정 전원」 기본으로」 체크 → `rc_ws_rule` 저장 → 「🧩 확정 전원 학습지 한번에 생성」이 같은 규칙으로 **학생마다 즉시** 만든다.

## 5. 기록
- `rc_ws_made` = `{ byKey: { <학생키>: { wk, wsId, title, n, parts:{twin,tb,book,boost,fallback}, at } } }` — 이번 주(wk) 것만 카드에 「✅ n문항 · 시험 쌍둥이 a · 교과서 b · 교재 c · 보강 d」.
- 운영 장부 `rc_state.calls[주][학생].ws` 에도 같은 요약(호출 확정된 학생만).

## 6. 범위 밖 · 다음
- 고등부: 매쓰플랫 학년 표기가 과목명이라 아직 제외(회색). 다음에 `grade:'공통수학1'` 꼴로 확인.
- 종이로만 채점한 교재 오답은 잡히지 않는다(매쓰플랫·학생앱 채점만).
- 학생앱 리커버리 카드에 「시험 쌍둥이 a · 교과서 b」 한 줄 — `rc_calls_pub.items[코드].ws` 로 보낼 자리만 남김(다음).
- 파일: 부품 `sync/appbuild/modules/rcws_teacher.js` · 검사 `sync/appbuild/tests/test_v1992.js` · 시안 `docs/mockup_recovery_worksheet.html`.

## 7. 2026-10-10 실전 — 서버에서 확정 전원 생성 (`sync/rcws_make.js`)
원장 지시 「리커버리 학습지 만들어서 매쓰플랫에 배정, 자동채점으로」. 학원앱 부품과 같은 규칙을 Node 로 돌리는 스크립트.
- `--dry` 설계만 · 기본은 생성·배정 + `rc_ws_made` + 운영 장부 `rc_state.calls[주][학생].ws` 기록.
- **자동채점 기준 = 서술형(ESSAY) 제외 + 정답 글자가 있는 문항** (단답은 학생앱 루멘 엔진이 채점). 매쓰플랫 자체 기준(객관식만)은 `--mf-auto` — 그러면 교과서 문항이 거의 못 들어간다.
- 유형 풀 100문항 + 유형이 비면 그 유형만의 필터를 따로 만든다(보강·대체용).
- 결과: 확정 12명 전원 생성·배정, 316문항 (16~69문항/명). 교재 오답 중 교재 은행(mf_textbook_)이 없는 책의 문항은 번호를 못 찾아 같은 유형으로 대체됐다.

## 8. 2026-10-16 새 규칙 — 학원앱 v19-123 (`modules/rcws123_teacher.js`) · 서버 `sync/rcws_make.js` 같은 규칙
원장 지시 「학원앱에도 넣어」 · 「이번주 지난주는 선택가능하게 한다」.
- **주간테스트 고르기**: 학생이 본 주간테스트(응시일 `me.date||t.date` 순)를 팝업에서 ☑ — 이번 주만·지난 주만·둘 다. 기본은 `rc_ws_rule.twoTestGrades`(기본 `['중학교 3학년']`) 학년 = 최근 2개, 나머지 = 보드가 고른 기준 미만 최근 시험(없으면 기간 안 최근 1개). 여러 시험은 오답(같은 `problem_id` 한 번만)·범위 유형·교재 오답·이미 푼 문제를 합친다.
- **학생별 선택** `rc_ws_rule.per[학생키] = { wk, wids:[시험지 번호], twin1, noBook, unit }` — 그 주(wk)에만 쓴다. 「확정 전원 생성」과 서버도 같은 값을 쓴다. 서버 덮어쓰기: `--tests <학생키>=<wid,wid>` · `--twin1` · `--no-book` · `--tests2 <학년>`.
- **오답 1배수** = 시험 오답 쌍둥이 1개 · **교재 오답 빼기** = 범위 안 교재 오답만 뺀다(단원 오답은 남김 — 따로 「단원 오답 넣기」).
- **단원 오답 (단원 정답률로 불린 학생)**: 보드 단원 이름(`mf_progress.byStudent[sid][bid].chapters[].n`)은 수집기 `refreshRoadmap` 이 «문항 기록 concept_id → 매쓰플랫 유형칩 bigChapterName» 으로 묶은 이름이다. 그래서 그 교재의 유형칩 `GET /concept/chips?curriculumKey=1&workbookIds=<교재>` 에서 bigChapterName 이 같은 유형을 고르고 → 그 유형의 최근 교재 오답(`unitDays`, 기본 28일)을 더한다. 기록의 `chapter`(「5 다면체와 회전체」「STEP 1 …」)는 교재 목차 글자라 쓰지 않는다. 칩을 못 받으면(계정 없음·실패) `mf_typedb` 대단원→중단원 + 유형 중단원 이름(`mf_type_ach.names` / 서버는 `mf_concept_names`) 또는 기록 chapter 글자(앞 번호 뗀 것)가 그 중단원인 유형으로 대신한다. 단원 출처: 보드 `unitHits`·이월 `carryHits`·호출 기록 `snap.units`(서버는 `snap.units` 만). 서버 `--unit <학생키>=<정규식>` 은 손으로 덮어쓰기로 남김, `--no-unit-auto` 로 끈다.
- **보드 점수 갱신**: 만들면 `rc_state.calls[주][학생].snap.score/scoreDate/testTitle` = 쓴 시험 중 가장 최근(응시일). 학원앱은 `ws` 기록과 함께 `rcSaveState` 한 번. 서버는 `--update-score` 때.
- 서버 `--force-design` (`--dry` 와 함께만): 이번 주 학습지가 이미 있어도 설계만 다시.
- 검사 `sync/appbuild/tests/test_v19123.js`.
