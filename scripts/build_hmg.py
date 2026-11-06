#!/usr/bin/env python3
"""Gera em --out a versão de HOMOLOGAÇÃO (HMG) do site.

Uso, a partir da raiz do repositório:
    python3 scripts/build_hmg.py [--out dist] [--cname hmg.tabelaraoni.com.br]

Só grava no diretório de saída; nunca altera os fontes. O que faz:
  * copia apenas arquivos versionados pelo git (mesma semântica do deploy de produção),
    exceto .github/, .gitignore, scripts/ e README.md;
  * não leva CNAME, ads.txt nem sitemap.xml; grava um robots.txt próprio de HMG;
  * em cada .html: remove as tags do AdSense e o <link rel="canonical">, troca/insere
    <meta name="robots" content="noindex, nofollow">, insere <meta name="tr-ads-policy"
    content="disabled"> (respeitada por assets/consent.js) e injeta a faixa
    "AMBIENTE DE HOMOLOGAÇÃO" antes de </body>;
  * cria .nojekyll, hmg-version.txt e um README.md avisando que o repositório é gerado.

Falha (exit 1) se alguma página fugir do padrão esperado, para que as transformações
não envelheçam em silêncio quando páginas forem criadas ou alteradas.
"""
from __future__ import annotations

import argparse
import html
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROD_HOSTS = {"tabelaraoni.com.br", "www.tabelaraoni.com.br"}
PROD_URL = "https://tabelaraoni.com.br/"
SOURCE_REPO = "https://github.com/PedroDiogenesFilho/Tabela_Raoni_WEB"

EXCLUDE_TOP = {".github", ".gitignore", "scripts", "README.md"}  # não fazem parte do site
PROD_ONLY = {"CNAME", "ads.txt", "sitemap.xml", "robots.txt"}    # não copiados (robots.txt é reescrito)

RE_HEAD_END = re.compile(r"</head\s*>", re.I)
RE_BODY_END = re.compile(r"</body\s*>", re.I)
# Cada padrão engole a indentação e a quebra de linha para não deixar linhas vazias.
RE_ADS_META = re.compile(r'[ \t]*<meta\b[^>]*\bname="google-adsense-account"[^>]*>[ \t]*\r?\n?', re.I)
RE_ADS_JS = re.compile(
    r'[ \t]*<script\b[^>]*\bsrc="https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js[^"]*"'
    r"[^>]*>\s*</script>[ \t]*\r?\n?",
    re.I,
)
RE_CANONICAL = re.compile(r'[ \t]*<link\b[^>]*\brel="canonical"[^>]*>[ \t]*\r?\n?', re.I)
RE_ROBOTS = re.compile(r'[ \t]*<meta\b[^>]*\bname="robots"[^>]*>[ \t]*\r?\n?', re.I)

# Nada disto pode sobrar em um HTML de HMG.
FORBIDDEN = (
    "adsbygoogle",
    "googlesyndication",
    "google-adsense-account",
    "googletagmanager.com/gtag/js",
    'rel="canonical"',
)

HEAD_INJECT = (
    "  <!-- HMG: injetado por scripts/build_hmg.py; não existe em produção -->\n"
    '  <meta name="robots" content="noindex, nofollow" />\n'
    '  <meta name="tr-ads-policy" content="disabled" />\n'
)

BANNER = """\
  <!-- HMG: faixa injetada por scripts/build_hmg.py; não existe em produção -->
  <style>
    #tr-hmg-banner{{position:fixed;left:0;right:0;bottom:0;z-index:998;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;justify-content:center;padding:8px 12px;background:#b45309;color:#fff;font:700 13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.02em;box-shadow:0 -6px 24px rgba(0,0,0,.35)}}
    #tr-hmg-banner small{{font-weight:500;opacity:.92}}
    #tr-hmg-banner a{{color:#fff;text-decoration:underline;text-underline-offset:3px}}
    body{{padding-bottom:64px}}
  </style>
  <div id="tr-hmg-banner" role="status" aria-label="Ambiente de homologação">
    <span>AMBIENTE DE HOMOLOGAÇÃO — conteúdo em teste; não é o site oficial.</span>
    <small>build {sha} · {ref} · {when}</small>
    <a href="{prod}" rel="nofollow noopener">Ir para o site oficial</a>
  </div>
"""

ROBOTS_TXT = """\
# AMBIENTE DE HOMOLOGAÇÃO — não é o site oficial (https://tabelaraoni.com.br/).
# Toda página traz <meta name="robots" content="noindex, nofollow">.
# O rastreio NÃO é bloqueado de propósito: com "Disallow: /" o Google não leria o
# noindex e poderia indexar a URL sem conteúdo.
User-agent: *
Allow: /
"""


class BuildError(Exception):
    pass


def git(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True, text=True).stdout


def expect(pattern: re.Pattern[str], text: str, n: int, what: str, page: str) -> None:
    found = len(pattern.findall(text))
    if found != n:
        raise BuildError(
            f"{page}: esperado {n}x {what}, encontrado {found}x "
            "(corrija a página ou atualize scripts/build_hmg.py)"
        )


def transform_html(page: str, text: str, banner: str) -> str:
    expect(RE_HEAD_END, text, 1, "</head>", page)
    expect(RE_BODY_END, text, 1, "</body>", page)
    expect(RE_ADS_META, text, 1, '<meta name="google-adsense-account">', page)
    expect(RE_ADS_JS, text, 1, "<script src=…adsbygoogle.js>", page)
    expect(RE_CANONICAL, text, 1, '<link rel="canonical">', page)

    for pattern in (RE_ADS_META, RE_ADS_JS, RE_CANONICAL, RE_ROBOTS):
        text = pattern.sub("", text)
    text = RE_HEAD_END.sub(lambda m: HEAD_INJECT + m.group(0), text, count=1)
    text = RE_BODY_END.sub(lambda m: banner + m.group(0), text, count=1)

    for token in FORBIDDEN:
        if token in text:
            raise BuildError(f"{page}: '{token}' ainda presente após a transformação")
    if text.count('name="robots"') != 1 or 'content="noindex, nofollow"' not in text:
        raise BuildError(f'{page}: <meta name="robots"> noindex ausente ou duplicado')
    if "tr-hmg-banner" not in text or 'name="tr-ads-policy" content="disabled"' not in text:
        raise BuildError(f"{page}: injeção HMG incompleta")
    return text


def build_metadata(root: Path) -> dict[str, str]:
    sha = os.environ.get("GITHUB_SHA") or git(root, "rev-parse", "HEAD").strip()
    ref = os.environ.get("GITHUB_REF_NAME") or git(root, "branch", "--show-current").strip() or "local"
    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return {"sha": sha[:7], "sha_full": sha, "ref": ref, "when": when}


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera a versão HMG do site em um diretório de saída.")
    parser.add_argument("--out", default="dist", help="diretório de saída (apagado e recriado); padrão: dist")
    parser.add_argument("--cname", default="", help="domínio custom do HMG (vazio = sem CNAME)")
    args = parser.parse_args()

    root = Path.cwd().resolve()
    if not (root / "index.html").is_file() or not (root / "assets" / "consent.js").is_file():
        raise BuildError("execute a partir da raiz do repositório (index.html / assets/consent.js não encontrados)")

    cname = args.cname.strip().lower()
    if cname:
        if cname in PROD_HOSTS:
            raise BuildError(f"--cname {cname} é o domínio de PRODUÇÃO; recusado")
        if not re.fullmatch(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+", cname):
            raise BuildError(f"--cname inválido: {cname}")

    out = (root / args.out).resolve()
    if out == root or out in root.parents:
        raise BuildError(f"--out inseguro: {out}")
    if out.exists():
        if any(out.iterdir()) and not (out / ".nojekyll").exists():
            raise BuildError(f"{out} existe e não parece ser um build anterior; remova manualmente")
        shutil.rmtree(out)
    out.mkdir(parents=True)
    # Marcador gravado antes de tudo: um build que falhe no meio continua reconhecível como build.
    # Também desliga o Jekyll no repositório HMG.
    (out / ".nojekyll").write_text("", encoding="utf-8")

    meta = build_metadata(root)
    banner = BANNER.format(
        sha=html.escape(meta["sha"]),
        ref=html.escape(meta["ref"]),
        when=html.escape(meta["when"]),
        prod=PROD_URL,
    )

    pages: list[str] = []
    copied: list[str] = []
    dropped: set[str] = set()
    for rel in (Path(p) for p in git(root, "ls-files", "-z").split("\0") if p):
        posix = rel.as_posix()
        if rel.parts[0] in EXCLUDE_TOP:
            dropped.add(rel.parts[0] + ("/" if len(rel.parts) > 1 else ""))
            continue
        if posix in PROD_ONLY:
            dropped.add(posix)
            continue
        src, dst = root / rel, out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if rel.suffix.lower() == ".html":
            dst.write_text(transform_html(posix, src.read_text(encoding="utf-8"), banner), encoding="utf-8")
            pages.append(posix)
        else:
            shutil.copy2(src, dst)
            copied.append(posix)
    if not pages:
        raise BuildError("nenhuma página HTML versionada pelo git foi encontrada")

    (out / "robots.txt").write_text(ROBOTS_TXT, encoding="utf-8")
    (out / "hmg-version.txt").write_text(f"{meta['sha_full']} {meta['ref']} {meta['when']}\n", encoding="utf-8")
    (out / "README.md").write_text(
        "# Tabela Raoni — HOMOLOGAÇÃO (gerado automaticamente)\n\n"
        f"Build de homologação gerado pela action `Deploy HMG` de {SOURCE_REPO} "
        f"(branch `{meta['ref']}`, commit `{meta['sha_full']}`, {meta['when']}).\n\n"
        "**Não edite este repositório**: cada deploy substitui todo o conteúdo.\n",
        encoding="utf-8",
    )
    if cname:
        (out / "CNAME").write_text(cname + "\n", encoding="utf-8")

    for name in ("ads.txt", "sitemap.xml"):
        if (out / name).exists():
            raise BuildError(f"{name} não pode existir no HMG")
    if (out / "CNAME").exists() != bool(cname):
        raise BuildError("estado inesperado do CNAME na saída")

    print(f"OK: HMG gerado em {out}")
    print(
        f"  páginas transformadas: {len(pages)} | arquivos copiados: {len(copied)} | "
        f"não levados: {', '.join(sorted(dropped))}"
    )
    print(f"  build {meta['sha']} ({meta['ref']}) {meta['when']} | CNAME: {cname or '(nenhum)'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BuildError as err:
        print(f"ERRO: {err}", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as err:
        print(f"ERRO: git falhou: {(err.stderr or '').strip() or err}", file=sys.stderr)
        sys.exit(1)
