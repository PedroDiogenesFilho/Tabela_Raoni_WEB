/* Tabela Raoni: modelo de projeção de posição em concursos a partir de um ranking extraoficial.
   Sem DOM: usado pelo script da página inicial e testado por scripts/test_calculadora.mjs.
   Fórmulas e justificativas: sobre.html ("Fórmula completa da projeção") e README.md. */
(function (root) {
  "use strict";

  // Faixas da Tabela Raoni: [início, fim) da posição percentual no ranking (0–100) e constante k.
  // Lida nessa escala, a tabela descreve um ranking que cobre cerca de 20% dos presentes: no topo
  // quase ninguém de fora está à frente do candidato (k → 1); na base o ranking se comporta como
  // amostra representativa (k → presentes/ranking ≈ 4,7).
  const TABELA = [
    [0, 3, 1.0], [3, 5, 1.125], [5, 10, 1.177], [10, 15, 1.202], [15, 20, 1.367], [20, 25, 1.456],
    [25, 30, 1.5642], [30, 35, 1.786], [35, 40, 1.924], [40, 45, 2.2121], [45, 50, 2.352], [50, 55, 2.564],
    [55, 60, 2.876], [60, 65, 3.08765], [65, 70, 3.222], [70, 75, 3.421], [75, 80, 3.656], [80, 85, 3.945],
    [85, 90, 4.331], [90, 95, 4.567], [95, 100, 4.7125]
  ];
  const PONTOS = TABELA.map(([ini, fim, k]) => ({ x: (ini + fim) / 2, k }));
  const K_MAX = TABELA[TABELA.length - 1][2]; // 4,7125: normaliza a tabela (última faixa = amostra representativa)

  const MARGEM_CONSERVADORA = 0.15; // cenário conservador: proporcional + 15% (autodeclaração otimista, ranking desatualizado)
  const DELTA_FALTOSOS = 10;        // sensibilidade: faltosos ± 10 pontos percentuais
  const Z = 1.96;                   // margem de amostragem com 95% de confiança
  const FALTOSOS_MAX = 60;
  const COBERTURA_BAIXA = 0.10;     // limites de confiança (mesmos da página Sobre)
  const COBERTURA_ALTA = 0.25;
  const RANKING_PEQUENO = 300;
  const RANKING_GRANDE = 1000;

  const fmt = new Intl.NumberFormat("pt-BR");
  const fmt1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const pct = (fracao) => `${fmt.format(Math.round(fracao * 100))}%`;
  const arredondar = (v) => Math.ceil(v - 1e-9);
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  const erro = (mensagem, campo) => Object.assign(new Error(mensagem), { field: campo });

  // k(x): interpolação linear entre os pontos médios das faixas; constante antes de 1,5 e depois de 97,5.
  function constante(x) {
    const v = Number(x);
    if (!Number.isFinite(v) || v <= PONTOS[0].x) return PONTOS[0].k;
    for (let i = 0; i < PONTOS.length - 1; i += 1) {
      const a = PONTOS[i];
      const b = PONTOS[i + 1];
      if (v <= b.x) return a.k + ((b.k - a.k) * (v - a.x)) / (b.x - a.x);
    }
    return K_MAX;
  }

  function presentesPara(inscritos, faltosos) {
    return Math.round(inscritos * (1 - faltosos / 100));
  }

  // Projeção proporcional: o ranking tratado como amostra representativa dos presentes.
  function proporcional(pos, ranking, presentes) {
    return limitar(arredondar((pos * presentes) / ranking), pos, pos + presentes - ranking);
  }

  function projetar(entrada) {
    const inscritos = Number(entrada.inscritos);
    const ranking = Number(entrada.ranking);
    const pos = Number(entrada.posicao);
    const faltosos = Number(entrada.faltosos);
    const oficial = Boolean(entrada.oficial);

    if (!(inscritos > 0)) throw erro("Inscritos no concurso: informe um número maior que zero.", "inscritosTotal");
    if (!(ranking > 0)) throw erro("Candidatos no ranking: informe um número maior que zero.", "inscritosRanking");
    if (ranking > inscritos) throw erro("Candidatos no ranking não pode ser maior que inscritos no concurso. Confira os dois números.", "inscritosRanking");
    if (!(pos > 0)) throw erro("Sua posição: informe um número maior que zero.", "suaPosicao");
    if (pos > ranking) throw erro("Sua posição não pode ser maior que o número de candidatos no ranking. Confira os dois números.", "suaPosicao");
    if (!(faltosos >= 0 && faltosos <= FALTOSOS_MAX)) throw erro(`Faltosos: informe um percentual entre 0 e ${FALTOSOS_MAX}.`, "faltososPct");

    const presentes = presentesPara(inscritos, faltosos);
    if (ranking > presentes) {
      throw erro(
        `Com ${fmt1.format(faltosos)}% de faltosos sobram ${fmt.format(presentes)} presentes, menos que os ${fmt.format(ranking)} candidatos do ranking. Reduza o percentual de faltosos ou confira o tamanho do ranking.`,
        "faltososPct"
      );
    }

    const fora = presentes - ranking;           // presentes que não estão no ranking
    const q = pos / ranking;                    // posição percentual no ranking
    const k = constante(q * 100);
    const min = pos;                            // ninguém de fora à sua frente
    const max = pos + fora;                     // todos de fora à sua frente

    // Três cenários para a fração dos presentes de fora do ranking que estão à sua frente:
    // central = q (amostra representativa); otimista = Tabela Raoni, q × (k − 1)/(k̄ − 1);
    // conservador = central com a margem de 15%.
    const central = proporcional(pos, ranking, presentes);
    const otimista = limitar(arredondar(pos + ((q * (k - 1)) / (K_MAX - 1)) * fora), min, central);
    const conservador = limitar(arredondar(central * (1 + MARGEM_CONSERVADORA)), central, max);

    // Margem de amostragem da posição percentual: erro-padrão binomial com correção de população finita,
    // em fração de q e limitada a 100% (no topo do ranking a aproximação normal perde sentido).
    const fpc = presentes > 1 ? (presentes - ranking) / (presentes - 1) : 0;
    const erroPadrao = Math.sqrt((q * (1 - q)) / ranking) * Math.sqrt(fpc);
    const margemAmostral = q > 0 ? Math.min(1, (Z * erroPadrao) / q) : 0;

    // Sensibilidade a faltosos (só quando a presença é estimada): cenário central com ±10 p.p.
    let sensibilidadeFaltosos = null;
    if (!oficial) {
      const cenario = (f) => {
        const n = presentesPara(inscritos, f);
        return { faltosos: f, presentes: n, central: proporcional(pos, ranking, n) };
      };
      const menos = Math.max(0, faltosos - DELTA_FALTOSOS);
      let mais = Math.min(FALTOSOS_MAX, faltosos + DELTA_FALTOSOS);
      while (mais > faltosos && presentesPara(inscritos, mais) < ranking) mais -= 1;
      sensibilidadeFaltosos = {
        menos: menos < faltosos ? cenario(menos) : null,
        mais: mais > faltosos ? cenario(mais) : null
      };
    }

    return {
      presentes,
      cobertura: ranking / presentes,
      posicaoPercentual: q,
      constante: k,
      central,
      otimista,
      conservador,
      margemAmostral,
      sensibilidadeFaltosos,
      limites: { min, max },
      oficial,
      entrada: { inscritos, ranking, posicao: pos, faltosos }
    };
  }

  // Confiança conforme a cobertura do ranking, o tamanho da amostra e a origem do dado de presença.
  function confianca(r) {
    const cobertura = r.cobertura;
    const ranking = r.entrada.ranking;
    const base = `O ranking cobre ${pct(cobertura)} dos ${fmt.format(r.presentes)} presentes estimados, com ${fmt.format(ranking)} candidatos`;
    const motivos = [];

    if (cobertura < COBERTURA_BAIXA || ranking < RANKING_PEQUENO) {
      if (cobertura < COBERTURA_BAIXA) motivos.push(`cobertura abaixo de ${pct(COBERTURA_BAIXA)}`);
      if (ranking < RANKING_PEQUENO) motivos.push(`menos de ${fmt.format(RANKING_PEQUENO)} participantes`);
      return {
        nivel: "Baixa",
        classe: "conf-low",
        desc: `${base}: ${motivos.join(" e ")}. Trate a faixa como hipótese e compare cenários de faltosos.`
      };
    }

    if (cobertura < COBERTURA_ALTA || ranking < RANKING_GRANDE || !r.oficial) {
      if (cobertura < COBERTURA_ALTA) motivos.push(`cobertura entre ${pct(COBERTURA_BAIXA)} e ${pct(COBERTURA_ALTA)}`);
      if (ranking < RANKING_GRANDE) motivos.push(`menos de ${fmt.format(RANKING_GRANDE)} participantes`);
      if (!r.oficial) motivos.push("presença apenas estimada");
      const dica = r.oficial
        ? "Acompanhe as atualizações do ranking e recalcule a cada lista nova."
        : "Marque a presença oficial quando a banca divulgar o número de presentes.";
      return { nivel: "Média", classe: "conf-med", desc: `${base}: ${motivos.join(", ")}. ${dica}` };
    }

    return {
      nivel: "Alta",
      classe: "conf-high",
      desc: `${base} e presença oficial informada. Cenário mais estável; recursos e retificações ainda podem mover a faixa.`
    };
  }

  root.TabelaRaoni = Object.freeze({
    TABELA,
    K_MAX,
    MARGEM_CONSERVADORA,
    DELTA_FALTOSOS,
    Z,
    FALTOSOS_MAX,
    constante,
    presentesPara,
    projetar,
    confianca
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
