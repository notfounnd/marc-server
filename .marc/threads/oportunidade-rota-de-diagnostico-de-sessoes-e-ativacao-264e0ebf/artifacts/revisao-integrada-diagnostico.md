# Revisão integrada: rota de diagnóstico de sessões e ativação

Autor: marc://@claude-software-architect. Data: 12/11/2026.

## Veredito

**Aprovado tecnicamente.** O estado integrado das tarefas A e B atende ao plano `plano-rota-diagnostico.md` (marc://#msg_e4de21145b474a5e99) e às decisões do humano:
- a rota fica separada das visões da UI;
- a consulta é feita pelo `marc diagnose`;
- o aviso do ⚡ nomeia a verificação que falhou.

Ainda faltam a confirmação do Codex e o aceite do humano. A aprovação técnica não é aceite.

## Escopo e fontes revisados

- **Fontes:** a abertura (marc://#msg_fdd475873e9b4e3ebb), o plano, as entregas do claude-dev (marc://#msg_5aaa86acfd17463faf para a tarefa A e marc://#msg_e0707b1e1c15490fbe para a tarefa B) e o diff integrado inteiro.
- **Código:**
  - `src/core/waiter-identity.ts`, `activation-reservation*.ts`;
  - `src/daemon/waiter-identity.ts`, `activation-reservation-store.ts`, `activation-file.ts`, `activation-views.ts`, `diagnostics-routes.ts`, `diagnostics-view.ts`, `state-routes.ts`;
  - `src/cli-diagnose-command.ts`, `cli.ts`, `cli-open-input.ts`, `cli-open-session.ts`;
  - `src/ui/thread-activation-waiting-model.ts`, `thread-activation-holds.tsx`, `types.ts`;
  - `public/locales/en_US/translation.json`.
- **Documentação:** `docs/ui-and-daemon.md`, `docs/agent-workflows.md` e `README.md`.

## Critérios e evidência

1. **A verificação que falhou.**
   - **Implementação:** `waiterIdentityCheck` é uma tabela de linhas na ordem dos antigos `return false`, com nove códigos (`IDENTITY_CHECKS`). `waiterIdentityVerified` virou `=== "verified"`, então os chamadores antigos não mudaram.
   - **Evidência:** `core-waiter-identity-check.test.ts`, um caso por código e a cobertura da tabela. Os 12 casos antigos continuam passando.
2. **O código na reserva.**
   - **Implementação:** `withIdentityGate` grava `identityCheck` só numa retenção por identidade, e a concessão o remove (`grantStop`). O `reason` continua `identity_unverified`, então os códigos de saída do `marc wait` e as chaves de i18n não mudaram. O validador do arquivo da thread recusa código fora da lista.
   - **Evidência:** `daemon-activation-reservation-identity.test.ts`, com 5 testes novos.
3. **A rota.**
   - **Implementação:** `GET …/threads/:t/diagnostics` usa `threadFor` (404 para workspace ou thread desconhecida) e lê fora da fila, sem gravar nada. A view é montada campo a campo, então um campo novo no estado não vaza por acidente.
   - **Nunca sai:** `ownerToken`, `runId`/`runIds`, processos do inventário que não se ligam ao vínculo, linhas da tabela de processos.
   - **Evidência:** `daemon-diagnostics-routes.test.ts`, com 6 testes. Eles conferem o texto bruto da resposta e cobrem a thread encerrada, o estado inválido e a tabela ilegível.
4. **O `marc diagnose`.**
   - **Implementação:**
     - descobre o daemon e o token como o `marc open`;
     - a workspace passa por `resolveWorkspace` (`path.resolve`), então um caminho sem drive não se repete aqui;
     - `--profile` filtra o resultado, e a saída é uma linha JSON com exit 0 ou 5;
     - o token nunca é impresso.
   - **Ajustes no `marc open`:** só exports e a extração pura de `callDaemon`, sem mudança de comportamento.
   - **Evidência:** `cli-diagnose-command.test.ts`, com 9 testes, e `cli-diagnose-start-mismatch.test.ts`, uma ponta a ponta com daemon HTTP real: a escuta fica retida por `start_mismatch` e o diagnóstico nomeia o motivo.
5. **O aviso do ⚡.**
   - **Implementação:** o `HoldView` leva o `identityCheck`, e `holdTextOf` troca só o detalhe da linha por um texto por código. Sem o campo, com um código desconhecido ou com outro motivo, fica o texto atual. O texto passa por `t()`, e as 8 chaves estão no catálogo e em `WAITING_LABEL_KEYS`.
   - **Evidência:** `ui-thread-activation-hold-text.test.ts` (15 testes) e `daemon-activation-hold-identity.test.ts` (4 testes).
   - **Captura headless num daemon temporário:** o aviso mostra "The slot's client is not running, or started again".
6. **Documentação.**
   - a linha e o parágrafo da rota em `ui-and-daemon.md`;
   - o roteiro de diagnóstico de uma escuta retida em `agent-workflows.md`, com os códigos;
   - a seção "Diagnose a held wait" no `README.md`;
   - o texto de uso do CLI.

## Achados e decisões aceitas na revisão

- **`registry`:** segue o formato da visão de sessões, `{status, reason?}`, e não o texto solto previsto no plano.
- **`identityCheck` numa reserva que depois foi recusada:** fica como histórico. Só a concessão o remove.
- **Thread encerrada:** a rota responde 200. Como o daemon já apagou o estado da thread, os slots vêm vazios.
- **O que sai além da lista do plano:**
  - o `holder` das reservas, que é a sessão nativa do waiter;
  - o `sessionId` dos processos ligados pelo PID;
  - do `outcome` dos cards, só o número de negações e o código de falha.
  - Tudo isso é útil para depurar e nada é credencial.
- **Diretório temporário:** os daemons de teste usam o temp do sistema, como as fixtures do projeto. Com o temp apontado para o scratchpad, os testes do LanceDB estouram o limite de 260 caracteres de caminho do Windows.

## Checagens do estado final (principal)

- `pnpm typecheck`, `pnpm code:check` e `pnpm build` com exit 0.
- `pnpm test` com 2546/2546 (+52 testes).
- Numa execução intermediária, `daemon-supervision-permission-turn-end.test.ts` falhou uma vez por tempo. O arquivo não foi alterado e passou 3 vezes rodando sozinho. É o segundo teste instável sob carga, depois dos de MCP na F3.
- O `pnpm validate` não rodou, porque grava no repositório inteiro. O `code:check` e o `typecheck` cobrem a verificação.

## Limites

- A captura usou um vínculo semeado com `clientStartedAt` alterado, não um Claude real.
- A causa do caso real da F3 não foi investigada aqui. Isso fica para a F4, que agora tem o `marc diagnose` como ferramenta.
- O contador do ⚡ continua contando só ações. Uma retenção aparece dentro do painel, mas não no selo.

## Achado do Codex e reavaliação

**Achado** (marc://#msg_ebca46944352498684): a montagem campo a campo parava no primeiro nível.
- `conflicts`, `state.details` e o `outcome` dos cards eram copiados inteiros.
- O validador do arquivo da thread preserva campos extras, então um `ownerToken` num conflito ou um `runId` no `outcome` chegavam ao JSON.
- O critério 3 desta revisão afirmava a exclusão sem cobrir os objetos aninhados. A falha foi minha, e o achado procede.

**Correção** (marc://@claude-dev, marc://#msg_d68ebc5970404ed3a2):
- `diagnostics-view.ts` projeta os objetos aninhados:
  - `conflicts`: `sessionId` e `at`;
  - `details`: `busy`, `listening`, `reason` e `pastConflict`;
  - `outcome`: `denials` e `failure`. O `costUsd` fica de fora.
- Os tipos de diagnóstico refletem só esses campos.
- Conferi os tipos de origem (`BindingConflict`, `SlotDetails`, `SupervisionOutcome`). Todos os campos projetados são escalares, então nenhum objeto da resposta é copiado inteiro.

**Regressão** (`test/daemon-diagnostics-projection.test.ts`):
- canários sintéticos num conflito e num `outcome` passam por `isRegistryFile`;
- o texto bruto da rota não contém o canário, nem as chaves `ownerToken` e `runId`;
- os campos públicos continuam presentes;
- `stateViewOf` descarta uma chave extra em `details`.

O `details` é derivado na hora e não é gravado no arquivo. Por isso, a cobertura dele é unitária. O dev mostrou que a regressão falha na projeção original ("leaked CANARY_OWNER"). O arquivo de testes da rota voltou ao estado anterior, com o mesmo hash.

**Checagens do estado corrigido (principal):** `pnpm typecheck`, `pnpm code:check` e `pnpm build` sem erro, e `pnpm test` com 2548/2548.

**Veredito reavaliado:** aprovado tecnicamente no estado corrigido. Falta a confirmação do Codex.

## Para o humano

- **Reinicie o daemon** para carregar a rota e o aviso novo.
- **Para validar,** com a política ligada numa thread, arme uma escuta numa sessão aberta e mencione o agente. Se ficar retida, o ⚡ diz por quê, e `marc diagnose --thread <id> --profile <agente>` mostra o vínculo e os processos.
