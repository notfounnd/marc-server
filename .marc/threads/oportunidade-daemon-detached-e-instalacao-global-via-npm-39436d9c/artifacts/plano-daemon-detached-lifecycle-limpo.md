# Plano - Daemon Detached, Lifecycle Limpo e Instalacao Global

## Summary

Implementar a evolucao da thread `39436d9c` em duas etapas obrigatorias: primeiro registrar este plano como artefato na thread; depois desenvolver o lifecycle do daemon.

O `package.json` ja esta correto com `name: "@notfounnd/marc-server"` e `bin.marc = "./dist/cli.js"`, entao nao ha alteracao de nome prevista.

## Key Changes

- Preservar `marc daemon` como modo foreground/debug.
- Adicionar comandos:
  - `marc daemon start`
  - `marc daemon stop`
  - `marc daemon restart`
  - `marc daemon status`
- Criar runtime state em `.marc-daemon/daemon.json` com `pid`, `startedAt`, `host`, `port`, `url`, `dataDir`, `tokenPath`, `logPath`, `fingerprint`, `mode`, `lastActivityAt` e leases ativas.
- `start` nao faz auto-replace implicito:
  - se ja houver daemon vivo com mesmo fingerprint, retorna status e nao duplica processo;
  - se houver PID stale, limpa estado e inicia;
  - se houver daemon vivo com fingerprint diferente, falha com diagnostico e orienta `restart`.
- `restart` sera o replace explicito: `stop + start`.
- `stop` usa PID/runtime state do mesmo `dataDir`, aguarda encerramento, limpa estado morto e falha claramente se nao conseguir encerrar.
- `status` mostra running/stopped/stale, PID, uptime, URL, token path, log path, `dataDir`, fingerprint atual vs registrado, leases e estado de idle.
- Daemon novo detached sempre e elegivel a auto-idle: se ficar sem uso ativo, ele se encerra sozinho pelo watchdog interno.

## Implementation Changes

- CLI:
  - refatorar `src/cli.ts` para reconhecer subcomando opcional depois de `daemon`;
  - manter `marc daemon` chamando `runDaemon(config)` foreground;
  - adicionar handlers lifecycle em novo modulo `src/daemon/lifecycle.ts`.

- Daemon server:
  - permitir que `runDaemon` registre/remova runtime state ao iniciar/fechar;
  - adicionar tracking de atividade HTTP/SSE;
  - adicionar endpoints autenticados para lease:
    - `PUT /api/leases/:clientId` cria/renova lease MCP;
    - `DELETE /api/leases/:clientId` remove lease;
  - incluir lifecycle/lease/idle em `/api/status`.

- MCP:
  - quando `daemonUrl` e token existirem, gerar `clientId` por processo;
  - renovar lease periodicamente enquanto o MCP estiver vivo;
  - deixar expirar se o processo morrer sem cleanup.

- Auto-idle:
  - habilitado por padrao para daemon detached novo;
  - default: 30 minutos sem lease MCP valida, sem SSE/UI conectada e sem atividade HTTP relevante;
  - configuravel por `--auto-idle-ms` e `MARC_DAEMON_AUTO_IDLE_MS`;
  - foreground nao auto-encerra por padrao;
  - `status/start` nao matam por comando, mas o watchdog interno do daemon detached pode encerrar o proprio processo quando o timeout de idle e atingido.

- Registry:
  - deduplicar workspaces por path canonico de `rootPath`/`marcPath`;
  - em Windows, comparacao case-insensitive;
  - se Claude e Codex registrarem a mesma workspace com IDs diferentes, manter o registro mais recente/correto e remover duplicata no JSON e SQLite.

- Docs:
  - atualizar `README.md` e `docs/ui-and-daemon.md` com comandos detached;
  - atualizar troubleshooting com stale PID, fingerprint diferente, auto-idle e uso de `restart`;
  - registrar que o pacote publico e `@notfounnd/marc-server`, mas o comando continua `marc`.

## Test Plan

- Unit/integration:
  - `test/daemon.test.ts`: status inclui lifecycle/lease/idle sem quebrar shape atual;
  - novo teste de store: `upsertWorkspace` deduplica por path canonico;
  - novo teste de lease: lease cria, renova, expira e bloqueia auto-idle enquanto ativa;
  - novo teste de auto-idle: daemon detached sem lease, sem SSE e sem atividade recente chama shutdown;
  - novo teste de lifecycle helpers: PID stale e limpo, PID vivo e detectado, fingerprint mismatch gera diagnostico.

- CLI integration:
  - iniciar daemon detached em `dataDir` temporario;
  - validar `status` running;
  - validar `start` idempotente com mesmo fingerprint;
  - validar `stop`;
  - validar `restart`;
  - validar que logs e `daemon.json` sao criados no `dataDir`.

- Verification:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - smoke manual: `node dist/cli.js daemon start --data-dir <tmp>`, `status`, `stop`.

## mARC Thread Protocol

- Antes de alterar codigo, registrar este plano como artefato na thread `oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c`.
- Postar mensagem curta na thread apontando para o artefato e informando que o desenvolvimento sera iniciado a partir dele.
- Ao final, postar comentario na thread com:
  - arquivos/subsistemas alterados;
  - comportamento implementado;
  - validacoes executadas;
  - riscos ou pendencias;
  - pedido explicito de feedback antes de orientar fechamento.

## Assumptions

- Nenhum auto-replace implicito em `start`.
- `restart` e o unico fluxo de replace.
- Auto-idle deve reduzir consumo de infra sem matar foreground/debug.
- Para daemon novo detached, processo perdido/inativo deve se auto-finalizar pelo watchdog.
- Processo vivo com fingerprint diferente nao e morto por `status` ou `start`; apenas `stop/restart` executam encerramento por comando explicito.
