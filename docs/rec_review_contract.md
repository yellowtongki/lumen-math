# 🎙 녹음 숙제 새벽 자동 읽기 · 훑어보기 · 학부모앱 표시 — 계약서 (2026-10-23)

원장 결정(10/22~23): 「소리는 비공개 유지 · 안 A로 진행 · 학부모앱은 배포하지 않는다(새 버전 파일까지만) · 코딩은 오퍼스로」.
시안: `docs/mockup_rec_review.html`(원장 화면) · `docs/mockup_parent_rec.html`(학부모앱 안 A).
이 문서는 세 부분(새벽 스크립트 · 학원앱 v19-152 · 학부모앱 v1-36)이 **같은 자료 모양**을 쓰도록 정한다. 바꾸려면 여기부터 고친다.

## 0. 지금 있는 것 (바꾸지 않는다)
- 학생앱: 녹음을 Storage `recordings/<코드>/<코드>_YYYYMMDD_HHMM.<webm|m4a|mp3>` 에 올리고 lumen_store `submissions_<코드>` 배열에 `{id:'YYYYMMDD_HHMM', title, type, fileUrl, photoUrls, submittedAt}` 를 더한다. **녹음 날짜 = 파일 이름의 YYYYMMDD(한국 시각)**.
- 그날 주제(학생앱이 보여 주는 우선순위 그대로): ① 등록부 `lumen_rec_mission`(원장 수동 미션, `/` 로 여러 개) ② `rec_topics.byStudent[코드]['YYYY.MM.DD'].t` ③ `rec_topics.byGrade['중2']['YYYY.MM.DD'].t` (+`.g` 힌트). ②③은 그 날짜 키가 없으면 **7일 안 가장 가까운 지난 날짜**(학생앱 rtBestTopic). 셋 다 없으면 «자유 제출».
- 학년 키: 등록부 `grade`(예 '중학교 2학년') → `(\d)\s*학년` + 초등/고등/그 외 중 → '초6'·'중2'·'고1' (ultra_night_writer.js `gradeKey` 와 같은 규칙).
- 수업 요일: lumen_store `lumen_group_days` {반:[요일 숫자, 0=일]} · 학생 `group`. 없으면 월수금 [1,3,5].
- 학원앱 녹음 팝업 손 받아쓰기: 등록부 `lumen_recordings[파일].stt/sttAt/feedback`. **서버 스크립트는 등록부(or_studentdb)에 절대 쓰지 않는다.**
- 학부모앱: 녹음 소리·전문은 어디에도 안 나간다(v1-9 결정 유지).

## 1. 서버 자료 (lumen_store)
### 1-1. `rec_read_<YYYY-MM-DD>` — 새벽 스크립트가 쓴다 (날짜 = 녹음 날짜)
```json
{ "date":"2026-10-21", "updated":"ISO", "model":"gemini-2.5-flash-lite",
  "items": { "<코드>": [ {
      "file":"ABC123_20261021_2130.webm", "code":"ABC123", "grade":"중2", "sec":222,
      "topic": { "t":"일차함수의 기울기와 y절편 설명해 보기", "src":"mission|student|grade|free" },
      "title":"학생이 적은 제출 제목",
      "stt":"전문(한국어)", "sttSrc":"gemini|manual",
      "summary":"두 줄 요약(80자 안)", "match":"ok|part|off|short|free",
      "why":"판정 근거 한 줄", "missing":"빠진 개념(part 일 때, 아니면 빈 글)", "err":"개념을 틀리게 말한 곳 한 줄(없으면 빈 글)",
      "at":"ISO" } ] },
  "byGrade": { "중2": { "n":6, "brief":"여럿이 똑같이 헷갈린 것 한 줄(80자 안)" } },
  "fail": { "<코드>": ["파일", "..."] } }
```
- `match` 규칙: `sec<30` 또는 전문이 비었거나 «[녹음 내용 없음]» → `short`(판정 호출 안 함) · 주제 없음 → `free`(요약·err 만) · 나머지는 AI 판정 ok/part/off.
- `sec` = Gemini 응답 `usageMetadata.promptTokensDetails` 의 AUDIO tokenCount ÷ 32 (반올림). 못 구하면 null.
- 손 받아쓰기(등록부 stt)가 있으면 Gemini 받아쓰기를 건너뛰고 그 글로 판정만(`sttSrc:'manual'`).
- 한 학생이 하루 두 개 올리면 배열 두 칸. 다시 돌려도 같은 파일은 건너뛴다(`--force` 면 다시).
- `rec_read_last` = `{ at, dates:[…], made, fail, tokens:{audio,text}, model }` (학원앱 머리줄 「새벽 읽기 …」).

### 1-2. `rec_review_<코드>` — 학원앱(원장)이 쓰고 학부모앱이 읽는다
```json
{ "byDate": { "2026-10-21": { "file":"…", "ok":true, "at":"ISO", "msg":"한마디(없으면 빈 글)",
                               "sec":222, "topic":{ "t":"…", "src":"grade" } } },
  "updated":"ISO" }
```
- 날짜마다 한 칸(두 개 올린 날은 마지막에 확인한 파일). **확인 때 sec·topic 을 함께 복사**해 두어 학부모앱이 `rec_read_*` 를 읽지 않아도 된다(다른 학생 전문이 든 키를 학부모앱이 읽지 않게).
- 확인 취소 = 그 날짜 칸 삭제. 쓰기 전 최신본을 읽어 byDate 를 합친다(다른 기기).
- 학원앱 `PULL_SKIP_PREFIX` 에 `'rec_read_'`, `'rec_review_'` 를 더한다(시작 다운로드 제외 · 화면이 서버에서 바로 읽음).

## 2. 새벽 스크립트 `sync/rec_night_reader.js` + `.github/workflows/rec-night.yml`
- 비밀값: `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `GEMINI_API_KEY`(원장이 GitHub Secrets 에 넣음). 모델 `REC_MODEL` 기본 `gemini-2.5-flash-lite`, 404/모델 오류면 `gemini-2.5-flash` 로 한 번 더.
- 예약: 매일 UTC 20:10 = **한국 05:10**(Ultra 04:50 뒤). concurrency `rec-night`. timeout 60분. node 22, npm install 없음(내장 fetch).
- 옵션: `--days N`(기본 3: 어제부터 N일) · `--date YYYY-MM-DD`(그 날만) · `--max N`(기본 80건) · `--codes A,B` · `--dry`(대상 목록만, API·저장 없음) · `--force`.
- 순서: ① 등록부(재원·코드 있는 학생) ② 학생마다 Storage 목록 `POST {SB_URL}/storage/v1/object/list/recordings` {prefix:'<코드>/', limit:200} ③ 파일 이름 날짜가 [오늘-days, 어제] 인 것 중 아직 없는 것 ④ 내려받기 `GET {SB_URL}/storage/v1/object/recordings/<코드>/<파일>`(service 헤더) → base64 inline(20MB 넘으면 fail 에 적고 건너뜀) ⑤ Gemini 받아쓰기(v1beta generateContent, inline_data, mime 은 확장자로: webm→audio/webm, m4a/mp4→audio/mp4, mp3→audio/mp3, wav, ogg) ⑥ 주제 찾기(§0) ⑦ 판정 호출(글만, JSON 한 줄 `{summary,match,why,missing,err}`) ⑧ 학생 한 명 끝날 때마다 `rec_read_<날짜>` 최신본 읽어 합쳐 저장(중간에 끊겨도 남게) ⑨ 날짜·학년마다 항목 2개 이상이면 brief 한 번 ⑩ `rec_read_last`.
- 429/503/529 는 8·16·24·32초 뒤 최대 4번. 한 건 실패는 fail 에 적고 계속. Supabase 못 읽거나 키 없으면 exit 1.
- 받아쓰기 지시: 「수학 학생이 개념을 말로 설명한 녹음. 한국어로 들리는 대로 전사. 수식은 글로(x의 제곱, 2분의 1). 말이 없거나 2~3마디뿐이면 "[녹음 내용 없음]"」.
- 판정 지시(요지): 주제·학생 제목·전문을 주고 — ok: 주제의 핵심을 자기 말로 설명 · part: 주제를 다루되 핵심 일부가 빠짐(missing 에 빠진 것) · off: 다른 내용. err 는 «수학적으로 틀리게 말한 곳»만 한 줄, 없으면 빈 글. summary 는 학부모도 읽을 수 있는 중립 문장 2줄(80자 안), 학생 이름 쓰지 않음.
- 로그: 날짜·건수·실패 수·토큰 합(비용 어림)만. **이름·코드·전문은 로그에 안 남긴다**(Actions 로그 공개).
- 검사 `sync/test_rec_night.js`: fetch 를 가짜로 바꿔(가짜 Supabase·Gemini) 날짜 거르기 · 주제 우선순위 · short 규칙 · 합치기 · 손 받아쓰기 건너뛰기 를 확인. 함수는 `module.exports` 로 내보낸다(`require.main===module` 일 때만 실행).

## 3. 학원앱 v19-152 — 녹음관리 › 👀 훑어보기 (`sync/appbuild/modules/recreview152_teacher.js`)
- 함수 이름 접두 `rr152`. 문자열 연결만(템플릿 리터럴 금지). 다른 부품처럼 바탕 함수를 감싸거나 build_app.py `>=152` 블록의 `rep()` 로 꽂는다(옛 글자는 정확히 1번 있어야 함):
  - 왼쪽 메뉴 `{id:'grid',    icon:'📅', label:'그리드'},` 앞에 `{id:'review', icon:'👀', label:'훑어보기'},`
  - `rRecMgr` 의 `if (REC_MGR_VIEW === 'grid')         body = rRecMgrGrid();` 앞에 review 가지
  - 녹음관리 들어갈 때 기본 화면: `REC_MGR_VIEW='grid'; }},` → `'review'`
  - 그리드 ✅: `var hasStt = !!savedRec.stt;` → `|| rr152Has(code, dayFiles)` · 팝업: `if (savedRec.stt) {` 와 `savedRec.stt + '</div></div>';` 가 새벽 전문도 보이게(`rr152Stt(stCode, file.name)`), 머리에 «🌙 새벽 읽기» 표시
  - `'naver_book'];` → `'naver_book', 'rec_read_', 'rec_review_'];`
- 화면(시안 그대로): 날짜 ◀ ▶(기본 = 결과가 있는 가장 최근 날짜, 없으면 어제) · 칩 «전체 / 주제 다름만(part·off·short) / 아직 안 본 것» · 요약 숫자 5칸(제출 · ✅ · ⚠️ · ❌🔇 · 미제출) · 학년 섹션(초→중→고, 숫자 순): 그날 학년 주제(없으면 «없음(배정 안 됨)») · 🧭 brief · 카드(이름 · m분 s초 · 배지 · summary · why/missing/err 줄 · ▶ 듣기(카드 안 `<audio controls>` 열기, getRecordingUrl) · 📄 전문 펼치기 · ✓ 확인 · 💬 한마디 칩) · 그 학년 미제출 명단(그날이 수업일인 학생 중 항목 없음).
- 한마디 칩(판정별 먼저): ok → 「주제대로 잘 설명했어요」「예시까지 들어 좋았어요」 · part → 「다음엔 <missing>도 같이」「핵심은 잘 짚었어요, 다음엔 <missing>까지」 · off → 「오늘 주제로 다시 한 번!」 · short → 「조금 더 길게, 예를 하나 들어 보자」 · free → 「스스로 설명해 본 것 좋아요」 · 항상 「✏️ 직접 쓰기」. 칩을 누르면 msg 저장 + ok:true 까지 한 번에. 확인된 카드는 흐리게 + «✓ 확인 HH:MM · 💬 msg» + 「확인 취소」.
- 머리줄: `rec_read_last` 로 «🌙 새벽 읽기 10/22 05:14 · n건 · 실패 n» + ⟳ 새로고침. 그리드 달(REC_MGR_MONTH)의 `rec_read_YYYY-MM-%` 는 `like` 로 한 번에 읽어 캐시.
- 저장: `getSupaClient()` 로 `rec_review_<코드>` upsert(쓰기 전 최신본 합침). 메모리 캐시 `RR152.review[코드]`.
- build_app.py: `rr2=open(SP+'/recreview152_teacher.js',encoding='utf-8').read() if … >=152` + 이어 붙이기 + `if >=152:` rep 블록. `memos/memo_19152.txt` 한 줄(가짜 이름만). 조립 `python3 sync/appbuild/build_app.py v19-152` · 검사 `sync/appbuild/tests/test_v19152.js`(가짜 서버: or_studentdb 가짜 학생 6명(홍길동·박하나·이순신·김유신·장보고·신사임당) · rec_topics · lumen_group_days · rec_read_2026-10-21 · rec_read_last — 화면 그려짐 · 학년 섹션·숫자 · 칩 거르기 · ✓ 확인이 rec_review_<코드> 에 sec·topic 과 함께 저장 · 취소 삭제 · 그리드 ✅ · 팝업 새벽 전문).

## 4. 학부모앱 v1-36 (`parent_v1-36.html`, 배포 안 함 — `parent.html` 손대지 말 것)
- 만드는 법: `sync/appbuild/build_parent_v136.py` (v1-35 복사 + rep + 뒤에 `modules/parent36.js` 붙이기 — 뒤에 붙인 function 선언이 앞 것을 덮는 방식, v1-35 와 같음). `PAR_VER='v1-36'`. rep 의 옛 글자는 1번만 있어야 한다.
- 읽기: 로그인 때 q1 `.in('key',[…])` 에 `'rec_topics'`, `'rec_review_'+code` 추가 → `P.rtop`, `P.rrev`. 미션은 `P.st.lumen_rec_mission`.
- 그날 주제 `p36Topic(iso)`: 확인된 날(`P.rrev.byDate[iso].topic`)이면 그것 · 아니면 §0 우선순위(mission → byStudent → byGrade, 그 날짜 또는 7일 안 가장 가까운 지난 날짜). 없으면 ''.
- ① 홈 📌 매일 확인 녹음 칸: 오늘 확인됐으면 sub 뒤에 « · ✓ 선생님 확인», 아래 작은 줄 «💬 그날 주제»(있을 때만). `p35Box` 를 parent36.js 에서 다시 선언(원본 논리 그대로 복사 + 두 줄).
- ② 숙제 탭 🎙️ 하브루타 녹음: 노란 「오늘 주제」 상자(있을 때) → 상태 상자(제출+확인: «제출 완료 · ✓ 선생님이 들었어요» + «m분 s초 · 오늘도 스스로 설명해 봤어요» / 제출만: 회색 «제출 완료 · 선생님 확인 전» / 미제출: 지금 주황 그대로) → 파란 「💬 한마디 — 선생님 한마디 · M/D 아침」(msg 있을 때) → 2주 띠 그대로 → 안내문 «🔒 녹음 소리는 선생님만 듣습니다 — 아이가 편하게 말할 수 있도록 비공개로 운영하고, 주제와 선생님 한마디만 보여 드려요».
- ③ 녹음 제출 기록(`vRec` 다시 선언): 안내문 «녹음 소리는 공개하지 않습니다 … 선생님이 듣고 남긴 한마디와 그날 주제만» · 통계 3칸 = 최근 30일 제출 · 연속 제출 · **선생님 확인(최근 30일 ok 수)** · 「최근 제출」 목록 = 날짜 · (✓ 선생님 확인 | 확인 전) · 주제(없으면 «자유 제출 · 제목») · m분 s초 · 💬 msg · 최근 5주 달력 그대로.
- 검사 `sync/appbuild/tests/test_p136.js`(가짜 서버 · 가짜 이름): 세 화면에 주제·확인·한마디가 나오고 확인 전/미제출 모양도 맞는지 · 소리 재생 요소가 어디에도 없는지(`<audio` 0개).

## 5. 비용·안전
- Gemini 2.5 Flash-Lite 음성 입력 기준 녹음 1건(4분) 약 5원. Claude 키를 쓰지 않는다.
- 공개 저장소: 메모·검사·문서에 학생 실명 금지(홍길동·박하나 같은 가짜 이름). 로그에 이름·코드·전문 금지.
- 학부모앱 고정 주소 `parent.html` 교체는 원장 지시 때만. 학원앱 v19-152 는 평소대로 `lumen_v1.html` 과 함께 배포하고 `app_latest teacher` 기록.
