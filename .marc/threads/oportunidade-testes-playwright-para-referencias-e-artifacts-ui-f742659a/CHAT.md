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
