/* ═══════════════════════════════════════════════════════════════════
 * v19-127: 📊 예약 통계 — 네이버 예약 «전체 보관»으로 통계 · 학생별 월간 참여(학부모 카톡) · 텐투텐 주말 체크
 *   (원장 2026-10-17: A 시안 1번 그대로 · B 학생별 리커버리·텐투텐 횟수 → 학부모 카톡 글 · C 중·고등 텐투텐 주말 필수 → 안 한 학생 · 많이 한 학생)
 *
 *  자료 (lumen_store — 화면이 서버에서 바로 읽는다 · 시작 다운로드 제외 build_app.py v19-127 PULL_SKIP_KEYS)
 *    naver_bookings_archive {at, v, h, items, n, from, to, rows:[{id, kind, item, date, start, st, code, reg, conf, comp, canc, cnt, area, stu, how, fp, sch, gr}]}
 *        수집기(sync/naver_booking_collect.js)가 15분마다 — 이름·전화·메모 없음 · 빈 칸은 줄에서 빠져 있다
 *    naver_bookings  (v19-124 NBK) — 이번 주 최신 상태 · 원장님이 직접 고른 학생 연결(naver_booking_links)
 *    naver_msg_tpl   {tpl, h4, h1, h0} — 학부모 카톡 글 틀 (이 화면에서 고침)
 *    tenten_optional {학생 키: true} — 텐투텐 「필수 아님」 학생 (이 화면에서 고침)
 *    or_studentdb    (앱의 students) — 학생 이름·학년·반 (화면에만, 서버에 다시 쓰지 않는다)
 *
 *  화면 「수업·출결 › 예약 통계」 (VIEW 'naverstats', 「네이버 예약」 바로 뒤) — 위에서 아래로
 *    a 숫자 칸(기간: 연도 · 달)  b 달마다 예약 수(쌓은 막대 SVG)  c 텐투텐·리커버리 요일 × 시간
 *    d 종류별 취소율·예약~이용 중앙값·당일 예약  e 유입 경로 · 메모의 학년/학교
 *    f 👨‍👩‍👧 학생별 월간 참여 + 📋 카톡(한 명 · 전체)  g 🔟 텐투텐 주말 체크(예약 안 한 학생 · TOP 5 · 금요일 안내 글)
 *  홈: 「오늘 네이버 예약」 칸 아래(금·토만) 「🔟 이번 주말 텐투텐 미예약 n명 ›」
 *
 *  ★ 셈 규칙은 nbsRule · nbsStuKey · nbsStuMonth · nbsDayMark · nbsWeekend 한 곳 — 표·카톡 글·주말 체크·홈 칸이 모두 이것만 쓴다 (아래 «셈 규칙»).
 *  문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면·복사 글에만(서버·로그에 안 남김).
 * ═══════════════════════════════════════════════════════════════════ */
var NBS = { loaded:false, loading:false, loadP:null, at:0, optAt:0, arch:null, tpl:null, opt:{}, err:'', y:'', m:'', pm:'', wm:'', show0:true, tplOpen:false, lastCopy:'' };
var NBS_TTL = 120000;
var NBS_KEYS = ['naver_bookings_archive', 'naver_msg_tpl', 'tenten_optional'];
var NBS_KEYS_LITE = ['naver_msg_tpl', 'tenten_optional'];
var NBS_ORDER = ['tenten', 'recovery', 'kmm', 'counsel', 'tlp', 'consult', 'etc'];
var NBS_WD = ['일', '월', '화', '수', '목', '금', '토'];
var NBS_TPL_DEF = {
  tpl: '[루멘수학] {학생}이(가) {월}월에 텐투텐 {텐투텐}회, 리커버리 {리커버리}회 참여했습니다. {한마디}',
  h4: '꾸준히 잘 참여하고 있어요.',
  h1: '다음 달엔 조금 더 자주 보면 좋겠어요.',
  h0: '다음 달엔 주말 텐투텐 참여를 부탁드려요.'
};

/* ── 메뉴: 「수업·출결」의 네이버 예약 바로 뒤 (아이콘 = 네이버 로고, 없으면 📊) ── */
(function(){
  try {
    var g = (GROUPS || []).filter(function(x){ return x.key === 'class'; })[0]; if (!g) return;
    if (g.subs.some(function(s){ return s.v === 'naverstats'; })) return;
    var at = g.subs.length; g.subs.forEach(function(s, j){ if (s.v === 'naverbk') at = j + 1; });
    g.subs.splice(at, 0, { v:'naverstats', icon:(typeof nbkLogo === 'function' ? nbkLogo() : '📊'), label:'예약 통계', act:function(){ VIEW = 'naverstats'; nbsKick('naverstats', true); } });
  } catch(e){ try { console.error('[예약 통계 메뉴]', e); } catch(_){} }
})();

function nbsQ(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function nbsVal(v){ if (typeof v === 'string'){ try { return JSON.parse(v); } catch(e){ return null; } } return v; }
function nbsHas(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); }
function nbsWd(ymd){ var d = new Date(String(ymd) + 'T00:00:00Z'); return isNaN(d) ? -1 : d.getUTCDay(); }
function nbsKind(k){ k = String(k || ''); return (!k || k === 'other') ? 'etc' : k; }
function nbsMd(ymd){ return Number(String(ymd).slice(5, 7)) + '/' + Number(String(ymd).slice(8, 10)); }
function nbsYmLabel(ym){ return String(ym).slice(0, 4) + '년 ' + Number(String(ym).slice(5, 7)) + '월'; }
function nbsYmAdd(ym, n){ var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }
function nbsHourLabel(h){ h = Number(h); if (h < 12) return '오전 ' + h + '시'; if (h === 12) return '낮 12시'; return (h < 18 ? '오후 ' : '저녁 ') + (h - 12) + '시'; }
function nbsRgba(hex, a){ var m = String(hex || '').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); if (!m) return 'rgba(100,116,139,' + a + ')'; return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')'; }
function nbsKI(k){ return (typeof nbKindInfo === 'function') ? nbKindInfo(k) : { k:k, label:k, short:k, color:'#475569', bg:'#f1f5f9' }; }
function nbsToday(){ return (typeof nbTodayKst === 'function') ? nbTodayKst() : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function nbsAdd(ymd, n){ return (typeof nbAddDays === 'function') ? nbAddDays(ymd, n) : new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }

/* ── 불러오기 (2분 캐시) — 홈은 작은 두 칸(글 틀 · 필수 아님)만 ── */
function nbsLoad(force, lite){
  if (NBS.loading) return NBS.loadP;
  var sb = (typeof getSupaClient === 'function') ? getSupaClient() : null;
  if (!sb){ NBS.loaded = true; NBS.at = NBS.optAt = Date.now(); return Promise.resolve(); }
  NBS.loading = true;
  var keys = lite ? NBS_KEYS_LITE : NBS_KEYS;
  NBS.loadP = (async function(){
    try {
      var r = await sb.from('lumen_store').select('key,value').in('key', keys);
      if (r && r.error) throw r.error;
      var m = {}; ((r && r.data) || []).forEach(function(row){ m[row.key] = nbsVal(row.value); });
      if (!lite){ var A = m.naver_bookings_archive; NBS.arch = (A && Array.isArray(A.rows)) ? A : null; }
      NBS.tpl = nbsTplNorm(m.naver_msg_tpl);
      NBS.opt = (m.tenten_optional && typeof m.tenten_optional === 'object' && !Array.isArray(m.tenten_optional)) ? m.tenten_optional : {};
      NBS.err = '';
    } catch(e){ NBS.err = (e && e.message) || String(e); }
    if (!lite){ NBS.loaded = true; NBS.at = Date.now(); }
    NBS.optAt = Date.now(); NBS.loading = false;
  })();
  return NBS.loadP;
}
function nbsKick(view, force){
  try { if (typeof nbkKick === 'function') nbkKick(view, force); } catch(e){}   /* 이번 주 최신 상태 · 직접 연결표 */
  if (NBS.loading) return;
  if (!force && NBS.loaded && Date.now() - NBS.at < NBS_TTL) return;
  nbsLoad(!!force).then(function(){ try { if (VIEW === view) render(); } catch(e){} });
}
function nbsKickLite(view){
  if (NBS.loading || (NBS.optAt && Date.now() - NBS.optAt < 10 * 60000)) return;
  nbsLoad(false, true).then(function(){ try { if (VIEW === view) render(); } catch(e){} });
}
window.nbsRefresh = function(){
  var p = [nbsLoad(true)]; try { if (typeof nbkLoad === 'function') p.push(nbkLoad(true)); } catch(e){}
  Promise.all(p).then(function(){ render(); plToast('📊 예약 통계를 다시 읽었어요'); });
};

/* ═══ 셈 규칙 (한 곳) ═══════════════════════════════════════════════
 *  예약 한 건 r = {id, kind, date(이용일 KST), start, st, stu0(수집기 연결), reg, cnt, area, sch, gr}
 *  ① 상태 (nbsRule)
 *     · 참여 1회(count)   = 완료(completed) 또는 확정(confirmed). 신청(확정 대기)·취소·노쇼는 «참여»로 세지 않는다.
 *     · 노쇼(noshow)      = 따로 센다(참여 아님).
 *     · 예약됨(booked)    = 완료 · 확정 · 신청 — 주말 체크에서 «예약했다»로 본다(신청은 「대기」 표시).
 *     · 취소(cx)          = 취소. 그 날 살아 있는 예약이 없을 때만 ✕ 로 보인다.
 *  ② 학생 (nbsStuKey) = 원장님 직접 연결(naver_booking_links, ''=명단에 없음) > 수집기 연결(stu) · 등록부에 있고 퇴원 안 한 학생만.
 *     못 맞춘(또는 퇴원생) 예약은 학생 표에서 빠지고 「학생과 연결 안 된 예약 n건」으로만 센다.
 *  ③ 같은 학생 · 같은 종류 · 같은 날 여러 건 → 1회 (하루에 한 번 온 것으로). 날짜·달은 이용일 기준.
 *  ④ 텐투텐 주말 체크: 토·일 중 하루라도 «예약됨»이면 그 주말은 했다. 대상 = 학년에 「중학교」·「고등학교」가 있는 재원생 − 「필수 아님」.
 *  ⑤ 통계 a~e 의 건수는 «예약 건수»(취소 포함, 인원 수 아님). 요일·시간 표는 취소를 뺀다.
 * ═══════════════════════════════════════════════════════════════════ */
function nbsRule(r){
  var st = String((r && r.st) || '');
  return { count: st === 'completed' || st === 'confirmed', noshow: st === 'noshow', booked: st === 'completed' || st === 'confirmed' || st === 'requested',
           cx: st === 'cancelled', wait: st === 'requested', done: st === 'completed' };
}
function nbsStus(){ return (typeof students !== 'undefined' && students) ? students : []; }
function nbsKeyOf(s){ return (typeof nbStKey === 'function') ? nbStKey(s) : String((s && (s.id || s.name)) || ''); }
function nbsStu(k){ var a = nbsStus(); for (var i = 0; i < a.length; i++) if (nbsKeyOf(a[i]) === String(k)) return a[i]; return null; }
function nbsActive(k){ var s = k ? nbsStu(k) : null; return (s && s.name && !s.withdrawn) ? s : null; }
function nbsStuKey(r){
  var L = (typeof NBK !== 'undefined' && NBK && NBK.links) || {};
  if (nbsHas(L, r.id)){ var k = L[r.id]; if (k === '' || k == null) return ''; if (nbsActive(k)) return String(k); }
  if (r.none) return '';
  return (r.stu0 && nbsActive(r.stu0)) ? String(r.stu0) : '';
}
/* 보관(archive) + 이번 주 목록(naver_bookings) 합치기 — 같은 예약이면 더 새로 받은 쪽의 상태·날짜·학생을 쓴다 */
function nbsRows(){
  var A = (NBS.arch && NBS.arch.rows) || [], by = {}, out = [];
  A.forEach(function(r){
    if (!r || r.id == null || !r.date) return;
    var o = { id:String(r.id), kind:nbsKind(r.kind), date:String(r.date), start:String(r.start || ''), st:String(r.st || ''), stu0:String(r.stu || ''), reg:String(r.reg || ''),
              cnt:Number(r.cnt) || 1, area:String(r.area || ''), sch:String(r.sch || ''), gr:String(r.gr || ''), fp:String(r.fp || '') };
    if (by[o.id]) return; by[o.id] = o; out.push(o);
  });
  var D = (typeof NBK !== 'undefined' && NBK && NBK.data && NBK.data.bookings) || [];
  var newer = !NBS.arch || String((NBK.data && NBK.data.at) || '') >= String(NBS.arch.at || '');
  D.forEach(function(b){
    if (!b || b.id == null || !b.date) return;
    var n = { id:String(b.id), kind:nbsKind(b.item && b.item.kind), date:String(b.date), start:String(b.start || ''), st:String((b.status && b.status.k) || ''),
              stu0:String((b.match && b.match.stKey) || ''), none:!!b.noStudent, reg:String(b.reg || ''), cnt:Number(b.count) || 1, area:'', sch:'', gr:'', fp:'' };
    var o = by[n.id];
    if (!o){ by[n.id] = n; out.push(n); return; }
    if (newer){ o.kind = n.kind; o.date = n.date; o.start = n.start; o.st = n.st; o.stu0 = n.stu0; o.none = n.none; o.cnt = n.cnt; if (n.reg) o.reg = n.reg; }
  });
  out.sort(function(a, b){ return (a.date + a.start + a.id) < (b.date + b.start + b.id) ? -1 : 1; });
  return out;
}
function nbsZero(){ return { tenten:0, recovery:0, kmm:0, tlp:0, counsel:0, consult:0, etc:0, noshow:0 }; }
/* 학생별 그 달 참여 → {by:{학생 키: {tenten, recovery, kmm, tlp, …, noshow}}, unmatched: 학생 못 맞춘 «참여» 예약 수} */
function nbsStuMonth(rows, ym){
  var M = {}, seen = {}, un = 0;
  (rows || []).forEach(function(r){
    if (String(r.date).slice(0, 7) !== ym) return;
    var R = nbsRule(r); if (!R.count && !R.noshow) return;
    var k = nbsStuKey(r);
    if (!k){ if (R.count && /^(tenten|recovery|kmm|tlp)$/.test(r.kind)) un++; return; }
    var e = M[k] = M[k] || nbsZero();
    var dk = k + '|' + (R.noshow ? 'ns' : r.kind) + '|' + r.date;
    if (seen[dk]) return; seen[dk] = 1;
    if (R.noshow) e.noshow++; else e[r.kind] = (e[r.kind] || 0) + 1;
  });
  return { by:M, unmatched:un };
}
/* 그 학생 · 그 날 텐투텐 표시 → {m:'done'|'ok'|'wait'|'ns'|'cx'|'no', t:'시간', ok:주말 인정} */
function nbsDayMark(rows, k, ymd, today){
  var list = (rows || []).filter(function(r){ return r.kind === 'tenten' && r.date === ymd && nbsStuKey(r) === String(k); });
  var live = list.filter(function(r){ return nbsRule(r).booked; }).sort(function(a, b){ return a.start < b.start ? -1 : 1; });
  if (live.length){
    var d = live.filter(function(r){ return nbsRule(r).done; })[0];
    if (d && ymd <= today) return { m:'done', t:d.start, ok:true };
    var c = live.filter(function(r){ return !nbsRule(r).wait; })[0];
    if (c) return { m:'ok', t:c.start, ok:true };
    return { m:'wait', t:live[0].start, ok:true };
  }
  if (list.some(function(r){ return nbsRule(r).noshow; })) return { m:'ns', t:'', ok:false };
  if (list.some(function(r){ return nbsRule(r).cx; })) return { m:'cx', t:'', ok:false };
  return { m:'no', t:'', ok:false };
}
/* 텐투텐 필수 대상 (중·고등 재원생 · 학년 순 → 이름 순) */
function nbsGradeNo(s){ var g = String((s && s.grade) || ''), n = Number((g.match(/(\d)\s*학년/) || [])[1] || 0); return (/고등학교/.test(g) ? 20 : (/중학교/.test(g) ? 10 : 0)) + n; }
function nbsMandatory(){
  return nbsStus().filter(function(s){ return s && s.name && !s.withdrawn && /중학교|고등학교/.test(String(s.grade || '')); })
    .sort(function(a, b){ return (nbsGradeNo(a) - nbsGradeNo(b)) || String(a.name).localeCompare(String(b.name), 'ko'); });
}
function nbsOptional(k){ return !!(NBS.opt && NBS.opt[k]); }
/* 그 주말(토 sat · 일 sat+1) → {sat, sun, list:[{k, s, a, b, ok, opt}], miss:[…예약 안 한 필수 학생]} */
function nbsWeekend(rows, sat, today){
  var sun = nbsAdd(sat, 1), list = [], miss = [];
  nbsMandatory().forEach(function(s){
    var k = nbsKeyOf(s), a = nbsDayMark(rows, k, sat, today), b = nbsDayMark(rows, k, sun, today);
    var x = { k:k, s:s, a:a, b:b, ok:a.ok || b.ok, opt:nbsOptional(k) };
    list.push(x); if (!x.ok && !x.opt) miss.push(x);
  });
  return { sat:sat, sun:sun, list:list, miss:miss };
}
/* 다가오는 주말의 토요일 — 일요일이면 어제(이번 주말) */
function nbsComingSat(today){ var wd = nbsWd(today); return wd === 0 ? nbsAdd(today, -1) : nbsAdd(today, 6 - wd); }
/* 그 달에 걸친 주말들(토 또는 일이 그 달) + 다가오는 주말 */
function nbsWeekends(ym, today){
  var out = [], d = nbsAdd(ym + '-01', -1), coming = nbsComingSat(today);
  while (d.slice(0, 7) <= ym){
    if (nbsWd(d) === 6 && (d.slice(0, 7) === ym || nbsAdd(d, 1).slice(0, 7) === ym)) out.push(d);
    d = nbsAdd(d, 1);
  }
  if (out.indexOf(coming) < 0) out.push(coming);
  return out.sort();
}

/* ── 학부모 카톡 글 ── */
function nbsTplNorm(t){
  var o = {}; t = (t && typeof t === 'object') ? t : {};
  ['tpl', 'h4', 'h1', 'h0'].forEach(function(k){ o[k] = (typeof t[k] === 'string' && t[k].trim()) ? t[k] : NBS_TPL_DEF[k]; });
  return o;
}
function nbsTpl(){ return NBS.tpl || nbsTplNorm(null); }
/* 이름 끝 글자 받침으로 「이/가」 같은 토씨를 고른다 (한글이 아니면 「이(가)」 그대로) */
function nbsJosa(name, a, b){
  var s = String(name || ''), c = s.charCodeAt(s.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) ? a : b;
  return a + '(' + b + ')';
}
function nbsHanmadi(n, T){ T = T || nbsTpl(); return n >= 4 ? T.h4 : (n >= 1 ? T.h1 : T.h0); }
/* o = {name, mon(1~12), tenten, recovery, kmm, tlp} */
function nbsMsg(T, o){
  T = nbsTplNorm(T);
  var nm = String(o.name || ''), t = String(T.tpl);
  [['이(가)', '이', '가'], ['은(는)', '은', '는'], ['을(를)', '을', '를'], ['과(와)', '과', '와']].forEach(function(j){ t = t.split('{학생}' + j[0]).join(nm + nbsJosa(nm, j[1], j[2])); });
  var V = { '학생':nm, '월':String(o.mon), '텐투텐':String(o.tenten || 0), '리커버리':String(o.recovery || 0), 'KMM':String(o.kmm || 0), 'TLP':String(o.tlp || 0), '한마디':nbsHanmadi(o.tenten || 0, T) };
  Object.keys(V).forEach(function(k){ t = t.split('{' + k + '}').join(V[k]); });
  return t.trim();
}
/* 학생별 월간 표의 줄 (정렬: 합계 많은 순 → 이름) */
function nbsStuTable(rows, ym, show0){
  var S = nbsStuMonth(rows, ym), keys = Object.keys(S.by), seen = {};
  keys.forEach(function(k){ seen[k] = 1; });
  if (show0) nbsMandatory().forEach(function(s){ var k = nbsKeyOf(s); if (!seen[k]){ seen[k] = 1; keys.push(k); S.by[k] = nbsZero(); } });
  var out = keys.map(function(k){ var e = S.by[k], s = nbsActive(k); return { k:k, s:s, e:e, tot:(e.tenten || 0) + (e.recovery || 0) + (e.kmm || 0) + (e.tlp || 0) }; })
    .filter(function(x){ return !!x.s; });
  out.sort(function(a, b){ return (b.tot - a.tot) || String(a.s.name).localeCompare(String(b.s.name), 'ko'); });
  return { list:out, unmatched:S.unmatched };
}
function nbsMsgOf(x, ym){ return nbsMsg(nbsTpl(), { name:x.s.name, mon:Number(ym.slice(5, 7)), tenten:x.e.tenten, recovery:x.e.recovery, kmm:x.e.kmm, tlp:x.e.tlp }); }

/* ── 복사 (클립보드 → 안 되면 숨은 글상자 → 그래도 안 되면 직접 복사 창) ── */
function nbsCopy(txt, okMsg){
  NBS.lastCopy = txt;
  var done = function(){ plToast(okMsg || '📋 복사했어요 — 카카오톡에 붙여 넣으세요'); };
  var fb = function(){
    var good = false;
    try {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); try { good = document.execCommand('copy'); } catch(e){ good = false; } document.body.removeChild(ta);
    } catch(e){ good = false; }
    if (good) done(); else { try { window.prompt('아래 글을 복사해 주세요 (Ctrl+C)', txt); } catch(e){} }
  };
  try { if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done, fb); return; } } catch(e){}
  fb();
}
window.nbsCopyOne = function(k){
  var T = nbsStuTable(nbsRows(), NBS.pm, NBS.show0), x = T.list.filter(function(y){ return y.k === String(k); })[0];
  if (!x){ plToast('⚠ 그 학생을 찾지 못했어요'); return; }
  nbsCopy(nbsMsgOf(x, NBS.pm), '📋 ' + x.s.name + ' 학부모 글을 복사했어요');
};
window.nbsCopyAll = function(){
  var T = nbsStuTable(nbsRows(), NBS.pm, NBS.show0);
  if (!T.list.length){ plToast('복사할 학생이 없어요'); return; }
  nbsCopy(T.list.map(function(x){ return nbsMsgOf(x, NBS.pm); }).join('\n\n'), '📋 ' + T.list.length + '명 글을 모두 복사했어요 (빈 줄로 나눔)');
};
window.nbsCopyMiss = function(sat){
  var W = nbsWeekend(nbsRows(), sat, nbsToday());
  if (!W.miss.length){ plToast('예약 안 한 학생이 없어요 👍'); return; }
  nbsCopy(nbsMd(W.sat) + '~' + nbsMd(W.sun) + ' 텐투텐 미예약 ' + W.miss.length + '명: ' + W.miss.map(function(x){ return x.s.name; }).join(', '), '📋 미예약 명단을 복사했어요');
};
window.nbsCopyRemind = function(sat){
  var W = nbsWeekend(nbsRows(), sat, nbsToday());
  if (!W.miss.length){ plToast('예약 안 한 학생이 없어요 👍'); return; }
  nbsCopy(W.miss.map(function(x){ return x.s.name + ' 학생, 이번 주말 텐투텐 예약 부탁드려요'; }).join('\n'), '📋 안내 글 ' + W.miss.length + '줄을 복사했어요');
};

/* ── 저장: 글 틀 · 필수 아님 (서버 lumen_store 에 바로) ── */
window.nbsTplSave = async function(){
  var g = function(id){ var el = document.getElementById(id); return el ? String(el.value || '') : ''; };
  var o = nbsTplNorm({ tpl:g('nbsTplIn'), h4:g('nbsH4'), h1:g('nbsH1'), h0:g('nbsH0') });
  NBS.tpl = o;
  var ok = await supaSetItem('naver_msg_tpl', o);
  plToast(ok ? '💾 카톡 글 틀을 저장했어요' : '⚠ 저장하지 못했어요 — 네트워크를 확인해 주세요');
  render();
};
window.nbsTplReset = async function(){
  if (!confirm('카톡 글 틀을 처음 글로 되돌릴까요?')) return;
  NBS.tpl = nbsTplNorm(null);
  var ok = await supaSetItem('naver_msg_tpl', NBS.tpl);
  plToast(ok ? '↩ 처음 글로 되돌렸어요' : '⚠ 저장하지 못했어요');
  render();
};
window.nbsOptToggle = async function(k){
  if (!k) return;
  var sb = getSupaClient(), cur = {};
  try { var r = await sb.from('lumen_store').select('value').eq('key', 'tenten_optional'); var x = nbsVal(r && r.data && r.data[0] && r.data[0].value); if (x && typeof x === 'object' && !Array.isArray(x)) cur = x; } catch(e){}
  var on = !nbsOptional(k);
  if (on) cur[k] = true; else delete cur[k];
  NBS.opt = cur;
  var ok = await supaSetItem('tenten_optional', cur);
  var s = nbsStu(k);
  plToast(ok ? ((s ? s.name + ' — ' : '') + (on ? '텐투텐 «필수 아님»으로 했어요' : '텐투텐 필수로 돌렸어요')) : '⚠ 저장하지 못했어요');
  render();
};
window.nbsSet = function(k, v){ NBS[k] = v; render(); };
window.nbsJump = function(id){ var el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' }); };
window.nbsGoWeekend = function(){
  VIEW = 'naverstats'; NBS.wm = ''; nbsKick('naverstats');
  try { renderFuncTab(); } catch(e){ render(); }
  setTimeout(function(){ nbsJump('nbsSecWe'); }, 350);
};

/* ═══ 그리기 ═══ */
function nbsSec(id, title, lead, body, cls){
  return '<section class="nbs-sec' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '><h3>' + title + '</h3>' + (lead ? '<p class="nbs-lead">' + lead + '</p>' : '') + body + '</section>';
}
function nbsBars(list, color, attr){
  if (!list.length) return '<div class="nbs-none">자료가 없어요</div>';
  var max = Math.max.apply(null, list.map(function(x){ return x[1]; })) || 1;
  return '<div class="nbs-bars">' + list.map(function(x){
    return '<div class="nbs-bar" ' + (attr || 'data-nbs-bar') + '="' + nbsQ(x[0]) + '" data-v="' + x[1] + '"><span class="l">' + nbsQ(x[0]) + '</span><span class="t"><i style="width:' + Math.max(2, Math.round(100 * x[1] / max)) + '%;background:' + (x[2] || color) + '"></i></span><span class="v">' + x[1] + '</span></div>';
  }).join('') + '</div>';
}
function nbsPct(a, b){ return b ? Math.round(100 * a / b) : 0; }
function nbsMedian(a){ if (!a.length) return null; a = a.slice().sort(function(x, y){ return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function nbsNiceMax(v){ var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]; for (var i = 0; i < steps.length; i++) if (v / steps[i] <= 5) return { top:Math.max(steps[i], Math.ceil(v / steps[i]) * steps[i]), step:steps[i] }; return { top:Math.ceil(v / 1000) * 1000, step:1000 }; }
function nbsAreaLabel(a){
  var M = { '네이버 플레이스 - 검색 목록':'플레이스 검색 목록', '네이버 플레이스 - 상세페이지':'플레이스 상세', '네이버 - 기타':'네이버 기타', '기타 (유입경로 구분 불가)':'구분 안 됨',
            '네이버 지도':'네이버 지도', '네이버 플레이스광고(Beta)':'플레이스 광고', '외부서비스 유입':'외부' };
  if (!a) return '(기록 없음)';
  if (M[a]) return M[a];
  if (/^네이버 예약 캠페인/.test(a)) return '예약 캠페인';
  return a.replace(/^네이버\s*/, '');
}
function nbsGrLabel(g){ var m = String(g).match(/^\?(\d)$/); return m ? m[1] + '학년(학교급 모름)' : g; }
function nbsInRange(r){ return String(r.date).slice(0, 4) === NBS.y && (!NBS.m || String(r.date).slice(5, 7) === NBS.m); }
function nbsRangeLabel(){ return NBS.y + '년 ' + (NBS.m ? Number(NBS.m) + '월' : '전체'); }

/* a 숫자 칸 */
function nbsKpis(R, today){
  var n = R.length, done = 0, cx = 0, up = 0, byK = {};
  R.forEach(function(r){ var X = nbsRule(r); if (X.done) done++; if (X.cx) cx++; if (r.date >= today && X.booked && !X.done) up++; byK[r.kind] = (byK[r.kind] || 0) + 1; });
  var k1 = function(key, label, v, sub, color){ return '<div class="nbs-kpi" data-nbs-kpi="' + key + '" data-v="' + v + '" style="--c:' + (color || 'var(--navy)') + '"><b>' + v + '</b><span>' + label + (sub ? ' <small>' + sub + '</small>' : '') + '</span></div>'; };
  var h = '<div class="nbs-kpis">' + k1('total', '전체 예약', n, '취소 포함') + k1('done', '완료', done, '', 'var(--green)') + k1('cx', '취소', cx, nbsPct(cx, n) + '%', 'var(--red)') + k1('up', '앞으로 예정', up, '', 'var(--blue)') + '</div>';
  h += '<div class="nbs-kpis kinds">';
  NBS_ORDER.forEach(function(k){ if (!byK[k]) return; var K = nbsKI(k); h += k1('k-' + k, K.label, byK[k], nbsPct(byK[k], n) + '%', K.color); });
  return h + '</div>';
}
/* b 달마다 예약 수 (쌓은 막대) */
function nbsMonthly(rows){
  var by = {}, tot = {};
  for (var i = 1; i <= 12; i++){ var ym = NBS.y + '-' + (i < 10 ? '0' : '') + i; by[ym] = {}; tot[ym] = 0; }
  rows.forEach(function(r){ var ym = String(r.date).slice(0, 7); if (!by[ym]) return; by[ym][r.kind] = (by[ym][r.kind] || 0) + 1; tot[ym]++; });
  var months = Object.keys(by).sort(), max = Math.max.apply(null, months.map(function(m){ return tot[m]; }));
  if (!max) return '<div class="nbs-none">' + nbsQ(NBS.y) + '년 예약이 없어요</div>';
  var nm = nbsNiceMax(max), W = 720, H = 250, pl = 34, pb = 26, pt = 14, bw = (W - pl - 8) / 12, inner = bw * 0.62;
  var y = function(v){ return H - pb - (v / nm.top) * (H - pb - pt); };
  var s = '<svg class="nbs-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + nbsQ(NBS.y) + '년 달마다 예약 수">';
  for (var t = 0; t <= nm.top; t += nm.step) s += '<line x1="' + pl + '" x2="' + (W - 4) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '" stroke="var(--border)"/><text x="' + (pl - 6) + '" y="' + (y(t) + 4).toFixed(1) + '" font-size="11" text-anchor="end" fill="var(--text3)">' + t + '</text>';
  months.forEach(function(m, i){
    var x = pl + i * bw + (bw - inner) / 2, acc = 0;
    s += '<g data-nbs-mon="' + m + '" data-v="' + tot[m] + '">';
    NBS_ORDER.forEach(function(k){
      var v = by[m][k] || 0; if (!v) return;
      var y1 = y(acc + v), hh = y(acc) - y1;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + inner.toFixed(1) + '" height="' + Math.max(0.5, hh).toFixed(1) + '" fill="' + nbsKI(k).color + '" rx="2"><title>' + nbsQ(Number(m.slice(5)) + '월 ' + nbsKI(k).label + ' ' + v + '건') + '</title></rect>';
      acc += v;
    });
    if (tot[m]) s += '<text x="' + (x + inner / 2).toFixed(1) + '" y="' + (y(tot[m]) - 5).toFixed(1) + '" font-size="11" font-weight="800" text-anchor="middle" fill="var(--text)">' + tot[m] + '</text>';
    s += '<text x="' + (x + inner / 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="11" text-anchor="middle" fill="var(--text3)">' + Number(m.slice(5)) + '월</text></g>';
  });
  s += '</svg>';
  var lg = '<div class="nbs-legend">' + NBS_ORDER.filter(function(k){ return months.some(function(m){ return by[m][k]; }); }).map(function(k){ return '<span><i style="background:' + nbsKI(k).color + '"></i>' + nbsQ(nbsKI(k).label) + '</span>'; }).join('') + '</div>';
  return lg + '<div class="nbs-chart">' + s + '</div>';
}
/* c 요일 × 시간 (취소 뺌) */
function nbsHeat(R, kind){
  var live = R.filter(function(r){ return r.kind === kind && !nbsRule(r).cx && r.start; });
  var K = nbsKI(kind);
  if (!live.length) return '<div class="nbs-heat-box"><b style="color:' + K.color + '">' + nbsQ(K.label) + '</b><div class="nbs-none">이 기간 예약이 없어요</div></div>';
  var cell = {}, hours = {}, wdN = {}, hN = {}, max = 0;
  live.forEach(function(r){ var w = nbsWd(r.date), h = Number(String(r.start).slice(0, 2)); var c = w + '|' + h; cell[c] = (cell[c] || 0) + 1; hours[h] = 1; wdN[w] = (wdN[w] || 0) + 1; hN[h] = (hN[h] || 0) + 1; if (cell[c] > max) max = cell[c]; });
  var hs = Object.keys(hours).map(Number).sort(function(a, b){ return a - b; });
  var wds = [1, 2, 3, 4, 5, 6, 0].filter(function(w){ return wdN[w] || w === 6 || w === 0; });
  var g = '<div class="nbs-heat" data-nbs-heat="' + kind + '" style="--n:' + hs.length + '"><div class="row hd"><span></span>' + hs.map(function(h){ return '<span>' + h + '시</span>'; }).join('') + '</div>';
  wds.forEach(function(w){
    g += '<div class="row"><span class="wd">' + NBS_WD[w] + '</span>';
    hs.forEach(function(h){ var v = cell[w + '|' + h] || 0; g += '<span class="c" data-wd="' + w + '" data-h="' + h + '" data-v="' + v + '" title="' + NBS_WD[w] + ' ' + nbsQ(nbsHourLabel(h)) + ' ' + v + '건" style="background:' + (v ? nbsRgba(K.color, 0.15 + 0.85 * v / max) : 'var(--bg)') + ';color:' + (v / max > 0.55 ? '#fff' : 'var(--text2)') + '">' + (v || '') + '</span>'; });
    g += '</div>';
  });
  g += '</div>';
  var sat = wdN[6] || 0, sun = wdN[0] || 0, wk = live.length - sat - sun;
  var topH = hs.slice().sort(function(a, b){ return hN[b] - hN[a]; }).slice(0, 2).filter(function(h){ return hN[h]; }).map(nbsHourLabel);
  var lead = '토 ' + sat + ' · 일 ' + sun + ' · 평일 ' + wk + '. ' + (topH.length ? topH.join('와 ') + '가 가장 붐벼요.' : '');
  return '<div class="nbs-heat-box"><div class="nbs-hb"><b style="color:' + K.color + '">' + nbsQ(K.label) + '</b> <small>' + live.length + '건</small></div><p class="nbs-lead">' + nbsQ(lead) + '</p>' + g + '</div>';
}
/* d 종류별 표 */
function nbsKindTable(R){
  var by = {};
  R.forEach(function(r){
    var e = by[r.kind] = by[r.kind] || { n:0, cx:0, lead:[], same:0, regN:0 };
    e.n++; if (nbsRule(r).cx) e.cx++;
    var rt = Date.parse(r.reg || '');
    if (!isNaN(rt)){
      var ut = Date.parse(r.date + 'T' + (r.start || '00:00') + ':00+09:00'), d = (ut - rt) / 86400000;
      if (!isNaN(d) && d > -1){ e.lead.push(Math.max(0, d)); e.regN++; var k = (typeof nbKst === 'function') ? nbKst(r.reg) : null; if (k && k.date === r.date) e.same++; }
    }
  });
  var ks = NBS_ORDER.filter(function(k){ return by[k]; });
  if (!ks.length) return { html:'<div class="nbs-none">이 기간 예약이 없어요</div>', lead:'' };
  var worst = ks.slice().sort(function(a, b){ return nbsPct(by[b].cx, by[b].n) - nbsPct(by[a].cx, by[a].n); })[0];
  var h = '<div class="nbs-tw"><table class="nbs-tbl"><thead><tr><th>종류</th><th class="n">전체</th><th class="n">취소율</th><th class="n">예약~이용 (중앙값)</th><th class="n">당일 예약</th></tr></thead><tbody>';
  ks.forEach(function(k){
    var e = by[k], K = nbsKI(k), cp = nbsPct(e.cx, e.n), md = nbsMedian(e.lead);
    h += '<tr data-nbs-kind="' + k + '" data-n="' + e.n + '" data-cx="' + cp + '" data-med="' + (md == null ? '' : md.toFixed(1)) + '" data-same="' + nbsPct(e.same, e.regN) + '">'
      + '<td><span class="nbs-pill" style="background:' + K.color + '">' + nbsQ(K.label) + '</span></td><td class="n">' + e.n + '건</td><td class="n' + (cp >= 30 ? ' warn' : '') + '">' + cp + '%</td>'
      + '<td class="n">' + (md == null ? '–' : md.toFixed(1) + '일') + '</td><td class="n">' + (e.regN ? nbsPct(e.same, e.regN) + '%' : '–') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  return { html:h, lead:nbsKI(worst).label + ' 예약의 ' + nbsPct(by[worst].cx, by[worst].n) + '%가 취소돼요. «예약~이용»은 예약한 때부터 수업 시작까지 걸린 날 수예요.' };
}
/* f 학생별 월간 참여 */
function nbsStuSec(rows, today){
  var ym = NBS.pm, T = nbsStuTable(rows, ym, NBS.show0), Tp = nbsTpl();
  var thisM = today.slice(0, 7), lastM = nbsYmAdd(thisM, -1);
  var months = {}; rows.forEach(function(r){ months[String(r.date).slice(0, 7)] = 1; }); months[thisM] = 1; months[lastM] = 1;
  var ms = Object.keys(months).filter(function(m){ return m <= thisM; }).sort().reverse();
  var chip = function(m, label){ return '<button type="button" class="nbs-chip' + (ym === m ? ' on' : '') + '" data-nbs-pm="' + m + '" onclick="nbsSet(\'pm\',this.getAttribute(\'data-nbs-pm\'))">' + nbsQ(label) + '</button>'; };
  var h = '<div class="nbs-ctl">' + chip(lastM, '지난달 (' + Number(lastM.slice(5)) + '월)') + chip(thisM, '이번 달 (' + Number(thisM.slice(5)) + '월)')
    + '<select class="nbs-sel" aria-label="달 고르기" onchange="nbsSet(\'pm\',this.value)">' + ms.map(function(m){ return '<option value="' + m + '"' + (m === ym ? ' selected' : '') + '>' + nbsYmLabel(m) + '</option>'; }).join('') + '</select>'
    + '<label class="nbs-chk"><input type="checkbox"' + (NBS.show0 ? ' checked' : '') + ' onchange="nbsSet(\'show0\',this.checked)"> 참여 없는 중·고등 학생도 보기</label>'
    + '<button type="button" class="nbs-btn pri" data-nbs-copyall="1" onclick="nbsCopyAll()">📋 전체 복사 (' + T.list.length + '명)</button></div>';
  var hasNs = T.list.some(function(x){ return x.e.noshow; });
  if (!T.list.length) h += '<div class="nbs-none">' + nbsYmLabel(ym) + '에 학생과 연결된 참여가 없어요</div>';
  else {
    h += '<div class="nbs-tw"><table class="nbs-tbl nbs-stu"><thead><tr><th>학생</th><th class="n">텐투텐</th><th class="n">리커버리</th><th class="n">KMM</th><th class="n">TLP</th>' + (hasNs ? '<th class="n">노쇼</th>' : '') + '<th></th></tr></thead><tbody>';
    T.list.forEach(function(x){
      var msg = nbsMsgOf(x, ym);
      h += '<tr data-nbs-stu="' + nbsQ(x.k) + '" data-tt="' + x.e.tenten + '" data-rc="' + x.e.recovery + '" data-kmm="' + x.e.kmm + '" data-tlp="' + x.e.tlp + '" data-ns="' + x.e.noshow + '">'
        + '<td><b>' + nbsQ(x.s.name) + '</b>' + (x.s.group ? ' <small>' + nbsQ(x.s.group) + '</small>' : '') + '</td>'
        + '<td class="n' + (x.e.tenten ? '' : ' z') + '">' + x.e.tenten + '회</td><td class="n' + (x.e.recovery ? '' : ' z') + '">' + x.e.recovery + '회</td>'
        + '<td class="n' + (x.e.kmm ? '' : ' z') + '">' + x.e.kmm + '</td><td class="n' + (x.e.tlp ? '' : ' z') + '">' + x.e.tlp + '</td>'
        + (hasNs ? '<td class="n' + (x.e.noshow ? ' warn' : ' z') + '">' + x.e.noshow + '</td>' : '')
        + '<td class="n"><button type="button" class="nbs-btn sm" title="' + nbsQ(msg) + '" data-nbs-copy="' + nbsQ(x.k) + '" onclick="nbsCopyOne(this.getAttribute(\'data-nbs-copy\'))">📋 카톡</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '<div class="nbs-note" data-nbs-unmatched="' + T.unmatched + '">' + (T.unmatched ? '학생과 연결 안 된(또는 퇴원생) 참여 예약 <b>' + T.unmatched + '건</b>은 표에서 빠졌어요 — 「네이버 예약」에서 학생 연결을 하면 들어와요. ' : '')
    + '셈: 완료·확정만 1회 (신청 대기·취소 빼고) · 같은 날 같은 종류는 1회 · 노쇼는 따로.</div>';
  var ex = T.list[0] ? nbsMsgOf(T.list[0], ym) : nbsMsg(Tp, { name:'홍길동', mon:Number(ym.slice(5, 7)), tenten:4, recovery:2, kmm:0, tlp:0 });
  h += '<details class="nbs-tpl"' + (NBS.tplOpen ? ' open' : '') + ' ontoggle="NBS.tplOpen=this.open"><summary>✏️ 카톡 글 틀 고치기</summary>'
    + '<textarea id="nbsTplIn" class="nbs-ta" rows="3" aria-label="카톡 글 틀">' + nbsQ(Tp.tpl) + '</textarea>'
    + '<div class="nbs-h3"><label>텐투텐 4회 이상 <input id="nbsH4" class="nbs-in" value="' + nbsQ(Tp.h4) + '"></label><label>1~3회 <input id="nbsH1" class="nbs-in" value="' + nbsQ(Tp.h1) + '"></label><label>0회 <input id="nbsH0" class="nbs-in" value="' + nbsQ(Tp.h0) + '"></label></div>'
    + '<div class="nbs-note">쓸 수 있는 칸: {학생} {월} {텐투텐} {리커버리} {KMM} {TLP} {한마디} · 「{학생}이(가)」는 이름에 맞춰 「이/가」로 바뀌어요 · {한마디}는 텐투텐 횟수에 따라 위 세 문장 중 하나</div>'
    + '<div class="nbs-ctl"><button type="button" class="nbs-btn pri" onclick="nbsTplSave()">💾 저장</button><button type="button" class="nbs-btn" onclick="nbsTplReset()">↩ 처음 글로</button></div></details>'
    + '<div class="nbs-ex" data-nbs-ex="1"><small>예시</small> ' + nbsQ(ex) + '</div>';
  return h;
}
/* g 텐투텐 주말 체크 */
function nbsMarkHtml(d, k, ymd){
  var M = { done:['○', '다녀감'], ok:['✓', '예약'], wait:['✓', '신청 대기'], ns:['노쇼', '노쇼'], cx:['✕', '취소'], no:['✗', '예약 없음'] }[d.m];
  return '<td class="c m-' + d.m + '" data-nbs-cell="' + nbsQ(k + '|' + ymd) + '" data-m="' + d.m + '" title="' + nbsQ(M[1] + (d.t ? ' ' + d.t : '')) + '">' + M[0] + (d.t ? '<small>' + nbsQ(d.t) + (d.m === 'wait' ? ' 대기' : '') + '</small>' : '') + '</td>';
}
function nbsWeSec(rows, today){
  var ym = NBS.wm, coming = nbsComingSat(today), sats = nbsWeekends(ym, today), thisM = today.slice(0, 7);
  var ms = {}; rows.forEach(function(r){ if (r.kind === 'tenten') ms[String(r.date).slice(0, 7)] = 1; }); ms[thisM] = 1;
  var mlist = Object.keys(ms).filter(function(m){ return m <= nbsYmAdd(thisM, 1); }).sort().reverse();
  var h = '<div class="nbs-ctl"><select class="nbs-sel" aria-label="달 고르기" onchange="nbsSet(\'wm\',this.value)">' + mlist.map(function(m){ return '<option value="' + m + '"' + (m === ym ? ' selected' : '') + '>' + nbsYmLabel(m) + '</option>'; }).join('') + '</select>'
    + '<span class="nbs-note">대상: 중·고등 재원생 ' + nbsMandatory().length + '명' + (Object.keys(NBS.opt || {}).filter(function(k){ return NBS.opt[k] && nbsActive(k); }).length ? ' (필수 아님 ' + Object.keys(NBS.opt).filter(function(k){ return NBS.opt[k] && nbsActive(k); }).length + '명 빼고 셈)' : '') + '</span></div>';
  var Ws = sats.map(function(s){ return nbsWeekend(rows, s, today); });
  /* 주말마다 한 줄: 미예약 명단 · 복사 (다가오는 주말은 강조 + 금요일 안내 글) */
  h += '<div class="nbs-wes">';
  Ws.slice().sort(function(a, b){ return a.sat === coming ? -1 : (b.sat === coming ? 1 : (a.sat < b.sat ? 1 : -1)); }).forEach(function(W){
    var isC = W.sat === coming, past = W.sun < today;
    h += '<div class="nbs-we' + (isC ? ' coming' : '') + (past ? ' past' : '') + '" data-nbs-we="' + W.sat + '" data-miss="' + W.miss.length + '"' + (isC ? ' data-coming="1"' : '') + '>'
      + '<div class="nbs-weh"><b>' + (isC ? '⏰ 이번 주말 · ' : '') + nbsMd(W.sat) + '(토)~' + nbsMd(W.sun) + '(일)</b>'
      + (W.miss.length ? '<span class="nbs-miss">' + (past ? '안 온' : (W.sat > coming ? '아직 예약 안 한' : '예약 안 한')) + ' 학생 <b>' + W.miss.length + '명</b></span>' : '<span class="nbs-allok">모두 ' + (past ? '다녀감' : '예약') + ' ✓</span>')
      + (W.miss.length ? '<button type="button" class="nbs-btn sm" data-nbs-miss="' + W.sat + '" onclick="nbsCopyMiss(this.getAttribute(\'data-nbs-miss\'))">📋 복사</button>' : '')
      + (isC && W.miss.length ? '<button type="button" class="nbs-btn sm pri" data-nbs-remind="' + W.sat + '" onclick="nbsCopyRemind(this.getAttribute(\'data-nbs-remind\'))">📋 금요일 안내 글</button>' : '')
      + '</div>';
    if (W.miss.length) h += '<div class="nbs-names">' + W.miss.map(function(x){ var tag = (x.a.m === 'cx' || x.b.m === 'cx') ? ' <small>취소</small>' : ((x.a.m === 'ns' || x.b.m === 'ns') ? ' <small>노쇼</small>' : ''); return '<span>' + nbsQ(x.s.name) + tag + '</span>'; }).join('') + '</div>';
    if (isC && W.miss.length) h += '<div class="nbs-remind">예: 「' + nbsQ(W.miss[0].s.name) + ' 학생, 이번 주말 텐투텐 예약 부탁드려요」</div>';
    h += '</div>';
  });
  h += '</div>';
  /* 표: 줄 = 학생 · 칸 = 주말(토·일) */
  var M = nbsMandatory();
  if (!M.length) h += '<div class="nbs-none">학년에 「중학교」·「고등학교」가 적힌 재원생이 없어요 (학생 관리 › 학년)</div>';
  else {
    h += '<div class="nbs-tw"><table class="nbs-tbl nbs-grid"><thead><tr><th rowspan="2">학생</th>' + Ws.map(function(W){ return '<th colspan="2" class="we' + (W.sat === coming ? ' coming' : '') + '">' + nbsMd(W.sat) + '~' + nbsMd(W.sun) + '</th>'; }).join('') + '<th rowspan="2"></th></tr>'
      + '<tr>' + Ws.map(function(W){ return '<th class="d' + (W.sat === coming ? ' coming' : '') + '">토</th><th class="d' + (W.sat === coming ? ' coming' : '') + '">일</th>'; }).join('') + '</tr></thead><tbody>';
    M.forEach(function(s){
      var k = nbsKeyOf(s), opt = nbsOptional(k);
      h += '<tr data-nbs-row="' + nbsQ(k) + '"' + (opt ? ' class="opt"' : '') + '><td class="nm"><b>' + nbsQ(s.name) + '</b> <small>' + nbsQ(s.group || String(s.grade || '').replace(/학교\s*/, '').replace(/학년/, '')) + '</small></td>';
      Ws.forEach(function(W){ var x = W.list.filter(function(y){ return y.k === k; })[0]; h += nbsMarkHtml(x.a, k, W.sat) + nbsMarkHtml(x.b, k, W.sun); });
      h += '<td><button type="button" class="nbs-opt' + (opt ? ' on' : '') + '" data-nbs-opt="' + nbsQ(k) + '" aria-pressed="' + (opt ? 'true' : 'false') + '" onclick="nbsOptToggle(this.getAttribute(\'data-nbs-opt\'))">' + (opt ? '필수 아님 ✓' : '필수 아님') + '</button></td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div class="nbs-note nbs-key">○ 다녀감 · ✓ 예약(시간) · ✕ 취소 · ✗ 예약 없음 · 노쇼 — 토·일 중 하루라도 예약(신청 대기 포함)이면 그 주말은 한 것으로 봐요.</div>';
  }
  /* TOP 5 */
  var S = nbsStuMonth(rows, ym), top = Object.keys(S.by).filter(function(k){ return S.by[k].tenten > 0 && nbsActive(k); })
    .sort(function(a, b){ return (S.by[b].tenten - S.by[a].tenten) || String(nbsStu(a).name).localeCompare(String(nbsStu(b).name), 'ko'); }).slice(0, 5);
  h += '<div class="nbs-top" data-nbs-top="' + top.length + '"><b>🏅 ' + Number(ym.slice(5, 7)) + '월 텐투텐 많이 한 학생 TOP 5</b>'
    + (top.length ? '<ol>' + top.map(function(k){ return '<li data-nbs-topk="' + nbsQ(k) + '" data-v="' + S.by[k].tenten + '">' + nbsQ(nbsStu(k).name) + ' <b>' + S.by[k].tenten + '회</b></li>'; }).join('') + '</ol>' : '<div class="nbs-none">아직 없어요</div>') + '</div>';
  return h;
}

function rNaverStats(){
  nbsKick('naverstats');
  var today = nbsToday(), logo = (typeof nbkLogo === 'function') ? nbkLogo() : '';
  if (!NBS.y) NBS.y = today.slice(0, 4);
  if (!NBS.pm) NBS.pm = nbsYmAdd(today.slice(0, 7), -1);
  if (!NBS.wm) NBS.wm = today.slice(0, 7);
  var A = NBS.arch;
  var h = '<div class="nbs-wrap">';
  h += '<div class="nbs-head"><div><div class="nbs-ttl">' + logo + ' 📊 예약 통계</div><div class="nbs-sub">네이버 예약 전체 보관으로 셉니다 · 이름·전화 없이 건수만 · 학생 이름은 이 화면에만</div></div>'
    + '<div class="nbs-hr">' + (A ? '<span class="nbs-at" data-nbs-at="1">보관 ' + A.rows.length + '건 (' + nbsQ(A.from || '') + ' ~ ' + nbsQ(A.to || '') + ') · ' + nbsQ((typeof nbkAgo === 'function') ? nbkAgo(A.at) : A.at) + '</span>' : '')
    + '<button type="button" class="nbs-btn" onclick="nbsRefresh()">🔄 새로고침</button></div></div>';
  if (!NBS.loaded) return h + '<div class="nbs-empty">' + logo + ' 예약 통계 불러오는 중…</div></div>';
  if (NBS.err) h += '<div class="nbs-ban">⚠ 서버에서 보관 자료를 읽지 못했어요 — ' + nbsQ(NBS.err) + '</div>';
  var rows = nbsRows();
  if (!rows.length) return h + '<div class="nbs-ban grey" data-nbs-empty="1"><b>아직 보관된 예약이 없어요</b><span>GitHub 「네이버 예약 수집」이 다음에 돌면(15분마다) 채워집니다.</span></div></div>';
  h += '<div class="nbs-jump"><button type="button" class="nbs-btn" onclick="nbsJump(\'nbsSecStu\')">👨‍👩‍👧 학생별 월간 참여 ↓</button><button type="button" class="nbs-btn" onclick="nbsJump(\'nbsSecWe\')">🔟 텐투텐 주말 체크 ↓</button></div>';
  var years = {}; rows.forEach(function(r){ years[String(r.date).slice(0, 4)] = 1; }); years[NBS.y] = 1;
  var ctl = '<div class="nbs-ctl"><select class="nbs-sel" id="nbsYear" aria-label="연도" onchange="nbsSet(\'y\',this.value)">' + Object.keys(years).sort().reverse().map(function(y){ return '<option value="' + y + '"' + (y === NBS.y ? ' selected' : '') + '>' + y + '년</option>'; }).join('') + '</select>'
    + '<select class="nbs-sel" id="nbsMon" aria-label="달" onchange="nbsSet(\'m\',this.value)"><option value="">전체 달</option>';
  for (var i = 1; i <= 12; i++){ var mm = (i < 10 ? '0' : '') + i; ctl += '<option value="' + mm + '"' + (mm === NBS.m ? ' selected' : '') + '>' + i + '월</option>'; }
  ctl += '</select><span class="nbs-note">a·c·d·e 는 이 기간 · b 는 연도 전체</span></div>';
  var R = rows.filter(nbsInRange);
  h += nbsSec('', '한눈에 · ' + nbsQ(nbsRangeLabel()), '', ctl + nbsKpis(R, today));
  h += nbsSec('', '달마다 예약 수 · ' + nbsQ(NBS.y) + '년', '예약 건수(취소 포함)를 종류별로 쌓았어요. 막대 위 숫자 = 그 달 전체.', nbsMonthly(rows.filter(function(r){ return String(r.date).slice(0, 4) === NBS.y; })));
  h += '<div class="nbs-two">' + nbsSec('', '🔟 텐투텐 · 요일 × 시간', '', nbsHeat(R, 'tenten')) + nbsSec('', '🚑 리커버리 · 요일 × 시간', '', nbsHeat(R, 'recovery')) + '</div>';
  var KT = nbsKindTable(R);
  h += nbsSec('', '종류별 취소율 · 얼마나 미리 예약하나', nbsQ(KT.lead), KT.html);
  var ar = {}, gr = {}, sc = {}; R.forEach(function(r){ var a = nbsAreaLabel(r.area); ar[a] = (ar[a] || 0) + 1; if (r.gr) gr[nbsGrLabel(r.gr)] = (gr[nbsGrLabel(r.gr)] || 0) + 1; if (r.sch) sc[r.sch] = (sc[r.sch] || 0) + 1; });
  var srt = function(o){ return Object.keys(o).sort(function(a, b){ return o[b] - o[a]; }).map(function(k){ return [k, o[k]]; }); };
  var arL = srt(ar).sort(function(a, b){ return (a[0] === '(기록 없음)') - (b[0] === '(기록 없음)'); }), arT = arL.filter(function(x){ return x[0] !== '(기록 없음)'; }), arN = arT.reduce(function(s, x){ return s + x[1]; }, 0);
  var grN = Object.keys(gr).reduce(function(s, k){ return s + gr[k]; }, 0);
  h += '<div class="nbs-two">'
    + nbsSec('', '어디서 보고 예약했나 (유입 경로)', arT.length ? nbsQ('유입 경로가 적힌 ' + arN + '건 중 ' + nbsPct(arT[0][1], arN) + '%가 «' + arT[0][0] + '»에서 예약했어요.') : '', nbsBars(arL, '#03C75A', 'data-nbs-area'))
    + nbsSec('', '메모에 적힌 학년 · 학교', grN ? nbsQ('메모·추가 답에 학년이 적힌 ' + grN + '건 기준') : '메모에 학년이 적힌 예약이 없어요',
        '<div class="nbs-sub2">학년</div>' + nbsBars(srt(gr), nbsKI('counsel').color, 'data-nbs-gr') + '<div class="nbs-sub2">학교</div>' + nbsBars(srt(sc), 'var(--navy3)', 'data-nbs-sch'))
    + '</div>';
  h += nbsSec('nbsSecStu', '👨‍👩‍👧 학생별 월간 참여 · 학부모 카톡', '한 달 동안 텐투텐·리커버리에 몇 번 왔는지 · 「📋 카톡」을 누르면 학부모님께 보낼 글이 복사돼요.', nbsStuSec(rows, today), 'stu');
  h += nbsSec('nbsSecWe', '🔟 텐투텐 주말 체크 (중·고등 필수)', '주말(토·일)마다 텐투텐을 예약했는지 · 이번 주말은 맨 위에 · 「필수 아님」 학생은 셈에서 빠져요.', nbsWeSec(rows, today), 'we');
  return h + '</div>';
}
window.rNaverStats = rNaverStats;

/* ═══ 🏠 홈 — 「오늘 네이버 예약」 칸 아래 (금·토만): 이번 주말 텐투텐 미예약 n명 ═══ */
function nbsHomeLine(){
  var today = nbsToday(), wd = nbsWd(today);
  if (wd !== 5 && wd !== 6) return '';
  if (!NBS.optAt){ nbsKickLite('home'); return ''; }
  nbsKickLite('home');
  if (typeof NBK === 'undefined' || !NBK || !NBK.data) return '';
  var W = nbsWeekend(nbsRows(), nbsComingSat(today), today);
  if (!nbsMandatory().length) return '';
  return '<div class="nbs-hw" data-nbs-home="' + W.miss.length + '" onclick="nbsGoWeekend()">🔟 이번 주말 텐투텐 '
    + (W.miss.length ? '미예약 <b>' + W.miss.length + '명</b>' : '<b>모두 예약 ✓</b>') + ' <span>›</span></div>';
}
if (typeof window.nbkHomeCard === 'function') window.nbkHomeCard = (function(o){
  return function(){
    var h = o.apply(this, arguments);
    try {
      if (!h) return h;
      var x = nbsHomeLine();
      if (x){ var i = h.lastIndexOf('</div>'); if (i > 0) h = h.slice(0, i) + x + h.slice(i); }
    } catch(e){ try { console.error('[예약 통계 · 홈]', e); } catch(_){} }
    return h;
  };
})(window.nbkHomeCard);

/* ── 모양 (앱 색 토큰 --navy · --text · --border …) ── */
(function(){
  if (document.getElementById('nbs-css')) return;
  var st = document.createElement('style'); st.id = 'nbs-css';
  st.textContent = ''
    + '.nbs-wrap{padding:18px 22px 50px;max-width:1120px;display:grid;gap:14px}'
    + '.nbs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap}'
    + '.nbs-ttl{font-size:22px;font-weight:900;color:var(--navy);display:flex;align-items:center;gap:7px}.nbs-sub{font-size:12px;color:var(--text3);font-weight:700;margin-top:2px}'
    + '.nbs-hr{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.nbs-at{font-size:11.5px;font-weight:800;color:var(--text2)}'
    + '.nbs-btn{border:1px solid var(--border);background:var(--surface);color:#334155;font-family:inherit;font-size:12px;font-weight:800;padding:6px 12px;border-radius:50px;cursor:pointer;white-space:nowrap}'
    + '.nbs-btn.pri{background:var(--navy);border-color:var(--navy);color:#fff}.nbs-btn.sm{padding:4px 10px;font-size:11.5px}'
    + '.nbs-jump{display:flex;gap:6px;flex-wrap:wrap}'
    + '.nbs-ban{border-radius:12px;padding:11px 14px;font-size:12.5px;font-weight:700;background:var(--red2);border:1.5px solid var(--red3);color:#991b1b;display:flex;flex-direction:column;gap:2px}'
    + '.nbs-ban.grey{background:#f8fafc;border-color:var(--border);color:var(--text2)}.nbs-ban b{font-size:14px;font-weight:900}'
    + '.nbs-empty{padding:50px;text-align:center;font-size:13px;color:var(--text3);font-weight:700}'
    + '.nbs-sec{background:var(--surface);border:1px solid var(--border);border-radius:var(--rl,16px);padding:16px 18px;min-width:0;box-shadow:var(--shadow-card)}'
    + '.nbs-sec h3{margin:0 0 4px;font-size:16px;font-weight:900;color:var(--navy)}.nbs-lead{margin:0 0 12px;font-size:12.5px;color:var(--text2);font-weight:600;line-height:1.55}'
    + '.nbs-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}'
    + '.nbs-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:10px}'
    + '.nbs-sel{font-family:inherit;font-size:12.5px;font-weight:800;border:1px solid var(--border2);border-radius:9px;padding:5px 8px;background:var(--surface);color:var(--text)}'
    + '.nbs-chip{border:1.5px solid var(--border);background:var(--surface);color:var(--text2);border-radius:50px;padding:5px 12px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer}.nbs-chip.on{background:var(--navy);border-color:var(--navy);color:#fff}'
    + '.nbs-chk{font-size:12px;font-weight:800;color:var(--text2);display:inline-flex;align-items:center;gap:4px;cursor:pointer}'
    + '.nbs-note{font-size:11.5px;color:var(--text3);font-weight:700;line-height:1.55}.nbs-note b{color:var(--text2)}'
    + '.nbs-none{font-size:12.5px;color:var(--text3);font-weight:700;padding:8px 2px}'
    + '.nbs-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:10px}.nbs-kpis.kinds{margin-bottom:0}'
    + '.nbs-kpi{border-left:4px solid var(--c);padding:4px 0 4px 11px}.nbs-kpi b{display:block;font-size:26px;font-weight:900;color:var(--text);line-height:1.1;font-variant-numeric:tabular-nums}'
    + '.nbs-kpi span{font-size:12px;color:var(--text2);font-weight:700}.nbs-kpi small{color:var(--text3);font-weight:800}.nbs-kpis.kinds .nbs-kpi b{font-size:20px}'
    + '.nbs-legend{display:flex;flex-wrap:wrap;gap:5px 13px;font-size:12px;color:var(--text2);font-weight:700;margin-bottom:6px}.nbs-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}'
    + '.nbs-chart{overflow-x:auto}.nbs-svg{width:100%;min-width:540px;height:auto;display:block}.nbs-svg text{font-family:inherit}'
    + '.nbs-hb{font-size:14px;margin-bottom:2px}.nbs-hb small{color:var(--text3);font-weight:800}'
    + '.nbs-heat{display:grid;gap:3px;font-size:11px;font-variant-numeric:tabular-nums;overflow-x:auto}'
    + '.nbs-heat .row{display:grid;grid-template-columns:30px repeat(var(--n),minmax(26px,1fr));gap:3px;align-items:center}'
    + '.nbs-heat .row.hd span{color:var(--text3);text-align:center;font-weight:800}.nbs-heat .wd{font-weight:900;color:var(--text2);text-align:center}'
    + '.nbs-heat .c{height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:900}'
    + '.nbs-tw{overflow-x:auto}.nbs-tbl{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}'
    + '.nbs-tbl th,.nbs-tbl td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--border)}.nbs-tbl th{font-weight:800;color:var(--text3);font-size:11.5px}'
    + '.nbs-tbl .n{text-align:right}.nbs-tbl .warn{color:#c2410c;font-weight:900}.nbs-tbl .z{color:var(--text3)}.nbs-tbl small{color:var(--text3);font-weight:700}'
    + '.nbs-pill{display:inline-block;border-radius:50px;padding:1px 9px;font-size:11.5px;font-weight:900;color:#fff}'
    + '.nbs-bars{display:grid;gap:6px}.nbs-bar{display:grid;grid-template-columns:120px 1fr 40px;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--text)}'
    + '.nbs-bar .t{height:11px;border-radius:6px;background:var(--bg);overflow:hidden;display:block}.nbs-bar .t i{display:block;height:100%;border-radius:6px}.nbs-bar .v{text-align:right;color:var(--text2);font-variant-numeric:tabular-nums}'
    + '.nbs-sub2{font-size:11.5px;font-weight:900;color:var(--text3);margin:8px 0 5px}'
    + '.nbs-stu td b{color:var(--navy)}'
    + '.nbs-tpl{margin-top:10px;border:1px dashed var(--border2);border-radius:12px;padding:8px 12px}.nbs-tpl summary{cursor:pointer;font-size:12.5px;font-weight:900;color:var(--text2)}'
    + '.nbs-ta{width:100%;box-sizing:border-box;margin:8px 0 6px;font-family:inherit;font-size:13px;font-weight:600;border:1.5px solid var(--border2);border-radius:9px;padding:8px 10px;resize:vertical}'
    + '.nbs-h3{display:grid;gap:5px;margin-bottom:6px}.nbs-h3 label{font-size:11.5px;font-weight:800;color:var(--text2);display:flex;align-items:center;gap:6px}'
    + '.nbs-in{flex:1;min-width:0;font-family:inherit;font-size:12.5px;font-weight:600;border:1px solid var(--border2);border-radius:8px;padding:5px 8px}'
    + '.nbs-ex{margin-top:8px;font-size:12.5px;color:var(--text);background:#fef9c3;border-radius:10px;padding:8px 11px;line-height:1.55}.nbs-ex small{font-weight:900;color:#a16207;margin-right:4px}'
    + '.nbs-wes{display:grid;gap:8px;margin-bottom:12px}'
    + '.nbs-we{border:1.5px solid var(--border);border-radius:12px;padding:9px 12px;background:var(--surface)}.nbs-we.past{background:#f8fafc}'
    + '.nbs-we.coming{border-color:var(--purple);background:var(--purple2);box-shadow:0 0 0 2px rgba(124,58,237,.12)}'
    + '.nbs-weh{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:var(--navy)}.nbs-miss{color:#b91c1c;font-weight:800;font-size:12.5px}.nbs-allok{color:#15803d;font-weight:900;font-size:12.5px}'
    + '.nbs-names{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.nbs-names span{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:2px 8px;font-size:12px;font-weight:800;color:var(--text)}.nbs-names small{color:#b91c1c}'
    + '.nbs-remind{font-size:11.5px;color:var(--purple);font-weight:800;margin-top:5px}'
    + '.nbs-grid th.we,.nbs-grid th.d{text-align:center}.nbs-grid th.coming{background:var(--purple2);color:var(--purple)}'
    + '.nbs-grid td.nm{white-space:nowrap}.nbs-grid td.c{text-align:center;font-weight:900;font-size:14px;min-width:42px}.nbs-grid td.c small{display:block;font-size:10px;color:var(--text3);font-weight:800}'
    + '.nbs-grid .m-done{color:var(--green)}.nbs-grid .m-ok,.nbs-grid .m-wait{color:var(--purple)}.nbs-grid .m-cx{color:#b91c1c}.nbs-grid .m-no{color:#cbd5e1}.nbs-grid .m-ns{color:#7f1d1d;font-size:11px}'
    + '.nbs-grid tr.opt td{opacity:.45}.nbs-grid tr.opt td:last-child{opacity:1}'
    + '.nbs-opt{border:1px dashed var(--border2);background:var(--surface);color:var(--text3);border-radius:8px;padding:2px 7px;font-family:inherit;font-size:10.5px;font-weight:800;cursor:pointer;white-space:nowrap}.nbs-opt.on{border-style:solid;color:var(--text2);background:var(--bg)}'
    + '.nbs-top{margin-top:12px;background:var(--gold2);border:1px solid #f0dfb0;border-radius:12px;padding:10px 14px;font-size:13px;color:#7c5a12}.nbs-top ol{margin:6px 0 0 18px;padding:0;display:flex;flex-wrap:wrap;gap:4px 22px}.nbs-top li{font-weight:800}'
    + '.nbs-hw{margin-top:6px;font-size:12.5px;font-weight:800;color:var(--purple);background:var(--purple2);border-radius:8px;padding:5px 9px;cursor:pointer}.nbs-hw b{color:#b91c1c}.nbs-hw span{float:right}'
    + '@media(max-width:640px){.nbs-wrap{padding:14px 12px 30px}.nbs-two{grid-template-columns:1fr}.nbs-bar{grid-template-columns:92px 1fr 34px}.nbs-sec{padding:13px 12px}}';
  (document.head || document.documentElement).appendChild(st);
})();
