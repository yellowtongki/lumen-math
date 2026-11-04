# 학생앱 v2-156 조립 — «v2-155 복사 + 채점 엔진 최신본»
#   원장 2026-11-04 「학생앱 2차 채점이 안 된다고 하는데 살펴보고 개선」
#   [까닭] 정답이 «(다),(마),(가),(나),(라),(바)» · «(라),(가)» 처럼 칸마다 «(가)» 꼴이면 조각마다 괄호째 «(다)» 로 읽어,
#          학생이 «다, 마, 가 …» 로 맞게 쳐도 ✗ 였다(답이 «(가)» 하나일 때는 맞았다). 쉼표 없이 «다마가나라바» · «라 가» 로 친 것도 ✗.
#          실제: 쎈 중1(하) 801번 · 835번 — 2차 다시 도전에서 맞는 답을 네 번씩 쳐도 ✗.
#   [고침] sync/hw_grade_engine.js — «(가)» 조각은 «가»·«㈎» 로도 읽는다 · 칸마다 한 글자 기호인 답은 쉼표 없이 쳐도 한 글자씩 나눠 본다.
#   검사: 정답 3만 가지 — 읽는 법 바뀐 답 3개(위 꼴만) · 정답 원문 그대로 넣으면 모두 맞음 · 학생 실제 답 5,906개 다시 채점: 새로 ✓ 11 · 새로 ✗ 0
#   실행: python3 sync/appbuild/build_student_v2156.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-155.html'); DST = os.path.join(ROOT, 'student_v2-156.html')
ENG = os.path.join(ROOT, 'sync', 'hw_grade_engine.js')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-155';", "var STU_VER = 'v2-156';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-156 (2026-11-04) ✅ 「(가)」 꼴 답이 맞게 쳐도 ✗ 이던 것 (원장 「2차 채점이 안 된다」)\n"
    " *   · 정답이 «(다),(마),(가)…» 처럼 칸마다 괄호 글자면, 학생이 «다, 마, 가» 로 쳐도 ✗ 였습니다(쎈 중1(하) 801·835번 — 2차 다시 도전에서 네 번씩 맞게 쳐도 ✗).\n"
    " *     이제 «다» · «(다)» · «㈐» 어느 것으로 쳐도 맞고, 쉼표 없이 «다마가» · «라 가» 로 쳐도 글자 수가 맞으면 한 글자씩 나눠 봅니다.\n"
    " *   · 지금까지 학생들이 친 답 5,906개로 다시 채점해 보니 새로 ✓ 11개 · 새로 ✗ 0개.\n"
    " *\n")

# 채점 엔진 최신본 (v2-150 과 같은 방법)
mark = '/* ★ v2-82: 아래 블록은 sync/hw_grade_engine.js 를 그대로 복사한 것이다'
i0 = s.index(mark); i1 = s.index('/* ═', i0)
end_tok = "})(typeof globalThis !== 'undefined' ? globalThis : this);"
i2 = s.index(end_tok, i1) + len(end_tok)
eng = open(ENG, encoding='utf-8').read().rstrip('\n')
assert eng.startswith('/* ═') and eng.endswith(end_tok)
assert '2026-11-04' in eng
s = s[:i1] + eng + s[i2:]
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
