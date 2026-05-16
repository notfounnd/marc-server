# Resumo executivo

Thread: `oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c`
Closed: `2026-05-16T04:58:26.485Z`

## Objetivo

Resolver a oportunidade de ciclo de vida do daemon para evitar múltiplas instâncias soltas, melhorar o fluxo de uso detached/global e dar aos agentes uma forma confiável de se conectar à mesma instância da workspace.

## Resultado

A oportunidade foi tratada com implementação do ciclo de vida detached do daemon e validação operacional entre agentes:

- `marc daemon start`, `stop`, `restart` e `status` foram adicionados para operação detached.
- `marc daemon` e `pnpm dev:daemon` continuam funcionando como foreground/debug.
- O daemon detached registra estado em `.marc-daemon/daemon.json` e log em `.marc-daemon/daemon.log`.
- `start` ficou idempotente quando a instância viva corresponde ao fingerprint esperado.
- `stop` e `restart` fazem o encerramento explícito da instância registrada.
- O daemon passou a expor leases para clientes MCP e usa esses sinais para controlar atividade.
- O modo detached passou a suportar auto-idle quando não há leases, conexões UI/SSE ou atividade recente.
- A store passou a deduplicar workspaces por caminhos canônicos.
- `marc daemon status` passou a consultar `/api/status` quando não existe estado detached, permitindo detectar daemon foreground vivo.
- README e `docs/ui-and-daemon.md` foram atualizados com o comportamento novo.

## Decisões

- Processo antigo com fingerprint diferente não é encerrado automaticamente por `status` ou `start`.
- Substituição de instância é ação explícita via `stop` ou `restart`.
- O fluxo preserva foreground para desenvolvimento e detached para uso operacional.
- Leases são tratados como sinal de presença dos MCPs, não como mecanismo de consumo de tokens.
- A validação prática entre agentes deve confirmar se todos apontam para a mesma URL, workspace e daemon.
- `daemon status` precisa ser útil também no foreground, mesmo sem `daemon.json`.

## Testes e validação

Validações registradas durante a thread:

- `pnpm typecheck`: OK.
- `pnpm test`: 63 testes pass.
- `pnpm build`: OK.
- Smoke de `pnpm dev:daemon`: foreground iniciou corretamente.
- Smoke de `node dist/cli.js daemon status`: foreground vivo retornou `status: running` e `source: api`.
- Validação operacional com Claude e Codex confirmou um único daemon em `127.0.0.1:4187`.
- Após rebuild/restart, os MCPs ativos foram observados conectados ao mesmo daemon e workspace `marc-dd422176e1`.

## Documentação e continuidade

A documentação necessária para esta oportunidade foi atualizada durante o desenvolvimento:

- `README.md` descreve o fluxo foreground, detached, token, status e troubleshooting principal.
- `docs/ui-and-daemon.md` descreve comandos de lifecycle, estado detached, leases, auto-idle e fallback de status via API.

Não foi identificada necessidade obrigatória de nova documentação para encerrar a thread. Uma eventual melhoria futura pode ser um runbook curto de validação pós-rebuild/restart em documentação de desenvolvimento.

## Estado final

A oportunidade foi concluída e encerrada. O comportamento principal foi implementado, testado, documentado e validado operacionalmente com mais de um agente conectado à mesma workspace.
