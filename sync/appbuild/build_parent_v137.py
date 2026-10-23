# 학부모앱 v1-37 조립 — «v1-36 복사 + rep 고침 + 뒤에 modules/parent37.js 붙이기»
#   원장 결정 2026-10-23 「숙제 4단계 v1-37도 만들어」 (시안 docs/mockup_parent_hw4.html ①②③)
#   ① 과제 완성도 카드: 총합 머리 아래 4칸(풀이·채점·오답·아하노트)을 항상 펼침 — 눈금 ○ ◔ ◐ ✓ + %
#      (숙제 탭 위쪽 vHwToday · 홈 📚 카드 p35HwCard 의 4칸도 같은 눈금)
#   ② 숙제 탭 «단계별 체크 · 최근 수업일 7번» (예전 «최근 7일» 총합 막대 vHwWeek 자리)
#   ③ 월 기록: 맨 위 단계별 평균 4칸 + 지난달 대비 · 막대 아래 달력(단계 점 4개)
#   자료는 그대로(lumen_hw · 아하노트 수) — 서버 읽기·쓰기 추가 없음
#   ⚠️ 배포하지 않는다 — parent.html(학부모 고정 주소)은 원장 지시 때만 바꾼다.
#   실행: python3 sync/appbuild/build_parent_v137.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-36.html'); DST = os.path.join(ROOT, 'parent_v1-37.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent37.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var PAR_VER = 'v1-36';", "var PAR_VER = 'v1-37';")
# ② 숙제 탭 — 예전 «최근 7일» 총합 막대(vHwWeek) 자리에 ① 과제 완성도 카드 + ② 단계별 체크
rep("  h+=vHwWeek();   // 최근 7일 과제 완성도\n",
    "  h+=vHwToday();   /* v1-37 ① 과제 완성도 — 4단계 항상 펼침 (parent37.js) */\n"
    "  h+=p37Steps7();  /* v1-37 ② 단계별 체크 · 최근 수업일 7번 (예전 vHwWeek 자리) */\n")
# ① 홈 📚 카드의 4칸 → 같은 눈금(○ ◔ ◐ ✓)
rep("  h+='<div class=\"cells\">'+cell('#eff6ff','#1d4ed8',v.p+'%','풀이')+cell('#fffbeb','#b45309',v.c+'%','채점')+cell(v.w>=100?'#f0fdf4':'#fef2f2',v.w>=100?'#15803d':'#b91c1c',v.w+'%','오답')\n"
    "    +cell(ap===null?'#f8fafc':'#f5f3ff',ap===null?'#94a3b8':'#7c3aed',(ap===null?'—':ap+'%'),'질문')+'</div>';\n",
    "  h+=p37Cells(iso,true)+'<div class=\"p37tip mini\">✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 선생님 확인 체크</div>';   /* v1-37 ① 4단계 눈금 */\n")
# ③ 월 기록 — 맨 위 단계별 평균 4칸 + 지난달 대비 / 막대 아래 달력(단계 점)
rep("  h+='<div class=\"mnav\"><button onclick=\"hwShiftMon(-1)\">◀</button><span class=\"ym\">'+y+'년 '+m+'월</span><button onclick=\"hwShiftMon(1)\">▶</button></div>';\n",
    "  h+='<div class=\"mnav\"><button onclick=\"hwShiftMon(-1)\">◀</button><span class=\"ym\">'+y+'년 '+m+'월</span><button onclick=\"hwShiftMon(1)\">▶</button></div>';\n"
    "  h+=p37MonthTop(y,m);   /* v1-37 ③ 단계별 평균 · 지난달 대비 */\n")
rep("  // 단계별 평균\n",
    "  h+=p37Cal(y,m,sel);   /* v1-37 ③ 달력 — 단계 점 4개 */\n  // 단계별 평균\n")
# 화면 모양 (시안 docs/mockup_parent_hw4.html)
CSS = (
    "/* v1-37: 숙제 4단계 — ① 4칸 · ② 단계별 체크 표 · ③ 월 평균 · 달력 점 */\n"
    ".p37stg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:10px}\n"
    ".p37stg .c{border-radius:11px;padding:7px 3px 6px;text-align:center;border:1.5px solid #eef2f7;min-width:0}\n"
    ".p37stg .n{font-size:10px;font-weight:800;color:#64748b;white-space:nowrap;letter-spacing:-.04em;overflow:hidden;text-overflow:ellipsis}\n"
    ".p37stg .m{font-size:20px;font-weight:900;line-height:1.15;margin:2px 0 1px}\n"
    ".p37stg .p{font-size:10px;font-weight:900;line-height:1.35;word-break:keep-all;letter-spacing:-.03em}\n"
    ".p37stg .q{font-size:9px;font-weight:800;opacity:.8}\n"
    ".p37stg.mini{margin-bottom:0;gap:5px}.p37stg.mini .c{padding:5px 2px 4px;border-radius:10px}.p37stg.mini .m{font-size:16px;margin:0}.p37stg.mini .n,.p37stg.mini .p{font-size:9px}.p37stg.mini .q{font-size:8.5px}\n"
    ".p37card{margin:12px 16px 0}.p37card+.hwfaq{margin:10px 16px 0}\n"
    ".p37card .hw2{align-items:flex-end}\n"
    ".p37desc{flex:1;min-width:0;font-size:11.5px;font-weight:700;opacity:.95;line-height:1.45}\n"
    ".p37tip{font-size:10px;color:#94a3b8;font-weight:700;line-height:1.6;margin:8px 0 2px}\n"
    ".p37tip.mini{margin:-3px 0 0;font-size:9px;text-align:center}\n"
    ".p37sec .st .p37sub{font-size:10px;color:#94a3b8;font-weight:800}\n"
    ".p37g{width:100%;border-collapse:separate;border-spacing:3px;table-layout:fixed;margin-top:6px}\n"
    ".p37g th{font-size:9px;font-weight:800;color:#94a3b8;padding:1px 0;white-space:nowrap;letter-spacing:-.05em;overflow:hidden}\n"
    ".p37g th.l{width:42px}\n"
    ".p37g td{text-align:center;border-radius:7px;padding:5px 0;font-weight:900;font-size:12px;background:#f1f5f9;color:#cbd5e1;line-height:1.2;overflow:hidden}\n"
    ".p37g td.l{text-align:left;background:none;color:#334155;font-size:10px;font-weight:800;padding-left:0;white-space:nowrap;letter-spacing:-.03em}\n"
    ".p37g td.l i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;vertical-align:middle}\n"
    ".p37g td.ok{background:#dcfce7;color:#15803d}.p37g td.half{background:#fef3c7;color:#b45309}.p37g td.no{background:#fee2e2;color:#b91c1c}.p37g td.na{background:#f8fafc;color:#cbd5e1}\n"
    ".p37g td.a{font-size:10px;letter-spacing:-.04em}\n"
    ".p37g tr.tot td{background:#fff;border:1px solid #eef2f7;font-size:10.5px}\n"
    ".p37g tr.tot td.l{border:none;color:#0d2240}\n"
    ".p37msg{font-size:10.5px;color:#475569;font-weight:700;line-height:1.6;margin-top:8px}\n"
    ".p37msg .p37avgnote{color:#94a3b8}\n"
    ".p37home{margin-top:8px;border-radius:9px;padding:8px 11px;font-size:11px;font-weight:700;background:#eef6ff;color:#1e3a8a;line-height:1.55}\n"
    ".p37avg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\n"
    ".p37avg>div{text-align:center;border-radius:10px;padding:8px 3px;background:#f8fafc;min-width:0}\n"
    ".p37avg .v{font-size:17px;font-weight:900;line-height:1.2}.p37avg .k{font-size:9.5px;color:#64748b;font-weight:800;white-space:nowrap;letter-spacing:-.03em}\n"
    ".p37cmp{font-size:10.5px;color:#475569;font-weight:700;line-height:1.6;margin-top:9px;background:#f8fafc;border-radius:9px;padding:7px 10px}\n"
    ".p37cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}\n"
    ".p37cal .w{font-size:9px;font-weight:800;color:#94a3b8;text-align:center}\n"
    ".p37cal .c{aspect-ratio:1;border-radius:8px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0}\n"
    ".p37cal .c.e{background:none}\n"
    ".p37cal .c.on{background:#fff;border:1px solid #e2e8f0;cursor:pointer}\n"
    ".p37cal .c.sel{box-shadow:0 0 0 2px #1d6fe8}\n"
    ".p37cal .d{font-size:9.5px;font-weight:800;color:#cbd5e1}.p37cal .c.on .d{color:#0d2240}\n"
    ".p37cal .dots{display:flex;gap:2px}.p37cal .dots i{width:6px;height:6px;border-radius:50%;background:#e2e8f0;display:block}\n"
    ".p37cal .dots i.pt{opacity:.38}\n"
    ".p37leg{display:flex;flex-wrap:wrap;gap:4px 9px;margin-top:8px;font-size:9.5px;font-weight:800;color:#64748b;align-items:center}\n"
    ".p37leg i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;vertical-align:middle}\n"
    ".p37leg .t{color:#94a3b8;font-weight:700}\n"
)
rep("\n</style>\n</head>", "\n" + CSS + "</style>\n</head>")
# 뒤에 붙이기 — 마지막 스크립트 블록 끝 (뒤에 붙인 function 선언이 앞의 vHwToday 를 덮는다)
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
