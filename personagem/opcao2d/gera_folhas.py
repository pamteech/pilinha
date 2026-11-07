# Gera TODAS as folhas de animação do porquinho a partir da folha de arte (folha_hi.jpg, ampliada por superres.py; senão folha_ia.jpg):
# 12 humores x 6 cores em WebP (quadros de 384 px), miniaturas para o seletor de cor, stills do widget e prévias em GIF.
# Uso: python3 personagem/opcao2d/gera_folhas.py
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import numpy as np, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); MOB = os.path.normpath(os.path.join(HERE, '..', '..', 'mobile'))
OUT = os.path.join(MOB, 'assets', 'pig'); WIDGET = os.path.join(MOB, 'targets', 'widget', 'Assets.xcassets')
FONT = os.path.join(MOB, 'node_modules', '@expo-google-fonts', 'manrope', '800ExtraBold', 'Manrope_800ExtraBold.ttf')
S, PIG, COLS = 384, 315, 8  # quadro, maior lado do porquinho (mesma proporção dos 256/210 originais), colunas da grade
# Loops lentos (respirar, balançar) têm 24 quadros a 12 fps (2 s); os rápidos (pulo, susto) 24 quadros a 24 fps. Tem que bater com core/mood.ts.
# As folhas são grades de COLS quadros por linha (o WebP não aceita mais de 16383 px de largura); o app lê a grade (SHEET_COLS em core/mood.ts).
K = S / 256; P = lambda v: int(round(v * K))   # coordenadas dos símbolos pensadas em 256 px
CORES = {'rosa': (335, 1.05, False), 'azul': (212, 1.0, False), 'menta': (150, 0.85, False), 'dourado': (42, 1.15, False), 'cinza': (None, 1.0, True)}
BASE = ['feliz', 'neutro', 'triste', 'dormindo', 'erro', 'ganhou']
hi = os.path.join(HERE, 'folha_hi.jpg'); src = Image.open(hi if os.path.exists(hi) else os.path.join(HERE, 'folha_ia.jpg')).convert('RGB')
print('fonte:', 'folha_hi.jpg (4x)' if os.path.exists(hi) else 'folha_ia.jpg', src.size)
W, H = src.size; cw, ch = W / 3, H / 3
CELLS = {'neutro': (0, 0), 'feliz': (0, 1), 'triste': (0, 2), 'preocupado': (1, 2), 'dormindo': (2, 0), 'erro': (2, 1), 'ganhou': (2, 2)}
def key_green(im):
    a = np.asarray(im).astype(np.float32) / 255; r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gness = g - np.maximum(r, b); alpha = 1 - np.clip((gness - 0.08) / 0.18, 0, 1); g2 = np.minimum(g, np.maximum(r, b) * 1.02)
    o = Image.fromarray((np.dstack([r, g2, b, alpha]) * 255).astype(np.uint8), 'RGBA')
    al = o.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)); o.putalpha(al); return o
def cell(r, c):
    k = key_green(src.crop((int(c*cw), int(r*ch), int((c+1)*cw), int((r+1)*ch))))
    bb = k.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox(); k = k.crop(bb)
    s = PIG / max(k.size); return k.resize((int(k.width*s), int(k.height*s)), Image.LANCZOS)
def still(img):
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0)); can.alpha_composite(img, (int(S/2 - img.width/2), int(S - P(16) - img.height))); return can
def eyes(im):
    a = np.asarray(im); dark = (a[..., 3] > 200) & (a[..., :3].sum(-1) < 90); ys, xs = np.nonzero(dark[P(40):P(150)]); ys = ys + P(40)
    left = xs < P(96); return (int(xs[left].mean()), int(ys[left].mean())), (int(xs[~left].mean()), int(ys[~left].mean()))
def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s*0.9, cx, cy + s*0.1), fill=fill); d.ellipse((cx, cy - s*0.9, cx + s, cy + s*0.1), fill=fill)
    d.polygon([(cx - s*0.98, cy - s*0.2), (cx + s*0.98, cy - s*0.2), (cx, cy + s*0.95)], fill=fill)
def apaixonado(base):
    im = base.copy(); d = ImageDraw.Draw(im); (lx, ly), (rx, ry) = eyes(base)
    for (x, y) in [(lx, ly), (rx, ry)]: d.ellipse((x - P(13), y - P(13), x + P(13), y + P(13)), fill=(255, 255, 255, 255)); heart(d, x, y + P(1), P(10), '#F43F5E'); d.ellipse((x - P(7), y - P(7), x - P(3), y - P(3)), fill=(255, 255, 255, 230))
    for (x, y, s) in [(176, 48, 9), (196, 72, 6), (164, 78, 5)]: heart(d, P(x), P(y), P(s), '#FB7185')
    return im
def pensando(base):
    im = base.copy(); d = ImageDraw.Draw(im)
    for (x, y, r) in [(150, 84, 5), (162, 68, 8)]: d.ellipse((P(x - r), P(y - r), P(x + r), P(y + r)), fill='white', outline='#D8C4FF', width=P(2))
    d.rounded_rectangle((P(164), P(18), P(236), P(62)), radius=P(20), fill='white', outline='#D8C4FF', width=P(2))
    for x in (184, 200, 216): d.ellipse((P(x - 4), P(36), P(x + 4), P(44)), fill='#7A5590')
    return im
def rico(base):
    im = base.copy(); d = ImageDraw.Draw(im); (lx, ly), (rx, ry) = eyes(base); f = ImageFont.truetype(FONT, P(18)); f2 = ImageFont.truetype(FONT, P(11))
    for (x, y) in [(lx, ly), (rx, ry)]: d.ellipse((x - P(13), y - P(13), x + P(13), y + P(13)), fill='#F59E0B', outline='#B45309', width=P(2)); d.text((x - P(6), y - P(12)), '$', font=f, fill='#78350F')
    for (x, y) in [(40, 64), (206, 58), (226, 104), (28, 118)]: d.ellipse((P(x - 8), P(y - 8), P(x + 8), P(y + 8)), fill='#F59E0B', outline='#B45309', width=P(2)); d.text((P(x - 4), P(y - 8)), '$', font=f2, fill='#78350F')
    return im
def surpreso(base):
    im = base.copy(); d = ImageDraw.Draw(im); (lx, ly), (rx, ry) = eyes(base)
    for (x, y) in [(lx, ly), (rx, ry)]: d.ellipse((x - P(14), y - P(14), x + P(14), y + P(14)), fill='white', outline='#241B2E', width=P(2)); d.ellipse((x - P(7), y - P(7), x + P(7), y + P(7)), fill='#241B2E'); d.ellipse((x - P(5), y - P(6), x - P(1), y - P(2)), fill='white')
    d.text((P(176), P(24)), '!?', font=ImageFont.truetype(FONT, P(40)), fill='#DC2626', stroke_width=P(2), stroke_fill='white')
    return im
def chorando(base):
    im = base.copy(); d = ImageDraw.Draw(im); (lx, ly), (rx, ry) = eyes(base)
    for (x, y) in [(lx, ly), (rx, ry)]:
        for k in range(3): d.ellipse((x - P(5), y + P(16 + k * 14), x + P(5), y + P(30 + k * 14)), fill=(96, 165, 250, 230))
    for (x, y) in [(lx - P(18), ly - P(30)), (rx + P(20), ry - P(26))]: d.ellipse((x - P(4), y - P(6), x + P(4), y + P(6)), fill=(147, 197, 253, 230))
    return im
ART = {n: still(cell(*rc)) for n, rc in CELLS.items()}
ART.update({'apaixonado': apaixonado(ART['neutro']), 'pensando': pensando(ART['neutro']), 'rico': rico(ART['feliz']), 'surpreso': surpreso(ART['neutro']), 'chorando': chorando(ART['triste'])})
# animação por transformação do quadro inteiro, reancorado pelo centro inferior (valores de dx/dy pensados em 256 px)
def frame(img, dx=0, dy=0, sx=1, sy=1, rot=0):
    w, h = img.size; im = img.resize((max(1, int(w*sx)), max(1, int(h*sy))), Image.LANCZOS)
    if rot: im = im.rotate(rot, Image.BICUBIC, expand=True)
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0)); can.alpha_composite(im, (int(S/2 - im.width/2 + dx*K), int(S - im.height + dy*K))); return can
def hop(t, i, h=34):
    if t < 0.15: k = t/0.15; return dict(sx=1 + 0.1*k, sy=1 - 0.12*k)
    if t < 0.65: k = (t-0.15)/0.5; z = math.sin(math.pi*k); return dict(dy=-h*z, sx=1 - 0.06*(1-z), sy=1 + 0.08*(1-z))
    if t < 0.8: k = (t-0.65)/0.15; return dict(sx=1 + 0.12*math.sin(math.pi*k), sy=1 - 0.14*math.sin(math.pi*k))
    return dict()
def win(t, i):
    if t < 0.2: k = t/0.2; return dict(sx=1 + 0.12*k, sy=1 - 0.15*k)
    if t < 0.75: k = (t-0.2)/0.55; z = math.sin(math.pi*k); return dict(dy=-44*z, rot=12*math.sin(2*math.pi*k), sx=0.94 + 0.06*z, sy=1.08 - 0.08*z)
    if t < 0.88: k = (t-0.75)/0.13; return dict(sx=1 + 0.12*math.sin(math.pi*k), sy=1 - 0.14*math.sin(math.pi*k))
    return dict()
ANIM = {
    'neutro': (24, lambda t, i: dict(sx=1 - 0.012*math.sin(2*math.pi*t), sy=1 + 0.025*math.sin(2*math.pi*t))),
    'feliz': (24, hop),
    'triste': (24, lambda t, i: dict(rot=3*math.sin(2*math.pi*t), sy=0.98 + 0.01*math.sin(4*math.pi*t))),
    'dormindo': (24, lambda t, i: dict(sx=1 + 0.02*math.sin(2*math.pi*t), sy=1 - 0.035*math.sin(2*math.pi*t))),
    'erro': (24, lambda t, i: dict(dx=(5 if i % 4 < 2 else -5) if i < 18 else 0, rot=(2 if i % 4 < 2 else -2) if i < 18 else 0)),
    'ganhou': (37, lambda t, i: win(i / 36, i)),
    'preocupado': (24, lambda t, i: dict(rot=2*math.sin(2*math.pi*t), sy=0.99 + 0.01*math.sin(4*math.pi*t))),
    'apaixonado': (24, lambda t, i: dict(sx=1 + 0.03*max(0, math.sin(4*math.pi*t)), sy=1 + 0.03*max(0, math.sin(4*math.pi*t)), dy=-5*abs(math.sin(2*math.pi*t)))),
    'pensando': (24, lambda t, i: dict(rot=2.5*math.sin(2*math.pi*t), sy=1 + 0.015*math.sin(2*math.pi*t))),
    'rico': (24, lambda t, i: hop(t, i, 22)),
    'surpreso': (24, lambda t, i: dict(dy=-10*math.sin(math.pi*min(1, t/0.3)) if t < 0.3 else 0, sx=1.06 if t < 0.3 else 1, sy=1.06 if t < 0.3 else 1)),
    'chorando': (24, lambda t, i: dict(dx=3*math.sin(6*math.pi*t), rot=1.5*math.sin(6*math.pi*t), sy=0.98)),
}
def recolor(im, target_h, sat_mul, desat):
    a = np.asarray(im).astype(np.float32) / 255; out = a.copy(); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0); d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    purple = (h > 0.62) & (h < 0.90) & (s > 0.035) & (a[..., 3] > 0)
    if desat: s2 = np.where(purple, s * 0.12, s); h2 = h
    else: h2 = np.where(purple, (target_h / 360) % 1, h); s2 = np.where(purple, np.clip(s * sat_mul, 0, 1), s)
    i = np.floor(h2 * 6) % 6; f = h2 * 6 - np.floor(h2 * 6); p = v * (1 - s2); q = v * (1 - s2 * f); t = v * (1 - s2 * (1 - f))
    sel = lambda vals: np.select([i == k for k in range(6)], vals); R, G, B = sel([v, q, p, p, t, v]), sel([t, v, v, q, p, p]), sel([p, p, t, v, v, q])
    out[..., 0] = np.where(purple, R, r); out[..., 1] = np.where(purple, G, g); out[..., 2] = np.where(purple, B, b)
    return Image.fromarray((out * 255).round().astype(np.uint8), 'RGBA')
def save_webp(sheet, path): sheet.save(path, 'WEBP', quality=78, method=6)
os.makedirs(os.path.join(HERE, 'previews'), exist_ok=True)
for cor in CORES: os.makedirs(os.path.join(OUT, cor), exist_ok=True)
for name, (L, fn) in ANIM.items():
    frames = [frame(ART[name], **fn(i / L, i)) for i in range(L)]
    rows = -(-L // COLS); pos = lambda i: ((i % COLS) * S, (i // COLS) * S)
    sheet = Image.new('RGBA', (S * COLS, S * rows)); [sheet.paste(f, pos(i)) for i, f in enumerate(frames)]
    save_webp(sheet, os.path.join(OUT, f'porco2d_{name}.webp'))
    for cor, (hue, sm, ds) in CORES.items():
        sh = Image.new('RGBA', (S * COLS, S * rows)); [sh.paste(recolor(f, hue, sm, ds), pos(i)) for i, f in enumerate(frames)]
        save_webp(sh, os.path.join(OUT, cor, f'porco2d_{name}.webp'))
    if name == 'neutro':
        frames[0].resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'still_roxo.png'), optimize=True)
        for cor, (hue, sm, ds) in CORES.items(): recolor(frames[0], hue, sm, ds).resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, f'still_{cor}.png'), optimize=True)
    if name in BASE:  # widget e Ilha Dinâmica: still do humor
        frames[0].save(os.path.join(WIDGET, f'pig_{name}.imageset', 'pig.png'), optimize=True)
    g = [Image.alpha_composite(Image.new('RGBA', (S, S), (27, 27, 31, 255)), f).convert('RGB').resize((256, 256), Image.LANCZOS) for f in frames]
    fps = 24 if name in ('feliz', 'erro', 'ganhou', 'rico', 'surpreso') else 12
    g[0].save(os.path.join(HERE, 'previews', f'{name}.gif'), save_all=True, append_images=g[1:], duration=int(1000 / fps), loop=0)
    print(name, L, 'quadros')
print('ok')
