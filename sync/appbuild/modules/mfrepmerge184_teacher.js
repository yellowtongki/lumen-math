/* ═══════════════════════════════════════════════════════════════════
 * v19-184: 📑 월간보고서 한 화면 + 루멘 학부모앱 공개 (원장 2026-11-10 「학부모앱에서도 월간보고서가 보이는 방식 · 두 가지를 통합」
 *   → 「추천대로」 · 시안 docs/mockup_monthly_report.html)
 *  [바탕] v19-170 📑 화면(mfreport170_teacher.js) 그대로 — 아래만 바꾼다(같은 이름 함수를 뒤에서 다시 정의).
 *  ① 줄 태그: 의견 출처(매쓰플랫 AI / ✏ 직접 고침 / ✍ 루멘 데이터 — lumen_store mfrep_src_<YYYY-MM>) · 공개 두 칸(매쓰플랫 · 루멘)
 *  ② 펼친 줄: 「✍ 루멘 데이터로 다시 쓰기」(원장 프롬프트 mf_report_cfg + 매쓰플랫 보고서 숫자 + 우리 문항 기록의 자주 틀린 유형·학습일수
 *     + 숙제 이행도 + 아하노트 질문 수 → callAI) · 「↩ 저장된 글로」
 *  ③ 아래 띠: 공개 대상 ☑ 매쓰플랫 학부모앱 ☑ 루멘 학부모앱 ☐ 문자 → mfrep_req {action, ids, sms, mf, lumen}
 *     (서버 sync/mf_report_worker.js 가 lumen:true 면 mfrep_pub_<코드> 저장 — 숫자는 매쓰플랫 그대로)
 *  ④ 요약 칸에 «루멘 공개 n» · 선택 학생 루멘 데이터로 의견 쓰기(한 명씩 차례로)
 *  ⑤ 예전 📊 월간보고서 탭은 숨긴다(build_app.py rep — 화면 코드는 남겨 둔다)
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
MR.tMf = true; MR.tLm = true; MR.src = {}; MR.srcT = {}; MR.gen = {}; MR.genQ = false;
var MR_SRC = { ai: ['매쓰플랫 AI', '#f1f5f9', '#64748b'], ed: ['✏ 직접 고침', '#fef3c7', '#92400e'], lu: ['✍ 루멘 데이터', '#ede9fe', '#6d28d9'] };
function mrSrcLoad(ym){
  if (MR.srcT[ym]) return; MR.srcT[ym] = 1;
  var sb = null; try { sb = getSupaClient(); } catch(e){} if (!sb) return;
  sb.from('lumen_store').select('key,value').in('key', ['mfrep_src_' + ym]).then(function(r){
    var v = ((r && r.data) || [])[0]; v = v ? v.value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
    MR.src[ym] = (v && v.by) || {}; try { if (VIEW === 'mfrep') render(); } catch(e){}
  }, function(){ MR.srcT[ym] = 0; });
}
function mrSrcOf(id){ var ym = mrMonth(); var m = MR.src[ym] || {}; if (MR.edit[String(id)] !== undefined) return MR.gen[String(id)] ? 'lu' : 'ed'; return m[String(id)] || 'ai'; }
function mrTag(txt, bg, fg){ return '<span class="mr-badge" style="background:' + bg + ';color:' + fg + '">' + txt + '</span>'; }

/* 의견 저장 — 의견 출처도 함께 남긴다(mfrep_src_<달>) */
window.mrSaveComments = function(){
  var ids = Object.keys(MR.edit); if (!ids.length){ alert('고친 의견이 없습니다'); return; }
  var over = ids.filter(function(id){ return MR.edit[id].length > 650; });
  if (over.length){ alert('650자를 넘는 의견이 ' + over.length + '개 있습니다 — 매쓰플랫 한도라서 줄여 주세요'); return; }
  if (!confirm('고친 의견 ' + ids.length + '개를 매쓰플랫 보고서에 저장할까요?\n(공개 상태는 바뀌지 않습니다)')) return;
  var ym = mrMonth(), by = Object.assign({}, MR.src[ym] || {});
  ids.forEach(function(id){ by[id] = MR.gen[id] ? 'lu' : 'ed'; });
  mrSend({ action: 'comment', items: ids.map(function(id){ return { reportId: Number(id), comment: MR.edit[id] }; }) }, '💾 의견 저장을 요청했습니다').then(function(ok){
    if (!ok) return;
    MR.src[ym] = by; MR.edit = {}; MR.gen = {};
    try { supaSetItem('mfrep_src_' + ym, { month: ym, by: by, at: new Date().toISOString() }); } catch(e){}
  });
};
window.mrTarget = function(k, el){ if (k === 'mf') MR.tMf = !!el.checked; else MR.tLm = !!el.checked; render(); };
window.mrPublish = function(on){
  var ids = Object.keys(MR.pick).map(Number); if (!ids.length){ alert('학생을 먼저 체크해 주세요'); return; }
  if (!MR.tMf && !MR.tLm){ alert('공개할 곳(매쓰플랫 학부모앱 · 루멘 학부모앱)을 하나 이상 골라 주세요'); return; }
  if (on && Object.keys(MR.edit).length){ alert('저장 안 한 의견이 있습니다 — 먼저 «💾 고친 의견 저장»을 눌러 주세요'); return; }
  var where = [MR.tMf ? '매쓰플랫 학부모앱' : '', MR.tLm ? '루멘 학부모앱' : ''].filter(Boolean).join(' · ');
  var d = MR.data[mrMonth()], rows = (d && d.rows) || [];
  var noCode = MR.tLm ? rows.filter(function(x){ return MR.pick[String(x.reportId)] && x.code === ''; }).length : 0;
  var msg = on ? ('체크한 ' + ids.length + '명의 보고서를 공개할까요?\n→ ' + where + (MR.tMf ? (MR.sms ? '\n📱 매쓰플랫 문자도 함께 갑니다' : '\n(문자는 보내지 않습니다)') : '') + (noCode ? '\n⚠ ' + noCode + '명은 루멘 학습코드가 없어 루멘 학부모앱에는 못 올립니다' : ''))
               : ('체크한 ' + ids.length + '명의 보고서를 내릴까요?\n→ ' + where);
  if (!confirm(msg)) return;
  mrSend({ action: on ? 'publish' : 'unpublish', ids: ids, sms: on && MR.tMf ? !!MR.sms : false, mf: !!MR.tMf, lumen: !!MR.tLm },
    on ? '📤 공개를 요청했습니다 (' + where + ')' : '🙈 공개 취소를 요청했습니다 (' + where + ')').then(function(ok){ if (ok) MR.pick = {}; });
};
window.mrUndoEdit = function(id){ id = String(id); delete MR.edit[id]; delete MR.gen[id]; render(); };

/* ✍ 루멘 데이터로 다시 쓰기 — 숫자는 매쓰플랫 보고서 것, 틀린 유형·학습일수는 우리 문항 기록, 숙제·아하노트는 우리 자료 */
async function mrLumenFacts(row){
  var f = { days: null, wrongTop: [], hw: null, aha: null };
  try {
    MFM.ym = mrMonth().replace('-', '.');
    await mfmLoad(false);
    var m = (MFM.rows || []).filter(function(x){ return String(x.sid) === String(row.sid); })[0];
    if (m && !m.noData){ f.days = m.days; f.wrongTop = m.wrongTop || []; }
  } catch(e){}
  var sb = null; try { sb = getSupaClient(); } catch(e){}
  if (sb && row.code){
    try {
      var r = await sb.from('lumen_store').select('key,value').in('key', ['hw_teach_' + row.code]);
      var v = ((r && r.data) || [])[0]; v = v ? v.value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      var by = (v && v.byDate) || {}, ym = mrMonth(), ts = Object.keys(by).filter(function(k){ return k.slice(0, 7) === ym; }).map(function(k){ return Number(by[k] && by[k].t); }).filter(function(x){ return !isNaN(x); });
      if (ts.length) f.hw = Math.round(ts.reduce(function(a, b){ return a + b; }, 0) / ts.length);
    } catch(e){}
    try {
      var ym2 = mrMonth(), y = Number(ym2.slice(0, 4)), mo = Number(ym2.slice(5)), ny = mo === 12 ? y + 1 : y, nm = mo === 12 ? 1 : mo + 1;
      var a = await sb.from('aha_notes').select('id').eq('student_code', row.code).gte('created_at', ym2 + '-01T00:00:00+09:00').lt('created_at', ny + '-' + (nm < 10 ? '0' : '') + nm + '-01T00:00:00+09:00');
      if (a && !a.error && a.data) f.aha = a.data.length;
    } catch(e){}
  }
  return f;
}
function mrLumenPrompt(row, f){
  var p = (MFM.prompt || MFM_PROMPT_BASE) + '\n\n[학생 데이터 - 아래 사실만 근거로 쓰고 수치를 지어내지 말 것]\n';
  p += '· 학년: ' + (row.grade || '') + ' · 기간: ' + mrMonth().replace('-', '년 ') + '월 한 달\n';
  p += '· 매쓰플랫 보고서 수치(학부모님이 함께 보는 숫자이므로 이 숫자를 그대로 쓸 것): 푼 문항 ' + (row.scoringCount || 0) + '개 · 정답률 ' + (row.correctRate || 0) + '% · 전국 ' + (row.rank || '-') + '등급\n';
  if (f.days != null) p += '· 매쓰플랫에서 채점한 날: ' + f.days + '일\n';
  p += '· 자주 틀린 유형: ' + (f.wrongTop.length ? f.wrongTop.join(', ') : '자료 없음') + '\n';
  if (f.hw != null) p += '· 숙제 이행도(수업 때 선생님 확인 평균): ' + f.hw + '%\n';
  if (f.aha != null) p += '· 아하노트에 올린 질문: ' + f.aha + '개\n';
  p += '· 650자를 넘지 말 것\n\n의견 본문만 출력하세요 (제목·인사말 형식 없이, 학생 이름 없이 「이번 달」로 시작).';
  return p;
}
window.mrLumenGen = async function(id, quiet){
  id = String(id); var d = MR.data[mrMonth()], row = d && (d.rows || []).filter(function(x){ return String(x.reportId) === id; })[0];
  if (!row) return false;
  if (typeof apiKey !== 'undefined' && !apiKey && !(typeof geminiKey !== 'undefined' && geminiKey)){ if (!quiet) alert('AI 키를 먼저 등록해 주세요 (⚙ 설정)'); return false; }
  MR.busyGen = MR.busyGen || {}; MR.busyGen[id] = 1; MR.open = id; render();
  try {
    var f = await mrLumenFacts(row);
    var txt = String((await callAI(mrLumenPrompt(row, f))) || '').trim();
    if (!txt) throw new Error('빈 답');
    if (txt.length > 650) txt = txt.slice(0, 650);
    MR.edit[id] = txt; MR.gen[id] = 1;
  } catch(e){ if (!quiet) alert('의견 쓰기 실패: ' + (e && e.message || e)); delete MR.busyGen[id]; render(); return false; }
  delete MR.busyGen[id]; render(); return true;
};
window.mrLumenGenPicked = async function(){
  var ids = Object.keys(MR.pick); if (!ids.length){ alert('학생을 먼저 체크해 주세요'); return; }
  if (MR.genQ) return;
  if (!confirm('체크한 ' + ids.length + '명의 의견을 루멘 데이터로 새로 쓸까요?\n(AI 비용은 원장님 키 · 한 명에 몇 원 · 저장은 «💾 고친 의견 저장»을 눌러야 됩니다)')) return;
  MR.genQ = true; var ok = 0;
  for (var i = 0; i < ids.length; i++){ if (await mrLumenGen(ids[i], true)) ok++; }
  MR.genQ = false; MR.open = ''; render();
  try { plToast('✍ ' + ok + '명 의견을 새로 썼습니다 — 확인 후 «💾 고친 의견 저장»'); } catch(e){}
};

/* 화면 — v19-170 rMfrep 바탕 · 태그·버튼·공개 대상만 바뀜 */
function rMfrep(){
  mrLoad(false);
  var ym = mrMonth(), d = MR.data[ym], busy = mrBusy(); mrSrcLoad(ym);
  var h = '<style>'
    + '.mr-wrap{max-width:1100px}.mr-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}'
    + '.mr-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer}.mr-chip.on{background:#0d2240;color:#fff;border-color:#0d2240}'
    + '.mr-btn{border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;background:#eef2f7;color:#0f172a}.mr-btn.pri{background:#0f766e;color:#fff}.mr-btn.warn{background:#1d4ed8;color:#fff}.mr-btn.lu{background:#ede9fe;color:#6d28d9}.mr-btn:disabled{opacity:.45;cursor:default}'
    + '.mr-req{border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;margin-bottom:10px}.mr-req.wait{background:#fef9c3;color:#854d0e}.mr-req.ok{background:#dcfce7;color:#166534}.mr-req.bad{background:#fee2e2;color:#991b1b}'
    + '.mr-sum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.mr-sum div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:12px;color:#64748b;font-weight:700}.mr-sum b{display:block;font-size:19px;color:#0f172a}'
    + '.mr-row{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;overflow:hidden}.mr-row.pk{border-color:#0f766e;box-shadow:0 0 0 2px rgba(15,118,110,.15)}'
    + '.mr-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:10px 12px;cursor:pointer}.mr-hd input{width:18px;height:18px}.mr-nm{font-weight:900;min-width:64px}.mr-g{font-size:12px;color:#64748b;font-weight:700}'
    + '.mr-st{font-size:12px;color:#334155;font-weight:700}.mr-badge{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;white-space:nowrap}.mr-badge.on{background:#dcfce7;color:#166534}.mr-badge.off{background:#f1f5f9;color:#64748b}.mr-badge.ed{background:#fef3c7;color:#92400e}.mr-badge.no{background:#fee2e2;color:#991b1b}'
    + '.mr-badge.lm{background:#dcfce7;color:#166534}.mr-badge.lmoff{background:transparent;color:#94a3b8;border:1px dashed #cbd5e1}'
    + '.mr-pv{flex:1 1 160px;min-width:0;font-size:12.5px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.mr-body{padding:0 12px 12px}.mr-body textarea{width:100%;min-height:150px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:14px;line-height:1.6;resize:vertical;box-sizing:border-box}.mr-cnt{font-size:11px;color:#64748b;text-align:right;margin-top:3px}'
    + '.mr-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}'
    + '.mr-bar{position:sticky;bottom:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}'
    + '.mr-tg{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:800;background:#fff;border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 9px;cursor:pointer}'
    + '</style><div class="mr-wrap">';
  h += '<div style="font-size:13px;color:#475569;margin-bottom:10px;line-height:1.6">매쓰플랫 «보고서»를 한 화면에서 봅니다. 의견을 고치거나 <b>✍ 루멘 데이터로 다시 쓰고</b>, 체크한 학생을 <b>매쓰플랫 학부모앱 · 루멘 학부모앱</b>에 공개합니다. '
    + '숫자는 매쓰플랫 보고서 그대로이고, 루멘 학부모앱에는 «루멘 기록»(숙제 이행도·아하노트 질문·플래너)이 덧붙습니다. 버튼을 누르면 서버가 처리합니다(1~5분). 매달 <b>2일 새벽</b>에 지난달 보고서가 <b>비공개</b>로 자동으로 만들어집니다.</div>';
  h += '<div class="mr-top">' + mrMonths().map(function(m){ return '<button class="mr-chip' + (m === ym ? ' on' : '') + '" onclick="mrSetMonth(\'' + m + '\')">' + Number(m.slice(5)) + '월</button>'; }).join('')
    + '<span style="flex:1"></span><button class="mr-btn" onclick="mrReload()">↻ 화면 새로</button>'
    + '<button class="mr-btn" ' + (busy ? 'disabled' : '') + ' onclick="mrRefresh()">⤓ 매쓰플랫에서 다시 읽기</button>'
    + '<button class="mr-btn pri" ' + (busy ? 'disabled' : '') + ' onclick="mrMake()">＋ 이 달 보고서 만들기(비공개)</button></div>';
  h += mrReqLine();
  if (d === undefined || (MR.loading && !d)) return h + '<div style="padding:30px;text-align:center;color:#64748b">불러오는 중…</div></div>';
  if (!d) return h + '<div style="padding:30px;text-align:center;color:#64748b;background:#fff;border-radius:12px">' + Number(ym.slice(5)) + '월 목록이 아직 없습니다.<br>«⤓ 매쓰플랫에서 다시 읽기»를 누르거나, 보고서가 없으면 «＋ 이 달 보고서 만들기»를 눌러 주세요.</div></div>';
  var rows = d.rows || [], nOn = rows.filter(function(x){ return x.shared; }).length, nLm = rows.filter(function(x){ return x.lumen; }).length,
      nCm = rows.filter(function(x){ return String(x.comment || '').trim(); }).length, nOff = rows.filter(function(x){ return String(x.comment || '').trim() && !x.commentOn; }).length;
  h += '<div class="mr-sum"><div>보고서<b>' + rows.length + '명</b></div><div>매쓰플랫 공개<b style="color:#166534">' + nOn + '</b></div><div>루멘 공개<b style="color:#166534">' + nLm + '</b></div><div>선생님의견 있음<b>' + nCm + '</b></div>'
    + (nOff ? '<div style="border-color:#fecaca">의견 쪽 꺼짐<b style="color:#dc2626">' + nOff + '</b></div>' : '')
    + '<div>보고서 없음<b>' + ((d.missing || []).length) + '</b></div><div style="flex:1;min-width:150px">마지막으로 읽은 때<b style="font-size:14px">' + mrWhen(d.at) + '</b></div></div>';
  if ((d.missing || []).length) h += '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px">보고서 없음: ' + d.missing.map(function(x){ return mrE(x.name); }).join(', ') + ' — 그 달 채점 기록이 없으면 매쓰플랫이 만들지 않습니다.</div>';
  rows.forEach(function(x){
    var id = String(x.reportId), pk = !!MR.pick[id], ed = MR.edit[id] !== undefined, cm = ed ? MR.edit[id] : String(x.comment || ''), op = MR.open === id, sr = MR_SRC[mrSrcOf(id)], gen = !!(MR.busyGen && MR.busyGen[id]);
    h += '<div class="mr-row' + (pk ? ' pk' : '') + '" data-rid="' + id + '"><div class="mr-hd" onclick="mrOpen(\'' + id + '\')">'
      + '<input type="checkbox" ' + (pk ? 'checked' : '') + ' onclick="event.stopPropagation();mrPick(\'' + id + '\')">'
      + '<span class="mr-nm">' + mrE(x.name) + '</span><span class="mr-g">' + mrE(x.grade) + '</span>'
      + '<span class="mr-st">채점 ' + (x.scoringCount || 0) + ' · 정답률 ' + (x.correctRate || 0) + '% · 전국 ' + (x.rank || '-') + '등급</span>'
      + mrTag(sr[0], sr[1], sr[2])
      + '<span class="mr-badge ' + (x.shared ? 'on">매쓰플랫 ✓' : 'off">매쓰플랫 비공개') + '</span>'
      + (x.lumen ? '<span class="mr-badge lm">루멘 ✓</span>' : (x.code === '' ? '<span class="mr-badge no" title="mf_students 에 루멘 학습코드가 없습니다">루멘 코드 없음</span>' : '<span class="mr-badge lmoff">루멘</span>'))
      + (ed ? '<span class="mr-badge ed">저장 전</span>' : '')
      + (gen ? '<span class="mr-badge ed">✍ 쓰는 중…</span>' : '')
      + (!String(cm).trim() ? '<span class="mr-badge no">의견 없음</span>' : (!x.commentOn ? '<span class="mr-badge no">의견 쪽 꺼짐</span>' : ''))
      + '<span class="mr-pv">' + (op ? '' : mrE(cm)) + '</span><span style="color:#94a3b8">' + (op ? '▲' : '▼') + '</span></div>';
    if (op) h += '<div class="mr-body"><div class="mr-tools">'
      + '<button class="mr-btn lu" ' + (gen || MR.genQ ? 'disabled' : '') + ' onclick="mrLumenGen(\'' + id + '\')">✍ 루멘 데이터로 다시 쓰기</button>'
      + (ed ? '<button class="mr-btn" onclick="mrUndoEdit(\'' + id + '\')">↩ 저장된 글로</button>' : '')
      + '<span style="font-size:11.5px;color:#64748b">글을 바로 고쳐도 됩니다 — 고친 뒤 아래 «💾 고친 의견 저장»</span></div>'
      + '<textarea oninput="mrEdit(\'' + id + '\',this)" placeholder="선생님의견을 써 주세요">' + mrE(cm) + '</textarea>'
      + '<div class="mr-cnt" id="mr-cnt-' + id + '">' + cm.length + ' / 650</div>'
      + (!x.commentOn ? '<div style="font-size:12px;color:#b91c1c;margin-top:4px">이 보고서는 «선생님의견» 쪽이 꺼져 있어 학부모님께 의견이 안 보입니다 — 의견을 저장하면 같이 켜집니다.</div>' : '')
      + '</div>';
    h += '</div>';
  });
  var np = Object.keys(MR.pick).length;
  h += '<div class="mr-bar"><button class="mr-btn" onclick="mrPickAll(' + (np < rows.length ? 'true' : 'false') + ')">' + (np < rows.length ? '☑ 전체 선택' : '☐ 선택 풀기') + '</button>'
    + '<span style="font-size:13px;font-weight:800;color:#0f766e">' + np + '명 선택</span>'
    + '<button class="mr-btn lu" ' + (busy || !np || MR.genQ ? 'disabled' : '') + ' onclick="mrLumenGenPicked()">✍ 선택 루멘 데이터로 쓰기</button><span style="flex:1"></span>'
    + '<button class="mr-btn" id="mr-savebar" ' + (busy ? 'disabled' : '') + ' onclick="mrSaveComments()">💾 고친 의견 저장 (' + Object.keys(MR.edit).length + ')</button>'
    + '<label class="mr-tg"><input type="checkbox" id="mr-t-mf" ' + (MR.tMf ? 'checked' : '') + ' onchange="mrTarget(\'mf\',this)"> 매쓰플랫 학부모앱</label>'
    + '<label class="mr-tg"><input type="checkbox" id="mr-t-lm" ' + (MR.tLm ? 'checked' : '') + ' onchange="mrTarget(\'lm\',this)"> 루멘 학부모앱</label>'
    + '<label class="mr-tg" style="' + (MR.tMf ? '' : 'opacity:.45') + '"><input type="checkbox" ' + (MR.sms ? 'checked' : '') + (MR.tMf ? '' : ' disabled') + ' onchange="mrSms(this)"> 문자(매쓰플랫)</label>'
    + '<button class="mr-btn warn" id="mr-pub" ' + (busy || !np ? 'disabled' : '') + ' onclick="mrPublish(true)">📤 선택 공개</button>'
    + '<button class="mr-btn" id="mr-unpub" ' + (busy || !np ? 'disabled' : '') + ' onclick="mrPublish(false)">🙈 선택 공개 취소</button></div>';
  if (MR.log && MR.log.length) h += '<details style="margin-top:12px;font-size:12.5px;color:#475569"><summary style="cursor:pointer;font-weight:800">지난 처리 기록</summary>'
    + MR.log.slice(0, 12).map(function(l){ var rs = l.result || {}; return '<div style="padding:3px 0">' + mrWhen(l.at) + ' · ' + mrE(l.month) + ' · ' + mrE(l.action) + (l.n ? ' ' + l.n + '건' : '') + (l.sms ? ' · 문자' : '') + ' → 성공 ' + (rs.ok || 0) + (rs.lumen != null ? ' · 루멘 ' + rs.lumen : '') + (rs.fail ? ' · 실패 ' + rs.fail : '') + '</div>'; }).join('')
    + '</details>';
  return h + '</div>';
}
