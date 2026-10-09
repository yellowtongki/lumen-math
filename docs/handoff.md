# 🔁 세션 인수인계 (마지막 갱신 2026-10-07 저녁)

새 세션은 **이 문서를 먼저 읽고** 시작한다. 설명은 원장님께 한국어로, 비개발자가 알아듣게 한다(CLAUDE.md).
큰 주제 하나가 끝나거나 자동 압축이 1~2번 일어나면 원장님이 「인수인계해줘」라고 한다. 그때 이 문서를 갱신하고 새 세션으로 넘긴다.

## 1. 지금 버전 (서버 `lumen_store.app_latest` 와 같다)
| 앱 | 최신 파일 | 고정 주소(사용자가 여는 곳) |
|---|---|---|
| 학원앱 | `lumen_v19-91.html` | `lumen_v1.html` = v19-91 (Claude가 배포 때 같이 바꾼다) |
| 학생앱 | `student_v2-131.html` | `student_v1.html` = v2-131 (**「학생앱배포」 지시가 있을 때만** 바꾼다) |
| 학부모앱 | `parent_v1-35.html` | `parent.html` = v1-35 (**원장님 명령 때만**) |

## 2. 학원앱 만드는 법 — 조립 도구 `sync/appbuild/`
학원앱은 «바탕 `lumen_v19-42.html` + 기능별 부품(modules/) + 버전별 고침(build_app.py 의 `if int(ver)>=NN:` 블록) + 버전 메모(memos/)» 로 **조립**한다.
결과 html 을 손으로 고치지 말고, 부품이나 build_app.py 를 고친 뒤 다시 조립한다.

```
python3 sync/appbuild/build_app.py v19-92          # 저장소 맨 위 폴더에서 → lumen_v19-92.html
NODE_PATH=node_modules node sync/appbuild/syntax.js lumen_v19-92.html   # 문법 검사
```
- 새 버전 = ① 부품 고치기/새 부품(modules/xxx.js, build_app.py 위쪽 `xxx=open(SP+'/xxx.js')...if ver>=NN` + 이어 붙이는 줄에 추가) ② 필요하면 `if int(ver.replace('v19-',''))>=NN:` 블록에 `rep(옛 글자, 새 글자)` ③ `memos/memo_19NN.txt` (버전 기록 한 줄, 원장님 말로) ④ 조립 ⑤ 검사.
- `rep()` 는 옛 글자가 정확히 1번 있어야 통과한다(아니면 멈춘다).
- 같은 이름의 함수를 뒤 부품에서 다시 정의하면 뒤 것이 쓰인다(예: wksplit_teacher.js 가 plrGridHead 를, sgview_teacher.js 가 rSungong 을 바꿈).
- 2026-10-07 확인: 저장소 도구로 v19-91 을 다시 조립하면 배포된 파일과 **바이트까지 같다**.
- 학생앱은 조립이 아니라 «바로 앞 버전 복사 + rep 고침»: 예시 `sync/appbuild/build_student_example.py` (v2-130 → v2-131). 학생앱 모듈은 ES5만, 중첩 템플릿 리터럴 금지.

## 3. 배포 순서 (GitHub Pages = main)
1. 작업 브랜치에 커밋·푸시.
2. main 반영은 작업 폴더 밖에서: `git worktree add -B deploy-X <임시폴더> origin/main` → 새 파일 복사(학원앱이면 `lumen_v1.html` 도 새 파일로) → 커밋 → `git push origin deploy-X:main` → worktree·브랜치 지우기.
3. 최신본 기록(안 하면 원장님 기기가 옛 버전에 머문다):
   `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node sync/appbuild/app_latest.js teacher lumen_v19-92.html "메모"`
   학생앱배포 때는 `student student_v2-132.html`.
4. 커밋 끝 두 줄: `Co-Authored-By: …` · `Claude-Session: …` (세션 안내 그대로). 커밋·코드에 모델 이름 넣지 않음.

## 4. 검사
- 브라우저: Playwright (`/opt/pw-browsers/chromium`), 외부망은 막고 Supabase 는 가짜로 흉내. 예시 `sync/appbuild/tests/`:
  `test_v1991.js`(주간 점수 20점 · 입력 표 · 학생앱), `verify_v1987.js`(태블릿↔PC 등록부 맞추기 · 시작 다운로드 제외 — 실제 supabase-js + 가짜 서버), `test_v1989.js`(순공 점수판, 실서버에서 읽기만).
  실행: `SP=<임시폴더> NODE_PATH=node_modules node sync/appbuild/tests/verify_v1987.js lumen_v19-91.html` (파일 이름은 새 버전으로 바꿔 쓴다).
- 실서버로 앱을 띄울 때는 **쓰기(POST/PATCH/DELETE)를 반드시 막는다**.
- 커밋 전: 학생 실명·점수·전화·열쇠가 새로 들어가지 않았는지 검사(등록부 이름 목록으로 grep). 메모·문서·테스트에도 실명 금지 — 2026-10-07 memo_1988 에 두 학생 이름이 들어갔다가 지웠다.

## 5. 최근 결정 (2026-10-05 ~ 10-07)
- **플래너 매일 10점 (A안, 10/1부터)**: 제출 4 · 타임테이블 2 · 실천 1 · 구체 1 · 자기 피드백 2. 기준표는 서버 `planner_rules` 한 곳 (docs/planner_score_v2.md §6).
- **주간 점수 20점 (10/7)** = 📅 주간계획 10 (다음 주 계획 5·월요일 2 + 실천 70%↑5·40%↑3·하나라도 1) + 📔 순공피드백 10 (사진 5·월요일 2 + 종이 5·그 주 안 2). `PW.PT`·`PW.MAX` (modules/plweek_core.js, 학생앱에도 같은 글자). 세부 5/2·5/3/1 배분은 Claude가 정했다 — 원장님이 바꾸자고 하면 그 두 곳만 고친다. §9.
- **순공피드백은 «종이에 적힌 주» 칸에** — 학생앱이 지난 주/이번 주를 고른다. 원장님 사진 점수 손 고침 = `plweek_paper.byCode[코드][주].pov`. 순공피드백 화면은 «점수판»(1~2달, 칸마다 0~10).
- **숙제체크 태블릿↔PC**: 등록부(or_studentdb)는 올리기 직전 서버 것을 합친다 · 숙제체크 화면 30초마다 확인 · 「☁️ 지금 받아오기」 · 칸마다 시각(`lumen_hw_at`) (docs/studb_multi_device.md).
- **앱 시작 다운로드 76MB → 15MB**: `PULL_SKIP_PREFIX/KEYS` — 앱이 서버에서 바로 읽는 큰 키는 시작 때 안 받는다. **새 큰 키를 만들면 이 목록에 넣을 것.**
- **전국 등수**: 학생앱엔 «신청한 학생만» 가능(`wk_pub.natMode`, `natopt_<코드>`).
- **매쓰플랫은 동시 접속 가능** — 「접속이 끊길 수 있다」 경고 금지.
- 카드뉴스·기출 DB(화면엔 「기출 DB」, 「수학비서」라는 말 금지), 적중 분석: docs/exam_hit_contract.md §9.

## 6. 남은 일
- (원장 확인 대기) 주간 점수 세부 배분 5/2 · 5/3/1 이 괜찮은지.
- (원장) 공지 「📒 플래너 점수 안내」는 서버에서 고쳤다 — 학원앱을 새로고침한 뒤에만 공지를 편집할 것(켜 둔 옛 화면이 덮을 수 있음). 공지가 10/31까지·고정 아님.
- (원장) 타임테이블 「이렇게 쓰면 돼요」 예시 사진을 주시면 학생앱 제출 화면에 넣기.
- **옛 버전 메모에 학생 실명 약 68곳** (v19-42 바탕부터 있던 것, 공개 저장소). 지우려면 옛 파일 수정이라 원장 승인 필요 — 승인 나면 memos·바탕·최신 파일에서 이름을 ○○○로.
- 시작 다운로드 남은 큰 것: 리포트 달 서랍(`or_students_YYYY-MM`, 약 5MB) — 옛 달 제외는 rmPushMonthly 안전 확인 뒤.
- 등록부 «한 값짜리» 칸(반·연락처 등)은 아직 «이 기기 우선» — 여러 기기에서 같은 학생을 동시에 고치면 늦게 올린 쪽이 이긴다.
- 이전부터: 진학 나침반 2단계(상의), 학교알리미 수집(ALRIMI_KEY 필요), 캐릭터·XP 통일안(상의), 스터디 코디 1차, 블랙반, 카드뉴스 아이디어 목록.

## 7. 비밀·규칙 (요약 — 전체는 CLAUDE.md)
- 환경변수만: MATHFLAT_ID/PASSWORD · MATHSECR_ID/PASSWORD · PAYSSAM_ID/PASSWORD · SUPABASE_URL/SUPABASE_SERVICE_KEY · LUMEN_TEACHER_KEY · NEIS_KEY · ALRIMI_KEY · VAPID_PRIVATE_KEY · ANTHROPIC_API_KEY. 값은 어디에도 적지 않는다.
- 공개 저장소: 학생 이름·점수·전화를 커밋·Actions 로그에 남기지 않는다. 학생앱으로 나가는 이름은 별명 또는 ○○○.
- 학습지·시험지 그림과 분석은 학생앱에 띄우지 않는다. exam_images 버킷 비공개.
- 서버 구조 바꾸는 SQL·수만 건 일괄 갱신은 새벽에만(19~23시 금지).
- 옛 버전 파일 수정·삭제는 원장 지시 때만. 새 스크립트는 sync/, 문서는 docs/.
- 원장님 질문·상의에는 코딩 전에 먼저 답한다.
