#!/usr/bin/env python3
"""Gera Support/AppIcon.png e Support/AppIcon.icns (todos os tamanhos) a partir do ícone do app
(mobile/assets/images/pilinha-icon.png, 1024 RGB). No Mac o ícone ganha o "squircle" com margem padrão do macOS.
Uso: python3 Support/make-icon.py   (precisa de Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
src = Image.open(root / "mobile/assets/images/pilinha-icon.png").convert("RGB")
S, m = 1024, 100                      # grade de ícone do macOS: 824 px de squircle
inner = S - 2 * m
SS = 4                                # supersample para borda suave
mask = Image.new("L", (inner * SS, inner * SS), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner * SS - 1, inner * SS - 1), radius=int(inner * 0.225) * SS, fill=255)
mask = mask.resize((inner, inner), Image.LANCZOS)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(src.resize((inner, inner), Image.LANCZOS), (m, m), mask)
icon.save(root / "Support/AppIcon.png")
icon.save(root / "Support/AppIcon.icns", sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
print("ok")
