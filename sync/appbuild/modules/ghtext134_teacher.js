/* ═══ v19-134: 🎯 적중 분석 «서버 기다리는 중» 안내를 사실대로 · GitHub 단추 이름 바로잡기 ═══
 *  원장 2026-10-18 「다시 분석을 하는데 깃허브 바로 실행이 매쓰플랫에서 학습지를 가져오는 것으로 되어있다. 다시 살펴보아라」
 *  확인한 것:
 *   ① 「🐙 GitHub에서 바로 실행」은 맞는 곳이다 — mathflat-ondemand.yml 한 작업이 «매쓰플랫 지금 가져오기»와 «🎯 적중 분석»을
 *      차례로 처리한다(적중 분석은 그 작업의 두 번째 단계). 작업 이름이 「매쓰플랫 요청 수집 (지금 가져오기)」라 헷갈렸을 뿐.
 *      → 워크플로 이름을 「매쓰플랫 요청 처리 (지금 가져오기 · 🎯 적중 분석)」로 바꾸고, 단추·안내에 그 이름을 적는다.
 *   ② 「5분 안」은 사실이 아니었다 — GitHub 가 공개 저장소의 5분 예약을 크게 미뤄서 실제로는 2~5시간에 한 번 돈다(10/14~18 기록).
 *      → 안내를 «자동 순번은 몇 시간 간격 · 바로 하려면 GitHub 실행 또는 설정 탭 GitHub 토큰»으로 고친다.
 *  화면 글자만 바꾼다(요청·저장 방식 그대로).
 */
var GH134_WAIT = '서버 차례를 기다리는 중 — 자동 순번은 몇 시간 간격이라, 바로 하려면 「🐙 GitHub에서 바로 실행」';
function gh134Fix(h){
  return String(h)
    .replace('서버가 받기를 기다리는 중 (5분 안)', GH134_WAIT)
    .replace(/서버가 받기를 기다리는 중(?! —)/g, GH134_WAIT)
    .replace(/🐙 GitHub에서 바로 실행<\/a>/g, '🐙 GitHub에서 바로 실행 (적중 분석 포함)</a>')
    .replace('Run workflow 를 누르면 1분 안에 시작됩니다', '열리는 작업 «매쓰플랫 요청 처리 (지금 가져오기 · 🎯 적중 분석)» → 오른쪽 «Run workflow» → 초록 «Run workflow». 1분 안에 시작하고, 매쓰플랫 확인을 먼저 한 뒤 적중 분석을 합니다');
}
if(typeof rExamHit==='function') rExamHit=(function(o){ return function(){ return gh134Fix(o.apply(this, arguments)); }; })(rExamHit);
if(typeof l3hServerBox==='function') l3hServerBox=(function(o){ return function(){ return gh134Fix(o.apply(this, arguments)); }; })(l3hServerBox);
