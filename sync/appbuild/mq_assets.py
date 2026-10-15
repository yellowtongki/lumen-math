# 🧠 루멘 수학퀴즈 — 캐릭터 도트 그림(docs/char_px2/*.png)을 앱에 심는 조각 (학원앱 v19-121 · 학생앱 v2-137 조립이 같이 쓴다)
#   최종 그림이 오면 docs/char_px2/ 의 PNG 만 같은 이름으로 바꾸고 두 앱을 다시 조립하면 된다.
import os, base64, json

NAMES = ['lumi_head', 'lumi_full', 'lumi_oops_head', 'lumi_oops_full',
         'aha_head', 'aha_full', 'aha_aha_head', 'aha_aha_full',
         'ssam_head', 'ssam_full']

def mq_px_js(root):
    d = os.path.join(root, 'docs', 'char_px2')
    m = {}
    for n in NAMES:
        p = os.path.join(d, n + '.png')
        if not os.path.exists(p):
            raise SystemExit('❌ 루멘 수학퀴즈 캐릭터 그림이 없습니다: ' + p)
        m[n] = 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    return ('/* ★ 루멘 수학퀴즈 캐릭터 도트 — 조립 때 docs/char_px2/*.png 를 그대로 심음 (손으로 고치지 말 것) */\n'
            'window.MQ_PX = ' + json.dumps(m) + ';\n')

def mq_bundle(root, modules_dir):
    """그림 + 함께 쓰는 그리기(mathquiz_render.js)"""
    return mq_px_js(root) + open(os.path.join(modules_dir, 'mathquiz_render.js'), encoding='utf-8').read() + '\n'
