#!/usr/bin/env node
// Testa o modelo da calculadora (assets/modelo.js) e as funções de entrada/saída do script da home.
// Uso: node scripts/test_calculadora.mjs  (sai com código 1 se alguma verificação falhar)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(raiz, "assets/modelo.js"), "utf8"), sandbox);
const M = sandbox.TabelaRaoni;
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const fmt = (n) => n.toLocaleString("pt-BR");

let falhas = 0;
let total = 0;
const ok = (cond, msg) => {
  total += 1;
  if (!cond) {
    falhas += 1;
    console.log("ERRO", msg);
  }
};

// 1. Exemplos da home: valores publicados na tabela "Exemplos com dados fictícios" e links de cálculo.
const exemplos = [
  [18500, 2900, 240, 42, { otimista: 272, central: 888, conservador: 1022, presentes: 10730, nivel: "Média" }],
  [9200, 3400, 125, 28, { otimista: 129, central: 244, conservador: 281, presentes: 6624, nivel: "Média" }],
  [32000, 4100, 560, 51, { otimista: 663, central: 2142, conservador: 2464, presentes: 15680, nivel: "Média" }]
];
for (const [it, ir, p, f, e] of exemplos) {
  const r = M.projetar({ inscritos: it, ranking: ir, posicao: p, faltosos: f });
  const c = M.confianca(r);
  ok(
    r.otimista === e.otimista && r.central === e.central && r.conservador === e.conservador && r.presentes === e.presentes && c.nivel === e.nivel,
    `exemplo ${it}/${ir}/${p}/${f}: ${r.otimista}/${r.central}/${r.conservador}/${r.presentes}/${c.nivel}`
  );
  const trecho = `<strong>${fmt(e.central)}</strong> (de ${fmt(e.otimista)} a ${fmt(e.conservador)}, confiança ${e.nivel.toLowerCase()})`;
  ok(html.includes(trecho), `index.html não contém "${trecho}"`);
  ok(html.includes(`?it=${it}&amp;ir=${ir}&amp;p=${p}&amp;f=${f}`), `link do exemplo ${it} ausente na home`);
}
ok(html.includes(`conservador (+${Math.round(M.MARGEM_CONSERVADORA * 100)}%)`), "rótulo do cenário conservador na home diverge de MARGEM_CONSERVADORA");
ok(html.indexOf('src="assets/modelo.js"') > 0 && html.indexOf('src="assets/modelo.js"') < html.indexOf("window.TabelaRaoni"), "modelo.js deve ser carregado antes do script da home");

// 2. Centro = proporcional; ordem dos cenários e limites lógicos numa grade de entradas.
for (const it of [500, 2000, 12000, 80000]) {
  for (const f of [0, 20, 42.5, 60]) {
    const N = M.presentesPara(it, f);
    for (const frac of [0.02, 0.1, 0.3, 0.6, 1]) {
      const ir = Math.max(1, Math.floor(N * frac));
      for (const qf of [0.001, 0.1, 0.5, 0.9, 1]) {
        const p = Math.max(1, Math.round(ir * qf));
        const r = M.projetar({ inscritos: it, ranking: ir, posicao: p, faltosos: f });
        const prop = Math.min(Math.max(Math.ceil((p * N) / ir - 1e-9), p), p + N - ir);
        const rot = `${it}/${ir}/${p}/${f}`;
        ok(r.central === prop, `central ≠ proporcional em ${rot}: ${r.central} vs ${prop}`);
        ok(r.otimista <= r.central && r.central <= r.conservador, `ordem dos cenários em ${rot}`);
        ok(r.otimista >= p && r.conservador <= p + N - ir && r.conservador <= N, `limites lógicos em ${rot}: ${r.otimista}-${r.conservador}`);
        ok(r.margemAmostral >= 0 && r.margemAmostral <= 1, `margem amostral fora de [0, 1] em ${rot}`);
      }
    }
  }
}

// 3. O cenário otimista reproduz a Tabela Raoni original (P = p × k) quando a cobertura é 1/k̄ (≈ 21%).
{
  const n = 1000;
  const N = Math.round(n * M.K_MAX);
  let maxDif = 0;
  for (let p = 1; p <= n; p += 7) {
    const r = M.projetar({ inscritos: N, ranking: n, posicao: p, faltosos: 0 });
    maxDif = Math.max(maxDif, Math.abs(r.otimista - p * M.constante((p / n) * 100)));
  }
  ok(maxDif <= 1.5, `otimista se afasta ${maxDif.toFixed(2)} de p×k com cobertura 1/k̄`);
}

// 4. Monotonia em p; mais faltosos reduz os cenários; o tamanho do ranking altera o resultado.
{
  let prev = null;
  for (let p = 1; p <= 2900; p += 29) {
    const r = M.projetar({ inscritos: 18500, ranking: 2900, posicao: p, faltosos: 42 });
    if (prev) ok(r.otimista >= prev.otimista && r.central >= prev.central && r.conservador >= prev.conservador, `não monótono em p=${p}`);
    prev = r;
  }
  const a = M.projetar({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 30 });
  const b = M.projetar({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 50 });
  ok(b.otimista <= a.otimista && b.central < a.central && b.conservador < a.conservador, "mais faltosos não reduziu os cenários");
  const c = M.projetar({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 42 });
  const d = M.projetar({ inscritos: 18500, ranking: 1450, posicao: 240, faltosos: 42 });
  ok(d.central > c.central && d.otimista > c.otimista, "ranking menor deveria piorar a projeção");
}

// 5. Constante k(x): monótona em 0–100, com os extremos da tabela.
{
  let prev = M.constante(0);
  let mono = true;
  for (let x = 0; x <= 100; x += 0.5) {
    const k = M.constante(x);
    if (k < prev) mono = false;
    prev = k;
  }
  ok(mono && M.constante(0) === 1 && M.constante(100) === M.K_MAX && M.constante(150) === M.K_MAX, "constante k(x) fora do esperado");
  ok(Math.abs(M.constante(17.5) - 1.367) < 1e-9 && Math.abs(M.constante(15) - (1.202 + 1.367) / 2) < 1e-9, "interpolação da tabela");
}

// 6. Erros de validação apontam o campo certo.
const erroDe = (entrada) => {
  try {
    M.projetar(entrada);
    return null;
  } catch (e) {
    return e.field;
  }
};
ok(erroDe({ inscritos: 12000, ranking: 10000, posicao: 100, faltosos: 40 }) === "faltososPct", "ranking > presentes deveria apontar faltosos");
ok(erroDe({ inscritos: 0, ranking: 1, posicao: 1, faltosos: 40 }) === "inscritosTotal", "inscritos 0");
ok(erroDe({ inscritos: 100, ranking: 200, posicao: 1, faltosos: 0 }) === "inscritosRanking", "ranking > inscritos");
ok(erroDe({ inscritos: 100, ranking: 50, posicao: 60, faltosos: 0 }) === "suaPosicao", "posição > ranking");
ok(erroDe({ inscritos: 100, ranking: 50, posicao: 10, faltosos: 61 }) === "faltososPct", "faltosos > 60");
ok(erroDe({ inscritos: 100, ranking: 50, posicao: 10, faltosos: -1 }) === "faltososPct", "faltosos < 0");
ok(erroDe({ inscritos: 100, ranking: 50, posicao: 10, faltosos: 50 }) === null, "ranking = presentes deveria passar");

// 7. Sensibilidade a faltosos e presença oficial.
{
  const r = M.projetar({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 42 });
  const s = r.sensibilidadeFaltosos;
  ok(s && s.menos.faltosos === 32 && s.menos.central === 1042 && s.mais.faltosos === 52 && s.mais.central === 735, "sensibilidade a faltosos do exemplo 1");
  const o = M.projetar({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 42, oficial: true });
  ok(o.sensibilidadeFaltosos === null && o.central === r.central && o.otimista === r.otimista, "presença oficial não deveria mudar os cenários nem ter sensibilidade");
  const limite = M.projetar({ inscritos: 1000, ranking: 500, posicao: 100, faltosos: 45 });
  ok(limite.sensibilidadeFaltosos.mais === null || limite.sensibilidadeFaltosos.mais.presentes >= 500, "cenário de mais faltosos não pode deixar o ranking maior que os presentes");
  const zero = M.projetar({ inscritos: 1000, ranking: 100, posicao: 10, faltosos: 0 });
  ok(zero.sensibilidadeFaltosos.menos === null && zero.sensibilidadeFaltosos.mais.faltosos === 10, "sensibilidade com faltosos 0");
}

// 8. Confiança por cobertura, tamanho do ranking e presença oficial.
const nivel = (e) => M.confianca(M.projetar(e)).nivel;
ok(nivel({ inscritos: 25000, ranking: 900, posicao: 120, faltosos: 40 }) === "Baixa", "cobertura 6% deveria ser Baixa");
ok(nivel({ inscritos: 1000, ranking: 200, posicao: 10, faltosos: 0 }) === "Baixa", "ranking com 200 deveria ser Baixa");
ok(nivel({ inscritos: 20000, ranking: 2400, posicao: 420, faltosos: 40, oficial: true }) === "Média", "cobertura 20% deveria ser Média");
ok(nivel({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 42 }) === "Média", "presença estimada deveria ser Média");
ok(nivel({ inscritos: 18500, ranking: 2900, posicao: 240, faltosos: 42, oficial: true }) === "Alta", "cobertura 27% com 2.900 e presença oficial deveria ser Alta");
ok(nivel({ inscritos: 3000, ranking: 900, posicao: 240, faltosos: 0, oficial: true }) === "Média", "ranking com 900 deveria ser Média mesmo com presença oficial");

// 9. Funções do script da home: parseNumber e buildShareUrl.
{
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((b) => b.includes("window.TabelaRaoni"));
  ok(Boolean(script), "script da home com o modelo não encontrado");
  const head = script.slice(0, script.indexOf("(function init()"));
  const ctx = vm.createContext({
    window: { TabelaRaoni: M },
    document: { getElementById: () => null },
    location: { search: "", href: "https://tabelaraoni.com.br/#faq" },
    URL,
    URLSearchParams,
    console
  });
  const api = vm.runInContext(`${head}\n({ parseNumber, buildShareUrl });`, ctx);
  const casos = { "12.000": 12000, "12000": 12000, "40,5": 40.5, "40.5": 40.5, "40,5 %": 40.5, "1.234,5": 1234.5, "3.400": 3400, abc: NaN, "": NaN, "42%": 42 };
  for (const [entrada, valor] of Object.entries(casos)) {
    const got = api.parseNumber(entrada);
    ok(Number.isNaN(valor) ? Number.isNaN(got) : got === valor, `parseNumber(${JSON.stringify(entrada)}) = ${got}`);
  }
  ok(
    api.buildShareUrl({ inscritosTotal: 12000, inscritosRanking: 10000, suaPosicao: 100, faltososPct: 40.5 }) === "https://tabelaraoni.com.br/?it=12000&ir=10000&p=100&f=40.5",
    "buildShareUrl sem presença oficial"
  );
  ok(
    api.buildShareUrl({ inscritosTotal: 12000, inscritosRanking: 10000, suaPosicao: 100, faltososPct: 40.5, presencaOficial: true }) === "https://tabelaraoni.com.br/?it=12000&ir=10000&p=100&f=40.5&o=1",
    "buildShareUrl com presença oficial (o=1)"
  );
}

console.log(falhas ? `FALHAS: ${falhas} de ${total} verificações` : `OK: ${total} verificações do modelo da calculadora`);
process.exit(falhas ? 1 : 0);
