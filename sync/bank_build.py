#!/usr/bin/env python3
"""
🗂 루멘 문제 DB ③ 자르기·저장 — 책 PDF + 문항 상자(bank_detect.js) + 목록(bank_meta.js) → 맥미니 문제 DB

원장 요청 2026-10-27: 문제집 PDF 를 문항 하나씩 잘라 출처(쎈 중1-2 p.93 547번)를 붙여 쌓고,
  대단원·중단원·유형을 골라 출력물로 나눠 준다. 저장은 맥미니 외장 SSD (원본 PDF·백업은 외장하드).
  교재 그림은 저작권물 — 저장소·공개 서버에 올리지 않는다. 이 스크립트도 밖으로 아무것도 보내지 않는다.

쓰는 법
  python3 sync/bank_build.py build --meta meta.json --boxes boxes.json --pdf 책.pdf --offset 2 --bank /Volumes/SSD/lumen_bank
      --offset : PDF 쪽 = 책 쪽 + offset (책 83쪽이 PDF 85쪽이면 2). 확인 그림(check/)을 보고 맞는지 본다
      --fix fix.json : 번호 맞추기 손보기 { "93": ["547","548",...] }  상자 순서대로 큰 번호(빈칸 "" 은 버림)
  python3 sync/bank_build.py viewer --bank DIR     (화면 파일만 다시 만들기)

결과 (DIR = --bank)
  bank.sqlite        문제 목록 (책·쪽·번호·단계·유형·단원·정답·그림 파일·상태)
  img/<책>/p093_547.png   잘린 문항 그림
  check/<책>/p093.png     상자·번호를 그린 확인 그림 (원장님이 눈으로 확인)
  bank.html + bank_data.js  고르기·출력 화면 (맥에서 더블클릭, 인터넷 없이 열린다)
"""
import argparse, json, os, re, sqlite3, sys, datetime
from collections import OrderedDict, defaultdict

SCHEMA = """
CREATE TABLE IF NOT EXISTS books(
  id TEXT PRIMARY KEY, short TEXT, title TEXT, publisher TEXT, mf_bid INTEGER, revision TEXT, grade TEXT, semester TEXT, pdf TEXT, offset INTEGER);
CREATE TABLE IF NOT EXISTS problems(
  id TEXT PRIMARY KEY,            -- <책>:<쪽>:<큰번호>
  book TEXT, page INTEGER, no TEXT, nos TEXT, step TEXT, qtype TEXT, level INTEGER, answer TEXT,
  cid INTEGER, concept TEXT, big TEXT, mid TEXT, little TEXT, ord TEXT,
  img TEXT, pdf_page INTEGER, box TEXT, status TEXT,   -- status: ok / check(확인 필요) / nobox(그림 없음)
  mf_wpid INTEGER, mf_twin INTEGER, mf_twin_img TEXT, updated TEXT);
CREATE INDEX IF NOT EXISTS problems_unit ON problems(book, big, mid, little);
CREATE INDEX IF NOT EXISTS problems_page ON problems(book, page);
"""


def slug_of(meta):
    b = meta['book']
    return 'mf%d' % b['bid']


def reading_order(boxes):
    """2단 편집: 왼쪽 단 위→아래, 그다음 오른쪽 단. 쪽 가운데를 넘는 넓은 상자는 위치대로 끼운다."""
    def key(b):
        cx = b['x'] + b['w'] / 2
        wide = b['w'] > 0.6
        col = 0 if (wide or cx < 0.5) else 1
        return (col, b['y'])
    # 넓은 상자(쪽 전체 폭)는 두 단을 가르는 경계 — 경계 위아래로 구역을 나눠 각 구역 안에서 단 순서를 쓴다
    wides = sorted([b for b in boxes if b['w'] > 0.6], key=lambda b: b['y'])
    cuts = [0.0] + [b['y'] for b in wides] + [2.0]
    out = []
    for lo, hi in zip(cuts, cuts[1:]):
        band = [b for b in boxes if lo <= b['y'] < hi]
        out += sorted(band, key=key)
    return out


def align(boxes, bases, groups):
    """상자 수 ≠ 번호 수일 때: 순서를 지키며 상자↔번호를 짝짓는다(LCS 꼴).
    매쓰플랫이 상자에 붙인 유형 번호(cid)가 책 목록과 같으면 점수를 크게 준다. 짝 없는 상자는 '' (버림)."""
    m, k = len(boxes), len(bases)
    def sc(i, j):
        c = boxes[i].get('cid')
        return 0.5 if not c else (2.0 if c == groups[bases[j]][0]['cid'] else -1.0)
    D = [[0.0] * (k + 1) for _ in range(m + 1)]
    for i in range(m - 1, -1, -1):
        for j in range(k - 1, -1, -1):
            D[i][j] = max(D[i + 1][j], D[i][j + 1], sc(i, j) + D[i + 1][j + 1])
    out, i, j = [], 0, 0
    while i < m:
        if j < k and D[i][j] == sc(i, j) + D[i + 1][j + 1]:
            out.append(bases[j]); i += 1; j += 1
        elif j < k and D[i][j] == D[i][j + 1]:
            j += 1
        else:
            out.append(''); i += 1
    return out


def render_page(pdf, idx, dpi):
    page = pdf[idx]
    return page.render(scale=dpi / 72).to_pil().convert('RGB')


def crop(im, b, pad=0.006):
    W, H = im.size
    x0 = max(0, int((b['x'] - pad) * W)); y0 = max(0, int((b['y'] - pad) * H))
    x1 = min(W, int((b['x'] + b['w'] + pad) * W)); y1 = min(H, int((b['y'] + b['h'] + pad) * H))
    return im.crop((x0, y0, x1, y1))


def build(a):
    import pypdfium2 as pdfium
    from PIL import ImageDraw, ImageFont
    meta = json.load(open(a.meta, encoding='utf-8'))
    det = json.load(open(a.boxes, encoding='utf-8'))
    fix = json.load(open(a.fix, encoding='utf-8')) if a.fix else {}
    book = slug_of(meta)
    os.makedirs(a.bank, exist_ok=True)
    img_dir = os.path.join(a.bank, 'img', book); chk_dir = os.path.join(a.bank, 'check', book)
    os.makedirs(img_dir, exist_ok=True); os.makedirs(chk_dir, exist_ok=True)
    db = sqlite3.connect(os.path.join(a.bank, 'bank.sqlite')); db.executescript(SCHEMA)
    b = meta['book']
    db.execute('INSERT OR REPLACE INTO books VALUES(?,?,?,?,?,?,?,?,?,?)',
               (book, b['short'], b['title'], b.get('publisher', ''), b['bid'], b.get('revision', ''), str(b.get('grade', '')),
                str(b.get('semester', '')), os.path.basename(a.pdf), a.offset))
    pdf = pdfium.PdfDocument(a.pdf)
    det_by_page = {p['pdf_page']: p for p in det['pages']}
    # 책 쪽 → 큰 번호 묶음 (528.(1)·528.(2) 는 그림 한 장)
    pages = OrderedDict()
    for q in meta['problems']:
        g = pages.setdefault(q['page'], OrderedDict()).setdefault(q['base'], [])
        g.append(q)
    try:
        font = ImageFont.truetype(a.font, 28) if a.font else ImageFont.load_default(size=28)
    except Exception:
        font = ImageFont.load_default()
    now = datetime.datetime.now().isoformat(timespec='seconds')
    stat = defaultdict(int); report = []
    for page, groups in pages.items():
        pp = page + a.offset
        dp = det_by_page.get(pp)
        bases = list(groups.keys())
        if not dp:
            for base, qs in groups.items():
                save_row(db, book, page, base, qs, None, None, pp, 'nobox', now); stat['nobox'] += 1
            continue
        boxes = reading_order(dp['boxes'])
        order = fix.get(str(page))
        status = 'ok'
        if order is None:
            if len(boxes) != len(bases):
                order = align(boxes, bases, groups)
                status = 'check'
            else:
                order = list(bases)
                # 매쓰플랫 검산: 상자 유형 번호(cid)가 있으면 책 목록과 맞춰 본다
                bad = [n for n, bx in zip(bases, boxes) if bx.get('cid') and bx['cid'] != groups[n][0]['cid']]
                if len(bad) > max(1, len(bases) // 3):
                    status = 'check'
        im = render_page(pdf, pp - 1, a.dpi)
        chk = im.copy(); dr = ImageDraw.Draw(chk); W, H = chk.size
        used = set()
        for k, (bx, base) in enumerate(zip(boxes, order)):
            color = (220, 40, 40) if status == 'check' or not base else (20, 140, 60)
            dr.rectangle([bx['x'] * W, bx['y'] * H, (bx['x'] + bx['w']) * W, (bx['y'] + bx['h']) * H], outline=color, width=4)
            dr.text((bx['x'] * W + 6, bx['y'] * H + 4), f"{k + 1}:{base or '버림'}", fill=color, font=font)
            if not base or base not in groups:
                continue
            fn = f"p{page:03d}_{re.sub(r'[^0-9A-Za-z]', '', base)}.png"
            crop(im, bx).save(os.path.join(img_dir, fn), optimize=True)
            save_row(db, book, page, base, groups[base], f'img/{book}/{fn}', bx, pp, status, now)
            used.add(base); stat[status] += 1
        for base in bases:
            if base not in used:
                save_row(db, book, page, base, groups[base], None, None, pp, 'nobox', now); stat['nobox'] += 1
        chk.thumbnail((1400, 1400)); chk.save(os.path.join(chk_dir, f'p{page:03d}.png'))
        report.append(f"  {page}쪽(PDF {pp}): 번호 {len(bases)} · 상자 {len(boxes)}" + ('' if status == 'ok' else '  ← 확인 필요'))
    db.commit(); db.close()
    print('\n'.join(report))
    print(f"{b['short']}: 잘림 {stat['ok']} · 확인 필요 {stat['check']} · 그림 없음 {stat['nobox']}  → {a.bank}")
    viewer(a)


def clean_answer(q):
    """매쓰플랫 정답 글자 정리 — 수식 띄어쓰기 기호(\\; \\,)를 빼고, 서술형 빈 정답은 「해설 참고」"""
    a = str(q.get('answer') or '')
    a = re.sub(r'\\[;,!: ]', ' ', a).replace('\\', '')
    a = re.sub(r'\s+', ' ', a).strip(' .')
    return a or ('서술형 · 해설 참고' if q.get('type') == 'ESSAY' else '해설 참고')


def save_row(db, book, page, base, qs, img, box, pp, status, now):
    q0 = qs[0]
    nos = [q['no'] for q in qs]
    ans = ' '.join((re.sub(r'^\d+\.?', '', q['no']) + ' ' if len(qs) > 1 else '') + clean_answer(q) for q in qs).strip()
    db.execute('INSERT OR REPLACE INTO problems VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
        f'{book}:{page}:{base}', book, page, base, json.dumps(nos, ensure_ascii=False), q0['step'], q0['type'], q0['level'], ans,
        q0['cid'], q0['concept'], q0['big'], q0['mid'], q0['little'], q0.get('ord', ''),
        img, pp, json.dumps(box) if box else None, status, q0.get('mf_wpid'), q0.get('mf_twin'), q0.get('mf_twin_img', ''), now))


def viewer(a):
    db = sqlite3.connect(os.path.join(a.bank, 'bank.sqlite')); db.row_factory = sqlite3.Row
    books = [dict(r) for r in db.execute('SELECT id,short,title FROM books ORDER BY short')]
    rows = [dict(r) for r in db.execute(
        'SELECT id,book,page,no,step,qtype,level,answer,concept,big,mid,little,ord,img,status FROM problems '
        'ORDER BY book, page, CAST(no AS INTEGER), no')]
    with open(os.path.join(a.bank, 'bank_data.js'), 'w', encoding='utf-8') as f:
        f.write('window.BANK=' + json.dumps({'books': books, 'problems': rows, 'made': datetime.datetime.now().isoformat(timespec='minutes')},
                                            ensure_ascii=False) + ';\n')
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'bank_viewer.html'), encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(a.bank, 'bank.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    logo = os.path.join(os.path.dirname(here), 'assets', 'logo_bulb.png')
    if os.path.exists(logo):
        import shutil; shutil.copy(logo, os.path.join(a.bank, 'logo_bulb.png'))
    print(f'화면: {os.path.join(a.bank, "bank.html")} (문항 {len(rows)}개)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='루멘 문제 DB 자르기·저장')
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build')
    b.add_argument('--meta', required=True); b.add_argument('--boxes', required=True); b.add_argument('--pdf', required=True)
    b.add_argument('--offset', type=int, required=True); b.add_argument('--bank', required=True)
    b.add_argument('--fix'); b.add_argument('--dpi', type=int, default=220); b.add_argument('--font')
    v = sub.add_parser('viewer'); v.add_argument('--bank', required=True)
    a = ap.parse_args()
    build(a) if a.cmd == 'build' else viewer(a)
