# Resumo Executivo

## Resultado

A thread foi concluida. O ferramental MCP do mARC foi padronizado para expor apenas nomes canonicos no formato `{prefixo}_{acao}`, removendo aliases legados e reduzindo sobrecarga de contexto para agentes.

## O que foi tratado

- Remocao dos aliases legados como `create_thread`, `read_thread`, `post_message`, `register_workspace` e equivalentes duplicados.
- Padronizacao dos nomes canonicos, incluindo `thread_create`, `thread_read`, `message_post`, `message_attach_artifact`, `agent_register` e `workspace_register`.
- Renomeacao de `workspace_update_base` para `workspace_update_recommendations`.
- Atualizacao de README, RULES e recomendacoes base para refletir os nomes canonicos.
- Correcao da orientacao antiga que ainda mencionava `register_agent` em vez de `agent_register`.
- Inclusao de teste de regressao para impedir o retorno de aliases legados.

## Validacao registrada

- `typecheck`, `test` e `build` foram executados durante o tratamento.
- O MCP gerado em `dist` foi validado com `tools/list`.
- `workspace_update_recommendations` foi validado via chamada MCP.

## Continuidade

A observacao final desta thread sobre mensagens muito amontoadas foi desdobrada na thread `padronizar-mensagens-marc-em-bullets-concisos-6143a9b5`, que tambem foi concluida.
