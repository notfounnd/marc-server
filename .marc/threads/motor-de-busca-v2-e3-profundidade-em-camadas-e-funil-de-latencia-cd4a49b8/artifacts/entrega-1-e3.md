# Entrega 1 da E3: profundidade em camadas e funil (T0 a T1c-c)

Autoria: claude-dev, executado como Haiku 5.5 em xhigh, confirmado pelo humano.

**Origem da execução.** A T0 e as T1a a T1c-b foram executadas por uma instância anterior do mesmo perfil claude-dev. A T1c-b2 e a T1c-c foram executadas pela instância atual. Esta entrega cobre o trabalho da T0 à T1c-c. Não cobre a T2 (métricas e escolha de K por fold), a T3 (funil e expansão em produção), a T4 (retirada do Deep da UI) nem a T5 (ADR 0012 e medição de ponta a ponta).

**Thread.** Não há mensagens da thread depois da T0 (msg_ebf6563839fd4aa295). Os números das T1a a T1c-b vêm do código e dos arquivos, não do histórico da thread.

## Resumo

- O harness da E3 está completo para captura por camadas, contagem sem pontuar, replay e complementação append-only.
- A produção continua com `INDEXED_LAYERS = [0]`. Nenhum rebuild produtivo foi feito.
- A T0 fixou B = 232 pares por consulta, grade viável de K de 8 a 30 e K_max = 30.
- A invariância do BM25 **falhou** no índice real do marc. Nada foi corrigido. A decisão sobre o recuo do DEPTH0 cabe aos aprovadores.
- A contagem real do marc e do ledgerline-en passou no limite de 12 h, sem pontuar.

## Mudanças por área

### Núcleo (`src/core/memory`)

- **Camadas:** `INDEXED_LAYERS` em `sources/index.ts` permanece `[0]` em produção. O `messageId` do artifact está em `sources/artifact.ts`, sem mudança de schema.
- **Profundidade:** `depth` de 0 a 2 está exposto no MCP, na CLI e nas rotas do daemon. Depth 3 e `minScore` são rejeitados. Como a produção ainda indexa só a camada 0, depth acima de 0 só altera o resultado depois do rebuild com as camadas.
- **Busca por camada:** `searchChannelsByLayer` (`layered-search.ts`) busca passagem e léxico por camada, com limite de 100. O identity só roda na camada 0. A recall em `operations.ts` usa `layersForDepth`.
- **Contrato do hit:** `groupId`, `groupKind`, `layersSearched`, `rerankPairs` e `expansionStop` estão nos tipos.
- **Ordenação do reranker:** `rerank-order.ts` tem `length` como padrão e `input` para o harness.
- **Funil (`funnel-*.ts`):** `selectFinalists`, `selectRerankPassages` (modos cosine e cosine-fts), `matrixScope`, `groupsOf`, `admittedOf` com cortes opcionais, `validateFunnelBudget`, `planStepPairs` e `runFunnel`. Hoje é usado só pelo harness.

### Ainda não existe

- Expansão adaptativa em produção (T3).
- Retirada do Deep da UI e do `searchRetryDepth`, que ainda estão em `src/ui` e `src/daemon` (T4).
- ADR 0012 (T5).

### Harness (`scripts/memory-eval`)

- **T0:** `t0-funnel-prestudy.ts` e `t0-funnel-math.ts`.
- **Captura E3:** `capture.ts` (planejamento, escore, gate de contagem), `capture-plan.ts`, `capture-scope.ts`, `capture-layers.ts`, `capture-vectors.ts` (float32, um arquivo), `capture-score.ts`, `capture-count.ts` (`--count-only`), `capture-complement.ts` (`--complement`, append-only) e `capture-synthetic.ts` (legado E2, só com opção explícita).
- **Evidência:** `evidenceMatchesOf` localiza cada citação. Casos com evidência não indexada inteira ficam incompletos com o motivo.
- **Replay:** `replay.ts` e `variants.ts` (DEPTH0 a DEPTH2, M0, FUNNEL_Dd, ALL_PASSAGES_Dd, ALL_CANDIDATES_Dd com passagens consolidadas, ADAPTIVE e ADAPTIVE_HM). O `judgedDepth` vem do próprio run. `replay-funnel.ts` lê budget, K, modo e cortes, sem padrão.
- **Corpus:** documentos configurados pelo leitor da produção (`readDocumentSources`, sem `initWorkspace`).
- **Worksheet:** grupos `@rules` e `@document` têm célula só na camada onde estão os passages.

## Decisões do principal aplicadas

- D1: ALL_CANDIDATES com passagens consolidadas de M0, sem expandir a matriz.
- D2: publicação sem dispensa, só depois da T1c-c (esta entrega).
- D3: `--funnel-mode cosine|cosine-fts` obrigatório, sem padrão.
- Cortes de faixa por arquivo (`--band-cuts`), obrigatórios só para ADAPTIVE e ADAPTIVE_HM. `MEMORY_BAND_CUTS` não é usado.
- D4: `getWorkspaceInfo`, `readWorkspaceSettingsInWorkspace` e `readDocumentSources`, sem `initWorkspace`.
- D5: arquivos novos com até 300 linhas. Arquivos antigos não foram refatorados.
- K_max = 30 para o escopo da matriz. Não há K padrão em nenhum ponto do código.
- A chave de score segue por texto (`rerankPairKey`), com teste para dois registros de mesmo texto.
- Normalização do `sourcePath`: o índice grava caminhos da raiz do workspace (`.marc/…`), e a evidência usa caminhos do corpus.

## T0 (números de `.marc/cache/memory-eval-e3/t0/report.md`)

- B = 232 pares por consulta (231 na sensibilidade). K viável de 8 a 30, K_max = 30.
- Vazão do reranker: 6,42 pares/s na ordem original e 11,74 pares/s ordenado por tamanho (+82,8%).
- M0 ao vivo: mediana de 18,25 s e p95 de 19,67 s em 30 casos.
- f_interp = 1,285 s e f_passo = 0,262 s.
- Curva exploratória de recall: K=8 dá 0,720 e K=30 dá 0,945. Não escolhe K.
- Pares por caso do M0: mediana de 120 (mínimo de 99 e máximo de 135).

## T1c-c: invariância do BM25

Índices temporários do corpus fixado do marc, com as 114 consultas efetivas da captura 1b68a7e3f4e6. A comparação é da camada 0, com membros e ordem por canal.

- Índice de camada 0: 351 registros, construído em 19,8 s.
- Índice de camadas 0, 1 e 2: 2.687 registros, construído em 143,2 s.
- `identity`: sem divergência.
- `passage` (vetorial): ordem diferente em 77 casos; conjunto diferente em 12; delta máximo de score 0,0050. A causa está na seção de vetores abaixo.
- `title` (BM25): ordem diferente em 84 casos; delta máximo de score 8,43.
- `summary` (BM25): ordem diferente em 104 casos; conjunto diferente em 89; delta máximo de score 5,05.
- `titlePrefix`: 8 consultas, sem divergência.
- Resultado: 114 de 114 casos divergem em pelo menos um canal. A divergência de título e resumo vem do BM25, cujos scores dependem das estatísticas do índice. Recuo pré-declarado, a decidir pelos aprovadores.
- Relatório completo: `.marc/cache/memory-eval-e3/t1c/bm25-invariance.json`.

## Causa da divergência vetorial (canal passage)

Mede se os vetores da camada 0 dependem da composição do índice. Relatório: seção `vectors` de `bm25-invariance.json`.

- Dimensão 384. Índice de camada 0 construído duas vezes: 351 de 351 registros idênticos (Δ = 0; cosseno mínimo 0,9999999999999998). O índice de camada 0 é determinístico consigo mesmo.
- Índice de camada 0 contra o de camadas 0, 1 e 2: 348 de 351 registros idênticos. Três registros mudam, com Δ máximo de 0,01295 por componente e cosseno mínimo de 0,99757.
- Classificação (a): os vetores mudam entre os índices e o índice de camada 0 é determinístico. A causa é atribuída ao lote do embedding, que muda com a composição do índice. A hipótese não foi isolada variando o tamanho de lote diretamente.
- A mudança de vetor de três registros explica a divergência do passage, com delta de score de até 0,005.

## T1c-c: contagem sem pontuar

| Corpus | Casos | Pares por caso (mediana, mín., máx.) | Pares totais | Horas | Production recall (mediana por caso, total) | Horas com recall | Índice |
|---|---|---|---|---|---|---|---|
| marc | 114 | 2.287 (2.074 a 2.456) | 259.798 | 6,15 | 119; 13.454 | 6,47 | 147,8 s |
| ledgerline-en | 40 | 265 (261 a 265) | 10.584 | 0,25 | 89; 3.539 | 0,33 | 8,8 s |

Estimativa com a vazão da T0 (11,74 pares/s). A contagem não passou do limite de 12 h. Os arquivos `.count.json` estão em `.marc/cache/memory-eval-e3/t1c/`.

## Validação

- `pnpm validate`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: 934 de 934.
- Typecheck com o tsconfig do scratchpad: exit 0.
- Manifest de produção `b96e41ce…`: intacto, conferido antes e depois.

## Riscos e pendências

- **BM25 divergente** (títulos e resumo). Recuo pré-declarado, decisão dos aprovadores.
- **Vetores da camada 0 dependem do índice** (3 de 351 registros). Afeta a ordem do canal vetorial em consultas com empates próximos. Causa atribuída ao lote, não isolada.
- **Escopo da matriz:** 2.287 pares por caso no marc, cerca de 19 vezes o pool do M0 (120). A T0 supunha 1.000 a 1.500. A vazão precisa ser medida na captura real.
- **Calibração H2:** não roda sobre captura E3, porque captura E3 não tem consultas sintéticas. Isso é intencional.
- **Retomada:** o `--resume` replaneja todos os casos antes de pontuar, e só pontua os que faltam.
- **Arquivos antigos acima de 300 linhas** (`cli.ts`, `judgments.ts`, `replay.ts`, `capture.ts`, `variants.ts`): não refatorados, como combinado.
- **T2 a T5** ainda não iniciadas. Na T5, a referência M0 da latência precisa usar índice `[0]` e ordem `input`.

## Para a revisão do harness pelo Codex

- Contrato de `ALL_CANDIDATES` com passagens consolidadas e cobertura do escopo.
- Gate de contagem e recusa antes da pontuação, com a estimativa do production recall.
- Complementação append-only e o registro das rodadas em `complementRounds`.
- Normalização do `sourcePath` e a evidência por passage.
- Resultado da invariância do BM25, a causa vetorial e o que isso muda na decisão.
