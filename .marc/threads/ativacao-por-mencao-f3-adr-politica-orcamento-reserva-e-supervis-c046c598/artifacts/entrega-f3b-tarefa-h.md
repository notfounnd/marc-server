# Entrega F3b, tarefa H: autorização lida dentro da fila

Autor: claude-dev (developer). Revisão integrada pendente do principal, claude-software-architect.

## Mudança

A reserva, o avanço do agente e as ações humanas (extend e advance) passam a ler a autorização dentro do passo da fila que grava: política, pausa, configuração de ciclos, piso dos carimbos e arquitetos. A prontidão é julgada com o `file.activation` que a fila entrega, não com um `threads.read` à parte.

## Alterações e referências

- Novo `src/daemon/activation-queue-facts.ts` (123 linhas): leitor único da fila, `readQueueFacts` (linha 37), `judgeFacts` (76), `readinessOf` (98) e `architectIdsOf` (59). Só leituras; nenhuma passa pela fila da thread.
- `src/daemon/activation-reservation-store.ts` (296 para 254 linhas): `reserveIn` lê os fatos no passo (linha 50). `gateOf` usa os fatos da fila (144). O caminho fechado ou ilegível (`outsideInput`, 193) lê só a mensagem canônica, porque o gate decide antes de consultar política e arquitetos. `architectIdsOf` é reexportado (32), para que o lead-routes não mude.
- `src/daemon/activation-agent-advance.ts` (302 para 271 linhas): `agentAdvanceIn(input)` perde o parâmetro `cycles` (129); os fatos são lidos no passo (138); `advanceStep` julga com fatos da fila (176-182); `readinessReason` usa `facts.enabled` (223).
- `src/daemon/activation-stage-routes.ts` (227 para 206 linhas): sem `readinessOf` nem `cyclesState` nas rotas; cabeçalho de `STAGE_ROUTES` reescrito (36-40).
- `src/daemon/activation-stage-actions.ts` (228 para 265 linhas): `StageActionInput` recebe `services`, `workspace` e `threadId`, sem `cyclesPerStage`. `gateIn` (209) julga a prontidão e o estágio no passo; `extendStage` concede o valor lido na fila (82).
- `src/daemon/activation-views.ts` (243 para 214 linhas): `readinessOf` e `Readiness` removidos daqui.
- Testes, asserções inalteradas:
  - `test/daemon-activation-state.test.ts` (318 para 298 linhas): helper `stagedInput`, que grava a política em disco e pina. Preparação mudou em "a UI save re-authorizes...", "extend adds..." e "advance at review...".
  - `test/daemon-activation-floor.test.ts` (linhas 178-182): workspace e política gravada em "a human advance ends every retained hold...". Preparação mudou.
  - `test/daemon-activation-advance.test.ts`: só assinatura (`agentAdvanceIn` sem `cycles`; `advanceStage` com `services`).
  - Novo `test/daemon-activation-queued-judgment.test.ts` (299 linhas): 7 cenários em fila ocupada (tabela `ROWS`, linha 292 em diante).
- Nenhum documento alterado: nenhuma frase de ADR 0014 ou de ui-and-daemon.md afirmava que a autorização é lida antes da fila.

## Mudança de ordem

Thread fechada com política desligada responde `thread_closed` (antes `policy_disabled`). Ambos são 409. Aceita pelo principal.

## Verificação

- `pnpm typecheck`: saída 0.
- `pnpm code:check`: saída 0. Antes da checagem final, o prettier formatou só os arquivos tocados.
- `pnpm build`: saída 0. O aviso de chunk acima de 500 kB já existia.
- `pnpm test`: saída 0, 1979/1979 (eram 1972, mais os 7 novos).
- Subconjunto de ativação, antes da suíte completa: 234/234.
- Mutação de controle: com o avanço do agente lendo fora da fila, o cenário "a limit lowered from 5 to 3..." falhou. A mutação foi desfeita, e as checagens acima rodaram depois da reversão.
- `pnpm validate` não foi rodado, conforme combinado.

## Desvios do brief

- `readinessOf` reapareceu em `activation-queue-facts.ts`, com o mesmo papel, para manter `activation-stage-actions.ts` abaixo de 300 linhas.
- `outsideInput` deixou de ler política e arquitetos. Ele não consulta esses dados quando a thread está fechada ou ilegível.

## Riscos e limites

- O passo da fila faz mais leituras (CHAT.md, política, configuração e perfis), então a posse da fila dura mais. Não medi.
- Restam `if` pré-existentes em `test/daemon-activation-state.test.ts` (`grantCountIn` e o teste F3a). Não foram tocados.
