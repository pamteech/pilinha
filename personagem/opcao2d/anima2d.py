# Opção B (2D): recorta a folha gerada por IA, remove o fundo verde e anima por transformações (estilo Rive/Lottie).
from PIL import Image, ImageFilter
import numpy as np, math, os
src = Image.open("folha_ia.jpg").convert("RGB"); W, H = src.size
cw, ch = W / 3, H / 3
CELLS = {"neutro": (0, 0), "feliz": (0, 1), "triste": (0, 2), "dormindo": (2, 0), "erro": (2, 1), "ganhou": (2, 2)}
def key_green(im):
    a = np.asarray(im).astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gness = g - np.maximum(r, b)                      # quão "verde" é o pixel
    alpha = 1 - np.clip((gness - 0.08) / 0.18, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) * 1.02)       # despill
    out = np.dstack([r, g2, b, alpha])
    o = Image.fromarray((out * 255).astype(np.uint8), "RGBA")
    al = o.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)); o.putalpha(al)
    return o
os.makedirs("arte", exist_ok=True)
art = {}
for n, (r, c) in CELLS.items():
    cell = src.crop((int(c*cw), int(r*ch), int((c+1)*cw), int((r+1)*ch)))
    k = key_green(cell); bb = k.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox(); k = k.crop(bb)
    s = 210 / max(k.size); k = k.resize((int(k.width*s), int(k.height*s)), Image.LANCZOS)
    art[n] = k; k.save(f"arte/{n}.png")
def frame(img, dx=0, dy=0, sx=1, sy=1, rot=0, S=256):
    w, h = img.size; im = img.resize((max(1, int(w*sx)), max(1, int(h*sy))), Image.LANCZOS)
    if rot: im = im.rotate(rot, Image.BICUBIC, expand=True)
    can = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # ancora pelos pés (base) no centro inferior
    x = int(S/2 - im.width/2 + dx); y = int(S - 16 - im.height + dy)
    can.alpha_composite(im, (x, y)); return can
FR = {}
def anim(n, L, fn): FR[n] = [frame(art[n], **fn(i / L, i)) for i in range(L)]
anim("neutro", 48, lambda t, i: dict(sx=1 - 0.012*math.sin(2*math.pi*t), sy=1 + 0.025*math.sin(2*math.pi*t)))
def hop(t, i):
    # antecipação → pulo → squash na queda
    if t < 0.15: k = t/0.15; return dict(sx=1 + 0.1*k, sy=1 - 0.12*k)
    if t < 0.65: k = (t-0.15)/0.5; z = math.sin(math.pi*k); return dict(dy=-34*z, sx=1 - 0.06*(1-z), sy=1 + 0.08*(1-z))
    if t < 0.8: k = (t-0.65)/0.15; return dict(sx=1 + 0.12*math.sin(math.pi*k), sy=1 - 0.14*math.sin(math.pi*k))
    return dict()
anim("feliz", 24, hop)
anim("triste", 48, lambda t, i: dict(rot=3*math.sin(2*math.pi*t), sy=0.98 + 0.01*math.sin(4*math.pi*t)))
anim("dormindo", 48, lambda t, i: dict(sx=1 + 0.02*math.sin(2*math.pi*t), sy=1 - 0.035*math.sin(2*math.pi*t)))
anim("erro", 24, lambda t, i: dict(dx=(5 if i % 4 < 2 else -5) if i < 18 else 0, rot=(2 if i % 4 < 2 else -2) if i < 18 else 0))
def win(t, i):
    if t < 0.2: k = t/0.2; return dict(sx=1 + 0.12*k, sy=1 - 0.15*k)
    if t < 0.75: k = (t-0.2)/0.55; z = math.sin(math.pi*k); return dict(dy=-44*z, rot=12*math.sin(2*math.pi*k), sx=0.94 + 0.06*z, sy=1.08 - 0.08*z)
    if t < 0.88: k = (t-0.75)/0.13; return dict(sx=1 + 0.12*math.sin(math.pi*k), sy=1 - 0.14*math.sin(math.pi*k))
    return dict()
FR["ganhou"] = [frame(art["ganhou"], **win(i / 36, i)) for i in range(37)]
os.makedirs("previews", exist_ok=True); os.makedirs("sheets", exist_ok=True)
for n, fs in FR.items():
    for S in (256, 128):
        d = f"frames/{S}/{n}"; os.makedirs(d, exist_ok=True)
        fx = [f if S == 256 else f.resize((128, 128), Image.LANCZOS) for f in fs]
        for i, f in enumerate(fx): f.save(f"{d}/f_{i:04d}.png")
        sheet = Image.new("RGBA", (S*len(fx), S)); [sheet.paste(f, (i*S, 0)) for i, f in enumerate(fx)]
        sheet.save(f"sheets/porco2d_{n}{'@2x' if S == 256 else ''}.png")
    g = [Image.alpha_composite(Image.new("RGBA", f.size, (27, 27, 31, 255)), f).convert("RGB") for f in fs]
    g[0].save(f"previews/{n}.gif", save_all=True, append_images=g[1:], duration=42, loop=0)
print("ok")
