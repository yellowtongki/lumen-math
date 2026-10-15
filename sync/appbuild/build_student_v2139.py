# 학생앱 v2-139 조립 — «v2-138(지금 학생 주소) 복사 + rep 고침»  ※ v2-137(수학퀴즈, 미배포)은 아직 안 합침
#   원장 2026-10-15 「스터디코디 엉망진창이다. 우선 기능을 잠그자 · 코디가 짠 계획은 학생앱에서 다 삭제 · 스터디코디는 점검중 표시로」
#   서버: codi_settings = { on:false, paused:true } (그날 적용) · 이번 주·다음 주 코디 칸 삭제(백업 backup_codi_20261015)
#   앱: paused 이면 홈 카드 「🧭 스터디 코디 · 🔧 점검 중」 · 코디 화면 = 점검 안내 · 주간계획표 「🧭 코디 점검 중」(누를 수 없음)
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-138.html'); DST = os.path.join(ROOT, 'student_v2-139.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-138';", "var STU_VER = 'v2-139';")
PAUSED = "function scPaused(){ var s=SC.settings; return !!(s&&s.paused&&s.on===false); }   /* v2-139: 원장님이 「점검 중」으로 잠금 */\nwindow.scPaused=scPaused;\nfunction scPausedHtml(){ return '<div class=\"sp3-empty\" style=\"padding:28px 10px\"><div class=\"e1\">🔧</div><div class=\"e2\"><b style=\"font-size:16px;color:#0d2240\">스터디 코디는 지금 점검 중이에요</b><br><span style=\"font-size:12.5px;font-weight:600\">더 똑똑하게 계획을 짜도록 고치고 있어요.<br>그동안은 📅 주간계획표에 직접 계획을 적어 주세요.</span></div></div>'; }\n"
rep("window.scInit=async function(){ await scSettings(); if(!scEnabled()){ scRender(); return; } await scLoad();",
    PAUSED + "window.scInit=async function(){ await scSettings(); if(scPaused()){ var bd=document.getElementById('sc-body'); if(bd) bd.innerHTML=scPausedHtml(); return; } if(!scEnabled()){ scRender(); return; } await scLoad();")
rep("window.scHomeUpdate=async function(){ var el=document.getElementById('sc-home'); if(!el) return; await scSettings(); if(!scEnabled()){ el.style.display='none'; return; }",
    "window.scHomeUpdate=async function(){ var el=document.getElementById('sc-home'); if(!el) return; await scSettings(); if(scPaused()){ el.innerHTML='<span class=\"sc-hf\" style=\"display:flex;align-items:center;justify-content:center;font-size:18px\">🔧</span><span class=\"sc-ht\"><b>🧭 스터디 코디 · 점검 중</b><small>더 똑똑해져서 돌아올게요 ›</small></span>'; el.style.display='flex'; el.style.opacity='.85'; return; } if(!scEnabled()){ el.style.display='none'; return; }")
rep("    try { if (window.scSettings && window.scEnabled){ await scSettings(); WP.codi = !!scEnabled(); } } catch(e){}",
    "    try { if (window.scSettings && window.scEnabled){ await scSettings(); WP.codi = !!scEnabled(); WP.codiPaused = !!(window.scPaused && scPaused()); if (WP.codiPaused) WP.codi = false; } } catch(e){}   /* v2-139: 점검 중 */")
rep("(WP.codi ? '<button type=\"button\" class=\"codi\" onclick=\"wplCodiFill()\">🧭 코디가 채워 주기</button>' : '')",
    "(WP.codi ? '<button type=\"button\" class=\"codi\" onclick=\"wplCodiFill()\">🧭 코디가 채워 주기</button>' : (WP.codiPaused ? '<button type=\"button\" class=\"codi\" disabled style=\"opacity:.55;cursor:default\">🔧 코디 점검 중</button>' : ''))")

log = """ * v2-139 (2026-10-15) 🔧 스터디 코디 «점검 중» (원장 지시)
 *   · 원장님이 코디를 잠그면(학원앱 설정 paused) 홈에 「🧭 스터디 코디 · 점검 중 — 더 똑똑해져서 돌아올게요」 카드가 보이고,
 *     눌러도 「지금 점검 중이에요 — 그동안은 주간계획표에 직접 적어 주세요」 안내만 나옵니다.
 *   · 주간계획표의 「🧭 코디가 채워 주기」 자리에는 「🔧 코디 점검 중」(누를 수 없음).
 *   · 이번 주·다음 주에 코디가 넣었던 칸은 서버에서 지웠습니다(학생이 직접 쓴 칸은 그대로).
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
