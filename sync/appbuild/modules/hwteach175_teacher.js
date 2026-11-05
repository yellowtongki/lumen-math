/* ═══════════════════════════════════════════════════════════════════
 * v19-175: 📚 숙제 체크 2판 맞춤 — 학생 눈금 0·30·60·100 그대로 읽기 · 선생님 확인값 발행(hw_teach_) · 셀프 체크 XP 끄기
 *  (원장 2026-11-05 「학생앱 추천대로 만들고 배포」 · 「XP 관련은 삭제」 · 계약 docs/hw_dispatch_contract.md §10)
 *  · 학생앱 v2-158 은 hw_self_<코드>.byDate[수업일] 에 0/30/60/100 과 aNone(막힌 문제 없어요)을 적는다.
 *    v19-173 의 hwsOf 는 100 아니면 0 으로 뭉갰다 → 값을 그대로 읽고, 점 4개는 값 크기대로 진하기, aNone 은 「—」.
 *  · 「학생 체크 그대로 ✓」(hwsToHw) 도 30·60 을 그대로 숙제체크 눈금(○ ◔ ◐ ✓)에 넣는다.
 *  · hwcSave(선생님 확인 저장) 뒤에 lumen_store hw_teach_<코드> = { byDate:{ iso:{p,c,w,t} }, upd } 그 날짜 한 칸만 올린다
 *    (학생앱 기록 줄의 파란 숫자). 학원앱만 쓴다 · 기기에 두지 않는다(PULL_SKIP_PREFIX) · 실패해도 숙제체크 저장은 그대로.
 *  · hwlSelfXP → 0 (v19-171·173 의 셀프 체크 +5 를 끈다). 선생님 확인 4단계 XP 는 그대로.
 *  ※ 문자열 연결로만 HTML. 바탕·앞 부품 함수는 다시 정의해 덮는다.
 * ═══════════════════════════════════════════════════════════════════ */
try { if (typeof PULL_SKIP_PREFIX !== 'undefined' && PULL_SKIP_PREFIX.indexOf('hw_teach_') < 0) PULL_SKIP_PREFIX.push('hw_teach_'); } catch(e){}

/* ── 값 읽기: 0/30/60/100 그대로 · 옛 0/100 도 그대로 · aNone → a 는 'na' ── */
function hwsOf(code, iso){
  if (typeof HWSF === 'undefined' || !HWSF || !code || !iso) return null;
  var b = HWSF.by[String(code)]; var d = b && b.byDate && b.byDate[iso];
  if (!d || typeof d !== 'object') return null;
  var out = { at: d.at || '', aNone: !!d.aNone }, any = false;
  HWSF_STEP.forEach(function(s){
    var k = s[0];
    if (k === 'a' && d.aNone) { out.a = 'na'; any = true; return; }
    if (d[k] == null || d[k] === '') { out[k] = null; return; }
    var n = Number(d[k]); if (isNaN(n)) { out[k] = null; return; }
    out[k] = n >= 100 ? 100 : (n >= 60 ? 60 : (n >= 30 ? 30 : 0)); any = true;
  });
  return any ? out : null;
}
function hwsNum(x){ return (x == null || x === 'na') ? 0 : Number(x) || 0; }
function hwsToHw(v){ return { p: hwsNum(v && v.p), c: hwsNum(v && v.c), w: hwsNum(v && v.w) }; }
function hwsMark(x){ if (x == null) return '—'; if (x === 'na') return '해당 없음'; var n = Number(x) || 0; return n >= 100 ? '✓' : (n >= 60 ? '◐' : (n >= 30 ? '◔' : '○')); }
/* 작은 점 4개 — 값 크기대로 진하기 · 안 누름 빈 점선 · 해당 없음 가로 줄 */
function hwsDots(v, big){
  var sz = big ? 6 : 4, h = '<span class="hws-dots" data-hws="' + (v ? 'y' : 'n') + '" style="display:flex;gap:' + (big ? 3 : 2) + 'px;justify-content:center;align-items:center;pointer-events:none;margin-top:1px;line-height:0">';
  HWSF_STEP.forEach(function(s){
    var x = v ? v[s[0]] : null;
    var sty = 'display:block;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;box-sizing:border-box;';
    if (x == null) sty += 'background:transparent;border:1px dashed #cbd5e1';
    else if (x === 'na') sty += 'background:transparent;border-top:2px solid #cbd5e1;height:0;border-radius:0';
    else { var n = Number(x) || 0; sty += 'background:' + (n >= 100 ? '#15803d' : n >= 60 ? '#4ade80' : n >= 30 ? '#bbf7d0' : '#cbd5e1'); }
    h += '<i class="hws-d-' + s[0] + '" style="' + sty + '"></i>';
  });
  return h + '</span>';
}

/* ── 셀프 체크 XP 끄기 (원장 「XP 관련은 삭제」) ── */
hwlSelfXP = function(){ return { xp: 0, month: 0 }; };

/* ── 선생님 확인값 발행: hwcSave 뒤 hw_teach_<코드> 그 날짜 한 칸 ── */
var HWT = { busy: {}, q: {} };
function hwtTotal(st, iso){ try { return (typeof hwcTotalFor === 'function') ? hwcTotalFor(st, iso) : 0; } catch(e){ return 0; } }
function hwtPublish(st, iso){
  var code = st && st.lumen_rec_code ? String(st.lumen_rec_code) : ''; if (!code || !iso) return;
  var v = (st.lumen_hw || {})[iso]; var cell = null;
  if (v) { var n = (typeof hwcNorm === 'function') ? hwcNorm(v) : v; cell = { p: Number(n.p) || 0, c: Number(n.c) || 0, w: Number(n.w) || 0, t: hwtTotal(st, iso) }; }
  HWT.q[code] = HWT.q[code] || {}; HWT.q[code][iso] = cell;
  if (HWT.busy[code]) return;   /* 쓰는 중이면 모아 두었다가 끝나고 한 번 더 */
  hwtFlush(code);
}
function hwtFlush(code){
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return;
  var batch = HWT.q[code]; if (!batch || !Object.keys(batch).length) return;
  HWT.q[code] = {}; HWT.busy[code] = true;
  var key = 'hw_teach_' + code;
  sb.from('lumen_store').select('value').eq('key', key).maybeSingle().then(function(r){
    var cur = (r && r.data && r.data.value && typeof r.data.value === 'object') ? r.data.value : {};
    var by = (cur.byDate && typeof cur.byDate === 'object') ? cur.byDate : {};
    Object.keys(batch).forEach(function(iso){ if (batch[iso]) by[iso] = batch[iso]; else delete by[iso]; });
    var now = new Date().toISOString();
    return sb.from('lumen_store').upsert({ key: key, value: { byDate: by, upd: now }, updated_at: now }, { onConflict: 'key' });
  }).then(function(){ HWT.busy[code] = false; if (Object.keys(HWT.q[code] || {}).length) hwtFlush(code); },
          function(e){ HWT.busy[code] = false; try { console.warn('hw_teach 발행 실패', e && e.message); } catch(_){} });
}
(function(){
  if (typeof hwcSave !== 'function') return;
  var orig = hwcSave;
  hwcSave = function(st, iso, obj){ var r = orig.apply(this, arguments); try { hwtPublish(st, iso); } catch(e){} return r; };
  window.hwcSave = hwcSave;
})();

/* ── 2차 확인 줄의 「학생 셀프」(v19-171·173) 도 값 그대로 · 해당 없음은 0 ── */
if (typeof hwlSelfHw === 'function') hwlSelfHw = function(code, it){
  var s = null; try { s = ((typeof TD !== 'undefined' && TD.st) || {})[code]; s = s && it && s[it.id]; } catch(e){ s = null; }
  if (s && s.hw && typeof s.hw === 'object') return s.hw;
  var v = (it && it.due) ? hwsOf(code, it.due) : null; if (!v) return null;
  return { p: hwsNum(v.p), c: hwsNum(v.c), w: hwsNum(v.w), a: hwsNum(v.a) };
};
