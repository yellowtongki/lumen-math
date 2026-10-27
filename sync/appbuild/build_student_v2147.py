# 학생앱 v2-147 조립 — «v2-146 복사 + rep 고침»
#   원장 2026-10-20 「아하노트에서 사진찍으면 튕긴다고 한다. 학생앱 긴급점검. 제출이 안된다고 한다.」
#   점검: 서버(사진 올리기 · AI 읽기 aha-read · aha_notes 저장 권한)는 모두 정상. 10/19 22:24~22:25 한 학생이
#     사진 3장을 올렸는데 노트는 0건 → 사진이 올라간 뒤 폰에서 앱이 꺼진(메모리) 것으로 본다.
#     아하노트 사진만 «사진 전체를 긴 글자(dataURL)로 바꿔 두 번» 들고 있었다(플래너 사진은 가벼운 길).
#   ① ahaCompressImage — 플래너와 같은 길: 파일 주소(createObjectURL)로 바로 줄이고, 미리보기도 줄인 사진 주소로.
#      가로 1600 · 세로 2400 넘지 않게(세로로 긴 사진도 줄인다). 그린 뒤 캔버스를 비워 메모리를 돌려준다.
#   ② 이어 쓰기 — 사진이 올라가면 폰에 «올린 사진 주소 + AI 가 읽은 글»을 적어 둔다(localStorage aha_resume_<코드>, 6시간).
#      앱이 꺼졌다 다시 「새 IB아하노트」를 누르면 「조금 전에 올린 사진으로 이어서 쓸까요?」 → 다시 찍지 않고 확인 화면으로.
#      제출·스스로 해결 저장·「나가기」를 하면 지운다.
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-146.html'); DST = os.path.join(ROOT, 'student_v2-147.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-146';", "var STU_VER = 'v2-147';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-147 (2026-10-20) 📷 아하노트 사진 찍으면 앱이 꺼지던 문제 (원장 「아하노트에서 사진찍으면 튕긴다고 한다 · 제출이 안된다」)\n"
    " *   · 사진을 줄이는 방법을 플래너 사진과 같은 가벼운 방법으로 바꿨어요(폰 메모리를 훨씬 덜 써요).\n"
    " *   · 사진이 올라간 뒤 앱이 꺼져도, 다시 「새 IB아하노트」를 누르면 «조금 전에 올린 사진으로 이어서 쓸까요?» — 다시 안 찍어도 돼요.\n"
    " *\n")

# ① 가벼운 사진 줄이기
i = s.index('// 이미지 압축 (1MB 이하, 가로 1600px 제한)\nfunction ahaCompressImage(file) {')
j = s.index('\n}\n', i) + 3
assert 'reader.readAsDataURL(file);' in s[i:j]
s = s[:i] + r"""// 이미지 압축 — ★ v2-147: 플래너 사진과 같은 가벼운 길 (사진 전체를 긴 글자로 바꾸지 않는다)
//   가로 1600 · 세로 2400 을 넘지 않게. 미리보기(dataUrl 칸)는 줄인 사진의 주소(blob:)다.
function ahaCompressImage(file) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    var src = URL.createObjectURL(file);
    img.onload = function() {
      try {
        URL.revokeObjectURL(src);
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var sc = Math.min(1, 1600 / w, 2400 / h);
        var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(function(blob) {
          canvas.width = 0; canvas.height = 0;   // 메모리 돌려주기
          if (!blob) { reject(new Error('압축 실패')); return; }
          resolve({ blob: blob, dataUrl: URL.createObjectURL(blob) });
        }, 'image/jpeg', 0.82);
      } catch(e) { reject(e); }
    };
    img.onerror = function(){ URL.revokeObjectURL(src); reject(new Error('이미지 로드 실패')); };
    img.src = src;
  });
}
""" + s[j:]

# ② 이어 쓰기 — 함수 묶음 (ahaGoAdd 바로 앞)
rep("// ① 시작 → ③ 사진 찍기\nasync function ahaGoAdd() {",
    r"""/* ★ v2-147: 사진이 올라간 뒤 앱이 꺼져도 이어 쓰기 (이 폰에만, 6시간) */
function ahaResumeKey(){ return 'aha_resume_' + ((studentInfo && studentInfo.lumen_rec_code) || ''); }
function ahaResumeSave(o){ try { o.t = Date.now(); localStorage.setItem(ahaResumeKey(), JSON.stringify(o)); } catch(e) {} }
function ahaResumeGet(){
  try { var o = JSON.parse(localStorage.getItem(ahaResumeKey()) || 'null');
    if (o && o.url && (Date.now() - (o.t || 0)) < 6 * 3600 * 1000) return o; } catch(e) {}
  return null;
}
function ahaResumeClear(){ try { localStorage.removeItem(ahaResumeKey()); } catch(e) {} }
async function ahaResumeApply(rs) {
  ahaUploadedUrl = rs.url;
  var slot = document.getElementById('aha-photo-slot');
  slot.classList.add('has-photo');
  slot.innerHTML = '<img src="' + ahaEscape(rs.url) + '" alt="">' +
    '<button class="aha-photo-replace" onclick="event.stopPropagation();ahaTriggerPhoto()">다시 찍기</button>';
  var ai = (rs.ai && !rs.ai.err) ? rs.ai : null, failMsg = '';
  if (!ai) {
    ahaShowStage('reading');
    try { ai = await ahaReadPhoto(rs.url, 'lamp'); } catch(e) { failMsg = e.message || '읽기 실패'; }
    if (ahaUploadedUrl !== rs.url) return;   // 그 사이 새로 찍었으면 그만
  }
  ahaLampAi = ai ? ai : { err: failMsg, at: new Date().toISOString() };
  if (ai) ahaResumeSave({ url: rs.url, ai: ai });
  ahaApplyRead(ai, failMsg);
  ahaShowStage('confirm');
}

// ① 시작 → ③ 사진 찍기
async function ahaGoAdd() {""")
rep("""  a7PaintAcc(); a7KindPaint();
  // 사진을 고르면 바로 카메라가 열리도록 안내
  ahaTriggerPhoto();
}""", """  a7PaintAcc(); a7KindPaint();
  /* ★ v2-147: 조금 전에 올린 사진이 있으면(앱이 꺼졌던 경우) 이어서 쓸지 묻는다 */
  var rs = ahaResumeGet();
  if (rs) {
    if (confirm('조금 전에 올린 활동지 사진이 있어요.\\n그 사진으로 이어서 쓸까요?\\n\\n[취소]를 누르면 새로 찍어요.')) { await ahaResumeApply(rs); return; }
    ahaResumeClear();
  }
  // 사진을 고르면 바로 카메라가 열리도록 안내
  ahaTriggerPhoto();
}""")
rep("""    ahaUploadedUrl = await ahaUploadPhoto(ahaPendingPhotoFile, '');
  } catch(e) {""", """    ahaUploadedUrl = await ahaUploadPhoto(ahaPendingPhotoFile, '');
    ahaResumeSave({ url: ahaUploadedUrl });   /* ★ v2-147: 여기서 앱이 꺼져도 이어 쓰기 */
  } catch(e) {""")
rep("""  ahaLampAi = ai ? ai : { err: failMsg, at: new Date().toISOString() };
  ahaApplyRead(ai, failMsg);""", """  ahaLampAi = ai ? ai : { err: failMsg, at: new Date().toISOString() };
  if (ai) ahaResumeSave({ url: ahaUploadedUrl, ai: ai });   /* ★ v2-147 */
  ahaApplyRead(ai, failMsg);""")
rep("      ahaToast('IB아하노트 제출 완료! 🎉', 'success');",
    "      ahaToast('IB아하노트 제출 완료! 🎉', 'success');\n      ahaResumeClear();   /* ★ v2-147 */")
rep("      ahaSelfNoteId = (ir.data && ir.data[0] && ir.data[0].id) || null;",
    "      ahaSelfNoteId = (ir.data && ir.data[0] && ir.data[0].id) || null;\n      if (ahaSelfNoteId) ahaResumeClear();   /* ★ v2-147 */")
rep("    if (!confirm('올리던 내용이 사라져요. 그래도 나갈까요?')) return;\n",
    "    if (!confirm('올리던 내용이 사라져요. 그래도 나갈까요?')) return;\n    ahaResumeClear();   /* ★ v2-147 */\n")

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
