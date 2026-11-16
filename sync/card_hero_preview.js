#!/usr/bin/env node
/**
 * sync/card_hero_preview.js — 「표지(hero)」 카드 시안 만들기
 *
 *   node sync/card_hero_preview.js <나올 파일.png>
 *
 * 2026-11-16, 원장님이 보내주신 다른 학원 카드(폴리아에듀 풍)를 보고 만든 표지 시안이다.
 * 두꺼운 입체 글자(흰색 → 금색 → 흰색) · 빨간 붓터치 · 떠다니는 수식 · 금색 알약 ·
 * 배경은 글 폴더의 그림.
 *
 * ⚠️ 아직 카드 생성기에 넣지 않았다. 원장님이 「확정」하시면
 *    sync/card_templates/hero.html + _base.css 로 옮겨서
 *    cards.json 에 "type": "hero" 로 쓸 수 있게 한다.
 *    그때까지는 이 파일이 시안을 다시 뽑는 유일한 방법이라 저장소에 둔다.
 *
 * 글자·배경 그림·알약 문구는 아래 html 안에서 직접 고친다.
 */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'), FD=path.join(ROOT,'sync','_fonts');
const m={Regular:400,Medium:500,SemiBold:600,Bold:700,ExtraBold:800};
const FONT=Object.entries(m).map(([w,n])=>`@font-face{font-family:'Pretendard';font-weight:${n};font-display:block;src:url('file://${path.join(FD,'Pretendard-'+w+'.woff2')}') format('woff2')}`).join('\n');
const LOGO='file://'+path.join(ROOT,'assets','logo.png');
const BG='file://'+path.join(ROOT,'blog','2026-11-16-prehigh-winter','bg_01_desk_night.png');
const MJ='file://'+path.join(ROOT,'sync','_vendor','tex-svg.js');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
${FONT}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:'Pretendard',sans-serif;background:#140707;-webkit-font-smoothing:antialiased}
.w{position:absolute;inset:0;overflow:hidden}
.ph{position:absolute;inset:0;background:url('${BG}') center/cover no-repeat;filter:brightness(.88) saturate(1.05)}
.scrimL{position:absolute;inset:0;background:linear-gradient(100deg,rgba(28,6,6,.93) 0%,rgba(30,8,8,.80) 42%,rgba(30,8,8,.28) 68%,transparent 100%)}
.scrimB{position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(180deg,transparent,rgba(16,5,5,.88))}
.scrimT{position:absolute;left:0;right:0;top:0;height:300px;background:linear-gradient(180deg,rgba(16,5,5,.72),transparent)}
.rays{position:absolute;left:46%;top:-300px;width:800px;height:1500px;transform:rotate(14deg);
 background:repeating-linear-gradient(90deg,rgba(255,228,170,.09) 0 2px,transparent 2px 50px);
 filter:blur(3px);opacity:.5;-webkit-mask-image:linear-gradient(180deg,#000,transparent 70%)}
.tex{position:absolute;opacity:.22;filter:drop-shadow(0 0 14px rgba(255,210,140,.40))}
.tex svg path,.tex svg use,.tex svg rect{fill:#ffe6bd}
.grain{position:absolute;inset:-30%;opacity:.06;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='3'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")}
.pad{position:absolute;inset:0;padding:70px 66px 62px;display:flex;flex-direction:column}
.lock{display:flex;align-items:center;gap:15px;align-self:flex-start;
 background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(238,232,222,.93));
 padding:11px 24px 11px 15px;border-radius:13px;box-shadow:0 10px 26px rgba(0,0,0,.5)}
.lock img{height:60px}
.lock b{font-weight:800;font-size:40px;color:#1c1414;letter-spacing:-.02em;display:block;line-height:1.1}
.lock i{font-style:normal;font-weight:700;font-size:24px;color:#9b2f2f;letter-spacing:.10em;display:block}
.kick{margin-top:28px;font-weight:800;font-size:44px;letter-spacing:.02em;color:#ffcf6b;
 text-shadow:0 3px 14px rgba(0,0,0,.8)}
.head{margin-top:26px;position:relative;z-index:2}
.brush{position:absolute;left:0;top:338px;width:620px;height:34px;transform:rotate(-1.3deg);z-index:0}
.t3d{position:relative;display:block;font-weight:800;letter-spacing:-.045em;line-height:1.1}
.t3d .b{position:absolute;left:0;top:0;color:#1a0707;-webkit-text-stroke:17px #1a0707;
 text-shadow:0 8px 0 #2a0c0c,0 16px 30px rgba(0,0,0,.8);white-space:nowrap}
.t3d .f{position:relative;white-space:nowrap}
.wh .f{background:linear-gradient(180deg,#ffffff 0%,#fff3e6 44%,#d8c2b4 100%);-webkit-background-clip:text;color:transparent}
.gd .f{background:linear-gradient(180deg,#fff6d2 0%,#ffd84a 38%,#f0a712 62%,#a86d05 100%);-webkit-background-clip:text;color:transparent}
.l2{font-size:106px;margin-top:6px} .l3{font-size:106px;margin-top:30px}
.numrow{display:flex;align-items:baseline;gap:18px}
.num{font-size:250px;line-height:.86;letter-spacing:-.06em}
.numunit{font-weight:800;font-size:86px;letter-spacing:-.03em;color:#fff6ea;
 text-shadow:0 6px 0 #2a0c0c,0 12px 26px rgba(0,0,0,.8)}
.badge{margin-top:40px;position:relative;z-index:3;align-self:flex-start;display:flex;align-items:baseline;gap:14px;
 background:linear-gradient(180deg,#ffe488,#f0ad12);color:#1a0707;padding:16px 34px;border-radius:999px;
 box-shadow:0 14px 34px rgba(255,185,40,.32)}
.badge b{font-weight:800;font-size:66px;letter-spacing:-.03em}
.badge span{font-weight:800;font-size:44px}
.sub{margin-top:44px;position:relative;z-index:3;font-weight:700;font-size:54px;line-height:1.36;
 color:rgba(255,238,224,.92);text-shadow:0 4px 20px rgba(0,0,0,.85)}
.sub em{font-style:normal;color:#ffd84a;font-weight:800}
.chips{margin-top:auto;position:relative;z-index:3;display:flex;gap:14px;flex-wrap:wrap}
.chips{row-gap:14px}
.chip{font-weight:800;font-size:46px;color:#1a0707;background:linear-gradient(180deg,#ffe07a,#f3b61a);
 padding:15px 28px;border-radius:999px;box-shadow:0 10px 26px rgba(255,190,60,.26)}
.chip.o{background:rgba(255,255,255,.10);color:#ffe9cf;border:2px solid rgba(255,214,150,.42);box-shadow:none}
.foot{margin-top:34px;position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between}
.fl{font-weight:700;font-size:38px;color:rgba(255,238,224,.62)}
.fr{font-weight:800;font-size:36px;color:#1a0707;background:#ffd84a;padding:11px 24px;border-radius:999px}
</style></head><body><div class="w">
<div class="ph"></div><div class="scrimL"></div><div class="scrimT"></div><div class="scrimB"></div>
<div class="rays"></div><div id="tex"></div><div class="grain"></div>
<div class="pad">
 <div class="lock"><img src="${LOGO}"><div><b>루멘수학</b><i>부천 옥길동</i></div></div>
 <div class="kick">예비고1 겨울 · 2026.11 ~ 2027.2</div>
 <div class="head">
  <svg class="brush" viewBox="0 0 640 34" preserveAspectRatio="none"><path d="M5 21 C118 7,246 27,364 15 S552 8,636 18 L634 29 C524 19,392 36,248 26 S86 32,7 29 Z" fill="#c0202a"/></svg>
  <div class="numrow">
   <span class="t3d gd num"><span class="b">15</span><span class="f">15</span></span>
   <span class="numunit">주 만에</span>
  </div>
  <span class="t3d wh l2"><span class="b">공통수학1·2를</span><span class="f">공통수학1·2를</span></span>
  <span class="t3d wh l3"><span class="b">끝냅니다</span><span class="f">끝냅니다</span></span>
 </div>
 <div class="badge"><b>11.19</b><span>개강</span></div>
 <div class="chips"><div class="chip">전체 41회</div><div class="chip o">단원 테스트 7번</div><div class="chip o">3월 개학 전 완성</div></div>
 <div class="foot"><div class="fl">부천 옥길동 수학학원 루멘수학</div><div class="fr">1 / 6</div></div>
</div></div>
<script src="${MJ}"></script>
<script>
const F=[['f(x)',700,196,.70],['x^2+y^2=r^2',790,1066,.78],['a^2+b^2=c^2',96,1096,.72]];
window.addEventListener('load',()=>{const h=document.getElementById('tex');
 F.forEach(([t,x,y,s])=>{const n=MathJax.tex2svg(t,{display:true});const svg=n.querySelector('svg');
  svg.setAttribute('width',(205*s)+'px');svg.removeAttribute('height');
  const d=document.createElement('div');d.className='tex';d.style.left=x+'px';d.style.top=y+'px';
  d.appendChild(svg);h.appendChild(d)});window.__ok=1});
</script></body></html>`;
const out=process.argv[2];
fs.writeFileSync(out.replace(/\.png$/,'.html'),html);
(async()=>{const {chromium}=require('playwright');
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
 await p.goto('file://'+out.replace(/\.png$/,'.html'));
 await p.waitForFunction(()=>window.__ok,null,{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(700);await p.screenshot({path:out});await b.close();console.log('됨');})();
