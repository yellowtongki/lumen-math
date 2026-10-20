# ⚔️ 기말 레이드 2판 · 보스 보관함 — 계약서 (2026-10-18)

원장 결정 2026-10-18: 「보스 넣어 · A안(레이스와 같은 날부터 셈) · 중고등학교는 학년통합, 초등부는 따로 · 고등 학년은 순위판에서 가림 · 2주 전 버프 · 초6 버프 줘 · 보관함은 둘 다(꾸미기 + Claude 그리기)」.

## 1. 다음 시즌 설정 (lumen_store `race_season_draft`, 이미 서버에 넣음)

```json
"raids": [
  {"id":"mh","on":true,"name":"중고등부 레이드","boss":"dragon","grs":["중1","중2","중3","고1","고2","고3"],"sch":"",
   "hp":145000,"from":"2026-10-01","to":"2026-12-17","showNames":3,"hideSch":true},
  {"id":"e6","on":true,"name":"초6 레이드","boss":"golem","grs":["초6"],"sch":"",
   "hp":58000,"from":"2026-10-01","to":"2026-12-17","showNames":3}
],
"buff": {"on":true,"max":0.4,
  "boost":{"on":true,"flat":1.3,"max":1,"windows":[
    {"sch":"범박중","grs":["중3"],"from":"2026-10-27","to":"2026-11-12"},
    {"sch":"옥길중","grs":["중3"],"from":"2026-10-30","to":"2026-11-17"},
    {"sch":"범박중","grs":["중1","중2"],"from":"2026-11-25","to":"2026-12-10"},
    {"sch":"범박고","grs":[],"from":"2026-11-23","to":"2026-12-11"},
    {"sch":"소사고","grs":[],"from":"2026-11-26","to":"2026-12-16"},
    {"sch":"옥길중","grs":["중1","중2"],"from":"2026-12-04","to":"2026-12-22"},
    {"sch":"","grs":["초6"],"from":"2026-12-04","to":"2026-12-17"}]}}
```

- 레이드 기간 = 레이스 기간(A안). 학생마다 학교 시작일(`schoolFrom`) 전 기록은 원래 안 센다.
- `hideSch:true` → 엔진이 그 레이드 순위판 줄의 `sch`·`gr` 를 빈 글자로 내보낸다. 앱은 학교·학년을 그리지 않는다.
- 버프 기간 `windows`: 학생 학교 이름 앞부분(`sch`, 비면 아무 학교)·학년(`grs`, 비면 아무 학년)이 맞는 **첫 줄**. 시험 시작 14일 전 ~ 시험 마지막 날. 맞는 줄이 없으면 추가 버프 없음.

## 2. 엔진 출력 (sync/race_engine.js, main 배포 끝)

- `race_board_draft` 줄마다 `bz:{from,to}` (그 학생의 추가 버프 기간, 있을 때만).
- `race_board_draft.buff.boost` = `{on, flat, max, windows:[…], from:(가장 이른), to:(가장 늦은)}` — `dday` 없음.
- `raid_board_draft` = `{at, on, list:[…]}` — 모양은 `raid_board` 와 같고, 더해진 칸:
  - `art` = `{name, w, h, pal:[…], rows:[…]}` (보관함에 그 보스가 있을 때) — 학생앱은 이것을 먼저 그린다.
  - `hideSch:true`
- 지금 시즌(`race_season`)은 예전과 같다. `raid_board` 는 공개 때만 바뀐다.
- `sync/push_boost.js`: `windows` 가 있으면 오늘이 자기 기간 안인 학생에게만, 남은 날도 자기 기간으로.

## 3. 공개(학원앱 「📣 학생앱에 공개」)

예전: `raid_board` ← `{on:false}`. **새로**: `raid_board_draft` 가 있고 `on` 이면 그것을 `raid_board` 로 복사(`at` 새로), 없으면 예전처럼 꺼짐. 확인 글 「보스 레이드는 꺼집니다」 → 다음 시즌 레이드 이름·보스·체력 요약. 공개 뒤 `raid_board_draft` 도 지운다.

## 4. 보스 보관함 (lumen_store `raid_boss_lib`)

```json
{ "v":1, "updated":"ISO",
  "bosses":[ { "key":"dragon", "name":"드래곤", "en":"DRAGON", "tag":"46 x 38", "desc":"…",
               "w":46, "h":38, "pal":["#120e22","#8f2436", …], "rows":["....0011…", …],
               "by":"builtin|claude|teacher", "base":null, "created":"ISO",
               "log":[{"seasonId":"S20260824","raid":"옥길중 중1 레이드","from":"…","to":"…","hp":45000,"cleared":true}] } ] }
```

- `rows[y][x]` 한 글자 = `pal` 번호. 글자표 `BOSS_CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'` (62색까지), `'.'` = 투명. **테두리까지 칠해진 완성 그림**(그릴 때 따로 테두리 계산 안 함).
- 기본 6종(dragon·oni·lich·golem·paper·slime)은 지금 앱 코드의 `RAIDART.BOSSES` 그림을 그대로 옮긴 것(`by:'builtin'`). Claude 가 그린 새 보스는 `by:'claude'`, 원장이 꾸민 것은 `by:'teacher'`, `base` = 바탕 보스 key.
- 서버에 넣는 도구: `node sync/boss_lib.js --seed` (기본 6종 + Claude 보스, 원장이 만든 것은 지우지 않는다).
- key 는 영문 소문자·숫자·`_` (예 `king_slime`, `t_20261018_1`).

## 5. 학원앱 v19-137 (`modules/raid137_teacher.js`)

1. 「🆕 다음 시즌」 카드에 **보스 레이드** 칸: 레이드 목록 편집(이름·보스(보관함에서 고르기)·학년·학교·체력·시작·마감·앞줄 인원·학교·학년 가리기) + `raid_board_draft` 미리보기(보스 그림·체력 막대·피해·격파 예상·파티 명단).
2. **추가 버프 기간** 칸: windows 목록 편집 + 「학교 시험 일정으로 채우기」(lumen_store `school_calendar` 의 2학기 기말 `from`−14일 ~ `to`, 학년 지정 반영) + 세기(×고정, 플래너 최대치).
3. **🗃 보스 보관함** 화면: 보관함 그림 전부(이름·크기·누가 만들었나·지난 사용 기록), 보관함이 없으면 앱 코드의 기본 6종으로 「보관함 만들기」. **꾸미기**: 바탕 보스 고르기 → 색 바꾸기(팔레트 색마다 고르기 + 전체 색조 돌리기) · 얹기(왕관·투구·갑옷 띠·불꽃 기운·별 반짝이 — 작은 도트 조각, 머리 위·가운데 자리, 필요하면 위로 칸을 늘림) · 점 찍기/지우기(확대 격자, 펜·지우개) → 이름 붙여 저장. 저장·지우기(기본 6종은 못 지움).
4. 공개 규칙(§3).

## 6. 학생앱 v2-141 (만들기만 · 배포는 원장 지시 때)

1. 레이드 카드: `raid.art` 가 있으면 그것으로 그린다(없으면 지금처럼 `RAIDART.BOSSES` 의 key).
2. `raid.hideSch` 면 파티 명단·앞줄에서 학교·학년을 안 보인다.
3. 순위표 부 이름은 `board.bandNames` 를 따른다(통합이면 「중고등부」).
4. 추가 버프 띠: `buff.boost.windows` 가 있으면 내 줄의 `bz` 기간으로(기간 전이면 「○월 ○일부터 버프」, 기간 안이면 지금 띠, 없으면 띠 없음).
5. 「점수는 하루 세 번 들어와요」 안내 → 하루 여섯 번(새벽 4시 · 오후 4시 · 저녁 6시 · 8시 · 밤 10시 · 자정, 늦어질 수 있음).

## 7. 🏞 보스 배경 · 보스 고르기 바로 보이기 (2026-10-18 밤, 원장 「흑기사로 골랐는데 선택이 안된다 · 보스 배경도 만들어줘」)

- **원인**: 보스 고르기는 편집 사본(RX.raids)만 바꾸고, 아래 「💾 레이드·버프 저장」 뒤 서버 다시 세기(몇 시간 걸릴 수 있음)가 돌아야 미리보기 그림이 바뀌었다.
- **보관함 배경** `raid_boss_lib.bgs = [{key,name,desc,w:128,h:72,pal,rows,by}]` — 8종(volcano 화산 · castle 어둠의 성 · sea 바다 밑 · forest 밤 숲 · cave 수정 동굴 · grave 해골 무덤 · classroom 시험장 · sky 노을 구름). 빈칸 없음(배경은 꽉 찬 그림). 아래 14줄(58~71)이 바닥. 만든 도구 `sync/boss_bg.js`(boss_lib.js --seed 가 같이 넣는다).
- **보스 기본 배경** `bosses[].bg` (dragon→volcano · phoenix→sky · kraken→sea · dark_knight→castle · golem→cave · lich→grave · slime/king_slime/oni→forest · paper→classroom, `_rm` 은 바탕 보스와 같다). 원장이 보관함에서 바꾸면 `bg` + `bgSet:true` (seed 가 지킨다).
- **레이드 설정** `raids[].bg` (없으면 보스 기본 배경).
- **엔진** 순위판 항목에 `bgArt = {key,name,w,h,floor:58,pal,rows}`.
- **그리는 법(기준)**: 배경을 정수 배율로 깔고, 보스는 같은 배율로 가로 가운데, **보스 맨 아래 줄이 배경 64번째 줄**에 오게(`top = (64 − boss.h) × 배율`, 0보다 작으면 0). 보스가 배경보다 크면 둘 다 줄인다.
