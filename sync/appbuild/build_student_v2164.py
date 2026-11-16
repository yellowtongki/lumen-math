# -*- coding: utf-8 -*-
# 학생앱 v2-164 조립 — «v2-163 복사 + rep 고침 + 뒤에 sync/streak_core.js · modules/stkstu164.js 붙이기»
#   원장 2026-11-16 「연속 학습 표기를 플래너와 녹음에 도입 · 홈 화면에 보이게 · 따로 확인은 어디서 · 상위 5명 · 전체 학생 랭킹 · 추천대로 만들어」
#   (시안 docs/mockup_streak_student.html)
#   ① 홈: 루멘 리그 아래 «🔥 연속 띠» — 플래너 n일 연속 · 오늘 아직이면 «오늘 아직!» · 녹음 n회 · 연속 랭킹 n위
#   ② 띠를 누르면 «🔥 연속 기록» 화면(screen-streak · 새 탭 없음): 플래너/녹음 전환 · 큰 카드(이번 주 점) · 연속 랭킹 TOP 5(전체 학생 · 별명) · 달력 · 메달 7/14/30/50/100
#   자료: 내 것은 바로 계산(내 플래너 사진 목록 · submissions_<코드>), 랭킹은 서버가 매일 새벽 만드는 streak_board(sync/streak_board.js · planner-night.yml)
#   녹음 기준: 수업일만(반 M → 월수금, T → 화목토) · 2026-12-01 부터 매일 / 플래너: 매일 · 새벽 3시 전은 전날
#   고정 주소 student_v1.html 은 원장 지시로만.
#   실행: python3 sync/appbuild/build_student_v2164.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-163.html'); DST = os.path.join(ROOT, 'student_v2-164.html')
CORE = open(os.path.join(ROOT, 'sync', 'streak_core.js'), encoding='utf-8').read().replace("if (typeof module !== 'undefined' && module.exports) module.exports = STK;", '')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'stkstu164.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-163';", "var STU_VER = 'v2-164';")
# ① 홈 띠 — 큰 칸 4개 바로 위
rep("    <!-- v2-116: 큰 칸 4개 — 남는 세로를 채운다 (폰 비율) -->",
    "    <!-- v2-164: 🔥 연속 띠 (stkLoad · stkPaintStrip) — 누르면 «연속 기록» 화면 -->\n"
    "    <button type=\"button\" class=\"stk-strip\" id=\"stk-strip\" style=\"display:none\" onclick=\"stkOpen()\"></button>\n"
    "    <!-- v2-116: 큰 칸 4개 — 남는 세로를 채운다 (폰 비율) -->")
# ② 화면
rep("<!-- ══ 녹음제출 ══ -->",
    "<!-- ══ v2-164: 🔥 연속 기록 ══ -->\n<div class=\"screen\" id=\"screen-streak\">\n  <div class=\"sub-hdr\">\n    <button class=\"back-btn\" onclick=\"go('screen-home')\">←</button>\n"
    "    <div class=\"sub-title\">🔥 연속 기록</div>\n  </div>\n  <div class=\"stk-body\" id=\"stk-body\"></div>\n</div>\n\n<!-- ══ 녹음제출 ══ -->")
# 화면 들어갈 때 그리기
rep("  if (id === 'screen-haesol') { if (window.shsInit) shsInit(); }  // v2-54: 풀이 보기 (미오픈)",
    "  if (id === 'screen-haesol') { if (window.shsInit) shsInit(); }  // v2-54: 풀이 보기 (미오픈)\n"
    "  if (id === 'screen-streak') { if (window.stkRender) stkRender(); }  // v2-164: 🔥 연속 기록")
# 홈 그릴 때 불러오기
rep("  (async function(){ try{ await rcvHomeLoad(); }catch(e){} })(); // v2-22: 리커버리 호출 배너",
    "  (async function(){ try{ await rcvHomeLoad(); }catch(e){} })(); // v2-22: 리커버리 호출 배너\n"
    "  (async function(){ try{ if (window.stkLoad) await stkLoad(); }catch(e){} })(); // v2-164: 🔥 연속 띠")
CSS = (
  "/* v2-164: 🔥 연속 기록 */\n"
  ".stk-strip{position:relative;display:flex;align-items:center;gap:10px;width:100%;border:3px solid #fff;border-radius:18px;padding:12px 14px;margin:10px 0 0;color:#fff;background:linear-gradient(135deg,#ffad1f,#ff6a00);box-shadow:0 6px 16px rgba(255,106,0,.28);font-family:inherit;text-align:left;cursor:pointer;box-sizing:border-box}\n"
  ".stk-strip.cold{background:linear-gradient(135deg,#94a3b8,#64748b);box-shadow:none}\n"
  ".stk-strip .stk-fl{font-size:36px;line-height:1;flex:none}.stk-strip .stk-a{flex:1;min-width:0;display:flex;flex-direction:column}\n"
  ".stk-strip .stk-a b{font-size:24px;font-weight:900;letter-spacing:-.5px;line-height:1.1}.stk-strip .stk-a b small{font-size:13px;margin-left:2px}\n"
  ".stk-strip .stk-s{font-size:11.5px;font-weight:800;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n"
  ".stk-strip .stk-r{flex:none;text-align:right;font-size:11.5px;font-weight:900}.stk-strip .stk-r b{display:block;font-size:20px}\n"
  ".stk-strip .stk-hot{position:absolute;left:-6px;top:-11px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:900;border-radius:99px;padding:2px 8px}\n"
  ".stk-body{padding:12px 14px 40px;display:flex;flex-direction:column;gap:10px}\n"
  ".stk-seg{display:flex;background:#e2e8f0;border-radius:12px;padding:3px;gap:3px}.stk-seg button{flex:1;border:0;background:transparent;border-radius:10px;padding:8px 0;font-family:inherit;font-size:13px;font-weight:900;color:#64748b}.stk-seg button.on{background:#fff;color:#ea580c}\n"
  ".stk-big{border-radius:20px;padding:14px;color:#fff;background:linear-gradient(160deg,#ffb020,#ff7a00 60%,#f05a00);position:relative;overflow:hidden}.stk-big.cold{background:linear-gradient(160deg,#94a3b8,#64748b)}\n"
  ".stk-big .fl{position:absolute;right:0;top:-6px;font-size:66px}.stk-big .lb{font-size:12px;font-weight:900}.stk-big .n{font-size:46px;font-weight:900;line-height:1.05}.stk-big .n small{font-size:15px;margin-left:3px}.stk-big .m{font-size:12px;font-weight:800;margin-top:4px}\n"
  ".stk-wk{display:flex;gap:3px;margin-top:10px;background:rgba(255,255,255,.18);border-radius:12px;padding:6px 4px}.stk-wk span{flex:1;text-align:center;font-size:10px;font-weight:900}.stk-wk i{display:block;margin:3px auto 0;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.3);font-style:normal;line-height:22px;font-size:12px;color:#ff7a00}.stk-wk i.y{background:#fff}.stk-wk i.t{outline:2px solid #fff;outline-offset:2px}\n"
  ".stk-card{background:#fff;border-radius:18px;padding:12px;border:1px solid #e6eaf1}.stk-card h4{margin:0 0 8px;font-size:14px;color:#0d2240}.stk-card h4 small{font-size:11px;color:#94a3b8}\n"
  ".stk-rk{display:flex;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px dashed #eef2f7;font-size:13.5px;font-weight:800;color:#0d2240}.stk-rk:last-of-type{border-bottom:none}.stk-rk .no{width:24px;text-align:center;font-size:15px}.stk-rk .nm{flex:1;min-width:0}.stk-rk .nm small{color:#94a3b8}.stk-rk .v{color:#ea580c;font-weight:900;white-space:nowrap}.stk-rk.me{background:#fff7ed;border-radius:10px}\n"
  ".stk-mh{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.stk-mh b{font-size:14px;color:#0d2240}.stk-mh button{border:0;background:#f1f5f9;border-radius:8px;padding:5px 12px;font-weight:900;font-family:inherit}\n"
  ".stk-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}.stk-cal b{font-size:11px;color:#94a3b8}.stk-cal span{width:32px;height:32px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;box-sizing:border-box}\n"
  ".stk-cal .y{background:#ff8a1f;color:#fff}.stk-cal .n{background:#f1f5f9;color:#94a3b8}.stk-cal .o{color:#cbd5e1}.stk-cal .t{border:2px dashed #ff8a1f;color:#ff8a1f}.stk-cal .f{color:#e2e8f0}\n"
  ".stk-ms{display:flex;gap:5px}.stk-ms b{flex:1;text-align:center;border-radius:10px;padding:7px 0;font-size:11px;background:#f1f5f9;color:#94a3b8}.stk-ms b.on{background:#fff7ed;color:#ea580c;border:1.5px solid #fdba74}\n"
  ".stk-note{font-size:10.5px;color:#94a3b8;font-weight:700;margin-top:8px;line-height:1.5}.stk-empty{text-align:center;color:#94a3b8;font-size:12.5px;font-weight:700;padding:14px}\n"
)
rep("</style>", CSS + "</style>", n=s.count("</style>") if s.count("</style>") == 1 else None) if False else None
i = s.find("</style>"); assert i > 0; s = s[:i] + CSS + s[i:]
# 스크립트 맨 끝(마지막 </script> 앞)에 계산 코드 + 화면 코드
j = s.rfind("</script>"); assert j > 0
s = s[:j] + "\n/* ═══ v2-164: 🔥 연속 기록 — sync/streak_core.js 그대로 ═══ */\n" + CORE + "\n" + MOD + "\n" + s[j:]
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
