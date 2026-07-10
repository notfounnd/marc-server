# Oportunidade - Processamento em background para gerar memory

Thread: `oportunidade-processamento-em-background-para-gerar-memory-aa4908aa`
Created: `2026-07-07T00:38:50.998Z`

<!-- marc-message
id: msg_7149c90e5a8846248b
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-07T00:45:13.066Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-background-memory.md
-->

Oportunidade registrada para estudar e implementar processamento em background para geração/rebuild da memory.

Anexei um artifact detalhado com:

- motivação baseada no tempo observado de rebuild;
- paralelo com o padrão de background rebuild do thread index;
- alternativas de contrato para MCP/daemon/UI;
- estados operacionais candidatos;
- riscos de modelo local, snapshot stale e escrita LanceDB;
- critérios de aceite iniciais.

Referências principais: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac e marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

<!-- /marc-message -->

<!-- marc-message
id: msg_da0013b9bed945b092
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T02:46:14.000Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-processamento-background-memory.md
-->

Plano detalhado registrado antes do desenvolvimento.

Vou seguir a implementação preservando:

- `memory_rebuild` MCP/CLI síncrono;
- preparo de modelo apenas por ação explícita;
- rebuild automático somente quando o modelo já estiver preparado;
- configuração por workspace;
- Markdown e `SUMMARY.md` como fonte de verdade da memory.

Próximo passo: iniciar TDD e desenvolvimento conforme o artifact anexado.

<!-- /marc-message -->

<!-- marc-message
id: msg_46c13b97651645979e
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T04:32:55.469Z
agentId: codex-dev
role: developer
artifacts: artifacts/resultado-desenvolvimento-background-memory.md
-->

Desenvolvimento implementado e validado.

Resumo:

- Adicionado processamento background de memory para prepare/rebuild no daemon/UI.
- Adicionada configuração por workspace em `.marc/SETTINGS.md`, mantendo Markdown como fonte de verdade.
- Adicionados endpoints de settings, prepare e rebuild de memory por workspace.
- Adicionada UI de configuração da memory no header da workspace.
- Status de memory expandido com `preparing`, `rebuilding` e `degraded`.
- Documentação atualizada.

Validação via context-mode:

- `pnpm run validate`: passou.
- `pnpm test`: passou, 113 testes, 113 pass, 0 fail.
- `pnpm build`: passou.
- `workspace_audit`: sem findings críticos; apenas warnings já existentes de metadata em perfis de agentes.

Detalhe anexado em marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa/artifacts/resultado-desenvolvimento-background-memory.md

Agora é o momento de reiniciar os recursos para validar em runtime na UI/daemon.

A thread fica aguardando seu feedback antes da finalização.

<!-- /marc-message -->

<!-- marc-message
id: msg_67020d192f42462799
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T13:33:21.165Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-settings-sheet-e-header-copiavel.md
-->

Plano refinado registrado antes da correção.

O artifact cobre:

- troca do settings de `DropdownMenu` para `Sheet` lateral;
- header compartilhado para workspace, thread e agent;
- linha secundária copiável para os três tipos de recurso;
- hipótese de alinhamento do botão por estrutura HTML compartilhada;
- critérios de aceite e validação planejada.

Referência: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa/artifacts/plano-correcao-settings-sheet-e-header-copiavel.md

Vou seguir a implementação a partir desse plano.

<!-- /marc-message -->

<!-- marc-message
id: msg_8c7f93eeb5134e5984
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T14:14:54.452Z
agentId: codex-dev
role: developer
artifacts: artifacts/resultado-correcao-settings-sheet-e-header-copiavel.md
-->

Correção implementada e validada.

Resumo:

- Settings da workspace agora abre como `Sheet` lateral, no padrão dos artifacts.
- Header de workspace, thread e agent usa estrutura compartilhada: eyebrow, title e linha secundária.
- Linha secundária copiável adicionada para thread, agent e workspace.
- O botão de settings permanece no header da workspace e apenas abre o sheet.
- CSS, testes estáticos e catálogo en-US foram ajustados.

Validação via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou após RED esperado.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou.
- `workspace_audit`: ok, 0 findings.

Validação visual: feita com `playwright-cli`, sem MCP. A sessão limpa carregou a UI, mas sem token/workspace não permitiu clicar no settings; não houve erro de console relacionado à mudança.

Detalhes anexados em marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa/artifacts/resultado-correcao-settings-sheet-e-header-copiavel.md

Aguardando seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_0fd5a8e779b24470a2
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T16:06:16.791Z
agentId: codex-dev
role: developer
-->

Refinamento visual implementado.

- Troquei o checkbox de `Automatic memory rebuild` por um `Switch` acessível (`role="switch"`).
- Reorganizei o painel para seguir a composição proposta: status, toggle, ações.
- Mantive o componente local, sem adicionar dependência nova.

Validação via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou após RED esperado.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou.

Observação: o build manteve apenas o aviso conhecido de chunk >500 kB do Vite.

<!-- /marc-message -->

<!-- marc-message
id: msg_46060e106a90475bbf
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T16:12:19.705Z
agentId: codex-dev
role: developer
-->

Correção do refinamento visual anterior.

A primeira versão do switch foi implementada manualmente, o que não seguia corretamente a indicação da doc do Neobrutalism.

Ajuste aplicado agora:

- `src/components/ui/switch.tsx` substituído pelo componente do registry Neobrutalism/shadcn.
- Adicionada a dependência oficial `@radix-ui/react-switch`.
- Teste atualizado para validar uso de `SwitchPrimitive.Root`, não uma implementação manual.

Validação via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou.

Observação: o build manteve apenas o aviso conhecido de chunk >500 kB do Vite.

<!-- /marc-message -->

<!-- marc-message
id: msg_376e6e2958c44c1ba4
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T16:19:00.939Z
agentId: codex-dev
role: developer
-->

Correção visual adicional do switch implementada.

Causa identificada:

- O `SwitchPrimitive.Root` renderiza um `button`.
- O componente do registry pressupõe reset/preflight de botão.
- No app, esse reset não estava garantido para esse componente, então o padding nativo do botão deslocava o thumb para a direita.

Ajuste aplicado:

- Mantido o componente oficial Neobrutalism/Radix.
- Adicionado reset local no root do switch: `appearance-none` e `p-0`.
- Teste atualizado para travar esse contrato visual.

Validação via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou.

Observação: o build manteve apenas o aviso conhecido de chunk >500 kB do Vite.

<!-- /marc-message -->

<!-- marc-message
id: msg_ef2d2a366005429387
threadId: oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
timestamp: 2026-07-10T18:09:45.242Z
agentId: codex-dev
role: developer
-->

Refinamento visual adicional registrado.

Causa corrigida:

- O painel de settings precisava seguir o mesmo padrao de area rolavel usado nas colunas da UI.
- A correcao anterior com compensacao por sombra foi removida.

Ajuste aplicado:

- `workspace-settings-body` agora usa `scrollbar-gutter: stable` com `overflow-y: auto`, seguindo o padrao de `.sidebar`, `.middle` e `.content-scroll`.
- Removido o token `--shadow-offset` e os paddings compensatorios do painel.
- `SUMMARY.md` da thread foi atualizado para preservar essa decisao na memory futura.

Validacao via context-mode:

- `pnpm test test/ui-workspace-settings.test.ts`: passou.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 114/114.
- `pnpm build`: passou, mantendo apenas o aviso conhecido de chunk >500 kB do Vite.

Memory:

- A edicao do `SUMMARY.md` deixou a memory stale.
- `memory_rebuild` foi executado e retornou `Memory index is current`, com `summaryCount=32` e `indexedSummaryCount=32`.
- Observacao: `.marc/SETTINGS.md` esta com `memory.autoRebuild: false`, entao o rebuild automatico nao estava habilitado neste momento.

<!-- /marc-message -->
