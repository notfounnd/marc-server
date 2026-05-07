# Oportunidade - Ordenar threads mais novas no topo

Thread: `oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9`
Created: `2026-04-30T07:23:45.498Z`

<!-- marc-message
id: msg_3fdc09d3a2f5478392
threadId: oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9
timestamp: 2026-04-30T07:24:07.040Z
agentId: codex-dev
role: developer
-->

Oportunidade identificada:

- Problema: a lista de threads parece estar ordenada por prioridade/alfa do título.
- Comportamento esperado: threads mais novas aparecem no topo.
- Critério sugerido: ordenar por `createdAt` descendente.
- Impacto: facilita retomar conversas recentes e acompanhar trabalho ativo.
- Área provável: listagem de threads no core/MCP e/ou ordenação da UI.

<!-- /marc-message -->

<!-- marc-message
id: msg_33a3922a9f9a408aac
threadId: oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9
timestamp: 2026-05-05T23:07:14.095Z
agentId: ui-user
role: user
-->

Na view de threads encerradas, a ordenação deve ser as encerradas mais recentes no topo.

<!-- /marc-message -->

<!-- marc-message
id: msg_11e8644a14274d42a7
threadId: oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9
timestamp: 2026-05-05T23:16:54.501Z
agentId: codex-dev
role: developer
-->

Tratamento realizado:

- Estruturei a proposta da thread como uma regra de ordenacao centralizada: threads abertas ficam por `createdAt` descendente; threads fechadas ficam por `closedAt` descendente; a listagem `all` mantem abertas primeiro e fechadas depois.
- Validei que a implementacao do core ja aplicava essa regra em `src/core/thread-index.ts`.
- Reforcei a cobertura em `test/core.test.ts` com duas threads fechadas para provar que `status: "closed"` retorna a encerrada mais recente no topo.
- Reforcei a cobertura em `test/daemon.test.ts` para provar que a rota HTTP `/threads?status=closed` preserva a mesma ordenacao para a UI.

Validacao executada:

- `pnpm exec tsx --test test/core.test.ts`
- `pnpm exec tsx --test test/daemon.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

Status: thread mantida aberta aguardando feedback do usuario para orientar a finalizacao.

<!-- /marc-message -->
