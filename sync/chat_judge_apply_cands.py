#!/usr/bin/env python3
# 채팅 판정 결과 → 서버 «우리 자료 후보»(items[].cands) 판 (2026-10-17 원장 「중등부도 채팅에서 다시 판정해서 학원앱에」)
#   python3 sync/chat_judge_apply_cands.py <examId> judge_cands.json [judge_cands2.json …]
#   judge 파일 모양 {"<시험 번호>":[{"i":후보번호,"kind":"same|var|text|type|none","why":"근거"}]} — 없는 후보·none 은 뺀다
#   · 원장님이 ✓/✗ 확정한 것(items[].hit)은 그대로 둔다
#   · 통계(stats.same/var/text/type · byKind[].hit · ms.mp.hit)는 워커(sync/exam_hit_worker.js ⑤ 통계)와 같은 식으로 다시 센다
#   · exam_hit_index 의 auto 숫자도 맞춘다 · stats.judgedBy='chat' · chatAt
import os,sys,json,re,urllib.request,urllib.parse,datetime
U=os.environ['SUPABASE_URL'];K=os.environ['SUPABASE_SERVICE_KEY']
H={'apikey':K,'Authorization':'Bearer '+K,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}
eid=sys.argv[1]; files=sys.argv[2:]
def kv(k):
  r=urllib.request.Request(U+'/rest/v1/lumen_store?key=eq.'+urllib.parse.quote(k)+'&select=value',headers=H); j=json.load(urllib.request.urlopen(r)); return j[0]['value'] if j else None
def put(k,v):
  now=datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00','Z')
  urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/lumen_store?on_conflict=key',data=json.dumps([{'key':k,'value':v,'updated_at':now}]).encode(),headers=H,method='POST'))
d=kv('exam_hit_'+eid)
J={}
for f in files: J.update(json.load(open(f)))
RANK={'same':4,'var':3,'text':2,'type':1}
changed=0; dropped=0
for it in d['items']:
  C=it.get('cands') or []; jj={int(x['i']):x for x in J.get(str(it['no']),[])}
  if not jj: continue
  new=[]
  for i,c in enumerate(C,1):
    v=jj.get(i)
    if not v or v.get('kind') not in RANK: dropped+=1; continue
    if c.get('kind')!=v['kind']: changed+=1
    new.append(dict(c,kind=v['kind'],why=str(v.get('why',''))[:40],by='chat'))
  new.sort(key=lambda x:-RANK.get(x['kind'],0))
  it['cands']=new
st=d['stats']; mats=d.get('mats') or {}
for k in('same','var','text','type'): st[k]=0
for x in d['items']:
  t=(x.get('cands') or [None])[0]
  if t and t['kind'] in st: st[t['kind']]+=1
basis=d.get('basis') or 'same+var'
inB={'same':['same'],'same+var':['same','var'],'type':['same','var','type']}.get(basis,['same','var'])
for k,v in (st.get('byKind') or {}).items():
  v['hit']=0
  if isinstance(v.get('mp'),dict): v['mp']['hit']=0
for x in d['items']:
  t=(x.get('cands') or [None])[0]
  if not t or t['kind'] not in inB: continue
  m=mats.get(t['k'])
  if m and m.get('kind') in st.get('byKind',{}): st['byKind'][m['kind']]['hit']+=1
  if re.match(r'^mp:',t['k']) and isinstance(st.get('byKind',{}).get('ms',{}).get('mp'),dict): st['byKind']['ms']['mp']['hit']+=1
st['judgedBy']='chat'; d['chatAt']=datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00','Z')
put('exam_hit_'+eid,d)
idx=kv('exam_hit_index') or {'items':[]}
for e in idx.get('items',[]):
  if e.get('examId')==eid: e['auto']={'same':st['same'],'var':st['var'],'type':st['type'],'text':st['text']}
put('exam_hit_index',idx)
print('saved',eid,'바뀐 후보',changed,'뺀 후보',dropped,'1순위 same',st['same'],'var',st['var'],'text',st['text'],'type',st['type'],'byKind',{k:v['hit'] for k,v in st.get('byKind',{}).items()})
