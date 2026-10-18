/* ══════════════════════════════════════════════════════════════════════════
 * v19-139: 🎯 시험대비 트랙 — 학사일정 보고 다음 시험 트랙 자동 · 디데이 자동 · 트랙마다 공개/비공개 · 화면에서 트랙 만들기
 *   원장 2026-10-19 「시험대비트랙도 다음기말고사가 만들어져야 한다. 학교시험 디데이도 업데이트 되어야 하고,
 *   시험대비 트랙을 화면에서 만드는 기능이 없다. 학사일정 보고 자동으로 다음 시험대비 트랙이 만들어지거나
 *   수정되게 하고 공개여부 할 수 있게」
 *
 *   저장(lumen_store 'exam_track') — 바뀌는 칸만:
 *     tracks[<학교 학년>].exam = {label,from,to}   ← 이 트랙이 대비하는 시험
 *     tracks[...].pub = true|false                   ← 트랙마다 학생앱 공개 (새 트랙은 false)
 *     tracks[...].auto/created/from(=보관한 지난 트랙 pid)/examManual(손으로 고친 시험 — 학사일정이 날짜를 덮지 않음)/skipNext(되돌리기 한 다음 시험)
 *     pubTracks = 공개(pub:true)인 트랙 이름 목록 — 배포된 학생앱(v2-65~)이 이미 이 목록만 보여 준다.
 *                 하나도 없으면 ['__none__'] (빈 목록은 «전체 공개»라는 옛 뜻이라 쓰지 않는다)
 *     ddays[] 의 학사일정 디데이는 auto:true · to(끝날) — 손으로 넣은 디데이(auto 없음)는 그대로 둔다
 *     past[] = 지난 트랙 보관 {grp, school, exam, items, pub…, archivedAt, why:'auto'|'new'|'delete', pid, indiv?} 최근 20개
 *   ① 화면을 열 때(그리고 🏫 학사일정 단추) school_calendar 를 읽어
 *      · 디데이: 학교별 «지금 치르는/끝난 지 3일 안 된» 시험 + 학년 묶음마다 다음 시험 (끝난 지 3일 넘은 자동 디데이는 지움)
 *      · 트랙: 시험이 안 적힌 트랙은 «오늘까지 시작한 가장 최근 시험»으로 적는다(없으면 디데이 → 다음 시험)
 *              같은 이름 시험 날짜가 학사일정에서 바뀌면 고친다 · 시험이 끝났고 다음 시험이 있으면
 *              지금 트랙을 past 로 보관하고 빈 새 트랙(🔒 비공개)을 만든다. 초등은 시험이 없어 건너뛴다.
 *      바뀐 것이 있을 때만 저장하고, 화면 위 띠에 무엇을 했는지 + 「↩ 되돌리기」.
 *   ② 저장은 «서버에서 다시 읽고 → 내가 바꾼 칸만 얹기»(3-way): 다른 기기가 바꾼 indiv·다른 트랙·모르는 칸을 지우지 않는다.
 *   ③ 「＋ 시험 트랙 만들기」(학교·학년 · 학사일정 시험 또는 직접 입력 · 지난 트랙 교재 그대로 가져오기) ·
 *      트랙 상자에 📝 시험 · ✏️ 시험 고치기 · 🗑 트랙 지우기(보관함으로) · 🔒 비공개/👁 공개.
 * ══════════════════════════════════════════════════════════════════════════ */
var XT139_NONE = '__none__';
XT.cal = null; XT.base = null; XT.a139 = null; XT.mk = null; XT.loadFail = false;

function xt139Today(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function xt139AddDays(d, n){ return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function xt139Clone(v){ return (v === undefined || v === null) ? v : JSON.parse(JSON.stringify(v)); }
function xt139J(v){ return v === undefined ? '~' : JSON.stringify(v); }
function xt139Md(d){ return String(d || '').slice(5).replace('-', '/'); }
function xt139Range(e){ if (!e || !e.from) return ''; return xt139Md(e.from) + ((e.to && e.to !== e.from) ? ('~' + xt139Md(e.to)) : ''); }
function xt139Norm0(s){ return String(s || '').replace(/\s/g, ''); }
function xt139Lv(k){ var g = xtGradeOfKey(k); return { lv: g.charAt(0), n: Number(g.replace(/\D/g, '')) || 0 }; }
function xt139IsElem(k){ return /초$/.test(xtSchoolOfKey(k)) || xt139Lv(k).lv === '초'; }
function xt139ParseCal(v){ if (typeof v === 'string'){ try { v = JSON.parse(v); } catch (e){ v = null; } } return (v && typeof v === 'object') ? v : null; }

/* ── 학사일정 → 이 트랙(학교 학년)의 시험 목록 (날짜순) ── */
function xt139School(cal, short){
  var n = xt139Norm0(short), hit = null;
  ((cal && cal.schools) || []).forEach(function(sc){
    if (hit || !sc) return;
    if (xt139Norm0(xtSchoolShort(sc.name)) === n || xt139Norm0(sc.short) === n) hit = sc;
  });
  return hit;
}
function xt139Exams(cal, k){
  if (!cal || xt139IsElem(k)) return [];
  var sc = xt139School(cal, xtSchoolOfKey(k)); if (!sc || sc.kind === '초') return [];
  var gn = xt139Lv(k).n, seen = {}, out = [];
  (sc.exams || []).forEach(function(e){
    if (!e || !e.from) return;
    if (e.grades && e.grades.length && gn && e.grades.indexOf(gn) < 0) return;
    var x = { label: String(e.label || e.name || '시험'), from: String(e.from), to: String(e.to || e.from) };
    var sig = x.label + '|' + x.from; if (seen[sig]) return; seen[sig] = 1; out.push(x);
  });
  return out.sort(function(a, b){ return a.from < b.from ? -1 : (a.from > b.from ? 1 : 0); });
}
function xt139CleanLabel(l){ return String(l || '시험').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*·\s*[\d·,]+학년\s*$/, '').trim() || '시험'; }
/* 시험이 안 적힌 트랙: 오늘까지 시작한 가장 최근 시험 → 없으면 디데이 → 없으면 다음 시험 */
function xt139Infer(d, cal, k, today){
  var ex = xt139Exams(cal, k);
  var st = ex.filter(function(e){ return e.from <= today; });
  if (st.length) return xt139Clone(st[st.length - 1]);
  var dd = xtFindDday(d.ddays, xtSchoolOfKey(k), xtGradeOfKey(k));
  if (dd && dd.date){
    var m = String(dd.label || '').match(/\((\d\d)-(\d\d)~(\d\d)-(\d\d)\)/);
    var to = dd.to || (m ? (String(dd.date).slice(0, 4) + '-' + m[3] + '-' + m[4]) : dd.date);
    if (to < dd.date) to = dd.date;
    return { label: xt139CleanLabel(dd.label), from: dd.date, to: to };
  }
  return ex[0] ? xt139Clone(ex[0]) : null;
}

/* ── 공개: 트랙마다 pub → pubTracks (배포된 학생앱이 읽는 칸) ── */
function xt139Norm(d){
  var ks = Object.keys(d.tracks || {});
  if (!ks.length) return;
  var pt = Array.isArray(d.pubTracks) ? d.pubTracks : [];
  ks.forEach(function(k){
    var tr = d.tracks[k]; if (!tr || typeof tr !== 'object') return;
    if (!Array.isArray(tr.items)) tr.items = [];
    if (typeof tr.pub !== 'boolean') tr.pub = (!pt.length) || pt.indexOf(k) >= 0;   /* 옛 뜻: 빈 목록 = 전체 공개 */
  });
  var on = ks.filter(function(k){ return d.tracks[k] && d.tracks[k].pub === true; }).sort();
  d.pubTracks = on.length ? on : [XT139_NONE];
}
function xt139Bool(k){ var tr = xtD().tracks[k]; return !!(tr && tr.pub === true); }

/* ── 디데이: 학사일정에서 다시 만든다 (손으로 넣은 것은 그대로) ── */
function xt139DdLabel(e){
  return (e.label || e.name || '시험') + (e.grades && e.grades.length ? (' · ' + e.grades.join('·') + '학년') : '')
    + ((e.to && e.to !== e.from) ? (' (' + String(e.from).slice(5) + '~' + String(e.to).slice(5) + ')') : '');
}
function xt139SyncDdays(d, cal, today){
  if (!cal || !(cal.schools || []).length) return null;
  var cut = xt139AddDays(today, -3), calFrom = {}, auto = [];
  cal.schools.forEach(function(sc){
    if (!sc || sc.kind === '초' || /초등학교$/.test(String(sc.name || ''))) return;
    var short = xtSchoolShort(sc.name) || String(sc.short || ''); if (!short) return;
    var ex = (sc.exams || []).filter(function(e){ return e && e.from; }).slice().sort(function(a, b){ return a.from < b.from ? -1 : (a.from > b.from ? 1 : 0); });
    var nk = xt139Norm0(short); calFrom[nk] = calFrom[nk] || {};
    var upSeen = {};
    ex.forEach(function(e){
      calFrom[nk][e.from] = 1;
      var to = e.to || e.from, sig = (e.grades && e.grades.length) ? e.grades.join('·') : '';
      var cur = e.from <= today && to >= cut;
      var up = e.from > today && !upSeen[sig];
      if (up) upSeen[sig] = 1;
      if (!cur && !up) return;
      auto.push({ school: short, label: xt139DdLabel(e), date: e.from, to: to, grades: (e.grades && e.grades.length) ? e.grades.slice() : null, auto: true });
    });
  });
  /* 손으로 넣은 디데이 = auto 표시가 없고, 학사일정 시험 첫날과도 안 맞는 것 (옛 「🏫 학사일정」으로 들어온 것은 학사일정 것으로 본다) */
  var before = d.ddays || [];
  var manual = before.filter(function(x){
    if (!x || x.auto) return false;
    var c = calFrom[xt139Norm0(x.school)];
    return !(c && c[x.date]);
  });
  var next = manual.concat(auto).sort(function(a, b){ var c = String(a.date).localeCompare(String(b.date)); return c || String(a.school).localeCompare(String(b.school)); });
  var sig = function(x){ return xt139Norm0(x.school) + '|' + x.date + '|' + ((x.grades || []).join('·')) + '|' + x.label; };
  var bs = {}, ns = {}; before.forEach(function(x){ if (x) bs[sig(x)] = x; }); next.forEach(function(x){ ns[sig(x)] = x; });
  var add = next.filter(function(x){ return !bs[sig(x)]; }), del = before.filter(function(x){ return x && !ns[sig(x)]; });
  var changed = xt139J(before) !== xt139J(next);
  d.ddays = next;
  return { add: add, del: del, changed: changed, n: next.length };
}

/* ── 지난 트랙 보관 (그 학년 학생의 개별 끼워넣기도 같이) ── */
function xt139Archive(d, k, why){
  var tr = d.tracks[k]; if (!tr) return null;
  if (!Array.isArray(d.past)) d.past = [];
  var e = xt139Clone(tr);
  e.grp = k; e.school = e.school || xtSchoolOfKey(k); e.items = e.items || []; e.exam = e.exam || null;
  e.archivedAt = new Date().toISOString(); e.why = why;
  e.pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var iv = {};
  activeStudents().forEach(function(s){
    if (xtKeyOf(s) !== k) return;
    var c = String(s.lumen_rec_code || '');
    if (c && d.indiv[c] && d.indiv[c].length){ iv[c] = d.indiv[c]; delete d.indiv[c]; }
  });
  if (Object.keys(iv).length) e.indiv = iv;
  d.past.push(e);
  if (d.past.length > 20) d.past = d.past.slice(-20);
  return e.pid;
}
function xt139PastIdx(d, pid){ var a = d.past || []; for (var i = 0; i < a.length; i++) if (a[i] && a[i].pid === pid) return i; return -1; }
function xt139LastPast(d, k){ var a = (d.past || []).filter(function(p){ return p && p.grp === k; }); return a.length ? a[a.length - 1] : null; }
function xt139CopyItems(items){
  return (items || []).map(function(it){
    var c = xt139Clone(it), had = (c.pFrom != null || c.pTo != null);
    delete c.pFrom; delete c.pTo;
    if (had && !c.pc) c.needCheck = true;   /* 범위가 있던 목표 수는 새 시험에 맞지 않을 수 있다 */
    return c;
  });
}

/* ── 트랙: 시험 적기 · 날짜 고치기 · 끝났으면 다음 트랙 ── */
function xt139Roll(d, cal, today, log){
  Object.keys(d.tracks).sort().forEach(function(k){
    var tr = d.tracks[k]; if (!tr || typeof tr !== 'object' || xt139IsElem(k)) return;
    var ex = xt139Exams(cal, k);
    if (!tr.exam || !tr.exam.from){
      var inf = xt139Infer(d, cal, k, today); if (!inf) return;
      tr.exam = inf; log.inf.push(k);
    }
    if (!tr.examManual){
      var same = ex.filter(function(e){ return e.label === tr.exam.label; });
      if (same.length){
        var t0 = Date.parse(tr.exam.from + 'T00:00:00Z');
        same.sort(function(a, b){ return Math.abs(Date.parse(a.from + 'T00:00:00Z') - t0) - Math.abs(Date.parse(b.from + 'T00:00:00Z') - t0); });
        var s = same[0];
        if (s.from !== tr.exam.from || s.to !== tr.exam.to){
          log.upd.push({ grp: k, label: tr.exam.label, old: { from: tr.exam.from, to: tr.exam.to }, now: { from: s.from, to: s.to } });
          tr.exam.from = s.from; tr.exam.to = s.to;
        }
      }
    }
    var endd = tr.exam.to || tr.exam.from;
    if (!(today > endd)) return;
    var nx = ex.filter(function(e){ return e.from > endd; })[0];
    if (!nx) return;
    if (tr.skipNext && tr.skipNext === nx.label + '|' + nx.from) return;
    var n0 = (tr.items || []).length, prev = xt139Clone(tr.exam);
    var pid = xt139Archive(d, k, 'auto');
    d.tracks[k] = { school: tr.school || xtSchoolOfKey(k), exam: xt139Clone(nx), items: [], pub: false, auto: true, created: new Date().toISOString(), from: pid };
    log.made.push({ grp: k, exam: xt139Clone(nx), prev: prev, pid: pid, n: n0 });
  });
}
function xt139Keep(log){
  if (!log) return;
  if (!XT.a139) XT.a139 = { made: [], upd: [], dd: { add: [], del: [] }, inf: [] };
  var A = XT.a139;
  log.made.forEach(function(m){ A.made.push(m); });
  log.upd.forEach(function(u){ A.upd.push(u); });
  log.inf.forEach(function(k){ if (A.inf.indexOf(k) < 0) A.inf.push(k); });
  if (log.dd && log.dd.changed){ log.dd.add.forEach(function(x){ A.dd.add.push(x); }); log.dd.del.forEach(function(x){ A.dd.del.push(x); }); }
  if (log.made.length || log.upd.length || (log.dd && (log.dd.add.length || log.dd.del.length))) A.hide = false;
}
/* 화면을 열 때 · 🏫 학사일정 단추 — 바뀐 것이 있을 때만 저장 */
async function xt139Auto(){
  var d = xtD(), today = xt139Today();
  var before = xt139J(d);
  var log = { made: [], upd: [], inf: [], dd: null };
  xt139Norm(d);
  xt139Roll(d, XT.cal, today, log);
  log.dd = xt139SyncDdays(d, XT.cal, today);
  xt139Norm(d);
  log.changed = xt139J(d) !== before;
  xt139Keep(log);
  if (log.changed) log.saved = await xtSave(true);
  return log;
}

/* ── 서버 읽기 · 쓰기 (3-way: 내가 바꾼 칸만 얹는다) ── */
function xt139Flat(base, mine, server){
  var out = (server && typeof server === 'object' && !Array.isArray(server)) ? xt139Clone(server) : {};
  base = base || {}; mine = mine || {};
  var ks = {}; Object.keys(mine).forEach(function(k){ ks[k] = 1; }); Object.keys(base).forEach(function(k){ ks[k] = 1; });
  Object.keys(ks).forEach(function(k){
    if (xt139J(mine[k]) === xt139J(base[k])) return;
    if (k in mine) out[k] = xt139Clone(mine[k]); else delete out[k];
  });
  return out;
}
function xt139Merge(base, mine, server){
  base = base || {};
  var out = (server && typeof server === 'object' && !Array.isArray(server)) ? xt139Clone(server) : {};
  var ks = {}; Object.keys(mine).forEach(function(k){ ks[k] = 1; }); Object.keys(base).forEach(function(k){ ks[k] = 1; });
  Object.keys(ks).forEach(function(k){
    if (xt139J(mine[k]) === xt139J(base[k])) return;
    if (k === 'tracks' || k === 'indiv'){ out[k] = xt139Flat(base[k], mine[k], out[k]); return; }
    if (k === 'past'){
      var bh = {}, mh = {}, res = [], rh = {};
      (base.past || []).forEach(function(p){ if (p && p.pid) bh[p.pid] = 1; });
      (mine.past || []).forEach(function(p){ if (p && p.pid) mh[p.pid] = 1; });
      (Array.isArray(out.past) ? out.past : []).forEach(function(p){ if (p && p.pid && bh[p.pid] && !mh[p.pid]) return; res.push(p); if (p && p.pid) rh[p.pid] = 1; });
      (mine.past || []).forEach(function(p){ if (!p || (p.pid && rh[p.pid])) return; res.push(xt139Clone(p)); });
      res.sort(function(a, b){ return String(a && a.archivedAt).localeCompare(String(b && b.archivedAt)); });
      out.past = res.slice(-20); return;
    }
    if (k in mine) out[k] = xt139Clone(mine[k]); else delete out[k];
  });
  return out;
}
async function xtLoad(force){
  if (XT.loaded && !force) return;
  if (XT._ld139) return;
  XT._ld139 = true;
  try {
    var sb = getSupaClient(); if (!sb) return;
    var r = await sb.from('lumen_store').select('key,value').in('key', ['exam_track', 'school_calendar']);
    if (!r || r.error){
      XT.loadFail = true; XT.data = XT.data || {}; xtD(); XT.loaded = true;
      plToast('시험대비 트랙을 서버에서 못 읽었습니다 — 🔄 로 다시 불러와 주세요 (그동안 저장하지 않습니다)');
      if (VIEW === 'examtrack') render();
      return;
    }
    var got = {}; (r.data || []).forEach(function(x){ got[x.key] = xt139ParseCal(x.value); });
    XT.loadFail = false;
    XT.data = got.exam_track || {};
    XT.base = xt139Clone(XT.data);
    XT.cal = got.school_calendar || null;
    xtD(); XT.loaded = true;
    if (!XT.mfMap){
      var m = await sb.from('mf_students').select('mf_student_id,lumen_rec_code');
      XT.mfMap = {}; ((m && m.data) || []).forEach(function(x){ if (x.lumen_rec_code) XT.mfMap[String(x.lumen_rec_code)] = x.mf_student_id; });
    }
    await xt139Auto();
    var d = xtD();
    if (!XT.grp || (!d.tracks[XT.grp] && xtGroups().indexOf(XT.grp) < 0)){ var ks = Object.keys(d.tracks).sort(); XT.grp = ks[0] || ''; }
    xtLoadProg();
    if (VIEW === 'examtrack') render();
  } catch (e){ console.error('시험대비 트랙 불러오기 실패:', e); }
  finally { XT._ld139 = false; }
}
async function xtSave(quiet){
  if (XT.loadFail){ plToast('서버에서 트랙을 못 읽어 저장하지 않았습니다 — 🔄 를 눌러 다시 불러와 주세요'); return false; }
  var d = xtD(); xt139Norm(d); d.updated = new Date().toISOString();
  XT.saving = true; if (VIEW === 'examtrack') render();
  var ok = false;
  try {
    var sb = getSupaClient(); if (!sb) throw new Error('연결 없음');
    var r = await sb.from('lumen_store').select('value').eq('key', 'exam_track');
    if (!r || r.error) throw new Error((r && r.error && r.error.message) || '서버 읽기 실패');
    var sv = (r.data && r.data[0]) ? xt139ParseCal(r.data[0].value) : null;
    var merged = xt139Merge(XT.base || {}, d, sv || {});
    xt139Norm(merged);
    ok = await supaSetItem('exam_track', merged);
    if (ok){ XT.data = merged; XT.base = xt139Clone(merged); xtD(); }
  } catch (e){ console.error('시험대비 트랙 저장 실패:', e); ok = false; }
  XT.saving = false;
  if (!ok) plToast('저장 실패 — 네트워크를 확인해 주세요');
  if (VIEW === 'examtrack') render();
  return ok;
}

/* ── 🏫 학사일정 단추: 학사일정을 새로 읽고 ①을 바로 한다 ── */
window.xtPullDdays = async function(){
  try {
    var sb = getSupaClient(); if (!sb){ plToast('연결이 없습니다'); return; }
    if (!XT.loaded || XT.loadFail){ await xtLoad(true); if (XT.loadFail) return; }
    plToast('나이스 학사일정에서 가져오는 중…');
    var r = await sb.from('lumen_store').select('value').eq('key', 'school_calendar');
    var v = (r && r.data && r.data[0]) ? xt139ParseCal(r.data[0].value) : null;
    if (!v || !(v.schools || []).length){ alert('학사일정이 아직 수집되지 않았습니다.\n(매일 새벽 자동 수집 — 잠시 뒤 다시 시도해 주세요)'); return; }
    XT.cal = v;
    var log = await xt139Auto();
    if (!log.changed){ plToast('📅 학사일정 그대로 — 디데이 ' + xtD().ddays.length + '개 · 트랙 ' + Object.keys(xtD().tracks).length + '개 이미 최신입니다'); return; }
    plToast('📅 학사일정 반영 — 디데이 새로 ' + ((log.dd && log.dd.add.length) || 0) + '개 · 지움 ' + ((log.dd && log.dd.del.length) || 0) + '개 · 새 트랙 ' + log.made.length + '개 · 날짜 고침 ' + log.upd.length + '개');
  } catch (e){ console.error(e); plToast('가져오기 실패: ' + e.message); }
};
window.xtDelDday = function(i){
  var x = xtD().ddays[i]; if (!x) return;
  if (!confirm(x.auto ? ('「' + x.school + ' ' + x.label + '」 디데이를 지울까요?\n\n학사일정에서 자동으로 온 디데이라 다음에 이 화면을 열면 다시 생깁니다.') : '이 디데이를 지울까요?')) return;
  xtD().ddays.splice(i, 1); xtSave();
};

/* ── ↩ 되돌리기 (이번에 자동으로 한 것) ── */
window.xt139Undo = function(i){
  var A = XT.a139, m = A && A.made[i]; if (!m || m.undone) return;
  var d = xtD(), pi = xt139PastIdx(d, m.pid);
  if (pi < 0){ plToast('보관한 지난 트랙을 찾지 못했습니다'); return; }
  var cur = d.tracks[m.grp];
  if (cur && cur.items && cur.items.length && !confirm('「' + m.grp + '」 새 트랙에 벌써 교재 ' + cur.items.length + '권을 넣었습니다.\n되돌리면 새 트랙은 지워지고 지난 트랙(' + ((m.prev && m.prev.label) || '') + ')이 돌아옵니다. 되돌릴까요?')) return;
  var p = d.past.splice(pi, 1)[0], iv = p.indiv;
  ['grp', 'archivedAt', 'why', 'pid', 'indiv'].forEach(function(f){ delete p[f]; });
  p.skipNext = m.exam.label + '|' + m.exam.from;   /* 다음에 열 때 다시 만들지 않는다 — 필요하면 「＋ 시험 트랙 만들기」 */
  d.tracks[m.grp] = p;
  if (iv) Object.keys(iv).forEach(function(c){ d.indiv[c] = (iv[c] || []).concat(d.indiv[c] || []); });
  m.undone = true; XT.grp = m.grp;
  xtSave(); xtLoadProg();
  plToast('↩ 「' + m.grp + '」 지난 트랙(' + ((m.prev && m.prev.label) || '') + ')으로 되돌렸습니다');
};
window.xt139UndoUpd = function(i){
  var A = XT.a139, u = A && A.upd[i]; if (!u || u.undone) return;
  var tr = xtD().tracks[u.grp]; if (!tr || !tr.exam){ plToast('트랙이 없습니다'); return; }
  tr.exam.from = u.old.from; tr.exam.to = u.old.to; tr.examManual = true;
  u.undone = true; xtSave();
};
window.xt139UndoAll = function(){
  var A = XT.a139; if (!A) return;
  var n = A.made.filter(function(m){ return !m.undone; }).length + A.upd.filter(function(u){ return !u.undone; }).length;
  if (!n) return;
  if (!confirm('자동으로 바꾼 트랙 ' + n + '개를 모두 되돌릴까요?\n(디데이는 학사일정 그대로 둡니다)')) return;
  var d = xtD();
  A.made.forEach(function(m){
    if (m.undone) return; var pi = xt139PastIdx(d, m.pid); if (pi < 0) return;
    var p = d.past.splice(pi, 1)[0], iv = p.indiv;
    ['grp', 'archivedAt', 'why', 'pid', 'indiv'].forEach(function(f){ delete p[f]; });
    p.skipNext = m.exam.label + '|' + m.exam.from; d.tracks[m.grp] = p;
    if (iv) Object.keys(iv).forEach(function(c){ d.indiv[c] = (iv[c] || []).concat(d.indiv[c] || []); });
    m.undone = true;
  });
  A.upd.forEach(function(u){ if (u.undone) return; var tr = d.tracks[u.grp]; if (!tr || !tr.exam) return; tr.exam.from = u.old.from; tr.exam.to = u.old.to; tr.examManual = true; u.undone = true; });
  xtSave(); xtLoadProg(); plToast('↩ 모두 되돌렸습니다');
};
window.xt139HideBanner = function(){ if (XT.a139) XT.a139.hide = true; render(); };

/* ── 공개: 트랙마다 🔒 비공개 / 👁 공개 ── */
window.xtIsPub = function(k){
  var tr = xtD().tracks[k];
  if (tr && typeof tr.pub === 'boolean') return tr.pub;
  var a = xtPubList(); return !a.length || a.indexOf(k) >= 0;
};
window.xtTogglePubTrack = function(k){
  var tr = xtD().tracks[k]; if (!tr){ plToast('먼저 트랙을 만들어 주세요'); return; }
  tr.pub = !xtIsPub(k);
  xtSave();
  if (tr.pub) plToast('👁 「' + k + '」 학생앱에 공개합니다' + (tr.items && tr.items.length ? '' : ' — 아직 교재가 없어 학생에겐 빈 화면입니다') + (xtD().publish === false ? ' (⚠ 맨 위 📱 전체가 비공개라 아직 안 보입니다)' : ''));
  else plToast('🔒 「' + k + '」 비공개로 바꿨습니다 — 학생앱에 안 보입니다');
};
window.xtPubOnly = function(k){ var d = xtD(); Object.keys(d.tracks).forEach(function(g){ if (d.tracks[g]) d.tracks[g].pub = (g === k); }); xtSave(); plToast('「' + k + '」만 학생앱에 공개합니다'); };
window.xtPubAll = function(){ var d = xtD(); Object.keys(d.tracks).forEach(function(g){ if (d.tracks[g]) d.tracks[g].pub = true; }); xtSave(); plToast('모든 학년 트랙을 공개합니다'); };

/* ── 트랙 지우기 (보관함으로) · 지난 트랙 교재 가져오기 ── */
window.xtDelTrack = function(){
  var k = XT.grp, d = xtD(), tr = d.tracks[k]; if (!tr) return;
  if (!confirm('「' + k + '」 트랙' + (tr.exam ? ' (' + tr.exam.label + ')' : '') + '을 지울까요?\n\n지운 트랙은 «지난 트랙» 보관함에 남고, 학생앱에서는 사라집니다.')) return;
  xt139Archive(d, k, 'delete');
  delete d.tracks[k];
  var ks = Object.keys(d.tracks).sort(); XT.grp = ks[0] || k;
  xtSave(); plToast('🗑 「' + k + '」 트랙을 지웠습니다 (지난 트랙 보관함에 있음)');
};
window.xt139PullItems = function(k){
  var d = xtD(), tr = d.tracks[k], p = xt139LastPast(d, k);
  if (!tr || !p || !(p.items || []).length){ plToast('가져올 지난 트랙 교재가 없습니다'); return; }
  if (tr.items.length && !confirm('지금 트랙에 교재 ' + tr.items.length + '권이 있습니다. 지난 트랙 교재를 뒤에 붙일까요?')) return;
  var have = {}; tr.items.forEach(function(it){ have[String(it.id)] = 1; });
  var add = xt139CopyItems(p.items).filter(function(it){ return !have[String(it.id)]; });
  tr.items = tr.items.concat(add);
  xtSave(); xtLoadProg();
  plToast('📥 지난 트랙(' + ((p.exam && p.exam.label) || '') + ') 교재 ' + add.length + '권을 가져왔습니다 — 시험범위(p)는 새로 정해 주세요');
};

/* ── ＋ 시험 트랙 만들기 · ✏️ 시험 고치기 (한 창) ── */
function xt139CalChoices(k, mode){
  var today = xt139Today(), ex = xt139Exams(XT.cal, k);
  if (mode === 'edit') return ex;
  return ex.filter(function(e){ return (e.to || e.from) >= today; });
}
window.xtNewTrack = function(){ xt139MkOpen('new', XT.grp || ''); };
window.xt139MkOpen = function(mode, k){
  var grps = xtGroups(), T0 = xtD().tracks;
  if (mode === 'new'){
    /* 지금 학년: 트랙이 없거나 시험이 끝났으면 그대로 · 아니면 트랙 없는 첫 학년 */
    var t0 = k && T0[k], done = t0 && t0.exam && (t0.exam.to || t0.exam.from) < xt139Today();
    if (!k || (t0 && !done)){
      var free = grps.filter(function(g){ return !T0[g] && !xt139IsElem(g); });
      k = free[0] || k || grps[0] || '';
    }
  }
  var tr = T0[k];
  XT.mk = { mode: mode, grp: k, pick: '', label: '', from: '', to: '', copy: false };
  if (mode === 'edit' && tr && tr.exam){ XT.mk.label = tr.exam.label; XT.mk.from = tr.exam.from; XT.mk.to = tr.exam.to || tr.exam.from; }
  xt139MkDefault();
  render();
};
function xt139MkDefault(){
  var m = XT.mk; if (!m) return;
  var ch = xt139CalChoices(m.grp, m.mode), tr = xtD().tracks[m.grp];
  m.pick = 'manual';
  if (m.mode === 'edit' && tr && tr.exam){
    for (var i = 0; i < ch.length; i++) if (ch[i].label === tr.exam.label && ch[i].from === tr.exam.from && !tr.examManual){ m.pick = 'cal:' + i; break; }
  } else if (ch.length){
    var cur = tr && tr.exam, i0 = 0;
    if (cur) for (var j = 0; j < ch.length; j++){ if (!(ch[j].label === cur.label && ch[j].from === cur.from)){ i0 = j; break; } }
    m.pick = 'cal:' + i0;
  }
  if (m.mode === 'new'){ var src = xt139CopySrc(m.grp); m.copy = !!src && !!(tr && tr.exam && tr.exam.to && tr.exam.to < xt139Today()); }
}
function xt139CopySrc(k){
  var d = xtD(), tr = d.tracks[k];
  if (tr && tr.items && tr.items.length) return { label: (tr.exam && tr.exam.label) || '지금 트랙', items: tr.items };
  var p = xt139LastPast(d, k);
  if (p && p.items && p.items.length) return { label: (p.exam && p.exam.label) || '지난 트랙', items: p.items };
  return null;
}
window.xt139MkSet = function(f, v){
  var m = XT.mk; if (!m) return;
  m[f] = v;
  if (f === 'grp'){ m.label = ''; m.from = ''; m.to = ''; xt139MkDefault(); }
  if (f === 'copy') m.copy = !!v;
  render();
};
window.xt139MkClose = function(){ XT.mk = null; render(); };
function xt139MkExam(){
  var m = XT.mk; if (!m) return null;
  if (m.pick && m.pick.indexOf('cal:') === 0){
    var e = xt139CalChoices(m.grp, m.mode)[Number(m.pick.slice(4))];
    return e ? { label: e.label, from: e.from, to: e.to || e.from, cal: true } : null;
  }
  var lb = String(m.label || '').trim(), f = String(m.from || '').trim(), t = String(m.to || '').trim() || f;
  if (!lb || !/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || t < f) return null;
  return { label: lb, from: f, to: t, cal: false };
}
window.xt139MkOk = function(){
  var m = XT.mk; if (!m) return;
  var k = String(m.grp || '').trim(); if (!k){ plToast('학교·학년을 골라 주세요'); return; }
  var ex = xt139MkExam();
  if (!ex){ plToast('시험을 고르거나, 이름과 날짜(시작 ≤ 끝)를 넣어 주세요'); return; }
  var d = xtD(), tr = d.tracks[k], exam = { label: ex.label, from: ex.from, to: ex.to };
  if (m.mode === 'edit'){
    if (!tr){ plToast('트랙이 없습니다'); return; }
    tr.exam = exam;
    if (ex.cal) delete tr.examManual; else tr.examManual = true;
    delete tr.skipNext;
    XT.mk = null; xtSave();
    plToast('✏️ 「' + k + '」 시험을 ' + exam.label + ' (' + xt139Range(exam) + ')로 고쳤습니다');
    return;
  }
  var src = m.copy ? xt139CopySrc(k) : null;
  if (tr && !confirm('「' + k + '」에는 벌써 트랙이 있습니다' + (tr.exam ? ' (' + tr.exam.label + ' · 교재 ' + tr.items.length + '권)' : '') + '.\n\n지금 트랙은 «지난 트랙» 보관함으로 옮기고 새 트랙을 만들까요?')) return;
  var items = src ? xt139CopyItems(src.items) : [];
  var pid = tr ? xt139Archive(d, k, 'new') : null;
  var nt = { school: (tr && tr.school) || xtSchoolOfKey(k), exam: exam, items: items, pub: false, created: new Date().toISOString(), by: 'teacher' };
  if (pid) nt.from = pid;
  if (!ex.cal) nt.examManual = true;
  d.tracks[k] = nt;
  XT.grp = k; XT.mk = null; XT.view = XT.view === 'school' ? 'grp' : XT.view;
  xtSave(); xtLoadProg();
  plToast('＋ 「' + k + '」 ' + exam.label + ' 트랙을 만들었습니다 (🔒 비공개' + (items.length ? ' · 교재 ' + items.length + '권 가져옴' : '') + ')');
};
function xt139ModalHTML(){
  var m = XT.mk; if (!m) return '';
  var grps = xtGroups(), d = xtD(), tr = d.tracks[m.grp], edit = m.mode === 'edit';
  var ch = xt139CalChoices(m.grp, m.mode), elem = m.grp && xt139IsElem(m.grp);
  var B = 'border:none;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;padding:9px 16px';
  var IN = 'padding:7px 9px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;min-width:0';
  var h = '<div id="xt139-modal" onclick="if(event.target===this)xt139MkClose()" style="position:fixed;inset:0;background:rgba(13,34,64,.45);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:56px 16px;overflow:auto;box-sizing:border-box">'
    + '<div style="background:#fff;border-radius:15px;max-width:540px;width:100%;padding:18px 20px;box-shadow:0 18px 50px rgba(13,34,64,.3);box-sizing:border-box">'
    + '<div style="display:flex;align-items:center;margin-bottom:12px"><span style="font-size:16px;font-weight:900;color:#0d2240">' + (edit ? '✏️ 시험 고치기 — ' + esc2(m.grp) : '＋ 시험 트랙 만들기') + '</span>'
    + '<button onclick="xt139MkClose()" style="margin-left:auto;border:none;background:none;color:#94a3b8;font-size:16px;font-weight:900;cursor:pointer">✕</button></div>';
  if (!edit){
    h += '<div style="font-size:11.5px;font-weight:900;color:#64748b;margin-bottom:5px">① 학교·학년</div>'
      + '<select id="xt139-grp" onchange="xt139MkSet(\'grp\',this.value)" style="' + IN + ';width:100%;margin-bottom:6px">';
    if (!m.grp) h += '<option value="">— 고르세요 —</option>';
    grps.forEach(function(g){
      var n = activeStudents().filter(function(s){ return xtKeyOf(s) === g; }).length, t = d.tracks[g];
      h += '<option value="' + esc2(g) + '"' + (g === m.grp ? ' selected' : '') + '>' + esc2(g) + ' · ' + n + '명' + (t ? (' · 지금 트랙: ' + ((t.exam && t.exam.label) || '시험 미정')) : '') + '</option>';
    });
    h += '</select>';
    if (tr) h += '<div style="font-size:11px;color:#b45309;font-weight:700;background:#fffbeb;border-radius:8px;padding:6px 9px;margin-bottom:8px">지금 트랙(' + esc2((tr.exam && tr.exam.label) || '시험 미정') + ' · 교재 ' + tr.items.length + '권)은 «지난 트랙» 보관함으로 옮기고 새로 만듭니다.</div>';
  }
  h += '<div style="font-size:11.5px;font-weight:900;color:#64748b;margin:8px 0 5px">' + (edit ? '' : '② ') + '어느 시험을 대비하나요?</div>';
  if (elem) h += '<div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:6px">초등학교는 학사일정에 시험이 없어 직접 넣습니다.</div>';
  else if (!ch.length) h += '<div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:6px">학사일정에 ' + (edit ? '' : '다가오는 ') + '시험이 없습니다 — 직접 넣어 주세요.</div>';
  ch.forEach(function(e, i){
    var v = 'cal:' + i, on = m.pick === v, dn = xtDday(e.from);
    h += '<label class="xt139-ex" data-v="' + v + '" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;margin-bottom:4px;cursor:pointer;border:1.5px solid ' + (on ? '#1d6fe8' : '#e6ebf3') + ';background:' + (on ? '#eef4fd' : '#fff') + '">'
      + '<input type="radio" name="xt139-ex" ' + (on ? 'checked ' : '') + 'onchange="xt139MkSet(\'pick\',\'' + v + '\')">'
      + '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:900;color:#0d2240">🏫 ' + esc2(e.label) + ' <span style="font-weight:700;color:#64748b">' + esc2(xt139Range(e)) + '</span></span>'
      + '<span style="font-size:11px;font-weight:900;color:' + (dn != null && dn >= 0 && dn <= 14 ? '#dc2626' : '#94a3b8') + '">' + (dn == null ? '' : (dn < 0 ? '지남' : 'D-' + dn)) + '</span></label>';
  });
  var man = m.pick === 'manual';
  h += '<label class="xt139-ex" data-v="manual" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;margin-bottom:4px;cursor:pointer;border:1.5px solid ' + (man ? '#1d6fe8' : '#e6ebf3') + ';background:' + (man ? '#eef4fd' : '#fff') + '">'
    + '<input type="radio" name="xt139-ex" ' + (man ? 'checked ' : '') + 'onchange="xt139MkSet(\'pick\',\'manual\')">'
    + '<span style="font-size:12.5px;font-weight:900;color:#0d2240">✍️ 직접 입력</span></label>';
  if (man){
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 8px 26px">'
      + '<input id="xt139-label" value="' + esc2(m.label) + '" oninput="XT.mk.label=this.value" placeholder="시험 이름 (예 2학기 기말)" style="' + IN + ';flex:1 1 150px">'
      + '<input id="xt139-from" type="date" value="' + esc2(m.from) + '" oninput="XT.mk.from=this.value" style="' + IN + '">'
      + '<span style="font-size:11px;color:#94a3b8;font-weight:800">~</span>'
      + '<input id="xt139-to" type="date" value="' + esc2(m.to) + '" oninput="XT.mk.to=this.value" style="' + IN + '"></div>';
  }
  if (!edit){
    var src = xt139CopySrc(m.grp);
    h += '<div style="font-size:11.5px;font-weight:900;color:#64748b;margin:10px 0 5px">③ 교재</div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:' + (src ? '#0d2240' : '#cbd5e1') + ';cursor:' + (src ? 'pointer' : 'default') + '">'
      + '<input id="xt139-copy" type="checkbox" ' + (m.copy && src ? 'checked ' : '') + (src ? '' : 'disabled ') + 'onchange="xt139MkSet(\'copy\',this.checked)">'
      + '지난 트랙 교재 그대로 가져오기' + (src ? ' <span style="color:#64748b;font-weight:700">(' + esc2(src.label) + ' · ' + src.items.length + '권 · 시험범위 p는 비움)</span>' : ' <span style="font-weight:700">(가져올 교재 없음)</span>') + '</label>'
      + '<div style="font-size:11px;color:#0f8a4e;font-weight:800;background:#f0fdf6;border-radius:8px;padding:7px 10px;margin-top:10px">🔒 새 트랙은 <b>비공개</b>로 시작합니다 — 교재를 넣은 뒤 「👁 공개」를 눌러야 학생앱에 보입니다.</div>';
  } else {
    h += '<div style="font-size:11px;color:#64748b;font-weight:700;margin-top:8px">학사일정 시험을 고르면 학교가 날짜를 바꿀 때 저절로 따라갑니다. 직접 넣은 날짜는 그대로 둡니다.</div>';
  }
  h += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'
    + '<button onclick="xt139MkClose()" style="' + B + ';background:#f1f5f9;color:#64748b">취소</button>'
    + '<button id="xt139-mk-ok" onclick="xt139MkOk()" style="' + B + ';background:#1d6fe8;color:#fff">' + (edit ? '고치기' : '만들기') + '</button></div>';
  return h + '</div></div>';
}

/* ── 화면: 자동으로 한 일 띠 · 트랙 상자(시험·공개·고치기·지우기) ── */
function xt139BannerHTML(){
  var A = XT.a139; if (!A || A.hide) return '';
  var dd = A.dd || { add: [], del: [] };
  if (!A.made.length && !A.upd.length && !dd.add.length && !dd.del.length) return '';
  var BT = 'border:none;border-radius:7px;font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit;padding:4px 10px;flex:none';
  var h = '<div id="xt139-banner" style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:12px;padding:11px 14px;margin-bottom:12px">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><span style="font-size:13px;font-weight:900;color:#92400e">🗓 학사일정을 보고 자동으로 정리했어요</span>';
  var left = A.made.filter(function(m){ return !m.undone; }).length + A.upd.filter(function(u){ return !u.undone; }).length;
  if (left > 1) h += '<button id="xt139-undo-all" onclick="xt139UndoAll()" style="' + BT + ';background:#fff;color:#92400e;border:1px solid #fcd34d">↩ 모두 되돌리기</button>';
  h += '<button onclick="xt139HideBanner()" title="닫기" style="margin-left:auto;border:none;background:none;color:#b45309;font-weight:900;cursor:pointer;font-size:13px">✕</button></div>';
  A.made.forEach(function(m, i){
    h += '<div class="xt139-made" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:700;color:#78350f;padding:3px 0">'
      + '<span style="flex:1;min-width:220px">' + (m.undone ? '<s>' : '') + '🆕 <b>' + esc2(m.grp) + '</b> — <b>' + esc2(m.exam.label) + '</b> (' + esc2(xt139Range(m.exam)) + ') 새 트랙 · 🔒 비공개'
      + ' <span style="color:#a16207">· 지난 트랙 ' + esc2((m.prev && m.prev.label) || '') + (m.n ? ' (교재 ' + m.n + '권)' : '') + '는 보관</span>' + (m.undone ? '</s> <b style="color:#64748b">되돌렸어요</b>' : '') + '</span>'
      + (m.undone ? '' : '<button onclick="xtGoGrp(\'' + esc2(m.grp).replace(/'/g, '') + '\')" style="' + BT + ';background:#fff;color:#1d6fe8;border:1px solid #bfdbfe">열기</button>'
        + '<button class="xt139-undo" onclick="xt139Undo(' + i + ')" style="' + BT + ';background:#f59e0b;color:#fff">↩ 되돌리기</button>')
      + '</div>';
  });
  A.upd.forEach(function(u, i){
    h += '<div class="xt139-upd" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:700;color:#78350f;padding:3px 0">'
      + '<span style="flex:1;min-width:220px">' + (u.undone ? '<s>' : '') + '✏️ <b>' + esc2(u.grp) + '</b> — ' + esc2(u.label) + ' 날짜가 바뀌었어요: ' + esc2(xt139Range(u.old)) + ' → <b>' + esc2(xt139Range(u.now)) + '</b>' + (u.undone ? '</s> <b style="color:#64748b">되돌렸어요</b>' : '') + '</span>'
      + (u.undone ? '' : '<button class="xt139-undo-upd" onclick="xt139UndoUpd(' + i + ')" style="' + BT + ';background:#f59e0b;color:#fff">↩ 되돌리기</button>')
      + '</div>';
  });
  var nm = function(x){ return esc2(x.school) + ' ' + esc2(xt139CleanLabel(x.label)) + (x.grades && x.grades.length ? '(' + esc2(x.grades.join('·')) + '학년)' : '') + ' ' + esc2(xt139Md(x.date)); };
  if (dd.add.length) h += '<div class="xt139-dd" style="font-size:11.5px;font-weight:700;color:#78350f;padding:3px 0">📅 디데이 새로: ' + dd.add.map(nm).join(' · ') + '</div>';
  if (dd.del.length) h += '<div class="xt139-dd" style="font-size:11.5px;font-weight:700;color:#a16207;padding:3px 0">🧹 끝난 시험 디데이 지움: ' + dd.del.map(nm).join(' · ') + '</div>';
  if (A.made.some(function(m){ return !m.undone; })) h += '<div style="font-size:11px;font-weight:800;color:#0f8a4e;margin-top:4px">💡 새 트랙은 학생에게 아직 안 보여요 — 교재를 넣고(「📥 지난 트랙 교재 가져오기」도 있어요) 「👁 공개」를 눌러 주세요.</div>';
  return h + '</div>';
}
function xt139BoxHTML(k, tr){
  var d = xtD(), ex = tr.exam, pub = xtIsPub(k), q = esc2(k).replace(/'/g, '');
  var dn = ex && ex.from ? xtDday(ex.from) : null, endd = ex && (ex.to || ex.from), over = endd && endd < xt139Today();
  var onlyMe = Object.keys(d.tracks).filter(function(g){ return d.tracks[g] && d.tracks[g].pub; }).join() === k;
  var B = 'border-radius:8px;padding:6px 9px;font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit';
  var h = '<div class="xt139-box" style="margin-top:9px;padding-top:9px;border-top:1px dashed #e6ebf3">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:11px;font-weight:900;color:#0d2240">📝 시험</span>'
    + '<span id="xt139-exam" style="margin-left:auto;font-size:10.5px;font-weight:900;color:' + (ex ? (over ? '#94a3b8' : '#1d6fe8') : '#b45309') + ';text-align:right">'
    + (ex ? esc2(ex.label) + ' · ' + esc2(xt139Range(ex)) + (over ? ' · 끝' : (dn != null ? ' · D-' + dn : '')) : '시험 미정') + '</span></div>';
  if (tr.examManual) h += '<div style="font-size:9.5px;color:#94a3b8;font-weight:700;margin:-3px 0 5px;text-align:right">✍️ 직접 넣은 날짜 — 학사일정이 덮지 않음</div>';
  if (tr.skipNext) h += '<div style="font-size:9.5px;color:#94a3b8;font-weight:700;margin:-3px 0 5px;text-align:right">↩ 되돌린 트랙 — 다음 시험 트랙은 직접 만드세요</div>';
  h += '<div style="display:flex;gap:5px;margin-bottom:9px">'
    + '<button id="xt139-edit" onclick="xt139MkOpen(\'edit\',\'' + q + '\')" style="flex:1;' + B + ';border:1px solid #e2e8f0;background:#fff;color:#0d2240">✏️ 시험 고치기</button>'
    + '<button id="xt139-del" onclick="xtDelTrack()" style="' + B + ';border:1px solid #fecaca;background:#fff;color:#dc2626">🗑 트랙 지우기</button></div>';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
    + '<span style="font-size:11px;font-weight:900;color:#0d2240">📱 학생앱</span>'
    + '<span style="margin-left:auto;font-size:10px;font-weight:800;color:' + (pub ? '#0f8a4e' : '#94a3b8') + '">' + (pub ? (d.publish === false ? '공개(전체 비공개 중)' : '보이는 중') : '숨김') + '</span></div>'
    + '<div style="display:flex;gap:5px;flex-wrap:wrap">'
    + '<button id="xt139-pub" data-pub="' + (pub ? '1' : '0') + '" onclick="xtTogglePubTrack(\'' + q + '\')" title="' + (pub ? '누르면 비공개로 바꿉니다' : '누르면 이 트랙을 학생앱에 공개합니다') + '" style="flex:1;border:none;' + B.replace('padding:6px 9px', 'padding:7px 0') + ';background:' + (pub ? '#22c55e' : '#64748b') + ';color:#fff">' + (pub ? '👁 공개' : '🔒 비공개') + '</button>'
    + '<button onclick="xtPubOnly(\'' + q + '\')" title="이 학년만 남기고 나머지는 숨깁니다" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;' + B + '">' + (onlyMe ? '✓ 이 학년만' : '이 학년만') + '</button>'
    + '<button onclick="xtPubAll()" title="모든 학년 트랙을 공개합니다" style="border:1px solid #e2e8f0;background:#fff;color:#64748b;' + B + '">전체</button>'
    + '</div>';
  var p = xt139LastPast(d, k);
  if (!tr.items.length && p && (p.items || []).length)
    h += '<button id="xt139-pull" onclick="xt139PullItems(\'' + q + '\')" style="margin-top:7px;width:100%;border:1px dashed #93c5fd;background:#eff6ff;color:#1d4ed8;' + B + '">📥 지난 트랙 교재 가져오기 (' + esc2((p.exam && p.exam.label) || '') + ' · ' + p.items.length + '권)</button>';
  return h + '</div>';
}
rExamTrack = (function(orig){
  return function(){
    var h = orig();
    var d = xtD(), tr = d.tracks[XT.grp];
    /* 머리 바로 아래 띠 */
    var hi = h.indexOf('🔄</button></div></div>');
    var ban = xt139BannerHTML();
    if (hi >= 0 && ban){ hi += '🔄</button></div></div>'.length; h = h.slice(0, hi) + ban + h.slice(hi); }
    /* 「+ 트랙」 → 「＋ 시험 트랙 만들기」 */
    h = h.replace(/<button onclick="xtNewTrack\(\)"[^>]*>\+ 트랙<\/button>/, '<button id="xt139-new" onclick="xtNewTrack()" style="flex-basis:100%;margin-top:4px;padding:8px 0;border:1.5px dashed #1d6fe8;border-radius:10px;background:#eef4fd;color:#1d6fe8;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit">＋ 시험 트랙 만들기</button>');
    h = h.replace(/<button onclick="xtNewTrack\(\)"([^>]*)>\+ 트랙 만들기<\/button>/, '<button id="xt139-new" onclick="xtNewTrack()"$1>＋ 시험 트랙 만들기</button>');
    h = h.replace('「+ 트랙」으로 시작하세요', '「＋ 시험 트랙 만들기」로 시작하세요').replace('「+ 트랙 만들기」로 시작합니다', '「＋ 시험 트랙 만들기」로 시작합니다');
    /* 트랙 상자의 옛 «📱 학생앱 공개» 칸 → 시험·공개·고치기·지우기 */
    if (tr){
      var mk = h.indexOf('📱 학생앱 공개</span>');
      var st = mk >= 0 ? h.lastIndexOf('<div style="margin-top:9px;padding-top:9px;border-top:1px dashed #e6ebf3">', mk) : -1;
      var en = st >= 0 ? h.indexOf('<button onclick="xtSetView(\'assign\')" style="margin-top:9px;width:100%', st) : -1;
      if (st >= 0 && en > st) h = h.slice(0, st) + xt139BoxHTML(XT.grp, tr) + h.slice(en);
      /* 🛤 트랙 배정 화면 머리: 시험 · 공개 단추 */
      var tt = '>🛤 ' + esc2(XT.grp) + '</span>';
      var ti = h.indexOf(tt);
      if (ti >= 0 && XT.view === 'assign'){
        var pub = xtIsPub(XT.grp), q = esc2(XT.grp).replace(/'/g, '');
        var chip = (tr.exam ? '<span style="font-size:12px;font-weight:900;color:#64748b">📝 ' + esc2(tr.exam.label) + ' · ' + esc2(xt139Range(tr.exam)) + '</span>' : '')
          + '<button id="xt139-pub2" onclick="xtTogglePubTrack(\'' + q + '\')" style="border:none;border-radius:50px;padding:5px 13px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit;background:' + (pub ? '#22c55e' : '#64748b') + ';color:#fff">' + (pub ? '👁 공개' : '🔒 비공개') + '</button>'
          + '<button onclick="xt139MkOpen(\'edit\',\'' + q + '\')" style="border:1px solid #e2e8f0;background:#fff;border-radius:50px;padding:5px 12px;font-size:11.5px;font-weight:800;color:#0d2240;cursor:pointer;font-family:inherit">✏️ 시험 고치기</button>';
        ti += tt.length; h = h.slice(0, ti) + chip + h.slice(ti);
      }
    }
    return h + xt139ModalHTML();
  };
})(rExamTrack);
