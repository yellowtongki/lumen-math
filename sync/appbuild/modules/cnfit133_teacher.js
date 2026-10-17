/* ═══ v19-133: 📰 카드뉴스 내려받기 — 그림이 칸에 맞춰 «늘어나는» 문제 고침 ═══
 *  원장 2026-10-17 「카드뉴스가 다운받으면 기출부분이 이렇게 늘려서 보인다」 (범박고 고1 18번 — 지금 스타일 카드)
 *  까닭: 카드 그림을 만드는 html2canvas 가 CSS «object-fit: contain»(비율 유지)을 모른다 → 그림을 칸 크기로 잡아 늘린다.
 *        화면에서는 브라우저가 비율을 지켜 줘서 멀쩡해 보였다.
 *  고침: html2canvas 가 그리기 직전에, 카드 안 그림(object-fit 이 contain/cover 인 것)을 «칸과 같은 비율의 그림»으로
 *        미리 다시 그려 끼운다(비율 유지 · object-position 위치 그대로 · 여백은 투명). 칸 비율 = 그림 비율이라 늘어날 일이 없다.
 *        html2canvas 를 쓰는 모든 내려받기(지금 스타일 .zip · 새 스타일 .zip · 블로그 폴더)에 같이 적용된다.
 *  화면 카드·저장 자료는 그대로.
 */
function cn133Pos(v, free){   /* object-position 한 축 → 0~1 */
  v=String(v||'50%').trim();
  if(v==='left'||v==='top') return 0; if(v==='right'||v==='bottom') return 1; if(v==='center') return 0.5;
  if(/%$/.test(v)) return Math.max(0, Math.min(1, parseFloat(v)/100));
  if(/px$/.test(v)) return free>0 ? Math.max(0, Math.min(1, parseFloat(v)/free)) : 0;
  return 0.5;
}
function cn133Wait(im){ return new Promise(function(r){ if(im.complete && im.naturalWidth) return r(); im.addEventListener('load', function(){ r(); }, { once:true }); im.addEventListener('error', function(){ r(); }, { once:true }); setTimeout(r, 3000); }); }
async function cn133Bake(root){
  if(!root || !root.querySelectorAll) return 0;
  var imgs=root.querySelectorAll('img'), n=0;
  for(var i=0;i<imgs.length;i++){
    var im=imgs[i]; if(im.getAttribute('data-cn133')) continue;
    await cn133Wait(im);
    var nw=im.naturalWidth, nh=im.naturalHeight; if(!nw||!nh) continue;
    var view=im.ownerDocument.defaultView||window, cs=view.getComputedStyle(im), fit=cs.objectFit;
    if(fit!=='contain' && fit!=='cover' && fit!=='scale-down') continue;
    var bw=im.clientWidth, bh=im.clientHeight; if(bw<2||bh<2) continue;
    var k = fit==='cover' ? Math.max(bw/nw, bh/nh) : Math.min(bw/nw, bh/nh); if(fit==='scale-down') k=Math.min(1, k);
    var dw=nw*k, dh=nh*k, pp=String(cs.objectPosition||'50% 50%').split(/\s+/);
    var dx=(bw-dw)*cn133Pos(pp[0], bw-dw), dy=(bh-dh)*cn133Pos(pp[1]||'50%', bh-dh);
    var s=Math.max(1, Math.min(3, nw/Math.max(1,dw)));   /* 원본이 크면 그만큼 선명하게 (최대 3배) */
    var cv=im.ownerDocument.createElement('canvas'); cv.width=Math.round(bw*s); cv.height=Math.round(bh*s);
    var g=cv.getContext('2d'); g.imageSmoothingEnabled=true; try{ g.imageSmoothingQuality='high'; }catch(e){}
    try{
      g.drawImage(im, dx*s, dy*s, dw*s, dh*s);
      var du=cv.toDataURL('image/png');   /* 다른 서버 그림이라 막히면(오염) 여기서 오류 → 그대로 둠 */
      im.setAttribute('data-cn133', '1'); im.style.objectFit='fill'; im.style.width=bw+'px'; im.style.height=bh+'px'; im.style.flex='0 0 auto';
      im.src=du; await cn133Wait(im); n++;
    }catch(e){}
  }
  return n;
}
window.cn133Bake=cn133Bake;
function cn133Wrap(fn){
  if(typeof fn!=='function' || fn.__cn133) return fn;
  var w=function(el, opts){ var self=this, a=arguments; return cn133Bake(el).catch(function(){}).then(function(){ return fn.apply(self, a); }); };
  w.__cn133=true; w.__orig=fn; return w;
}
/* html2canvas 는 내려받기 때 늦게 불러온다 → 들어오는 순간 감싼다 */
(function(){
  var cur=cn133Wrap(window.html2canvas);
  try{
    Object.defineProperty(window, 'html2canvas', { configurable:true, enumerable:true,
      get:function(){ return cur; }, set:function(v){ cur=cn133Wrap(v); } });
  }catch(e){ if(cur) window.html2canvas=cur; }
})();
