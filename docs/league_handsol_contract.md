# 루멘 리그 · 손풀이 — 구현 계약서 (2026-09-08, 원장 결정 반영)

학원앱(lumen_v18-160·161)과 학생앱(student_v2-72·73)을 **따로 코딩**하므로, 두 앱이 주고받는
데이터 모양을 여기서 먼저 못 박는다. 두 쪽 모두 이 문서의 키·필드 이름을 그대로 쓴다.
시안: `docs/artifact_league.html`(리그), `docs/artifact_handsol.html`(손풀이).

## 0. 원장 결정 요약

| 항목 | 결정 |
|---|---|
| 리그 구조 | (다) 종목별 독립 리그(진도·IB아하·말하기) + 👑 종합 챔피언(등수 포인트) |
| 종합 포인트 | 종목별 등수 1위 25 · 2위 18 · 3위 15 · 4위 12 · 5위 10 · 6위 8 · 7위 6 · 8위 4 · 9위 2 · 10위 1. **두 종목 이상** 참여해야 자격. 부(초·중·고)별로 따로 |
| 말하기 종목 | 11월 시즌부터. 지금은 「준비 중」 탭만 |
| IB아하 상 | 4개: 🥇 질문왕(리그 점수 1위) · 🏆 베스트 질문(시즌 최고 질문 한 편, 순위 무관) · 📈 성장(시즌 전반 대비 후반 평균 질문력 상승 최대) · 🪞 성찰(AHA 되돌아보기 최다). **스스로해결상은 없음** |
| 상금 | IB아하 총상금 기본 50,000원(설정에서 변경), 개별 금액은 학생에게 숨김. 종합 챔피언 상 기본 「문화상품권 30,000원」 |
| 스스로 해결 | 경로 보너스 self **4 → 2** (h1 3 · h2 2 · h3/hand 1 유지). 🎲 무작위 설명 검사에서 못 하면 **그 시즌 그 학생 스스로 해결 점수 전부 0**. 등급 조건 「사고자: 스스로 3건」 유지 |
| 위치 | 학생앱 홈 배너 하나 → 「🏆 루멘 리그」(종목 탭). 학원앱 「📈 진도·리포트 › 🏆 리그」 서브탭 |
| 손풀이 위치 | 학원앱 「📱 학생앱 › ✍️ 손풀이」 탭(올리기·서랍·배분·빈 곳·학생별). 학생앱 홈 타일 「✍️ 손풀이」 |
| 손풀이 공개 | 수업 학습지·모음집 = 「바로」 기본. 교재·숙제 손풀이는 기존 「힌트 뒤」 규칙 유지 |
| 손풀이 대상 | 매쓰플랫 학습지 = 같은 학습지 받은 학생(기본). 학교 기출 = 그 학교 학생, 시험 2주 전 자동. 필기 없는 문제는 안 올림 |
| 유형 미확인 | 서랍에 두고 검색만 됨(학생에게도 보임) |
| 배포 | 학원앱은 lumen_v1.html 함께 교체. **학생앱은 배포하지 않음**(새 버전 파일만) |

## 1. 리그 — lumen_store 키

### 1-1. `aha_league_cfg` (기존 키에 필드 추가, 학원앱만 씀)
```
prize:      { total:50000, awards:[
               {k:'top',     name:'질문왕',     icon:'🥇'},
               {k:'best',    name:'베스트 질문', icon:'🏆'},
               {k:'growth',  name:'성장',       icon:'📈'},
               {k:'reflect', name:'성찰',       icon:'🪞'} ] }
champion:   { prize:'문화상품권 30,000원', points:[25,18,15,12,10,8,6,4,2,1], minEvents:2 }
speaking:   { enabled:false, startsAt:'2026-11-01' }
```

### 1-2. `aha_league_board` (학원앱이 「발행」 버튼으로 씀, 학생앱은 읽기만)
```
{ seasonId:'2026-09',                 // seasonStart 의 YYYY-MM
  season:{ start:'2026-09-01', end:'2026-10-31', label:'9~10월 시즌' },
  publishedAt:ISO, publicTop:5, nameMode:'masked'|'real'|'hidden',
  lampOnly:true, caps:{daily:2, weekly:8, minQ:5},
  prize:{ total:50000, awards:[{k,name,icon}] },      // 금액 없음
  rules:'하루 2건·주 8건 인정, 질문력 5 미만 0점 …',    // 학생앱 규칙 칸 문장
  divisions:{ elem:[ROW], mid:[ROW], high:[ROW] },
  best:{ code, noteId, q_ask, total, date } | null,   // 베스트 질문 후보(원장 pick)
  champion:{ points:[25,…], minEvents:2, prize:'문화상품권 30,000원',
             divisions:{ elem:[CROW], mid:[CROW], high:[CROW] } } }

ROW  = { code, name,            // name 은 nameMode 적용 후 문자열(마스킹은 학원앱이 함)
         rank, league,          // 시즌 리그 점수 합(상한 적용)
         avg, count, self, aha, // 평균 질문력·인정 건수·스스로 해결 확정 수·AHA 수
         tier:'inquirer'|'knowledge'|'thinker'|'reflect',
         nextTier:{ k, need:'평균 8 · 스스로 3건' } | null,
         awards:['top','best','growth','reflect'],   // 현재 후보인 상
         spark:[0,1,2,…14개],   // 최근 14일 일별 인정 건수
         selfVoid:true|absent } // 🎲 검사로 이번 시즌 스스로 점수 취소됨
CROW = { code, name, rank, total, race:{rank,pts}|null, aha:{rank,pts}|null, speak:null }
```
학생앱은 **자기 code 로 자기 ROW 를 찾고**, rank ≤ publicTop 인 행만 이름을 보이고 나머지는 흐림(진도레이스 문법).
자기 행은 항상 선명.

### 1-3. `aha_league_awards` (학원앱 🎁 시상 확정 → 발행)
```
{ [seasonId]: { seasonId, label, total, publishedAt,
                awards:[ {k, name, icon, code, name_masked, amount} ],   // amount 는 학생앱에 안 보여도 됨
                champion:{ code, name_masked, prize } | null } }
```
학생앱: 오늘이 season.end 이후이고 이 키에 seasonId 가 있으면 🎉 시즌 결과 화면.

### 1-4. `aha_self_void` (🎲 무작위 설명 검사 결과, 학원앱이 씀·읽음)
```
{ byCode:{ [code]: [ {seasonId, noteId, at, by:'T'} ] } }
```
iblBoard 계산 시 해당 (code, seasonId) 가 있으면 그 시즌 그 학생의 모든 노트에서 **path==='self' 인 pathBonus 를 0** 으로 다시 합산(원본 aha_scores 는 건드리지 않음). ROW.selfVoid=true.

### 1-5. 종합 챔피언 계산(학원앱)
- 진도 종목: 기존 `race_board` 의 부별 순위(학원앱 race 화면이 쓰는 구조를 그대로 읽음). 순위 → points[rank-1] (11위 이하 0).
- IB아하 종목: iblBoard() 부별 순위 → points.
- 말하기: 지금은 항상 null.
- 참여 종목 수 < minEvents → 자격 없음(표에는 「한 종목만」 표시, 순위 없음).
- 동점: 진도 포인트가 큰 쪽 우선, 그래도 같으면 공동.

### 1-6. 학생앱 화면(루멘 리그)
- 홈: 기존 진도레이스 배너(rcbn)를 「🏆 루멘 리그」 배너 하나로. 줄 1: 종목별 내 순위(진도 N위 · 아하 N위 등급 · 종합 N위), 칩: 진도 D-day · 아하 D-day · 말하기 준비 중. 진도레이스가 꺼져 있으면 아하만.
- 화면 「🏆 루멘 리그」: 상단 종목 탭 [진도 D-xx] [IB아하 D-xx] [말하기 준비 중] [👑 종합].
  - 진도 탭 = 기존 진도레이스 화면 내용을 그대로 옮김(함수 재사용).
  - IB아하 탭 = 상금 카드(총상금·4상 아이콘, 내가 후보인 상 테두리) → 내 카드(등급·순위·리그 점수·평균·인정·스스로·AHA·다음 등급 조건·등급 사다리) → 순위표(publicTop 공개, 나머지 흐림, 내 행 선명) → 베스트 질문 → 규칙.
  - 말하기 탭 = 「11월 시즌부터」 안내 + 채점 기준 초안(완결·정확·자기 말 각 0~2).
  - 종합 탭 = 포인트 규칙 표 + 부별 종합 순위 + 내 포인트 내역 + 종합 상.
  - season.end 지났고 awards 있으면 🎉 결과 화면 먼저.
- 스스로 해결 문구: 「+4」 → 「+2」(홈 카드·경로 표·임시 문구 모두). 규칙 칸에 「🎲 선생님이 무작위로 설명을 시킬 수 있어요. 설명 못 하면 그 시즌 스스로 해결 점수가 모두 사라져요」.

## 2. 손풀이 — lumen_store 키 · Storage

### 2-1. Storage
- 버킷 `aha_photos`(공개, 이미 있음) 경로 `hand/ws/<srcKey slug>/<seq>_<ts>.jpg` — 문제별 JPEG(긴 변 1400px, 0.85).
- 원본 PDF 는 `school_pdfs/hand/<ts>_<slug>.pdf` (기존 손풀이 규칙과 동일). 파일명은 ASCII slug 만(storageSlug 재사용).

### 2-2. `hand_solutions` (학원앱이 쓰고, 학생앱은 읽기만)
```
{ items:{ [id]: ITEM }, sets:{ [setId]: SET }, updated:ISO }

ITEM = { id:'h_'+ts+'_'+seq, src:'mf'|'exam'|'etc',
         srcKey:'mf|<worksheetId>' | 'exam|옥길중|2025-1중간' | 'etc|<자료명>',
         srcTitle:'단원 TEST 중3-2 (VII. 통계)',
         seq:17,                      // 문제 번호(숫자)
         pid:null|number,             // 매쓰플랫 문항 id
         conceptId:null|number, conceptName:'분산의 성질'|'',
         conceptSrc:'mf'|'ai'|'manual'|'',   // 유형이 어디서 왔나('' = 미확인)
         img:'https://…/aha_photos/hand/ws/…jpg',
         page:1, bbox:[x0,y0,x1,y1],  // PDF 좌표(pt), 참고용
         date:'2026-09-08',           // 수업일(PDF 머리글 또는 올린 날)
         audio:null, video:null,      // 3·4단계용
         at:ISO, by:'T', views:0 }
SET  = { id:'s_'+ts, title:'단원 TEST 중3-2 (VII. 통계)', kind:'ws'|'bundle',
         src:'mf'|'exam'|'etc', srcKey, date:'2026-09-08',
         items:[itemId,…],
         codes:['A1B2C3',…],          // 발행 시점에 대상 학생 코드로 풀어서 저장
         wrong:{ [code]:[seq,…] },    // 학생별 틀린 번호(매쓰플랫 채점·기출모의 채점에서), 없으면 {}
         reveal:'now'|'hint'|'date', revealAt:null|'2026-10-06',
         publishedAt:ISO|null }       // null = 서랍에만(학생에게 안 보임)
```
- 학생앱: `hand_solutions.sets` 중 `codes` 에 내 코드가 있고 `publishedAt` 이 있고(`reveal==='date'` 면 오늘 ≥ revealAt) 인 것만 보인다. `reveal==='hint'` 인 세트는 기존 힌트→재풀이 규칙(aha_hints.hand)과 같은 조건에서만 열린다 — 1단계에서는 목록에 「힌트 뒤 열려요」 잠금 표시.
- 학생앱 목록: 세트를 date 내림차순. 카드: 제목 · N문제 · 풀이 N개 · 내가 틀린 N(wrong[code].length). 세트 화면: 번호 판(1..max seq, 풀이 있는 번호만 진하게, wrong 빨강) → 이미지 크게 → 유형·내 결과 → 「다음 틀린 문제」 「🙋 이 문제로 IB아하노트」(아하노트 시작 화면으로 이동, 교재명=srcTitle·번호=seq 미리 채움) 「📚 같은 유형 손풀이 N개」.
- 학생앱 「손풀이 찾기」: 내게 보이는 세트의 items 를 conceptName 으로 묶기 + 검색(유형·srcTitle). 열람 수 기록은 1단계에서 안 함.
- 크기: items 가 3,000개를 넘으면 월별 키로 나눈다(2단계). 1단계는 한 키.

### 2-3. 학원앱 올리기 파이프라인 (client-side, pdf.js 기존 것 사용)
1. PDF → 각 쪽 텍스트 항목(getTextContent: str, transform, height, width). **큰 번호 후보** = 정규식 `^\d{1,2}$` 이고 height ≥ 쪽 평균 글자 높이 × 1.6 이며 x 가 두 단 중 한 단의 왼쪽 8% 안. 같은 단에서 y 순으로 정렬 → 상자 = [단 왼쪽, 번호 y-6, 단 오른쪽, 다음 번호 y-8 또는 본문 하단].
2. 번호 후보가 3개 미만인 쪽 → **색 픽셀 뭉치**: 쪽을 캔버스에 그려 채도 있는 픽셀(굿노트 펜 색; |r-g|+|g-b| > 60) 을 20px 격자로 세고, 인접 격자를 뭉쳐 상자로. 뭉치와 번호 좌표를 합쳐 판단.
3. 그래도 없으면 AI 눈: 기존 `handAiRead` 와 같은 방식(Haiku 비전)에 「번호와 각 문제의 상자 좌표를 JSON 으로」 요청.
4. 항상: 화면에서 상자 끌어 조정·번호 직접 입력·삭제.
5. 필기 없는 상자(색 픽셀 뭉치 없음)는 기본 「안 올림」 체크 해제 상태.
- 매쓰플랫 학습지 매칭: 머리글 텍스트(첫 쪽 상단 15%)에서 제목·이름·날짜(YYYY.MM.DD) 읽기 → `mf_answer_records` 테이블에서 `worksheet_title` 이 같고 학생 이름(or_studentdb 이름→코드→mf sid 는 기존 매핑 함수 사용)이 맞는 worksheet_id 를 찾음 → problem_seq→problem_id·concept_id·result. `mf_concept_names[conceptId].n` 으로 유형 이름. 같은 학습지를 받은 학생 = `mf_ws_assign.map[wid]` 의 sid 들 → 코드. 못 찾으면 「학습지 기록 없음 — 기타 자료로 저장」.
- 학교 기출 매칭: 기출모의 목록(mock_exams / lumen_jamock 에 있는 시험 코드)에서 고르기 또는 학교·연도·학기 입력 → srcKey `exam|학교|연도-학기구분`. 틀린 번호는 기출모의 채점 기록이 있으면 사용.
- 유형 AI 추천(exam·etc): Haiku 에 문제 글(텍스트 항목 합침)과 `mf_typedb` 해당 학년 유형 이름 목록을 주고 1~3개 추천 → 원장 「맞음」 → conceptSrc:'ai'. 확인 안 하면 conceptName 은 첫 추천, conceptSrc:''(미확인).

### 2-4. 학원앱 화면
「📱 학생앱 › ✍️ 손풀이」 (GROUPS studentapp 에 `{v:'handsol', icon:'✍️', label:'손풀이'}` — 강의실 다음).
소탭: ⬆ 올리기 · 📚 서랍(왼쪽 나무: 출처/학년·단원/붙은 것·유형 미확인 · 검색 · 보기 전환 유형별/출처별/날짜별 · 카드 격자 · 선택 막대) · 📤 배분(모음집 이름 AI 제안, 대상 5방식, 시점 3방식, 자동 규칙 토글 4 — 1단계는 규칙 ①「매쓰플랫 학습지 올리면 받은 학생에게 바로」만 실제 동작, 나머지는 설정값 저장만) · 🕳 빈 곳(학년·단원별 손풀이 수 vs 최근 30일 오답 학생 수 색 표 + 상위 5) · 👤 학생별(학생 × 받은 세트 수·풀이 수).
아하노트 안 기존 「📚 라이브러리」 단추는 유지하되 옆에 「✍️ 손풀이 탭 열기」 추가.

### 2-5. 손풀이 설정 `hand_cfg` (lumen_store)
```
{ autoWs:true, autoExamDays:14, revealDefault:'now', examAuto:true, parentNotify:true }
```

## 3. 공통 규칙 (기존 그대로)
- 새 버전 파일만 만든다: 학원앱 `lumen_v18-160.html`(리그) → `lumen_v18-161.html`(손풀이), 학생앱 `student_v2-72.html`(리그) → `student_v2-73.html`(손풀이). 이전 버전 파일은 수정하지 않는다.
- APP_VER / STU_VER 갱신, 버전 로그(memo) 추가.
- 문자열 결합만(중첩 템플릿 리터럴 금지), 오버레이는 한 번에 하나(ibqCloseOthers 문법).
- 검증: acorn 문법검사 → 학원앱은 `node sync/check_withdrawn_leak.js <file>` 10/10 → Playwright 하네스(스크래치패드 verify_ibl.js 형식)로 새 화면 열기·주요 함수 호출·오류 0.
- 비밀번호·API 키·학생 실명 데이터는 커밋하지 않는다. 학생앱은 배포하지 않는다(student_v1.html 손대지 않음). parent.html 손대지 않음.
