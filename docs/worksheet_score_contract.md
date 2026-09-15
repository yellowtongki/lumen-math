# 📄 학습지 채점 — 학생앱으로 (원장 지시 2026-09-15)

배경: 원장이 매쓰플랫 「채점 전 정답 공개」를 껐다(학습지·교재 모두). 이제 매쓰플랫 학생앱에서는 주관식을 스스로 채점할 수 없다.
→ **학습지 주관식도 루멘 학생앱에서 채점**한다. 화면은 매쓰플랫 학생앱(학습 홈 / 교재 / 학습지 목록)을 본떠 만들되, 자료는 우리가 이미 받는 것을 쓴다.

## 0. 확인된 사실 (2026-09-15 실측)
- `student.mathflat.com`은 iframe 차단 머리글이 없어 끼워 넣기는 **기술적으로 가능**하지만, 학생이 매쓰플랫에 따로 로그인해야 하고 정답이 비공개라 **채점은 그대로 막힌다**. 그래서 끼워 넣지 않고 **화면을 본떠 만든다**.
- 학습지 문항 API `student-worksheet/assign/{배정id}/problem?size=300` 이 문항마다 `answer`·`answerImageUrl`·`problemImageUrl`·`solutionImageUrl`·`type`·`optionCount`·`answerUnits`·`answerCount`·`autoScoredType` 을 주고, 학생별 `result`·`userAnswer`·`score`·`essay`·`handwrittenNoteUrl` 도 온다. 교재보다 재료가 많다(문제 그림까지 있다).
- 되돌려쓰기: `student-worksheet/assign/{배정id}/scoring` (교재의 `student-workbook/scoring`과 같은 꼴). **실제 문항 1개로 쓰기→확인→원복 검증을 먼저 한다**(8/19 교재 때와 같은 방법).
- 시그니처 교재는 `workbookType=CUSTOM_SIGNATURE`(32권, 매쓰플랫 자동채점)인데 수집기가 PUBLIC·SCHOOL·CUSTOM만 받아 **학생앱 교재 목록에 빠져 있었다** → 수집기에 추가.

## 1. 저장 (lumen_store)
### `mf_wsq_<학생코드>` — 내 학습지 채점 목록 (수집기가 매일 갱신, 최근 30일 + 아직 안 끝난 것)
```js
{ code, updated,
  list:[ { swId, wid, title:"[공통수학2] 도형의 방정식-비상교육5", date:"2026-09-14",
           status:"학습가능"|"풀이 중"|"학습완료", auto:true|false,   // auto = 매쓰플랫이 스스로 채점(시그니처·객관식만)
           n:14, o:4, x:10, q:0, score:28,
           problems:[ { wpId, num:"5", type:"SHORT_ANSWER"|"MULTIPLE_CHOICE"|"ESSAY", optionCount:5,
                        answer, img, pimg, solimg,             // 정답 그림·문제 그림·해설 그림 (solimg는 학생앱에 안 보낸다: 채점 뒤 손풀이 대체용은 2단계)
                        cnt, units, shape, self, unit, parts,   // 교재 계약 §1과 같은 엔진 결과
                        result:"O"|"X"|"?"|"-", userAnswer:"" } ] } ] }
```
- 객관식(`MULTIPLE_CHOICE`)은 매쓰플랫이 채점하므로 `auto` 여부와 무관하게 **학생앱에서 보기 번호 단추**로 받고 우리가 채점해 되돌려쓴다(정답 비공개 상태에서도 되게).
- `ESSAY`·`self:true`는 교재와 같은 자기채점(사진 → 정답 그림 → ◯✗).

### `hw_scores_<코드>` / `hw_sync_<코드>` — 교재와 같은 저장. 키만 `"ws_<swId>_<wpId>"`, 대기열 항목에 `kind:'ws', swId` 추가.
### 워커: `kind:'ws'` 항목은 `PATCH student-worksheet/assign/{swId}/scoring` 로 보낸다(본문 모양은 검증 결과대로).

## 2. 수집기
- `refreshStudentWorkbooks`: `workbookType` 목록에 `CUSTOM_SIGNATURE`(+`SIGNATURE`) 추가. 고등 제외 규칙 유지.
- 새 함수 `refreshWorksheetQueue()`: 학생별 배정 학습지(최근 30일 + 미완료) → `mf_wsq_<코드>` 저장. `--wsq-only` 옵션. 새벽 루틴에 포함.

## 3. 학생앱 (v2-83) — 매쓰플랫 학생앱을 본뜬 화면
- 교재 채점 첫 화면에 **상단 탭 「📚 교재 | 📄 학습지」**. 교재 탭 안은 「일반교재 | 시그니처교재」 토글(매쓰플랫과 같이). 시그니처는 「자동채점」 표시.
- 학습지 탭 = 매쓰플랫 학습지 목록 모양: 기간(최근 30일) · 상태 칩(전체/학습가능/풀이 중/학습완료) · 줄마다 출제일·상태·학습지명·문항 수·결과(점수, ✗ n개 ◯ n개, 채점 전).
- 학습지 열기 → 문항 카드(교재 채점 카드 재사용). **문제 그림(`pimg`)을 카드 위에 보여 준다**(교재와 다른 점). 객관식은 ①~⑤ 단추. 주관식은 shape별 입력칸. 서술형·못 읽는 답은 자기채점.
- 학습 홈 요약(정답률·푼 문제 수·최근 4주)은 2단계.

## 4. 학원앱 (v19-2)
- 「자기채점 훑어보기」에 학습지 항목도 같이(키 `ws_` 접두 구분, 학습지명 표시).

## 5. 순서
1. 되돌려쓰기 API 실검증(1문항 쓰기→원복) → 2. 수집기(`CUSTOM_SIGNATURE` + `mf_wsq`) → 3. 학생앱 v2-83 → 4. 워커 `kind:'ws'` → 5. 학원앱 v19-2.
초등 확장(A·B 진행 중)이 끝난 뒤 같은 파일을 이어서 고친다(충돌 방지).
