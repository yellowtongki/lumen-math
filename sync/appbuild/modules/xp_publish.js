/* ═══════════════════════════════════════════════════════════════
 * v19-47: 🧍 XP 게시판 (xp_board) — 학생앱이 읽는 레벨·XP·훈장
 * 학원앱의 레벨 계산(calcXP·getLevelInfo·calcBadges)을 그대로 돌려 학생코드별로 lumen_store 「xp_board」에 적는다.
 * 학생앱은 이 값을 읽기만 한다(홈 머리 Lv·XP 막대, 내 캐릭터 화면). 이름은 넣지 않는다(코드만).
 * 언제 쓰나: 앱을 켠 뒤 15초(한 시간에 한 번) · 레벨 탭을 그릴 때마다.
 * ═══════════════════════════════════════════════════════════════ */
window.lvPublishAll=async function(force){
  try{
    if(typeof calcXP!=='function'||typeof students==='undefined'||typeof getLevelInfo!=='function') return;
    var last=Number(localStorage.getItem('lumen_xp_pub_at')||0); if(!force&&Date.now()-last<3600000) return;
    var sb=(typeof getSupaClient==='function')?getSupaClient():window.sb; if(!sb) return;   /* 학원앱은 전역 sb 가 없다 — getSupaClient() 로 받는다 (v19-48에서 고침: v19-47은 이 줄 때문에 게시가 안 됐다) */
    var by={}, n=0;
    students.forEach(function(st){
      if(!st||!st.name||st.lumen_rec_code==null||st.withdrawn) return;
      if(typeof isLevelOn==='function'&&!isLevelOn(st)) return;
      var grp=(typeof groupStudents==='function')?groupStudents().find(function(g){ return g.name===st.name; }):null;
      var reps=grp?(grp.reports||[]):[];
      var x=calcXP(st,reps); var li=getLevelInfo(x.total);
      var bd=[]; try{ bd=calcBadges(st,reps)||[]; }catch(e){}
      var mb=[]; try{ mb=getManualBadges(st.id).map(function(m){ return m.id; }); }catch(e){}
      by[String(st.lumen_rec_code)]={ xp:x.total, month:x.thisMonth, lv:li.level, title:(li.info||{}).name||'', icon:(li.info||{}).icon||'', color:(li.info||{}).color||'', next:li.next, floor:li.curFloor, prog:li.progress, toNext:li.xpToNext, bd:x.breakdown, badges:bd, mbadges:mb, job:st.lumen_char_job||'', gender:st.lumen_char_gender||'boy' };
      n++;
    });
    var now=new Date().toISOString();
    var r=await sb.from('lumen_store').upsert({ key:'xp_board', value:{ byCode:by, n:n, upd:now }, updated_at:now },{ onConflict:'key' });
    if(r&&r.error) throw r.error;
    localStorage.setItem('lumen_xp_pub_at',String(Date.now()));
  }catch(e){ console.warn('xp_board 게시 실패', e); }
};
setTimeout(function(){ try{ lvPublishAll(false); }catch(e){} }, 15000);
