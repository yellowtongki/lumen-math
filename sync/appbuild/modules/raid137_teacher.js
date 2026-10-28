/* ══════════════════════════════════════════════════════════════════════════
 * v19-137: ⚔️ 다음 시즌 보스 레이드 · 🔥 학교별 시험 2주 전 버프 · 🗃 보스 보관함 (꾸미기)
 *   원장 결정 2026-10-18: 「보스 넣어 · 중고등부 학년통합 · 2주 전 버프 · 초6 버프 줘 · 보관함은 둘 다(꾸미기 + Claude 그리기)」
 *   계약서 docs/raid_s2_contract.md §1~§5 — 이 부품이 §5.
 *
 *   ① 「🆕 다음 시즌」 카드 안 «⚔️ 보스 레이드» 칸 — race_season_draft.raids 편집 + 서버가 센 raid_board_draft 미리보기
 *   ② «🔥 추가 버프 기간» 칸 — race_season_draft.buff.boost(on·flat·max·windows) 편집 + 「📅 학교 시험 일정으로 채우기」
 *      (lumen_store school_calendar 의 「2학기 기말」 시작 14일 전 ~ 마지막 날, 학년 지정 반영)
 *      ★ ①② 저장(rxSave)은 서버의 race_season_draft 를 «새로 읽어» raids · buff.boost 만 바꿔 쓴다(다른 칸·모르는 칸 그대로)
 *        → 다시 세기 요청(rnxRequestRecount). 학생앱 키는 건드리지 않는다.
 *   ③ 🗃 보스 보관함 (lumen_store raid_boss_lib) — 다음 시즌 카드와 지금 시즌 레이드 칸에서 연다.
 *      보관함이 없으면 앱 코드의 RAIDART.BOSSES 6종으로 「보관함 만들기」. 꾸미기 → 새 보스(key t_YYYYMMDD_N, by:'teacher').
 *      ★ 보관함 쓰기는 언제나 서버 것을 새로 읽고 → 내 것만 넣고/빼고 → 통째로 쓴다(Claude 가 넣은 by:'claude' 보스·모르는 칸을 지우지 않게).
 *      기본 6종(by:'builtin')은 못 지운다.
 *   ④ 「📣 학생앱에 공개」(rnxPublish 바꿈, 계약서 §3) — raid_board_draft 가 켜져 있으면 raid_board 로 복사(at 새로), 없으면 꺼짐.
 *      공개 뒤 raid_board_draft 도 지운다.
 *
 *   그림 글자표(계약서 §4): rows[y][x] 한 글자 = pal 번호, BOSS_CH 62글자, '.' = 투명. 테두리까지 칠해진 완성 그림.
 * ══════════════════════════════════════════════════════════════════════════ */
window.RX = { edit: false, raids: null, boost: null, sel: 0, busy: false, loading: false, at: 0, err: '',
  rbd: null, lib: null, libLoaded: false, slots: {}, n: 0, gcache: {} };
var BOSS_CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var RX_OUT = '#120e22';
var RX_GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
var RX_EXAM_LABEL = '2학기 기말';
var RX_BTN = 'padding:7px 13px;border-radius:9px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;border:none';

/* ── 작은 도구 ── */
function rxNow(){ return new Date().toISOString(); }
function rxTodayK(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function rxAddDays(d, n){ var t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? '' : new Date(t + n * 86400000).toISOString().slice(0, 10); }
function rxMD(d){ return String(d || '').slice(5).replace('-', '/'); }
function rxHex(c){
  var s = String(c || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2) + s.charAt(3) + s.charAt(3);
  return /^#[0-9a-f]{6}$/.test(s) ? s : '#000000';
}
function rxRgb(c){ var h = rxHex(c); return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rxToHex(r, g, b){
  var f = function(v){ v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
  return '#' + f(r) + f(g) + f(b);
}
/* 색조 돌리기 — 회색(채도 0)은 그대로 */
window.rxHueRot = function(c, deg){
  deg = Number(deg) || 0; if (!deg) return c;
  var p = rxRgb(c), r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return c;
  var s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn), h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = ((h * 60 + deg) % 360 + 360) % 360 / 360;
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
  var hu = function(t){ if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return pp + (q - pp) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6; return pp; };
  return rxToHex(hu(h + 1 / 3) * 255, hu(h) * 255, hu(h - 1 / 3) * 255);
};

/* ── 🗃 그림 글자표: 격자(색 글자 또는 null) ↔ {w,h,pal,rows} ── */
window.rxEncodeGrid = function(grid){
  var h = grid.length, w = 0, y, x, c;
  for (y = 0; y < h; y++) w = Math.max(w, (grid[y] || []).length);
  var pal = [], idx = {}, cnt = {};
  for (y = 0; y < h; y++) for (x = 0; x < w; x++){
    c = (grid[y] || [])[x]; if (!c) continue;
    if (!(c in idx)){ idx[c] = pal.length; pal.push(c); cnt[c] = 0; }
    cnt[c]++;
  }
  var map = {};
  if (pal.length > BOSS_CH.length){
    /* 62색이 넘으면 많이 쓴 62색만 남기고 나머지는 가장 가까운 색으로 */
    var keep = pal.slice().sort(function(a, b){ return cnt[b] - cnt[a]; }).slice(0, BOSS_CH.length);
    var kset = {}; keep.forEach(function(k){ kset[k] = 1; });
    var np = pal.filter(function(k){ return kset[k]; });
    pal.forEach(function(k){
      if (kset[k]) return;
      var a = rxRgb(k), best = np[0], bd = 1e9;
      np.forEach(function(q){ var t = rxRgb(q), dd = (a[0] - t[0]) * (a[0] - t[0]) + (a[1] - t[1]) * (a[1] - t[1]) + (a[2] - t[2]) * (a[2] - t[2]); if (dd < bd){ bd = dd; best = q; } });
      map[k] = best;
    });
    pal = np; idx = {}; pal.forEach(function(k, i){ idx[k] = i; });
  }
  var rows = [];
  for (y = 0; y < h; y++){
    var s = '';
    for (x = 0; x < w; x++){ c = (grid[y] || [])[x]; s += c ? BOSS_CH.charAt(idx[map[c] || c]) : '.'; }
    rows.push(s);
  }
  return { w: w, h: h, pal: pal, rows: rows };
};
window.rxDecodeArt = function(a){
  if (!a || !Array.isArray(a.rows) || !Array.isArray(a.pal)) return null;
  var w = Number(a.w) || 0;
  a.rows.forEach(function(r){ w = Math.max(w, String(r).length); });
  return a.rows.map(function(r){
    var row = [];
    for (var x = 0; x < w; x++){
      var ch = String(r).charAt(x), i = ch && ch !== '.' ? BOSS_CH.indexOf(ch) : -1;
      row.push(i >= 0 && a.pal[i] ? a.pal[i] : null);
    }
    return row;
  });
};
/* 앱 코드의 기본 6종(RAIDART.BOSSES) → 보관함 */
window.rxLibFromArt = function(now){
  now = now || rxNow();
  var A = window.RAIDART, out = { v: 1, updated: now, bosses: [] };
  ((A && A.BOSSES) || []).forEach(function(x){
    if (!x || !x.grid) return;
    var e = rxEncodeGrid(x.grid);
    out.bosses.push({ key: x.key, name: x.name || x.key, en: x.en || '', tag: x.tag || (e.w + ' x ' + e.h), desc: x.desc || '',
      w: e.w, h: e.h, pal: e.pal, rows: e.rows, by: 'builtin', base: null, created: now, log: [] });
  });
  return out;
};
function rxSetLib(v){ RX.lib = (v && typeof v === 'object' && Array.isArray(v.bosses)) ? v : null; RX.libLoaded = true; RX.gcache = {}; }
function rxLibBosses(){ return RX.lib ? RX.lib.bosses.filter(function(b){ return b && b.key && Array.isArray(b.rows) && Array.isArray(b.pal); }) : []; }
function rxArtBoss(key){ var A = window.RAIDART; return A ? (A.BOSSES.filter(function(x){ return x.key === key; })[0] || null) : null; }
/* 보관함이 없을 때: 명암 판(…_rm)은 원본 그림으로라도 보여 준다 */
function rxArtFallback(key){ return rxArtBoss(key) || (/_rm$/.test(String(key || '')) ? rxArtBoss(String(key).replace(/_rm$/, '')) : null); }
function rxLibBoss(key){ return rxLibBosses().filter(function(b){ return b.key === key; })[0] || null; }
/* 보스 그림 격자: 순위판 art → 보관함 → 앱 코드 RAIDART */
window.rxBossGrid = function(key, art){
  if (art && Array.isArray(art.rows) && Array.isArray(art.pal)) return rxDecodeArt(art);
  var b = rxLibBoss(key);
  if (b){
    var c = RX.gcache[key];
    if (!c || c.src !== b.rows){ c = RX.gcache[key] = { src: b.rows, g: rxDecodeArt(b) }; }
    return c.g;
  }
  var x = rxArtFallback(key);
  return x ? x.grid : null;
};
function rxBossName(key, art){
  var b = rxLibBoss(key);
  if (art && art.name) return art.name + (rxIsShade(b) || /_rm$/.test(String(key || '')) ? ' (명암 판)' : '');
  if (b && b.name) return b.name + (rxIsShade(b) ? ' (명암 판)' : '');
  var x = rxArtFallback(key); return x ? x.name + (x.key !== key ? ' (명암 판)' : '') : String(key || '?');
}
/* 고를 수 있는 보스 — 보관함이 있으면 보관함, 없으면 앱 코드 6종 */
function rxPickList(){
  var L = rxLibBosses();
  if (L.length) return L.map(function(b){ return { key: b.key, name: b.name || b.key, by: b.by || '', base: b.base || '', shade: rxIsShade(b) }; });
  var A = window.RAIDART;
  return ((A && A.BOSSES) || []).map(function(x){ return { key: x.key, name: x.name, by: 'builtin' }; });
}
/* Claude 가 명암을 넣어 다시 그린 판 (key …_rm · tag «· 명암 판») — 이름이 원본과 같아 따로 표시한다 */
function rxIsShade(b){ return !!b && (/명암/.test(String(b.tag || '')) || /_rm$/.test(String(b.key || ''))); }
function rxPickLabel(x){ return x.name + (x.shade ? ' (명암 판)' : ''); }
function rxIsBuiltin(b){ return !!b && (b.by === 'builtin' || (!b.by && !!rxArtBoss(b.key))); }
var RX_BY = { builtin: '기본 보스', claude: '🤖 Claude 그림', teacher: '🎨 원장님 꾸미기' };

/* ── 캔버스 자리: innerHTML 로는 못 넣으니 자리만 두고 그린 뒤 꽂는다 ── */
function rxSlot(grid, px){
  if (!grid || !grid.length) return '<span style="display:inline-block;color:#94a3b8;font-size:11px;font-weight:800;padding:20px 8px">그림 없음</span>';
  var id = 's' + (++RX.n); RX.slots[id] = { g: grid, px: px || 100 };
  return '<span class="rx-art" data-rx="' + id + '" style="display:inline-block;line-height:0"></span>';
}
window.rxPaintSlots = function(root){
  var A = window.RAIDART; if (!A || !A.cvOf) return;
  var els = (root || document).querySelectorAll('.rx-art[data-rx]');
  for (var i = 0; i < els.length; i++){
    var el = els[i]; if (el.getAttribute('data-done')) continue;
    var s = RX.slots[el.getAttribute('data-rx')]; if (!s) continue;
    var g = s.g, big = Math.max(g.length, (g[0] || []).length) || 1;
    var cv = A.cvOf(g, Math.max(1, Math.floor(s.px / big)));
    el.innerHTML = ''; el.appendChild(cv); el.setAttribute('data-done', '1');
  }
};

/* ── 서버 읽기 (raid_board_draft · raid_boss_lib) — 다음 시즌 읽기(rnxLoad) 뒤에 같이 ── */
window.rxLoad = async function(){
  if (RX.loading) return;
  var sb = getSupaClient(); if (!sb) return;
  RX.loading = true;
  try {
    var m = await rnxGet(sb, ['raid_board_draft', 'raid_boss_lib']);
    RX.rbd = m.raid_board_draft || null; rxSetLib(m.raid_boss_lib || null); RX.err = '';
  } catch(e){ RX.err = e.message || String(e); console.warn('[레이드 다음 시즌] 불러오기 실패', e); }
  RX.loading = false; RX.at = Date.now();
  if (VIEW === 'race') render();
};
(function(){
  var o = window.rnxLoad;
  if (typeof o === 'function') window.rnxLoad = async function(force){
    var r = await o.apply(this, arguments);
    if (force || !RX.at) await rxLoad();
    return r;
  };
})();

/* ══ ② 학교 시험 일정 → 버프 기간 (순수 함수: 검사에서 그대로 부른다) ══
 *   school_calendar.schools[].exams[] 중 label 에 「2학기 기말」 → {sch: 학교 짧은 이름, grs: 학년(지정 없으면 []), from: 시작 14일 전, to: 마지막 날} */
window.rxWindowsFromCal = function(cal, label){
  label = label || RX_EXAM_LABEL;
  var out = [], seen = {};
  ((cal && cal.schools) || []).forEach(function(sc){
    if (!sc) return;
    var nm = String(sc.name || sc.short || '').trim(), key = rnxSchoolKey(nm);
    if (!key) return;
    var kind = sc.kind || (/고등학교$/.test(nm) ? '고' : /중학교$/.test(nm) ? '중' : /초등학교$/.test(nm) ? '초' : (/고$/.test(key) ? '고' : /중$/.test(key) ? '중' : ''));
    if (kind === '초') return;
    (sc.exams || []).forEach(function(e){
      if (!e || String(e.label || '').indexOf(label) < 0 || !rnxIsDate(e.from) || !rnxIsDate(e.to)) return;
      var grs = (Array.isArray(e.grades) && e.grades.length) ? e.grades.map(function(n){ var d = String(n).replace(/[^0-9]/g, ''); return d && kind ? kind + d : String(n); }) : [];
      var w = { sch: key, grs: grs, from: rxAddDays(e.from, -14), to: e.to };
      var k = w.sch + '|' + grs.join(',') + '|' + w.from + '|' + w.to;
      if (seen[k]) return; seen[k] = 1; out.push(w);
    });
  });
  out.sort(function(a, b){ return a.from < b.from ? -1 : a.from > b.from ? 1 : (a.sch < b.sch ? -1 : a.sch > b.sch ? 1 : 0); });
  return out;
};
/* 학교 일정에서 만든 학교의 줄만 바꾸고, 다른 줄(초6 같은 손으로 넣은 줄)은 뒤에 그대로 남긴다 */
window.rxMergeWindows = function(old, gen){
  var ks = {}; (gen || []).forEach(function(w){ ks[w.sch] = 1; });
  var keep = (old || []).filter(function(w){ return w && !ks[String(w.sch || '').trim()]; });
  return (gen || []).concat(keep);
};
window.rxFillFromCal = async function(){
  if (!RX.edit || !RX.boost) return;
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  var cal;
  try { cal = (await rnxGet(sb, ['school_calendar'])).school_calendar; } catch(e){ plToast('학교 시험 일정 불러오기 실패: ' + (e.message || e)); return; }
  if (!cal || !cal.schools){ plToast('학교 시험 일정(학원 달력 · school_calendar)이 서버에 없습니다'); return; }
  var gen = rxWindowsFromCal(cal);
  if (!gen.length){ plToast('학교 시험 일정에 「' + RX_EXAM_LABEL + '」 시험이 없습니다'); return; }
  var old = RX.boost.windows || [];
  if (old.length && !confirm('📅 학교 시험 일정으로 채울까요?\n\n· 일정에 있는 학교(' + gen.map(function(w){ return w.sch; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join('·') + ') 줄은 새로 바꿉니다 (' + gen.length + '줄)\n· 다른 줄(초6 등 손으로 넣은 줄)은 그대로 남깁니다\n· 저장을 눌러야 서버에 들어갑니다')) return;
  RX.boost.windows = rxMergeWindows(old, gen);
  plToast('📅 ' + gen.length + '줄을 채웠습니다 (시험 시작 14일 전 ~ 마지막 날) — 확인 뒤 💾 저장해 주세요');
  render();
};

/* ══ ①② 편집 — 작업 사본(RX.raids · RX.boost)을 고치고 「💾 레이드·버프 저장」 ══ */
function rxNewRaid(s){
  return { id: 'r' + Date.now().toString(36), on: true, name: '새 레이드', boss: 'golem', grs: [], sch: '',
    hp: 30000, from: (s && s.from) || rxTodayK(), to: (s && s.to) || '', showNames: 3 };
}
function rxGrsOf(c){ return (Array.isArray(c.grs) && c.grs.length) ? c.grs : (c.gr ? [String(c.gr)] : []); }
window.rxEdit = function(on){
  if (on){
    var s = RNX.season || {};
    RX.raids = rnxClone(Array.isArray(s.raids) ? s.raids : (s.raid ? [s.raid] : [])) || [];
    RX.raids.forEach(function(r, i){ if (!r.id) r.id = 'r' + i; });
    var bz = (s.buff && s.buff.boost) || null;
    RX.boost = bz ? rnxClone(bz) : { on: false, flat: 1.3, max: 1 };
    RX.boost.windows = Array.isArray(RX.boost.windows) ? RX.boost.windows : [];
    RX.sel = 0;
  } else { RX.raids = null; RX.boost = null; }
  RX.edit = !!on; render();
};
window.rxSet = function(path, v){
  if (!RX.edit) return;
  var p = String(path).split(':'), k = p[0], i = Number(p[1]), re = false;
  var c = RX.raids && RX.raids[RX.sel], W = RX.boost && RX.boost.windows;
  if (k === 'sel'){ RX.sel = i; re = true; }
  else if (k === 'add'){ RX.raids.push(rxNewRaid(RNX.season)); RX.sel = RX.raids.length - 1; re = true; }
  else if (k === 'del'){ if (c && confirm('「' + (c.name || '') + '」 레이드를 지울까요?\n(💾 저장을 눌러야 실제로 지워집니다)')){ RX.raids.splice(RX.sel, 1); RX.sel = 0; re = true; } }
  else if (c && k === 'on'){ c.on = !!v; re = true; }
  else if (c && k === 'name') c.name = String(v || '');
  else if (c && k === 'boss'){ c.boss = p[1]; re = true; }
  else if (c && k === 'gr'){
    var g = rxGrsOf(c).slice(), j = g.indexOf(p[1]);
    if (j >= 0) g.splice(j, 1); else g.push(p[1]);
    g.sort(function(a, b){ return RX_GRADES.indexOf(a) - RX_GRADES.indexOf(b); });
    c.grs = g; delete c.gr; re = true;
  }
  else if (c && k === 'sch') c.sch = String(v || '').trim();
  else if (c && k === 'hp') c.hp = Math.max(0, Math.round(Number(v) || 0));
  else if (c && k === 'from') c.from = String(v || '').slice(0, 10);
  else if (c && k === 'to') c.to = String(v || '').slice(0, 10);
  else if (c && k === 'showNames') c.showNames = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
  else if (c && k === 'hideSch'){ if (v) c.hideSch = true; else delete c.hideSch; re = true; }
  else if (k === 'bon'){ RX.boost.on = !!v; re = true; }
  else if (k === 'bflat'){ RX.boost.flat = Number(v) || 1; re = true; }
  else if (k === 'bmax'){ RX.boost.max = Number(v) || 0.4; re = true; }
  else if (W && k === 'wsch') W[i].sch = String(v || '').trim();
  else if (W && k === 'wgrs') W[i].grs = String(v || '').split(/[,+·\s]+/).filter(Boolean);
  else if (W && k === 'wfrom') W[i].from = String(v || '').slice(0, 10);
  else if (W && k === 'wto') W[i].to = String(v || '').slice(0, 10);
  else if (W && k === 'wadd'){ W.push({ sch: '', grs: [], from: '', to: '' }); re = true; }
  else if (W && k === 'wdel'){ W.splice(i, 1); re = true; }
  else if (W && k === 'wup' && i > 0){ var t = W[i]; W[i] = W[i - 1]; W[i - 1] = t; re = true; }
  else if (W && k === 'wdown' && i < W.length - 1){ var t2 = W[i]; W[i] = W[i + 1]; W[i + 1] = t2; re = true; }
  if (re) render();
};
function rxCheck(){
  for (var i = 0; i < RX.raids.length; i++){
    var r = RX.raids[i], nm = '「' + (r.name || (i + 1) + '번째') + '」 ';
    if (!String(r.name || '').trim()) return (i + 1) + '번째 레이드 이름을 적어 주세요';
    if (!r.boss) return nm + '보스를 골라 주세요';
    if (!(Number(r.hp) > 0)) return nm + '보스 체력을 적어 주세요';
    if (!rnxIsDate(r.from) || !rnxIsDate(r.to) || r.from > r.to) return nm + '기간을 확인해 주세요';
  }
  var W = RX.boost.windows || [];
  for (var j = 0; j < W.length; j++){
    var w = W[j];
    if (!rnxIsDate(w.from) || !rnxIsDate(w.to) || w.from > w.to) return '추가 버프 ' + (j + 1) + '번째 줄(' + (w.sch || '모든 학교') + ') 기간을 확인해 주세요';
  }
  if (!(Number(RX.boost.flat) > 0)) return '추가 버프 세기를 확인해 주세요';
  return '';
}
window.rxSave = async function(){
  if (!RX.edit || RX.busy) return;
  var bad = rxCheck(); if (bad){ plToast(bad); return; }
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  RX.busy = true; render();
  try {
    /* 서버 것을 새로 읽어 raids · buff.boost 만 바꾼다 (✏️ 고치기 칸이 바꾼 값·모르는 칸 그대로) */
    var d = (await rnxGet(sb, ['race_season_draft'])).race_season_draft;
    if (!d || typeof d !== 'object') throw new Error('다음 시즌 설정(race_season_draft)이 서버에 없습니다');
    if (RNX.season && RNX.season.id && d.id !== RNX.season.id) throw new Error('서버의 다음 시즌이 바뀌었습니다 — 화면을 새로 고쳐 주세요');
    d.raids = rnxClone(RX.raids);
    d.buff = (d.buff && typeof d.buff === 'object') ? d.buff : { on: false, max: 0.4 };
    var nb = Object.assign({}, (d.buff.boost && typeof d.buff.boost === 'object') ? d.buff.boost : {}, rnxClone(RX.boost));
    nb.on = !!nb.on; nb.flat = Number(nb.flat) || 1; nb.max = Number(nb.max) || 0.4;
    nb.windows = (nb.windows || []).map(function(w){ var o = Object.assign({}, w); o.sch = String(w.sch || '').trim(); o.grs = Array.isArray(w.grs) ? w.grs : []; return o; });
    d.buff.boost = nb;
    d.updated = rxNow();
    await rnxPut(sb, 'race_season_draft', d);
    RNX.season = d;
    if (RNX.f){ RNX.f.raids = rnxClone(d.raids); RNX.f.buff = RNX.f.buff || {}; RNX.f.buff.boost = rnxClone(nb); }
    RX.edit = false; RX.raids = null; RX.boost = null;
    await rnxRequestRecount(true);
    plToast('⚔️ 레이드·추가 버프를 저장했습니다 (학생앱에는 안 보입니다) — 서버에 다시 세기를 요청했어요');
  } catch(e){ plToast('저장 실패: ' + (e.message || e)); }
  RX.busy = false; render();
};

/* ══ 카드 그리기 ══ */
function rxIn(path, val, w, type, extra){
  return '<input type="' + (type || 'text') + '" value="' + esc2(val == null ? '' : val) + '" oninput="rxSet(\'' + path + '\',this.value)"' + (extra || '')
    + ' style="width:' + (w || 90) + 'px;max-width:100%;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:700;font-family:inherit;color:#0d2240;box-sizing:border-box">';
}
function rxLbl(t, inner){ return '<div style="min-width:0"><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:3px">' + t + '</div>' + inner + '</div>'; }
function rxChip(t, bg, fg){ return '<span style="font-size:11px;font-weight:800;background:' + bg + ';color:' + fg + ';border-radius:50px;padding:3px 9px">' + t + '</span>'; }
function rxRaidForm(){
  var R = RX.raids, c = R[RX.sel];
  var h = '<div class="rx-form" style="background:#faf5ff;border-radius:11px;padding:12px 14px;margin-top:10px">';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  R.forEach(function(r, i){
    h += '<button class="rx-tab" onclick="rxSet(\'sel:' + i + '\')" style="border-radius:50px;padding:5px 13px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;'
      + (RX.sel === i ? 'background:#3b1a5e;color:#fff;border:1.5px solid #3b1a5e' : 'background:#fff;color:' + (r.on ? '#0d2240' : '#94a3b8') + ';border:1.5px solid #e2e8f0') + '">'
      + (r.on ? '' : '⏸ ') + esc2(r.name || '(이름 없음)') + '</button>';
  });
  h += '<button id="rx-add" onclick="rxSet(\'add\')" style="border:1.5px dashed #cbd5e1;background:#fff;color:#64748b;border-radius:50px;padding:5px 12px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">+ 레이드</button></div>';
  if (!c) return h + '<div style="font-size:12px;color:#94a3b8;font-weight:700">레이드가 없습니다 — 「+ 레이드」를 눌러 주세요 (없으면 공개 때 보스 레이드는 꺼집니다)</div></div>';
  var sk = Object.keys((RNX.season && RNX.season.schoolFrom) || {});
  var grs = rxGrsOf(c), allG = RX_GRADES.slice();
  grs.forEach(function(g){ if (allG.indexOf(g) < 0) allG.push(g); });
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:end">'
    + rxLbl('이름', rxIn('name', c.name, 220, 'text', ' id="rx-name"'))
    + rxLbl('보스 체력', rxIn('hp', c.hp, 120, 'number', ' id="rx-hp" min="0" step="1000"'))
    + rxLbl('시작일', rxIn('from', c.from, 140, 'date', ' id="rx-from"'))
    + rxLbl('마감일', rxIn('to', c.to, 140, 'date', ' id="rx-to"'))
    + rxLbl('앞줄 인원 (0~5)', rxIn('showNames', c.showNames == null ? 3 : c.showNames, 70, 'number', ' id="rx-front" min="0" max="5"'))
    + rxLbl('학교 (비우면 모든 학교)', rxIn('sch', c.sch || '', 130, 'text', ' id="rx-sch" list="rx-schools" placeholder="모든 학교"')
      + '<datalist id="rx-schools">' + sk.map(function(k){ return '<option>' + esc2(k) + '</option>'; }).join('') + '</datalist>')
    + '</div>';
  h += '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:10px 0 4px">'
    + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer"><input type="checkbox" id="rx-on" ' + (c.on ? 'checked ' : '') + 'onchange="rxSet(\'on\',this.checked)">켜기</label>'
    + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer"><input type="checkbox" id="rx-hide" ' + (c.hideSch ? 'checked ' : '') + 'onchange="rxSet(\'hideSch\',this.checked)">🙈 순위판에서 학교·학년 가리기 <span style="font-size:11px;color:#94a3b8">(중고등부 통합 레이드)</span></label></div>';
  h += '<div style="font-size:11px;color:#64748b;font-weight:800;margin:8px 0 5px">학년 <span style="color:#94a3b8">(아무것도 안 고르면 모든 학년)</span></div><div style="display:flex;gap:5px;flex-wrap:wrap">';
  allG.forEach(function(g){
    var on = grs.indexOf(g) >= 0;
    h += '<button class="rx-gr" data-g="' + esc2(g) + '" onclick="rxSet(\'gr:' + esc2(g) + '\')" style="border-radius:7px;padding:4px 10px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;'
      + (on ? 'background:#6d28d9;color:#fff;border:1.5px solid #6d28d9' : 'background:#fff;color:#64748b;border:1.5px solid #e2e8f0') + '">' + esc2(g) + '</button>';
  });
  h += '</div>';
  h += '<div style="font-size:11px;color:#64748b;font-weight:800;margin:12px 0 6px">보스 고르기 <span style="color:#94a3b8">(' + (rxLibBosses().length ? '🗃 보관함' : '앱 기본 6종 — 보관함을 만들면 꾸민 보스도 나옵니다') + ')</span></div>'
    + '<div id="rx-dex" style="display:flex;gap:8px;flex-wrap:wrap">';
  rxPickList().forEach(function(x){
    var on = c.boss === x.key;
    h += '<button class="rx-boss" data-b="' + esc2(x.key) + '" onclick="rxSet(\'boss:' + esc2(x.key) + '\')" style="border:2px solid ' + (on ? '#a78bfa' : '#e2e8f0') + ';background:#0d0a1d;border-radius:11px;padding:8px 10px;cursor:pointer;font-family:inherit;text-align:center;min-width:92px">'
      + '<span style="display:block;margin-bottom:5px">' + rxSlot(rxBossGrid(x.key), 44) + '</span>'
      + '<b style="font-size:11.5px;font-weight:900;color:' + (on ? '#c4b5fd' : '#94a3b8') + '">' + esc2(x.name) + '</b>'
      + (x.by && x.by !== 'builtin' ? '<span style="display:block;font-size:9.5px;color:#a78bfa;font-weight:800">' + (x.by === 'claude' ? '🤖' : '🎨') + (x.shade ? ' 명암 판' : '') + '</span>' : '') + '</button>';
  });
  h += '</div><div style="margin-top:10px"><button onclick="rxSet(\'del\')" style="border:1px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:9px;padding:6px 13px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">이 레이드 지우기</button></div>';
  return h + '</div>';
}
function rxRaidPreview(){
  var s = RNX.season || {}, b = RX.rbd;
  var note = function(t, warn){ return '<div style="background:' + (warn ? '#fff7ed' : '#f8fafc') + ';color:' + (warn ? '#9a3412' : '#64748b') + ';border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin-top:9px">' + t + '</div>'; };
  if (!RX.at && !RX.err) return note('레이드 순위판 불러오는 중…');
  if (RX.err) return note('레이드 순위판 불러오기 실패: ' + esc2(RX.err), true);
  if (!b || !b.at) return note('아직 서버가 다음 시즌 레이드를 세지 않았습니다 (raid_board_draft 없음) — 저장하면 다시 세기를 요청합니다.');
  var L = Array.isArray(b.list) ? b.list : [];
  if (b.on === false || !L.length) return note('서버 계산 결과: 켜진 레이드가 없습니다 — 공개하면 보스 레이드는 꺼집니다.');
  var h = '<div id="rx-preview" style="margin-top:10px">';
  if (s.updated && Date.parse(b.at) < Date.parse(s.updated)) h += note('설정을 바꾼 뒤 아직 다시 세지 않은 결과입니다 — 서버가 다시 세면 바뀝니다.', true);
  h += '<div style="font-size:11.5px;color:#64748b;font-weight:700;margin:8px 0 2px">🖥 서버 계산 ' + esc2(rnxFmt(b.at)) + ' · 🔒 학생앱에는 「📣 공개」 때 나갑니다</div>';
  L.forEach(function(x){
    var pct = Math.min(100, Number(x.pct) || 0), rows = x.rows || [], front = x.front || [];
    var grid = rxBossGrid(x.boss, x.art);
    h += '<div class="rx-pv" data-id="' + esc2(x.id) + '" style="display:flex;flex-wrap:wrap;gap:14px;border:1.5px solid #ede9fe;border-radius:12px;padding:12px;margin-top:9px">'
      + '<div style="flex:0 0 128px;box-sizing:border-box;background:#0d0a1d;border-radius:10px;padding:8px;display:grid;place-items:center;min-height:108px">' + rxSlot(grid, 108) + '</div><div style="flex:1 1 240px;min-width:0">';
    h += '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px"><b style="font-size:14px;color:#0d2240">' + esc2(x.name || '') + '</b>'
      + '<span style="font-size:11.5px;color:#6d28d9;font-weight:800">' + esc2(rxBossName(x.boss, x.art)) + (x.art ? ' 🗃' : '') + '</span>'
      + '<span style="font-size:11.5px;color:#64748b;font-weight:700">' + esc2((x.sch ? x.sch + ' ' : '') + ((x.grs || []).join('·') || '모든 학년')) + ' · ' + rows.length + '명' + (x.hideSch ? ' · 🙈 학교·학년 가림' : '') + '</span>'
      + '<span style="margin-left:auto;font-size:12px;font-weight:900;color:' + (x.dday <= 7 ? '#dc2626' : '#0d2240') + '">' + (x.dday >= 0 ? 'D-' + x.dday : '끝') + '</span></div>';
    h += '<div style="height:20px;border-radius:7px;background:#f1f5f9;overflow:hidden;position:relative;border:1px solid #e2e8f0">'
      + '<i style="display:block;height:100%;width:' + pct + '%;background:linear-gradient(90deg,#f59e0b,#e8192c)"></i>'
      + '<span class="rx-hp" style="position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:900;color:#0d2240">' + raceNum(x.dealt) + ' / ' + raceNum(x.hp) + ' (' + pct + '%)</span></div>';
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;font-weight:700;color:#64748b;margin-top:7px">'
      + '<span>어제 피해 <b style="color:#0d2240">' + raceNum(x.yesterday) + '</b></span>'
      + '<span>하루 평균 <b style="color:#0d2240">' + raceNum(x.perDay) + '</b></span>'
      + '<span>남은 체력 <b style="color:#e8192c">' + raceNum(x.left) + '</b></span>'
      + '<span>' + (x.cleared ? '<b style="color:#0f8a4e">🎉 격파</b>'
        : (x.eta ? '격파 예상 <b style="color:' + (x.eta > x.to ? '#dc2626' : '#0f8a4e') + '">' + esc2(x.eta) + '</b>' + (x.eta > x.to ? ' <span style="color:#dc2626">— 마감을 넘깁니다</span>' : '')
          : '격파 예상 <span style="color:#94a3b8">나흘째부터 (지금 ' + (x.daysIn || 0) + '일째)</span>')) + '</span></div>';
    var fn = front.map(function(cd){ var r = rows.filter(function(q){ return q.code === cd; })[0]; return esc2(raceName(cd, r ? r.nm : '')); });
    h += '<div style="font-size:11.5px;font-weight:800;color:#6d28d9;margin-top:7px">⭐ 앞줄(이번 주 상위 ' + (x.showNames || 3) + '명): ' + (fn.join(' · ') || '-') + '</div>';
    h += '<div class="rx-party" style="max-height:210px;overflow:auto;margin-top:6px;border:1px solid #f1f5f9;border-radius:8px"><table style="width:100%;border-collapse:collapse;font-size:11.5px">'
      + '<tr style="background:#f8fafc;color:#64748b;font-weight:800;font-size:10.5px"><th style="text-align:left;padding:5px 8px">파티 명단 ' + rows.length + '명</th>' + (x.hideSch ? '' : '<th style="text-align:left;padding:5px 8px">학교·학년</th>')
      + '<th style="text-align:right;padding:5px 8px">누적 피해</th><th style="text-align:right;padding:5px 8px">이번 주</th><th style="text-align:right;padding:5px 8px">어제</th></tr>';
    rows.forEach(function(r){
      h += '<tr class="rx-prow" style="border-top:1px solid #f1f5f9"><td style="padding:4px 8px;font-weight:800;color:#0d2240">' + (front.indexOf(r.code) >= 0 ? '⭐ ' : '') + esc2(raceName(r.code, r.nm)) + '</td>'
        + (x.hideSch ? '' : '<td style="padding:4px 8px;color:#64748b">' + esc2((r.sch || '') + ' ' + (r.gr || '')) + '</td>')
        + '<td style="padding:4px 8px;text-align:right;font-weight:900">' + raceNum(r.dealt) + '</td><td style="padding:4px 8px;text-align:right;color:#64748b">' + raceNum(r.week) + '</td>'
        + '<td style="padding:4px 8px;text-align:right;color:#64748b">' + raceNum(r.y) + '</td></tr>';
    });
    h += '</table></div></div></div>';
  });
  return h + '</div>';
}
function rxRaidSec(){
  var s = RNX.season || {};
  var raids = RX.edit ? RX.raids : (Array.isArray(s.raids) ? s.raids : []);
  var h = '<div id="rx-raid" style="border-top:1.5px dashed #c7d2fe;margin-top:14px;padding-top:12px">';
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<div style="font-size:14px;font-weight:900;color:#3b1a5e">⚔️ 보스 레이드 <span style="font-size:11.5px;color:#7c3aed;font-weight:800">다음 시즌 · 레이스와 같은 날부터 셉니다</span></div>'
    + '<span style="margin-left:auto;display:flex;gap:7px;flex-wrap:wrap">'
    + (RX.edit ? '' : '<button id="rx-edit" onclick="rxEdit(true)" style="' + RX_BTN + ';background:#fff;color:#3b1a5e;border:1.5px solid #ddd6fe">✏️ 레이드·버프 고치기</button>')
    + '<button id="rx-lib-open" onclick="rxLibOpen()" style="' + RX_BTN + ';background:#241c56;color:#fff">🗃 보스 보관함</button></span></div>';
  if (!RX.edit){
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    if (!raids.length) h += '<span style="font-size:12px;color:#94a3b8;font-weight:700">아직 레이드가 없습니다 — 「✏️ 레이드·버프 고치기」 → 「+ 레이드」</span>';
    raids.forEach(function(r){
      h += rxChip((r.on ? '⚔️ ' : '⏸ ') + esc2(r.name || '') + ' · ' + esc2(rxBossName(r.boss)) + ' · ' + esc2(rxGrsOf(r).join('·') || '모든 학년') + (r.sch ? ' · ' + esc2(r.sch) : '') + ' · 체력 ' + raceNum(r.hp || 0) + (r.hideSch ? ' · 🙈' : ''), r.on ? '#f5f3ff' : '#f1f5f9', r.on ? '#5b21b6' : '#94a3b8');
    });
    h += '</div>';
  } else h += rxRaidForm();
  h += rxRaidPreview();
  return h + '</div>';
}
function rxBoostSec(){
  var s = RNX.season || {}, buffOn = !!(s.buff && s.buff.on);
  var bz = RX.edit ? RX.boost : ((s.buff && s.buff.boost) || null);
  var h = '<div id="rx-boost" style="border-top:1.5px dashed #fed7aa;margin-top:14px;padding-top:12px">';
  h += '<div style="font-size:14px;font-weight:900;color:#9a3412">🔥 추가 버프 기간 <span style="font-size:11.5px;color:#c2410c;font-weight:800">학교 시험 2주 전 ~ 시험 끝 · 위에서부터 «처음 맞는 줄» 하나만</span></div>';
  if (!buffOn) h += '<div style="font-size:11.5px;color:#b45309;font-weight:800;margin-top:5px">⚠️ 🔥 집중 버프가 꺼져 있으면 추가 버프도 붙지 않습니다 (✏️ 고치기 → 집중 버프)</div>';
  var W = (bz && Array.isArray(bz.windows)) ? bz.windows : [];
  var flat = bz ? (Number(bz.flat) || 1) : 1, mx = bz ? (Number(bz.max) || 0.4) : 0.4;
  if (!RX.edit){
    if (!bz) return h + '<div style="font-size:12px;color:#94a3b8;font-weight:700;margin-top:6px">추가 버프 없음</div></div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">'
      + rxChip(bz.on ? '켜짐' : '꺼짐', bz.on ? '#dcfce7' : '#f1f5f9', bz.on ? '#15803d' : '#64748b')
      + rxChip('고정 ×' + flat + ' · 플래너 최대치 ' + mx + ' (10점이면 ×' + (flat * (1 + mx)).toFixed(2) + ')', '#fff7ed', '#c2410c') + '</div>';
    if (!W.length) h += '<div style="font-size:12px;color:#94a3b8;font-weight:700;margin-top:6px">기간 줄이 없습니다' + (bz.from ? ' — 예전 방식: ' + esc2(bz.from) + '부터 모든 학생' : '') + '</div>';
    else {
      h += '<div style="overflow-x:auto"><table class="rx-wtab" style="border-collapse:collapse;font-size:12px;margin-top:7px;min-width:360px">';
      W.forEach(function(w, i){
        h += '<tr class="rx-wrow" style="border-top:1px solid #f1f5f9"><td style="padding:4px 8px;color:#94a3b8;font-weight:800">' + (i + 1) + '</td><td style="padding:4px 8px;font-weight:900;color:#0d2240">' + esc2(w.sch || '모든 학교') + '</td>'
          + '<td style="padding:4px 8px;color:#475569;font-weight:700">' + esc2((w.grs || []).join('·') || '모든 학년') + '</td>'
          + '<td style="padding:4px 8px;font-weight:800;color:#c2410c">' + esc2(rxMD(w.from)) + ' ~ ' + esc2(rxMD(w.to)) + '</td></tr>';
      });
      h += '</table></div>';
    }
    return h + '</div>';
  }
  h += '<div class="rx-bform" style="background:#fffbeb;border-radius:11px;padding:12px 14px;margin-top:8px">';
  h += '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">'
    + '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer;padding-bottom:6px"><input type="checkbox" id="rx-bon" ' + (bz.on ? 'checked ' : '') + 'onchange="rxSet(\'bon\',this.checked)">추가 버프 켜기</label>'
    + rxLbl('고정 배수', '<select id="rx-bflat" onchange="rxSet(\'bflat\',this.value)" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-weight:800;font-family:inherit">'
      + [1, 1.1, 1.2, 1.3, 1.5, 2].map(function(x){ return '<option value="' + x + '"' + (flat === x ? ' selected' : '') + '>×' + x.toFixed(1) + '</option>'; }).join('') + '</select>')
    + rxLbl('플래너 최대치', '<select id="rx-bmax" onchange="rxSet(\'bmax\',this.value)" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-weight:800;font-family:inherit">'
      + [0.4, 0.6, 0.8, 1, 1.5].map(function(x){ return '<option value="' + x + '"' + (mx === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>')
    + '<span style="font-size:11.5px;color:#9a3412;font-weight:800;padding-bottom:7px">플래너 10점인 날 ×' + (flat * (1 + mx)).toFixed(2) + '</span></div>';
  h += '<div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:5px">학교 (이름 앞부분 · 비우면 모든 학교) · 학년 (중1,중2 · 비우면 모든 학년) · 시작 · 끝</div><div style="display:flex;flex-direction:column;gap:5px">';
  W.forEach(function(w, i){
    h += '<div class="rx-win" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      + '<span style="font-size:11px;color:#94a3b8;font-weight:800;width:16px">' + (i + 1) + '</span>'
      + rxIn('wsch:' + i, w.sch || '', 96, 'text', ' placeholder="모든 학교"') + rxIn('wgrs:' + i, (w.grs || []).join(','), 100, 'text', ' placeholder="모든 학년"')
      + rxIn('wfrom:' + i, w.from, 140, 'date') + rxIn('wto:' + i, w.to, 140, 'date')
      + '<button onclick="rxSet(\'wup:' + i + '\')" title="위로" style="padding:3px 7px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit">▲</button>'
      + '<button onclick="rxSet(\'wdown:' + i + '\')" title="아래로" style="padding:3px 7px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit">▼</button>'
      + '<button onclick="rxSet(\'wdel:' + i + '\')" title="지우기" style="padding:3px 8px;border:1px solid #fecaca;background:#fff;color:#dc2626;border-radius:6px;font-weight:900;cursor:pointer;font-family:inherit">✕</button></div>';
  });
  h += '</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
    + '<button onclick="rxSet(\'wadd\')" style="padding:5px 11px;border:1.5px dashed #cbd5e1;background:#fff;color:#475569;border-radius:7px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">+ 줄 넣기</button>'
    + '<button id="rx-fill" onclick="rxFillFromCal()" style="padding:5px 11px;border:none;background:#ea580c;color:#fff;border-radius:7px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit">📅 학교 시험 일정으로 채우기</button>'
    + '<span style="font-size:11px;color:#94a3b8;font-weight:700;align-self:center">학원 달력의 「' + RX_EXAM_LABEL + '」 시작 14일 전 ~ 마지막 날 · 학년 지정 반영 · 초등은 손으로</span></div></div>';
  h += '<div style="display:flex;gap:8px;margin-top:12px"><button id="rx-save" onclick="rxSave()" ' + (RX.busy ? 'disabled ' : '') + 'style="' + RX_BTN + ';background:#0d2240;color:#fff;padding:9px 16px">' + (RX.busy ? '⏳ 저장 중…' : '💾 레이드·버프 저장 (원장님만)') + '</button>'
    + '<button id="rx-close" onclick="rxEdit(false)" style="' + RX_BTN + ';background:#fff;color:#64748b;border:1.5px solid #e2e8f0">닫기</button></div>';
  return h + '</div>';
}
/* 「🆕 다음 시즌」 카드 끝에 두 칸을 붙인다 */
(function(){
  var o = window.rnxCardHtml;
  if (typeof o !== 'function') return;
  window.rnxCardHtml = function(){
    var h = o.apply(this, arguments);
    if (!RNX.loaded) return h;
    RX.slots = {};
    var add = RNX.season ? rxRaidSec() + rxBoostSec()
      : '<div style="margin-top:10px"><button id="rx-lib-open" onclick="rxLibOpen()" style="' + RX_BTN + ';background:#241c56;color:#fff">🗃 보스 보관함</button></div>';
    setTimeout(function(){ rxPaintSlots(document.getElementById('rnx-card')); }, 0);
    var i = h.lastIndexOf('</div>');
    return h.slice(0, i) + add + h.slice(i);
  };
})();
/* 지금 시즌 레이드 칸: 순위판에 art 가 있거나 보관함 보스면 그 그림으로 */
(function(){
  var o = window.raidPaintDots;
  if (typeof o !== 'function') return;
  window.raidPaintDots = function(){
    var r = o.apply(this, arguments);
    try {
      var A = window.RAIDART, b = (typeof raidBoardOf === 'function') ? raidBoardOf() : null, host = document.getElementById('raid-boss-host');
      if (A && host && b && (b.art || rxLibBoss(b.boss))){
        var g = rxBossGrid(b.boss, b.art);
        if (g){ host.innerHTML = ''; host.appendChild(A.cvOf(g, Math.max(2, Math.floor(110 / g.length)))); }
      }
    } catch(e){}
    try { rxPaintSlots(document); } catch(e){}
    return r;
  };
})();

/* ══ ④ 📣 학생앱에 공개 (계약서 §3) — racenext122 의 rnxPublish 를 바꾼다 ══
 *   예전: raid_board ← {on:false}. 새로: raid_board_draft 가 켜져 있으면 그것을 raid_board 로(at 새로), 없으면 꺼짐.
 *   공개 뒤 raid_board_draft 도 지운다. */
window.rnxPublish = async function(){
  if (RNX.busy) return;
  var sb = getSupaClient(); if (!sb){ plToast('서버에 연결되어 있지 않습니다'); return; }
  var m;
  try { m = await rnxGet(sb, ['race_season', 'race_board', 'race_history', 'race_season_draft', 'race_board_draft', 'race_watch_draft', 'raid_board_draft', 'raid_boss_lib']); }
  catch(e){ plToast('불러오기 실패: ' + (e.message || e)); return; }
  var live = m.race_season, lb = m.race_board, d = m.race_season_draft, db = m.race_board_draft, rbd = m.raid_board_draft;
  if (m.raid_boss_lib) rxSetLib(m.raid_boss_lib);
  if (!d){ plToast('다음 시즌이 없습니다'); return; }
  if (!db || !db.at || db.seasonId !== d.id){ plToast('아직 서버가 이 시즌을 세지 않았습니다 — 「🔄 다시 세기 요청」 뒤 순위가 나오면 공개해 주세요'); return; }
  if (live && live.id && live.id === d.id){ plToast('다음 시즌 id 가 지금 시즌과 같아 공개할 수 없습니다'); return; }
  if (d.updated && db.seasonUpdated !== undefined && db.seasonUpdated !== d.updated && !confirm('설정을 바꾼 뒤 아직 다시 세지 않은 순위표입니다. 그래도 공개할까요? (공개 뒤 서버가 곧 다시 셉니다)')) return;
  var raidOn = !!(rbd && rbd.on !== false && Array.isArray(rbd.list) && rbd.list.length);
  var raidTxt = raidOn
    ? '· ⚔️ 보스 레이드 ' + rbd.list.length + '개가 함께 공개됩니다:\n' + rbd.list.map(function(x){
        return '   - 「' + (x.name || '') + '」 보스 ' + rxBossName(x.boss, x.art) + ' · 체력 ' + raceNum(x.hp) + ' · ' + ((x.grs || []).join('·') || '모든 학년') + (x.hideSch ? ' (학교·학년 가림)' : '');
      }).join('\n') + '\n' + ((d.updated && rbd.at && Date.parse(rbd.at) < Date.parse(d.updated)) ? '   (레이드 순위판은 설정을 바꾸기 전 계산입니다 — 공개 뒤 서버가 다시 셉니다)\n' : '')
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
    RX.rbd = null; RX.edit = false; RX.raids = null; RX.boost = null;
    await rnxRequestRecount(true);
    plToast('📣 공개했습니다 — 학생앱 진도 레이스가 「' + (ns.name || '') + '」으로 바뀝니다' + (raidOn ? ' · ⚔️ 보스 레이드 ' + nr.list.length + '개 함께' : ''));
  } catch(e){
    plToast('공개 중 멈춤 (' + step + '): ' + (e.message || e) + ' — 화면을 새로 고친 뒤 상태를 확인해 주세요');
  }
  RNX.busy = false; render();
};

/* ══════════════════════════════════════════════════════════════════
 * ③ 🗃 보스 보관함 — 화면 위에 뜨는 창(진도 레이스 화면을 다시 그려도 닫히지 않는다)
 * ══════════════════════════════════════════════════════════════════ */
window.RXL = { open: false, view: 'list', lib: null, loaded: false, busy: false, err: '', d: null, last: null, dpal: [], z: 10 };
window.rxLibOpen = async function(){
  RXL.open = true; RXL.view = 'list'; RXL.loaded = false; RXL.err = '';
  rxLibRender();
  await rxLibLoad();
};
async function rxLibLoad(){
  var sb = getSupaClient();
  if (!sb){ RXL.err = '서버에 연결되어 있지 않습니다'; RXL.loaded = true; rxLibRender(); return; }
  try { var m = await rnxGet(sb, ['raid_boss_lib']); RXL.lib = (m.raid_boss_lib && Array.isArray(m.raid_boss_lib.bosses)) ? m.raid_boss_lib : null; rxSetLib(RXL.lib); RXL.err = ''; }
  catch(e){ RXL.err = e.message || String(e); }
  RXL.loaded = true; rxLibRender();
}
window.rxLibClose = function(){
  RXL.open = false; RXL.d = null;
  var el = document.getElementById('rxlib-modal'); if (el && el.parentNode) el.parentNode.removeChild(el);
  if (VIEW === 'race') render();
};
window.rxLibRender = function(){
  if (!RXL.open) return;
  var el = document.getElementById('rxlib-modal');
  if (!el){
    el = document.createElement('div'); el.id = 'rxlib-modal'; el.className = 'modal-bg'; el.setAttribute('data-modal-open', '1');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9000;overflow:auto;padding:22px 10px;box-sizing:border-box';
    el.addEventListener('click', function(ev){ if (ev.target === el && RXL.view === 'list') rxLibClose(); });
    document.body.appendChild(el);
  }
  el.innerHTML = '<div id="rxlib-box" style="max-width:1060px;margin:0 auto;background:#fff;border-radius:16px;padding:16px 18px;box-sizing:border-box">' + (RXL.view === 'deco' ? rxDecoHtml() : rxLibListHtml()) + '</div>';
  rxPaintSlots(el);
  if (RXL.view === 'deco') rxDecoMount();
};
/* 지금 쓰는 곳 (다음 시즌 · 지금 시즌 레이드) */
function rxUsedBy(key){
  var out = [];
  var a = (RNX.season && Array.isArray(RNX.season.raids)) ? RNX.season.raids : [];
  a.forEach(function(r){ if (r && r.boss === key) out.push('다음 시즌 「' + (r.name || '') + '」'); });
  var b = (window.RACE && RACE.season && Array.isArray(RACE.season.raids)) ? RACE.season.raids : [];
  b.forEach(function(r){ if (r && r.boss === key) out.push('지금 시즌 「' + (r.name || '') + '」'); });
  return out;
}
function rxLibListHtml(){
  var lib = RXL.lib, A = window.RAIDART;
  var list = lib ? lib.bosses.filter(function(b){ return b && b.key; }) : ((A && A.BOSSES) || []).map(function(x){ return { key: x.key, name: x.name, by: 'builtin', _art: true, tag: x.tag, desc: x.desc }; });
  var h = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">'
    + '<div style="font-size:17px;font-weight:900;color:#241c56">🗃 보스 보관함</div>'
    + '<span style="font-size:11.5px;color:#64748b;font-weight:700">' + (lib ? '보스 ' + list.length + '마리 · 마지막 저장 ' + esc2(rnxFmt(lib.updated)) : '아직 만들지 않았습니다') + '</span>'
    + '<button id="rxl-close" onclick="rxLibClose()" style="margin-left:auto;' + RX_BTN + ';background:#f1f5f9;color:#334155">✕ 닫기</button></div>';
  h += '<div style="font-size:11.5px;color:#64748b;font-weight:700;line-height:1.7;margin-bottom:10px">레이드 보스 그림을 모아 둔 곳입니다(lumen_store raid_boss_lib). 「🎨 꾸미기」로 색을 바꾸고 왕관·투구 등을 얹어 새 보스를 만들 수 있습니다. '
    + 'Claude 가 새로 그린 보스(🤖)는 채팅에서 부탁하면 서버 도구가 넣습니다. 기본 6종은 지울 수 없습니다.</div>';
  if (!RXL.loaded) return h + '<div style="padding:30px;text-align:center;color:#94a3b8;font-weight:800">불러오는 중…</div>';
  if (RXL.err) h += '<div style="background:#fef2f2;color:#b91c1c;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin-bottom:8px">' + esc2(RXL.err) + '</div>';
  if (!lib){
    h += '<div style="background:#eef2ff;border-radius:11px;padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      + '<span style="font-size:12.5px;font-weight:800;color:#312e81">보관함이 아직 없습니다 — 앱에 들어 있는 기본 보스 6종으로 만듭니다.</span>'
      + '<button id="rxl-build" onclick="rxLibBuild()" ' + (RXL.busy ? 'disabled ' : '') + 'style="' + RX_BTN + ';background:#4f46e5;color:#fff">📦 보관함 만들기</button></div>';
  } else {
    var miss = ((A && A.BOSSES) || []).filter(function(x){ return !lib.bosses.some(function(b){ return b && b.key === x.key; }); });
    if (miss.length) h += '<div style="background:#fff7ed;border-radius:11px;padding:10px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      + '<span style="font-size:12px;font-weight:800;color:#9a3412">기본 보스 ' + miss.length + '종이 보관함에 없습니다 (' + esc2(miss.map(function(x){ return x.name; }).join('·')) + ')</span>'
      + '<button id="rxl-build" onclick="rxLibBuild()" ' + (RXL.busy ? 'disabled ' : '') + 'style="' + RX_BTN + ';background:#ea580c;color:#fff">빠진 기본 보스 넣기</button></div>';
  }
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:11px">';
  list.forEach(function(b){
    var g = b._art ? (rxArtBoss(b.key) || {}).grid : rxBossGrid(b.key);
    var by = b.by || (rxArtBoss(b.key) ? 'builtin' : '');
    var used = rxUsedBy(b.key), log = Array.isArray(b.log) ? b.log : [];
    h += '<div class="rxl-card" data-key="' + esc2(b.key) + '" style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">'
      + '<div style="background:#0d0a1d;display:grid;place-items:center;height:150px">' + rxSlot(g, 130) + '</div>'
      + '<div style="padding:9px 11px;flex:1;display:flex;flex-direction:column;gap:4px">'
      + '<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap"><b style="font-size:13.5px;color:#0d2240">' + esc2(b.name || b.key) + '</b><span style="font-size:10.5px;color:#94a3b8;font-weight:700">' + esc2(b.key) + '</span></div>'
      + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + rxChip(esc2(RX_BY[by] || by || '?'), by === 'builtin' ? '#f1f5f9' : by === 'claude' ? '#ecfeff' : '#fdf4ff', by === 'builtin' ? '#475569' : by === 'claude' ? '#0e7490' : '#a21caf')
      + rxChip(g ? (g[0] || []).length + ' x ' + g.length : '?', '#f8fafc', '#64748b')
      + (rxIsShade(b) ? rxChip('명암 판', '#fef3c7', '#92400e') : '')
      + (b.base ? rxChip('바탕 ' + esc2(rxBossName(b.base)) + ' (' + esc2(b.base) + ')', '#f5f3ff', '#6d28d9') : '') + '</div>'
      + (b.created && !b._art ? '<div style="font-size:10.5px;color:#94a3b8;font-weight:700">만든 날 ' + esc2(String(b.created).slice(0, 10)) + '</div>' : '')
      + (used.length ? '<div style="font-size:10.5px;color:#0f8a4e;font-weight:800">⚔️ 쓰는 중: ' + esc2(used.join(' · ')) + '</div>' : '')
      + '<div style="font-size:10.5px;color:#64748b;font-weight:700">' + (log.length ? '지난 사용: ' + log.slice(-3).reverse().map(function(l){
          return esc2((l.raid || '') + ' ' + rxMD(l.from) + '~' + rxMD(l.to) + ' 체력 ' + raceNum(l.hp || 0) + (l.cleared ? ' 🎉격파' : l.cleared === false ? ' 못 잡음' : ''));
        }).join('<br>') : '지난 사용 기록 없음') + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:auto;padding-top:6px">'
      + '<button class="rxl-deco" onclick="rxDecoStart(\'' + esc2(b.key) + '\')" style="' + RX_BTN + ';background:#7c3aed;color:#fff;padding:6px 11px">🎨 꾸미기</button>'
      + (by !== 'builtin' && !b._art ? '<button class="rxl-del" onclick="rxLibDel(\'' + esc2(b.key) + '\')" style="' + RX_BTN + ';background:#fff;color:#b91c1c;border:1px solid #fca5a5;padding:6px 11px">🗑 지우기</button>' : '')
      + '</div></div></div>';
  });
  return h + '</div>';
}
/* 서버 보관함을 새로 읽고 fn 으로 고친 뒤 통째로 쓴다 (다른 보스 · 모르는 칸 그대로) */
async function rxLibRMW(fn){
  var sb = getSupaClient(); if (!sb) throw new Error('서버에 연결되어 있지 않습니다');
  var cur = (await rnxGet(sb, ['raid_boss_lib'])).raid_boss_lib;
  var now = rxNow();
  if (!cur || typeof cur !== 'object' || !Array.isArray(cur.bosses)){
    var base = rxLibFromArt(now);
    cur = (cur && typeof cur === 'object') ? cur : {};
    cur.v = cur.v || 1; cur.bosses = base.bosses;
  }
  var r = fn(cur, now);
  cur.updated = now;
  await rnxPut(sb, 'raid_boss_lib', cur);
  RXL.lib = cur; rxSetLib(cur);
  return r;
}
window.rxLibBuild = async function(){
  if (RXL.busy) return;
  RXL.busy = true; rxLibRender();
  try {
    var n = await rxLibRMW(function(cur, now){
      var add = 0;
      rxLibFromArt(now).bosses.forEach(function(b){ if (!cur.bosses.some(function(x){ return x && x.key === b.key; })){ cur.bosses.push(b); add++; } });
      return add;
    });
    plToast('🗃 보관함을 만들었습니다 — 보스 ' + RXL.lib.bosses.length + '마리' + (n ? ' (기본 ' + n + '종 넣음)' : ''));
  } catch(e){ plToast('보관함 만들기 실패: ' + (e.message || e)); }
  RXL.busy = false; rxLibRender(); if (VIEW === 'race') render();
};
window.rxLibDel = async function(key){
  var b = rxLibBoss(key);
  if (!b){ plToast('보관함에 없는 보스입니다'); return; }
  if (rxIsBuiltin(b)){ plToast('기본 보스는 지울 수 없습니다'); return; }
  var used = rxUsedBy(key);
  if (used.length){ plToast('레이드에서 쓰는 보스는 지울 수 없습니다 — ' + used.join(' · ')); return; }
  if (!confirm('🗑 「' + (b.name || key) + '」을 보관함에서 지울까요? (되돌릴 수 없습니다)')) return;
  if (RXL.busy) return;
  RXL.busy = true;
  try {
    var gone = await rxLibRMW(function(cur){
      var n0 = cur.bosses.length;
      cur.bosses = cur.bosses.filter(function(x){ return !(x && x.key === key && !rxIsBuiltin(x)); });
      return n0 - cur.bosses.length;
    });
    plToast(gone ? '🗑 「' + (b.name || key) + '」을 지웠습니다' : '이미 지워져 있습니다');
  } catch(e){ plToast('지우기 실패: ' + (e.message || e)); }
  RXL.busy = false; rxLibRender(); if (VIEW === 'race') render();
};
window.rxNewKey = function(bosses, today){
  var pre = 't_' + String(today || rxTodayK()).replace(/-/g, '').slice(0, 8) + '_', used = {}, n = 1;
  (bosses || []).forEach(function(b){ if (b && b.key) used[b.key] = 1; });
  while (used[pre + n]) n++;
  return pre + n;
};
/* 새 보스 넣기 — key 는 서버 것을 새로 읽은 뒤 정한다 */
window.rxLibAddBoss = async function(boss){
  return await rxLibRMW(function(cur){
    boss.key = rxNewKey(cur.bosses, rxTodayK());
    cur.bosses.push(boss);
    return boss.key;
  });
};

/* ══ 🎨 꾸미기 ══
 *   바탕 보스 → 색 바꾸기(팔레트 색마다 + 전체 색조) → 얹기(머리: 왕관/투구 · 갑옷 띠 · 불꽃 기운 · 별 반짝이) → 점 찍기/지우기
 *   점 찍은 것은 «바탕 그림 좌표»로 적어 둔다 — 얹기로 위·옆 칸이 늘어나도 자리가 어긋나지 않게. */
var RX_SC = { o: RX_OUT, G: '#f5c542', g: '#b8891a', W: '#fff6c2', R: '#e2402c', B: '#4fa8ff', M: '#dbe3f2', m: '#9aa6c2', k: '#6a7593', w: '#ffffff', H: '#efe4c8', h: '#c4b48e', Y: '#fff2a8' };
var RX_STAMPS = {
  crown: { name: '👑 왕관', sink: 0, rows: [
    '.o...o...o.',
    'oWo.oWo.oWo',
    'oGGoGGGoGGo',
    'oGGGGGGGGGo',
    'oGRGGBGGRGo',
    'ogggggggggo',
    'ooooooooooo'] },
  helmet: { name: '⛑ 투구', sink: 2, rows: [
    '.o.............o.',
    'oHo...ooooo...oHo',
    'oHho.oMwwMMo.ohHo',
    '.oHhoMwMMMMmohHo.',
    '..ooMMMMMMMMmoo..',
    '...oMMMMMMMMmo...',
    '...okwkkkkkwko...',
    '...ooooooooooo...'] }
};
var RX_SPARK_BIG = ['..w..', '..Y..', 'wYwYw', '..Y..', '..w..'];
var RX_SPARK_SMALL = ['.Y.', 'YwY', '.Y.'];
function rxStampAt(g, rows, x0, y0, onlyEmpty){
  for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++){
    var ch = rows[j].charAt(i); if (ch === '.') continue;
    var y = y0 + j, x = x0 + i;
    if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
    if (onlyEmpty && g[y][x]) continue;
    g[y][x] = RX_SC[ch] || RX_OUT;
  }
}
function rxHash(x, y){ return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
function rxFlame(g){
  var H = g.length, W = g[0].length, x, y, k;
  var solid = g.map(function(r){ return r.map(function(c){ return !!c; }); });
  var out = g.map(function(r){ return r.slice(); });
  for (y = 0; y < H; y++) for (x = 0; x < W; x++){
    if (solid[y][x]) continue;
    var d = 9;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++){
      var yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < H && xx >= 0 && xx < W && solid[yy][xx]) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
    }
    var hs = rxHash(x, y);
    if (d === 1) out[y][x] = (hs % 5 === 0) ? '#ffd24a' : '#ff7a1a';
    else if (d === 2 && hs % 3 === 0) out[y][x] = '#ff4d1a';
  }
  /* 위로 솟는 불꽃 혀 */
  for (x = 0; x < W; x++){
    var top = -1; for (y = 0; y < H; y++) if (solid[y][x]){ top = y; break; }
    if (top < 0 || x % 3 !== 1) continue;
    var len = 2 + (rxHash(x, 7) % 3);
    for (k = 2; k <= len + 1; k++){
      y = top - k; if (y < 0) break;
      if (!solid[y][x]) out[y][x] = k === len + 1 ? '#ffe27a' : (k === len ? '#ffb020' : '#ff7a1a');
    }
  }
  for (y = 0; y < H; y++) g[y] = out[y];
}
function rxBand(g, y0, cx){
  var W = g[0].length, cols = ['#dbe3f2', '#9aa6c2', '#6a7593'];
  for (var r = 0; r < 3; r++){
    var y = y0 + r; if (y < 0 || y >= g.length) continue;
    var row = g[y], c0 = -1;
    for (var dd = 0; dd <= 4 && c0 < 0; dd++){
      if (cx - dd >= 0 && row[cx - dd] && row[cx - dd] !== RX_OUT) c0 = cx - dd;
      else if (cx + dd < W && row[cx + dd] && row[cx + dd] !== RX_OUT) c0 = cx + dd;
    }
    if (c0 < 0) continue;
    var a = c0, b = c0;
    while (a - 1 >= 0 && row[a - 1] && row[a - 1] !== RX_OUT) a--;
    while (b + 1 < W && row[b + 1] && row[b + 1] !== RX_OUT) b++;
    for (var x = a; x <= b; x++) row[x] = (r === 1 && (x - a) % 4 === 2) ? '#f5c542' : cols[r];
  }
}
/* 순수 함수: 바탕 격자 + 꾸미기 값 → {grid, padL, padT, w, h} */
window.rxDecoCompose = function(bg, d){
  d = d || {};
  var H = bg.length, W = 0, x, y;
  for (y = 0; y < H; y++) W = Math.max(W, (bg[y] || []).length);
  var cm = {};
  var col = function(c){
    if (!c) return null;
    if (cm[c] !== undefined) return cm[c];
    var n = (d.map && d.map[c]) || c;
    if (d.hue && c !== RX_OUT) n = rxHueRot(n, d.hue);
    cm[c] = n; return n;
  };
  var top = H, bot = -1, left = W, right = -1;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) if ((bg[y] || [])[x]){ if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x; }
  if (bot < 0){ top = 0; bot = H - 1; left = 0; right = W - 1; }
  var cx = Math.round((left + right) / 2);
  var st = d.head ? RX_STAMPS[d.head] : null, sw = 0, sh = 0, hx0 = 0, hy0 = 0;
  if (st){
    sh = st.rows.length; sw = st.rows[0].length;
    var headY = top;
    for (y = top; y <= bot; y++){ var hit = false; for (x = cx - 2; x <= cx + 2; x++) if (x >= 0 && x < W && (bg[y] || [])[x]) hit = true; if (hit){ headY = y; break; } }
    hx0 = cx - Math.floor(sw / 2) + (Number(d.hx) || 0);
    hy0 = headY - (sh - 1) + (st.sink || 0) + (Number(d.hy) || 0);
  }
  var fl = !!d.flame;
  var padT = Math.max(fl ? 4 : 0, st ? -hy0 : 0, 0);
  var padL = Math.max(fl ? 2 : 0, st ? -hx0 : 0, 0);
  var padR = Math.max(fl ? 2 : 0, st ? hx0 + sw - W : 0, 0);
  var FW = W + padL + padR, FH = H + padT, g = [];
  for (y = 0; y < FH; y++){ var row = []; for (x = 0; x < FW; x++) row.push(null); g.push(row); }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++){ var c = (bg[y] || [])[x]; if (c) g[y + padT][x + padL] = col(c); }
  if (fl) rxFlame(g);
  if (d.band) rxBand(g, padT + top + Math.round((bot - top) * 0.6), padL + cx);
  if (st) rxStampAt(g, st.rows, hx0 + padL, hy0 + padT, false);
  if (d.spark){
    rxStampAt(g, RX_SPARK_BIG, 0, 1, true);
    rxStampAt(g, RX_SPARK_BIG, FW - 5, Math.floor(FH * 0.32), true);
    rxStampAt(g, RX_SPARK_SMALL, 1, Math.floor(FH * 0.62), true);
    rxStampAt(g, RX_SPARK_SMALL, FW - 4, 1, true);
  }
  var E = d.edits || {};
  Object.keys(E).forEach(function(k){
    var p = k.split(','), fx = Number(p[0]) + padL, fy = Number(p[1]) + padT;
    if (fy >= 0 && fy < FH && fx >= 0 && fx < FW) g[fy][fx] = E[k] || null;
  });
  return { grid: g, padL: padL, padT: padT, w: FW, h: FH };
};
function rxDecoNew(key){
  return { base: key, name: rxBossName(key) + ' 꾸미기', map: {}, hue: 0, head: '', band: false, flame: false, spark: false, hx: 0, hy: 0, edits: {}, tool: 'pen', color: '#ffd24a' };
}
window.rxDecoStart = function(key){
  if (!rxBossGrid(key)){ plToast('그림이 없는 보스입니다'); return; }
  RXL.view = 'deco'; RXL.d = rxDecoNew(key); rxLibRender();
};
window.rxDecoSet = function(k, v){
  var d = RXL.d; if (!d) return;
  var p = String(k).split(':'), re = true;
  if (p[0] === 'base'){
    if (Object.keys(d.edits).length && !confirm('바탕 보스를 바꾸면 점 찍은 것과 색 바꾼 것이 지워집니다. 바꿀까요?')){ rxLibRender(); return; }
    RXL.d = rxDecoNew(v); RXL.d.head = d.head; RXL.d.band = d.band; RXL.d.flame = d.flame; RXL.d.spark = d.spark;
  }
  else if (p[0] === 'name'){ d.name = String(v || ''); re = false; }
  else if (p[0] === 'map'){ var c = RXL.dpal[Number(p[1])]; if (c) d.map[c] = rxHex(v); }
  else if (p[0] === 'hue'){ d.hue = Number(v) || 0; re = false; rxDecoDraw(); var t = document.getElementById('rxd-huev'); if (t) t.textContent = d.hue + '°'; }
  else if (p[0] === 'reset'){ d.map = {}; d.hue = 0; }
  else if (p[0] === 'head') d.head = v || '';
  else if (p[0] === 'nudge'){ if (p[1] === 'l') d.hx--; else if (p[1] === 'r') d.hx++; else if (p[1] === 'u') d.hy--; else if (p[1] === 'd') d.hy++; }
  else if (p[0] === 'band' || p[0] === 'flame' || p[0] === 'spark') d[p[0]] = !!v;
  else if (p[0] === 'tool') d.tool = v === 'eraser' ? 'eraser' : 'pen';
  else if (p[0] === 'color'){ d.color = rxHex(v); d.tool = 'pen'; }
  else if (p[0] === 'clear'){ if (!Object.keys(d.edits).length || confirm('점 찍은 것을 모두 지울까요?')) d.edits = {}; }
  if (re) rxLibRender();
};
/* 확대 격자의 칸(fx,fy) 하나에 펜/지우개 — 테스트에서도 부른다 */
window.rxDecoPaintAt = function(fx, fy){
  var d = RXL.d, L = RXL.last; if (!d || !L) return false;
  if (fx < 0 || fy < 0 || fx >= L.w || fy >= L.h) return false;
  var key = (fx - L.padL) + ',' + (fy - L.padT), v = d.tool === 'eraser' ? '' : d.color;
  if (d.edits[key] === v) return false;
  d.edits[key] = v; rxDecoDraw(); return true;
};
window.rxDecoDraw = function(){
  var d = RXL.d; if (!d) return;
  var bg = rxBossGrid(d.base); if (!bg) return;
  var c = rxDecoCompose(bg, d); RXL.last = c;
  var cv = document.getElementById('rxd-cv');
  if (cv){
    var z = Math.max(5, Math.min(14, Math.floor(560 / Math.max(c.w, c.h)))); RXL.z = z;
    cv.width = c.w * z; cv.height = c.h * z;
    var x2 = cv.getContext('2d'); x2.imageSmoothingEnabled = false;
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++){
      var v = c.grid[y][x];
      x2.fillStyle = v || (((x + y) % 2) ? '#e2e8f0' : '#f8fafc');
      x2.fillRect(x * z, y * z, z, z);
    }
    x2.strokeStyle = 'rgba(15,23,42,.08)'; x2.lineWidth = 1;
    for (var gx = 0; gx <= c.w; gx++){ x2.beginPath(); x2.moveTo(gx * z + 0.5, 0); x2.lineTo(gx * z + 0.5, c.h * z); x2.stroke(); }
    for (var gy = 0; gy <= c.h; gy++){ x2.beginPath(); x2.moveTo(0, gy * z + 0.5); x2.lineTo(c.w * z, gy * z + 0.5); x2.stroke(); }
  }
  var sm = document.getElementById('rxd-small'), A = window.RAIDART;
  if (sm && A){ sm.innerHTML = ''; sm.appendChild(A.cvOf(c.grid, Math.max(1, Math.floor(150 / Math.max(c.w, c.h))))); }
  var sz = document.getElementById('rxd-size');
  if (sz) sz.textContent = c.w + ' x ' + c.h + ' · ' + rxEncodeGrid(c.grid).pal.length + '색 · 점 찍은 칸 ' + Object.keys(d.edits).length;
};
function rxDecoMount(){
  rxDecoDraw();
  var cv = document.getElementById('rxd-cv'); if (!cv) return;
  var down = false;
  var at = function(ev){
    var r = cv.getBoundingClientRect(), L = RXL.last; if (!L || !r.width) return;
    rxDecoPaintAt(Math.floor((ev.clientX - r.left) * L.w / r.width), Math.floor((ev.clientY - r.top) * L.h / r.height));
  };
  cv.addEventListener('pointerdown', function(ev){ down = true; try { cv.setPointerCapture(ev.pointerId); } catch(e){} at(ev); ev.preventDefault(); });
  cv.addEventListener('pointermove', function(ev){ if (down) at(ev); });
  var up = function(){ if (down){ down = false; var sz = document.getElementById('rxd-size'); if (sz) rxDecoDraw(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
}
function rxDecoHtml(){
  var d = RXL.d, bg = rxBossGrid(d.base);
  RXL.dpal = bg ? rxEncodeGrid(bg).pal : [];
  var last = bg ? rxDecoCompose(bg, d) : null;
  var cur = last ? rxEncodeGrid(last.grid).pal.slice(0, 28) : [];
  var sec = function(t){ return '<div style="font-size:12.5px;font-weight:900;color:#241c56;margin:12px 0 6px">' + t + '</div>'; };
  var tog = function(id, k, on, label){ return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:#334155;cursor:pointer;margin-right:10px"><input type="checkbox" id="' + id + '" ' + (on ? 'checked ' : '') + 'onchange="rxDecoSet(\'' + k + '\',this.checked)">' + label + '</label>'; };
  var sb = function(id, on, act, label){ return '<button id="' + id + '" onclick="' + act + '" style="border-radius:8px;padding:5px 11px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;' + (on ? 'background:#7c3aed;color:#fff;border:1.5px solid #7c3aed' : 'background:#fff;color:#475569;border:1.5px solid #e2e8f0') + '">' + label + '</button>'; };
  var h = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="font-size:17px;font-weight:900;color:#241c56">🎨 보스 꾸미기</div>'
    + '<span style="font-size:11.5px;color:#64748b;font-weight:700">바탕 「' + esc2(rxBossName(d.base)) + '」 · 저장하면 보관함에 새 보스로 들어갑니다(바탕은 그대로)</span>'
    + '<span style="margin-left:auto;display:flex;gap:6px"><button id="rxd-back" onclick="RXL.view=\'list\';RXL.d=null;rxLibRender()" style="' + RX_BTN + ';background:#f1f5f9;color:#334155">← 보관함</button>'
    + '<button onclick="rxLibClose()" style="' + RX_BTN + ';background:#f1f5f9;color:#334155">✕</button></span></div>';
  h += '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">';
  /* 왼쪽: 확대 격자 */
  h += '<div style="flex:1 1 380px;min-width:0">'
    + '<div style="overflow:auto;max-width:100%;max-height:72vh;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;line-height:0">'
    + '<canvas id="rxd-cv" style="touch-action:none;cursor:crosshair;display:block"></canvas></div>'
    + '<div style="display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap"><div id="rxd-small" style="background:#0d0a1d;border-radius:9px;padding:8px;line-height:0;min-width:60px;min-height:60px"></div>'
    + '<div id="rxd-size" style="font-size:11.5px;color:#64748b;font-weight:800"></div></div></div>';
  /* 오른쪽: 조절 */
  h += '<div style="flex:1 1 300px;min-width:0">';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + rxLbl('바탕 보스', '<select id="rxd-base" onchange="rxDecoSet(\'base\',this.value)" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-weight:800;font-family:inherit;max-width:100%">'
      + rxPickList().map(function(x){ return '<option value="' + esc2(x.key) + '"' + (x.key === d.base ? ' selected' : '') + '>' + esc2(rxPickLabel(x)) + '</option>'; }).join('') + '</select>')
    + rxLbl('새 보스 이름', '<input id="rxd-name" value="' + esc2(d.name) + '" oninput="rxDecoSet(\'name\',this.value)" style="width:200px;max-width:100%;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:800;font-family:inherit;box-sizing:border-box">')
    + '</div>';
  h += sec('🎨 색 바꾸기 <span style="font-size:11px;color:#94a3b8;font-weight:700">색을 눌러 고르기 · 테두리 색은 색조 돌리기에서 빠집니다</span>')
    + '<div id="rxd-pal" style="display:flex;gap:5px;flex-wrap:wrap">';
  RXL.dpal.forEach(function(c, i){
    var now = d.map[c] || c;
    h += '<label title="' + esc2(c) + '" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer"><input type="color" class="rxd-pc" data-i="' + i + '" value="' + rxHex(now) + '" onchange="rxDecoSet(\'map:' + i + '\',this.value)" style="width:30px;height:26px;border:1px solid #cbd5e1;border-radius:6px;padding:0;background:none;cursor:pointer">'
      + (d.map[c] ? '<span style="font-size:9px;color:#7c3aed;font-weight:900">바뀜</span>' : '<span style="font-size:9px;color:transparent">·</span>') + '</label>';
  });
  h += '</div><div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap"><span style="font-size:11.5px;font-weight:800;color:#475569">전체 색조 돌리기</span>'
    + '<input id="rxd-hue" type="range" min="-180" max="180" step="5" value="' + (d.hue || 0) + '" oninput="rxDecoSet(\'hue\',this.value)" onchange="rxLibRender()" style="flex:1;min-width:120px">'
    + '<b id="rxd-huev" style="font-size:11.5px;color:#7c3aed;width:42px">' + (d.hue || 0) + '°</b>'
    + '<button onclick="rxDecoSet(\'reset\')" style="padding:4px 9px;border:1px solid #e2e8f0;background:#fff;border-radius:7px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">색 처음대로</button></div>';
  h += sec('➕ 얹기 <span style="font-size:11px;color:#94a3b8;font-weight:700">머리 위 · 가운데 — 모자라면 위로 칸이 늘어납니다</span>')
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:11.5px;font-weight:800;color:#475569">머리</span>'
    + sb('rxd-head-none', !d.head, 'rxDecoSet(\'head\',\'\')', '없음') + sb('rxd-head-crown', d.head === 'crown', 'rxDecoSet(\'head\',\'crown\')', RX_STAMPS.crown.name) + sb('rxd-head-helmet', d.head === 'helmet', 'rxDecoSet(\'head\',\'helmet\')', RX_STAMPS.helmet.name)
    + (d.head ? '<span style="margin-left:6px;display:inline-flex;gap:3px">' + ['l:◀', 'u:▲', 'd:▼', 'r:▶'].map(function(q){ var a = q.split(':'); return '<button onclick="rxDecoSet(\'nudge:' + a[0] + '\')" title="자리 옮기기" style="padding:3px 7px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit;font-size:11px">' + a[1] + '</button>'; }).join('') + '</span>' : '')
    + '</div><div style="margin-top:7px">' + tog('rxd-band', 'band', d.band, '🛡 갑옷 띠') + tog('rxd-flame', 'flame', d.flame, '🔥 불꽃 기운') + tog('rxd-spark', 'spark', d.spark, '✨ 별 반짝이') + '</div>';
  h += sec('✏️ 점 찍기 <span style="font-size:11px;color:#94a3b8;font-weight:700">왼쪽 확대 격자를 누르거나 끌기</span>')
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
    + sb('rxd-pen', d.tool !== 'eraser', 'rxDecoSet(\'tool\',\'pen\')', '🖊 펜') + sb('rxd-eraser', d.tool === 'eraser', 'rxDecoSet(\'tool\',\'eraser\')', '🧽 지우개')
    + '<input type="color" id="rxd-color" value="' + rxHex(d.color) + '" onchange="rxDecoSet(\'color\',this.value)" title="펜 색" style="width:34px;height:28px;border:1px solid #cbd5e1;border-radius:6px;padding:0;cursor:pointer">'
    + '<button onclick="rxDecoSet(\'clear\')" style="padding:4px 9px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:7px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">점 찍은 것 모두 지우기</button></div>'
    + '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">' + cur.map(function(c){ return '<button onclick="rxDecoSet(\'color\',\'' + esc2(c) + '\')" title="' + esc2(c) + '" style="width:18px;height:18px;border-radius:4px;border:' + (rxHex(c) === rxHex(d.color) ? '2px solid #7c3aed' : '1px solid #cbd5e1') + ';background:' + esc2(c) + ';cursor:pointer;padding:0"></button>'; }).join('') + '</div>';
  h += '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button id="rxd-save" onclick="rxDecoSave()" ' + (RXL.busy ? 'disabled ' : '') + 'style="' + RX_BTN + ';background:#0d2240;color:#fff;padding:10px 18px">' + (RXL.busy ? '⏳ 저장 중…' : '💾 새 보스로 보관함에 저장') + '</button></div>';
  h += '</div></div>';
  return h;
}
window.rxDecoSave = async function(){
  var d = RXL.d; if (!d || RXL.busy) return;
  var nm = String(d.name || '').trim(); if (!nm){ plToast('새 보스 이름을 적어 주세요'); return; }
  var bg = rxBossGrid(d.base); if (!bg){ plToast('바탕 그림이 없습니다'); return; }
  var c = rxDecoCompose(bg, d), e = rxEncodeGrid(c.grid), now = rxNow();
  var src = rxLibBoss(d.base) || rxArtBoss(d.base) || {};
  var boss = { key: '', name: nm, en: src.en || 'CUSTOM', tag: e.w + ' x ' + e.h + ' · 원장님 꾸미기', desc: '「' + rxBossName(d.base) + '」을 바탕으로 꾸민 보스',
    w: e.w, h: e.h, pal: e.pal, rows: e.rows, by: 'teacher', base: d.base, created: now, log: [] };
  RXL.busy = true; rxLibRender();
  try {
    var key = await rxLibAddBoss(boss);
    plToast('💾 「' + nm + '」을 보관함에 넣었습니다 (' + key + ') — 레이드 보스 고르기에 나옵니다');
    RXL.view = 'list'; RXL.d = null;
  } catch(e2){ plToast('저장 실패: ' + (e2.message || e2)); }
  RXL.busy = false; rxLibRender(); if (VIEW === 'race') render();
};
