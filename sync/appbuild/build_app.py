import os,re,sys
# 저장소 안에서 돌린다: python3 sync/appbuild/build_app.py v19-92  (저장소 맨 위 폴더에서)
#   modules/ = 기능별 부품(.js) · memos/memo_19NN.txt = 버전 메모 · 바탕 = lumen_v19-42.html
HERE=os.path.dirname(os.path.abspath(__file__))
SP=os.environ.get('SP') or os.path.join(HERE,'modules'); MEMO=os.environ.get('MEMO') or os.path.join(HERE,'memos'); ver=sys.argv[1]; base='lumen_v19-42.html'; out='lumen_'+ver+'.html'
s=open(base).read()
# EA 모듈
mod=open(SP+'/ea_module_v2.js').read()
m0=re.search(r'/\* ═+\n \* v19-35[~·0-9]*: 📚 기출 분석', s); start=m0.start(); end=s.index('/* v19-29 — 🔥 추가 버프 설정 칸'); old=s[start:end]
ti=old.index('/* ═══ 수식을 «인터넷 없이» 그리기'); tj=old.index("+'.lx-ubs{", ti); tj=old.index('\n', tj); tex=old[ti:tj]
ci=old.index("var LC_CSS=''"); cj=old.index("+'@page{size:A4 portrait;margin:10mm 9mm}';", ci)+len("+'@page{size:A4 portrait;margin:10mm 9mm}';"); css=old[ci:cj]
eacss=open(SP+'/_keep_css.js').read(); win=re.sub(r"EA_CSS\s*\+\s*'</style>", "EA_CSS+EA_CSS2+'</style>", open(SP+'/_keep_win.js').read()); chips=open(SP+'/_keep_chips.js').read()
mod=mod.replace(' * v19-35·36: 📚 기출 분석',' * v19-35~'+ver.replace('v19-','')+': 📚 기출 분석',1)
new=mod.replace('/*__TEX__*/',tex).replace('/*__CSS__*/',css).replace('/*__EACSS__*/',eacss).replace('/*__WIN__*/',win).replace('/*__CHIPS__*/',chips); assert '/*__' not in new
risk=open(SP+'/risk_module.js').read()
cal=open(SP+'/cal_teacher.js').read() if int(ver.replace('v19-',''))>=46 else ''
xp=open(SP+'/xp_publish.js').read() if int(ver.replace('v19-',''))>=47 else ''
codi=open(SP+'/codi_teacher.js').read() if int(ver.replace('v19-',''))>=48 else ''
ahs=open(SP+'/aha_teacher.js').read() if int(ver.replace('v19-',''))>=51 else ''
guard=open(SP+'/studb_guard.js').read() if int(ver.replace('v19-',''))>=52 else ''
plsc=(open(SP+'/plweek_core.js').read()+'\n'+open(SP+'/plscore_teacher.js').read()) if int(ver.replace('v19-',''))>=54 else ''
plz=open(SP+'/plzero_teacher.js').read() if int(ver.replace('v19-',''))>=66 else ''
pls=open(SP+'/plsept_teacher.js').read() if int(ver.replace('v19-',''))>=67 else ''
sea=open(SP+'/season_teacher.js').read() if int(ver.replace('v19-',''))>=69 else ''
nkt=open(SP+'/nick_teacher.js').read() if int(ver.replace('v19-',''))>=72 else ''
hit=open(SP+'/hit_teacher.js').read() if int(ver.replace('v19-',''))>=74 else ''
nfo=open(SP+'/notice_fold.js').read() if int(ver.replace('v19-',''))>=75 else ''
cn=(open(SP+'/cn_teacher.js').read()+'\n'+open(SP+'/htdb_teacher.js').read()) if int(ver.replace('v19-',''))>=80 else ''
plr=open(SP+'/plrules_teacher.js').read() if int(ver.replace('v19-',''))>=81 else ''
nopt=open(SP+'/natopt_teacher.js').read() if int(ver.replace('v19-',''))>=85 else ''
sgs=open(SP+'/sgscore_teacher.js').read() if int(ver.replace('v19-',''))>=86 else ''
sds=open(SP+'/studb_sync.js').read() if int(ver.replace('v19-',''))>=87 else ''
wks=open(SP+'/wksplit_teacher.js').read() if int(ver.replace('v19-',''))>=88 else ''
sgv=open(SP+'/sgview_teacher.js').read() if int(ver.replace('v19-',''))>=89 else ''
rcw=open(SP+'/rcws_teacher.js').read() if int(ver.replace('v19-',''))>=92 else ''   # v19-92: 리커버리 학습지 설계 → 매쓰플랫 즉시 생성
bt2=open(SP+'/bt2_teacher.js').read() if int(ver.replace('v19-',''))>=94 else ''   # v19-95: 중3 기본 과정 공통수학1   # v19-94: 백지테스트 2판 (과정·소단원 · 미리보기·편집 · 교과서 문항 · 답지)
s=s[:start]+risk+'\n'+cal+'\n'+xp+'\n'+codi+'\n'+ahs+'\n'+guard+'\n'+plsc+'\n'+plz+'\n'+pls+'\n'+sea+'\n'+nkt+'\n'+hit+'\n'+nfo+'\n'+cn+'\n'+plr+'\n'+nopt+'\n'+sgs+'\n'+sds+'\n'+wks+'\n'+sgv+'\n'+rcw+'\n'+bt2+'\n'+new.lstrip('\n')+'\n\n'+s[end:]
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
rep("    {v:'lgall', icon:'🏆', label:'리그 한눈에', act:function(){ VIEW='lgall'; }},",
    "    {v:'lgall', icon:'🏆', label:'리그 한눈에', act:function(){ VIEW='lgall'; }},\n    /* ★ v19-43: 🚨 위험 신호 — 흩어진 신호를 한 화면에 (원장 지시 2026-09-24) */\n    {v:'risk', icon:'🚨', label:'위험 신호', act:function(){ VIEW='risk'; }},")
a="    else if(VIEW==='examanal'){ try{ C.innerHTML=rExamAnal(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight"
i=s.find(a); line_end=s.find('\n',i); line=s[i:line_end]; assert s.count(line)==2
s=s.replace(line, line+"\n    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">위험 신호 오류: '+esc2(e.message)+'</div>'; } }")
rep("const titles={home:'🏠 홈',typeach:'📊 유형 성취도',","const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',typeach:'📊 유형 성취도',")
if cal:
    rep("    {v:'attend', icon:'📅', label:'출결·보충', act:function(){ VIEW='attend'; }},",
        "    {v:'attend', icon:'📅', label:'출결·보충', act:function(){ VIEW='attend'; }},\n    /* ★ v19-46: 📅 학원 달력 — 학교별 시험 D-day · 월 보기 · 학원 일정 입력 */\n    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},")
    b="    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }"
    assert s.count(b)==2
    s=s.replace(b, "    else if(VIEW==='cal'){ try{ C.innerHTML=rCal(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">학원 달력 오류: '+esc2(e.message)+'</div>'; } }\n"+b)
rep("""    AHA_LOADING=false;
    if(VIEW==='aha'||VIEW==='home'||VIEW==='bookdash') render();
  },function(err){""","""    AHA_LOADING=false;
    if(VIEW==='aha'||VIEW==='home'||VIEW==='bookdash') render();
    try{ ahxLoad(true); }catch(e){}   /* v19-43: 교재 노트를 매쓰플랫 채점과 잇는다 */
  },function(err){""")
rep("""(rt?' <span class="qr">🔁재풀이</span>':'')+'<span class="ans">답변 ☐</span></div>';""",
    """(rt?' <span class="qr">🔁재풀이</span>':'')+'<span class="ans">답변 ☐</span></div>';
      blocks+=ahxLine(n);""")
rep("""  return '<span style="font-size:11px;font-weight:700;color:#475569">'+ahaEsc(ahaSourceName(n))+' <b style="color:#1d6fe8">'+detail+'</b></span>';""",
    """  return '<span style="font-size:11px;font-weight:700;color:#475569">'+ahaEsc(ahaSourceName(n))+' <b style="color:#1d6fe8">'+detail+'</b></span>'+ahxLine(n);""")
if xp:
    rep("  rankData.sort(function(a,b){return b.xpData.total - a.xpData.total;});",
        "  rankData.sort(function(a,b){return b.xpData.total - a.xpData.total;});\n  try{ lvPublishAll(true); }catch(e){}   /* v19-47: 학생앱용 xp_board 게시 */")
if codi:
    rep("    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},",
        "    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},\n    /* ★ v19-48: 🧭 스터디 코디 — 학생별 계획·실천 현황판 + 대상·학부모 공개 설정 */\n    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},")
    c="    else if(VIEW==='cal'){ try{ C.innerHTML=rCal(); }"
    assert s.count(c)==2
    s=s.replace(c, "    else if(VIEW==='codi'){ try{ C.innerHTML=rCodi(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">스터디 코디 오류: '+esc2(e.message)+'</div>'; } }\n"+c)
    rep("const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',","const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',codi:'🧭 스터디 코디',")
    rep("    var promptText = promptLines.join('\\n');\n",
        "    /* ★ v19-48: 그날 스터디 코디 계획이 있으면 「계획 대비 실천」 대조 줄을 붙인다 */\n    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n    var promptText = promptLines.join('\\n');\n")
    rep("    analysis.promptVersion = 'v2.1';   /* ★ v19-30: 내일 쪽 날짜(dateNext)를 읽는 판 */\n",
        "    analysis.promptVersion = 'v2.1';   /* ★ v19-30: 내일 쪽 날짜(dateNext)를 읽는 판 */\n    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n")

if ahs:
    # A. 부터~까지 범위
    rep("  } else if(WB.range!=='all'){",
        "  } else if(WB.range==='custom'){   /* ★ v19-51: 📅 부터~까지 */\n    var _f=WB.from||'', _t=WB.to||'9999-12-31';\n    arr=arr.filter(function(n){ var d=iblDay(n.created_at); return d>=_f && d<=_t; });\n  } else if(WB.range!=='all'){")
    # 초안 대상: 날짜 골랐으면 그 날만
    rep("  var t=wbDraftTargets(wbNotes());", "  var t=wbDraftTargets(wbDraftPool());   /* ★ v19-51: 날짜를 골랐으면 그 날만 */")
    rep("  var rangeKo=(WB.range==='y'?'어제':(WB.range==='all'?'전체':'최근 7일'));", "  var rangeKo=wbRangeKo();   /* ★ v19-51 */")
    rep("  var dn=wbDraftTargets(notes).length;", "  var _day=wbDayPicked(); var dn=wbDraftTargets(_day?wbCurList():notes).length;   /* ★ v19-51 */")
    rep("'🤖 이 범위 AI 초안 ('+dn+'건)'", "'🤖 '+(_day?(wbDayShort(_day)+' AI 초안'):'이 범위 AI 초안')+' ('+dn+'건)'")
    rep("    +draftBtn\n    +rb('y','어제')+rb('7d','7일')+rb('all','전체')",
        "    +draftBtn+(_day?wbDayClearBtn():'')\n    +rb('y','어제')+rb('7d','7일')+rb('all','전체')+wbDateHtml()")
    # 읽음·🙋 배지 (줄·카드) + 읽음 기록 로드 + 모아 보기
    rep("  unBadge+=ahaStudentMarkBadge(n);", "  unBadge+=ahaStudentMarkBadge(n);\n  unBadge+=ahsBadge(n);   /* ★ v19-51: 👀 읽음 · 💡 아직 안 봄 · 🙋 아직 모르겠어요 */")
    rep("⚠ 탐구 조건 미달</span>':'')\n    +'</div>';", "⚠ 탐구 조건 미달</span>':'')\n    +ahsBadge(n)\n    +'</div>';")
    rep("function wbMain(){\n  var notes=wbNotes();", "function wbMain(){\n  try{ ahsLoad(); }catch(e){}   /* ★ v19-51: 힌트 읽음 기록 */\n  var notes=wbNotes();")
    rep("  var raw=[ {key:'x_retry'", "  var help=notes.filter(function(n){ return ahsHelp(n); });   /* ★ v19-51 */\n  var raw=[ {key:'x_help', label:'🙋 아직 모르겠어요', chip:'🙋 모르겠어요', list:help},\n            {key:'x_retry'")
    # 힌트 발송 → 즉시 푸시 요청, 취소 → 요청 삭제
    rep("hntHintsSave().then(function(){ ahaToast('💡 힌트 발송 완료 — 학생앱에 표시됩니다'); hntRender(); try{ render(); }catch(e){} });",
        "rec.code=n?String(n.student_code||''):undefined;   /* ★ v19-51: 밤 묶음 알림이 학생을 바로 찾게 */\n  hntHintsSave().then(function(){ ahaToast('💡 힌트 발송 완료 — 학생앱에 표시됩니다'); try{ ahsQueuePush(n); }catch(e){} hntRender(); try{ render(); }catch(e){} });")
    rep("    hand:(ast.hand&&ast.hand.img)||undefined\n  };", "    hand:(ast.hand&&ast.hand.img)||undefined,\n    code:String(n.student_code||'')   /* ★ v19-51 */\n  };")
    rep("ahaToast('♻️ 저장된 힌트 발송 완료');", "ahaToast('♻️ 저장된 힌트 발송 완료'); try{ ahsQueuePush(n); }catch(e){}")
    rep("hntHintsSave().then(function(){ ahaToast('발송 취소됨 — 학생앱에서 제거'); hntRender(); try{ render(); }catch(e){} });",
        "hntHintsSave().then(function(){ ahaToast('발송 취소됨 — 학생앱에서 제거'); try{ ahsQueueCancel(HNT.id); }catch(e){} hntRender(); try{ render(); }catch(e){} });")

if guard:
    # ① 앱이 읽기만 하는 큰 서버 자료는 기기(localStorage)에 쓰지 않는다
    rep("  return /^(mf_|msecr_|planner_review_|typeach_stu_|submissions_|student_planner_|bookprog_|goal_|pub_reports_|stu_reports_)/.test(k)",
        "  /* ★ v19-52: 수학비서 기출 DB·다리(ms_exam*)·해설집 본문·교재 채점 기록·코디·아바타·힌트 읽음 — 앱은 서버에서 직접 읽는다 (합계 5MB+) */\n  return /^(mf_|msecr_|planner_review_|typeach_stu_|submissions_|student_planner_|bookprog_|goal_|pub_reports_|stu_reports_|ms_exam|haesol_body_|hw_scores_|hw_sync|codi_|avatar_|aha_hint_seen_|push_inbox_|push_hint_)/.test(k)")
    rep("    || k==='weekly_pub' || k==='univ_marks';", "    || k==='weekly_pub' || k==='univ_marks' || k==='exam_ws_map' || k==='book_dash' || k==='push_hint_queue';")
    # ② 등록부는 클라우드 병합 전엔 올리지 않는다 (리포트의 _reportsFullyLoaded 보호와 같게)
    rep("      } else if (k === 'lumen_comments') {",
        "      } else if (k === 'or_studentdb') {\n        /* ★ v19-52: 클라우드 등록부를 메모리에 병합하기 전에는 push 금지 — 기기의 슬림본(사진 세트 14일·분석 5일)이\n         *   클라우드 전체본을 덮어 플래너 승인·분석 기록이 사라진 사고(2026-09-27 18:26) 재발 차단. 병합되면 그때 올린다. */\n        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }\n        val = window._fullStudentDb;\n      } else if (k === 'lumen_comments') {")
    rep("  window._fullStudentDb = arr;\n  var okDisk = safePullSetItem",
        "  window._fullStudentDb = arr;\n  window._studbPulled = true;   /* ★ v19-52: 이제부터 등록부 push 허용 */\n  if (window._studbPushLater) { window._studbPushLater = false; setTimeout(function(){ try { scheduleSync('or_studentdb'); } catch(e) {} }, 0); }\n  var okDisk = safePullSetItem")
    # ③ 슬림본이 메모리 전체본을 덮지 못하게
    rep("      _memStore[key] = String(value);   // 최후: 이 세션 동안 메모리로 동작 (클라우드에 원본 유지)",
        "      if (key !== 'or_studentdb' || _memStore[key] === undefined) _memStore[key] = String(value);   // 최후: 메모리로 동작 (★ v19-52: 등록부 슬림본은 전체본을 덮지 않는다)")
    # ④ 유령 세트 치유 — 플래너 탭 진입(새벽 결과 반영 뒤) + 사진 목록 읽은 뒤
    rep("  adoptOvernightPlannerResults().then(function(n) {\n    if (n > 0) {",
        "  adoptOvernightPlannerResults().then(function(n) {\n    var _hn = 0; try { _hn = plHealGhostSets(); } catch(e) {}   /* ★ v19-52: 승인 기록이 사라진 세트 되살리기 */\n    if (_hn > 0 && !(n > 0)) { try { plToast('🛡️ 승인 기록이 사라졌던 플래너 세트 ' + _hn + '개를 되살렸어요'); } catch(e) {} render(); }\n    if (n > 0) {")
    rep("  if (changed) {\n    saveStudents();\n    updatePlannerCardBadges();\n  }\n  // ★ v15-6: 자동승인 ON이면 메타 로드 후 무플래그 세트 자동 승인",
        "  try { if (plHealGhostSets()) changed = true; } catch(e) {}   /* ★ v19-52 */\n  if (changed) {\n    saveStudents();\n    updatePlannerCardBadges();\n  }\n  // ★ v15-6: 자동승인 ON이면 메타 로드 후 무플래그 세트 자동 승인")

if int(ver.replace('v19-',''))>=53:
    # 범위 전체 묶음: 날짜 모드에서 날짜를 안 눌렀으면 범위 전체
    rep("function wbCurBucket(all){\n  var i;\n  for(i=0;i<all.length;i++){ if(all[i].key===WB.grp) return all[i]; }",
        "function wbCurBucket(all){\n  var i;\n  if(WB.mode==='day' && !WB.grp) return wbRangeBucket(all);   /* ★ v19-53: 7일·전체를 고르면 범위 전체 */\n  for(i=0;i<all.length;i++){ if(all[i].key===WB.grp) return all[i]; }")
    rep("  var h=wbSeg();\n  var wait=buckets.filter(function(b){ return b.pend; });",
        "  var h=wbSeg();\n  if(WB.mode==='day') h+=wbNavItem(wbRangeBucket(buckets), cur);   /* ★ v19-53 */\n  var wait=buckets.filter(function(b){ return b.pend; });")
    rep("  var h=wbSeg(true)+'<div style=\"display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap\">';\n  all.forEach(function(b){",
        "  var h=wbSeg(true)+'<div style=\"display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap\">';\n  if(WB.mode==='day') all=[wbRangeBucket(all)].concat(all);   /* ★ v19-53 */\n  all.forEach(function(b){")
    # 머리띠 날짜 칸은 실제 범위를 보여 준다 · 초안 단추 이름을 또렷이
    rep("  var f=WB.from||wbYesterday(), t=WB.to||wbToday();", "  var _er=wbEffRange(), f=_er[0], t=_er[1];")
    rep("'🤖 '+(_day?(wbDayShort(_day)+' AI 초안'):'이 범위 AI 초안')+' ('+dn+'건)'", "'🤖 '+(_day?(wbDayShort(_day)+' 초안 없는 '):'이 범위 초안 없는 ')+dn+'건 AI 초안'")

if plsc:
    # 제출 점수 — 10월 1일부터 4·2·1
    rep("    if (fileCount >= 2) return cfg.score2photos;\n    if (fileCount === 1) return cfg.score1photo;",
        "    var _pd = new Date(yr, mo, dy - (hh < 3 ? 1 : 0)), _v2t = plV2(_pd.getFullYear() + '-' + String(_pd.getMonth() + 1).padStart(2, '0') + '-' + String(_pd.getDate()).padStart(2, '0'));   /* ★ v19-54: 10월부터 4·2 (새벽 3시 전은 전날 플래너) */\n    if (fileCount >= 2) return _v2t ? 4 : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? 2 : cfg.score1photo;")
    rep("    if (fileCount >= 2) return plPairVerdict(plannerDateStr, nextDateStr).ok ? cfg.score2photos : cfg.score1photo;\n    if (fileCount === 1) return cfg.score1photo;",
        "    var _v2p = plV2(plannerDateStr), _s2 = _v2p ? 4 : cfg.score2photos, _s1 = _v2p ? 2 : cfg.score1photo;   /* ★ v19-54: 10월부터 4·2 */\n    if (fileCount >= 2) return plPairVerdict(plannerDateStr, nextDateStr).ok ? _s2 : _s1;\n    if (fileCount === 1) return _s1;")
    # 프롬프트 v3 + 주간계획 대조
    rep("    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n",
        "    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n    try{ promptLines=plV3PromptEdit(promptLines, expectedDate); var _wpL=await plPlanPromptLines(stInfo, expectedDate); if(_wpL.length) promptLines=promptLines.concat(_wpL); }catch(e){ console.warn('[v19-54 프롬프트]', e); }   /* ★ v19-54: 10월판 + 주간계획 대조 */\n")
    rep("    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n",
        "    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n")
    # 새벽 Routine 이 예전 프롬프트로 채점한 10월 세트는 가져오지 않는다
    rep("        if (!res || !res.analysis) return;\n", "        if (!res || !res.analysis) return;\n        if (setId.slice(0, 8) >= '20261001' && res.analysis.promptVersion !== 'v3.0') return;   /* ★ v19-54 */\n")
    # 편집 칸·판독불가 이름
    rep("    { key:'studyScore',   label:'순공시간 점수', val: _nv(analysis.studyScore),  type:'select', options:['1','0'] },\n    { key:'practiceScore',label:'실천율 점수',   val: _nv(analysis.practiceScore),type:'select', options:['1','0'] },",
        "    { key:'studyScore',   label:(analysis.promptVersion==='v3.0'?'타임테이블 점수':'순공시간 점수'), val: _nv(analysis.studyScore),  type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },   /* ★ v19-54 */\n    { key:'practiceScore',label:'실천율 점수',   val: _nv(analysis.practiceScore),type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },")
    rep("    var _uiKo = { studyScore:'순공시간',", "    var _uiKo = { studyScore:(analysis.promptVersion==='v3.0'?'타임테이블':'순공시간'),")
    # 메뉴·화면
    rep("    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},",
        "    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},\n    /* ★ v19-54: 📅 주간 점수 — 다음 주 계획·실천·순공 사진·종이 (10월 1일부터) */\n    {v:'plweek', icon:'📅', label:'주간 점수', act:function(){ VIEW='plweek'; PWB.W=null; try{ plwLoad(true); }catch(e){} }},")
    c2="    else if(VIEW==='codi'){ try{ C.innerHTML=rCodi(); }"
    assert s.count(c2)==2
    s=s.replace(c2, "    else if(VIEW==='plweek'){ try{ C.innerHTML=rPlWeek(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">주간 점수 오류: '+esc2(e.message)+'</div>'; } }\n"+c2)
    rep("codi:'🧭 스터디 코디',", "codi:'🧭 스터디 코디',plweek:'📅 주간 점수',")
    if int(ver.replace('v19-',''))>=62:
        # v19-62: 월 랭킹 = 매일 합 + 주간 합 (원장 결정 2026-09-29)
        rep("    var r = sumPlannerScoresForMonth(s, ym);\n    return {", "    var r = sumPlannerScoresForMonth(s, ym);\n    var _wk = (typeof plwMonthWeekly === 'function') ? plwMonthWeekly(s, ym) : 0;   /* ★ v19-62: 주간 점수 더하기 */\n    return {")
        rep("      total: r.total,\n      days: r.days,", "      total: r.total + _wk, daily: r.total, weekly: _wk,\n      days: r.days,")
        rep("    ranked.push({ id: r.id, code: r.code, maskedName: r.maskedName, total: r.total, days: r.days, max: r.max, rank: lastRank });",
            "    ranked.push({ id: r.id, code: r.code, maskedName: r.maskedName, total: r.total, daily: r.daily, weekly: r.weekly, days: r.days, max: r.max, rank: lastRank });")
        rep("    var sb2 = getSupaClient();\n    if (!sb2) return;\n\n    // 1) 내 점수 요약", "    var sb2 = getSupaClient();\n    if (!sb2) return;\n    try { if (typeof plwLoad === 'function') await plwLoad(); } catch(eW) {}   /* ★ v19-62: 주간 점수 자료 */\n\n    // 1) 내 점수 요약")
        rep("      scores: myScores, // { \"2026.04.20\": 10, ... }", "      scores: myScores, // { \"2026.04.20\": 10, ... }\n      weekly: (typeof plwStudentWeeks === 'function') ? plwStudentWeeks(student) : {},   /* ★ v19-62: 발표된 주의 주간 점수 {월요일:{t,plan,prac,photo,paper}} */")
if int(ver.replace('v19-',''))>=63:
    # v19-63: 공지 「🏠 홈에 보이기」 — 학생앱(v2-116) 홈 맨 위 공지 카드에 뜨는 공지 하나를 고른다 (원장 지시 2026-09-29)
    rep("async function noticeTogglePin(id){\n",
        "/* ★ v19-63: 🏠 홈에 보이기 — 한 개만. 학생앱 v2-116 홈 공지 카드가 home:true 공지를 먼저 보여 준다 */\nasync function noticeToggleHome(id){\n  var n = NOTICE_INDEX.find(function(x){ return x.id===id; }); if(!n) return;\n  var on = !n.home; var now = new Date().toISOString();\n  NOTICE_INDEX.forEach(function(x){ if(x.home){ x.home=false; x.updatedAt=now; } });\n  if(on){ n.home = true; n.updatedAt = now; }\n  var ok = await noticeSaveIndex(); if(ok) render();\n}\nasync function noticeTogglePin(id){\n")
    rep("  if(n.pinned) h += '<span style=\"font-size:11px\">📌</span>';\n  h += '<span style=\"font-size:10.5px;font-weight:700;color:' + st.c",
        "  if(n.pinned) h += '<span style=\"font-size:11px\">📌</span>';\n  if(n.home) h += '<span style=\"font-size:10.5px;font-weight:800;color:#fff;background:#0d2240;padding:2px 8px;border-radius:9px\">🏠 학생앱 홈</span>';   /* ★ v19-63 */\n  h += '<span style=\"font-size:10.5px;font-weight:700;color:' + st.c")
    rep("' + (n.pinned?'📌 고정 해제':'📌 고정') + '</button>';\n",
        "' + (n.pinned?'📌 고정 해제':'📌 고정') + '</button>';\n  h += '<button onclick=\"noticeToggleHome(\\'' + n.id + '\\')\" title=\"학생앱 홈 맨 위 공지 카드에 이 공지를 보여 줍니다 (한 개만)\" style=\"font-size:12px;font-weight:700;border:1px solid ' + (n.home?'#0d2240':'#e7e9ef') + ';background:' + (n.home?'#0d2240':'#fff') + ';color:' + (n.home?'#fff':'#475569') + ';border-radius:8px;padding:6px 11px;cursor:pointer;font-family:inherit\">' + (n.home?'🏠 홈에서 내리기':'🏠 홈에 보이기') + '</button>';   /* ★ v19-63 */\n")
if int(ver.replace('v19-',''))>=64:
    # v19-64: 학부모앱 v1-35 짝 — 미흡 기준·미제출 경고 일수 설정(hw_parent_cfg) + 위험 신호 「어제 숙제체크 안 찍음」
    rep("// ── 값 읽기/쓰기 ──\nfunction hwcNorm(v){",
        "/* ★ v19-64: 학부모앱 기준 — lumen_store hw_parent_cfg { weakBelow:60, missWarnDays:2 } (학부모앱 v1-35가 읽는다) */\nvar HWC_CFG={ loaded:false, busy:false, v:{ weakBelow:60, missWarnDays:2 } };\nfunction hwcCfgLoad(){\n  if(HWC_CFG.loaded||HWC_CFG.busy) return; HWC_CFG.busy=true;\n  var sb=null; try{ sb=getSupaClient(); }catch(e){}\n  if(!sb){ HWC_CFG.loaded=true; HWC_CFG.busy=false; return; }\n  sb.from('lumen_store').select('value').eq('key','hw_parent_cfg').then(function(r){\n    var v=(r&&r.data&&r.data[0]&&r.data[0].value)||null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }\n    if(v&&typeof v==='object'){ HWC_CFG.v.weakBelow=Number(v.weakBelow)||60; HWC_CFG.v.missWarnDays=Number(v.missWarnDays)||2; }\n    HWC_CFG.loaded=true; HWC_CFG.busy=false; if(VIEW==='hwcheck') render();\n  },function(){ HWC_CFG.loaded=true; HWC_CFG.busy=false; });\n}\nwindow.hwcCfgSet=function(k,v){ HWC_CFG.v[k]=Number(v)||HWC_CFG.v[k]; try{ supaSetItem('hw_parent_cfg', HWC_CFG.v); }catch(e){} render(); };\nfunction hwcCfgChip(){\n  hwcCfgLoad(); var c=HWC_CFG.v;\n  function sel(k,opts,unit){ return '<select onchange=\"hwcCfgSet(\\''+k+'\\',this.value)\" style=\"font-family:inherit;font-size:11px;font-weight:900;border:1px solid #cbd5e1;border-radius:7px;padding:2px 4px;background:#fff;color:#0d2240\">'+opts.map(function(o){ return '<option value=\"'+o+'\"'+(o===c[k]?' selected':'')+'>'+o+unit+'</option>'; }).join('')+'</select>'; }\n  return '<span title=\"학부모앱 홈의 🔴 미흡 · ⚠️ 미제출 표시 기준 (lumen_store hw_parent_cfg)\" style=\"display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#0d2240;background:#eef2f8;border-radius:50px;padding:3px 12px\">📱 학부모앱 기준 · 미흡 = 종합 '+sel('weakBelow',[40,50,60,70,80],'%')+' 미만 · 미제출 경고 '+sel('missWarnDays',[1,2,3],'일')+'째부터'+(HWC_CFG.loaded?'':' <i style=\"color:#94a3b8\">불러오는 중</i>')+'</span>';\n}\n// ── 값 읽기/쓰기 ──\nfunction hwcNorm(v){")
    rep("  h+='<span style=\"font-size:11px;font-weight:800;color:#7c3aed;background:#f3e8ff;border-radius:50px;padding:4px 12px\">💡 아하노트는 자동 계산 — 누를 필요 없음</span>';\n",
        "  h+='<span style=\"font-size:11px;font-weight:800;color:#7c3aed;background:#f3e8ff;border-radius:50px;padding:4px 12px\">💡 아하노트는 자동 계산 — 누를 필요 없음</span>';\n  h+=hwcCfgChip();   /* ★ v19-64 */\n")
    rep("  return out;\n}\nvar RISK_NAMES={ stop:'채점 끊김',",
        "  /* ⑥ v19-64: 어제 수업일인데 숙제체크가 없음 — 학부모앱에 「확인 전」으로 남는다 */\n  try{ var yd=riskKst(Date.now()-86400000); var ydow=new Date(yd+'T12:00:00+09:00').getDay(); var gd=(st.group&&typeof groupDays!=='undefined'&&groupDays[st.group])||[];\n    if(gd.indexOf(ydow)>=0 && !((st.lumen_hw||{})[yd])) out.push({ k:'hwc', sev:1, t:'어제 숙제체크 안 찍음', d:yd.slice(5).replace('-','/')+' 수업일 — 학부모앱에 「확인 전」으로 보여요', go:'hwcheck' }); }catch(e){}\n  return out;\n}\nvar RISK_NAMES={ hwc:'숙제체크 빠짐', stop:'채점 끊김',")
if int(ver.replace('v19-',''))>=65:
    # v19-65: IB아하 리그 점검 (원장 제보 2026-09-30 「김○○ 점수가 반영 안 됨」)
    #   ① 버그: 연습 주간 안에 확정된 노트가 «확정 때 저장한 리그 점수»를 그대로 써서 0점이 아니었다 → 순위표에서 다시 0으로
    #   ② 0점인 까닭(질문력 5 미만 · 연습 주간)과 «미확정 대기» 수를 표에 보인다
    rep("      picked:0, best:0, capped:0, tier:'inquirer',\n",
        "      picked:0, best:0, capped:0, tier:'inquirer',\n      zeroLow:0, zeroPrac:0, pending:0,   /* ★ v19-65: 0점 까닭 · 미확정 대기 */\n")
    rep("    if(sc.status!=='final' && !wantTemp) return;      // 확정만 (미리보기면 임시도)\n",
        "    if(sc.status!=='final'){ if(!(lampOnly && ibqIsOldNote(n))) row.pending++; }   /* ★ v19-65 */\n    if(sc.status!=='final' && !wantTemp) return;      // 확정만 (미리보기면 임시도)\n")
    rep("    if(q<minQ) lp=0;                                   // 질문력이 낮으면 리그 0점\n",
        "    if(q<minQ) lp=0;                                   // 질문력이 낮으면 리그 0점\n    /* ★ v19-65: 연습 주간 노트는 저장된 리그 점수가 있어도 0 — 연습 일수를 나중에 늘렸거나 규칙 전에 확정한 노트가 점수를 갖고 있었다 */\n    if(ibqIsPractice(n)) lp=0;\n    if(q<minQ) row.zeroLow++; else if(ibqIsPractice(n)) row.zeroPrac++;\n")
    rep("+'<td style=\"padding:9px 6px;border-top:1px solid #f1f5f9;text-align:right\"><b>'+r.league+'</b>'\n",
        "+'<td style=\"padding:9px 6px;border-top:1px solid #f1f5f9;text-align:right\"><b>'+r.league+'</b>'\n        +((r.league===0&&(r.zeroLow||r.zeroPrac))?('<div style=\"font-size:9.5px;color:#94a3b8;font-weight:700;white-space:nowrap\">'+(r.zeroLow?('질문력 '+Number(cfg.minQ==null?5:cfg.minQ)+' 미만 '+r.zeroLow+'건'):'')+(r.zeroLow&&r.zeroPrac?' · ':'')+(r.zeroPrac?('연습 주간 '+r.zeroPrac+'건'):'')+'</div>'):'')   /* ★ v19-65 */\n")
    rep("text-align:right\">'+r.qcnt+'</td>'", "text-align:right\">'+r.qcnt+(r.pending?'<div style=\"font-size:9.5px;color:#f59e0b;font-weight:800;white-space:nowrap\">대기 '+r.pending+'</div>':'')+'</td>'")
if int(ver.replace('v19-',''))>=66:
    # v19-66: 플래너 날짜 필수 · 같은 쪽 다시 내기 = 그날 0점 (모듈 plzero_teacher.js)
    rep("    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n",
        "    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n    try{ await plzCheck(stInfo, analysis, setId, imgData); }catch(e){}   /* ★ v19-66: 날짜 없음·다른 날짜·같은 쪽 다시 내기 → 그날 0점 */\n")
    rep("      || a.flagUnreadable===true||a.flagUnreadable==='true';\n}",
        "      || a.flagUnreadable===true||a.flagUnreadable==='true'\n      || a.zeroDay===true || a.zeroWarn===true;   /* ★ v19-66: 0점·경고 세트는 원장이 본다 (자동 승인 안 함) */\n}")
    rep("function plUseManual(entry, computed) {\n  var m = plManualOf(entry);\n  return (m === null) ? computed : m;\n}",
        "function plUseManual(entry, computed) {\n  var m = plManualOf(entry);\n  if (m === null && typeof plzApplyTotal === 'function') computed = plzApplyTotal(entry, computed);   /* ★ v19-66: 그날 0점 (손 점수가 있으면 그것) */\n  return (m === null) ? computed : m;\n}")
    rep("  h += '<div style=\"font-size:9px;color:#94a3b8;font-weight:600\">📅 날짜 기준 자동</div>';\n  h += '</div>';\n",
        "  h += '<div style=\"font-size:9px;color:#94a3b8;font-weight:600\">📅 날짜 기준 자동</div>';\n  h += '</div>';\n  try { h += plzCardHtml(analysis, stId, setId); } catch(e) {}   /* ★ v19-66 */\n")
    rep("      scores: myScores, // { \"2026.04.20\": 10, ... }\n",
        "      scores: myScores, // { \"2026.04.20\": 10, ... }\n      flags: (typeof plzFlags === 'function') ? plzFlags(student) : {},   /* ★ v19-66: 0점 날의 까닭 { 날짜: noDate|wrongDate|dup } */\n")
    rep("  return out;\n}\nvar RISK_NAMES={ hwc:'숙제체크 빠짐',",
        "  /* ⑦ v19-66: 플래너 날짜 없음·같은 쪽 다시 냄 (최근 7일) */\n  try{ var zf=riskKst(Date.now()-7*86400000); var zall=(st.lumen_planner_photos||[]).filter(function(p){ var a=p&&p.analysis; return a&&!a.zeroCleared&&(a.zeroDay||a.zeroWarn)&&plzSetDay(p.setId)>=zf; });\n    var zs=zall.filter(function(p){ return p.analysis.zeroDay; }), zw=zall.filter(function(p){ return !p.analysis.zeroDay; }); var zl=zs.length?zs:zw;\n    if(zl.length){ out.push({ k:'plz', sev:zs.length?2:1, t:'플래너 '+(zs.length?'0점 ':'경고 ')+zl.length+'건 — 날짜 없음·같은 날짜·같은 쪽', d:plzReasonKo(zl[zl.length-1].analysis), go:'planner' }); } }catch(e){}\n  /* ⑧ v19-68: 거짓 제출 — 같은 날짜 또 냄·같은 쪽 다시 냄 (최근 30일 · 되살린 것 제외) */\n  try{ var lf=riskKst(Date.now()-30*86400000); var ls=(st.lumen_planner_photos||[]).filter(function(p){ var a=p&&p.analysis; return a&&!a.zeroCleared&&(a.zeroReason==='sameDate'||a.zeroReason==='dup')&&plzSetDay(p.setId)>=lf; });\n    if(ls.length){ out.push({ k:'plzlie', sev:2, t:'📛 플래너 거짓 제출 '+ls.length+'건 (30일) — 같은 날짜 또 냄·같은 쪽 다시 냄', d:plzReasonKo(ls[ls.length-1].analysis), go:'planner' }); } }catch(e){}\n  return out;\n}\nvar RISK_NAMES={ plz:'플래너 0점', plzlie:'플래너 거짓 제출', hwc:'숙제체크 빠짐',")
if int(ver.replace('v19-',''))>=67:
    # v19-67: 9월 플래너 날짜 검사 → 날짜 없는 세트 0점 (모듈 plsept_teacher.js) — 플래너 사진검토 도구줄 단추
    rep("style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#0d2240,#1d6fe8);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📥 AI대로 전체 승인</button>';\n",
        "style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#0d2240,#1d6fe8);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📥 AI대로 전체 승인</button>';\n  h += '<button onclick=\"pls9Open()\" title=\"9월 세트의 날짜를 검사해 두 장 모두 날짜가 없는 세트를 그날 0점으로 (원장 지시 2026-09-30)\" style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📅 9월 날짜 검사 → 0점</button>';   /* ★ v19-67 */\n")
if int(ver.replace('v19-',''))>=69:
    # v19-69: 🏁 시즌 마무리 카드 · 🔜 다음 시즌 예고 · 지난 시즌 접기 (모듈 season_teacher.js)
    rep("  if(RACE.edit) h+=raceSetup();\n\n  /* v18-140:",
        "  h+=(typeof seaCardHtml==='function')?seaCardHtml():'';   /* ★ v19-69: 시즌 마무리 · 다음 시즌 예고 */\n  if(typeof seaFolded==='function' && seaFolded()) return h+seaFoldBtn()+'</div>';   /* ★ v19-69: 지난 시즌은 접어 둔다 */\n  if(RACE.edit) h+=raceSetup();\n\n  /* v18-140:")
    rep("    inChampion:(c.inChampion!==false),\n    last:lgPlannerLast(),",
        "    inChampion:(c.inChampion!==false),\n    champDays:Number(c.champDays==null?14:c.champDays),   /* ★ v19-69: 챔피언 카드 보이는 날수 */\n    last:lgPlannerLast(),")
    rep("  return { month:ym, winners:(rec.winners||[]).map(function(w){",
        "  return { month:ym, at:rec.at||'', winners:(rec.winners||[]).map(function(w){   /* ★ v19-69: 확정 시각도 보낸다 */")
if int(ver.replace('v19-',''))>=70:
    # v19-70: 학년별 시험일 (옥길중3·범박중3 기말이 다르다 — 원장 확인 2026-10-01)
    rep("function xtSchoolOfKey(k){ return String(k||'').split(' ')[0]; }\n",
        "function xtSchoolOfKey(k){ return String(k||'').split(' ')[0]; }\nfunction xtGradeOfKey(k){ return String(k||'').split(' ')[1]||''; }   /* ★ v19-70: 「옥길중 중3」 → 「중3」 */\n")
    rep("""function xtFindDday(ddays, school){
  var n=String(school||'').replace(/\\s/g,''); if(!n) return null;
  return (ddays||[]).filter(function(x){
    var s=String(x.school||'').replace(/\\s/g,'');
    return s&&(s===n||s.indexOf(n)===0||n.indexOf(s)===0);
  })[0]||null;
}""","""function xtFindDday(ddays, school, grade){
  var n=String(school||'').replace(/\\s/g,''); if(!n) return null;
  var list=(ddays||[]).filter(function(x){
    var s=String(x.school||'').replace(/\\s/g,'');
    return s&&(s===n||s.indexOf(n)===0||n.indexOf(s)===0);
  });
  /* ★ v19-70: 학년이 주어지면 그 학년 것(학년 표기 없는 것 포함) 중 아직 안 지난 가장 가까운 시험 */
  var gN=Number(String(grade||'').replace(/\\D/g,''))||0;
  if(gN){ list=list.filter(function(x){ return !(x.grades&&x.grades.length)||x.grades.indexOf(gN)>=0; }); }
  var today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  var up=list.filter(function(x){ return String(x.date||'')>=today; });
  return up[0]||list[list.length-1]||null;
}""")
    rep("  var dd=scName?xtFindDday(d.ddays, scName):null;\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"max-width:none\">';",
        "  var dd=scName?xtFindDday(d.ddays, scName, xtGradeOfKey(XT.grp)):null;   /* ★ v19-70 */\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"max-width:none\">';")
    rep("  var dd=xtFindDday(xtD().ddays, xtSchoolOfKey(XT.grp));\n","  var dd=xtFindDday(xtD().ddays, xtSchoolOfKey(XT.grp), xtGradeOfKey(XT.grp));   /* ★ v19-70 */\n")
    rep("  var dd=scName?xtFindDday(d.ddays,scName):null;\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"display:grid;grid-template-columns:270px",
        "  var dd=scName?xtFindDday(d.ddays,scName,xtGradeOfKey(XT.grp)):null;   /* ★ v19-70 */\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"display:grid;grid-template-columns:270px")
    rep("    var dd2=xtFindDday(d.ddays,sc); var dn2=dd2?xtDday(dd2.date):null;","    var dd2=xtFindDday(d.ddays,sc,xtGradeOfKey(g)); var dn2=dd2?xtDday(dd2.date):null;   /* ★ v19-70 */")
    rep("""      var nx=sc.next; if(!nx||!nx.from) return;
      var short=xtSchoolShort(sc.name);   // 나이스의 short는 「범박고등」처럼 어색해서 이름에서 직접 줄인다
      var label=(nx.label||nx.name||'시험')+(nx.to&&nx.to!==nx.from?(' ('+String(nx.from).slice(5)+'~'+String(nx.to).slice(5)+')'):'');
      var cur=xtFindDday(d.ddays, short);
      if(cur){ if(cur.date!==nx.from||cur.label!==label){ cur.date=nx.from; cur.label=label; cur.school=short; upd++; } }
      else { d.ddays.push({ school:short, label:label, date:nx.from }); add++; }
      lines.push('· '+short+' — '+label+' '+nx.from);""",
"""      var short=xtSchoolShort(sc.name);   // 나이스의 short는 「범박고등」처럼 어색해서 이름에서 직접 줄인다
      /* ★ v19-70: 학년마다 다음 시험이 다르면(옥길중3·범박중3 기말) 학년별로 따로 넣는다 */
      var today0=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
      var up=(sc.exams||[]).filter(function(e){ return e.from&&(e.to||e.from)>=today0; }).sort(function(a,b){ return a.from<b.from?-1:1; });
      var picks=[], seen={};
      up.forEach(function(e){ var sig=(e.grades&&e.grades.length)?e.grades.join('·'):''; if(seen[sig]) return; seen[sig]=1; picks.push(e); });
      if(!picks.length && sc.next&&sc.next.from) picks.push(sc.next);
      if(!picks.length) return;
      var before=JSON.stringify(d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')===short.replace(/\\s/g,''); }));
      d.ddays=d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')!==short.replace(/\\s/g,''); });
      picks.forEach(function(e){
        var label=(e.label||e.name||'시험')+(e.grades&&e.grades.length?(' · '+e.grades.join('·')+'학년'):'')+(e.to&&e.to!==e.from?(' ('+String(e.from).slice(5)+'~'+String(e.to).slice(5)+')'):'');
        d.ddays.push({ school:short, label:label, date:e.from, grades:(e.grades&&e.grades.length)?e.grades.slice():null });
        lines.push('· '+short+' — '+label+' '+e.from);
      });
      var after=JSON.stringify(d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')===short.replace(/\\s/g,''); }));
      if(before==='[]') add+=picks.length; else if(before!==after) upd+=picks.length;""")
    rep("(s.exams||[]).forEach(function(e){ if(e.from) out.push({ school:sh, n:mine[sh], from:e.from, to:e.to||e.from, label:e.label||e.name||'시험' }); }); });",
        "(s.exams||[]).forEach(function(e){ if(e.from) out.push({ school:sh, n:mine[sh], from:e.from, to:e.to||e.from, label:(e.label||e.name||'시험')+(e.grades&&e.grades.length?(' · '+e.grades.join('·')+'학년'):''), grades:(e.grades&&e.grades.length)?e.grades:null }); }); });   /* ★ v19-70: 학년 표기 */")
    rep("  var ex=ctExams(), next={}; ex.forEach(function(e){ if(e.to>=today&&!next[e.school]) next[e.school]=e; });",
        "  var ex=ctExams(), next={}; ex.forEach(function(e){ var k=e.school+(e.grades?(' '+e.grades.join('·')+'학년'):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 */")
    rep("  ks.forEach(function(k){ var e=next[k], dn=ctDiff(today,e.from), on=today>=e.from&&today<=e.to, c=ctColor(k);",
        "  ks.forEach(function(k){ var e=next[k], dn=ctDiff(today,e.from), on=today>=e.from&&today<=e.to, c=ctColor(e.school);")
if int(ver.replace('v19-',''))>=71:
    # v19-71: 🎯 시험대비 트랙을 「시험·기출」 그룹으로 · 디데이 이름을 「옥길중3」「옥길중1,2」로 (원장 지시 2026-10-01)
    rep("    {v:'examtrack', icon:'🎯', label:'시험대비 트랙', act:function(){ VIEW='examtrack'; }},   // v18-126\n","")
    rep("    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n",
        "    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n    {v:'examtrack', icon:'🎯', label:'시험대비 트랙', act:function(){ VIEW='examtrack'; }},   // v18-126 · ★ v19-71: 진도·리포트 → 시험·기출로 옮김\n")
    rep("      +'<span style=\"min-width:0\"><span style=\"display:block;font-size:12.5px;font-weight:800;line-height:1.2\">'+esc2(x.school)+'</span>'\n      +'<span style=\"display:block;font-size:9.5px;font-weight:600;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+esc2(String(x.date).slice(5))",
        "      +'<span style=\"min-width:0\"><span style=\"display:block;font-size:12.5px;font-weight:800;line-height:1.2\">'+esc2(x.school)+(x.grades&&x.grades.length?('<b style=\"color:#f59e0b\">'+esc2(x.grades.join(','))+'</b>'):'')+'</span>'\n      +'<span style=\"display:block;font-size:9.5px;font-weight:600;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+esc2(String(x.date).slice(5))")
    rep("var k=e.school+(e.grades?(' '+e.grades.join('·')+'학년'):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 */",
        "var k=e.school+(e.grades?e.grades.join(','):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 · v19-71: 「옥길중3」「옥길중1,2」 */")
if int(ver.replace('v19-',''))>=72:
    # v19-72: 🏷 별명 — 학생앱으로 나가는 이름은 전부 별명 (모듈 nick_teacher.js)
    rep("function iblMask(name, mode){\n  var s=String(name||'');\n",
        "function iblMask(name, mode){\n  var s=String(name||'');\n  if(mode!=='full'&&mode!=='hide'&&typeof nickPubByName==='function') return nickPubByName(s);   /* ★ v19-72: 「성+○○」 자리는 이제 별명 */\n")
    rep("ahaEsc(iblMask(r.name, cfg.nameMode))","ahaEsc(iblShow(r.name, cfg.nameMode))")
    rep("lgEsc(iblMask(lead.name,cfg.nameMode))","lgEsc(iblShow(lead.name,cfg.nameMode))")
    rep("lgEsc(iblMask(x.name, board.cfg.nameMode))","lgEsc(iblShow(x.name, board.cfg.nameMode))",2)
    rep("lgEsc(iblMask(r.name,nameMode))","lgEsc(iblShow(r.name,nameMode))")
    rep("lgEsc(iblMask(cands.top.name, board.cfg.nameMode))","lgEsc(iblShow(cands.top.name, board.cfg.nameMode))")
    rep("lgEsc(iblMask(cands.growth.name, board.cfg.nameMode))","lgEsc(iblShow(cands.growth.name, board.cfg.nameMode))")
    rep("lgEsc(iblMask(cands.reflect.name, board.cfg.nameMode))","lgEsc(iblShow(cands.reflect.name, board.cfg.nameMode))")
    rep("      nm:nm.slice(0,1)+'○○',\n","      nm:(typeof nickOf==='function'&&nickOf(s))||'○○○',   /* ★ v19-72: 별명 */\n")
    rep("      return { r:x.r, code:x.code, nm:iblMask(r.nm||''), w:Number(x.w)||0 };","      return { r:x.r, code:x.code, nm:(typeof nickPub==='function')?nickPub(x.code):iblMask(r.nm||''), w:Number(x.w)||0 };   /* ★ v19-72 */")
    rep("      maskedName: masks[s.id] || s.name,\n","      maskedName: (typeof nickOf==='function')?(nickOf(s)||'○○○'):(masks[s.id] || s.name),   /* ★ v19-72: 별명 */\n")
    rep("first:{ masked:top.map(function(s){ return hallMask(WK.names[s.sid]||''); }).join(' · '),","first:{ masked:top.map(function(s){ return (typeof nickById==='function'&&nickById(s.sid))||'○○○'; }).join(' · '),   /* ★ v19-72 */")
    rep("     +ibqOptBtn('nameMode','masked',c.nameMode,'성+○○')+ibqOptBtn('nameMode','full',c.nameMode,'실명')\n     +ibqOptBtn('nameMode','hide',c.nameMode,'가림'));",
        "     +ibqOptBtn('nameMode','masked',c.nameMode,'🏷 별명 (기본)')+ibqOptBtn('nameMode','full',c.nameMode,'실명')\n     +ibqOptBtn('nameMode','hide',c.nameMode,'가림')+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>');")
    rep("""          <input id="edit-parent-phone" type="tel" placeholder="010-0000-0000" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""",
        """          <input id="edit-parent-phone" type="tel" placeholder="010-0000-0000" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">
          <div style="margin-top:10px;font-size:12px;font-weight:800;color:#0d2240">🏷 학생앱 별명 <span style="font-weight:700;color:#94a3b8">— 순위표·시상에 이름 대신 (2~8자 · 실명 ×)</span></div>
          <input id="edit-nick" maxlength="8" placeholder="예) 수학천재 · 학생이 학생앱 「나」 탭에서 정할 수도" style="width:100%;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""")
    rep("  document.getElementById('edit-parent-phone').value=st.parentPhone||'';\n","  document.getElementById('edit-parent-phone').value=st.parentPhone||'';\n  var _nkEl=document.getElementById('edit-nick'); if(_nkEl) _nkEl.value=(typeof nickOf==='function')?nickOf(st):(st.nick||'');   /* ★ v19-72 */\n")
    rep("  var schoolEl=document.getElementById('edit-school');\n  const data={\n    name,\n",
        "  var schoolEl=document.getElementById('edit-school');\n  var _nk=((document.getElementById('edit-nick')||{}).value||'').trim();   /* ★ v19-72: 별명 검사 */\n  if(_nk && typeof nickCheck==='function'){ var _ne=nickCheck(_nk, {id:id, name:name}); if(_ne){ alert('🏷 별명: '+_ne); return; } }\n  const data={\n    name,\n    nick:_nk,\n")
    rep("    const old=students.find(s=>s.id===id);\n    const nameChanged=old&&old.name!==name;",
        "    const old=students.find(s=>s.id===id);\n    try{ if(old&&old.lumen_rec_code&&typeof nickPush==='function'&&String(old.nick||'')!==data.nick){ nickPush(old.lumen_rec_code, data.nick); } }catch(e){}   /* ★ v19-72 */\n    const nameChanged=old&&old.name!==name;")
if int(ver.replace('v19-',''))>=73:
    # v19-73: 🎲 별명 고르기 방식 — 편집 폼 「뽑기」 단추 · 리그 설정 낱말 편집
    rep("""          <input id="edit-nick" maxlength="8" placeholder="예) 수학천재 · 학생이 학생앱 「나」 탭에서 정할 수도" style="width:100%;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""",
        """          <div style="display:flex;gap:6px"><input id="edit-nick" maxlength="9" placeholder="예) 번개 여우 · 학생이 학생앱 「나」 탭에서 고를 수도" style="flex:1;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none"><button type="button" onclick="nickRoll()" title="낱말 조합에서 하나 뽑기" style="padding:0 12px;background:#fef3c7;color:#92400e;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit">🎲 뽑기</button></div>""")
    rep("+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>');",
        "+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>'+(typeof nickWordsHtml==='function'?nickWordsHtml():''));")
if int(ver.replace('v19-',''))>=74:
    # v19-74: 🎯 적중 분석 탭 (모듈 hit_teacher.js · docs/exam_hit_contract.md)
    rep("    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n",
        "    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n    /* ★ v19-74: 🎯 적중 분석 — 시험지 ↔ 우리 자료 직접 대조 (원장 결정 2026-10-04) */\n    {v:'examhit', icon:'🎯', label:'적중 분석', act:function(){ VIEW='examhit'; }},\n")
    a2="    else if(VIEW==='examanal'){ try{ C.innerHTML=rExamAnal(); }"
    assert s.count(a2)==2
    s=s.replace(a2, "    else if(VIEW==='examhit'){ try{ C.innerHTML=rExamHit(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">적중 분석 오류: '+esc2(e.message)+'</div>'; } }\n"+a2)
    rep("lastcheck:'🎯 시험 대비',examanal:'📚 기출 분석'","lastcheck:'🎯 시험 대비',examanal:'📚 기출 분석',examhit:'🎯 적중 분석'")
if int(ver.replace('v19-',''))>=75:
    # v19-75: 📋 발행한 공지 — 접어서 한 줄 · 학생앱 순서/최신순 · 찾기 (모듈 notice_fold.js)
    rep("  h += '<div style=\"columns:480px;column-gap:14px\">' + noticeListInner() + '</div>';",
        "  h += noticeToolbarHtml() + '<div id=\"notice-list\">' + noticeListInner2() + '</div>';   /* ★ v19-75 */")
if int(ver.replace('v19-',''))>=81:
    # v19-81: 📋 플래너 점수 기준표 = 실제 채점 · A안(10/1 소급) · 주간 칸 · 왼쪽 탭 (모듈 plrules_teacher.js)
    rep("    if (!isOnTime) return fileCount >= 1 ? 1 : 0; // 지각: 장수 무관 1점 (제출 자체는 한 경우)",
        "    if (!isOnTime) return fileCount >= 1 ? (typeof plLatePts==='function' ? plLatePts(yr+'-'+(mo+1)+'-'+dy) : 1) : 0; // 지각 (v19-81: 기준표)")
    rep("    if (fileCount >= 2) return _v2t ? 4 : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? 2 : cfg.score1photo;",
        "    var _pdk = _pd.getFullYear() + '-' + (_pd.getMonth() + 1) + '-' + _pd.getDate();   /* v19-81: 제출 점수는 기준표 */\n    if (fileCount >= 2) return _v2t ? plSubPts(_pdk, 2) : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? plSubPts(_pdk, 1) : cfg.score1photo;")
    rep("    if (!isOnTime) return fileCount >= 1 ? 1 : 0; // 지각: 장수 무관 1점\n",
        "    if (!isOnTime) return fileCount >= 1 ? (typeof plLatePts==='function' ? plLatePts(plannerDateStr) : 1) : 0; // 지각 (v19-81: 기준표)\n")
    rep("var _v2p = plV2(plannerDateStr), _s2 = _v2p ? 4 : cfg.score2photos, _s1 = _v2p ? 2 : cfg.score1photo;",
        "var _v2p = plV2(plannerDateStr), _s2 = _v2p ? plSubPts(plannerDateStr, 2) : cfg.score2photos, _s1 = _v2p ? plSubPts(plannerDateStr, 1) : cfg.score1photo;")
    rep("type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },\n    { key:'specificScore'",
        "type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'p'):['1','0']) },\n    { key:'specificScore'")
    rep("    { key:'specificScore',label:'구체적 페이지', val: _nv(analysis.specificScore),type:'select', options:['1','0'] },\n    { key:'feedbackScore',label:'피드백 점수',   val: _nv(analysis.feedbackScore),type:'select', options:['1','0'] },",
        "    { key:'specificScore',label:'구체적 페이지', val: _nv(analysis.specificScore),type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'s'):['1','0']) },\n    { key:'feedbackScore',label:'피드백 점수',   val: _nv(analysis.feedbackScore),type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'f'):['1','0']) },")
    # 입력 표 — 하루 최대 · 주간 칸 · 합계 · 오른쪽 기준표
    fi=s.index('function rPlannerInput(){'); fj=s.index('\n// ── 플래너 드래그 범위 선택 ──', fi); F=s[fi:fj]
    def frep(a,b):
        global F
        assert F.count(a)==1,(a[:70],F.count(a)); F=F.replace(a,b)
    frep("    return s+Math.max.apply(null,nums.map(Number));\n  },0);\n",
         "    return s+Math.max.apply(null,nums.map(Number));\n  },0);\n  if(ym>='2026.10'&&typeof plRulesFor==='function'){ var _plr=plRulesFor(ym.replace('.','-')+'-01'); if(_plr) totalMax=plRulesMax(_plr); }   /* v19-81 */\n")
    frep("+getDayLabel(dow)+'</th>';\n  }", "+getDayLabel(dow)+'</th>';\n    h+=plrGridHead(yr,mo,d,1);   /* v19-81: 주간 칸 */\n  }")
    frep("      +d+'</th>';\n  }", "      +d+'</th>';\n    h+=plrGridHead(yr,mo,d,2);\n  }")
    frep("        +'</div></td>';\n    }\n", "        +'</div></td>';\n      h+=plrGridCell(st,yr,mo,d2);   /* v19-81 */\n    }\n")
    frep(";font-size:13px\">'+total+'</td>';", ";font-size:13px\">'+plrGridTotal(st,ym,total,tColor)+'</td>';")
    ri=F.index('  // ── 오른쪽: 점수 기준표 ──'); rj=F.index("  h+='</div>'; // 오른쪽 끝", ri)+len("  h+='</div>'; // 오른쪽 끝")
    F=F[:ri]+"  // ── 오른쪽: 점수 기준표 — v19-81: 실제 채점에 쓰이는 기준표 (plrules_teacher.js) ──\n  h+=plrPanelHtml();"+F[rj:]
    s=s[:fi]+F+s[fj:]
    # 왼쪽 탭
    rep("    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n  ];",
        "    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n    /* ★ v19-81: 플래너와 이어진 화면 (원장 지시 2026-10-05) */\n    {sep:'📅 주간 · 순공 · 코디'},\n    {id:'@plweek',   icon:'📅', label:'주간 점수(주간계획)', red:false},\n    {id:'@sungong',  icon:'📔', label:'순공피드백', red:false},\n    {id:'@codi',     icon:'🧭', label:'스터디 코디', red:false},\n  ];")
    rep("  VIEWS.forEach(function(v) {\n    var on = PLANNER_VIEW === v.id;",
        "  VIEWS.forEach(function(v) {\n    if (v.sep) { h += '<div style=\"font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;padding:12px 8px 4px;border-top:1px solid #eef2f7;margin-top:8px\">' + v.sep + '</div>'; return; }\n    var on = v.id.charAt(0) === '@' ? (VIEW === v.id.slice(1)) : (VIEW === 'planner' && PLANNER_VIEW === v.id);")
    rep("      b.onclick = function() { PLANNER_VIEW = this.getAttribute('data-planview'); render(); };",
        "      b.onclick = function() { var id = this.getAttribute('data-planview'); if (id.charAt(0) === '@') { plrNavGo(id.slice(1)); return; } VIEW = 'planner'; PLANNER_VIEW = id; render(); };")
    rep("  if(v==='planner') return rPlannerLeftNav();", "  if(v==='planner'||v==='plweek'||v==='sungong'||v==='codi') return rPlannerLeftNav();   /* v19-81 */")
if int(ver.replace('v19-',''))>=82:
    # v19-82: 여러 기기 덮어쓰기 막기 — 같은 순위면 더 최근에 고친 쪽 (plrules_teacher.js plMergeStamp · lumen_planner_at)
    rep("            Object.keys(_sPl).forEach(function(dk){ if(_sPl[dk]!==undefined && _sPl[dk]!==null) _pl[dk] = _sPl[dk]; });\n            if(Object.keys(_pl).length>0) m.lumen_planner = _pl;",
        "            var _cAt = prev.lumen_planner_at||{}, _sAt = s.lumen_planner_at||{};   /* ★ v19-82: 날짜마다 더 최근에 매긴 쪽 */\n            Object.keys(_sPl).forEach(function(dk){ if(_sPl[dk]===undefined || _sPl[dk]===null) return; if(_cAt[dk] && String(_cAt[dk]) > String(_sAt[dk]||'') && (prev.lumen_planner||{})[dk]!==undefined) return; _pl[dk] = _sPl[dk]; });\n            if(Object.keys(_pl).length>0) m.lumen_planner = _pl;\n            var _mAt = Object.assign({}, _cAt); Object.keys(_sAt).forEach(function(dk){ if(!_mAt[dk] || String(_sAt[dk]) > String(_mAt[dk])) _mAt[dk] = _sAt[dk]; }); if(Object.keys(_mAt).length>0) m.lumen_planner_at = _mAt;")
    rep("              _pPhotos[p.setId] = (_pRank(ex) > _pRank(p)) ? ex : p;",
        "              var _rx = _pRank(ex), _rp = _pRank(p);   /* ★ v19-82: 같은 순위면 analysis 를 더 최근에 고친 쪽 */\n              _pPhotos[p.setId] = (_rx > _rp) ? ex : ((_rp > _rx) ? p : ((typeof plMergeStamp === 'function' && String(plMergeStamp(ex)) > String(plMergeStamp(p))) ? ex : p));")
if int(ver.replace('v19-',''))>=84:
    # v19-84: 매쓰플랫 동시 접속 가능 (원장 확인 2026-10-07) — 「접속이 끊길 수 있어요」 경고 삭제
    rep("    +'⚠️ 수집하는 몇 분 동안 원장님 매쓰플랫 접속이 끊길 수 있어요.\\n'\n    +'지금 매쓰플랫으로 수업·채점 중이면 끝낸 뒤 눌러주세요.\\n\\n'\n", "    +'\\n'\n")
    rep("  msg+='\\n· 매쓰플랫 동시 접속 시 원장님 접속이 끊길 수 있어요';\n", "")
if int(ver.replace('v19-',''))>=85:
    # v19-85: 🌐 전국 등수 — 신청한 학생만 (natopt_teacher.js) · 되살린 날 점수
    rep("  h+=pill(natOn,'nat','🌐 전국 등수');\n", "")
    rep("  h+=wkPubPanel();   // v18-14: 학생앱 「내 기록」 등수 표시 설정", "  h+=wkPubPanel()+noptPanelHtml();   // v18-14: 학생앱 「내 기록」 등수 표시 설정 · v19-85: 전국 등수 신청")
    rep("      C+='</span></div>';\n    }\n    /* ★ v18-172", "      C+=noptBadge(sel.name)+'</span></div>';   /* v19-85 */\n    }\n    /* ★ v18-172")
    rep("function rPlannerInput(){\n", "function rPlannerInput(){\n  try{ if(typeof plzHealCleared==='function') plzHealCleared(); }catch(e){}   /* v19-85 */\n")
if int(ver.replace('v19-',''))>=86:
    # v19-86: 📔 순공피드백 — 점수 보이기 · 주 옮기기 · 사진 점수 손 고침 (sgscore_teacher.js)
    rep("      if(e) h+='<td onclick=\"sgOpen(\\''+esc2(code)+'\\',\\''+w+'\\')\" title=\"'+sgFmt(sgTotal(e))+' — 눌러서 사진 대조\" style=\"padding:8px 4px;border-bottom:1px solid #f4f6fa;text-align:center;cursor:pointer\">'\n             +'<span style=\"display:inline-block;background:#ecfdf5;color:#059669;border-radius:8px;padding:3px 7px;font-size:11.5px;font-weight:900\">'+sgFmt(sgTotal(e))+(e.photo?' 🖼':'')+'</span></td>';\n      else h+='<td style=\"padding:8px 4px;border-bottom:1px solid #f4f6fa;text-align:center;color:#dbe2ea;font-weight:900\">—</td>';",
        "      h+=sgsCell(code,w,e);   /* v19-86: 사진·종이 점수 */")
    rep("학생이 매주 종이에 쓴 순공시간을 학생앱으로 올린 것 · 칸을 누르면 종이 사진과 입력값을 나란히 대조합니다</div>';\n",
        "학생이 매주 종이에 쓴 순공시간을 학생앱으로 올린 것 · 칸을 누르면 종이 사진과 입력값을 나란히 대조하고, 주 옮기기·점수 고치기를 합니다</div>';\n  h+=sgsBanner();   /* v19-86 */\n")
    rep("      +'<div style=\"font-size:20px;font-weight:900;color:'+k[2]+'\">'+k[1]+'</div></div>';\n  });\n  h+='</div>';\n",
        "      +'<div style=\"font-size:20px;font-weight:900;color:'+k[2]+'\">'+k[1]+'</div></div>';\n  });\n  h+=sgsSummaryTile(list);   /* v19-86 */\n  h+='</div>';\n")
    rep("+w.slice(5).replace('-','/')+(isCur?'<br><span style=\"font-size:9px\">이번 주</span>':'')+'</th>';",
        "+w.slice(5).replace('-','/')+(isCur?'<br><span style=\"font-size:9px\">이번 주</span>':'')+((typeof PWB!=='undefined'&&PWB.loaded&&w===plwDefaultW())?'<br><span style=\"font-size:9px;color:#7c3aed;font-weight:900\">점수 주</span>':'')+'</th>';")
    rep("✕ 닫기</button></div>';\n  if(!w){", "✕ 닫기</button></div>';\n  h+=sgsPopActions(code,mon);   /* v19-86 */\n  if(!w){")
    rep("사진은 선택이라 숫자만 올릴 수도 있습니다.<br>'", "사진이 있어야 제출됩니다(학생앱 v2-111부터). 칸은 <b>종이에 적힌 주</b>이고, 학생앱 v2-129부터 학생이 주를 고릅니다.<br>'")
    rep("if (!ov) delete v.byCode[code][W]; else {", "if (!ov){ var _k = v.byCode[code][W]; if (_k && _k.pov) v.byCode[code][W] = { pov: _k.pov, povWhy: _k.povWhy, povAt: _k.povAt }; else delete v.byCode[code][W]; } else {   /* v19-86: 사진 점수 손 고침(pov)은 남긴다 */")
if int(ver.replace('v19-',''))>=87:
    # v19-87: 여러 기기 등록부 맞추기 (studb_sync.js) — 숙제체크 칸 시각 · 올리기 전 받아 합치기
    rep("""            var _hwc = Object.assign({}, prev.lumen_hw||{});
            var _sHwc = s.lumen_hw||{};
            Object.keys(_sHwc).forEach(function(dk){ if(_sHwc[dk]) _hwc[dk] = _sHwc[dk]; });
            if(Object.keys(_hwc).length>0) m.lumen_hw = _hwc;""",
"""            var _hwc = Object.assign({}, prev.lumen_hw||{});
            var _sHwc = s.lumen_hw||{};
            var _hcAt = prev.lumen_hw_at||{}, _hsAt = s.lumen_hw_at||{};   /* ★ v19-87: 칸마다 더 최근에 고친 쪽 (지운 칸 포함) */
            Object.keys(_sHwc).forEach(function(dk){ if(!_sHwc[dk]) return; if(_hcAt[dk] && String(_hcAt[dk]) > String(_hsAt[dk]||'')) return; _hwc[dk] = _sHwc[dk]; });
            Object.keys(_hsAt).forEach(function(dk){ if(_sHwc[dk]===undefined && String(_hsAt[dk]) > String(_hcAt[dk]||'')) delete _hwc[dk]; });
            m.lumen_hw = _hwc;
            var _hmAt = Object.assign({}, _hcAt); Object.keys(_hsAt).forEach(function(dk){ if(!_hmAt[dk] || String(_hsAt[dk]) > String(_hmAt[dk])) _hmAt[dk] = _hsAt[dk]; }); if(Object.keys(_hmAt).length>0) m.lumen_hw_at = _hmAt;""")
    rep("""        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }
        val = window._fullStudentDb;""",
"""        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) {
          /* ★ v19-87: 아직 못 받았으면 지금 받아 합친 뒤 올린다(태블릿이 받기에 실패해 체크가 영영 안 올라가던 것) */
          var _fr = null; try { if (typeof sdsSync === 'function') _fr = await sdsSync(true); } catch(e) {}
          if (!_fr || !window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }
        } else {
          /* ★ v19-87: 올리기 직전 서버 것을 먼저 합친다 — 다른 기기에서 고친 것을 옛 사본으로 덮지 않게 (서버가 그대로면 시각만 확인) */
          try { if (typeof sdsSync === 'function') await sdsSync(false); } catch(e) {}
        }
        val = window._fullStudentDb;""")
    rep("""    var result = await sb.from('lumen_store').upsert(payload, { onConflict: 'key' });
    return !result.error;
  } catch(e) { return false; }""",
"""    var result = await sb.from('lumen_store').upsert(payload, { onConflict: 'key' });
    if (key === 'or_studentdb' && !result.error && typeof SDS !== 'undefined') SDS.cloudAt = payload.updated_at;   /* ★ v19-87 */
    return !result.error;
  } catch(e) { return false; }""")
if int(ver.replace('v19-',''))>=88:
    # v19-88: 주간 점수 = 📅 주간계획 6 + 📔 순공피드백 4 — 보이는 칸 나누기 (wksplit_teacher.js)
    rep("label:'주간 점수(주간계획)'", "label:'주간 점수(계획·순공)'")
    rep("'순공 종이 (학원)', '주간', '매일 합'", "'순공 종이 (학원)', '주간 합 (계획 6 + 순공 4)', '매일 합'")
if int(ver.replace('v19-',''))>=91:
    # v19-91: 주간 점수 20 = 주간계획 10 + 순공 10 (plweek_core PW.PT/PW.MAX) · 앱 시작 다운로드 줄이기
    rep("'주간 합 (계획 6 + 순공 4)'", "'주간 합 (계획 10 + 순공 10)'")
    rep("""      if (_skip.length) _q = _q.not('key', 'in', '(' + _skip.join(',') + ')');""",
"""      if (_skip.length) _q = _q.not('key', 'in', '(' + _skip.join(',') + ')');
      /* ★ v19-91: 앱이 «서버에서 바로 읽는» 큰 자료는 시작 때 받지 않는다 — 69MB → 약 10MB (원장 지시 2026-10-07 「76MB 줄이기」)
       *   교재 정답·학습지 문항·교과서 은행·쪽 목록·기출 DB·해설집·채점 기록·학생별 성취도·학생앱 발행본 등.
       *   이 키들은 화면이 필요할 때 lumen_store 에서 직접 받는다(로컬 사본을 읽는 코드 없음 · 올리기 목록에도 없음). */
      PULL_SKIP_PREFIX.forEach(function(p){ _q = _q.not('key', 'like', p + '%'); });
      _q = _q.not('key', 'in', '(' + PULL_SKIP_KEYS.map(function(k){ return '"' + k + '"'; }).join(',') + ')');""")
    rep("""async function supaFullPull(onlyKeys) {""", """var PULL_SKIP_PREFIX = ['mf_bookans_', 'mf_wsq_', 'mf_textbook_', 'mf_swb_', 'mf_ws_recent_', 'mf_wsans_', 'ms_exam', 'haesol_body_', 'hw_synced_', 'hw_scores_', 'typeach_stu_', 'stu_reports_', 'pub_reports_', 'submissions_', 'or_students_archive_'];
var PULL_SKIP_KEYS = ['mf_type_ach', 'mf_sol_fix', 'mf_bookpages', 'ms_mydb_index', 'mf_ws_behaviors', 'mf_weekly', 'mf_progress', 'mf_books', 'mf_stuck'];
async function supaFullPull(onlyKeys) {""")
if int(ver.replace('v19-',''))>=92:
    # 리커버리 우측 패널: 「확정 전원」 단추 위에 매쓰플랫 계정 칸 (rcws_teacher.js 가 rcMakeWsAll·rcWsBtn 을 새 길로 덮어쓴다)
    rep("""  h+='<button onclick="rcMakeWsAll()" style="border:1.5px solid #bfdbfe;""", """  h+=rcwsAcctBox();   /* ★ v19-92: 매쓰플랫 계정 (이 PC 에만) */
  h+='<button onclick="rcMakeWsAll()" style="border:1.5px solid #bfdbfe;""")
rep("var APP_VER = 'v19-42';","var APP_VER = '"+ver+"';")
anchor="      {ver:'v19-42',date:'2026-09-24',stability:'ok',memo:'📘"; i=s.index(anchor)
memos=''
for f in sorted(os.listdir(MEMO)):
    if re.match(r'memo_19(4[3-9]|[5-9]\d)\.txt$', f): pass
for n in range(99,42,-1):
    f=MEMO+'/memo_19%d.txt'%n
    if os.path.exists(f) and n<=int(ver.replace('v19-','')): memos+=open(f).read()
s=s[:i]+memos+s[i:]; open(out,'w').write(s); print(out,'조립 · 메모', memos.count("{ver:'"))
