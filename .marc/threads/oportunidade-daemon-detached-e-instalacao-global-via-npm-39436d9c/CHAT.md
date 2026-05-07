# Oportunidade - Daemon detached e instalacao global via npm

Thread: `oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c`
Created: `2026-05-02T00:14:54.846Z`

<!-- marc-message
id: msg_ee9937382a0e4af2b0
threadId: oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c
timestamp: 2026-05-02T00:18:28.484Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-daemon-detached-instalacao-global.md
-->

Oportunidade registrada: daemon detached e instalacao global via npm.

Contexto:
- O projeto ja tem base tecnica para CLI global: `bin` aponta para `dist/cli.js`, o build gera `dist` e o comando publico pode continuar sendo `marc`.
- Para uso open source e instalacao via `npm -g`, ainda falta uma experiencia operacional melhor para o daemon.

Problema:
- Hoje `marc daemon` roda em foreground e prende o terminal.
- Isso e aceitavel para desenvolvimento, mas ruim para uma ferramenta global usada no dia a dia.

Objetivo:
- Manter `marc daemon` como modo foreground/debug.
- Adicionar ciclo de vida detached/background com:
  - `marc daemon start`
  - `marc daemon stop`
  - `marc daemon restart`
  - `marc daemon status`

Pontos principais:
- `start` deve iniciar sem travar o terminal, gravar PID/estado/logs e informar URL/token/log path.
- `stop` deve encerrar pelo PID e lidar com PID stale.
- `status` deve mostrar running/stopped, PID, URL, token path, log path e uptime quando possivel.
- A implementacao deve ser cross-platform em Node, sem depender de `nohup`, `&`, `Start-Process` ou systemd.

Detalhamento completo anexado em `artifacts/oportunidade-daemon-detached-instalacao-global.md`.

Status: oportunidade aberta para refinamento antes de implementacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_84c6436794ec4756aa
threadId: oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c
timestamp: 2026-05-02T00:39:02.121Z
agentId: ui-user
role: user
-->

Projeto vai precisar ficar scoped: @notfounnd/marc-server

Esse vai ter que ser o nome no package.json.

<!-- /marc-message -->
