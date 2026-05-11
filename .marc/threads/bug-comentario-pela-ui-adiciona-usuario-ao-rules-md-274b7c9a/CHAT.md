# Bug: comentario pela UI adiciona usuario ao RULES.md

Thread: `bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a`
Created: `2026-05-11T05:16:39.532Z`

<!-- marc-message
id: msg_7bf91bc9a5e84decb0
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T05:17:05.107Z
agentId: codex-dev
role: developer
-->

## Bug report

Origem: `marc://$oportunidade-organizar-agentes-registrados-no-rules-md-734062bc`

## Comportamento observado

- Um comentario feito pela UI resultou na adicao do usuario ao `RULES.md`.
- Esse efeito colateral nao era esperado para uma acao de comentario.

## Comportamento esperado

- Comentarios pela UI devem registrar apenas a mensagem/comentario na thread correspondente.
- `RULES.md` deve ser alterado somente por fluxos explicitos de manutencao de regras/recomendacoes do workspace, nao por comentario comum.

## Risco

- Polui o contrato do workspace com participantes/eventos de UI.
- Pode causar churn indevido em `RULES.md` e misturar metadados de conversa com regras persistentes.

## Proximo passo sugerido

- Investigar o handler de comentarios da UI e separar persistencia de mensagem/thread de qualquer rotina que atualize `RULES.md` ou agentes registrados.

<!-- /marc-message -->

<!-- marc-message
id: msg_88dd6123a105459dbc
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T05:27:01.439Z
agentId: ui-user
role: user
-->

Se não foi isso que descrevi, alguma coisa fez append lá para o final do arquivo RULES.md e adicionou ui-user.

Ficou assim no final:

```
### Flow Rules

- Before finalizing development, review project documentation and update or expand it when a need is identified.
- When the user asks to close a UI implementation thread, review `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` and update its Playwright backlog when needed.
- [ui-user](agents/ui-user.md) - ui-user
```

<!-- /marc-message -->

<!-- marc-message
id: msg_2fb594fa286e401884
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T06:03:24.384Z
agentId: ui-user
role: user
-->

Tem alguma coisa que tá mudando o conteúdo de forma inconsistente no `RULES.md`.

Versão que to agora ta assim (mesma sessão do comentário marc://#msg_88dd6123a105459dbc)

```
## Context Reading

- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.
- Prefer `thread_read_since` with the stored cursor when checking for new messages.
- If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.

### Flow Rules

- Before finalizing development, review project documentation and update or expand it when a need is identified.
- When the user asks to close a UI implementation thread, review `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` and update its Playwright backlog when needed.

## Custom Rules

<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->
<!-- Use ### or deeper headings to organize project-specific rules in this section. -->
<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->
```

<!-- /marc-message -->

<!-- marc-message
id: msg_655097c0343846aa87
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T22:35:06.062Z
agentId: ui-user
role: user
-->

Tive a impressão que a chamada do bootstrap parece que ta gerando o problema de sobreescrever o `RULES.md` de maneira inconsistente, mas não tenho certeza.

<!-- /marc-message -->
