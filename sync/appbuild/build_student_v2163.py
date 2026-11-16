# -*- coding: utf-8 -*-
# 학생앱 v2-163 조립 — «v2-162 복사 + rep 고침»
#   원장 2026-11-16 「진도레이스나 주간테스트에서 블랙반은 현재 2기만 엠블럼이 표시되게 · 지금은 1기도 표시」 → 「추천대로」
#   [무엇] 순위표(진도 레이스·플래너 랭킹·리그) 이름 옆 «🖤 BLACK» 칩(blkTinyOf · blkChipsOf)을 «지금 기수»일 때만 붙인다.
#          지금 기수 = 오늘(한국 날짜)이 그 기수 기간(from~to) 안 · 기간이 없으면 «마감 안 됨». 출신(지난 기수)은 칩을 안 붙인다.
#          (2기가 «마감»으로 저장돼 있어도 9/1~12/30 안이면 지금 기수)
#   [안 바꾼 것] 내 프로필·블랙반 카드의 기수 엠블럼(blkMine 등). 고정 주소 student_v1.html 은 원장 지시로만.
#   실행: python3 sync/appbuild/build_student_v2163.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-162.html'); DST = os.path.join(ROOT, 'student_v2-163.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)
rep("var STU_VER = 'v2-162';", "var STU_VER = 'v2-163';")
rep("""function blkTinyOf(code, px){
  var cs=blkCohortsOf(code); if(!cs.length) return '';
  var live=cs.some(function(c){ return !c.closed; });""",
"""/* ★ v2-163: 순위표 칩은 «지금 기수»만 — 날짜(from~to)로 판단 · 출신은 안 붙인다 (원장 2026-11-16) */
function blkNowOf(code){
  var cs=blkCohortsOf(code); if(!cs.length) return null;
  var today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  var now=cs.filter(function(c){ var f=String(c.from||'').slice(0,10), t=String(c.to||'').slice(0,10);
    if(f||t) return (!f||f<=today)&&(!t||today<=t); return !c.closed; });
  return now.length?now[now.length-1]:null;
}
function blkTinyOf(code, px){
  if(!blkNowOf(code)) return '';
  var live=true;""")
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
