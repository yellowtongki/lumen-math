# 매쓰플랫 서술형(SCHOOL_PREPARE_ESSAY) API 탐색 결과 — 0단계 (2026-09-06)

서술형 첨삭 기능(작업 #22)을 만들기 전에 「매쓰플랫에서 서술형 관련 자료를 어디까지 받을 수 있는가」를
실제 로그인해서 확인한 기록. 학생 개인정보는 넣지 않았다(문항 구조만).

## 한눈에

| 자료 | 받을 수 있나 | 어디서 |
|---|---|---|
| 서술형 학습지 머리(제목·단원·학년·문항 수) | ✅ | `GET /worksheet/{id}` (`type/tag: SCHOOL_PREPARE_ESSAY`, `titlePrefix: 서술형`) |
| 문항별 **문제 이미지 · 정답 · 해설 이미지** | ✅ | `GET /worksheet/{id}/problem` 또는 `GET /student-worksheet/assign/{swId}/problem` → `problem.problemImageUrl / answer / solutionImageUrl` (인증 없이 내려받기 가능) |
| 문항별 **배점**(maxScore) | ✅ | 배정본 `…/assign/{swId}/problem` → `essay.maxScore` (10점씩, 10문항 = 100점) |
| 답안 칸 구조 | ✅ | `essay.essayType`: `STEP`(단계형, 칸 2~3개) · `DESCRIPTIVE`(서술형, 칸 1개) · `BLANK`(빈칸형, 칸 4~18개 + 칸별 정답) / `essay.slots[{tag,x,y,w,h,label,answer}]` (문제 이미지 기준 비율 좌표) |
| 학생 **태블릿 손글씨** | ✅ | `essay.slotHandwritings[{tag, handwritingUrl}]` → S3 `handwrittenNote.json` (획 좌표: `paths[{color,width,points[[x,y]…],pixelRatio}]`, `viewBox:[w,h]`). 인증 없이 받아짐. 캔버스로 다시 그려 문제 이미지 위에 겹칠 수 있음(실측 성공) |
| 문항별 O/X | ✅ | `result: CORRECT/WRONG` (이미 수집기가 mf_answer_records에 저장 중) |
| 채점 공개 여부 | ✅ | `GET /student-worksheet/assign/{swId}` → `essayScoringOpened: true/false` |
| 문항별 **점수(부분점수)** | ⚠ 칸만 있음 | `…/assign/{swId}/problem` 각 문항 `score` — 선생님이 점수를 매긴 7월 배정본 2건에서도 `null`. 원장이 첨삭 화면에서 −/+ 로 매긴 점수가 여기 실리는지는 아직 미확인 |
| **AI 가채점 점수 · AI 첨삭 문장 · 선생님 첨삭 문장** | ❌ 못 찾음 | 시도한 경로 전부 404/400 (`…/essay`, `…/scoring`, `…/handwriting`, `…/ai-scoring`, `/essay-scoring/…`, `/report/essay?…`). 웹 번들(index + 1·2단계 청크 450개)에도 서술형 채점 화면 청크가 없음 → 별도 앱/도메인에서 로드되는 것으로 추정 |
| 서술형 보고서 PDF | ❌ | `GET /report/{studentId}` 는 MONTHLY만 나옴. 서술형 보고서는 다른 경로 |
| 해설 영상 | ✅ (덤) | `problem.video.videoUrl` (m3u8) — 작업 #20 교과서 풀이 서랍에서 활용 가능 |

## 결론 → 설계에 반영한 것

- 채점기준(문제·정답·해설·배점·칸 구조)은 매쓰플랫에서 자동으로 가져올 수 있다
  → 수집기 `node sync/mathflat_collector.js --essay-ws 75519372,75519373` (또는 `auto`)이
  lumen_store **`mf_essay_ws`** 에 저장. 학원앱 「✍️ 서술형 첨삭」이 이 사전을 채점기준으로 쓴다.
- 가채점 점수·첨삭 문장은 매쓰플랫에서 못 받으므로 **우리 쪽 Opus가 직접 채점·첨삭**한다(1단계).
- 태블릿 손글씨는 획 데이터로 받을 수 있으므로, 4단계에서 「태블릿으로 푼 학생」도
  같은 첨삭 파이프라인에 태울 수 있다(손글씨 → 이미지 복원 → Opus).
- 매쓰플랫으로 점수 되돌려쓰기는 `score` 칸의 쓰기 API를 못 찾아 보류.

## 확인 방법 (재현)

```
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node sync/mathflat_collector.js --essay-ws 75519372,75519373
```
원본 응답 덤프는 `sync/_debug/essay_probe/` (gitignore, 학생 실명 포함 → 커밋 금지).

## 학습지 사전(mf_essay_ws) 구조

```json
{ "75519373": { "id": 75519373, "title": "[중1-1] 04 좌표평면과 그래프3 (일반)", "chapter": "좌표평면과 그래프",
    "school": "MIDDLE", "grade": "1", "problemCount": 10, "maxTotal": 100, "updated": "…",
    "problems": [ { "no": 1, "problemId": 989449, "wpId": 2235469280, "essayType": "STEP", "maxScore": 10,
        "slots": [{"tag":1,"label":null,"answer":null}, …], "answer": "10", "img": "…/problem.png",
        "ansImg": "…/answer.png", "solImg": "…/solution.png", "concept": "좌표평면 위의 도형의 넓이",
        "level": 3, "answerRate": 75, "video": "…/video.m3u8" } ] } }
```
