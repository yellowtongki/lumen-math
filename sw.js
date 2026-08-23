/* ═══════════════════════════════════════════════════════════════════
 * 루멘수학 알림 받는 담당 (서비스워커)  v1
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【이게 뭔가요?】
 *   앱을 닫아 두어도 폰이 알림을 받으려면, 브라우저 규격상 이렇게
 *   «따로 떨어진 파일» 하나가 반드시 있어야 합니다. 우리 앱은 파일 하나
 *   원칙이지만, 이것만은 규격이라 예외입니다. 화면은 없고 알림만 담당합니다.
 *
 * 【어떻게 동작하나요?】
 *   ① 폰에 「알림이 왔다」는 신호가 도착합니다 (내용은 안 들어 있음)
 *   ② 이 파일이 깨어나 Supabase에서 «내 앞으로 온 알림»을 읽습니다
 *   ③ 제목·내용을 폰 알림으로 띄웁니다
 *   ④ 알림을 누르면 해당 앱 화면이 열립니다
 *
 *   내용을 신호에 실어 보내지 않고 따로 읽어오는 이유는, 그 편이 훨씬
 *   단순하고 (암호화 과정이 통째로 빠집니다) 우리 구조와 잘 맞기 때문입니다.
 *
 * 【세 앱이 한 파일을 같이 씁니다】
 *   학원앱·학부모앱·학생앱이 같은 주소 아래 있어서 이 파일 하나를 공유합니다.
 *   그래서 «이 폰이 구독한 그 구독 앞으로 온 알림»만 읽습니다(subId 기준).
 *   학생 알림이 학부모 폰에 뜨는 일이 없습니다.
 */

const SUPA = 'https://bhkkkbcytcrlxhrtjgen.supabase.co';
const ANON = 'sb_publishable_D3ryC0YXrf5Fq2Buu8IA8A_OvmCQbbi';
const ICON = './lumen_icon.png';

/* 구독 주소를 짧은 아이디로 (발송 쪽과 같은 규칙이어야 합니다) */
async function subIdOf(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* 설치되면 곧바로 일하기 시작 (새로고침을 기다리지 않게) */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

/* ── 알림 신호가 왔을 때 ── */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    // 못 읽어올 때를 대비한 기본 문구 (알림이 아예 안 뜨는 것보다 낫습니다)
    let title = '루멘수학';
    let body = '새 알림이 있어요';
    let url = './lumen_v1.html';
    let tag = 'lumen';

    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const id = await subIdOf(sub.endpoint);
        const r = await fetch(
          SUPA + '/rest/v1/lumen_store?key=eq.push_inbox_' + id + '&select=value',
          { headers: { apikey: ANON, authorization: 'Bearer ' + ANON } }
        );
        if (r.ok) {
          const j = await r.json();
          let v = j && j[0] && j[0].value;
          if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} }
          if (v && v.title) {
            title = v.title;
            body = v.body || '';
            if (v.url) url = v.url;
            if (v.tag) tag = v.tag;
          }
        }
      }
    } catch (e) { /* 네트워크가 끊겨도 기본 문구로 알림은 띄웁니다 */ }

    await self.registration.showNotification(title, {
      body: body,
      icon: ICON,
      badge: ICON,
      tag: tag,                 // 같은 종류는 덮어써서 알림이 쌓이지 않게
      renotify: true,
      data: { url: url },
    });
  })());
});

/* ── 알림을 눌렀을 때: 이미 열려 있으면 그 창으로, 없으면 새로 ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './lumen_v1.html';
  event.waitUntil((async () => {
    const abs = new URL(target, self.location).href;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.split('#')[0] === abs.split('#')[0] && 'focus' in w) return w.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(abs);
  })());
});
