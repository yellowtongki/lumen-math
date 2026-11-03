# -*- coding: utf-8 -*-
"""
해설집 그림(SVG) 도우미  (2026-11-03 — 「앞으로 풀이에는 가능하면 그림을 넣자」 원장 지시)
──────────────────────────────────────────────
  sys.path.insert(0, 'sync'); from haesol_fig import Plot, G, inter
  from haesol_parts import figure

  · Plot — 좌표평면(함수 그래프·점·다각형·넓이 색칠). Plot((x0,x1),(y0,y1), ys=…)로 세로 배율 조절
  · G    — 도형(원·선분·각 표시·글자). 화면 좌표(아래로 +y). G.on(cx,cy,r,deg)는 원 위의 점
  · inter(p1,p2,p3,p4) — 두 직선의 교점

색은 해설집 CSS 변수(var(--ink), var(--indigo), var(--red), var(--amber), var(--green) …)로만 —
어두운 모드에서도 보인다. 글자·선 이름이 helpers(P, M 등)와 겹치지 않게 그림 변수는 _로 시작하는 이름을 쓴다
(예: P 를 점 이름으로 덮어쓰면 haesol_parts.P 가 사라져 'tuple is not callable' 오류).
"""
import math

__all__ = ['Plot', 'G', 'inter']

class Plot:
    def __init__(s, xr, yr, W=270, pad=24, aria='그래프', ys=1.0):
        s.x0,s.x1=xr; s.y0,s.y1=yr; s.W=W; s.pad=pad
        s.sc=(W-2*pad)/(s.x1-s.x0); s.scy=s.sc*ys; s.H=int((s.y1-s.y0)*s.scy+2*pad); s.el=[]; s.aria=aria
    def X(s,x): return s.pad+(x-s.x0)*s.sc
    def Y(s,y): return s.H-s.pad-(y-s.y0)*s.scy
    def axes(s, xl='x', yl='y', o=True):
        s.el.append(f'<line x1="{s.X(s.x0):.1f}" y1="{s.Y(0):.1f}" x2="{s.X(s.x1):.1f}" y2="{s.Y(0):.1f}" stroke="var(--ink-faint)" stroke-width="1.2"/>')
        s.el.append(f'<line x1="{s.X(0):.1f}" y1="{s.Y(s.y0):.1f}" x2="{s.X(0):.1f}" y2="{s.Y(s.y1):.1f}" stroke="var(--ink-faint)" stroke-width="1.2"/>')
        s.text(s.x1, 0, xl, dx=-6, dy=14, italic=True); s.text(0, s.y1, yl, dx=10, dy=8, italic=True)
        if o: s.text(0,0,'O',dx=-9,dy=14)
    def fn(s, f, a, b, color='var(--ink)', w=1.9, n=160, dash=None):
        pts=[]
        for i in range(n+1):
            x=a+(b-a)*i/n
            try: y=f(x)
            except Exception: continue
            if y is None or not (s.y0-0.3<=y<=s.y1+0.3): continue
            pts.append(f'{s.X(x):.1f},{s.Y(max(min(y,s.y1+.5),s.y0-.5)):.1f}')
        d=f' stroke-dasharray="{dash}"' if dash else ''
        s.el.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" stroke-width="{w}"{d}/>')
    def seg(s, p, q, color='var(--ink)', w=1.6, dash=None):
        d=f' stroke-dasharray="{dash}"' if dash else ''
        s.el.append(f'<line x1="{s.X(p[0]):.1f}" y1="{s.Y(p[1]):.1f}" x2="{s.X(q[0]):.1f}" y2="{s.Y(q[1]):.1f}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{d}/>')
    def poly(s, pts, fill='var(--indigo-soft)', stroke='var(--indigo)', w=1.4, op=1):
        P=' '.join(f'{s.X(x):.1f},{s.Y(y):.1f}' for x,y in pts)
        s.el.append(f'<polygon points="{P}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{w}"/>')
    def dot(s, x, y, color='var(--ink)', r=3.2, hollow=False):
        f='var(--paper)' if hollow else color
        s.el.append(f'<circle cx="{s.X(x):.1f}" cy="{s.Y(y):.1f}" r="{r}" fill="{f}" stroke="{color}" stroke-width="1.4"/>')
    def text(s, x, y, t, dx=0, dy=0, color='var(--ink)', size=12.5, italic=False, anchor='middle', bold=True):
        st=' font-style="italic"' if italic else ''
        fw=' font-weight="700"' if bold else ''
        s.el.append(f'<text x="{s.X(x)+dx:.1f}" y="{s.Y(y)+dy:.1f}" text-anchor="{anchor}" font-size="{size}"{fw}{st} fill="{color}">{t}</text>')
    def svg(s, maxw=250):
        return f'<svg viewBox="0 0 {s.W} {s.H}" width="100%" style="max-width:{maxw}px" role="img" aria-label="{s.aria}">'+''.join(s.el)+'</svg>'

class G:
    def __init__(s, W=260, H=230, aria='그림'): s.W=W; s.H=H; s.el=[]; s.aria=aria
    def on(s, cx, cy, r, deg): a=math.radians(deg); return (cx+r*math.cos(a), cy-r*math.sin(a))
    def circle(s, c, r, color='var(--ink)', w=1.8): s.el.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r:.1f}" fill="none" stroke="{color}" stroke-width="{w}"/>')
    def seg(s, p, q, color='var(--ink)', w=1.6, dash=None):
        d=f' stroke-dasharray="{dash}"' if dash else ''
        s.el.append(f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{d}/>')
    def poly(s, pts, color='var(--ink)', w=1.7, fill='none'):
        P=' '.join(f'{x:.1f},{y:.1f}' for x,y in pts); s.el.append(f'<polygon points="{P}" fill="{fill}" stroke="{color}" stroke-width="{w}"/>')
    def dot(s, p, color='var(--ink)', r=3): s.el.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{r}" fill="{color}"/>')
    def lab(s, p, t, dx=0, dy=0, color='var(--ink)', size=13.5, bold=True):
        fw=' font-weight="700"' if bold else ''
        s.el.append(f'<text x="{p[0]+dx:.1f}" y="{p[1]+dy:.1f}" text-anchor="middle" font-size="{size}"{fw} fill="{color}">{t}</text>')
    def arc(s, v, p, q, r=16, color='var(--amber)', w=1.5):
        a1=math.atan2(p[1]-v[1],p[0]-v[0]); a2=math.atan2(q[1]-v[1],q[0]-v[0])
        d=(a2-a1)%(2*math.pi); 
        if d>math.pi: a1,a2=a2,a1; d=2*math.pi-d
        x1,y1=v[0]+r*math.cos(a1),v[1]+r*math.sin(a1); x2,y2=v[0]+r*math.cos(a2),v[1]+r*math.sin(a2)
        s.el.append(f'<path d="M {x1:.1f} {y1:.1f} A {r} {r} 0 0 1 {x2:.1f} {y2:.1f}" fill="none" stroke="{color}" stroke-width="{w}"/>')
        m=a1+d/2; return (v[0]+(r+11)*math.cos(m), v[1]+(r+11)*math.sin(m)+4)
    def svg(s, maxw=240): return f'<svg viewBox="0 0 {s.W} {s.H}" width="100%" style="max-width:{maxw}px" role="img" aria-label="{s.aria}">'+''.join(s.el)+'</svg>'
def inter(p1,p2,p3,p4):
    x1,y1=p1;x2,y2=p2;x3,y3=p3;x4,y4=p4; d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
    t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d; return (x1+t*(x2-x1), y1+t*(y2-y1))
