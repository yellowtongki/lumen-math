# 인수인계 — 인스타·당근 자동화 (2026-10-11)

> **새 세션은 이 문서부터 읽으면 됩니다.** 맥미니 로컬 세션용입니다.

## 0. 가장 먼저 — 글도 도구도 **main 에 있다** ⚠️ (2026-10-17 갱신)

```
cd ~/lumen-math
git fetch origin main && git checkout -B blog-latest origin/main
```

- 예전에는 `claude/gallant-ride-nddobc` 가지에 있었다. **지금은 아니다.** 그 가지를 뒤지면
  옛 커밋이 나와 틀린 숫자로 글이 나간다 (2026-10-17 실제로 그랬다)
- 글 폴더: `blog/2026-10-11-janghak-card` · `blog/2026-10-12-janghak-standard` ·
  `blog/2026-10-14-beombak-h1-exam`
- **네이버에 넣기**: `node sync/naver_draft.js [글 폴더]` — 폴더를 안 적으면 가장 최근 글
  - 로그인은 `sync/_naver_profile/` 에 남아 있다(2026-10-11에 해 둠). 다시 안 물어본다.
    지워졌을 때만 `--login`
  - **지도·톡톡도 자동**이다. 「손으로 넣어야 한다」는 옛 판 설명이다
  - 발행은 하지 않는다. 임시저장까지만
  - 미리 보기만: `--dry`

## 0-2. 예전 브랜치 이야기 (지난 기록)

지금까지의 블로그 자동화 작업은 **`claude/gallant-ride-nddobc`** 가지에 있습니다.
`main` 에는 없습니다. 세션을 열면 먼저 이걸 확인하세요.

```
cd ~/lumen-math
git branch --show-current          # main 이면 아래를 실행
git fetch origin claude/gallant-ride-nddobc
git checkout -B blog-latest FETCH_HEAD
```

## 1. 지금까지 만든 것 (전부 돌아갑니다)

| 도구 | 하는 일 | 상태 |
|---|---|---|
| `sync/blog_topics.js` | Supabase에서 글감 뽑기 | ✅ |
| `sync/card_render.js` | cards.json → 1080×1350 PNG (8종 + external) | ✅ |
| `sync/post_check.js` | 발행 전 23항목 검사 | ✅ |
| `sync/naver_draft.js` | **네이버 블로그 글쓰기 자동화 → 임시저장** | ✅ 2026-10-11 완주 |
| `sync/serp_check.js` | 검색 순위 점검 (맥 전용) | 돌려본 적 없음 |
| `sync/keyword_volume.js` | 네이버 검색광고 API 검색량 | 키 없어 미검증 |
| `sync/image_gen.js` | GPT 배경 그림 | 클라우드에서 막혀 미검증 |

쓰는 법: `blog/README.md` · `docs/naver_draft_사용법.md`
말투·규격 규칙: `docs/lumen_blog_profile.md` ← **글 쓰기 전 반드시 읽을 것**

## 1-2. 열쇠(환경변수) 먼저 — 이게 없으면 학원 데이터를 못 읽는다 ⚠️

클라우드 세션에는 `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` 가 등록돼 있지만
**맥미니에는 없습니다.** 그래서 「클라우드라야 학원 데이터를 쓸 수 있다」고 보이지만,
사실은 열쇠만 옮기면 맥미니에서도 똑같이 됩니다.

```
cd ~/lumen-math
cp .env.example .env        # 값을 채운다 (Supabase 대시보드 → Settings → API)
set -a; source .env; set +a # 터미널마다. ~/.zshrc 에 넣어두면 자동
```

확인:
```
node sync/blog_topics.js --days 7
```
→ `docs/blog_topics_latest.md` 가 생기면 성공입니다.

> `.env` 는 `.gitignore` 에 걸려 있어 커밋되지 않습니다. **값을 `.env.example` 에 적지 마세요.**

## 1-3. 열쇠는 어디에 두나 (깃허브가 아니다) ⚠️

**저장소는 공개(public)다.** 키를 코드나 파일에 적으면 누구나 본다. 절대 커밋하지 않는다.

| 두는 곳 | 누가 읽나 | 무엇이 들어 있나 |
|---|---|---|
| **클라우드 환경 설정**(세션 제목 줄 → 환경 메뉴 → Edit) | 클라우드 세션 | `SUPABASE_*` · `MATHFLAT_*` · `MATHSECR_*` · `PAYSSAM_*` |
| **맥미니 `.env`** (gitignore됨) | 로컬 세션 · 터미널 | 위의 것 + `NAVER_AD_*` · `OPENAI_API_KEY` · `IG_*` |

같은 키를 양쪽에 넣어도 된다. 한쪽에 넣으면 **다른 쪽은 모른다**.

### 클라우드에서도 검색량을 뽑고 싶다면
`api.searchad.naver.com` 이 네트워크 정책에 막혀 있다. 환경 설정 → Edit → Network access 의
Allowed domains 에 그 호스트를 더하고(Allow package managers 는 켠 채로), 환경변수로
`NAVER_AD_CUSTOMER_ID` · `NAVER_AD_API_KEY` · `NAVER_AD_SECRET_KEY` 를 등록하면
**클라우드 세션이 직접 `node sync/keyword_volume.js` 를 돌릴 수 있다.** (새 세션부터 반영)

> 검색광고 **API** 는 공식이라 데이터센터 IP도 괜찮다. 그러나 네이버 **블로그 글쓰기·검색 순위 점검**은
> 여전히 로컬이라야 한다(캡차).

## 2. 다음 할 일 — 인스타 업로더 (`sync/insta_upload.js`)

### 먼저 확인해야 하는 것
- 인스타 계정이 **프로페셔널(비즈니스/크리에이터)** 인가
- **페이스북 페이지가 연결**돼 있는가
- 둘 다 아니면 Graph API를 못 씁니다. 전환은 무료, 몇 번 누르면 됩니다

### 설계
- **Instagram Graph API** (공식). 브라우저 자동화 아님
- 캐러셀은 **최대 10장**. 우리 카드가 12장인 글도 있으니 10장을 골라 올립니다
- API는 파일 업로드가 아니라 **공개 이미지 URL**을 받습니다
  → 카드 PNG가 `https://yellowtongki.github.io/lumen-math/blog/<폴더>/cards/01_photo.png` 로
    열려야 합니다. **그래서 main 에 병합돼 있어야 합니다** (아래 4번)
- 토큰은 환경변수로만. 저장소에 넣지 않습니다

## 3. 그다음 — 당근 (마지막에)

공식 API가 없어 브라우저 자동화뿐입니다. 네이버보다 자동화에 민감하니
**인스타를 끝내고** 손대세요. 비즈프로필 소식 글쓰기까지만, 자동 발행은 하지 않습니다.

## 4. 원장님께 여쭤야 하는 것

- **main 병합 여부**: 인스타가 공개 URL을 쓰므로 카드가 main(GitHub Pages)에 있어야 합니다.
  병합은 사이트에 바로 반영되므로 **원장님 결정 사항**입니다
- 인스타 계정 종류 (위 2번)

## 5. 절대 어기지 않는 규칙 (전 채널 공통)

- 학교 **기출**을 드러내지 않는다 — 「루멘수학 시험대비자료」로 바꿔 말한다
- **외부 서비스 이름**(매쓰플랫·수학비서·클래스바이·크래빗)을 글·카드·태그에 쓰지 않는다
- 학생 **이름·개별 점수·얼굴·연락처** 금지. 집계·익명만. `blog/` 는 공개 저장소다
- **자동 발행 금지.** 네이버는 임시저장까지, 인스타·당근도 올리기 전 원장님 확인
- 비밀번호·API 키는 **환경변수만**. 커밋 금지
- `student_v1.html` · `parent.html` 고정 주소는 **원장 지시 없이 건드리지 않는다**

## 6. 2026-10-11에 배운 것

`docs/naver_draft_사용법.md` 맨 끝 표를 보세요. 아홉 가지 증상과 진짜 원인이 적혀 있습니다.
핵심 교훈 하나: **성공했다고 말하기 전에 확인한다.** 눌렀다고 된 것이 아니다.
