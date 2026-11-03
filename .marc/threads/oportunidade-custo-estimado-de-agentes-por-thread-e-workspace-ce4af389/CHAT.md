# Oportunidade - Custo estimado de agentes por thread e workspace

Thread: `oportunidade-custo-estimado-de-agentes-por-thread-e-workspace-ce4af389`
Created: `2026-11-03T16:00:57.705Z`

<!-- marc-message
id: msg_4aa6d9bf2e474e5085
threadId: oportunidade-custo-estimado-de-agentes-por-thread-e-workspace-ce4af389
timestamp: 2026-11-03T16:01:30.096Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/proposta-custo-estimado.md
-->

## Oportunidade: custo estimado por thread e workspace

Mostrar na UI o consumo dos agentes por thread e somado na workspace, em tokens e em dólar estimado pela tabela de preços, conferido contra o custo que o cliente informa.

- **Decisão do humano:** visibilidade, sem bloqueio. O dado é derivado e fica no SQLite do daemon, fora do Markdown e do Git.
- **Origem:** medições de custo da F0 em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf.
- **Depende de:** vínculo de sessão da F2, para atribuir o consumo à thread.
- **Aberto:** leitura opcional dos históricos locais dos clientes e formato local do uso no Codex.

Sem plano nem autorização de desenvolvimento.

<!-- /marc-message -->
