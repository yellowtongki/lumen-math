/* ═══════════════════════════════════════════════════════════════
 * v19-66: 📅 플래너 «날짜 필수 · 같은 쪽 다시 내기 = 그날 0점» (원장 결정 2026-09-30 「다 진행 · 그날 0점 · 경고 3일」)
 *   [사고] 날짜를 안 쓴 채 같은 쪽을 9/15·9/18 두 번 낸 학생이 있었다 — AI도 사람도 잡기 어려웠다.
 *   [규칙] 10/1부터 두 장 모두 맨 위에 날짜. AI가 읽은 날짜가 제출한 날(또는 새벽 제출이면 전날)과 맞아야 그날 것으로 인정.
 *     · 날짜 없음(noDate) · 다른 날짜(wrongDate) · 최근 14일 안 다른 세트와 글(전사)이 80% 이상 같거나 사진 지문이 거의 같음(dup) → 그날 0점
 *     · 10/1~10/3 은 경고만(zeroWarn — 점수는 그대로, 카드에 노란 띠) · 10/4부터 0점(zeroDay — 네 점수 칸 0, 제출 점수도 0)
 *     · 원장이 「다른 날 맞음 — 점수 되살리기」를 누르면 원래 점수로 돌아간다(zeroCleared). 손으로 넣은 점수(plManual)는 늘 우선.
 *   [어디서] 학원앱 analyzePlannerPhotos 직후(plzCheck, 사진 지문까지) · 새벽 채점기(글 비교만) · 승인 카드 띠 · 위험 신호 · 학생앱 발행(flags)
 *   ※ 문자열 연결만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════ */
var PLZ = { FROM: '2026-10-01', ZERO_FROM: '2026-10-04', DUP_DAYS: 14, TEXT_SIM: 0.8, HASH_DIST: 8 };
function plzSetDay(setId){ var s = String(setId || ''); return /^\d{8}/.test(s) ? (s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)) : ''; }
function plzAdd(iso, n){ var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function plzKey(s){ var m = String(s || '').match(/(\d{4})[.\-\/]?(\d{2})[.\-\/]?(\d{2})/); return m ? (m[1] + '-' + m[2] + '-' + m[3]) : ''; }
/* 전사 글자 정규화 — 체크 표시·공백·구두점을 빼고 이어 붙인다 */
function plzNorm(arr){
  return (Array.isArray(arr) ? arr : []).map(function(l){ return String(l || '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/[\s\[\]()·.,:\-~_\/|]/g, '').toLowerCase(); }).filter(function(s){ return s.length >= 2; });
}
function plzGrams(s){ var g = {}, i; for (i = 0; i < s.length - 1; i++){ var k = s.slice(i, i + 2); g[k] = (g[k] || 0) + 1; } return g; }
function plzDice(a, b){
  var ga = plzGrams(a), gb = plzGrams(b), inter = 0, na = 0, nb = 0, k;
  for (k in ga){ na += ga[k]; if (gb[k]) inter += Math.min(ga[k], gb[k]); }
  for (k in gb) nb += gb[k];
  return (na + nb) ? (2 * inter / (na + nb)) : 0;
}
/* 두 전사가 같은 쪽인가 — 2-gram 유사도 (0~1) */
window.plzTextSim = function(a, b){ var A = plzNorm(a).join('|'), B = plzNorm(b).join('|'); if (A.length < 8 || B.length < 8) return 0; return plzDice(A, B); };
/* 사진 지문 dHash (9×8 → 64비트 16진수) — 다시 찍어도 같은 쪽이면 거의 같다 */
window.plzImgHash = function(b64, mime){
  return new Promise(function(res){
    try {
      var img = new Image();
      img.onload = function(){
        try {
          var cv = document.createElement('canvas'); cv.width = 9; cv.height = 8;
          var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 9, 8);
          var d = cx.getImageData(0, 0, 9, 8).data, g = [], i;
          for (i = 0; i < 72; i++) g.push((d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000);
          var bits = '', x, y; for (y = 0; y < 8; y++) for (x = 0; x < 8; x++) bits += (g[y * 9 + x] < g[y * 9 + x + 1]) ? '1' : '0';
          var hex = ''; for (i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
          res(hex);
        } catch(e){ res(''); }
      };
      img.onerror = function(){ res(''); };
      img.src = 'data:' + (mime || 'image/jpeg') + ';base64,' + b64;
    } catch(e){ res(''); }
  });
};
window.plzHamming = function(a, b){ if (!a || !b || a.length !== b.length) return 99; var n = 0, i; for (i = 0; i < a.length; i++){ var x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x){ n += x & 1; x >>= 1; } } return n; };
/* 날짜 판정 — 페이지 날짜가 세트 날짜(제출한 날) 또는 그 전날(새벽 제출)이어야 한다 */
window.plzDateVerdict = function(analysis, setId){
  var sd = plzSetDay(setId); if (!sd) return '';
  var pd = plzKey(analysis && analysis.date);
  if (!pd) return 'noDate';
  if (pd === sd || pd === plzAdd(sd, -1)) return '';
  return pd > sd ? 'future' : 'late';   /* v19-68: 과거 날짜 = 지각 제출(0점 아님 · 적힌 날짜로 지각 점수) · 미래 = 확인 필요 */
};
/* v19-68: 같은 날짜를 «다른 날» 또 냄 — 거짓 제출. 같은 날 다시 올린 것(사진 다시 찍음)은 제외.
 *   다른 세트의 분석 날짜가 같거나, 분석이 없는(9월 유령) 세트의 제출 날이 같으면 맞음. 반환 { setId, day } */
window.plzSameDateOf = function(st, analysis, setId){
  var pd = plzKey(analysis && analysis.date); var sd = plzSetDay(setId); if (!pd || !sd || (analysis && analysis.dateGuess)) return null;
  var hit = null;
  ((st && st.lumen_planner_photos) || []).forEach(function(p){
    if (!p || !p.setId || p.setId === setId) return;
    var d = plzSetDay(p.setId); if (!d || d >= sd) return;   /* 먼저 낸 세트만 본다 (같은 날 다시 올린 것 · 나중 세트는 제외) */
    var a = p.analysis, od = a ? (a.dateGuess ? '' : plzKey(a.date)) : d;
    if (od === pd && (!hit || p.setId < hit.setId)) hit = { setId: p.setId, day: d };
  });
  return hit;
};
window.plzDaysBetween = function(a, b){ return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); };
/* 같은 쪽 다시 내기 — 최근 14일 안 다른 세트와 글·사진 비교. 맞으면 { setId, day, sim, hd } */
window.plzDupOf = function(st, analysis, setId){
  var sd = plzSetDay(setId); if (!sd || !analysis) return null;
  var from = plzAdd(sd, -PLZ.DUP_DAYS), best = null;
  ((st && st.lumen_planner_photos) || []).forEach(function(p){
    if (!p || !p.setId || p.setId === setId || !p.analysis) return;
    var d = plzSetDay(p.setId); if (!d || d < from || d >= sd) return;
    var a = p.analysis;
    var sim = plzTextSim(analysis.tasksTranscript, a.tasksTranscript);
    var hd = (analysis.imgHash && a.imgHash && analysis.imgHash[0] && a.imgHash[0]) ? plzHamming(analysis.imgHash[0], a.imgHash[0]) : 99;
    var hit = (sim >= PLZ.TEXT_SIM) || (hd <= PLZ.HASH_DIST);
    if (hit && (!best || d > best.day)) best = { setId: p.setId, day: d, sim: Math.round(sim * 100), hd: hd };
  });
  return best;
};
/* 본체 — 분석 직후 한 번. imgs = [{ b64, mime }] (브라우저에서만 · 채점기는 글 비교만) */
window.plzCheck = async function(st, analysis, setId, imgs){
  if (!analysis) return analysis;
  var sd = plzSetDay(setId); if (!sd || sd < PLZ.FROM) return analysis;
  try {
    if (imgs && imgs.length && !analysis.imgHash){ var hs = [], i; for (i = 0; i < Math.min(2, imgs.length); i++) hs.push(await plzImgHash(imgs[i].b64, imgs[i].mime)); analysis.imgHash = hs; }
  } catch(e){}
  var reason = plzDateVerdict(analysis, setId), dup = null;
  if (!reason && analysis.dateGuess) reason = 'noDate';   /* 이미 추정 날짜를 넣어 둔 분석을 다시 검사해도 «날짜 없음» 유지 */
  /* v19-68: 지각·미래 날짜는 0점 사유가 아니다 — 표시만 (지각 점수는 승인 때 calcPlannerScoreByPlannerDate 가 적힌 날짜로 계산) */
  analysis.dateFlag = ''; analysis.lateDays = 0;
  if (reason === 'late' || reason === 'future'){ analysis.dateFlag = reason; if (reason === 'late') analysis.lateDays = plzDaysBetween(plzKey(analysis.date), sd); reason = ''; }
  if (!reason){ var same = plzSameDateOf(st, analysis, setId); if (same){ reason = 'sameDate'; dup = same; } }
  if (!reason){ dup = plzDupOf(st, analysis, setId); if (dup) reason = 'dup'; }
  /* 날짜가 없으면 세트 날짜를 «추정 날짜»로 넣어 두어, 어느 날의 0점인지 승인·학생앱이 알 수 있게 한다 */
  if (reason === 'noDate' && !plzKey(analysis.date)){ analysis.date = sd.replace(/-/g, '.'); analysis.dateGuess = true; }
  analysis.zeroReason = reason || ''; analysis.zeroDup = dup || null; analysis.zeroWarn = false; analysis.zeroDay = false;
  if (analysis.zeroCleared) return analysis;
  if (reason){
    if (sd < PLZ.ZERO_FROM) analysis.zeroWarn = true;
    else {
      if (!analysis.zeroBak) analysis.zeroBak = { s: analysis.studyScore, p: analysis.practiceScore, sp: analysis.specificScore, f: analysis.feedbackScore };   /* 채점기가 이미 0으로 만든 것은 원점수 보존 */
      analysis.studyScore = '0'; analysis.practiceScore = '0'; analysis.specificScore = '0'; analysis.feedbackScore = '0';
      analysis.zeroDay = true;
    }
  }
  return analysis;
};
window.plzReasonKo = function(a){
  var r = a && a.zeroReason;
  if (r === 'noDate') return '날짜 없음';
  if (r === 'wrongDate') return '날짜가 다름 (' + String(a.date || '') + ')';
  if (r === 'sameDate'){ var sd2 = a.zeroDup || {}; return '같은 날짜 또 냄 (' + String(a.date || '') + ' 은 ' + (sd2.day ? (parseInt(sd2.day.slice(5, 7), 10) + '/' + parseInt(sd2.day.slice(8, 10), 10)) : '') + ' 제출분에 이미 있음)'; }
  if (r === 'dup'){ var d = a.zeroDup || {}; return '같은 플래너 다시 냄 (' + (d.day ? (parseInt(d.day.slice(5, 7), 10) + '/' + parseInt(d.day.slice(8, 10), 10)) : '') + ' 것과 같음' + (d.sim ? ' · 글 ' + d.sim + '%' : '') + (d.hd != null && d.hd <= PLZ.HASH_DIST ? ' · 사진 같음' : '') + ')'; }
  return '';
};
/* 총점에 적용 — 손 점수(plManual)가 있으면 그것이 우선(호출하는 쪽에서) */
window.plzApplyTotal = function(entry, total){ var a = entry && entry.analysis; return (a && a.zeroDay) ? 0 : total; };
/* 원장 되살리기 — 「다른 날 맞음」 */
window.plzClear = function(stId, setId){
  var st = (students || []).find(function(s){ return s && s.id === stId; }); if (!st) return;
  var p = (st.lumen_planner_photos || []).find(function(x){ return x && x.setId === setId; }); if (!p || !p.analysis) return;
  var a = p.analysis;
  if (a.zeroBak){ a.studyScore = a.zeroBak.s; a.practiceScore = a.zeroBak.p; a.specificScore = a.zeroBak.sp; a.feedbackScore = a.zeroBak.f; }
  a.zeroDay = false; a.zeroWarn = false; a.zeroCleared = true; a.zeroReason = ''; a.zeroDup = null;
  /* v19-67: 9월 소급 0점(pls9Apply)은 원점수(zeroBak.total)까지 되돌리고 점수표를 다시 올린다 */
  if (a.zeroSept && a.zeroBak && a.zeroBak.key){ a.zeroSept = false; if (a.zeroBak.total === null || a.zeroBak.total === undefined){ if (st.lumen_planner) delete st.lumen_planner[a.zeroBak.key]; } else if (typeof plSetScore === 'function') plSetScore(st, a.zeroBak.key, a.zeroBak.total, '9월 0점 되돌림'); try { if (typeof publishPlannerDataForStudent === 'function') publishPlannerDataForStudent(st); } catch(e){} }
  if (typeof saveStudents === 'function') saveStudents();
  if (typeof render === 'function') render();
};
/* 학생앱 발행용 { 'YYYY.MM.DD': 'noDate'|'sameDate'|'dup' } — 승인된 것만 */
window.plzFlags = function(st){
  var out = {};
  ((st && st.lumen_planner_photos) || []).forEach(function(p){
    var a = p && p.analysis; if (!a || !a.zeroDay || !p.reviewed) return;
    var d = plzKey(a.date) || plzSetDay(p.setId); if (d) out[d.replace(/-/g, '.')] = a.zeroReason;
  });
  return out;
};
/* 승인 카드에 붙는 띠 (같은 쪽이면 그때 사진도 작게) */
window.plzCardHtml = function(a, stId, setId){
  if (!a || !(a.zeroReason || a.zeroWarn || a.zeroCleared || a.dateFlag)) return '';
  var esc = function(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var h = '';
  /* v19-68: 지각·미래 날짜 안내 (0점 아님) */
  if (a.dateFlag === 'late') h += '<div style="margin:2px 0 6px;padding:7px 10px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;font-size:11px;font-weight:800;color:#1e40af">⏰ 지각 제출 — 플래너 날짜 ' + esc(a.date) + ' · ' + a.lateDays + '일 늦게 냄 → 적힌 날짜로 들어가고 제출 점수는 1점 (마감: 다음날 새벽 3시)</div>';
  if (a.dateFlag === 'future') h += '<div style="margin:2px 0 6px;padding:7px 10px;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;font-size:11px;font-weight:800;color:#9a3412">📅 아직 오지 않은 날짜(' + esc(a.date) + ')가 적혀 있어요 — 사진을 보고 날짜를 고쳐 승인하세요</div>';
  if (!(a.zeroReason || a.zeroWarn || a.zeroCleared)) return h;
  if (a.zeroCleared) return '<div style="margin:2px 0 8px;padding:7px 10px;background:#f1f5f9;border-radius:8px;font-size:11px;font-weight:700;color:#475569">↩ 원장님이 되살린 세트 (날짜·중복 검사 통과로 봄)</div>';
  var why = plzReasonKo(a);
  if (a.zeroDay){
    h += '<div style="margin:2px 0 8px;padding:9px 11px;background:#fee2e2;border:1.5px solid #fca5a5;border-radius:9px">'
      + '<div style="font-size:12px;font-weight:900;color:#b91c1c">⛔ 그날 0점 — ' + esc(why) + '</div>'
      + '<div style="font-size:10.5px;color:#7f1d1d;font-weight:700;margin-top:3px;line-height:1.6">' + (a.dateGuess ? '날짜 칸이 비어 있어 제출한 날(' + esc(a.date) + ')로 적어 두었습니다. ' : '') + '규칙: 10/4부터 날짜 없음·같은 날짜 또 내기·같은 쪽 다시 내기는 그날 0점(플래너 점수 포함). 지난 날짜를 늦게 낸 것은 0점이 아니라 지각입니다. 잘못 잡혔으면 아래 단추로 되살리세요.</div>'
      + '<button onclick="plzClear(\'' + stId + '\',\'' + setId + '\')" style="margin-top:7px;border:1px solid #b91c1c;background:#fff;color:#b91c1c;border-radius:7px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit">↩ 다른 날 맞음 — 점수 되살리기</button>';
  } else if (a.zeroWarn){
    h += '<div style="margin:2px 0 8px;padding:9px 11px;background:#fef9c3;border:1.5px solid #fde68a;border-radius:9px">'
      + '<div style="font-size:12px;font-weight:900;color:#92400e">⚠️ 경고 기간(10/1~10/3) — ' + esc(why) + '</div>'
      + '<div style="font-size:10.5px;color:#78350f;font-weight:700;margin-top:3px">이번엔 점수를 주지만 10/4부터는 그날 0점입니다. 학생에게 날짜를 쓰라고 알려 주세요.</div>';
  }
  if ((a.zeroReason === 'dup' || a.zeroReason === 'sameDate') && a.zeroDup && a.zeroDup.setId){
    try {
      var st = (students || []).find(function(s){ return s && s.id === stId; });
      var p2 = st && (st.lumen_planner_photos || []).find(function(x){ return x && x.setId === a.zeroDup.setId; });
      var urls = (p2 && p2.urls) || [];
      if (urls.length){ h += '<div style="display:flex;gap:6px;align-items:center;margin-top:7px"><span style="font-size:10px;font-weight:800;color:#64748b">' + (a.zeroReason === 'sameDate' ? '먼저 낸 ' : '같다고 본 ') + ''  + esc(a.zeroDup.day.slice(5).replace('-', '/')) + ' 사진</span>' + urls.slice(0, 2).map(function(u){ return '<a href="' + esc(u) + '" target="_blank"><img src="' + esc(u) + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #fca5a5"></a>'; }).join('') + '</div>'; }
    } catch(e){}
  }
  return h ? (h + '</div>') : '';
};
