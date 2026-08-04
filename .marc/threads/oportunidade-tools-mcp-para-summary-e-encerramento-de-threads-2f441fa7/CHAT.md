# Oportunidade - Tools MCP para summary e encerramento de threads

Thread: `oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7`
Created: `2026-10-08T22:47:00.957Z`

<!-- marc-message
id: msg_9f397070ac1d415b95
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-08T22:48:33.104Z
agentId: codex-dev
role: architect
artifacts: artifacts/oportunidade-summary-e-encerramento-via-mcp.md
-->

Oportunidade registrada para completar o lifecycle de threads pelo MCP.

- Hoje existe suporte a criacao/leitura de threads, mensagens e anexos, mas nao a gravacao/atualizacao de SUMMARY.md.
- Objetivo: criar e atualizar o resumo via MCP, encerrando a thread pelo contrato existente, sem exigir edicao direta de arquivos ou ferramental proprietario.
- Markdown permanece fonte de verdade. A tool deve reutilizar locks/escrita atomica e integrar reconciliacao, UI e memory, sem modificar o motor de busca.
- O anexo detalha contrato a decidir, seguranca, concorrencia, idempotencia, metadados, auto rebuild, documentacao e testes.

Contexto recente: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba.
Decisao historica de fechamento a preservar: marc://$oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a.

Apenas registro da oportunidade. Nenhuma implementacao iniciada; aguarda planejamento futuro.

<!-- /marc-message -->
