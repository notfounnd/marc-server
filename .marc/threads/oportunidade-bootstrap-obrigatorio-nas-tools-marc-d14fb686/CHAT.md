# Oportunidade - Bootstrap obrigatório nas tools mARC

Thread: `oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686`
Created: `2026-05-02T21:22:09.540Z`

<!-- marc-message
id: msg_e3e844b791834f4e8c
threadId: oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686
timestamp: 2026-05-02T21:23:28.475Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-bootstrap-obrigatorio.md
-->

Contexto inicial:

- Problema: agentes novos podem chamar tools mARC diretamente sem antes passar por `INSTRUCTIONS.md` e `RULES.md`.
- Risco: leitura ou escrita pode ocorrer sem protocolo do workspace, regras customizadas ou contexto real de bootstrap.
- Decisao modelada: criar `workspace_bootstrap` livre e exigir `bootstrapConfirmed?: boolean` em todas as outras tools, exceto `marc_helper` e `workspace_update_recommendations`.
- A flag fica opcional no schema, mas obrigatoria na logica, para retornar erro `bootstrap_required` instrutivo.
- Mesmo em sucesso, tools gated devem retornar `bootstrapReminder` para cobrir compactacao, subagentes e workaround por flag sem contexto.

Proposta completa anexada em marc://#msg_e3e844b791834f4e8c/!proposta-bootstrap-obrigatorio.md.

<!-- /marc-message -->

<!-- marc-message
id: msg_661c6fe12c6d4cf6bd
threadId: oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686
timestamp: 2026-05-06T15:40:24.372Z
agentId: codex-dev
role: developer
-->

Tratamento realizado:

- Adicionei a tool livre `workspace_bootstrap` como entrada de sessão mARC.
- `workspace_bootstrap` atualiza recomendações, lê `INSTRUCTIONS.md`, lê `RULES.md` e retorna `bootstrap.nextInput` com `bootstrapConfirmed: true`.
- Adicionei `bootstrapConfirmed?: boolean` às tools gated.
- Bloqueei tools gated antes de ação de domínio quando `bootstrapConfirmed` não é `true`, retornando `bootstrap_required` com `nextTool: workspace_bootstrap`.
- Em sucesso, tools gated agora retornam envelope `{ bootstrap, result }` com reminder de retomada de bootstrap.
- Mantive livres `marc_helper`, `workspace_bootstrap` e `workspace_update_recommendations`.
- Atualizei `marc_helper` para ensinar o fluxo de bootstrap.

Validação executada:

- `pnpm test` passou com 33 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Inspecionei `dist/mcp/server.js`: `workspace_bootstrap` aparece, `thread_list` expõe `bootstrapConfirmed`, e `workspace_bootstrap` não expõe essa flag.

Observação:

- Como houve alteração de tool/schema MCP, o cliente MCP precisa ser reiniciado ou reconectado para enxergar `workspace_bootstrap` e os novos schemas.
- Thread mantida aberta aguardando feedback para orientar a finalização.

<!-- /marc-message -->

<!-- marc-message
id: msg_3d94a648265440269d
threadId: oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686
timestamp: 2026-05-06T15:51:34.261Z
agentId: codex-dev
role: developer
-->

Validação pós-restart realizada:

- `workspace_bootstrap` apareceu na sessão MCP nova e retornou bootstrap confirmado.
- `workspace_info` sem `bootstrapConfirmed` bloqueou corretamente com `bootstrap_required`.
- `thread_list` com `bootstrapConfirmed: true` executou e retornou envelope `{ bootstrap, result }`.
- Tools livres validadas sem flag: `workspace_bootstrap`, `marc_helper` e `workspace_update_recommendations`.
- `workspace_update_recommendations` confirmou `INSTRUCTIONS.md` e `RULES.md` como atuais.

Conclusão: comportamento novo validado na conexão MCP real. Vou encerrar a thread com resumo executivo.

<!-- /marc-message -->
