// 손글씨 풀이 이미지 만들기 (시험판)
// 사용: node sync/handwrite/hw_render.js <풀이.json> <결과.png> [글꼴폴더]
// 글꼴폴더: @fontsource/nanum-pen-script 패키지 폴더(index.css 있는 곳). 글꼴은 저장소에 넣지 않는다.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [, , specPath, outPath, fontDir] = process.argv;
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const COLORS = { blue: '#2148c9', green: '#1f9a4a', purple: '#8a3fc4', orange: '#e8860c', red: '#e23b4e', black: '#222' };

// 사람 글씨처럼: 글자마다 기울기·높이·크기를 조금씩 흔든다 (같은 글자도 매번 다르게)
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const jit = ch => ch === ' ' ? '&nbsp;' :
  `<span class="g" style="transform:translateY(${(rnd()-.5)*2.4}px) rotate(${(rnd()-.5)*5}deg) scale(${1+(rnd()-.5)*.08})">${ch.replace(/</g,'&lt;')}</span>`;
const plain = s => [...s].map(jit).join('');
// 작은 수식 문법: [a/b] 분수, √x 루트(숫자·문자 이어진 만큼), ^2 위첨자
function math(s) {
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '[') { const j = s.indexOf(']', i); const [a, b] = s.slice(i+1, j).split('/');
      out += `<span class="fr"><span class="nu">${math(a)}</span><span class="de">${math(b)}</span></span>`; i = j+1; }
    else if (s[i] === '√') { let j = i+1; while (j < s.length && /[0-9a-zA-Z]/.test(s[j])) j++;
      out += `<span class="sq">√<span class="rad">${plain(s.slice(i+1, j))}</span></span>`; i = j; }
    else if (s[i] === '^') { out += `<sup>${plain(s[i+1])}</sup>`; i += 2; }
    else { out += plain(s[i]); i++; }
  }
  return out;
}
const lines = spec.lines.map(l => {
  const ind = (l.t.match(/^ */)[0].length) * 14;
  return `<div class="ln" style="color:${COLORS[l.c]||l.c};margin-left:${ind}px;transform:rotate(${(rnd()-.5)*.6}deg)">${math(l.t.trimStart())}</div>`;
}).join('');
const problem = spec.problem_image
  ? `<img src="file://${path.resolve(spec.problem_image)}" style="width:100%">`
  : `<div class="pb">${spec.problem_text}</div>`;
const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="file://${path.resolve(fontDir, 'index.css')}">
<style>
body{margin:0;background:#fff;width:900px}
.wrap{padding:40px 50px 50px}
.pb{font:20px/1.75 'Noto Serif CJK KR','Noto Sans CJK KR',serif;color:#222;margin-bottom:110px}
.sol{font-family:'Nanum Pen Script';font-size:38px;line-height:1.55}
.ln{white-space:nowrap;margin:6px 0}
.g{display:inline-block}
.fr{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.82em;line-height:1.05;margin:0 4px}
.nu{border-bottom:2px solid currentColor;padding:0 3px}
.sq{white-space:nowrap}.rad{border-top:2px solid currentColor;padding-top:1px}
sup{font-size:.6em}
.ans{display:inline-block;margin-top:34px;color:${COLORS.red};border:3px solid ${COLORS.red};border-radius:8px;padding:2px 22px;font-size:38px;transform:rotate(-1deg)}
</style>
<div class="wrap">${problem}<div class="sol">${lines}<div class="ans">${plain('정답 : ' + spec.answer)}</div></div></div>`;
(async () => {
  const tmp = path.resolve(fontDir, '_hw_page.html'); fs.writeFileSync(tmp, html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
  await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: outPath, fullPage: true }); await b.close(); console.log('완성:', outPath);
})();
