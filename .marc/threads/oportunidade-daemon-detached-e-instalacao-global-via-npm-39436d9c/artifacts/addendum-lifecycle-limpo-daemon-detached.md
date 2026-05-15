# Addendum - Lifecycle limpo para daemon detached/global

## Summary

Complementar a oportunidade de daemon detached/global com requisitos de higiene operacional. O objetivo e impedir que o mARC deixe processos antigos, registros obsoletos, watchers ou estado runtime sujo consumindo recursos ou confundindo o ambiente depois que agentes/UI forem fechados ou apos rebuild/restart.

## Diagnostico

Hoje o daemon roda em foreground ou como processo Node comum e nao possui contrato forte de lifecycle. Se uma instancia antiga continuar viva, nada garante que ela morra sozinha, que reflita o build atual, ou que nao continue servindo UI/MCP com codigo antigo. Alem disso, multiplos clientes como Claude e Codex na mesma workspace podem registrar a mesma pasta com IDs diferentes se houver divergencia de path/build/estado legado.

## Key Changes

- Manter `marc daemon` em foreground/debug.
- Implementar lifecycle detached/global: `marc daemon start`, `marc daemon stop`, `marc daemon restart`, `marc daemon status`.
- `start` inicia o daemon somente se nao houver instancia ativa compativel.
- `start` nao mata processo antigo automaticamente.
- `restart` e o replace explicito: executa `stop + start`.
- `stop` encerra a instancia ativa registrada para o mesmo `dataDir`.
- `status` exibe PID, uptime, URL, token path, log path, `dataDir`, fingerprint do build, leases ativas e estado de idle.
- Persistir runtime state em `.marc-daemon/daemon.json`.
- Detectar PID stale e limpar estado morto.
- Detectar daemon vivo com fingerprint diferente e orientar `restart`.
- Adicionar heartbeat/lease para MCPs ativos.
- Considerar UI/SSE aberta e requisicoes recentes como atividade.
- Implementar auto-idle: encerrar daemon apos timeout sem MCP ativo, UI aberta ou atividade recente.
- Deduplicar registry de workspaces por `marcPath` canonico, com fallback por `rootPath` canonico.

## Heartbeat/Lease

Cada MCP registra uma lease no daemon ao iniciar, contendo `clientId`, `agentId`, `workspaceId`, tipo do cliente, `startedAt`, `lastSeenAt` e `expiresAt`.

Enquanto o MCP estiver vivo, ele renova a lease periodicamente. Se o MCP fechar corretamente, pode liberar a lease. Se o terminal ou agente cair abruptamente, a lease expira sozinha.

Regra operacional:

- lease ativa mantem daemon vivo;
- UI/SSE aberta mantem daemon vivo;
- requisicao recente posterga idle shutdown;
- sem lease, sem UI e sem atividade recente, daemon encerra apos timeout.

## Behavior

- Fechar Claude, Codex e UI faz o daemon entrar em idle e encerrar sozinho apos timeout.
- Um rebuild nao atualiza processo antigo em memoria; `status` mostra fingerprint/PID da instancia ativa.
- Se o usuario quiser trocar a instancia antiga pela nova, usa `marc daemon restart`.
- `start` comum apenas sobe se nao houver daemon compativel ativo.
- Dois agentes na mesma workspace compartilham o mesmo daemon e nao duplicam workspace no registry.
- Estado morto em `daemon.json` ou registry deve ser limpo automaticamente quando detectado.

## Test Plan

- Testar `daemon start`, `daemon stop`, `daemon restart` e `daemon status`.
- Testar `start` com daemon ja ativo compativel.
- Testar daemon ativo com fingerprint diferente.
- Testar PID stale em `daemon.json`.
- Testar heartbeat MCP mantendo daemon vivo.
- Testar expiracao de lease apos fechamento abrupto.
- Testar UI/SSE mantendo daemon vivo.
- Testar auto-idle encerrando daemon sem uso.
- Testar dedupe de workspace para Claude/Codex na mesma `.marc`.
- Rodar `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Validar fluxo global com `pnpm pack` e instalacao local/global.

## Assumptions

- Esta evolucao complementa a thread existente, nao cria uma nova.
- Nao havera `auto-replace` implicito no `start`.
- `restart` e o mecanismo explicito para substituir instancia antiga.
- Auto-idle e uma protecao contra recurso ocioso, nao substitui `stop`.
- O daemon ativo e identificado por `dataDir` e runtime state.
- Workspace identity operacional usa path canonico, nao apenas `workspace.id`.
