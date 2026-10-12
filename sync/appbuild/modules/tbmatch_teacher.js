/* ═══════════════════════════════════════════════════════════════════
 * v19-111: 📚 교과서일치도 — 학교 시험 문항이 «어느 출판사 교과서»에서 나왔는지 한 화면에 (시안 docs/mockup_textbook_match.html)
 * 원장 결정 2026-10-12: 「교과서일치도 · 대비 학습지는 나중에 · 일치도는 숫자변형인가」
 *   → 이름은 「교과서일치도」 · 일치도 = 같은 문제 + 숫자변형 (지문 겹침·유사유형은 세지 않음) · 「대비 학습지」 단추는 «준비 중»
 *
 *  자료 (새로 저장하는 것 없음 — 적중 분석이 쓰는 것을 그대로 읽는다)
 *    exam_hit_index → 시험 목록 · exam_hit_<시험> 의 stats.pub(출판사 비교를 마친 시험만) · it.pub[] (✗ 아님 = rejected)
 *    mf_textbooks.bySchoolGrade['학교|학년'] → 그 학교 교과서(학생 배정) — 출판사 표에서 파란 테두리
 *  ① 왼쪽: 「전체 한눈에」 + 분석한 시험(연도·학기·시험별)
 *  ② 가운데 «전체 한눈에»: 숫자 칸 4개 · 시험 × 출판사 지도(과목마다 표, 칸 = 같은 문제+숫자변형 문항 수, 진할수록 많음)
 *     «한 시험»: 출판사별 표(시험 문항 번호 누르면 그 문항 그림) · 「학교 교과서에 없던 문항」 — 시험 그림 ↔ 교과서 그림 · ✓ 맞음 · ✗ 아님(서버 저장) · 🎯 적중 분석에서 보기
 *  ③ 오른쪽 도구 칸(RIGHT_TOOLS.tbmatch): 다음 시험 대비 추천 · 출판사 비교 요청은 채팅에서(API 절약) · 블로그 자료(.md) 복사
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hit_teacher · pubsrc_teacher · layout3)의 함수를 부르기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var TBM = { kicked:false, loading:false, idx:null, books:null, cur:'', hl:'', focus:null, sel:{}, ok:{}, err:'', md:'' };
var TBM_NOTE = '일치도 = 같은 문제 + 숫자변형 (지문 겹침·유사유형은 세지 않음)';

/* ── 메뉴: 「📝 시험·기출」 의 「🎯 적중 분석」 바로 뒤 ── */
(function(){
  try{
    var g=(GROUPS||[]).filter(function(x){ return x.key==='exams'; })[0]; if(!g) return;
    if(g.subs.some(function(s){ return s.v==='tbmatch'; })) return;
    var at=g.subs.length; g.subs.forEach(function(s, j){ if(s.v==='examhit') at=j+1; });
    g.subs.splice(at, 0, { v:'tbmatch', icon:'📚', label:'교과서일치도', act:function(){ VIEW='tbmatch'; } });
  }catch(e){ try{ console.error('[교과서일치도 메뉴]', e); }catch(_){} }
})();

/* ── 불러오기 (적중 분석과 같은 HT.data 를 함께 쓴다 → ✗ 아님이 양쪽에 같이 보인다) ── */
function tbmKick(){
  if(TBM.kicked) return; TBM.kicked=true; TBM.loading=true; TBM.err='';
  Promise.all([htKv('exam_hit_index'), htKv('mf_textbooks')]).then(function(a){
    TBM.idx=a[0]||{ items:[] }; TBM.books=a[1]||{};
    return Promise.all(((TBM.idx.items)||[]).map(function(x){
      var id=String((x&&x.examId)||''); if(!id || HT.data[id]) return null;
      return htKv('exam_hit_'+id).then(function(v){ if(v && !HT.data[id]) HT.data[id]=v; }).catch(function(){});
    }));
  }).then(function(){ TBM.loading=false; if(VIEW==='tbmatch') render(); })
    .catch(function(e){ TBM.loading=false; TBM.err=String((e&&e.message)||e); if(VIEW==='tbmatch') render(); });
}
window.tbmReload = function(){
  ((TBM.idx&&TBM.idx.items)||[]).forEach(function(x){ if(x && x.examId) delete HT.data[x.examId]; });
  TBM.kicked=false; TBM.idx=null; TBM.books=null; tbmKick(); render();
};

/* ── 시험 목록 (출판사 비교를 마친 것만) ── */
var TBM_TERM = { '기말':2, '중간':1 };
function tbmLv(x){ var g=htGradeKey(x.grade); return /^고/.test(g)?0:(/^중/.test(g)?1:2); }
function tbmGn(x){ return Number(String(htGradeKey(x.grade)).replace(/\D/g,''))||0; }
function tbmTermOf(t){ return /기말/.test(t)?2:(/중간/.test(t)?1:0); }
function tbmExams(){
  var out=[];
  ((TBM.idx&&TBM.idx.items)||[]).forEach(function(x){
    var id=String((x&&x.examId)||''), d=id?HT.data[id]:null; if(!d || !pbHas(d)) return;
    var e=d.exam||{};
    out.push({ id:id, d:d, school:String(e.school||x.school||''), grade:String(e.grade||x.grade||''), year:String(e.year||x.year||''),
      sem:String(e.semester||x.semester||''), term:String(e.term||x.term||''), subject:String(d.stats.pub.subject||e.subject||'') });
  });
  out.sort(function(a,b){ return (Number(b.year)||0)-(Number(a.year)||0) || (Number(b.sem)||0)-(Number(a.sem)||0) || tbmTermOf(b.term)-tbmTermOf(a.term)
    || tbmLv(a)-tbmLv(b) || a.school.localeCompare(b.school,'ko') || tbmGn(a)-tbmGn(b); });
  return out;
}
function tbmName(x){ return x.school+' '+x.grade; }
function tbmTermLabel(x){ return x.year+' '+x.sem+'학기 '+x.term; }

/* ── 그 학교 교과서 (학생 배정 교과서 → 출판사) ── */
function tbmPubName(t){ var m=String(t||'').match(/^교과서_(.+?)\s*-\s*/); return m?m[1]:String(t||'').replace(/^교과서_?/,'').split(' - ')[0].trim(); }
function tbmOwn(x){
  var M=TBM.books||{}, sg=(((M.bySchoolGrade||{})[htSchoolKey(x.school)+'|'+htGradeKey(x.grade)])||{}).books||{};
  var books=x.d.stats.pub.books||[], score={}, hit=false;
  Object.keys(sg).forEach(function(bid){ books.forEach(function(b){ if(String(b.bid)===String(bid)){ score[b.pub]=(score[b.pub]||0)+(Number(sg[bid])||1); hit=true; } }); });
  if(!hit) Object.keys(sg).forEach(function(bid){   /* 다른 과목 교과서만 배정돼 있으면 출판사 이름으로 */
    var bk=(M.books||{})[bid]||{}, nm=tbmPubName(bk.fulltitle||bk.title); if(!nm) return;
    books.forEach(function(b){ if(b.pub===nm) score[b.pub]=(score[b.pub]||0)+(Number(sg[bid])||1); });
  });
  var mx=0; Object.keys(score).forEach(function(p){ if(score[p]>mx) mx=score[p]; });
  return Object.keys(score).filter(function(p){ return mx>0 && score[p]===mx; });
}

/* ── 세기: 문항마다 출판사별로 가장 닮은 것 하나(pbStats 와 같은 방식) · 같은 문제·숫자변형만 «일치» ── */
function tbmCalc(x){
  if(x.c) return x.c;
  var d=x.d, own=tbmOwn(x), by={}, pubs=[];
  var add=function(pb){ if(!by[pb]){ by[pb]={ pub:pb, same:0, 'var':0, text:0, sv:0, nos:[], only:0, n:0, own:own.indexOf(pb)>=0, cmp:false }; pubs.push(pb); } return by[pb]; };
  (d.stats.pub.books||[]).forEach(function(b){ var r=add(b.pub); r.n+=Number(b.n)||0; r.cmp=true; });
  var items=htVisible(d), ownHit=0, any=0, only=[], onlyNo={};
  items.forEach(function(it){
    var n=htNumOf(d,it), best={}, L=pbLive(it), sv=[];
    L.forEach(function(p){ if(!best[p.pub] || PB_ORDER[p.kind]>PB_ORDER[best[p.pub]]) best[p.pub]=p.kind; });
    Object.keys(best).forEach(function(pb){ var r=add(pb), k=best[pb]; r.cmp=true;
      if(k==='same'||k==='var'){ r[k]++; r.sv++; r.nos.push({ n:n, no:it.no }); sv.push(pb); } else if(k==='text') r.text++; });
    if(sv.length) any++;
    if(sv.some(function(pb){ return own.indexOf(pb)>=0; })) ownHit++;
    else if(sv.length && own.length){ only.push({ it:it, n:n, pubs:sv }); onlyNo[it.no]=1; sv.forEach(function(pb){ by[pb].only++; }); }
  });
  pubs.forEach(function(pb){ by[pb].nos.sort(function(a,b){ return a.n-b.n; }); });
  var others=pubs.filter(function(pb){ return own.indexOf(pb)<0 && by[pb].sv>0; })
    .sort(function(a,b){ return by[b].only-by[a].only || by[b].sv-by[a].sv || a.localeCompare(b,'ko'); });
  x.c={ own:own, by:by, pubs:pubs, total:items.length, ownHit:ownHit, any:any, only:only, onlyNo:onlyNo, others:others };
  return x.c;
}
function tbmHeat(n){ return n>=8?'h4':(n>=6?'h3':(n>=3?'h2':(n>=1?'h1':'h0'))); }
/* 「다른 곳에서만」 칸 글 — 한 출판사가 앞서면 그 이름도 */
function tbmOnlyTag(c){
  if(!c.own.length) return '<span class="tbm-note">학교 교과서 모름</span>';
  if(!c.only.length) return '<span class="tbm-note">없음</span>';
  var a=c.others[0], b=c.others[1], lead=(a && c.by[a].only>0 && (!b || c.by[a].only>c.by[b].only)) ? (' · '+htEsc(a)+' '+c.by[a].only) : '';
  return '<span class="tbm-only">'+c.only.length+'문항'+lead+'</span>';
}

/* ── 가운데: 전체 한눈에 ── */
function tbmKpi(v, label, color, small){ return '<div class="tbm-kpi"><b'+(color?' style="color:'+color+(small?';font-size:15px;line-height:1.9':'')+'"':'')+'>'+v+'</b><span>'+label+'</span></div>'; }
function tbmOverview(L){
  var oh=0, ot=0, known=0, only=0, oc={};
  L.forEach(function(x){ var c=tbmCalc(x); if(!c.own.length) return; known++; oh+=c.ownHit; ot+=c.total; only+=c.only.length;
    c.only.forEach(function(o){ o.pubs.forEach(function(pb){ oc[pb]=(oc[pb]||0)+1; }); }); });
  var top=Object.keys(oc).sort(function(a,b){ return oc[b]-oc[a] || a.localeCompare(b,'ko'); }).slice(0,2);
  var h='<div class="tbm-card"><div class="tbm-top"><div style="flex:1;min-width:220px"><h2>📚 교과서일치도</h2>'
    +'<div class="tbm-note">학교 시험 문항이 <b>어느 출판사 교과서</b>에서 나왔는지 — 그 과목 <b>모든 출판사 교과서</b>와 문항 그림을 비교한 결과입니다.</div></div>'
    +'<button class="tbm-btn" onclick="tbmReload()">🔄 새로고침</button></div>'
    +'<div class="tbm-def" id="tbm-def">'+TBM_NOTE+'</div>'
    +'<div class="tbm-kpis" id="tbm-kpis">'
    +tbmKpi(L.length, '분석한 시험')
    +tbmKpi(oh+' / '+ot, '학교 교과서와 일치한 문항'+(known<L.length?' (학교 교과서를 아는 '+known+'개 시험)':''), '#166534')
    +tbmKpi(only, '학교 교과서엔 없고 <b>다른 출판사</b>에서만', '#c2410c')
    +tbmKpi(top.length?htEsc(top.join(' · ')):'—', '다른 출판사 중 자주 나온 곳', '#0f172a', true)
    +'</div>';
  /* ① 시험 × 출판사 지도 — 과목마다 표 */
  var subs=[], bySub={};
  L.forEach(function(x){ var k=x.subject||'과목 모름'; if(!bySub[k]){ bySub[k]=[]; subs.push(k); } bySub[k].push(x); });
  h+='<div class="tbm-sec"><h3>① 시험 × 출판사 지도 <span class="tbm-note">— 칸 숫자 = 같은 문제·숫자변형 문항 수 · <span class="tbm-ownkey">파란 테두리</span> = 그 학교 교과서</span></h3>';
  subs.forEach(function(sk){
    var X=bySub[sk], tot={}, cols=[];
    X.forEach(function(x){ var c=tbmCalc(x); c.pubs.forEach(function(pb){ if(tot[pb]==null){ tot[pb]=0; cols.push(pb); } tot[pb]+=c.by[pb].sv; }); });
    cols.sort(function(a,b){ return tot[b]-tot[a] || a.localeCompare(b,'ko'); });
    h+='<div class="tbm-subj" data-tbm-subj="'+htEsc(sk)+'"><b>'+htEsc(sk)+'</b> <span class="tbm-note">교과서 '+cols.length+'종 · 시험 '+X.length+'개</span></div>'
      +'<div class="tbm-scroll"><table class="tbm-t"><thead><tr><th class="l">시험</th>';
    cols.forEach(function(pb){ h+='<th>'+htEsc(pb)+'</th>'; });
    h+='<th>다른 곳에서만</th></tr></thead><tbody>';
    X.forEach(function(x){
      var c=tbmCalc(x);
      h+='<tr data-tbm-row="'+htEsc(x.id)+'"><td class="l"><a href="javascript:void(0)" class="tbm-ex" data-id="'+htEsc(x.id)+'" onclick="tbmOpen(this.getAttribute(\'data-id\'))"><b>'+htEsc(tbmName(x))+'</b></a> <span class="tbm-note">'+c.total+'문항 · '+htEsc(tbmTermLabel(x))+'</span></td>';
      cols.forEach(function(pb){
        var r=c.by[pb];
        if(!r || !r.cmp){ h+='<td class="h0" data-tbm-cell="'+htEsc(pb)+'">—</td>'; return; }
        h+='<td class="tbm-c '+tbmHeat(r.sv)+(r.own?' own':'')+'" data-tbm-cell="'+htEsc(pb)+'" data-id="'+htEsc(x.id)+'" data-pub="'+htEsc(pb)+'" title="'+htEsc(pb)+' — 같은 문제 '+r.same+' · 숫자변형 '+r['var']+(r.own?' · 학교 교과서':'')+'" onclick="tbmOpen(this.getAttribute(\'data-id\'),this.getAttribute(\'data-pub\'))">'+(r.sv||'·')+'</td>';
      });
      h+='<td data-tbm-onlycell="1">'+tbmOnlyTag(c)+'</td></tr>';
    });
    h+='</tbody></table></div>';
  });
  h+='<div class="tbm-legend">진할수록 많이 나옴 <i style="background:#f0fdf4"></i>1~2 <i style="background:#bbf7d0"></i>3~5 <i style="background:#4ade80"></i>6~7 <i style="background:#16a34a"></i>8 이상 · 칸을 누르면 그 시험으로</div></div>';
  h+='<div class="tbm-sec"><h3>② 학교 교과서에 없던 문항 <span class="tbm-note">— 시험을 고르면 시험 그림과 교과서 그림을 나란히 봅니다</span></h3><div class="tbm-note" style="line-height:1.8">';
  var any=false;
  L.forEach(function(x){ var c=tbmCalc(x); if(!c.only.length) return; any=true;
    h+='<a href="javascript:void(0)" class="tbm-ex" data-id="'+htEsc(x.id)+'" onclick="tbmOpen(this.getAttribute(\'data-id\'))"><b>'+htEsc(tbmName(x))+'</b></a> '
      +c.only.map(function(o){ return o.n+'번('+htEsc(o.pubs.join('·'))+')'; }).join(' · ')+'<br>'; });
  if(!any) h+='학교 교과서에 없던 문항이 없습니다 (또는 학교 교과서를 모릅니다).';
  return h+'</div></div></div>';
}

/* ── 가운데: 한 시험 ── */
function tbmLive(it){ return pbLive(it).filter(function(p){ return p.kind==='same'||p.kind==='var'; }); }
/* 시험 그림 ↔ 교과서 그림 한 쌍 (cands 중 고른 것 하나 + 나머지는 칩) */
function tbmItemCard(x, it, cands, tag){
  var key=x.id+'|'+it.no, sk=TBM.sel[key], p=cands.filter(function(q){ return q.k===sk; })[0]||cands[0];
  var n=htNumOf(x.d,it), K=HT_KIND[p.kind]||HT_KIND.none, ok=!!TBM.ok[x.id+'|'+p.k], img=htItemImg(it), own=tbmCalc(x).own.indexOf(p.pub)>=0;
  var h='<div class="tbm-q'+(ok?' ok':'')+'" data-id="'+htEsc(x.id)+'" data-no="'+htEsc(it.no)+'" data-k="'+htEsc(p.k)+'" id="tbm-q-'+htEsc(it.no)+(tag?'-'+tag:'')+'">'
    +'<div class="hd"><span><b>'+n+'번</b> ↔ <b class="'+(own?'tbm-own-t':'tbm-o')+'">'+htEsc(pbWhere(p))+'</b>'+(own?' <small class="tbm-owntag">학교 교과서</small>':'')+'</span>'
    +'<span class="tbm-pill" style="color:'+K.c+';background:'+K.bg+'">'+K.t+'</span></div>'
    +'<div class="tbm-pair"><div class="tbm-box"><div class="bh">시험 '+n+'번</div><div class="bd">'+(img?'<img src="'+htEsc(img)+'" alt="시험 '+n+'번" onclick="htZoom(this.src)">':'<span class="tbm-note">그림 없음</span>')+'</div></div>'
    +'<div class="tbm-box"><div class="bh">'+htEsc(p.pub)+' '+htEsc(x.subject)+' '+htEsc(p.page)+'쪽 '+htEsc(String(p.no||'').replace(/\s*번$/,''))+'번</div><div class="bd">'
    +(p.imgUrl?'<img src="'+htEsc(p.imgUrl)+'" alt="'+htEsc(pbWhere(p))+' 교과서 문항" onclick="htZoom(this.src)">':'<span class="tbm-note">그림 없음</span>')+'</div></div></div>';
  if(cands.length>1){
    h+='<div class="tbm-alts"><span class="tbm-note">함께 나온 곳:</span>';
    cands.forEach(function(q){ h+='<button class="tbm-chip'+(q===p?' on':'')+'" data-k="'+htEsc(q.k)+'" onclick="tbmAct(this,\'sel\')">'+htEsc(pbWhere(q))+' · '+(HT_KIND[q.kind]||HT_KIND.none).t+'</button>'; });
    h+='</div>';
  }
  return h+'<div class="ft"><button class="tbm-btn ok'+(ok?' on':'')+'" data-tbm-act="ok" onclick="tbmAct(this,\'ok\')">✓ 맞음</button>'
    +'<button class="tbm-btn no" data-tbm-act="rej" onclick="tbmAct(this,\'rej\')">✗ 아님</button>'
    +'<button class="tbm-btn" data-tbm-act="hit" onclick="tbmAct(this,\'hit\')">🎯 적중 분석에서 보기</button>'
    +(p.why?'<span class="tbm-note why">AI: '+htEsc(p.why)+'</span>':'')+'</div></div>';
}
function tbmExamView(x){
  var c=tbmCalc(x), d=x.d;
  var h='<div class="tbm-card"><div class="tbm-top"><div style="flex:1;min-width:220px">'
    +'<a href="javascript:void(0)" class="tbm-back" onclick="tbmOpen(\'\')">← 전체 한눈에</a>'
    +'<h2 id="tbm-exam-h">📚 '+htEsc(tbmName(x))+' · '+htEsc(tbmTermLabel(x))+'</h2>'
    +'<div class="tbm-note">'+htEsc(x.subject)+' · '+c.total+'문항 · 교과서 '+c.pubs.length+'종과 비교 · 학교 교과서: '+(c.own.length?'<b style="color:#1d4ed8">'+htEsc(c.own.join('·'))+'</b>':'<b>모름</b> (그 학교·학년 학생에게 배정된 교과서가 없습니다)')+'</div></div>'
    +'<button class="tbm-btn" data-id="'+htEsc(x.id)+'" onclick="tbmToHit(this.getAttribute(\'data-id\'))">🎯 적중 분석에서 보기</button></div>'
    +'<div class="tbm-def">'+TBM_NOTE+'</div>'
    +'<div class="tbm-kpis three">'
    +tbmKpi(c.own.length?(c.ownHit+' / '+c.total):'—', '학교 교과서와 일치한 문항', '#166534')
    +tbmKpi(c.own.length?c.only.length:'—', '학교 교과서엔 없고 <b>다른 출판사</b>에서만', '#c2410c')
    +tbmKpi(c.any+' / '+c.total, '어느 교과서와든 일치한 문항')
    +'</div>';
  /* ① 출판사별 */
  var rows=c.pubs.slice().sort(function(a,b){ return (c.by[b].own?1:0)-(c.by[a].own?1:0) || c.by[b].sv-c.by[a].sv || c.by[b].same-c.by[a].same || a.localeCompare(b,'ko'); });
  h+='<div class="tbm-sec"><h3>① 출판사별 일치 <span class="tbm-note">— 번호를 누르면 그 문항 그림 · 주황 번호 = 학교 교과서엔 없던 문항</span></h3>'
    +'<div class="tbm-scroll"><table class="tbm-t" id="tbm-pubt"><thead><tr><th class="l">출판사</th><th>일치</th><th>같은 문제</th><th>숫자변형</th><th>지문 겹침<br><small>(세지 않음)</small></th><th class="l">시험 문항</th></tr></thead><tbody>';
  rows.forEach(function(pb){
    var r=c.by[pb];
    h+='<tr data-tbm-pub="'+htEsc(pb)+'"'+(TBM.hl===pb?' class="hl"':'')+'><td class="l"><b>'+htEsc(pb)+'</b>'+(r.own?' <small class="tbm-owntag">학교 교과서</small>':'')+'</td>'
      +'<td class="tbm-c '+tbmHeat(r.sv)+(r.own?' own':'')+'">'+(r.sv||'·')+'</td><td>'+(r.same||'·')+'</td><td>'+(r['var']||'·')+'</td><td class="tbm-mut">'+(r.text||'·')+'</td><td class="l">';
    if(r.nos.length) r.nos.forEach(function(o){ h+='<button class="tbm-no'+(c.onlyNo[o.no]?' o':'')+'" data-no="'+htEsc(o.no)+'" onclick="tbmFocus(this.getAttribute(\'data-no\'))">'+o.n+'번</button>'; });
    else h+='<span class="tbm-note">—</span>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div></div>';
  /* 고른 문항 */
  if(TBM.focus!=null){
    var fi=htVisible(d).filter(function(it){ return String(it.no)===String(TBM.focus); })[0];
    if(fi){ var fc=tbmLive(fi);
      h+='<div class="tbm-sec" id="tbm-focus"><h3>🔍 '+htNumOf(d,fi)+'번 — 일치한 교과서 <a href="javascript:void(0)" class="tbm-note" onclick="tbmFocus(null)">닫기 ✕</a></h3>'
        +(fc.length?tbmItemCard(x, fi, fc, 'f'):'<div class="tbm-note">이 문항과 일치한 교과서가 없습니다.</div>')+'</div>'; }
  }
  /* ② 학교 교과서에 없던 문항 */
  h+='<div class="tbm-sec" id="tbm-only"><h3>② 학교 교과서에 없던 문항 <span class="tbm-note">— '+(c.own.length?('다른 출판사에서만 나온 '+c.only.length+'문항'):'학교 교과서를 몰라 셀 수 없습니다')+'</span></h3>';
  if(c.own.length && !c.only.length) h+='<div class="tbm-note">모든 일치 문항이 학교 교과서('+htEsc(c.own.join('·'))+')에도 있습니다.</div>';
  c.only.forEach(function(o){ h+=tbmItemCard(x, o.it, tbmLive(o.it).filter(function(p){ return c.own.indexOf(p.pub)<0; }), ''); });
  return h+'</div></div>';
}

/* ── 동작 ── */
function tbmScrollTo(sel){
  var n=0; (function tick(){ var el=document.querySelector(sel); if(el && el.scrollIntoView){ try{ el.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){ el.scrollIntoView(); } return; }
    if(++n<20) setTimeout(tick, 100); })();
}
window.tbmOpen = function(id, pub){
  TBM.cur=id||''; TBM.hl=pub||''; TBM.focus=null; render();
  try{ var C=document.getElementById('CONTENT'); if(C) C.scrollTop=0; window.scrollTo(0,0); }catch(e){}
  if(pub) tbmScrollTo('#tbm-pubt tr.hl');
};
window.tbmFocus = function(no){ TBM.focus=(no==null||no==='')?null:no; render(); if(TBM.focus!=null) tbmScrollTo('#tbm-focus'); };
window.tbmToHit = function(id, no){
  if(!id) return;
  HT.cur=id; HT.showForm=false;
  try{ if(typeof HTS!=='undefined' && HTS.open){ HTS.open=false; HTS.rejudge=null; } }catch(e){}
  if(no!=null){ if(HT.view==='table') HT.open[no]=true; else { if(!HT.unfold) HT.unfold={}; HT.unfold[no]=true; HT.onlyOpen=false; } }
  var g=(GROUPS||[]).filter(function(x){ return x.key==='exams'; })[0], gi=-1;
  if(g) g.subs.forEach(function(s, j){ if(s.v==='examhit') gi=j; });
  if(gi>=0) subGo('exams', gi); else { VIEW='examhit'; render(); }
  try{ htLoad(id); }catch(e){}
  if(no!=null) tbmScrollTo('#pb-it-'+no);
};
window.tbmAct = function(el, act){
  var q=el && el.closest ? el.closest('.tbm-q') : null; if(!q) return;
  var id=q.getAttribute('data-id'), no=q.getAttribute('data-no'), k=(act==='sel'?el.getAttribute('data-k'):q.getAttribute('data-k'));
  var d=HT.data[id]; if(!d) return;
  var it=(d.items||[]).filter(function(x){ return String(x.no)===String(no); })[0]; if(!it) return;
  if(act==='hit') return tbmToHit(id, it.no);
  if(act==='sel'){ TBM.sel[id+'|'+no]=k; render(); return; }
  if(act==='ok'){ TBM.ok[id+'|'+k]=!TBM.ok[id+'|'+k]; render(); return; }
  if(act==='rej'){
    var p=(it.pub||[]).filter(function(x){ return x.k===k; })[0]; if(!p) return;
    p.rejected=true; delete TBM.sel[id+'|'+no]; delete TBM.ok[id+'|'+k];
    htKvSet('exam_hit_'+id, d).then(function(){ htToast('✗ 아님으로 표시했습니다 — 적중 분석 화면에도 같이 반영됩니다'); render(); })
      .catch(function(e){ delete p.rejected; htToast('저장 실패: '+((e&&e.message)||e)); render(); });
    render();
  }
};

/* ── 오른쪽 도구 칸 ── */
function tbmTools(){
  var L=tbmExams(), S=TBM.cur?L.filter(function(x){ return x.id===TBM.cur; }):L;
  var h='<div class="l3-ttl">이 화면의 도구</div><div class="l3-tool" id="tbm-rec"><b>🎯 다음 시험 대비 추천</b>';
  if(!S.length) h+='<span class="l3-sub">'+(TBM.loading||!TBM.idx?'불러오는 중…':'출판사 비교를 마친 시험이 없습니다.')+'</span>';
  else { h+='<div class="l3-sub" style="line-height:1.7">';
    S.forEach(function(x){ var c=tbmCalc(x), o=c.others.slice(0,2);
      h+='<div data-tbm-rec="'+htEsc(x.id)+'"><b style="color:#0f172a">'+htEsc(tbmName(x))+'</b> — '+(c.own.length?htEsc(c.own.join('·')):'학교 교과서')
        +(o.length?' + <b style="color:#c2410c">'+htEsc(o.join(' · '))+'</b>':'')+'</div>'; });
    h+='</div>'; }
  h+='<button type="button" class="l3-btn" id="tbm-ws" disabled title="준비 중 — 원장 결정 2026-10-12 「대비 학습지는 나중에」" style="opacity:.55;cursor:not-allowed">📄 추천 교과서 문항으로 대비 학습지 <span class="n">준비 중</span></button>'
    +'<span class="l3-sub">학교 교과서 + 자주 나온 다른 출판사 교과서를 함께 보면 좋습니다.</span></div>';
  h+='<div class="l3-tool" id="tbm-chat"><b>📚 출판사 비교 요청은 채팅에서</b><span class="l3-sub">새 시험의 출판사 비교는 서버 AI 비용을 아끼려고 채팅(Claude)에서 돌립니다 — 「○○고 고1 출판사 비교해줘」라고 말씀해 주세요. 끝나면 여기 저절로 보입니다.</span></div>';
  h+='<div class="l3-tool" id="tbm-blog"><b>📝 블로그 자료</b><button type="button" class="l3-btn pri" id="tbm-md" onclick="tbmCopyMd()">📝 블로그 자료(.md) 복사</button>'
    +'<span class="l3-sub">'+(TBM.cur?'이 시험':'분석한 시험 전체')+'의 일치도 요약 — 학생 이름은 들어가지 않습니다.</span></div>';
  return h;
}
RIGHT_TOOLS.tbmatch = function(){ return tbmTools(); };

/* ── 블로그 자료(.md) ── */
function tbmMd(){
  var L=tbmExams(), S=TBM.cur?L.filter(function(x){ return x.id===TBM.cur; }):L;
  var t=['# 교과서일치도 — 학교 시험은 어느 출판사 교과서에서 나왔을까', '', '- '+TBM_NOTE, '- 그 과목의 모든 출판사 교과서와 시험 문항을 한 문항씩 비교했다.', ''];
  S.forEach(function(x){
    var c=tbmCalc(x);
    t.push('## '+tbmName(x)+' '+tbmTermLabel(x)+' ('+x.subject+', '+c.total+'문항)');
    if(c.own.length){
      t.push('- 학교 교과서('+c.own.join('·')+')와 일치: '+c.ownHit+'문항 / '+c.total+'문항');
      t.push('- 학교 교과서엔 없고 다른 출판사 교과서에서만 나온 문항: '+c.only.length+'문항'+(c.only.length?(' — '+c.only.map(function(o){ return o.n+'번('+o.pubs.join('·')+')'; }).join(', ')):''));
    } else t.push('- 학교 교과서 정보 없음 — 어느 교과서와든 일치: '+c.any+'문항 / '+c.total+'문항');
    var R=c.pubs.filter(function(pb){ return c.by[pb].sv>0; }).sort(function(a,b){ return c.by[b].sv-c.by[a].sv || a.localeCompare(b,'ko'); });
    t.push('- 출판사별 일치 문항: '+(R.length?R.map(function(pb){ return pb+' '+c.by[pb].sv; }).join(' · '):'없음'));
    var o=c.others.slice(0,2);
    t.push('- 다음 시험 대비: '+(c.own.length?c.own.join('·'):'학교 교과서')+(o.length?(' + '+o.join(' · ')):'')+' 교과서 문항');
    t.push('');
  });
  t.push('## 정리');
  t.push('- 학교 교과서만 풀면 놓치는 문항이 있다. 같은 과목 다른 출판사 교과서의 비슷한 문항까지 챙기면 대비가 넓어진다.');
  return t.join('\n').replace(/매쓰플랫|수학비서/g, '학원 자료')+'\n';
}
function tbmMdDownload(md){
  try{ var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([md], { type:'text/markdown' })); a.download='교과서일치도.md'; document.body.appendChild(a); a.click(); a.remove();
    htToast('복사가 안 되어 .md 파일로 내려받았습니다'); }catch(e){ htToast('복사 실패: '+((e&&e.message)||e)); }
}
window.tbmCopyMd = function(){
  var md=tbmMd(); TBM.md=md;
  var done=function(){ htToast('📝 블로그 자료(.md)를 복사했습니다 — 블로그 글감에 붙여 넣으세요'); };
  var fallback=function(){
    try{ var ta=document.createElement('textarea'); ta.value=md; ta.style.cssText='position:fixed;left:-9999px;opacity:0'; document.body.appendChild(ta); ta.select();
      var ok=document.execCommand('copy'); document.body.removeChild(ta); if(ok) done(); else tbmMdDownload(md); }catch(e){ tbmMdDownload(md); }
  };
  try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(md).then(done, fallback); return; } }catch(e){}
  fallback();
};

/* ── 왼쪽 (PC) ── */
function tbmLeft(){
  tbmKick();
  var L=tbmExams(), h=l3LeftHead('tbmatch');
  h+='<div class="l3-sec">분석한 시험</div><button type="button" class="l3-lb'+(!TBM.cur?' on':'')+'" data-tbm-left="" onclick="tbmOpen(\'\')"><span>📊 전체 한눈에</span><span class="n">'+L.length+'</span></button>';
  if(!TBM.idx || (TBM.loading && !L.length)) h+='<div class="l3-sec" style="font-weight:700">불러오는 중…</div>';
  else if(!L.length) h+='<div class="l3-sec" style="font-weight:700;letter-spacing:0">아직 출판사 비교를 마친 시험이 없습니다</div>';
  var g='';
  L.forEach(function(x){
    var lb=tbmTermLabel(x), c=tbmCalc(x), on=x.id===TBM.cur;
    if(lb!==g){ g=lb; h+='<div class="l3-sec">'+htEsc(lb)+'</div>'; }
    h+='<button type="button" class="l3-lb'+(on?' on':'')+'" data-tbm-left="'+htEsc(x.id)+'" aria-current="'+(on?'true':'false')+'" onclick="tbmOpen(this.getAttribute(\'data-tbm-left\'))"><span>'+htEsc(tbmName(x))
      +'<small>'+htEsc(x.subject)+(c.own.length?(' · 학교 교과서 '+c.ownHit+'/'+c.total):'')+'</small></span></button>';
  });
  return h+l3CommonFold();
}
perViewLeftNav=(function(o){ return function(v){
  if(v==='tbmatch' && isDesktop()) return tbmLeft();   /* 폰은 가운데 위 칩으로 */
  return o.apply(this, arguments); }; })(perViewLeftNav);

/* ── 가운데 ── */
function rTbMatch(){
  tbmKick();
  var L=tbmExams(), x=null;
  if(TBM.cur){ x=L.filter(function(e){ return e.id===TBM.cur; })[0]||null; if(!x && !TBM.loading && TBM.idx) TBM.cur=''; }
  var h='<div class="tbm-wrap">';
  if(!isDesktop() && L.length){   /* 폰: 왼쪽 목록 대신 칩 */
    h+='<div class="tbm-chips"><button class="tbm-chip'+(!TBM.cur?' on':'')+'" onclick="tbmOpen(\'\')">📊 전체 한눈에</button>';
    L.forEach(function(e){ h+='<button class="tbm-chip'+(e.id===TBM.cur?' on':'')+'" data-id="'+htEsc(e.id)+'" onclick="tbmOpen(this.getAttribute(\'data-id\'))">'+htEsc(tbmName(e))+' · '+htEsc(e.subject)+'</button>'; });
    h+='</div>';
  }
  if(TBM.err) h+='<div class="tbm-card" style="color:#b91c1c;font-weight:800">불러오기 실패: '+htEsc(TBM.err)+'</div>';
  if(!TBM.idx || (TBM.loading && !L.length)) h+='<div class="tbm-card"><h2>📚 교과서일치도</h2><div class="tbm-note">불러오는 중…</div></div>';
  else if(!L.length) h+='<div class="tbm-card"><h2>📚 교과서일치도</h2><div class="tbm-def">'+TBM_NOTE+'</div><div class="tbm-note">아직 출판사 교과서 비교를 마친 시험이 없습니다. 적중 분석을 마친 시험의 출판사 비교는 채팅(Claude)에 요청해 주세요.</div></div>';
  else h+=x?tbmExamView(x):tbmOverview(L);
  var bk=2; try{ bk=l3Bucket(); }catch(e){}
  if(bk<2) h+='<div class="tbm-inline-tools">'+tbmTools()+'</div>';   /* 도구 칸이 없는 폭에서는 아래에 */
  return h+'</div>';
}

/* ── 모양 (시안 docs/mockup_textbook_match.html) ── */
(function(){
  if(document.getElementById('tbm-css')) return;
  var st=document.createElement('style'); st.id='tbm-css';
  st.textContent=''
    +'.tbm-wrap{padding:14px;max-width:1200px;box-sizing:border-box;color:#0f172a;font-size:13px}'
    +'.tbm-wrap *{box-sizing:border-box}'
    +'.tbm-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;min-width:0}'
    +'.tbm-top{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}'
    +'.tbm-wrap h2{margin:0 0 4px;font-size:18px;color:#0d2240}'
    +'.tbm-note{color:#64748b;font-size:12px;font-weight:600}'
    +'.tbm-def{margin-top:8px;display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:800}'
    +'.tbm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}'
    +'.tbm-kpis.three{grid-template-columns:repeat(3,minmax(0,1fr))}'
    +'.tbm-kpi{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fbfdff;min-width:0}'
    +'.tbm-kpi>b{font-size:22px;display:block;font-weight:900}.tbm-kpi span{color:#64748b;font-size:11.5px;font-weight:600}'
    +'@media(max-width:700px){.tbm-kpis,.tbm-kpis.three{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    +'.tbm-sec{margin-top:16px}.tbm-sec h3{font-size:14px;margin:0 0 6px;color:#0d2240}'
    +'.tbm-subj{margin:10px 0 4px;font-size:13px}'
    +'.tbm-scroll{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}'
    +'.tbm-t{border-collapse:collapse;width:100%;font-size:12.5px}'
    +'.tbm-t th,.tbm-t td{padding:7px 6px;text-align:center;border-bottom:1px solid #f1f5f9;white-space:nowrap}'
    +'.tbm-t th{background:#f8fafc;color:#334155;font-weight:800}.tbm-t td.l,.tbm-t th.l{text-align:left}'
    +'.tbm-t td.l{white-space:normal;min-width:120px}'
    +'.tbm-t th small{font-weight:600;color:#94a3b8}'
    +'.tbm-t tr.hl td{background:#fefce8}'
    +'.tbm-t .h0{color:#cbd5e1}.tbm-t .h1{background:#f0fdf4}.tbm-t .h2{background:#bbf7d0}.tbm-t .h3{background:#4ade80;color:#052e16;font-weight:900}.tbm-t .h4{background:#16a34a;color:#fff;font-weight:900}'
    +'.tbm-t td.tbm-c{cursor:pointer;min-width:44px}.tbm-t td.tbm-c:hover{filter:brightness(.95)}'
    +'.tbm-t td.own{outline:2px solid #2563eb;outline-offset:-2px}'
    +'.tbm-t td.tbm-mut{color:#94a3b8}'
    +'.tbm-ownkey{outline:2px solid #2563eb;padding:0 4px}'
    +'.tbm-ex{color:#0d2240;text-decoration:none}.tbm-ex:hover{text-decoration:underline}'
    +'.tbm-only{display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:1px 6px;font-weight:800;font-size:11px}'
    +'.tbm-owntag{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:1px 5px;font-size:10.5px;font-weight:800}'
    +'.tbm-legend{display:flex;gap:6px;align-items:center;font-size:11px;color:#64748b;flex-wrap:wrap;margin-top:6px}.tbm-legend i{display:inline-block;width:18px;height:12px;border-radius:3px}'
    +'.tbm-no{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:6px;padding:2px 6px;margin:1px 3px 1px 0;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}'
    +'.tbm-no.o{border-color:#fed7aa;background:#fff7ed;color:#c2410c}'
    +'.tbm-back{font-size:12px;font-weight:800;color:#1d4ed8;text-decoration:none}'
    +'.tbm-btn{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 10px;font-weight:800;font-family:inherit;font-size:12px;cursor:pointer;color:#0f172a}'
    +'.tbm-btn.ok{color:#166534}.tbm-btn.ok.on{background:#dcfce7;border-color:#86efac}.tbm-btn.no{color:#b91c1c}'
    +'.tbm-q{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;background:#fff}'
    +'.tbm-q.ok{border-color:#86efac}'
    +'.tbm-q>.hd{padding:7px 10px;background:#f8fafc;font-weight:800;font-size:12.5px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}'
    +'.tbm-o{color:#c2410c}.tbm-own-t{color:#1d4ed8}'
    +'.tbm-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:900;white-space:nowrap}'
    +'.tbm-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:8px}'
    +'@media(max-width:700px){.tbm-pair{grid-template-columns:minmax(0,1fr)}}'
    +'.tbm-box{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;min-width:0}'
    +'.tbm-box .bh{padding:6px 10px;background:#f8fafc;font-weight:800;font-size:12px;overflow-wrap:anywhere}'
    +'.tbm-box .bd{padding:8px;min-height:80px;display:flex;align-items:center;justify-content:center}'
    +'.tbm-box .bd img{max-width:100%;display:block;cursor:zoom-in}'
    +'.tbm-alts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:0 8px 6px}'
    +'.tbm-chip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:3px 9px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;color:#334155}'
    +'.tbm-chip.on{background:#0d2240;border-color:#0d2240;color:#fff}'
    +'.tbm-q>.ft{display:flex;gap:6px;padding:0 8px 8px;flex-wrap:wrap;align-items:center}.tbm-q>.ft .why{margin-left:auto}'
    +'.tbm-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}'
    +'.tbm-inline-tools{display:flex;flex-direction:column;gap:10px;margin-top:12px}';
  (document.head||document.documentElement).appendChild(st);
})();
