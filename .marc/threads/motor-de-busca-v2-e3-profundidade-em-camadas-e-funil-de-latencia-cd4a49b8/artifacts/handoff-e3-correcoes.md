# Handoff da E3: conferência das referências e correções

## Resumo

Este documento confere o código atual, depois do commit fb9c030 da E2, contra o plano da E3, e lista o que a revisão 4 corrige. A conferência foi feita com três explorações somente leitura (núcleo de busca, harness, e UI e transportes) e com uma revisão de desenho. As referências de linha valem para o estado de 2026-10-22. O desenvolvedor confere cada uma antes de editar.

## Medida que mudou o funil

- **Documentos por consulta:** na captura `marc/1b68a7e3f4e6`, o M0 manda em mediana 120 documentos ao reranker por caso (de 99 a 135; o índice tem 351 registros, 56 identity e 295 passage).
- **Vazão:** com a mediana de 18,2 s, o reranker roda a cerca de 7 pares por segundo. A interpretação custa cerca de 0,5 s (`latency-choice-lfm.json`).
- **Funil da revisão 3:** 20 × 12 = 240 pares, cerca de 34 s por passo.
- **Lotes:** `inference-worker.ts:250-275` preenche cada lote até o maior documento (`padding: true`, máximo de 512).

## Núcleo de busca

1. **Depth hoje é o tamanho do pool, não a camada.**
   - `MEMORY_SEARCH_CANDIDATE_LIMITS = [100, 200, 300, 400]` (`search-depth.ts:3`);
   - `isMemorySearchDepth` (`:7-14`) e `candidateLimitForDepth` (`semantic-ranking.ts:107-109`);
   - o tipo `MemorySearchDepth = 0|1|2|3` está em `types.ts:323`.
   - O intervalo de 0 a 3 também aparece em `workspace-memory.ts:146-147`, `mcp/memory-tools.ts:55-56`, `daemon/memory-routes.ts:176,181`, `cli.ts:74,130,143-144`, `settings.ts:20-21,49-54,109-116` e `ui/memory-search-depth.ts:2-6`.
2. **A busca nunca passa as camadas.** As chamadas de `operations.ts:218-236` não enviam `layers`, então o store usa `DEFAULT_SEARCH_LAYERS = [0]` (`sources/contract.ts:22`, `lancedb-store.ts:137,165`, `store.ts:110`).
3. **A busca lexical não filtra por `kind`.** O filtro está em `lancedb-store.ts:154-186` e `lancedb-store-support.ts:235-246`. Os campos `title` e `titlePrefix` só existem nas linhas identity (`lancedb-store-support.ts:89-97`).
4. **A interpretação lê todas as linhas, com os vetores.** `recall-support.ts:50-51` faz `readRows` sem filtro de camada, e o vocabulário sai de `query-candidates.ts`. Com o chat indexado, isso mudaria `DEPTH0`. Correção: ler só a camada 0.
5. **A unidade de resultado é o `threadId`:**
   - `consolidateThreads` (`semantic-ranking.ts:124-146`, com `MAX_RERANK_PASSAGES_PER_THREAD = 3` em `:21`);
   - `lexicalRanksByThread` (`hybrid-ranking.ts:87-99`);
   - `dedupeMemoryRecallHits` (`recall-support.ts:60-71`).
   - `@rules` e `@document/<path>` já existem como `threadId` sintético (`sources/rules.ts:31`, `sources/document.ts:137`). Os artifacts e o chat usam o `threadId` da thread dona.
6. **O rank do reranker é global por passagem.** `numericRanks` sobre todos os documentos (`semantic-ranking.ts:165-170,202-211`). `rerankerSupport` e `identityRerankerAgreement` usam esse rank (`:260-289`). `evidenceConcentration` conta passagens com rank denso ≤ 10 (`:285-289`).
7. **A eligibility favorece grupos com identity.** Os termos do identity, a concordância de canais e a margem ficam em zero sem identity (`semantic-eligibility.ts:49-52,71-84`). `preferredEvidence` lança erro para um grupo sem passagem e sem identity (`semantic-ranking.ts:240-246`).
8. **`nextActions` manda fazer `thread_read` de qualquer `reference`** (`recall-actions.ts:3-16`), inclusive o caminho de `@rules`.
9. **O artifact não sabe o `messageId`.**
   - O leitor (`sources/artifact.ts:61-89`) deixa o campo vazio;
   - o campo já existe no registro e no schema LanceDB (`lancedb-store-support.ts:29-37,98,134,188`) e na origem do chunk (`chunks.ts:5-7`);
   - o vínculo está no meta `artifacts:` do CHAT.md (`core/markdown.ts:71-77`, `core/artifacts.ts:52-63,89-95`), e `ClosedThread.chat` já é carregado (`threads.ts:25,55-58`).
   - Sem mudança de schema, porque uma mudança deixaria o status `incompatible` (`status.ts:57-58`), faria o reconcile lançar erro (`rebuild-operations.ts:56-61`) e bloquearia o rebuild automático (`workspace-status.ts:192`).
10. **O status compara só os summaries, por `threadId`.**
    - `operations.ts:87` com `summaries.ts:3`, e `status.ts:44,70-98`;
    - com as camadas 1 e 2, vários registros dividem um `threadId` e `@rules` aparece como extra, então o status ficaria `stale` para sempre;
    - correção: um comparador único por `sourcePath` com o reconcile (`rebuild-operations.ts:131-171`).
    - O reconcile em segundo plano já usa `INDEXED_LAYERS` (`background.ts:180-185` → `rebuild-operations.ts:101`). Precisa só de teste.
11. **Settings:**
    - a leitura monta o objeto campo a campo e ignora chaves desconhecidas (`settings.ts:134-153`);
    - a escrita grava o objeto normalizado (`:68-95`), então `searchRetryDepth` some sozinho na próxima escrita;
    - `searchRetryDepth` também está em `background.ts:15,33,109-110`, `core/types.ts:244,269,278` e `memory/index.ts:47-49`.

## Harness

12. **O dataset não tem `evidence` nem os estilos `layer` e `adaptive-trap`** (`dataset.ts:3-23`). As regras de `validate` estão em `dataset.ts:128-227`.
13. **Julgamentos por thread, só no nível do summary.**
    - `judgments.ts:170-174` rejeita `@rules` (`corpus.has`);
    - `worksheetThread` lê o `SUMMARY.md` (`judgments.ts:353-370`).
14. **A captura é só da camada 0 e de uma depth.**
    - `CAPTURE_DEPTH` é fixo (`capture-channels.ts:26,62`);
    - os vetores de passagem não são gravados (`capture.ts:537-541`);
    - a matriz cobre todos os registros (`capture.ts:266-280`).
15. **Corpus e validação de produção.**
    - A cópia do corpus e o digest não incluem documentos nem settings (`corpus.ts:57-66`).
    - A validação de produção marca `@rules` como inesperado e falha no modo record-id quando as camadas diferem (`capture.ts:391-431`).
16. **As variantes não mudam a seleção de passagens.** `VariantInput` tem um único conjunto de canais (`variants.ts:35-50`), e `VariantResult` não expõe a passagem selecionada (`:52-57`). O M0 não atribui `band` (`variants.ts:88-93`). `report.ts:36` tem uma lista fixa de variantes.
17. **`decisionTerm` pode dizer "piora" com `nonInferior` verdadeiro** (`statistics.ts:137-149`), por exemplo com o intervalo [−0,02; −0,01]. É para corrigir na T2.
18. **Os cortes de produção vazam no marc.** `MEMORY_BAND_CUTS` (`scoring/bands.ts:8-12`) foram ajustados com todo o marc. As medidas da E3 usam os cortes por fold (`fit.ts:317-341`).
19. **Módulos só do harness em `src/core/memory/scoring/`:** `features.ts`, `judge-document.ts` e `synthetic-queries.ts`. Eles vão para `scripts/memory-eval/` com os testes `test/memory-scoring-features.test.ts`, `test/memory-judge-document.test.ts` e `test/memory-synthetic-queries.test.ts`, e as importações do harness são ajustadas.

## UI e transportes

20. **HTTP:**
    - depth inválido devolve `undefined` e cai no 400 "Search query is required" (`memory-routes.ts:59-61,181-182`);
    - `limit` aceita qualquer número finito (`:187,197-201`);
    - a costura `DaemonServerDependencies` está em `server.ts:26-33,37,149` e `routes.ts:36`;
    - o fake do teste descarta o depth (`test/daemon-memory-search.test.ts:137-174`).
21. **Cadeia do Deep:**
    - `memory-search-depth.ts`;
    - `memory-search.ts:30-46,129-167` (laço) e `:222-244` (validação do snapshot);
    - `use-memory-search.ts:66-125,208-232`;
    - `memory-search-panel.tsx:24,32,39,47,143-147`;
    - `app-sidebar.tsx:150,163`;
    - `app-sidebar-middle.tsx:29,41,54,66,96,108,235,247,260,268`;
    - `styles/shell-navigation.css:269`.
22. **Settings da UI:** `workspace-settings-panel.tsx:14,23,37-49,65-77,79-104`, `workspace-settings-modal.tsx:14,24,58`, `app-modals.tsx:37,58,84` e `use-workspace-memory-actions.ts:88-89`.
23. **Grupos sem thread na UI.**
    - `isMemoryRecallHit` exige `threadId` e `summaryPath` (`memory-search.ts:304-315`);
    - a busca da thread é por `threadId` (`:66-71`);
    - `selectHit` mostra "Thread not found" (`use-memory-search.ts:194-204`);
    - o card fica desabilitado sem thread (`memory-search-panel.tsx:244-277`);
    - o tipo da UI não tem `sourceType` nem `sourcePath` (`ui/types.ts:96-106`).
24. **Tradução:** `"{{count}} retries"` (:5), `"Deep"` (:45), `"Deep retry"` (:46), `"Edge"` (:51) e `"Search depth"` (:121).
25. **Contagem das referências que somem:** `searchRetryDepth` tem 45 ocorrências em 16 arquivos, e `Deep retry`/`deepRetry` tem 33 em 10 arquivos.
26. **Docs:**
    - `docs/memory.md:85-102,133,181,209`;
    - `docs/mcp-tools.md:105`;
    - `docs/ui-and-daemon.md:171`;
    - `docs/adrs/0011-memory-confidence-bands.md:30`, que diz que a UI continua a sequência de profundidades;
    - o próximo ADR livre é o 0012.
27. **Testes que mudam:**
    - `test/ui-memory-search-depth.test.ts` (removido);
    - `ui-memory-search.test.ts:86-198,270-296`;
    - `ui-memory-search-workflow.test.ts:16,80-237`;
    - `core-memory-recall.test.ts:114-143`, que espera os pools `[100,100,400,400]`;
    - `core-memory-settings.test.ts:26-49`;
    - `daemon-memory-background.test.ts:38-62`;
    - `ui-workspace-settings.test.ts:39-56`;
    - `ui-memory-search-panel.test.ts:5-12`;
    - `ui-app-sidebar.test.ts:5-14`.

## Produção intacta

- **Manifest:** `.marc/memory/manifest.json`, sha256 `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a`, com 61 registros de summary e a geração `20261022025654947_cbb6ce74`.
- **Regra:** sem mudança até a aceitação da E3.
