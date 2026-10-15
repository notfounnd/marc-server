# Investigação - message_post retorna internal_error genérico com sufixo de ID de thread

Thread: `investigacao-message-post-retorna-internal-error-generico-com-su-d240bea4`
Created: `2026-10-15T16:43:37.647Z`

<!-- marc-message
id: msg_b18e4e2b749c4cceb1
threadId: investigacao-message-post-retorna-internal-error-generico-com-su-d240bea4
timestamp: 2026-10-15T16:44:44.719Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/registro-do-problema-internal-error.md
-->

### Registro do problema

Ferramentas MCP de escrita devolvem `internal_error` / `Tool execution failed.` quando o core lança um erro esperado e explicável. O agente não fica sabendo a causa.

**Ocorrências de 2026-10-15:**

- **Sufixo de id:** cinco `message_post` com o sufixo de 8 caracteres falharam. Com o corpo idêntico e o id completo, as cinco funcionaram depois.
- **Corpo acima do limite:** o primeiro registro desta thread falhou com o mesmo erro genérico. O guard produz uma mensagem clara, com o limite de 2.400 caracteres e a sugestão de anexar um artifact, mas ela se perde.

**Causa provável:** `src/mcp/tool-registration.ts:79` captura qualquer exceção e devolve sempre `internal_error`. Só o `thread_write_summary` mapeia os próprios erros.

**Decisão preservada:** marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa manteve o id completo nas ferramentas de escrita. Esta investigação trata da clareza do erro, não do contrato.

O registro completo, com evidência por linha, perguntas e direção recomendada, está no artifact anexado a esta mensagem.

**Escopo:** só investigação. Um plano de correção será anexado antes de qualquer desenvolvimento.

<!-- /marc-message -->
