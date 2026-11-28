#!/usr/bin/env node
/**
 * sync/card_hero_preview.js — 「표지(hero)」 카드 시안 만들기
 *
 *   node sync/card_hero_preview.js <나올 파일.png> [글 폴더]
 *
 * 글 폴더에 hero.json 이 있으면 그 글자로 만든다. 없으면 예비고1 기본값.
 *   { "bg":"bg_01_desk_night.png",
 *     "rows":[{"gold":"예비고1","white":"겨울 특강"},{"gold":"15주","white":"만에"}],
 *     "line":"공통수학1·2 완성",
 *     "dateLab":"수업 기간", "dates":["11.19","2.26"],
 *     "dateTail":"11월 19일 목요일 개강",
 *     "footL":"부천 옥길동 수학학원 루멘수학", "footR":"네이버 톡톡 상담" }
 *
 * 2026-11-17 판 — 네이버 플레이스·당근 홍보에도 그대로 쓰는 표지.
 * 한눈에 들어와야 하는 것 셋만 남겼다: 예비고1 · 개강일 · 루멘수학.
 * 회차·단원 테스트 같은 안쪽 이야기는 본문으로 넘겼다.
 *
 * ⚠️ 아직 카드 생성기에 넣지 않았다. 원장님이 「확정」하시면
 *    sync/card_templates/hero.html + _base.css 로 옮겨
 *    cards.json 에 "type": "hero" 로 쓸 수 있게 한다.
 *
 * 글자·배경 그림은 아래 html 안에서 직접 고친다.
 */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'), FD=path.join(ROOT,'sync','_fonts');
const m={Regular:400,Medium:500,SemiBold:600,Bold:700,ExtraBold:800};
const FONT=Object.entries(m).map(([w,n])=>`@font-face{font-family:'Pretendard';font-weight:${n};font-display:block;src:url('file://${path.join(FD,'Pretendard-'+w+'.woff2')}') format('woff2')}`).join('\n');
const LOGO='file://'+path.join(ROOT,'assets','logo.png');
const out=process.argv[2];
if(!out){console.error('사용법: node sync/card_hero_preview.js <나올 파일.png> [글 폴더]');process.exit(1);}
const folder=process.argv[3]||'blog/2026-11-16-prehigh-winter';
const dir=path.resolve(ROOT,folder);
const D=Object.assign({
  bg:'bg_01_desk_night.png',
  rows:[{gold:'예비고1',white:'겨울 특강'},{gold:'15주',white:'만에'}],
  line:'공통수학1·2 완성',
  dateLab:'수업 기간', dates:['11.19','2.26'], dateTail:'11월 19일 목요일 개강',
  footL:'부천 옥길동 수학학원 루멘수학', footR:'네이버 톡톡 상담',
  badge:'', steps:[], bgPos:'center', note:'',
}, fs.existsSync(path.join(dir,'hero.json')) ? JSON.parse(fs.readFileSync(path.join(dir,'hero.json'),'utf8')) : {});
const BG='file://'+path.join(dir,D.bg);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
const t3d=(cls,s)=>`<span class="t3d ${cls}"><span class="b">${esc(s)}</span><span class="f">${esc(s)}</span></span>`;
const MJ='file://'+path.join(ROOT,'sync','_vendor','tex-svg.js');

const html=`<!doctype html><html><head><meta charset="utf-8"><style>
${FONT}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:'Pretendard',sans-serif;background:#140707;-webkit-font-smoothing:antialiased}
.w{position:absolute;inset:0;overflow:hidden}
.ph{position:absolute;inset:0;background:url('${BG}') ${D.bgPos}/cover no-repeat;filter:brightness(.80) saturate(1.05)}
.scrimL{position:absolute;inset:0;background:linear-gradient(104deg,rgba(26,6,6,.95) 0%,rgba(28,8,8,.86) 46%,rgba(28,8,8,.40) 72%,rgba(28,8,8,.14) 100%)}
.scrimB{position:absolute;left:0;right:0;bottom:0;height:560px;background:linear-gradient(180deg,transparent,rgba(14,4,4,.92))}
.scrimT{position:absolute;left:0;right:0;top:0;height:320px;background:linear-gradient(180deg,rgba(14,4,4,.80),transparent)}
.rays{position:absolute;left:48%;top:-300px;width:800px;height:1500px;transform:rotate(14deg);
 background:repeating-linear-gradient(90deg,rgba(255,228,170,.08) 0 2px,transparent 2px 52px);
 filter:blur(3px);opacity:.45;-webkit-mask-image:linear-gradient(180deg,#000,transparent 68%)}
.tex{position:absolute;opacity:.18;filter:drop-shadow(0 0 14px rgba(255,210,140,.35))}
.tex svg path,.tex svg use,.tex svg rect{fill:#ffe6bd}
.grain{position:absolute;inset:-30%;opacity:.06;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='3'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")}

.pad{position:absolute;inset:0;padding:66px 62px 58px;display:flex;flex-direction:column}
.t3d{position:relative;display:inline-block;font-weight:800;letter-spacing:-.045em;line-height:1.06}
.t3d .b{position:absolute;left:0;top:0;color:#1a0707;-webkit-text-stroke:18px #1a0707;
 text-shadow:0 9px 0 #2b0d0d,0 18px 32px rgba(0,0,0,.85);white-space:nowrap}
.t3d .f{position:relative;white-space:nowrap}
.wh .f{background:linear-gradient(180deg,#ffffff 0%,#fff4e8 44%,#ddc9bb 100%);-webkit-background-clip:text;color:transparent}
.gd .f{background:linear-gradient(180deg,#fff7d6 0%,#ffd84a 36%,#f1aa12 62%,#a86d05 100%);-webkit-background-clip:text;color:transparent}

/* 1. 학원 이름 — 크게 */
.lock{display:flex;align-items:center;gap:18px;align-self:flex-start;
 background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(240,234,224,.94));
 padding:13px 30px 13px 18px;border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.55)}
.lock img{height:70px}
.lock b{font-weight:800;font-size:52px;color:#1c1414;letter-spacing:-.03em;display:block;line-height:1.05}
.lock i{font-style:normal;font-weight:700;font-size:27px;color:#9b2f2f;letter-spacing:.09em;display:block}

/* 2. 예비고1 — 한눈에 */
.who{margin-top:46px;position:relative;z-index:2}
.brush{position:absolute;left:-6px;top:120px;width:560px;height:34px;transform:rotate(-1.3deg);z-index:0}
.whoRow{display:flex;align-items:baseline;gap:20px}
.big{font-size:152px;line-height:.98;letter-spacing:-.055em}
.season{font-weight:800;font-size:76px;color:#fff6ea;letter-spacing:-.03em;
 text-shadow:0 6px 0 #2b0d0d,0 12px 26px rgba(0,0,0,.85)}

/* 3. 무엇을 하는가 */
.who2{margin-top:14px;position:relative;z-index:2}
.what{margin-top:16px;position:relative;z-index:2;display:flex;flex-direction:column;gap:8px}
.wl{font-size:86px;line-height:1.1}

/* 3-1. 붉은 띠 — 마감·신설 같은 한 마디 */
.badge{align-self:flex-start;margin-top:26px;position:relative;z-index:3;
 background:linear-gradient(180deg,#d8333d,#a8141d);color:#fff;font-weight:800;font-size:46px;
 letter-spacing:-.02em;padding:16px 34px;border-radius:14px;
 box-shadow:0 14px 34px rgba(190,30,40,.44), inset 0 2px 0 rgba(255,255,255,.22)}

/* 3-2. 수업 흐름 */
.note{margin-top:32px;align-self:flex-start;position:relative;z-index:3;display:flex;align-items:baseline;gap:16px;
 background:rgba(255,255,255,.09);border:2.5px solid rgba(255,214,150,.44);border-radius:18px;padding:16px 30px}
.note i{font-style:normal;font-weight:800;font-size:40px;color:#ffcf6b}
.note b{font-weight:800;font-size:56px;color:#fff6ea;letter-spacing:-.03em}
.steps{margin-top:36px;position:relative;z-index:3;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.step{display:flex;align-items:center;gap:14px}
.step b{width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;
 background:linear-gradient(180deg,#ffe488,#f0ad12);color:#1a0707;font-weight:800;font-size:36px}
.step span{font-weight:800;font-size:48px;color:#fff6ea;letter-spacing:-.03em;
 text-shadow:0 5px 0 #2b0d0d,0 10px 22px rgba(0,0,0,.8)}
.arw{font-weight:800;font-size:44px;color:#ffcf6b;opacity:.9}

/* 4. 개강일 — 오른쪽, 크게 */
.date{margin-top:52px;position:relative;z-index:3;align-self:flex-end;text-align:right}
.date:before{content:"";position:absolute;right:-70px;bottom:-40px;width:760px;height:330px;
 background:radial-gradient(ellipse at 72% 60%,rgba(14,4,4,.88),transparent 70%);z-index:-1}
.date .lab{font-weight:800;font-size:58px;letter-spacing:.10em;color:#ffcf6b;text-shadow:0 4px 16px rgba(0,0,0,.9)}
.date .row{display:flex;align-items:baseline;justify-content:flex-end;gap:18px;margin-top:2px}
.dnum{font-size:160px;line-height:.98;letter-spacing:-.05em}
.dash{font-weight:800;font-size:92px;color:#ffcf6b;text-shadow:0 5px 0 #2b0d0d,0 10px 22px rgba(0,0,0,.85)}
.dtail{margin-top:10px;font-weight:800;font-size:46px;color:#fff1e0;text-shadow:0 4px 16px rgba(0,0,0,.9)}

/* 5. 꼬리말 */
.foot{margin-top:auto;position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;
 border-top:3px solid rgba(255,214,150,.26);padding-top:28px}
.fl{font-weight:800;font-size:44px;color:#fff1e0;letter-spacing:-.02em}
.fr{font-weight:700;font-size:34px;color:rgba(255,226,196,.72)}
</style></head><body><div class="w">
<div class="ph"></div><div class="scrimL"></div><div class="scrimT"></div><div class="scrimB"></div>
<div class="rays"></div><div id="tex"></div><div class="grain"></div>
<div class="pad">
 <div class="lock"><img src="${LOGO}"><div><b>루멘수학</b><i>부천 옥길동</i></div></div>

 ${D.rows.map((r,i)=>`<div class="${i?'who2':'who'}">${i?'':'<svg class="brush" viewBox="0 0 560 34" preserveAspectRatio="none"><path d="M5 21 C104 7,216 27,320 15 S484 8,556 18 L554 29 C460 19,344 36,218 26 S76 32,7 29 Z" fill="#c0202a"/></svg>'}
  <div class="whoRow">${t3d('gd big',r.gold)}${r.white?`<span class="season">${esc(r.white)}</span>`:''}</div>
 </div>`).join('')}

 ${D.line?`<div class="what">${t3d('wh wl',D.line)}</div>`:''}

 ${D.badge?`<div class="badge">${esc(D.badge)}</div>`:''}

 ${D.note?`<div class="note"><i>${esc(D.note.lab||'')}</i><b>${esc(D.note.val||D.note)}</b></div>`:''}

 ${D.steps&&D.steps.length?`<div class="steps">${D.steps.map((s,i)=>
   `${i?'<span class="arw">›</span>':''}<div class="step"><b>${i+1}</b><span>${esc(s)}</span></div>`).join('')}</div>`:''}

 <div class="date"><div class="lab">${esc(D.dateLab)}</div>
  <div class="row">${D.dates.map(d=>t3d('gd dnum',d)).join('<span class="dash">—</span>')}</div>
  ${D.dateTail?`<div class="dtail">${esc(D.dateTail)}</div>`:''}
 </div>

 <div class="foot"><div class="fl">${esc(D.footL)}</div><div class="fr">${esc(D.footR)}</div></div>
</div></div>
<script src="${MJ}"></script>
<script>
const F=[['f(x)',726,168,.66],['x^2+y^2=r^2',120,1008,.66]];
window.addEventListener('load',()=>{const h=document.getElementById('tex');
 F.forEach(([t,x,y,s])=>{const n=MathJax.tex2svg(t,{display:true});const svg=n.querySelector('svg');
  svg.setAttribute('width',(205*s)+'px');svg.removeAttribute('height');
  const d=document.createElement('div');d.className='tex';d.style.left=x+'px';d.style.top=y+'px';
  d.appendChild(svg);h.appendChild(d)});window.__ok=1});
</script></body></html>`;
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(out.replace(/\.png$/,'.html'),html);
(async()=>{const {chromium}=require('playwright');
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
 await p.goto('file://'+path.resolve(out.replace(/\.png$/,'.html')));
 await p.waitForFunction(()=>window.__ok,null,{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(700);await p.screenshot({path:out});await b.close();console.log('됨 '+out);})();
