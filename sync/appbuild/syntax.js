/* 인라인 <script> 블록을 acorn 으로 전부 파싱 (실행하지 않는다) */
const fs=require('fs'); const acorn=require('acorn');
const f=process.argv[2];
const s=fs.readFileSync(f,'utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0;
while((m=re.exec(s))){
  i++;
  const code=m[1];
  const line=s.slice(0,m.index).split('\n').length;
  try{ acorn.parse(code,{ecmaVersion:2022}); }
  catch(e){ bad++; console.log('❌ 블록#'+i+' (파일 '+line+'줄부터): '+e.message); }
}
console.log(bad? '❌ '+bad+'개 블록에 문법 오류' : '✅ <script> 블록 '+i+'개 문법 이상 없음');
process.exit(bad?1:0);
