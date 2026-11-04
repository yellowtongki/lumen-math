# 학부모앱 v1-38 조립 — «v1-37 복사 + rep 고침 + 뒤에 modules/parent38.js 붙이기»
#   원장 결정 2026-11-03 「A안(선생님 확인만) + 📄 학습지 줄」 (설계서 docs/hw_dispatch_contract.md §9-4 · 시안 docs/mockup_parent_hwcheck.html A안 ①②③)
#   ① 홈 📚 카드 「선생님 확인 전」 — 오늘(또는 반 요일표의 다음 수업일)에 lumen_hw 가 없으면 회색 상자 + 4칸 흐리게 + 「지난 수업 … 확인」 한 줄
#      (요일표가 없는 반은 지금처럼 마지막 확인 날짜를 보여 준다)
#   ② 📄 학습지 줄 — mf_wsq_<코드> 중 태그 「숙제」(HOMEWORK) · 그 수업일 앞 7일 안 배정 → 제목·문항·맞은 수/마감. 홈 카드 + 숙제 탭 7일 표 줄
#      문제 그림·문항 내용은 절대 안 보임(시험지 규칙) — 읽을 때 제목·숫자만 남긴다
#   ③ 📗 이번 숙제 줄 — todo_<코드> 의 hw 카드 중 그 수업일 마감 → 제목·쪽·문항. 없으면 줄을 안 그린다
#   학생 셀프 체크(hw_self_*)는 읽지 않는다(A안). 새로 읽는 서버 칸: mf_wsq_<코드> · todo_<코드> (로그인 때 같은 질의에 키만 더함). 쓰기 없음.
#   ⚠️ 배포하지 않는다 — parent.html(학부모 고정 주소)은 원장 지시 때만 바꾼다.
#   실행: python3 sync/appbuild/build_parent_v136.py → build_parent_v137.py → build_parent_v138.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-37.html'); DST = os.path.join(ROOT, 'parent_v1-38.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent38.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var PAR_VER = 'v1-37';", "var PAR_VER = 'v1-38';")
# 읽기 — 로그인 때 학습지 목록(mf_wsq_<코드>) · 숙제 카드(todo_<코드>) 를 같은 질의에 더한다 (hw_self_* 는 읽지 않는다)
rep("'rec_topics','rec_review_'+code]);   /* v1-36: 녹음 주제 · 선생님 확인 */",
    "'rec_topics','rec_review_'+code,'mf_wsq_'+code,'todo_'+code]);   /* v1-36: 녹음 주제 · 선생님 확인  v1-38: 학습지 목록 · 숙제 카드 */")
rep("      else if(row.key==='rec_review_'+code) P.rrev=v;   // v1-36: 원장 ✓ 확인 · 한마디 (학원앱 훑어보기)\n",
    "      else if(row.key==='rec_review_'+code) P.rrev=v;   // v1-36: 원장 ✓ 확인 · 한마디 (학원앱 훑어보기)\n"
    "      else if(row.key==='mf_wsq_'+code) P.wsq=p38TrimWsq(v);   // v1-38: 📄 학습지 목록 — 제목·숫자만 남긴다(그림·문항 버림)\n"
    "      else if(row.key==='todo_'+code) P.todo=p38TrimTodo(v);   // v1-38: 📗 숙제 카드(hw:true 만)\n")
rep("P.mfrep=null; P.rtop=null; P.rrev=null;\n", "P.mfrep=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null;   /* v1-38 */\n")
rep("P.gdays=null; P.hwcfg=null; P.rtop=null; P.rrev=null;", "P.gdays=null; P.hwcfg=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null;")
# ① 홈 📚 카드 — 수업일인데 아직 확인 전이면 회색 상자. 확인 뒤에는 지금 카드 그대로 + ②③ 줄
rep("function p35HwCard(){\n  var iso=hwLatestIso();\n",
    "function p35HwCard(){\n"
    "  var S38=p38Session(); if(S38&&!hwOf(S38)) return p38PendingCard(S38);   /* v1-38 ① 선생님 확인 전 (요일표 있는 반만) */\n"
    "  var iso=hwLatestIso();\n")
rep("  h+=p37Cells(iso,true)+'<div class=\"p37tip mini\">✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 선생님 확인 체크</div>';   /* v1-37 ① 4단계 눈금 */\n",
    "  h+=p37Cells(iso,true)+'<div class=\"p37tip mini\">✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 선생님 확인 체크</div>';   /* v1-37 ① 4단계 눈금 */\n"
    "  h+=p38Lines(iso);   /* v1-38 ②③ 📄 학습지 · 📗 이번 숙제 (제목·숫자만) */\n")
# ② 숙제 탭 7일 표 — 「📄 학습지」 줄 (종합 줄 바로 위) + 설명 한 줄
rep("  h+='<tr class=\"tot\"><td class=\"l\">종합</td>';\n",
    "  h+=p38WsRow(isos);   /* v1-38 ② 📄 학습지 줄 — 그 수업일까지 마감이던 숙제 학습지 맞은 수 */\n"
    "  h+='<tr class=\"tot\"><td class=\"l\">종합</td>';\n")
rep("✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 4 아하 = 질문/막힌 문제 (— 는 막힌 문제가 없던 날)</div>';",
    "✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 4 아하 = 질문/막힌 문제 (— 는 막힌 문제가 없던 날)'+(P.wsq&&P.wsq.length?' · 📄 학습지 = 그 수업까지 마감이던 숙제 학습지 맞은 수/문항 (○ 채점 전)':'')+'</div>';")
# 화면 모양 (시안 docs/mockup_parent_hwcheck.html A안)
CSS = (
    "/* v1-38: 숙제 체크 보이기 — ① 선생님 확인 전 상자 · ② 📄 학습지 줄 · ③ 📗 이번 숙제 줄 */\n"
    ".p38pend{border-radius:0;padding:12px 14px 11px;background:linear-gradient(135deg,#e2e8f0,#f1f5f9);color:#334155}\n"
    ".p38pend .t{font-size:10px;font-weight:800;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n"
    ".p38pend .b{font-size:18px;font-weight:900;color:#0f172a;line-height:1.2;margin-top:1px}\n"
    ".p38pend .d{font-size:10.5px;font-weight:700;color:#64748b;margin-top:3px;line-height:1.5}\n"
    ".p38dim .c{opacity:.55}\n"
    ".p38ws{border-top:1px dashed #e2e8f0;padding-top:6px;display:flex;flex-direction:column;gap:2px}\n"
    ".p38ws .r{display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;min-width:0}\n"
    ".p38ws .r .ic{flex:none;font-size:12px}\n"
    ".p38ws .r b{flex:1;min-width:0;font-size:11.5px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n"
    ".p38ws .r .pl{flex:none;font-size:9.5px;font-weight:900;padding:1px 6px;border-radius:10px;background:#fef3c7;color:#b45309;white-space:nowrap}\n"
    ".p38ws .r .pl.g{background:#dcfce7;color:#15803d}.p38ws .r .pl.b{background:#dbeafe;color:#1d4ed8}\n"
    ".p38last{font-size:10px;color:#64748b;font-weight:700;line-height:1.55}\n"
    ".p38last b{color:#334155;font-weight:900}.p38last .mk{letter-spacing:.04em;color:#0f172a}.p38last span{color:#94a3b8}\n"
    ".p37g th.l{width:46px}\n"
    ".p37g tr.p38wsrow td.l{color:#475569;font-size:9.5px;letter-spacing:-.06em}\n"
)
rep("\n</style>\n</head>", "\n" + CSS + "</style>\n</head>")
# 뒤에 붙이기 — 마지막 스크립트 블록 끝
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
