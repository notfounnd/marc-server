# Plano: rota de diagnóstico de sessões e ativação

Thread: marc://$oportunidade-rota-de-diagnostico-de-sessoes-e-ativacao-264e0ebf
Autor: marc://@claude-software-architect. Data: 12/11/2026.

## Contexto

Na F3, com a política ligada, uma escuta (`marc wait`) armada na sessão aberta do principal ficou retida por `identity_unverified`.
- O ⚡ mostrou só o aviso genérico.
- O daemon guarda apenas o texto `identity_unverified` (`ReservationRecord.reason`). Não guarda qual das verificações de `waiterIdentityVerified` (`src/core/waiter-identity.ts`) falhou.
- Não existe nenhuma rota, comando ou ferramenta de diagnóstico.

Sem ler o estado do daemon à mão, não houve como saber a causa.

**Objetivo:** dar a humanos e agentes uma consulta só de leitura do que o daemon sabe sobre uma thread, e nomear a verificação que falhou.

**Decisões do humano:**
- **Rota:** separada das visões de status da UI, porque o ⚡, o 👤 e o Activity evitam de propósito ID nativo, PID e host.
- **Aviso:** o do ⚡ pode nomear a verificação que falhou.
- **Consulta:** pelo comando `marc diagnose`, sem ferramenta MCP nova.
- **Git:** o commit da F3 já foi feito e enviado, então o desenvolvimento parte de uma árvore limpa.

## Desenho

**1. A verificação que falhou** (`src/core/waiter-identity.ts`)
- Nova função pura `waiterIdentityCheck(facts): IdentityCheck`. É uma tabela de despacho, de cima para baixo, na ordem atual dos `return false`:
  - `no_pid`
  - `no_binding`
  - `session_mismatch`
  - `no_client_pid`
  - `process_table_unavailable`
  - `not_descendant`
  - `agents_unavailable`
  - `start_mismatch`
  - `verified`
- `waiterIdentityVerified` passa a ser `waiterIdentityCheck(facts) === "verified"`, e os chamadores atuais não mudam.
- `src/daemon/waiter-identity.ts`: o `WaiterIdentity` passa a devolver o `IdentityCheck`. Os atalhos "sem PID" e "sem vínculo" devolvem os códigos próprios.

**2. Guardar o motivo na reserva** (`src/daemon/activation-reservation-store.ts`)
- Campo novo e opcional `identityCheck?: IdentityCheck` em `ReservationRecord` (`src/core/activation-reservation-types.ts`).
- O campo é gravado quando a decisão é `held` por `IDENTITY_HOLD` (`withIdentityGate`, `verifiedOf`) e removido quando a reserva for concedida.
- A validação do arquivo da thread (`src/daemon/activation-file.ts`, reservas) aceita o campo e recusa valores fora da lista.
- O `reason` continua `identity_unverified`, então as chaves de i18n e os códigos de saída do `marc wait` não mudam.

**3. Rota `GET /api/workspaces/:ws/threads/:t/diagnostics`**
- **Arquivo novo:** `src/daemon/diagnostics-routes.ts`, no padrão de `session-routes.ts`. Usa `threadFor` (`src/daemon/route-targets.ts`, que também aceita thread encerrada) e entra em `STATE_ROUTES` (`src/daemon/state-routes.ts`). O token já é exigido por `server.ts` para todo `/api/*`.
- **Montagem:** `src/daemon/diagnostics-view.ts`, com leitura fora da fila (`ThreadStore.read`), sem gravar nada.
- **O que a resposta traz:**
  - `generatedAt` e `hostId`;
  - **`sources`:** o estado do inventário `claude agents` (`presence.agents()`) e da tabela de processos (`processesOf(...).list()`), só com status e motivo, sem as linhas da tabela;
  - **`slots`**, um por vínculo:
    - o vínculo gravado: origem, geração, `nativeSessionId`, `envSessionId`, `previousSessionId`, `hostId`, `owner.clientPid`, `owner.clientStartedAt`, `owner.lastHeartbeatAt`, `boundAt`, `observedAt`, `endedAt` e conflitos;
    - o estado derivado agora (`deriveSlotState`, via `probeFor` em `session-views.ts`);
    - os processos do inventário cuja sessão ou PID batem com o vínculo, com PID, início, sessão e status;
  - **`reservations`:** todos os registros, inclusive os recusados, com `identityCheck`;
  - **`supervision`:** todos os cards, inclusive os encerrados, com `turn` (PID, início, prazo, modo, tentativa) e o resultado.
- **Nunca saem:**
  - `owner.ownerToken`;
  - o `runId` dos cards e das reservas, que autoriza o `permission_prompt`;
  - as linhas inteiras do inventário de outras sessões da máquina.
- **Respostas de erro:** workspace ou thread desconhecida dá 404, e estado ilegível dá 200 com `registry: "invalid"` e o motivo.

**4. Comando `marc diagnose`** (`src/cli-diagnose-command.ts`, novo, ligado em `src/cli.ts`)
- **Uso:** `marc diagnose --thread <id|sufixo> [--workspace <caminho>] [--data-dir <caminho>] [--daemon-url <url>] [--profile <id>]`.
- **Reaproveita:**
  - a descoberta do daemon e do token de `marc open` (`connectDaemon`/`discoverDaemon` em `src/cli-open-discovery.ts`, `createDaemonClient` em `src/cli-open-session.ts`);
  - a resolução de workspace e de sufixo de thread de `marc open`.
- **Saída:**
  - imprime o JSON da rota;
  - com `--profile`, só o slot e os registros desse perfil;
  - nunca imprime o token.
- **Códigos de saída:** 0 em sucesso e 5 em erro (daemon indisponível, token recusado ou thread desconhecida), com `{status, reason}`, no padrão de `marc wait`.
- **Caminho da workspace:** já normalizado com `path.resolve`. É o mesmo defeito do helper registrado na F4, que não se repete aqui.

**5. Aviso do ⚡ com a verificação**
- `src/daemon/activation-views.ts` (`extrasView`): `HoldView` ganha `identityCheck?`. O tipo da UI `ActivationHoldView` (`src/ui/types.ts`) acompanha.
- `src/ui/thread-activation-waiting-model.ts`: a linha de retenção por `identity_unverified` troca o detalhe genérico por um texto curto da verificação que falhou, numa tabela de textos. Exemplos:
  - "The session that holds the slot is a different one";
  - "The listener does not descend from the session's client";
  - "The client started again after the slot was bound".
- Sem o campo, o texto atual continua.
- As chaves novas vão para `public/locales/en_US/translation.json` e para a lista de chaves usada pelo teste do catálogo.

**6. Documentação**
- `docs/ui-and-daemon.md`: uma linha na tabela "HTTP API overview" e um parágrafo sobre o que a rota mostra e o que nunca mostra.
- `docs/agent-workflows.md`, "Listening for mentions": numa escuta retida (exit 7 com `held`, ou um aviso no ⚡), rodar `marc diagnose --thread <id> --profile <eu>`.
- O texto de uso do `src/cli.ts`.

## Tarefas (um dev por vez: claude-dev, general-purpose, haiku, effort xhigh, sem Git)

- **Tarefa A, núcleo, daemon e CLI:** os itens 1 a 4, com os testes.
- **Tarefa B, UI e documentação:** os itens 5 e 6, com os testes de UI e de i18n.
  - Captura com o Playwright CLI, headless e com o diretório de trabalho no scratchpad, de um aviso retido com a verificação nomeada, num daemon temporário.

**Ritual de cada tarefa:**
1. o `OK_BOOTSTRAP` e a autorização pelo canal entre agentes;
2. a entrega publicada pelo próprio dev na thread 264e0ebf;
3. de 2 a 3 rodadas de revisão minhas.

**No fim:**
1. a revisão integrada em `revisao-integrada-diagnostico.md`;
2. o texto de encaminhamento ao Codex;
3. o aceite do humano;
4. o stage, com o OK de Git.

## Execução, depois da aprovação deste plano

1. Publicar na thread 264e0ebf a proposta estruturada, com este plano anexo como `artifacts/plano-rota-diagnostico.md`.
2. Rodar `workspace_update_recommendations` e o `workspace_audit` com `scope: preflight`.
3. Despachar o dev para a tarefa A, revisar, e depois a tarefa B.

## Verificação

- **Checagens:** `pnpm typecheck`, `pnpm code:check`, `pnpm build` e `pnpm test` completo, pelo context-mode.
- **Testes novos:**
  - **núcleo:** tabela com um caso por código de `waiterIdentityCheck`, incluindo o "verificado";
  - **reserva:** retida grava o `identityCheck` certo, e a concessão seguinte o remove; um valor inválido no arquivo é recusado;
  - **rota:**
    - responde 200 com vínculo, derivado, reservas e cards;
    - o texto não contém `ownerToken`, o `runId` nem a sessão de um processo alheio;
    - workspace ou thread desconhecida dá 404;
    - thread encerrada continua legível;
    - estado ilegível aparece como `invalid`;
  - **CLI:** com um daemon de teste, o sucesso, `--profile`, a thread por sufixo, o token recusado, o daemon fora do ar e o caminho sem drive;
  - **UI:** o texto por verificação e o texto antigo sem o campo; o catálogo de i18n.
- **Ponta a ponta num daemon temporário:**
  - um vínculo semeado com `clientStartedAt` diferente;
  - uma escuta governada fica retida com `start_mismatch`;
  - o `marc diagnose` mostra o vínculo, os processos e a verificação;
  - o ⚡ mostra o texto específico.
- **Regressão:**
  - o `marc wait` manual e o governado concedido não mudam;
  - as visões do ⚡ e do 👤 continuam sem ID nativo nem PID.
- **No daemon real, depois do aceite e só por pedido do humano:** `marc diagnose` numa thread com escuta, para investigar a causa da F3. A investigação em si fica na F4.
