/* ═══════════════════════════════════════════════════════════════════
 * v19-164: 📋 상담 리포트 — 번호 · 계획 칸은 원장님만 · 📱 모바일 이미지 (원장 10/26
 *   「상담보고서에서 저 내용(다음 달 계획·가정에서)은 나만 보게 · 표랑 그래프마다 번호를 매기자, 통화하면서 몇 번을 보라고 할 예정 ·
 *    학부모 보고서는 핸드폰으로 보니 모바일 버전 이미지 출력도 있으면 좋겠다」)
 *   ① 그래프·표마다 번호(1, 2, 3 … · 과정별 시험은 7-1, 7-2 …) — 화면·인쇄·모바일 이미지 모두 같은 번호. 통화 대본 «꼭 짚을 것»에 «리포트 1~3번».
 *   ② «다음 달 학원 계획 / 가정에서 도와주실 것»은 🔒 원장님만 — 인쇄·모바일 이미지에서 뺀다(화면·상담 기록 탭에만).
 *   ③ 📱 모바일 이미지: 폭 480px 한 줄 배치로 그려 PNG 로 저장(html2canvas). 넓은 그래프는 글자를 키워 폰에서 읽히게.
 *   ※ 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var CR_M = false;
CR_CSS += '.cr-no{display:inline-flex;min-width:24px;height:24px;padding:0 6px;border-radius:12px;background:#0d2240;color:#fff;font-size:13px;font-weight:900;align-items:center;justify-content:center;margin-right:7px;vertical-align:2px}'
  + '.cr-no.sm{min-width:30px;height:20px;font-size:11.5px;background:#475569;margin-right:6px;vertical-align:1px}'
  + '.cr-focus .cr-no{background:#e0670b}';
CR_PRINT_CSS += '.cr-no{min-width:19px;height:19px;font-size:11px;margin-right:5px}.cr-no.sm{min-width:24px;height:16px;font-size:9.5px}';
var CR_MOB_CSS = '.cr-mob{width:480px;background:#fff;padding:14px 12px 18px;font-family:"Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
  + '.cr-mob .cr{max-width:none;gap:10px;font-size:14px}'
  + '.cr-mob .cr-sum,.cr-mob .cr-grid,.cr-mob .cr-tps,.cr-mob .cr-plan{grid-template-columns:minmax(0,1fr)!important}'
  + '.cr-mob .cr-card.wide{grid-column:auto}.cr-mob .cr-cls{grid-template-columns:repeat(5,minmax(0,1fr))!important}'
  + '.cr-mob .cr-top{flex-direction:column;align-items:flex-start;padding:14px 16px}.cr-mob .cr-top .wh{text-align:left}.cr-mob .cr-top h1{font-size:22px}'
  + '.cr-mob .cr-focus{padding:12px 12px}.cr-mob .cr-card{padding:10px 12px 8px}.cr-mob h3{font-size:16px}.cr-mob .cr-take{font-size:13px}'
  + '.cr-mob .cr-big b,.cr-mob .cr-cd .rp,.cr-mob .cr-legend span,.cr-mob .cr-sum b{white-space:nowrap}.cr-mob .cr-no,.cr-mob .cr-tag,.cr-mob .cr-tp-h b,.cr-mob .cr-top h1{white-space:nowrap;flex-shrink:0}.cr-mob .cr-top h1{line-height:1.35}.cr-mob .cr-top{padding-bottom:18px}.cr-mob .cr-top .wh{white-space:nowrap;line-height:1.6}.cr-mob .cr-top>div{min-width:0}.cr-mob .cr-big span{flex:1 1 90px;min-width:0}.cr-mob .cr-legend{font-size:12px}.cr-mob .cr-big b{font-size:24px}.cr-mob .cr-cd .m{font-size:18px}.cr-mob .cr-cd .d{font-size:12px}';
/* 모바일: 넓은 그래프(viewBox 900)는 폰 화면에서 글자가 너무 작아진다 → 글자만 키우고, 긴 왼쪽 이름은 줄인다 */
var _sSvg161 = sSvg;
sSvg = function(w, h, body, label){
  if (CR_M){
    var k = Math.max(1, Math.min(2.2, w / 430));
    if (k > 1.05){
      body = body.replace(/(<text x="([\d.]+)"[^>]*text-anchor="([a-z]+)"[^>]*font-size=")([\d.]+)(")/g, function(m, pre, x, anc, v, post){ var kk = (anc === 'end' && Number(x) < 70) ? Math.min(k, 1.3) : k; return pre + (Number(v) * kk).toFixed(1) + post; })
        .replace(/(\d+)일 (동안 \d+문항|비어 있음)/g, '$1일')
        .replace(/\(이번 주\)/g, '')
        .replace(/(<text x="([\d.]+)"[^>]*text-anchor="end"[^>]*>)([^<]{10,})(<\/text>)/g, function(m, a, x, t, z){ return Number(x) < 230 ? a + t.slice(0, 7) + '…' + z : m; });
    }
  }
  return _sSvg161(w, h, body, label);
};
var _crReport161 = crReport;
crReport = function(X, mode){
  var h = _crReport161(X, mode), plan = h.indexOf('<div class="cr-plan">'); if (plan < 0) plan = h.length;
  var n = 0, cur = 0, sub = 0;
  h = h.replace(/<h3>|<div class="cr-tp-h"><b>/g, function(m, off){
    if (off >= plan) return m;
    if (m === '<h3>'){ n++; cur = n; sub = 0; return '<h3><span class="cr-no">' + n + '</span>'; }
    sub++; return '<div class="cr-tp-h"><span class="cr-no sm">' + cur + '-' + sub + '</span><b>'; });
  if (mode === 'print'){ var p2 = h.indexOf('<div class="cr-plan">'), f = h.indexOf('<div class="cr-foot">'); if (p2 >= 0 && f > p2) h = h.slice(0, p2) + h.slice(f); }
  else h = h.replace('<h3>다음 달 학원 계획 <span style="font-size:11.5px;color:#5f6b80;font-weight:600">한 줄에 하나 · 고쳐 쓰세요</span></h3>', '<h3>🔒 다음 달 학원 계획 <span style="font-size:11.5px;color:#5f6b80;font-weight:600">원장님만 · 인쇄·이미지에 빠짐 · 한 줄에 하나</span></h3>')
    .replace('<h3>가정에서 도와주실 것</h3>', '<h3>🔒 가정에서 도와주실 것</h3>');
  return h;
};
if (typeof cn2Log === 'function'){ var _cn2Log162 = cn2Log; cn2Log = function(st, X){ return _cn2Log162(st, X).replace('리포트 인쇄에도 이 칸이 나갑니다', '🔒 원장님만 — 인쇄·모바일 이미지에는 빠집니다'); }; }
if (typeof cnsScript === 'function'){ var _cnsScript162 = cnsScript; cnsScript = function(g, kind){ var out = _cnsScript162(g, kind);
  out.forEach(function(o){ if (/^꼭 짚을 것 — /.test(o.t)) o.say += ' <span class="cns-hl2">📊 리포트 1·2·3번 그래프를 같이 보시면 됩니다.</span>'; }); return out; }; }
/* 📱 모바일 이미지 */
/* 그림이 하얗게만 나왔는지 (가운데 세로줄 40곳을 본다) */
function crBlank(cv){ try { var c = cv.getContext('2d'), x = Math.floor(cv.width * 0.3); for (var i = 1; i <= 40; i++){ var d = c.getImageData(x, Math.floor(cv.height * i / 41), 1, 1).data; if (d[0] < 235 || d[1] < 235 || d[2] < 235) return false; } return true; } catch(e){ return true; } }
window.crMobile = async function(){
  var X = null; try { X = crCompute(); } catch(e){} if (!X){ try { plToast('리포트를 먼저 불러오세요'); } catch(e){} return; }
  try { plToast('📱 이미지 만드는 중…'); } catch(e){}
  try { if (typeof html2canvas === 'undefined') await _mrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); } catch(e){ alert('이미지 도구를 불러오지 못했습니다 — 인터넷 연결을 확인하세요'); return; }
  CR_M = true; var html; try { html = crReport(X, 'print'); } finally { CR_M = false; }
  var host = document.createElement('div'); host.id = 'cr-mob-host'; host.className = 'cr-mob';
  host.style.cssText = 'position:absolute;left:0;top:0;z-index:-9999;pointer-events:none';   /* 화면 뒤 맨 위 — foreignObject 는 화면 밖이면 빈 그림이 된다 */
  host.innerHTML = '<style>' + CR_CSS + CR_MOB_CSS + '</style>' + html;
  document.body.appendChild(host);
  try {
    await new Promise(function(r){ setTimeout(r, 120); });
    var hh = host.scrollHeight, sc = (480 * 2 * hh * 2 > 16000000) ? 1.5 : 2;
    /* 브라우저가 그린 그대로(foreignObject) 먼저 — 글자 간격·줄바꿈이 정확하다. 막히면(일부 사파리) 예전 방식 */
    var canvas = null, url = '';
    try { canvas = await html2canvas(host, { scale: sc, useCORS: true, backgroundColor: '#ffffff', windowWidth: 480, foreignObjectRendering: true }); if (crBlank(canvas)) throw new Error('blank'); url = canvas.toDataURL('image/png'); }
    catch(e1){ canvas = await html2canvas(host, { scale: sc, useCORS: true, backgroundColor: '#ffffff', windowWidth: 480 }); url = canvas.toDataURL('image/png'); }
    var name = X.st.name + '_상담리포트_' + X.to + '.png';
    var ov = document.createElement('div'); ov.id = 'cr-mob-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.72);display:flex;flex-direction:column;align-items:center;padding:16px;overflow:auto';
    ov.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;justify-content:center"><a href="' + url + '" download="' + crE(name) + '" style="background:#0d2240;color:#fff;border-radius:10px;padding:9px 16px;font-weight:900;text-decoration:none;font-size:14px">⬇ 이미지 저장</a>'
      + '<button type="button" onclick="document.getElementById(\'cr-mob-ov\').remove()" style="border:none;border-radius:10px;padding:9px 16px;font-weight:900;font-size:14px;cursor:pointer">닫기</button></div>'
      + '<div style="color:#e2e8f0;font-size:12.5px;font-weight:700;margin-bottom:8px">카톡으로 보낼 땐 저장한 그림을 보내세요 · 아이패드는 그림을 길게 눌러 «사진에 저장» · 원장님 계획·메모는 빠져 있습니다</div>'
      + '<img src="' + url + '" alt="모바일 상담 리포트" style="width:min(420px,100%);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.4)">';
    document.body.appendChild(ov);
  } catch(e){ alert('이미지 만들기 실패: ' + e.message); }
  finally { host.remove(); }
};
/* 단추 — 📞 학부모 상담 위쪽 줄(인쇄 옆) */
if (typeof rCounsel === 'function'){ var _rCounsel162 = rCounsel; rCounsel = function(){
  return _rCounsel162().replace('<button type="button" onclick="cn2Print()"', '<button type="button" onclick="crMobile()" style="font-family:inherit;font-size:12.5px;font-weight:900;border-radius:10px;padding:7px 12px;cursor:pointer;border:1.5px solid #0d2240;background:#fff;color:#0d2240">📱 모바일 이미지</button><button type="button" onclick="cn2Print()"'); }; }
