# Entrega 1d da E3: rank do M0 no funil e contagem real

Escopo: Parte A (núcleo do funil com o rank do M0, testes e script T1e) e Parte B (contagem sem pontuar dos dois corpora e catálogo real). Autor: claude-dev. Revisor pendente: marc://@claude-software-architect.

## 1. Rank do M0 no núcleo do funil

- `src/core/memory/funnel-admission.ts`: `admittedOf` monta as entradas do passo, uma por passagem pontuada dos finalistas, na ordem em que o passo as lista. Calcula a posição ordinal global de cada entrada com `numericRanks` (empate mantém a ordem das entradas). A melhor entrada de cada grupo é a de maior score e, em empate, a de menor denseRank, como `applyBestPassage` e `compareScoredPassages` do M0. Um empate total fica com a primeira entrada. O rank do grupo é a posição global dessa melhor entrada.
- Fallback identity-only: quando o grupo não tem passagem no passo, a identidade entra como entrada, como no M0.
- Sem dense rank para escores empatados e sem desempate novo por groupId.
- `src/core/memory/semantic-ranking.ts`: `numericRanks` exportado (só export; o M0 não muda).
- Retirados: `groupRerankRanks` e o tipo `ScoredPassage` de `funnel-selection.ts`, e o modo `group` do núcleo e do script. Nenhuma opção nem padrão novo.

## 2. Testes

- `test/memory-funnel-rank-fixtures.ts` (novo): fixture declarativo. Cada grupo carrega os próprios registros, e os IDs lexicais são declarados em uma lista. Sem ramificação nas fixtures.
- Correção de um defeito do fixture antigo: as passagens de um mesmo grupo tinham o mesmo texto padrão, então o documento do rerank era igual e o último escore sobrescrevia os outros. Agora cada passagem tem texto próprio.
- `test/memory-funnel-admission.test.ts` (2 testes) e `test/memory-funnel-admission-m0.test.ts` (2 testes): sem `if` nas fixtures. Cobrem o caso de falha da T1f e a paridade com várias passagens por grupo.
- `test/memory-funnel-rank-parity.test.ts` (novo, 2 testes): empate de scores entre grupos, e grupo identity-only. Em ambos, ALL_CANDIDATES dá a mesma sequência e as mesmas elegibilidades do M0.
- `test/memory-funnel-budget.test.ts`: retirado o teste de `groupRerankRanks`, que testava a função removida. A semântica nova está coberta pelos testes de paridade.
- Dataset: contagem do ledgerline atualizada para 79 em `test/memory-eval-dataset-ledgerline.test.ts`. A do marc segue em 137.

## 3. Tabelas T1g (modo único, semântica do M0)

Célula: b/c/b+c sobre os positivos completos (marc 100, ledgerline 34); conjuntos admitidos que mudam (de 114 no marc e de 40 no ledgerline). Os dois corpora têm 14 e 6 negativos, e a abstenção não muda em nenhuma célula.

marc, primeiro passo (allowance 116):

| K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|
| 2/6/8 · 30 | 2/5/7 · 28 | 2/4/6 · 26 | 2/0/2 · 16 | 2/0/2 · 13 | 2/0/2 · 11 | 2/0/2 · 7 |

marc, depth0 (allowance 232):

| K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|
| 2/6/8 · 30 | 2/5/7 · 28 | 2/4/6 · 26 | 2/0/2 · 16 | 2/0/2 · 14 | 2/0/2 · 12 | 2/0/2 · 11 |

ledgerline-en, primeiro passo e depth0, todos os K: b=0, c=0, conjuntos admitidos que mudam = 0.

As células do marc são iguais às do modo `passage` da T1f nas mesmas alocações e K. O núcleo agora coincide com a semântica que a T1f tinha só no script.

Validação com o M0 (`passage-all`, todos os grupos com passagens consolidadas): conjunto admitido igual em 114 de 114 casos no marc e em 40 de 40 no ledgerline; Top-1 igual nos mesmos casos.

## 4. Contagem real (sem pontuar pares)

Procedimento: `pnpm memory:eval capture --corpus <corpus> --count-only`, o mesmo da T1c-c. Os arquivos `.count.json` foram copiados para esta pasta.

| corpus | captureId | casos | pares por caso (mediana, mín, máx) | pares totais | horas | pares de recall de produção | horas com recall | tempo do índice |
|---|---|---|---|---|---|---|---|---|
| marc | 87cd2e4d96f7 | 137 | 2343 (2168, 2532) | 320 241 | 7,58 | 16 248 | 7,96 | 150 s |
| ledgerline-en | 0d31bd4afd3f | 79 | 265 (262, 265) | 20 917 | 0,49 | 7 019 | 0,66 | 9 s |

Os dois ficam abaixo do limite de 12 h, sem recusa.

## 5. Catálogo real (índice temporário, camadas 0, 1 e 2)

Leitura direta das linhas do índice temporário, com o mesmo caminho do `count-only` (`openCaptureContext` e `store.readRows`), sobre as threads fixadas: marc com 56 threads e 2 687 linhas; ledgerline com 30 threads e 265 linhas. Arquivo: `t1g-catalog.json`.

Passagens das threads pedidas (marc), por camada (0 / 1 / 2) e total:
- 834716ba (elegibilidade semântica e candidatos lexicais): 11 / 149 / 34, total 194.
- 3b4a8787 (revisão e atualização do marc para MCP): 6 / 95 / 12, total 113.
- 2f441fa7 (tools MCP para summary e encerramento de threads): 6 / 78 / 20, total 104.

Threads com 100 ou mais passagens no marc:
- Em todas as camadas somadas: 4 threads. Além das três acima, 57488bab (modelo contextual maior): 5 / 525 / 67, total 597.
- Em uma única camada: 2 threads, 57488bab (525 na camada 1) e 834716ba (149 na camada 1).
- Não há nenhuma thread com 100 ou mais passagens na camada 2 do marc. A maior é 57488bab, com 67.
- Ledgerline: a maior thread tem 10 passagens.

Casos de camada do marc (dataset atual, todos com julgamento na camada 1; nenhum julgamento na camada 2):

| caso | thread judgada na camada 1 | grau | passagens na camada 1 |
|---|---|---|---|
| Y01 | corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898 | 3 | 25 |
| Y02 | oportunidade-indicador-visual-de-memory-na-interface-174c48b6 | 3 | 16 |
| Y03 | oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1 | 3 | 11 |
| Y04 | oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba | 3 | 11 |
| Y05 | oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | 3 | 149 |
| Y06 | oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | 3 | 149 |
| Y07 | oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | 3 | 149 |
| Y08 | oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | 3 | 95 |
| Y09 | oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | 3 | 95 |
| Y10 | oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd | 3 | 5 |
| Y11 | oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2 | 3 | 16 |
| Y12 | oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c | 3 | 25 |
| Y13 | oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7 | 3 | 78 |
| Y14 | @rules (RULES.md, não é thread) | 3 | 26 |
| Y15 | oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac | 3 | 15 |
| J01 | oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a | 3 | 9 |
| J02 | oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c | 3 | 25 |
| J03 | oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | 3 | 95 |
| J04 | oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | 3 | 95 |
| J05 | oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd | 3 | 5 |
| J06 | oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | 3 | 149 |
| J07 | oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1 | 3 | 11 |
| J08 | corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898 | 3 | 25 |

## 6. Ressalvas da contagem

- O índice temporário é construído como no `count-only`. Esse caminho segmenta passagens pelo worker de reranking (`splitPassages`) e gera os embeddings do índice. Nenhum `rerank` foi chamado: a recall de produção usa `zeroRerankerOf`, e o caminho de contagem da matriz não chama rerank. Esta é uma evidência de código, não de execução. O mesmo procedimento foi usado na T1c-c.
- O catálogo cobre só as threads fixadas no pin de cada corpus.
- A contagem por caso segue o dataset atual (137 e 79). As capturas E2 não foram refeitas.

## 7. Checks

- `pnpm validate`: exit 0. `pnpm build`: exit 0.
- `pnpm test`: 962 de 962 passam.
- Manifest `.marc/memory/manifest.json`: sha256 `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a`, igual antes e depois.
- Leitura de código grande feita com context-mode (ctx_execute_file). Edições feitas com Edit e Write.
- Sem Git, sem rebuild produtivo, sem alteração de datasets nem de `.marc/memory/**`. Não publiquei nada além desta entrega.

## 8. Limites

- O modo `passage` do núcleo é o rank do M0 aprovado pelo Codex (msg_c4dec7d170fb47a0b3). A decisão final sobre o modo de rank continua com os aprovadores.
- Os testes de empate e de identity-only mostram igualdade com o M0 nos casos montados. Não demonstrei sensibilidade a outras regras de empate.
