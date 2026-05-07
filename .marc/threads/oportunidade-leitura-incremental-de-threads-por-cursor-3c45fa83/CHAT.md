# Oportunidade - Leitura incremental de threads por cursor

Thread: `oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83`
Created: `2026-04-30T18:22:34.581Z`

<!-- marc-message
id: msg_79b5571150034799ad
threadId: oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83
timestamp: 2026-04-30T18:22:52.642Z
agentId: codex-dev
role: developer
-->

Oportunidade de otimização:

- Problema: `thread_read` retorna a thread inteira, mesmo quando o agente só precisa das mensagens novas.
- Impacto: threads longas passam a consumir muitos tokens de forma repetida.
- Ideia central: leituras de thread devem retornar `lastMessageId`, e o agente deve guardar esse cursor no contexto.
- Fluxo esperado: ao retomar uma thread já lida, o agente chama `thread_read_since({ threadId, afterMessageId })`.
- Resultado esperado: a tool retorna apenas mensagens novas e um novo `lastMessageId`.

Contrato sugerido:

- `thread_read`: leitura completa, com `lastMessageId`.
- `thread_read_since`: leitura incremental após um cursor.
- `thread_info`: leitura barata de metadados como `messageCount`, `lastMessageId` e `updatedAt`.
- `thread_tail`: leitura das últimas N mensagens.

Falha de cursor:

- Se `afterMessageId` não existir ou não pertencer à thread, a tool não deve reler tudo silenciosamente.
- Deve retornar algo como `cursor_not_found` e `shouldReadFullThread: true`.
- O agente deve avisar no chat que a leitura incremental falhou e que vai reler a thread inteira.

Orientação para agentes:

- Tool descriptions e recomendações devem instruir agentes a guardar `lastMessageId`.
- Ao receber aviso de nova mensagem, o agente deve preferir leitura incremental.
- A leitura completa deve ser usada como fallback explícito.

<!-- /marc-message -->

<!-- marc-message
id: msg_e8f3676e424f4024a3
threadId: oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83
timestamp: 2026-04-30T18:30:34.636Z
agentId: codex-dev
role: developer
-->

Complemento de escopo:

- O pacote de otimização deve incluir resumo persistente da thread.
- O resumo pode ser em formato de resumo executivo.
- Esse resumo deve ser obrigatório quando uma thread for encerrada.
- A funcionalidade de encerramento será tratada futuramente.
- O objetivo é permitir que agentes consumam contexto antigo pelo resumo e usem leitura incremental para novidades.

Pacote desejado:

- Quick win: reduzir duplicação de retorno em `thread_read`, evitando `markdown` + `messages[]` por padrão.
- Base: adicionar `lastMessageId` e `thread_read_since`.
- Ergonomia: adicionar `thread_info` e `thread_tail`.
- Escala: manter resumo executivo persistente e considerar `thread_search`.

<!-- /marc-message -->

<!-- marc-message
id: msg_b5d8d56e928e4cff99
threadId: oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83
timestamp: 2026-05-01T21:04:41.224Z
agentId: codex-dev
role: developer
-->

Implementacao realizada e aguardando feedback do usuario para orientar a finalizacao da thread.

O que foi feito:
- `thread_read` agora retorna `messageCount`, `lastMessageId` e `updatedAt`; `markdown` fica omitido por padrao e volta com `includeMarkdown: true`.
- Adicionadas as APIs core e tools MCP `thread_read_since`, `thread_info` e `thread_tail`.
- `thread_read_since` retorna apenas mensagens apos `afterMessageId`; cursor invalido retorna `cursor_not_found`, `shouldReadFullThread: true` e nao devolve a thread inteira silenciosamente.
- Descricoes das tools e `workspace_update_recommendations` agora orientam agentes a guardar `lastMessageId`, preferir leitura incremental e avisar quando precisarem reler a thread inteira.
- UI/daemon foram ajustados para o payload com `markdown`/`messages` opcionais.

Validacoes executadas:
- `pnpm test` passou: 17/17.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Validacao em `dist/mcp/server.js` confirmou `thread_read`, `thread_read_since`, `thread_info` e `thread_tail` com schemas esperados.

Nao criei `SUMMARY.md`; a thread permanece aberta aguardando avaliacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_f85bb44fd4e247098b
threadId: oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83
timestamp: 2026-05-01T23:47:41.015Z
agentId: codex-dev
role: developer
-->

Encerrando a thread com SUMMARY.md.

Resultado final: leitura incremental por cursor implementada, helper de ferramentas relacionado implementado, README atualizado com as novas tools e oportunidades derivadas abertas para arquitetura e documentacao.

<!-- /marc-message -->
