# 매쓰플랫 「시중교재 → 쌍둥이 문제」 조사 결과 (2026-10-03)

> 원장 요청: 쎈 중등수학1(상) 174~175쪽의 쌍둥이가 매쓰플랫에 있는지, 몇 번이 있는지 조사.
> 선생님 웹(teacher.mathflat.com, 2026-10-01 배포 번들) 정적 분석 + 실서버 읽기 호출로 확인. **학습지 생성·배정은 하지 않았다.**
> 스크립트: `sync/mf_twin_compare.js` (원본·쌍둥이 비교 HTML 생성)

## 결론

- 쎈 중1(상)(22개정, 교재 id **2119121**) 174~175쪽 원본 **11문항 전부** 매쓰플랫 쌍둥이가 있다. 총 **32개**(문항당 2~4개, 대부분 3개).
- 매쓰플랫 시중교재는 교재 단위로 `pairX`(쌍둥이 배수, 보통 3)와 `pairFlag`를 가진다. 중등 쎈 계열은 거의 전부 `pairX=3`.
  `pairX=0`인 교재(예: 개념쎈 중2(하) 22개정 일부)는 쌍둥이가 없다.
- 전에 "쌍둥이가 없다"고 보였던 문항은 **같은 유형(conceptId)당 최대 3문항** 기본 제한(`limitProblemCountPerConcept=3`)에 걸린 것이었다.
  같은 쪽에 같은 유형 문항이 둘이면 둘째 문항의 쌍둥이가 0으로 보인다. 제한을 10으로 주면 다 나온다.
- 매쓰플랫은 요청마다 풀에서 무작위로 고르므로 두 번 요청해 합치면 1~2개 더 모일 수 있다(1188번은 4개).

## 요청 모양 (전부 GET, 읽기 전용)

```
① GET /workbook?type=PUBLIC&schoolType=MIDDLE&size=1000      시중교재 목록(중등 881권). pairX·pairFlag·list(배정 학생) 포함
   ※ GET /workbook?type=PUBLIC&size=1000 만 주면 초등 1,000권만 와서 중등이 안 보인다. schoolType 또는 page=1,2 를 줘야 한다.
   ※ GET /workbook/{bid} 상세에는 배정 학생 list 가 없다.
② GET /student-workbook/student/{sid}?workbookType=ALL         → studentWorkbook.id(swId), recentRevisionId(revId)
③ GET /student-workbook/student/{sid}/{swId}/{revId}?size=2000 → page.content[].workbookPage {id, page, title}
④ GET /workbook/{bid}/page/{pid}?size=300                       → 문항 {id, number, title(단계), conceptId, level(1~5), type, answer, exampleProblem.url}
⑤ GET /derivation/workbook/problem?workbookId={bid}&studentIdList={sid}
        &workbookProblemIdList={id}&workbookProblemIdList={id}…
        &pairX=3&similarX=0&levelType=NORMAL&excludePrevious=false&includeSameProblem=false
        &onlyAutoScorable=false&limitProblemCountPerConcept=10
   → { problemList:[{ workbookProblemId(원본 id), id(쌍둥이 id), level, type, conceptId,
                      problemImageUrl, answerImageUrl, solutionImageUrl, problemSummary.answerRate }], problemSize, … }
   쪽 단위 변형: GET /derivation/workbook/page?…&revisionIdList={revId}&pageNumbers=174-175&onlyWrongProblem=false (나머지 같음)
⑥ GET /concept/chips?curriculumKey=1&workbookIds={bid}          → conceptId → conceptName·littleChapterName·conceptChipType
```

- 매개변수 뜻(웹의 「교재 클리닉」 옵션): `pairX` 쌍둥이 개수(0~교재 pairX), `similarX` 유사문제 개수(0~3), `levelType` EASY/NORMAL/HARD(유사문제 난이도),
  `includeSameProblem` 동일문제 포함(시중교재는 false), `excludePrevious` 학생이 푼 문제 제외, `onlyWrongProblem` 틀린 문제만(쪽 단위에서만).
- `similarX>0`이면서 `pairX=0`인 조합은 400이 났다(유사문제만 받는 조건은 더 조사 필요).
- 문항 단위는 결과 150문항, 쪽 단위는 400문항까지가 웹의 상한.
- 이 결과로 실제 학습지를 만드는 요청은 `POST /worksheet`(tag `WEAK_WORKBOOK`) — **이번에는 호출하지 않았다.**

## 안 되는 것 (시행착오 기록)

`/problem/{id}/similar`, `/problem/{id}/pair`, `/v2/worksheet/filter/similar`, `/worksheet/filter/public-workbook`(필수값 미상) 전부 404/400.
`sync/mf_textbook_bank.js --twins` 의 `twinsOf()` 가 이 주소들을 쓰고 있어 항상 빈 배열이 나온다 → ⑤로 바꾸면 된다.

## 쎈 중1(상) 174~175쪽 결과

| 쪽 | 번호 | 유형 | 난이도 | 형식 | 쌍둥이 |
|---|---|---|---|---|---|
| 174 | 1184 | 정비례 관계 y=ax의 그래프 위의 점 | 최상 | 주관식 | 3 |
| 174 | 1185 | 정비례 관계 y=ax의 그래프 위의 점 | 상 | 주관식 | 3 |
| 174 | 1186 | 정비례 그래프와 도형의 넓이 | 최상 | 객관식 | 3 |
| 174 | 1187 | 반비례 관계의 활용(3) | 상 | 주관식 | 3 |
| 174 | 1188 | 반비례 그래프의 성질 | 상 | 주관식 | 4 |
| 175 | 1189 | 반비례 그래프 위의 점(좌표가 정수) | 최상 | 객관식 | 3 |
| 175 | 1190 | 반비례 그래프와 도형의 넓이 | 최상 | 객관식 | 3 |
| 175 | 1191 | 정비례·반비례 그래프가 만나는 점 | 상 | 주관식 | 3 |
| 175 | 1192 | 정비례·반비례 그래프가 만나는 점 | 상 | 주관식 | 2 |
| 175 | 1193 | 정비례 관계의 활용(4) 두 그래프 비교 | 상 | 객관식 | 3 |
| 175 | 1194 | 반비례 관계의 활용(3) | 상 | 주관식 | 2 |

## 주의

- 문항 그림은 매쓰플랫·출판사 저작물. 원장 확인용 비교표(로컬/비공개 artifact)에만 쓰고 학생·학부모 앱이나 저장소에 넣지 않는다.
- 학생 이름은 저장하지 않는다(스크립트는 배정 학생의 id 만 쪽 목록을 열기 위해 쓴다).
- 매쓰플랫 계정은 환경변수 `MATHFLAT_ID`/`MATHFLAT_PASSWORD` 만 사용.
