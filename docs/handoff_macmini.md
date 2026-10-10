# 🖥 맥미니에서 이어서 하기 — 블로그·인스타 도구

**작성**: 2026-09-28 · **읽는 사람**: 맥미니에서 새로 연 Claude Code
**먼저 볼 것**: 이 문서 → `docs/lumen_blog_profile.md`(말투·규격 원본) → `blog/README.md`(한 편 만드는 법)

---

## 0. 왜 이 문서가 있나 — 클라우드와 맥미니의 차이

Claude Code는 **어디서 돌지**를 고를 수 있다. 클라우드 환경을 고르면 맥미니는 화면만 보여주는 창구이고,
실제 명령은 클라우드 컨테이너에서 돈다. 그 컨테이너는 **네이버·OpenAI 접속이 막혀 있고 맥미니 파일도 못 본다.**

| 하는 일 | 클라우드 | 맥미니(로컬) |
|---|---|---|
| 글쓰기 · 카드 만들기 · 저장소 작업 | ✅ | ✅ |
| **네이버** (검색 점검 · 임시저장 · 검색량 API) | ❌ 차단 | ✅ |
| **OpenAI 이미지** (배경 그림) | ❌ 차단 | ✅ |
| **인스타 Graph API** | ❌ 아마 차단 | ✅ |
| 맥미니·데스크탑 안의 파일 (클래스바이 `out` 폴더 등) | ❌ | ✅ |

> 🔑 **맥미니에서 로컬로 여는 법**: 터미널을 열고 저장소 폴더로 가서 `claude` 를 실행한다.
> (데스크톱 앱에서 열 때는 실행 위치를 «클라우드»가 아니라 로컬 폴더로 고른다)

---

## 1. 처음 한 번만 — 맥미니 준비

### ① Node.js 설치 (안 깔려 있으면 `npm: command not found` 가 난다)

**https://nodejs.org** → **LTS** 버튼 → 받아진 `.pkg` 더블클릭 → 계속 누르면 끝.
설치 뒤 **터미널을 껐다 켜고** 확인한다:

```bash
node -v        # 버전 숫자가 나오면 성공
npm -v
```

> 2026-09-28: 맥미니에 Node.js가 없어서 `npm`·`npx`·`claude` 가 전부 «command not found» 였다.
> Node.js가 먼저다.

### ② npm 설치 위치를 내 폴더로 바꾸기 (권한 오류 예방)

이걸 안 하면 다음 단계에서 **`EACCES: permission denied`** 가 난다.
npm이 시스템 폴더(`/usr/local/lib`)에 넣으려다 맥에게 막히는 것이다.
`sudo` 로 밀어붙일 수도 있지만 관리자 권한으로 깔려 나중에 또 권한 문제가 생기므로, **설치 자리를 내 폴더로 옮긴다.**

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

> 2026-09-28 맥미니에서 실제로 겪은 오류다. 한 번만 해두면 앞으로 모든 전역 설치가 편해진다.

### ③ Claude Code 설치

```bash
npm install -g @anthropic-ai/claude-code
claude --version        # 버전이 나오면 성공
```

(명령이 바뀌었으면 docs.claude.com 의 설치 안내를 따른다)

### ④ 저장소와 도구

```bash
git clone https://github.com/yellowtongki/lumen-math.git
cd lumen-math
git checkout claude/gallant-ride-nddobc      # 블로그 도구가 있는 가지
npm install                                   # Playwright 포함
npx playwright install chromium
claude                                        # ← 여기서 열면 맥미니에서 돈다
```

폰트(Pretendard)와 수식 도구(MathJax)는 **처음 카드를 만들 때 자동으로 받는다.** 따로 할 일 없음.

### ⑤ 로컬로 열렸는지 확인하는 법

```bash
node sync/serp_check.js
```

**클라우드에서는 네이버가 막혀 실패하고, 맥미니에서는 돈다.** 이게 시험대다.

---

## 2. 지금까지 만든 것 (2026-09-28 기준)

### 📁 저장소 구조

```
docs/lumen_blog_profile.md   ⭐ 학원 정보 · 말투 · 글 규격의 «원본». 글 쓰기 전에 반드시 읽는다
blog/README.md               한 편 만드는 순서 + 카드 8종 사용법
blog/<날짜-주제>/            글 한 편 = 폴더 하나
  post.md                    본문 (머리말 + 마크다운)
  post_published.md          ⭐ 원장님이 고쳐서 실제 발행한 글 — 말투 기준 0순위
  cards.json                 카드 문구
  cards/*.png                생성된 카드 (1080×1350)
  naver_paste.txt            네이버에 붙여넣을 원고
sync/card_templates/         카드 디자인 8종 + _base.css
```

### 🔧 도구 5개

| 명령 | 하는 일 | 어디서 |
|---|---|---|
| `node sync/blog_topics.js --days 7` | 학원 데이터(매쓰플랫 오답·아하노트) 집계 → `docs/blog_topics_latest.md` | 아무 데나 |
| `node sync/card_render.js blog/<폴더>` | `cards.json` → 카드 PNG. `--only N` 으로 한 장만 | 아무 데나 |
| `node sync/post_check.js blog/<폴더>` | 17항목 검사 (글자수·카드·사진·지도·해시태그·날짜·주소·개인정보…) | 아무 데나 |
| `node sync/naver_draft.js blog/<폴더>` | 네이버 글쓰기 화면에 넣고 **임시저장** (발행 안 함). 처음엔 `--login` | **맥미니만** |
| `node sync/serp_check.js` | 네이버에 검색어 10개를 쳐 보고 첫 화면에 우리 글이 있는지 → `docs/serp_latest.html` | **맥미니만** |
| `node sync/image_gen.js blog/<폴더> [--dry]` | 카드 배경 그림 (GPT). `--dry` 는 키 없이 프롬프트만 |
| **MCP `lumen-image`** | **Claude가 GPT를 직접 불러 배경을 만들고 «보고» 고친다.** `.mcp.json` 에 등록돼 있어 저장소 폴더에서 Claude Code 를 열면 자동으로 붙는다 |
| `node sync/keyword_volume.js` | 낱말별 월간 검색수 → `docs/keyword_volume.md` | **맥미니만** · 키 필요 |

### 🎴 카드 8종 (`cards.json` 의 `type`)

`cover` 표지 · `photo` **사진 배경 표지** · `qa` 질문답 · `stat` 큰 숫자 ·
`compare` 둘 비교 · `list` ①②③ · `solve` **문제→풀이→답안(수식)** · `closing` 마무리

- 사진 배경: `"bg": "bg_room.jpg"` (글 폴더 안 파일). 어두운 막이 자동으로 덮인다
- 큰 제목 색 강조: `**주황**` `__하늘__` `~~금색~~`
- 수식: `$y = x^2 - 4ax + 3$` (JSON 안에서 역슬래시는 두 번 — `\\alpha`)

---

## 3. 🔑 맥미니에 넣어야 할 키

없어도 대부분 돌아간다. 필요한 것만 채우면 된다.

| 환경변수 | 어디에 쓰나 | 발급 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | 글감 생성기 | 이미 쓰고 있는 값 |
| `NAVER_AD_CUSTOMER_ID`<br>`NAVER_AD_API_KEY`<br>`NAVER_AD_SECRET_KEY` | 검색량 조사기 | searchad.naver.com 가입(무료) → 도구 → API 사용 관리 |
| `OPENAI_API_KEY` | 배경 그림 (`image_gen.js` · MCP `lumen-image`) | platform.openai.com |
| 인스타 토큰 | (아직 안 만듦) 인스타 게시 | 메타 개발자 + 비즈니스 계정 |

> ⚠️ **키를 저장소에 넣지 않는다.** `~/.zshrc` 에 `export` 하거나 `.env`(gitignore됨)를 쓴다.

---

## 4. 한 편 만드는 순서

```
① node sync/blog_topics.js --days 7 --topic "오늘 있었던 일"
② Claude가 profile.md 말투로 post.md + cards.json 작성
③ node sync/card_render.js blog/<폴더>
④ node sync/post_check.js blog/<폴더>      ← 전부 ✅ 여야 함
⑤ 원장님이 naver_paste.txt 보고 네이버에 붙여넣고 발행   ← 아직 수동 (10분)
⑥ node sync/serp_check.js                  ← 올린 뒤 점검 기록
```

---

## 5. 다음에 할 일

| 순서 | 만들 것 | 규모 | 비고 |
|---|---|---|---|
| ~~1~~ ✅ | `sync/naver_draft.js` — 네이버 임시저장 자동화 | 2026-10-10 완성 | **맥미니 전용. 실제 네이버로는 미검증** — 첫 실행 때 오류가 나면 메시지를 Claude 에게. 사용법 `docs/naver_draft_사용법.md` |
| 2 | `sync/insta_upload.js` — 인스타 캐러셀 | 1일 | 인스타 **비즈니스/크리에이터 전환** + 페북 페이지 연결 필요 (원장님 확인 중) |
| ~~3~~ ✅ | `sync/image_gen.js` — 배경 그림 (OpenAI) | 2026-09-28 완성 | **키로 실제 생성은 아직 검증 못 함.** `--dry` 는 확인됨 |
| 4 | 쓰레드 · 유튜브 | 각 1일 | 둘 다 공식 API 있음 |
| 5 | 당근 소식 · 플레이스 리뷰 답글 | 높음 | 공식 API 없음 → 브라우저 자동화. 맨 뒤 |

---

## 6. ⚠️ 아직 검증 못 한 것 (클라우드에서 네이버·OpenAI가 막혀서)

**맥미니에서 처음 돌릴 때 오류가 날 수 있다. 나면 그 메시지를 Claude에게 그대로 주면 된다.**

| 도구 | 무엇이 불확실한가 |
|---|---|
| `serp_check.js` | 네이버 검색 화면의 링크 구조. 숫자가 이상하면 `sync/_debug/serp/` 의 화면 사진과 맞춰 본다 |
| `mcp_image.js` · `image_gen.js` | **MCP 규약과 프롬프트는 확인했다.** OpenAI 실제 호출(모델 이름·응답 형식)은 키가 없어 못 해봤다 |
| `keyword_volume.js` | 검색광고 API의 서명 방식·응답 필드 이름 |

카드 생성기·검사기·글감 생성기는 **실제로 돌려서 확인했다.**

---

## 7. 절대 하지 말 것

- ❌ **네이버 자동 «발행»** — 임시저장까지만. 발행은 원장님이. 저품질 처리는 되돌릴 수 없다
- ❌ **클라우드에서 네이버 조종** — 데이터센터 IP → 캡차
- ❌ **클래스바이 코드 복사·역난독화** — 라이선스 위반
- ❌ **학생 이름·개별 점수·얼굴** — 집계·익명 수치만. `blog/` 는 공개 저장소다
- ❌ **AI로 글자 만들기** — 한글이 깨진다. 글자는 늘 HTML로 얹는다
- ❌ **AI로 학원 내부 사진 지어내기** — 허위 광고. 배경 분위기 그림까지만
- ❌ **키·비밀번호 커밋**

---

## 8. 원장님께 아직 못 받은 답

1. **인스타 계정이 비즈니스/크리에이터로 전환됐는지** ← 2번 작업의 전제
2. 반텐 글 실사진 2번 자리(교실 뒷모습) — 없으면 그냥 넘어가도 됨
3. 교습비·등록번호 — 별도 안내 글 한 편으로 올리기로 결정됨(2026-09-28). 그 글 쓸 때 필요

---

## 9. 참고 문서

| 파일 | 내용 |
|---|---|
| `docs/lumen_blog_profile.md` | ⭐ 학원 정보 · 말투 · 글 규격 «원본» |
| `blog/README.md` | 한 편 만드는 법 · 카드 8종 사용법 |
| `blog/2026-09-20-banten/post_published.md` | ⭐ 원장님 실제 발행본 (말투 0순위) |
| `docs/lumen_blog_tool_design.md` | 설계 본문 — 왜 이렇게 만들었나 |
| `docs/handoff_blog_insta.md` | 이전 인수인계 (배경·결정 사항) |
| `docs/blog_automation_overview.md` | 클래스바이 도구 구조 (참고용, 베끼지 말 것) |
