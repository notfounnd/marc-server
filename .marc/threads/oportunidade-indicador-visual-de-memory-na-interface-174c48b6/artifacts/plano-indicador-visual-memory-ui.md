# Plano - Indicador visual de memory na interface

## Resumo

- Expor o estado de memory por workspace em `/api/status`, reaproveitando `readWorkspaceStatus` e preservando Markdown como fonte da verdade.
- Renderizar o indicador no card da workspace, à direita, usando os ícones Lucide propostos.
- Atualizar `lucide-react` porque a versão instalada `0.468.0` não exporta `DatabaseCheck` nem `DatabaseX`; a documentação atual confirma esses componentes.

## Mudanças principais

- Atualizar `lucide-react` para versão que exporte `DatabaseCheck`, `DatabaseBackup`, `DatabaseZap` e `DatabaseX`; alvo inicial: `^0.547.0`, com validação de lockfile e build.
- Alterar `/api/status` para incluir `modules.memory.workspaces[workspaceId]`:
  - `ready`: snapshot atual.
  - `stale`, `missing`, `model_missing`: ação necessária, mas não falha do daemon.
  - `incompatible`: estado bloqueante.
- Manter `ok` de `/api/status` compatível; memory stale/missing não derruba conexão/UI.
- Modelar `MemoryIndexHealth` na UI e armazenar `memoryHealthByWorkspace` em paralelo a `threadIndexHealthByWorkspace`.
- Evoluir `NavItem` com slot opcional `trailing`, mantendo layout estável:
  - `DatabaseCheck`: `ready`.
  - `DatabaseBackup`: `stale`, `missing`, `model_missing`.
  - `DatabaseZap`: `rebuilding` futuro, já previsto na camada visual.
  - `DatabaseX`: `incompatible` ou estado degradado futuro.
- Usar tooltip/title acessível com textos en-US, sem texto visível extra no card.
- Se `modules.memory` estiver ausente por daemon antigo, não renderizar ícone e manter UI funcional.

## Implementação

### Thread mARC

- Anexar este plano como artifact na thread antes de qualquer alteração de código.
- Postar comentário curto informando que o plano foi registrado e que o desenvolvimento vai começar.

### Backend/API

- Ajustar `src/daemon/status.ts` para reaproveitar o resultado completo de `readWorkspaceStatus`, retornando `threadIndex` e `memory` por workspace.
- Atualizar testes de daemon para garantir que `/api/status` expõe memory sem alterar compatibilidade de `ok`, `daemon`, `workspaceRegistry` e `threadIndex`.

### UI

- Atualizar `src/ui/types.ts`, `src/ui/app-sync.ts`, `src/ui/main.tsx`, `src/ui/app-sidebar.tsx` e `src/ui/common.tsx`.
- Criar helper puro para mapear status de memory para apresentação visual.
- Ajustar CSS em `src/ui/styles/shell-navigation.css` para coluna trailing fixa, sem overlap em nomes/caminhos longos.
- Adicionar chaves en-US em `public/locales/en_US/translation.json`.

### Docs

- Atualizar `docs/ui-and-daemon.md` para documentar `modules.memory` em `/api/status`.
- Atualizar `docs/memory.md` com a existência do indicador visual e sua leitura por workspace.

## Testes e validação

- Testes unitários:
  - Mapping visual de memory: `ready`, `stale`, `missing`, `model_missing`, `incompatible`, ausência de health.
  - `/api/status` retorna `modules.memory.workspaces`.
- Validação completa:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
- Validação manual:
  - Abrir a UI e confirmar ícone no card da workspace.
  - Confirmar que `Connected` segue representando daemon/token.
  - Confirmar que `Synced` segue representando sync da UI.
  - Confirmar que memory `ready` aparece discreta e estados NOK ficam distinguíveis.
- Checkpoint mARC final:
  - Rodar `workspace_audit` preflight na thread.
  - Comentar na thread o que foi alterado, comandos executados, resultado da validação e qualquer necessidade de restart.
  - Aguardar feedback antes de orientar encerramento da thread.

## Assunções

- O card relevante é o da UI React em `src/ui/app-sidebar.tsx`; o fallback HTML legado do daemon não será alterado nesta entrega.
- O upgrade de Lucide fica limitado ao necessário para os ícones de database; se a instalação disponível for major `v1`, validar imports atuais antes de aceitar o upgrade.
- Esta entrega apenas indica estado; ações diretas como `Prepare memory` ou `Rebuild memory` ficam fora de escopo.
- Estado `DatabaseZap` será suportado visualmente para compatibilidade futura, mas só aparecerá quando a oportunidade de rebuild em background expuser `rebuilding`.
