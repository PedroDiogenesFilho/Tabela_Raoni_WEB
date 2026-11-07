# Tabela_Raoni_WEB

## Como usar

1. Preencha:
   - **Inscritos no concurso**
   - **Inscritos no ranking**
   - **Sua posição**

2. Ajuste o **Percentual de faltosos (%)**.

3. Clique em **CALCULAR PROJEÇÃO** para ver a classificação projetada e a margem estimada.

## Como funciona o cálculo

O modelo fica em `assets/modelo.js` (sem DOM) e é testado por `node scripts/test_calculadora.mjs`, que roda no CI.
Com `Iof` inscritos, `n` candidatos no ranking, posição `p` e `f`% de faltosos:

- presentes estimados `N = Iof × (1 − f/100)`; cobertura do ranking `c = n / N`; posição percentual `q = p / n`;
- os três cenários projetam quantos dos `N − n` presentes de fora do ranking estão à frente do candidato:
  **central** (proporcional) usa a fração `q`, ou seja `P = p × N / n`; **otimista** usa a Tabela Raoni,
  `q × (k(q) − 1) / (k̄ − 1)`, em que `k(q)` é a constante interpolada da tabela pela posição percentual e
  `k̄ = 4,7125` a da última faixa; **conservador** é o central com margem de 15%;
- todo cenário fica entre `p` e `p + (N − n)`; a faixa exibida vai do otimista ao conservador;
- a margem de amostragem é `1,96 × ep / q`, com `ep = sqrt(q(1−q)/n) × sqrt((N−n)/(N−1))`, limitada a 100%;

## Observações

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
injeta a faixa "AMBIENTE DE HOMOLOGAÇÃO" e acrescenta `?v=<sha>` aos CSS e JS locais (o CDN do Pages guarda
os arquivos por 10 minutos). `assets/consent.js` só carrega GA/AdSense nos hosts de
produção. Validar localmente antes de abrir PR:

```bash
python3 scripts/check_header_nav.py && python3 scripts/check_links.py && python3 scripts/build_hmg.py
wc -c assets/styles.css               # folha única; manter ≤ 30720 bytes
python3 scripts/check_contrast.py     # contraste WCAG dos tokens nos temas claro e escuro
node scripts/test_calculadora.mjs     # modelo da calculadora e exemplos da home
python3 -m http.server -d dist 8080   # abrir http://localhost:8080/
```

Regras: depois de cada release, `git checkout hmg && git pull && git merge --ff-only origin/main && git push`;
hotfix feito direto em `main` deve ser mesclado em `hmg` em seguida; para tirar um experimento do HMG,
`git revert -m 1 <sha-do-merge>` em `hmg` (ou, para zerar, `git reset --hard origin/main` +
`git push --force-with-lease origin hmg`). Se `scripts/build_hmg.py` falhar com "esperado 1x …", uma
página nova/alterada fugiu do padrão do `<head>`: corrija a página ou atualize o script.

### Ligar e desligar o HMG

O HMG é público (GitHub Pages não tem senha), mas fica fora do domínio da marca, com `noindex`, `robots.txt`
bloqueando buscadores, sem anúncios nem Analytics e com a faixa de homologação. Para desligá-lo fora dos
períodos de teste, rode a action **Desligar HMG** (Actions → Desligar HMG → Run workflow): ela publica uma
página "homologação desligada" no repositório HMG. Qualquer push em `hmg` ou a action **Deploy HMG** religa.
Para voltar a usar um domínio próprio, crie a variável de repositório `HMG_CNAME` e o CNAME no DNS; o build
grava o arquivo `CNAME` e o Pages assume o domínio.

## Tema claro, escuro e sistema

O tema claro é o padrão. O seletor no rodapé (Claro / Escuro / Sistema) grava a escolha em `localStorage` na chave `trTema`; um script inline no `<head>` de cada página aplica `html[data-theme]` antes da folha de estilo (sem flash) e `assets/tema.js` cuida do seletor, da sincronização entre abas e da preferência do sistema. Os tokens do tema escuro ficam num único bloco `@media screen { :root[data-theme="dark"] {…} }` em `assets/styles.css`; a impressão é sempre clara.
