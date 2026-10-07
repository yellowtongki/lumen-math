# 🧍 내 캐릭터 계약서 (학생앱 v2-107 · 학원앱 v19-47)

원장 결정 2026-09-26: 그림체 = **입체 블록 아바타**(로블록스 느낌, 우리 그림) · 머리:몸 = **1.5:2** · 홈 머리 **76px** · 탭은 안 늘린다 · **얼굴은 언제든 바꿈** · **레이드 옷은 시즌 동안 자동**.
시안: https://claude.ai/artifact/519c8ZJr1vYb36rgu5yumr (12·13·14번 판)

## 그림은 어디서 그리나
- 학생 폰에서 three.js로 **직접 조립해 그린다**. 그림 파일이 없다. `three.min.js`(0.160, 670KB)는 저장소 루트에 자체 호스팅, 실패하면 jsdelivr CDN.
- 부품: 머리·몸·팔·다리 블록(공통) + 머리카락 8종 + 얼굴(눈 4·입 4·눈 색 4·볼 홍조·주근깨) + 피부 4 + 장식(안경·귀걸이) + 옷·소품.
- 홈 머리 띠는 상반신 152px 한 장을 그려 `localStorage av_hdr_<코드>`에 저장해 두고(부품이 같으면 다시 안 그린다), 내 캐릭터·만들기 화면은 실시간(끌어서 돌려 보기).
- 3D를 못 그리는 기기: 홈 띠는 🧍 글자, 내 캐릭터 화면은 안내문. 다른 기능에는 영향 없음.
- 렌더러 원본(시안·PNG 뽑기용): `sync/avatar3d/`.

## 서버 키 (`lumen_store`)
| 키 | 누가 쓰나 | 내용 |
|---|---|---|
| `avatar_<code>` | 학생앱 | `{face:{skin,eyes,mouth,blush,freckles,eyeC,hair,hairC,glasses,earring}, job, upd}` — 얼굴·직업(장래희망). 없으면 학원앱 등록부의 `lumen_char_job`·`lumen_char_gender`(여학생은 긴 머리) 기본값 |
| `xp_board` | **학원앱 v19-47** | `{byCode:{<code>:{xp,month,lv,title,icon,color,next,floor,prog,toNext,bd:{contest,weekly,cls,planner,problem,hw,mathflat,quest},badges:[자동 훈장 id],mbadges:[수동 훈장 id],job,gender}}, n, upd}` — 앱 켠 뒤 15초(기기마다 한 시간에 한 번) + 레벨 탭 그릴 때. 이름 없음 |
| `raid_job_<code>` | 학생앱(레이드) | 이미 있던 키. `{job:'warrior'|'mage'|'archer'|'paladin'|'rogue'|'scholar'}` |
| `raid_board` | race_engine | 이미 있던 키. `on`, `list[{from,to,rows[{code}]}]` |

학생앱은 `xp_board`를 **읽기만** 한다. 레벨 계산(배율·표)은 학원앱 한 곳.

## 옷 규칙
- 평소: 직업(장래희망) 옷. 전용 소품이 있는 직업 16종(축구·농구·야구·의사·간호사·과학자·프로게이머·AI개발자·요리사·파티시에·경찰·파일럿·군인·우주비행사·아이돌·뮤지션), 나머지는 학원앱 직업 색 셔츠·바지.
- 레이드: `raid_board.on` 이고 내가 낀 레이드의 `from~to` 안이고 `raid_job_<code>`가 있으면 **자동으로** 그 역할 옷(전사·법사·궁수·성기사·도적·현자). 얼굴·머리·피부는 그대로.
- 얼굴은 「내 캐릭터 → 얼굴·머리 바꾸기」에서 언제든. 직업도 「30종 중 고르기」에서 학생이 바꾼다(학원앱 등록부 값은 기본값으로만 쓴다).

## 화면
- 홈: `#av-strip`(상반신 76px + Lv·칭호·XP 막대 + 레이드 중이면 역할 배지) → `screen-avatar`. 머리 오른쪽 동그라미(`#h-initial`)도 같은 상반신.
- `screen-avatar` 내 캐릭터: 전신(돌려 보기) · 경험치 · 직업 고르기 · 레이드 역할(→ 진도 레이스 화면) · 훈장 수 · XP 내역 · 받은 훈장 · 얼굴 바꾸기.
- `screen-avatar-make` 캐릭터 만들기: 실시간 미리보기 + 7묶음 선택 + 저장.

## 다음
- 레이드·리그 화면의 남 이름 옆 동그라미도 상반신으로(남의 `avatar_<code>`를 읽어 폰에서 그림).
- 코디 캐릭터(길드 코디) 얼굴을 코디 화면·홈 카드에.
- 보스 3종(골렘·슬라임·리치)을 블록 결로 다시.
