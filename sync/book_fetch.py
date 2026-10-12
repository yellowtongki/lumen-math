#!/usr/bin/env python3
"""
📚 문제집 PDF 다리 — 구글 드라이브 → 학원 서버(Supabase) 비공개 보관함 `books`

원장 요청 2026-10-12: 「구글드라이브와 연결이 제일 편하다. 중간에 연결다리로」
  채팅 작업 환경은 드라이브 직접 다운로드가 막혀 있고, 드라이브 연결 도구는 10MB 까지만 받는다.
  → GitHub Actions(book-fetch.yml)가 이 스크립트로 드라이브에서 받아 20MB 조각으로 잘라 `books` 에 넣는다.
  → 채팅에서는 `get` 으로 조각을 받아 한 권으로 합친다 (sync/solution_note_build.py 로 노트 만들기).

드라이브 파일은 받는 동안만 「링크가 있는 사람 보기」로 열고, 끝나면 채팅에서 바로 닫는다.
책은 저작권물 — 공개 저장소(GitHub)·공개 보관함에 절대 올리지 않는다.

쓰는 법
  python3 sync/book_fetch.py put <드라이브파일ID> <책이름>     (Actions 에서)
  python3 sync/book_fetch.py get <책이름> <저장할.pdf>         (채팅에서)
  python3 sync/book_fetch.py list
  책이름은 영문·숫자·-·_ 만 (예: ssen-m1-2-2022). 보관 위치: books/<책이름>/part01.pdf … + manifest.json
환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import io, json, math, os, re, sys, urllib.request, urllib.error
from pypdf import PdfReader, PdfWriter

SB = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
BUCKET = 'books'
PART_MAX = 20 * 1024 * 1024


def sb(method, path, data=None, ctype='application/json', extra=None):
    h = {'apikey': KEY, 'authorization': f'Bearer {KEY}'}
    if data is not None:
        h['content-type'] = ctype
    h.update(extra or {})
    req = urllib.request.Request(f'{SB}/storage/v1/{path}', data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def drive_download(fid):
    url = f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t'
    req = urllib.request.Request(url, headers={'user-agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=600) as r:
        body = r.read()
    if not body.startswith(b'%PDF'):
        sys.exit('PDF 를 받지 못했습니다 — 드라이브 파일이 「링크가 있는 사람 보기」로 열려 있는지 확인 '
                 f'(받은 앞부분: {body[:80]!r})')
    return body


def split(pdf_bytes):
    reader = PdfReader(io.BytesIO(pdf_bytes))
    n = len(reader.pages)
    per = max(1, math.floor(n * PART_MAX * 0.9 / max(len(pdf_bytes), 1)))
    parts, i = [], 0
    while i < n:
        size = per
        while True:
            w = PdfWriter()
            for p in range(i, min(n, i + size)):
                w.add_page(reader.pages[p])
            buf = io.BytesIO()
            w.write(buf)
            if buf.tell() <= 45 * 1024 * 1024 or size == 1:   # 보관함 한 파일 한도 50MB
                break
            size = max(1, size // 2)
        parts.append((i + 1, min(n, i + size), buf.getvalue()))
        i += size
    return n, parts


def put(fid, name):
    body = drive_download(fid)
    n, parts = split(body)
    print(f'받음 {len(body) / 1e6:.1f}MB · {n}쪽 → 조각 {len(parts)}개')
    man = {'name': name, 'drive_id': fid, 'pages': n, 'bytes': len(body), 'parts': []}
    for k, (a, b, data) in enumerate(parts, 1):
        obj = f'{name}/part{k:02d}.pdf'
        sb('POST', f'object/{BUCKET}/{obj}', data, 'application/pdf', {'x-upsert': 'true'})
        man['parts'].append({'file': obj, 'from': a, 'to': b, 'bytes': len(data)})
        print(f'  {obj}: {a}~{b}쪽 {len(data) / 1e6:.1f}MB')
    sb('POST', f'object/{BUCKET}/{name}/manifest.json', json.dumps(man, ensure_ascii=False).encode(),
       'application/json', {'x-upsert': 'true'})
    print('끝')


def get(name, out):
    man = json.loads(sb('GET', f'object/{BUCKET}/{name}/manifest.json'))
    w = PdfWriter()
    for p in man['parts']:
        w.append(PdfReader(io.BytesIO(sb('GET', f'object/{BUCKET}/{p["file"]}'))))
    with open(out, 'wb') as f:
        w.write(f)
    print(f'{out}: {man["pages"]}쪽')


def lst():
    r = json.loads(sb('POST', f'object/list/{BUCKET}', json.dumps({'prefix': '', 'limit': 1000}).encode()))
    for it in r:
        print(it['name'])


if __name__ == '__main__':
    if not SB or not KEY:
        sys.exit('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다')
    a = sys.argv[1:]
    if a[:1] == ['put'] and len(a) == 3 and re.fullmatch(r'[A-Za-z0-9_-]+', a[2]):
        put(a[1], a[2])
    elif a[:1] == ['get'] and len(a) == 3:
        get(a[1], a[2])
    elif a[:1] == ['list']:
        lst()
    else:
        sys.exit(__doc__)
