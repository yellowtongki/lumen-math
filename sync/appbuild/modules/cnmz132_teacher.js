/* ═══ v19-132: 🧩 모자이크 창 — ① 오른쪽에 «참고 그림»(반대쪽 그림: 시험 ↔ 우리 자료) ② 🤖 자동 상자 «숫자만 / 식 / 둘 다» ═══
 *  원장 2026-10-17 「모자이크 작업 할 때 오른쪽에는 숫자변형한 우리 교재가 보이면 가리기 편할 것 같다.
 *                   아니면 숫자만 모자이크 하기, 식 모자이크 하기, 둘 다 모자이크 하기 기능이 있으면 좋겠다」
 *
 *  ① 참고 그림: 시험 문항을 가릴 때는 오른쪽에 우리 자료(숫자변형 문제)를, 우리 자료를 가릴 때는 시험 문항을 보여 준다.
 *     보기만 한다(그 그림에 그린 상자가 있으면 가린 모습으로). 화면이 좁으면 아래로 내려간다. 「참고 그림 숨기기」로 끌 수 있다.
 *  ② 자동 상자 (원장님 Claude 키 or_api_key 사용 · 그림 1장 = 요청 1번):
 *     a. 브라우저가 그림에서 글자 덩어리(줄 → 띄어쓰기 단위)를 찾는다 — 상자 위치는 이 계산으로 정확히 잡는다
 *     b. 덩어리마다 번호를 붙인 그림을 Claude 에게 보내 «어느 번호가 숫자 / 수식인지 + 수식 글자»만 묻는다
 *     c. 숫자만: 숫자 덩어리 + 수식 안의 숫자 글자(글자 수가 맞으면 그 글자만, 안 맞으면 수식 통째로 — 덜 가리는 것보다 낫게)
 *        식: 수식 덩어리 통째로 · 둘 다: 숫자 덩어리 + 수식 덩어리
 *     d. 상자는 «초안»으로 들어간다 — 원장님이 보고 되돌리기·모두 지우기·직접 더 그리기 후 「저장」 (저장 전에는 카드에 안 들어감)
 *     문항 번호(맨 앞 큰 숫자)·배점은 빼도록 요청한다.
 *  저장 모양은 그대로 (card.mosaic[file].exam|mat = [{x,y,w,h}] 0~1)
 */
var CN132 = { refOff:false, busy:false, last:null };
try{ CN132.refOff = localStorage.getItem('cn132_ref')==='off'; }catch(e){}
var CN132_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-4-6'];

/* ── ① 참고 그림 ── */
function cn132Other(s){ return s ? (s.which==='exam' ? 'mat' : 'exam') : 'mat'; }
function cn132RefSrc(s){
  var w=cn132Other(s), url=s.urls[w]; if(!url) return '';
  var rs=(s.rects&&s.rects[w])||[];
  if(rs.length){ var k=cn3MzKey(url, rs), c=CN3.mzCache[k]; if(c && c!=='busy' && c!=='fail') return c; if(!c) cn3MzMake(url, rs).then(function(){ var im=document.getElementById('cn132-refimg'); if(im && CN3.mzCache[k] && CN3.mzCache[k]!=='fail') im.src=CN3.mzCache[k]; }); }
  return url;
}
window.cn132RefToggle=function(){ CN132.refOff=!CN132.refOff; try{ localStorage.setItem('cn132_ref', CN132.refOff?'off':'on'); }catch(e){} cn3MzBuild(); };
window.cn132SetMsg=function(m, bad){ var s=CN3.mz; if(!s) return; s.aiMsg=m; s.aiBad=!!bad; var el=document.getElementById('cn132-msg'); if(el){ el.textContent=m; el.style.color=bad?'#b91c1c':'#1d4ed8'; } };

cn3MzBuild=(function(o){ return function(){
  o.apply(this, arguments);
  var s=CN3.mz, box=document.getElementById('cn3-mz'); if(!s||!box) return;
  var inner=box.querySelector('.cn3-mzin'), cvw=box.querySelector('.cn3-cvw'), tabs=box.querySelector('.cn3-mzt'); if(!inner||!cvw) return;
  var ow=cn132Other(s), hasRef=!!s.urls[ow], E=cnEsc;
  /* 🤖 자동 상자 줄 */
  var ai=document.createElement('div'); ai.className='cn3-mzt cn132-ai'; ai.id='cn132-ai';
  ai.innerHTML='<span class="ht-sub" style="font-weight:900;color:#0d2240">🤖 자동 상자</span>'
    +'<button class="cn-chip" data-cn132="num" onclick="cn132Auto(\'num\')"'+(CN132.busy?' disabled':'')+'>숫자만</button>'
    +'<button class="cn-chip" data-cn132="expr" onclick="cn132Auto(\'expr\')"'+(CN132.busy?' disabled':'')+'>식</button>'
    +'<button class="cn-chip" data-cn132="both" onclick="cn132Auto(\'both\')"'+(CN132.busy?' disabled':'')+'>둘 다</button>'
    +'<span class="ht-sub" id="cn132-msg" style="font-weight:800;color:'+(s.aiBad?'#b91c1c':'#1d4ed8')+'">'+E(s.aiMsg||'이 그림에서 숫자·식을 찾아 상자 초안을 넣습니다 (저장 전 확인)')+'</span>'
    +(hasRef?'<button class="cn-chip" data-cn132="ref" style="margin-left:auto" onclick="cn132RefToggle()">'+(CN132.refOff?'참고 그림 보기':'참고 그림 숨기기')+'</button>':'');
  if(tabs && tabs.nextSibling) inner.insertBefore(ai, tabs.nextSibling); else inner.appendChild(ai);
  /* 참고 그림 */
  if(hasRef && !CN132.refOff){
    var two=document.createElement('div'); two.className='cn132-two'; two.id='cn132-two';
    cvw.parentNode.insertBefore(two, cvw); two.appendChild(cvw);
    var ref=document.createElement('div'); ref.className='cn132-ref';
    var cap = ow==='mat' ? ('참고 — '+(s.kname||'우리 자료')+' (보기만)') : ('참고 — 시험 문항 '+s.n+'번 (보기만)');
    ref.innerHTML='<div class="cn132-cap">'+E(cap)+'</div><img id="cn132-refimg" alt="'+E(cap)+'" src="'+E(cn132RefSrc(s))+'">';
    two.appendChild(ref);
    inner.classList.add('cn132-wide');
  } else inner.classList.remove('cn132-wide');
  cn3MzDraw();
}; })(cn3MzBuild);

/* 왼쪽 칸 넓이에 맞춰 그림 크기 다시 맞추기 */
cn3MzDraw=(function(o){ return function(){
  o.apply(this, arguments);
  var s=CN3.mz, cv=document.getElementById('cn3-cv'); if(!s||!cv||!s.im) return;
  var two=document.getElementById('cn132-two'); if(!two) return;
  var col=cv.parentNode; var avail=Math.max(200, (col.clientWidth||0)-12); var W=s.im.naturalWidth||1, H=s.im.naturalHeight||1;
  var mh=Math.max(240, (window.innerHeight||800)*0.62), k=Math.min(1, avail/W, mh/H);
  cv.style.width=Math.round(W*k)+'px'; cv.style.height=Math.round(H*k)+'px';
}; })(cn3MzDraw);

/* ── ② 글자 덩어리 찾기 (브라우저 계산) ── */
function cn132Segment(im){
  var W0=im.naturalWidth||1, H0=im.naturalHeight||1, sc=Math.min(1, 1600/Math.max(W0,H0));
  var W=Math.max(1,Math.round(W0*sc)), H=Math.max(1,Math.round(H0*sc));
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.drawImage(im,0,0,W,H);
  var px=g.getImageData(0,0,W,H).data, ink=new Uint8Array(W*H);
  for(var i=0,j=0;i<px.length;i+=4,j++){ var l=0.299*px[i]+0.587*px[i+1]+0.114*px[i+2]; ink[j]=l<150?1:0; }
  var rowInk=new Int32Array(H); for(var y=0;y<H;y++){ var c=0, b=y*W; for(var x=0;x<W;x++) c+=ink[b+x]; rowInk[y]=c; }
  /* 줄 */
  var lines=[], y0=-1, gap=0;
  for(y=0;y<=H;y++){ var on=y<H && rowInk[y]>0;
    if(on){ if(y0<0) y0=y; gap=0; }
    else if(y0>=0){ gap++; if(gap>2 || y===H){ var y1=y-gap; if(y1-y0>=2) lines.push([y0,y1]); y0=-1; gap=0; } } }
  var boxes=[];
  function cols(ly0, ly1, xa, xb){ var a=new Int32Array(xb-xa+1); for(var yy=ly0;yy<=ly1;yy++){ var bb=yy*W; for(var xx=xa;xx<=xb;xx++) a[xx-xa]+=ink[bb+xx]; } return a; }
  function runs(a, minGap, off){ var out=[], s0=-1, gp=0; for(var k=0;k<=a.length;k++){ var on2=k<a.length && a[k]>0;
      if(on2){ if(s0<0) s0=k; gp=0; } else if(s0>=0){ gp++; if(gp>=minGap || k===a.length){ out.push([s0+off, k-gp+off]); s0=-1; gp=0; } } } return out; }
  lines.forEach(function(L){
    var lh=L[1]-L[0]+1, a=cols(L[0], L[1], 0, W-1);
    var thr=Math.max(3, Math.round(lh*0.30));
    runs(a, thr, 0).forEach(function(r){
      /* 덩어리 위아래를 잉크에 맞게 */
      var t=L[1], btm=L[0]; for(var yy=L[0];yy<=L[1];yy++){ var bb=yy*W, any=false; for(var xx=r[0];xx<=r[1];xx++){ if(ink[bb+xx]){ any=true; break; } } if(any){ if(yy<t) t=yy; if(yy>btm) btm=yy; } }
      if((r[1]-r[0]+1)*(btm-t+1)<12) return;
      var ga=cols(t, btm, r[0], r[1]), glyphs=runs(ga, 1, r[0]);
      boxes.push({ x0:r[0], x1:r[1], y0:t, y1:btm, lh:lh, glyphs:glyphs });
    });
  });
  boxes.forEach(function(b, i){ b.id=i+1; });
  return { W:W, H:H, sc:sc, boxes:boxes };
}
/* 번호 붙인 그림 (Claude 에게 보낼 것) */
function cn132Marked(im, seg){
  var W=seg.W, H=seg.H, pad=0, cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.drawImage(im,0,0,W,H);
  var fs=Math.max(11, Math.min(18, Math.round(W/70)));
  g.lineWidth=Math.max(1, Math.round(W/900));
  seg.boxes.forEach(function(b){
    g.strokeStyle='rgba(220,38,38,.85)'; g.strokeRect(b.x0-1.5, b.y0-1.5, b.x1-b.x0+3, b.y1-b.y0+3);
    var t=String(b.id); g.font='bold '+fs+'px sans-serif'; var tw=g.measureText(t).width+4;
    var ly=Math.max(0, b.y0-fs-2); g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(b.x0-1, ly, tw, fs+2); g.fillStyle='#dc2626'; g.fillText(t, b.x0+1, ly+fs-1);
  });
  return cv.toDataURL('image/jpeg', 0.88);
}
var CN132_PROMPT = '이 그림은 수학 문제입니다. 글자 덩어리마다 빨간 상자와 빨간 번호가 붙어 있습니다.\n'
  +'숫자나 수식이 들어 있는 상자만 골라 JSON 으로만 답하세요(설명·마크다운 없이):\n'
  +'{"items":[{"id":번호,"kind":"num 또는 expr","t":"상자 안 글자 그대로(띄어쓰기 없이)"}]}\n'
  +'- num: 숫자만 있는 상자 (정수·음수·소수·분수 예: 3, -5, 0.2, 1/2)\n'
  +'- expr: 문자·기호가 섞인 수식 (예: A(-3,-5), x^2+1, k:(1-k), 0<k<1). 숫자가 들어 있어도 문자·기호가 있으면 expr\n'
  +'- 한글 낱말, 문장부호만 있는 상자, 맨 앞의 문항 번호(예: 22), 배점([4점])은 넣지 마세요\n'
  +'- t 는 보이는 순서대로 한 글자씩 적으세요(위첨자 2 는 ^2 대신 2 로, 분수는 위 숫자 다음 아래 숫자). 확실하지 않으면 t 를 비워 두세요';

async function cn132Ask(dataUrl){
  var key=''; try{ key=localStorage.getItem('or_api_key')||''; }catch(e){}
  if(!key) throw new Error('Claude 키가 없습니다 — 왼쪽 위 «AI 피드백» 칸에 Claude 키를 등록해 주세요');
  var b64=String(dataUrl).split(',')[1], last='';
  for(var i=0;i<CN132_MODELS.length;i++){
    var r=await fetch('https://api.anthropic.com/v1/messages', { method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model:CN132_MODELS[i], max_tokens:2500, messages:[{ role:'user', content:[
        { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } }, { type:'text', text:CN132_PROMPT } ] }] }) });
    if(r.ok){ var j=await r.json(); var txt=(j.content||[]).map(function(c){ return c.text||''; }).join(''); var m=txt.replace(/```json|```/g,'').match(/\{[\s\S]*\}/);
      if(!m) throw new Error('AI 답을 읽지 못했습니다'); return JSON.parse(m[0]); }
    last=r.status; if(r.status!==404 && r.status!==400) break;   /* 모델 없음(404/400)만 다음 모델로 */
  }
  throw new Error('AI 요청 실패 ('+last+')');
}
/* 수식 안 숫자 글자만 → 상자 (글자 수가 맞을 때만, 아니면 null) */
function cn132DigitBoxes(b, t){
  var ch=String(t||'').replace(/\s+/g,'').replace(/\^/g,'').split('');
  if(!ch.length || ch.length!==b.glyphs.length) return null;
  var out=[], cur=null;
  ch.forEach(function(c, i){ var g=b.glyphs[i], dig=/[0-9.]/.test(c);
    if(dig){ if(cur && cur.i===i-1){ cur.x1=g[1]; cur.i=i; } else { cur={ x0:g[0], x1:g[1], i:i }; out.push(cur); } } else cur=null; });
  return out.map(function(q){ return { x0:q.x0, x1:q.x1, y0:b.y0, y1:b.y1 }; });
}
function cn132Pick(seg, items, mode){
  var by={}; seg.boxes.forEach(function(b){ by[b.id]=b; });
  var out=[], whole=0, part=0;
  (items||[]).forEach(function(it){ var b=by[Number(it.id)]; if(!b) return; var k=it.kind;
    if(mode==='expr'){ if(k==='expr') out.push(b); return; }
    if(mode==='both'){ if(k==='expr'||k==='num') out.push(b); return; }
    if(k==='num'){ out.push(b); return; }
    if(k==='expr'){ var d=cn132DigitBoxes(b, it.t); if(d){ if(d.length){ part++; d.forEach(function(q){ out.push(q); }); } } else { whole++; out.push(b); } } });
  return { rects:out, whole:whole, part:part };
}
function cn132ToRects(seg, list){
  var p=Math.max(2, Math.round(seg.W/400));
  return list.map(function(b){ var x0=Math.max(0,b.x0-p), y0=Math.max(0,b.y0-p), x1=Math.min(seg.W-1,b.x1+p), y1=Math.min(seg.H-1,b.y1+p);
    return { x:cn3R4(x0/seg.W), y:cn3R4(y0/seg.H), w:cn3R4((x1-x0+1)/seg.W), h:cn3R4((y1-y0+1)/seg.H) }; });
}
window.cn132Auto=async function(mode){
  var s=CN3.mz; if(!s || CN132.busy) return;
  if(!s.im){ cn132SetMsg('그림을 아직 못 받았습니다', true); return; }
  if(s.taint){ cn132SetMsg('이 그림은 원본 서버 설정 때문에 자동 상자를 쓸 수 없습니다 — 직접 그려 주세요', true); return; }
  var name={ num:'숫자만', expr:'식', both:'둘 다' }[mode]||mode, which=s.which, seq=s.seq;
  CN132.busy=true; cn132SetMsg('🤖 '+name+' 찾는 중… (10~30초)'); cn3MzBuild();
  try{
    var seg=cn132Segment(s.im); CN132.last={ seg:seg };
    if(!seg.boxes.length) throw new Error('그림에서 글자를 찾지 못했습니다');
    var ans=(typeof window.cn132AskHook==='function') ? await window.cn132AskHook(seg) : await cn132Ask(cn132Marked(s.im, seg));
    CN132.last.ans=ans;
    if(!CN3.mz || CN3.mz!==s || s.which!==which || s.seq!==seq){ return; }   /* 그새 다른 그림으로 바뀜 */
    var pk=cn132Pick(seg, ans&&ans.items, mode), R=cn132ToRects(seg, pk.rects);
    var have=cn3MzCur(), key=function(q){ return [q.x,q.y,q.w,q.h].join(','); }, seen={}; have.forEach(function(q){ seen[key(q)]=1; });
    var add=0; R.forEach(function(q){ if(!seen[key(q)]){ have.push(q); seen[key(q)]=1; add++; } });
    if(add){ s.dirty=true; s.msg=''; }
    cn132SetMsg(add ? ('🤖 '+name+' 상자 '+add+'개를 넣었습니다'+(pk.whole?(' (수식 '+pk.whole+'개는 통째로)'):'')+' — 확인하고 「저장」') : ('🤖 '+name+' — 가릴 것을 찾지 못했습니다'), !add);
  }catch(e){ cn132SetMsg('🤖 '+(e && e.message || e), true); }
  finally{ CN132.busy=false; if(CN3.mz) cn3MzBuild(); }
};
/* 탭을 바꾸면 안내 줄 초기화 */
if(typeof window.cn3MzTab==='function') window.cn3MzTab=(function(o){ return function(){ if(CN3.mz){ CN3.mz.aiMsg=''; CN3.mz.aiBad=false; } return o.apply(this, arguments); }; })(window.cn3MzTab);

/* CSS */
var CN132_CSS=''
  +'.cn3-mzin.cn132-wide{max-width:min(1400px,100%)}'
  +'.cn132-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}'
  +'.cn132-two .cn3-cvw{min-width:0}'
  +'.cn132-ref{background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;padding:6px;min-width:0}'
  +'.cn132-ref img{display:block;max-width:100%;max-height:62vh;margin:0 auto;background:#fff}'
  +'.cn132-cap{font-size:12px;font-weight:900;color:#1d4ed8;margin:0 0 4px}'
  +'.cn132-ai .cn-chip[disabled]{opacity:.5;cursor:wait}'
  +'@media (max-width:900px){.cn132-two{grid-template-columns:1fr}}';
cn2EnsureCss=(function(o){ return function(){ o(); var st=document.getElementById('cn2-css'); if(st && !st.getAttribute('data-cn132')){ st.textContent+=CN132_CSS; st.setAttribute('data-cn132','1'); } }; })(cn2EnsureCss);
