const { chromium } = require('playwright'); const path=require('path');
(async()=>{ const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const pg=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message))); await pg.route(/^https:\/\//,r=>r.abort());
 await pg.goto('file://'+path.resolve(process.argv[2]||'lumen_v19-108.html'),{waitUntil:'load'}); await pg.waitForTimeout(2000);
 const o=await pg.evaluate(()=>{ const mk=(diffs)=>({examId:'x',exam:{school:'범박고',grade:'고1',year:2026,semester:'2',term:'중간'},basis:'same+var',items:diffs.map((df,i)=>({no:i+1,level:(i%5)+1,diff:df,cands:[],killer:df!=null&&df>=6})),mats:{},stats:{total:diffs.length}});
  const a=mk([2,2,2,4,2,3,3,4,4,4,4,2,4,4,5,4,5,4,5,6,3,4,5]); const b=mk(Array(23).fill(null));
  const sa=htStats(a), sb=htStats(b); const ha=htSummaryHtml(a), hb=htSummaryHtml(b); const ma=htMd(a);
  return {APP:APP_VER, sa:[sa.levelAvg,sa.killers,sa.hard,sa.lvMax], sb:[sb.lvMax], ha9:/\/9<\/small><\/b><span>평균 난도 \(수학비서/.test(ha), haK:/킬러 \(수학비서 6 이상\)/.test(ha), hb5:/\/5<\/small>/.test(hb), md9:/\/ 9 \(수학비서 난이도\)/.test(ma) }; });
 console.log(JSON.stringify(o), 'errs', errs.length, errs.slice(0,2)); await br.close(); })();
