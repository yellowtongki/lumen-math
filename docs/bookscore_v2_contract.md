# 📖 교재 채점 2판 — 구현 계약 (원장 승인 2026-09-14 「시작해라」)

목표: **중1 교재부터 학생이 앱에서 전 문항을 스스로 채점**한다. 원장 손이 가는 채점은 없다.
- 엔진이 읽는 답은 자동채점(오채점 0 원칙: 정답 원문을 그대로 넣으면 반드시 correct).
- 엔진이 못 읽는 답과 글자 정답이 없는 서술형은 **자기채점**(내 풀이 사진 → 정답 그림 → ◯/✗).
- 첫 교재: 개념+유형 유형편 기초탄탄 라이트 중1-2 (`bid 2124102`, 11명). 실측 41% → 목표 93% 자동 + 7% 자기채점.
- 수집 범위: **매쓰플랫에서 학생에게 배정된 교재만**(`mf_swb_*` 에 있는 것). 우선순위 중1 → 중2 → 중3. **고등 교재는 하지 않는다.**
- 시안: `docs/mockup_bookscore_v2.html` · 분석 근거: 이 문서 §6.

담당 파일 (서로 남의 파일을 건드리지 않는다)
| 담당 | 파일 |
|---|---|
| A 수집기·엔진 | `sync/hw_grade_engine.js`, `sync/mathflat_collector.js`, `sync/test_hw_grade.js`(새) |
| B 학생앱 | `student_v2-81.html` (v2-80 복사본) |
| C 학원앱 | `lumen_v18-176.html` (v18-175 복사본) |

커밋·push·배포는 아무도 하지 않는다(지시자가 한다). 중첩 템플릿 리터럴 금지, 문자열 결합만.

---

## 1. 정답사전 확장 — `mf_bookans_<bid>` (A가 만들고 B·C가 읽는다)

`pages[wpid].problems[]` 항목에 아래를 **추가**한다 (기존 `wpId,num,type,answer,objective,optionCount,gradable,unit` 유지).
```js
{ wpId, num, type, answer, objective, optionCount, gradable, unit,
  img: "https://…/essay-answer/…png" | "",   // 매쓰플랫 answerImageUrl (정답 그림). 로그인 없이 열린다
  cnt: 5,                                     // answerCount (답 칸 수)
  units: [ { u:"[공약수: ]", i:0 }, … ],       // answerUnits → {u:unit, i:index}. 없으면 []
  shape: "num"|"unit"|"ox"|"word"|"mark"|"labeled"|"eq"|"geo"|"alg"|"ineq"|"coord"|"essay"|"free",
  self: true|false                            // true = 자기채점으로 보낸다 (gradable:false 이거나 essay)
}
```
- `pages[wpid].v = 2` 로 사전 버전을 적는다. **v가 없거나 1인 쪽은 다시 받는다**(새 칸을 채우려고).
- 쪽 상한 `BOOKANS_PAGE_CAP`(기본 500) 유지. 재수집 순서: 배정 학생 수 많은 교재 → 중1 → 중2 → 중3. 고등(`schoolType HIGH`, 학년 문자열이 `고`로 시작) 제외.
- `shape`·`self`·`gradable`·`unit`은 **엔진의 `HWGrade.shapeOf(problem)`** 가 정한다. 수집기는 그 결과를 그대로 적는다.
- `regradeBookAnswers()`(로그인 불필요)도 새 엔진으로 `gradable/shape/self/unit`을 다시 계산한다.

## 2. 채점 엔진 — `sync/hw_grade_engine.js` (A). 학생앱에 인라인 복사(B는 UI만, 복사는 지시자가 마지막에 한다)

공개 API (기존 유지 + 추가):
```js
HWGrade.isGradable(answerRaw)                 // 기존
HWGrade.grade(correctRaw, studentRaw)         // 기존 → { gradable, correct }
HWGrade.unitOf(answerRaw)                     // 기존 ("72 cm³" → "cm³")
HWGrade.shapeOf(problem)                      // 새. problem = { type, answer, objective, cnt, units } → { shape, self, gradable, unit, parts }
HWGrade.normalize(raw, shape)                 // 새. 학생 입력·정답을 같은 규칙으로 정리한 문자열(디버그·표시용)
```
`shapeOf`가 돌려주는 `parts` = 입력칸 설계도: `[ { label:"교점:", kind:"num", unit:"" }, { label:"교선:", kind:"num" } ]` 처럼. 이름표는 `units[].u`(대괄호 벗김)와 `answer` 속 「한글:」 조각에서 만든다. 답 칸 수는 `cnt`와 쉼표 개수로 맞춘다.

읽어야 하는 답 모양 (중1 실측, 예는 실제 정답):
| shape | 정답 예 | 정리 규칙 |
|---|---|---|
| num | `2,2,10` `\frac{1}{2},\frac{1}{4}` `-0.8` `±8` `25\%` `2배` | 기존 + `%`·`배`·전각 `＋`·앞 `+` 허용. 복수답 순서 무관 |
| unit | `20˚` `30°` `8 cm` `24㎤` `20π㎠` `\frac{27}{2}π㎠` `4ah㎤`(→alg) | 단위 글자(`㎠㎤㎡㎥㎝㎜㎞㎖ ˚ ° cm mm km m kg g L 개 명 원 번 회 점 초 분 시간 일 주 장 권 살 층 칸 마리 송이 그루 줄 바퀴`)를 값 뒤에서 벗긴다. `π`는 토큰: `20π`의 값 = 20 과 π표시. 학생은 숫자만 치고 π·단위는 칸 옆에 보인다 |
| ox | `O` `X` `○` `×` `o` `x` | `O`/`X` 두 값으로 정규화 |
| word | `약수` `예` `둔` `정구각형` `교환법칙,결합법칙` `1,서로소이다` | 공백 제거 후 글자 비교. 「예/둔/직/평」처럼 각 이름 약자는 `예각/둔각/직각/평각`도 같게 |
| mark | `ㄱ,ㄹ,ㅁ` `(1),(3)` `①,③` | 기존 ㄱ~ㅎ + `(n)`·`①`~`⑩`을 숫자로. 순서 무관 |
| labeled | `공약수: 1,2,4,8, 최대공약수: 8` `소수: 11,17,29, 합성수: 8,14,24` `밑: 4, 지수: 3` `A: -\frac{13}{3}, B: …` | 「이름표:」로 쪼개 칸별로 num/word 비교. `units[]`가 있으면 그것을 우선 |
| eq | `x=14` `a=2,b=4` `\frac{360˚}{9}=40˚` `|+10|=10` | **마지막 `=` 뒤 값**만 비교. 학생 칸에는 `x=` 이름표를 앞에 보여 준다. `a=2,b=4`는 labeled 두 칸 |
| geo | `\overrightarrow{MN}` `\overline{OA},\overline{OB}` `\overgroup{AB}` `∠AOE` `△ABC` `□+5`(→alg) | 기호 토큰화: `\overline`→`선분`, `\overrightarrow`→`반직선`, `\overleftrightarrow`→`직선`, `\overgroup`/`\overarc`→`호`, `∠`, `△`. 점 이름은 대문자. `선분AB`=`선분BA`, `호AB`=`호BA`, `∠ABC`=`∠CBA`(가운데 글자 같으면). 반직선은 순서 유지 |
| alg | `-ab` `2x+3` `-0.1x²y` `250-x명` `a÷12원` `5(1+a)` `2^4×3^2` `{2}^{2}×3×7` | 문자식 정규화: LaTeX 벗기기, `×·*`→`*`, `÷`→`/`, `^{n}`·`²³`→`^n`, 단위 한글 꼬리 제거, 항을 부호·계수·문자(정렬)로 쪼개 정렬 후 비교. 괄호가 있으면 **전개하지 않고** 괄호째 정규화(같은 꼴만 정답). 소인수분해식은 `2^4*3^2` 인수 정렬 비교 |
| ineq | `a≥-4` `-5<c≤+6` `x>3` | 부등호 정규화(`\le \ge ≤ ≥ < >`), 양변 alg 정규화, 방향 뒤집힌 같은 식(`3<x` = `x>3`)도 같게 |
| coord | `(3,6)` `A(3,6),B(-4,-3)` | 점 이름 벗기고 순서쌍 값 비교(순서 유지) |
| essay | type `ESSAY` 이거나 answer가 `.`/빈값 | `self:true`. `img`가 있으면 정답 그림, 없으면 정답 글자를 보여 주고 학생이 ◯✗ |
| free | 위 어느 것도 아님 | `self:true` (자기채점으로) |

`shapeOf`의 `gradable`은 **shape별 파서가 정답 원문을 완전히 읽었을 때만 true**. 조금이라도 못 읽으면 `self:true`로 넘긴다(오채점 방지가 우선).

시험 `sync/test_hw_grade.js`:
- 불변식: 정답 원문 그대로 → `correct:true` (중1 정답사전에서 shape별 300개씩 뽑아 검사, 실패 0)
- 오답 검사: 값 바꾼 입력은 `correct:false`
- `shapeOf` 분포 출력: 라이트 1-2 전체 문항의 shape·self 비율 (자동 ≥ 90% 확인)
- 실행: `node sync/test_hw_grade.js` (Supabase 읽기만, 로그인 불필요)

## 3. 학생앱 v2-81 (B)

`BK` 기존 흐름(교재 → 쪽 → 문항)을 유지하고 아래를 바꾼다.
1. **잠금 해제**: `BK_LOCKED=false`, 홈 허브 단추 `onclick="go('screen-bookscore')"`, `.bkhub-off` 제거. `bkSoon` 삭제.
2. **문항 카드 = shape별 입력칸** (`p.shape`, `p.parts`, `p.unit`, `p.img`, `p.self`)
   - num/unit: 지금 키패드. 칸이 여럿이면(`parts.length>1`) 칸을 나란히, 「다음 칸」 키. 단위·π는 칸 옆 라벨.
   - ox: 단추 둘. 누르면 바로 채점.
   - word: 칩 4개(정답 + 같은 쪽 다른 문항의 word 정답 + 기본 오답 낱말)를 섞어 보인다. 누르면 채점. 칩 대신 「직접 입력」도 둔다.
   - mark: ㄱㄴㄷㄹㅁ 키패드(지금 것) + `(1)~(5)`·`①~⑤` 키.
   - labeled: 이름표별 칸(`parts`), 칸마다 kind에 맞는 키패드.
   - eq: 이름표 `x=`를 칸 앞에 붙이고 값만 받는다.
   - geo: 도형 자판 탭 — `선분 반직선 직선 호 ∠ △ □ ⊥ ∥ , A~Z` (자주 쓰는 점 이름 A B C D M N O P X Y 먼저).
   - alg/ineq/coord: 문자식 자판 탭 — `x y a b c n + − × ÷ ( ) ^ = < > ≤ ≥ π , 0~9 . 분수`.
   - 자판은 탭 4개(숫자·도형·문자식·기호). **앱이 shape를 보고 첫 탭을 고른다.** 학생이 바꿔도 된다.
   - 채점은 `HWGrade.grade(p.answer, 입력)`. 객관식은 기존대로.
3. **자기채점(`p.self`)**: 카드에 「📷 내 풀이 사진 찍기」 → 사진을 `photos` 버킷 `bookscore/<학생코드>/<wpId>_<ts>.jpg`(긴 변 1600px, 0.82)에 올린 뒤에만 정답이 열린다(`img`가 있으면 그림, 없으면 `answer` 글자). 그 아래 「◯ 맞았어요 / ✗ 틀렸어요」. 사진 없이 정답을 보는 길은 없다. 「모름 ?」은 사진 없이 가능(정답도 안 보임).
4. **저장**: `hw_scores_<코드>.items["<pid>_<wpId>"] = { r:'O'|'X'|'?', a:입력 또는 '', at, pid, self:true|false, photo:"bookscore/…jpg"|"" }`. 대기열 `hw_sync_<코드>`는 기존 그대로(`result` 만 쓴다).
5. 결과 요약 화면에 「자동 n · 자기채점 n」과 틀린 문항 → ✍️ 손풀이(`hsbGoto`가 있으면 그 교재·쪽·번호로)·🙋 아하노트 단추.
6. 엔진 인라인 블록(`교재 채점 엔진 (v18-74)` 주석 ~ `root.HWGrade = API;` 까지)은 **건드리지 말 것** — 지시자가 A의 최종본으로 통째 바꾼다. UI는 계약 §2의 API 이름으로만 부른다. 없으면 임시로 `HWGrade.shapeOf`를 안전하게 감싼다(`typeof HWGrade.shapeOf==='function' ? … : {shape:'num',parts:[…]}`).
7. `STU_VER='v2-81'`, 버전 메모. 시험 모드(`isTest`)는 깨지지 않게.
8. 검증: 문법 + Playwright 하네스(라이트 1-2 실제 shape 예시 fixture) — 각 shape 입력칸 렌더·채점·저장·사진 전 정답 잠금·사진 후 열림·◯✗ 저장·잠금 해제·홈 허브 숫자.

## 4. 학원앱 v18-176 (C)

숙제체크 「📗 교재 채점」 탭(v18-74, `hw_scores_*` 수기채점 큐, 33880줄 근처)을 **자기채점 훑어보기**로 바꾼다.
1. 학생별 카드: 최근 7일 자기채점(`self:true`) 항목 — 문항 번호·학생 사진(작게, 누르면 크게)·정답 그림·학생이 고른 ◯✗. 원장이 다르게 보면 ◯/✗ 바꿀 수 있다(기존 `by:'T'` 저장 + `hw_sync` 대기열 규칙 그대로).
2. 기존 수기채점 큐(엔진이 못 읽어 원장에게 넘기던 것)는 없앤다 — 이제 전부 자기채점으로 간다. 단, `self` 표시가 없는 옛 기록은 그대로 보이게 둔다.
3. 상단 요약: 교재별 자동채점 비율(`mf_bookans_<bid>`의 `self:false` 비율)·자기채점 건수·되돌려쓰기 대기.
4. `APP_VER='v18-176'`, 버전 메모. 검증: 문법 + `node sync/check_withdrawn_leak.js lumen_v18-176.html` 10/10 + 하네스(카드 렌더·◯✗ 바꾸기 저장·대기열).

## 5. 되돌려쓰기 (변경 없음)
`hw_sync_<코드>` → 워커가 5분마다 `PATCH /student-workbook/scoring` (O→CORRECT, X→INCORRECT, ?→UNKNOWN). 자기채점 결과도 같은 길로 간다.

## 6. 근거 수치 (2026-09-14 실측, 학생이 쓰는 중1 교재 27권 24,750문항)
지금 58% → 표기 정리 70% → 식·문자식 93% · 정답 없는 서술형 1,662문항(7%)=자기채점.
라이트 1-2: 41% → 69% → 93%, 서술형 54. 매쓰플랫 원본 필드 `answerImageUrl`(서술형 25/26 있음, 공개 URL), `answerCount`, `answerUnits:[{unit,index}]`, `autoScoredType`(시중교재 전부 IMPOSSIBLE).
