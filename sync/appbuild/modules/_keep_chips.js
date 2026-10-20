/* ═══ 화면 공통 조각 ═══ */
function eaChip(label,on,onclick,extra){
  return '<button onclick="'+onclick+'" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;cursor:pointer;border:1.5px solid '
    +(on?'#0d2240':'#e6eaf1')+';background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':'#475569')+(extra||'')+'">'+label+'</button>';
}
function eaBtn(label,onclick,kind){
  var bg=(kind==='pri')?'#0d2240':((kind==='blue')?'#1d6fe8':'#fff'), fg=(kind==='pri'||kind==='blue')?'#fff':'#334155', bd=(kind==='pri'||kind==='blue')?bg:'#e6eaf1';
  return '<button onclick="'+onclick+'" style="font-family:inherit;font-size:12.5px;font-weight:800;padding:8px 14px;border-radius:10px;cursor:pointer;border:1.5px solid '+bd+';background:'+bg+';color:'+fg+'">'+label+'</button>';
}
function eaCard(){ return 'background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:13px 15px;margin-bottom:12px'; }
