#!/usr/bin/env python3
# 채팅 판정 결과 → 서버 (API 절약 2026-10-12): python3 sync/chat_judge_apply_pub.py <examId> judge_A.json judge_B.json …
#   judge 파일 모양 {"<시험 번호>":[{"i":후보번호,"kind":"same|var|text","why":"근거"}]} — 없는 후보는 none 으로 빠진다
# 채팅 판정(judge_*.json) → exam_hit_<id>.items[].pub · stats.pub (워커 pubCompare 와 같은 모양)
import os,sys,json,glob,urllib.request,urllib.parse,datetime
U=os.environ['SUPABASE_URL'];K=os.environ['SUPABASE_SERVICE_KEY']
H={'apikey':K,'Authorization':'Bearer '+K,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}
eid=sys.argv[1]; files=sys.argv[2:]
r=urllib.request.Request(U+'/rest/v1/lumen_store?key=eq.'+urllib.parse.quote('exam_hit_'+eid)+'&select=value',headers=H); d=json.load(urllib.request.urlopen(r))[0]['value']
J={}
for f in files: J.update(json.load(open(f)))
ORD={'same':4,'var':3,'text':2}
P=d['stats']['pub']; by={b['pub']:{'same':0,'var':0,'text':0,'type':0,'nos':[]} for b in P['books']}; items=0
for it in d['items']:
  C=it.get('pub') or []; jj={int(x['i']):x for x in J.get(str(it['no']),[])}
  new=[]
  for i,c in enumerate(C,1):
    if c.get('by')=='teacher': new.append(c); continue   # 2026-10-12 학원앱 v19-116: 원장님이 고른 등급은 그대로
    v=jj.get(i)
    if v and v['kind'] in ORD: c=dict(c,kind=v['kind'],why=str(v.get('why',''))[:40]); new.append(c)
  SORT=dict(ORD,type=1)
  new.sort(key=lambda x:(-SORT.get(x['kind'],0),x['pub']))
  it['pub']=new; top=new[0] if new else None
  it['pubTop']={'k':top['k'],'kind':top['kind'],'pub':top['pub']} if top else None
  best={}
  for x in new:
    if x.get('rejected'): continue
    if x['pub'] not in best or SORT.get(x['kind'],0)>SORT.get(best[x['pub']],0): best[x['pub']]=x['kind']
  for pb,k in best.items():
    by.setdefault(pb,{'same':0,'var':0,'text':0,'type':0,'nos':[]}); by[pb][k]+=1
    if k in('same','var'): by[pb]['nos'].append(it['no'])
  if top and top['kind'] in('same','var'): items+=1
P['by']=by; P['items']=items; P['judgedBy']='chat'
now=datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00','Z')
urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/lumen_store?on_conflict=key',data=json.dumps([{'key':'exam_hit_'+eid,'value':d,'updated_at':now}]).encode(),headers=H,method='POST'))
print('saved', items)
