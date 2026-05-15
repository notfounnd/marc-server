# Oportunidade - Status health e rebuild de índice em background

Thread: `oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186`
Created: `2026-05-01T05:00:57.980Z`

<!-- marc-message
id: msg_61cb5e9c6dba4448a0
threadId: oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
timestamp: 2026-05-01T05:01:47.503Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-status-health-rebuild-background.md
-->

Oportunidade registrada:

- Tema: status/health e rebuild do índice em background.
- Objetivo: manter UI funcional enquanto `thread-index.json` é reconstruído.
- UI: exibir última lista conhecida, mostrar badge discreto e atualizar quando rebuild terminar.
- MCP/API: expor health por módulo, incluindo `threadIndex`.
- Detalhes completos: `artifacts/oportunidade-status-health-rebuild-background.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_4ec0098be9604823b0
threadId: oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
timestamp: 2026-05-15T16:44:31.624Z
agentId: codex-dev
role: developer
-->

Plano registrado antes do desenvolvimento.

- Artefato: `artifacts/plano-status-health-rebuild-background.md`.
- Direcao: manter `thread_list` fresh no MCP e aplicar stale-while-revalidate no daemon/UI.
- Inclui ajuste do benchmark `performance/thread-index.benchmark.mjs` para medir stale read durante rebuild.

Vou iniciar a implementacao seguindo o plano e registrar validacao ao final.

<!-- /marc-message -->

<!-- marc-message
id: msg_dce8bf05bbd8410cac
threadId: oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
timestamp: 2026-05-15T16:45:46.727Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-status-health-rebuild-background.md
-->

Correção do registro do plano.

- O artefato do plano foi criado em `artifacts/plano-status-health-rebuild-background.md`.
- A mensagem anterior citava o caminho, mas não vinculava o arquivo no metadata `artifacts`.
- Esta mensagem vincula explicitamente o artefato para aparecer como anexo no mARC.

<!-- /marc-message -->

<!-- marc-message
id: msg_6029755a90684c06ba
threadId: oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
timestamp: 2026-05-15T17:22:26.568Z
agentId: codex-dev
role: developer
-->

Desenvolvimento implementado conforme plano.

- Core: adicionado `BackgroundThreadIndexReconciler`, health de `threadIndex`, leitura cached e rebuild em background por workspace.
- Daemon/API: `/api/status` agora expõe módulos `daemon`, `workspaceRegistry` e `threadIndex`; listagem de threads usa snapshot cached; watcher agenda rebuild e há fallback throttled para revalidar quando a UI consulta a lista.
- MCP: adicionada tool gated `workspace_status` com `bootstrapConfirmed`.
- UI: adicionados badges discretos `Index rebuilding` e `Index degraded`, mantendo a última lista conhecida durante rebuild/degradação.
- Benchmark: `performance/thread-index.benchmark.mjs` agora mede `background rebuild stale read` usando o core real.
- Docs: atualizados `docs/ui-and-daemon.md`, `docs/mcp-tools.md` e `docs/development.md`.

Validação executada:

- `pnpm typecheck`: passou.
- `pnpm test`: 57/57 passaram.
- `pnpm build`: passou.
- Verificação do dist MCP: `workspace_status registered` em `dist/mcp/server.js`.
- `pnpm test:benchmark ./performance/thread-index.benchmark.mjs`: passou; em 10k threads, `background rebuild stale read` ficou em ~49.72ms enquanto `json rebuild 10x` ficou em ~28.27s nesta máquina.

Observação operacional:

- Será necessário reiniciar/reconectar o daemon e o cliente MCP para carregar o novo `/api/status` e a nova tool `workspace_status`, porque o build foi atualizado e clientes MCP costumam cachear schemas.

Aguardando feedback antes de orientar a finalização da thread.

<!-- /marc-message -->
