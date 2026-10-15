# 학생앱 v2-138 조립 — «v2-136(지금 학생 주소) 복사 + rep 고침»  ※ v2-137(수학퀴즈, 미배포)은 건너뜀 — 이 고침만 따로 내보낼 수 있게
#   원장 2026-10-15 「진도레이스 발표결과가 학생앱에 안 보이고 진도레이스 탭이 없어졌다」
#   까닭: 진도 탭은 레이스가 끝난 뒤 showDaysAfter(7일)까지만 보였다. 9/30 끝 → 10/15(15일째) 시상 발표 → 탭이 이미 닫혀 결과가 안 보임.
#   고침: 그 시즌 시상(race_awards)이 발표됐으면 발표 뒤 14일 동안은 끝난 날짜와 상관없이 진도 탭을 보여 준다.
#   (그날 서버 설정 showDaysAfter 도 7 → 30 으로 늘려 바로 보이게 했다 — 원장 승인)
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-136.html'); DST = os.path.join(ROOT, 'student_v2-138.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-136';", "var STU_VER = 'v2-138';")
rep("""  if(today>b.to && (Number(b.endedDays)||0) > (Number(b.showDaysAfter)||7)) return false;
  return true;
}""", """  if(today>b.to && (Number(b.endedDays)||0) > (Number(b.showDaysAfter)||7)) return lgRaceAwardsFresh();   /* v2-138: 시상 발표가 있으면 발표 뒤 14일은 보인다 */
  return true;
}
/* v2-138: 그 시즌 시상(race_awards)이 발표된 지 14일 안이면 true — 끝난 지 오래돼도 결과를 볼 수 있게 */
function lgRaceAwardsFresh(){
  var b=RC.board, a=RC.awards; if(!b||!a||!a.publishedAt) return false;
  if(a.seasonId&&b.seasonId&&a.seasonId!==b.seasonId) return false;
  var t=Date.parse(a.publishedAt); if(!t) return false;
  return (Date.now()-t) < 14*86400000;
}""")

log = """ * v2-138 (2026-10-15) 🏁 진도 레이스 시상 발표가 늦어도 결과가 보이게
 *   · 진도 탭은 레이스가 끝난 뒤 7일까지만 보였습니다. 이번 시즌(9/30 끝)은 10/15에 발표해 탭이 이미 닫혀 학생들이 결과를 못 봤습니다.
 *   · 이제 시상을 발표하면, 끝난 지 며칠이 지났든 <b>발표 뒤 14일 동안</b> 🏆 루멘 리그의 「🏁 진도」 탭과 시즌 결과가 보입니다.
 *   · (v2-137 수학퀴즈는 아직 내보내지 않아서, 이 버전은 지금 학생 주소(v2-136)에 이 고침만 더한 것입니다.)
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
