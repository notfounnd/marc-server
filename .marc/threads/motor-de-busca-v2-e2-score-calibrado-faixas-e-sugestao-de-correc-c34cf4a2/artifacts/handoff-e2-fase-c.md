# Handoff da Fase C da E2

## Resumo

Escopo da Fase C depois da decisão coaprovada (decisao-e2.md) e da aprovação da consulta D10 pelo humano. A busca mantém a ordem e a admissão do M0 (recuo de H1). A E2 entrega o contrato único de faixas heurísticas de confiança e o campo `abstained`, iguais no core, no MCP, no HTTP, na CLI e na UI. Sem juiz, sem calibração por projeto e sem troca do interpretador.

- **Desenvolvedor:** claude-dev, com Haiku 5.5 em xhigh, em modo sequencial com um desenvolvedor.
- **Ordem:** T2, medição, T5, T6. A entrega 2 vem depois da T6, com mensagem própria do desenvolvedor na thread.
- **Fora do escopo:** T2b, T3 e T4.

## Decisões que orientam a implementação

- **Faixa heurística, não probabilidade.** Nenhum texto de UI, MCP, CLI ou docs promete precisão ou porcentagem. A faixa é confiança relativa: alta, média e baixa.
- **Score inalterado.** O `score` continua sendo a eligibility do M0 (semantic-ranking.ts:97). Não existe `p` calibrado.
- **Módulos antigos permanecem.** `semantic-eligibility.ts`, `semantic-ranking.ts` e `hybrid-ranking.ts` ficam, porque o H1 não foi aceito. A lista de remoção da correção 16 não se aplica.
- **Cortes:** são os de produção do recuo, emitidos pelo `fit` da captura 1b68a7e3f4e6 em fit.json, campo `production.fallbackCuts`, e copiados com Edit:

| Corte | Valor |
| --- | --- |
| alta | 0.9998832326558279 |
| média | 0.8958386806238463 |
| baixa | 0.029530510370742287 |

O corte baixo fica abaixo do limiar de admissão do M0 (0,5). Na captura, a menor eligibility admitida é 0,5019. Por isso, toda thread admitida abaixo do corte médio fica na faixa baixa, e quem limita a faixa baixa é a admissão. O ADR registra isso.

## T2: contrato de faixas no core e nos transportes

**Arquivos autorizados:**

- `src/core/memory/scoring/bands.ts` (novo);
- `src/core/memory/semantic-ranking.ts`, só em `semanticRecallHits`;
- `src/core/memory/types.ts`;
- `src/core/memory/operations.ts`;
- `src/core/memory/recall-support.ts`, se o resultado vazio for montado ali;
- `src/mcp/memory-tools.ts`, só a descrição da ferramenta;
- `src/cli.ts`, só a saída do recall;
- os testes correspondentes.

**Entregas:**

1. `scoring/bands.ts` exporta `MEMORY_BAND_CUTS`, com os três valores da tabela, e uma função pura que devolve a faixa de uma eligibility. A função usa uma tabela de cortes em ordem decrescente e o primeiro corte atingido, sem `else` e sem `if` aninhado. Abaixo do corte médio, a faixa é baixa.
2. `MemoryRecallHit` ganha `band: "high" | "medium" | "low"`, atribuída em `semanticRecallHits` a partir de `hit.eligibility`.
3. `MemoryRecallResult` ganha `abstained: boolean`:
   - é verdadeiro somente quando a busca rodou (`runReadyMemoryRecall` chegou ao ranking) e nenhuma thread foi admitida;
   - é falso nos resultados vazios de índice indisponível, operação concorrente e manifest sem registros, porque nesses casos não houve busca.
4. `dedupeMemoryRecallHits` e `.slice(0, limit)` preservam `band`. O MCP continua com `limit` padrão 5, devolvendo os 5 primeiros admitidos de qualquer faixa.
5. A descrição da `memory_recall` explica as faixas como confiança relativa, sem probabilidade.
6. A CLI mostra a faixa de cada resultado e indica a abstenção.
7. O HTTP (`memory-routes.ts`) devolve o resultado do core sem mudança de código. Confirme no teste de rota que `band` e `abstained` chegam.

**Testes**, declarativos e sem ramificação:

- função de faixa exatamente em cada corte, imediatamente abaixo de cada corte, e em 0,5;
- todo hit tem `band`;
- `abstained` verdadeiro quando a busca roda sem admitidos e falso nos três caminhos sem busca;
- MCP com no máximo 5 resultados;
- os testes existentes de admissão (D6, literal sozinho não admite) continuam passando sem alteração.

## Medição de ponta a ponta

Depois da T2, meça a latência da cadeia de produção na captura do marc, com carga típica de desktop.

- **Preservar a base:** antes de medir, copie `.marc/cache/memory-eval/marc/1b68a7e3f4e6/latency.json` para `latency-m0-fase-b.json`. A medição nova não pode apagar a base do M0.
- **Comparação:** a mediana medida contra a do M0, 18.167,3 ms. O critério do plano é ficar em no máximo 1,2 vez a mediana do M0.
- **Rótulo:** o resultado é registrado como "medido".
- **Bloqueio:** se o comando atual não passar pelo caminho de produção (`recallMemory`), reporte isso como bloqueio, em vez de adaptar o harness sem autorização.

## T5: faixas na UI

**Arquivos autorizados:**

- `src/ui/types.ts`, onde os tipos duplicados ganham `band` e `abstained`;
- `src/ui/memory-search.ts`, onde `MEMORY_SEARCH_SCHEMA_VERSION` sobe de 5 para 6;
- `src/ui/memory-search-panel.tsx`;
- `src/ui/use-memory-search.ts`;
- `src/ui/memory-search-depth.ts`, só se necessário;
- `public/locales/en_US/translation.json`;
- os testes de UI correspondentes.

**Entregas:**

- Alta e média aparecem na lista principal, com a indicação da faixa.
- A baixa fica num bloco recolhido com o rótulo `Show less likely results`.
- O painel não mostra o score.
- Os textos ficam em en-US e não prometem porcentagem.
- Com `abstained`, a sequência de profundidades continua para a próxima, como hoje (correção 17), com teste.

**Validação:** Playwright CLI, não MCP. Faça uma busca com resultados nas três faixas e outra com o bloco recolhido, aberto e fechado.

## T6: limpeza, ADR e docs

**Remoções:**

- `scripts/memory-quality-v4.ts`, `scripts/memory-quality-selection.ts` e `scripts/memory-model-benchmark*.ts`;
- `test/memory-quality-v4-selection.test.ts` e `test/memory-model-benchmark-runner.test.ts`;
- os scripts `memory:quality` e `memory:benchmark` do `package.json`.

O `test:benchmark` fica: é o executor genérico de `performance/thread-index.benchmark.mjs` (docs/development.md).

**Antes de remover:** `scripts/memory-eval/dataset.ts`, `memory-sampling.ts` e `recording-providers.ts` citam esses scripts. Confirme se são só comentários. Se houver import, reporte antes de remover.

**ADR 0011:** `docs/adrs/0011-memory-confidence-bands.md`, com link em `docs/adrs/README.md`. O nome do plano era `0011-calibrated-memory-score.md`. Ele mudou porque o score calibrado foi reprovado. O ADR registra:

- os vereditos da E2;
- o recuo de H1;
- os cortes de produção;
- as faixas como heurística;
- os limites medidos: no marc, por bloco exclusivo, 0,88, 0,41 e 0,20; no ledgerline-en, sem separação;
- a calibração como tema futuro.

**Docs:** `docs/memory.md` e `docs/mcp-tools.md` com `band` e `abstained`.

## Restrições

- Sem Git.
- Edições só com Edit/Write.
- Sem `else`, sem `if` aninhado, com retornos antecipados e tabelas de despacho.
- Testes sem `if`, `else`, `switch` ou ternário.
- Sem dependência nova; `pnpm-lock.yaml` intacto.
- `.marc/memory/**` intacto. O sha256 do manifest deve continuar `1540264d0d52643474c62104d58050de46324c92280adbe77214dd0724f2045d`.
- `src/core/memory/inference-*`, `model-config.ts`, `maintenance.ts`, `query-interpretation*` e `sources/**` ficam fora.

## Verificação e entrega

- **Por tarefa:** testes focados. Na entrega 2: `pnpm validate`, `pnpm build` e `pnpm test`.
- **Mensagem da entrega 2 na thread,** publicada pelo desenvolvedor com o perfil claude-dev. Ela traz as mudanças, os checks com resultados, a latência medida, a validação com Playwright CLI e os riscos.
- **Relatório interno ao principal,** com caminhos, referências de linha, checks e o messageId da entrega.
- **Depois da entrega:** revisão integrada do principal, coaprovação do Codex e aceitação do humano. O rebuild produtivo só acontece depois da aceitação, com autorização do humano.
