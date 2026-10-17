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
2. se nenhum resultado estiver na faixa **alta**, repete em depth 1;
3. depois em depth 2, pela mesma regra;
4. cada passo reusa a consulta efetiva da primeira interpretação, em modo literal.

**Por que só a faixa alta encerra a busca:** a faixa média tem meta de precisão de 0,60, ou seja, até 40% dos resultados dela podem ser irrelevantes. Parar a busca por causa de um resultado médio no `SUMMARY.md` impediria encontrar a resposta real num artifact ou no chat. A regra anterior (parar em alta ou média) continua no harness como a variante de referência `ADAPTIVE_HM`, avaliada offline sem custo.

A resposta ganha `layersSearched: MemoryLayer[]` para diagnóstico. A rota HTTP da UI usa `adaptive: true`. O MCP não expõe a opção: os agentes escolhem `depth` de forma explícita.

### 3. Funil (H4)

1. O modelo barato da E2 pontua todos os grupos candidatos.
2. Os 20 primeiros viram finalistas (`FUNNEL_FINALISTS = 20`).
3. Para cada finalista, o reranker avalia até 12 passagens por ordem de cosseno (`MAX_RERANK_PASSAGES_PER_GROUP = 12`), mais o identity quando houver.
4. O modelo completo pontua só os finalistas. Quem não é finalista não é admitido.

A seleção de passagens muda de 3 para 12, então a distribuição das features também muda. Por isso, o modelo completo e os cortes são **reajustados** com o mesmo procedimento do `fit` da E2, incluindo a validação aninhada.

**O trecho útil chega ao reranker?** Mais passagens reduzem o risco de descartar a evidência, mas não provam que ela sobreviveu. A thread estar entre os finalistas também não prova isso. Por isso, a E3 mede as duas coisas:

- **recall de grupos:** grupos de grau ≥ 2 entre os finalistas;
- **sobrevivência da evidência:** entre os grupos de grau ≥ 2 que viraram finalistas, a proporção em que alguma das 12 passagens selecionadas é uma das passagens que contêm a citação de `evidence`, identificadas pelo `passageId` registrado na captura. Selecionar outra passagem da mesma seção, sem a citação, **não** conta como sobrevivência;
- **variante `ALL_PASSAGES`:** igual ao funil, mas o reranker avalia todas as passagens de cada finalista. Ela mostra quanto se perde com o limite de 12.

Para isso, a captura da E3 grava o score do reranker de **todas** as passagens dos grupos de grau ≥ 2 e dos 20 finalistas de cada caso. O tempo da captura entra no relatório.

O relatório lista cada perda de evidência, com o caso, o grupo, o número de passagens do grupo e o efeito no resultado final: a posição do grupo em `FUNNEL_K20` comparada à posição em `ALL_PASSAGES`.

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

A T1 acrescenta ao dataset da E0:

- os estilos `layer` e `adaptive-trap` em `EvalCaseStyle`;
- o campo opcional `evidence?: { sourcePath: string; quote: string }[]` em `EvalCase`. A `quote` é uma citação literal, de 5 a 40 palavras, do trecho que responde à consulta. A evidência é reconhecida pelo **conteúdo**, e não pelas linhas, porque as passagens herdam o intervalo da seção (E1) e esse intervalo não distingue uma passagem da outra;
- a regra de comparação: `contém(passagem, quote)` aplica `markdownToIndexText` (E1) aos dois textos, junta espaços em branco e compara em minúsculas;
- três regras novas no `validate`: casos `layer` e `adaptive-trap` sem `evidence` são rejeitados; a `quote` precisa ter de 5 a 40 palavras; a `quote` precisa aparecer no arquivo de `sourcePath`;
- uma checagem na captura: cada `quote` precisa estar contida inteira em pelo menos uma passagem indexada do `sourcePath`. Se ficar dividida entre duas passagens, a captura lista o caso como `evidence_unindexable`, e o caso fica `incomplete` até os aprovadores escolherem uma citação menor. O `passageId` (E1) das passagens que contêm a citação fica registrado na captura.

Antes da T2, os aprovadores escrevem e julgam com a escala da E0:

- **casos de camada (`layer`):** pelo menos 15 por corpus em que a resposta está só em artifact, chat, `RULES.md` ou documento, com o trecho marcado em `evidence`. No `ledgerline-en`, as 4 threads preparadas na E0 entram nesse conjunto. No `marc`, pelo menos 4 desses casos têm a evidência em threads longas, com 100 ou mais passagens indexadas, como a `57488bab`, porque é nelas que o limite de 12 passagens mais arrisca descartar o trecho útil;
- **casos armadilha (`adaptive-trap`):** pelo menos 8 por corpus. Em cada um, o `SUMMARY.md` de uma thread traz um resultado plausível, mas que não responde à consulta (grau ≤ 1), e a resposta real (grau 3) está só no artifact ou no chat de **outra** thread, marcada em `evidence`. Esses casos testam justamente a parada antecipada da expansão adaptativa.

## Avaliação e decisão (passo dos aprovadores)

Antes da decisão, os aprovadores fazem o julgamento incremental da E0 (`worksheet --variants`) para os pares novos de todas as variantes. "Não inferior" segue a regra de decisão da E0: inconclusivo reprova, com uma rodada única de ampliação antes do recuo.

| Hipótese | Critério de aceite | Se falhar |
|---|---|---|
| H4, recall | Recall de grupos de grau ≥ 2 entre os finalistas, comparado a todos os candidatos: limite inferior do IC da diferença > −0,02 | Reranquear até 12 passagens de todos os candidatos enquanto o corpus for pequeno |
| H4, evidência | As duas condições juntas: sobrevivência da evidência ≥ 0,90 nos casos `layer` e `adaptive-trap`; Top1-alvo de `FUNNEL_K20` não inferior ao de `ALL_PASSAGES` | Seleção passa a ser a união das 12 passagens de maior cosseno com as passagens que casaram no canal FTS, até 24 por grupo, e o critério é reavaliado uma vez. Se ainda falhar, os aprovadores levam o trade-off com a latência ao humano (D10) |
| H4, latência | Na máquina de referência do humano, em depth 0 e com `adaptive`: mediana ≤ 5 s e p95 ≤ 10 s | Os aprovadores registram a medição e consultam o humano (D10), porque é um trade-off de produto |
| H5 | `ADAPTIVE` contra `DEPTH0` da E2: Top1-alvo, recall dos casos `implicit` e `layer`, exposição incidental e abstenção correta nos negativos, todos não inferiores; nos casos `adaptive-trap`, a busca para antes da camada que contém a evidência em no máximo 1 caso por corpus, e o relatório compara Top1-alvo e Top3-alvo de `ADAPTIVE` com os de `DEPTH2` nesses casos, para mostrar o efeito da parada na relevância final; `layersSearched` idêntico em duas execuções da mesma captura. `ADAPTIVE_HM` é reportada nos mesmos itens, só como referência | Se só a latência falhar por causa da expansão, os aprovadores levam ao humano (D10) os números de `ADAPTIVE` e `ADAPTIVE_HM`, sem trocar a regra automaticamente, porque `ADAPTIVE_HM` falha nas armadilhas por construção. Nos demais casos: busca única em depth 0, sem expansão, com as camadas acessíveis só pelo MCP e pela E4 |
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
| T1 | Camadas ligadas, `messageId` do artifact, grupos, contrato do hit, depth de 0 a 2 no core, MCP, CLI e HTTP; captura por depth no harness, com os scores de todas as passagens dos grupos de grau ≥ 2 e dos finalistas; estilos `layer` e `adaptive-trap` e campo `evidence` no dataset | Mapeamento de depth para camadas; `reference` por tipo, em tabela declarada; depth 3 rejeitado; artifact sem mensagem; `validate` rejeita `layer` e `adaptive-trap` sem `evidence`, `quote` fora de 5 a 40 palavras e `quote` ausente do arquivo; captura marca `evidence_unindexable` quando a citação fica dividida entre passagens |
| — | **Casos `layer` e `adaptive-trap` escritos e julgados pelos aprovadores** | — |
| T2 | Variantes `DEPTH0`, `DEPTH1`, `DEPTH2`, `ADAPTIVE`, `ADAPTIVE_HM`, `FUNNEL_K20`, `ALL_PASSAGES` e `ALL_CANDIDATES` no harness; métricas de sobrevivência da evidência e de parada antecipada nas armadilhas; reajuste | Determinismo do funil; finalistas por modelo barato; sobrevivência da evidência por `passageId`, com o cenário declarado de uma seção com duas passagens em que selecionar só a que não contém a citação produz falha de sobrevivência; `ADAPTIVE` continua com resultado médio e para com resultado alto |
| — | **Decisão dos aprovadores, publicada na thread** | — |
| T3 | Funil e expansão adaptativa em produção, com as constantes reajustadas | `layersSearched`; parada na primeira camada com resultado alto; resultado médio não interrompe a expansão; não finalista nunca admitido |
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

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. A expansão adaptativa só para com resultado na faixa alta, e casos armadilha testam a parada antecipada; o funil passa a medir a sobrevivência da evidência contra `ALL_PASSAGES`, além do recall de grupos; critérios de H5 exigem não inferioridade; julgamento incremental antes da decisão. Arquitetura sem mudança.
- **Revisão 3 (2026-10-15):** responde ao parecer de marc://@codex-software-architect sobre a revisão 2. A evidência passa a ser uma citação literal reconhecida pelo conteúdo, e a sobrevivência passa a ser verificada pelo `passageId` da E1, e não pela interseção com as linhas da seção.
