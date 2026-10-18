# 학생앱 v2-142 조립 — «v2-141 복사 + rep 고침»  (만들기만 · 배포는 원장 지시 때)
#   원장 2026-10-18 밤 「보스 배경도 만들어줘」 — 계약 docs/raid_s2_contract.md §7
#   1) 레이드 카드 무대 — 순위판 항목에 bgArt {key,name,w:128,h:72,floor:58,pal,rows} 가 있으면
#      어두운 별밤 바탕·보스 받침·바닥 띠 대신 그 배경을 깐다.
#      · 배율 = 무대 가로를 꽉 채우는 정수 배율(330칸 무대 · 128칸 배경 → 3배, 양옆 9칸씩 잘림 —
#        영웅·보스와 같은 한 칸 3px 라 도트 크기가 한 가지로 맞는다)
#      · 보스도 같은 배율, 배경 가운데, 맨 아래 줄이 배경 64번째 줄(top = (64 − 보스 높이) × 배율, 0 아래면 0)
#      · 보스가 무대보다 넓거나 영웅 줄까지 내려오면 배경·보스를 함께 한 단계씩 줄인다
#        (줄어서 배경이 가로를 못 채우면 양옆은 배경을 거울처럼 이어 붙인다)
#      · 배경 아래(영웅들이 서는 곳)는 배경 맨 아래 4줄을 (옆으로 밀어 가며) 이어 깔고 살짝 어둡게 — 영웅이 앞에 서 보이게
#      · 영웅·파티 그리기는 예전 그대로. bgArt 가 없으면 예전 그대로(픽셀까지 같다).
#      · 배경 이름은 어디에도 안 쓴다.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-141.html'); DST = os.path.join(ROOT, 'student_v2-142.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-141';", "var STU_VER = 'v2-142';")

# ── 1) 배경 그리기 도우미 (rdBossOf 바로 뒤) ─────────────────────
rep("""  return { ic:'⚔️', n:(r&&r.art&&r.art.name)?String(r.art.name):'보스' };
}""", """  return { ic:'⚔️', n:(r&&r.art&&r.art.name)?String(r.art.name):'보스' };
}
/* ★ v2-142: 보스 배경 (계약 docs/raid_s2_contract.md §7)
 *   raid.bgArt = { key, name, w:128, h:72, floor:58, pal, rows } — 글자표는 보스 그림과 같다(RD_ART_CH).
 *   배경은 꽉 찬 그림이고 아래 14줄(58~71)이 바닥. 보스는 맨 아래 줄이 배경 64번째 줄(floor+6)에 선다.
 *   배율: 무대 가로를 꽉 채우는 정수 배율(330 / 128 → 3). 보스가 무대보다 넓거나
 *   영웅 줄(limit px)까지 내려오면 배경·보스를 함께 한 단계씩 줄인다. */
function rdBgLayout(cv, bgG, boss, floor, limit){
  var gw=bgG[0].length, gh=bgG.length, bw=boss[0].length, bh=boss.length;
  var gy=(Number(floor)>0?Number(floor):58)+6;
  var s=Math.max(1,Math.ceil(cv.width/gw));
  while(s>1 && (bw*s>cv.width || Math.max(gy,bh)*s>limit)) s--;
  var ox=Math.round((cv.width-gw*s)/2);
  var bx=ox+Math.round((gw-bw)/2)*s;                 /* 배경 칸에 맞춰 가운데 — 도트 격자가 어긋나지 않게 */
  bx=Math.max(0,Math.min(cv.width-bw*s,bx));
  return { s:s, ox:ox, gw:gw, gh:gh, gy:gy, bw:bw, bh:bh, bx:bx, by:Math.max(0,(gy-bh)*s) };
}
/* 배경 한 장을 미리 그려 둔다(0.11초마다 다시 그리므로) — 같은 그림·같은 배율이면 다시 쓴다.
 *   가로가 모자라면(줄였을 때) 양옆은 배경을 거울처럼 이어 붙이고,
 *   배경 아래(영웅들이 서는 곳)는 맨 아래 4줄을 이어 깔고 살짝 어둡게 한다. */
function rdBgCanvas(cv, bgG, L){
  var k=cv.width+'x'+cv.height+'@'+L.s+'/'+L.ox;
  if(RD._bg && RD._bg.g===bgG && RD._bg.k===k) return RD._bg.cv;
  var c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height;
  var x2=c.getContext('2d'); x2.imageSmoothingEnabled=false;
  x2.fillStyle='#0d0a1d'; x2.fillRect(0,0,c.width,c.height);
  var s=L.s, gw=L.gw, gh=L.gh, p=2*gw, tail=Math.min(4,gh);
  var x0=Math.floor(-L.ox/s), x1=Math.ceil((c.width-L.ox)/s), y1=Math.ceil(c.height/s);
  for(var y=0;y<y1;y++){
    var row=bgG[y<gh?y:(gh-tail+((y-gh)%tail))];
    var sh=y<gh?0:Math.floor((y-gh)/tail)*37;        /* 이어 깐 바닥은 4줄마다 옆으로 밀어 — 세로 줄무늬가 안 생기게 */
    for(var x=x0;x<x1;x++){
      var sx=(((x+sh)%p)+p)%p; if(sx>=gw) sx=p-1-sx;
      var col=row[sx]; if(!col) continue;
      x2.fillStyle=col; x2.fillRect(L.ox+x*s,y*s,s,s);
    }
  }
  if(y1>gh){ x2.fillStyle='rgba(6,3,14,.3)'; x2.fillRect(0,gh*s,c.width,c.height-gh*s); }
  RD._bg={ g:bgG, k:k, cv:c };
  return c;
}""")

# ── 2) rdPaint — bgArt 가 있으면 별밤·받침·바닥 띠 대신 배경 ─────────
rep("""  var t=RD.anim;
  ctx.fillStyle='#0d0a1d'; ctx.fillRect(0,0,cv.width,cv.height);""",
"""  var t=RD.anim;
  /* ★ v2-142: 보스 배경(bgArt)이 있으면 별밤 바탕·보스 받침·바닥 띠 대신 배경을 깔고 보스를 그 위에.
   *   영웅·파티는 아래에서 예전 그대로 그린다. bgArt 가 없으면 예전 그대로. */
  var bgG=rdArtGrid(b.bgArt), GROUND=LH-4;
  if(bgG){
    var L=rdBgLayout(cv, bgG, boss, b.bgArt.floor, (GROUND-H-20)*S);
    ctx.drawImage(rdBgCanvas(cv, bgG, L), 0, 0);
    var gbob=Math.floor(t/9)%2, gs=L.s;
    if(L.bh<=L.gy && L.bw>4){                         /* 발밑 그림자 — 바닥에 서 있는 느낌 */
      ctx.fillStyle='rgba(0,0,0,.32)';
      ctx.fillRect(L.bx+2*gs, L.by+(L.bh-1)*gs, (L.bw-4)*gs, 2*gs);
    }
    for(var gy2=0;gy2<L.bh;gy2++) for(var gx2=0;gx2<L.bw;gx2++){
      var gc=boss[gy2][gx2]; if(!gc) continue;
      ctx.fillStyle=gc; ctx.fillRect(L.bx+gx2*gs, L.by+(gy2+gbob)*gs, gs, gs);
    }
  } else {
  ctx.fillStyle='#0d0a1d'; ctx.fillRect(0,0,cv.width,cv.height);""")
rep("""      ctx.fillStyle=bc; ctx.fillRect(bpx+bx*bs,bpy+by*bs,bs,bs);
    }
  }
""", """      ctx.fillStyle=bc; ctx.fillRect(bpx+bx*bs,bpy+by*bs,bs,bs);
    }
  }
  }   /* ★ v2-142: 배경 없을 때(예전 그대로) 끝 */
""")

log = """ * v2-142 (2026-10-18) 🏞 보스 배경 (원장 「보스 배경도 만들어줘」 · 계약 docs/raid_s2_contract.md §7)
 *   · <b>레이드 무대</b>: 레이드에 보스 배경(bgArt — 화산·어둠의 성·바다 밑·밤 숲·수정 동굴·해골 무덤·시험장·노을 구름)이
 *     있으면 어두운 별밤 대신 그 배경을 무대 가로 가득(한 칸 3px — 영웅·보스와 같은 도트 크기) 깝니다.
 *     보스는 배경 가운데, 바닥(배경 64번째 줄)에 발을 딛고 서고 발밑에 옅은 그림자.
 *     영웅들은 예전 자리 그대로, 배경 아래로 이어 깐 어두운 바닥 위에 섭니다.
 *     보스가 너무 크면 배경과 보스를 함께 줄입니다. 배경이 없는 레이드는 예전 그대로.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
