# -*- coding: utf-8 -*-
# 학부모앱 v1-41 조립 — «v1-40 복사 + rep 고침 + 뒤에 modules/parent41.js 붙이기»
#   원장 2026-11-17 「숙제현황 업데이트가 안 되는 것 같다 · 지난 숙제가 보이게 · 날짜 잘 보이게 · C안 · 학원앱 표현 그대로」
#   (시안 docs/mockup_parent_hwdate_c.html) — 홈 📚 카드: 최근 확인 숙제 · 달력 쪽지 · 단계별 % 4단 색
#   실행: python3 sync/appbuild/build_parent_v141.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-40.html'); DST = os.path.join(ROOT, 'parent_v1-41.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent41.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var PAR_VER = 'v1-40';", "var PAR_VER = 'v1-41';")
CSS = (
    "/* v1-41: 📚 숙제 카드 C안 */\n"
    ".p41row{display:flex;gap:13px;padding:15px 15px 6px;align-items:center}\n"
    ".p41cal{flex:0 0 72px;border-radius:15px;overflow:hidden;text-align:center;border:2px solid #1e293b;background:#fff}\n"
    ".p41cal .m{background:#1e293b;color:#fff;font-size:11.5px;font-weight:800;padding:3px 0}.p41cal .d{font-size:31px;font-weight:900;line-height:1.15;color:#0f172a;padding-top:2px}.p41cal .w{font-size:12px;font-weight:800;color:#475569;padding-bottom:5px}\n"
    ".p41sum{flex:1;min-width:0}.p41sum .k{font-size:11.5px;color:#64748b;font-weight:700}.p41sum .t{font-size:18px;font-weight:900;color:#0f172a;margin:2px 0}\n"
    ".p41sum .tot{display:inline-block;border-radius:10px;padding:1px 8px;color:#fff;font-size:14px;font-weight:900;margin-left:5px;vertical-align:2px}\n"
    ".p41sum .bar{height:8px;background:#f1f5f9;border-radius:8px;overflow:hidden;margin-top:6px}.p41sum .bar i{display:block;height:100%}\n"
    ".p41stg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}\n"
    ".p41stg .st{border:2px solid;border-radius:13px;padding:7px 2px 6px;text-align:center;min-width:0}\n"
    ".p41stg .n{font-size:11.5px;font-weight:800;color:#334155}.p41stg .v{font-size:21px;font-weight:900;line-height:1.25;letter-spacing:-.5px}.p41stg .v small{font-size:12px}\n"
    ".p41stg .s{font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n"
    ".p41stg .na{background:#f8fafc;border-color:#cbd5e1;border-style:dashed}.p41stg .na .v{color:#94a3b8;font-size:13px;line-height:1.95}.p41stg .na .s{color:#94a3b8}\n"
    ".p41leg{display:flex;flex-wrap:wrap;gap:8px;font-size:10.5px;font-weight:800;color:#475569;margin:8px 0 2px}.p41leg i{display:inline-block;width:12px;height:12px;border-radius:4px;border:2px solid;vertical-align:-2px;margin-right:3px}\n"
    ".p41next{margin-top:10px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:8px 11px;font-size:12.5px;color:#475569}.p41next b{color:#0f172a}\n"
    ".p41today{background:#0f172a;color:#fff;font-size:12.5px;font-weight:800;padding:8px 15px}.p41today span{background:#facc15;color:#0f172a;border-radius:99px;padding:1px 8px;margin:0 2px}\n"
    ".p41dim .p41row,.p41dim .p41stg,.p41dim .p41leg{opacity:.55}\n"
)
rep("</style>", CSS + "</style>")
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
