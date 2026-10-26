/* ═══════════════════════════════════════════════════════════════════
 * v19-157: 👤 학생관리 «🔗 매쓰플랫에만 있는 학생» 띠 (원장 10/26 「매쓰플랫 학생이 연결이 안 되었다」)
 *   매쓰플랫 학생(mf_students)과 학원앱 학생은 «이름»으로 이어진다(수집기 04·16·22시가 이름이 같으면 코드를 채움).
 *   학원앱 등록부에 그 이름이 없으면 영영 연결되지 않는데, 그걸 알려 주는 곳이 없었다.
 *   · mf_students 중 ACTIVE · lumen_rec_code 없음 → 학원앱 등록부(재원·퇴원 모두)에 같은 이름이 있는지 본다
 *     - 없으면 «학원앱에 없음» + 「＋ 등록」(학생 추가 창에 이름·학년을 채워 연다)
 *     - 있으면 «등록됨 · 다음 수집 때 연결»
 *   · 「숨기기」 = 시험용·선생님 계정 등(서버 lumen_store `mf_unlink_hide` 에 매쓰플랫 학생 번호 목록)
 *   · 「🔄 지금 수집 요청」 = 리커버리 새로고침과 같은 길(lumen_store `mf_collect_req` requested)
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var MFU = { loaded: false, loading: false, rows: [], hide: [], at: 0 };
function mfuNorm(s){ return String(s || '').replace(/\s+/g, ''); }
function mfuGrade(r){
  var g = parseInt(r.grade, 10) || 0, t = String(r.school_type || '');
  if (!g) return '';
  if (t === 'ELEMENTARY') return '초등학교 ' + g + '학년';
  if (t === 'MIDDLE') return '중학교 ' + g + '학년';
  if (t === 'HIGH') return '고등학교 ' + g + '학년';
  return '';
}
function mfuShort(r){ var g = mfuGrade(r); return g ? g.replace('초등학교 ', '초').replace('중학교 ', '중').replace('고등학교 ', '고').replace('학년', '') : ''; }
function mfuLoad(force){
  if (MFU.loading) return;
  if (MFU.loaded && !force && Date.now() - MFU.at < 120000) return;
  var sb = (typeof getSupaClient === 'function') ? getSupaClient() : null; if (!sb) return;
  MFU.loading = true;
  Promise.all([
    sb.from('mf_students').select('mf_student_id,name,grade,school_type,status,lumen_rec_code'),
    sb.from('lumen_store').select('value').eq('key', 'mf_unlink_hide')
  ]).then(function(rs){
    MFU.rows = (rs[0] && rs[0].data) || [];
    var hv = rs[1] && rs[1].data && rs[1].data[0] ? rs[1].data[0].value : [];
    if (typeof hv === 'string'){ try { hv = JSON.parse(hv); } catch(e){ hv = []; } }
    MFU.hide = Array.isArray(hv) ? hv.map(String) : [];
    MFU.loaded = true; MFU.at = Date.now();
  }).catch(function(){}).then(function(){
    MFU.loading = false;
    try { if (VIEW === 'studentdb') render(); } catch(e){}
  });
}
function mfuList(){
  var names = {};
  (students || []).forEach(function(st){ names[mfuNorm(st.name)] = st.withdrawn ? 'out' : 'live'; });
  return MFU.rows.filter(function(r){
    return r && r.status === 'ACTIVE' && !r.lumen_rec_code && r.name && MFU.hide.indexOf(String(r.mf_student_id)) < 0;
  }).map(function(r){ return { r: r, inApp: names[mfuNorm(r.name)] || '' }; });
}
function mfuHtml(){
  mfuLoad(false);
  if (!MFU.loaded) return '';
  var l = mfuList(); if (!l.length) return '';
  var miss = l.filter(function(x){ return !x.inApp; }).length;
  var h = '<div id="mfu-band" style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:14px;padding:12px 16px;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">'
    + '<b style="font-size:14.5px;color:#9a3412">🔗 매쓰플랫과 연결 안 된 학생 ' + l.length + '명</b>'
    + '<span style="font-size:12.5px;color:#9a3412">' + (miss ? '학원앱에 <b>같은 이름</b>으로 등록하면 다음 매쓰플랫 수집(매일 04·16·22시) 때 자동으로 연결됩니다.' : '등록은 되어 있어 다음 수집 때 연결됩니다.') + '</span>'
    + '<button type="button" onclick="mfuReq()" style="margin-left:auto;border:none;border-radius:9px;padding:6px 12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#ea580c;color:#fff">🔄 지금 수집 요청</button>'
    + '</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
  l.forEach(function(x){
    var r = x.r, id = String(r.mf_student_id).replace(/[^A-Za-z0-9_-]/g, '');
    h += '<span style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #fed7aa;border-radius:10px;padding:4px 6px 4px 10px;font-size:13px">'
      + '<b>' + esc2(r.name) + '</b><span style="color:#9a3412;font-size:12px">' + esc2(mfuShort(r)) + '</span>'
      + (x.inApp ? '<span style="font-size:11.5px;font-weight:800;color:#15803d;background:#dcfce7;border-radius:6px;padding:0 6px">등록됨 · 다음 수집 때 연결' + (x.inApp === 'out' ? ' (퇴원 상태)' : '') + '</span>'
        : '<button type="button" onclick="mfuAdd(\'' + id + '\')" style="border:none;border-radius:7px;padding:2px 9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;background:#0d2240;color:#fff">＋ 등록</button>')
      + '<button type="button" onclick="mfuHide(\'' + id + '\')" title="시험용·선생님 계정 등 학원생이 아니면 숨깁니다" style="border:none;border-radius:7px;padding:2px 7px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;background:#f1f5f9;color:#64748b">숨기기</button>'
      + '</span>';
  });
  return h + '</div></div>';
}
window.mfuAdd = function(id){
  var r = MFU.rows.filter(function(x){ return String(x.mf_student_id) === String(id); })[0]; if (!r) return;
  try { addNewStudent(); } catch(e){ return; }
  var n = document.getElementById('edit-name'); if (n) n.value = r.name;
  var g = document.getElementById('edit-grade'), gv = mfuGrade(r);
  if (g && gv && [].some.call(g.options, function(o){ return o.value === gv; })) g.value = gv;
  try { plToast('🔗 매쓰플랫 «' + r.name + '» — 반·연락처를 채우고 저장하세요'); } catch(e){}
};
window.mfuHide = function(id){
  var r = MFU.rows.filter(function(x){ return String(x.mf_student_id) === String(id); })[0];
  if (!confirm('«' + (r ? r.name : id) + '»을(를) 이 목록에서 숨길까요?\n(시험용·선생님 계정처럼 학원생이 아닌 경우)')) return;
  if (MFU.hide.indexOf(String(id)) < 0) MFU.hide.push(String(id));
  Promise.resolve(supaSetItem('mf_unlink_hide', MFU.hide)).then(function(){ try { render(); } catch(e){} });
};
window.mfuReq = function(){
  var req = { status: 'requested', by: 'studentdb', at: new Date().toISOString() };
  Promise.resolve(supaSetItem('mf_collect_req', req)).then(function(ok){
    try { plToast(ok === false ? '⚠ 요청을 저장하지 못했습니다' : '🔄 매쓰플랫 수집을 요청했습니다 — 몇 분 뒤 연결됩니다'); } catch(e){}
    setTimeout(function(){ mfuLoad(true); }, 240000);
  });
};

/* v19-157: 🔗 데이터 재연결 — lumen_store 전체를 한 번에 읽다가 «statement timeout» 으로 실패하던 것을
 *   필요한 키(student_planner_* · submissions_* · or_studentdb)만 100줄씩 나눠 읽는다 */
async function mfuRelinkRows(sb){
  var out = [], qs = [['like', 'student_planner_%'], ['like', 'submissions_%'], ['eq', 'or_studentdb']];
  for (var i = 0; i < qs.length; i++){
    for (var off = 0; off < 20000; off += 100){
      var q = sb.from('lumen_store').select('key,value').order('key', { ascending: true }).range(off, off + 99);
      q = qs[i][0] === 'like' ? q.like('key', qs[i][1]) : q.eq('key', qs[i][1]);
      var r = await q;
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < 100) break;
    }
  }
  return out;
}

/* v19-157: 📔 플래너 입력 표 — 화면이 좁으면 표를 가로로 밀어 본다. 표가 새로 그려질 때 한 번, 오늘 칸이 가운데 오게 맞춘다 */
(function(){
  try {
    new MutationObserver(function(){
      var w = document.getElementById('plGridWrap'); if (!w || w.dataset.sc) return;
      w.dataset.sc = '1';
      if (w.scrollWidth <= w.clientWidth) return;
      var td = w.querySelector('thead tr:nth-child(2) th[style*="#1d6fe8"]');
      if (td) w.scrollLeft = Math.max(0, td.offsetLeft - w.clientWidth / 2);
    }).observe(document.body, { childList: true, subtree: true });
  } catch(e){}
})();
