# -*- coding: utf-8 -*-
# 학부모앱 v1-40 조립 — «v1-39 복사 + rep 고침 + 뒤에 modules/parent40.js 붙이기»
#   원장 2026-11-11~13 「성적 추이가 겹쳐서 보기 불편 · 주간은 전국 시험이라 따로 · 일일은 난이도가 변함 · 2단계 진행」
#   (시안 docs/mockup_parent_score_trend.html · 학원앱 v19-188 이 pub_reports_<코드>.hist 를 함께 발행)
#   ① 🏅 성적 탭 맨 위 «📈 성적 추이» 카드 ② 성적 추이 화면 P.tab 'strend' (주간·일일 나눠 · 최근 8회/전체)
#   새로 읽는 서버 칸 없음(pub_reports_<코드> 는 이미 읽는다) · 쓰기 없음
#   ⚠️ 배포하지 않는다 — parent.html(학부모 고정 주소)은 원장 「학부모앱 배포」 지시 때만 바꾼다.
#   실행: python3 sync/appbuild/build_parent_v140.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-39.html'); DST = os.path.join(ROOT, 'parent_v1-40.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent40.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var PAR_VER = 'v1-39';", "var PAR_VER = 'v1-40';")
rep("  else if(P.tab==='mrep') h=vMrep();   // v1-39: 📑 월간 학습 보고서\n",
    "  else if(P.tab==='mrep') h=vMrep();   // v1-39: 📑 월간 학습 보고서\n  else if(P.tab==='strend') h=vStrend();   // v1-40: 📈 성적 추이\n")
rep("  var body=vRankCard()+vAmapCard()+vKmmCard()+vCompassCard();",
    "  var body=p40Card()+vRankCard()+vAmapCard()+vKmmCard()+vCompassCard();   /* v1-40: 📈 성적 추이 카드 맨 위 */")
CSS = (
    "/* v1-40: 📈 성적 추이 */\n"
    ".p40card{background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:13px 15px;margin:0 14px 12px;cursor:pointer}\n"
    ".p40ct{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:900;color:#0d2240;margin-bottom:8px}.p40ct small{margin-left:auto;font-size:10.5px;color:#94a3b8;font-weight:700}.p40ct .go{margin-left:auto;font-size:11.5px;color:#1d6fe8;font-weight:900}\n"
    ".p40row{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.p40mini{display:flex;gap:3px;align-items:flex-end;height:38px;flex:none}.p40mini i{display:block;width:8px;border-radius:3px 3px 1px 1px}\n"
    ".p40big{font-size:26px;font-weight:900;color:#0d2240;font-variant-numeric:tabular-nums}\n"
    ".p40rk{display:inline-flex;align-items:baseline;gap:3px;font-size:12px;font-weight:900;border-radius:8px;padding:2px 8px;white-space:nowrap;font-variant-numeric:tabular-nums}.p40rk small{font-size:10px;font-weight:800;opacity:.85}\n"
    ".p40t{font-size:11.5px;color:#64748b;font-weight:600;line-height:1.55;margin-top:2px}\n"
    ".p40wrap{padding:0 14px 24px;display:flex;flex-direction:column;gap:10px}\n"
    ".p40seg{display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:11px}.p40seg button{flex:1;border:0;background:transparent;font-family:inherit;font-size:12.5px;font-weight:700;padding:8px 4px;border-radius:9px;color:#64748b;cursor:pointer}\n"
    ".p40seg button.on{background:#fff;color:#0d2240;font-weight:900;box-shadow:0 1px 3px rgba(0,0,0,.08)}.p40seg.sm button{padding:6px 4px;font-size:12px}\n"
    ".p40box{background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:13px 14px}\n"
    ".p40up{color:#15803d;font-weight:900;font-size:12.5px}.p40dn{color:#c2410c;font-weight:900;font-size:12.5px}\n"
    ".p40lg{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:10.5px;color:#64748b;font-weight:700;margin-top:4px}.p40lg i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:3px}\n"
    ".p40r{display:grid;grid-template-columns:44px 1fr auto;gap:8px;align-items:start;padding:7px 0;border-bottom:1px dashed #eef2f7;font-size:12.5px}.p40r:last-child{border-bottom:none}\n"
    ".p40r .dt{color:#64748b;font-weight:700;font-variant-numeric:tabular-nums}.p40r .mid{min-width:0}.p40r b{font-weight:900;color:#0d2240}.p40r small{color:#94a3b8;font-weight:700}\n"
    ".p40r em{display:block;font-style:normal;font-size:11px;color:#64748b;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n"
    ".p40tag{font-size:11px;font-weight:900;border-radius:7px;padding:2px 7px;white-space:nowrap}.p40tag.up{background:#ecfdf5;color:#15803d}.p40tag.dn{background:#fff1e6;color:#c2410c}\n"
)
rep("</style>", CSS + "</style>")
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
