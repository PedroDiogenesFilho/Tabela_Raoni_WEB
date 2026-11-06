#!/usr/bin/env python3
"""Confere o contraste WCAG dos pares de tokens de assets/styles.css nos temas claro e escuro.

Texto exige 4,5:1; bordas de controle, foco e ícones exigem 3:1. Sai com código 1 se algum par falhar.
Uso, na raiz do repositório: python3 scripts/check_contrast.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

CSS = Path("assets/styles.css")

# (frente, fundo, mínimo). Nomes de token ou literais hex. O literal #fff é o texto dos botões verdes;
# #C5CDD8/#8E99A6/#B4BDC9 são os literais do rodapé e da barra de consentimento (escuros nos dois temas).
PAIRS = [
    ("--tinta", "--papel", 4.5), ("--tinta", "--papel-2", 4.5), ("--tinta", "--verde-claro", 4.5), ("--tinta", "--erro-claro", 4.5),
    ("--tinta-2", "--papel", 4.5), ("--tinta-2", "--papel-2", 4.5), ("--tinta-2", "--verde-claro", 4.5), ("--tinta-3", "--papel", 4.5),
    ("--verde", "--papel", 4.5), ("--verde", "--papel-2", 4.5), ("--verde", "--verde-claro", 4.5), ("--verde-2", "--verde-claro", 4.5),
    ("#fff", "--btn", 4.5), ("#fff", "--btn-2", 4.5), ("#fff", "--btn-3", 4.5), ("--btn", "--papel", 3.0),
    ("--marca-tinta", "--marca", 4.5), ("--erro", "--papel", 4.5), ("--erro", "--erro-claro", 4.5), ("--erro", "--papel-2", 4.5),
    ("--aviso", "--papel-2", 4.5), ("--aviso-ponto", "--papel-2", 3.0),
    ("#C5CDD8", "--rodape", 4.5), ("#8E99A6", "--rodape", 4.5), ("#fff", "--barra", 4.5), ("#C5CDD8", "--barra", 4.5), ("#B4BDC9", "--barra", 3.0),
    ("--papel", "--tinta", 4.5), ("--linha-2", "--papel", 3.0), ("--linha-2", "--papel-2", 3.0), ("--tinta", "--papel", 3.0),
]


def tokens(css: str, block_start: str) -> dict[str, str]:
    start = css.index(block_start)
    end = css.index("}", start)
    return dict(re.findall(r"(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,6})\b", css[start:end]))


def luminance(color: str) -> float:
    h = color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    channels = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main() -> int:
    css = CSS.read_text(encoding="utf-8")
    light = tokens(css, ":root {")
    dark = {**light, **tokens(css, ':root[data-theme="dark"] {')}
    failures = 0
    for name, theme in (("claro", light), ("escuro", dark)):
        for fg, bg, minimum in PAIRS:
            a, b = theme.get(fg, fg), theme.get(bg, bg)
            if not (a.startswith("#") and b.startswith("#")):
                print(f"ERRO {name}: token não resolvido em {fg} / {bg}")
                failures += 1
                continue
            r = ratio(a, b)
            if r < minimum:
                failures += 1
                print(f"FALHA {name}: {fg} ({a}) sobre {bg} ({b}) = {r:.2f}:1, mínimo {minimum}")
    print("OK: contraste dos tokens nos dois temas." if not failures else f"{failures} par(es) abaixo do mínimo.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
