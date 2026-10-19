# 학생앱 v2-145 조립 — «v2-144 복사 + rep 고침»
#   원장 2026-10-19 「면제하고 새벽 3시 유예도 줘」 — 학원앱 v19-140 과 같은 계산(modules/plweek140_core.js 통째)
#   ① 주간 마감(계획·순공 사진) 새벽 3시 유예  ② 10/12 주 «다음 주 계획» 면제(코디 점검)
#   학생 화면: 종(🔔)·플래너 줄·이번 주 계획 칸에서 면제 주는 «지각» 대신 «이번 주는 면제» 안내.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-144.html'); DST = os.path.join(ROOT, 'student_v2-145.html')
CORE = open(os.path.join(ROOT, 'sync/appbuild/modules/plweek140_core.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-144';", "var STU_VER = 'v2-145';")
rep("""    released: now >= PW.dueMs(W), lateOpen: now < PW.lateMs(W), trial: W === PW.W0
  };
};""", """    released: now >= PW.dueMs(W), lateOpen: now < PW.lateMs(W), trial: W === PW.W0
  };
};
""" + CORE)
# 🔔 종 — 면제 주는 지각 대신 안내
rep("""  else if(now<late) sub='지각 · 월요일 밤 12시까지 ('+PW.PT.plan.late+'점)';   /* ★ v2-134: 점수 표에서 */""",
"""  else if(now<late) sub=(PW.planExempt&&PW.planExempt(w.tW))?'이번 주는 면제예요 · 써 두면 실천 점수가 세어져요':('지각 · 월요일 밤 12시까지 ('+PW.PT.plan.late+'점)');   /* ★ v2-134: 점수 표에서 · v2-145 면제 */""")
# 플래너 줄
rep("""(now2<late?'다음 주 계획 ⚠️ 지각 · 월요일 밤 12시까지':'다음 주 계획 ✖ 마감')""",
"""(now2<late?((PW.planExempt&&PW.planExempt(tW))?'다음 주 계획 ✍️ 이번 주는 면제 — 써 두면 실천이 세어져요':'다음 주 계획 ⚠️ 지각 · 월요일 밤 12시까지'):'다음 주 계획 ✖ 마감')""")
# 주간계획 «이번 주» 칸
rep("""  } else if (!w.submittedAt && W !== PW.W0 && Date.now() < PW.lateMs(PW.add(W, -7))){""",
"""  } else if (!w.submittedAt && W !== PW.W0 && PW.planExempt && PW.planExempt(PW.add(W, -7))){
    h += '<div class="wp-codi" style="background:#ecfdf5;border-color:#6ee7b7;color:#065f46">✍️ 이번 주 계획은 <b>면제</b>예요(코디 점검 중). 할 일을 써 두면 「계획 실천」 점수가 세어져요.</div>';
  } else if (!w.submittedAt && W !== PW.W0 && Date.now() < PW.lateMs(PW.add(W, -7))){""")
log = """ * v2-145 (2026-10-19) 📅 주간 점수 새벽 3시 유예 · 이번 주 «다음 주 계획» 면제 (원장 「면제하고 새벽 3시 유예도 줘」)
 *   · 주간계획·순공 사진도 매일 플래너처럼 <b>새벽 3시까지</b> 인정해요(월요일 03시 전 제출, 화요일 03시 전 지각).
 *   · 코디가 점검 중이라 이번 주(10/19) 계획은 <b>면제</b> — 제출로 쳐요. 써 두면 실천 점수가 세어져요.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
