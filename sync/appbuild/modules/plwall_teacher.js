/* ═══════════════════════════════════════════════════════════════════
 * v19-115: 🗓 주간계획 모아보기 (VIEW='plwall') — 시안 docs/mockup_plan_wall.html (6명 3×2 · 하루 시간표 보기 뺌)
 * 원장 2026-10-12 「v19-115 만들어 배포해줘」 · 「고정 스케줄과 학생들이 세운 계획, 학습 코디가 짠 계획이 구분이 되나?」
 *
 *  ① 왼쪽 「📅 주간 · 순공 · 코디」 묶음의 「📅 주간 점수(계획·순공)」 바로 아래 · 위 기능 탭(수업·출결)에서도 주간 점수 바로 뒤
 *  ② 머리: 주 고르기(‹ 이번 주 ›) · 반 칩(전체 + 학생 등록부의 반) · 6명씩 넘기기(‹ 앞 6명 · n/m · 다음 6명 ›)
 *  ③ 요약 줄: n/m명 계획 냄 · 할 일 k개 · 실천 ✓ j개 · 안 낸 x명 → 💬 모아서 알림 · 정렬(안 낸 학생 먼저 · 이름 · 반) · 🖨 6명 한 장
 *  ④ 카드 = 작은 주간 달력(월~일 · 9~24시) — «⤢ 크게 보기» 달력 창(plwCal · pwcShow)과 같은 자료·같은 고정 일정(pwcFixed)
 *     · 고정 일정: 학교·학원 등 회색 · 루멘 수업 빨강 (codi_fixed_<코드>, 없으면 학년별 학교 기본 시간 + 반 수업 요일)
 *     · 할 일 = 과목 색 · 🧭 코디가 짠 것(src 'codi') = 실선 테두리 · ✏️ 학생이 직접 쓴 것(src 'me' 등) = 점선 테두리
 *     · 실천 ✓(PW.chkOf = wplan_chk_ + codi_done_ — 주간 점수 «계획 실천»과 같은 자료) = 초록 테두리
 *     · 아래 줄: 실천 a/b · 코디 c · 직접 d · 시간 h · 고정 일정을 안 넣은 학생은 「📌 고정 일정 안 넣음(학교 기본)」
 *     · 안 낸 학생: 「안 냄」 + 「💬 알림」 · 카드를 누르면 지금의 큰 달력 창
 *  ⑤ 💬 모아서 알림 = v19-114 «원장님 한마디» 길 그대로(wppSaveMsg → wpmsg_<코드> · wppPushComment → student_planner_<코드>.teacherComment)
 *     확인 창에서 인원·글을 보고 고친 뒤 보낸다. 주간 점수 «✅ 체크하기»의 계획 알림도 이 창을 쓴다(plwRemindDlg).
 *  자료: 주간 점수와 같은 PWB(plwLoad — lumen_store 한 번의 or 질의: wplan_ · codi_plan_ · codi_done_ · codi_fixed_ · sungong_ · plweek_paper · lumen_group_days)
 *        + 알림 기록 wpmsg_% 한 번(60초 캐시). 학생마다 따로 읽지 않는다.
 *  ※ 바탕 코드는 고치지 않는다(GROUPS · perViewLeftNav · plrNavGo 감싸기). 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var PLWALL = { W: null, grp: '', page: 0, sort: 'nosub', order: [], poll: 0, msgAt: 0, msgBusy: false, msgs: {}, sending: false };
var PLWALL_N = 6, PLWALL_M0 = 9 * 60, PLWALL_M1 = 24 * 60;

/* ── 메뉴: 위 기능 탭 「수업·출결」의 주간 점수 바로 뒤 ── */
(function(){
  try {
    var g = (GROUPS || []).filter(function(x){ return x.key === 'class'; })[0]; if (!g) return;
    if (g.subs.some(function(s){ return s.v === 'plwall'; })) return;
    var at = g.subs.length; g.subs.forEach(function(s, j){ if (s.v === 'plweek') at = j + 1; });
    g.subs.splice(at, 0, { v: 'plwall', icon: '🗓', label: '주간계획 모아보기', act: function(){ VIEW = 'plwall'; pwlKick(true); } });
  } catch(e){ try { console.error('[주간계획 모아보기 메뉴]', e); } catch(_){} }
})();
/* 왼쪽: 플래너 묶음 메뉴(rPlannerLeftNav — 칸은 조립 때 「주간 점수」 바로 아래에 넣는다) */
perViewLeftNav = (function(o){ return function(v){
  if (v === 'plwall' && typeof rPlannerLeftNav === 'function') return rPlannerLeftNav();
  return o.apply(this, arguments); }; })(perViewLeftNav);
if (typeof window.plrNavGo === 'function'){
  window.plrNavGo = (function(o){ return function(v){
    if (v === 'plwall'){ VIEW = 'plwall'; pwlKick(true); render(); return; }
    return o.apply(this, arguments); }; })(window.plrNavGo);
}

/* ── 불러오기 — 주간 점수와 같은 plwLoad(새로 읽되 «다시 올리기»는 안 한다) + 알림 기록 ── */
function pwlKick(fresh){
  if (fresh && !PWB.loading) PWB.at = 0;   /* 60초 캐시를 비워 새로 읽는다 (plwLoad(true) 는 랭킹 다시 올리기까지 해서 쓰지 않는다) */
  try { var p = plwLoad(); if (p && p.then) p.then(function(){ if (VIEW === 'plwall') render(); }); } catch(e){}
  pwlMsgLoad(!!fresh);
}
async function pwlMsgLoad(force){
  if (PLWALL.msgBusy) return; if (!force && PLWALL.msgAt && Date.now() - PLWALL.msgAt < 60000) return;
  var sb = wppSb(); if (!sb) return;
  PLWALL.msgBusy = true;
  try {
    var r = await sb.from('lumen_store').select('key,value').like('key', 'wpmsg_%');
    if (r && r.error) throw r.error;
    var m = {}; ((r && r.data) || []).forEach(function(row){ var k = String(row.key || ''); if (k.indexOf('wpmsg_') === 0) m[k.slice(6)] = wppVal(row.value); });
    PLWALL.msgs = m; PLWALL.msgAt = Date.now();
    Object.keys(m).forEach(function(c){ if (!WPP.mAt[c] || Date.now() - WPP.mAt[c] > 60000){ WPP.msg[c] = m[c]; WPP.mAt[c] = Date.now(); } });
  } catch(e){ try { console.warn('[주간계획 모아보기] 알림 기록 읽기 실패', e); } catch(_){} PLWALL.msgAt = Date.now(); }
  PLWALL.msgBusy = false;
  if (VIEW === 'plwall' || VIEW === 'plweek') render();
}
/* 이 학생에게 그 주 계획 알림을 보낸 기록 (보낸 직후는 WPP.msg 가 더 새것) */
window.plwRemindOf = function(c, P){
  var a = WPP.msg[c], b = PLWALL.msgs[c], v = (a && b) ? ((String(a.upd || '') >= String(b.upd || '')) ? a : b) : (a || b);
  var e = v && v.weeks && v.weeks[P];
  return (e && e.remind && !e.off) ? e : null;
};

/* ── 학생 · 반 · 정렬 ── */
function pwlAll(){ return (typeof students !== 'undefined' ? students : []).filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; }); }
function pwlGroups(list){
  var cnt = {}; list.forEach(function(s){ var g = String(s.group || ''); cnt[g] = (cnt[g] || 0) + 1; });
  return Object.keys(cnt).sort(function(a, b){ if (!a) return 1; if (!b) return -1; return a.localeCompare(b, 'ko'); }).map(function(g){ return { g: g, n: cnt[g] }; });
}
function pwlP(){ return PLWALL.W || PW.thisMon(); }
/* 한 학생 · 한 주 — 계획 냄 = 학생이 「계획 내기」를 눌렀거나 코디 계획이 있음(점수 계산 PW.planOf 와 같은 규칙) */
window.plwWallInfo = function(st, P){
  var c = st.lumen_rec_code, pl = wppPlan(c, P), S = wppSummary(c, P), fx = pwcFixed(st);
  return { st: st, c: c, pl: pl, S: S, fx: fx, sub: !!pl.sub, n: S.n, ok: S.ok, codi: S.codi, me: S.n - S.codi, mins: S.mins };
};
function pwlRows(){
  var P = pwlP(), all = pwlAll(), g = PLWALL.grp;
  if (g === '~none~') g = '';
  var list = (PLWALL.grp === '') ? all : all.filter(function(s){ return String(s.group || '') === g; });
  var rows = list.map(function(st){ return plwWallInfo(st, P); });
  var nm = function(a, b){ return String(a.st.name || '').localeCompare(String(b.st.name || ''), 'ko'); };
  var gp = function(a, b){ return String(a.st.group || '').localeCompare(String(b.st.group || ''), 'ko'); };
  if (PLWALL.sort === 'name') rows.sort(nm);
  else if (PLWALL.sort === 'group') rows.sort(function(a, b){ return gp(a, b) || nm(a, b); });
  else rows.sort(function(a, b){ return ((a.sub ? 1 : 0) - (b.sub ? 1 : 0)) || gp(a, b) || nm(a, b); });
  return rows;
}

/* ── 조작 ── */
window.pwlWeek = function(d){ PLWALL.W = d ? PW.add(pwlP(), 7 * d) : PW.thisMon(); PLWALL.page = 0; render(); };
window.pwlGrp = function(el){ PLWALL.grp = el ? String(el.getAttribute('data-g') || '') : ''; PLWALL.page = 0; render(); };
window.pwlSort = function(k){ PLWALL.sort = k; PLWALL.page = 0; render(); };
window.pwlPage = function(d){ PLWALL.page = Math.max(0, PLWALL.page + d); render(); };
window.pwlOpen = function(c){
  if (!c) return;
  PWB.order = PLWALL.order.slice();   /* 큰 달력 창의 ‹ › = 이 화면 순서 */
  plwCal(c, pwlP());
};
window.pwlKey = function(e, c){ if (e && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); pwlOpen(c); } };

/* ── 💬 알림 (확인 창 → v19-114 한마디 길) ── */
window.plwRemindText = function(P){
  var w = PW.add(P, -7), now = Date.now();
  if (now < PW.dueMs(w)) return '다음 주 계획을 아직 안 냈어요. 일요일 밤 12시까지 내면 ' + PW.PT.plan.ok + '점!';
  if (now < PW.lateMs(w)) return '이번 주 계획을 아직 안 냈어요. 오늘 밤 12시까지 내면 ' + PW.PT.plan.late + '점!';
  return '다음 주 계획을 아직 안 냈어요. 일요일 밤 12시까지 내면 ' + PW.PT.plan.ok + '점!';
};
window.plwRemindDlg = function(codes, P, title){
  codes = (codes || []).filter(function(c){ return !!wppStu(c); });
  if (!codes.length){ wppToast('알림 보낼 학생이 없어요'); return; }
  var old = document.getElementById('plw-rem-ov'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'plw-rem-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '계획 알림 보내기');
  ov.setAttribute('data-codes', codes.join(',')); ov.setAttribute('data-week', P);
  var names = codes.map(function(c){ var s = wppStu(c); return '<span class="plw-rem-nm">' + wppEsc(s.name) + (plwRemindOf(c, P) ? ' <small>(보냄)</small>' : '') + '</span>'; }).join('');
  ov.innerHTML = '<div class="plw-rem-box"><h3>💬 ' + wppEsc(title || (codes.length + '명에게 알림')) + '</h3>'
    + '<div class="plw-rem-sub">' + PW.md(P) + '~' + PW.md(PW.add(P, 6)) + ' 주 계획 · <b id="plw-rem-n">' + codes.length + '명</b></div>'
    + '<div class="plw-rem-names">' + names + '</div>'
    + '<label class="plw-rem-lb" for="plw-rem-txt">보낼 글 (고칠 수 있어요)</label>'
    + '<textarea id="plw-rem-txt" maxlength="300">' + wppEsc(plwRemindText(P)) + '</textarea>'
    + '<div class="plw-rem-sub">학생앱 «플래너» 화면 「💬 선생님 한마디」 칸에 학생마다 2주 동안 보여요 (v19-114 «원장님 한마디»와 같은 칸 — 그 학생의 지난 한마디는 이 글로 바뀝니다).</div>'
    + '<div class="plw-rem-btns"><button type="button" class="wpp-btn" id="plw-rem-no" onclick="plwRemindClose()">취소</button><button type="button" class="wpp-btn pri" id="plw-rem-go" onclick="plwRemindGo()">💬 ' + codes.length + '명에게 보내기</button></div>'
    + '<div id="plw-rem-st" class="plw-rem-sub" aria-live="polite"></div></div>';
  ov.onclick = function(e){ if (e.target === ov && !PLWALL.sending) plwRemindClose(); };
  document.body.appendChild(ov);
  setTimeout(function(){ var t = document.getElementById('plw-rem-txt'); if (t) t.focus(); }, 30);
};
window.plwRemindClose = function(){ if (PLWALL.sending) return; var ov = document.getElementById('plw-rem-ov'); if (ov) ov.remove(); };
window.plwRemindGo = async function(){
  var ov = document.getElementById('plw-rem-ov'); if (!ov || PLWALL.sending) return;
  var codes = String(ov.getAttribute('data-codes') || '').split(',').filter(Boolean), P = ov.getAttribute('data-week');
  var ta = document.getElementById('plw-rem-txt'), text = String((ta && ta.value) || '').trim().slice(0, 300);
  if (!text){ wppToast('보낼 글을 써 주세요'); if (ta) ta.focus(); return; }
  PLWALL.sending = true;
  var go = document.getElementById('plw-rem-go'), no = document.getElementById('plw-rem-no'), stEl = document.getElementById('plw-rem-st');
  if (go) go.disabled = true; if (no) no.disabled = true;
  var res = await plwRemindSend(codes, P, text, function(k, n){ if (stEl) stEl.textContent = '보내는 중 ' + k + '/' + n + '…'; });
  PLWALL.sending = false;
  ov.remove();
  var msg = '💬 ' + res.ok + '명에게 보냈어요 — 학생앱 플래너 「💬 선생님 한마디」' + (res.norow ? ' · 학생앱 플래너 점수 줄이 아직 없는 ' + res.norow + '명은 첫 승인 때 함께 나가요' : '');
  wppToast(msg);
  if (res.fail.length) alert('보내지 못한 학생 ' + res.fail.length + '명: ' + res.fail.join(', '));
  render();
};
/* 실제 보내기 — 학생마다 wpmsg_<코드> 저장 → student_planner_<코드>.teacherComment (4명씩 나눠서) */
window.plwRemindSend = async function(codes, P, text, prog){
  var out = { ok: 0, norow: 0, fail: [] }, i = 0, done = 0;
  async function one(c){
    try {
      await wppSaveMsg(c, function(v, now){
        v.weeks[P] = { text: text, like: false, at: now, remind: true };
        v.last = P; v.log.push({ W: P, text: text, like: false, remind: true, at: now });
      });
      PLWALL.msgs[c] = WPP.msg[c];
      var r = await wppPushComment(c);
      out.ok++; if (r === 'norow') out.norow++;
    } catch(e){ var s = wppStu(c); out.fail.push((s && s.name) || c); try { console.warn('[계획 알림]', c, e); } catch(_){} }
    done++; if (prog) try { prog(done, codes.length); } catch(_){}
  }
  async function lane(){ while (i < codes.length){ var c = codes[i++]; await one(c); } }
  var lanes = []; for (var k = 0; k < Math.min(4, codes.length); k++) lanes.push(lane());
  await Promise.all(lanes);
  return out;
};
window.pwlRemindAll = function(){
  var P = pwlP(), codes = pwlRows().filter(function(r){ return !r.sub; }).map(function(r){ return r.c; });
  plwRemindDlg(codes, P, '계획 안 낸 ' + codes.length + '명에게 알림' + (PLWALL.grp ? ' (' + (PLWALL.grp === '~none~' ? '반 없음' : PLWALL.grp) + ')' : ''));
};
window.pwlRemindOne = function(e, c){ if (e) e.stopPropagation(); var s = wppStu(c); plwRemindDlg([c], pwlP(), (s ? s.name : '') + ' 학생에게 알림'); };

/* ── 카드 ── */
function pwlMin(t){ var p = String(t || '').split(':'); if (p.length < 2) return -1; return Number(p[0]) * 60 + Number(p[1]); }
function pwlPct(m){ return Math.max(0, Math.min(100, (m - PLWALL_M0) / (PLWALL_M1 - PLWALL_M0) * 100)); }
/* 같은 날 겹치는 할 일은 나란히(칸 나누기) */
function pwlLanes(arr){
  arr.sort(function(a, b){ return a.a - b.a || b.e - a.e; });
  var cl = [], cur = null;
  arr.forEach(function(x){
    if (!cur || x.a >= cur.end){ cur = { end: x.e, items: [], lanes: [] }; cl.push(cur); }
    var l = 0; while (cur.lanes[l] != null && cur.lanes[l] > x.a) l++;
    cur.lanes[l] = x.e; x.lane = l; cur.items.push(x); if (x.e > cur.end) cur.end = x.e;
  });
  cl.forEach(function(c){ var n = c.lanes.length; c.items.forEach(function(x){ x.nl = n; }); });
  return arr;
}
window.plwWallCard = function(R, P, opt){
  opt = opt || {};
  var st = R.st, c = R.c, today = PW.day(), chk = wppChk(c, P), h = '';
  var grade = wppGrade(st), tag;
  if (R.sub) tag = '<span class="pwl-tag ok">' + (R.pl.codiOnly ? '🧭 코디 계획 ' : '제출 ') + R.n + '개</span>';
  else tag = '<span class="pwl-tag no">안 냄</span>';
  h += '<div class="pwl-card' + (R.sub ? '' : ' nosub') + '" data-code="' + wppEsc(c) + '"' + (opt.print ? '' : ' role="button" tabindex="0" aria-label="' + wppEsc(st.name) + ' 주간계획 크게 보기" onclick="pwlOpen(\'' + wppJs(c) + '\')" onkeydown="pwlKey(event,\'' + wppJs(c) + '\')"') + '>';
  h += '<div class="pwl-ch"><b>' + wppEsc(st.name) + '</b><span class="pwl-g">' + wppEsc(grade) + (st.group ? ' · ' + wppEsc(st.group) : '') + '</span>' + tag + '</div>';
  h += '<div class="pwl-mini"><div class="pwl-dh"></div>';
  for (var d = 0; d < 7; d++){ var dt = PW.add(P, d); h += '<div class="pwl-dh' + (dt === today ? ' t' : '') + (d === 5 ? ' sat' : (d === 6 ? ' sun' : '')) + '">' + PW.DOW[d] + '</div>'; }
  h += '<div class="pwl-hr">';
  for (var hh = 9; hh < 24; hh += 3) h += '<span style="top:' + pwlPct(hh * 60).toFixed(2) + '%">' + hh + '</span>';
  h += '</div>';
  var untimed = 0;
  for (d = 0; d < 7; d++){
    var date = PW.add(P, d);
    h += '<div class="pwl-col' + (date === today ? ' t' : '') + '" data-d="' + d + '">';
    R.fx.list.forEach(function(b){
      if ((b.days || []).indexOf(d) < 0) return;
      var a = Math.max(PLWALL_M0, pwlMin(b.start)), e = Math.min(PLWALL_M1, pwlMin(b.end)); if (!(e > a)) return;
      var cls = b.type === 'lumen' ? 'lum' : (b.type === 'school' ? 'sch' : 'oth');
      h += '<div class="pwl-fx ' + cls + '" data-type="' + wppEsc(b.type || '') + '" style="top:' + pwlPct(a).toFixed(2) + '%;height:' + (pwlPct(e) - pwlPct(a)).toFixed(2) + '%" title="' + wppEsc((b.label || '') + ' ' + (b.start || '') + '~' + (b.end || '')) + '">' + wppEsc(b.type === 'lumen' ? '루멘 수업' : (b.label || '')) + '</div>';
    });
    var its = [];
    (R.S.days[d] || []).forEach(function(x){
      var it = x.it, a = pwlMin(it.t); if (a < 0){ untimed++; return; }
      var e = a + (+it.n || 2) * 30; if (e <= PLWALL_M0){ a = PLWALL_M0; e = PLWALL_M0 + 30; } else if (a < PLWALL_M0) a = PLWALL_M0;
      if (a >= PLWALL_M1){ a = PLWALL_M1 - 30; e = PLWALL_M1; } if (e > PLWALL_M1) e = PLWALL_M1;
      its.push({ a: a, e: e, x: x });
    });
    pwlLanes(its).forEach(function(o){
      var it = o.x.it, cc = PWC_COL[it.subj] || PWC_COL['기타'], codi = it.src === 'codi', done = !!(chk[it.id] && chk[it.id].ok);
      var w = 100 / (o.nl || 1);
      h += '<div class="pwl-it ' + (codi ? 'codi' : 'me') + (done ? ' done' : '') + '" data-src="' + (codi ? 'codi' : 'me') + '" data-id="' + wppEsc(it.id) + '"'
        + ' style="top:' + pwlPct(o.a).toFixed(2) + '%;height:' + (pwlPct(o.e) - pwlPct(o.a)).toFixed(2) + '%;left:calc(' + (o.lane * w).toFixed(2) + '% + 1px);width:calc(' + w.toFixed(2) + '% - 2px);background:' + cc[0] + ';color:' + cc[1] + ';border-color:' + cc[1] + '"'
        + ' title="' + wppEsc((codi ? '🧭 코디가 짠 계획' : '✏️ 학생이 직접') + ' · ' + (it.subj || '') + ' · ' + it.title + (it.part ? ' ' + it.part : '') + ' · ' + it.t + ' ' + ((+it.n || 2) * 30) + '분' + (done ? ' · 실천 ✓' : '')) + '">'
        + (codi ? '🧭' : '✏️') + wppEsc(it.title) + '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  /* 아래 줄 */
  var ft = '실천 ' + R.ok + '/' + R.n + ' · 코디 ' + R.codi + ' · 직접 ' + R.me + ' · 시간 ' + wppHm(R.mins);
  var rm = R.sub ? null : plwRemindOf(c, P);
  h += '<div class="pwl-foot"><span class="pwl-ft">' + ft + '</span>' + (untimed ? '<span class="pwl-ut" title="시간을 안 정한 할 일">⏱ ' + untimed + '</span>' : '')
    + ((!R.sub && !opt.print) ? '<button type="button" class="pwl-rm" onclick="pwlRemindOne(event,\'' + wppJs(c) + '\')">💬 ' + (rm ? '다시 알림' : '알림') + '</button>' : '') + '</div>';
  var tags = '';
  if (!R.fx.mine) tags += '<span class="pwl-fxtag">📌 고정 일정 안 넣음(학교 기본)</span>';
  if (!R.sub){
    if (R.n) tags += '<span class="pwl-wip" title="할 일은 썼지만 학생앱에서 「계획 내기」를 안 눌렀어요">✏️ 쓰는 중 ' + R.n + '개</span>';
    if (rm) tags += '<span class="pwl-sent" title="계획 알림을 보낸 시각">💬 보냄 ' + plwTime(rm.at) + '</span>';
  }
  if (tags) h += '<div class="pwl-tags">' + tags + '</div>';
  return h + '</div>';
};

/* ── 화면 ── */
window.rPlWall = function(){
  if (!PWB.loaded){
    pwlKick(false);
    clearTimeout(PLWALL.poll); PLWALL.poll = setTimeout(function(){ if (VIEW === 'plwall') render(); }, 400);
    return '<div style="padding:40px;text-align:center;color:#94a3b8">⏳ 주간계획 불러오는 중…</div>';
  }
  if (!PLWALL.msgAt) pwlMsgLoad(false);
  var P = pwlP(), thisMon = PW.thisMon(), all = pwlAll(), groups = pwlGroups(all), rows = pwlRows();
  PLWALL.order = rows.map(function(r){ return r.c; });
  var pages = Math.max(1, Math.ceil(rows.length / PLWALL_N)); if (PLWALL.page >= pages) PLWALL.page = pages - 1; if (PLWALL.page < 0) PLWALL.page = 0;
  var vis = rows.slice(PLWALL.page * PLWALL_N, PLWALL.page * PLWALL_N + PLWALL_N);
  PLWALL.vis = vis.map(function(r){ return r.c; });
  var nSub = rows.filter(function(r){ return r.sub; }).length, nIt = 0, nOk = 0;
  rows.forEach(function(r){ nIt += r.n; nOk += r.ok; });
  var nNo = rows.length - nSub;
  var rel = P === thisMon ? '이번 주' : (P === PW.add(thisMon, -7) ? '지난 주' : (P === PW.add(thisMon, 7) ? '다음 주' : ''));
  var chip = function(on, label, js, extra){ return '<button type="button" class="pwl-c' + (on ? ' on' : '') + '" aria-pressed="' + (!!on) + '" onclick="' + js + '"' + (extra || '') + '>' + label + '</button>'; };
  var h = '<div class="pwl-wrap">';
  h += '<div class="pwl-hd"><b class="pwl-ttl">🗓 주간계획 모아보기</b>'
    + '<span class="pwl-gp" role="group" aria-label="주 고르기">' + chip(false, '‹', 'pwlWeek(-1)', ' aria-label="앞 주"') + chip(true, PW.md(P) + '~' + PW.md(PW.add(P, 6)) + (rel ? ' ' + rel : ''), 'pwlWeek(0)', ' title="이번 주로"') + chip(false, '›', 'pwlWeek(1)', ' aria-label="다음 주"') + '</span>'
    + '<span class="pwl-gp pwl-grps" role="group" aria-label="반">' + chip(PLWALL.grp === '', '전체 <small>' + all.length + '</small>', 'pwlGrp(null)', ' data-g=""')
    + groups.map(function(g){ var key = g.g || '~none~'; return chip(PLWALL.grp === key, wppEsc(g.g || '반 없음') + ' <small>' + g.n + '</small>', 'pwlGrp(this)', ' data-g="' + wppEsc(key) + '"'); }).join('') + '</span>'
    + '<span class="pwl-gp pwl-pg" role="group" aria-label="6명씩 넘기기">' + chip(false, '‹ 앞 6명', 'pwlPage(-1)', PLWALL.page <= 0 ? ' disabled' : '')
    + '<span class="pwl-c on pwl-pgn" aria-live="polite">' + (PLWALL.page + 1) + ' / ' + pages + '</span>'
    + chip(false, '다음 6명 ›', 'pwlPage(1)', PLWALL.page >= pages - 1 ? ' disabled' : '') + '</span></div>';
  h += '<div class="pwl-sum">'
    + '<div><b>' + nSub + '/' + rows.length + '</b>명 계획 냄</div>'
    + '<div>할 일 <b>' + nIt + '</b>개</div>'
    + '<div>실천 ✓ <b style="color:#15803d">' + nOk + '</b>개</div>'
    + '<div class="pwl-no">안 낸 <b style="color:#dc2626">' + nNo + '</b>명' + (nNo ? ' → <button type="button" class="pwl-link" id="pwl-remind-all" onclick="pwlRemindAll()">💬 모아서 알림</button>' : '') + '</div>'
    + '<div class="pwl-sort">정렬: ' + chip(PLWALL.sort === 'nosub', '안 낸 학생 먼저', "pwlSort('nosub')") + chip(PLWALL.sort === 'name', '이름', "pwlSort('name')") + chip(PLWALL.sort === 'group', '반', "pwlSort('group')")
    + ' <button type="button" class="pwl-link" id="pwl-print" onclick="pwlPrint()">🖨 ' + vis.length + '명 한 장 인쇄</button></div></div>';
  if (!rows.length) h += '<div class="pwl-empty">이 반에 학생이 없어요.</div>';
  else {
    h += '<div class="pwl-grid">';
    vis.forEach(function(R){ h += plwWallCard(R, P); });
    h += '</div>';
  }
  h += '<div class="pwl-legend"><span class="pwl-lg sch">학교·학원</span><span class="pwl-lg lum">루멘 수업</span><span class="pwl-lg codi">🧭 코디가 짠 계획</span><span class="pwl-lg me">✏️ 학생이 직접</span><span class="pwl-lg done">실천 ✓</span>'
    + '<span>· 9시~24시 · 카드를 누르면 큰 달력 · 계획 냄 = 학생이 「계획 내기」를 눌렀거나 코디 계획이 있음 (주간 점수와 같은 기준)</span></div>';
  return h + '</div>';
};

/* 🖨 지금 보이는 6명 한 장 (A4 가로) */
window.pwlPrint = function(){
  var P = pwlP(), rows = pwlRows(), vis = rows.filter(function(r){ return (PLWALL.vis || []).indexOf(r.c) >= 0; });
  vis.sort(function(a, b){ return PLWALL.vis.indexOf(a.c) - PLWALL.vis.indexOf(b.c); });
  if (!vis.length){ wppToast('인쇄할 학생이 없어요'); return; }
  var css = (document.getElementById('pwl-css') || {}).textContent || '';
  var h = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>주간계획 ' + PW.md(P) + '~' + PW.md(PW.add(P, 6)) + '</title><style>' + css
    + '@page{size:A4 landscape;margin:7mm}html,body{margin:0;background:#fff;font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.pp{width:283mm;height:194mm;overflow:hidden;display:flex;flex-direction:column;gap:2mm;page-break-after:avoid}'
    + '.pp h1{font-size:14px;margin:0;color:#0d2240}.pp .pwl-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3mm;flex:1}'
    + '.pp .pwl-card{padding:6px;border-radius:8px;break-inside:avoid}.pp .pwl-mini{--pwl-h:236px}.bar{padding:6px}.bar button{font:inherit;padding:5px 12px;border-radius:8px;border:1px solid #0d2240;background:#0d2240;color:#fff;font-weight:800}@media print{.bar{display:none}}'
    + '</style></head><body><div class="bar"><button onclick="window.print()">🖨 인쇄</button></div><div class="pp"><h1>🗓 주간계획 ' + PW.md(P) + '(월) ~ ' + PW.md(PW.add(P, 6)) + '(일)' + (PLWALL.grp ? ' · ' + wppEsc(PLWALL.grp === '~none~' ? '반 없음' : PLWALL.grp) : '') + '</h1><div class="pwl-grid">';
  vis.forEach(function(R){ h += plwWallCard(R, P, { print: true }); });
  h += '</div></div><script>setTimeout(function(){window.print()},300)<\/script></body></html>';
  var w = window.open('', '_blank'); if (!w){ alert('팝업이 막혔습니다 — 허용해 주세요'); return; }
  w.document.open(); w.document.write(h); w.document.close();
};

document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && document.getElementById('plw-rem-ov')) plwRemindClose();
});

/* ── 모양 ── */
(function(){
  if (document.getElementById('pwl-css')) return;
  var st = document.createElement('style'); st.id = 'pwl-css';
  st.textContent = ''
    + '.pwl-wrap{padding:14px 18px;display:flex;flex-direction:column;gap:10px;min-width:0}'
    + '.pwl-hd{background:linear-gradient(135deg,#0d2240,#164a7a);color:#fff;border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;min-width:0}'
    + '.pwl-ttl{font-size:15px;font-weight:900;white-space:nowrap}.pwl-gp{display:inline-flex;gap:4px;flex-wrap:wrap;min-width:0}.pwl-pg{margin-left:auto}'
    + '.pwl-c{border-radius:999px;padding:5px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;background:rgba(255,255,255,.13);color:#fff;border:1px solid rgba(255,255,255,.28);white-space:nowrap}'
    + '.pwl-c small{opacity:.7;font-size:10.5px}.pwl-c.on{background:#fff;color:#0d2240;border-color:#fff}.pwl-c[disabled]{opacity:.4;cursor:default}.pwl-pgn{cursor:default}'
    + '.pwl-c:focus-visible,.pwl-link:focus-visible,.pwl-rm:focus-visible,.pwl-card:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '.pwl-sum{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pwl-sum>div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:7px 12px;font-size:12.5px;color:#334155;font-weight:700}'
    + '.pwl-sum b{font-size:17px;margin-right:2px;color:#0d2240}.pwl-sort{display:flex;align-items:center;gap:5px;flex-wrap:wrap}'
    + '.pwl-sort .pwl-c{background:#f1f5f9;color:#475569;border-color:#e2e8f0;padding:3px 9px}.pwl-sort .pwl-c.on{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.pwl-link{border:none;background:none;padding:0;font:inherit;font-weight:900;color:#1d4ed8;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'
    + '.pwl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}'
    + '@media(max-width:1023px){.pwl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '@media(max-width:640px){.pwl-grid{grid-template-columns:minmax(0,1fr)}.pwl-pg{margin-left:0}.pwl-wrap{padding:10px}}'
    + '.pwl-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:8px 9px;min-width:0;cursor:pointer;display:flex;flex-direction:column;gap:4px}'
    + '.pwl-card:hover{border-color:#93c5fd;box-shadow:0 2px 10px rgba(29,111,232,.12)}.pwl-card.nosub{border-color:#fecaca}'
    + '.pwl-ch{display:flex;align-items:baseline;gap:6px;min-width:0}.pwl-ch b{font-size:14px;color:#0d2240;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pwl-g{color:#64748b;font-size:11px;font-weight:700;white-space:nowrap}'
    + '.pwl-tag{margin-left:auto;font-size:10.5px;font-weight:900;border-radius:6px;padding:2px 7px;white-space:nowrap}.pwl-tag.ok{background:#dcfce7;color:#15803d}.pwl-tag.no{background:#fee2e2;color:#dc2626}'
    + '.pwl-mini{--pwl-h:clamp(140px,calc(50vh - 330px),240px);display:grid;grid-template-columns:20px repeat(7,minmax(0,1fr));gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}'
    + '.pwl-dh{background:#0d2240;color:#fff;text-align:center;font-size:10.5px;font-weight:800;padding:2px 0}.pwl-dh.t{background:#ea580c}.pwl-dh.sat{color:#93c5fd}.pwl-dh.sun{color:#fca5a5}.pwl-dh.t.sat,.pwl-dh.t.sun{color:#fff}'
    + '.pwl-hr{position:relative;height:var(--pwl-h);background:#f8fafc;font-size:9px;color:#94a3b8;font-weight:700}.pwl-hr span{position:absolute;left:0;right:0;text-align:center;line-height:1}'
    + '.pwl-col{position:relative;height:var(--pwl-h);background-color:#fff;background-image:linear-gradient(#eef2f6 1px,transparent 1px);background-size:100% 20%;overflow:hidden}.pwl-col.t{background-color:#fff8f1}'
    + '.pwl-fx{position:absolute;left:1px;right:1px;border-radius:3px;font-size:9px;font-weight:800;display:flex;align-items:flex-start;justify-content:center;text-align:center;overflow:hidden;line-height:1.15;padding-top:1px;box-sizing:border-box;z-index:0;word-break:keep-all}'
    + '.pwl-fx.sch{background:#e5e7eb;color:#6b7280}.pwl-fx.oth{background:#eef0f3;color:#64748b;border:1px solid #cbd5e1}.pwl-fx.lum{background:#fee2e2;color:#b91c1c;border:1px solid #f87171}'
    + '.pwl-it{position:absolute;border-radius:3px;font-size:9px;font-weight:800;line-height:1.15;padding:0 1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;min-height:9px;z-index:1}'
    + '.pwl-it.codi{border-width:1.5px;border-style:solid}.pwl-it.me{border-width:1.5px;border-style:dashed}.pwl-it.done{outline:2px solid #16a34a;outline-offset:-1px;z-index:2}'
    + '.pwl-foot{display:flex;justify-content:space-between;gap:6px;color:#475569;font-size:11px;font-weight:700;min-width:0}.pwl-ft{overflow-wrap:anywhere}.pwl-ut{color:#64748b;white-space:nowrap}'
    + '.pwl-tags{display:flex;gap:5px;flex-wrap:wrap;align-items:center}.pwl-tags>*{font-size:10.5px;font-weight:800;border-radius:6px;padding:1px 6px;white-space:nowrap}'
    + '.pwl-fxtag{background:#fff7ed;color:#9a3412}.pwl-wip{background:#f1f5f9;color:#475569}.pwl-sent{background:#f0fdf4;color:#166534}'
    + '.pwl-rm{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;cursor:pointer;font:inherit;font-size:10.5px;font-weight:900;border-radius:6px;padding:1px 7px;white-space:nowrap;margin-left:auto}'
    + '.pwl-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;color:#64748b;font-weight:700}'
    + '.pwl-legend{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11px;color:#64748b;font-weight:700}.pwl-lg{border-radius:4px;padding:1px 6px;font-size:10.5px;font-weight:800}'
    + '.pwl-lg.sch{background:#e5e7eb;color:#6b7280}.pwl-lg.lum{background:#fee2e2;color:#b91c1c;border:1px solid #f87171}.pwl-lg.codi{background:#fde2e1;color:#b3261e;border:1.5px solid #b3261e}'
    + '.pwl-lg.me{background:#dbeafe;color:#1d4ed8;border:1.5px dashed #1d4ed8}.pwl-lg.done{background:#fff;color:#15803d;outline:2px solid #16a34a;outline-offset:-2px}'
    /* 알림 확인 창 */
    + '#plw-rem-ov{position:fixed;inset:0;z-index:10001;background:rgba(13,34,64,.45);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.plw-rem-box{background:#fff;border-radius:16px;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:16px;display:flex;flex-direction:column;gap:9px;box-shadow:0 20px 50px rgba(13,34,64,.35)}'
    + '.plw-rem-box h3{margin:0;font-size:16px;color:#0d2240}.plw-rem-sub{font-size:12px;color:#64748b;font-weight:700;line-height:1.55}.plw-rem-sub b{color:#dc2626}'
    + '.plw-rem-names{display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow:auto}.plw-rem-nm{font-size:11.5px;font-weight:800;background:#f1f5f9;color:#334155;border-radius:6px;padding:2px 7px}.plw-rem-nm small{color:#15803d}'
    + '.plw-rem-lb{font-size:12px;font-weight:900;color:#0d2240}.plw-rem-box textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:inherit;font-size:13px;min-height:64px;resize:vertical}'
    + '.plw-rem-btns{display:flex;gap:8px;justify-content:flex-end}';
  (document.head || document.documentElement).appendChild(st);
})();
