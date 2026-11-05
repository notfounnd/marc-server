# Entrega F3a, tarefa B: UI de política e pausa

Autor: claude-dev (developer). Revisão pendente de marc://@claude-software-architect.

## Escopo entregue

- **Daemon** (autorizado pelo coordenador, itens 1 e 2):
  - `GET /api/workspaces/:id/activation`, com `{ paused, pausedAt }`, ou 409 com o motivo quando o arquivo da workspace é perdido ou inválido.
  - `stages` no GET da thread: passes usados por estágio, em ordem; `null` enquanto o arquivo de estado da thread estiver perdido ou inválido.
- **UI:**
  - botão Zap no cabeçalho da thread, com painel de mesma largura do menu de sessões: status, estágio atual, participantes, estágios e rodapé com Salvar;
  - Recover e Replace unreadable policy, ambos com confirmação inline;
  - botão Pause na workspace, ao lado de Settings, e faixa âmbar na thread aberta;
  - tooltip do dev sem sessão, na linha do menu de sessões;
  - `apiPut` em `app-sync.ts`, no padrão de `apiPost`.
- **Componente:** `src/components/ui/checkbox.tsx`, criado pelo CLI shadcn. Nenhum outro arquivo foi alterado pelo CLI.

## Arquivos e linhas

**Daemon:**
- `src/daemon/activation-routes.ts`: rota GET da workspace (L59, handler L105); campo `stages` em `ActivationBody` (L97) e montagem (L237).
- `src/core/activation-budget.ts`: `stagePassesOf` (L143). Só a view muda; a lógica do store não.

**UI, arquivos existentes:**
- `src/ui/app-sync.ts`: `apiPut` (L128), retorno (L316).
- `src/ui/app.tsx`: `sync = useAppDataActions` (L114), `apiPut={sync.apiPut}` (L248). 298 linhas efetivas.
- `src/ui/app-content.tsx`: faixa `ThreadPausedBanner` (L70). `app-content-types.ts` e `content-header.tsx`: repasse de props.
- `src/ui/content-header-actions.tsx`: `ThreadActivationSlot` (L100), `WorkspaceActionsRow` (L133).
- `src/ui/thread-sessions-row.tsx`: `UNBOUND_ROLE_NOTES` (L192), `unboundRoleLines` (L198).
- `src/ui/types.ts`: `ApiWrite` (L249) e os tipos da view de ativação.
- `src/ui/styles.css`: import de `activation.css` (L9).
- `public/locales/en_US/translation.json`: 305 chaves.

**UI, arquivos novos:**
- `thread-activation-menu.tsx` (L31; `keepTyping` L117), `thread-activation-form.tsx` (L44; `replaceUnreadable` L113), `thread-activation-sections.tsx`, `thread-activation-lists.tsx`.
- `thread-activation-draft.ts`: `draftOf`, `formOf` (L235), `removalBlockOf` (L153), regra de passes (L189).
- `thread-activation-status.ts`, `thread-activation-failures.ts`.
- `use-thread-activation.ts` (`useThreadActivation` L64, `useWorkspaceActivation` L108).
- `workspace-pause-control.tsx` (`WorkspacePauseControl` L26, `ThreadPausedBanner` L87).
- `src/ui/styles/activation.css`.

**Testes:**
- Novos: `daemon-activation-workspace-view.test.ts`; `ui-thread-activation-draft.test.ts`, `ui-thread-activation-status.test.ts`, `ui-thread-activation-sections.test.ts`, `ui-thread-activation-fixtures.ts`; `ui-thread-developer-row.test.ts`; `ui-workspace-pause-catalog.test.ts`.
- Ajustados: `i18n.test.ts` (L75, lista de escopo do i18n); `ui-version.test.ts` (L38, `apiPut` e `apiPost` no props).

**Docs:** `docs/ui-and-daemon.md`: linhas HTTP de workspace e de thread, e a seção "Thread activation policy and workspace pause".

## Verificação

- `pnpm validate`: exit 0 (lint, prettier, typecheck). Antes da execução, `prettier --check .` listou só arquivos do escopo.
- `pnpm build`: exit 0.
- `pnpm test`: 1750 aprovados, 0 falhas.
- Navegador (playwright-cli, daemon temporário na porta 4299, dataDir e workspace temporários com 2 architects, 1 developer e o user):
  - ligar, escolher participantes e estágios, salvar: a revisão muda a cada save (c208b341 → d662aead → 3e5b06e1 → a9f83d83).
  - passes simulados por edição do arquivo de estado: 4 de 5 com "One pass left in this stage."; 3 de 3 com "Stage exhausted" e a linha de fim; 2 de 3 sem aviso (ver decisão 1).
  - `policy.json` editado à mão com a mesma revisão: linha de policy_tampered e pill Paused; Salvar de novo limpa.
  - arquivo de estado da thread apagado: linha de ledger_lost, Recover com confirmação, Salvar com 409 inline.
  - `policy.json` ilegível: pill "Unreadable policy" e confirmação "Replace unreadable policy"; Cancel e substituição testados.
  - Pause na workspace (âmbar, aria-pressed), faixa na thread, Resume pela faixa.
  - tooltip do dev sem sessão; Zap pressionado enquanto aberto; troca de menu com um clique.
  - console: um único erro 409, esperado, do Salvar com estado perdido.
- Daemon 4299 finalizado por PID verificado (node src/cli.ts daemon, porta 4299, dataDir temporário). Porta sem listeners. Navegador fechado.

## Decisões e desvios

1. **Aviso de 80% (para revisão do architect):** a regra do core (`budget_80`) dispara em 4 de 5 e nunca em 2 de 3. O teste do core diz "2 of 3 passes used: no warning yet". A brief pedia o aviso em 2 de 3. A UI mostra o que o daemon informa; não alterei a regra core.
2. **Regra nova na UI:** o passes de estágio salvo não pode ficar abaixo dos já usados. Sem ela, o painel mostrava "4 of 3 passes". Erro inline no Salvar, sem PUT.
3. **Estágio salvo:** mantém id e condição de saída; só passes e remoção mudam. Remoção só com zero passes usados. Linha nova pode ser removida sempre.
4. **Política ilegível:** o Salvar não é bloqueado. Ele pede confirmação "Replace unreadable policy". Formulário vazio falha antes na validação ("Add at least one stage."), então a confirmação aparece depois de adicionar um estágio.
5. **Botão Pause sem estado:** com o arquivo da workspace perdido, o botão fica desabilitado. O Recover fica só no painel da thread.

## Riscos e observações

- O índice de threads ficou **degraded** durante o navegador: `EPERM: operation not permitted, rename` em `.marc/cache/thread-index.json` no Windows, logo após o replace da política. É cache derivado, fora desta tarefa; não reproduzi isoladamente.
- Sem mudança em daemon ou core além dos itens 1 e 2.
- Pendente: revisão técnica e decisão sobre o aviso de 80% em 3 passes.
