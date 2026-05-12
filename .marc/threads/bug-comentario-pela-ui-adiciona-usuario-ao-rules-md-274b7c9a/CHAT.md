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

<!-- marc-message
id: msg_c9526d119f264559b5
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T22:55:43.377Z
agentId: ui-user
role: user
-->

Teste de comentário para tentar entender o problema.

<!-- /marc-message -->

<!-- marc-message
id: msg_faece36994a24a92b9
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T22:56:36.680Z
agentId: ui-user
role: user
-->

Segundo este de comentário para tentar entender o problema.

<!-- /marc-message -->

<!-- marc-message
id: msg_04358b93f2a54e18bd
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T23:14:50.764Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-temporario-reproducao-rules.md
-->

Plano temporario registrado como artefato para orientar a reproducao antes de alterar codigo.

Evidencia inicial relevante: nesta sessao, a chamada real de `workspace_bootstrap` reproduziu a falha no `RULES.md`. Ela retornou `updated: ["RULES.md"]` e removeu o bloco customizado `### Flow Rules` que estava abaixo de `## Custom Rules`.

Observacao critica: esse comportamento nao parece bater com o codigo atual do repo, porque a resposta da tool recriou `## Custom Rules` apenas com o comentario antigo e sem o comentario estrutural. Vou comparar agora o comportamento do `src` e do `dist` locais em workspaces temporarios antes de propor qualquer correcao.

<!-- /marc-message -->

<!-- marc-message
id: msg_0c0be5978c814e27a8
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T23:27:00.053Z
agentId: codex-dev
role: developer
artifacts: artifacts/evidencias-reproducao-rules-bootstrap.md
-->

Relatorio de investigacao anexado antes da tratativa.

Resumo das evidencias:

- A chamada real de `workspace_bootstrap` desta sessao reproduziu a perda de `### Flow Rules` no `RULES.md`.
- Probes em workspaces temporarios usando `src` e `dist` atuais nao reproduziram a perda de `### Flow Rules`; ambos preservaram esse bloco.
- Os processos MCP ativos para esta sessao foram criados em `06/05/2026`, enquanto o daemon atual foi iniciado em `11/05/2026 19:56:19`.
- Hipotese mais forte: o MCP server conectado ao agente ficou stale; reiniciar/rebuildar o daemon nao reinicia automaticamente o MCP usado pela sessao.
- Bug confirmado no codigo atual: conteudo com heading `##` abaixo de `## Custom Rules` e perdido, contrariando a ADR 0007.

Nao implementei correcao de codigo nesta etapa. A thread deve ser retomada em plan mode para decidir a tratativa com base nessas evidencias.

<!-- /marc-message -->

<!-- marc-message
id: msg_41c3b7a66676467a82
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-11T23:42:42.856Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-rules-custom-boundary.md
-->

Plano detalhado registrado antes do desenvolvimento.

Pontos centrais do plano:

- seguir a ADR 0007 e a decisao da thread marc://$oportunidade-organizar-agentes-registrados-no-rules-md-734062bc;
- preservar Custom Rules por posicao, sem depender do nome da secao customizada;
- manter a resiliencia generica para headings `###` a `######` deslocados antes de `## Custom Rules`;
- validar o ciclo normal de `recommendations.updated` / `alreadyCurrent`;
- registrar handoff para validacao em MCP fresh apos rebuild/restart.

Vou iniciar pela criacao das regressoes e depois aplicar a correcao minima no normalizador de `RULES.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_96f326a509d743e684
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-12T00:03:30.783Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluido e validado. A thread permanece aberta aguardando feedback.

O que foi realizado:

- Refatorei a manutencao de `RULES.md` para usar um normalizador canonico do baseline gerenciado.
- `## Custom Rules` agora e tratado como fronteira posicional ate o fim do arquivo, preservando conteudo customizado independente do nivel de heading.
- Mantive a resiliencia generica aprovada: blocos customizados `###` a `######` encontrados antes de `## Custom Rules` sao migrados para baixo da fronteira.
- Removi o modelo antigo de reescritas incrementais por secao, que recortava Custom Rules pelo proximo `##` e podia gerar comportamento inconsistente.
- Mantive agentes fora de `RULES.md`; `agent_register` segue escrevendo somente em `.marc/agents/*.md`.
- Adicionei regressao garantindo que POST pela UI com `ui-user` nao altera `RULES.md`.

Validacoes executadas:

- `pnpm test test/core.test.ts test/daemon.test.ts`: passou; pelo script atual, executou a suite completa com 48 testes, 0 falhas.
- `pnpm typecheck`: passou.
- `pnpm build`: passou.
- Probe em `dist/core/workspace.js`: primeira chamada com drift retornou `updated: ["RULES.md"]`; segunda chamada retornou `alreadyCurrent` com `RULES.md`; conteudo customizado `##` e `###` foi preservado.

Documentacao:

- Revisei a ADR 0007 e ela ja descreve o contrato necessario: baseline gerenciado acima de `## Custom Rules`, preservacao posicional abaixo da fronteira e agentes fora de `RULES.md`. Nao identifiquei necessidade de nova doc nesta etapa.

Handoff para validacao real em nova sessao/MCP fresh:

- Rebuild ja foi executado e `dist` foi atualizado.
- A evidencia anterior indicava MCP server stale em memoria. Para validar `workspace_bootstrap` real, reinicie o MCP client/server usado pelo agente, nao apenas o daemon.
- Na nova sessao, ler esta thread e executar `workspace_bootstrap`; o esperado e `RULES.md` manter a secao customizada atual e estabilizar em chamadas subsequentes.

<!-- /marc-message -->

<!-- marc-message
id: msg_a1d167abc0fd43288b
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-12T00:19:32.477Z
agentId: codex-dev
role: developer
-->

Validacao adicional executada antes do restart da sessao/MCP.

Bateria MCP fresh:

- Subi MCP via `StdioClientTransport` chamando `dist/cli.js mcp --workspace <temp>`.
- Executei 6 cenarios pelo entrypoint MCP real: `workspace_bootstrap`, `workspace_update_recommendations`, `workspace_read_rules`, `thread_create` e `message_post`.
- Todos passaram.

Cenarios cobertos:

- workspace recem-inicializado fica `alreadyCurrent`;
- baseline antigo com custom `#`, `##` e `###` preserva todo conteudo abaixo de `## Custom Rules`;
- headings customizados `###`/`####` deslocados antes de `## Custom Rules` sao migrados para baixo;
- inventario legado `### Registered Agents (Marckers)` e removido;
- `##` invalido acima da fronteira customizada e descartado;
- comentarios duplicados de Custom Rules sao normalizados;
- `message_post` via MCP nao altera `RULES.md`.

Bateria no workspace real:

- Fiz backup do `RULES.md` real em memoria.
- Sobrescrevi temporariamente o arquivo com um conteudo propositalmente baguncado.
- Rodei um MCP fresh via `dist/cli.js mcp --workspace C:/Projetos/marc`.
- A primeira chamada retornou `updated: ["RULES.md"]`.
- A segunda chamada retornou `alreadyCurrent: ["INSTRUCTIONS.md", "RULES.md"]`.
- Validei preservacao de custom `##`, `###`, migracao de `###` antes da fronteira e preservacao da secao customizada existente.
- Restaurei o conteudo original do `RULES.md` ao final.

Observacao: `git status` ainda marca `.marc/RULES.md` como modificado, mas `git diff` nao mostra diferenca textual e o `git hash-object` bate com o hash do indice (`a5ff60215860f50ec88da4334ccadb6f3a9ec419`).

<!-- /marc-message -->

<!-- marc-message
id: msg_869d46b0b499419881
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-12T00:26:24.091Z
agentId: codex-dev
role: developer
artifacts: artifacts/relatorio-validacao-mcp-fresh-rules.md
-->

Relatorio detalhado da validacao MCP fresh anexado como artefato.

O artefato documenta:

- contexto do problema e da ADR 0007;
- validacoes automatizadas;
- probe direto no `dist/core/workspace.js`;
- bateria MCP fresh via `StdioClientTransport` com 6 cenarios;
- rodada controlada no workspace real com `RULES.md` propositalmente baguncado e restaurado ao final;
- conclusao sobre `recommendations.updated` / `alreadyCurrent` e preservacao de Custom Rules.

<!-- /marc-message -->

<!-- marc-message
id: msg_4651d7aadb8c450d83
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-12T00:31:05.579Z
agentId: codex-dev
role: developer
-->

Handoff para a proxima sessao apos religar o CLI/MCP.

Contexto de referencia para o agente:

- Plano detalhado: marc://#msg_41c3b7a66676467a82/!plano-correcao-rules-custom-boundary.md
- Resultado do desenvolvimento: marc://#msg_96f326a509d743e684
- Validacao MCP fresh detalhada: marc://#msg_869d46b0b499419881/!relatorio-validacao-mcp-fresh-rules.md
- Evidencia inicial do MCP stale: marc://#msg_0c0be5978c814e27a8/!evidencias-reproducao-rules-bootstrap.md

Pre-requisito antes da validacao: levantar evidencia sobre o tempo de vida dos processos MCP/daemon ativos.

O agente deve verificar quais processos do mARC estao em execucao, identificar o tempo de criacao de cada processo e comparar essa informacao com o horario do rebuild/restart atual.

Orientacao de leitura:

- observar processos MCP e daemon relacionados ao mARC;
- comparar o tempo de criacao dos processos com o horario do rebuild/restart atual;
- se algum MCP ativo for anterior ao rebuild ou ao restart esperado, tratar como MCP stale;
- nesse caso, nao usar essa sessao como evidencia conclusiva e validar novamente com MCP client/server recem-iniciado;
- registrar na thread a evidencia coletada, especialmente quando houver indicio de processo stale.

Observacao: a saida da investigacao anterior esta registrada em marc://#msg_0c0be5978c814e27a8/!evidencias-reproducao-rules-bootstrap.md, na secao `Processo MCP ativo`.

O comando validado foi executado pelo context-mode com runtime `shell`, chamando `powershell.exe` a partir desse shell:

```bash
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -ne 'powershell.exe' -and \$_.CommandLine -match 'dist/cli\.js mcp|src/cli\.ts daemon|dist/cli\.js daemon' } | Select-Object ProcessId,Name,CreationDate,CommandLine | Format-List"
```

Essa evidencia trouxe os campos `ProcessId`, `Name`, `CreationDate` e `CommandLine` dos processos relevantes. O ponto importante para a proxima sessao e coletar esses mesmos dados e comparar:

- processos `dist/cli.js mcp` ligados ao workspace;
- processos `src/cli.ts daemon` ou `dist/cli.js daemon`;
- diferenca entre `CreationDate` do MCP e o horario do rebuild/restart atual.

Quando abrir uma nova sessao com MCP fresh, o agente deve:

1. Chamar `workspace_bootstrap` logo no inicio.
2. Conferir se `RULES.md` continua preservando `## Custom Rules` e o conteudo customizado atual.
3. Observar o retorno de `recommendations`:
   - se `updated` vier vazio ou sem `RULES.md`, o workspace ja esta estavel;
   - se `updated` incluir `RULES.md`, chamar `workspace_bootstrap` ou `workspace_update_recommendations` uma segunda vez e confirmar que `RULES.md` entra em `alreadyCurrent`.
4. Ler as referencias acima para entender o plano, a implementacao e a bateria MCP fresh ja executada.
5. Se o bootstrap fresh preservar Custom Rules e estabilizar `updated`/`alreadyCurrent`, comentar nesta thread que a validacao em MCP fresh real foi confirmada.
6. Aguardar feedback do usuario antes de encerrar a thread.

Ponto critico: reiniciar apenas o daemon nao basta para esse caso. A validacao deve acontecer com MCP client/server novo, porque o incidente anterior teve forte evidencia de MCP stale em memoria.

<!-- /marc-message -->

<!-- marc-message
id: msg_72dec7d6b080410ab1
threadId: bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a
timestamp: 2026-05-12T01:01:33.568Z
agentId: codex-dev
role: developer
-->

Validacao apos restart concluida.

Evidencias coletadas:

- `workspace_bootstrap` rodou em sessao nova e retornou `recommendations.updated: ["RULES.md"]` na primeira chamada.
- Em seguida, `workspace_update_recommendations` retornou `updated: []` e `alreadyCurrent: ["INSTRUCTIONS.md", "RULES.md"]`, confirmando estabilizacao.
- `workspace_read_rules` confirmou que `## Custom Rules` foi preservado com os comentarios estruturais e `### Flow Rules` abaixo da fronteira customizada.
- A checagem de processos mostrou daemon iniciado em `11/05/2026 21:57:21` e MCP em `11/05/2026 21:57:47`, ambos posteriores ao restart.

Conclusao: com MCP client/server fresco, a correcao estabiliza `RULES.md` e preserva Custom Rules. A evidencia atual confirma a hipotese anterior de que a perda de `### Flow Rules` observada antes veio de MCP stale em memoria.

Aguardando feedback do usuario para orientar o encerramento da thread.

<!-- /marc-message -->
