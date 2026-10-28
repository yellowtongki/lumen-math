# 학생앱 v2-149 조립 — «v2-148 복사 + rep 고침»
#   원장 2026-10-26 「모트모트로 계속 쓴다」 — 다른 플래너(두 쪽짜리)로 내면 AI 채점 지시문의 칸(TASKS·TIME TABLE·TOTAL TIME)이 없어
#   점수가 낮게 나오고, 펼친 두 쪽 중 한쪽이 잘려 찍혔다. 플래너 제출 화면 안내 맨 위에 «📒 플래너는 모트모트로 내요» 상자.
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-148.html'); DST = os.path.join(ROOT, 'student_v2-149.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-148';", "var STU_VER = 'v2-149';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-149 (2026-10-26) 📒 플래너 제출 안내 맨 위에 «플래너는 모트모트로 내요» (원장 「모트모트로 계속 쓴다」)\n"
    " *   · 한 쪽이 사진에 꽉 차게 · 다른 플래너·노트는 칸을 못 읽어 점수가 낮게 나옴 · TASKS 에 O/△ · TOTAL TIME 꼭 쓰기.\n"
    " *\n")
rep("""    <!-- 안내 -->
    <div class="rcard" style="background:linear-gradient(135deg,#0d2240,#1d3a60);border:none">
      <div style="font-size:15px;font-weight:800;color:white;margin-bottom:8px">📸 사진 2장을 함께 올려주세요</div>""",
    """    <!-- 안내 -->
    <div class="rcard" style="background:linear-gradient(135deg,#0d2240,#1d3a60);border:none">
      <!-- v2-149: 모트모트 안내 (원장 결정 2026-10-26 「모트모트로 계속 쓴다」) -->
      <div id="pl-mottmott" style="margin-bottom:12px;padding:11px 13px;background:rgba(52,211,153,0.16);border:1.5px solid rgba(52,211,153,0.6);border-radius:12px;font-size:13.5px;color:#d1fae5;font-weight:700;line-height:1.7">
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:4px">📒 플래너는 모트모트로 내요</div>
        · 한 쪽이 사진에 <b style="color:#fff">꽉 차게</b>, 위에서 똑바로 찍어요. <b style="color:#fff">날짜 · TASKS · TIME TABLE · TOTAL TIME</b>이 다 보여야 해요.<br>
        · 다른 플래너나 노트로 내면 AI가 칸을 못 읽어서 <b style="color:#fde68a">점수가 낮게 나와요.</b><br>
        · TASKS는 끝낸 것에 <b style="color:#fff">O</b>, 반쯤 한 것에 <b style="color:#fff">△</b>를 표시해요.<br>
        · <b style="color:#fff">TOTAL TIME</b> 칸에 오늘 공부한 시간을 꼭 적어요.
      </div>
      <div style="font-size:15px;font-weight:800;color:white;margin-bottom:8px">📸 사진 2장을 함께 올려주세요</div>""")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
