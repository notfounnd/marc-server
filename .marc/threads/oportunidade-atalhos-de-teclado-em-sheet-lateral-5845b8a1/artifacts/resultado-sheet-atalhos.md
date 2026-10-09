# Resultado e revisão técnica: atalhos em sheet lateral

## Entrega

A superfície central de atalhos foi migrada para Sheet à direita, reutilizando as primitivas e o ciclo de fechamento existentes. Foram preservados o link no footer, os quatro atalhos e suas chaves de tradução. O foco inicial permanece dentro do sheet e o elemento que iniciou a abertura recebe o foco após o fechamento. A lista mantém as linhas agrupadas no topo, tem rolamento interno e empilha tecla/descrição em viewports até 480 px.

## Arquivos da feature

- `src/ui/modals.tsx:36`: migração para Sheet, remoção de imports/helper do Dialog sem uso e restauração local de foco.
- `src/ui/styles/overlays.css:32`: espaço reservado ao Close e corpo de atalhos rolável, com min-height zero, align-content start e scrollbar-gutter estável.
- `src/ui/styles/responsive.css:62`: empilhamento das linhas de atalhos até 480 px.
- `docs/ui-and-daemon.md:107`: descrição atualizada para sheet lateral.
- `src/ui/styles/composer-footer.css`: inspecionado e preservado, sem alteração pela feature.

## Execução e revisão

Principal: perfil `codex-software-architect`, runtime `/root`. Desenvolvedor: perfil compartilhado `codex-dev`, runtime `/root/shortcuts_sheet`, modelo solicitado gpt-6-luna e reasoning xhigh, com confirmação humana nesta sessão. Limite sequencial de um desenvolvedor respeitado. OK_BOOTSTRAP independente verificado e autorização explícita registrada em `msg_19798a1246254ff7b0` antes de editar.

O principal revisou a thread original, as decisões históricas, o plano, a implementação acumulada, CSS, documentação e capturas. A revisão pediu reserva de espaço para Close e align-content start para evitar linhas esticadas; ambos corrigidos pelo mesmo desenvolvedor. A CLI comprovou perda de foco ao fechar sem SheetTrigger, corrigida localmente com callbacks de autofocus. Não houve alterações de persistência: Markdown continua fonte de verdade. Guards permanecem planos, sem else ou if aninhado; não houve nova variação de comportamento que exigisse Strategy.

## Validação de navegador

- Desenvolvedor: Playwright CLI, viewports 1440×900, 390×844, 375×667, 320×568 e 320×240; ausência de overflow horizontal do documento, sheet e lista; título e Close sem colisão. Rolamento interno comprovado no viewport baixo.
- Desenvolvedor: fixtures sintéticas nas vistas workspace, thread, agent e overview; 24 chamadas interceptadas, nenhuma rota sem fixture; geometria estável `[712,32,696,836]` no viewport 1440×900. Nenhum registro real foi modificado pela validação.
- Principal: sessão CLI independente `principal-sheet-review`, nove combinações de viewport (1440×900, 390×844, 320×240) e fechamento (Close, Escape, backdrop), todas aprovadas. Verificados foco inicial, Tab/Shift+Tab, retorno ao acionador, reabertura, quatro linhas, ausência de overflow e limpeza do sheet, modal-open, data-scroll-locked e bloqueio do root.
- Na primeira versão do script de revisão, a expectativa de body overflow diferente de hidden após fechar era incorreta para o desktop: o layout base já o oculta. A asserção foi corrigida para observar os marcadores de bloqueio e então passou. Não houve correção de produto decorrente dessa asserção.
- Script do principal: `C:/Users/junior/AppData/Local/Temp/principal-shortcuts-review.js`.
- Capturas do desenvolvedor: `C:/Users/junior/AppData/Local/Temp/shortcuts-sheet-desktop.png`, `shortcuts-sheet-320x568.png`, `shortcuts-sheet-320x240.png`.

## Checks de integração executados pelo principal

| Comando | Resultado |
| --- | --- |
| `pnpm validate` | Exit 0; lint, formatação e typecheck aprovados. |
| `pnpm build` | Exit 0; build concluído. Aviso do Vite sobre chunk maior que 500 kB. |
| `pnpm test` | Exit 0; 199 testes aprovados, zero falhas, cancelamentos ou skips. |

Toda inspeção e revisão de saída ocorreu via context-mode. Não foram usados Git, PowerShell ou Playwright MCP. Não foram adicionados testes estáticos que espelhem o JSX.

## Efeito da validação fora da feature

`pnpm validate` executa lint e Prettier em modo escrita. A comparação de hashes cobriu 190 arquivos de src/test e configurações elegíveis da raiz e detectou saídas fora do escopo manual. O inventário abaixo corresponde aos 86 arquivos gravados na janela dessa validação, corroborando os caminhos detectados por hashes. São saídas automáticas do fluxo exigido, não mudanças manuais da feature.

Como principal, resolvi o conflito preservando as saídas automáticas de validação; não apliquei limpeza ou reversão global que pudesse apagar trabalho existente. Esse efeito foi informado ao usuário antes de build/test, que passaram sobre o estado resultante. Os hashes originais são evidência de alteração de bytes; não havia cópia completa dos arquivos antes da validação para produzir um diff semântico integral. Essa limitação deve permanecer explícita na revisão humana.

- `src/cli.ts`
- `src/core/memory/background.ts`
- `src/core/memory/hybrid-ranking.ts`
- `src/core/memory/index.ts`
- `src/core/memory/inference-manager.ts`
- `src/core/memory/inference-output.ts`
- `src/core/memory/inference-protocol.ts`
- `src/core/memory/inference-wire.ts`
- `src/core/memory/inference-worker.ts`
- `src/core/memory/lancedb-store-support.ts`
- `src/core/memory/lancedb-store.ts`
- `src/core/memory/local-provider.ts`
- `src/core/memory/local-query-interpreter.ts`
- `src/core/memory/local-reranker.ts`
- `src/core/memory/maintenance.ts`
- `src/core/memory/model-config.ts`
- `src/core/memory/operations.ts`
- `src/core/memory/passage-segmentation.ts`
- `src/core/memory/query-candidates.ts`
- `src/core/memory/query-interpretation-inference.ts`
- `src/core/memory/query-interpretation.ts`
- `src/core/memory/rebuild-coordination.ts`
- `src/core/memory/rebuild-operations.ts`
- `src/core/memory/recall-support.ts`
- `src/core/memory/rerank-batching.ts`
- `src/core/memory/search-depth.ts`
- `src/core/memory/semantic-eligibility.ts`
- `src/core/memory/semantic-ranking.ts`
- `src/core/memory/status.ts`
- `src/core/memory/storage-paths.ts`
- `src/core/memory/store.ts`
- `src/core/memory/summaries.ts`
- `src/core/memory/transformers-passage-tokenizer.ts`
- `src/core/memory/types.ts`
- `src/core/memory/vector-math.ts`
- `src/core/types.ts`
- `src/core/workspace-memory.ts`
- `src/core/workspace-status.ts`
- `src/daemon/memory-routes.ts`
- `src/daemon/routes.ts`
- `src/mcp/memory-tools.ts`
- `src/ui/app-content.tsx`
- `src/ui/app-modals.tsx`
- `src/ui/app-sidebar-middle.tsx`
- `src/ui/app-sidebar.tsx`
- `src/ui/app.tsx`
- `src/ui/markdown-panel.tsx`
- `src/ui/memory-search-depth.ts`
- `src/ui/memory-search-panel.tsx`
- `src/ui/memory-search.ts`
- `src/ui/styles/shell-navigation.css`
- `src/ui/styles/thread-content.css`
- `src/ui/types.ts`
- `src/ui/use-memory-search.ts`
- `src/ui/use-workspace-memory-actions.ts`
- `src/ui/workspace-settings-modal.tsx`
- `src/ui/workspace-settings-panel.tsx`
- `test/background-memory-test-helpers.ts`
- `test/core-memory-background.test.ts`
- `test/core-memory-hybrid-ranking.test.ts`
- `test/core-memory-lancedb-hybrid.test.ts`
- `test/core-memory-maintenance.test.ts`
- `test/core-memory-model-config.test.ts`
- `test/core-memory-provider-manager.test.ts`
- `test/core-memory-query-interpretation-inference.test.ts`
- `test/core-memory-query-interpretation.test.ts`
- `test/core-memory-readiness.test.ts`
- `test/core-memory-recall.test.ts`
- `test/core-memory-reconciliation.test.ts`
- `test/core-memory-semantic-ranking.test.ts`
- `test/core-memory-status.test.ts`
- `test/core-memory-summaries.test.ts`
- `test/core-memory.test.ts`
- `test/daemon-memory-background.test.ts`
- `test/daemon-memory-search.test.ts`
- `test/i18n.test.ts`
- `test/mcp-memory.test.ts`
- `test/memory-model-benchmark-runner.test.ts`
- `test/memory-quality-v4-selection.test.ts`
- `test/memory-test-helpers.ts`
- `test/ui-agent-profile.test.ts`
- `test/ui-memory-search-depth.test.ts`
- `test/ui-memory-search-panel.test.ts`
- `test/ui-memory-search-workflow.test.ts`
- `test/ui-memory-search.test.ts`
- `test/ui-workspace-settings.test.ts`

## Documentação e aceitação

`docs/ui-and-daemon.md` precisava atualização e foi corrigido. README, docs de agent workflows/harness engineering e ADRs não exigiram alteração pela feature. A implementação atende aos critérios da proposta e recebe aprovação técnica do principal. Aprovação técnica não equivale à aceitação humana. A thread permanece aberta; não há autorização de fechamento nesta sessão.

