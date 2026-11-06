# Tabela_Raoni_WEB

## Como usar

1. Preencha:
   - **Inscritos no concurso**
   - **Inscritos no ranking**
   - **Sua posição**

2. Ajuste o **Percentual de faltosos (%)**.

3. Clique em **CALCULAR PROJEÇÃO** para ver a classificação projetada e a margem estimada.

## Observações

- O cálculo usa uma tabela de multiplicadores ("Tabela Raoni") para estimar a projeção.
- Se os campos estiverem vazios ou com valores inválidos, o aplicativo exibirá uma mensagem de erro.
- É necessário que o usuário esteja cadastrado em um ranking de concursos e utilize os dados desse ranking para calcular a possição projetada.
- Caso a banca do concurso não publique o percentual de faltosos a sugestão e manter em um valor padrão entre 35 a 40%

## Licença

Uso licenciado a Pedro Diogenes

## Ambientes e fluxo de publicação

| Ambiente | Branch | URL | Como publica |
|---|---|---|---|
| Produção | `main` | https://tabelaraoni.com.br | GitHub Pages deste repositório ("Deploy from a branch", `main`, raiz) |
| Homologação (HMG) | `hmg` (branch padrão) | https://pedrodiogenesfilho.github.io/Tabela_Raoni_HMG/ | Action `Deploy HMG` gera `dist/` com `scripts/build_hmg.py` e publica no repositório `Tabela_Raoni_HMG` |

Fluxo: branch de trabalho → PR para `hmg` → deploy automático no HMG → testar na URL de HMG →
PR `hmg` → `main` (**sempre "Create a merge commit"**, nunca squash) → produção.

O HMG é gerado **no momento do deploy**, sem nada de ambiente commitado: remove `CNAME`, `ads.txt`,
`sitemap.xml` e as tags do AdSense, troca o `robots` por `noindex, nofollow`, remove o `canonical` e
injeta a faixa "AMBIENTE DE HOMOLOGAÇÃO". `assets/consent.js` só carrega GA/AdSense nos hosts de
produção. Validar localmente antes de abrir PR:

```bash
python3 scripts/check_header_nav.py && python3 scripts/check_links.py && python3 scripts/build_hmg.py
python3 -m http.server -d dist 8080   # abrir http://localhost:8080/
```

Regras: depois de cada release, `git checkout hmg && git pull && git merge --ff-only origin/main && git push`;
hotfix feito direto em `main` deve ser mesclado em `hmg` em seguida; para tirar um experimento do HMG,
`git revert -m 1 <sha-do-merge>` em `hmg` (ou, para zerar, `git reset --hard origin/main` +
`git push --force-with-lease origin hmg`). Se `scripts/build_hmg.py` falhar com "esperado 1x …", uma
página nova/alterada fugiu do padrão do `<head>`: corrija a página ou atualize o script.
