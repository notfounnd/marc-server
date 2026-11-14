# Entrega C da F4: aprovar só na primeira vez

Autor: claude-dev (developer). Escopo autorizado pelo principal, com as respostas 1 a 6.

## Regra implementada
- O primeiro Approve de um agente grava `activation.approvals` com `agentId`, `revision` (a revisão da política em vigor) e `at`. Cada agente guarda no máximo uma aprovação (`withApproval`).
- Um card aguardando de um agente aprovado inicia sozinho na passada, pela ação `auto` de `startIn`. Ela passa pelas mesmas reconferências do Approve (política pronta, pausa, saldo de ciclos, limite de tempo, slot e posse) e não grava aprovação nova.
- Recusa deixa o card aguardando, e a próxima passada tenta de novo. Nada repete de imediato.
- Retry e continue de turno que falhou continuam manuais.
- Salvar a política, ligada ou desligada, gera revisão nova. `activityAfterSave` não copia as aprovações, então elas caem.
- Aprovação vale só com a revisão em vigor (`approvedAgentsOf`).

## Código (caminhos e linhas)
- `src/core/activation-supervision-types.ts:49`: `auto?: boolean` em `SupervisionTurn`.
- `src/daemon/activation-file.ts:37` e `41-45`: `approvals` e o tipo `ActivationApproval`. Validador `isOptionalApprovals` em `253-262`, chamado em `249`.
- `src/daemon/activation-activity.ts:57-59` (comentário do save), `77-86` (`withApproval`), `88-96` (`approvedAgentsOf`), `98-106` (`isApprovedAt`).
- `src/daemon/supervision-start.ts`: `StartAction` com `auto` (linha 38 em diante); `auto` na regra e `autoRefusal` (`99-111`); `startRefusalOf` com `approved` opcional (`131`); `JUDGED_VIEW.auto` (`147`); `ACTIVATION_AFTER` (`151-161`); `TURN_MARK` (`166-171`); fato `approved` (`235`); marca do turno (`301`); gravação da aprovação só no Approve (`305-322`).
- `src/daemon/supervision-pass.ts`: `PassResult` (`58`); retorno com `autoCards` (`100-106`); `autoCardsOf` (`114-128`); `revisionOf` (`132`).
- `src/daemon/supervision-service.ts`: laço dos cards automáticos (`78-80`); `startApproved` (`87-101`), com `startIn`, `runner.start` e `notify`.
- `src/daemon/activation-supervision-file.ts:52`: validação de `auto`.
- `src/daemon/supervision-views.ts`: `offers` aceita só `retry` e `continue`.
- `src/daemon/activation-views.ts`: `approvedAgents` em `ActivationBody` (`87`, `172`) e em `ExtrasView` (`97`, `107`, `221`); `revisionOf` da política.
- `src/ui/types.ts:317`: `approvedAgents?`.
- `src/ui/thread-activation-people.ts:6-22`: `participantRowsOf` marca o aprovado.
- `src/ui/thread-activation-lists.tsx`: ícone `UserCheck` depois do nome, no grupo `activation-name-group`, com `aria-label` e dica.
- `src/ui/thread-activation-status.ts:14-17` (`approvalWarningOf`), `65` (nota da política ligada), `219-220` (chaves em `STATUS_LABEL_KEYS`).
- `src/ui/thread-activation-form.tsx`: aviso do rodapé, singular e plural, em qualquer Save com aprovação válida.
- `src/ui/styles/activation.css:121-131`: grupo do nome com ícone, `gap: 6px`, e ícone em `var(--teal)`.
- `public/locales/en_US/translation.json`: cinco chaves novas depois de "Make lead".
- `docs/adrs/0014-policy-gated-mention-activation.md`: linha 14 (regra da F4) e linha 59.
- `docs/ui-and-daemon.md`: seção "Thread activation policy and workspace pause".

## Testes
- Novo `test/daemon-supervision-auto-start.test.ts` (9 cenários): primeiro Approve, início automático com `turn.auto`, agente não aprovado com card, salvar de novo, desligar e ligar, saldo esgotado, pausa, turno com falha e Approve recusado sem gravação.
- Novo `test/daemon-activation-approvals.test.ts` (validador, substituição por agente, revisão, save que limpa).
- Novo `test/ui-thread-activation-approvals.test.ts` (aviso singular e plural, chaves do catálogo, nota da política ligada).
- `test/ui-thread-activation-people.test.ts`: argumento novo e 3 casos de aprovação.
- `test/ui-thread-activation-choices.test.ts`: nota da política ligada.
- `test/daemon-supervision-turn-run.test.ts`, "the second mention resumes the session": o teste codificava o Approve por início da F3. Agora espera o início automático e confere `turn.mode` e `turn.auto`. A asserção de retomada e de custo delta não mudou.

## Checagens reais
- `pnpm typecheck`: passou.
- `pnpm code:check`: passou. ESLint sem erros; Prettier aplicado nos arquivos alterados.
- `pnpm build`: passou. O aviso de chunk acima de 500 kB já existia.
- `pnpm test`: 2637 de 2637 na última rodada. Uma rodada anterior teve `EPERM` ao limpar um lock de cache no Windows, em `test/daemon-diagnostics-routes.test.ts` ("a closed thread stays readable"). Isolado, o arquivo passou 6 de 6, e a suíte seguinte passou inteira.
- `pnpm validate`: não rodado, por autorização do principal.

## Verificação visual
- Playwright CLI, headless, sessão `f4visual`. Daemon temporário do build em `127.0.0.1:4197`, porta livre. O daemon real segue na 4187, sem toque. Workspace e dados no scratchpad. A aprovação foi semeada no arquivo temporário da thread.
- `C:\Users\junior\AppData\Local\Temp\claude\16769ecf785bb7f2\0e8bcfec-b2e2-430d-b3fb-05858e8b61db\scratchpad\f4-ui\panel-f4-approval.png`: painel com a pílula On, a nota nova, o card em espera e o aviso do rodapé.
- `C:\Users\junior\AppData\Local\Temp\claude\16769ecf785bb7f2\0e8bcfec-b2e2-430d-b3fb-05858e8b61db\scratchpad\f4-ui\panel-menu.png`: participantes com o ícone depois do nome, o selo Leads e o aviso.
- Medidas do ícone: 14 por 14 px, cor rgb(15, 118, 110) (`var(--teal)`), dica e `aria-label` conforme o texto, grupo em flex com gap de 6 px.
- Nenhum processo de cliente foi iniciado. A aprovação foi semeada e a menção ficou só no arquiteto não aprovado.

## Limites e riscos
- O resumo não separa os inícios automáticos (decisão do principal). Só `turn.auto` no card, que guarda o último início.
- Um card de arquiteto aprovado fica aguardando por um instante, até a passagem seguinte iniciar.
- Um Approve sem `activation` pronta não chega à gravação, porque o gate da reserva devolve `held` antes.

## Pendente
- Revisão integrada do principal. Esta entrega não é aprovação técnica.
