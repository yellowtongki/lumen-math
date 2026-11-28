# -*- coding: utf-8 -*-
# 학부모앱 v1-42 조립 — «v1-41 복사 + rep 고침»
#   원장 2026-11-28 「성적 추이를 홈화면에 바로가기 형태로 · 더보기 비율이 안 맞는다」 → 시안 docs/mockup_parent_home_trend.html «A안»
#   ① 홈: 학습 리포트 카드 바로 아래에 «📈 성적 추이» 카드(p40Card — 성적 탭 맨 위 카드와 같은 것, 기록 없으면 안 그림)
#   ② 더보기: 진도 레이스 카드가 위 칸을 28px 덮던 것 — vRace 안의 «var top=Number(b.showTop)» 가 매개변수 top 을 덮어써서
#      더보기(vRace(false))에서도 «맨 위 걸치기(.rcp.top)»가 켜졌다. 매개변수를 따로 받아 고침.
#   ③ 더보기 칸 설명: 녹음 «하브루타» → «제출 날짜 · 선생님 한마디», 진학 나침반 «성적 탭 안» → «예상 내신 등급»
#   실행: python3 sync/appbuild/build_parent_v142.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-41.html'); DST = os.path.join(ROOT, 'parent_v1-42.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)
rep("var PAR_VER = 'v1-41';", "var PAR_VER = 'v1-42';")
rep("function vRace(top){", "function vRace(top){\n  var atTop=(top!==false);   /* v1-42: 아래 «var top=…showTop» 이 매개변수를 덮어써 더보기에서도 맨 위 걸치기가 켜졌다 */")
rep("var h='<div class=\"rcp'+(top===false?'':' top')+(open?' open':'')+'\">';", "var h='<div class=\"rcp'+(atTop?' top':'')+(open?' open':'')+'\">';")
rep("  h+=p35RepCard();\n  h+='</div>';", "  h+=p35RepCard();\n  try{ var tr42=p40Card(); if(tr42) h+='<div class=\"p42trend\">'+tr42+'</div>'; }catch(e){}   /* v1-42: 📈 성적 추이 바로가기 (A안) */\n  h+='</div>';")
rep("<b>녹음 제출 기록</b><small>하브루타</small>", "<b>녹음 제출 기록</b><small>제출 날짜 · 선생님 한마디</small>")
rep("<b>진학 나침반</b><small>성적 탭 안</small>", "<b>진학 나침반</b><small>예상 내신 등급</small>")
CSS = ("/* v1-42: 홈 성적 추이 카드 · 더보기 칸 높이 맞춤 */\n"
       ".p42trend .p40card{margin:0;border:2px solid #fed7aa;background:linear-gradient(135deg,#fff,#fff7ed);box-shadow:0 3px 12px rgba(13,34,64,.05)}\n"
       ".p35more .grid button{min-height:104px;justify-content:flex-end}\n")
rep("</style>", CSS + "</style>")
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
