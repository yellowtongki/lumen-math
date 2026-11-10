# -*- coding: utf-8 -*-
# 학부모앱 v1-39 조립 — «v1-38 복사 + rep 고침 + 뒤에 modules/parent39.js 붙이기»
#   원장 2026-11-10 「학부모앱에서도 월간보고서가 보이는 방식 · 두 가지 통합」 → 「추천대로」 (시안 docs/mockup_monthly_report.html)
#   ① 로그인 때 mfrep_pub_<코드> 를 같은 질의에 더해 읽는다(쓰기 없음)
#   ② 리포트 탭 맨 위 📑 달별 보고서 줄(없으면 예전 v1-34 PDF 목록 그대로) · 보고서 화면 P.tab 'mrep'
#   ③ 홈 맨 위 「📑 10월 학습 보고서가 도착했어요」 (공개 14일 안 · 이 폰에서 아직 안 연 달)
#   ⚠️ 배포하지 않는다 — parent.html(학부모 고정 주소)은 원장 「학부모앱 배포」 지시 때만 바꾼다.
#   실행: python3 sync/appbuild/build_parent_v139.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-38.html'); DST = os.path.join(ROOT, 'parent_v1-39.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent39.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var PAR_VER = 'v1-38';", "var PAR_VER = 'v1-39';")
rep("'rec_topics','rec_review_'+code,'mf_wsq_'+code,'todo_'+code]);",
    "'rec_topics','rec_review_'+code,'mf_wsq_'+code,'todo_'+code,'mfrep_pub_'+code]);   /* v1-39: 📑 월간 학습 보고서 */")
rep("      else if(row.key==='mf_report_files') P.mfrep=v;   // v1-34: 📊 매쓰플랫 월간 보고서 색인\n",
    "      else if(row.key==='mf_report_files') P.mfrep=v;   // v1-34: 📊 매쓰플랫 월간 보고서 색인\n"
    "      else if(row.key==='mfrep_pub_'+code) P.mpub=v;   // v1-39: 📑 월간 학습 보고서(매쓰플랫 숫자 + 의견 + 루멘 기록)\n")
rep("P.mfrep=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null;   /* v1-38 */\n",
    "P.mfrep=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null; P.mpub=null;   /* v1-38 · v1-39 */\n")
rep("P.gdays=null; P.hwcfg=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null;",
    "P.gdays=null; P.hwcfg=null; P.rtop=null; P.rrev=null; P.wsq=null; P.todo=null; P.mpub=null;")
rep("  else if(P.tab==='report') h=vReport();\n",
    "  else if(P.tab==='report') h=vReport();\n  else if(P.tab==='mrep') h=vMrep();   // v1-39: 📑 월간 학습 보고서\n")
rep("  h+=vMonthly();  // v1-34: 📊 매쓰플랫 월간 보고서 (있을 때만)\n",
    "  h+=(p39Months().length ? p39ReportList() : vMonthly());  // v1-39: 📑 월간 학습 보고서 (없으면 v1-34 PDF 목록 · 있을 때만)\n")
rep("  h+='<div class=\"p35main\">';\n  h+='<div class=\"p35sec\"><span>📌 매일 확인 · '",
    "  h+='<div class=\"p35main\">';\n  h+=p39ArriveCard();   /* v1-39: 📑 보고서 도착 */\n  h+='<div class=\"p35sec\"><span>📌 매일 확인 · '")
CSS = (
    "/* v1-39: 📑 월간 학습 보고서 */\n"
    ".p39arr,.p39row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;font-family:inherit;cursor:pointer}\n"
    ".p39arr{border:none;border-radius:14px;padding:12px 14px;margin-bottom:10px;background:linear-gradient(135deg,#0d2240,#1e3a6b);color:#fff;box-shadow:0 6px 16px rgba(13,34,64,.22)}\n"
    ".p39arr .ic,.p39row .ic{font-size:22px;flex:none}.p39arr .tx,.p39row .tx{flex:1;min-width:0}\n"
    ".p39arr b{display:block;font-size:14.5px;font-weight:900}.p39arr small{display:block;font-size:11px;opacity:.75;font-weight:700;margin-top:2px}\n"
    ".p39arr .go{flex:none;font-size:12px;font-weight:900;color:#ffd54a}\n"
    ".p39box{background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:14px 16px;margin-bottom:12px}\n"
    ".p39h{font-size:15px;font-weight:900;color:#0d2240;margin-bottom:3px}.p39s{font-size:11.5px;color:#94a3b8;font-weight:700;margin-bottom:10px}\n"
    ".p39row{border:1px solid #eef2f7;border-radius:12px;margin-bottom:7px;padding:11px 12px;background:#fbfdff;color:#0d2240}\n"
    ".p39row b{display:block;font-size:14px;font-weight:900}.p39row small{display:block;font-size:10.5px;color:#94a3b8;font-weight:700}.p39row .go{flex:none;font-size:11.5px;font-weight:900;color:#1d6fe8}\n"
    ".p39wrap{padding:0 14px 24px;display:flex;flex-direction:column;gap:10px}\n"
    ".p39mon{display:flex;gap:6px;overflow-x:auto}.p39mon button{border:1.5px solid #e2e8f0;background:#fff;border-radius:20px;padding:5px 13px;font-family:inherit;font-size:12.5px;font-weight:800;color:#64748b;cursor:pointer;white-space:nowrap}\n"
    ".p39mon button.on{border-color:#0d2240;color:#0d2240;background:#eef2f7}\n"
    ".p39card{background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:13px 14px}\n"
    ".p39t{font-size:13px;font-weight:900;color:#0d2240;margin-bottom:9px}.p39t small{font-size:10.5px;color:#94a3b8;font-weight:700;margin-left:4px}\n"
    ".p39big{display:flex;gap:6px;text-align:center}.p39big div{flex:1;background:#f6f8fb;border-radius:12px;padding:9px 4px}\n"
    ".p39big b{display:block;font-size:22px;font-weight:900;color:#0d2240;font-variant-numeric:tabular-nums}.p39big span{font-size:10.5px;color:#64748b;font-weight:700}\n"
    ".p39sub{margin-top:9px;font-size:12px;font-weight:800;color:#15803d;text-align:center}.p39sub.dn{color:#b45309}\n"
    ".p39bar{display:grid;grid-template-columns:96px 1fr 40px;gap:8px;align-items:center;font-size:12px;margin-bottom:7px}\n"
    ".p39bar .l{font-weight:800;color:#334155;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p39bar .l small{display:block;font-size:9.5px;color:#94a3b8;font-weight:700}\n"
    ".p39bar .tr{position:relative;height:10px;border-radius:6px;background:#eef2f7;overflow:visible}.p39bar .tr i{display:block;height:100%;border-radius:6px;background:#1d6fe8}.p39bar .tr i.low{background:#f59e0b}\n"
    ".p39bar .tr em{position:absolute;top:-3px;width:2px;height:16px;background:#0d2240;opacity:.55}\n"
    ".p39bar .v{text-align:right;font-weight:900;color:#0d2240;font-variant-numeric:tabular-nums}\n"
    ".p39bk{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px dashed #eef2f7}.p39bk:last-child{border-bottom:none}\n"
    ".p39bk b{font-weight:800;color:#0f172a;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p39bk span{flex:none;color:#64748b;font-weight:700}\n"
    ".p39q{margin:0;font-size:13.5px;line-height:1.75;color:#1e293b}.p39sig{text-align:right;font-size:11.5px;color:#94a3b8;font-weight:800;margin-top:8px}\n"
    ".p39lm{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px}.p39lm div{background:#f6f8fb;border-radius:12px;padding:9px}\n"
    ".p39lm b{display:block;font-size:18px;font-weight:900;color:#0d2240}.p39lm span{display:block;font-size:11.5px;font-weight:800;color:#334155}.p39lm small{display:block;font-size:9.5px;color:#94a3b8;font-weight:700;margin-top:2px;line-height:1.4}\n"
    ".p39foot{font-size:10.5px;color:#94a3b8;font-weight:700;text-align:center}\n"
)
rep("</style>", CSS + "</style>")
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
