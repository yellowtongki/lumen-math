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
