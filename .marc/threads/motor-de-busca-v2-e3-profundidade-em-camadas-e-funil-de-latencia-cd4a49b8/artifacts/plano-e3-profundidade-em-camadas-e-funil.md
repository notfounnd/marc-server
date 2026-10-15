# Plano da E3: profundidade em camadas e funil de latência

## Resumo

A E3 liga as camadas 1 e 2 no índice e redefine `depth` como camadas de corpus (D3):

| Depth | Camadas buscadas |
|---|---|
| 0 | `SUMMARY.md` |
| 1 | + artifacts, `RULES.md` e documentos configurados |
| 2 | + `CHAT.md` |

A etapa também cobre:

- **H5:** a UI faz uma busca única com expansão adaptativa e determinística;
- **remoção do Deep da UI:** botão, estado e configuração;
- **H4:** funil de latência, em que um score barato escolhe os finalistas e só eles recebem o reranqueamento completo.

Os critérios de H5 são herdados de marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f, que é encerrada como superada por esta thread. Rota: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada

- E2 (marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2) aprovada tecnicamente e aceita pelo humano, com o rebuild produtivo feito.
- Medição de custo de todas as camadas da E1 disponível.
- Referências de linha conferidas pelos aprovadores no handoff.

## Fontes obrigatórias

- regras, registro da rota, relatórios da E0, E1 e E2, e o ADR 0010;
- proposta da thread `4f477d9f` (`proposta-estudo-profundidade-adaptativa-deep-search.md`);
- `docs/memory.md` (`UI search depth`, `UI search`, `Recall flow`);
- `src/core/memory/search-depth.ts`, `sources/index.ts`, `scoring/**`, `operations.ts` e `settings.ts`;
- `src/ui/memory-search-depth.ts`, `memory-search-panel.tsx`, `use-memory-search.ts`, `memory-search.ts`, `app-sidebar.tsx`, `app-sidebar-middle.tsx` e `workspace-settings-panel.tsx`;
- `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts` e `src/cli.ts`.

## Desenho

### 1. Camadas e grupos

- `INDEXED_LAYERS` passa a `[0, 1, 2]`.
- `search-depth.ts` troca o limite de candidatos por depth pela tabela `MEMORY_DEPTH_LAYERS: Record<MemorySearchDepth, MemoryLayer[]>`, com `MemorySearchDepth = 0 | 1 | 2`.
- O limite de candidatos por canal fica fixo em `CANDIDATES_PER_CHANNEL = 200`, porque depth deixa de controlar o tamanho do pool.

**Grupo de resultado:** é a thread (`threadId`), `@rules` ou `@document/<sourcePath>`. Uma thread agrega a evidência de todas as camadas permitidas: summary, artifacts e chat.

**Contrato do hit:**

- `MemoryRecallHit` ganha `groupKind: "thread" | "rules" | "document"`;
- `threadId` e `summaryPath` passam a ser opcionais e ausentes quando `groupKind` não é `thread`;
- `reference` segue uma tabela por tipo de fonte da melhor evidência:

| Melhor evidência | `reference` |
|---|---|
| summary | `marc://$<threadId>` |
| chat | `marc://$<threadId>/#<messageId>` |
| artifact | `marc://$<threadId>/#<messageId>/!<arquivo>` |
| rules ou document | o `sourcePath` como texto simples |

O leitor de artifact da E1 passa a resolver o `messageId`: é a primeira mensagem do `CHAT.md` cuja lista `artifacts` contém o arquivo. Sem mensagem, o artifact usa a referência da thread.

**MCP, CLI e HTTP:** `depth` aceita 0 a 2, com padrão 0. O valor 3 passa a ser rejeitado com uma mensagem que explica as camadas.

### 2. Expansão adaptativa (H5)

O core ganha a opção `adaptive?: boolean` em `MemoryRecallOptions`, com padrão `false`. Com `adaptive: true`:

1. busca em depth 0;
2. se nenhum resultado estiver nas faixas alta ou média, repete em depth 1;
3. depois em depth 2, pela mesma regra;
4. cada passo reusa a consulta efetiva da primeira interpretação, em modo literal.

A resposta ganha `layersSearched: MemoryLayer[]` para diagnóstico. A rota HTTP da UI usa `adaptive: true`. O MCP não expõe a opção: os agentes escolhem `depth` de forma explícita.

### 3. Funil (H4)

1. O modelo barato da E2 pontua todos os grupos candidatos.
2. Os 20 primeiros viram finalistas (`FUNNEL_FINALISTS = 20`).
3. Para cada finalista, o reranker avalia até 12 passagens por ordem de cosseno (`MAX_RERANK_PASSAGES_PER_GROUP = 12`), mais o identity quando houver.
4. O modelo completo pontua só os finalistas. Quem não é finalista não é admitido.

A seleção de passagens muda de 3 para 12, então a distribuição das features também muda. Por isso, o modelo completo e os cortes são **reajustados** com o mesmo procedimento do `fit` da E2.

### 4. Calibração entre camadas

As features continuam as da E2, calculadas sobre toda a evidência das camadas permitidas.

- **Critério:** em depth 1 e 2, a precisão de cada faixa fica a no máximo 0,10 da meta.
- **Recuo:** acrescentar ao modelo a feature one-hot do tipo de fonte da melhor evidência e reajustar.

### 5. Retirada do Deep da UI

- Remover `src/ui/memory-search-depth.ts`, o botão `Deep retry` e a cadeia de props (`deepRetryAvailable`, `onDeepRetry`, `memorySearchDeepRetryAvailable`, `onMemorySearchDeepRetry`) em `memory-search-panel.tsx`, `app-sidebar-middle.tsx`, `app-sidebar.tsx` e `use-memory-search.ts`.
- Remover a seção `Search depth` de `workspace-settings-panel.tsx` e as chaves sem uso em `public/locales/en_US/translation.json`.
- Remover `memory.searchRetryDepth` de `WorkspaceSettings`, `WorkspaceSettingsInput` e `settings.ts`. Um JSON existente com a chave continua válido: a chave é ignorada na leitura e some na próxima escrita.
- `MEMORY_SEARCH_SCHEMA_VERSION` sobe de 6 para 7.
- A UI mostra resultados de `rules` e `document` com o caminho e sem link de thread.

## Passo dos aprovadores: casos de camada

Antes da T2, os aprovadores escrevem pelo menos 15 casos por corpus em que a resposta está só em artifact, chat, `RULES.md` ou documento, e julgam os grupos com a escala da E0. No `ledgerline-en`, as 4 threads preparadas na E0 entram nesse conjunto.

## Avaliação e decisão (passo dos aprovadores)

| Hipótese | Critério de aceite | Se falhar |
|---|---|---|
| H4, recall | Recall de grupos de grau ≥ 2 entre os finalistas, comparado a todos os candidatos: limite inferior do IC da diferença > −0,02 | Reranquear até 12 passagens de todos os candidatos enquanto o corpus for pequeno |
| H4, latência | Na máquina de referência do humano, em depth 0 e com `adaptive`: mediana ≤ 5 s e p95 ≤ 10 s | Os aprovadores registram a medição e consultam o humano (D10), porque é um trade-off de produto |
| H5 | `ADAPTIVE` contra `DEPTH0` da E2: Top1-alvo não inferior; recall dos casos implícitos e de camada não classificado como piora; exposição incidental e admissões em negativos não classificadas como piora; `layersSearched` idêntico em duas execuções da mesma captura | Busca única em depth 0, sem expansão. As camadas ficam acessíveis só pelo MCP e pela E4 |
| Camadas | Critério da seção 4 | Recuo da seção 4 |
| Rebuild | Rebuild completo do `marc` ≤ 15 min na máquina de referência | Os aprovadores levam a medição ao humano |

A decisão é publicada na thread antes da T3.

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/sources/**` | `INDEXED_LAYERS` e `messageId` do artifact |
| `src/core/memory/search-depth.ts`, `scoring/**`, `operations.ts`, `recall-support.ts`, `types.ts`, `settings.ts`, `src/core/types.ts` | Camadas, grupos, funil e expansão |
| `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts`, `src/cli.ts` | Contrato de depth |
| `src/ui/**` dos arquivos citados na seção 5 e `public/locales/en_US/translation.json` | Retirada do Deep e grupos sem thread |
| `scripts/memory-eval/**`, `test/**` | Variantes e testes |
| `docs/memory.md`, `docs/mcp-tools.md`, `docs/ui-and-daemon.md`, `docs/adrs/0012-memory-depth-as-corpus-layers.md`, `docs/adrs/README.md` | Documentação |

**Exclusões:** `pnpm-lock.yaml`, `.marc/memory/**` (o rebuild produtivo só acontece depois da aceitação humana) e o backlog de Playwright fora do item da UI desta etapa.

## Tarefas do desenvolvedor

| Tarefa | Entrega | Testes |
|---|---|---|
| T1 | Camadas ligadas, `messageId` do artifact, grupos, contrato do hit, depth de 0 a 2 no core, MCP, CLI e HTTP, e captura por depth no harness | Mapeamento de depth para camadas; `reference` por tipo, em tabela declarada; depth 3 rejeitado; artifact sem mensagem |
| — | **Casos de camada escritos pelos aprovadores** | — |
| T2 | Variantes `DEPTH0`, `DEPTH1`, `DEPTH2`, `ADAPTIVE`, `FUNNEL_K20` e `ALL_CANDIDATES` no harness, mais o reajuste | Determinismo do funil; finalistas por modelo barato |
| — | **Decisão dos aprovadores, publicada na thread** | — |
| T3 | Funil e expansão adaptativa em produção, com as constantes reajustadas | `layersSearched`; parada na primeira camada com alta ou média; não finalista nunca admitido |
| T4 | Retirada do Deep da UI, grupos sem thread e snapshot v7 | Testes de UI atualizados (`ui-memory-search-depth.test.ts` removido ou reescrito); Playwright CLI: busca única, resultado de `RULES.md` exibido com caminho, ausência do botão e da seção de settings |
| T5 | ADR 0012 e docs | — |

## Critérios de aceite da etapa

1. As decisões de H4, H5, das camadas e do rebuild estão registradas com evidência do harness.
2. A implementação corresponde à decisão.
3. Não sobra referência a `Deep retry`, `searchRetryDepth` ou depth 3 em `src/**`, `docs/**` e `public/**`, verificado por busca no repositório.
4. A UI foi validada com Playwright CLI. O backlog de marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado, conforme a regra de fluxo.
5. `pnpm validate`, `pnpm build` e `pnpm test` passam, com as regras de estilo e de teste respeitadas.
6. Depois da aceitação humana, o humano autoriza o rebuild produtivo com todas as camadas.

## Riscos

- **Volume do chat:** threads longas, como a `57488bab`, dominam o número de passagens. O funil limita o custo da busca, mas não o do rebuild.
- **Ruído do chat:** discussões intermediárias podem superar decisões. A autoridade fica visível no resultado, e a E4 orienta a leitura da fonte original.
- **Mudança de contrato do MCP:** depth 3 deixa de existir, o que afeta agentes que o usavam. A mensagem de erro explica as camadas.

## Pendências antes do dispatch

- desenvolvedor e configuração confirmados pelo humano;
- veredito conjunto dos aprovadores sobre este plano, depois da aceitação da E2.
