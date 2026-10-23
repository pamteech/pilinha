#!/usr/bin/env python3
"""Gera Support/AppIcon.icns a partir do 1º quadro de porco2d_feliz@2x.png (sprite próprio do NotchInvest).
Uso: python3 Support/make-icon.py   (precisa de Pillow: pip3 install pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parent.parent
sheet = Image.open(root / "Sources/NotchInvestApp/Resources/Cofrinho/porco2d_feliz@2x.png").convert("RGBA")
fr = sheet.height
pig = sheet.crop((0, 0, fr, fr))
pig = pig.crop(pig.getbbox())

S = 1024
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# "squircle" escuro como a ilha do entalhe, com brilho rosa
m = 100
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(bg)
d.rounded_rectangle((m, m, S - m, S - m), radius=185, fill=(22, 18, 30, 255))
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((260, 300, 764, 820), fill=(255, 105, 180, 120))
glow = glow.filter(ImageFilter.GaussianBlur(90))
mask = bg.split()[3]
bg.alpha_composite(Image.composite(glow, Image.new("RGBA", (S, S)), mask))
icon.alpha_composite(bg)
# porquinho
target = 640
scale = target / max(pig.size)
p = pig.resize((int(pig.width * scale), int(pig.height * scale)), Image.LANCZOS)
icon.alpha_composite(p, ((S - p.width) // 2, (S - p.height) // 2 + 30))
out = root / "Support"
icon.save(out / "AppIcon.png")
icon.save(out / "AppIcon.icns", sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
print("ok:", out / "AppIcon.icns")
