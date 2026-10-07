s=open('student_v2-130.html').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
rep("var STU_VER = 'v2-130';","var STU_VER = 'v2-131';")
# 공용 계산 — 학원앱 v19-91 plweek_core 와 같은 글자 (원장 결정 2026-10-07 「순공, 주간계획 10점씩」)
rep(" *   주간 점수(10) = 다음 주 계획 3 + 이번 주 계획 실천 3 + 순공피드백 사진 2 + 순공피드백 종이 2",
    " *   주간 점수(20) = 📅 주간계획 10 (다음 주 계획 5 + 실천 5) + 📔 순공피드백 10 (사진 5 + 종이 5) — 원장 결정 2026-10-07 「순공, 주간계획 10점씩」\n *     (2026-09-28 처음 정한 것은 10점 = 계획 3 + 실천 3 + 사진 2 + 종이 2)")
rep("pt: rate >= 70 ? 3 : (rate >= 40 ? 2 : (ok > 0 ? 1 : 0)), noEv: noEv };", "pt: rate >= 70 ? 5 : (rate >= 40 ? 3 : (ok > 0 ? 1 : 0)), noEv: noEv };")
rep("PW.PT = { plan: { ok: 3, late: 1, none: 0 }, photo: { ok: 2, late: 1, none: 0 }, paper: { ok: 2, late: 1, none: 0 } };",
    "PW.PT = { plan: { ok: 5, late: 2, none: 0 }, photo: { ok: 5, late: 2, none: 0 }, paper: { ok: 5, late: 2, none: 0 } };\nPW.MAX = { plan: 5, prac: 5, photo: 5, paper: 5, wp: 10, sg: 10, total: 20 };   /* 2026-10-07: 주간계획 10 + 순공피드백 10 */")
# 주간계획표 점수 카드
rep("'<small>/10</small></span></div>'", "'<small>/' + PW.MAX.total + '</small></span></div>'")
rep("h += g('📅 주간계획', s.planPt + s.prac.pt, 6, '#1d4ed8');", "h += g('📅 주간계획', s.planPt + s.prac.pt, PW.MAX.wp, '#1d4ed8');")
rep("h += g('📔 순공피드백', s.photoPt + s.paperPt, 4, '#7c3aed');", "h += g('📔 순공피드백', s.photoPt + s.paperPt, PW.MAX.sg, '#7c3aed');")
rep("s.planPt + '/3</span></div>';", "s.planPt + '/' + PW.MAX.plan + '</span></div>';")
rep("s.prac.pt + '/3</span></div>';", "s.prac.pt + '/' + PW.MAX.prac + '</span></div>';")
rep("s.photoPt + '/2</span></div>';", "s.photoPt + '/' + PW.MAX.photo + '</span></div>';")
rep("s.paperPt + '/2</span></div>';", "s.paperPt + '/' + PW.MAX.paper + '</span></div>';")
# 순공피드백 화면
rep("밤 12시까지 올리면 2점';", "밤 12시까지 올리면 ' + PW.PT.photo.ok + '점';")
rep("return '⏰ 오늘 밤 12시까지 올리면 지각 1점';", "return '⏰ 오늘 밤 12시까지 올리면 지각 ' + PW.PT.photo.late + '점';")
rep("""'<small style="font-size:11px;color:#94a3b8">/4</small></b></div>';""", """'<small style="font-size:11px;color:#94a3b8">/' + PW.MAX.sg + '</small></b></div>';""")
rep("<small>주간 점수 10점 중 4점 (사진 2 + 종이 2)</small>", "<small>한 주 ' + PW.MAX.sg + '점 (사진 ' + PW.MAX.photo + ' + 종이 ' + PW.MAX.paper + ')</small>")
rep("""📸 <b>사진 인증</b> — 그 주 종이를 일요일 밤 12시까지 2점 · 월요일 1점<br>📔 <b>종이</b>는 다음 주 첫 수업 때 학원에 꼭 가져와요 — 2점</div>';""",
    """📸 <b>사진 인증</b> — 그 주 종이를 일요일 밤 12시까지 '+PW.PT.photo.ok+'점 · 월요일 '+PW.PT.photo.late+'점<br>📔 <b>종이</b>는 다음 주 첫 수업 때 학원에 꼭 가져와요 — '+PW.PT.paper.ok+'점 (그 주 안 '+PW.PT.paper.late+'점)</div>';""")
# 점수 기준 카드 (플래너)
rep("""📅 <b>주간 점수 10점</b> — 일요일 밤 12시 마감<br>
          다음 주 계획(앱) 3 · 계획 실천 3 · 순공피드백 사진 2 · 순공피드백 종이(학원) 2<br>""",
    """📅 <b>주간 점수 20점</b> — 일요일 밤 12시 마감<br>
          <b>주간계획 10</b> = 다음 주 계획(앱) 5 · 계획 실천 5<br>
          <b>순공피드백 10</b> = 사진 5 · 종이(학원) 5 · 늦으면 2<br>""")
import re
m=re.search(r"올리면 1점'", s)
open('student_v2-131.html','w').write(s); print('ok', bool(m))
s=open('student_v2-131.html').read()
a="오늘 밤 12시까지 올리면 1점'"; assert s.count(a)==1
s=s.replace(a,"오늘 밤 12시까지 올리면 '+PW.PT.photo.late+'점'")
open('student_v2-131.html','w').write(s)
