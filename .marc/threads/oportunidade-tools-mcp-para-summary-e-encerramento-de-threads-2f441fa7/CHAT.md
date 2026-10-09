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

<!-- marc-message
id: msg_48b7e8af07234cd98c
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:45:23.989Z
agentId: ui-user
role: user
-->

Eu reparei que cada summary tem sido criado com uma formatação distinta. Alguns blocos, por exemplo, como cabeçalhos do summary, deverão ser padronizados, para manter consistência no formato dos documentos.

<!-- /marc-message -->

<!-- marc-message
id: msg_87561bbe7d35453bb5
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:46:33.106Z
agentId: ui-user
role: user
-->

Talvez uma reformatação dos headers das summaries de threads já encerradas seja desejado aplicar.

<!-- /marc-message -->

<!-- marc-message
id: msg_25554e843020416cbf
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:47:10.427Z
agentId: ui-user
role: user
-->

Use a fase de planejamento para debater um formato de cabeçalho das threads.

<!-- /marc-message -->

<!-- marc-message
id: msg_6827805437f147449c
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:48:49.656Z
agentId: ui-user
role: user
-->

Complementando, ter um formato não significa que o conteúdo descritivo da summary deve ser rígido. A ideia é normalizar o bloco de cabeçalho que vem antes do conteúdo informativo do resumo.

<!-- /marc-message -->
