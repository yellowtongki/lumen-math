/* ═══════════════════════════════════════════════════════════════════
 * v19-180: 🔐 리커버리 — 매쓰플랫 계정 칸이 안 열리던 것 · 보안문자(CAPTCHA) 안내 (원장 2026-11-06 「학원앱에서 매쓰플랫 입력이 안 된다」)
 *  [까닭 1] 오른쪽 도구 「🔐 계정 넣는 칸 열기」(l3rAcctOpen)는 가운데 옛 카드 보드 오른쪽 «확정 명단» 패널의 계정 칸(#rcws-id)으로
 *           가서 커서를 두는 단추였다. v19-174 줄 표가 그 패널을 가운데에서 빼서 #rcws-id 가 없어졌다 → 눌러도 아무 일 없음.
 *  [고침 1] 도구 칸(서랍) 안에 아이디·비밀번호 칸과 「저장」을 바로 둔다(이 PC 의 or_mf_id / or_mf_pw — 서버로 안 감, 예전과 같음).
 *           칸 id 는 l3r- 로 시작해 화면이 다시 그려져도 커서가 남는다(layout3 render 감싸기 규칙).
 *  [까닭 2] 11/6 매쓰플랫이 쌍둥이 문제 조회(/derivation/problem)에 «CAPTCHA_REQUIRED»(보안문자)를 돌려준다.
 *  [고침 2] 그 오류를 사람 말로 바꾼다: 「매쓰플랫이 보안 확인(보안문자)을 요구합니다 — 매쓰플랫 선생님 사이트에서 직접 확인을 마친 뒤 다시」.
 *           보안문자를 앱이 대신 풀거나 피해 가지 않는다.
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
function l3rAcctBox(){
  var a = { id: '', pw: '' }; try { a = rcwsAcct(); } catch(e){}
  var ok = !!(a.id && a.pw);
  var h = '<div class="l3-tool" id="l3r-acct-box"><b>🔐 매쓰플랫 계정</b>';
  if (ok) {
    h += '<span class="l3-sub" id="l3r-acct">✓ 이 PC 에 저장됨 (' + l3bQ(a.id.slice(0, 3)) + '***) · 즉시 생성 가능</span>'
      + '<button type="button" class="l3-btn" id="l3r-acct-clear" onclick="rcwsClearAcct()">지우기</button>';
  } else {
    h += '<span class="l3-sub" id="l3r-acct">이 PC 에 저장 안 됨 — 넣으면 학습지를 바로 만듭니다 (이 PC 에만 저장 · 서버로 안 감)</span>'
      + '<input id="l3r-mf-id" type="text" autocomplete="username" placeholder="매쓰플랫 아이디" style="width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-family:inherit;font-size:12.5px;margin-top:6px">'
      + '<input id="l3r-mf-pw" type="password" autocomplete="current-password" placeholder="비밀번호" onkeydown="if(event.key===\'Enter\')l3rAcctSave()" style="width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-family:inherit;font-size:12.5px;margin-top:5px">'
      + '<button type="button" class="l3-btn" id="l3r-acct-save" onclick="l3rAcctSave()" style="margin-top:6px">🔐 저장</button>';
  }
  return h + '</div>';
}
window.l3rAcctSave = function(){
  var id = String((document.getElementById('l3r-mf-id') || {}).value || '').trim();
  var pw = String((document.getElementById('l3r-mf-pw') || {}).value || '').trim();
  if (!id || !pw) { try { plToast('매쓰플랫 아이디와 비밀번호를 모두 넣어 주세요'); } catch(e){} return; }
  try { localStorage.setItem('or_mf_id', id); localStorage.setItem('or_mf_pw', pw); } catch(e){}
  try { RCWS.tok = null; } catch(e){}
  try { plToast('🔐 매쓰플랫 계정을 이 PC 에 저장했습니다'); } catch(e){}
  try { render(); } catch(e){}
};
/* 「계정 넣는 칸 열기」(옛 단추·다른 곳에서 부를 때) → 도구 서랍을 열고 아이디 칸에 커서 */
window.l3rAcctOpen = function(){
  try { if (typeof rb174Go === 'function') rb174Go('#l3r-acct-box'); } catch(e){}
  setTimeout(function(){
    var i = document.getElementById('l3r-mf-id') || document.getElementById('rcws-id');
    if (i) { try { i.scrollIntoView({ block: 'center' }); } catch(e){} try { i.focus({ preventScroll: true }); } catch(e){ i.focus(); } }
  }, 80);
};
/* 매쓰플랫 보안문자 → 사람 말 */
var MF_CAPTCHA_MSG = '매쓰플랫이 보안 확인(보안문자)을 요구합니다 — 매쓰플랫 선생님 사이트(teacher.mathflat.com)에 직접 들어가 학습지 만들기에서 쌍둥이 문제를 한 번 불러 보안 확인을 마친 뒤 다시 눌러 주세요. 앱은 보안문자를 대신 풀지 않습니다.';
if (typeof rcwsCall === 'function') rcwsCall = (function(orig){ return async function(){
  try { return await orig.apply(this, arguments); }
  catch(e){
    if (e && /CAPTCHA/i.test(String(e.message || ''))) { try { plToast('⚠ ' + MF_CAPTCHA_MSG); } catch(_){} var x = new Error(MF_CAPTCHA_MSG); x.captcha = true; throw x; }
    throw e;
  }
}; })(rcwsCall);
