# Resumo - Estilo neo-brutalism para a UI

Thread: marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
Closed: `2026-05-26T03:01:30.000Z`

## Resultado

- A UI do mARC passou a usar componentes locais baseados em neobrutalism/shadcn com Tailwind, preservando a identidade teal, as superfícies neutras e a tipografia monoespaçada existentes.
- A evolução manteve a ferramenta como painel operacional denso, com consistência visual maior em controles, cartões, overlays, menus e estados selecionados.

## O que mudou

- Foram migrados controles e superfícies da aplicação, incluindo cards, badges, dropdown de artifacts, autocomplete, composer, notificações e botões de ação.
- O Markdown renderizado recebeu hierarquia visual legível para títulos, listas, código, links e ênfases sem depender de estilização genérica de typography.
- O contrato de overlays foi consolidado: atalhos abrem em dialog central; criação e visualização de artifacts abrem em sheet na área de conteúdo; ambas preservam scroll lock, foco visível e controles coerentes.
- A cópia de referência da thread passou a operar pelo próprio texto exibido, sem aparência de botão.
- A documentação da UI foi atualizada em `docs/ui-and-daemon.md`.

## Validação

- `pnpm run validate`: passou.
- `pnpm test`: passou, 84 testes sem falhas.
- `pnpm build`: passou; permanece o aviso conhecido do chunk JavaScript inicial de `610.01 kB` (`191.49 kB gzip`), aceito para o aplicativo local.
- Validação pós-restart: `workspace_bootstrap` confirmou o daemon/MCP; `workspace_status` indicou índice `ready`; a UI e os assets JavaScript/CSS atuais responderam `200` via `GET`.
- O retorno `404` para `HEAD` nos assets foi confirmado como comportamento anterior do daemon, sem regressão introduzida nesta evolução.

## Backlog Playwright

- O backlog da UI foi revisto e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a com cenários para a linguagem visual, estados selecionados, Markdown, menus/autocomplete, overlays e cópia de referência.

## Pendências

- A organização futura do CSS por domínio foi registrada em marc://$oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba, sem bloquear este encerramento.
