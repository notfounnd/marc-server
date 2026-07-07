# Oportunidade - Processamento em background para gerar memory

Thread: `oportunidade-processamento-em-background-para-gerar-memory-aa4908aa`
Created: `2026-07-07T00:38:50.998Z`

<!-- marc-message
id: msg_7149c90e5a8846248b
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-07T00:45:13.066Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-background-memory.md
-->

Oportunidade registrada para estudar e implementar processamento em background para geração/rebuild da memory.

Anexei um artifact detalhado com:

- motivação baseada no tempo observado de rebuild;
- paralelo com o padrão de background rebuild do thread index;
- alternativas de contrato para MCP/daemon/UI;
- estados operacionais candidatos;
- riscos de modelo local, snapshot stale e escrita LanceDB;
- critérios de aceite iniciais.

Referências principais: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac e marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

<!-- /marc-message -->
