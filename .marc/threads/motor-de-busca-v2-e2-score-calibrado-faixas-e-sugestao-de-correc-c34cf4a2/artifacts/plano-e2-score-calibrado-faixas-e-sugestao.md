# Plano da E2: score calibrado, faixas e sugestão de correção

## Resumo

A E2 troca a elegibilidade relativa atual por um score absoluto e calibrado. Esse score vira o contrato único da UI e do MCP (D2). A etapa cobre:

- **H1:** score calibrado por regressão logística monotônica sobre features absolutas;
- **H2:** ajuste da escala por projeto no rebuild, com consultas sintéticas;
- **H6:** verificação das faixas no segundo corpus;
- **H3:** decisão da sugestão de correção, que pode retirar o LFM do pacote;
- **H7:** juiz de admissão como segundo estágio do score, com Qwen3-Reranker-0.6B ou Kev-0.6B (revisão 3);
- **H8:** alternativa D da H3, a interpretação por escolha tipada, com Laya, Kev ou o LFM lendo logits (revisão 3);
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
- **algoritmo:** gradiente descendente projetado (pesos negativos são cortados em 0), features padronizadas e pesos devolvidos à escala original, 2.000 iterações, taxa 0,1, regularização L2 com λ escolhido entre {0,01; 0,1; 1};
- **procedimento de ajuste** (função única `fitProcedure(trainFolds)`, usada nos dois níveis abaixo):
  1. com os folds de treino recebidos, faz uma validação cruzada interna agrupada por família, em que cada fold de treino fica de fora uma vez;
  2. escolhe λ pela menor log-loss média nas predições internas fora do fold;
  3. escolhe os cortes das faixas (seção 3) sobre essas mesmas predições internas;
  4. reajusta os pesos com todos os folds de treino e o λ escolhido;
  5. devolve pesos, λ e cortes.
- **validação aninhada:** para cada um dos 5 folds da E0, o `fit` chama `fitProcedure` com os outros 4 e aplica os pesos e os cortes devolvidos ao fold que ficou de fora. Isso gera a **predição externa** e a **faixa externa** de cada par. Nenhum dado do fold externo participa da escolha de λ, dos pesos ou dos cortes que o avaliam;
- **saída:**
  - as predições e as faixas externas de cada par, que são **as únicas usadas nos critérios de aceite**;
  - os pesos, λ e cortes de produção, obtidos chamando `fitProcedure` com os 5 folds.

O ajuste usa só o corpus `marc`. O `ledgerline-en` fica como validação externa, sem reajuste.

### 3. Faixas e admissão

Os cortes são escolhidos dentro do `fitProcedure`, sobre as predições internas fora do fold, e nunca sobre os dados usados para avaliá-los. Cada corte é o menor valor de `p` em que a precisão (grau ≥ 2) dos pares com score maior ou igual atinge a meta:

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

A revisão 3 acrescenta a alternativa D, `typed`, que é a H8. Opções, limites e variantes estão no artifact adendo-e2-juiz-e-interpretacao-tipada.md, que é a especificação detalhada de H7 e H8.

### 5b. Juiz de admissão (H7)

O H7 é um segundo estágio depois da pré-admissão do H1: `p2 = σ(v0 + v1·logit(p) + v2·judge)`, com pesos não negativos, ajustado dentro do mesmo `fitProcedure` aninhado. O ramo de recuo do H1, o documento julgado (`buildJudgeDocument`), a captura (canal judge) e o isolamento dos folds estão especificados no adendo.

### 6. Contrato único (D2)

- **`MemoryRecallHit`:** ganha `band: "high" | "medium" | "low"`. O campo `score` passa a ser `p` calibrado, entre 0 e 1.
- **`MemoryRecallResult`:** ganha `abstained: boolean`, verdadeiro quando nenhuma thread é admitida.
- **MCP:** `limit` padrão continua 5 e devolve os 5 primeiros admitidos de qualquer faixa. A descrição da ferramenta explica as faixas.
- **UI:**
  - mantém `limit: 50` e mostra alta e média na lista principal;
  - a faixa baixa fica num bloco recolhido com o rótulo `Show less likely results`, registrado em `public/locales/en_US/translation.json`, o único locale existente;
  - `MEMORY_SEARCH_SCHEMA_VERSION` sobe de 5 para 6.

## Avaliação e decisão (passo dos aprovadores)

Depois da T1, os aprovadores fazem o julgamento incremental da E0 (`worksheet --variants`) para os pares novos de todas as variantes da tabela, rodam o harness e aplicam os critérios abaixo. Os critérios de H1 e H2 usam só as predições e faixas externas da validação aninhada. "Não inferior" segue a regra de decisão da E0: inconclusivo reprova, com uma rodada única de ampliação antes do recuo. A decisão é publicada na thread como mensagem própria, antes da T2.

| Hipótese | Critério de aceite | Se falhar |
|---|---|---|
| H1 | Nas predições externas do `marc`: Top1-alvo, recall de admissão e abstenção correta nos negativos não inferiores a `M0`; alvos de 3P e 6I admitidos | Recuo: manter a elegibilidade atual (seção "Recuo de H1") |
| H2 | Para N1 e para N2: no `marc`, a precisão de cada faixa difere no máximo 0,10 da precisão das faixas externas obtidas com rótulos reais, e pelo menos 80% dos pares admitidos caem na mesma faixa. Aceita-se a variante que passar; se as duas passarem, a de menor diferença máxima de precisão | Calibração padrão para todos os projetos |
| H6 | No `ledgerline-en`, com a calibração escolhida em H2: a precisão de cada faixa fica a no máximo 0,10 da meta | Ajustar só os cortes por corpus (recuo do registro), com a validação aninhada aplicada dentro do `ledgerline-en` (5 folds agrupados por família, mesma semente) e precisão medida só nos folds externos. Nesse caso, o `ledgerline-en` deixa de ser validação externa intocada, e o relatório registra isso; a generalização para um terceiro projeto passa a ser um limite declarado ao humano. Se ainda falhar, registrar o limite e consultar o humano (D10) |
| H3 e H8 | Para B, C e cada D, contra A, em todos os casos dos dois corpora: acertos de correção e de sugestão ≥ os de A; cada contador de erro indevido ≤ o de A; soma dos erros indevidos < a de A (revisão 3) | Escolha entre as que passarem: menor soma de erros, depois maior soma de acertos, depois menos modelos distintos na cadeia (o reuso conta uma vez), depois a ordem B, C, D_LFM, D_KEV, D_LAYA. Se nenhuma passar, fica a A. É decidida depois da H7 |
| H7 | Nas predições externas do `marc`, contra a base (H1_CALIBRATED ou H1_FALLBACK): Top1-alvo, recall de admissão e abstenção correta não inferiores; e precisão de admissão com "melhora" ou exposição incidental com o intervalo inteiro abaixo de 0. No `ledgerline-en`, sem reajuste, a precisão de cada faixa fica a no máximo 0,10 da meta | Sem juiz. Se os dois juízes passarem, fica o de maior ganho em precisão de admissão; em empate, o de menor delta de RSS |
| Latência | Mediana da E2 ≤ 1,2 × mediana de `M0` na captura | Os aprovadores registram a causa; a E3 trata no funil. Para H7 e H8, a latência e a memória (RSS de base, pico e delta, com medido e estimado separados) não reprovam. O humano aprova o custo antes da adoção em produção |

**Recuo de H1:** a ordem e a admissão de `M0` continuam. A faixa de cada thread admitida é dada pela `eligibility`, com cortes escolhidos pelas mesmas metas de precisão e pela mesma validação aninhada: a precisão por faixa reportada vem dos folds externos, e os cortes de produção vêm dos 5 folds.

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
| `scripts/memory-eval/**` | Variantes, `fit` e avaliação de H2, H3, H6, H7 e H8 |
| `src/core/memory/scoring/judge.ts` e `src/core/memory/local-judge.ts` (novos), `model-config.ts`, `inference-manager.ts` e `maintenance.ts` | Somente na T2b, se a H7 for aceita, e na T4, se uma alternativa D for escolhida |
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
| T1 | `scoring/features.ts`; variantes `H1_CALIBRATED`, `H1_FALLBACK`, `H2_N1`, `H2_N2` e `H3_A`, `H3_B`, `H3_C` no harness; comando `fit`; extensão da captura | Features com entradas declaradas; ajuste determinístico com semente; não negatividade dos pesos; cortes por meta de precisão com dados conhecidos; propriedade de D6; validação aninhada: um teste com um fold externo marcado prova que nenhum par dele chega ao `fitProcedure` que o avalia |
| T1b, junto com a T1 | `buildJudgeDocument`; canais judge e choice; variantes H7_JUDGE_QWEN e H7_JUDGE_KEV, com os ramos _FALLBACK, e H3_D_LAYA, H3_D_KEV e H3_D_LFM; segundo estágio no `fitProcedure`; passada `--judge` do latency | Os testes listados no adendo |
| — | **Decisão dos aprovadores, publicada na thread** | — |
| T2b, só se a H7 for aceita e o humano aprovar o custo | Juiz em produção: `scoring/judge.ts`, papel judge no model-config, download pelo `memory_prepare` e status | Contrato do juiz com um provedor falso; inventário com o papel judge |
| T2 | `scoring/calibration.ts` com os pesos e cortes emitidos pelo `fit`, aplicados com Edit; `scoring/rank.ts`; integração em `operations.ts`; contrato D2 no core, MCP, HTTP e CLI; remoção dos módulos antigos se H1 for aceita | Contrato do hit com `band`; `abstained`; MCP com no máximo 5; teste que compara os ids dos modelos da calibração com `activeMemoryModelSelection()` |
| T3 | Calibração por projeto no rebuild, se H2 for aceita | Determinismo por geração; `a > 0`; ausência do arquivo leva à calibração padrão; status informa a origem |
| T4 | Alternativa escolhida em H3. Se for B ou C, remoção do LFM, com a lista fechada de arquivos entregue pelos aprovadores no handoff | Testes de interpretação reescritos para a alternativa; inventário de modelos sem o papel `interpreter` |
| T5 | Faixas na UI, i18n e versão do snapshot | Testes de UI existentes atualizados; validação com Playwright CLI: busca com resultado alto, médio e baixo e bloco recolhido |
| T6 | Remoção dos scripts antigos, ADR 0011 e docs | `pnpm test` sem os testes removidos |

## Critérios de aceite da etapa

1. As decisões de H1, H2, H3, H6, H7 e H8 estão registradas na thread com a evidência do harness.
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

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. Validação aninhada separa a escolha de λ, pesos e cortes dos dados que aprovam o resultado; critérios de H1 passam a exigir não inferioridade em vez de "sem piora classificada"; o recuo de H6 declara que o `ledgerline-en` perde o papel de validação externa se orientar cortes; julgamento incremental antes da decisão. Arquitetura sem mudança.
- **Revisão 3 (2026-10-17):** incorpora o adendo adendo-e2-juiz-e-interpretacao-tipada.md (msg_01ee9c5ca7a847b38d), revisado conforme o parecer de marc://@codex-software-architect (msg_e6821b4bae8e4e2b93 e a resposta msg_b9812ba7a604410892) e confirmado por ele (msg_0aa24982cc7b42f5ae). O humano aprovou nesta data.
  - **Origem:** a E0 mostrou a perda do M0 na admissão e na ordenação, e o humano autorizou um estudo de modelos no padrão "System One" (Jev), com modelos locais e abertos.
  - **Acrescenta:** H7 (juiz de admissão) e H8 (alternativa D da H3), com as tarefas T1b e T2b.
  - **Altera:** o critério da H3, que agora exige que nenhum erro aumente e que a soma dos erros diminua, porque A teve zero correções indevidas na E0. Altera também a regra de escolha da H3, que passa a ser por qualidade e não mais pela ordem fixa C → B → A.
  - **Prioridade do humano:** qualidade primeiro. A latência e a memória são medidas e não reprovam, mas o humano aprova o custo antes da adoção.
  - **Regras:** nenhum ajuste fino com os julgamentos da E0 e nenhuma dependência nova.
  - H1, H2, H6, D2 e D6 não mudam.
