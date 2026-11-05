# Revisão integrada da F3b: reserva, waiter, ciclos, lead e painel

Autor: marc://@claude-software-architect
Data: 10/11/2026
Veredito: **aprovado tecnicamente**, revisto depois das tarefas H, I e J. O aceite do humano e a confirmação do Codex são etapas separadas. A thread continua aberta para a F3c.

## 1. Escopo e fontes revisadas

O que esta revisão cobre: o estado integrado das quatro tarefas da F3b, sem olhar só o último diff.

| Tarefa | Entrega do dev | Rodadas de revisão |
| --- | --- | --- |
| D: núcleo e daemon | msg_dba97cc21a5748b7b3 | 3 |
| E: CLI e MCP | msg_6ee0e9bb8d134a9d87 | 2 |
| G: lead e avanço ao postar | msg_5a573f5158a04a26a6 | 2 |
| F: painel, cartão e documentação | msg_ba80859bec3f4b9fba | 2, mais os ajustes desta revisão |
| H: autorização lida dentro da fila | msg_b30ba96fe426448c9b | 1 |
| I: thread encerrada sem painel e com a pasta limpa | msg_72a379af40fb4bd0bf, com o adendo msg_5373b8a342d54d7fbd | 2 |
| J: menu de sessões fora da thread encerrada | msg_392b190104c545b0a7 | 1 |

**Fontes:**

- o plano `plano-f3-politica-orcamento-reserva-supervisor.md`:
  - revisão 4 (msg_7d6530a8ad5040ce85);
  - revisão 4.1 (msg_6503dcda690a45ceaa);
  - revisão 5, decidida pelo humano (msg_9a73ab667def4b3497 e msg_93fb5fbb52814130a1);
- os pareceres do Codex: msg_1a1b987d760c4b6da8, msg_d39ac755ec324b09ba e msg_2286cef9b8a145a8b4;
- o parecer do Codex sobre a primeira versão desta revisão (msg_306a9112f8f54043ac), que deixou pendente a leitura da autorização fora da fila, e a passagem da tarefa H (msg_efa78c04825d43bfad);
- a confirmação do Codex depois da tarefa H (msg_0e0ff05aabb3423a86);
- os três ajustes que o humano encontrou no aceite e a passagem da tarefa I (msg_21d158b4b68a4f1282);
- a confirmação do Codex depois da tarefa I (msg_880725648dd3410ea9);
- as pendências falsas que o humano encontrou no menu de sessões de uma thread encerrada e a passagem da tarefa J (msg_04b88824ed5b4448af);
- a maquete aprovada pelo humano: https://claude.ai/artifact/Fb4iBZHfvUNFnJVTPT6wmx;
- o código final de `src/core/activation-*`, `src/daemon/activation-*`, `src/daemon/thread-cleanup.ts`, `src/daemon/session-views.ts`, `src/ui/content-header-actions.tsx`, `src/core/thread-wait.ts`, `src/cli-wait-*`, `src/mcp/message-post-stamp.ts`, `src/mcp/advance-call.ts` e `src/ui/thread-activation-*`;
- a ADR 0014, `docs/ui-and-daemon.md`, `docs/mcp-tools.md` e `docs/agent-workflows.md`.

A inspeção e as checagens foram feitas pelo context-mode. Nenhum comando Git foi executado nesta revisão.

## 2. Loop de desenvolvimento

- **Devs:** perfil `claude-dev`, modelo haiku com effort xhigh, confirmados pelo principal no spawn.
- **Sequência:** um dev por vez. As tarefas E, G e F tiveram devs novos para evitar contexto saturado. O dev da tarefa D recomendou essa troca.
- **Autorização:** cada tarefa teve `OK_BOOTSTRAP` verificado e autorização explícita pelo canal entre agentes antes da primeira edição.
- **Entregas:** cada dev publicou a própria entrega na thread. Conferi cada uma contra o trabalho.

## 3. Critérios, implementação e evidência

| Critério | Implementação | Evidência verificada |
| --- | --- | --- |
| O débito acontece só na reserva (d1) | `judgeReservation`, passo 7, em `src/core/activation-reservation.ts` | Testes de núcleo da reserva; rota real com débito de 1 ciclo |
| Ciclo por correlação de destinatários (d2) | `openCycleOf` e `admitStep`: a volta fecha o ciclo sem débito | `core-activation-reservation-chain.test.ts` |
| Retenção no limite; o avanço encerra só as retidas nunca concedidas (d3) | `closeHolds` e `isStaleHold` com `granted === false` | `daemon-activation-loop.test.ts`: pausa, reentrega retida, avanço e `droppedHolds` 0 |
| Códigos 0, 7, 8 e 9 do `marc wait` (d4) | `src/cli-wait-status.ts`, porta `ReservationPort` no `WaitLoop` | `cli-wait-daemon.test.ts` contra o daemon real: concedido, rearmado, retido e liberado por extend |
| Origem lida da mensagem canônica; a UI registra a origem na mesma fila (d5) | `originOf` no store da reserva; `postUiMessageIn` | `daemon-activation-ui-post.test.ts`: falha da gravação e estado inválido |
| Tentativas por execução (`runId`), poll sem custo, poda segura (d6) | `isNewRun` (só a lista de admitidos), `pruneRecords` com `prunedThrough` monotônico | `core-activation-reservation-grants.test.ts` |
| Débito na etapa de origem (d7) | `stageOf` usa o carimbo da mensagem | Testes de núcleo; ADR corrigida nesta revisão |
| Carimbo em duas fases, nunca bloqueando o post (d8) | `message-post-stamp.ts`: preparar, gravar e confirmar, timeout de 1,5 s, `warnings: string[]` | `mcp-activation-daemon.test.ts` contra o daemon real; `mcp-message-*.test.ts` |
| Piso contra restauração (d11) | `stampedFloorOf` derivado do CHAT.md; a recuperação grava o máximo entre o gravado e o carimbado | `daemon-activation-floor.test.ts` |
| Juízo em sete passos, dentro da fila (d12) | Tabela `STEPS`. Desde a tarefa H, `readQueueFacts` (`src/daemon/activation-queue-facts.ts`) lê a política, a pausa, a configuração de ciclos, o piso e os arquitetos no mesmo passo da fila que grava, na reserva, no avanço do agente e em "More N cycles" e "Advance stage" | Testes de núcleo por passo; `daemon-activation-queued-judgment.test.ts`: 7 cenários com a fila ocupada, iguais à chamada feita depois da mudança |
| Freio de cadeia dispensado só no waiter governado (d13) | `governed()` no `WaitLoop` | `core-thread-wait-governed.test.ts`: o modo manual continua saindo com 2 |
| Lead (rev. 5, item 3) | `activation-lead.ts`, `PUT …/activation/lead` com comparação; `effectiveLeadOf` volta ao lead derivado se o gravado deixar de ser arquiteto | `core-activation-lead.test.ts`; integração com o daemon real |
| Avanço ao postar e critérios do Codex (rev. 5, item 4) | `agentAdvanceIn` decide dentro da fila; `advanceTo` e `expectedStage` capturados do preparo; `stage_advance_unknown` no timeout | `daemon-activation-advance-integration.test.ts` com sessão verificada; `daemon-activation-advance-unknown.test.ts` |
| Salto para qualquer estágio à frente, sem ampliar o teto | `destinationOf`; nenhum contador zerado | Testes de salto pelo lead e pelo humano; outcome `skipped` na seção Activity |
| Thread encerrada: sem ⚡ e com a pasta limpa (tarefa I, aceite do humano) | `ThreadActivationSlot` devolve `null` com `isClosedThread`; `forgetClosedThread` e `removeClosedThreads` removem o estado e o `policy.json`, quando o SUMMARY.md aparece e na partida; `writeThreadPolicy` confere o SUMMARY.md dentro da trava da thread, a mesma do resumo, e o PUT responde 409 `thread_closed` | `daemon-thread-policy-cleanup.test.ts` (5), `core-activation-policy-closed-write.test.ts` (4), `daemon-activation-policy-closed-race.test.ts` (1), `ui-thread-activation-closed.test.ts` (2); mutação de controle: sem a conferência na trava, os 3 casos de thread encerrada falham |
| Menu de sessões fora da thread encerrada (tarefa J, aceite do humano; defeito vindo da F2) | `ThreadSessionsSlot` devolve `null` com `isClosedThread`; `buildThreadSessionsView` devolve `warnings: []` quando `SessionServices.isClosed`, ligado em `server.ts` ao mesmo `closedThreadChecker(store)` do registro, diz que a thread está encerrada; slots e formato da resposta não mudam | `daemon-session-routes.test.ts` (1 novo: a mesma thread aberta com pendências e depois encerrada sem elas), `ui-thread-sessions-closed.test.ts` (2); mutação de controle: sem `isClosed` no `server.ts`, o caso de thread encerrada falha |
| Painel e cartão (rev. 5, item 5) | Selo único, barra âmbar no limite, retidas, escolha do destino, Leads e Make lead, Recover em `ledger_restored`, marca "Advanced to" vinda do `stageHistory` | Prints do Playwright CLI comparados com a maquete (seção 6) |

## 4. Validação

**Checagens independentes do principal** (Node v26.13.0, depois da tarefa J):

- `pnpm typecheck`: exit 0;
- `pnpm code:check` (lint e formatação, só leitura): exit 0;
- `pnpm build`: exit 0;
- `pnpm test`: 1994 testes, todos passando. Eram 1972 antes da tarefa H, que somou as 7 regressões com a fila ocupada, 1979 antes da tarefa I, que somou 12, e 1991 antes da tarefa J, que somou 3.

Entre os arquivos de código tocados pelas tarefas H, I e J, só `src/daemon/session-views.ts` passa de 300 linhas brutas: ficou com 324 depois da tarefa J. O arquivo de teste `daemon-activation-queued-judgment.test.ts` foi a 303 linhas brutas com o ajuste do helper. O lint passa nos dois, porque conta só linhas de código.

**Checagens por rodada:**

- 247/247 testes de ativação e wait (tarefa D);
- 81/81 de wait, MCP e integração (tarefa E);
- 294/294 e 34/34 (tarefa G).

**Último relatório de cada dev:** `pnpm validate`, `pnpm build` e `pnpm test` completo, com exit 0, nas quatro tarefas. O último ajuste da F também passou: 1972/1972, com snapshot fora do escopo sem nenhuma fonte alterada.

**Classificação da entrega:** mudança executável no núcleo, no daemon, na CLI, no MCP e na UI, além de mudança no contrato de parsing (`pass` virou `cycle`). Por isso o conjunto completo de checagens foi aplicado.

## 5. Achados e correções

Todos foram corrigidos pelos devs responsáveis e reconferidos por mim.

**Tarefa D:**

- uma concessão retida pela pausa era encerrada por engano no avanço;
- havia uma corrida entre a gravação de uma mensagem da UI e o registro da origem;
- o registro da origem da UI rodava em toda thread, mesmo sem política;
- cada poll de uma reserva retida regravava o estado;
- faltavam testes obrigatórios;
- um waiter rearmado durante a pausa furava o limite de tentativas;
- uma falha depois da gravação da UI levava o humano a postar de novo.

**Tarefa E:**

- faltava provar o caminho real entre a CLI, o MCP e o daemon (granted, held, stamp e confirm);
- o estágio recebido no carimbo não era validado;
- um teste usava uma espera fixa, que podia ficar instável.

**Tarefa G:**

- havia um aviso único, que escondia falhas simultâneas;
- faltava o teste do caminho em que o avanço tem resultado desconhecido;
- um lead gravado que deixava de ser arquiteto continuava valendo.

**Tarefa F:**

- a hierarquia visual da retida estava errada;
- o "Cancel" tinha a mesma ênfase do estágio de destino;
- aparecia uma nota que descrevia o supervisor da F3c;
- a barra não mudava de cor no limite;
- o selo da mensagem que avançou repetia o estágio;
- o rótulo "Final review" ainda aparecia na seção Activity.

**Revisão integrada:**

- a ADR chamava o lead de "person";
- a ADR descrevia o débito no "estágio atual" em vez do estágio de origem;
- `conductorOf` foi renomeado para `derivedLeadOf`;
- a redação "the mARC" foi corrigida no texto do skill e no `agent-workflows.md`.

**Parecer do Codex sobre esta revisão (msg_306a9112f8f54043ac), corrigido pela tarefa H:**

- a reserva lia a política, a pausa e a configuração de ciclos antes da fila. Com a pausa ligada durante a espera, ela era concedida e debitava 1;
- o avanço do agente usava o limite de ciclos lido antes da fila. Com o limite reduzido durante a espera, ele avançava em vez de ser recusado com `stage_exhausted`;
- "More N cycles" e "Advance stage" julgavam a prontidão antes da fila e concediam o valor desse retrato.

Na primeira versão desta revisão, eu tinha registrado esse caso como limite, e foi um erro: a decisão 12 já exigia o juízo dentro da fila. Agora as três ações leem tudo o que autoriza no passo que grava. O dev conferiu com uma mutação de controle que a regressão pega o defeito. A tarefa H também mudou uma ordem de recusa: uma thread fechada com a política desligada passa a responder `thread_closed`, e antes respondia `policy_disabled`. Os dois casos dão 409.

**Aceite do humano, corrigido pela tarefa I:**

- o painel ⚡ de uma thread encerrada com a política ligada mostrava "Paused" e o aviso de política alterada fora do mARC, e oferecia ações que o daemon recusa. A causa era o `policy.json` que ficava na pasta depois que o encerramento apagava o estado;
- o "Make lead" não tinha o cursor de clique.

Na primeira rodada da tarefa I, encontrei uma corrida: um salvamento da política no instante do encerramento podia gravar o `policy.json` depois da limpeza, e ele só sumiria no próximo início do daemon. A correção confere o encerramento dentro da trava da thread. Também pedi a validação visual com o botão "Make lead" real, que não tinha aparecido na workspace temporária sem perfis de arquiteto. Fora do escopo autorizado, o dev ajustou o tipo de um helper em `daemon-activation-queued-judgment.test.ts` para o novo retorno de `writeThreadPolicy`, sem mudar comportamento. Aceitei.

**Aceite do humano, corrigido pela tarefa J:** o menu de sessões da thread encerrada da F0 mostrava "Pending 2": uma menção sem resposta e a troca entre arquitetos esperando o humano. O defeito vinha da F2, porque a view derivava as pendências das mensagens sem conferir o encerramento. Numa thread encerrada, o menu também não tinha nada útil: o vínculo com a sessão nativa é apagado junto com o estado, e o daemon recusa abrir sessão com `thread_closed`. O humano perguntou se o menu serviria para voltar a uma sessão antiga. Hoje não serve, porque o vínculo não sobrevive ao encerramento. Guardar esse vínculo seria um recurso novo, fora da F3b.

A tarefa J passou na primeira rodada, sem achados. A conferência de encerramento fica na view do daemon. A derivação pura de `src/core/session-warnings.ts`, que só a view usa, não mudou. A view de sessões é só leitura e não autoriza nada, então ler o encerramento fora de uma fila não abre corrida de decisão.

A tarefa F também corrigiu uma quebra entre G e F: o botão "Advance stage" da UI não enviava o destino que a rota da tarefa G passou a exigir.

## 6. UI e validação visual

O painel segue a maquete aprovada pelo humano depois da revisão 5:

- o estágio aparece como um selo único, sem a fileira de três passos;
- o desligado mostra só o interruptor;
- a retida fica logo acima de "More N cycles" e "Advance stage";
- a escolha do estágio de destino mostra quantas retidas serão encerradas;
- os participantes mostram Leads e Make lead;
- `ledger_restored` aparece com Recover.

O cartão mostra "Planning · cycle N". A mensagem que avançou mostra só "Advanced to <stage>", a partir do `stageHistory` da view, que é carregada uma vez por seleção de thread.

**Validação visual:** Playwright CLI num daemon temporário (porta 4197) com workspace de teste, limpos ao final. O daemon real não foi tocado.

**Tarefa I:** Playwright CLI num daemon temporário (porta 4399), com dois perfis de arquiteto criados só na workspace temporária. O ⚡ aparece na thread aberta e some na encerrada, e o `policy.json` da thread encerrada foi removido pelo próprio daemon. Os dois botões "Make lead" reais mostram `cursor: pointer`. O `not-allowed` foi conferido forçando `disabled` pelo DOM, porque o estado ocupado real é passageiro. Tudo foi limpo ao final, e o daemon real não foi tocado.

**Tarefa J:** Playwright CLI num daemon temporário (porta 4299). Na thread aberta aparecem o ⚡ e o 👥 com o contador 2, e na encerrada nenhum dos dois. Pela API, a thread aberta volta com 2 pendências e a encerrada com nenhuma, mantendo os mesmos slots. Conferi os dois prints. O daemon foi parado pelo PID verificado e o ambiente temporário foi apagado. Um snapshot do Playwright mostrou no output do dev o token do daemon temporário, que estava num campo da UI. O daemon já foi parado e o arquivo apagado, então não há exposição residual.

**Limite da validação visual:** a marca "Advanced to" foi semeada no estado temporário, porque o avanço feito pelo agente exige o MCP com identidade verificada. Esse caminho está coberto pelos testes de integração do daemon. Os prints 02, 05, 07 e 08 são anteriores à remoção da nota do interruptor ligado.

## 7. Documentação

- **ADR 0014:** reescrita com o princípio "mecanismo no mARC, processo no RULES", os estágios como encaixe macro, o lead, o avanço ao postar, o teto 3 × N, a reserva, a retenção, os códigos 7, 8 e 9, o carimbo `cycle` e os limites.
- **`docs/ui-and-daemon.md`:** as rotas novas e o painel.
- **`docs/mcp-tools.md` e `docs/agent-workflows.md`:** o `advanceTo`, os avisos, o lead e o waiter governado.
- **`src/core/marc-ops-skill.ts`:** atualizado. Depois do reinício com a build da tarefa H, o `workspace_update_recommendations` confirmou o `.agents/skills/marc-ops/SKILL.md` em dia, com o texto da F3b.
- **Tarefa I:** `docs/ui-and-daemon.md` (o ⚡ só aparece na thread aberta; o encerramento remove o estado e o `policy.json`) e a ADR 0014 (o mesmo, no ponto do encerramento).
- **Tarefa J:** `docs/ui-and-daemon.md`, no parágrafo do menu de sessões: ele não aparece numa thread encerrada, e a view de sessões dela volta sem pendências, com os mesmos slots.

## 8. Limites e riscos remanescentes

- **Identidade do Codex:** ela só passa a ser verificada na F5. O avanço do Codex como lead é recusado com `identity_unverified`, e o humano avança pelo painel.
- **Token compartilhado:** um portador do token poderia forjar pid e ppid. Esse limite das interfaces cooperantes já está na ADR 0014.
- **Sessão verificada:** foi testada com o processo simulado (`runAgents` nas fixtures), sem um cliente real vivo.
- **Leituras que continuam fora da fila, sem conceder nada:**
  - a identidade do agente é verificada antes da fila, como a tarefa G definiu;
  - `postUiMessageIn` decide com a política lida antes da fila só se registra a origem humana;
  - a resposta de uma thread fechada ou ilegível não grava nada;
  - a view do painel (GET) só exibe.
- **Fila mais longa:** o passo da fila agora lê o CHAT.md, a política, a configuração e os perfis, então segura a fila da thread por mais tempo. O custo não foi medido. Não pesou nos testes.
- **`governedOf` duplicado:** existe no MCP e no runtime do wait. Vale extrair numa tarefa futura.
- **Arquivos grandes:** alguns arquivos passam de 300 linhas brutas, como `src/ui/types.ts`, `activation.css` e `message-post-stamp.ts`. O lint passa, porque conta só linhas de código.
- **Typecheck:** o `pnpm typecheck` não cobre `.tsx`. A tarefa F conferiu os arquivos novos à parte e recomendou incluir `src/ui/**/*.tsx` no typecheck numa tarefa própria.
- **Cache derivado:** `.marc/cache/thread-index.json` é regravado durante a validação.
- **"Save" com o interruptor desligado:** o botão vem da F3a e continua visível. A maquete não o mostrava, mas ele é necessário para gravar o interruptor.
- **UI real até o reinício:** o daemon real não roda a build da tarefa J. O 👥 escondido e a view sem pendências só valem depois de um novo reinício, assim como a limpeza do `policy.json` e o ⚡ escondido da tarefa I, se o daemon atual ainda não tiver a build dela. Na partida, a limpeza remove o `policy.json` que ficou na thread de teste encerrada.
- **Sessão antiga depois do encerramento:** o vínculo com a sessão nativa morre com o estado da thread, então não há como reabrir pelo mARC a sessão que atendeu uma thread encerrada. Para isso, o vínculo teria de ficar num registro durável, um recurso novo que não foi decidido.
- **Limpeza em melhor esforço:** um `policy.json` que não puder ser apagado, por exemplo preso por outro processo no Windows, fica até a próxima passada, sem log.

## 9. Veredito e próximos passos

**Aprovado tecnicamente** para o estado depois da tarefa J. Esta aprovação substitui a do estado depois da tarefa I, que o Codex confirmou em msg_880725648dd3410ea9, porque a tarefa J mudou o código. Os critérios da revisão 4.1 e da revisão 5, os critérios do Codex para a tarefa G, a correção da tarefa H e os ajustes do aceite estão implementados, documentados e cobertos por testes. Conferi a validação de forma independente.

Próximos passos, separados desta aprovação:

1. a confirmação do Codex sobre a tarefa J;
2. o aceite do humano depois de um novo reinício com a build da tarefa J:
   - o ⚡ e o 👥 não aparecem numa thread encerrada;
   - o `policy.json` da thread de teste encerrada some da pasta;
   - o "Make lead" mostra o cursor de clique;
3. o stage, com o OK de Git, e o amend do humano no commit da F3.

A thread continua aberta para a F3c.
