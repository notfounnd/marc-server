# Padronizar mensagens mARC em bullets concisos

Thread: `padronizar-mensagens-marc-em-bullets-concisos-6143a9b5`
Created: `2026-04-30T07:21:57.223Z`

<!-- marc-message
id: msg_2e50d415364d4cca93
threadId: padronizar-mensagens-marc-em-bullets-concisos-6143a9b5
timestamp: 2026-04-30T07:22:05.684Z
agentId: codex-dev
role: developer
-->

Contexto inicial:

- Origem: `remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf`.
- Problema: mensagens ficaram concisas, mas ainda muito amontoadas quando resumem muitos itens em um parágrafo.
- Preferência: usar estrutura limpa em bullets para sumarizar escopo, achados, ações e validação.
- Referência: a primeira mensagem da thread original, com blocos por categoria e bullets curtos.
- Objetivo: ajustar recomendações/RULES/guards para orientar agentes a evitar mensagens gigantes e preferir listas legíveis quando houver vários pontos.

<!-- /marc-message -->

<!-- marc-message
id: msg_b8e3f5fbe0694e309e
threadId: padronizar-mensagens-marc-em-bullets-concisos-6143a9b5
timestamp: 2026-05-01T23:54:12.705Z
agentId: ui-user
role: user
-->

Aqui vale mencionar que o foco é ter algo mais amplo, sem perder a qualidade e valor da informação, focando em fazer que todas as mensagens tenha melhor apresentação/formatação, para facilitar a leitura, e que elas não sejam simplesmente breves, com conteúdo vazio ou incompleto.

<!-- /marc-message -->

<!-- marc-message
id: msg_ec9c89fe27de4d03aa
threadId: padronizar-mensagens-marc-em-bullets-concisos-6143a9b5
timestamp: 2026-05-02T01:04:44.461Z
agentId: codex-dev
role: developer
-->

Implementacao realizada:

- Atualizei o guia central de estilo de mensagens para priorizar mensagens uteis, legiveis e completas.
- Orientei o uso de bullets ou secoes curtas quando a mensagem tiver varios pontos, sem remover contexto importante apenas para encurtar.
- Ajustei `initWorkspace`, `workspace_update_recommendations` e `marc_helper` para refletirem o novo padrao.
- Corrigi `ensureSectionLines` para substituir secoes recomendadas existentes, evitando anexar linhas novas na secao errada.
- Apliquei `workspace_update_recommendations` neste workspace e removi a sobra antiga em `.marc/RULES.md`.

Validacao:

- `pnpm test`: 19 testes passando.
- `pnpm typecheck`: sem erros.
- `pnpm build`: concluido.
- Dist MCP validado com `marc_helper` e `workspace_update_recommendations` registrados.

A thread ainda nao foi encerrada; aguardando feedback para orientar a finalizacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_debf3548ef864ed180
threadId: padronizar-mensagens-marc-em-bullets-concisos-6143a9b5
timestamp: 2026-05-02T20:06:31.207Z
agentId: codex-dev
role: developer
-->

Complemento implementado:

- Oficializei o bloco `## Custom Rules` em `RULES.md`.
- O bloco fica no final do arquivo e recebe o comentario:
  `<!-- Construa as regras customizadas deste projeto abaixo desta linha. Mantenha este bloco no final do arquivo. -->`
- `workspace_update_recommendations` agora cria esse bloco quando ele nao existe, move/preserva o bloco no final e mantem regras customizadas escritas abaixo do comentario.
- Adicionei a regra fixa `Run workspace_update_recommendations before starting work on a thread` em `RULES.md` e `INSTRUCTIONS.md`, via secao `## Workspace Maintenance`.
- Atualizei `marc_helper` para orientar agentes a chamar `workspace_update_recommendations` antes de comecar trabalho em uma thread.

Validacao:

- `pnpm test`: 20 testes passando.
- `pnpm typecheck`: sem erros.
- `pnpm build`: concluido.
- `workspace_update_recommendations` aplicado no workspace real e reexecutado com resultado idempotente.
- Dist MCP validado com `marc_helper` e `workspace_update_recommendations` registrados.

A thread permanece aberta aguardando feedback para finalizacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_4b5071aa5b734e8d81
threadId: padronizar-mensagens-marc-em-bullets-concisos-6143a9b5
timestamp: 2026-05-02T20:19:26.952Z
agentId: codex-dev
role: developer
-->

Ajuste aplicado:

- Troquei o comentario fixo de `## Custom Rules` para ingles:
  `<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->`
- Mantive a implementacao sem compat/guard para o comentario anterior, porque o recurso ainda esta em desenvolvimento e so este workspace estava usando o texto antigo.
- Limpei o comentario antigo em portugues de `.marc/RULES.md`.

Validacao:

- `workspace_update_recommendations` reexecutado no workspace real com resultado idempotente.
- `pnpm test`: 20 testes passando.
- `pnpm typecheck`: sem erros.

A thread permanece aberta aguardando feedback para finalizacao.

<!-- /marc-message -->
