# 학생앱 v2-137 조립 — «v2-136 복사 + rep 고침»
#   원장 승인 시안: docs/mockup_char_lesson_px2.html (캐릭터 셋 + 단원 코스 · 채팅 퀴즈 · 수학 낱말 Day)
#   원장이 이름을 「캐릭터 수업 · 개념 나들이」 → 「🧠 루멘 수학퀴즈」로 바꿈 (수업 = «퀴즈», 낱말 = «🍙 수학 낱말 Day»)
#   ① 홈: 「📌 오늘 할 일」 아래 «🧠 루멘 수학퀴즈» 카드 (새 퀴즈 n개) · 📚 공부 탭 줄 두 개(퀴즈 · 낱말 Day)
#   ② screen-mq(코스) · screen-mq-play(대화 퀴즈) · screen-mq-words(낱말 Day) — 부품 modules/mathquiz137_student.js
#      그리기는 학원앱 v19-121 미리보기와 같은 modules/mathquiz_render.js · 캐릭터 도트 docs/char_px2/*.png (mq_assets.py 가 심는다)
#   ③ 자료: quiz_index · quiz_<id> (읽기, status 'pub' 만) · quizlog_<내 코드> · quiz_words_<학년> (읽기) · wordlog_<내 코드>
#   배포하지 않는다(student_v1.html 은 원장님 지시 때만).
import os, re, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from mq_assets import mq_bundle
SRC = os.path.join(ROOT, 'student_v2-136.html'); DST = os.path.join(ROOT, 'student_v2-137.html')
MOD = os.path.join(HERE, 'modules')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-136';", "var STU_VER = 'v2-137';\n" + mq_bundle(ROOT, MOD) + open(os.path.join(MOD, 'mathquiz137_student.js'), encoding='utf-8').read())

# ── 홈 카드 (📌 오늘 할 일 아래 · 🏆 루멘 리그 위) ──
rep("    <!-- v2-116: 🏆 루멘 리그 — 종목 4칸(진도·IB아하·플래너·스피치) + 종합. rcHomeUpdate 가 채운다 -->\n",
    """    <!-- v2-137: 🧠 루멘 수학퀴즈 — 루미·아하·정수쌤 대화 퀴즈 (mqHomeUpdate 가 채운다 · 기능 스위치 mathquiz) -->
    <button class="mqh" id="mq-home" onclick="go('screen-mq')"><span class="av3" id="mq-home-av"></span><span class="tx"><b>🧠 루멘 수학퀴즈</b><small id="mq-home-sub">대화로 개념 잡기 · 🍙 수학 낱말 Day</small></span><span class="n" id="mq-home-n" style="display:none"></span><span class="ch">›</span></button>
    <!-- v2-116: 🏆 루멘 리그 — 종목 4칸(진도·IB아하·플래너·스피치) + 종합. rcHomeUpdate 가 채운다 -->
""")
# ── 📚 공부 탭 줄 ──
rep("""      <button class="mrow" onclick="go('screen-bookscore')"><span class="mi">📖</span><span class="mt"><b>교재 채점</b><small>진도 · 정답률 · 모름·복습</small></span><span class="mr">›</span></button>""",
    """      <button class="mrow" onclick="go('screen-mq')"><span class="mi">🧠</span><span class="mt"><b>루멘 수학퀴즈</b><small>루미·아하와 대화로 개념 잡기</small></span><span class="mr">›</span></button>
      <button class="mrow" onclick="go('screen-mq-words')"><span class="mi">🍙</span><span class="mt"><b>수학 낱말 Day</b><small>하루 10개 · 한자로 뜻 잡기</small></span><span class="mr">›</span></button>
      <button class="mrow" onclick="go('screen-bookscore')"><span class="mi">📖</span><span class="mt"><b>교재 채점</b><small>진도 · 정답률 · 모름·복습</small></span><span class="mr">›</span></button>""")

# ── 화면 셋 ──
rep("<!-- ══ v2-106: 🧭 스터디 코디 (1차) ══ -->\n", """<!-- ══ v2-137: 🧠 루멘 수학퀴즈 (코스 · 대화 퀴즈 · 낱말 Day) ══ -->
<div class="screen" id="screen-mq">
  <div class="sub-hdr" style="background:linear-gradient(135deg,#0d2240,#1d4e89)">
    <button class="back-btn" onclick="go('screen-home')" style="color:#fff" aria-label="홈으로">←</button>
    <div class="sub-title" style="color:#fff">🧠 루멘 수학퀴즈</div>
  </div>
  <div class="mqs-body" id="mqs-body"></div>
</div>
<div class="screen" id="screen-mq-play">
  <div class="sub-hdr mqs-phd" style="background:#0d2240">
    <div class="row"><button class="back-btn" onclick="mqsBack()" style="color:#fff" aria-label="퀴즈 목록으로">←</button><div class="tt"><div class="sub-title" id="mqs-ptitle">💬 퀴즈</div><small id="mqs-psub"></small></div></div>
    <div class="mqs-prog"><i id="mqs-prog"></i></div>
  </div>
  <div class="mqs-chat" id="mqs-chat" aria-live="polite"></div>
  <div class="mqs-bar"><button type="button" class="mqs-auto" id="mqs-auto" onclick="mqsAutoTog()" aria-pressed="false">🔊 자동</button><button type="button" class="mqs-again" id="mqs-again" onclick="mqsAgain()" style="display:none">↺ 처음부터</button><button type="button" class="mqs-next" id="mqs-next" onclick="mqsNext()">다음 ›</button></div>
</div>
<div class="screen" id="screen-mq-words">
  <div class="sub-hdr" style="background:linear-gradient(135deg,#0f766e,#14b8a6)">
    <button class="back-btn" onclick="go('screen-mq')" style="color:#fff" aria-label="퀴즈로">←</button>
    <div class="sub-title" style="color:#fff">🍙 수학 낱말 Day</div>
  </div>
  <div class="mqs-body" id="mqs-wbody"></div>
</div>
<!-- ══ v2-106: 🧭 스터디 코디 (1차) ══ -->
""")

# ── go() 연결 ──
rep("  if (id === 'screen-codi' && window.scInit) window.scInit();   /* v2-106: 🧭 스터디 코디 */\n",
    """  if (id === 'screen-codi' && window.scInit) window.scInit();   /* v2-106: 🧭 스터디 코디 */
  if (id === 'screen-home' && window.mqHomeUpdate) mqHomeUpdate();   /* v2-137: 🧠 루멘 수학퀴즈 */
  if (id === 'screen-mq' && window.mqsInit) mqsInit();
  if (id === 'screen-mq-play' && window.mqsPlayInit) mqsPlayInit();
  if (id === 'screen-mq-words' && window.mqsWordsInit) mqsWordsInit();
""")

# ── 📒 학생앱 버전 로그 ──
log = """ * v2-137 (2026-10-15) 🧠 루멘 수학퀴즈 — 루미·아하·정수쌤이 대화로 알려 주는 개념 퀴즈 + 🍙 수학 낱말 Day (원장 승인 시안 docs/mockup_char_lesson_px2.html)
 *   · 홈 「📌 오늘 할 일」 아래 «🧠 루멘 수학퀴즈» 카드(새 퀴즈 n개) · 📚 공부 탭에 «루멘 수학퀴즈»·«수학 낱말 Day» 줄.
 *   · 코스: 캐릭터 셋 · 내 학년(중1 → 3~7월 중1-1, 8~2월 중1-2 · 옆 학기 탭) 퀴즈를 단원 순서로 — 학원앱 v19-121 에서 원장님이 <b>발행</b>한 것만.
 *     단원마다 「✓ 끝 · 1/1」 · 「3/8 진행 중」 · 「8장」.
 *   · 퀴즈: «다음»을 누를 때마다 말풍선이 한 줄씩(캐릭터 표정 · <b>주황 강조</b> · 🔊 읽어 주기 · 「🔊 자동」) · 개념 카드 · 문제는 누르면 바로 정답/오답 ·
 *     아하가 깨달으면 💡 · 마지막 정수쌤 아하 포인트 「📒 아하노트에 담기」 → «내가 담은 아하 포인트»에 모임.
 *     (IB아하노트는 활동지 사진이 꼭 있어야 하고 리그 점수로 이어져서 그곳에는 넣지 않습니다)
 *     볼 때마다 quizlog_<내 코드> 에 저장 → 다시 열면 멈춘 곳부터. 끝까지 보면 「🎉 끝! 문제 a/b」.
 *   · 🍙 수학 낱말 Day: 학년 탭 · Day 칩(다 확인한 Day 는 줄 긋기) · 낱말 카드(한자 풀이 · 캐릭터 한마디 · 예문) · «알아요/헷갈려요» → wordlog_<내 코드>.
 *     «헷갈려요» 한 낱말은 다음 날 맨 위 「🔁 다시 볼 낱말」로 돌아옵니다.
 *   · 교재 문제 그림은 보여 주지 않습니다(원장님이 올린 재료는 학생앱이 읽지 않음). 원장님이 🎛 기능 켜고 끄기에서 mathquiz 를 끄면 안 보입니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
