#!/usr/bin/env python3
"""
🔁 풀이노트 PDF 우측하단 로고를 루멘수학 로고로 바꾸기

원장 요청 2026-10-13: 「[꽉]개념원리 공통수학1 풀이노트.pdf 우측하단의 꽉찬수학을 우리학원 로고로 변경」
  안쪽 쪽의 우측하단 로고는 쪽마다 같은 자리의 그림 한 장이다 → 그 그림을 빼고(PDF 안에서 지움) 루멘수학 로고를 얹는다.
  루멘 로고 = 전구(assets/logo_bulb.png) + 「루멘수학」(빨강) + Lumen Math. 로고 뒤 흰 바탕이 표 아래 테두리선을 가리는 것도 원본과 같다.

쓰는 법
  python3 sync/note_logo_swap.py 입력.pdf 출력.pdf [--font-dir 글꼴폴더] [--pages 3-6] [--scale 1.0]
    --pages : 그 쪽만 바꾼다 (미리보기용, 결과 PDF 도 그 쪽들만 담는다)
    --covers 1,117 : 표지 쪽 번호. 표지는 쪽 전체가 한 장의 그림이라 로고가 그림 속에 있다 →
                     오른쪽 아래 로고 자리를 배경색으로 메우고(주변 색 이어붙임) 위아래로 쌓은 루멘 로고를 얹는다
  글꼴: Pretendard TTF (sync/solution_note_build.py 와 같음)
로고 찾는 규칙: 쪽 오른쪽 아래(왼쪽 x>440, 아래 y<30, 높이 40 이하)에 그려지는 그림. 그 그림 명령만 지우고 나머지 내용은 그대로 둔다.
"""
import argparse, io, os, sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream
import numpy as np
from PIL import Image, ImageFilter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
BULB = os.path.join(HERE, '..', 'assets', 'logo_bulb.png')
RED = (0xDC / 255, 0x2A / 255, 0x29 / 255)


def load_fonts(font_dir):
    for d in [font_dir, os.path.join(HERE, 'fonts')]:
        if d and os.path.exists(os.path.join(d, 'Pretendard-Regular.ttf')):
            sb = os.path.join(d, 'Pretendard-SemiBold.ttf')
            xb = os.path.join(d, 'Pretendard-ExtraBold.ttf')
            pdfmetrics.registerFont(TTFont('PB', sb if os.path.exists(sb) else os.path.join(d, 'Pretendard-Regular.ttf')))
            pdfmetrics.registerFont(TTFont('PX', xb if os.path.exists(xb) else sb))
            return
    sys.exit('Pretendard 글꼴을 찾지 못했습니다 — --font-dir 로 알려 주세요')


def is_logo(m):
    """그림 배치 행렬 [a b c d e f] 가 오른쪽 아래 작은 그림이면 로고"""
    a, _, _, d, e, f = [float(v) for v in m]
    return e > 440 and f < 30 and 0 < d <= 40 and e + a > 520


def remove_old_logos(src, pages):   # → (PdfWriter, {쪽: 로고 자리})
    """로고 그림을 그리는 명령(cm + Do)만 PDF 안에서 뺀다 — 다른 글씨·선은 그대로 둔다."""
    rd = PdfWriter(clone_from=src)
    found = {}
    for i in pages:
        pg = rd.pages[i]
        cs = ContentStream(pg.get_contents(), rd)
        ops, last_cm, drop = cs.operations, None, []
        for k, (operands, op) in enumerate(ops):
            if op == b'cm':
                last_cm = (k, operands)
            elif op == b'Do' and last_cm and is_logo(last_cm[1]):
                a, _, _, d, e, f = [float(v) for v in last_cm[1]]
                found[i] = (e, f, e + a, f + d)
                drop += [last_cm[0], k]
        if drop:
            cs.operations = [o for k, o in enumerate(ops) if k not in set(drop)]
            pg.replace_contents(cs)
    return rd, found


def overlay_page(size, box, scale):
    """로고 덮개 한 쪽: 흰 바탕 + 전구 + 글자. box = 원래 로고 자리 (l, b, r, t)"""
    l, b, r, t = box
    h = (t - b) * scale + 2
    bulb = h * 0.98
    f1, f2 = h * 0.60, h * 0.37
    tw = max(pdfmetrics.stringWidth('루멘수학', 'PX', f1), pdfmetrics.stringWidth('Lumen Math', 'PB', f2))
    w = bulb + 3 + tw
    x0 = r - w - 2                      # 오른쪽 끝을 원래 로고 오른쪽에 맞춘다
    y0 = b
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=size)
    c.setFillColorRGB(1, 1, 1)
    c.rect(x0 - 4, y0 - 1, w + 8, h + 2, stroke=0, fill=1)   # 테두리선을 가리는 흰 바탕
    if os.path.exists(BULB):
        c.drawImage(ImageReader(BULB), x0, y0, bulb, bulb, mask='auto')
    c.setFillColorRGB(*RED)
    c.setFont('PX', f1)
    c.drawString(x0 + bulb + 3, y0 + h * 0.50, '루멘수학')
    c.setFont('PB', f2)
    c.drawString(x0 + bulb + 3, y0 + h * 0.08, 'Lumen Math')
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def swap_cover(w, idx):
    """표지(쪽 전체가 한 장의 그림) 오른쪽 아래의 로고 그림을 지우고, 그 중심 위치를 돌려준다 (pt, 쪽 아래 기준)"""
    pg = w.pages[idx]
    img = pg.images[0]
    im = img.image.convert('RGB')
    a = np.array(im).astype(int)
    H, W, _ = a.shape
    bg = a[H - 8, W - 8]
    y0, x0 = int(H * 0.885), int(W * 0.62)           # 쪽 위 장식(고리 모양)보다 아래, 오른쪽 40%
    mask = (np.abs(a[y0:, x0:] - bg).sum(axis=2) > 40)
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None
    ys += y0; xs += x0
    top, bot, lef, rig = ys.min() - 8, ys.max() + 8, xs.min() - 8, xs.max() + 8
    for y in range(top, bot + 1):                    # 한 줄씩 왼쪽·오른쪽 바깥 색을 이어 붙인다
        lc = a[y, lef - 6:lef - 2].mean(axis=0)
        rc = a[y, min(W - 1, rig + 2):min(W, rig + 6)].mean(axis=0)
        t = np.linspace(0, 1, rig - lef + 1)[:, None]
        a[y, lef:rig + 1] = (lc * (1 - t) + rc * t)
    img.replace(Image.fromarray(a.astype('uint8')), quality=92)
    k = float(pg.mediabox.width) / W
    return ((lef + rig) / 2 * k, float(pg.mediabox.height) - (top + bot) / 2 * k, (bot - top) * k)


def cover_overlay(size, center, scale):
    """표지 로고: 전구 위, 루멘수학, Lumen Math 순으로 쌓는다 (배경 없음)"""
    cx, cy, h = center
    h = max(h, 50) * scale
    bulb = h * 0.50
    f1, f2 = h * 0.28, h * 0.14
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=size)
    y_top = cy + h / 2
    if os.path.exists(BULB):
        c.drawImage(ImageReader(BULB), cx - bulb / 2, y_top - bulb, bulb, bulb, mask='auto')
    c.setFillColorRGB(*RED)
    c.setFont('PX', f1)
    c.drawCentredString(cx, y_top - bulb - f1 * 0.95, '루멘수학')
    c.setFont('PB', f2)
    c.drawCentredString(cx, y_top - bulb - f1 * 0.95 - f2 * 1.35, 'Lumen Math')
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--font-dir')
    ap.add_argument('--pages')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--covers', default='')
    a = ap.parse_args()
    load_fonts(a.font_dir)
    n = len(PdfReader(a.src).pages)
    if a.pages:
        s, _, e = a.pages.partition('-')
        pages = list(range(int(s) - 1, int(e or s)))
    else:
        pages = list(range(n))
    rd, found = remove_old_logos(a.src, pages)
    ovs = {}                              # 같은 자리의 로고는 한 번만 만들어 모든 쪽이 같이 쓴다 (글꼴·그림이 쪽마다 들어가면 파일이 10배 커진다)
    for i in pages:
        pg = rd.pages[i]
        if i in found:
            key = tuple(round(v, 1) for v in found[i])
            if key not in ovs:
                ovs[key] = overlay_page((float(pg.mediabox.width), float(pg.mediabox.height)), found[i], a.scale)
            pg.merge_page(ovs[key])
    ctr = None
    for c1 in [int(x) for x in a.covers.split(',') if x.strip()]:
        i = c1 - 1
        if i in pages:
            ctr = swap_cover(rd, i) or ctr    # 표지들이 같은 그림을 같이 쓰면 첫 표지에서 이미 지워져 있다 → 앞에서 잰 자리를 쓴다
            if ctr:
                pg = rd.pages[i]
                key = ('cover',) + tuple(round(v, 1) for v in ctr)
                if key not in ovs:
                    ovs[key] = cover_overlay((float(pg.mediabox.width), float(pg.mediabox.height)), ctr, a.scale)
                pg.merge_page(ovs[key])
                print(f'표지 {c1}쪽 로고 교체')
    for i in reversed(range(n)):          # --pages 로 고른 쪽만 남긴다
        if i not in pages:
            rd.remove_page(i)
    for pg in rd.pages:                   # 고친 쪽의 내용 줄이기 (안 하면 파일이 10배 커진다)
        pg.compress_content_streams()
    with open(a.out, 'wb') as f:
        rd.write(f)
    print(f'바꾼 쪽 {len(found)}/{len(pages)} → {a.out}')


if __name__ == '__main__':
    main()
