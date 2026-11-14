# Plano: F4, ativação automática limitada

Thread: marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa
Autor: marc://@claude-software-architect. Data: 13/11/2026.

## Contexto

A F3 entregou três peças:
- a política por thread;
- a reserva atômica;
- o supervisor em modo confirmar, que mostra um card a cada início de um arquiteto sem sessão aberta.

A F4 tira a confirmação repetida, dentro do orçamento. A thread acumulou cinco itens com o aval do humano:

1. **Aprovar só na primeira vez** (msg_b3b1fe9d6bad430888). Depois do primeiro Approve de um agente numa thread, os inícios seguintes desse agente não mostram card, dentro do saldo de ciclos. A aprovação cai quando o interruptor é desligado ou a política é salva de novo.
2. **Perguntar sobre a escuta** (msg_cb6e8235502e4cf693). O principal pergunta ao começar a trabalhar numa thread e pergunta de novo no vencimento.
3. **Caminho do helper sem letra de drive** (msg_f5c0762395354ae8bd).
4. **Retenção por identidade** (msg_061d600300cc40e3a0). A rota de diagnóstico já foi entregue na 264e0ebf. Falta a causa.
5. **Freio do modo manual por ciclos** (msg_98c4a1b30f7b4e9dbd).

**Critérios de entrada:**
- a F3 está concluída e commitada;
- há dado de custo (o turno real da F3 custou 0,0076 USD);
- não houve laço, porque o orçamento de ciclos segura o vaivém;
- a célula G1 da F0 está atendida (matriz-f0-consolidada.md: "A F4 pode abrir");
- o humano autorizou o desenvolvimento em 13/11/2026.

**Decisões do humano (13/11/2026):**
- **A pergunta sobre a escuta:** vira padrão do produto, nas orientações gerenciadas e registrada no ADR 0014.
- **Painel geral:** ganha um controle do comportamento padrão da escuta, com duas opções. "Desligada, perguntar se liga" é o padrão. A outra é "ligada, perguntar se desliga".
- **Prazo padrão da escuta:** passa de 120 minutos para 8 horas. O máximo continua 24 horas.

**Fora do escopo:**
- o Codex automático, que é da F5;
- repetir sozinho um turno que falhou (retry e continue continuam manuais);
- a menção feita com a política desligada que vira card quando ela é ligada (sem decisão).

## Causa da retenção por identidade (achada na exploração)

- **Quando o vínculo é atualizado:** o vínculo de um slot só passa para o processo de uma sessão retomada quando essa sessão faz um `message_post` naquela thread (`src/daemon/session-observation.ts`, `planObservation` com "resume").
- **O que falha:** a reserva da escuta lê o vínculo gravado (`src/daemon/waiter-identity.ts:29-51`) e nunca consulta o `resumedBy`. Por isso a escuta falha em `not_descendant`: ela roda sob o claude.exe novo, e o vínculo ainda aponta o PID antigo.
- **Evidência:** o `marc diagnose` na thread ed411583 mostrou o vínculo com o PID 23724 e o estado `session_resumed` com o processo 36832.

## Desenho

### 1. Identidade: julgar a escuta pelo processo que retomou a sessão (só leitura)

- **Daemon** (`src/daemon/waiter-identity.ts`): sondar o slot com `probeFor` (`session-views.ts:180`). Quando o motivo for `session_resumed` e o `resumedBy.sessionId` for igual ao holder, passar `resumedBy` em `WaiterFacts`.
- **Núcleo** (`src/core/waiter-identity.ts`): `clientPidOf` e `recordedStartOf` usam o `resumedBy`, quando ele existe. A tabela de nove códigos não muda.
- **Segurança:** o `resumedBy` já exige quatro condições, e a escuta ainda precisa descender desse processo exato:
  - a lista de agentes completa, no mesmo host;
  - o dono antigo comprovadamente fora;
  - um único processo carregando a sessão, com início verificado;
  - nenhum conflito vivo.
- **Sem gravação:** o vínculo continua sendo atualizado no primeiro post da sessão, como já está documentado.

### 2. Caminho da workspace no helper

- Aplicar `resolveWorkspace` (`src/core/paths.ts`) na origem, nos três pontos:
  - `src/mcp/workspace-tools.ts:26`;
  - `src/mcp/server.ts:58`;
  - `src/mcp/helper.ts:272`.
- Não resolver dentro de `buildMarcCommand`, para não quebrar os casos POSIX dos testes.

### 3. Freio do modo manual por ciclos

**Contagem** (`src/core/thread-mentions.ts`): `architectChainLength` dá lugar a `architectCycleCount`.
- Ela percorre as mensagens depois da última mensagem humana.
- Uma mensagem de arquiteto que menciona outro arquiteto (marc://@X) abre um pedido para X.
- A próxima mensagem de X fecha o pedido e conta um ciclo.
- Mensagens humanas zeram a conta. Mensagens de dev não contam.
- O limite padrão continua 3, agora em ciclos.

**Quem é arquiteto:**
- os perfis com papel de arquiteto, que a escuta já carrega (`cli-wait-command.ts:126` e `participantsOf` em `activation-policy.ts`);
- ou um agente que já postou como arquiteto na thread.

**A lista de mencionados:** um helper novo, montado com `removeFencedMarkdownCode`, `removeQuoteLines`, `messageReferences` e `parseMarcReference`.

**Também acompanham a mudança:**
- o texto `NEXT_STEP.chain_limit` (`src/cli-wait-status.ts:35`);
- `chainLimitWarnings` (`src/core/session-warnings.ts`);
- o texto da UI em `thread-sessions-pending.tsx:28-35`;
- a documentação.

**Modo governado:** nada muda.

### 4. Prazo e comportamento padrão da escuta

- **Prazo:** `DEFAULT_TIMEOUT_MINUTES` passa a 480 (`src/cli-wait-command.ts:61`). A faixa continua de 1 a 1440.
- **Configuração da workspace:** seção nova `listening: { defaultOn: boolean }` em `.marc/settings.json`, com padrão `false`.
  - Leitura, normalização e gravação ficam em `src/core/memory/settings.ts`, nos tipos `WorkspaceSettings`/`WorkspaceSettingsInput` (`src/core/types.ts:276-288`) e na rota de configurações.
  - É só uma preferência: não dá acesso a nada nem passa pela autorização da ativação.
- **UI:** uma linha com um interruptor no modal de configurações da workspace, no mesmo componente das linhas que já existem (`workspace-settings-panel.tsx`). As chaves novas vão para o catálogo en_US.
- **Para o agente:** o `marc_helper` (tópico `listening`) passa a devolver `listeningDefault: "off" | "on"`, lido do arquivo pelo núcleo, sem daemon.
- **Orientação gerenciada:**
  - skill `src/core/marc-ops-skill.ts:106-114`;
  - helper `src/mcp/helper.ts:229-252`;
  - `docs/agent-workflows.md` "Listening for mentions";
  - `README.md:190`;
  - `docs/mcp-tools.md`.
- **O que a orientação passa a dizer:**
  - **No começo do trabalho numa thread:** o principal lê o padrão. Com o padrão desligado, ele pergunta se o humano quer que ele escute. Com o padrão ligado, ele arma a escuta e avisa numa linha, oferecendo desligar.
  - **Quando a escuta vence** (exit 7): com o padrão desligado, ele pergunta antes de rearmar. Com o padrão ligado, ele rearma e avisa.
  - **Reinício e compactação:** depois de reiniciar a sessão, a pergunta volta. Depois de uma compactação, ela não se repete.
  - **Onde vale:** só no Claude Code. O Codex fica para a F5.
- **Textos do comando:** o `NEXT_STEP.timeout` acompanha a regra.
- **Registro:** a decisão entra no ADR 0014.

### 5. Aprovar só na primeira vez

- **Registro da aprovação:**
  - Um Approve bem-sucedido (`startStep`, `src/daemon/supervision-start.ts:251-267`) grava `activation.approvals: [{agentId, revision, at}]` em `ThreadActivity` (`src/daemon/activation-file.ts:27-36`, com o validador `isOptionalActivation`).
  - `activityAfterSave` (`src/daemon/activation-activity.ts:58-73`) reconstrói a atividade, então a aprovação cai sozinha em qualquer gravação com a política ligada.
  - O vínculo com a `revision` derruba a aprovação também quando a política é salva desligada.
- **Início automático:**
  - Ação nova `"auto"` em `START_RULES`/`JUDGED_VIEW` (`supervision-start.ts:38, 68-85, 114-121`). Ela exige um card `awaiting_confirmation` e uma aprovação do destinatário com a revisão atual, passa pelas mesmas reconferências do Approve e não grava uma aprovação nova.
  - `runSupervisionPass` passa a devolver os pares que ficaram aguardando.
  - Em `passThread` (`src/daemon/supervision-service.ts:64-77`), cada par aprovado chama `startIn(..., "auto")` e `runner.start`, como `postStart` faz (`activation-supervision-routes.ts:81-97`).
  - Uma recusa passageira deixa o card aguardando, e a próxima passada tenta de novo.
- **Marca no turno:** o turno ganha `turn.auto: true` (com `isOptionalTurn`), e a contagem do resumo separa os inícios automáticos.
- **UI:**
  - um selo "Approved" ao lado do participante aprovado, no mesmo componente do selo "Leads" (`thread-activation-lists.tsx`);
  - uma nota de status com a política ligada, explicando que o primeiro início de cada agente pede aprovação;
  - um aviso no rodapé, no padrão do aviso de estágios legados: salvar limpa a aprovação de N agentes.
- **Documentação:** ADR 0014, cuja linha 14 vira a regra da F4, e `docs/ui-and-daemon.md`.

### Maquete de UI

Antes de despachar a tarefa B2, publico uma página privada com o interruptor da configuração, o selo "Approved", a nota e o aviso do rodapé. A escolha é sua.

## Tarefas (um dev por vez: claude-dev, general-purpose, haiku, effort xhigh, sem Git)

- **A:** itens 1 e 2, com testes:
  - uma escuta sob o processo que retomou a sessão é verificada;
  - um processo alheio continua retido;
  - o helper resolve um caminho sem drive.
- **B1:** itens 3 e o prazo do item 4, com os testes de `thread-mentions`, `session-warnings` e `cli-wait`.
- **B2:** o restante do item 4: a configuração, a UI, o `marc_helper`, a skill e a documentação.
- **C:** item 5, com os testes:
  - a primeira menção mostra card, e depois do Approve a seguinte inicia sozinha;
  - salvar ou desligar a política devolve o card;
  - o saldo esgotado não inicia nada.

**Ritual de cada tarefa:**
1. o `OK_BOOTSTRAP` e a autorização pelo canal entre agentes;
2. a entrega publicada pelo próprio dev na thread;
3. de 2 a 3 rodadas de revisão minhas.

**No fim:**
1. a revisão integrada em `revisao-integrada-f4.md`;
2. a confirmação do Codex, recebida pela escuta;
3. o seu aceite;
4. o stage, com o OK de Git.

## Execução, depois da aprovação deste plano

1. Publicar na thread 944287aa a proposta estruturada, com este plano anexo como `artifacts/plano-f4-automatico-limitado.md`.
2. Rodar `workspace_update_recommendations` e o `workspace_audit` com `scope: preflight`.
3. Despachar a tarefa A, depois a B1. Publicar a maquete, despachar a B2 e depois a C.

## Verificação

- **Checagens:** `pnpm typecheck`, `pnpm code:check`, `pnpm build` e `pnpm test` completo, pelo context-mode.
- **Ponta a ponta, num daemon temporário com o build:**
  - um vínculo com um PID antigo e uma lista de agentes com o processo novo da mesma sessão: a escuta governada é concedida;
  - uma thread governada: o primeiro card pede Approve, a segunda menção inicia sem card, e depois de salvar a política o card volta.
- **Escuta manual:** uma troca Claude → Codex → Claude não dispara o freio. Três ciclos disparam.
- **`marc_helper listening`:** devolve o caminho com a letra do drive e o `listeningDefault`.
- **No daemon real, a seu pedido:** `marc diagnose` e uma escuta governada numa sessão retomada, para confirmar o caso da F3.
