#!/usr/bin/env python3
# 채팅 판정용 그림 묶음 (API 절약 2026-10-12): python3 sync/chat_judge_sheets.py <examId> <출력폴더> [pub]
#   워커를 AI 없이 돌려 남긴 후보(it.pub 등)를 «시험 문항 + 후보 #번호» 그림으로 묶는다 → 채팅(하위 에이전트)이 보고 판정
# 판정용 그림 묶음: 시험 문항(위) + 후보 최대 6개(번호), 문항별 여러 장. 결과 목록 sheets.json
import os,sys,json,io,urllib.request,urllib.parse
from PIL import Image, ImageDraw, ImageFont
U=os.environ['SUPABASE_URL'];K=os.environ['SUPABASE_SERVICE_KEY'];H={'apikey':K,'Authorization':'Bearer '+K}
OUT=sys.argv[2]; eid=sys.argv[1]; field=sys.argv[3] if len(sys.argv)>3 else 'pub'
def kv(k):
  r=urllib.request.Request(U+'/rest/v1/lumen_store?key=eq.'+urllib.parse.quote(k)+'&select=value',headers=H); return json.load(urllib.request.urlopen(r))[0]['value']
def st(path):
  r=urllib.request.Request(U+'/storage/v1/object/exam_images/'+urllib.parse.quote(path),headers=H); return urllib.request.urlopen(r,timeout=60).read()
def url(u):
  return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',28)
except: F=ImageFont.load_default()
def fit(im,w):
  im=im.convert('RGB'); 
  if im.width>w: im=im.resize((w,int(im.height*w/im.width)))
  return im
d=kv('exam_hit_'+eid); out=[]
for it in d['items']:
  C=it.get(field) or []
  if not C or not it.get('img'): continue
  ex=fit(Image.open(io.BytesIO(st(it['img']))),900)
  for s in range(0,len(C),6):
    grp=C[s:s+6]; ims=[]
    for c in grp:
      try: ims.append(fit(Image.open(io.BytesIO(url(c.get('imgUrl') or d.get('mats',{}).get(c['k'],{}).get('img')))),440))   # 2026-10-17: cands 는 mats[k].img
      except Exception as e: ims.append(Image.new('RGB',(440,80),'white'))
    W=900; rows=[ims[i:i+2] for i in range(0,len(ims),2)]
    hh=ex.height+60+sum(max(x.height for x in r)+50 for r in rows)
    sh=Image.new('RGB',(W,hh),'white'); dr=ImageDraw.Draw(sh)
    dr.text((8,8),'EXAM Q%s'%it['no'],fill='red',font=F); sh.paste(ex,(0,44)); y=ex.height+56
    dr.line((0,y-8,W,y-8),fill='black',width=4)
    for ri,r in enumerate(rows):
      x=0; h=max(z.height for z in r)
      for ci,z in enumerate(r):
        n=s+ri*2+ci+1; dr.text((x+6,y+4),'#%d'%n,fill='blue',font=F); sh.paste(z,(x,y+40)); x+=460
      y+=h+50
    fn='%s/q%02d_%d.png'%(OUT,it['no'],s//6); sh.save(fn); out.append({'no':it['no'],'file':fn,'from':s+1,'to':s+len(grp)})
json.dump(out,open(OUT+'/sheets.json','w')); print(len(out),'sheets')
