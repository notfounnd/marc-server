# Resumo executivo

Thread: `oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99`
Closed: `2026-07-15T03:41:13.693Z`

## Objetivo

Coordenar rebuilds da summary-memory entre daemon, UI, MCP e CLI para que exista apenas um rebuild ativo por workspace e para que todas as origens observem corretamente o estado `rebuilding`.

## Diagnostico

- O daemon ja deduplicava rebuilds em background por processo com `rebuildPromise`.
- MCP e CLI chamavam o rebuild pelo core sem compartilhar essa promessa local do daemon.
- Quando MCP ou CLI iniciavam rebuild, o daemon podia continuar reportando apenas `stale`, porque nao via uma promessa local ativa.
- O watcher do daemon ignora deliberadamente `.marc/cache/`, entao locks de cache nao devem acionar rebuild de thread index nem eventos de arquivo.
- A UI ja sabia renderizar `DatabaseZap` para `rebuilding`, mas precisava receber esse estado pelo status compartilhado.

## Implementacao

- `src/core/write-coordination.ts` recebeu tentativa nao bloqueante de lock e consulta leve de lock ativo.
- `src/core/memory/rebuild-coordination.ts` centralizou o recurso `memory-rebuild`, o status derivado `rebuilding` e a leitura do lock compartilhado.
- `src/core/memory/status.ts` passou a concentrar montagem de status, comparacao de manifest e verificacao de provider.
- `rebuildMemoryInWorkspace` passou a executar o trabalho real de rebuild sob lock global por workspace.
- `BackgroundMemoryReconciler` passou a combinar promessa local e lock global no health.
- `readMemoryStatus` e `rebuildMemory` passaram a retornar `rebuilding` quando outra origem possui o lock.
- `MemoryStatusState` passou a incluir `rebuilding`.
- `UiEventBus` passou a monitorar transicoes do lock de memory apenas enquanto ha cliente SSE conectado e a emitir `workspace-changed` nas transicoes ativo/inativo.
- `docs/memory.md` foi atualizado com o contrato de lock compartilhado, concorrencia e visibilidade na UI.

## Decisoes

- Nao alterar o corpus da memory: continua indexando apenas `.marc/threads/*/SUMMARY.md`.
- Nao alterar provider de embeddings, schema persistido do LanceDB ou formato da snapshot `.marc/memory`.
- Manter Markdown como fonte da verdade; locks, indexes, manifest e status sao projecoes operacionais.
- Nao reabilitar eventos de watcher para `.marc/cache/`; o monitor de lock e separado do watcher de threads.
- Solicitacao concorrente nao fica enfileirada para refazer o indice; ela observa `rebuilding`.
- O monitor de lock so roda enquanto ha cliente UI conectado por SSE.
- Workspaces diferentes continuam isolados.

## Validacao

- `pnpm run validate`: passou.
- `pnpm test`: passou com 125 testes.
- `pnpm build`: passou, mantendo apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- Checagem adicional nos arquivos tocados: sem `else` e sem `if` aninhado.
- Validacao pos-restart: `workspace_status` e `memory_status` carregaram pela tool reiniciada.
- Validacao pos-restart: memory pronta, 34/34 summaries indexados, `stale=false`, `modelPrepared=true`.
- Validacao operacional do lock: rebuild acionado pela UI criou `.marc/cache/write-locks/memory-rebuild-ebd463d001c87936.lock`, status reportou `rebuilding` e depois voltou para `ready` com o lock removido.
- Backlog Playwright verificado e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a para cobrir `DatabaseZap` durante rebuild UI e rebuild externo MCP/CLI via `workspace-changed`.

## Observacoes

- `memory.autoRebuild` estava `false` no fechamento; isso nao bloqueia a thread, mas rebuild automatico da memory nao roda ate ser religado na UI.
- Apos criar este summary, a memory precisa ser reconstruida para incluir a thread fechada quando `autoRebuild` estiver desligado.

## Referencias

- Plano: `artifacts/plano-coordenacao-global-rebuild-memory.md`
- Resultado: `artifacts/resultado-coordenacao-global-rebuild-memory.md`
