#!/usr/bin/env python3
"""📘 예비고1 특강 회차별 진도표 만들기 (2026-11-16 원장과 상의해 확정한 A안)

준비: node sync/mf_workbook_list.js --bid 3119992 --out wb_3119992.json (개념원리 공수1) · 3119997 RPM 공수1 · 3129991 개념원리 공수2 · 3129989 RPM 공수2
규칙: 방학 전(11/19~1/7) 화목토 정규 = 진도(클리닉 없음) · 방학(1/8~) 월수금 오전 특강 = 진도, 정규 = 클리닉
공수1 31쪽부터, 1/8~1/13 오전 3회 회당 20쪽으로 공수1 끝, 1/15~2/26 공수2 고르게(회당 약 16쪽). 대단원 끝 회차에 테스트 표시만.
결과 x/prehigh1.xlsx → 드라이브 「예비고1 공수1·2 진도표 (2026.11~2027.2)」. 학생 정보 없음.
"""
import datetime as D,json,openpyxl
from openpyxl.styles import PatternFill,Font,Alignment,Border,Side
H={D.date(2026,12,25),D.date(2027,1,1),D.date(2027,2,6),D.date(2027,2,8),D.date(2027,2,9)}
V=(D.date(2026,12,31),D.date(2027,1,3));VS=D.date(2027,1,8)
S=[];x=D.date(2026,11,19)
while x<=D.date(2027,2,27):
  w=x.weekday()
  if x not in H and not V[0]<=x<=V[1]:
    if x<VS and w in(1,3,5): S.append((x,'정규(진도)'))
    if x>=VS and w in(0,2,4): S.append((x,'오전 특강'))
  x+=D.timedelta(1)
pre=[s for s in S if s[0]<VS];vac=[s for s in S if s[0]>=VS]
def units(b):
  d=json.load(open(f'wb_{b}.json'));u={}
  for q in d:
    a=u.setdefault(q['unit'],[q['page'],q['page']]);a[0]=min(a[0],q['page']);a[1]=max(a[1],q['page'])
  return u
G1,R1,G2,R2=units(3119992),units(3119997),units(3129991),units(3129989)
# continuous page stream: 공수1 31..297 then 공수2 11..291
stream=[('공수1',p) for p in range(31,298)]+[('공수2',p) for p in range(11,292)]
def chunks(lst,n):
  out=[];step=len(lst)/n
  for i in range(n): out.append(lst[round(i*step):round((i+1)*step)])
  return out
g1=[x for x in stream if x[0]=='공수1'];g2=[x for x in stream if x[0]=='공수2']
i238=[p for s,p in g1].index(238)
parts=chunks(g1[:i238],len(pre))+chunks(g1[i238:],3)+chunks(g2,len(vac)-3)
TEST={('공수1',75):'다항식 단원 테스트',('공수1',229):'방정식과 부등식 단원 테스트',('공수1',271):'경우의 수 단원 테스트',('공수1',297):'행렬 · 공수1 단원 테스트',('공수2',118):'도형의 방정식 단원 테스트',('공수2',203):'집합과 명제 단원 테스트',('공수2',291):'함수 · 공수2 단원 테스트'}
rows=[]
for i,((dt,kind),ch) in enumerate(zip(S,parts),1):
  segs=[]
  for subj in ('공수1','공수2'):
    ps=[p for s,p in ch if s==subj]
    if not ps: continue
    G,R=(G1,R1) if subj=='공수1' else (G2,R2)
    a,b=ps[0],ps[-1];us=[k for k,(s,e) in G.items() if not(e<a or s>b)]
    rp=[R[k] for k in us if k in R]
    segs.append((subj,a,b,us,(min(r[0] for r in rp),max(r[1] for r in rp)) if rp else None))
  rows.append((i,dt,kind,segs,len(ch)))

wb=openpyxl.Workbook();ws=wb.active;ws.title="예비고1 진도표"
ws.append(["예비고1 공통수학1·2 진도표 (2026.11.19 ~ 2027.2.26) · 진도교재 개념원리 / 유형 RPM"]);ws.merge_cells("A1:I1");ws["A1"].font=Font(bold=True,size=14)
ws.append(["방학 전: 화·목 19:30~22:00, 토 10:30~13:00 진도(회당 약 10쪽) · 방학(1/8~): 월수금 오전 특강 진도(공수1 회당 20쪽, 공수2 1/15~ 회당 약 16쪽), 정규수업은 클리닉 · 휴강 12/31~1/3, 설 2/6~2/9"]);ws.merge_cells("A2:I2")
hdr=["회","날짜","요일","구분","과목","개념원리 쪽","RPM 쪽","단원","테스트"];ws.append(hdr)
thin=Side(style="thin",color="FFBBBBBB")
for c in ws[3]: c.font=Font(bold=True);c.fill=PatternFill("solid",fgColor="FFD9D9D9")
PRE=PatternFill("solid",fgColor="FFA4C2F4");VAC=PatternFill("solid",fgColor="FFB6D7A8")
for i,dt,kind,segs,n in rows:
  ws.append([i,dt.strftime("%m/%d"),"월화수목금토일"[dt.weekday()],kind," / ".join(s[0] for s in segs),
    " / ".join(f"{s[1]}~{s[2]}" for s in segs)," / ".join(f"{s[4][0]}~{s[4][1]}" if s[4] else "" for s in segs),
    " · ".join(u for s in segs for u in s[3]), " · ".join(t for (sj,pg),t in TEST.items() if any(s[0]==sj and s[1]<=pg<=s[2] for s in segs))])
  if ws.cell(ws.max_row,9).value: ws.cell(ws.max_row,9).font=Font(bold=True,color="FFC00000")
  r=ws.max_row
  for c in ws[r]: c.border=Border(top=thin,bottom=thin,left=thin,right=thin)
  ws.cell(r,4).fill=PRE if kind.startswith("정규") else VAC
for col,w in zip("ABCDEFGHI",[5,8,5,11,12,13,11,55,26]): ws.column_dimensions[col].width=w
wb.save("x/prehigh1.xlsx")

