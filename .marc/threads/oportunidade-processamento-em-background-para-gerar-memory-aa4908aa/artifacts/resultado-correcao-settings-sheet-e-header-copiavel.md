# Resultado da correção: settings em sheet e header copiável

## Escopo implementado

- Troquei a configuração de workspace de `DropdownMenu` para um `Sheet` lateral dedicado, consistente com a abertura de artifacts.
- Mantive o botão de configuração no header da workspace como ação simples; ele apenas abre o sheet.
- Movi os controles de memory para `AppModals`, onde ficam os overlays da aplicação.
- Unifiquei a composição visual do header para workspace, thread e agent:
  - eyebrow;
  - title;
  - linha secundária com texto copiável quando existe referência/path.
- A linha secundária copia:
  - thread: `marc://$threadId`;
  - agent: `marc://@agentId`;
  - workspace: path local da workspace.
- Adicionei os textos de tooltip `Copy agent reference` e `Copy workspace path` no catálogo en-US.
- Ajustei os estilos para remover a largura de dropdown e permitir que o painel de settings respire dentro do sheet.

## Arquivos principais

- `src/ui/content-header.tsx`
- `src/ui/content-header-actions.tsx`
- `src/ui/workspace-settings-modal.tsx`
- `src/ui/app-modals.tsx`
- `src/ui/app.tsx`
- `src/ui/styles/thread-content.css`
- `src/ui/styles/overlays.css`
- `test/ui-workspace-settings.test.ts`
- `test/i18n.test.ts`
- `public/locales/en_US/translation.json`

## Validação

Executado via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou após teste RED inicial falhar pelo motivo esperado.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114 testes, 114 pass, 0 fail.
- `pnpm build`: passou.
- `workspace_audit` com `scope: preflight`: ok, 0 findings.

## Observações

- `pnpm build` manteve apenas o aviso conhecido do Vite sobre chunk maior que 500 kB; não houve falha.
- A checagem Playwright foi feita via `playwright-cli`, não via MCP. A sessão limpa carregou a UI sem token/workspace, então confirmou carregamento e ausência de erro relacionado ao sheet, mas não conseguiu abrir o settings em estado autenticado.
- O console do Playwright mostrou apenas `favicon.ico` 404 e o aviso do browser sobre campo de senha fora de form, sem erro da mudança.
- Não atualizei documentação: a mudança é composição visual/estrutura de UI e não altera contrato de daemon, API, memory, Markdown ou persistência.
- Markdown permanece como fonte de verdade; a correção não altera `.marc/SETTINGS.md`, threads, summaries, artifacts ou índices derivados.