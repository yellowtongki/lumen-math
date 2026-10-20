
/* ══════════════════════════════════════════════════════════════════════════
 * v19-69: 🏁 시즌 마무리 카드 · 🔜 다음 시즌 예고 (원장 결정 2026-10-01)
 *   · 진도 레이스가 끝나면 레이스 탭 맨 위에 「시즌 마무리」 카드 — 상태(끝·집계 중 / 결과 발표됨), 발표 예정일,
 *     다음 시즌 예고(이름 · 시작일(비우면 미정) · 한 줄 · 학생앱 예고 카드 · 홈 띠 · 시작일 미정이면 학교별 기말고사 디데이).
 *   · 지난 시즌의 설정·순위·시상은 접어 둔다(펼치기 단추). ⚙️ 시즌 설정을 누르면 자동으로 펼친다.
 *   · 저장 = race_season.next (학생앱 v2-119 가 읽는다). 시상은 기존 「🎁 시상 확정」 그대로.
 * ══════════════════════════════════════════════════════════════════════════ */
window.SEA_T = { draft: null, open: false };
function seaDef(){ return { name: '2학기 기말고사 진도 레이스', from: '', note: '', show: true, showExam: true, homeStrip: true, announceAt: '' }; }
function seaEnded(s){ return !!(s && s.to && raceTodayK() > String(s.to)); }
function seaAwarded(){ var b = RACE.board, s = RACE.season, a = RACE.awards; if (!a || !a.seasonId) return false; return a.seasonId === ((b && b.seasonId) || (s && s.id)); }
function seaDraft(){ if (!SEA_T.draft) SEA_T.draft = Object.assign(seaDef(), (RACE.season && RACE.season.next) || {}); return SEA_T.draft; }
window.seaFolded = function(){ return seaEnded(RACE.season) && !SEA_T.open && !RACE.edit; };
window.seaToggleOld = function(){ SEA_T.open = !SEA_T.open; render(); };
window.seaSet = function(k, v){ var d = seaDraft(); if (k === 'show' || k === 'showExam' || k === 'homeStrip') d[k] = !!v; else d[k] = String(v == null ? '' : v); if (k === 'show' || k === 'showExam' || k === 'homeStrip') render(); };
window.seaSave = async function(){
  var s = RACE.season; if (!s){ plToast('시즌이 없습니다'); return; }
  var d = seaDraft(); if (!String(d.name || '').trim()){ plToast('다음 시즌 이름을 적어 주세요'); return; }
  s.next = { name: String(d.name).trim(), from: String(d.from || '').slice(0, 10), note: String(d.note || '').trim(), show: d.show !== false, showExam: d.showExam !== false, homeStrip: d.homeStrip !== false, announceAt: String(d.announceAt || '').slice(0, 10), updated: new Date().toISOString() };
  try {
    var sb = getSupaClient();
    var r = await sb.from('lumen_store').upsert({ key: 'race_season', value: s, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (r && r.error) throw new Error(r.error.message);
    plToast('저장했습니다 — 학생앱 리그 화면·홈 띠에 다음 시즌 예고가 보입니다');
  } catch(e){ plToast('저장 실패: ' + (e.message || e)); }
  render();
};
function seaIn(k, v, w, type, ph){ return '<input type="' + (type || 'text') + '" value="' + esc2(v == null ? '' : v) + '" placeholder="' + esc2(ph || '') + '" oninput="seaSet(\'' + k + '\',this.value)" style="width:' + w + 'px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;font-weight:700;font-family:inherit">'; }
function seaChk(k, on, label){ return '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer"><input type="checkbox" ' + (on ? 'checked ' : '') + 'onchange="seaSet(\'' + k + '\',this.checked)">' + label + '</label>'; }
window.seaFoldBtn = function(){
  var s = RACE.season || {};
  return '<button onclick="seaToggleOld()" style="width:100%;text-align:left;padding:12px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;font-size:13px;font-weight:800;color:#475569;cursor:pointer;font-family:inherit">▸ 지난 시즌 「' + esc2(s.name || '진도 레이스') + '」 ' + esc2(s.from || '') + ' ~ ' + esc2(s.to || '') + ' — 설정 · 순위표 · 레이드 · 시상 펼치기</button>';
};
window.seaCardHtml = function(){
  var s = RACE.season; if (!s || !seaEnded(s)) return '';
  var aw = seaAwarded(), d = seaDraft(), sv = s.next || {};
  var dirty = JSON.stringify(Object.assign(seaDef(), sv, { updated: undefined })) !== JSON.stringify(Object.assign({}, d, { updated: undefined }));
  var h = '<div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1.5px solid ' + (aw ? '#bbf7d0' : '#fde68a') + '">';
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:15px;font-weight:900;color:#0d2240">🏁 시즌 마무리 — ' + esc2(s.name || '') + '</div>'
    + '<span style="font-size:11px;font-weight:900;border-radius:50px;padding:3px 9px;background:' + (aw ? '#dcfce7;color:#15803d' : '#fef3c7;color:#92400e') + '">' + (aw ? '결과 발표됨 ✓' : '끝 · 집계 중 (시상 미발표)') + '</span>'
    + '<span style="font-size:11.5px;color:#64748b;font-weight:700">' + esc2(s.from || '') + ' ~ ' + esc2(s.to || '') + ' · 학생앱에는 ' + (aw ? '🎉 시즌 결과(포디움)' : '「결과 확인 중」 카드') + '가 보입니다</span></div>';
  if (!aw) h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12.5px;font-weight:800;color:#334155">발표 예정일 ' + seaIn('announceAt', d.announceAt, 140, 'date') + '<span style="font-size:11px;color:#94a3b8;font-weight:700">학생앱에 「10/6 발표 예정」처럼 보입니다 · 발표는 위 「🎁 시상 확정」 단추</span></div>';
  h += '<div style="background:#f8fafc;border-radius:11px;padding:12px 14px">'
    + '<div style="font-size:12.5px;font-weight:900;color:#0d2240;margin-bottom:8px">🔜 다음 시즌 예고 <span style="font-size:11px;color:#94a3b8;font-weight:700">시즌을 아직 안 만들어도 예고만 먼저 보일 수 있습니다</span></div>'
    + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px">'
    + '<div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:3px">이름</div>' + seaIn('name', d.name, 230) + '</div>'
    + '<div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:3px">시작일 <span style="color:#94a3b8">(비우면 「미정」)</span></div>' + seaIn('from', d.from, 140, 'date') + '</div>'
    + '<div style="flex:1;min-width:220px"><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:3px">학생에게 한 줄 (비우면 자동)</div>' + seaIn('note', d.note, 320, 'text', '예: 시작 전 밀린 채점을 끝내 두면 첫 주가 편해요') + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">' + seaChk('show', d.show !== false, '학생앱 리그 화면에 예고 카드') + seaChk('homeStrip', d.homeStrip !== false, '홈 리그 띠에 한 줄') + seaChk('showExam', d.showExam !== false, '시작일이 없으면 학생 학교의 기말고사 디데이로 대신 보이기 (나이스 학사일정)') + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center"><button onclick="seaSave()" style="padding:8px 14px;background:#0d2240;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">💾 저장 → 학생앱</button>'
    + (sv.updated ? '<span style="font-size:11px;color:#94a3b8;font-weight:700">마지막 저장 ' + new Date(sv.updated).toLocaleString('ko-KR') + (dirty ? ' · 고친 것 있음(저장 전)' : '') + '</span>' : '<span style="font-size:11px;color:#b45309;font-weight:800">아직 저장한 적 없음</span>') + '</div>'
    + '</div></div>';
  return h;
};
