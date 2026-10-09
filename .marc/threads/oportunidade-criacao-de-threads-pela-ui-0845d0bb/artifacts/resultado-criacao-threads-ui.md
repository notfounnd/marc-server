# Resultado: criação de threads pela UI

Implementação concluída no escopo autorizado, executada por `codex-dev` com `gpt-6-luna/xhigh` confirmado por humano. A avaliação técnica integrada e a verificação final por Playwright permanecem a cargo do principal.

## Comportamento entregue

A rota `POST /api/workspaces/:workspaceId/threads` valida JSON, tipo do título, espaços e CR/LF; cria o diretório/Markdown canônico e devolve `201` sem criar perfil nem mensagem inicial. Falha ao atualizar o índice derivado não desfaz a criação: agenda recuperação e preserva a resposta 201. O SSE identifica workspace e thread. Implementação e registro em [thread-routes.ts](../../../../src/daemon/thread-routes.ts#L17) e [routes.ts](../../../../src/daemon/routes.ts#L232).

A ação **Create thread** aparece antes de Search e respeita workspace/token. O Sheet solicita somente um título de linha única; aguarda o POST sem permitir Close, Cancel, Escape ou backdrop dismissal. A criação é selecionada sem GET duplicado; falha de leitura permite retry sem repetir POST. A UI mantém uma thread recém-criada visível enquanto open/closed lists não a reconhecem, remove o buffer ao reconhecer inclusive na lista fechada e não ressuscita remoções seguintes. O wrapper mantém os hooks de sync e criação separados e protege a abertura contra workspace/token desatualizados.

## Referências

- Validação, criação canônica, resposta e evento: [thread-routes.ts](../../../../src/daemon/thread-routes.ts#L17) — CR/LF em 49; gravação/evento em 54 e 61.
- Reconciliação contra snapshots abertos/fechados: [thread-creation.ts](../../../../src/ui/thread-creation.ts#L13); workflow em 35.
- Composição e buffer por workspace: [use-app-data-actions.ts](../../../../src/ui/use-app-data-actions.ts#L18).
- Hook e retry de leitura: [use-thread-creation.ts](../../../../src/ui/use-thread-creation.ts#L13).
- Integração do app/sidebar e controlador tipado: [app.tsx](../../../../src/ui/app.tsx#L115), [app-sidebar.tsx](../../../../src/ui/app-sidebar.tsx#L65), [app-sidebar-middle.tsx](../../../../src/ui/app-sidebar-middle.tsx#L196), [app-modals.tsx](../../../../src/ui/app-modals.tsx#L44).
- Formulário e proteção durante envio: [thread-create-modal.tsx](../../../../src/ui/thread-create-modal.tsx#L37); área rolável e ações adaptáveis em [overlays.css](../../../../src/ui/styles/overlays.css#L106).
- Cobertura de API/workflow: [daemon-thread-creation.test.ts](../../../../test/daemon-thread-creation.test.ts#L62) e [ui-thread-creation.test.ts](../../../../test/ui-thread-creation.test.ts#L31). A UI/sidebar e catálogo também têm cobertura em `test/ui-app-sidebar.test.ts` e `test/i18n.test.ts`.
- Documentação atualizada: [ui-and-daemon.md](../../../../docs/ui-and-daemon.md#L76); endpoint em 143. Texto da UI em [translation.json](../../../../public/locales/en_US/translation.json#L33).

## Paths alterados

- Daemon: `src/daemon/routes.ts`, `src/daemon/thread-routes.ts`.
- UI: `src/ui/app.tsx`, `src/ui/app-actions.ts`, `src/ui/app-sync.ts`, `src/ui/app-modals.tsx`, `src/ui/app-sidebar.tsx`, `src/ui/app-sidebar-middle.tsx`, `src/ui/app-sidebar-lists.tsx`, `src/ui/modal-sheet-header.tsx`, `src/ui/use-app-shell-effects.ts`, `src/ui/types.ts`, `src/ui/styles/overlays.css`, `src/ui/thread-creation.ts`, `src/ui/use-thread-creation.ts`, `src/ui/thread-create-modal.tsx`, `src/ui/use-app-data-actions.ts`.
- Traduções e testes: `public/locales/en_US/translation.json`, `test/daemon-thread-creation.test.ts`, `test/ui-thread-creation.test.ts`, `test/ui-app-sidebar.test.ts`, `test/i18n.test.ts`.
- Documentação: `docs/ui-and-daemon.md`.

## Verificações

- Testes focados antes da suíte completa: 38/38 passaram, incluindo daemon e workflow de criação, sidebar/i18n e testes de memória UI/daemon.
- `pnpm validate`: passou (ESLint, Prettier check e TypeScript).
- `pnpm build`: passou; Vite transformou 2.216 módulos. A saída mantém o aviso de chunk JavaScript minificado acima de 500 kB.
- `pnpm test`: passou, 209/209.
- Playwright CLI do principal: 70/70 verificações passaram em 1440×900, 390×844 e 320×240. Incluiu foco/body lock, Escape, Close, backdrop, Tab, bloqueio de fechamento e POST duplicado durante pending, retry sem POST, composer vazio/primeira mensagem, lista defasada, reload/outra janela e regressão do header de shortcuts. O teste de UI usou HTTP mock e shim de EventSource; API/SSE reais estão cobertos pelos testes de daemon.
- Inspeção AST independente de 16 fontes: zero `else` ou `if` aninhado.

A comparação de hashes registrou 732 arquivos antes da validação final. O primeiro code:fix após a extração formatou estes oito arquivos autorizados: `src/daemon/thread-routes.ts`, `src/ui/app.tsx`, `src/ui/thread-create-modal.tsx`, `src/ui/use-app-data-actions.ts`, `src/ui/use-thread-creation.ts`, `test/daemon-thread-creation.test.ts`, `test/ui-app-sidebar.test.ts` e `test/ui-thread-creation.test.ts`. Os checks finais não alteraram hashes de código. O índice derivado `.marc/cache/thread-index.json` e dois logs existentes de `.playwright-output` mudaram durante a janela de validate/CLI/auditoria; foram preservados. Build gerou `dist`, excluído do manifesto por ser saída gerada. Nenhum arquivo-fonte fora do escopo autorizado mudou. Documentação alterada em `docs/ui-and-daemon.md`.

## Estado

Executor concluído. A revisão técnica integrada foi aprovada pelo principal e registrada em [atividade-criacao-threads-ui.md](atividade-criacao-threads-ui.md). O aceite humano e a autorização para encerrar a thread permanecem pendentes.
