# Entrega T4 da E3: Deep fora da UI, settings sem searchRetryDepth e snapshot v7 (claude-dev)

Escopo executado conforme o handoff-t4.md e a seção 6 do plano. Nenhuma alteração em scripts/memory-eval/**, no restante de src/core/memory/**, em src/mcp/**, em datasets, capturas, .marc/memory/** ou pnpm-lock.yaml. Sem Git.

## 1. Mudanças

- **UI, busca única.** `src/ui/memory-search.ts`: uma requisição sem campo `depth`, snapshot v7 sem profundidades, validação aceita hit sem `threadId` (rules e document) e `summaryPath` opcional. `src/ui/use-memory-search.ts`: sem laço de profundidades, sem `runDeepRetry`, sem `deepRetryAvailable`; hit sem thread não gera "Thread not found". `src/ui/memory-search-panel.tsx`: sem o botão Deep; hit sem thread com o caminho e o ícone `FileText`; seleção só para hit com `threadId`; chave da lista por `groupId`.
- **Removidos:** `src/ui/memory-search-depth.ts` e `test/ui-memory-search-depth.test.ts`.
- **Cadeia de props** do Deep e da profundidade: `app-sidebar.tsx`, `app-sidebar-middle.tsx`, `app.tsx`, `app-modals.tsx`, `workspace-settings-modal.tsx`, `workspace-settings-panel.tsx` (seção Search depth), `use-workspace-memory-actions.ts`, `ui/types.ts`.
- **Core e daemon:** `src/core/memory/settings.ts` (constantes, campo e leitura; a escrita renderiza o objeto tipado, então a chave some na próxima gravação), `background.ts`, `index.ts` (só as três reexportações autorizadas), `src/core/types.ts` (saída de searchRetryDepth em WorkspaceSettings e WorkspaceSettingsInput), `src/daemon/memory-routes.ts` (saída do parse). POST com a chave antiga é ignorado, sem erro.
- **Estilo e tradução:** `shell-navigation.css` (regra `.memory-search-deep-retry`), `public/locales/en_US/translation.json` (Deep, Deep retry, Edge, Search depth, "{{count}} retries"). JSON válido, 156 chaves.
- **Docs:** `docs/ui-and-daemon.md`: busca única em depth 0, chave antiga de settings, e correção de "depth 0 through 3" para "0 through 2" (MAX_MEMORY_SEARCH_DEPTH = 2).
- **Testes:** `ui-memory-search.test.ts` (dividido por max-lines), novo `ui-memory-search-hits.test.ts`, helper `ui-memory-search-fixtures.ts`, `ui-memory-search-workflow.test.ts` reescrito (sem ternário), `ui-memory-search-panel.test.ts`, `ui-app-sidebar.test.ts`, `ui-workspace-settings.test.ts`, `core-memory-settings.test.ts` (novo: JSON antigo lido sem a chave e removido na escrita), `core-memory-sources-documents.test.ts`, `daemon-memory-background.test.ts`.

## 2. Checks

- `pnpm validate`: código 0 (uma falha de max-lines em teste foi corrigida dividindo o arquivo).
- `pnpm build`: código 0 (aviso de chunk já existente).
- `pnpm test`: 1010 passam, 0 falham.
- Typecheck: código 0.
- Busca em src/** e public/** por Deep retry, deepRetry, searchRetryDepth, recallMemorySearchDepths, memory-search-depth e Search depth: nenhuma ocorrência.

## 3. Playwright CLI (versão 0.1.13)

Ambiente isolado: daemon de teste em 4199 e Vite em 5199, com config temporária que só troca o alvo do proxy. O daemon do ecossistema (4187, PID 27740) não foi usado nem encerrado. Busca e status foram interceptados, porque não há modelos instalados neste ambiente.

- 1280×720 (padrão), 1440×900 e 390×844: uma requisição por busca, corpo `{limit, query, queryMode}` sem `depth`; nenhum botão ou texto Deep; sem rolagem horizontal (1440 e 390).
- Hit de regra (`RULES.md`) e de documento (`docs/ui-and-daemon.md`) exibidos com o caminho; desabilitados; clicar não gera "Thread not found".
- Workspace settings, 1440×900 e 390×844: sem "Search depth", sem "Deep", sem "retries"; "Inference batch size" presente.
- Snapshot schema 6 gravado no localStorage: descartado e removido ao recarregar.
- Capturas em `C:\Users\junior\AppData\Local\Temp\claude\C--Projetos-marc\7b29f3be-2d0c-456f-996a-ff29e6ee7922\scratchpad\t4-*.png`.

## 4. Backlog Playwright f742659a (revisado, não editado)

A seção "Memory Search Progressive Deep Retry" (linhas 175 a 191) descreve um comportamento que deixou de existir e precisa ser retirada ou reescrita. Também ficam obsoletos o item de busca alternativa após retries (linha 220), a nota de cobertura de bandas com continuação por profundidade (linha 211) e o cenário de abstenção por profundidade 3 (linhas 206 e 207). A alteração no backlog está fora da escrita autorizada e fica para um pedido separado.

## 5. Resíduos e riscos

- `src/ui/styles/thread-content.css` mantém `.workspace-settings-slider-legend`, sem uso. Arquivo fora da lista autorizada.
- `pnpm validate` roda lint e prettier em modo de escrita; sem Git, não verifiquei por diff se algum arquivo fora do escopo foi reformatado.
- Validação visual com recall interceptado (sem modelos). A busca real com camadas 1 e 2 segue para a T3 reduzida e a T5.
- Remoções de `src/ui/memory-search-depth.ts` e do teste correspondente foram feitas com `rm`, não com o editor.
