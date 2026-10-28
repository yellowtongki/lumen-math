/* ══════════════════════════════════════════════════════════════════════════
 * v19-138: ⚔️ 보스 고르면 미리보기 바로 바뀜 · 💾 저장 단추 가까이 · 🏞 보스 배경
 *   원장 2026-10-18 밤 「흑기사로 골랐는데 선택이 안된다 · 보스 배경도 만들어줘」
 *   계약서 docs/raid_s2_contract.md §7 — raid137_teacher.js 위에 얹는다(뒤 부품의 같은 이름 함수가 이긴다).
 *
 *   원인: 보스 고르기는 편집 사본(RX.raids)만 바꾸고, 미리보기는 서버가 센 raid_board_draft 의 그림을 그렸다.
 *         그래서 아래 「💾 레이드·버프 저장」을 누르고 → 서버가 다시 셀 때(몇 시간 걸릴 수 있음)까지 그림이 그대로였다.
 *
 *   ① 미리보기 = «지금 설정»(고치는 중이면 편집 사본 RX.raids, 아니면 RNX.season.raids)을 레이드 id 로 맞춰
 *      보스·배경·이름·체력을 그린다(그림은 보관함 → 앱 기본 RAIDART). 피해 숫자는 raid_board_draft 그대로,
 *      체력이 바뀌었으면 퍼센트·남은 체력·격파 예상만 새 체력으로 다시 셈.
 *      서버 결과와 다르면 칩: 「✏️ 저장 안 함」(고치는 중) / 「⏳ 서버 다시 세기 전」(저장했지만 아직 안 셈).
 *   ② 저장 안 한 변경: 편집 칸 맨 위에 붙어 다니는 띠 「저장하지 않은 변경이 있어요 · 💾 저장」,
 *      보스 고르기·배경 고르기 바로 아래에 💾 저장 단추. 저장 안 하고 닫으면 한 번 묻는다.
 *   ③ 📣 공개(rnxPublish 다시 정의): raid_board_draft → raid_board 로 옮길 때 다음 시즌 설정을 id 마다 다시 입힌다
 *      (이름·보스·체력·학교·학년 가리기·시작/마감 + 보관함 그림 art·배경 bgArt) → 다시 세기 전이어도 마지막 선택 그대로 나간다.
 *      퍼센트·남은 체력·격파는 피해(dealt)와 새 체력으로 다시 셈. 꺼 둔 레이드(on:false)는 빠진다.
 *   ④ 🏞 배경 (raid_boss_lib.bgs, 128×72 꽉 찬 그림): 레이드마다 배경 고르기(보관함 배경 + 「보스 기본 배경」= raids[].bg 비움).
 *      그리는 법(계약서 §7): 배경을 정수 배율로, 보스도 같은 배율로 가로 가운데, 보스 맨 아래 줄이 배경 64번째 줄
 *      (top = (64 − boss.h) × 배율, 0보다 작으면 0). 보스가 배경보다 크면 배경 칸을 키워(= 둘 다 줄여 보이게) 맞춘다.
 *      🗃 보스 보관함: 🏞 배경 칸(8종) · 보스 카드마다 기본 배경 이름 + 바꾸기(bosses[i].bg + bgSet:true,
 *      보관함 통째 읽고-고치고-쓰기 → 모르는 칸 · Claude 보스 · bgs 그대로).
 *   학생앱 키는 공개(rnxPublish) 안에서만 쓴다.
 * ══════════════════════════════════════════════════════════════════════════ */
RX.base = null;
var RX_FLOOR_ROW = 64;

/* ── 🏞 배경 보관함 ── */
function rxLibBgs(){
  var L = RX.lib;
  return (L && Array.isArray(L.bgs)) ? L.bgs.filter(function(b){ return b && b.key && Array.isArray(b.rows) && Array.isArray(b.pal); }) : [];
}
function rxLibBg(key){ return key ? (rxLibBgs().filter(function(b){ return b.key === key; })[0] || null) : null; }
function rxBossDefaultBg(boss){ var b = rxLibBoss(boss); return (b && b.bg) ? String(b.bg) : ''; }
function rxCfgBgKey(c){ return c ? (c.bg ? String(c.bg) : rxBossDefaultBg(c.boss)) : ''; }
function rxBgName(key){ var g = rxLibBg(key); return g ? (g.name || g.key) : String(key || ''); }
/* 배경 격자 (128×72) — 같은 그림이면 다시 풀지 않는다 */
function rxBgGrid(a){
  if (!a || !Array.isArray(a.rows) || !Array.isArray(a.pal)) return null;
  var ck = 'bg:' + (a.key || '?'), c = RX.gcache[ck];
  if (!c || c.src !== a.rows){ c = RX.gcache[ck] = { src: a.rows, g: rxDecodeArt(a) }; }
  return c.g;
}

/* ── 무대 그리기 (배경 + 보스) — 순수 계산은 rxStageLayout 에 따로(검사에서 그대로 부른다) ── */
window.rxStageLayout = function(BW, BH, w, h, scale){
  scale = Math.max(1, Math.floor(Number(scale) || 1));
  BW = Math.max(1, BW | 0); BH = Math.max(1, BH | 0); w = w | 0; h = h | 0;
  var f = Math.max(1, Math.ceil(w / BW), Math.ceil(h / BH));   /* 보스가 배경보다 크면 배경 칸을 f 배로 */
  return { f: f, u: f * scale, cw: BW * f * scale, ch: BH * f * scale,
    left: Math.floor((BW * f - w) / 2) * scale, top: Math.max(0, (Math.min(RX_FLOOR_ROW, BH) * f - h) * scale) };   /* 배경이 64줄보다 낮으면(규격 밖) 맨 아래가 바닥 */
};
window.rxStageCanvas = function(bg, boss, scale){
  var BW = 0, w = 0, y, x;
  for (y = 0; y < bg.length; y++) BW = Math.max(BW, (bg[y] || []).length);
  if (boss) for (y = 0; y < boss.length; y++) w = Math.max(w, (boss[y] || []).length);
  var L = rxStageLayout(BW, bg.length, w, boss ? boss.length : 0, scale), s = Math.max(1, Math.floor(Number(scale) || 1));
  var cv = document.createElement('canvas'); cv.width = L.cw; cv.height = L.ch;
  cv.style.imageRendering = 'pixelated'; cv.style.maxWidth = '100%'; cv.style.height = 'auto';
  if (L.f > 1) cv.style.width = (BW * s) + 'px';
  var c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  for (y = 0; y < bg.length; y++) for (x = 0; x < (bg[y] || []).length; x++){ var v = bg[y][x]; if (v){ c.fillStyle = v; c.fillRect(x * L.u, y * L.u, L.u, L.u); } }
  if (boss) for (y = 0; y < boss.length; y++) for (x = 0; x < (boss[y] || []).length; x++){ var q = boss[y][x]; if (q){ c.fillStyle = q; c.fillRect(L.left + x * s, L.top + y * s, s, s); } }
  return cv;
};
function rxStageSlot(bg, boss, scale, cls){
  var id = 's' + (++RX.n); RX.slots[id] = { stage: true, bg: bg, g: boss, s: scale || 1 };
  return '<span class="rx-art rx-stagecv' + (cls ? ' ' + cls : '') + '" data-rx="' + id + '" style="display:inline-block;line-height:0;max-width:100%"></span>';
}
(function(){
  var o = window.rxPaintSlots;
  window.rxPaintSlots = function(root){
    var els = (root || document).querySelectorAll('.rx-art[data-rx]');
    for (var i = 0; i < els.length; i++){
      var el = els[i]; if (el.getAttribute('data-done')) continue;
      var s = RX.slots[el.getAttribute('data-rx')]; if (!s || !s.stage || !s.bg) continue;
      el.innerHTML = ''; el.appendChild(rxStageCanvas(s.bg, s.g, s.s)); el.setAttribute('data-done', '1');
    }
    return o.apply(this, arguments);
  };
})();

/* ── ① 지금 설정으로 본 모양 ── */
function rxCfgRaids(){
  var s = RNX.season || {};
  if (RX.edit && RX.raids) return RX.raids;
  return Array.isArray(s.raids) ? s.raids : (s.raid ? [s.raid] : []);
}
function rxSavedRaid(id){
  var s = RNX.season || {}, a = Array.isArray(s.raids) ? s.raids : [];
  return a.filter(function(r){ return r && r.id === id; })[0] || null;
}
/* x: 서버가 센 줄(raid_board_draft.list[] · 없을 수 있음) · c: 설정(없을 수 있음) → 그릴 보스·배경 */
window.rxPvLook = function(x, c){
  var boss = (c && c.boss) || (x && x.boss) || 'golem';
  var art = (x && x.art && x.boss === boss) ? x.art : null;
  var bk = c ? rxCfgBgKey(c) : ((x && x.bgArt && x.bgArt.key) || '');
  var bgo = rxLibBg(bk);
  if (!bgo && x && x.bgArt && x.boss === boss && (x.bgArt.key === bk || (!bk && !rxLibBgs().length && !(c && c.bg)))) bgo = x.bgArt;
  return { boss: boss, art: art, grid: rxBossGrid(boss, art), bgKey: bgo ? String(bgo.key || bk) : bk, bgo: bgo, bg: bgo ? rxBgGrid(bgo) : null };
};
function rxSig(name, boss, bg, hp){ return [String(name || ''), String(boss || ''), String(bg || ''), Number(hp) || 0].join('|'); }
/* 칩: 'unsaved' (고치는 중 · 저장된 설정과 다름) · 'recount' (서버 계산과 다름) · '' */
window.rxPvState = function(x, c){
  if (!c) return x ? 'gone' : '';
  var look = rxPvLook(x, c), cur = rxSig(c.name, c.boss, look.bgo ? look.bgKey : '', c.hp);
  if (RX.edit){
    var sv = rxSavedRaid(c.id);
    if (!sv || rxSig(sv.name, sv.boss, rxCfgBgKey(sv), sv.hp) !== rxSig(c.name, c.boss, rxCfgBgKey(c), c.hp)) return 'unsaved';
  }
  if (!x) return 'recount';
  return rxSig(x.name, x.boss, (x.bgArt && x.bgArt.key) || '', x.hp) !== cur ? 'recount' : '';
};
function rxPvChip(st){
  if (st === 'unsaved') return '<span class="rx-pvchip" data-st="unsaved" title="💾 저장해야 다음 시즌에 들어갑니다" style="font-size:10.5px;font-weight:900;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;border-radius:50px;padding:2px 9px">✏️ 저장 안 함</span>';
  if (st === 'recount') return '<span class="rx-pvchip" data-st="recount" title="그림·이름·체력은 새 설정으로 보여 줍니다 · 피해 숫자는 서버가 다시 세면 맞춰집니다 · 공개 때는 새 설정이 그대로 나갑니다" style="font-size:10.5px;font-weight:900;background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;border-radius:50px;padding:2px 9px">⏳ 서버 다시 세기 전</span>';
  if (st === 'gone') return '<span class="rx-pvchip" data-st="gone" style="font-size:10.5px;font-weight:900;background:#f1f5f9;color:#64748b;border-radius:50px;padding:2px 9px">설정에 없음 — 다시 세면 빠집니다</span>';
  return '';
}
/* 무대 칸 (배경 있으면 배경+보스 2배, 없으면 예전처럼 보스만) */
function rxPvBox(look){
  if (look.bg) return '<div class="rx-stage" data-boss="' + esc2(look.boss) + '" data-bg="' + esc2(look.bgKey) + '" style="flex:0 0 272px;max-width:100%;box-sizing:border-box;background:#0d0a1d;border-radius:10px;padding:8px;display:grid;place-items:center;min-height:108px">' + rxStageSlot(look.bg, look.grid, 2) + '</div>';
  return '<div class="rx-stage" data-boss="' + esc2(look.boss) + '" data-bg="" style="flex:0 0 128px;box-sizing:border-box;background:#0d0a1d;border-radius:10px;padding:8px;display:grid;place-items:center;min-height:108px">' + rxSlot(look.grid, 108) + '</div>';
}
function rxRaidPreview(){
  var s = RNX.season || {}, b = RX.rbd;
  var note = function(t, warn){ return '<div style="background:' + (warn ? '#fff7ed' : '#f8fafc') + ';color:' + (warn ? '#9a3412' : '#64748b') + ';border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin-top:9px">' + t + '</div>'; };
  if (!RX.at && !RX.err) return note('레이드 순위판 불러오는 중…');
  var cfg = rxCfgRaids(), byId = {}, used = {};
  cfg.forEach(function(r){ if (r && r.id) byId[r.id] = r; });
  var h = '';
  var L = (b && Array.isArray(b.list)) ? b.list : [];
  if (RX.err) h += note('레이드 순위판 불러오기 실패: ' + esc2(RX.err), true);
  else if (!b || !b.at) h += note('아직 서버가 다음 시즌 레이드를 세지 않았습니다 (raid_board_draft 없음) — 저장하면 다시 세기를 요청합니다.');
  else if (b.on === false || !L.length) h += note('서버 계산 결과: 켜진 레이드가 없습니다 — 공개하면 보스 레이드는 꺼집니다.');
  var hasList = !RX.err && b && b.at && b.on !== false && L.length;
  h = '<div id="rx-preview" style="margin-top:10px">' + h;
  if (hasList){
    if (s.updated && Date.parse(b.at) < Date.parse(s.updated)) h += note('설정을 바꾼 뒤 아직 다시 세지 않은 결과입니다 — 서버가 다시 세면 바뀝니다. (보스·배경·이름·체력은 새 설정으로 미리 보여 드립니다)', true);
    h += '<div style="font-size:11.5px;color:#64748b;font-weight:700;margin:8px 0 2px">🖥 서버 계산 ' + esc2(rnxFmt(b.at)) + ' · 🔒 학생앱에는 「📣 공개」 때 나갑니다</div>';
  }
  var today = rxTodayK();
  (hasList ? L : []).forEach(function(x){
    var c = byId[x.id] || null; if (c) used[x.id] = 1;
    var look = rxPvLook(x, c), st = rxPvState(x, c);
    var hp = (c && Number(c.hp) > 0) ? Math.round(Number(c.hp)) : (Number(x.hp) || 0);
    var dealt = Number(x.dealt) || 0, pct = Math.min(100, Number(x.pct) || 0), left = x.left, cleared = !!x.cleared, eta = x.eta;
    if (hp && hp !== Number(x.hp)){
      pct = Math.min(100, Math.round(dealt / hp * 1000) / 10); left = Math.max(0, hp - dealt); cleared = dealt >= hp;
      eta = ((Number(x.daysIn) || 0) >= 4 && Number(x.perDay) > 0) ? rxAddDays(today, Math.ceil(left / Number(x.perDay))) : null;
    }
    var to = (c && c.to) || x.to, dday = (c && c.to && c.to !== x.to) ? Math.round((Date.parse(c.to) - Date.parse(today)) / 86400000) : x.dday;
    var hide = c ? !!c.hideSch : !!x.hideSch;
    var rows = x.rows || [], front = x.front || [];
    var nm = (c && c.name) || x.name || '';
    h += '<div class="rx-pv" data-id="' + esc2(x.id) + '" data-st="' + st + '" style="display:flex;flex-wrap:wrap;gap:14px;border:1.5px solid ' + (st === 'unsaved' ? '#fcd34d' : '#ede9fe') + ';border-radius:12px;padding:12px;margin-top:9px">'
      + rxPvBox(look) + '<div style="flex:1 1 240px;min-width:0">';
    h += '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px"><b style="font-size:14px;color:#0d2240">' + esc2(nm) + '</b>'
      + '<span class="rx-pvboss" style="font-size:11.5px;color:#6d28d9;font-weight:800">' + esc2(rxBossName(look.boss, look.art)) + (look.art || rxLibBoss(look.boss) ? ' 🗃' : '') + '</span>'
      + (look.bgKey ? '<span class="rx-pvbg" style="font-size:11px;color:#0e7490;font-weight:800">🏞 ' + esc2(look.bgo && look.bgo.name ? look.bgo.name : rxBgName(look.bgKey)) + (c && c.bg ? '' : ' (보스 기본)') + '</span>' : '')
      + rxPvChip(st)
      + '<span style="font-size:11.5px;color:#64748b;font-weight:700">' + esc2((x.sch ? x.sch + ' ' : '') + ((x.grs || []).join('·') || '모든 학년')) + ' · ' + rows.length + '명' + (hide ? ' · 🙈 학교·학년 가림' : '') + '</span>'
      + '<span style="margin-left:auto;font-size:12px;font-weight:900;color:' + (dday <= 7 ? '#dc2626' : '#0d2240') + '">' + (dday >= 0 ? 'D-' + dday : '끝') + '</span></div>';
    h += '<div style="height:20px;border-radius:7px;background:#f1f5f9;overflow:hidden;position:relative;border:1px solid #e2e8f0">'
      + '<i style="display:block;height:100%;width:' + pct + '%;background:linear-gradient(90deg,#f59e0b,#e8192c)"></i>'
      + '<span class="rx-hp" style="position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:900;color:#0d2240">' + raceNum(dealt) + ' / ' + raceNum(hp) + ' (' + pct + '%)</span></div>';
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;font-weight:700;color:#64748b;margin-top:7px">'
      + '<span>어제 피해 <b style="color:#0d2240">' + raceNum(x.yesterday) + '</b></span>'
      + '<span>하루 평균 <b style="color:#0d2240">' + raceNum(x.perDay) + '</b></span>'
      + '<span>남은 체력 <b class="rx-left" style="color:#e8192c">' + raceNum(left) + '</b></span>'
      + '<span>' + (cleared ? '<b style="color:#0f8a4e">🎉 격파</b>'
        : (eta ? '격파 예상 <b style="color:' + (eta > to ? '#dc2626' : '#0f8a4e') + '">' + esc2(eta) + '</b>' + (eta > to ? ' <span style="color:#dc2626">— 마감을 넘깁니다</span>' : '')
          : '격파 예상 <span style="color:#94a3b8">나흘째부터 (지금 ' + (x.daysIn || 0) + '일째)</span>')) + '</span></div>';
    var fn = front.map(function(cd){ var r = rows.filter(function(q){ return q.code === cd; })[0]; return esc2(raceName(cd, r ? r.nm : '')); });
    h += '<div style="font-size:11.5px;font-weight:800;color:#6d28d9;margin-top:7px">⭐ 앞줄(이번 주 상위 ' + (x.showNames || 3) + '명): ' + (fn.join(' · ') || '-') + '</div>';
    h += '<div class="rx-party" style="max-height:210px;overflow:auto;margin-top:6px;border:1px solid #f1f5f9;border-radius:8px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">'
      + '<tr style="background:#f8fafc;color:#64748b;font-weight:800;font-size:10.5px"><th style="text-align:left;padding:5px 8px">파티 명단 ' + rows.length + '명</th>' + (hide ? '' : '<th style="text-align:left;padding:5px 8px">학교·학년</th>')
      + '<th style="text-align:right;padding:5px 8px">누적 피해</th><th style="text-align:right;padding:5px 8px">이번 주</th><th style="text-align:right;padding:5px 8px">어제</th></tr>';
    rows.forEach(function(r){
      h += '<tr class="rx-prow" style="border-top:1px solid #f1f5f9"><td style="padding:4px 8px;font-weight:800;color:#0d2240">' + (front.indexOf(r.code) >= 0 ? '⭐ ' : '') + esc2(raceName(r.code, r.nm)) + '</td>'
        + (hide ? '' : '<td style="padding:4px 8px;color:#64748b">' + esc2((r.sch || '') + ' ' + (r.gr || '')) + '</td>')
        + '<td style="padding:4px 8px;text-align:right;font-weight:900">' + raceNum(r.dealt) + '</td><td style="padding:4px 8px;text-align:right;color:#64748b">' + raceNum(r.week) + '</td>'
        + '<td style="padding:4px 8px;text-align:right;color:#64748b">' + raceNum(r.y) + '</td></tr>';
    });
    h += '</table></div></div></div>';
  });
  /* 설정에는 있는데 서버가 아직 안 센 레이드(새로 넣은 것) — 그림만 먼저 */
  cfg.forEach(function(c){
    if (!c || used[c.id] || c.on === false) return;
    var look = rxPvLook(null, c), st = rxPvState(null, c);
    h += '<div class="rx-pvn" data-id="' + esc2(c.id) + '" data-st="' + st + '" style="display:flex;flex-wrap:wrap;gap:14px;border:1.5px dashed ' + (st === 'unsaved' ? '#fcd34d' : '#c7d2fe') + ';border-radius:12px;padding:12px;margin-top:9px">'
      + rxPvBox(look) + '<div style="flex:1 1 240px;min-width:0"><div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px">'
      + '<b style="font-size:14px;color:#0d2240">' + esc2(c.name || '(이름 없음)') + '</b>'
      + '<span class="rx-pvboss" style="font-size:11.5px;color:#6d28d9;font-weight:800">' + esc2(rxBossName(look.boss)) + '</span>'
      + (look.bgKey ? '<span class="rx-pvbg" style="font-size:11px;color:#0e7490;font-weight:800">🏞 ' + esc2(rxBgName(look.bgKey)) + (c.bg ? '' : ' (보스 기본)') + '</span>' : '')
      + rxPvChip(st) + '</div>'
      + '<div style="font-size:12px;color:#64748b;font-weight:700">체력 ' + raceNum(Number(c.hp) || 0) + ' · ' + esc2(rxGrsOf(c).join('·') || '모든 학년') + (c.sch ? ' · ' + esc2(c.sch) : '') + ' — 아직 서버가 세지 않은 레이드입니다(저장 → 다시 세기 뒤 파티 명단이 나옵니다)</div></div></div>';
  });
  return h + '</div>';
}

/* ── ② 저장 안 한 변경 ── */
function rxSnap(){ return JSON.stringify({ r: RX.raids, b: RX.boost }); }
function rxDirty(){ return !!(RX.edit && RX.base && rxSnap() !== RX.base); }
window.rxDirtyPaint = function(){
  var on = rxDirty(), el = document.getElementById('rx-dirty');
  if (el) el.style.display = on ? 'flex' : 'none';
  var hs = document.querySelectorAll('.rx-savehint');
  for (var i = 0; i < hs.length; i++) hs[i].style.visibility = on ? 'visible' : 'hidden';
};
var RX_PV_T = 0;
function rxPvSoon(){
  clearTimeout(RX_PV_T);
  RX_PV_T = setTimeout(function(){
    var el = document.getElementById('rx-pvwrap'); if (!el) return;
    el.innerHTML = rxRaidPreview(); rxPaintSlots(el);
  }, 250);
}
(function(){
  var o = window.rxEdit;
  window.rxEdit = function(on){
    if (!on && rxDirty() && !confirm('저장하지 않은 변경이 있어요.\n닫으면 바꾼 것(보스·배경·체력 등)이 사라집니다. 닫을까요?')) return;
    RX.base = null;
    var r = o.apply(this, arguments);
    if (on && RX.edit) RX.base = rxSnap();
    rxDirtyPaint();
    return r;
  };
})();
(function(){
  var o = window.rxSet;
  window.rxSet = function(path, v){
    var p = String(path).split(':');
    if (p[0] === 'bg'){
      var c = RX.edit && RX.raids && RX.raids[RX.sel]; if (!c) return;
      var k = p.slice(1).join(':');
      if (k) c.bg = k; else delete c.bg;
      render(); return;
    }
    var r = o.apply(this, arguments);
    if (RX.edit){ rxDirtyPaint(); if (/^(name|hp|from|to|sch|showNames)$/.test(p[0])) rxPvSoon(); }
    return r;
  };
})();
function rxSaveRow(id, what){
  return '<div class="rx-saverow" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">'
    + '<button id="' + id + '" onclick="rxSave()" ' + (RX.busy ? 'disabled ' : '') + 'style="' + RX_BTN + ';background:#0d2240;color:#fff">' + (RX.busy ? '⏳ 저장 중…' : '💾 저장') + '</button>'
    + '<span class="rx-savehint" style="font-size:11px;color:#92400e;font-weight:800;visibility:' + (rxDirty() ? 'visible' : 'hidden') + '">고른 ' + what + '는 아래 미리보기에 바로 보입니다 · 💾 저장해야 다음 시즌에 들어갑니다</span></div>';
}
/* ④ 배경 고르기 (레이드마다) */
function rxBgPickHtml(c){
  var bgs = rxLibBgs(), def = rxBossDefaultBg(c.boss), cur = c.bg ? String(c.bg) : '';
  var bossG = rxBossGrid(c.boss);
  var h = '<div style="font-size:11px;color:#64748b;font-weight:800;margin:14px 0 6px">🏞 배경 고르기 <span style="color:#94a3b8">(' + (bgs.length ? '🗃 보관함 배경 ' + bgs.length + '종 · 「보스 기본 배경」은 보스마다 정해 둔 배경' : '보관함에 배경이 아직 없습니다') + ')</span></div>';
  if (!bgs.length) return h + '<div id="rx-bgdex" style="font-size:11.5px;color:#94a3b8;font-weight:700">배경은 Claude 에게 「보스 배경 넣어줘」라고 하면 보관함에 들어갑니다. 지금은 보스만 그립니다.</div>';
  h += '<div id="rx-bgdex" style="display:flex;gap:8px;flex-wrap:wrap">';
  var one = function(key, label, sub, on, g){
    return '<button class="rx-bg" data-bg="' + esc2(key) + '" onclick="rxSet(\'bg:' + esc2(key) + '\')" style="border:2px solid ' + (on ? '#a78bfa' : '#e2e8f0') + ';background:' + (on ? '#f5f3ff' : '#fff') + ';border-radius:11px;padding:6px;cursor:pointer;font-family:inherit;text-align:center;width:144px;box-sizing:border-box">'
      + '<span style="display:block;margin-bottom:4px;background:#0d0a1d;border-radius:6px;line-height:0;min-height:72px">' + (g ? rxStageSlot(g, bossG, 1) : '<span style="display:inline-block;color:#94a3b8;font-size:11px;font-weight:800;line-height:72px">배경 없음</span>') + '</span>'
      + '<b style="font-size:11.5px;font-weight:900;color:' + (on ? '#5b21b6' : '#475569') + '">' + label + '</b>'
      + (sub ? '<span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:800">' + sub + '</span>' : '') + '</button>';
  };
  var dg = rxLibBg(def);
  h += one('', '보스 기본 배경', dg ? esc2(dg.name || dg.key) : '정해 둔 배경 없음', !cur, dg ? rxBgGrid(dg) : null);
  bgs.forEach(function(g){ h += one(g.key, esc2(g.name || g.key), g.key === def ? '이 보스의 기본' : '', cur === g.key, rxBgGrid(g)); });
  return h + '</div>';
}
/* 편집 칸: 보스 고르기 바로 아래에 💾 + 배경 고르기 + 💾 (raid137 의 rxRaidForm 글자 뒤에 끼운다) */
var RX_DEL_MARK = '<div style="margin-top:10px"><button onclick="rxSet(\'del\')"';
function rxRaidForm138(){
  var h = rxRaidForm(), c = RX.raids && RX.raids[RX.sel];
  var i = h.lastIndexOf(RX_DEL_MARK);
  if (!c || i < 0) return h;
  return h.slice(0, i) + rxSaveRow('rx-save-boss', '보스') + rxBgPickHtml(c) + (rxLibBgs().length ? rxSaveRow('rx-save-bg', '배경') : '') + h.slice(i);
}
function rxDirtyBar(){
  return '<div id="rx-dirty" style="position:sticky;top:0;z-index:40;display:' + (rxDirty() ? 'flex' : 'none') + ';align-items:center;gap:10px;flex-wrap:wrap;background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:8px 12px;margin:10px 0 0;box-shadow:0 4px 12px rgba(146,64,14,.15)">'
    + '<b style="font-size:12.5px;color:#92400e">✏️ 저장하지 않은 변경이 있어요</b>'
    + '<span style="font-size:11px;color:#b45309;font-weight:700">미리보기는 바로 바뀌지만, 저장해야 다음 시즌에 들어갑니다</span>'
    + '<button id="rx-dirty-save" onclick="rxSave()" ' + (RX.busy ? 'disabled ' : '') + 'style="margin-left:auto;' + RX_BTN + ';background:#0d2240;color:#fff">' + (RX.busy ? '⏳ 저장 중…' : '💾 저장') + '</button></div>';
}
/* raid137 의 rxRaidSec 를 다시 정의 — 저장 안 함 띠 · 배경 칩 · 미리보기 감싸기(타자 칠 때 미리보기만 다시 그림) */
function rxRaidSec(){
  var s = RNX.season || {};
  var raids = RX.edit ? RX.raids : (Array.isArray(s.raids) ? s.raids : []);
  /* 저장 안 함 띠는 카드(#rnx-card) 바로 아래 자식 → 아래 «🔥 추가 버프» 칸까지 내려가도 위에 붙어 있다 */
  var h = (RX.edit ? rxDirtyBar() : '') + '<div id="rx-raid" style="border-top:1.5px dashed #c7d2fe;margin-top:14px;padding-top:12px">';
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<div style="font-size:14px;font-weight:900;color:#3b1a5e">⚔️ 보스 레이드 <span style="font-size:11.5px;color:#7c3aed;font-weight:800">다음 시즌 · 레이스와 같은 날부터 셉니다</span></div>'
    + '<span style="margin-left:auto;display:flex;gap:7px;flex-wrap:wrap">'
    + (RX.edit ? '' : '<button id="rx-edit" onclick="rxEdit(true)" style="' + RX_BTN + ';background:#fff;color:#3b1a5e;border:1.5px solid #ddd6fe">✏️ 레이드·버프 고치기</button>')
    + '<button id="rx-lib-open" onclick="rxLibOpen()" style="' + RX_BTN + ';background:#241c56;color:#fff">🗃 보스 보관함</button></span></div>';
  if (!RX.edit){
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    if (!raids.length) h += '<span style="font-size:12px;color:#94a3b8;font-weight:700">아직 레이드가 없습니다 — 「✏️ 레이드·버프 고치기」 → 「+ 레이드」</span>';
    raids.forEach(function(r){
      var bk = rxCfgBgKey(r);
      h += rxChip((r.on ? '⚔️ ' : '⏸ ') + esc2(r.name || '') + ' · ' + esc2(rxBossName(r.boss)) + (bk ? ' · 🏞 ' + esc2(rxBgName(bk)) : '') + ' · ' + esc2(rxGrsOf(r).join('·') || '모든 학년') + (r.sch ? ' · ' + esc2(r.sch) : '') + ' · 체력 ' + raceNum(r.hp || 0) + (r.hideSch ? ' · 🙈' : ''), r.on ? '#f5f3ff' : '#f1f5f9', r.on ? '#5b21b6' : '#94a3b8');
    });
    h += '</div>';
  } else h += rxRaidForm138();
  h += '<div id="rx-pvwrap">' + rxRaidPreview() + '</div>';
  return h + '</div>';
}

/* ══ ③ 📣 공개 — 다음 시즌 설정을 레이드 id 마다 다시 입힌다 (순수 함수: 검사에서 그대로 부른다) ══ */
window.rxApplyCfg = function(rbd, raids, lib, today){
  if (!rbd || typeof rbd !== 'object' || !Array.isArray(rbd.list)) return rbd;
  var out = rnxClone(rbd); today = today || rxTodayK();
  var bosses = (lib && Array.isArray(lib.bosses)) ? lib.bosses : [], bgs = (lib && Array.isArray(lib.bgs)) ? lib.bgs : [];
  var find = function(a, k){ return k ? (a.filter(function(b){ return b && b.key === k; })[0] || null) : null; };
  var byId = {}; (raids || []).forEach(function(r){ if (r && r.id) byId[r.id] = r; });
  out.list = out.list.filter(function(x){ var c = x && byId[x.id]; return !!x && !(c && c.on === false); }).map(function(x){
    var c = byId[x.id]; if (!c) return x;
    var oldBoss = x.boss, oldHp = Number(x.hp) || 0, oldTo = x.to;
    if (String(c.name || '').trim()) x.name = String(c.name);
    if (c.boss) x.boss = String(c.boss);
    if (Number(c.hp) > 0) x.hp = Math.round(Number(c.hp));
    if (rnxIsDate(c.from)) x.from = c.from;
    if (rnxIsDate(c.to)) x.to = c.to;
    if (c.hideSch){ x.hideSch = true; (x.rows || []).forEach(function(r){ r.sch = ''; r.gr = ''; }); } else delete x.hideSch;
    var b = find(bosses, x.boss);
    if (b && Array.isArray(b.rows) && Array.isArray(b.pal)) x.art = { name: b.name || '', w: b.w, h: b.h, pal: b.pal, rows: b.rows };
    else if (x.boss !== oldBoss) delete x.art;
    var bk = c.bg ? String(c.bg) : ((b && b.bg) ? String(b.bg) : '');
    var g = find(bgs, bk);
    if (g && Array.isArray(g.rows) && Array.isArray(g.pal)) x.bgArt = { key: g.key, name: g.name || '', w: g.w, h: g.h, floor: 58, pal: g.pal, rows: g.rows };
    else if (lib && !(bk && x.bgArt && x.bgArt.key === bk)) delete x.bgArt;
    var dealt = Number(x.dealt) || 0, hp = Math.max(1, Number(x.hp) || 1);
    x.left = Math.max(0, hp - dealt); x.pct = Math.min(100, Math.round(dealt / hp * 1000) / 10); x.cleared = dealt >= hp;
    if (hp !== oldHp) x.eta = ((Number(x.daysIn) || 0) >= 4 && Number(x.perDay) > 0) ? rxAddDays(today, Math.ceil(x.left / Number(x.perDay))) : null;
    if (x.to !== oldTo) x.dday = Math.round((Date.parse(x.to) - Date.parse(today)) / 86400000);
    return x;
  });
  return out;
};
window.rnxPublish = async function(){
  if (RNX.busy) return;
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  var m;
  try { m = await rnxGet(sb, ['race_season', 'race_board', 'race_history', 'race_season_draft', 'race_board_draft', 'race_watch_draft', 'raid_board_draft', 'raid_boss_lib']); }
  catch(e){ plToast('불러오기 실패: ' + (e.message || e)); return; }
  var live = m.race_season, lb = m.race_board, d = m.race_season_draft, db = m.race_board_draft;
  if (m.raid_boss_lib) rxSetLib(m.raid_boss_lib);
  if (!d){ plToast('다음 시즌이 없습니다'); return; }
  if (!db || !db.at || db.seasonId !== d.id){ plToast('아직 서버가 이 시즌을 세지 않았습니다 — 「🔄 다시 세기 요청」 뒤 순위가 나오면 공개해 주세요'); return; }
  if (live && live.id && live.id === d.id){ plToast('다음 시즌 id 가 지금 시즌과 같아 공개할 수 없습니다'); return; }
  if (d.updated && db.seasonUpdated !== undefined && db.seasonUpdated !== d.updated && !confirm('설정을 바꾼 뒤 아직 다시 세지 않은 순위표입니다. 그래도 공개할까요? (공개 뒤 서버가 곧 다시 셉니다)')) return;
  /* ★ v19-138: 다시 세기 전이어도 마지막으로 저장한 레이드 설정(보스·배경·이름·체력…)을 입혀서 공개 */
  var rbd = rxApplyCfg(m.raid_board_draft, Array.isArray(d.raids) ? d.raids : [], m.raid_boss_lib || null);
  var raidOn = !!(rbd && rbd.on !== false && Array.isArray(rbd.list) && rbd.list.length);
  var raidTxt = raidOn
    ? '· ⚔️ 보스 레이드 ' + rbd.list.length + '개가 함께 공개됩니다:\n' + rbd.list.map(function(x){
        return '   - 「' + (x.name || '') + '」 보스 ' + rxBossName(x.boss, x.art) + (x.bgArt ? ' · 배경 ' + (x.bgArt.name || x.bgArt.key) : '') + ' · 체력 ' + raceNum(x.hp) + ' · ' + ((x.grs || []).join('·') || '모든 학년') + (x.hideSch ? ' (학교·학년 가림)' : '');
      }).join('\n') + '\n' + ((d.updated && rbd.at && Date.parse(rbd.at) < Date.parse(d.updated)) ? '   (피해 숫자는 설정을 바꾸기 전 계산입니다 — 보스·배경·체력은 새 설정으로 나가고, 공개 뒤 서버가 다시 셉니다)\n' : '')
    : '· 보스 레이드는 꺼집니다 (다음 시즌에 켜진 레이드가 없습니다).\n';
  var msg = '📣 「' + (d.name || '다음 시즌') + '」을 학생앱·학부모앱에 공개할까요?\n\n'
    + '· 학생앱 진도 레이스 화면의 지난 시즌' + (live ? ' 「' + (live.name || '') + '」' : '') + ' 결과(순위·시상 화면)가 이 새 시즌으로 바뀝니다.\n'
    + '· 지난 시즌 결과는 「지난 시즌 보관함(race_history)」에 남습니다(없으면 지금 담습니다).\n'
    + raidTxt
    + '· 되돌리려면 Claude 에게 부탁해야 합니다.';
  if (!confirm(msg)) return;
  RNX.busy = true; render();
  var step = '';
  try {
    var now = rxNow();
    step = '지난 시즌 보관';
    if (live && live.id){
      var hist = m.race_history || {};
      hist.seasons = Array.isArray(hist.seasons) ? hist.seasons : [];
      if (!hist.seasons.some(function(x){ return x && x.seasonId === live.id; })){
        hist.seasons.unshift(rnxArchiveEntry(live, lb));
        hist.seasons = hist.seasons.slice(0, 12); hist.updated = now;
        await rnxPut(sb, 'race_history', hist);
      }
    }
    step = '시즌 설정(race_season)';
    var ns = rnxClone(d); ns.open = true; ns.publishedAt = now; ns.updated = now; delete ns.paused;
    await rnxPut(sb, 'race_season', ns);
    step = '순위표(race_board)';
    var nb = rnxClone(db); nb.open = true; nb.publishedAt = now; delete nb.draft; delete nb.seasonUpdated;
    await rnxPut(sb, 'race_board', nb);
    step = '이상 신호·레이드';
    await rnxPut(sb, 'race_watch', m.race_watch_draft || { at: now, seasonId: d.id, items: [] });
    var nr = { at: now, on: false, list: [] };
    if (raidOn){ nr = rnxClone(rbd); nr.at = now; nr.on = true; nr.publishedAt = now; delete nr.draft; }
    await rnxPut(sb, 'raid_board', nr);
    step = '다음 시즌 키 지우기';
    await rnxDel(sb, 'race_season_draft');
    await rnxDel(sb, 'race_board_draft');
    await rnxDel(sb, 'race_watch_draft');
    await rnxDel(sb, 'raid_board_draft');
    RACE.season = ns; RACE.board = nb; RACE.watch = m.race_watch_draft || null; RACE.edit = false;
    try { if (window.SEA_T) { SEA_T.open = false; SEA_T.draft = null; } } catch(e){}
    try { if (window.RAID){ RAID.board = raidOn ? nr : null; RAID.sel = 0; RAID.loaded = true; } } catch(e){}
    RNX.season = null; RNX.board = null; RNX.edit = false; RNX.f = null;
    RX.rbd = null; RX.edit = false; RX.raids = null; RX.boost = null; RX.base = null;
    await rnxRequestRecount(true);
    plToast('📣 공개했습니다 — 학생앱 진도 레이스가 「' + (ns.name || '') + '」으로 바뀝니다' + (raidOn ? ' · ⚔️ 보스 레이드 ' + nr.list.length + '개 함께' : ''));
  } catch(e){
    plToast('공개 중 멈춤 (' + step + '): ' + (e.message || e) + ' — 화면을 새로 고친 뒤 상태를 확인해 주세요');
  }
  RNX.busy = false; render();
};

/* ══ ④ 🗃 보스 보관함 — 🏞 배경 칸 · 보스마다 기본 배경 (그린 뒤 끼워 넣는다) ══ */
function rxBgUsers(key){
  return rxLibBosses().filter(function(b){ return b.bg === key; }).map(function(b){ return b.name + (rxIsShade(b) ? '(명암)' : ''); });
}
function rxLibBgDecorate(){
  if (!RXL.open || RXL.view !== 'list' || !RXL.loaded || !RXL.lib) return;
  var box = document.getElementById('rxlib-box'); if (!box) return;
  var bgs = rxLibBgs();
  var cards = box.querySelectorAll('.rxl-card');
  for (var i = 0; i < cards.length; i++){
    var card = cards[i], key = card.getAttribute('data-key'), b = rxLibBoss(key);
    if (!b || card.querySelector('.rxl-bg')) continue;
    var cur = b.bg ? String(b.bg) : '', g = rxLibBg(cur);
    var d = document.createElement('div');
    d.className = 'rxl-bg';
    d.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;font-weight:800;color:#0e7490';
    var h = (g ? '<span style="line-height:0;border-radius:4px;overflow:hidden;width:64px;flex:0 0 64px">' + rxStageSlot(rxBgGrid(g), null, 1, 'rxl-bgthumb') + '</span>' : '')
      + '<span class="rxl-bgname">🏞 기본 배경: <b>' + esc2(g ? (g.name || g.key) : (cur ? cur + ' (보관함에 없음)' : '없음')) + '</b>' + (b.bgSet ? ' <span style="color:#a21caf">· 원장님이 고름</span>' : '') + '</span>';
    if (bgs.length) h += '<select class="rxl-bgsel" onchange="rxLibSetBg(\'' + esc2(key) + '\',this.value)" ' + (RXL.busy ? 'disabled ' : '') + 'style="margin-left:auto;padding:3px 6px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:800;font-family:inherit;max-width:100%">'
      + (cur && !g ? '<option value="" selected>바꾸기…</option>' : (!cur ? '<option value="" selected>고르기…</option>' : ''))
      + bgs.map(function(x){ return '<option value="' + esc2(x.key) + '"' + (x.key === cur ? ' selected' : '') + '>' + esc2(x.name || x.key) + '</option>'; }).join('') + '</select>';
    d.innerHTML = h;
    var body = card.lastElementChild;
    if (body && body.lastElementChild) body.insertBefore(d, body.lastElementChild); else card.appendChild(d);
  }
  if (!document.getElementById('rxl-bgs')){
    var sec = document.createElement('div'); sec.id = 'rxl-bgs'; sec.style.cssText = 'margin-top:18px;border-top:1.5px dashed #a5f3fc;padding-top:12px';
    var s = '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div style="font-size:15px;font-weight:900;color:#155e75">🏞 배경</div>'
      + '<span style="font-size:11.5px;color:#64748b;font-weight:700">' + (bgs.length ? bgs.length + '종 · 128×72 도트 · 레이드 카드 무대에 깔리고 보스는 바닥(64번째 줄)에 섭니다. 보스마다 기본 배경은 위 카드의 「🏞 기본 배경」에서 바꿉니다.' : '아직 없습니다 — Claude 에게 「보스 배경 넣어줘」(서버 도구 boss_lib.js --seed)') + '</span></div>';
    if (bgs.length){
      s += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:11px">';
      bgs.forEach(function(g){
        var us = rxBgUsers(g.key);
        s += '<div class="rxl-bgcard" data-key="' + esc2(g.key) + '" style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden">'
          + '<div style="background:#0d0a1d;line-height:0;text-align:center">' + rxStageSlot(rxBgGrid(g), null, 2) + '</div>'
          + '<div style="padding:8px 11px;display:flex;flex-direction:column;gap:3px"><div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap"><b style="font-size:13px;color:#0d2240">' + esc2(g.name || g.key) + '</b><span style="font-size:10.5px;color:#94a3b8;font-weight:700">' + esc2(g.key) + ' · ' + (Number(g.w) || 0) + ' x ' + (Number(g.h) || 0) + '</span></div>'
          + (g.desc ? '<div style="font-size:10.5px;color:#64748b;font-weight:700">' + esc2(g.desc) + '</div>' : '')
          + '<div style="font-size:10.5px;color:#0e7490;font-weight:800">' + (us.length ? '기본 배경으로 쓰는 보스: ' + esc2(us.join(' · ')) : '기본 배경으로 쓰는 보스 없음') + '</div></div></div>';
      });
      s += '</div>';
    }
    sec.innerHTML = s; box.appendChild(sec);
  }
  rxPaintSlots(box);
}
(function(){
  var o = window.rxLibRender;
  window.rxLibRender = function(){
    var r = o.apply(this, arguments);
    try { rxLibBgDecorate(); } catch(e){ console.warn('[보관함 배경]', e); }
    return r;
  };
})();
/* 보스 기본 배경 바꾸기 — 서버 보관함을 새로 읽고 그 보스의 bg 만 바꿔 통째로 쓴다(모르는 칸 · Claude 보스 · bgs 그대로) */
window.rxLibSetBg = async function(key, bg){
  if (!bg || RXL.busy) return;
  var b = rxLibBoss(key), g = rxLibBg(bg);
  RXL.busy = true;
  try {
    await rxLibRMW(function(cur){
      var x = cur.bosses.filter(function(q){ return q && q.key === key; })[0];
      if (!x) throw new Error('보관함에 없는 보스입니다 (' + key + ')');
      if (!(Array.isArray(cur.bgs) && cur.bgs.some(function(q){ return q && q.key === bg; }))) throw new Error('보관함에 없는 배경입니다 (' + bg + ')');
      x.bg = bg; x.bgSet = true;
      return true;
    });
    plToast('🏞 「' + ((b && b.name) || key) + '」 기본 배경을 「' + ((g && g.name) || bg) + '」으로 바꿨습니다 — 미리보기엔 바로, 학생앱엔 서버가 다시 세거나 공개할 때 들어갑니다');
  } catch(e){ plToast('배경 바꾸기 실패: ' + (e.message || e)); }
  RXL.busy = false; rxLibRender(); if (VIEW === 'race') render();
};
