# Resultado - Coordenacao global de rebuild da memory

## Diagnostico confirmado

A falha observada nao era apenas visual. O daemon deduplicava rebuilds com `rebuildPromise`, mas esse estado era local ao processo. Rebuilds iniciados por MCP ou CLI chegavam diretamente ao core e nao eram visiveis para a promessa local do daemon.

Como `.marc/cache/` e ignorado pelo watcher de threads, a criacao do lock/cache tambem nao emitia `workspace-changed`. A UI permanecia em `stale` enquanto o rebuild externo estava ativo e so atualizava depois do fim.

## Implementacao realizada

- Adicionada tentativa nao bloqueante de lock em `src/core/write-coordination.ts`.
- Adicionada consulta leve de lock ativo, com recuperacao de lock stale.
- Criada a fronteira `src/core/memory/rebuild-coordination.ts` para o recurso `memory-rebuild`, status `rebuilding` e lock compartilhado.
- Extraido status/freshness de memory para `src/core/memory/status.ts`, mantendo `operations.ts` focado em operacoes de scan/embed/store/recall.
- Protegido o rebuild efetivo em `rebuildMemoryInWorkspace` com lock global por workspace.
- Ajustado `BackgroundMemoryReconciler` para combinar promessa local e lock global no health.
- Ajustado `readMemoryStatus` e `rebuildMemory` para reportar `rebuilding` quando outra origem possui o lock.
- Atualizado o contrato de tipo para incluir `rebuilding` como estado formal de memory.
- Adicionado monitor no `UiEventBus` que observa transicoes do lock de rebuild apenas enquanto existe cliente SSE conectado.
- O monitor emite `workspace-changed` apenas em transicoes active/inactive, reaproveitando o refresh/status existente da UI.
- Mantido o watcher de threads ignorando `.marc/cache/`, preservando a decisao anterior.

## Comportamento esperado

- Um rebuild iniciado por UI, MCP ou CLI impede outro rebuild simultaneo no mesmo workspace.
- Uma chamada concorrente nao fica enfileirada para refazer o indice; ela observa `rebuilding`.
- A UI passa a conseguir trocar o indicador para `DatabaseZap` durante rebuild externo, desde que haja cliente SSE conectado.
- Sem cliente UI conectado, o daemon nao mantem polling do lock de memory.
- Workspaces diferentes continuam isolados.

## Arquivos principais

- `src/core/write-coordination.ts`
- `src/core/memory/rebuild-coordination.ts`
- `src/core/memory/status.ts`
- `src/core/memory/operations.ts`
- `src/core/memory/background.ts`
- `src/core/workspace-memory.ts`
- `src/core/memory/types.ts`
- `src/core/memory/index.ts`
- `src/daemon/events.ts`
- `test/core-write-coordination.test.ts`
- `test/core-memory.test.ts`
- `test/core-memory-background.test.ts`
- `test/daemon-events.test.ts`
- `docs/memory.md`

## Validacao executada

- `pnpm run validate`: passou.
- `pnpm test`: passou com 125 testes, 0 falhas.
- `pnpm build`: passou; Vite manteve o aviso existente de chunk maior que 500 kB.
- Checagem adicional nos arquivos tocados: sem `else` e sem `if` aninhado.

## Observacao operacional

Para validar o comportamento na UI e nas tools MCP carregadas em sessao, sera necessario reiniciar o daemon e reconectar/reiniciar o cliente MCP, pois houve alteracao de build e de codigo carregado em processo.