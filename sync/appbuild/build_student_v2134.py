# 학생앱 v2-134 조립 — «v2-133 복사 + rep 고침»
#   원장 결정 2026-10-12 「1,2,3 다 고쳐줘」 (플래너 점수 점검에서 나온 세 가지 중 학생앱 몫)
#   ② 주간계획 「계획 내기」 글이 아직 옛 점수(제때 3점 · 지각 1점)였다. 지금 규칙은 5점 · 2점(PW.PT.plan).
#      → 글자를 손으로 적지 않고 점수 표(PW.PT)에서 읽는다. 점수 표가 바뀌면 글도 같이 바뀐다.
#   ③ 홈 「📊 플래너 점수」 칸의 주간 점수는 student_planner_<코드>.weekly(그 학생 플래너를 승인할 때만 새로 씀)를 더해
#      랭킹(planner_ranking_<달>, 더 자주 새로 씀)과 1점씩 어긋날 수 있었다.
#      → 홈 칸이 이미 읽어 오는 랭킹 줄에 내 주간 점수(weekly)가 있으면 그 값을 쓴다 — 홈 숫자 = 랭킹 숫자.
#      (학원앱 v19-113 도 주간 점수를 다시 올릴 때 학생 전원의 weekly 를 함께 새로 쓴다 — 두 겹으로 막음)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-133.html'); DST = os.path.join(ROOT, 'student_v2-134.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-133';", "var STU_VER = 'v2-134';")

# ② 계획 내기 점수 글 — 점수 표(PW.PT.plan)에서 읽는다
rep("""(sub ? '다음 주 계획을 냈어요 — 3점' : '일요일 밤 12시까지 「계획 내기」 3점')""",
    """(sub ? '다음 주 계획을 냈어요 — ' + PW.PT.plan.ok + '점' : '일요일 밤 12시까지 「계획 내기」 ' + PW.PT.plan.ok + '점')""")
rep("""' · 고쳐도 점수는 그대로') : '월요일에 내면 1점 · 안 내면 0점')""",
    """' · 고쳐도 점수는 그대로') : '월요일에 내면 ' + PW.PT.plan.late + '점 · 안 내면 0점')""")
rep("""<b>이번 주 계획 — 오늘 밤 12시까지 내면 1점</b>""",
    """<b>이번 주 계획 — 오늘 밤 12시까지 내면 ' + PW.PT.plan.late + '점</b>""")
rep("""say(j === 'ok' ? '📅 계획을 냈어요 — 3점!' : (j === 'late' ? '📅 늦게 냈어요 — 1점' : '📅 계획을 냈어요 (마감이 지나 점수는 없어요)'));""",
    """say(j === 'ok' ? '📅 계획을 냈어요 — ' + PW.PT.plan.ok + '점!' : (j === 'late' ? '📅 늦게 냈어요 — ' + PW.PT.plan.late + '점' : '📅 계획을 냈어요 (마감이 지나 점수는 없어요)'));   /* ★ v2-134: 점수 표에서 */""")
rep("""else if(now<late) sub='지각 · 월요일 밤 12시까지 (1점)';""",
    """else if(now<late) sub='지각 · 월요일 밤 12시까지 ('+PW.PT.plan.late+'점)';   /* ★ v2-134: 점수 표에서 */""")
rep(""" *   · 점수: 다음 주 계획을 일요일 24시까지 「계획 내기」 3점 (월요일 1점) — 계산은 PW""",
    """ *   · 점수: 다음 주 계획을 일요일 24시까지 「계획 내기」 PW.PT.plan.ok(5점) · 월요일 PW.PT.plan.late(2점) — 계산·글 모두 PW 점수 표 (v2-134)""")

# ③ 홈 플래너 점수 칸 — 랭킹 줄의 주간 점수를 쓴다
rep("""      for(var i=0;i<rows.length;i++){ var r=rows[i]; if((r.code&&String(r.code)===c)||(myId!=null&&r.id===myId)){ rank=r.rank; break; } }
    }
    var t=daily+weekly;""",
"""      for(var i=0;i<rows.length;i++){ var r=rows[i]; if((r.code&&String(r.code)===c)||(myId!=null&&r.id===myId)){ rank=r.rank; if(typeof r.weekly==='number'&&isFinite(r.weekly)) weekly=r.weekly; break; } }   /* ★ v2-134: 주간 점수는 랭킹 줄 값 — 홈 숫자 = 랭킹 숫자 */
    }
    var t=daily+weekly;""")

log = """ * v2-134 (2026-10-12) 📒 플래너 점수 글·숫자 맞추기 (원장 「1,2,3 다 고쳐줘」)
 *   · 주간계획 「계획 내기」 글이 옛 점수(제때 3점 · 월요일 1점)로 남아 있던 것을 지금 점수(제때 <b>5점</b> · 월요일 <b>2점</b>)로.
 *     글자를 직접 적지 않고 점수 표(PW.PT)에서 읽어서, 점수 표가 바뀌면 글도 함께 바뀝니다.
 *     (주간계획표 마감 줄 · 이번 주 지각 줄 · 「계획을 냈어요」 알림 · 🔔 서랍 「다음 주 계획 쓰기」)
 *   · 홈 「📊 플래너 점수」의 주간 점수가 랭킹과 1점 어긋날 수 있던 것: 랭킹 줄에 적힌 내 주간 점수를 그대로 씁니다
 *     → 홈 숫자 = 랭킹 숫자. (학원앱 v19-113 이 주간 점수를 다시 올릴 때 학생 전원의 주간 점수도 새로 씁니다)
 *
"""
import re
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
