#!/usr/bin/env python3
"""
📒 풀이노트 만들기 — 시중교재(쎈 등) PDF → 루멘 풀이노트 PDF (한 쪽에 2×2 칸, 칸마다 문항 그림 + 빈 풀이칸)

원장 요청 2026-10-12: 「쎈문제집 pdf를 주면 이렇게 풀이노트 만들어줄 수 있나? 도형이 많아서 문제이다」
  → 도형을 새로 그리지 않고 교재 PDF에서 그림 부분만 고화질(300dpi)로 잘라 붙인다.
  스캔본 PDF는 글자 위치를 못 믿으므로 «어느 문항 그림이 어디 있는지»는 채팅에서 Claude 가 쪽 그림을 보고 정해
  설계 파일(JSON)에 적는다. 이 스크립트는 그 설계대로 자르고 조립만 한다.

설계 파일 (JSON)
  {
    "pdf": "교재.pdf",              # 설계 파일 기준 상대 경로 또는 절대 경로
    "out": "풀이노트.pdf",
    "start_page_no": 1,             # 노트 쪽 번호 시작값
    "sections": [
      { "title": "05. 다각형",       # 쪽 맨 위 제목 — 새 소단원은 새 쪽에서 시작한다
        "cells": [
          { "book": 91, "title": "유형 08 : 이등변삼각형", "pdf_page": 1, "box": [0.346, 0.120, 0.473, 0.192] },
          { "title": "0545 대표문제" }     # box 가 없으면 그림 없이 빈칸만
        ] } ]
  }
  box = [왼, 위, 오른, 아래] 를 PDF 쪽 너비·높이에 대한 비율(0~1)로. book(교재 쪽수)은 바뀔 때만 칸에 «p. 91» 로 찍힌다.

쓰는 법
  python3 sync/solution_note_build.py 설계.json [--font-dir 글꼴폴더] [--sheet 확인용.png]
  글꼴: Pretendard TTF (npm 패키지 pretendard 의 dist/public/static/alternative/*.ttf). 없으면 --font-dir 로 알려준다.
  --sheet : 잘라낸 그림을 한 장에 모아 저장 (자르기 위치 확인용)

교재 원본·잘라낸 그림·결과 PDF 는 저장소에 올리지 않는다 (저작권).
"""
import json, os, sys, argparse
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

DPI = 300
LINE = (0x8C / 255, 0xCF / 255, 0xC8 / 255)      # 민트 선 (기존 루멘 노트)
HEAD_FILL = (0xF3 / 255, 0xFA / 255, 0xFA / 255)
TEXT = (0.13, 0.13, 0.13)

PW, PH = A4                    # 595 × 842 pt
ML, MR = 34, PW - 28           # 표 왼·오른 끝
MID = 303                      # 가운데 세로선
TOP_TITLED, TOP_PLAIN = 33, 17 # 표 위 끝 (소단원 제목 있는 쪽 / 없는 쪽)
BOTTOM = PH - 34               # 표 아래 끝
HEAD_H = 16                    # 칸 머리줄 높이
LABEL_W = 44                   # 머리줄 «p. 91» 칸 너비
FIG_SCALE = 1.5                # 교재 원래 크기 대비 그림 배율
FIG_MAX_W, FIG_MAX_H = 235, 150


def load_fonts(font_dir):
    cands = [font_dir] if font_dir else []
    here = os.path.dirname(os.path.abspath(__file__))
    cands += [os.path.join(here, 'fonts'), os.path.expanduser('~/.fonts')]
    for d in cands:
        if d and os.path.exists(os.path.join(d, 'Pretendard-Regular.ttf')):
            pdfmetrics.registerFont(TTFont('PR', os.path.join(d, 'Pretendard-Regular.ttf')))
            b = os.path.join(d, 'Pretendard-SemiBold.ttf')
            pdfmetrics.registerFont(TTFont('PB', b if os.path.exists(b) else os.path.join(d, 'Pretendard-Regular.ttf')))
            return
    sys.exit('Pretendard-Regular.ttf 를 찾지 못했습니다 — --font-dir 로 글꼴 폴더를 알려 주세요')


def whiten(fig):
    """스캔 배경의 회색·뒷장 비침을 흰색으로 — 밝은 픽셀(채도 낮음)만 지우고 선·색칠은 남긴다"""
    px = fig.load()
    for y in range(fig.height):
        for x in range(fig.width):
            r, g, b = px[x, y]
            if min(r, g, b) > 212 and max(r, g, b) - min(r, g, b) < 30:
                px[x, y] = (255, 255, 255)
    return fig


def crop_figures(spec, base, tmp):
    pdf = pdfium.PdfDocument(os.path.join(base, spec['pdf']))
    pages, out = {}, {}
    for si, sec in enumerate(spec['sections']):
        for ci, cell in enumerate(sec['cells']):
            if not cell.get('box'):
                continue
            pn = cell['pdf_page']
            if pn not in pages:
                pages[pn] = pdf[pn - 1].render(scale=DPI / 72).to_pil().convert('RGB')
            im = pages[pn]
            x0, y0, x1, y1 = cell['box']
            fig = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
            fig = whiten(fig)
            path = os.path.join(tmp, f'fig_{si}_{ci}.png')
            fig.save(path)
            out[(si, ci)] = path
    return out


def contact_sheet(figs, spec, path):
    ims = []
    for (si, ci), p in sorted(figs.items()):
        im = Image.open(p)
        im.thumbnail((450, 450))
        ims.append((spec['sections'][si]['cells'][ci].get('title', ''), im))
    W, x, y, rowh, pos = 1400, 0, 0, 0, []
    for t, im in ims:
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + 40, 0
        pos.append((t, im, x, y))
        x += im.width + 20
        rowh = max(rowh, im.height)
    sheet = Image.new('RGB', (W, y + rowh + 40), '#888')
    dr = ImageDraw.Draw(sheet)
    for t, im, x, y in pos:
        sheet.paste(im, (x, y + 30))
        dr.text((x, y + 5), t.encode('ascii', 'replace').decode(), fill='black')
    sheet.save(path)


def draw_cell(c, x0, x1, top, bottom, cell, show_book, fig_path):
    # 머리줄
    c.setFillColorRGB(*HEAD_FILL)
    c.setStrokeColorRGB(*LINE)
    c.setLineWidth(0.6)
    c.rect(x0, PH - top - HEAD_H, x1 - x0, HEAD_H, stroke=1, fill=1)
    c.line(x0 + LABEL_W, PH - top, x0 + LABEL_W, PH - top - HEAD_H)
    c.setFillColorRGB(*TEXT)
    base = PH - top - HEAD_H + 4.6
    if show_book and cell.get('book') is not None:
        c.setFont('PR', 8.5)
        c.drawString(x0 + 5, base, f"p. {cell['book']}")
    if cell.get('title'):
        c.setFont('PB', 8.5)
        c.drawString(x0 + LABEL_W + 6, base, cell['title'])
    # 그림
    if fig_path:
        im = Image.open(fig_path)
        w = im.width * 72 / DPI * FIG_SCALE
        h = im.height * 72 / DPI * FIG_SCALE
        k = min(1, FIG_MAX_W / w, FIG_MAX_H / h)
        w, h = w * k, h * k
        fx = x0 + ((x1 - x0) - w) / 2
        fy = PH - (top + HEAD_H + 10) - h
        c.drawImage(ImageReader(fig_path), fx, fy, w, h)


def build(spec, base, figs, out):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(spec.get('name', '풀이노트'))
    page_no = spec.get('start_page_no', 1)
    last_book = None
    for si, sec in enumerate(spec['sections']):
        cells = list(enumerate(sec['cells']))
        for p0 in range(0, max(len(cells), 1), 4):
            chunk = cells[p0:p0 + 4]
            titled = p0 == 0 and sec.get('title')
            top = TOP_TITLED if titled else TOP_PLAIN
            mid_y = top + (BOTTOM - top) / 2
            c.setFont('PR', 8.5)
            c.setFillColorRGB(*TEXT)
            c.drawRightString(PW - 18, PH - 13, f'- {page_no} -')
            if titled:
                c.setFont('PR', 9.5)
                c.drawString(ML - 4, PH - top + 8, sec['title'])
            # 바깥 테두리와 가운데선
            c.setStrokeColorRGB(*LINE)
            c.setLineWidth(0.6)
            c.rect(ML, PH - BOTTOM, MR - ML, BOTTOM - top, stroke=1, fill=0)
            c.line(MID, PH - top, MID, PH - BOTTOM)
            slots = [(ML, MID, top), (MID, MR, top), (ML, MID, mid_y), (MID, MR, mid_y)]
            for k, (x0, x1, t) in enumerate(slots):
                if k < len(chunk):
                    ci, cell = chunk[k]
                    show = cell.get('book') is not None and cell.get('book') != last_book
                    if cell.get('book') is not None:
                        last_book = cell['book']
                    draw_cell(c, x0, x1, t, None, cell, show, figs.get((si, ci)))
                else:
                    draw_cell(c, x0, x1, t, None, {}, False, None)
            c.showPage()
            page_no += 1
    c.save()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--font-dir')
    ap.add_argument('--sheet')
    a = ap.parse_args()
    spec = json.load(open(a.spec, encoding='utf-8'))
    base = os.path.dirname(os.path.abspath(a.spec))
    load_fonts(a.font_dir)
    tmp = os.path.join(base, '_note_figs')
    os.makedirs(tmp, exist_ok=True)
    figs = crop_figures(spec, base, tmp)
    if a.sheet:
        contact_sheet(figs, spec, a.sheet)
    out = os.path.join(base, spec.get('out', 'solution_note.pdf'))
    build(spec, base, figs, out)
    print('만들었습니다:', out, f'(그림 {len(figs)}개)')


if __name__ == '__main__':
    main()
