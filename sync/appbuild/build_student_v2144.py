# 학생앱 v2-144 조립 — «v2-143 복사 + rep 고침»
#   원장 2026-10-19 「시험대비 트랙 … 다음 기말고사 · 학교시험 디데이 업데이트」 (학원앱 v19-139 와 같이)
#   시험대비 트랙 화면 디데이가 «학년을 안 보고 그 학교 첫 디데이»를 써서, 옥길중 중1 에게 3학년 시험(11/13)이
#   보일 수 있었다. → ① 트랙에 exam{label,from,to} 가 있으면(v19-139) 그것을 쓰고 ② 없으면 학년이 맞는 디데이
#   (grades 가 비었거나 내 학년 숫자를 포함)만 고른다.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-143.html'); DST = os.path.join(ROOT, 'student_v2-144.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-143';", "var STU_VER = 'v2-144';")
rep("""    function ddFor(name){
      if(!name) return null;
      var n=String(name).replace(/\\s/g,'');
      return dds.filter(function(x){
        var s=String(x.school||'').replace(/\\s/g,'');
        return s&&(n===s||n.indexOf(s)===0||s.indexOf(n)===0);
      })[0]||null;
    }
    var dd=ddFor(mySc)||ddFor(tr&&tr.school);""", """    /* v2-144: 학년이 맞는 디데이만 (grades 가 비었거나 내 학년 숫자 포함) · 지난 디데이는 건너뜀 */
    var myGn=(String(studentInfo.grade||'').match(/(\\d)/)||[])[1]||'';
    var todayS=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
    function ddFor(name){
      if(!name) return null;
      var n=String(name).replace(/\\s/g,'');
      return dds.filter(function(x){
        var s=String(x.school||'').replace(/\\s/g,'');
        if(!(s&&(n===s||n.indexOf(s)===0||s.indexOf(n)===0))) return false;
        if(Array.isArray(x.grades)&&x.grades.length&&myGn&&x.grades.map(String).indexOf(myGn)<0) return false;
        return !x.date||String(x.to||x.date)>=todayS;
      }).sort(function(a,b){ return String(a.date||'').localeCompare(String(b.date||'')); })[0]||null;
    }
    /* v2-144: 트랙에 대비하는 시험(exam, 학원앱 v19-139)이 적혀 있으면 그것이 먼저 */
    var dd=(tr&&tr.exam&&tr.exam.from)?{ school:(tr.school||mySc), label:(tr.exam.label||'시험'), date:tr.exam.from }
          :(ddFor(mySc)||ddFor(tr&&tr.school));""")
log = """ * v2-144 (2026-10-19) 🎯 시험대비 트랙 디데이를 내 학년 시험으로 (학원앱 v19-139 와 같이)
 *   · 트랙에 «대비하는 시험»이 적혀 있으면 그 날짜로 디데이를 셉니다.
 *   · 없으면 같은 학교라도 내 학년 시험만 고릅니다(중1 에게 3학년 시험 날짜가 보이던 것 고침). 지난 시험은 건너뜁니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
