/* ═══════════════════════════════════════════════════════════════════
 * v19-117: 🍎 아이패드·아이폰(사파리)에서도 저장 보호 장치가 걸리게
 * 원장 제보 2026-10-13 (아이패드 수업 모드 숙제 체크 → 「화면을 그리지 못했습니다 · QuotaExceededError」
 *   setItem@[native code] ← saveStudents ← hwcSave).
 *  [까닭] 예전엔 localStorage.setItem = function(){…} 으로 바꿔 끼웠다. 크롬은 이걸 받아 주지만
 *         사파리(아이패드·아이폰의 모든 브라우저)는 «setItem 이라는 이름의 값»을 하나 저장할 뿐이고
 *         진짜 저장 함수는 그대로다. 그래서 아이패드에선
 *         ① 등록부를 기기에 «슬림본»으로 쓰기 ② 서버 전용 큰 자료를 메모리로만 두기
 *         ③ 한도가 차면 비우고 다시 쓰기 · 그래도 안 되면 메모리 보관 — 가 하나도 작동하지 않았다.
 *  [고침] 세 함수를 Storage.prototype 에서 감싼다(어느 브라우저든 걸린다). localStorage 일 때만 바꾸고
 *         sessionStorage 는 그대로. 사파리에 남은 «setItem/getItem/removeItem» 이름의 값은 지운다.
 *         켜질 때 한 번: 서버 전용 키의 디스크 사본을 메모리로 옮기고 디스크에선 지운다(읽기는 메모리 먼저라 화면 그대로).
 *         등록부 디스크 사본이 크면(전체본) 슬림본으로 다시 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  var P = Storage.prototype, nGet = P.getItem, nSet = P.setItem, nRem = P.removeItem;
  function isLS(o){ try { return o === window.localStorage; } catch(e){ return false; } }
  P.getItem = function(k){ return isLS(this) ? _lsHookGet(String(k)) : nGet.call(this, k); };
  P.setItem = function(k, v){ return isLS(this) ? _lsHookSet(String(k), v) : nSet.call(this, k, v); };
  P.removeItem = function(k){ return isLS(this) ? _lsHookRemove(String(k)) : nRem.call(this, k); };
  window.__lsHook = 'prototype';
  /* 크롬에 예전 방식으로 붙어 있던 «자기 속성»이 있으면 떼어 낸다(감싼 함수가 보이도록) */
  try { ['getItem','setItem','removeItem'].forEach(function(n){ if (Object.prototype.hasOwnProperty.call(localStorage, n) && typeof localStorage[n] === 'function') delete localStorage[n]; }); } catch(e){}
  /* 사파리: 예전 대입이 저장해 둔 값(함수 글자) 지우기 */
  try { ['getItem','setItem','removeItem'].forEach(function(n){ var v = _origGetItem(n); if (v !== null && /function/.test(v)) _origRemoveItem(n); }); } catch(e){}
  /* 켜질 때 한 번: 서버 전용 키의 디스크 사본 → 메모리 (디스크 비우기) */
  try {
    Object.keys(localStorage).forEach(function(k){
      if (!isMemOnlyKey(k)) return;
      var v = _origGetItem(k);
      if (v !== null && _memStore[k] === undefined) _memStore[k] = v;
      _origRemoveItem(k);
    });
  } catch(e){}
  /* 등록부 디스크 사본이 전체본이면 슬림본으로 (메모리엔 전체본) — 서버로 올리지는 않는다(병합 전 올리기 금지 · v19-52) */
  try {
    var sd = _origGetItem('or_studentdb');
    if (sd && sd.length > 400000 && _memStore.or_studentdb === undefined) {
      var arr = JSON.parse(sd);
      if (Array.isArray(arr)) {
        _memStore.or_studentdb = sd; window._fullStudentDb = arr;
        if (!safePullSetItem('or_studentdb', JSON.stringify(trimStudentDbForLocal(arr)))) safePullSetItem('or_studentdb', JSON.stringify(trimStudentDbForLocal(arr, true)));
      }
    }
  } catch(e){}
})();
