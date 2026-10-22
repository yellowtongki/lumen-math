# 학생앱 v2-148 조립 — «v2-147 복사 + rep 고침»
#   원장 2026-10-22 「칸 이름은 빼도록 고쳐줘」 — 학생이 LAMP 칸을 비워 두면 AI 가 인쇄된 칸 제목
#   («Learn the question (문제를 정확히 이해하기)» 등)을 학생 글로 옮겨, 앱에 그 글이 채워지고 채점에서는 0점이었다.
#   사진 읽기 결과(ahaReadPhoto, lamp 읽기만)에서 제목을 떼고, 남은 글이 없으면 그 칸은 «못 읽은 칸»으로 둔다.
#   규칙은 학원앱·엣지 함수와 같은 글 sync/appbuild/modules/lampstrip_core.js 를 그대로 붙인다.
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-147.html'); DST = os.path.join(ROOT, 'student_v2-148.html')
CORE = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'lampstrip_core.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-147';", "var STU_VER = 'v2-148';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-148 (2026-10-22) 📝 아하노트 사진 읽기에서 인쇄된 칸 이름 빼기 (원장 「칸 이름은 빼도록 고쳐줘」)\n"
    " *   · 칸을 비워 두고 찍으면 «Learn the question (문제를 정확히 이해하기)» 같은 인쇄 글자가 내 글처럼 채워지던 것을 고쳤어요.\n"
    " *   · 이제 그 칸은 «못 읽은 칸»으로 보여요 — 내 말로 써서 다시 찍으면 돼요.\n"
    " *\n")
rep("async function ahaReadPhoto(url, mode) {", CORE + "\nasync function ahaReadPhoto(url, mode) {")
rep("  if (!r.data || r.data.error) throw new Error((r.data && r.data.error) || 'AI 읽기 실패');\n  return r.data;\n}",
    "  if (!r.data || r.data.error) throw new Error((r.data && r.data.error) || 'AI 읽기 실패');\n  return (mode && mode !== 'lamp') ? r.data : lampStripAi(r.data);   /* ★ v2-148: 인쇄된 칸 이름 빼기 */\n}")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
