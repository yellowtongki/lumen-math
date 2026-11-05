# -*- coding: utf-8 -*-
# 학생앱 v2-160 조립 — «v2-159 복사 + rep 고침»
#   원장 2026-11-05 「학생앱에서 지난달 플래너 점수 확인하는 기능을 추가하자」
#   [무엇] 📊 내 플래너 점수 화면(#screen-planner-score)의 「이번 달」 탭을 **달 고르기**로.
#          ① 탭 아래에 「◀ 2026년 10월 ▶」 줄. 기본은 이번 달. ◀ 는 집계 시작 달(PLANNER_SCORE_START_DATE 의 달, 2026-05)까지,
#             ▶ 는 이번 달까지(그 끝에서는 단추가 흐려지고 안 눌린다). 고른 달은 전역 PS_YM('YYYY-MM' · null = 이번 달).
#             화면을 다시 열면(go) 이번 달로 돌아온다.
#          ② getPlannerScoreDateRange('month') 가 PS_YM 을 쓴다. label 은 이번 달 「이번 달」 · 지난달 「지난달 · 10월」 · 그 전 「9월」(해가 다르면 「2025년 12월」).
#             요약 카드 · 🏆 Top 5 제목(「10월 Top 5」) · 📅 주간 점수 제목(「10월 주간 점수」) · 점수 기록(「10월 점수 기록」) 이 고른 달 기준.
#             랭킹은 planner_ranking_<고른 달> (loadPlannerRanking 캐시 그대로) · 내 순위도 그 달 것.
#          ③ 고른 달에 내 기록(매일·주간)이 하나도 없으면 「10월엔 승인된 점수가 없어요」 달 안내 — 탭·달 고르기는 그대로 보인다.
#             전체 scores 가 빌 때만 예전처럼 화면 전체가 빈 안내.
#   [안 바꾼 것] 「이번 주」「전체」 탭 · 홈 타일 글 · 계획 탭 줄 글 · 자료 읽는 키(student_planner_<코드> · planner_ranking_<YYYY-MM>) 그대로.
#          서버에 쓰는 코드는 없다. 고정 주소 student_v1.html 은 손대지 않는다.
#   실행: python3 sync/appbuild/build_student_v2160.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-159.html'); DST = os.path.join(ROOT, 'student_v2-160.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-159';", "var STU_VER = 'v2-160';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-160 (2026-11-05) 📊 「내 플래너 점수」에서 지난달 점수도 볼 수 있게 (원장 2026-11-05 「학생앱에서 지난달 플래너 점수 확인하는 기능을 추가하자」)\n"
    " *   · 「이번 달」 탭 아래에 <b>◀ 2026년 10월 ▶</b> 줄이 생겼습니다. ◀ 로 지난달·그 전달… (정식 집계가 시작된 2026년 5월까지), ▶ 로 이번 달까지 돌아옵니다.\n"
    " *   · 고른 달 기준으로 요약 점수(매일 + 주간) · 🏆 그 달 Top 5 · 내 순위 · 📅 그 달 주간 점수 · 점수 기록이 바뀝니다.\n"
    " *   · 고른 달에 승인된 점수가 없으면 「10월엔 승인된 점수가 없어요」 라고만 보여요. 화면을 다시 열면 이번 달로 돌아옵니다.\n"
    " *   · 「이번 주」「전체」 탭과 저장 자료는 그대로입니다.\n"
    " *\n")

# ① 모양 — 달 고르기 줄 CSS (탭 CSS 바로 뒤)
rep(".ps-tab.active { background: white; color: var(--navy); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }\n",
    ".ps-tab.active { background: white; color: var(--navy); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }\n"
    "/* ★ v2-160: 「이번 달」 탭의 달 고르기 줄 ◀ 2026년 10월 ▶ */\n"
    ".ps-ym { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -4px 0 12px; padding: 4px 6px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; }\n"
    ".ps-ym button { flex: none; width: 36px; height: 32px; border: none; border-radius: 9px; background: #f1f5f9; color: var(--navy); font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; }\n"
    ".ps-ym button:disabled { color: #cbd5e1; background: #f8fafc; cursor: default; }\n"
    ".ps-ym .ps-ym-t { flex: 1; text-align: center; font-size: 15px; font-weight: 800; color: var(--navy); }\n"
    ".ps-ym .ps-ym-t small { display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-top: 1px; }\n")

# ② 달 고르기 상태 + 날짜 범위 — getPlannerScoreDateRange('month') 가 PS_YM 을 쓴다
rep("""  if (range === 'month') {
    var ym = now.getFullYear() + '.' + String(now.getMonth()+1).padStart(2,'0');
    return { start: ym + '.01', end: ym + '.31', label: '이번 달', ym: getCurrentYMKey() };
  }
""", """  if (range === 'month') {
    /* ★ v2-160: 고른 달(PS_YM) 기준 — 없으면 이번 달 */
    var ymk = psYM();
    var ym = ymk.replace('-', '.');
    return { start: ym + '.01', end: ym + '.31', label: psYmLabel(ymk), ym: ymk };
  }
""")
rep("""function fmtYMD(d) {
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}
""", """function fmtYMD(d) {
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}
/* ★ v2-160: 「이번 달」 탭의 달 고르기 — PS_YM = 고른 달 'YYYY-MM' (null = 이번 달). 화면을 다시 열면(go) 이번 달로 돌아온다 */
var PS_YM = null;
window.PS_YM = PS_YM;
function psYM(){ return (PS_YM && /^\\d{4}-\\d{2}$/.test(PS_YM)) ? PS_YM : getCurrentYMKey(); }
/* 집계 시작 달 'YYYY-MM' — PLANNER_SCORE_START_DATE('2026.05.01') 에서 */
function psStartYM(){ var p = String(PLANNER_SCORE_START_DATE || '').split('.'); return p.length >= 2 ? (p[0] + '-' + p[1]) : '2026-05'; }
/* 달 더하기 — 'YYYY-MM' + n 달 */
function psAddYM(ym, n){ var p = ym.split('-'); var y = +p[0], m = +p[1] - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0'); }
/* 짧은 달 이름 — 이번 달 「이번 달」 · 같은 해 「10월」 · 다른 해 「2025년 12월」 */
function psYmShort(ym){ var cur = getCurrentYMKey(); if (ym === cur) return '이번 달'; var p = ym.split('-'); return (p[0] === cur.slice(0, 4) ? '' : (p[0] + '년 ')) + (+p[1]) + '월'; }
/* 요약 카드 label — 이번 달 「이번 달」 · 지난달 「지난달 · 10월」 · 그 전 「9월」 */
function psYmLabel(ym){ var cur = getCurrentYMKey(); if (ym === cur) return '이번 달'; var sh = psYmShort(ym); return ym === psAddYM(cur, -1) ? ('지난달 · ' + sh) : sh; }
/* ◀ ▶ — 집계 시작 달 ~ 이번 달 사이에서만 움직인다 */
window.psMonthMove = function(n){
  var cur = getCurrentYMKey(), st = psStartYM(); var ym = psAddYM(psYM(), n);
  if (ym > cur) ym = cur; if (ym < st) ym = st;
  PS_YM = (ym === cur) ? null : ym; window.PS_YM = PS_YM;
  renderPlannerScoreScreen();
};
/* 달 고르기 줄 HTML */
function psYmBarHtml(ym){
  var cur = getCurrentYMKey(), st = psStartYM(); var p = ym.split('-');
  var sub = ym === cur ? '이번 달' : (ym === psAddYM(cur, -1) ? '지난달' : '');
  return '<div class="ps-ym" id="ps-ym-bar">'
    + '<button type="button" onclick="psMonthMove(-1)" ' + (ym <= st ? 'disabled' : '') + ' aria-label="지난달">◀</button>'
    + '<div class="ps-ym-t" id="ps-ym-t">' + p[0] + '년 ' + (+p[1]) + '월' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'
    + '<button type="button" onclick="psMonthMove(1)" ' + (ym >= cur ? 'disabled' : '') + ' aria-label="다음 달">▶</button></div>';
}
""")

# ③ 화면 그리기 — 달 고르기 줄 · 그 달 기준 제목 · 달에 기록 없을 때 안내
rep("""  var html = '';

  // v1-18: 5월 한 달간 시작 안내 배너 표시
  var nowYM = getCurrentYMKey(); // "2026-05"
""", """  var html = '';
  /* ★ v2-160: 「이번 달」 탭 — 달 고르기 줄을 맨 위에 · 고른 달에 기록(매일·주간)이 없으면 달 안내만 */
  var psMon = (range === 'month' && rg.ym) ? psYmShort(rg.ym) : '';   /* 「이번 달」 · 「10월」 */
  if (range === 'month' && rg.ym) {
    html += psYmBarHtml(rg.ym);
    if (my.days === 0 && !my.weeks.length) {
      html += '<div class="ps-empty" id="ps-month-empty"><div class="ps-empty-icon">📋</div>' + (rg.ym === getCurrentYMKey() ? '이번 달엔' : psMon + '엔') + ' 승인된 점수가 없어요<br><br><span style="font-size:13px;color:#94a3b8">◀ ▶ 로 다른 달을 볼 수 있어요</span></div>';
      body.innerHTML = html;
      return;
    }
  }

  // v1-18: 5월 한 달간 시작 안내 배너 표시
  var nowYM = getCurrentYMKey(); // "2026-05"
""")
rep("""    html += '<div class="ps-rank-title">🏆 이번 달 Top 5' + (rg.ym >= '2026-10' ?""",
    """    html += '<div class="ps-rank-title">🏆 ' + psMon + ' Top 5' + (rg.ym >= '2026-10' ?""")
rep("""    html += '<div class="ps-rank-card"><div class="ps-rank-title">📅 이번 달 주간 점수</div>""",
    """    html += '<div class="ps-rank-card"><div class="ps-rank-title">📅 ' + psMon + ' 주간 점수</div>""")
rep("""    html += '<div class="ps-rank-title">📅 최근 점수 기록</div>';""",
    """    html += '<div class="ps-rank-title">📅 ' + (psMon && psMon !== '이번 달' ? psMon + ' 점수 기록' : '최근 점수 기록') + '</div>';   /* ★ v2-160: 고른 달이면 「10월 점수 기록」 */""")

# ④ 화면을 열 때 이번 달로 돌아온다
rep("""  if (id === 'screen-planner-score') {
    if (typeof renderPlannerScoreScreen === 'function') renderPlannerScoreScreen();
  }
""", """  if (id === 'screen-planner-score') {
    PS_YM = null; window.PS_YM = null;   /* ★ v2-160: 화면을 다시 열면 이번 달로 */
    if (typeof renderPlannerScoreScreen === 'function') renderPlannerScoreScreen();
  }
""")

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
