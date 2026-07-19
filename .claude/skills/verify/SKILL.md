# verify — 루멘수학 단일 HTML 앱 브라우저 구동 검증

단일 HTML 앱(lumen_v16-*.html, student_v2-*.html, parent_v1-*.html)을 실제
Chromium에서 구동해 변경을 관찰하는 레시피. jsdom 렌더 검사보다 이 방식을 우선.

## 핵심 제약 (이 클라우드 환경)
- Chromium은 외부 네트워크 불가 (프록시가 브라우저 TLS를 리셋) → **모든 외부
  요청을 Playwright route로 fixture 처리**해야 한다. localhost는 정상.
- Playwright 브라우저 버전 불일치 → `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` + `--no-sandbox` 지정.
- `NODE_PATH=/home/user/lumen-math/node_modules` 로 실행 (playwright는 리포에 설치됨).
- supabase-js CDN(jsdelivr)은 프록시 차단 → `npm pack @supabase/supabase-js@2`
  (registry.npmjs.org는 직접 허용) 후 `package/dist/umd/supabase.js`를 route로 서빙.

## 레시피
1. `http.createServer`로 리포 디렉터리를 127.0.0.1:8931에 정적 서빙.
2. Playwright routes:
   - `**cdn.jsdelivr.net/npm/@supabase/supabase-js@2` → 로컬 UMD 파일 fulfill
   - cdnjs / fonts.googleapis / fonts.gstatic → abort (앱은 async라 무해)
   - `**bhkkkbcytcrlxhrtjgen.supabase.co/**` → fixture JSON.
     supaFullPull은 `lumen_store?select=key%2C+value%2C+updated_at` 전체 조회 —
     `[{key:'or_studentdb', value:JSON.stringify([...]), updated_at:'...'}]` 형태로 응답.
     개별 키 조회는 URL의 `key=eq.<키>`로 분기.
3. 학원앱 로그인 게이트 우회: `page.addInitScript`로
   `sessionStorage['lumen_login_session'] = {expires: Date.now()+30*60*1000}`.
4. 내비게이션(학원앱): 상단 그룹 클릭 → 좌측 레일은 `.lsub-i` / `.stab` 요소를
   textContent로 찾아 click (라벨은 자식 span에 있어 leaf-only 필터는 실패함).
   또는 `page.evaluate("subGo('<그룹key>', <index>)")`.
5. 관찰: `document.body.innerText` 텍스트 검증 + 섹션 clip 스크린샷
   (`closest('div[style*="border-radius:16px"]')`가 카드 컨테이너).
6. 프로브: fixture를 500으로 바꿔 실패 경로(폴백)도 1회 구동.

## 참고 예시
과거 하네스: 스크래치패드 `verify_v1624.js` (v16-24 문제수 XP 자동화 검증,
정상 + 로드실패 프로브, 6/6 통과). 새 검증은 이 파일을 복사해 fixture만 교체.

## 수집기(sync/*.js) 검증
Node로 직접 실행이 곧 표면: `NODE_USE_ENV_PROXY=1
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node sync/mathflat_collector.js
--counts-only|--weekly-only|--monthly` (환경변수 MATHFLAT_ID/PASSWORD,
SUPABASE_URL/SERVICE_KEY는 세션에 설정돼 있음). 매쓰플랫·Supabase 모두 Node
fetch로는 접근 가능.
