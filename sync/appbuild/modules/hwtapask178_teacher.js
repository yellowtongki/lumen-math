/* ═══════════════════════════════════════════════════════════════════
 * v19-178: 👆 숙제체크 칸 — 누르면 먼저 창이 뜬다 (원장 2026-11-05 「누르면 그냥 100퍼센트로 바뀐다 · 수정하겠습니까? 메뉴가 뜨거나 해야 한다 · 자꾸 누를 때마다 변경」)
 *  · 기본: 어느 칸이든 한 번 누르면 «세부 창»만 연다. 값은 창에서 고른 것만 저장된다(실수로 바뀌지 않음).
 *    - 이미 찍힌 칸 → 바탕 세부 창(조합 4개 · 단계 눈금 · 학생 스스로 칸 맨 위 · 확인/지우기)
 *    - 빈 칸 → 작은 창(학생 스스로 칸 + 조합 4개 「다 했음 · 풀이만 · 채점까지 · 안 했음」 + 닫기). 조합을 누르면 그때 저장되고 큰 창으로 이어진다.
 *    - 🙋 학생 제출 칸 → 창 맨 위 「학생 값 그대로 ✓ 저장」 (v19-177 의 한 번 탭 저장은 빠른 탭에서만)
 *  · ⚡ 빠른 탭(맨 위 띠 단추): 켜면 v19-177 규칙(빈 칸 = 100 · 100 → 0 · 🙋 제출 칸 = 학생 값). 이 기기에만 기억(localStorage hwc_quick_tap).
 *  · 저장 길(hwcSave · 거울 · hw_teach_ 발행 · 되돌리기)은 그대로. 「한 번에」 줄의 ✅(반 전원)은 그대로.
 *  ※ 문자열 연결로만 HTML. 앞 부품 hwcTap(v19-177 감싼 것)은 HWQ.prev 로 남긴다.
 * ═══════════════════════════════════════════════════════════════════ */
var HWQ = { on: false, prev: null };
try { HWQ.on = localStorage.getItem('hwc_quick_tap') === '1'; } catch(e){ HWQ.on = false; }
window.hwqToggle = function(){
  HWQ.on = !HWQ.on;
  try { localStorage.setItem('hwc_quick_tap', HWQ.on ? '1' : '0'); } catch(e){}
  try { plToast(HWQ.on ? '⚡ 빠른 탭 켬 — 빈 칸을 누르면 바로 100% 로 저장됩니다' : '👆 빠른 탭 끔 — 칸을 누르면 먼저 창이 뜹니다'); } catch(e){}
  try { render(); } catch(e){}
};

/* ── 탭: 기본은 창만 연다 ── */
(function(){
  var prev = window.hwcTap; if (typeof prev !== 'function') return;
  HWQ.prev = prev;
  window.hwcTap = function(stId, iso){
    if (HWQ.on) return prev.apply(this, arguments);
    try { if (HWC.pop === stId + '|' + iso) { hwcClosePop(); return; } } catch(e){}
    hwcOpenPop(stId, iso);
  };
})();

/* ── 빈 칸 작은 창: 「🟢 전부 100%」 한 단추 → 조합 4개 ── */
function hwqPresetRow(stId, iso){
  var q = function(s){ return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };
  var PRE = [['다 했음', 100, 100, 100, '#dcfce7', '#15803d'], ['풀이만', 100, 0, 0, '#fef3c7', '#b45309'], ['채점까지', 100, 100, 0, '#ecfccb', '#4d7c0f'], ['안 했음', 0, 0, 0, '#fee2e2', '#b91c1c']];
  var h = '<div style="font-size:10.5px;color:#64748b;font-weight:800;margin:9px 0 5px">선생님 확인 — 하나를 고르면 저장됩니다</div>';
  h += '<div class="hwq-pre" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
  PRE.forEach(function(x){
    h += '<button onclick="hwqPick(\'' + q(stId) + '\',\'' + iso + '\',' + x[1] + ',' + x[2] + ',' + x[3] + ')" style="border:1.5px solid ' + x[5] + '33;background:' + x[4] + ';color:' + x[5] + ';border-radius:9px;padding:7px 1px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;line-height:1.2">'
      + x[0] + '<small style="display:block;font-size:8px;font-weight:700;opacity:.75;margin-top:1px">' + x[1] + '·' + x[2] + '·' + x[3] + '</small></button>';
  });
  h += '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:8px"><button onclick="hwcClosePop()" style="flex:1;border:none;border-radius:9px;padding:8px 4px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit;background:#f1f5f9;color:#475569">닫기 (안 바꿈)</button></div>';
  return h;
}
window.hwqPick = function(stId, iso, p, c, w){
  var st = (students || []).find(function(x){ return x && x.id === stId; }); if (!st) return;
  var md = iso.slice(5).replace('-', '/').replace(/^0/, '');
  try { hwcMark([hwcSnap(st, iso)], st.name + ' ' + md); } catch(e){}
  hwcSave(st, iso, { p: p, c: c, w: w });
  HWC.pop = stId + '|' + iso;   /* 저장 뒤 큰 창으로 이어서 단계별로 고칠 수 있게 */
  try { render(); } catch(e){}
};
if (typeof hwcPopHtml === 'function') hwcPopHtml = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (!h || h.indexOf('hws-mini') < 0 || !HWC.pop) return h;
    var parts = String(HWC.pop).split('|');
    var mark = '<div style="display:flex;gap:6px;margin-top:8px">';
    var i = h.lastIndexOf(mark);
    if (i < 0) return h;
    return h.slice(0, i) + hwqPresetRow(parts[0], parts[1]) + '</div>';
  } catch(e){ try { console.error('[숙제체크 빈 칸 창]', e); } catch(_){} }
  return h;
}; })(hwcPopHtml);

/* ── 맨 위 띠: ⚡ 빠른 탭 단추 + 안내 글 ── */
if (typeof hwsDecorate === 'function') hwsDecorate = (function(orig){ return function(h, cm){
  var out = orig.apply(this, arguments);
  try {
    if (typeof out !== 'string' || out.indexOf('id="hws-bar"') < 0) return out;
    var btn = '<button class="hwq-btn" onclick="hwqToggle()" title="켜면 빈 칸을 누르자마자 100% 로 저장됩니다(예전 방식)" style="border:1.5px solid ' + (HWQ.on ? '#f59e0b' : '#cbd5e1') + ';background:' + (HWQ.on ? '#fef3c7' : '#fff') + ';color:' + (HWQ.on ? '#b45309' : '#475569') + ';border-radius:20px;padding:3px 10px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap">'
      + (HWQ.on ? '⚡ 빠른 탭 켜짐' : '👆 누르면 창 · 빠른 탭 끔') + '</button>';
    var j = out.indexOf('id="hws-bar"'); var k = out.indexOf('>', j);
    if (k > 0) out = out.slice(0, k + 1) + btn + out.slice(k + 1);
    if (!HWQ.on) {
      out = out.replace('<b style="color:#15803d">🙋 점선 칸</b> 한 번 누르면 학생 값 그대로 저장 · <b style="color:#15803d">✎ 점점선 칸</b> 누르면 세부 창', '칸을 누르면 <b style="color:#15803d">창</b>이 먼저 열려요 · 🙋 학생 값은 창 맨 위 「그대로 ✓ 저장」');
      out = out.replace(' · 🙋 제출 칸 = 한 번에 학생 값 저장 · ✎ 칸 = 창', ' · 지금은 👆 칸을 누르면 창부터');
    }
  } catch(e){ try { console.error('[숙제체크 빠른 탭 단추]', e); } catch(_){} }
  return out;
}; })(hwsDecorate);
