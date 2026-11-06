#!/usr/bin/env python3
"""Gera os ativos de marca do site com Pillow: favicon-32.png, apple-touch-icon.png e og-cover.png.

Uso, na raiz do repositório:
  python3 -I scripts/make_brand_assets.py --bricolage /caminho/BricolageGrotesque.ttf --source-sans /caminho/SourceSans3.ttf

Os TTFs variáveis (licença OFL) vêm de https://github.com/google/fonts (ofl/bricolagegrotesque e
ofl/sourcesans3) e NÃO são versionados; só os PNGs gerados entram no repositório. O glifo é o mesmo de
assets/marca.svg ("sua linha na tabela": tabela de três linhas com a do meio grifada de marca-texto).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PAPEL = (255, 255, 255)
TINTA = (28, 36, 48)
TINTA_2 = (90, 100, 114)
LINHA_2 = (126, 137, 151)
VERDE = (11, 110, 79)
MARCA = (255, 228, 92)


def glyph(draw: ImageDraw.ImageDraw, ox: int, oy: int, s: int) -> None:
    """Desenha o glifo na grade 24×24 de assets/marca.svg, escala `s` px por unidade, origem (ox, oy)."""
    # linha do meio grifada (entre as réguas de y=9 e y=15, dentro do contorno)
    draw.rectangle([ox + 3 * s, oy + 10 * s, ox + 21 * s, oy + 14 * s], fill=MARCA)
    # contorno (traço de 2 unidades centrado no retângulo 2..22 × 3..21 do SVG)
    draw.rounded_rectangle([ox + 1 * s, oy + 2 * s, ox + 23 * s, oy + 22 * s], radius=3 * s, outline=TINTA, width=2 * s)
    # réguas horizontais (y=9 e y=15) e a coluna das posições (x=8)
    for y in (9, 15):
        draw.rectangle([ox + 2 * s, oy + (y - 1) * s, ox + 22 * s, oy + (y + 1) * s], fill=TINTA)
    draw.rectangle([ox + 7 * s, oy + 3 * s, ox + 9 * s, oy + 21 * s], fill=TINTA)


def font(path: Path, size: int, **axes: float) -> ImageFont.FreeTypeFont:
    """Carrega um TTF (variável ou não) e aplica os eixos pedidos: wght, opsz, wdth."""
    f = ImageFont.truetype(str(path), size)
    try:
        axis_list = f.get_variation_axes()
    except OSError:
        return f
    values = []
    for axis in axis_list:
        name = axis["name"].decode() if isinstance(axis["name"], bytes) else str(axis["name"])
        key = name.lower()
        if key.startswith("weight"):
            values.append(axes.get("wght", axis["default"]))
        elif key.startswith("optical"):
            values.append(axes.get("opsz", axis["default"]))
        elif key.startswith("width"):
            values.append(axes.get("wdth", axis["default"]))
        else:
            values.append(axis["default"])
    f.set_variation_by_axes(values)
    return f


def make_icon(out: Path, name: str, size: int, scale: int, render: int | None = None) -> None:
    """Ícone quadrado com fundo branco. Se `render` for dado, desenha maior e reduz com LANCZOS."""
    canvas = render or size
    im = Image.new("RGB", (canvas, canvas), PAPEL)
    d = ImageDraw.Draw(im)
    g = 24 * scale
    off = (canvas - g) // 2
    glyph(d, off, off, scale)
    if render:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(out / name, optimize=True)


def make_og(out: Path, bricolage: Path, source_sans: Path) -> None:
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), PAPEL)
    d = ImageDraw.Draw(im)

    glyph(d, 80, 72, 4)  # 96 px
    d.text((200, 150), "Tabela Raoni", font=font(bricolage, 84, opsz=96, wght=600, wdth=100), fill=TINTA, anchor="ls")
    d.text((80, 232), "Projeção de posição em concursos públicos", font=font(source_sans, 40, wght=400), fill=TINTA_2, anchor="ls")

    # régua: linha, traços a cada 10%, extremos e pino a 37,5% (como a faixa 0,70c–1,50c da calculadora)
    x0, x1, y = 80, 1120, 440
    pos = x0 + 0.375 * (x1 - x0)
    d.rectangle([x0, y - 2, x1, y + 2], fill=TINTA)
    for i in range(11):
        tx = x0 + i * (x1 - x0) / 10
        d.rectangle([tx - 1, y + 8, tx + 1, y + 18], fill=LINHA_2)
    for x in (x0, x1):
        d.rectangle([x - 1, y - 14, x + 1, y + 14], fill=TINTA)
    d.ellipse([pos - 20, y - 20, pos + 20, y + 20], fill=PAPEL)
    d.ellipse([pos - 15, y - 15, pos + 15, y + 15], fill=VERDE)

    # número central grifado de marca-texto
    f_num = font(bricolage, 120, opsz=96, wght=600, wdth=100)
    numero = "2.030"
    bbox = d.textbbox((pos, 404), numero, font=f_num, anchor="ms")
    d.rectangle([bbox[0] - 18, bbox[1] - 10, bbox[2] + 18, bbox[3] + 12], fill=MARCA)
    d.text((pos, 404), numero, font=f_num, fill=TINTA, anchor="ms")
    d.text((bbox[0] - 18, 300), "Posição projetada", font=font(source_sans, 30, wght=600), fill=TINTA_2, anchor="ls")

    f40 = font(source_sans, 40, wght=600)
    f26 = font(source_sans, 26, wght=400)
    d.text((x0, 492), "1.420", font=f40, fill=TINTA, anchor="ls")
    d.text((x0, 524), "melhor", font=f26, fill=TINTA_2, anchor="ls")
    d.text((x1, 492), "3.050", font=f40, fill=TINTA, anchor="rs")
    d.text((x1, 524), "pior", font=f26, fill=TINTA_2, anchor="rs")
    d.text((80, 586), "tabelaraoni.com.br", font=font(source_sans, 32, wght=400), fill=TINTA_2, anchor="ls")

    im = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    im.save(out / "og-cover.png", optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bricolage", required=True, type=Path, help="TTF variável da Bricolage Grotesque")
    ap.add_argument("--source-sans", required=True, type=Path, help="TTF variável da Source Sans 3")
    ap.add_argument("--out", default=Path("assets"), type=Path, help="pasta de saída (padrão: assets)")
    args = ap.parse_args()
    for p in (args.bricolage, args.source_sans):
        if not p.is_file():
            print(f"ERRO: fonte não encontrada: {p}", file=sys.stderr)
            return 1
    args.out.mkdir(parents=True, exist_ok=True)
    make_icon(args.out, "favicon-32.png", size=32, scale=4, render=96)
    make_icon(args.out, "apple-touch-icon.png", size=180, scale=6)
    make_og(args.out, args.bricolage, args.source_sans)
    for name in ("favicon-32.png", "apple-touch-icon.png", "og-cover.png"):
        p = args.out / name
        with Image.open(p) as im:
            print(f"OK: {p} {im.size[0]}x{im.size[1]} {p.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
