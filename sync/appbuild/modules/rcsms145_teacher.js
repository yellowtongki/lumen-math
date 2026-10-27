/* ═══════════════════════════════════════════════════════════════════
 * v19-145: 🚑 리커버리 학부모 안내문 — 주간테스트 점수 + 네이버 예약 부탁
 * 원장 2026-10-22 「리커버리 안내문자에 주간테스트 점수포함하고 네이버예약 부탁드린다고 초안작성하자」
 *  (리커버리 › 「학부모 안내문 확인」 rcOpenSms · 「🤖 AI 초안」 rcSmsDraft 를 바꾼다 — 보내지 않고 복사만, 예전과 같음)
 *  ① 기본 글: 주간테스트(문항 수·맞힌 수·점수, 없으면 «최근 학습 점검») · 날짜(예약했으면 그 시간) · 보충 내용 ·
 *     네이버 예약 — 예약이 있으면 «예약 확인했습니다», 없으면 «네이버 예약으로 시간(10:00·11:00·13:00)을 잡아 주세요»
 *     예약 주소를 한 번 넣어 두면(이 PC · rc_nb_url) 예약 부탁 줄 아래에 붙는다.
 *  ② 🤖 AI 초안도 같은 재료(점수·예약 여부·주소)를 받아 쓴다. 말투는 원장님 문자처럼 짧고 담백하게.
 *  ③ 학생마다 「📋 복사」 — 한 분씩 보내기 쉽게. 「전체 복사」는 그대로.
 *  ※ 바탕 함수(rcConfirmed · rcRecDate · nbkRecOf …)는 부르기만 한다. 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
/* v19-146 이 false 로 둔다 — 문자에 시간(배정·네이버 예약 시간·가능 시간)을 넣지 않는다 */
var R145_TIME = (typeof R145_TIME === 'boolean') ? R145_TIME : true;
/* v19-147 이 true 로 둔다 — 주간테스트를 본 날(학생 응시일)을 «주간테스트(10/21 화)»로 넣는다 */
var R145_TDATE = (typeof R145_TDATE === 'boolean') ? R145_TDATE : false;
function r145Md(ymd){ var d=new Date(String(ymd||'')+'T00:00:00'); if(isNaN(d)) return ''; return (d.getMonth()+1)+'/'+d.getDate()+' '+['일','월','화','수','목','금','토'][d.getDay()]; }
function r145Url(){ try{ return String(localStorage.getItem('rc_nb_url')||'').trim(); }catch(e){ return ''; } }
window.r145SetUrl=function(v){
  v=String(v||'').trim();
  if(v && !/^https?:\/\//i.test(v)){ alert('https:// 로 시작하는 주소를 넣어 주세요'); return; }
  try{ if(v) localStorage.setItem('rc_nb_url', v); else localStorage.removeItem('rc_nb_url'); }catch(e){}
  window.rcOpenSms();   /* 새 주소로 글을 다시 만든다 */
};
/* 주간테스트 — {score, detail:'40문항 중 10문항'} 또는 null */
function r145Test(c){
  var t=c && c.row && c.row.testHit;
  if(t && t.score!=null) return { score:t.score, detail:(t.correct!=null && t.total)?(t.total+'문항 중 '+t.correct+'문항'):'', md:R145_TDATE?r145Md(t.date):'', kind:((t.ttype && t.ttype!=='WEEKLY')?'테스트':'주간테스트') };   /* v19-149: 고등부 테스트는 «테스트» */
  if(c && c.score!=null) return { score:c.score, detail:'' };
  return null;
}
/* 그 날 네이버 리커버리 예약 — {start} 또는 null (예약 자료를 아직 안 읽었으면 null) */
function r145Book(c, recDt){
  try{ if(typeof nbkRecOf==='function' && typeof nbkHas==='function' && nbkHas()) return nbkRecOf(c.k, recDt); }catch(e){}
  return null;
}
function r145Parts(c){
  var wk=rcWeekKey(), dt=rcRecDate(wk), d=new Date(dt);
  var day=(d.getMonth()+1)+'월 '+d.getDate()+'일('+rcDayLabel(dt)+')';
  var b=r145Book(c, dt), slot=R145_TIME ? ((b && b.start) || (c.e && c.e.slot) || '') : '';
  var rx=(c.rx && c.rx.length && c.rx[0]!=='원장님 직접 지정')?c.rx[0]:'';
  var units=(c.e && c.e.snap && c.e.snap.units)?c.e.snap.units.map(function(u){ return u.n; }).slice(0,3):[];
  return { day:day, when:day+(slot?' '+slot:''), booked:!!b, bookAt:(b && b.start)||'', test:r145Test(c), rx:rx, units:units, slots:R145_TIME ? (RC.cfg.slots||[]).slice() : [], url:r145Url() };
}
/* v19-148 이 true 로 둔다 — 원장님 문자 모양: 「안녕하세요,」 · 빈 줄 · «길동이가» · … · 빈 줄 · 「감사합니다.」 */
var R145_NICK = (typeof R145_NICK === 'boolean') ? R145_NICK : false;
/* 이름 부르기 — 성을 빼고(세 글자 이상) 받침 있으면 «이가», 없으면 «가» : 홍길동 → 길동이가 · 박하나 → 하나가 */
function r145Nick(name){
  var n=String(name||'').replace(/\s/g,''); var g=(n.length>=3)?n.slice(1):n;
  var ch=g.charCodeAt(g.length-1), bat=(ch>=0xAC00 && ch<=0xD7A3) ? ((ch-0xAC00)%28!==0) : false;
  return g+(bat?'이가':'가');
}
window.r145Nick=r145Nick;
function r145Text(c){
  var p=r145Parts(c), L=[];
  if(R145_NICK){ L.push('[루멘수학] 안녕하세요,'); L.push(''); L.push(r145Nick(c.name)); }
  else L.push('[루멘수학] 안녕하세요, '+c.name+' 학생 학부모님.');
  var why;
  if(p.test) why='이번 주 '+(p.test.kind||'주간테스트')+(p.test.md?('('+p.test.md+')'):'')+'에서 '+(p.test.detail?(p.test.detail+'을 맞혀 '+p.test.score+'점'):(p.test.score+'점'))+'이 나와';
  else why='최근 학습 점검에서 보완이 필요한 단원이 있어';
  L.push(why+' '+p.when+' 리커버리 보충수업을 하려고 합니다.');
  if(p.rx) L.push('보충 내용: '+p.rx+'.');
  if(p.booked) L.push(R145_TIME ? ('네이버 예약('+p.bookAt+')은 확인했습니다. 시간 맞춰 보내 주세요.') : '네이버 예약은 확인했습니다. 예약하신 시간에 맞춰 보내 주세요.');
  else {
    L.push('네이버 예약으로 편하신 시간'+(p.slots.length?'('+p.slots.join(' · ')+')':'')+'을 잡아 주시면 감사하겠습니다.');
    if(p.url) L.push('예약: '+p.url);
  }
  if(R145_NICK) L.push('');
  L.push('감사합니다.');
  return L.join('\n');
}
window.r145Copy=function(i){
  var ta=document.getElementById('rc-sms-'+i); if(!ta || !ta.value.trim()) return;
  try{ navigator.clipboard.writeText(ta.value.trim()); }catch(e){}
  var b=document.getElementById('r145-cp-'+i); if(b){ b.textContent='✓ 복사됨'; setTimeout(function(){ b.textContent='📋 복사'; }, 1500); }
};
window.rcOpenSms=function(){
  var list=rcConfirmed().filter(function(c){ return !(c.e&&c.e.done); });
  if(!list.length){ alert('호출 확정된 학생이 없습니다.'); return; }
  var url=r145Url();
  var h=rcPopHead('📨 학부모 안내문 확인 · 수정 후 복사');
  h+='<div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-bottom:10px">보내지는 것이 아니라 <b style="color:#b45309">복사만</b> 됩니다 — 원장님이 문자앱에 붙여넣어 발송 · 주간테스트 점수와 네이버 예약이 들어갑니다</div>';
  h+='<div id="r145-url" style="display:flex;gap:7px;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 10px;margin-bottom:12px;font-size:11.5px;font-weight:800;color:#166534">'
    +'<span style="flex:none">🟢 네이버 예약 주소</span>'
    +'<input id="r145-url-in" value="'+esc2(url)+'" placeholder="넣으면 «예약 부탁» 줄 아래에 붙어요 (이 PC 에 기억)" style="flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:7px;padding:5px 8px;font-family:inherit;font-size:11.5px">'
    +'<button onclick="r145SetUrl(document.getElementById(\'r145-url-in\').value)" style="flex:none;border:none;border-radius:7px;background:#16a34a;color:#fff;font-family:inherit;font-size:11px;font-weight:800;padding:5px 10px;cursor:pointer">넣기</button></div>';
  list.forEach(function(c,i){
    var p=r145Parts(c), txt=r145Text(c);
    var tag=p.booked?'<span style="font-size:10.5px;font-weight:800;color:#15803d;background:#dcfce7;border-radius:50px;padding:2px 8px">✓ 네이버 예약 '+esc2(p.bookAt)+'</span>'
                    :'<span style="font-size:10.5px;font-weight:800;color:#b45309;background:#fef3c7;border-radius:50px;padding:2px 8px">예약 아직</span>';
    h+='<div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:9px">';
    h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap"><span style="font-size:11px;font-weight:900;color:#7c3aed">'+esc2(c.name)+' 학부모님 · '+esc2(p.when)+'</span>'+tag;
    h+='<button id="r145-cp-'+i+'" onclick="r145Copy('+i+')" style="margin-left:auto;border:1.5px solid #cbd5e1;background:#fff;color:#334155;font-family:inherit;font-size:10.5px;font-weight:800;padding:4px 11px;border-radius:50px;cursor:pointer">📋 복사</button>';
    h+='<button id="rc-smsbtn-'+i+'" onclick="rcSmsDraft('+i+',\''+esc2(c.k).replace(/'/g,'')+'\')" style="border:1.5px solid #ddd6fe;background:#faf5ff;color:#6d28d9;font-family:inherit;font-size:10.5px;font-weight:800;padding:4px 11px;border-radius:50px;cursor:pointer">🤖 AI 초안</button></div>';
    h+='<textarea id="rc-sms-'+i+'" style="width:100%;border:none;font-family:inherit;font-size:12.5px;line-height:1.75;color:#334155;resize:vertical;min-height:132px;font-weight:600;outline:none">'+esc2(txt)+'</textarea>';
    h+='</div>';
  });
  h+='<button onclick="rcCopyAllSms('+list.length+')" style="border:none;border-radius:10px;padding:11px 14px;font-family:inherit;font-size:13.5px;font-weight:900;cursor:pointer;width:100%;background:#ffd54a;color:#0d2240">📋 전체 복사 ('+list.length+'명분)</button>';
  rcPopShow(h);
};
window.rcSmsDraft=async function(i,k){
  var apiKey=localStorage.getItem('or_api_key');
  if(!apiKey){ alert('설정에 Claude API 키(or_api_key)가 필요합니다.'); return; }
  if(RC.smsBusy[i]) return;
  var c=rcConfirmed().find(function(x){ return String(x.k)===String(k); });
  var ta=document.getElementById('rc-sms-'+i), btn=document.getElementById('rc-smsbtn-'+i);
  if(!c||!ta) return;
  RC.smsBusy[i]=true; if(btn){ btn.textContent='⏳ 작성 중…'; btn.disabled=true; }
  try{
    var p=r145Parts(c);
    var prompt='한국 수학학원 원장이 학부모께 보내는 주말 리커버리(보충수업) 안내 문자를 써 줘.\n'
      +'- 학생: '+c.name+' / 보충 날짜: '+p.when+'\n'
      +(p.test?('- 이번 주 '+(p.test.kind||'주간테스트')+(p.test.md?('(본 날 '+p.test.md+')'):'')+': '+(p.test.detail?(p.test.detail+' 맞힘, '):'')+p.test.score+'점\n'):'- 주간테스트 점수 없음(최근 학습 점검으로 부름)\n')
      +(p.units.length?('- 보완할 단원·유형: '+p.units.join(', ')+'\n'):'')
      +(p.rx?('- 보충 내용: '+p.rx+'\n'):'')
      +(p.booked?(R145_TIME?('- 네이버 예약: 이미 '+p.bookAt+' 로 예약함 → 예약 확인했다고 짧게\n'):'- 네이버 예약: 이미 예약함 → 예약 확인했다고 짧게(시간은 쓰지 말 것)\n')
                :('- 네이버 예약: 아직 없음 → 네이버 예약으로 시간을 잡아 달라고 부탁'+(p.slots.length?(' (가능 시간 '+p.slots.join(', ')+')'):'')+'\n'
                  +(p.url?('- 예약 주소(그대로 한 줄로 넣기): '+p.url+'\n'):'')))
      +(R145_TIME?'':'- 시간(몇 시)은 문자에 쓰지 말 것 — 날짜만\n')
      +(R145_NICK?('- 모양(꼭 이대로): 첫 줄 「[루멘수학] 안녕하세요,」 · 빈 줄 · 「'+r145Nick(c.name)+'」 한 줄 · 이어서 «이번 주 주간테스트…» 문장 · 보충 내용 · 예약 줄 · 빈 줄 · 「감사합니다.」\n'):'')
      +'규칙: [루멘수학]으로 시작. 주간테스트 점수가 있으면 반드시 그대로 넣기(숫자 바꾸지 말 것). 4~5줄, 줄마다 한 문장. '
      +'원장이 직접 쓴 것처럼 짧고 담백하게 — 과한 인사·감탄·「함께 성장」 같은 상투어 금지. 아이를 탓하지 않는다. '+(R145_TIME?'날짜·시간을 정확히. ':'날짜를 정확히. ')+'「감사합니다.」로 끝. 문자 본문만 출력.';
    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{ 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:600, messages:[{role:'user',content:prompt}] })
    });
    if(!resp.ok) throw new Error('생성 오류 '+resp.status);
    var json=await resp.json();
    var out=(json.content||[]).map(function(x){ return x.text||''; }).join('').trim();
    if(out) ta.value=out;
  }catch(e){ alert('AI 초안 실패: '+e.message); }
  RC.smsBusy[i]=false; if(btn){ btn.textContent='🤖 AI 초안'; btn.disabled=false; }
};
