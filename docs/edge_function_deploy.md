# 🔧 활동지 읽기 기능 켜기 (Supabase Edge Function `aha-read`)

원장님이 **한 번만** 해 두시면 되는 설정입니다. 5분쯤 걸립니다.
컴퓨터에 아무것도 설치하지 않고, 인터넷 화면에서 클릭만 하면 됩니다.

---

## 왜 필요한가요

학생앱(`student_v1.html`)은 학생들이 주소만 알면 누구나 열 수 있는 **공개 파일**입니다.
그래서 여기에 Claude API 키를 넣으면 **키가 그대로 보입니다**(누가 가져다 써도 원장님 요금이 나갑니다).

그래서 「활동지 사진을 읽는 일」만 Supabase 서버가 대신하게 합니다.
키는 Supabase 금고에만 있고 학생 폰으로는 절대 내려가지 않습니다.

```
학생 폰                Supabase 서버(금고에 키)          Claude
  사진 ─────────────▶  aha-read 함수 ───────────────▶  손글씨 읽기
  L·A·M·P 글자 ◀────────────────────────────────────────
```

---

## 안 해도 앱은 돌아갑니다

이 설정을 **안 하셔도** IB아하노트는 작동합니다. 다만 이렇게 달라집니다.

| | 설정했을 때 | 안 했을 때 |
|---|---|---|
| 학생 화면 | 사진 찍고 5~10초 뒤 **네 칸이 채워져** 나옴 | 「선생님이 읽어 드립니다」라고 뜨고 빈 칸으로 제출 |
| 원장님 일 | 확인만 | 카드에서 **🤖 사진 다시 읽기**를 눌러 주셔야 함 |

즉 **안 하시면 원장님이 버튼을 한 번 더 누르시는 것**뿐입니다.
학생 경험을 좋게 하려면 켜 두시는 편이 좋습니다.

---

## 켜는 방법

### 1단계 — Supabase 열기

<https://supabase.com/dashboard/project/bhkkkbcytcrlxhrtjgen/functions>

왼쪽 메뉴에서 **Edge Functions**를 누르셔도 같은 화면입니다.

### 2단계 — 금고에 Claude 키 넣기

같은 화면 위쪽의 **Secrets**(또는 왼쪽 Project Settings → Edge Functions → Secrets) 탭으로 갑니다.

**Add new secret**을 누르고

| 칸 | 넣을 값 |
|---|---|
| Name | `ANTHROPIC_API_KEY` |
| Value | 학원앱 설정에 넣어 두신 것과 **같은 Claude 키** (`sk-ant-…`) |

**Save**를 누릅니다.

> 키를 어디서 보나요 — 학원앱 오른쪽 위 ⚙️ 설정 → Claude API 키 칸에 있습니다.
> 새로 만들려면 <https://console.anthropic.com> → API Keys.

### 3단계 — 함수 만들기

Edge Functions 화면에서 **Deploy a new function** → **Via Editor**를 누릅니다.
(주소로 바로 가셔도 됩니다: <https://supabase.com/dashboard/project/bhkkkbcytcrlxhrtjgen/functions/new>)

> **먼저 `Ctrl` + `-`(빼기)를 두어 번 눌러 화면을 줄여 주세요.**
> 편집기가 화면을 꽉 채워서, 아래쪽 **Deploy function** 단추가 창 밖으로 잘려 안 보입니다.

**① 이름 넣기 — `aha-read`**

화면 위쪽 `Edge Functions > Create new edge function` 에서
**「Create new edge function」 글자를 클릭**하면 입력칸으로 바뀝니다. 거기에 `aha-read`를 칩니다.

글자가 안 바뀌면, 아래쪽 **Deploy function** 단추를 먼저 누르세요 — 이름을 묻는 창이 뜹니다.

이름은 **`aha-read` 그대로**여야 합니다(앱이 이 이름으로 부릅니다).

**② 코드 붙여넣기**

오른쪽 편집칸에 예시 코드(`withSupabase`, `Hello ${name}` 같은 것)가 들어 있습니다.
**전부 지우고**, 아래 파일 내용을 **통째로 붙여넣습니다**.

<https://github.com/yellowtongki/lumen-math/blob/main/supabase/functions/aha-read/index.ts>

(깃허브에서 열어 오른쪽 위 복사 단추 → 그대로 붙여넣기)

> 예시 코드와 저희 코드는 쓰는 방식이 다릅니다(`withSupabase` vs `Deno.serve`).
> 둘 다 정상 동작하니 신경 쓰지 마시고 그냥 덮어쓰시면 됩니다.
> 왼쪽 FILES 칸의 `index.ts` 하나만 쓰고, 파일을 더 만들 필요는 없습니다.

**③ Deploy function**을 누릅니다. 초록색으로 바뀌면 끝입니다.

### 4단계 — 잘 됐는지 확인

학생앱에서 아무 활동지나 한 장 찍어 보시면 됩니다.

- **잘 됨** — 「활동지를 읽는 중이에요…」가 5~10초 뜨고 네 칸이 채워집니다
- **안 됨** — 「지금은 못 읽었어요」가 뜹니다. 아래 표를 보세요

---

## 안 될 때

| 화면에 나오는 말 | 뜻 | 할 일 |
|---|---|---|
| `ANTHROPIC_API_KEY 금고 값이 없습니다` | 2단계를 안 했거나 이름을 다르게 씀 | Secrets에서 이름이 정확히 `ANTHROPIC_API_KEY`인지 확인 |
| `AI 호출 실패 (401)` | Claude 키가 틀렸거나 만료됨 | 새 키를 만들어 Secrets와 학원앱 양쪽에 다시 넣기 |
| `AI 호출 실패 (429)` | Claude 사용량이 잠깐 몰림 | 잠시 뒤 다시 (돈 문제면 console.anthropic.com에서 잔액 확인) |
| `허용되지 않은 사진 주소입니다` | 우리 저장소가 아닌 사진 | 정상 동작(안전장치). 앱으로 다시 찍으면 됩니다 |
| 아무 말 없이 계속 「읽는 중」 | 함수 이름이 `aha-read`가 아님 | Edge Functions 목록에서 이름 확인 |
| `AI 호출 실패 (404)` 또는 함수를 못 찾음 | 이름 오타 (`aha_read`·`aharead` 등) | 목록에서 이름을 `aha-read`로 고치거나 지우고 다시 만들기 |

> 이름을 잘못 만드셨으면 Edge Functions 목록에서 그 함수를 지우고 3단계를 다시 하시면 됩니다.

기록은 Supabase Edge Functions 화면의 **Logs** 탭에서 볼 수 있습니다.

---

## 돈이 얼마나 드나요

사진 한 장 읽는 데 Claude Haiku 기준 **1원 안팎**입니다.
학생 20명이 하루 2장씩 올려도 한 달에 몇백 원 수준입니다.

---

## 나중에 바꿀 일이 생기면

- 프롬프트(읽는 규칙)를 고치려면 → `supabase/functions/aha-read/index.ts`를 고친 뒤
  같은 방법으로 다시 **Deploy** (Claude에게 말씀하시면 파일을 고쳐 드립니다)
- 기능을 끄려면 → Edge Functions 목록에서 `aha-read` 삭제.
  앱은 자동으로 「선생님이 읽어 드립니다」 방식으로 되돌아갑니다
