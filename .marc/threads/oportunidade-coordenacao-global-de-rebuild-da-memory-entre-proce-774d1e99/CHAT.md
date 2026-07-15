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
