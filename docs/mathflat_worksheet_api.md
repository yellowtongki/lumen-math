# 매쓰플랫 유형분석·개인별 학습지 자동 생성 — API 탐사 결과

> 2026-08-01 · SPA 번들(teacher.mathflat.com) 정적 분석 + 토큰 API 탐색으로 확인.
> **실제 학습지 생성/삭제는 하지 않았다** (읽기 전용 조사). 결론: **자동화 가능.**

## 확인된 핵심 사실

1. **로그인**: 기존 수집기의 `POST /v2/login` 토큰을 그대로 재사용 (academyId D1358, teacher T2014).
2. **응답 래핑**: 모든 API 응답이 `{ data: ... }` 형태.
3. **유형(concept) 트리**: `GET /concept/chips?curriculumKey=1&workbookIds={bookId}` — 정상.
   필드: conceptChipId, conceptId, conceptName, big/middle/littleChapterName, conceptChipType(개념/기본/심화), recommended, repProblem.

## 학습지 생성 흐름 (사진의 "유형 선택 → 학습지 만들기"와 동일)

SPA `worksheet.api` / `commonWorksheet.service` 청크에서 추출한 실제 엔드포인트:

```
1) GET  /derivation/weak-concept-chip   (params: byStudent…)   ← 학생별 취약 유형 칩 목록
        (mp_event_name = "유형분석_학습지만들기")
2) POST /worksheet/filter/weak-concept   (body)  → filterId 반환
3) GET  /worksheet/problem/count         (params: filterId 등) → 문항 수 미리보기
4) POST /worksheet                        (body) → 학습지 생성·배정
        body 후보 키: title, type, filterId, problemIds/conceptIds, level,
                      schoolType, grade, studentIds
        (mp_event_name = "학습지만들기3_학습지만들기버튼선택시")
   수정/삭제: PUT/PATCH /worksheet/{id}, DELETE /worksheet
```

관련 파생(약점) 엔드포인트도 확인: `/derivation/weak-concept`, `/derivation/weak-worksheet`,
`/derivation/one-click`, `/worksheet/filter/weak-period`, `/worksheet/filter/weak-worksheet`.

## 유형분석 성취도(색 그리드)

- 매쓰플랫 원본 성취도 리포트는 `/achievement-analysis-report`(pdf-client 렌더)로 PDF.
- **그러나 색 그리드의 원재료(유형별 정답/오답)는 루멘이 이미 수집 중** — `mf_answer_records`의
  `concept_id + result`. 즉 **매쓰플랫 없이도 유형별 성취도를 직접 계산**해 학원앱·학생앱에 그릴 수 있다.
- 추가로 매쓰플랫의 "추천 취약 유형"이 필요하면 `GET /derivation/weak-concept-chip`로 보강.

## 결론 — 두 기능 모두 가능

| 기능 | 방법 | 상태 |
|---|---|---|
| 유형별 성취도(약점 지도) | 수집 데이터(concept_id+result)로 자체 계산 + 필요시 weak-concept-chip 보강 | ✅ 지금 가능 |
| 개인별 취약유형 학습지 자동 생성 | weak-concept-chip → filter/weak-concept → /worksheet(studentIds) | ✅ API 확인, 실물 생성 테스트 남음 |

## 다음 단계 (신중하게)

1. **약점 지도 먼저** — 매쓰플랫 API 없이 수집 데이터만으로 학원앱·학생앱에 구현(리스크 0).
   앞서 만든 `docs/mockup_weakness_map.html` 그대로.
2. **학습지 자동 생성은 실물 1건 테스트부터** — 새벽 시간대에 「zzAPI테스트」 학습지 1건을
   위 흐름으로 실제 생성해 응답(filterId·worksheetId·문항수)을 확인하고 즉시 삭제.
   성공 확인 후에야 "학원앱에서 학생·범위 선택 → 새벽 자동 생성·배정"을 구현.
3. 원장이 매쓰플랫을 안 쓰는 새벽 시간대에만 실행(동시 로그인 끊김 주의, CLAUDE.md).

## 보안
- 토큰·비밀번호·쿠키 값은 저장·커밋 금지. 계정은 환경변수만.
- 생성/삭제는 반드시 자체 생성물(「zzAPI테스트」)에만. 기존 데이터 절대 손대지 않음.
- 조사 결과 요약은 lumen_store `mf_ws_api_probe`에 저장됨.

---

## ⭐⭐⭐ 2026-08-17 정찰 완료 — 학습지 생성 실검증 성공 (시범 1장 생성됨)

리커버리·유형성취도 「학습지 자동 생성」을 위해 실서버에서 전 과정을 검증했다.
**시범 학습지 「리커버리 시범 (삭제예정)」 id=80559542 (중1·12문항·배정 없음)** 이
실제로 생성돼 내학습지에 있다. 원장 확인 후 삭제 가능.

### 확정된 3단계 호출 (전부 실검증)

```
1) POST /worksheet/filter/concept        → { filterId }
   body (전 필드 필수 — null이면 NOT_ALLOW_NULL):
   { type:'CONCEPT', conceptIdList:[유형id...], excludedTopicIds:[], excludedSubTopicIds:[],
     problemList:null, problemCount:12, level:2, levelWeight:[0,50,50,0,0],
     problemFilterType:'ALL', practiceTest:'INCLUDE', onlyAutoScorable:false,
     excludePrevious:false, previousExclusionScope:null, studentIds:null, excludeOOC:true,
     equalityLevel:null, minRate:0, maxRate:100,
     selectedConceptIdList:[], selectedLittleChapterIdList:[] }
   ※ levelWeight = [최하,하,중,상,최상] 비율. excludePrevious+studentIds로
     「그 학생이 푼 문제 제외」 가능(리커버리에 유용, 추후 검증).

2) GET  /worksheet/problem/count?filterId=...   → 숫자 (미리보기)
3) POST /worksheet/problem  body { filterId }   → 문제 12개 배열
   (id, level, rate, conceptId/Name, problemImageUrl, answer... — tagTop 포함)

4) POST /worksheet → 새 학습지 id (숫자)
   body = { filterId, problemList:[{id,tagTop}], conceptIdList, littleChapterConceptIdList:[],
     assignStudentIdList:[학생id...],   // []이면 배정 없이 생성만
     shareScope:'ACADEMY', title, writer, prefix:'취약유형', tag:'WEAK_CONCEPT_CHIP',
     layoutType:11, layoutColor:'BLUE', partitionType:4,
     wrongAnswerNoteFlag:false, conceptNameFlag:false, answerRateFlag:false,
     relationWorkbookFlag:false, includeProblemFlag:true, problemTrendFlag:false,
     conceptSortType:'CHAPTER', schoolType:'MIDDLE', grade:'1', revision:'CURRICULUM_22',
     problemPadding:60, pdfDateType:'TODAY', pdfDate:null, designTemplateId:39707, qrFlag:true }
   ※ 디자인 값(layoutType 등)은 원장 실물 학습지(80457916)에서 복사 — 학원 기본 서식 그대로.
   ※ grade는 중등이면 '1'/'2'/'3', 고등이면 '공통수학2' 같은 과목명 문자열.
   ※ tag 종류: WEAK_CONCEPT_CHIP=취약유형(유형분석), DAILY_TEST=일일TEST, ETC=직접입력.

삭제: DELETE /worksheet  body { worksheetIds:[id] } (worksheet.api의 deleteWorksheets — 미검증)
유형 id 소스: GET /concept/chips?curriculumKey=1&workbookIds={교재id} → conceptId
             (수집기 mf_typedb·mf_concept_names와 동일 체계 — 처방의 유형과 바로 연결됨)

### 주의
- GET /derivation/weak-concept-chip 은 파라미터 불명으로 500 — 문제 후보는
  filter/concept 경로로 충분해서 필요 없음.
- 필터 생성은 부작용 없는 임시 객체. 실제 「쓰기」는 4)뿐.
- 다음 단계: 워커(collect_request_worker 패턴)에 ws_make_req 처리 추가 + 앱 버튼 2곳.

### ⭐ 2026-08-17 원장 확인 후 확정 스펙 (구현에 이 값 사용)

원장 피드백: ① 녹색 「주간 리커버리」 템플릿 사용 ② 문제 시작 전 이론(개념 박스) 제외.

- 디자인 템플릿: **designTemplateId 41988** (「주간 리커버리」, 원장이 매쓰플랫에 만들어 둠)
  GET /worksheet/design → 목록(13개), GET /worksheet/design/41988 → 상세로 실검증:
  ```
  { layoutType:11, layoutColor:'GREEN', partitionType:4,
    wrongAnswerNoteFlag:false, conceptNameFlag:false, problemTrendFlag:false,
    answerRateFlag:false, qrFlag:true, relationWorkbookFlag:true,
    includeProblemFlag:false,   ← 이론(개념 박스) 제외! 시범 1장에 이론이 들어간 건
                                   이 플래그를 true로 보냈기 때문 (원장 템플릿은 false)
    pdfDateType:'TODAY' }
  ```
- 생성 body는 위 템플릿 값 + designTemplateId:41988 로 교체해 사용한다.
- 태그는 tag:'WEAK_CONCEPT_CHIP'(취약유형) 유지 — 원장 화면 선택과 일치.

### ⚠️ 2026-08-17 이론(개념 박스) 제거 — 진짜 원인 규명 (실측)

`includeProblemFlag:false`로는 이론이 사라지지 않았다(시범2에 그대로 인쇄됨).
후보를 바꿔가며 학습지를 만들고 PDF를 렌더링해 대조한 결과:

**생성 body의 `conceptIdList`가 이론 박스를 만든다.**

```
POST /worksheet  body
  conceptIdList: [15246,15247,15248]  → 문제 위에 「유형명 + 개념 설명 박스」 인쇄됨
  conceptIdList: []                   → 문제만 인쇄 (원장 요청 형태) ✅
```

- 문제 선택은 앞 단계 `POST /worksheet/filter/concept`가 conceptIds로 이미 끝내므로,
  생성 body에서 비워도 **문항 구성은 전혀 달라지지 않는다**.
- 실측: 시범3(80560746) — conceptIdList:[] → 이론 없이 문제 6개만, 녹색 서식 정상.
- 워커(collect_request_worker.js)는 이 값을 비워 보내도록 수정 완료.

### 학습지 삭제 (실검증)
```
DELETE /worksheet   body = [80560709, 80560712]     ← 배열을 그대로 보낸다
  ※ {worksheetIds:[...]} / {ids:[...]} 는 400 MESSAGE_NOT_READABLE
```
