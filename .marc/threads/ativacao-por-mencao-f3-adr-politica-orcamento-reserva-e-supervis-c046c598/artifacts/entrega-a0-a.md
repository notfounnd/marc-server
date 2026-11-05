# Entrega A0 + A: armazenamento por thread, política, fechamento e waiter

Autor: claude-dev (developer). Revisão pendente de marc://@claude-software-architect.

## Escopo

- **A0:** estado do daemon em um arquivo por thread e um arquivo por workspace (pausa); migração única do sessions.json; protocolo de encerramento; seção Activity no SUMMARY.md; consulta com prazo de 2 s e linha explícita de fallback.
- **A:** ADR 0014 e nota na 0004; núcleo puro da política; pin de conteúdo (authorizedHash); razão sobre os arquivos; rotas de ativação, atividade e recuperação; campos stage e pass do bloco; transição do marc wait (código de saída 8).

## Arquivos alterados

- **Núcleo:** types.ts, markdown.ts, activation-rules.ts, activation-stages.ts, activation-policy.ts, activation-policy-hash.ts, activation-budget.ts, activation-policy-store.ts, thread-activity-markdown.ts, thread-summary.ts, thread-summary-markdown.ts, thread-wait.ts, thread-wait-runtime.ts.
- **Daemon:** registry-file.ts, marked-file.ts, activation-file.ts, thread-store.ts, workspace-store.ts, legacy-sessions.ts, session-file.ts, session-registry.ts, session-operations.ts, session-views.ts, events.ts, thread-cleanup.ts, activation-ledger.ts, activity-snapshot.ts, activation-routes.ts, activity-routes.ts, route-targets.ts, state-routes.ts, routes.ts, server.ts.
- **MCP e CLI:** mcp/daemon.ts, mcp/thread-tools.ts, cli-wait-command.ts; interface src/ui/types.ts.
- **Docs:** adrs/0014 (nova), adrs/0004 (nota), adrs/README.md, agent-workflows.md, ui-and-daemon.md, mcp-tools.md, architecture.md.

## Decisões tomadas além do aprovado

1. Cada arquivo de thread tem um marcador `<thread>.meta.json`, gravado antes do dado. Não há índice de workspace: o marcador basta para distinguir "nunca existiu" de "perdido".
2. O pin é sha256 do conteúdo canônico da política, sem revision e updatedAt. Edição manual com a mesma revisão vira policy_tampered; revisão diferente vira revision_mismatch. Ambos pausam a thread.
3. Escritas em thread com SUMMARY.md existente são recusadas dentro da fila da thread. A recuperação também não recria thread fechada.
4. Sem daemon configurado, o resumo grava a linha "Activity not recorded: the daemon was unavailable at closure." em vez de omitir a seção.
5. Política que não pode ser lida conta como habilitada no waiter (falha fechada).

## Verificação

- `pnpm validate`: ok. O marcador de tempo mostrou que só arquivos do escopo mudaram.
- `pnpm build`: ok.
- `pnpm test`: 1707 aprovados, 0 falhas.
- Testes da F2: 224 casos relacionados passam. Ajustes apenas de layout (fixtures e três testes de persistência e observação); asserções de comportamento não mudaram.
- Prova ao vivo em daemon temporário na porta 4299, com cópia de sessions.json e sessions.meta.json: 27 de 27 verificações. Migração 5 de 5 slots; PUT, GET, pausa e retomada; perda do arquivo da thread dá 409 ledger_lost sem recriar; recuperação; mensagens antigas e com stage e pass renderizam; fechamento grava Activity e remove o estado; heartbeat atrasado recusado com 409 thread_closed. Daemon encerrado, porta livre e pasta temporária removida.

## Pendências e riscos

- A lista de códigos de saída da skill marc-ops ainda não tem o código 8 (policy_active). Não foi editada.
- A linha de atividade indisponível aparece em todo resumo de workspace sem daemon, conforme a especificação. Confirmar se é o comportamento desejado.
- Recuperar um arquivo de thread zera as sessões vinculadas dela: a próxima abertura é nova.
- A pausa recuperada começa pausada no workspace recuperado.
- "Pausado alguma vez" é o histórico do workspace, não da thread.
