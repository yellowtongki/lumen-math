/* 플래너 날짜 연도 오독 고침 검사 (서버 sync/planner_night_grader.js yearFix · 학원앱 v19-204 plYearFix 와 같은 규칙)
 * 실행: SUPABASE_URL=x SUPABASE_SERVICE_KEY=x ANTHROPIC_API_KEY=x node sync/test_planner_yearfix.js */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://x'; process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'x';
const { yearFix } = require('./planner_night_grader.js');
let p = 0, f = 0; const t = (n, ok, i) => { ok ? p++ : f++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' ← ' + i)); };
let a = { date: '2025.11.16', dateNext: '2025.11.17' }; t('2025.11.16 → 2026.11.16 (예상 2026.11.16)', yearFix(a, '2026.11.16') && a.date === '2026.11.16' && a.dateNext === '2026.11.17' && a.yearFixed === '2025→2026', JSON.stringify(a));
a = { date: '2025.12.31' }; t('연말 넘김: 2025.12.31 예상 2026.01.01 → 연도 고치면 1년 차이라 안 고침? (같은 해로 맞추면 364일) → 그대로', !yearFix(a, '2026.01.01') && a.date === '2025.12.31', JSON.stringify(a));
a = { date: '2025.11.10' }; t('날짜가 정말 다름(6일) → 그대로', !yearFix(a, '2026.11.16') && a.date === '2025.11.10', JSON.stringify(a));
a = { date: '2026.11.15' }; t('연도 맞으면 손대지 않음', !yearFix(a, '2026.11.16') && !a.yearFixed, JSON.stringify(a));
a = { date: '2027.11.16' }; t('1년 뒤로 읽어도 고침', yearFix(a, '2026.11.16') && a.date === '2026.11.16', JSON.stringify(a));
a = { date: '2024.11.16' }; t('2년 차이는 안 고침', !yearFix(a, '2026.11.16'), JSON.stringify(a));
a = { date: '2025.11.15' }; t('예상이 세트 id 모양(20261116)이어도', yearFix(a, '20261116') && a.date === '2026.11.15', JSON.stringify(a));
console.log('\n' + p + '/' + (p + f) + (f ? ' ❌' : ' ✅')); process.exit(f ? 1 : 0);
