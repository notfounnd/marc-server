# Remover comandos legados do MCP - Reduzir sobrecarga de contexto

Thread: `remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf`
Created: `2026-04-30T04:37:38.181Z`

<!-- marc-message
id: msg_6c62e0ac72ca414c98
threadId: remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
timestamp: 2026-04-30T04:42:38.220Z
agentId: ui-user
role: user
-->

Aqui estão todas as ferramentas disponíveis do mARC no momento que eu pedi para registrar essa thread.

Isso já ajuda a avaliar se realmente está disponível tudo que deveria estar.

Não é para manter duplicado, apenas o padrão {prefixo}_{ação}. Exemplo:

- thread_create
- thread_read
- message_post
- workspace_register

### Gerenciamento de Threads
- **`mcp_mcp-marc_create_thread`** — Criar uma nova thread no workspace
- **`mcp_mcp-marc_thread_create`** — Criar uma nova thread (alias)
- **`mcp_mcp-marc_list_threads`** — Listar todas as threads do workspace
- **`mcp_mcp-marc_thread_list`** — Listar threads (alias)
- **`mcp_mcp-marc_read_thread`** — Ler transcrição e mensagens analisadas de uma thread
- **`mcp_mcp-marc_thread_read`** — Ler thread (alias)

### Mensagens
- **`mcp_mcp-marc_post_message`** — Anexar mensagem estruturada em Markdown a uma thread
- **`mcp_mcp-marc_message_post`** — Postar mensagem (alias)

### Artefatos
- **`mcp_mcp-marc_attach_artifact`** — Escrever um artefato em uma pasta de thread e retornar link relativo
- **`mcp_mcp-marc_message_attach_artifact`** — Anexar artefato (alias)

### Workspace
- **`mcp_mcp-marc_register_workspace`** — Inicializar .marc no projeto e registrar com o daemon
- **`mcp_mcp-marc_workspace_register`** — Registrar workspace (alias)

<!-- /marc-message -->

<!-- marc-message
id: msg_a79582ff0c6942cda6
threadId: remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
timestamp: 2026-04-30T04:48:02.880Z
agentId: ui-user
role: user
-->

Uma segunda lista que o agente forneceu. Ta bem bagunçada a coisa.

### Workspace
- **`workspace_register` / `register_workspace`** — Inicializar .marc no projeto e registrar com o daemon
- **`workspace_update_base` / `update_workspace_base`** — Atualizar arquivos base do workspace com as últimas recomendações
- **`workspace_unregister` / `unregister_workspace`** — Remover workspace do daemon registry sem deletar arquivos locais
- **`workspace_info`** — Retornar informações do workspace vinculado ao processo MCP
- **`workspace_read_rules` / `read_rules`** — Ler o arquivo RULES.md do workspace

### Agentes
- **`agent_register` / `register_agent`** — Registrar um perfil de agente antes de postar mensagens
- **`agent_read_profile` / `read_agent_profile`** — Ler um perfil de agente registrado

### Threads
- **`thread_create` / `create_thread`** — Criar uma nova thread no workspace
- **`thread_list` / `list_threads`** — Listar todas as threads
- **`thread_read` / `read_thread`** — Ler transcrição e mensagens analisadas de uma thread

### Mensagens e Artefatos
- **`message_post` / `post_message`** — Anexar mensagem em Markdown estruturada a uma thread
- **`message_attach_artifact` / `attach_artifact`** — Escrever um artefato em uma pasta de thread

<!-- /marc-message -->

<!-- marc-message
id: msg_860c0c361f1c49c992
threadId: remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
timestamp: 2026-04-30T05:07:19.910Z
agentId: ui-user
role: user
-->

Em rules isso tem sinergia com o tema e ta ficando errado:

Agents should register through `register_agent` before posting.

<!-- /marc-message -->

<!-- marc-message
id: msg_7a10d17d338541ea8f
threadId: remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
timestamp: 2026-04-30T07:15:49.758Z
agentId: codex-dev
role: developer
-->

Tratado. Removi aliases legados do MCP e deixei apenas ferramentas no padrão `{prefixo}_{acao}`. Renomeei `workspace_update_base` para `workspace_update_recommendations`, atualizei README/RULES/base recommendations, regenerei `dist`, validei typecheck/test/build e subi um processo MCP novo via stdio para confirmar `tools/list` e `tools/call workspace_update_recommendations`. A lista final exposta ficou: `agent_read_profile`, `agent_register`, `message_attach_artifact`, `message_post`, `thread_create`, `thread_list`, `thread_read`, `workspace_info`, `workspace_read_rules`, `workspace_register`, `workspace_unregister`, `workspace_update_recommendations`. Também adicionei teste de regressão para impedir retorno dos aliases.

<!-- /marc-message -->

<!-- marc-message
id: msg_1f8f4eb282ee4ac5b7
threadId: remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
timestamp: 2026-04-30T07:20:45.092Z
agentId: ui-user
role: user
-->

O padrão de mensagens estão muito amontoado. Quando eu pedi que fosse mais limpo e conciso, eu me referi a não fazer mensagens gigantes. Talvez usar estrutura sumarizando em bullets seja o que faltou em minha explicação.

A primeira mensagem dessa thread é um bom exemplo do padrão que gostaria de exemplificar e não consegui.

Abra uma nova thread para tratar isso.

<!-- /marc-message -->
