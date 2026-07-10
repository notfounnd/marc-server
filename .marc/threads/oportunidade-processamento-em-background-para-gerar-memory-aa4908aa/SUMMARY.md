# Resumo executivo

Thread: `oportunidade-processamento-em-background-para-gerar-memory-aa4908aa`
Closed: `2026-07-10T17:05:00.000Z`

## Resultado

Implementado processamento em background para prepare/rebuild da summary-memory e refinada a UI de configuracao de memory da workspace.

## O que foi tratado

- Memory prepare/rebuild passou a ter fluxo background no daemon/UI, com estados `preparing`, `rebuilding` e `degraded`.
- Configuracao por workspace foi adicionada em `.marc/SETTINGS.md`, preservando Markdown como fonte de verdade.
- Endpoints de settings, prepare e rebuild de memory por workspace foram adicionados.
- A UI de settings da workspace foi movida de dropdown para `Sheet` lateral, alinhada ao padrao de artifacts.
- Header de workspace, thread e agent passou a usar composicao compartilhada: eyebrow, titulo e linha secundaria copiavel.
- A linha secundaria copia `marc://$threadId`, `marc://@agentId` ou o path local da workspace, conforme o recurso exibido.
- O controle `Automatic memory rebuild` foi refinado de checkbox para `Switch` Neobrutalism/Radix.
- O switch oficial usa `@radix-ui/react-switch`; foi aplicado reset local `appearance-none` e `p-0` para evitar deslocamento do thumb causado por padding nativo de `button`.
- O corpo rolavel do settings da workspace usa `scrollbar-gutter: stable`, reaproveitando o padrao das colunas rolaveis para reservar area da scrollbar e evitar recorte ou barra horizontal no painel.

## Validacao

- `pnpm test test/ui-workspace-settings.test.ts`: passou.
- `pnpm run typecheck`: passou nos checkpoints em que foi executado.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou, mantendo apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- `workspace_audit`: sem findings relevantes nos checkpoints executados.

## Continuidade

- Antes do fechamento, `workspace_status` indicou `memory.status=ready`, `autoRebuild=true`, `summaryCount=31`, `indexedSummaryCount=31`, `rebuilding=false` e `lastError=null`.
- O fechamento desta thread cria este `SUMMARY.md`; com `autoRebuild=true`, a validacao esperada e o daemon detectar a nova summary e atualizar a memory automaticamente.
- O backlog Playwright foi atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a com cenarios E2E pendentes para settings sheet, switch, persistencia de `autoRebuild`, rebuild automatico e header compartilhado.

## Referencias

- Plano inicial: `artifacts/plano-processamento-background-memory.md`
- Resultado inicial: `artifacts/resultado-desenvolvimento-background-memory.md`
- Plano de correcao UI: `artifacts/plano-correcao-settings-sheet-e-header-copiavel.md`
- Resultado de correcao UI: `artifacts/resultado-correcao-settings-sheet-e-header-copiavel.md`
