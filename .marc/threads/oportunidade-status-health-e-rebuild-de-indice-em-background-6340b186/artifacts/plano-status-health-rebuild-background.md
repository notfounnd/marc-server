# Plano: Status/Health e Rebuild de Indice em Background

## Summary

Implementar a thread `oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186` sem mudar a consistencia padrao do MCP: `thread_list` continua fresh, enquanto daemon/UI passam a usar stale-while-revalidate para nao bloquear quando `thread-index.json` estiver sendo reconstruido.

## Key Changes

- Criar estado de indice por workspace/cache:
  - `ready`, `rebuilding`, `degraded`, `unavailable`;
  - `rebuilding`, `lastRebuildAt`, `lastError`, `threadCount`;
  - deduplicar rebuilds concorrentes;
  - preservar snapshot anterior quando rebuild falhar.
- Manter `listThreads()` como leitura fresh por padrao.
- Adicionar caminho cached/background para o daemon usar em:
  - `GET /api/workspaces/:workspaceId/threads`;
  - `GET /api/workspaces/:workspaceId/threads?status=closed`.
- Expandir `GET /api/status` mantendo `ok: boolean` e adicionando modulos:
  - `daemon`;
  - `workspaceRegistry`;
  - `threadIndex`.
- Adicionar tool MCP gated `workspace_status`, usando `bootstrapConfirmed: true`, para retornar health do workspace atual.
- Integrar watcher/SSE:
  - mudancas relevantes em `.marc/threads` agendam rebuild;
  - gravacoes em `.marc/cache/thread-index.json` nao criam loop;
  - conclusao do rebuild dispara evento para refresh da UI.
- Atualizar UI:
  - manter lista anterior durante `rebuilding` ou `degraded`;
  - mostrar badge discreto `Index rebuilding` ou `Index degraded`;
  - atualizar lista automaticamente ao receber evento.
- Atualizar `performance/thread-index.benchmark.mjs`:
  - manter cenarios atuais como baseline;
  - adicionar cenario `background rebuild + stale read`;
  - medir latencia percebida da listagem durante rebuild separada da duracao total do rebuild.
- Atualizar docs:
  - `docs/ui-and-daemon.md`;
  - `docs/mcp-tools.md`;
  - `docs/development.md`, se a validacao/performance precisar ser documentada.

## Test Plan

- Core:
  - snapshot anterior e retornado durante rebuild em background;
  - rebuild concorrente e deduplicado;
  - falha de rebuild mantem snapshot anterior e marca `degraded`;
  - ausencia de snapshot preserva leitura fresh/sincrona.
- Daemon:
  - `/api/status` retorna modulos esperados;
  - rota de threads responde com snapshot durante rebuild;
  - falha de rebuild mantem dados anteriores quando disponiveis;
  - evento SSE e emitido apos rebuild finalizar.
- MCP:
  - `workspace_status` aparece em `_registeredTools`;
  - exige bootstrap;
  - retorna `modules.threadIndex`.
- UI/i18n:
  - novas strings visiveis existem no catalogo en-US;
  - contratos tecnicos continuam fora da localizacao.
- Performance:
  - benchmark mostra baseline antigo;
  - benchmark reporta latencia de stale read durante rebuild.
- Validacao final:
  - `pnpm typecheck`;
  - `pnpm test`;
  - `pnpm build`;
  - confirmar `workspace_status` no build final.

## Assumptions

- A prioridade e evitar bloqueio da UI, nao tornar `thread_list` eventualmente consistente no MCP.
- `workspace_status` e a interface MCP publica escolhida.
- `/api/status` sera expandido; nao sera criado `/api/health` nesta etapa.
- Ao fim do desenvolvimento, sera postado comentario na thread com mudancas, validacao, riscos e proximos passos, aguardando feedback antes de finalizar a thread.
