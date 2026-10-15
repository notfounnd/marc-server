# Plano da E2: score calibrado, faixas e sugestão de correção

## Resumo

A E2 troca a elegibilidade relativa atual por um score absoluto e calibrado. Esse score vira o contrato único da UI e do MCP (D2). A etapa cobre:

- **H1:** score calibrado por regressão logística monotônica sobre features absolutas;
- **H2:** ajuste da escala por projeto no rebuild, com consultas sintéticas;
- **H6:** verificação das faixas no segundo corpus;
- **H3:** decisão da sugestão de correção, que pode retirar o LFM do pacote;
- **D2:** faixas alta, média e baixa, com abstenção, iguais na UI e no MCP;
- **D6:** o acerto literal nunca admite um resultado sozinho.

A etapa tem dois momentos:

1. O desenvolvedor implementa as variantes no harness da E0.
2. Os aprovadores aplicam os critérios abaixo, declarados antes da execução, e registram a decisão na thread. Só então o desenvolvedor implementa a alternativa escolhida em produção.

Nenhuma decisão de desenho fica com o desenvolvedor. Rota: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada

- E1 (marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3) aprovada tecnicamente.
- Captura da E1 disponível nos dois corpora, com julgamentos completos (CA4 da E0).
- Referências de linha conferidas pelos aprovadores no handoff.

## Fontes obrigatórias

- regras, registro da rota e relatórios da E0 e da E1;
- marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba (regra do acerto literal, D6);
- `docs/memory.md` (`Query interpretation`, `Recall flow`, `UI search`) e ADR `0008-ui-only-localization-boundary.md`;
- `src/core/memory/semantic-ranking.ts`, `semantic-eligibility.ts`, `hybrid-ranking.ts`, `operations.ts`, `query-interpretation.ts`, `query-candidates.ts`, `model-config.ts` e `rebuild-operations.ts`;
- `src/ui/memory-search.ts`, `memory-search-panel.tsx` e `use-memory-search.ts`.

## Desenho

### 1. Features absolutas

Novo `src/core/memory/scoring/features.ts`, com uma função pura que recebe os canais e os scores do reranker e devolve, para cada thread candidata:

| Feature | Definição | Grupo |
|---|---|---|
| `identityCosine` | Cosseno da consulta com o registro identity; 0 se ausente | semântica |
| `bestPassageCosine` | Maior cosseno entre as passagens da thread nos canais; 0 se ausente | semântica |
| `bestRerankerScore` | Maior score do reranker entre as passagens selecionadas, com a seleção atual de 3 por thread | semântica |
| `secondRerankerScore` | Segundo maior; 0 se houver só uma | semântica |
| `identityRerankerScore` | Score do reranker para o documento identity da thread | semântica |
| `lexicalTitleMatch` | 1 se a thread aparece no canal FTS de título ou de prefixo de título; senão 0 | lexical |
| `lexicalContentMatch` | 1 se aparece no canal FTS de conteúdo; senão 0 | lexical |

Nenhuma feature depende da posição relativa entre candidatos. Esse é o defeito que o estudo 2 mostrou na elegibilidade atual. Incluir o identity no reranker acrescenta um documento por thread candidata.

### 2. Modelo (H1)

`p = σ(w0 + Σ wᵢ·fᵢ)`, com `wᵢ ≥ 0` para todas as features. A monotonicidade garante que mais evidência nunca reduz o score.

- **`semanticOnly`:** o mesmo modelo com as features lexicais zeradas. Como os pesos são não negativos, `p ≥ semanticOnly`.
- **Modelo barato:** um segundo modelo, ajustado só com `identityCosine`, `bestPassageCosine`, `lexicalTitleMatch` e `lexicalContentMatch`, sem reranker. É usado pela alternativa C de H3 e pelo funil da E3.

**Ajuste**, no comando `pnpm memory:eval fit` (novo `scripts/memory-eval/fit.ts`):

- **rótulos:** par (caso, thread) com grau ≥ 2 vale 1; grau 0 ou 1 vale 0; pares não julgados ficam fora; todos os pares de casos negativos valem 0;
- **algoritmo:** gradiente descendente projetado (pesos negativos são cortados em 0), features padronizadas e pesos devolvidos à escala original, 2.000 iterações, taxa 0,1, regularização L2 com λ escolhido entre {0,01; 0,1; 1} pela menor log-loss média nos 5 folds agrupados da E0;
- **saída:** os pesos finais, ajustados com todos os folds, e as predições fora do fold de cada par, usadas na avaliação.

O ajuste usa só o corpus `marc`. O `ledgerline-en` fica como validação externa, sem reajuste.

### 3. Faixas e admissão

Os cortes saem das predições fora do fold. Cada corte é o menor valor de `p` em que a precisão (grau ≥ 2) dos pares com score maior ou igual atinge a meta:

| Faixa | Meta de precisão |
|---|---|
| alta | 0,90 |
| média | 0,60 |
| baixa | 0,30 |

Se uma meta não for atingível, a faixa fica vazia, e o relatório registra isso.

**Admissão (D6 por construção):**

- uma thread é admitida somente se `semanticOnly ≥ corte baixo`;
- a faixa de uma thread admitida é dada por `p` completo, então o acerto literal pode subir a faixa;
- a ordem é `p` decrescente, depois `bestRerankerScore` decrescente, depois `threadId` crescente.

Um teste de propriedade percorre combinações de features e confirma que nenhuma thread com `semanticOnly` abaixo do corte baixo é admitida, quaisquer que sejam as features lexicais.

### 4. Calibração por projeto (H2)

**Consultas sintéticas,** executadas no fim do rebuild:

- 60 consultas, com semente derivada da geração;
- cada consulta é uma frase de 6 a 20 palavras sorteada de uma passagem de uma thread fechada, e a thread de origem é o positivo (Inverse Cloze).

**Duas variantes de rótulo:**

- **N1:** os negativos excluem as threads que referenciam a thread de origem ou são referenciadas por ela (`marc://$`) e as threads com cosseno de identity ≥ 0,85 com ela;
- **N2:** só positivos. A escala é escolhida para que a mediana e o percentil 90 dos logits positivos caiam nos mesmos quantis da calibração de referência.

**Ajuste:** só escala e deslocamento, `p' = σ(a·logit(p) + b)` com `a > 0`, o que preserva a ordem. O resultado é estado derivado em `.marc/memory/calibration-<generation>.json`. Na ausência do arquivo, vale a calibração padrão (`a = 1`, `b = 0`). O status da memory informa `calibration: "project" | "default"`.

### 5. Sugestão de correção (H3)

As três alternativas implementam a mesma interface em `src/core/memory/suggestion/` e são registradas numa tabela `Record<"model" | "rule" | "evidence", SuggestionStrategy>`. A tela de D7 não muda.

| Alternativa | Comportamento |
|---|---|
| A, `model` | O LFM escolhe, como hoje |
| B, `rule` | Se `buildMemoryQueryCandidates` gera um candidato: aplica quando a grafia original não existe no corpus; sugere quando existe |
| C, `evidence` | Como B, mas só age quando a busca barata pelo candidato (modelo barato da seção 2) tem um resultado na faixa alta do modelo barato. O corte dessa faixa é escolhido com a mesma meta de 0,90 |

Para a avaliação, a captura passa a incluir os canais do texto do candidato determinístico de cada caso.

### 6. Contrato único (D2)

- **`MemoryRecallHit`:** ganha `band: "high" | "medium" | "low"`. O campo `score` passa a ser `p` calibrado, entre 0 e 1.
- **`MemoryRecallResult`:** ganha `abstained: boolean`, verdadeiro quando nenhuma thread é admitida.
- **MCP:** `limit` padrão continua 5 e devolve os 5 primeiros admitidos de qualquer faixa. A descrição da ferramenta explica as faixas.
- **UI:**
  - mantém `limit: 50` e mostra alta e média na lista principal;
  - a faixa baixa fica num bloco recolhido com o rótulo `Show less likely results`, registrado em `public/locales/en_US/translation.json`, o único locale existente;
  - `MEMORY_SEARCH_SCHEMA_VERSION` sobe de 5 para 6.

## Avaliação e decisão (passo dos aprovadores)

Depois da T1, os aprovadores rodam o harness e aplicam os critérios abaixo. A decisão é publicada na thread como mensagem própria, antes da T2.

| Hipótese | Critério de aceite | Se falhar |
|---|---|---|
| H1 | Nas predições fora do fold do `marc`: Top1-alvo não inferior a `M0`; recall de admissão não classificado como piora; alvos de 3P e 6I admitidos; abstenção correta nos negativos não classificada como piora | Recuo: manter a elegibilidade atual (seção "Recuo de H1") |
| H2 | Para N1 e para N2: no `marc`, a precisão de cada faixa difere no máximo 0,10 da obtida com rótulos reais, e pelo menos 80% dos pares admitidos caem na mesma faixa. Aceita-se a variante que passar; se as duas passarem, a de menor diferença máxima de precisão | Calibração padrão para todos os projetos |
| H6 | No `ledgerline-en`, com a calibração escolhida em H2: a precisão de cada faixa fica a no máximo 0,10 da meta | Ajustar só os cortes por corpus (recuo do registro). Se ainda falhar, registrar o limite e consultar o humano (D10) |
| H3 | Contra A, em todos os casos dos dois corpora: acertos de correção e sugestão nos casos `typo` ≥ os de A; correções e sugestões indevidas < as de A | Ordem de escolha: C; se falhar, B; se falhar, A |
| Latência | Mediana da E2 ≤ 1,2 × mediana de `M0` na captura | Os aprovadores registram a causa; a E3 trata no funil |

**Recuo de H1:** a ordem e a admissão de `M0` continuam. A faixa de cada thread admitida é dada pela `eligibility` com cortes escolhidos pelas mesmas metas de precisão, calculados em todos os dados, com essa limitação registrada.

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/scoring/**` (novo) | Features, modelo, faixas e ranking |
| `src/core/memory/suggestion/**` (novo) | Alternativas de H3 |
| `src/core/memory/operations.ts`, `recall-support.ts`, `types.ts`, `status.ts`, `rebuild-operations.ts` | Integração e contrato |
| `src/core/memory/semantic-ranking.ts`, `semantic-eligibility.ts`, `hybrid-ranking.ts` | Substituição ou remoção, se H1 for aceita |
| `src/core/memory/query-interpretation*.ts`, `local-query-interpreter.ts`, `model-config.ts`, `inference-*.ts`, `maintenance.ts` | Somente na T4 e somente se B ou C for escolhida |
| `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts`, `src/cli.ts` | Contrato |
| `src/ui/memory-search*.ts*`, `src/ui/use-memory-search.ts` e `public/locales/en_US/translation.json` | Faixas na UI |
| `scripts/memory-eval/**` | Variantes, `fit` e avaliação de H2, H3 e H6 |
| `scripts/memory-quality-v4.ts`, `scripts/memory-quality-selection.ts`, `scripts/memory-model-benchmark*.ts` e os testes `test/memory-quality-v4-selection.test.ts` e `test/memory-model-benchmark-runner.test.ts` | Remoção na T6. Esses scripts dependem da elegibilidade antiga e foram substituídos pelo `memory:eval` |
| `package.json` | Remover `memory:quality`, `memory:benchmark` e `test:benchmark` na T6 |
| `test/**` | Testes |
| `docs/memory.md`, `docs/mcp-tools.md`, `docs/adrs/0011-calibrated-memory-score.md`, `docs/adrs/README.md` | Documentação |

**Exclusões:**

- `pnpm-lock.yaml`, a menos que a remoção do LFM elimine uma dependência. Nesse caso, a mudança precisa de autorização explícita do humano;
- `.marc/memory/**`: o rebuild produtivo acontece só depois da aceitação humana da E1 e da E2 juntas;
- `src/core/memory/sources/**`, que pertence à E1.

## Tarefas do desenvolvedor

| Tarefa | Entrega | Testes |
|---|---|---|
| T1 | `scoring/features.ts`; variantes `H1_CALIBRATED`, `H1_FALLBACK`, `H2_N1`, `H2_N2` e `H3_A`, `H3_B`, `H3_C` no harness; comando `fit`; extensão da captura | Features com entradas declaradas; ajuste determinístico com semente; não negatividade dos pesos; cortes por meta de precisão com dados conhecidos; propriedade de D6 |
| — | **Decisão dos aprovadores, publicada na thread** | — |
| T2 | `scoring/calibration.ts` com os pesos e cortes emitidos pelo `fit`, aplicados com Edit; `scoring/rank.ts`; integração em `operations.ts`; contrato D2 no core, MCP, HTTP e CLI; remoção dos módulos antigos se H1 for aceita | Contrato do hit com `band`; `abstained`; MCP com no máximo 5; teste que compara os ids dos modelos da calibração com `activeMemoryModelSelection()` |
| T3 | Calibração por projeto no rebuild, se H2 for aceita | Determinismo por geração; `a > 0`; ausência do arquivo leva à calibração padrão; status informa a origem |
| T4 | Alternativa escolhida em H3. Se for B ou C, remoção do LFM, com a lista fechada de arquivos entregue pelos aprovadores no handoff | Testes de interpretação reescritos para a alternativa; inventário de modelos sem o papel `interpreter` |
| T5 | Faixas na UI, i18n e versão do snapshot | Testes de UI existentes atualizados; validação com Playwright CLI: busca com resultado alto, médio e baixo e bloco recolhido |
| T6 | Remoção dos scripts antigos, ADR 0011 e docs | `pnpm test` sem os testes removidos |

## Critérios de aceite da etapa

1. As decisões de H1, H2, H3 e H6 estão registradas na thread com a evidência do harness.
2. A implementação corresponde exatamente à alternativa decidida.
3. A propriedade de D6 é coberta por teste.
4. O contrato é o mesmo na UI e no MCP. A UI foi validada com Playwright CLI.
5. Os critérios da tabela de avaliação foram cumpridos ou recuaram conforme previsto.
6. `pnpm validate`, `pnpm build` e `pnpm test` passam, com as regras de estilo e de teste respeitadas.
7. `docs/memory.md`, `docs/mcp-tools.md` e o ADR estão atualizados.
8. Depois da aceitação humana da E1 e da E2, o humano autoriza um único rebuild produtivo, e o `memory_status` volta a `ready`.

## Riscos

- **Poucos dados para ajustar 8 parâmetros:** a regularização, a monotonicidade e os folds agrupados reduzem o risco, mas não o eliminam. Por isso o `ledgerline-en` fica fora do ajuste.
- **Meta de 0,90 inatingível:** a faixa alta pode ficar vazia no `marc`. Isso é informação para o humano, não motivo para baixar a meta sem decisão registrada.
- **Remoção do LFM:** afeta o `memory_prepare`, o status e o inventário de modelos. Os aprovadores entregam a lista fechada no handoff da T4.

## Pendências antes do dispatch

- desenvolvedor e configuração confirmados pelo humano;
- veredito conjunto dos aprovadores sobre este plano, depois da aprovação da E1.
