# ✍️ 굿노트 필기본 자동 배치 + 받은함 (원장 지시 2026-09-15 「일단 코딩」)

시안: docs/mockup_handsol_auto.html (디자인은 나중에 고친다). 굿노트→드라이브 백업 연동(3단계)은 원장이 계정을 연결한 뒤 따로.
1단계 학원앱 v19-6: **필기본 PDF 올리기 → 교재 고르기 → 자동 배치 → 📥 받은함 → 승인 뒤 공개.**
2단계 학생앱 v2-86: 손풀이 카드 개편(문제 그림 · 크게 보기 · 회전 · 틀린 문제부터).

## 0. 이미 있는 것 (lumen_v19-5)
- 교재 PDF 등록부 `book_pdfs.byBook[bid]={path,url,pdfPages,offset}` · `bkhDoc(bid)`(pdf.js, 조각 읽기) · `bkhRenderPage(bid, 인쇄쪽)`(가로 1000px 캔버스; 인쇄쪽 = PDF쪽 + offset).
- 문항 사각형 `book_boxes_<bid>.pages["<인쇄쪽>"]={wpid,cols,boxes:[{n,x,y,w,h(0~1 비율),ids,ok}],auto,at}` · 자동 배치 `bkhAnchors(cv)`(회색+색 숫자 닻) · `bkhBoxesFromAnchors` · `bkhEvenBoxes` · 매쓰플랫 문항 묶음 `bkhGroups(pageRec)`.
- 풀이 저장 `hand_solutions.items[id]={src:'book',srcKey:'book|bid|쪽|번호',bid,page,num,ids,img,title,ord,vid,…}` (`bkhAssign` 참고, `hslData()/hslSave()`), 그림은 Storage `aha_photos/hand/book/<bid>/…jpg`.
- 잉크 뭉치 `hslInkGrid/hslInkClusters`(색 픽셀 격자) — 여기서는 **원본과의 차이(diff)** 로 잉크를 뗀다(아래 2-2).

## 1. 저장 (새 키)
`book_inbox_<bid>` = `{ bid, updated, items:[ {
   id, kind:'page'|'extra',         // 교과서 위 필기 | 별지(원본에 없는 끼운 쪽)
   page, num,                        // 인쇄쪽 · 번호(별지는 후보 중 1순위, 없으면 '')
   ok:true|false,                    // true = 번호 확실(전부 승인 대상)
   cands:['9','8'],                  // 별지·애매한 경우 후보 번호
   img, qimg,                        // 풀이 조각 URL · 문제 그림 URL(원본 상자 크롭; 없으면 '')
   box:{x,y,w,h}, ink:{x,y,w,h},     // 0~1 비율(상자·잉크 bbox) — 「✎ 상자」로 갈 때 참고
   srcFile, pdfPage, at,
   status:'pending'|'approved'|'rejected', solId } ] }`
- 승인하면 `hand_solutions`에 `bkhAssign`과 같은 모양으로 항목을 만들고(`title` 빈 값, `ord`=같은 번호 기존 풀이 수, **`qimg` 칸 추가**), `status:'approved', solId` 기록. 거부는 `rejected`. 받은함 목록에는 pending만, 「승인됨」 접이식에 최근 3일 approved.
- 문제 그림 `qimg`: 원본 쪽에서 그 번호 상자를 2배(가로 2000px 기준)로 잘라 `aha_photos/hand/book/<bid>/q_<쪽>_<번호>.jpg` 에 **upsert**(같은 번호는 한 번만).

## 2. 자동 배치 절차 (`bkhAutoRun(bid, fileOrUrl)`, 전부 브라우저 안·AI 없음)
2-1. **쪽 맞추기** — 필기본 쪽 j마다 원본 쪽 후보(직전에 맞은 쪽 i 기준 i-1~i+2, 첫 쪽은 1~3)와 견준다. 견주기: 둘 다 가로 100px 회색조로 줄여 픽셀 차 평균(잉크는 몇 % 밖에 안 되므로 배경이 결정). 차이가 작으면(예 ≤ 18/255) 그 쪽으로 매핑, 아니면 **별지**(`kind:'extra'`, 앞에 맞은 인쇄쪽 P에 붙는다). 쪽수가 같으면 1:1 가정을 먼저 확인하고 통과하면 그대로.
2-2. **잉크 떼기** (`kind:'page'`) — 같은 가로 1000px로 두 쪽을 그린 뒤 픽셀별 차이: 원본 어두운 픽셀을 1px 부풀린 마스크는 무시하고, 나머지에서 |필기−원본| > 60 인 픽셀 = 잉크. 잉크 픽셀이 200개 미만이면 「필기 없음」으로 건너뛴다.
2-3. **뭉치 → 번호** — 잉크 마스크를 20px 격자로 뭉친다(`hslInkClusters` 방식, 격자 값 > 3). 그 쪽의 상자(`book_boxes`; 없으면 `bkhAuto` 규칙으로 자동 배치해 `auto:true`로 저장)와 겹침 넓이가 가장 큰 상자에 붙인다. 겹침이 없으면 가장 가까운 상자(세로 거리 우선). 2위 상자와의 겹침이 1위의 35% 이상이면 `ok:false, cands:[1위,2위]`.
2-4. **조각 자르기** — 같은 상자에 붙은 뭉치를 합쳐 `상자 ∪ 잉크 bbox`에 여백 3%를 더한 영역을 **2배 해상도(가로 2000px 렌더)** 에서 잘라 JPEG(0.86)로 `aha_photos/hand/book/<bid>/<쪽>_<번호>_<ts>.jpg`. 크기 상한 긴 변 2400px.
2-5. **별지** — 별지 캔버스에 `bkhAnchors`를 돌려 인쇄 번호 후보를 읽고, 앞쪽 P(와 P±1)의 상자 번호와 맞는 것만 `cands`. 후보가 정확히 하나면 `ok:true`(칩 「별지 · 번호 읽음」), 아니면 `ok:false`. 조각 = 별지에서 흰 여백을 뺀 내용 bbox 전체(2배).
2-6. **중복** — 같은 교재 받은함에 같은 `page·num`의 pending이 있으면 새로 안 만든다. approved가 있고 `srcFile`도 같으면 건너뛴다(같은 파일 재실행). 다른 파일이면 새 항목(승인 시 방법 N으로 쌓임).
2-7. 진행 표시 「쪽 12/188 · 조각 7」, 취소 가능. 끝나면 받은함으로 이동. 실패한 쪽은 건너뛰고 끝에 알려 준다.

## 3. 학원앱 화면 (v19-6)
- 손풀이 › 📚 교재 탭 머리에 **「🪄 필기본 자동 배치」** 단추 → 창: ① 교재 고르기(분류 칩 + 검색, `bkhBookList` 재사용; PDF 등록된 교재만 고를 수 있음) ② 파일: 「내 컴퓨터」 또는 「☁️ 올린 파일」(`school_pdfs/book/` 목록 재사용; 새로 올리는 파일은 `school_pdfs/ink/<ts>_<슬러그>.pdf`) ③ 「시작」.
- 손풀이 탭 줄에 **「📥 받은함 N」** 추가(교재 옆). 화면: 교재별 접이식 → 쪽 순서 카드(시안대로 「문제 | 풀이」 나란히, 칩: 교과서 위/별지 · 번호 확실/번호 확인 · 방법 N). 머리: 「확인 필요만」 필터 · 「✓ 전부 승인 (n)」(ok:true만) · 「🔍 상자 고쳐 다시 배치」(그 쪽 작업대 `bkhOpenPage`로). 카드 단추: ✓ 승인 · 번호 고르기(별지/애매: 그 쪽 번호 드롭다운) · ✎ 상자 · 🎬 영상(승인 뒤 기존 `bkhSolVid`) · ✕.
- 승인 시 `hand_solutions` 항목의 `ids`는 그 쪽 상자의 `ids`(매쓰플랫 문항 id)를 넣는다(학생앱이 채점 기록과 잇는 데 씀).
- `APP_VER='v19-6'` + 버전 메모(원장님용 한국어: 어디에 무엇이, 절차, 별지 규칙, 승인 뒤 공개, 드라이브 연동은 다음 단계).

## 4. 학생앱 (v2-86) — 손풀이 교재 화면(`hsb*`) 개편
- 문제 카드: 위에 **문제 그림(`qimg`)**, 아래 「✍️ 선생님 풀이 · 방법 1」 그림(가로 꽉, `object-fit:contain`), 오른쪽 아래 「🔍 크게」. 단추 줄: 「🔍 크게 보기」 「🎬 영상 m:ss」(vid 있으면) 「🔁 다시 풀기」(기존 재풀이 경로 있으면 연결, 없으면 숨김).
- **크게 보기**: 전체 화면 검정 배경, 두 손가락 확대(포인터 이벤트로 scale·translate, 1~5배)·끌기·더블탭 2배, 「↻ 회전」(90°씩), 방법이 여럿이면 좌우 밀기·「방법 2 ›」. 세로가 긴 그림은 처음에 화면 폭에 맞춘다.
- 쪽 안 순서: **내 채점 ✗ 문항 먼저**(`hw_scores` r:'X'), 그다음 번호순. 카드 머리에 「6번 · 내 채점 ✗」.
- 공개 규칙(`book_cfg` reveal/hidden)은 지금 그대로.
- `STU_VER='v2-86'` + 버전 메모 한 줄.

## 5. 검증
- 학원앱 하네스: fixture 교재 PDF = 스크래치패드 `book_test5.pdf`(5쪽). 필기본 = 같은 PDF를 pdf-lib로 복사해 2쪽에 파란 선 몇 개(잉크)를 그리고 3쪽 뒤에 빈 쪽 하나를 끼워 넣어(별지: 2쪽 일부를 잘라 붙이고 잉크 추가) 만든다(`sync/_debug/`가 아니라 스크래치패드에). 검사: 쪽 맞추기(6쪽→5쪽+별지 1), 2쪽 잉크가 상자 번호에 붙어 pending 항목 생성·img 업로드 요청·qimg upsert, 별지 항목 kind:'extra'와 cands, 「전부 승인」 뒤 hand_solutions에 항목·qimg 포함, 중복 재실행 시 새 항목 0. 퇴원생 10/10.
- 학생앱 하네스: fixture hand_solutions에 qimg 있는 항목 2개(방법 1·2) + hw_scores ✗ → 카드 순서·문제 그림·크게 보기 열림·회전 클래스·방법 전환.
