# 학생앱 v2-143 조립 — «v2-142 복사 + rep 고침»  (만들기만 · 배포는 원장 지시 때)
#   원장 2026-10-19 「학년이 보인다」 — 중고등부 통합 순위표(board.combined)에 「중3 범박중 · 실버 I」처럼
#   학년·학교가 보였다. 레이드 명단(hideSch)과 같이, 통합 순위표에서는 학년·학교를 안 보인다.
#   순위 줄의 학년·학교는 rcWho() 한 곳에서만 나온다(v2-141). 초등부·예전 시즌(통합 아님)은 그대로.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-142.html'); DST = os.path.join(ROOT, 'student_v2-143.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-142';", "var STU_VER = 'v2-143';")
rep("""function rcWho(r){
  var w=""", """function rcWho(r){
  /* v2-143: 중고등부 통합(board.combined) 줄에서는 학년·학교를 가린다 (원장 「학년이 보인다」) */
  if(r && RC && RC.board && RC.board.combined && r.gr && !/^초/.test(String(r.gr))) return '';
  var w=""")

log = """ * v2-143 (2026-10-19) 🙈 중고등부 순위에서 학년·학교 가리기 (원장 「학년이 보인다」)
 *   · 중고등부 한 줄 순위표(통합)에서 「중3 범박중 · 」 같은 학년·학교를 안 보입니다. 리그 이름만 남습니다.
 *     초등부와 예전 시즌(통합 아님) 순위는 그대로.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
