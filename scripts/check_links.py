#!/usr/bin/env python3
"""Confere links e assets internos de todos os .html e as URLs do sitemap.xml.

Executar a partir da raiz do repositório. Não acessa a rede: links externos
(http/https), mailto:, tel:, javascript:, data: e âncoras (#) são ignorados.
"""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE = "https://tabelaraoni.com.br/"
SKIP_PREFIXES = ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:", "#")
IGNORED_DIRS = {"dist", ".git"}


class RefCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("href", "src") and value:
                self.refs.append(value.strip())


def discover_pages(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.html") if not IGNORED_DIRS & set(p.relative_to(root).parts))


def check_page(root: Path, page: Path) -> list[str]:
    errors = []
    collector = RefCollector()
    collector.feed(page.read_text(encoding="utf-8"))
    for ref in collector.refs:
        if ref.startswith(SKIP_PREFIXES):
            continue
        path = unquote(urlsplit(ref).path)
        if not path:
            continue
        target = (root / path.lstrip("/")) if path.startswith("/") else (page.parent / path)
        target = target.resolve()
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            errors.append(f"{page.relative_to(root)}: '{ref}' não encontrado")
    return errors


def check_sitemap(root: Path) -> list[str]:
    sitemap = root / "sitemap.xml"
    if not sitemap.is_file():
        return []
    errors = []
    for loc in re.findall(r"<loc>\s*(.*?)\s*</loc>", sitemap.read_text(encoding="utf-8")):
        if not loc.startswith(SITE):
            errors.append(f"sitemap.xml: {loc} fora de {SITE}")
            continue
        rel = loc[len(SITE):] or "index.html"
        if not (root / rel).is_file():
            errors.append(f"sitemap.xml: {loc} não corresponde a um arquivo do repositório")
    return errors


def main() -> int:
    root = Path.cwd().resolve()
    pages = discover_pages(root)
    if not pages:
        print("Nenhum HTML encontrado (execute a partir da raiz do repositório).")
        return 1

    errors = []
    for page in pages:
        errors.extend(check_page(root, page))
    errors.extend(check_sitemap(root))

    if errors:
        print("Falhas na verificação de links:\n")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"OK: links internos de {len(pages)} páginas e sitemap.xml conferidos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
