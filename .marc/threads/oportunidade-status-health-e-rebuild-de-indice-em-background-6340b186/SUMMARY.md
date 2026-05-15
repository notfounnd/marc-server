# Resumo executivo

Thread: `oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186`
Closed: `2026-05-15T17:30:00.000Z`

## Objetivo

Evitar que rebuilds pesados de `thread-index.json` bloqueiem a UI ou surpreendam agentes durante listagens, preservando a fonte da verdade em Markdown e mantendo a experiência funcional enquanto o índice é reconstruído.

## Decisões

- `thread_list` no MCP permanece fresh por padrão, sem adotar consistência eventual nessa ferramenta.
- O daemon/UI usam stale-while-revalidate: servem o último snapshot conhecido e disparam rebuild em background.
- A interface pública de status no MCP foi definida como `workspace_status`.
- `/api/status` foi expandido em vez de criar `/api/health`, preservando `ok: boolean` e adicionando módulos de health.
- O benchmark passou a medir a latência percebida de stale read durante rebuild usando o core real, não uma simulação paralela.

## Implementação

- Core: adicionado `BackgroundThreadIndexReconciler`, tipos de health do índice, leitura cached e rebuild em background por workspace.
- Daemon/API: listagem de threads usa snapshot cached; watcher agenda rebuild; fallback throttled revalida quando a UI consulta listas; `/api/status` expõe `daemon`, `workspaceRegistry` e `threadIndex`.
- MCP: adicionada tool gated `workspace_status` com `bootstrapConfirmed`.
- UI: adicionados badges `Index rebuilding` e `Index degraded`, mantendo a última lista conhecida durante rebuild/degradação.
- Performance: `performance/thread-index.benchmark.mjs` adicionou o cenário `background rebuild stale read`.
- Documentação: atualizados `docs/ui-and-daemon.md`, `docs/mcp-tools.md` e `docs/development.md`.

## Validação

- `pnpm typecheck`: passou.
- `pnpm test`: 57/57 passaram.
- `pnpm build`: passou.
- Verificação do build MCP confirmou `workspace_status registered` em `dist/mcp/server.js`.
- `pnpm test:benchmark ./performance/thread-index.benchmark.mjs`: passou. Em 10k threads nesta máquina, `background rebuild stale read` ficou em aproximadamente 49.72ms, enquanto `json rebuild 10x` ficou em aproximadamente 28.27s.

## Riscos e continuidade

- O daemon e o cliente MCP precisam ser reiniciados/reconectados para carregar o novo build e o schema `workspace_status`, pois clientes MCP podem cachear tools.
- O benchmark valida o core e o acesso ao índice em disco. Latência HTTP/SSE/browser continua sendo uma validação complementar possível, mas não foi necessária para fechar esta evolução.

## Referências

- Plano detalhado: `artifacts/plano-status-health-rebuild-background.md`
- Oportunidade original: `artifacts/oportunidade-status-health-rebuild-background.md`
