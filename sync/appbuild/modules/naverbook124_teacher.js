/* ═══════════════════════════════════════════════════════════════════
 * v19-124: 📅 네이버 예약 → 학원앱 (수집기 sync/naver_booking_collect.js · GitHub Actions naver-booking.yml 15분마다)
 *
 *  자료 (lumen_store — 화면이 서버에서 바로 읽는다 · 이 기기에는 저장하지 않는다 · 시작 다운로드 제외 'naver_book')
 *    naver_bookings        {at, ok, items, bookings:[{id, item:{id,name,kind}, status:{code,k,label}, date, start, end, count, match:{stKey,code,how}|null, cands?}], counts, pii:{enc,n,kid}}
 *    naver_bookings_pii    예약자 이름·전화·메모·추가 답을 원장님 열쇠로 잠근 상자 → 이 기기의 서버 잠금 열쇠(lumen_db_key)로 연다(nbOpen)
 *    naver_bookings_status {at, ok, reason:'login'|'http', code, lastOkAt}
 *    naver_booking_links   {예약번호: 학생 키} — 「학생 연결」에서 원장님이 고른 것 (''= 명단에 없음 · 새 가족). 수집기도 이것을 먼저 따른다.
 *
 *  ① 「수업·출결 › 📅 네이버 예약」 (VIEW 'naverbk', 출결·보충 바로 뒤)
 *     머리: 마지막으로 받은 때 · 🔄 새로고침 · ⚡ 지금 받기(설정의 GitHub 토큰이 있으면 바로, 없으면 Actions 쪽 열기)
 *     띠: 쿠키 만료 → 「네이버 다시 연결이 필요해요」 + 맥 크롬 방법 · 오래됨 · 이름·전화 열쇠 안내
 *     종류 칩(전체 · 리커버리 · 텐투텐 · 상담/테스트 · TLP · KMM · 컨설팅 · 기타) · 텐투텐 날짜별 인원
 *     목록: 오늘 · 다가오는 예약(날짜별) · 지난 7일(접힘). 줄 = 시간 · 종류 · 예약자 · 전화(누르면 전화) · 메모 · 상태 · 학생(또는 「학생 연결」)
 *     취소는 흐리게.
 *  ② 🚑 리커버리 보드: 그 주 리커버리 날짜의 «리커버리» 예약을 확정 학생과 맞춰
 *     「✓ 네이버 예약 14:00」 · 시간 칸이 비었으면 「시간 넣기」(누를 때만 넣는다) · 예약 없는 확정 학생은 「예약 아직」
 *     · 확정 명단에 없는 학생/못 맞춘 예약은 오른쪽 「예약했지만 명단에 없음」
 *  ③ 🏠 홈: 「📅 오늘 네이버 예약 n건」 작은 칸 (시간 · 종류 · 이름)
 *  ※ 출결은 자동으로 쓰지 않는다(읽기 + 원장님이 누른 단추만). 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var NBK = { loaded:false, loading:false, loadP:null, at:0, data:null, status:null, box:null, pii:null, piiErr:'', links:{}, err:'', kind:'all', edit:{}, busy:false };
var NBK_TTL = 120000;
var NBK_KEYS = ['naver_bookings', 'naver_bookings_status', 'naver_bookings_pii', 'naver_booking_links'];
var NBK_GH_URL = 'https://api.github.com/repos/yellowtongki/lumen-math/actions/workflows/naver-booking.yml/dispatches';
var NBK_GH_PAGE = 'https://github.com/yellowtongki/lumen-math/actions/workflows/naver-booking.yml';

/* ── 메뉴: 위 기능 탭 「수업·출결」의 출결·보충 바로 뒤 ── */
(function(){
  try {
    var g = (GROUPS || []).filter(function(x){ return x.key === 'class'; })[0]; if (!g) return;
    if (g.subs.some(function(s){ return s.v === 'naverbk'; })) return;
    var at = g.subs.length; g.subs.forEach(function(s, j){ if (s.v === 'attend') at = j + 1; });
    g.subs.splice(at, 0, { v:'naverbk', icon:'📅', label:'네이버 예약', act:function(){ VIEW = 'naverbk'; nbkKick('naverbk', true); } });
  } catch(e){ try { console.error('[네이버 예약 메뉴]', e); } catch(_){} }
})();

/* ★ 서버 잠금 열쇠(lumen_db_key)는 이 기기에만 — 서버 동기화(scheduleSync)에 절대 안 올린다.
 *   (2026-10-17 확인: lumen_store 에 lumen_db_key 줄이 있었다 = 공개 열쇠로 읽힘. 이 열쇠로 이름·전화 상자를 열기 때문에 막는다.
 *    시작 다운로드에서도 뺀다 — build_app.py v19-124 PULL_SKIP_KEYS) */
if (typeof scheduleSync === 'function') scheduleSync = (function(o){ return function(key){ if (key === 'lumen_db_key') return; return o.apply(this, arguments); }; })(scheduleSync);

function nbkQ(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function nbkVal(v){ if (typeof v === 'string'){ try { return JSON.parse(v); } catch(e){ return null; } } return v; }
function nbkStus(){ return (typeof students !== 'undefined' && students) ? students : []; }
function nbkStu(k){ var a = nbkStus(); for (var i = 0; i < a.length; i++) if (nbStKey(a[i]) === String(k)) return a[i]; return null; }

/* ── 불러오기 (2분 캐시) + 잠근 상자 열기 ── */
function nbkLoad(force){
  if (NBK.loading) return NBK.loadP;
  if (!force && NBK.loaded && Date.now() - NBK.at < NBK_TTL) return Promise.resolve();
  var sb = getSupaClient(); if (!sb){ NBK.loaded = true; NBK.at = Date.now(); return Promise.resolve(); }
  NBK.loading = true;
  NBK.loadP = (async function(){
    try {
      var r = await sb.from('lumen_store').select('key,value').in('key', NBK_KEYS);
      if (r && r.error) throw r.error;
      var m = {}; ((r && r.data) || []).forEach(function(row){ m[row.key] = nbkVal(row.value); });
      NBK.data = (m.naver_bookings && Array.isArray(m.naver_bookings.bookings)) ? m.naver_bookings : null;
      NBK.status = m.naver_bookings_status || null;
      NBK.links = (m.naver_booking_links && typeof m.naver_booking_links === 'object') ? m.naver_booking_links : {};
      NBK.box = m.naver_bookings_pii || null;
      NBK.err = '';
      await nbkUnlock();
    } catch(e){ NBK.err = (e && e.message) || String(e); }
    NBK.loaded = true; NBK.loading = false; NBK.at = Date.now();
  })();
  return NBK.loadP;
}
async function nbkUnlock(){
  NBK.pii = null; NBK.piiErr = '';
  var box = NBK.box;
  if (!box || !box.ct){ NBK.piiErr = (NBK.data && NBK.data.pii && NBK.data.pii.enc) ? 'nobox' : 'nokey-server'; return; }
  var k = ''; try { k = lumenDbKey(); } catch(e){}
  if (!k){ NBK.piiErr = 'nokey-device'; return; }
  try { var o = await nbOpen(box, k); NBK.pii = (o && o.byId) || {}; }
  catch(e){ NBK.piiErr = 'badkey'; }
}
/* 화면이 부를 때: 아직 안 읽었거나 오래됐으면 읽고, 그 화면이면 다시 그린다 */
function nbkKick(view, force){
  if (NBK.loading) return;
  if (!force && NBK.loaded && Date.now() - NBK.at < NBK_TTL) return;
  nbkLoad(!!force).then(function(){ try { if (VIEW === view) render(); } catch(e){} });
}
window.nbkRefresh = function(){ NBK.edit = {}; nbkLoad(true).then(function(){ render(); plToast('📅 네이버 예약을 다시 읽었어요'); }); };
/* ⚡ 지금 받기 — 설정의 GitHub 토큰(이 PC 에만)이 있으면 수집기를 바로 깨운다 */
window.nbkRunNow = function(){
  var tok = ''; try { tok = (typeof htsGhToken === 'function') ? htsGhToken() : ''; } catch(e){}
  if (!tok){ try { window.open(NBK_GH_PAGE, '_blank'); } catch(e){} plToast('🐙 GitHub 「네이버 예약 수집」에서 Run workflow 를 눌러 주세요 (설정에 GitHub 토큰을 넣으면 여기서 바로 됩니다)'); return; }
  fetch(NBK_GH_URL, { method:'POST', headers:{ 'Authorization':'Bearer ' + tok, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json' }, body:JSON.stringify({ ref:'main' }) })
    .then(function(r){ plToast(r.ok || r.status === 204 ? '⚡ 수집을 시작했어요 — 1~2분 뒤 🔄 새로고침' : ('⚠ GitHub 실행 요청 실패 (' + r.status + ')')); })
    .catch(function(){ plToast('⚠ GitHub 에 연결하지 못했어요'); });
};

/* ── 예약 한 건 ── */
function nbkAll(){ return (NBK.data && NBK.data.bookings) || []; }
function nbkPii(b){ return (NBK.pii && NBK.pii[b.id]) || null; }
/* 학생 연결: 원장님이 고른 것 > 수집기가 맞춘 것 (등록부에 지금 있는 학생만) */
function nbkMatch(b){
  var L = NBK.links || {};
  if (Object.prototype.hasOwnProperty.call(L, b.id)){
    var k = L[b.id];
    if (k === '' || k == null) return { none:true, how:'none' };
    var st = nbkStu(k); if (st) return { stKey:String(k), st:st, how:'manual' };
  } else if (b.noStudent) return { none:true, how:'none' };
  if (b.match && b.match.stKey){ var s2 = nbkStu(b.match.stKey); if (s2) return { stKey:String(b.match.stKey), st:s2, how:b.match.how || '' }; }
  return null;
}
function nbkLive(b){ return !(b.status && b.status.k === 'cancelled'); }
function nbkWho(b){
  var m = nbkMatch(b), p = nbkPii(b);
  if (m && m.st) return m.st.name;
  if (p && p.booker) return p.booker;
  return '새 예약';
}
function nbkDayLabel(ymd){
  var d = new Date(ymd + 'T00:00:00'); if (isNaN(d)) return ymd;
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + ['일','월','화','수','목','금','토'][d.getDay()] + ')';
}
function nbkMd(ymd){ var d = new Date(ymd + 'T00:00:00'); if (isNaN(d)) return ymd; return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['일','월','화','수','목','금','토'][d.getDay()] + ')'; }
function nbkAgo(iso){
  var t = Date.parse(iso || ''); if (isNaN(t)) return '';
  var k = nbKst(iso), m = Math.round((Date.now() - t) / 60000);
  var ago = m < 1 ? '방금' : (m < 60 ? m + '분 전' : (m < 60 * 48 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'));
  return (k ? Number(k.date.slice(5, 7)) + '/' + Number(k.date.slice(8, 10)) + ' ' + k.time : '') + ' (' + ago + ')';
}
function nbkKindBadge(k){ var K = nbKindInfo(k); return '<span class="nbk-kind" style="color:' + K.color + ';background:' + K.bg + '">' + nbkQ(K.short) + '</span>'; }

/* ── 띠: 연결 상태 · 오래됨 · 이름·전화 열쇠 ── */
function nbkBanners(){
  var S = NBK.status, D = NBK.data, h = '';
  if (NBK.err) h += '<div class="nbk-ban red" data-nbk-ban="err"><b>⚠ 서버에서 예약을 읽지 못했어요</b><span>' + nbkQ(NBK.err) + '</span></div>';
  if (S && S.ok === false && (!D || String(S.at || '') >= String(D.at || ''))){
    if (S.reason === 'login'){
      h += '<div class="nbk-ban red" data-nbk-ban="login"><b>🔌 네이버 다시 연결이 필요해요</b>'
        + '<span>네이버 로그인(쿠키)이 만료돼 ' + nbkQ(nbkAgo(S.at)) + '부터 새 예약을 못 받고 있어요.' + (S.lastOkAt ? ' 아래 목록은 ' + nbkQ(nbkAgo(S.lastOkAt)) + ' 것입니다.' : '') + '</span>'
        + '<ol><li>맥 크롬에서 <b>partner.booking.naver.com</b> 에 로그인된 창을 열고 <b>⌘ + ⌥ + I</b> (개발자 도구)</li>'
        + '<li>위쪽 <b>Application</b> → 왼쪽 <b>Cookies</b> → <b>https://partner.booking.naver.com</b></li>'
        + '<li><b>NID_AUT</b> · <b>NID_SES</b> 두 값을 복사해 <code>NID_AUT=값; NID_SES=값</code> 모양으로</li>'
        + '<li>GitHub 저장소 → Settings → Secrets and variables → Actions → <b>NAVER_COOKIE</b> → Update</li>'
        + '<li>여기서 <b>⚡ 지금 받기</b> (또는 15분 기다리기)</li></ol></div>';
    } else {
      h += '<div class="nbk-ban amber" data-nbk-ban="http"><b>⚠ 네이버 응답이 이상해요 (코드 ' + nbkQ(S.code) + ')</b><span>15분 뒤 다시 시도합니다. 계속되면 Claude 에게 알려 주세요.</span></div>';
    }
  } else if (!D){
    h += '<div class="nbk-ban grey" data-nbk-ban="empty"><b>아직 받은 예약이 없어요</b><span>GitHub 「네이버 예약 수집」이 처음 돌면 채워집니다 (15분마다).</span></div>';
  } else {
    var age = Date.now() - Date.parse(D.at || '');
    if (age > 3 * 3600000) h += '<div class="nbk-ban amber" data-nbk-ban="stale"><b>⏳ 마지막 수집이 ' + nbkQ(nbkAgo(D.at)) + '이에요</b><span>GitHub 예약 실행이 밀릴 때가 있어요. 급하면 ⚡ 지금 받기.</span></div>';
  }
  if (D){
    var pe = NBK.piiErr;
    if (pe === 'nokey-server') h += '<div class="nbk-ban grey" data-nbk-ban="pii"><b>🔒 예약자 이름·전화는 아직 저장되지 않아요</b><span>GitHub 비밀값 <b>LUMEN_TEACHER_KEY</b>(서버 잠금 열쇠와 같은 값)를 넣으면 보입니다. 시간·상품·학생 연결은 그대로 보여요.</span></div>';
    else if (pe === 'nokey-device') h += '<div class="nbk-ban grey" data-nbk-ban="pii"><b>🔒 이 기기에는 서버 잠금 열쇠가 없어 이름·전화를 열 수 없어요</b><span>원장님 기기(열쇠를 넣은 PC·아이패드)에서만 보입니다.</span></div>';
    else if (pe === 'badkey') h += '<div class="nbk-ban amber" data-nbk-ban="pii"><b>🔒 이 기기의 열쇠로 이름·전화를 못 열었어요</b><span>GitHub 비밀값 LUMEN_TEACHER_KEY 와 이 기기의 서버 잠금 열쇠가 같은 값인지 확인해 주세요.</span></div>';
    else if (pe === 'nobox') h += '<div class="nbk-ban grey" data-nbk-ban="pii"><b>🔒 이름·전화 칸을 받지 못했어요</b><span>🔄 새로고침 해 보세요.</span></div>';
  }
  return h;
}

/* ── 학생 연결 ── */
function nbkStuCell(b){
  var m = nbkMatch(b), ed = !!NBK.edit[b.id], h = '';
  var howKo = { phone:'전화', name:'이름', manual:'직접' };
  if (m && m.st && !ed){
    return '<span class="nbk-stu" data-nbk-stu="' + nbkQ(m.stKey) + '">👤 ' + nbkQ(m.st.name) + (m.st.group ? ' <small>' + nbkQ(m.st.group) + '</small>' : '') + (howKo[m.how] ? ' <small class="nbk-how">' + howKo[m.how] + '</small>' : '')
      + '<button type="button" class="nbk-ed" title="다른 학생으로 바꾸기" data-nbk-id="' + nbkQ(b.id) + '" onclick="nbkEdit(this.getAttribute(\'data-nbk-id\'))">✎</button></span>';
  }
  if (m && m.none && !ed){
    return '<span class="nbk-stu none" data-nbk-stu="">🆕 명단에 없음<button type="button" class="nbk-ed" title="학생 연결" data-nbk-id="' + nbkQ(b.id) + '" onclick="nbkEdit(this.getAttribute(\'data-nbk-id\'))">✎</button></span>';
  }
  var cands = (b.cands || []).map(nbkStu).filter(Boolean);
  if (cands.length) h += '<small class="nbk-cand">형제·같은 이름 ' + cands.length + '명 — 골라 주세요</small>';
  h += '<select class="nbk-sel" data-nbk-id="' + nbkQ(b.id) + '" aria-label="학생 연결" onchange="nbkLink(this.getAttribute(\'data-nbk-id\'), this.value)">';
  h += '<option value="">' + (ed ? '학생 바꾸기…' : '🔗 학생 연결…') + '</option>';
  var seen = {};
  cands.forEach(function(s){ var k = nbStKey(s); seen[k] = 1; h += '<option value="' + nbkQ(k) + '">★ ' + nbkQ(s.name) + (s.group ? ' (' + nbkQ(s.group) + ')' : '') + '</option>'; });
  (typeof getSortedStudents === 'function' ? getSortedStudents() : nbkStus()).forEach(function(s){ var k = nbStKey(s); if (seen[k] || !k) return; h += '<option value="' + nbkQ(k) + '">' + nbkQ(s.name) + (s.group ? ' (' + nbkQ(s.group) + ')' : '') + '</option>'; });
  h += '<option value="__none">🆕 명단에 없음 (새 가족)</option>';
  if (Object.prototype.hasOwnProperty.call(NBK.links || {}, b.id)) h += '<option value="__clear">↩ 직접 연결 풀기 (자동으로)</option>';
  h += '</select>';
  if (ed) h += '<button type="button" class="nbk-ed" data-nbk-id="' + nbkQ(b.id) + '" onclick="nbkEdit(this.getAttribute(\'data-nbk-id\'))">취소</button>';
  return '<span class="nbk-stu pick">' + h + '</span>';
}
window.nbkEdit = function(id){ NBK.edit[id] = !NBK.edit[id]; render(); };
/* 저장 직전 서버의 연결표를 다시 읽어 합친다(다른 기기에서 고친 것을 덮지 않게) */
window.nbkLink = async function(id, v){
  if (!id || !v) return;
  var sb = getSupaClient(); var cur = {};
  try { var r = await sb.from('lumen_store').select('value').eq('key', 'naver_booking_links'); var x = nbkVal(r && r.data && r.data[0] && r.data[0].value); if (x && typeof x === 'object') cur = x; } catch(e){}
  Object.keys(NBK.links || {}).forEach(function(k){ if (!Object.prototype.hasOwnProperty.call(cur, k)) cur[k] = NBK.links[k]; });
  if (v === '__clear') delete cur[id];
  else cur[id] = (v === '__none') ? '' : v;
  NBK.links = cur; NBK.edit[id] = false;
  var ok = await supaSetItem('naver_booking_links', cur);
  var st = (v !== '__none' && v !== '__clear') ? nbkStu(v) : null;
  plToast(ok ? (st ? '🔗 ' + st.name + ' 학생과 연결했어요' : (v === '__none' ? '🆕 명단에 없는 예약으로 표시했어요' : '↩ 자동 연결로 돌렸어요')) : '⚠ 저장하지 못했어요 — 네트워크를 확인해 주세요');
  render();
};

/* ── 한 줄 ── */
function nbkRow(b){
  var p = nbkPii(b), cx = !nbkLive(b), stk = (b.status && b.status.k) || 'unknown';
  var h = '<div class="nbk-row' + (cx ? ' nbk-cx' : '') + '" data-nbk-row="' + nbkQ(b.id) + '" data-nbk-kind="' + nbkQ(b.item && b.item.kind) + '">';
  h += '<div class="nbk-time">' + (b.start ? nbkQ(b.start) : '종일') + (b.end && b.end !== b.start ? '<small>~' + nbkQ(b.end) + '</small>' : '') + '</div>';
  h += nbkKindBadge(b.item && b.item.kind);
  h += '<div class="nbk-main"><div class="nbk-who">';
  if (p && p.booker) h += '<b>' + nbkQ(p.booker) + '</b>';
  else h += '<b class="nbk-lock" title="이름·전화는 잠겨 있어요">예약자 🔒</b>';
  if (p && p.phone){ var dg = nbDigits(p.phone); h += ' <a class="nbk-tel" href="tel:' + nbkQ(dg) + '">📞 ' + nbkQ(p.phone) + '</a>'; }
  if ((b.count || 1) > 1) h += ' <span class="nbk-cnt">' + Number(b.count) + '명</span>';
  h += ' <small class="nbk-item">' + nbkQ(b.item && b.item.name) + '</small></div>';
  if (p && p.msg) h += '<div class="nbk-msg">💬 ' + nbkQ(p.msg) + '</div>';
  if (p && p.form && p.form.length) h += '<div class="nbk-form">' + p.form.map(function(f){ return '<span>' + (f.q ? nbkQ(f.q) + ': ' : '') + '<b>' + nbkQ(f.a) + '</b></span>'; }).join('') + '</div>';
  h += '</div>';
  h += '<span class="nbk-st st-' + nbkQ(stk) + '">' + nbkQ((b.status && b.status.label) || '') + '</span>';
  h += nbkStuCell(b);
  return h + '</div>';
}
function nbkGroupHtml(list, title, cls, desc){
  var by = {}, days = [];
  list.forEach(function(b){ if (!by[b.date]){ by[b.date] = []; days.push(b.date); } by[b.date].push(b); });
  days.sort(); if (desc) days.reverse();
  var h = '';
  days.forEach(function(d){
    var arr = by[d].slice().sort(function(a, b){ return String(a.start).localeCompare(String(b.start)); });
    var live = arr.filter(nbkLive).length;
    h += '<div class="nbk-day ' + (cls || '') + '" data-nbk-day="' + nbkQ(d) + '"><div class="nbk-dh">' + nbkQ(title || nbkDayLabel(d)) + ' <small>' + live + '건' + (arr.length > live ? ' · 취소 ' + (arr.length - live) : '') + '</small></div>';
    arr.forEach(function(b){ h += nbkRow(b); });
    h += '</div>';
  });
  return h;
}
/* 텐투텐 날짜별 인원 (오늘부터) */
function nbkTenten(today){
  var by = {};
  nbkAll().forEach(function(b){ if (b.item && b.item.kind === 'tenten' && nbkLive(b) && b.date >= today){ by[b.date] = (by[b.date] || 0) + (Number(b.count) || 1); } });
  var ds = Object.keys(by).sort();
  if (!ds.length) return '';
  return '<div class="nbk-tt" data-nbk-tenten="1"><b>🧮 텐투텐 인원</b>' + ds.slice(0, 10).map(function(d){ return '<span data-nbk-tt="' + nbkQ(d) + '">' + nbkQ(nbkMd(d)) + ' <b>' + by[d] + '명</b></span>'; }).join('') + '</div>';
}
window.nbkSetKind = function(k){ NBK.kind = k; render(); };

function rNaverBk(){
  nbkKick('naverbk');
  var h = '<div class="nbk-wrap">';
  h += '<div class="nbk-head"><div><div class="nbk-ttl">📅 네이버 예약</div><div class="nbk-sub">네이버 예약 파트너센터 → 15분마다 자동 · 출결은 바꾸지 않아요</div></div>'
    + '<div class="nbk-hr">' + (NBK.data ? '<span class="nbk-at" data-nbk-at="1">마지막으로 받은 때 ' + nbkQ(nbkAgo(NBK.data.at)) + '</span>' : '')
    + '<button type="button" class="nbk-btn" onclick="nbkRefresh()">🔄 새로고침</button><button type="button" class="nbk-btn" onclick="nbkRunNow()">⚡ 지금 받기</button></div></div>';
  if (!NBK.loaded) return h + '<div class="nbk-empty">📅 네이버 예약 불러오는 중…</div></div>';
  h += nbkBanners();
  var all = nbkAll(), today = nbTodayKst(), lo = nbAddDays(today, -7);
  var vis = all.filter(function(b){ return b.date >= lo; });
  var cnt = { all:0 }; vis.forEach(function(b){ var k = (b.item && b.item.kind) || 'etc'; cnt[k] = (cnt[k] || 0) + 1; cnt.all++; });
  h += '<div class="nbk-chips">';
  var chip = function(k, label){ var on = NBK.kind === k; return '<button type="button" class="nbk-chip' + (on ? ' on' : '') + '" data-nbk-chip="' + k + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="nbkSetKind(\'' + k + '\')">' + nbkQ(label) + ' <small>' + (cnt[k] || 0) + '</small></button>'; };
  h += chip('all', '전체');
  NB_KINDS.forEach(function(K){ if (K.k === 'etc' && !cnt.etc) return; h += chip(K.k, K.label); });
  h += '</div>';
  if (NBK.kind === 'all' || NBK.kind === 'tenten') h += nbkTenten(today);
  var f = vis.filter(function(b){ return NBK.kind === 'all' || (b.item && b.item.kind) === NBK.kind; });
  var tod = f.filter(function(b){ return b.date === today; }), up = f.filter(function(b){ return b.date > today; }), past = f.filter(function(b){ return b.date < today; });
  h += '<div class="nbk-sec" data-nbk-sec="today"><div class="nbk-sh">오늘 · ' + nbkQ(nbkDayLabel(today)) + '</div>' + (tod.length ? nbkGroupHtml(tod, '오늘', 'today') : '<div class="nbk-none">오늘 예약이 없어요</div>') + '</div>';
  h += '<div class="nbk-sec" data-nbk-sec="up"><div class="nbk-sh">다가오는 예약</div>' + (up.length ? nbkGroupHtml(up) : '<div class="nbk-none">다가오는 예약이 없어요</div>') + '</div>';
  h += '<details class="nbk-sec nbk-past" data-nbk-sec="past"' + (NBK.pastOpen ? ' open' : '') + ' ontoggle="NBK.pastOpen=this.open"><summary class="nbk-sh">지난 7일 <small>' + past.length + '건</small></summary>' + (past.length ? nbkGroupHtml(past, '', '', true) : '<div class="nbk-none">없어요</div>') + '</details>';
  return h + '</div>';
}
window.rNaverBk = rNaverBk;

/* ═══ 🚑 리커버리 보드 ═══ */
function nbkHas(){ return !!(NBK.data && NBK.data.bookings); }
/* 그 학생의 그 날 리커버리 예약(취소 빼고, 이른 시간 먼저) */
function nbkRecOf(k, ymd){
  var out = nbkAll().filter(function(b){ if (!(b.item && b.item.kind === 'recovery') || b.date !== ymd || !nbkLive(b)) return false; var m = nbkMatch(b); return m && m.st && m.stKey === String(k); });
  out.sort(function(a, b){ return String(a.start).localeCompare(String(b.start)); });
  return out[0] || null;
}
function nbkRcBadge(c, recDt, big){
  var b = nbkRecOf(c.k, recDt), e = c.e || {}, done = !!e.done, kq = nbkQ(String(c.k));
  if (!b) return done ? '' : '<span class="nbk-rcb no" data-nbk-rc="no" title="' + nbkQ(nbkMd(recDt)) + ' 리커버리 네이버 예약이 아직 없어요">예약 아직</span>';
  var t = b.start || '', h = '<span class="nbk-rcb ok" data-nbk-rc="ok" title="네이버 예약 · ' + nbkQ(b.status && b.status.label) + '">✓ 네이버 예약 ' + nbkQ(t) + '</span>';
  if (big || done || !t) return h;
  if (!e.slot) h += '<button type="button" class="nbk-rcslot" data-nbk-slot="' + kq + '" data-nbk-t="' + nbkQ(t) + '" onclick="nbkRcSlot(this.getAttribute(\'data-nbk-slot\'), this.getAttribute(\'data-nbk-t\'))">시간 넣기</button>';
  else if (e.slot !== t) h += '<button type="button" class="nbk-rcslot warn" data-nbk-slot="' + kq + '" data-nbk-t="' + nbkQ(t) + '" title="배정한 시간(' + nbkQ(e.slot) + ')과 예약 시간이 달라요" onclick="nbkRcSlot(this.getAttribute(\'data-nbk-slot\'), this.getAttribute(\'data-nbk-t\'))">⚠ ' + nbkQ(e.slot) + ' → ' + nbkQ(t) + '</button>';
  return h;
}
/* 「시간 넣기」 — 누를 때만 그 학생 시간 칸에 예약 시간을 넣는다 (자동으로 덮지 않음) */
window.nbkRcSlot = function(k, t){
  if (k == null || !t) return;
  var wk = rcWeekKey(); var W = RC.state.calls[wk] = RC.state.calls[wk] || {}; var e = W[k] = W[k] || {};
  e.slot = t;
  rcSaveState(); render();
  plToast('🕑 네이버 예약 시간 ' + t + ' 을 넣었어요');
};
/* 확정 명단에 없는(또는 학생을 못 맞춘) 그 날 리커버리 예약 */
function nbkRcSide(conf, recDt){
  var inConf = {}; (conf || []).forEach(function(c){ inConf[String(c.k)] = 1; });
  var list = nbkAll().filter(function(b){ if (!(b.item && b.item.kind === 'recovery') || b.date !== recDt || !nbkLive(b)) return false; var m = nbkMatch(b); return !(m && m.st && inConf[m.stKey]); });
  if (!list.length) return '';
  list.sort(function(a, b){ return String(a.start).localeCompare(String(b.start)); });
  var h = '<div class="nbk-rcside" data-nbk-rcside="1"><b>📅 예약했지만 명단에 없음 · ' + list.length + '</b>';
  list.forEach(function(b){
    var m = nbkMatch(b), p = nbkPii(b);
    h += '<div class="nbk-rcs-row" data-nbk-row="' + nbkQ(b.id) + '"><span class="t">' + nbkQ(b.start || '') + '</span><span class="n">' + nbkQ(m && m.st ? m.st.name : ((p && p.booker) || '학생 연결 안 됨')) + '</span>';
    if (m && m.st) h += '<button type="button" class="nbk-rcadd" data-nbk-add="' + nbkQ(m.stKey) + '" onclick="rcManualAdd({ value: this.getAttribute(\'data-nbk-add\') })">＋ 확정 명단에</button>';
    else h += '<button type="button" class="nbk-rcadd" onclick="VIEW=\'naverbk\';NBK.kind=\'recovery\';renderFuncTab()">🔗 연결하기</button>';
    h += '</div>';
  });
  return h + '</div>';
}
/* 오른쪽 확정 명단 줄마다 이름 뒤에 배지 + 「예약했지만 명단에 없음」 */
var _rcSidePanel124 = rcSidePanel;
rcSidePanel = function(conf, wk){
  var h = _rcSidePanel124.apply(this, arguments);
  try {
    if (!NBK.loaded){ nbkKick('recovery'); return h; }
    nbkKick('recovery');
    if (!nbkHas()) return h;
    var recDt = rcRecDate(wk), pos = 0;
    (conf || []).forEach(function(c){
      var done = !!(c.e && c.e.done);
      var mk = '<span style="font-size:13.5px;font-weight:900;color:#0d2240">' + (done ? '✅ ' : '') + esc2(c.name) + '</span>';
      var i = h.indexOf(mk, pos); if (i < 0) return;
      var j = i + mk.length, bd = nbkRcBadge(c, recDt, false);
      h = h.slice(0, j) + bd + h.slice(j); pos = j + bd.length;
    });
    var side = nbkRcSide(conf, recDt);
    var anc = '<div style="display:flex;gap:9px;align-items:flex-start;background:#f0fdf4;border:1.5px solid #bbf7d0;';
    var a = h.indexOf(anc);
    if (side) h = (a >= 0) ? (h.slice(0, a) + side + h.slice(a)) : (h + side);
  } catch(e){ try { console.error('[네이버 예약 · 리커버리]', e); } catch(_){} }
  return h;
};
/* 가운데 학생 카드(호출 확정한 학생)에도 작은 배지 */
var _rRecovery124 = rRecovery;
rRecovery = function(){
  var h = _rRecovery124.apply(this, arguments);
  try {
    if (!NBK.loaded || !nbkHas() || RC.view !== 'board' || !RC.loaded) return h;
    var wk = rcWeekKey(), W = (RC.state.calls || {})[wk] || {}, recDt = rcRecDate(wk), pos = 0;
    rcRows().forEach(function(x){
      var mk = '<span style="font-size:19px;font-weight:900;color:#0d2240">' + esc2(x.st.name) + '</span>';
      var i = h.indexOf(mk, pos); if (i < 0) return;
      var j = i + mk.length, e = W[x.stKey] || {};
      if (!e.on && !e.done){ pos = j; return; }
      var bd = nbkRcBadge({ k:x.stKey, e:e }, recDt, true);
      h = h.slice(0, j) + bd + h.slice(j); pos = j + bd.length;
    });
  } catch(e){ try { console.error('[네이버 예약 · 리커버리 카드]', e); } catch(_){} }
  return h;
};

/* ═══ 🏠 홈 — 오늘 네이버 예약 (작게) ═══ */
window.nbkHomeCard = function(){
  if (!NBK.loaded){ nbkKick('home'); return ''; }
  nbkKick('home');
  var S = NBK.status, bad = S && S.ok === false && S.reason === 'login';
  if (!NBK.data && !bad) return '';
  var today = nbTodayKst();
  var list = nbkAll().filter(function(b){ return b.date === today && nbkLive(b); }).sort(function(a, b){ return String(a.start).localeCompare(String(b.start)); });
  var h = '<div class="nbk-home" data-nbk-home="1"><div class="nbk-hh"><b>📅 오늘 네이버 예약 ' + list.length + '건</b>'
    + '<span class="nbk-go" onclick="VIEW=\'naverbk\';renderFuncTab()">전체 보기 ›</span></div>';
  if (bad) h += '<div class="nbk-hbad" onclick="VIEW=\'naverbk\';renderFuncTab()">🔌 네이버 다시 연결이 필요해요 — 눌러서 방법 보기</div>';
  if (!list.length && !bad) h += '<div class="nbk-hnone">오늘 예약 없음</div>';
  list.slice(0, 6).forEach(function(b){ h += '<div class="nbk-hrow"><span class="t">' + nbkQ(b.start || '종일') + '</span>' + nbkKindBadge(b.item && b.item.kind) + '<span class="n">' + nbkQ(nbkWho(b)) + '</span></div>'; });
  if (list.length > 6) h += '<div class="nbk-hnone">＋ ' + (list.length - 6) + '건 더</div>';
  return h + '</div>';
};

/* ── 모양 ── */
(function(){
  if (document.getElementById('nbk-css')) return;
  var st = document.createElement('style'); st.id = 'nbk-css';
  st.textContent = ''
    + '.nbk-wrap{padding:18px 22px 40px;max-width:1120px}'
    + '.nbk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}'
    + '.nbk-ttl{font-size:22px;font-weight:900;color:#0d2240}.nbk-sub{font-size:12px;color:#94a3b8;font-weight:700;margin-top:2px}'
    + '.nbk-hr{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.nbk-at{font-size:11.5px;font-weight:800;color:#64748b}'
    + '.nbk-btn{border:1px solid #e2e8f0;background:#fff;color:#334155;font-family:inherit;font-size:12px;font-weight:800;padding:6px 12px;border-radius:50px;cursor:pointer}'
    + '.nbk-ban{border-radius:12px;padding:11px 14px;margin-bottom:10px;font-size:12.5px;line-height:1.6;font-weight:700;display:flex;flex-direction:column;gap:2px}'
    + '.nbk-ban b{font-size:14px;font-weight:900}.nbk-ban ol{margin:6px 0 0 18px;padding:0}.nbk-ban code{background:rgba(255,255,255,.7);border-radius:5px;padding:0 4px}'
    + '.nbk-ban.red{background:#fef2f2;border:1.5px solid #fca5a5;color:#991b1b}.nbk-ban.amber{background:#fffbeb;border:1.5px solid #fcd34d;color:#92400e}.nbk-ban.grey{background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569}'
    + '.nbk-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}'
    + '.nbk-chip{border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:50px;padding:6px 13px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer}.nbk-chip small{opacity:.7;font-weight:800}'
    + '.nbk-chip.on{background:#0d2240;border-color:#0d2240;color:#fff}'
    + '.nbk-tt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:8px 12px;margin-bottom:12px;font-size:12px;font-weight:800;color:#5b21b6}'
    + '.nbk-tt span{background:#fff;border-radius:8px;padding:3px 9px}'
    + '.nbk-sec{margin-bottom:14px}.nbk-sh{font-size:14px;font-weight:900;color:#0d2240;margin:4px 0 8px;cursor:default}.nbk-past>summary{cursor:pointer}.nbk-sh small{color:#94a3b8;font-weight:800}'
    + '.nbk-day{background:#fff;border:1.5px solid #eef2f7;border-radius:14px;padding:8px 12px;margin-bottom:9px}.nbk-day.today{border-color:#bfdbfe;background:#f8fbff}'
    + '.nbk-dh{font-size:12.5px;font-weight:900;color:#334155;padding:2px 0 6px}.nbk-dh small{color:#94a3b8;font-weight:800}'
    + '.nbk-row{display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap}.nbk-day .nbk-row:first-of-type{border-top:none}'
    + '.nbk-row.nbk-cx{opacity:.45}.nbk-row.nbk-cx .nbk-time{text-decoration:line-through}'
    + '.nbk-time{min-width:52px;font-size:15px;font-weight:900;color:#0d2240;line-height:1.2}.nbk-time small{display:block;font-size:10.5px;color:#94a3b8;font-weight:800}'
    + '.nbk-kind{flex:none;font-size:11px;font-weight:900;border-radius:7px;padding:3px 8px;margin-top:1px}'
    + '.nbk-main{flex:1;min-width:180px}.nbk-who{font-size:13.5px;font-weight:800;color:#0f172a}.nbk-lock{color:#94a3b8}.nbk-item{color:#94a3b8;font-weight:700}'
    + '.nbk-tel{color:#0369a1;text-decoration:none;font-weight:800;white-space:nowrap}.nbk-cnt{background:#ede9fe;color:#5b21b6;border-radius:6px;padding:1px 6px;font-size:11px}'
    + '.nbk-msg{font-size:12.5px;color:#334155;font-weight:600;margin-top:3px;white-space:pre-wrap;word-break:break-word}'
    + '.nbk-form{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;color:#64748b;margin-top:3px}'
    + '.nbk-st{flex:none;font-size:11px;font-weight:900;border-radius:50px;padding:3px 9px;background:#f1f5f9;color:#475569;margin-top:1px}'
    + '.nbk-st.st-confirmed{background:#dcfce7;color:#15803d}.nbk-st.st-requested{background:#fef3c7;color:#92400e}.nbk-st.st-cancelled{background:#fee2e2;color:#b91c1c}.nbk-st.st-completed{background:#e0e7ff;color:#3730a3}.nbk-st.st-noshow{background:#7f1d1d;color:#fff}'
    + '.nbk-stu{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:4px 9px}'
    + '.nbk-stu small{color:#64748b;font-weight:800}.nbk-stu .nbk-how{background:#fff;border-radius:6px;padding:0 5px}.nbk-stu.none{background:#fffbeb;border-color:#fde68a}.nbk-stu.pick{background:#fff;border-style:dashed;border-color:#cbd5e1}'
    + '.nbk-ed{border:none;background:none;color:#64748b;cursor:pointer;font-family:inherit;font-size:12px;font-weight:900}'
    + '.nbk-sel{font-family:inherit;font-size:12px;font-weight:800;border:1px solid #cbd5e1;border-radius:8px;padding:4px 6px;max-width:200px;background:#fff}'
    + '.nbk-cand{color:#b45309;font-weight:800}'
    + '.nbk-none,.nbk-empty{font-size:12.5px;color:#94a3b8;font-weight:700;padding:8px 2px}.nbk-empty{padding:50px;text-align:center}'
    + '.nbk-rcb{display:inline-block;font-size:10.5px;font-weight:900;border-radius:20px;padding:2px 8px;margin-left:4px}.nbk-rcb.ok{background:#dcfce7;color:#15803d}.nbk-rcb.no{background:#f1f5f9;color:#94a3b8;border:1px dashed #cbd5e1}'
    + '.nbk-rcslot{border:1.5px solid #1d6fe8;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:3px 8px;font-family:inherit;font-size:10.5px;font-weight:900;cursor:pointer;margin-left:3px}.nbk-rcslot.warn{border-color:#f59e0b;background:#fffbeb;color:#b45309}'
    + '.nbk-rcside{border:1.5px solid #fde68a;background:#fffbeb;border-radius:11px;padding:9px 11px;margin:6px 0 10px;font-size:12px;color:#92400e}.nbk-rcside>b{display:block;margin-bottom:5px}'
    + '.nbk-rcs-row{display:flex;align-items:center;gap:7px;padding:3px 0;font-weight:800;color:#334155}.nbk-rcs-row .t{min-width:40px;color:#0d2240;font-weight:900}.nbk-rcs-row .n{flex:1;min-width:0}'
    + '.nbk-rcadd{border:1px solid #e2e8f0;background:#fff;color:#334155;border-radius:7px;padding:3px 8px;font-family:inherit;font-size:10.5px;font-weight:900;cursor:pointer}'
    + '.nbk-home{background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:11px 15px;margin-bottom:14px;box-shadow:0 2px 8px rgba(13,34,64,0.05)}'
    + '.nbk-hh{display:flex;align-items:center;justify-content:space-between;font-size:13.5px;color:#0d2240;margin-bottom:5px}.nbk-go{font-size:11px;color:#1d6fe8;font-weight:800;cursor:pointer}'
    + '.nbk-hrow{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;color:#334155;padding:2px 0}.nbk-hrow .t{min-width:42px;color:#0d2240;font-weight:900}'
    + '.nbk-hnone{font-size:12px;color:#94a3b8;font-weight:700}.nbk-hbad{font-size:12px;font-weight:900;color:#b91c1c;background:#fef2f2;border-radius:8px;padding:5px 9px;margin-bottom:4px;cursor:pointer}'
    + '@media(max-width:640px){.nbk-wrap{padding:14px 12px 30px}.nbk-main{min-width:0;flex-basis:100%}.nbk-sel{max-width:100%}}';
  (document.head || document.documentElement).appendChild(st);
})();
