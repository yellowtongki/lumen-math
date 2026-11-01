# 학생앱 v2-151 조립 — «v2-150 복사 + rep 고침»
#   원장 2026-11-01 (학생 아이폰 캡처) 「학생앱이다. 밑에 채점이 짤린다」 — 홈 맨 아래 카드(📖 채점)가 아래 탭 줄에 가려 끝까지 안 올라온다.
#   [까닭] 화면 높이를 100vh 로 잡는데, 아이폰 사파리의 100vh 는 «주소창·아래 막대가 숨었을 때»의 큰 화면 높이다.
#          막대가 보이면 화면 상자 아래쪽이 막대 뒤로 들어가 그만큼 마지막 카드가 탭 줄 밑에 남는다. 아래 여백도 74px 로 고정이라
#          글씨 크기(«가»)·홈 버튼 없는 폰의 아래 띠에 따라 탭 줄 높이가 달라지면 모자랐다.
#   [고침] ① 화면 높이를 «지금 보이는 높이» dvh 로 (지원하는 브라우저만 — 옛 폰은 예전 vh 그대로)
#          ② 홈·탭 화면 아래 여백 = «실제 탭 줄 높이 + 24px» (탭 줄 높이를 재서 --btabh 로)
#   실행: python3 sync/appbuild/build_student_v2151.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-150.html'); DST = os.path.join(ROOT, 'student_v2-151.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-150';", "var STU_VER = 'v2-151';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-151 (2026-11-01) 📱 홈 맨 아래 «채점» 카드가 아래 탭 줄에 가리던 것 (원장 제보 — 학생 아이폰 캡처)\n"
    " *   · 아이폰 사파리는 주소창·아래 막대가 보일 때도 화면 높이를 «막대가 숨은 큰 높이»로 알려 줘서, 화면 아래쪽이 막대 뒤로 들어갔습니다.\n"
    " *     이제 «지금 보이는 높이»로 잽니다. 아래 여백도 실제 탭 줄 높이에 맞춰 늘어납니다(글씨 크게·아주 크게에서도).\n"
    " *\n")

# ① 화면 높이 — dvh 를 아는 브라우저는 dvh (모르면 아래 줄을 버리고 vh 그대로)
rep(".screen { display: none; height: var(--scrh, 100vh); overflow-y: auto; flex-direction: column; }",
    ".screen { display: none; height: var(--scrh, 100vh); overflow-y: auto; flex-direction: column; }\n"
    "/* ★ v2-151: 아이폰 사파리의 100vh 는 막대가 숨은 «큰» 높이 — 지금 보이는 높이(dvh)로. fzApply 가 --scrhd 를 (100/zoom)dvh 로 맞춘다 */\n"
    "@supports (height: 100dvh) { .screen { height: var(--scrhd, 100dvh); } }")
rep("    document.documentElement.style.setProperty('--scrh', (z===1 ? 100 : (100/z)) + 'vh');",
    "    document.documentElement.style.setProperty('--scrh', (z===1 ? 100 : (100/z)) + 'vh');\n"
    "    document.documentElement.style.setProperty('--scrhd', (z===1 ? 100 : (100/z)) + 'dvh');   /* ★ v2-151 */\n"
    "    if(window.stuTabPad) setTimeout(stuTabPad, 0);")

# ② 아래 여백 = 실제 탭 줄 높이 + 24px
rep("#screen-home .h3-body{padding-bottom:calc(74px + env(safe-area-inset-bottom));gap:10px}",
    "#screen-home .h3-body{padding-bottom:calc(74px + env(safe-area-inset-bottom));gap:10px}\n"
    "/* ★ v2-151: 탭 줄 높이를 재서(--btabh) 그만큼 + 24px 비워 둔다 — 마지막 카드가 탭 줄에 가리지 않게 */\n"
    "html.btabh-on #screen-home .h3-body{padding-bottom:calc(var(--btabh) + 24px)}\n"
    "html.btabh-on .tab-body{padding-bottom:calc(var(--btabh) + 24px)}")
rep("window.btabsPaint=function(id){",
    "/* ★ v2-151: 아래 탭 줄의 실제 높이(아래 띠 포함)를 --btabh 로 — 홈·탭 화면 아래 여백에 쓴다 */\n"
    "window.stuTabPad=function(){\n"
    "  try{\n"
    "    var nav=document.getElementById('btabs'); if(!nav||nav.style.display==='none') return;\n"
    "    var h=nav.offsetHeight; if(!h) return;\n"
    "    document.documentElement.style.setProperty('--btabh', h+'px');\n"
    "    document.documentElement.classList.add('btabh-on');\n"
    "  }catch(e){}\n"
    "};\n"
    "try{ window.addEventListener('resize', function(){ setTimeout(stuTabPad, 50); }); }catch(e){}\n"
    "window.btabsPaint=function(id){\n"
    "  setTimeout(stuTabPad, 0);")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
