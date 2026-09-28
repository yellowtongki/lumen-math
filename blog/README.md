# blog/ — 블로그 글 한 편이 사는 곳

글 한 편 = 폴더 하나. `blog/<날짜-주제>/` 안에 본문·카드 문구·카드 PNG·실사진이 같이 있다.
GitHub Pages로 서비스되므로 **카드 PNG는 인터넷 주소로 열린다** (인스타 업로드에 그대로 쓴다).

```
blog/2026-09-20-banten/
  post.md            본문 (머리말 + 마크다운). 네이버에 붙여넣는 원고
  cards.json         카드 6장 문구 (type: cover / qa / stat / compare / list / closing)
  cards/01_cover.png … 06_closing.png   생성된 카드 (1080×1350)
  photo_01_*.jpg     원장님 실사진 (학생 얼굴·이름 없는 것만)
```

## 한 편 만드는 순서

| 단계 | 누가 | 명령 / 할 일 |
|---|---|---|
| ① 글감 | 도구 | `node sync/blog_topics.js --days 7 --topic "오늘 있었던 일"` → `docs/blog_topics_latest.md` |
| ② 본문·카드 문구 | Claude | `docs/lumen_blog_profile.md` 말투로 `post.md` + `cards.json` 작성 |
| ③ 카드 | 도구 | `node sync/card_render.js blog/<폴더>` → PNG 6장 |
| ④ 검사 | 도구 | `node sync/post_check.js blog/<폴더>` → 전부 ✅ 여야 다음으로 |
| ⑤ 네이버 | **원장님** (당분간) | 제목·본문 붙여넣기 → 카드 6장 → 실사진 자리 3곳에 사진 → 지도 → 톡톡 → 해시태그 → **발행** |
| ⑥ 인스타 | 도구 (5단계에서 만듦) | 같은 카드 6장을 캐러셀로 |

## 올린 뒤 — 검색에 뜨는지 점검

```
node sync/serp_check.js        # 맥미니·학원 컴퓨터에서만. 클라우드에서는 캡차가 뜬다
```

검색어 10개를 휴대폰 네이버에 쳐 보고 첫 화면에 우리 글이 있는지 세어 `docs/serp_latest.html` 을 만든다.
점검할 때마다 `docs/serp_history/` 에 쌓여서 **지난번과 비교**된다. 검색어는 `sync/serp_keywords.json` 에서 고친다.

보고서에는 «이 동네에서 이기고 있는 블로그»가 같이 나온다. **그 제목들이 다음 글감**이다.

카드가 마음에 안 들면 `cards.json` 문구만 고치고 `--only N` 으로 그 장만 다시 만든다.

## 규칙 (짧게)
- 학생 이름·개별 점수·얼굴은 넣지 않는다. 이 폴더는 공개다
- 확인 안 된 숫자는 지어내지 않는다. 검사기가 `❏` 가 남아 있으면 막는다
- 교습비·등록번호는 별도 안내 글에만 (`recruit: true`)
