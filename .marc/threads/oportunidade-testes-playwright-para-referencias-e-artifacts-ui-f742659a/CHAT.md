# Oportunidade - Testes Playwright para referências e artifacts UI

Thread: `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a`
Created: `2026-05-06T04:45:44.457Z`

<!-- marc-message
id: msg_86f8cff2d6c7408bbf
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-05-06T04:46:33.094Z
agentId: codex-dev
role: developer
artifacts: artifacts/playwright-test-scenarios.md
-->

Backlog vivo de testes Playwright para a UI do mARC.

- Objetivo: acumular cenários E2E conforme funcionalidades de UI forem implementadas ou refinadas.
- Fonte de trabalho: `artifacts/playwright-test-scenarios.md`.
- Ao finalizar uma implementação de UI, leia esta thread e atualize o artifact com os cenários Playwright pendentes correspondentes.
- Registre aqui apenas o que pertence ao backlog Playwright: cenários, status, prioridades e decisões de cobertura E2E.
- Não registre nesta thread validações unitárias, testes puros com `node:test`, typecheck ou build; isso pertence à thread da implementação.
- Quando algum cenário Playwright for implementado no futuro, atualize o status no artifact e comente aqui o que saiu do backlog.

<!-- /marc-message -->

<!-- marc-message
id: msg_b0b5b54b48fc4ac39c
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-05-11T00:44:05.113Z
agentId: codex-dev
role: developer
-->

Backlog Playwright complementado após a implementação do autocomplete.

- Atualizei `artifacts/playwright-test-scenarios.md` com a seção `Composer Autocomplete`.
- Incluí cenários E2E para `Ctrl+Space`, sugestões de `@`, `$`, `#`, cross-thread explícito, navegação por setas, inserção por `Enter`/`Tab`, artifacts indentados e seleção visual única.
- Incluí a seção `Keyboard Shortcuts Modal` para o link de ícone no footer global da terceira coluna e modal centralizado.
- Mantive a thread focada apenas em backlog Playwright/E2E.

<!-- /marc-message -->

<!-- marc-message
id: msg_4c31f8e598d64d03b9
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-05-11T22:35:11.322Z
agentId: codex-dev
role: developer
-->

Backlog Playwright complementado após a implementação da thread marc://$oportunidade-revisao-en-us-do-projeto-c14150b8.

Atualizei o artifact `artifacts/playwright-test-scenarios.md` com a seção `UI Localization`, cobrindo carregamento do catálogo `en_US`, renderização de labels pela UI, modais/composer, fallback quando o catálogo falhar e preservação de conteúdo autoral no idioma escolhido pelo usuário.

<!-- /marc-message -->

<!-- marc-message
id: msg_477c310406da4ec78b
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-05-22T02:06:36.014Z
agentId: codex-dev
role: developer
-->

Backlog Playwright atualizado após a implementação da UI de colunas.

- Incluí a seção `Three-Column UI Modes And Scroll`.
- Cenários cobrem modos Threads/Marckers/arquivo, estabilidade dos botões, rolagem independente, footer fixo, assinatura ao lado do botão de atalhos e bloqueio de background em modais centralizadas e laterais.

<!-- /marc-message -->

<!-- marc-message
id: msg_9c311d68b9fd446aa6
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-05-26T02:59:52.613Z
agentId: codex-dev
role: developer
-->

Backlog Playwright atualizado após a migração visual neo-brutalism da UI.

- Incluí cenários E2E para superfícies/controles quadrados com sombras sólidas, estados selecionados e hover, legibilidade do Markdown, seleções de menus/autocomplete, consistência das modais e cópia da referência da thread.
- Os cenários cobrem a evolução registrada em marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1.

<!-- /marc-message -->

<!-- marc-message
id: msg_af4b8c9fd5b148628e
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-07-07T05:16:41.873Z
agentId: codex-dev
role: developer
-->

Backlog Playwright atualizado após a implementação da thread marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6.

- Atualizei `artifacts/playwright-test-scenarios.md` com a seção `Workspace Memory Indicator`.
- Incluí cenários E2E pendentes para estados `ready`, stale/missing, erro/incompatível, futuro rebuilding e alinhamento responsivo no card da workspace.
- Mantive a thread focada apenas em backlog Playwright/E2E.

<!-- /marc-message -->

<!-- marc-message
id: msg_cbd566e1b60d440cbe
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-07-10T17:00:37.603Z
agentId: codex-dev
role: developer
-->

Backlog Playwright atualizado após a implementação da thread marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa.

- Atualizei `artifacts/playwright-test-scenarios.md` com a seção `Workspace Memory Settings`.
- Incluí cenários E2E pendentes para sheet lateral de settings, ordem visual do painel, switch de auto rebuild, persistência de `autoRebuild`, rebuild automático ao fechar thread e alinhamento visual do switch Neobrutalism/Radix.
- Mantive a thread focada apenas em backlog Playwright/E2E.

<!-- /marc-message -->

<!-- marc-message
id: msg_4615acccfe9641d2b2
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-07-15T03:39:46.911Z
agentId: codex-dev
role: developer
artifacts: artifacts/playwright-test-scenarios.md
-->

Backlog Playwright atualizado apos a implementacao da thread marc://$oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99.

- Atualizei `artifacts/playwright-test-scenarios.md` na secao `Workspace Memory Indicator`.
- Inclui cenarios E2E pendentes para `database-zap` durante rebuild iniciado pela UI e durante rebuild iniciado por MCP/CLI observado via `workspace-changed`.
- Mantive a thread focada apenas em backlog Playwright/E2E.

<!-- /marc-message -->

<!-- marc-message
id: msg_9805a9c1472842ed98
threadId: oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a
timestamp: 2026-07-20T22:53:14.624Z
agentId: codex-dev
role: developer
-->

Backlog Playwright atualizado após a implementação de marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682.

A seção `Workspace Memory Settings` agora cobre:
- slider de batch size, valores permitidos e persistência;
- request `mode: "incremental"` para o fluxo padrão;
- request `mode: "full"` para o rebuild explícito;
- estado `database-zap` e bloqueio das ações enquanto o lock global estiver ativo.

<!-- /marc-message -->
