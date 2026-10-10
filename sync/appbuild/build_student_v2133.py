# 학생앱 v2-133 조립 — «v2-132 복사 + rep 고침»
#   원장 질문 2026-10-10: 「리커버리 학습지를 학생앱에서 채점할 때 틀린 문제를 다시 입력해서 2차 채점이 되는가? 안 되면 수정해서 배포」
#   [까닭] 다시 도전(v2-91)은 «학생앱에서 1차 채점한 문항»만 대상(bkRtBase 가 BK.scores 기록을 요구).
#          매쓰플랫에서 채점된 ✗ 문항은 1차 기록이 없어 「다시 풀어 보면 좋아요」 글만 뜨고 2차 입력이 안 됐다.
#   [고침] 학습지를 열 때 매쓰플랫이 ✗ 로 채점해 둔 문항에 1차 기록(r:'X', mf:true)을 만들어 준다 → 정답이 가려지고
#          「🔁 다시 도전」 대상이 된다. 2차·3차는 지금처럼 루멘에만 남고 매쓰플랫엔 안 보낸다.
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-132.html'); DST = os.path.join(ROOT, 'student_v2-133.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-132';", "var STU_VER = 'v2-133';")

rep("""  BK.ans[vpid]={ pages:{} };
  BK.ans[vpid].pages[vwp]={ v:2, problems:probs };
  BK.active=null; BK.buf='';
  go('screen-bookq');
};""",
"""  BK.ans[vpid]={ pages:{} };
  BK.ans[vpid].pages[vwp]={ v:2, problems:probs };
  bkMfSeed(vpid, probs, w);                 /* ★ v2-133: 매쓰플랫이 ✗ 로 채점한 문항도 다시 도전 대상으로 */
  BK.active=null; BK.buf='';
  go('screen-bookq');
};
/* ★ v2-133 (원장 질문 2026-10-10 「리커버리 학습지 틀린 문제를 다시 입력해 2차 채점이 되는가」)
 *   다시 도전(v2-91)은 «학생앱에서 1차 채점한 문항»만 대상이라, 매쓰플랫(선생님)이 채점한 ✗ 는
 *   「다시 풀어 보면 좋아요」 글만 뜨고 2차 입력이 안 됐다. 학습지를 열 때 그런 문항에 1차 기록을
 *   매쓰플랫 결과로 만들어 준다(r:'X' · 내 답은 매쓰플랫에 적힌 답 · mf:true).
 *   → 정답이 가려지고 「🔁 다시 도전」에 들어간다. 2차·3차는 지금처럼 루멘에만 남는다(매쓰플랫엔 안 보냄). */
function bkMfSeed(vpid, probs, w){
  var n=0, at=new Date().toISOString();
  (probs||[]).forEach(function(p){
    if(!p||p.result!=='X') return;
    var key=bkKeyOf(vpid,p.wpId); if(BK.scores[key]) return;
    BK.scores[key]={ r:'X', a:String(p.userAnswer==null?'':p.userAnswer), at:at, self:false, photo:'', kind:'ws', swId:w.swId, mf:true };
    n++;
  });
  return n;
}""")

# 1차 기록이 매쓰플랫에서 온 것이면 카드에 표시
rep("""  else h+='<div class="rev-line"><span class="lb">내 답</span><span class="vv" style="color:'+col+'">'
    +(m.r==='?'?'모름':h3Esc(m.a||''))+'</span></div>';
  h+=bkAnsSlot(p,m,p.wpId);       /* ★ v2-91: 1차에 못 맞힌 문항은 정답을 가린다 */""",
"""  else h+='<div class="rev-line"><span class="lb">'+(m.mf?'매쓰플랫 채점':'내 답')+'</span><span class="vv" style="color:'+col+'">'
    +(m.r==='?'?'모름':h3Esc(m.a||(m.mf?'✕ 틀렸어요':'')))+'</span></div>';   /* ★ v2-133: 매쓰플랫 채점 표시 */
  h+=bkAnsSlot(p,m,p.wpId);       /* ★ v2-91: 1차에 못 맞힌 문항은 정답을 가린다 */""")
rep("""  h+='<div class="bk-old">1차에 쓴 답 · <b>'+h3Esc((m&&m.r==='?')?'모름':((m&&m.a)||'(빈칸)'))+'</b> → '""",
    """  h+='<div class="bk-old">1차에 쓴 답 · <b>'+h3Esc((m&&m.r==='?')?'모름':((m&&m.a)||(m&&m.mf?'종이에 풀어 매쓰플랫에서 채점':'(빈칸)')))+'</b> → '""")

log = """ * v2-133 (2026-10-10) 🔁 매쓰플랫에서 채점된 ✗ 문항도 «다시 도전»이 됩니다 (리커버리 학습지)
 *   · 원장님 질문: 「리커버리 학습지를 학생앱에서 채점할 때 틀린 문제를 다시 입력해 2차 채점이 되는가?」
 *   · <b>[까닭]</b> 다시 도전(v2-91)은 <b>학생앱에서 1차 채점한 문항</b>만 대상이었습니다. 선생님이 매쓰플랫에서
 *     채점한 ✗ 문항은 「✕ 이미 채점이 끝난 문제예요 — 다시 풀어 보면 좋아요」 글만 뜨고 답을 다시 넣을 수 없었습니다.
 *   · <b>[고침]</b> 학습지를 열면 매쓰플랫이 ✗ 로 채점해 둔 문항에 1차 기록을 매쓰플랫 결과로 만들어 둡니다.
 *     그래서 정답이 가려지고, 학습지를 다 채점한 상태면 마무리 카드에 「🔁 다시 도전할 문항 n개 · 시작하기」가 뜹니다.
 *     카드에는 「매쓰플랫 채점 ✕」 로 표시되고, 다시 도전 화면의 「1차에 쓴 답」은 매쓰플랫에 적힌 답(없으면 「종이에 풀어
 *     매쓰플랫에서 채점」)으로 보입니다.
 *   · <b>1차 점수는 그대로</b>이고 2차·3차는 전과 같이 루멘에만 남습니다(매쓰플랫에는 보내지 않습니다). 3일 뒤 3차 알림도 같습니다.
 *
"""
import re
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
