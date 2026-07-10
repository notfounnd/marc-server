# Resultado do desenvolvimento

## Entrega

- Configuração por workspace em `.marc/SETTINGS.md`, mantendo Markdown como fonte de verdade.
- `memory.autoRebuild` com default `true`.
- Leitura e atualização da configuração por API.
- Processamento em background para memory no daemon/UI:
  - prepare assíncrono do modelo;
  - rebuild assíncrono do índice;
  - deduplicação de chamadas concorrentes;
  - bloqueio de rebuild enquanto prepare está em andamento;
  - estado degradado em falha de rebuild;
  - descarte do provider após prepare/rebuild para não manter o modelo carregado sem necessidade.
- Rebuild automático apenas quando:
  - auto rebuild está habilitado;
  - o modelo local já está preparado;
  - a memory está `missing` ou `stale`.
- Endpoints adicionados:
  - `GET /api/workspaces/:workspaceId/settings`
  - `POST /api/workspaces/:workspaceId/settings`
  - `POST /api/workspaces/:workspaceId/memory/prepare`
  - `POST /api/workspaces/:workspaceId/memory/rebuild`
- UI de configuração no header da workspace:
  - botão de settings na terceira coluna, seguindo a experiência do botão de anexos de thread;
  - toggle de automatic memory rebuild;
  - botão `Prepare model` sempre presente, habilitado conforme estado do modelo;
  - botão `Rebuild memory` habilitado quando o modelo está preparado e não há operação em andamento;
  - estados visuais para prepare/rebuild via health de memory.
- Status de memory ampliado para `preparing`, `rebuilding` e `degraded`, preservando os estados anteriores.
- Docs atualizadas em `docs/memory.md` e `docs/ui-and-daemon.md`.

## Organização técnica

- `src/core/workspace-memory.ts` concentra a facade pública de operações de memory.
- `src/core/memory/settings.ts` persiste configuração de workspace em Markdown.
- `src/core/memory/background.ts` concentra a coordenação background de prepare/rebuild.
- `src/ui/main.tsx` ficou como entrypoint.
- `src/ui/app.tsx` passou a conter o componente raiz.
- `src/ui/content-header.tsx` e `src/ui/content-header-actions.tsx` concentram o header da área principal.
- `src/ui/use-workspace-memory-actions.ts` concentra ações/polling da UI para prepare/rebuild.

## Validação

Executado via context-mode:

- `pnpm run validate`: passou.
- `pnpm test`: passou, 113 testes, 113 pass, 0 fail.
- `pnpm build`: passou.
- Scan das regras de estilo nos arquivos tocados não encontrou `else` nem `if` aninhado.
- `workspace_audit`: ok, sem findings críticos. Apenas warnings já existentes de metadata ausente em perfis de agentes externos à implementação.

## Observação operacional

Para validar em runtime na UI/daemon, é necessário reiniciar os recursos, porque houve mudança em endpoints do daemon e no bundle da UI.

A thread deve ficar aguardando feedback antes da finalização.