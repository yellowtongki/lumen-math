# -*- coding: utf-8 -*-
"""
기출 해설집 «부품» 만들기 도우미  (2026-10-28)
──────────────────────────────────────────────
docs/exam_reports/<코드>/parts/qNN.html 한 문항씩을 같은 모양으로 찍어 낸다.
(작업 환경이 바뀌면 임시 폴더의 도우미가 사라져서 저장소로 옮겼다)

  import sys; sys.path.insert(0, 'sync'); from haesol_parts import *
  Q[1] = sec(1, r'제목 <b>강조</b>', r'난이도 3 · 4점', r'단원 · 유형',
             ps(r'문제 \(x\)…<br>① … ⑤ …') +
             step(r'1단계 — …', P(r'설명') + M(r'x=1')) +
             res(r'\(1\ \Rightarrow\) ①') + miss(r'자주 하는 실수'))
  write_parts(OUT, Q)

규칙(앱의 hsParse·haesol_upload.js 가 읽는 모양):
  · 정답 = 마지막 .val 안의 마지막 ①~⑤ (서술형은 글 그대로)
  · 킬러 = section class "sol killer" + 배지에 「킬러」, 주의 = 배지에 「오류·부족·미비」
  · 배지: 「난이도 N · X점」 / 「난이도 N · 킬러 · X점」 / 「난이도 N · 서술형 X점」
  · 문자열은 모두 r'…' (그냥 '…' 이면 \t 가 탭으로 바뀌어 \triangle 이 깨진다)
"""
import html as _html
import os

__all__ = ['sec', 'ps', 'step', 'P', 'M', 'res', 'miss', 'cond', 'aside', 'warn',
           'figure', 'tbl', 'grading', 'write_parts']


def ps(t):
    return f'      <div class="pstate">{t}</div>\n'


def P(t):
    return f'        <p>{t}</p>\n'


def M(t):
    return f'        <div class="mathrow">$${t}$$</div>\n'


def step(label, inner, color=''):
    c = f' {color}' if color else ''
    return (f'      <div class="step">\n'
            f'        <span class="step-lab{c}"><span class="dot"></span>{label}</span>\n'
            f'{inner}      </div>\n')


def cond(rows):
    r = ''.join(f'<div class="row"><span class="lab">{a}</span><span>{b}</span></div>' for a, b in rows)
    return f'        <div class="cond">{r}</div>\n'


def res(v):
    return f'      <div class="result"><span class="lab">정답</span><span class="val">{v}</span></div>\n'


def miss(t):
    return f'      <div class="miss"><b>가장 잦은 실수</b> {t}</div>\n'


def aside(t):
    return f'        <p class="aside">{t}</p>\n'


def warn(title, t):
    return f'      <div class="warn"><div class="t">⚠️ {title}</div><p>{t}</p></div>\n'


def grading(rows):
    """서술형 채점 기준 (예시)"""
    return step(r'채점 기준 (예시)', cond(rows))


def figure(svg, cap=''):
    c = f'\n        <div class="fig-cap">{cap}</div>' if cap else ''
    return f'      <div class="fig-frame">\n        {svg}{c}\n      </div>\n'


def tbl(head, rows):
    h = '<tr>' + ''.join(f'<th>{c}</th>' for c in head) + '</tr>'
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'        <div style="overflow-x:auto"><table class="calc">{h}{b}</table></div>\n'


def sec(no, title, badge, kind, body, killer=False):
    red = ' red' if (killer or any(w in badge for w in ('오류', '부족', '미비'))) else ''
    cls = 'sol killer' if killer else 'sol'
    return (f'  <section class="{cls}" id="q{no}">\n'
            f'    <div class="sol-head">\n'
            f'      <span class="sol-k{red}">{no}</span>\n'
            f'      <div>\n'
            f'        <div class="sol-title">{title}</div>\n'
            f'        <div class="sol-kind"><span class="dbadge{red}">{badge}</span> {kind}</div>\n'
            f'      </div>\n'
            f'    </div>\n'
            f'    <div class="sol-body">\n'
            f'{body}'
            f'    </div>\n'
            f'  </section>\n')


def write_parts(out_dir, Q):
    os.makedirs(out_dir, exist_ok=True)
    bad = []
    for no, h in Q.items():
        if any(ch in h for ch in '\x07\x08\x09\x0b\x0c'):
            bad.append(no)
        with open(os.path.join(out_dir, f'q{no:02d}.html'), 'w', encoding='utf-8') as f:
            f.write(h)
    if bad:
        raise SystemExit(f'제어 문자(탭 등)가 든 문항: {bad} — r\'…\' 로 쓰세요')
    return len(Q)
