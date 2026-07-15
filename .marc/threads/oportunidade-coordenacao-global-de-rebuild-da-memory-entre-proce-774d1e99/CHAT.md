# Oportunidade - Coordenacao global de rebuild da memory entre processos

Thread: `oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99`
Created: `2026-07-14T17:22:45.347Z`

<!-- marc-message
id: msg_1e4387b136fa4f91bd
threadId: oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99
timestamp: 2026-07-14T17:23:41.309Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-coordenacao-global-rebuild-memory.md
-->

Oportunidade registrada.

- Problema: rebuilds de UI, MCP e CLI nao compartilham a mesma coordenacao.
- Objetivo: um unico rebuild ativo por workspace e status rebuilding visivel para todas as origens.
- Direcao: lock compartilhado como exclusao mutua e estado derivado, sem camada visual paralela.
- Detalhes: artifacts/proposta-coordenacao-global-rebuild-memory.md.

Origem: marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b202e9181a74a0db9
threadId: oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99
timestamp: 2026-07-15T02:11:21.222Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-coordenacao-global-rebuild-memory.md
-->

Plano de desenvolvimento registrado antes da implementacao.

- Diagnostico: a falha e de coordenacao entre processos, nao do indicador visual.
- Decisao: reaproveitar o lock cooperativo em cache com tentativa nao bloqueante, status derivado e monitor SSE apenas com UI conectada.
- Garantia: uma solicitacao concorrente observa rebuilding e nao fica enfileirada para refazer o indice.
- Plano anexado: artifacts/plano-coordenacao-global-rebuild-memory.md.

Implementacao ainda nao iniciada; suspensa por solicitacao do usuario.

<!-- /marc-message -->

<!-- marc-message
id: msg_24c73e631334423aba
threadId: oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99
timestamp: 2026-07-15T03:28:08.421Z
agentId: codex-dev
role: developer
artifacts: artifacts/resultado-coordenacao-global-rebuild-memory.md
-->

Desenvolvimento concluido e resultado registrado.

- Implementado lock global por workspace para rebuild da memory entre daemon, UI, MCP e CLI.
- Chamadas concorrentes agora observam `rebuilding` em vez de iniciar outro rebuild ou ficar enfileiradas.
- O daemon emite `workspace-changed` em transicoes do lock enquanto houver cliente SSE conectado, reaproveitando o status existente da UI.
- Documentacao atualizada em `docs/memory.md`.
- Validacao executada: `pnpm run validate`, `pnpm test` e `pnpm build` passaram.
- Resultado detalhado: artifacts/resultado-coordenacao-global-rebuild-memory.md.

Observacao operacional: para validar na UI e nas tools MCP carregadas em sessao, e necessario reiniciar o daemon e reconectar/reiniciar o cliente MCP.

Aguardando seu feedback para orientar a finalizacao da thread.

<!-- /marc-message -->
