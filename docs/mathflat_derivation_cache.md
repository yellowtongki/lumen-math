# 쌍둥이 문제 미리 받아 두기 (`mf_derivation_cache`)

2026-11-06 — 리커버리 학습지가 매쓰플랫 보안문자(CAPTCHA)에 막힌 일을 다시 겪지 않기 위한 설계.
**아직 만들지 않았다. 표를 만드는 SQL 은 새벽에 돌린다** (작업 규칙).

## 무슨 일이 있었나

11/6 저녁, 11/7 리커버리 학습지 16명분을 만들려는데 세 곳에서 모두 막혔다.

| 어디서 | 결과 |
|---|---|
| 원장님 PC 학원앱 「⚡ 확정 전원 학습지 생성」 | 16명 전원 실패 |
| 다른 클라우드 세션 `rcws_make.js --dry` | 16명 전원 실패 (3회 시도) |
| 이 클라우드 세션 `rcws_make.js --dry` | 16명 중 1명만 설계, 15명 실패 |

전부 `CAPTCHA_REQUIRED @ /derivation/problem/<번호>`.

**엔드포인트도 계정도 멀쩡했다.** 같은 계정·같은 본문으로 10회 연속 불렀을 때는 10회 다 200 이었다.

**원인은 호출량이었다.** `mf()` 를 가로채 세어 보니 `rcws_make.js` 는 한 번 돌 때
**`/derivation/problem` 을 770회, 간격 없이** 부른다(서로 다른 문항 627개 · 중복 143회 19% ·
한 문항을 최대 8번: `911816×8`, `909844×7`, `910176×7`).

## 고칠 방향 셋

1. **느리게** — 같은 문항 캐시(770→627) + 호출 사이 3초. 약 31분. 급할 때 쓰는 임시방편
2. **미리 받아 두기** ← 이 문서. 리커버리를 만들 때 쌍둥이 조회를 **0회**로
3. **호출 자체 줄이기** — 쌍둥이 조회 한 번에 유사 문제가 60~100개 딸려 온다. 같은 단원·유형이면
   한 번 받은 유사 묶음을 다른 문항에도 돌려 쓰면 627회 → 150~250회

## 표

**캐시를 둘 곳은 두 가지다.** 전용 표가 있으면 거기, 없으면 범용 저장소 `lumen_store` 의 `mfd_<번호>` 키.
전용 표를 만드는 SQL 은 **서비스 열쇠로 돌릴 수 없다**(PostgREST 는 DDL 을 못 한다. `exec_sql` RPC 도 없다).
원장님이 Supabase 화면에서 `docs/mf_derivation_cache.sql` 을 한 번 돌리면 그때부터 코드가 **저절로** 표 쪽을 쓴다.
**안 돌려도 전부 정상 작동한다** — `lumen_store` 에 담길 뿐이다.

```sql
-- ⚠ 새벽에만 실행 (학생들이 앱을 쓰는 19~23시 금지)
create table if not exists mf_derivation_cache (
  problem_id  bigint      primary key,          -- 문제은행 번호 (문항 이미지 주소의 /problem/<n>/)
  pair        jsonb       not null default '[]'::jsonb,   -- pairProblemList (진짜 쌍둥이)
  similar     jsonb       not null default '[]'::jsonb,   -- similarProblemList (유사)
  fetched_at  timestamptz not null default now(),
  tries       int         not null default 1,
  last_error  text
);
create index if not exists mf_deriv_fetched_at on mf_derivation_cache (fetched_at);
```

한 줄에 담는 것은 `{id, level, type, answer, autoScoredType}` 만 추리면 충분하다
(`rcws_make.js` 의 `pk()` 가 쓰는 값). 통째로 담으면 표가 금방 커진다.

## 데우는 일꾼 (`sync/mf_derivation_warm.js`, 아직 안 만듦)

매일 새벽 **플래너 채점(04:25) 앞**, 수집기가 끝난 뒤에 돈다.

1. 최근 28일 `mf_answer_records` 에서 **틀린 문항**의 문제은행 번호를 모은다
   (번호는 문항 이미지 주소 `/problem/<n>/` 에서 뽑는다 — `rcws_make.js` 의 `bankId()` 와 같은 방법)
2. `mf_derivation_cache` 에 **없는 번호만** 추린다
3. **한 번에 60개까지, 호출 사이 3초** 로 받아 넣는다 (하루치 새 오답은 보통 수십 건이라 넉넉하다)
4. `CAPTCHA_REQUIRED` 가 나오면 **그 자리에서 멈추고** 다음 새벽으로 넘긴다. 재시도하지 않는다
5. 90일 넘은 줄은 지운다 (문제은행이 바뀔 수 있으므로)

## `rcws_make.js` 에서 쓰는 법

`twins()` 가 매쓰플랫을 부르기 전에 캐시를 먼저 본다.

```js
// 있으면 캐시, 없으면 매쓰플랫 (그리고 받은 것을 캐시에 넣는다)
const d = await deriv(pid);   // deriv() 안에서 mf_derivation_cache 조회 → 없으면 mf() → upsert
```

캐시가 채워지면 리커버리 학습지는 **쌍둥이 조회 0회**로 몇 초 만에 끝난다.
같은 오답 문항이 주마다 겹치므로 적중률은 계속 올라간다.

## 2026-11-06 밤 실측 — ①번 처방이 통했다

11/7 리커버리 16명분을 **캐시 + 3초 간격**으로 다시 돌려 **전원 생성·배정 성공**했다.

| | 값 |
|---|---|
| 쌍둥이 조회 | **685회 실제 호출 · 135회 캐시** |
| 간격 | 3초 |
| 걸린 시간 | 20:51~21:29 KST (약 38분, 두 번에 나눠) |
| 보안문자 | **한 번도 안 뜸** |
| 결과 | 16명 전원 · 총 1,173문항 · `rc_ws_made`·`rc_state` 기록 완료 |

간격 없이 770회를 쏘면 수십 회에 걸리고, **3초를 두면 685회가 멀쩡하다.**
호출 수가 아니라 **속도**가 문제였다.

### ⚠ 덤으로 드러난 버그 — 매쓰플랫 토큰이 5분 만에 끊긴다

`sync/rcws_make.js` 의 `mf()` 에는 **401 재로그인이 없다.** 그동안 리커버리가 빨리 끝나
안 드러났는데, 간격을 두고 천천히 가니 5분 지점부터 전부 죽었다
(첫 실행: 3명 성공 뒤 13명 `UNAUTHORIZED @ /worksheet/filter/concept`).

고칠 곳 — `sync/rcws_make.js` 의 `mf()`:

```js
let _loginAt = 0;
async function mf(method, p, body, _retried) {
  if (Date.now() - _loginAt > 150000) { await mfLogin(); _loginAt = Date.now(); }  // 2.5분마다 미리
  const r = await fetch(`${MF}${p}`, { ... });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.status === 401 && !_retried) {            // 그래도 끊겼으면 한 번 더
    await mfLogin(); _loginAt = Date.now();
    return mf(method, p, body, true);
  }
  if (!r.ok) throw new Error(`${(j && j.code) || r.status} @ ${p}`);
  return j && (j.data !== undefined ? j.data : j);
}
```

`mfLogin()` 안에서도 `_loginAt = Date.now()` 를 찍어 둔다.
`sync/mypaper_to_mathflat.js` 는 이미 같은 방식으로 401 재로그인을 하고 있다 — 그쪽을 본뜨면 된다.

### 그래서 급할 때 쓰는 임시방편 (②가 생기기 전까지)

`rcws_make.js` 에 **① 같은 문항 캐시 ② 호출 사이 3초 ③ 401 재로그인** 세 가지를 넣으면
16명이 약 35분에 끝난다. ②(미리 받아 두기)가 생기면 몇 초로 줄어든다.

## 지키는 선

- **보안문자는 풀지도, 피해 가지도 않는다.** 뜨면 멈춘다
- 여러 기기·여러 주소로 나눠 쏘지 않는다 (보안 장치를 피해 가는 것)
- 느리게 부르는 것은 괜찮다 — 제한에 걸리지 않게 속도를 낮추는 것이지 피하는 것이 아니다
