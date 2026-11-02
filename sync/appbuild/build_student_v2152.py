# 학생앱 v2-152 조립 — «v2-151 복사 + rep 고침»
#   원장 2026-11-02 (학생 폰 캡처) 「학생앱에서 아하노트 질문이 제출이 안 된다」
#   «저장 실패: new row for relation "aha_notes" violates check constraint "aha_notes_source_type_check"»
#   [까닭] 출처로 «매쓰플랫 학습지»를 고르면 source_type 을 'worksheet' 로 보낸다(v2-77). 그런데 서버 표 aha_notes 의
#          검사 규칙은 'book'·'print' 만 받는다 → 학습지로 올린 아하노트는 v2-77 부터 한 번도 저장되지 않았다(서버에 worksheet 0건).
#   [고침] 'worksheet' 가 검사 규칙에 걸리면 'print'(출처 이름 = 학습지 제목)로 바꿔 한 번 더 저장한다.
#          학습지 연결 정보(mf: 학습지·문항)는 그대로 실어 보낸다. 나중에 서버 규칙에 'worksheet' 를 더하면 그대로 'worksheet' 로 저장된다.
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-151.html'); DST = os.path.join(ROOT, 'student_v2-152.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-151';", "var STU_VER = 'v2-152';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-152 (2026-11-02) 💡 매쓰플랫 학습지로 올린 IB아하노트가 «저장 실패»로 안 올라가던 것 (원장 제보 — 학생 폰 캡처)\n"
    " *   · 서버가 출처 종류를 «교재·프린트»만 받는데 학습지는 «학습지»로 보내서 거절됐습니다. 이제 거절되면 «프린트(학습지 제목)»로 다시 저장합니다.\n"
    " *     어느 학습지의 몇 번 문제인지(매쓰플랫 연결)는 그대로 함께 저장됩니다.\n"
    " *\n")
rep("""function a7Strip(d){""", """/* ★ v2-152: 서버 검사 규칙(aha_notes_source_type_check)은 'book'·'print' 만 받는다 — 'worksheet' 가 걸리면 'print' 로 */
function a7SrcRejected(r, d){ return !!(r && r.error && d && d.source_type === 'worksheet' && String(r.error.message || '').indexOf('source_type') >= 0); }
function a7AsPrint(d){ var o = {}, k; for (k in d) o[k] = d[k]; o.source_type = 'print'; o.source_name = String(d.source_name || '학습지'); return o; }
function a7Strip(d){""")
rep("""async function a7Insert(d, wantId){
  var r = wantId ? await sb.from('aha_notes').insert(d).select('id')
                 : await sb.from('aha_notes').insert(d);""", """async function a7Insert(d, wantId){
  var r = wantId ? await sb.from('aha_notes').insert(d).select('id')
                 : await sb.from('aha_notes').insert(d);
  if (a7SrcRejected(r, d)) {   /* ★ v2-152 */
    console.warn('aha_notes 가 출처 «worksheet» 를 받지 않아 «print»(학습지 제목)로 다시 저장합니다');
    d = a7AsPrint(d);
    r = wantId ? await sb.from('aha_notes').insert(d).select('id')
               : await sb.from('aha_notes').insert(d);
  }""")
rep("""async function a7Update(d, id){
  var r = await sb.from('aha_notes').update(d).eq('id', id);""", """async function a7Update(d, id){
  var r = await sb.from('aha_notes').update(d).eq('id', id);
  if (a7SrcRejected(r, d)) { d = a7AsPrint(d); r = await sb.from('aha_notes').update(d).eq('id', id); }   /* ★ v2-152 */""")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
