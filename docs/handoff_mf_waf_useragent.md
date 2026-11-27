# 📨 매쓰플랫/학원앱 채팅에 전달 — 매쓰플랫 WAF 막힘의 진짜 원인과 고침

2026-11-27 저녁, 해설집 세션에서 알아낸 것. **main 에 올려 주세요.**

---

## 한 줄 요약

오늘 매쓰플랫이 막은 건 **로그인 횟수 때문이 아니라, 우리 요청에 `user-agent` 헤더가 없어서**입니다.
`sync/mf_login_guard.js` 한 곳에 세 군데만 더하면 25개 스크립트가 전부 풀립니다.

---

## 근거 (로그인 없이 실측)

같은 주소를 헤더만 바꿔 불러 봤습니다. 토큰 없이 부른 것이라 **로그인을 한 번도 쓰지 않았습니다.**

| 부른 곳 | 지금 저장소 헤더 (user-agent 없음) | `user-agent` 만 추가 |
|---|---|---|
| `GET /curriculums/core` | **403 WAF_BLOCKED** | **401** invalid_token |
| `GET /students?size=1` | **403 WAF_BLOCKED** | **401** invalid_token |
| `GET /worksheet/86504857` | **403 WAF_BLOCKED** | **401** invalid_token |
| 헤더를 아예 안 줬을 때 | **403 WAF_BLOCKED** | **400** PLATFORM_NOT_EXIST |

- 401·400 = **WAF 를 지나 서버가 정상으로 답한 것**(토큰·플랫폼 헤더가 없다는 뜻)
- 로그인(`POST /v2/login`)뿐 아니라 **주소를 가리지 않고 전부** 막혔습니다
- `teacher.mathflat.com`(웹 페이지)은 200 으로 멀쩡합니다 → 계정 차단도, 아이피 차단도 아닙니다

**왜 빠졌나** — 맨 처음 만든 `sync/mathflat_login_http.js` 는 원래 이 표시를 보내고 있습니다(51~52줄).
그 뒤에 만든 매쓰플랫 스크립트 **22개가 전부 빠뜨렸습니다.** 매쓰플랫 WAF 규칙이 오늘 바뀌면서 드러난 것으로 보입니다.

---

## 고침 — `sync/mf_login_guard.js` 세 군데

스크립트 22개를 하나씩 고치지 말고, **이미 fetch 를 감싸고 있는 「로그인 줄이기」 한 곳**에서 채웁니다.

### ① 상수 추가 — `BLOCK_CODES` 줄 바로 아래

```js
const UA = process.env.MFG_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
```

### ② 함수 추가 — `isLogin()` 바로 아래

```js
  /* 브라우저 표시(user-agent) 붙이기 — 2026-11-27 실측:
   * 매쓰플랫 WAF 는 user-agent 가 없는 요청을 주소 가리지 않고 403 WAF_BLOCKED 로 막는다.
   *   헤더 없이 /curriculums/core  → 403 WAF_BLOCKED
   *   user-agent 만 붙이면        → 401 invalid_token (= WAF 를 지나 서버가 정상 응답)
   * 맨 처음 만든 sync/mathflat_login_http.js 는 원래 이 표시를 보내고 있었고,
   * 뒤에 만든 스크립트 22개가 빠뜨렸다. 여기서 한 번에 채워 준다(이미 있으면 건드리지 않는다). */
  function withUA(url, init) {
    const u = String((url && url.url) || url || '');
    if (!/\bmathflat\.com\b/.test(u)) return init;
    const has = (h) => {
      if (!h) return false;
      if (typeof h.get === 'function') return !!h.get('user-agent');
      if (Array.isArray(h)) return h.some((kv) => String(kv[0]).toLowerCase() === 'user-agent');
      return Object.keys(h).some((k) => k.toLowerCase() === 'user-agent');
    };
    const h = init && init.headers;
    if (has(h)) return init;
    if (h && typeof h.set === 'function') { h.set('user-agent', UA); return init; }
    if (Array.isArray(h)) return Object.assign({}, init, { headers: h.concat([['user-agent', UA]]) });
    return Object.assign({}, init || {}, { headers: Object.assign({}, h || {}, { 'user-agent': UA }) });
  }
```

### ③ `guarded()` 첫 줄에 한 줄

```js
  async function guarded(url, init) {
    init = withUA(url, init);                    // ← 이 줄 추가
    if (!SB || !SK || process.env.MFG_OFF === '1' || !isLogin(url, init)) return realFetch(url, init);
```

### ④ (선택) 머리말 설명에 한 줄

`④ 차단 기록:` 줄 위에 넣어 두면 나중에 읽는 사람이 압니다.

```
 *   ⓪ 브라우저 표시: mathflat.com 으로 가는 요청에 user-agent 가 없으면 채운다(없으면 WAF 가 전부 403 으로 막는다)
```

---

## 이미 확인한 것

`--require` 로 가드를 걸고 **로그인 없이** 확인했습니다.

- 헤더를 **객체**로 줄 때 → 403 → 401 ✅
- 헤더를 **Headers 객체**로 줄 때 → 403 → 401 ✅
- 헤더를 **배열**로 줄 때 → 403 → 401 ✅
- 헤더를 **아예 안 줄 때** → 403 → 400 ✅
- 이미 `user-agent` 가 있으면 건드리지 않음 ✅
- **매쓰플랫이 아닌 곳(Supabase)은 손대지 않음** ✅

**아직 못 한 것** — 실제 로그인. 「로그인 멈춤」이 MANUAL 로 20:08 까지 걸려 있어 기다리는 중입니다(해설집 세션이 20:10 에 한 번만 해 보고 결과를 알립니다).

---

## 어디에 있나

해설집 세션 브랜치 **`claude/eloquent-mendel-662279`** 커밋 **`0b40017`** 에 고친 파일 전체가 있습니다.

```
git show 0b40017:sync/mf_login_guard.js
```

⚠️ 그 브랜치는 `main` 과 **공통 조상이 없어 병합이 안 됩니다**(이력이 갈라져 있음).
위 세 군데를 main 의 파일에 **직접 넣어 주세요.** 파일을 통째로 덮어써도 됩니다 — main 것을 가져와 고친 것이라 나머지는 같습니다.

---

## 왜 급한가

**새벽 자동 작업은 `main` 에서 돕니다.** main 에 안 올라가면 오늘 새벽도 그대로 막힙니다.

- 04:25 플래너 채점 · 04:50 Ultra Feedback
- 매쓰플랫 정기 수집 — **오늘 낮에 이미 실패**(`mf_collect_req` 에 `ok:false` 기록)
- 05:10 쌍둥이 미리받기 · 리커버리 예약 처리

---

## 함께 부탁

1. **「로그인 줄이기」 자체는 끄지 마세요.** 원인이 user-agent 였더라도, 토큰 2분 같이 쓰기·60초 간격은 앞으로도 매쓰플랫에 부담을 덜 줍니다
2. main 에 올라간 뒤 **학원앱 「지금 가져오기」** 한 번 눌러 오늘 수집을 메워 주세요 (안 해도 새벽에 재시도됩니다)
3. 나중에 또 `WAF_BLOCKED` 가 나오면 **먼저 user-agent 가 실려 나가는지부터** 보세요. 가드를 거치지 않고 도는 스크립트가 있으면 그 스크립트가 막힙니다
