# 학생앱 v2-146 조립 — «v2-145 복사 + rep 고침»
#   원장 2026-10-19 「학생앱에 영상을 볼때 유튜브로 가는것을 막을 수 있나? 구현」
#   🛡 루멘 영상 플레이어(LYP): 유튜브 조작 막대를 끄고 영상 위에 투명 방패를 덮어
#   로고·제목·공유·채널·추천 영상·「YouTube에서 보기」를 누를 수 없게 한다.
#   재생/멈춤 · 10초 앞뒤 · 진행 막대 · 배속 · 전체 화면은 우리 단추로.
#   쓰는 곳: ① 🎬 강의실(screen-vod-play, vs3*) ② ✍️ 손풀이 문항 카드의 🎬 풀이 영상(hsbVidToggle)
#   시청 기록(vod_watch_logs) 은 예전과 똑같이 vs3OnState / vs3OnRate 가 남긴다.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-145.html'); DST = os.path.join(ROOT, 'student_v2-146.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-145';", "var STU_VER = 'v2-146';")

# ── CSS ─────────────────────────────────────────────────────────────
CSS = r"""
/* ★ v2-146 🛡 루멘 영상 플레이어(LYP) — 유튜브로 빠져나가는 길을 막는 틀 */
.lyp{position:relative;width:100%;background:#000;color:#fff;font-family:inherit;-webkit-user-select:none;user-select:none;}
.lyp-stage{position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden;}
.lyp .lyp-stage iframe{position:absolute;left:0;top:0;width:100%;height:100%;border:0;display:block;}
.lyp-shield{position:absolute;left:0;top:0;right:0;bottom:0;z-index:2;background:rgba(0,0,0,0);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}
.lyp-strip{display:none;position:absolute;z-index:2;background:rgba(0,0,0,0);touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}
.lyp-s-t{left:0;right:0;top:0;height:30%;} .lyp-s-b{left:0;right:0;bottom:0;height:30%;}
.lyp-s-l{left:0;top:30%;height:40%;width:30%;} .lyp-s-r{right:0;top:30%;height:40%;width:30%;}
.lyp-s-t span{position:absolute;left:50%;top:10px;transform:translateX(-50%);white-space:nowrap;background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:800;padding:6px 12px;border-radius:20px;}
.lyp.lyp-first .lyp-shield{display:none;}
.lyp.lyp-first .lyp-strip{display:block;}
.lyp-cover{position:absolute;left:0;top:0;right:0;bottom:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:#0b1220 center/cover no-repeat;text-align:center;padding:12px 16px;cursor:pointer;}
.lyp-cover[hidden]{display:none;}
.lyp-cover.pause{background:rgba(8,15,30,.9);}
.lyp-cover.end{background:#0b1220;cursor:default;}
.lyp-cover.load{cursor:default;color:#94a3b8;font-size:13px;font-weight:800;}
.lyp-cover .ct{font-size:13px;font-weight:900;color:#fff;line-height:1.4;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;text-shadow:0 1px 3px rgba(0,0,0,.6);}
.lyp-cover .cs{font-size:11px;color:#cbd5e1;font-weight:700;}
.lyp-big{width:62px;height:62px;border-radius:50%;border:none;background:#1d6fe8;color:#fff;font-size:24px;line-height:62px;padding:0 0 0 4px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);font-family:inherit;}
.lyp-big.re{padding:0;font-size:15px;font-weight:900;width:auto;height:40px;line-height:40px;border-radius:20px;padding:0 18px;}
.lyp-peek{background:rgba(255,255,255,.14);color:#e2e8f0;border:none;border-radius:16px;padding:6px 12px;font-size:11px;font-weight:800;font-family:inherit;cursor:pointer;}
.lyp-flash{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:4;background:rgba(0,0,0,.74);color:#fff;font-size:12px;font-weight:800;padding:6px 13px;border-radius:20px;pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;}
.lyp-flash.on{opacity:1;}
.lyp-bar{background:#0f172a;padding:4px 10px 8px;}
.lyp-row{display:flex;align-items:center;gap:7px;}
.lyp-row + .lyp-row{margin-top:3px;}
.lyp-t{font-size:11px;font-weight:700;color:#cbd5e1;min-width:36px;text-align:center;font-variant-numeric:tabular-nums;}
.lyp-prog{flex:1;min-width:0;height:24px;margin:0;accent-color:#3b82f6;cursor:pointer;background:transparent;}
.lyp-b{background:rgba(255,255,255,.1);color:#fff;border:none;border-radius:9px;height:34px;min-width:42px;padding:0 10px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;}
.lyp-b:active{background:rgba(255,255,255,.22);}
.lyp-b:focus-visible,.lyp-prog:focus-visible,.lyp-big:focus-visible,.lyp-peek:focus-visible{outline:2px solid #60a5fa;outline-offset:2px;}
.lyp-sp{flex:1;}
.lyp:fullscreen{display:flex;flex-direction:column;width:100%;height:100%;}
.lyp:-webkit-full-screen{display:flex;flex-direction:column;width:100%;height:100%;}
.lyp:fullscreen .lyp-stage{flex:1;aspect-ratio:auto;height:auto;min-height:0;}
.lyp:-webkit-full-screen .lyp-stage{flex:1;aspect-ratio:auto;height:auto;min-height:0;}
/* 꽉 찬 화면: 100vw/100vh 는 글씨 크기(body zoom)에 함께 부풀어 화면 밖으로 나가므로 네 변 0 으로만 맞춘다 */
.lyp.lyp-full{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;width:auto;height:auto;display:flex;flex-direction:column;}
.lyp.lyp-full .lyp-stage{flex:1;aspect-ratio:auto;height:auto;min-height:0;}
.lyp.lyp-full .lyp-bar{padding-bottom:calc(8px + env(safe-area-inset-bottom));}
body.lyp-lock{overflow:hidden;}
"""
rep(""".vs3-playwrap{position:relative;width:100%;background:#000;aspect-ratio:16/9;flex-shrink:0;}
.vs3-playwrap iframe,.vs3-playwrap #vs3-yt{position:absolute;inset:0;width:100%;height:100%;border:none;}
""", """.vs3-playwrap{position:relative;width:100%;background:#000;flex-shrink:0;}   /* v2-146: 16:9 는 LYP 무대가 맡는다 */
""" + CSS)
rep(""".hsb-play{width:100%;aspect-ratio:16/9;border-radius:13px;overflow:hidden;background:#000;margin-bottom:10px}""",
    """.hsb-play{width:100%;border-radius:13px;overflow:hidden;background:#000;margin-bottom:10px}   /* v2-146: 16:9 는 LYP 무대가 맡는다 */""")

# ── 강의실 화면 틀 ──────────────────────────────────────────────────
rep("""    <div class="vs3-playwrap"><div id="vs3-yt"></div></div>""",
    """    <div class="vs3-playwrap" id="vs3-playhost"><div id="vs3-yt"></div></div>""")

# ── 플레이어 부품 (ES5) ─────────────────────────────────────────────
LYP = r"""/* ══ v2-146 🛡 루멘 영상 플레이어(LYP) ═══════════════════════════════════
 * 원장 2026-10-19 「학생앱에 영상을 볼때 유튜브로 가는것을 막을 수 있나? 구현」
 * · 유튜브 자체 조작 막대를 끈다: controls:0 · fs:0 · disablekb:1 · rel:0 · iv_load_policy:3 · modestbranding:1
 * · 영상(iframe) 위를 투명 «방패»가 통째로 덮는다 → 유튜브 로고·제목·채널 사진·공유·나중에 볼 동영상·
 *   「YouTube에서 보기」·추천 영상·끝 화면 카드 어느 것도 눌리지 않는다. 방패를 톡 = 재생/멈춤,
 *   왼쪽/오른쪽을 두 번 톡 = 10초 뒤로/앞으로.
 * · 재생/멈춤 · −10초 · +10초 · 진행 막대(끌기/누르기) · 배속 · 전체 화면은 아래 우리 막대가 한다.
 *   전체 화면은 «우리 틀»을 키운다(방패·막대가 그대로 위에 있음). 아이폰처럼 틀 전체 화면이 안 되면
 *   CSS 로 화면을 꽉 채운다(lyp-full). 유튜브 자체 전체 화면은 쓰지 않는다.
 * · 멈춤·끝·시작 전에는 우리 판(cover)이 영상을 덮는다 → 멈춤/끝 추천 영상이 보이지도 눌리지도 않는다.
 *   멈춘 칠판을 베껴 쓰고 싶으면 「🔍 멈춘 화면 보기」 — 판만 걷고 방패는 그대로라 눌러도 못 나간다.
 * · 아이폰에서 첫 재생이 우리 ▶로 시작되지 않으면(유튜브가 «영상 안을 직접 눌러야» 하는 경우),
 *   3초 뒤 가운데만 잠깐 열어 유튜브 ▶를 한 번 누르게 한다. 가장자리(제목·로고·공유)는 그대로 막힌다.
 *   재생이 시작되면 다시 전부 막는다.
 * 한계: 이것은 «앱 안에서 영상을 보다가 유튜브로 넘어가는 길»만 막는다. 학생이 앱 밖에서 유튜브 앱/사이트를
 *   따로 여는 것, 영상 주소를 알고 직접 찾아보는 것은 막을 수 없다(유튜브 «일부 공개»여도 주소가 있으면 열린다).
 * ═══════════════════════════════════════════════════════════════════ */
var LYP = { seq:0, list:[], rates:[0.75, 1, 1.25, 1.5, 2] };
function lypEsc(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function lypFmt(sec){ sec=Math.max(0,Math.floor(sec||0)); var h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), x=sec%60;
  return (h?(h+':'+(m<10?'0':'')):'')+m+':'+(x<10?'0':'')+x; }
function lypRateTxt(r){ return (Math.round((r||1)*100)/100)+'×'; }
/* 유튜브 플레이어 설정 — 유튜브 자체 조작·전체 화면·키보드를 끈다 */
function lypPlayerVars(start){
  var pv = { controls:0, disablekb:1, fs:0, rel:0, iv_load_policy:3, playsinline:1, modestbranding:1 };
  if (start > 0) pv.start = Math.floor(start);
  return pv;
}
/* host 안에 틀을 만들고 유튜브 플레이어를 붙인다.
 * opt: { videoId, start, title, ytElId, maxRate, dur, onPlayer(p), onStateChange(e), onPlaybackRateChange(e) } */
function lypCreate(host, opt){
  opt = opt || {};
  var id = 'lyp' + (++LYP.seq);
  var ytId = opt.ytElId || (id + '-yt');
  var c = { id:id, host:host, opt:opt, player:null, ready:false, state:-1, started:false, first:false, peek:false,
            dur:opt.dur||0, dragging:false, full:'', cmode:'', timer:null, tapT:null, lastTap:0, firstTry:null, flashT:null, dead:false };
  host.innerHTML = '<div class="lyp" id="'+id+'" tabindex="-1">'
    + '<div class="lyp-stage">'
    +   '<div id="'+lypEsc(ytId)+'"></div>'
    +   '<div class="lyp-shield" aria-hidden="true"></div>'
    +   '<div class="lyp-strip lyp-s-t" aria-hidden="true"><span>가운데 ▶를 한 번 눌러 주세요</span></div>'
    +   '<div class="lyp-strip lyp-s-b" aria-hidden="true"></div>'
    +   '<div class="lyp-strip lyp-s-l" aria-hidden="true"></div>'
    +   '<div class="lyp-strip lyp-s-r" aria-hidden="true"></div>'
    +   '<div class="lyp-cover load">⏳ 영상 불러오는 중…</div>'
    +   '<div class="lyp-flash" aria-live="polite"></div>'
    + '</div>'
    + '<div class="lyp-bar">'
    +   '<div class="lyp-row">'
    +     '<span class="lyp-t lyp-cur">0:00</span>'
    +     '<input class="lyp-prog" type="range" min="0" max="'+Math.max(1,Math.floor(c.dur))+'" step="1" value="0" aria-label="재생 위치">'
    +     '<span class="lyp-t lyp-dur">'+(c.dur?lypFmt(c.dur):'0:00')+'</span>'
    +   '</div>'
    +   '<div class="lyp-row">'
    +     '<button type="button" class="lyp-b lyp-play" aria-label="재생">▶</button>'
    +     '<button type="button" class="lyp-b lyp-back" aria-label="10초 뒤로">−10초</button>'
    +     '<button type="button" class="lyp-b lyp-fwd" aria-label="10초 앞으로">+10초</button>'
    +     '<span class="lyp-sp"></span>'
    +     '<button type="button" class="lyp-b lyp-rate" aria-label="재생 속도 1배 (누르면 바뀜)">1×</button>'
    +     '<button type="button" class="lyp-b lyp-fs" aria-label="전체 화면">⛶</button>'
    +   '</div>'
    + '</div></div>';
  var w = host.querySelector('.lyp'); c.wrap = w;
  c.shield = w.querySelector('.lyp-shield'); c.cover = w.querySelector('.lyp-cover'); c.flashEl = w.querySelector('.lyp-flash');
  c.prog = w.querySelector('.lyp-prog'); c.curEl = w.querySelector('.lyp-cur'); c.durEl = w.querySelector('.lyp-dur');
  c.playBtn = w.querySelector('.lyp-play'); c.rateBtn = w.querySelector('.lyp-rate'); c.fsBtn = w.querySelector('.lyp-fs');
  /* 방패: 톡 = 재생/멈춤 · 두 번 톡(왼쪽/오른쪽) = 10초 뒤로/앞으로 */
  c.shield.addEventListener('click', function(ev){
    var now = Date.now(), r = c.shield.getBoundingClientRect();
    var x = r.width ? (ev.clientX - r.left) / r.width : 0.5;
    if (c.lastTap && now - c.lastTap < 300){
      if (c.tapT){ clearTimeout(c.tapT); c.tapT = null; }
      c.lastTap = 0;
      if (x < 0.4) lypSkip(c, -10); else if (x > 0.6) lypSkip(c, 10); else lypToggle(c);
      return;
    }
    c.lastTap = now;
    if (c.tapT) clearTimeout(c.tapT);
    c.tapT = setTimeout(function(){ c.tapT = null; lypToggle(c); }, 280);
  });
  var stop = function(ev){ ev.preventDefault(); };
  c.shield.addEventListener('contextmenu', stop);
  c.shield.addEventListener('dblclick', stop);
  var strips = w.querySelectorAll('.lyp-strip');
  for (var i = 0; i < strips.length; i++) strips[i].addEventListener('contextmenu', stop);
  /* 덮개 판: 시작 전·멈춤 → 누르면 바로 재생(사용자 손길 안에서 playVideo) */
  c.cover.addEventListener('click', function(ev){
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-act') === 'peek'){ c.peek = true; lypPaint(c); lypFlash(c, '⏸ 멈춤 · 화면을 누르면 이어 봐요'); return; }
    if (t && t.getAttribute && t.getAttribute('data-act') === 'replay'){ lypReplay(c); return; }
    if (c.cmode === 'start' || c.cmode === 'pause') lypPlay(c);
  });
  c.cover.addEventListener('contextmenu', stop);
  c.playBtn.addEventListener('click', function(){ lypToggle(c); });
  w.querySelector('.lyp-back').addEventListener('click', function(){ lypSkip(c, -10); });
  w.querySelector('.lyp-fwd').addEventListener('click', function(){ lypSkip(c, 10); });
  c.rateBtn.addEventListener('click', function(){ lypNextRate(c); });
  c.fsBtn.addEventListener('click', function(){ lypFsToggle(c); });
  c.prog.addEventListener('input', function(){ c.dragging = true; c.curEl.textContent = lypFmt(+c.prog.value); lypProgFill(c); });
  c.prog.addEventListener('change', function(){
    c.dragging = false;
    if (c.player && c.player.seekTo){ try{ c.player.seekTo(+c.prog.value, true); }catch(e){} }
  });
  /* 키보드: 스페이스/K = 재생·멈춤, ←/→ = 10초, F = 전체 화면, Esc = 꽉 찬 화면 끄기 */
  w.addEventListener('keydown', function(ev){
    var k = ev.key, tag = (ev.target && ev.target.tagName) || '';
    if (k === 'Escape' && c.full === 'css'){ lypFsExit(c); ev.preventDefault(); return; }
    if (tag === 'INPUT') return;                                   /* 진행 막대는 제 방향키를 쓴다 */
    if (tag === 'BUTTON' && (k === ' ' || k === 'Enter')) return;  /* 단추는 제 동작 */
    if (k === ' ' || k === 'k' || k === 'K'){ lypToggle(c); ev.preventDefault(); }
    else if (k === 'ArrowLeft'){ lypSkip(c, -10); ev.preventDefault(); }
    else if (k === 'ArrowRight'){ lypSkip(c, 10); ev.preventDefault(); }
    else if (k === 'f' || k === 'F'){ lypFsToggle(c); ev.preventDefault(); }
  });
  LYP.list.push(c);
  c.timer = setInterval(function(){ lypTick(c); }, 250);
  vs3LoadYT(function(){
    if (c.dead) return;
    c.player = new YT.Player(ytId, { videoId:opt.videoId, playerVars:lypPlayerVars(opt.start||0), events:{
      onReady: function(e){ lypReady(c); },
      onStateChange: function(e){ lypOnState(c, e); if (opt.onStateChange) opt.onStateChange(e); },
      onPlaybackRateChange: function(e){ lypOnRate(c, e); if (opt.onPlaybackRateChange) opt.onPlaybackRateChange(e); },
      onError: function(e){ c.ready = true; c.cmode = ''; c.err = true; lypPaint(c); }
    } });
    if (opt.onPlayer) opt.onPlayer(c.player);
  });
  return c;
}
function lypReady(c){
  if (c.dead) return;
  c.ready = true;
  try{ var f = c.wrap.querySelector('iframe'); if (f){ f.setAttribute('tabindex','-1'); f.setAttribute('title', (c.opt.title||'영상')); } }catch(e){}
  try{ var d = c.player.getDuration(); if (d > 0) c.dur = d; }catch(e){}
  try{ c.rateBtn.textContent = lypRateTxt(c.player.getPlaybackRate()||1); }catch(e){}
  lypPaint(c); lypTick(c);
}
function lypOnState(c, e){
  if (c.dead) return;
  var st = e ? e.data : -1;
  c.state = st; c.ready = true; c.peek = false;
  if (st === 1){
    c.started = true;
    if (c.firstTry){ clearTimeout(c.firstTry); c.firstTry = null; }
    if (c.first) lypFirst(c, false);
  }
  lypPaint(c); lypTick(c);
}
function lypOnRate(c, e){
  if (c.dead) return;
  var r = (e && e.data) || 1;
  try{ r = c.player.getPlaybackRate() || r; }catch(err){}
  c.rateBtn.textContent = lypRateTxt(r);
  c.rateBtn.setAttribute('aria-label', '재생 속도 '+lypRateTxt(r).replace('×','배')+' (누르면 바뀜)');
}
function lypRates(c){
  var mx = +c.opt.maxRate || 0;
  return LYP.rates.filter(function(r){ return !mx || r <= mx + 1e-9; });
}
function lypNextRate(c){
  if (!c.player || !c.player.setPlaybackRate) return;
  var cur = 1; try{ cur = c.player.getPlaybackRate() || 1; }catch(e){}
  var rs = lypRates(c), nx = rs[0];
  for (var i = 0; i < rs.length; i++){ if (rs[i] > cur + 1e-9){ nx = rs[i]; break; } }
  try{ c.player.setPlaybackRate(nx); }catch(e){}
  c.rateBtn.textContent = lypRateTxt(nx);
  lypFlash(c, '속도 ' + lypRateTxt(nx));
}
function lypPlay(c){
  if (!c.player || !c.player.playVideo) return;
  try{ c.player.playVideo(); }catch(e){}
  if (!c.started && !c.firstTry){
    c.firstTry = setTimeout(function(){ c.firstTry = null; if (!c.started && !c.dead) lypFirst(c, true); }, 3000);
  }
}
function lypToggle(c){
  if (!c.player) return;
  var st = c.state; try{ st = c.player.getPlayerState(); }catch(e){}
  if (st === 1 || st === 3){ try{ c.player.pauseVideo(); }catch(e){} }
  else if (st === 0) lypReplay(c);
  else lypPlay(c);
}
function lypReplay(c){
  if (!c.player) return;
  try{ c.player.seekTo(c.opt.start||0, true); }catch(e){}
  lypPlay(c);
}
function lypSkip(c, d){
  if (!c.player || !c.player.seekTo) return;
  var cur = 0; try{ cur = c.player.getCurrentTime() || 0; }catch(e){}
  var dur = c.dur; try{ dur = c.player.getDuration() || dur; }catch(e){}
  var t = Math.max(0, cur + d); if (dur > 0) t = Math.min(t, Math.max(0, dur - 0.5));
  try{ c.player.seekTo(t, true); }catch(e){}
  lypFlash(c, (d < 0 ? '−' : '+') + Math.abs(d) + '초');
  c.prog.value = Math.floor(t); c.curEl.textContent = lypFmt(t); lypProgFill(c);
}
/* 아이폰 첫 재생 길: 가운데만 열고 가장자리는 막는다 */
function lypFirst(c, on){
  c.first = !!on;
  if (on) c.wrap.classList.add('lyp-first'); else c.wrap.classList.remove('lyp-first');
  lypPaint(c);
}
function lypFlash(c, msg){
  if (!c.flashEl) return;
  c.flashEl.textContent = msg; c.flashEl.classList.add('on');
  if (c.flashT) clearTimeout(c.flashT);
  c.flashT = setTimeout(function(){ c.flashEl.classList.remove('on'); }, msg.length > 12 ? 2600 : 900);
}
function lypProgFill(c){
  var mx = +c.prog.max || 1, v = +c.prog.value || 0;
  c.prog.setAttribute('aria-valuetext', lypFmt(v) + ' / ' + lypFmt(mx));
}
function lypTick(c){
  if (c.dead) return;
  if (!document.documentElement.contains(c.wrap)){ lypDestroy(c); return; }   /* 화면이 다시 그려져 틀이 사라졌으면 정리 */
  if (!c.player || !c.ready) return;
  var d = 0; try{ d = c.player.getDuration() || 0; }catch(e){}
  if (d > 0 && Math.floor(d) !== Math.floor(c.dur)) c.dur = d;
  if (c.dur > 0){ var mx = String(Math.max(1, Math.floor(c.dur))); if (c.prog.max !== mx) c.prog.max = mx; c.durEl.textContent = lypFmt(c.dur); }
  if (!c.dragging){
    var t = 0; try{ t = c.player.getCurrentTime() || 0; }catch(e){}
    c.prog.value = Math.floor(t); c.curEl.textContent = lypFmt(t); lypProgFill(c);
  }
}
function lypPaint(c){
  if (c.dead) return;
  var st = c.state, playing = (st === 1 || st === 3);
  c.playBtn.textContent = playing ? '⏸' : '▶';
  c.playBtn.setAttribute('aria-label', playing ? '일시정지' : '재생');
  var mode;
  if (c.err) mode = 'err';
  else if (!c.ready) mode = 'load';
  else if (playing) mode = '';
  else if (st === 0) mode = 'end';
  else if (c.first && !c.started) mode = '';
  else if (st === 2) mode = c.peek ? '' : (c.started ? 'pause' : 'start');
  else mode = 'start';
  if (mode === c.cmode) return;
  c.cmode = mode;
  var cv = c.cover, ttl = c.opt.title ? '<div class="ct">'+lypEsc(c.opt.title)+'</div>' : '';
  cv.className = 'lyp-cover' + (mode ? ' ' + mode : '');
  cv.style.backgroundImage = '';
  if (!mode){ cv.hidden = true; cv.innerHTML = ''; return; }
  cv.hidden = false;
  if (mode === 'load') cv.innerHTML = '⏳ 영상 불러오는 중…';
  else if (mode === 'err') cv.innerHTML = '<div class="ct">⚠️ 영상을 불러오지 못했어요</div><div class="cs">잠시 뒤 다시 열거나 선생님께 알려 주세요</div>';
  else if (mode === 'start'){
    if (c.opt.videoId) cv.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url("https://i.ytimg.com/vi/'+encodeURIComponent(c.opt.videoId)+'/hqdefault.jpg")';
    cv.innerHTML = '<button type="button" class="lyp-big" aria-label="재생">▶</button>' + ttl;
  }
  else if (mode === 'pause') cv.innerHTML = '<button type="button" class="lyp-big" aria-label="이어서 재생">▶</button>' + ttl
    + '<div class="cs">멈춤 · 누르면 이어서 봐요</div><button type="button" class="lyp-peek" data-act="peek">🔍 멈춘 화면 보기</button>';
  else if (mode === 'end') cv.innerHTML = '<div class="ct" style="font-size:17px">다 봤어요 ✅</div>' + ttl
    + '<button type="button" class="lyp-big re" data-act="replay" aria-label="처음부터 다시 보기">↺ 다시 보기</button>';
}
/* 전체 화면 — 우리 틀(방패+막대)을 키운다. 안 되면 CSS 로 꽉 채운다(아이폰) */
function lypFsToggle(c){
  if (c.full){ lypFsExit(c); return; }
  var el = c.wrap, req = el.requestFullscreen || el.webkitRequestFullscreen;
  var can = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (req && can){
    c.full = 'native';
    try{
      var p = req.call(el);
      if (p && p.then) p.then(function(){
        try{ if (screen.orientation && screen.orientation.lock){ var q = screen.orientation.lock('landscape'); if (q && q['catch']) q['catch'](function(){}); } }catch(e){}
      }, function(){ if (c.full === 'native'){ c.full = ''; lypCssFull(c, true); } });
    }catch(e){ c.full = ''; lypCssFull(c, true); }
  } else lypCssFull(c, true);
  lypFsPaint(c);
}
function lypFsExit(c){
  if (c.full === 'css') lypCssFull(c, false);
  else if (c.full === 'native'){
    c.full = '';
    try{
      var fe = document.fullscreenElement || document.webkitFullscreenElement;
      if (fe === c.wrap){ if (document.exitFullscreen) document.exitFullscreen()['catch'](function(){}); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }
    }catch(e){}
  }
  lypFsPaint(c);
}
function lypCssFull(c, on){
  if (on){
    c.full = 'css'; c.wrap.classList.add('lyp-full'); document.body.classList.add('lyp-lock');
    if (window.innerHeight > window.innerWidth) lypFlash(c, '📱 휴대폰을 옆으로 돌리면 더 크게 보여요');
  } else {
    c.full = ''; c.wrap.classList.remove('lyp-full');
    var any = false; LYP.list.forEach(function(o){ if (o !== c && o.full === 'css') any = true; });
    if (!any) document.body.classList.remove('lyp-lock');
  }
  lypFsPaint(c);
}
function lypFsPaint(c){
  if (!c.fsBtn) return;
  c.fsBtn.textContent = c.full ? '🗗' : '⛶';
  c.fsBtn.setAttribute('aria-label', c.full ? '전체 화면 끄기' : '전체 화면');
}
function lypOnFsChange(){
  var fe = document.fullscreenElement || document.webkitFullscreenElement;
  LYP.list.forEach(function(c){ if (c.full === 'native' && fe !== c.wrap){ c.full = ''; lypFsPaint(c); } });
}
document.addEventListener('fullscreenchange', lypOnFsChange);
document.addEventListener('webkitfullscreenchange', lypOnFsChange);
function lypDestroy(c){
  if (!c || c.dead) return;
  if (c.full) lypFsExit(c);
  c.dead = true;
  if (c.timer){ clearInterval(c.timer); c.timer = null; }
  if (c.tapT){ clearTimeout(c.tapT); c.tapT = null; }
  if (c.firstTry){ clearTimeout(c.firstTry); c.firstTry = null; }
  if (c.flashT){ clearTimeout(c.flashT); c.flashT = null; }
  if (c.player){ try{ c.player.destroy(); }catch(e){} c.player = null; }
  LYP.list = LYP.list.filter(function(o){ return o !== c; });
}
/* host 안에 있는 플레이어를 모두 정리 */
function lypDestroyIn(host){
  LYP.list.slice().forEach(function(c){ if (c.host === host || (host && host.contains && host.contains(c.wrap))) lypDestroy(c); });
}

/* ── 플레이어(유튜브) + 시청 기록 ── */"""
rep("""/* ── 플레이어(유튜브) + 시청 기록 ── */""", LYP)

# 강의실: 유튜브 플레이어를 LYP 틀 안에 만든다 (시청 기록 이벤트는 그대로 vs3OnState / vs3OnRate)
rep("""  go('screen-vod-play');
  vs3LoadYT(function(){
    if (VS3.player){ try{ VS3.player.destroy(); }catch(e){} VS3.player=null; }
    VS3.player = new YT.Player('vs3-yt', { videoId:v.youtubeId, playerVars:{ rel:0, playsinline:1 }, events:{ onStateChange:vs3OnState, onPlaybackRateChange:vs3OnRate } });
  });""", """  go('screen-vod-play');
  /* v2-146: 🛡 LYP 틀 — 유튜브 조작 막대 끔 + 방패 + 우리 막대. 시청 기록은 예전 그대로 vs3OnState / vs3OnRate */
  if (VS3.lyp){ lypDestroy(VS3.lyp); VS3.lyp=null; }
  if (VS3.player){ try{ VS3.player.destroy(); }catch(e){} VS3.player=null; }
  VS3.lyp = lypCreate(document.getElementById('vs3-playhost'), { videoId:v.youtubeId, ytElId:'vs3-yt', title:v.title,
    dur:v.durationSec||0, maxRate:(f&&f.maxRate)||0,
    onPlayer:function(p){ VS3.player = p; }, onStateChange:vs3OnState, onPlaybackRateChange:vs3OnRate });""")
rep("""  if (VS3.saveTimer){ clearInterval(VS3.saveTimer); VS3.saveTimer=null; }
  if (VS3.player){ try{ VS3.player.destroy(); }catch(e){} VS3.player=null; }
  window.removeEventListener('blur', vs3OnBlur);""", """  if (VS3.saveTimer){ clearInterval(VS3.saveTimer); VS3.saveTimer=null; }
  if (VS3.lyp){ lypDestroy(VS3.lyp); VS3.lyp=null; }   /* v2-146: 틀·전체 화면·플레이어 함께 정리 */
  if (VS3.player){ try{ VS3.player.destroy(); }catch(e){} VS3.player=null; }
  window.removeEventListener('blur', vs3OnBlur);""")

# 손풀이 문항 카드 🎬 풀이 영상: 맨 iframe → 같은 LYP 틀
rep("""  if(on){ box.innerHTML=''; box.style.display='none'; box.setAttribute('data-on','0'); HSB.vid[String(gi)]=0; return; }
  var yt=box.getAttribute('data-yt')||'', st=Math.floor(Number(box.getAttribute('data-st'))||0);
  if(!yt) return;
  var src='https://www.youtube.com/embed/'+encodeURIComponent(yt)+'?rel=0'+(st>0?('&start='+st):'');
  box.innerHTML='<iframe src="'+hsEsc(src)+'" title="풀이 영상" '
    +'allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" '
    +'allowfullscreen loading="lazy"></iframe>';
  box.style.display='';""", """  if(on){ lypDestroyIn(box); box.innerHTML=''; box.style.display='none'; box.setAttribute('data-on','0'); HSB.vid[String(gi)]=0; return; }
  var yt=box.getAttribute('data-yt')||'', st=Math.floor(Number(box.getAttribute('data-st'))||0);
  if(!yt) return;
  /* v2-146: 맨 유튜브 iframe 대신 🛡 LYP 틀(방패 + 우리 막대) — 유튜브로 빠져나가지 못하게 */
  lypDestroyIn(box);
  box.style.display='';
  lypCreate(box, { videoId:yt, start:st, title:'풀이 영상' });""")

log = """ * v2-146 (2026-10-19) 🛡 영상 보다가 유튜브로 빠져나가지 못하게 (원장 「학생앱에 영상을 볼때 유튜브로 가는것을 막을 수 있나? 구현」)
 *   · 🎬 강의실 영상과 ✍️ 손풀이 «풀이 영상»에 루멘 플레이어를 씌웠어요. 유튜브 로고·제목·공유·추천 영상을 눌러도 아무 데도 안 가요.
 *   · 재생/멈춤 · 10초 앞뒤 · 진행 막대 · 배속 · 전체 화면은 영상 아래 루멘 단추로. 화면을 톡 = 재생/멈춤, 두 번 톡 = 10초.
 *   · 멈추거나 끝나면 루멘 판이 덮어서 유튜브 추천 영상이 안 보여요(멈춘 칠판은 「🔍 멈춘 화면 보기」).
 *   · 시청 기록(어디까지 봤는지·배속)은 예전과 똑같이 선생님께 가요. 앱 밖에서 유튜브를 따로 여는 것은 막을 수 없어요.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
