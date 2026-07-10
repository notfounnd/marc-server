# Plano - Correção do painel de configuração e header copiável

## Contexto

A primeira implementação colocou a configuração da workspace em um `DropdownMenu`, mas a interação correta é um painel de configuração em `Sheet` lateral, seguindo o padrão já usado pelos anexos.

Também foi identificada diferença visual de aproximadamente 1px no posicionamento do botão de settings quando comparado ao botão de anexos. A hipótese aprovada é que a causa provável está na diferença de estrutura HTML entre header de workspace e header de thread, apesar de ambos apresentarem composição visual similar.

## Objetivos

- Fazer settings da workspace abrir em `Sheet` lateral, não em menu suspenso.
- Reaproveitar a estrutura visual do header para workspace, thread e agent.
- Tornar a linha secundária do header copiável para os três tipos de recurso.
- Corrigir o alinhamento do botão pela estrutura compartilhada, sem compensações manuais de pixel.

## Comportamento esperado

### Thread

- Eyebrow: `Thread`.
- Título: título da thread.
- Linha secundária: `thread.id`.
- Clique na linha secundária copia `marc://$threadId`.

### Agent

- Eyebrow: `Agent`.
- Título: título derivado do profile do agente.
- Linha secundária: `agent.id`.
- Clique na linha secundária copia `marc://@agentId`.

### Workspace

- Eyebrow: `Workspace`.
- Título: nome da workspace.
- Linha secundária: `workspace.rootPath`.
- Clique na linha secundária copia o caminho local bruto observado pelo daemon, por exemplo `C:\Projetos\marc`.

## Mudanças técnicas

- Extrair/ajustar um componente comum de identidade do header para renderizar eyebrow, título e linha secundária copiável com `Copy`.
- Atualizar `ContentHeader` para usar a mesma estrutura HTML para workspace, thread e agent.
- Atualizar `ContentHeaderActions` para remover o `DropdownMenu` do settings.
- Manter o botão `Settings` no header, com o mesmo estilo/tamanho do botão de anexos, abrindo `showWorkspaceSettings` via `onShowWorkspaceSettingsChange(true)`.
- Adicionar `WorkspaceSettingsModal` em `modals.tsx`, usando `Sheet`, `SheetContent side="right"`, `SheetHeader`, botão `X` e `WorkspaceSettingsPanel` no corpo.
- Atualizar `AppModals` e `app.tsx` para renderizar a sheet quando `showWorkspaceSettings` estiver ativo.
- Incluir `showWorkspaceSettings` no cálculo de `modalOpen` para preservar bloqueio de fundo e comportamento modal.
- Remover CSS de `.workspace-settings-menu` e adaptar `.workspace-settings-panel` para corpo de sheet, evitando scroll horizontal e mantendo botões com constraints corretas.

## Critérios de aceite

- Settings abre como sheet lateral, não dropdown.
- O painel fecha pelo `X` e ao fechar atualiza o estado corretamente.
- Header de workspace, thread e agent usa a mesma estrutura de linha secundária copiável.
- Path da workspace aparece com ícone de cópia.
- Agent id aparece com ícone de cópia e copia `marc://@agentId`.
- Thread id mantém cópia de `marc://$threadId`.
- Botão settings fica alinhado ao botão de anexos sem ajuste artificial de `top`, `margin` ou `transform`.

## Validação planejada

- Atualizar testes estáticos da UI para cobrir:
  - settings não renderiza via `DropdownMenuContent`;
  - settings renderiza via `WorkspaceSettingsModal`/`Sheet`;
  - botão settings permanece no header;
  - linha secundária copiável cobre thread, agent e workspace.
- Rodar:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
- Validar visualmente via `playwright-cli` depois do restart:
  - settings abre em sheet lateral;
  - sheet não tem scroll horizontal;
  - botão settings alinhado ao botão de anexos;
  - linhas secundárias mostram ícone de cópia e copiam o valor correto.

## Restrições

- Não usar Playwright via MCP.
- Não usar comandos git.
- Usar context-mode para inspeção/validação de comandos.
- Manter código e textos de produto em en-US.
- Manter comunicação e registros na thread em pt-BR.
- Preservar Markdown como fonte de verdade; esta correção é apenas UI, sem mudança no modelo de persistência.