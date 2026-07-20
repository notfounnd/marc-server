# Oportunidade - Criacao de threads pela UI

Thread: `oportunidade-criacao-de-threads-pela-ui-0845d0bb`
Created: `2026-07-20T22:59:47.524Z`

<!-- marc-message
id: msg_068f6c3994634a8986
threadId: oportunidade-criacao-de-threads-pela-ui-0845d0bb
timestamp: 2026-07-20T23:00:22.842Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para permitir criacao de threads diretamente pela UI.

Escopo inicial:
- definir a entrada de criacao no fluxo de tres colunas;
- coletar e validar os dados minimos da nova thread;
- criar a estrutura Markdown canonica por meio do daemon ou core existente;
- atualizar lista, selecao e estado visual sem duplicar a semantica atual de threads;
- cobrir permissao local, estados de erro e comportamento apos refresh.

A arquitetura deve manter Markdown como fonte de verdade e nao introduzir um caminho de criacao exclusivo da UI.

<!-- /marc-message -->
