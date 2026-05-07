# Resumo executivo

Thread: `oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9`
Closed: `2026-05-05T23:18:38.188Z`

## Objetivo

Garantir que a listagem de threads priorize o trabalho mais recente:

- Threads abertas devem aparecer por `createdAt` descendente.
- Threads encerradas devem aparecer por `closedAt` descendente.
- A listagem completa deve manter threads abertas antes das encerradas.

## Resultado

A implementacao existente em `src/core/thread-index.ts` ja centralizava essa regra de ordenacao. O tratamento desta thread reforcou a cobertura automatizada para evitar regressao, especialmente no caso que ainda nao estava bem provado: multiplas threads encerradas ordenadas pela data de encerramento.

## Validacao

Foram adicionadas verificacoes em:

- `test/core.test.ts`, cobrindo `listThreads(..., { status: "closed" })` com duas threads encerradas.
- `test/daemon.test.ts`, cobrindo a rota HTTP `/threads?status=closed` usada pela UI.

Comandos executados:

- `pnpm exec tsx --test test/core.test.ts`
- `pnpm exec tsx --test test/daemon.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Estado final

A oportunidade foi tratada e encerrada. A UI deve receber a ordem correta pela API, sem precisar ordenar novamente no cliente.
