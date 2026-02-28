#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import sys

FILES = [
    "index.html",
    "sobre.html",
    "contato.html",
    "privacidade.html",
    "termos.html",
    "changelog.html",
    "guias/index.html",
    "guias/erros-comuns.html",
    "guias/estudo-caso.html",
    "guias/ranking-concursos.html",
]

EXPECTED_LABELS = ["Ferramenta", "Sobre", "Contato", "Guias", "Termos", "Privacidade"]

class HeaderNavParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_header_nav = False
        self.header_depth = 0
        self.in_menu_nav = False
        self.nav_attrs = {}
        self.current_a = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "header" and attrs.get("class", "") == "nav":
            self.in_header_nav = True
            self.header_depth = 1
            return

        if self.in_header_nav:
            if tag == "header":
                self.header_depth += 1
            if tag == "nav" and attrs.get("class", "") == "menu" and not self.in_menu_nav:
                self.in_menu_nav = True
                self.nav_attrs = attrs
            elif self.in_menu_nav and tag == "a":
                self.current_a = {"href": attrs.get("href", ""), "text": ""}

    def handle_endtag(self, tag):
        if self.in_menu_nav and tag == "a" and self.current_a is not None:
            self.current_a["text"] = self.current_a["text"].strip()
            self.links.append(self.current_a)
            self.current_a = None
        elif self.in_menu_nav and tag == "nav":
            self.in_menu_nav = False

        if self.in_header_nav and tag == "header":
            self.header_depth -= 1
            if self.header_depth <= 0:
                self.in_header_nav = False

    def handle_data(self, data):
        if self.in_menu_nav and self.current_a is not None:
            self.current_a["text"] += data


def check_file(path: Path) -> list[str]:
    errors = []
    parser = HeaderNavParser()
    parser.feed(path.read_text(encoding="utf-8"))

    if not parser.nav_attrs:
        return [f"{path}: header/nav.menu não encontrado"]

    if parser.nav_attrs.get("aria-label") != "Menu principal":
        errors.append(f"{path}: nav.menu sem aria-label='Menu principal'")

    labels = [link["text"] for link in parser.links]
    missing = [label for label in EXPECTED_LABELS if label not in labels]
    if missing:
        errors.append(f"{path}: faltando links no cabeçalho: {', '.join(missing)}")

    return errors


def main() -> int:
    all_errors = []
    for file in FILES:
        path = Path(file)
        if not path.exists():
            all_errors.append(f"{path}: arquivo não encontrado")
            continue
        all_errors.extend(check_file(path))

    if all_errors:
        print("Falhas na validação do cabeçalho:\n")
        for error in all_errors:
            print(f"- {error}")
        return 1

    print("OK: cabeçalho padronizado em todos os HTMLs alvo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
