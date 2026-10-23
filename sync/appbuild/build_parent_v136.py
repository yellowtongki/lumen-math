# 학부모앱 v1-36 조립 — «v1-35 복사 + rep 고침 + 뒤에 modules/parent36.js 붙이기»
#   원장 결정 2026-10-23 (안 A · 계약서 docs/rec_review_contract.md §4 · 시안 docs/mockup_parent_rec.html)
#   녹음 숙제에 «그날 주제 · ✓ 선생님 확인 · 선생님 한마디» 를 보여 준다. 소리·전문은 지금처럼 비공개.
#   새로 읽는 서버 칸: rec_topics · rec_review_<코드> (다른 학생 전문이 든 rec_read_* 는 읽지 않는다)
#   ⚠️ 배포하지 않는다 — parent.html(학부모 고정 주소)은 원장 지시 때만 바꾼다.
#   실행: python3 sync/appbuild/build_parent_v136.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'parent_v1-35.html'); DST = os.path.join(ROOT, 'parent_v1-36.html')
MOD = open(os.path.join(ROOT, 'sync', 'appbuild', 'modules', 'parent36.js'), encoding='utf-8').read()
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

def rep_between(a, z, b):
    """a 부터 z 바로 앞까지를 b 로 — 두 표시 글자는 정확히 1번씩 있어야 한다"""
    global s
    assert s.count(a) == 1, (a[:70], s.count(a)); assert s.count(z) == 1, (z[:70], s.count(z))
    i = s.index(a); j = s.index(z); assert i < j, 'order'
    s = s[:i] + b + s[j:]

rep("var PAR_VER = 'v1-35';", "var PAR_VER = 'v1-36';")
# 읽기 — 로그인 때 그날 주제(rec_topics) · 원장 확인 칸(rec_review_<코드>)
rep("'lumen_group_days','hw_parent_cfg']);",
    "'lumen_group_days','hw_parent_cfg','rec_topics','rec_review_'+code]);   /* v1-36: 녹음 주제 · 선생님 확인 */")
rep("      else if(row.key==='hw_parent_cfg') P.hwcfg=v;     // v1-35: 학원앱이 정한 미흡 기준·미제출 경고 일수\n",
    "      else if(row.key==='hw_parent_cfg') P.hwcfg=v;     // v1-35: 학원앱이 정한 미흡 기준·미제출 경고 일수\n"
    "      else if(row.key==='rec_topics') P.rtop=v;         // v1-36: 녹음 그날 주제 (학년·개인)\n"
    "      else if(row.key==='rec_review_'+code) P.rrev=v;   // v1-36: 원장 ✓ 확인 · 한마디 (학원앱 훑어보기)\n")
rep("P.blk=null; P.blkOpen=false; P.mfrep=null;", "P.blk=null; P.blkOpen=false; P.mfrep=null; P.rtop=null; P.rrev=null;")
rep("P.gdays=null; P.hwcfg=null;", "P.gdays=null; P.hwcfg=null; P.rtop=null; P.rrev=null;")
# 숙제 탭 녹음 칸 → parent36.js 의 p36HwRec 로 떼어 냄
rep_between("  // 녹음\n  h+='<div class=\"sec\"><div class=\"st\">🎙️ 하브루타 녹음 <button class=\"more\" onclick=\"goTab(\\'rec\\')\">제출 기록 ›</button></div>';\n",
            "  // 월별 기록 (과제 완성도 달력)\n",
            "  // 녹음 — v1-36: 주제 · 선생님 확인 · 한마디 (parent36.js)\n  h+=p36HwRec(rc);\n")
# 화면 모양 (시안 docs/mockup_parent_rec.html)
rep(".tb .tl{font-size:9.5px}\n</style>",
    ".tb .tl{font-size:9.5px}\n"
    "/* v1-36: 녹음 주제 · 선생님 확인 · 한마디 */\n"
    ".p35box .sub.p36w{white-space:normal;overflow:visible}\n"
    ".p35box .p36tp{font-size:9.5px;color:#0d2240;font-weight:700;margin-top:5px;background:#fff;border:1px solid #e2e8f0;border-radius:7px;padding:4px 6px;line-height:1.4;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}\n"
    ".p36topic{font-size:11.5px;font-weight:800;color:#0d2240;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:8px 11px;margin-top:9px;line-height:1.5;overflow-wrap:anywhere}\n"
    ".p36topic small{display:block;font-size:9.5px;color:#a16207;font-weight:800;margin-bottom:1px}\n"
    ".p36st{display:flex;gap:9px;align-items:flex-start;margin-top:9px;border-radius:11px;padding:10px 12px;border:1px solid}\n"
    ".p36st .i{font-size:15px;line-height:1.3}.p36st .t{font-size:11px;font-weight:900}.p36st .s{font-size:9.5px;font-weight:700;margin-top:1px}\n"
    ".p36st.ok{background:#ecfdf5;border-color:#a7f3d0}.p36st.ok .t{color:#065f46}.p36st.ok .s{color:#059669}\n"
    ".p36st.wait{background:#f8fafc;border-color:#e2e8f0}.p36st.wait .t{color:#334155}.p36st.wait .s{color:#64748b}\n"
    ".p36st.no{background:#fff7ed;border-color:#fed7aa}.p36st.no .t{color:#9a3412}.p36st.no .s{color:#c2410c}\n"
    ".p36say{margin-top:8px;background:#eef6ff;border-left:3px solid #1d6fe8;border-radius:0 9px 9px 0;padding:8px 11px;font-size:11.5px;color:#1e3a8a;font-weight:700;line-height:1.55;overflow-wrap:anywhere}\n"
    ".p36say small{display:block;font-size:9.5px;color:#3b82f6;font-weight:800;margin-top:2px}\n"
    ".p36lock{background:#f8fafc;border:1px solid #e8eef8;border-radius:12px;padding:11px 13px;font-size:11px;color:#475569;font-weight:700;line-height:1.75;margin:0 16px 12px}\n"
    ".p36lock b{color:#0d2240}\n"
    ".p36stats{display:flex;gap:8px;margin:0 16px 12px}\n"
    ".p36stats>div{flex:1;min-width:0;background:#fff;border:1.5px solid #eef2f7;border-radius:12px;padding:11px 6px;text-align:center}\n"
    ".p36stats .k{font-size:10px;color:#94a3b8;font-weight:800;white-space:nowrap}.p36stats .v{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}.p36stats .v span{font-size:11px;color:#64748b}\n"
    ".p36item{padding:9px 0;border-bottom:1px solid #f1f5f9}.p36item:last-child{border-bottom:0}\n"
    ".p36item .r1{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#334155}\n"
    ".p36item .chk{margin-left:auto;font-size:10px;font-weight:900;color:#059669;background:#ecfdf5;border-radius:10px;padding:2px 8px;white-space:nowrap}.p36item .chk.w{color:#64748b;background:#f1f5f9}\n"
    ".p36item .r2{font-size:11px;color:#0d2240;font-weight:700;margin-top:2px;overflow-wrap:anywhere}\n"
    ".p36item .r3{font-size:10.5px;color:#1e3a8a;font-weight:700;margin-top:4px;background:#eef6ff;border-radius:7px;padding:5px 9px;overflow-wrap:anywhere}\n"
    "</style>")
# 뒤에 붙이기 — 마지막 스크립트 블록 끝 (뒤에 붙인 function 선언이 앞의 p35Box·vRec 를 덮는다)
rep("\n</script>\n</body></html>", "\n" + MOD + "\n</script>\n</body></html>")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
