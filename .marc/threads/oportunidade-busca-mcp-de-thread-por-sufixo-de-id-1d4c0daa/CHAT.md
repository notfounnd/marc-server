# Oportunidade - Busca MCP de thread por sufixo de ID

Thread: `oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa`
Created: `2026-07-20T23:00:11.166Z`

<!-- marc-message
id: msg_7976bee871e94049bd
threadId: oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa
timestamp: 2026-07-20T23:00:49.444Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para permitir consultas MCP de thread pelo sufixo curto do ID, como `3e422682`.

Escopo inicial:
- aceitar o ID canonico completo ou um sufixo curto em ferramentas de leitura de thread;
- resolver o sufixo somente quando houver uma correspondencia unica no workspace;
- retornar erro claro para sufixo ausente ou ambiguo;
- preservar IDs, caminhos e referencias `marc://` canonicos nas respostas e na persistencia;
- documentar o contrato e cobrir resolucao, ambiguidade e compatibilidade com chamadas existentes.

A melhoria reduz atrito de consulta sem alterar a identidade canonica ou a organizacao das threads.

<!-- /marc-message -->
