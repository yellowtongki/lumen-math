#!/usr/bin/env python3
"""📅 다음 해 학사일정 시트 만들기 (2026-11-16, 원장 「27년 것 같은 형식으로, 26년과 색상배열 똑같이」)

바탕: 구글드라이브 「2026 학사일정」을 xlsx 로 내려받아 x/2026.xlsx 에 둔다(드라이브 download_file_content, export xlsx).
규칙(2026 파일에서 읽음): 반별 시트(월수금 12회 · 화목 8회 · 화목토 12회 묶음), 묶음마다 파랑 FFA4C2F4 → 초록 FFB6D7A8 번갈아,
방학 분홍 FFF4CCCC, 일요일·공휴일 빨간 글자, 토요일 파란 글자, 달마다 아래 메모 칸(hr+8)에 공휴일·방학.
HOL·VAC·NOTE 를 그해 값으로 고치고: python3 -I sync/year_schedule_build.py  → x/2027.xlsx → 드라이브 create_file(변환됨)
공휴일은 우주항공청 월력요항 기준(2027: 노동절·제헌절 대체공휴일 포함). 학생 정보 없음.
"""
import sys,copy,datetime as D,openpyxl
from openpyxl.styles import PatternFill,Font
from openpyxl.utils import column_index_from_string as ci
wb=openpyxl.load_workbook("x/2026.xlsx")
d=D.date
HOL={d(2027,1,1):"신정",d(2027,2,6):"설",d(2027,2,7):"설",d(2027,2,8):"설",d(2027,2,9):"설 대체",d(2027,3,1):"삼일절",d(2027,5,1):"노동절",d(2027,5,3):"노동절 대체",d(2027,5,5):"어린이날",d(2027,5,13):"부처님오신날",d(2027,6,6):"현충일",d(2027,7,17):"제헌절",d(2027,7,19):"제헌절 대체",d(2027,8,15):"광복절",d(2027,8,16):"광복절 대체",d(2027,9,14):"추석",d(2027,9,15):"추석",d(2027,9,16):"추석",d(2027,10,3):"개천절",d(2027,10,4):"개천절 대체",d(2027,10,9):"한글날",d(2027,10,11):"한글날 대체",d(2027,12,25):"성탄절",d(2027,12,27):"성탄절 대체"}
VAC=[(d(2026,12,31),d(2027,1,3)),(d(2027,7,14),d(2027,7,19)),(d(2027,12,30),d(2028,1,2))]
vac=lambda x:any(a<=x<=b for a,b in VAC)
NOTE={1:"1/1 신정 · 1/1~1/3 겨울방학",2:"2/6~8 설날 · 2/9 대체휴일",3:"3/1 삼일절",4:"",5:"5/1 노동절 · 3 대체휴일 · 5/5 어린이날 · 13 부처님오신날",6:"6/6 현충일",
      7:"7/14~19 여름방학 · 7/17 제헌절 · 19 대체휴일",8:"8/15 광복절 · 16 대체휴일",9:"9/14~16 추석",10:"10/3 개천절 · 4 대체 · 10/9 한글날 · 11 대체",11:"",12:"12/25 성탄절 · 27 대체 · 12/30~ 겨울방학"}
G=PatternFill("solid",fgColor="FFB6D7A8");B=PatternFill("solid",fgColor="FFA4C2F4");PK=PatternFill("solid",fgColor="FFF4CCCC");NONE=PatternFill(fill_type=None)
SHEETS={"2026년 수업일정표 ":None,"2026 월수금":((0,2,4),12),"2026 화목":((1,3),8),"2026 화목토":((1,3,5),12)}
del wb["2026 화목토의 사본"]
summary={}
for name,cfg in SHEETS.items():
  ws=wb[name]; ws.title=name.replace("2026","2027").strip()
  ws["A1"]=str(ws["A1"].value).replace("2026","2027")
  color={}
  if cfg:
    days,N=cfg;x=d(2027,1,1);i=0;cyc=[]
    while x.year==2027:
      if x.weekday() in days and x not in HOL and not vac(x):
        color[x]=B if (i//N)%2==0 else G
        if i%N==0: cyc.append([x,x,0])
        cyc[-1][1]=x;cyc[-1][2]+=1;i+=1
      x+=D.timedelta(1)
    summary[ws.title]=cyc
  for rg in list(ws.merged_cells.ranges):
    for hr in (4,15,27,38):
      if hr+2<=rg.min_row<=hr+7: ws.unmerge_cells(str(rg)); break
  for hr in (4,15,27,38):
    for c0 in "BJR":
      cc=ws.cell(hr+9,ci(c0))
      if not isinstance(cc,openpyxl.cell.cell.MergedCell): cc.value=None
  base=ws["C7"]
  for bi,hr in enumerate([4,15,27,38]):
    for gi,c0 in enumerate("BJR"):
      m=bi*3+gi+1;s=ci(c0)
      for r in range(hr+2,hr+8):
        for k in range(7):
          c=ws.cell(r,s+k);c.value=None;c.fill=NONE
      first=d(2027,m,1);row=hr+2;col=(first.weekday()+1)%7
      x=first
      while x.month==m:
        c=ws.cell(row,s+col);c.value=x.day
        f=copy.copy(base.font);wd=x.weekday()
        clr="FFFF0000" if (wd==6 or x in HOL) else ("FF0000FF" if wd==5 else "FF000000")
        c.font=Font(name=f.name,size=f.sz,bold=f.b,color=clr);c.alignment=copy.copy(base.alignment);c.border=copy.copy(ws.cell(hr+3,s+col).border)
        if vac(x) and (not cfg or wd in cfg[0]) : c.fill=PK
        elif x in color: c.fill=color[x]
        x+=D.timedelta(1);col+=1
        if col==7: col=0;row+=1
      ws.cell(hr+8,s).value=NOTE[m]
wb.save("x/2027.xlsx")
for k,v in summary.items():
  print(k," / ".join(f"{a:%m/%d}~{b:%m/%d}({n})" for a,b,n in v))
