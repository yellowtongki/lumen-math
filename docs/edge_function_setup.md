# ⏩ 매쓰플랫 바로 반영 — 설치 설명서 (C-1안)

원장 결정 2026-09-19. **추가 비용 0원** — 이미 내고 계신 Supabase Pro 요금에 포함됩니다.

## 지금 무엇이 문제였나

학생앱이 채점한 것을 매쓰플랫에 되돌려쓰는 일을 **깃허브 서버(GitHub Actions)**가 맡고 있었습니다.
「5분마다」라고 적어 두었지만 깃허브가 무료 예약을 뒤로 미뤄 **실제로는 2~4시간에 한 번**만 깨어납니다.
(2026-09-19에 109건이 밀려 있었습니다. 그날 손으로 한 번 돌려 다 넘겼습니다.)

이 일은 **브라우저가 필요 없는 순수 통신**입니다. 그래서 Supabase 안에서 돌릴 수 있습니다.
수집(매쓰플랫에서 긁어오기)은 브라우저가 필요하므로 지금처럼 깃허브에 남겨 둡니다.

| | 지금 | 바꾼 뒤 |
|---|---|---|
| 반영 주기 | 2~4시간 | **2분** |
| 비용 | 0원 | **0원** (Pro 요금에 포함) |
| 수집(긁어오기) | 깃허브 · 새벽 | 그대로 |

## 원장님이 하실 일 — 세 단계, 10분

### 1단계. 함수 만들기

1. https://supabase.com/dashboard 에서 루멘 프로젝트를 엽니다
2. 왼쪽 메뉴 맨 아래쯤 **Edge Functions** 를 누릅니다
3. **Deploy a new function** → **Via Editor**(웹에서 바로 쓰기)를 고릅니다
4. 이름에 **`hw-flush`** 를 적습니다 (반드시 이대로)
5. 편집칸의 내용을 모두 지우고, 저장소의 **`supabase/functions/hw-flush/index.ts`** 파일 내용을 통째로 붙여넣습니다
6. **Deploy** 를 누릅니다

### 2단계. 비밀번호 넣어 주기

함수가 매쓰플랫에 로그인하려면 아이디·비밀번호가 필요합니다. **코드에는 절대 적지 않고** 따로 넣습니다.

1. **Edge Functions** → **Secrets** (또는 Settings → Edge Functions → Secrets)
2. 아래 세 개를 더합니다

| 이름 | 값 |
|---|---|
| `MATHFLAT_ID` | 매쓰플랫 선생님 아이디 |
| `MATHFLAT_PASSWORD` | 매쓰플랫 비밀번호 |
| `LUMEN_FLUSH_KEY` | 아무 긴 글자나 (예: 영문+숫자 20자). **3단계에서 같은 값을 씁니다** |

> `SUPABASE_URL` 과 `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase가 알아서 넣어 주므로 적지 않습니다.

### 3단계. 2분마다 부르게 하기

**Integrations → Cron** 에서 새 작업을 만듭니다.

- Name: `hw-flush`
- Schedule: `*/2 * * * *` (2분마다)
- Type: **HTTP Request**
- Method: `POST`
- URL: `https://bhkkkbcytcrlxhrtjgen.supabase.co/functions/v1/hw-flush`
- Headers:
  - `Authorization` : `Bearer <프로젝트의 anon key>`
  - `x-lumen-flush-key` : **2단계에서 정한 `LUMEN_FLUSH_KEY` 와 같은 값**

Cron 메뉴가 안 보이면 **SQL Editor** 에서 아래를 한 번 실행해도 됩니다.
(`<FLUSH_KEY>` 와 `<ANON_KEY>` 는 실제 값으로 바꿔 넣으세요 — **이 파일에는 절대 적지 마세요**)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('hw-flush', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://bhkkkbcytcrlxhrtjgen.supabase.co/functions/v1/hw-flush',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-lumen-flush-key', '<FLUSH_KEY>'
    )
  );
$$);
```

> ⚠️ 이 SQL은 서버 구조를 바꾸는 것이 아니라 예약 한 줄을 더하는 것이라 가볍습니다.
> 그래도 학생들이 앱을 많이 쓰는 **저녁 7~11시는 피해** 주세요 (2026-09-18 서버 멈춤 이후 규칙).

## 코드를 고쳤을 때 (다시 올리기)

함수 코드(`supabase/functions/hw-flush/index.ts`)가 바뀌면 **다시 붙여넣어야** 합니다.

1. Edge Functions → **hw-flush** → **Code**(또는 Edit function)
2. 안의 내용을 모두 지우고 새 코드를 붙여넣기
3. **Deploy**

Secrets 와 Cron 은 그대로 두시면 됩니다 — 다시 넣을 필요 없습니다.

### 2026-09-20 — 겹침 방지를 넣었습니다

한꺼번에 아주 많이 밀렸을 때 한 번의 실행이 2분을 넘기면, 앞의 실행이 끝나기 전에
다음 실행이 시작돼 같은 것을 두 번 보낼 수 있었습니다. 그래서

- **지금 누가 돌고 있으면 이번 차례는 건너뜁니다** (`hw_flush_lock`, 5분 뒤 자동 해제)
- **한 번에 최대 400건**만 처리하고 남은 것은 2분 뒤에 이어서 합니다

이 두 가지가 들어간 코드로 한 번 다시 올려 주세요.

## 잘 되는지 보는 법

- 학원앱 **📊 매쓰플랫 현황 → 한눈에** 의 「⏩ 반영 대기」가 **2분 안에 0으로** 내려가면 된 것입니다
- Supabase **Edge Functions → hw-flush → Logs** 에서 실행 기록을 볼 수 있습니다
- `lumen_store` 의 **`hw_flush_log`** 키에 마지막 실행 결과가 남습니다

## 매쓰플랫 동시 로그인은 괜찮은가

괜찮습니다. 함수는 로그인을 최대한 아낍니다.

1. **밀린 것이 없으면 아예 로그인하지 않습니다** — 평소에는 조용합니다
2. 한 번 받은 토큰을 `lumen_store` 의 `mf_token` 에 넣어 두고 **6시간 동안 다시 씁니다**
3. 토큰이 만료되어 거부당할 때만 새로 로그인합니다

그래도 원장님이 매쓰플랫에서 오래 작업하실 때 끊기는 느낌이 있으면,
Cron 주기를 `*/5`(5분)이나 `*/10`(10분)으로 늘리시면 됩니다.

## 끄고 싶을 때

```sql
select cron.unschedule('hw-flush');
```

## 같은 일을 하는 두 곳 — 고칠 때 주의

| 어디 | 무엇 |
|---|---|
| `supabase/functions/hw-flush/index.ts` | **2분마다 자동** (이 문서) |
| `sync/hw_sync_flush.js` | 손으로 한 번 돌릴 때 (`node sync/hw_sync_flush.js`) |
| `sync/collect_request_worker.js` 안 `runHwSync` | 새벽 수집에 묻어가는 것 (그대로 둠) |

셋은 **같은 규칙**을 씁니다. 매쓰플랫이 값을 또 바꾸면(예: `INCORRECT` → `WRONG`) **세 곳 다** 고쳐야 합니다.
