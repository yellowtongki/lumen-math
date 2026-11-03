# 학생앱 v2-154 조립 — «v2-153 복사 + rep 고침»
#   원장 2026-11-03 (학생 아이폰 캡처) 「학생앱 글씨가 가장 크게인데 너무 작다」 + 「학생앱배포」
#   [고침] 글씨 크기(🔠 «가») 단계를 늘린다: 보통 1 · 크게 1.1 → 1.12 · 아주 크게 1.22 → 1.25 · ＋ «가장 크게» 1.4 (새 단계)
#          (화면 전체를 body zoom 으로 키우는 방식 그대로 — 높이·아래 탭 여백은 v2-78·v2-151 의 --scrh/--scrhd·--btabh 가 따라온다)
#   바탕 v2-153 = 다른 세션의 「📌 오늘 숙제」 카드(v2-152 아하노트 고침 포함).
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-153.html'); DST = os.path.join(ROOT, 'student_v2-154.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)
rep("var STU_VER = 'v2-153';", "var STU_VER = 'v2-154';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-154 (2026-11-03) 🔠 글씨 크기 «가장 크게» 단계 추가 (원장 「가장 크게인데 너무 작다」)\n"
    " *   · 머리 오른쪽 «가» → 보통 · 크게 · 아주 크게 · <b>가장 크게(새로)</b>. 아주 크게도 조금 더 커졌습니다(1.22 → 1.25배). 가장 크게는 1.4배.\n"
    " *\n")
rep("var FZ_STEPS=[{k:'s',n:'보통',z:1},{k:'m',n:'크게',z:1.1},{k:'l',n:'아주 크게',z:1.22}];",
    "var FZ_STEPS=[{k:'s',n:'보통',z:1},{k:'m',n:'크게',z:1.12},{k:'l',n:'아주 크게',z:1.25},{k:'x',n:'가장 크게',z:1.4}];   /* ★ v2-154: 가장 크게(1.4) 추가 */")
rep("      +'font-size:'+(s.k==='s'?'12px':s.k==='m'?'13.5px':'15px')+';'",
    "      +'font-size:'+(s.k==='s'?'12px':s.k==='m'?'13.5px':s.k==='l'?'15px':'16.5px')+';'")
rep("      +'font-size:'+(s.k==='s'?'11px':s.k==='m'?'12.5px':'14px')+';'",
    "      +'font-size:'+(s.k==='s'?'11px':s.k==='m'?'12.5px':s.k==='l'?'14px':'15.5px')+';'")
# 머리 줄(이름·학년)이 글씨를 키우면 화면 밖으로 밀려나 폰 브라우저가 화면 전체를 줄여 버린다(아이폰) → 줄어들게(min-width:0) + 가로 넘침 막기
rep(".h3-me .nm3{font-size:14.5px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".h3-me .nm3{font-size:14.5px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n"
    "/* ★ v2-154: 글씨를 키워도 머리 줄이 화면 밖으로 나가지 않게 — 넘치면 폰이 화면 전체를 줄여 글씨가 오히려 작아진다 */\n"
    ".h3-me{min-width:0;flex:1 1 auto}.h3-me .meinfo{min-width:0;overflow:hidden}\n"
    "html,body{overflow-x:hidden;max-width:100%}")

# 가장 크게(1.4)에서는 머리 줄 자리가 모자라 이름이 사라진다 → 그때만 «루멘수학» 글자를 숨겨 이름 자리를 준다 (로고 그림은 그대로)
rep("    document.body.style.zoom = z===1 ? '' : String(z);",
    "    document.body.style.zoom = z===1 ? '' : String(z);\n    try{ document.documentElement.setAttribute('data-fz', fzGet().k); }catch(e){}   /* ★ v2-154 */")
rep("html,body{overflow-x:hidden;max-width:100%}",
    "html,body{overflow-x:hidden;max-width:100%}\n"
    "html[data-fz=\"x\"] #screen-home .app-header .logo-wrap .main,html[data-fz=\"x\"] #screen-home .app-header .logo-wrap .sub2{display:none}\n"
    "html[data-fz=\"x\"] .h3-me{max-width:60%}")

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
